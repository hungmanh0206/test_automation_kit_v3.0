---
vi_sao: "`tc:review` đọc THƯ MỤC testcase của một task rồi tự ghi file này, nó không nhận một file rời qua cờ nào. Nên không máy nào kiểm được mẫu này ở dạng file lẻ; khuôn của nó được gác bằng ca `tc-review.spec` so với các dòng `md.push` trong scripts/qa/tc_review.js."
---

# Mẫu `tc-review.md` — bản đã điền

> Bản **đã điền xong** trên một bộ 6 case hồ sơ lớp học, không phải khung trống. Khuôn dưới đây khớp
> đúng thứ `npm run tc:review` ghi ra `<TASK_OUTPUT_DIR>/reports/tc-review.md`.
>
> Đọc mẫu này là thấy ba điều khó thấy khi đọc mô tả skill: cột `Chưa đạt ở đâu` phải **trích nguyên
> văn** chỗ sai chứ không ghi tên tiêu chí, tiêu chí gắn `AI` **không được cộng thành đạt**, và mục
> TC trùng là chỗ hay bị bỏ qua nhất.

---

# Review chất lượng bộ testcase

Sinh bằng `npm run tc:review`. 6 case, trung bình **72.9%**.

> Tiêu chí đánh dấu `AI` là chỗ máy mới đo được một phần. Phần còn lại người hoàn tất.
> **Không cộng "máy không phán được" thành đạt** — làm thế là biến máy chấm thành máy phát chứng chỉ.

| TC ID | Điểm | Xếp loại | Chưa đạt ở đâu |
|---|---|---|---|
| NT-LOP-001 | 14/16 | Tốt | T5: bước 3 ghi "kiểm tra lưới" — không nêu cột nào, giá trị nào |
| NT-LOP-004 | 15/16 | Tốt | T8 `AI`: tag `[Validation]` có, nhưng chưa trỏ `[BR-…]` nào |
| NT-LOP-005 | 11/16 | Đạt | T3: `Kết quả mong đợi` ghi "lưu thành công" — chung chung, không nêu dấu hiệu quan sát được · T6: thiếu case âm cho ô `Mã lớp` |
| NT-LOP-012 | 16/16 | Tốt | — |
| NT-LOP-013 | 9/16 | Chưa đạt | T1: tiêu đề "Test thêm lớp" không tự đủ nghĩa · T3: thiếu ô `Kết quả mong đợi` · T4: `Tiền điều kiện` ghi "đã đăng nhập" mà không nêu tài khoản cấp nào |
| NT-LOP-020 | 5/16 | Chưa đạt | T2: `Dữ liệu Test` rỗng · T3: kỳ vọng ghi "hệ thống hiển thị đúng" · T5: không có bước nào |

## TC trùng (cùng bước + cùng dữ liệu) — cân nhắc gộp

- NT-LOP-004 ≡ NT-LOP-005

---

## Đọc bản này thế nào

**Trung bình 72.9% KHÔNG phải điểm của bộ.** Nó là trung bình tỉ lệ từng case, nên một case 5/16 bị
pha loãng bởi năm case tốt. Chỗ phải xử là **danh sách `Chưa đạt`**, không phải con số trung bình.

**Hai case `Chưa đạt` chặn publish**, không phải "sửa sau". NT-LOP-020 thiếu cả dữ liệu, cả kỳ vọng,
cả bước — nó chưa phải một testcase, nó là một cái tên.

**Dòng `AI` ở NT-LOP-004 là nợ, không phải đạt.** Máy thấy có tag nhưng không biết tag đó trỏ đúng
rule hay không. Chạy `npm run domain:trace-back` để biết, đừng tự kết luận.

**Mục TC trùng chỉ nêu cặp, không tự gộp.** Hai case trùng bước và dữ liệu vẫn có thể cố ý khác nhau
ở ô `Kết quả mong đợi`; gộp hộ là xoá mất một nhánh kiểm.
