# Báo cáo execute — TASK-DEMO — lượt 07/11/2026 09:12

Chạy 24 case · 19 PASS · 5 FAIL. Dưới đây là 5 ca đỏ kèm thứ đã ghi được của mỗi ca.

---

## TC_0201 — Điểm trường: số phòng học lưu sai

- `oracle_ref`: BR-DIEMTRUONG-004 — *"Số phòng học lưu nguyên giá trị người dùng nhập."*
- Nhập `12`, bấm Ghi, toast `Lưu thành công`.
- Sau F5 ô hiện `0`. Truy vấn DB: `SO_PHONG_HOC = 0`.
- Rerun 3/3 lượt cùng kết quả.
- Evidence: `step2-nhap-12.png` · `step4-sau-F5-hien-0.png`
- Mạng: không request nào trả mã >= 400.

## TC_0202 — Lưới điểm trường: gọi API xong trang trắng

- `oracle_ref`: UI-DIEMTRUONG-002 — *"Lưới hiện danh sách điểm trường của trường đang chọn."*
- `GET /api/diem-truong?maTruong=02847561` trả **500**.
- Thân response: `{"error":"NullReferenceException at DiemTruongService.LayDanhSach(line 142)"}`
- Rerun 3/3 lượt cùng mã 500.
- Evidence: `step1-luoi-trang.png` · `step1-network-500.png`

## TC_0203 — Thêm điểm trường: lượt chạy chết ở bước 3

- Log Playwright:
  ```
  TypeError: Cannot read properties of null (reading 'click')
      at tests/.../diem-truong.spec.ts:88:34
  ```
- Dòng 88 của spec: `await page.$('#btnLuu').click()`  ← `$()` trả `null` khi không thấy
- Ảnh `step3.png` cho thấy nút **Lưu** đang hiện trên màn, nhãn đúng, không bị khoá.
- Rerun 3/3 lượt chết cùng dòng 88.

## TC_0204 — Xoá điểm trường đang có lớp gán: không chạm được tới bước xoá

- `oracle_ref`: BR-DIEMTRUONG-002
- Tiền đề case đòi: **một điểm trường đã có >= 1 lớp gán vào**.
- Log: `[precondition] không tìm thấy điểm trường nào có lớp gán — bỏ qua phần còn lại`
- Lượt chạy dừng ở bước 1; không bước nào chạm tới nút Xoá.
- Evidence: `step1-khong-co-du-lieu.png`

## TC_0205 — Băng thông: không mở được màn

- Log: `page.goto: net::ERR_CONNECTION_REFUSED at http://uat-host/DiemTruong.aspx`
- Cùng lúc đó 4 case khác trên cùng màn cũng `ERR_CONNECTION_REFUSED`.
- 20 phút sau chạy lại một ca thì vào được màn bình thường.
- Evidence: `step1-khong-vao-duoc.png`
