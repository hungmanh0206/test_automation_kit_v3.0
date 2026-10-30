/*
 * `version:check` — bốn phép kiểm thêm ở v2.9.6 N6.
 *
 * Bản gốc của cửa này đã gác: semver hợp lệ · tag ↔ version · CHANGELOG **có** mục cho bản hiện tại ·
 * cảnh báo shared change. Nó KHÔNG gác bốn thứ dưới đây, và cả bốn đều đã trôi thật:
 *
 *   ⑤ MỤC ĐỈNH phải là bản hiện tại. Đo 30/10/2026: `package.json` ghi **2.9.4** trong khi CHANGELOG
 *     đỉnh là **v2.9.5** và nhánh đang làm là **v2.9.6** — lệch hai bước. Phép kiểm "có mục" vẫn XANH,
 *     vì mục cho 2.9.4 còn nằm giữa file. Phiên bản lệch không làm lượt chạy nào đỏ nên nó trôi im lặng.
 *   ⑥ Thứ tự phải GIẢM DẦN — đó là tiền đề của chữ "đỉnh".
 *   ⑦ Phần mở đầu không được khai NGƯỢC với cách file đang được ghi. Câu cũ phủ nhận việc dùng semver,
 *     trong khi 23/23 mục đều mang `## vX.Y.Z`.
 *   ⑧ Số máy gác VIẾT TAY phải khớp bản MÁY SINH (`GATES.md`).
 *
 * MẪU SỬA-RỒI-TRẢ-LẠI: cửa đọc thẳng `CHANGELOG.md` và `package.json` của repo, nên phép kiểm phải sửa
 * tạm rồi trả lại trong `finally` — đúng mẫu `parity-check.spec.ts` đang dùng cho `a_parity_source.json`.
 * Mỗi ca còn khẳng định lại rằng file đã về nguyên trạng: một ca kiểm làm bẩn repo thì tệ hơn là không có.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/version_check.js');
const CL = path.join(REPO, 'CHANGELOG.md');
const PKG = path.join(REPO, 'package.json');
const GATES = path.join(REPO, '.agent/config/GATES.md');

function chay() {
  const r = spawnSync(process.execPath, [GATE], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Sửa tạm một file của repo, chạy cửa, rồi TRẢ LẠI nguyên trạng. */
function voi(f: string, bien: (s: string) => string, lam: (r: { code: number | null; out: string }) => void) {
  const cu = fs.readFileSync(f, 'utf8');
  try {
    fs.writeFileSync(f, bien(cu), 'utf8');
    lam(chay());
  } finally {
    fs.writeFileSync(f, cu, 'utf8');
  }
  expect(fs.readFileSync(f, 'utf8'), `${path.basename(f)} phải về nguyên trạng`).toBe(cu);
}

test.describe('@infra version:check — phiên bản và số đếm về CHÍNH KIT', () => {
  test('ĐỐI CHỨNG ÂM: trạng thái hiện tại của repo ⇒ ĐẠT', () => {
    const r = chay();
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải in số máy đã đối chiếu, để biết phép kiểm ⑧ có chạy').toMatch(/bản sao viết tay của số máy, nguồn `GATES\.md` = \d+/);
  });

  test('ĐỐI CHỨNG DƯƠNG: mục ĐỈNH không phải bản hiện tại ⇒ CHẶN, và nói rõ "có mục" không bắt được', () => {
    /*
     * Dựng lại đúng ca đã xảy ra: chèn một mục phiên bản CAO HƠN lên đỉnh. Mục cho bản hiện tại vẫn còn
     * nguyên ở dưới, nên phép kiểm 3) của bản gốc vẫn xanh — chỉ ⑤ bắt được.
     */
    voi(CL, (s) => s.replace('## v2.9.6', '## v9.9.9 — 2026-12-31 — mục giả cho phép kiểm\n\n## v2.9.6'), (r) => {
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/CHANGELOG đỉnh là \*\*v9\.9\.9\*\* mà package\.json ghi \*\*2\.9\.6\*\*/);
      expect(r.out, 'phải nói rõ vì sao phép kiểm cũ không bắt được').toMatch(/phép kiểm "có mục" KHÔNG bắt được ca này/);
    });
  });

  test('ĐỐI CHỨNG DƯƠNG: thứ tự KHÔNG giảm dần ⇒ CHẶN', () => {
    /* Chèn một mục CŨ lên ngay sau đỉnh: đỉnh vẫn đúng, nhưng "đỉnh" thôi còn nghĩa. */
    voi(CL, (s) => s.replace('## v2.9.5', '## v1.0.0 — 2020-01-01 — mục lạc chỗ\n\n## v2.9.5'), (r) => {
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/CHANGELOG KHÔNG giảm dần/);
      expect(r.out, 'phải nêu CẶP dòng lệch, không chỉ nói "sai thứ tự"').toMatch(/`v1\.0\.0` đứng trên `v2\.9\.5`/);
    });
  });

  test('ĐỐI CHỨNG DƯƠNG: phần mở đầu phủ nhận semver ⇒ CHẶN', () => {
    voi(CL, (s) => s.replace('> Lịch sử thay đổi', '> Kit chưa dùng semver.\n>\n> Lịch sử thay đổi'), (r) => {
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/phần mở đầu CHANGELOG phủ nhận việc dùng semver/);
    });
  });

  test('phép kiểm mở đầu chỉ soi PHẦN TRƯỚC mục đầu tiên — không soi cả file', () => {
    /*
     * Thiếu ranh giới này thì một mục CHANGELOG kể lại chuyện "trước đây kit chưa dùng semver" sẽ làm
     * cửa đỏ, và lúc đó người ta học cách không viết lịch sử. Chính ghi chú trong phần mở đầu đã phải
     * diễn đạt lại một lần vì phép so là so CHỮ.
     */
    voi(CL, (s) => `${s}\n\n## v0.0.1 — 2020-01-01 — thời kit chưa dùng semver\n`, (r) => {
      /* Mục thêm vào cuối làm thứ tự vẫn giảm dần, và cụm từ nằm NGOÀI phần mở đầu ⇒ không được chặn. */
      expect(r.out, 'cụm từ trong MỤC không được tính là lời khai ở phần mở đầu')
        .not.toMatch(/phần mở đầu CHANGELOG phủ nhận/);
    });
  });

  test('ĐỐI CHỨNG DƯƠNG: số máy VIẾT TAY lệch bản máy sinh ⇒ CHẶN, nêu cả hai số', () => {
    voi(GATES, (s) => s.replace(/Tổng \*\*\d+\*\* máy/, 'Tổng **9999** máy'), (r) => {
      expect(r.code, r.out).toBe(1);
      expect(r.out, 'phải nêu đường dẫn + dòng + CẢ HAI số').toMatch(/README\.md:\d+ ghi \*\*\d+\*\* máy, `GATES\.md` \(máy sinh\) đếm \*\*9999\*\*/);
      expect(r.out, 'và chỉ ra cách sửa').toMatch(/npm run gates:index/);
    });
  });

  test('TÀI LIỆU LỊCH SỬ được bỏ qua — số máy trong CHANGELOG đúng ở THỜI ĐIỂM ghi', () => {
    /*
     * Bản đầu của phép kiểm ⑧ sai theo chiều PHÁ HOẠI: nó bắt 4 "chỗ lệch" ở `CHANGELOG.md` (132 · 80 ·
     * 16 máy) và `docs/v2.9.2/PLAN.md` (134 máy). Những con số ấy đúng ở thời điểm chúng được ghi; bắt
     * chúng khớp số hôm nay là đòi viết lại lịch sử, và làm theo thì mất khả năng tra ngược.
     */
    const cl = fs.readFileSync(CL, 'utf8');
    expect(cl, 'CHANGELOG phải CÓ số máy cũ, nếu không phép kiểm này rỗng').toMatch(/\d{2,4}\s*(?:máy|gate)/);
    const r = chay();
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'không được kêu CHANGELOG').not.toMatch(/CHANGELOG\.md:\d+ ghi/);
    expect(r.out, 'không được kêu tài liệu dưới docs/v…').not.toMatch(/docs\/v\d[^\s]*:\d+ ghi/);
  });

  test('"KHÔNG phán được" KHÔNG thành "đạt": CHANGELOG mất hết mục `## vX.Y.Z`', () => {
    voi(CL, (s) => s.replace(/^##\s+v\d+\.\d+\.\d+/gm, '## mục không có số'), (r) => {
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/không có mục nào dạng `## vX\.Y\.Z`/);
      expect(r.out, 'phải nói thẳng không phán được ≠ đạt').toMatch(/"không phán được" KHÔNG thành đạt/);
    });
  });

  test('`version:check` nằm trong bó `predeploy` — đo ở CÂY SẠCH tại HEAD', () => {
    /*
     * Chạy ở cây làm việc thì một `package.json` đã sửa mà chưa commit sẽ khớp, còn bản phát hành thì
     * lệch. Đó đúng là cách v2.9.0 ra mắt khi `gates:index:check` đang đỏ.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/predeploy_gate.js'), 'utf8');
    expect(src).toMatch(/ten: 'version:check'/);
    expect(src).toMatch(/scripts\/qa\/version_check\.js/);
  });

  test('`package.json` KHÔNG có khoá npm script nào bị khai hai lần', () => {
    /*
     * Lỗi thật của tôi trong chính lượt làm này: chèn `"version:check"` trong khi khoá ấy ĐÃ CÓ, nên
     * JSON có hai khoá trùng. `JSON.parse` lấy khoá CUỐI nên số script không đổi, mục mới bị che IM
     * LẶNG, và không cửa nào kêu. Đọc thô bằng regex mới thấy được.
     */
    const tho = fs.readFileSync(PKG, 'utf8');
    const i = tho.indexOf('"scripts"');
    const j = tho.indexOf('\n  }', i);
    const khoi = tho.slice(i, j);
    const ten = [...khoi.matchAll(/^\s*"([a-z0-9:_-]+)"\s*:/gim)].map((m) => m[1]);
    const trung = ten.filter((x, k) => ten.indexOf(x) !== k);
    expect([...new Set(trung)], 'khoá trùng thì JSON.parse lấy khoá cuối và mục kia bị che im lặng').toEqual([]);
    expect(ten.length, 'đọc thô phải thấy đủ script, nếu không phép kiểm này rỗng').toBeGreaterThan(100);
  });
});
