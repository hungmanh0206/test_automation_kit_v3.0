#!/usr/bin/env node
'use strict';
/*
 * cleanup_check — QUÉT FILE DUMP LỌT Ở ROOT REPO (§Cleanup Rules của RULE_GLOBAL).
 *
 * VÌ SAO CÓ FILE NÀY, và nó được tìm ra bằng cách nào. `rule:coverage` (v2.7.0 §A10.7) dựng bản đồ
 * luật → gate → spec, và §Cleanup Rules là mục DUY NHẤT thuộc loại `do_duoc_ma_chua_co_may`: luật liệt
 * kê hẳn một bảng pattern, nói rõ chuyện ĐÃ XẢY RA — nhiều file `scratch_*` dump API và swagger sót ở
 * root repo sau một task, chưa gitignore — mà `grep -rl 'scratch_|_debug.txt' scripts/` ra 0 máy nào.
 *
 * Ghi mục đó là "không đo được bằng máy" sẽ là KHAI SAI: quét root theo một bảng pattern là phép đo hiển
 * nhiên. Nên bản đồ cần nhãn thứ tư, và nhãn đó dẫn tới đúng một việc — viết cái máy này.
 *
 * `secret:scan` KHÔNG thay được: nó tìm secret trong NỘI DUNG file. Một dump swagger không chứa secret
 * nào vẫn là rác lọt lưới, và nó thường chứa email/SĐT trong giá trị mẫu — một lần `git add .` là commit
 * lộ PII khách (non-negotiable §1).
 *
 * PHẠM VI, cố ý hẹp: root repo và subfolder CẤP 1, đúng như luật viết. Không quét sâu, vì
 * `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/**` là deliverable và `node_modules/` là nhiễu.
 *
 * Dùng:
 *   node scripts/qa/cleanup_check.js [--enforce] [--json]
 *
 * Exit: 0 · 1 khi `--enforce` và còn file dump · 2 khi phép đo hỏng (không đọc được thư mục)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const ENFORCE = process.argv.includes('--enforce');
const JSON_OUT = process.argv.includes('--json');

/*
 * BẢNG PATTERN — chép từ `RULE_GLOBAL.md §Cleanup Rules`, giữ nguyên thứ tự để so được bằng mắt.
 *
 * Không đọc trực tiếp từ Markdown: một bộ quét phụ thuộc vào cách người ta kẻ bảng sẽ chết lặng lẽ lúc
 * ai đó đổi dấu gạch. Đổi lại thì bảng này có thể trôi khỏi luật, nên `cleanup-check.spec.ts` có một test
 * so hai bên.
 */
const PATTERN = [
  { re: /_debug\.txt$/i, y: 'debug dump tạm' },
  { re: /^debug_output\.txt$/i, y: 'output dump tạm' },
  { re: /_output\.txt$/i, y: 'output dump tạm' },
  { re: /\.(tmp|temp)$/i, y: 'file tạm' },
  { re: /^page_snapshot\.md$/i, y: 'browser snapshot tạm' },
  { re: /^snapshot_.*\.md$/i, y: 'browser snapshot tạm' },
  { re: /^dom_dump\.txt$/i, y: 'DOM dump tạm' },
  { re: /^html_dump\.html$/i, y: 'DOM dump tạm' },
  { re: /^network_requests\.txt$/i, y: 'network log tạm' },
  { re: /^console_log\.txt$/i, y: 'console log tạm' },
  { re: /^scratch_/i, y: 'script nháp hoặc dump ad-hoc (swagger/API response/id tạm)' },
];

/*
 * THƯ MỤC KHÔNG QUÉT — cũng chép từ bảng "Không xóa" của luật, cộng hai thứ hiển nhiên.
 *
 * `outputs/` nằm đây vì nó là deliverable của task: một file `scratch_*` trong
 * `outputs/<DA>/tasks/<TASK>/` là artifact của task đó, không phải rác ở root.
 */
const BO_QUA_DIR = new Set([
  'node_modules', '.git', 'target', 'build', 'dist', 'logs', 'artifacts',
  'outputs', 'knowledge', 'profiles', 'test-results', '.playwright', 'coverage',
]);

/** File không bao giờ tính là rác, kể cả khi tên khớp pattern. */
const BO_QUA_FILE = new Set(['package.json', '.gitignore']);
const BO_QUA_RE = [/\.config\.(ts|js|mjs|cjs)$/i];

function quetMotTang(duong, sauRoot) {
  const ra = [];
  let muc;
  try { muc = fs.readdirSync(duong, { withFileTypes: true }); } catch (e) { return ra; }
  for (const m of muc) {
    if (m.isDirectory()) {
      if (sauRoot) continue;                       /* chỉ xuống CẤP 1, đúng như luật viết */
      if (BO_QUA_DIR.has(m.name) || m.name.startsWith('.')) continue;
      ra.push(...quetMotTang(path.join(duong, m.name), true));
      continue;
    }
    if (!m.isFile()) continue;
    if (BO_QUA_FILE.has(m.name)) continue;
    if (BO_QUA_RE.some((r) => r.test(m.name))) continue;
    const p = PATTERN.find((x) => x.re.test(m.name));
    if (p) ra.push({ duong: path.relative(REPO, path.join(duong, m.name)).replace(/\\/g, '/'), y: p.y });
  }
  return ra;
}

function dungDo() {
  if (!fs.existsSync(REPO)) {
    console.error('[cleanup] ✗ không đọc được thư mục repo — phép đo hỏng, không phải "sạch".');
    process.exit(2);
  }
  const rac = quetMotTang(REPO, false);
  /* MẪU SỐ: đếm file đã xét, để một lượt quét 0 file không bị đọc thành "sạch". */
  let daXet = 0;
  const demTang = (d, sau) => {
    let muc;
    try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const m of muc) {
      if (m.isDirectory()) {
        if (sau || BO_QUA_DIR.has(m.name) || m.name.startsWith('.')) continue;
        demTang(path.join(d, m.name), true);
      } else if (m.isFile()) daXet += 1;
    }
  };
  demTang(REPO, false);
  return { rac, da_xet: daXet };
}

function main() {
  const { rac, da_xet: daXet } = dungDo();
  if (JSON_OUT) {
    console.log(JSON.stringify({ rac, da_xet: daXet }, null, 2));
    process.exit(ENFORCE && rac.length ? 1 : 0);
  }

  if (!daXet) {
    console.error('[cleanup] ✗ CHƯA KIỂM — xét 0 file. Sai cwd, hay repo trống? Đây không phải "sạch".');
    process.exit(2);
  }

  if (!rac.length) {
    console.log(`[cleanup] ✓ 0 file dump ở root và subfolder cấp 1 (đã xét ${daXet} file).`);
    return;
  }

  console.error(`[cleanup] ✗ ${rac.length} file dump còn ở root hoặc subfolder cấp 1 (đã xét ${daXet} file):`);
  for (const x of rac) console.error(`  ${x.duong}  — ${x.y}`);
  console.error('');
  console.error('  Các dump này thường chứa email/SĐT trong giá trị mẫu, nên một lần `git add .` là commit');
  console.error('  lộ PII khách (non-negotiable §1). Chuyển vào thư mục scratchpad của session; artifact');
  console.error('  cần giữ thì vào `<TASK_OUTPUT_DIR>/`.');
  process.exit(ENFORCE ? 1 : 0);
}

if (require.main === module) main();

module.exports = { PATTERN, BO_QUA_DIR, dungDo, quetMotTang };
