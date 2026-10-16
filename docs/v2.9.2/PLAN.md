# v2.9.2 — THIẾT KẾ (dừng xin duyệt trước khi code)

> Mọi con số dưới đây đo trên HEAD `cf50d1b` (version 2.9.1), ngày 16/10/2026, bằng script — không ước lượng.

---

## 0. Kiểm lại HEAD: lỗ nào còn, lỗ nào đã hết

Phần "Hiện trạng" của prompt đo trên **2.9.0**. Đo lại trên HEAD: **ba lỗ đã đóng, một lỗ sai tiền đề,
hai lỗ còn thật** — và việc đo lại lòi ra **ba chỗ prompt không biết**, trong đó một chỗ đủ sức làm hỏng
cả khối A nếu code theo đúng chữ.

| # | Prompt nói | Đo trên HEAD | Kết luận |
|---|---|---|---|
| H2.1 | `GATES.md` thiếu **3** dòng gate, `gates:index:check` ĐỎ | ở cây sạch tại HEAD: **exit 0** — 134 gate, bảng khớp source | **ĐÃ XONG** (v2.9.1 vá, thực tế thiếu **12** dòng chứ không phải 3) |
| H2.2 | `npm ci` gãy khi chặn `cdn.sheetjs.com` | `package.json` khai `file:vendor/xlsx-0.20.3.tgz`, tarball 2,3 MB có trong repo; `release:verify` chạy `npm ci` trong thư mục sạch không `.git` → ĐẠT | **ĐÃ XONG** (v2.9.1) |
| H2.3 | 20 test đỏ Linux, **nghi** do import lệch hoa-thường | quét **471** đường import tương đối: **0 đường lệch**. Nguyên nhân thật đã tìm và vá ở v2.8.3: `db_query.js` `require()` thẳng file `.ts` mà Node 20 không bóc kiểu, cộng 2 test ghim giả định **có ổ đĩa** | **TIỀN ĐỀ SAI** — xem §3 |
| H1 | "chỉ chạy một cấu hình Chromium, chưa có tầng đa trình duyệt" | `playwright.config.js` **đã có** lane `CROSS_BROWSER=1` (firefox-desktop + webkit-desktop) và 2 project mobile (`iphone-13`, `pixel-7`). Cả 3 engine đã cài | **SAI MỘT PHẦN** — thiếu *bộ chạy ma trận + bảng ô đỏ*, không thiếu project |
| A1 | Ambiguity Gate là forcing-instruction, không phải code-gate | **đúng**: 0 script nào đọc `AMBIGUITY_GATE` rồi `exit 1`. `discover.js` chỉ *ghi* dòng đó vào file câu hỏi | **CÒN THẬT** |
| A2 | `RESOLVED` do người tick, không ai kiểm | **đúng**: không máy nào đối chiếu với `phase1-clarifications.md` | **CÒN THẬT** |

### Ba chỗ prompt không biết (đo được, và chúng đổi thiết kế)

**① `RESOLVED` không phải một trạng thái — thực tế có BA, và hai cái CHỨA chuỗi `RESOLVED`.**

Đọc 5 task thật trong `outputs/`:

| Task | Giá trị nguyên văn | Có case? |
|---|---|---|
| CSDL-3544 | `**AMBIGUITY_GATE: PARTIALLY RESOLVED**` — Q3, Q4 vẫn PENDING | có |
| CSDL-9001 | `## AMBIGUITY_GATE: RESOLVED (25/09/2026)` | có |
| CSDL-9002 | `**AMBIGUITY_GATE: PARTIALLY RESOLVED**` | có |
| CSDL-9003 | `\| **AMBIGUITY_GATE** \| **RESOLVED** (25/09/2026) \|` | có |
| CSDL-9004 | `**AMBIGUITY_GATE: RESOLVED-BY-DEFAULT**` — QA chốt chạy theo assumption mặc định | có |

Hệ quả, cả hai chiều đều hỏng nếu viết ngây thơ:

- kiểm bằng `includes('RESOLVED')` ⇒ **`PARTIALLY RESOLVED` và `RESOLVED-BY-DEFAULT` lọt qua im lặng**.
  Đây là dạng hỏng tệ hơn: gate xanh mà không gác gì, đúng lớp lỗi "không chạy mà báo đạt".
- kiểm bằng `=== 'RESOLVED'` ⇒ **chặn ngay 3/5 task đang chạy** (3544, 9002, 9004), trong đó 9004 đã có
  quyết định của QA hẳn hoi.

`PARTIALLY RESOLVED` và `RESOLVED-BY-DEFAULT` **không được định nghĩa ở bất kỳ đâu** trong `.agent/`,
`prompt_templates/` hay `docs/` — chúng là trạng thái tự phát, sinh ra vì công việc thật cần chúng.

**② Dòng khoá có BỐN hình dạng khác nhau trên 5 task.** Bold inline · tiêu đề `##` · ô bảng markdown ·
bold kèm hậu tố. Một regex một-khuôn sẽ đọc trượt ít nhất một task, và đọc trượt ở đây nghĩa là
"không thấy khoá" — mà prompt lại bảo coi "không khai" là **chặn**.

**③ `phase1-clarifications.md` đang có HAI đường dẫn trong kit.** Thực tế trên đĩa: **5/5 task** dùng
`reports/`, **0** dùng `requirements/`. Nhưng `.agent/config/gate_codes.json` và
`.agent/workflows/phase1_000_system_discovery.md` vẫn ghi `requirements/`. Gate A2 đọc nhầm nhánh thì
nó **không thấy file**, và "không thấy file" rất dễ bị cho qua.

---

## 1. Khối H1 — ma trận trình duyệt (làm phần CÒN THIẾU, không làm lại phần đã có)

**Không thêm project mới.** Lane cross-browser đã có và đã đúng. Thiếu là *bộ chạy + bảng ô đỏ*.

### `.agent/config/browser_matrix.json`

```jsonc
{
  "_doc": "Ma trận smoke đa trình duyệt. OPT-IN: không chạy trong lane PR, không vào mỗi task.",
  "_gia_lap": "Playwright là GIẢ LẬP THIẾT BỊ. WebKit là nhân Safari, KHÔNG phải iPhone thật.",
  "project": ["chromium-desktop", "webkit-desktop", "firefox-desktop"],
  "kich_thuoc": [
    { "ten": "1920x1080", "w": 1920, "h": 1080 },
    { "ten": "1366x768",  "w": 1366, "h": 768 },
    { "ten": "390x844",   "w": 390,  "h": 844 }
  ],
  "_mac_dinh_tat": true
}
```

### `npm run smoke:matrix` (`scripts/qa/reuse/smoke_matrix.js`)

- Gọi lại `smoke_run.js`, **không viết bộ chạy thứ hai**. Ba lớp chặn của nó (không có gốc URL thì
  DỪNG · lớp sâu đòi cờ gõ tay · `--workers=1`) được giữ nguyên, không bắc cầu qua.
- Chạy `project × kich_thuoc`, gom `reports/browser-matrix.md`: hàng = màn × vai trò, cột = project ×
  kích thước, ô = `PASS` / `FAIL` / `▢` (không chạy).
- **`▢` là hạng công dân thứ nhất.** Một ma trận mà ô không chạy trông giống ô xanh thì nó nói dối theo
  đúng kiểu `full:suite` từng nói dối trước v2.9.1. Báo cáo in tổng ba loại ô, không chỉ in số đỏ.
- Báo cáo **bắt buộc** mang câu: *"Playwright là giả lập thiết bị. WebKit là nhân Safari, không phải
  thiết bị thật."* — có test grep chặn mọi câu kiểu "đã test trên iPhone".

### Đối chứng (test, chạy trên fixture offline)

| | |
|---|---|
| DƯƠNG | một ô cố ý vỡ **chỉ ở WebKit** ⇒ đúng **một** ô đỏ, project khác xanh |
| ÂM | fixture lành ⇒ 0 ô đỏ |
| ĐẾM | ô `▢` phải được đếm và in, không lặng lẽ thành xanh |
| CHỮ | báo cáo có câu "giả lập"; grep chặn "thiết bị thật"/"iPhone thật" |

---

## 2. Khối H2 — còn đúng **một** việc

H2.1 và H2.2 **đã xong ở v2.9.1**, không làm lại. Còn lại:

**Chốt tiền-đẩy cho `gates:index:check`.** v2.9.0 ra mắt khi cửa này đỏ, và v2.9.1 **suýt lặp lại** —
cây làm việc trả "KHÔNG PHÁN ĐƯỢC" vì file WIP, chỉ worktree sạch tại HEAD mới chặn. Nên chốt phải đo ở
**cây sạch**, không đo tại chỗ:

- thêm `npm run predeploy` chạy `gates:index:check` **trong worktree sạch tại HEAD** rồi mới cho đóng gói;
- nối vào `release.yml`;
- đối chứng: cố ý xoá một dòng `GATES.md` ⇒ chốt phải CHẶN.

---

## 3. H2.3 — tiền đề sai, nên đổi việc chứ không bỏ việc

Prompt bảo "sửa import lệch hoa-thường, chạy lại `full:suite` báo số đỏ trước/sau". **Không sửa được gì,
vì không có gì lệch**: 0/471 đường import. Và 20 test đỏ Linux đã vá từ v2.8.3 với nguyên nhân khác hẳn.

Báo "đã sửa, đỏ giảm từ 20 về 0" sẽ là **gán công cho một việc không làm gì**.

Việc còn đáng làm là **cửa chống tái phát** — rẻ, và lớp lỗi này có thật trên Linux:

- `npm run case:paths`: so mọi đường import tương đối với tên file thật **theo đúng hoa-thường**;
- nối vào `check` T0;
- đối chứng hai chiều trên cây giả: tạo `./Foo` trỏ `foo.js` ⇒ **FAIL**; sửa đúng ⇒ **xanh**;
- báo cáo ghi thẳng: **hôm nay 0 vi phạm** — cửa này là *phòng*, không phải *chữa*.

---

## 4. Khối A — thiết kế lại quanh ba trạng thái có thật

### A0 (mới, bắt buộc làm trước): chốt một nguồn

1. **Hợp thức hoá ba trạng thái** vào `.agent/config/ambiguity_states.json` — một nguồn, kèm nghĩa và
   nghĩa vụ của từng trạng thái. Không tự bịa trạng thái mới; chỉ ghi lại thứ công việc thật đã dùng.
2. **Sửa 2 tài liệu ghi sai đường dẫn** clarifications (`requirements/` → `reports/`).

| Trạng thái | Nghĩa | Cho sinh case? | Nghĩa vụ |
|---|---|---|---|
| `PENDING` | còn câu chưa giải, chưa ai chốt | **KHÔNG** | — |
| `RESOLVED` | mọi câu Critical/High đã có câu trả lời | có | A2 kiểm toàn vẹn |
| `PARTIALLY RESOLVED` | còn câu mở, nhưng **đã khoanh câu nào mở và nó chặn gì** | có | mỗi câu còn mở phải ghi rõ **chặn phase nào** |
| `RESOLVED-BY-DEFAULT` | QA chốt chạy theo assumption mặc định | có | phải có **người + ngày** |

Ba trạng thái sau đều hợp lệ, nhưng **mỗi cái gánh một nghĩa vụ khác nhau** — đó mới là chỗ gate có răng,
chứ không phải chỗ "bằng chữ RESOLVED hay không".

### A1 — `npm run ambiguity:gate` (`scripts/qa/ambiguity_gate.js`)

Đọc `task.md`, **khớp theo khoá chứ không theo khuôn dòng** (bốn hình dạng đã đo ở §0②): lấy chuỗi sau
`AMBIGUITY_GATE`, bóc `**`, `##`, `|`, rồi so với danh sách trạng thái trong config.

- trạng thái **không có trong config** ⇒ CHẶN, in ra giá trị đọc được (chống cả lỗi gõ lẫn trạng thái mới
  chưa ai khai);
- `PENDING` + đã có file case ⇒ **CHẶN** (sinh case qua cổng chưa mở);
- **thiếu hẳn khoá** + đã có case ⇒ xem §6 (chế độ di trú), không chặn ngay;
- chưa có case ⇒ không chặn (chưa tới lúc).

Nối vào: đầu `phase1_02_generate_testcases` · `check` T0 · preflight Phase 1. Hai tầng như gate khác:
chưa có discovery/clarifications thì **cảnh báo "chưa được gác"**, có rồi thì chặn.

### A2 — kiểm toàn vẹn, theo nghĩa vụ của từng trạng thái

Đọc `reports/phase1-clarifications.md`:

- `RESOLVED`: mọi câu **Critical/High** phải có câu trả lời không rỗng, **hoặc** `ACCEPTED-BY: <tên> <ngày>`.
  Còn câu bỏ trống ⇒ CHẶN, **liệt kê đúng câu nào**.
- `PARTIALLY RESOLVED`: mỗi câu còn mở phải ghi **chặn phase nào** (CSDL-3544 và 9002 đang làm đúng vậy:
  *"chặn Phase 2"*). Không ghi ⇒ CHẶN.
- `RESOLVED-BY-DEFAULT`: phải có **người + ngày**. CSDL-9004 ghi *"QA chốt 25/09/2026"* — đọc được, nên
  luật nhận **cả** `ACCEPTED-BY:` lẫn khuôn "QA chốt \<ngày\>", không ép sửa 5 task đang chạy để chiều
  một khuôn mới.
- Medium/Low: không chặn, nhưng phải **có mặt** trong file.

⚠️ **Phải đo trước khi bật chặn:** chạy thử A2 trên cả 5 task thật và báo cáo task nào sẽ đỏ, trước khi
quyết định bật. Bật một gate rồi mới biết nó làm đỏ việc đang chạy là đúng thứ prompt liệt vào điều kiện DỪNG.

### A3 — đối chiếu discovery (cảnh báo, không chặn)

`undocumented_present` trong discovery mà không thành câu hỏi trong clarifications ⇒ **cảnh báo** "có
vùng mù chưa thành câu hỏi". Không tự thêm câu hỏi — máy không biết câu hỏi đó đáng hỏi hay không.

### A4 — đăng ký

`GATES.md` (qua `gates:index`), `gate_codes.json`, `.agent/config/GATES.md`. Giữ nguyên lưới đỡ
`[NeedsVerify]` + `oracle_ref`, **không nhân bản**.

---

## 5. Ngân sách token

Đo HEAD: `phase1` bắt buộc **28.4k / ngưỡng 31k**. A1 chỉ thêm **một dòng** trỏ gate vào
`phase1_02_generate_testcases`; phần dày nằm trong code và `ambiguity_states.json` (không nạp vào prompt).
Nếu `prompt:budget` báo tăng ⇒ **cắt bù trong cùng luồng, không nới ngưỡng**.

---

## 6. Điều kiện DỪNG đã gặp ngay ở bước thiết kế

**Gate A1 chặn cứng sẽ làm đỏ task đang chạy.** Đo: 5/5 task đã có case; 3/5 không ở trạng thái
`RESOLVED` thuần. Hai phương án:

| | Phương án | Hệ quả |
|---|---|---|
| **A** ✅ đề xuất | **Chế độ di trú**: trạng thái lạ hoặc thiếu khoá ⇒ **CẢNH BÁO** + ghi `reports/gate-debt.json`; chặn thật chỉ với `PENDING` + đã có case (ca rõ ràng sai). Bật chặn toàn phần ở bản sau, khi sổ nợ về 0 | 0 task đang chạy bị đỏ oan; vẫn chặn đúng ca nguy hiểm |
| B | Chặn cứng ngay mọi trạng thái != `RESOLVED` | 3/5 task đỏ ngay, trong đó 9004 đã có quyết định QA hẳn hoi. Đỏ oan ⇒ người ta tắt gate |

Tôi đề xuất **A**, vì đúng tinh thần prompt (*"không làm đỏ hàng loạt task đang chạy"*) và vì ba trạng
thái kia **không sai** — chúng chỉ chưa được khai.

---

## 7. Cần NGƯỜI duyệt (máy không tự khẳng định được)

1. **Ba trạng thái có được hợp thức hoá không?** `PARTIALLY RESOLVED` và `RESOLVED-BY-DEFAULT` đang được
   dùng thật. Hợp thức hoá (kèm nghĩa vụ riêng) — hay ép tất cả về `PENDING`/`RESOLVED` và sửa 3 task?
2. **Chế độ di trú (phương án A) có được chọn không**, và bao lâu thì bật chặn toàn phần?
3. **Danh sách project × kích thước** có đúng người dùng thật của dự án không? Đề xuất hiện tại
   (Chromium + WebKit + Firefox × 1920/1366/390) là **suy từ cấu hình sẵn có**, không từ số liệu người dùng.
4. **Mức Critical/High** của từng điểm mơ hồ trong 5 task — máy chỉ đọc nhãn, không thẩm định được nhãn đúng hay sai.
5. **H2.3**: đồng ý đổi từ "sửa import" sang "cửa phòng tái phát" không? Nếu bạn vẫn muốn một báo cáo
   "trước/sau", tôi sẽ nói thẳng là **0 → 0**.

---

## 8. Việc sẽ KHÔNG làm, và vì sao

- **Không thêm project trình duyệt mới** — đã có, thêm là nhân bản.
- **Không sửa "import lệch hoa-thường"** — không có gì lệch; sửa cái không hỏng rồi báo đã sửa là gán công.
- **Không làm lại H2.1/H2.2** — đã xong ở v2.9.1, đã đo lại ở §0.
- **Không chạm UAT.** `smoke:matrix` phát triển và nghiệm thu trên fixture offline. Chạm UAT chỉ khi bạn
  xác nhận, và chỉ thao tác đọc.
- **Không tự tick mục "cần người duyệt"** ở §7.
