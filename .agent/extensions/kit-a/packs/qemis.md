# QEMIS / CSDL giáo dục — Advanced Prompt Pack V10

**Status:** optional reference only. Authority remains `RULE_GLOBAL.md` and Kit B canonical gates. Not a substitute for actual execution or human-approved oracle.
**Owner:** `qa_automation_engineer` · `ui_debug_agent` · **Origin:** sự cố ĐÃ XẢY RA trên chính dự án này, không phải lý thuyết QA tổng quát.

## Pack này khác năm pack kia ở đâu

Năm pack kia dạy **phương pháp QA chung** — đúng, nhưng mua được ở mọi nơi. Pack này là thứ **không mua
được**: mỗi mục dưới đây là một **triệu chứng đã làm dự án này mất thời gian thật**, kèm cách phân biệt.

Khuôn mỗi mục cố ý giống nhau, vì lỗi hay gặp luôn cùng một hình: **một triệu chứng, nhiều nguyên nhân,
và người đo vớ lấy nguyên nhân đầu tiên nghĩ ra.**

> **Pack này KHÔNG phải oracle.** Nó nói *"đừng kết luận gì khi chưa phân biệt được"*, không nói
> *"app phải thế này"*. Kỳ vọng vẫn chỉ đến từ đặc tả hoặc ô `Kết quả mong đợi` của case.

## Activation
Dùng khi execute hoặc debug trên QEMIS/CSDL. Không dùng cho hệ thống khác — các bẫy dưới đây gắn với
Telerik WebForms, mô hình đơn vị–cấp học–năm học, và máy chủ UAT cụ thể của dự án.

---

## 1. Toast `thành công` KHÔNG chứng minh đã ghi

**Triệu chứng.** Bấm `Ghi`, toast hiện chữ *thành công*, không ô nào báo đỏ.

**Đừng kết luận.** Rằng bản ghi đã vào DB. Đã gặp **ít nhất năm cơ chế khác nhau** cùng cho đúng triệu
chứng đó: bản ghi thứ hai không chèn được · combo đặt bằng API nên postback không mang giá trị · ô khoá
bị ghi đè ở `ClientState` · xoá mềm nên hàng vẫn còn ở truy vấn khác · phiên hết hạn giữa lượt.

**Phân biệt bằng.** Đếm lại sau `F5` **và** đối chiếu DB chỉ-đọc. Ghi/xoá chỉ tính là đã xảy ra khi
**DB xác nhận**. Toast là tín hiệu của tầng UI, không phải của tầng lưu trữ.

**Giá đã trả.** Một lô log `product_bug` dựa trên toast, sau phải rút lại toàn bộ.

---

## 2. Combo phụ thuộc không nạp, và ô vẫn "có giá trị"

**Triệu chứng.** Đặt combo cha xong, combo con rỗng mãi; hoặc đọc ra giá trị đúng mà lưu lại sai.

**Đừng kết luận.** Rằng app hỏng. Telerik chỉ nạp combo phụ thuộc khi có **postback thật**; đặt
`ClientState` hay gọi API client **không** bắn postback. Và khi editor còn mở, ô nền trả về giá trị
**ĐÃ LƯU**, không phải giá trị đang gõ.

**Phân biệt bằng.** Chỉ cú bấm thật mới sinh postback. Đọc giá trị **sau khi đóng editor**. Combo đa
chọn thì `get_value()` luôn rỗng — đọc danh sách ô tích, đừng đọc value.

---

## 3. Màn `Thêm mới` nằm trong iframe

**Triệu chứng.** Locator đúng nhãn, đúng id, mà không thấy phần tử.

**Phân biệt bằng.** Lấy **frame CUỐI**, không lấy frame đầu và không lấy `page` gốc. Nhầm chỗ này sinh
`script_error` trông hệt như *"app không render form"*.

---

## 4. Lượt chạy XANH trên **cấp học sai**

**Triệu chứng.** Mọi case PASS, ảnh đẹp, số liệu hợp lý — nhưng là của cấp học khác.

**Đừng kết luận.** Rằng lượt chạy đó có giá trị. Một tài khoản QEMIS chỉ thuộc **một cấp**; thiếu ghim
cấp trong `profiles/<TASK>/task.env` thì app **lặng lẽ** về *Mầm non* và không báo gì.

**Phân biệt bằng.** Ghim cấp trong profile và **nghiệm thu bằng một neo trên màn** (tên đơn vị, mã
trường), không bằng việc "đăng nhập được". Đây là lý do `CLAUDE.md` mục 5 tồn tại.

---

## 5. Năm triệu chứng rất khác nhau, **một** nguyên nhân môi trường

**Triệu chứng.** Nút bấm im lặng · `$find()` trả `null` · thanh tab đọc ra 0 phần tử · lưới Telerik ở
trạng thái ẩn · trang mất sạch CSS.

**Đừng kết luận.** Bất cứ cái nào là lỗi sản phẩm. Khi vào UAT bằng **https**, host phát tài nguyên
bằng `http://` tuyệt đối và trình duyệt chặn Mixed Content — **cả năm** triệu chứng trên đều là hệ quả.

**Phân biệt bằng.** Vào lại bằng `http` rồi đo lại. Nếu hết, đó là **lỗi môi trường**, không log bug.

---

## 6. `Phân hiệu` và `Điểm trường` là **hai bảng khác nhau**

**Đừng kết luận.** Rằng số liệu hai màn phải khớp. Chúng đếm hai thực thể khác nhau, và lưới lớp mặc
định **chỉ hiện phân hiệu chính** — nên "thiếu hàng" thường là bộ lọc, không phải mất dữ liệu.

**Phân biệt bằng.** Nêu rõ **mẫu số** của mỗi con số trước khi so. Hai số không khớp là **dấu hiệu lỗi
nối**, không phải bằng chứng lỗi app.

---

## 7. Ô bắt buộc: neo vào **số thứ tự đỏ**, đừng suy từ thông báo lỗi

**Triệu chứng.** Bỏ trống một ô, app báo lỗi ở ô *khác*.

**Phân biệt bằng.** Danh sách ô bắt buộc đọc từ **cấu trúc màn** (số thứ tự đỏ), không suy từ thứ app
nói khi lỗi. Suy ngược từ thông báo đã nhiều lần sinh "bug" mà tiền đề sai: ô ta nghĩ đang kiểm thì
không bắt buộc, còn ô bắt buộc thật thì đang bỏ trống.

---

## 8. Biểu EMIS là **ảnh chụp**, không phải truy vấn sống  ⟨ĐÃ ĐO: model tự suy được⟩

> **Mục này KHÔNG cần nạp cho model.** Đo 09/11/2026 bằng A/B (`skills:practice --bai qemis-bieu-emis`):
> phép kiểm nội dung đạt **3/3 ở CẢ hai nhánh**, có pack và không pack — tức model tự suy ra. Giữ lại
> cho **người** đọc; với model thì nó chỉ tốn token. Các mục khác **chưa đo**, đừng suy rộng ra.

**Triệu chứng.** Số trên biểu lệch với `SELECT` vừa chạy.

**Đừng kết luận.** Rằng app tính sai. Biểu **không tính lại** khi mở màn; nó hiện số đã lưu.

**Phân biệt bằng.** Kiểm `NGAY_SUA` của bản ghi biểu **trước** khi nghi app. Và ô trống trên biểu nghĩa
là **0**, không phải *"không đọc được"* — đọc nhầm chỗ này sinh FAIL hiệu năng và FAIL số liệu giả.

---

## 9. Phiên dùng chung, và nó hết hạn

**Triệu chứng.** Giữa lượt chạy, đột nhiên sai đơn vị hoặc văng về đăng nhập.

**Phân biệt bằng.** Phiên lưu ở `.auth` **dùng chung giữa các task** và sống khoảng **25 phút**: một
task khác đổi đơn vị là lượt của bạn đổi theo. Xen một việc dài giữa hai bước là đủ để hết hạn. Trước
khi gọi *"app đá phiên"*, kiểm xem có task khác đang chạy không.

---

## 10. Xoá nhiều bước, và **thất bại không ném**

**Triệu chứng.** Gọi hàm xoá, không có lỗi, nên coi như đã xoá.

**Đừng kết luận.** Xoá học sinh là **4 bước**; xoá lớp đi qua modal; nút `Xóa` ở vài màn chỉ **mở panel
cam kết** chứ chưa xoá. Thất bại ở các bước này **không ném lỗi**.

**Phân biệt bằng.** Nghiệm thu bằng **đếm trước/sau**, không bằng *"không có ngoại lệ"*. Và dọn dữ liệu
test thì theo **DB**, đừng theo danh sách "đã tạo" trong trí nhớ lượt chạy — toast trượt làm danh sách
đó thiếu.

---

## Mandatory output contract

Khi pack này được dùng, báo cáo phải nêu được, cho mỗi kết luận:

```
{
  "trieu_chung": "...",
  "nguyen_nhan_doi_thu": ["...", "..."],      // >= 2, lấy từ danh sách trên nếu khớp
  "phep_phan_biet": "thao tác cụ thể đã làm để loại các nguyên nhân kia",
  "ket_qua_phan_biet": "...",
  "oracle_ref": "BR-… | ô Kết quả mong đợi của case | (trống ⇒ OBSERVATION)",
  "tang_loi": "product_bug | api_bug | script_error | setup_failure | infra | flaky",
  "evidence_refs": ["..."]
}
```

`nguyen_nhan_doi_thu` rỗng ⇒ **chưa phân biệt được** ⇒ không được kết luận `product_bug`.

## Handoff và điều kiện dừng

Bàn giao cho các cửa canonical của kit (`bug:claim`, `gate:output`, taxonomy verdict). Thiếu neo kỳ
vọng ⇒ `OBSERVATION`, không phải `FAIL`. Triệu chứng khớp mục 5 ⇒ `infra`, **không log Backlog**.

## Context loading policy

**Luật chọn mục, rút từ số đo chứ không từ cảm tính:** bẫy nào **suy ra được từ chính báo cáo** thì
model tự làm — nạp vào chỉ tốn token mà không đổi đầu ra. Bẫy nào **tùy tiện** (một quy ước của sản
phẩm, không đoán nổi) mới là thứ pack này đáng tồn tại. Đo được tới nay: mục 8 thuộc nhóm đầu (3/3 ở
cả hai nhánh); mục 6 thuộc nhóm sau (**3/3 có pack · 1/3 không pack**). Chín mục còn lại **chưa đo**.

Load pack này **chỉ khi** đang làm việc trên QEMIS/CSDL và đã có triệu chứng cụ thể. Với lượt chạy
trơn tru thì không cần. Không auto-load cùng năm pack kia.
