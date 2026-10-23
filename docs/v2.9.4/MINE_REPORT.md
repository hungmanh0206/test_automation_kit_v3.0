# v2.9.4 — KHAI THÁC KHO AUTOMATION CŨ — báo cáo trước checkpoint

> Mọi con số đo trên HEAD `ee9bba4` ngày 16/10/2026 bằng script, không ước lượng.
>
> **Kết luận ngắn:** kho cũ **không chứa** cái mà prompt giả định. Phần dùng chung thật sự đã được trích
> từ lâu và đang được 84% file dùng — chỉ là nó nằm ở `tests/fe/support/`, không ở `tests/fe/lib/`.
> Thư viện v2.8.0 có **0 người dùng**. Lấp thêm vào một thư viện không ai import thì token không rẻ đi.

---

## 0. Bốn năng lực prompt nhắc mà repo KHÔNG có

Prompt đã tự cảnh báo hai cái. Đo trên HEAD thì có **bốn**:

| Công cụ | Prompt nói | Đo ra |
|---|---|---|
| `lib:buildout` | "đừng gọi" | ✅ đúng, không có |
| `lib:coverage` | "đừng gọi" | ✅ đúng, không có |
| `steps:dup` | *"(`steps:match`/`steps:dup` bắt)"* | ❌ **không có** |
| `mine.js --chay-on-dinh` | *"cờ đọc `testcase-status.json`"* | ❌ **không được cài đặt** — chuỗi `--chay-on-dinh` xuất hiện đúng **một lần** trong file, trong một dòng **chú thích**. → **ĐÃ CÀI ở đợt này**, xem §1b |

Hệ quả của cái thứ tư không nhỏ: prompt đặt tiêu chí *"lặp ≥2 task **VÀ** đã chạy PASS ổn định"*, nhưng
vế thứ hai **không đo được bằng công cụ đang có**. Tham số lạ bị Node bỏ qua im lặng, nên lượt chạy
`--chay-on-dinh` của tôi lọc **đúng 0 thứ** — và nếu không đọc code thì nó trông y hệt một lượt đã lọc.

Thêm một chỗ lệch: file `testcase-status.json` **có thật** nhưng nằm dưới `test-results/**`, không ở gốc
task. Nên kể cả khi cờ được cài, nó vẫn phải biết tìm ở đâu.

---

## 1. Mốc nền (đo được, không ước lượng)

| | Prompt ghi | Đo trên HEAD |
|---|---|---|
| File automation trong `outputs/**` | ~421 | **512** |
| Dòng | ~77.400 | **89.069** |
| Task có automation | 4 | 4 (9001 · 9002 · 9003 · 9004) |
| File trong `tests/fe/lib/` | "vài file" | **10** (3 widget · 2 oracle · 1 steps · 1 checks · 1 screens · catalog) |
| Mục `step_catalog.json` | "SEED ~6 mục" | **17 mục, tất cả `draft`, 0 mục có số đo** |

`steps:stats`: **0/17 mục danh mục đã có số · 17 mục CHƯA ĐO**, và *844/844 lượt step (100%) không theo
khuôn* — vì chúng là spec viết tay. `steps:promote` sẽ **từ chối thăng** cả 17 mục vì `ti_le_on_dinh`
còn `null`.

**Tỉ lệ khớp TRƯỚC khi lấp** (`steps:match`, đây là mốc để so về sau):

| Task | mệnh đề | dùng lại ngay | cần chọn | viết mới |
|---|---|---|---|---|
| CSDL-9001 | 1079 | 202 (**19%**) | 94 (9%) | 783 (73%) |
| CSDL-9002 | 1171 | 207 (**18%**) | 43 (4%) | 921 (79%) |

---

## 1b. Đã cài `--chay-on-dinh`, và nó đổi hẳn bức tranh

Cài rồi mới thấy con số trước đó lạc quan tới mức nào:

| | không lọc | **có lọc độ ổn định** |
|---|---|---|
| Ứng viên L1 (lặp ≥2 task) | 22 | **4** |
| Lời gọi thuộc một hình dạng đã lặp | 2024/2429 (**83%**) | 46/2429 (**2%**) |

Con số **83%** mà `mine.js` in ra trước đây — và mà prompt dựa vào để nói "phần lớn lặp cùng thao tác" —
là con số **chưa lọc gì cả**. Lọc theo đúng tiêu chí prompt đặt ra ("lặp ≥2 task **VÀ** đã chạy PASS ổn
định") thì còn **2%**.

Ba điều kiện thiết kế khi cài:

- **Chặn cờ lạ.** Một cờ bị bỏ qua im lặng cho ra bảng trông như đã lọc mà chưa lọc gì — đúng chuyện vừa
  xảy ra. Nay `mine.js --cờ-không-có` thoát 2 và liệt kê cờ có thật.
- **Đòi `pass > 0`, không chỉ `fail === 0`.** Bản đầu của tôi chỉ kiểm không có lượt đỏ, và hai ứng viên
  `0P/0F` lọt qua: TC có tồn tại nhưng chưa PASS lần nào. *Không có lượt đỏ* khác *đã chạy xanh*.
- **Nói rõ phép nối là GIÁN TIẾP.** Nối: ứng viên → file chứa nó → `tcId` file đó nhắc → trạng thái TC.
  Nó trả lời *"các TC của file này có chạy ổn không"*, **không** trả lời *"đoạn code này có ổn không"*.
  Và chỉ 32% file automation nhắc `tcId`, nên phần còn lại là `chưa đo` — `null` tuyệt đối không được
  đọc thành "ổn định".

---

## 2. `mine.js` trả về HÌNH DẠNG, không trả về bước nghiệp vụ

Chạy `node scripts/qa/reuse/mine.js --chay-on-dinh --top 40`:

```
514 file · 2425 lời gọi thao tác · 165 hình dạng khác nhau
ứng viên lặp ở ≥2 task: 22 hình dạng (L1) · 41 chuỗi-3 (L2)
   883  5  page.goto({v})
   583  4  page.waitForLoadState({v}).catch({v})
   158  4  page.locator({v}).click({v}).catch({v})
```

Và chuỗi-3 đứng đầu là `page.goto({v}) → page.goto({v}) → page.goto({v})`, 98 lần.

**Những con số này đúng nhưng không dùng được để lấp thư viện.** `mine.js` thay tham số bằng `{v}`, mà
nghĩa nghiệp vụ nằm **đúng ở tham số**: `goto` lặp 883 lần chỉ nghĩa là "có điều hướng", không nghĩa là
"có một bước dùng lại được". Bản JSON cũng chỉ giữ `mau · lan · so_task · task` — **không có màn, không
có file/dòng**, tức không trả lời được phần *"màn"* và *"lần chạy PASS ổn định"* mà prompt yêu cầu trong
bảng ứng viên.

Nên tôi khai thác thêm ở hai mức mà `mine.js` không chạm tới.

---

## 3. Khai thác ở mức THAM SỐ — 32/398 lặp liên-task

Gom theo *(động từ + tham số nguyên văn)* thay vì theo hình dạng:

```
512 file · 398 (động từ + tham số) khác nhau · 32 cái lặp ở ≥2 task
```

Và nhìn vào 32 cái đó:

| Nhóm | Ví dụ | Nhận xét |
|---|---|---|
| **Ruột widget Telerik** | `#${id}_DropDown li` (98 lần, 4 task) · `#${id}_Arrow` (94, 4) · `#${id}_Input` (75, 4) | **đã nằm trong thư viện** ở `_widget/radcombobox.ts` |
| Selector chung chung | `body` (130, 4) · `input[type=checkbox]` (14, 4) · `input[type=text]` (32, 2) | quá chung, không thành bước |
| **Màn cụ thể** | `/Manage/ChonTruong.aspx` (7, 2) · `/Default.aspx` (2, 2) · `/Logout.aspx` (2, 2) | ứng viên L1 **thật**, nhưng nhỏ |
| **Nút Telerik chuẩn** | `#ContentPlaceHolder1_ctl00_btnOK` (6, 3) · `btnCancel` (3, 2) · `btChiTiet` (2, 2) | ứng viên L1 **thật** |

---

## 4. Khai thác theo TÊN HÀM — và trùng tên ≠ trùng hành vi

994 tên hàm, **108 tên lặp ở ≥2 task**. Nhưng `chu`, `hien`, `nhan`, `doc`, `ten`, `sau`, `lay` là
helper ngắn **trùng nhau ngẫu nhiên** — đưa vào thư viện là nhồi rác, đúng điều kiện DỪNG của prompt.

Nên tôi lấy **thân hàm** ở từng task rồi so độ giống (Jaccard 4-gram, sau khi bỏ chú thích và nội dung
chuỗi). Kết quả: **8/44 tên** có thân giống ≥25%.

| Giống | Task | Dài | Tên | Dùng được? |
|---|---|---|---|---|
| 97% | 2 | 91 | `OPS` | ❌ hằng số, không phải bước |
| 60% | 3 | 89 | `arg` | ❌ đọc tham số CLI |
| 56% | 2 | 122 | `laDo` | 🟡 nhỏ |
| **35%** | **3** | 204 | **`docCombo`** | ✅ đọc combobox |
| **34%** | **2** | 435 | **`taiLen`** | ✅ tải file lên |
| 34% | 3 | 232 | `reporter` | ❌ cấu hình reporter |
| **32%** | **2** | 162 | **`moForm`** | ✅ mở form |
| **26%** | **3** | 659 | **`khoanh`** | ✅ khoanh element cho evidence |

Cộng thêm nhóm có tên lặp ≥3 task mà thân chưa đạt ngưỡng nhưng cùng ý: `docLuoi` (3) · `docCot` (3) ·
`datCombo` (3) · `docThongBao` (3) · `docXlsx` (3) · `luu` (3) · `chonCombo` (4).

**Tổng ứng viên thật: khoảng 10–12**, không phải "lấp đầy từ 421 file".

---

## 5. Số đo quyết định: thư viện có 0 người dùng, còn tầng kia có 84%

| | File automation import |
|---|---|
| `tests/fe/support/` (`opsLogin`, `opsAuth`, `seedSession`, `tokenBroker`) | **429/512 — 84%** |
| `tests/fe/lib/` (thư viện v2.8.0) | **0/512 — 0%** |

Đây là chỗ tiền đề của prompt lệch nhất. Câu chuyện không phải *"thư viện rỗng, hãy khai thác kho cũ để
lấp"*. Thật ra:

1. Bước nghiệp vụ lặp nhiều nhất — **đăng nhập theo vai trò** — **đã được trích từ lâu**, và 84% file
   đang dùng nó. Nó chỉ không nằm ở `tests/fe/lib/`.
2. Lớp widget Telerik — thứ lặp nhiều thứ hai — **cũng đã trích** vào `_widget/`, nhưng **chưa ai import**.
3. Phần còn lại của kho **không lặp liên-task** vì bốn task làm **bốn màn khác nhau** (hồ sơ trường · hồ
   sơ lớp · học sinh · đội ngũ). Selector của chúng khác nhau là đúng, không phải thiếu sót.

**Hệ quả thẳng:** lấp thêm vào một thư viện có 0 người import thì **token không rẻ đi một đồng nào**.
Thứ đang chặn không phải "thư viện thiếu đồ", mà là "chưa có đường nối từ task tới thư viện".

---

## 6. Điều kiện DỪNG đã chạm — và hai phương án

Prompt ghi: *"Ứng viên không đạt 'lặp ≥2 task VÀ chạy ổn định': **không** đưa vào thư viện (kho phải
sạch, không nhồi rác)."*

Đo ra: vế *"chạy ổn định"* **không đo được** (cờ chưa cài), và vế *"lặp ≥2 task"* chỉ lọc ra ~10–12 ứng
viên thật, trong đó 2 nhóm lớn nhất **đã nằm sẵn trong thư viện**.

| | Phương án | Hệ quả |
|---|---|---|
| **A** ✅ đề xuất | **Đổi trọng tâm: NỐI trước, LẤP sau.** Lấp 10–12 ứng viên thật đã chọn lọc, rồi dùng **một task mốc** chuyển sang import từ `tests/fe/lib/` và đo token trước/sau trên chính task đó. Mốc "≥70% khớp cùng module" **đo rồi mới hứa**, không hứa trước. | Chứng minh được "token rẻ thật" trên dữ liệu thật, thay vì lấp cho đầy kho |
| B | Lấp theo đúng chữ prompt: trích hàng loạt từ 421 file | Phần lớn là bước **task-specific** không task nào khác dùng lại ⇒ đúng thứ prompt cấm. Và vẫn 0 người import. |

---

## 7. Cần bạn chốt trước khi tôi trích xuất

1. **Chọn phương án A hay B.** (Tôi đề xuất A.)
2. **Module nào lấp trước.** Đề xuất theo thứ tự giá trị đo được:
   - **combobox** (`chonCombo` 4 task · `docCombo` 3 · `datCombo` 3) — bù nốt vào `_widget/` đã có;
   - **lưới** (`docLuoi` 3 · `docCot` 3) — chưa có gì trong thư viện;
   - **evidence** (`khoanh` 3 task, 659 ký tự) — hàm to nhất trong nhóm giống nhau;
   - **thông báo** (`docThongBao` 3) — [bộ nhớ dự án đã ghi](../../CLAUDE.md) rằng selector thông báo
     thường **không bắt được toast**, nên đây là chỗ một bước dùng chung đáng giá nhất;
   - **xlsx** (`docXlsx` 3) · **upload** (`taiLen` 2) · **form** (`moForm` 2).
3. **Task mốc để đo token trước/sau** — và task đó có được phép chạm UAT không. Nếu không, tôi đo trên
   fixture và nói rõ đó là điều kiện đo.
4. **`--chay-on-dinh` chưa cài**: cài nó (đọc `testcase-status.json` dưới `test-results/**`) hay bỏ tiêu
   chí ổn định khỏi đợt này và ghi rõ là **chưa gác**?

---

## 8. Việc sẽ KHÔNG làm, và vì sao

- **Không gọi** `lib:buildout`, `lib:coverage`, `steps:dup` — không tồn tại.
- **Không báo tỉ lệ khớp "sau khi lấp"** dựa trên ước lượng. Chỉ báo sau khi `steps:match` chạy thật.
- **Không tự ký `active`** cho bước nào. `steps:promote` cần người ký, và 17 mục hiện có đều chưa đủ
  điều kiện tự động (`ti_le_on_dinh` còn `null`).
- **Không chạm UAT** trong khâu khai thác và trích xuất — chỉ đọc `outputs/`, chỉ ghi `tests/fe/lib/`.
- **Không hứa trước** mốc "≥70% khớp" và "giảm ≥50% token". Mốc nền đang là **18–19%**, và chặng từ 19%
  lên 70% không nằm trong 10–12 ứng viên này.
