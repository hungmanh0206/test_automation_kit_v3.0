---
name: automation_reviewer
description: Chấm độ tin của một bộ spec đã viết — nó xanh vì sản phẩm đúng, hay xanh vì nó không kiểm gì. Gọi bó cửa `auto:review` rồi soi tay năm chỗ máy mù: test phụ thuộc nhau, cleanup dọn sai thứ, oracle so app với chính app, dữ liệu trùng giữa hai lượt, data của task lọt vào suite chung. Mở trước khi bàn giao, hoặc khi nghi một bộ đang xanh giả. KHÔNG sinh spec mới, KHÔNG sửa case đỏ.
---

# Automation Reviewer

## Ranh giới

| | |
|---|---|
| **Dùng khi** | sắp bàn giao một bộ automation · bộ spec xanh mà vẫn nghi · trước khi promote spec của task vào `tests/**` |
| **KHÔNG dùng khi** | cần SINH spec mới (→ `qa_automation_engineer`) · cần gỡ MỘT case đang đỏ (→ agent `case-debugger`) · chỉ cần biết case nào đỏ (→ agent `test-runner`) |

## Purpose

Trả lời một câu: **bộ spec này xanh vì sản phẩm đúng, hay xanh vì nó không kiểm gì?**

Phần máy đo được thì gọi máy, không đọc bằng mắt. Phần máy không đo được thì chấm tay — và danh sách
"máy không phán được" dưới đây là nửa quan trọng hơn, vì đó là chỗ xanh-giả sống sót.

## Chạy máy trước, đọc code sau

| Bước | Lệnh | Gác gì |
|---|---|---|
| 1 | `npm run auto:review` | 9 luật: hard-sleep · vacuous-url · vacuous-count · console-log · cred-literal · spec-page-locator · no-assert · no-assert-after-act · presence-only |
| 2 | `npm run auto:review -- --with-locator` | thêm chiều locator (gọi `lint:locator`, KHÔNG chép luật) |
| 3 | `npm run auto:review -- --include-tasks` | thêm spec theo task ở `outputs/**` — chỉ BÁO CÁO, vì đó là nợ cũ |
| 4 | `npm run auto:review:enforce` | P0 ở suite dùng chung → **exit 1** |

Đọc **exit code**, không đọc dòng tóm tắt. Bản thường luôn exit 0.

**P0 chặn · P1 cảnh báo, và mức đó do SỐ ĐO quyết, không do cảm tính.** `no-assert-after-act` là P1 vì
dương tính giả soi tay 2/5 = 40% (ngưỡng đặt trước: trên 20% thì chỉ cảnh báo). `presence-only` là P1 vì
nó đang nổ 0 lượt trên 2.873 test — giữ luật để ngày có ca đầu tiên thì nó nổ, chứ không phải vì đã đo
được nó bắt đúng ở quy mô.

## Ba dạng oracle của kit — biết đủ ba mới review được

Đọc một spec rồi kết luận "không kiểm gì" là kết luận dễ sai nhất ở đây. Kit có **ba** dạng oracle:

| Dạng | Ví dụ | Có phải oracle? |
|---|---|---|
| Playwright | `await expect(o).toHaveText('12')` | có |
| EvidenceRecorder | `c.step(page, 'nhãn', { assert: async () => sau === truoc + 1 })` | có |
| Verdict suy ra | `c.step(page, 'nhãn', { status: coChu ? 'PASSED' : 'FAILED' })` | có |
| Verdict viết cứng | `c.step(page, 'nhãn', { status: 'PASSED' })` | **KHÔNG** — đúng thứ `CLAUDE.md` §6 cấm |

Đo 29/10/2026: một detector chỉ biết `expect(` cho **4/5 dương tính giả**, cả bốn vì nó không biết API
của chính kit. Người review mắc đúng lỗi đó thì sẽ đòi sửa những spec đang kiểm đúng.

Và case khai **không tuyên verdict** — `c.finish('OBSERVATION' | 'BLOCKED_*' | 'SKIP_*')` — thì không
đòi oracle. Đó là lời khai trung thực, không phải chỗ bỏ sót.

## Máy KHÔNG phán được — chấm tay đúng năm điều này

Máy in sẵn danh sách này ở cuối mỗi lượt `auto:review`. Nó không phải lời nhắc chung: đây là năm chỗ
một bộ spec có thể xanh toàn bộ mà vẫn không chứng minh gì.

1. **Test có độc lập không** — chạy một mình và chạy cả bộ phải ra cùng kết quả. Máy không thấy được
   test này đang dựa vào state test khác để lại.
2. **Cleanup có dọn ĐÚNG thứ đã tạo không** — máy thấy có lệnh dọn, không biết nó dọn cái gì.
3. **Oracle có độc lập theo spec không** — hay đang so app với chính app. Máy không đọc được đặc tả, nên
   `app == app` là chỗ nó mù hoàn toàn. Đây là điều quan trọng nhất trong năm điều.
4. **Dữ liệu test có unique giữa hai lượt không** — `RUN_ID` phải có ở MỌI chỗ sinh dữ liệu, không chỉ ở
   chỗ dễ nhớ.
5. **Có dữ liệu task-specific nào lọt vào suite dùng chung không** (`CLAUDE.md` §6). Đã thử gác bằng máy
   rồi bỏ: luật quét mã task khớp cả `ISO-8601`/`RFC-2119`, và phần lớn mã còn lại nằm trong chú thích
   ghi xuất xứ — thứ không phải lỗi.

## Hai chỗ §6 chỉ có máy MỘT NỬA — nói thẳng để không ai tưởng đã kín

- **"Đổi expected để pass"** — **CÓ máy**: `npm run expected:check` (`scripts/qa/expected_ledger.js`).
  Nhưng nó so với **snapshot của chính nó**, không so với git — và đó không phải thiếu sót mà là điều
  kiện thực tế: đo 29/10/2026 thì **0** file testcase được git track (`outputs/*` gitignore), nên một
  gate dựa trên `git diff` **không dựng được**. Phần người phải làm là **chụp mốc đúng lúc**: chụp ở thời
  điểm bộ case được CHỐT. Chụp sau khi đã sửa expected thì mốc mang luôn bản đã sửa, và gate thành đồ
  trang trí. Đo 30/10/2026: **1/5** task có snapshot, nên ở 4 task còn lại cửa đang ở trạng thái
  `CHƯA ĐƯỢC GÁC` (exit 2) — **không phải "đạt"**.
- **"Hardcode data task-specific vào template chung"** — `package:kit` có cảnh báo khi gói mang tên bảng
  hoặc host của dự án, nhưng đó là cửa phát hành, chứ không phải lúc đang sửa template.

Hai chỗ này chấm tay, mỗi lượt review.

> Bản trước của mục này viết *"không máy nào so expected với bản trước"* và đề xuất dựng gate bằng
> `git diff`. **Cả hai vế đều sai**: máy có từ 12/10/2026, và `git diff` là đường cụt đã đo. `GATES.md`
> thì khai đúng (CHẶN) — tức hai bề mặt của kit nói ngược nhau về cùng một luật suốt hơn hai tuần.
> `rule:consistency` nay có mệnh đề `EXPECTED-CO-MAY` để chặn cách nói cũ quay lại.

## Thứ tự đọc khi gate đã sạch mà vẫn nghi

1. Mở **ảnh evidence** của case nghi, trước khi đọc code. Bộ đo sai sinh ra `product_bug` giả, và ảnh là
   thứ phân biệt nhanh nhất giữa "app sai" và "phép đo sai".
2. Đọc `Kết quả mong đợi` của case trong bộ canonical — **trọn ô**, câu quyết định hay nằm ở gạch đầu
   dòng cuối.
3. So oracle trong spec với ô đó. Lệch thì sửa spec, KHÔNG sửa expected.

## Anti-Patterns của chính lượt review

- Đòi sửa một spec vì không thấy `expect(` — xem lại ba dạng oracle ở trên.
- Coi P1 là "đã đạt". P1 nghĩa là tỉ lệ dương tính giả còn cao, không nghĩa là không có lỗi.
- Nới assertion hoặc đổi expected cho hết đỏ (`CLAUDE.md` §6).
- Kết luận từ dòng tóm tắt thay vì exit code.

**Câu kích hoạt mẫu:** "review code automation này" · "bộ spec này có đáng tin không" · "soi chất lượng automation trước khi bàn giao" · "spec xanh nhưng tôi không tin" · "mấy test này có thật sự chứng minh được gì không" · "kiểm xem bộ test có kiểm đúng thứ cần kiểm không" · "soi lại độ tin của mấy spec đã viết"
