---
description: Cửa vào cho người mới — hỏi đúng 5 điều, tạo profile task, chạy preflight, rồi chỉ lệnh kế tiếp. Dùng khi bắt đầu task mới, chưa có profile.
---

Task: **$ARGUMENTS**

Kit có 178 gate và 28 skill. Người mới cần **5 điều**. Hỏi đủ 5 câu dưới, **gom thành MỘT lần hỏi**, rồi
làm ba bước. Đừng hỏi lắt nhắt.

> **Phạm vi: CHỈ tạo profile và task.** Không đọc đặc tả, không neo mẫu số, không sinh case, không execute.

| # | Hỏi gì | Thiếu nó thì sao |
|---|---|---|
| 1 | `TASK_KEY` | Một trong **đúng hai** biến code chặn khi thiếu |
| 2 | `PROJECT_OUTPUT_DIR` | Biến bắt buộc thứ hai; output vào `<đây>/tasks/<TASK_KEY>/` |
| 3 | Phase 1 hay Phase 2? | **Không trộn hai phase trong một lượt chạy** |
| 4 | Đặc tả ở đâu | Mẫu số coverage neo vào đây; `/start` chỉ HỎI chỗ |
| 5 | Mấy tài khoản, có captcha? | Captcha ⇒ CI **KHÔNG tự đăng nhập được**; một tài khoản ⇒ `NEEDS_ACCOUNT` **không phải FAIL** |

Vì sao không đoán được: [docs/rationale/start-pham-vi.md](../../docs/rationale/start-pham-vi.md).

## Rồi làm ba bước

```bash
npm run profile:create -- <TASK_KEY> --project-output <PROJECT_OUTPUT_DIR>
TASK_KEY=<TASK_KEY> PROJECT_OUTPUT_DIR=<PROJECT_OUTPUT_DIR> npm run preflight -- --mode generic --task <TASK_KEY>
```

Giữa hai lệnh: điền giá trị động vào `profiles/<TASK_KEY>/task.env`. Hook chặn agent đọc file đó — liệt kê cho người dùng tự điền. **Không** sửa `.env` chung, không đọc `TASK_KEY` từ đó.

Bước ba: ghi 5 câu trả lời vào `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md`, kèm dòng
`Trạng thái: chờ người dùng gọi phase`.

## Báo lệnh kế tiếp rồi DỪNG

In cho người dùng, **không** phải để agent chạy:

| Phase | Người dùng gõ tiếp |
|---|---|
| Phase 1 | `/phase2 <TASK_KEY>` — bước đầu của nó là `scope:anchor:init` |
| Phase 2 | `/preflight` với `--mode phase3` → `/phase3 <TASK_KEY>` |

## Dừng khi

- **Thiếu câu trả lời cho bất kỳ câu nào trong 5.** Đừng đoán, đừng lấy giá trị của task khác.
- **`preflight` exit ≠ 0.** Sửa theo từng dòng CHẶN. KHÔNG bỏ bước preflight để đi tiếp: bỏ nó
  thì lỗi lộ ra giữa lượt execute dưới dạng "FAIL" trông như bug.
- **Profile đã tồn tại.** `profile:create` không ghi đè — dùng cái đang có, hoặc `--force` nếu chắc.
- **Đã xong ba bước.** In bảng trên và các giá trị cần tự điền, rồi dừng phiên.
  **KHÔNG tự gọi `/phase2` hay `/phase3`**, kể cả khi người dùng nhắn "tiếp" — "tiếp" ở đây là làm
  nốt bước còn lại của `/start`.
