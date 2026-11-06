---
kiem_bang: node scripts/qa/design_gate.js --mode checklist --file
vi_sao: Mẫu này tự qua được máy vì `design_gate --mode checklist` nhận một file rời qua `--file`.
---

# Mẫu checklist rà tay — Hồ sơ lớp học (Smoke)

> Bản **đã điền xong** trên miền thật, không phải khung trống. Đọc nó là thấy đủ hình dạng để viết bản
> của mình: 7 cột, mỗi mục một dòng, kỳ vọng nêu dấu hiệu quan sát được trên UI.
>
> Mẫu này **tự qua máy**: `node scripts/qa/design_gate.js --mode checklist --file <file này>` trả ĐẠT.
> Sửa mẫu mà làm máy đỏ thì `skills:template:check` chặn, nên mẫu không mục dần theo thời gian.

## Checklist Smoke — Hồ sơ lớp học (12 mục · ~15 phút)

Luồng sống còn: Tạo lớp · Phân công chủ nhiệm

### Nhóm: Tạo lớp

| # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |
|---|---|---|---|---|---|---|
| 1 |  | Mở màn Hồ sơ lớp học theo cấp Tiểu học | Lưới hiện cột `Mã lớp`, `Tên lớp`, `Khối`, `GVCN` | P1 | REQ-LOP-01 | NT-LOP-001 |
| 2 |  | Bấm Thêm mới khi đã chọn Khối 1 | Form mở trong iframe, ô `Khối` đã điền sẵn `Khối 1` | P1 | REQ-LOP-02 | NT-LOP-004 |
| 3 |  | Ghi lớp mới với Mã lớp `1A` đã tồn tại | Toast đỏ `Mã lớp đã tồn tại`, lưới không thêm dòng | P1 | REQ-LOP-03 | NT-LOP-012 |
| 4 |  | Ghi lớp mới hợp lệ Mã `1C` Tên `1C` | Toast `Lưu thành công`, lưới có dòng `1C` ở Khối 1 | P1 | REQ-LOP-02 | NT-LOP-005 |
| 5 |  | Bỏ trống Tên lớp rồi Ghi | Ô `Tên lớp` viền đỏ, kèm chữ `Bắt buộc`, form không đóng | P2 | REQ-LOP-03 | NT-LOP-013 |

### Nhóm: Phân công chủ nhiệm

| # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |
|---|---|---|---|---|---|---|
| 6 |  | Mở màn Phân công chủ nhiệm Kỳ 1 | Lưới hiện cột `GVCN 1`, `GVCN 2` cho từng lớp | P1 | REQ-PC-01 | NT-PC-001 |
| 7 |  | Chọn một giáo viên cho GVCN 1 của lớp `1A` | Combo hiện tên đã chọn, nút `Lưu` bật từ mờ sang rõ | P1 | REQ-PC-02 | NT-PC-004 |
| 8 |  | Gán cùng một giáo viên làm GVCN 1 của hai lớp | Toast đỏ nêu tên giáo viên bị trùng, không lớp nào đổi | P2 | REQ-PC-03 | NT-PC-011 |

### Nhóm: Lọc và phân trang

| # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |
|---|---|---|---|---|---|---|
| 9 |  | Lọc lưới theo Khối 2 | Mọi dòng hiện ra có cột `Khối` bằng `Khối 2` | P2 | REQ-LOP-04 | NT-LOP-020 |
| 10 |  | Sang trang 2 của lưới lớp | Số trang đổi sang `2`, dòng đầu khác dòng đầu trang 1 | P3 | REQ-LOP-05 | NT-LOP-022 |
| 11 |  | Mở tab Danh sách học sinh của lớp `1A` | Tab chuyển, lưới hiện cột `Họ tên`, `Ngày sinh` | P2 | REQ-LOP-06 | NT-LOP-030 |
| 12 |  | Đăng nhập tài khoản chỉ-xem rồi mở màn Hồ sơ lớp | Nút `Thêm mới` và `Xóa` không hiện trên thanh công cụ | P1 | REQ-LOP-07 | NT-LOP-040 |

### Component

| Component | Số mục đã phủ | Lý do nếu chưa phủ |
|---|---|---|
| Data Table / List | 1, 9, 10, 11 | |
| CRUD lifecycle | 2, 3, 4, 5 | |
| Permission / Role | 12 | |
| Modal / Dialog | 2 | |
| Notification / Toast | 3, 4, 8 | |
| Status flow |  | Hồ sơ lớp không có trạng thái chuyển tiếp; lớp chỉ có hoặc không |
| Pagination (phân trang) | 10 | |
| Filter (bộ lọc) | 9 | |
| Tab (nhóm tab) | 11 | |

### Ký nhận

| Môi trường | Build | Người thực hiện | Ngày | Kết quả |
|---|---|---|---|---|
| UAT | *(điền số build đang rà)* | *(tên người chạy)* | *(dd/mm/yyyy)* | *(đạt / không đạt / chặn)* |

> Bảng này là thứ `design:gate --mode checklist` nhắc khi thiếu. Không có nó thì một lượt rà tay không
> truy được về ai chạy trên build nào, và hai lượt rà khác build trông giống nhau.
