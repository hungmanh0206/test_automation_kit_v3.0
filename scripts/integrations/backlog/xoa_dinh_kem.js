#!/usr/bin/env node
'use strict';

/*
 * xoa_dinh_kem.js — xoá TỆP ĐÍNH KÈM thừa khỏi một issue Backlog.
 *
 *   node scripts/integrations/backlog/xoa_dinh_kem.js --issue CSDL-3922 --id 4907878 --id 4907879
 *   ... thêm --that-su để xoá thật (mặc định chỉ IN RA, không đụng gì).
 *
 * ⚠️ XOÁ KHÔNG HOÀN LẠI. Vì vậy:
 *   · mặc định là chế độ xem trước — phải truyền `--that-su` mới gọi DELETE;
 *   · chỉ xoá đúng các `--id` được nêu, không có chế độ "xoá hết";
 *   · TỪ CHỐI xoá tệp đang được NHÚNG trong description (`![image][tên]`), vì xoá nó là làm hỏng
 *     chính phần bằng chứng của bug. Muốn xoá thì sửa description trước.
 *
 * Khác với việc xoá ISSUE: issue thừa thì để lại và ghi đè (xem memory `feedback-khong-xoa-bug-backlog`).
 * Đây chỉ là dọn ẢNH CŨ/HỎNG đã bị thay bằng bản mới.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = process.env.BACKLOG_API_KEY || '';
const argv = process.argv.slice(2);
const ISSUE = (() => { const i = argv.indexOf('--issue'); return i >= 0 ? argv[i + 1] : ''; })();
const IDS = argv.reduce((a, x, i) => (x === '--id' && argv[i + 1] ? a.concat(String(argv[i + 1])) : a), []);
const THAT_SU = argv.includes('--that-su');

if (!BASE || !KEY) { console.error('[xoá] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY'); process.exit(2); }
if (!ISSUE || !IDS.length) { console.error('[xoá] ✗ cần --issue <MÃ> và ít nhất một --id <ID>'); process.exit(2); }

(async () => {
  const qs = `apiKey=${encodeURIComponent(KEY)}`;
  const ri = await fetch(`${BASE}/api/v2/issues/${encodeURIComponent(ISSUE)}?${qs}`);
  if (!ri.ok) { console.error(`[xoá] ✗ không đọc được ${ISSUE}: HTTP ${ri.status}`); process.exit(3); }
  const issue = await ri.json();
  const moTa = String(issue.description || '');
  const dangNhung = new Set((moTa.match(/!\[image\]\[([^\]]+)\]/g) || [])
    .map((s) => s.replace(/^!\[image\]\[/, '').replace(/\]$/, '')));

  const ra = await fetch(`${BASE}/api/v2/issues/${encodeURIComponent(ISSUE)}/attachments?${qs}`);
  const att = await ra.json();
  const theoId = new Map(att.map((a) => [String(a.id), a]));

  console.log(`[xoá] ${ISSUE} — đang có ${att.length} tệp · ${dangNhung.size} tệp đang được nhúng trong mô tả`);
  const canXoa = [];
  for (const id of IDS) {
    const a = theoId.get(String(id));
    if (!a) { console.log(`   ✗ id=${id} không có trên issue này — bỏ qua`); continue; }
    if (dangNhung.has(a.name)) { console.log(`   ✗ id=${id} "${a.name}" ĐANG ĐƯỢC NHÚNG — từ chối xoá`); continue; }
    console.log(`   ${THAT_SU ? '→ xoá' : '· sẽ xoá'} id=${id} ${String(a.size).padStart(8)} B  ${a.name}`);
    canXoa.push(a);
  }
  if (!THAT_SU) { console.log('[xoá] CHẾ ĐỘ XEM TRƯỚC — thêm `--that-su` để xoá thật.'); return; }
  let xong = 0;
  for (const a of canXoa) {
    const r = await fetch(`${BASE}/api/v2/issues/${encodeURIComponent(ISSUE)}/attachments/${a.id}?${qs}`, { method: 'DELETE' });
    if (r.ok) { xong += 1; } else { console.log(`   ✗ xoá id=${a.id} trượt: HTTP ${r.status}`); }
  }
  console.log(`[xoá] đã xoá ${xong}/${canXoa.length} tệp khỏi ${ISSUE}`);
})().catch((e) => { console.error('[xoá] ✗', e.message); process.exit(1); });
