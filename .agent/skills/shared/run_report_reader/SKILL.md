---
name: run_report_reader
description: Đọc kết quả một lượt chạy theo đúng thứ tự và đúng nguồn — artifact nào trả lời được câu gì, và câu nào KHÔNG artifact nào trả lời được. Mở khi vừa chạy xong và cần hiểu lượt đó nói gì, hoặc khi nhận lại một lượt chạy của người khác. KHÔNG chấm verdict, KHÔNG sửa spec, KHÔNG viết bug.
---

# Run Report Reader

## Ranh giới

| | |
|---|---|
| **Dùng khi** | vừa chạy xong một lượt và cần hiểu nó nói gì · nhận lại lượt chạy của người khác · sắp viết báo cáo hoặc quyết go/no-go |
| **KHÔNG dùng khi** | cần CHẤM verdict (→ `.agent/config/verdict_taxonomy.json`) · cần GỠ một case đỏ (→ agent `case-debugger`) · cần viết bug (→ `backlog_bug_reporter`) |

## Đọc theo thứ tự này, và dừng ngay khi đã đủ

Một lượt chạy để lại hàng trăm tệp. Đọc sai thứ tự thì tốn token cho thứ không trả lời được câu đang hỏi.

| # | Đọc | Trả lời được | KHÔNG trả lời được |
|---|---|---|---|
| 1 | `npm run results:summary` | case nào đỏ · TC ID · lỗi rút gọn · đường dẫn ảnh | vì sao đỏ |
| 2 | `npm run run:analysis` | lượt này có ĐỦ MẪU SỐ để phán chưa (dải `BLOCKED`, nợ `SKIP`) | từng case |
| 3 | `reports/execution-summary.md` | bức tranh lượt chạy do người viết | thứ người viết không nhìn thấy |
| 4 | **ẢNH** ở `test-results/artifacts/` hoặc `evidence/<TC_ID>/` | app THẬT sự hiện gì ở bước quyết định | giá trị đã LƯU |
| 5 | `npm run trace:matrix:pm` | module nào đang hổng, chỗ hổng to nhất ở đâu | thứ bộ case chưa viết |
| 6 | `npm run data:chain` | verdict nào đứng trên một tiền đề chưa dựng | phụ thuộc chưa được khai |

**CẤM đọc `results.json` thô.** Nó dài, và `results:summary` đã bóc mã màu ANSI cùng phần lặp. Đọc thô
là đổ rác điều khiển terminal vào context rồi vẫn phải đọc lại bản tóm tắt.

## Bốn câu hỏi mà artifact nói NGƯỢC nhau — đọc đúng nguồn

1. **"Có bao nhiêu case đỏ?"** → `results:summary`, không phải Excel. Excel chỉ có **lô mới nhất**; case
   `carriedOver` bị merge loại ra, và một task thật đã mất 166/199 verdict vì chuyện này.
2. **"Case này PASS hay FAIL?"** → `testcase-status.json` của lượt MỚI NHẤT. `OBSERVATION` **không đè**
   verdict cũ, và `did not run` **giữ** verdict trước đó — gộp theo "mới nhất thắng" đã suýt nuốt 2 FAIL thật.
3. **"Lượt này đạt chưa?"** → `run:analysis` TRƯỚC khi xem tỉ lệ pass. Dải `BLOCKED` vượt ngưỡng nghĩa là
   **chưa đủ để phán**, không phải "lượt chạy sai". Đo thật: 4/11 lượt của repo vượt 20%.
4. **"App sai hay phép đo sai?"** → **ẢNH trước, code sau.** Đây là chỗ sai nhiều nhất: một bộ đo lệch
   sinh ra `product_bug` giả, và đã có phiên 7 lần liên tiếp như vậy. Nhìn ảnh bước quyết định trước khi
   gán tầng `product_bug`.

## Ba con số dễ đọc sai nhất

- **`0%` lỗi trên `0` request là KHÔNG BIẾT**, không phải đạt. Áp cho cả perf, load và mọi phép đếm.
- **Ô trống trong biểu/lưới**: ở nhiều màn nó nghĩa là `0`, không phải "không đọc được". Đọc thành
  "không đọc được" sinh `FAILED`/`product_bug` giả.
- **`%` coverage**: mẫu số là số TC **đã viết**, không phải số thứ cần kiểm. Bộ case thiếu một vùng thì
  vùng đó không có dòng nào, và `100%` vẫn không nói gì về nó — mẫu số thật neo ở
  `requirements/scope_inventory.md`.

## Máy kiểm

| Máy | Gác gì | Mức |
|---|---|---|
| `npm run results:summary` | tóm tắt có trần, nhưng KHÔNG mất case đỏ | báo cáo |
| `npm run run:analysis:enforce` | dải `BLOCKED` vượt dải trên ⇒ chưa đủ mẫu số để phán | CHẶN |
| `npm run ledger:check` | đối soát Excel ↔ file status, bắt verdict mất âm thầm | CHẶN |
| `npm run trace:matrix:pm` | bản gộp theo module — chỗ hổng to nhất lên dòng đầu | SINH |
| `npm run data:chain:check` | verdict đứng trên tiền đề chưa dựng | CHẶN |

> **KHÔNG có máy kiểm cho chuyện này**: "bản `execution-summary.md` có kể đúng lượt chạy không". Nó do
> người viết, và máy không đối chiếu được lời kể với artifact. Đọc nó SAU bước 1–2, để còn biết nó có bỏ
> sót gì.

## Anti-Patterns

- Đọc `results.json` thô rồi tự đếm.
- Lấy tỉ lệ pass làm kết luận trước khi xem `run:analysis`.
- Đọc Excel để biết tổng số case đỏ (Excel chỉ có lô mới nhất).
- Gán `product_bug` trước khi nhìn ảnh.
- Đọc `%` coverage như độ phủ thật mà không neo mẫu số.

**Câu kích hoạt mẫu:** "lượt chạy vừa rồi nói gì" · "đọc hộ kết quả execute" · "nhận lại lượt chạy của người khác thì xem gì trước" · "artifact nào cho biết case nào đỏ" · "tỉ lệ pass này có đáng tin không"
