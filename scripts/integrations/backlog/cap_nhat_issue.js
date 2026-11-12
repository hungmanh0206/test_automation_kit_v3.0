#!/usr/bin/env node
/**
 * cap_nhat_issue.js — đổi TRẠNG THÁI / NGƯỜI NHẬN của một issue và đăng COMMENT kèm ảnh.
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/cap_nhat_issue.js \
 *     --issue TASK-3884 --status-id 24137 --assignee-id 813044 \
 *     --comment-file <đường dẫn .md> --anh <đường dẫn ảnh> [--dry-run]
 *
 * VÌ SAO ẢNH ĐI THEO COMMENT, KHÔNG ĐI THEO PATCH ISSUE.
 * `bug_reporter.js` đã ghi lại: `attachmentId[]` trên PATCH issue được cho là THAY THẾ toàn bộ set
 * đính kèm hiện có, không cộng dồn. Issue đang nghiệm thu có sẵn ảnh, và phần Mô tả đang NHÚNG một
 * trong số đó — ghi đè là làm vỡ ảnh trong mô tả của chính bug. Đính vào comment thì ảnh thuộc về
 * comment, set đính kèm của issue không bị chạm tới.
 *
 * Thứ tự cố ý: upload ảnh → đăng comment → mới PATCH status/assignee. Nếu comment hỏng thì issue
 * chưa bị đổi trạng thái, nhìn vào vẫn biết việc chưa xong. Đổi trạng thái trước rồi comment hỏng
 * sẽ để lại một issue "đã nghiệm thu" mà không có bằng chứng nào.
 *
 * KHÔNG in apiKey.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.BACKLOG_API_KEY || '');

const arg = (t, m) => {
  const i = process.argv.indexOf(`--${t}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : m;
};
const co = (t) => process.argv.includes(`--${t}`);

const ISSUE = arg('issue', '');
const STATUS = arg('status-id', '');
const ASSIGNEE = arg('assignee-id', '');
const FILE_CMT = arg('comment-file', '');
const ANH = arg('anh', '');
const THU = co('dry-run');

if (!BASE || !KEY) { console.error('[cap-nhat] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY (nạp TASK_ENV)'); process.exit(2); }
if (!ISSUE) { console.error('[cap-nhat] ✗ thiếu --issue'); process.exit(2); }

const url = (duong) => `${BASE}/api/v2/${duong}${duong.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(KEY)}`;

async function goi(method, duong, body) {
  const opt = { method };
  if (body instanceof FormData) opt.body = body;
  else if (body) { opt.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }; opt.body = body; }
  const r = await fetch(url(duong), opt);
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} · ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
}

(async () => {
  /* Đọc trạng thái hiện tại TRƯỚC khi đổi — để in ra "từ gì sang gì", và để biết có đổi nhầm issue không. */
  const truoc = await goi('GET', `issues/${encodeURIComponent(ISSUE)}`);
  console.log(`[cap-nhat] ${ISSUE} — "${truoc.summary}"`);
  console.log(`[cap-nhat]   hiện tại: trạng thái "${truoc.status?.name}" (id ${truoc.status?.id}) · người nhận "${truoc.assignee?.name || '(trống)'}" (id ${truoc.assignee?.id || '-'})`);
  console.log(`[cap-nhat]   đính kèm đang có (${(truoc.attachments || []).length}): ${(truoc.attachments || []).map((x) => x.name).join(', ') || '(không có)'}`);

  let noiDung = FILE_CMT ? fs.readFileSync(path.resolve(REPO, FILE_CMT), 'utf8') : '';
  const anhDay = ANH ? path.resolve(REPO, ANH) : '';
  if (anhDay && !fs.existsSync(anhDay)) { console.error(`[cap-nhat] ✗ không thấy ảnh: ${anhDay}`); process.exit(2); }

  if (THU) {
    console.log('');
    console.log('[cap-nhat] ===== XEM TRƯỚC (chưa ghi gì) =====');
    if (STATUS) console.log(`[cap-nhat] sẽ đổi trạng thái → id ${STATUS}`);
    if (ASSIGNEE) console.log(`[cap-nhat] sẽ đổi người nhận → id ${ASSIGNEE}`);
    if (anhDay) console.log(`[cap-nhat] sẽ tải ảnh lên: ${path.basename(anhDay)} (${fs.statSync(anhDay).size} byte)`);
    console.log('[cap-nhat] nội dung comment:');
    console.log(noiDung.split('\n').map((l) => `  | ${l}`).join('\n'));
    return;
  }

  /* 1. Ảnh lên trước — có id rồi mới nhúng vào comment. */
  let anhTen = '';
  if (anhDay) {
    const form = new FormData();
    form.append('file', await fs.openAsBlob(anhDay), path.basename(anhDay));
    const up = await goi('POST', 'space/attachment', form);
    anhTen = String(up.name || path.basename(anhDay));
    console.log(`[cap-nhat] đã tải ảnh lên: id=${up.id} · tên Backlog lưu: "${anhTen}"`);
    /* Nhúng theo TÊN BACKLOG THỰC LƯU, không theo tên local: Backlog đổi tên khi trùng, nhúng theo
       tên lệch thì description hiện mã thô thay vì ảnh. */
    noiDung = noiDung.replace(/!\[image\]\[[^\]]*\]/g, `![image][${anhTen}]`);
    var anhId = up.id;
  }

  /* 2. Comment trước, status sau — xem ghi chú đầu tệp. */
  const p = new URLSearchParams();
  p.set('content', noiDung);
  if (typeof anhId !== 'undefined') p.append('attachmentId[]', String(anhId));
  const cmt = await goi('POST', `issues/${encodeURIComponent(ISSUE)}/comments`, p.toString());
  /*
   * Response của POST comment KHÔNG trả mảng `attachments`, nên đừng in nó ra như thể đó là sự thật:
   * bản trước in "đính kèm trong comment: (không có)" kể cả khi ảnh đã đính THÀNH CÔNG, và dòng đó
   * làm người đọc tưởng upload hỏng (đã cắn 02/11 ở TASK-4043 — kiểm lại bằng `doc_comment.js` thì
   * ảnh nằm đúng chỗ). Chỉ khai những gì gửi đi; muốn biết thật thì đọc lại bằng `doc_comment.js`.
   */
  console.log(`[cap-nhat] đã đăng comment id=${cmt.id}`
    + `${typeof anhId !== 'undefined' ? ` · đã gửi kèm attachmentId ${anhId} ("${anhTen}") — xác nhận bằng: doc_comment.js ${ISSUE}` : ' · không gửi kèm ảnh'}`);

  /* 3. Đổi trạng thái và người nhận. */
  /*
   * GỠ người nhận cần cờ RIÊNG. `--assignee-id ""` là chuỗi rỗng ⇒ falsy ⇒ bị bỏ qua, còn
   * `--assignee-id 0` thì Backlog trả 404 "No such user. (id:Undefined)". Backlog chỉ gỡ khi nhận
   * `assigneeId=` rỗng, nên phải nói ý định ra bằng một cờ thay vì đoán từ giá trị.
   * Cờ này KHÔNG đổi hành vi cũ: không truyền thì mọi thứ chạy y như trước.
   */
  const GO_ASSIGNEE = process.argv.includes('--go-assignee');
  if (STATUS || ASSIGNEE || GO_ASSIGNEE) {
    const q = new URLSearchParams();
    if (STATUS) q.set('statusId', STATUS);
    if (GO_ASSIGNEE) q.set('assigneeId', '');
    else if (ASSIGNEE) q.set('assigneeId', ASSIGNEE);
    const sau = await goi('PATCH', `issues/${encodeURIComponent(ISSUE)}`, q.toString());
    console.log(`[cap-nhat] đã đổi: trạng thái "${truoc.status?.name}" → "${sau.status?.name}" · người nhận "${truoc.assignee?.name || '(trống)'}" → "${sau.assignee?.name || '(trống)'}"`);
    console.log(`[cap-nhat] đính kèm của issue sau khi đổi (${(sau.attachments || []).length}): ${(sau.attachments || []).map((x) => x.name).join(', ') || '(không có)'}`);
  }
  console.log(`[cap-nhat] xong → ${BASE}/view/${ISSUE}`);
})().catch((e) => { console.error(`[cap-nhat] ✗ ${e.message}`); process.exit(1); });
