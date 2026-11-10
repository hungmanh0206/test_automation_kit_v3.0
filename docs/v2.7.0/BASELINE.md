# v2.7.0 — Mốc ma sát và token, đo TRƯỚC khi đổi gì

> Đo ngày 11/10/2026, trên commit `ff6dc7c`. Mọi con số dưới đây **đo được bằng máy và lặp lại được**.
> Chỗ nào không đo được thì ghi `chưa đo được` kèm điều kiện để đo — không có ô nào bỏ trống, và không có
> ô nào điền bằng ước lượng.

Mục đích của trang này là để câu "đã giảm ma sát" về sau có thể **kiểm được**. Không có mốc thì mọi
tuyên bố giảm chỉ là cảm giác, và cảm giác thì không ai bác được cũng không ai xác nhận được.

## 1. Kit hiện có bao nhiêu máy, chặn ở đâu

| Số | Giá trị | Nguồn |
|---|---|---|
| Máy gác | **98** | `gates:index` (97 trong `GATES.md`) cộng `gate:audit` tính thêm một máy đăng ký ở `playwright.config.js` |
| Trong đó CHẶN | **69** | suy từ code: có đường `exit 1` |
| SINH (ghi artifact) | **18** | suy từ code |
| BÁO CÁO (chỉ in) | **11** | suy từ code |
| npm script | **151** | `package.json` |

Prompt v2.7.0 mở đầu bằng "khoảng 86 máy kiểm (khoảng 56 cái CHẶN) và hơn 110 npm script". Số thật lúc
này là **98 · 69 · 151**. Ghi lại chênh lệch này vì phần "giảm bao nhiêu" về sau phải trừ từ số đúng.

## 2. Phân tầng đề xuất

| Tầng | Số máy | Nghĩa |
|---|---|---|
| T0 | **12** | không thương lượng, chặn ở mọi ngữ cảnh |
| T1 | **57** | chặn ở cửa ra, cảnh báo lúc đang làm |
| T2 | **29** | không bao giờ chặn |

Cả 6 non-negotiables đều có ít nhất một gate T0 thi hành (§B.4):

| Non-negotiable | Gate T0 |
|---|---|
| §1 Bảo mật tuyệt đối | `secret:scan` · `package:kit` |
| §2 UAT non-destructive + DB read-only | `ci:scope` · `discover` |
| §3 Verify thật trước khi kết luận | `bug:claim` · `ledger:check` · `run:analysis` · `unit:stamp` · `canonical:drift` |
| §4 Evidence bắt buộc | `gate:output` |
| §5 Scope & isolation | `preflight` |
| §6 Không gian lận để PASS | `auto:review` |

**§6 chỉ có MỘT máy.** `auto:review` là máy duy nhất trong kit gác "nới hoặc xoá assertion, đổi expected
để case xanh". Hạ nó xuống T1 là để §6 không còn gì thi hành ở lúc đang làm, nên nó phải ở T0.

**Hai gate T0 chưa có cặp đối chứng** (§A10.3 đòi fixture lỗi phải đỏ VÀ fixture sạch phải xanh):
`ledger:check` và `unit:stamp` không có spec nào nhắc tới chúng với cả hai chiều. Một gate T0 mà không
có phép đối chứng là một gate không ai biết nó còn hoạt động hay không.

## 3. Người dùng phải nhớ bao nhiêu

| Số | Giá trị | Nguồn |
|---|---|---|
| Slash command | **12** | `.claude/commands/*.md` |
| Lệnh npm khác nhau mà các điểm vào bảo chạy | **55** | quét `npm run …` trong `.claude/commands/` và `run_phase*` |
| Lệnh npm nhiều nhất trong MỘT command | **5** | `phase1` · `phase2` · `rerun` |
| Lệnh gate mà cả chuỗi Phase 2 bảo chạy | **43** | điểm vào cộng prompt con cộng workflow |
| Lệnh gate mà cả chuỗi Phase 1 bảo chạy | **30** | như trên |
| Dòng trong bảng "Gate bắt buộc" của Phase 2 | **19** | `01_run_phase3.md` |

Đích của v2.7.0 là **5 lệnh**. Khoảng cách thật không phải từ 12 xuống 5 — mà là từ **55 lệnh rải khắp
chuỗi** xuống 5, vì đó là con số người dùng thực sự gặp khi đi hết một task.

### Đo lại sau §A7

| Số | Trước | Sau |
|---|---|---|
| Slash command người dùng phải NHỚ | 12 | **5, cộng `/check`** |
| Lệnh npm nằm trong bộ lệnh đó | — | **17** |
| Lệnh npm rải khắp mọi điểm vào | 55 | 60 |

**Tổng số lệnh TĂNG, và đó là con số đúng để ghi lại.** Không lệnh nào bị xoá — chúng vẫn cần thiết, và
đợt này còn thêm `exit:gate`, `lane`, `next`, `check`. Thứ giảm là số lệnh người dùng phải NHỚ: sáu lệnh
ngoài nhóm năm được gợi ý đúng lúc ở dòng "Lệnh tiếp theo" trong output của `/check`, suy từ trạng thái
artifact có thật.

Nói "đã giảm từ 55 xuống 5" là nói sai. Phép đo đúng là: **5 lệnh phải nhớ, 6 lệnh được chỉ đường, 0
lệnh bị bỏ.**

## 4. Token

| Luồng | Phần nạp bắt buộc | Ngưỡng | Mốc |
|---|---|---|---|
| `/2_phase1` | 28.073 | 31.000 | 28.074 |
| `/3_phase2` | 28.894 | 32.000 | 29.006 |
| `/4_publish` | 6.559 | 9.000 | 6.561 |
| `/rerun` | 9.223 | 12.000 | 9.240 |
| `/1_start` | 4.573 | 5.000 | 4.575 |

Nguồn: `npm run prompt:budget -- --enforce`. Cả 5 luồng đang **dưới mốc** sau lượt đổi nguồn canonical,
vì phần lý do được dồn về `RULE_GLOBAL` thay vì lặp ở 8 bề mặt.

## 5. Byte output mà agent phải đọc

Dàn gate mức repo, chạy một lượt đầy đủ:

| Lệnh | Byte |
|---|---|
| `lint` | 8.827 |
| `library:drift` | 3.011 |
| `prompt:budget` | 1.860 |
| `skills:lint` | 868 |
| `deps:check` | 629 |
| `gates:index:check` | 601 |
| `gate:policy` | 511 |
| `version:check` | 181 |
| `json:check` | 63 |
| `typecheck` | 0 |
| **Tổng** | **16.551 byte ≈ 4.137 token** |

Đây là **mỗi lượt chạy dàn gate**, và nó chưa gồm gate mức task (những máy cần `TASK_KEY`). `lint` một
mình chiếm 53% — 60 cảnh báo, 0 lỗi, in ra toàn bộ mỗi lần. Đó là ứng viên rõ nhất cho việc in gọn ở §A3.

## 6. Chưa đo được, và điều kiện để đo

| Thứ | Vì sao chưa đo được | Cần gì để đo |
|---|---|---|
| Số lần mỗi gate đã CHẶN | Không nguồn nào trong repo ghi lại. Transcript không được track; thư mục `reports` của task ghi kết quả task, không ghi lượt bị gate chặn | Ghi sổ ở `gate_engine` (§A9: `knowledge/metrics/gate-friction.jsonl`) rồi dùng vài sprint |
| Số lần mỗi gate BÁO OAN | Như trên. Con số duy nhất lấy được là "gate X được nhắc trong N đoạn CHANGELOG nói về báo oan", và đó là số lần được NHẮC, không phải số lần báo oan | Như trên. Quy tắc dọn §A9 (báo oan > 20% trong ≥ 10 lần chặn) **không** đo được bằng nguồn hiện có |
| Gate nào bắt TRÙNG gate nào | §1a khai cách đo là mutant của `mutation_check`. Đọc source: máy đó tiêm lỗi vào response ở tầng `page.route()`, cần session UAT thật và `ui_catalog.json`, và nó đo bộ **assertion trong testcase** chứ không chạy gate nào | Bộ fixture cặp đối chứng (§A10.3) cộng bộ dữ liệu vàng (§A10.4). Có chúng rồi thì "hai gate cùng đỏ trên cùng một fixture lỗi" là phép đo thật, offline |
| Số lượt shell và thời gian chờ người trong một task thật | Cần một lượt task có ghi lại từng lượt gọi. Số ở mục 3 là số lệnh mà prompt BẢO chạy, tức giới hạn trên của ý định, không phải số lượt đã chạy thật | Một lượt task chạy với sổ ma sát đã bật |

## 7. Hai lần tôi suy sai, ghi lại để không ai thử lại

Việc xếp tầng 98 máy từng được thử bằng **suy từ từ khoá**, hai lần, và cả hai đều không dùng được:

1. **Suy từ MỘT DÒNG mô tả** — 66/98 máy ra "không dấu hiệu nào khớp", tức phép suy gần như không nói
   gì. Và nó xếp `prompt:budget` vào T0 "lộ secret", vì chữ *token* trong mô tả nó nghĩa là token của
   prompt.
2. **Suy từ CẢ KHỐI HEADER** — T0 phình lên **40 máy**: `ci:scope` và `auto:review` bị gán "lộ secret",
   `decisions:check` bị gán "lộ PII". Header dài 60 dòng nhắc những chữ đó **trong khi giải thích**, nên
   khớp ở đâu cũng khớp.

Một bảng phân tầng sai 40% sẽ được dùng để quyết định hạ tầng một gate, tức nó biến thành một lỗ thật
trong bộ kiểm. Nên T0 nay là **danh sách khai tay** trong `.agent/config/gate_tiers.json`, và từ khoá hạ
xuống làm **cột gợi ý**: `gate:audit` in 29 ứng viên T0 mà danh sách khai tay không có, để rà xem có bỏ
sót cái nào — phần lớn trong đó là dương tính giả, và đó chính là lý do nó không được quyết định tầng.
