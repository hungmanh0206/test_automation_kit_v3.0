# v2.8.0 — Báo cáo cuối: dùng lại script Phase 2

> Viết cho: **chủ repo và QA lead** — người quyết có dùng tầng này cho task tiếp theo hay không.
>
> Bản này KHÔNG lặp lại CHANGELOG. Nó trả lời bốn câu: đo được gì · mục tiêu nào không đạt và vì sao ·
> tiền đề nào của prompt sai · việc gì còn chờ, chờ ai.

## 1. Mục tiêu nào đạt, mục tiêu nào không

| # | Mục tiêu §G | Đích | Đo được | |
|---|---|---|---|---|
| 1 | Dùng lại, module KHÁC | ≥50% | **22%** (1.285/5.886 mệnh đề) | ✗ |
| 2 | Dùng lại, CÙNG module | ≥70% | — | **chưa đo được**: không có cặp task nào trên cùng màn |
| 3 | Chạy lại không đổi | 0 lời gọi AI | có máy ĐẾM (`replay:check`), đo trên fixture: 23 lượt | ✗ cho fixture, ✓ cho case đủ |
| 4 | Sinh/sửa automation | token −50% | **chưa đo được** — xem §2 | — |
| 5 | 5 bug gài → bắt 5/5 | 5/5 | **chưa đo được** — xem §2 | — |
| 6 | `mutation_check` không giảm | không giảm | **chưa đo được** — xem §2 | — |

Hai mục đo được mà **không đạt**, và con số cách đích khá xa (gấp đôi tới gấp năm). Ba mục không đo được
thì **không được đọc thành "đã đạt" hay "không đạt"** — chúng chưa có phép đo nào, và `reuse:measure` in
ra lý do thay vì in một con số.

**Nhưng con số 22% đó không phải trần của thiết kế.** Đây là phần quan trọng nhất của cả báo cáo:

| Đo trên | Khớp vào danh mục bước |
|---|---|
| Case viết tự do, danh mục 6 mục (đầu đợt) | 0–3% |
| Case viết tự do, danh mục 17 mục (sau §A0) | **8–19%** |
| Case viết **đúng chuẩn §K**, cùng danh mục đó | **79%** |

Cùng một bộ khớp, cùng một danh mục. Khác duy nhất ở **cách viết câu bước**. Chỉ **31%** câu bước hiện
đang bọc giá trị trong nháy kép; 69% còn lại viết giá trị trần, nên hai câu cùng nghĩa ra hai khung khác
nhau. Khoảng cách 19% → 79% là phần **§K** mua được, và nó **không** mua được bằng một bộ khớp tốt hơn.

## 2. Vì sao ba mục không đo được, và cần gì để đo

| Mục | Vì sao | Cần gì |
|---|---|---|
| token −50% | Mốc duy nhất đang có (`docs/token-diet/baseline.dynamic.json`) là token theo **phiên làm việc**, không phải theo một lượt "sinh automation cho một module". Chia số phiên cho số module là bịa mẫu số. | Một lượt đo có mốc: ghi token của MỘT lượt sinh automation đường cũ, rồi lặp lại đường mới trên cùng module. |
| 5 bug gài → 5/5 | Spec biên dịch hiện gần như không có lời gọi bộ kiểm nào — mọi dòng kỳ vọng rơi vào `TODO-ORACLE`, vì bộ biên dịch **không bịa giá trị kỳ vọng**. Spec không phán gì thì không bắt được bug nào, và 0/5 đó nói về tình trạng thư viện chứ không về thiết kế. | Dòng kỳ vọng viết theo chuẩn §K (giá trị bọc nháy) để `compile:spec` sinh được lời gọi `_checks/`. Phần máy đã xong. |
| `mutation_check` | Nó mở chromium và bóp méo response ở tầng `page.route()` **trên UAT**. Không có đường chạy offline, và CLAUDE.md §2 đòi xác nhận trước mỗi lượt chạm UAT. | **Chủ repo duyệt một lượt chạm UAT.** Chạy trước và sau, trên cùng catalog. |

## 3. Năm tiền đề của prompt/thiết kế KHÔNG đúng với cây code này

Mỗi dòng dưới đây là một thứ thiết kế nói, mà phép đo bác bỏ. Chúng được ghi lại vì chúng sẽ bị nói lại.

1. **`typescript` trong repo không có compiler API** (`typescript@7.0.2` chỉ export `version`). Khai thác
   AST phải dùng `node:module.stripTypeScriptTypes` + `acorn`.
2. **Code cũ không có locator ngữ nghĩa để khai thác**: 1.387/1.388 lời gọi là `page.locator()` thô, **0**
   `getByRole`. Nên không có gì để "nâng cấp dần" — phải dựng tầng mới.
3. **Thứ lặp lại nhiều nhất không phải bước nghiệp vụ, mà là NỘI THẤT WIDGET**: ba hình dạng Telerik
   chiếm 475/1.388 = **34%** mọi lời gọi định vị. Vì thế chèn thêm tầng L0.5, không có trong thiết kế gốc.
4. **"Gộp đồng nghĩa là đòn bẩy" — sai**: 25% → 26%. Đòn bẩy thật là **tách mệnh đề** (37% → 47%), một
   bước không có trong thiết kế.
5. **Hai mục tiêu ≥70%/≥50% không đạt được trên bộ case hiện có**, và lý do không phải bộ khớp yếu.

Thêm ba tiền đề của chính tôi bị bác trong lúc làm:

6. **"Số trần không phải tham số"** — sai ở đúng chỗ quan trọng: `Stt 87` là thứ xác định **field nào**.
   Sửa xong, tỉ lệ dùng lại của CSDL-9001 đi từ 13% lên 19%.
7. **"`readonly` và `disabled` cho hai trạng thái khác nhau"** — sai: `fill()` của Playwright ném cho cả
   hai. Phân biệt nằm ở `dau_hieu`, không ở trạng thái.
8. **"Danh sách `chuan` của `step_phrasing.json` là danh sách động từ được phép"** — sai: nó là dạng
   chuẩn của các **nhóm đồng nghĩa**. Dùng nó làm allow-list thì phạt **58%** số mệnh đề vì dùng chữ
   "đọc".

## 4. Lỗi của chính bộ máy, và máy nào bắt được

Phần này quan trọng với người bảo trì: nó cho biết lớp gác nào đang thật sự gác.

| Lỗi | Máy bắt được |
|---|---|
| `canonical_check` đọc `kqDrift.lech` — một khoá KHÔNG tồn tại — nên `soLech` luôn 0 và cửa **luôn mở** | phép đối chứng ÂM |
| Hai gate canh "Excel là nguồn" **cùng xanh** trong khi 7 bề mặt vi phạm (một gate chỉ bắt `source of truth` dấu cách, repo viết gạch nối) | đếm tay trước khi sửa |
| `compile:spec` sinh import dính ổ đĩa (`from './D:/Project/...'`) — file trông bình thường, chỉ vỡ lúc Playwright nạp | chạy thật trên thư mục khác ổ |
| Hai module cắt 60 ký tự ra cùng slug ⇒ file thứ hai **ghi đè** file thứ nhất im lặng: báo 196 file, trên đĩa 195 | máy canh so số báo với số trên đĩa |
| `ghiDuoc()` đọc lại **không rời ô**, nên ô bị JS nắn khi blur vẫn báo là ghi được — và `ghi()` cùng file CÓ blur, tức hai hàm nói hai điều khác nhau, cái sai lại là hàm **đo** | fixture có ô tự hoàn nguyên |
| Gói phát hành mang 16 máy gác của v2.8.0 nhưng **0 file** `tests/fe/lib/**` — người nhận có máy gác mà không có thứ chúng gác | đếm `collect()` trước khi đóng gói |
| Một câu trùng hai bước (`kiểm ô {} có bị khoá không` của combobox và của textbox) | `steps:catalog` phép 5 |
| Bộ dò "Excel là nguồn" của tôi tố cáo **chính dòng RULE_GLOBAL đang phát biểu luật** | đối chứng hai chiều |

**Sáu lần trong đợt này một bộ dò bằng chữ của tôi báo oan.** Cách chữa đã thành luật: mỗi mẫu dò phải có
**đối chứng hai chiều** ghim ngay cạnh nó — câu sai phải khớp, VÀ câu đúng phải không khớp. Thiếu chiều
thứ hai thì cách sửa dễ nhất cho một gate ồn ào là nới mẫu tới lúc nó không bắt gì nữa.

## 5. Một phép đo về chính lượt chạy test, và một dự đoán của tôi bị bác

Vài spec của đợt này đo **hành vi theo thời gian** trên app fixture: dropdown có hiện ra trong 15 giây
không · ô có nhận chữ rồi giữ sau khi rời ô không. Chúng vỡ dưới tải, và việc tìm ra **vỡ ở đâu** mất ba
phép đo vì dự đoán đầu tiên của tôi sai.

| Phép đo | Kết quả |
|---|---|
| Bộ offline 8 file, `workers` mặc định (nửa số core) | 2 test ĐỎ · cả lượt **2.1 giờ** |
| Hai file browser đó chạy riêng, `--workers=1` | 47/47 · **2.0 phút** |
| Cả suite 1.838 test **trong gói phát hành**, workers mặc định | **46 ĐỎ** |
| `buildout-hoso.spec.ts` chạy riêng **trong chính gói đó**, `--workers=1` | **30/30 · 45 giây** |
| Hai file browser chạy **cùng nhau**, `--workers=4`, trong repo | 47/47 · 1.4 phút |

**Dự đoán đầu của tôi — "hai spec browser tranh chấp nhau" — bị phép đo cuối bác bỏ**: ép chúng chạy đồng
thời với 4 worker thì vẫn xanh. Và dòng thứ tư bác giả thuyết "gói hỏng". Ngưỡng vỡ nằm ở **tải của cả
suite**, không ở gói và không ở bản thân spec.

**Cách chữa, và vì sao không chữa kiểu khác:**

- `verify_release` chạy suite trong gói với `--workers=2`. Không dùng `--workers=1` vì lượt verify đã mất
  ~25 phút và một worker kéo dài gấp nhiều lần mà không mua thêm thông tin.
- **Không nới ngưỡng chờ.** Nới để chúng xanh dưới tải là xoá mất đúng thứ chúng đo.
- Cố ý **không** sửa `playwright.config.js`: file dùng chung, đổi `workers` ở đó ảnh hưởng mọi lượt chạy
  của người khác (CLAUDE.md §5). Cách chạy ghi ở đầu spec, và `smoke:run` ghim `--workers=1`.

Bài học chung hơn: một test đo thời gian là hợp lệ, nhưng nó **không được chạy dưới tải tuỳ ý**. Harness
phải khoanh tải, chứ không phải test phải nới ngưỡng.

## 6. Việc còn chờ, và chờ ai

| Việc | Chờ ai | Vì sao chưa làm |
|---|---|---|
| Đo `mutation_check` trước/sau | **chủ repo duyệt một lượt chạm UAT** | §2 đòi xác nhận; không có đường offline |
| Đo "5 bug gài → 5/5" | — | cần dòng kỳ vọng viết theo chuẩn §K; phần máy đã xong |
| Đo token −50% | — | cần một lượt có mốc, xem §2 |
| Neo control cho 4 cấp còn lại (MN, TH, THPT, GDTX) | **chủ repo duyệt một lượt discovery trên UAT** | catalog chỉ có neo ở THCS (87/433 = 20% toàn bộ) |
| Thăng bước từ `draft` lên `active` | — | cần ≥3 lượt chạy thật; `ti_le_on_dinh` hiện là `null` (CHƯA ĐO) cho cả 17 mục, và `steps:promote` từ chối thăng |

**Mọi bước trong danh mục đang là `draft`**, nên theo luật của chính kit thì chưa bước nào được dùng để
kết luận PASS. Đó là trạng thái đúng: chúng chưa chạy trên UAT lần nào.

## 7. Dùng tầng này cho task tiếp theo thì làm gì

1. `npm run stt:map -- --spec <đặc tả>.md --catalog <ui_catalog>.json --ghi` — dựng bản đồ Stt→nhãn.
2. `npm run steps:suggest -- --task <K>` — xem câu bước nào lệch chuẩn, **sắp theo số lượt** (sửa một
   khung lặp 19 lượt rẻ hơn sửa 19 câu lẻ).
3. `npm run steps:match -- --task <K>` — xem bao nhiêu mệnh đề dùng lại được, bao nhiêu phải viết mới,
   **gom theo màn**.
4. `npm run compile:spec -- --task <K>` rồi `npm run compile:check` — sinh spec, và case còn TODO ra
   `test.skip` nên **không bao giờ** thành PASS.
5. `npm run replay:check -- --task <K>` — còn bao nhiêu lượt phải nhờ người/model.
6. `npm run smoke:gen -- --catalog <ui_catalog>.json --out <dir>` rồi `npm run smoke:run -- --spec <file>`
   — kiểm thư viện còn nói đúng về app. Mặc định **nông và chỉ-đọc**.
