# Prompt mẫu để chạy Phase 1

> Dời ra từ `prompt_templates/phase2/01_run_phase2.md` ngày 05/11/2026 (v2.10.0).
>
> Đây là mẫu cho **người** chép. Bạn điền placeholder rồi gửi cho agent.
> Agent nhận bản đã điền qua tin nhắn. Nó không cần nạp file này trong mỗi lượt chạy.
>
> Số đo khi dời: 82 trên 87 dòng chỉ dẫn trong khối đã có ở nơi khác mà lượt chạy vẫn nạp.
> Hai dòng còn lại chỉ là ô trống chờ điền URL.
>
> Một bước bắt buộc từng chỉ nằm ở đây là lệnh `md_to_xlsx.js`. Cửa `gate:policy` bắt được,
> và nay bước đó đã có một dòng riêng trong bảng Gate bắt buộc của điểm vào.

Prompt mẫu để chạy Phase 1

> Dời ra từ `prompt_templates/phase2/01_run_phase2.md` ngày 05/11/2026 (v2.10.0). Đây là mẫu cho **người**
> chép, điền placeholder, rồi gửi cho agent — agent nhận bản đã điền qua tin nhắn, nên không cần nạp
> bản mẫu này trong mỗi lượt chạy. Đo khi dời: 82/87 dòng chỉ dẫn trong khối đã có ở nơi khác mà lượt
> chạy vẫn nạp; hai dòng còn lại chỉ là ô trống chờ điền URL.

> Copy khối dưới đây, thay placeholder rồi gửi cho agent.

```text
Chạy Phase 1 cho module/task sau: collect context và sinh/update testcases.

Project:
- Project là **toàn bộ hệ thống đang test**, không phải một module.
- Phạm vi hiện tại là module/task/feature được cung cấp bên dưới.
- Backlog key hoặc module name chỉ là task/feature scope, không phải tên project.

Phạm vi:
- Module/Feature: [MODULE_FEATURE]
- Task key/scope folder: [TASK_KEY]
- Site/ứng dụng liên quan: [TEN_SITE hoặc N/A]

Input links: (lấy từ profile của task — profiles/[TASK_KEY].env; chỉ điền trực tiếp ở đây khi muốn override profile)
- Backlog Epic: [BACKLOG_EPIC_URL]
- Backlog Story/Task: [BACKLOG_STORY_URL]
- tài liệu nguồn Requirement: [REQUIREMENT_DOC]
- Figma: [FIGMA_FILE_URL]
- App 1 (chính) URL: [OPS_BASE_URL] · Swagger: [OPS_SWAGGER_URL]
- App 2 (phụ) URL: [LMS_BASE_URL] · Swagger: [LMS_SWAGGER_URL]
- Other docs/files: [OTHER_DOCS hoặc N/A]

Run profile (chạy song song an toàn):
- Mỗi task dùng profile riêng profiles/[TASK_KEY]/task.env chứa GIÁ TRỊ ĐỘNG (scope, link cụ thể của task, tài khoản ứng dụng theo task, `GOOGLE_SHEET_URL`); giá trị TĨNH (Figma/tài liệu nguồn/Backlog key + base URL) giữ ở .env chung.
- Truyền TASK_ENV=profiles/[TASK_KEY]/task.env cho MỌI command; không đọc TASK_KEY từ .env chung, không sửa .env/.env.local chung.
- Chi tiết: QUICKSTART.md (mục Parallel Story Safety).

Context/config:
- Đọc `.agent/config/project_context.md` nếu có.
- Đọc `.env.example` để biết env keys cần có.
- Credential/token thật lấy từ `.env.local` hoặc `.env`, không ghi vào markdown/log/report.
- Backlog testcase publish: KHÔNG publish trong prompt này. Auto Publish Backlog là step riêng trong phạm vi Phase 1, chỉ chạy bằng `prompt_templates/phase2/06_auto_publish_backlog.md` sau khi QA xác nhận Excel.
- Công cụ test management nếu chạy step publish riêng: **Google Sheet** qua Drive MCP (agent search_files/create_file/update_file, không cần token — dùng MCP đã kết nối sẵn trong phiên chat).
- Step publish (04) đẩy lên **Google Sheet**: file `.xlsx` do `md_to_xlsx.js` xuất ra chính là nội dung Sheet (dashboard + 1 sheet/nhóm chức năng) — không ánh xạ field riêng, upload nguyên file.
- Testcase cleanup: KHÔNG cleanup trong prompt này. Sheet tự phản ánh đúng Excel ở mỗi lần re-publish (ghi đè toàn workbook) — không cần bước lifecycle riêng. Nếu cần unlink Test↔Story/Task trên Backlog, xem `partial-rerun/run_testcase_cleanup.md`.
- Tất cả Markdown/report/task log phải dùng tiếng Việt chuẩn có dấu, encoding UTF-8. Không dùng tiếng Việt không dấu và không để ký tự lỗi encoding/mojibake.

Parallel story safety:
- Trước khi ghi file hoặc chạy command, bắt buộc echo scope:
  `PROJECT_OUTPUT_DIR`, `TASK_KEY`, `TASK_OUTPUT_DIR`, `RUN_ID` nếu có, và phase đang chạy.
- Nếu yêu cầu hiện tại của user không nêu rõ `TASK_KEY`, không dùng `TASK_KEY` từ `.env` hoặc context cũ để chạy; phải hỏi lại.
- Nếu `TASK_KEY` echo ra không khớp task user yêu cầu, dừng ngay; không ghi file/chạy lệnh.
- Không sửa `.env` hoặc `.env.local` chung khi có session khác đang chạy.
- Ưu tiên truyền `PROJECT_OUTPUT_DIR` và `TASK_KEY` qua env/CLI từng command.
- Không chạy Phase 1 song song cùng một `TASK_KEY` vì Phase 1 ghi requirement/testcase/report chính.
- Nếu cần thử nhiều hướng cho cùng story, dùng task branch/suffix riêng, ví dụ `<TASK_KEY>-draft-a`, rồi Human Review trước khi merge về task chính.

Nguyên tắc tiết kiệm token:
- Ưu tiên đọc link/file theo đường dẫn và lưu raw artifacts vào `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/requirements/`; không paste toàn bộ Backlog/tài liệu nguồn/Figma/Swagger vào chat hoặc report.
- Nếu đã có requirement artifact, snapshot hoặc `reports/phase1-summary.md` local, dùng làm nguồn chính và chỉ đọc raw docs khi summary chưa đủ.
- Chỉ mở section/anchor/page/API path liên quan tới `[MODULE_FEATURE]`; không đọc toàn bộ tài liệu lớn nếu scope chỉ là một module/flow.
- Không đọc các file `run_phase*_example_*` trừ khi user yêu cầu rõ hoặc đang cần so sánh example.
- Final cho user chỉ tóm tắt output path, tổng testcase, coverage, blocker; chi tiết đầy đủ nằm trong file report local.

Nguyên tắc chất lượng khi tối ưu:
- Tiết kiệm token không được làm giảm coverage, độ chi tiết testcase, độ đúng của expected result hoặc khả năng execute ở Phase 2.
- Nếu summary/cache/local artifact không đủ để xác nhận rule, field, permission, API contract hoặc expected result, phải đọc thêm nguồn gốc liên quan thay vì đoán.
- Không được bỏ qua source quan trọng chỉ để giảm số file đọc.
- Output ít token với user, nhưng file Markdown/Excel/report local phải đầy đủ, rõ ràng và có thể review độc lập.
- Nếu có trade-off giữa tiết kiệm token và chất lượng testcase, ưu tiên chất lượng testcase.

Output:
- Output root bắt buộc lấy từ `PROJECT_OUTPUT_DIR`.
- Nếu không có `PROJECT_OUTPUT_DIR`, dừng và yêu cầu user cung cấp; không dùng fallback hardcode.
- Nếu không có `TASK_KEY`, dừng và yêu cầu user cung cấp; không dùng fallback từ `BACKLOG_STORY_KEY` hoặc task cũ.
- Output cho scope này phải nằm trong:
  `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/`

Phase 1 tasks:
1. Fetch/read Backlog, tài liệu nguồn, Figma, Swagger/OpenAPI và file local nếu được cung cấp. **Đọc THẬT KỸ, KHÔNG qua loa** phần trong scope — mọi mục/bảng/ghi chú/footnote/comment liên quan; bóc đủ AC/rule/validation/enum/state/edge/phân quyền/biên; đối chiếu chéo nguồn và nêu mâu thuẫn (raw content lưu local, không dán vào prompt; phần ngoài scope thì lướt). Canonical: `RULE_GLOBAL.md` §"Analysis & Ambiguity Gate".
1b. **Ambiguity Gate (gate cứng):** sau khi đọc nguồn, rà mâu thuẫn/thiếu rule bắt buộc/expected không rõ. Nếu có điểm mơ hồ Critical/High → xuất Q&A đánh số + assumption mặc định ra `reports/phase1-clarifications.md`, ghi `AMBIGUITY_GATE: PENDING` vào `task.md` và DỪNG chờ QA/BA. KHÔNG sinh testcase khi gate PENDING. Chi tiết: `.agent/workflows/04_prepare_context.md` bước 7.
2. Phân tích requirement, UI design, API docs và context dự án.
2b. **UI Conformance Catalog (BẮT BUỘC nếu scope có màn UI)**: với mỗi màn/bảng/danh sách/field trong scope, trích **NGUYÊN VĂN từ FS/Figma** ra `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/requirements/ui_catalog.md` — mỗi phần tử → (tên cột/label chính xác, format dữ liệu, số cột + thứ tự, field bắt buộc, empty-state/placeholder/label nút/tiêu đề, token style nếu có Figma). Đây là **nguồn-sự-thật cho expected của mọi case hiển thị** ở cả Phase 1 (sinh case) lẫn Phase 2 (assert). CẤM lấy expected hiển thị từ build đang chạy (chống oracle tautological). Chi tiết ở [`phase2/dimensions/12_display.md`](phase2/dimensions/12_display.md).
3. Sinh hoặc cập nhật manual testcases.
4. Bao gồm UI, API và E2E testcases khi phù hợp.
5. Với tiền điều kiện phức tạp: **TRA `knowledge/setup_recipes/` TRƯỚC khi tự nghĩ cách dựng** — `npm run howto:find -- "<mô tả precondition>"`. Recipe cũ mang `applies_when` (điều kiện áp được) + `pitfalls` (thứ chỉ biết sau khi vấp) + `used_by` (TC đã dựng thành công = bằng chứng còn dùng được) ⇒ đọc rồi TỰ quyết tái dùng. Không kết quả **không** nghĩa là không dựng được, chỉ nghĩa là chưa ai ghi lại — dựng xong thì ghi recipe mới (skill `precondition_setup_planner`). Sau đó mới đề xuất setup qua UI/API public-business contract, fixture hoặc test hook/sandbox nếu có; không đề xuất DB để DỰNG state hoặc đọc toàn bộ source backend. `Setup Verification` có thể dùng read-only UAT DB qua guarded client (read-only, chỉ SELECT) khi API/UI không expose state.
6. Lưu testcase Markdown output dưới:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/`
7. Export mỗi file testcase Markdown có bảng `TC ID` sang Excel `.xlsx` cùng thư mục, cùng basename, bằng command:
   `node scripts/convert_excel/md_to_xlsx.js <testcase.md> <testcase.xlsx>`
   Ví dụ:
   `node scripts/convert_excel/md_to_xlsx.js <PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/[TESTCASE_BASENAME].md <PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/test-cases/[TESTCASE_BASENAME].xlsx`
8. Coi **Markdown canonical** (`test-cases/*.md`) là source of truth cho nội dung case ở mọi giai đoạn; `.xlsx` và Sheet là bản xuất. Chuẩn bị trạng thái `Pending QA confirmation` cho step Auto Publish testcase.
   - Không publish Backlog trong prompt này.
   - Sau khi QA xác nhận Excel/testcase đạt, chạy prompt riêng:
     `prompt_templates/phase2/06_auto_publish_backlog.md`
   - **Markdown canonical là source-of-truth**, kể cả khi gen và publish. Phase 2 **execute mặc định đọc `test-cases/*.md`** (`TESTCASE_SOURCE=md`) vì đọc Markdown rẻ token hơn hẳn `.xlsx` nhị phân; `sheet` và `excel` là opt-in cho lượt cần đúng bộ QA vừa sửa tay. Vì thế **publish KHÔNG còn là bước bắt buộc trước Phase 2**.
   - Nếu nội dung case thay đổi sau khi đã publish, sửa ở `.md` rồi chạy lại `sync:canonical` và re-publish (ghi đè Sheet) — không cần lifecycle riêng như công cụ test-management cũ; xem `partial-rerun/run_testcase_cleanup.md` nếu chỉ cần unlink Backlog.
9. Lưu requirement/context artifacts dưới:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/requirements/`
10. Cập nhật:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/task.md`
   Trong `task.md`, ghi rõ đường dẫn Markdown testcase, Excel testcase đã export và trạng thái `Backlog testcase publish: Pending QA confirmation`.
11. Sinh/cập nhật Phase 1 report dưới:
   `<PROJECT_OUTPUT_DIR>/tasks/[TASK_KEY]/reports/phase1-summary.md`
   Report phải đầy đủ và có thể review độc lập, bao gồm:
   - Tổng số testcase đã gen/cập nhật.
   - Số testcase theo loại: Positive / Negative / Boundary / Edge.
   - Số testcase theo nhóm chức năng: lấy động từ phần trước dấu `/` trong cột `Module`; không hardcode danh sách nhóm của một task cụ thể.
   - Report phải liệt kê toàn bộ nhóm thực tế xuất hiện trong testcase. Ví dụ CRUD có thể có `Xem danh sách`, `Tạo`, `Sửa`, `Xóa`; domain khác có thể có `Đăng nhập`, `Thanh toán`, `Báo cáo`, `Thông báo`,...
   - Số testcase theo layer/site: UI, API, E2E và các app/site thực tế trong scope nếu xác định được.
   - Coverage matrix tóm tắt requirement/business rule/API endpoint -> TC ID.
   - Review bộ testcase theo 2 góc độ `Coverage` và `Quality/Risk`, áp dụng quality gate ở [`phase2/04_output_format.md`](phase2/04_output_format.md) (trước đây câu này ghi "section Phase 1 report **bên dưới**" — con trỏ HỎNG từ trước khi tách, vì `run_phase1` không có mục report nào) và hướng dẫn chi tiết ở `prompt_templates/phase2/03_gen_testcases.md`.
   - Requirement Coverage phải tính theo công thức:
     `Requirement Coverage = Covered Requirements / Total In-scope Requirements * 100%`
   - Requirement chỉ được tính là covered nếu có testcase trace rõ ràng, assertion đúng behavior, và không bị skip nếu đã có execution result.
   - Phân loại từng requirement/gap theo risk: `Critical`, `High`, `Medium`, `Low`.
   - Không dùng công thức đếm gap kiểu `covered / (covered + gaps)` để thay thế coverage requirement.
   - Không kết luận `PASS` nếu còn open gap Critical/High, dù coverage tổng >= 80%.
   - Đánh giá testcase quality: trace requirement, step executable, expected cụ thể, assertion đúng business rule, phụ thuộc data/env, flaky risk, duplicate/overlap, skip/fail do script/setup.
   - Report bắt buộc có đúng các section:
     `### Coverage Summary`
     `| Metric | Value | Comment |`
     `### Risk-based Gate`
     `| Condition | Status | Reason |`
     `### High/Critical Gaps`
     `| Gap | Risk | Impact | Required Action | Gate Blocking |`
     `### Testcase Quality Issues`
     `| Testcase | Issue | Severity | Recommendation |`
     `### Final Decision`
   - `Final Decision` chỉ được dùng một trong: `PASS`, `CONDITIONAL PASS`, `FAIL`, `BLOCKED`.
   - Chỉ kết luận `PASS` khi coverage >= 80%, core/high-risk flows được cover đầy đủ, không còn open question Critical/High, không có testcase quan trọng bị skip, assertion rõ ràng, và negative/permission/rollback/error case được cover nếu nằm trong scope.
   - Coverage gaps, assumptions, rủi ro còn lại và testcase đề xuất bổ sung nếu có.
12. Cập nhật `task.md` để ghi rõ đường dẫn report Phase 1 và trạng thái chờ QA xác nhận trước khi publish Backlog testcase.

Yêu cầu testcase output:
- Mỗi testcase phải có precondition, test data, steps và expected result rõ ràng.
- Cột `Tiền điều kiện` phải dùng định dạng `[<method>] <mô tả trạng thái>` (nhiều precondition tách bằng `<br>`), method ∈ `api`|`factory`|`test_hook`|`ui`|`pre_existing`|`manual` — KHÔNG có `db`.
  - Cùng một trạng thái phải dùng **mô tả giống hệt và cùng method** ở mọi testcase — đây là thứ thay cho dedup của mã cũ; `design:gate` chặn cell thiếu tag và cảnh báo khi một trạng thái có 2 cách dựng.
- Xác định site/layer của từng testcase: [SITES] / UI / API / E2E.
- Xác định loại testcase: UI / API / E2E.
- Phân nhóm rõ từng testcase theo nhóm chính là business flow trong cột `Module` với format:
  `[Nhóm chức năng] / [User Story hoặc màn hình/API/flow cụ thể]`.
  Nhóm chức năng phải suy ra từ domain/scope và ưu tiên business flow, không phải layer kỹ thuật. Với CRUD có thể dùng `Xem danh sách`, `Tạo`, `Sửa`, `Xóa`; với API/E2E/permission gắn với flow cụ thể thì vẫn đặt vào nhóm flow đó, ví dụ `Tạo / API POST ...`, `Tạo / App 1 tạo bản ghi -> App 2 sync`, `Sửa / Permission role teacher cannot edit`. Chỉ dùng `API`, `E2E/Cross-app`, `Permission/Security` làm nhóm chính khi testcase không thuộc business flow cụ thể nào.
- Không thêm cột label vào bảng testcase. Nhóm chức năng thể hiện bằng **sheet riêng** trong workbook, TC ID ở cột `ID_TC`.
- Sau bảng testcase, thêm section `## Phân nhóm testcase` mapping nhóm chức năng -> phạm vi -> TC ID -> tổng.
- API testcase phải reference method + endpoint + expected status/body.
- Phải vét cạn UI edge/boundary theo các dimension ở [`phase2/dimensions/`](phase2/dimensions/) (mục 3 Field-Level mở rộng: Date/Month, Time HH:mm, Computed/derived, File upload boundary; mục 7 Export/Import file output; mục 8 Resilience/Concurrency; mục 9 Side-effect/Notification; mục 10 Cross-layer guard; mục 11 Design/Visual compliance — token Figma; **mục 12 Display/Field Conformance — tên cột exact, format từng field, số cột + thứ tự, field bắt buộc, empty-state; expected trích từ `ui_catalog.md`/tài liệu, KHÔNG từ build**). Dimension không áp dụng phải ghi `N/A + lý do` trong Coverage Gaps.
- File Excel phải được tạo thành công sau khi file Markdown hoàn tất; Excel phải có cột/sheet phân nhóm để lọc theo các nhóm thực tế trong cột `Module`. Mỗi nhóm chức năng nên là một sheet riêng — tên sheet sẽ trở thành subfolder Test Repository khi publish (bỏ qua sheet `Summary`, `Test Cases`); catalog precondition đặt ở sheet `Setup Contracts`. Nếu thiếu dependency `exceljs`, báo rõ blocker và không coi Phase 1 là hoàn tất.
- Sau khi Excel tạo thành công, không publish Backlog trong prompt này. Ghi trạng thái `Pending QA confirmation`; step publish thật chạy bằng prompt riêng sau khi QA xác nhận.
- Phase 1 report phải được tạo/cập nhật sau khi Markdown và Excel testcase hoàn tất; không coi Phase 1 hoàn tất nếu thiếu report này.
- `task.md`, testcase Markdown và Phase 1 report phải viết bằng tiếng Việt chuẩn có dấu; technical terms, endpoint, command, enum/status có thể giữ nguyên tiếng Anh.
- Không execute automation trong Phase 1.

Nạp file theo [`.agent/config/load_map.json`](../.agent/config/load_map.json), không nạp cả chuỗi.
Chiều coverage mở ĐÚNG chiều mà `requirements/dimension_manifest.json` khai `required`, ánh xạ khoá
sang file ở mục `phase1_chieu_coverage.anh_xa` của bản đồ đó.

Điều kiện dừng:
- **Dừng sớm nếu Ambiguity Gate PENDING**: nếu có mơ hồ Critical/High, dừng ngay sau khi xuất `reports/phase1-clarifications.md` + `AMBIGUITY_GATE: PENDING`; KHÔNG sinh testcase cho tới khi QA/BA resolve.
- Dừng sau khi sinh/cập nhật testcase Markdown, export Excel, sinh/cập nhật Phase 1 report và cập nhật task log.
- Chờ review trước khi chuyển Phase 2.
- **Ghi bàn giao rồi dừng phiên.** Viết `<TASK_OUTPUT_DIR>/handoff/phase1.md` theo khuôn ở
  [`.agent/config/handoff.json`](../.agent/config/handoff.json): bốn mục `Trạng thái`, `Artifact chính`,
  `Việc còn mở`, `Lệnh tiếp theo`, tổng dưới 1k token. Rồi bảo user chạy `/clear` trước khi gọi lệnh kế
  tiếp. Lý do là số đo, không phải sở thích: context trung bình mỗi message của một lượt task thật là
  494 đến 515k token, và cache-hit 98,5 đến 99,0% nghĩa là cả context đó được đọc lại ở MỌI message.
  Giữ một phiên cho cả hai phase là bắt phase sau trả tiền cho hội thoại của phase trước.

- Trước khi dừng, tự kiểm tra: testcase có đủ precondition/data/steps/expected, coverage chính >= 80% hoặc có gap rõ, không còn gap Critical/High nếu muốn kết luận PASS, Markdown canonical là nguồn sự thật cho nội dung case và bản xuất `.xlsx` mở được (Phase 2 execute mặc định đọc `test-cases/*.md`), publish testcase đang ở trạng thái `Pending QA confirmation`, report/task log tiếng Việt chuẩn có dấu, không có placeholder hoặc encoding lỗi.
- Trước khi dừng, chạy `Self-check vét cạn biên` (mục 18, [`phase2/03_gen_testcases.md`](phase2/03_gen_testcases.md)): mỗi input đủ EP/BVA; filter/list có biên ngày/tháng/năm nhuận; export verify cấu trúc file + mapping + empty + dataset lớn; side-effect có negative; UI guard có cross-layer check; entity có status có đủ ma trận status x action; computed field có TC derivation + biên; nếu có Figma thì component chính có TC design compliance (token màu/font/radius/spacing/alignment); **mỗi màn có bảng/field có case Display Conformance (tên cột exact + format + số cột/thứ tự + field bắt buộc + empty-state, expected từ `ui_catalog.md`/tài liệu — mục 12)**; **logic/tính toán có oracle giá trị cụ thể + so khớp/delta dữ liệu (mục 13); field trống nghi ngờ đối chiếu response BE, phân biệt null/rỗng/thiếu/0 (mục 14); IDOR/privilege/injection/mass-assignment/data-exposure (mục 15); SLA/large-dataset/concurrent khi có ngưỡng (mục 16); change impact: story đụng bề mặt dùng chung (data/endpoint/component/rule/status/permission) → regression smoke cho feature bị ảnh hưởng + backward-compat, cái nghi ghi `QA confirm` (mục 17)**. Mục thiếu phải ghi vào Coverage Gaps.

Extra instruction:
- [ANY_EXTRA_REQUEST hoặc N/A]
```
