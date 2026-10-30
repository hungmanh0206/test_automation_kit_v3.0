# v2.9.6 — BASELINE

> Số đo **trước khi vá**, và số đo sau mỗi mục. Chỗ nào chưa đo được thì ghi *chưa đo được* kèm điều
> kiện để đo — không để trống, và không đoán.

## N1 · Skill tự nạp

### Trước (đo 30/10/2026, bước 1a)

| Số đo | Giá trị |
|---|---|
| Skill gốc ở `.agent/skills/**` | **28** |
| `.claude/skills/` | **chưa tồn tại** |
| Hook `SessionStart` bơm mỗi phiên | **2.178 ký tự ≈ 681 token** |
| — riêng dòng liệt kê tên skill | **741 ký tự ≈ 232 token** |
| `package.json` version | `2.9.4` (lệch — xem N6) |

Dòng 232 token kia chỉ cho agent **tên** skill, không cho mô tả. Agent muốn biết "dùng khi nào" vẫn phải
mở `.agent/skills/INDEX.md`.

### Sau bước 1a

| Số đo | Giá trị |
|---|---|
| Shim sinh ra | **28** · `.claude/skills/<tên>/SKILL.md` |
| Thân mỗi shim | **≤ 5 dòng** (con trỏ về bản gốc, không chép nội dung) |
| `skills:index:check` | CHẶN khi shim **thiếu · lệch · thừa** — đối chứng cả ba chiều |
| `.gitignore` | thêm ngoại lệ `!.claude/skills/` kèm lý do |
| Hook | **chưa đổi** — cố ý, xem dưới |

Hook giữ nguyên ở bước 1a vì chưa biết harness có nạp shim hay không. Gỡ trước rồi hoá ra không nạp thì
kit mất cả hai đường.

### Bước 1b — phiên mới (CHƯA CHẠY)

> Mục này chỉ điền được ở **một phiên khởi động SAU khi shim đã có trên đĩa**. Phiên hiện tại khởi động
> trước đó, nên danh sách skill của nó không nói gì về shim.

| Số đo | Giá trị |
|---|---|
| Harness liệt kê bao nhiêu skill ở phiên mới | *chưa đo được — cần phiên mới* |
| Có đủ 28 shim không | *chưa đo được* |
| Token phần nạp mỗi phiên, sau khi gỡ danh sách khỏi hook | *chưa đo được* |

Hai nhánh kết luận đã định trước, để lượt đo không bị diễn giải sau:

- **Thấy đủ 28** ⇒ gỡ danh sách tên khỏi `inject_context.js` (tiết kiệm ~232 token/phiên), đo lại ngân
  sách, và chỉ giữ một đường.
- **Không thấy** ⇒ xoá shim, giữ hook, ghi *"đã đo: harness không nạp `.claude/skills/` ở dự án này"*.
  Kết luận đó **có số đo**, khác hẳn *"chưa đo được"*.

## N8 · Subagent — cũng chờ phiên mới

| Số đo | Giá trị |
|---|---|
| Định nghĩa ở `.claude/agents/` | **3** (`case-debugger` · `excel-convert` · `test-runner`) |
| Harness liệt kê ở phiên mới | *chưa đo được — cần phiên mới* |

Đã đo **hai lần, hai phiên khác nhau** (28/10 và 29/10): cả hai lần harness chỉ liệt kê **2/3** —
`case-debugger` vắng mặt. Đã loại ba giả thuyết: cả ba file **đều được git track**, `case-debugger.md`
vào repo từ **10–11/10** nên không phải "thêm giữa phiên", và frontmatter hợp lệ theo chính cửa của kit.

Khác biệt cấu trúc duy nhất là thiếu trường `model:`. Nhưng theo tài liệu Claude Code trường đó là
**tuỳ chọn**, nên đây vẫn là **tương quan, chưa phải nhân quả** — và `case-debugger` cố ý không ghim
model rẻ vì nó làm việc cần suy luận. Chỉ thêm `model:` nếu đã thử ở một phiên mới và thấy có tác dụng.

## Các mục khác

*(điền khi làm tới — N2 · N3 · N4 · N5 · N6 · N7)*
