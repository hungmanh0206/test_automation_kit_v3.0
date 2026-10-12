# Prompt Phase 2 — Execute Lite

> Chạy: `Đọc file này và chạy với TASK_KEY=<TASK_KEY>`. Non-negotiables ở `CLAUDE.md` (đã auto-load).
>
> **Đây là bản RÚT GỌN của `04_execute_fe_playwright.md`.** Nó giữ nguyên 6 chốt và nguyên bộ máy gác;
> thứ nó bỏ là phần hướng dẫn dài về POM, cấu trúc thư mục, mẫu code và các ví dụ. Mở bản đầy đủ khi bạn
> cần một trong những thứ đó, hoặc khi task thuộc dải rủi ro cao (`npm run lane`).

## Vì sao có bản này, và nó KHÔNG được rẻ bằng cách bỏ gác

Bản đầy đủ nặng ~11,8k token, và phần lớn số đó là hướng dẫn viết code mà một agent đã biết. Nhưng cắt
một prompt execute thì rất dễ cắt luôn phần gác, và chuyện đó không lộ ra ngay — nó lộ ra ở lượt đầu tiên
có bug thật lọt qua.

Nên bản này được đo: `tests/fe/infra/execute-lite.spec.ts` cài **5 lỗi** vào output của một task giả, rồi
kiểm rằng đúng cái máy mà chốt tương ứng NÊU TÊN sẽ chặn từng lỗi. Chốt nào không nêu được tên máy, hoặc
nêu một máy không chặn, thì bản Lite đã mất phần gác đó và test sẽ đỏ.

---

## 6 CHỐT — xác nhận trước khi execute, và mỗi chốt có một máy đứng sau

**1. Nguồn và phạm vi.** `TASK_KEY` + `PROJECT_OUTPUT_DIR` có mặt; đọc testcase canonical LOCAL
(`test-cases/*.md`), không dựa hội thoại cũ. Trôi so với bản xuất thì kéo Sheet về `from-sheet/*.xlsx`
rồi đọc bản đó.
→ **Máy:** `npm run preflight -- --mode phase2 --task <TASK_KEY>` (thiếu input hoặc chưa có testcase
canonical = CHẶN) và `npm run canonical:drift`.

**2. Oracle độc lập.** Mỗi case phải có `Kết quả mong đợi` cụ thể — giá trị, URL, hoặc element theo spec.
Oracle rỗng thì DỪNG và đi lấy giá trị từ spec; `app == app` là tautology, không phải oracle.
→ **Máy:** `npm run gate:gen-testcase -- --dir <test-cases/>` — ô `Kết quả mong đợi` RỖNG = CHẶN.
  (`npm run design:gate` KHÔNG gác ô này: nó kiểm đủ cột canonical và các ô lõi khác, còn oracle rỗng
  thuộc `output_rules`. Phép đo 5-lỗi của §A12 tìm ra chỗ nhầm máy này.) Tautology `app == app` thì
  `gate:output` chỉ cảnh báo — phần phán đoán còn lại thuộc tầng chấm `npm run judge`, mục `ORACLE_DOC_LAP`.

**3. Batch và drive thật.** Gom NHIỀU case vào ÍT script, chạy song song, dùng hết fixture/account đã
được cấp. Case negative thì tự tạo input. **Không** để TODO/SKIP khi chưa thử.
→ **Máy:** phần đo được là `npm run gate:output` (case đã execute mà thiếu evidence = CHẶN). Phần "gom
đủ chưa" thì **không có máy** — nó thuộc tầng chấm `npm run judge` (mục `BATCH`), và tầng đó chỉ dùng
được khi người chấm còn hiệu chuẩn.

**4. Phân tầng kết quả.** Mỗi case → PASS/FAIL/SKIP/BLOCKED_SETUP/SKIP_SETUP. FAIL **bắt buộc** kèm
`failureLayer`: `product_bug` · `setup_failure` · `infra_flaky`. "Không phán được" KHÔNG thành PASS.
→ **Máy:** `npm run gate:output` (FAIL thiếu `failureLayer` = CHẶN; verdict ngoài
`.agent/config/verdict_taxonomy.json` = CHẶN).

**5. Loại flaky trước khi kết luận.** FAIL phải rerun 2–3 lượt để loại flaky và setup, TRƯỚC khi gọi nó
là product bug hay log Backlog.
→ **Máy:** `npm run bug:claim` (chưa đủ số lượt rerun = CHẶN).

**6. Evidence.** Mọi case đã execute — **PASS lẫn FAIL** — và mọi step phải có ảnh (`.png/.jpg/.jpeg/
.webp`) hoặc video (`.mp4/.webm`) đúng màn, có highlight, đã mask PII. Case nhiều thao tác → video.
CẤM `.json/.md/.txt/.log/.html/.csv/trace.zip`.
→ **Máy:** `npm run gate:output` (thiếu evidence, sai loại file, step thiếu status hoặc thiếu ảnh riêng
= CHẶN).

---

## Chạy

1. `npm run preflight -- --mode phase2 --task <TASK_KEY>` — đỏ thì dừng, đừng execute.
2. Đọc `test-cases/*.md`. Viết ÍT script phủ NHIỀU case, gom theo nhóm tiền điều kiện.
3. Chạy. Ghi kết quả vào `<TASK_OUTPUT_DIR>/test-results/testcase-status.json`, mỗi case:
   `tcId` · `status` · `comment` · `evidence[]` · `steps[]` (mỗi step có `status` và `evidence[]`), và
   FAIL thì thêm `failureLayer` + `reruns`.
4. FAIL → rerun 2–3 lượt → `npm run bug:claim` trước khi nói "bug".
5. `npm run check` — nó tự nhận phase và chạy đúng bộ máy của phase đó.
6. Trước khi finalize: `npm run self-review:enforce -- --task <TASK_KEY>`.

## Attestation

Sau execute, ghi `attestation` vào `testcase-status.json`:
`{ "oracleSource": "<sheet|spec|figma|api-contract>", "executed": <số case đã chạy>,
"allEvidenceAttached": true, "failuresClassified": true, "rerunDone": true }`.

Gate ĐỐI CHIẾU lời tự khai với sự thật đo được. Khai đúng — tick suông sẽ lệch và bị bắt.

## Khi nào mở bản đầy đủ (`04_execute_fe_playwright.md`)

- Cần mẫu code Playwright, cấu trúc POM, hoặc quy ước đặt tên file.
- Task thuộc dải rủi ro **đầy đủ** (`npm run lane` nói vậy).
- Có case API → thêm `05_execute_api_playwright.md`.
- Có FAIL cần triage → `06_triage_review.md`; xanh-đỏ bất thường → `07_triage_flaky.md`.
- Đã qua Bug Claim Gate và sắp log bug → `08_log_bug_backlog.md`.
