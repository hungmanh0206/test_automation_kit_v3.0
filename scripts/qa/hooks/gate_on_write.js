#!/usr/bin/env node
'use strict';

/*
 * PostToolUse hook (Write|Edit): mỗi khi agent GHI 1 testcase-status.json hoặc
 * test-cases/*.md, TỰ CHẠY output_gate lên đúng file đó. Đây là lớp harness
 * (bắt cả khi agent bỏ qua script convert/push); gate ở tầng script vẫn là chính.
 *
 * Đọc hook JSON trên stdin: { tool_input: { file_path } }. Không phải file liên quan → exit 0 im lặng.
 *
 * ── PHÂN TẦNG (v2.7.0 §A1) ──────────────────────────────────────────────────────────────────────────
 *
 * Hook này CHỈ CHẶN T0. Lý do không phải tiện cho người dùng, mà là để gate không bị tắt: chặn một lỗi
 * chất lượng ngay giữa lúc đang viết dở buộc người ta dừng việc đang làm để sửa một thứ chưa xong, và
 * làm thế đủ nhiều lần thì họ tìm cách tắt hook — lúc đó mất luôn phần gác đúng.
 *
 * Hai chế độ của `output_gate` thuộc HAI TẦNG khác nhau, nên hook đối xử khác nhau:
 *
 *   · `--mode test-execution`  → **T0**. Nó gác evidence (non-negotiable §4: case đã execute phải có
 *     ảnh hoặc video), FAIL phải có tầng lỗi, và oracle không được rỗng hay tautology. Ghi một verdict
 *     không có evidence là tạo ra một kết luận không ai kiểm được — chặn NGAY, mọi ngữ cảnh.
 *   · `--mode gen-testcase`    → **T1**. Nó gác chất lượng dòng testcase. Bộ case đang viết dở thì
 *     thiếu sót là bình thường; chỗ phải chặn là CỬA PUBLISH, không phải giữa lúc gõ.
 *
 * T1 KHÔNG CHẶN NHƯNG PHẢI GHI SỔ. Cảnh báo rồi quên thì đến cửa ra không ai biết đã từng có bao nhiêu
 * vi phạm — "chưa chặn" sẽ âm thầm thành "đã bỏ". Nên vi phạm T1 đi vào `reports/gate-debt.json`, và
 * cửa ra đọc sổ đó.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const gateTier = require(path.resolve(__dirname, '..', 'lib', 'gate_tier.js'));

function emit(obj) { process.stdout.write(JSON.stringify(obj)); process.exit(0); }

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (e) { /* no stdin */ }
let data = {};
try { data = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); }

const fp = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
if (!fp) process.exit(0);
const norm = String(fp).replace(/\\/g, '/');

let args = null;
let gateId = null;
/* `--compact` ở ĐÂY là chỗ đáng nhất trong kit: output của hook đi THẲNG vào context của agent qua
 * `reason`, mỗi lần ghi file. Đo trên bộ 265 case thật: 10.696 byte xuống 1.870 byte, giảm 82%. Và
 * `--compact` là lớp trình bày, không lọc — mọi vi phạm vẫn có mặt, xem compact-mode.spec.ts. */
if (/testcase-status\.json$/i.test(norm)) {
  args = ['--mode', 'test-execution', '--status', fp, '--compact'];
  gateId = 'gate:output';
} else if (/\/test-cases\/[^/]+\.md$/i.test(norm)) {
  args = ['--mode', 'gen-testcase', '--file', fp, '--compact'];
  gateId = 'gate:gen-testcase';
}
if (!args) process.exit(0);           // không phải artifact cần gate
if (!fs.existsSync(fp)) process.exit(0);

/*
 * Thư mục task suy TỪ ĐƯỜNG DẪN FILE, không từ env.
 *
 * Hook chạy trong tiến trình riêng do harness gọi, nên `TASK_KEY` và `PROJECT_OUTPUT_DIR` có thể không
 * có ở đó. Nhưng đường dẫn file luôn có dạng `<...>/tasks/<TASK_KEY>/test-cases/x.md` hoặc
 * `<...>/tasks/<TASK_KEY>/test-results/testcase-status.json`, nên thư mục task là cha của cha. Suy từ
 * đường dẫn thì sổ nợ luôn vào ĐÚNG task của file vừa ghi, kể cả khi env trỏ task khác.
 */
function thuMucTask(duong) {
  const d = path.dirname(path.resolve(duong));
  const cha = path.dirname(d);
  return /[/\\]tasks[/\\][^/\\]+$/.test(cha.replace(/\\/g, '/')) || fs.existsSync(path.join(cha, 'test-cases')) ? cha : null;
}

const gate = path.resolve(__dirname, '..', 'output_gate.js');
try {
  execFileSync(process.execPath, [gate, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  process.exit(0); // gate PASS (gen-testcase: cảnh báo ";" KHÔNG làm exit≠0)
} catch (e) {
  const out = `${(e.stdout || '').toString()}${(e.stderr || '').toString()}`.trim();

  let tang = 'T0';
  try { tang = gateTier.tangCua(gateId).tang; } catch (err) { tang = 'T0'; }

  /*
   * BẢNG TẦNG HỎNG THÌ CHẶN, không cho qua. Đây là chỗ duy nhất trong lớp tầng chọn phía "chặn" khi
   * không đọc được config: hook là lớp cuối trước khi một artifact sai nằm trên đĩa, và cho qua vì
   * "không đọc được bảng" là biến một lỗi cấu hình thành một lỗ gác.
   */
  if (tang === 'T0') {
    emit({
      decision: 'block',
      reason: `[output_gate] Vi phạm T0 ở ${path.basename(fp)} — SỬA cho đúng RULE_GLOBAL rồi tiếp tục (đừng push/convert kèm vi phạm):\n${out}`,
      suppressOutput: true,
    });
  }

  /* T1: không chặn, nhưng phải để lại dấu vết — và dấu vết đó là sổ nợ, không phải một dòng log. */
  const taskDir = thuMucTask(fp);
  let soMon = null;
  if (taskDir) {
    try {
      const r = gateTier.ghiSoNo(taskDir, gateId, [{ ma: 'HOOK_WRITE', thong_diep: out.split('\n')[0] || 'vi phạm chất lượng' }], { nguCanh: 'write' });
      soMon = r.so_mon;
    } catch (err) { soMon = null; }
  }

  /*
   * MỘT DÒNG, theo §A1. Nhưng nếu KHÔNG ghi được sổ thì phải nói ra: lúc đó cửa ra sẽ không thấy vi
   * phạm này, nên "đã cảnh báo" đúng nghĩa là "đã bỏ".
   */
  const dong = soMon !== null
    ? `[output_gate] ⚠ T1 ở ${path.basename(fp)} — chưa chặn lúc đang viết, đã ghi sổ nợ (${soMon} món). Cửa publish sẽ chặn. Xem: npm run gate:output -- --mode gen-testcase --file ${path.basename(fp)}`
    : `[output_gate] ⚠ T1 ở ${path.basename(fp)} — chưa chặn, và KHÔNG ghi được sổ nợ (không tìm ra thư mục task). Cửa ra sẽ không thấy vi phạm này.`;
  emit({ reason: dong, suppressOutput: true });
}
