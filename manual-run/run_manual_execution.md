# Manual-run — Chạy tay case `Manual-only` (Never-auto)

> Entry point nhánh phụ Manual-run. Chỉ chạy khi **user yêu cầu tường minh**. Ranh giới và luật ở
> [`manual-run/reference.md`](reference.md). Rule non-negotiables ở `CLAUDE.md`, đã auto-load.

## Mục đích

Chạy nốt những case mà Phase 2 đã ghi `SKIP_SETUP` vì khai `[manual]`, để chúng có **verdict thật** thay
vì nằm mãi ở trạng thái chưa chạy. `SKIP_SETUP` là lời khai *"chưa chạy"*, không phải kết luận.

## Điều kiện chạy (BẮT BUỘC)

1. User yêu cầu rõ ràng một lượt chạy tay, nêu task và tập case.
2. Bộ TC canonical có mặt ở `<TASK_OUTPUT_DIR>/test-cases/`, và case định chạy **đã khai `[manual]`**.
3. Có môi trường và account test hợp lệ từ `profiles/<TASK>/task.env`.
4. Xác nhận trước mỗi lượt chạm UAT. Nhánh này chạm UAT bằng tay nên rule đó áp nguyên.

Case chưa khai `[manual]` thì **dừng**. Sửa lời khai ở Phase 1 kèm lý do, hoặc mở
`reports/capability-request.md` để xin hook. Không chạy tay rồi khai ngược lại.

## Workflow

0. **Lấy danh sách case `[manual]`.** Đọc ô Tiền điều kiện của bộ canonical, lọc dòng mở đầu bằng
   `[manual]`. Ghi ra danh sách kèm lý do đã khai, để biết mình đang chạy gì và vì sao nó không tự động được.
1. **Mở sổ phiên** `<TASK_OUTPUT_DIR>/manual-run/session.md` theo khuôn dưới. Bốn trường bắt buộc, điền
   trước khi chạy chứ không điền sau.
2. **Lập kế hoạch mở rộng**: `TASK_ENV=profiles/<TASK>/task.env npm run expansion:plan`. Chạy tay **không**
   miễn mục 3 của `CLAUDE.md`. Trục nào không áp được bằng tay thì ghi lý do, đừng bỏ im lặng.
2b. **Soi trước danh sách thao tác PHÁ HUỶ.** `npm run manual:check` liệt kê case `[manual]` nào có bước
   xoá, duyệt, gửi, huỷ, import… (dấu hiệu ở `.agent/config/manual_run.json`). Trên môi trường **dùng
   chung**, chạy tay KHÔNG có `RUN_ID` để dọn như automation, nên một thao tác phá huỷ làm tiền đề của case
   khác và của task khác biến mất. Với những case đó: **bỏ qua rồi khai lý do**, hoặc nếu phải chạy thì ghi
   mọi thứ đã tạo/xoá vào sổ dữ liệu ở bước 6b.
   Máy chỉ **liệt kê**, không tự hạ verdict — có case mà thao tác xoá chính là thứ phải kiểm.
3. **Chạy từng case**, theo đúng các bước trong ô `Các bước thực hiện`. Case thường: **1 ảnh ở bước
   quyết định**. Case thành bug (`product_bug`/`api_bug`): **ảnh từng step**, đủ chuỗi để dev dựng lại.
   Mọi step vẫn phải ghi `status` riêng. Highlight element đang kiểm, mask PII khách. Case nhiều thao
   tác thì **quay video**.
3b. **Case đỏ thì chạy tiếp, đừng dừng cả lượt.** Dừng ở case đỏ đầu tiên làm mất cả buổi. Nhưng chạy tiếp
   mù cũng sai: **3 case LIÊN TIẾP đỏ cùng một tầng hạ tầng** (`setup_failure`, `env_issue`,
   `script_error`) là dấu hiệu môi trường sập, không phải 3 lỗi khác nhau — dừng, sửa môi trường, rồi chạy
   lại phần đó. `manual:check` cảnh báo khi thấy chuỗi đó trong file kết quả, và nói rõ các verdict sau đó
   đáng nghi.
3c. **Báo tiến độ mỗi 8 case** (`tienDoMoiNCase` trong config): đã chạy bao nhiêu, còn bao nhiêu, bao nhiêu
   đỏ. Một lượt 50 case im lặng hàng giờ là lý do người theo dõi không biết nó còn sống hay đã treo.
4. **Kết luận theo oracle của case**, lấy từ ô `Kết quả mong đợi`. Không phán theo cảm nhận, và không lấy
   chính giao diện làm chuẩn đúng sai.
5. **FAIL thì rerun 2 đến 3 lần** loại flaky và loại lỗi setup, rồi phân tầng `failureLayer`. Chỉ tầng
   `product_bug` và `api_bug` được log Backlog, và phải qua Bug Claim Gate.
6. **Ghi kết quả** vào `<TASK_OUTPUT_DIR>/test-results/testcase-status.json`. Khuôn dùng chung với Phase 2,
   không có khuôn riêng cho chạy tay. File phải có khối `attestation` ở mức gốc, năm cờ:
   `oracleSource` · `executed` · `allEvidenceAttached` · `failuresClassified` · `rerunDone`. Thiếu khối đó
   thì `output_gate` cảnh báo, vì nó là chỗ người chạy tự khai để gate đối chiếu lại.
6b. **Ghi NGAY sau mỗi case, không gom cuối lượt.** Verdict và đường dẫn evidence vào
   `testcase-status.json` ngay khi vừa kết luận case đó. Gom tới cuối thì một lượt bị ngắt giữa đường sẽ
   mất toàn bộ phần đã chạy — và đã có tiền lệ: một lượt chết cụt không có dòng tổng kết làm mất 12 case,
   triệu chứng trông y như lỗi app.
6c. **Sổ dữ liệu đã tạo** — thêm khối này vào `session.md`:

   ```markdown
   ## Sổ dữ liệu đã tạo

   | TC ID | Bản ghi đã tạo | Đã dọn | Lý do nếu chưa dọn |
   |---|---|---|---|
   | CSDL_HS_TC_088 | 1 học sinh mã QA-001 | có | |
   | CSDL_HS_TC_092 | 1 lớp QA10A1 | chưa | giữ làm tiền đề cho lượt sau, đã thống nhất với chủ dự án |
   ```

   Chạy tay không có `RUN_ID` để dọn tự động, nên bản ghi không ghi vào đây sẽ nằm lại UAT vĩnh viễn.
   ⚙️ `manual:check` **cảnh báo** khi có dòng khai đã tạo mà cột dọn trống **và** không có lý do. Giữ lại là
   lựa chọn hợp lệ — nhưng phải nói ra. Mask PII trong cột mô tả, y như mọi file output khác.
7. **Kiểm phiên**: `npm run manual:check` để xem trước, rồi `npm run manual:check:enforce` trước khi đẩy.
8. **Trước finalize**: `npm run self-review:enforce -- --task <TASK_KEY>`.
9. **Ghi về cột Result**: `node scripts/convert_excel/merge_execution_status.js <xlsx> <status.json>`, đúng
   như lượt automation.

## Khuôn `session.md`

**Năm** trường này là thứ máy đọc. Thiếu trường nào thì lượt chạy không truy được về ai, trên build nào,
trên đơn vị nào.

```markdown
# Lượt chạy tay — <TASK_KEY>

- Người chạy: Nguyễn Văn A
- Ngày: 09/10/2026
- Môi trường: UAT, https://uat.example.gov.vn
- Build / Version: 2026.10.08-rc2
- Đơn vị / cấp học: TEST 1 (mã 01000754), cấp THCS

## Case trong lượt này

| TC ID | Lý do khai `[manual]` | Verdict |
|---|---|---|
| CSDL_HS_TC_088 | Captcha không có đường tắt trong UAT | PASS |

## Không phán được

Mỗi case verdict `BLOCKED`/`SKIP` một dòng, kèm LÝ DO. Mục này bắt buộc khi lượt chạy có ca như vậy.

| TC ID | Verdict | Vì sao không phán được |
|---|---|---|
| CSDL_HS_TC_091 | BLOCKED_SETUP | Không có trường nào trong UAT đang ở trạng thái "đã gửi" để mở khoá |

## Ghi chú

Chỗ nào lệch so với dự kiến thì ghi ở đây, kèm TC ID.
```

Placeholder không tính là đã điền. `TBD`, `n/a`, dấu gạch, hay `______` đều bị bắt.

**Vì sao `Đơn vị / cấp học` là một trường riêng, không gộp vào `Môi trường`:** `Môi trường` ghi host, mà
thứ làm hỏng một phép đo nhiều nhất trên app này không phải sai host — là **chạy trên đơn vị hoặc cấp học
khác với cái case cần**. Một tài khoản chỉ thuộc một cấp, hai task khác cấp chạy song song đổi cấp của
nhau, và URL màn khác nhau theo cấp. Không ghi lại thì về sau không ai phân biệt được *app sai* với
*đo sai chỗ*. Khai `Đơn vị`, `Cấp học` hay `Trường` đều được — tuỳ màn, thứ quyết định là cái nào.

**Vì sao mục `## Không phán được` là bắt buộc:** `BLOCKED`/`SKIP` trong JSON là verdict hợp lệ, nhưng tự
nó không nói vì sao. Người đọc về sau chỉ thấy một mã, và mã đó trông y như nhau dù lý do là "chưa tìm
thấy dữ liệu" hay "app chặn không cho vào". Đây cũng là chỗ dễ biến thành `PASS` nhất nếu không ai ghi lại.

## Rules

- **Evidence cho mọi case đã execute, cả PASS** — 1 ảnh/video ở **bước quyết định**; case tầng bug (`product_bug`/`api_bug`) thì **từng step**. Mọi step vẫn phải có `status`. Ảnh hoặc video, không phải log hay JSON.
  Luật bên ngoài chỉ chụp khi FAIL là luật **bị bỏ**, xem `reference.md`.
- Verdict chỉ lấy trong `.agent/config/verdict_taxonomy.json`. Không tự đặt.
- Không mutate dữ liệu UAT ngoài phạm vi case. Không dựng state bằng DB.
- Không ghi secret hay PII khách vào bất kỳ file output nào, kể cả sổ phiên.
- Không sinh case mới ở nhánh này. Thấy vùng đáng dò thì chuyển sang [`exploratory/`](../exploratory/reference.md).
- Không nới oracle để case đi qua. Không phán được thì ghi `BLOCKED`, không ghi `PASS`.

## Outputs

| Output | Vị trí |
|---|---|
| Sổ phiên | `<TASK_OUTPUT_DIR>/manual-run/session.md` |
| Kết quả | `<TASK_OUTPUT_DIR>/test-results/testcase-status.json` |
| Evidence | `<TASK_OUTPUT_DIR>/test-results/artifacts/` |
