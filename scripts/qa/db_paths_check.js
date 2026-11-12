#!/usr/bin/env node
'use strict';
/*
 * db:paths:check — QUÉT ĐƯỜNG VÒNG TỚI DB TRONG CODE (v2.8.0 §0b.5).
 *
 * VÌ SAO CẦN KHI ĐÃ CÓ HOOK. Hook `PreToolUse` chặn AI lúc nó định ghi một file như vậy. Nhưng hook chỉ
 * chạy trong phiên có harness: nó không thấy code người viết tay, không thấy code đã nằm sẵn trong repo
 * từ trước, và không thấy file đến từ một nhánh khác. Gate này quét TRẠNG THÁI, không quét hành động —
 * hai thứ bắt được hai lớp khác nhau.
 *
 * DÙNG CHUNG MẪU VỚI HOOK, cố ý. Mẫu nhận driver và chuỗi kết nối lấy thẳng từ `hooks/guard_db_access.js`.
 * Chép ra một bản thứ hai là lặp lại đúng lỗi mà cả §0b này sinh ra để sửa: hai bản lint SQL trôi khỏi
 * nhau, năm bản mẫu PII lệch nhau. Một nguồn thì không có chuyện "hook chặn mà gate cho qua".
 *
 * PHẠM VI QUÉT, và vì sao rộng hơn `scripts/`:
 *   · `tests/fe/lib/**` — thư viện bước dùng chung của v2.8.0. Đây là chỗ nguy hiểm nhất: một bước dùng
 *     lại mà tự nối DB thì MỌI spec dùng bước đó cùng đi vòng, không chỉ một.
 *   · nhánh `automation` trong thư mục task (`outputs/<DA>/tasks/<TASK>/automation`) — code riêng của
 *     task. Nó không được commit, nên không CI nào thấy; gate này chạy ở máy thì thấy.
 *
 * Dùng: node scripts/qa/db_paths_check.js [--json]
 * Exit: 0 · 1 khi có file đi vòng · 2 khi phép đo hỏng (quét 0 file)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const { DRIVER, CHUOI_KET_NOI, DUOC_PHEP_DRIVER } = require(path.join(__dirname, 'hooks', 'guard_db_access.js'));

const JSON_OUT = process.argv.includes('--json');

/*
 * MIỄN TRỪ CÓ HẠN. Gate này đỏ ngay ngày đầu với 10 file probe có sẵn của TASK-9003, và một gate
 * đỏ-khi-vừa-ra-đời thì bị bỏ qua chứ không được sửa.
 *
 * Nên nợ cũ được KHAI và ĐẾM, còn file MỚI vẫn bị chặn ngay — đó là phần có giá trị nhất của gate này.
 * Miễn trừ quá hạn `ra_soat_truoc` thì chuyển thành CHẶN: một miễn trừ không hạn là một miễn trừ vĩnh viễn.
 */
const DUONG_MIEN_TRU = path.join(REPO, '.agent', 'config', 'db-paths.allow.json');

function napMienTru() {
  let j;
  try { j = JSON.parse(fs.readFileSync(DUONG_MIEN_TRU, 'utf8')); } catch (e) { return new Map(); }
  const m = new Map();
  for (const x of (j.mien_tru || [])) m.set(String(x.file), x);
  return m;
}

/** Thư mục quét. `outputs/` chỉ quét nhánh `automation/`, không quét evidence và kết quả chạy. */
const VUNG = [
  'scripts',
  'tests',
  'tools',
];

const BO_QUA_DIR = /node_modules|[\\/]\.git|[\\/]dist|test-results|[\\/]\.playwright/;

function quet(d, ra) {
  let muc;
  try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const f of muc) {
    const p = path.join(d, f.name);
    if (BO_QUA_DIR.test(p)) continue;
    if (f.isDirectory()) { quet(p, ra); continue; }
    if (!/\.(js|mjs|cjs|ts|tsx|py|ps1)$/.test(f.name)) continue;
    ra.push(p);
  }
}

/** `outputs/<DA>/tasks/<TASK>/automation/**` — code riêng của task, không được commit. */
function quetAutomation(ra) {
  const goc = path.join(REPO, 'outputs');
  let da;
  try { da = fs.readdirSync(goc, { withFileTypes: true }); } catch (e) { return; }
  for (const d of da) {
    if (!d.isDirectory()) continue;
    const tasks = path.join(goc, d.name, 'tasks');
    let ts;
    try { ts = fs.readdirSync(tasks, { withFileTypes: true }); } catch (e) { continue; }
    for (const t of ts) {
      if (!t.isDirectory()) continue;
      quet(path.join(tasks, t.name, 'automation'), ra);
    }
  }
}

function dungDo() {
  const files = [];
  for (const v of VUNG) quet(path.join(REPO, v), files);
  quetAutomation(files);

  const viPham = [];
  for (const f of files) {
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    if (DUOC_PHEP_DRIVER.some((re) => re.test(rel))) continue;
    let t;
    try { t = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const d = DRIVER.find((re) => re.test(t));
    if (d) { viPham.push({ f: rel, loai: 'driver DB', mau: String(d).slice(0, 44) }); continue; }
    const c = CHUOI_KET_NOI.find((re) => re.test(t));
    if (c) viPham.push({ f: rel, loai: 'chuỗi kết nối', mau: String(c).slice(0, 44) });
  }
  const mienTru = napMienTru();
  const homNay = new Date().toISOString().slice(0, 10);
  const con = [];
  const daKhai = [];
  const quaHan = [];
  for (const v of viPham) {
    const m = mienTru.get(v.f);
    if (!m) { con.push(v); continue; }
    if (m.ra_soat_truoc && String(m.ra_soat_truoc) < homNay) { quaHan.push({ ...v, ...m }); continue; }
    daKhai.push({ ...v, ...m });
  }
  /*
   * MỤC NỢ THỪA cũng phải báo. Một miễn trừ cho file không còn vi phạm là rác, và rác trong danh sách
   * miễn trừ thì nguy hiểm hơn rác thường: nó làm danh sách dài ra, và một danh sách dài thì không ai
   * đọc lại. Đã xảy ra ngay trong lượt dựng gate này — siết mẫu driver xong thì 1/10 mục thành thừa.
   */
  const dangViPham = new Set(viPham.map((v) => v.f));
  const thua = [...mienTru.keys()].filter((f) => !dangViPham.has(f));

  return {
    so_file: files.length, vi_pham: con, da_khai: daKhai, qua_han: quaHan, thua, tong_vi_pham: viPham.length,
  };
}

function main() {
  const d = dungDo();

  if (!d.so_file) {
    console.error('[db-paths] ✗ quét 0 file — phép đo hỏng (sai cwd?), không phải "sạch".');
    process.exit(2);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(d, null, 2));
    process.exit(d.vi_pham.length ? 1 : 0);
  }

  if (d.qua_han.length) {
    console.error(`[db-paths] ✗ ${d.qua_han.length} miễn trừ QUÁ HẠN rà soát — một miễn trừ không hạn là miễn trừ vĩnh viễn:`);
    for (const v of d.qua_han) console.error(`  ${v.f}  (hạn ${v.ra_soat_truoc})`);
    process.exit(1);
  }

  if (d.thua.length) {
    console.log(`[db-paths] ~ ${d.thua.length} mục miễn trừ THỪA (file không còn vi phạm) — gỡ khỏi danh sách:`);
    for (const f of d.thua) console.log(`    ${f}`);
  }

  if (!d.vi_pham.length) {
    const no = d.da_khai.length
      ? ` · ${d.da_khai.length} đã khai miễn trừ có hạn (nợ, xem .agent/config/db-paths.allow.json)`
      : '';
    console.log(`[db-paths] ✓ ${d.so_file} file · 0 đường vòng MỚI tới DB${no}.`);
    return;
  }

  console.error(`[db-paths] ✗ ${d.vi_pham.length}/${d.so_file} file mở đường riêng tới DB (CHƯA khai miễn trừ):`);
  for (const v of d.vi_pham) console.error(`  ${v.f}  — ${v.loai}`);
  console.error('');
  console.error('  Mọi đường chạm DB phải đi qua `tests/support/setup/db/` — ở đó mới có lint câu SQL và');
  console.error('  transaction luôn rollback. Một đường riêng là một đường không ai gác, và nó chạy dưới');
  console.error('  login `db_owner` trên 888 bảng.');
  console.error('  Tra cứu thì dùng: npm run db:query -- --task <K> --sql-file <f.sql>');
  process.exit(1);
}

if (require.main === module) main();

module.exports = { dungDo, VUNG };
