# Chấm lại 3 tiêu chí — v2.10.0

Chấm ngày **06/11/2026** theo thang bản chấm 04/11. Mỗi mục lên 5 phải **chỉ ra con số chứng minh**;
mục nào chưa tới 5 thì **ghi rõ thiếu gì, không làm tròn**.

Lệnh tái lập ghi kèm từng số. Số đo đầy đủ ở [`BASELINE.md`](BASELINE.md), [`ROUTE_LIVE.md`](ROUTE_LIVE.md),
[`PRACTICE.md`](PRACTICE.md).

---

## Bảng tổng

| Tiêu chí | 04/11 | 06/11 | Con số chứng minh |
|---|---|---|---|
| Hướng dẫn cụ thể, có mẫu | 4,5 | **5** | 7/7 mẫu bản chấm đòi · 1 mẫu tự qua máy · 6 bộ cặp ❌/✅ có spec gác cột ✅ · `skills:practice` 3/3 lượt đạt |
| Kích hoạt đúng skill | 4 | **4,5** | 28/28 skill được harness quảng bá · `route:check` 96,7% · `route:live` **69,1%** so với ngưỡng 90% |
| Gọn token | 3 | **4** | luôn nạp **16,29 → 11,63 KB** (−29%) · phase1 **89,3 → 70,5 KB** (−21%) · cả hai **chưa** tới đích |

Hai tiêu chí chưa tới 5. Lý do ở dưới, kèm cái giá phải trả nếu muốn ép tới.

---

## 1. Hướng dẫn cụ thể, có mẫu — **5**

### Chứng minh

| | |
|---|---|
| Mẫu bản chấm đòi | **7/7** có thật |
| Mẫu tự qua máy thật | **1** (checklist Smoke qua `design_gate --mode checklist`, 0 chặn 0 cảnh báo) |
| Sổ nợ mẫu | `skills:template:check` **48/48**, chặn nợ mới và chặn cả việc nợ trả rồi mà không hạ sổ |
| Cặp ❌/✅ | **6 skill**, spec gác **chính cột ✅**: sạch `hard-sleep` · `console-log` · `vacuous-count` · `INSERT/UPDATE/DELETE`, và mang `RUN_ID` ở hai skill dạy về dữ liệu |
| Phép đo "đọc skill là làm được" | `skills:practice` **3/3 lượt đạt**, 5/5 lỗi mỗi lượt |
| Đối chứng | **42 phép phá → 42 lần đỏ** trên 4 cửa mới |

### Vì sao đây là chỗ vượt gói nguồn

Gói nguồn có mẫu nhưng **không có phép đo nào** trả lời *"đọc skill xong có làm ra được sản phẩm
không"*. `skills:practice` trả lời bằng model thật, mỗi bài đọc **đúng một skill**, thư mục làm bài
**không có `prompt_templates/`** nên làm được là nhờ skill chứ không nhờ thứ khác.

### Giới hạn, khai thẳng

- `skills:practice` có **1 trong 5 bài**. Bốn bài còn lại chưa dựng fixture; ba trong bốn cần một thư
  mục task giả vì cửa tương ứng đọc thư mục output chứ không đọc file rời.
- **6 trong 7 mẫu khai `vi_sao` thay `kiem_bang`** — lý do thật: cửa của chúng đọc thư mục task hoặc
  cây spec, không nhận file lẻ. Nên "mẫu tự qua máy" đúng với 1/7, không phải 7/7.
- Nợ 48 output chưa có mẫu. Sổ khai thành số, nhưng nợ vẫn là nợ.

Cho 5 vì ba điều đo được: đủ 7 mẫu, có phép đo mà gói nguồn không có, và cột ✅ có máy gác. Nếu thang
đòi cả 5 bài `practice` thì đây là **4,5**.

---

## 2. Kích hoạt đúng skill — **4,5**, chưa tới 5

### Chứng minh

| | 04/11 | 06/11 |
|---|---|---|
| Harness quảng bá skill | "không tự liệt kê" | **28/28** + 13 command + 3 agent |
| Ca trong fixture | 69 (4 ca `none`) | **90** (20 ca `none`) |
| `none` kích hoạt nhầm | **40%** (bị che vì chỉ có 4 ca) | **5%** (trần 10%) |
| Ca thật CHỌN SAI | gộp chung, không thấy | **0** |
| `route:check` top-1 | 98,6% | **96,7%** |
| `route:live` top-1 | — | **69,1%** (4 lượt tuần tự) |

### Vì sao chưa tới 5

**`route:live` 69,1% so với ngưỡng 90%** — thiếu khoảng 15 ca trên 70. Mọi ca trượt đều là *"không gọi
skill nào"*, **không ca nào chọn sai**.

Và đây là **chặn dưới**, không phải độ chính xác định tuyến: bộ đo chặn mọi công cụ làm việc nên model
chỉ còn hai đường — gọi `Skill` hoặc trả lời bằng chữ. Trong lượt dùng thật nó có thể mở skill muộn hơn.

### Điều đã sửa, và điều đã rút lại

Dòng `Skill của kit (28, KHÔNG auto-load — mở file để dùng)` đã **gỡ khỏi hook**: nó dạy một cách dùng
không còn đúng, trong phần mọi phiên đều đọc. Hook 2,01 → 1,23 KB.

Nhưng câu *"gỡ dòng đó làm định tuyến tăng gấp đôi"* đã **RÚT LẠI** — cả hai con số lấy từ lượt chạy
3 luồng, nơi phiên model bị throttle và dụng cụ đếm lượt throttle **thành** "không gọi skill". Không có
phép đo tuần tự trước/sau cho việc gỡ hook.

---

## 3. Gọn token — **4**, chưa tới 5

### Chứng minh

| | trước | sau | đích | còn thiếu |
|---|---|---|---|---|
| Phần luôn nạp | 16,29 | **11,63 KB** (−29%) | < 10 | **1,63 KB** |
| `phase1` bắt buộc | 89,3 | **70,5 KB** (−21%) | ≤ 45 | **25,5 KB** |

Cả hai ngưỡng đã **khoá**: `alwaysOnMaxKB = 12,2` · `phaseMaxKB.phase1 = 73,2` — cộng **mốc 6 luồng của
`prompt:budget`** hạ theo số đo (phase1 28.371 → 23.043, trần 31k → 24,2k, thẻ `run_phase1_template`
9,5k → 3,55k).

**Khoá lại không phải việc dọn dẹp — không khoá thì phép đối chứng CHẾT.** Đo 06/11: sau nhát cắt phase1
−5.538 token, phép KIỂM-ÂM của `prompt:budget` (phình một thẻ chạy thêm 5.000 token thì phải ĐỎ) ra
**XANH**, vì dư địa dưới mốc cũ lớn hơn cả phép phá. Một cải thiện không khoá lại thì vừa trôi về được,
vừa làm chính phép kiểm canh nó thành rỗng.

### Cái giá nếu muốn ép tới đích

**Dưới 10 KB** cần chặn `description` ở **110 ký tự**, tức cắt cụt **38/44** mô tả. Ở 120 ký tự vẫn còn
10,13 KB. Đó là đổi tiêu chí này lấy tiêu chí "Kích hoạt skill", và Luật nền của bản chấm đòi hoàn tác
khi một phép đo chất lượng tụt.

**Dưới 45 KB** cần dời chính phần **luật chặn**: `02_gen_testcases.md` có **27,2 KB** là khối mang luật
chặn, phần "có thể mở" chỉ 16,4 KB — dời hết vẫn còn 53,3 KB. Và `rule:parity` **không gác
`prompt_templates/`**, nên một luật mất ở đó không máy nào bắt. Nhát cắt vừa rồi đã suýt chứng minh:
lệnh `md_to_xlsx.js` — bước 7 bắt buộc — trước đó **chỉ** được nhắc trong khối "Prompt mẫu", và
`gate:policy` cứu được.

### Ước của bản chấm so với đo thật

| | ước | đo |
|---|---|---|
| gỡ danh sách skill khỏi hook | −2,2 | **−0,78** |
| mọi description ≤ 200 ký tự | −1,7 | **−2,16** (viết gọn; cắt cụt chỉ được −0,71) |
| `CLAUDE.md` mỗi điều ≤ 2 câu | −2,0 | **−1,46** |

Ba khoản cộng lại không đủ tới đích, và tôi đã ghi điều đó vào `BASELINE.md` **trước khi cắt**, để kết
quả cuối không bị làm tròn cho vừa mục tiêu.

### Một sắc thái phải khai

`CLAUDE.md` giảm 1,46 KB bằng cách chuyển chi tiết sang `core_rules.md`. Harness **không** tự nạp
`core_rules.md` (chỉ là link, không `@`-import), nên 1,46 KB đó **thật sự** rời phần mở phiên. Nhưng
`prompt:budget` tính `core_rules` vào nền của luồng phase — tức nó **dời** khoảng 660 token sang mỗi
lượt chạy phase, chứ không biến mất hẳn.

---

## Máy gác mới, và đối chứng của chúng

| Cửa | Ca spec | Phép phá → đỏ |
|---|---|---|
| `token:session` + `token:phase1` | 11 | 7 → 7 |
| `skills:route:live` | 15 | 13 → 13 |
| `skills:template:check` | 15 | 10 → 10 |
| `skills:practice` | 17 | 10 → 10 |
| cặp ❌/✅ (mục 1.3) | 20 | 7 → 7 |
| `case_types` khớp prompt | 4 | 5 → 5 |
| **Tổng** | **82** | **52 → 52** |

Cộng `skills:lint` thêm luật `descMaxChars: 200`, và `skills:route:check` tách **ba kết cục** thay vì
hai (*đúng* / *CHỌN SAI* chặn / *dưới sàn* khai thành nợ).

---

## Bốn lần một lượt đơn lẻ suýt thành kết luận

Đây là hình lặp lại nhiều nhất của cả đợt, nên ghi riêng.

1. **`route:live` 0/6 rồi 1/6.** Ba lỗi đường ống cùng cho một triệu chứng *"model không gọi skill"*:
   `shell:true` nối tham số không escape · `--allowed-tools` không giới hạn gì · stdin chờ 3 giây.
   Không cái nào là lỗi định tuyến.
2. **So 90 câu với 20 câu** rồi kết luận nhân quả về ngữ cảnh. Đối chứng cùng mẫu bác ngay.
3. **Năm lượt 3 luồng** cho 38,6 · 24,3 · 50,0 · 32,9 · **2,9%**. Lượt cuối có 68/70 "không gọi" vì
   throttle bị đếm thành kết quả. Làm cả năm con số không đọc được, và một kết luận phải rút lại.
4. **`skills:practice` 2/5 rồi 5/5** trên cùng một bài. Suýt đi sửa một skill không hỏng.

Cả bốn đã vá tận dụng cụ: tách ô `KHÔNG CHẠY ĐƯỢC` khỏi mẫu số · hỏng quá 10% thì `exit 2` · mặc định
chạy tuần tự · mặc định 3 lượt · mẫu tự dán nhãn "đây là MẪU" · báo cáo tự khai ngữ cảnh và số lượt bị
loại.

---

## Nghiệm thu còn thiếu gì

- [ ] 4 fixture `skills:practice` còn lại (~$5,7 model, và 3 bài cần thư mục task giả)
- [ ] `release:verify` xanh **hai lượt liên tiếp** — chưa chạy, vì chưa cắt bản phát hành
- [ ] CHANGELOG `v2.10.0` + `package.json` lên `2.10.0`
- [x] 82 ca spec mới, 52 phép phá cho 52 lần đỏ
- [x] 31/32 cửa `static-check` ĐẠT (danh sách trích bằng `grep` từ workflow, không từ trí nhớ); cửa đỏ
      duy nhất là `typecheck` với toàn bộ lỗi trong **một file chưa track của phiên khác**, đã chứng minh
      0 lỗi ở worktree sạch tại commit của nhánh
- [x] **11 ca đỏ của lượt dry-run 42183908761 đã vá tận nguyên nhân** — xem mục dưới

---

## 11 ca đỏ mà tôi không thấy, và vì sao tôi không thấy

Lượt dry-run `42183908761` đỏ ở bước *"Chạy CẢ BỘ"*: **2547 xanh · 11 đỏ · 24 bỏ qua**. Cả 11 là spec
**tôi không viết** — tức bản vá v2.10.0 làm chúng đỏ.

**Vì sao tôi không thấy:** `full:suite` chưa lần nào chạy xong ở máy (nó typecheck trước, và chết ở một
file chưa track của phiên khác), nên tôi chỉ chạy các spec mình nhắm tới. Con số *"31/32 cửa"* tôi báo ba
lần là về `static-check` — **không** phải về cả bộ 180 spec. Hai mẫu số khác nhau, và tôi dùng cái nhỏ để
nói về cái lớn.

### Ca nặng nhất không phải một dòng gate đỏ

`tests/fixtures/practice/spec_5_loi.spec.ts` — **file đề bài** cài sẵn 5 lỗi — bị `playwright test --list`
thu thành **4 test THẬT**. Một test bấm `#btnXoaTatCa`; `afterEach` bấm lại cái đó sau **mỗi** test.

Chú thích dòng 4–5 **do tôi viết** nói: *"KHÔNG được chạy… tên file cố ý không khớp `tests/fe/**` nên lưới
chắn của `ci:scope` không vớ phải nó"*. Tiền đề đó **sai hai lần**: `testDir: './tests'` gom cả
`tests/fixtures/**`, và `ci:scope` là cửa KHÁC chứ không phải bộ thu test. Trên máy có profile ghim sẵn,
`npx playwright test` sẽ lái UAT và bấm *"Xoá tất cả"* — đúng thứ non-negotiable §2 cấm.

Vá: đổi đuôi `.de.txt`, và `skills_practice.js` chép nó vào thư mục làm bài **dưới tên `.spec.ts`** nên
model vẫn thấy đúng thứ phải review. Thêm 2 ca gác: **không file nào dưới `tests/fixtures/**` được khớp
`testMatch`**, kèm đối chứng rằng phép kiểm bắt đúng cái tên cũ. Luật không phải *"đừng đặt tên thế"* —
một chú thích không chặn được bộ chạy.

### Sáu luồng vượt mốc: cắt bù, không nới ngưỡng

Nhát dời `CLAUDE.md` mục 3 sang `core_rules.md` làm phần nạp **bắt buộc của mọi luồng** tăng ~160 token, và
`start` tăng **570**. Đo ở worktree sạch tại `main`: **xanh** ⇒ 100% là của nhánh này, không có cớ "mốc cũ".

Trả bằng cách cắt, theo đúng luật của chính config (*"thêm chữ thì phải CẮT BÙ trong CÙNG luồng"*):

| Chỗ cắt | Cắt gì |
|---|---|
| `CLAUDE.md` −176 ký tự | câu đã có **nguyên vẹn** trong hook SessionStart (bản ở hook còn kể tên 4 cửa) |
| `core_rules.md` −386 | §Verify mở rộng về bản digest: 7 luật còn đủ 7, con trỏ còn giải được |
| `.claude/commands/start.md` −1138 (−32%) | lý lẽ sang [`docs/rationale/start-pham-vi.md`](../../docs/rationale/start-pham-vi.md) |

Kết quả: sáu luồng đều **dưới mốc**, và **không một ngưỡng nào bị nới**.

### Tám ca còn lại — mỗi ca một nguyên nhân thật

| Ca | Nguyên nhân | Vá |
|---|---|---|
| `skills-lint:74` | tôi đổi chữ *"thứ DUY NHẤT agent đọc"* thành *"căn cứ chính"* | khôi phục nguyên văn — bản đổi là vô cớ |
| `skills-lint:254` · `requirement-evidence:249` | `requirements_analyzer` 2543 > trần 2500 (`main` đã ở **2496**, dư 4 token) | rút hai con trỏ trong SKILL.md |
| `handoff-gate:105` | nhát cắt phase1 làm **mất hẳn** khối *"ghi bàn giao + `/clear`"* | khôi phục, kèm số đo 494–515k token/message |
| `start-command:144` | `/start` ghi 151 gate, thật **156**; và ô *"vì sao"* câu 3 ngắn hơn 40 ký tự | sửa số, viết lại ô |
| `config-presence:89` | `skills_template.json` chưa có trong danh sách **đóng gói** | thêm vào `package_kit.js` |
| `automation-review:59` | nợ ngủ cứng của file đề bài | hết sau khi đổi đuôi |
| `frontmatter-check:140` | đối chứng neo vào *"commit MỚI NHẤT sửa file"*, nên **tự vô hiệu sau một lần sửa** | dò ngược cả lịch sử |

Ca cuối đáng kể riêng: bản vá rút `description` của `case-debugger.md` làm commit mới nhất thành lượt rút
đó, nên bản `^` của nó là bản **đã vá** — cửa ra *"0 file có vấn đề"* mà vẫn **xanh**. Một phép đối chứng
hỏng thì kết luận nó bảo vệ cũng hỏng theo. Nay nó dò **ngược cả lịch sử** và đòi tìm được ít nhất một bản
bị chặn, nên không còn phụ thuộc vào việc lượt sửa gần nhất là lượt gì.

### Và hai lỗi của tôi ngay trong lượt vá này, do cửa bắt

- **Ngắt dòng giữa cụm** ``/phase1` hay `/phase2`` làm regex của `start-command` trượt — đúng lớp lỗi
  `rule:parity` đã dạy ở commit trước, tôi vẫn lặp lại.
- **Viết gọn TÊN luật** *"Neo CỦA kỳ vọng"* → *"Neo kỳ vọng"*, và `rule:parity` xếp là **MẤT LUẬT**. Nó
  đúng: tên là danh tính của luật, đổi nó để tiết kiệm 4 ký tự là đổi sai thứ.
