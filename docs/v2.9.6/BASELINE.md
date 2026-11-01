# v2.9.6 — BASELINE

> Số đo **trước khi vá**, và số đo sau mỗi mục. Chỗ nào chưa đo được thì ghi *chưa đo được* kèm điều
> kiện để đo — không để trống, và không đoán.

## N1 · Skill tự nạp

### Trước (đo 30/10/2026, bước 1a)

| Số đo | Giá trị |
|---|---|
| Skill gốc ở `.agent/skills/**` | **28** |
| `.claude/skills/` | **chưa tồn tại** |
| Hook `SessionStart` bơm mỗi phiên | **2.178 ký tự ≈ 681 token** |
| — riêng dòng liệt kê tên skill | **741 ký tự ≈ 232 token** |
| `package.json` version | `2.9.4` (lệch — xem N6) |

Dòng 232 token kia chỉ cho agent **tên** skill, không cho mô tả. Agent muốn biết "dùng khi nào" vẫn phải
mở `.agent/skills/INDEX.md`.

### Sau bước 1a

| Số đo | Giá trị |
|---|---|
| Shim sinh ra | **28** · `.claude/skills/<tên>/SKILL.md` |
| Thân mỗi shim | **≤ 5 dòng** (con trỏ về bản gốc, không chép nội dung) |
| `skills:index:check` | CHẶN khi shim **thiếu · lệch · thừa** — đối chứng cả ba chiều |
| `.gitignore` | thêm ngoại lệ `!.claude/skills/` kèm lý do |
| Hook | **chưa đổi** — cố ý, xem dưới |

Hook giữ nguyên ở bước 1a vì chưa biết harness có nạp shim hay không. Gỡ trước rồi hoá ra không nạp thì
kit mất cả hai đường.

### Bước 1b — ĐÃ ĐO 30/10/2026, và kết quả là NHÁNH THỨ BA

Hai nhánh định trước là *"harness thấy đủ 28 ⇒ gỡ danh sách khỏi hook"* và *"không thấy ⇒ xoá shim"*.
Phép đo trả về một thứ **không nằm trong cả hai**, nên phải tách câu hỏi làm hai:

| Câu hỏi | Cách đo | Kết quả |
|---|---|---|
| Harness có **NẠP** `.claude/skills/<tên>/SKILL.md` không? | gọi `Skill()` trên **3 shim ở 3 nhóm** (`run_report_reader` shared · `tc_validator` phase1 · `automation_reviewer` phase2) | **CÓ, 3/3.** Mỗi lượt trả `Base directory` trỏ đúng `.claude/skills/<tên>` kèm thân shim |
| Có phải nó nhận bừa mọi tên? | gọi `Skill(khong_he_co_skill_nay)` — đối chứng âm | **KHÔNG.** `Unknown skill` ⇒ tên được tra trên một sổ đăng ký thật |
| Harness có **QUẢNG BÁ** 28 tên đó vào ngữ cảnh không? | soi ngữ cảnh phiên này | **KHÔNG thấy mục liệt kê skill nào.** Tên skill trong ngữ cảnh chỉ đến từ dòng hook |

**NẠP ĐƯỢC ≠ BIẾT CÓ MÀ GỌI.** Đây là chỗ hai nhánh định trước đã gộp sai hai việc khác nhau. Shim làm
`Skill(<tên>)` chạy được — trước 1a thì gọi tên nào cũng ra `Unknown skill` — nhưng nó **không** tự làm
cho agent biết 28 cái tên ấy tồn tại.

Nên kết luận ngược lại dự định ban đầu:

- **GIỮ** dòng liệt kê tên trong `inject_context.js`, nhưng **lý do tôi ghi ở đây ban đầu chỉ đúng một
  nửa** — xem mục *BƯỚC 1B ĐÃ ĐO XONG* dưới: harness **CÓ** quảng bá skill. Quyết định giữ vẫn đứng, chỉ
  là nó đứng trên một lý do khác: chưa đo được harness có liệt kê **đủ 28** ở đầu phiên mới hay chỉ thông
  báo skill **vừa đổi**.
- Nhưng 232 token ấy nay **đáng hơn trước**: trước 1a nó chỉ là tên để đi mở file bằng tay; sau 1a mỗi
  tên là một `Skill(<tên>)` gọi được ngay.
- Shim **giữ lại**, và `skills:index:check` tiếp tục gác cả ba chiều thiếu · lệch · thừa.

#### BƯỚC 1B ĐÃ ĐO XONG — bằng một phép đo TỰ ĐẾN, và nó BÁC lập luận của tôi

Ngay sau commit vá YAML frontmatter (xem N8), harness tự gửi một thông báo:

```
The following skills are available for use with the Skill tool:
- automation_reviewer: …
- backlog_testcase_publisher: …
```

**Đúng hai skill tôi vừa vá**, không skill nào khác. Nên:

1. **Harness CÓ quảng bá skill** — nó phát một danh sách skill khả dụng. Kết luận trước của tôi
   (*"KHÔNG thấy mục liệt kê skill nào"*) chỉ đúng về **ngữ cảnh đã nén**, không đúng về harness.
2. **Vỡ YAML frontmatter làm skill KHÔNG được quảng bá, nhưng VẪN gọi được.** Trước khi vá,
   `Skill(automation_reviewer)` nạp bình thường (tôi đã thử) — mà nó không nằm trong danh sách. Sau khi
   vá thì nó xuất hiện. Đây là lớp hỏng **im lặng hơn** cả trường hợp agent: agent biến mất hẳn nên còn
   dễ thấy; skill thì vẫn dùng được nếu BIẾT TÊN, chỉ là không ai được giới thiệu.
3. **Lập luận cũ của tôi SAI.** Tôi viết: *"danh sách agent vẫn còn trong ngữ cảnh đã nén, nên 'nén ăn
   mất danh sách skill' là cách giải thích khó hơn"*. Sai — hai thứ nằm ở hai chỗ khác nhau: danh sách
   agent ở **mô tả tool** (giữ qua nén), danh sách skill ở **thông báo hệ thống** (nén bỏ được). Tôi đã
   suy từ "cùng là danh sách" ra "cùng cách lưu", mà hai việc đó không liên quan.

**Hệ quả cho quyết định giữ/gỡ dòng hook:** chỗ này nay **mở lại**, nhưng CHƯA đủ để gỡ. Phép đo mới chỉ
chứng minh harness quảng bá **skill vừa đổi**; nó KHÔNG chứng minh harness liệt kê **đủ 28** ở đầu một
phiên mới. Hai khả năng còn lại, và chúng dẫn tới hai quyết định trái nhau:

- harness liệt kê **đủ 28** ở đầu phiên ⇒ dòng hook là **dư**, gỡ được ~232 token/phiên;
- harness chỉ thông báo skill **mới đổi** ⇒ dòng hook vẫn là đường duy nhất để biết 28 tên ⇒ **giữ**.

**Một phép đo nữa làm hẹp chỗ chưa biết.** `npm run skills:index` ghi lại **cả 28** shim — đo được:
mtime của một shim không-đổi-nội-dung **có** thay đổi, nội dung **y nguyên**. Mà harness chỉ thông báo
**2**. Nên thông báo đi theo **nội dung / trạng thái đăng ký**, **không** theo mtime.

Hệ quả: ở đầu một phiên, chưa có trạng thái trước để so, nên mọi skill hợp lệ đều ở thế *"vừa trở nên
khả dụng"* — tức harness **có lẽ liệt kê đủ 28**. Hai mô hình giải thích khác nhau (thông báo khi *đổi
nội dung* vs khi *đổi trạng thái parse*) đều dẫn tới cùng dự đoán đó.

Nhưng **"có lẽ" không phải "đã đo"**, và hai chiều hỏng không đối xứng: gỡ dòng hook mà hoá ra cần thì
hỏng **im lặng** (agent không biết 28 skill tồn tại); giữ thừa thì chỉ tốn **232 token/phiên**. Nên
**GIỮ** cho tới khi có số.

Phép đo một dòng ở phiên mới, chưa nén: đếm xem ngữ cảnh đầu phiên liệt kê **bao nhiêu** skill. **28** ⇒
gỡ dòng hook. **0** ⇒ giữ, và lúc đó kết luận có **số đo**, khác hẳn *"chưa đo được"*.

Tới khi có số đó thì **GIỮ** dòng hook — vì hỏng theo chiều "gỡ rồi mới biết là cần" thì im lặng, còn
hỏng theo chiều "giữ thừa" thì chỉ tốn 232 token.

## N8 · Subagent — ĐÃ TÌM RA NGUYÊN NHÂN, và nó không phải thứ tôi đoán

### Hiện tượng

| Số đo | Giá trị |
|---|---|
| Định nghĩa ở `.claude/agents/` | **3** (`case-debugger` · `excel-convert` · `test-runner`) |
| Harness đăng ký | **2/3** — `case-debugger` vắng mặt ở **ba** ngữ cảnh (28/10 · 29/10 · 30/10) |
| `Agent(case-debugger)` | `Agent type 'case-debugger' not found`, kèm danh sách agent không có nó |

Khác hẳn chuyện skill ở N1: skill **nạp được mà không quảng bá**; agent này thì **thật sự không có trong
sổ đăng ký**. Không áp được "nhánh thứ ba".

### KẾT LUẬN CŨ CỦA TÔI LÀ SAI — và sai theo kiểu dễ tin nhất

Bản trước của mục này ghi: *"khác biệt cấu trúc duy nhất là thiếu trường `model:`"*, kèm câu *"đã loại ba
giả thuyết"*. Cả hai câu đều quá tự tin:

- Tài liệu Claude Code nói `model:` là **TUỲ CHỌN** — chỉ `name` và `description` bắt buộc. Thiếu
  `model:` thì harness chọn theo thứ tự mặc định, **không** bỏ file.
- *"Khác biệt duy nhất"* là kết quả của việc tôi **so ba file bằng MẮT**. Mắt không đọc được YAML.

### Nguyên nhân THẬT, đo bằng parser

Tài liệu liệt kê các điều kiện làm một file agent bị **bỏ qua**, trong đó có **YAML không parse được**.
Parse frontmatter bằng parser YAML thật:

```
case-debugger.md:  ✗ Nested mappings are not allowed in compact mappings at line 2, column 14
excel-convert.md:  PARSE OK
test-runner.md:    PARSE OK
```

Dòng 2, cột 14 là đúng chỗ này:

```yaml
description: Gỡ MỘT case đỏ: đọc log và ảnh FAIL, …
#                          ↑ `: ` giữa một plain scalar KHÔNG bọc nháy ⇒ YAML vỡ
```

Hai agent đang đăng ký được **không có dấu hai chấm nào** trong giá trị. Đó là khác biệt thật, và nó
nằm ngay cạnh khác biệt tôi đã nhìn thấy.

### Quét toàn bộ: 5/75 file, không phải 1

| File | |
|---|---|
| `.claude/agents/case-debugger.md` | agent — **không đăng ký** |
| `.agent/skills/phase2/automation_reviewer/SKILL.md` | skill nguồn |
| `.agent/skills/shared/backlog_testcase_publisher/SKILL.md` | skill nguồn |
| `.claude/skills/automation_reviewer/SKILL.md` | shim (sinh từ nguồn trên) |
| `.claude/skills/backlog_testcase_publisher/SKILL.md` | shim |

**Nhưng `Skill(automation_reviewer)` VẪN gọi được** — tôi thử trong chính phiên này. Nên skill và agent
**không cùng cách nạp**: skill nhận diện theo **tên thư mục**, agent theo **`name` trong frontmatter**.
Đó là lý do vỡ YAML giết agent mà không giết skill. *(Suy luận từ hành vi quan sát được, không phải từ
tài liệu — tài liệu không nói chỗ này.)*

Đã vá cả 5: bọc giá trị `description` trong nháy đôi. Sau vá: **0/75** file vỡ.

### Cửa mới: `npm run frontmatter:check`

Một file định nghĩa vỡ frontmatter thì harness **bỏ qua nó IM LẶNG** — không log, không cảnh báo, chỉ là
agent/skill đó không bao giờ xuất hiện. Suốt **20 ngày** không cửa nào thấy, kể cả cửa của kit vẫn khai
*"frontmatter hợp lệ"* — vì nó kiểm bằng **regex**, không parse YAML.

Cửa gác đúng các điều kiện **tài liệu đã nêu**: giá trị chứa `: ` không bọc nháy · giá trị chứa ` #` ·
giá trị mở đầu bằng ký tự cú pháp YAML · thiếu `name`/`description` · `name` sai khuôn hoặc **khác chỗ
harness tra** · frontmatter mở mà không đóng. Nối vào bó **`predeploy`**: một kit phát hành kèm agent
không nạp được là kit **hỏng với người nhận**.

**Cửa KHÔNG rỗng, và có phép kiểm chứng minh:** nó lấy nội dung `case-debugger.md` **trước** commit vá từ
git và đòi phải CHẶN. Một cửa mới luôn xanh trên cây đã vá; điều cần chứng minh là nó **đã** đỏ trên cây
chưa vá.

**Giới hạn, nói thẳng:** cửa này **không** parse YAML (repo không có phụ thuộc YAML, và thêm một phụ
thuộc chỉ để gác sáu luật thì đắt hơn gác thẳng sáu luật). Vỡ theo kiểu khác — thụt lề, list, neo/alias —
thì nó không thấy.

### ĐÃ XÁC NHẬN — và KHÔNG cần phiên mới

Tôi tưởng phải chờ phiên mới. Không: **harness nạp lại file định nghĩa NGAY khi nội dung đổi.**

| Mốc | `Agent(case-debugger)` | Danh sách agent |
|---|---|---|
| Trước khi vá | `Agent type 'case-debugger' not found` | 2/3 — vắng mặt |
| Sau khi vá, **cùng phiên** | **chạy được**, trả đúng câu đã yêu cầu | **3/3** — harness tự thông báo agent mới |

Hai chiều đều có số đo, nên nguyên nhân **đã xác nhận**, không còn là nghi vấn: `: ` không bọc nháy làm
vỡ YAML ⇒ harness bỏ qua file ⇒ agent không vào sổ đăng ký. Vá xong là nó vào ngay.

`claude --debug` không cần dùng tới — để lại đây làm đường dự phòng nếu lớp lỗi này tái phát theo một
kiểu khác (tài liệu nói lý do bỏ qua được ghi vào debug log).

## N2.1 · `run:analysis --nhom` — gom case đỏ theo nguyên nhân

### Nguồn dữ liệu, đo trước khi dựng (30/10/2026, toàn repo)

| Số đo | Giá trị |
|---|---|
| Case đỏ/chặn trong các sổ `testcase-status.json` | **407** |
| — trong đó có `failureLayer` | **203** |
| — trong đó có trường `error` | **0** ⇒ sổ verdict KHÔNG mang câu lỗi |
| File `results.json` | **550** · **193** file có lỗi · **286** dòng lỗi |
| Dòng lỗi mang mã TC trong tiêu đề | **219/286 = 77%** (phần còn lại là spec probe, vốn không có mã) |

### Kết quả gom, 5 sổ chính (sau bản vá bộ nối — xem dưới)

| Task | Case đỏ | Nhóm | Nén | Nối được câu lỗi thật |
|---|---|---|---|---|
| CSDL-4008 | 75 | 26 | **2,9×** | **0/75** — task này có **0 dòng lỗi** |
| CSDL-9004 | 86 | 65 | 1,3× | 15/86 |
| CSDL-9001 | 75 | 62 | 1,2× | **0/75** — **0 dòng lỗi** |
| CSDL-9002 | 43 | 42 | **1,0×** | **0/43** — **0 dòng lỗi** |
| CSDL-9003 | 57 | 56 | **1,0×** | 23/57 |
| **Tổng** | **336** | **251** | **1,34×** | **38/336 = 11%** |

Hai task nén 1,0× nghĩa là **không gom được gì** — bản gom ở đó không nói thêm điều gì so với đọc sổ.

### Bốn con số hạ kỳ vọng xuống

1. **Nén 1,34×**, không phải "40 case → 4 nguyên nhân" như hình dung ban đầu.
2. Chỉ **38/336 = 11%** ca nối được **câu lỗi thật**. 89% còn lại gom theo `comment` của sổ verdict — mà
   comment phần lớn là **câu khuôn mẫu**, không phải nguyên nhân. Và nguyên nhân chính của 89% ấy đã đo
   ra được: **ba trong năm task có 0 dòng lỗi** (193 ca đỏ). Không logic nối nào cứu được chỗ không có
   gì để nối — chỗ đó phải sửa ở lượt chạy, không sửa ở bộ gom.
3. Soi tay **9 nhóm mẫu: 6 nhóm gom SAI**. Nhóm 23 case chỉ chung đúng câu *"Lệch kỳ vọng ở N bước"*;
   hai nhóm cùng nghĩa bị tách vì lệch một chữ (*"trên phạm vi"* ≠ *"trong phạm vi"*).
   *Đo TRƯỚC bản vá nối. Sau vá, bốn trong năm sổ gom y nguyên (26 · 62 · 42 · 56 nhóm), chỉ CSDL-9004
   đổi — nên số này vẫn đứng cho bốn sổ kia, và có thể đã tốt hơn ở 9004.*
4. **Tỉ lệ nén KHÔNG phải điểm chất lượng.** Vá bộ nối làm CSDL-9004 từ 57 lên **65 nhóm** — nén TỤT
   đúng vì gom **đúng hơn**: câu lỗi thật thì khác nhau, comment khuôn mẫu thì gom bừa. Nén cao có thể
   chỉ nghĩa là đang gom theo câu khuôn mẫu. Bản in nay tự khai cả điều này (giới hạn ④).

**⇒ Điều kiện DỪNG của prompt đã nổ** (*"gom sai > 2/10 nhóm mẫu ⇒ giữ ở mức báo cáo, hỏi user trước
khi đưa vào cửa nào"*). `--nhom` ở mức **BÁO CÁO**, không nối vào cửa nào; `tests/fe/infra/run-analysis-nhom.spec.ts`
khoá điều đó lại bằng một phép kiểm đọc `phase_check.js`. Và bản in **tự khai cả ba số trên mỗi lượt
chạy** — có phép kiểm riêng bắt buộc nó phải khai, vì một bản gom gọn rất dễ bị đọc thành "4 nguyên
nhân" khi thật ra là "4 câu khuôn mẫu".

### Ba lỗi của chính tôi, và cái nào bắt được bằng gì

**① Lính gác mã HTTP có mặt nhưng vô dụng.** Neo `§500§` bị chính lượt `\b\d+\b` ngay dưới ăn thành
`§<số>§`, nên lượt tháo neo không còn gì để tháo ⇒ hai lỗi trả **500 và 404 ra cùng một chữ ký**.
Đối chứng ở **mức bản in vẫn xanh** (phần còn lại của câu khác nhau); chỉ phép kiểm **mức hàm** lôi ra.
Và nói nốt chỗ bất lợi: vá xong **số thật không đổi** — comment thật không chứa mã HTTP, nên đó là
**đối chứng tổng hợp**, chưa gác dòng dữ liệu thật nào.

**② Một giới hạn GIẢ bị tôi ghi vào tài liệu như giới hạn thật.** Bản đầu khai *"7% ca nối được, vì dữ
liệu không có"*. Soi vào chênh lệch 77% dòng lỗi có mã TC ↔ 7% ca nối được thì ra: tiêu đề spec của
CSDL-9004 dùng mã **trần** (`TC_021`), sổ dùng mã **đủ** (`CSDL_NHANSU_TC_021`), và phép so bằng-nhau-
tuyệt-đối trượt sạch **28/28** mã. Vá bằng khớp hậu tố **khi và chỉ khi hậu tố là duy nhất trong sổ**
(đo toàn repo: **0 nhập nhằng**). Nối 41 → 56 ca trên 536, tức 8% → 10%.

Hai con số không khớp nhau là thứ đã lôi lỗi này ra — không phải phép kiểm nào. Nếu tôi chỉ ghi một
trong hai số thì nó vẫn còn nằm đó dưới dạng một câu "dữ liệu không có" nghe rất hợp lý.

**③ Hai bản sao logic nối.** Một trong `gomTheoNguyenNhan`, một trong chỗ đếm của `inNhom` — nên bản in
khai *"0 ca nối được"* trong khi phép gom đã nối 15 ca. Đã gộp về một hàm `boNoi` dùng chung, và có
phép kiểm riêng cho đúng chỗ đó.

### Đối chứng của spec (`tests/fe/infra/run-analysis-nhom.spec.ts`, 12 ca)

| Chiều | Ca |
|---|---|
| gom ĐÚNG | 5 case cùng một locator hỏng ⇒ **1 nhóm** |
| tách ĐÚNG | hai lỗi khác nhau cùng trả **HTTP 500 ⇒ 2 nhóm**; cùng câu khác tầng ⇒ 2 nhóm |
| nối ĐÚNG | mã trần ⇄ mã đủ; `TC_01` **không** ăn câu lỗi của `TC_010` |
| TỪ CHỐI nối | hậu tố nhập nhằng (2 ca cùng `TC_021`) ⇒ `undefined`, vì nối sai tệ hơn không nối |
| tự khai giới hạn | bản in phải có tỉ lệ nén · tỉ lệ nối · *"KHÔNG cửa nào được chặn"* |
| giữ ở mức báo cáo | đọc `phase_check.js`, chặn nếu `--nhom` bị nối vào bó gate |

## N2.3 · `trace:matrix` — chiều NGƯỢC: test đã chạy mà không TC nào nhận

Bảng chính đi một chiều (TC canonical → đã execute chưa), nên bỏ lọt loại khó thấy nhất: một lượt chạy
**ghi verdict cho một mã mà bộ case không có dòng nào nhận**.

### Vì sao KHÔNG đếm trần một con số

Phần lớn ca mồ côi là ca **mở rộng §7**, vốn đúng thiết kế là không có dòng canonical. Một cột
*"mồ côi: 8"* ở CSDL-9004 sẽ chôn ca đáng lo xuống dưới đống đúng-thiết-kế. Nên phân loại rồi mới đếm.

| Task | mồ côi / tcId trong sổ | mở rộng KHÔNG neo | probe mang verdict | mạo danh | mở rộng CÓ neo |
|---|---|---|---|---|---|
| CSDL-9004 | 8/256 | **7** (5 trong đó `FAILED`) | 1 | 0 | 6 |
| CSDL-4008 | 2/282 | **2** | 0 | 0 | 0 |
| CSDL-9001 | 1/205 | 0 | **1** | 0 | 0 |
| CSDL-9002 | 0/150 | 0 | 0 | 0 | 0 |
| CSDL-9003 | 0/245 | 0 | 0 | 0 | 0 |

**9 ca mở rộng đang mang PASS/FAIL mà không có neo oracle.** CLAUDE.md §3 nói rõ: mở rộng không có
`oracle_ref` (`BR-`/`SM-`/`UI-`…) thì là `OBSERVATION`, **không** phải verdict. 5 trong số đó là `FAILED`
— đúng loại dễ thành bug sai. Và **6 ca khác CÓ neo**, nên phép kiểm neo không rỗng ở cả hai chiều.

Loại **mạo danh** đo được **0 ca**, và chỗ đó là một bài học riêng: phép đo nháp của tôi báo 2 ca
(`CSDL_HSTRUONG_TC_127B`, `TC_161B`) vì regex nháp đòi hậu tố **chữ thường** nên trượt chữ `B` hoa — hai
mã ấy **có** trong canonical. Bộ phân tích thật đọc đúng. Nên loại này ship kèm **đối chứng tổng hợp**
và ghi rõ là *chưa gác dòng dữ liệu thật nào*.

### Ba trạng thái, không hai

Bản đầu gộp *"không có ca mồ côi"* với *"có ca mồ côi nhưng đều đúng luật"*, nên khi mọi ca mở rộng đều
có neo nó in **"Mọi N tcId đều có dòng canonical"** — một câu **sai**, và sai theo chiều làm người đọc
tưởng phép kiểm neo chưa chạy. Phép kiểm của chính spec bắt được. Nay ba trạng thái tách rõ: *sạch thật*
· *đã kiểm và sạch* · *có lỗi*, cộng nhánh thứ tư **KHÔNG PHÁN ĐƯỢC** khi đọc ra 0 TC canonical.

### Chưa nối vào cửa nào — đó là việc của người dùng quyết

Phép kiểm đúng và đã đo hai chiều, nhưng bật chặn ngay sẽ **chặn 11 ca trên task đang chạy thật** của
người dùng. Dữ liệu đó là của họ, nên chỗ nối (`self-review:enforce` chạy trước finalize/publish là chỗ
hợp lý nhất, vì nó chặn PHÁT HÀNH chứ không chặn lượt chạy) để họ chốt.

## N2.4 · `parity:check` khối ⑤ — một ✅ không được dán khi mục con chưa xong

### Vì sao cần, và vì sao chỗ này khó gác

Bảng nghiệm thu chấm theo **§**, mà một § có thể gồm nhiều việc. v2.9.5 dán ✅ cho §7 khi nó chỉ có
skill `run_report_reader` + view `trace:matrix --pm`; phần **lõi** của `test-report-analyzer` bên A (gom
theo nguyên nhân · phân loại tầng · chiều test mồ côi) thì chưa có. Dòng ✅ ấy **không sai từng chữ**,
nhưng nó làm người đọc tin cả § đã xong — và không máy nào bắt được, vì máy chỉ đọc **ký hiệu**.

### Đo trước khi dựng: neo trong bảng đã đủ chưa

| Số đo | Giá trị |
|---|---|
| Dòng ✅ trong bảng | **12** |
| — không neo được (cột `Máy gác` không nêu script lẫn spec) | **0** |
| — neo HỎNG (script/spec không tồn tại) | **0** |
| Neo kiểm được | **16** (10 npm script · 6 đường dẫn spec) |

Nên phép kiểm *"neo có tồn tại"* sẽ **rỗng** trên dữ liệu hiện tại. Chỗ **không rỗng** là chiều kế
hoạch: một mục con chưa xong thì mục cha không được ✅.

### `plan_items.json` không được là một lớp tự khai nữa

Mỗi mục con bắt buộc có **neo máy phân giải được**, và chính đó là điểm của N2.4:

| Loại neo | Máy kiểm gì |
|---|---|
| `script` | npm script phải có trong `package.json` |
| `spec` | file spec phải tồn tại **và** có ≥ `toiThieu` phép kiểm `test(` |
| `nguon` | file nguồn phải tồn tại **và** chứa `ky_hieu` ⇒ việc đã vào mã. *"Có file" chưa phải "đã làm"* |
| `nguoi` | chỉ người kiểm được ⇒ **buộc § phải là ⚠️, không bao giờ ✅**, và phải ghi `vi_sao` |

Nhánh `nguoi` là chỗ luật *"mọi mẫu lấy từ A phải có máy, hoặc phải khai rõ CHƯA CÓ MÁY"* được thi hành
**bằng máy** thay vì bằng thiện chí. Và có **chiều ngược**: mọi mục con đã phân giải mà § vẫn ⚠️ thì cửa
**nhắc** nâng lên — thiếu chiều này thì ⚠️ thành chỗ trú ẩn vĩnh viễn, vì hạ một dòng xuống ⚠️ là cách
rẻ nhất để hết đỏ mà không làm gì.

### Cửa chặn THẬT ngay lượt đầu

Lượt chạy đầu tiên của khối ⑤ **đỏ trên dữ liệu thật**:

```
§7 đang dán ✅ nhưng 1 mục con CHƯA XONG: N2.4: thiếu spec `tests/fe/infra/parity-plan-items.spec.ts`
```

— tức nó chặn vì chính N2.4 chưa xong. Đó là đối chứng dương trên dữ liệu thật, không phải đồ dựng.

### Hai chỗ phải nói ra

1. **Nhánh `nguoi` hiện chỉ có đối chứng TỔNG HỢP.** Sau khi N2.1–N2.4 xong và đều có neo máy, §7 không
   còn mục con `nguoi` nào, nên nhánh đó nổ **0 lượt** trên dữ liệu thật. Có đối chứng dương trong
   `tests/fe/infra/parity-plan-items.spec.ts` chứng minh nó nổ được; **chưa** có số đo độ chính xác khi
   gặp ca thật.
2. **Việc nối phép kiểm test-mồ-côi vào cửa chặn KHÔNG phải mục con của §7** mà là một quyết định của
   người dùng, nên nó nằm ở khối **CHƯA CÓ MÁY** của `A_PARITY.md`, không phải ở `plan_items.json`.
   Gộp nó vào §7 rồi hạ §7 xuống ⚠️ sẽ làm dòng tổng ⚠️ lệch khỏi số dòng trong khối — và `parity:check`
   đã có một phép kiểm khoá đúng chỗ đó.

### Dòng §7 viết lại cho đúng thực tế

Dòng cũ kể hai thứ (`run_report_reader` + `--pm`). Dòng mới kể đủ bốn, **kèm giới hạn ngay trong ô**:
`--nhom` *"giữ ở mức BÁO CÁO, vì đo được nén chỉ 1,34×, 11% ca nối được câu lỗi thật và 6/9 nhóm mẫu gom
sai"*. Một bảng nghiệm thu nói được giới hạn của chính nó thì khó dùng để khoe hơn. Dòng §7 thứ hai (sổ
phiên chạy tay) đổi nhãn thành **§7b** để mục con của kế hoạch neo đúng dòng, không neo bừa cả hai.

## N6 · Phiên bản và số đếm về chính kit

### Trước (đo 30/10/2026)

| Số đo | Giá trị |
|---|---|
| `package.json` version | **2.9.4** |
| CHANGELOG mục đỉnh | **v2.9.5** |
| Nhánh đang làm | **v2.9.6** |
| ⇒ lệch | **hai bước**, và không cửa nào kêu |
| Mục CHANGELOG dạng `## vX.Y.Z` | **23/23** — nhưng phần mở đầu phủ nhận việc dùng semver |
| Chỗ nhắc số máy gác | **4** — 2 máy sinh (`GATES.md`, `RULE_COVERAGE.md`) · **2 viết tay** |

### Vì sao `version:check` cũ không bắt được

Cửa **đã tồn tại** và đã gác bốn thứ: semver hợp lệ · tag ↔ version · CHANGELOG **có** mục cho bản hiện
tại · cảnh báo shared change. Ca lệch hai bước vẫn **xanh**, vì mục cho `2.9.4` còn nằm giữa file nên
phép kiểm *"có mục"* thoả. Thiếu đúng chữ **ĐỈNH**.

Thêm bốn phép kiểm, mỗi phép kiểm có đối chứng dương riêng:

| # | Gác gì | Vì sao cần |
|---|---|---|
| ⑤ | mục ĐỈNH phải là bản hiện tại | ca lệch hai bước ở trên |
| ⑥ | thứ tự phải GIẢM DẦN | là tiền đề của chữ "đỉnh"; chèn mục vào giữa thì "đỉnh" thôi còn nghĩa |
| ⑦ | phần mở đầu không khai NGƯỢC cách file đang được ghi | câu cũ dạy người đọc sai về cả file |
| ⑧ | số máy VIẾT TAY khớp bản MÁY SINH | bản sao viết tay của một con số do máy đếm là chỗ trôi được |

### Ba lỗi của chính tôi trong mục này

**① Tôi GHI ĐÈ một file đang có.** `Write` báo *"updated"* chứ không *"created"*, và tôi không soi trước
— `scripts/qa/version_check.js` đã tồn tại **133 dòng**, có cả quy ước semver MAJOR/MINOR/PATCH và nhánh
chạy-từ-ZIP-không-có-`.git`. Đã trả lại bản gốc từ HEAD rồi **thêm** bốn phép kiểm vào, không thay.

**② `package.json` có hai khoá `"version:check"`.** Khoá ấy đã có; tôi chèn thêm một bản. `JSON.parse`
lấy khoá **cuối** nên số script **không đổi** (vẫn 215), mục mới bị che **im lặng**, và không cửa nào
kêu. Dấu hiệu duy nhất là con số lẽ ra phải tăng mà không tăng. Nay có phép kiểm đọc **thô bằng regex**
để bắt khoá trùng — `JSON.parse` thì không bao giờ thấy.

**③ Phép kiểm ⑧ bản đầu sai theo chiều PHÁ HOẠI.** Lượt chạy đầu nó bắt 4 *"chỗ lệch"* ở `CHANGELOG.md`
(132 · 80 · 16 máy) và `docs/v2.9.2/PLAN.md` (134 máy). Những con số ấy **đúng ở thời điểm ghi**; bắt
chúng khớp số hôm nay là đòi viết lại lịch sử. Ranh giới nay mechanical: tài liệu **trạng thái hiện tại**
là `.md` không phải `CHANGELOG.md` và không nằm dưới `docs/v…`. Đánh đổi nói rõ: `A_PARITY.md` cũng bị bỏ
qua dù đang sống — bù lại nó có `parity:check` riêng.

Và lần thứ **ba** trong phiên, văn của tôi làm nổ phép kiểm của tôi: ghi chú giải thích câu bị cấm lại
**chứa** chính câu đó. Giữ phép so thô có chủ ý — phân biệt *"khai"* với *"trích"* bằng máy thì mong manh
hơn là chỉ cần diễn đạt lại.

## N5 · Sổ chung mệnh đề luật — và hai bề mặt của kit nói ngược nhau hơn hai tuần

### Trước

`rule_consistency.json` có đúng **1** mệnh đề (`EVIDENCE-MUC-B`). Một cửa gác một luật, trong khi nó tự
nhắc *"máy này chỉ canh mệnh đề ĐÃ KHAI — luật mới ⇒ thêm mục, nếu không nó gác một nửa"*.

### Lỗi tìm ra: cùng một luật, hai lời khai TRÁI NGƯỢC

| Bề mặt | Khai gì | Đúng/sai |
|---|---|---|
| `.agent/config/GATES.md` | `expected:check` là cửa **CHẶN** (T0) | **đúng** — `expected_ledger.js` có từ 12/10/2026 |
| `.agent/skills/phase2/automation_reviewer/SKILL.md` | *"**không máy nào** so expected với bản trước"*, và nên dựng gate bằng `git diff` | **sai cả hai vế** |
| `.agent/skills/.../anti_patterns.md` | *"Máy: `npm run expected:check`"* | đúng, nhưng **bỏ mất** điều kiện phải chụp mốc |

Vế `git diff` không chỉ sai mà còn **tốn kém**: nó đẩy người đọc đi dựng lại một đường **đã đo là cụt**
(29/10/2026: **0** file testcase được git track vì `outputs/*` gitignore).

Sự thật đo được 30/10/2026: máy **có**, nó so với **snapshot của chính nó**, và **1/5** task có snapshot
— nên ở 4 task còn lại cửa đang ở trạng thái `CHƯA ĐƯỢC GÁC` (exit 2), **không phải "đạt"**.

Mệnh đề `EXPECTED-CO-MAY` còn lôi ra **hai chỗ nữa tôi chưa biết**:

- `scripts/qa/automation_review.js` — khai sai ở **thời hiện tại**;
- chính header của `scripts/qa/expected_ledger.js` — kể lịch sử 11/10 nhưng viết ở thời hiện tại, nên
  **máy thực thi luật lại tự khai rằng luật đó không có máy**.

Cả bốn chỗ sửa **LỜI**, không chỗ nào dùng miễn trừ.

### Phần hai: rà luật phát biểu hai kiểu — KHÔNG ship được detector nào

Dò theo con số (số lệch là dấu hiệu rẻ nhất của *"một luật, hai cách nói"*) trên 4 khái niệm có nguồn
canonical: **13 hit · 13 dương tính giả**. Nên **không** ship phép dò này thành cửa.

Hai lý do dương tính giả, cả hai đều là giới hạn thật của heuristic:

1. **Số sự cố bị đọc thành số luật** — *"7 verdict bị chặn"*, *"45 verdict của lượt GDTX"*, *"mất 166/199
   verdict"* đều là số **ca đã xảy ra**, không phải phát biểu luật.
2. **Cùng hình dạng, khác artifact.** `docs/course/**` dạy người đọc tự dựng `phan-quyet.json` với **7
   status + 7 tầng lỗi** — con số ấy **đúng** cho artifact của khoá học, dù kit có 10 status + 8 tầng. Suýt
   "sửa" 7→10 và phá một tài liệu đang dạy đúng, để khớp số của một thứ khác.

Lý do ② là lý do quyết định: phép dò **không phân biệt được** "cùng khái niệm" với "khác artifact cùng
hình dạng". Mà đó chính là việc mà một cửa nhất-quán phải làm được. Nên kết luận là **chưa có máy cho
chiều này**, ghi vào khối CHƯA CÓ MÁY, không phải một cửa `--warn` cho đủ.

## N7 · Dữ liệu tổ hợp — đo xong thì KHÔNG dựng thêm máy

### Trạng thái thật trước khi làm

| Số đo | Giá trị |
|---|---|
| `combinatorial_matrix` có mã lớp kết quả `OC-n` | **có** (từ v2.9.5) |
| Cửa gác mã đó | **có** — `matrix:coverage` khớp theo MÃ, không dò chữ |
| Tên file: skill dạy đặt ↔ gate đi tìm | **khớp** (`<basename>_matrix.md`) — không có lỗi khuôn tên |
| File `*_matrix.md` trong `test-cases/` của 6 task | **0** |
| ⇒ `matrix:coverage` đã gác được bao nhiêu dòng dữ liệu thật | **0**, suốt 20 ngày kể từ 10/10/2026 |

Cửa tự khai đúng điều đó mỗi lượt: *"0 file `*_matrix.md` ⇒ phép kiểm CHƯA GÁC GÌ. Đây KHÔNG phải đạt."*

### Câu hỏi đáng đo: không ai dùng thì có SAI không

Nếu bộ case đang **liệt kê tay** các tổ hợp thì đó là nổ case, và ma trận lẽ ra cắt được. Đo bằng cách
chuẩn hoá ô `Trường hợp kiểm thử` (bỏ giá trị trong nháy · bỏ số · bỏ tên cấp) rồi gom:

| Task | Case | Mô tả khác nhau | Nhóm ≥4 | Case trong nhóm ≥4 |
|---|---|---|---|---|
| CSDL-4008 | 312 | 310 | 0 | 0 (0%) |
| CSDL-9004 | 298 | 298 | 0 | 0 (0%) |
| CSDL-9003 | 291 | 276 | **1** | **5 (2%)** |
| CSDL-9001 | 223 | 221 | 0 | 0 (0%) |
| CSDL-9002 | 150 | 150 | 0 | 0 (0%) |
| CSDL-3544 | 60 | 60 | 0 | 0 (0%) |
| **Tổng** | **1.334** | — | **1** | **5 = 0,4%** |

**⇒ Bộ case KHÔNG liệt kê tay lưới tổ hợp.** Đường tổ hợp đang không được dùng vì **không có nổ case để
cắt**, không phải vì thiếu máy.

### Quyết định: KHÔNG thêm máy, và nói rõ vì sao

Thêm mã OC vào `test_data_generator` kèm mở rộng `data:chain:check` cho dữ liệu tổ hợp sẽ là dựng máy cho
một khối việc **đo được là không tồn tại** — tức thêm một cửa nữa nổ 0 lượt. Kit đã có một cửa như thế
(`presence-only`, 0/2.873) và nó nằm trong khối CHƯA CÓ MÁY vì lý do đó.

Phần **có** làm, vì nó rẻ và bịt một đường nối hở thật: `test_data_generator` trước đây không nhắc `OC-n`
ở đâu cả, nên nếu ai thật sự dựng ma trận thì hai skill **không nói cùng một thứ tiếng**. Đã thêm một mục
ngắn: mỗi bộ dữ liệu trỏ về **đúng một mã** `OC-n` (không ghi chữ mô tả, vì chữ thì hai bên trôi khỏi
nhau mà không ai thấy); bộ không ứng được mã nào là **thiếu lớp kết quả trong ma trận**, phải sửa ma trận
trước. Mục đó tự khai là **hợp đồng chờ sẵn**, không phải mô tả việc đang diễn ra.

### ĐIỀU KIỆN XÉT LẠI, nói trước để lần sau khỏi tranh luận từ đầu

Dựng tiếp khi có **một** trong hai dấu hiệu, và phải là số đo chứ không phải cảm giác:

1. một task sinh ra file `*_matrix.md` thật ⇒ `matrix:coverage` bắt đầu có dữ liệu, lúc đó mới biết nó
   gác đúng hay sai;
2. tỉ lệ case nằm trong nhóm ≥4 mô tả gần trùng **vượt 10%** ở bất kỳ task nào ⇒ đã có nổ case để cắt.

### Một lỗi của chính tôi trong phép đo này

Bản đầu của script đo bọc `parseMarkdown` trong `try/catch` im lặng. Import sai đường dẫn (`model.js`
không export `parseMarkdown`, nó ở `index.js`) ⇒ script in ra **rỗng**. Và "rỗng" ở đây rất dễ đọc thành
*"không có case trùng nào"* — tức đúng kết luận tôi đang muốn, bằng một phép đo không chạy. Đã bỏ catch
im lặng; lỗi import nay nổ ra ngay.

## Hai việc người dùng chốt (30/10/2026)

### ① Nối phép kiểm test-mồ-côi vào cửa CHẶN — đặt ở `self:review`, không ở `output_gate`

Phép kiểm đo được hai chiều và bắt ca thật, nhưng **chỗ nối** quyết định nó hữu ích hay bị tắt:

| Nếu đặt ở | Hệ quả |
|---|---|
| `output_gate` (cửa push) | chặn **giữa** lượt execute — trong khi việc phải làm (hạ verdict mở rộng về `OBSERVATION`, hoặc nêu `oracle_ref`) là việc của lúc **chốt** |
| `self:review --enforce` | chạy **trước** finalize/publish ⇒ không cho **phát hành** bộ kết quả có verdict không neo được, mà **không làm đứng lượt chạy nào** |

Chọn `self:review`. Chạy thật trên CSDL-9004: **8 ca CHẶN** (1 probe mang verdict + 7 ca mở rộng không
neo oracle), và dòng tổng nêu đúng khối: *"CHẶN ở: … test đã chạy mà không TC nào nhận"*.

**Chỉ hai loại là CHẶN.** Loại *mạo danh mã canonical* để **cảnh báo**, vì nó đo được **0 ca** trên dữ
liệu thật nên chỉ có đối chứng tổng hợp — một loại chưa gác dòng dữ liệu thật nào thì chưa đủ căn cứ để
chặn, và chặn bằng niềm tin là cách nhanh nhất để bị tắt. Có phép kiểm khoá chỗ nối lại, để lần sau không
ai lặng lẽ chuyển nó sang `output_gate`.

**Và nó lôi ra một con số gắn nhãn sai trong bản PM:** báo cáo in *"8/256 tcId không có dòng canonical"*
trong khi `self:review` in **27/256**. Bản PM dùng `ds.length` (số ca **LỖI**) mà gắn nhãn *"không có
dòng canonical"* (số ca **MỒ CÔI**) — lệch hơn ba lần. Lộ ra chỉ vì hai con số đứng cạnh nhau. Nay in cả
hai: *"27/256 tcId không có dòng canonical, 8 trong đó là LỖI."*

### ② `expected:check` — chụp mốc cho 5 task, và mốc tự khai nó chụp GIỮA task

Trước: **5/6** task không có mốc ⇒ cửa ở trạng thái `CHƯA ĐƯỢC GÁC` **vĩnh viễn**.

Nhưng chụp mốc **bây giờ** thì mốc mang luôn mọi thay đổi đã xảy ra trước đó — chính cửa ấy cảnh báo
*"chụp sau khi đã sửa expected thì mốc mang luôn bản đã sửa, và gate này thành đồ trang trí"*. Và **không
có dấu hiệu máy nào** cho biết bộ case đã chốt: **0 mirror `from-sheet`** trên cả 6 task.

Nên chụp theo cách khiến nó **không** thành đồ trang trí — thêm cờ `--giua-task "<lý do>"`:

- **đòi** lý do (thiếu ⇒ exit 2): một mốc chụp giữa task mà không nói vì sao thì về sau không ai biết nó
  tin được tới đâu;
- ghi lý do **vào chính mốc**, kèm câu `_nghia` tự giải thích nó chứng minh được gì và **không** chứng
  minh được gì;
- **in lại cảnh báo ở MỌI lượt so về sau**, không chỉ lúc chụp. Đây là vế quan trọng nhất: một cảnh báo
  chỉ hiện lúc chụp thì người đọc báo cáo ba tuần sau không bao giờ thấy, và lúc đó mốc lại được đọc như
  mốc chốt.

Đã chụp: CSDL-3544 (60) · CSDL-9001 (223) · CSDL-9002 (150) · CSDL-9003 (291) · CSDL-9004 (298).
CSDL-4008 đã có mốc từ 20/10.

Giá trị của mốc giữa task là **prospective**: nó gác từ thời điểm chụp trở đi. Có phép kiểm chứng minh
đúng điều đó — đổi expected **sau** khi chụp thì cửa vẫn CHẶN và nêu đích danh case.

### ③ Xử 11 ca bị chặn — và 5 trong số đó là CỬA TÔI BÁO OAN

Đi đọc từng ca thay vì xử lô, vì hạ một ca `FAILED` xuống `OBSERVATION` mà không soi thì có thể **chôn
mất một bug thật**.

**Phát hiện: gate của tôi bỏ sót một chỗ neo.** Kit có cơ chế riêng cho đúng việc neo một phát hiện —
bug claim ở `reports/bug-claims/<tcId>.json`, mang `oracle: { type, ref, quote }`. Gate chỉ soi sổ
verdict. Số đo:

| Task | Claim CÓ `oracle.ref` |
|---|---|
| CSDL-9004 | **22/22** |
| CSDL-9001 | **41/41** |
| CSDL-4008 | 34/43 |

**5/9 ca** bị báo *"mở rộng không có neo"* đã có claim kèm neo — cửa đang đòi một thứ **đã có, chỉ nằm
chỗ khác**. Đã vá: neo được công nhận ở **một trong ba** chỗ (trường riêng của record · chữ trong
comment/step · bug claim). Đòi đúng một chỗ là bắt người ta ghi hai lần cùng một thứ. Claim **đã rút**
(`status: 'withdrawn'`) thì **không** tính là neo.

Hai tiền đề khác cũng phải kiểm trước khi sửa, và cả hai đều đổi kết luận:

- mẫu neo chỉ nhận `BR-`/`SM-`/`UI-`, mà mấy ca viện **HDSD §3.2**. Nhưng quy ước *"§7 không phải
  oracle"* **chỉ CSDL-9002 khai** — không phải quy ước chung, nên **không** tổng quát hoá thành luật máy;
- bộ case CSDL-9004 khai *"Rule oracle: BR-NHANSU-001…016"*, mà **BR-NHANSU-018** (*"ô Mã số bị khoá"* —
  đúng neo cho hai ca ô-khoá) nằm ngoài dải đó. Đo lại: bộ case thật dùng **38 mã, 001–037**, nên dòng
  khai dải ấy **đã lạc hậu**.

**Sau khi vá: 11 ca → 6 ca.** Năm ca `FAILED` giữ nguyên verdict (neo đúng qua claim), và **cả 6 ca còn
lại đều là `PASSED`** — hạ về `OBSERVATION` chỉ bỏ một lời khai xanh không có căn cứ, **không** chôn mất
phát hiện nào.

| Ca | Vì sao `OBSERVATION` |
|---|---|
| `CSDL_NHANSU_RECON_001` · `PROBE_DONVI_CO_PHANHIEU` | bước **khám phá**, không neo vào đặc tả nào |
| `EXPANSION_XSURF_LUOI_FORM` | oracle là **lưới == form**, tức app == app — §3 cấm tautology; 1/11 cặp còn *chưa đo được* |
| `EXPANSION_GHI_SAI_CAP` | app chỉ trả câu lỗi **chung**, không mã BR nào khai *"tệp sai cấp phải bị chặn"* |
| `CSDL_EMISTH_EXT_LIENCAP_09` · `_11` | **chính ô ghi nhận đã viết**: *"chưa có mã BR nào khai quan hệ này nên chỉ ghi nhận, không chấm"* |

Sửa **cả sổ gộp lẫn shard theo TC** (11 chỗ): `evidence_recorder` ghi shard rồi gộp, nên sửa một chỗ thì
lượt gộp sau dựng lại `PASSED`. Comment mỗi ca được **giữ nguyên** và nối thêm một dòng nói rõ ngày, điều
luật, lý do — hạ verdict **không xoá** số đo hay evidence.

Kết quả: cả **5/5** task sạch ở phép kiểm này.

## Lượt bò khám phá: một phép kiểm chập chờn, và ba lỗi thật sau nó

`discovery-crawl.spec.ts` có một phép kiểm *"hai lượt cùng cấu hình ⇒ cùng danh sách màn"* đỏ khoảng
**3/6 lượt** dưới tải. Tôi từng báo nó mất **4 route bậc hai**. **Sai** — có máy đo rồi mới thấy lượt thứ
hai chết ở `page.goto` **đầu tiên** nên ra **0 màn**.

### Chuỗi loại nghi phạm

| Nghi phạm | Phép đo | Kết luận |
|---|---|---|
| Server fixture đói CPU | `http.get` thuần tới cùng URL lúc `goto` treo: **6–48ms**, 36 mẫu, 0 lỗi | **loại** |
| Trạng thái tích tụ sau lượt trước | lượt 5 và 6 xanh lại sau 3 lượt liền đỏ | **loại** |
| `srv.reset()` thiếu giữa hai lượt | vá rồi vẫn đỏ **0·2·1** | **loại** |
| `doTre: 0` ghi đè độ trễ 250ms | đặt lại 250ms vẫn đỏ **1·1·0** | **loại** |
| Tải CPU thuần là đủ để tái hiện | 10 rồi 21 tiến trình quay CPU: **0/10 lượt** tái hiện bằng probe node | **không đủ** |
| Page chết hẳn | `goto` lượt hai **cùng page: 11.359ms**; page mới **27ms**; browser mới **20ms** | **treo nhất thời** |

Hai hàng cuối là chỗ bẻ được bài: cú treo bám vào context đó, và trong lượt đo ấy, **ra khỏi nó rẻ hơn
chờ nó hết 420 lần**.

**Bằng chứng ngược, đo sau đó:** trong lượt `full:suite` 6 worker, cả **3 lần thử — gồm 2 lần dựng page
mới — đều hết hạn 15s**. Dưới tranh chấp của cả bó thì page mới cũng treo. Nên dựng lại page làm lượt bò
**bền hơn**, chứ **không chữa** được cú treo; phần còn lại do chốt `BO_DUOC_0_MAN` gác. Và vì vậy ba lượt
xanh dưới tải 11 tiến trình ở dưới **không** chứng minh cú treo đã bị hấp thụ — chúng chỉ nói cú treo
không xảy ra trong ba lượt đó.

### Ba lỗi thật, đều ở `crawl.js`

1. **0 màn vẫn `status: 'observed'`** — `screens` là mẫu số của `dimension_manifest` và `scope_anchor`.
   Nay ném `BO_DUOC_0_MAN`; `discover` thoát **mã 2**. Ngoại lệ: `--max-trang 0`.
2. **Điều hướng hỏng nhất thời không thử lại** — nay thử tối đa 3 lần, và ở **trang đầu** thì dựng lại
   page. 4xx/5xx **không** thử lại.
3. **Hai ô báo cáo không thể báo cáo** — `firewall: … ? 0 : 0` và `const apiRec = o.apiRec` chụp một lần.

### Hai lỗi của chính tôi trong lượt này

- **Máy đo tự nó rỗng:** đọc `khong_toi_duoc` rồi lọc theo `.length`, mà đó là map **số đếm** — nên nó in
  *"không route nào bị bỏ"* cho một lượt mất trắng 7 màn. Chi tiết nằm ở `chi_tiet_khong_toi_duoc`.
- **Bản vá đếm sai vế:** cho ô `firewall` lấy `bienBan.chan.length`, tức số request ghi bị chặn, trong
  khi cả khối đếm **route không tới được** — đúng khuyết điểm ② mà chính hàm ấy ra đời để chữa.

### Hai phép kiểm khai quá, lộ ra nhờ chốt mới

`gomLink` chạy **sau** trần mỗi trang, nên một trang hết giờ không đóng góp link nào — từ một trang đầu
hết giờ thì lượt bò **không thể** đi tiếp. Vậy mà hai phép kiểm mang tên *"lượt bò ĐI TIẾP"* và *"một
trang hỏng KHÔNG làm chết cả lượt"* đều chạy trên lượt bò **không có trang hỏng nào** hoặc **chỉ có một
trang**. Nay cả hai mang tên đúng việc chúng làm, và nhánh "đi tiếp" do một phép kiểm mới gác — ở đó `/`
vào được và `/mat` trả 404 thật.

### Lỗi thứ tư, lộ ra ở `full:suite`

`--storage-state-roles` được kiểm khuôn ở **mãi cuối** `discover.js`, **sau cả lượt bò**. Khai sai một
dấu bằng thì lệnh vẫn bò hết app — trần 20 phút — rồi mới nói *"sai khuôn"*. Hai phép kiểm khai
*"sai khuôn ⇒ từ chối"* thực ra phải chờ lượt bò xong mới tới được chỗ từ chối, nên khi lượt bò hỏng vì
môi trường thì chúng đỏ với một thông điệp hoàn toàn khác. Nay kiểm **trước khi mở browser**; thông điệp
và mã thoát giữ nguyên, chỉ đổi thời điểm. `discovery-roles.spec.ts`: **21 xanh**, cả spec còn 22,6 giây.

### Số đo cuối

| Phép đo | Trước | Sau |
|---|---|---|
| Nhóm `TẤT ĐỊNH`, tải 11 tiến trình, 3 lượt | **3 đỏ · 3 đỏ · 3 đỏ** | **9 xanh · 9 xanh · 9 xanh** |
| Thời gian mỗi lượt dưới cùng mức tải | 6,2–6,6 phút | 1,4–2,2 phút |
| Cả 5 spec nhóm `discovery`, máy rỗi | — | **128 xanh** |

Trần thời gian của file nâng lên 3 phút, kèm số đo: một lượt bò đầy đủ mất 19s khi rỗi và **28–41s** dưới
tải, mà phép kiểm tất định phải bò **hai** lượt — tức 56–82s, đã ăn **91%** trần 90s khi mọi thứ hoàn
toàn khoẻ. Không assertion nào đổi.

## Các mục khác

*(không còn — N1 · N2.1–2.4 · N3 · N4 · N5 · N6 · N7 · N8 đã xong)*
