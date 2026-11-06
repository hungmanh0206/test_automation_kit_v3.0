---
name: release_summary
description: "Gộp nhiều lượt chạy của MỘT MỐC (release/sprint/UAT) thành khuyến nghị GO/NO-GO có căn cứ, đối chiếu tiêu chí exit đã chốt trước khi xem kết quả."
---

# Release Summary — khuyến nghị, không phải quyết định

## Dùng khi nào

Dùng khi sắp bàn giao một mốc và cần nói với PM "có nên release không".
**KHÔNG dùng** cho một lượt chạy đơn lẻ (dùng `results:summary`), cũng không để kiểm bản đóng gói (dùng `release:verify`).

## Purpose

Kit đã có `results:summary` (tóm tắt **một** lượt chạy) và `release:verify` (kiểm **bản đóng gói** chạy
được). Thiếu thứ ở giữa: gộp nhiều lượt của một mốc rồi đối chiếu với **tiêu chí exit**, để trả lời câu
PM thật sự hỏi — *có nên release không*.

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Sắp bàn giao một mốc, cần khuyến nghị go/no-go | Một lượt chạy đơn lẻ (dùng `results:summary`) |
| Cần đối chiếu kết quả với tiêu chí đã chốt | Kiểm bản đóng gói chạy được (dùng `release:verify`) |
| Cần biết vùng nào chưa test trước khi nói tỉ lệ | Cần biết lượt này có đủ mẫu số để phán (dùng `run:analysis`) |

## Tiêu chí exit — chốt TRƯỚC, không chấm sau

⛔ **Xác định tiêu chí trước khi nhìn kết quả.** Nhìn số rồi mới đặt ngưỡng là hợp thức hoá kết quả, không
phải đánh giá.

⚙️ Máy gác đúng chỗ dễ lách nhất: `npm run release:summary:enforce` **TỪ CHỐI** chạy khi
`reports/exit_criteria.json` thiếu, **và** khi file đó có `mtime` **mới hơn** `testcase-status.json`. Chỉ
cần mở file tiêu chí ra hạ một ngưỡng là báo cáo "đạt" — so mtime bắt được đúng việc đó.

Dựng bộ mặc định: `npm run release:summary:init -- --task <K>`. Bộ đó là **mặc định của agent** và báo cáo
sẽ ghi rõ như vậy cho tới khi có `nguoiXacNhan`.

| # | Tiêu chí mặc định | Ngưỡng | Nguồn số |
|---|---|---|---|
| 1 | Bug Critical đang mở | 0 | `knowledge/bugs` |
| 2 | Bug Major đang mở | 0, hoặc workaround PM chấp nhận bằng văn bản | `knowledge/bugs` |
| 3 | Pass rate TC Priority High | ≥ 95% | `priority` |
| 4 | Pass rate toàn bộ TC đã chạy | ≥ 90% | `testcase-status.json` |
| 5 | Tỉ lệ BLOCKED | ≤ 5% | `testcase-status.json` |
| 6 | REQ mức Critical có ít nhất 1 TC PASS | 100% | traceability |
| 7 | Module trong phạm vi release đã có TC và đã chạy | 100% | `module` |

Cột **Nguồn số** là phần B thêm vào. A để tiêu chí ở dạng chữ, nên một tiêu chí không có dữ liệu vẫn có
thể bị chấm bằng cảm nhận. Khai nguồn thì máy tự biết tiêu chí nào nó đo được.

## Decision Rules

- **"KHÔNG ĐO ĐƯỢC" không bao giờ thành "Đạt".** Đo 10/10/2026 trên repo: `testcase-status.json` không có
  `priority` và không có `module`, `knowledge/bugs` có 0 file ⇒ **5 trong 7** tiêu chí hiện không đo được.
  Báo cáo ghi đúng như vậy và tính chúng vào lý do NO-GO.
- **Vùng chưa test in TRƯỚC mọi tỉ lệ.** Một tỉ lệ pass nghe khác hẳn khi biết 20 case chưa từng chạy.
- **BLOCKED và SKIP không tính là PASS, và cũng không tính vào "đã chạy".** Mẫu số thật là `pass + fail`.
- **Chấm "gần đạt" là không được.** 94.8% so với ngưỡng 95% là **không đạt**; chấp nhận được thì ghi
  `ngoaiLe` kèm người duyệt, đừng hạ ngưỡng.
- **Hai nguồn số lệch nhau thì phải nói ra**, không chọn một cái rồi báo như sự thật duy nhất.
- **QA khuyến nghị, PM quyết.** Đầu ra luôn là "ĐỀ XUẤT". Vì vậy `--enforce` **không** chặn vì NO-GO — nó
  chỉ chặn hai chuyện ở mục tiêu chí.

## Anti-Patterns

- Đặt ngưỡng exit sau khi đã xem kết quả.
- Ghi "Đạt" cho tiêu chí không có nguồn số.
- Nói "automation 96%" khi dữ liệu không phân biệt được manual với automation (`runId` là chuỗi tự do —
  phải khai `manualRunIdPrefix` mới tách được).
- Tính pass rate trên tổng số case thay vì trên số **đã chạy**, hoặc ngược lại, mà không nói rõ mẫu số nào.
- Viết "cấm release" thay vì "khuyến nghị NO-GO kèm căn cứ".

## Outputs

| Output | Vị trí | Mẫu |
|---|---|---|
| Báo cáo go/no-go có căn cứ | `<TASK_OUTPUT_DIR>/reports/release-summary.md` | Mẫu: `.agent/skills/shared/release_summary/templates/bao-cao-go-no-go.md` |
| Bảng đối chiếu tiêu chí exit đã chốt trước | cùng file trên |  |

> Mẫu cho thấy ba điều mô tả skill không dạy được: tiêu chí exit chốt TRƯỚC khi xem kết quả, "đạt nhờ miễn trừ" khác "đạt thật", và dòng cuối luôn là ĐỀ XUẤT.
## Related

- [[decision_recorder]] — ghi lý do khi PM duyệt một ngoại lệ, để lần sau không bàn lại.
- `npm run run:analysis` — lượt chạy có đủ mẫu số để phán hay chưa (v2.5.0 G1.2).
- `npm run release:verify` — bản đóng gói chạy được hay không, việc khác hẳn.

**Câu kích hoạt mẫu:** "gộp kết quả cả sprint lại" · "go hay no-go cho mốc này" · "tổng hợp nhiều lượt chạy thành một khuyến nghị" · "đối chiếu với tiêu chí exit đã chốt"

> Đừng lẫn với `npm run results:summary`: lệnh đó tóm tắt MỘT lượt chạy. Skill này gộp NHIỀU lượt của
> cùng một mốc rồi đối chiếu tiêu chí exit, và nó ra một khuyến nghị go/no-go — không chỉ một bảng số.
