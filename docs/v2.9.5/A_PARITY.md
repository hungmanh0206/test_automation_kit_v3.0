# A_PARITY — chỗ nào A còn hơn B, và hiện đã xử lý thế nào

> **Nghiệm thu của v2.9.5.** Mỗi dòng phải kết về MỘT trong ba trạng thái, và **không dòng nào được
> để trống**: ✅ đã làm, kèm máy gác · ⛔ cố ý không port, kèm lý do · ⚠️ đã làm phần tài liệu
> nhưng **chưa có máy**, nói thẳng.
>
> Máy gác chính tài liệu này: `npm run parity:check`. Nó chặn khi có dòng để trống hay còn dấu hiệu đang-làm, khi một dòng ✅
> nhắc `npm run <x>` không tồn tại, hoặc khi cột trạng thái mang ký hiệu lạ.
>
> **A** = plugin `qig-qa-automation`, bản giải nén đo ngày 29/10/2026.
> **B** = kit này.

## Hai bề mặt, đo chứ không nhớ

| | A | B |
|---|---|---|
| lệnh điểm vào | 32 command | 13 lệnh `/` + 16 workflow |
| skill | 18 | 28 |
| file luật | 6 | `RULE_GLOBAL.md` + `.agent/rules/**` + `CLAUDE.md` auto-load |
| máy kiểm | 2 script Python (đọc/xuất testcase) | **149** máy trong `.agent/config/GATES.md` |
| skill dài nhất | `rbt-manual-testing` **936 dòng** (~16,2k token, luôn-nạp) | trần **2.500 token** mỗi `SKILL.md`, phần dày ở `references/` |

Con số cuối là khác biệt về HÌNH DẠNG, không phải về lượng: A nhồi hướng dẫn vào phần luôn-nạp, nên càng
dày thì càng ít lượt thật sự đọc hết. B tách, và có hai máy ép chuyện đó (`skills:lint`, `prompt:budget`).

---

## Bảng nghiệm thu theo từng mục của kế hoạch

| § | A hơn ở chỗ | B hiện thế nào | Máy gác | TT |
|---|---|---|---|---|
| §1.2 | 18 skill của A có mô tả dài, dễ chọn hơn | Hạ nợ `skills:lint` về **0/0/0** và bật `--enforce` trong CI; thêm `skills:route:check` đo trên **69 ca tiếng Việt** viết diễn ý, đạt 68/69 = 98,6% | `npm run skills:lint:enforce` · `npm run skills:route:check` | ✅ |
| §2 | `discover_system` + `requirements-analyzer` của A dạy quy trình recon đầy đủ | `requirements_analyzer` thêm bảng *bước recon → file kết quả* và `references/recon.md` (9 bước, 4 mức cột `Nguồn`); `system:check` in **dòng tổng ba mức bằng chứng** nên ma trận 90% `unknown` không còn trông như đã kiểm chứng | `npm run recon:check` · `npm run system:check` | ✅ |
| §3.1 | A có ví dụ TC trọn vẹn trong skill | Ba dòng TC ví dụ 10 cột + ma trận ST + DT, **tự qua gate**: `gate:gen-testcase` 0 chặn 0 cảnh báo, `tc:review` **100%**, mọi `BR-…` tồn tại thật trong `knowledge/domain/` | `tests/fe/infra/tc-examples.spec.ts` (7 phép kiểm) | ✅ |
| §3.2 | A có bảng đối soát cuối bộ (viết tay) | Ba bảng **MÁY SINH** vào `phase1-summary.md`; bảng ③ gọi lại `dim:coverage` chứ không đếm lần hai; `--check` bắt khối bị sửa tay | `npm run phase1:tables -- --enforce` · `npm run phase1:tables:check` | ✅ |
| §3.3 | A có 15 loại field + 6 component trong checklist | Danh mục canonical của B **đã phủ trọn** 15 + 6, cộng 3 component nữa. Chỗ lệch nằm ở hai checklist của skill: cùng khai "18 loại" với **18 nội dung khác nhau**. Đã gắn mã canonical vào từng dòng, thêm 4 loại đo được có thật, và khai `otp`/`richtext` là **chưa gặp kèm ngày đo** | `tests/fe/infra/tc-design-guide.spec.ts` (4 phép kiểm đối soát + đối chứng dương) | ✅ |
| §3.4 | — | Ví dụ phải trích **nguyên văn** rule, không diễn giải lại | `tests/fe/infra/tc-examples.spec.ts` | ✅ |
| §4 | `qa-automation-engineer` của A là bộ định tuyến 27 khối cho 32 command | Bảng định tuyến **32 điểm vào** (13 lệnh · 16 workflow · 3 subagent), mỗi dòng có cột **KHÔNG dùng khi** — cột mà cả ba bản liệt kê sẵn có của B đều không có. Đặt ở `references/`, không nhồi vào phần luôn-nạp | `npm run router:check` | ✅ |
| §5 | A có `automation-code-reviewer` chấm rubric 6 nhóm | Skill `automation_reviewer` + **2 trong 3** luật `auto:review` mới. Luật thứ ba (`assert-before-act-only`) bị loại vì đo được là **tập con tuyệt đối 18/18** của luật kia | `npm run auto:review:enforce` | ✅ |
| §5 | — | `no-assert-after-act` để **cảnh báo**, không chặn: dương tính giả soi tay **2/5 = 40%**, trên ngưỡng 20% đặt trước | `tests/fe/infra/automation-review.spec.ts` | ✅ |
| §6 | `test-data-generator` của A có Data Chain Pattern + 4 lớp field | Thêm đúng bốn lớp (chiều · đỡ · tham chiếu · tính được) và mục chuỗi dữ liệu. `data:chain:check` gác bốn đường hỏng của chuỗi, và **lượt chạy đầu bắt được một lỗi thật** ở bộ CSDL-9004 | `npm run data:chain:check` | ✅ |
| §7 | `test-report-analyzer` + `test-summary-reporter` của A | Skill `run_report_reader` (6 bước, mỗi bước ghi rõ nó KHÔNG trả lời được gì) + view `trace:matrix --pm` gộp theo module | `npm run trace:matrix` · `npm run run:analysis:enforce` | ✅ |
| §7 | — | Sổ phiên chạy tay thêm `Đơn vị / cấp học` và mục `## Không phán được` | `npm run manual:check:enforce` | ✅ |

## Chỗ cố ý KHÔNG port

| A có | Vì sao không port |
|---|---|
| `fetch_jira_requirements`, `import_test_results_xray`, `jira-integration` | Kit đã **bỏ Jira/Confluence/AIO** có chủ đích, và có cửa giữ ranh giới đó. Thêm lại là đi ngược một quyết định đã chốt |
| Mode routing `QUICK` / `FULL` / `CHECKLIST` trong một skill | Đó là tật **gộp** của A: một skill ba chế độ thì mô tả không nói được dùng khi nào. B tách theo việc, và `skills:route` đo được là tách bạch |
| `generate_automation_framework` (scaffold Playwright/Selenium/Appium) | B chỉ dùng Playwright, và luật nói thẳng "không sinh framework ngoài Playwright". Scaffold ba framework là ba đường chưa từng chạy |
| "AI Self-Quality Gate 9 tiêu chí" | B đã có `tc_reviewer` rubric 8 tiêu chí **có máy chấm**, trong đó 6 tiêu chí máy chấm đủ và 2 tiêu chí gắn cờ `AI`. Port thêm một bảng tự chấm là thêm một lớp tự khai |
| `REST Assured` / `Appium` cho API và mobile | Ngoài phạm vi đang chạy. Khai một framework không có lượt chạy nào là khai năng lực không kiểm chứng được |

## Chỗ ĐÃ LÀM nhưng CHƯA CÓ MÁY — nói thẳng

| Việc | Vì sao chưa có máy |
|---|---|
| "Quan sát thụ động" trong `requirements_analyzer` | Phân biệt *quan sát* với *tác động* phải đọc ý của từng bước, máy chỉ đọc chữ. Review tay |
| `execution-summary.md` **kể** đúng lượt chạy không | Nay có `npm run exec:tally:check` gác phần ĐO ĐƯỢC: con số trong báo cáo phải truy về một sổ verdict CÓ TÊN. Phần **kể** đúng hay không thì vẫn do người viết — máy không đối chiếu được lời kể với artifact |
| "Đổi expected để pass" (`CLAUDE.md` §6) | Không máy nào so expected với bản trước. Muốn gác phải dựng một cửa trên `git diff` |
| "Hardcode data task-specific vào template chung" | `package:kit` chỉ cảnh báo ở cửa phát hành, không bắt lúc đang sửa template. Luật quét mã task đã thử rồi bỏ: nó khớp cả `ISO-8601`/`RFC-2119` |
| Case phụ thuộc case khác mà **không khai** | `data:chain` chỉ thấy chuỗi đã KHAI trong ô `Tiền điều kiện`. Chỗ không khai nằm ở phần chấm tay của `automation_reviewer` |
| `presence-only` bắt đúng ở quy mô nào | Luật nổ **0 lượt** trên 2.873 test, đo hai lần. Có đối chứng dương chứng minh nó nổ được, nhưng chưa có số đo về độ chính xác khi có ca thật |

---

## Đọc đúng bảng này

Bảng nói **B đã xử lý chỗ nào A còn hơn**, không nói "B hơn A". Hai điều nó KHÔNG chứng minh:

1. **Máy có mặt ≠ phép đo đúng.** Mỗi máy ở đây đều có đối chứng hai chiều trong `tests/fe/infra/`, và
   đó là thứ đáng tin hơn danh sách này. Đợt v2.9.5 có **6 lần** chính phép đo của tôi sai trước khi
   đúng — chi tiết ở từng commit message, giữ lại để còn đọc được.
2. **Mẫu số vẫn là thứ A đã làm.** Chỗ nào A không có mà B cũng không có thì không có dòng nào ở đây, và
   `100%` của bảng này không nói gì về nó.
