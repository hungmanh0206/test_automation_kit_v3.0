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
import os from 'os';
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

/*
 * Phép kiểm ⑦ phải chạy được KHI KHÔNG CÓ `.git` — tức trong GÓI PHÁT HÀNH.
 *
 * LỖ ĐÃ ĐO RA: bản trước chỉ hỏi `git ls-files`, nên trong gói nó quét 0 file rồi bỏ qua ⑦. Mà ⑦ ở đó
 * vẫn có nghĩa: gói mang cả `README.md` lẫn `GATES.md`, hai con số phải khớp ở tay người nhận y như ở
 * repo. `release:verify` đỏ đúng 2 ca cuối vì chuyện này — và cả hai là ca của chính spec này, vì chúng
 * khẳng định hành vi khi CÓ git mà không khai điều kiện ấy.
 *
 * `gate_index.js` đã có nhánh đọc đĩa từ trước. Đây là cùng một bài học, lặp lại ở một cửa khác.
 */
test.describe('@infra version:check ⑦ — chạy được trong gói (không `.git`)', () => {
  /** Dựng cây tối thiểu, KHÔNG có `.git`, đủ để cửa chạy thật. */
  function cayKhongGit(soMayTrongReadme: number, soMayTrongGates = 151) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nogit-'));
    fs.mkdirSync(path.join(d, 'scripts/qa'), { recursive: true });
    fs.mkdirSync(path.join(d, '.agent/config'), { recursive: true });
    fs.copyFileSync(GATE, path.join(d, 'scripts/qa/version_check.js'));
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: 'x', version: '2.9.6' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(d, 'CHANGELOG.md'),
      '# Changelog\n\n> Mỗi mục là một đợt phát hành.\n\n## v2.9.6 — 2026-10-30 — x\n\n- x\n', 'utf8');
    fs.writeFileSync(path.join(d, '.agent/config/GATES.md'),
      `# Gates\n\nTổng **${soMayTrongGates}** máy — 1 CHẶN.\n`, 'utf8');
    fs.writeFileSync(path.join(d, 'README.md'),
      `# Kit\n\nXem .agent/config/GATES.md (danh mục ${soMayTrongReadme} máy gác, tự sinh).\n`, 'utf8');
    return d;
  }
  const chayTrong = (d: string) => {
    const r = spawnSync(process.execPath, [path.join(d, 'scripts/qa/version_check.js')],
      { cwd: d, encoding: 'utf8', env: gateEnv() });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };

  test('ĐỐI CHỨNG ÂM: không `.git`, số khớp ⇒ ĐẠT và ⑦ VẪN ĐẾM ĐƯỢC', () => {
    const d = cayKhongGit(151, 151);
    expect(fs.existsSync(path.join(d, '.git')), 'cây này phải KHÔNG có .git, nếu không phép kiểm rỗng').toBe(false);
    const r = chayTrong(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải ĐẾM được bản sao viết tay, không được bỏ qua ⑦')
      .toMatch(/⑦ 1 bản sao viết tay của số máy, nguồn `GATES\.md` = 151/);
    expect(r.out, 'và KHÔNG được khai "chưa gác gì"').not.toMatch(/CHƯA GÁC GÌ/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: không `.git`, số LỆCH ⇒ vẫn CHẶN', () => {
    /* Vế quyết định: nhánh đọc đĩa phải GÁC ĐƯỢC, không chỉ đếm cho có. */
    const d = cayKhongGit(150, 151);
    const r = chayTrong(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/README\.md:\d+ ghi \*\*150\*\* máy, `GATES\.md` \(máy sinh\) đếm \*\*151\*\*/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

/*
 * ⑨ BẢN SAO VIẾT TAY CỦA SỐ PHIÊN BẢN (v2.9.7).
 *
 * ⑦ gác số MÁY viết tay. Nhưng số PHIÊN BẢN cũng có bản sao viết tay, và nó vừa trôi thật: thư viện
 * thuật ngữ ghi `Phiên bản kit: 2.9.6` trong khi `package.json` đã là 2.9.7. `library:drift` không bắt
 * được vì nó so `index.html` với `src/` — tức so hai bản sao VỚI NHAU, cả hai cùng sai thì vẫn xanh.
 *
 * Và phép kiểm này đỏ ngay lượt đầu vì CHÍNH CÂU CHÚ THÍCH của nó: chú thích dẫn `Phiên bản kit: 2.9.6`
 * làm ví dụ, cửa đọc ví dụ thành một bản sao thật. Cùng bài học với `gate:policy` ở v2.9.6 — nên ⑨ bỏ
 * chú thích trước khi tìm, bằng `boChuThich` đã có, và dưới đây có một phép kiểm riêng cho chuyện đó.
 */
test.describe('@infra version:check ⑨ — số phiên bản viết tay phải khớp `package.json`', () => {
  test('ĐỐI CHỨNG DƯƠNG: bề mặt khai phiên bản CŨ ⇒ CHẶN, nêu đích danh file', () => {
    const f = path.join(REPO, 'docs/library/src/shell.html');
    voi(f, (s) => s.replace(/Phiên bản kit: <b>[\d.]+<\/b>/, 'Phiên bản kit: <b>1.0.0</b>'), (r) => {
      expect(r.code, 'lệch phiên bản phải chặn').toBe(1);
      expect(r.out).toContain('docs/library/src/shell.html');
      expect(r.out).toContain('1.0.0');
    });
  });

  test('ĐỐI CHỨNG ÂM: khớp `package.json` ⇒ ĐẠT, và nói ra đếm được mấy bản sao', () => {
    const r = chay();
    expect(r.code, 'repo đang khớp').toBe(0);
    expect(r.out).toMatch(/⑨ \d+ bản sao viết tay của số phiên bản/);
    expect(r.out, 'phải nói nguồn là package.json').toContain('nguồn `package.json`');
  });

  test('CHÚ THÍCH trong mã KHÔNG được tính thành một bản sao', () => {
    /*
     * Lượt đầu của ⑨ đỏ vì chú thích của chính nó. Nếu phép kiểm này mất, câu chú thích sau sẽ lại tắt
     * cửa — hoặc tệ hơn, ai đó sẽ nới `vi_sao` để cho qua.
     */
    const f = path.join(REPO, 'scripts/qa/case_paths.js');
    voi(f, (s) => `/* ví dụ trong chú thích: Phiên bản kit: 0.0.1 — KHÔNG phải một bản khai thật */\n${s}`, (r) => {
      expect(r.code, 'chú thích chỉ là ví dụ, không phải lời khai').toBe(0);
      expect(r.out).not.toContain('0.0.1');
    });
  });

  test('ĐỐI CHỨNG: cùng chuỗi đó nằm trong MÃ THẬT thì VẪN bị bắt', () => {
    /*
     * Cặp với phép trên. Bỏ chú thích mà bỏ luôn cả mã thật thì ⑨ thành đồ trang trí, và hai phép kiểm
     * này là cách duy nhất phân biệt "bỏ đúng chú thích" với "bỏ hết".
     */
    const f = path.join(REPO, 'scripts/qa/case_paths.js');
    voi(f, (s) => `const _khai = 'Phiên bản kit: 0.0.1';\n${s}`, (r) => {
      expect(r.code, 'chuỗi trong mã thật là một lời khai').toBe(1);
      expect(r.out).toContain('0.0.1');
    });
  });

  test('tài liệu LỊCH SỬ được bỏ qua — số trong đó đúng ở thời điểm ghi', () => {
    expect(fs.existsSync(path.join(REPO, 'CHANGELOG.md'))).toBe(true);
    voi(CL, (s) => `Phiên bản kit: **0.0.1**\n${s}`, (r) => {
      expect(r.code, 'CHANGELOG là sổ lịch sử, không phải bề mặt trạng-thái-hiện-tại').toBe(0);
    });
  });
});
