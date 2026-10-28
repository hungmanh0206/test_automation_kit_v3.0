#!/usr/bin/env node
/**
 * rule_consistency.js — luật đổi ở MỘT chỗ, nhưng được nhắc lại ở hàng chục chỗ.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY — một phép đo, không phải một lo xa.
 *
 * Luật evidence đổi sang mức B ngày 22/10/2026 (case thường 1 ảnh ở bước quyết định; case tầng bug ảnh
 * từng step). Đo lại ngày 28/10: **10 dòng ở 9 file vẫn dạy luật cũ**, trong đó 2 chỗ nằm ngoài `*.md`:
 *   · `scripts/utils/evidence_recorder.js` — header của chính cái máy thi hành luật, vẫn ghi luật cũ;
 *   · `tests/fe/infra/manual-run-usability.spec.ts` — một máy gác đang **CƯỠNG CHẾ** luật cũ, nên sửa
 *     tài liệu cho đúng luật hiện hành thì spec đỏ.
 *
 * Chỗ thứ hai mới là lớp lỗi đáng sợ: không chỉ tài liệu trôi, mà máy gác quay sang chống luật mới.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GIỚI HẠN, nói thẳng: máy này DÒ CÂU, không hiểu nghĩa. Nó chỉ canh mệnh đề đã khai trong
 * `.agent/config/rule_consistency.json`. Mệnh đề chưa khai thì nó im — và im KHÔNG phải bằng chứng
 * nhất quán. Nó cũng không biết một dòng đang "dạy luật" hay "kể lại lịch sử"; chỗ đó xử bằng danh sách
 * miễn trừ, tức bằng con người.
 *
 * Exit: 0 đạt · 1 có câu trái luật (CHẶN) · 2 không phán được (thiếu config, config hỏng).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/*
 * `--repo <dir>` để spec chạy gate trên một cây DỰNG RIÊNG. Không có nó thì không kiểm được đối chứng
 * âm: đường dẫn repo suy từ vị trí file này, nên đổi `cwd` KHÔNG đổi cây được quét. Cùng idiom với
 * `deps_check.js --repo` và `automation_review.js --repo` — và bài học ở `playwright-conventions.spec.ts`
 * ghi rõ bản đầu của một spec đã đỏ 11 test vì tưởng đang quét cây tạm mà thực ra quét repo thật.
 */
const argRepo = (() => {
  const i = process.argv.indexOf('--repo');
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
})();
const REPO = argRepo ? path.resolve(argRepo) : path.resolve(__dirname, '..', '..');
const CFG = path.join(REPO, '.agent/config/rule_consistency.json');
const JSON_OUT = process.argv.includes('--json');

function thoat(ma, thong_diep) {
  if (!JSON_OUT) console.error(thong_diep);
  process.exit(ma);
}

if (!fs.existsSync(CFG)) {
  thoat(2, '[rule-consistency] KHÔNG PHÁN ĐƯỢC: thiếu .agent/config/rule_consistency.json');
}
let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
} catch (e) {
  thoat(2, `[rule-consistency] KHÔNG PHÁN ĐƯỢC: config hỏng — ${e.message}`);
}
if (!Array.isArray(cfg.menh_de) || !cfg.menh_de.length) {
  thoat(2, '[rule-consistency] KHÔNG PHÁN ĐƯỢC: config không khai mệnh đề nào ⇒ gác rỗng, không phải đạt');
}

/**
 * Tập file ĐƯỢC GIT TRACK. Cùng lý lẽ với `gate_index.js` và `rule_coverage.js`: đếm theo đĩa thì gate
 * thành con tin của WIP trên máy người chạy — lớp lỗi "đếm theo đĩa" đã cắn 3 lần ở v2.9.1.
 * Cây không-git (gói phát hành) thì quét theo đĩa, vì gói chỉ mang đúng file đã track.
 */
function tapFile() {
  try {
    const out = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' });
    return String(out).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  } catch {
    const ra = [];
    const di = (d, sau = 0) => {
      if (sau > 8) return;
      let es;
      try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) {
        if (/^(node_modules|\.git|outputs|test-results|playwright-report)$/.test(e.name)) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) di(p, sau + 1);
        else ra.push(path.relative(REPO, p).split(path.sep).join('/'));
      }
    };
    di(REPO);
    return ra;
  }
}

/** Glob rất hẹp: chỉ `**` (mọi cấp), `*` (trong một cấp) và chữ thường. Đủ cho `pham_vi`. */
function khopGlob(rel, glob) {
  const re = new RegExp(`^${glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*')}$`);
  return re.test(rel);
}

const files = tapFile();
const mienTru = cfg.mien_tru || [];
const laMienTru = (rel) => mienTru.some((g) => khopGlob(rel, g));

/**
 * Miễn trừ theo DÒNG. Mỗi mục bắt buộc có `ly_do` — miễn trừ không giải thích được thì là một lần nới
 * luật. Khớp theo chuỗi con, không theo số dòng, vì số dòng trôi mỗi lần sửa file.
 */
const mienTruDong = (cfg.mien_tru_dong || []).filter((m) => {
  if (m.file && m.chua && String(m.ly_do || '').trim().length >= 20) return true;
  console.error(`[rule-consistency] bỏ qua mục mien_tru_dong thiếu file/chua/ly_do: ${JSON.stringify(m)}`);
  return false;
});
const laMienTruDong = (rel, text) => mienTruDong.some((m) => m.file === rel && text.includes(m.chua));

/*
 * Mục miễn trừ KHÔNG còn khớp gì nữa là rác: nó che một dòng đã biến mất, và lần sau ai đó viết lại
 * đúng câu đó thì tưởng vẫn được miễn. Đếm để báo.
 */
const mienTruDaDung = new Set();

const viPham = [];
const thongKe = [];

for (const md of cfg.menh_de) {
  const bat = new RegExp(md.cam.bat, 'i');
  const canCo = md.cam.chi_khi_cung_dong_co ? new RegExp(md.cam.chi_khi_cung_dong_co, 'i') : null;
  const tha = md.cam.tha_khi_cung_dong_co ? new RegExp(md.cam.tha_khi_cung_dong_co, 'i') : null;
  const trongPhamVi = files.filter((rel) => !laMienTru(rel) && (md.pham_vi || []).some((g) => khopGlob(rel, g)));

  let soDong = 0;
  for (const rel of trongPhamVi) {
    let src;
    try { src = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { continue; }
    const dong = src.split(/\r?\n/);
    for (let i = 0; i < dong.length; i++) {
      const d = dong[i];
      soDong++;
      if (!bat.test(d)) continue;
      if (canCo && !canCo.test(d)) continue;
      if (tha && tha.test(d)) continue;
      if (laMienTruDong(rel, d)) {
        mienTruDaDung.add(`${rel}::${mienTruDong.find((m) => m.file === rel && d.includes(m.chua)).chua}`);
        continue;
      }
      viPham.push({ ma: md.ma, file: rel, dong: i + 1, text: d.trim().slice(0, 150) });
    }
  }
  thongKe.push({ ma: md.ma, file_soi: trongPhamVi.length, dong_soi: soDong });
}

if (JSON_OUT) {
  console.log(JSON.stringify({ dat: viPham.length === 0, thong_ke: thongKe, vi_pham: viPham }, null, 2));
  process.exit(viPham.length ? 1 : 0);
}

for (const t of thongKe) {
  console.log(`[rule-consistency] ${t.ma}: soi ${t.file_soi} file · ${t.dong_soi} dòng`);
}

/* Mục miễn trừ không khớp gì nữa là rác — nó che một dòng đã biến mất. */
const mienTruChet = mienTruDong.filter((m) => !mienTruDaDung.has(`${m.file}::${m.chua}`));
for (const m of mienTruChet) {
  console.log(`[rule-consistency] ⚠ mục miễn trừ KHÔNG còn khớp gì: ${m.file} — "${m.chua}" ⇒ xoá khỏi config`);
}

if (!viPham.length) {
  console.log(`[rule-consistency] ✓ ĐẠT — ${cfg.menh_de.length} mệnh đề, 0 câu trái luật.`);
  if (mienTruDong.length) console.log(`[rule-consistency] miễn trừ theo dòng đang dùng: ${mienTruDaDung.size}/${mienTruDong.length} (mỗi mục có lý do trong config)`);
  console.log('[rule-consistency] Nhắc: máy này chỉ canh mệnh đề ĐÃ KHAI trong config. Luật mới ⇒ thêm mục, nếu không nó gác một nửa.');
  process.exit(0);
}

console.error(`\n[rule-consistency] ✗ CHẶN — ${viPham.length} câu trái luật canonical:\n`);
const theoMa = {};
for (const v of viPham) (theoMa[v.ma] = theoMa[v.ma] || []).push(v);
for (const [ma, ds] of Object.entries(theoMa)) {
  const md = cfg.menh_de.find((x) => x.ma === ma);
  console.error(`  ── ${ma}: ${md.ten}`);
  console.error(`     Canonical: ${md.canonical.file} → ${md.canonical.muc}`);
  console.error(`     Phải nói: ${md.canonical.tom_tat}\n`);
  for (const v of ds) console.error(`     ${v.file}:${v.dong}\n       ${v.text}`);
  console.error('');
}
console.error('Sửa các dòng trên về đúng câu canonical. Dòng nào là LỊCH SỬ (kể lại luật cũ) thì thêm');
console.error('đường dẫn vào `mien_tru` của .agent/config/rule_consistency.json, kèm lý do.');
process.exit(1);
