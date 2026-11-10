# Bảng định tuyến — ý định → điểm vào → cửa cuối

> Mở khi chưa biết **gõ lệnh nào**, hoặc khi đang định làm tay một việc đã có luồng.
>
> Cột **KHÔNG dùng khi** là cột đáng đọc nhất. Kit đã có ba chỗ liệt kê lệnh (`docs/CHEATSHEET.md`,
> `docs/kit-map.md`, `.agent/skills/INDEX.md`) nhưng **không chỗ nào ghi ranh giới** — và danh sách
> không ranh giới thì nó trả lời được "có lệnh gì", không trả lời được "lệnh nào SAI cho việc này".
> Chọn sai điểm vào tốn cả một lượt chạy, và lượt đó thường kết thúc bằng một kết luận có vẻ hợp lý.
>
> Máy gác: `npm run router:check` — thêm command/workflow/agent mà không thêm dòng ở đây = **CHẶN**.
> Nó cũng chặn dòng để trống cột **KHÔNG dùng khi**, vì thiếu cột đó thì bảng này tụt về đúng ba bản
> liệt kê đã có.

---

<!-- router:command -->

## 1 · Mười bốn lệnh `/` — điểm vào của người dùng

| Lệnh | Dùng khi | KHÔNG dùng khi |
|---|---|---|
| `/start` | Task mới, chưa có `profiles/<TASK>/task.env`. Hỏi 5 điều rồi dựng profile. | Profile đã có — chạy lại chỉ thêm một lượt hỏi. Và nó KHÔNG đọc đặc tả, KHÔNG sinh case, KHÔNG tự gọi `/phase2`. |
| `/preflight` | Muốn biết trước một phase có chạy được không: thiếu file, JSON hỏng, chưa có TC canonical. | Thay cho `/gates`: preflight gác ĐẦU VÀO, không gác chất lượng bộ case. |
| `/discover` | Mở một hệ thống/module chưa biết nó có gì. Bò app bằng script tất định. | Đã có đặc tả đủ dùng. Và bản kê nó trả **không phải oracle** — chụp từ build không chứng minh build đúng. |
| `/phase1` | Chuẩn bị một task mới: tạo profile rồi khám phá hệ thống. Gộp `/start` và `/discover` theo đúng thứ tự. | Đã có profile VÀ đã bò app — chạy lại chỉ tốn một lượt. Nó KHÔNG đọc đặc tả và KHÔNG sinh case; đó là `/phase2`. |
| `/phase2` | Sinh bộ testcase: đọc spec → hỏi hết mơ hồ → Markdown canonical → Excel. | Chỉ cần sửa vài case khi requirement đổi — đó là `/partial-rerun`. |
| `/phase3` | Đã có TC canonical, cần dựng automation và chạy thật trên UAT. | Chưa có bộ TC (chạy `/phase2`), hoặc chỉ cần chạy lại case của bug đã fix (`/phase4`). |
| `/phase4` | Bug đã fix, cần chạy lại đúng các case liên quan và cập nhật kết quả. | Requirement đổi — case cũ có thể đã sai, `/phase4` không sửa case. |
| `/partial-rerun` | Requirement đổi: sửa/dọn một phần bộ case. Dựng bản review trước, chỉ apply sau khi user duyệt. | Muốn sinh lại cả bộ — đó là `/phase2`. Và KHÔNG tự apply khi user chưa duyệt. |
| `/manual-run` | Case `Manual-only` còn nằm ở `SKIP_SETUP` và cần verdict thật. | Case automation được. Never-auto: chỉ chạy khi user yêu cầu, và chạm UAT phải xác nhận trước. |
| `/ui-debug` | Màn mới, hoặc `script_error` do locator. Soi DOM thật, neo nhãn UI ↔ cột DB. | Case đỏ vì nghiệp vụ — soi DOM sẽ không trả lời gì. Dùng agent `case-debugger`. |
| `/explore` | Dò rủi ro NGOÀI phạm vi case đã viết, theo charter. | Thay cho bộ case có cấu trúc. Phát hiện ở đây không có `oracle_ref` thì là `OBSERVATION`. |
| `/gates` | Trước khi finalize/publish: bó gate gộp preflight + design + row-quality + execution + attestation. | Giữa lúc đang sinh case — gate gộp đo bộ ĐÃ XONG, chạy sớm chỉ cho một bảng đỏ vô nghĩa. |
| `/publish` | Đồng bộ TC / kết quả lên Google Sheet, sau khi đã xem bản merge local. | Chưa xem bản merge. Ghi đè Sheet thật là việc không hoàn tác được. |
| `/release` | Đã execute xong, sổ nợ sạch: chạy cửa ra `done` rồi khuyến nghị go/no-go. | Còn case `BLOCKED`/`SKIP` chưa giải thích — cửa sẽ chặn, và chặn đúng. |

<!-- router:workflow -->

## 2 · Mười sáu workflow — file quy trình, KHÔNG phải lệnh

Workflow là thứ lệnh `/` **đọc**, không phải thứ người gõ. Mở trực tiếp khi cần biết một bước làm gì.

| Workflow | Dùng khi | KHÔNG dùng khi |
|---|---|---|
| `01_system_discovery` | Bước 0: chưa biết hệ thống có gì. Nạp **có điều kiện**. | Đã có đặc tả — mở nó là nạp token cho một việc không cần. |
| `02_tong_quan_testcase` | Cần bản đồ tổng của `/phase2` — sinh testcase. | Cần làm thật một bước — mở file bước, file này chỉ là mục lục. |
| `03_scope_planning` | Muốn đề xuất loại test theo rủi ro. Tuỳ chọn, **suggest-only**. | Coi nó là quyết định scope — nó chỉ đề xuất, mẫu số vẫn phải neo bằng `scope:anchor`. |
| `04_prepare_context` | Chốt scope và thu đủ nguồn. Có **Ambiguity Gate** chặn sinh TC khi còn mơ hồ. | Bỏ qua để sinh case sớm — gate này là chỗ chặn duy nhất trước khi mơ hồ thành expected bịa. |
| `05_generate_testcases` | Sinh case theo template canonical, có nhóm chức năng, risk, data cụ thể. | Chưa qua Ambiguity Gate, hoặc chưa neo mẫu số. |
| `06_validate_export_report` | Kiểm chất lượng, xuất Excel, ghi coverage/risk + ba bảng đối soát. | Case còn đang sinh — nó đo bộ đã xong. |
| `07_auto_publish_backlog` | Publish TC lên Google Sheet, SAU khi QA xác nhận Excel. | QA chưa xác nhận. Bước 3 ghi `Pending QA confirmation` là có lý do. |
| `08_tong_quan_execute` | Cần bản đồ tổng của `/phase3` — execute. | Cần làm thật một bước — mở file bước. |
| `09_prepare_execution` | Chốt scope, TC, env, data trước khi generate/chạy. | Bỏ qua rồi chạy thẳng — thiếu tiền đề thì verdict không có giá trị. |
| `10_generate_or_update_automation` | Sinh/cập nhật spec + helper đúng theo TC, ưu tiên task-scoped. | Sửa shared helper khi story khác đang chạy (`CLAUDE.md` §5). |
| `11_execute_and_auto_heal` | Chạy thật, phân loại fail/skip/flaky, sửa root cause thuộc automation/setup. | "Sửa" bằng cách nới assertion hay đổi expected (`CLAUDE.md` §6). |
| `12_report_and_backlog_gate` | Tổng hợp kết quả, ghi shared change/promotion, log Backlog **chỉ** khi đủ điều kiện. | Case `setup_failure` hoặc `SKIP` — không log Backlog cho hai tầng đó. |
| `13_tong_quan_rerun` | Cần bản đồ tổng của `/phase4` — rerun. | Thay đổi tài liệu/requirement — đó là `/partial-rerun`. |
| `14_map_bug_to_testcase` | Xác định bug còn mở và case/spec cần chạy lại. | Chưa biết bug nào đã fix — map trước khi dev fix là map vào không khí. |
| `15_rerun_and_verify` | Chạy lại case liên quan và xác minh PASS/FAIL/SKIP. | Chạy lại cả suite: rerun là targeted, chạy tràn làm mất ý nghĩa phép đo. |
| `16_update_backlog_and_report` | Chuyển bug sang Done khi PASS **thật**, hoặc ghi rõ fail/blocker. | PASS sau một lượt duy nhất mà chưa loại flaky. |

<!-- router:agent -->

## 3 · Ba subagent — việc máy móc, hợp đồng vào-ra rõ

| Agent | Dùng khi | KHÔNG dùng khi |
|---|---|---|
| `test-runner` | Đã có spec, chỉ cần biết case nào đỏ. Trả bản tóm tắt. | Cần phán nguyên nhân — nó không suy luận nghiệp vụ, và tóm tắt không phải verdict. |
| `excel-convert` | Chuyển TC Markdown → Excel, hoặc ghi kết quả vào cột `Result`. | Mong nó tự đẩy lên Drive — nó **chỉ ghi cột `Result`**, publish là việc của luồng chính. |
| `case-debugger` | MỘT case đã đỏ: đọc log + ảnh FAIL, soi DOM, sửa spec/locator, chạy lại đúng case đó. | Cả lô đỏ (khoanh tầng trước, ở `phase2_03`), hoặc case đỏ vì product bug — sửa spec lúc đó là che bug. |

---

<!-- router:het -->

## Cửa cuối, theo điểm vào

Chọn đúng điểm vào vẫn chưa xong: mỗi nhánh có một cửa **CÓ RĂNG** ở cuối, và đọc **exit code** chứ
không đọc dòng tóm tắt.

| Nhánh | Cửa cuối | Mức |
|---|---|---|
| Phase 1 | `npm run self-review:enforce -- --task <KEY>` | CHẶN |
| Phase 2 | `npm run gate:output` rồi `npm run self-review:enforce -- --task <KEY>` | CHẶN |
| Re-run | `npm run gate:output` | CHẶN |
| Publish | xem bản merge local TRƯỚC, rồi `/publish` | người xác nhận |
| Release | `npm run exit:gate -- --cua done --task <KEY>` rồi `npm run release:summary` | CHẶN |

Bản thường (không `:enforce`) luôn exit 0, nên nó **không chặn được gì** — dùng bản `:enforce`.
