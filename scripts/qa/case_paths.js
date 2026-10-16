#!/usr/bin/env node
'use strict';
/*
 * case:paths — ĐƯỜNG IMPORT TƯƠNG ĐỐI PHẢI KHỚP TÊN FILE THẬT, ĐÚNG HOA-THƯỜNG.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ĐÂY LÀ CỬA PHÒNG, KHÔNG PHẢI CỬA CHỮA — và nói thẳng ra vì chuyện đó đáng nói.
 *
 * Prompt v2.9.2 giao việc "sửa import lệch hoa-thường, chạy lại `full:suite`, báo số đỏ trước/sau", với
 * giả thuyết rằng 20 test đỏ trên Linux CI là do `require('./Foo')` khớp `foo.js` trên Windows.
 *
 * Đo 16/10/2026 trên HEAD: **471 đường import tương đối, 0 đường lệch**. Và nguyên nhân thật của 20 test
 * đỏ đã tìm ra từ v2.8.3, khác hẳn: `db_query.js` `require()` thẳng một file `.ts` mà Node 20 không bóc
 * kiểu, cộng hai test ghim giả định CÓ Ổ ĐĨA (trên Linux `path.parse(REPO).root` là `/`).
 *
 * Nên máy này **không sửa gì cả** — nó không có gì để sửa. Báo "đỏ giảm từ 20 về 0 nhờ sửa import" sẽ là
 * gán công cho một việc không làm. Thứ nó làm là chặn lớp lỗi đó QUAY LẠI, và lớp lỗi đó có thật:
 * Windows và macOS mặc định không phân biệt hoa-thường, Linux thì có — nên một import lệch chạy ngon ở
 * máy dev và chỉ chết trên CI, đúng loại "xanh ở đây, đỏ ở kia" mà kit đã vấp vài lần.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/case_paths.js [--repo <dir>] [--json]
 * Exit: 0 đạt · 1 có đường lệch · 2 không phán được
 */
const fs = require('fs');
const path = require('path');

const iRepo = process.argv.indexOf('--repo');
const REPO = iRepo >= 0 && process.argv[iRepo + 1]
  ? path.resolve(process.argv[iRepo + 1])
  : path.resolve(__dirname, '..', '..');

/*
 * Bỏ qua theo CẤU TRÚC, không theo mẫu tên. `outputs/` là lớp PROJECT (automation của task, gitignore),
 * `knowledge/`/`reports/`/`test-results/` là artefact. Quét chúng thì mẫu số phụ thuộc máy người chạy —
 * đúng lớp lỗi mà `rule_coverage` và `full_suite_ledger` vừa phải vá ở v2.9.1.
 */
const BO_QUA = /(^|\/)(node_modules|\.git|outputs|dist|test-results|reports|knowledge|vendor|\.agent\/skills)(\/|$)/;
const DUOI = /\.(js|mjs|cjs|ts|tsx|mts|cts)$/;

/** Hậu tố thử theo thứ tự Node/TS phân giải. */
const HAU_TO = ['', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
  '/index.js', '/index.ts', '/index.mjs', '/index.tsx'];

function duyet(goc) {
  const ra = [];
  const di = (d) => {
    let e;
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch (x) { return; }
    for (const it of e) {
      const p = path.join(d, it.name);
      const rel = path.relative(goc, p).split(path.sep).join('/');
      if (BO_QUA.test(rel)) continue;
      if (it.isDirectory()) di(p);
      else if (DUOI.test(it.name)) ra.push(p);
    }
  };
  di(goc);
  return ra;
}

/**
 * Tên thật trên đĩa của một đường dẫn, hay `null` nếu không có file nào khớp kể cả bỏ qua hoa-thường.
 *
 * `fs.existsSync` trên Windows/macOS trả `true` cho tên sai hoa-thường — đó chính là lý do lỗi này sống
 * sót qua máy dev. Nên phải đọc danh sách thư mục rồi so chuỗi CHÍNH XÁC.
 */
function tenThat(p) {
  const d = path.dirname(p);
  const ten = path.basename(p);
  let ds;
  try { ds = fs.readdirSync(d); } catch (e) { return null; }
  if (ds.includes(ten)) return { khop: true, that: ten };
  const g = ds.find((x) => x.toLowerCase() === ten.toLowerCase());
  return g ? { khop: false, that: g } : null;
}

function quet(goc = REPO) {
  const files = duyet(goc);
  const lech = [];
  let soDuong = 0;

  for (const f of files) {
    let t;
    try { t = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    /* `require('./x')` · `from './x'` · `import('./x')` — chỉ đường TƯƠNG ĐỐI, gói npm không liên quan. */
    for (const m of t.matchAll(/(?:require\(|import\(|from)\s*['"](\.[^'"]*)['"]/g)) {
      const spec = m[1];
      soDuong += 1;
      const base = path.dirname(f);
      let thay = null;
      for (const h of HAU_TO) {
        const r = tenThat(path.resolve(base, spec + h));
        if (!r) continue;
        if (r.khop) { thay = { ok: true }; break; }
        if (!thay) thay = { ok: false, that: r.that, thu: path.basename(spec + h) };
      }
      /*
       * KHÔNG tìm thấy gì ⇒ BỎ QUA, không báo lỗi. Đường đó có thể trỏ tới file sinh lúc chạy, hoặc
       * tới alias mà bundler xử lý. Máy này chỉ phán đúng một chuyện: CÓ file khớp-không-phân-biệt mà
       * SAI hoa-thường. Phán thêm là báo oan, và một cửa báo oan là cửa người ta tắt.
       */
      if (thay && !thay.ok) {
        lech.push({
          file: path.relative(goc, f).split(path.sep).join('/'),
          spec,
          viet: thay.thu,
          that: thay.that,
        });
      }
    }
  }
  return { soFile: files.length, soDuong, lech };
}

function main() {
  const kq = quet();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(kq, null, 2));
    process.exit(kq.lech.length ? 1 : 0);
  }

  if (!kq.soDuong) {
    console.error('[case-paths] KHÔNG PHÁN ĐƯỢC: quét được 0 đường import — phép đo hỏng, không phải "sạch".');
    process.exit(2);
  }

  console.log(`[case-paths] ${kq.soFile} file · ${kq.soDuong} đường import tương đối.`);
  if (kq.lech.length) {
    console.error(`\n[case-paths] ✗ ${kq.lech.length} đường LỆCH HOA-THƯỜNG:`);
    for (const l of kq.lech) console.error(`  - ${l.file}: \`${l.spec}\` → viết \`${l.viet}\`, trên đĩa là \`${l.that}\``);
    console.error('\n  Windows/macOS không phân biệt hoa-thường nên chúng chạy ở máy bạn; Linux thì CHẾT.');
    console.error('  Sửa đường import cho khớp tên file thật.');
    process.exit(1);
  }
  console.log('[case-paths] ✓ ĐẠT — mọi đường import khớp tên file thật.');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { quet, tenThat, BO_QUA };
