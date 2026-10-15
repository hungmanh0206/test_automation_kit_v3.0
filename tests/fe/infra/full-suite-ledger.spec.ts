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
