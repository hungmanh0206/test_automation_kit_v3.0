# Skills Index (SINH TỰ ĐỘNG — đừng sửa tay)

> Sinh bởi `node scripts/qa/skills_index.js --write`. Skill của kit nằm ở `.agent/skills/**` — KHÔNG phải
> `.claude/skills/`, nên harness không tự phát hiện. Bảng này là cách agent biết skill nào có và nằm ở đâu.

| Skill | Nhóm | File | Dùng khi |
|---|---|---|---|
| `combinatorial_matrix` | phase1 | `.agent/skills/phase1/combinatorial_matrix/SKILL.md` | "Sinh MA TRẬN TỔ HỢP (Pairwise mặc định) từ các chiều + values + constraints, map expected cho từng bộ. Chống nổ case, dùng cho cross-module nhiều biến." |
| `git_impact_analyzer` | phase1 | `.agent/skills/phase1/git_impact_analyzer/SKILL.md` | "ĐẦU VÀO LÀ GIT DIFF. Vừa sửa code và cần biết thay đổi đó làm vỡ bề mặt nào: đọc diff của branch/PR, xếp file đã đổi vào 7 bề mặt dùng chung. Suggest-only." |
| `requirements_analyzer` | phase1 | `.agent/skills/phase1/requirements_analyzer/SKILL.md` | Phân tích requirement/UI/API artifact để tạo scope, business rule và coverage input cho Phase 1. |
| `risk_scorer` | phase1 | `.agent/skills/phase1/risk_scorer/SKILL.md` | "Chấm RISK từng module (Likelihood × Impact) từ knowledge/ và config, sinh risk-register, rồi gác ĐỘ SÂU test theo band. Dùng khi chia độ sâu giữa các module." |
| `tc_design_guide` | phase1 | `.agent/skills/phase1/tc_design_guide/SKILL.md` | "Dạy THIẾT KẾ TEST CASE thủ công: 6 thành phần, ranh giới Actor/Context/TIỀN ĐIỀU KIỆN, chọn KỸ THUẬT (phân vùng, BIÊN) theo tình huống, anti-pattern." |
| `tc_reviewer` | phase1 | `.agent/skills/phase1/tc_reviewer/SKILL.md` | Chấm chất lượng bộ testcase theo rubric 9 tiêu chí (0-2 điểm mỗi tiêu chí) — máy chấm 7, người chấm 2. Dùng trước khi publish, hoặc khi nhận bàn giao một bộ TC không phải mình viết. |
| `tc_validator` | phase1 | `.agent/skills/phase1/tc_validator/SKILL.md` | "Soi file testcase Phase 1: Ô LÕI nào CÒN TRỐNG, có đúng template 10 cột, qua coverage/risk gate chưa, và case có EXECUTE AUTOMATION ĐƯỢC không." |
| `automation_reviewer` | phase2 | `.agent/skills/phase2/automation_reviewer/SKILL.md` | "Chấm độ tin của bộ spec đã viết: nó xanh vì sản phẩm đúng, hay xanh vì KHÔNG KIỂM GÌ. Soi oracle tautology, test phụ thuộc nhau, dữ liệu trùng lượt." |
| `flaky_test_analyzer` | phase2 | `.agent/skills/phase2/flaky_test_analyzer/SKILL.md` | Phân tích testcase Playwright flaky và đề xuất/sửa root cause trong phạm vi an toàn. |
| `lighthouse_check` | phase2 | `.agent/skills/phase2/lighthouse_check/SKILL.md` | "Chấm ĐIỂM LIGHTHOUSE thật cho một trang: Performance, ACCESSIBILITY, SEO, Best-practices. Verdict advisory theo dải điểm chuẩn." |
| `load_check` | phase2 | `.agent/skills/phase2/load_check/SKILL.md` | "Chạy LOAD, STRESS và SOAK TEST nhiều VU cùng lúc qua k6: hệ chịu được bao nhiêu người, trụ được bao lâu. Never-auto, chỉ non-prod." |
| `locator_healing_agent` | phase2 | `.agent/skills/phase2/locator_healing_agent/SKILL.md` | "Khi LOCATOR hành động FAIL lúc execute: thử chuỗi fallback rồi tự áp dụng nếu đủ tự tin, ghi lịch sử vào knowledge/locators/. KHÔNG heal locator assertion." |
| `perf_check` | phase2 | `.agent/skills/phase2/perf_check/SKILL.md` | "Đo hiệu năng một người dùng: API có VƯỢT SLA không, web vitals, màn dữ liệu lớn, trọng lượng tài nguyên. So ngưỡng catalog, median N lần chống flaky." |
| `qa_automation_engineer` | phase2 | `.agent/skills/phase2/qa_automation_engineer/SKILL.md` | "Sinh, cập nhật và chạy AUTOMATION Playwright UI/API cho Phase 2 từ testcase canonical. Dùng khi đã có bộ TC và cần code chạy được." |
| `security_check` | phase2 | `.agent/skills/phase2/security_check/SKILL.md` | "Kiểm SECURITY cơ bản non-destructive trên UAT: headers/cookie, unauth, AUTHZ/IDOR hai tài khoản, exposure. Chỉ GET read-only." |
| `ui_debug_agent` | phase2 | `.agent/skills/phase2/ui_debug_agent/SKILL.md` | Khám phá DOM thật của một màn để tìm locator bền và neo nhãn UI ↔ cột DB — dùng khi màn mới, khi locator vỡ, hoặc khi debug script_error. |
| `ui_mocking` | phase2 | `.agent/skills/phase2/ui_mocking/SKILL.md` | "Chặn và GIẢ LẬP RESPONSE bằng page.route: cô lập dependency ngoài scope, hoặc dựng nhánh lỗi 5xx/timeout/abort rồi xem FE xử lý sao." |
| `backlog_bug_reporter` | shared | `.agent/skills/shared/backlog_bug_reporter/SKILL.md` | "LOG BUG lên Backlog thành sub-bug từ testcase FAIL đã qua Bug Claim Gate. Chỉ khi tầng lỗi là product_bug hoặc api_bug và đã có evidence." |
| `backlog_integration` | shared | `.agent/skills/shared/backlog_integration/SKILL.md` | Fetch/read Backlog và source liên quan khi workflow yêu cầu context từ Backlog/Figma. (tài liệu nguồn tạm ngoài phạm vi — chờ chuyển sang Google Docs/Sheet.) |
| `backlog_testcase_publisher` | shared | `.agent/skills/shared/backlog_testcase_publisher/SKILL.md` | "Publish testcase từ bản xuất Excel lên **Google Sheet** sau Phase 1 (qua Drive MCP: search_files/create_file/update_file)." |
| `decision_recorder` | shared | `.agent/skills/shared/decision_recorder/SKILL.md` | "Ghi LÝ DO của quyết định QA đã chốt (false positive, by design, PASS-kèm-note) vào knowledge/decisions/, và TRA nó trước khi log bug." |
| `domain_recorder` | shared | `.agent/skills/shared/domain_recorder/SKILL.md` | Ghi business rule ĐÃ ĐƯỢC XÁC NHẬN vào knowledge/domain/ (versioned, có source + examples cụ thể, trace covered_by) để oracle của testcase luôn trích được nguồn thay vì suy từ app. |
| `learning_recorder` | shared | `.agent/skills/shared/learning_recorder/SKILL.md` | Ghi fact đã qua gate (bug đã confirm, root cause, snapshot pass/fail) vào knowledge/ để tái dùng xuyên task. Suggest-only — chỉ lưu dữ liệu, không tự kết luận risk/PASS-FAIL. |
| `precondition_setup_planner` | shared | `.agent/skills/shared/precondition_setup_planner/SKILL.md` | Phân loại tiền điều kiện, chọn setup method (factory/hook/fixture/mock), ghi verification + cleanup, đánh dấu readiness/blocker và Definition of Ready cho Setup Strategy contract. |
| `release_summary` | shared | `.agent/skills/shared/release_summary/SKILL.md` | "Gộp nhiều lượt chạy của MỘT MỐC (release/sprint/UAT) thành khuyến nghị GO/CONCERNS/NO-GO có căn cứ, đối chiếu tiêu chí exit đã chốt trước khi xem kết quả." |
| `run_report_reader` | shared | `.agent/skills/shared/run_report_reader/SKILL.md` | "ĐỌC KẾT QUẢ một lượt chạy đúng thứ tự và đúng nguồn: artifact nào trả lời được câu gì, và câu nào KHÔNG artifact nào trả lời được." |
| `system_mapper` | shared | `.agent/skills/shared/system_mapper/SKILL.md` | "KHÔNG đọc thay đổi code. Ghi và tra bản đồ hệ thống ĐÃ CHỐT ở knowledge/system/: state machine, ma trận phân quyền, danh mục bề mặt dùng chung. Tra được mà không cần diff." |
| `test_data_generator` | shared | `.agent/skills/shared/test_data_generator/SKILL.md` | "SINH TEST DATA cụ thể, unique theo RUN_ID, truy vết và rollback được, cho Phase 1 và Phase 2. Dùng khi case cần dữ liệu mới thay vì dữ liệu sẵn có." |

> 28 skill. Thiếu description: 0.
