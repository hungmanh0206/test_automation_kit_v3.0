# v2.9.4 — KẾT QUẢ LẤP THƯ VIỆN (số đo, không ước lượng)

> Đo ngày 16/10/2026 trên nhánh `feat/v2.9.4`, sau mô-đun 1 và 2.
>
> **Kết luận ngắn:** lấp thư viện **không** làm tỉ lệ dùng lại nhúc nhích (19% → 19%, 18% → 18%). Và
> `reuse:measure` chỉ ra vì sao, bằng một con số mà chính kit đã đo từ trước: bộ case **viết đúng chuẩn
> câu bước §K đạt 79% exact với CÙNG danh mục này**, trong khi bộ viết tự do đạt 16–36%. Nút thắt là
> **cách viết câu bước**, không phải kích thước thư viện.

---

## 1. Trước / sau khi lấp

| Task | mệnh đề | dùng lại TRƯỚC | dùng lại SAU | đổi |
|---|---|---|---|---|
| CSDL-9001 | 1079 | 202 (19%) | **203 (19%)** | +1 |
| CSDL-9002 | 1171 | 207 (18%) | **208 (18%)** | +1 |

Đã lấp: **5 bước lưới** (`_widget/radgrid.ts`) + 1 biến thể câu. Danh mục 17 → **22 mục**.

Hai mệnh đề. Đó là toàn bộ phần thu được từ việc lấp.

---

## 2. `reuse:measure` — và con số giải thích tất cả

```
§G.1 DÙNG LẠI CHÉO BỘ          951 case · 5886 mẫu số · 1399 có sẵn = 24%
     Mục tiêu: ≥70% cùng module · ≥50% khác module
     ✗ Khác module: 24% so với mục ≥50%
     "Mọi bộ ở đây là module KHÁC nhau. 'Cùng module' cần hai task trên cùng màn — CHƯA CÓ CẶP NÀO."

§G.2 KHỚP VÀO DANH MỤC         exact 203/1079 (9001) · 208/1171 (9002) · 95/1235 (9004)
     Bộ viết ĐÚNG CHUẨN §K (fixture): 11/14 exact = 79%

§G.3 PROXY "token −50%"        791/5886 mệnh đề không phải nhờ model = 13%
```

**Ba điều rút ra, mỗi điều có số đi kèm:**

1. **Mốc "≥70% cùng module" KHÔNG ĐO ĐƯỢC** — không phải chưa đạt, mà là **không tồn tại cặp task cùng
   module** để đo. Bốn task làm bốn màn khác nhau. Báo "chưa đạt 70%" sẽ là báo sai bản chất.

2. **79% so với 16–36% là khoảng cách do CÁCH VIẾT CÂU, không do danh mục.** Cùng một danh mục 22 mục:
   bộ fixture viết theo chuẩn §K đạt 79% exact, bộ thật viết tự do đạt 16–36%. Kit đã tự ghi câu này:
   *"Chênh lệch giữa chúng là phần §K mua được, và nó KHÔNG mua được bằng bộ khớp tốt hơn."*

3. **13% mệnh đề không cần model** — và con số đó bị chặn bởi độ phủ danh mục, đúng như máy tự khai.

---

## 3. Vì sao lấp thêm không giúp — cơ chế, không phải phỏng đoán

`steps_match.js` dòng 282 khai rõ:

> `exact` đòi **HAI** điều: hình dạng trùng tuyệt đối, **VÀ** số giá trị tách được khớp số tham số của
> bước. Trùng hình dạng mà thiếu giá trị thì KHÔNG gọi được hàm — đó là `fuzzy`, không phải `exact`.

Ca cụ thể đo được: `"Đọc toàn bộ lựa chọn trong danh sách"` khớp `widget.combobox.doc-items` với **điểm
1.0** nhưng vẫn là `fuzzy`, vì câu **không nói combobox nào**. Tham số nằm ở câu TRƯỚC
(`"Mở combobox Stt 34 Chuẩn Q.gia mức độ"`).

Đó là hình dạng chung của 781 mệnh đề `none`:

| Hiện tượng | Số đo |
|---|---|
| `none` chứa chữ "và" (câu ghép) | **280/781 = 36%** |
| trong đó tách được (sau "và" là động từ) | **38** |
| trong đó phải GIỮ nguyên (`"Stt 10 và Stt 11"`, `"DTTS và miền núi"`) | **242** |

Nên cả hai đòn bẩy đều cụt:

- **thêm câu bước**: phần lớn mệnh đề là câu ghép, không có khuôn để thêm;
- **tách ở "và"**: chỉ được 38/1079 ≈ 3,5%, và bộ tách hiện tại cố ý không tách vì `"Xoá trắng ô Họ và
  tên"` sẽ vỡ làm hai — quyết định đó vẫn đúng.

---

## 4. Trạng thái bước: 0/22 đã đo, tất cả `draft`

`steps:stats`: **0/22 mục danh mục đã có số · 22 mục CHƯA ĐO**, `ti_le_on_dinh` còn `null`.

Hệ quả thẳng: `steps:match` in ra cảnh báo *"202 mệnh đề khớp vào bước `draft` — bước chưa kiểm chứng
KHÔNG được dùng để kết luận PASS."* Tức **ngay cả 19% đang khớp cũng chưa dùng để chấm được.**

`steps:promote` sẽ từ chối thăng cả 22 mục (cần ổn định ≥3 lượt và dùng ≥2 case). Muốn có số thì bước
phải CHẠY THẬT — mà chạy thật cần `compile:spec` sinh được spec có bộ kiểm, và `reuse:measure` đã đo:
*"spec biên dịch hiện tại gần như không có lời gọi bộ kiểm nào — mọi dòng kỳ vọng đều rơi vào
`TODO-ORACLE`."*

**Vòng tròn:** bước cần chạy để được `active` → cần spec compile được → cần oracle → chưa có.

---

## 5. PII trong code trích xuất

`_widget/radgrid.ts` **không chứa dữ liệu khách**: toàn bộ là selector Telerik (`.rgMasterTable`,
`tr.rgRow`, `tr.rgHeader th`) và hàm thuần. Không email, không SĐT, không họ tên, không mã định danh.

Cách kiểm: `npm run secret:scan` (xanh) + đọc tay toàn file (119 dòng). Các bản gốc trong `outputs/`
có nhúng giá trị thật (`Truong THCS Test Sua Trom`, mã trường) — chúng **không** được chép sang; thư
viện nhận chúng qua tham số.

---

## 6. Token / lượt shell trước-sau: CHƯA ĐO ĐƯỢC

`reuse:measure` tự khai điều kiện, và tôi giữ nguyên lời khai đó thay vì bịa số:

> Mốc duy nhất đang có (`docs/token-diet/baseline.dynamic.json`) là token theo **PHIÊN làm việc**,
> không phải theo một lượt "sinh automation cho một module". Chia số phiên cho số module là **bịa mẫu
> số**. Để đo được: cần ghi token của MỘT lượt sinh automation đường cũ, rồi lặp lại đường mới trên
> cùng module. **Chưa có lượt nào như thế.**

Không chạm UAT trong cả đợt: khai thác chỉ ĐỌC `outputs/`, trích xuất chỉ GHI `tests/fe/lib/`.

---

## 7. Đề xuất đổi hướng — và vì sao

Phương án A đã chọn là *"nối trước, lấp sau"*. Đo xong thì thấy **cả hai vế đều không phải nút thắt**:

| Giả thuyết | Số đo bác nó |
|---|---|
| "Thư viện thiếu đồ" | lấp 5 bước ⇒ +2 mệnh đề trên 2250 |
| "Thiếu câu bước" | thêm biến thể ⇒ +1 mệnh đề; 7/8 câu tôi thêm còn SAI số tham số |
| "Bộ tách mệnh đề quá chặt" | tách ở "và" chỉ được 38, và 242 ca phải giữ nguyên |
| **"Câu bước viết tự do"** | **fixture viết theo §K: 79% · bộ thật: 16–36%** |

Nút thắt nằm ở **Phase 1 — lúc VIẾT câu bước**, không ở Phase 2 lúc dùng lại. Và kit đã có sẵn chỗ để
sửa: `tc_design_guide` (v2.9.0) có đúng một điểm dạy *"câu bước viết để dùng lại được"*, nối tới
`steps:match` và `compile:spec`.

**Đề xuất cho lượt sau:** thay vì lấp tiếp thư viện, đưa chuẩn §K thành **thứ có máy gác lúc sinh
case** — `tc_reviewer` chấm câu bước theo `step_phrasing.json`, và `gate:gen-testcase` cảnh báo khi tỉ
lệ câu "không theo khuôn" vượt ngưỡng. Đó là chỗ 79% đang chờ sẵn.

**Việc KHÔNG nên làm:** lấp tiếp 8 module còn lại trong danh sách. Đo rồi: mỗi module lấp vào sẽ cho
thêm 1–2 mệnh đề, và kho sẽ đầy những bước không task nào gọi tới — đúng điều kiện DỪNG của prompt
(*"kho phải sạch, không nhồi rác"*).
