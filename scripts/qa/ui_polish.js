#!/usr/bin/env node
/**
 * ui_polish.js (CLI) — báo cáo ĐỘ CHỈN CHU UI từ dữ liệu đã thu bằng `scripts/utils/ui/ui_polish.js` → `thuThap()`.
 *
 * Thu thập nằm trong SPEC CỦA TASK (mở màn thật cần đăng nhập ⇒ chạm UAT ⇒ phải được xác nhận), mỗi màn ghi một
 * file JSON vào `<PROJECT_OUTPUT_DIR>/tasks/<KEY>/test-results/ui-polish/`. Máy này chỉ ĐỌC các file đó.
 *
 *   const { thuThap } = require('<repo>/scripts/utils/ui/ui_polish');
 *   …rồi lưu kết quả `await thuThap(page, { man: ten, vung })` thành `<ten>.json` trong thư mục trên.
 *   (Ví dụ viết bằng lời: `gates:index` suy mức từ chữ trong file, và một lời gọi ghi file nằm trong chú thích
 *   từng làm máy chỉ-đọc này bị xếp thành SINH.)
 *
 * Ba trục: ① thang khoảng cách · ② cùng loại thành phần có giống nhau giữa các màn · ③ số font/cỡ chữ/màu.
 * Không có `--thang` (thang của thiết kế) thì "chuẩn" là ĐA SỐ trong hệ thống ⇒ mọi độ lệch là OBSERVATION,
 * KHÔNG phải bug. Đa số có thể chính là cái sai.
 *
 * Dùng:
 *   node scripts/qa/ui_polish.js --task <KEY> [--project-output outputs/CSDL] [--thang 4,8,12,16,24,32] [--json]
 *   node scripts/qa/ui_polish.js --thu-muc <thư mục *.json> [...]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { phanTich } = require('../utils/ui/ui_polish');

const REPO = path.resolve(__dirname, '..', '..');
const TEN = { nut: 'nút', nut_icon: 'nút icon', o_chu: 'ô chữ', o_chon: 'ô chọn', o_nhieu_dong: 'ô nhiều dòng', nhan: 'nhãn', tieu_de: 'tiêu đề' };
const TT = { cao: 'chiều cao', padding: 'padding', coChu: 'cỡ chữ', font: 'font', boGoc: 'bo góc' };

function main() {
  const a = process.argv.slice(2);
  const lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : ''; };
  const po = lay('--project-output') || process.env.PROJECT_OUTPUT_DIR || 'outputs/CSDL';
  const dir = lay('--thu-muc') ? path.resolve(lay('--thu-muc'))
    : (lay('--task') ? path.resolve(REPO, po, 'tasks', lay('--task'), 'test-results', 'ui-polish') : '');
  /* ĐỆ QUY: mỗi cấp một thư mục con (`ui-polish/MN/`, `ui-polish/THCS/`…) để một lượt so được GIỮA các cấp. */
  const lietKe = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lietKe(path.join(d, e.name)).map((x) => path.join(e.name, x)) : (e.name.endsWith('.json') ? [e.name] : [])));
  const tatCa = dir && fs.existsSync(dir) ? lietKe(dir) : [];
  /* File mở đầu bằng `_` là sổ của lượt thu thập (`_bo-qua.json`: màn KHÔNG đo được và lý do), không phải một màn. */
  const files = tatCa.filter((f) => !path.basename(f).startsWith('_'));
  const boQua = [];
  for (const f of tatCa.filter((x) => path.basename(x) === '_bo-qua.json')) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const x of j.boQua || []) boQua.push({ ...x, cap: j.cap || path.dirname(f) });
    } catch (e) { console.log(`[ui-polish] bỏ ${f}: không đọc được`); }
  }
  const inBoQua = () => {
    if (!boQua.length) return;
    console.log(`  ✗ KHÔNG đo được ${boQua.length} màn — không nằm trong số liệu, và không có nghĩa là chúng chỉn chu:`);
    for (const x of boQua.slice(0, 15)) console.log(`     ${x.cap}/${x.ten}: ${x.lyDo}`);
    if (boQua.length > 15) console.log(`     … và ${boQua.length - 15} màn khác`);
  };
  if (!files.length) {
    inBoQua();
    console.log(`[ui-polish] KHÔNG PHÁN ĐƯỢC — không có dữ liệu thu thập${dir ? ` ở ${path.relative(REPO, dir)}` : ' (thiếu --task hoặc --thu-muc)'}. Đây KHÔNG đồng nghĩa với "UI chỉn chu".`);
    return 2;
  }
  const maus = [];
  for (const f of files) { try { maus.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (e) { console.log(`[ui-polish] bỏ ${f}: không đọc được`); } }
  const thang = lay('--thang') ? lay('--thang').split(',').map(Number).filter(Number.isFinite) : null;
  const k = phanTich(maus, { thang });
  if (a.includes('--json')) { console.log(JSON.stringify({ ...k, khongDoDuoc: boQua }, null, 2)); return 0; }

  const kc = k.khoangCach;
  console.log(`[ui-polish] ${k.soMan} màn · chuẩn: ${kc.nguon === 'thang thiết kế' ? `THANG THIẾT KẾ [${kc.thang.join(', ')}]` : `ĐA SỐ trong hệ thống (không có thang thiết kế) — mọi độ lệch dưới đây là OBSERVATION, KHÔNG phải bug`}`);
  console.log(`  ① khoảng cách: ${kc.soGiaTri} giá trị khác nhau trên ${kc.tongLan} lần dùng${kc.nguon === 'suy từ đa số' ? ` · bước phủ ≥80%: ${kc.buoc ? `${kc.buoc}px` : 'KHÔNG CÓ — hệ thống không theo một thang chung'}` : ''}`);
  if (kc.nguon === 'suy từ đa số' && !kc.buoc) {
    console.log(`     phổ biến nhất: ${kc.phoBien.map((x) => `${x.v}px ${x.tiLe}%`).join(' · ')}`);
    console.log(`     bước khớp nhiều nhất: ${kc.buocTotNhat.b}px, phủ ${kc.buocTotNhat.phu}% — dưới 80% nên không coi là thang`);
  }
  for (const x of kc.leThang.slice(0, 12)) console.log(`     lẻ thang ${String(x.v).padStart(5)}px ×${x.n} — ${x.viDu.slice(0, 2).join(' · ')}`);
  if (kc.leThang.length > 12) console.log(`     … và ${kc.leThang.length - 12} giá trị lẻ khác`);
  if (Object.keys(k.loaiKhongXet).length) console.log(`  ⚠ dữ liệu có loại thành phần máy KHÔNG xét: ${Object.entries(k.loaiKhongXet).map(([x, n]) => `${x} (${n})`).join(', ')} — thu thập lại bằng bản ui_polish hiện tại`);
  console.log('  ② đồng nhất theo loại thành phần (xuyên màn):');
  for (const [loai, tts] of Object.entries(k.dongNhat)) {
    const bien = Object.entries(tts).filter(([, x]) => x.bienThe > 1);
    if (!bien.length) { console.log(`     ${TEN[loai] || loai}: đồng nhất`); continue; }
    for (const [tt, x] of bien) {
      console.log(`     ${(TEN[loai] || loai).padEnd(7)} ${(TT[tt] || tt).padEnd(10)} ${x.bienThe} biến thể · đa số ${x.daSo} (${x.tiLe}%) · ${x.soLech} lệch: ${x.lech.slice(0, 3).join(' | ')}`);
    }
  }
  /* FONT là font KHAI BÁO đầu tiên trong `font-family`, không phải font HIỂN THỊ: máy không cài font đó thì trình duyệt
   * thay font khác. Đo 12/11/2026 trên GDTX (Windows): ô Telerik khai "Helvetica Neue" nhưng ảnh cho thấy hiển thị như
   * Arial — lệch khai báo, chưa chắc người dùng thấy. Padding thì thấy được trên ảnh. */
  if (Object.values(k.dongNhat).some((tts) => tts.font && tts.font.bienThe > 1)) console.log('  ℹ font ở trên là font KHAI BÁO, không phải font hiển thị — máy thiếu font thì trình duyệt thay. Xem ảnh trước khi nói người dùng thấy khác.');
  const h = k.heThong;
  console.log(`  ③ hệ thống: ${h.soFont} font · ${h.soCoChu} cỡ chữ · ${h.soMau} màu chữ`);
  inBoQua();
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { main };
