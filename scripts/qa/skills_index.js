#!/usr/bin/env node
'use strict';

/*
 * skills_index — sinh bảng tra skill từ frontmatter của `.agent/skills/**\/SKILL.md`.
 *
 * VÌ SAO CẦN: skill của kit KHÔNG nằm ở `.claude/skills/` (đường dẫn harness tự phát hiện) và cũng không
 * được hook nào bơm vào. Prompt/workflow chỉ nhắc TÊN skill trong backtick, nên muốn dùng được thì agent phải
 * tự đoán ra file nằm ở `.agent/skills/<phase>/<tên>/SKILL.md` rồi tự mở. Thiếu một mắt xích là skill bị bỏ
 * qua ÂM THẦM — không lỗi, không cảnh báo, chỉ là nội dung không bao giờ được đọc. (Đã đo: 21/21 skill được
 * prompt nhắc tên, 0 skill được nạp tự động.)
 *
 * Script này chỉ làm một việc: đọc frontmatter → bảng `tên · đường dẫn · description`. Cố ý giữ dạng dữ liệu
 * trung lập (markdown + JSON, đường dẫn `.agent/`), KHÔNG phụ thuộc hãng nào:
 *   · Claude Code : SessionStart hook bơm bảng này vào context (scripts/qa/hooks/inject_context.js)
 *   · agent khác  : trỏ file always-read của hãng đó vào `.agent/skills/INDEX.md`
 *
 * Dùng: node scripts/qa/skills_index.js [--write] [--json]
 *   (mặc định in ra stdout; --write ghi .agent/skills/INDEX.md)
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

/*
 * `--root <cây>` để `--write` có chỗ chạy KHÁC cây dùng chung.
 *
 * VÌ SAO BẮT BUỘC, đo 06/11/2026: ca đối chứng của `skills-shim.spec.ts` gọi `--write` lên CHÍNH repo,
 * nên mỗi lượt `full:suite` tự ghi lại 29 file ĐÃ TRACK. Trên Windows (`core.autocrlf`) bản ghi ra là LF
 * trong khi bản checkout là CRLF, nên cây thành "đã đổi" dù nội dung y nguyên — và `full_suite_ledger`
 * từ chối phán vì "cây ĐỔI trong lúc suite chạy". Tức cả bộ KHÔNG chạy được ở máy, và đó đúng là lỗ đã
 * để 11 ca đỏ lọt tới runner.
 *
 * Cây `--root` KHÔNG tồn tại thì THOÁT 2, không bao giờ rơi về cây thật: một cờ gõ sai mà im lặng chạy
 * trên repo là đúng cái lỗi này.
 */
const iRoot = process.argv.indexOf('--root');
const GOC = iRoot > -1 ? process.argv[iRoot + 1] : null;
if (iRoot > -1 && (!GOC || !fs.existsSync(GOC))) {
  console.error(`[skills-index] ✗ --root trỏ tới cây KHÔNG tồn tại: ${GOC || '(trống)'}`);
  process.exit(2);
}
const REPO = GOC ? path.resolve(GOC) : rc.REPO_ROOT;

const ROOT = path.join(REPO, '.agent', 'skills');
const OUT = path.join(ROOT, 'INDEX.md');

/** Đọc frontmatter tối giản (chỉ cần name + description, mỗi cái 1 dòng). */
function frontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out.name ? out : null;
}

function collect() {
  const rows = [];
  const walk = (dir) => {
    for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'SKILL.md') continue;
      const fm = frontmatter(p);
      const rel = path.relative(rc.REPO_ROOT, p).replace(/\\/g, '/');
      // KHOÁ theo TÊN THƯ MỤC, không theo frontmatter `name`: prompt/workflow nhắc skill bằng tên thư mục
      // (vd `git_impact_analyzer`). Index khoá nhầm khoá thì tra là trượt — đúng kiểu hỏng âm thầm mà index
      // này sinh ra để chống. Lịch sử: 5/21 skill từng ghi frontmatter kiểu gạch-ngang; cảnh báo ở đây chỉ
      // nhắc chứ không chặn nên tồn đọng lâu ⇒ 12/08/2026 đã dọn hết và chốt bằng gate trong
      // `policy_source_check.js` (lệch tên = exit 1). Cảnh báo dưới đây giữ lại để báo sớm ngay khi sinh index.
      const dirName = path.basename(path.dirname(p));
      if (!fm) { rows.push({ name: dirName, file: rel, description: '(THIẾU frontmatter name/description)', group: rel.split('/')[2] || '', broken: true }); continue; }
      rows.push({
        name: dirName,
        aliasInFile: fm.name && fm.name !== dirName ? fm.name : null,
        file: rel,
        description: fm.description || '(thiếu description)',
        group: rel.split('/')[2] || '',
        broken: !fm.description,
      });
    }
  };
  walk(ROOT);
  return rows.sort((a, b) => `${a.group}${a.name}`.localeCompare(`${b.group}${b.name}`));
}

const rows = collect();

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  process.exit(0);
}

const L = [
  '# Skills Index (SINH TỰ ĐỘNG — đừng sửa tay)',
  '',
  '> Sinh bởi `node scripts/qa/skills_index.js --write`. Skill của kit nằm ở `.agent/skills/**` — KHÔNG phải',
  '> `.claude/skills/`, nên harness không tự phát hiện. Bảng này là cách agent biết skill nào có và nằm ở đâu.',
  '',
  '| Skill | Nhóm | File | Dùng khi |',
  '|---|---|---|---|',
];
for (const r of rows) L.push(`| \`${r.name}\` | ${r.group || '-'} | \`${r.file}\` | ${String(r.description).replace(/\|/g, '\\|')} |`);
const alias = rows.filter((r) => r.aliasInFile);
L.push('', `> ${rows.length} skill. Thiếu description: ${rows.filter((r) => r.broken).length}.`);
if (alias.length) {
  L.push('', `> ⚠ ${alias.length} skill có frontmatter \`name\` LỆCH tên thư mục. Tra cứu dùng tên thư mục (đó là tên prompt/workflow nhắc); nên sửa frontmatter cho khớp: ${alias.map((a) => `\`${a.name}\` (file ghi \`${a.aliasInFile}\`)`).join(' · ')}`);
}
const md = `${L.join('\n')}\n`;

/*
 * SHIM `.claude/skills/<tên>/SKILL.md` (v2.9.6 N1) — để harness TỰ NẠP skill.
 *
 * VẤN ĐỀ: skill của kit nằm ở `.agent/skills/**`, mà harness chỉ dò `.claude/skills/`. Hệ quả: 28 skill
 * không bao giờ tự xuất hiện, và kit phải bơm danh sách TÊN qua hook SessionStart — tốn **232 token mỗi
 * phiên** (đo 30/10/2026) mà vẫn chỉ cho agent cái tên, không cho mô tả.
 *
 * SHIM LÀ CON TRỎ, KHÔNG PHẢI BẢN SAO. Thân ≤ 5 dòng, chỉ trỏ về bản gốc. Chép cả nội dung sang đây là
 * dựng nguồn thứ hai, và kit đã trả giá đúng chuyện đó ở hai bản lint SQL.
 *
 * VÌ SAO `--check` PHẢI CHẶN CẢ "THỪA": xoá một skill gốc mà quên xoá shim thì harness vẫn liệt kê nó,
 * agent mở ra và gặp con trỏ chết. Thiếu/lệch/thừa đều chặn.
 */
const CLAUDE_SKILLS = path.join(REPO, '.claude', 'skills');

function thanShim(r) {
  return [
    '---',
    `name: ${r.name}`,
    `description: ${r.description}`,
    '---',
    '',
    '<!-- SINH TỰ ĐỘNG bởi `node scripts/qa/skills_index.js --write` — ĐỪNG SỬA TAY. -->',
    '',
    `**Bản đầy đủ: [\`${r.file}\`](../../../${r.file}) — đọc file đó trước khi làm.**`,
    '',
    'File này chỉ là con trỏ để harness thấy skill. Mọi luật, bảng và số đo nằm ở bản gốc.',
    '',
  ].join('\n');
}

/** `{ <tên>: <nội dung mong đợi> }` cho đủ skill. */
function shimMongDoi() {
  const ra = new Map();
  for (const r of rows) ra.set(r.name, thanShim(r));
  return ra;
}

/** Shim đang có trên đĩa. */
function shimTrenDia() {
  const ra = new Map();
  if (!fs.existsSync(CLAUDE_SKILLS)) return ra;
  for (const e of fs.readdirSync(CLAUDE_SKILLS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(CLAUDE_SKILLS, e.name, 'SKILL.md');
    if (fs.existsSync(f)) ra.set(e.name, fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  }
  return ra;
}

/** So hai bên, trả `{ thieu, lech, thua }`. */
function soShim() {
  const mong = shimMongDoi();
  const co = shimTrenDia();
  const thieu = [...mong.keys()].filter((k) => !co.has(k));
  const thua = [...co.keys()].filter((k) => !mong.has(k));
  const lech = [...mong.entries()].filter(([k, v]) => co.has(k) && co.get(k).trim() !== v.trim()).map(([k]) => k);
  return { thieu, lech, thua, soCo: co.size, soMong: mong.size };
}

/*
 * `--check` — CHẶN khi INDEX.md trôi khỏi nguồn (`SKILL.md`).
 *
 * VÌ SAO THÊM (đo 07/09/2026): `policy_source_check` chỉ khoá TÊN skill, KHÔNG so description. Hậu quả
 * thật đang tồn tại trên `main`: INDEX.md ghi `tc_validator` là "template 11 cột" trong khi
 * `.agent/skills/phase1/tc_validator/SKILL.md` vẫn ghi "9 cột" — artifact SINH đã lên trước NGUỒN của
 * nó và KHÔNG gate nào thấy. Đúng lớp lỗ hổng lặp lại của kit: có quy định, thiếu máy.
 *
 * So CHẶT cả file, cùng khuôn `gates:index:check`. Giá phải trả: sửa `SKILL.md` thì phải chạy lại
 * `npm run skills:index` rồi commit CẢ HAI — và đó chính là hành vi muốn ép.
 */
if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT)) {
    console.error('[skills] CHẶN: thiếu .agent/skills/INDEX.md — chạy `npm run skills:index`.');
    process.exit(1);
  }
  const cur = fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  if (cur.trim() !== md.trim()) {
    /* Chỉ ra ĐÚNG skill nào lệch, không bắt người đọc tự diff 22 dòng bảng. */
    const rowOf = (txt, name) => (txt.split('\n').find((l) => l.startsWith(`| \`${name}\``)) || '(không có dòng nào)').trim();
    const drift = rows.filter((r) => rowOf(cur, r.name) !== rowOf(md, r.name)).map((r) => r.name);
    const inIndexOnly = cur.split('\n')
      .map((l) => (l.match(/^\| `([^`]+)`/) || [])[1])
      .filter((n) => n && !rows.some((r) => r.name === n));
    console.error('[skills] CHẶN: .agent/skills/INDEX.md LỆCH nguồn `SKILL.md`.');
    if (drift.length) console.error(`  Skill có description/đường dẫn khác nguồn: ${drift.join(' · ')}`);
    if (inIndexOnly.length) console.error(`  Có trong INDEX mà không còn thư mục skill: ${inIndexOnly.join(' · ')}`);
    if (!drift.length && !inIndexOnly.length) console.error('  Khác ở phần đầu/chân bảng (số skill, cảnh báo alias).');
    console.error('  Chạy `npm run skills:index` rồi commit CẢ `SKILL.md` lẫn `INDEX.md`.');
    process.exit(1);
  }
  const s = soShim();
  if (s.thieu.length || s.lech.length || s.thua.length) {
    console.error('[skills] CHẶN: shim `.claude/skills/` LỆCH nguồn.');
    if (s.thieu.length) console.error(`  THIẾU shim (${s.thieu.length}): ${s.thieu.join(' · ')}`);
    if (s.lech.length) console.error(`  SỬA TAY / lệch mô tả (${s.lech.length}): ${s.lech.join(' · ')}`);
    if (s.thua.length) console.error(`  THỪA — skill gốc không còn (${s.thua.length}): ${s.thua.join(' · ')}`);
    console.error('  Shim là con trỏ để harness thấy skill. Thiếu thì skill không tự nạp; thừa thì agent');
    console.error('  mở ra gặp con trỏ chết. Chạy `npm run skills:index` rồi commit.');
    process.exit(1);
  }
  console.log(`[skills] OK — INDEX.md khớp ${rows.length} skill · ${s.soCo} shim khớp nguồn.`);
  process.exit(0);
}

if (process.argv.includes('--write')) {
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`[skills] ${rows.length} skill → ${path.relative(rc.REPO_ROOT, OUT).replace(/\\/g, '/')}`);

  /* Shim: ghi đủ, và XOÁ shim của skill không còn — thừa cũng là một kiểu lệch. */
  fs.mkdirSync(CLAUDE_SKILLS, { recursive: true });
  const mong = shimMongDoi();
  for (const [ten, noi] of mong) {
    const d = path.join(CLAUDE_SKILLS, ten);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), noi, 'utf8');
  }
  const thua = [...shimTrenDia().keys()].filter((k) => !mong.has(k));
  for (const t of thua) fs.rmSync(path.join(CLAUDE_SKILLS, t), { recursive: true, force: true });
  console.log(`[skills] ${mong.size} shim → .claude/skills/<tên>/SKILL.md${thua.length ? ` · đã xoá ${thua.length} shim thừa: ${thua.join(' · ')}` : ''}`);
  const broken = rows.filter((r) => r.broken);
  if (broken.length) console.log(`[skills] ⚠ ${broken.length} skill thiếu name/description trong frontmatter: ${broken.map((b) => b.name).join(', ')} — agent sẽ không biết khi nào nên dùng.`);
} else {
  process.stdout.write(md);
}
