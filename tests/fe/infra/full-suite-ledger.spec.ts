import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { canRepoGit } from './_trong_repo';
import { gateEnv } from './_gate_env';

/*
 * @infra — CỬA CHẶN ĐÓNG GÓI, và nó TỪNG KHÔNG CÓ MÁY NÀO CANH.
 *
 * `full_suite_ledger.js` quyết định `package:kit` có được chạy hay không. Đo 15/10/2026: không spec
 * nào nhắc tới nó. Một cửa chặn mà không ai canh thì hỏng im lặng — và nó hỏng theo hướng tệ nhất,
 * vì hỏng ở đây nghĩa là ghi một con số không mô tả cây sắp phát hành.
 *
 * Điều kiện quan trọng nhất ở đây: MẪU SỐ CỦA LƯỢT CHẠY phải bằng mẫu số của GÓI.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const L = require(path.join(REPO, 'scripts/qa/full_suite_ledger.js'));
const PK = require(path.join(REPO, 'scripts/qa/package_kit.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

test.describe('@infra full:suite — mẫu số của lượt chạy phải bằng mẫu số của GÓI', () => {
  test('chạy đúng spec ĐÃ GIT TRACK, không quét cả thư mục', () => {
    /*
     * Bản trước truyền thẳng `tests/fe/infra` cho Playwright, tức quét mọi file trên đĩa. Hậu quả đo
     * được: một spec probe CHƯA TRACK (chạm UAT, timeout 30s) làm `full:suite` đỏ và chặn đóng gói,
     * trong khi nó không bao giờ nằm trong gói — cây đang phát hành vẫn sạch.
     */
    canRepoGit(REPO, 'đối chiếu phạm vi chạy của `full:suite` với `git ls-files`');

    const r = L.phamViChay();
    expect(r.theoThuMuc, 'trong repo git thì KHÔNG được rơi về nhánh quét cả thư mục').toBe(false);

    const track = execFileSync('git', ['ls-files', `${L.PHAM_VI}/*.spec.ts`], { cwd: REPO, encoding: 'utf8', env: gateEnv() })
      .split('\n').map((x) => x.trim()).filter((x) => x.endsWith('.spec.ts'));
    expect(r.mucTieu.slice().sort(), 'phạm vi chạy phải ĐÚNG tập file đã track').toEqual(track.slice().sort());
  });

  test('MỌI spec sẽ đóng gói đều NẰM TRONG lượt chạy, và phần dư giải thích được bằng `DENY`', () => {
    /*
     * Điều kiện thật sự đáng khoá — nhưng KHÔNG phải "hai tập bằng nhau". Bản đầu của test này đòi
     * bằng nhau và ĐỎ ngay, vì hai tập lệch nhau có lý do chính đáng:
     *
     *   · gói ⊆ lượt chạy là BẮT BUỘC. Một spec được phát ra ngoài mà lượt chạy không phủ thì cửa này
     *     đang gật đầu cho thứ nó chưa đo.
     *   · lượt chạy ĐƯỢC PHÉP rộng hơn, nhưng chỉ đúng bằng những spec mà `package_kit.DENY` cố ý loại
     *     — lớp PROJECT, chạy thật trên DB/màn của dự án này nên mang sang dự án khác là không thể pass.
     *     Chúng vẫn phải xanh ở repo, vì ở repo chúng có thật.
     *
     * Neo phần dư vào chính `DENY` chứ không liệt kê tên file: liệt kê tên thì thêm một spec lớp
     * PROJECT là test này đỏ oan, và cách sửa nhanh nhất sẽ là nới danh sách.
     */
    canRepoGit(REPO, 'đối chiếu phạm vi `full:suite` với danh sách đóng gói');

    const chay = new Set<string>(L.phamViChay().mucTieu);
    const trongGoi = PK.collect().filter((f: string) => /^tests\/fe\/infra\/.*\.spec\.ts$/.test(f));

    const soTrong = trongGoi.filter((f: string) => !chay.has(f));
    expect(soTrong, 'spec ĐƯỢC PHÁT RA NGOÀI mà lượt chạy không phủ — cửa đang gật đầu cho thứ chưa đo')
      .toEqual([]);

    const du = [...chay].filter((f) => !trongGoi.includes(f));
    const khongGiaiThichDuoc = du.filter((f) => !PK.DENY.some((re: RegExp) => re.test(f)));
    expect(khongGiaiThichDuoc, 'spec chạy nhưng không vào gói mà KHÔNG có luật `DENY` nào nói vì sao')
      .toEqual([]);
  });

  test('ĐỐI CHỨNG: có file chưa track thì máy phải ĐẾM và NÓI RA, không im lặng bỏ', () => {
    /*
     * Bỏ bớt file khỏi lượt chạy là một việc đáng ngờ theo mặc định. Nó chỉ chấp nhận được khi máy nói
     * rõ đã bỏ bao nhiêu — im lặng thu hẹp phạm vi đúng là cách một bộ kiểm teo dần mà vẫn báo xanh.
     */
    canRepoGit(REPO, 'đếm spec chưa track');

    const dia = fs.readdirSync(path.join(REPO, L.PHAM_VI)).filter((f) => f.endsWith('.spec.ts')).length;
    const r = L.phamViChay();
    expect(r.boQuaChuaTrack, 'số bỏ phải bằng đúng chênh lệch đĩa trừ track')
      .toBe(dia - r.mucTieu.length);
    expect(r.boQuaChuaTrack, 'không được âm — âm nghĩa là phép đếm sai hướng').toBeGreaterThanOrEqual(0);
  });

  test('`--kiem` vẫn CHẶN khi sổ cũ hơn cây — thu hẹp phạm vi không được làm mất răng', () => {
    /*
     * Điều kiện đi kèm mọi bước "chống báo oan": nó không được nuốt luôn ca thật. Sổ vẫn phải ghi
     * `head` và vân tay gói, và `--kiem` vẫn phải chặn khi chúng lệch.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/full_suite_ledger.js'), 'utf8');
    expect(src, 'sổ phải còn ghi commit').toMatch(/head/);
    expect(src, 'sổ phải còn ghi vân tay của tập file sẽ vào gói').toMatch(/vanTayGoi/);
    expect(typeof L.vanTayGoi, '`vanTayGoi` phải còn dùng được').toBe('function');
    expect(typeof L.kiem, '`kiem` phải còn dùng được').toBe('function');
  });

  test('vân tay gói tính TỪ `package_kit.collect()` — không tự liệt kê lại', () => {
    /* Hai danh sách file cho cùng một gói là hai thứ sẽ trôi khỏi nhau. */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/full_suite_ledger.js'), 'utf8');
    expect(src, 'phải lấy danh sách file từ `package_kit`, không gõ lại').toMatch(/package_kit|collect\(/);
  });
});

/*
 * ĐỌC SỐ CỦA LƯỢT CHẠY (v2.9.7) — và con số sai ĐÚNG LÚC NÓ QUAN TRỌNG NHẤT.
 *
 * Đo 01/11/2026: lượt `full:suite` thật có 2404 xanh · 6 đỏ, sổ ghi `1 xanh · 6 đỏ`. `out.match` không
 * có cờ `g` nên lấy lần khớp ĐẦU TIÊN, và lần đầu nằm trong MÃ NGUỒN của một spec được in kèm thông điệp
 * lỗi — chú thích ở đó có chuỗi `"1 passed"`.
 *
 * Đoạn mã chỉ in ra KHI CÓ CA ĐỎ. Nên sổ đúng ở mọi lượt xanh và sai ở lượt đỏ. Đây là lần thứ ba trong
 * cùng đợt một cửa đọc phải CHỮ TRONG CHÚ THÍCH thay vì dữ liệu.
 */
test.describe('@infra full:suite — số ghi sổ phải ĐỐI SOÁT được với mẫu số', () => {
  test('ĐỐI CHỨNG DƯƠNG: chuỗi `1 passed` trong CHÚ THÍCH không được thành số của cả bộ', () => {
    const out = [
      'Running 3 tests using 2 workers',
      '  1) [chromium-desktop] › tests/fe/infra/x.spec.ts:9:7 › @infra ví dụ',
      '     * run thật chạy 1 test và kết luận **"1 passed"**. Nghĩa là',
      '  2 passed (1.0s)',
      '  1 failed',
    ].join('\n');
    const r = L.docKetQua(out);
    expect(r.loi, r.loi).toBeUndefined();
    expect(r.xanh, 'phải là 2 (dòng tổng kết), KHÔNG phải 1 (chữ trong chú thích)').toBe(2);
    expect(r.do_).toBe(1);
  });

  test('đọc đúng số trên log THẬT của lượt đã chạy', () => {
    const f = path.join(REPO, 'knowledge/metrics/full-suite.last.log');
    test.skip(!fs.existsSync(f), 'chưa có log lượt chạy nào — phép kiểm này cần dữ liệu thật');
    const r = L.docKetQua(fs.readFileSync(f, 'utf8'));
    expect(r.loi, r.loi).toBeUndefined();
    /*
     * Không ghim con số cụ thể (log đổi mỗi lượt chạy), mà đòi ĐỐI SOÁT: bốn nhóm cộng lại đúng mẫu số
     * Playwright khai. Đó là tính chất bản vá này mang lại, và nó đúng với mọi log.
     */
    expect(r.xanh + r.do_ + r.boQua + r.chapChon, 'bốn nhóm phải cộng đúng tổng khai').toBe(r.tong);
    expect(r.tong, 'log thật phải có mẫu số > 0').toBeGreaterThan(0);
  });

  test('ĐỐI CHỨNG DƯƠNG: cộng KHÔNG khớp mẫu số ⇒ KHÔNG ghi sổ', () => {
    const r = L.docKetQua('Running 10 tests using 2 workers\n  2 passed (1.0s)\n');
    expect(r.loi, 'lệch mẫu số thì phải từ chối, không được ghi một con số không đối soát được').toMatch(/KHÔNG đối soát nổi/);
    expect(r.xanh, 'và không được trả về số nào để ai đó ghi nhầm vào sổ').toBeUndefined();
  });

  test('ĐỐI CHỨNG DƯƠNG: thiếu dòng `Running <N> tests` ⇒ không có mẫu số ⇒ KHÔNG ghi sổ', () => {
    const r = L.docKetQua('  2 passed (1.0s)\n');
    expect(r.loi).toMatch(/không có mẫu số để đối soát/);
  });

  test('`flaky` và `skipped` được tính vào phép đối soát, không bị bỏ rơi', () => {
    const r = L.docKetQua('Running 7 tests using 2 workers\n  4 passed (1.0s)\n  1 failed\n  1 skipped\n  1 flaky\n');
    expect(r.loi, r.loi).toBeUndefined();
    expect(r.boQua).toBe(1);
    expect(r.chapChon, 'chập chờn bị bỏ rơi thì phép đối soát sẽ đỏ oan ở mọi lượt có flaky').toBe(1);
  });
});
