#!/usr/bin/env node
'use strict';
/*
 * ui:polish:gen — SINH SPEC THU THẬP độ chỉn chu UI cho MỘT task, từ danh sách màn của task. 0 token AI.
 *
 * Trước bản này, thu thập chỉ có ở spec riêng của TASK-9001: task khác muốn đo phải chép spec đó, chép luôn các
 * chỗ đã sửa sau lượt đo 5 cấp (màn không mở được, màn 0 thành phần, tab không chuyển) — hoặc chép thiếu.
 * Giờ logic nằm ở `scripts/utils/ui/ui_polish_thu.js`, có ca kiểm thử; spec sinh ra chỉ đăng nhập rồi gọi nó.
 *
 * Danh sách màn là dữ liệu của TASK (`requirements/ui_polish_man.json`), không nằm trong mẫu chung (CLAUDE.md §6).
 * `ui_catalog.json` không dùng được làm nguồn: đo 12/11/2026, 4/6 catalog có màn mang URL "/" hoặc rỗng.
 *
 * Spec sinh ra CHỈ ĐỌC nhưng vẫn mở màn thật sau đăng nhập ⇒ chạm UAT ⇒ cần xác nhận trước mỗi lượt (CLAUDE.md §2).
 *
 * Dùng:
 *   node scripts/qa/reuse/ui_polish_gen.js --task <KEY> [--project-output outputs/DEMO]
 *   node scripts/qa/reuse/ui_polish_gen.js --task <KEY> --init       (đặt danh sách màn MẪU nếu task chưa có)
 *   node scripts/qa/reuse/ui_polish_gen.js --man <danh-sach.json> --out <thư mục spec> [--ra <thư mục kết quả>]
 * Exit: 0 · 2 khi danh sách màn thiếu hoặc sai
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const pwConfig = require(path.join(REPO, 'scripts', 'qa', 'lib', 'pw_task_config.js'));
const { kiemDanhSach } = require(path.join(REPO, 'scripts', 'utils', 'ui', 'ui_polish_thu.js'));

const TEN_SPEC = 'ui-polish-thu.spec.ts';
const DAU_SINH = 'SINH TỰ ĐỘNG bởi `ui:polish:gen`';

const MAU = {
  _huong_dan: 'Danh sách màn để đo độ chỉn chu UI. `duong` là đường dẫn, KHÔNG có host. Xoá khoá bắt đầu bằng _ nếu muốn.',
  vung: '[id*="ContentPlaceHolder1"]',
  cap: {
    'Mầm non': { ma: 'MN', tienTo: 'MN' },
    'Tiểu học': { ma: 'TH', tienTo: 'C1' },
  },
  man: [
    { ten: 'ho-so-truong', duong: '/{CAP}/HoSoDetail.aspx', tab: true },
    { ten: 'lop', duong: '/{CAP}/Lop.aspx' },
  ],
};

/** Đường tương đối từ `tuDir` tới một file. Ném khi khác ổ đĩa — cùng lý lẽ với `smoke:gen`. */
function tuongDoi(tuDir, dich, boDuoi) {
  const tho = path.relative(tuDir, dich);
  if (!tho || path.isAbsolute(tho) || /^[A-Za-z]:/.test(tho)) throw new Error(`ui:polish:gen không dựng được đường tương đối từ ${tuDir} tới ${dich} (khác ổ đĩa?).`);
  const p = tho.replace(/\\/g, '/').replace(boDuoi ? /\.(ts|js)$/ : /$^/, '');
  return p.startsWith('.') ? p : `./${p}`;
}

function sinh({ duongDanhSach, outDir, raDir }) {
  let ds;
  try { ds = JSON.parse(fs.readFileSync(duongDanhSach, 'utf8')); } catch (e) { return { loi: [`không đọc được danh sách màn ${path.relative(REPO, duongDanhSach)}: ${e.message}`] }; }
  const k = kiemDanhSach(ds);
  if (ds.hook && !k.loi.length) {
    const goc = path.resolve(outDir, ds.hook.module);
    if (!['', '.ts', '.js'].some((d) => fs.existsSync(goc + d) && fs.statSync(goc + d).isFile())) k.loi.push(`\`hook.module\` ${ds.hook.module} không có (tính từ ${path.relative(REPO, outDir)})`);
  }
  if (k.loi.length) return k;

  const fSpec = path.join(outDir, TEN_SPEC);
  if (fs.existsSync(fSpec) && !fs.readFileSync(fSpec, 'utf8').includes(DAU_SINH)) {
    return { loi: [`${path.relative(REPO, fSpec)} đã có và KHÔNG do máy này sinh — không ghi đè việc của người khác`], canhBao: k.canhBao };
  }
  fs.mkdirSync(outDir, { recursive: true });
  const q = JSON.stringify;
  const ham = ds.hook ? (Array.isArray(ds.hook.ham) ? ds.hook.ham : [ds.hook.ham]) : [];
  const dong = [
    '/*',
    ` * ${DAU_SINH} — ĐỪNG sửa tay. Sửa danh sách màn rồi sinh lại.`,
    ` * Danh sách màn: ${path.relative(REPO, duongDanhSach).replace(/\\/g, '/')} (${ds.man.length} màn).`,
    ' *',
    ' * THU THẬP, không phải test case: không ghi testcase-status.json, không bấm Ghi, không nhập gì. Chỉ mở màn, bấm',
    ' * nhãn tab, đọc style trong vùng nội dung. Vẫn CHẠM UAT (đăng nhập, mở màn) ⇒ cần xác nhận trước (CLAUDE.md §2).',
    ' *',
    ' * Kết quả: một JSON mỗi màn + `_bo-qua.json` (màn KHÔNG đo được và lý do) trong thư mục của cấp đang chạy.',
    ' * Đọc: npm run ui:polish -- --task <KEY>',
    ' */',
    "import { test, expect } from '@playwright/test';",
    "import * as path from 'path';",
    `import { loginOps } from ${q(tuongDoi(outDir, path.join(REPO, 'tests', 'fe', 'support', 'opsLogin.ts'), true))};`,
    '',
    '/* eslint-disable @typescript-eslint/no-var-requires, global-require */',
    `const { thuTheoDanhSach, giaiCap } = require(${q(tuongDoi(outDir, path.join(REPO, 'scripts', 'utils', 'ui', 'ui_polish_thu.js'), true))});`,
    `const DS = require(${q(tuongDoi(outDir, duongDanhSach, false))});`,
    ...(ham.length ? [`const HOOK = require(${q(ds.hook.module)});`] : []),
    '/* eslint-enable @typescript-eslint/no-var-requires, global-require */',
    '',
    '/* Gốc URL lấy từ môi trường, KHÔNG ghim vào file sinh ra: ghim host vào spec là ghim một môi trường vào artifact. */',
    "const GOC = (process.env.UI_POLISH_BASE_URL || process.env.OPS_BASE_URL || '').replace(/\\/+$/, '');",
    '/* Biến mang cấp/đơn vị đang chạy là dữ liệu của dự án (context_pins.json), không ghi cứng vào spec. */',
    `const PINS = require(${q(tuongDoi(outDir, path.join(REPO, 'scripts', 'utils', 'context_pins.js'), true))});`,
    "const TEN_CAP = PINS.giaTri(PINS.docPins(), 'capHoc') || '';",
    `const RA = path.resolve(__dirname, ${q(tuongDoi(outDir, raDir, false))});`,
    '',
    "test('ui:polish · thu thập theo danh sách màn — chỉ đọc', async ({ page }) => {",
    '  test.setTimeout(120_000 + DS.man.length * 90_000);',
    '  if (!GOC) throw new Error("ui:polish: thiếu OPS_BASE_URL (hoặc UI_POLISH_BASE_URL) — KHÔNG đoán host.");',
    '  const cap = giaiCap(DS, TEN_CAP);',
    '  if (cap.loi) throw new Error(`ui:polish: ${cap.loi}`);',
    '  await loginOps(page);',
    ...ham.map((h) => `  await HOOK[${q(h)}](page);`),
    '  const r = await thuTheoDanhSach(page, { ds: DS, cap, goc: GOC, ra: path.join(RA, cap.ma) });',
    '  console.log(`[ui-polish] ${cap.ma}: đo ${r.daDo.length} màn · KHÔNG đo được ${r.boQua.length}`);',
    '  /* Không đo được màn nào thì lượt này không nói gì về UI — đỏ, không xanh. */',
    "  expect(r.daDo.length, `không đo được màn nào: ${r.boQua.map((x: any) => `${x.ten} (${x.lyDo})`).join(' · ')}`).toBeGreaterThan(0);",
    '});',
    '',
  ];
  fs.writeFileSync(fSpec, dong.join('\n'), 'utf8');
  const fCfg = pwConfig.ghiConfigTask(outDir, 'ui-polish');
  return {
    loi: [],
    canhBao: k.canhBao,
    file: path.relative(REPO, fSpec).replace(/\\/g, '/'),
    config: path.relative(REPO, fCfg).replace(/\\/g, '/'),
    soMan: ds.man.length,
  };
}

function main() {
  const a = process.argv.slice(2);
  const val = (n) => { const i = a.indexOf(`--${n}`); return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : null; };
  const po = val('project-output') || process.env.PROJECT_OUTPUT_DIR || 'outputs/DEMO';
  const task = val('task');
  const goc = task ? path.resolve(REPO, po, 'tasks', task) : null;
  const duongDanhSach = val('man') ? path.resolve(val('man')) : (goc ? path.join(goc, 'requirements', 'ui_polish_man.json') : null);
  const outDir = val('out') ? path.resolve(val('out')) : (goc ? path.join(goc, 'automation') : null);
  if (!duongDanhSach || !outDir) {
    console.error('[ui-polish-gen] CHƯA SINH ĐƯỢC — cần `--task <KEY>`, hoặc `--man <danh-sach.json> --out <thư mục>`.');
    return 2;
  }
  const raDir = val('ra') ? path.resolve(val('ra')) : (goc ? path.join(goc, 'test-results', 'ui-polish') : path.join(outDir, '..', 'test-results', 'ui-polish'));

  if (a.includes('--init')) {
    if (fs.existsSync(duongDanhSach)) { console.log(`[ui-polish-gen] ${path.relative(REPO, duongDanhSach)} đã có — không ghi đè.`); return 0; }
    fs.mkdirSync(path.dirname(duongDanhSach), { recursive: true });
    fs.writeFileSync(duongDanhSach, `${JSON.stringify(MAU, null, 2)}\n`, 'utf8');
    console.log(`[ui-polish-gen] đã đặt danh sách MẪU ở ${path.relative(REPO, duongDanhSach)} — sửa thành màn của task rồi chạy lại không có --init.`);
    return 0;
  }

  const r = sinh({ duongDanhSach, outDir, raDir });
  for (const c of r.canhBao || []) console.log(`[ui-polish-gen] ⚠ ${c}`);
  if (r.loi.length) {
    console.error('[ui-polish-gen] CHƯA SINH ĐƯỢC:');
    for (const l of r.loi) console.error(`  · ${l}`);
    if (!fs.existsSync(duongDanhSach)) console.error('  Đặt danh sách mẫu: thêm --init');
    return 2;
  }
  console.log(`[ui-polish-gen] ${r.soMan} màn → ${r.file}`);
  console.log(`                config → ${r.config}`);
  console.log('Spec CHỈ ĐỌC nhưng mở màn thật sau đăng nhập — xác nhận trước mỗi lượt chạm UAT (CLAUDE.md §2).');
  console.log('Đọc kết quả: npm run ui:polish -- --task <KEY>');
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { sinh, MAU, TEN_SPEC };
