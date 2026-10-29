---
name: requirements_analyzer
description: Phân tích requirement/UI/API artifact để tạo scope, business rule và coverage input cho Phase 1.
---

# Requirements Analyzer

## Purpose

Chuyển Backlog/tài liệu nguồn/Figma/Swagger/local artifact thành requirement summary, business rule, open question và coverage input phục vụ sinh testcase.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Scope | Xác định module, user story, screen, endpoint, role và data behavior trong scope. |
| Trace | Mapping requirement/business rule/API behavior tới testcase hoặc gap. |
| Risk | Phân loại rule/gap theo `Critical`, `High`, `Medium`, `Low`. |
| Setup input | Từ Swagger/API spec, xác định endpoint/payload có thể dùng để setup precondition (input cho Setup Strategy contract của testcase). |
| Question | Ghi open question khi tài liệu mâu thuẫn hoặc thiếu expected result. |
| Impact/Affected area | Nhận diện bề mặt dùng chung story đụng tới (data/field · endpoint · component/rule · status/enum · calc · permission · job) — input cho mục 17; cái không suy được thì flag "QA confirm". |

## Inputs · Outputs

**Vào:** requirement (Backlog · tài liệu nguồn · file local) · UI design (Figma hoặc ảnh/spec local) ·
API spec (Swagger/OpenAPI) · `.agent/config/project_context.md`.

**Ra:** requirement summary ở `<TASK_OUTPUT_DIR>/requirements/` hoặc `reports/phase1-summary.md` ·
coverage input (requirement/API/UI → TC hoặc gap) · ứng viên nguồn setup từ Swagger cho Setup Strategy
contract · open question ở `task.md` hoặc Phase 1 summary.

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Đầu Phase 1, cần chuyển tài liệu thành scope + rule + câu hỏi | Bò toàn hệ thống từ đầu ⇒ `npm run discover` trước, rồi skill này đọc kết quả |
| Tài liệu mâu thuẫn và cần biết nguồn nào thắng | Chốt một rule — rule chỉ vào `knowledge/domain` khi có `confirmed_by` |
| Cần biết vùng nào tài liệu không phủ | Thay cho `scope:anchor` — mẫu số lấy từ đó, không tự liệt kê |

## Recon — bước nào chạy lệnh nào, ra file nào

Kit có máy cho gần hết chín bước recon. **Đừng dò tay thứ đã có máy** — và đừng dựng lại máy đã có.
Chín bước, luật ghi nhận và bảng tầng network: [`references/recon.md`](references/recon.md).

Tất cả ra `knowledge/system/discovery/<build_id>/`, cùng một lượt `npm run discover`:

| Bước recon | File kết quả |
|---|---|
| Khung màn · form · action · workflow | `system_map.json` (`screens`, `crawl_completeness`) |
| Tầng network — **nghe thụ động** | `api_inventory.json` |
| Phân quyền theo role (khai nhiều account) | `roles.json` · `role_route_matrix` trong `system_map.json` |
| Bản đồ phủ tài liệu | `doc_coverage.json` |
| Bề mặt tiêm | `injection_surface.json` |
| So với lượt khám phá trước | `delta.json` |
| Câu hỏi sinh ra | `questions.md` ⇒ gộp vào `requirements/phase1-clarifications.md` |

`discover` **never-auto**: TỪ CHỐI chạy khi thiếu `--confirm-nonprod`, kể cả khi tên host trông là
non-prod — dấu hiệu trong tên host không thay được một lượt xác nhận của người.

🚫 **Recon chỉ quan sát THỤ ĐỘNG.** Không `curl`/`fetch`/`page.evaluate` gọi endpoint để dò hành vi: một
request mình tự tạo không chứng minh được gì về hành vi của UI. Luật này **chưa có máy gác** — lý do và
số đo ở [`references/recon.md`](references/recon.md) §2.

## Tài liệu bán phần — chia vùng trước khi mở browser

Sai lầm hay gặp là xử cả module theo MỘT cách: tin tài liệu rồi recon qua loa, hoặc bỏ tài liệu rồi recon
lại từ đầu. Cả hai đều tốn công và đều sai. Chia vùng trước — 🟩 đầy đủ ⇒ **đối chiếu** · 🟨 một phần ⇒
**bổ khuyết** · ⬜ trắng ⇒ **recon đủ** chín bước · ⚠️ nghi lỗi thời ⇒ recon đủ, tài liệu thành **danh
sách câu hỏi**. Chiến lược từng mức, luật cứng, và cột `Nguồn` bốn cấp:
[`references/recon.md`](references/recon.md) §4.

Khác A ở đúng một ô: A ghi vùng ⚠️ là "UI thắng". Ở đây quan sát là `OBSERVATION` + câu hỏi Ambiguity
Gate — xem mục dưới.

## Thứ tự ưu tiên khi hai nguồn nói ngược nhau

Hai nguồn mâu thuẫn thì **không chọn bừa, và cũng không lấy app ra phân xử**. Thứ tự:

| # | Nguồn | Ghi chú |
|---|---|---|
| 1 | **BA/PO xác nhận** (có ngày, ghi vào `knowledge/domain`) | Thắng mọi nguồn khác, kể cả tài liệu |
| 2 | **Văn bản pháp quy / quy định gốc** | TT32/2018, TT28/2020… — nguồn ngoài dự án, không ai sửa được cho tiện |
| 3 | **FSD/BRD bản mới nhất** | Ghi rõ phiên bản và mục; bản cũ không dùng để phản bác bản mới |
| 4 | **Figma / UI spec** | Chỉ là oracle cho **hiển thị**, không cho nghiệp vụ |
| 5 | **Bộ testcase chuẩn của hệ thống** | Dùng để tìm vùng SÓT, **không** để lấy expected |
| ⛔ | **App đang chạy** | **KHÔNG BAO GIỜ là oracle.** Xem mục dưới |

Mâu thuẫn chưa phân xử được thì nó là **câu hỏi Blocking** ở `reports/phase1-clarifications.md`, không phải
một lựa chọn im lặng.

## "UI thực tế" là SỰ THẬT QUAN SÁT, không phải oracle

Đây là chỗ kit khác `qig-qa-automation` về nguyên tắc: A cho phép requirement lấy từ "UI thực tế" đi thẳng
vào test case. Ở đây thì **không** — app không bao giờ là chuẩn đúng-sai của chính nó, vì so app với app
luôn PASS, kể cả khi app sai.

Đường đi đúng của một quan sát: **quan sát → câu hỏi Ambiguity Gate → BA/tài liệu chốt → `knowledge/domain`
có `confirmed_by` → mới thành oracle.**

⚙️ `npm run domain:check` **CHẶN** rule khai `source` lấy app làm nguồn ("quan sát trên app", "theo app
hiện tại", "UI thực tế", "như app đang hiển thị"). Đo 10/10/2026: 0 trong 118 rule thật mắc lỗi này, nên
luật xanh ngay — nó chặn đường lùi, không dọn nợ.

## "Không đề cập" KHÁC "không áp dụng"

Hai câu nghe giống nhau, hệ quả ngược nhau:

- **"Tài liệu không đề cập"** = chưa có căn cứ. KHÔNG kết luận gì, kể cả "không cần test".
- **"Không áp dụng"** = đã có căn cứ rằng chuyện đó không tồn tại trong phạm vi này.

Rule khai đặc tả im lặng vẫn hợp lệ — **nếu nêu được một neo độc lập**: toàn vẹn phổ quát, văn bản pháp
quy, BA/dev xác nhận, hoặc bộ testcase chuẩn. Dừng ở "đặc tả không đề cập" thì rule chỉ là suy đoán.
⚙️ `domain:check` cảnh báo đúng ca đó.

## Ba mức bằng chứng cho phân quyền

Khi dựng ma trận quyền (`PM-*` của [[system_mapper]]), mỗi ô `role × action` phải mang một trong ba mức:
**đã kiểm chứng** (`allow` / `deny_verified`) · **suy từ màn cấu hình** (`deny_inferred` + `inferred_from`)
· **chưa có căn cứ** (`unknown`).

**Ô `unknown` KHÔNG được làm tròn thành "không có quyền".** Khẳng định 403 ở một ô chưa ai chốt là tự bịa
ra một yêu cầu, và nếu app cho phép thì bug log ra là **bug bịa**. Chi tiết và máy gác:
`knowledge/SCHEMA.md` §`permission_matrix`.

## Bản đồ phủ tài liệu

Mỗi vùng rơi vào một trong bốn ô, và **ô nào cũng phải có người đọc**:

| | Có trong tài liệu | Không có trong tài liệu |
|---|---|---|
| **Có TC** | phủ đủ | TC dựa trên gì? Nếu là quan sát app ⇒ chưa có oracle |
| **Không có TC** | **vùng SÓT** — mẫu số của `scope:anchor` | vùng mù: phải hỏi BA |

Mẫu số của vùng sót lấy từ `npm run scope:anchor`, không tự liệt kê — số tự khai thì "đủ" chỉ còn nghĩa
"tôi thấy đủ".

## Decision Rules

- Ưu tiên artifact local/snapshot trước khi fetch nguồn lớn; chỉ đọc phần liên quan scope.
- Requirement chỉ là clear khi có expected behavior đủ để sinh testcase chạy được.
- Link/path nguồn đổi sau baseline là việc của partial-rerun, không tự thay nguồn chính.

## Constraints

- Không tự suy diễn expected result khi requirement mơ hồ.
- Không hardcode task/project cụ thể vào template chung.
- Không ghi secret vào requirement artifact/report.

## Anti-Patterns

- Paste toàn bộ raw tài liệu nguồn/Figma/Swagger vào chat.
- Bỏ qua permission/error/rollback/API side-effect trong coverage input.
- Bỏ qua vùng ảnh hưởng ngoài scope (change impact — mục 17).
- Coi số lượng testcase cao là coverage tốt nếu thiếu core/high-risk rule.

**Câu kích hoạt mẫu:** "đọc đặc tả này rồi tóm scope" · "rút business rule từ tài liệu" · "cần recon màn nào trước khi viết case" · "tài liệu phủ được bao nhiêu phần chức năng"
