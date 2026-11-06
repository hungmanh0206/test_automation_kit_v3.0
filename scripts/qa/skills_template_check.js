#!/usr/bin/env node
/**
 * `skills:template:check` — SKILL KHAI OUTPUT THÌ PHẢI CÓ MẪU, VÀ MẪU PHẢI TỰ QUA MÁY CỦA NÓ.
 *
 * Dùng: node scripts/qa/skills_template_check.js [--enforce] [--liet-ke]
 *   exit 0 = đạt · 1 = vi phạm (chỉ khi --enforce) · 2 = KHÔNG PHÁN ĐƯỢC
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * VÌ SAO CÓ CỬA NÀY
 *
 * Khoảng cách của tiêu chí "hướng dẫn cụ thể" không nằm ở chỗ skill thiếu chữ. Nó nằm ở chỗ đọc một
 * skill xong vẫn chưa biết SẢN PHẨM phải trông thế nào. Đo 06/11/2026: 17 skill khai tổng **46 output**
 * trong mục `## Outputs`, và **0 output** nào có mẫu.
 *
 * Mẫu ở đây KHÔNG phải khung trống. Khung trống thì ai cũng dựng được và không ai học được gì từ nó.
 * Mẫu là một bản ĐÃ ĐIỀN XONG trên miền thật (trường/lớp/học sinh/đội ngũ), và nếu output đó có máy
 * kiểm thì **chính mẫu phải qua được máy đó**. Mẫu sai thì cửa này đỏ, nên mẫu không mục dần.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * SỔ NỢ, KHÔNG PHẢI CHẶN TẤT — theo đúng khuôn `no` đã có trong `skills_lint.json`.
 *
 * Chặn thẳng 46 output là đặt một ngưỡng đỏ ngay hôm đặt. Chính `prompt_budget.json` đã viết vì sao
 * không làm thế: "một ngưỡng đã đỏ ngay hôm đặt thì nó là tiếng ồn, và tiếng ồn thì bị tắt". Nên:
 *
 *   - `no.thieuMau` khai số output CHƯA có mẫu. Thực tế > khai ⇒ CHẶN (có nợ MỚI).
 *   - Thực tế < khai ⇒ CHẶN, kèm con số để hạ sổ. Nợ trả rồi mà không hạ sổ thì sổ mất nghĩa.
 *   - Mẫu đã khai mà đường dẫn không tồn tại ⇒ CHẶN ngay, không tính vào nợ. Một con trỏ chết tệ hơn
 *     một chỗ trống: chỗ trống thì người ta biết là thiếu.
 *
 * KHOÁ NỢ ĐẶT NGOÀI `no` ⇒ CHẶN NGAY. Lớp lỗi này đã xảy ra thật với `skills_lint` và sống 13 ngày:
 * sổ ghi ở cấp ngoài, script chỉ đọc `CFG.no`, nên gate vẫn in đúng câu mà đọc sai sổ.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * MÁY KIỂM CỦA TỪNG MẪU khai trong frontmatter của chính mẫu:
 *
 *   kiem_bang: node scripts/qa/design_gate.js --mode checklist --file
 *   vi_sao:    <một câu>                      # khi KHÔNG có máy kiểm được
 *
 * `kiem_bang` được nối thêm đường dẫn mẫu rồi chạy; exit khác 0 là CHẶN. Mẫu không khai `kiem_bang`
 * thì BẮT BUỘC khai `vi_sao` — nói thẳng vì sao không máy nào kiểm được nó. Phần lớn cửa của kit đọc
 * THƯ MỤC output của một task chứ không đọc một file rời, nên "chưa có máy kiểm" là trạng thái thật và
 * phải khai được, chứ không phải chỗ để lách.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const DIR = path.join(REPO, '.agent', 'skills');
const CFG_F = path.join(REPO, '.agent', 'config', 'skills_template.json');

const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');

function thoat2(msg, them) {
  console.log(`[skills-template] KHÔNG PHÁN ĐƯỢC — ${msg}`);
  if (them) console.log(`                  ${them}`);
  process.exit(2);
}

if (!fs.existsSync(DIR)) thoat2('không thấy .agent/skills/.', 'Cây-gói phát hành không có thư mục này; cửa im chứ không đoán.');

let CFG = {};
try {
  CFG = JSON.parse(fs.readFileSync(CFG_F, 'utf8'));
} catch (e) {
  thoat2(`không đọc được ${path.relative(REPO, CFG_F)}.`, 'Sổ nợ là nguồn duy nhất của ngưỡng; thiếu nó thì không phán.');
}

const NO = CFG.no || {};
const KHOA_NO = ['thieuMau'];
const ngoai = KHOA_NO.filter((k) => Object.prototype.hasOwnProperty.call(CFG, k));
if (ngoai.length) {
  console.error(`[skills-template] ✗ CHẶN — khoá nợ đặt NGOÀI \`no\`: ${ngoai.join(', ')}.`);
  console.error('                  Script chỉ đọc `CFG.no`, nên sổ ở cấp ngoài là một con số không ai đọc.');
  console.error('                  Lớp lỗi này đã sống 13 ngày ở `skills_lint.json`. Chuyển vào `no`.');
  process.exit(1);
}

/** Đọc frontmatter rất gọn: chỉ cần `kiem_bang` và `vi_sao`, không thêm dependency YAML. */
function docFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const ra = {};
  for (const d of m[1].split(/\r?\n/)) {
    const i = d.indexOf(':');
    if (i <= 0) continue;
    ra[d.slice(0, i).trim()] = d.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return ra;
}

/** Các output một skill khai trong mục `## Outputs` (bảng hai cột). */
function docOutput(src) {
  const i = src.search(/^##+\s*Output/mi);
  if (i < 0) return null;
  const khoi = src.slice(i).split(/\n##\s/)[0];
  return [...khoi.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/gm)]
    .map((m) => m[1].trim())
    .filter((t) => t && !/^-+$/.test(t) && !/^output$/i.test(t));
}

/**
 * Mọi chỗ khai `Mẫu: <đường dẫn>` trong một skill.
 *
 * Tìm Ở BẤT KỲ ĐÂU trong dòng, không neo đầu dòng. Bản đầu neo đầu dòng và trượt ngay ca dùng thật
 * đầu tiên: `Mẫu:` nằm trong ô thứ ba của bảng Outputs (`| Output | Vị trí | Mẫu |`), tức giữa dòng.
 * Cửa khi đó đếm 0 mẫu và báo nợ PHÌNH trong khi mẫu có thật và đã qua máy — một cửa báo oan thì
 * người ta tắt nó, chứ không sửa theo nó.
 */
function docMau(src) {
  /*
   * HAI CHỐT, vì mỗi chốt một mình đều đã sai thật:
   *
   * ① Bản neo đầu dòng TRƯỢT ca dùng đầu tiên — `Mẫu:` nằm trong ô thứ ba của bảng Outputs, giữa dòng.
   *    Cửa đếm 0 mẫu rồi báo nợ PHÌNH trong khi mẫu có thật và đã qua máy.
   * ② Bản nới ra ĐẾM THỪA 18 mẫu: mọi skill đều có dòng `Câu kích hoạt mẫu:` — chuỗi kết thúc đúng
   *    bằng "mẫu:" — nên nó bắt từ đầu tiên trong câu ví dụ. Nợ tụt từ 46 xuống 29 mà không ai thêm mẫu
   *    nào. Đếm thừa mẫu thì CHE nợ thật, tệ hơn hẳn báo oan.
   *
   * Nên: không cho ký tự chữ đứng ngay trước `Mẫu` (loại `hoạt mẫu:`), và đòi thứ bắt được có HÌNH
   * DẠNG ĐƯỜNG DẪN (có `/` hoặc đuôi `.md`). Một chốt về ngữ cảnh, một chốt về kiểu dữ liệu.
   */
  return [...src.matchAll(/(^|[^\p{L}])Mẫu:\**\s*\[?`?([^\s`\]|)]+)`?\]?/giu)]
    .map((m) => m[2].trim())
    .filter((x) => x.includes('/') || /\.md$/i.test(x));
}

const skill = [];
for (const g of fs.readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  for (const s of fs.readdirSync(path.join(DIR, g.name), { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const f = path.join(DIR, g.name, s.name, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const out = docOutput(src);
    if (!out) continue;
    skill.push({ ten: s.name, nhom: g.name, thuMuc: path.join(DIR, g.name, s.name), out, mau: docMau(src) });
  }
}

if (!skill.length) thoat2('không skill nào khai mục `## Outputs`.', 'Không có gì để đo thì cửa im, KHÔNG trả "đạt".');

const chan = [];
let soMau = 0;
let thieuMau = 0;

for (const s of skill) {
  thieuMau += Math.max(0, s.out.length - s.mau.length);

  for (const m of s.mau) {
    soMau += 1;
    const duong = path.isAbsolute(m) ? m : path.join(REPO, m);
    if (!fs.existsSync(duong)) {
      chan.push(`${s.ten}: \`Mẫu: ${m}\` KHÔNG tồn tại. Con trỏ chết tệ hơn chỗ trống — chỗ trống thì người ta biết là thiếu.`);
      continue;
    }
    const fm = docFrontmatter(fs.readFileSync(duong, 'utf8'));
    if (!fm.kiem_bang) {
      if (!fm.vi_sao) {
        chan.push(`${s.ten}: mẫu \`${m}\` không khai \`kiem_bang\` mà cũng không khai \`vi_sao\`. Không máy nào kiểm được thì phải NÓI RA.`);
      }
      continue;
    }
    const phan = fm.kiem_bang.trim().split(/\s+/);
    const r = spawnSync(phan[0] === 'node' ? process.execPath : phan[0], [...phan.slice(1), duong], {
      cwd: REPO, encoding: 'utf8', timeout: 180000,
    });
    if (r.status !== 0) {
      const cuoi = String(r.stdout || r.stderr || '').trim().split('\n').slice(-2).join(' ').slice(0, 160);
      chan.push(`${s.ten}: mẫu \`${m}\` KHÔNG qua máy của nó (\`${fm.kiem_bang}\`, exit ${r.status}). ${cuoi}`);
    }
  }
}

if (flag('liet-ke')) {
  for (const s of skill) console.log(`${s.ten.padEnd(30)} ${String(s.out.length).padStart(2)} output · ${s.mau.length} mẫu`);
}

const khai = Number(NO.thieuMau);
console.log(`[skills-template] ${skill.length} skill khai Outputs · ${skill.reduce((a, s) => a + s.out.length, 0)} output · ${soMau} mẫu · nợ thực ${thieuMau} / khai ${Number.isFinite(khai) ? khai : '(chưa khai)'}`);

if (!Number.isFinite(khai)) {
  /*
   * ĐẨY VÀO `chan`, KHÔNG chỉ đặt `process.exitCode`.
   *
   * Bản đầu đặt `exitCode` rồi vẫn rơi xuống nhánh dưới; `chan` khi đó rỗng nên cửa in "✓ ĐẠT" và gọi
   * `process.exit(0)`, ghi đè luôn `exitCode`. Tức cửa khai ĐẠT trong khi sổ nợ chưa tồn tại — đúng
   * lớp hỏng nó sinh ra để chặn. Ca đối chứng "chưa khai no.thieuMau" bắt được.
   */
  chan.push('`no.thieuMau` chưa khai số. Sổ nợ phải là một con số thấy được trong diff, không phải một chỗ trống.');
} else if (thieuMau > khai) {
  chan.push(`nợ thiếu mẫu PHÌNH: thực ${thieuMau} > khai ${khai} ⇒ ${thieuMau - khai} output MỚI khai output mà không kèm mẫu.`);
} else if (thieuMau < khai) {
  chan.push(`nợ đã trả bớt (thực ${thieuMau} < khai ${khai}) nhưng sổ chưa hạ. Sửa \`no.thieuMau\` thành ${thieuMau} — nợ trả rồi mà không hạ sổ thì sổ mất nghĩa.`);
}

for (const c of chan) console.log('  ✗ ' + c);

if (!chan.length) {
  console.log('[skills-template] ✓ ĐẠT — mọi mẫu đã khai đều tồn tại, và mẫu nào có máy kiểm thì tự qua máy đó.');
  console.log('[skills-template] Giới hạn: cửa này KHÔNG chấm mẫu có DẠY ĐƯỢC hay không, chỉ chấm có THẬT và có QUA MÁY.');
  process.exit(0);
}

console.error('\n[skills-template] ✗ CHẶN. Mẫu phải là bản ĐÃ ĐIỀN trên miền thật, không phải khung trống.');
if (!ENFORCE) {
  console.log('[skills-template] (bản thường không chặn — dùng `npm run skills:template:check:enforce`)');
  process.exit(0);
}
process.exitCode = 1;
