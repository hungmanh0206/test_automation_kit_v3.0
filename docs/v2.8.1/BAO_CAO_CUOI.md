# v2.8.1 — Báo cáo cuối

> Hai trục mở rộng (⑥ phân quyền · ⑦ oracle tính toán), hai chiều Phase 1 (§24 Thời gian · §25 Dữ liệu
> cũ), và việc không có trong kế hoạch nhưng chiếm phần lớn công: **gom bảy bản sao của cùng một danh
> mục trục về một nguồn**.

## 1. Kết quả một dòng

| | |
|---|---|
| Commit | `0e2e2a5` (1a) · `4a1d007` (1b) · `2c94e0a` (⑥) · `a2324b0` (⑦) · `f9949a0` (§24/§25) |
| Cả bộ `tests/fe/infra` | **1.980 xanh · 0 đỏ · 0 bỏ qua** |
| Ngân sách prompt | `✓ ĐẠT` — **không nới một con số nào** trong `prompt_budget.json` |
| Tiền đề bị phép đo bác | **7** (xem §3) |
| Chạm UAT | **không có lượt nào** |

## 2. Làm được gì

**Một nguồn cho danh mục trục** — `scripts/lib/expansion/axes.js` giữ `so` · `band` · `phase` ·
`artefact` · `chi_phi` cho 7 trục và chiều ngược. Sáu máy còn lại sinh từ nó hoặc bị đối chiếu với nó
bằng `tests/fe/infra/expansion-gates.spec.ts`.

**`expansion_audit` lần đầu đối chiếu được band → trục đã chạy.** Trước v2.8.1 không máy nào trả lời
được câu "case band high này đã mở đủ trục mà band của nó yêu cầu chưa", vì bảng `depth.PLAN` chỉ được
*in ra* ở hai chỗ. Kết quả lượt đầu: **3/5 task đỏ** vì thiếu trục mà band của chúng đòi.

**Trục ⑥ `authz:expand`** — liệt kê biến thể dọc · ngang (IDOR) · ẩn≠cấm quanh mỗi case band high. Máy
không gửi request nào; biến thể authz-GHI được liệt kê nhưng gắn `chi_chay_tay`.

**Trục ⑦ `oracle:calc`** — oracle tính kỳ vọng từ đặc tả, neo vào rule có mã trong `knowledge/domain`,
bắt buộc có **cặp đối chứng** (ca đúng + ca lệch). Hai oracle thật: `BR-HSTRUONG-010` và `BR-HSLOP-035`.

**Chiều §24 `[Time]` và §25 `[Legacy]`** — nối đủ **năm** chỗ khai, có `dimension-wiring.spec.ts` canh.

**Mutant `grant_permission`** trong `mutation_check` — lật cờ quyền `false → true` ở tầng `page.route()`.

## 3. Bảy tiền đề bị phép đo bác

Ghi ra vì chúng là phần có giá trị nhất của đợt: mỗi dòng là một chỗ mà làm theo thiết kế sẽ ra một thứ
trông đúng.

| # | Tiền đề | Đo ra |
|---|---|---|
| 1 | "bốn máy khai bốn bộ từ vựng" | **bảy** bản sao, không phải bốn |
| 2 | `reverse` là một trục | `CLAUDE.md` gọi nó là "**+** chiều ngược"; và `finding.js` hiểu nó theo nghĩa KHÁC HẲN (huỷ/hoàn) |
| 3 | ⑥⑦ còn trống | `finding.js` đã chiếm sẵn `⑥concurrency`/`⑦reverse` |
| 4 | "sinh biến thể cho mỗi vai trò THẤP HƠN" | repo **không khai thứ bậc vai trò ở đâu cả** |
| 5 | "ma trận vai trò × route (v2.6.0)" đang có sẵn | **không artefact nào trên đĩa** chứa `role_route_matrix` |
| 6 | "`RULE_GLOBAL` 20 → 22 chiều" | không file canonical nào khai con số chiều; chỗ lệch thật nằm ở hai template run_* ("15 chương") |
| 7 | "`tc_validator` nhận tag mới" | nó không liệt kê chiều — uỷ quyền cho `dim:coverage` |

Thêm một chỗ nữa không nằm trong thiết kế: **bốn điểm nối hoá ra là năm** (`load_map.json`).

## 4. Chỗ máy bắt được người làm

Bốn lần trong đợt này, và cả bốn đều là lý do các máy đó tồn tại.

1. **Cửa `full:suite`** (dựng ở lượt trước) làm đỏ 2 test ở hai file tôi không đụng tới khi đổi `PLAN`.
   Nếu chỉ chạy spec liên quan như cách cũ thì cả hai đi lọt.
2. **`depth.estimate` crash** với `Cannot read properties of undefined (reading 'loads')` — chi phí của
   trục mới hiện ra bằng một lần vỡ, vì bảng hệ số là bản sao duy nhất không ai canh.
3. **`release-pipeline.spec.ts`** phát hiện bước 2 thêm 2 file track mà tôi quên cập nhật QUICKSTART.
4. **`rule:parity`** bác một lần cắt token: tôi gỡ con trỏ "(Đầy đủ: RULE_GLOBAL §7 trục.)" để lấy 2
   token, và nó đỏ với đúng câu cần nghe — *"luật không có con trỏ thì rút gọn là xoá luật"*.

Và **đối chứng âm** cứu bốn mẫu dò khỏi dương tính giả: `403` khớp trong `"mã 4030"`; `quyen` khớp
`so_quyen_sach`; cờ `/i` làm `[A-Z]` khớp chữ thường nên `canhBaoHienThi`/`island` thành cờ quyền; và
`ui` khớp trong `gui` của `"gui yeu cau mo khoa"`.

## 5. Việc còn nợ — nói thẳng

- **⑥ và ⑦ chưa chạy trên dữ liệu thật.** Cả hai sẽ báo `CHƯA ĐO`/`proven=0` cho tới khi có ma trận vai
  trò × route (cần ≥2 tài khoản UAT) và có case gắn `[Time]`/`[Legacy]`. Đó là trạng thái ĐÚNG — máy nói
  thẳng nó chưa đo được gì — nhưng nó có nghĩa hai trục mới **chưa chứng minh được gì trên dữ liệu
  thật**. Chủ dự án đã chốt: đóng v2.8.1 trước, chạy UAT ở lượt sau.
- **Suite KHÔNG xanh ổn định — hai spec nhạy tải.** `discovery-api-inventory.spec.ts` (`goi_tu`) và
  `discovery-injection.spec.ts` (`gộp theo (nhóm, màn)`) mỗi cái đỏ một lượt trong `full:suite` rồi xanh
  **3/3 khi chạy riêng**. Cả hai đều bò app fixture rồi ghim con số đếm được.

  Chi tiết đáng chú ý hơn cả việc nó flaky: lượt đỏ của `discovery-injection` tìm ra **12** điểm nhập
  trong khi mốc ghim **11** — tức dưới tải nó thấy NHIỀU hơn, không phải ít hơn. Nếu vậy thì con số 11
  đang ghim có thể chính là phía **đếm thiếu**, và lượt "xanh" là lượt bò chưa tới nơi. Một công cụ khám
  phá mà kết quả đổi theo tải máy thì nó báo bề mặt khác nhau vào những ngày khác nhau.

  Vì thế con số **1.981 xanh · 0 đỏ** ở §1 là **một lượt chạy đạt**, KHÔNG phải bằng chứng suite xanh ổn
  định. Chưa sửa: chủ dự án chốt đóng v2.8.1 trước, và sửa đúng cách là làm lượt bò tất định (chờ mạng
  lặng / DOM ổn định) chứ không phải nới con số cho khớp.
- **Band của ⑥ chỉ `high`.** Thiết kế ghi "medium: khuyến nghị", nhưng `PLAN` không có bậc khuyến nghị —
  chỉ có đòi hoặc không. Nâng lên medium khi đã có ma trận thật ở vài task, kèm số đo.

## 6. Dùng hai máy mới

```bash
# ⑥ — liệt kê biến thể phân quyền quanh case (KHÔNG gửi request nào)
TASK_ENV=profiles/<TASK>/task.env npm run authz:expand -- --config requirements/authz_matrix.json
#   thiếu ma trận ⇒ exit 2 (CHƯA ĐO), báo cáo vẫn ghi kèm lý do
#   config khai `thu_bac` (vai trò CAO→THẤP) và `chu_so_huu` (trường định danh chủ sở hữu/đơn vị)

# ⑦ — canh bộ oracle tính toán
npm run oracle:calc            # 0 oracle ⇒ exit 2 (CHƯA KIỂM)
npm run oracle:calc -- --enforce
```

Viết một oracle mới: thêm hàm vào `tests/fe/lib/oracles/<miền>.ts`, `dangKy()` với `oracle_ref` trỏ một
rule `active` trong `knowledge/domain`, và **bắt buộc** kèm ít nhất một ca `dung` và một ca `lech` — lấy
ca lệch từ `examples` của chính rule đó, đừng tự nghĩ ra.
