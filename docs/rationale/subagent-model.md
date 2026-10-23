# Việc nào giao subagent model rẻ, việc nào không

> Nhắc tới ở [`USER_GUIDE.md`](../../USER_GUIDE.md) mục 8.3. File này giữ lý do và số đo.

Việc **máy móc** giao cho subagent ở [`.claude/agents/`](../../.claude/agents/) với model rẻ. Việc cần
**suy luận nghiệp vụ** thì không giao: phân tích spec, Ambiguity Gate, dựng oracle, triage FAIL, và
Bug Claim.

| Subagent | Việc | Model | Gọi từ |
|---|---|---|---|
| `test-runner` | Chạy spec rồi trả tóm tắt. Không chấm verdict | `haiku` | `phase2_03` bước 1 |
| `excel-convert` | Markdown sang Excel, ghi cột `Result`. Không đụng ô nào khác | `haiku` | `phase1_03`, `phase1_04` |
| `case-debugger` | Gỡ MỘT case đỏ: đọc log và ảnh, soi DOM, sửa locator, chạy lại | **mặc định** | `phase2_03` bước 4 |

## Vì sao hai việc đầu đi model rẻ

Cả hai có **hợp đồng vào ra là đường dẫn file**. Sai thì thấy ngay, không cần đọc hiểu kết quả.

## Vì sao `case-debugger` cố ý KHÔNG ghim model rẻ

Gỡ một case đỏ là đọc DOM rồi đoán nguyên nhân. Đó là suy luận, không phải việc máy móc.

Một subagent model rẻ được giao việc cần suy luận **vẫn sẽ đưa ra kết luận**, và kết luận đó trông y
hệt kết luận của model mạnh. Rẻ đi một chút, sai đi rất nhiều.

## Vì sao vẫn đẩy nó ra khỏi context chính

Đo 10/10/2026 trên 5 phiên chạy task thật: **1.442 lượt `node -e`** và **825 lượt `sed`**. Phần lớn là
dò DOM và đọc log cho đúng một case. Mỗi lượt là một message kèm cả context.

Giao ra ngoài thì context chính chỉ nhận khoảng 15 dòng tóm tắt.

## Ba điều đã xác minh, và một điều chưa

**Đã xác minh 10/10/2026** (xem `docs/v2.4.1/AGENTS_VERIFY.md`): `test-runner` và `excel-convert` được
gọi thật trên fixture offline và trả đúng hợp đồng. Đối chiếu độc lập, không tin lời khai.

**Định nghĩa agent chỉ nạp lúc phiên BẮT ĐẦU.** File thêm giữa phiên không xuất hiện trong danh sách.
Chuyện đó đã suýt bị chẩn đoán nhầm thành "frontmatter hỏng". Thiếu trong danh sách thì kiểm **thời
điểm** trước, đừng sửa file. Mở phiên mới rồi gõ `/agents`.

**Chưa đọc lại được model thật đã chạy.** Frontmatter khai `haiku` và harness nhận agent, nhưng kết
quả trả về không mang tên model. Nên câu "việc máy móc đã đi model rẻ" hiện dựa vào **khai báo**,
không dựa vào phép đo.
