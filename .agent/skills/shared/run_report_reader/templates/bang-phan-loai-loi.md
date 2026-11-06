---
vi_sao: "Bảng này là tài liệu TRA CỨU cho người đọc report, không phải artifact do máy sinh. Không máy nào kiểm được nó; `failureLayer` dùng trong bảng được gác bằng ca `verdict-taxonomy.spec` đối chiếu với .agent/config/verdict_taxonomy.json."
---

# Bảng phân loại lỗi cho report chạy tay — mục 1.2

> Đọc một report chạy tay xong, câu hỏi duy nhất đáng hỏi là **việc tiếp theo là gì**. Bảng này map
> từng dấu hiệu trong report về đúng `failureLayer` của `.agent/config/verdict_taxonomy.json`, rồi nói
> ra việc tiếp theo.
>
> Mỗi dòng có **một ví dụ trích từ sổ thật đã khử PII**. Dòng chưa gặp ca thật thì ghi thẳng
> *"chưa gặp"* kèm ngày đo — một bảng điền ví dụ bịa thì tệ hơn một bảng còn chỗ trống.

| Phân loại | Dấu hiệu trong report | `failureLayer` | Việc tiếp theo |
|---|---|---|---|
| **TC viết sai, mơ hồ** | Người chạy ghi *"không rõ phải thấy gì"*, hoặc hai người chạy cùng case ra hai verdict khác nhau | `testcase_error` | Sửa ô `Kết quả mong đợi` cho nêu dấu hiệu quan sát được, rồi chạy lại. **KHÔNG** log bug. |
| **Requirement đã lệch** | App làm đúng một hành vi, nhưng case mong hành vi cũ; BA xác nhận hành vi mới là đúng | `spec_gap` | Ghi rule mới vào `knowledge/domain/`, cập nhật case, ghi `knowledge/decisions/`. **KHÔNG** log bug. |
| **Môi trường, tiền đề** | *"không đăng nhập được"*, *"màn trắng"*, *"nút bấm không phản ứng"*, hoặc verdict đổi theo lượt chạy | `setup_failure` | Dựng lại tiền đề rồi chạy lại. **KHÔNG** log Backlog cho `setup_failure`. |
| **Dữ liệu** | Case cần hồ sơ ở trạng thái X mà UAT không có; hoặc lưới trống nên không có gì để kiểm | `data_issue` | Dựng dữ liệu qua UI/API/factory, **không bằng DB**. Chưa dựng được thì `BLOCKED` kèm lý do, không `FAIL`. |
| **Regression sau fix** | Case từng PASS ở lượt trước, nay FAIL, và vùng fix nằm cùng bề mặt dùng chung | `product_bug` | Rerun 2–3 lần loại flaky, rồi log bug kèm **mã bug đã fix** và ảnh mỗi step. |

## Ví dụ thật, đã khử PII

**TC viết sai, mơ hồ** — `NT-LOP-020`, sổ 04/11/2026. Ô kỳ vọng ghi *"hệ thống hiển thị đúng"*. Hai
người chạy cho hai verdict. Sửa thành *"mọi dòng hiện ra có cột `Khối` bằng `Khối 2`"* thì hết lệch.

**Requirement đã lệch** — màn 1.2, cờ `IS_CO_PHAN_HIEU=0`. Case mong *"hiện Có phân hiệu"*, app hiện
*"chưa khai báo"*. BA xác nhận app đúng: `0` nghĩa là chưa khai, không phải không có. Đã ghi `decisions/`,
**không** phải bug.

**Môi trường, tiền đề** — nút Ghi im lặng ở nhiều màn. Hoá ra host dev phát `http://` tuyệt đối nên
trình duyệt chặn Mixed Content. Lỗi **môi trường**, không phải sản phẩm; vào bằng `http` thì hết.

**Dữ liệu** — `NT-LOP-030` cần lớp có học sinh ở hai khối. UAT chỉ có một khối. Ghi `BLOCKED` kèm lý do
và hẹn DBA nạp, **không** ghi `FAIL`.

**Regression sau fix** — *chưa gặp ca thật ở bộ hồ sơ lớp, đo 06/11/2026.* Dòng này để trống ví dụ
thay vì bịa một ca cho đủ bảng.

## Hai cách đọc sai hay gặp nhất

**`BLOCKED` cao không phải tin xấu về sản phẩm.** Nó là tin xấu về **mẫu số**: dải `BLOCKED` vượt ngưỡng
thì `run:analysis:enforce` chặn, vì phần đã chạy không còn đại diện cho bộ.

**`script_error` KHÔNG đè verdict cũ.** Một lượt chết vì lỗi script thì case giữ verdict lần trước, chứ
không thành `FAIL`. Trộn hai thứ đó là mất verdict thật.
