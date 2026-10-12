#!/usr/bin/env node
'use strict';
/*
 * mine — KHAI THÁC THƯ VIỆN BƯỚC TỪ CODE ĐÃ CÓ (v2.8.0 §B).
 *
 * VÌ SAO KHAI THÁC TRƯỚC KHI VIẾT MỚI. Kit có `tests/fe/pages/` với ĐÚNG MỘT file `example.page.ts`,
 * trong khi 4 task đã chạy để lại **421 file · ~77.400 dòng** automation ở `outputs/<DA>/tasks/<TASK>/
 * automation/`. Phần lớn số đó là cùng những thao tác: đăng nhập theo vai trò, mở menu, lọc lưới, điền
 * form, mở chi tiết. Viết lại chúng từ đầu là trả giá hai lần cho cùng một việc.
 *
 * ĐƠN VỊ KHAI THÁC — và vì sao không phải "dòng giống nhau". So dòng thô thì mọi khác biệt về tên biến,
 * về chuỗi tiếng Việt, về thứ tự thuộc tính đều thành "khác nhau", và kết quả là 0 ứng viên. Nên máy này
 * đi qua AST và chuẩn hoá về HÌNH DẠNG THAO TÁC:
 *
 *     page.getByRole('button', { name: 'Ghi' }).click()   →   page.getByRole({v},{v}).click()
 *     page.getByLabel('Tên trường').fill('THCS X')        →   page.getByLabel({v}).fill({v})
 *
 * Hai dòng cùng hình dạng là hai lần làm CÙNG MỘT loại việc, chỉ khác tham số — tức đúng thứ một bước L2
 * tham số hoá sẽ gói lại.
 *
 * HAI MỨC ỨNG VIÊN:
 *   · THAO TÁC ĐƠN lặp nhiều lần ⇒ ứng viên cho mô hình màn L1 (một locator đã kiểm chứng).
 *   · CHUỖI 2..5 thao tác liền nhau lặp ở ≥2 TASK ⇒ ứng viên cho bước nghiệp vụ L2.
 *
 * Ngưỡng "≥2 task" là ngưỡng quan trọng nhất, và nó không phải con số tuỳ ý: một đoạn lặp trong CÙNG một
 * task có thể chỉ là một vòng lặp bị trải phẳng. Lặp ở hai task khác nhau mới là tín hiệu rằng nó thuộc
 * về hệ thống, không thuộc về một lượt chạy.
 *
 * GIỚI HẠN, phải đọc trước khi dùng số ở đây:
 *   · Máy này đo HÌNH DẠNG, không đo ý nghĩa nghiệp vụ. Hai lần `.click()` cùng hình dạng có thể là hai
 *     việc khác nhau. Nên đầu ra là ỨNG VIÊN để người duyệt theo lô, không phải thư viện tự sinh.
 *   · Nó KHÔNG biết đoạn đó có chạy ổn định hay không. `--chay-on-dinh` đọc `testcase-status.json` nếu có,
 *     còn không thì cột đó ghi `chưa đo` — không được đoán thành "ổn định".
 *
 * CHƯA ĐĂNG KÝ làm lệnh npm, cố ý. `gate:policy` chặn lệnh mồ côi, và ở thời điểm §1 chưa có workflow
 * nào gọi máy này — đăng ký bây giờ là tạo đúng cái lệnh-không-ai-chạy mà gate đó sinh ra để bắt.
 * Nó sẽ thành `npm run reuse:mine` khi §B có điểm vào gọi nó.
 *
 * Dùng: node scripts/qa/reuse/mine.js [--min-task 2] [--json] [--top 25]
 * Exit: 0 · 2 khi quét 0 file (phép đo hỏng)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
/*
 * ĐỌC AST MÀ KHÔNG THÊM PHỤ THUỘC NÀO — và tiền đề của §B sai ở đây.
 *
 * Prompt nói "dùng TypeScript compiler API, đã có `typescript` trong devDependencies". Đo 12/10/2026:
 * `typescript@7.0.2` là bản NATIVE, và gói JS của nó xuất ĐÚNG HAI thứ — `version` và `versionMajorMinor`.
 * Không có `createSourceFile`, không có `ScriptTarget`, không có `forEachChild`. Compiler API trong JS
 * không còn tồn tại ở bản này.
 *
 * `acorn`/`espree` thì có sẵn (phụ thuộc của ESLint) nhưng chỉ đọc JavaScript, còn file cần đọc là `.ts`
 * có chú thích kiểu.
 *
 * Đường đi dùng được, không tốn thêm gói nào: `node:module.stripTypeScriptTypes` bóc chú thích kiểu (giữ
 * nguyên số ký tự, nên SỐ DÒNG không lệch), rồi `acorn` phân tích phần JavaScript còn lại. §0 luật nền
 * cấm thêm dependency nặng, nên đây là lựa chọn đúng chứ không phải lựa chọn tạm.
 *
 * GIỚI HẠN: `stripTypeScriptTypes` còn là API thực nghiệm của Node. Kit ghim Node qua `.nvmrc`, nên rủi
 * ro là "đổi hành vi khi nâng Node", không phải "không chạy". Có test khoá đúng đường này.
 */
const { stripTypeScriptTypes } = require('node:module');
const acorn = require('acorn');

const JSON_OUT = process.argv.includes('--json');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? Number(process.argv[i + 1]) : d;
};
const MIN_TASK = val('min-task', 2);
const TOP = val('top', 25);

/** Hàm thao tác của Playwright. Chỉ những hàm ĐỔI TRẠNG THÁI hoặc ĐỊNH VỊ — không lấy assertion. */
const THAO_TAC = new Set([
  'click', 'dblclick', 'fill', 'type', 'press', 'check', 'uncheck', 'selectOption',
  'setInputFiles', 'hover', 'focus', 'blur', 'clear', 'dragTo', 'tap',
  'goto', 'reload', 'goBack', 'waitForURL', 'waitForLoadState', 'waitForSelector',
]);

/** Hàm định vị — giữ tên để biết bước đó nhắm vào gì. */
const DINH_VI = new Set([
  'getByRole', 'getByLabel', 'getByText', 'getByPlaceholder', 'getByTestId', 'getByTitle',
  'locator', 'frameLocator', 'nth', 'first', 'last', 'filter',
]);

/**
 * Chuẩn hoá một lời gọi thành HÌNH DẠNG: giữ chuỗi phương thức, thay mọi tham số bằng `{v}`.
 *
 * Giữ `nth(0)` khác `nth(1)`? KHÔNG — cả hai thành `nth({v})`. Chỉ số cụ thể là dữ liệu của một lượt
 * chạy, không phải hình dạng của bước. (Và một bước L2 tham số hoá sẽ nhận chỉ số đó làm tham số.)
 */
function hinhDang(node, txt) {
  const parts = [];
  let cur = node;
  let coThaoTac = false;
  const doan = (n) => txt.slice(n.start, n.end).replace(/\s+/g, '');
  while (cur && cur.type === 'CallExpression') {
    const ex = cur.callee;
    if (!ex || ex.type !== 'MemberExpression' || !ex.property || ex.property.type !== 'Identifier') break;
    const ten = ex.property.name;
    if (THAO_TAC.has(ten)) coThaoTac = true;
    parts.unshift(`${ten}(${cur.arguments.length ? '{v}' : ''})`);
    cur = ex.object;
    if (cur && cur.type !== 'CallExpression') {
      /* Gốc chuỗi: `page`, `this.page`, một biến locator… Chuẩn hoá về `page` nếu nó là page-like. */
      const goc = doan(cur);
      parts.unshift(/page$/i.test(goc) ? 'page' : goc.slice(0, 18));
      break;
    }
  }
  if (!coThaoTac) return null;
  if (!parts.some((p) => [...DINH_VI].some((d) => p.startsWith(`${d}(`)))) {
    /* Thao tác không qua locator (`page.goto`, `page.reload`) vẫn tính — đó là điều hướng. */
    if (!parts.some((p) => /^(goto|reload|goBack|waitFor)/.test(p))) return null;
  }
  return parts.join('.');
}

/** Mọi hình dạng thao tác trong một file, theo đúng thứ tự xuất hiện. */
function docFile(duong) {
  let goc;
  try { goc = fs.readFileSync(duong, 'utf8'); } catch (e) { return []; }
  let txt;
  try {
    txt = /\.ts$/.test(duong) ? stripTypeScriptTypes(goc, { mode: 'strip' }) : goc;
  } catch (e) { return []; }           /* file không parse được thì BỎ QUA, không đoán */
  let ast;
  try {
    ast = acorn.parse(txt, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  } catch (e) { return []; }

  const ra = [];
  /* Đi cây bằng tay: acorn không có `forEachChild`, và `acorn-walk` không nằm trong phụ thuộc có sẵn. */
  const di = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const x of node) di(x); return; }
    if (typeof node.type === 'string' && node.type === 'CallExpression') {
      const h = hinhDang(node, txt);
      if (h) {
        ra.push({ hinh: h, vi_tri: node.start });
        return;        /* không đi vào trong chuỗi đã bắt, tránh đếm trùng */
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
      di(node[k]);
    }
  };
  di(ast);
  return ra;
}

function quetVung() {
  const ra = [];
  const them = (d, task) => {
    let muc;
    try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const f of muc) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (!/node_modules|test-results/.test(p)) them(p, task); continue; }
      if (!/\.(ts|js)$/.test(f.name)) continue;
      ra.push({ duong: p, task });
    }
  };

  /* Lớp PROJECT: automation riêng của từng task. */
  const outputs = path.join(REPO, 'outputs');
  let das;
  try { das = fs.readdirSync(outputs, { withFileTypes: true }); } catch (e) { das = []; }
  for (const da of das) {
    if (!da.isDirectory()) continue;
    const tasks = path.join(outputs, da.name, 'tasks');
    let ts2;
    try { ts2 = fs.readdirSync(tasks, { withFileTypes: true }); } catch (e) { continue; }
    for (const t of ts2) {
      if (!t.isDirectory()) continue;
      them(path.join(tasks, t.name, 'automation'), t.name);
    }
  }

  /* Lớp dùng chung hiện có — bỏ `infra` (spec của chính kit, không phải thao tác màn của dự án). */
  them(path.join(REPO, 'tests', 'fe', 'pages'), '(shared)');
  const feDirs = ['order', 'transaction', 'auth'];
  for (const d of feDirs) them(path.join(REPO, 'tests', 'fe', d), '(shared)');

  return ra;
}

function dungDo() {
  const files = quetVung();
  const theoHinh = new Map();      /* hình dạng → { lan, task:Set, file:Set } */
  const theoChuoi = new Map();     /* chuỗi 3 thao tác → { lan, task:Set } */
  let soThaoTac = 0;

  for (const f of files) {
    const acts = docFile(f.duong);
    soThaoTac += acts.length;
    for (const a of acts) {
      if (!theoHinh.has(a.hinh)) theoHinh.set(a.hinh, { lan: 0, task: new Set(), file: new Set() });
      const e = theoHinh.get(a.hinh);
      e.lan += 1;
      e.task.add(f.task);
      e.file.add(path.relative(REPO, f.duong).replace(/\\/g, '/'));
    }
    /* Chuỗi 3 thao tác liền nhau — đơn vị gần nhất với một "bước nghiệp vụ". */
    for (let i = 0; i + 2 < acts.length; i += 1) {
      const k = [acts[i].hinh, acts[i + 1].hinh, acts[i + 2].hinh].join('  →  ');
      if (!theoChuoi.has(k)) theoChuoi.set(k, { lan: 0, task: new Set() });
      const e = theoChuoi.get(k);
      e.lan += 1;
      e.task.add(f.task);
    }
  }

  const xep = (m) => [...m.entries()]
    .map(([k, v]) => ({ mau: k, lan: v.lan, so_task: v.task.size, task: [...v.task].sort() }))
    .sort((a, b) => (b.so_task - a.so_task) || (b.lan - a.lan));

  const hinh = xep(theoHinh);
  const chuoi = xep(theoChuoi);

  return {
    so_file: files.length,
    so_thao_tac: soThaoTac,
    so_hinh_dang: hinh.length,
    ung_vien_L1: hinh.filter((x) => x.so_task >= MIN_TASK),
    ung_vien_L2: chuoi.filter((x) => x.so_task >= MIN_TASK),
    hinh,
    chuoi,
  };
}

function main() {
  const d = dungDo();
  if (!d.so_file) {
    console.error('[mine] ✗ quét 0 file — phép đo hỏng (sai cwd? chưa có task nào chạy?), không phải "không có gì để khai thác".');
    process.exit(2);
  }
  if (JSON_OUT) { console.log(JSON.stringify(d, null, 2)); return; }

  const phuL1 = d.ung_vien_L1.reduce((s, x) => s + x.lan, 0);
  const tiLe = d.so_thao_tac ? Math.round((phuL1 / d.so_thao_tac) * 100) : 0;

  console.log(`[mine] ${d.so_file} file · ${d.so_thao_tac} lời gọi thao tác · ${d.so_hinh_dang} hình dạng khác nhau`);
  console.log(`[mine] ứng viên lặp ở ≥${MIN_TASK} task: ${d.ung_vien_L1.length} hình dạng (L1) · ${d.ung_vien_L2.length} chuỗi-3 (L2)`);
  console.log(`[mine] ${phuL1}/${d.so_thao_tac} lời gọi (${tiLe}%) thuộc một hình dạng đã lặp ở ≥${MIN_TASK} task`);
  console.log('');
  console.log(`TOP ${Math.min(TOP, d.ung_vien_L1.length)} hình dạng (ứng viên L1 — locator đã dùng nhiều lần):`);
  console.log('  lần  task  hình dạng');
  for (const x of d.ung_vien_L1.slice(0, TOP)) {
    console.log(`  ${String(x.lan).padStart(4)}  ${String(x.so_task).padStart(4)}  ${x.mau.slice(0, 92)}`);
  }
  console.log('');
  console.log(`TOP ${Math.min(10, d.ung_vien_L2.length)} chuỗi-3 (ứng viên L2 — bước nghiệp vụ):`);
  for (const x of d.ung_vien_L2.slice(0, 10)) {
    console.log(`  ${String(x.lan).padStart(4)} lần · ${x.so_task} task`);
    console.log(`        ${x.mau.slice(0, 150)}`);
  }
  console.log('');
  console.log('GIỚI HẠN: máy này đo HÌNH DẠNG, không đo ý nghĩa nghiệp vụ. Hai lời gọi cùng hình dạng có thể là');
  console.log('  hai việc khác nhau. Đây là danh sách ỨNG VIÊN để người duyệt theo lô, KHÔNG phải thư viện tự sinh.');
  console.log('  Và nó KHÔNG biết đoạn nào chạy ổn định — cột đó phải đo riêng, không được đoán.');
}

if (require.main === module) main();

module.exports = { hinhDang, docFile, quetVung, dungDo, THAO_TAC, DINH_VI };
