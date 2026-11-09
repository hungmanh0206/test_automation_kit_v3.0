#!/usr/bin/env node
/**
 * bug_outcome — SỔ KẾT CỤC, và lời khai thẳng về cái KHÔNG tính được.
 *
 * Dùng:
 *   node scripts/qa/bug_outcome.js                              báo cáo, gộp MỌI task
 *   node scripts/qa/bug_outcome.js --ghi <TC_ID> --nhan <nhãn> --nguon <ai> --vi-sao <lý do>
 *   node scripts/qa/bug_outcome.js --enforce                    CHẶN khi claim đã log quá hạn mà chưa có nhãn
 *   node scripts/qa/bug_outcome.js --goc <thư mục>              chạy trên một cây khác (để đo được)
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Chủ dự án nêu ba điều kit chưa chứng minh được. Điều thứ ba: *"chưa có tỷ lệ false PASS, false bug,
 * missed bug và inconclusive"*. Đúng. Và lý do không phải thiếu công cụ tính — mà là **SỔ BỎ RƠI LỚP
 * ÂM**: chẩn đoán của chính kit ghi *62 bản ghi bug mà chỉ 1 Rejected, trong khi biết chắc có ≥2*.
 *
 * Không ai tính được tỉ lệ sai từ một cuốn sổ chỉ chép phần đúng. Nên việc đầu tiên không phải thu
 * thêm dữ liệu — mà là **ĐẾM, và nói ra phần chưa đếm được**.
 *
 * `bug:claim --report` đã có, nhưng nó đo QUY TRÌNH CỦA KIT (claim theo trạng thái, tỉ lệ tự rút) và
 * chỉ nhìn MỘT task. Máy này đo **PHÁN QUYẾT CỦA BÊN NGOÀI** và gộp MỌI task — hai câu hỏi khác nhau,
 * nên hai máy khác nhau.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * NGUYÊN TẮC: KHÔNG BAO GIỜ IN MỘT TỈ LỆ MÀ KHÔNG IN MẪU SỐ CỦA NÓ.
 *
 * Một con số "8% false bug" tính trên 2 claim có nhãn trong 40 claim đã log thì nó KHÔNG phải tỉ lệ
 * của dự án — nó là tỉ lệ của hai cái được chép vào sổ. In nó trần trụi là nói dối bằng số thật.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const iGoc = process.argv.indexOf('--goc');
const arg = (ten) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const has = (c) => process.argv.includes(`--${c}`);

const REPO = path.resolve(__dirname, '..', '..');
const GOC = iGoc >= 0 && process.argv[iGoc + 1]
  ? path.resolve(process.argv[iGoc + 1])
  : String(process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs', 'CSDL'));

/*
 * NHÃN. `chua_biet` KHÔNG nằm trong danh sách: vắng nhãn là vắng nhãn, không phải một nhãn. Cho nó
 * một tên riêng là mở đường để ai đó "điền cho đủ" rồi coi như đã đếm.
 */
const NHAN = {
  accepted: 'DEV nhận là bug và sửa',
  rejected: 'DEV bác — không phải bug',
  by_design: 'đúng thiết kế',
  duplicate: 'trùng issue đã có',
  cannot_verify: 'không kiểm lại được (môi trường đổi, dữ liệu mất)',
};
const SAI = new Set(['rejected', 'by_design', 'duplicate']);
const HAN_NGAY = 14;

function liet(goc) {
  const ra = [];
  let tasks = [];
  try { tasks = fs.readdirSync(path.join(goc, 'tasks'), { withFileTypes: true }); } catch (e) { return ra; }
  for (const t of tasks) {
    if (!t.isDirectory()) continue;
    const d = path.join(goc, 'tasks', t.name, 'reports', 'bug-claims');
    let fs2 = [];
    try { fs2 = fs.readdirSync(d).filter((f) => f.endsWith('.json')); } catch (e) { continue; }
    for (const f of fs2) {
      try { ra.push({ task: t.name, file: path.join(d, f), claim: JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) }); } catch (e) { /* bỏ file hỏng, bug:claim mới là chỗ gác cú pháp */ }
    }
  }
  return ra;
}

/* ─── ghi một nhãn ───────────────────────────────────────────────────────────────────────────────── */
function ghi() {
  const tc = arg('ghi');
  const nhan = arg('nhan');
  const nguon = arg('nguon');
  const viSao = arg('vi-sao');
  if (!tc || !nhan) { console.error('[outcome] cần `--ghi <TC_ID> --nhan <nhãn>`'); return 2; }
  if (!NHAN[nhan]) {
    console.error(`[outcome] nhãn "${nhan}" không hợp lệ. Chọn: ${Object.keys(NHAN).join(' · ')}`);
    return 2;
  }
  /* NGUỒN BẮT BUỘC: một nhãn không biết ai đặt thì lần sau không ai dám tin nó. */
  if (!nguon || nguon.trim().length < 2) { console.error('[outcome] cần `--nguon <ai/đâu quyết>` — nhãn vô chủ thì không kiểm lại được'); return 2; }
  if (SAI.has(nhan) && viSao.trim().length < 10) {
    console.error(`[outcome] nhãn "${nhan}" là một kết luận NGƯỢC với claim — bắt buộc \`--vi-sao\` ≥ 10 ký tự.`);
    return 2;
  }
  const ds = liet(GOC).filter((c) => String(c.claim.tc_id) === tc);
  if (!ds.length) { console.error(`[outcome] không thấy claim nào cho \`${tc}\` dưới ${GOC}`); return 1; }
  for (const c of ds) {
    c.claim.ket_cuc = { nhan, nguon: nguon.trim(), at: new Date().toISOString(), vi_sao: viSao.trim() || undefined };
    fs.writeFileSync(c.file, `${JSON.stringify(c.claim, null, 2)}\n`, 'utf8');
    console.log(`[outcome] ${c.task}/${path.basename(c.file)} ⇒ ${nhan}`);
  }
  return 0;
}

/* ─── báo cáo ────────────────────────────────────────────────────────────────────────────────────── */
function baoCao() {
  const ds = liet(GOC);
  const daLog = ds.filter((c) => c.claim.status !== 'withdrawn');
  const daRut = ds.length - daLog.length;
  const coNhan = daLog.filter((c) => c.claim.ket_cuc && NHAN[c.claim.ket_cuc.nhan]);
  const theoNhan = {};
  for (const c of coNhan) theoNhan[c.claim.ket_cuc.nhan] = (theoNhan[c.claim.ket_cuc.nhan] || 0) + 1;

  console.log(`[outcome] gộp ${new Set(ds.map((c) => c.task)).size} task dưới ${path.relative(REPO, GOC) || GOC}`);
  console.log(`  claim tổng: ${ds.length}  ·  đã log: ${daLog.length}  ·  tự rút trước khi log: ${daRut}`);

  /*
   * HAI CÂU HỎI KHÁC NHAU, SỔ PHẢI TRẢ LỜI CẢ HAI.
   *   ① Kit tự bắt được bao nhiêu claim sai TRƯỚC khi nói thành lời?  — có số thật, từ lịch sử.
   *   ② Bên ngoài phán thế nào về phần đã nói ra?                      — đó là phần sổ đang rỗng.
   * Gộp hai cái làm một "tỉ lệ sai" là trộn thứ kit tự sửa với thứ kit chưa biết mình sai.
   */
  if (ds.length) {
    const boi = {};
    for (const c of ds) {
      if (c.claim.status !== 'withdrawn') continue;
      const k = String(c.claim.withdrawn_by_check || '(không ghi)').replace(/\s+/g, ' ').slice(0, 80);
      boi[k] = (boi[k] || 0) + 1;
    }
    console.log(`  ① KIT TỰ BẮT: ${daRut}/${ds.length} = ${((daRut / ds.length) * 100).toFixed(0)}% claim bị rút trước khi nói thành lời`);
    const top = Object.entries(boi).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [k, v] of top) console.log(`      ${String(v).padStart(3)}  ${k}${k.length >= 80 ? '…' : ''}`);
    if (Object.keys(boi).length > top.length) console.log(`      … và ${Object.keys(boi).length - top.length} lý do khác`);
    console.log('  ② BÊN NGOÀI PHÁN:');
  }

  if (!daLog.length) {
    console.log('  CHƯA ĐO ĐƯỢC — không có claim nào đã log. Đây KHÔNG phải "0% sai".');
  } else if (!coNhan.length) {
    /* Đây đúng là tình trạng hôm nay, và nó phải đọc ra được chứ không được làm tròn thành 0%. */
    console.log(`  CHƯA ĐO ĐƯỢC TỈ LỆ — 0/${daLog.length} claim đã log có nhãn kết cục.`);
    console.log('  Không ai tính được tỉ lệ sai từ một cuốn sổ chỉ chép phần đúng.');
    console.log(`  Ghi nhãn: node scripts/qa/bug_outcome.js --ghi <TC_ID> --nhan <${Object.keys(NHAN).join('|')}> --nguon <ai> --vi-sao <...>`);
  } else {
    const sai = coNhan.filter((c) => SAI.has(c.claim.ket_cuc.nhan)).length;
    console.log('  theo nhãn:');
    for (const [k, v] of Object.entries(theoNhan).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k} — ${NHAN[k]}`);
    console.log('');
    console.log(`  TỈ LỆ FALSE BUG: ${sai}/${coNhan.length} = ${((sai / coNhan.length) * 100).toFixed(0)}%`);
    console.log(`  ⚠ MẪU SỐ LÀ ${coNhan.length}, KHÔNG PHẢI ${daLog.length}. ${daLog.length - coNhan.length} claim đã log chưa có nhãn.`);
    console.log('    Con số trên là tỉ lệ của phần ĐƯỢC CHÉP VÀO SỔ, không phải tỉ lệ của dự án.');
  }

  /* Quá hạn mà chưa có nhãn — chỗ sổ đang rò, nêu đích danh. */
  const qua = daLog.filter((c) => {
    if (c.claim.ket_cuc && NHAN[c.claim.ket_cuc.nhan]) return false;
    const moc = Math.max(...(Array.isArray(c.claim.reruns) ? c.claim.reruns : [])
      .map((r) => Date.parse((r && r.at) || '')).filter(Number.isFinite), -Infinity);
    return Number.isFinite(moc) && (Date.now() - moc) / 86400000 > HAN_NGAY;
  });
  if (qua.length) {
    console.log('');
    console.log(`  ${qua.length} claim đã log quá ${HAN_NGAY} ngày mà chưa có nhãn — đây là chỗ sổ đang rò:`);
    for (const c of qua.slice(0, 10)) console.log(`    ${c.task}/${c.claim.tc_id}`);
    if (qua.length > 10) console.log(`    … và ${qua.length - 10} cái nữa`);
  }

  /*
   * PHẦN QUAN TRỌNG NHẤT CỦA MÁY NÀY. Chủ dự án hỏi BỐN tỉ lệ. Sổ này chỉ tính được HAI, và nói
   * thẳng hai cái kia vì sao không — thay vì im lặng để người đọc tưởng đã có đủ.
   */
  console.log('');
  console.log('  BỐN TỈ LỆ ĐƯỢC HỎI — máy này tính được những gì:');
  console.log('    ✓ false bug    — tính được TỪ NHÃN ở trên (rejected · by_design · duplicate)');
  console.log('    ✓ inconclusive — tính được từ verdict BLOCKED/cannot_verify trong sổ execute');
  console.log('    ✗ false PASS   — KHÔNG tính được ở đây: case chấm PASS mà thực ra sai thì nó không');
  console.log('                     để lại claim nào. Chỉ lộ qua một nguồn NGOÀI kit.');
  console.log('    ✗ missed bug   — KHÔNG tính được ở đây, theo ĐỊNH NGHĨA: bug bỏ sót không nằm trong');
  console.log('                     sổ nào. Chỉ lộ qua lọt ra production, hoặc qua một BỘ CASE ĐỘC LẬP');
  console.log('                     do người viết (kit đang có bộ 929 case để đối chiếu).');
  console.log('    ⇒ hai dòng ✗ KHÔNG phải "chưa làm" mà là "máy này sai chỗ": chúng cần nguồn khác.');

  /* Ghi sổ tích luỹ — một con số chỉ sống trong màn hình thì lần sau không ai so được với gì. */
  const so = path.join(REPO, 'knowledge', 'metrics', 'bug-outcomes.json');
  try {
    fs.mkdirSync(path.dirname(so), { recursive: true });
    fs.writeFileSync(so, `${JSON.stringify({
      at: new Date().toISOString(),
      goc: path.relative(REPO, GOC) || GOC,
      claim_tong: ds.length,
      da_log: daLog.length,
      tu_rut: daRut,
      co_nhan: coNhan.length,
      theo_nhan: theoNhan,
      qua_han_chua_nhan: qua.length,
      _luu_y: 'tỉ lệ false bug tính trên `co_nhan`, KHÔNG trên `da_log`. Mẫu số phải đi kèm con số.',
    }, null, 2)}\n`, 'utf8');
    console.log('');
    console.log(`  đã ghi sổ: ${path.relative(REPO, so).split(path.sep).join('/')}`);
  } catch (e) { console.log(`  (không ghi được sổ: ${e.message})`); }

  if (has('enforce') && qua.length) {
    console.error('');
    console.error(`[outcome] ✗ CHẶN — ${qua.length} claim đã log quá ${HAN_NGAY} ngày mà chưa có kết cục.`);
    console.error('  Sổ bỏ rơi lớp âm thì mọi tỉ lệ tính từ nó đều đẹp hơn sự thật.');
    return 1;
  }
  return 0;
}

const ma = has('ghi') || arg('ghi') ? ghi() : baoCao();
if (ma) process.exit(1);
