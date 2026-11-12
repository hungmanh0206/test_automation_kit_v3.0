#!/usr/bin/env node
'use strict';

/*
 * leak_report.js — đo "kit đang rò bao nhiêu và rò kiểu gì" (baseline cho mọi cải tiến sau).
 *
 * Migrated từ hệ bug-tracking cũ (22/09/2026). Khác hệ cũ: Backlog KHÔNG có labels tự do, nên nguồn phát hiện
 * (`found-by-kit`/`found-by-human`, ghi bởi bug_reporter.js — xem buildBugDescription) giờ nằm trong
 * TEXT của description, không phải field `labels` riêng — đọc bằng string match thay vì `labels.includes`.
 *
 * Vì sao cần: đánh dấu found-by chỉ chứng minh bug được TẠO qua tool của kit, KHÔNG chứng minh tool
 * TÌM ra nó. Không tách được "ai phát hiện" thì mọi tranh luận "kit lọt nhiều hay ít" là cảm tính
 * (đã xảy ra thật: từng báo nhầm "bắt 8 / lọt 13" trong khi thực tế QA tìm toàn bộ).
 *
 * Máy này làm 2 việc:
 *   1) Đếm bug theo NGUỒN PHÁT HIỆN — dựa marker `[found-by-kit]` / `[found-by-human]` trong description
 *      (bug_reporter ghi khi log). Bug cũ chưa có marker → xếp vào "chưa phân loại" và nêu tên để gắn bù.
 *   2) Phân loại bug theo TRỤC PHÁT HIỆN — trục nào đang rò thì biết phải thêm máy nào:
 *        1 field    — thừa/thiếu/sai nhãn field, cột              → ui_conformance_check (spec→UI)
 *        2 surface  — cùng giá trị hiển thị khác nhau giữa các màn → cross_surface_diff (chưa có)
 *        3 persist  — form/payload đúng nhưng đọc lại mất giá trị  → persistence_probe (chưa có)
 *        4 branch   — nhánh/biến thể khác của cùng màn            → fixture matrix (chưa có)
 *        5 state    — trạng thái kế cận (sau hủy/hoàn/lost)        → fixture matrix (chưa có)
 *      Phân loại bằng từ khoá trên summary+description ⇒ là GỢI Ý, không phải phán quyết; dòng nào
 *      máy không chắc thì để "chưa rõ" cho người soi, KHÔNG đoán bừa.
 *
 * Dùng:
 *   node scripts/qa/leak_report.js --story TASK-24395 [--out <file.md>] [--json]
 * Env: BACKLOG_BASE_URL, BACKLOG_API_KEY, BACKLOG_PROJECT_KEY (đọc từ .env / task.env như các script Backlog khác).
 * Exit: 0 (báo cáo, không chặn).
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const STORY = arg('story', process.env.BACKLOG_STORY_KEY || '');
const TASK = arg('task', process.env.TASK_KEY || '');
const BASE = String(process.env.BACKLOG_BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.BACKLOG_API_KEY || '';

/*
 * Trục phát hiện: mỗi trục = một loại máy. Từ khoá lấy từ cách bug thật được mô tả trong task.
 *
 * `id`/`key`/`ten`/`may` PHẢI KHỚP `scripts/lib/expansion/axes.js` — nguồn duy nhất của danh mục trục
 * (v2.8.1). Ở đây KHÔNG sinh từ nguồn đó, và lý do là `rx`: nó phân loại VĂN BẢN BUG, thuộc việc của
 * `leak:report`, và đưa nó vào nguồn chung thì ba máy kia phải mang theo một thứ chúng không dùng.
 *
 * Đổi lại, có máy canh: `tests/fe/infra/expansion-gates.spec.ts` đối chiếu `key` và thứ tự của bảng này
 * với `axes.TRUC`. Hai bản sao KHÔNG có máy canh mới là chỗ trôi — đợt v2.8.0 đã trả giá năm lần.
 */
const AXES = [
  {
    id: 1,
    key: 'field',
    ten: 'Field/cột trên một màn',
    may: 'spec_extract + ui_conformance_check (spec → UI)',
    rx: /thiếu (?:trường|field|cột)|thừa (?:trường|field|cột)|không hiển thị field|hiển thị thêm field|sai tên cột|bộ cột|thiếu cột|đủ \d+ field|section .*thiếu|không có trường/i,
  },
  {
    id: 2,
    key: 'surface',
    ten: 'Cùng giá trị, khác nơi hiển thị',
    may: 'cross_surface_diff — npm run xsurf:diff',
    rx: /hai màn|2 màn|màn (?:khác|còn lại)|trong khi (?:màn|tab)|checkout .*(?:khác|sai)|tab đồng bộ|đồng bộ sang hệ ngoài|list .*detail|mâu thuẫn nhau/i,
  },
  {
    id: 3,
    key: 'persist',
    ten: 'Chuỗi lưu trữ form → payload → đọc lại',
    may: 'persistence_probe — npm run probe:persist',
    rx: /payload .*(?:nhưng|trong khi)|không lưu|lưu thành 0|đọc lại .*(?:0|null|rỗng)|trả về 0|backend .*không lưu|gửi lên .*nhưng/i,
  },
  {
    id: 4,
    key: 'branch',
    ten: 'Nhánh/biến thể khác của cùng màn',
    may: 'fixture_matrix — npm run fixture:matrix',
    rx: /phương pháp|method|loại phí|nhánh|option .*(?:thiếu|không)|trường hợp .*(?:fixed|percentage)|dropdown .*thiếu/i,
  },
  {
    id: 5,
    key: 'state',
    ten: 'Trạng thái kế cận (sau hủy/hoàn/lost)',
    may: 'fixture_matrix — npm run fixture:matrix',
    rx: /sau khi (?:hủy|huỷ|hoàn|thanh toán|xác nhận|edit)|đã hủy|cancel(?:led)? order|deal lost|trạng thái .*(?:không|vẫn)|guard|chặn .*trạng thái/i,
  },
  {
    id: 6,
    key: 'authz',
    ten: 'Phân quyền quanh case (dọc · ngang/IDOR · ẩn≠cấm)',
    may: 'authz_expand — npm run authz:expand',
    /*
     * ĐỐI CHỨNG khi viết mẫu này (13/10/2026) — bắt được: "tài khoản giáo viên vẫn vào được màn quản
     * trị", "ẩn nút Xoá nhưng gọi API vẫn xoá được", "xem được hồ sơ trường khác". KHÔNG bắt (đúng): "ô
     * Quyền sử dụng đất hiển thị sai" (chữ `quyền` trong tên field nghiệp vụ, không phải phân quyền) và
     * "phân bổ hạn mức tín dụng sai" (chuyện nghiệp vụ). Vì thế mẫu KHÔNG dò chữ `quyền` trần — nó đòi
     * một động từ truy cập đứng cùng, hoặc một từ khoá phân quyền rõ nghĩa.
     *
     * `401`/`403` phải chặn hai đầu bằng lookbehind/lookahead số: đối chứng âm bắt được "mã 4030 hiển
     * thị lệch" khớp vì `403` nằm TRONG `4030`. Một mã lỗi HTTP viết trần là mồi dương tính giả.
     */
    rx: /phân quyền|không có quyền|leo thang quyền|(?:vai trò|role|tài khoản) .*(?:vẫn (?:vào|xem|sửa|xoá|xóa)|truy cập được|không bị chặn)|ẩn .*(?:nhưng|mà) .*(?:vẫn|gọi|api)|(?<![0-9])(?:401|403)(?![0-9])|idor|xem được .*(?:của )?(?:người|đơn vị|trường|lớp|khách) khác/i,
  },
  {
    id: 7,
    key: 'oracle_calc',
    ten: 'Giá trị tính toán (tổng · ngưỡng · giá trị dẫn xuất)',
    may: 'oracle_calc_check — npm run oracle:calc',
    /*
     * ĐỐI CHỨNG khi viết mẫu (13/10/2026) — bắt được: "ô tổng không cộng lại khi sửa chi tiết", "sĩ số
     * 40 vượt ngưỡng 35 vẫn lưu được", "thành tiền tính sai", "làm tròn sai ở chữ số thứ hai". KHÔNG bắt
     * (đúng): "tổng đài hỗ trợ không phản hồi", "danh sách tổng hợp không mở được", "tổng quan hiển thị
     * chậm". Vì thế mẫu KHÔNG dò chữ `tổng` trần — `tổng đài`, `tổng hợp`, `tổng quan` đều là từ khác.
     */
    rx: /(?:tính|cộng|trừ|nhân|chia|làm tròn) (?:sai|lệch|nhầm|thiếu|thừa)|sai (?:công thức|phép tính)|ô tổng .*(?:không|sai|lệch)|tổng (?:không (?:khớp|cộng|bằng)|bị sai|sai)|vượt ngưỡng .*(?:vẫn|không bị)|(?:thành tiền|số tiền|điểm trung bình|sĩ số) .*(?:sai|lệch)/i,
  },
];

/*
 * NHÓM PHÂN LOẠI BUG THÊM — KHÔNG phải trục mở rộng.
 *
 * Hai nhóm này phân loại bug theo CƠ CHẾ gây ra nó, để đo rò theo hai mặt mà v2.8.4 vừa dựng máy.
 * Chúng KHÔNG nằm trong `axes.js`, và đó là cố ý: một nhóm phân loại trộn vào danh sách trục sẽ âm
 * thầm thổi phồng con số "N trục" ở `expansion_audit` và `self_review` — đúng thứ v2.8.1 vừa mất một
 * đợt để dọn. Máy canh `expansion-gates.spec.ts` đối chiếu `AXES` với `axes.khoaTruc()`, nên bảng này
 * phải đứng RIÊNG.
 */
const NHOM_THEM = [
  {
    id: 8,
    key: 'dua',
    ten: 'Đua / đồng thời (duyệt đúp · submit đúp · oversell · callback trùng)',
    may: 'concurrency_check — npm run concurrency:check',
    /*
     * ĐỐI CHỨNG khi viết mẫu (14/10/2026) — bắt: "duyệt hai lần cùng lúc ra hai bản ghi", "bấm submit
     * đúp tạo 2 đơn", "trừ kho song song xuống âm", "callback gửi lại cộng tiền hai lần", "thiếu
     * idempotency-key nên tạo trùng". KHÔNG bắt (đúng): "đơn đã duyệt không sửa được" (luật trạng thái,
     * không phải đua), "tổng cộng sai công thức" (⑦), "cộng dồn điểm sai".
     * Vì thế mẫu KHÔNG dò chữ `cộng` trần — nó là động từ của mọi phép tính.
     */
    rx: /(?:đua|tranh chấp|đồng thời|song song|duyệt (?:hai|2) lần|submit (?:đúp|hai lần)|trùng (?:bản ghi|đơn)|idempoten|race|oversell|gửi lại .{0,20}(?:cộng|tạo|hai lần)|cộng .{0,12}(?:đôi|hai lần)|kho .{0,10}âm)/i,
  },
  {
    id: 9,
    key: 'phien_token',
    ten: 'Phiên / token (logout · hết hạn · JWT)',
    may: 'security_check — npm run security:check',
    /*
     * ĐỐI CHỨNG — bắt: "token sau logout vẫn gọi được API", "token hết hạn vẫn được chấp nhận", "JWT đổi
     * role không ký lại vẫn qua", "alg=none được chấp nhận", "phiên cũ không bị vô hiệu", "chữ ký sai vẫn
     * được nhận". KHÔNG bắt (đúng): "mã token hàng hoá hiển thị sai" — `token` ở đây là từ nghiệp vụ, và
     * "chữ ký số của hiệu trưởng hiển thị" — `chữ ký` cũng vậy.
     * Vì thế `token` chỉ tính khi đứng cạnh một từ về trạng thái phiên, không tính khi đứng trần.
     */
    rx: /(?:phiên|session|logout|đăng xuất|jwt|alg=none|chữ ký (?:sai|không)|cookie .{0,20}(?:httponly|secure))|token (?:sau|cũ|hết hạn|vẫn|còn|bị|không|đã)|(?:hết hạn|thu hồi|vô hiệu) .{0,15}token/i,
  },
];


function apiUrl(pathname, params = {}) {
  const url = new URL(BASE + pathname);
  url.searchParams.set('apiKey', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(`${key}[]`, v));
    else url.searchParams.set(key, value);
  }
  return url;
}

async function backlog(pathname, params) {
  const res = await fetch(apiUrl(pathname, params));
  if (!res.ok) throw new Error(`Backlog ${res.status} ${pathname.slice(0, 80)}`);
  return res.json();
}

function classify(text) {
  const hits = [...AXES, ...NHOM_THEM].filter((a) => a.rx.test(text));
  return hits.length ? hits : [];
}

(async () => {
  if (!STORY) { console.error('[leak-report] thiếu --story <BACKLOG_STORY_KEY> (hoặc env BACKLOG_STORY_KEY).'); process.exit(2); }
  if (!BASE || !API_KEY) { console.error('[leak-report] thiếu BACKLOG_BASE_URL / BACKLOG_API_KEY.'); process.exit(2); }

  const story = await backlog(`/api/v2/issues/${encodeURIComponent(STORY)}`);
  if (!story?.id) { console.error(`[leak-report] không tìm thấy story: ${STORY}`); process.exit(2); }
  const issues = await backlog('/api/v2/issues', { projectId: [story.projectId], parentIssueId: [story.id], count: 100 });

  const rows = issues.map((i) => {
    const desc = i.description || '';
    const text = `${i.summary || ''} || ${desc}`;
    const source = desc.includes('[found-by-kit]') ? 'kit'
      : desc.includes('[found-by-human]') ? 'human'
        : 'chưa phân loại';
    return {
      key: i.issueKey,
      status: (i.status || {}).name || '',
      summary: (i.summary || '').slice(0, 120),
      source,
      axes: classify(text).map((a) => a.key),
    };
  });

  // ĐÓNG VÒNG (luật ở prompt_templates/phase3/02_execute_fe_playwright.md): mỗi bug do NGƯỜI ngoài tìm ra mà kit
  // chạy xanh đều phải trả lời "máy nào lẽ ra bắt được?". Không có máy ⇒ đó là trục chưa phủ, phải xây thêm.
  // Bản đồ bug → máy nằm ở `knowledge/leak_machine_map.json` (tuỳ chọn); thiếu bản đồ thì suy từ trục.
  const mapPath = path.join(rc.REPO_ROOT, 'knowledge', 'leak_machine_map.json');
  const machineMap = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  const humanFound = rows.filter((r) => /human/.test(r.source));
  for (const r of rows) {
    const m = machineMap[r.key];
    r.machine = m && (typeof m === 'string' ? m : m.machine) ? (typeof m === 'string' ? m : m.machine) : null;
    // Không có bản đồ tay thì máy suy ra từ trục đã phân loại — vẫn là GỢI Ý, không phải phán quyết.
    r.machineGuess = r.machine || (r.axes.length ? [...AXES, ...NHOM_THEM].filter((a) => r.axes.includes(a.key)).map((a) => a.may).join(' · ') : null);
  }
  const noMachine = humanFound.filter((r) => !r.machineGuess);

  const bySource = rows.reduce((m, r) => { m[r.source] = (m[r.source] || 0) + 1; return m; }, {});
  const byAxis = [...AXES, ...NHOM_THEM].map((a) => ({ ...a, n: rows.filter((r) => r.axes.includes(a.key)).length }));
  const unclassified = rows.filter((r) => !r.axes.length);
  const needLabel = rows.filter((r) => r.source === 'chưa phân loại');
  if (process.argv.includes('--require-machine')) {
    console.log(`[leak] ĐÓNG VÒNG: ${humanFound.length} bug do NGƯỜI tìm · ${humanFound.length - noMachine.length} đã có máy tương ứng · ${noMachine.length} CHƯA gán được máy`);
    for (const r of noMachine) console.log(`[leak] ✗ ${r.key}: chưa chỉ ra được máy lẽ ra bắt được — ${r.summary.slice(0, 80)}`);
    if (noMachine.length) {
      console.log('[leak]   Xử lý: gán máy vào `knowledge/leak_machine_map.json` ({"<KEY>-<số>": {"machine": "...", "why": "..."}})');
      console.log('[leak]   hoặc nếu THẬT SỰ chưa có máy nào phủ trục đó ⇒ ghi đề xuất máy mới vào reports/ (đừng để trống).');
    }
  }

  const L = [];
  L.push(`# Leak report — ${STORY}${TASK ? ` (task ${TASK})` : ''}`);
  L.push('');
  L.push(`Tổng bug dưới story: **${rows.length}**`);
  L.push('');
  L.push('## 1. Nguồn phát hiện (ai TÌM ra, không phải ai log)');
  L.push('');
  L.push('| Nguồn | Số bug |');
  L.push('|---|---|');
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`| ${k} | ${v} |`));
  L.push('');
  if (needLabel.length) {
    L.push(`> ${needLabel.length} bug **chưa có đánh dấu nguồn** → tỉ lệ rò chưa đo được chính xác. Từ nay log bug kèm \`--found-by kit|human\`; bug cũ gắn bù bằng tay nếu cần số liệu lịch sử.`);
    L.push('');
  }
  L.push('## 2. Trục phát hiện — trục nào đang rò thì thiếu máy đó');
  L.push('');
  L.push('| # | Trục | Máy tương ứng | Số bug khớp |');
  L.push('|---|---|---|---|');
  byAxis.forEach((a) => L.push(`| ${a.id} | ${a.ten} | ${a.may} | ${a.n} |`));
  L.push('');
  L.push(`Không khớp trục nào (cần người soi): **${unclassified.length}**`);
  L.push('');
  L.push('> Phân loại bằng từ khoá ⇒ là **gợi ý để biết nên xây máy nào trước**, không phải phán quyết. Một bug có thể khớp nhiều trục.');
  L.push('');
  L.push('## 3. Chi tiết');
  L.push('');
  L.push('| Key | Trạng thái | Nguồn | Trục | Tiêu đề |');
  L.push('|---|---|---|---|---|');
  rows.forEach((r) => L.push(`| ${r.key} | ${r.status} | ${r.source} | ${r.axes.join(', ') || '—'} | ${r.summary.replace(/\|/g, '\\|')} |`));
  const md = L.join('\n') + '\n';

  const out = arg('out', '');
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(rc.REPO_ROOT, out)), { recursive: true });
    fs.writeFileSync(path.resolve(rc.REPO_ROOT, out), md, 'utf8');
    console.log(`[leak-report] đã ghi: ${out}`);
  }
  if (has('json')) console.log(JSON.stringify({ story: STORY, total: rows.length, bySource, byAxis: byAxis.map(({ id, key, ten, may, n }) => ({ id, key, ten, may, n })), rows }, null, 2));
  else if (!out) console.log(md);
  else {
    console.log(`\nNguồn phát hiện: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(' | ')}`);
    console.log(`Trục: ${byAxis.map((a) => `${a.key}=${a.n}`).join(' | ')} | không khớp=${unclassified.length}`);
  }
})().catch((e) => { console.error('[leak-report] lỗi:', e.message); process.exit(1); });
