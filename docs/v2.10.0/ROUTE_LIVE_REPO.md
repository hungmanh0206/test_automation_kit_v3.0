> ## ⛔ BÁO CÁO NÀY KHÔNG ĐỌC ĐƯỢC — giữ lại làm lịch sử của một phép đo hỏng
>
> Lượt này chạy **3 LUỒNG SONG SONG**. Các phiên model bị throttle, và bản dụng cụ lúc đó đếm lượt bị
> throttle **thành** "model không gọi skill". Năm lượt chạy kiểu này cho 38,6% · 24,3% · 50,0% · 32,9% ·
> 2,9% — lượt cuối có 68/70 ca "không gọi" trong khi ngay sau đó một lượt đơn lẻ vẫn gọi đúng skill.
>
> **Đừng dẫn con số dưới đây.** Số đo đáng tin là 4 lượt TUẦN TỰ ở [`ROUTE_LIVE.md`](ROUTE_LIVE.md).
> Vì sao hỏng và đã vá thế nào: [`BASELINE.md`](BASELINE.md) mục 2.2.

# skills:route:live — 2026-11-04

- model CLI: `2.1.285 (Claude Code)`
- số câu: **90** (70 ca thật · 20 ca `none`)
- top-1: **17/70 = 24.3%** (ngưỡng 90%)
- `none` kích hoạt nhầm: **0/20** (trần 10%)
- ca thật không gọi skill nào: **53**
- lẫn trong cặp dễ nhầm: **0**
- ngữ cảnh chạy: **gốc repo thật (hook CÓ chạy)**
- tổng thời gian máy: ~1482 giây-CPU trên 3 luồng

> ⚠ SỬA TAY 04/11/2026: khối này do bản script CŨ ghi cứng và nó nói SAI về chính lượt sinh ra nó.
> Lượt này chạy `--trong-repo`, tức ở **GỐC REPO THẬT**: hook SessionStart CÓ chạy, `CLAUDE.md` CÓ
> được nạp. Con số dưới đây đo "mô tả skill + hook + ngữ cảnh repo", KHÔNG phải riêng mô tả skill.
> Nguồn đã vá để khối này sinh theo ngữ cảnh.
> Skill được chọn đọc từ lời GỌI công cụ `Skill`, không đọc từ lời model tự thuật.

| câu | mong | model gọi |
|---|---|---|
| soát chất lượng nội dung bộ testcase trước khi giao | tc_reviewer | **✗** none |
| kiểm bộ case có đủ cột theo template chưa | tc_validator | **✗** none |
| cho tôi điểm rubric của bộ case này | tc_reviewer | **✗** none |
| nhận bàn giao bộ case của người khác, dùng được chưa | tc_reviewer | **✗** none |
| ô lõi nào còn trống trong file testcase | tc_validator | ✓ tc_validator |
| case này có execute automation được không | tc_validator | **✗** none |
| soi DOM xem vì sao không bấm được | ui_debug_agent | **✗** none |
| chẩn đoán màn này, iframe hay sao ấy | ui_debug_agent | **✗** none |
| element hiện ra mà Playwright báo timeout | ui_debug_agent | **✗** none |
| tự tìm locator thay thế rồi ghi vào kho | locator_healing_agent | **✗** none |
| selector hỏng sau khi app đổi layout, thử chuỗi thay thế | locator_healing_agent | ✓ locator_healing_agent |
| API này có vượt SLA không | perf_check | **✗** none |
| lưới nhiều dòng render mất bao lâu | perf_check | **✗** none |
| đo web vitals của màn danh sách | perf_check | ✓ perf_check |
| chạy nhiều VU xem server chịu tới đâu | load_check | ✓ load_check |
| chấm điểm accessibility và SEO của trang | lighthouse_check | ✓ lighthouse_check |
| soak test nửa tiếng | load_check | ✓ load_check |
| ghi business rule BA vừa xác nhận vào kho | domain_recorder | ✓ domain_recorder |
| stress endpoint đăng nhập bằng k6 | load_check | ✓ load_check |
| điểm best-practices của trang này bao nhiêu | lighthouse_check | **✗** none |
| có neo BR nào cho luật này chưa | domain_recorder | **✗** none |
| vai trò này có quyền sửa hồ sơ không | system_mapper | **✗** none |
| vẽ state machine của luồng duyệt | system_mapper | ✓ system_mapper |
| danh mục bề mặt dùng chung của hệ thống nằm ở đâu | system_mapper | **✗** none |
| hành vi này là lỗi hay đúng thiết kế | system_mapper | **✗** none |
| lưu lý do vì sao chốt là by design | decision_recorder | **✗** none |
| ca này trước đây đã kết luận thế nào | decision_recorder | **✗** none |
| sinh 50 hồ sơ unique để test lưới | test_data_generator | ✓ test_data_generator |
| dữ liệu test cần rollback được sau khi chạy | test_data_generator | ✓ test_data_generator |
| nên dựng state bằng factory hay hook | precondition_setup_planner | ✓ precondition_setup_planner |
| case này chưa chạy được vì thiếu capability gì | precondition_setup_planner | **✗** none |
| đọc nội dung issue Backlog để lấy đặc tả | backlog_integration | ✓ backlog_integration |
| fetch ngữ cảnh task từ Backlog | backlog_integration | ✓ backlog_integration |
| đẩy bug lên Backlog kèm ảnh | backlog_bug_reporter | ✓ backlog_bug_reporter |
| tạo sub-bug dưới issue cha cho case đỏ | backlog_bug_reporter | ✓ backlog_bug_reporter |
| nhận lại kết quả execute của người khác thì xem gì trước | run_report_reader | ✓ run_report_reader |
| gộp nhiều lượt chạy của sprint thành khuyến nghị | release_summary | **✗** none |
| mốc này go hay no-go | release_summary | **✗** none |
| case lúc xanh lúc đỏ không ổn định | flaky_test_analyzer | **✗** none |
| tỉ lệ pass này có đáng tin không | run_report_reader | **✗** none |
| chạy lại thì pass, nguyên nhân gốc là gì | flaky_test_analyzer | **✗** none |
| kiểm header và cookie có an toàn chưa | security_check | **✗** none |
| tài khoản này xem được dữ liệu của tài khoản khác không | security_check | **✗** none |
| giả lập response 500 xem FE xử lý sao | ui_mocking | **✗** none |
| chặn route để test nhánh timeout | ui_mocking | **✗** none |
| lượt chạy vừa rồi nói lên điều gì | run_report_reader | **✗** none |
| sinh bộ tổ hợp pairwise từ các chiều này | combinatorial_matrix | **✗** none |
| đừng chạy hết Cartesian, chọn bộ tối thiểu | combinatorial_matrix | **✗** none |
| đọc đặc tả rồi tóm phạm vi cho Phase 1 | requirements_analyzer | **✗** none |
| tài liệu phủ được bao nhiêu phần chức năng | requirements_analyzer | **✗** none |
| dạy tôi thiết kế case thủ công cho tốt | tc_design_guide | **✗** none |
| Tiền điều kiện khác Context ở chỗ nào | tc_design_guide | **✗** none |
| ô này nên dùng kỹ thuật phân vùng hay biên | tc_design_guide | **✗** none |
| chấm risk từng module để chia độ sâu | risk_scorer | **✗** none |
| vì sao module kia ít case hơn | risk_scorer | **✗** none |
| branch này sửa những gì, chạm module nào | git_impact_analyzer | **✗** none |
| diff của PR ảnh hưởng bề mặt dùng chung nào | git_impact_analyzer | **✗** none |
| sửa chỗ này thì vỡ bề mặt nào | git_impact_analyzer | **✗** none |
| đẩy bộ testcase lên Google Sheet cho BA xem | backlog_testcase_publisher | **✗** none |
| cất lại root cause của task này để lần sau dùng | learning_recorder | **✗** none |
| lưu fact đã qua gate vào kho dùng chung | learning_recorder | **✗** none |
| điều phối lượt automation, cần chạy cửa nào trước | qa_automation_engineer | **✗** none |
| bộ spec này xanh nhưng tôi không tin, soi hộ | automation_reviewer | **✗** none |
| trước khi bàn giao thì đánh giá độ tin của automation thế nào | automation_reviewer | **✗** none |
| kiểm xem mấy test kia có thật sự chứng minh gì không | automation_reviewer | **✗** none |
| hôm nay trời đẹp không | none | ✓ none |
| cài giúp tôi node phiên bản mới | none | ✓ none |
| đổi mật khẩu wifi phòng họp | none | ✓ none |
| đặt vé máy bay đi Hà Nội | none | ✓ none |
| vừa merge PR xong, giờ phải regression những màn nào | git_impact_analyzer | **✗** none |
| đọc diff của branch này rồi nói nó đụng bề mặt dùng chung nào | git_impact_analyzer | **✗** none |
| commit hôm qua sửa hàm chung, ảnh hưởng tới đâu | git_impact_analyzer | **✗** none |
| chưa đổi dòng code nào, chỉ muốn tra danh mục bề mặt dùng chung đã chốt | system_mapper | **✗** none |
| ai được phép sửa hồ sơ trường, tra ma trận phân quyền | system_mapper | **✗** none |
| giải thích cho tôi git rebase khác git merge chỗ nào | none | ✓ none |
| đổi tên biến này cho dễ đọc hơn | none | ✓ none |
| npm install báo lỗi EACCES thì sửa sao | none | ✓ none |
| viết hộ tôi email xin nghỉ phép | none | ✓ none |
| commit message nên viết theo quy ước nào | none | ✓ none |
| xoá các nhánh đã merge trên remote bằng lệnh gì | none | ✓ none |
| VS Code mở file 50MB bị treo | none | ✓ none |
| định dạng lại file JSON này cho dễ nhìn | none | ✓ none |
| giải thích đoạn regex này làm gì | none | ✓ none |
| tạo .gitignore cho dự án Node | none | ✓ none |
| máy tôi hết dung lượng ổ C, dọn gì trước | none | ✓ none |
| dịch đoạn mô tả này sang tiếng Anh | none | ✓ none |
| cho tôi biết phiên bản kit hiện tại | none | ✓ none |
| mở giúp file CHANGELOG | none | ✓ none |
| đổi theme của terminal sang nền tối | none | ✓ none |
| tắt thông báo của Teams trong giờ làm | none | ✓ none |
