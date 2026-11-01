#!/usr/bin/env node
'use strict';

/*
 * audit_ci.js (GĐ-U3) — npm audit cho CI, phân biệt rõ 2 tình huống:
 *   - CÓ vuln high/critical (prod deps)         → CHẶN (exit 1).
 *   - AUDIT_SERVICE_UNAVAILABLE (mạng/registry) → KHÔNG chặn (exit 0) — audit fail do hạ tầng ≠ có lỗ hổng,
 *     tránh CI đỏ oan khi registry chập chờn.
 * Mặc định chặn từ mức `high` (đổi qua --level moderate|high|critical). Chỉ prod deps (--omit=dev).
 *
 * MỘT CON SỐ DƯỚI NGƯỠNG KHÔNG MANG THÔNG TIN (thêm 01/11/2026).
 *
 * Bản trước in `moderate 12` rồi `✓ OK — 0 vuln ≥ high`. Câu đó đúng, nhưng `12` không nói được 12 cái
 * đó là advisory đã rà hay vừa có cái mới. Đo cùng ngày: tôi báo với người dùng `8 advisory moderate
 * (uuid, exceljs)` — sai con số (12), sai tên gói (không có `uuid`), sai cả bản chất (12 gói là TÁN của
 * ĐÚNG MỘT advisory `minimatch`). Tôi đọc con số đó từ trí nhớ vì bản thân nó không chở theo gì để
 * đối chiếu. Một advisory MỚI chui vào dưới ngưỡng là vô hình theo đúng cách đó.
 *
 * Nên cửa này nay giải advisory ra theo mã GHSA và đòi MỖI CÁI dưới ngưỡng có một dòng khai ở
 * `.agent/config/audit_allow.json`, kèm phép đo và HẠN DÙNG. Chưa khai ⇒ CHẶN — không phải vì nó nguy
 * hiểm, mà vì chưa ai xem. Hết hạn ⇒ CHẶN, vì một rủi ro đã nhận mà không có hạn thì chuyển từ
 * "đã cân nhắc" sang "đã quên" mà không có dấu hiệu nào.
 *
 * Dùng: node scripts/qa/audit_ci.js [--level high] [--from-json <tệp>] [--hom-nay YYYY-MM-DD]
 *   `--from-json` nạp output `npm audit --json` từ tệp thay vì gọi registry — để bộ test lái được cửa
 *   này bằng fixture tất định, thay vì phụ thuộc tình trạng registry lúc chạy.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const SO_KHAI = path.join(REPO, '.agent', 'config', 'audit_allow.json');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const LEVEL = arg('level', 'high'); // moderate | high | critical
const TU_TEP = arg('from-json', null);
const HOM_NAY = arg('hom-nay', new Date().toISOString().slice(0, 10));
const ORDER = { low: 0, moderate: 1, high: 2, critical: 3 };
const minRank = ORDER[LEVEL] != null ? ORDER[LEVEL] : ORDER.high;

let raw = '';
if (TU_TEP) {
  try { raw = fs.readFileSync(TU_TEP, 'utf8'); } catch (e) {
    console.error(`[audit] ✗ không đọc được --from-json ${TU_TEP}: ${e.message}`);
    process.exit(2);
  }
} else {
  try {
    raw = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // npm audit EXIT ≠ 0 khi CÓ vuln — nhưng stdout VẪN chứa JSON. Lấy stdout đó.
    raw = (e.stdout || '').toString();
  }
}

let data = null;
try { data = JSON.parse(raw); } catch (e) { data = null; }

// Không có JSON hợp lệ, hoặc npm báo lỗi hạ tầng → AUDIT_SERVICE_UNAVAILABLE (không chặn).
if (!data || data.error || !data.metadata || !data.metadata.vulnerabilities) {
  const detail = data && data.error ? (data.error.summary || data.error.code || 'error') : 'không parse được output npm audit';
  console.warn(`[audit] AUDIT_SERVICE_UNAVAILABLE: không chạy được npm audit (${detail}) → BỎ QUA (không chặn CI; audit fail do hạ tầng ≠ có lỗ hổng).`);
  process.exit(0);
}

/*
 * GIẢI RA THEO ADVISORY, KHÔNG THEO GÓI. `npm audit` liệt kê mỗi GÓI bị ảnh hưởng, nên một advisory
 * hiện ra nhiều dòng — 12 dòng cho 1 advisory ở ca `minimatch`. Khoá theo `GHSA-…` lấy từ `via` là
 * object (via dạng chuỗi chỉ là tên gói trung gian trong chuỗi phụ thuộc, không phải một advisory).
 */
function giaiAdvisory(d) {
  const goi = d.vulnerabilities || {};
  const theoMa = new Map();
  const dat = (x, tenGoc) => {
    const ma = String(x.url || '').match(/GHSA-[0-9a-z-]+/i);
    const khoa = ma ? ma[0] : `KHONG-CO-MA:${x.title || x.source || tenGoc}`;
    if (!theoMa.has(khoa)) {
      theoMa.set(khoa, {
        ma: khoa, muc: x.severity || (goi[tenGoc] || {}).severity, goi: x.module_name || tenGoc,
        tieu_de: x.title || '(không có tiêu đề)', url: x.url || '', anh_huong: new Set(),
      });
    }
    return khoa;
  };
  /*
   * TÁN PHẢI ĐI HẾT CHUỖI `via`. Chỉ gói MANG advisory có `via` là object; mọi gói bị ảnh hưởng gián
   * tiếp có `via` là CHUỖI — tên gói trung gian. Đếm mỗi gói có `via` object là đếm được 1, rồi in
   * "tán ra 1 gói" cho một advisory đang ảnh hưởng 8 gói. Đó đúng là lớp hỏng con-số-không-mang-thông-tin
   * mà máy này ra đời để chữa, nên nó không được phép tái diễn ở chính máy này. Đã cắn một lượt
   * 01/11/2026.
   */
  const dangDi = new Set();
  const nho = new Map();
  const maCua = (ten) => {
    if (nho.has(ten)) return nho.get(ten);
    if (dangDi.has(ten)) return new Set(); /* vòng trong chuỗi phụ thuộc — dừng, không đệ quy vô tận */
    dangDi.add(ten);
    const ra = new Set();
    for (const x of (goi[ten] || {}).via || []) {
      if (x && typeof x === 'object') ra.add(dat(x, ten));
      else if (typeof x === 'string' && x !== ten) for (const m of maCua(x)) ra.add(m);
    }
    dangDi.delete(ten);
    nho.set(ten, ra);
    return ra;
  };
  for (const ten of Object.keys(goi)) for (const m of maCua(ten)) theoMa.get(m).anh_huong.add(ten);
  return [...theoMa.values()].map((a) => ({ ...a, anh_huong: [...a.anh_huong].sort() }));
}

function docSoKhai() {
  if (!fs.existsSync(SO_KHAI)) return { khai: [], thieuSo: true };
  try {
    const j = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    return { khai: Array.isArray(j.khai) ? j.khai : [] };
  } catch (e) {
    console.error(`[audit] ✗ ${path.relative(REPO, SO_KHAI)} không đọc được: ${e.message}`);
    process.exit(2);
  }
  return { khai: [] };
}

const v = data.metadata.vulnerabilities;
const adv = giaiAdvisory(data);
console.log(`[audit] prod deps · low ${v.low || 0} · moderate ${v.moderate || 0} · high ${v.high || 0} · critical ${v.critical || 0} (chặn từ ${LEVEL})`);
console.log(`[audit] ${Object.keys(data.vulnerabilities || {}).length} gói bị ảnh hưởng ⇐ ${adv.length} advisory gốc (số gói KHÔNG phải số advisory).`);

const blocking = Object.entries(v).filter(([sev, n]) => ORDER[sev] != null && ORDER[sev] >= minRank && n > 0);
if (blocking.length) {
  console.error(`[audit] CHẶN: ${blocking.map(([s, n]) => `${n} ${s}`).join(' + ')} (≥ ${LEVEL}). Vá: npm audit fix / bump version.`);
  for (const a of adv.filter((x) => ORDER[x.muc] >= minRank)) console.error(`          ${a.ma} [${a.muc}] ${a.goi} — ${a.tieu_de}`);
  console.error('          Sổ `audit_allow.json` KHÔNG miễn trừ được mức này.');
  process.exit(1);
}

/* Dưới ngưỡng: mỗi advisory phải CÓ NGƯỜI XEM, và lời xem đó phải còn hạn. */
const { khai } = docSoKhai();
const theoMa = new Map(khai.filter((k) => k && k.ghsa).map((k) => [String(k.ghsa).trim(), k]));
const chuaKhai = [];
const hetHan = [];
const daKhai = [];
for (const a of adv) {
  const k = theoMa.get(a.ma);
  if (!k) { chuaKhai.push(a); continue; }
  if (!k.het_han || String(k.het_han) < HOM_NAY) { hetHan.push({ ...a, het_han: k.het_han || '(không khai)' }); continue; }
  daKhai.push({ ...a, het_han: k.het_han });
}

for (const a of daKhai) {
  console.log(`[audit] ✓ ${a.ma} [${a.muc}] ${a.goi} — đã khai, hạn ${a.het_han} · tán ra ${a.anh_huong.length} gói`);
}

if (!chuaKhai.length && !hetHan.length) {
  console.log(`[audit] ✓ OK — 0 vuln ≥ ${LEVEL}; ${daKhai.length}/${adv.length} advisory dưới ngưỡng đều đã khai và còn hạn.`);
  process.exit(0);
}

console.error('');
if (chuaKhai.length) {
  console.error(`[audit] ✗ CHẶN: ${chuaKhai.length} advisory dưới ngưỡng CHƯA AI KHAI:`);
  for (const a of chuaKhai) {
    console.error(`          ${a.ma} [${a.muc}] ${a.goi} — ${a.tieu_de}`);
    console.error(`            ảnh hưởng ${a.anh_huong.length} gói: ${a.anh_huong.slice(0, 6).join(', ')}${a.anh_huong.length > 6 ? ' …' : ''}`);
  }
  console.error('          Chặn KHÔNG phải vì nó nguy hiểm, mà vì CHƯA AI XEM. Dưới ngưỡng thì nó chỉ hiện ra');
  console.error('          thành một con số, và một con số không phân biệt được "đã rà" với "vừa xuất hiện".');
}
if (hetHan.length) {
  console.error(`[audit] ✗ CHẶN: ${hetHan.length} advisory đã khai nhưng HẾT HẠN (hôm nay ${HOM_NAY}):`);
  for (const a of hetHan) console.error(`          ${a.ma} [${a.muc}] ${a.goi} — hạn ${a.het_han}`);
  console.error('          Rủi ro đã nhận mà không rà lại thì chuyển từ "đã cân nhắc" sang "đã quên".');
}
console.error('');
console.error(`  Khai vào \`${path.relative(REPO, SO_KHAI).split(path.sep).join('/')}\`, mục \`khai\`, mỗi advisory một dòng:`);
console.error('    { "ghsa": "GHSA-xxxx-xxxx-xxxx", "goi": "…", "muc": "moderate", "do_luc": "YYYY-MM-DD",');
console.error('      "het_han": "YYYY-MM-DD", "vi_sao": "<PHÉP ĐO, không phải cảm nhận>", "ra_lai_khi": "…" }');
console.error('  `vi_sao` phải nói đã ĐO gì: thử vá ra sao, đường prod có với tới không, đo bằng cách nào.');
console.error('  "Rủi ro thấp" không phải một phép đo.');
process.exit(1);
