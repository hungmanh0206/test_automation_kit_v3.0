# skills:practice — 2026-11-06

- model CLI: `2.1.285 (Claude Code)`
- bài: **1** · lượt mỗi bài: **3** · đạt khi ≥ 2/3
- tổng: 3 lượt · 265s · 16838 token · $1.1367

> Mỗi bài chỉ đọc ĐÚNG MỘT skill; thư mục làm bài KHÔNG có `prompt_templates/`, nên model không
> mở được prompt phase để lấy thêm hướng dẫn. Làm được là nhờ skill, không nhờ thứ khác.
>
> **Giới hạn, nói thẳng:** số bài hiện tại KHÔNG phủ hết 28 skill. Bài nào trượt thì sửa SKILL,
> không sửa đề.

| bài | skill | lượt | kết quả | chi tiết |
|---|---|---|---|---|
| review-5-loi | automation_reviewer | 1 | ĐẠT | 5/5 lỗi có cả từ khoá VÀ số dòng: L1-hard-sleep, L2-console-log, L3-vacuous-count, L4-tautology, L5-phu-thuoc-thu-tu |
| review-5-loi | automation_reviewer | 2 | ĐẠT | 5/5 lỗi có cả từ khoá VÀ số dòng: L1-hard-sleep, L2-console-log, L3-vacuous-count, L4-tautology, L5-phu-thuoc-thu-tu |
| review-5-loi | automation_reviewer | 3 | ĐẠT | 5/5 lỗi có cả từ khoá VÀ số dòng: L1-hard-sleep, L2-console-log, L3-vacuous-count, L4-tautology, L5-phu-thuoc-thu-tu |

## Lượt hiệu chuẩn trước đó, và vì sao ngưỡng 2/3 là đúng chỗ

Trước ba lượt trên, hai lượt hiệu chuẩn CÙNG bài, CÙNG bộ chấm, CÙNG skill cho kết quả trái ngược:

| lượt | kết quả | thời gian | chi phí |
|---|---|---|---|
| hiệu chuẩn 1 | **2/5 → TRƯỢT** | 75s | $0,4506 |
| hiệu chuẩn 2 | **5/5 → ĐẠT** | 78s | $0,3938 |

Nếu dừng ở lượt đầu, kết luận sẽ là *"`automation_reviewer` dạy không đủ"*, và việc tiếp theo là đi
sửa một skill **không** hỏng. Ba lượt chính thức sau đó đều 5/5, nên giả thuyết đó sai.

Hai giả thuyết tôi nêu lúc thấy 2/5 đều **bị bác**: không phải skill mỏng (ba lượt sau tìm đủ 5/5 từ
đúng skill đó), cũng không phải bộ chấm khắt khe (nó cho 5/5 khi câu trả lời đủ). Nguyên nhân là **dao
động giữa các lượt** — cùng hình với `skills:route:live`, nơi hai lượt của cùng một trạng thái lệch 8,8
điểm.

Vậy ngưỡng **2/3** của bản chấm không phải sự thận trọng dư. Với bài này, **một lượt là tung đồng xu**.

## Chi phí thật, để lần sau không phải đoán

| | |
|---|---|
| một lượt | 65–114 giây · 4.000–7.100 token ra · **$0,30–0,45** |
| một bài (3 lượt) | ~4,5 phút · **$1,14** |
| cả 5 bài (15 lượt) | ~22 phút · **~$5,7** |

Đã chi cho mục 1.4 tính tới 06/11/2026: **$1,98** (2 lượt hiệu chuẩn + 3 lượt chính thức).

## Còn thiếu gì để 1.4 lên 5

Bản chấm đòi **5 bài**; hiện có **1**. Bốn fixture chưa dựng, và mỗi bài cần một bộ chấm riêng:

| bài | fixture | chấm bằng |
|---|---|---|
| viết 6 TC từ một đoạn đặc tả | `spec_lop_hoc.md` | `gate:gen-testcase` 0 chặn · `tc:review` ≥ ngưỡng · ≥1 BVA và ≥1 DT |
| đọc một lượt chạy | `run_blocked_25pct/` | phải nói "chưa đủ mẫu số", KHÔNG đưa tỉ lệ pass làm kết luận |
| viết một bug | `fail_case/` | `bug:claim` + `gate:output` |
| sinh chuỗi dữ liệu 3 module | `chuoi_truong_lop_hs.md` | `data:chain:check` |

Ba trong bốn bài cần dựng một **thư mục task giả** đủ để cửa tương ứng chạy được, vì `bug:claim`,
`gate:output`, `tc:review` và `data:chain:check` đều đọc thư mục output của một task chứ không đọc
file rời. Đó là phần việc lớn hơn cả việc viết đề.
