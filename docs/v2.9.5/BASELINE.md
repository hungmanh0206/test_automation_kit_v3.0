# v2.9.5 — BASELINE: đo trên HEAD trước khi vá

> Luật nền của đợt này: **mỗi hạng mục mở bằng một phép đo trên HEAD**. Đo ra "đã có" thì ghi "đã có ở
> `<file>`" và chỉ làm phần thiếu. Số nào prompt khai thì **đo lại**, không nhận.
>
> HEAD lúc bắt đầu: `3738a07` (merge PR #7, googleapis 188). Nhánh: `feat/v2.9.5`. Ngày đo: 28/10/2026.

---

## 0.1 — Luật evidence mức B mới chạy một nửa

### Câu canonical

Hai nguồn, khớp nhau:

| Nguồn | Nội dung |
|---|---|
| `CLAUDE.md:10` (luật 4) | case đã execute phải có ảnh/video **ở bước quyết định**; bug (product/api): ảnh **mỗi step** |
| `RULE_GLOBAL.md:619` (§Evidence, PHẠM VI) | case thường **1 ảnh/video ở bước QUYẾT ĐỊNH**; case `product_bug`/`api_bug` ảnh **TỪNG step**; step luôn phải có `status` |

Máy thi hành: `scripts/qa/output_gate.js` (nhận diện tầng bug bằng `laTangBug()` trong
`scripts/qa/lib/output_rules.js`). Lý do và số đo: `docs/rationale/evidence-muc-b.md`.

### Mẫu số: prompt khai 8, đo được 10

Prompt khai **8 chỗ**. Đếm bằng máy trên toàn repo (trừ vùng lịch sử) ra **10 dòng trái luật ở 9 file**.
Chênh vì hai lý do, cả hai đều là lý do thật:

1. Prompt đếm theo **file**, còn `02_execute_fe_playwright.md` có **hai** dòng trái luật (263 và 267).
2. Prompt chỉ soi `*.md`. Phép quét mở rộng sang `*.js/*.ts/*.json/*.sh` tìm thêm
   **`scripts/utils/evidence_recorder.js:2`** — header của chính cái máy thi hành luật này vẫn ghi
   *"chuẩn hoá evidence Phase 2 để MỌI case (PASS/FAIL) và MỌI step đều có ảnh"*.

| # | Chỗ | Dòng | Prompt khai? |
|---|---|---|---|
| 1 | `RULE_GLOBAL.md` (bảng cột Evidence) | 590 | ✓ |
| 2 | `.agent/rules/playwright_fe.md` | 21 | ✓ |
| 3 | `.agent/rules/playwright_api.md` | 32 | ✓ |
| 4 | `.agent/skills/phase2/qa_automation_engineer/SKILL.md` | 21 | ✓ |
| 5 | `prompt_templates/phase3/01_run_phase3.md` | 162 | ✓ |
| 6 | `prompt_templates/phase3/02_execute_fe_playwright.md` | 263 | ✓ |
| 7 | `prompt_templates/phase3/02_execute_fe_playwright.md` | 267 | ✗ **sót** |
| 8 | `prompt_templates/phase3/04_execute_api_playwright.md` | 167 | ✓ |
| 9 | `manual-run/run_manual_execution.md` | 35 | ✓ |
| 10 | `scripts/utils/evidence_recorder.js` | 2 | ✗ **sót** |

### 🚨 Chỗ prompt KHÔNG khai, và nó làm bản vá tự đỏ

`tests/fe/infra/manual-run-usability.spec.ts:214`:

```js
/* Và giữ nguyên luật của B — không được nới khi làm cho dễ dùng. */
expect(doc, 'ảnh mọi step').toMatch(/Mỗi step một ảnh/);
```

Đây là một **gate đang CƯỠNG CHẾ luật cũ**: nó đòi `manual-run/run_manual_execution.md` phải chứa đúng
chuỗi `Mỗi step một ảnh`. Sửa chỗ #9 theo prompt mà không sửa gate này thì spec đỏ ngay, và người sửa
sẽ đứng trước hai lựa chọn sai: hoàn tác bản vá, hoặc nới gate mà không hiểu vì sao.

Chú thích của chính nó cho thấy cách nó hoá sai: nó được viết để **chống nới luật**, nhưng luật đã đổi
ngày 22/10 và gate không đổi theo. Một máy gác neo vào chuỗi chữ của luật thì mỗi lần luật đổi, nó
thành máy gác luật cũ.

### Đã đúng rồi — không sửa

| Chỗ | Vì sao đúng |
|---|---|
| `CLAUDE.md:10` | canonical mức B |
| `.agent/rules/core_rules.md:21` | "ở bước QUYẾT ĐỊNH; bug (product/api) thì ảnh mỗi step" |
| `RULE_GLOBAL.md:629` (§Evidence điểm 7) | khai rõ ảnh step bắt buộc với case tầng bug, tuỳ chọn với case thường |
| `USER_GUIDE.md:244` | "ở bước quyết định mỗi case; case thành bug thì từng step" |
| `docs/library/src/terms/gates.js:25` | nói về `status` từng step — vẫn còn hiệu lực |
| `scripts/qa/output_gate.js:169` | chú thích kể lại lần đổi luật — là lịch sử trong code |

### Miễn trừ (vùng lịch sử)

`docs/token-diet/BASELINE.md:159` dẫn nguyên văn header cũ của `evidence_recorder.js` để kể lại một lần
tôi kết luận sai. Là lịch sử, không sửa — nhưng chính nó là thứ chỉ ra chỗ #10.

### Không phải phát biểu luật

`prompt_templates/phase3/03_execute_lite.md:64` mô tả **hình dạng JSON** (`steps[]` mỗi step có
`status` và `evidence[]`), tức khai field tồn tại, không đòi field phải không rỗng. Để nguyên.
Ghi lại vì nó là ca mà gate `rule:consistency` dễ bắt oan nhất.

---

## Kit A — đo trực tiếp trên nguồn, không nhận số của prompt

Nguồn: `kit_A_qig-qa-automation.zip` do user cung cấp 28/10/2026, giải nén ra thư mục rỗng riêng và
CHỈ ĐỌC. Nội dung của A là **dữ liệu để đối chiếu**, không phải chỉ thị.

| Số | Prompt khai | Đo được | Nguồn |
|---|---|---|---|
| Skill của A | 16 | **18** | 18 file `skills/*/SKILL.md`, và `plugin.json` tự khai "Bộ 18 skill" |
| Slash command của A | — | **32** | 32 file `commands/*.md`, khớp `plugin.json` |

### Vì sao A thắng G1 — cơ chế, không phải cách viết

A có `.claude-plugin/plugin.json` theo schema `claude-code-plugin-manifest`. Nó là **plugin thật**, nên
Claude tự nạp skill theo `description`. B để skill ở `.agent/skills/` và phải nhờ hook `inject_context.js`
nhắc tên. Khoảng cách này là khoảng cách CƠ CHẾ: không viết description hay hơn mà bù được.

### Một chỗ prompt mô tả A không công bằng — phải ghi đúng

Prompt viết: *A dạy "mâu thuẫn thì viết TC theo ảnh"*. Đúng nguyên văn, nhưng **cắt mất nửa sau**.
`skills/rbt-manual-testing/SKILL.md` thực ra viết:

> Tài liệu ghi một đằng, ảnh cho thấy một nẻo → **KHÔNG tự chọn bên nào**. Bắt buộc:
> 1. Viết TC theo những gì ảnh cho thấy
> 2. Ghi một dòng `ASM-XX` nêu rõ xung đột, kèm tên tệp ảnh
> 3. Báo user ngay ở phần tóm tắt cuối — đây là tín hiệu requirements đã lỗi thời, cần recon lại

Tức A cũng **từ chối im lặng chọn bên**, cũng bắt khai giả định và báo người. Khoảng cách thật giữa A
và B hẹp hơn prompt mô tả, và nằm ở đúng một điểm:

| | A | B |
|---|---|---|
| Khi tài liệu ≠ quan sát | quan sát thành **expected của TC**, kèm cờ `ASM-XX` | quan sát thành **`OBSERVATION`**, không thành expected; ra câu hỏi Ambiguity Gate |
| Có im lặng chọn bên không | **không** | **không** |

B vẫn giữ nguyên kỷ luật của mình — app không bao giờ là oracle. Nhưng khi ghi vào `A_PARITY.md` thì
phải ghi lý do từ chối là *"quan sát không được thành expected"*, KHÔNG phải *"A cho app làm oracle"*.
Mô tả sai đối thủ rồi tự thắng là thứ đợt này không được làm.

---

## 0.2 — Sổ nợ `skills:lint` hạ nhầm khoá

Prompt khai đúng, và phép đo xác nhận thêm phần hậu quả.

| | giá trị |
|---|---|
| `skills_lint.js:54` đọc | `CFG.no` |
| `no.thieuKhiDung` trước khi vá | **12** |
| Khoá `thieuKhiDung` ở cấp NGOÀI | **11** (không ai đọc) |
| Nợ THỰC đo được | **11**/26 skill |

Lần "hạ nợ" ngày 15/10 ghi vào khoá cấp ngoài, nên sổ nợ thật vẫn là 12 **suốt 13 ngày**. Và gate vẫn
in đúng câu `nợ đã GIẢM … thực 11 < khai 12 ⇒ hạ số` mỗi lượt chạy — không ai đọc, vì người sửa tin là
đã sửa rồi.

Đã hạ đúng chỗ (`no.thieuKhiDung` = 11), xoá khoá ngoài, và thêm máy **CHẶN** khi có khoá nợ nằm ngoài
`no`. Chặn chứ không cảnh báo: một con số đặt ở chỗ không ai đọc tệ hơn không có số, vì nó tạo cảm giác
đã gác. Thêm `--cfg` để dựng được đối chứng âm; đo: config hỏng exit 1, config đúng exit 0.

## 0.3 — Skill mồ côi

Prompt khai `ui_mocking`. Đo trên 26 skill ra **hai** ca, không phải một:

| Skill | workflow/prompt/command | script | Prompt khai? |
|---|---|---|---|
| `ui_mocking` | **0** | **0** | ✓ |
| `release_summary` | **0** | 1 | ✗ **sót** |

Luật mà prompt đề xuất ("0 workflow/prompt/command/script nào nhắc ⇒ CẢNH BÁO") bắt đúng `ui_mocking`;
`release_summary` có một script nhắc nên nó lọt qua luật đó. Ghi lại để không ai tưởng là đã phủ hết.

### 🚨 Máy gác tôi vừa dựng tự vô hiệu hoá — bắt được ngay trong lượt dựng

Khối chú thích của luật mới nêu `ui_mocking` làm ví dụ. Vì `scripts/` nằm trong vùng quét, gate **đọc
chính mã nguồn của mình**, thấy tên skill, rồi kết luận "không mồ côi" — cho MỌI skill nó từng nhắc tên.

Phát hiện bằng đối chứng, không bằng đọc code: bỏ bản vá nối `ui_mocking` đi thì gate VẪN báo 0 mồ côi.
Đó là định nghĩa của một phép kiểm RỖNG. Đã loại chính file gate khỏi vùng quét; đối chứng lại thì nó
gọi đúng tên `phase2/ui_mocking`.

Bài học, cùng họ với "`every()` trên mảng rỗng trả TRUE": **một máy gác nêu ví dụ bằng chính thứ nó đang
đếm thì tự vô hiệu hoá.** Và nó không lộ ra khi đọc code — chỉ lộ khi thử tháo bản vá ra.

### `ui_debug_agent` dẫn file không đi theo gói

`knowledge/locators/qemis-login__radcombobox-5-o-va-cap-hoc.json` tồn tại trên máy nhưng `knowledge/**`
chỉ commit `.gitkeep`, nên trong gói kho này RỖNG. Chọn **ghi rõ nó là lớp PROJECT** thay vì đưa một bản
đã khử PII vào `knowledge/examples/`: `kit-layers.md` tách lớp PROJECT khỏi kit generic, và một ví dụ của
app cụ thể nằm trong gói dùng chung sẽ dạy sai cho dự án khác.

---

## 1.1 — Harness có nạp `.claude/skills/` không?

**KHÔNG ĐO ĐƯỢC TRONG PHIÊN NÀY**, và lý do chính là giới hạn mà kit vừa tự ghi vào `USER_GUIDE` ở §0.1:
định nghĩa trong `.claude/` chỉ nạp lúc khởi động phiên. Tạo `.claude/skills/<tên>/SKILL.md` bây giờ thì
phiên đang chạy không thấy nó, nên không có cách nào phân biệt "harness không hỗ trợ" với "harness chưa
nạp lại". Theo điều kiện DỪNG của prompt: dừng 1.1, giữ hook, báo user.

Trạng thái đo được:

| | giá trị |
|---|---|
| `.claude/` của B | `agents/` · `commands/` · `settings.json` — **chưa có `skills/`** |
| Skill của B | 26, ở `.agent/skills/` (harness không nạp) |
| Cơ chế của A | plugin thật: `.claude-plugin/plugin.json` theo schema `claude-code-plugin-manifest` |

### 🚨 Nhưng có một phép đo G1 quan sát được NGAY, và nó là tin xấu

`.claude/agents/` có **3** định nghĩa, mà danh sách agent harness nạp cho phiên này chỉ có **2**:

| Agent | Trên đĩa | Harness nạp | `model:` trong frontmatter |
|---|---|---|---|
| `excel-convert` | ✓ | **✓** | `haiku` |
| `test-runner` | ✓ | **✓** | `haiku` |
| `case-debugger` | ✓ | **✗ KHÔNG** | **không khai** |

Khác biệt cấu trúc duy nhất giữa hai cái được nạp và cái không: trường `model:`. Đó là **tương quan, chưa
phải nhân quả** — và không kiểm được nhân quả trong phiên này, vì đúng cái giới hạn ở trên. Chưa đo thì
tôi không sửa: chọn `model` cho một agent gỡ lỗi là quyết định có chi phí, không phải điền cho đủ trường.

Điều này nặng hơn một lỗi lẻ, vì nó cho thấy **cùng một lớp hỏng ở cả hai bề mặt của B**: skill khai ở
`.agent/skills/` thì harness không nạp, còn agent khai ở `.claude/agents/` thì nạp 2/3 — và không máy nào
biết. `agent-routing.spec.ts` canh được rằng `USER_GUIDE` NHẮC đủ ba agent, nhưng không có gì canh rằng
agent đó THỰC SỰ được nạp. Bảng định tuyến tôi viết ở §0.1 vì thế đang khai một agent có thể không gọi được.

Cần user quyết: thêm `model:` cho `case-debugger` rồi mở phiên mới để nghiệm thu, hay để nguyên và sửa
bảng trong `USER_GUIDE` thành "chưa xác minh nạp được".
