# Chạy lần đầu

> Dựng kit trên máy mới, rồi chạy thử một task. Cần biết quy trình đầy đủ thì đọc
> [`USER_GUIDE.md`](USER_GUIDE.md).

## Cần có trước

| | |
|---|---|
| **Bắt buộc** | Node.js ≥ 20 và npm · Playwright runtime · IDE có AI agent đọc được workspace |
| **Bắt buộc** | Credential app test (`OPS_*`) cho môi trường dev hoặc staging |
| **Theo việc** | Token Backlog, tài liệu nguồn, Figma nếu Phase 1 cần fetch |
| **Tuỳ chọn** | k6 hoặc Docker, chỉ khi chạy load test. Thiếu thì lệnh tự skip sạch |
| **Tuỳ chọn** | Hai tài khoản khác quyền, cho ma trận phân quyền của `npm run security` |
| **Không cần** | DB credential. Workflow chuẩn không dùng, và không được dựng state bằng DB |

Google Drive dùng connector có sẵn trong phiên chat, không cần token riêng.

## Mười bước dựng

| # | Việc | Lệnh hoặc file |
|---:|---|---|
| 1 | Clone repo | `git clone <repo>` |
| 2 | Vào workspace | `cd <thư mục kit>` |
| 3 | Cài dependencies | `npm ci` — **không** dùng `npm install`, phải theo lockfile |
| 4 | Cài browser | `npx playwright install` |
| 5 | Tạo env local | Copy `.env.example` thành `.env` |
| 6 | Cấu hình MCP | Template ở `.agent/config/mcp_config.md`. File này mang endpoint riêng nên không đi theo gói, tự tạo |
| 7 | Khai ngữ cảnh dự án | `cp .agent/config/project_context.example.md .agent/config/project_context.md` rồi điền. **Chưa có thì `preflight` chặn** — cố ý, để kit không chạy trên ngữ cảnh trống |
| 8 | Khai risk model | `cp .agent/config/risk_model.example.json .agent/config/risk_model.json` rồi chỉnh Impact theo module |
| 9 | Bật hai hook | `.claude/settings.json` là file local nên **không đi theo clone**, tức hook đang tắt. Copy đoạn JSON trong `scripts/qa/hooks/README.md` vào đó rồi mở `/hooks` một lần |
| 10 | Tự kiểm | `npx playwright test tests/fe/infra` — bộ tự kiểm của kit, phải xanh hết trước khi dùng thật |

Kit có hai remote (GitHub và GitLab). Clone bên nào cũng được, số đo giống nhau. Chi tiết khác biệt:
[`docs/kit-map.md`](docs/kit-map.md).

## Kiểm đã dựng xong chưa

```bash
node -v && npx playwright --version
npm run integration:check
```

Rồi đối chiếu hai con số dưới đây với cây vừa clone. Số của bạn khác bảng này nghĩa là clone chưa đủ
hoặc đã lệch — tìm ra vì sao trước khi chạy task thật, đừng bỏ qua.

| Số đo | GitHub | GitLab |
|---|---|---|
| file được track | 976 | 976 |
| `npm run ci:scope` đếm | 194 | 194 |

Hai cột đang bằng nhau vì `.agent/config/gitlab_strip.json` chưa khai mục nào, tức hai cây còn giống
hệt nhau. Ngày nào danh sách strip có mục thì cột GitLab tụt đúng bằng số mục đó.

## Chạy thử một task

```text
/start <TASK_KEY>
```

`/start` hỏi năm điều, tạo `profiles/<TASK_KEY>/task.env` và `task.md`, chạy preflight, chỉ lệnh kế tiếp rồi
**dừng**. Nó không đọc đặc tả, không sinh case và không tự gọi `/phase2` — phase bắt đầu khi bạn tự gõ lệnh đó.

Mở file profile vừa tạo và điền **giá trị động**: link Backlog, link requirement, Figma,
`GOOGLE_SHEET_URL`, tài khoản app. Giá trị **tĩnh** dùng chung cho mọi task thì để ở `.env`.

Sau đó theo **bốn phase**, đúng thứ tự số trong tên lệnh:

```text
/phase1 <TASK_KEY>   chuẩn bị — gọi /start rồi /discover, dừng sau khi báo bản đồ hệ thống
/phase2 <TASK_KEY>   sinh testcase, dừng lại để bạn review
/phase3 <TASK_KEY>   execute, xác nhận trước lượt chạm môi trường đầu tiên
/phase4 <TASK_KEY>   chạy lại case của bug đã fix
/release <TASK_KEY>  cửa cuối: chạy cửa ra `done` rồi khuyến nghị go/no-go
```

Vừa chạy `/start` ở trên rồi thì `/phase1` chỉ còn phần `/discover`. Giữa hai số là hai lệnh chen
vào khi cần: `/publish` (đẩy Sheet, sau khi QA duyệt bộ case) và `/gates` (bó gate trước khi chốt).

Quên mã task thì `npm run task:which` in danh sách profile đang có để chọn. Không nhớ đang ở đâu thì
`npm run check` in dòng **Lệnh tiếp theo**.

Chi tiết từng bước: [`USER_GUIDE.md`](USER_GUIDE.md) mục 3.

## Thứ KHÔNG đi theo clone

| Thư mục | Sau khi clone | Hệ quả |
|---|---|---|
| `knowledge/` | chỉ có `SCHEMA.md` | **mất toàn bộ bộ nhớ học** |
| `profiles/` | chỉ có `task.env.example` | không có credential nào |
| `outputs/` | rỗng | không có kết quả task cũ |
| `.claude/settings.json` | không có | hai hook forcing-function tắt (bước 9) |
| bộ nhớ của agent | không có | nằm **ngoài repo hoàn toàn**, đọc mục ngay dưới |

`knowledge/` bị gitignore có chủ ý, vì mirror GitHub là public. Nhưng theo `knowledge/SCHEMA.md`, mấy
phần trong đó **không nạp lại được từ nguồn máy**: `domain/`, `system/`, `decisions/`,
`setup_recipes/`, `environment/`, `locators/` và `bug_tc_map.json` là công sức người ghi tay.

Máy mới cần dùng tiếp bộ nhớ đó thì máy cũ chạy `npm run knowledge:backup` (đích **ngoài** repo), bê
bundle sang rồi khôi phục. Phần nạp lại được thì `npm run learn:bugs:apply` (từ Backlog) và
`npm run learn -- --scan` (từ `test-results/`).

### Bộ nhớ của agent nằm ngoài repo

Ngoài `knowledge/`, agent còn một kho ghi nhớ riêng trong thư mục `.claude` ở home của bạn.
`npm run knowledge:backup` **không** chạm tới nó.

Chỗ dễ hiểu nhầm nhất: kho này khoá theo **đường dẫn thư mục làm việc**. Cùng một bộ kit đặt ở hai
thư mục khác nhau sẽ có hai kho riêng, không thấy nhau.

| Tình huống | Nhớ hay không |
|---|---|
| Task mới, vẫn chạy trong **cùng** thư mục | nhớ đủ |
| Clone sang thư mục khác, máy khác, hoặc chỉ đổi tên thư mục | bắt đầu từ 0 |

Muốn mang sang máy mới thì chép tay thư mục `memory/` đó. Kho bỏ lâu không dùng thì nên bỏ thay vì
chép: nó giữ nguyên hiểu biết đã hết hạn và không có cơ chế tự hết hạn.

## Giữa hai phase thì dọn ngữ cảnh

Đọc bàn giao ở `handoff/<phase>.md` rồi `/clear`.

Đo trên 4 lượt task thật: context trung bình mỗi message là 494 đến 515 nghìn token, và cache-hit
98,5% nghĩa là nó được đọc lại ở **mọi** message. Giữ một phiên cho cả hai phase là bắt phase sau trả
tiền cho hội thoại của phase trước.
