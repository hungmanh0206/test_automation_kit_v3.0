---
name: git_impact_analyzer
description: "ĐẦU VÀO LÀ GIT DIFF. Vừa sửa code và cần biết thay đổi đó làm vỡ bề mặt nào: đọc diff của branch/PR, xếp file đã đổi vào 7 bề mặt dùng chung. Suggest-only."
---

# Git Impact Analyzer

## Dùng khi nào

Dùng khi **đã có thay đổi code cụ thể** và câu hỏi là *"sửa chỗ này thì vỡ cái gì"*. Đầu vào bắt
buộc là `git diff` của branch hoặc PR gắn `TASK_KEY`. Nó cấp **dữ liệu diff thật** làm input cho
Bước 1 mục 17, thay cho việc đọc code rồi đoán.

**KHÔNG dùng** khi chưa có thay đổi nào và bạn chỉ muốn tra danh mục bề mặt đã chốt — việc đó là
của [`system_mapper`](../../shared/system_mapper/SKILL.md), và nó tra được **mà không cần diff**.
Hai skill này từng bị lẫn đúng ở câu *"sửa chỗ này thì vỡ bề mặt nào"*; ranh giới là **đầu vào**,
không phải chủ đề.

## Purpose

Biến thay đổi code thật (git diff) thành danh sách **bề mặt dùng chung bị đụng** — input trực tiếp
cho **Bước 1 của mục 17 (Change Impact / Regression Ripple)** — nay ở `prompt_templates/phase2/dimensions/17_change_impact.md` — trong
`prompt_templates/phase2/03_gen_testcases.md`. Giúp agent không phải đọc toàn bộ code để đoán bề mặt
chung; thay vào đó bắt đầu từ diff thực tế rồi mới suy feature bị ảnh hưởng.

Bổ trợ cho `requirements_analyzer` (nhận diện impact từ requirement/artifact) bằng góc nhìn từ **code
đã đổi**.

## Mức tự chủ: Suggest-only

- Chỉ **liệt kê + phân loại + gợi ý** feature nghi ảnh hưởng. KHÔNG tự thêm/bớt testcase, KHÔNG tự
  quyết regression scope.
- Feature nghi ảnh hưởng mà không tự xác minh được → giữ nguyên câu `Nghi ảnh hưởng — QA confirm`,
  đúng tinh thần mục 17 hiện tại. KHÔNG bịa impact, KHÔNG im lặng bỏ qua.

## Inputs

| Input | Nguồn / mặc định |
|---|---|
| TASK_KEY | Context task |
| Branch/PR của task | Branch hiện tại, hoặc nhánh feature gắn TASK_KEY |
| Base ref | **Mặc định `main`** (so `git diff main..<branch>`); đổi nếu project dùng base khác |
| Project context | `.agent/config/project_context.md` (map path → module) |
| Learning data (optional) | `knowledge/bugs/` theo module — gợi ý module từng hay bug (risk hint) |

## Workflow

1. Lấy diff: `git diff --name-status <base>..<branch>` (mặc định `<base>=main`). Nếu không xác định
   được branch/PR → ghi `N/A: no diff available` và dừng (không bịa thay đổi).
2. Map mỗi file thay đổi → module nghiệp vụ (theo path convention + `project_context.md`).
3. Phân loại mỗi thay đổi vào **7 bề mặt dùng chung** của mục 17:
   - Data/entity/field chung (thêm field, đổi kiểu/default, migration).
   - Endpoint/API chung (đổi payload/response/status code).
   - Component/validation/business rule/util dùng lại.
   - Status/enum chung.
   - Calculation/aggregate/report chung nguồn.
   - Permission/role/guard chung.
   - Job/trigger/event/queue/cron chung.
4. Suy feature KHÁC phụ thuộc bề mặt đó (từ code/testcase cũ/coverage map). Cái không suy được →
   flag `Nghi ảnh hưởng — QA confirm`.
5. (Optional) Đối chiếu `knowledge/bugs/` theo module: nếu module đụng tới từng có bug lịch sử, ghi
   chú làm risk hint (Suggest-only — không tự nâng priority).
6. Ghi output `git-impact.md`; nếu diff không đụng bề mặt chung nào → ghi `N/A: no shared surface`.

## Outputs

| Output | Vị trí |
|---|---|
| Bảng Change Impact từ diff | `<TASK_OUTPUT_DIR>/requirements/git-impact.md` |

Format bảng:

```markdown
| File thay đổi | Module | Bề mặt dùng chung | Feature nghi ảnh hưởng | Ghi chú |
|---|---|---|---|---|
| src/report/timezone.ts | Report | Calculation/report chung | Export Report, Dashboard | risk hint: Report từng có bug timezone (knowledge/bugs) |
| src/user/dto.ts | User | Data/entity (thêm field) | List User, Export User | Nghi ảnh hưởng — QA confirm |
```

## Decision Rules

- Base ref mặc định `main`; nếu repo dùng `develop`/PR base khác, dùng ref đó và ghi rõ trong output.
- Chỉ phân loại theo bằng chứng trong diff; suy đoán feature phụ thuộc luôn kèm mức chắc chắn hoặc flag QA.
- Không đọc toàn bộ source; chỉ mở file trong diff + tra coverage map/testcase cũ liên quan.
- Output là **input cho mục 17**, không thay thế mục 17: agent vẫn tự quyết regression smoke theo mục 17 Bước 3.

## Constraints

- Không tự sinh/sửa testcase; chỉ tạo `git-impact.md`.
- Không bịa thay đổi khi không có diff — ghi `N/A: no diff available`.
- Không ghi secret/diff chứa credential vào output.
- Không hardcode module/domain cụ thể vào skill chung.

## Anti-Patterns

- Suy diễn impact khi diff không đụng bề mặt chung (phải ghi `N/A: no shared surface`).
- Nhân full-suite regression cho mọi file đổi (mục 17: regression là SMOKE, theo tỉ lệ).
- Bỏ qua feature nghi ảnh hưởng thay vì flag `QA confirm`.
- Coi output của skill là quyết định cuối thay vì gợi ý cho QA/mục 17.

## Related

- Neo vào: `prompt_templates/phase2/03_gen_testcases.md` mục 17 (Bước 1), workflow
  `.agent/workflows/05_generate_testcases.md`.
- [[requirements_analyzer]] — nhận diện impact từ requirement/artifact; skill này bổ sung góc nhìn từ diff.
- `learning_recorder` — nguồn `knowledge/bugs/` cho risk hint theo module.

## Dùng khi · KHÔNG dùng khi

| | |
|---|---|
| **Dùng khi** | Task có code thay đổi và cần biết diff chạm **bề mặt dùng chung nào** trước khi chọn vùng regression · trước Bước 1 mục 17, để vùng chọn dựa trên diff THẬT chứ không dựa trên trí nhớ về module |
| **KHÔNG dùng khi** | Chưa có branch/PR mang `TASK_KEY` — không có diff thì nó không có đầu vào, đừng đoán · Task chỉ đổi tài liệu hoặc testcase · Cần **xếp hạng** độ rủi ro để chia độ sâu ⇒ `risk_scorer`; skill này chỉ nói "diff chạm những chỗ này", nó KHÔNG chấm điểm và KHÔNG chọn case |

**Câu kích hoạt mẫu:** "branch này sửa những gì" · "diff của PR chạm vào đâu" · "thay đổi này ảnh hưởng module nào" · "cần regression chỗ nào sau commit này"

> **KHÔNG có máy kiểm vì** đầu ra là một danh sách bề mặt để người đọc rồi quyết định, không có mốc nào
> để máy so. Chấm "chọn vùng regression đúng chưa" cần biết bug về sau nằm ở đâu — thứ chỉ có ở tương lai.
> Phần đo được đã có máy khác gác: `npm run ci:scope` canh phạm vi chạy, `npm run trace:matrix` canh
> REQ→TC→AUTO→EXEC→BUG.
