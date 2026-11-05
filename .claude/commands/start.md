---
description: Cửa vào cho người mới — hỏi đúng 5 điều, tạo profile task, chạy preflight, rồi chỉ lệnh kế tiếp. Dùng khi bắt đầu một task mới và chưa có profile.
---

Task: **$ARGUMENTS**

Kit có 151 gate và 28 skill. Người mới không cần biết hết — cần **5 điều**. Hỏi đủ 5 câu dưới, **gom thành
MỘT lần hỏi**, rồi làm đúng các bước ở mục "Rồi làm". Đừng hỏi lắt nhắt.

> **Phạm vi của `/start`: CHỈ tạo profile và task.** Không đọc nội dung đặc tả, không kéo Backlog/vault về để
> phân tích, không neo mẫu số, không sinh testcase, không execute. Câu 4 chỉ HỎI đặc tả nằm ở đâu để ghi vào
> task — đọc nó là việc của `/phase1`. Xong các bước thì báo lệnh kế tiếp rồi **DỪNG**. **KHÔNG tự gọi
> `/phase1` hay `/phase2`**, kể cả khi người dùng nhắn "tiếp": "tiếp" ở đây nghĩa là làm nốt bước còn lại
> của `/start`. Phase chỉ bắt đầu khi người dùng tự gõ lệnh của phase đó.

| # | Hỏi gì | Vì sao phải biết TRƯỚC |
|---|---|---|
| 1 | `TASK_KEY` (vd `CSDL-9003`) | Một trong **đúng hai** biến code thật sự chặn khi thiếu. Không suy từ hội thoại cũ. Chạy song song cùng key thì bắt buộc thêm `RUN_ID` |
| 2 | `PROJECT_OUTPUT_DIR` (vd `outputs/CSDL`) | Biến bắt buộc thứ hai. Output đi vào `<đây>/tasks/<TASK_KEY>/` |
| 3 | Phase 1 hay Phase 2? | Phase 1 sinh/sửa testcase; Phase 2 execute bộ đã có. **Không trộn trong một lượt** |
| 4 | Đặc tả ở đâu (đường dẫn hoặc mã issue) | Mẫu số coverage neo vào nguồn này. Không có nguồn thì mọi tỉ lệ về sau là tỉ lệ trên danh mục agent tự đặt, và "đủ" chỉ còn nghĩa "tôi thấy đủ" |
| 5 | Có mấy tài khoản test, màn login có captcha? | Captcha ⇒ CI không người trông **KHÔNG tự đăng nhập được** (phải nạp sẵn session). Chỉ một tài khoản ⇒ case phân quyền/IDOR ra `NEEDS_ACCOUNT`, **không phải FAIL** |

## Rồi làm ba bước

```bash
npm run profile:create -- <TASK_KEY> --project-output <PROJECT_OUTPUT_DIR>
TASK_KEY=<TASK_KEY> PROJECT_OUTPUT_DIR=<PROJECT_OUTPUT_DIR> npm run preflight -- --mode generic --task <TASK_KEY>
```

Giữa hai lệnh: điền giá trị động vào `profiles/<TASK_KEY>/task.env` vừa tạo. **Không** sửa `.env` chung,
và không đọc `TASK_KEY` từ `.env` chung. Agent không đọc được `task.env` (hook chặn) — giá trị nào cần
người dùng tự điền thì liệt kê ra cho họ.

Bước ba: tạo `<PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/task.md` ghi lại 5 câu trả lời (key, output, phase, nơi
để đặc tả, tài khoản/captcha) và dòng `Trạng thái: đã tạo profile — chờ người dùng gọi phase`. Chỉ ghi
câu trả lời, không phân tích.

## Báo lệnh kế tiếp rồi DỪNG

Cột dưới là thứ để **in ra cho người dùng**, không phải để agent chạy:

| Phase | Người dùng gõ tiếp |
|---|---|
| Phase 1 | `/phase1 <TASK_KEY>` (bước đầu của nó là `npm run scope:anchor:init`) |
| Phase 2 | `/preflight` với `--mode phase2` → `/phase2 <TASK_KEY>` |

## Dừng khi

- **Thiếu câu trả lời cho bất kỳ câu nào trong 5.** Đừng đoán, và đừng lấy giá trị của task khác — profile
  dùng chung giữa hai task là nguồn lỗi "đăng nhập nhầm đơn vị", rất khó tìm.
- **`preflight` exit ≠ 0.** Đọc từng dòng CHẶN rồi sửa nguyên nhân. KHÔNG bỏ bước preflight để đi tiếp: nó
  bắt thiếu input và config hỏng, bỏ nó thì lỗi lộ ra giữa lượt execute dưới dạng "FAIL" trông như bug.
- **Profile đã tồn tại.** `profile:create` không ghi đè — dùng cái đang có, hoặc `--force` nếu chắc.
- **Đã xong ba bước.** In bảng lệnh kế tiếp và những giá trị người dùng cần tự điền vào `task.env`, rồi
  dừng phiên. Đã trả giá thật (CSDL-4172, 05/11/2026): người dùng nhắn "tiếp", agent tự gọi `/phase1` và đi
  tới sinh ~90 case trong khi người dùng chỉ định tạo profile.
