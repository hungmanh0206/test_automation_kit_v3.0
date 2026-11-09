# Đo tác dụng của prompt pack — ba lượt, và cả ba KHÔNG DÙNG ĐƯỢC

Ghi ngày **09/11/2026**. Đây là bản ghi một phép đo **thất bại**, giữ lại vì nó đắt hơn kết quả.

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
