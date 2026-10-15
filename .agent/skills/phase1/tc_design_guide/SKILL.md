---
name: tc_design_guide
description: Dạy cách THIẾT KẾ test case thủ công cho tốt — 6 thành phần, ranh giới Actor/Context/Tiền điều kiện, chọn kỹ thuật theo tình huống, anti-pattern. Dùng khi đang viết testcase ở Phase 1, trước khi gắn tag chiều. Không dạy locator, không đặt luật evidence.
---

# Thiết kế test case — hướng dẫn

> **Mỗi điểm dạy ở đây đều nối tới một máy kiểm có thật**, hoặc ghi thẳng *"chưa có máy"*. Không có
> mục nào tự chấm bằng văn: việc chấm thuộc `tc:review`, `dim:coverage`, `gate:gen-testcase`.
>
> Phần dày nằm ở `references/`, đọc khi cần: [kỹ thuật](references/techniques.md) ·
> [checklist field](references/field_checklist.md) · [component](references/component_checklist.md) ·
> [anti-pattern](references/anti_patterns.md).

## Khi nào dùng

Đang viết/sửa testcase ở Phase 1, trước bước gắn tag chiều.

## KHÔNG dùng khi

- Cần cách đặt locator ⇒ `locator_strategy`.
- Cần luật evidence (chụp gì, lúc nào) ⇒ `CLAUDE.md` §4 + `evidence_recorder`. Skill này **không đặt
  luật evidence nào** — hai nơi đặt luật là hai nơi mâu thuẫn.
- Cần CHẤM chất lượng một bộ TC đã viết ⇒ `tc_reviewer` (9 tiêu chí, có máy). Skill này dạy lúc VIẾT.
- Cần quyết phạm vi/mẫu số của bộ TC ⇒ `scope:anchor` + `requirements_analyzer`.

## Sáu thành phần của một test case dùng được

Ánh xạ sang 10 cột canonical của bộ Markdown (`scripts/lib/testcase/model.js`):

| Thành phần | Cột canonical | Hỏng khi |
|---|---|---|
| Định danh | `ID` | trùng, hoặc đổi khi sinh lại |
| Mục tiêu | `Trường hợp kiểm thử` | nói "kiểm tra chức năng X" — không nói **kiểm điều gì** |
| Tiền điều kiện | `Tiền điều kiện` | lẫn với thao tác của case |
| Dữ liệu | `Dữ liệu test` | ghi "dữ liệu hợp lệ" thay vì giá trị thật |
| Các bước | `Các bước thực hiện` | mô tả ý định thay vì thao tác |
| **Kỳ vọng** | `Kết quả mong đợi` | **rỗng, hoặc "hiển thị đúng"** — `gate:gen-testcase` CHẶN |

Kỳ vọng là thành phần duy nhất không được suy từ app. Nó đến từ đặc tả, từ `knowledge/domain`
(`oracle_ref`), hoặc là một **câu hỏi chưa trả lời** — không phải từ thứ bạn vừa nhìn thấy trên màn.

## Actor · Context · Tiền điều kiện — ba thứ hay viết trùng nhau

| | Trả lời câu gì | Ví dụ |
|---|---|---|
| **Actor** | AI thao tác | "tài khoản cấp trường" |
| **Context** | Ở đâu, trạng thái nào của hệ | "màn Hồ sơ lớp, năm học 2026-2027" |
| **Tiền điều kiện** | Cái gì PHẢI CÓ SẴN trước bước 1 | "đã có lớp QA10A1 thuộc khối 10" |

Dấu hiệu viết sai hay gặp: nhét thao tác đăng nhập vào Tiền điều kiện (đó là **Actor**), hoặc nhét
năm học vào Dữ liệu (đó là **Context**). *Chưa có máy bắt chỗ này — review tay.*

## Chọn kỹ thuật theo tình huống, không theo thói quen

Bảng đầy đủ (8 kỹ thuật, điều kiện kích hoạt, ví dụ, máy chấm):
[`references/techniques.md`](references/techniques.md).

Rút gọn: field có **min/max** ⇒ `BVA` · miền chia nhóm được ⇒ `EP` · **≥3 điều kiện** cùng quyết một
output ⇒ `DT` · entity **≥3 trạng thái** ⇒ `ST` · **≥3 tham số độc lập** ⇒ `PW` · đầu vào **phân tầng**
(loại quyết định bộ ô tiếp theo) ⇒ `CT`.

## Quan sát KHÔNG phải oracle

Tài liệu ghi một đằng, màn hình cho thấy một nẻo — **không bên nào tự thắng**. Cái nhìn thấy là
`observed`; kỳ vọng phải có neo. Lệch nhau ⇒ ghi một **câu hỏi cho Ambiguity Gate**, và case đó mang
`OBSERVATION` cho tới khi có người chốt.

Viết kỳ vọng theo thứ vừa nhìn thấy là biến một lỗi đang có thành một lỗi đã được phê duyệt.

## Viết bước để sau này dùng lại được

Câu bước khớp được với danh mục bước (`steps:match`, v2.8.0) thì `compile:spec` sinh được spec từ
chính testcase. Ba luật cho phần này — chi tiết ở
[`references/techniques.md`](references/techniques.md) mục cuối:

1. Giá trị **bọc trong nháy**: `nhập "Nguyễn Văn A" vào ô "Họ tên"` — không viết `nhập tên hợp lệ`.
2. Một câu **một thao tác**. Hai việc thì tách hai dòng đánh số.
3. Dùng **động từ chuẩn** của `.agent/config/step_phrasing.json`, đừng tự đặt từ đồng nghĩa mới.

## Viết xong chưa phải là xong — mở rộng quanh case

Bộ TC đạt chiều coverage vẫn có thể bỏ sót theo **bề mặt**. Sau khi viết, hỏi 7 trục
(`RULE_GLOBAL` §7 trục): field cùng khối · cùng giá trị khác màn · chuỗi lưu trữ · nhánh · trạng thái
kế cận · **phân quyền** · **oracle giá trị tính toán**. Chi phí theo risk band: `npm run expansion:plan`.

## Điểm dạy → máy kiểm

| Điểm dạy | Máy chấm |
|---|---|
| field có min/max ⇒ phải có BVA | `npm run dim:coverage` (chiều §3) |
| ≥3 điều kiện tổ hợp ⇒ bảng quyết định | `npm run matrix:coverage` |
| entity ≥3 trạng thái ⇒ ma trận chuyển | `npm run dim:coverage` (§10 Guard) |
| kỳ vọng rỗng / "hiển thị đúng" | `npm run gate:gen-testcase` |
| bộ TC đủ 9 tiêu chí chất lượng | `npm run tc:review` |
| mỗi case gắn tag chiều | `npm run dim:coverage -- --enforce` |
| câu bước dùng lại được | `npm run steps:match` |
| giá trị dẫn xuất (tổng · ngưỡng) | `npm run oracle:calc` |
| hành động một-lần · trừ tài nguyên | `npm run concurrency:check` |
| mở rộng 7 trục quanh case | `npm run expansion:plan` |
| **Actor/Context/Tiền điều kiện viết trùng** | **chưa có máy — review tay** |
| pairwise phủ đủ cặp **và đủ lớp kết quả** chưa | `npm run matrix:coverage` |
| **classification tree phủ đủ nhánh chưa** | **chưa có máy — review tay** |

Hai dòng cuối ghi thẳng là chưa có máy. Một bảng như thế này chỉ có giá trị khi người đọc kiểm lại
được từng dòng; bịa một tên máy là làm hỏng cả bảng.

## Anti-pattern

Danh sách đầy đủ kèm máy bắt được: [`references/anti_patterns.md`](references/anti_patterns.md).
Ba cái hay gặp nhất: kỳ vọng mô tả thao tác thay vì kết quả · một case kiểm năm thứ · dữ liệu test
viết "hợp lệ/không hợp lệ" thay vì giá trị thật.
