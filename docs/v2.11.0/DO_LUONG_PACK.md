# Đo tác dụng của prompt pack — bốn lượt, ba lượt đầu KHÔNG DÙNG ĐƯỢC

Ghi ngày **09/11/2026**. Ba lượt đầu hỏng, mỗi lượt một lý do khác. Giữ lại vì chúng đắt hơn kết quả — và vì lượt thứ tư chỉ dùng được nhờ sửa đúng ba lý do ấy.

## Định làm gì

`benchmark_protocol.md` của bản enhanced V10 đòi đúng phép đo này — *"same model, same requirements,
A/B prompts, minimum 3 trials per task"* — rồi tự ghi **"not a completed benchmark"**. Kit có sẵn máy:
`skills:practice`. Thêm cờ `--khong-pack` là có hai nhánh trên cùng một đề.

Câu hỏi: **cho model tri thức miền có làm đổi kết quả không?**

## Lượt 1 — nhánh đối chứng CẦM SẴN ĐÁP ÁN

Đề: năm triệu chứng khác nhau trên một màn, gốc là Mixed Content khi vào bằng `https`.

| Nhánh | Kết quả |
|---|---|
có pack | 6/6 · 6/6 · 6/6 |
không pack | 6/6 · 6/6 · 5/6 |

Trông như *"khoảng cách ≈ 0"*. **Sai.** `dungGoc` chép **cả thư mục skill**, kể cả `templates/`, và
`run_report_reader/templates/bang-phan-loai-loi.md` — do chính tôi viết ở v2.10.0 — chứa nguyên văn đáp
án: *"host dev phát `http://` tuyệt đối nên trình duyệt chặn Mixed Content"*.

Dấu hiệu duy nhất là model nhả ra **đúng cách hành văn tôi nhận ra**. Một phép đo chỉ được cứu nhờ tình
cờ đọc kỹ thì lần sau nó sẽ không được cứu.

→ **Đã dựng máy gác:** sổ đáp án khai `tu_khoa_phan_biet`; ở nhánh `--khong-pack`, cụm nào có sẵn trong
thư mục làm bài thì **THOÁT 2**, không ra số. Nghiệm thu: nó đỏ đúng ca đã lừa tôi.

## Lượt 2 — đề quá dễ, phép đo chạm trần

Đổi sang bẫy kit **chưa có dòng nào**: lưới lớp chỉ hiện phân hiệu chính. Đề có cột `ID_PHAN_HIEU`.

Nhánh đối chứng đạt **5/5** — model tự nối 7 hàng lưới với `ID_PHAN_HIEU = 100`.

Hai nhánh cùng chạm trần thì **không phép đo nào phân biệt được**. Và nó dạy đúng chỗ pack có giá trị:
**không phải đọc một bảng đã đầy đủ, mà là biết phải đi đo cái gì khi bảng chưa có cột đó** — người
không biết về phân hiệu thì không bao giờ đưa cột ấy vào báo cáo.

→ Bỏ cột khỏi đề.

## Lượt 3 — bộ chấm đo CHÍNH TẢ, không đo lập luận

| Nhánh | L1 | L2 | L3 | Tổng |
|---|---|---|---|---|
có pack | 5/5 | 4/5 | 5/5 | **14/15** |
không pack | 4/5 | 4/5 | **1/5** | **9/15** |

Khoảng cách trông rõ. **Vẫn không dùng được.** Đọc lượt "1/5" thì nó là một trong những câu trả lời
**tốt nhất** của cả hai nhánh:

- *"CHƯA ĐỦ CĂN CỨ để gán `product_bug`"*, để `failureLayer` **trống**
- loại **năm** khả năng kèm bằng chứng từng cái
- nêu đúng vấn đề mẫu số: *"mẫu số 12 là con số do **người chạy tự định nghĩa**, không phải con số spec
  định nghĩa"*

Bộ chấm của tôi chấm oan **3 trong 4**: `P2` đòi cụm *"không phải lỗi sản phẩm"* nên trượt câu *"chưa đủ
căn cứ để gán product_bug"*; `P5` đòi cụm *"khác mẫu số"* nên trượt câu nói đúng ý bằng chữ khác; `P3`
đòi chữ *"phân hiệu"* nằm trong phép phân biệt.

Và nhánh đối chứng **vẫn rò**: `templates/bang-phan-loai-loi.md` có nhắc *"phân hiệu"* — máy gác không
bắt vì sổ chỉ khai `"phân hiệu chính"`, không khai `"phân hiệu"` trần.


## Lượt 4 — DÙNG ĐƯỢC

Ba thứ đã sửa, và mỗi thứ sửa đúng một lý do hỏng ở trên:

| Sửa | Chữa lỗi nào |
|---|---|
**Hợp đồng JSON nằm trong ĐỀ BÀI** | cả hai nhánh cùng có cấu trúc ⇒ pack chỉ còn thêm **giả thuyết miền**, không thêm hình thức |
**Bốn phép kiểm chấm TRƯỜNG, đúng một chấm NỘI DUNG** | lượt 3 chấm văn xuôi bằng regex và chấm oan 3/4 |
**Danh sách cách-viết khai TRƯỚC khi chạy** | hết chuyện nghĩ ra regex lúc đang chấm |
**Máy gác rò quét thư mục làm bài** | lượt 1 rò qua `templates/`; nó còn bắt tôi lần thứ hai khi tôi khai `NGAY_SUA` là cụm-chỉ-người-biết trong khi đề **in sẵn** |
**Chọn skill bằng đo** | `run_report_reader` nhắc "phân hiệu" **1 lần** ⇒ đổi sang `ui_debug_agent` (**0 lần**) |

### Hai bài, và bài thứ nhất là ĐỐI CHỨNG

| Bẫy | Loại | E5 **có pack** | E5 **không pack** |
|---|---|---|---|
`biểu EMIS là ảnh chụp` | **suy ra được** | 3/3 | **3/3** |
`lưới chỉ hiện phân hiệu chính` | **tùy tiện** | **3/3** | **1/3** |

Tổng điểm hai nhánh gần bằng nhau (bài 2: 14/15 so 13/15) vì phần **cấu trúc** chiếm đa số và cả hai
đều làm tốt — một lượt có-pack còn trượt E1 vì JSON hỏng, chuyện chẳng liên quan tri thức. **Tín hiệu
nằm đúng ở ô nội dung.**

### Giới hạn, nói thẳng

- **n=3 mỗi nhánh. Chưa đủ để kết luận thống kê.** Không được viết "pack làm tốt hơn X%".
- Cái làm con số này đọc được là **bài đối chứng**: cùng bộ chấm, cùng cách dựng, nhưng bẫy suy-ra-được
  cho **3/3 ở cả hai nhánh**. Nếu bỏ bài đối chứng, 3/3 so 1/3 có thể chỉ là bộ chấm thiên vị.
- Phép đo này đo **tri thức có tới được model không**, KHÔNG đo khả năng suy luận.

### Hệ quả — và nó đổi chính pack tôi viết

> **Pack phải MỎNG ĐI và TÙY TIỆN HƠN.**

| Giữ — không suy nổi | Bỏ hoặc hạ cấp — model tự làm được |
|---|---|
lưới chỉ hiện phân hiệu chính · `.auth` sống 25 phút và dùng chung · số thứ tự đỏ = ô bắt buộc · xoá học sinh 4 bước · form Thêm mới ở frame CUỐI · combo đặt bằng API không bắn postback · ô khoá ghi đè qua `ClientState` | Mixed Content khi vào bằng https · biểu EMIS là ảnh chụp · "hai số không khớp thì hỏi mẫu số trước" |

Đây là kết quả đi ngược bản năng viết tài liệu: **viết thêm cho đầy làm pack kém đi**, vì phần model tự
biết chỉ tốn token mà không đổi đầu ra.

## Tổng kết chi phí

~**$14** cho bốn lượt. Thu về: **một phép đo dùng được**, **một máy gác rò đáp án** (đã bắt tôi hai
lần), **một luật thiết kế pack**, và **một cơ chế chấm** — ép bên sinh trả đối tượng có cấu trúc rồi
chấm trường — vốn là nền của engine kiểm verdict về sau.

## Điều học được, và nó đáng hơn con số

> **Bộ chấm khớp-từ-khoá không chấm được lập luận. Nó chấm chính tả.**

Đây đúng là lý do tài liệu V10 khăng khăng evaluator của họ là *"structural, not semantic validators"*.

**Hệ quả cho thiết kế về sau:** muốn chấm được chất lượng lập luận thì phải **đảo chiều** — ép bên sinh
trả về **đối tượng có cấu trúc** rồi chấm **trường**, thay vì khớp chữ trên văn xuôi:

| Chấm sai | Chấm được |
|---|---|
"có nói chữ *mẫu số* không" | `mau_so: {tu, mau, nguon}` — thiếu trường ⇒ chặn |
"có nêu nguyên nhân đối thủ không" | `nguyen_nhan_doi_thu: []` rỗng ⇒ cấm kết luận `product_bug` |

Hợp đồng đó đã có sẵn trong [`enhancements/v10/packs/qemis.md`](../../enhancements/v10/packs/qemis.md)
§Mandatory output contract — bộ chấm chỉ việc dùng nó, thay vì đi khớp chữ.

## Trạng thái hiện tại, nói thẳng

- Pack `qemis.md` **được giữ**: nội dung đúng, hữu ích, 10 bẫy đều neo vào sự cố đã trả giá.
- Bài `qemis-luoi-lop` **được giữ**: hợp lệ, cả hai nhánh đạt ngưỡng.
- **KHÔNG có tuyên bố nào** rằng pack làm chất lượng tốt hơn. Chưa đo được.
- Chi phí: **~$8** cho ba lượt. Thu về một bài học về thiết kế phép đo, không phải một con số.
