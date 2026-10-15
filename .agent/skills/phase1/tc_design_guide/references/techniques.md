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
