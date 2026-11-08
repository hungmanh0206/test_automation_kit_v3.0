# skills:practice — bài `bug-than-backlog` dưới bộ chấm 6 phép kiểm

Chỉ bài này được đo lại: bộ chấm của bốn bài kia **không đổi**, nên số của chúng ở
[`docs/v2.10.1/PRACTICE.md`](../v2.10.1/PRACTICE.md) vẫn còn giá trị.

## Log của máy, dán NGUYÊN VĂN

```
[practice] bug-than-backlog lượt 1/3 · 71s · 6+4833 token · $0.3737 · ĐẠT — 6/6 phép kiểm (ngưỡng 5)
[practice] bug-than-backlog lượt 2/3 · 67s · 10+4573 token · $0.3714 · ĐẠT — 6/6 phép kiểm (ngưỡng 5)
[practice] bug-than-backlog lượt 3/3 · 60s · 6+4358 token · $0.3362 · ĐẠT — 6/6 phép kiểm (ngưỡng 5)
[practice] model 2.1.285 (Claude Code) · 3 lượt · 198s · 13786 token · $1.0813
[practice] bug-than-backlog (backlog_bug_reporter): 3/3 lượt đạt ⇒ ĐẠT
[practice] ✓ ĐẠT
```

## Dãy trước/sau — phân tích CỦA TÔI, không phải log máy

Phát lại **chính các hàm đang chạy** trong cửa (không chép lại — bản đầu của phép phát lại có bản chép
nên nó đo bản chép) trên các câu trả lời đã lưu. Model không đổi; chỉ **skill** và **bộ chấm** đổi.

| Lượt đã lưu | Skill lúc đó dạy gì | Với bộ chấm 6 phép kiểm |
|---|---|---|
| lô 2 | chưa dạy nháy ngược · chưa dạy giới hạn | 4/6 · 3/6 · 3/6 — trượt **C3 + C6** |
| lô cuối v2.10.1 | **đã** dạy nháy ngược · chưa dạy giới hạn | 5/6 · 5/6 · 5/6 — chỉ trượt **C6** |
| lô sau khi thêm bảng giới hạn | dạy **cả hai** | **6/6 · 6/6** · 3/6 ⇒ 2/3 ĐẠT |
| lô chính thức (log trên) | dạy **cả hai**, bộ chấm đã vá xong | **6/6 · 6/6 · 6/6** ⇒ 3/3 ĐẠT |

Hai bản vá **skill** đều có hiệu lực đo được:

- **C3** (`id` bọc nháy ngược) hết trượt sau khi thêm cặp ❌/✅ thứ 7 vào `references/sai-dung.md`
- **C6** (độ dài từng mục) hết trượt sau khi thêm bảng vào `SKILL.md` §Độ dài tối đa từng phần

## Và bộ chấm phải vá SÁU lần trước khi nói được điều đó

Mỗi lần một nguyên nhân khác, mỗi lần đều cho cùng một triệu chứng *"bài trượt"*:

| # | Lỗi của bộ chấm | Phát hiện bằng |
|---|---|---|
| 1 | *"tối đa 4 bước/3 gạch"* khai là luật repo — không có ở `RULE_GLOBAL`/`core_rules`/skill | tra nguồn |
| 2 | chặn dòng `TC:` — nó là **marker máy đọc** chống trùng | đọc `bug_reporter.js:719` |
| 3 | chấm **cả câu trả lời** thay vì chấm sản phẩm | đọc câu trả lời thật |
| 4 | bộ tách mục vớ **dòng thụt lề** thành mục thứ 5 | soi đầu vào của cửa thật |
| 5 | bộ tách không hiểu **nhãn gộp dòng** `Tiền điều kiện: <nội dung>` | soi lại sau khi skill dạy "1 câu" |
| 6 | C5 đòi `3/3` trong thân bug — **số lượt đo lại thuộc claim** | đọc lại yêu cầu của chủ dự án |

Lỗi 5 đáng kể riêng: **chính nhát vá làm skill dạy đúng lại làm bộ chấm sai.** Skill dạy "Tiền điều kiện
tối đa 1 câu" ⇒ model gộp nhãn và nội dung một dòng ⇒ bộ tách bỏ qua ⇒ cửa thật phán "có 3 phần" cho một
thân bug có đủ 4. Hai thứ phải sửa cùng nhau.

## Giới hạn của bản ghi này

- Bốn bài kia **không** được đo lại trong cùng lượt với bài này. Bộ chấm của chúng không đổi, nên số ở
  `v2.10.1/PRACTICE.md` vẫn đúng — nhưng đây **không** phải một lô liền mạch. Muốn liền mạch thì chạy lại
  cả 5 bài, tốn thêm ~$6.
- Phần **tách tiêu đề mục** vẫn là xấp xỉ của tôi, và nó đã sai **hai** lần. Cửa thật `lintBugHeadings`
  chỉ đúng khi đầu vào đúng.
