#!/usr/bin/env node
'use strict';

/*
 * quickstart_numbers.js — SINH bảng số đo trong `QUICKSTART.md` thay vì giữ nó bằng tay.
 *
 * Dùng: node scripts/qa/quickstart_numbers.js [--write | --check]
 *   exit 0 = khớp (hoặc đã ghi) · 1 = lệch (chỉ với `--check`) · 2 = KHÔNG PHÁN ĐƯỢC
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * VÌ SAO CÓ MÁY NÀY — ba lượt đỏ trong MỘT đợt phát hành
 *
 * Bảng đó là số DẪN XUẤT: số file `git ls-files` và số spec `ci:scope` đếm. Nhưng nó được giữ bằng
 * TAY, nên mỗi lần thêm file là một lượt `full:suite` đỏ. Đo trong đợt v2.10.x: 919→920 (thêm
 * `docs/rationale/start-pham-vi.md`) · 920→928 (fixture + đáp án + báo cáo v2.10.1) · 928→929 (báo cáo
 * v2.10.2). Ba lần, cùng một lớp lỗi, và lần nào cũng phát hiện ở bước cuối — sau 10 phút chạy cả bộ.
 *
 * `GATES.md`, `docs/RULE_COVERAGE.md` và trang thư viện đều đã có máy sinh. Bảng này là chỗ cuối cùng
 * còn chép tay, nên nó là chỗ duy nhất còn trôi được.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * MỘT NGUỒN, KHÔNG KHAI LẠI
 *
 * Số file lấy từ `git ls-files`; số spec lấy từ STDOUT của `ci_scope_check.js` — đúng hai nguồn mà
 * `release-pipeline.spec.ts` dùng để chấm. Nếu máy này tự đếm spec theo cách riêng thì hai bên sẽ lệch
 * nhau vào một ngày nào đó, và cả hai đều tự tin.
 *
 * KHÔNG CHẠY ĐƯỢC THÌ THOÁT 2, KHÔNG ghi và KHÔNG kết luận "khớp": thiếu `.git` (bản phát hành đã giải
 * nén) hoặc thiếu `gitlab_strip.json` (lớp PROJECT, gói không mang) đều là "chưa đo được", không phải
 * "đạt". Đây đúng chỗ `release-pipeline.spec.ts` từng đỏ oan trong gói.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const QS = path.join(REPO, 'QUICKSTART.md');
const STRIP = path.join(REPO, '.agent/config/gitlab_strip.json');

const GHI = process.argv.includes('--write');
const KIEM = process.argv.includes('--check');

/** Env cho tiến trình con: gỡ biến task-scoped, cùng lý lẽ với `_gate_env.ts`. */
function sachEnv() {
  const e = { ...process.env };
  for (const k of ['TASK_KEY', 'RUN_ID', 'PROJECT_OUTPUT_DIR', 'TASK_ENV']) delete e[k];
  return e;
}

function thoat2(msg) {
  console.log(`[quickstart] KHÔNG PHÁN ĐƯỢC — ${msg}`);
  console.log('             Đây KHÔNG đồng nghĩa với "khớp".');
  process.exit(2);
}

if (!fs.existsSync(QS)) thoat2('không có QUICKSTART.md');
if (!fs.existsSync(STRIP)) thoat2('không có .agent/config/gitlab_strip.json (lớp PROJECT) — không có mốc để so');

const ls = spawnSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', env: sachEnv() });
if (ls.status !== 0) thoat2('không chạy được `git ls-files` (bản phát hành đã giải nén thì không có .git)');
const soFile = String(ls.stdout).split(/\r?\n/).filter((x) => x.trim()).length;
if (soFile < 100) thoat2(`chỉ đếm được ${soFile} file track — con số đó không mô tả cây này`);

const sc = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/ci_scope_check.js')], { cwd: REPO, encoding: 'utf8', env: sachEnv() });
const m = String(sc.stdout).match(/(\d+) spec được track/);
if (!m) thoat2('không đọc được số spec từ `ci:scope` — hợp đồng stdout của nó đã đổi');
const soSpec = Number(m[1]);

const strip = JSON.parse(fs.readFileSync(STRIP, 'utf8')).strip || [];
const nStrip = strip.length;
const nSpecStrip = strip.filter((x) => String(x.path || '').endsWith('.spec.ts')).length;

const HANG = [
  { nhan: 'file được track', gh: soFile, gl: soFile - nStrip },
  { nhan: '`npm run ci:scope` đếm', gh: soSpec, gl: soSpec - nSpecStrip },
];

const src = fs.readFileSync(QS, 'utf8');
const crlf = /\r\n/.test(src);
let s = src.replace(/\r\n/g, '\n');

const lech = [];
for (const h of HANG) {
  const re = new RegExp(`^\\| ${h.nhan.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\|[^|]*\\|[^|]*\\|$`, 'm');
  const dong = s.match(re);
  if (!dong) thoat2(`QUICKSTART.md không còn dòng "${h.nhan}" — bảng đổi hình thì máy này mù`);
  const so = dong[0].split('|').slice(2, 4).map((c) => Number(c.replace(/[^0-9]/g, '')));
  const moi = `| ${h.nhan} | ${h.gh} | ${h.gl} |`;
  if (so[0] !== h.gh || so[1] !== h.gl) lech.push(`${h.nhan}: trang ghi ${so.join(' / ')}, cây thật ${h.gh} / ${h.gl}`);
  s = s.replace(re, moi);
}

if (GHI) {
  fs.writeFileSync(QS, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log(`[quickstart] đã ghi QUICKSTART.md — ${soFile} file track · ${soSpec} spec`
    + (nStrip ? ` · cột GitLab trừ ${nStrip} mục strip (${nSpecStrip} spec)` : ' · gitlab_strip rỗng nên hai cột bằng nhau'));
  process.exit(0);
}

console.log(`[quickstart] cây thật: ${soFile} file track · ${soSpec} spec · strip ${nStrip} mục (${nSpecStrip} spec)`);
if (!lech.length) {
  console.log('[quickstart] ✓ ĐẠT — bảng số đo khớp cây thật.');
  process.exit(0);
}
console.log('\n[quickstart] ✗ LỆCH:');
lech.forEach((x) => console.log(`  - ${x}`));
console.log('\n  Chạy `npm run quickstart:numbers` rồi commit. Đừng sửa tay — nó đã trôi ba lần trong một đợt.');
process.exit(KIEM ? 1 : 0);
