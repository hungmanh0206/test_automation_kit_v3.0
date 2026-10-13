#!/usr/bin/env node
'use strict';
/*
 * replay:check — ĐO SỐ LẦN PHẢI GỌI AI ĐỂ CHẠY LẠI MỘT TASK KHÔNG ĐỔI (v2.8.0 §F).
 *
 * §7 của thiết kế hứa "chạy lại không thay đổi ⇒ 0 lời gọi AI". Lời hứa đó chỉ có nghĩa khi có một phép
 * đo, vì nó dễ đúng trên giấy: ai cũng thấy "spec đã có rồi thì chạy thôi". Chỗ nó vỡ nằm ở những thứ
 * KHÔNG nằm trong spec — một `TODO-STEP` chờ người viết, một `fuzzy` chờ ai đó chọn mã, một bước `draft`
 * chưa ai kiểm chứng. Mỗi thứ đó là một lượt phải gọi model, và lượt đó không hiện ra ở đâu cả.
 *
 * NÊN SCRIPT NÀY ĐẾM, KHÔNG TUYÊN BỐ. Nó in ra con số "N lượt cần người/model quyết" kèm từng chỗ, và
 * `--enforce` chặn khi N > 0.
 *
 * BỐN NGUỒN TỐN LƯỢT, đo được từ artifact trên đĩa:
 *
 *   1. `TODO-STEP` trong spec biên dịch — câu bước chưa có bước nào phủ, phải viết mới.
 *   2. `TODO-ORACLE` — dòng kỳ vọng máy không neo được, phải người đọc đặc tả.
 *   3. `TODO-SETUP` — tiền điều kiện chưa nối được tới factory/hook.
 *   4. Mệnh đề `fuzzy` khi khớp lại bộ case — mỗi mệnh đề là một lượt chọn giữa các ứng viên.
 *
 * KHÔNG TÍNH là tốn lượt: bước `draft`. Nó là rủi ro về KẾT LUẬN (không được dùng để phán PASS), không
 * phải chi phí để CHẠY. Trộn hai thứ đó lại thì con số mất nghĩa. Nhưng vẫn in ra, ở mục riêng.
 *
 * Dùng: node scripts/qa/reuse/replay_check.js [--task <K>] [--md <file>] [--enforce] [--json]
 * Exit: 0 · 1 khi `--enforce` và còn lượt phải gọi AI · 2 khi không đo được (CHƯA ĐƯỢC GÁC)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const cc = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_check.js'));

/** Đếm TODO theo loại trong spec biên dịch của một thư mục. */
function demTodo(goc) {
  const ra = { TODO_STEP: [], TODO_ORACLE: [], TODO_SETUP: [], so_file: 0, so_case: 0, so_case_du: 0, case_skip_khac: [] };
  const quet = (d) => {
    let muc;
    try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const f of muc) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { quet(p); continue; }
      if (!/\.spec\.ts$/.test(f.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (!src.includes(cc.DAU_SINH)) continue;
      ra.so_file += 1;
      const rel = path.relative(REPO, p).replace(/\\/g, '/');
      const { ds } = cc.tachCase(src);
      ra.so_case += ds.length;
      for (const c of ds) {
        if (!cc.RE_TODO.test(c.than)) {
          /*
           * KHÔNG CÓ TODO VẪN CHƯA CHẮC CHẠY ĐƯỢC NGAY. Một case có thể là `test.skip` vì lý do khác —
           * điển hình là nó gọi một bước còn `draft`. Đếm nó vào "đủ" là khai một case chạy được trong
           * khi Playwright sẽ bỏ qua nó, và con số "N case chạy được ngay" thành con số sai.
           */
          if (c.co_skip) ra.case_skip_khac.push({ file: rel, tcId: c.ten });
          else ra.so_case_du += 1;
          continue;
        }
        for (const dong of c.than.split('\n')) {
          const m = /\bTODO-(STEP|ORACLE|SETUP)\b(.*)$/.exec(dong);
          if (!m) continue;
          ra[`TODO_${m[1]}`].push({ file: rel, tcId: c.ten, noi_dung: m[2].trim().slice(0, 80) });
        }
      }
    }
  };
  quet(goc);
  return ra;
}

function dungDo({ taskKey, taskOutputDir, duongMd, gocSpec }) {
  const danhMuc = sm.napDanhMuc();
  if (!danhMuc) return { loi: 'khong-co-danh-muc' };

  /* Phần 1–3: đọc spec ĐÃ BIÊN DỊCH. */
  const todo = demTodo(gocSpec);

  /* Phần 4: khớp lại bộ case để đếm `fuzzy`. Đây là phép đo ĐỘC LẬP với spec đã sinh — nó trả lời
   * "nếu biên dịch LẠI hôm nay thì còn bao nhiêu chỗ phải chọn", tức chi phí của một lượt sinh lại. */
  const khop = sm.dungDo({ taskKey, taskOutputDir, nguong: sm.NGUONG_MAC_DINH, duongMd });

  const luot = {
    TODO_STEP: todo.TODO_STEP.length,
    TODO_ORACLE: todo.TODO_ORACLE.length,
    TODO_SETUP: todo.TODO_SETUP.length,
    fuzzy: khop.loi ? null : khop.fuzzy,
  };
  const tong = luot.TODO_STEP + luot.TODO_ORACLE + luot.TODO_SETUP + (luot.fuzzy || 0);

  /* Bước `draft` — in riêng, KHÔNG cộng vào con số. Xem ghi chú đầu file. */
  const draft = danhMuc.buoc.filter((b) => b.status === 'draft').map((b) => b.id);

  return {
    task: taskKey,
    goc_spec: path.relative(REPO, gocSpec).replace(/\\/g, '/'),
    so_file_spec: todo.so_file,
    so_case_spec: todo.so_case,
    so_case_du: todo.so_case_du,
    case_skip_khac: todo.case_skip_khac,
    luot_can_ai: luot,
    tong_luot_can_ai: tong,
    chi_tiet: { TODO_STEP: todo.TODO_STEP.slice(0, 10), TODO_ORACLE: todo.TODO_ORACLE.slice(0, 10), TODO_SETUP: todo.TODO_SETUP.slice(0, 10) },
    khop: khop.loi ? { loi: khop.loi } : { so_menh_de: khop.so_menh_de, exact: khop.exact, fuzzy: khop.fuzzy, none: khop.none },
    buoc_draft: draft,
  };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const duongMd = val('md');
  let taskKey = val('task');
  let taskOutputDir = null;

  if (!duongMd) {
    try {
      rc.loadEnvFiles();
      taskKey = taskKey || process.env.TASK_KEY || rc.getTaskKey();
      taskOutputDir = rc.getTaskOutputDir({ taskKey });
    } catch (e) {
      console.error(`[replay-check] CHƯA ĐƯỢC GÁC — không xác định được task: ${e.message}`);
      process.exit(2);
    }
  }
  const gocSpec = val('goc')
    ? path.resolve(REPO, val('goc'))
    : path.join(taskOutputDir || REPO, 'automation', 'compiled');

  const d = dungDo({ taskKey: taskKey || '(theo --md)', taskOutputDir, duongMd, gocSpec });
  if (d.loi === 'khong-co-danh-muc') {
    console.error('[replay-check] CHƯA ĐƯỢC GÁC — không đọc được `tests/fe/lib/step_catalog.json`.');
    process.exit(2);
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify(d, null, 2));
    process.exit(argv.includes('--enforce') && d.tong_luot_can_ai > 0 ? 1 : 0);
  }

  if (!d.so_file_spec) {
    /*
     * 0 spec biên dịch là PHÉP ĐO HỎNG, không phải "chạy lại miễn phí". Đây đúng là chỗ lời hứa "0 lời
     * gọi AI" dễ được đọc thành đã đạt: không có spec nào thì tất nhiên không có TODO nào.
     */
    console.error(`[replay-check] CHƯA ĐO ĐƯỢC — 0 spec biên dịch ở ${d.goc_spec}.`);
    console.error('               Đây KHÔNG phải "chạy lại tốn 0 lượt AI", mà là "chưa có gì để chạy lại".');
    console.error('               Chạy `compile:spec` trước, hoặc chỉ đúng chỗ bằng `--goc <dir>`.');
    process.exit(2);
  }

  const l = d.luot_can_ai;
  console.log(`[replay-check] Task ${d.task} · ${d.so_file_spec} file · ${d.so_case_spec} case (${d.so_case_du} case đủ, chạy được ngay)`);
  console.log('');
  console.log(`  TỔNG LƯỢT CẦN GỌI AI để chạy lại: ${d.tong_luot_can_ai}`);
  console.log(`    TODO-STEP   ${String(l.TODO_STEP).padStart(5)}   câu bước chưa có bước nào phủ`);
  console.log(`    TODO-ORACLE ${String(l.TODO_ORACLE).padStart(5)}   dòng kỳ vọng máy không neo được`);
  console.log(`    TODO-SETUP  ${String(l.TODO_SETUP).padStart(5)}   tiền điều kiện chưa nối tới factory/hook`);
  console.log(`    fuzzy       ${String(l.fuzzy === null ? '—' : l.fuzzy).padStart(5)}   mệnh đề cần CHỌN mã nếu biên dịch lại`);

  if (d.khop.loi) {
    console.log('');
    console.log(`  ⚠ không khớp lại được bộ case (${d.khop.loi}) ⇒ cột \`fuzzy\` là CHƯA ĐO, không phải 0.`);
  }

  for (const [loai, ds] of Object.entries(d.chi_tiet)) {
    if (!ds.length) continue;
    console.log('');
    console.log(`  ${loai} (${ds.length} chỗ đầu):`);
    for (const x of ds) console.log(`    ${x.tcId.slice(0, 44)}  ${x.noi_dung}`);
  }

  if (d.case_skip_khac.length) {
    console.log('');
    console.log(`  ~ ${d.case_skip_khac.length} case KHÔNG còn TODO nào nhưng vẫn là \`test.skip\` — Playwright sẽ bỏ qua chúng.`);
    console.log('    Thường là vì case gọi một bước còn `draft`. Chúng KHÔNG tính vào "case chạy được ngay".');
  }

  if (d.buoc_draft.length) {
    console.log('');
    console.log(`  ~ ${d.buoc_draft.length} bước còn \`draft\` — KHÔNG tính vào con số trên.`);
    console.log('    Đó là rủi ro về KẾT LUẬN (chưa kiểm chứng thì không dùng để phán PASS), không phải');
    console.log('    chi phí để CHẠY. Trộn hai thứ lại thì con số mất nghĩa.');
  }

  console.log('');
  if (d.tong_luot_can_ai === 0) {
    console.log('✓ Chạy lại task này KHÔNG cần lượt gọi AI nào — mọi case đều đủ artifact trên đĩa.');
  } else {
    console.log(`✗ Chạy lại task này còn cần ${d.tong_luot_can_ai} lượt người/model quyết.`);
    console.log('  Lời hứa "chạy lại = 0 lời gọi AI" CHƯA đạt cho task này, và con số trên là khoảng cách.');
  }

  if (argv.includes('--enforce') && d.tong_luot_can_ai > 0) process.exit(1);
}

if (require.main === module) main();

module.exports = { dungDo, demTodo };
