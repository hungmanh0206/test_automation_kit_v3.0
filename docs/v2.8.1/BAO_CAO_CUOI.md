# v2.8.1 — Báo cáo cuối

> Hai trục mở rộng (⑥ phân quyền · ⑦ oracle tính toán), hai chiều Phase 1 (§24 Thời gian · §25 Dữ liệu
> cũ), và việc không có trong kế hoạch nhưng chiếm phần lớn công: **gom bảy bản sao của cùng một danh
> mục trục về một nguồn**.

## 1. Kết quả một dòng

| | |
|---|---|
| Commit | `0e2e2a5` (1a) · `4a1d007` (1b) · `2c94e0a` (⑥) · `a2324b0` (⑦) · `f9949a0` (§24/§25) · `1d457e1` `7024479` `e1a0eef` (ba vòng sửa do `release:verify` bắt) |
| Cả bộ `tests/fe/infra` | **1.982 xanh · 0 đỏ · 0 bỏ qua** |
| `release:verify` (gói, thư mục sạch) | **15/15 bước đạt** · trong gói **1.829 xanh · 44 bỏ qua** |
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

## 3b. Ba vòng `release:verify` đỏ — repo xanh không nói gì về gói

Bài học v2.8.0 lặp lại nguyên vẹn, và cả ba chỗ đỏ đều là code viết trong chính đợt này. Không chỗ nào
repo nhìn thấy.

| Vòng | Đỏ ở đâu | Vì sao repo không thấy |
|---|---|---|
| 1 | `npm run typecheck` — 3 lỗi `TS2339` ở `oracle-calc.spec.ts`, và `depth-band-policy` đỏ trong gói | Playwright chạy `.ts` **transpile-only**, không kiểm kiểu; và repo dùng `risk_model.json` còn gói dựng từ `risk_model.example.json` — bản mẫu vẫn dạy `concurrency`/`reverse` |
| 2 | `oracle-calc.spec.ts` — "bộ oracle thật phải SẠCH" | gói mang `knowledge/domain/` **rỗng**, nên máy kết cả hai oracle là "oracle ma" rồi exit 1: người nhận kit vừa cài đã thấy hai lỗi bịa |
| 3 | `oracle-calc.spec.ts` — chính test ĐỐI CHỨNG | nó mượn kho rule của repo để dựng ca xấu; một đối chứng phụ thuộc dữ liệu nơi nó chạy thì nó đo nơi chạy, không đo cái máy nó định canh |

Ba cái máy sinh ra từ ba vòng đó: `full:suite` nay **typecheck trước và không ghi sổ khi typecheck đỏ**;
`depth-band-policy` đối chiếu **cả bản mẫu** với `PLAN`; `oracle_calc_check` phân biệt **kho rỗng
(`CHƯA KIỂM`)** với **ref không tra ra (oracle ma)**.

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

- **⑥ và ⑦ ĐÃ chạy trên dữ liệu thật** (14/10/2026, CSDL-9001, một lượt `discover` CHỈ ĐỌC trên UAT có
  chủ dự án xác nhận). Kết quả, và ba chỗ nó bắt được chính thiết kế của tôi:

  | | |
  |---|---|
  | ⑦ `oracle:calc` | `proven=2` — 2 oracle neo vào rule `active`, 118 rule trong kho |
  | ⑥ `authz:expand` | 179 biến thể · `proven=0` · 126/213 case thuộc band đòi ⑥ |
  | ma trận vai trò × route | 240 ô — **120 `verified`** (masteradmin) · **120 `unknown`** (vai trò `truong` chưa có tài khoản) · 0 finding ẩn≠cấm |
  | `expansion_audit` | CSDL-9001 từ 1/7 lên **2/7 trục** (`persist, oracle_calc`) |

  **① Thiết kế bắt ⑥ phải có ≥2 tài khoản là bắt quá rộng.** `knowledge/domain` có hai rule `active` phủ
  đúng hai nhóm còn lại và đo được bằng MỘT tài khoản: `BR-NHANSU-029` (đổi `id` sang đơn vị khác phải bị
  từ chối · `isview=1→0` không được thành Sửa · URL popup chưa đăng nhập bị đẩy về Đăng nhập) và
  `BR-HSLOP-025` (tài khoản gán một phân hiệu chỉ thấy phân hiệu đó, bộ lọc không có "Tất cả phân hiệu").
  Bắt cả ba nhóm chờ ma trận nghĩa là một dự án một-vai-trò **không bao giờ** đo được phân quyền.

  **② Nổ tổ hợp.** Bản đầu đẩy một biến thể cho mỗi (case, vai trò, route) trong vòng lặp case ⇒ **3.035
  biến thể** cho một task. Một danh sách cỡ đó không ai đọc, và nó cũng sai: planner KHÔNG biết case này
  đụng route nào, nên nhân case với MỌI route là bịa ra một quan hệ không có. Nay một biến thể cho mỗi
  (case, vai trò), kèm số route và số ô đã kiểm chứng.

  **③ `proven` thổi phồng 2.880 lần.** Bản đầu tính `proven = verified + finding` ⇒ `proven=2880`. Nhưng
  những ô đó chỉ nói "masteradmin VÀO ĐƯỢC route này" — không ô nào được so với một kỳ vọng. Phân quyền
  chỉ PASS/FAIL khi có neo nói vai trò nào ĐƯỢC hay KHÔNG ĐƯỢC vào đâu (`CLAUDE.md` §3). Nay 120 ô đó
  được in ra như **QUAN SÁT**, và `proven=0` — con số đúng, vì chưa biến thể nào được CHẠY.

  Còn lại để ⑥ có `proven>0`: chạy 4 biến thể đo-được-bằng-một-tài-khoản (chúng là phép đo Phase 2, cần
  một spec), và xin tài khoản vai trò `truong` cho nhóm dọc.

  Hai ghi chú về lượt `discover`: lần đầu **không bò được màn nào** vì tôi chỉ nạp session cho phần ma
  trận mà quên `--storage-state` cho lượt bò chính — cửa báo đúng và exit 1. Lần hai bò **120 màn**, độ
  đầy đủ 45% (dưới ngưỡng 80%, cảnh báo không chặn) và tóm tắt vượt trần 2.000 token.

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
