# Checklist theo loại field (22 dòng · 16/18 mã canonical)

> Mở khi đang viết case cho một form. Mỗi loại ghi: **phải có case gì** · chiều của B · bẫy hay dính.
> Không phải loại nào cũng áp dụng — nhưng loại nào có trên màn mà thiếu case thì đó là bỏ sót, không
> phải lựa chọn.
>
> Máy chấm chung cho cả bảng: `npm run dim:coverage` chiều **§3** (field validation) và **§12**
> (display conformance). Nhãn, placeholder, thứ tự cột thuộc §12.

---

| # | Mã | Loại field | Phải có case | Bẫy hay dính |
|---|---|---|---|---|
| 1 | `text` | **Text ngắn** | rỗng · 1 ký tự · max · max+1 · khoảng trắng đầu/cuối | maxlength ở DOM cắt âm thầm, không báo lỗi — case "max+1" thành PASS giả |
| 2 | `textarea` | **Text dài / textarea** | xuống dòng · rất dài · ký tự đặc biệt | lưu được nhưng hiển thị lại mất xuống dòng |
| 3 | `text` | **Tiếng Việt có dấu** | đủ dấu · `đ/Đ` · tổ hợp dấu (NFC vs NFD) | hai chuỗi trông giống nhau mà `===` trả false; tìm kiếm không ra |
| 4 | `number` | **Số nguyên** | 0 · âm · min-1/min/max/max+1 · chữ trong ô số | ô number của trình duyệt tự chặn chữ ⇒ case âm bản không chạy được qua UI |
| 5 | `number` | **Số thập phân** | số chữ số sau dấu phẩy · làm tròn · dấu phẩy vs dấu chấm | lưu `540000.0` đọc lại thành `540000` — đổi kiểu, không đổi giá trị |
| 6 | `number` | **Tiền** | 0 · âm · rất lớn · định dạng nhóm nghìn | hiển thị có dấu phân cách mà gửi lên server cũng mang dấu ⇒ parse hỏng |
| 7 | `date` | **Ngày** | hợp lệ · 29/02 năm nhuận · 31/04 · quá khứ/tương lai · định dạng nhập tay | biên "ngày cuối" lệch một ngày vì `<` thay vì `<=` |
| 8 | `time` | **Ngày + giờ, múi giờ** | nhập 23:00 đọc lại vẫn 23:00 · đổi ngày khi qua nửa đêm | lưu UTC hiển thị local ⇒ lệch một ngày; nối **§24 Time** |
| 9 | `date_range` | **Khoảng ngày (từ–đến)** | từ > đến · bằng nhau · một đầu rỗng | chỉ kiểm từng ô, không kiểm quan hệ giữa hai ô |
| 10 | `dropdown` | **Dropdown / select** | giá trị mặc định · chọn rồi bỏ chọn · danh sách rỗng · **giá trị cũ ngoài danh mục** | bản ghi cũ mang giá trị không còn trong danh mục ⇒ hiện rỗng, lưu lại là **mất dữ liệu** (nối **§25 Legacy**) |
| 11 | `dropdown` | **Dropdown phụ thuộc (cascade)** | đổi cha thì con reset · chọn con rồi đổi cha · cha rỗng | con giữ giá trị cũ của cha trước đó — hàng lỗi kinh điển |
| 12 | `checkbox_radio` | **Checkbox** | tích · bỏ tích · "chọn tất cả" · trạng thái không xác định | "chọn tất cả" khi lưới đang lọc: chọn trang này hay cả tập? |
| 13 | `checkbox_radio` | **Radio** | mỗi lựa chọn một case · không chọn gì · đổi lựa chọn | bỏ sót case "không chọn gì" vì UI có sẵn mặc định |
| 14 | `file_upload` | **File upload** | đúng loại · sai loại · quá dung lượng · 0 byte · tên có dấu | đổi đuôi file để qua kiểm client — phải kiểm cả phía server |
| 15 | `email` | **Email** | đúng · thiếu `@` · nhiều `@` · ký tự unicode · rất dài | regex client chặt hơn server hoặc ngược lại |
| 16 | `phone` | **Số điện thoại** | đủ số · thiếu số · có `+84` · có khoảng trắng/dấu gạch | PII — dữ liệu test **không** dùng số thật (`CLAUDE.md` §1) |
| 17 | `text` | **Mã định danh (CCCD, mã số thuế…)** | đủ độ dài · sai độ dài · trùng · ký tự chữ | CCCD và số định danh cá nhân **không phải một thứ** — đừng kiểm chung |
| 18 | `computed` | **Ô chỉ đọc / ô tự tính** | giá trị đúng công thức · không sửa được qua UI · **không sửa được qua URL/ClientState** | ô khoá ở UI mà server vẫn nhận giá trị gửi lên — nối **trục ⑥ phân quyền** và `oracle:calc` cho phần công thức |
| 19 | `password` | **Mật khẩu** | độ dài tối thiểu · ký tự đặc biệt · hiện/ẩn · dán được không · ô xác nhận khớp/không khớp | giá trị thật **không bao giờ** vào evidence hay log (`CLAUDE.md` §1) — ảnh chụp màn đăng nhập phải che ô này |
| 20 | `date_month_filter` | **Lọc theo tháng / năm** | tháng không có dữ liệu · tháng tương lai · đổi năm giữ hay reset tháng · biên tháng 1 và tháng 12 | ô lọc tháng và ô lọc ngày là HAI thứ: lọc tháng không có khái niệm "ngày cuối kỳ", nên biên của nó là biên THÁNG |
| 21 | `multiselect` | **Combo đa chọn / tag** | chọn 0 · chọn 1 · chọn tất cả · bỏ tích từng mục · tích rồi postback | `get_value()` của combo đa chọn LUÔN rỗng — lựa chọn nằm ở danh sách mục *đã tích*; và ô tích bị xoá sau mỗi postback, nên case xanh mà số lưu được vẫn sai |
| 22 | `slider` | **Ô số có bước nhảy (stepper / slider)** | min · max · bước nhảy không hợp lệ · gõ tay thay vì kéo/bấm | `RadNumericTextBox`: gõ xong mà **không blur** thì ô hiển thị đúng còn server nhận rỗng — phải Tab ra ngoài rồi đọc `_ClientState` |

---


## Hai loại trong danh mục mà CHƯA GẶP trên app đang test

Danh mục canonical (`.agent/config/ui_components.json`) có 18 mã. Hai mã dưới đây **chưa có dòng
checklist**, và đó là một lựa chọn có căn cứ chứ không phải bỏ sót:

| Mã | Trạng thái | Phép đo |
|---|---|---|
| `otp` | **chưa gặp** (đo 29/10/2026) | 0 dấu hiệu OTP/MFA trên 2.592 field mà lượt recon 14/10/2026 đọc được. app mẫu đăng nhập bằng captcha, không bằng OTP. |
| `richtext` | **chưa gặp** (đo 29/10/2026) | `"contenteditable": true` = **0/2.592** field; không có `RadEditor`/`ckeditor`/`tinymce` nào trong artefact recon. |

> Đây là khai **chưa gặp**, KHÔNG phải khai "không cần". Gặp lần đầu thì viết dòng checklist rồi xoá
> mục khỏi bảng này — `tc-design-guide.spec.ts` đối soát hai bên nên bỏ quên sẽ bị chặn.
>
> Và "chưa gặp" chỉ nói về **app mẫu tới ngày đo**. Kit dùng cho app khác thì hai loại này phải
> được rà lại từ đầu — ngày ở trên là để biết lời khai đã cũ bao nhiêu, không phải để tin mãi.

## Ba câu hỏi áp cho MỌI loại field

1. **Bắt buộc hay không?** Ô bắt buộc để trống phải báo lỗi — và thông báo phải nói **ô nào**.
2. **Lưu rồi đọc lại có còn nguyên không?** Nối chiều §23 (DB persistence) nếu có tầng DB.
3. **Bản ghi CŨ của ô này thì sao?** Ô nay bắt buộc mà bản ghi cũ để trống thì mở form Sửa có lưu nổi
   không — nối **§25 Legacy**.

Câu thứ ba hay bị bỏ qua nhất, vì bộ TC luôn kiểm trên bản ghi do chính lượt test tạo ra — tức bản ghi
sinh dưới luật hôm nay, trong khi hệ thống thật chạy phần lớn trên bản ghi của luật hôm qua.
