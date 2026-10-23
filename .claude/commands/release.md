---
description: Cửa cuối — chuyển Done hoặc phát hành. Chạy cửa ra `done`, rồi khuyến nghị go/no-go có căn cứ. Dùng khi đã execute xong và sổ nợ đã sạch.
---

Task: **$ARGUMENTS**

Thiếu mã task → `npm run task:which -- $ARGUMENTS`; thoát 2 = KHÔNG PHÁN ĐƯỢC, nó in danh sách profile để chọn. **Đừng suy từ hội thoại cũ** (CLAUDE.md §5).

```bash
npm run exit:gate -- --cua done --task $ARGUMENTS
npm run release:summary -- --task $ARGUMENTS
```

## Hai bước, hai việc khác nhau

**`exit:gate --cua done`** là CỬA: nó chặn. Nó đòi sổ nợ `reports/gate-debt.json` sạch, rồi chạy
`self-review:enforce` · `run:analysis` · `unit:stamp` · `expected:check`. Mọi vi phạm T1 đã hoãn từ lúc
đang làm quay lại ở đây — đó là lý do §A1 được phép hoãn chúng.

**`release:summary`** là KHUYẾN NGHỊ: nó không chặn và không tự quyết. Nó chấm tiêu chí đo được rồi nói
go hay no-go, kèm căn cứ. Tiêu chí nào không đo được thì nó ghi "không đo được" — **không** quy về đạt.

## Đọc kết quả

Cửa ra có **ba** trạng thái, không hai:

| | nghĩa |
|---|---|
| `✓` | đạt |
| `✗` | chặn — sửa rồi chạy lại cửa |
| `○` | **không phán được** (exit 2) — không chặn, nhưng cũng KHÔNG chứng minh được gì |

`○` phải vào báo cáo cửa ra. Đọc nó thành `✓` là cho một thứ chưa ai kiểm đi qua cửa cuối.

## Dừng khi

- **Sổ nợ còn món.** Trả nợ là sửa vi phạm rồi chạy lại gate, **không** phải xoá file sổ. Xoá sổ để qua
  cửa là đúng thứ sổ này gác.
- **`release:summary` nói no-go.** Nó có căn cứ; đọc căn cứ rồi sửa, đừng chạy lại để đổi số.
- **Còn `○` ở một máy T0.** Một máy không-thương-lượng mà không phán được thì chưa đủ cơ sở chuyển Done.

Lệnh tiếp theo sau khi qua cửa: `npm run next -- --task $ARGUMENTS`.
