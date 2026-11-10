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
 * `01_run_phase2.md` nên nó vỡ là cả bước Phase 1 vỡ theo.
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

/*
 * ─── TEST MỒ CÔI: đã chạy mà KHÔNG TC nào nhận (v2.9.6 N2.3) ──────────────────────────────────────
 *
 * Bảng chính đi một chiều: TC canonical → đã execute chưa. Chiều ngược chưa ai đo, và nó bỏ lọt đúng
 * loại lỗi khó thấy nhất — một lượt chạy GHI VERDICT cho một mã mà bộ case không có dòng nào nhận.
 *
 * ĐẾM TRẦN MỘT CON SỐ LÀ VÔ DỤNG. Phần lớn ca "mồ côi" là ca MỞ RỘNG §7, vốn ĐÚNG THIẾT KẾ là không có
 * dòng canonical. Một cột "mồ côi: 8" sẽ chôn ca đáng lo dưới đống đúng-thiết-kế, nên phải PHÂN LOẠI
 * rồi mới đếm. Số đo 30/10/2026 trên CSDL-9004: 8/256 không có dòng canonical ⇒ **7 ca mở rộng KHÔNG có
 * neo oracle (5 trong đó FAILED)** + 1 ca recon mang verdict; và **6 ca mở rộng CÓ neo** nên phép kiểm
 * neo không rỗng ở cả hai chiều. CSDL-9001: 1/205, là một PROBE mang `PASSED`.
 *
 * Ba loại, và chỉ hai loại đầu là lỗi:
 *   · MỞ RỘNG không có neo — CLAUDE.md §3: mở rộng chỉ được PASS/FAIL khi có `oracle_ref`; không neo thì
 *     là `OBSERVATION`. Một FAIL mở rộng không neo là đúng thứ dễ thành bug sai.
 *   · PROBE/RECON mang verdict — probe là bước khám phá, nó không phán gì.
 *   · MẠO DANH — mã dạng `..._TC_<số>` mà không dòng nào nhận; verdict của nó rơi vào khoảng không.
 *
 * MẠO DANH đo được **0 ca**, và chỗ đó là một bài học riêng: phép đo nháp của tôi báo 2 ca
 * (`CSDL_HSTRUONG_TC_127B`, `TC_161B`) vì regex nháp đòi hậu tố CHỮ THƯỜNG nên trượt chữ `B` hoa — hai
 * mã ấy CÓ trong canonical. Bộ phân tích thật (`parseTestcases`) đọc đúng. Nên loại này ship kèm đối
 * chứng dương tổng hợp, và ghi rõ là **chưa gác dòng dữ liệu thật nào**.
 *
 * "0 TC canonical đọc được" KHÔNG phải "sạch" — phải nói KHÔNG PHÁN ĐƯỢC.
 */
const RE_NEO_ORACLE = /\b(?:BR|SM|UI|BUS|RULE)-[A-Z0-9_.-]+/;

function loaiMoCoi(id) {
  if (/^PROBE_|^RECON_|_RECON_/.test(id)) return 'probe';
  if (/^EXPANSION_|^EXT_|_EXT_/.test(id)) return 'moRong';
  if (/_TC_\d+[A-Za-z]?$/.test(id)) return 'maoDanh';
  return 'khongRoKhuon';
}

/*
 * NEO CÓ THỂ NẰM TRONG BUG CLAIM — và bỏ sót chỗ này làm cửa báo oan 5/9 ca.
 *
 * Bản đầu chỉ soi sổ verdict. Nhưng kit có một cơ chế riêng cho đúng việc neo một phát hiện: bug claim
 * ở `reports/bug-claims/<tcId>.json`, mang `oracle: { type, ref, quote }`. Đo 30/10/2026: CSDL-9004 có
 * 22/22 claim CÓ `oracle.ref`, CSDL-9001 41/41, CSDL-4008 34/43. Và 5 trong 9 ca mà cửa này báo "mở rộng
 * không có neo" ĐÃ CÓ claim kèm neo — tức cửa đang đòi một thứ đã có, chỉ nằm chỗ khác.
 *
 * Nên neo được công nhận khi ở MỘT trong ba chỗ: trường riêng của record · chữ trong comment/step · hoặc
 * bug claim. Đòi đúng một chỗ là bắt người ta ghi hai lần cùng một thứ.
 *
 * CLAIM ĐÃ RÚT thì KHÔNG phải neo: `status: 'withdrawn'` nghĩa là chính người khai đã bỏ lời khẳng định
 * đó. Tính nó là neo thì một claim rút rồi vẫn giữ verdict đứng — đúng kiểu `bug_claim.js` đang gác.
 */
function coClaimNeo(T, tcId) {
  const f = path.join(T, 'reports', 'bug-claims', `${String(tcId).replace(/[^\w.-]+/g, '_')}.json`);
  const j = readJson(f);
  if (!j) return false;
  const c = j.claim || j;
  if (String(c.status || '') === 'withdrawn') return false;
  const ref = c.oracle && c.oracle.ref;
  return Boolean(String(ref || '').trim());
}

function testMoCoi(T, tcs) {
  const canon = new Set(tcs.map((x) => normId(x.tcId)).filter(Boolean));
  const so = readJson(path.join(T, 'test-results', 'testcase-status.json'));
  if (!so) return { doDuoc: false, vi_sao: 'không đọc được `test-results/testcase-status.json`' };
  if (!canon.size) return { doDuoc: false, vi_sao: 'bộ case canonical đọc ra 0 TC, nên không có gì để đối chiếu' };

  const ghi = new Map();
  for (const x of (so.tests || [])) if (x.tcId) ghi.set(normId(x.tcId), x);

  const dem = { maoDanh: 0, khongNeo: 0, probe: 0, coNeo: 0, khongRoKhuon: 0 };
  const ds = [];
  for (const [id, x] of ghi) {
    if (canon.has(id)) continue;
    const L = loaiMoCoi(id);
    const st = String(x.status || '');
    const coVerdict = /^(PASS|FAIL)/i.test(st);

    if (L === 'moRong') {
      /* Neo có thể ở trường riêng hoặc viết trong comment/step — tìm cả hai, đừng đòi đúng một chỗ. */
      const coNeo = Boolean(x.oracleRef || x.oracle_ref)
        || RE_NEO_ORACLE.test(JSON.stringify(x))
        || coClaimNeo(T, id);
      if (!coVerdict) continue;                       // mở rộng khai OBSERVATION là đúng luật, bỏ qua
      if (coNeo) { dem.coNeo += 1; continue; }
      dem.khongNeo += 1;
      ds.push({ id, status: st, loai: 'mở rộng KHÔNG có neo oracle', viec: 'hạ về `OBSERVATION`, hoặc nêu `oracle_ref` (`BR-`/`SM-`/`UI-`…)' });
      continue;
    }
    if (L === 'probe') {
      if (!coVerdict) continue;                       // probe không mang verdict là đúng
      dem.probe += 1;
      ds.push({ id, status: st, loai: 'probe/recon mang verdict', viec: 'bỏ verdict — probe là bước khám phá, không phán' });
      continue;
    }
    if (L === 'maoDanh') {
      dem.maoDanh += 1;
      ds.push({ id, status: st, loai: 'MẠO DANH mã canonical', viec: 'thêm dòng canonical cho mã này, hoặc đổi mã khỏi khuôn `_TC_<số>`' });
      continue;
    }
    dem.khongRoKhuon += 1;
    ds.push({ id, status: st, loai: 'không rõ khuôn', viec: 'đặt tên theo một trong ba khuôn đã khai, để máy phân loại được' });
  }
  ds.sort((a, b) => (a.loai === 'MẠO DANH mã canonical' ? -1 : 1) - (b.loai === 'MẠO DANH mã canonical' ? -1 : 1));
  const soMoCoi = [...ghi.keys()].filter((id) => !canon.has(id)).length;
  return { doDuoc: true, soGhi: ghi.size, soMoCoi, ds, dem };
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
    /* ─── CHIỀU NGƯỢC: test ĐÃ CHẠY mà KHÔNG TC nào nhận (v2.9.6 N2.3) ───────────────────────────── */
    const moCoi = testMoCoi(T, tcs);
    P.push('', '## Test đã chạy mà KHÔNG TC nào nhận', '');
    if (!moCoi.doDuoc) {
      P.push('- **KHÔNG phán được**: ' + moCoi.vi_sao + ' — đây không phải "sạch".');
    } else if (!moCoi.ds.length && !moCoi.soMoCoi) {
      P.push(`- Mọi ${moCoi.soGhi} tcId trong sổ verdict đều có dòng trong bộ case canonical.`);
    } else if (!moCoi.ds.length) {
      /*
       * BA TRẠNG THÁI, KHÔNG HAI. Bản đầu gộp "không có ca mồ côi" với "có ca mồ côi nhưng đều đúng
       * luật", nên khi mọi ca mở rộng đều có neo nó in "Mọi N tcId đều có dòng canonical" — một câu SAI,
       * và sai theo chiều làm người đọc tưởng phép kiểm neo chưa chạy. Phép kiểm của chính spec bắt được.
       */
      P.push(`- ${moCoi.soMoCoi}/${moCoi.soGhi} tcId không có dòng canonical, nhưng **không ca nào là lỗi**:`
        + ` ${moCoi.dem.coNeo} ca mở rộng CÓ neo oracle, phần còn lại khai \`OBSERVATION\`/không verdict.`
        + ' Phép kiểm neo đã chạy và đã sạch — khác hẳn "không có gì để kiểm".');
    } else {
      P.push('| tcId | verdict | loại | việc phải làm |', '|---|---|---|---|');
      for (const x of moCoi.ds) P.push(`| \`${x.id}\` | ${x.status} | ${x.loai} | ${x.viec} |`);
      /*
       * HAI CON SỐ KHÁC NHAU, và bản đầu gắn nhãn sai: nó in `ds.length` (số ca LỖI) kèm chữ "không có
       * dòng canonical" (số ca MỒ CÔI). Ở CSDL-9004 là 8 so với 27 — lệch hơn ba lần. Phát hiện ra vì
       * `self:review` in 27 trong khi bản PM in 8; một con số đứng cạnh một con số khác thì mới lộ.
       */
      P.push('', `**${moCoi.soMoCoi}/${moCoi.soGhi} tcId trong sổ không có dòng canonical, ${moCoi.ds.length} trong đó là LỖI.**`
        + ' Đếm trần con số đầu là vô dụng — ba loại dưới đây cần ba việc khác nhau, và chỉ hai loại đầu là lỗi:');
      P.push('', `- **${moCoi.dem.maoDanh} mạo danh mã canonical** — mã trông như \`..._TC_<số>\` nhưng không dòng nào nhận.`
        + ' Verdict của nó rơi vào khoảng không, hoặc tệ hơn là bị đọc như đã phủ mã gần giống.');
      P.push(`- **${moCoi.dem.khongNeo} ca MỞ RỘNG mang PASS/FAIL mà KHÔNG có neo oracle** — CLAUDE.md §3 nói`
        + ' mở rộng không có `oracle_ref` (`BR-`/`SM-`/`UI-`…) thì là `OBSERVATION`, **không** phải verdict.'
        + ' Nhất quán KHÔNG phải bằng chứng của đúng.');
      P.push(`- **${moCoi.dem.probe} ca probe/recon mang verdict** — probe là bước khám phá, nó không phán gì.`);
      P.push(`- *(${moCoi.dem.coNeo} ca mở rộng CÓ neo oracle — đúng luật, không tính là lỗi.)*`);
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

/*
 * Export + CHỐT `require.main`.
 *
 * Bản trước gọi `main()` vô điều kiện, nên `require()` file này là chạy cả lượt sinh báo cáo — đúng cú
 * đã ghi trong sổ kit. `self:review` cần dùng lại `testMoCoi` chứ không được sinh lại báo cáo.
 */
module.exports = { testMoCoi, parseTestcases, loaiMoCoi, RE_NEO_ORACLE };

if (require.main === module) {
  main().catch((e) => { console.error('[trace] LỖI:', e.message); process.exit(1); });
}
