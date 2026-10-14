#!/usr/bin/env node
/**
 * oracle_calc_check.js — TRỤC ⑦: canh bộ oracle giá trị tính toán.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * CANH GÌ, và vì sao từng điều:
 *
 *   ① Mỗi oracle neo vào một rule CÓ THẬT trong `knowledge/domain`, và rule đó `active`.
 *      Oracle gắn một mã không tra ra gì là "oracle ma" — `domain_rules.js` đã có từ này cho testcase,
 *      dùng lại đúng nó. Trỏ vào rule `draft` còn tệ hơn: nó TRÔNG như có neo.
 *   ② Oracle KHÔNG đọc gì của app. Không `page`/`locator`/`expect`, không import từ `screens/` `steps/`
 *      `_widget/` `_checks/`. Một oracle đọc app là `app == app` — case xanh mãi mãi vì nó so app với
 *      chính app, và chuyện đó khó thấy hơn nhiều khi nằm ở tầng thư viện.
 *   ③ Mỗi oracle có CẶP ĐỐI CHỨNG: ít nhất một ca `dung` và một ca `lech`. Oracle chỉ có ca đúng chưa
 *      chứng minh được nó phân biệt được gì.
 *   ④ 0 oracle ⇒ `CHƯA KIỂM`, `proven=0`, exit 2. KHÔNG phải "không có vấn đề tính toán".
 *
 * MÁY NÀY CHỈ ĐỌC VĂN BẢN NGUỒN. Phần hành vi (ném khi thiếu tham số, ca `dung` phải đúng, ca `lech`
 * phải KHÁC giá trị app) do `tests/fe/infra/oracle-calc.spec.ts` chạy thật — vì nó cần nạp TypeScript.
 * Chia đôi như vậy là theo đúng cách `steps:lint` (node, đọc nguồn) và các spec L4 đang chia.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: npm run oracle:calc [-- --dir <thư mục oracle>] [--out <report.md>] [--enforce]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/** Khuôn `oracle_ref` — GIỮ ĐÚNG của `scripts/lib/expansion/finding.js`. */
const ORACLE_RE = /^(BR|SM|PM|SS|DM|UI)-[A-Z0-9]+-\d{3}$/;

/*
 * Dấu hiệu "oracle đang đọc app". Dò trên nguồn ĐÃ BỎ CHÚ THÍCH — nếu không thì chính khối chú thích
 * giải thích "không được dùng `page`" sẽ làm máy đỏ, và người ta sẽ gỡ lời giải thích để cho xanh.
 */
const CAM = [
  { re: /\bpage\s*\./, vi_sao: 'chạm `page` — đó là đọc app' },
  { re: /\blocator\s*\(|\.locator\b/, vi_sao: 'dùng locator — đó là đọc DOM' },
  { re: /\bexpect\s*\(/, vi_sao: '`expect` thuộc L4, không thuộc oracle; oracle TÍNH, không SO' },
  { re: /\.(?:textContent|innerText|inputValue|getAttribute)\b/, vi_sao: 'đọc giá trị từ DOM' },
  { re: /from\s+['"][^'"]*(?:screens|steps|_widget|_checks)[^'"]*['"]/, vi_sao: 'import từ tầng chạm app' },
  { re: /\bfetch\s*\(|require\(['"](?:http|https|axios)['"]\)/, vi_sao: 'gọi mạng — kỳ vọng phải tính từ đặc tả, không đi hỏi ai' },
];

/** Bỏ chú thích và chuỗi, để dò trên phần MÃ thật. */
function thanMa(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

/** Đọc danh mục rule trong knowledge/domain → Map(id → {status, file}). */
function napRule(duong) {
  const dir = duong || path.join(REPO, 'knowledge', 'domain');
  const m = new Map();
  if (!fs.existsSync(dir)) return m;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (j && j.id) m.set(String(j.id).toUpperCase(), { status: String(j.status || ''), file: f });
    } catch (e) { /* file hỏng — `domain_rules.js` là máy gác việc đó, không phải máy này */ }
  }
  return m;
}

/** Tách các oracle khai trong một file nguồn. */
function docOracle(src, ten) {
  const than = thanMa(src);
  const ra = [];
  const re = /oracle_ref:\s*['"]([^'"]+)['"][\s\S]{0,400}?ten:\s*['"]([^'"]+)['"]/g;
  let m = re.exec(src);
  while (m) {
    /* Đếm ca đối chứng trong khối của oracle này: từ vị trí khai tới `dangKy` kế tiếp (hoặc hết file). */
    const sau = src.slice(m.index);
    const het = sau.indexOf('dangKy', 10);
    const khoi = het > 0 ? sau.slice(0, het) : sau;
    ra.push({
      file: ten,
      ref: m[1],
      ten_oracle: m[2],
      so_dung: (khoi.match(/ky_vong:/g) || []).length,
      so_lech: (khoi.match(/app_tra:/g) || []).length,
    });
    m = re.exec(src);
  }
  return { oracles: ra, than };
}

function main() {
  const dir = path.resolve(arg('dir', path.join(REPO, 'tests', 'fe', 'lib', 'oracles')));
  const out = path.resolve(arg('out', path.join(REPO, 'reports', 'oracle-calc.md')));
  const rules = napRule(arg('rules-dir'));

  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    : [];

  const oracles = [];
  const loi = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const { oracles: os, than } = docOracle(src, f);
    oracles.push(...os);

    for (const c of CAM) {
      if (c.re.test(than)) loi.push({ file: f, ref: '—', vi_sao: `${c.vi_sao} (mẫu \`${c.re}\`)` });
    }
  }

  for (const o of oracles) {
    const ref = String(o.ref).toUpperCase();
    if (!ORACLE_RE.test(ref)) {
      loi.push({ file: o.file, ref: o.ref, vi_sao: '`oracle_ref` sai khuôn — oracle không neo vào đặc tả thì nó neo vào app' });
      continue;
    }
    const r = rules.get(ref);
    if (!r) {
      loi.push({ file: o.file, ref: o.ref, vi_sao: '**oracle ma** — `knowledge/domain` KHÔNG có rule id này' });
    } else if (r.status !== 'active') {
      loi.push({ file: o.file, ref: o.ref, vi_sao: `rule ở trạng thái \`${r.status}\`, không phải \`active\` — neo vào bản nháp TRÔNG như có neo` });
    }
    if (!o.so_dung) loi.push({ file: o.file, ref: o.ref, vi_sao: 'thiếu ca ĐÚNG (`dung`)' });
    if (!o.so_lech) {
      loi.push({
        file: o.file,
        ref: o.ref,
        vi_sao: 'thiếu ca LỆCH (`lech`) — oracle chỉ có ca đúng có thể đang trả đúng vì nó LUÔN trả đúng',
      });
    }
  }

  /*
   * KHO RULE RỖNG ⇒ KHÔNG PHÁN ĐƯỢC, không phải "mọi oracle đều là ma".
   *
   * Bản đóng gói mang `knowledge/domain/` RỖNG — kho rule là tài sản của từng dự án, không đi theo kit.
   * Bản đầu của máy này vì thế kết cả hai oracle tham chiếu là "oracle ma" và exit 1, tức người nhận kit
   * vừa cài xong đã thấy hai lỗi bịa. `release:verify` bắt đúng chuyện đó.
   *
   * Phân biệt hai tình huống khác hẳn nhau: kho CÓ rule mà không tra ra ref ⇒ oracle ma (lỗi thật);
   * kho KHÔNG có rule nào ⇒ phép đối chiếu chưa xảy ra.
   */
  const khoRong = rules.size === 0;
  if (khoRong) {
    for (let i = loi.length - 1; i >= 0; i -= 1) {
      if (/oracle ma|trạng thái/.test(loi[i].vi_sao)) loi.splice(i, 1);
    }
  }

  const chuaKiem = oracles.length === 0 || khoRong;
  const proven = chuaKiem ? 0 : oracles.length - new Set(loi.filter((l) => l.ref !== '—').map((l) => l.ref)).size;

  const L = [
    `<!-- gate: proven=${Math.max(proven, 0)} inconclusive=${chuaKiem ? 1 : 0} broken=${loi.length} -->`,
    '# Mở rộng ⑦ — oracle giá trị tính toán', '',
    '> Sinh bởi `scripts/qa/oracle_calc_check.js`. Oracle TÍNH kỳ vọng từ đặc tả; nó không đọc gì của app.',
    '> Mỗi oracle phải neo vào một rule `active` trong `knowledge/domain` và có **cặp đối chứng**',
    '> (một ca đúng, một ca lệch đã biết).', '',
  ];
  if (chuaKiem) {
    L.push('## CHƯA KIỂM', '',
      khoRong
        ? `- \`knowledge/domain/\` KHÔNG có rule nào (${oracles.length} oracle đang khai). Kho rule là tài sản của `
          + 'từng dự án và không đi theo kit — chưa có rule thì chưa đối chiếu được `oracle_ref` nào.'
        : `- Không oracle nào đăng ký trong \`${path.relative(REPO, dir)}\`.`, '',
      '`proven=0` ở đây KHÔNG có nghĩa "không có vấn đề tính toán" — nghĩa là chưa ai đo giá trị dẫn xuất nào.', '');
  } else {
    L.push(`- Oracle: **${oracles.length}** · rule trong kho: **${rules.size}**`, '',
      '| Oracle | `oracle_ref` | Rule | Ca đúng | Ca lệch | File |', '|---|---|---|---|---|---|',
      ...oracles.map((o) => {
        const r = rules.get(String(o.ref).toUpperCase());
        return `| ${o.ten_oracle} | \`${o.ref}\` | ${r ? r.status : '**không có**'} | ${o.so_dung} | ${o.so_lech} | \`${o.file}\` |`;
      }), '');
  }
  if (loi.length) {
    L.push('## Vi phạm (phải sửa)', '', ...loi.map((l) => `- \`${l.file}\` ${l.ref !== '—' ? `\`${l.ref}\` ` : ''}— ${l.vi_sao}`), '');
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${L.join('\n')}\n`);

  console.log(`[oracle] ${oracles.length} oracle · ${rules.size} rule trong kho · ${loi.length} vi phạm`);
  console.log(`[oracle] báo cáo: ${path.relative(REPO, out)}`);
  for (const l of loi) console.error(`[oracle] ✗ ${l.file} ${l.ref} — ${l.vi_sao}`);

  if (chuaKiem) {
    console.error(khoRong
      ? '[oracle] ✗ CHƯA KIỂM (exit 2) — `knowledge/domain/` rỗng, không đối chiếu được `oracle_ref` nào.'
      : '[oracle] ✗ CHƯA KIỂM (exit 2) — chưa oracle nào đăng ký. Đó KHÔNG phải một lượt đo đạt.');
    process.exit(2);
  }
  if (loi.length && flag('enforce')) process.exit(1);
}

if (require.main === module) main();
module.exports = { ORACLE_RE, CAM, thanMa, docOracle, napRule };
