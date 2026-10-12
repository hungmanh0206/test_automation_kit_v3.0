# Bẫy đánh số — bước có số, bước không số, và số không liên tục

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |
|---|---|---|---|---|---|---|---|---|---|---|
| GOLD_TC_010 | Functional | [Positive] | Lớp học | Ba bước đánh số liên tục | [ui] Đã đăng nhập | n/a | 1. Mở màn<br>2. Bấm Thêm<br>3. Bấm Ghi | 1. Màn mở<br>2. Form hiện<br>3. Lưu thành công | Medium | Medium |
| GOLD_TC_011 | Functional | [Positive] | Lớp học | Bước KHÔNG đánh số | [ui] Đã đăng nhập | n/a | Mở màn rồi bấm Thêm | Form hiện ra | Medium | Low |
| GOLD_TC_012 | Functional | [Negative] | Lớp học | Số KHÔNG liên tục (1, 3, 4) | [ui] Đã đăng nhập | n/a | 1. Mở màn<br>3. Bấm Thêm<br>4. Bấm Ghi | 1. Màn mở<br>3. Form hiện<br>4. Lưu | Low | Low |
