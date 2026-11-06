#!/usr/bin/env node
'use strict';

/*
 * inject_context.js (G7 — round-3) — SessionStart hook: bơm DETERMINISTIC context vào MỌI phiên.
 *
 * Chống "miss đọc file" tận gốc: thay vì trông agent tự nhớ đọc rule/config/input, HARNESS bơm sẵn
 * (1) tóm tắt forcing-functions + con trỏ nguồn (CLAUDE.md, verdict_taxonomy) và (2) kết quả preflight
 * config-integrity NGAY tại session start. Không phụ thuộc agent nhớ chạy gì.
 *
 * Wire (.claude/settings.json — local, như gate_on_write):
 *   "SessionStart": [{ "hooks": [{ "type":"command", "command":"node scripts/qa/hooks/inject_context.js" }] }]
 * Đọc stdin (bỏ qua), in JSON {hookSpecificOutput:{hookEventName:'SessionStart', additionalContext}}.
 * Best-effort: mọi lỗi → vẫn in context tối thiểu (không làm hỏng session).
 */

const path = require('path');

let pf = { problems: [], warnings: [] };
try { pf = require(path.resolve(__dirname, '..', 'preflight_gate')).runPreflight({ mode: 'generic' }) || pf; } catch (e) { /* best-effort */ }

const nProb = (pf.problems || []).length;
const cfgLine = nProb
  ? `⚠ CONFIG/CONTEXT có ${nProb} vấn đề (sửa trước khi làm): ${(pf.problems || []).slice(0, 5).join(' · ')}`
  : '✓ config/context integrity OK';

/*
 * ĐÃ GỠ DANH SÁCH TÊN SKILL KHỎI HOOK — 04/11/2026, v2.10.0.
 *
 * Khối cũ bơm 28 tên skill vào MỌI phiên, kèm câu "KHÔNG auto-load — mở file để dùng". Lý do nó tồn
 * tại được ghi ngay ở đây: "skill nằm ở .agent/skills/**, KHÔNG phải .claude/skills/ → harness không
 * tự phát hiện".
 *
 * TIỀN ĐỀ ĐÓ ĐÃ HẾT ĐÚNG. Đo 04/11/2026 ở một phiên mới: `.claude/skills/` có đủ 28 shim và harness
 * quảng bá cả 28, kèm mô tả đầy đủ, gọi được bằng tên qua công cụ `Skill`. Dòng của hook vì thế vừa
 * THỪA, vừa SAI: nó dạy một cách dùng không còn đúng, trong phần mà mọi phiên đều đọc.
 *
 * LÝ DO GỠ LÀ VÌ NÓ SAI, KHÔNG PHẢI VÌ MỘT CON SỐ ĐỊNH TUYẾN.
 *
 * Bản đầu của chú thích này ghi một bảng "có hook 24,3% / gỡ hook 50,0%" và kết luận gỡ dòng ấy làm
 * định tuyến TĂNG GẤP ĐÔI. RÚT LẠI 05/11/2026: cả hai con số lấy từ lượt quét chạy 3 LUỒNG SONG SONG,
 * nơi các phiên model bị throttle và bản đầu của `skills_route_live.js` đếm lượt bị throttle THÀNH
 * "model không gọi skill". Chạy lại tuần tự thì riêng dao động giữa hai lượt CÙNG trạng thái đã tới 8,8
 * điểm (64,7% và 73,5%). Không có phép đo tuần tự trước/sau cho việc gỡ hook, nên con số "gấp đôi"
 * KHÔNG có căn cứ và không được dẫn lại.
 *
 * Điều CÒN đúng: dòng ấy nói "KHÔNG auto-load" về những skill đang được quảng bá là gọi được bằng tên.
 * Một chỉ dẫn sai trong phần mọi phiên đều đọc thì gỡ là đúng, dù nó có ảnh hưởng đo được hay không.
 * Phần luôn nạp giảm 2,01 → 1,23 KB.
 */

const ctx = [
  '[KIT FORCING FUNCTIONS — round-3] Output của bạn bị GATE máy-kiểm (preflight · design_gate · output_gate · risk_gate + harness hook); sai chuẩn = CHẶN, KHÔNG push được. Rule là forcing function, không phải "dặn".',
  'Non-negotiables (đọc): CLAUDE.md. Verdict/rerun (1 nguồn): .agent/config/verdict_taxonomy.json — FAIL bắt buộc kèm failureLayer; rerun 2–3 lần; "không phán được" KHÔNG thành PASS.',
  'TRƯỚC execute (Phase 2): `node scripts/qa/preflight_gate.js --mode phase2 --task <TASK_KEY>` — thiếu input/config hỏng/testcase canonical chưa có = CHẶN.',
  'TRƯỚC sinh case (Phase 1): neo MẪU SỐ trước — `npm run scope:anchor:init` rồi điền `requirements/scope_inventory.md` (mỗi mục kèm nguồn). Không có danh mục thì mọi con số coverage về sau là % của mẫu số do CHÍNH BẠN đặt ra, và "đủ" chỉ còn nghĩa "bạn thấy đủ".',
  'TRƯỚC finalize/publish: `npm run self-review:enforce -- --task <TASK_KEY>` — checklist gộp (preflight+design+row-quality+neo mẫu số+execution+attestation). Dùng bản `:enforce`: bản thường luôn exit 0 nên không chặn được gì.',
  `Preflight config integrity (giờ): ${cfgLine}.`,

].filter(Boolean).join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx },
  suppressOutput: true,
}));
