#!/usr/bin/env node
'use strict';

/*
 * parity_check.js — gác chính bảng nghiệm thu `docs/v2.9.5/A_PARITY.md`.
 *
 * VÌ SAO CẦN. Bảng này là lớp DẪN XUẤT viết tay: nó kể lại chỗ nào A còn hơn B và B đã xử lý thế nào.
 * Mọi bảng viết tay trong kit đều đã trôi ít nhất một lần, và bảng nghiệm thu trôi thì tệ hơn bảng
 * thường — nó là thứ người ta đọc để tin rằng đợt làm đã xong.
 *
 * BA THỨ ĐƯỢC GÁC, và điều kiện dừng của đợt v2.9.5 nằm ở điều ①:
 *   ① KHÔNG dòng nào "chưa xử lý". Mỗi dòng phải kết về ✅ / ⛔ / ⚠️. Để trống hay ghi "chưa xử lý",
 *      "TBD", "đang làm" đều là CHẶN — vì một bảng nghiệm thu có dòng treo thì nó không nghiệm thu gì.
 *   ② Dòng ✅ nhắc `npm run <x>` thì `<x>` phải CÓ THẬT trong `package.json`. Một tên máy bịa làm hỏng
 *      cả bảng, không chỉ một dòng: người đọc mất cách kiểm lại từng dòng.
 *   ③ Phải CÓ cả ba khối: bảng nghiệm thu, khối "cố ý KHÔNG port", khối "CHƯA CÓ MÁY". Thiếu khối thứ
 *      ba là dấu hiệu bảng đang kể một phiên bản đẹp hơn thực tế.
 *
 * GIỚI HẠN TỰ KHAI: máy đọc KÝ HIỆU và TÊN MÁY, không đọc nghĩa. Nó không biết một dòng ✅ có đúng hay
 * không — chuyện đó phải đối chiếu với `tests/fe/infra/` và với chính commit. Nó chỉ bảo đảm bảng không
 * có dòng treo và không nhắc máy không tồn tại.
 *
 * Dùng:
 *   npm run parity:check
 *   ... --file <path>   # đo bảng khác (để dựng đối chứng)
 * Exit: 0 đạt · 1 đã đo và SAI · 2 KHÔNG PHÁN ĐƯỢC (thiếu bảng, hoặc không đọc được dòng nào).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const doiSo = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const FILE = path.resolve(doiSo('file') || path.join(REPO, 'docs/v2.9.5/A_PARITY.md'));

const TT_HOP_LE = ['✅', '⛔', '⚠️'];
/* Chữ nghĩa là "chưa xong". Bắt cả ký hiệu lẫn chữ, vì người ta hay thay ký hiệu bằng chữ cho đỡ đỏ. */
const RE_TREO = /chưa xử lý|chưa làm|\bTBD\b|\bTODO\b|đang làm|để sau|\bWIP\b|🚧|⏳/i;
const KHOI = [
  { ten: 'bảng nghiệm thu', re: /^##+\s*Bảng nghiệm thu/im },
  { ten: 'cố ý KHÔNG port', re: /^##+\s*Chỗ cố ý KHÔNG port/im },
  { ten: 'CHƯA CÓ MÁY', re: /^##+\s*Chỗ ĐÃ LÀM nhưng CHƯA CÓ MÁY/im },
];

function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`[parity] KHÔNG PHÁN ĐƯỢC: thiếu ${path.relative(REPO, FILE)}`);
    return 2;
  }
  const src = fs.readFileSync(FILE, 'utf8');
  const dong = src.split(/\r?\n/);

  /*
   * Dòng nghiệm thu = dòng bảng có cột CUỐI là một ký hiệu trạng thái. Neo theo cột cuối chứ không theo
   * số cột: bảng thêm một cột ở giữa thì phép kiểm vẫn soi đúng chỗ.
   */
  const nghiemThu = [];
  for (const l of dong) {
    if (!l.trim().startsWith('|')) continue;
    const o = l.split('|').slice(1, -1).map((x) => x.trim());
    if (o.length < 3) continue;
    const cuoi = o[o.length - 1];
    if (TT_HOP_LE.includes(cuoi) || /^(TT|tt)$/.test(cuoi) || /^-+$/.test(cuoi)) {
      if (TT_HOP_LE.includes(cuoi)) nghiemThu.push({ o, tt: cuoi, l });
    }
  }

  if (nghiemThu.length === 0) {
    console.error('[parity] KHÔNG PHÁN ĐƯỢC: 0 dòng nghiệm thu đọc được (cột cuối phải là ✅ / ⛔ / ⚠️).');
    console.error('  "không có gì để gác" KHÔNG đồng nghĩa với "đạt".');
    return 2;
  }

  /* Đọc bằng `fs` chứ không `require`: không cần miễn trừ eslint nào, và không giữ cache module. */
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const sai = [];

  // ① dòng treo — soi TOÀN BỘ file, không chỉ bảng nghiệm thu.
  for (let i = 0; i < dong.length; i += 1) {
    /* Bỏ qua chính dòng ĐỊNH NGHĨA của luật này trong phần mở đầu, nếu không tài liệu tự chặn nó. */
    if (/không dòng nào được để/i.test(dong[i])) continue;
    const m = dong[i].match(RE_TREO);
    if (m) sai.push(`dòng ${i + 1}: còn dấu hiệu TREO (${JSON.stringify(m[0])}) — ${dong[i].trim().slice(0, 70)}`);
  }

  // ② máy được nhắc phải có thật.
  const goi = [...new Set([...src.matchAll(/`npm run ([a-z0-9:_-]+)/g)].map((x) => x[1]))];
  const thieuMay = goi.filter((g) => !pkg.scripts[g]);
  if (thieuMay.length) sai.push(`nhắc npm script KHÔNG tồn tại: ${thieuMay.join(', ')}`);

  // ③ ba khối phải có mặt.
  for (const k of KHOI) if (!k.re.test(src)) sai.push(`thiếu khối **${k.ten}**`);

  const dem = { '✅': 0, '⛔': 0, '⚠️': 0 };
  for (const r of nghiemThu) dem[r.tt] += 1;

  /*
   * ĐẾM CẢ HAI KHỐI CÒN LẠI. Bản đầu chỉ đếm dòng có ký hiệu trạng thái, nên dòng tổng in
   * `⛔ 0 · ⚠️ 0` trong khi hai khối đó có 6 dòng mỗi khối — một dòng tổng nói sai về chính tài liệu
   * nó đang gác. Hai khối kia là bảng 2 cột không có cột trạng thái (ký hiệu đã nằm ở tiêu đề khối).
   */
  const demKhoi = (re) => {
    const i = dong.findIndex((l) => re.test(l));
    if (i < 0) return 0;
    const j = dong.findIndex((l, k) => k > i && /^##\s/.test(l));
    return dong.slice(i, j < 0 ? dong.length : j)
      .filter((l) => l.trim().startsWith('|') && !/^\|[\s|:-]*\|$/.test(l.trim()) && !/^\| A có \||^\| Việc \|/.test(l.trim()))
      .length;
  };
  const soKhongPort = demKhoi(KHOI[1].re);
  const soChuaMay = demKhoi(KHOI[2].re);

  console.log(`[parity] ${path.relative(REPO, FILE).split(path.sep).join('/')} · ${nghiemThu.length} dòng nghiệm thu`);
  console.log(`[parity]   ✅ đã làm ${dem['✅']} · ⛔ cố ý không port ${soKhongPort + dem['⛔']} · ⚠️ chưa có máy ${soChuaMay + dem['⚠️']}`);
  if (soChuaMay === 0 && dem['⚠️'] === 0) {
    sai.push('khối "CHƯA CÓ MÁY" rỗng — một đợt làm KHÔNG còn chỗ nào thiếu máy là lời khai đáng ngờ hơn là đáng mừng. Kiểm lại, hoặc ghi một dòng nói rõ vì sao rỗng.');
  }
  console.log(`[parity]   ${goi.length} máy được nhắc, tất cả đều có trong package.json`);

  if (sai.length) {
    console.error(`\n[parity] ✗ ${sai.length} chỗ SAI:`);
    for (const x of sai) console.error(`  - ${x}`);
    console.error('\n  Bảng nghiệm thu có dòng treo thì nó không nghiệm thu gì. Kết mỗi dòng về ✅ / ⛔ / ⚠️.');
    return 1;
  }

  console.log('\n[parity] ✓ ĐẠT — không dòng nào treo, mọi máy được nhắc đều có thật, đủ ba khối.');
  console.log('[parity] Giới hạn: máy đọc KÝ HIỆU và TÊN MÁY, KHÔNG đọc nghĩa. Một dòng ✅ có ĐÚNG hay');
  console.log('[parity] không thì phải đối chiếu với `tests/fe/infra/` và với chính commit.');
  return 0;
}

module.exports = { TT_HOP_LE, RE_TREO };
if (require.main === module) process.exit(main());
