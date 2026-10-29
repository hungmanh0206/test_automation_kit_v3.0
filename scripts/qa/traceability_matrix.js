#!/usr/bin/env node
'use strict';

/*
 * traceability_matrix.js (F8) — sinh ma trận REQ → TC → AUTO → EXEC → BUG dạng artifact.
 * Join các artifact có sẵn của task (không gọi ngoài): dựng bức tranh coverage đầu-cuối,
 * đánh dấu lỗ hổng (TC chưa publish / chưa execute / fail / có bug).
 *
 * Nguồn (trong <TASK_OUTPUT_DIR>):
 *   REQ  = task/story key (context)                     · nhóm theo cột Module của TC
 *   TC   = test-cases/*.md (cột "TC ID" + "Module")
 *   PUBLISH = TC có mặt trong mirror `test-cases/from-sheet/*.xlsx` (tải từ Google Sheet) ⇒ đã publish
 *   AUTO/EXEC = test-results[/runs/<RUN_ID>]/testcase-status.json (tcId→status)  (có status = đã tự động drive)
 *   BUG  = reports/bug-candidates.md (Backlog key + TC ref, best-effort)
 *
 * Dùng: TASK_ENV=profiles/<TASK>/task.env node scripts/qa/traceability_matrix.js
 *       hoặc --task-output <dir> | --project-output <dir> --task <KEY>
 * Out: <task>/reports/traceability-matrix.{md,csv}
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const testcaseModel = require(path.resolve(__dirname, '..', 'lib', 'testcase')); // #1: parser canonical DUY NHẤT

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const normId = (s) => String(s || '').trim().toUpperCase();

function taskDir() {
  const explicit = arg('task-output');
  if (explicit) return path.resolve(explicit);
  try { return rc.getTaskOutputDir({ projectOutputDir: arg('project-output'), taskKey: arg('task') }); }
  catch (e) { console.error('[trace] Thiếu task context. Đặt TASK_ENV hoặc --task-output <dir> (hoặc --project-output + --task).'); process.exit(2); }
}

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

// Parse bảng testcase 9 cột → [{tcId, module}].
function parseTestcases(dir) {
  const rows = [];
  if (!fs.existsSync(dir)) return rows;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const doc = testcaseModel.parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const t of doc.tests) rows.push({ tcId: normId(t.tcId), module: (t.module || '').split('/')[0].trim() || '(none)', file: f });
  }
  return rows;
}

/*
 * Tập TC ĐÃ PUBLISH = có mặt trong mirror `test-cases/from-sheet/*.xlsx` (bản tải về từ Google Sheet).
 * Lượt refactor bỏ công cụ cũ đã viết ngữ nghĩa này vào header nhưng KHÔNG viết phần dựng biến, chỉ thêm chỗ dùng
 * `publishedTc.has(...)` ⇒ ReferenceError ngay khi map rows. Lệnh này nằm trong bảng gate bắt buộc của
 * `run_phase1_template.md` nên nó vỡ là cả bước Phase 1 vỡ theo.
 *
 * KHÔNG có mirror ⇒ trả `null` (KHÔNG phải Set rỗng): Set rỗng sẽ gắn cờ "chưa-publish" cho TOÀN BỘ TC,
 * biến "chưa kéo mirror về" thành "chưa publish" — báo oan đúng kiểu mà kit cấm.
 */
async function loadPublished(taskOutputDir) {
  // Đọc theo `rc.TESTCASE_MIRROR_DIRS` (MỘT nguồn thật, không tự ghép tay 'from-aio' nữa) — đổi tên mirror
  // ở runtime_config.js thì chỗ này tự theo, không phải sửa lại.
  const dirs = rc.TESTCASE_MIRROR_DIRS.map((d) => path.join(taskOutputDir, 'test-cases', d)).filter((d) => fs.existsSync(d));
  if (!dirs.length) return null;
  const files = dirs.flatMap((dir) => fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f)).map((f) => path.join(dir, f)));
  if (!files.length) return null;
  const out = new Set();
  for (const f of files) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const doc = await testcaseModel.parseXlsx(f);
      for (const t of doc.tests || []) if (t.tcId) out.add(normId(t.tcId));
    } catch (e) { console.warn(`[trace] bỏ qua ${path.basename(f)}: ${e.message}`); }
  }
  return out;
}

async function main() {
  const T = taskDir();
  const taskKey = arg('task') || process.env.TASK_KEY || path.basename(T);
  const RUN_ID = process.env.RUN_ID || arg('run-id') || '';
  const trDir = RUN_ID ? path.join(T, 'test-results', 'runs', RUN_ID) : path.join(T, 'test-results');

  const tcs = parseTestcases(path.join(T, 'test-cases'));

  const statusDoc = readJson(path.join(trDir, 'testcase-status.json')) || readJson(path.join(T, 'test-results', 'testcase-status.json'));
  const execByTc = new Map();
  for (const t of (statusDoc && (statusDoc.tests || statusDoc.testcases)) || []) if (t.tcId) execByTc.set(normId(t.tcId), String(t.status || '').toUpperCase());

  /*
   * BUG best-effort: gom Backlog key + TC ref từ bug-candidates.md.
   *
   * Mẫu khoá phải TỔNG QUÁT (`[A-Z][A-Z0-9]+-\d+`), KHÔNG hardcode tiền tố dự án. Bản trước khoá cứng
   * một tiền tố cố định; khi tổ chức đổi tiền tố khoá task thì nó tìm ra **0 bug và không báo gì** —
   * ma trận truy vết vẫn in ra bình thường, chỉ là trống cột bug. Đúng loại tín hiệu sạch-giả.
   * Cùng mẫu với `quality_decision.js` để hai nơi không trôi khỏi nhau.
   */
  const bugMd = (() => { try { return fs.readFileSync(path.join(T, 'reports', 'bug-candidates.md'), 'utf8'); } catch (e) { return ''; } })();
  const bugByTc = new Map();
  const bugKeysAll = [...new Set((bugMd.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || []))];
  for (const line of bugMd.split(/\r?\n/)) {
    const keys = line.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
    const tcRefs = line.match(/\bTC[_-]?\d+\b/gi) || [];
    for (const ref of tcRefs) { const k = normId(ref).replace(/[_-]/g, '_'); for (const bk of keys) (bugByTc.get(k) || bugByTc.set(k, []).get(k)).push(bk); }
  }
  const tcHasBug = (tcId) => {
    for (const [ref, keys] of bugByTc) if (tcId.endsWith(ref) || tcId.includes(ref)) return keys.join(' ');
    return '';
  };

  const publishedTc = await loadPublished(T);
  const knowPublish = publishedTc !== null;
  const rows = tcs.map((tc) => {
    const published = knowPublish ? publishedTc.has(normId(tc.tcId)) : null;
    const exec = execByTc.get(tc.tcId) || '';
    const bug = tcHasBug(tc.tcId);
    const flags = [];
    if (knowPublish && !published) flags.push('chưa-publish');
    if (!exec) flags.push('chưa-execute');
    if (/FAIL/.test(exec)) flags.push('FAIL');
    return { req: taskKey, module: tc.module, tcId: tc.tcId, published, auto: exec ? 'yes' : 'no', exec: exec || '—', bug: bug || '—', flags: flags.join(', ') };
  });

  // Ghi CSV + MD.
  fs.mkdirSync(path.join(T, 'reports'), { recursive: true });
  const csv = ['REQ,Module,TC,PUBLISH,AUTO,EXEC,BUG,Flags',
    ...rows.map((r) => [r.req, r.module, r.tcId, r.published === null ? '?' : (r.published ? 'yes' : 'no'), r.auto, r.exec, (r.bug || '').replace(/,/g, ' '), r.flags].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  fs.writeFileSync(path.join(T, 'reports', 'traceability-matrix.csv'), csv, 'utf8');

  const publishedCount = rows.filter((r) => r.published).length;
  const executed = rows.filter((r) => r.exec !== '—').length;
  const failed = rows.filter((r) => /FAIL/.test(r.exec)).length;
  const withBug = rows.filter((r) => r.bug !== '—').length;
  const L = ['# Traceability Matrix — ' + taskKey, '',
    `> ${new Date().toISOString().slice(0, 19).replace('T', ' ')} · join REQ→TC→AUTO→EXEC→BUG từ artifact task (không gọi ngoài).`,
    `> TC: ${rows.length} · đã publish: ${knowPublish ? publishedCount : 'không rõ'} · execute: ${executed} · FAIL: ${failed} · có bug: ${withBug} · bug keys: ${bugKeysAll.join(', ') || '—'}`,
    `> Lỗ hổng: ${knowPublish ? `${rows.length - publishedCount} TC chưa publish` : 'publish: KHÔNG RÕ (chưa có mirror test-cases/from-sheet — agent cần tải Sheet mới nhất qua Drive MCP trước)'} · ${rows.length - executed} TC chưa execute.`, '',
    '| REQ | Module | TC | PUBLISH | AUTO | EXEC | BUG | Flags |', '|---|---|---|---|---|---|---|---|'];
  for (const r of rows) L.push(`| ${r.req} | ${r.module} | ${r.tcId} | ${r.published === null ? '?' : (r.published ? 'yes' : '—')} | ${r.auto} | ${r.exec} | ${r.bug} | ${r.flags} |`);
  fs.writeFileSync(path.join(T, 'reports', 'traceability-matrix.md'), L.join('\n'), 'utf8');

  /*
   * BẢN GỘP THEO MODULE (v2.9.5 §7) — sinh LUÔN, không cần cờ.
   *
   * Bản đầu để `--pm` là opt-in, với lý lẽ "không ai xin thì không sinh thêm artifact". Lý lẽ đó SAI ở
   * đây, và chỗ sai lộ ra khi đo xem ai gọi nó: **không luồng nào**. Chỉ một skill nhắc tên nó — tức nó
   * là một bản sinh chỉ tồn tại khi có người nhớ gõ thêm một cờ, đúng lớp "máy không ai gọi" mà kit vẫn
   * chống. Và nó không phải artifact MỚI: nó gộp lại chính dữ liệu vừa ghi ra `traceability-matrix.md`,
   * cùng một lượt đọc, không thêm phép đo nào.
   *
   * Cờ `--pm` vẫn nhận để lệnh cũ không vỡ, nhưng nó không còn tác dụng gì.
   *
   * Vì sao cần một view riêng: ma trận per-TC của một task thật dài 275 dòng (đo trên CSDL-9004). Không
   * ai ở vai quản lý đọc 275 dòng, nên trong thực tế người ta đọc dòng `>` tóm tắt — mà dòng đó chỉ có
   * TỔNG, không nói module nào đang hổng. Hệ quả: "80% đã execute" nghe như đều, trong khi 20% còn lại
   * có thể dồn hết vào một module.
   *
   * KHÔNG LÀM TRÒN CHỖ CHƯA BIẾT. `publish` có ba trạng thái (`yes`/`—`/`?`), và `?` nghĩa là chưa tải
   * mirror Sheet về. Gộp `?` thành 0 làm bảng đọc như "chưa publish gì cả" — một kết luận khác hẳn
   * "chưa đo được". Nên cột publish in cả hai số, và `?` có cột riêng.
   */
  {
    const theoModule = new Map();
    for (const r of rows) {
      /*
       * Parser canonical đã điền `(none)` cho ô Module rỗng, nên một fallback `|| '…'` ở đây là MÃ CHẾT
       * — nó không bao giờ chạy, và phép kiểm nào tin vào nó sẽ đỏ vì lý do sai. Bản gộp là view cho
       * người đọc nên đổi nhãn sang tiếng Việt, và nhận CẢ HAI nguồn.
       */
      const k = (!r.module || r.module === '(none)') ? '(không khai module)' : r.module;
      const m = theoModule.get(k) || { tc: 0, pub: 0, chuaRo: 0, exec: 0, fail: 0, bug: 0 };
      m.tc += 1;
      if (r.published === null) m.chuaRo += 1; else if (r.published) m.pub += 1;
      if (r.exec !== '—') m.exec += 1;
      if (/FAIL/.test(r.exec)) m.fail += 1;
      if (r.bug !== '—') m.bug += 1;
      theoModule.set(k, m);
    }
    const pc = (a, b) => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);
    const P = [`# Traceability — bản GỘP cho người đọc báo cáo · ${taskKey}`, '',
      `> ${new Date().toISOString().slice(0, 19).replace('T', ' ')} · gộp từ ${rows.length} dòng của`
      + ' `traceability-matrix.md`. Cùng một nguồn, không đếm lần hai.',
      '>',
      '> Cột `publish ?` là số TC **chưa đo được** chứ không phải chưa publish — nó bằng 0 chỉ khi đã tải',
      '> mirror Sheet về. Đọc hai cột đó cùng nhau, đừng cộng `?` vào `—`.', '',
      '| Module | TC | publish ✓ | publish ? | execute | % execute | FAIL | có bug |',
      '|---|---|---|---|---|---|---|---|'];
    /* Sắp theo SỐ TC CHƯA EXECUTE giảm dần: chỗ hổng to nhất nằm ở dòng đầu, không phải ở cuối bảng. */
    const sap = [...theoModule.entries()].sort((a, b) => (b[1].tc - b[1].exec) - (a[1].tc - a[1].exec));
    for (const [k, m] of sap) {
      P.push(`| ${k} | ${m.tc} | ${m.pub} | ${m.chuaRo} | ${m.exec} | ${pc(m.exec, m.tc)} | ${m.fail} | ${m.bug} |`);
    }
    const t = { tc: rows.length, pub: publishedCount, chuaRo: rows.filter((r) => r.published === null).length, exec: executed, fail: failed, bug: withBug };
    P.push(`| **TỔNG** | **${t.tc}** | **${t.pub}** | **${t.chuaRo}** | **${t.exec}** | **${pc(t.exec, t.tc)}** | **${t.fail}** | **${t.bug}** |`);

    const hong = sap.filter(([, m]) => m.exec < m.tc);
    P.push('', '## Chỗ hổng, nói thẳng', '');
    if (hong.length === 0) {
      P.push('- Mọi module đã execute đủ số TC đã viết.');
    } else {
      for (const [k, m] of hong.slice(0, 10)) P.push(`- **${k}**: còn ${m.tc - m.exec}/${m.tc} TC chưa execute.`);
      if (hong.length > 10) P.push(`- … và ${hong.length - 10} module nữa (xem bảng trên).`);
    }
    P.push('', '> **Mẫu số của bảng này là số TC ĐÃ VIẾT, không phải số thứ cần kiểm.** Bộ case thiếu một',
      '> vùng thì vùng đó không có dòng nào ở đây, và `100% execute` vẫn không nói gì về nó. Mẫu số thật',
      '> neo ở `requirements/scope_inventory.md` (`npm run scope:anchor`), và chiều ngược ở `npm run spec:gap`.', '');
    fs.writeFileSync(path.join(T, 'reports', 'traceability-pm.md'), P.join('\n'), 'utf8');
    console.log(`[trace] → ${path.join(T, 'reports', 'traceability-pm.md')} (bản gộp ${theoModule.size} module)`);
  }

  console.log(`[trace] ${taskKey}: ${rows.length} TC · publish ${knowPublish ? publishedCount : '?'} · execute ${executed} · FAIL ${failed} · bug ${withBug}`);
  console.log(`[trace] → ${path.join(T, 'reports', 'traceability-matrix.md')} (+ .csv)`);
  if (rows.length === 0) console.log('[trace] (0 TC — kiểm test-cases/*.md có bảng 9 cột không).');
}

main().catch((e) => { console.error('[trace] LỖI:', e.message); process.exit(1); });
