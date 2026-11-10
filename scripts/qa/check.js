#!/usr/bin/env node
'use strict';
/*
 * check — MỘT LỆNH KIỂM (v2.7.0 §A3).
 *
 * VÌ SAO. Đo được ở `docs/v2.7.0/BASELINE.md`: chuỗi Phase 2 bảo agent chạy **43 lệnh gate**, Phase 1
 * bảo chạy 30, và riêng dàn gate mức repo in **16.551 byte (khoảng 4.137 token)** mỗi lượt. Phần lớn
 * là lời giải thích dài lặp lại. Đích của v2.7.0 là người dùng chỉ cần nhớ 5 lệnh, và đây là lệnh gánh
 * phần "kiểm".
 *
 * BA THỨ FILE NÀY LÀM, và một thứ nó CỐ Ý KHÔNG làm:
 *   · tự nhận phase theo ARTIFACT có thật, không hỏi;
 *   · parse testcase MỘT LẦN rồi đưa cho mọi gate nhận dữ liệu đã parse;
 *   · áp lớp tầng (§A1): T0 chặn ngay, T1 ghi sổ nợ ở `write`/`phase` và chặn ở `exit`/`ci`;
 *   · KHÔNG tự sửa gì. `--fix` là việc của §A4.
 *
 * NÓI THẲNG VỀ "MỘT TIẾN TRÌNH". §A3 viết "chạy mọi gate của phase trong MỘT tiến trình, không spawn
 * mỗi gate một lần". Đạt được MỘT PHẦN, và phần không đạt được phải khai:
 *
 *   trong tiến trình : preflight · design_gate · output_gate (row + execution) · scope_anchor
 *   còn phải spawn   : dim:coverage · risk:gate · lint:locator · ledger:check · typecheck:task
 *                      · expected:check · canonical:drift
 *
 * Lý do: nhóm sau không có `require.main` guard hoặc không export hàm gate, nên `require` chúng là chạy
 * CLI rồi `process.exit` ngay giữa lượt gọi. Sửa cả bảy để require được là một lượt refactor vào đúng
 * nhóm máy quan trọng nhất của kit, và cái giá đó lớn hơn thứ nó mua: chi phí thật mà AGENT trả là SỐ
 * LƯỢT GỌI TOOL cộng SỐ BYTE vào ngữ cảnh, không phải số tiến trình con. Một lệnh spawn bảy tiến trình
 * vẫn là MỘT lượt gọi và MỘT khối output.
 *
 * Nên con số file này hứa là: 1 lượt gọi thay cho 30–43, và một bảng gọn thay cho nhiều khối dài. Số
 * tiến trình con thì nó IN RA để không ai tưởng đã về một.
 *
 * Dùng:
 *   node scripts/qa/check.js [--task <KEY>] [--context write|phase|exit|ci] [--full] [--json]
 *   node scripts/qa/check.js --explain <CODE>
 *   node scripts/qa/check.js --override <CODE> --tc <TC_ID>[,<TC_ID>] --reason "<lý do>" --by <vai trò>
 *
 * Exit: 0 không còn chặn · 1 còn chặn (theo tầng và ngữ cảnh) · 2 không chạy được
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));
const engine = require(path.join(__dirname, 'lib', 'gate_engine'));
const gateTier = require(path.join(__dirname, 'lib', 'gate_tier.js'));

const JSON_OUT = process.argv.includes('--json');
const FULL = process.argv.includes('--full');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const NGU_CANH = val('context', 'phase');
const SO_DONG = Number(val('dong', '12'));

/* ── `--explain <CODE>` ───────────────────────────────────────────────────────────────────────────── */
function giaiThich(ma) {
  const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent', 'config', 'gate_codes.json'), 'utf8'));
  const ds = Array.isArray(cfg) ? cfg : (cfg.codes || []);
  const m = ds.find((x) => String(x.code).toUpperCase() === String(ma).toUpperCase());
  if (!m) {
    console.error(`[check] không có mã "${ma}". Có: ${ds.map((x) => x.code).join(' · ')}`);
    process.exit(2);
  }
  /*
   * TẦNG đứng ngay dòng đầu, vì nó quyết định người đọc phải sửa NGAY hay sửa trước cửa ra. Thiếu nó
   * thì mọi mã trông cùng mức khẩn, và cái khẩn thật bị trộn vào đám còn lại.
   */
  console.log(`${m.code} [${m.tang || 'chưa xếp tầng'}] — ${m.y}`);
  if (m.tang === 'T0') console.log('  T0: chặn ở MỌI ngữ cảnh, không có cờ bỏ qua.');
  if (m.tang === 'T1') console.log('  T1: lúc đang làm thì chỉ cảnh báo và vào sổ nợ; CỬA RA sẽ chặn.');
  if (m.vi_sao) console.log(`\nVÌ SAO: ${m.vi_sao}`);
  if (m.sua) console.log(`\nSỬA: ${m.sua}`);
  if (m.vi_du) console.log(`\nVÍ DỤ sai → đúng: ${m.vi_du}`);
  if (!m.sua || !m.vi_du) {
    /*
     * §A5 đòi mỗi mã có "sửa thế nào" cộng một ví dụ. Mã nào còn thiếu thì NÓI RA ở đây, vì một
     * `--explain` trả về nửa câu còn tệ hơn không có: người đọc tưởng đã đọc hết hướng dẫn.
     */
    console.log(`\n⚠ Mã này còn THIẾU ${!m.sua ? '"sửa thế nào"' : ''}${!m.sua && !m.vi_du ? ' và ' : ''}${!m.vi_du ? 'ví dụ sai→đúng' : ''} trong \`gate_codes.json\` (§A5).`);
  }
}

/* ── Nhận phase theo ARTIFACT có thật ─────────────────────────────────────────────────────────────── */
/*
 * Không hỏi, và cũng không đoán theo tên task. Dấu hiệu là FILE CÓ THẬT:
 *   · có `test-results/testcase-status*.json`  → đã execute → Phase 2;
 *   · chỉ có `test-cases/*.md` hoặc `*.xlsx`    → đang sinh case → Phase 1;
 *   · không có gì                               → CHƯA BIẾT, và nói ra chứ không mặc định Phase 1.
 *
 * "Chưa biết" phải là một trạng thái thật: mặc định Phase 1 cho một task đã execute nghĩa là bỏ qua
 * toàn bộ gate về evidence và verdict, mà đó đúng là nhóm T0.
 */
function nhanPhase(taskOutputDir) {
  const tcDir = path.join(taskOutputDir, 'test-cases');
  const trDir = path.join(taskOutputDir, 'test-results');
  const coStatus = fs.existsSync(trDir)
    && fs.readdirSync(trDir).some((f) => /^testcase-status.*\.json$/i.test(f));
  const coCase = fs.existsSync(tcDir) && fs.readdirSync(tcDir).some((f) => /\.(md|xlsx)$/i.test(f));
  if (coStatus) return { phase: 2, vi_sao: 'có `test-results/testcase-status*.json` — đã execute' };
  if (coCase) return { phase: 1, vi_sao: 'có `test-cases/` nhưng chưa có file status — đang sinh case' };
  return { phase: null, vi_sao: 'không thấy `test-cases/` lẫn file status — chưa biết phase' };
}

/** Mọi file status của task (gồm shard). */
function timStatus(taskOutputDir) {
  const d = path.join(taskOutputDir, 'test-results');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => /^testcase-status.*\.json$/i.test(f)).map((f) => path.join(d, f));
}

/* ── Gate CHẠY TRONG TIẾN TRÌNH ───────────────────────────────────────────────────────────────────── */
/*
 * PARSE MỘT LẦN. `gateTestExecution` và `gateTestcaseRow` nhận dữ liệu ĐÃ PARSE, nên bộ case được đọc
 * và parse đúng một lượt rồi dùng cho cả hai. `gateDesign` tự parse bên trong nên nó nhận văn bản —
 * một lượt ĐỌC ĐĨA, không phải một lượt spawn.
 */
function gateTrongTienTrinh(taskKey, taskOutputDir, phase) {
  const kq = [];
  const soLieu = { so_case: 0, so_file_md: 0, so_case_execute: 0 };

  /* 1. preflight — require được từ đầu, đã dùng trong `self_review`. */
  try {
    /* eslint-disable-next-line global-require */
    const preflight = require(path.join(__dirname, 'preflight_gate'));
    const r = preflight.runPreflight({ mode: phase === 2 ? 'phase3' : 'generic', task: taskKey });
    kq.push(engine.toResult('preflight', {
      problems: r.problems || [], warnings: r.warnings || [], severity: engine.SEVERITY.P0,
    }));
  } catch (e) {
    kq.push(engine.toResult('preflight', { problems: [`không chạy được: ${e.message}`], severity: engine.SEVERITY.P0 }));
  }

  /* 2. Bộ case: ĐỌC một lượt, PARSE một lượt. */
  const tcDir = path.join(taskOutputDir, 'test-cases');
  const mdFiles = fs.existsSync(tcDir)
    ? fs.readdirSync(tcDir).filter((f) => f.endsWith('.md') && !f.startsWith('~$')).map((f) => path.join(tcDir, f))
    : [];
  soLieu.so_file_md = mdFiles.length;
  const docs = [];
  for (const f of mdFiles) {
    const txt = fs.readFileSync(f, 'utf8');
    docs.push({ file: f, txt, doc: canonical.parseMarkdown(txt) });
    soLieu.so_case += docs[docs.length - 1].doc.tests.length;
  }

  /* 3. design_gate — nhận văn bản, dùng lại đúng chuỗi đã đọc. */
  if (docs.length) {
    /* eslint-disable-next-line global-require */
    const dg = require(path.join(__dirname, 'design_gate'));
    const pb = []; const wn = [];
    for (const d of docs) {
      const r = dg.gateDesign(d.txt);
      pb.push(...(r.problems || [])); wn.push(...(r.warnings || []));
    }
    kq.push(engine.toResult('design:gate', {
      problems: pb, warnings: wn, severity: engine.SEVERITY.P0,
      mauSo: soLieu.so_case, dauVao: soLieu.so_case,
    }));
  } else {
    kq.push(engine.toResult('design:gate', { skipped: true, note: 'không có `test-cases/*.md`' }));
  }

  /* 4. output_gate chế độ row — nhận TỪNG DÒNG đã parse. */
  if (docs.length) {
    /* eslint-disable-next-line global-require */
    const og = require(path.join(__dirname, 'output_gate'));
    const pb = []; const wn = [];
    /*
     * ĐẾM THẬT số dòng đã chấm, không dùng lại `so_case` (§A10.1).
     *
     * Hai con số đó trông như một nhưng không phải: `so_case` là số case parse ra được, còn số dòng đã
     * chấm là số lần `gateTestcaseRow` thực sự chạy. Chúng lệch nhau khi một `doc` parse lỗi giữa
     * đường, và đúng chỗ lệch đó là chỗ gate kiểm ít hơn tưởng mà vẫn xanh.
     */
    let soDongDaCham = 0;
    for (const d of docs) {
      for (const row of d.doc.tests) {
        const r = og.gateTestcaseRow(row);
        soDongDaCham += 1;
        pb.push(...(r.problems || [])); wn.push(...(r.warnings || []));
      }
    }
    kq.push(engine.toResult('gate:gen-testcase', {
      problems: pb, warnings: wn, severity: engine.SEVERITY.P1,
      mauSo: soDongDaCham, dauVao: soLieu.so_case,
    }));
  }

  /* 5. output_gate chế độ execution — chỉ ở Phase 2, và nhận doc đã đọc. */
  if (phase === 2) {
    /* eslint-disable-next-line global-require */
    const og = require(path.join(__dirname, 'output_gate'));
    const pb = []; const wn = [];
    for (const f of timStatus(taskOutputDir)) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
        pb.push(`${path.basename(f)} hỏng JSON: ${e.message}`); continue;
      }
      const r = og.gateTestExecution(doc);
      soLieu.so_case_execute += (Array.isArray(doc) ? doc : (doc.tests || doc.testcases || [])).length;
      pb.push(...(r.problems || [])); wn.push(...(r.warnings || []));
    }
    kq.push(engine.toResult('gate:output', {
      problems: pb, warnings: wn, severity: engine.SEVERITY.P0,
      mauSo: soLieu.so_case_execute, dauVao: soLieu.so_case_execute,
    }));
  }

  /* 6. scope_anchor — nhận thư mục task. */
  try {
    /* eslint-disable-next-line global-require */
    const sa = require(path.join(__dirname, 'scope_anchor'));
    const r = sa.gateScopeAnchor(taskOutputDir);
    kq.push(engine.toResult('scope:anchor', { problems: r.problems || [], warnings: r.warnings || [], severity: engine.SEVERITY.P0 }));
  } catch (e) {
    kq.push(engine.toResult('scope:anchor', { skipped: true, note: `không chạy được: ${e.message}` }));
  }

  return { kq, soLieu };
}

/* ── Gate CÒN PHẢI SPAWN ──────────────────────────────────────────────────────────────────────────── */
/*
 * Bảy máy này chưa require được: không có `require.main` guard, hoặc không export hàm gate. Khai thành
 * DANH SÁCH để con số "còn spawn mấy cái" in ra được — một lời hứa "một tiến trình" mà không đếm được
 * thì không ai kiểm được.
 */
const PHAI_SPAWN = {
  1: [
    { lenh: 'dim:coverage', args: [] },
    { lenh: 'risk:gate', args: [] },
    /*
     * `canonical:check` THAY `canonical:drift` ở đây (v2.8.0 §0c.4), không chạy cả hai.
     *
     * `canonical:check` GỌI LẠI drift để so MD với Excel, rồi thêm hai thứ drift không có: tách lệch
     * NỘI DUNG khỏi lệch KẾT QUẢ (lệch kết quả sau một lượt chạy là HỢP LỆ, chặn nó thì gate đỏ sau
     * mọi lượt execute), và đọc `sync_state.json` cho chân thứ ba là Google Sheet.
     *
     * Giữ cả hai trong danh sách này là chạy drift hai lần cho cùng một kết luận.
     */
    { lenh: 'canonical:check', args: [] },
    { lenh: 'expected:check', args: [] },
    /*
     * `db:paths:check` ở CẢ HAI phase, tầng T0 (v2.8.0 §0b.5).
     *
     * Vì sao cả Phase 1: code tự nối DB hay được viết lúc dò dữ liệu để VIẾT case, không chỉ lúc execute.
     * Và vì sao T0: một đường vòng chạy dưới login `db_owner` trên 888 bảng, ngoài lint và ngoài
     * transaction rollback. Nó không phải chuyện để ghi sổ nợ rồi tính sau.
     */
    { lenh: 'db:paths:check', args: [] },
    /*
     * `steps:lint` ở CẢ HAI phase, tầng T1 (v2.8.0 §C3).
     *
     * T1 chứ không T0: thư viện bước đang được dựng dần, và giữa lúc viết thì một bước chưa hoàn chỉnh là
     * chuyện bình thường. Chỗ phải CHẶN là cửa ra — nên T1 ghi sổ nợ ở phase, và chặn ở `exit:gate`.
     *
     * Vì sao có ở Phase 1: bước mới hay được viết lúc dò màn để VIẾT case, không chỉ lúc execute.
     */
    { lenh: 'steps:lint', args: [] },
    /*
     * `case:paths` ở CẢ HAI phase, tầng T0 (v2.9.2).
     *
     * Quét toàn repo chứ không theo task — nhưng đặt ở đây vì đây là chỗ người ta thật sự chạy. Lớp lỗi
     * nó gác (import lệch hoa-thường) chạy ngon trên Windows/macOS và chỉ chết trên Linux CI, nên nếu
     * chỉ nối vào CI thì người viết code biết mình sai sau khi đã push.
     *
     * Rẻ: 490 đường import, 1,6 giây. Và hôm nay 0 vi phạm — đây là cửa PHÒNG, không phải cửa chữa.
     */
    { lenh: 'case:paths', args: [] },
    /*
     * `ambiguity:gate` CHỈ ở Phase 1, tầng T0 (v2.9.2).
     *
     * Trước đợt này, "DỪNG tới khi `AMBIGUITY_GATE: RESOLVED`" là lời dặn trong workflow mà KHÔNG
     * script nào đọc rồi `exit 1` — đo 16/10/2026: 0 máy. Việc dừng phụ thuộc agent tự tuân thủ.
     *
     * Chạy ở CHẾ ĐỘ DI TRÚ: chỉ chặn ca rõ ràng sai (`PENDING` mà đã có case). Trạng thái lạ hoặc
     * thiếu khoá ⇒ cảnh báo. Đo trên 5 task thật: di trú 0 đỏ, chế độ chặt 2 đỏ — bật chặt ngay sẽ
     * làm đỏ việc đang chạy, và cửa đỏ oan là cửa người ta tắt.
     */
    { lenh: 'ambiguity:gate', args: [] },
  ],
  2: [
    { lenh: 'dim:coverage', args: [] },
    { lenh: 'risk:gate', args: [] },
    { lenh: 'ledger:check', args: [] },
    { lenh: 'typecheck:task', args: [] },
    { lenh: 'canonical:check', args: [] },
    { lenh: 'expected:check', args: [] },
    { lenh: 'db:paths:check', args: [] },
    { lenh: 'steps:lint', args: [] },
    { lenh: 'case:paths', args: [] },
  ],
};

function chaySpawn(phase, taskKey) {
  const ra = [];
  for (const m of (PHAI_SPAWN[phase] || [])) {
    const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', '-s', m.lenh, '--', '--task', taskKey, ...m.args],
      { cwd: REPO, encoding: 'utf8', env: { ...process.env, TASK_KEY: taskKey }, shell: process.platform === 'win32' });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const exit = r.status === null ? 2 : r.status;
    /*
     * exit 2 = KHÔNG PHÁN ĐƯỢC ⇒ `skipped`, kèm lý do. Gộp nó vào `problems` là chặn oan; gộp vào PASS
     * là báo đạt cho một thứ chưa ai kiểm. GateEngine đã có `SKIP` cho đúng trạng thái này.
     */
    if (exit === 2) {
      ra.push(engine.toResult(m.lenh, { skipped: true, note: 'không phán được (thiếu input hoặc chưa áp dụng)' }));
      continue;
    }
    const dong = out.split('\n').map((l) => l.trim()).filter((l) => /^[-·~]|✗|CHẶN|THIẾU/.test(l)).slice(0, 25);
    ra.push(engine.toResult(m.lenh, {
      problems: exit === 1 ? (dong.length ? dong : [`${m.lenh} CHẶN (xem \`npm run ${m.lenh}\` để biết chi tiết)`]) : [],
      warnings: exit === 0 ? dong.filter((l) => l.startsWith('~')) : [],
      severity: engine.SEVERITY.P1,
    }));
  }
  return ra;
}

/* ── `--fix`: TỰ SỬA ĐỊNH DẠNG (§A4) ────────────────────────────────────────────────────────────────
 *
 * Chạy TRƯỚC khi kiểm, vì sửa xong thì phần vi phạm định dạng không còn để báo nữa — đó là cả mục đích.
 *
 * Mỗi lượt sửa ghi DIFF vào `reports/autofix.log`, không chỉ đếm số dòng. Một máy tự sửa testcase mà
 * không để lại dấu vết từng ô là một máy không ai rà lại được, và thứ nó chạm là bộ case quyết định
 * đúng/sai của cả task.
 *
 * `--dry-run` xem trước, không ghi gì. Có nó thì người ta dám chạy `--fix`; không có nó thì họ sẽ không
 * chạy, và luật này thành chữ chết.
 */
function chayFix(taskOutputDir, { dryRun = false } = {}) {
  /* eslint-disable-next-line global-require */
  const autofix = require(path.join(__dirname, 'autofix.js'));
  const tcDir = path.join(taskOutputDir, 'test-cases');
  if (!fs.existsSync(tcDir)) return { doi: [], file: 0 };
  const files = fs.readdirSync(tcDir).filter((f) => f.endsWith('.md') && !f.startsWith('~$'));
  const moiDoi = [];
  let soFileDoi = 0;
  for (const f of files) {
    const duong = path.join(tcDir, f);
    const cu = fs.readFileSync(duong, 'utf8');
    const kq = autofix.suaVanBan(cu);
    if (!kq.doi.length) continue;
    soFileDoi += 1;
    for (const d of kq.doi) moiDoi.push({ ...d, file: f });
    if (!dryRun) fs.writeFileSync(duong, kq.txt, 'utf8');
  }
  if (moiDoi.length && !dryRun) {
    const log = path.join(taskOutputDir, 'reports', 'autofix.log');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const khoi = [
      `=== ${new Date().toISOString()} · ${moiDoi.length} ô sửa ở ${soFileDoi} file`,
      ...moiDoi.map((d) => [
        `  ${d.file}:${d.dong} · ${d.tcId} · ${d.ma} · cột "${d.cot}"`,
        `    - ${d.cu}`,
        `    + ${d.moi}`,
      ].join('\n')),
      '',
    ].join('\n');
    fs.appendFileSync(log, `${khoi}\n`, 'utf8');
  }
  return { doi: moiDoi, file: soFileDoi, dryRun };
}

function inFix(kq) {
  if (!kq.doi.length) {
    console.log('[fix] không có gì để sửa — mọi ô đã đúng định dạng.');
    return;
  }
  const theoMa = {};
  for (const d of kq.doi) theoMa[d.ma] = (theoMa[d.ma] || 0) + 1;
  console.log(`[fix]${kq.dryRun ? ' (DRY-RUN, không ghi gì)' : ''} ${kq.doi.length} ô ở ${kq.file} file:`);
  for (const [ma, n] of Object.entries(theoMa)) console.log(`      ${n}× ${ma}`);
  for (const d of kq.doi.slice(0, 6)) {
    console.log(`      ${d.tcId} · ${d.ma} · "${String(d.cu).slice(0, 48)}" → "${String(d.moi).slice(0, 48)}"`);
  }
  if (kq.doi.length > 6) console.log(`      … (+${kq.doi.length - 6})`);
  if (!kq.dryRun) console.log('      diff đầy đủ: `reports/autofix.log`');
  console.log('      KHÔNG chạm: Kết quả mong đợi (trừ tiền tố số) · Dữ liệu Test · Loại case · Tiền điều kiện.');
}

function main() {
  const maGt = val('explain');
  if (maGt) { giaiThich(maGt); return; }

  /*
   * ── `--override`: VƯỢT QUA CÓ KIỂM SOÁT (§A8) ────────────────────────────────────────────────
   *
   * Đây là đường duy nhất cố tình mở ra trong cả đợt. Bốn hàng rào nằm ở `override.js`, và chúng được
   * kiểm TRƯỚC khi chạm đĩa: T0 bị từ chối mà KHÔNG ghi gì, vì một bản ghi nói "T0 đã được miễn" sẽ
   * được đọc lại sau và lúc đó nó là một tiền lệ.
   */
  const maOv = val('override');
  if (maOv) {
    /* eslint-disable-next-line global-require */
    const ov = require(path.join(__dirname, 'override.js'));
    let tKey;
    try {
      rc.loadEnvFiles();
      tKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    } catch (e) {
      console.error(`[check] ✗ --override cần TASK_KEY: ${e.message}`);
      process.exit(2);
    }
    const tcIds = String(val('tc', '')).split(',').map((x) => x.trim()).filter(Boolean);
    const kq = ov.tao({
      taskKey: tKey, ma: maOv, tcIds, lyDo: val('reason'), by: val('by'), evidence: val('evidence'),
      hanNgay: Number(val('het-han-ngay', String(ov.HAN_MAC_DINH_NGAY))),
    });
    if (!kq.ok) {
      console.error(`[check] ✗ TỪ CHỐI miễn trừ "${maOv}": ${kq.vi_sao}`);
      process.exit(1);
    }
    console.log(`[check] ✓ đã ghi miễn trừ ${kq.ban.id} — ${maOv} cho ${tcIds.join(', ')}, hết hạn ${kq.ban.expires_at}`);
    console.log(`        ${path.relative(REPO, kq.duong).split(path.sep).join('/')}`);
    console.log('        Hết hạn thì gate chặn lại. Gia hạn là một quyết định MỚI, không phải sửa ngày trong file.');
    return;
  }

  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[check] ✗ không xác định được task: ${e.message}`);
    console.error('        Cần TASK_KEY + PROJECT_OUTPUT_DIR (hoặc --task <TASK_KEY>).');
    process.exit(2);
  }

  const ph = nhanPhase(taskOutputDir);
  if (!ph.phase) {
    console.log(`[check] CHƯA BIẾT PHASE — ${ph.vi_sao}.`);
    console.log('        Không mặc định Phase 1: làm thế với một task đã execute là bỏ qua toàn bộ gate về');
    console.log('        evidence và verdict, mà đó đúng là nhóm T0. Sinh case hoặc execute rồi chạy lại.');
    process.exit(2);
  }

  if (process.argv.includes('--fix') || process.argv.includes('--dry-run')) {
    const kq = chayFix(taskOutputDir, { dryRun: process.argv.includes('--dry-run') });
    inFix(kq);
    /* `--dry-run` chỉ xem trước rồi dừng; `--fix` thì chạy tiếp để báo phần CÒN LẠI sau khi sửa. */
    if (process.argv.includes('--dry-run')) return;
    console.log('');
  }

  /*
   * LÀN (§A6) — in ra, và CHƯA đổi tập gate theo nó.
   *
   * Làn quyết ĐỘ SÂU: `lite` bỏ phần mở rộng 5 trục ở Phase 2. Phần đó do `expansion:plan` và
   * `expansion:audit` gác, không do `check` chạy, nên chỗ đúng để áp làn là hai máy kia — sửa chúng là
   * một hạng mục riêng, không gộp vào đây.
   *
   * Nhưng `check` PHẢI in làn, vì nó là lệnh người dùng gõ: thấy `lite` thì họ biết vì sao bảng không
   * nhắc mở rộng, còn không thấy gì thì họ không biết mình đang ở làn nào.
   */
  let lanHienTai = null;
  try {
    /* eslint-disable-next-line global-require */
    const laneLib = require(path.join(__dirname, 'lane.js'));
    const daChot = laneLib.docLan(taskOutputDir);
    const regPath = path.join(taskOutputDir, 'reports', 'risk-register.json');
    const reg = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, 'utf8')) : null;
    const suy = reg ? laneLib.suyLan(reg) : null;
    lanHienTai = {
      chot: daChot && daChot.lan ? daChot.lan : null,
      suy: suy && suy.lan ? suy.lan : null,
      vi_sao: suy ? suy.vi_sao : 'chưa có risk-register.json',
    };
  } catch (e) { lanHienTai = { chot: null, suy: null, vi_sao: `không đọc được làn: ${e.message}` }; }

  const t0 = Date.now();
  const trong = gateTrongTienTrinh(taskKey, taskOutputDir, ph.phase);
  const ngoai = chaySpawn(ph.phase, taskKey);
  const results = [...trong.kq, ...ngoai];
  const agg = engine.aggregate(results);
  const giay = Math.round((Date.now() - t0) / 100) / 10;

  /* ── Áp lớp TẦNG cho từng gate ──────────────────────────────────────────────────────────────────── */
  /*
   * ÁP MIỄN TRỪ CÒN HIỆU LỰC. Chúng chuyển một finding từ "phải sửa" sang "đã vượt qua", KHÔNG xoá nó:
   * con số vẫn in ra, và cửa ra vẫn đọc được. Xoá hẳn thì miễn trừ thành vô hình, và một thứ vô hình
   * thì không ai rà lại.
   */
  let mienTru = [];
  let daVuotQua = [];
  try {
    /* eslint-disable-next-line global-require */
    const ov = require(path.join(__dirname, 'override.js'));
    mienTru = ov.dangHieuLuc(taskKey);
    if (mienTru.length) {
      for (const r of results) {
        const fails = r.findings.filter((f) => f.level === 'FAIL');
        const loc = ov.apDung(fails, mienTru, { maCua: engine.maCua, tcIdTrong: engine.tcIdTrong });
        if (!loc.da_vuot_qua.length) continue;
        daVuotQua.push(...loc.da_vuot_qua.map((f) => ({ ...f, gateId: r.gateId })));
        r.findings = [...loc.con_lai, ...r.findings.filter((f) => f.level !== 'FAIL')];
        r.counts.fail = loc.con_lai.length;
        if (!r.counts.fail) r.status = r.counts.warn ? 'WARN' : 'PASS';
      }
    }
  } catch (e) { /* thiếu lớp miễn trừ thì KHÔNG được che vi phạm — cứ để nguyên */ }

  const theoTang = { T0: [], T1: [], T2: [] };
  let coChan = false;
  for (const r of results) {
    if (!r.counts.fail) continue;
    const t = gateTier.tangCua(r.gateId);
    theoTang[t.tang].push(r);
    const qd = gateTier.quyetDinh(t.tang, NGU_CANH);
    if (qd.chan) coChan = true;
    if (qd.ghiSoNo) {
      const viPham = r.findings.filter((f) => f.level === 'FAIL').map((f) => ({
        ma: engine.maCua(f.message), tcId: engine.tcIdTrong(f.message), thong_diep: f.message,
      }));
      try { gateTier.ghiSoNo(taskOutputDir, r.gateId, viPham, { nguCanh: NGU_CANH }); } catch (e) { /* đã in ở apTang khi dùng đường đó */ }
    }
  }

  const soDat = results.filter((r) => r.status === 'PASS').length;
  const soSkip = results.filter((r) => r.status === 'SKIP');
  /*
   * `CHUA_KIEM` (§A10.1) phải lên DÒNG TỔNG, không chỉ nằm trong `--json`.
   *
   * Nó là trạng thái "gate đã CHẠY nhưng mẫu số 0 hoặc thấp hơn rõ" — tức có thể nó đọc sai tên trường
   * hoặc rơi vào `catch`. Giấu nó xuống dưới nghĩa là người đọc thấy "4 kiểm đạt" rồi đi tiếp, đúng
   * như ba lỗi mà §A10.1 đi vá.
   */
  const chuaKiem = results.filter((r) => r.status === 'CHUA_KIEM');
  const ra = {
    task: taskKey, phase: ph.phase, phase_vi_sao: ph.vi_sao, ngu_canh: NGU_CANH,
    so_lieu: trong.soLieu, giay,
    trong_tien_trinh: trong.kq.length, con_spawn: ngoai.length,
    tong_chan: agg.totalFail, tong_canh_bao: agg.totalWarn, so_kiem_dat: soDat,
    khong_phan_duoc: soSkip.map((r) => r.gateId),
    chua_kiem: chuaKiem.map((r) => ({ gate: r.gateId, mau_so: r.mau_so, dau_vao: r.dau_vao, note: r.note })),
    theo_tang: { T0: theoTang.T0.map((r) => r.gateId), T1: theoTang.T1.map((r) => r.gateId), T2: theoTang.T2.map((r) => r.gateId) },
    chan: coChan,
    lan: lanHienTai,
    mien_tru: mienTru,
    da_vuot_qua: daVuotQua.length,
    results,
  };
  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); process.exit(coChan ? 1 : 0); }

  /* ── BẢNG GỌN ───────────────────────────────────────────────────────────────────────────────────── */
  console.log(`✗ ${agg.totalFail} lỗi phải sửa · ⚠ ${agg.totalWarn} cảnh báo · ✓ ${soDat} kiểm đạt`
    + `${soSkip.length ? ` · ○ ${soSkip.length} không phán được` : ''}`
    + `${chuaKiem.length ? ` · ◌ ${chuaKiem.length} CHƯA KIỂM` : ''}`);
  console.log(`  task ${taskKey} · Phase ${ph.phase} (${ph.vi_sao}) · ngữ cảnh ${NGU_CANH} · ${giay}s`
    + ` · ${trong.soLieu.so_case} case${ph.phase === 2 ? `, ${trong.soLieu.so_case_execute} đã execute` : ''}`);
  console.log(`  ${ra.trong_tien_trinh} gate trong tiến trình · ${ra.con_spawn} còn spawn (xem header check.js)`);
  if (lanHienTai) {
    const l = lanHienTai.chot || lanHienTai.suy;
    console.log(`  làn: ${l ? l.toUpperCase() : 'CHƯA CHỌN'}`
      + `${lanHienTai.chot && lanHienTai.suy && lanHienTai.chot !== lanHienTai.suy ? ` (người chốt ${lanHienTai.chot}, máy suy ${lanHienTai.suy})` : ''}`
      + ` — ${lanHienTai.vi_sao}`);
  }

  for (const tang of ['T0', 'T1']) {
    const ds = theoTang[tang];
    if (!ds.length) continue;
    const qd = gateTier.quyetDinh(tang, NGU_CANH);
    console.log(`\n[${tang}] ${qd.chan ? 'CHẶN' : 'chưa chặn ở ngữ cảnh này — đã ghi sổ nợ, cửa ra sẽ chặn'}`);
    const moi = ds.flatMap((r) => r.findings.filter((f) => f.level === 'FAIL').map((f) => f.message));
    /*
     * `--full` phải nới CẢ HAI chiều, không chỉ số dòng.
     *
     * Bản đầu chỉ nới số dòng mà vẫn in qua `inGon`, nên `--full` ra ĐÚNG BẰNG bản gọn khi số vi phạm
     * còn dưới ngưỡng dòng — đo được: 2.310 byte cả hai. Một cờ `--full` không đổi gì là cờ nói dối:
     * người đọc bật nó lên rồi tin rằng mình đã thấy bản đầy đủ.
     */
    if (FULL) {
      for (const m of moi) console.log(`  ${tang} ${m}`);
    } else {
      engine.inGon(moi.slice(0, SO_DONG), { nhan: tang });
      if (moi.length > SO_DONG) console.log(`     … +${moi.length - SO_DONG} nữa (thêm \`--full\`)`);
    }
  }

  if (daVuotQua.length) {
    console.log(`\n✓ ${daVuotQua.length} vi phạm ĐÃ VƯỢT QUA (miễn trừ T1 còn hiệu lực):`);
    for (const f of daVuotQua.slice(0, 8)) {
      const m = f._mien_tru;
      console.log(`  ${m.ma} · ${m.tc_ids.join(', ')} · ${m.by} · hết hạn ${m.het_han} · ${m.id}`);
    }
    if (daVuotQua.length > 8) console.log(`  … (+${daVuotQua.length - 8})`);
    console.log('  Chúng KHÔNG bị xoá, chỉ chuyển mục — cửa ra vẫn đọc được, và hết hạn thì chặn lại.');
  }

  if (chuaKiem.length) {
    console.log(`\n◌ CHƯA KIỂM — gate đã CHẠY nhưng mẫu số 0 hoặc thấp hơn rõ (${chuaKiem.length}):`);
    for (const r of chuaKiem) console.log(`  ${r.gateId} — ${r.note}`);
    console.log('  Đây KHÔNG phải đạt. Thường là gate đọc sai tên trường, hoặc rơi vào `catch` và tắt lặng lẽ.');
  }

  if (soSkip.length) {
    console.log(`\n○ KHÔNG PHÁN ĐƯỢC — không tính là đạt: ${soSkip.map((r) => `${r.gateId} (${r.note})`).join(' · ')}`);
  }

  console.log('\nsửa: `npm run check -- --explain <CODE>` để biết vì sao và sửa thế nào.');

  /*
   * DÒNG "LỆNH TIẾP THEO" (§A7). Đích của v2.7.0 là người dùng chỉ nhớ NĂM lệnh; sáu lệnh còn lại vẫn
   * cần thiết nhưng không nên cần NHỚ. Chỗ đúng để gợi ý chúng là output của lệnh người ta vừa gõ.
   *
   * Dùng tiến trình con thay vì require: `next_command` đọc `runtime_config` và có đường `process.exit`
   * riêng, nên require nó vào giữa lượt in của `check` là mời một `exit` cắt ngang.
   */
  try {
    const rNext = spawnSync(process.execPath, [path.join(__dirname, 'next_command.js'), '--task', taskKey, '--mot-dong'],
      { cwd: REPO, encoding: 'utf8', env: { ...process.env, TASK_KEY: taskKey } });
    const dongNext = `${rNext.stdout || ''}`.trim();
    if (dongNext) console.log(dongNext);
  } catch (e) { /* gợi ý thiếu thì KHÔNG được làm chết lượt kiểm */ }
  if (coChan) process.exit(1);
}

if (require.main === module) main();

module.exports = { nhanPhase, gateTrongTienTrinh, chaySpawn, PHAI_SPAWN, giaiThich, chayFix };
