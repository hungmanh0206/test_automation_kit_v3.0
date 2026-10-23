#!/usr/bin/env node
'use strict';

/*
 * doc_quy_tac_chu.js — đọc `textFormattingRule` của project trên Backlog (chỉ GET).
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/doc_quy_tac_chu.js CSDL
 *
 * Vì sao cần: `bug_reporter` nhúng ảnh theo hai cú pháp khác nhau — `![image][tên]` cho project đặt
 * chế độ markdown, `#image(tên)` cho chế độ backlog. Sai cờ thì description hiện ra MÃ THÔ chứ không
 * ra ảnh. Reporter báo "chưa đọc được textFormattingRule" rồi đoán markdown; script này đo thật.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = process.env.BACKLOG_API_KEY || '';
const DU_AN = process.argv[2] || process.env.BACKLOG_PROJECT_KEY || '';

if (!BASE || !KEY) { console.error('[quy-tắc] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY'); process.exit(2); }
if (!DU_AN) { console.error('[quy-tắc] ✗ thiếu mã project, vd CSDL'); process.exit(2); }

(async () => {
  const r = await fetch(`${BASE}/api/v2/projects/${encodeURIComponent(DU_AN)}?apiKey=${encodeURIComponent(KEY)}`);
  if (!r.ok) { console.error(`[quy-tắc] ✗ HTTP ${r.status}`); process.exit(3); }
  const j = await r.json();
  const rule = j.textFormattingRule || '(không có trường này)';
  console.log(`[quy-tắc] project ${j.projectKey} (${j.name})`);
  console.log(`  textFormattingRule = ${JSON.stringify(rule)}`);
  console.log(`  ⇒ cú pháp nhúng ảnh đúng: ${rule === 'backlog' ? '#image(tên)' : '![image][tên]'}`);
})().catch((e) => { console.error('[quy-tắc] ✗', e.message); process.exit(1); });
