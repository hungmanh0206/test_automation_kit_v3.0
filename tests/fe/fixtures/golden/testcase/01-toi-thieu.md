# Bộ tối thiểu — 3 case, không có bẫy nào

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |
|---|---|---|---|---|---|---|---|---|---|---|
| GOLD_TC_001 | Functional | [Positive] | Hồ sơ trường | Mở màn hồ sơ trường | [ui] Đã đăng nhập cấp THCS | n/a | 1. Mở menu Hồ sơ trường | 1. Màn hiện 4 tab | Medium | Medium |
| GOLD_TC_002 | Functional | [Negative][BR-HS-004] | Hồ sơ trường | Bỏ trống Tên trường rồi Ghi | [ui] Đang ở form Sửa | Tên trường = rỗng | 1. Xoá ô Tên trường<br>2. Bấm Ghi | 1. Chặn lưu<br>2. Báo "Tên trường là bắt buộc" | High | High |
| GOLD_TC_003 | Functional | [Display][EP] | Hồ sơ trường | Hiển thị mã trường chỉ-đọc | [pre_existing] Trường đã có mã | n/a | 1. Mở tab Thông tin chung | 1. Ô Mã trường ở trạng thái chỉ-đọc | Low | Low |
