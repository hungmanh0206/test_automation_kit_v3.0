#!/usr/bin/env node
'use strict';

/*
 * task_hien_tai.js — XÁC ĐỊNH TASK_KEY cho một lượt chạy slash command.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VẤN ĐỀ: 13 slash command đều nhận `$ARGUMENTS` làm mã task. Gõ `/phase3` mà quên mã thì `$ARGUMENTS`
 * rỗng, lệnh bên dưới chạy với `--task ` trống, và chỗ hỏng lộ ra ở một gate nào đó phía sau với thông
 * điệp chẳng liên quan. Tệ hơn: agent dễ tự điền mã task của lượt trước trong cùng cuộc hội thoại.
 *
 * CLAUDE.md §5 cấm thẳng chuyện đó: "Không suy `TASK_KEY` từ context cũ". Lý do không phải hình thức —
 * `.auth/` và UAT dùng chung giữa các task, nên chạy nhầm mã nghĩa là ghi kết quả của task này vào
 * thư mục task khác, hoặc đổi đơn vị đăng nhập của người đang làm việc.
 *
 * NÊN FILE NÀY KHÔNG BAO GIỜ ĐOÁN. Nó chỉ trả lời được khi câu trả lời là HIỂN NHIÊN:
 *   · có tham số       → kiểm profile tồn tại rồi trả về chính nó;
 *   · đúng 1 profile   → trả về cái đó (và nói rõ vì sao chọn được);
 *   · nhiều profile    → IN DANH SÁCH rồi thoát 2 = KHÔNG PHÁN ĐƯỢC, để người chọn;
 *   · không profile nào → chỉ sang `/start`.
 *
 * Mã thoát 2 cố ý KHÁC 1: 1 là "đã đo và sai", 2 là "chưa đủ căn cứ để phán" — cùng quy ước với các
 * gate khác của kit.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * DÙNG:  node scripts/utils/task_hien_tai.js [TASK_KEY]      (npm: `npm run task:which -- [TASK_KEY]`)
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const THU_MUC = path.join(REPO, 'profiles');
const XIN = String(process.argv[2] || '').trim();

/** Profile HỢP LỆ = thư mục con có `task.env`. Thư mục rỗng không tính là task đã tạo. */
function danhSachProfile() {
  let ds = [];
  try { ds = fs.readdirSync(THU_MUC, { withFileTypes: true }); } catch (e) { return []; }
  return ds
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((ten) => fs.existsSync(path.join(THU_MUC, ten, 'task.env')))
    .map((ten) => {
      let m = 0;
      try { m = fs.statSync(path.join(THU_MUC, ten, 'task.env')).mtimeMs; } catch (e) { /* bỏ qua */ }
      return { ten, m };
    })
    .sort((a, b) => b.m - a.m);
}

const ds = danhSachProfile();
const ngay = (m) => (m ? new Date(m).toISOString().slice(0, 10) : '—');

// ── Có tham số: KIỂM, không tin ngay ────────────────────────────────────────────────────────────────
if (XIN) {
  if (ds.some((x) => x.ten === XIN)) {
    process.stdout.write(`${XIN}\n`);
    process.exit(0);
  }
  console.error(`[task] ✗ "${XIN}" chưa có profile (\`profiles/${XIN}/task.env\` không tồn tại).`);
  if (ds.length) console.error(`      Đang có: ${ds.map((x) => x.ten).join(' · ')}`);
  console.error('      Gõ đúng mã, hoặc chạy `/start` để tạo profile mới. KHÔNG mượn profile của task khác.');
  process.exit(2);
}

// ── Không tham số ───────────────────────────────────────────────────────────────────────────────────
if (ds.length === 0) {
  console.error('[task] ✗ Chưa có profile nào trong `profiles/`.');
  console.error('      Chạy `/start` để tạo — nó hỏi 5 điều rồi dựng profile + chạy preflight.');
  process.exit(2);
}

if (ds.length === 1) {
  console.error(`[task] chỉ có MỘT profile nên chọn được không cần hỏi: ${ds[0].ten}`);
  process.stdout.write(`${ds[0].ten}\n`);
  process.exit(0);
}

/*
 * NHIỀU PROFILE ⇒ KHÔNG PHÁN ĐƯỢC. Cố ý không chọn "cái mới sửa gần nhất": mtime chỉ nói file nào
 * vừa bị chạm, không nói người dùng đang muốn làm task nào. Đoán đúng 4/5 lần vẫn là một lần ghi
 * kết quả vào nhầm task.
 */
console.error(`[task] ✗ KHÔNG PHÁN ĐƯỢC: có ${ds.length} profile, lệnh không kèm mã task.`);
console.error('      Chạy lại kèm mã, ví dụ `/phase3 CSDL-9001`. Danh sách (mới sửa xếp trước):');
for (const x of ds) console.error(`        - ${x.ten}  (task.env sửa ${ngay(x.m)})`);
console.error('      KHÔNG lấy mã của lượt trước trong cùng cuộc hội thoại — CLAUDE.md §5.');
process.exit(2);
