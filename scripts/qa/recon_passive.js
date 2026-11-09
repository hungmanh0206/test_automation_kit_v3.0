#!/usr/bin/env node
'use strict';

/*
 * recon_passive.js — recon chỉ được QUAN SÁT, không được DÒ.
 *
 * LUẬT ĐƯỢC GÁC, nguyên văn ở `requirements_analyzer/SKILL.md`:
 *   🚫 Recon chỉ quan sát THỤ ĐỘNG. Không `curl`/`fetch`/`page.evaluate` gọi endpoint để dò hành vi:
 *      một request mình tự tạo không chứng minh được gì về hành vi của UI.
 * Dòng đó trước đây kết bằng "**chưa có máy gác**". Đây là máy đó.
 *
 * VÌ SAO LUẬT NÀY QUAN TRỌNG HƠN VẺ NGOÀI. Recon sinh ra bản kê màn/API rồi bản kê đó được dùng làm
 * NGUỒN để viết case. Một endpoint mình tự gọi bằng `fetch` trả 200 không nói gì về việc UI có gọi nó,
 * gọi với payload nào, hay người dùng có đường nào tới đó — nhưng nó TRÔNG như một phát hiện. Đó là
 * đường ngắn nhất để một bản kê recon chứa thứ sản phẩm không có.
 *
 * HAI CHIỀU, và chiều thứ hai mới chống được cửa rỗng:
 *   ① KHÔNG tự gửi request. `fetch`, `axios`, `page.request.*`, `XMLHttpRequest`, `$.ajax`,
 *      `http(s).request`, hoặc spawn `curl`/`wget`.
 *   ② VẪN CÒN NGHE. Phải còn ít nhất một `page.on('response'|'request')`. Xoá sạch listener thì recon
 *      không quan sát gì nữa — và lúc đó phép kiểm ① vẫn xanh, vì không có gì để vi phạm.
 *
 * ĐƯỢC PHÉP, nói rõ để không ai tưởng bị cấm: `page.goto` (điều hướng — đó là cách xem app), và
 * `page.evaluate` ĐỌC DOM. Chỉ `page.evaluate` có gọi mạng bên trong mới bị chặn.
 *
 * GIỚI HẠN TỰ KHAI: máy đọc TÊN HÀM trong source, không chạy. Một lời gọi mạng viết gián tiếp
 * (`window[x]('/api')`, hay một helper ở file khác) thì nó không thấy — chỗ đó vẫn là review tay.
 *
 * Dùng:
 *   npm run recon:passive
 *   ... --dir <thư mục>   # đo cây khác (để dựng đối chứng)
 * Exit: 0 đạt · 1 đã đo và SAI · 2 KHÔNG PHÁN ĐƯỢC (không đọc được file nào).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const doiSo = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const DIR = path.resolve(doiSo('dir') || path.join(REPO, 'scripts/qa/discovery'));

/* ① Tự gửi request. Mỗi mẫu kèm lời giải thích riêng — một tên hàm trần không nói lên vi phạm. */
const TU_GUI = [
  { ma: 'fetch', re: /\bfetch\s*\(/g, vi: '`fetch` tự tạo request — không chứng minh UI có gọi endpoint đó' },
  { ma: 'axios', re: /\baxios\s*[.(]/g, vi: '`axios` là client HTTP, tức đang dò chứ không quan sát' },
  { ma: 'page.request', re: /\bpage\s*\.\s*request\s*\.\s*(get|post|put|patch|delete|fetch)\s*\(/g, vi: '`page.request.*` gửi request NGOÀI luồng UI' },
  { ma: 'xhr', re: /\bnew\s+XMLHttpRequest\b/g, vi: 'XMLHttpRequest tự tạo request trong trang' },
  { ma: 'jquery-ajax', re: /\$\s*\.\s*(ajax|get|post)\s*\(/g, vi: '`$.ajax`/`$.get`/`$.post` tự tạo request' },
  /*
   * `canChuoi: true` — hai mẫu này phải đọc trên bản CÒN RUỘT CHUỖI, vì thứ chúng tìm NẰM TRONG chuỗi:
   * `require('https')` và `spawnSync('curl', …)`. Bản đầu cho cả bảy mẫu đọc trên bản đã làm trắng
   * chuỗi, nên hai mẫu này KHÔNG BAO GIỜ nổ — và tôi chỉ biết vì đối chứng dương của `node-http` đỏ.
   * `curl` hỏng y hệt nhưng chưa bị phát hiện: vòng lặp của spec dừng ở mẫu trước nó.
   *
   * Rủi ro của việc đọc chuỗi: một CÂU nhắc tên bị tính là lời gọi. Hai mẫu dưới đòi dấu nháy đứng
   * NGAY TRƯỚC tên, nên `'đừng gọi curl ở recon'` không khớp.
   */
  { ma: 'node-http', canChuoi: true, re: /\brequire\s*\(\s*['"]https?['"]\s*\)|\bhttps?\s*\.\s*request\s*\(/g, vi: 'module `http`/`https` gửi request từ node' },
  { ma: 'curl', canChuoi: true, re: /['"`](curl|wget)\b|\b(spawn|exec|execSync|spawnSync)\s*\(\s*['"`](curl|wget)\b/g, vi: 'spawn `curl`/`wget` là gọi endpoint bằng tay' },
];
/* ② Dấu hiệu CÒN NGHE. */
const CON_NGHE = /\bpage\s*\.\s*on\s*\(\s*['"`](response|request|requestfinished|requestfailed)['"`]/g;

/*
 * HAI MỨC LÀM TRẮNG, và trộn lẫn chúng là một lỗi tôi vừa dính.
 *
 * `boChuThich` — chỉ xoá chú thích. Dùng cho mẫu ② `page.on('response')`, vì mẫu đó cần ĐỌC NỘI DUNG
 * CHUỖI. Bản đầu dùng chung một mức làm-trắng-cả-chuỗi, nên `'response'` thành `'        '` và cửa báo
 * "0 chỗ nghe" trên một bộ máy có 3 chỗ nghe — rồi tự chặn mình bằng chính phép kiểm ②.
 *
 * `chiLaMa` — xoá cả chú thích lẫn ruột chuỗi. Dùng cho mẫu ①, vì ở đó chỉ cần biết CÓ một lời gọi,
 * không cần nội dung. Và nó bắt buộc: chính file này nhắc `fetch`/`axios` trong phần đầu, không làm
 * trắng thì nó tự chặn mình theo đường khác.
 */
/*
 * 09/11/2026 — chuyển vào `lib/js_source.js`. Ba bản giống hệt từng byte trong cây là ba chỗ để trôi
 * khỏi nhau, và khi chúng trôi thì ba cửa đọc cùng một file ra ba kết quả khác nhau.
 *
 * Vẫn RE-EXPORT ở dưới: `policy_source_check.js` nhập nó từ đây, và đổi đường nhập của một cửa đang
 * xanh là việc không cần thiết trong cùng một lượt dọn.
 */
const { boChuThich } = require(path.join(__dirname, 'lib', 'js_source'));
function chiLaMa(s) {
  return boChuThich(s)
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => m[0] + ' '.repeat(Math.max(0, m.length - 2)) + m[0]);
}

function quetJs(dir) {
  const ra = [];
  const di = (d) => {
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p);
      else if (/\.(js|ts)$/.test(e.name)) ra.push(p);
    }
  };
  di(dir);
  return ra.sort();
}

function main() {
  const files = quetJs(DIR);
  if (files.length === 0) {
    console.error(`[recon-passive] KHÔNG PHÁN ĐƯỢC: 0 file đọc được ở ${path.relative(REPO, DIR) || DIR}`);
    console.error('  "không có gì để gác" KHÔNG đồng nghĩa với "đạt".');
    return 2;
  }

  const viPham = [];
  let soNghe = 0;
  const fileNghe = [];

  for (const f of files) {
    let thuc;
    try { thuc = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const ma = chiLaMa(thuc);
    const maConChuoi = boChuThich(thuc);
    const rel = path.relative(REPO, f).split(path.sep).join('/');

    for (const r of TU_GUI) {
      const nen = r.canChuoi ? maConChuoi : ma;
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(nen))) {
        const dong = nen.slice(0, m.index).split('\n').length;
        viPham.push({ rel, dong, ma: r.ma, vi: r.vi, code: thuc.split(/\r?\n/)[dong - 1].trim().slice(0, 90) });
      }
    }
    /* Mẫu ② đọc trên bản CHỈ BỎ CHÚ THÍCH — nó cần nội dung chuỗi `'response'`. */
    CON_NGHE.lastIndex = 0;
    const n = (boChuThich(thuc).match(CON_NGHE) || []).length;
    if (n > 0) { soNghe += n; fileNghe.push(`${rel} ×${n}`); }
  }

  console.log(`[recon-passive] ${path.relative(REPO, DIR) || DIR} · ${files.length} file`);
  console.log(`[recon-passive] nghe thụ động: ${soNghe} chỗ${soNghe ? ` (${fileNghe.join(' · ')})` : ''}`);
  console.log(`[recon-passive] tự gửi request: ${viPham.length} chỗ`);

  let sai = 0;
  if (viPham.length) {
    sai += viPham.length;
    console.error(`\n[recon-passive] ✗ ① ${viPham.length} chỗ TỰ GỬI REQUEST:`);
    for (const v of viPham) console.error(`  - ${v.rel}:${v.dong} [${v.ma}] ${v.vi}\n      ${v.code}`);
    console.error('\n  Một request mình tự tạo không chứng minh được gì về hành vi của UI — nhưng bản kê');
    console.error('  recon sẽ được dùng làm NGUỒN để viết case, nên nó TRÔNG như một phát hiện.');
  }
  if (soNghe === 0) {
    sai += 1;
    console.error('\n[recon-passive] ✗ ② KHÔNG còn chỗ nào nghe `page.on(\'response\'|\'request\')`.');
    console.error('  Xoá sạch listener thì recon không quan sát gì nữa — và phép kiểm ① vẫn xanh, vì');
    console.error('  không còn gì để vi phạm. Một cửa chỉ gác chiều "đừng dò" là một cửa rỗng.');
  }
  if (sai) return 1;

  console.log('\n[recon-passive] ✓ ĐẠT — recon vẫn đang nghe, và không chỗ nào tự gửi request.');
  console.log('[recon-passive] Giới hạn: máy đọc TÊN HÀM trong source, KHÔNG chạy. Lời gọi mạng viết gián');
  console.log('[recon-passive] tiếp (`window[x](\'/api\')`, hay helper ở file khác) thì nó không thấy — review tay.');
  return 0;
}

module.exports = { TU_GUI, CON_NGHE, chiLaMa, boChuThich };
if (require.main === module) process.exit(main());
