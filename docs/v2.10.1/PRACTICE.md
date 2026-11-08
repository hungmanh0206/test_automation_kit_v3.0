# skills:practice — 2026-11-07

- model CLI: `2.1.285 (Claude Code)`
- bài: **5** · lượt mỗi bài: **3** · đạt khi ≥ 2/3
- tổng: 15 lượt · 1587s · 101945 token · $6.6037

> Mỗi bài chỉ đọc ĐÚNG MỘT skill; thư mục làm bài KHÔNG có `prompt_templates/`, nên model không
> mở được prompt phase để lấy thêm hướng dẫn. Làm được là nhờ skill, không nhờ thứ khác.
>
> **Giới hạn, nói thẳng:** số bài hiện tại KHÔNG phủ hết 28 skill. Bài nào trượt thì sửa SKILL,
> không sửa đề.

| bài | skill | lượt | kết quả | chi tiết |
|---|---|---|---|---|
| review-5-loi | automation_reviewer | 1 | ĐẠT | 5/5 lỗi có cả từ khoá VÀ số dòng: L1-hard-sleep, L2-console-log, L3-vacuous-count, L4-tautology, L5-phu-thuoc-thu-tu |
| review-5-loi | automation_reviewer | 2 | **TRƯỢT** | 3/5 lỗi có cả từ khoá VÀ số dòng: L3-vacuous-count, L4-tautology, L5-phu-thuoc-thu-tu |
| review-5-loi | automation_reviewer | 3 | ĐẠT | 5/5 lỗi có cả từ khoá VÀ số dòng: L1-hard-sleep, L2-console-log, L3-vacuous-count, L4-tautology, L5-phu-thuoc-thu-tu |
| doc-ket-qua | run_report_reader | 1 | ĐẠT | 5/5 tầng đúng · ca thiếu ảnh bước quyết định nêu được 3/2 ⇒ 6/6 |
| doc-ket-qua | run_report_reader | 2 | ĐẠT | 5/5 tầng đúng · ca thiếu ảnh bước quyết định nêu được 3/2 ⇒ 6/6 |
| doc-ket-qua | run_report_reader | 3 | ĐẠT | 5/5 tầng đúng · ca thiếu ảnh bước quyết định nêu được 3/2 ⇒ 6/6 |
| bug-than-backlog | backlog_bug_reporter | 1 | ĐẠT | 4/5 phép kiểm (ngưỡng 4) · trượt C5 |
| bug-than-backlog | backlog_bug_reporter | 2 | ĐẠT | 4/5 phép kiểm (ngưỡng 4) · trượt C5 |
| bug-than-backlog | backlog_bug_reporter | 3 | ĐẠT | 5/5 phép kiểm (ngưỡng 4) |
| du-lieu-run-id | test_data_generator | 1 | ĐẠT | 5/5 phép kiểm (ngưỡng 4) |
| du-lieu-run-id | test_data_generator | 2 | ĐẠT | 5/5 phép kiểm (ngưỡng 4) |
| du-lieu-run-id | test_data_generator | 3 | ĐẠT | 5/5 phép kiểm (ngưỡng 4) |
| dac-ta-ban-phan | requirements_analyzer | 1 | ĐẠT | 4/5 phép kiểm (ngưỡng 4) · trượt T4 |
| dac-ta-ban-phan | requirements_analyzer | 2 | ĐẠT | 4/5 phép kiểm (ngưỡng 4) · trượt T4 |
| dac-ta-ban-phan | requirements_analyzer | 3 | ĐẠT | 5/5 phép kiểm (ngưỡng 4) |
