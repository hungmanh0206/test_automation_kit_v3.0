# v2.10.0 — số đo TRƯỚC khi vá

Đo ngày **04/11/2026**, trên `main` ở `baf126d` (= tag `v2.9.11`), máy Windows, Node v24.19.0.

Mọi con số dưới đây lấy bằng máy, không lấy bằng ước lượng. Lệnh tái lập ghi kèm từng mục. Bản chấm
04/11 ước một số khoản; chỗ nào số đo lệch với bản chấm thì ghi cả hai, và **lấy số đo**.

---

## 1. Kích hoạt skill — Phần 2.1

**Lệnh:** mở một phiên Claude Code mới ở gốc repo, đọc danh sách skill harness quảng bá lúc khởi động.

**Kết quả: harness LIỆT KÊ ĐỦ 28 skill của kit, kèm mô tả đầy đủ.**

```
automation_reviewer · backlog_bug_reporter · backlog_integration · backlog_testcase_publisher
combinatorial_matrix · decision_recorder · domain_recorder · flaky_test_analyzer
git_impact_analyzer · learning_recorder · lighthouse_check · load_check
locator_healing_agent · perf_check · precondition_setup_planner · qa_automation_engineer
release_summary · requirements_analyzer · risk_scorer · run_report_reader
security_check · system_mapper · tc_design_guide · tc_reviewer
tc_validator · test_data_generator · ui_debug_agent · ui_mocking
```

Cộng thêm **13 command** (`discover` … `ui-debug`) và **3 agent** cũng được quảng bá.

Đối chiếu đĩa: `.claude/skills/` có đúng **28** thư mục, `.claude/commands/` **13**, `.claude/agents/` **3**.

### Hệ quả — ba điều, và điều thứ ba là một lỗi đang sống

1. **Không cần đóng gói plugin.** Nhánh "nếu 28 shim không hiện ra" trong prompt không áp dụng, nên
   **điểm dừng bắt buộc của Phần 2.1 không xảy ra**.
2. **Chỗ cắt −2,2 KB ở Phần 3.2 được mở khoá**: danh sách 28 tên skill nằm trong đầu ra hook nay là
   thừa, vì harness đã liệt kê chúng với mô tả đầy đủ hơn.
3. **Hook đang nói sai.** Nguyên văn trong `additionalContext`:

   > `Skill của kit (28, KHÔNG auto-load — mở file để dùng, tên = tên thư mục)`

   Harness đang quảng bá chúng là **gọi được bằng tên qua công cụ Skill**. Nên câu đó không chỉ thừa:
   nó dạy một cách dùng sai, nằm trong phần **mọi phiên đều đọc**. Ghi chú cũ
   `reference_claude_skills_shim_nap_duoc` ("harness NẠP shim nhưng KHÔNG quảng bá tên") đã **hết
   đúng** — môi trường đổi, không phải kit đổi.

---

## 2. Gọn token — Phần 3

### 2.1 Phần LUÔN NẠP

**Lệnh:** `node scripts/qa/token_session.js`

| Khối | KB |
|---|---|
| `CLAUDE.md` | 4,23 |
| hook `SessionStart` (`inject_context.js` → `additionalContext`) | 2,01 |
| **`description` của 28 skill** | **7,28** |
| `description` của 13 command | 2,03 |
| `description` của 3 agent | 0,74 |
| **TỔNG** | **16,29 KB** (~5212 token, hệ số 3,2 ký tự/token) |

Bản chấm 04/11 ước **≈16,7 KB**; số đo là **16,29 KB**. Dùng 16,29.

**Khối lớn nhất là mô tả skill (7,28 KB), không phải `CLAUDE.md`.** Khối này không nằm trong
`load_map.json` và chưa gate nào đếm, nên một `description` dài thêm một câu làm mọi phiên về sau đắt
thêm mà không gì kêu. Đó là lý do `token:session` tồn tại.

**Đích:** < 10 KB. **Phải cắt ≥ 6,29 KB.**

> ⚠️ **Số học của chính bản chấm chưa tới đích.** Ba khoản cắt nó đề xuất là −2,2 (hook) −1,7
> (description) −2,0 (`CLAUDE.md`) = **−5,9 KB**, từ 16,29 còn **10,39 KB** — **vẫn trên 10**. Ghi ra
> đây trước khi cắt để kết quả cuối không bị làm tròn cho vừa mục tiêu. Chỗ dư duy nhất đủ lớn là
> 7,28 KB mô tả skill.

### 2.2 Phần nạp theo PHASE

**Lệnh:** `node scripts/qa/token_session.js --phase phase1`

Chỉ tính `diem_vao` + `bat_buoc` của `load_map.json`. **Không** tính `co_dieu_kien` — đúng nghĩa của
chúng là chỉ nạp khi gặp điều kiện; tính vào là thổi phồng số rồi đi cắt nhầm chỗ.

| Luồng | File bắt buộc | KB |
|---|---|---|
| **phase1** | `run_phase1_template.md` | 31,3 |
| | `phase1/01_setup_engine_fetch_docs.md` | 7,0 |
| | `phase1/02_gen_testcases.md` | 51,1 |
| | **TỔNG** | **89,3 KB** (~28583 token) |
| **phase2** | `run_phase2_template.md` · `phase2/04_execute_fe_playwright.md` | **91,8 KB** |

Bản chấm ước phase sinh TC **≈80 KB**; số đo **89,3 KB**.

**Đích:** ≤ 45 KB. **Phải cắt ≥ 44,3 KB, tức quá một nửa.**

---

## 3. Hướng dẫn cụ thể — Phần 1

Chưa đo. Sẽ ghi khi dựng `skills:template:check` và `skills:practice`.

---

## 4. Ghi chú về cách đo

- Hệ số **3,2 ký tự/token** giữ CÙNG `prompt_budget.js` và `doc_budget.js`, để ba con số so được với
  nhau. Đổi hệ số ở một chỗ là làm ba bảng số hết so được.
- `token:session` **không** ghi ngưỡng trong mã; nó đọc `alwaysOnMaxKB` và `phaseMaxKB.<luồng>` từ
  `.agent/config/prompt_budget.json` — một nguồn duy nhất, cùng chỗ với các ngưỡng còn lại.
- Thiếu thứ để đo thì nó trả **exit 2 "KHÔNG PHÁN ĐƯỢC"**, không trả 0. Cây-gói phát hành không có
  `.claude/` nên máy này không đo được ở đó, và một cửa báo xanh khi chưa đo là khai điều nó chưa biết
  — đúng lỗi cửa ⑩ của `version_check.js` từng làm `release:verify` đọc thành 13/15 ở `v2.9.10`.

---

# SỐ ĐO SAU — Phần 2 (kích hoạt skill)

Đo 04–05/11/2026. Mọi lượt dùng `claude` CLI `2.1.285`, 90 câu (70 ca thật + 20 ca `none`), công cụ
làm việc bị chặn để model không đi dò thay vì định tuyến, và skill được chọn đọc từ **lời gọi công cụ
`Skill`** chứ không từ lời model tự thuật.

## 2.1 — ĐẠT

Harness quảng bá đủ **28/28** skill kèm mô tả, **13** command, **3** agent. Không cần đóng gói plugin;
**điểm dừng bắt buộc không xảy ra**. Chi tiết ở mục 1 phía trên.

## 2.3 — ĐẠT

Cặp `git_impact_analyzer` ↔ `system_mapper` tách bằng **ĐẦU VÀO** (có `git diff` hay không), thay vì
bằng chủ đề. Mô tả cũ của `system_mapper` chứa cụm *"chạm chỗ này phải regression đâu"*, gần như trùng
câu truy vấn *"sửa chỗ này thì vỡ bề mặt nào"*. Thêm 5 ca đối chứng cho cặp này.

`skills:route:check`: **69/69 → 90/90 ca**, top-1 **97,8%**, `none` kích hoạt nhầm **0/20**, **0** ca
chọn sai, **2** ca dưới sàn (khai thành nợ mô tả).

## 2.2 — CHƯA ĐẠT 5. Đo được 50%, ngưỡng 90%.

### Phát hiện chính: một dòng trong hook đang CHẶN việc gọi skill

Phép phân biệt đúng chuẩn — **cùng 90 câu, cùng gốc repo, cùng model, chỉ khác một dòng**:

| Hook | top-1 | ca thật không gọi skill nào |
|---|---|---|
| CÓ dòng `Skill của kit (28, KHÔNG auto-load — mở file để dùng)` | **24,3%** (17/70) | 53/70 |
| ĐÃ GỠ dòng đó | **50,0%** (35/70) | 31/70 |

Gỡ một dòng làm tỉ lệ gọi đúng **tăng gấp đôi**. Cả hai lượt: **0** ca chọn sai, **0** lẫn cặp dễ
nhầm, **0/20** ca `none` kích hoạt nhầm — khoảng cách nằm TRỌN ở chỗ "có gọi hay không", đúng chỗ câu
"KHÔNG auto-load" tác động.

Dòng đó tồn tại vì một tiền đề đã hết đúng (`harness không tự phát hiện .agent/skills`). Nó vừa thừa,
vừa dạy sai, vừa làm giảm chất lượng định tuyến — và nằm trong phần mọi phiên đều đọc.

### Còn thiếu gì để lên 5

- **top-1 50% so với ngưỡng 90%.** Thiếu **28 ca** nữa trên 70.
- 31 ca còn trượt đều là *"không gọi skill nào"*, **rải mỏng khắp 21 skill** (nhiều nhất 5 ca cho
  `system_mapper`). **Không mô tả nào là thủ phạm**, nên không nhát sửa mô tả nào kéo được con số này.
  Đây là khuôn "model trả lời luôn thay vì mở skill" — thuộc về quyết định *có cần skill không*, không
  thuộc về định tuyến.

### Giới hạn của chính phép đo này, khai thẳng

Bộ đo chặn mọi công cụ làm việc, nên model chỉ còn hai đường: gọi `Skill` hoặc trả lời bằng chữ. Trong
lượt dùng thật, model có công cụ và có task, nên nó có thể mở skill muộn hơn trong lượt. **Vậy 50% là
CHẶN DƯỚI, không phải "độ chính xác định tuyến".** Đừng đọc nó thành con số tuyệt đối.

Và `skills:route:check` (từ ngữ) **đo hụt** so với model thật: câu *"soak test nửa tiếng"* bị nó xếp
dưới sàn 3,57 điểm, còn model gọi thẳng `load_check` ngay lượt đầu.

### Hai lỗi của chính tôi trong lúc dựng, ghi lại vì chúng sẽ lặp

1. **Ba lỗi đường ống, một triệu chứng.** `spawn` với `shell:true` nối tham số không escape (câu tiếng
   Việt vỡ); `--allowed-tools Skill` KHÔNG giới hạn gì (model đi `PowerShell` dò thư mục rỗng); stdin
   không chặn (chờ 3 giây mỗi lượt). Cả ba đều hiện ra thành *"model không gọi skill nào"*, và **không
   cái nào là lỗi định tuyến**. Lượt đầu ra 0/6, lượt hai 1/6 — nếu báo hai số đó thì người đọc nhận
   một kết luận hoàn toàn sai mà trông y hệt kết quả thật.
2. **So hai mẫu số khác nhau rồi kết luận nhân quả.** Tôi lấy 38,6% (90 câu, thư mục rỗng) so với
   68,8% (20 câu, repo) và kết luận "ngữ cảnh làm nên khác biệt". Đối chứng cùng mẫu bác ngay: 20 câu
   ấy ở thư mục rỗng ra **75,0%**, tức cao hơn chứ không thấp hơn. Đã vá dụng cụ: `--gioi-han` nay in
   cảnh báo "ĐÂY LÀ MẪU, không đại diện về độ khó" và dòng đó đi vào **cả file báo cáo**.

Thêm một chỗ bắt được trước khi nổ: chế độ `--trong-repo` làm `goc` **là gốc repo**, mà dòng dọn cuối
script là `fs.rmSync(goc, { recursive: true, force: true })` — chạy một lần là **xoá sạch cây làm
việc**, cây đang có WIP của các phiên khác. Đã chặn bằng `if (!TRONG_REPO)`.
