#!/usr/bin/env node
'use strict';
/*
 * judge — CHẤM PHẦN MÁY KHÔNG ĐO ĐƯỢC, có lấy mẫu và có hiệu chuẩn (v2.7.0 §A11).
 *
 * MÁY NÀY KHÔNG CHẤM. Nó chọn mẫu, giữ thang, kiểm lời chấm có đủ neo, và đo xem người chấm có hiệu
 * chuẩn hay không. Việc chấm là của agent (hoặc subagent). Lẫn hai việc đó là lý do một "LLM judge" hay
 * được tin hơn mức nó đáng: nếu cùng một thứ vừa chấm vừa tự xác nhận mình chấm đúng thì không có phép
 * đo nào xảy ra.
 *
 * VÌ SAO TẦNG NÀY TỒN TẠI. `rule:coverage` (§A10.7) trả lời được "luật nào có máy thi hành". Phần còn
 * lại KHÔNG được để trống: một mục ghi "không đo được bằng máy" mà rồi không ai chấm thì nhãn đó chỉ là
 * một lời miễn trừ. Thang chấm ở `.agent/config/judge_rubric.json` — 5 thuộc tính, mỗi cái kèm lý do nó
 * không có máy, nhìn vào đâu, và bằng chứng nào phải nêu.
 *
 * BA LUẬT KHÔNG ĐỔI ĐƯỢC, và chúng là phần dễ bị bỏ nhất:
 *
 *   1. CHẤM CHƯA HIỆU CHUẨN ⇒ CHƯA ĐƯỢC GÁC (exit 2), không phải "đạt". Một lời chấm bằng phán đoán
 *      không có đơn vị — nó nghe như kết luận trong khi có thể chỉ là văn phong. Hiệu chuẩn cho nó một
 *      con số: trên những ca rõ ràng, người chấm này đồng ý với nhãn bao nhiêu phần.
 *   2. MỖI LỜI CHẤM PHẢI NÊU BẰNG CHỨNG (TC ID, đường dẫn, hoặc số dòng). Không neo thì là
 *      `OBSERVATION`, không phải verdict — cùng luật với §3 ở tầng testcase.
 *   3. TẦNG NÀY KHÔNG GHI ĐÈ VERDICT CỦA MÁY T0. Nó chấm thứ máy không chạm tới. Cho phép nó ghi đè là
 *      mở một đường "phán đoán thắng phép đo", và đường đó sẽ được dùng đúng vào lúc máy đang đúng.
 *
 * LẤY MẪU, và vì sao mẫu phải TẤT ĐỊNH. Chấm 200 case bằng phán đoán là không khả thi, nên phải lấy mẫu.
 * Nhưng một mẫu chọn tuỳ ý thì người chấm chọn được case dễ, và tỉ lệ đạt sẽ nói về cách chọn mẫu chứ
 * không nói về bộ case. Nên mẫu lấy theo HẠT GIỐNG ghi lại được: cùng task + cùng hạt + cùng mẫu số ⇒
 * cùng danh sách. Mẫu số cũng được ghi, vì một tỉ lệ không có mẫu số là một con số không có nghĩa.
 *
 * Dùng:
 *   node scripts/qa/judge.js --rubric                       # in thang chấm
 *   node scripts/qa/judge.js --sample --task <K> [--n 12]   # chọn mẫu tất định
 *   node scripts/qa/judge.js --calib-form                   # in bộ hiệu chuẩn để chấm
 *   node scripts/qa/judge.js --calib-score <file.json>      # tính tỉ lệ đúng, ghi mốc hiệu chuẩn
 *   node scripts/qa/judge.js --check --task <K>             # kiểm lời chấm: đủ mẫu, đủ neo, còn hiệu chuẩn
 *
 * Exit: 0 · 1 khi lời chấm thiếu/không đủ neo · 2 khi CHƯA ĐƯỢC GÁC (chưa hiệu chuẩn, hoặc không có mẫu số)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));

const RUBRIC = path.join(REPO, '.agent', 'config', 'judge_rubric.json');
const CALIB = path.join(REPO, '.agent', 'config', 'judge_calibration.json');
const MOC_CALIB = path.join(REPO, '.agent', 'config', '.judge_calibration_moc.json');

const val = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const JSON_OUT = process.argv.includes('--json');

function doc(p, nhan) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    console.error(`[judge] ✗ không đọc được ${nhan} (${path.relative(REPO, p)}): ${e.message}`);
    process.exit(2);
    return null;
  }
}

/* ────────────────────────────── LẤY MẪU ────────────────────────────── */

/**
 * Hạt giống TẤT ĐỊNH từ (task, mẫu số, danh sách id). Cùng ba thứ đó ⇒ cùng mẫu.
 *
 * Không dùng `Math.random` và không dùng thời gian: một mẫu không lặp lại được thì không ai kiểm lại
 * được lời chấm, và "chấm lại thấy khác" sẽ bị đọc thành "bộ case đã đổi".
 */
function hatGiong(taskKey, ids) {
  return crypto.createHash('sha256').update(`${taskKey}|${ids.length}|${ids.join(',')}`).digest();
}

/** Bộ sinh số giả-ngẫu nhiên từ hạt giống — lặp lại được trên mọi máy. */
function boSinh(hat) {
  let i = 0;
  return () => {
    if (i >= hat.length - 4) i = 0;
    const v = hat.readUInt32BE(i);
    i += 4;
    return v / 0xffffffff;
  };
}

/**
 * Chọn mẫu PHÂN TẦNG theo module, không chọn đều.
 *
 * Chọn đều trên 200 case của 26 module sẽ bỏ trắng nhiều module, và một module bị bỏ trắng là chỗ mà
 * "mẫu đại diện cho bộ" thành không đúng. Phân tầng đảm bảo mỗi module có mặt ít nhất một case khi mẫu
 * còn đủ chỗ.
 */
function layMau(cases, n, taskKey) {
  const ids = cases.map((c) => c.tcId).sort();
  const rnd = boSinh(hatGiong(taskKey, ids));
  /*
   * TẦNG LÀ PHẦN TRƯỚC DẤU `/` CỦA CỘT MODULE, không phải cả ô.
   *
   * Đo trên CSDL-9001 (213 case): ô `Module` mang cả phần mô tả sau dấu gạch
   * ("Cập nhật hồ sơ trường / Ba ô chỉ đọc ở cấp trường"), nên cắt theo cả ô cho 196 tầng trên 213 case
   * — gần như mỗi case một tầng, và phân tầng mất hết tác dụng. Cắt trước dấu `/` cho 5 tầng thật:
   * Xem hồ sơ trường (47) · Cập nhật (123) · Kết nối Internet (10) · Hạ tầng CNTT (20) · Điểm trường phụ (13).
   */
  const tangCua = (c) => String(c.module || '(không module)').split('/')[0].trim() || '(không module)';
  const theoModule = new Map();
  for (const c of cases) {
    const k = tangCua(c);
    if (!theoModule.has(k)) theoModule.set(k, []);
    theoModule.get(k).push(c);
  }
  const tang = [...theoModule.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  /*
   * PHÂN TẦNG MẤT TÁC DỤNG thì phải KHAI, không im lặng.
   *
   * Nếu số tầng xấp xỉ số case thì "mỗi tầng một case" chỉ là liệt kê, và câu "mẫu phân tầng theo module"
   * trong báo cáo sẽ nói về một thứ không xảy ra.
   */
  const tangVoNghia = tang.length > cases.length / 2;
  const chon = [];

  /* Vòng 1: một case mỗi module, chọn bằng hạt giống. */
  for (const [, ds] of tang) {
    if (chon.length >= n) break;
    const d = [...ds].sort((a, b) => String(a.tcId).localeCompare(String(b.tcId)));
    chon.push(d[Math.floor(rnd() * d.length) % d.length]);
  }
  /* Vòng 2: lấp phần còn lại từ toàn bộ, bỏ case đã chọn. */
  const conLai = cases.filter((c) => !chon.includes(c))
    .sort((a, b) => String(a.tcId).localeCompare(String(b.tcId)));
  while (chon.length < n && conLai.length) {
    chon.push(conLai.splice(Math.floor(rnd() * conLai.length) % conLai.length, 1)[0]);
  }
  return { chon, so_tang: tang.length, tang_vo_nghia: tangVoNghia, hat: hatGiong(taskKey, ids).toString('hex').slice(0, 16) };
}

function docCases(taskOutputDir) {
  const ra = [];
  for (const d of rc.getTestcaseDirs(taskOutputDir)) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.md'))) {
      try { ra.push(...(canonical.parseMarkdown(fs.readFileSync(path.join(d, f), 'utf8')).tests || [])); } catch (e) { /* không phải bảng canonical */ }
    }
  }
  return ra;
}

function duongChamCua(taskOutputDir) {
  return path.join(taskOutputDir, 'reports', 'judge-verdicts.json');
}
function duongMauCua(taskOutputDir) {
  return path.join(taskOutputDir, 'reports', 'judge-sample.json');
}

/* ────────────────────────────── HIỆU CHUẨN ────────────────────────────── */

function trangThaiHieuChuan() {
  const cfg = doc(CALIB, 'bộ hiệu chuẩn');
  if (!fs.existsSync(MOC_CALIB)) {
    return { ok: false, vi_sao: 'CHƯA hiệu chuẩn lần nào', nguong: cfg._nguong };
  }
  const moc = doc(MOC_CALIB, 'mốc hiệu chuẩn');
  const ngay = Math.floor((Date.now() - Date.parse(moc.luc)) / 86400000);
  if (Number.isNaN(ngay)) return { ok: false, vi_sao: 'mốc hiệu chuẩn không có dấu thời gian đọc được', nguong: cfg._nguong };
  if (ngay > cfg._nguong.so_ngay_het_han) {
    return { ok: false, vi_sao: `hiệu chuẩn đã ${ngay} ngày, quá hạn ${cfg._nguong.so_ngay_het_han} ngày`, moc, nguong: cfg._nguong };
  }
  if (moc.ti_le < cfg._nguong.ti_le_dung_toi_thieu) {
    return { ok: false, vi_sao: `tỉ lệ đúng ${(moc.ti_le * 100).toFixed(0)}% dưới ngưỡng ${(cfg._nguong.ti_le_dung_toi_thieu * 100).toFixed(0)}%`, moc, nguong: cfg._nguong };
  }
  if (moc.so_ca !== (cfg.ca || []).length) {
    return { ok: false, vi_sao: `mốc chấm ${moc.so_ca} ca mà bộ hiệu chuẩn giờ có ${(cfg.ca || []).length} ca — bộ đã đổi, phải chấm lại`, moc, nguong: cfg._nguong };
  }
  return { ok: true, ngay, moc, nguong: cfg._nguong };
}

function chamHieuChuan(file) {
  const cfg = doc(CALIB, 'bộ hiệu chuẩn');
  const loiCham = doc(path.resolve(file), 'lời chấm hiệu chuẩn');
  const nhan = new Map((cfg.ca || []).map((c) => [c.id, c]));
  const ds = Array.isArray(loiCham) ? loiCham : (loiCham.cham || []);

  const thieu = [...nhan.keys()].filter((id) => !ds.some((x) => x.id === id));
  if (thieu.length) {
    console.error(`[judge] ✗ lời chấm thiếu ${thieu.length}/${nhan.size} ca: ${thieu.join(', ')}`);
    console.error('  Chấm một phần bộ hiệu chuẩn rồi tính tỉ lệ là chọn mẫu sau khi thấy kết quả.');
    process.exit(1);
  }

  /*
   * TỰ CHẤM LÀ VÔ NGHĨA, và máy phải nói ra chuyện đó chứ không im lặng ghi một con số đẹp.
   *
   * Nếu người chấm trùng người viết nhãn thì tỉ lệ đúng chỉ đo khả năng nhớ nhãn mình vừa viết. Lượt đó
   * vẫn được ghi (để có dấu vết), nhưng bị đánh dấu `tu_cham`, và mọi `--check` sau đó in cảnh báo.
   * Hiệu chuẩn CÓ NGHĨA phải do một người chấm KHÔNG thấy cột nhãn.
   */
  const chamBoi = String(loiCham.cham_boi || '').trim();
  if (!chamBoi) {
    console.error('[judge] ✗ lời chấm hiệu chuẩn không khai `cham_boi`.');
    console.error('  Phải biết AI chấm, vì nếu người chấm trùng người viết nhãn thì tỉ lệ đúng không đo gì.');
    process.exit(1);
  }
  const tuCham = chamBoi === String(cfg._nhan_do_ai_viet || '').trim();

  const sai = [];
  for (const x of ds) {
    const n = nhan.get(x.id);
    if (!n) continue;
    if (String(x.cham) !== String(n.nhan)) sai.push({ id: x.id, muc: n.muc, cham: x.cham, nhan: n.nhan, vi_sao_nhan: n.vi_sao_nhan });
  }
  const tiLe = (nhan.size - sai.length) / nhan.size;
  const moc = {
    _y: 'MỐC HIỆU CHUẨN của tầng chấm §A11. Hết hạn thì mọi lời chấm thành CHƯA ĐƯỢC GÁC.',
    luc: new Date().toISOString(),
    so_ca: nhan.size,
    so_sai: sai.length,
    ti_le: Number(tiLe.toFixed(4)),
    cham_boi: chamBoi,
    tu_cham: tuCham,
    _canh_bao: tuCham
      ? 'LƯỢT NÀY TỰ CHẤM: người chấm trùng người viết nhãn, nên tỉ lệ đúng KHÔNG đo độ chính xác. Nó chỉ đo khả năng nhớ nhãn.'
      : undefined,
    sai,
  };
  fs.writeFileSync(MOC_CALIB, `${JSON.stringify(moc, null, 2)}\n`, 'utf8');

  console.log(`[judge] hiệu chuẩn: ${nhan.size - sai.length}/${nhan.size} đúng (${(tiLe * 100).toFixed(0)}%), ngưỡng ${(cfg._nguong.ti_le_dung_toi_thieu * 100).toFixed(0)}%`);
  console.log(`[judge] chấm bởi: ${chamBoi}`);
  if (tuCham) {
    console.warn('[judge] ⚠ TỰ CHẤM — người chấm trùng người viết nhãn. Tỉ lệ trên KHÔNG đo độ chính xác,');
    console.warn('  nó chỉ đo khả năng nhớ nhãn. Hiệu chuẩn có nghĩa phải do một người chấm không thấy nhãn.');
  }
  for (const s of sai) {
    console.log(`  SAI ${s.id} [${s.muc}]: chấm "${s.cham}" · nhãn "${s.nhan}"`);
    console.log(`      nhãn vì: ${s.vi_sao_nhan}`);
  }
  if (tiLe < cfg._nguong.ti_le_dung_toi_thieu) {
    console.error('[judge] ✗ DƯỚI NGƯỠNG — mọi lời chấm của lượt này KHÔNG dùng được.');
    console.error('  Bộ này chỉ gồm ca RÕ RÀNG, nên sai ở đây là dấu hiệu đọc sai thang, không phải khác biệt phán đoán.');
    process.exit(1);
  }
  console.log(`[judge] ✓ đã ghi mốc → ${path.relative(REPO, MOC_CALIB)}`);
}

/* ────────────────────────────── KIỂM LỜI CHẤM ────────────────────────────── */

const RE_NEO = /[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+|[\w./-]+\.(?:md|json|js|ts|xlsx)(?::\d+)?|dòng \d+/;
const VERDICT = ['dat', 'khong_dat', 'OBSERVATION'];

function kiemLoiCham(taskKey, taskOutputDir) {
  const hc = trangThaiHieuChuan();
  const fMau = duongMauCua(taskOutputDir);
  const fCham = duongChamCua(taskOutputDir);
  const van = [];
  const chan = [];

  if (!hc.ok) {
    console.error(`[judge] CHƯA ĐƯỢC GÁC — ${hc.vi_sao}.`);
    console.error('  Chấm bằng phán đoán mà không có hiệu chuẩn thì không có đơn vị: nó nghe như một kết');
    console.error('  luận trong khi có thể chỉ là một văn phong. Chạy `judge:calib-form` rồi `judge:calib-score`.');
    process.exit(2);
  }

  if (!fs.existsSync(fMau)) {
    console.error(`[judge] CHƯA ĐƯỢC GÁC — không có mẫu (${path.relative(REPO, fMau)}).`);
    console.error('  Chọn mẫu bằng: node scripts/qa/judge.js --sample --task <TASK_KEY>');
    process.exit(2);
  }
  const mau = doc(fMau, 'mẫu đã chọn');
  if (!mau.mau_so) {
    console.error('[judge] CHƯA ĐƯỢC GÁC — mẫu không khai MẪU SỐ. Một tỉ lệ không có mẫu số là con số không nghĩa.');
    process.exit(2);
  }

  if (!fs.existsSync(fCham)) {
    console.error(`[judge] ✗ chưa có lời chấm (${path.relative(REPO, fCham)}).`);
    console.error('  Thang chấm: node scripts/qa/judge.js --rubric');
    process.exit(1);
  }
  const cham = doc(fCham, 'lời chấm');
  const ds = Array.isArray(cham) ? cham : (cham.cham || []);
  const rubric = doc(RUBRIC, 'thang chấm');
  const mucHopLe = new Set((rubric.muc || []).map((m) => m.id));

  /* 1. Đủ mẫu: mọi case trong mẫu phải được chấm ĐỦ mọi mục của thang. */
  for (const tcId of mau.chon) {
    for (const m of mucHopLe) {
      if (!ds.some((x) => x.tcId === tcId && x.muc === m)) {
        chan.push(`${tcId} · ${m}: chưa chấm`);
      }
    }
  }

  /* 2. Mỗi lời chấm hợp khuôn, và CÓ NEO. */
  for (const x of ds) {
    const nhan = `${x.tcId || '(không TC ID)'} · ${x.muc || '(không mục)'}`;
    if (!mucHopLe.has(x.muc)) { chan.push(`${nhan}: mục không có trong thang chấm`); continue; }
    if (!VERDICT.includes(String(x.cham))) { chan.push(`${nhan}: verdict "${x.cham}" ngoài ${VERDICT.join('/')}`); continue; }
    if (!x.bang_chung || !RE_NEO.test(String(x.bang_chung))) {
      chan.push(`${nhan}: bằng chứng không có neo cụ thể (cần TC ID, đường dẫn, hoặc số dòng)`);
      continue;
    }
    if (String(x.cham) === 'OBSERVATION' && !x.cau_hoi_mo) {
      van.push(`${nhan}: OBSERVATION mà không kèm \`cau_hoi_mo\` — một quan sát không có câu hỏi thì không ai theo tiếp được`);
    }
  }

  /* 3. KHÔNG được ghi đè verdict máy. */
  for (const x of ds) {
    if (x.ghi_de || x.override) chan.push(`${x.tcId} · ${x.muc}: lời chấm đòi GHI ĐÈ verdict máy — tầng này không có quyền đó`);
  }

  const dat = ds.filter((x) => x.cham === 'dat').length;
  const khong = ds.filter((x) => x.cham === 'khong_dat').length;
  const obs = ds.filter((x) => x.cham === 'OBSERVATION').length;

  const kq = {
    task: taskKey,
    hieu_chuan: { ti_le: hc.moc.ti_le, ngay_tuoi: hc.ngay },
    mau: { so_chon: mau.chon.length, mau_so: mau.mau_so, hat: mau.hat, so_tang: mau.so_tang },
    cham: { dat, khong_dat: khong, OBSERVATION: obs, tong: ds.length },
    chan,
    van,
  };
  if (JSON_OUT) { console.log(JSON.stringify(kq, null, 2)); process.exit(chan.length ? 1 : 0); }

  console.log(`[judge] task ${taskKey} · mẫu ${mau.chon.length}/${mau.mau_so} case (${mau.so_tang} module, hạt ${mau.hat})`);
  console.log(`[judge] hiệu chuẩn ${(hc.moc.ti_le * 100).toFixed(0)}% · ${hc.ngay} ngày tuổi · chấm bởi ${hc.moc.cham_boi || '(không khai)'}`);
  if (hc.moc.tu_cham) {
    console.warn('[judge] ⚠ hiệu chuẩn của lượt này là TỰ CHẤM (người chấm trùng người viết nhãn), nên con số');
    console.warn('  trên không đo độ chính xác. Mọi lời chấm dưới đây phải được đọc kèm cảnh báo này.');
  }
  console.log(`[judge] chấm: ${dat} đạt · ${khong} không đạt · ${obs} OBSERVATION`);
  if (van.length) { console.log(''); for (const x of van) console.log(`  ~ ${x}`); }
  if (chan.length) {
    console.error('');
    console.error(`✗ ${chan.length} vi phạm CHẶN:`);
    for (const x of chan.slice(0, 20)) console.error(`  ${x}`);
    if (chan.length > 20) console.error(`  … +${chan.length - 20} nữa`);
    process.exit(1);
  }
  console.log('\n✓ Lời chấm đủ mẫu, đủ neo, và người chấm còn hiệu chuẩn.');
}

/* ────────────────────────────── MAIN ────────────────────────────── */

function main() {
  if (process.argv.includes('--rubric')) {
    const r = doc(RUBRIC, 'thang chấm');
    console.log(`[judge] THANG CHẤM — ${r.muc.length} mục (phần máy KHÔNG đo được):\n`);
    for (const m of r.muc) {
      console.log(`${m.id} — ${m.ten}`);
      console.log(`  luật:        ${m.nguon_luat}`);
      console.log(`  không máy vì: ${m.vi_sao_khong_co_may}`);
      console.log(`  nhìn vào:    ${m.nhin_vao_dau}`);
      console.log(`  ĐẠT:         ${m.dat}`);
      console.log(`  KHÔNG ĐẠT:   ${m.khong_dat}`);
      console.log(`  phải nêu:    ${m.bang_chung_phai_neu}\n`);
    }
    for (const l of r._luat_khong_doi_duoc) console.log(`  · ${l}`);
    return;
  }

  if (process.argv.includes('--calib-form')) {
    const cfg = doc(CALIB, 'bộ hiệu chuẩn');
    console.log(`[judge] BỘ HIỆU CHUẨN — ${cfg.ca.length} ca. Chấm từng ca là \`dat\` hoặc \`khong_dat\`,`);
    console.log('  rồi ghi ra file JSON dạng [{"id":"CAL-01","cham":"khong_dat"}, …] và chạy `--calib-score <file>`.');
    console.log(`  GIỚI HẠN: ${cfg._gioi_han_phai_doc}\n`);
    for (const c of cfg.ca) console.log(`${c.id} [${c.muc}]  ${c.dau_vao}`);
    return;
  }

  const fCalib = val('calib-score', null);
  if (fCalib) { chamHieuChuan(fCalib); return; }

  if (process.argv.includes('--calib-status')) {
    const hc = trangThaiHieuChuan();
    if (!hc.ok) { console.error(`[judge] ✗ ${hc.vi_sao}`); process.exit(2); }
    console.log(`[judge] ✓ hiệu chuẩn ${(hc.moc.ti_le * 100).toFixed(0)}% · ${hc.ngay} ngày tuổi · ${hc.moc.so_ca} ca`);
    return;
  }

  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[judge] ✗ không xác định được task: ${e.message}`);
    console.error('        Cần TASK_KEY + PROJECT_OUTPUT_DIR (hoặc --task <TASK_KEY>).');
    process.exit(2);
  }

  if (process.argv.includes('--sample')) {
    const cases = docCases(taskOutputDir);
    if (!cases.length) {
      console.error(`[judge] CHƯA ĐƯỢC GÁC — 0 case đọc được ở ${path.relative(REPO, taskOutputDir)}.`);
      console.error('  Mẫu 0 case KHÔNG phải "không có gì để chấm": nó nghĩa là phép đo hỏng.');
      process.exit(2);
    }
    const n = Math.min(Number(val('n', 12)) || 12, cases.length);
    const { chon, so_tang: soTang, tang_vo_nghia: tangVoNghia, hat } = layMau(cases, n, taskKey);
    const ra = {
      _y: 'MẪU đã chọn để chấm §A11. Tất định theo (task, mẫu số, danh sách id) — cùng ba thứ đó ⇒ cùng mẫu.',
      luc: new Date().toISOString(),
      task: taskKey,
      mau_so: cases.length,
      so_tang: soTang,
      tang_vo_nghia: tangVoNghia,
      hat,
      chon: chon.map((c) => c.tcId),
    };
    const f = duongMauCua(taskOutputDir);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, `${JSON.stringify(ra, null, 2)}\n`, 'utf8');
    console.log(`[judge] đã chọn ${chon.length}/${cases.length} case từ ${soTang} module (hạt ${hat}) → ${path.relative(REPO, f)}`);
    if (tangVoNghia) {
      console.warn(`[judge] ⚠ ${soTang} tầng trên ${cases.length} case — PHÂN TẦNG MẤT TÁC DỤNG ở bộ này.`);
      console.warn('  Mẫu vẫn tất định, nhưng đừng viết "mẫu phân tầng theo module" trong báo cáo: ở đây nó');
      console.warn('  gần như mỗi tầng một case. Thường là vì ô `Module` mang cả phần mô tả sau dấu `/`.');
    }
    for (const c of chon) console.log(`  ${c.tcId}  ${String(c.module || '').slice(0, 28).padEnd(28)} ${String(c.title || '').slice(0, 56)}`);
    return;
  }

  if (process.argv.includes('--check')) { kiemLoiCham(taskKey, taskOutputDir); return; }

  console.error('[judge] cần một trong: --rubric · --sample · --calib-form · --calib-score <file> · --calib-status · --check');
  process.exit(2);
}

if (require.main === module) main();

module.exports = { layMau, hatGiong, boSinh, trangThaiHieuChuan, RE_NEO, VERDICT, RUBRIC, CALIB, MOC_CALIB };
