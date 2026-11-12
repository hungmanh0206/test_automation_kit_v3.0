#!/usr/bin/env node
'use strict';

/*
 * sua_mo_ta.js — thay NGUYÊN phần Mô tả của một issue Backlog bằng nội dung một file.
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/sua_mo_ta.js \
 *     --issue TASK-3950 --mo-ta-file <đường dẫn .md|.txt> [--dry-run]
 *
 * VÌ SAO CẦN RIÊNG MỘT SCRIPT. Ba đường ghi đang có đều không làm an toàn được việc này:
 *   · `cap_nhat_issue.js` chỉ đổi status, assignee, comment. Nó không chạm mô tả.
 *   · `go_trailer_bug.js` có PATCH mô tả, nhưng chỉ để gỡ hai dòng trailer. Không thay tự do được.
 *   · `bug_reporter.js --update-issue` gửi kèm `summary`, tức có thể đổi tiêu đề bug.
 *     Chủ dự án đã cấm chuyện đó.
 *
 * HAI THỨ SCRIPT NÀY CỐ Ý KHÔNG GỬI:
 *   · `summary`. Không bao giờ gửi, để tiêu đề không thể bị đổi ngoài ý muốn.
 *   · `attachmentId[]`. Gửi nó là THAY THẾ cả set đính kèm hiện có. Ảnh đang nhúng trong mô tả sẽ vỡ.
 *
 * In độ dài mô tả CŨ và MỚI để thấy ngay mình vừa cắt mất bao nhiêu. Thay nhầm một file rỗng mà
 * không nhìn con số thì issue mất sạch nội dung, và không có gì báo.
 *
 * KHÔNG in apiKey. `--dry-run` in payload rồi dừng, không gọi API ghi.
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
const ISSUE = arg('issue', '');
const FILE = arg('mo-ta-file', '');
const THU = process.argv.includes('--dry-run');

if (!BASE || !KEY) { console.error('[sua-mo-ta] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY (nạp TASK_ENV)'); process.exit(2); }
if (!ISSUE) { console.error('[sua-mo-ta] ✗ thiếu --issue'); process.exit(2); }
if (!FILE) { console.error('[sua-mo-ta] ✗ thiếu --mo-ta-file'); process.exit(2); }
if (!fs.existsSync(FILE)) { console.error(`[sua-mo-ta] ✗ không thấy file: ${FILE}`); process.exit(2); }

const MOI = fs.readFileSync(FILE, 'utf8').trim();
if (!MOI) { console.error('[sua-mo-ta] ✗ file mô tả RỖNG — từ chối ghi, nếu không issue sẽ mất sạch nội dung'); process.exit(2); }

async function api(method, duongDan, form) {
  const u = new URL(`${BASE}${duongDan}`);
  u.searchParams.set('apiKey', KEY);
  const opt = { method, headers: {} };
  if (form) {
    opt.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opt.body = new URLSearchParams(form).toString();
  }
  const r = await fetch(u, opt);
  const chu = await r.text();
  if (!r.ok) throw new Error(`${method} ${duongDan} → HTTP ${r.status}: ${chu.slice(0, 300)}`);
  return JSON.parse(chu);
}

(async () => {
  const cu = await api('GET', `/api/v2/issues/${ISSUE}`);
  const moTaCu = String(cu.description || '');
  console.log(`[sua-mo-ta] ${ISSUE} — "${cu.summary}"`);
  console.log(`[sua-mo-ta]   trạng thái "${cu.status?.name}" · đính kèm đang có: ${(cu.attachments || []).length}`);
  console.log(`[sua-mo-ta]   mô tả CŨ ${moTaCu.length} ký tự → MỚI ${MOI.length} ký tự `
    + `(${MOI.length - moTaCu.length >= 0 ? '+' : ''}${MOI.length - moTaCu.length})`);

  /*
   * Cảnh báo khi mô tả mới nhúng ảnh mà issue không còn đính kèm tên đó. Viết lại mô tả là chỗ dễ
   * làm vỡ ảnh nhất. Cú pháp `![image][tên.png]` chỉ hiện được khi tệp cùng tên còn trong issue.
   */
  const ten = new Set((cu.attachments || []).map((a) => String(a.name)));
  const nhung = [...MOI.matchAll(/!\[[^\]]*\]\[([^\]]+)\]/g)].map((m) => m[1]);
  const thieu = nhung.filter((n) => !ten.has(n));
  if (thieu.length) console.log(`[sua-mo-ta]   ⚠ mô tả mới nhúng ảnh KHÔNG có trong đính kèm: ${thieu.join(' · ')}`);

  if (THU) {
    console.log('\n[sua-mo-ta] ===== XEM TRƯỚC (chưa ghi gì) =====');
    MOI.split('\n').forEach((d) => console.log(`  | ${d}`));
    return;
  }

  await api('PATCH', `/api/v2/issues/${ISSUE}`, { description: MOI });
  const lai = await api('GET', `/api/v2/issues/${ISSUE}`);
  console.log(`[sua-mo-ta] đã ghi · đọc lại từ máy chủ: ${String(lai.description || '').length} ký tự`);
  console.log(`[sua-mo-ta]   tiêu đề sau khi ghi: "${lai.summary}"`);
  console.log(`[sua-mo-ta]   đính kèm sau khi ghi (${(lai.attachments || []).length}): `
    + `${(lai.attachments || []).map((a) => a.name).join(', ') || '(không có)'}`);
  console.log(`[sua-mo-ta] xong → ${BASE}/view/${ISSUE}`);
})().catch((e) => { console.error(`[sua-mo-ta] ✗ ${e.message}`); process.exit(1); });
