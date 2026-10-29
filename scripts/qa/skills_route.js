#!/usr/bin/env node
/**
 * skills_route.js — hai skill mô tả giống nhau thì agent KHÔNG có căn cứ để chọn.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * GIỚI HẠN, nói trước vì nó quyết định cách đọc kết quả.
 *
 * Máy này **KHÔNG mô phỏng cách model chọn skill**. Nó đo ĐỘ KHỚP TỪ giữa một câu yêu cầu và phần chữ
 * mà agent thực sự đọc để chọn (`description` + "Câu kích hoạt mẫu"). Đó là một PHÉP ĐO ĐẠI DIỆN:
 *
 *   · nó BẮT ĐƯỢC: hai skill mô tả gần như nhau · một skill không có từ khoá nào của việc nó làm ·
 *     một cặp dễ nhầm mà chữ nghĩa không tách được;
 *   · nó KHÔNG CHỨNG MINH: rằng model sẽ chọn đúng. Model đọc cả ngữ cảnh, và nó có thể chọn đúng dù
 *     từ không khớp, hoặc chọn sai dù từ khớp.
 *
 * Đọc "top-1 = 95%" thành "agent sẽ chọn đúng 95%" là đọc sai. Con số này nói: *phần chữ hiện có đủ để
 * phân biệt 95% số ca trong fixture*. Phần còn lại là việc của model, và không có máy nào ở đây đo được.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * CHẤM ĐIỂM. Bag-of-words có trọng số IDF. Không có IDF thì stopword tiếng Việt ("này", "cho", "test",
 * "case") át hết: mọi skill đều chứa chúng, nên mọi câu đều khớp mọi skill ngang nhau và phép đo thành
 * vô nghĩa. IDF đẩy trọng số về những từ CHỈ vài skill có — đúng những từ mang thông tin để chọn.
 *
 * Exit: 0 đạt · 1 dưới ngưỡng hoặc có cặp dễ nhầm không tách được · 2 không phán được (thiếu fixture).
 */
const fs = require('fs');
const path = require('path');

const argOf = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const REPO = path.resolve(argOf('repo', path.resolve(__dirname, '..', '..')));
const SKILLS_DIR = path.join(REPO, '.agent/skills');
const FIXTURE = path.resolve(argOf('fixture', path.join(REPO, 'tests/fixtures/skills_route.json')));
const JSON_OUT = process.argv.includes('--json');

/** Ngưỡng mặc định do prompt v2.9.5 đặt: top-1 ≥ 90%. Cho đổi để spec dựng được đối chứng. */
const NGUONG = Number(argOf('nguong', '0.9'));

/**
 * SÀN TỰ TIN — thêm 28/10/2026, và nó là một bản vá cho LỖI THIẾT KẾ của chính bộ chấm này.
 *
 * Bản đầu không có khái niệm "không đủ tự tin": nó luôn trả skill điểm cao nhất, dù điểm đó chỉ đến từ
 * một từ trùng tình cờ. Hậu quả đo được: ba câu KHÔNG thuộc skill nào ("cài giúp tôi node phiên bản
 * mới", "đổi mật khẩu wifi phòng họp", "đặt vé máy bay đi Hà Nội") đều bị gán một skill, mỗi câu 2,56
 * điểm — tức bộ chấm không bao giờ nói được "tôi không biết", và ca `none` thành không đo được.
 *
 * Sàn đặt theo PHÂN BỐ ĐO ĐƯỢC, không theo cảm tính:
 *   · 54 ca khớp đúng: điểm thấp nhất **3,52** · p10 5,68 · trung vị 9,85;
 *   · 4 ca `none`: điểm **0 và 2,56**.
 * Sàn 3,0 nằm giữa 2,56 và 3,52 — có lề ở cả hai phía. Nếu một ngày ca đúng tụt xuống dưới 3,0 thì
 * đừng hạ sàn: đó là dấu hiệu `description` của skill đó quá mỏng để chọn được.
 */
const SAN = Number(argOf('san', '3.0'));

function thoat2(msg) {
  console.error(msg);
  process.exit(2);
}

if (!fs.existsSync(FIXTURE)) thoat2(`[skills-route] KHÔNG PHÁN ĐƯỢC: thiếu fixture ${path.relative(REPO, FIXTURE)}`);
let fx;
try {
  fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
} catch (e) {
  thoat2(`[skills-route] KHÔNG PHÁN ĐƯỢC: fixture hỏng — ${e.message}`);
}
const CA = Array.isArray(fx.ca) ? fx.ca : [];
if (CA.length < 1) thoat2('[skills-route] KHÔNG PHÁN ĐƯỢC: fixture 0 ca ⇒ chấm rỗng, không phải đạt');

/**
 * Tách từ. Giữ nguyên dấu tiếng Việt — `toLowerCase()` của JS fold đúng chữ có dấu (khác `grep -i`,
 * thứ KHÔNG fold được `Ọ`/`ọ` và đã làm một phép quét của đợt này đếm thiếu 8 chỗ).
 */
const STOP = new Set(['này', 'cho', 'của', 'và', 'thì', 'là', 'có', 'không', 'được', 'khi', 'nào', 'ở',
  'một', 'các', 'đã', 'rồi', 'mà', 'với', 'như', 'nó', 'tôi', 'bạn', 'đi', 'ra', 'vào', 'lên', 'từ',
  'sao', 'gì', 'nên', 'phải', 'hay', 'còn', 'để', 'bao', 'nhiêu', 'mỗi', 'đó', 'kia', 'trong', 'theo']);
const tach = (s) => String(s || '').toLowerCase().split(/[^0-9a-zà-ỹ_:-]+/u)
  .filter((w) => w.length >= 2 && !STOP.has(w));

/** Phần chữ mà agent THỰC SỰ đọc để chọn: `description` + mọi dòng "Câu kích hoạt mẫu". */
function chuDeChon(src) {
  const desc = (src.match(/^description:[ \t]*([\s\S]*?)(?=\n[a-z_]+:|\n---)/m) || [])[1] || '';
  const cau = [...src.matchAll(/Câu kích hoạt mẫu:\*{0,2}\s*(.+)/gi)].map((m) => m[1]).join(' · ');
  return `${desc} ${cau}`;
}

function napSkill() {
  const ra = [];
  if (!fs.existsSync(SKILLS_DIR)) return ra;
  for (const g of fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const gd = path.join(SKILLS_DIR, g.name);
    for (const s of fs.readdirSync(gd, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const f = path.join(gd, s.name, 'SKILL.md');
      if (!fs.existsSync(f)) continue;
      ra.push({ ten: s.name, tu: tach(chuDeChon(fs.readFileSync(f, 'utf8'))) });
    }
  }
  return ra;
}

const SKILL = napSkill();
if (!SKILL.length) thoat2('[skills-route] KHÔNG PHÁN ĐƯỢC: không tìm thấy skill nào');

/* IDF: từ nào CHỈ vài skill có thì mang nhiều thông tin để chọn. */
const df = new Map();
for (const s of SKILL) for (const w of new Set(s.tu)) df.set(w, (df.get(w) || 0) + 1);
const idf = (w) => Math.log(SKILL.length / (1 + (df.get(w) || 0)));

const tuiCua = new Map(SKILL.map((s) => [s.ten, new Set(s.tu)]));

function chamCau(cau) {
  const q = tach(cau);
  const diem = SKILL.map((s) => {
    const tui = tuiCua.get(s.ten);
    let d = 0;
    for (const w of new Set(q)) if (tui.has(w)) d += Math.max(idf(w), 0.01);
    return { ten: s.ten, diem: d };
  }).sort((a, b) => b.diem - a.diem);
  return diem;
}

const ketQua = [];
for (const c of CA) {
  const xh = chamCau(c.cau);
  const top = xh[0];
  /* Dưới sàn tự tin = "không đủ căn cứ để chọn", và đó mới là câu trả lời đúng cho ca `none`. */
  const duTin = top.diem >= SAN;
  const dung = c.skill === 'none' ? !duTin : (duTin && top.ten === c.skill);
  ketQua.push({
    cau: c.cau,
    mong: c.skill,
    top1: duTin ? top.ten : '(dưới sàn)',
    diem: Number(top.diem.toFixed(2)),
    nhi: xh[1] ? xh[1].ten : null,
    dung,
  });
}

const soDung = ketQua.filter((r) => r.dung).length;
const tiLe = soDung / ketQua.length;

/* CẶP DỄ NHẦM: mỗi cặp phải tách được ở MỌI ca của fixture thuộc hai skill đó. */
const capLoi = [];
for (const cap of (fx.cap_de_nham || [])) {
  const trong = ketQua.filter((r) => cap.includes(r.mong));
  const sai = trong.filter((r) => !r.dung);
  if (sai.length) capLoi.push({ cap, sai: sai.map((r) => `"${r.cau}" ⇒ ${r.top1} (mong ${r.mong})`) });
}

if (JSON_OUT) {
  console.log(JSON.stringify({ dat: tiLe >= NGUONG && !capLoi.length, tiLe, soDung, tong: ketQua.length, nguong: NGUONG, capLoi, ketQua }, null, 2));
  process.exit(tiLe >= NGUONG && !capLoi.length ? 0 : 1);
}

console.log(`[skills-route] ${SKILL.length} skill · ${ketQua.length} ca · top-1 ${soDung}/${ketQua.length} = ${(tiLe * 100).toFixed(1)}% (ngưỡng ${(NGUONG * 100).toFixed(0)}%) · sàn tự tin ${SAN}`);
for (const r of ketQua.filter((x) => !x.dung)) {
  console.log(`  ✗ "${r.cau}"\n      mong ${r.mong} · top-1 ${r.top1} (điểm ${r.diem}) · nhì ${r.nhi}`);
}
for (const c of capLoi) {
  console.log(`  ✗ CẶP DỄ NHẦM không tách được: ${c.cap.join(' ↔ ')}`);
  for (const s of c.sai) console.log(`      ${s}`);
}

if (tiLe >= NGUONG && !capLoi.length) {
  console.log('[skills-route] ✓ ĐẠT');
  console.log('[skills-route] Nhắc: đây là phép đo ĐẠI DIỆN trên TỪ NGỮ. Nó bắt được hai mô tả giống nhau;');
  console.log('[skills-route] nó KHÔNG chứng minh model sẽ chọn đúng. Đừng đọc tỉ lệ này thành độ chính xác của agent.');
  process.exit(0);
}
console.error('\n[skills-route] ✗ CHẶN — sửa `description` hoặc "Câu kích hoạt mẫu" của skill bị nhầm cho tách ra.');
console.error('Đừng sửa fixture để cho xanh: fixture là câu người dùng nói thật, nó không phải chỗ nhượng bộ.');
process.exit(1);
