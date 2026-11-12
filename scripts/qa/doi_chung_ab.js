#!/usr/bin/env node
/**
 * doi_chung_ab.js — ba máy còn thiếu của quy trình đối chứng kit A / kit B (`docs/v2.11.0/DOI_CHUNG_A_B.md` §7).
 *
 *   ① ĐĂNG KÝ TRƯỚC: kiểm file đăng ký đủ mục, băm mọi file đầu vào ⇒ `<đăng ký>.khoa.json`. Kiểm lại sau lượt chạy:
 *      file nào đổi băm thì cả lượt đối chứng mất giá trị (mục đã đăng ký bị sửa sau khi thấy kết quả).
 *   ② CHUYỂN KHUÔN: bảng Markdown testcase của từng kit ⇒ khuôn trung lập { id, yeu_cau, tien_de, du_lieu, buoc,
 *      ky_vong }. Chỉ đổi KHUÔN, không đổi NỘI DUNG: mỗi case mang băm của các ô nguồn, và `--kiem-khuon` dựng lại từ
 *      nguồn để so. M1 (phủ yêu cầu) chỉ đếm mã có trong DANH MỤC đã đăng ký — mã A tự gán (`REQ-<MODULE>-NN`) và mã
 *      B dùng (`BR-*`) không so được với nhau, nên mẫu số phải là một danh mục chung đưa vào gói đầu vào.
 *   ③ PHIẾU CHẤM MÙ M2 (bắt bug đã biết): gỡ tên kit, ĐÁNH LẠI MÃ case (mã gốc tự lộ kit: `APP_BCTH_TC_…` so với
 *      `CUST-EP-001`), niêm phong bảng đối chiếu, nhận câu trả lời có cấu trúc rồi chấm recall theo từng kit.
 *
 * Mô tả bug do người tổ chức soạn từ Backlog. Máy TỪ CHỐI mô tả có email hoặc số điện thoại (CLAUDE.md §1).
 *
 * Dùng:
 *   node scripts/qa/doi_chung_ab.js --dang-ky <dang-ky.json>                 ⇒ kiểm + ghi khoá băm
 *   node scripts/qa/doi_chung_ab.js --kiem-dang-ky <dang-ky.json>            ⇒ so lại băm
 *   node scripts/qa/doi_chung_ab.js --chuyen <A|B> --nguon <file|thư mục> --ra <bo.json>
 *   node scripts/qa/doi_chung_ab.js --kiem-khuon <bo.json>                   ⇒ dựng lại từ nguồn, so băm
 *   node scripts/qa/doi_chung_ab.js --m1 <bo.json> --danh-muc <danh-muc.json>
 *   node scripts/qa/doi_chung_ab.js --phieu-m2 --bug <bugs.json> --bo <kit>=<bo.json> --bo <kit>=<bo.json> --ra <thư mục> [--seed N]
 *   node scripts/qa/doi_chung_ab.js --cham-m2 <thư mục phiếu>
 * Exit: 0 · 1 khi kiểm/chấm phát hiện sai · 2 khi thiếu đầu vào (KHÔNG PHÁN ĐƯỢC)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EMAIL_RE, PHONE_RE } = require('./lib/pii_mask');
const { prng, wilson } = require('./pass_audit');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const chuanO = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/\\\|/g, '|').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();

/* ─────────────────────────────── ① đăng ký trước ─────────────────────────────── */

const LOAI_TASK = ['validation', 'trang_thai_quyen', 'xuyen_module', 'doi_chung'];

/** Kiểm file đăng ký. Trả danh sách lỗi — rỗng mới khoá được. Đường dẫn trong đăng ký tính từ thư mục của nó. */
function kiemDangKy(dk, goc) {
  const loi = [];
  const tasks = Array.isArray(dk && dk.tasks) ? dk.tasks : [];
  const that = tasks.filter((t) => t && t.loai !== 'doi_chung');
  if (that.length < 3) loi.push(`cần ≥3 task thật (không tính task đối chứng), đang có ${that.length}`);
  if (!tasks.some((t) => t && t.loai === 'doi_chung')) loi.push('thiếu task đối chứng (`loai: "doi_chung"`) — không có nó thì không phân biệt được kit với bộ chấm thiên vị');
  for (const [i, t] of tasks.entries()) {
    const ten = (t && t.ma) || `tasks[${i}]`;
    if (!t || !t.ma) loi.push(`tasks[${i}] thiếu \`ma\``);
    if (!t || !LOAI_TASK.includes(t.loai)) loi.push(`${ten}: \`loai\` phải ∈ ${LOAI_TASK.join('|')}`);
    const dv = (t && Array.isArray(t.dau_vao)) ? t.dau_vao : [];
    if (!dv.length) loi.push(`${ten}: \`dau_vao\` rỗng — gói đầu vào phải liệt kê từng file`);
    for (const f of dv) if (!fs.existsSync(path.resolve(goc, f))) loi.push(`${ten}: không có file đầu vào ${f}`);
    if (!t || !t.danh_muc || !fs.existsSync(path.resolve(goc, t.danh_muc))) loi.push(`${ten}: thiếu \`danh_muc\` (danh mục yêu cầu có mã cố định — mẫu số của M1)`);
    if (!t || !Array.isArray(t.cam) || !t.cam.length) loi.push(`${ten}: thiếu \`cam\` — đường dẫn KHÔNG được có trong workspace làm bài (outputs, knowledge của module…)`);
  }
  if (!dk || !String(dk.model || '').trim()) loi.push('thiếu `model` (model id cố định cho cả hai kit)');
  if (!dk || !Number.isInteger(dk.so_luot) || dk.so_luot < 3) loi.push('`so_luot` phải là số nguyên ≥ 3 — một lượt không tách được kit khỏi độ ngẫu nhiên của model');
  if (!dk || !dk.nguong || typeof dk.nguong !== 'object' || !Object.keys(dk.nguong).length) loi.push('thiếu `nguong` — chênh bao nhiêu thì gọi là khác biệt, khai TRƯỚC khi thấy số');
  if (!dk || !String(dk.duyet_boi || '').trim()) loi.push('thiếu `duyet_boi` (QA-Lead duyệt đăng ký trước lượt đầu)');
  return loi;
}

/** Băm mọi file đầu vào + danh mục + chính nội dung đăng ký. */
function khoaDangKy(dk, goc, noiDung) {
  const tep = {};
  for (const t of dk.tasks) for (const f of [...t.dau_vao, t.danh_muc]) tep[f] = sha(fs.readFileSync(path.resolve(goc, f)));
  return { bam_dang_ky: sha(noiDung), tep };
}

function soKhoa(khoa, dk, goc, noiDung) {
  const lech = [];
  if (sha(noiDung) !== khoa.bam_dang_ky) lech.push('nội dung file đăng ký đã đổi sau khi khoá');
  for (const [f, b] of Object.entries(khoa.tep || {})) {
    const p = path.resolve(goc, f);
    if (!fs.existsSync(p)) lech.push(`${f}: đã bị xoá`);
    else if (sha(fs.readFileSync(p)) !== b) lech.push(`${f}: đổi nội dung sau khi khoá`);
  }
  return lech;
}

/* ─────────────────────────────── ② chuyển khuôn ─────────────────────────────── */

/* Bản đồ cột của từng kit. A: bảng 19 cột của `rbt-manual-testing` (cột REQ ID riêng). B: bảng canonical (mã yêu
 * cầu nằm trong cột Tag dạng [BR-…]). Thêm kit = thêm một mục ở đây, không viết bộ đọc mới. */
const MA_YC = /\b(?:BR|SM|PM|UI|VAL|FUNC|REQ|INV)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;
const KHUON = {
  A: { id: 'tc id', yeu_cau: ['req id'], tien_de: ['pre-condition', 'context'], du_lieu: ['test data'], buoc: ['test steps'], ky_vong: ['expected result'] },
  B: { id: 'tc id', yeu_cau: ['tag'], tien_de: ['tiền điều kiện'], du_lieu: ['dữ liệu test'], buoc: ['các bước thực hiện'], ky_vong: ['kết quả mong đợi'] },
};
const TRUONG = ['tien_de', 'du_lieu', 'buoc', 'ky_vong'];

const tachO = (dong) => {
  const o = []; let cur = '';
  const s = dong.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '\\|'; i += 1; continue; }
    if (s[i] === '|') { o.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  o.push(cur.trim());
  return o;
};

/** Đọc MỌI bảng testcase trong một file Markdown theo bản đồ cột. */
function docBang(md, khuon, tenTep = '') {
  const ra = [];
  let cot = null;
  for (const d of md.split(/\r?\n/)) {
    if (!/^\s*\|/.test(d)) { cot = null; continue; }
    const o = tachO(d);
    const thuong = o.map((x) => x.toLowerCase().trim());
    /* Bảng testcase = tiêu đề có ĐỦ cột của bản đồ. Chỉ dò cột "TC ID" thì vơ cả bảng truy vết, bảng tổng hợp có
     * cột đó — đo trên TASK-4008: 368 dòng thay vì 312 case, 56 dòng "thiếu cột". */
    if (thuong.includes(khuon.id)) { cot = TRUONG.every((tr) => khuon[tr].some((c) => thuong.includes(c))) ? thuong : null; continue; }
    if (!cot || /^[-:\s]+$/.test(o.join(''))) continue;
    const lay = (ten) => { const k = cot.indexOf(ten); return k >= 0 ? (o[k] || '') : null; };
    const id = (lay(khuon.id) || '').trim();
    if (!id || /^[-:]+$/.test(id)) continue;
    const nguon = {};
    for (const tr of ['yeu_cau', ...TRUONG]) {
      nguon[tr] = khuon[tr].map((c) => lay(c)).filter((x) => x !== null);
    }
    const thieuCot = TRUONG.filter((tr) => !nguon[tr].length);
    ra.push({
      id,
      tep: tenTep,
      yeu_cau: [...new Set(nguon.yeu_cau.join(' ').match(MA_YC) || [])],
      ...Object.fromEntries(TRUONG.map((tr) => [tr, chuanO(nguon[tr].join('\n'))])),
      bam_nguon: sha(TRUONG.map((tr) => nguon[tr].join('\u0001')).join('\u0002')),
      thieu_cot: thieuCot,
    });
  }
  return ra;
}

function lietKeMd(p) {
  if (fs.statSync(p).isFile()) return [p];
  return fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lietKeMd(path.join(p, e.name)) : (e.name.endsWith('.md') ? [path.join(p, e.name)] : [])));
}

/** Chuyển một nguồn (file hoặc thư mục) của một kit ⇒ bộ trung lập. Trả { bo, loi }. */
function chuyen(kit, nguon) {
  const khuon = KHUON[kit];
  if (!khuon) return { loi: [`kit "${kit}" chưa có bản đồ cột — có: ${Object.keys(KHUON).join(', ')}`] };
  const ca = [];
  for (const f of lietKeMd(nguon)) ca.push(...docBang(fs.readFileSync(f, 'utf8'), khuon, path.basename(f)));
  const loi = [];
  if (!ca.length) loi.push(`không đọc được case nào từ ${nguon} theo khuôn ${kit} — sai kit, hoặc sai tên cột`);
  const dem = {}; for (const c of ca) dem[c.id] = (dem[c.id] || 0) + 1;
  const trung = Object.entries(dem).filter(([, n]) => n > 1).map(([id]) => id);
  if (trung.length) loi.push(`${trung.length} mã case trùng (${trung.slice(0, 5).join(', ')}) — trùng thì phiếu chấm không chỉ được case nào`);
  const thieu = ca.filter((c) => c.thieu_cot.length);
  if (thieu.length) loi.push(`${thieu.length} case thiếu cột ${[...new Set(thieu.flatMap((c) => c.thieu_cot))].join(', ')}`);
  return { bo: { kit, nguon: path.resolve(nguon), so_case: ca.length, ca }, loi };
}

/** Dựng lại từ nguồn rồi so: bộ trung lập có bị sửa nội dung sau khi chuyển không. */
function kiemKhuon(bo) {
  const lai = chuyen(bo.kit, bo.nguon);
  if (!lai.bo) return lai.loi;
  const loi = [];
  if (lai.bo.so_case !== bo.ca.length) loi.push(`nguồn có ${lai.bo.so_case} case, bộ trung lập có ${bo.ca.length}`);
  const theoId = new Map(lai.bo.ca.map((c) => [c.id, c]));
  for (const c of bo.ca) {
    const g = theoId.get(c.id);
    if (!g) { loi.push(`${c.id}: không có trong nguồn`); continue; }
    if (g.bam_nguon !== c.bam_nguon) loi.push(`${c.id}: nguồn đã đổi sau khi chuyển`);
    for (const tr of TRUONG) if (g[tr] !== c[tr]) loi.push(`${c.id}: trường \`${tr}\` khác nguồn — bộ chuyển hoặc người dùng đã sửa nội dung`);
  }
  return loi;
}

/** M1: phủ yêu cầu trên DANH MỤC đã đăng ký. Mã ngoài danh mục báo riêng, không tính. */
function m1(bo, danhMuc) {
  const ma = new Set((danhMuc.muc || []).map((m) => m.ma));
  const phu = new Set(); const la = new Set();
  for (const c of bo.ca) for (const y of c.yeu_cau) (ma.has(y) ? phu : la).add(y);
  return { tong: ma.size, phu: phu.size, ti_le: ma.size ? phu.size / ma.size : null, chua_phu: [...ma].filter((m) => !phu.has(m)), ma_ngoai_danh_muc: [...la] };
}

/* ─────────────────────────────── ③ phiếu chấm mù M2 ─────────────────────────────── */

const NHAN = ['X', 'Y', 'Z', 'W'];

function xao(ds, r) {
  const a = [...ds];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Dựng phiếu M2. `bos`: { tenKit: boTrungLap }. Trả { phieu, phuLuc: {nhan: md}, niemPhong }. */
function dungPhieuM2(bugs, bos, seed) {
  const r = prng(seed);
  const kits = xao(Object.keys(bos).sort(), r);
  const niemPhong = { seed, nhan: {}, ma: {} };
  const phuLuc = {};
  kits.forEach((kit, i) => {
    const nhan = NHAN[i];
    niemPhong.nhan[nhan] = kit;
    const ca = xao(bos[kit].ca, r);
    const dong = [`# Bộ ${nhan} — ${ca.length} case`, '', 'Mã case đã được ĐÁNH LẠI để không lộ bộ này của kit nào.', ''];
    ca.forEach((c, k) => {
      const moi = `${nhan}-${String(k + 1).padStart(3, '0')}`;
      niemPhong.ma[moi] = c.id;
      dong.push(`## ${moi}`, '', `- **Tiền đề:** ${c.tien_de.replace(/\n/g, ' · ')}`, `- **Dữ liệu:** ${c.du_lieu.replace(/\n/g, ' · ')}`,
        `- **Bước:** ${c.buoc.replace(/\n/g, ' · ')}`, `- **Kỳ vọng:** ${c.ky_vong.replace(/\n/g, ' · ')}`, '');
    });
    phuLuc[nhan] = `${dong.join('\n')}\n`;
  });
  const nhanDung = kits.map((_, i) => NHAN[i]);
  const p = [
    '# Phiếu chấm M2 — bắt bug đã biết',
    '',
    `<!-- ĐỪNG sửa dòng dưới. bam_niem_phong khớp file niem-phong.json; người chấm KHÔNG mở file đó. -->`,
    `- bam_niem_phong: ${sha(JSON.stringify(niemPhong)).slice(0, 16)}`,
    '- nguoi_cham: ',
    '',
    `Với TỪNG bug dưới đây và TỪNG bộ (${nhanDung.join(', ')} — xem file bo-<nhãn>.md): có case nào mà nếu chạy trên bản`,
    'đang lỗi thì sẽ FAIL không? Ghi mã case (vd `X-017`) hoặc `khong_co`. Ghi mã thì `vi_sao` phải nói bước/kỳ vọng nào',
    'của case chạm đúng chỗ lỗi. Không chắc thì ghi `khong_co` — case "có thể bắt" không tính là bắt.',
    '',
  ];
  for (const b of bugs) {
    p.push(`## ${b.ma}`, '', b.mo_ta, '');
    for (const n of nhanDung) p.push(`bat[${b.ma}][${n}]: `, `vi_sao[${b.ma}][${n}]: `);
    p.push('');
  }
  return { phieu: `${p.join('\n')}\n`, phuLuc, niemPhong };
}

function kiemBugs(bugs) {
  const loi = [];
  if (!Array.isArray(bugs) || !bugs.length) return ['file bug rỗng — M2 cần danh sách bug DEV đã nhận'];
  for (const [i, b] of bugs.entries()) {
    if (!b || !b.ma || !String(b.mo_ta || '').trim()) loi.push(`bug[${i}] thiếu \`ma\` hoặc \`mo_ta\``);
    const s = JSON.stringify(b || {});
    if (EMAIL_RE.test(s) || PHONE_RE.test(s)) loi.push(`bug ${b && b.ma}: mô tả có email hoặc số điện thoại — che PII khách trước khi đưa vào phiếu (CLAUDE.md §1)`);
  }
  return loi;
}

/** Chấm phiếu M2 đã điền. Trả { loi, theoKit }. */
function chamM2(phieuMd, niemPhong, bugs) {
  const loi = [];
  const nguoi = (phieuMd.match(/^- nguoi_cham:[ \t]*(.*)$/m) || [])[1] || '';
  if (!nguoi.trim()) loi.push('thiếu `nguoi_cham`');
  const bam = (phieuMd.match(/^- bam_niem_phong:[ \t]*([0-9a-f]+)/m) || [])[1];
  if (bam !== sha(JSON.stringify(niemPhong)).slice(0, 16)) loi.push('bam_niem_phong không khớp niem-phong.json — phiếu và niêm phong không cùng một lượt');
  const bat = {}; const viSao = {};
  for (const m of phieuMd.matchAll(/^bat\[([^\]]+)\]\[([A-Z])\]:[ \t]*(.*)$/gm)) bat[`${m[1]}|${m[2]}`] = m[3].trim();
  for (const m of phieuMd.matchAll(/^vi_sao\[([^\]]+)\]\[([A-Z])\]:[ \t]*(.*)$/gm)) viSao[`${m[1]}|${m[2]}`] = m[3].trim();
  const nhans = Object.keys(niemPhong.nhan);
  const theoKit = {};
  for (const n of nhans) {
    const kit = niemPhong.nhan[n];
    theoKit[kit] = { nhan: n, bat: 0, tong: bugs.length, chi_tiet: [] };
    for (const b of bugs) {
      const k = `${b.ma}|${n}`;
      const v = bat[k];
      if (v === undefined || v === '') { loi.push(`${b.ma} bộ ${n}: chưa chấm`); continue; }
      if (v === 'khong_co') continue;
      if (!niemPhong.ma[v] || !v.startsWith(`${n}-`)) { loi.push(`${b.ma} bộ ${n}: "${v}" không phải mã case của bộ ${n}`); continue; }
      if ((viSao[k] || '').length < 15) { loi.push(`${b.ma} bộ ${n}: ghi mã case thì vi_sao phải nói bước/kỳ vọng nào chạm chỗ lỗi`); continue; }
      theoKit[kit].bat += 1;
      theoKit[kit].chi_tiet.push({ bug: b.ma, ca: niemPhong.ma[v] });
    }
    theoKit[kit].ti_le = bugs.length ? theoKit[kit].bat / bugs.length : null;
    theoKit[kit].ci95 = wilson(theoKit[kit].bat, bugs.length);
  }
  return { loi, theoKit, nguoiCham: nguoi.trim() };
}

/* ─────────────────────────────── vào-ra ─────────────────────────────── */

function main(argv = process.argv.slice(2)) {
  const lay = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const layNhieu = (k) => argv.flatMap((x, i) => (x === k && argv[i + 1] ? [argv[i + 1]] : []));
  const docJson = (f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
  const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);

  if (lay('--dang-ky') || lay('--kiem-dang-ky')) {
    const f = path.resolve(lay('--dang-ky') || lay('--kiem-dang-ky'));
    if (!fs.existsSync(f)) { console.error(`[doi-chung] KHÔNG PHÁN ĐƯỢC — không có file đăng ký ${f}`); return 2; }
    const noiDung = fs.readFileSync(f, 'utf8');
    const dk = JSON.parse(noiDung);
    const goc = path.dirname(f);
    const fKhoa = f.replace(/\.json$/, '.khoa.json');
    if (lay('--dang-ky')) {
      const loi = kiemDangKy(dk, goc);
      if (loi.length) { console.error('[doi-chung] ĐĂNG KÝ CHƯA ĐỦ:'); loi.forEach((l) => console.error(`  · ${l}`)); return 1; }
      if (fs.existsSync(fKhoa)) { console.error(`[doi-chung] đã có khoá ${path.basename(fKhoa)} — đăng ký đã khoá thì không khoá lại; đổi đăng ký là mở một lượt đối chứng MỚI`); return 1; }
      fs.writeFileSync(fKhoa, `${JSON.stringify({ khoa_luc: new Date().toISOString(), ...khoaDangKy(dk, goc, noiDung) }, null, 2)}\n`);
      console.log(`[doi-chung] đã khoá đăng ký → ${path.basename(fKhoa)}. Commit cả hai file TRƯỚC lượt chạy đầu tiên.`);
      return 0;
    }
    if (!fs.existsSync(fKhoa)) { console.error('[doi-chung] KHÔNG PHÁN ĐƯỢC — chưa có khoá; chạy --dang-ky trước'); return 2; }
    const lech = soKhoa(docJson(fKhoa), dk, goc, noiDung);
    if (lech.length) { console.error('[doi-chung] ✗ ĐĂNG KÝ ĐÃ BỊ ĐỔI sau khi khoá — lượt đối chứng này mất giá trị:'); lech.forEach((l) => console.error(`  · ${l}`)); return 1; }
    console.log('[doi-chung] ✓ đăng ký và mọi file đầu vào khớp khoá.');
    return 0;
  }

  if (lay('--chuyen')) {
    if (!lay('--nguon') || !lay('--ra')) { console.error('[doi-chung] --chuyen cần --nguon và --ra'); return 2; }
    const r = chuyen(lay('--chuyen'), path.resolve(lay('--nguon')));
    if (!r.bo || !r.bo.so_case) { (r.loi || []).forEach((l) => console.error(`[doi-chung] ✗ ${l}`)); return 2; }
    fs.writeFileSync(path.resolve(lay('--ra')), `${JSON.stringify(r.bo, null, 1)}\n`);
    console.log(`[doi-chung] ${r.bo.so_case} case (kit ${r.bo.kit}) → ${lay('--ra')}`);
    r.loi.forEach((l) => console.log(`  ⚠ ${l}`));
    return r.loi.length ? 1 : 0;
  }

  if (lay('--kiem-khuon')) {
    const loi = kiemKhuon(docJson(lay('--kiem-khuon')));
    if (loi.length) { console.error('[doi-chung] ✗ bộ trung lập KHÔNG khớp nguồn:'); loi.slice(0, 20).forEach((l) => console.error(`  · ${l}`)); return 1; }
    console.log('[doi-chung] ✓ bộ trung lập khớp nguồn từng trường.');
    return 0;
  }

  if (lay('--m1')) {
    if (!lay('--danh-muc')) { console.error('[doi-chung] --m1 cần --danh-muc'); return 2; }
    const k = m1(docJson(lay('--m1')), docJson(lay('--danh-muc')));
    if (!k.tong) { console.error('[doi-chung] KHÔNG PHÁN ĐƯỢC — danh mục rỗng'); return 2; }
    console.log(`[doi-chung] M1 phủ yêu cầu: ${k.phu}/${k.tong} (${pct(k.ti_le)})`);
    if (k.chua_phu.length) console.log(`  chưa phủ: ${k.chua_phu.join(', ')}`);
    if (k.ma_ngoai_danh_muc.length) console.log(`  ${k.ma_ngoai_danh_muc.length} mã ngoài danh mục — KHÔNG tính: ${k.ma_ngoai_danh_muc.slice(0, 10).join(', ')}`);
    return 0;
  }

  if (argv.includes('--phieu-m2')) {
    const fBug = lay('--bug'); const ra = lay('--ra'); const cap = layNhieu('--bo');
    if (!fBug || !ra || cap.length < 2) { console.error('[doi-chung] --phieu-m2 cần --bug, --ra và ≥2 --bo <kit>=<bo.json>'); return 2; }
    const bugs = docJson(fBug);
    const loiBug = kiemBugs(bugs);
    if (loiBug.length) { loiBug.forEach((l) => console.error(`[doi-chung] ✗ ${l}`)); return 1; }
    const bos = Object.fromEntries(cap.map((x) => { const i = x.indexOf('='); return [x.slice(0, i), docJson(x.slice(i + 1))]; }));
    const seed = lay('--seed') ? Number(lay('--seed')) >>> 0 : crypto.randomBytes(4).readUInt32BE(0);
    const { phieu, phuLuc, niemPhong } = dungPhieuM2(bugs, bos, seed);
    const d = path.resolve(ra);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'phieu-m2.md'), phieu);
    for (const [n, md] of Object.entries(phuLuc)) fs.writeFileSync(path.join(d, `bo-${n}.md`), md);
    fs.writeFileSync(path.join(d, 'niem-phong.json'), `${JSON.stringify(niemPhong, null, 1)}\n`);
    fs.writeFileSync(path.join(d, 'bugs.json'), `${JSON.stringify(bugs, null, 1)}\n`);
    console.log(`[doi-chung] phiếu M2: ${bugs.length} bug × ${Object.keys(phuLuc).length} bộ → ${ra}`);
    console.log('  Đưa người chấm: phieu-m2.md + bo-*.md. GIỮ LẠI niem-phong.json — người chấm mở nó là lộ kit.');
    return 0;
  }

  if (lay('--cham-m2')) {
    const d = path.resolve(lay('--cham-m2'));
    let phieuMd; let niemPhong; let bugs;
    try { phieuMd = fs.readFileSync(path.join(d, 'phieu-m2.md'), 'utf8'); niemPhong = docJson(path.join(d, 'niem-phong.json')); bugs = docJson(path.join(d, 'bugs.json')); } catch (e) {
      console.error(`[doi-chung] KHÔNG PHÁN ĐƯỢC — thiếu file trong ${d}: ${e.message}`); return 2;
    }
    const k = chamM2(phieuMd, niemPhong, bugs);
    if (k.loi.length) { console.error('[doi-chung] ✗ PHIẾU CHƯA CHẤM ĐƯỢC:'); k.loi.slice(0, 20).forEach((l) => console.error(`  · ${l}`)); return 1; }
    console.log(`[doi-chung] M2 bắt bug đã biết — chấm bởi ${k.nguoiCham}:`);
    for (const [kit, v] of Object.entries(k.theoKit)) console.log(`  kit ${kit} (bộ ${v.nhan}): ${v.bat}/${v.tong} (${pct(v.ti_le)})${v.ci95 ? ` · 95%: ${pct(v.ci95[0])}–${pct(v.ci95[1])}` : ''}`);
    const ci = Object.values(k.theoKit).map((v) => v.ci95).filter(Boolean);
    if (ci.length >= 2 && ci.every((a) => ci.every((b) => a[0] <= b[1] && b[0] <= a[1]))) console.log('  ⚠ khoảng tin cậy CHỒNG NHAU — chưa phân biệt được hai kit trên phép đo này.');
    return 0;
  }

  console.error('[doi-chung] cần một trong: --dang-ky · --kiem-dang-ky · --chuyen · --kiem-khuon · --m1 · --phieu-m2 · --cham-m2');
  return 2;
}

if (require.main === module) process.exitCode = main();
module.exports = { kiemDangKy, khoaDangKy, soKhoa, docBang, chuyen, kiemKhuon, m1, dungPhieuM2, kiemBugs, chamM2, KHUON, main };
