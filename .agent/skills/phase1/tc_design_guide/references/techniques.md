# Kỹ thuật thiết kế — khi nào BẮT BUỘC dùng

> Tám kỹ thuật, mỗi cái: **điều kiện kích hoạt** · cách làm · ví dụ · chiều/case-type tương ứng · máy
> chấm. Mã lấy từ `.agent/config/design_techniques.json` — khai tag `[EP]`, `[BVA]`… trong tiêu đề case.
>
> Kỹ thuật là **công cụ chọn theo tình huống**, không phải danh sách phải dùng hết. Nhưng khi điều kiện
> kích hoạt đã thoả thì bỏ qua là bỏ sót, không phải lựa chọn.

---

## EP — Equivalence Partitioning

**Kích hoạt:** field có miền giá trị **chia nhóm được** — hợp lệ/không hợp lệ, hoặc nhiều nhánh theo
loại giá trị.

**Cách làm:** mỗi partition ít nhất một case; nêu rõ case này đại diện nhóm nào.

**Ví dụ:** ô *Sĩ số* nhận 1–50. Ba nhóm: dưới khoảng · trong khoảng · trên khoảng. Ba case, không phải
mười case trong cùng một nhóm.

**Chiều của B:** §3 Field validation · **Case type:** Positive + Negative
**Máy chấm:** `npm run dim:coverage` — cùng một field có ≥2 case `[EP]` với dữ liệu khác nhóm nhau.

---

## BVA — Boundary Value Analysis

**Kích hoạt:** field có **min/max** hoặc độ dài giới hạn. Đây là kỹ thuật bắt buộc nhất trong bảng:
lỗi biên chiếm phần lớn lỗi validation.

**Cách làm:** `min-1 · min · max · max+1`. Bốn giá trị, không gộp vào một case.

**Ví dụ:** tên lớp tối đa 50 ký tự ⇒ 49 · 50 · 51, và rỗng. Gộp "nhập 51 ký tự và nhập rỗng" vào một
case là mất một phép đo: case đỏ không nói được cái nào hỏng.

**Chiều:** §3 · **Case type:** Boundary
**Máy chấm:** `npm run dim:coverage` chiều §3; `npm run tc:review` tiêu chí dữ liệu test cụ thể.

---

## DT — Decision Table

**Kích hoạt:** **≥3 điều kiện** cùng quyết định MỘT output.

**Cách làm:** liệt kê tổ hợp thành bảng, mỗi rule một case. Ghi rõ rule nào ứng với case nào.

**Ví dụ:**

| Rule | Có phân hiệu | Là lớp ghép | Cấp học | → Ô bắt buộc |
|---|---|---|---|---|
| R1 | Có | Không | TH | + Phân hiệu |
| R2 | Có | Có | TH | + Phân hiệu, + Nhóm trình độ |
| R3 | Không | Có | MN | + Nhóm tuổi |

**Chiều:** §13 Business logic · **Case type:** Positive/Negative theo rule
**Máy chấm:** `npm run matrix:coverage` — kiểm phủ CẶP giá trị **và** phủ LỚP KẾT QUẢ. Phủ cặp không
kéo theo phủ kết quả: một bộ đủ mọi cặp vẫn có thể bỏ sót một lớp kết quả theo spec. Skill
`combinatorial_matrix` hướng dẫn cách dựng bảng.

---

## ST — State Transition

**Kích hoạt:** entity có **≥3 trạng thái**, hoặc có luồng status.

**Cách làm:** lập ma trận `từ × đến`. **Mỗi ô đều là một case** — ô hợp lệ kiểm đi được, ô không hợp lệ
kiểm **bị chặn**. Ô bị chặn thường là chỗ bug sống.

**Ví dụ:** Nháp → Chờ duyệt → Đã duyệt → Đóng. Case đáng giá nhất không phải "duyệt thành công" mà
"từ Đã duyệt bấm duyệt lại" và "từ Đóng quay về Nháp".

**Chiều:** §10 Cross-layer guard · **Case type:** Negative/Guard
**Máy chấm:** `npm run dim:coverage` §10. Chuyển trạng thái **đồng thời** thì thêm
`npm run concurrency:check` (kịch bản `mot_lan`).

---

## UC — Use Case / luồng nghiệp vụ

**Kích hoạt:** chuỗi thao tác qua **≥2 màn** mới hoàn thành một việc của người dùng.

**Cách làm:** một case cho luồng chính, mỗi nhánh rẽ một case. Đừng gộp luồng chính và nhánh lỗi.

**Chiều:** §6 E2E · **Máy chấm:** `npm run dim:coverage` §6.

---

## EG — Error Guessing

**Kích hoạt:** có **bug lịch sử** cùng module (`knowledge/bugs/`), hoặc chỗ đã từng hỏng ở dự án tương tự.

**Cách làm:** đọc `npm run bugs:checklist` rồi viết case cho từng lớp bug đã gặp. Đây là kỹ thuật duy
nhất dựa vào trí nhớ của đội, nên nó chỉ mạnh khi kho bug được ghi tử tế.

**Chiều:** §20 Bug history · **Máy chấm:** `npm run dim:coverage` §20.

---

## PW — Pairwise (tổ hợp từng cặp)

**Kích hoạt:** từ **3 tham số độc lập** trở lên, mỗi tham số ≥2 giá trị. Dưới 3 tham số thì liệt kê đủ
còn rẻ hơn, và pairwise chỉ làm mờ ý định.

**Cách làm:** liệt kê tham số × tập giá trị, sinh bộ phủ cặp, mỗi dòng một case. Ghi rõ case phủ những
cặp nào.

**Vì sao đủ:** đa số lỗi tổ hợp lộ ra ở mức **cặp**, trong khi số case giảm theo cấp số. 5 tham số × 3
giá trị = 243 tổ hợp đầy đủ, nhưng ~15 case phủ hết mọi cặp.

**Ví dụ:** cấp học (5) × loại lớp (2) × có phân hiệu (2) × trạng thái (3) = 60 tổ hợp. Pairwise còn
khoảng 15 — và vẫn phủ mọi cặp (cấp × loại), (cấp × phân hiệu)…

**Chiều:** §13 · **Máy chấm:** `npm run matrix:coverage` (phủ cặp **và** phủ lớp kết quả) · skill
`combinatorial_matrix` để dựng bộ.

---

## CT — Classification Tree

**Kích hoạt:** đầu vào **phân tầng** — loại đối tượng quyết định tập thuộc tính tiếp theo. Bảng phẳng
EP/BVA không diễn đạt được quan hệ cha-con này.

**Cách làm:** vẽ cây (nhánh = tiêu chí phân loại, lá = lớp giá trị), mỗi case chọn một lá ở mỗi nhánh
đang xét, và ghi **đường đi từ gốc tới lá** vào dữ liệu test.

**Ví dụ:** *Cấp học* là nhánh gốc; chọn Mầm non thì mở nhánh *Nhóm tuổi*; chọn Tiểu học thì mở nhánh
*Lớp ghép*. Hai nhánh con này **không tồn tại cùng lúc**, nên liệt kê phẳng sẽ sinh tổ hợp vô nghĩa.

**Chiều:** §13 · **Case type:** Positive theo nhánh
**Máy chấm:** **chưa có máy đếm độ phủ cây — review tay.** Mã `CT` khai để case gắn được tag, không
phải để giả vờ có người gác.

---

## Viết bước để `compile:spec` dùng lại được

Không phải kỹ thuật thiết kế, nhưng quyết định bộ TC này sau có tự động hoá được không.

1. **Giá trị bọc nháy**: `nhập "Nguyễn Văn A" vào ô "Họ tên"`, không phải `nhập tên hợp lệ`.
   Đo trên 5.886 mệnh đề thật: chỉ **31%** câu bước trích được giá trị — phần còn lại không khớp nổi.
2. **Một câu một thao tác.** Hai việc ⇒ hai dòng đánh số.
3. **Động từ chuẩn** theo `.agent/config/step_phrasing.json`. Tự đặt từ đồng nghĩa mới thì bộ khớp câu
   không nhận ra, và câu đó rơi khỏi mọi phép dùng lại.

**Máy chấm:** `npm run steps:match` (tỉ lệ khớp), `npm run steps:lint`.

---

# Ba dòng TC HOÀN CHỈNH — đọc được là viết được

Ba ví dụ dưới đây theo **đúng 10 cột canonical**, và **neo vào rule CÓ THẬT** trong
`knowledge/domain/` (không phải rule minh hoạ). Mỗi dòng cố ý mang một kỹ thuật khác nhau:
**BVA · DT · ST** — ba kỹ thuật hay bị viết hỏng nhất.

Quy ước đã dùng trong cả ba, và cả ba đều phải có:

- tag kỹ thuật đứng cạnh tag loại/chiều và **oracle-ref**: `[Boundary][Validation][BVA][BR-HSTRUONG-033]`;
- `[method]` ở đầu ô **Tiền điều kiện** — `compile:spec` đọc nó để chọn cách dựng state;
- giá trị trong bước **bọc nháy ngược**, vì bộ khớp bước chỉ trích được giá trị khi nó được bọc;
- **Kết quả mong đợi đánh số KHỚP từng bước**, xuống dòng `<br>` — cấm gộp range, cấm chung chung.

## Ví dụ 1 — BVA, biên của một ràng buộc có vế chéo field

Neo: **`BR-HSTRUONG-033`** (nguyên văn) — *"Diện tích xây dựng không lớn hơn diện tích đất — Stt 27 Diện
tích xây dựng (m2) là số nguyên dương tối đa 5 chữ số và không được lớn hơn giá trị Stt 26 Diện tích đất
(m2); lớn hơn thì chặn lưu."*

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|
| HSTRUONG_TC_201 | Negative | `[Boundary][Validation][BVA][BR-HSTRUONG-033]` | Hồ sơ trường | Diện tích xây dựng lớn hơn diện tích đất đúng 1 m2 thì bị chặn lưu | `[test_hook]` Tài khoản vai trò Quản trị trường cấp TH đã đăng nhập, mở màn `1.1 Hồ sơ trường` của trường test, năm học `2026-2027` | Stt 26 Diện tích đất = `5000`; Stt 27 Diện tích xây dựng = `5001` | 1. Nhập Stt 26 "Diện tích đất" = `"5000"`<br>2. Nhập Stt 27 "Diện tích xây dựng" = `"5001"`<br>3. Bấm nút `Ghi` | 1. Ô Stt 26 nhận giá trị `5000`<br>2. Ô Stt 27 nhận giá trị `5001`<br>3. App CHẶN lưu và hiện thông báo về ràng buộc diện tích xây dựng không lớn hơn diện tích đất<br>- Giá trị trên lưới KHÔNG đổi | Cao |

**Vì sao chọn `5000/5001` chứ không `5000/9999`.** Biên của ràng buộc này là *bằng nhau*, nên bốn điểm
cần đi là `4999` · `5000` · `5001` và mốc 5 chữ số `99999`. Chọn `9999` là chọn một giá trị **giữa miền
sai**, nó không chứng minh được off-by-one. Case này đi điểm `max+1`; ba điểm còn lại là ba case riêng.

## Ví dụ 2 — DT, bảng quyết định CÓ nhánh else

Neo: **`BR-EMISDN-002`** (nguyên văn, bỏ dấu như trong kho) — *"Hoc sinh duoc tinh vao bao cao EMIS dau
nam theo trang thai va moc 30/9: TINH 01 Dang hoc, 02 Chuyen den K1, 03 Nghi hoc xin hoc lai K1 khi
NGAY_TRANG_THAI < 01/10; TINH 04 Chuyen di K1, 05 Thoi hoc K1 khi NGAY_TRANG_THAI > 30/9; LUON TINH 08
Chuyen di K2, 09 Thoi hoc K2, 10 Chuyen den trong he; KHONG TINH 06, 07, 11, 12."*

Bảng quyết định — **mỗi cột một luật, mỗi luật một case**:

| Điều kiện | L1 | L2 | L3 | L4 (else) |
|---|---|---|---|---|
| Mã trạng thái | 01 · 02 · 03 | 04 · 05 | 08 · 09 · 10 | 06 · 07 · 11 · 12 |
| `NGAY_TRANG_THAI` so với 30/9 | `< 01/10` | `> 30/9` | không xét | không xét |
| **Kết quả** | TÍNH | TÍNH | LUÔN TÍNH | **KHÔNG TÍNH** |

Cột L4 là **nhánh else**, và nó là cột hay bị bỏ nhất. Bỏ nó thì bộ case chỉ chứng minh "ai được tính",
không chứng minh "ai KHÔNG được tính" — mà đếm thừa một học sinh cũng là sai số của cả biểu.

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|
| EMISDN_TC_310 | Negative | `[Negative][Data][Calculation][DT][BR-EMISDN-002]` | Báo cáo EMIS đầu năm | Luật L4: học sinh mã trạng thái `06` KHÔNG được tính vào biểu, bất kể ngày trạng thái | `[factory]` Tài khoản vai trò Quản trị trường đã đăng nhập; trường test có đúng `1` học sinh lớp `1A`, mã trạng thái `06`, `NGAY_TRANG_THAI` = `15/09/2026`; năm học `2026-2027` | Mã trạng thái = `06`; `NGAY_TRANG_THAI` = `15/09/2026`; mẫu số trước khi thêm = `0` | 1. Mở màn `Lập báo cáo đầu năm` của trường test<br>2. Đọc ô tổng số học sinh của biểu `1.1.1`<br>3. So với mẫu số đã ghi ở Tiền điều kiện | 1. Màn `Lập báo cáo đầu năm` mở đúng trường test và năm học `2026-2027`<br>2. Ô tổng đọc ra giá trị `0`<br>3. Giá trị `0` KHỚP mẫu số — học sinh mã `06` không được cộng vào biểu | Cao |

## Ví dụ 3 — ST, chuyển trạng thái VÀ đường phải bị chặn

Neo: **`BR-NHANSU-003`** (nguyên văn, bỏ dấu như trong kho) — *"Ma dia phuong co ngay khi luu ho so. Ma
dinh danh Bo GD&DT CHI nhan duoc sau khi dong bo ho so len CSDL Bo, khong sinh tai cho o phien ban
truong. Nhan su chua co ma Bo, hoac da co ma nhung mot thanh phan bo KEY bi sua, duoc hien thi boi do."*

Ma trận chuyển trạng thái — **ô hợp lệ VÀ ô bị chặn, cả hai**:

| Từ ↓ \ Tới → | Chưa lưu | Đã lưu (có mã địa phương) | Đã đồng bộ (có mã Bộ) | Đỏ (lệch KEY) |
|---|---|---|---|---|
| **Chưa lưu** | — | ✅ bấm `Ghi` | ⛔ **chặn** — mã Bộ không sinh tại chỗ | — |
| **Đã lưu** | — | — | ✅ đồng bộ lên CSDL Bộ | ✅ sửa một thành phần bộ KEY |
| **Đã đồng bộ** | — | — | — | ✅ sửa một thành phần bộ KEY |
| **Đỏ** | — | — | ✅ đồng bộ lại | — |

Ô ⛔ là nửa hay bị bỏ, **mà đó mới là chỗ bug sống**: nếu app sinh mã Bộ ngay lúc lưu thì mã đó là mã
bịa, và không gì phát hiện ra cho tới lúc đồng bộ thật.

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|
| NHANSU_TC_418 | Negative | `[State][Negative][ST][BR-NHANSU-003]` | Hồ sơ đội ngũ | Đường bị chặn: lưu hồ sơ mới KHÔNG được sinh mã định danh Bộ tại chỗ | `[factory]` Tài khoản vai trò Quản trị trường cấp TH đã đăng nhập, năm học `2026-2027`, trường test chưa có nhân sự nào tên `Kiem Tra Ma Bo` | Họ tên = `"Kiem Tra Ma Bo"`; các ô bắt buộc khác điền giá trị hợp lệ tối thiểu | 1. Mở màn `4.1 Hồ sơ đội ngũ`<br>2. Bấm `Thêm mới`<br>3. Nhập "Họ tên" = `"Kiem Tra Ma Bo"`<br>4. Điền các ô bắt buộc còn lại<br>5. Bấm `Ghi`<br>6. Mở lại hồ sơ vừa tạo, đọc ô Mã định danh Bộ GD&ĐT | 1. Màn `4.1 Hồ sơ đội ngũ` mở đúng trường test<br>2. Form `Thêm mới` mở ra<br>3. Ô "Họ tên" nhận giá trị `"Kiem Tra Ma Bo"`<br>4. Các ô bắt buộc nhận đúng giá trị vừa điền<br>5. App lưu thành công và hồ sơ CÓ mã địa phương<br>6. Ô Mã định danh Bộ GD&ĐT **TRỐNG**<br>- Dòng hồ sơ hiển thị màu đỏ trên lưới | Cao |

## Ba chỗ cả ba ví dụ cố ý KHÔNG làm

1. **Không lấy expected từ app.** Mọi expected ở trên trích từ ô `rule` của neo, không từ màn đang chạy.
   Lấy từ app là so app với chính nó, và phép so đó luôn PASS kể cả khi app sai.
2. **Không gộp bước.** Mỗi dòng đánh số là một thao tác, nên khi case đỏ thì biết đỏ ở bước nào.
3. **Không viết expected chung chung** kiểu "hiển thị đúng". Ví dụ 2 nói rõ đọc ra `0` và so với mẫu số
   đã ghi — một expected không nói được con số thì lúc chạy không ai phán được.
