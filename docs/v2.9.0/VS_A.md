# `tc_design_guide` so với `rbt-manual-testing` của kit A

> Mọi con số đo ngày 14–15/10/2026 bằng script, không ước lượng. Token quy đổi 3,6 ký tự/token — cùng
> một công thức cho cả hai kit, nên con số tuyệt đối có thể lệch với cách đếm khác, nhưng **tỉ lệ thì
> không**.

## Bảng so

| Tiêu chí | A (`rbt-manual-testing`) | `tc_design_guide` | Đạt? |
|---|---|---|---|
| **Token phần LUÔN-NẠP** | **16.204** (một file, 937 dòng) | **1.481** | ✓ — nhỏ hơn **11 lần** |
| Tổng nội dung mang được | 16.204 | 1.481 + **4.594** (`references/`) = 6.075 | — |
| **Điểm dạy có máy kiểm** | 0 (AI tự chấm bằng văn) | **11** dòng trỏ `npm run …` | ✓ |
| Chỗ CHƯA có máy, nói thẳng | — | **4** chỗ ghi "chưa có máy — review tay" | ✓ |
| **Kỹ thuật phủ** | 3 dòng bắt buộc (EP+BVA · DT · ST) | **8** (thêm UC · EG · **PW** · **CT**) | ✓ |
| Mâu thuẫn nội bộ | ≥3 (xem dưới) | 0 — có test grep chặn | ✓ |
| Dạy câu bước **dùng lại được** | không có khái niệm | có (`steps:match`, `compile:spec`) | ✓ |
| Dạy mở rộng **7 trục** | dừng ở "viết xong TC là xong" | có, nối `expansion:plan` | ✓ |
| Một-việc-một-skill | gộp QUICK + FULL RBT + CHECKLIST | một việc: dạy thiết kế | ✓ |

### Dòng "link gãy" đã BỎ khỏi bảng — và vì sao

Prompt đề nghị so *"A có 5 link chết → mới có 0"*. **Con số 5 không đứng vững.** Đếm lại bằng máy:
kit A có **23 link markdown nội bộ, 0 link gãy**. Năm cái bị đếm là "chết" đều là **đường dẫn minh
hoạ**: `<module>` (placeholder), ví dụ trong bảng sau chữ "VD", và tên file ĐẦU RA vẽ trong sơ đồ luồng
— phần lớn nằm trong khối mã.

Và phía B cũng không hơn theo nghĩa prompt nói: trước đợt này, 25 skill của B có **0 link nào cả**, nên
"0 link gãy" là 0/0.

Bỏ dòng đó vì một so sánh dựng trên con số thổi phồng thì lần đầu tiên có người kiểm lại, **cả bảng mất
tin** — kể cả tám dòng còn lại vốn đúng.

Thứ thật sự mới: cửa `skills:refcheck` **phân biệt link thật với đường dẫn minh hoạ**, và nó có đối
chứng hai chiều dùng chính các ca của A làm âm bản. Đếm ngây thơ thì nó gắn cờ cả ví dụ, và cách "sửa"
nhanh nhất là gỡ ví dụ khỏi tài liệu — tức làm tài liệu nghèo hơn để chiều một cái máy đếm sai.

## Ba mâu thuẫn của A, sửa thế nào

**① "Xung đột tài liệu vs ảnh → ảnh thắng".** Tiêu đề mục của A viết vậy; thân mục lại nói *"KHÔNG tự
chọn bên nào"* và bắt ghi `ASM-XX`. Khác biệt thật với B hẹp hơn tiêu đề: A vẫn bảo **"viết TC theo
những gì ảnh cho thấy"**, tức quan sát trở thành kỳ vọng ĐÃ VIẾT. B: quan sát ở lại `observed`, kỳ vọng
phải có neo, lệch nhau ⇒ câu hỏi cho Ambiguity Gate và case mang `OBSERVATION`.
Có test chặn mọi câu kiểu "ảnh thắng" quay lại.

**② Evidence.** A đặt luật ở hai chỗ và chúng mâu thuẫn ("chụp khi fail" vs "chụp mọi test"). Skill mới
**không đặt luật evidence nào**, chỉ trỏ `CLAUDE.md` §4. Test chặn mọi câu đặt luật chụp ảnh.

**③ Locator.** Skill mới **không nói về locator** — đã có `locator_strategy`. Test grep chặn
`data-testid`/`getByRole`/`xpath`.

## Hai chỗ phép đo bác chính tôi

1. **Tôi bịa tên máy.** Bản đầu viết `npm run matrix` cho Decision Table và Pairwise — **script đó không
   tồn tại**. Test "bảng điểm dạy chỉ nêu máy CÓ THẬT" bắt ngay. Tên đúng là `matrix:coverage`.
2. **Tôi nói THIẾU, không phải nói thừa.** Bản đầu ghi *"pairwise: chưa có máy đếm cặp — review tay"*.
   Thật ra `matrix_coverage.js` **là** máy pairwise, và nó còn kiểm hơn: phủ **cặp** lẫn phủ **lớp kết
   quả** — vì một bộ đủ mọi cặp vẫn có thể bỏ sót một lớp kết quả theo spec. Chỗ thật sự chưa có máy là
   **classification tree**, và bảng nay ghi đúng chỗ đó.

## Giới hạn còn lại, nói thẳng

- **Ranh giới Actor/Context/Tiền điều kiện chưa có máy.** Đây là điểm dạy có giá trị nhất port từ A, và
  nó vẫn là review tay.
- **Classification tree chưa có máy đếm độ phủ nhánh.** Mã `CT` thêm vào `design_techniques.json` để
  case gắn được tag — không phải để giả vờ có người gác.
- **Skill chưa chạy trên một bộ TC thật.** Nó dạy đúng theo các máy đang có, nhưng chưa ai dùng nó để
  viết một bộ case rồi đo xem bộ đó có tốt hơn không. Đó là phép đo của lượt sau.
