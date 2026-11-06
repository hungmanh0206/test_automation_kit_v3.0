# Anti-pattern khi thiết kế test case

> Mỗi mục: **dấu hiệu** · vì sao hỏng · **máy nào bắt được** (hoặc ghi thẳng là chưa có máy).
>
> Danh sách này không phải để đọc một lần. Nó là thứ rà lại sau khi viết xong một đợt case.

---

## 1. Kỳ vọng mô tả THAO TÁC thay vì KẾT QUẢ

❌ `Kết quả mong đợi: Bấm nút Lưu`
✅ `Kết quả mong đợi: Hiện thông báo "Lưu thành công", và dòng mới xuất hiện ở đầu lưới`

Thao tác đã nằm ở cột Các bước. Viết lại nó vào cột kỳ vọng nghĩa là case này **không kiểm gì cả** —
nó luôn PASS miễn là bấm được nút.

**Máy:** `npm run tc:review` (tiêu chí kỳ vọng kiểm được).

---

## 2. Kỳ vọng rỗng, hoặc "hiển thị đúng"

❌ `Hiển thị đúng` · `Hoạt động bình thường` · `Không có lỗi`
✅ `Toast "Lưu thành công" hiện, và lưới có dòng mã "1C-${RUN_ID}" ở Khối 1`

"Đúng" theo cái gì? Một kỳ vọng không nói giá trị/URL/element cụ thể thì người chạy phải tự đoán, và
hai người đoán khác nhau.

**Máy:** `npm run gate:gen-testcase` — **CHẶN**.

---

## 3. Một case kiểm năm thứ

❌ `Kiểm tra form thêm mới: nhập thiếu, nhập sai định dạng, nhập quá dài, bỏ trống, và lưu thành công`
✅ Tách năm case: `bỏ trống Tên lớp` · `Mã lớp trùng` · `Tên lớp 256 ký tự` · `Mã lớp có ký tự lạ` · `lưu hợp lệ`

Case đỏ thì không biết cái nào hỏng, và phải đọc lại toàn bộ bước mới đoán ra. Case xanh thì cũng
không biết năm phép kiểm có thật sự chạy hết không.

**Máy:** `npm run tc:review` (tiêu chí một case một mục tiêu).

---

## 4. Dữ liệu test viết "hợp lệ / không hợp lệ"

❌ `Dữ liệu test: tên hợp lệ`
✅ `Dữ liệu test: Họ tên = "Nguyễn Văn A", Ngày sinh = 01/01/2010`

Giá trị trừu tượng thì không chạy lại được, không khớp câu bước được, và hai lượt chạy dùng hai dữ
liệu khác nhau mà vẫn trông như cùng một case.

**Máy:** `npm run steps:match` (giá trị không bọc nháy thì không trích được).

---

## 5. Tiền điều kiện lẫn với thao tác

❌ `Tiền điều kiện: Đăng nhập, vào màn Hồ sơ lớp, bấm Thêm mới`
✅ `Tiền điều kiện: tài khoản cấp Tiểu học trường TEST 1, năm 2026-2027, Khối 1 đã có lớp 1A [ui]` — ba thao tác kia thuộc cột Các bước

"Bấm Thêm mới" là **bước 1**, không phải tiền điều kiện. Tiền điều kiện là thứ **phải có sẵn** trước
khi case bắt đầu — dữ liệu, trạng thái, quyền.

**Máy:** chưa có máy — **review tay**.

---

## 6. Case chỉ có đường hạnh phúc

Viết 20 case thêm/sửa/xoá thành công, 0 case nhánh lỗi. Bộ TC trông dày mà không chạm chỗ bug sống.

**Máy:** `npm run dim:coverage -- --enforce` — chặn khi chiều `negative` khai `required` mà 0 case.

---

## 7. Lấy thứ nhìn thấy trên màn làm kỳ vọng

Mở app, thấy ô hiện "Đang hoạt động", viết kỳ vọng là "Đang hoạt động". Nếu app đang sai thì case này
**khoá cái sai lại** và mọi lượt chạy sau đều xanh.

Quan sát là `observed`. Kỳ vọng phải có neo: đặc tả, `knowledge/domain` (`oracle_ref`), hoặc một câu
hỏi chưa trả lời.

**Máy:** `npm run domain:trace-back` (oracle ma) · `expansion_audit` (PASS/FAIL không neo bị hạ xuống
`OBSERVATION`).

---

## 8. Sửa expected cho case xanh

Case đỏ, nhìn lại thấy app trả giá trị khác, bèn sửa cột kỳ vọng cho khớp. Đây là cách nhanh nhất biến
một bug thành một tính năng đã được phê duyệt.

**Máy:** `npm run expected:check` — ghi sổ mọi thay đổi expected, và đòi lý do. **Phải chụp mốc trước**
(`--snapshot`) ở thời điểm bộ case được CHỐT; chưa chụp thì cửa trả `CHƯA ĐƯỢC GÁC` (exit 2), và đó
KHÔNG phải "đạt". Đo 30/10/2026: 1/5 task có mốc.

---

## 9. Case phụ thuộc thứ tự chạy

Case 5 chỉ chạy được nếu case 4 đã tạo dữ liệu. Chạy riêng case 5 thì đỏ; chạy lại cả bộ sau khi case 4
đổi thì cũng đỏ.

Mỗi case tự dựng tiền điều kiện của mình (UI/API/factory/hook — **không** bằng DB).

**Máy:** chưa có máy bắt phụ thuộc thứ tự — **review tay**.

---

## 10. Tag chiều gắn cho có

Gắn `[Security]` vào một case thêm mới bình thường để "cho đủ chiều". `dim:coverage` đếm theo tag, nên
nó sẽ thấy chiều đó đã phủ — trong khi không có phép kiểm bảo mật nào xảy ra.

**Máy:** `npm run tc:review` chấm kỳ vọng có mang bằng chứng của chiều đã gắn hay không. Phần còn lại
là **review tay** — tag là lời khai, và máy không đọc được ý định.

---

## 11. Viết xong là xong

Bộ TC đạt đủ chiều coverage vẫn bỏ sót theo **bề mặt**: cùng field ở màn khác, cùng giá trị hiển thị
nơi khác, chuỗi lưu trữ, nhánh, trạng thái kế cận, phân quyền, giá trị dẫn xuất.

**Máy:** `npm run expansion:plan` (chi phí theo risk band) · `expansion_audit` (đối chiếu band → trục
đã chạy).
