# v2.8.0 — Thiết kế thư viện bước dùng lại

> Bản thiết kế để DUYỆT (§1). Chưa code gì của §A–§L. Hai mục §0b (khoá DB) và §0c (MD canonical) đã làm
> xong và commit riêng, đúng như prompt cho phép.

## 0. Điều phải đọc trước: ba tiền đề của prompt không đúng với cây code này

Phần này đứng đầu vì nó quyết định cả kiến trúc bên dưới. Cả ba đều đo được, không phải suy luận.

### 0.1. `typescript` trong repo KHÔNG có compiler API

§B nói "dùng TypeScript compiler API, đã có `typescript` trong devDependencies". Đo 12/10/2026:
`typescript@7.0.2` là bản **native**, và gói JS của nó xuất **đúng hai thứ** — `version` và
`versionMajorMinor`. Không có `createSourceFile`, không có `ScriptTarget`, không có `forEachChild`.

`acorn` và `espree` có sẵn (phụ thuộc của ESLint) nhưng chỉ đọc JavaScript, còn file cần đọc là `.ts`.

**Cách đã dùng, không thêm phụ thuộc nào:** `node:module.stripTypeScriptTypes` bóc chú thích kiểu (giữ
nguyên số ký tự nên số dòng không lệch), rồi `acorn` phân tích phần JavaScript còn lại. §0 luật nền cấm
thêm dependency nặng, nên đây là lựa chọn đúng chứ không phải lựa chọn tạm. Giới hạn: API đó còn là
**thực nghiệm** của Node; kit ghim Node qua `.nvmrc` nên rủi ro là "đổi hành vi khi nâng Node", không
phải "không chạy".

### 0.2. Code cũ KHÔNG có locator ngữ nghĩa để khai thác

Đo trên toàn bộ automation của 4 task (`outputs/<DA>/tasks/<TASK>/automation/`):

| | |
|---|---|
| File automation | **421** (~77.400 dòng) |
| Lời gọi thao tác Playwright | 2.062, thuộc 148 hình dạng |
| Lời gọi định vị | **1.388** |
| trong đó `page.locator()` thô | **1.387** |
| `getByRole` + `getByLabel` + `getByTestId` | **0** |
| `getByText` | 1 |

Hệ quả cho §B: khai thác theo **hình dạng** chỉ ra ống nước, không ra bước nghiệp vụ. Top hình dạng là
`page.goto({v})` (790 lần), `page.waitForLoadState({v}).catch({v})` (512), `page.locator({v}).click({v})`
(125). Ba cái đó không nói màn nào, field nào — **ý nghĩa nằm hết trong chuỗi selector**, mà chuẩn hoá
hình dạng thì bỏ đúng phần đó đi.

### 0.3. Khai thác theo selector thật cho 9%, và thứ lặp lại là NỘI THẤT WIDGET

Đo lại theo chuỗi selector nguyên văn:

| | |
|---|---|
| Selector khác nhau | 323 |
| Lặp ở **≥2 task** | **29 (9%)**, phủ 607/1388 lời gọi (44%) |
| Selector **nội suy** `${...}` | 645 (46%) — không khớp được như chuỗi cố định |
| Thẻ thô (`body`, `td`, `input[type=…]`) | 391 (28%) |

Thứ lặp liên task nhiều nhất **không phải field nghiệp vụ**:

```
181  #<ID>_DropDown li      ← mở xong thì chọn item
150  #<ID>_Arrow            ← bấm mũi tên để mở
144  #<ID>_Input            ← đọc/ghi giá trị đang chọn
```

Ba hình dạng đó là **một widget duy nhất**: Telerik `RadComboBox`. Chúng chiếm **475/1388 = 34%** mọi lời
gọi định vị, và xuất hiện ở 3–4 task khác nhau. Cộng các mẫu Telerik còn lại thì tổng là **524 (38%)**.

**Đây là phát hiện quan trọng nhất của §B**, và nó khớp với những gì đã ghi trong sổ tri thức: màn login
có 5 `RadComboBox`; nút `Ghi` là `input[value]` nên `hasText` không khớp; ô khoá bypass được qua
`_ClientState`.

### 0.4. Kết luận thiết kế rút ra từ ba điều trên

1. **Không thể khai thác L1 "mô hình màn" từ code cũ.** 46% selector là nội suy theo ID control, và ID
   đó do ASP.NET sinh. L1 phải dựng từ **dấu vân tay màn của discovery** (v2.6.0), đúng như §A nói — chứ
   không phải từ `mine.js`.
2. **Thứ khai thác được ngay, và đáng nhất, là một TẦNG WIDGET** nằm DƯỚI L1. Prompt không có tầng này.
   Ba thao tác `_Arrow` → `_DropDown li` → `_Input` là một bước "chọn giá trị trong combobox" tham số hoá
   bằng ID control. Gói nó lại là xoá 475 lời gọi lặp, và quan trọng hơn: xoá 475 chỗ có thể viết sai.
3. **`mine.js` vẫn giữ, nhưng đổi vai.** Nó không sinh thư viện; nó TRẢ LỜI "cái gì đang lặp" để biết nên
   gói cái gì trước. Đầu ra là danh sách ứng viên để người duyệt theo lô (§B.3), và máy tự khai giới hạn
   đó trong chính output của nó.

---

## 1. Kiến trúc — 7 tầng của prompt, cộng một tầng chèn thêm

| Tầng | Dùng lại cái gì | Ở đâu | Ai viết |
|---|---|---|---|
| **L0 Hạ tầng** | đăng nhập, phiên theo vai trò, `safe_target`, evidence, factory | đã có | — |
| **L0.5 Widget** ⟵ **MỚI** | thao tác trên một LOẠI control, tham số hoá bằng ID: `RadComboBox`, lưới Telerik, checkbox trong lưới, nút `input[value]` | `tests/fe/lib/_widget/` | khai thác từ code cũ (38% lời gọi định vị), người duyệt một lô |
| **L1 Mô hình màn** | Page Object mỗi màn: locator đã kiểm chứng, field đã gán loại | `tests/fe/lib/<module>/screens/` | **sinh từ dấu vân tay discovery**, người chỉnh trong vùng riêng |
| **L2 Bước nghiệp vụ** | hành động tham số hoá: "Đăng nhập vai X", "Lọc lưới cột C = v", "Tạo lớp với dữ liệu D" | `tests/fe/lib/<module>/steps/` + `step_catalog.json` | agent viết MỘT LẦN rồi đăng ký |
| **L3 Luồng ghép** | chuỗi bước hay đi cùng nhau | `tests/fe/lib/<module>/flows/` | đề xuất từ tần suất |
| **L4 Bộ kiểm** | hàm kiểm **không chứa giá trị kỳ vọng** | `tests/fe/lib/<module>/checks/` | kit cấp sẵn, dự án mở rộng |
| **L5 Khuôn case** | EP/BVA → bảng dữ liệu; DT → mỗi luật một dòng; ST → ma trận trạng thái × hành động | `tests/fe/lib/templates/` | kit |
| **L6 Bộ biên dịch** | TC (MD canonical) → spec, không cần AI cho bước đã có | `scripts/qa/reuse/compile.js` | kit |

**Vì sao chèn L0.5 thay vì nhét vào L1.** Một `RadComboBox` xuất hiện ở hàng chục màn khác nhau. Nếu cách
thao tác nó nằm trong từng Page Object thì nó bị chép lại theo số màn, và một lần sửa cách mở dropdown
phải sửa hàng chục chỗ — đúng tình trạng hiện tại (150 lần `_Arrow` rải rác 4 task). L0.5 gói theo LOẠI
CONTROL, L1 gói theo MÀN; hai trục khác nhau nên không gộp được.

## 2. Schema `step_catalog.json`

Khai ở `.agent/config/step_catalog.schema.json`. Mỗi bước:

```jsonc
{
  "id": "csdl.hoso-truong.loc-luoi",
  "mo_ta": "Lọc lưới hồ sơ trường theo một cột",
  "phrases": [                      // câu tiếng Việt hay gặp ở cột "Các bước thực hiện"
    "Lọc cột {cot} = {gia_tri}",
    "Lọc lưới theo {cot} là {gia_tri}"
  ],
  "params": { "cot": "string", "gia_tri": "string" },
  "screen": "csdl.hoso-truong",     // liên kết L1
  "widget": ["radcombobox"],        // liên kết L0.5 — MỚI
  "pre":  "dang-o:csdl.hoso-truong",   // hợp đồng trạng thái, để ghép bước tự động
  "post": "luoi-da-loc",
  "impl": "tests/fe/lib/csdl/steps/hoso_truong.ts#locLuoi",
  "version": "1.0.0",
  "thong_ke": {
    "so_lan_dung": 0,
    "ti_le_on_dinh": null,          // null = CHƯA ĐO, không phải 0
    "last_verified_build": null,
    "screen_fingerprint": null
  },
  "status": "draft"                 // draft · active · needs_reverify · deprecated
}
```

Hai chỗ cố ý:

- `ti_le_on_dinh: null` nghĩa **chưa đo**, khác hẳn `0`. Một bước chưa chạy lần nào không phải một bước
  chập chờn. Đây là cùng luật với `CHUA_KIEM` của v2.7.0 §A10.1.
- `status: draft` là mặc định, và **bước `draft` không được dùng để kết luận PASS** cho tới khi kiểm chứng.

## 3. Thuật toán khớp bước (`steps:match`)

Khớp bằng **luật và mẫu**, không dùng model. Bốn bước:

1. **Chuẩn hoá câu**: bỏ dấu để so (giữ bản gốc để in), gộp đồng nghĩa (bấm/nhấn/click, nhập/điền/gõ),
   tách giá trị trong ngoặc kép thành tham số.
2. **Khớp mẫu** `phrases` → `exact` (đủ tham số) · `fuzzy` (điểm tương đồng ≥ ngưỡng, kèm tối đa 3 ứng
   viên) · `none`.
3. **`fuzzy` giao cho subagent model rẻ** chọn **một mã trong danh sách ứng viên**, hoặc trả `none`. Đầu
   ra bắt buộc là JSON. Không được bịa mã ngoài danh sách — có kiểm.
4. **Báo cáo gọn** — và báo cáo phải nêu MẪU SỐ, không chỉ tỉ lệ:

```
Task K: 214 bước · 171 dùng lại (80%) · 31 cần viết mới · 12 cần chọn
Viết mới (gom theo màn): Màn X: 9 bước · Màn Y: 22 bước
```

**Agent chỉ viết các bước `none`.** Viết xong thì đăng ký vào danh mục với `status: draft`.

### Dùng chung bộ chuẩn hoá với `output_rules`

Luật đồng nghĩa và luật tách giá trị trong ngoặc kép phải lấy từ **một nguồn** với `.agent/config/
step_phrasing.json` (§K). Hai bản sẽ trôi khỏi nhau — đợt này đã trả giá hai lần cho đúng chuyện đó: hai
bản lint SQL bất đồng ở 4/795 câu, và năm bản mẫu PII lệch nhau ở SĐT 9 chữ số.

## 4. Bộ biên dịch TC → spec (`compile:spec`)

1. Đọc TC từ **MD canonical** qua `scripts/lib/testcase` (§0c đã chốt; không đọc `from-sheet/*.xlsx`).
2. Mỗi case:
   - `Tiền điều kiện` + tag `[<method>]` → factory / hook / `setup_recipes`.
   - **Các bước** → chuỗi lời gọi L2/L3 theo kết quả khớp.
   - **Kết quả mong đợi** → lời gọi bộ kiểm L4, giá trị kỳ vọng **trích từ chính ô đó** hoặc từ
     `knowledge/domain` theo `oracle_ref`.
   - Dòng không đổi được thành lời gọi kiểm → `// TODO-ORACLE`, và case đó **BLOCKED, không bao giờ PASS**.
   - Tag EP/BVA/DT/ST → khuôn L5; case cùng luồng khác dữ liệu **gộp thành một test chạy theo bảng**.
3. Case khớp đủ 100% bước → **sinh spec hoàn toàn bằng máy, 0 token AI**. Thiếu bước → khung có
   `// TODO-STEP <câu bước>` đúng vị trí.
4. **Dấu đầu spec**: TC ID, build, phiên bản từng bước đã dùng — để `steps:impact` biết spec nào bị ảnh hưởng.
5. Spec sinh ra **vẫn qua mọi gate cũ**: `lint:locator`, `auto:review`, `output_gate`.

## 5. Vòng đời bước

| Chuyển | Điều kiện | Máy |
|---|---|---|
| `draft` → `active` | chạy ổn định ≥3 lượt **và** dùng ở ≥2 case, **hoặc** qua review theo lô | `steps:promote -- --review` |
| `active` → `needs_reverify` | discovery `delta` thấy dấu vân tay màn đổi | tự động |
| bất kỳ → version chính +1 | đổi hợp đồng (`params`, `pre`, `post`) | `steps:impact` liệt kê spec phụ thuộc; CHẶN nếu không tăng version |
| `active` → `deprecated` | không ai dùng sau N sprint | đề xuất, không tự xoá file khi còn spec tham chiếu |

**Sửa một chỗ, lành mọi chỗ:** locator heal áp ở **tầng bước**, không áp ở từng spec, và ghi vào
`knowledge/locators`.

## 6. Luật an toàn chất lượng (có máy kiểm)

1. **Bước chỉ làm thao tác, và tự xác nhận thao tác tới đích** (`clickVerified`/`assertScreen`). Đây là
   nghiệm thu THAO TÁC, không phải phán đúng/sai nghiệp vụ. Bước lỗi → `script_error` ngay, không âm thầm
   làm sai rồi để case PASS.
2. **Bước KHÔNG chứa oracle.** `steps/` có `expect(` hoặc so với giá trị nghiệp vụ hardcode → **CHẶN (T1)**.
3. **Bộ kiểm L4 không có tham số kỳ vọng mặc định.** Gọi mà không truyền giá trị kỳ vọng → **ném lỗi**.
4. **Không dựng state bằng DB** — `builders/` chỉ qua API/UI/factory. `db:paths:check` (§0b, T0) đã quét
   `tests/fe/lib/**` từ trước khi thư viện có file nào.
5. **Bước `draft` không kết luận PASS.**

## 7. Ước tính token

| | Trước | Sau | Ghi chú |
|---|---|---|---|
| Sinh/sửa automation một task cùng module | mốc từ `baseline.dynamic.json` | **mục tiêu −50%** | đo ở §G.2 |
| Tỉ lệ dùng lại, task 2 cùng module | — | **mục tiêu ≥70%** | |
| Tỉ lệ dùng lại, task 3 module KHÁC | — | **mục tiêu ≥50%** | phép đo chứng minh thư viện phục vụ toàn hệ thống |
| Chạy lại không thay đổi | mỗi lượt tốn AI | **0 lời gọi AI** | |
| `lib:buildout`, `smoke:gen`, `compile:spec` | — | **0 token AI** | script thuần, không gọi model |
| Phần nạp bắt buộc mỗi luồng | — | **không tăng** | `prompt:budget` đã chặn 3 lần trong §0b/§0c |

**Một con số KHÔNG hứa:** tỉ lệ dùng lại ở module mới phụ thuộc trực tiếp vào §K (chuẩn hoá câu bước ở
Phase 1). Đo hiện tại chưa có — nó là việc của §K, và prompt yêu cầu ghi cả "tỉ lệ khớp trước/sau chuẩn hoá".

## 8. Thứ tự làm, và chỗ rủi ro nhất

1. **L0.5 widget** trước L1 — nó là thứ duy nhất khai thác được ngay từ code cũ (38% lời gọi định vị), và
   mọi tầng trên đều dựa vào nó.
2. **L1 từ discovery**, không từ `mine.js` (xem §0.4).
3. **L4 + luật vàng** trước L2 — nếu L2 ra trước thì bước sẽ mang oracle, và lúc đó gỡ ra là sửa lại cả thư viện.
4. **L6 biên dịch** cuối, vì nó tiêu thụ mọi tầng dưới.

**Chỗ rủi ro nhất:** tỉ lệ dùng lại gây áp lực để bước chứa oracle (gói luôn phần kiểm vào bước thì "dùng
lại" nhảy vọt). Prompt đã đặt đó làm điều kiện DỪNG, và tôi sẽ dừng ở đó thật.

---

## Câu cần user quyết trước khi tôi code §A–§L

1. **Chèn tầng L0.5 widget** — đồng ý không? Nó không có trong prompt, nhưng đo được là 38% lời gọi định
   vị và là thứ duy nhất khai thác được từ code cũ.
2. **`mine.js` đổi vai** từ "sinh thư viện" sang "đo cái gì đang lặp" — đồng ý không?
3. **Phạm vi đợt này.** §A0 đòi phủ TOÀN hệ thống (mọi module, mọi thực thể, mọi vai trò) qua
   `lib:buildout --all`. Với 4 task đã chạy và 1 module thật có dữ liệu, tôi đề nghị: làm đủ bộ máy
   (L0.5 → L6 + `lib:buildout` + `lib:coverage` + smoke §L), nhưng **chạy buildout thật chỉ cho module
   Hồ sơ trường**, rồi đo task-3-module-khác trên fixture. Làm buildout thật cho mọi module cần discovery
   chạy trên UAT cho từng cấp học — việc đó cần xác nhận riêng của bạn.
