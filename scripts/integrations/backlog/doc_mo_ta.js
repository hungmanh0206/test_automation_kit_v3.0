#!/usr/bin/env node
'use strict';

/*
 * doc_mo_ta.js — in NGUYÊN VĂN mô tả của một issue Backlog (chỉ GET).
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/doc_mo_ta.js CSDL-3922
 *
 * Dùng để soát lại bug đã log có nói đúng thứ đã đo hay không. Đọc từ Backlog chứ không đọc file
 * payload ở máy: payload là thứ TÔI ĐỊNH gửi, mô tả là thứ DEV THẬT SỰ ĐỌC — hai thứ có thể lệch.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = process.env.BACKLOG_API_KEY || '';
const IDS = process.argv.slice(2);

if (!BASE || !KEY) { console.error('[mô-tả] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY'); process.exit(2); }
if (!IDS.length) { console.error('[mô-tả] ✗ thiếu mã issue'); process.exit(2); }

(async () => {
  for (const id of IDS) {
    const r = await fetch(`${BASE}/api/v2/issues/${encodeURIComponent(id)}?apiKey=${encodeURIComponent(KEY)}`);
    if (!r.ok) { console.log(`${id}: HTTP ${r.status}`); continue; }
    const j = await r.json();
    console.log(`\n${'='.repeat(78)}\n${id} — ${j.summary}\n${'='.repeat(78)}`);
    console.log(String(j.description || '(trống)'));
  }
})().catch((e) => { console.error('[mô-tả] ✗', e.message); process.exit(1); });
