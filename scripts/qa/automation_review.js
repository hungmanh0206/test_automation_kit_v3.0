#!/usr/bin/env node
'use strict';

/*
 * automation_review.js — GATE chất lượng code automation, phần `lint:locator` KHÔNG gác.
 *
 * VÌ SAO CÓ (v2.5.0 G1.4): kit đã có `lint:locator` gác chuyện bắt sai element, nhưng không gì chấm 6
 * nhóm còn lại mà A (`qig-qa-automation`) chặn trước khi bàn giao. Đo lại trước khi viết — và phép đo
 * ĐÃ THU HẸP hạng mục này đáng kể:
 *
 *   | Nhóm A đòi          | Kit đã có chưa                                             |
 *   |---------------------|------------------------------------------------------------|
 *   | XPath theo vị trí   | CÓ — `locator_lint` rule `xpath-locator` (P1)              |
 *   | assertion yếu       | MỘT PHẦN — `weak-assert` bắt `toBeTruthy`/`not.toBeNull`   |
 *   | hard sleep          | MỘT PHẦN — `blind-wait` chỉ bắt `waitForTimeout(>=5000)`   |
 *   | test không assertion| KHÔNG CÓ                                                   |
 *   | `console.log` sót   | KHÔNG CÓ                                                   |
 *   | credential trong code| KHÔNG CÓ cho file này (xem ghi chú `cred-literal`)        |
 *   | data task-specific  | KHÔNG CÓ (non-negotiable §6 chỉ nói bằng chữ)              |
 *
 * BẢNG TRÊN LÀ PHÉP ĐO LÚC LẬP KẾ HOẠCH (v2.5.0 G1.4), KHÔNG phải trạng thái hiện tại — giữ nguyên để
 * còn đọc được lý do từng hạng mục được chọn. Trạng thái hiện tại nằm ở `RULES` bên dưới, và nó đã
 * VƯỢT bảng ở hai dòng: `test không assertion` nay là rule `no-assert` (P0, CHẶN), và `console.log sót`
 * nay là rule `console-log`.
 *
 * Phải ghi chú thêm dòng này vì bảng cũ đã làm tôi kết luận sai ngày 11/10/2026: khi xếp tầng gate cho
 * v2.7.0 tôi đọc bảng rồi kết luận "§6 không có máy nào thi hành", trong khi `no-assert` chính là ruột
 * của §6 — một test không có khẳng định nào thì luôn xanh kể cả khi sản phẩm sai. Một bảng đo cũ không
 * ghi rõ là bản cũ sẽ bị đọc như trạng thái hiện tại.
 *
 * PHẦN CỦA §6 CHỈ CÓ MÁY MỘT NỬA, nói thẳng để không ai tưởng §6 đã kín:
 *   · "đổi expected để pass" — CÓ máy từ 12/10/2026: `expected:check` (`scripts/qa/expected_ledger.js`).
 *     Nó so với SNAPSHOT của chính nó, KHÔNG so với git, và một gate dựa trên git diff thì KHÔNG DỰNG
 *     ĐƯỢC: 0 file testcase được git track vì `outputs/*` gitignore. Phần người làm là chụp mốc ĐÚNG LÚC
 *     (lúc bộ case được chốt); đo 30/10/2026 thì 1/5 task có mốc, nên 4 task còn lại cửa đang ở trạng
 *     thái CHƯA ĐƯỢC GÁC (exit 2) — không phải "đạt".
 *   · "hardcode data task-specific vào template chung" — `package:kit` có cảnh báo khi gói mang tên
 *     bảng hoặc host của dự án, nhưng đó là cửa phát hành, không phải lúc đang sửa template.
 *
 * NÊN FILE NÀY KHÔNG CHÉP LUẬT LOCATOR. Chiều locator được GỌI (`--with-locator` spawn
 * `locator_lint.js`), không viết lại: hai bản cùng một luật là nguồn trôi, và kit đã trả giá đúng chuyện
 * đó ở hai bản lint SQL (`guard.ts` thiếu `EXEC` trong khi `uatDbClient.ts` có — vá 10/10/2026).
 *
 * HAI TẦNG, giống `locator_lint`: mặc định quét `tests/**` (suite dùng chung, `--enforce` CHẶN);
 * `--include-tasks` quét thêm `outputs/<proj>/tasks/<task>/automation/` nhưng chỉ BÁO CÁO — nợ cũ của
 * 170+ spec theo task không được phép làm gate thành đồ trang trí ngay ngày đầu.
 *
 * Bỏ qua có kiểm soát: `// auto-review-disable-next-line <lý do>` ngay TRÊN dòng. Không lý do thì vẫn tính.
 *
 * Dùng:
 *   npm run auto:review                      # báo cáo gọn
 *   npm run auto:review:enforce              # P0 ở suite dùng chung → exit 1
 *   npm run auto:review -- --include-tasks   # thêm nợ cũ theo task (chỉ báo cáo)
 *   npm run auto:review -- --with-locator    # gọi luôn lint:locator cho đủ 7 nhóm
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = flag('enforce');
const INCLUDE_TASKS = flag('include-tasks');
const WITH_LOCATOR = flag('with-locator');
const TOP = parseInt(arg('top', '8'), 10) || 8;
/*
 * `--repo <dir>` để test chạy gate trên một cây DỰNG RIÊNG. Không có nó thì không kiểm được âm bản:
 * `rc.REPO_ROOT` suy từ vị trí của chính file này, nên đổi `cwd` KHÔNG đổi cây được quét — bản đầu của
 * spec đã sai đúng chỗ đó, 11 test đỏ vì chúng tưởng đang quét cây tạm mà thực ra quét repo thật.
 * Cùng idiom với `deps_check.js --repo`.
 */
const REPO = path.resolve(arg('repo', rc.REPO_ROOT));

/*
 * LUẬT THEO DÒNG. `sev: 'P0'` = gần như chắc chắn tạo PASS giả hoặc rò bí mật; đó là tập `--enforce` chặn.
 *
 * Mỗi luật phải trả lời được "vì sao đây là lỗi, không phải khó chịu" — luật không trả lời được câu đó
 * thì người ta tắt gate chứ không sửa theo nó.
 */
const RULES = [
  {
    id: 'hard-sleep',
    sev: 'P0',
    re: /waitForTimeout\s*\(\s*(\d+)\s*\)/,
    /*
     * CỐ Ý chỉ bắt 1000–4999ms: từ 5000 trở lên đã là `blind-wait` (P1) của `locator_lint`. Chia ranh giới
     * để một dòng không bị hai máy báo hai lần — người đọc sẽ tưởng có hai lỗi.
     *
     * Vì sao NGƯỠNG 1000 chứ không phải mọi `waitForTimeout`: dưới 1 giây thường là nhường một tick cho
     * animation, không phải chờ điều kiện. Ngưỡng này là chỗ ĐO ĐƯỢC chứ không phải cảm tính — xem số đo
     * trong `tests/fe/infra/automation-review.spec.ts`.
     */
    ok: (m) => { const ms = Number(m[1]); return !(ms >= 1000 && ms < 5000); },
    why: 'Ngủ cứng 1–5s: chờ theo ĐỒNG HỒ chứ không theo điều kiện. Máy nhanh thì dư, máy chậm thì thiếu — và khi thiếu, assertion đọc màn CHƯA xong rồi kết luận "bug".',
    fix: 'Chờ điều kiện cụ thể: `expect(locator).toBeVisible()`, `waitForResponse`, `waitForLoadState`. Buộc phải ngủ thì ghi lý do bằng `// auto-review-disable-next-line <lý do>`.',
  },
  {
    id: 'vacuous-url',
    sev: 'P0',
    re: /toHaveURL\s*\(\s*\/\.(?:\*|\+)?\/[gimsuy]*\s*\)/,
    why: '`toHaveURL(/./)` khớp MỌI url khác rỗng — kể cả trang lỗi, kể cả vẫn đứng ở màn login. Nó trông như một assertion điều hướng nhưng không chứng minh gì.',
    fix: 'So với đường dẫn cụ thể theo spec: `toHaveURL(/\\/hoc-sinh\\/danh-sach/)`.',
  },
  {
    id: 'vacuous-count',
    sev: 'P1',
    re: /(?:\.length|\.count\s*\(\s*\))\s*\)?\s*\.\s*toBeGreaterThan\s*\(\s*0\s*\)/,
    why: '"có ít nhất 1 dòng" pass với bất kỳ lưới không rỗng, kể cả lưới đang hiện dữ liệu của đơn vị KHÁC. Đếm > 0 không phải oracle.',
    fix: 'Khẳng định SỐ cụ thể (`toBe(n)`) hoặc nội dung dòng cụ thể theo spec.',
  },
  {
    id: 'console-log',
    sev: 'P1',
    re: /\bconsole\s*\.\s*log\s*\(/,
    why: '`console.log` sót lại làm log lượt chạy ngập, và che mất dòng báo lỗi thật của Playwright.',
    fix: 'Bỏ, hoặc chuyển sang `testInfo.attach`/`test.step` để nó vào report thay vì vào stdout.',
  },
  {
    id: 'cred-literal',
    sev: 'P0',
    /*
     * Ruột chuỗi ĐÃ bị làm trắng trước khi quét, nên mẫu phải khớp "CÓ một chuỗi dài ≥4" chứ không khớp
     * NỘI DUNG chuỗi: `[^'"`]{4,}` thay cho `[^'"`\s]{4,}`. Giữ mẫu cũ thì luật này không bao giờ nổ.
     */
    re: /\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|token|bearer)\b\s*[:=]\s*['"`][^'"`]{4,}['"`]/i,
    not: /process\.env|\.example|placeholder|\bxxx+\b|\bfake\b|\bdummy\b|<[^>]*>|\$\{/i,
    /*
     * VÌ SAO CẦN, dù đã có `secret:scan`: `secret_scan.js` chỉ quét file ĐƯỢC TRACK. Automation theo task
     * sống ở `outputs/**`, mà `outputs/` thì gitignore — nên một mật khẩu viết thẳng trong spec của task
     * KHÔNG có máy nào nhìn thấy. Đây là lỗ thật, không phải trùng lặp.
     */
    why: 'Credential viết thẳng trong code. `secret:scan` chỉ quét file ĐƯỢC TRACK, nên spec theo task (ở `outputs/**`, vốn gitignore) hoàn toàn ngoài tầm nó.',
    fix: 'Đưa về `profiles/<TASK>/task.env` rồi đọc bằng `process.env.X`. Non-negotiable §1 và §5.',
  },
  {
    id: 'spec-page-locator',
    sev: 'P1',
    re: /\bpage\s*\.\s*locator\s*\(/,
    taskOnly: true,
    specOnly: true,
    /*
     * ĐO MỨC ÁP DỤNG PAGE OBJECT, KHÔNG PHÁN TỪNG DÒNG — và con số mới là điểm của luật này.
     *
     * Đo 10/10/2026: `page.locator(` xuất hiện **1381 lượt trong 254/354 spec theo task**, còn ở suite
     * dùng chung chỉ ~6 lượt — và cả 6 nằm trong spec có việc kiểm CHÍNH bộ locator
     *
     * (Grep thô đếm 1401. Lệch 20 vì gate chỉ phán trên phần LÀ CODE: 20 lượt kia nằm trong chuỗi hoặc
     * chú thích. Số của gate là số đúng, và chênh lệch này chính là bằng chứng phép làm-trắng-chuỗi đang
     * làm việc.)
     * (`safe-target`, `screen-snapshot`, `geometry`). Nên:
     *  · `taskOnly`: ở tầng shared, gắn cờ chúng là sai — spec kiểm bộ locator thì phải gọi locator.
     *  · `P1`, không phải P0: 1401 dòng không phải 1401 lỗi. Quy ước POM bị bỏ qua ở quy mô đó là một
     *    SỰ THẬT CẦN BIẾT trước khi làm v2.8.0 (thư viện bước dùng lại), chứ không phải việc phải sửa
     *    hết hôm nay.
     * Chỉ thấy khi chạy `--include-tasks`, và đó là đúng chỗ của nó.
     */
    why: 'Spec gọi `page.locator` trực tiếp thay vì đi qua Page Object hoặc `safe_target`. Đo được 1522 lượt ở tổng 402 spec theo task (15/10/2026). Grep thô đếm 1562 lượt trong 290 spec; chênh 40 vì gate chỉ phán trên phần LÀ CODE, chuỗi và chú thích đã làm trắng. Con số này đi theo `outputs/**` nên nó trôi khi task chạy — locator nằm rải trong spec thì UI đổi một nhãn là phải sửa hàng trăm chỗ.',
    fix: 'Đưa locator về Page Object (`tests/fe/pages/`) hoặc `safe_target.one()/section()`. Đây là nền của thư viện bước dùng lại (v2.8.0), nên con số này là mốc để đo tiến độ.',
  },
  {
    /*
     * `khoi: true` — luật ở cấp KHỐI, không quét theo dòng (thân một `test(...)` có khẳng định nào không).
     *
     * Vì sao nó phải nằm TRONG `RULES` chứ không dựng inline như bản đầu: không có nó ở đây thì bộ luật
     * KHÔNG liệt kê được, và mọi phép kiểm "tài liệu nhắc rule nào thì rule đó phải có thật" sẽ báo oan.
     * Chính `playwright-conventions.spec.ts` bắt được chỗ này.
     */
    id: 'no-assert',
    sev: 'P0',
    khoi: true,
    why: 'Test KHÔNG có khẳng định nào: nó chỉ thao tác rồi kết thúc, nên luôn XANH — kể cả khi sản phẩm sai. Đây là false-green nặng nhất ở tầng spec.',
    fix: 'Thêm oracle theo cột `Kết quả mong đợi` của case. Chưa phán được thì `test.skip(true, "<lý do>")`, KHÔNG để test rỗng xanh.',
  },
  {
    /*
     * v2.9.5 §5. `no-assert` bắt test KHÔNG có oracle nào; luật này bắt test CÓ oracle nhưng oracle
     * nằm SAI CHỖ — mọi khẳng định đứng trước, hành động cuối không ai kiểm.
     *
     * P1 CHỨ KHÔNG P0, và con số quyết chuyện đó: soi tay 4 ca thì 1 là dương tính giả (25% > ngưỡng
     * 20% đã đặt trước). Ca đó là `doc-luoi-thpt.spec.ts:112` — hành động cuối là `uncheck` DỌN trạng
     * thái sau khi đã kiểm xong, không phải một tác động chưa kiểm. Mọi mẹo loại "dọn dẹp" đều thêm
     * rủi ro mới, nên để nguyên mức cảnh báo và nói rõ tỉ lệ.
     */
    id: 'no-assert-after-act',
    sev: 'P1',
    khoi: true,
    why: 'Mọi khẳng định đứng TRƯỚC hành động cuối: tác động cuối không ai kiểm, nên test xanh mà không chứng minh gì về nó. Đo 29/10/2026: 34 lượt trên 2.873 test (1 ở tầng shared), dương tính giả soi tay 2/5 = 40% — nên đây là CẢNH BÁO, không chặn. Hai dạng giả: hành động cuối là DỌN trạng thái, và hành động cuối là đọc-lại-để-ghi-log sau khi case đã kiểm xong.',
    fix: 'Thêm oracle SAU hành động cuối. Nếu hành động cuối chỉ để dọn trạng thái hoặc đọc lại cho log thì ghi `// auto-review-disable-next-line dọn trạng thái, đã kiểm ở bước trên`.',
  },
  {
    /*
     * ĐO 0 LƯỢT TRÊN TOÀN CORPUS (2.873 test, 29/10/2026) — và đo hai lần để biết 0 đó nghĩa gì:
     * kể cả khi CHỈ xét `expect(` và bỏ `assert:`/`status:` ra ngoài, vẫn 0. Tức corpus thật sự không
     * có test nào chỉ-kiểm-có-mặt, chứ không phải luật bị dạng oracle khác che.
     *
     * Vẫn ship, vì 0 vi phạm HÔM NAY là trạng thái tốt của một cửa, không phải lý do bỏ cửa. Điều kiện
     * là phải CHỨNG MINH nó nổ được — `automation-review.spec.ts` có đối chứng dương cho đúng chuyện đó.
     * Cửa không bao giờ nổ được mới là cửa trang trí.
     *
     * CỐ Ý KHÔNG gom `toBeTruthy/toBeFalsy/not.toBeNull`: trên một biến boolean TÍNH ĐƯỢC chúng là
     * oracle thật (`ensure-expanded.spec.ts:41`), còn trên locator thì `locator_lint` rule `weak-assert`
     * đã gác. Chép lại ở đây là dựng nguồn trôi thứ hai — đúng lỗi hai bản lint SQL đã trả giá.
     */
    id: 'presence-only',
    sev: 'P1',
    khoi: true,
    why: 'Test có hành động, nhưng MỌI khẳng định chỉ chứng minh element CÓ MẶT (`toBeVisible`/`toBeEnabled`…), không chứng minh GIÁ TRỊ. "Màn vẽ ra" không phải "màn vẽ ĐÚNG". Đo 29/10/2026: 0 lượt trên 2.873 test — đo 2 lần để chắc 0 đó là "không có ca nào" chứ không phải bị dạng oracle khác che. Giữ luật vì 0 vi phạm hôm nay là trạng thái TỐT của một cửa; spec có đối chứng dương chứng minh nó nổ được.',
    fix: 'Khẳng định nội dung cụ thể theo cột `Kết quả mong đợi`: `toHaveText`, `toHaveValue`, `toBe(n)`. Case chỉ kiểm hiển thị thì neo `ui_catalog` và ghi rõ đó là chiều §12.',
  },
];

/** Tra một luật theo id — dùng cho luật cấp khối, để thông điệp chỉ có MỘT nguồn. */
const luat = (id) => RULES.find((r) => r.id === id);

/*
 * LUẬT ĐÃ VIẾT RỒI BỎ: `task-key-in-shared` — bắt `\b[A-Z]{2,}-\d{3,}\b` trong suite dùng chung, để gác
 * non-negotiable §6 ("không hardcode data task-specific vào template chung").
 *
 * BỎ vì ĐO ĐƯỢC nó báo oan: 360 finding, và mẫu đó khớp cả `ISO-8601` lẫn `RFC-2119` — hai thứ không
 * liên quan gì tới mã task. Phần còn lại phần lớn là mã task nằm trong CHÚ THÍCH ghi xuất xứ một phép đo,
 * tức đúng loại ③ mà G4.2 vừa kết luận là KHÔNG phải lỗi.
 *
 * Phân biệt "dữ liệu task nằm trong code" với "mã task nằm trong chú thích" cần đọc được ngữ cảnh, và
 * máy ở đây không làm được. Nên nó chuyển xuống `CAN_NGUOI_XEM`. Một gate báo oan 360 lần thì người ta
 * tắt nó, chứ không sửa theo nó — bài học đã trả giá ở `rule_parity` (4 vòng) và `column-count` (4 ca).
 */

/** Chiều máy KHÔNG phán được — in thành danh sách để người/AI xem, không gắn verdict. */
const CAN_NGUOI_XEM = [
  'Test có ĐỘC LẬP không: chạy một mình và chạy cả bộ phải ra cùng kết quả (máy không biết test này dựa vào state test khác để lại).',
  'Cleanup có thật sự dọn không: máy thấy có lệnh dọn, không biết nó dọn ĐÚNG thứ đã tạo.',
  'Oracle có độc lập theo spec không, hay đang so app với chính app (máy không đọc được spec).',
  'Dữ liệu test có unique giữa hai lượt chạy không (`RUN_ID` có được dùng ở MỌI chỗ sinh dữ liệu).',
  'Có dữ liệu TASK-SPECIFIC nào nằm trong suite dùng chung không (non-negotiable §6). Máy KHÔNG gác được: luật quét mã task đã viết rồi bỏ vì nó khớp cả `ISO-8601`/`RFC-2119`, và phần lớn mã task còn lại nằm trong chú thích ghi xuất xứ — thứ G4.2 kết luận là KHÔNG phải lỗi.',
];

function listFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|test-results|playwright-report/.test(e.name)) listFiles(p, out); }
    else if (/\.(js|ts|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Tập file ĐƯỢC GIT TRACK. Đây là ranh giới của tầng CHẶN, và lý do là một phép đo:
 * 169 file dưới `tests/**` có `console.log` là file CHƯA TRACK (probe/chẩn đoán trên máy người đang làm
 * task), chỉ 9 file track có. Nếu `--enforce` chặn theo cả cây thì gate thành con tin của WIP người khác —
 * đúng kiểu gate bị tắt sau một tuần.
 */
function tapTrack() {
  const r = spawnSync('git', ['ls-files', 'tests'], { cwd: REPO, encoding: 'utf8' });
  if (r.status !== 0) return null;   // không phải repo git ⇒ không phán được, xem `laTrack`
  return new Set(String(r.stdout).split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
}

function targets() {
  const files = listFiles(path.join(REPO, 'tests')).map((f) => ({ f, scope: 'shared' }));
  if (INCLUDE_TASKS) {
    const outputs = path.join(REPO, 'outputs');
    if (fs.existsSync(outputs)) {
      for (const proj of fs.readdirSync(outputs)) {
        const tasksDir = path.join(outputs, proj, 'tasks');
        if (!fs.existsSync(tasksDir)) continue;
        for (const t of fs.readdirSync(tasksDir)) {
          listFiles(path.join(tasksDir, t, 'automation')).forEach((f) => files.push({ f, scope: 'task' }));
        }
      }
    }
  }
  return files;
}

/** Chỉ spec mới có khái niệm "test không có assertion" — helper và fixture thì không. */
const laSpec = (rel) => /\.spec\.(ts|js|mjs)$/.test(rel);

/**
 * Làm trắng RUỘT của chuỗi, template literal và comment — giữ nguyên ĐỘ DÀI và số dòng, nên mọi chỉ số
 * vẫn trỏ đúng chỗ trong bản gốc.
 *
 * VÌ SAO BẮT BUỘC, và đây là dương tính giả thứ hai của chính gate này: `ci-scope.spec.ts:231` có
 * `expect(run(root).code).toBe(1)` hẳn hoi, nhưng thân test của nó chứa một FIXTURE là chuỗi
 * `"...test('x', () => {})..."`. Phép cắt thân theo `test(` kế tiếp dừng lại ở cái `test(` TRONG CHUỖI đó,
 * trước khi tới `expect` — và gate báo "test không có assertion" cho một test có assertion.
 *
 * PHẢI XỬ LÝ CẢ REGEX LITERAL, và đây là dương tính giả thứ ba của gate này — nghiêm trọng hơn hai cái
 * trước. Bản đầu bỏ qua regex và chỉ ghi chú "chấp nhận, vì sai theo chiều này chỉ gây BỎ SÓT". Câu đó
 * SAI: `ci-config-valid.spec.ts:122` có `/^['"|>&*]/`, bộ quét thấy dấu `'` rồi vào trạng thái chuỗi, xoá
 * trắng tới dấu `'` kế tiếp — và nuốt luôn `expect(bad, …)` ở dòng 127. Kết quả là BÁO OAN một test có
 * assertion hẳn hoi. Một giả định về "chiều sai" mà không đo thì chính nó là lỗi.
 *
 * Phân biệt regex với phép chia bằng ký tự có nghĩa ĐỨNG TRƯỚC: `/` mở regex khi trước nó không phải một
 * giá trị kết thúc (`identifier`, số, `)`, `]`). Đây là heuristic chuẩn của mọi bộ tô màu cú pháp.
 */
function xoaRuotChuoi(src, giuRegex = false) {
  const ra = src.split('');
  let i = 0;
  const n = src.length;
  const trang = (k) => { if (ra[k] !== '\n' && ra[k] !== '\r') ra[k] = ' '; };
  let truoc = '';   // ký tự có nghĩa gần nhất, để biết `/` là regex hay phép chia
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') { i += 2; while (i < n && src[i] !== '\n') { trang(i); i += 1; } continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { trang(i); i += 1; } i += 2; continue; }
    if (c === '/' && !/[\w$)\]]/.test(truoc)) {
      /*
       * REGEX LITERAL: nhảy tới `/` đóng, bỏ qua `\/` và `/` nằm trong lớp ký tự `[...]`.
       *
       * `giuRegex` quyết định có LÀM TRẮNG ruột regex hay không, và hai bên cần hai hành vi khác nhau:
       *  · `testKhongAssert` → làm trắng (ruột regex không chứa test nào, xoá đi vô hại);
       *  · luật theo dòng → GIỮ, vì `vacuous-url` phải đọc được chính `/./` trong `toHaveURL(/./)`.
       * Dù chọn bên nào thì vẫn phải NHẬN RA regex, nếu không một dấu nháy trong `/^['"]/` sẽ làm bộ quét
       * vào trạng thái chuỗi rồi nuốt hàng chục dòng phía sau.
       */
      i += 1;
      let trongLop = false;
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\') { if (!giuRegex) { trang(i); trang(i + 1); } i += 2; continue; }
        if (src[i] === '[') trongLop = true;
        else if (src[i] === ']') trongLop = false;
        else if (src[i] === '/' && !trongLop) break;
        if (!giuRegex) trang(i);
        i += 1;
      }
      i += 1;
      truoc = '/';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i += 1;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { trang(i); i += 1; if (i < n) trang(i); i += 1; continue; }
        trang(i); i += 1;
      }
      i += 1;
      truoc = q;
      continue;
    }
    if (!/\s/.test(c)) truoc = c;
    i += 1;
  }
  return ra.join('');
}

/**
 * Tìm `test(...)` KHÔNG có bất kỳ khẳng định nào.
 *
 * PHÉP ĐO LÀ XẤP XỈ, và nói rõ ra: thân test được lấy từ `test(` này tới `test(` kế tiếp, không phải bằng
 * khớp ngoặc. Khớp ngoặc đúng cách cần bỏ chuỗi, template literal, regex và comment — đắt và dễ sai hơn
 * chính thứ nó đi bắt. Hệ quả đã biết: helper định nghĩa GIỮA hai test sẽ bị tính vào thân test trước.
 * Xấp xỉ này chỉ sai theo chiều AN TOÀN (bỏ sót), không báo oan.
 *
 * Khẳng định được tính gồm cả helper tên `assertX`/`expectX` (`assertScreen`, `expectToast`) — bước nghiệm
 * thu của kit nằm trong những hàm đó, và một test chỉ gọi `assertScreen` thì CÓ oracle.
 */
function testKhongAssert(body) {
  /*
   * `(?<![.\w$])` là chỗ bản đầu SAI, và sai nặng: `\btest` khớp luôn chữ `test` trong `TEN_CU.test('…')`,
   * vì dấu `.` là ký tự không-từ nên `\b` vẫn thoả. Hệ quả đo được: 201 finding `no-assert`, trong đó có
   * `test("App là ant-design + Metronic")` — đó là một CHUỖI trong âm bản của `old-project-refs.spec.ts`,
   * không phải test nào cả. Mọi lời gọi `regex.test(...)` đều bị đọc thành một test Playwright rỗng.
   */
  const HEAD = /(?<![.\w$])test(\s*\.\s*(only|fixme|skip|describe))?\s*\(\s*(['"`])([\s\S]*?)\3/g;
  const ra = [];
  const heads = [];
  let m;
  /*
   * Tìm đầu test và cắt thân trên bản ĐÃ LÀM TRẮNG RUỘT CHUỖI; tên test thì đọc từ bản GỐC theo đúng chỉ
   * số (hai bản cùng độ dài). Nhờ vậy `test(` nằm trong một chuỗi fixture không còn được tính là một test.
   */
  const blank = xoaRuotChuoi(body);
  while ((m = HEAD.exec(blank))) {
    heads.push({
      i: m.index,
      bien: m[1] || '',
      // `-1` là dấu nháy ĐÓNG: `m[0]` kết thúc SAU nó, nên không trừ thì tên lệch một ký tự —
      // bản đầu in ra `test("ệnh shell …")`, mất chữ đầu và dính dấu nháy ở cuối.
      ten: body.slice(m.index + m[0].length - 1 - m[4].length, m.index + m[0].length - 1),
      dong: blank.slice(0, m.index).split('\n').length,
    });
  }
  for (let k = 0; k < heads.length; k += 1) {
    const h = heads[k];
    if (/skip|fixme|describe/.test(h.bien)) continue;      // khai KHÔNG chạy thì không đòi assertion
    const than = blank.slice(h.i, k + 1 < heads.length ? heads[k + 1].i : blank.length);
    const coAssert = /\bexpect\s*\(/.test(than) || /\b(?:assert|expect)[A-Z]\w*\s*\(/.test(than)
      || /\btest\s*\.\s*(?:skip|fixme)\s*\(/.test(than);   // `test.skip(cond, lý do)` giữa thân = không phán ở đây
    if (!coAssert) ra.push({ ten: h.ten, dong: h.dong });
  }
  return ra;
}

/**
 * Nạp nợ đã khai. Thiếu file ⇒ KÊU rõ là phép kiểm nào chưa được gác, rồi coi như nợ = 0 (tức gate
 * NGHIÊM hơn, không phải dễ hơn) — xem ba nước của `config_load.js`.
 */
function napNo(keu) {
  const o = cfgLoad.napConfigGate({
    duong: path.join(REPO, '.agent/config/auto_review.json'),
    nhan: 'auto_review.json',
    phepKiem: 'khoá SỐ LƯỢNG nợ `hard-sleep` đã khai (nhiều hơn số khai = CHẶN)',
    khiThieu: {},
    keu,
  }) || {};
  return { no: o.hardSleepDebt || {}, marker: o.probeMarker || '@auto-review-probe:' };
}

/*
 * HAI LUẬT CẤP KHỐI của v2.9.5 §5 — về VỊ TRÍ và CHẤT của oracle, không về việc có oracle hay không.
 *
 * BA DẠNG ORACLE CỦA KIT, và biết đủ ba dạng mới là cả giá trị của hàm này. Bản đầu chỉ đếm `expect(`,
 * và đo tay thì 4/5 finding là dương tính giả — tất cả vì detector không biết API của chính kit:
 *   ① `expect(...)`                                  — Playwright.
 *   ② `assert: async () => …` trong `c.step(...)`     — EvidenceRecorder của kit.
 *   ③ `status: <biểu thức>` trong `c.step(...)`       — verdict SUY RA được.
 * Riêng `status: 'PASSED'` viết cứng KHÔNG tính: verdict viết cứng đúng là thứ §6 cấm.
 *
 * Và case khai KHÔNG TUYÊN VERDICT — `c.finish('OBSERVATION'|'BLOCKED_*'|'SKIP_*')` — thì không đòi
 * oracle, ngang với `test.skip(cond, lý do)` mà `testKhongAssert` đã miễn từ trước.
 */
/*
 * DÒ THEO DÒNG, không dò theo chuỗi liền.
 *
 * Bản đầu viết `await` + một lớp ký tự rồi `.click(` — và lớp ký tự đó không chứa dấu phẩy, dấu ngoặc
 * nhọn hay hai chấm, nên nó TRƯỢT sạch `await page.getByRole('Ghi', { name: 'x' }).click()`, tức dạng
 * locator phổ biến nhất của Playwright. Phép đo đặt severity cho hai luật này cũng chạy trên mẫu hụt
 * ấy, nên đã phải đo lại sau khi sửa.
 *
 * Dòng có `await` VÀ có một lời gọi phương thức hành động = một hành động. Chuỗi đã được làm trắng nên
 * `.click(` nằm trong chuỗi không còn tính.
 */
const ACT_TEN = /\.\s*(?:click|fill|press|selectOption|check|uncheck|setInputFiles|dblclick|type|dragTo)\s*\(/;
const ORACLE_KHOI = /\bexpect\s*\(|\bassert\s*:/g;
const STATUS_TINH = /\bstatus\s*:\s*(?!['"`])/g;
const CO_MAT_KHOI = /\.\s*(?:toBeVisible|toBeHidden|toBeAttached|toBeEnabled|toBeDisabled)\s*\(/;
const KHONG_TUYEN_VERDICT = /\.\s*finish\s*\(\s*['"`](?:OBSERVATION|BLOCKED|SKIP)/;

/** Số dòng của mọi dòng vừa có `await` vừa có một lời gọi hành động. */
function dongHanhDong(than) {
  const ra = [];
  const L = than.split('\n');
  for (let i = 0; i < L.length; i += 1) {
    if (/\bawait\b/.test(L[i]) && ACT_TEN.test(L[i])) ra.push(i + 1);
  }
  return ra;
}

/** Số DÒNG của mọi lần khớp — KHÔNG phải offset ký tự. */
function dongKhop(s, re) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  const ra = [];
  let m;
  while ((m = r.exec(s))) ra.push(s.slice(0, m.index).split('\n').length);
  return ra;
}

/**
 * Cắt thân từng `test(...)`, trả cả bản ĐÃ LÀM TRẮNG CHUỖI và bản GỐC.
 *
 * Phải có bản gốc: `status:` và `finish('OBSERVATION')` nằm ngay cạnh chuỗi, mà bản làm-trắng xoá sạch
 * ruột chuỗi nên mẫu khớp trên nó không bao giờ nổ. Đã dính đúng chuyện này một lần trong lúc đo.
 */
function catKhoiTest(src) {
  const HEAD = /(?<![.\w$])test(\s*\.\s*(only|fixme|skip|describe))?\s*\(\s*(['"`])([\s\S]*?)\3/g;
  const blank = xoaRuotChuoi(src);
  const heads = [];
  let m;
  while ((m = HEAD.exec(blank))) {
    heads.push({
      i: m.index,
      bien: m[1] || '',
      ten: src.slice(m.index + m[0].length - 1 - m[4].length, m.index + m[0].length - 1),
      dong: blank.slice(0, m.index).split('\n').length,
    });
  }
  const ra = [];
  for (let k = 0; k < heads.length; k += 1) {
    const h = heads[k];
    if (/skip|fixme|describe/.test(h.bien)) continue;
    const het = k + 1 < heads.length ? heads[k + 1].i : blank.length;
    ra.push({ ...h, than: blank.slice(h.i, het), goc: src.slice(h.i, het) });
  }
  return ra;
}

/**
 * Trả về `[{ id, ten, dong }]` cho `no-assert-after-act` và `presence-only`.
 * Test KHÔNG có oracle nào thì bỏ qua ở đây — đó là việc của `no-assert`, không đếm hai lần.
 */
function oracleSaiCho(src) {
  const ra = [];
  for (const k of catKhoiTest(src)) {
    if (KHONG_TUYEN_VERDICT.test(k.goc)) continue;
    const oracle = [...dongKhop(k.than, ORACLE_KHOI), ...dongKhop(k.goc, STATUS_TINH)].sort((a, b) => a - b);
    if (oracle.length === 0) continue;
    const act = dongHanhDong(k.than);
    if (act.length === 0) continue;

    const L = k.than.split('\n');
    const dongOracle = dongKhop(k.than, /\bexpect\s*\(/g).map((n) => L.slice(n - 1, n + 2).join('\n'));
    if (dongOracle.length > 0 && dongOracle.every((d) => CO_MAT_KHOI.test(d))
        && !/\bassert\s*:/.test(k.than) && !STATUS_TINH.test(k.goc)) {
      ra.push({ id: 'presence-only', ten: k.ten, dong: k.dong });
    }
    if (Math.max(...act) > Math.max(...oracle)) {
      ra.push({ id: 'no-assert-after-act', ten: k.ten, dong: k.dong });
    }
  }
  return ra;
}

module.exports = { RULES, testKhongAssert, oracleSaiCho, catKhoiTest, CAN_NGUOI_XEM, xoaRuotChuoi, napNo };
if (require.main === module) mainCli();

function mainCli() {
  const findings = [];
  const files = targets();
  const track = tapTrack();
  const { no: NO_KHAI, marker: PROBE } = napNo((m) => console.log(m));
  const probeFiles = [];

  for (const { f, scope } of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const rel = path.relative(REPO, f).split(path.sep).join('/');
    /*
     * CÂY KHÔNG-GIT ⇒ COI NHƯ TẦNG CHẶN, không phải "không phán được".
     *
     * Bản đầu trả nhãn `khong-phan-duoc` rồi không chặn, với lý lẽ "không biết file nào là WIP". Lý lẽ đó
     * sai ở chỗ nó bỏ qua cây không-git là CÁI GÌ: đó là **bản đã đóng gói** (`package:kit` ship đúng file
     * được git track, nên WIP không có trong gói). Ở đó `tests/**` chính là suite dùng chung, và chặn là
     * đúng — nhờ vậy `release:verify` thật sự gác chiều này thay vì bỏ qua nó.
     */
    const tang = scope === 'task' ? 'task'
      : (track === null || track.has(rel) ? 'track' : 'wip');
    const lines = src.split(/\r?\n/);
    /*
     * LUẬT THEO DÒNG chạy trên bản ĐÃ LÀM TRẮNG RUỘT CHUỖI (giữ regex), không trên dòng thô.
     *
     * Vì sao: `automation-review.spec.ts` chứa FIXTURE là chuỗi — `waitForTimeout(2000)`,
     * `password = '…'` — và ngay khi nó được git track, gate bắt chính những chuỗi đó rồi tự đỏ. Đây là
     * tình huống `ci_scope_check.js` giải bằng `selfTestExempt`, nhưng miễn trừ là cửa hậu phải khoá số
     * lượng; phán trên phần LÀ CODE thì chính xác hơn và không cần miễn trừ nào.
     *
     * Dòng THÔ chỉ còn dùng để IN ra cho người đọc.
     */
    const codeLines = xoaRuotChuoi(src, true).split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      if (/auto-review-disable-next-line\s+\S/.test(lines[i - 1] || '')) continue;
      for (const r of RULES) {
        if (r.khoi) continue;             // luật cấp KHỐI, không quét theo dòng
        if (r.sharedOnly && scope !== 'shared') continue;
        if (r.taskOnly && scope !== 'task') continue;
        if (r.specOnly && !laSpec(rel)) continue;
        if (r.not && r.not.test(codeLines[i])) continue;
        const m = r.re.exec(codeLines[i]);
        if (!m) continue;
        if (r.ok && r.ok(m)) continue;
        findings.push({ file: rel, line: i + 1, scope, tang, rule: r, code: lines[i].trim().slice(0, 88) });
      }
    }

    /*
     * Spec DÒ DỮ LIỆU khai ngay trong file: `@auto-review-probe: <lý do>`. Marker KHÔNG có lý do thì
     * không tính — y như `locator-lint-disable-next-line` không lý do vẫn bị tính là vi phạm.
     */
    const mk = src.indexOf(PROBE);
    /*
     * Phải GỠ ký tự đóng block-comment trước khi xét "có lý do". Marker đặt trong một block comment thì
     * ngay sau dấu hai chấm vẫn còn cặp dấu đóng, nên phép thử `\S` của bản đầu coi đó là CÓ lý do — tức
     * marker TRỐNG vẫn lọt, đúng thứ luật này cấm. Đòi ≥ 8 ký tự chữ, để một dấu gạch hay một từ cụt
     * không được tính là lời giải thích.
     *
     * (Chú thích này cũng đã phải viết lại: bản đầu của nó DẪN NGUYÊN VĂN cặp dấu đóng để minh hoạ, và
     * thế là tự đóng block comment sớm — cả file thành lỗi cú pháp. Lần thứ hai trong phiên một chú thích
     * tự gây ra đúng lỗi nó đang giải thích; lần trước là ở `old-project-refs.spec.ts`.)
     */
    const lyDo = mk < 0 ? '' : src.slice(mk + PROBE.length, (src.indexOf('\n', mk) + 1) || src.length)
      .replace(/\*\/|\/\/|^\s*\*/g, ' ').trim();
    const coProbe = mk >= 0 && lyDo.length >= 8;
    if (coProbe) probeFiles.push(rel);

    if (laSpec(rel) && !coProbe) {
      for (const t of testKhongAssert(src)) {
        findings.push({
          file: rel,
          line: t.dong,
          scope,
          tang,
          rule: luat('no-assert'),
          code: `test("${String(t.ten).slice(0, 60)}")`,
        });
      }
      /* Hai luật về VỊ TRÍ/CHẤT của oracle. Cùng đường miễn trừ `@auto-review-probe:` với `no-assert`. */
      for (const t of oracleSaiCho(src)) {
        findings.push({
          file: rel,
          line: t.dong,
          scope,
          tang,
          rule: luat(t.id),
          code: `test("${String(t.ten).slice(0, 60)}")`,
        });
      }
    }
  }

  const p0 = findings.filter((x) => x.rule.sev === 'P0');
  const p0Track = p0.filter((x) => x.tang === 'track');
  const dem = (t) => findings.filter((x) => x.tang === t).length;
  console.log(`[auto-review] ${files.length} file · ${findings.length} finding (P0 ${p0.length})`);
  console.log(`[auto-review] theo tầng: track ${dem('track')} (P0 ${p0Track.length} — tầng CHẶN) · wip ${dem('wip')} · task ${dem('task')}${track === null ? ' · KHÔNG phải repo git ⇒ coi CẢ `tests/**` là tầng chặn (đây là hình dạng của bản ĐÃ ĐÓNG GÓI)' : ''}`);

  if (findings.length) {
    const byRule = new Map();
    for (const x of findings) byRule.set(x.rule.id, (byRule.get(x.rule.id) || 0) + 1);
    console.log('\n— Theo rule —');
    for (const [id, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
      const r = findings.find((x) => x.rule.id === id).rule;
      console.log(`  ${r.sev}  ${String(n).padStart(4)}  ${id}: ${r.why}\n           → ${r.fix}`);
    }
    const viDu = p0Track.length ? p0Track : findings;
    console.log(`\n— Ví dụ (${p0Track.length ? 'P0 ở tầng CHẶN' : 'tất cả'}) —`);
    viDu.slice(0, TOP).forEach((x) => console.log(`  ${x.file}:${x.line} [${x.rule.id}]\n      ${x.code}`));
  } else {
    console.log('[auto-review] ✓ Sạch trên phạm vi đang quét.');
  }

  console.log('\n— Máy KHÔNG phán được, cần người/AI xem —');
  CAN_NGUOI_XEM.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

  if (WITH_LOCATOR) {
    console.log('\n— Chiều locator: GỌI `lint:locator`, không chép luật —');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'locator_lint.js'), ...(ENFORCE ? ['--enforce'] : []), ...(INCLUDE_TASKS ? ['--include-tasks'] : [])], { encoding: 'utf8' });
    console.log((r.stdout || '').split('\n').filter((d) => /^\[locator-lint\]/.test(d)).join('\n'));
    if (ENFORCE && r.status !== 0) {
      console.log('[auto-review] ✗ CHẶN — `lint:locator` đỏ (xem ở trên). Chạy `npm run lint:locator` để biết chi tiết.');
      process.exit(1);
    }
  } else {
    console.log('\nChiều locator KHÔNG kiểm ở đây — nó có máy riêng: `npm run lint:locator` (hoặc thêm `--with-locator`).');
  }

  /*
   * NỢ ĐÃ KHAI, đối soát theo SỐ LƯỢNG mỗi file — không theo số dòng. Số dòng trôi ngay khi ai đó thêm
   * một dòng phía trên, và lúc đó nợ sẽ tự "biến mất" khỏi danh sách rồi gate đỏ oan.
   */
  const demSleep = new Map();
  for (const x of p0Track.filter((y) => y.rule.id === 'hard-sleep')) {
    demSleep.set(x.file, (demSleep.get(x.file) || 0) + 1);
  }
  const vuotNo = [];
  for (const [f, n] of demSleep) {
    const khai = Number(NO_KHAI[f] || 0);
    if (n > khai) vuotNo.push(`${f}: ${n} lần ngủ cứng, nợ khai ${khai} ⇒ ${n - khai} cái MỚI`);
  }
  for (const [f, khai] of Object.entries(NO_KHAI)) {
    const n = demSleep.get(f) || 0;
    if (n < khai) console.log(`[auto-review] ⚠ nợ đã GIẢM ở ${f}: thực ${n} < khai ${khai} ⇒ hạ số trong \`auto_review.json\`, đừng để nó cao hơn thực tế.`);
  }
  if (probeFiles.length) console.log(`[auto-review] ${probeFiles.length} file khai là bản DÒ (\`${PROBE}\`) ⇒ không đòi assertion: ${probeFiles.join(', ')}`);

  const chanThat = p0Track.filter((x) => x.rule.id !== 'hard-sleep').length + vuotNo.length;
  if (ENFORCE && chanThat) {
    console.log(`\n[auto-review] ✗ CHẶN — ${chanThat} vấn đề ở file ĐÃ TRACK dưới \`tests/**\`. File chưa track (WIP) và nợ cũ theo task KHÔNG chặn.`);
    vuotNo.forEach((s) => console.log(`  nợ vượt khai — ${s}`));
    process.exit(1);
  }
  console.log(ENFORCE ? '\n[auto-review] ✓ ĐẠT — 0 P0 mới ở file đã track (nợ đã khai không tính).' : '\nChặn được bằng: npm run auto:review:enforce');
}
