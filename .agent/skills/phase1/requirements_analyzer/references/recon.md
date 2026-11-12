# requirements_analyzer — tra cứu: quy trình recon

> Tách khỏi `SKILL.md` (v2.9.5 §2) để skill ở dưới trần 200 dòng. Đọc file này khi thật sự đi recon;
> `SKILL.md` giữ bảng "bước → lệnh → file kết quả" và các luật cứng.
>
> **Quy trình lấy từ `qig-qa-automation/skills/requirements-analyzer` §3.1–3.3.1.** Phần MÁY thì thay
> bằng máy của kit này — B có bộ `scripts/qa/discovery/` mạnh hơn phần A mô tả bằng tay. Phần ORACLE
> thì KHÔNG lấy: xem mục cuối.

---

## 1. Chín bước recon UI

Thứ tự có ý: bước sau dùng kết quả bước trước. Nhảy bước thì không sai ngay, nhưng sẽ phải quay lại.

| # | Bước | Thu được gì |
|---|---|---|
| 1 | **Khung giao diện** — header, sidebar, main, breadcrumb | biết màn có bao nhiêu vùng, và vùng nào là nơi dữ liệu sống |
| 2 | **Form & input** — mọi `input`/`select`/`textarea`, kèm `type`, `required`, `maxlength`, `pattern`, giá trị mặc định | danh mục field thật, và ràng buộc mà UI tự khai |
| 3 | **Action** — từng nút (Ghi, Huỷ, Xoá, Sửa) và thông báo khi bấm sai | tập hành động, và nguyên văn message |
| 4 | **Workflow** — phụ thuộc giữa control (nút chỉ bật khi tích ô nào) | ràng buộc liên-field, thứ không nhìn ra từ một ảnh tĩnh |
| 5 | **Phân quyền** — đăng nhập từng role nếu có account | ô nào của ma trận quyền là `allow` ĐÃ KIỂM CHỨNG |
| 6 | **Trạng thái** — các trạng thái quan sát được và hành động cho phép ở từng trạng thái | nguyên liệu cho state machine |
| 7 | **Thông báo lỗi** — trigger từng validation, ghi NGUYÊN VĂN | nguồn duy nhất cho expected của case âm |
| 8 | **Tầng network** — xem mục 2 | thứ hệ thống THỰC SỰ làm, khác với thứ nó hiển thị |
| 9 | **Thăm dò quyền khi thiếu account** — xem mục 5 | ô `deny_inferred`, và chỉ tới mức đó |

Bước 7 cần một lượt GHI vào app (submit form sai để lấy message). Đó là **chạm UAT dùng chung**:
chỉ làm khi `write_firewall` đang bật, dữ liệu cố ý không hợp lệ, và **xác nhận với user trước** —
CLAUDE.md §2.

---

## 2. Tầng network — đọc THỤ ĐỘNG

DOM cho biết hệ thống **đang hiển thị gì**. Tầng network cho biết hệ thống **thực sự làm gì**, và đó là
nguồn quý nhất khi không có một dòng tài liệu nào.

Máy của kit: `scripts/qa/discovery/api_inventory.js`. Đo 28/10/2026 trên mã nguồn của nó: **7** chỗ nghe
response, **0** chỗ tự gửi request — tức nó đúng là bộ nghe thụ động, không phải bộ dò.

| Loại request | Rút ra được | Ghi vào |
|---|---|---|
| `GET` danh sách | tên field thật · field CÓ trong data mà KHÔNG hiển thị · cấu trúc phân trang | danh mục field · REQ phân trang |
| `GET` chi tiết | schema đầy đủ của entity · quan hệ tới entity khác | danh mục field · bản đồ phụ thuộc |
| `POST`/`PUT` payload | nhãn hiển thị ↔ tên field thật · field ẩn được gửi kèm · **kiểu dữ liệu thật** | cột ánh xạ nhãn ↔ field |
| **4xx khi submit sai** | ⭐ validation CHỈ CÓ Ở SERVER · nguyên văn message trong body | danh mục validation |
| response chứa enum | danh sách trạng thái ĐẦY ĐỦ, kể cả trạng thái chưa từng thấy trên UI | ma trận trạng thái |
| endpoint khi mở dropdown | bảng master nguồn của dropdown · TỔNG số option thật so với số đang hiện | phát hiện dropdown bị giới hạn |
| endpoint **không UI nào gọi** | tính năng chưa build, hoặc đã gỡ giao diện | câu hỏi `spec:gap` |
| `403` khi đổi role | ranh giới quyền thật ở tầng server | ma trận quyền |

### 🚫 Cấm gọi API trực tiếp để dò hành vi

Không `curl`, không `fetch`, không `page.evaluate` gọi endpoint. Recon chỉ được quan sát request do
**chính UI** phát sinh.

Hai lý do, và lý do thứ hai mới là lý do thật:

1. Gọi thẳng API trên môi trường dùng chung là hành vi xâm nhập.
2. **Một request do mình tự tạo KHÔNG chứng minh được điều gì về hành vi của UI.** Nó chứng minh server
   phản hồi thế nào với payload mình nghĩ ra — không phải với payload mà UI thật sẽ gửi. Dùng nó làm căn
   cứ cho một REQ là suy từ một tình huống không tồn tại.

⚠️ **Hiện KHÔNG có máy gác luật này.** Đo 28/10/2026: `scripts/qa/hooks/guard_db_access.js` có **0** chỗ
nhắc `curl`/`fetch`/`wget`, nên nó không chặn HTTP tới host UAT. Tôi **không tự thêm hook**, vì đo tiếp
thì thấy bán kính nổ rộng: **32** file trong kit gọi HTTP và **93** file tham chiếu biến host UAT (k6 mượn
cookie, health check, bộ load…). Một hook chặn theo host sẽ báo oan hàng loạt, và gate báo oan thì bị tắt.
Nên đây là **luật người giữ**, có ghi rõ là chưa có máy — không phải luật được khai là đã gác.

---

## 3. Bốn luật ghi nhận, khi network và UI nói khác nhau

| Tình huống | Xử lý |
|---|---|
| Rule chỉ có ở server, UI KHÔNG chặn | vẫn gán REQ, nguồn ghi `API · POST /x · 422`, **mở câu hỏi**: chặn ở UI hay cố ý để server chặn? |
| Message API **khác** message trên UI | ghi **cả hai nguyên văn** + câu hỏi 🔴. Đây là bug tiềm ẩn, không phải mơ hồ thường |
| Field có trong payload mà KHÔNG có trên form | `OBSERVATION` + câu hỏi `spec:gap`. **Không** im lặng bỏ qua, và cũng **không** suy ra một yêu cầu |
| Endpoint không UI nào gọi | ghi nhận, **KHÔNG gọi thử để "kiểm chứng"** |

Hai ô cuối là chỗ dễ sai nhất: thấy một field trong payload rồi viết một REQ cho nó là **tự sinh ra yêu
cầu**. Field đó có thể là rác của bản cũ, có thể là của tính năng chưa bật.

---

## 4. Tài liệu bán phần — chia vùng TRƯỚC khi mở browser

Tình huống phổ biến nhất: có spec của 2/8 màn, một file Excel chỉ có danh sách field, một mockup 6 tháng
trước. Sai lầm hay gặp là xử cả module theo MỘT cách — hoặc tin tài liệu rồi recon qua loa, hoặc bỏ tài
liệu rồi recon lại từ đầu. Cả hai đều tốn công và đều sai.

| Mức phủ | Việc PHẢI làm | Việc được rút gọn |
|---|---|---|
| 🟩 **Đầy đủ** | mở màn, kiểm TỪNG rule tài liệu nêu có đúng trên UI không; lệch ⇒ câu hỏi | rule đã ghi rõ và đã khớp thì không dò lại từ đầu |
| 🟨 **Một phần** | recon ĐẦY ĐỦ phần tài liệu không nói — thường là validation message, ca biên, phân quyền | phần tài liệu nêu rõ và khớp UI ⇒ trích dẫn, không mô tả lại |
| ⬜ **Trắng** | recon đủ 9 bước mục 1 | không rút gọn gì |
| ⚠️ **Nghi lỗi thời** | recon đủ như ⬜. Tài liệu thành **danh sách câu hỏi**: "chỗ này tài liệu nói X, thực tế thế nào?" | không rút gọn gì |

**Luật cứng:**

- ❌ Không dùng tài liệu bán phần để suy ra vùng nó KHÔNG phủ. Spec form Thêm không nói gì về form Sửa,
  dù hai form nhìn giống nhau — và kit đã trả giá đúng chỗ này: app mẫu chặn ở Thêm nhưng hở ở Sửa.
- ❌ Vùng ⬜ Trắng không được rút gọn với lý do "module này chắc giống module kia".
- ✅ Bản đồ phủ phải nằm TRONG tài liệu đầu ra, ngay sau Tổng quan — người đọc cần biết phần nào tin được
  từ spec, phần nào do agent quan sát.
- ✅ Khi `/discover` đã chạy: đọc `doc_coverage.json` trong thư mục build, bản đồ phủ cấp hệ thống có sẵn
  ở đó, chỉ cần chi tiết hoá xuống cấp vùng.

### Cột `Nguồn` phân biệt được bốn mức

| Giá trị | Nghĩa |
|---|---|
| `Tài liệu · <file> · <vị trí>` | chỉ có trong tài liệu, **chưa** mở UI kiểm |
| `Tài liệu + kiểm chứng thực tế` | tài liệu nêu, đã mở UI xác nhận khớp — **mức tin cậy cao nhất** |
| `Quan sát thực tế` | chỉ thấy ở UI, tài liệu không nói ⇒ là `OBSERVATION`, **chưa** phải oracle |
| `API · <method> <endpoint> · <mã>` | lấy từ tầng network, đủ để người review mở lại tab Network đối chiếu |

---

## 5. Thăm dò quyền khi thiếu account

Không đủ account cho mọi role là chuyện thường. Khi đó:

- đọc **màn cấu hình quyền** (nếu app có) để suy ra ô `deny_inferred`, và **bắt buộc** ghi `inferred_from`
  là suy từ đâu;
- ô không suy được từ đâu cả thì để `unknown`. **`unknown` KHÔNG phải deny** — dựng case 403 trên đó là
  khẳng định một yêu cầu chưa ai chốt, và nếu app cho phép thì bug log ra là **bug bịa**;
- ⚙️ `npm run system:check` in dòng tổng ba mức, nên tỉ lệ `unknown` của ma trận hiện ra chứ không ẩn.

---

## 6. Chỗ KHÔNG lấy của A — và vì sao

A dạy thứ tự tin cậy `DOM thật > Ảnh evidence > Tài liệu chữ`, và khi tài liệu lệch ảnh thì **"viết TC
theo những gì ảnh cho thấy"**.

Nói cho công bằng: A **không** im lặng chọn bên. Nó bắt ghi một dòng `ASM-XX` nêu rõ xung đột và báo user
ngay ở tóm tắt cuối. Khoảng cách giữa hai kit hẹp hơn nhiều người tưởng, và nó nằm ở đúng một điểm:

| | A | B |
|---|---|---|
| Khi tài liệu ≠ quan sát | quan sát thành **expected của TC**, kèm cờ `ASM-XX` | quan sát thành **`OBSERVATION`**, KHÔNG thành expected; ra câu hỏi Ambiguity Gate |
| Có im lặng chọn bên không | **không** | **không** |

B giữ nguyên kỷ luật của mình: app không bao giờ là oracle, vì so app với app thì luôn PASS — kể cả khi
app sai. Nhưng lý do từ chối phải ghi đúng là *"quan sát không được thành expected"*, KHÔNG phải *"A cho
app làm oracle"*. Mô tả sai đối thủ rồi tự thắng là thứ đợt này không được làm.
