#!/usr/bin/env node
'use strict';
/*
 * risk_log.js — SỔ RỦI RO DỰ ÁN (`knowledge/risks/`). KHÁC `risk-register` của `risk:score`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * HAI SỔ, HAI CÂU HỎI — đừng gộp:
 *   · `risk:score` → `reports/risk-register.{md,json}`: chấm Likelihood × Impact THEO MODULE để chia ĐỘ
 *     SÂU TEST. Sinh lại mỗi lần chạy, khoá theo tên module. Không có owner/giảm thiểu — nó không cần.
 *   · Sổ này: rủi ro của DỰ ÁN/LƯỢT TEST (môi trường sập, phụ thuộc chưa sẵn, dữ liệu thiếu, tiến độ…), mỗi
 *     cái có NGƯỜI CHỊU, CÁCH GIẢM THIỂU và HẠN. Ghi tay, sống qua nhiều task.
 * Một file gánh cả hai thì hoặc owner bị xoá mỗi lần sinh lại, hoặc register module mang một đống ô trống.
 *
 * RISK ID ỔN ĐỊNH, KHÔNG TÁI SỬ DỤNG. ID do MÁY cấp (`--new`), không gõ tay, và sổ cấp phát
 * `_so_cap_phat.json` ghi số cuối đã cấp. Nhờ vậy:
 *   · xoá file RISK-007 rồi tạo mới KHÔNG ra lại RISK-007 — báo cáo cũ, Backlog, biên bản họp nhắc
 *     "RISK-007" vẫn chỉ đúng một rủi ro;
 *   · số đã cấp mà không còn file ⇒ CHẶN: rủi ro chỉ được ĐÓNG (`status: closed` + lý do), không được
 *     xoá. Xoá là mất dấu vết đúng thứ người ta sẽ hỏi lại sau sự cố.
 * Sổ cấp phát là `.json` CÓ CHỦ Ý: `knowledge:backup` chỉ chép `.json`. Sổ nằm ngoài backup thì khôi phục
 * xong là mất dấu số đã cấp, và số cao nhất bị xoá sẽ được cấp lại.
 *
 * ĐIỂM VÀ BAND KHÔNG LƯU — tính lúc đọc từ `risk_model.json#bands`, cùng ngưỡng với `risk:score`. Lưu điểm
 * vào file là có hai nguồn ngưỡng, và đổi ngưỡng thì sổ cũ nói sai.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng:
 *   npm run risks                         # kiểm schema + liệt kê rủi ro đang mở (quá hạn lên đầu)
 *   npm run risks -- --task <TASK_KEY>    # chỉ rủi ro gắn task đó
 *   npm run risks:enforce                 # lỗi schema / ID mất file ⇒ exit 1
 *   npm run risks:new -- --title "<tiêu đề>"   # cấp ID mới + khung file để điền
 *   [--dir <thư mục>] cho spec chạy trên thư mục tạm
 * Exit: 0 · 1 (--enforce và có lỗi) · 2 (dùng sai)
 */
const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const { EMAIL_RE, PHONE_RE } = require('./lib/pii_mask');

const REPO = rc.REPO_ROOT;
const TRANG_THAI = ['open', 'mitigating', 'accepted', 'closed'];
const NHOM = ['moi_truong', 'phu_thuoc', 'du_lieu', 'tien_do', 'nhan_luc', 'ky_thuat', 'bao_mat', 'khac'];
const ID_RE = /^RISK-(\d{3,})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SO_CAP_PHAT = '_so_cap_phat.json';
const TOI_THIEU_GIAM_THIEU = 20;
/* Ô khung mà `--new` để lại — còn nó nghĩa là CHƯA điền. */
const KHUNG = '<ĐIỀN>';

const homNay = () => new Date().toISOString().slice(0, 10);
const soCua = (id) => { const m = ID_RE.exec(String(id || '')); return m ? Number(m[1]) : null; };
const maCua = (n) => `RISK-${String(n).padStart(3, '0')}`;

/** Band từ CÙNG ngưỡng với `risk:score`. Không đọc được thì nói ra, không tự đặt ngưỡng. */
function napBands() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(REPO, '.agent', 'config', 'risk_model.json'), 'utf8'));
    if (m.bands && Number.isFinite(m.bands.High) && Number.isFinite(m.bands.Medium)) return m.bands;
  } catch (e) { /* xử ở dưới */ }
  return null;
}
function bandCua(diem, bands) {
  if (!bands) return 'KHÔNG RÕ';
  if (diem >= bands.High) return 'High';
  if (diem >= bands.Medium) return 'Medium';
  return 'Low';
}

function docSo(dir) {
  const p = path.join(dir, SO_CAP_PHAT);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __loi: e.message }; }
}

function docRuiRo(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => {
      const p = path.join(dir, f);
      let data;
      try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { data = { __loi: e.message }; }
      return { file: f, data };
    });
}

/** Kiểm MỘT rủi ro. Trả `{ loi: [], canhBao: [] }`. */
function kiemMot({ file, data: r }) {
  const loi = [];
  const canhBao = [];
  const o = (m) => `${file}: ${m}`;
  if (r.__loi) return { loi: [o(`JSON hỏng — ${r.__loi}`)], canhBao };

  if (soCua(r.id) === null) loi.push(o(`\`id\` "${r.id}" sai khuôn RISK-<NNN>`));
  else if (file !== `${r.id}.json`) loi.push(o(`tên file phải là \`${r.id}.json\` — lệch tên thì tra theo ID ra sai file`));
  const blob = JSON.stringify(r);
  if (blob.includes(KHUNG)) loi.push(o(`còn ô \`${KHUNG}\` chưa điền`));
  if (!String(r.title || '').trim()) loi.push(o('thiếu `title`'));
  if (!NHOM.includes(r.category)) loi.push(o(`\`category\` phải ∈ ${NHOM.join('|')}`));
  for (const k of ['likelihood', 'impact']) {
    if (!Number.isInteger(r[k]) || r[k] < 1 || r[k] > 5) loi.push(o(`\`${k}\` phải là số nguyên 1–5 (cùng thang với risk_model.json)`));
  }
  if (!String(r.owner || '').trim()) loi.push(o('thiếu `owner` — rủi ro không ai chịu là rủi ro không ai xử'));
  if (String(r.mitigation || '').trim().length < TOI_THIEU_GIAM_THIEU) {
    loi.push(o(`\`mitigation\` phải ≥ ${TOI_THIEU_GIAM_THIEU} ký tự và nói LÀM GÌ — "theo dõi" không phải giảm thiểu`));
  }
  if (!DATE_RE.test(String(r.due_date || ''))) loi.push(o('`due_date` (YYYY-MM-DD) bắt buộc — giảm thiểu không có hạn thì không bao giờ trễ, và cũng không bao giờ xong'));
  if (r.review_date !== undefined && r.review_date !== '' && !DATE_RE.test(String(r.review_date))) loi.push(o('`review_date` phải là YYYY-MM-DD'));
  if (!TRANG_THAI.includes(r.status)) loi.push(o(`\`status\` phải ∈ ${TRANG_THAI.join('|')}`));
  if (r.tasks !== undefined && !Array.isArray(r.tasks)) loi.push(o('`tasks` phải là mảng mã task'));
  if (!DATE_RE.test(String(r.created_at || ''))) loi.push(o('`created_at` phải là YYYY-MM-DD'));

  /* Đóng và chấp nhận là hai quyết định — phải có người và lý do, không chỉ đổi một chữ. */
  if (r.status === 'closed') {
    if (!DATE_RE.test(String(r.closed_at || ''))) loi.push(o('`closed` cần `closed_at` (YYYY-MM-DD)'));
    if (String(r.close_reason || '').trim().length < 10) loi.push(o('`closed` cần `close_reason` — đóng vì đã xử hay vì không còn đúng?'));
  }
  if (r.status === 'accepted' && !String(r.accepted_by || '').trim()) {
    loi.push(o('`accepted` cần `accepted_by` — chấp nhận rủi ro là quyết định của một người cụ thể'));
  }
  if (EMAIL_RE.test(blob) || PHONE_RE.test(blob)) loi.push(o('có EMAIL/SĐT — knowledge cấm PII (CLAUDE.md §1)'));
  return { loi, canhBao };
}

/**
 * Kiểm cả sổ. Trả `{ loi, canhBao, ruiRo, soCuoi }`.
 *
 * Phép kiểm "ID mất file" là lý do sổ cấp phát tồn tại: không có nó, xoá một rủi ro không để lại dấu gì.
 */
function kiemSo(dir) {
  const ds = docRuiRo(dir);
  const loi = [];
  const canhBao = [];
  for (const x of ds) { const k = kiemMot(x); loi.push(...k.loi); canhBao.push(...k.canhBao); }

  const theoId = new Map();
  for (const x of ds) {
    const id = x.data && x.data.id;
    if (!id) continue;
    if (theoId.has(id)) loi.push(`${id}: có ở HAI file (${theoId.get(id)} · ${x.file}) — một ID chỉ được chỉ một rủi ro`);
    else theoId.set(id, x.file);
  }

  const so = docSo(dir);
  const soMax = Math.max(0, ...[...theoId.keys()].map(soCua).filter((n) => n !== null));
  let soCuoi = soMax;
  if (so && so.__loi) {
    loi.push(`${SO_CAP_PHAT} hỏng JSON (${so.__loi}) — không biết số nào đã cấp thì không cấp tiếp được an toàn`);
  } else if (!so) {
    if (ds.length) canhBao.push(`thiếu ${SO_CAP_PHAT} trong khi đã có ${ds.length} rủi ro — không kiểm được ID nào đã bị xoá. Khôi phục từ \`knowledge:backup\` nếu có; \`--new\` sẽ dựng lại sổ từ số lớn nhất hiện có.`);
  } else {
    const cuoi = Number(so.so_cuoi) || 0;
    if (soMax > cuoi) loi.push(`có ${maCua(soMax)} nhưng sổ cấp phát mới tới ${maCua(cuoi)} — ID được gõ tay, không qua \`risks:new\``);
    soCuoi = Math.max(cuoi, soMax);
    for (let n = 1; n <= cuoi; n += 1) {
      if (!theoId.has(maCua(n))) {
        loi.push(`${maCua(n)} đã cấp nhưng KHÔNG còn file — rủi ro chỉ được ĐÓNG (\`status: closed\` + \`close_reason\`), không được xoá. Khôi phục file từ \`knowledge:backup\`.`);
      }
    }
  }
  return { loi, canhBao, ruiRo: ds.filter((x) => !x.data.__loi), soCuoi };
}

/** Cấp ID mới. Ghi sổ TRƯỚC, file SAU: đứt giữa chừng thì mất một số (thấy được), không bao giờ cấp trùng. */
function capMoi(dir, tieuDe, ngay = homNay()) {
  const k = kiemSo(dir);
  const so = docSo(dir);
  if (so && so.__loi) return { loi: `${SO_CAP_PHAT} hỏng JSON — sửa trước khi cấp ID mới` };
  const n = k.soCuoi + 1;
  const id = maCua(n);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SO_CAP_PHAT), `${JSON.stringify({
    _la_gi: 'Sổ cấp phát Risk ID — số cuối đã cấp. KHÔNG sửa tay, KHÔNG xoá: mất sổ thì không còn cách nào biết một ID đã từng tồn tại.',
    so_cuoi: n,
    cap_luc: ngay,
  }, null, 2)}\n`, 'utf8');
  const khung = {
    id,
    title: String(tieuDe || '').trim() || KHUNG,
    description: KHUNG,
    category: KHUNG,
    likelihood: KHUNG,
    impact: KHUNG,
    owner: KHUNG,
    mitigation: KHUNG,
    due_date: KHUNG,
    review_date: '',
    status: 'open',
    tasks: [],
    created_at: ngay,
    updated_at: ngay,
    _goi_y: `category ∈ ${NHOM.join('|')} · likelihood/impact 1–5 · status ∈ ${TRANG_THAI.join('|')}. Đóng thì thêm closed_at + close_reason; chấp nhận thì thêm accepted_by. Không xoá file này.`,
  };
  const p = path.join(dir, `${id}.json`);
  fs.writeFileSync(p, `${JSON.stringify(khung, null, 2)}\n`, 'utf8');
  return { id, duong: p };
}

/** Dòng hiển thị cho rủi ro chưa đóng — quá hạn lên đầu, rồi theo điểm. */
function bangMo(ruiRo, { task = null, ngay = homNay(), bands = napBands() } = {}) {
  return ruiRo
    .map((x) => x.data)
    .filter((r) => r.status !== 'closed')
    .filter((r) => !task || (Array.isArray(r.tasks) && r.tasks.includes(task)))
    .map((r) => {
      const diem = Number.isInteger(r.likelihood) && Number.isInteger(r.impact) ? r.likelihood * r.impact : null;
      const quaHan = r.status !== 'accepted' && DATE_RE.test(String(r.due_date || '')) && r.due_date < ngay;
      const quaHanXem = DATE_RE.test(String(r.review_date || '')) && r.review_date < ngay;
      return { ...r, diem, band: diem === null ? 'KHÔNG RÕ' : bandCua(diem, bands), qua_han: quaHan, qua_han_xem_lai: quaHanXem };
    })
    .sort((a, b) => (Number(b.qua_han) - Number(a.qua_han)) || ((b.diem || 0) - (a.diem || 0)));
}

function main() {
  const argv = process.argv;
  const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  const dir = path.resolve(val('dir') || path.join(REPO, 'knowledge', 'risks'));
  const rel = path.relative(REPO, dir) || dir;

  if (argv.includes('--new')) {
    const t = val('title');
    if (!t) { console.error('[risks] cần `--title "<tiêu đề>"` — ID chỉ cấp cho một rủi ro có tên.'); process.exit(2); }
    const r = capMoi(dir, t);
    if (r.loi) { console.error(`[risks] ✗ ${r.loi}`); process.exit(1); }
    console.log(`[risks] đã cấp ${r.id} → ${path.relative(REPO, r.duong)}`);
    console.log(`  Điền mọi ô ${KHUNG} rồi chạy \`npm run risks:enforce\`. ID này không bao giờ được cấp lại, kể cả khi file bị xoá.`);
    process.exit(0);
  }

  const k = kiemSo(dir);
  const bands = napBands();
  const task = val('task');
  console.log(`[risks] sổ rủi ro dự án — ${rel} · ${k.ruiRo.length} rủi ro · ID cuối đã cấp: ${k.soCuoi ? maCua(k.soCuoi) : '(chưa cấp)'}`);
  if (!bands) console.log('  ⚠ không đọc được `risk_model.json#bands` — band ghi KHÔNG RÕ, không tự đặt ngưỡng.');

  const mo = bangMo(k.ruiRo, { task, bands });
  console.log(`\n— Đang mở${task ? ` (task ${task})` : ''}: ${mo.length} —`);
  if (!mo.length) console.log(k.ruiRo.length ? '  không có rủi ro nào chưa đóng.' : '  sổ trống. Ghi rủi ro đầu tiên: npm run risks:new -- --title "<tiêu đề>"');
  for (const r of mo) {
    const co = [r.qua_han ? 'QUÁ HẠN' : '', r.qua_han_xem_lai ? 'quá hạn xem lại' : ''].filter(Boolean).join(' · ');
    console.log(`  ${r.id} [${r.band}${r.diem !== null ? ` ${r.diem}` : ''}] ${r.status}${co ? ` · ${co}` : ''} — ${r.title}`);
    console.log(`    người chịu: ${r.owner || '?'} · hạn: ${r.due_date || '?'} · giảm thiểu: ${String(r.mitigation || '?').slice(0, 120)}`);
  }

  k.canhBao.forEach((m) => console.log(`  ⚠ ${m}`));
  if (k.loi.length) {
    console.log(`\n[risks] ✗ ${k.loi.length} lỗi:`);
    k.loi.forEach((m) => console.log(`  - ${m}`));
    if (argv.includes('--enforce')) process.exit(1);
    console.log('  Chặn được bằng: npm run risks:enforce');
  } else {
    console.log('\n[risks] ✓ sổ hợp lệ.');
  }
  process.exit(0);
}

module.exports = { kiemMot, kiemSo, capMoi, bangMo, bandCua, maCua, SO_CAP_PHAT, KHUNG };
if (require.main === module) main();
