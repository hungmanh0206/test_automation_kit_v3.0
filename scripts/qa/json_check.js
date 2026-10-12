#!/usr/bin/env node
'use strict';

/*
 * json_check.js — kiểm MỌI file .json ĐANG ĐƯỢC TRACK có parse được không.
 *
 * VÌ SAO CÓ FILE NÀY: cả 2 CI trước đây hardcode đúng 3 đường dẫn, trong đó có `knowledge/index.json`.
 * Commit `2d383e1` bỏ track `knowledge/**` (dữ liệu công ty, đối xử như `.env`) ⇒ từ lúc đó job `static`
 * ĐỎ ở mọi lần push vì ENOENT, không liên quan gì tới nội dung được push. Danh sách viết tay là thứ mục
 * rỗng: file mới thêm thì không ai kiểm, file bị bỏ track thì CI đỏ oan.
 *
 * Cách đo thay thế: hỏi git xem đang track những .json nào rồi parse hết. Tự cập nhật theo repo, và
 * KHÔNG bao giờ trỏ vào dữ liệu không-track (`knowledge/` · `profiles/` · `outputs/`).
 *
 * Đếm 0 file cũng là ĐỎ: nghĩa là phép đo hỏng (không có git, sai cwd), không phải "mọi thứ đều ổn".
 *
 * Dùng: npm run json:check
 */

const fs = require('fs');
const path = require('path');
const { listFiles, worktreeNotice } = require(path.resolve(__dirname, '..', 'utils', 'tracked_files'));

const REPO = path.resolve(__dirname, '..', '..');

/*
 * Không có `.git` (giải nén ZIP, artifact CI, thư mục copy) thì vẫn phải kiểm được: JSON hỏng vẫn hỏng dù
 * repo có git hay không. Chặn chỉ vì thiếu `.git` là chặn oan. Dùng chung `utils/tracked_files.js` để bài
 * học này không phải vá lần thứ tư ở script kế tiếp.
 */
function trackedJson() {
  return listFiles({ root: REPO, patterns: ['*.json'], filter: /\.json$/ });
}

/*
 * KHOÁ TRÙNG TRONG MỘT OBJECT — `JSON.parse` KHÔNG báo, nó lấy cái sau và bỏ cái trước.
 *
 * Phép đối chứng chạy 12/10/2026, và kết quả là lý do mục này tồn tại: chèn thêm một `"ci:scope"` thứ hai
 * vào `package.json` thì `npm run ci:scope` chạy lệnh MỚI (`echo`), còn `json:check` vẫn báo
 * "✓ 49 file .json đều parse được". Tức một khoá trùng THAY NGẦM ĐƯỢC LỆNH CỦA MỘT GATE, và cả hai CI
 * vẫn xanh vì chúng chỉ gọi `npm run <tên>`.
 *
 * Chuyện này đã xảy ra THẬT trong lượt dựng `gate:code-pair`: §A10.3 đặt tên lệnh là `gate:policy`, mà
 * tên đó đã thuộc `policy_source_check.js`. Thêm key trùng xong, bước CI "Policy 1-nguồn" lặng lẽ chuyển
 * sang chạy máy khác. Không máy nào bắt, và nó chỉ lộ ra vì tôi tình cờ đọc file CI.
 *
 * Cách đo: quét văn bản, đếm khoá theo TỪNG OBJECT. Phải tự quét chứ không dùng `JSON.parse` + reviver —
 * reviver cũng chỉ thấy object đã mất khoá trùng. Bộ quét này chỉ cần phân biệt chuỗi với cấu trúc, nên
 * nó theo dõi dấu nháy kép và dấu `\` thoát; không cần hiểu số, `true/false/null`.
 */
function khoaTrung(txt) {
  const trung = [];
  const stack = [];               /* mỗi phần tử: Set khoá của object đang mở, hoặc null nếu là array */
  let i = 0;
  let khoaCho = null;             /* chuỗi vừa đọc, chờ xem có dấu `:` sau nó không */
  while (i < txt.length) {
    const c = txt[i];
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < txt.length) {
        if (txt[j] === '\\') { s += txt[j + 1]; j += 2; continue; }
        if (txt[j] === '"') break;
        s += txt[j];
        j += 1;
      }
      khoaCho = s;
      i = j + 1;
      continue;
    }
    if (c === ':') {
      const top = stack[stack.length - 1];
      if (top && khoaCho !== null) {
        if (top.has(khoaCho)) trung.push(khoaCho);
        else top.add(khoaCho);
      }
      khoaCho = null;
      i += 1;
      continue;
    }
    if (c === '{') { stack.push(new Set()); khoaCho = null; i += 1; continue; }
    if (c === '[') { stack.push(null); khoaCho = null; i += 1; continue; }
    if (c === '}' || c === ']') { stack.pop(); khoaCho = null; i += 1; continue; }
    if (c === ',') { khoaCho = null; i += 1; continue; }
    i += 1;
  }
  return [...new Set(trung)];
}

function main() {
  const { files, mode } = trackedJson();
  if (mode === 'worktree') console.warn(worktreeNotice('json'));

  if (!files.length) {
    console.error('[json] ✗ 0 file .json được track — phép đo hỏng (sai cwd? repo trống?), không phải "sạch".');
    process.exit(2);
  }

  const bad = [];
  const trung = [];
  for (const f of files) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) { bad.push([f, 'được track nhưng KHÔNG có trên đĩa']); continue; }
    const txt = fs.readFileSync(p, 'utf8');
    try { JSON.parse(txt); } catch (e) { bad.push([f, e.message]); continue; }
    const dup = khoaTrung(txt);
    if (dup.length) trung.push([f, dup]);
  }

  if (trung.length) {
    console.error(`[json] ✗ ${trung.length} file có KHOÁ TRÙNG trong cùng một object:`);
    for (const [f, dup] of trung) console.error(`  - ${f}: ${dup.map((k) => `"${k}"`).join(', ')}`);
    console.error('[json]   `JSON.parse` KHÔNG báo lỗi ở đây — nó lấy khoá SAU và bỏ khoá TRƯỚC. Trong');
    console.error('[json]   `package.json` thì một khoá trùng THAY NGẦM LỆNH của một gate, và cả hai CI vẫn');
    console.error('[json]   xanh vì chúng chỉ gọi `npm run <tên>`. Đã xảy ra thật ở v2.7.0 §A10.3.');
    process.exit(1);
  }

  if (bad.length) {
    console.error(`[json] ✗ ${bad.length}/${files.length} file .json KHÔNG parse được:`);
    for (const [f, why] of bad) console.error(`  - ${f}: ${why}`);
    console.error('[json]   JSON hỏng ở config = gate đọc nó sẽ chết giữa phase, hoặc tệ hơn: bị bắt lỗi rồi bỏ qua âm thầm.');
    process.exit(1);
  }
  console.log(`[json] ✓ ${files.length} file .json ${mode === 'git' ? 'được track' : 'trên working-tree'} đều parse được.`);
}

if (require.main === module) main();
module.exports = { trackedJson, khoaTrung };
