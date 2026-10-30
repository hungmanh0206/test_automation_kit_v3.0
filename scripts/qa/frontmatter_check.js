#!/usr/bin/env node
/*
 * `frontmatter:check` — file định nghĩa agent/skill phải THẬT SỰ NẠP ĐƯỢC (v2.9.6).
 *
 * VÌ SAO CẦN, và đây là một lỗ đã ĐO RA chứ không phải lo xa.
 *
 * `.claude/agents/case-debugger.md` vào repo từ 10–11/10/2026 và **chưa bao giờ được harness đăng ký** —
 * quan sát ở BA phiên khác nhau. Gọi `Agent(case-debugger)` trả về `Agent type 'case-debugger' not
 * found` kèm danh sách agent không có nó.
 *
 * Tôi đã đoán SAI suốt ba phiên: khác biệt duy nhất tôi thấy là file đó thiếu dòng `model:`, nên tôi ghi
 * vào tài liệu rằng đó là nghi vấn chính. Tài liệu Claude Code nói `model:` là **TUỲ CHỌN** (chỉ `name`
 * và `description` bắt buộc), và nêu danh sách điều kiện làm một file bị BỎ QUA — trong đó có **YAML
 * không parse được**.
 *
 * Parse bằng parser thật thì ra ngay: dòng `description` chứa `: ` (hai chấm + khoảng trắng) mà KHÔNG
 * bọc nháy — trong YAML, `: ` giữa một plain scalar là lỗi (`Nested mappings are not allowed in compact
 * mappings`). Hai agent đang đăng ký được thì không có dấu hai chấm nào trong giá trị.
 *
 * Quét toàn bộ: **5/75** file có frontmatter bị vỡ cùng một kiểu — 1 agent + 2 skill nguồn + 2 shim sinh
 * ra từ chúng. Hai skill ấy vẫn `Skill(<tên>)` gọi được, nên skill và agent KHÔNG cùng cách nạp (skill
 * nhận diện theo thư mục, agent theo `name` trong frontmatter); nhưng vỡ YAML thì vẫn phải sửa.
 *
 * VÌ SAO CỬA NÀY KHÔNG DÙNG PARSER YAML: repo không có phụ thuộc YAML, và thêm một phụ thuộc chỉ để gác
 * bốn luật thì đắt hơn là gác thẳng bốn luật. Nên nó kiểm đúng các điều kiện TÀI LIỆU ĐÃ NÊU, bằng chữ.
 *
 * GIỚI HẠN, nói thẳng: đây KHÔNG phải một bộ parse YAML. Một frontmatter vỡ theo kiểu khác (thụt lề sai,
 * list hỏng, neo/alias) thì cửa này KHÔNG thấy. Nó gác đúng lớp lỗi đã xảy ra, cộng vài lớp cùng họ.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
/* `--dir <thu-muc>` de phep kiem soi mot cay TAM, khong phai sua file cua repo. */
const doiSo = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const DIR = doiSo('dir');
const GOC = DIR
  ? ['.']
  : ['.claude/agents', '.claude/skills', '.claude/commands', '.agent/skills', '.agent/workflows'];

/*
 * Ký tự mở đầu mà YAML coi là CÚ PHÁP, không phải chữ. Giá trị bắt đầu bằng chúng mà không bọc nháy thì
 * hoặc vỡ, hoặc bị đọc thành một kiểu dữ liệu khác — cả hai đều không phải điều người viết muốn.
 */
const MO_DAU_DAC_BIET = ['{', '[', '*', '&', '!', '|', '>', '%', '@', '`', '?', ',', ']', '}'];

function timFile(d, sau = 0, ra = []) {
  if (sau > 6 || !fs.existsSync(d)) return ra;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { timFile(p, sau + 1, ra); continue; }
    if (e.name.endsWith('.md')) ra.push(p);
  }
  return ra;
}

/** Trả về `{ than, dong0 }` hoặc null nếu file không mở frontmatter ở DÒNG ĐẦU. */
function layFrontmatter(s) {
  const t = s.replace(/\r/g, '');
  if (!t.startsWith('---\n')) return null;
  const het = t.indexOf('\n---', 4);
  if (het < 0) return { loi: 'frontmatter MỞ mà không ĐÓNG — tài liệu nói file này bị bỏ qua, không thông báo' };
  return { than: t.slice(4, het) };
}

function kiemMotFile(p) {
  const rel = path.relative(DIR ? path.resolve(DIR) : REPO, p).split(path.sep).join('/');
  const s = fs.readFileSync(p, 'utf8');
  const loi = [];

  /*
   * File KHÔNG có frontmatter không phải lỗi: `.agent/workflows` và `references/` có nhiều file văn
   * xuôi thuần. Chỉ soi file ĐÃ mở frontmatter — và với agent/skill thì frontmatter là bắt buộc, nên
   * thiếu nó được báo riêng ở dưới.
   */
  const fm = layFrontmatter(s);
  const laDinhNghia = /^\.claude\/agents\/[^/]+\.md$/.test(rel) || /\/SKILL\.md$/.test(rel);
  if (!fm) {
    if (laDinhNghia) loi.push('KHÔNG có frontmatter mở ở DÒNG ĐẦU — tài liệu nói file này bị bỏ qua, không thông báo');
    return { rel, loi };
  }
  if (fm.loi) { loi.push(fm.loi); return { rel, loi }; }

  const dong = fm.than.split('\n');
  const khoa = new Map();
  for (let i = 0; i < dong.length; i += 1) {
    const d = dong[i];
    /* Bỏ dòng rỗng, dòng chú thích, và dòng thuộc một khối lồng (thụt lề hoặc phần tử list). */
    if (!d.trim() || /^\s*#/.test(d) || /^\s/.test(d) || /^-\s/.test(d)) continue;
    const m = d.match(/^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (!m) { loi.push(`dòng ${i + 2} không phải cặp \`khoá: giá trị\` — "${d.slice(0, 48)}"`); continue; }
    const [, k, thoGiaTri] = m;
    const v = thoGiaTri.trim();
    khoa.set(k, v);
    if (!v) continue;                                   // giá trị rỗng/khối lồng — ngoài phạm vi cửa này
    const boNhay = /^(".*"|'.*')$/.test(v);
    if (boNhay) continue;

    /*
     * ĐÂY LÀ LUẬT ĐÃ CỨU `case-debugger`. `: ` trong plain scalar làm YAML vỡ, và file bị bỏ qua IM
     * LẶNG — không log, không cảnh báo, chỉ là agent không bao giờ xuất hiện.
     */
    if (/:\s/.test(v)) {
      loi.push(`dòng ${i + 2} · \`${k}\`: giá trị chứa \`: \` mà KHÔNG bọc nháy ⇒ YAML VỠ ⇒ file bị bỏ qua im lặng. `
        + `Bọc cả giá trị trong nháy đôi. Đo 30/10/2026: đúng lỗi này làm \`case-debugger\` không đăng ký suốt 20 ngày.`);
    }
    if (/\s#/.test(v)) {
      loi.push(`dòng ${i + 2} · \`${k}\`: giá trị chứa \` #\` mà không bọc nháy ⇒ YAML cắt phần sau thành chú thích`);
    }
    if (MO_DAU_DAC_BIET.includes(v[0])) {
      loi.push(`dòng ${i + 2} · \`${k}\`: giá trị mở đầu bằng \`${v[0]}\` — YAML coi đó là cú pháp, không phải chữ. Bọc nháy.`);
    }
  }

  if (laDinhNghia) {
    /* Hai trường BẮT BUỘC theo tài liệu; thiếu `name` thì bỏ qua không thông báo, thiếu `description` thì ghi debug log. */
    for (const k of ['name', 'description']) {
      if (!khoa.has(k) || !khoa.get(k)) loi.push(`THIẾU \`${k}\` — tài liệu nói chỉ \`name\` và \`description\` là bắt buộc, và thiếu thì file bị bỏ qua`);
    }
    const ten = String(khoa.get('name') || '').replace(/^["']|["']$/g, '');
    if (ten) {
      if (ten.startsWith('-')) loi.push('`name` mở đầu bằng `-` ⇒ file bị bỏ qua');
      if (ten.includes(':')) loi.push('`name` chứa `:` ⇒ file bị bỏ qua');
      if (ten.length > 256) loi.push(`\`name\` dài ${ten.length} ký tự (> 256) ⇒ file bị bỏ qua`);
      /* Tên phải khớp chỗ harness tra: agent theo TÊN FILE, skill theo TÊN THƯ MỤC. */
      const mong = /\/SKILL\.md$/.test(rel) ? path.basename(path.dirname(p)) : path.basename(p, '.md');
      if (ten !== mong) loi.push(`\`name: ${ten}\` KHÁC chỗ harness tra (\`${mong}\`) — gọi theo tên nào cũng có đường trượt`);
    }
  }
  return { rel, loi };
}

function main() {
  const files = [];
  const goc0 = DIR ? path.resolve(DIR) : REPO;
  for (const g of GOC) files.push(...timFile(path.join(goc0, g)));
  if (!files.length) {
    console.error('[frontmatter] KHÔNG PHÁN ĐƯỢC: không thấy file .md nào trong ' + GOC.join(', '));
    console.error('  "không có gì để gác" KHÔNG đồng nghĩa với "đạt".');
    return 2;
  }

  const xau = [];
  let soCoFm = 0;
  for (const p of files) {
    const r = kiemMotFile(p);
    if (fs.readFileSync(p, 'utf8').replace(/\r/g, '').startsWith('---\n')) soCoFm += 1;
    if (r.loi.length) xau.push(r);
  }

  console.log(`[frontmatter] ${files.length} file .md · ${soCoFm} file có frontmatter · ${xau.length} file có vấn đề`);
  if (!xau.length) {
    console.log('[frontmatter] ✓ ĐẠT — không file định nghĩa nào vỡ theo các kiểu tài liệu đã nêu.');
    console.log('[frontmatter] Giới hạn: cửa này KHÔNG parse YAML. Vỡ theo kiểu khác (thụt lề, list, neo/alias)');
    console.log('[frontmatter] thì nó không thấy — nó gác đúng lớp lỗi đã xảy ra, cộng vài lớp cùng họ.');
    return 0;
  }
  for (const r of xau) {
    console.log(`\n  ✗ ${r.rel}`);
    for (const l of r.loi) console.log(`      ${l}`);
  }
  console.log('\n[frontmatter] ✗ CHẶN — một file định nghĩa vỡ frontmatter thì harness BỎ QUA nó IM LẶNG:');
  console.log('              không log, không cảnh báo, chỉ là agent/skill đó không bao giờ xuất hiện.');
  return 1;
}

module.exports = { kiemMotFile, layFrontmatter };
if (require.main === module) process.exit(main());
