#!/usr/bin/env node
'use strict';

/*
 * doc_issue.js — ĐỌC một issue trên Backlog (chỉ GET, không sửa gì).
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/doc_issue.js CSDL-3884
 *
 * Vì sao cần: trước khi `--update-issue`, bộ chạy gửi LẠI `summary`, tức có thể ĐỔI TIÊU ĐỀ bug.
 * Muốn giữ nguyên tiêu đề thì phải biết tiêu đề hiện tại là gì — và đoán từ tên test là đoán, không
 * phải đo. Script này in ra tiêu đề + danh sách tệp đính kèm + độ dài mô tả.
 *
 * KHÔNG in apiKey. KHÔNG ghi gì ra đĩa.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = process.env.BACKLOG_API_KEY || '';
const ID = process.argv[2];

if (!BASE || !KEY) { console.error('[doc-issue] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY (nạp TASK_ENV)'); process.exit(2); }
if (!ID) { console.error('[doc-issue] ✗ thiếu mã issue, vd CSDL-3884'); process.exit(2); }

(async () => {
  const r = await fetch(`${BASE}/api/v2/issues/${encodeURIComponent(ID)}?apiKey=${encodeURIComponent(KEY)}`);
  if (!r.ok) { console.error(`[doc-issue] ✗ HTTP ${r.status} khi đọc ${ID}`); process.exit(3); }
  const j = await r.json();
  console.log(`[doc-issue] ${ID}`);
  console.log(`  TIÊU ĐỀ: ${JSON.stringify(j.summary)}`);
  console.log(`  Loại: ${j.issueType && j.issueType.name} · Ưu tiên: ${j.priority && j.priority.name} · Trạng thái: ${j.status && j.status.name}`);
  console.log(`  Cha: ${j.parentIssueId || '(không có)'} · Người nhận: ${j.assignee ? j.assignee.name : '(trống)'}`);
  console.log(`  Mô tả: ${String(j.description || '').length} ký tự`);
  const att = j.attachments || [];
  console.log(`  Đính kèm (${att.length}): ${att.map((a) => a.name).join(', ') || '(không có)'}`);
  const nhung = String(j.description || '').match(/!\[image\]\[[^\]]+\]/g) || [];
  console.log(`  Dòng nhúng ảnh (${nhung.length}): ${nhung.join(' ') || '(không có)'}`);
})().catch((e) => { console.error('[doc-issue] ✗', e.message); process.exit(1); });
