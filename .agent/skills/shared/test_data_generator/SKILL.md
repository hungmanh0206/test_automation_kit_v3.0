---
name: test_data_generator
description: Sinh test data cụ thể, unique theo RUN_ID, truy vết được và rollback được cho Phase 1 và Phase 2. Dùng khi case cần dữ liệu mới thay vì dữ liệu sẵn có. KHÔNG dùng để dựng state qua DB, và KHÔNG sinh dữ liệu chứa PII khách thật.
---

# Test Data Generator

## Purpose

Tạo hoặc đề xuất test data phục vụ testcase và automation, đảm bảo dữ liệu cụ thể, không trùng khi chạy song song và có cleanup/rollback.

## Responsibilities

| Trách nhiệm | Yêu cầu |
|---|---|
| Positive/negative/boundary/edge | Sinh data theo từng nhóm test. |
| Traceability | Data có prefix/time/random đủ truy vết TC hoặc run. |
| Parallel safety | Data unique, tránh conflict giữa session. |
| Cleanup | Ghi rõ pre-existing, created-by-test, cleanup-required hoặc read-only fixture. |
| Cách dựng | Tag `[<method>]` trong cell `Tiền điều kiện`; chi tiết (source/verification/cleanup) ở `### Setup Readiness` của `phase1-summary.md` |

## Inputs

| Input | Nguồn |
|---|---|
| Testcase | TC ID, module, precondition, data field |
| Requirement | Validation rule, business rule, API schema |
| Runtime scope | `TASK_KEY`, `RUN_ID`, project/site |

## Outputs

| Output | Vị trí |
|---|---|
| Test data table | Testcase Markdown hoặc `reports/phase1-summary.md` |
| Fixture/factory notes | Spec/helper hoặc report liên quan |
| Cleanup plan | Actual result/report khi execute |
| Cách dựng input | Tag `[<method>]` của từng TC (`api`/`factory`/`test_hook`/`ui`/`pre_existing`/`manual`) |

## Khi dùng / KHÔNG dùng

| Dùng | KHÔNG dùng |
|---|---|
| Case cần bản ghi MỚI, chưa có trong môi trường | State dựng được từ dữ liệu sẵn có đã verify tồn tại |
| Cần biến thể theo kỹ thuật (biên, rỗng, ký tự đặc biệt) | Dựng state bằng **DB** — non-negotiable §2, DB chỉ đọc |
| Cần dữ liệu unique để hai lượt chạy không giẫm nhau | Chọn *phương pháp* setup — đó là `precondition_setup_planner` |

⚠️ **Không bao giờ sinh file chứa email hoặc số điện thoại khách thật**, từ bất kỳ nguồn nào — kể cả export
có sẵn. Đây là quy định tổ chức (non-negotiable §1): được yêu cầu xuất file thì phải TỪ CHỐI.

## Máy kiểm

- `npm run secret:scan` — chặn secret bị commit. ⚠️ Nó chỉ quét file ĐƯỢC TRACK, nên dữ liệu sinh ra trong
  `outputs/**` (gitignore) **ngoài tầm nó**.
- `npm run auto:review:enforce` — rule `cred-literal` lấp đúng chỗ đó: credential viết thẳng trong spec,
  kể cả spec ở `outputs/**`.
- `npm run gate:output` — mask PII trong comment và evidence, dùng `PII_PATTERNS` của
  `scripts/qa/lib/output_rules.js`. Đừng khai lại mẫu PII ở đây: một nguồn.
- `RUN_ID` là mắt xích dọn dẹp. Thiếu nó thì dữ liệu hai lượt trùng nhau, và đó là nguồn flaky khó tìm
  nhất — `npm run reliability` chỉ thấy "case chập chờn", không thấy nguyên nhân.

## Bốn lớp field — sinh giá trị theo lớp, không sinh đồng loạt

Một form có nhiều ô, nhưng không phải ô nào cũng sinh theo cùng một cách. Nhầm lớp thì case xanh mà
số sai: random một ô vốn phải lấy đúng từ bộ tổ hợp làm cả phép đo mất nghĩa.

| Lớp | Là gì | Sinh thế nào |
|---|---|---|
| **Chiều** (dimension) | ô mang giá trị của một chiều trong ma trận tổ hợp | lấy **đúng** giá trị của bộ combo — **KHÔNG random** |
| **Đỡ** (supporting) | ô bắt buộc nhưng không thuộc chiều nào | random + unique theo `RUN_ID` + truy vết được |
| **Tham chiếu** (reference) | giá trị là **output của một bước/case TRƯỚC** | copy từ output đó, KHÔNG sinh lại |
| **Tính được** (computed) | suy ra từ công thức hoặc luật nghiệp vụ | tính theo công thức, rồi **verify** — `oracle:calc` |

Ô **tính được** là chỗ dễ sai nhất: sinh một giá trị rồi khẳng định app hiện đúng giá trị đó là
tautology nếu giá trị ấy cũng do app tính. Công thức phải lấy từ đặc tả, không lấy từ màn.

## Chuỗi dữ liệu — khi tiền đề của case là output của case khác

Phần lớn case tự dựng tiền đề. Nhưng có case khai thẳng rằng tiền đề của nó do case khác dựng:

```
[pre_existing] Đã có "Hà Văn Tân Hiệu Trưởng" giữ Nhóm chức vụ Hiệu trưởng (dựng ở TC_084)
```

Lúc đó bộ case không còn là một tập hợp mà là một **chuỗi**, và chuỗi có bốn đường hỏng:

| Đường hỏng | Triệu chứng khi chạy |
|---|---|
| nguồn đã bị xoá/đổi mã | tiền đề không ai dựng, nhưng case vẫn ra verdict |
| case phụ thuộc chạy TRƯỚC nguồn | trông như "app thiếu dữ liệu", không như "tiền đề chưa dựng" |
| vòng | không thứ tự nào dựng được |
| nguồn FAILED mà case phụ thuộc PASSED | phép đo chạy trên tình huống **không tồn tại** |

Đường cuối là đường đắt nhất: nó đã sinh ra **2 `product_bug` bịa** trong một phiên.

**Máy gác:** `npm run data:chain` · `npm run data:chain:check` (thêm `--status <testcase-status.json>`
mới chạy được phép kiểm verdict — thiếu nó thì cửa nói rõ là chưa phán). Lượt chạy đầu trên bộ CSDL-9004
bắt được một ca thật: `TC_063` khai `(dựng ở TC_075)` nhưng `TC_075` nằm SAU nó trong file.

> **Viết tiền đề cho máy đọc được**: dùng động từ **dựng / tạo / khai / đã chạy xong** kèm mã TC. Trích
> dẫn để đọc ("đã kiểm ở TC_045") KHÔNG được tính là mắt chuỗi, và đó là cố ý — gác cả hai loại thì
> phần lớn finding là dương tính giả, rồi người ta tắt cửa chứ không sửa theo nó.
>
> Và máy chỉ thấy chuỗi đã **KHAI**. Case phụ thuộc case khác mà không khai thì không máy nào biết —
> chỗ đó nằm ở phần chấm tay của `automation_reviewer`.

## Decision Rules

- Mỗi testcase phải có data cụ thể hoặc reference rõ tới fixture cụ thể.
- Data tạo mới nên có prefix `auto_<tc_or_feature>_<timestamp>_<random>`.
- Dữ liệu mutate phải có rollback/cleanup hoặc lý do không cleanup được.
- Dữ liệu read-only phải được verify tồn tại trước khi execute.
- Việc phân loại tiền điều kiện và chọn setup method (factory/hook/fixture/mock) do skill `precondition_setup_planner` đảm nhận; skill này tập trung sinh giá trị data cụ thể, unique, traceable.

## Constraints

- Không dùng production data thật nếu không có approve và rollback.
- Không ghi password/token/secret vào testcase/report.
- Không dùng mock data làm mất mục tiêu kiểm thử thật.

## Anti-Patterns

- Data chung chung: “email hợp lệ”, “user bất kỳ”.
- Dùng cùng một entity cố định cho nhiều test chạy song song.
- Không dọn dữ liệu tạo bằng API/UI sau test.

**Câu kích hoạt mẫu:** "sinh dữ liệu test cho case này" · "cần 50 hồ sơ để test lưới" · "tạo data unique theo RUN_ID" · "dữ liệu test xong thì dọn thế nào"

> Đừng lẫn với `precondition_setup_planner`: skill đó CHỌN CÁCH dựng state (factory/hook/fixture/mock)
> và khai readiness. Skill này SINH ra giá trị cụ thể, unique, truy vết và rollback được.
