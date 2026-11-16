---
description: Cửa cuối — chuyển Done hoặc phát hành. Chạy cửa ra `done`, rồi khuyến nghị go/no-go có căn cứ. Dùng khi đã execute xong và sổ nợ đã sạch.
---

Task: **$ARGUMENTS**

Thiếu mã task → `npm run task:which -- $ARGUMENTS`; thoát 2 = KHÔNG PHÁN ĐƯỢC, nó in danh sách profile để chọn. **Đừng suy từ hội thoại cũ** (CLAUDE.md §5).

```bash
npm run exit:gate -- --cua done --task $ARGUMENTS
npm run release:summary -- --task $ARGUMENTS; npm run risks -- --task $ARGUMENTS
npm run bug:outcome:backlog
npm run bug:tac-gia -- --quet
npm run agent:scorecard -- --task $ARGUMENTS
npm run pass:audit -- --task $ARGUMENTS
```

## Hai bước, hai việc khác nhau

**`exit:gate --cua done`** là CỬA: nó chặn. Nó đòi sổ nợ `reports/gate-debt.json` sạch, rồi chạy
`self-review:enforce` · `run:analysis` · `unit:stamp` · `expected:check`. Mọi vi phạm T1 đã hoãn từ lúc
đang làm quay lại ở đây — đó là lý do §A1 được phép hoãn chúng.

**`agent:scorecard`** ghi số VẬN HÀNH của task: giờ làm việc, câu hỏi chặn QA, tỉ lệ tự khắc phục, tỉ lệ
claim bị bác, token trên mỗi verdict xác minh. Nó không chặn. Chỉ số nào thiếu nguồn thì ghi KHÔNG PHÁN ĐƯỢC.
`bug:outcome:backlog` CHỈ ĐỌC Backlog, cập nhật sổ DEV nhận hay bác từng bug; Resolved/Closed thì gắn tay bằng `--nhan`
kèm lời DEV. `bug:tac-gia` tách tỉ lệ đó theo ai tạo bug: agent, người chạy script, hay KHÔNG RÕ (không phải "người").

**`pass:audit`** đo tỉ lệ PASS SAI, phía sổ bug không thấy. Bốc mẫu bằng `--chon 20`, đưa phiếu cho NGƯỜI chấm
(agent không tự chấm), rồi `--ghi <phiếu>`. Chưa chấm mẫu nào thì in KHÔNG PHÁN ĐƯỢC, không phải "PASS đều đúng".

**`release:summary`** là KHUYẾN NGHỊ: nó không chặn và không tự quyết. Nó chấm tiêu chí đo được rồi nói
go hay no-go, kèm căn cứ. Tiêu chí nào không đo được thì nó ghi "không đo được" — **không** quy về đạt. `risks` đặt rủi ro dự án còn mở (người chịu, hạn, quá hạn) ngay cạnh khuyến nghị đó.

## Đọc kết quả

Cửa ra có **ba** trạng thái, không hai:

| | nghĩa |
|---|---|
| `✓` | đạt |
| `✗` | chặn — sửa rồi chạy lại cửa |
| `○` | **không phán được** (exit 2) — không chặn, nhưng cũng KHÔNG chứng minh được gì |

`○` phải vào báo cáo cửa ra. Đọc nó thành `✓` là cho một thứ chưa ai kiểm đi qua cửa cuối.

Nhận lại lượt chạy của người khác, hoặc không chắc số trong báo cáo đến từ đâu, thì mở skill
[`run_report_reader`](../../.agent/skills/shared/run_report_reader/SKILL.md) trước khi kết luận go/no-go
— nó nói artifact nào trả lời được câu gì, và câu nào **không** artifact nào trả lời được.

## Dừng khi

- **Sổ nợ còn món.** Trả nợ là sửa vi phạm rồi chạy lại gate, **không** phải xoá file sổ. Xoá sổ để qua
  cửa là đúng thứ sổ này gác.
- **`release:summary` nói no-go.** Nó có căn cứ; đọc căn cứ rồi sửa, đừng chạy lại để đổi số.
- **Còn `○` ở một máy T0.** Một máy không-thương-lượng mà không phán được thì chưa đủ cơ sở chuyển Done.

Lệnh tiếp theo sau khi qua cửa: `npm run next -- --task $ARGUMENTS`.
