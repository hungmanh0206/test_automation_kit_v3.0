---
vi_sao: "`manual:check:enforce` đọc `manual-run/session.md` BÊN TRONG thư mục run của một task, cạnh `testcase-status.json`, rồi đối chiếu lời kể với sổ verdict. Nó không nhận một file rời. Năm trường bắt buộc ở mẫu dưới chép từ `TRUONG_BAT_BUOC` trong scripts/qa/manual_run_check.js."
---

# Mẫu `session.md` — sổ một phiên chạy tay, bản đã điền

> Bản **đã điền xong** cho một phiên chạy tay thật, không phải khung trống. Đặt ở
> `<TASK_OUTPUT_DIR>/test-results/runs/<RUN_ID>/manual-run/session.md`.
>
> **Năm trường đầu là bắt buộc**, và `manual:check:enforce` chặn khi một trong năm còn trống **hoặc còn
> là placeholder**. Điền `[tên]` hay `TBD` không qua được — placeholder là chỗ trống có mặc áo.
>
> **Trường thứ năm, "Đơn vị / cấp học", là trường hay bị bỏ nhất và tốn nhất khi bỏ.** Một tài khoản
> QEMIS chỉ thuộc một cấp; không ghi đơn vị thì sáu tháng sau không ai biết lượt này chạy ở cấp nào, và
> hai lượt khác cấp trông giống nhau hoàn toàn.

---

## Phiên chạy tay — CSDL-9002 · Hồ sơ lớp học

- Người chạy: Nguyễn Văn A (QA)
- Ngày: 06/11/2026
- Môi trường: UAT
- Build / version: `2026.11.05-rc2`
- Đơn vị / cấp học: Trường `TEST 1` (mã `01274601`) · cấp Tiểu học · năm học 2026-2027

## Case đã chạy

| TC | Verdict | Ghi chú |
|---|---|---|
| `NT-LOP-040` | PASSED | Tài khoản chỉ-xem: nút Thêm mới và Xóa không hiện trên thanh công cụ. Ảnh ở `artifacts/NT-LOP-040-toolbar.png`. |
| `NT-LOP-041` | PASSED | Gõ thẳng URL màn Thêm khi đang ở tài khoản chỉ-xem: app trả về màn danh sách, không mở form. |
| `NT-LOP-042` | FAILED | Màn Sửa **không** chặn mã lớp trùng, trong khi màn Thêm chặn. Tầng `product_bug` nên có ảnh mỗi step ở `artifacts/NT-LOP-042-*`. Đã log `CSDL-4193`. |
| `NT-LOP-043` | BLOCKED | Cần lớp đã có học sinh ở hai khối; tìm toàn UAT không có. Hẹn DBA nạp. |

## Điều máy không đối chiếu được, nên phải kể

**Vì sao `NT-LOP-042` là bug sản phẩm, không phải case sai.** Ô `Kết quả mong đợi` của case ghi rõ
*"thông báo `Mã lớp đã tồn tại`, bản ghi không đổi"*. Đã rerun 3 lần, cả 3 đều lưu được. Và màn Thêm
chặn đúng — nên đây là **một nhánh hở**, không phải một kỳ vọng sai.

**Vì sao `NT-LOP-043` là `BLOCKED` chứ không `FAILED`.** Chưa dựng được tiền đề thì chưa đo được điều
case hỏi. Chấm `FAILED` ở đây là sinh một bug giả, và bug giả tốn của DEV nhiều hơn một dòng `BLOCKED`.

**Thứ tự chạy có ảnh hưởng không.** Không. Bốn case trên độc lập; `042` tự tạo lớp riêng với mã mang
`RUN_ID` nên không đụng dữ liệu của lượt khác.

---

## Hai điều mẫu này gác

**KHÔNG ghi PII khách.** `manual:check` quét `session.md` tìm dấu hiệu email và số điện thoại rồi
**chặn**. Tên trong mẫu này là tên người chạy — người của đội, không phải khách. Cần nhắc một hồ sơ
khách thì ghi mã hồ sơ, đừng ghi họ tên hay số điện thoại.

**Tiền điều kiện của case phải khai `[manual]`.** Chạy tay một case mà ô Tiền điều kiện khai
`[api]`/`[factory]` thì cửa chặn: lời kể và case đang nói hai chuyện khác nhau, và một trong hai sai.
