# Bản đồ LUẬT → GATE → SPEC

> **SINH TỰ ĐỘNG** bởi `node scripts/qa/rule_coverage.js --write`. Đừng sửa tay — `--check` chặn khi
> bảng lệch nguồn.

Trang này trả lời một câu mà không chỗ nào khác trả lời được: **luật nào đang có máy thi hành, và
luật nào chỉ nói bằng chữ.** Thiếu câu đó thì "kit có nhiều gate" nghe như một bảo đảm, trong khi nó
không nói gì về việc những gate đó phủ đúng chỗ nào.

## Giới hạn của phép nối, đọc trước khi dùng số ở đây

Nối bằng cách tìm **tên lệnh gate** trong văn bản của mục luật. Nên:

- mục luật nhắc tên lệnh thì nối được, và nối đó **chắc**;
- mục luật **không** nhắc tên lệnh thì bảng ghi `chưa nối được`, và đó **KHÔNG** phải "không có gate".

Ví dụ cụ thể: `secret:scan` chặn theo mục Security mà mục đó không nhắc tên lệnh. Luật *có* máy, chỉ là
không nhắc tên. Đã đo trên bản máy của `gate:policy`: đòi luật canonical nhắc TÊN mọi lệnh thì **19/24
script báo oan**. Nên con số `chưa nối được` ở dưới là **việc cần rà**, không phải một lỗ đã chứng minh.

Nguồn: `RULE_GLOBAL.md` (35 mục có nội dung) · 144 gate · 152 spec hạ tầng.

## Mục luật ĐÃ nối được gate (29)

| Mục luật | Gate thi hành | Spec canh gate |
|---|---|---|
| Purpose | `rule` · `report` | `api-card.spec.ts` · `backlog-bug-images.spec.ts` · `bug-layer-gate.spec.ts` +67 |
| When To Use | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Inputs | `profile:create` | `start-command.spec.ts` |
| Outputs | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Giọng văn output | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Thân bug Backlog — viết cho DEV đọc, không phải cho máy đọc | `gate:output` · `writing:lint` · `report` | `check-command.spec.ts` · `checks-l4.spec.ts` · `dimension-threshold.spec.ts` +50 |
| Language | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Security | `gate:output` · `report` | `check-command.spec.ts` · `checks-l4.spec.ts` · `dimension-threshold.spec.ts` +48 |
| Project And Output | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Parallel Story Safety | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Phase-Separated Story Execution | `merge:execution-status` · `canonical:drift` · `check` · `expected:check` · `load` · `gate:policy` · `ledger:check` · `risk` · `sync:canonical` · `report` | `canonical-drift.spec.ts` · `expansion-gates.spec.ts` · `manual-run-gate.spec.ts` +114 |
| Task-Scoped Automation Code | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Shared Change Gate | `dim:coverage` · `domain:check` · `rule` · `secret:scan` | `config-presence.spec.ts` · `dimension-threshold.spec.ts` · `dimension-wiring.spec.ts` +47 |
| Automation Promote Review | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Analysis & Ambiguity Gate (Phase 1 — đọc kỹ, hỏi trước khi gen) | `rule` · `report` | `api-card.spec.ts` · `backlog-bug-images.spec.ts` · `bug-layer-gate.spec.ts` +67 |
| Chiều coverage (Phase 1 — khai phạm vi, gắn tag, có máy đếm) | `dim:coverage` · `domain:check` · `rule` | `config-presence.spec.ts` · `dimension-threshold.spec.ts` · `dimension-wiring.spec.ts` +46 |
| 7 trục mở rộng quanh case + luật đóng vòng (Phase 2 — có máy đứng sau) | `authz:expand` · `check` · `xsurf:diff` · `design:gate` · `discover` · `expansion:audit` · `expansion:plan` · `ui:contract` · `fixture:matrix` · `lane` · `leak:report` · `load` · `mutation:check` · `oracle:calc` · `probe:persist` · `risk` · `rule` · `self-review` · `spec:extract` · `spec:gap` · `report` | `authz-expand.spec.ts` · `autofix.spec.ts` · `bug-claim.spec.ts` +128 |
| Execute Results | `rule` · `report` | `api-card.spec.ts` · `backlog-bug-images.spec.ts` · `bug-layer-gate.spec.ts` +67 |
| Phân tầng lỗi FE hay BE — bắt buộc kiểm API trước khi kết luận | `load` | `agent-routing.spec.ts` · `auth-session-lock.spec.ts` · `automation-review.spec.ts` +41 |
| Evidence — Quy chuẩn bắt buộc | `load` · `gate:output` · `rule` · `report` | `agent-routing.spec.ts` · `auth-session-lock.spec.ts` · `automation-review.spec.ts` +96 |
| Bug Claim Gate — kiểm chứng phải đi TRƯỚC lời nói | `bug:claim` · `check` · `spec:gap` · `report` | `bug-claim.spec.ts` · `bug-retest.spec.ts` · `autofix.spec.ts` +96 |
| Retest một bug đã log (thêm 10/10/2026, v2.5.0 G1.8) | `bug:claim` · `check` | `bug-claim.spec.ts` · `bug-retest.spec.ts` · `autofix.spec.ts` +78 |
| Backlog Bug Gate | `load` | `agent-routing.spec.ts` · `auth-session-lock.spec.ts` · `automation-review.spec.ts` +41 |
| Executable QA capabilities (autonomy & safety) | `check` · `dashboard` · `learn` · `load` · `gate:output` · `perf` · `risk` · `rule` · `security` · `report` | `autofix.spec.ts` · `bug-claim.spec.ts` · `bug-retest.spec.ts` +124 |
| Automation quality | `auto:review` · `check` · `gate:friction` · `golden:check` · `judge` · `rule` | `automation-review.spec.ts` · `checks-l4.spec.ts` · `expected-ledger.spec.ts` +95 |
| Push execution | `merge:execution-status` | `canonical-drift.spec.ts` · `expansion-gates.spec.ts` · `manual-run-gate.spec.ts` +2 |
| Workflow | `report` | `ambiguity-gate.spec.ts` · `autofix.spec.ts` · `backlog-bug-images.spec.ts` +40 |
| Chi phí một lượt chạy — đếm SỐ LƯỢT, không đếm độ dài | `prompt:budget` · `rerun:failed` · `token:audit` | `agent-routing.spec.ts` · `discovery-cli.spec.ts` · `load-map.spec.ts` +8 |
| References | `rule` | `api-card.spec.ts` · `backlog-bug-images.spec.ts` · `bug-layer-gate.spec.ts` +35 |

## Mục luật CHƯA nối được gate bằng tên lệnh (6)

Không nối được là **ba chuyện khác nhau**, và ba chuyện đó cần ba cách sửa khác nhau. Nhãn ở cột cuối
là **lời khai của người**, nạp từ `.agent/config/rule_coverage_notes.json`:

- `co_may_khong_nhac_ten` — Luật CÓ máy thi hành, chỉ là mục luật không nhắc tên lệnh. Sửa: thêm tên lệnh vào mục luật.
- `do_duoc_ma_chua_co_may` — Luật ĐO ĐƯỢC bằng máy nhưng chưa có máy nào. Đây là lỗ thật, không phải giới hạn của phép nối.
- `khong_do_duoc_bang_may` — Luật nói về phán đoán hoặc cách làm việc, không quy về một phép đo. Thuộc §A11 (chấm bằng subagent + hiệu chuẩn).
- `khong_phai_luat` — Mục minh hoạ hoặc dẫn chiếu, không mang luật nào riêng.

Một ô `CHƯA RÀ` nghĩa là mục luật đó mới xuất hiện và chưa ai phân loại — không phải "không có lỗ".

| Mục luật | Số từ | Loại | Khai |
|---|---|---|---|
| Execution Discipline (Kỷ luật thực thi — chạy thông suốt) | 341 | `khong_do_duoc_bang_may` | Hai vế, và chúng khác nhau. Vế 'batch tối đa mỗi lượt, không lắt nhắt' nói về CÁCH LÀM của agent: không có artifact nào ghi lại 'lẽ ra gom được bao nhiêu case vào một lượt', nên không có mẫu số để đo — thuộc §A11. Vế 'không TODO/SKIP khi chưa thử' thì có máy một phần: `gate:output` đòi evidence cho mọi case đã execute, và `result_ledger` đối soát verdict với file status, nên một case khai SKIP mà thật ra chưa thử vẫn lọt được. |
| Comment kết quả (Test Execution) — Quy chuẩn trình bày | 270 | `co_may_khong_nhac_ten` | `gate:output` (`scripts/qa/output_gate.js` + `scripts/qa/lib/output_rules.js`) thi hành đúng mục này: cấm dán `key=value`, cấm dump state, cấm mở đầu bằng `[PASS]`. Mục luật mô tả yêu cầu mà không nhắc tên lệnh, nên phép nối theo tên không thấy. |
| Reporting | 141 | `co_may_khong_nhac_ten` | Phần 'FAIL phải ghi đủ năm thứ' nằm ở `.agent/config/verdict_taxonomy.json` (`failureLayer` bắt buộc) và được `gate:output` gác. Phần 'tiếng Việt có dấu, không trộn tiếng Anh' do `writing:lint` gác trên tập tài liệu đã khai. Phần 'SKIP phải ghi điều kiện để chạy được' là chỗ yếu nhất: máy đòi có lý do, không đòi lý do đó nêu được điều kiện. |
| Setup Strategy | 132 | `co_may_khong_nhac_ten` | Khuôn `[<method>]` của ô `Tiền điều kiện` được `scripts/lib/testcase/validate.js` kiểm và `tc:review` báo. Luật 'KHÔNG dựng state bằng DB' thì không có máy: `uatDbClient` chỉ chặn câu lệnh không phải SELECT, nên một precondition khai `[api]` mà thật ra dựng bằng SELECT + giả định vẫn lọt — chỗ này thuộc §A11. |
| Cleanup Rules | 247 | `co_may_khong_nhac_ten` | Mục này từng là mục DUY NHẤT thuộc loại `do_duoc_ma_chua_co_may`, và chính nhãn đó dẫn tới việc viết `cleanup:check` (v2.7.0). Máy quét root repo và subfolder CẤP 1 theo đúng bảng pattern của luật (`scratch_*`, `*_debug.txt`, `*.tmp`, `page_snapshot.md`…), bỏ qua đúng bảng "Không xóa" (`outputs/`, `node_modules/`, `*.config.ts`, `package.json`). Chạy `--enforce` ở cả hai CI. `secret:scan` không thay được: nó tìm secret trong NỘI DUNG, còn một dump swagger không chứa secret nào vẫn là rác lọt lưới mang email/SĐT trong giá trị mẫu. Mục luật không nhắc tên lệnh nên phép nối theo tên vẫn không thấy. |
| Examples | 48 | `khong_phai_luat` | Bảng Good/Bad minh hoạ cho các mục khác (PROJECT_OUTPUT_DIR, đường evidence, Backlog bug gate). Không mang luật riêng nào, nên không có gate riêng là đúng. |
