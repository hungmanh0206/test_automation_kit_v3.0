#!/usr/bin/env node
/**
 * doc_trang_thai_va_nguoi.js — đọc danh sách TRẠNG THÁI và NGƯỜI DÙNG của một project Backlog.
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/doc_trang_thai_va_nguoi.js CSDL [chuỗi lọc người]
 *
 * Vì sao cần: đổi status hay assignee đều phải gửi ID SỐ, không gửi tên. Đoán ID là cách nhanh nhất
 * để đẩy một issue sang trạng thái sai mà không ai biết. Script này CHỈ GET, in ra để đối chiếu tên
 * trước khi ghi.
 *
 * KHÔNG in apiKey. KHÔNG ghi gì ra đĩa.
 */
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
/* Nạp `TASK_ENV` như các script anh em — thiếu dòng này thì biến môi trường không tới nơi. */
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.BACKLOG_API_KEY || '');
const DUAN = process.argv[2] || 'CSDL';
const LOC = String(process.argv[3] || '').toLowerCase();

if (!BASE || !KEY) {
  console.error('[doc-tt] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY (nạp TASK_ENV)');
  process.exit(2);
}

const lay = async (duong) => {
  const r = await fetch(`${BASE}/api/v2/${duong}${duong.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(KEY)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
  return r.json();
};

(async () => {
  const tt = await lay(`projects/${encodeURIComponent(DUAN)}/statuses`);
  console.log(`[doc-tt] TRẠNG THÁI của project ${DUAN} (${tt.length}):`);
  for (const x of tt) console.log(`[doc-tt]    id=${String(x.id).padEnd(8)} "${x.name}"`);

  const ng = await lay(`projects/${encodeURIComponent(DUAN)}/users`);
  const loc = LOC ? ng.filter((x) => `${x.name} ${x.userId || ''}`.toLowerCase().includes(LOC)) : ng;
  console.log('');
  console.log(`[doc-tt] NGƯỜI DÙNG${LOC ? ` khớp "${LOC}"` : ''} (${loc.length}/${ng.length}):`);
  for (const x of loc) console.log(`[doc-tt]    id=${String(x.id).padEnd(8)} "${x.name}"${x.userId ? ` · userId=${x.userId}` : ''}`);
  if (LOC && !loc.length) {
    console.log('[doc-tt]    (không ai khớp — in 40 tên đầu để đối chiếu)');
    for (const x of ng.slice(0, 40)) console.log(`[doc-tt]    id=${String(x.id).padEnd(8)} "${x.name}"`);
  }
})().catch((e) => { console.error(`[doc-tt] ✗ ${e.message}`); process.exit(1); });
