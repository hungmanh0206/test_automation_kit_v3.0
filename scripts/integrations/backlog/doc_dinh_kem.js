#!/usr/bin/env node
'use strict';

/*
 * doc_dinh_kem.js — liệt kê TỆP ĐÍNH KÈM của một issue (chỉ GET).
 *
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/integrations/backlog/doc_dinh_kem.js CSDL-3922 ...
 *
 * Vì sao cần: upload lại một ảnh TRÙNG TÊN có thể giữ bản cũ, thêm bản mới, hoặc thay thế — ba hành
 * vi khác nhau mà danh sách tên nhìn y hệt. So KÍCH THƯỚC và GIỜ TẠO mới biết bug đang mang ảnh nào.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = process.env.BACKLOG_API_KEY || '';
const IDS = process.argv.slice(2);

if (!BASE || !KEY) { console.error('[đính-kèm] ✗ thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY'); process.exit(2); }
if (!IDS.length) { console.error('[đính-kèm] ✗ thiếu mã issue'); process.exit(2); }

(async () => {
  for (const id of IDS) {
    const r = await fetch(`${BASE}/api/v2/issues/${encodeURIComponent(id)}/attachments?apiKey=${encodeURIComponent(KEY)}`);
    if (!r.ok) { console.log(`${id}: HTTP ${r.status}`); continue; }
    const j = await r.json();
    console.log(`${id} — ${j.length} tệp`);
    for (const a of j) console.log(`   id=${String(a.id).padEnd(9)} ${String(a.size).padStart(8)} B  ${a.name}  (tạo ${String(a.created).slice(0, 19)})`);
  }
})().catch((e) => { console.error('[đính-kèm] ✗', e.message); process.exit(1); });
