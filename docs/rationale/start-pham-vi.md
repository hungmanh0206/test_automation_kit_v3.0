# `/start` — phạm vi, và vì sao từng câu phải hỏi TRƯỚC

Phần "vì sao" của [`.claude/commands/start.md`](../../.claude/commands/start.md) để ở đây, không để trong
lệnh. Lý do là một con số: thân lệnh nằm trong phần **bắt buộc nạp** của luồng `start`, nên mỗi câu giải
thích viết trong đó làm **mọi lượt** `/start` đắt hơn — kể cả lượt của người đã biết. `prompt:budget` gác
đúng chuyện này và chính nó chặn bản trước của file này (xem `.agent/config/prompt_budget.json`, mục `moc`).

## Phạm vi: `/start` CHỈ tạo profile và task

`/start` hỏi 5 câu, chạy `profile:create` + `preflight`, ghi `task.md`, in lệnh kế tiếp, rồi **dừng**.

**Đã trả giá thật — CSDL-4172, 05/11/2026.** Người dùng chạy `/start`, rồi nhắn một chữ **"tiếp"**. Agent
hiểu "tiếp" là "chuyển sang phase", tự gọi `/phase2` và đi tới **sinh ~90 case** — trong khi người dùng chỉ
định làm nốt bước còn lại của `/start`. Không ai yêu cầu bộ case đó.

Nên luật viết theo hướng ngược lại: `"tiếp"` sau `/start` nghĩa là **làm nốt bước còn lại của `/start`**, và
phase chỉ bắt đầu khi người dùng **tự gõ** lệnh của phase đó. Cùng lý do, `load_map.json` khai hai prompt
template của phase là `co_dieu_kien` kèm chữ *"KHÔNG nạp trong /start"* — và `start-command.spec.ts` gác
câu đó.

## Vì sao từng câu phải hỏi TRƯỚC

| # | Hỏi gì | Vì sao không thể đoán |
|---|---|---|
| 1 | `TASK_KEY` | Một trong **đúng hai** biến mà code thật sự chặn khi thiếu. Suy từ hội thoại cũ là nguồn lỗi: output của task này rơi vào thư mục của task khác, và lượt chạy vẫn XANH. Hai lượt chạy song song cùng key thì bắt buộc thêm `RUN_ID`, nếu không lượt sau đè verdict của lượt trước |
| 2 | `PROJECT_OUTPUT_DIR` | Biến bắt buộc thứ hai. Mọi output đi vào `<đây>/tasks/<TASK_KEY>/`; đặt sai thì các cửa đọc thư mục task đều báo "không thấy testcase" |
| 3 | Phase 1 hay Phase 2 | Phase 1 sinh/sửa testcase, Phase 2 execute bộ đã có. Trộn trong một lượt thì bộ case bị sửa **giữa** lúc đang chấm, và verdict không còn thuộc về bản nào |
| 4 | Đặc tả ở đâu | Mẫu số coverage neo vào nguồn này. Không có nguồn thì mọi tỉ lệ về sau là tỉ lệ trên **danh mục agent tự đặt**, và "đủ" chỉ còn nghĩa "tôi thấy đủ" |
| 5 | Mấy tài khoản test, login có captcha | Captcha ⇒ CI không người trông **KHÔNG tự đăng nhập được**, phải nạp sẵn session. Chỉ một tài khoản ⇒ case phân quyền/IDOR ra `NEEDS_ACCOUNT`, **không phải FAIL** — chấm chúng là FAIL là báo bug sản phẩm cho một thiếu hụt của bộ đo |

## Vì sao ba điều kiện dừng kia

- **Profile dùng chung giữa hai task** là nguồn lỗi *"đăng nhập nhầm đơn vị"* — rất khó tìm, vì lượt chạy
  vẫn xanh, chỉ là xanh trên đơn vị sai. Mỗi `profiles/<TASK>/task.env` phải tự ghim đủ đơn vị và cấp học
  (xem `CLAUDE.md` mục 5).
- **Bỏ bước `preflight`** thì lỗi thiếu input và config hỏng không lộ ra ở cửa vào; nó lộ ra giữa lượt
  execute dưới dạng một "FAIL" **trông như bug sản phẩm**.
- **`profile:create` không ghi đè** là cố ý: ghi đè một profile đang dùng làm lượt chạy đang chạy đổi đơn vị
  giữa đường.
