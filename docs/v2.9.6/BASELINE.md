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

## Các mục khác

*(điền khi làm tới — N2.2 · N2.3 · N2.4 · N5 · N6 · N7)*
