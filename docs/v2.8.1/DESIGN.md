# v2.8.1 — Thiết kế: 2 trục mở rộng + 2 chiều Phase 1

> Viết cho: **chủ repo**, để duyệt trước khi code. Đây là checkpoint duy nhất của đợt (§1 của prompt).
>
> Đo trước khi thiết kế, như v2.8.0. Phần §0 dưới đây là những chỗ **prompt mô tả không khớp cây code**,
> và chúng đổi hình dạng của việc phải làm — nên đọc §0 trước.

## 0. Bốn điều prompt nói không đúng với cây code này

### 0.1. KHÔNG có "5 trục" thống nhất — bốn máy khai BỐN bộ từ vựng

Prompt nói "thêm trục 6, 7 vào cả bốn máy". Nhưng bốn máy đó hiện không đồng ý với nhau về trục 1–5 là gì:

| Nguồn | Khoá trục |
|---|---|
| `CLAUDE.md` §3 (luật) | field cùng khối · cùng giá trị khác màn · chuỗi form→payload→API→UI · **nhánh** · **trạng thái kế cận** |
| `leak_report.js` `AXES` | `field` · `surface` · `persist` · **`branch`** · **`state`** |
| `depth.js` `PLAN` | `field` · `surface` · `persist` · **`concurrency`** · **`reverse`** (+ `state` chỉ ở band medium) |
| `expansion_audit.js` `axesRan` | `field` · **`reverse`** · `surface` · `persist` · **`fixture`** |
| `self_review.js` `axes` | ① field · **chiều ngược** · ② surface · ③ persist · **④⑤ gộp một dòng** |

Chỉ `field`, `surface`, `persist` có mặt ở cả bốn. Phần còn lại lệch nhau theo ba kiểu:

- **`branch` + `state`** (leak_report) ≡ **`fixture`** (expansion_audit) ≡ **"④⑤ nhánh × trạng thái"** (self_review,
  một dòng cho hai trục). Cùng một thứ, ba cách gọi, và một chỗ gộp hai trục làm một.
- **`reverse`** = "chiều ngược `spec:gap`". `CLAUDE.md` gọi nó là **chiều ngược**, tức KHÔNG phải một trục —
  nhưng `depth.PLAN` xếp nó vào danh sách trục của band high, còn `leak_report` không có nó.
- **`concurrency`** chỉ tồn tại ở `depth.PLAN`. **Không máy nào sinh artefact cho nó**, không npm script nào,
  không mục nào trong `expansion_audit` hay `self_review`. Đo: `grep -rl concurrency scripts/` chỉ ra hai file
  của chính `expansion/`.

**Hệ quả cho v2.8.1:** thêm `authz`/`calc` vào bốn chỗ với bốn bộ khoá khác nhau sẽ **cố định hoá chỗ lệch**,
và bảng `band → trục` tiếp tục không ai kiểm được. Đề xuất ở §1.

### 0.2. Bảng `band → trục` chỉ được IN RA, không máy nào thi hành theo nó

`depth.PLAN` có đúng hai nơi dùng, cả hai trong `expansion_plan.js`:

```js
console.log(`[exp] kế hoạch trục: high → ${depth.PLAN.high.join(' ')} …`);   // in ra
…`| ${b} | ${depth.PLAN[b].join(' · ')} | ${est.bands[b]} |`                 // một dòng bảng markdown
```

Phần **thi hành** nằm ở `expansion_audit.axesRan` (dò artefact có tồn tại không) và bảng của `self_review` —
và cả hai đều dùng bộ khoá riêng, không đọc `PLAN`. Nên hôm nay **không máy nào trả lời được** câu "case band
high này đã mở đủ trục mà band của nó yêu cầu chưa". Nó chỉ trả lời được "có artefact nào không".

Thêm trục 6/7 vào `PLAN` mà không nối thi hành thì chỉ thêm hai chữ vào một bảng in ra.

### 0.3. `calc` đã là tag CHIỀU, dùng lại làm khoá TRỤC là trộn đúng hai thứ prompt dặn đừng lẫn

`DIMENSION_TAGS` trong `scripts/lib/testcase/model.js` đã có `'calc'` (thuộc chiều §13 business logic).
Prompt đề nghị khoá trục 7 cũng là `calc`. Chính prompt viết: *"Phân biệt rõ, đừng lẫn: trục = mở rộng quanh
case ĐÃ viết; chiều = phủ lúc SINH case"* — nên dùng chung một chữ cho cả hai là tự tạo ra chỗ lẫn.

**Đề xuất:** khoá trục 7 là `oracle_calc`, khoá trục 6 là `authz`. `authz` không trùng tag chiều nào (chiều 15
dùng tag `security`).

### 0.4. Phần authz ĐỌC đã có sẵn gần hết — trục 6 chủ yếu là lớp KẾ HOẠCH

`security_check.js` đã làm:

- `authz-vertical`: vai trò thấp gọi endpoint của vai trò cao → PASS khi 401/403, FAIL khi khác;
- `authz-idor`: đổi id sang resource của user khác → PASS khi 403/404;
- `NEEDS_ACCOUNT` khi thiếu tài khoản test — **không đoán**, đúng tinh thần prompt;
- ràng buộc an toàn: chỉ GET, phải có `--confirm-nonprod`, không tự chạy, mask PII.

Nên trục 6 **không phải viết máy dò mới**. Nó là: (a) máy **liệt kê biến thể chủ thể** từ ma trận vai trò ×
route, (b) máy **gom bằng chứng** thành `reports/authz-expansion.md` với `proven=N`, (c) nối vào 4 máy trục.

---

## 1. Đề xuất: hoà giải 5 trục TRƯỚC, rồi mới thêm 6/7

Nếu không làm bước này, mọi thứ sau đều xây trên một bảng không ai thi hành.

**MỘT NGUỒN** `scripts/lib/expansion/axes.js`, khai 7 trục + 1 chiều ngược, mỗi mục gồm: khoá · số thứ tự ·
tên tiếng Việt · artefact nhận dạng (regex) · lệnh chạy · band bắt buộc. Bốn máy kia **đọc từ đó**:

| # | Khoá | Tên | Artefact | Band bắt buộc |
|---|---|---|---|---|
| ① | `field` | field cùng khối (spec→UI) | `conformance_report.json` | high |
| ② | `surface` | cùng giá trị khác nơi hiển thị | `cross-surface*` | high |
| ③ | `persist` | chuỗi form→payload→API→UI | `persist*` / `probe*` | high · medium · low |
| ④ | `branch` | nhánh | `fixture-matrix*` | high |
| ⑤ | `state` | trạng thái kế cận | `fixture-matrix*` | high · medium |
| ⑥ | `authz` | phân quyền quanh case | `authz-expansion*` | high (medium: khuyến nghị) |
| ⑦ | `oracle_calc` | oracle giá trị tính toán | `oracle-calc*` | high · medium |
| — | `reverse` | chiều ngược (build→tài liệu) | `spec-gap*` | không phải trục — giữ riêng |

Hai quyết định cần bạn chốt:

- **`concurrency` bỏ khỏi `PLAN`**, vì không máy nào sinh artefact cho nó. Giữ lại là giữ một dòng chữ mà
  `expansion_audit` không bao giờ đối chiếu được. *(Phương án khác: giữ và khai `CHƯA CÓ MÁY` — tôi không
  đề xuất, vì nó làm bảng trông đủ hơn thực tế.)*
- **`reverse` tách khỏi danh sách trục**, đúng như `CLAUDE.md` gọi nó ("+ chiều ngược"). `self_review` vẫn
  chấm nó, chỉ là không đếm vào "N/7 trục".

Và thêm **một máy chưa có**: `expansion_audit` đối chiếu `band → trục bắt buộc` (lấy từ `axes.js`) với trục đã
chạy. Đây là chỗ bảng `PLAN` lần đầu có răng.

---

## 2. Trục ⑥ — phân quyền quanh case

### 2.1. Máy liệt kê biến thể (`authz:expand`)

Đầu vào: ma trận vai trò × route (v2.6.0), `knowledge/system` (`PM-*`), bộ case canonical.
Với mỗi case đụng một resource/hành động, sinh ba nhóm biến thể:

1. **Dọc** — mỗi vai trò *thấp hơn* vai trò của case.
2. **Ngang (IDOR)** — cùng vai trò, *chủ sở hữu/đơn vị khác*.
3. **Ẩn ≠ cấm** — nút bị ẩn ở UI ⇒ bắt buộc có biến thể gọi thẳng API/URL.

Đầu ra `reports/authz-expansion.md` + `<!-- gate: proven=N -->`. Biến thể chưa thử ghi `unknown`;
thiếu tài khoản ghi `needs_account`. **Không làm tròn thành "không có quyền"** — `security_check` đã có
`NEEDS_ACCOUNT`, dùng lại đúng từ đó.

### 2.2. Oracle

| Tình huống | Verdict |
|---|---|
| Không đủ quyền → 401/403 (hoặc 404 theo quy ước che tồn tại), không trả dữ liệu chủ khác | PASS |
| Vai trò thấp vào được route/API của vai trò cao | **FAIL** (leo thang quyền) |
| UI ẩn nút nhưng BE trả 200 + data | **FAIL** |
| Biến thể chưa chạy | `unknown` — KHÔNG phải PASS |

### 2.3. Ranh giới an toàn — phần tôi sẽ không nới

| Loại | Trên UAT | Vì sao |
|---|---|---|
| authz **ĐỌC** (GET, visibility, IDOR đọc) | **tự động được**, qua `security_check --confirm-nonprod` | chỉ đọc, đã có máy, đã có ràng buộc |
| authz **GHI** (vai trò thấp xoá/sửa/duyệt bản ghi người khác) | **KHÔNG tự chạy** | gửi request ghi để thử 403 nghĩa là *nếu phân quyền hỏng thì đã ghi thật* vào UAT. Chỉ fixture, hoặc thủ công có người duyệt. |

Mọi lượt bò đi qua `write_firewall` (v2.6.0). Đây là **điều kiện dừng** của prompt, và tôi sẽ giữ.

---

## 3. Trục ⑦ — oracle giá trị tính toán

### 3.1. Nhận diện case cần trục 7

Expected là **giá trị dẫn xuất**: tổng, thành tiền, giảm trừ, phí, điểm, trạng thái suy từ ngày. Tín hiệu:
tag `[Logic]`/chiều 13, ô expected có số/công thức, field số có quan hệ với field khác.

### 3.2. Oracle ĐỘC LẬP — điểm mấu chốt

- Hàm oracle ở `tests/fe/lib/oracles/<miền>.ts`, nhận **dữ liệu test** → trả **giá trị kỳ vọng**, tính từ
  **spec**. Spec test so *giá trị app* với *giá trị oracle*.
- **Cấm tham chiếu output app** trong oracle — có test cấu trúc canh (giống `steps:lint` canh luật vàng L4).
- **Không expected mặc định**: thiếu tham số thì **ném**, như `batBuocKyVong` của L4 (v2.8.0).
- **Cặp đối chứng bắt buộc** mỗi quy tắc: một ca đúng, một ca lệch đã biết — chống hàm oracle luôn trả đúng.
  Đây là cùng luật "đối chứng hai chiều" mà v2.8.0 đã phải áp sáu lần cho các bộ dò bằng chữ.
- Mẫu số 0 quy tắc → `CHƯA KIỂM`, **không** PASS.

### 3.3. Chi phí

Oracle là code thuần ⇒ **0 token AI** khi chạy lại, hợp với §F của v2.8.0. Bảng dữ liệu × kỳ vọng để ở
`golden/`.

---

## 4. Hai chiều Phase 1: §24 Thời gian · §25 Dữ liệu cũ

Thư mục `prompt_templates/phase2/dimensions/` hiện có **20 file**, đánh số tới `23_db_persistence.md`
(số không liên tục — thiếu 01, 02, 18). §24/§25 nối tiếp đúng khuôn.

**Bốn chỗ phải sửa cho mỗi chiều** (bài học §22/§23 ghi ngay trong `model.js`: *"thêm ở đây MỚI có tác dụng —
chiều mới mà quên khai thì case gắn tag vẫn ra 0"*):

1. file `24_time.md` / `25_legacy.md`;
2. một dòng ở bảng điều hướng của `03_gen_testcases.md`;
3. một dòng ở bảng nguồn/điều kiện mở;
4. tag `time` / `legacy` vào `DIMENSION_TAGS`.

Cộng: `dimension_coverage` + `tc_validator` nhận tag mới; `RULE_GLOBAL` 20 → 22 chiều, digest `core_rules`
đồng bộ (`gate:policy` canh).

**Nội dung checklist** đúng như prompt nêu. Hai điểm tôi muốn nhấn:

- §24 đòi **clock tiêm vào**, không phụ thuộc giờ thật. Chưa đo được kit có đường tiêm clock chưa — nếu
  không có, phần đó là **Manual** và tôi sẽ ghi thế, không ép tự động.
- §25 **chỉ đọc** bản ghi cũ; không chạy script di trú trên UAT; đếm khớp qua client chỉ-đọc (§0b/§0c của
  v2.8.0). Phần lớn chiều này sẽ là Manual, và tôi sẽ nói thẳng thay vì ép xanh.

---

## 5. Ước tính token

| Phần | Nạp bắt buộc | Có điều kiện | Ghi chú |
|---|---|---|---|
| §24, §25 | **0** | ~1,2k/chiều | nạp có điều kiện, như 20 chiều kia |
| Trục ⑥, ⑦ ở Phase 2 | **0** | — | máy chạy bằng script, agent đọc tóm tắt |
| `axes.js` (một nguồn) | 0 | — | code, không vào prompt |

Ngân sách hiện tại rất sát: `start` **4.820/5.000**, và mốc vừa được chốt lại 13/10 sau khi `CLAUDE.md` §3
tăng 245 token. **Không có chỗ cho bất kỳ chữ nào vào phần bắt buộc.** Nếu `RULE_GLOBAL` 20→22 chiều làm
tăng phần bắt buộc, tôi sẽ cắt bù trong cùng luồng chứ không chốt lại mốc.

---

## 6. Thứ tự làm, và chỗ rủi ro nhất

| # | Việc | Commit | Rủi ro |
|---|---|---|---|
| 1 | `axes.js` một nguồn + hoà giải 5 trục + `expansion_audit` đối chiếu band→trục | 1 | **cao** — đụng 4 máy đang chạy; cần test đối chứng cho từng máy |
| 2 | Trục ⑥ (`authz:expand` + nối 4 máy + mutant quyền) | 1 | trung bình — phần dò đã có |
| 3 | Trục ⑦ (`oracles/` + `oracle:calc` + mutant công thức) | 1 | trung bình — rủi ro là oracle lấy từ app |
| 4 | Chiều §24 + §25 | 1 | thấp |

Rủi ro lớn nhất là bước 1: nó sửa bốn máy đang chạy thật. Tôi sẽ làm nó **trước** và có đối chứng âm cho
từng máy, vì nếu để sau thì hai trục mới xây trên nền lệch.

---

## 7. Ba câu cần bạn chốt

1. **Hoà giải 5 trục trước** (§1) — đồng ý không? Nếu không, tôi thêm 6/7 vào bốn bộ khoá khác nhau và bảng
   `band → trục` vẫn không ai thi hành.
2. **Bỏ `concurrency` khỏi `PLAN`** (không máy nào sinh artefact cho nó), và **tách `reverse` khỏi danh sách
   trục** (CLAUDE.md gọi nó là "chiều ngược") — đồng ý không?
3. **Khoá trục 7 là `oracle_calc`** thay vì `calc` (vì `calc` đã là tag chiều §13) — đồng ý không?

> Sau khi bạn chốt, tôi bắt đầu từ bước 1. Tôi **chưa code gì** của v2.8.1.
