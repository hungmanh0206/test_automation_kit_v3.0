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

## 2.2 — CHƯA ĐẠT 5. Đo tuần tự được ~69%, ngưỡng 90%.

### Số đo đáng tin duy nhất: 4 lượt TUẦN TỰ, 05/11/2026

Cùng 90 câu, cùng gốc repo, cùng model `2.1.285`, cùng bản dụng cụ (kiểm khớp từng byte), một luồng.
Biến DUY NHẤT là 12 description. Bên "trước" đo trên một `git worktree` riêng, không sửa cây dùng chung.

| | lượt 1 | lượt 2 | dải | trung bình |
|---|---|---|---|---|
| "trước" — 12 mô tả DÀI (~250 ký tự) | 70,0% | 68,6% | 68,6–70,0 | **69,3%** |
| "sau" — 12 mô tả NGẮN (~140 ký tự) | 64,7% | 73,5% | 64,7–73,5 | **69,1%** |

Cả bốn lượt: **0** ca chọn sai · **0** lẫn cặp dễ nhầm · **0** ca `none` kích hoạt nhầm.

Luật đọc viết TRƯỚC khi có số: hai dải chồng lên nhau thì nhát cắt không gây hại đo được và được giữ;
bên "trước" cao rõ hơn cả dải của "sau" thì hoàn tác. **Hai dải chồng lên nhau hoàn toàn, trung bình
chênh 0,2 điểm ⇒ GIỮ nhát rút mô tả.** Phần luôn nạp ở mức 11,88 KB vì thế không phải trả bằng chất
lượng định tuyến.

Và một con số phụ quan trọng hơn cả kết luận: **hai lượt của CÙNG MỘT trạng thái lệch nhau tới 8,8
điểm** (64,7% và 73,5%). Đó là độ phân giải của phép đo này. Mọi chênh lệch trước/sau nhỏ hơn cỡ đó
đều không phân biệt được với dao động.

### Rút lại: con số "gỡ hook làm định tuyến tăng gấp đôi"

Bản trước của mục này ghi một bảng "CÓ dòng hook 24,3% / ĐÃ GỠ 50,0%" và kết luận gỡ dòng ấy làm tỉ lệ
gọi đúng **tăng gấp đôi**. **RÚT LẠI.** Cả hai con số lấy từ lượt quét chạy **3 luồng song song**, nơi
các phiên model bị throttle, và bản đầu của dụng cụ đếm lượt bị throttle **thành** "model không gọi
skill". Không có phép đo tuần tự trước/sau cho việc gỡ hook, nên câu "gấp đôi" **không có căn cứ**.

Điều còn đúng: dòng hook nói *"KHÔNG auto-load — mở file để dùng"* về những skill đang được quảng bá là
gọi được bằng tên. Gỡ một chỉ dẫn sai trong phần mọi phiên đều đọc là đúng, dù nó có ảnh hưởng đo được
hay không. Phần luôn nạp giảm 2,01 → 1,23 KB.

### Còn thiếu gì để lên 5

- **top-1 ~69% so với ngưỡng 90%.** Thiếu khoảng **15 ca** trên 70.
- Ca trượt đều là *"không gọi skill nào"*, không có ca nào chọn SAI. Lượt 3 luồng trước đó cho thấy chúng
  rải mỏng khắp nhiều skill, nên không nhát sửa mô tả nào kéo được con số này. Khuôn là *"model trả lời
  luôn thay vì mở skill"*, tức quyết định *có cần skill không*, không phải định tuyến.

### Giới hạn của chính phép đo này

Bộ đo chặn mọi công cụ làm việc, nên model chỉ còn hai đường: gọi `Skill` hoặc trả lời bằng chữ. Trong
lượt dùng thật, model có công cụ và có task, nên nó có thể mở skill muộn hơn trong lượt. **Vậy ~69% là
CHẶN DƯỚI, không phải "độ chính xác định tuyến".**

Và `skills:route:check` (từ ngữ) **đo hụt** so với model thật: câu *"soak test nửa tiếng"* bị nó xếp
dưới sàn 3,57 điểm, còn model gọi thẳng `load_check` ngay lượt đầu.

### Ba lỗi của chính tôi trong lúc đo, và lỗi thứ ba vô hiệu hoá cả hai lỗi trước

1. **Ba lỗi đường ống, một triệu chứng.** `spawn` với `shell:true` nối tham số không escape (câu tiếng
   Việt vỡ); `--allowed-tools Skill` KHÔNG giới hạn gì (model đi `PowerShell` dò thư mục rỗng); stdin
   không chặn (chờ 3 giây mỗi lượt). Cả ba đều hiện ra thành *"model không gọi skill nào"*, và **không
   cái nào là lỗi định tuyến**. Lượt đầu ra 0/6, lượt hai 1/6.
2. **So hai mẫu số khác nhau rồi kết luận nhân quả.** Tôi lấy 38,6% (90 câu, thư mục rỗng) so với
   68,8% (20 câu, repo) và kết luận "ngữ cảnh làm nên khác biệt". Đối chứng cùng mẫu bác ngay: 20 câu ấy
   ở thư mục rỗng ra **75,0%**. Đã vá: `--gioi-han` nay in cảnh báo "ĐÂY LÀ MẪU", và dòng đó đi vào
   **cả file báo cáo**.
3. **Chạy song song, và đếm lượt hỏng thành kết quả.** Năm lượt quét 3 luồng cho 38,6% · 24,3% · 50,0% ·
   32,9% · **2,9%**. Lượt 2,9% có 68/70 ca "không gọi skill" — ngay sau đó một lượt đơn lẻ vẫn gọi đúng
   `load_check`, và 6 câu chạy tuần tự cho 5/5. Dụng cụ không phân biệt "model không gọi" với "lượt chạy
   hỏng". **Lỗi này làm cả năm con số trên đều không đọc được**, kể cả con số tôi từng dùng để kết luận
   ở mục 2 bên trên. Đã vá: đọc `result.subtype` và `is_error`, tách ô `KHÔNG CHẠY ĐƯỢC` ra khỏi mẫu số,
   hỏng quá 10% thì exit 2 "KHÔNG PHÁN ĐƯỢC", và mặc định `--song-song` đổi từ 2 xuống 1.

Đây đúng lớp hỏng cả kit đi chữa — *một lượt không đo được trả về thứ trông như một kết quả* — và lần
này nó nằm trong dụng cụ của chính tôi, sau khi tôi đã vá nó ba lần ở nơi khác.

Thêm một chỗ bắt được trước khi nổ: chế độ `--trong-repo` làm `goc` **là gốc repo**, mà dòng dọn cuối
script là `fs.rmSync(goc, { recursive: true, force: true })` — chạy một lần là **xoá sạch cây làm
việc**, cây đang có WIP của các phiên khác. Đã chặn bằng `if (!TRONG_REPO)`.

---

# SỐ ĐO SAU — Phần 3.2 (cắt phần luôn nạp)

Đo 05/11/2026 bằng `npm run token:session`.

| Khối | trước | sau | chênh |
|---|---|---|---|
| `CLAUDE.md` | 4,23 | **2,77** | −1,46 |
| hook SessionStart | 2,01 | **1,23** | −0,78 |
| description 28 skill | 7,28 | **5,23** | −2,05 |
| description 13 command | 2,03 | 2,03 | 0 |
| description 3 agent | 0,74 | **0,63** | −0,11 |
| **TỔNG luôn nạp** | **16,29** | **11,88 KB** | **−4,41 (−27%)** |

## Ba nhát cắt của bản chấm: ước so với đo

| | bản chấm ước | đo thật |
|---|---|---|
| gỡ danh sách skill khỏi hook | −2,2 | **−0,78** |
| mọi description ≤ 200 ký tự | −1,7 | **−2,16** (viết gọn lại, không cắt cụt; cắt cụt chỉ được −0,71) |
| `CLAUDE.md` mỗi điều ≤ 2 câu | −2,0 | **−1,46** |

## Đích < 10 KB — CHƯA ĐẠT, thiếu 1,88 KB

Đường cong đo được (giả định `CLAUDE.md` đã cắt): muốn xuống dưới 10 KB phải chặn description ở **110
ký tự**, tức **cắt cụt 38 trên 44 mô tả**. Ở 120 ký tự vẫn còn 10,13 KB.

Không cắt tới đó, vì nó đổi tiêu chí này lấy tiêu chí "Kích hoạt skill", và chính Luật nền của bản chấm
yêu cầu hoàn tác khi một phép đo chất lượng tụt. Mô tả command (2,03 KB) cũng không cắt thêm: chúng là
thứ NGƯỜI đọc để chọn lệnh `/…`, và cắt hết chỗ dư chỉ được ~0,4 KB — không tới đích.

## Nhát rút description có làm hỏng định tuyến không — KHÔNG, đo được

Xem mục 2.2 và [`ROUTE_LIVE.md`](ROUTE_LIVE.md): 4 lượt tuần tự, mô tả dài 68,6–70,0% so với mô tả
ngắn 64,7–73,5%. Hai dải chồng lên nhau hoàn toàn. Bộ chấm từ ngữ (`skills:route:check`) sau khi cắt
vẫn **96,7%** top-1, `none` kích hoạt nhầm **5%** (trần 10%), **0** ca chọn sai.

## Khoá kết quả

- `skills:lint` thêm luật **`descMaxChars: 200`**, CHẶN khi vượt. Đi cặp với `descMinChars: 80`.
- `alwaysOnMaxKB` chốt **12,6** = số đo 11,88 + 5% đệm. Ghi thẳng trong `prompt_budget.json` rằng đích
  dưới 10 **chưa đạt** và cái giá phải trả nếu muốn ép xuống. Không đặt 10, vì một ngưỡng đỏ ngay hôm
  đặt là tiếng ồn, và tiếng ồn thì bị tắt.

## Một sửa nội dung, ngoài phạm vi, vì nó là lỗi thật

`CLAUDE.md` mục 5 từng ghi *"Creds ở `profiles/<TASK>/task.env` (**KHÔNG** `.env` chung)"*. Câu đó đã
dẫn tới một kết luận sai ở phiên trước: `RULE_GLOBAL.md` và `profiles/task.env.example` đặt tài khoản
app dùng chung ở `.env`. Nay mục 5 ghi điều đã đo được: **mỗi profile phải tự ghim `QEMIS_CAP_HOC`**,
vì thiếu nó app lặng lẽ về "Mầm non" và lượt chạy vẫn XANH trên cấp sai.

Mục 3 từng chiếm **2028 trên 4336 byte** của `CLAUDE.md` — một bức tường gộp 8 luật. Phần chi tiết
chuyển sang `core_rules.md §Verify mở rộng`, **không bỏ luật nào**.

---

# SỐ ĐO SAU — Phần 3.3 và 3.4 (cắt phần nạp theo phase)

Đo 06/11/2026 bằng `npm run token:phase1`.

| | trước | sau |
|---|---|---|
| `run_phase1_template.md` | 31,3 | **11,3** |
| `phase1/01_setup_engine_fetch_docs.md` | 7,0 | 7,0 |
| `phase1/02_gen_testcases.md` | 51,1 | 51,1 |
| **TỔNG bắt buộc phase1** | **89,3** | **69,7 KB** (−22%) |

## Nhát cắt: dời khối "Prompt mẫu để chạy" (20,3 KB)

Khối này là mẫu cho **người** chép, điền placeholder rồi gửi cho agent — agent nhận bản **đã điền** qua
tin nhắn, nên không cần nạp bản mẫu mỗi lượt. Chuyển sang
`prompt_templates/phase1/references/prompt_mau_phase1.md`, khai ở `load_map.json` `co_dieu_kien`.

**Căn cứ dời, đo chứ không đoán:** tách khối thành 87 dòng chỉ dẫn, so tập từ khoá với phần CÒN LẠI của
`run_phase1` + `01_setup` + `02_gen` + `core_rules` + `RULE_GLOBAL`. Kết quả **82/87 dòng đã có ở nơi
khác**; 2 dòng "có thể riêng" chỉ là ô trống chờ điền URL (`[OPS_BASE_URL]`, `[LMS_BASE_URL]`).

**`gate:policy` bắt một luật thật bị mất:** lệnh `node scripts/convert_excel/md_to_xlsx.js` trước đây
**chỉ** được nhắc trong khối "Prompt mẫu". Dời khối đi là bước 7 (xuất Excel) mất đường vào từ điểm vào
duy nhất của phase. Đã thêm một dòng vào bảng "Gate bắt buộc" của `run_phase1_template.md`.

Đó là lý do phải có cửa: 82/87 trùng nghĩa là **5 dòng không trùng**, và một trong số đó là một bước
bắt buộc. Phép đo của tôi xếp nó vào nhóm "trùng" vì các từ khoá của nó có xuất hiện rải rác ở nơi khác.

## Đích ≤ 45 KB — CHƯA ĐẠT, thiếu 24,7 KB

Đo `02_gen_testcases.md` (51,1 KB) theo từng khối lớn hơn 1 KB:

| | KB |
|---|---|
| khối mang **LUẬT CHẶN** (`Kết quả mong đợi` · `Self-check vét cạn biên` · `Loại case` · `CHIỀU COVERAGE` · `Tiền điều kiện`…) | **27,2** |
| khối "có thể mở" | 16,4 |

Dời **hết** phần có thể mở vẫn còn **53,3 KB**, tức thiếu 8,3 KB so với đích. Cắt thêm là phải dời chính
luật chặn — và `rule:parity` **không gác `prompt_templates/`**, nên một luật mất ở đó sẽ không máy nào
bắt. Ngay nhát cắt vừa rồi đã suýt mất một bước bắt buộc, và chỉ `gate:policy` cứu được.

Nên dừng ở 69,7 KB. Ngưỡng `phaseMaxKB.phase1` chốt **73,2** (số đo + 5%), khoá thành quả −22%; ghi thẳng
trong `prompt_budget.json` rằng đích 45 chưa đạt và vì sao.

## Một lỗ đã đóng nhân lúc đo: hai bản sao không ai gác

Bảng 9 loại case tồn tại ở **hai** chỗ — `.agent/config/case_types.json` (5,7 KB, máy đọc) và bảng
markdown trong `02_gen_testcases.md` (6,0 KB, agent đọc). Đo 05/11: khớp từng chữ, **0 ô lệch** — nhưng
`case-type-gate.spec.ts` đọc file JSON mà **chưa bao giờ so với bảng trong prompt**. Sự khớp là **tình cờ**.

Triệu chứng nếu lệch: agent phân loại theo bảng cũ, `md_to_xlsx` chặn theo bảng mới, và một case bị từ
chối vì một loại "không tồn tại" trong khi prompt vừa dạy đúng loại đó — không ca nào đỏ để chỉ nguyên nhân.

Đã thêm 4 ca gác tên, thứ tự, nội dung ba trường, và `_decision_order`. **5 phép phá → 5 lần đỏ.**

Lượt phá đầu tiên trả **"0 failed · 0 passed"** cho cả 4 phép: đó là lượt **KHÔNG CHẠY** (playwright không
chạy nổi trong worktree tạm), không phải "phép phá không bắt được". Đã chuyển sang khuôn `mayThu` — trỏ
spec vào bản chép qua `CASE_TYPES_JSON` và `GEN_PROMPT_MD` — và thêm một nhánh in thẳng *"LƯỢT KHÔNG CHẠY
— không phải kết quả"* vào script phá hoại.
