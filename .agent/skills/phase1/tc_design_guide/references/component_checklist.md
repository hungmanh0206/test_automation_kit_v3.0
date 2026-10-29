# Checklist component — rà NGOÀI form nhập

> Form nhập chỉ là một phần của màn. Phần dưới đây là thứ hay bị bỏ qua vì nó "không phải field".
> Máy chấm: `npm run dim:coverage` các chiều ghi ở từng mục.

---

## Lưới / bảng dữ liệu — `data_table` · §4 UI, §12 Display

- **Tên cột đúng nguyên văn** tài liệu, **đủ cột**, **đúng thứ tự**. Ba thứ khác nhau, ba case khác nhau.
- Lưới **rỗng**: có empty-state không, hay bảng trắng trơn?
- **Một dòng** vs **nhiều dòng** vs **rất nhiều dòng**.
- Giá trị **dài** trong ô: cắt, xuống dòng, hay phá vỡ bố cục?
- Giá trị **null** hiển thị ra sao — rỗng, `-`, hay chữ "null"?

## Sắp xếp — §4

- Sắp tăng/giảm cho **từng cột sắp được**.
- Sắp theo cột **số** phải theo số, không theo chuỗi (`10` không được đứng trước `9`).
- Sắp theo cột **tiếng Việt có dấu** — thứ tự bảng chữ cái tiếng Việt, không phải thứ tự ASCII.
- Sắp xong **chuyển trang** thì thứ tự còn giữ không?

## Phân trang — `pagination` · §4

- Trang đầu · trang cuối · trang giữa · đổi số dòng mỗi trang.
- **Tổng số bản ghi** khớp với số đếm thật.
- Trang cuối **lẻ dòng** (vd 23 bản ghi, 10 dòng/trang).
- Đang ở trang 3 rồi **lọc** cho ra 5 kết quả: có nhảy về trang 1 không, hay hiện trang trống?

## Bộ lọc / tìm kiếm — `filter` · §4, và **cô lập đơn vị** (bảo mật)

- Lọc không ra kết quả · lọc ra đúng một · lọc rồi xoá lọc.
- Nhiều điều kiện lọc **cùng lúc** — đây là chỗ dùng `PW` (pairwise).
- Tìm kiếm: chuỗi rỗng · khoảng trắng · ký tự đặc biệt · **tiếng Việt có dấu và không dấu**.
- **Kết quả có lẫn dữ liệu đơn vị khác không** — rò ở mức TẬP dữ liệu, khác IDOR theo một id.
  Máy: `npm run security:check` nhóm `tenantIsolation`.

## Modal / popup — `modal` · §4

- Mở · đóng bằng nút · đóng bằng `Esc` · đóng bằng click nền.
- Nhập dở rồi đóng: có hỏi xác nhận không, dữ liệu có mất không?
- Mở modal khi **đang có modal khác**.
- **Mở thẳng URL của modal khi chưa đăng nhập** — phải bị đẩy về Đăng nhập.

## Toast / thông báo — `toast` · §12

- Thông báo thành công · lỗi · cảnh báo.
- Nội dung nói **cái gì đã xảy ra**, không phải "Thành công!".
- Thông báo lỗi nêu **ô nào** sai.
- Tự tắt sau bao lâu; nhiều toast cùng lúc thì chồng hay thay thế?

## Nút và hành động — §10 Guard

- Nút **bị ẩn** vs nút **bị khoá** — hai trạng thái khác nhau, và **ẩn ≠ cấm**: ẩn nút ở UI mà API vẫn
  nhận thì đó là lỗ. Máy: `npm run authz:expand` nhóm `an_khac_cam`.
- Bấm **hai lần liên tiếp** vào nút gửi. Máy: `npm run concurrency:check` kịch bản `submit_dup`.
- Nút ở trạng thái đang xử lý: có khoá lại không?

## Upload / Export — §7

- Export khi lưới **rỗng** · khi đang **lọc** (xuất theo lọc hay xuất hết?).
- Tên file, phần mở rộng, encoding (tiếng Việt trong CSV).
- Số cột và thứ tự cột trong file xuất khớp với lưới.
- Import: file đúng mẫu · sai cột · thừa cột · dòng rỗng · file rất lớn.

## Điều hướng — §6 E2E

- Bấm **Quay lại** của trình duyệt giữa luồng.
- **Refresh** giữa luồng — form còn dữ liệu không?
- Mở **hai tab** cùng màn, sửa ở tab này rồi lưu ở tab kia.


## Vòng đời CRUD — `crud` · §13 Business logic, §23 DB persistence

- **Tạo** rồi tìm lại bản ghi đó **trong lưới** — tạo xong mà lưới không đổi là đã hỏng.
- **Xem chi tiết** khớp đúng dữ liệu vừa tạo, từng ô một, không chỉ ô tiêu đề.
- **Sửa** rồi lưu, rồi đọc lại ở **cả lưới lẫn màn chi tiết** — hai nơi lệch nhau là một bug riêng.
- **Xoá**: hộp xác nhận phải có thật; bấm Huỷ giữ nguyên, bấm OK mới xoá. Nhiều màn QEMIS cần **nhiều
  hơn một bước** để xoá thật, nên dừng ở bước giữa trông y hệt "app không cho xoá".
- Xoá bản ghi **đang được tham chiếu** (khoá ngoại) — chặn, hay xoá luôn làm hỏng chỗ khác?
- Tạo **trùng** giá trị unique.
- **Xoá mềm**: bỏ tích không phải lúc nào cũng xoá hàng — có chỗ chỉ hạ trạng thái. Oracle đếm theo
  hàng sẽ nói sai nếu không biết điều đó.

## Phân quyền — `permission` · §10 Guard, trục ⑥

- Mỗi vai trò × mỗi hành động = **một case**. Ma trận, không phải vài ca lấy mẫu.
- **Gõ thẳng URL** khi không có quyền — đây là phép đo thật, vì giấu nút không phải là chặn.
- Nút/ô bị ẩn hay bị khoá **đúng theo vai trò**.
- Ô khoá ở UI mà **server vẫn nhận** giá trị gửi lên: sửa `_ClientState` rồi gửi. Khoá ở client là
  gợi ý, không phải luật.
- **Chặn ở màn Thêm KHÔNG suy ra chặn ở màn Sửa** — lập ma trận luật × đường vào, đo từng ô.

## Luồng trạng thái — `status_flow` · §13, §17

- Mỗi chuyển trạng thái **hợp lệ** = một case.
- Mỗi chuyển trạng thái **KHÔNG hợp lệ** = một case, và case đó phải chứng minh nó **bị chặn**.
  Thiếu vế này thì bảng trạng thái chỉ chứng minh đường thuận đi được.
- Hành động nào **mở** và hành động nào **khoá** ở từng trạng thái.
- Trạng thái đọc từ đâu: nhãn trên màn, hay cột trong DB? Hai nguồn lệch nhau là một bug riêng.

## Nhóm tab — `tab` · §4 UI

- Ô bắt buộc nằm ở **tab khác** tab đang mở: bấm Ghi có báo đúng chỗ thiếu không, hay báo trống trơn?
- Chuyển tab rồi quay lại — dữ liệu đã gõ **còn không**?
- Lỗi validate ở tab ẩn: app có **tự mở tab đó** ra không?
- Bẫy automation đã đo (07/10/2026): phần tử của tab đang ẩn vẫn **nằm trong DOM**, nên click không mở
  và triệu chứng giống hệt lỗi công cụ. Dấu hiệu phân biệt: `offsetParent === null`.

---

## Một câu hỏi cuối cho cả màn

**Màn này có gì KHÔNG nằm trong tài liệu không?** Chiều ngược (`spec:gap`) đi từ thứ quan sát được về
tài liệu. Thấy một ô/nút/cột không có trong đặc tả thì đó là **câu hỏi**, không phải thứ để tự suy ra
kỳ vọng.
