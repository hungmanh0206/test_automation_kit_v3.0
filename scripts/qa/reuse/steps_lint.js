#!/usr/bin/env node
'use strict';
/*
 * steps:lint — CANH LUẬT VÀNG CỦA THƯ VIỆN BƯỚC (v2.8.0 §A, luật L2–L4).
 *
 * LUẬT ĐƯỢC CANH, và vì sao luật thứ nhất là luật quan trọng nhất của cả đợt:
 *
 *   1. **Bước KHÔNG chứa oracle.** Chỉ `_checks/` được phép có `expect(`. Mọi tầng khác — `_widget/`,
 *      `screens/`, `steps/`, `flows/` — chỉ làm thao tác.
 *
 *      Gói luôn phần kiểm vào bước làm tỉ lệ "dùng lại" nhảy vọt: một bước "kiểm form hồ sơ trường đúng"
 *      trông như dùng lại được ở mọi task. Nhưng lúc đó oracle bị ĐÓNG KHUNG trong code, và khi đặc tả
 *      đổi thì không ai thấy — case vẫn xanh vì nó so với chính code đã viết, không so với đặc tả. Đó là
 *      `app == app` chuyển từ tầng testcase xuống tầng thư viện, và nó khó thấy hơn nhiều.
 *
 *      Prompt đặt đúng chuyện này làm ĐIỀU KIỆN DỪNG: "Muốn đạt tỉ lệ dùng lại thì phải để bước chứa
 *      oracle" ⇒ dừng. Gate này là cách biến điều kiện đó thành một phép đo thay vì một lời dặn.
 *
 *   2. **Bộ kiểm L4 KHÔNG có tham số kỳ vọng mặc định.** Một bộ kiểm có giá trị mặc định là một bộ kiểm
 *      luôn xanh ở mọi dự án — tức không kiểm gì.
 *
 *   3. **Bước không so với giá trị nghiệp vụ hardcode.** Đây là luật KHÓ ĐO NHẤT, và gate khai rõ giới hạn
 *      của nó thay vì giả vờ đo được: nó chỉ bắt được dạng lộ (`=== 'chuỗi tiếng Việt nhiều chữ'`), còn
 *      một giá trị nghiệp vụ gán vào biến rồi mới so thì máy không thấy. Phần đó thuộc tầng chấm §A11.
 *
 * Dùng: node scripts/qa/reuse/steps_lint.js [--json]
 * Exit: 0 · 1 khi vi phạm luật 1 hoặc 2 · 2 khi quét 0 file (phép đo hỏng)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const GOC = path.join(REPO, 'tests', 'fe', 'lib');
const JSON_OUT = process.argv.includes('--json');

/** Thư mục CHỈ ĐƯỢC làm thao tác — không `expect`. */
const KHONG_ORACLE = [/[\\/]_widget[\\/]/, /[\\/]screens[\\/]/, /[\\/]steps[\\/]/, /[\\/]flows[\\/]/, /[\\/]builders[\\/]/];
/** Thư mục được phép chứa `expect`. */
const DUOC_ORACLE = [/[\\/]_checks[\\/]/, /[\\/]checks[\\/]/];

function quet(d, ra) {
  let muc;
  try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const f of muc) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { quet(p, ra); continue; }
    if (/\.(ts|js)$/.test(f.name)) ra.push(p);
  }
}

/** Bóc bình luận và nội dung chuỗi — cùng lý lẽ với `sql_readonly_lint` của §0b. */
function thanCode(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/**
 * Giá trị nghiệp vụ hardcode — CHỈ bắt dạng lộ, và gate tự khai giới hạn đó.
 *
 * Dạng lộ: so bằng với một chuỗi tiếng Việt từ 3 chữ trở lên (`=== 'Tên trường là bắt buộc'`). Ba chữ là
 * ngưỡng đo được: tên field và nhãn nút thường 1–2 chữ, còn một CÂU kỳ vọng thì dài hơn.
 *
 * Không bắt được: giá trị gán vào biến rồi mới so, giá trị đọc từ config, giá trị ghép chuỗi. Phần đó
 * thuộc tầng chấm §A11 (mục `ORACLE_DOC_LAP`), và nói thẳng ra thì tốt hơn là giả vờ đo được.
 */
const GIA_TRI_NGHIEP_VU = /[=!]==?\s*(['"`])([^'"`]*\p{L}+(?:\s+\S+){2,}[^'"`]*)\1/u;

function kiem() {
  const files = [];
  quet(GOC, files);

  const chan = [];
  const canhBao = [];

  for (const f of files) {
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    const than = thanCode(src);

    /* LUẬT 1 — bước không chứa oracle. */
    if (KHONG_ORACLE.some((re) => re.test(f)) && !DUOC_ORACLE.some((re) => re.test(f))) {
      if (/\bexpect\s*\(/.test(than)) {
        chan.push({
          luat: 1,
          file: rel,
          y: 'chứa `expect(` — bước chỉ được làm THAO TÁC. Phán đúng/sai thuộc bộ kiểm L4, với giá trị kỳ vọng lấy từ case.',
        });
      }
      if (/from\s+['"]@playwright\/test['"]/.test(src) && /\bexpect\b/.test(src.split('\n').find((l) => /@playwright\/test/.test(l)) || '')) {
        chan.push({
          luat: 1,
          file: rel,
          y: 'import `expect` từ @playwright/test — mở đường cho assertion lọt vào tầng thao tác.',
        });
      }
      /* LUẬT 3 — cảnh báo, không chặn. Xem ghi chú ở `GIA_TRI_NGHIEP_VU`. */
      const m = than.match(GIA_TRI_NGHIEP_VU);
      if (m) canhBao.push({ luat: 3, file: rel, y: `so bằng với một câu dài: ${m[0].slice(0, 60)}` });
    }

    /* LUẬT 2 — bộ kiểm không có tham số kỳ vọng mặc định. */
    if (DUOC_ORACLE.some((re) => re.test(f))) {
      /*
       * Tìm tham số có tên gợi ý "kỳ vọng" MÀ có giá trị mặc định. `opts: {...} = {}` thì KHÔNG tính —
       * đó là túi tuỳ chọn, không phải giá trị kỳ vọng.
       */
      /*
       * `=` PHẢI LÀ PHÉP GÁN, không phải một phần của `==`/`===`/`=>`/`!=`.
       *
       * Bản đầu dùng `=\s*[^,)]` và nó bắt `kyVong === undefined` — tức bắt một phép SO thành một giá trị
       * mặc định, rồi CHẶN đúng dòng đang THỰC THI luật 2. Gate báo oan chính cái nó canh, và đó là lần
       * thứ năm trong hai đợt này một bộ dò bằng chữ của tôi cần nới đúng chỗ.
       */
      const re = /\b(kyVong|giaTriKyVong|nguyenVanKyVong|expected|mong[A-Za-z]*)\s*(?::[^,)=]+)?\s*(?<![=!<>])=(?![=>])\s*[^,)]/g;
      for (const mm of than.matchAll(re)) {
        chan.push({
          luat: 2,
          file: rel,
          y: `tham số kỳ vọng có GIÁ TRỊ MẶC ĐỊNH: \`${mm[0].trim().slice(0, 48)}\` — bộ kiểm có mặc định là bộ kiểm luôn xanh.`,
        });
      }
      if (!/batBuocKyVong|CheckUsageError/.test(src) && /\bexport\s+(async\s+)?function\s+expect/.test(src)) {
        canhBao.push({
          luat: 2,
          file: rel,
          y: 'khai bộ kiểm mà không dùng `batBuocKyVong` — gọi thiếu giá trị kỳ vọng sẽ không bị ném lỗi.',
        });
      }
    }
  }

  return { so_file: files.length, chan, canh_bao: canhBao };
}

function main() {
  const d = kiem();

  if (!d.so_file) {
    /*
     * 0 file KHÔNG phải lỗi ở đây, khác với các gate khác: thư viện `tests/fe/lib/` đang được dựng dần,
     * và lúc chưa có file nào thì không có gì để canh. Nhưng phải NÓI RA, vì một dòng "✓" trên một tập
     * rỗng sẽ được đọc thành "thư viện sạch".
     */
    console.log('[steps-lint] ○ CHƯA CÓ GÌ ĐỂ CANH — 0 file trong tests/fe/lib/.');
    console.log('             Đây không phải "thư viện sạch", mà là "thư viện chưa có file nào".');
    return;
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(d, null, 2));
    process.exit(d.chan.length ? 1 : 0);
  }

  console.log(`[steps-lint] ${d.so_file} file · ${d.chan.length} vi phạm CHẶN · ${d.canh_bao.length} cảnh báo`);

  if (d.canh_bao.length) {
    console.log('');
    console.log('~ Cảnh báo (luật 3 chỉ bắt được dạng LỘ — giá trị gán vào biến rồi mới so thì máy không thấy;');
    console.log('  phần đó thuộc tầng chấm §A11, mục ORACLE_DOC_LAP):');
    for (const c of d.canh_bao) console.log(`  ${c.file}\n    luật ${c.luat}: ${c.y}`);
  }

  if (d.chan.length) {
    console.error('');
    console.error('✗ CHẶN:');
    for (const c of d.chan) console.error(`  ${c.file}\n    luật ${c.luat}: ${c.y}`);
    console.error('');
    console.error('  Luật 1 là luật quan trọng nhất của v2.8.0: một bước mang oracle làm tỉ lệ "dùng lại" nhảy');
    console.error('  vọt, nhưng oracle bị đóng khung trong code và case sẽ xanh kể cả khi đặc tả đã đổi —');
    console.error('  `app == app` chuyển xuống tầng thư viện, khó thấy hơn nhiều.');
    process.exit(1);
  }

  console.log('\n✓ Thư viện bước không chứa oracle; bộ kiểm không có giá trị kỳ vọng mặc định.');
}

if (require.main === module) main();

module.exports = { kiem, thanCode, GIA_TRI_NGHIEP_VU, KHONG_ORACLE, DUOC_ORACLE };
