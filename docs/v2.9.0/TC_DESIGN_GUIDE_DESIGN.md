# v2.9.0 — Skill `tc_design_guide` — THIẾT KẾ

> Prompt ghi "chạy sau v2.8.3". Thực tế cây đang ở **v2.8.4** (nhánh `feat/v2.8.4`, hai mục A/B đã
> commit). v2.9.0 nối sau v2.8.4 — không trùng số, không phải mở lại gì.

---

## 0. Năm điều prompt nói không khớp số đo

Đo 14/10/2026 trên `_import/qig-qa-automation/` và trên chính kit B. **Ba cái đầu đổi nội dung bảng so
"vượt A"; cái thứ tư đổi việc phải làm.**

| # | Prompt nói | Đo ra | Hệ quả |
|---|---|---|---|
| 1 | "A có **5 link chết**" | Đếm đúng 5, nhưng mở từng cái: **cả 5 là đường dẫn MINH HOẠ** — `<module>` (placeholder), *"VD `docs/testcases/customers/parts/...`"* trong bảng, tên file ĐẦU RA vẽ trong sơ đồ luồng. **A có 0 link gãy thật.** | Dòng "5 → 0" ở §E là so sánh dựng trên số thổi phồng. Ghi **0 vs 0**, và nêu vì sao số 5 xuất hiện. |
| 2 | B "0 link gãy" | B có **0 link nào cả** trong 25 skill — 0/0, không phải 0/28. | Gate refcheck là vùng phủ **MỚI**, không phải chuyện B vốn đã hơn. |
| 3 | "A ghi *ảnh thắng*" | Tiêu đề mục viết vậy, nhưng **thân mục nói "KHÔNG tự chọn bên nào"**, bắt ghi `ASM-XX` và báo user ngay ở tóm tắt. | Khác biệt thật HẸP hơn: A cho **quan sát trở thành kỳ vọng đã viết**; B giữ quan sát ở `observed` và đẩy xung đột sang Ambiguity Gate. Sửa phải nói đúng chỗ hẹp đó. |
| 4 | "A khoá đúng **6 mã kỹ thuật**" | **Ngược.** `design_techniques.json` với 6 mã (EP·BVA·DT·ST·UC·EG) là của **B**, và `techniquesOf()` khớp CHÍNH XÁC theo nó. Bảng kỹ thuật BẮT BUỘC của A chỉ có **3 dòng**: EP+BVA · Decision Table · State Transition. | "Bỏ khoá 6 mã" nghĩa là đổi hợp đồng của **chính B**. Xem §C.3. |
| 5 | token A: 14.580 / 12.000 | ~**16.204** / ~**13.343** (quy đổi 3,6 ký tự/token) | Khác cách quy đổi, **không đổi kết luận**: A nặng gấp ~11 lần trung bình skill của B (~1.453). |

Khớp và giữ nguyên: A **có** mục "🛡️ AI Self-Quality Gate" tự chấm bằng văn (dòng 547), và A **có**
gộp QUICK/FULL RBT/CHECKLIST trong một file 937 dòng.

---

## 1. Cấu trúc skill

`.agent/skills/phase1/tc_design_guide/`

| File | Nội dung | Dự toán token |
|---|---|---|
| `SKILL.md` | khi nào dùng · 6 thành phần TC · ranh giới Actor/Context/Tiền điều kiện · chọn kỹ thuật (tóm tắt + trỏ) · anti-pattern cô đọng · **bản đồ "điểm dạy → máy kiểm"** | **≤ 2.300** (trần 2.500, chừa biên) |
| `references/techniques.md` | ≥8 kỹ thuật, mỗi cái: điều kiện kích hoạt · cách làm · ví dụ · chiều/case-type của B · máy nào chấm | ~2.000 |
| `references/field_checklist.md` | checklist theo loại field, mở rộng bảng 15 loại của A | ~1.800 |
| `references/component_checklist.md` | rà ngoài form: lưới · phân trang · modal · upload · toast | ~1.200 |
| `references/anti_patterns.md` | lỗi thiết kế hay gặp, mỗi mục kèm máy bắt được (nếu có) | ~1.000 |

`SKILL.md` **chỉ tóm tắt và trỏ**. Đây là chỗ giàu hơn A mà không phình phần luôn-nạp: A nhồi tất cả vào
một file 16k; ở đây phần luôn-nạp ≤2,3k, phần dày nạp **khi cần**.

---

## 2. Bảng "A dạy gì → B để ở đâu"

| Mảng kiến thức của A | B đã có chưa | Làm gì |
|---|---|---|
| 6 thành phần TC (ISTQB) | có, rải ở `02_gen_testcases` + `model.js` (10 cột canonical) | **Port tóm tắt** vào `SKILL.md`, ánh xạ sang 10 cột canonical, trỏ chứ không chép luật |
| Ranh giới Actor ↔ Context ↔ Pre-Condition | **chưa có chỗ dạy tập trung**; `tc_review` tiêu chí 7 có chấm actor | **Port**, đây là giá trị rõ nhất của A |
| TC ID convention `[MODULE]-[TECH]-[NNN]` | B có quy ước riêng, `model.js` đọc `tcId` | **Chỉ link**, không áp convention của A |
| Bảng kỹ thuật bắt buộc (3 dòng) | B có `design_techniques.json` (6 mã) + `combinatorial_matrix` | **Port + MỞ RỘNG** lên ≥8 (thêm pairwise, classification tree) |
| Checklist 15 loại field | rải ở §3 Field validation, §12 Display | **Port + mở rộng** (tiếng Việt có dấu · tiền · ngày+múi giờ nối §24) |
| Checklist component ngoài form | rải ở §4 UI, §7 Export/Import, §12 | **Port**, mỗi mục trỏ chiều |
| Quy trình RBT 6 bước | B có `risk_model.json` + `depth.PLAN` theo band | **Chỉ link** — B đã có máy, chép lại là tạo bản thứ hai |
| Anti-pattern "NGHIÊM CẤM" | rải ở `RULE_GLOBAL`, `tc_review` | **Port danh sách**, bỏ mục mâu thuẫn, mỗi mục kèm máy |
| Quy tắc evidence (mở ảnh trước, @NeedsVerify) | B có `evidence_recorder` + `CLAUDE.md` §4 | **Chỉ link một dòng** — không đặt luật evidence mới |
| Write-first, cấu trúc thư mục, batch, task.md | B có `scope_anchor`, `gate:gen-testcase` | **Không port** — chuyện vận hành của A, B làm khác |
| "AI Self-Quality Gate" 9 tiêu chí | B có `tc_reviewer` (9 tiêu chí, có máy) | **Không port**, chỉ trỏ tới máy thật |
| Mode routing QUICK/FULL/CHECKLIST | B tách skill theo việc | **Không port** — đó là tật gộp của A |

---

## 3. Ba mâu thuẫn của A, sửa thế nào

**① Quan sát ≠ oracle.** A: *"viết TC theo những gì ảnh cho thấy"* + ghi `ASM-XX`. B: ảnh là `observed`;
kỳ vọng phải có **neo** (`oracle_ref` / ô `Kết quả mong đợi` của bộ canonical). Lệch giữa tài liệu và
ảnh ⇒ **câu hỏi cho Ambiguity Gate**, và TC đó mang `OBSERVATION` cho tới khi có người chốt — chứ quan
sát không tự thành kỳ vọng. Skill dạy đúng câu này, và test grep chặn mọi câu kiểu "ảnh thắng".

**② Evidence.** Skill **không** đặt luật evidence nào; nó trỏ một dòng tới `CLAUDE.md` §4 +
`evidence_recorder`. A tự mâu thuẫn ("chụp khi fail" vs "chụp mọi test") vì đặt luật ở hai nơi.

**③ Locator.** Skill **không nói về locator** — đã có `locator_strategy`/`locator_lint`.

---

## 4. Mỗi điểm dạy → một máy kiểm

Bảng trong `SKILL.md`. Mẫu (sẽ kiểm bằng test là các máy này CÓ THẬT):

| Điểm dạy | Máy chấm |
|---|---|
| field có min/max ⇒ phải có BVA | `dim:coverage` chiều §3 |
| ≥3 điều kiện tổ hợp ⇒ bảng quyết định | `combinatorial_matrix` |
| entity ≥3 trạng thái ⇒ ma trận chuyển | `dim:coverage` §10 Guard |
| expected rỗng / "hiển thị đúng" | `gate:gen-testcase`, `tc:review` |
| câu bước viết để dùng lại được | `steps:match`, `compile:spec` (v2.8.0) |
| mỗi case gắn tag chiều | `dim:coverage --enforce` |
| sau khi viết TC, mở rộng 7 trục | `expansion:plan`, `expansion_audit` |
| giá trị dẫn xuất (tổng/ngưỡng) | `oracle:calc` (⑦, v2.8.1) |
| hành động một-lần / trừ tài nguyên | `concurrency:check` (v2.8.4) |
| **Actor/Context/Tiền điều kiện viết trùng nhau** | **chưa có máy — review tay** |
| **pairwise chọn đủ cặp chưa** | **chưa có máy đếm cặp — review tay** |

Hai dòng cuối ghi thẳng "chưa có máy". Bịa tên máy là điều kiện DỪNG của prompt, và cũng là thứ làm
bảng này vô dụng ngay khi ai đó kiểm lại.

---

## 5. Gate `skills:refcheck` — và cái bẫy nó phải tránh

Yêu cầu §C.4: mọi link nội bộ trong skill phải tồn tại. **Nguy hiểm: viết ngây thơ thì nó tái tạo đúng
dương tính giả đã sinh ra con số "5 link chết" của A.**

Nên gate phân biệt hai loại:

| Loại | Dấu hiệu | Xử lý |
|---|---|---|
| Link THẬT | trỏ file trong cùng skill (`references/…`) hoặc đường dẫn repo có thật | file không tồn tại ⇒ **CHẶN** |
| Đường dẫn MINH HOẠ | chứa `<…>` placeholder · nằm sau "VD"/"ví dụ" · trong khối ```code``` · là tên file đầu ra | **bỏ qua**, không tính là link |

Đối chứng hai chiều bắt buộc: một link thật gãy ⇒ CHẶN; một đường dẫn minh hoạ ⇒ **KHÔNG** chặn. Lấy
chính 5 ca của A làm bộ đối chứng âm — chúng là ví dụ thật, không phải ca bịa.

---

## 6. Token

`SKILL.md` ≤2.300 (trần 2.500). Phần bắt buộc của `/phase1` **không tăng**: skill khai `co_dieu_kien`
trong `load_map`, kích hoạt ở `phase1_02_generate_testcases`; workflow chỉ thêm **một dòng** trỏ tới.
Nếu `prompt:budget` báo tăng, cắt bù trong cùng luồng — không nới số, đúng cách v2.8.1 đã làm.

---

## 7. Ba câu cần bạn chốt

1. **`design_techniques.json` có 6 mã, và `techniquesOf()` khớp CHÍNH XÁC theo nó.** Pairwise và
   classification tree chưa có mã. Thêm hai mã (`PW`, `CT`) vào config — hay dạy chúng như kỹ thuật
   **chưa có mã**, review tay? *(Tôi đề xuất: thêm mã, vì không thêm thì `dim:coverage`/`tc:review`
   không bao giờ thấy chúng — tức dạy xong không ai gác.)*
2. **Bảng §E dòng "Link gãy"**: ghi **0 vs 0** kèm giải thích, hay giữ "5 vs 0" theo prompt? *(Tôi đề
   xuất 0 vs 0 — "vượt A" bằng một con số thổi phồng thì lần ai đó kiểm lại, cả bảng mất tin.)*
3. **Phạm vi port checklist field**: 15 loại của A + 3 mục mới (tiếng Việt có dấu · tiền · ngày+múi
   giờ), hay rút gọn còn các loại mà B có chiều tương ứng? *(Tôi đề xuất bản đầy đủ 18 — checklist là
   thứ đọc khi cần, không nằm trong phần luôn-nạp.)*
