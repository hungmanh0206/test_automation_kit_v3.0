#!/usr/bin/env node
/**
 * phase1_tables.js — ba bảng đối soát cuối bộ, MÁY SINH chứ không để agent tự kẻ.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO MÁY SINH. `qig-qa-automation` bắt agent tự kẻ ba bảng đối soát ở cuối bộ TC. Bảng tự kẻ có hai
 * đường hỏng, và cả hai đều im lặng: agent kẻ sai số, hoặc agent kẻ đúng rồi bộ TC đổi mà bảng ở lại.
 * Bảng sinh từ chính bộ TC thì không có đường nào trong hai đường đó.
 *
 * ĐO TRƯỚC KHI DỰNG (28/10/2026) — và một bảng ĐÃ CÓ, nên không dựng lại:
 *   · bảng ③ **phân bố kỹ thuật** đã có đủ ở `dimension_coverage.js`: EP…CT × số case × điều kiện kích
 *     hoạt. Script này GỌI LẠI nó, không chép logic. Hai bộ đếm cho cùng một thứ là hai bộ sẽ trôi khỏi
 *     nhau;
 *   · bảng ① **đối soát coverage** có một nửa ở `domain_rules.js --trace-back` (rule ↔ TC, bắt ghost-ref),
 *     nhưng KHÔNG chia dương/âm/biên và KHÔNG chặn khi một rule được trỏ mà chỉ có case dương;
 *   · bảng ② **đối soát quan sát** chưa có máy nào.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * CHẶN khi:
 *   ① một rule được bộ TC trỏ tới mà CHỈ có case dương — không có case âm lẫn case biên. Một rule chỉ
 *      được chứng minh bằng đường đi được thì chưa được chứng minh: chỗ bug sống là đường phải chặn.
 *   ② một case mang chiều `[Display]` khẳng định nhãn/thứ tự/mặc định/định dạng mà KHÔNG có chống lưng
 *      (trỏ `ui_catalog`, hoặc nêu một lần đọc DOM có số liệu). Khẳng định hiển thị không có neo là lấy
 *      app làm oracle.
 *
 * GIỚI HẠN: máy đọc TAG và CHỮ trong ô, không hiểu nghĩa. Case khai `[Negative]` mà nội dung là case
 * dương thì nó vẫn đếm là âm. Phần đúng/sai là việc người review.
 *
 * Exit: 0 đạt · 1 có vi phạm (chỉ với `--enforce`) · 2 không phán được (không đọc được bộ TC).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));

const flag = (n) => process.argv.includes(`--${n}`);
const ENFORCE = flag('enforce');
const CHECK = flag('check');

const taskDir = rc.getTaskOutputDir({});

/* ── Đọc bộ TC canonical: cùng hàm mà trace-back / dim:coverage đang dùng ───────────────────────── */
const tests = (() => {
  const out = [];
  let dirs = [];
  try { dirs = rc.getTestcaseDirs(taskDir); } catch { return out; }
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.md')) continue;
      /*
       * `parseMarkdown` trả `{source, tests:[…]}`, KHÔNG trả mảng. Bản đầu tôi viết `push(...parse(...))`
       * — spread một object ra mảng rỗng, nên script báo "không đọc được testcase nào" dù file nằm ngay
       * đó. Lỗi im lặng: không ném, chỉ ra 0 case, và thông báo "không phán được" trông rất hợp lý.
       */
      try { out.push(...(canonical.parseMarkdown(fs.readFileSync(path.join(d, f), 'utf8')).tests || [])); } catch { /* file hỏng: gate khác đã gác */ }
    }
  }
  return out;
})();

if (!tests.length) {
  console.error('[phase1-tables] KHÔNG PHÁN ĐƯỢC: không đọc được testcase canonical nào.');
  console.error('  Chưa có bộ TC thì không có gì để đối soát — và "không có gì để đối soát" KHÔNG phải "đạt".');
  process.exit(2);
}

/*
 * Dùng `oracleRefs` / `dimensions` mà bộ parse ĐÃ bóc sẵn, không tự regex lại trên chuỗi tag. Tự bóc
 * lần hai là tạo định nghĩa thứ hai cho cùng một thứ, rồi hai bên trôi khỏi nhau — đúng lớp lỗi mà
 * `techniquesOf()` đã phải sửa khi `[ST]` khớp nhầm chuỗi con của "bughistory".
 */
const tagsOf = (tc) => String(tc.tags || '');
const laDuong = (tc) => /\[Positive\]/i.test(tagsOf(tc));
const laAm = (tc) => /\[Negative\]/i.test(tagsOf(tc));
const laBien = (tc) => /\[(Boundary|Edge)\]/i.test(tagsOf(tc));
const laDisplay = (tc) => (tc.dimensions || []).some((d) => /display/i.test(String(d)));
const refsOf = (tc) => (tc.oracleRefs || []).map(String);
const chuTrongO = (tc) => [
  (tc.expected || []).map((x) => x.text).join(' '),
  (tc.steps || []).map((x) => x.text).join(' '),
  String(tc.precondition || ''),
  String(tc.data || ''),
].join(' ');

/* ── Bảng ① — rule × số TC × dương/âm/biên ─────────────────────────────────────────────────────── */
const theoRule = new Map();
for (const tc of tests) {
  for (const ref of refsOf(tc)) {
    if (!theoRule.has(ref)) theoRule.set(ref, { tc: [], duong: 0, am: 0, bien: 0 });
    const o = theoRule.get(ref);
    o.tc.push(tc.tcId || '?');
    if (laDuong(tc)) o.duong += 1;
    if (laAm(tc)) o.am += 1;
    if (laBien(tc)) o.bien += 1;
  }
}
/*
 * BA TRẠNG THÁI, không phải hai — sửa 28/10/2026 ngay trong lượt dựng.
 *
 * Bản đầu chỉ có `chiDuong`, và chú thích trong bảng lại dùng một điều kiện KHÁC (`am===0 && bien===0`,
 * bỏ qua `duong`). Hậu quả đo được ngay trên ba ví dụ: `BR-EMISDN-002` ra 0/0/0 nhưng bảng ghi "⛔ chỉ có
 * case dương" — một nhãn SAI. Hai điều kiện cho cùng một kết luận thì sớm muộn chúng nói ngược nhau.
 *
 * Và 0/0/0 là một lỗ RIÊNG, nặng hơn: case không khai dương/âm/biên thì không ai biết rule đó được
 * chứng minh bằng đường nào.
 */
const trangThai = (o) => {
  if (o.duong + o.am + o.bien === 0) return { ma: 'chua-phan-loai', nhan: '⛔ case không khai dương/âm/biên' };
  if (o.duong > 0 && o.am === 0 && o.bien === 0) return { ma: 'chi-duong', nhan: '⛔ chỉ có case dương' };
  return { ma: 'ok', nhan: '' };
};
const loi = [...theoRule.entries()].filter(([, o]) => trangThai(o).ma !== 'ok');

/* ── Bảng ② — case chiều Display × chống lưng ──────────────────────────────────────────────────── */
const RE_KHANG_DINH = /nhãn|thứ tự|mặc định|định dạng|hiển thị đúng|placeholder|tiêu đề cột/i;
const RE_CHONG_LUNG = /ui_catalog|expectedFields|expectedColumns|đọc DOM|catalog/i;
const dis = tests.filter(laDisplay);
const disThieuNeo = dis.filter((tc) => {
  const than = chuTrongO(tc);
  return RE_KHANG_DINH.test(than) && !RE_CHONG_LUNG.test(than) && refsOf(tc).length === 0;
});

/* ── Bảng ③ — GỌI LẠI dim:coverage, không chép logic ───────────────────────────────────────────── */
const dimOut = (() => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'dimension_coverage.js')], { cwd: rc.REPO_ROOT, encoding: 'utf8', env: process.env });
  const d = `${r.stdout || ''}`.split(/\r?\n/).filter((l) => /^\[dim\]\s{2,}[A-Z]{2}\s/.test(l));
  return d;
})();

/* ── Dựng khối Markdown ────────────────────────────────────────────────────────────────────────── */
const MOC_DAU = '<!-- phase1:tables BẮT ĐẦU — KHỐI SINH TỰ ĐỘNG, đừng sửa tay -->';
const MOC_CUOI = '<!-- phase1:tables KẾT THÚC -->';

const L = [MOC_DAU, '', '## Ba bảng đối soát cuối bộ', '',
  `> Sinh bằng \`npm run phase1:tables\` từ ${tests.length} testcase canonical. Sửa tay thì`,
  '> `npm run phase1:tables -- --check` bắt được — bảng sinh mà sửa tay là bảng nói dối.', '',
  '### ① Đối soát coverage — rule × số TC × dương/âm/biên', ''];

if (!theoRule.size) {
  L.push('Không case nào mang oracle-ref. **Bộ này chưa neo được vào rule nào**, nên bảng ① không đối soát được gì.', '');
} else {
  L.push('| Rule | Số TC | Dương | Âm | Biên | |', '|---|---:|---:|---:|---:|---|');
  for (const [ref, o] of [...theoRule.entries()].sort()) {
    const co = trangThai(o).nhan;
    L.push(`| \`${ref}\` | ${o.tc.length} | ${o.duong} | ${o.am} | ${o.bien} | ${co} |`);
  }
  L.push('');
  if (loi.length) {
    L.push(`⛔ **${loi.length} rule chưa được chứng minh đủ.** Chỗ bug sống là đường phải bị chặn: rule`,
      'chỉ có case dương thì chưa chứng minh được gì, và case không khai dương/âm/biên thì không ai biết',
      'nó chứng minh bằng đường nào.', '');
  }
}

L.push('### ② Đối soát quan sát — case chiều `[Display]` có chống lưng chưa', '');
if (!dis.length) {
  L.push('Bộ này không có case `[Display]` nào. Nếu module có màn hiển thị thì đây là **vùng trắng**, không phải "không cần".', '');
} else {
  L.push(`${dis.length} case \`[Display]\`, trong đó **${disThieuNeo.length}** khẳng định nhãn/thứ tự/mặc định/định dạng mà không có chống lưng.`, '');
  if (disThieuNeo.length) {
    L.push('| TC ID | Thiếu gì |', '|---|---|');
    for (const tc of disThieuNeo.slice(0, 20)) {
      L.push(`| \`${tc.tcId || '?'}\` | khẳng định hiển thị mà không trỏ \`ui_catalog\`, không nêu lần đọc DOM, không có oracle-ref |`);
    }
    L.push('', '⛔ Khẳng định hiển thị không có neo là **lấy app làm oracle** — phép so đó luôn PASS kể cả khi app sai.', '');
  }
}

L.push('### ③ Phân bố kỹ thuật thiết kế', '',
  '> Bảng này **đã có sẵn** ở `npm run dim:coverage` — script này gọi lại chứ không đếm lần hai.', '');
if (dimOut.length) L.push('```', ...dimOut.map((x) => x.replace(/^\[dim\]\s+/, '')), '```', '');
else L.push('_(chạy `npm run dim:coverage` để xem — lượt này không đọc được output của nó)_', '');

L.push(MOC_CUOI);
const khoi = L.join('\n');

/* ── Ghi hoặc đối soát ─────────────────────────────────────────────────────────────────────────── */
const dich = path.join(taskDir, 'reports', 'phase1-summary.md');
const cu = fs.existsSync(dich) ? fs.readFileSync(dich, 'utf8') : '';
const i = cu.indexOf(MOC_DAU);
const j = cu.indexOf(MOC_CUOI);
const daCo = i >= 0 && j > i ? cu.slice(i, j + MOC_CUOI.length) : null;

if (CHECK) {
  if (daCo === null) {
    console.error(`[phase1-tables] CHẶN: ${path.relative(rc.REPO_ROOT, dich)} chưa có khối ba bảng. Chạy \`npm run phase1:tables\`.`);
    process.exit(1);
  }
  if (daCo !== khoi) {
    console.error('[phase1-tables] CHẶN: khối ba bảng LỆCH bộ TC hiện tại — bảng sinh đã bị sửa tay, hoặc bộ TC đổi mà bảng ở lại.');
    console.error('  Chạy `npm run phase1:tables` để sinh lại. Đừng sửa tay: bảng sinh mà sửa tay là bảng nói dối.');
    process.exit(1);
  }
  console.log('[phase1-tables] ✓ khối ba bảng khớp bộ TC hiện tại.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dich), { recursive: true });
fs.writeFileSync(dich, daCo === null ? `${cu}${cu && !cu.endsWith('\n') ? '\n' : ''}\n${khoi}\n` : cu.replace(daCo, khoi), 'utf8');

console.log(`[phase1-tables] ${tests.length} TC · ${theoRule.size} rule được trỏ · ${dis.length} case [Display]`);
console.log(`[phase1-tables] đã ghi ${path.relative(rc.REPO_ROOT, dich)}`);
for (const [ref, o] of loi) console.log(`[phase1-tables] ⛔ ${ref}: ${trangThai(o).nhan.replace('⛔ ', '')}`);
if (disThieuNeo.length) console.log(`[phase1-tables] ⛔ ${disThieuNeo.length} case [Display] khẳng định hiển thị mà không có chống lưng`);

const viPham = loi.length + disThieuNeo.length;
if (viPham && ENFORCE) {
  console.error('\n[phase1-tables] ✗ CHẶN (--enforce).');
  process.exit(1);
}
if (viPham) console.log('[phase1-tables] (cảnh báo — thêm --enforce để chặn)');
else console.log('[phase1-tables] ✓ ĐẠT');
process.exit(0);
