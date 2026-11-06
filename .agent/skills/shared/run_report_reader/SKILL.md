---
name: run_report_reader
description: "ĐỌC KẾT QUẢ một lượt chạy đúng thứ tự và đúng nguồn: artifact nào trả lời được câu gì, và câu nào KHÔNG artifact nào trả lời được."
---

# Run Report Reader

## Dùng khi nào

Mở khi vừa chạy xong và cần hiểu lượt đó nói gì, hoặc khi nhận lại một lượt chạy của người khác.
**KHÔNG** chấm verdict, **KHÔNG** sửa spec, **KHÔNG** viết bug.

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
| 2b | `npm run run:analysis --nhom` | chỗ nào đáng soi TRƯỚC (case đỏ gom theo tầng ‖ câu lỗi) | nguyên nhân — xem cảnh báo dưới |
| 3 | `reports/execution-summary.md` | bức tranh lượt chạy do người viết | thứ người viết không nhìn thấy |
| 4 | **ẢNH** ở `test-results/artifacts/` hoặc `evidence/<TC_ID>/` | app THẬT sự hiện gì ở bước quyết định | giá trị đã LƯU |
| 5 | `npm run trace:matrix` | module nào đang hổng, chỗ hổng to nhất ở đâu | thứ bộ case chưa viết |
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

## Tầng lỗi: đọc nó là đọc VIỆC TIẾP THEO, không phải đọc nhãn

`failureLayer` quyết định case đỏ đi đâu. Taxonomy khai **8 tầng**; cột giữa là số đo thật trên **536 ca
đỏ/chặn** của repo (30/10/2026), và nó nói nhiều hơn cái nhãn.

| Tầng | Đo được | Đi Backlog? | Việc tiếp theo |
|---|---|---|---|
| `product_bug` | **216** | CÓ — đòi bug claim + `reruns ≥ 2` | nhìn ẢNH bước quyết định TRƯỚC khi tin |
| `api_bug` | **0** | CÓ — như trên | — |
| `doc_outdated` | **39** | không | sửa đặc tả, không log bug; app đang đúng |
| `setup_failure` | **1** | không | dựng tiền đề; **không** log Backlog, **không** tính vào pass rate |
| `script_error` | **0** | không | sửa spec |
| `infra` · `flaky` · `dependency` | **0** | không | chạy lại / chờ phụ thuộc |
| *(không khai)* | **274** | — | **đúng luật**: cả 274 đều là `BLOCKED`/`BLOCKED_SETUP`, vốn không cần tầng |

**Ba chỗ bảng này nói điều mà cái nhãn không nói:**

1. **`script_error` = 0 là con số ĐÁNG NGỜ NHẤT ở đây.** Spec có hỏng, và đã hỏng nhiều: một phiên sinh
   **7 `product_bug` giả liên tiếp** vì bộ đo lệch. Không ca nào mang tầng `script_error` nghĩa là những
   lần ấy đã được chấm thành tầng khác. Và số đo chỉ ra chấm thành gì: **216/262 = 82% ca FAIL mang
   `product_bug`**. Thấy 0 thì đừng kết luận "script không hỏng"; kết luận là **phân tầng đang dồn về
   `product_bug`** — tầng duy nhất kéo theo cửa, nên cũng là tầng đắt nhất khi chấm sai.
2. **`be`/`fe` KHÔNG phải tầng.** Taxonomy nói `product_bug` *"PHẢI ghi rõ tầng FE hay BE theo quy tắc
   beVsFe"* — FE/BE là chi tiết NẰM TRONG `product_bug`. Khai `be` làm case **tụt khỏi** cửa bug claim
   (`blockingLayers` chỉ gồm `product_bug`, `api_bug`); 3 ca thật đã lọt đúng đường đó. `output_gate` nay
   chặn mọi giá trị ngoài 8 tầng.
3. **Chỉ 2/8 tầng kéo theo cửa.** Nên hạ tầng là hạ cả yêu cầu bằng chứng — hạ `product_bug` xuống
   `script_error` để hết đỏ là gian lận, kể cả khi nghe hợp lý.

> `npm run run:analysis --nhom` gom case đỏ theo `<tầng> ‖ <câu lỗi>`. **BÁO CÁO, không phải cửa**: đo
> được nén chỉ **1,34×**, 11% ca nối được câu lỗi thật, và **6/9 nhóm mẫu gom sai**. Nhóm to KHÔNG tự
> nghĩa là một nguyên nhân — nó thường là một CÂU KHUÔN MẪU chung.

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
| `npm run trace:matrix` | bản gộp theo module — chỗ hổng to nhất lên dòng đầu | SINH |
| `npm run data:chain:check` | verdict đứng trên tiền đề chưa dựng | CHẶN |

> **KHÔNG có máy kiểm cho chuyện này**: "bản `execution-summary.md` có kể đúng lượt chạy không". Nó do
> người viết, và máy không đối chiếu được lời kể với artifact. Đọc nó SAU bước 1–2, để còn biết nó có bỏ
> sót gì.

## Outputs

| Output | Vị trí | Mẫu |
|---|---|---|
| Bảng phân loại lỗi → `failureLayer` → việc tiếp theo | tài liệu tra cứu, dùng khi đọc report chạy tay | Mẫu: `.agent/skills/shared/run_report_reader/templates/bang-phan-loai-loi.md` |

> Mỗi dòng có một ví dụ trích từ sổ thật đã khử PII. Dòng chưa gặp ca thật ghi thẳng "chưa gặp" kèm ngày — bảng điền ví dụ bịa tệ hơn bảng còn chỗ trống.
## Anti-Patterns

- Đọc `results.json` thô rồi tự đếm.
- Lấy tỉ lệ pass làm kết luận trước khi xem `run:analysis`.
- Đọc Excel để biết tổng số case đỏ (Excel chỉ có lô mới nhất).
- Gán `product_bug` trước khi nhìn ảnh.
- Đọc `%` coverage như độ phủ thật mà không neo mẫu số.

**Câu kích hoạt mẫu:** "lượt chạy vừa rồi nói gì" · "đọc hộ kết quả execute" · "nhận lại lượt chạy của người khác thì xem gì trước" · "artifact nào cho biết case nào đỏ" · "tỉ lệ pass này có đáng tin không"
