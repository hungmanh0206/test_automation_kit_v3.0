# Cặp sai → đúng khi viết bug Backlog

> Khuôn giống `tc_design_guide/references/anti_patterns.md`: dòng ❌ là chỗ đã gặp thật, dòng ✅ là bản
> viết lại. **Cột ✅ không vi phạm gate nào** — ca đối chứng của mục này chạy `bug:claim --check` và
> `gate:output` trên cột ✅ và đòi xanh, chạy trên cột ❌ và đòi đỏ.

---

## 1. Thân bug viết như một lập luận, không như một bản ghi

❌
```
Qua kiểm tra nhiều lần thì tôi thấy có vẻ như màn Sửa lớp không chặn mã trùng, điều này có
thể là do validate chỉ được gắn ở màn Thêm, cũng có khả năng BA chưa chốt yêu cầu này nên
tuỳ anh quyết định xem có phải bug không.
```

✅
```
Màn Sửa hồ sơ lớp cho lưu `Mã lớp` đã tồn tại.

1. Mở `Hồ sơ lớp học` › Khối 1, trường `TEST 1`, năm 2026-2027.
2. Chọn lớp `1B` › Sửa.
3. Đổi `Mã lớp` thành `1A` (đã tồn tại) › Ghi.

Kết quả: toast `Lưu thành công`, DB có hai bản ghi cùng `MA_LOP = 1A`.
Kỳ vọng (`NT-LOP-042`, ô Kết quả mong đợi): toast `Mã lớp đã tồn tại`, bản ghi không đổi.
Màn Thêm chặn đúng cùng tình huống này.
```

Ba thứ bản ❌ làm DEV phải tự đoán: **bước nào**, **thấy gì**, **đáng lẽ thấy gì**. Và nó hỏi lại người
đọc *"có phải bug không"* — câu đó phải trả lời **trước** khi mở issue, không phải trong issue.

---

## 2. Trộn phỏng đoán nguyên nhân vào phần hiện tượng

❌ `Nguyên nhân: validate thiếu ở layer service, cần thêm check unique ở BE.`

✅ `Phạm vi quan sát: màn Thêm chặn, màn Sửa không chặn. Chưa xác định tầng gây lỗi.`

Đoán tầng mà đoán sai thì DEV đi tìm sai chỗ, rồi quay lại hỏi — chậm hơn là không đoán. Nêu **đối
chứng đã làm** (Thêm chặn / Sửa không) thì DEV tự khoanh được, nhanh hơn mọi phỏng đoán.

---

## 3. Nói "bug" khi chưa chắc

❌ `Có thể là bug, tuỳ BA chốt lại yêu cầu.`

✅ *(không mở issue)* `OBSERVATION: màn 1.2 hiện "chưa khai báo" khi cờ IS_CO_PHAN_HIEU = 0. Chưa có neo nào nói đây là sai — ghi knowledge/decisions/, KHÔNG log bug.`

Mở một issue mang chữ *"có thể"* là đẩy việc phán cho người khác. Chưa chắc thì **đi đo**; đo xong không
có neo thì nói thẳng **không phải bug** và ghi `OBSERVATION`.

---

## 4. Evidence sai định dạng, hoặc sai bước

❌ Đính `trace.zip` và `console.log`, ảnh chỉ có màn danh sách sau khi đã lưu.

✅ Case tầng bug (`product_bug`) nên cần ảnh TỪNG step: ô `Mã lớp` lúc gõ `1A` · toast `Lưu thành công` · lưới có hai dòng `1A`. PII đã mask.

Độ sâu evidence theo mức: **case thường** cần 1 ảnh/video ở bước **QUYẾT ĐỊNH**; **case tầng bug**
(`product_bug`/`api_bug`) cần ảnh **TỪNG step**. MỌI step vẫn phải có status. Bug ở mục này là
`product_bug`, nên nó thuộc nhóm thứ hai.

`trace.zip` và `.log` bị cấm làm evidence. Và ảnh *sau khi xong* không chứng minh được bước nào sai.

---

## 5. Log bug cho thứ không phải bug sản phẩm

❌ Log Backlog cho một case `BLOCKED` vì UAT thiếu dữ liệu.

✅ Ghi `BLOCKED` kèm lý do trong `session.md`, hẹn DBA nạp. **Không** mở issue.

`setup_failure` và `SKIP` không bao giờ thành issue. Một issue sai tốn của DEV nhiều hơn một dòng
`BLOCKED` tốn của QA.

---

## 6. Trailer thừa và lập luận dài bê vào Backlog

❌
```
TC: NT-LOP-042
Tầng: product_bug
Phân tích: như đã trình bày ở trên, dựa trên ba lượt rerun và đối chiếu với màn Thêm...
```

✅ *(bỏ hẳn ba dòng trên)* — mã TC và tầng lỗi đã nằm ở trường riêng của issue; lập luận dài ở lại claim.

Backlog là chỗ DEV đọc để **sửa**, không phải chỗ đọc để **tin**. Phần thuyết phục thuộc về Bug Claim
Gate, đã làm xong trước khi issue được mở.
