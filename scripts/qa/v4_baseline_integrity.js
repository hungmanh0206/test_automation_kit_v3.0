#!/usr/bin/env node
'use strict';

/*
 * v4_baseline_integrity — lõi kit có đổi so với MỐC NHẬP extension không.
 *
 * Dùng: node scripts/qa/v4_baseline_integrity.js [--raw]
 *   exit 0 = không đổi · 1 = có file đổi · 2 = KHÔNG PHÁN ĐƯỢC
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * CHUẨN HOÁ XUỐNG DÒNG TRƯỚC KHI BĂM — và đây là lỗi THẬT của bản nhập về, đo 09/11/2026.
 *
 * Bản gốc băm nguyên byte. Trên checkout Windows (`core.autocrlf`) nó báo **264/931 giống nhau** và
 * exit 1, trong khi nội dung thật là **931/931 giống nhau**: đo lại cả 667 file "khác" thì **667/667
 * khớp ngay khi chuẩn hoá về LF, 0 khác thật**.
 *
 * Tức cái cửa sinh ra ĐỂ CHỨNG MINH "lõi không đổi" lại báo 72% lõi đã đổi, khi không có gì đổi. Và nó
 * làm chính tuyên bố "931/931 byte-identical" của bản enhanced KHÔNG tái lập được trên Windows — đúng
 * nền tảng mà V9.1 của họ nhắm tới.
 *
 * Kit đã học đúng bài này một lần rồi: `prompt_budget.js` chuẩn hoá `\r\n` trước khi đếm, vì cùng MỘT
 * commit đo ra hai số lệch 175 token giữa cây LF và cây CRLF.
 *
 * Cờ `--raw` giữ lại cách băm nguyên byte, cho ai cần so với chính file zip đã phát hành.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ĐÂY LÀ CỬA MỘT-LƯỢT, KHÔNG PHẢI CỬA MỖI-COMMIT.
 *
 * Mốc là ảnh chụp lõi tại lúc nhập extension. Repo sống thì lõi SẼ đổi một cách chính đáng, nên nối
 * cửa này vào `static-check` là cài sẵn một cửa đỏ-theo-thiết-kế — mà tiếng ồn thì bị tắt. Nó trả lời
 * đúng một câu: *"việc nhập extension có chạm vào lõi không"*. Chạy nó lúc nhập, và lúc nghi ngờ.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const MOC = path.join(ROOT, '.agent/extensions/kit-a/baseline-sha256.json');
const RAW = process.argv.includes('--raw');
/* `--chot`: ghi lại mốc từ cây hiện tại, băm theo dạng ĐÃ CHUẨN HOÁ (nhị phân vẫn nguyên byte),
 * nên mốc mới KHÔNG phụ thuộc quy ước xuống dòng của máy chốt — khác bản nhập về, vốn trộn hai quy ước
 * (3 file băm CRLF, 928 file băm LF). Chốt lại là việc THẤY ĐƯỢC TRONG DIFF, không phải con số trôi đi. */
const CHOT = process.argv.includes('--chot');

if (!fs.existsSync(MOC)) {
  console.log('[baseline] KHÔNG PHÁN ĐƯỢC — không có .agent/extensions/kit-a/baseline-sha256.json');
  console.log('           Đây KHÔNG đồng nghĩa với "lõi không đổi".');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(MOC, 'utf8'));
const tong = Object.keys(manifest).length;
if (tong < 100) {
  console.log(`[baseline] KHÔNG PHÁN ĐƯỢC — mốc chỉ có ${tong} mục, không mô tả nổi lõi kit.`);
  process.exit(2);
}

const bam = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/*
 * CHỈ CHUẨN HOÁ FILE VĂN BẢN. Bản đầu của chính nhát vá này chuẩn hoá MỌI file bằng
 * `raw.toString('utf8').replace(...)` — và utf8 phá nát byte nhị phân, nên 11 ảnh `.png` cộng
 * `vendor/xlsx-0.20.3.tgz` bị báo "đổi nội dung" trong khi chúng y nguyên. Đo 09/11/2026: 15 file bị
 * báo đổi, 12 trong đó là nhị phân bị chính phép chuẩn hoá làm hỏng.
 */
const NHI_PHAN = /\.(png|jpe?g|gif|webp|ico|pdf|zip|tgz|gz|xlsx?|docx?|woff2?|ttf|mp4|webm)$/i;
const doc = (p) => {
  const raw = fs.readFileSync(p);
  if (RAW || NHI_PHAN.test(p)) return raw;
  /*
   * `/\r\n?/` chứ KHÔNG phải `/\r\n/` — gộp cả **CR lẻ**, đúng mẫu `prompt_budget.js` của kit dùng.
   * Đo 09/11/2026: `domain_rules.js`, `howto_store.js`, `prompt_budget.js` mỗi file có 1 CR lẻ, nên
   * mẫu chỉ-CRLF để sót 3 file và tôi suýt khai chúng là "lõi đã trôi một cách chính đáng" — trong khi
   * `diff` sau khi bỏ CR cho **0 dòng khác**. Suýt biến một lỗi của phép đo thành một kết luận.
   */
  return Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
};

/*
 * KHỚP Ở MỘT TRONG HAI DẠNG — vì MỐC TỰ NÓ TRỘN HAI QUY ƯỚC, đo 09/11/2026.
 *
 * `domain_rules.js`, `howto_store.js`, `prompt_budget.js`: mốc băm chúng ở dạng **nguyên CRLF**, trong
 * khi 928 file còn lại băm ở dạng **LF**. Kiểm bằng chính file trong gói tải về: băm nguyên byte của
 * HỌ khớp mốc, băm chuẩn hoá thì không — và số byte của họ bằng đúng số byte của tôi (47594 = 47594),
 * tức nội dung y hệt.
 *
 * Đây KHÔNG phải nới chuẩn: nội dung đổi thật thì **không dạng nào** khớp. Nó chỉ thôi đòi mốc phải
 * dùng cùng một quy ước xuống dòng cho mọi file — điều mà chính mốc không làm được.
 */
if (CHOT) {
  const moi = {};
  let thieu = 0;
  for (const rel of Object.keys(manifest)) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) { thieu += 1; continue; }
    moi[rel] = bam(doc(full));
  }
  if (thieu) { console.log(`[baseline] KHÔNG CHỐT — ${thieu} file lõi đang BIẾN MẤT; dựng lại cây trước.`); process.exit(2); }
  fs.writeFileSync(MOC, `${JSON.stringify(moi, null, 1)}
`, 'utf8');
  console.log(`[baseline] đã chốt lại mốc — ${Object.keys(moi).length} file, băm theo dạng đã chuẩn hoá.`);
  process.exit(0);
}

const doi = [];
const mat = [];
for (const [rel, h] of Object.entries(manifest)) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { mat.push(rel); continue; }
  if (bam(doc(full)) !== h && bam(fs.readFileSync(full)) !== h) doi.push(rel);
}

const giong = tong - doi.length - mat.length;
console.log(`[baseline] ${giong}/${tong} file lõi giống mốc nhập`
  + `${RAW ? ' (băm NGUYÊN BYTE — --raw)' : ' (chuẩn hoá xuống dòng trước khi băm)'}`);

if (!doi.length && !mat.length) {
  console.log('[baseline] ✓ ĐẠT — việc nhập extension không chạm vào lõi.');
  process.exit(0);
}

if (mat.length) {
  console.log(`\n[baseline] ✗ ${mat.length} file lõi BIẾN MẤT:`);
  mat.slice(0, 20).forEach((x) => console.log(`  - ${x}`));
  if (mat.length > 20) console.log(`  … và ${mat.length - 20} file nữa`);
}
if (doi.length) {
  console.log(`\n[baseline] ✗ ${doi.length} file lõi ĐỔI NỘI DUNG:`);
  doi.slice(0, 20).forEach((x) => console.log(`  - ${x}`));
  if (doi.length > 20) console.log(`  … và ${doi.length - 20} file nữa`);
  console.log('\n  Mốc là ảnh chụp lúc NHẬP extension. Lõi đổi sau đó có thể hoàn toàn chính đáng —');
  console.log('  cửa này chỉ nói "đã đổi", không nói "đổi sai". Đối chiếu với lịch sử git trước khi kết luận.');
}
process.exit(1);
