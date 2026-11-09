/*
 * Phần EXTENSION nhập từ bản "enhanced v10" — gác đúng những chỗ nó KHÔNG tự gác được.
 *
 * Bản nhập về là THUẦN CỘNG: 74 file mới, 0 file lõi bị sửa. Thiết kế đó tránh vỡ baseline, nhưng kit
 * này TỰ MÔ TẢ CHÍNH NÓ BẰNG SỐ — danh mục cửa, số máy, số spec — nên "chỉ cộng thêm" là đủ để làm
 * những con số ấy trôi. Đo 09/11/2026 trước khi nối: `scripts/qa/*.js` 131 → 136 trong khi `GATES.md`
 * vẫn khai 157 máy, và 5 script mới không npm script nào trỏ tới ⇒ rơi vào danh sách MỒ CÔI của
 * `gates:index`, mà nguồn kit ghi rõ: ở `scripts/qa`, *"không ai gọi nghĩa là gate chết"*.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

const chay = (file: string, argv: string[] = []) => {
  const r = spawnSync(process.execPath, [path.join(REPO, file), ...argv],
    { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

test.describe('@infra extension — 5 cửa mới phải có đường chạy', () => {
  const CUA = ['extension_integrity_check', 'extension_router', 'extension_benchmark',
    'v4_baseline_integrity', 'v4_verify'];

  test('mỗi script có MỘT npm script trỏ tới — nếu không nó là gate chết', () => {
    const lenh = Object.values(PKG.scripts as Record<string, string>).join('\n');
    const thieu = CUA.filter((c) => !lenh.includes(`scripts/qa/${c}.js`));
    expect(thieu, 'script trong `scripts/qa/` mà không npm script nào gọi ⇒ `gates:index` xếp MỒ CÔI')
      .toEqual([]);
  });

  test('bốn lệnh mà TÀI LIỆU bảo chạy đều tồn tại', () => {
    /*
     * `ENHANCED_V3_RELEASE_NOTES.md` và `KIT_A_INTEGRATION.md` bảo người đọc chạy bốn lệnh
     * `npm run extension:*`. Lúc nhập về, KHÔNG lệnh nào tồn tại — V4 cố ý gỡ chúng khỏi
     * `package.json` mà không sửa tài liệu, nên người làm theo nhận "Missing script".
     */
    const docs = ['ENHANCED_V3_RELEASE_NOTES.md', 'KIT_A_INTEGRATION.md']
      .map((f) => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');
    const nhac = [...docs.matchAll(/npm run (extension:[a-z]+)/g)].map((m) => m[1]);
    expect(nhac.length, 'không tài liệu nào nhắc lệnh extension ⇒ ca này RỖNG').toBeGreaterThan(0);
    const thieu = [...new Set(nhac)].filter((c) => !(c in PKG.scripts));
    expect(thieu, 'tài liệu dạy một lệnh không tồn tại').toEqual([]);
  });
});

test.describe('@infra extension — `tests/unit` chạy bằng node --test, KHÔNG bằng Playwright', () => {
  /*
   * ĐO 09/11/2026: `tests/unit/*.test.js` dùng `node:test`, nhưng chúng khớp `testMatch` MẶC ĐỊNH của
   * Playwright (`*.test.js`) và nằm dưới `testDir: './tests'`. Playwright NẠP file, `node:test` thực
   * thi ngay trong worker và in 18 dòng ✔ vào báo cáo Playwright, trong khi Playwright thu được **0 ca**
   * của riêng nó. Tức bộ unit test chạy LẠI ở mọi lượt Playwright, lẫn vào kết quả.
   *
   * Cùng họ với lỗi file ĐỀ BÀI bị thu thành 4 test thật (v2.10.1) — một thư mục không phải spec mà
   * nằm trong tầm thu của bộ chạy.
   */
  test('`unit/` nằm trong danh sách loại của Playwright', () => {
    const cfg = fs.readFileSync(path.join(REPO, 'playwright.config.js'), 'utf8');
    expect(cfg, 'thiếu dòng này thì Playwright nạp lại bộ unit test ở mọi lượt')
      .toMatch(/desktopIgnore\s*=\s*\[[^\]]*'\*\*\/unit\/\*\*'/);
  });

  test('ĐỐI CHỨNG: file unit CÓ THẬT và CÓ khớp testMatch mặc định', () => {
    /* Không có hai điều này thì phép kiểm trên gác hư không. */
    const d = path.join(REPO, 'tests', 'unit');
    expect(fs.existsSync(d), 'không có tests/unit ⇒ ca trên RỖNG').toBe(true);
    const ds = fs.readdirSync(d).filter((f) => /\.test\.(js|ts|mjs)$/.test(f));
    expect(ds.length, 'không file nào khớp `*.test.*` ⇒ ca trên RỖNG').toBeGreaterThan(0);
    expect(/\.(test)\.(js)$/.test(ds[0]), 'phải khớp testMatch mặc định của Playwright').toBe(true);
  });

  /*
   * ĐO 09/11/2026 trên CI (lượt 42579298605, Node 22): `node --test tests/unit/` ĐỎ với
   * `Cannot find module '.../tests/unit'`. Node 22 coi positional là FILE; Node 26 trên máy tôi coi
   * là THƯ MỤC nên xanh. `.nvmrc` ghim **22** và `engines` khai **">=22"**, nên lệnh ấy vi phạm
   * chính hợp đồng repo tự khai. Tài liệu gốc bản V10 (`V4_AUDIT_AND_COMPARISON.md`) vốn LIỆT KÊ
   * TỪNG FILE — chính tôi đổi thành thư mục lúc nối npm script.
   *
   * Và máy gác cũ ở đây chép lại ĐÚNG giả định đó: nó tự viết `['--test', 'tests/unit/']` rồi chạy
   * bằng `process.execPath` — tức bằng Node của máy đang chạy. Nó không thể đỏ ở nơi nó cần đỏ.
   */
  test('lệnh LIỆT KÊ từng file, không truyền THƯ MỤC — và liệt kê ĐỦ', () => {
    /* Ca này cố ý KHÔNG chạy lệnh: chạy thì vẫn bằng Node của máy đang chạy, nên không phân biệt
     * được gì. Nó đọc HÌNH DẠNG lệnh — thứ duy nhất ở đây độc lập với bản Node. */
    const lenh = String(PKG.scripts['extension:test'] || '');
    const files = fs.readdirSync(path.join(REPO, 'tests', 'unit'))
      .filter((f) => /\.test\.(js|ts|mjs)$/.test(f));
    expect(files.length, 'không file unit nào ⇒ ca này RỖNG').toBeGreaterThan(0);

    const thieu = files.filter((f) => !lenh.includes(`tests/unit/${f}`));
    expect(thieu, 'file unit không được liệt kê ⇒ nó IM LẶNG không chạy ở CI').toEqual([]);

    expect(lenh, 'truyền THƯ MỤC cho `node --test` chỉ chạy được từ Node ~24; .nvmrc ghim 22')
      .not.toMatch(/--test\s+\S*tests\/unit\/?(\s|$)/);
  });

  test('và ĐÚNG lệnh npm ấy chạy xanh — không phải một bản chép tay', () => {
    /* Trước đây ca này tự viết lại lệnh, nên spec và npm script trôi khỏi nhau mà không ai thấy.
     * Nay nó lấy argv TỪ package.json: hai bên không còn cách nào lệch. */
    const argv = String(PKG.scripts['extension:test'] || '').split(/\s+/).filter(Boolean);
    expect(argv[0], 'ca này chỉ đọc được lệnh bắt đầu bằng `node`').toBe('node');
    const r = spawnSync(process.execPath, argv.slice(1),
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(`${r.stdout}`, 'phải in số ca đã chạy').toMatch(/# pass \d+|pass \d+/);
  });
});

test.describe('@infra extension — baseline lõi', () => {
  test('cửa NÓI ra tỉ lệ, và LIỆT KÊ file đã trôi — không chỉ phán một chữ', () => {
    /*
     * KHÔNG đòi 931/931 ở đây, và đó là quyết định có lý do: mốc phủ CẢ 931 file kể cả tài liệu, nên
     * mỗi lượt sinh lại GATES.md / README / thư viện đều làm nó đỏ. Một cửa đỏ ở mọi lượt phát triển
     * là tiếng ồn, và tiếng ồn thì bị tắt. Vai trò tripwire hẹp-và-đúng đã có `version:check`.
     *
     * Cái phải gác ở đây là CỬA CÓ HOẠT ĐỘNG KHÔNG: in tỉ lệ, gọi tên file trôi, và nói rõ trôi
     * KHÔNG đồng nghĩa với sai. Mốc được chốt lại bằng `--chot` lúc nhập extension và lúc cắt bản
     * phát hành — một việc THẤY ĐƯỢC TRONG DIFF.
     */
    const r = chay('scripts/qa/v4_baseline_integrity.js');
    expect(r.out, 'phải in tỉ lệ, nếu không người đọc không kiểm lại được').toMatch(/\d+\/\d+ file lõi/);
    if (r.code !== 0) {
      expect(r.out, 'trôi thì phải GỌI TÊN file, không chỉ nói có trôi').toMatch(/ĐỔI NỘI DUNG|BIẾN MẤT/);
      expect(r.out, 'và phải nói rõ trôi không đồng nghĩa với sai').toMatch(/có thể hoàn toàn chính đáng/);
    }
  });

  test('CHUẨN HOÁ XUỐNG DÒNG — nếu không, cửa này đỏ GIẢ trên mọi checkout Windows', () => {
    /*
     * Bản nhập về băm nguyên byte, nên trên cây CRLF nó báo **264/931** và exit 1 trong khi nội dung
     * thật là 931/931: đo lại cả 667 file "khác" thì 667/667 khớp ngay khi chuẩn hoá về LF, 0 khác
     * thật. Cái cửa sinh ra ĐỂ CHỨNG MINH "lõi không đổi" lại báo 72% lõi đã đổi.
     *
     * Và mốc TỰ NÓ trộn hai quy ước: 3 file được băm ở dạng CRLF, 928 file ở dạng LF — nên cửa phải
     * chấp nhận khớp ở MỘT TRONG HAI dạng. Đổi nội dung thật thì không dạng nào khớp.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/v4_baseline_integrity.js'), 'utf8');
    expect(src, 'phải chuẩn hoá cả CR lẻ, không chỉ CRLF').toMatch(/replace\(\/\\r\\n\?\/g/);
    expect(src, 'nhị phân KHÔNG được chuẩn hoá — utf8 phá nát byte').toMatch(/NHI_PHAN/);
    expect(src, 'phải chấp nhận khớp ở một trong hai dạng').toMatch(/fs\.readFileSync\(full\)\) !== h/);
  });
});
