# Bẫy ký tự — icon, khoảng trắng vô hình, và ký tự có nghĩa

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |
|---|---|---|---|---|---|---|---|---|---|---|
| GOLD_TC_020 | Functional | [Positive] | Ghi chú | Ô có icon cảnh báo | [ui] Đã đăng nhập | n/a | 1. Mở màn | 1. ⚠ Hiện cảnh báo, ⛔ không cho lưu | Medium | Medium |
| GOLD_TC_021 | Functional | [Positive] | Ghi chú | Mũi tên là chữ nghĩa, KHÔNG phải trang trí | [ui] Đã đăng nhập | n/a | 1. Đi từ màn A → màn B | 1. Giá trị ở A ⇒ hiện đúng ở B | Medium | Medium |
| GOLD_TC_022 | Functional | [Positive] | Ghi chú | Ô có khoảng trắng không ngắt và zero-width | [ui] Đã đăng nhập | n/a | 1. Nhập giá trị​ có khoảng trắng lạ | 1. Hệ thống chuẩn hoá về khoảng trắng thường | Low | Low |
