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
| Harness có **NẠP** `.claude/skills/<tên>/SKILL.md` không? | gọi `Skill(run_report_reader)` | **CÓ.** Trả về `Base directory … \.claude\skills\run_report_reader` + thân shim |
| Có phải nó nhận bừa mọi tên? | gọi `Skill(khong_he_co_skill_nay)` — đối chứng âm | **KHÔNG.** `Unknown skill` ⇒ tên được tra trên một sổ đăng ký thật |
| Harness có **QUẢNG BÁ** 28 tên đó vào ngữ cảnh không? | soi ngữ cảnh phiên này | **KHÔNG thấy mục liệt kê skill nào.** Tên skill trong ngữ cảnh chỉ đến từ dòng hook |

**NẠP ĐƯỢC ≠ BIẾT CÓ MÀ GỌI.** Đây là chỗ hai nhánh định trước đã gộp sai hai việc khác nhau. Shim làm
`Skill(<tên>)` chạy được — trước 1a thì gọi tên nào cũng ra `Unknown skill` — nhưng nó **không** tự làm
cho agent biết 28 cái tên ấy tồn tại.

Nên kết luận ngược lại dự định ban đầu:

- **GIỮ** dòng liệt kê tên trong `inject_context.js`. Không tiết kiệm được 232 token/phiên — và giờ đã
  biết vì sao: gỡ nó đi thì mất đúng nửa phần *biết có mà gọi*, trong khi nửa *nạp được* không bù vào.
- Nhưng 232 token ấy nay **đáng hơn trước**: trước 1a nó chỉ là tên để đi mở file bằng tay; sau 1a mỗi
  tên là một `Skill(<tên>)` gọi được ngay.
- Shim **giữ lại**, và `skills:index:check` tiếp tục gác cả ba chiều thiếu · lệch · thừa.

#### Còn đúng một chỗ chưa đo được

Phiên đo là phiên **đã nén ngữ cảnh**, nên việc "không thấy mục liệt kê skill" có thể là do nén chứ
không phải do harness. Điều kiện để đo nốt: ở một phiên **mới, chưa nén**, kiểm xem ngữ cảnh có mục
liệt kê skill nào không. Nếu CÓ thì mới xét lại việc gỡ dòng hook — và chỉ khi ấy.

Giả thuyết "do nén" đã yếu đi nhiều bởi một quan sát ngay trong chính ngữ cảnh ấy: **danh sách agent
VẪN CÒN** (8 loại, kể cả hai agent của kit). Nén giữ được mục liệt kê agent mà bỏ mục liệt kê skill là
một cách giải thích khó hơn là "không có mục liệt kê skill nào để bỏ". Chưa phải bằng chứng, nên vẫn
ghi là *chưa đo được* — nhưng đừng trông đợi lượt đo kia đổi kết luận.

Hai kết luận ở trên **không** phụ thuộc vào chỗ này: cả hai đều đứng trên phép đo *nạp được*, vốn không
liên quan tới nén.

## N8 · Subagent — cũng chờ phiên mới

| Số đo | Giá trị |
|---|---|
| Định nghĩa ở `.claude/agents/` | **3** (`case-debugger` · `excel-convert` · `test-runner`) |
| Harness liệt kê (30/10, lần thứ ba) | **2/3** — `excel-convert` · `test-runner`; `case-debugger` vẫn vắng |

Đã đo **ba lần, ba ngữ cảnh khác nhau** (28/10 · 29/10 · 30/10): cả ba lần harness chỉ liệt kê **2/3** —
`case-debugger` vắng mặt. Đã loại ba giả thuyết: cả ba file **đều được git track**, `case-debugger.md`
vào repo từ **10–11/10** nên không phải "thêm giữa phiên", và frontmatter hợp lệ theo chính cửa của kit.

Khác biệt cấu trúc duy nhất là thiếu trường `model:`. Nhưng theo tài liệu Claude Code trường đó là
**tuỳ chọn**, nên đây vẫn là **tương quan, chưa phải nhân quả** — và `case-debugger` cố ý không ghim
model rẻ vì nó làm việc cần suy luận. Chỉ thêm `model:` nếu đã thử ở một phiên mới và thấy có tác dụng.

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

## Các mục khác

*(điền khi làm tới — N5 · N7)*
