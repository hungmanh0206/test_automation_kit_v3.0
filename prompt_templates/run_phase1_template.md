# Prompt chạy Phase 1 - Sinh testcase

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Non-negotiables ở `CLAUDE.md` (auto-load), digest ở
> `.agent/rules/core_rules.md`. Mở `RULE_GLOBAL.md` **đúng mục `§` digest chỉ ra**, đừng nạp cả file.

Dùng prompt này để collect context và sinh hoặc cập nhật testcase. Đây là template dùng chung, phải thay các placeholder trước khi chạy. Không execute automation trong Phase 1.

## Bản đồ prompt Phase 1 — file này là ĐIỂM VÀO DUY NHẤT

Chỉ cần đọc file này; nó chỉ ra mở file nào ở bước nào. **Không nạp sẵn cả 7 file.** Mở đúng cái đang cần, đúng lúc cần (riêng `02_gen_testcases.md` đã 77KB, dù đã tách 3,7k phần định dạng output sang `02b`).

| Prompt | Bắt buộc? | Mở khi nào |
|---|---|---|
| [`phase1/01_setup_engine_fetch_docs.md`](phase1/01_setup_engine_fetch_docs.md) | khuyến nghị | **Bước 1** — checklist đọc tài liệu đầy đủ + spec `snapshot_context.json`. Bước 1 dưới đây chỉ tóm ý |
| [`phase1/02_gen_testcases.md`](phase1/02_gen_testcases.md) | **BẮT BUỘC** | **Bước 3** — toàn bộ chuẩn sinh TC: 10 cột canonical, `Ưu tiên` §7/§7b, 18 nhóm coverage, cách dựng tiền điều kiện |
| [`phase1/dimensions/*.md`](phase1/dimensions/) | **mở đúng chiều `required`** | **Bước 3, sau khi khai manifest** — 22 chương chiều (§3–§25), tách khỏi `02` để không gánh 9,9k cho chiều task không dùng. Thứ tự: khai `requirements/dimension_manifest.json` → mở chiều `required` → sinh case có tag §0b → `npm run dim:coverage -- --enforce`. Bảng chiều→tag→file ở `02` |
| [`phase1/02b_output_format.md`](phase1/02b_output_format.md) | **BẮT BUỘC ở CUỐI lượt** | **Bước cuối** — Phase 1 Summary Report + Export Excel. Tách khỏi `02` để bỏ **3,7k token** khỏi lúc đang sinh case: đây là định dạng OUTPUT, không phải luật nội dung case. Cả hai có gate đứng sau (`design_gate` trong `md_to_xlsx`, `self_review` đọc Summary Report) nên bỏ qua là bị chặn |
| [`phase1/03_gen_test_data.md`](phase1/03_gen_test_data.md) | khi cần | Cần **bảng test data riêng** + `DataGenerator` cho Phase 2 (4 nhóm data, đặt tên traceable, `Data State` khớp Setup Strategy). Nếu chỉ cần cột "Dữ liệu Test" trong TC thì §4 của `02` là đủ |
| [`phase1/04_auto_publish_backlog.md`](phase1/04_auto_publish_backlog.md) | **BẮT BUỘC** khi publish | **Bước sau QA duyệt** — đẩy TC lên **Google Sheet** qua Drive MCP |
| [`phase1/05_manual_quick.md`](phase1/05_manual_quick.md) | nhánh thay thế | Requirement đã RÕ và chỉ cần bộ TC **chạy tay** nhanh — KHÔNG nhắm automation. Requirement còn mơ hồ hoặc cần TC cho automation thì **đừng** dùng nhánh này |
| [`phase1/06_cross_module.md`](phase1/06_cross_module.md) | khi cần | Scope chạm nhiều module/hệ thống, cần ma trận tổ hợp |

**Chi tiết từng bước** nằm ở [`.agent/workflows/phase1_generate_tc.md`](../.agent/workflows/phase1_generate_tc.md), gồm khuôn mẫu output, Coverage Map, Precondition Execution Matrix và capability-request. Đó là file tổng quan, bên trong liệt kê đủ step `phase1_01` đến `phase1_04`.

Riêng [`phase1_00_scope_planning.md`](../.agent/workflows/phase1_00_scope_planning.md) dùng khi cần khoanh scope và chấm risk trước. Thứ tự bước cùng lệnh gate thì lấy ở ngay file này.

## Gate bắt buộc chạy trong Phase 1

Lệnh chỉ nằm ở `.agent/workflows/` thì không ai chạy. Luôn truyền `TASK_ENV=profiles/<TASK_KEY>/task.env`.

| Khi nào | Lệnh | Nó chặn/sinh ra gì |
|---|---|---|
| **Ngay sau khi kéo tài liệu về, TRƯỚC khi đọc** | `npm run docs:budget` (thêm `--contract` nếu có file >25k) | Đo từng tài liệu → đọc trực tiếp / chỉ mục cần / **giao subagent trích**. Bắt 2 bẫy đo thật: tài liệu có **nhiều bản** (đọc bản dư = tốn ~670k token) và **bản cũ nhỏ hơn hẳn bản mới = bản THIẾU nội dung** (đọc nó là đọc thiếu spec) |
| **Bước 0** | `npm run discover -- --pham-vi <regex>` | Mẫu số từ thứ **quan sát được**. Chạm UAT: xác nhận trước. Xem workflow Bước 0 |
| **Đầu phase** | `npm run scope:anchor:init` → điền `requirements/scope_inventory.md` | **Neo mẫu số trước, sinh case sau.** Mỗi mục kèm nguồn (file#anchor); màn và API lấy từ Bước 0, không tự liệt kê |
| **TRƯỚC khi sinh case** | `npm run ambiguity:gate` | **CHẶN** khi `AMBIGUITY_GATE: PENDING` mà task đã có case. Trạng thái hợp lệ + nghĩa vụ: `.agent/config/ambiguity_states.json` |
| Đầu phase, trước khi phân tích | `npm run risk` | Risk register theo module — quyết định độ sâu test (RBT). Không có thì gen dàn đều, chỗ rủi ro cao bị test nông |
| Khi chuẩn bị context | `npm run domain:check` · `npm run system:check` | Đối chiếu business rule + bản đồ hệ thống đã xác nhận trong `knowledge/` — đây là nguồn oracle độc lập, tra trước để không suy oracle từ app (tautology) |
| Sau khi QA duyệt Excel | Agent `search_files` → `create_file`/`update_file` qua Drive MCP | Đẩy TC lên Google Sheet. **Luôn review nội dung `.xlsx` local trước khi ghi đè**; chi tiết ở `phase1/04_auto_publish_backlog.md` |
| **Bước 7 — xuất Excel** | `node scripts/convert_excel/md_to_xlsx.js` | Xuất Markdown canonical sang `.xlsx` — **bắt buộc**, kể cả khi task chỉ dùng Sheet. Lệnh này từng chỉ được nhắc trong khối "Prompt mẫu" (nay ở `references/`); một bước bắt buộc phải nằm ở lõi, không chỉ trong bản mẫu |
| Ngay sau khi export Excel (bước 7) | tự chạy trong `md_to_xlsx` | **`design_gate` (G5)** CHẶN nếu thiếu cột canonical / rỗng ô lõi / bộ có case hiển thị mà thiếu `ui_catalog.json` |
| Sau export | `npm run design:gate` | Chạy tay khi muốn soi trước lúc convert |
| **Ngay khi có bộ testcase** | `npm run domain:trace-back` → sửa xong thì `-- --apply` | **Chiều TC→rule**: case mang tag cần-oracle (`[Calc]/[BEData]/[Display]/[Security]/[Guard]`) mà không trỏ `[BR-…]`/`[SM-…]` → "expected lấy từ đâu?"; trỏ id không tồn tại → "oracle ma"; `--apply` tự append `covered_by`. Đo: bộ 530 hiện tại **0/530** case trỏ rule |
| **Ngay khi có bộ testcase, TRƯỚC khi QA duyệt** | `npm run dim:coverage` → khai `requirements/dimension_manifest.json` → `npm run dim:coverage -- --enforce` | **CHẶN nếu thiếu chiều** (§3–§25) mà manifest khai `required`. Gate DUY NHẤT kiểm 22 chiều — `design_gate` không kiểm chiều nào. Case phải mang **tag chiều** (§0b); chưa có tag thì gate tự từ chối chặn thay vì báo oan |
| **Ngay khi có bộ testcase** | `npm run tc:review:enforce` | Chấm từng case theo rubric 8 tiêu chí. Sáu tiêu chí máy chấm đủ, hai tiêu chí gắn cờ `AI` — cờ đó KHÔNG phải đạt |
| **Cuối Phase 1** | `npm run phase1:tables -- --enforce` · `npm run phase1:tables:check` | Sinh ba bảng đối soát vào `phase1-summary.md`. CHẶN khi rule **chỉ có case dương**, case **không khai dương/âm/biên**, hoặc case `[Display]` khẳng định hiển thị mà không có neo. Bảng SINH — sửa tay thì `:check` bắt |
| Sau export | `npm run risk:gate` | Đối chiếu độ sâu testcase với `depthPolicy` theo band rủi ro |
| **Ngay khi có bộ testcase** | `npm run bugs:checklist` | Error Guessing từ **bug đã từng xảy ra** ở module này (`knowledge/bugs/`). Bug lặp lại là bug rẻ nhất để bắt; không tra kho thì mỗi sprint lại vấp đúng chỗ cũ |
| **Sau khi có bộ testcase + đã trích spec** | `npm run spec:gap` (thêm `--enforce` khi có `catalog_bindings.json`) | **Chiều ngược spec→case**: khối/field tài liệu (hoặc build) NÊU mà bộ case chưa phủ. `--enforce` chỉ chặn khi có **khối build chưa khai dòng nào** (vùng mù thật); field lẻ mọc thêm ⇒ cảnh báo, vì tài liệu chậm cập nhật không phải vùng mù |
| Sau export | `npm run trace:matrix` | Sinh `reports/traceability-matrix.md` — REQ ↔ TC, lộ requirement chưa có case nào |
| Trước khi kết thúc phase | `npm run gate:policy` | Rule/skill/prompt mồ côi, lệch tên, lệch danh sách đuôi evidence |
| **Ngay khi có bộ testcase + đã viết summary** | `npm run scope:anchor:enforce` | **CHẶN khi mẫu số chưa neo**: `dimension_manifest.json` thiếu `reviewed_by` (tự khai `n/a` = tự thu hẹp phạm vi) · "Tổng requirement in-scope" lệch `scope_inventory.md` · `ui_catalog` lấy từ build mà không đánh `"oracle": "OBSERVATION"` · **số case đổi ≥10% mà danh mục KHÔNG đổi** (⇒ lượt trước sinh thiếu, ghi `knowledge/bugs/`) · kết luận `PASS` khi chưa neo. `--record` ghi sổ |
| **Cuối phase** | `npm run phase1:check -- --task <TASK_KEY>` | Bó 4 gate trên thành một lượt |
| **Trước khi finalize — gate gộp CÓ RĂNG** | `npm run self-review:enforce -- --task <TASK_KEY>` | Gộp preflight + design + row-quality + **neo mẫu số** → **exit 1 khi còn CHẶN**. Câu này từng chỉ có ở `run_phase2`, nên Phase 1 thiếu gate gộp có răng — và một bộ case đã kết luận `CONDITIONAL PASS` trên mẫu số do chính nó đặt |
| Khi bộ case có chiều **hiển thị/UI** | `TASK_ENV=... npm run ui:conformance` | Đối chiếu **field thật trên build** với danh mục màn (`ui_catalog.json`) — lộ field bịa, field thiếu, nhãn lệch. Đây là thứ duy nhất kiểm "case hiển thị có khớp màn thật" trước khi ai đó execute |
| **Cuối phase — BÁO CÁO ĐÃ HỌC GÌ** | `npm run learn:report -- --task <TASK_KEY> --write` | Sinh `reports/learning-summary.md` (đã học + CHƯA học). Phase 1 học ít record hơn Phase 2 nhưng **đúng loại quý nhất**: câu trả lời của BA sau Ambiguity Gate là business truth vừa được xác nhận |

> 🗣️ **BẮT BUỘC: kể lại NGAY TRONG HỘI THOẠI, đừng chỉ ghi file.** Cuối phase nói thẳng **ba phần**:
> 1. **Đã học gì.** Record mới hoặc cập nhật trong `knowledge/**`, đặc biệt `domain/` và `system/` sinh từ
>    câu trả lời BA. Mỗi câu Blocking đã RESOLVED phải để lại record, và `self_review` kiểm từng câu.
>    Kèm cả **memory vừa lưu hoặc sửa, và lý do lưu**.
> 2. **Đã sửa gì.** Thay đổi thật, có số đo. Không "đã cải thiện", "đã tối ưu".
> 3. **Còn thiếu gì.** Nêu lỗ hổng **đo được**: câu hỏi BA còn `PENDING` kèm phần scope bị chặn theo, rule
>    có `covered_by` rỗng, requirement chưa có TC nào (xem `traceability-matrix.md`), màn chưa khai trong
>    `ui_catalog.json`.
>
> Nêu cả phần "còn thiếu" dù nó làm báo cáo trông kém đẹp. **Đó mới là phần user dùng để quyết việc tiếp theo.**
> File chỉ là chỗ LƯU, không phải cách THÔNG BÁO.

## Prompt mẫu để chạy

Mẫu prompt để **người** chép, điền rồi gửi cho agent nằm ở [`phase1/references/prompt_mau_phase1.md`](phase1/references/prompt_mau_phase1.md).
Agent KHÔNG cần nạp file đó trong lượt chạy: bản đã điền đến qua tin nhắn của người dùng.
