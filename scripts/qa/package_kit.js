#!/usr/bin/env node
'use strict';

/*
 * package_kit.js — đóng gói bản phát hành SẠCH của kit vào `dist/`.
 *
 * NGUYÊN TẮC DUY NHẤT: gói chỉ chứa **lớp GENERIC** theo `.agent/config/kit-layers.md`. Lớp PROJECT không
 * được lọt, vì hai lý do khác nhau và đều nghiêm trọng:
 *   · SECRET/PII — `.env*`, `profiles/<TASK>/task.env`, `knowledge/**`, `outputs/**` là dữ liệu công ty.
 *   · ORACLE SAI — `.agent/config/db.conventions.json` chứa schema + bản đồ cột↔nhãn ĐO TỪ DB của MỘT dự án
 *     (đo được: tên bảng thật, host DB, và nhãn tiếng Việt của màn nội bộ). Phát cho dự án
 *     khác là đưa họ một bản đồ cột sai mà vẫn "có số từ DB" — đúng cách tạo bug ma thuyết phục nhất. Nên
 *     gói mang `db.conventions.example.json`, không mang bản thật.
 *
 * SAU KHI ĐÓNG GÓI, QUÉT LẠI CHÍNH GÓI. Không tin danh sách loại trừ: một đường dẫn viết sai là gói lộ dữ
 * liệu, và gói phát ra ngoài là đường rò khó thu hồi nhất. Phát hiện ⇒ **xoá gói + exit 1**.
 *
 * KHÔNG THÊM DEPENDENCY: nén bằng `tar` (có sẵn trên Windows 10+ và mọi runner Linux). Cố ý không dùng `.zip`
 * — `zip` không có trong git-bash trên máy Windows, còn thêm `archiver` thì lock lệch (cây đang có 4.0.2).
 *
 * Dùng: node scripts/qa/package_kit.js [--out dist]
 * Exit: 0 đạt · 1 gói bẩn/thiếu file bắt buộc · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');

/* ── Lớp GENERIC: những gì ĐƯỢC mang đi ────────────────────────────────────────────────────────────────── */
const KEEP_DIRS = [
  '.agent/rules', '.agent/skills', '.agent/workflows',
  'scripts', 'prompt_templates', 'partial-rerun', 'exploratory',
  /*
   * BỔ SUNG 10/10/2026 — đo bằng `comm` giữa `git ls-files` và `tar -tzf` của chính gói, không đọc code
   * mà đoán. Ba nhánh `partial-rerun`/`exploratory` có trong danh sách từ đầu, nhưng `manual-run` (thêm ở
   * v2.3.0) thì không — nên `gate:policy` trong gói ĐỎ: branch_parity không tìm được `expansion:plan` ở
   * nhánh đó, vì cả nhánh không có trong gói. Thêm một nhánh mà quên danh sách này là lỗi lặp được,
   * nên `tests/fe/infra/config-presence.spec.ts` giờ đối chiếu luôn cả nhánh.
   *
   * `.claude/agents`: định nghĩa subagent là NỘI DUNG CỦA KIT — chính `.gitignore` đã mở ngoại lệ cho nó
   * vì lý do đó, nhưng gói lại không mang. Người nhận kit sẽ không có subagent nào.
   */
  'manual-run', '.claude/agents', 'tests/load',
  'tests/support', 'tests/fe/infra', 'tests/fe/fixtures', 'tests/fe/pages', 'tests/fe/visual', 'tests/fixtures',
  '.claude/commands', '.github/workflows',
  /*
   * Ảnh của USER_GUIDE. Thiếu thư mục này thì tài liệu onboarding chính của kit hiện 10 ẢNH VỠ ngay
   * lần mở đầu tiên. Đo 19/09/2026: gói không mang `docs/` nào, trong khi `USER_GUIDE.md` nhúng đúng
   * 10 ảnh ở đây. Ảnh đã gỡ sạch nhận diện công ty nên mang đi được.
   */
  'docs/user-guide-images',
];
const KEEP_FILES = [
  '.gitlab-ci.yml', 'playwright.config.js', 'package.json', 'package-lock.json',
  'tsconfig.json', 'eslint.config.js', '.nvmrc', '.gitignore', '.env.example',
  'profiles/task.env.example', 'knowledge/SCHEMA.md',
  /* `LICENSE` thiếu thì gói phát đi không có giấy phép. `AUDIT_REFERENCES.md` là chỉ mục tra cứu của kit. */
  'LICENSE', '.agent/AUDIT_REFERENCES.md',
  'README.md', 'QUICKSTART.md', 'USER_GUIDE.md', 'RULE_GLOBAL.md', 'CHANGELOG.md', 'CLAUDE.md',
  /*
   * BA FILE CỦA v2.7.0 BỊ BỎ SÓT KHỎI GÓI, và `release:verify` bắt được bằng cách CHẠY BỘ TEST TRONG GÓI:
   * 13 test đỏ, không phải vì code sai mà vì file chúng đọc không có ở đó.
   *
   *   · `docs/CHEATSHEET.md` — trang §A7 nói "năm lệnh phải nhớ". `five-commands.spec.ts` đọc nó, và
   *     `writing_lint` cũng gác nó. Thiếu file thì cả hai hỏng trong gói.
   *   · `docs/RULE_COVERAGE.md` — bản đồ luật → gate → spec (§A10.7). `rule:coverage:check` CHẶN khi
   *     thiếu file, nên gói không mang nó thì máy mới đỏ ngay lượt đầu vì thiếu config, không vì lỗi.
   *   · `tsconfig.scripts.json` — `typecheck:scripts` (§A10.2) chạy theo file này. Thiếu nó thì lệnh
   *     chết, và hợp đồng dữ liệu testcase thôi được kiểm trong gói.
   *
   * Bài học: thêm một file mà gate đọc thì phải thêm vào ĐÂY cùng lúc. Chỗ duy nhất bắt được là chạy bộ
   * test TRONG gói — chạy ở repo thì file luôn có mặt.
   */
  'docs/CHEATSHEET.md', 'docs/RULE_COVERAGE.md', 'tsconfig.scripts.json',
  /*
   * `.claude/settings.json` — file ĐĂNG KÝ HOOK, tức lớp chặn mạnh nhất của kit (chạy tự động ở tầng
   * harness, không phụ thuộc agent nhớ gọi). Nó ĐÃ được commit từ `98879ee`; thứ chặn nó khỏi gói là
   * luật `DENY` cũ `/^.claude\/settings/`, vốn định chặn `settings.local.json` nhưng giết luôn cả hai.
   *
   * Lộ ra ở v2.7.0 vì §A5 làm `gates:index --check` CÓ RĂNG: nó chặn khi một source khai trong danh mục
   * mà không có trên đĩa. Ở repo file có mặt nên không ai thấy; trong gói thì không, và ba test đỏ.
   *
   * File chỉ chứa tên event và đường dẫn script trong repo. Env, secret và đường dẫn cá nhân thuộc
   * `.claude/settings.local.json`, vẫn bị chặn.
   */
  '.claude/settings.json',
  /*
   * Danh mục 80 máy của kit. Hai lý do phải mang theo, cả hai đo được:
   *   · `README.md` trỏ tới file này, không mang là link hỏng ngay ở tài liệu đầu tiên;
   *   · `gate:policy` trong gói ĐỎ vì `writing:lint:docs` không bề mặt nào nhắc — GATES.md là nơi
   *     duy nhất nhắc nó, nên bỏ file này ra là tự làm hỏng phép kiểm 1-nguồn-policy của chính gói.
   * Nội dung là catalogue sinh tự động từ chính source, không mang dữ liệu dự án.
   */
  '.agent/config/GATES.md',
  '.agent/config/kit-layers.md', '.agent/config/verdict_taxonomy.json',
  '.agent/config/case_types.json', '.agent/config/branch_parity.json', '.agent/config/ci_scope.json',
  '.agent/config/ci_parity.json',
  '.agent/config/locators.schema.json',
  /*
   * CẤU HÌNH MÁY MÓC — lớp GENERIC, phải đi theo gói.
   *
   * Luật "chỉ mang .example, loại mọi config THẬT" viết ra để chặn dữ liệu dự án, nhưng nó loại nhầm
   * cả cấu hình mà chính máy của kit cần để chạy. Đo 19/09/2026: giải nén gói rồi chạy suite thì
   * 25 test ĐỎ, phần lớn là ENOENT đúng mấy file này (`writing_style.json`, `env_lanes.json`).
   * Người nhận gõ `npm test` lần đầu thấy 25 đỏ mà không hiểu vì sao.
   *
   * Cả 5 file đã soi: không chứa host, bảng DB, credential hay PII. Chỗ nhắc mã task chỉ là TIỀN LỆ
   * cho luật (kiểu "bug CSDL-28776 bị Rejected vì đọc thiếu chữ"), giữ lại thì luật mới có căn cứ.
   */
  '.agent/config/writing_style.json',
  '.agent/config/env_lanes.json',
  '.agent/config/bug_claim.json',
  '.agent/config/retention.json',
  '.agent/config/library-drift.allow.json',
  /*
   * BỔ SUNG 10/10/2026 — đo trên chính bản đóng gói, không phải đọc code mà đoán.
   *
   * Ba file đầu được nạp bằng `require()`, nên thiếu chúng là gói KHÔNG NẠP NỔI `md_to_xlsx.js`
   * và `npx playwright test tests/fe/infra` chết ngay lúc collect:
   *   Cannot find module '../../../.agent/config/design_techniques.json'
   * Số còn lại đọc bằng try/catch nên không nổ — chúng TẮT PHÉP KIỂM rồi đi tiếp, tệ hơn hẳn.
   *
   * Cả nhóm đã soi: catalogue kỹ thuật/loại field, mã vi phạm, nghịch lý ngân sách prompt, bản đồ nạp
   * tài liệu, rubric chấm case — không chứa host, bảng DB, credential hay PII.
   * `tests/fe/infra/config-presence.spec.ts` giờ đối chiếu danh sách này với chính `scripts/**`.
   */
  '.agent/config/design_techniques.json',
  '.agent/config/ui_components.json',
  /*
   * `discovery.json` (v2.6.0): danh sách nút cấm bấm, dấu hiệu prod, giới hạn lượt bò, từ điển dấu hiệu
   * lỗi SQL. Thiếu nó trong gói thì `write_firewall.napCfg()` NÉM và Bước 0 không chạy được — đúng chủ
   * đích: cấu hình khuyết thì KHÔNG CHẤY, chứ không chạy với một lớp phòng vệ biến mất im lặng.
   * Không chứa host, bảng DB, credential hay PII: chỉ là danh sách nhãn và ngưỡng.
   */
  '.agent/config/discovery.json',
  /*
   * `gate_tiers.json` (v2.7.0): T0 khai tay cùng luật ba tầng. Thiếu nó trong gói thì `gate:audit`
   * xếp MỌI máy chặn thành T1 — tức 12 máy không-thương-lượng tụt xuống "chỉ chặn ở cửa ra" một
   * cách im lặng. Lớp GENERIC, không mang mã task hay host.
   */
  '.agent/config/gate_tiers.json',
  /*
   * `exit_gates.json` (v2.7.0 §A2): bản đồ BA CỬA RA. Thiếu nó trong gói thì `exit:gate` không
   * chạy được, và mọi vi phạm T1 đã hoãn ở §A1 không còn chỗ nào quay lại — tức người nhận kit
   * được một bản đã nới 57 máy gác. Lớp GENERIC: chỉ tên lệnh và lý do, không mang host hay mã task.
   */
  '.agent/config/exit_gates.json',
  /*
   * `risk_lanes.json` (v2.7.0 §A6): hai làn theo risk, và `_luat_khong_doi_duoc` — bốn thứ giữ
   * nguyên ở cả hai làn. Thiếu nó trong gói thì `lane` không chạy được, và người nhận kit mất
   * luôn bản khai rằng làn KHÔNG nới được T0, evidence, rerun hay cửa ra.
   */
  '.agent/config/risk_lanes.json',
  /*
   * `rule_coverage_notes.json` (v2.7.0 §A10.7): lời khai của người cho các mục luật không nối được gate
   * bằng tên lệnh. Thiếu nó trong gói thì `rule:coverage:check` thấy 6 mục trống và CHẶN ngay ở máy mới,
   * trong khi chẳng có gì sai — và người cài kit sẽ đọc màu đỏ đó thành "kit thiếu 6 gate".
   */
  '.agent/config/rule_coverage_notes.json',
  /*
   * `gate_code_pairs.json` (v2.7.0 §A10.3): cặp bẩn/sạch của 21 mã T0/T1. Thiếu nó thì `gate:code-pair` báo cả
   * 21 mã "không có cặp" — một màn CHẶN toàn bộ ở máy mới, vì thiếu config chứ không vì thiếu gate.
   */
  '.agent/config/gate_code_pairs.json',
  /*
   * `db-paths.allow.json` (v2.8.0 §0b.5): danh sách miễn trừ CÓ HẠN của `db:paths:check`. Thiếu nó trong
   * gói thì máy mới đỏ ngay lượt đầu vì 9 file probe có sẵn của một task cũ — đỏ vì thiếu config, không
   * vì có lỗi. Mà một gate đỏ-khi-vừa-cài thì bị bỏ qua chứ không được sửa.
   */
  '.agent/config/db-paths.allow.json',
  /*
   * `judge_rubric.json` + `judge_calibration.json` (v2.7.0 §A11): thang chấm cho phần máy không đo được,
   * và bộ hiệu chuẩn. Thiếu thang thì `judge --check` không biết chấm những mục nào; thiếu bộ hiệu chuẩn
   * thì mọi lời chấm thành CHƯA ĐƯỢC GÁC — đúng hướng an toàn, nhưng vì lý do sai.
   *
   * MỐC hiệu chuẩn (`.judge_calibration_moc.json`) KHÔNG vào gói, cố ý: nó nói về một NGƯỜI CHẤM cụ thể
   * ở một thời điểm cụ thể. Đem mốc của máy này sang máy khác là khai rằng người chấm bên kia đã hiệu
   * chuẩn, trong khi họ chưa chấm ca nào.
   */
  '.agent/config/judge_rubric.json',
  '.agent/config/judge_calibration.json',
  '.agent/config/checklist_types.json',
  '.agent/config/gate_codes.json',
  '.agent/config/na_reasons_rejected.json',
  '.agent/config/load_map.json',
  '.agent/config/prompt_budget.json',
  '.agent/config/handoff.json',
  '.agent/config/tc_review.json',
  '.agent/config/gitlab_strip.json',
  '.agent/config/deps_allow.json',
  '.agent/config/rule_parity.json',
  '.agent/config/auto_review.json',
  '.agent/config/run_analysis.json',
  '.agent/config/manual_run.json',
  '.agent/config/skills_lint.json',
];

/*
 * Lớp PROJECT nằm TRONG thư mục GENERIC ⇒ phải loại theo tên, không thể loại theo thư mục cha.
 * `.agent/config/*` chỉ mang bản `.example.*` + danh sách trên; mọi file config THẬT khác đều bị loại.
 */
const DENY = [
  /(^|\/)node_modules(\/|$)/,
  /^outputs\//, /^reports\//, /^test-results\//, /^dist\//, /(^|\/)\.git(\/|$)/,
  // `.env.example` PHẢI được giữ (nó là bản mẫu, lớp GENERIC). Luật cũ `/^\.env(\..*)?$/` giết luôn nó.
  /^\.env$/, /^\.env\.(?!example$)/, /(^|\/)\.env$/,
  /*
   * CHỈ chặn `settings.local.json`, KHÔNG chặn `settings.json`.
   *
   * Luật cũ `/^.claude\/settings/` giết cả hai, và nó giết đúng file quan trọng hơn:
   * `settings.json` ĐĂNG KÝ HOOK, tức lớp chặn mạnh nhất của kit — chạy tự động ở tầng harness, không
   * phụ thuộc agent nhớ gọi. Gói không mang nó thì người nhận phải tự bật, nghĩa là lớp chặn mạnh nhất
   * lại là lớp DỄ KHÔNG CÓ NHẤT. `.gitignore` đã mở ngoại lệ cho nó từ round-3 với đúng lý lẽ này.
   *
   * `settings.local.json` mới là file cá nhân (env, đường dẫn máy) và vẫn bị chặn.
   */
  /^\.claude\/settings\.local\.json$/,
  /^profiles\/(?!task\.env\.example$)/,
  /^knowledge\/(?!SCHEMA\.md$)(?!.*\.gitkeep$)/,
  /^tests\/api\//, /^tests\/mobile-web\//,
  /^tests\/fe\/(auth|support|order|transaction)\//,
  /\.spec\.ts-snapshots\//,           // ảnh baseline visual là của dự án, không phải của kit
  /*
   * Spec CHẠY THẬT trên DB/màn của dự án này ⇒ lớp PROJECT, dù nằm trong thư mục GENERIC.
   * Chúng truy vấn bảng thật trên DB thật và assert nhãn UI tiếng Việt của app nội bộ: mang
   * sang dự án khác thì KHÔNG THỂ pass, và một spec đỏ-vì-sai-dự-án còn tệ hơn không có spec (người nhận sẽ
   * học cách bỏ qua màu đỏ). Kit vẫn mang ĐỘNG CƠ của tầng DB (`types/match/guard/config/dbVerify/adapters`)
   * + `db.conventions.example.json`; phần NEO là việc mỗi dự án tự đo.
   */
  /^tests\/support\/setup\/db\/.*\.spec\.ts$/,
  /^tests\/fe\/infra\/db-verify-.*\.spec\.ts$/,
];

const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(path.join(REPO, dir), { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const r = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(r, out);
    else out.push(r);
  }
  return out;
}

/*
 * CHỈ GÓI FILE ĐÃ ĐƯỢC GIT TRACK.
 *
 * Đo 29/09/2026, ngay sau khi phát hành 2.2.0: gói dựng tại máy có 365 file còn gói CI dựng ra chỉ 364.
 * Chênh đúng một file, và đó là một spec CHƯA COMMIT của người đang chạy lệnh. Nguyên nhân: `walk()` duyệt
 * ĐĨA, mà đĩa thì có cả thứ chưa track. CI không dính vì checkout sạch — tức lỗi chỉ hiện ra ở máy người,
 * đúng chỗ không ai soi.
 *
 * Hệ quả nếu để nguyên: ai đóng gói tại máy rồi đưa gói cho người khác sẽ phát luôn MỌI file chưa track
 * của mình — file nháp, ghi chú, dữ liệu dò tay. Đúng thứ đầu file này gọi là "đường rò khó thu hồi nhất".
 *
 * Không có `.git` thì TỪ CHỐI đóng gói, không phải cảnh báo rồi làm tiếp: lúc đó công cụ KHÔNG chứng minh
 * được nó đang mang gì đi. `release:verify` không gọi hàm này nên không vướng.
 */
function trackedFiles() {
  try {
    const out = execFileSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const list = out.split('\0').filter(Boolean);
    if (list.length) return new Set(list);
  } catch (e) { /* không có git hoặc không phải repo */ }
  return null;
}

function collect() {
  const files = new Set();
  for (const d of KEEP_DIRS) for (const f of walk(d)) files.add(f);
  for (const f of KEEP_FILES) if (fs.existsSync(path.join(REPO, f))) files.add(f);
  // Bản .example.* của mọi config + mọi .gitkeep (giữ khung thư mục cho người nhận).
  for (const f of walk('.agent/config')) if (/\.example\.[a-z]+$/.test(f)) files.add(f);
  for (const f of walk('knowledge')) if (f.endsWith('.gitkeep')) files.add(f);

  const tracked = trackedFiles();
  if (!tracked) {
    throw new Error('[package] KHÔNG đọc được danh sách file git track (thiếu .git hoặc thiếu git). '
      + 'Từ chối đóng gói: không chứng minh được gói mang những gì. Đóng gói từ một bản clone đầy đủ.');
  }
  const ketQua = [...files].filter((f) => !DENY.some((re) => re.test(f)));
  const boQua = ketQua.filter((f) => !tracked.has(f)).sort();
  if (boQua.length) {
    // In ra chứ KHÔNG im lặng: bỏ file mà không nói thì lần sau người ta lại tưởng gói có nó.
    console.log(`[package] bỏ ${boQua.length} file CHƯA git track (không được phát ra ngoài):`);
    for (const f of boQua.slice(0, 20)) console.log(`    ~ ${f}`);
    if (boQua.length > 20) console.log(`    … (+${boQua.length - 20})`);
  }
  return ketQua.filter((f) => tracked.has(f)).sort();
}

/*
 * Quét gói bằng ĐÚNG luật của secret_scan (`lib/secret_patterns.js` — một nguồn), CỘNG thêm marker lớp
 * PROJECT. Không dùng regex email/SĐT trên source: bản đầu làm vậy và báo oan 4 chỗ hợp lệ (email tác giả
 * trong package-lock, placeholder trong .env.example, chuỗi mẫu trong sanitize.js, URL SSH git@host). PII
 * của khách nằm ở outputs/knowledge/profiles — đã loại theo CẤU TRÚC.
 */
function scanPackage(root, files) {
  const sp = require(path.resolve(__dirname, 'lib', 'secret_patterns'));
  const { PATTERNS, CRED_FILE, CRED_CONTENT } = sp;
  // Marker tên bảng suy từ quy ước DB của CHÍNH `root` — xem `markersFromConventions` để biết vì sao.
  const PROJECT_MARKERS = [...sp.PROJECT_MARKERS, ...sp.markersFromConventions(root)];
  const hits = [];
  const warns = [];
  for (const f of files) {
    if (CRED_FILE.test(path.basename(f))) {
      let body = '';
      try { body = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { /* nhị phân */ }
      if (CRED_CONTENT.test(body)) { hits.push(`${f} — tên VÀ nội dung kiểu credential`); continue; }
    }
    if (/\.(png|jpe?g|webp|mp4|webm|xlsx|zip|gz|ico|woff2?|ttf)$/i.test(f)) continue;
    let body;
    try { body = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { continue; }
    for (const p of PATTERNS) if (p.re.test(body)) hits.push(`${f} — secret: ${p.name}`);

    /*
     * Marker lớp PROJECT — CHẶN hay CẢNH BÁO tuỳ LOẠI FILE, vì hại của hai loại khác nhau hẳn:
     *
     *   · File DỮ LIỆU (.json/.yml) mang tên bảng/host của dự án ⇒ **CHẶN**. Đây đúng ca `db.conventions.json`:
     *     người nhận sẽ dùng nó làm oracle và ra kết luận sai mà vẫn "có số từ DB".
     *   · File CODE/tài liệu chỉ NHẮC tên bảng trong comment/ví dụ ⇒ **CẢNH BÁO**. Ví dụ `types.ts` giải thích
     *     "cùng khái niệm tiền, hai kiểu lưu" bằng bảng thật — đó là tri thức có ích, không phải oracle. Chặn
     *     ở đây là chặn oan, và gate báo oan một lần là mất uy tín vĩnh viễn.
     *
     * Bản `.example.*` và `.md` bỏ qua: chúng TỒN TẠI để kể ví dụ có thật.
     *
     * NGOẠI LỆ — `.md` dưới `prompt_templates/` và `.agent/` thì KHÔNG bỏ qua, và là CHẶN.
     * Hai thư mục đó được `kit-layers.md` khai là lớp GENERIC với ràng buộc nguyên văn "phải KHÔNG chứa tên
     * hệ thống/task/URL của dự án cụ thể". Khác biệt không nằm ở đuôi file mà ở VAI TRÒ: `README.md` là thứ
     * người ĐỌC, còn prompt template và workflow là thứ agent THI HÀNH — chúng đóng vai oracle y như file
     * dữ liệu, nên cùng mức chặn.
     *
     * Đo 19/09/2026: luật cũ bỏ qua mọi `.md` nên gói `kit-2.1.1` phát ra ngoài kèm mục
     * "Hai giới hạn ĐÃ ĐO của DB NÀY" trong `prompt_templates/phase1/dimensions/23_db_persistence.md`,
     * khẳng định một bảng cụ thể không có cột audit. Người nhận ở dự án khác đọc đó là sự thật về DB
     * của họ. Sau khi khái quát hoá lại: 0 hit trên toàn bộ `prompt_templates/**` và `.agent/**`, nên bật
     * mức CHẶN không báo oan file nào đang có.
     *
     * Muốn giữ ví dụ thì khái quát hoá tên ("bảng đơn", "bảng giao dịch") — đó cũng đúng thứ luật lớp đòi.
     */
    const laGenericDoc = /^(prompt_templates|\.agent)\//.test(f.split(path.sep).join('/'));
    if (/\.md$/.test(f) && laGenericDoc) {
      for (const m of PROJECT_MARKERS) {
        if (m.re.test(body)) hits.push(`${f} — lớp GENERIC (prompt/workflow agent THI HÀNH) mang ${m.name}`);
      }
      continue;
    }
    if (/\.md$|\.example\./.test(f)) continue;
    const isData = /\.(json|ya?ml)$/i.test(f);
    for (const m of PROJECT_MARKERS) {
      if (!m.re.test(body)) continue;
      if (isData) hits.push(`${f} — lớp PROJECT lọt vào gói (file DỮ LIỆU): ${m.name}`);
      else warns.push(`${f} — nhắc ${m.name} trong code/comment (cảnh báo, không chặn)`);
    }
  }
  return { hits, warns };
}

function main() {
  const argv = process.argv.slice(2);
  const outDir = path.join(REPO, (argv.indexOf('--out') >= 0 && argv[argv.indexOf('--out') + 1]) || 'dist');

  let version;
  try { version = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version; } catch (e) { version = ''; }
  if (!version) { console.error('[package] package.json thiếu `version` — chạy `npm run version:check` trước.'); process.exit(2); }

  const files = collect();
  if (!files.length) { console.error('[package] không thu được file nào — danh sách KEEP sai?'); process.exit(2); }

  // Kiểm gói HỤT: những file GENERIC mà thiếu thì người nhận không chạy nổi.
  const MUST = ['package.json', 'package-lock.json', 'playwright.config.js', 'tsconfig.json', 'eslint.config.js',
    'README.md', 'CLAUDE.md', 'RULE_GLOBAL.md', 'CHANGELOG.md', '.agent/config/kit-layers.md',
    '.agent/config/verdict_taxonomy.json', 'knowledge/SCHEMA.md', 'profiles/task.env.example', '.env.example'];
  const missing = MUST.filter((f) => !files.includes(f));

  // Dựng staging rồi nén — tar theo danh sách file để không lẫn thứ khác.
  fs.mkdirSync(outDir, { recursive: true });
  const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kitpkg-'));
  const rootName = `kit-${version}`;
  for (const f of files) {
    const dst = path.join(stage, rootName, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), dst);
  }

  // QUÉT LẠI CHÍNH GÓI (trên staging, trước khi nén — phát hiện thì không có gói nào ra đời).
  const { hits: leaks, warns: markerWarns } = scanPackage(path.join(stage, rootName), files);

  const outFile = path.join(outDir, `${rootName}.tar.gz`);
  if (!leaks.length) {
    /*
     * `-f` phải là TÊN FILE TƯƠNG ĐỐI, chạy với cwd = outDir. Truyền đường dẫn Windows tuyệt đối thì GNU tar
     * hiểu `D:` là HOST TỪ XA (cú pháp rsh cũ) và báo "Cannot connect to D: resolve failed". Cách này chạy
     * đúng với cả GNU tar (git-bash, runner Linux) lẫn bsdtar, không cần cờ `--force-local`.
     */
    execFileSync('tar', ['-czf', `${rootName}.tar.gz`, '-C', stage, rootName], { cwd: outDir, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const bytes = leaks.length ? 0 : fs.statSync(outFile).size;
  fs.rmSync(stage, { recursive: true, force: true });

  console.log(`[package] ${files.length} file · ${(bytes / 1048576).toFixed(2)} MB · ${rel(outFile)}`);
  if (missing.length) console.log(`[package] ⚠ GENERIC còn thiếu trong gói (nêu ra để người quyết, KHÔNG tự thêm): ${missing.join(', ')}`);
  if (markerWarns.length) {
    console.log(`[package] ⚠ ${markerWarns.length} file code/comment còn nhắc tên bảng/host của dự án (không chặn):`);
    markerWarns.slice(0, 8).forEach((w) => console.log(`    ~ ${w}`));
  }

  if (leaks.length) {
    if (fs.existsSync(outFile)) fs.rmSync(outFile);
    console.log('\n[package] ✗ GÓI BẨN — đã KHÔNG tạo file. Secret/PII tìm thấy:');
    leaks.slice(0, 20).forEach((h) => console.log(`  - ${h}`));
    console.log('\n[package] BLOCK.');
    process.exit(1);
  }
  if (missing.length) { console.log('\n[package] ✗ THIẾU file GENERIC bắt buộc.'); process.exit(1); }
  console.log('\n[package] ✓ ĐẠT');
  process.exit(0);
}

module.exports = { collect, scanPackage, KEEP_DIRS, KEEP_FILES, DENY };
if (require.main === module) main();
