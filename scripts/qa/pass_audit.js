#!/usr/bin/env node
/**
 * pass_audit.js — ĐO TỈ LỆ PASS SAI bằng cách cho NGƯỜI chấm lại một mẫu NGẪU NHIÊN các case PASS.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ FILE NÀY
 *
 * "Verdict đã kiểm chứng" (có step, có ảnh, qua gate) chưa phải "verdict đúng": một case có assertion lệch expected
 * vẫn đủ chứng cứ về hình thức. Tín hiệu độ đúng duy nhất kit có là DEV nhận hay bác bug (`bug:outcome:backlog`) —
 * nó chỉ đo phía FAIL. Một PASS sai không sinh bug, nên không ai thấy nó. Máy này đo phía đó.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * BỐN CHỐT — mỗi cái chặn một đường làm con số đẹp mà sai
 *
 *   1. MẪU NGẪU NHIÊN CÓ SEED, ghi vào sổ lúc bốc. Người chấm không chọn case; nhập kết quả phải đúng TẬP đã bốc —
 *      bỏ case khó hay đổi case là bị từ chối. Bỏ case khó là cách nhanh nhất kéo tỉ lệ sai về 0.
 *   2. PHIẾU KHÔNG CHỨA LỜI KHAI CỦA AUTOMATION (comment của step). Người chấm chỉ thấy kỳ vọng trong testcase
 *      canonical và ảnh. Đọc lời khai trước là bị neo vào kết luận của agent — chấm lại thành đọc lại.
 *   3. "KHÔNG PHÁN ĐƯỢC" là lựa chọn hợp lệ nhưng KHÔNG thành "đúng" (CLAUDE.md §3). Báo cáo in hai cận: cận dưới
 *      coi nó là đúng, cận trên coi nó là sai. Tỉ lệ "không phán được" cao tự nó là phát hiện: verdict dựa vào thứ
 *      ảnh không cho thấy.
 *   4. NGƯỜI CHẤM PHẢI LÀ NGƯỜI. Agent chấm lại verdict của agent là app==app. Tên người chấm là lời tự khai — máy
 *      chỉ chặn được tên rõ ràng là máy; phần còn lại là trách nhiệm của người ký.
 *
 * Dùng:
 *   node scripts/qa/pass_audit.js --task <KEY> --chon 20 [--seed 12345] [--project-output outputs/CSDL]   ⇒ phiếu chấm
 *   node scripts/qa/pass_audit.js --ghi <phiếu đã chấm.md>                                              ⇒ vào sổ
 *   node scripts/qa/pass_audit.js [--task <KEY>] [--json]                                               ⇒ báo cáo
 * Sổ: knowledge/metrics/pass-audit.json · Exit: 0 · 1 khi nhập phiếu bị từ chối · 2 khi chưa có lượt chấm nào
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { docBangCase } = require('./tc_semantic');

const REPO = path.resolve(__dirname, '..', '..');
const SO_MAC_DINH = path.join(REPO, 'knowledge', 'metrics', 'pass-audit.json');
const KET_LUAN = ['dung', 'sai', 'khong_phan_duoc'];
const TEN_MAY = /\b(claude|agent|bot|gpt|ai|máy|auto)\b/i;
const ANH = /\.(png|jpe?g|webp|mp4|webm)$/i;

/* ─────────────────────────────── thuần ─────────────────────────────── */

/** PRNG có seed (mulberry32) — cùng seed, cùng tổng thể ⇒ cùng mẫu. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bốc `n` phần tử từ `tongThe` (đã sắp) bằng Fisher–Yates một phần. */
function boc(tongThe, n, seed) {
  const a = [...tongThe].sort();
  const r = prng(seed);
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(r() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

const bam = (ds) => crypto.createHash('sha256').update([...ds].sort().join('\n')).digest('hex').slice(0, 16);

/** Khoảng tin cậy Wilson 95% cho tỉ lệ k/n. n = 0 ⇒ null. */
function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const tam = (p + (z * z) / (2 * n)) / d;
  const r = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, tam - r), Math.min(1, tam + r)];
}

/** Tổng thể: case PASSED trong sổ verdict, chia theo có / không có trong testcase canonical. */
function tongTheTu(status, caseMd) {
  const tests = Array.isArray(status.tests) ? status.tests : Object.values(status.tests || {});
  const coMd = new Set(caseMd.map((c) => c.id));
  const pass = [...new Set(tests.filter((t) => t && t.status === 'PASSED').map((t) => t.tcId))];
  return { coThe: pass.filter((id) => coMd.has(id)).sort(), thieuMd: pass.filter((id) => !coMd.has(id)).sort() };
}

const motDong = (s) => String(s || '').replace(/<br\s*\/?>/gi, ' · ').replace(/\s+/g, ' ').trim();

/** Phiếu chấm Markdown. KHÔNG chứa comment của step — xem chốt 2. */
function phieu({ maMau, task, seed, tongThe, chon, caseMd, tests, thuMucPhieu }) {
  const theoId = new Map(caseMd.map((c) => [c.id, c]));
  const tId = new Map(tests.map((t) => [t.tcId, t]));
  const d = [
    `# Chấm lại PASS — ${task} · mẫu ${maMau}`,
    '',
    '<!-- ĐỪNG sửa 3 dòng dưới: máy dùng chúng để khớp phiếu với mẫu đã bốc. -->',
    `- ma_mau: ${maMau}`,
    `- seed: ${seed} · tổng thể ${tongThe.length} case PASS · bốc ${chon.length} · bam ${bam(chon)}`,
    '- nguoi_cham: ',
    '',
    'Chấm TỪNG case chỉ từ **kỳ vọng** và **ảnh** dưới đây (ảnh xếp theo thứ tự bước) — đừng mở spec hay log của automation.',
    '`ket_luan` là một trong: `dung` (ảnh cho thấy đúng kỳ vọng) · `sai` (ảnh cho thấy khác kỳ vọng) ·',
    '`khong_phan_duoc` (ảnh không đủ để nói). Chọn `sai` thì `ly_do` nói ảnh nào, khác kỳ vọng ở đâu.',
    '',
  ];
  for (const [i, id] of chon.entries()) {
    const c = theoId.get(id);
    const t = tId.get(id) || {};
    d.push(`## ${i + 1}. ${id} — ${motDong(c.tieuDe)}`, '');
    if (c.duLieu) d.push(`- **Dữ liệu test:** ${motDong(c.duLieu)}`);
    d.push(`- **Kết quả mong đợi:** ${motDong(c.kyVong)}`, '- **Ảnh:**');
    /* KHÔNG kèm tên bước: tên do automation đặt cũng là lời khai ("Bước 2 — Đúng 3 lựa chọn, đúng từng ký tự" — đo
     * trên phiếu thử đầu tiên, CSDL-9001 TC_092). Chỉ giữ thứ tự ảnh. Ảnh trùng giữa các bước chỉ liệt kê một lần. */
    const anh = [...new Set([...(t.steps || []).flatMap((s) => s.evidence || []), ...(t.steps && t.steps.length ? [] : (t.evidence || []))].filter((e) => ANH.test(e)))];
    if (!anh.length) d.push('  - (không có ảnh — chỉ chấm được `khong_phan_duoc`)');
    for (const [k, e] of anh.entries()) {
      const rel = path.relative(thuMucPhieu, path.join(REPO, e)).replace(/\\/g, '/');
      d.push(`  - ảnh ${k + 1}/${anh.length}: [${path.basename(e)}](${encodeURI(rel)})`);
    }
    d.push('', `ket_luan[${id}]: `, `ly_do[${id}]: `, '');
  }
  return `${d.join('\n')}\n`;
}

/** Đọc phiếu đã chấm. Trả `{ maMau, bam, nguoiCham, ketQua: { id: { ketLuan, lyDo } } }`. */
function docPhieu(md) {
  const lay = (re) => { const m = md.match(re); return m ? m[1].trim() : ''; };
  const ketQua = {};
  for (const m of md.matchAll(/^ket_luan\[([^\]]+)\]:[ \t]*(.*)$/gm)) ketQua[m[1]] = { ketLuan: m[2].trim().toLowerCase(), lyDo: '' };
  for (const m of md.matchAll(/^ly_do\[([^\]]+)\]:[ \t]*(.*)$/gm)) if (ketQua[m[1]]) ketQua[m[1]].lyDo = m[2].trim();
  return {
    maMau: lay(/^- ma_mau:[ \t]*(.*)$/m),
    bam: lay(/·[ \t]*bam[ \t]+([0-9a-f]+)/),
    nguoiCham: lay(/^- nguoi_cham:[ \t]*(.*)$/m),
    ketQua,
  };
}

/** Kiểm phiếu với mẫu trong sổ. Trả danh sách lỗi — rỗng mới được ghi. */
function kiemPhieu(p, mau) {
  const loi = [];
  if (!mau) return [`không có mẫu "${p.maMau || '(trống)'}" trong sổ — phiếu phải sinh bằng --chon`];
  if (mau.ketQua) loi.push(`mẫu ${mau.maMau} ĐÃ được ghi lúc ${mau.ghiLuc} — chấm lại thì bốc mẫu mới`);
  if (p.bam !== bam(mau.chon)) loi.push('dòng "bam" không khớp mẫu đã bốc — phiếu đã bị sửa phần đầu');
  if (!p.nguoiCham) loi.push('thiếu `nguoi_cham`');
  else if (TEN_MAY.test(p.nguoiCham)) loi.push(`\`nguoi_cham\` "${p.nguoiCham}" là tên máy — agent chấm lại verdict của agent là app==app`);
  const coPhieu = Object.keys(p.ketQua);
  const thieu = mau.chon.filter((id) => !coPhieu.includes(id));
  const la = coPhieu.filter((id) => !mau.chon.includes(id));
  if (thieu.length) loi.push(`thiếu ${thieu.length} case của mẫu: ${thieu.join(', ')} — bỏ case khó làm tỉ lệ sai đẹp hơn thật`);
  if (la.length) loi.push(`có ${la.length} case KHÔNG thuộc mẫu: ${la.join(', ')}`);
  for (const id of mau.chon) {
    const k = p.ketQua[id];
    if (!k) continue;
    if (!KET_LUAN.includes(k.ketLuan)) loi.push(`${id}: ket_luan "${k.ketLuan}" — phải là ${KET_LUAN.join(' | ')}`);
    else if (k.ketLuan === 'sai' && k.lyDo.length < 10) loi.push(`${id}: chấm "sai" thì ly_do phải nói ảnh nào khác kỳ vọng ở đâu`);
  }
  return loi;
}

/** Gộp các mẫu ĐÃ chấm thành tỉ lệ. */
function tinh(mauDaCham) {
  const dem = { dung: 0, sai: 0, khong_phan_duoc: 0 };
  const caSai = [];
  for (const m of mauDaCham) {
    for (const [id, k] of Object.entries(m.ketQua)) {
      dem[k.ketLuan] += 1;
      if (k.ketLuan === 'sai') caSai.push({ task: m.task, id, lyDo: k.lyDo, nguoiCham: m.nguoiCham });
    }
  }
  const n = dem.dung + dem.sai + dem.khong_phan_duoc;
  const phanDuoc = dem.dung + dem.sai;
  return {
    soMau: mauDaCham.length,
    n,
    ...dem,
    /* tỉ lệ trên phần phán được, kèm Wilson 95% */
    tiLeSai: phanDuoc ? dem.sai / phanDuoc : null,
    ci95: wilson(dem.sai, phanDuoc),
    /* hai cận trên TOÀN mẫu: "không phán được" coi là đúng / coi là sai */
    canDuoi: n ? dem.sai / n : null,
    canTren: n ? (dem.sai + dem.khong_phan_duoc) / n : null,
    caSai,
  };
}

/* ─────────────────────────────── vào-ra ─────────────────────────────── */

const docSo = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { mau: [] }; } };
const ghiSo = (f, so) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(so, null, 2)}\n`, 'utf8'); };
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

function main(argv = process.argv.slice(2)) {
  const lay = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const so = lay('--so') ? path.resolve(lay('--so')) : SO_MAC_DINH;
  const po = lay('--project-output') || process.env.PROJECT_OUTPUT_DIR || 'outputs/CSDL';
  const task = lay('--task');

  if (lay('--chon')) {
    const n = Number(lay('--chon'));
    if (!task || !Number.isInteger(n) || n < 1) { console.error('[pass-audit] --chon cần --task <KEY> và một số nguyên dương.'); return 2; }
    const goc = path.join(REPO, po, 'tasks', task);
    const fStatus = lay('--status') ? path.resolve(lay('--status')) : path.join(goc, 'test-results', 'testcase-status.json');
    let status;
    try { status = JSON.parse(fs.readFileSync(fStatus, 'utf8')); } catch (e) { console.error(`[pass-audit] KHÔNG PHÁN ĐƯỢC — không đọc được sổ verdict ${path.relative(REPO, fStatus)}.`); return 2; }
    const thuMucTc = path.join(goc, 'test-cases');
    const caseMd = fs.existsSync(thuMucTc) ? fs.readdirSync(thuMucTc).filter((f) => f.endsWith('.md')).flatMap((f) => docBangCase(fs.readFileSync(path.join(thuMucTc, f), 'utf8'))) : [];
    const { coThe, thieuMd } = tongTheTu(status, caseMd);
    if (!coThe.length) { console.error('[pass-audit] KHÔNG PHÁN ĐƯỢC — không có case PASS nào có trong testcase canonical.'); return 2; }
    const seed = lay('--seed') ? Number(lay('--seed')) >>> 0 : crypto.randomBytes(4).readUInt32BE(0);
    const chon = boc(coThe, n, seed);
    const maMau = `${task}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}-${seed}`;
    const thuMucPhieu = path.join(goc, 'reports', 'pass-audit');
    fs.mkdirSync(thuMucPhieu, { recursive: true });
    const tests = Array.isArray(status.tests) ? status.tests : Object.values(status.tests || {});
    const fPhieu = path.join(thuMucPhieu, `${maMau}.md`);
    fs.writeFileSync(fPhieu, phieu({ maMau, task, seed, tongThe: coThe, chon, caseMd, tests, thuMucPhieu }), 'utf8');
    const s = docSo(so);
    s.mau = s.mau || [];
    s.mau.push({ maMau, task, seed, tongThe: coThe.length, bam: bam(chon), chon, bocLuc: new Date().toISOString(), runId: status.runId || null });
    ghiSo(so, s);
    console.log(`[pass-audit] bốc ${chon.length}/${coThe.length} case PASS (seed ${seed}) → ${path.relative(REPO, fPhieu)}`);
    if (thieuMd.length) console.log(`  ⚠ ${thieuMd.length} case PASS không có trong testcase canonical — không chấm được, không vào tổng thể: ${thieuMd.slice(0, 5).join(', ')}${thieuMd.length > 5 ? ' …' : ''}`);
    console.log('  Đưa phiếu cho NGƯỜI chấm — agent chấm lại verdict của agent là app==app. Xong thì: --ghi <phiếu>');
    return 0;
  }

  if (lay('--ghi')) {
    const f = path.resolve(lay('--ghi'));
    let md;
    try { md = fs.readFileSync(f, 'utf8'); } catch (e) { console.error(`[pass-audit] không đọc được phiếu ${f}`); return 1; }
    const p = docPhieu(md);
    const s = docSo(so);
    const mau = (s.mau || []).find((m) => m.maMau === p.maMau);
    const loi = kiemPhieu(p, mau);
    if (loi.length) {
      console.error('[pass-audit] TỪ CHỐI ghi phiếu:');
      for (const l of loi) console.error(`  · ${l}`);
      return 1;
    }
    mau.ketQua = Object.fromEntries(mau.chon.map((id) => [id, p.ketQua[id]]));
    mau.nguoiCham = p.nguoiCham;
    mau.ghiLuc = new Date().toISOString();
    ghiSo(so, s);
    const t = tinh([mau]);
    console.log(`[pass-audit] đã ghi mẫu ${mau.maMau}: ${t.dung} đúng · ${t.sai} sai · ${t.khong_phan_duoc} không phán được`);
    return 0;
  }

  const s = docSo(so);
  const daCham = (s.mau || []).filter((m) => m.ketQua && (!task || m.task === task));
  const choCham = (s.mau || []).filter((m) => !m.ketQua && (!task || m.task === task));
  const t = tinh(daCham);
  if (argv.includes('--json')) { console.log(JSON.stringify({ ...t, choCham: choCham.map((m) => m.maMau) }, null, 2)); return t.n ? 0 : 2; }
  if (!t.n) {
    console.log(`[pass-audit] KHÔNG PHÁN ĐƯỢC — chưa có mẫu nào được chấm${task ? ` cho ${task}` : ''}. Chưa đo không có nghĩa là PASS đều đúng.`);
    if (choCham.length) console.log(`  ${choCham.length} mẫu đang chờ chấm: ${choCham.map((m) => m.maMau).join(', ')}`);
    return 2;
  }
  console.log(`[pass-audit] ${t.soMau} mẫu · ${t.n} case PASS được người chấm lại${task ? ` · ${task}` : ''}`);
  console.log(`  ${t.dung} đúng · ${t.sai} SAI · ${t.khong_phan_duoc} không phán được`);
  console.log(`  tỉ lệ PASS sai (trên ${t.dung + t.sai} case phán được): ${pct(t.tiLeSai)}${t.ci95 ? ` · 95%: ${pct(t.ci95[0])}–${pct(t.ci95[1])}` : ''}`);
  console.log(`  hai cận trên toàn mẫu: ${pct(t.canDuoi)} (coi "không phán được" là đúng) – ${pct(t.canTren)} (coi là sai)`);
  if (t.khong_phan_duoc) console.log(`  ℹ ${t.khong_phan_duoc}/${t.n} case không phán được từ ảnh — verdict của chúng dựa vào thứ evidence không cho thấy.`);
  for (const x of t.caSai) console.log(`  ✗ ${x.task} ${x.id}: ${x.lyDo}`);
  if (choCham.length) console.log(`  ${choCham.length} mẫu đang chờ chấm: ${choCham.map((m) => m.maMau).join(', ')}`);
  if (t.n < 30) console.log(`  ⚠ mới ${t.n} case — khoảng tin cậy còn rộng; đừng đọc tỉ lệ như một con số chắc.`);
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { prng, boc, bam, wilson, tongTheTu, phieu, docPhieu, kiemPhieu, tinh, main };
