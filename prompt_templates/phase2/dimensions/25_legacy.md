# §25 — Dữ liệu cũ (bản ghi có trước luật, cột, hoặc định dạng hiện tại)

> Tag bắt buộc trong tiêu đề case: **`[Legacy]`**. Loại case: **Functional**.
>
> Mở khi màn **đọc hoặc sửa bản ghi đã tồn tại từ trước**:
>
> - hồ sơ của năm học cũ
> - bản ghi tạo trước khi thêm ô bắt buộc
> - giá trị theo danh mục đã đổi mã
> - dữ liệu nhập từ hệ thống tiền nhiệm

## Vì sao chiều này tồn tại

Mọi case còn lại đều kiểm trên **bản ghi do chính lượt test tạo** — tức bản ghi sinh ra dưới luật hôm nay.
Nhưng hệ thống thật chạy phần lớn thời gian trên bản ghi **sinh ra dưới luật hôm qua**. Hai nhóm đó khác
nhau ở đúng chỗ dễ vỡ nhất:

| Tình huống | Case thường không bao giờ gặp |
|---|---|
| Ô nay **bắt buộc**, bản ghi cũ để trống | mở form Sửa ⇒ không lưu được, kể cả khi chỉ sửa ô khác |
| Ô nay có **danh sách chọn**, bản ghi cũ mang giá trị ngoài danh sách | combobox hiện rỗng, lưu lại là **mất dữ liệu** |
| Độ dài tối đa nay ngắn hơn giá trị cũ | cắt âm thầm khi lưu |
| Mã danh mục đã đổi (mã cũ không còn trong danh mục) | hiển thị mã trần, hoặc rỗng |
| Bản ghi cũ thiếu cột mới thêm | NULL đi qua phép tính thành 0 |
| Quy tắc chống trùng mới, dữ liệu cũ **đã** trùng sẵn | mọi lần Sửa đều bị chặn |

Lớp lỗi quan trọng nhất ở đây: **bản ghi cũ hợp lệ theo luật cũ, nhưng không mở được hoặc không lưu
được theo luật mới.** Người dùng thật gặp nó ngay ngày đầu. Suite thì không bao giờ, vì suite luôn tự tạo
dữ liệu mới.

## Giới hạn an toàn — phần sẽ không nới

> ⛔ **CHỈ ĐỌC bản ghi cũ.** Không chạy script di trú trên UAT, không sửa dữ liệu cũ để "cho nó hợp lệ",
> không xoá bản ghi lạ. Dữ liệu cũ trên UAT là **tài sản của người khác**, và nó là thứ duy nhất chứng minh
> được hành vi legacy — sửa nó là xoá luôn bằng chứng.

Tìm bản ghi cũ đi qua `tests/support/setup/db/uatDbClient.ts`, và **chỉ `SELECT`** — lint read-only chặn
phần còn lại. DB ở đây dùng để **định vị** bản ghi, không dùng để phán. Đo xong vẫn phải mở màn và chụp
ảnh: theo `CLAUDE.md` §2 và §4, DB không phải evidence.

Câu định vị phải **ghim năm học** và lọc theo tiêu chí của chính luật đang đo. Ví dụ hình dạng (không phải
câu chạy được của mọi dự án):

```sql
-- bản ghi tạo TRƯỚC khi ô X thành bắt buộc
SELECT TOP 20 id, ngay_tao FROM <bảng>
WHERE ma_nam_hoc = :namHoc AND (<cột X> IS NULL OR <cột X> = '')
ORDER BY ngay_tao
```

## Checklist — mỗi dòng một case

| # | Ca | Kỳ vọng phải nói rõ |
|---|---|---|
| 1 | **Mở** bản ghi cũ ở màn xem | hiện đủ, không trắng ô, không vỡ màn |
| 2 | **Mở form Sửa** bản ghi cũ thiếu ô nay bắt buộc | app đòi điền, hay chặn luôn? — hai hành vi khác nhau, phải chốt với BA |
| 3 | **Sửa một ô KHÁC rồi lưu** | ô cũ trống có bị ép điền không, và dữ liệu cũ có **còn nguyên** không |
| 4 | Giá trị cũ **ngoài danh mục** hiện tại | giữ nguyên hay đổi về rỗng — lưu lại có mất không |
| 5 | Giá trị cũ **dài hơn** maxlength hiện tại | không được cắt âm thầm |
| 6 | Bản ghi cũ **đã trùng** theo quy tắc chống trùng mới | chặn Sửa là ĐÚNG hay SAI — chốt trước, đừng suy từ thông báo lỗi |
| 7 | Phép tính/tổng trên bản ghi thiếu cột mới | NULL không được lặng lẽ thành 0 — neo bằng oracle ⑦ |
| 8 | Lọc, sắp xếp, xuất có bao gồm bản ghi cũ không | bộ lọc mới hay loại mất chúng |

## Ba ràng buộc

**① "Không tìm thấy bản ghi cũ" KHÁC "không có lỗi".** Phải nói rõ đã tìm trong **phạm vi nào** và tìm
được bao nhiêu. Không tìm thấy thì ghi `BLOCKED` kèm câu hỏi xin dữ liệu, **không** phải PASS.

Bài học đã trả giá: hai case từng khai BLOCKED vì "chưa tìm thấy", trong khi phạm vi đếm sai. Mẫu số phải
là **toàn UAT** theo tiêu chí, không phải vài bản ghi mở tay.

**② Đừng nhận diện bản ghi cũ bằng "trông có vẻ cũ".** Neo bằng tiêu chí đo được: `ngay_tao` trước mốc
luật đổi, hoặc chính cột đang thiếu, hoặc cột mang giá trị ngoài danh mục. Lọc theo mẫu dữ liệu, kiểu
"CCCD trông giả", sẽ quét trúng người thật.

**③ Mốc "luật đổi khi nào" là câu hỏi cho BA, không phải suy từ code.** Không có mốc thì ca 1 đến 3 vẫn
đo được, vì chúng dựa trên *trạng thái* bản ghi: thiếu ô, hoặc ngoài danh mục.

Ca 4 đến 8 thì khác: không có neo thì phải ghi `OBSERVATION`. Nhất quán giữa các bản ghi cũ **không**
chứng minh hành vi đó đúng.

## Phần lớn chiều này là `Manual`, và nói thẳng ra

Dựng một bản ghi "cũ" bằng automation thì **không làm được mà không ghi vào UAT**. Mà ghi thì vi phạm
`CLAUDE.md` §2.

Nên đường đo đúng là: **tìm** bản ghi cũ có sẵn bằng read-only, rồi thao tác trên UI và chụp ảnh. Case nào
không tìm được bản ghi phù hợp thì ghi `BLOCKED`, không ép xanh.

Phần tự động hoá được gồm hai bước. Bước **định vị** là câu `SELECT` ở trên. Bước **hậu kiểm không đổi
gì** là chụp trạng thái trước và sau, để chứng minh lượt test chỉ đọc.

## Liên quan

- §3 Field validation: ô nay bắt buộc
- §12 Display: giá trị ngoài danh mục hiển thị ra sao
- §17 Change impact: luật mới đụng dữ liệu cũ
- §23 DB Persistence: đọc bản ghi
- §24 Time: bản ghi cũ mang ngày theo luật cũ
- trục ⑦ `oracle_calc`: NULL trong phép tính
