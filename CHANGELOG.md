# Changelog

> Lịch sử thay đổi **kit dùng chung** (shared). Mỗi mục là một **đợt phát hành** `vX.Y.Z` kèm ngày và
> nhóm chủ đề; nguồn là `git log main` (kèm commit hash để tra ngược). `npm run version:check` gác
> việc mục đỉnh khớp `package.json` và thứ tự giảm dần.
>
> *(Câu cũ ở đây phủ nhận việc kit đánh số theo semver. Đo 30/10/2026: 23/23 mục đều mang
> `## vX.Y.Z`, nên câu ấy đã lạc hậu từ lâu và dạy người đọc sai về cách file này được ghi.
> `version:check` nay chặn nó — và chặn bằng phép so CHỮ, nên chính ghi chú này cũng phải tránh
> viết lại nguyên văn câu bị cấm. Đó là lần thứ ba trong một phiên văn của tôi làm nổ phép kiểm
> của tôi.)*
>
> Vì sao cần file này: mọi thay đổi ở `playwright.config.js`, `package.json`, `scripts/**`, `prompt_templates/**`,
> `.agent/**`, `tests/support/**` đều là **shared change** (xem `RULE_GLOBAL.md` §Shared Change Gate) —
> ảnh hưởng mọi story đang chạy. Mỗi mục ghi **vấn đề → cách chữa**, không chỉ liệt kê tính năng.

## v2.9.11 — 2026-11-03 — Một cửa tố 7/8 hiện trạng thì CỬA sai

Bản này mang ra người nhận kit **5 commit** mà `v2.9.10` chưa có, gồm một máy gác chặn được một
lớp hỏng mà trước đó không có gì bắt: **lượt execute chấm PASS trên cấp học sai**.

### `env:scope` — profile phải ghim cấp học nó đang đo

`tests/fe/support/opsLogin.ts:419`: thiếu `QEMIS_CAP_HOC` thì app giữ mặc định **"Mầm non"**, và nó
chỉ `console.warn`. Lượt chạy **không gãy** — nó đăng nhập được, đi hết các bước, chụp đủ ảnh, rồi
chấm **PASS** trên một cấp học không phải cấp mà case nói tới. Không ca nào đỏ.

Đo được lúc dựng cửa: `profiles/CSDL-3544` và `profiles/CSDL-4039` không ghim khoá này, mà **4039 là
EMIS THCS**. Cả hai có **0 ảnh evidence** nên chưa từng execute, tức cửa bắt được khe này *trước khi*
nó kịp sinh ra một bộ verdict sai.

Cửa cũng gọi tên **bí mật chết**: khoá trong `.env` mang hậu tố không khớp khuôn `<TIEN_TO>_<HAU_TO>`
mà `uatDbClient.ts` đọc, ví dụ `LIB_MASTER_DB_RO_USERNAME_ADMIN`, thì không đường nào chạm tới nó.
Bí mật không ai đọc được là rủi ro thuần.

`env:scope` quét cả repo nên **không vào CI được**: CI không có `.env` lẫn `profiles/` nên nó trả
`KHÔNG PHÁN ĐƯỢC` (exit 2), đúng bài học cửa ⑩ ở `v2.9.10` — thà im còn hơn đoán. Nên chỗ **chặn thật**
nằm ở `preflight_gate.js --mode phase2`, qua hàm thuần `kiemGhimCapHoc()`: chạy trên máy có profile,
ngay trước execute, đã biết `TASK_KEY`. Một cửa CHẶN mà không ai gọi chỉ là đồ trang trí.

### Bản luật ĐẦU của cửa này đã sai, và đó là phần đáng đọc nhất

Nó bắt mỗi profile tự khai `OPS_USERNAME`/`OPS_PASSWORD`, dựng từ câu "creds ở `task.env`" trong
`CLAUDE.md` §5. Chạy thật thì nó tố **7 trong 8 profile**.

> Khi một cửa mới tố gần hết hiện trạng, giả thuyết đầu tiên phải là **CỬA SAI**, không phải hiện
> trạng sai.

Thêm chế độ `--soi` để **đo rồi mới chốt luật**: cả 8 profile đều ghim `QEMIS_SO` + `QEMIS_TRUONG`, và
một tài khoản QEMIS đổi được Sở/cấp/trường qua `/Manage/ChonTruong.aspx`. Nên `.env` chung giữ **một**
tài khoản app là **đúng thiết kế**, không phải lệch. Một cửa tố oan gần hết hiện trạng **tệ hơn không
có cửa**, vì người ta sẽ tắt nó.

Ca `P8` trong bộ đối chứng ghim lại kết luận ấy: thử bò về luật đã bị bác thì **5 ca đỏ**.

### `USER_GUIDE` từng chỉ sai chỗ nguy nhất

Bảng "tĩnh ↔ động" ở §2.2 từng xếp `OPS_*` (**tài khoản đăng nhập QEMIS**) vào cột *"Tĩnh → `.env`
chung"*. Bản sửa đầu lại viết *"`OPS_*` KHÔNG được để ở `.env` chung"*, **cũng sai** và chính là luật
tố oan 7/8 ở trên. Câu đúng nằm ở chỗ profile có ghim nổi **cấp học** hay không. Cả lịch sử ấy được
ghi ngay trong tài liệu để lần sau không sửa qua sửa lại.

`secret_scan.js` trước đây nói cộc lốc `dua vao .env`. Đó là câu **duy nhất** một QA đọc đúng lúc đang
cầm secret trong tay, nên nó quyết định thói quen. Nay nó phân loại: cred theo task thì vào
`profiles/<TASK_KEY>/task.env`; key của một tài khoản dùng chung mọi task thì vào `.env` ở gốc.

### Danh sách cửa phải TRÍCH TỪ workflow

`static-check.yml` chạy **32 lệnh**; bước `Gate repo` của `release.yml` chạy **8**. Trong đợt này tôi
tự lập một danh sách "13 cửa" rồi báo ĐẠT ba lượt liền, và nó thiếu **19 cửa** — trong đó có đúng
`library:drift`, cửa bắt lỗi của lượt đó. Mẫu số do người đo tự đặt thì con số không nói được điều nó
trông như đang nói.

### Đối chứng

12 phép phá, 12 lần đỏ, phá **bản chép** giữ đúng độ sâu tương đối chứ không `git stash` cây dùng chung
(`tests/fe/infra/_may_thu.ts`). Đáng kể: `P8` bò về luật đã bị bác (**5 đỏ**) · `Q1` gỡ dòng gọi khỏi
`runPreflight` (**1 đỏ**, nếu không có ca này thì chỗ nối là code không ai gác) · `Q3` nới regex từ
`=\s*\S` xuống `=` (**1 đỏ**, vì `QEMIS_CAP_HOC=` để **rỗng** vẫn là chưa ghim).

Cửa `env:scope` **không bao giờ in giá trị**, chỉ in tên khoá, và có một ca test khai đúng điều đó: một
cửa gác chỗ để bí mật mà rò ra log CI thì tự phản lại mục đích. Nó cũng cố ý **không** `require`
`runtime_config.js`, vì file đó gọi `loadEnvFiles()` lúc nạp module, tức kéo cả `.env` thật vào tiến
trình của chính cửa.

## v2.9.10 — 2026-11-03 — Ba bản vá mồ côi, và chỗ chúng thiếu người canh

**Vấn đề → cách chữa**

Ba phiên Claude song song để lại ba thay đổi **chưa commit** rồi **kết thúc**. Không ai còn nắm, nhánh
chưa có — một cú `git checkout` là mất hẳn. Cả ba đều **đang được dùng thật**, và cả ba đều **không có
spec nào canh**. Bản phát hành này commit mã của họ y nguyên và thêm **32 đối chứng**.

- **Bug ra Backlog không mang chứng cứ** — `tao_issue_con.js` đọc `--anh` và kiểm tồn tại, nhưng toàn bộ
  logic đính kèm nằm trong nhánh `--update`. Nhánh TẠO bỏ qua nó hoàn toàn, nên issue ra đời với 0 tệp
  trong khi mô tả nhúng `![image][...]` trỏ vào hư không, và log vẫn in `[OK] đã tạo`. Nay thiếu ảnh ⇒
  thất bại ồn ào kèm số thiếu và lệnh sửa.
- **Một verdict khai bằng tay đè lên một phép đo** — `perf_report.js` cho `so-case.json` thắng headline
  báo cáo hiệu năng. Lý do chính đáng (ngưỡng k6 không phải SLA), nhưng nếu đè mà KHÔNG nói ra thì báo
  cáo thành `PASS` cạnh một bảng số có ngưỡng vỡ. Bộ kiểm cũ **mù** với nhánh đó: mọi fixture k6 đều
  thiếu `run-meta.json` nên `docVerdictCase` luôn trả `null` — xanh vì không chạm tới, không vì đúng.
- **Một dòng log khai điều nó chưa đo** — `cap_nhat_issue.js` in `đính kèm trong comment: (không có)` kể
  cả khi ảnh đã đính thành công, vì response `POST comment` không trả mảng `attachments`.
- **Cửa chặn huỷ luôn bằng chứng của lượt nó vừa chặn** — `full_suite_ledger` ghi log SAU hai lệnh
  `return`, nên lượt `CHƯA ĐO ĐƯỢC` chỉ để lại 600 ký tự cuối. Một lượt `2436 xanh · 3 đỏ` lệch mẫu số đã
  mất dấu vì thế.
- **`sua_mo_ta.js`** — đường ghi đè nguyên mô tả issue, đã dùng thật trước khi có spec nào nhắc tới.

**Phép phá hoại không được chạm cây dùng chung**

`_may_thu.ts`: spec nhận đường dẫn script qua biến môi trường riêng, mặc định bản thật. Trước đó tôi
`git stash` chính file trên cây làm việc — cây dùng chung cho mọi phiên — và đã mở một cửa sổ ~15 giây
trong lúc một phiên khác nói họ còn dùng script ấy.

Hàm **ném** ở hai cửa thay vì lùi về bản thật, vì lùi là chỗ phép thử tự rỗng: lượt "phá hoại" chạy trên
bản THẬT, mọi ca xanh, và người đọc kết luận "đối chứng không bắt được gì" trong khi phép phá chưa bao
giờ xảy ra. Cửa thứ hai là thứ không ngờ: bản chép **phẳng** không nạp nổi `runtime_config` và chết lúc
khởi động, cho 4 ca đỏ trong đó MỘT ca lẽ ra phải xanh.

**Một lỗi trong mã của phiên khác mà tôi buộc phải sửa**

`process.exit(1)` ngay sau `fetch` làm **libuv sụp trên Windows** (`UV_HANDLE_CLOSING`, trong `async.c` cua libuv tren Windows)
⇒ mã thoát `0xC0000409` thay vì `1`. Script in đủ mọi dòng đúng rồi mới chết, và vì là tranh chấp thời
điểm nên nó **chập chờn**. Người gọi kiểm `exit === 1` để biết "thiếu evidence" sẽ trượt — đúng thứ bản
vá ấy sinh ra để chặn. Đo 5 lượt: `process.exitCode = 1` ⇒ 5/5 ra `1`, ~200ms.

**Đối chứng không rỗng, và phần đáng nói là các ca KHÔNG đỏ**

Mỗi bộ đều được nghiệm thu bằng cách phá bản vá rồi đếm ca đỏ. Ví dụ `cap_nhat_issue.js`: về bản cũ ⇒
**6/8 đỏ**, hai ca còn lại xanh **đúng như phải vậy** vì chúng kiểm hành vi đã có TRƯỚC bản vá. Nếu cả 8
cùng đỏ thì phép kiểm mới là thứ đáng nghi — nó đo "bản vá có tồn tại" chứ không đo từng tính chất.

## v2.9.9 — 2026-11-02 — Hai nhánh hiển thị không ai gác, và ba con số trong bảng tổng hiệu năng

**Vấn đề → cách chữa**

`perf_index.js` nhận hai nhánh hiển thị mới — `detailHtml` cho case đo ở **tầng UI** (không có lượt k6)
và chip `BLOCKED_SETUP` — mà **không có phép kiểm nào**. Đi viết đối chứng cho chúng thì lộ ra ba lỗ, và
cả ba cùng lớp hỏng với v2.9.7/v2.9.8: một con số **đúng** được đọc thành kết luận **rộng hơn**.

- **`BLOCKED_SETUP` bị đếm là "đã có lượt chạy"** — `daChay` là `tổng − CHUA_CHAY`, trong khi
  `verdict_taxonomy.json` nói thẳng verdict ấy có `executed: false`. Một case bị chặn vì thiếu hook được
  cộng vào số ĐÃ ĐO; đúng thứ CLAUDE.md §3 cấm. Nay trừ theo `CHUA_THUC_THI`, và phép kiểm **đối chiếu
  danh sách ấy với `executed: false` của sổ chuẩn** thay vì tin một bản chép tay.
- **Verdict bị đếm nhưng không có ô nào trong bảng tổng** — `ERROR` đã nằm trong `dem` mà không hiện ở
  đâu từ TRƯỚC; `BLOCKED_SETUP` vừa đi theo đúng đường đó. Bảng tổng vì thế không cộng lại thành tổng số
  case, mà không dòng nào nói ra là đang thiếu. Nay verdict có case mà không có ô viết tay thì tự được
  một ô. Phép kiểm **không neo vào danh sách verdict chép tay**: nó dựng một verdict chưa ai khai và đòi
  nó vẫn phải hiện ra, cộng ca "bảng tổng phải cộng lại bằng tổng số case".
- **`class="dui"` không có luật CSS nào** — link mở trang chi tiết mà không có số k6 được gắn class ấy để
  phân biệt, nhưng không rule nào cho nó, nên phân biệt là vô hình. Phép kiểm đòi **luật CSS phải tồn
  tại**, không chỉ đòi class có mặt trong HTML.

**Nghiệm thu, và mẫu số của nó**

10/10 trên fixture (dựng bộ canonical `.md` tối thiểu + `so-case.json`, gọi script thật bằng tiến trình
con; không k6, không chạm UAT). Đối chứng **không rỗng** — phá từng bản vá một, mỗi lần xác nhận phép phá
ĐÃ áp dụng: bỏ `CHUA_THUC_THI` khỏi `daChay` ⇒ 1 đỏ · bỏ `${oThem}` ⇒ 3 đỏ · bỏ luật CSS `.dui` ⇒ 1 đỏ ·
bỏ nhãn `NHAN.BLOCKED_SETUP` ⇒ 1 đỏ. Không lượt nào làm đỏ ca ngoài dự đoán; bản trả lại giống hệt từng
byte.

Nghiệm thu chạy trên **runner sạch** (dry-run `release.yml`), KHÔNG dùng máy local: ở đó có thay đổi chưa
commit trên đĩa và một lượt Playwright đang chạy, nên số ở máy không mô tả cây đã commit.

**Máy ngủ: phải đóng HAI cửa, không phải một**

Lượt đo dài bị cắt ngang suốt v2.9.7–v2.9.8 vì máy ngủ sau 10 phút. Tắt `standby` một mình vẫn chưa đủ:
`HIBERNATEIDLE` là **900s = 15 phút**, NGẮN hơn `release:verify` (~14 phút), và `powercfg /a` xác nhận
`Hibernate` có bật. Đã tắt cả hai ở AC, giữ nguyên DC. Đây là thiết lập máy chứ không phải mã của kit —
ghi vào đây vì mọi con số hiệu năng trước đó đều có thể đã bị nó cắt.

## v2.9.8 — 2026-11-02 — Bảy phép kiểm của chính tôi xanh ở máy tôi, đỏ trên runner — và lượt phát hành đỏ không ai mở

**Vấn đề → cách chữa**

v2.9.7 được tag, được tôi báo cáo là "nghiệm thu xong", và **lượt `release` trên tag đó ĐỎ**. Tôi báo
`static-check` xanh — đúng — rồi đọc nó thành "bản phát hành xanh", là thứ chưa ai chứng minh.
`static-check` chạy mỗi push; `release` chỉ chạy khi đẩy tag, và nó mới là cửa đóng gói rồi chạy gói từ
con số 0. Hai cửa khác nhau, tôi gộp làm một.

- **`release` đỏ trên tag `v2.9.7`** (01/11 14:57) — `full:suite` trên runner ra `2387 xanh · 7 đỏ · 24 bỏ
  qua`, trong khi cùng cây đó ở máy tôi ra `2418 xanh · 0 đỏ`. Cả 7 ca đỏ đều là phép kiểm **tôi vừa thêm
  trong v2.9.7**.
- **Một gốc duy nhất cho cả 7**: tiến trình con của chúng thừa kế biến môi trường của runner, mà đó đúng là
  biến thứ code bị đo rẽ nhánh theo. `playwright.config.js` đọc `CI` ⇒ `workers: CI ? 2 : <trần>`, nên 4
  đối chứng giả lập 32/64/4/12/1 lõi đều nhận về `2`: chúng đo runner, không đo trần. `version_check.js`
  đọc `GITHUB_REF_TYPE`/`GITHUB_REF_NAME` ⇒ lượt chạy từ tag bắt `package.json` khớp tên tag, nên 3 đối
  chứng dựng cây giả version `2.9.6`/`2.9.9` bị chặn bởi một phép kiểm chẳng liên quan gì tới thứ chúng đo.
- **`_gate_env.ts` sinh ra chính để chặn chuyện này, và đã hụt lần thứ hai.** 04/09/2026 nó hụt `RUN_ID`
  (`ci-regression` đỏ 5 lượt liên tiếp); lần này nó hụt nhóm **danh tính CI**. Thêm `CI_IDENTITY_ENV`
  (`CI` · `GITHUB_ACTIONS` · `GITHUB_REF_TYPE` · `GITHUB_REF_NAME` · `GITHUB_REF` · `GITHUB_EVENT_NAME`).
- **Và canh chính cái lọc** — `tests/fe/infra/gate-env.spec.ts`. Hai lần hỏng trước đều vì cái lọc là một
  mảng chuỗi mà không có gì canh: ai xoá một dòng thì mọi thứ vẫn xanh ở máy người xoá. Phép kiểm đáng giá
  nhất ở đây **quét mã nguồn thật** và đòi mọi biến `CI`/`GITHUB_*` mà gate đọc phải có trong danh sách —
  thêm một nhánh mới mà quên khai thì đỏ ngay, thay vì đỏ ba tuần sau trên một runner không ai mở log.
- **Một con số nữa trôi 22, ở HAI bề mặt** — `README.md` và `docs/kit-map.md` cùng khai `147 spec
  KIỂM CHÍNH KIT` trong khi `tests/fe/infra/` có **169** spec đã track. Tôi chỉ biết bề mặt thứ hai tồn
  tại khi phép kiểm mới nêu đích danh nó — nên cửa phải in TÊN FILE, không được chỉ nói "có chỗ sai".
  Thêm `version:check` ⑩, cùng doctrine ⑦/⑨: không bề mặt nào khai ⇒ `CHƯA GÁC GÌ`, không spec nào để
  đếm ⇒ `KHÔNG phán được`, và cả hai đều KHÔNG phải "đạt".
- **Nhan đề mục v2.9.7 đếm thiếu chính nội dung nó mô tả** — "Ba con số" trong khi bảng dưới nó có năm.

**Nghiệm thu, và mẫu số của nó**

Tái hiện được ở máy trong 15 giây, nên chẩn đoán là phép ĐO chứ không phải suy luận từ log:
`CI=true GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v2.9.7 npx playwright test
tests/fe/infra/playwright-conventions.spec.ts tests/fe/infra/version-changelog.spec.ts` ⇒ đúng 7 ca đỏ ấy.
Sau khi vá: **41/41 xanh ở CẢ HAI** môi trường (có biến CI và không có). Đối chứng không rỗng: gỡ `'CI'`
khỏi danh sách thì cả đối chứng dương lẫn phép quét đều đỏ, và đã chạy riêng phép quét vì lượt serial để
nó `did not run` — "did not run" không phải một verdict.

**Bất biến tag ↔ `package.json`: 21/22, không phải 7/7**

Con số `7/7` tôi từng báo là trên **tag `v2.9.x`**. Trên toàn bộ 22 tag `v2.*` thì `v2.5.0` trỏ vào cây có
`package.json` = `2.4.1`, và chuỗi `"version": "2.5.0"` **chưa bao giờ tồn tại** trong lịch sử file đó.
Cửa bắt được việc này đã có (`version_check` ③) nhưng nó tự bỏ qua khi không chạy từ tag — đúng cùng một
họ với mọi thứ ở trên: một phép kiểm im lặng không khai rằng nó đã im lặng.

## v2.9.7 — 2026-11-01 — Năm con số được tin mà không ai hỏi chúng đếm trên bao nhiêu

**Vấn đề → cách chữa**

Cả ba mục dưới đây là cùng một lớp hỏng: một con số **đúng** được đọc thành một kết luận **rộng hơn**
nó. Không máy nào đỏ, vì chẳng có gì sai — chỉ có mẫu số không được nói ra.

- **`expected:check` in `✓ ĐẠT` trên 273/312 case mà không nói 273.** Đo 01/11/2026 ở CSDL-4008: bộ có
  312 case, mốc băm chỉ chứa 273, cửa in `+ 39 case MỚI` rồi kết luận `✓ ĐẠT`. Câu đó đúng từng chữ —
  không case nào **đổi** expected — nhưng 39 case kia không có băm nào để so, nên đổi `Kết quả mong đợi`
  ở đúng 39 case đó là **vô hình**. Và mốc ấy không khai `chup_giua_task`, tức đang được đọc là *chụp ở
  cửa chốt*, trong khi bộ case lớn thêm sau nó — hai điều không thể cùng đúng. Nay câu ĐẠT mang
  `<đã gác>/<tổng>` ở **cả hai** đường `✓`, `--json` trả `so_case_co_moc` · `so_case_khong_moc` ·
  `ty_le_duoc_gac`, lời khai cửa-chốt tự mâu thuẫn bị tố cáo, và dạng `expected:check:enforce` **CHẶN**
  ở cửa publish — nơi bộ case đã chốt nên "case chưa có mốc" mới thật là lỗi. Cửa `done` giữ bản mặc
  định để không chặn 6 task đang chạy ở giữa đường. *(Lượt vá đầu của tôi chỉ sửa một trong hai đường
  `✓`, mà ca CSDL-4008 nổ ở đường còn lại — tức bản vá rỗng đúng với ca sinh ra nó. Nên mỗi đường nay
  có một phép kiểm riêng.)*
- **`audit:ci` in `moderate 12` rồi `✓ OK`, và con số đó không phân biệt được "đã rà" với "vừa xuất
  hiện".** Phép đo ở đây là chính tôi: tôi báo với người dùng `8 advisory moderate (uuid, exceljs)` —
  sai con số, sai tên gói, sai cả bản chất. `12` và `8` đều là số **GÓI** (cả cây / chỉ prod), còn số
  advisory là **1**: `minimatch` GHSA-g3hv-75wg-m249, tán ra qua `eslint` (devDep) và `exceljs` (prod).
  Tôi đọc con số đó từ trí nhớ vì bản thân nó không chở theo gì để đối chiếu. Nay cửa giải advisory theo
  mã GHSA, in `N gói bị ảnh hưởng ⇐ M advisory gốc`, và đòi mỗi advisory dưới ngưỡng có một dòng ở
  `.agent/config/audit_allow.json` kèm **phép đo** và **hạn dùng** — chưa khai thì CHẶN (không vì nó
  nguy hiểm, mà vì chưa ai xem), hết hạn thì CHẶN. **Đã thử vá thật và đo:** `overrides.minimatch=^11`
  đưa audit về 0 vuln nhưng làm `require('glob').sync` **NÉM** `Cannot read properties of undefined
  (reading 'charAt')` — glob@7 nằm trong cây prod, nên override làm xanh con số bằng cách làm **vỡ**
  thư viện. Đã trả lại. Phép thử đó đồng thời là đối chứng cho tính không-với-tới: dưới minimatch@11
  `glob.sync` vỡ còn `exceljs` ghi+đọc .xlsx **vẫn chạy**, nên đường exceljs của kit không chạm
  minimatch. *(Bản đầu của chính máy này in "tán ra 1 gói" cho advisory đang ảnh hưởng 8 — nó chỉ đếm
  gói có `via` dạng object, bỏ cả chuỗi `via` dạng chuỗi. Lớp hỏng mà máy này ra đời để chữa, tái diễn
  ngay trong máy, và nay có phép kiểm riêng.)*
- **`workers` cục bộ lấy `cores/2`, nên máy nhiều lõi hơn KHÔNG an toàn hơn.** Mỗi worker mở một
  browser, và một `chrome-headless-shell` chiếm **3–4 tiến trình** (đo: 0 → 3 sau launch, giữ 3–4 qua 8
  lượt bò, về 0 sau khi đóng). 12 lõi ⇒ 6 worker ⇒ ~24 tiến trình; 32 lõi ⇒ 16 worker ⇒ ~64. Trong khi
  mọi trần của `discovery-crawl` là số **tuyệt đối**: 250ms/400ms mỗi khối · 8s mỗi trang · 15s mỗi
  `page.goto` · 3 phút mỗi file. Đúng cú treo `page.goto` của v2.9.6 sinh ra ở vùng đó. Nay trần **6**,
  và cơ sở của con số là phép đo chứ không phải ước lượng: đó là cấu hình `full:suite` đã chạy
  **2384 xanh · 0 đỏ** nhiều lượt, kể cả những lượt có cú treo và nó được hấp thụ. Trên 6 là vùng
  **chưa đo** — không có máy nhiều lõi hơn để đo, nên trần này nói *chưa biết*, không nói *đã biết là
  tệ*. Vượt trần có chủ đích bằng `PW_WORKERS`. Trên máy 12 lõi hành vi **không đổi** (vẫn 6), nên phép
  kiểm phải giả lập số lõi trong tiến trình con — đọc `workers` trên máy đang chạy thì không phân biệt
  được hai nhánh.
- **Hai phép kiểm ⑨ xanh ở repo rồi đỏ trong gói — lần thứ SÁU cùng một họ lỗi trong một phiên.**
  `release:verify` **14/15**: gói không chở `docs/library/**`, nên vế dương `ENOENT` và vế âm không thấy
  dòng đếm. Một phép kiểm về **cơ chế** mà neo vào một **file của repo**. Nay cả hai dựng cây riêng như
  các phép kiểm ⑦, cộng một phép kiểm cho đúng trạng thái của gói (*không bề mặt nào khai phiên bản ⇒
  `CHƯA GÁC GÌ`, không phải "đạt"*) và một phép kiểm về cây đang chạy khẳng định **cả hai** nhánh, nên
  không nhánh nào lặng lẽ cho qua. Kèm theo, `docs/v2.9.7/BASELINE.md` ghi cách **tái hiện trong 1 phút**
  thay cho vòng 25 phút: `git archive HEAD` loại đúng phần gói không chở, `node_modules` nối bằng
  junction — nghiệm thu rằng nó tái hiện thật (spec trước khi vá: `2 failed`, cùng ENOENT; sau khi vá:
  `19 passed`).
- **Phép kiểm ngưỡng BLOCKED neo vào dữ liệu task SỐNG, và đó là lần thứ ba cùng một bài học.**
  `run-analysis.spec.ts` khẳng định hai bộ dữ liệu **thật** (CSDL-9003, CSDL-9004) rơi vào hai dải khác
  nhau. Bản đầu ghim `28.9%` rồi đỏ khi dữ liệu trôi còn `28.6%`; sửa 13/10/2026 đổi sang ghim **dải** —
  thô hơn nên lâu mục hơn; đo 01/11/2026 thì **dải cũng trôi**: CSDL-9004 về `18.5%`, rơi vào đúng dải
  của CSDL-9003, nên tiền đề hết hiệu lực và phép kiểm đỏ trong khi `run:analysis` vẫn chạy hoàn toàn
  đúng. Ghim thô hơn chỉ làm bài học chậm lại — dải **cũng** là tính chất của dữ liệu đổi được, mà
  `testcase-status.json` bị ghi lại mỗi lượt execute, mỗi lượt gộp, và cả khi ai đó chạy task từ IDE song
  song (đo được đúng việc đó: tệp bị ghi lúc 19:38 kèm `qemis-captcha.png` lúc 19:39, trong lúc một lượt
  đo của tôi đang chạy). Nay tính chất *"ngưỡng phân biệt được"* kiểm bằng **fixture**, cả **ba** dải
  (`<5%` · `5–20%` · `>20%`); dữ liệu thật giữ phép kiểm riêng với vai trò đúng của nó — chứng minh
  `run:analysis` **đọc nổi hình dạng thật** của tệp đó, và **không ghim** bộ đó đang ở dải nào.
- **Sổ `full:suite` ghi `1 xanh · 6 đỏ` cho một lượt có `2404 passed`.** Lộ ra khi chính lượt nghiệm thu
  của đợt này đỏ. `out.match` không có cờ `g` nên nó lấy lần khớp **đầu tiên** của `/(\d+)\s+passed/`, và
  lần đầu nằm trong **mã nguồn của một spec được in kèm thông điệp lỗi** — câu chú thích ở đó có chuỗi
  `"1 passed"`. Hệ quả nặng hơn con số: đoạn mã chỉ in ra **khi có ca đỏ**, nên sổ đúng ở mọi lượt xanh
  và sai ở lượt đỏ — sai đúng lúc người ta cần đọc nó nhất. Nay phần đọc số tách ra hàm thuần `docKetQua`
  (kiểm được bằng fixture thay vì phải chạy 16 phút), neo **đầu dòng**, lấy lần khớp **cuối**, và **đối
  soát** `xanh + đỏ + bỏ qua + chập chờn` với `Running <N> tests`: lệch thì **KHÔNG ghi sổ**, vì một con
  số không đối soát được thì không biết nó đếm trên bao nhiêu. Sổ nay mang thêm `so_chap_chon` và
  `so_tong_khai`. *(Đây là lần thứ ba trong cùng đợt một cửa đọc phải CHỮ TRONG CHÚ THÍCH thay vì dữ
  liệu: `gate:policy` ở v2.9.6, `version:check` ⑨ ở trên, rồi tới đây.)*
- **Và chính số phiên bản cũng là một bản sao viết tay không ai gác.** Lộ ra ngay trong đợt này: thư
  viện thuật ngữ ghi `Phiên bản kit: 2.9.6` trong khi `package.json` đã là 2.9.7. `library:drift` không
  bắt được vì nó so `index.html` với `src/` — tức so hai bản sao **với nhau**, cả hai cùng sai thì vẫn
  xanh. `version:check` nay có phép kiểm ⑨: mọi bề mặt trạng-thái-hiện-tại khai `Phiên bản kit: X.Y.Z`
  phải khớp `package.json`, tài liệu lịch sử (CHANGELOG, `docs/v…`) được bỏ qua vì số trong đó đúng ở
  thời điểm ghi. *(⑨ đỏ ngay lượt đầu vì CHÍNH CÂU CHÚ THÍCH của nó — chú thích dẫn `2.9.6` làm ví dụ
  và cửa đọc ví dụ thành lời khai. Đúng bài học của `gate:policy` ở v2.9.6, nên ⑨ dùng lại `boChuThich`
  thay vì viết lại, và có một cặp phép kiểm phân biệt "bỏ đúng chú thích" với "bỏ hết".)*

## v2.9.6 — 2026-11-01 — Skill tự nạp được, và bốn cửa tắt cùng lúc khi gọi FAIL bằng đúng tên chuẩn

**Vấn đề → cách chữa**

- **28 skill của kit không auto-load, nên agent chỉ mở khi tự nghĩ ra.** Sinh 28 shim
  `.claude/skills/<tên>/SKILL.md` trỏ về bản gốc; `skills:index:check` gác cả ba chiều **thiếu · lệch ·
  thừa**. Đo được: harness **nạp** shim (`Skill(run_report_reader)` chạy; tên bịa ra `Unknown skill`)
  nhưng **không quảng bá** 28 tên vào ngữ cảnh. **Nạp được ≠ biết có mà gọi**, nên dòng liệt kê tên
  trong hook **giữ lại** — không tiết kiệm được ~232 token/phiên như dự tính ban đầu.
- **`run_report_reader` sinh ở v2.9.5 rồi sống mồ côi.** `gate:policy` nâng skill mồ côi từ cảnh báo
  lên **CHẶN**. Và phát hiện kèm theo: cửa ấy đếm cả tên skill nằm trong **chú thích mã**, nên một câu
  tôi viết trong `run_analysis.js` đã **tắt đối chứng dương của chính cửa** — nay bỏ chú thích trước khi
  tìm, dùng lại `boChuThich` của `recon_passive.js`.
- **Gọi `finish('FAIL', …)` — ĐÚNG TÊN CHUẨN của taxonomy — làm bốn cửa tắt cùng lúc.** `FAIL` là tên
  chuẩn, `FAILED` chỉ là đồng nghĩa, mà `evidence_recorder` ghim nguyên văn `'FAILED'` ở bảy chỗ. Hệ quả:
  `failureLayer` bị xoá trắng · phép kiểm bắt buộc khai tầng không nổ · phép kiểm giá trị tầng không chạy
  · `reruns` không đếm · `bug_claim` không thấy case nào để đòi claim. Nay chuẩn hoá qua `synonyms` cho
  mọi quyết định nội bộ, giữ nguyên chữ ghi ra sổ.
- **`output_gate` chỉ kiểm CÓ tầng, không kiểm tầng CÓ THẬT.** Ba ca thật khai `be`/`fe` — hai giá trị
  ngoài 8 tầng taxonomy — nên đi qua cửa đòi bug claim (`blockingLayers` chỉ gồm `product_bug`,
  `api_bug`). Nay chặn mọi giá trị ngoài danh mục, ở **cả** lúc ghi và lúc đọc sổ.
- **Lượt bò khám phá tới 0 màn vẫn tự khai `status: "observed"`.** Lôi ra từ một phép kiểm chập chờn có
  sẵn trong `discovery-crawl.spec.ts`. Nguyên nhân thật: dưới tranh chấp tài nguyên, `page.goto` tới
  trang đầu hết hạn ở 15s, trong khi `http.get` thuần tới **cùng URL** đáp **6–48ms** (36 mẫu, 0 lỗi) —
  server khoẻ, nghẽn nằm trong đường ống của browser. Lượt bò khi đó trả `screens: []`, mà `screens` là
  **mẫu số** của `dimension_manifest` và `scope_anchor`. Nay `boApp` **ném** `BO_DUOC_0_MAN` và lệnh
  `discover` thoát **mã 2** (*không phán được*); ngoại lệ duy nhất là `--max-trang 0`.
- **Điều hướng hỏng nhất thời làm teo mẫu số, và ở trang đầu thì mất cả lượt bò.** Nay thử lại tối đa
  **3 lần**, chỉ với hết hạn hoặc không nối được — **4xx/5xx giữ nguyên**, vì đó là câu trả lời thật của
  server. Ở **trang đầu** thì **dựng lại page** thay vì chờ: đo được lúc một lượt `goto` đang treo, page
  mới qua sau **27ms** còn chờ trên page cũ mất **11.359ms**. Bằng chứng ngược, đo sau đó: dưới tranh
  chấp của cả bó (`full:suite` 6 worker) thì **cả 3 lần thử, gồm 2 lần dựng page mới, đều hết hạn** —
  nên bước này làm lượt bò bền hơn chứ **không chữa** được cú treo. Số lượt phải thử lại công khai ở
  `so_lan_thu_lai_dieu_huong`.
- **Crawler TỰ PHÁ dấu vân tay của chính nó, và đó là lỗi tất định thật.** `moCacKhoi` bấm
  `[role="tab"]`, mà bấm tab sau thì ẩn tabpanel trước; bản cũ đọc dấu vân tay **đúng một lần ở cuối**
  nên chỉ thấy tab được bấm cuối cùng. Đo trên fixture, hai nhánh khác nhau đúng một điều là tab có được
  bấm hay không: chữ ký `/truong/:id` ra `[[],["tab"],[]]` so với `[[],["data_table","tab"],[]]` — tức
  `data_table` **biến mất** vì chính cú bấm của crawler. Hai hậu quả: thứ tự tab bấm được phụ thuộc trần
  250ms/400ms/8s nên dưới tải cùng một route sinh **hai** danh tính (đo được một lượt bò ra 8 màn trong
  khi 9 lượt khác ra 7 — đúng thứ phép kiểm *"bò TẤT ĐỊNH"* ra đời để bắt), và `components`/`so_field` là
  **mẫu số** cho chiều Validation nên một màn có bảng mà báo "không có data_table" làm mọi tỉ lệ phủ về
  sau sai theo. Nay dấu vân tay **gộp** qua các lượt mở (trần 8 lượt đọc mỗi trang, công khai ở
  `so_lan_doc_van_tay`); chi phí đo được **+10…45%** cho một lượt bò.
- **`--storage-state-roles` chỉ bị kiểm khuôn SAU cả lượt bò.** Khai sai một dấu bằng thì lệnh
  `discover` vẫn bò hết app — trần 20 phút — rồi mới từ chối. Nay kiểm **trước khi mở browser**; thông
  điệp và mã thoát giữ nguyên, chỉ đổi thời điểm.
- **Hai ô báo cáo không có khả năng báo cáo** trong cùng hàm đó: `firewall: bienBan.chan.length ? 0 : 0`
  (ternary chết) và `const apiRec = o.apiRec` chụp một lần (nên bộ theo dõi API nghe trên page đã đóng
  sau khi dựng lại page). Bản vá **đầu** của tôi cho ô thứ nhất đếm **sai vế** — số request ghi bị chặn,
  không phải số route không tới được — đúng khuyết điểm ② mà chính hàm ấy ra đời để chữa.
- **`run:analysis --nhom`** gom case đỏ theo `<tầng> ‖ <câu lỗi>`. **Giữ ở mức BÁO CÁO**: đo được nén chỉ
  **1,34×**, **11%** ca nối được câu lỗi thật, **6/9** nhóm mẫu gom sai. Bản in tự khai cả bốn giới hạn
  mỗi lượt chạy, kèm câu *"KHÔNG cửa nào được chặn dựa trên bản gom này"*.
- **Một "giới hạn dữ liệu" hoá ra là lỗi nối của tôi.** Tôi đã ghi *"7% ca nối được, vì dữ liệu không
  có"* vào tài liệu. Nhưng **77%** dòng lỗi *có* mã TC — hai số chênh 10 lần. Nguyên nhân: tiêu đề spec
  dùng mã **trần** (`TC_021`), sổ dùng mã **đủ** (`CSDL_NHANSU_TC_021`). Vá bằng khớp hậu tố **khi và
  chỉ khi hậu tố duy nhất trong sổ** (0 nhập nhằng trên 536 ca).
- **`trace:matrix` thiếu chiều ngược.** Thêm mục *test đã chạy mà không TC nào nhận*, **phân ba loại** vì
  đếm trần thì chôn ca đáng lo dưới đống đúng-thiết-kế. Bắt được **9 ca mở rộng mang PASS/FAIL mà không
  có neo oracle** (5 trong đó `FAILED`) + **2 ca probe mang verdict**; 6 ca mở rộng CÓ neo nên không rỗng
  chiều nào.
- **Một ✅ trong bảng nghiệm thu có thể che mục con chưa xong.** `parity:check` khối ⑤ đọc
  `docs/v2.9.6/plan_items.json`, nơi mỗi mục con **bắt buộc có neo máy phân giải được** (`script` ·
  `spec` + số phép kiểm tối thiểu · `nguon` + ký hiệu · `nguoi` ⇒ buộc ⚠️ và phải ghi `vi_sao`). Có cả
  **chiều ngược**: mọi mục con đã xong mà § vẫn ⚠️ thì cửa nhắc nâng lên, để ⚠️ không thành chỗ trú ẩn.
- **Hai câu sai về bản A** (`rbt-manual-testing` "luôn-nạp", `tc_reviewer` 8 tiêu chí) đã sửa, và số về A
  nay **máy đọc** từ `.agent/config/a_parity_source.json` chứ không gõ tay.
- **Một agent của kit chưa bao giờ nạp được, suốt 20 ngày, và không cửa nào thấy.**
  `.claude/agents/case-debugger.md` vào repo từ 10–11/10 mà harness không đăng ký. Nguyên nhân: ô
  `description` chứa `: ` **không bọc nháy** ⇒ **vỡ YAML** ⇒ harness **bỏ qua file im lặng** (không log,
  không cảnh báo). Tôi đoán sai suốt ba phiên vì so ba file **bằng mắt** và thấy khác biệt là thiếu dòng
  `model:` — mà `model:` là **tuỳ chọn**. Thứ lôi ra sự thật là một **parser**, không phải một vòng so
  sánh nữa. Quét toàn bộ: **5/75** file frontmatter vỡ cùng kiểu (1 agent + 2 skill nguồn + 2 shim). Vá
  xong thì agent vào sổ đăng ký **ngay trong cùng phiên** — harness nạp lại khi nội dung đổi, không cần
  khởi động lại. Thêm `npm run frontmatter:check` (trong bó `predeploy`), gác đúng các điều kiện tài liệu
  đã nêu; cửa cũ vẫn khai *"frontmatter hợp lệ"* vì nó kiểm bằng **regex**, không parse.
- **Vỡ YAML giết agent nhưng KHÔNG giết skill — nó chỉ làm skill mất quảng bá.** Trước khi vá,
  `Skill(automation_reviewer)` vẫn nạp được mà skill ấy không nằm trong danh sách khả dụng; vá xong thì
  harness thông báo nó. Skill nhận diện theo **tên thư mục**, agent theo `name` trong frontmatter. Đây là
  lớp hỏng **im lặng hơn** cả trường hợp agent: vẫn dùng được nếu **biết tên**, chỉ là không ai được
  giới thiệu.
- **`package.json` tụt lại ở `2.9.4`** trong khi CHANGELOG đỉnh là `v2.9.5` — lệch hai bước mà không máy
  nào kêu. Thêm `npm run version:check`: mục đỉnh khớp `package.json` · CHANGELOG giảm dần · số máy gác
  viết tay khớp bản máy sinh. Tài liệu **lịch sử** (CHANGELOG, `docs/v…`) cố ý được bỏ qua ở phép kiểm
  cuối, vì số máy trong đó đúng ở thời điểm ghi.

  **Dãy tag đi từ `v2.9.4` sang `v2.9.6`, và chỗ trống ở `v2.9.5` là dấu chân của đúng lỗi này.** Mọi
  tag đang có đều thoả `git show <tag>:package.json == <tag>` (đo 5/5 từ `v2.9.0` tới `v2.9.4`), và
  `version:check` **CHẶN** khi tag lệch version. Trên `main`, `package.json` giữ `2.9.4` ở **cả
  57/57 commit** trong `v2.9.4..main` — đếm từng commit, 0 commit mang version khác — nên không có commit
  nào mà một tag `v2.9.5` chỉ vào mà không nói sai. Vá
  ngược bằng cách tag một commit ghi `2.9.4` thành `v2.9.5` chỉ là chuyển lời khai sai từ CHANGELOG sang
  dãy tag, nơi khó thấy hơn. Chỗ trống này **để lại**; `git diff v2.9.4..v2.9.6` là khoảng tra ngược
  đúng cho cả hai vòng.

## v2.9.5 — 2026-10-29 — Vượt A ở mọi chỗ A còn hơn, và mỗi chỗ phải có máy đứng sau

**Vấn đề.** Plugin `qig-qa-automation` (gọi là **A**) có vài chỗ dạy kỹ hơn kit này: quy trình recon, ví
dụ testcase trọn vẹn, bảng định tuyến command, rubric review automation, chuỗi dữ liệu nhiều module, và
hai skill đọc báo cáo. Nhưng phần lớn nội dung đó của A là **chữ không có máy** — `rbt-manual-testing`
nhồi 936 dòng (~16,2k token) vào phần luôn-nạp, và cả plugin chỉ có 2 script Python. Port thẳng sang là
rước đúng tật đó về.

**Cách chữa.** Mỗi chỗ A hơn phải kết về một trong ba trạng thái, và điều kiện dừng là **không chỗ nào
để trống**: đã làm kèm máy gác · cố ý không port kèm lý do · đã làm phần tài liệu nhưng chưa có máy, nói
thẳng. Bảng nghiệm thu ở [`docs/v2.9.5/A_PARITY.md`](docs/v2.9.5/A_PARITY.md), và chính nó có cửa gác:
`parity:check` chặn dòng treo, chặn tên máy bịa, và chặn cả khối "CHƯA CÓ MÁY" rỗng.

**Thêm 8 máy** (149 tổng · 107 CHẶN) và **3 skill** (28 tổng):

| Máy mới | Gác gì |
|---|---|
| `skills:route:check` | đo xem phần chữ có ĐỦ để agent chọn đúng skill — 69 ca tiếng Việt viết diễn ý, 98,6% |
| `recon:check` | bản kê màn dựng từ recon phải nói rõ MỖI dòng lấy từ đâu, và tự nêu giới hạn |
| `rule:consistency` | tài liệu cũ nói ngược luật mới — lớp hỏng đã cắn kit 3 lần |
| `phase1:tables` | ba bảng đối soát cuối bộ, MÁY SINH; CHẶN khi một rule chỉ có case dương |
| `router:check` | 32 điểm vào phải có dòng trong bảng định tuyến, kèm cột **KHÔNG dùng khi** |
| `data:chain:check` | case khai tiền đề là output của case khác ⇒ bộ case thành CHUỖI, chuỗi phải đứng được |
| `trace:matrix` (bản gộp) | gộp theo module — chỗ hổng to nhất lên dòng đầu; sinh LUÔN, không cần cờ |
| `parity:check` | gác chính bảng nghiệm thu của đợt này |

**Điều đáng ghi nhất của đợt này không phải 8 máy, mà là 6 lần phép đo của chính tôi sai trước khi
đúng.** Giữ lại vì mỗi lần là một lớp lỗi lặp được:

- **Cửa phủ đếm KHỚP chứ không đếm PHỦ.** `router:check` in *"31 dòng · 32 điểm vào"* rồi kết luận ĐẠT:
  `rerun` tồn tại vừa là lệnh `/rerun` vừa là workflow `rerun.md`, nên khoá-theo-tên-trần làm một dòng
  che hai điểm vào. Khoá phải gồm LOẠI.
- **Bộ đo không biết API của chính kit.** Soi tay 5 finding đầu của `no-assert-after-act` thì **4 là
  dương tính giả**, cả 4 vì detector chỉ đếm `expect(`. Kit có BA dạng oracle: `expect(` · `assert:`
  trong `c.step` · `status:` TÍNH ĐƯỢC. Riêng `status: 'PASSED'` viết cứng thì không phải oracle.
- **Mẫu hành động trượt dạng phổ biến nhất.** `await` + lớp ký tự + `.click(` không khớp
  `getByRole('x', { name: 'y' }).click()`. Con số 20 hoá ra 34, và tỉ lệ dương tính giả phải soi lại.
- **`\Z` không tồn tại trong regex JS** — nó khớp chữ `Z` thật. Mục nằm ở cuối file không bao giờ khớp,
  nên cửa luôn báo thiếu; phép kiểm chiều dương vẫn xanh nhưng xanh vì lý do SAI.
- **Một trường bắt buộc luôn được thoả bởi dòng khác là một trường không tồn tại.** Thêm
  `Đơn vị / cấp học` vào sổ phiên mà 14/14 phép kiểm cũ vẫn xanh — vì chữ `trường` nằm ngay trong
  **Môi trường**, nên dòng ghi host tự thoả nó.
- **Nhãn mức của gate sai theo chiều nguy hiểm.** `gates:index` dán `router:check` là **BÁO CÁO** dù nó
  exit 1, vì bộ nhận mức chỉ bắt `process.exit(1)` viết thẳng. Nới mẫu thì phát hiện nó cũng đang gán
  sai cho `docs:index` — tổng CHẶN 102 → 104.

**Ba việc bị chính phép đo loại bỏ**, và đó là kết quả chứ không phải thiếu sót:

- `assert-before-act-only` — đo được là **tập con tuyệt đối 18/18** của `no-assert-after-act`. Hai tên
  cho một phép đo thì báo cáo đếm đôi.
- Đầu bài §3.3 "thêm 15 loại field + 6 component của A" — danh mục canonical của B **đã phủ trọn** cả
  15 + 6. Chỗ lệch nằm ở hai checklist của skill: cùng khai "18 loại" với 18 nội dung KHÁC nhau, và
  chính con số bằng nhau che được chuyện đó.
- Hướng "spec tạo bản ghi mà thiếu dữ liệu unique" cho §6 — ra 11/66 ca, soi tay 3 ca thì **3/3 đều
  giả** (`fill('')` xoá ô · một spec DỌN dữ liệu · một fixture local).

**Và hai cửa mới bắt lỗi thật ngay lượt chạy đầu:** `data:chain:check` tìm ra `CSDL_NHANSU_TC_063` khai
`(dựng ở TC_075)` trong khi TC_075 nằm SAU nó; `library:drift` bắt 4 máy mới chưa có mặt trên trang
thư viện cùng 3 chỗ còn ghi số gate cũ.

**Ngân sách token.** Thêm một lệnh vào workflow thì `gate:policy` đòi nó có mặt ở prompt điểm vào, và
`prompt:budget` cấm nâng ngưỡng. Nên §3.2 phải cắt bù trong cùng luồng: **+106 → −2**. Từ §6 trở đi,
máy mới được nối vào bó `phase1:check`/`phase2:check` thay vì thêm dòng prompt.

## v2.9.4 — 2026-10-23 — Tài liệu sinh ra phải đếm thứ CI NHÌN THẤY

**Vấn đề.** Ba cửa sinh tài liệu — `docSpecs()`, `rule_coverage`, `gate_index` — quét ĐĨA. Máy người
đang làm luôn có file chưa commit, nên bản sinh ở đó khác bản CI tính ở cây sạch. Cửa đỏ, thông điệp
bảo "chạy lại rồi commit", chạy xong vẫn đỏ — càng làm theo càng sai. Đo được trong một lượt: bản sinh
ở máy ghi `140 gate · 143 spec` trong khi HEAD chỉ có 138, vì repo đang có ~200 file WIP. Đây là lần
thứ BA của cùng một lớp lỗi; vế `spec` đã vá ở v2.9.1, vế `gate` và vế `corpus` sót tới nay.

**Chữa.** Cả ba lọc theo `git ls-files`, giữ đường thoát khi không có `.git` — gói phát hành cố ý không
có git, và ở đó đĩa CHÍNH LÀ tập đã phát hành nên không có WIP nào lẫn vào. `predeploy` (dựng worktree
sạch tại HEAD) là chỗ nghiệm thu; chạy nó TRƯỚC khi commit thì nó xanh giả, vì nó đo HEAD.

**Evidence chuyển sang mức B.** Case thường cần 1 ảnh/video ở BƯỚC QUYẾT ĐỊNH thay vì ảnh mỗi step.
Case thành bug (`product_bug`/`api_bug`) giữ nguyên chuỗi từng step — dev nhận bug phải dựng lại được
đường dẫn tới lỗi, một ảnh màn cuối không nói được lỗi phát sinh từ bước nào. `status` của từng step
không đổi, vẫn bắt buộc.

Tiền đề "evidence mỗi step tốn token" đã bị đo bác một phần: lúc CHẠY tốn **0 token** (spec tự chụp qua
`evidence_recorder`, Playwright làm), lúc VIẾT SPEC chỉ chiếm **1–2%** số dòng. Vẫn đổi, vì phần bỏ đi
chủ yếu là ảnh LẶP trong cùng một case. Số đo + lý do: `docs/rationale/evidence-muc-b.md`.

**Hook bảo mật: hai lỗi NGƯỢC CHIỀU.** `guard_db_access` khớp từ-đọc và đường-dẫn-bí-mật một cách RỜI
RẠC, ở bất kỳ đâu trong chuỗi lệnh. Hệ quả: một commit mô tả cách dùng profile mà kết thúc bằng
`| tail -2` thì bị CHẶN OAN (cái `tail` đọc output của `git push`, không đọc file nào), còn
`grep PASSWORD <file bí mật>` thì LỌT — dù đó mới đúng là đọc bí mật.

Nay cắt lệnh theo `| ; && ||` rồi chỉ xét đoạn có TỪ ĐẦU là lệnh đọc, và chỉ soi ĐỐI SỐ của chính đoạn
đó; thêm `grep/sed/awk/Get-Content` vào nhóm lệnh đọc. 12 ca đối chứng hai chiều khoá lại trong
`guard-db-access.spec.ts`.

**Slash command biết đang làm task nào.** Gõ `/phase2` không kèm mã thì `$ARGUMENTS` rỗng, lệnh chạy với
`--task` trống và hỏng ở một gate phía sau với thông điệp chẳng liên quan — hoặc tệ hơn, agent tự điền
mã của lượt trước, đúng thứ CLAUDE.md §5 cấm (`.auth/` và UAT dùng chung, nhầm mã là ghi kết quả sang
task khác).

Thêm `npm run task:which`: có tham số thì KIỂM, đúng 1 profile thì chọn, NHIỀU profile thì in danh sách
rồi thoát 2 để NGƯỜI chọn. Cố ý không lấy "profile mới sửa gần nhất" — `mtime` chỉ nói file nào vừa bị
chạm, không nói người dùng đang muốn làm task nào.

Kèm theo: `gate:policy` nay nhìn thấy `.claude/commands`. Nó vốn bỏ sót bề mặt đó trong khi
`gate_index` đã liệt từ trước — hai máy cùng hỏi "ai gọi cái này" mà nhìn hai tập khác nhau, nên công
cụ chỉ được slash command gọi bị báo mồ côi.

Và `/start` cùng `/discover` từng dạy một câu lệnh mà chính hook của kit chặn, tức người mới đụng tường
ở bước thứ hai của lệnh onboarding. Đã đổi sang dạng `TASK_KEY=… PROJECT_OUTPUT_DIR=…` (đo: hook cho
qua, preflight chạy thật exit 0). 47 file tài liệu cho NGƯỜI đọc thì giữ nguyên — hook chỉ chặn lệnh
agent chạy.

**Bộ báo cáo hiệu năng k6.** Artifact theo LƯỢT CHẠY: bản cũ ghi đè cùng một file summary mỗi lượt nên
lượt sau xoá sổ lượt trước, mà số hiệu năng chỉ có nghĩa khi so theo thời gian. Bản cũ cũng chưa từng
xin `--out json` nên không hề có dữ liệu theo thời gian — mọi biểu đồ diễn biến đều không dựng được.
Thêm báo cáo HTML có biểu đồ, mục lục theo testcase, và đường phục hồi cho lượt chạy cũ chỉ còn file
HTML của k6 web-dashboard.

**Công cụ Backlog.** 7 script đọc/sửa issue. Vá `bug_reporter` bỏ qua `tcId` khai tay: mã suy ra từ
tiêu đề rơi xuống nhánh dự phòng cho ra chuỗi kiểu `XSS_L_U_TR_H_T_N_NH_C_KHOANH_V_NG`, mà chính marker
đó là thứ chống trùng bug và map bug về Module.

**Bảo mật phụ thuộc.** `follow-redirects` 1.16.0 → 1.16.1 — hai lỗ HIGH rò header credential khi
redirect cross-origin (GHSA-q3jh-wrc6-jgq8 · GHSA-8r9p-f939-6h3c), đúng chỗ kit nhạy cảm vì nó gửi
cookie/token qua HTTP client. Ghim bằng `overrides` để `npm install` không trôi ngược; đã đối chứng
bằng cách ghim tạm 1.15.9 để chắc `overrides` điều khiển thật.


## v2.9.3 — 2026-10-16 — "Không chạy nổi" không được giả làm "code sai"

**Vấn đề.** Một lượt `release:verify` của v2.9.2 ra 14/15 với hai ca đỏ ở `typecheck-scripts`; lượt sau
ra 15/15 mà **không sửa gì giữa hai lượt**. Đó đúng hình dạng của "chạy lại tới khi may mắn", nên phải
đo thay vì bỏ qua.

**Cơ chế, xác định được chứ không phỏng đoán.** `chayTsc` gọi `spawnSync(..., timeout: 5 phút)`. Hết
giờ thì tiến trình bị giết, `status = null`, `stdout` rỗng — và đúng hai hệ quả đó khớp hai ca đỏ:

- test "0 lỗi kiểu" trượt ở `expect(r.status).toBe(0)`;
- test đối chứng "`t.id` phải ĐỎ" trượt vì không còn dòng `error TS` nào để đếm.

Hai test **mâu thuẫn nhau** cùng đỏ — một cái đòi `tsc` xanh, một cái đòi `tsc` đỏ. Đó là chữ ký của
"`tsc` không chạy", không phải của "code sai". Đo thêm: chạy `tsc` thẳng trong chính gói ấy cho exit 0,
và cả 6 test của spec đó xanh khi chạy riêng ở đúng gói ấy.

**Sửa cách máy phản ứng, không sửa được nguyên nhân.** `tsc` không chạy nổi nay là **KHÔNG PHÁN ĐƯỢC**,
không phải FAIL. Cho nó FAIL là đổ lỗi sai chỗ: người đọc đi tìm lỗi kiểu trong code, trong khi vấn đề
là máy chạy test đang quá tải. Và nó cũng **không** được thành PASS — `release:verify` đếm số bỏ qua
rồi in ra, nên một lượt không đo được vẫn để lại dấu vết đọc được.

Luật này là chỗ dễ biến thành nơi nuốt lỗi nhất, nên khoá cả hai chiều: `status 2` (tsc chạy xong và
báo lỗi kiểu) **vẫn phải là FAIL thật**, chỉ `status null` hoặc lỗi spawn mới được bỏ qua.

**Và vá một lỗ của chính bản cải tiến hôm qua.** `verify_release` chỉ in TÊN ca đỏ, không in lý do.
Với một lượt ~10 phút, không biết lý do nghĩa là mất thêm 10 phút nữa chỉ để đọc một dòng `Error:` —
tôi đã phải dựng lại gói thủ công rồi chạy tay mới biết hai test đó trượt ở đâu. Nay in kèm dòng lý do
đầu tiên của mỗi ca.

**Nói thẳng giới hạn:** đo lại **3 lượt `release:verify` đều 15/15**, tức không tái hiện. Nhưng 3 lượt
không chứng minh nó đã hết, và **nguyên nhân vì sao `tsc` vượt 5 phút vẫn chưa tìm ra**. Bản này không
chữa nguyên nhân — nó làm triệu chứng hiện ra đúng tên gọi của nó.

`full:suite` **2.061 xanh · 0 đỏ** · `release:verify` **15/15 ba lượt liên tiếp**.

---

## v2.9.2 — 2026-10-16 — Ma trận trình duyệt, chốt tiền-đẩy, và cổng mơ hồ có code đứng sau

**Đo lại HEAD trước khi vá — và việc đo lại đổi phân nửa khối lượng công việc.** Prompt của đợt này mô
tả hiện trạng trên bản **2.9.0**; HEAD đang ở 2.9.1.

| Việc được giao | Đo trên HEAD | Làm gì |
|---|---|---|
| `GATES.md` thiếu **3** dòng, `gates:index:check` ĐỎ | ở cây sạch: **exit 0** | **đã xong ở v2.9.1** (thực tế thiếu 12 dòng) |
| `npm ci` gãy khi chặn CDN ⇒ vendor tarball | đã là `file:vendor/xlsx-0.20.3.tgz` | **đã xong ở v2.9.1** |
| "chỉ chạy một cấu hình Chromium" | lane `CROSS_BROWSER=1` + 2 project mobile đã có; 3 engine đã cài | **sai một phần** — thiếu BỘ CHẠY, không thiếu project |
| 20 test đỏ Linux **nghi** do import lệch hoa-thường | **490 đường import, 0 lệch** | **tiền đề sai** — xem dưới |
| Ambiguity Gate chỉ là lời dặn | **đúng**: 0 script đọc khoá rồi `exit 1` | làm |

### Ma trận trình duyệt — làm phần CÒN THIẾU

`playwright.config.js` đã có lane cross-browser từ trước, nên không thêm project nào. Thiếu là một lượt
chạy CÙNG kịch bản qua cả ma trận rồi trả lời được "màn nào vỡ ở nhân nào".

`npm run smoke:matrix` + `browser_matrix.json` ⇒ `reports/browser-matrix.md`. Ba điều kiện thiết kế:

- **không bắc cầu qua ba lớp chặn của `smoke_run`** — gọi lại `kiemTruocKhiChay()`. Một máy mới đi vòng
  qua lớp chặn của máy cũ là cách lớp chặn chết lặng lẽ.
- **ô không chạy in `▢` và ĐẾM RIÊNG.** Kit đã trả giá hai lần cho lớp "có số nhưng số nói về tập khác".
- **nói thẳng đây là GIẢ LẬP**; test grep chặn mọi câu kiểu "đã test trên iPhone thật".

Đối chứng chạy thật, offline: một spec cố ý vỡ **chỉ ở WebKit** ⇒ chromium PASS, webkit FAIL. Đây là
phép đo duy nhất chứng minh ma trận thật sự chạy hai nhân — gom bảng đúng mà chỉ dùng một engine thì cả
tính năng là giả.

### Chốt tiền-đẩy, và nó bắt chính commit của nó

v2.9.0 ra mắt khi `gates:index:check` ĐỎ, vì `release:verify` chạy `gate:policy` và `skills:index`
nhưng **không** chạy cửa đó. v2.9.1 suýt lặp lại: tôi CÓ chạy, nhưng ở cây làm việc, nơi nó trả
"KHÔNG PHÁN ĐƯỢC" (exit 2) vì có WIP — im lặng đó bị đọc thành "không sao".

`npm run predeploy` dựng **worktree sạch tại HEAD** rồi mới đo, và coi exit 2 ở cây sạch là bất thường
chứ không phải đạt. Ngay lượt đầu nó CHẶN chính commit vừa tạo: bảng gate tôi sinh ở cây có WIP lệch
với bản sinh từ HEAD sạch.

### H2.3: tiền đề sai, nên đổi việc chứ không bỏ việc

Giao: "sửa import lệch hoa-thường, báo số đỏ trước/sau". Quét **490 đường, 0 lệch** — không có gì để
sửa. Nguyên nhân thật của 20 test đỏ đã vá từ v2.8.3 (Node 20 không bóc kiểu khi `require()` file `.ts`,
cộng 2 test ghim giả định có ổ đĩa). Báo "đỏ giảm 20 → 0 nhờ sửa import" sẽ là **gán công cho một việc
không làm**.

Việc còn đáng làm là cửa PHÒNG: `npm run case:paths`. Luật HẸP có chủ ý — chỉ bắt ca "có file
khớp-không-phân-biệt mà sai hoa-thường"; đường trỏ file không tồn tại và tên gói npm đều bỏ qua.

### Cổng mơ hồ: ba trạng thái có thật, không phải một

Đo 5 task: `RESOLVED` (2) · `PARTIALLY RESOLVED` (2) · `RESOLVED-BY-DEFAULT` (1). **Hai cái sau chứa
chuỗi `RESOLVED`.** Kiểm bằng `includes()` ⇒ chúng lọt im lặng; kiểm bằng `===` ⇒ chặn 3/5 task đang
chạy. Và dòng khoá có **bốn hình dạng**, nên regex một-khuôn đọc trượt — mà "đọc trượt" ra kết quả
"không thấy khoá", thứ mà bản phác bảo coi là CHẶN. Một lỗi ĐỌC hoá thành một lệnh CHẶN sai.

Nên gate neo vào `ambiguity_states.json`: khớp chính xác, khớp dài nhất trước, và **mỗi trạng thái một
nghĩa vụ** (`PARTIALLY RESOLVED` phải nói câu còn mở chặn gì · `RESOLVED-BY-DEFAULT` phải có người và
ngày). Chỗ gate có răng là ở nghĩa vụ, không ở chuyện "có bằng chữ RESOLVED hay không".

**Chế độ di trú chọn bằng số đo:** chạy thử trên 5 task thật — di trú **0 đỏ**, chặt **2 đỏ**. Ba ca
đó là vi phạm THẬT (3544 Q6 thiếu creds; 9002 Q2 chạy theo assumption, Q13 đặc tả 200 ký tự vs cột
`nvarchar(50)`), nhưng làm đỏ việc đang chạy ngay ngày đầu thì người ta tắt gate.

Thêm một chỗ lệch ít ai thấy: `phase1-clarifications.md` có **hai đường dẫn** trong kit. 5/5 task dùng
`reports/`, 0 dùng `requirements/` — mà hai tài liệu vẫn ghi `requirements/`. Gate đọc nhầm nhánh thì
nó không thấy file, và "không thấy file" rất dễ bị cho qua.

### Bảy lần phép đo bác chính tôi

- config tạm nằm ngoài repo ⇒ `require('@playwright/test')` không phân giải được;
- truyền cả đường dẫn làm bộ lọc ⇒ tham số vị trí của Playwright là **regex khớp đường dẫn**, `C:/…`
  không khớp `C:\…`, chạy 0 test và thoát 0;
- và lượt đó lộ một lỗ trong chính máy tôi: **bảng rỗng vẫn exit 0**, đọc y hệt bảng toàn xanh;
- fixture đặt spec ở `os.tmpdir()` — kit đã ghi sẵn bài học này ở `_thu_muc_tam.ts` và tôi vừa lặp lại;
- bộ đọc câu hỏi chỉ biết khuôn BẢNG ⇒ 3/5 task ra "0 câu hỏi", tức hạn chế của máy hoá thành cáo buộc
  về công việc của người;
- **lần thứ BẢY kit vấp CRLF**, ẩn hơn sáu lần trước: trong JS `.` không khớp `\r` và `$` không khớp
  trước `\r`, nên regex kết thúc `(.*)$` trượt TOÀN BỘ dòng của file CRLF — im lặng, không lỗi;
- lọc ô rỗng TRƯỚC khi tách câu hỏi khỏi câu trả lời ⇒ câu chưa có đáp trông như đã có đáp, tức phép
  kiểm toàn vẹn xanh trên đúng ca nó sinh ra để bắt.

### Số đo của bản này

| | |
|---|---|
| `full:suite` (142 spec đã track) | **2.060 xanh · 0 đỏ · 0 bỏ qua** |
| `release:verify` | **15/15 bước** — suite trong gói **1.912 xanh · 53 bỏ qua** |
| `static-check` (20 bước) | xanh tại chỗ, **cả 20 bước** — không kiểm tập con rồi phán về CI |
| gói | 628 file · 7,67 MB |
| file được track | 757 · 147 spec · **138 gate** (134 → 138) |

### Bốn ca đỏ phát sinh khi chạy cả bộ, cả bốn là của tôi

Đáng ghi vì chúng chỉ lộ ra ở lượt chạy cả bộ, không lộ ở spec vừa viết:

- **hai config mới không vào danh sách đóng gói** ⇒ người nhận kit sẽ có gate **tắt im lặng**, không
  phải đỏ to tiếng. Đúng thứ `config-presence` sinh ra để bắt.
- **tôi khai tay trường `spec` trong cặp mã**, mà registry tự tính độ phủ — khai tay là tự làm đẹp con
  số chính nó canh.
- **`predeploy` đỏ CHỈ trong cả bộ**, chạy riêng thì xanh: spec của nó và `prompt-budget.spec` đều dựng
  worktree sạch, mà suite chạy `--workers=2` nên hai tiến trình đụng khoá `.git/worktrees`. Vá bằng
  thử-lại **có trần 3 lần** — lỗi khoá git là transient, và hết lượt thì nói ra chứ không im.
- **`case:paths` ghim mẫu số của REPO vào một spec đi theo GÓI** ⇒ đỏ trong gói vì lý do không liên
  quan tới chất lượng gói. Theo quy ước `_trong_repo.ts`: phần "0 đường lệch" vẫn kiểm ở mọi cây, chỉ
  mẫu số thì bỏ qua kèm lý do.

Và một ca đỏ KHÔNG phải của tôi nhưng đáng sửa: `api_card` chụp thẻ API trượt với `Protocol error
(Page.captureScreenshot)` dưới tải — đỏ hai lần ở hai ngày khác nhau, chạy riêng thì 3/3 xanh. Hàm đó
**sinh evidence**, nên một lượt execute thật mà chụp trượt là một case mất ảnh, rồi `output_gate` chặn
vì thiếu evidence — lỗi hiện ra ở chỗ xa nguyên nhân. Thử lại có trần 3 lượt, hết lượt thì ném kèm
nguyên văn lỗi gốc.

### Cần NGƯỜI duyệt (máy không tự khẳng định được)

1. Danh sách project × kích thước suy từ **cấu hình sẵn có của kit**, không từ số liệu người dùng thật.
2. Bao giờ bật chế độ `chat` cho `ambiguity:gate` — và ba ca vi phạm thật ở trên xử lý thế nào.
3. Mức Critical/High của từng điểm mơ hồ: máy chỉ đọc nhãn, không thẩm định được nhãn đúng hay sai.

---

## v2.9.1 — 2026-10-15 — `npm ci` thôi cần mạng ngoài registry, và cửa đọc CRLF có chủ

**Vấn đề.** Ba điểm yếu được chỉ ra sau khi v2.9.0 ra mắt. Đo lại từng cái thì **hai đúng, một sai một
nửa** — và chỗ sai một nửa đáng ghi hơn hai chỗ đúng.

| Điểm được nêu | Đo ra |
|---|---|
| `gates:index:check` đỏ vì `GATES.md` thiếu **3** dòng gate | **Đúng, và nặng hơn**: thiếu **12** dòng. Đã sửa ở `5a9aec7`. |
| `npm ci` gãy trên mạng chặn `cdn.sheetjs.com` — nên vendor tarball | **Đúng.** Làm ở bản này. |
| 20 test đỏ trên Linux CI, changelog vẫn ghi "chưa đo lại", nguyên nhân là phân biệt hoa-thường | **Sai một nửa.** Đã đo và đã sửa từ 15/10 (`release:verify` 15/15 trên Linux, run 38532446437). Nhưng **dòng changelog thì đúng là còn ghi "chưa đo lại"** — và nguyên nhân KHÔNG phải hoa-thường. Xem mục "Việc còn lại" của v2.8.3. |

Chỗ sai một nửa đó không phải chuyện nhỏ: bản ghi còn mở bằng *"chưa đo lại"* vì lần trước tôi chèn
kết luận vào **giữa câu nghi ngờ cũ**, nên bullet vừa khẳng định đã sửa vừa kết bằng *"chưa đo nên mới
là nghi ngờ"*. Người đọc không biết tin câu nào, và họ đọc đúng câu sai. Nay viết lại cả bullet.

### Vendor `xlsx`: đổi hình dạng rủi ro, không xoá nó

`xlsx@0.20.3` khai bằng URL tới `cdn.sheetjs.com`. Registry npm **không** có cách ra: nó dừng ở
`0.18.5`, mang CVE-2023-30533 + CVE-2024-22363, chỉ vá từ `0.19.3`/`0.20.2`, và hai bản đó chỉ có trên
CDN. Hạ về registry là hạ cấp vào hai lỗ đã biết. Nên: mang tarball vào repo,
`file:vendor/xlsx-0.20.3.tgz`.

Đo **trước** khi đổi: sha512 file tải về khớp đúng chuỗi `integrity` lockfile đang ghim — vendor không
đổi thứ được cài. Đo **sau**: `npm install --offline` cài xong, đọc-ghi vòng tròn ổn.

Nhưng vendor không phải thắng không mất gì: hết chuyện mạng, **thêm 2,3 MB nhị phân mà không ai đọc
được trong code review**. Một blob như vậy chỉ còn đúng một phép kiểm là so băm — và một phép kiểm chỉ
tồn tại dưới dạng một dòng văn trong config thì **không phải phép kiểm**. Nên `deps_check.js` thêm:

- **phép kiểm ⑤** — dep `file:` trỏ file trong repo ⇒ so sha512 với `integrity` lockfile. Lệch băm ⇒
  CHẶN. File mất ⇒ CHẶN (`npm ci` sẽ chết ở **mọi** máy nhận; bắt ở đây rẻ hơn bắt ở `release:verify`).
  Không có thuật toán nào so được ⇒ **CẢNH BÁO**, không phải "đạt".
- đối chứng hai chiều ghim thành test. Băm trong fixture **tính từ file**, không gõ tay — gõ tay thì
  âm bản vẫn xanh khi phép kiểm hỏng theo chiều "không bao giờ so được băm nào", vì khi đó nó cũng im.

Hai chỗ phải sửa cùng lúc, cả hai là **lỗi lặp được** của kit:

- `KEEP_DIRS` của `package_kit.js` thiếu `vendor` ⇒ gói mang `package.json` trỏ `file:vendor/…` mà
  không mang file. Cùng lớp với ca `manual-run` / `tests/fe/lib` / `.claude/agents` đã ghi.
- luật bỏ-qua-nhị-phân có `gz`, nhưng `\.` đòi dấu chấm NGAY trước nên `.tgz` **không** khớp: tarball
  bị đọc như utf8 (không ném lỗi, chỉ ra rác) rồi đem rác đi quét pattern secret.

Và một test đang ghim câu **nay sai**: nó đòi `.github/workflows/README.md` phải chứa `cdn.sheetjs.com`
+ `403`. Đúng trước hôm nay. Một test ghim câu sai còn tệ hơn không có test — nó biến tài liệu lạc hậu
thành **điều kiện để pipeline xanh**. Nay ghim ngược: README phải khai không cần host nào ngoài
registry, và vẫn phải kể lý do không hạ về registry.

### Cửa đọc CRLF: lần thứ sáu, nên lần này có máy

`full:suite` đỏ ở `tc-design-guide.spec.ts` với thông điệp **"thiếu frontmatter"** — dù không ai sửa
skill. Trong git file là `---\n`, trên đĩa là `---\r\n` (`core.autocrlf=true`), và `git status` vẫn
SẠCH vì git chuẩn hoá lúc commit. Nên một assertion ghim đúng byte LF trên file trong **cây làm việc**
chỉ xanh khi lần checkout gần nhất tình cờ cho LF: CI Linux xanh, Windows checkout mới thì đỏ.

Đây là **lần thứ sáu** cùng lớp lỗi (`library_drift`, `build.js`, `course_parse.js`,
`course_maturity.js`, `slash-commands.spec.ts`, và nay là test của chính tôi ở v2.9.0). Sáu lần thì cái
thiếu không phải thêm một lần nhớ:

- `tests/fe/infra/_doc_sach.ts` — **một cửa đọc dùng chung** (`docSach` / `boCR`), để người viết máy
  kiểm sau không phải biết chuyện CRLF mới viết đúng;
- một máy chặn **lần thứ bảy**: quét source của `tests/fe/infra/**` và `scripts/qa/**`, bắt chỗ kiểm
  frontmatter bằng `readFileSync` thô. Luật **hẹp có chủ ý** — đúng hình dạng của cả sáu ca, nên không
  báo oan; và nó **không** tự xưng bắt mọi dạng so-sánh-có-`\n` (dạng `.split('\n')` còn hở, nói thẳng
  ra tốt hơn để người đọc tưởng đã kín).

Chuẩn hoá ở cửa đọc chứ **không** nới assertion: test vẫn đòi file mở đầu bằng dấu frontmatter. Và nó
sửa luôn phép đếm token — CRLF làm `length` phồng một byte mỗi dòng, tức trần 2.500 của `SKILL.md`
trước nay đo trên một con số không phải nội dung thật.

### Tài liệu người đọc đã trôi — và cửa một-nguồn không quét tới đó

Câu hỏi "lâu nay chưa thấy update user guide, readme, quickstart và ảnh nhỉ" hoá ra đúng một nửa, và
nửa đúng nằm ở chỗ ít ai nhìn. README · USER_GUIDE · QUICKSTART đều **đã** cập nhật trong ngày cho
v2.9.0. Nhưng:

| Chỗ | Khai | Thật |
|---|---|---|
| `README.md` ×2 | "Mở **5 trục** cho MỌI case" · "**5 trục** mở rộng quanh case" (liệt kê 5 tên) | `axes.js` có **7** |
| `README.md` | band `medium → ③+⑤` | `medium → ③⑤⑦` |
| `USER_GUIDE.md` | "mở rộng **5 trục**" | **7** |
| `RULE_GLOBAL.md` mục lục | trỏ `§5 trục` → neo `#5-trục-…` | tiêu đề thật đã là `7 trục` ⇒ **link neo CHẾT** |
| `docs/user-guide-images/qa-environment.png` | `Node.js >= 18` | `engines: >=20` · `.nvmrc` 20 |

Ảnh sai bản Node không phải chuyện câu chữ: 20 test đỏ trên Linux (v2.8.3) có nguyên nhân là **Node 20
không bóc kiểu** khi `require()` file `.ts`. Người mới đọc sơ đồ onboarding rồi cài Node 18 sẽ gặp một
lớp lỗi khác nữa, ở chỗ xa nguyên nhân.

**Vì sao không ai thấy.** Cửa một-nguồn của trục (v2.8.1) chỉ quét `.js` — nó đối chiếu `depth.PLAN`,
`finding.AXES`, `leak_report.AXES` với `axes.js`, và làm tốt việc đó. Bề mặt **người đọc** thì không
ai canh. Hệ quả: tài liệu dạy mở 5 trục trong khi `expansion:plan` đòi đủ 7 — máy và tài liệu nói hai
chuyện khác nhau, và người ta tin tài liệu. Ảnh cũng vậy: hai test cũ chỉ kiểm ảnh **có mặt** và ảnh
**không cũ hơn generator**, tức kiểm sự tồn tại và tuổi, không kiểm nội dung.

Nay có ba máy mới:

- **bề mặt tài liệu khớp `axes.js`** — quét 6 file người đọc. Luật **hẹp có chủ ý**: chỉ bắt câu
  khẳng định TỔNG SỐ, vì có hai câu hợp lệ nói về **tập con** (`README` "Lý do 2 trục này" cho ④+⑤,
  `RULE_GLOBAL` "vượt 4 trục" là một ngưỡng). Bắt cả chúng là báo oan, mà một cửa báo oan là cửa người
  ta tắt. Câu **kể lại** phép đo cũ vẫn viết được bằng chữ ("cùng năm trục") hoặc phân số ("0/5 trục").
- **mục lục trỏ đúng tiêu đề** — sinh neo TỪ tiêu đề thật, không gõ lại chuỗi neo. Đổi tiêu đề mà quên
  mục lục thì link vẫn *trông như* link: bấm vào không nhảy đâu cả, và không có gì đỏ.
- **số bản Node trong sơ đồ khớp `engines` + `.nvmrc`** — và kiểm luôn hai nguồn đó khớp nhau, vì nếu
  chúng lệch thì ảnh khớp cái nào cũng sai.

Đối chứng hai chiều ghim nguyên văn **ba câu đã trôi thật** làm dương bản, và **bốn câu hợp lệ** (hai
tập con + hai cách kể chuyện cũ) làm âm bản. Cây đã sửa thì luật im lặng — mà im lặng của một luật chưa
bao giờ bắt gì thì không phân biệt được với im lặng của một luật viết sai.

### `rule:coverage` đỏ trên CI, và lý do nó cứ đỏ lại

`rule:coverage:check` **nằm trong CI** (`static-check.yml` + `.gitlab-ci.yml`) và nó đang CHẶN ở HEAD:
`docs/RULE_COVERAGE.md` ghi 132 gate / 134 spec, thật là 134 / 137.

Nhưng chạy `npm run rule:coverage` để sinh lại thì ra **150 spec** — lệch tiếp. Nguyên nhân: máy sinh
đếm bằng `readdirSync`, tức **đếm file trên đĩa**, gộp cả 13 spec WIP chưa commit của người đang chạy.
Người đó không làm gì sai; cái sai là **phép đếm phụ thuộc thứ không nằm trong commit** — rồi CI (chỉ
có file đã track) tính ra số khác và CHẶN. Đó là vòng lặp làm cửa này đỏ đi đỏ lại.

Nay đếm theo `git ls-files`, và không có git thì **NÉM** chứ không im lặng quay về đếm đĩa — quay về
đếm đĩa đúng là cách con số sai lọt ra.

### Prompt log bug: văn phong cho dev, và link môi trường bắt buộc

Yêu cầu của chủ dự án: *"nội dung bug ngắn gọn, dễ hiểu cho dev và con người đọc, nhưng vẫn theo
template"*, và *"tiền điều kiện gán thêm một đường link môi trường test cụ thể"*.

Bản đầu tôi viết bảy luật văn phong vào thẳng prompt, rồi tự bác: `RULE_GLOBAL.md` §Giọng văn output
ĐÃ là nguồn canonical cho đúng chuyện này, nên bảy luật đó là **bản sao thứ hai sẽ trôi** — chính thứ
đợt này vừa mất một mục để dọn. Prompt nay **trỏ về RULE_GLOBAL**, kèm một dòng tóm để dùng ngay và
hai chỗ hay sai nhất (lượng từ mơ hồ · bê lập luận vào bug), cộng ba câu tự kiểm trước khi gửi.

`Tiền điều kiện` nay **bắt buộc mở đầu bằng URL đầy đủ của đúng màn xảy ra lỗi**, và luật nằm ở
`RULE_GLOBAL` còn phần thao tác ở prompt. Bốn điểm, mỗi điểm chống một kiểu hỏng đã gặp: lấy URL từ
chính lượt execute chứ không gõ lại từ trí nhớ (gõ tay sinh link 404, rồi dev kết luận "không tái hiện
được") · giữ nguyên tham số vì cùng đường dẫn khác tham số thường là màn khác hẳn · màn mở bằng thao
tác thì ghi URL gần nhất cộng một dòng đường đi · che PII trong URL. Account ghi theo **vai trò**,
không ghi mật khẩu, nên luật mới không đụng §1.

Hai mục đó đẩy `08_log_bug_backlog.md` chạm đúng trần thẻ chạy 9k. Luật của kit là **cắt bù trong cùng
luồng, không nới số**, nên tôi rút gọn chính hai mục vừa viết — giữ nguyên mọi yêu cầu, bỏ chữ đệm,
đúng thứ mà mục đó đang dạy. Nay **8.8k / 9k**, không ngưỡng nào bị nới.

### Dương tính giả ở cửa SQL, và nó suýt làm mất một phép canh

`full:suite` đỏ ở `sql-readonly-lint`, trỏ vào một file automation của task. Sáu ca đối chứng cho thấy
lint **đúng cả sáu**, kể cả câu có `;` rồi comment. Nguyên nhân nằm ở spec: nó bốc chuỗi SQL ra khỏi
**văn bản nguồn** mà không giải escape, nên `\n` còn là hai ký tự. Sau khi bóc comment tới cuối dòng,
phần sót lại sau dấu `;` vẫn còn mấy ký tự đó, và lint kết luận "còn statement nữa".

Tách bạch bằng một phép đo: `\n` là xuống dòng thật ⇒ **cho qua**; `\n` là hai ký tự ⇒ **chặn**.

Dương tính giả ở cửa SQL là loại nguy hiểm nhất, vì cách "sửa" nhanh nhất luôn là ném file vào danh
sách bỏ qua — và thế là mất luôn phép canh trên file đó. Nay giải escape trước khi soi, hàm dùng chung
ở `tests/fe/infra/_go_escape.ts`, kèm bốn đối chứng. Cái quan trọng nhất trong bốn: **stacked query
thật vẫn phải bị chặn** — một bước chống-báo-oan mà nuốt luôn ca thật thì tệ hơn báo oan.

### Luật đặt quá rộng, và `release:verify` bác nó

Bản đầu của bản sửa `rule_coverage` cho hàm đếm spec **NÉM** khi không đọc được `git ls-files`. Trong
repo thì đúng. Nhưng gói phát hành **cố ý không mang `.git`**, nên `selfcheck.spec.ts` gọi `dungBang()`
là chết ngay — `release:verify` ra 14/15.

Rủi ro thật mà luật đó cần chặn không phải "đếm theo đĩa", mà là "sinh tài liệu với số theo đĩa rồi
COMMIT, để CI tính ra số khác". Chuyện đó chỉ xảy ra trong repo git. Ngoài repo thì không ai commit
tài liệu, và ở đó đĩa cũng chính là tập file đã phát hành. Phạm vi đúng: **cấm GHI, không cấm ĐỌC**.

Đo trong môi trường không-git THẬT (giải nén gói, mượn `node_modules` bằng junction), không suy luận:
`dungBang()` chạy được · `--write` từ chối với exit 2 · `selfcheck.spec.ts` trong gói 28/28 xanh.

### Cửa chặn đóng gói đo sai mẫu số — và nó chưa từng có máy nào canh

`full:suite` quyết định `package:kit` có được chạy hay không. Nó quét **cả thư mục**, còn
`package_kit.collect()` thì **chỉ lấy file đã git track** — nó còn in thẳng *"bỏ N file CHƯA git track
(không được phát ra ngoài)"*. Hai mẫu số khác nhau cho cùng một quyết định, và chỗ lệch có hai hậu quả
thật:

- **Đỏ oan chặn phát hành.** Một spec probe chưa track (chạm UAT, timeout 30s) làm `full:suite` đỏ
  trong khi nó **không bao giờ** nằm trong gói. Cây đang phát hành vẫn sạch.
- **Chạm UAT không ai xác nhận (§2).** Những probe đó drive app thật. Để chúng trong phạm vi
  `full:suite` nghĩa là mỗi lượt chạy lệnh PHÁT HÀNH lại chạm UAT — như một tác dụng phụ, không phải
  một quyết định. `ci:scope` đã gác đúng chuyện này cho tập đã track; sổ thì chưa.

Đây **không** phải nới phạm vi cho dễ xanh: tập đã track chính là tập được phát ra ngoài, nên nó là
mẫu số ĐÚNG cho câu hỏi *"bản sắp đóng gói có chạy không"*. File chưa track vẫn phải xanh trước khi
commit, nhưng đó là việc của lượt commit.

Và `full_suite_ledger.js` trước nay **không có spec nào canh** — một cửa chặn hỏng im lặng là cửa
hỏng theo hướng tệ nhất. Nay có 5 phép kiểm, hai cái đáng nhất:

- **mọi spec sẽ phát ra ngoài đều phải nằm trong lượt chạy.** Thiếu là cửa đang gật đầu cho thứ nó
  chưa đo. Quan hệ đúng là **gói ⊆ lượt chạy** chứ không phải bằng nhau — bản đầu tôi viết "bằng nhau"
  và nó đỏ ngay, vì hai spec `db-verify-*` được track nên phải chạy ở repo nhưng `DENY` cố ý loại khỏi
  gói. Phần dư nay neo vào chính `DENY`, không neo vào danh sách tên file gõ tay.
- **thu hẹp phạm vi không được làm mất răng**: sổ vẫn ghi `head` + vân tay gói, `--kiem` vẫn chặn.

Thêm một điều kiện cho mọi bước "bỏ bớt file": máy phải **đếm và nói ra** đã bỏ bao nhiêu. Im lặng thu
hẹp phạm vi đúng là cách một bộ kiểm teo dần mà vẫn báo xanh.

### Kiểm 6 cửa rồi kết luận về CI — chỗ tôi hụt

Đẩy xong thì `static-check` ĐỎ ngay, ở `library:drift`. Tôi đã kiểm 6 cửa ở worktree sạch tại HEAD và
thấy xanh, rồi đẩy — nhưng `static-check` chạy **20 bước**, không phải 6. Kiểm một tập con rồi kết
luận về cả CI chính là lỗi **mẫu số tự chọn** mà bản này đi sửa ở ba chỗ khác.

Chỗ trôi thì CÓ TỪ TRƯỚC v2.9.0, không phải do bản này sinh ra:

- trang ghi `25 skill`, repo có **26** (ba nơi);
- trang ghi `132 máy — 93 CHẶN`, `GATES.md` ghi **134 / 95** (bốn nơi, viết bằng ba kiểu dấu khác nhau
  — và chính vì viết nhiều kiểu nên bản đầu của `library_drift` từng chỉ bắt được một chỗ);
- hai máy chưa bao giờ có mục trên trang: `concurrency_check.js` (v2.8.4) và `skills_refcheck.js`
  (v2.9.0), cộng skill `tc_design_guide`. Thêm máy mà quên trang là **lỗi lặp được**, và trang là chỗ
  người ngoài đọc để biết kit có gì;
- trang còn ghi phiên bản kit là 2.8.2.

Thêm `rule --check` đỏ do chính tôi sửa `RULE_GLOBAL` (thêm luật link môi trường, sửa mục lục trỏ
`§7 trục`): mục lục ghim SỐ DÒNG và chi phí token nên nội dung dời là lệch. `rule:toc` sinh lại.

### Số đo của bản này

| | |
|---|---|
| `full:suite` (138 spec đã track) | **2.026 xanh · 0 đỏ · 0 bỏ qua** |
| `release:verify` | **15/15 bước** — suite trong gói **1.882 xanh · 49 bỏ qua** |
| gói | 618 file · 7,63 MB (tăng 2,3 MB: tarball `xlsx`) |
| file được track | 746 · 143 spec |

Con số `full:suite` **không so được** với các bản trước: từ bản này nó đo 138 spec đã track, không còn
đo cả probe WIP trên đĩa. Nói ra chỗ đứt gãy đó thay vì để người đọc tưởng bộ kiểm vừa teo đi.

`kit-2.9.0.tar.gz` **giữ nguyên**, không bị ghi đè — artifact của tag cũ vẫn khớp tag.

### Tự bác một lần nữa

Tôi báo `gates:index:check` trả **exit 0** khi không phán được, và định sửa nó. Đo lại không qua pipe:
nó trả **exit 2**, đúng chuẩn. Con số 0 là exit của `tail` trong `cmd | tail`, không phải của `node` —
cùng lớp lỗi đo đã ghi ở `release:verify dùng gói cũ`. **Kit không có lỗi đó; phép đo của tôi có.**

---

## v2.9.0 — 2026-10-15 — Skill `tc_design_guide`: dạy thiết kế TC, và mỗi điểm dạy nối tới một máy

> Bản này gói cả nội dung **v2.8.4** (harness đồng thời + bù bảo mật read-only) — xem mục ngay dưới.

**Vấn đề.** Kit A (QIG QA) mạnh ở phần **dạy thiết kế testcase**: bảng kỹ thuật, checklist field,
checklist component, anti-pattern. Kit B không có skill dạy tập trung như vậy — kiến thức rải trong 22
chiều và `RULE_GLOBAL`. Nhưng A chỉ **dạy**; đợt này vừa dạy vừa **ép**: mỗi điểm dạy nối tới một máy
kiểm có thật, hoặc ghi thẳng *"chưa có máy — review tay"*.

### Số đo, không ước lượng

| | A (`rbt-manual-testing`) | `tc_design_guide` |
|---|---|---|
| Phần **luôn-nạp** | **16.204** token, một file 937 dòng | **1.558** token |
| Tổng nội dung | 16.204 | 1.558 + **4.594** (`references/`, nạp khi cần) |
| Điểm dạy có máy kiểm | 0 (AI tự chấm bằng văn) | **11** |
| Chỗ chưa có máy, nói thẳng | — | **4** |
| Kỹ thuật phủ | 3 dòng bắt buộc (EP+BVA · DT · ST) | **8** (thêm UC · EG · **PW** · **CT**) |

### Hai lần test bắt chính tôi

1. **Tôi bịa tên máy.** Bảng "điểm dạy → máy kiểm" ghi `npm run matrix` cho Decision Table và Pairwise —
   **script đó không tồn tại**. Bịa tên máy là điều kiện DỪNG của đợt, và test *"chỉ nêu máy CÓ THẬT"*
   bắt ngay lượt chạy đầu. Tên đúng: `matrix:coverage`.
2. **Tôi nói THIẾU, không phải nói thừa.** Bản đầu ghi *"pairwise: chưa có máy đếm cặp — review tay"*.
   Thật ra `matrix_coverage.js` **là** máy pairwise, và nó kiểm hơn thế: phủ **cặp** lẫn phủ **lớp kết
   quả** — một bộ đủ mọi cặp vẫn có thể bỏ sót một lớp kết quả theo spec. Chỗ thật sự chưa có máy là
   **classification tree**.

### Có máy từ v2.5.0 mà không có đường khai

`matrix_coverage.js` là máy pairwise từ v2.5.0, nhưng `design_techniques.json` chỉ có 6 mã ISTQB và
**không mã nào cho pairwise** — tức có máy mà case không có cách khai, nên **không case nào từng mang
tag đó**. Thêm `PW` và `CT`. Gate `design-technique-gate` vẫn **đòi đủ 6 mã ISTQB**, chỉ thôi cấm mã bổ
sung; mã mới vẫn phải qua `kich_hoat` + `dau_hieu_may_kiem` nên thêm một mã rỗng nghĩa vẫn đỏ.

### Cửa `skills:refcheck` — và cái bẫy nó tránh

Kit A bị đếm là **"5 link chết"**. Mở từng cái ra: **cả 5 là đường dẫn MINH HOẠ** — placeholder
`<module>`, ví dụ trong bảng, tên file **đầu ra** vẽ trong sơ đồ luồng, phần lớn nằm trong khối mã. Đo
lại bằng máy: A có **23 link, 0 gãy**.

Một cửa viết ngây thơ sẽ tái tạo đúng dương tính giả đó — rồi người ta "sửa" bằng cách **gỡ ví dụ khỏi
tài liệu**, tức làm tài liệu nghèo hơn để chiều một cái máy đếm sai. Nên cửa phân biệt ba dạng minh hoạ,
và **đã bỏ một luật của chính nó**: luật *"đứng sau chữ VD"* bỏ qua 3 link **THẬT** tới
`CODE_TEMPLATES.md` của A — một file có thật. Luật nào bỏ qua được link thật thì nó nuốt luôn link gãy
thật. Đối chứng hai chiều dùng **chính các ca của A** làm âm bản.

### Ba mâu thuẫn của A, sửa thế nào

- **Quan sát ≠ oracle.** A để tiêu đề *"ảnh thắng"* (thân mục nói *"KHÔNG tự chọn bên nào"*, nhưng vẫn
  bảo **viết TC theo những gì ảnh cho thấy** — tức quan sát trở thành kỳ vọng ĐÃ VIẾT). B: quan sát ở
  lại `observed`, lệch nhau ⇒ câu hỏi cho Ambiguity Gate, case mang `OBSERVATION`.
- **Evidence:** skill **không đặt luật nào**, chỉ trỏ `CLAUDE.md` §4. A đặt luật ở hai nơi và chúng mâu
  thuẫn.
- **Locator:** skill **không nói về locator** — đã có `locator_strategy`.

Mỗi cái một test grep chặn nó quay lại.

### Việc còn lại

- **Ranh giới Actor/Context/Tiền điều kiện chưa có máy** — điểm dạy giá trị nhất port từ A, vẫn review
  tay.
- **Classification tree chưa có máy đếm độ phủ nhánh.** Mã `CT` thêm để case gắn được tag, không phải để
  giả vờ có người gác.
- **Skill chưa dùng để viết một bộ TC thật.** Nó dạy đúng theo các máy đang có, nhưng chưa ai đo xem bộ
  case viết theo nó có tốt hơn không. Phép đo đó thuộc lượt sau.
- **Ca flaky họ `discovery/` vẫn mở**, nay **ba** instance (`discovery-api-inventory` ·
  `discovery-injection` · `discovery-cli`). Cả ba xanh khi chạy riêng, chỉ đỏ dưới tải. Nguyên nhân chưa
  tìm ra từ v2.8.2.

---

## v2.8.4 — 2026-10-14 — Harness đồng thời, bù bảo mật read-only, và ba lần phép đo bác chính thiết kế

> **Không có tag riêng — nội dung này phát hành CÙNG `v2.9.0`.** Tôi bắt tay vào v2.9.0 trước khi
> đóng v2.8.4, nên hai bản nằm chồng trên cùng một nhánh. Đặt tag `v2.8.4` ở HEAD sẽ gói cả code
> v2.9.0 vào một tag mang số 2.8.4 — tức tag nói sai về thứ nó chứa. Giữ mục này vì nội dung có thật
> và tra được; chỉ con số phiên bản là không có. Lỗi trình tự thuộc về tôi.

**Vấn đề.** Kit có chiều §8 (sinh case) và K6 (tải), nhưng **không có máy kiểm bất biến khi nhiều
request đua trên cùng một bản ghi**. Và `security_check.js` tuy chạy 6 nhóm (header · cookie · unauth ·
authz dọc · IDOR · transport) thì **chưa từng chạy**: repo không có `security_catalog.json` nào, kể cả
bản mẫu, trong khi máy đòi `--catalog` và thoát nếu thiếu.

### Mục A — `concurrency:check`: đo ĐÚNG ĐẮN khi đua, không đo tốc độ

K6 hỏi *"chậm bao nhiêu khi 200 người cùng vào"*; máy này hỏi *"**kết quả có đúng không khi 2 người cùng
bấm**"*. Một hệ duyệt đúp vẫn có thể có p95 rất đẹp — K6 xanh, tiền vẫn mất. Nên `concurrency.json` khai
**bất biến**, không khai ngưỡng thời gian.

**Chỗ không hứa được, và nó quyết định cả thiết kế:** không thể bắn N request đúng cùng một thời điểm.
Node một luồng, mạng không hứa thứ tự. Thứ làm được là dựng sẵn N thunk rồi thả cùng lúc, và **đo độ
lệch thật**. Lệch quá ngưỡng ⇒ `CHUA_KIEM`, không phải PASS: hai request cách nhau 300ms thì chúng không
đua, và *"không đua mà không lỗi"* chẳng chứng minh gì. Một harness đồng thời không đo được mình có đồng
thời không thì nó chỉ là một vòng lặp gọi API.

**Hai lần phép đo bác thiết kế, cả hai chỉ lộ khi chạy thật:**

1. **Bản "ĐÚNG" của fixture cũng đua.** Tôi đọc trạng thái TRƯỚC `await` rồi mới kiểm — đúng lỗi TOCTOU.
   Chạy ra: bản đúng cho cả 3 lượt duyệt thành công, y như bản hỏng. Không chạy cả hai vế thì tôi đã ship
   một fixture mà vế ĐÚNG cũng hỏng, và harness sẽ *trông như* hoạt động.
   Lỗi trừ kho phải sửa lần hai: bản hỏng ghi đè cùng một giá trị nên dừng ở 0 thay vì xuống âm — tức
   oversell **không lộ ra**.
2. **Phép thử độ lệch sai cơ chế.** Tôi cho `goi` NGỦ để giả lập "không đua" — nhưng mạng chậm thì N
   request vẫn chồng nhau trong lúc bay, tức **vẫn đua**. Thứ phá cuộc đua là **dispatch bị trễ**. Test
   sai đó báo PASS, và chính nó làm lộ ra rằng tôi đang đo nhầm thứ.

**Cặp hỏng/đúng** — điều kiện để tin harness:

| Kịch bản | fixture ĐÚNG | fixture CÀI LỖI |
|---|---|---|
| duyệt một lần | `200,409,409,409` · 1 lần duyệt | `200×4` · **4 lần duyệt** |
| submit đúp | 1 bản ghi | **4 bản ghi** |
| trừ kho | còn 0 | **còn −3** (oversell) |
| callback trùng | tổng 100 | **tổng 400** |

**An toàn, không nới:** `chay_o: fixture` TỪ CHỐI trên target không loopback · `uat_ghi` mặc định TỪ
CHỐI, cần `--resource-test` + người xác nhận từng lượt · N có trần **cứng 10**, config chỉ hạ được không
nâng được · trên UAT mọi verdict là **ADVISORY**.

### Mục B — ba nhóm bảo mật read-only, và bản mẫu catalog chưa từng có

`session` (token sau logout · token hết hạn) · `tenantIsolation` (danh sách lẫn đơn vị khác — rò ở mức
**TẬP** dữ liệu, khác IDOR theo một id) · `jwt` (sửa payload không ký lại · `alg=none` · chữ ký sai).

Việc đầu tiên **không phải** thêm control mà là dựng `security_catalog.example.json`: thêm nhóm vào một
máy không ai chạy được thì cũng không ai chạy — cùng lớp lỗi với `knowledge/domain` rỗng trong gói mà
v2.8.2 vừa xử. Bản mẫu dùng **host giả**: bản mẫu phát cho người nhận kit không mang endpoint thật của
một dự án.

**Ba chỗ phép đo bác thiết kế:**

1. **Bản mẫu của tôi khai `base`** — mà máy **không đọc** trường đó; nó lấy URL từ biến môi trường
   (`OPS_BASE_URL`, đổi được bằng `baseUrlEnv`). Khai host trong file vừa bị bỏ qua vừa là một chỉ dẫn
   sai.
2. **Fixture sinh token chỉ từ (user, đơn vị, exp)** ⇒ hai lần đăng nhập trong **cùng một giây** ra token
   giống hệt nhau, nên logout phiên này thu hồi luôn phiên kia. Phép thử cô lập đơn vị đỏ vì đúng chuyện
   đó, không phải vì app rò dữ liệu. Thêm `jti` mỗi phiên.
3. **Cửa một-nguồn CHẶN tôi** nối `dua`/`phien_token` vào `leak_report.AXES` — chúng là nhóm **phân loại
   bug**, không phải trục mở rộng. Trộn vào sẽ âm thầm thổi phồng con số "N trục" ở `expansion_audit`,
   đúng thứ v2.8.1 vừa mất một đợt để dọn. Và cách sửa trông hiển nhiên nhất lại chính là nối chúng vào
   `AXES` — nên cửa nay chỉ đọc trong đúng bảng `AXES` thay vì quét cả file.

Năm control, năm cặp hỏng/đúng, tất cả phân biệt được. Thiếu tài khoản thứ hai ⇒ `NEEDS_ACCOUNT`, không
FAIL giả. Không `--confirm-nonprod` ⇒ TỪ CHỐI. Nhóm cần **GHI** thật (mass assignment · upload độc · đổi
mật khẩu thật) **không thuộc đợt này** — ghi rõ trong bản mẫu để không ai đọc báo cáo rồi tưởng đã phủ.

### Nối vào kit

`gate:policy` bắt `concurrency:check` là **npm script mồ côi** — đúng cửa đã bắt `full:suite` ở v2.8.0.
Nối: `smoke:run --concurrency` opt-in **mặc định tắt** (smoke là lượt chạy nhanh; gộp kịch bản đua vào
mặc định làm nó chậm và đổi nghĩa), cộng một mục ở QUICKSTART. `lenhDongThoi` **trả lệnh chứ không tự
spawn**: smoke đã có ba lớp chặn riêng, một máy tự gọi máy khác thì *"lớp chặn nào áp cho lượt nào"*
thành câu khó trả lời.

`leak_report` thêm hai nhóm phân loại, mỗi cái có **đối chứng hai chiều**: mẫu "đua" KHÔNG dò chữ `cộng`
trần (động từ của mọi phép tính); mẫu "phiên" chỉ tính `token` khi đứng cạnh từ về trạng thái phiên —
nếu không thì *"mã token hàng hoá hiển thị sai"* bị bắt oan.

### Việc còn lại

- **Ca flaky họ `discovery/` vẫn mở**, và nay có **ba** instance: `discovery-api-inventory` ·
  `discovery-injection` · `discovery-cli`. Cả ba là spec bò fixture, đều xanh khi chạy riêng, đều chỉ đỏ
  dưới tải. Nguyên nhân chưa tìm ra từ v2.8.2.
- Kịch bản `uat_ghi` chưa chạy lần nào — đúng thiết kế, nó đòi resource test dùng một lần.

---

## v2.8.3 — 2026-10-14 — CI đỏ, và bốn tài liệu dẫn xuất đã trôi khỏi nguồn

**Vấn đề.** Sau khi đẩy `main` lần đầu, GitHub báo **2 check đỏ**. Không phải một lỗi, mà là bốn chuyện
khác nhau — và chỉ hai trong số đó là do đợt này gây ra.

### Hai check đỏ, bốn nguyên nhân

| Check | Nguyên nhân | Của ai |
|---|---|---|
| `static-check` | `.agent/config/GATES.md` thiếu 3 gate mới | **đợt này** |
| `static-check` | `docs/RULE_COVERAGE.md` lệch sau khi RULE_GLOBAL đổi 5→7 trục | **đợt này** |
| `static-check` | trang thư viện ghi 110 máy / 76 CHẶN, repo có 132 / 93 | có từ trước |
| `release` | suite chạy TRONG gói đỏ 20 test trên Linux CI (v2.6.0, v2.6.1 — 11/10) | có từ trước |

Ba mục đầu cùng một lớp: **tài liệu SINH TỪ NGUỒN mà nguồn đã đổi**. Kit có gate canh từng cái, và cả
ba gate đều làm đúng việc — vấn đề là tôi đổi nguồn rồi không sinh lại.

### Hai lỗi trình tự của tôi, cùng một kiểu

1. Sinh `GATES.md` từ worktree ở HEAD **cũ**, rồi sửa `release.yml` trong **cùng commit** — bảng lệch lại
   ngay lúc commit được tạo. Tài liệu dẫn xuất phải là thứ sinh **sau cùng**.
2. Thay số bằng một danh sách file gõ tay, và sót đúng file quan trọng nhất: `gates_kit.js` không phải
   `gates.js`.

Từ lượt thứ ba tôi đổi cách: **quét trọn 22 bước của `static-check` trong một worktree sạch ở đúng HEAD
trước khi đẩy**, thay vì đẩy rồi chờ CI chỉ ra từng cái một.

### Cửa `full:suite` chặn CI vĩnh viễn

Sổ `knowledge/metrics/full-suite.json` nằm trong `.gitignore` — nó là **biên bản một lượt chạy trên một
máy**, không phải tài sản của repo. Nên CI không bao giờ có nó, và `package:kit` chặn với lý do
*"CHƯA CÓ SỔ"*: một thông báo đúng mà sai chỗ, vì vấn đề thật nằm ở chỗ khác.

Sửa đúng hướng: **CI tự chạy cả bộ** trước khi đóng gói, không mượn sổ của ai. Thêm
`npx playwright install --with-deps chromium` + `npm run full:suite` vào `release.yml`.

### `dry_run` của release.yml chưa bao giờ chạy được

`version_check` đọc thẳng `GITHUB_REF_NAME` như thể đó luôn là tên tag. Nhưng nó là **tên nhánh** khi sự
kiện không phải tag. Hệ quả: chạy `workflow_dispatch` trên `main` thì máy so chuỗi `"main"` với `"2.8.2"`
rồi CHẶN — tức chế độ `dry_run`, vốn sinh ra để *"chỉ đóng gói + verify mà không tạo Release"*, **không
bao giờ qua nổi bước đầu tiên**. Một đường chẩn đoán không chạy được thì lúc cần nhất nó vắng mặt.

Nay chỉ coi là tag khi `GITHUB_REF_TYPE === 'tag'` (hoặc tên có dạng `vX.Y.Z` khi biến đó vắng). Đối
chứng hai chiều: nhánh ⇒ *"không chạy từ tag — bỏ qua kiểm khớp tag"*; tag sai ⇒ vẫn CHẶN.

### Trang thư viện: 6 máy chưa có mục

3 máy của đợt này (`full:suite`, `authz:expand`, `oracle:calc`) và 3 máy có từ trước
(`canonical:check`, `db:paths:check`, `db:query`). Thêm đủ mục (`def` · `detail` · `why` · `cmd` ·
`trap` · `src` · `rel`), sửa 4 liên kết `rel` trỏ sang id không tồn tại, cập nhật bốn con số đếm và
phiên bản 2.7.0 → 2.8.2.

### Việc còn lại

- ~~20 test đỏ trong gói trên Linux (11/10) chưa đo lại.~~ **ĐÃ ĐO VÀ ĐÃ SỬA** (15/10/2026).

  Nguyên nhân **không** phải phân biệt hoa-thường trong đường dẫn. Đó là nghi ngờ ghi ở đây, và nó
  SAI — `require('./Foo')` khớp `foo.js` trên Windows là một lớp lỗi có thật, nhưng không phải lớp lỗi
  này. Nguyên nhân thật, hai cái cộng lại:
  - `db_query.js` `require()` thẳng một file `.ts`. Node 24 ở máy tôi tự bóc kiểu nên im; Node 20 —
    đúng mức kit tự khai `engines: >=20` — không bóc, nên chết ở dấu `:` đầu tiên.
  - hai test của chính tôi ghim giả định **có ổ đĩa** (`path.parse(REPO).root`), vốn là `/` trên Linux.

  Sau khi sửa: `release:verify` **15/15 trên Linux** (run 38532446437), `full:suite` trên Linux xanh.

  Bài học không phải "nhớ thử trên Linux". Là: **nghi ngờ viết trong changelog có tuổi thọ dài hơn
  trí nhớ của người viết nó**, nên một bullet mở bằng "chưa đo" phải được khâu lại ngay khi đo xong —
  bản ghi ở đây từng bị tôi chèn kết luận vào GIỮA câu nghi ngờ cũ, nên nó vừa khẳng định đã sửa vừa
  kết bằng "chưa đo nên mới là nghi ngờ", và người đọc không biết tin câu nào.
- Mọi món nợ của v2.8.2 vẫn còn: nguyên nhân ca flaky, câu `isview` chưa đo, hai luật `thieu_nang_luc`.

---

## v2.8.2 — 2026-10-14 — Trả nợ v2.8.1: lượt bò tất định, và trục ⑥ đo được bằng tài khoản đang có

**Vấn đề.** Báo cáo cuối v2.8.1 ghi ra hai món nợ: hai spec nhạy tải đỏ-rồi-xanh trong `full:suite`, và
hai trục mới (⑥ ⑦) chưa chạy trên dữ liệu thật. Đợt này trả cả hai — và phần có giá trị nhất lại là
những chỗ **phép đo bác bỏ chính thiết kế của tôi**, chứ không phải những chỗ nó xác nhận.

### Ca flaky: ba giả thuyết bị bác, một cuộc đua bị dẹp, nguyên nhân vẫn mở

`discovery-api-inventory` (`goi_tu`) và `discovery-injection` (`gộp theo (nhóm, màn)`) mỗi cái đỏ một
lượt rồi xanh **3/3 khi chạy riêng**. Lượt đỏ đếm `tong=12` trong khi mốc ghim **11**.

| Giả thuyết | Phép đo | Kết quả |
|---|---|---|
| nhạy tải CPU | đốt 6 tiến trình CPU, bò 8 lượt | **8/8 giống nhau** — bác |
| state tầng module dùng chung qua `require` cache | đọc cả ba file discovery | **không có** — bác |
| request về MUỘN bị tính/bỏ tuỳ lịch chạy | thêm chờ mạng lặng có biên, bò 6 lượt | **tất định 6/6, và vẫn 11** — bác |

Cũng loại: trùng cổng (`listen(0)`), state fixture dùng chung (`store` tạo trong `start()`), spec khác
ghi `.agent/config/discovery.json` (không spec nào ghi), và 6 spec discovery chạy cùng lúc 4 lượt
(**4/4 xanh**).

**Sửa được một thứ thật, dù nó không phải nguyên nhân.** `crawl.js` nay chờ mạng lặng **có biên** (lặng
250ms thì đi; dù sao không quá 2500ms) trước khi đọc dấu vân tay trang. Trước đó tập request mà
`api_inventory` nhìn thấy là *"những request KỊP về trước khi đóng trang"*, không phải *"những request
trang này gửi"* — tức một cuộc đua, dù hôm nay nó đua ra kết quả nào. Biên là điều kiện để nó không
thành một `waitForTimeout` trá hình: long-polling sẽ không bao giờ lặng, gặp nó thì hết trần rồi đi.

**Con số 12 CHƯA giải thích được, và tôi không nói là đã sửa.** Thay vào đó hai test **tự khai chỗ lệch**:
khi đỏ chúng in trọn danh sách điểm nhập / bảng `goi_tu`. Lượt trước mất một lượt chạy cả bộ 6 phút mà
vẫn không biết nó thừa cái gì.

### Trục ⑥: ba chỗ sai chỉ lộ ra khi chạy trên dữ liệu thật

Một lượt `discover` **CHỈ ĐỌC** trên UAT (CSDL-9001, chủ dự án xác nhận) dựng được ma trận vai trò ×
route: **240 ô — 120 `verified`** (masteradmin) · **120 `unknown`** (vai trò `truong`) · 0 finding ẩn≠cấm.

| # | Sai gì | Trước | Sau |
|---|---|---|---|
| ① | nổ tổ hợp: một biến thể cho mỗi (case, vai trò, **route**) trong vòng lặp case | **3.035** biến thể | 179 |
| ② | `proven` tính ô `verified` thành PASS | **proven=2880** | proven=1 |
| ③ | báo cáo ẩn bảng biến thể khi thiếu ma trận | 5 biến thể vô hình | luôn hiện |

① sai cả về lượng lẫn về bản chất: planner **không biết** case này đụng route nào, nên nhân case với MỌI
route là bịa ra một quan hệ không có.
② là chỗ dễ tự lừa nhất: 120 ô đó chỉ nói *"masteradmin VÀO ĐƯỢC route này"* — không ô nào được so với
một kỳ vọng. Phân quyền chỉ PASS/FAIL khi có neo nói vai trò nào ĐƯỢC hay KHÔNG ĐƯỢC vào đâu
(`CLAUDE.md` §3). Nay chúng in ra như **QUAN SÁT**.

### ⑥ KHÔNG cần ≥2 tài khoản — và luật phải khai nó nói về vai trò nào

Thiết kế v2.8.1 bắt cả ba nhóm biến thể chờ ma trận, tức chờ ≥2 tài khoản. Hệ quả: một dự án một-vai-trò
thì **không bao giờ** đo được phân quyền. `knowledge/domain` có hai rule `active` phủ đúng hai nhóm còn
lại: `BR-NHANSU-029` (cách ly đơn vị) và `BR-HSLOP-025` (quyền theo phân hiệu). Nay `requirements/authz_matrix.json`
khai `luat` kèm `oracle_ref` + số vai trò tối thiểu, và máy sinh biến thể từ chúng **không cần ma trận**.

Nhưng chạy chúng bằng tài khoản sai vai trò là đường ngắn nhất tới **bug bịa**: `BR-NHANSU-029` nói về
tài khoản TRƯỜNG, còn session đang có là `masteradmin` thấy cả 5 cấp — với nó, *"xem được đơn vị khác"*
rất có thể là **ĐÚNG**. Nên luật khai thêm `vai_tro_ap_dung`, và máy đọc vai-trò-có-tài-khoản **từ ma
trận** rồi đánh `needs_account` **kèm tên vai trò cần**. Hệ quả ngay: **4/5 luật chuyển sang chờ tài
khoản — bốn bug bịa bị chặn trước khi sinh ra.**

### "Xin được" khác "không bao giờ có"

Chủ dự án xác nhận QEMIS UAT **chỉ có tài khoản admin**, không có tài khoản cấp trường. Để nguyên
`needs_account` thì mỗi lượt chạy lại sinh một câu hỏi Critical *"xin tài khoản vai trò truong"* cho thứ
không bao giờ có — và một cửa kêu mãi về chuyện không sửa được là một cửa người ta học cách bỏ qua.

Nay có trạng thái riêng `thieu_nang_luc`, và **điều kiện để dùng nó**: config phải khai
`khong_co_tai_khoan[<vai trò>]` với đủ **`vi_sao` · `xac_nhan_boi` · `ngay`**. Thiếu một trong ba thì máy
vẫn coi là `needs_account` — một khoảng trống năng lực không có người chịu trách nhiệm thì nó chỉ là một
chỗ bỏ qua được viết cho gọn. Câu hỏi hạ xuống `Major` và nêu như một khoảng trống, **không bao giờ**
thành PASS.

### ⑥ có `proven=1` bằng một phép đo thật

Vế thứ ba của `BR-NHANSU-029` không phụ thuộc vai trò — *"chưa đăng nhập"* là cùng một trạng thái với
mọi tài khoản.

| | |
|---|---|
| route | `/C2/HoSoTruongDetail.aspx`, một lượt GET ở context SẠCH |
| app làm gì | đẩy về `Login.aspx?returnUrl=~/C2/HoSoTruongDetail.aspx` |
| oracle | neo **cấu trúc**: 1 ô `input[type=password]` · **0** nút `Ghi` của form hồ sơ — không dò chữ |
| verdict | **PASS** · `oracle_ref: BR-NHANSU-029` · evidence `.png` (§4) · chạy 2 lượt cùng kết quả |

Cơ chế nối: probe ghi `test-results/authz_ket_qua.json` (`oracle_ref` · `mo_ta` · `trang_thai` ·
`bang_chung` · `do_luc`); `authz:expand` khớp theo (`oracle_ref`, `mo_ta`) rồi nâng trạng thái. Planner
**vẫn không gửi request nào** — có test khoá theo hướng chuyện đó; phép đo thuộc Phase 2 nơi có evidence.

### ⑦ trên dữ liệu thật

`oracle:calc` cho CSDL-9001: **`proven=2`**, 118 rule trong kho, 0 vi phạm. `expansion_audit` nay thấy
task đó chạy **2/7 trục** (`persist, oracle_calc`) thay vì 1/7.

### `full:suite` giờ typecheck trước

Phát hiện khi đóng gói v2.8.1: 3 lỗi `TS2339` đi qua **trọn một lượt `full:suite` xanh** và chỉ chết
trong gói, vì Playwright chạy `.ts` **transpile-only** — nó không kiểm kiểu. Nay `full:suite` typecheck
TRƯỚC và **không ghi sổ** khi typecheck đỏ: nói "cả bộ xanh" về một cây không biên dịch nổi là nói sai.
Đối chứng đã chạy — cài một lỗi kiểu thì cửa trả `CHƯA ĐO ĐƯỢC` và giữ nguyên sổ cũ.

### Việc còn lại

- **Nguyên nhân ca flaky vẫn mở.** Suite xanh ở lượt chạy, KHÔNG phải xanh ổn định.
- **Câu `isview` của `BR-NHANSU-029` đo được bằng tài khoản admin nhưng CHƯA đo** (`unknown`): nó cần một
  màn Xem nhận tham số đó, và evidence phải **mask PII** vì hồ sơ nhân sự chứa họ tên/CCCD/SĐT —
  `page.screenshot({ mask: … })` lên mọi ô nhập là đường đi, nhưng chưa làm.
- **Hai luật `thieu_nang_luc`** chỉ đo được khi có tài khoản cấp trường; hiện không có.
- **Nhóm dọc** cần vai trò thứ hai để khai `thu_bac`.

---

## v2.8.1 — 2026-10-13 — Hai trục mở rộng, hai chiều Phase 1, và bảy bản sao của cùng một danh mục

**Vấn đề.** `CLAUDE.md` §3 bắt mở rộng 5 trục quanh mỗi case, nhưng không máy nào trả lời được câu
"case band high này đã mở đủ trục mà band của nó yêu cầu chưa". Lý do đo ra được ngay: **bốn máy khai
bốn bộ từ vựng khác nhau cho cùng năm trục**. Chỉ `field`, `surface`, `persist` có mặt ở cả bốn;
`depth.PLAN` có `concurrency`/`reverse`, `leak_report` có `branch`/`state`, `expansion_audit` có
`reverse`/`fixture`, `self_review` gộp ④⑤ làm một dòng. Và bảng band→trục — thứ đáng ra quyết độ sâu —
chỉ được **in ra** ở hai chỗ, không máy nào đọc nó để thi hành.

Đợt này gom về một nguồn, thêm trục ⑥ phân quyền và ⑦ oracle tính toán, thêm chiều §24 Thời gian và
§25 Dữ liệu cũ. Phần đắt nhất lại không phải hai trục mới — mà là **đếm đúng số bản sao**.

### Bốn hoá ra là bảy, và mỗi bản sao lộ ra theo một kiểu khác nhau

| # | Bản sao | Lộ ra bằng cách nào |
|---|---|---|
| 1–4 | `depth.PLAN` · `leak_report.AXES` · `expansion_audit` · `self_review` | khảo sát tay (bước 1a) |
| 5 | `risk_model.json` → `depthPolicy[*].expansionAxes` | có máy canh sẵn ⇒ **đỏ ngay** khi `PLAN` đổi |
| 6 | `finding.AXES` | cửa `full:suite` làm đỏ 2 test ở file khác |
| 7 | bảng hệ số chi phí trong `depth.estimate` | ném `Cannot read properties of undefined (reading 'loads')` |

Bản thứ bảy đáng kể lại nhất: nó là bản sao **duy nhất không ai canh**, nên chi phí của một trục mới
hiện ra bằng một lần **crash**. Nay `so` · `band` · `phase` · `artefact` · `chi_phi` đều nằm trong
`scripts/lib/expansion/axes.js`, và `tests/fe/infra/expansion-gates.spec.ts` đối chiếu từng bản sao còn
lại với nó.

`leak_report` vẫn giữ bảng riêng — có lý do (nó mang thêm `rx` phân loại văn bản bug) **và** có máy canh.
Bản sao có lý do thì được; bản sao không có máy canh mới là chỗ trôi, và v2.8.0 đã trả giá năm lần.

### `finding.AXES`: cùng một khoá, hai nghĩa, hai máy đếm

`finding.js` định nghĩa `reverse` là *"huỷ/hoàn → về trạng thái cũ"*, trong khi `CLAUDE.md` §3 và
`expansion_audit` hiểu chiều ngược là `spec:gap` (build→tài liệu). Một finding gắn `reverse` theo nghĩa
huỷ/hoàn sẽ được audit tính là **đã phủ `spec:gap`** — tức báo đã phủ một chiều chưa ai đo.

Nó còn khai `⑥concurrency`/`⑦reverse`, chiếm đúng hai số mà đợt này định cấp cho `authz`/`oracle_calc`.
Đo trước khi đổi: toàn repo có **2 finding ghi ra đĩa**, mang `①field` và `④branch`; hai khoá kia chưa
từng được dùng. `concurrency` bị bỏ hẳn — không máy nào sinh artefact cho nó, không npm script, và §3
liệt kê 5 trục mà không có nó. Giữ một dòng chữ mà không gì đối chiếu được chỉ làm bảng **trông** đủ hơn
thực tế.

Cùng lượt: `state` vào band high. `PLAN` cũ cho nó ở medium mà KHÔNG ở high — tức "nâng band" từng làm
case bị soi **mỏng đi** ở một trục. Và `expansion_audit` lần đầu đối chiếu được band→trục: **3/5 task đỏ**
vì thiếu trục mà band của chúng đòi.

### Trục ⑥ — phân quyền, và hai tiền đề của thiết kế bị bác

`authz:expand` liệt kê biến thể dọc (vai trò thấp hơn) · ngang (IDOR) · ẩn≠cấm. Nó **không dò** — phần dò
đã có ở `discovery/roles.js` với ba mức bằng chứng và luật "ô `unknown` không làm tròn thành *không có
quyền*".

Hai tiền đề sai:

- *"mỗi vai trò THẤP HƠN vai trò của case"* — toàn repo **không khai thứ bậc vai trò ở đâu cả**. Nên máy
  cũng không suy: thiếu `thu_bac` thì biến thể vào nhóm `doc_chua_xep_hang`, trạng thái `unknown`, kèm một
  câu hỏi Critical. "Chưa biết ai thấp hơn ai" không được in ra như "đã phủ chiều dọc".
- *"ma trận vai trò × route (v2.6.0)"* nói như thể đang có sẵn — **không artefact nào trên đĩa** chứa
  `role_route_matrix`. Thiếu ma trận ⇒ `CHƯA ĐO`: `proven=0`, lý do ghi thẳng vào file, **exit 2** (mã của
  "không phán được", khác exit 1 của "đo rồi và sai").

**Ranh giới không nới:** máy không gửi request nào, và có test khoá theo HƯỚNG (`fetch`/`axios`/`page.goto`
xuất hiện trong mã là đỏ). Biến thể authz-GHI được liệt kê nhưng gắn `chi_chay_tay` — gửi một request ghi
để thử 403 nghĩa là *nếu phân quyền hỏng thì đã ghi thật vào UAT*.

Phép đo đó làm được ở chỗ khác: mutant `grant_permission` lật cờ quyền `false → true` ở tầng
`page.route()`, tức bóp response trên đường về browser, không request nào rời máy. Mẫu nhận khoá quyền
suýt sai **hai lần**, cả hai do đối chứng ÂM bắt: dò `quyen` trần thì `so_quyen_sach` và
`quyen_su_dung_dat` trúng; bật `/i` cho mẫu camelCase thì `canhBaoHienThi`/`island` trúng, vì `[A-Z]` khi
đó khớp luôn chữ thường — tức vứt đúng cái tín hiệu đang dựa vào.

### Trục ⑦ — oracle tính toán, và chỗ dễ tự lừa nhất của cả đợt

L4 cấm "code dùng chung chứa giá trị kỳ vọng"; ⑦ lại bảo viết hàm tính kỳ vọng vào `tests/fe/lib`. Hai
điều đó chỉ không mâu thuẫn nếu oracle **neo vào một rule có mã** — còn không thì ⑦ chính là `app == app`
hạ xuống tầng thư viện, chỗ khó thấy hơn hẳn tầng testcase.

Nhưng neo thôi chưa đủ: một hàm viết theo quan sát app rồi gắn một mã `BR-` vào vẫn trông hợp lệ và vẫn
xanh mãi mãi. Nên mỗi oracle bị đòi **cặp đối chứng** — ca `dung` và ca `lech` (giá trị app có thể trả, mà
oracle PHẢI khác). Thiếu một vế thì `dangKy()` ném ngay lúc nạp module. Ca lệch **không tự nghĩ ra**:
`knowledge/domain` đã có sẵn trong `examples` của chính rule.

Hai oracle thật, không phải ví dụ: `BR-HSTRUONG-010` (bốn ô tổng tự cộng) và `BR-HSLOP-035` (ngưỡng sĩ số,
dẫn TT28/2020 Đ16.1 và TT52/2020 Đ15). Rule thứ hai **không phủ THCS/THPT/GDTX**, nên oracle **ném** cho
ba cấp đó thay vì suy một con số — 45 hay 50 nghe rất thuận tai, và viết vào rồi thì không ai biết nó dựa
trên gì.

`oracle:calc` canh tĩnh: oracle ma (ref không tra ra rule) · rule `draft` (tệ hơn oracle ma vì nó TRÔNG
như có neo) · oracle chạm `page`/`locator`/`expect` · thiếu ca lệch · 0 oracle ⇒ `CHƯA KIỂM` + exit 2. Mẫu
dò chạy trên nguồn **đã bỏ chú thích**, có test riêng cho việc đó — nếu không thì chính khối chú thích giải
thích "không được dùng `page`" sẽ làm máy đỏ, và người ta sẽ gỡ lời giải thích cho xanh.

Band: ⑦ vào **cả high lẫn medium**, khác ⑥ chỉ ở high. Oracle là code thuần, `chi_phi {loads:0, shots:0}` —
lý lẽ "band thấp thu hẹp vì chi phí" không áp cho nó.

### Chiều §24 Thời gian · §25 Dữ liệu cũ

§24 là lớp lỗi duy nhất mà **thời điểm chạy** là một phần của đầu vào nhưng không case nào khai ra. Đo:
`page.clock` chạy thật (ép giờ trang sang 2030), **nhưng chỉ đổi đồng hồ trình duyệt** — app tính hạn, kỳ,
năm học ở server thì ép giờ trang không đổi được gì. Nên §24 có bảng "mốc do ai quyết → đo thế nào → tự
động được không", và nói thẳng phần nào là `Manual` thay vì hứa tự động hoá.

§25 là bản ghi có TRƯỚC luật hiện tại. Mọi chiều khác kiểm trên bản ghi do chính lượt test tạo, tức sinh
dưới luật hôm nay; hệ thống thật chạy phần lớn trên bản ghi của luật hôm qua. **Chỉ đọc** bản ghi cũ —
không chạy script di trú, không sửa dữ liệu cũ cho hợp lệ: nó là thứ duy nhất chứng minh được hành vi
legacy, sửa nó là xoá luôn bằng chứng.

**`dimensionsOf` đổi từ `includes()` sang khớp theo từ.** Thêm một tag ngắn như `time` vào một matcher
chuỗi-con là mở một lớp dương tính giả (`[Timeout]`, `[Lifetime]`, `[Datetime]`). Đo trên 202 tag thật:
hai cách lệch **đúng một chỗ**, và chỗ đó là dương tính giả của bản cũ — `"Gửi yêu cầu mở khóa"` bỏ dấu
thành `"gui yeu cau mo khoa"`, chứa `ui` trong `gui`. Tag đó nằm ở ô `Tag` còn hàm chỉ đọc tiêu đề, nên
**0/951 case đổi kết quả**. Đó là điều kiện để được sửa: đổi cách chấm chiều mà không ai đo thì không phân
biệt được "sửa lỗi" với "đổi số cho đẹp".

**Năm chỗ khai, không phải bốn.** Thiết kế liệt kê bốn; `load-map.spec.ts` bắt chỗ thứ năm
(`load_map.json`) ngay lượt chạy cả bộ đầu. Nay `dimension-wiring.spec.ts` canh cả năm — một lời dặn đã
viết ba lần (§22, §23, và `model.js`) mà vẫn hỏng lần thứ tư thì vấn đề không phải người đọc, là nó chưa
có máy.

Và bảng tag §0b bị **bỏ**, không phải thêm dòng: nó trùng hoàn toàn cột Tag của bảng điều hướng, và đã
trôi đúng kiểu bản sao-không-máy-canh — dừng ở §17 trong khi thư mục đã tới §23, tức sáu chiều có file, có
gate đếm, không có dòng nào ở bảng.

### Ngân sách: cắt bù, không nới số

Phần bắt buộc tăng 363 token (luồng phase1) và 4 (mọi luồng, do `CLAUDE.md` auto-load). Đã cắt bù đúng cam
kết — bỏ bảng trùng, gộp con trỏ, gọn hai dòng điều hướng — ra `✓ ĐẠT` mà không đụng một con số nào trong
`prompt_budget.json`. Một lần cắt **bị máy bác**: gỡ con trỏ "(Đầy đủ: RULE_GLOBAL §7 trục.)" để lấy 2
token, và `rule:parity` đỏ với đúng câu cần nghe — *"luật không có con trỏ thì rút gọn là xoá luật"*.

### Việc còn nợ, nói thẳng

- **Flaky dưới tải chưa sửa.** `discovery-api-inventory.spec.ts` (`goi_tu`) đỏ một lượt rồi xanh ở lượt sau
  trên cùng commit; chạy riêng 3 lượt đều xanh. Nguyên nhân khả dĩ: `boVaTongHop` cache một lượt bò với
  `doTre: 0` — phép đo nhạy thời gian chạy dưới tải tuỳ ý. Bước 2 thêm spec sinh tiến trình node nên làm nó
  lộ ra. Ghi lại thay vì lấy lượt xanh làm kết luận.
- **⑥ và ⑦ chưa chạy trên task thật.** Hai báo cáo sẽ ra `CHƯA ĐO`/`proven=0` cho tới khi có ma trận vai
  trò × route (cần ≥2 tài khoản) và có case gắn `[Time]`/`[Legacy]`. Đó là trạng thái ĐÚNG chứ không phải
  thiếu sót che giấu — nhưng nó có nghĩa hai trục mới **chưa chứng minh được gì trên dữ liệu thật**.

---

## v2.8.0 — 2026-10-12 — Dùng lại script Phase 2, và con số nói thật về mức dùng lại được

**Vấn đề.** Mỗi task Phase 2 viết lại automation gần như từ đầu. Khai thác 421 file automation của 4 task
đã chạy cho thấy 1.387/1.388 lời gọi định vị là `page.locator()` thô, 0 lời gọi `getByRole`, và 29/323
selector lặp chéo task (9%). Không có tầng nào để dùng lại, nên mỗi lượt là một lượt viết mới — và một
lần sửa cách thao tác một widget phải sửa theo SỐ MÀN.

Đợt này dựng tám tầng thư viện, bộ khớp câu bước bằng luật, bộ biên dịch testcase→spec, vòng đời bước, và
bộ đo. Phần đắt nhất không phải code, mà là **đo trước khi thiết kế** — và phép đo bác bỏ tiền đề nhiều
hơn dự tính.

### Tám tầng, trong đó một tầng không có trong thiết kế ban đầu

L0.5 **widget** được chèn thêm sau khi đo: ba hình dạng `#<ID>_Arrow` · `#<ID>_DropDown li` ·
`#<ID>_Input` của Telerik chiếm **475/1.388 = 34%** mọi lời gọi định vị, nhiều hơn bất kỳ "bước nghiệp
vụ" nào. Nó gói theo **loại control**, còn L1 gói theo **màn** — hai trục khác nhau nên không gộp được;
gộp thì cách thao tác một widget bị chép lại theo số màn.

Tầng hiện có: L0.5 `_widget/` (radcombobox · textbox · checkbox) · L1 `screens/` (mô hình màn) · L2
`steps/` (bước nghiệp vụ) · L4 `_checks/` (bộ kiểm). **Luật vàng có máy canh** (`steps:lint`): chỉ
`_checks/` được phép chứa `expect(`. Gói oracle vào bước làm tỉ lệ "dùng lại" nhảy vọt, nhưng lúc đó
oracle bị đóng khung trong code và case vẫn xanh kể cả khi đặc tả đã đổi — `app == app` chuyển từ tầng
testcase xuống tầng thư viện, và khó thấy hơn nhiều.

### Khớp câu bước bằng luật, không gọi model

`steps:match` khớp câu bước của testcase vào danh mục bằng luật và mẫu. Nếu khớp bước cần gọi AI thì mỗi
lượt chạy lại vẫn tốn token, và "dùng lại" chỉ chuyển chi phí từ viết code sang gọi model.

**Ba tiền đề của thiết kế sai, đo trên 952 case · 4.080 câu bước · 5.886 mệnh đề:**

- *"Gộp đồng nghĩa là đòn bẩy"* — sai: 25% → 26%. Giá trị thật của nó là giảm **số mục danh mục** (ba
  khung `kích nút`/`bấm nút`/`click nút` thành một mục 269 lượt).
- *Thiếu hẳn một bước:* **tách mệnh đề**. Đây mới là đòn bẩy, 37% → 47%. Câu bước của QA là câu ghép tới
  bốn thao tác.
- *"Bỏ dấu để so"* phải làm **sau** khi gộp đồng nghĩa. Gộp trên chữ đã bỏ dấu đổi `xác nhận` → `xác bấm`
  (65 câu), `nhân sự` → `bấm sự` (50 câu), và sửa cả nội dung câu `db_readonly: SELECT` (34 câu). Giữ dấu
  + chỉ thay ở vị trí động từ ⇒ 0 va chạm còn lại.

### Biên dịch testcase → spec, và case chưa đủ thì KHÔNG được PASS

`compile:spec` sinh spec Playwright từ MD canonical, **0 token AI**. Hai luật định hình nó, cả hai đi
ngược bản năng "sinh cho đủ":

1. **Case còn TODO sinh ra dưới dạng `test.skip`.** Sinh `test()` thật mà thân chỉ có vài lời gọi khớp
   được thì nó sẽ XANH — xanh vì chẳng kiểm gì — và một case chưa làm xong được đếm vào cột PASS.
   `test.fail()` cũng không dùng được: Playwright coi là đạt khi nó đỏ.
2. **Bộ biên dịch KHÔNG bịa giá trị kỳ vọng.** Chỉ nhận giá trị được bọc nháy trong chính ô kỳ vọng, và
   chỉ khi dòng đó khớp một trong bốn khuôn bộ kiểm L4. Có giá trị KHÔNG có nghĩa là biết phải kiểm cái gì
   với nó.

`compile:check` canh bốn luật, trong đó hai luật không trùng nhau: bỏ `.skip` mà còn TODO, và bỏ `.skip`
sau khi **xoá** TODO nhưng việc chưa làm.

### Vòng đời bước: "chưa đo" không được biến thành một kết luận

`steps:stats` · `steps:promote` · `steps:impact` · `steps:reverify`. Mỗi máy đều **từ chối kết luận** khi
thiếu đầu vào — một cửa luôn mở và một cửa luôn đóng đều vô dụng như nhau, chỉ khác chiều.

- `ti_le_on_dinh: null` nghĩa **chưa đo**, khác hẳn `0`: một bước chưa chạy lần nào không phải một bước
  chập chờn, và `steps:promote` từ chối thăng nó.
- **Cửa phiên bản** chặn khi đổi hợp đồng (`params`/`pre`/`post`/`impl`) mà không tăng số chính, và phân
  biệt rạch ròi với phần không phải hợp đồng (`mo_ta`/`phrases`/`ghi_chu`). Cửa báo oan mỗi lần ai đó thêm
  một `phrases` thì người ta sẽ học cách bỏ qua nó.
- Bước khai `screen: "*"` **không** đổ đồng theo mọi màn đổi: đổ đồng thì cả danh mục đỏ sau mỗi lượt
  discovery, và một tín hiệu luôn bật không còn là tín hiệu.

### Hai mục tiêu của §G KHÔNG đạt, và báo bằng số

`reuse:measure` chạy trên 951 case · 5.886 mệnh đề:

| Mục tiêu | Đo được | Mục | |
|---|---|---|---|
| Dùng lại, module KHÁC | 22% (1.285/5.886) | ≥50% | ✗ |
| Dùng lại, CÙNG module | — | ≥70% | chưa có cặp task nào trên cùng màn |
| Khớp danh mục, case viết tự do | 0–3% → **19%** sau §A0 | — | bị chặn bởi độ phủ danh mục |
| Khớp danh mục, case viết đúng chuẩn | **79%** | — | cùng bộ khớp, cùng danh mục |

Hai dòng cuối phải đọc **cạnh nhau**: khoảng cách đó là phần **chuẩn viết câu bước** mua được, và nó
KHÔNG mua được bằng một bộ khớp tốt hơn. Chỉ **31%** câu bước đang bọc giá trị trong nháy kép.

**Ba mục không đo được, và máy in LÝ DO thay vì in một con số:** token −50% (mốc duy nhất là token theo
*phiên*, không phải theo một lượt sinh automation — chia ra là bịa mẫu số) · 5 bug gài (spec biên dịch
hiện gần như không có lời gọi bộ kiểm nào) · `mutation_check` (cần chạy thật trên UAT, và §2 đòi xác
nhận). Ba mục đó **không được đọc thành "đã đạt" hay "không đạt"**.

### Chuẩn viết câu bước: ba trong năm luật bị LOẠI vì phạt oan

`tc:review` thêm tiêu chí 9, nhưng chỉ chấm **hai** trong năm luật. Đo từng luật:

- **P3** (dùng động từ chuẩn) bắt **3.425/5.886 mệnh đề = 58%** — và đó là lỗi của bộ chấm, không của
  case: danh sách `chuan` trong config là dạng chuẩn của các **nhóm đồng nghĩa**, không phải danh sách
  động từ được phép. `đọc`, `đếm`, `cuộn` không có đồng nghĩa nên không nằm trong nhóm nào. Một tiêu chí
  phạt 58% vì dùng chữ "đọc" sẽ bị tắt ngay trong tuần.
- **P2** trùng tiêu chí 1 (chồng lấn 8%) · **P5** trùng tiêu chí 2 và `steps:lint`.

Hai luật còn lại cũng phải sửa sau khi soi ví dụ thật: P1 báo oan `Chụp màn hình toàn bảng làm evidence`
(`\b` của JavaScript tính theo ASCII nên biên giới từ quanh chữ có dấu không đáng tin); P4 bắt
`Website = http://...` (giá trị một ô, không phải màn) và `<script>alert(1)</script>` — tức **phạt đúng
những case bảo mật**.

Đo tác động trước khi gắn vào: CSDL-9001 96.2% → 95.0%, các bộ khác 88.9–93.0%, đều xa ngưỡng chặn 75%.

### Buildout thật một module, và `stt:map`

L1 + textbox/checkbox + bước form cho module Hồ sơ trường, **không chạm UAT** (đọc `ui_catalog.json` có
sẵn trên đĩa). Ba con số đo trước khi viết: neo control chỉ có ở **một** cấp (THCS 87/89; bốn cấp còn lại
**0**) · control của màn là text 67 · checkbox 18 · textarea 2, **không có RadComboBox nào** · và
**330/1.079 mệnh đề (31%)** trỏ field bằng `Stt #` chứ không bằng nhãn.

`stt:map` suy bản đồ Stt→nhãn từ bảng đặc tả đối chiếu `expectedFields` — 5/5 màn, **0 nhập nhằng**, 0
nhãn mồ côi — và **từ chối** suy theo thứ tự: đặc tả có 120 dòng cho cả 5 cấp, mỗi màn ít nhãn hơn, và
catalog tự đo `screenIdx` chỉ khớp Stt 10/89. Nhãn ghép khớp nhiều hơn một `expectedField` thì không ghi.

### Smoke hệ thống: mặc định nông và chỉ-đọc

`smoke:gen` sinh smoke từ mô hình màn; `smoke:run` chạy qua **ba lớp chặn**. Smoke trả lời một câu hỏi
hẹp — "thư viện còn nói đúng về app không?" — và **không phán nghiệp vụ**: một smoke phán nghiệp vụ sẽ đỏ
vì dữ liệu UAT đổi, và người ta sẽ tắt nó.

Lớp nông chỉ `goto` + đếm + đọc nhãn: không chạm dữ liệu UAT. Lớp `--deep` GHI THẬT rồi hoàn nguyên nên
**tắt sẵn** và đòi thêm cờ `--toi-dong-y-cham-du-lieu` — `--deep` một mình không đủ, vì §2 đòi xác nhận
trước mỗi lượt chạm dữ liệu.

### Lỗi của chính bộ máy, do máy khác bắt được

- **`gate:policy` một nguồn.** `schema_mini` tự viết thay vì dùng `ajv` (ajv chỉ là phụ thuộc gián tiếp
  theo `eslint`). Luật quan trọng nhất của nó: **từ khoá không hiểu thì NÉM, không bỏ qua** — đợt này đã
  có một gate đọc sai tên khoá (`kqDrift.lech`, không tồn tại) nên luôn mở, và chỉ phép đối chứng âm tìm ra.
- **Hai gate canh "Excel là nguồn" cùng xanh** trong khi 7 bề mặt vẫn khai Excel là source-of-truth: một
  gate chỉ bắt `source of truth` viết dấu cách, còn repo viết `source-of-truth` gạch nối. Đã gom mẫu +
  danh sách bỏ qua + **đối chứng hai chiều** về một nguồn.
- **`compile:spec` sinh ra import dính ổ đĩa** (`from './D:/Project/...'`) khi thư mục đích khác ổ: trên
  Windows `path.relative` giữa hai ổ trả đường tuyệt đối. File trông bình thường và chỉ vỡ lúc Playwright
  nạp. Giờ NÉM thay vì sinh import hỏng.
- **Hai module cắt 60 ký tự ra cùng slug** nên file thứ hai ghi đè file thứ nhất im lặng: báo 196 file,
  trên đĩa 195. Cùng lớp lỗi với chuyện Excel mất 129 ô. Thêm chống trùng + máy canh so số báo với số
  trên đĩa.
- **`ghiDuoc()` đọc lại mà không rời ô**, nên ô bị JS nắn về giá trị cũ khi blur vẫn được báo là ghi
  được — và tệ hơn, `ghi()` cùng file CÓ blur, tức hai hàm nói hai điều khác nhau về cùng một ô, và cái
  sai lại là hàm **đo**.
- **Gói phát hành thiếu cả thư viện bước.** Đo trước khi vá: gói mang 16 file `scripts/qa/reuse/**` (các
  gate) nhưng **0 file** `tests/fe/lib/**` — người nhận kit có đủ máy gác mà không có thứ chúng gác.

### Một phép đo về chính lượt chạy test

Chạy cả bộ offline một lượt với `workers` mặc định (nửa số core) thì **2 test** của L0.5 ĐỎ và cả lượt mất
**2.1 giờ**; chạy riêng thì 17/17 trong 1.3 phút, và hai file browser với `--workers=1` thì 47/47 trong
2.0 phút. Đó là **bỏ đói do tranh chấp**, không phải khiếm khuyết: hai test đó đo **hành vi theo thời
gian**, nên nới ngưỡng chờ để chúng xanh dưới tải là xoá mất đúng thứ chúng đo. Cố ý **không** sửa
`playwright.config.js` (file dùng chung, §5) — cách chạy ghi ở đầu spec, và `smoke:run` ghim `--workers=1`.

## v2.7.0 — 2026-10-12 — Giảm ma sát, và bắt máy kiểm tự chứng minh là nó có gác

**Vấn đề.** Kit có hơn một trăm máy gác, nhưng không gì trả lời được ba câu cơ bản: máy nào chặn ở lúc
nào, máy nào chặn oan, và máy nào chỉ trông như đang gác. Hệ quả là ma sát dồn lên người dùng theo cách
không ai đo được, và một gate hỏng lặng lẽ thì không khác gì một gate không tồn tại.

Đợt này làm hai việc song song: **giảm ma sát có kiểm soát**, và **bắt chính bộ máy kiểm chứng minh nó
còn hiệu lực**. Việc thứ hai là phần đắt hơn, và nó tìm ra nhiều lỗi hơn dự tính.

### Giảm ma sát

**Phân tầng có máy thi hành** (`gate_tier`). Ba tầng T0/T1/T2 nhân bốn ngữ cảnh (write · phase · exit ·
ci). T0 luôn chặn; T1 chỉ chặn ở cửa ra và những lúc khác thì ghi **sổ nợ**; T2 không chặn. Hook lúc ghi
file giờ chỉ chặn T0 — trước đó nó chặn mọi thứ, kể cả lúc người ta đang viết dở.

**Ba cửa ra** (`exit:gate`): `publish`, `bug`, `done`. Mỗi cửa có dấu vết băm theo đầu vào, nên một dấu
vết cũ hoặc một dấu vết của cửa khác không dùng lại được. `.xlsx` chỉ xuất được khi đã qua cửa — chặn ở
ARTIFACT thay vì chặn ở hành động, vì chặn ở hành động thì luôn còn một đường vòng.

**Một lệnh thay cho mười hai** (`npm run check`). Tự nhận phase, chạy 5 máy trong tiến trình và 6 máy
spawn, in một bảng gọn 2,3k byte thay cho 12,7k. Có `--fix` tự sửa định dạng, và một hàng rào quanh bốn
cột **KHÔNG** được tự sửa (`Kết quả mong đợi`, `Dữ liệu Test`, `Loại case`, `Tiền điều kiện`) vì sửa tự
động ở đó là sửa nội dung kiểm thử.

**21 mã lỗi nay nói được cách sửa.** Mỗi mã có `vi_sao`, `sua`, `vi_du` và `tang`.

**Hai làn theo risk** (`npm run lane`): làn gọn và làn đầy đủ. Bốn thứ **không** làn nào nới được: tầng
T0, chuẩn evidence, ngưỡng rerun, và ba cửa ra. Band UNKNOWN luôn rơi về làn đầy đủ.

**Năm lệnh phải nhớ, sáu lệnh được chỉ đường** (`npm run next`). Đo thật và báo thật: tổng số lệnh
**tăng** từ 55 lên 60, không giảm. Thứ giảm là số lệnh người dùng phải *nhớ*.

**Vượt qua có kiểm soát** (`npm run override`): chỉ cho T1 trở xuống, phải có vai trò, lý do dài ít nhất
20 ký tự, hạn 30 ngày, và T0 thì **không có cờ nào**. Mọi lượt miễn trừ vào **sổ ma sát**
(`gate:friction`) cùng mọi lượt chặn và ghi nợ.

### Bắt máy kiểm tự chứng minh

**"Kiểm 0 thứ" không được báo ĐẠT** (`CHUA_KIEM`). Gate khai mẫu số; mẫu số bằng 0 hoặc dưới một nửa đầu
vào thì `PASS` và `WARN` bị hạ xuống `CHUA_KIEM`. `FAIL` được miễn, vì một `FAIL` vẫn là một phép đo.

**Hợp đồng dữ liệu testcase được kiểm bằng kiểu** (`typecheck:scripts`). Hợp đồng đã có sẵn ở
`testcase.d.ts`, nhưng `tsconfig.json` đặt `allowJs: false` nên **không dòng nào** trong `scripts/**.js`
từng được kiểm kiểu. Bật lên thì nó lộ ra hợp đồng đã trôi mất bốn trường (`oracleRefs`, `tags`,
`techniques`, `caseType`) mà `validate.js` dùng cả bốn. Có một phép đối chứng: `t.id` phải đỏ, `t.tcId`
phải xanh.

**Mã gate không do gate gọi tên** (`gate:code-pair`). `maCua()` khớp regex lên câu thông báo, nên mã là
thứ suy ra từ văn bản. Đo trên 7.939 chuỗi literal: 18 chuỗi khớp hai mã hoặc hơn, trong đó có cặp hai
mã T0. Đã đổi sang luật khớp-dài-nhất, siết bốn regex rộng nhất, và khoá đường định tuyến bằng registry.
Máy tự khai giới hạn của phép đo độ phủ: nó gian lận được, và `gate-code-pair.spec.ts` cố ý không nhúng
câu mẫu nào.

**Mốc vàng cho parser mà 30 gate cùng dùng** (`golden:check`). Ba fixture phủ ba bẫy đã từng làm sai số
liệu. Sinh lại mốc là một **lời khai**, phải có cờ `--toi-da-doi-parser`. Cộng hai phép đếm độc lập:
model canonical và một phép đếm thô không đi qua model. Lệch nhau thì `NGHI GATE SAI`.

**Bản đồ luật → gate → spec** (`rule:coverage`). 34 mục luật, 28 nối được gate. Sáu mục còn lại phải có
lời khai của người, một trong **bốn** loại — nhãn thứ tư là chỗ prompt nói thiếu: §Cleanup Rules **đo
được mà chưa có máy**. Nhãn đó dẫn tới việc viết `cleanup:check`.

**Bộ đột biến tự kiểm spec** (`gate:selfmutate`). Bốn toán tử làm hỏng gate rồi xem spec có đỏ không.

**Tầng chấm cho phần máy không đo được** (`npm run judge`). Máy không chấm: nó chọn mẫu tất định, giữ
thang, kiểm lời chấm có neo, và đo người chấm còn hiệu chuẩn không. Chấm chưa hiệu chuẩn là **CHƯA ĐƯỢC
GÁC**, không phải "đạt". Hiệu chuẩn của bản này do một subagent chấm **mù**: 20/20.

**Execute Lite** (`04L_execute_lite.md`). Giữ nguyên 6 chốt, mỗi chốt nêu tên máy đứng sau. Prompt rẻ
hơn 88% (11.760 còn 1.383 token); ở mức luồng rẻ 35% (29.006 còn 18.765), vì file template 13,4k vẫn
phải nạp. Ghi cả hai con số, vì "88%" đứng một mình sẽ được đọc thành tiết kiệm của cả lượt chạy.

### Những lỗi mà chính bộ tự kiểm tìm ra

Phần này đáng đọc hơn danh sách tính năng, vì nó là lý do đợt này tồn tại.

- **Một lệnh CI bị thay ngầm.** §A10.3 đặt tên lệnh là `gate:policy`, mà tên đó đã thuộc
  `policy_source_check.js` đang chạy ở cả hai CI. Thêm khoá trùng vào `package.json` xong, bước
  "Policy 1-nguồn" lặng lẽ chuyển sang chạy máy khác. `JSON.parse` không báo khoá trùng — nó lấy khoá
  sau. `json:check` giờ tự quét văn bản và đếm khoá theo từng object.
- **Một verdict lạ làm case tàng hình.** Case khai `status: "DONE"` chỉ nhận một cảnh báo, rồi bị bỏ qua
  nên không kiểm evidence, không kiểm tầng lỗi, không vào mẫu số. Gate in "0 case đã execute · 0 vi phạm
  chặn" và exit 0 — trong khi `gate_codes.json` xếp `VERDICT_LA` vào tầng T0. Nay nó chặn.
- **Cửa ra chưa từng được chạy end-to-end.** Đảo `if (chanVi.length)` thành `if (!chanVi.length)` — cửa
  cho qua khi có lý do chặn — mà cả 24 test của `exit-gate.spec.ts` vẫn xanh.
- **Cờ `--task` thua env mà không ai biết.** Hai gate đọc cờ bằng một hàm mà spec truyền cả cờ lẫn env
  cùng giá trị, nên env gánh thay khi cờ chết.
- **Lệnh mồ côi bị che.** `gate:policy` so tên lệnh với ngữ liệu gồm cả file của chính lệnh đó, nên mọi
  tên một-từ trùng tên file đều tự thoả mãn. Sửa xong nó bắt ngay `gate:friction` — dựng ở §A9 cùng đợt
  này và không chỗ nào gọi.
- **Phần §A10.1 chưa từng được commit.** Cây làm việc che mất: ba test xanh ở máy và đỏ ở HEAD. Chạy bộ
  test trên cây làm việc không trả lời được câu "bản sẽ phát hành có chạy không".
- **Bộ đột biến tự có ba lỗi**, trong đó một lỗi đếm đột biến làm-vỡ-cú-pháp là "đã bắt" — nhưng file
  không parse được thì mọi spec đều đỏ, kể cả spec rỗng.

### Số đo

| | trước | sau |
|---|---|---|
| máy gác | 102 | 110 |
| máy CHẶN | 73 | 76 |
| test `tests/fe/infra` | 1.434 | 1.590 |
| spec | 110 | 121 |
| file được track | 619 | 653 |
| mục luật nối được gate | chưa đo | 28/34, 6 còn lại đã khai lý do |
| mã T0/T1 khoá được đường định tuyến | 0/21 | 21/21 |
| mã có spec đòi gate phát đúng mã | chưa đo | 2/21 |

Hai con số cuối cố ý đứng cạnh nhau. Đường định tuyến đã khoá xong, nhưng **19/21 mã vẫn chưa có spec
nào chạy gate thật rồi đọc mã ra** — spec hiện kiểm gate đỏ hay xanh, không kiểm mã đính kèm. Số đó được
đo mỗi lượt chạy, không khai tay, để nó không bao giờ cũ.

## v2.6.1 — 2026-10-11 — Trả lại một tính năng đã khai mà chưa cài

**Vấn đề.** Mục `v2.6.0` ngay dưới đây có một bảng tên *"Mười điểm vượt kit QIG QA"*. Điểm số 6 ghi:

> | 6 | không so được giữa các build | chế độ `delta` | trần token riêng 1k |

Cột bằng chứng điền một **trần token**. Một con số trần không nói gì về việc tính năng có chạy hay
không, và lần này nó không chạy: mã chỉ đặt `TRAN.delta = 1000` rồi thôi. Chạy `--mode delta` làm đúng y
như `--mode task` — không đọc snapshot nào, không so gì cả.

Rộng hơn: `mode` chỉ đổi hành vi ở **đúng một chỗ** (cảnh báo khi `task` thiếu `--pham-vi`). Nên "ba chế
độ chạy" thực ra là **một chế độ với ba trần token**, và `--mode task` không hề bò "module của task cộng
lân cận một bước" như §A1 hứa.

Mục `v2.6.0` đã được tag, merge và push trước khi chuyện này lộ ra. Nó là đúng lớp lỗi mà cả v2.5.0 lẫn
v2.6.0 đi sửa ở chỗ khác: **một con số nghe như bằng chứng mà không đo gì**.

**Cách chữa.** Cài thật, không sửa tài liệu cho khớp mã.

### `delta` so hai bản đồ

`scripts/qa/discovery/delta.js` so **hình dạng**, không so dữ liệu:

| So cái gì | Vì sao đúng thứ này |
|---|---|
| màn thêm, màn mất | thay đổi lớn nhất, và `scope_anchor` phải biết ngay |
| field thêm, mất, **đổi ràng buộc** | `maxlength` từ 120 xuống 60 là một case `[BVA]` phải chạy lại, mà nhìn màn thì không thấy gì khác |
| component thêm, mất | lưới mọc thêm phân trang là một lớp case mới |
| API thêm, mất | endpoint mới là bề mặt chưa ai test |

**KHÔNG so giá trị dữ liệu.** Giá trị trên UAT đổi mỗi ngày; so nó thì lượt nào cũng "có khác biệt",
người đọc thôi đọc mục đó, và một thay đổi thật chìm theo.

Hai điều kiện để một snapshot được đem ra so: **cùng host** và **cùng phạm vi**. Đặt một lượt bò cả app
cạnh một lượt bò một module thì mọi màn ngoài module hiện ra như đã biến mất, và bản báo cáo ấy không
nói được gì.

Và một phân biệt đáng giá: **"chưa có gì để so" KHÁC "0 khác biệt"**. Hai câu cho cùng con số 0 mà nghĩa
ngược nhau. Gộp chúng là cách chắc chắn nhất để một build đổi hoàn toàn đi qua êm ru.

### Ba chế độ nay thật sự khác nhau

`--mode task` có `--pham-vi` thì bò trong phạm vi **cộng lân cận một bước**. Màn ngoài phạm vi mà module
của task link tới là chỗ dữ liệu đi ra hoặc đi vào, tức đúng nơi lỗi xuyên module sống. Trang lân cận
được thăm rồi **dừng**, không gom link tiếp — thiếu chặn đó thì "lân cận một bước" biến thành bò cả app
sau vài vòng, và cái tên `task` lại hứa một thứ mã không giữ.

### §B10 — đề xuất chạy lại, lấy từ delta

Điểm nối thứ 9 của §B. Màn mới và field đổi ràng buộc ra mức **cao**; component mới ra **trung bình**.

**CHỈ đề xuất, không tự chạy** — cùng luật với `reliability --promote`. Máy biết *cái gì* đổi nhưng không
biết thay đổi đó có đáng chạy lại hay không: một đổi nhãn hiển thị và một đổi `maxlength` trông giống
nhau trong diff mà hệ quả khác hẳn.

### Bảng 10 điểm của v2.6.0, đọc lại cho đúng

Điểm 6 của mục dưới **chỉ đúng từ bản này trở đi**. Cột bằng chứng của nó nay là: 16 test, gồm ca field
đổi `maxlength`, ca khác phạm vi thì không so, và ca phân biệt "chưa có gì để so" với "0 khác biệt".

Chín điểm còn lại của v2.6.0 không bị ảnh hưởng — chúng đều có test và số đo thật từ lúc đó.

---

## v2.6.0 — 2026-10-11 — Bước 0: lấy mẫu số từ thứ QUAN SÁT ĐƯỢC, không chỉ từ tài liệu

**Vấn đề.** Trước bản này kit chỉ khám phá ở mức một task hoặc một màn, và luôn đi từ tài liệu. Hệ quả đo
được: mẫu số coverage chỉ gồm những gì **tài liệu nhắc tới**. Màn hoặc API không có trong tài liệu thì
không ai test, và không gate nào biết.

**Cách chữa.** Thêm Bước 0 chạy trước `phase1_00`: một lệnh `npm run discover` bò app bằng script tất
định, rồi trả về bản đồ màn, danh mục API, bản đồ phủ tài liệu và bản đồ điểm nhập injection. Agent chỉ
đọc bản tóm tắt (trần 2k token cho chế độ `task`).

### Mười điểm vượt kit QIG QA (A)

| # | A | v2.6.0 | Bằng chứng |
|---|---|---|---|
| 1 | agent tự bò qua MCP, mỗi lượt một kết quả | script tất định, agent đọc tóm tắt ≤2k | 2 test đo hai lượt cho cùng danh sách màn, kể cả lượt bị cắt ngân sách |
| 2 | chỉ thấy phần một tài khoản thấy | ma trận `vai trò × route`, 3 mức bằng chứng | đo trên fixture: 14 verified · 1 config · 17 unknown |
| 3 | API chỉ ghi thụ động | danh mục API, đối chiếu hai chiều với OpenAPI | 18 test, gồm ca endpoint ghi bị tường lửa chặn |
| 4 | chỉ so tài liệu dạng văn bản | gộp UI, network, tài liệu và `knowledge/` | bản đồ bốn ô, 9 vùng trên fixture |
| 5 | không có danh mục loại field | dấu vân tay đọc từ thuộc tính DOM | 18/18 loại field trên một màn form |
| 6 | không so được giữa các build | chế độ `delta` | ⚠ **KHAI QUÁ Ở BẢN NÀY** — lúc đó chỉ có trần token, chưa có so sánh nào. Cài thật ở v2.6.1 |
| 7 | không nối vào gate nào | 8/11 điểm nối đã làm | `scope_anchor` · `dim:coverage` (3 tín hiệu) · `risk_score` · `preflight` |
| 8 | an toàn dựa vào lời dặn | tường lửa ghi ở tầng network | 19 test, 3 đường ghi, 0 request lọt |
| 9 | không biết bò được bao nhiêu | độ đầy đủ kèm 5 nhóm lý do | mẫu số và tử số CÙNG đơn vị route |
| 10 | đầu ra là Markdown cho người | JSON có schema, bản `.md` sinh từ JSON | 4 file JSON, `questions.md`, `summary.txt` |

Ba thứ của A giữ nguyên: ba mức bằng chứng phân quyền (ô `unknown` KHÔNG được làm tròn thành "không có
quyền") · cấm gọi API trực tiếp (có test quét mã nguồn) · dừng xin duyệt trước khi ghi `knowledge/`.

### Lượt chạy thật trên UAT, và năm lỗ chỉ nó mới phơi ra

Chạy `CSDL-9003` trên UAT, vai trò masteradmin THPT, chỉ GET. **Lượt một** ra `6 màn · 292 route báo
captcha · 0 request ghi lọt`. Con số "292 route bắt captcha" đọc như một đặc điểm của QEMIS. Nó không
phải: trong danh sách đó có `/Logout.aspx` — crawler đi theo link Đăng xuất và **tự huỷ session của chính
nó**, nên 292 trang sau đó đều là màn đăng nhập. Không có gì đỏ, không exception, và nó sinh ra một phát
hiện giả rất thuyết phục về sản phẩm từ một lỗi của chính kit.

**Lượt hai**, sau khi vá: `40 màn · captcha 0 · 43 request ghi bị chặn · 0 lọt`.

| # | Lỗ | Vì sao fixture offline không bắt được |
|---|---|---|
| 1 | lệnh không có đường nạp session | fixture không có login |
| 2 | `.auth/` là bản bọc, Playwright im lặng trả context rỗng | không có session cache |
| 3 | ảnh chụp màn không che PII | fixture không có dữ liệu người |
| 4 | crawler đi theo link Đăng xuất | fixture không có link đó |
| 5 | trần thời gian chỉ kiểm ở ĐẦU vòng lặp | không có trang nào đủ chậm |

Lỗ 2 đáng nói riêng: Playwright **không ném** khi `storageState` thiếu `cookies`. Nó trả về context rỗng,
và triệu chứng (`captcha 1 · 0 màn`) **trông y hệt một session hết hạn**. Tôi đã chẩn đoán nhầm đúng theo
hướng đó, đăng nhập lại, rồi lượt sau vẫn hỏng y nguyên với session mới một phút tuổi.

### Hai phép đo bác lại chính thiết kế của bản này

**§B2 so sai đơn vị.** Bản đầu đòi mỗi màn quan sát được phải xuất hiện trong `scope_inventory.md`, khớp
theo chuỗi route. Đối chiếu 40 màn với danh mục THẬT của `CSDL-9003` (55 dòng `INV-` người viết ngày
30/09): **khớp 1, trượt 39**. Danh mục mô tả theo mã chức năng, và một màn chứa nhiều mục phạm vi, nên
đòi khớp một-một là so hai thứ khác đơn vị. Thêm nữa `--mode task` không hề thu hẹp phạm vi, nên lượt bò
đi cả app. Nay khai tường minh theo route, và chỉ hỏi về route NẰM TRONG phạm vi đã khai.

**Một timer quên huỷ làm lệnh chậm 17 lần.** `discover` mất 96 giây trên fixture 7 màn. Đoán sai hai lần
(tranh chấp worker, rồi vòng lặp mở khối) rồi mới đo từng pha: 90,7 giây cho MỘT trang và 95,8 giây cho
BẢY trang. Chính con số không đổi theo số trang mới chỉ ra đây là timer: `Promise.race` tạo `setTimeout`
mà không `clearTimeout`. Huỷ timer thì 96 giây còn 5,7 giây.

### Thay đổi khác

- `A9` bản đồ điểm nhập injection. Chiều security của `dim:coverage` trước đây chấm bằng **regex trên văn
  bản**: một case chỉ cần chứa chữ "injection" là chiều đó tính như đã phủ. Nay đối chiếu với
  `injection_surface.json`, và đếm theo BỀ MẶT (`nhóm@màn`) chứ không theo từng ô. Fixture 6 màn đã ra 10
  điểm nhập ưu tiên cao; app thật 342 module thì lên hàng trăm, và một gate đòi mỗi ô một case sẽ bị tắt.
- Oracle injection chấm theo bốn dấu hiệu quan sát được. Chỉ có dấu hiệu THỤ ĐỘNG (không 500, không lộ
  lỗi) thì ra `OBSERVATION`, KHÔNG thành PASS.
- `risk_score` nhận tín hiệu Impact từ Bước 0. Đây là lời giải cho chỗ đo hụt ở v2.5.0: `tagWeights` lấy
  tag từ bản ghi bug, mà `knowledge/bugs` có 0 bản ghi nên mọi module lấy `default`.
- `ui_components.json` thêm ba component (`pagination`, `filter`, `tab`). Số component CHẶN được tăng từ
  2/6 lên 5/9.
- Che PII trong ảnh bằng `page.screenshot({ mask })`: tô đè ngay lúc chụp, không phải chụp xong rồi bôi.

### Giới hạn còn lại, nói thẳng

- **Ba điểm nối §B chưa làm**: gộp `questions.md` bằng máy · `system_mapper` sinh ứng viên `PM`, `SM`,
  `SS` · `precondition_setup_planner` · `partial-rerun` từ `delta`.
- Lượt chạy thật **chưa đo được mẫu số đổi bao nhiêu**. Cần một lượt bò có `--pham-vi` đúng module học sinh.
- Trên app ASP.NET postback, `moCacKhoi` bấm vào nút gây postback và bị chính tường lửa chặn, nên việc mở
  khối gần như không có tác dụng. Chưa có cách chữa.
- Mọi màn QEMIS dùng chung một `<title>` của master page, nên tên hiển thị trong bảng tóm tắt vô dụng
  trên app đó. Danh tính màn không bị ảnh hưởng vì nó dùng chữ ký cấu trúc.

---

## v2.5.0 — 2026-10-10 — Mười sáu hạng mục, và sáu hạng mục bị phép đo thu hẹp

Mục này viết bù: v2.5.0 chạy xong 44 commit nhưng chưa từng được ghi CHANGELOG hay bump version.

**Số đo.** 771 thành 1.067 test · 89 thành 95 gate · 23 thành 25 skill · `core_rules.md` giảm 1.540 token
mỗi phiên · phần nạp bắt buộc của `/phase1` giảm 4 token và `/phase2` giảm 2 token so với mốc.

**Phép đo bác tiền đề bốn lần.** `spec_extract` đọc OpenAPI: không. Mười sáu tham chiếu dự án cũ: sai
cách đặt vấn đề. `tests/api/` không tồn tại: sai, nó có `.gitkeep`. Risk register dùng được: 10/10 module
band High đều là **tên của dự án trước**. Sáu hạng mục bị thu hẹp sau khi đo ra đầu vào bằng 0: bộ sinh
OpenAPI (0 file swagger) · gộp case trùng giữa task (0/391 tiêu đề trùng) · tín hiệu lịch sử bug
(`knowledge/bugs` rỗng).

**Hạng mục chính.** `matrix:coverage` phủ theo lớp kết quả · `run:analysis` đo lượt chạy có đủ mẫu số để
kết luận chất lượng không · `release:summary` go/no-go có căn cứ và KHÔNG tự quyết · `auto:review` bảy
luật cho automation của task · thẻ API thành ẢNH (luật 4 không đổi, chỉ đổi cách tạo ảnh) · `status:
draft` cho `knowledge/domain` · `skills:lint` · `/start` cho người mới · nhật ký đổi rule · ba mức bằng
chứng cho `PM-*`.

**Hai chỗ sửa sau cùng.** `risk_model.json` gỡ 20 tên module phantom. A/B trên cùng dữ liệu cho `50 module
{High 10 · Medium 10 · Low 30}` thành `30 module {Medium 1 · Low 29}`, và **0 module THẬT đổi band**. Con
số "0 High" là con số đúng của một kho `knowledge/bugs` còn trống, không phải một cải thiện. Và
`confirmed_by` thêm giá trị `Van-ban-phap-quy`: bốn rule neo vào Thông tư còn hiệu lực, ghi `BA` lên đó là
bịa ra một lượt xác nhận không hề xảy ra.

---

## v2.4.1 — 2026-10-10 — Ba lỗi của bản phát hành, và lỗi thứ tư nằm trong cách đo

Một lượt rà độc lập trên bản zip sạch tìm ra ba lỗi. Đo lại từng cái thì hai trong ba có tiền đề sai,
và lỗi thật lớn hơn hẳn thứ được báo.

### Lỗi 1 — một gate tắt im lặng trong bản phát hành

Bản rà nói: `.agent/config/na_reasons_rejected.json` chưa bao giờ được `git add`, nên bản phát hành
không có nó. `dimension_coverage.js` đọc bằng `try { … } catch { return [] }`, nên thiếu file là danh
sách rỗng, là gate "lý do n/a trùng lập luận ĐÃ BỊ BÁC" không bao giờ chặn — và không một dòng nào báo.
Trên máy dev thì xanh, vì file đang nằm untracked ngay cạnh.

Đúng. Đã tái hiện: trên worktree sạch ở HEAD, `dimension-threshold.spec.ts:230` ĐỎ.

Nhưng đo tiếp trên CHÍNH BẢN ĐÓNG GÓI thì ra một tầng sâu hơn. `.agent/config/*` là DENY mặc định,
ALLOW theo danh sách, và danh sách thiếu 10 file mà `scripts/**` có đọc. Ba trong số đó nạp bằng
`require()`, nên gói KHÔNG NẠP NỔI `md_to_xlsx.js` và `playwright --list` trong gói đếm được **0 test**.
Cùng phép đo (`comm` giữa `git ls-files` và `tar -tzf`) còn thấy rơi cả nhánh `manual-run/`,
`.claude/agents/`, `tests/load/`, `LICENSE`.

Cách chữa: `scripts/qa/lib/config_load.js` — một chỗ đọc config gate, ba nước và không có nước thứ tư.
Có file thì dùng; thiếu thì KÊU rõ phép kiểm nào CHƯA ĐƯỢC GÁC, hoặc rơi về bản `.example` và nói là
đã rơi; JSON hỏng thì CHẶN. File hỏng không được có cùng hệ quả với một danh sách rỗng hợp lệ.

Quét toàn kit mẫu `catch → giá trị rỗng`: 41 chỗ, bảng đầy đủ ở `docs/v2.4.1/SILENT_CATCH.md`. Sửa thêm
2 chỗ còn có thể tự tắt gate — `prompt_budget.js` (file khai trong load_map mà thiếu ⇒ 0 token ⇒ ngân
sách báo ĐẠT oan) và `gate_index.js` (source khai mà thiếu thì rơi khỏi bảng, và vì bảng dựng từ CÙNG
phép quét nên hai phía cùng co lại và vẫn "khớp source" — phép kiểm tự xác nhận chính mình).

**Vì sao lọt** — đo chứ không đoán: `release:verify` ĐÃ bắt được chuyện này. Chạy lại nó trên gói v2.4.0
thì `npm ci` ĐẠT và `--list` báo đúng `0 test`. Nó không bị lỗi 2 che. Nó **chưa từng được chạy** cho
bản v2.4.0.

### Lỗi 2 — `xlsx` lấy từ CDN: tiền đề sai cả hai chiều

Bản rà nói `xlsx` là dependency chết. Grep rộng hơn: **11 file trong `outputs/**` đang dùng**, và bản
rà chỉ quét `scripts/` với `tests/`. `git log -S` cho biết nó được thêm một ngày trước đó, chính vì
`typecheck:task` cần nạp được automation có `require('xlsx')`.

Cũng không chuyển về registry npm như gợi ý: registry dừng ở `0.18.5` với hai lỗ đã công bố
(CVE-2023-30533, CVE-2024-22363), chỉ vá từ `0.19.3`/`0.20.2` và hai bản đó CHỈ có trên CDN. Chuyển về
là hạ cấp vào hai lỗ đã biết. Lockfile đã khoá băm, nên giữ nguyên và ghi rõ lý do.

Nhưng cùng lượt rà lại BỎ SÓT một dep chết thật: `form-data`. Không ai `require`, và chỗ duy nhất dùng
`new FormData()` là GLOBAL của Node. Đã gỡ.

Cách chữa gốc không phải một lần grep rộng hơn, mà là một chỗ KHAI: `deps:check` bắt mọi dep không tự
chứng minh được phải có dòng trong `.agent/config/deps_allow.json` — nơi dùng, lý do, và `go_duoc_khi`.
Bốn phép kiểm, trong đó dep dạng URL mà lockfile thiếu `integrity` thì CHẶN.

### Lỗi 3 — subagent đã tạo nhưng không ai gọi

`test-runner` và `excel-convert` tồn tại nhưng không workflow nào nhắc. Trước khi nối, phải xác minh —
và lần xác minh đầu suýt cho kết luận sai: cả hai KHÔNG có trong danh sách agent, và tôi gần như kết
luận file hỏng. Nguyên nhân thật là THỜI ĐIỂM: hai file được tạo trong chính phiên đó, mà danh sách chỉ
đọc lúc phiên khởi động. Ghi lại vì nó lặp được: **thiếu trong danh sách khác với file sai**.

Sau khi nạp lại, cả hai được GỌI THẬT trên fixture offline và trả đúng hợp đồng. Kết quả đối chiếu độc
lập, không tin lời khai: `docs/v2.4.1/AGENTS_VERIFY.md`. Thêm `case-debugger` cho vòng gỡ một case đỏ,
và nó **cố ý không ghim model** — gỡ case đỏ là suy luận, không phải việc máy móc.

### H0 — đếm SỐ LƯỢT, và số đo làm đổ kế hoạch

`token:audit --mau` đếm theo mẫu lệnh. Hai lỗi đo đã mắc khi dựng bảng, cả hai làm bảng nói dịu hẳn đi:
gom theo cờ làm `playwright test` vỡ thành hàng chục mẫu, và tiền tố env (`TASK_ENV=…`) thành mẫu lệnh
nên **822 lượt `playwright test` biến mất khỏi bảng**.

Số đo sau khi vá, trên 5 phiên chạy task thật (11.781 lượt shell):

| Việc | Lượt | Phần |
|---|---|---|
| đáng lẽ dùng tool chuyên dụng (`grep`/`sed`/`cat`/`ls`) | 3.334 | **28,3%** |
| `node -e` một-dòng | 1.442 | 12,2% |
| `npx playwright test` | 822 | 7,0% |
| toàn bộ lệnh gate của kit | 248 | **2,1%** |

Dòng cuối làm đổ kế hoạch ban đầu. `BASELINE.md` ghi `output_gate` 354 lượt nên phần H0 định bó gate
lại; số do AGENT gọi thật là 90. Phần phồng lên đến từ hook `gate_on_write`, mà hook `exit 0` IM LẶNG
khi đạt nên **không tốn token nào** — debounce hook vì vậy không phải phép giảm token, và đã bỏ khỏi
danh sách việc thay vì làm cho đủ mục.

`phase1:check`/`phase2:check` vẫn làm, nhưng khai đúng trần 2,1% ngay trong tài liệu và thẻ thư viện.
Điều kiện sống còn: bó KHÔNG tự kiểm gì, chỉ spawn script gốc rồi gom, nên chạy bó và chạy rời cho cùng
exit code và cùng tập vi phạm theo cấu trúc.

### MỐC token, và hai lỗi của chính nó

Trần `luong` đặt ngay TRÊN mức hiện tại để không đỏ oan ngày đặt, nên nó còn chỗ trống: phase1 còn 1,2k
và phase2 còn 1,5k. Trần chặn chuyện phình TO, không chặn chuyện phình DẦN. Thêm `moc`: số ĐÃ ĐO tại
thời điểm chốt, vượt mốc là CHẶN dù còn xa trần, và muốn thêm chữ thì phải CẮT BÙ trong cùng luồng.

Gate mới này tự mắc hai lỗi, cả hai thuộc loại *xanh mà không gác gì*:

- `tok()` đếm cả ký tự `\r`. Một file 380 dòng mang ~119 token thuần tuý do xuống dòng, nên CÙNG MỘT
  COMMIT đo ra hai số lệch 175 token giữa worktree (CRLF) và cây làm việc (LF). Mốc như vậy chặn OAN
  người vừa checkout và KHÔNG chặn người thực sự thêm chữ. `writing_lint.js` đã học đúng bài này từ
  28/09/2026; gate mới thì chưa.
- Âm bản của nó hạ `moc` đi 1 rồi đòi CHẶN — nhưng khi một luồng tụt xuống DƯỚI mốc thì không gì bị
  chặn, và âm bản XANH trong khi nó không đo gì. Nay nó đo số thực trước rồi mới hạ mốc xuống dưới.

Luật này đã ép cắt bù thật, bốn vòng, ở hai luồng: `+47 → +19 → +1`, rồi `+38/+22 → +9/+2`. Kết quả
cuối: `phase1` −2 và `phase2` bằng mốc, mà vẫn thêm được hàng `rerun:failed` và hàng bó gate.

### Gói chạy được từ con số 0

28 test đỏ trong gói xuống 0, và phần lớn không phải lỗi kit. 16 cái đỏ vì TIỀN ĐỀ chưa dựng — gói cố ý
không mang config lớp PROJECT, preflight chặn đúng và chỉ luôn lệnh `cp`. Nay `release:verify` làm đúng
bước khởi tạo của người nhận rồi mới chạy suite, và in ra đã chép những gì. 11 cái KHÔNG PHÁN ĐƯỢC
trong gói (cần `.git`, hoặc cần tài liệu của repo) nên chuyển sang **bỏ qua kèm lý do**, và
`release:verify` ĐẾM số bỏ qua — một bộ kiểm skip 200 test trông y hệt một bộ kiểm xanh nếu không ai đếm.

### Đính chính số đo của v2.4.0

`docs/token-diet/REPORT.md` và `AFTER.md` ghi `tests/fe/infra` **771/771 xanh**. Sai hai tầng: `771` là
TỔNG số test, và đo lại trên worktree sạch ở đúng tag `v2.4.0` cho **768 xanh · 1 ĐỎ · 2 bỏ qua**. Test
đỏ chính là `dimension-threshold.spec.ts` của lỗi 1. Số cũ đo trên CÂY LÀM VIỆC, nơi file config đang
nằm untracked ngay cạnh. Cả hai tài liệu nay mang đính chính tại chỗ.

### Số đo cuối

| Phép kiểm | Kết quả |
|---|---|
| `release:verify` | **15/15 bước ĐẠT** — bản phát hành chạy được từ con số 0 |
| `tests/fe/infra` trong GÓI | **716 xanh · 26 bỏ qua · 0 đỏ** |
| `tests/fe/infra` trong repo | **846/846 xanh** |
| `prompt:budget --enforce` | ĐẠT — 4/4 luồng ở mức mốc hoặc thấp hơn |
| `gate:policy` · `gates:index:check` · `library:drift` · `writing:lint` · `deps:check` | ĐẠT |
| Gate của kit | 86 → **88 máy**, 59 → **61 CHẶN** |

### Còn mở

Số token thật của một lượt chạy task SAU đợt này chưa có. Nó cần một lượt Phase 2 mới theo runbook
`docs/token-diet/DO-LAI.md`, và lượt đó chạm UAT nên cần người xác nhận. Trước khi có số đó, mọi câu
"đã giảm bao nhiêu" chỉ là ước tính.

Model thật mà subagent đã chạy cũng chưa đọc lại được: frontmatter khai `haiku` và harness nhận agent,
nhưng kết quả trả về không mang tên model.

## v2.4.0 — 2026-10-10 — Đo trước đã, rồi mới biết chỗ tốn không nằm ở nơi ai cũng nghĩ

Đợt này đi giảm token tiêu thụ mỗi lượt chạy. Việc đầu tiên là dựng hai máy đo, và chính chúng bác bỏ
phần lớn kế hoạch ban đầu.

### Hai máy đo, và số liệu nói ngược kế hoạch

`prompt:budget` đo TĨNH: mỗi điểm vào bảo AI đọc bao nhiêu, tách bắt buộc với có điều kiện. `token:audit`
đo ĐỘNG từ transcript phiên thật, chỉ ghi số đếm chứ không ghi nội dung.

Đo trên **4 lượt chạy task thật** (CSDL-9001 đến 9004):

- `Read` vào tài liệu của kit: **0 đến 4 lượt**, trên tổng 117 đến 405 lượt `Read`.
- Ảnh và video: **0,0%** khối lượng kết quả tool, ở cả bốn lượt.
- File prompt nặng chỉ **1% dòng** mang dấu hiệu lý-do.
- Thứ tốn thật là kết quả lệnh shell: **62 đến 75%**. Và nó nhân lên theo số message, vì cache-hit 98,5
  đến 99,0% với context trung bình 494 đến 515k mỗi message.

Nên ba hạng mục trong kế hoạch gốc nhắm vào chỗ gần như không tốn. H7 (tách phần "vì sao" ra khỏi prompt)
có trần **3,4k**; H8 (bỏ lớp trùng) có trần **3k**. Cả hai bị hoãn, và lý do ghi trong
`docs/token-diet/BASELINE.md`.

Ba lần đo đầu đều sai, và cách sai cũng được ghi lại: lần một gộp phiên sửa kit với phiên chạy task; lần
hai phân loại phiên bằng "có đọc prompt không" (sai, vì phiên chạy task hầu như không đọc prompt); lần ba
dùng hệ số 3,6 ký tự mỗi token trong khi kit dùng 3,2.

### Chỗ cắt được, và số trước sau

`--compact` cho gate: mỗi vi phạm một dòng `MÃ · TC ID · ý chính`. Đo trên bộ 265 case thật của CSDL-9003:
**10.696 byte xuống 1.811 byte, giảm 83%**. Nó là lớp TRÌNH BÀY chứ không phải lớp lọc — spec khoá rằng
hai chế độ phải cùng exit code và cùng tập (mã, TC ID), và dòng gộp liệt kê đủ TC ID còn lại.

`results:summary` đọc `results.json` rồi in mỗi case đỏ một dòng, kèm `--grep` để rerun đúng case đỏ. Kit
đã làm một nửa việc này từ 19/09/2026 khi đổi reporter sang `dot`; đây là nửa phía agent.

Bàn giao giữa phase bằng file `handoff/<phase>.md` dưới 1k token, rồi `/clear`. Đây là hạng mục duy nhất
đụng tới nhân tử `context × số message`, tức nhân tử chi phối.

### Ba lỗ hổng ĐÚNG-SAI tìm thấy khi đi đo

Không phải lỗ hổng chi phí, và đều nghiêm trọng hơn chuyện token.

**Ảnh evidence rỗng ruột.** "Có file ảnh" và "ảnh đúng màn" là hai chuyện, không máy nào phân biệt. Hai ca
thật, đã mở mắt kiểm: `CSDL_HSTRUONG_TC_138/step-01-passed.png` **trắng hoàn toàn** (1280×720, 4 KB) của
một step chấm `passed`; `CSDL_NHANSU_TC_121/step-01-failed.png` là **trang lỗi HTTP 503**. Nay đo bằng byte
trên pixel, ngưỡng 0,02 lấy từ phân bố của 1.935 ảnh thật, nằm giữa một khoảng trống rõ (0,0095 so với
0,0289).

**`expansion:audit` đo RỖNG.** Nó đọc `t.id`, một trường không tồn tại; model phơi ra `t.tcId`. Map luôn
rỗng nên MỌI case báo `unknown`, và mọi dòng "NẾU SIẾT TIẾP" hiện 0/6 đỏ. Một máy đo rỗng mà kết quả trông
yên tâm, trong khi nó là máy dùng để quyết có siết gate hay không. Sau khi vá: 0 lên **288 case band high**,
và luật ĐANG ÁP "chưa lập kế hoạch" từ 0/6 lên 1/6 đỏ, chỉ đúng CSDL-9003 với 164 case execute, 118 band
high, 0/5 trục.

**Thiếu band thì rơi xuống tầng mỏng nhất.** `depth.js` mặc định `low` khi cả hai cột rỗng. Mặc định giữ
nguyên vì một spec có sẵn khoá đúng hành vi đó kèm lý do thật, nhưng việc gác chuyển sang gate:
`expansion:plan --enforce` nay TỪ CHỐI chạy khi còn case thiếu band.

### Chống trôi

`prompt:budget --enforce` vào static-check của cả hai CI, ngưỡng ở `.agent/config/prompt_budget.json`. Đo
theo lời khai `bat_buoc` trong `load_map.json`, không theo heuristic của chính nó. Ngưỡng đặt **trên** mức
hiện tại chứ không ở mức mong muốn: H9 là chốt chống trôi, không phải roi dọn nợ, và một ngưỡng đã đỏ ngay
hôm đặt sẽ bị tắt.

### Số đo tĩnh TĂNG, và đó là kết quả đúng

Chuỗi tĩnh của `/phase1` đi từ 142,4k lên **143,4k**. Vì đợt này **thêm** hướng dẫn và **không cắt chữ** —
hai hạng mục duy nhất làm việc cắt đã hoãn. Chuỗi tĩnh chưa bao giờ là đòn bẩy; đo lại chỉ để xác nhận.

Chi phí một lượt chạy thật **chưa đo lại**: lượt đó chạm UAT nên cần xác nhận trước. Mốc cũ đã nằm sẵn
trong `baseline.dynamic.json`.

### Số đo

85 máy kiểm (59 CHẶN) · 23 skill · 67 spec được track · 771 test hạ tầng · 513 file được track.

## v2.3.0 — 2026-10-09 — Sáu luật của gói RBT thành máy, và hai luật của nó bị bỏ

Đợt này nhập một gói tài liệu QA bên ngoài vào kit. Việc khó không phải là chép vào — là quyết **chỗ nào
gói đó đúng hơn kit, chỗ nào kit đã có thứ mạnh hơn, và chỗ nào luật của nó phải bị bỏ**. Mỗi quyết định
đều kèm máy kiểm, vì một luật không có máy đứng sau thì lần nào quên cũng không ai biết.

### Kỹ thuật thiết kế thành tag có máy đếm

`02_gen_testcases.md` vốn đã NHẮC TÊN bốn kỹ thuật, nhưng không gì đo xem case có thật sự thiết kế theo
kỹ thuật đó hay không. Nay sáu mã ISTQB (`EP` `BVA` `DT` `ST` `UC` `EG`) khai ở
`.agent/config/design_techniques.json`, đi vào cột `Tag`, và `validate.js` gác hai tầng.

Chỗ suýt sai: `dimensionsOf()` khớp bằng `includes`. Đo trên 25 chiều đang khai thì `[ST]` là chuỗi con
của `bughistory` và `dbpersist`, `[EG]` là chuỗi con của `negative` và `regression`. Viết `techniquesOf()`
theo cùng kiểu thì **mọi case `[Negative]` của mọi bộ cũ bỗng "đã khai kỹ thuật EG"** — một luật mới tự
bịa dữ liệu để chấm chính nó. Nên so bằng `===` trên tên tag đã bóc.

### Rubric 8 tiêu chí thành máy chấm: `tc:review`

Chấm theo TỶ LỆ chứ không theo điểm tuyệt đối trên 16, vì tiêu chí 8 là `n/a` với bộ chưa dùng tag kỹ
thuật. Chấm tuyệt đối thì bộ cũ tự động mất 2 điểm vì một thứ nó không có lỗi.

### Thứ tự nguồn khi dựng oracle, và `[NeedsVerify]`

Gói nguồn quy định `DOM thật > ảnh > tài liệu`, và "ảnh thắng tài liệu". Luật đó **bị đảo**: DOM và ảnh
CHÍNH LÀ app đang kiểm, nên lấy chúng làm expected là app bằng app. `RULE_GLOBAL.md` nay có ba hạng nguồn,
trong đó ảnh và DOM **chỉ chốt sự thật quan sát**. Lệch giữa hai hạng thành CÂU HỎI Ambiguity Gate, không
tự chọn bên.

Case không trỏ được tới nguồn nào thì mang `[NeedsVerify]`. Cửa đặt ở **publish**, không ở Phase 1: tag đó
sinh ra để tồn tại trong lúc thiết kế, nên chặn sớm là cấm người ta thừa nhận, và họ sẽ GỠ TAG thay vì đi
tìm bằng chứng.

### Danh mục loại field và component

18 loại field (10 của kit HỢP 15 của gói nguồn, trùng 7) và 6 component khai ở
`.agent/config/ui_components.json`, checklist nằm trong file chiều. Hai thứ **không** chép lại vì kit đã có
thứ mạnh hơn: `Status flow` đã có `state_machine` bắt mọi cặp không khai là bất hợp pháp; `CRUD lifecycle`
có 4 trong 7 chặng ở `13b` và `23_db_persistence`.

Giới hạn đã đo và tuyên bố: component KHÔNG phải tag nên máy không đếm được "component X có mấy case". Nó
chỉ gác XUẤT XỨ của lời khai. Và check theo loại field không làm được như gói nguồn mô tả —
`ui_conformance_check.js` kiểm kê TÊN field chứ không có thuộc tính LOẠI, nên inventory theo loại field
không tồn tại, và suy loại từ tên nhãn là dò chữ.

### Sub-mode CHECKLIST cho rà tay

`05_manual_quick.md` có thêm mode CHECKLIST với 4 loại và ngưỡng số mục ở
`.agent/config/checklist_types.json`, gác bằng `design_gate --mode checklist`.

Lỗi bắt được trong lúc làm: tiêu chí "mọi luồng sống còn có mục P1" bản đầu so tên luồng với văn bản các
mục P1, và nó **báo oan ngay trên fixture hợp lệ đầu tiên** — luồng "Phân quyền" được phủ bởi mục P1
"Đăng nhập vai Phòng, mở URL trực tiếp, bị chặn", mà mục đó không chứa chữ "phân quyền". Tên luồng là khái
niệm nghiệp vụ, nhãn mục là thao tác cụ thể. Bản sửa bắt khai hai đầu: luồng phải là một `### Nhóm:` có
thật, và nhóm đó phải có mục P1.

Thêm hai luật gói nguồn không có, vì khuôn mới mở ra hai chỗ gian lận: **ô tick phải trống lúc sinh**
(checklist kèm dấu tick là kết quả bịa), và **số mục tự khai ở tiêu đề phải khớp số máy đếm**.

### Nhánh `manual-run/` — case `Manual-only` có verdict thật

Kit đã biết đánh dấu case không tự động hoá được rồi **dừng ở đó**: Phase 2 ghi `SKIP_SETUP`, và case nằm
mãi ở đó. `SKIP_SETUP` là lời khai "chưa chạy", không phải kết luận.

`manual_run_check.js` làm đúng hai việc. Một, **gác ranh giới lời khai `[manual]`**: case chạy tay mà bộ
canonical khai `[api]`, `[factory]`, `[test_hook]`, `[ui]` hay `[pre_existing]` là CHẶN. Không có cửa này
thì nhánh chạy tay thành đường lách, và coverage automation tụt mà không ai thấy. Hai, **ủy quyền** chất
lượng output cho `output_gate --mode test-execution`.

Luật gói nguồn bị bỏ: nó chỉ chụp ảnh khi FAIL. `CLAUDE.md` mục 4 đòi ảnh hoặc video cho MỌI case đã
execute, cả PASS.

### Dọn hai nguồn trùng, vì không dọn thì tự tạo ra cái mình đang chặn

`PII_PATTERNS` về một nguồn ở `output_rules.js`; trước đó `explore_session.js` tự viết cặp regex đó. Và
danh sách slash command chạm UAT trong spec nay **suy ra** thay vì gõ tay — bản cũ liệt kê cứng 4 file nên
`manual-run.md` thoát khỏi phép kiểm xác nhận.

### Số đo

80 máy kiểm (56 CHẶN) · 23 skill · 59 spec được track · 710 test hạ tầng · 488 file được track.

## v2.2.0 — 2026-09-29 — Kit hết mang dữ liệu của dự án trước, và ba máy gác tự tố mình

Đợt này không thêm tính năng. Nó gỡ thứ nguy hiểm hơn thiếu tính năng: kit đang **mang theo dữ liệu đo
được của một dự án khác** ở đúng những chỗ máy đọc để tự quyết. Agent đọc phải thì neo theo một sản phẩm
không tồn tại, mà vẫn ra kết luận có số.

### Config mà MÁY đọc để chấm điểm đang neo vào dự án cũ

`risk_score.js` đổ **mọi** tên khai trong `risk_model.json` vào register của **mọi** task, không lọc theo
scope. Nên 6 file `risk-register.json` của các task đang chạy đầy module của một sản phẩm khác, và
`executeOrder` chỉ đường test tới thứ không tồn tại. Chính một task đã ghi nhận việc này từ trước mà
không ai xử.

Gỡ 29 module mang tên riêng của dự án cũ, giữ 20 tên tổng quát. Gỡ được mà **không đổi kết quả chấm**:
`knowledge/bugs` và `historical_execution` đang rỗng nên mọi tên ở đó đều là phantom, 0 tín hiệu.

`db.conventions.json` từ 19,9KB xuống 6,2KB — gỡ toàn bộ bảng, cột, màn và bản đồ enum của dự án cũ.
`fieldMap` nay **rỗng có chủ ý**, nên `db_verify_preflight` CHẶN mọi task khai `[DbPersist]`. Đó là cơ
chế đúng theo chính thông điệp của nó. Trước đợt này hai task vẫn qua cửa bằng một bản đồ cột 100% không
liên quan — xanh giả, tệ hơn đỏ.

### Máy gác tên bảng ghi cứng tên của một dự án

`package_kit` từ chối phát hành file mang tên bảng của dự án, nhưng danh sách tên bảng **ghi cứng trong
code**. Hệ quả hai đầu: dự án đó đi rồi thì luật thành luật chết; dự án mới thì tên bảng THẬT của họ
không nằm trong danh sách nên gói vẫn phát ra ngoài kèm tên bảng của họ.

Nay suy từ `db.conventions.json` của chính thư mục đang quét — nơi mỗi dự án đã phải khai bảng của mình.

### `gate:policy` báo "sạch công cụ đã bỏ" trong khi 38 chỗ vẫn dạy lệnh của nó

Mẫu cấm viết `\bAIO\b`, phân biệt hoa-thường, nên **mù với dạng thường**. Trang thư viện vẫn dạy
`npm run aio:publish`, `aio:verify-fields` — lệnh không còn trong `package.json`, trỏ vào thư mục đã xoá.
Đúng bài học mà chính file luật đó đã ghi lại hồi 07/09 với badge `XR`, lặp lại ở kiểu chữ khác.

Thêm `/\baio:/` vào danh sách cấm — bắt **dạng lệnh**, không bắt tên công cụ trong câu kể lịch sử.
`RULE_GLOBAL` canonical còn chỉ đường qua thư mục đã xoá và nói "script đòi `--qa-approved`"; không còn
script nào. `backlog/README.md` mô tả công cụ cũ như còn sống, kèm một câu sai hẳn do lượt find-replace
trước để lại. Viết lại cả hai.

### Ba luật tự tố mình khi bị đem ra dùng thật

- Luật "lý do treo phải có con số" viết `/d/` thay vì `/\d/` — nó kiểm **có chữ cái d**. Mọi lý do tiếng
  Việt đều lọt; luật xanh suốt chỉ vì văn bản cũ tình cờ có chữ `d`.
- Máy canh bảng số QUICKSTART nhận nhánh bằng `strip.every(...)`, mà `every` trên mảng **rỗng** trả `true`
  — ngày danh sách hết mục thì nó coi mọi cây là nhánh mirror rồi cộng nhầm số. Nó bắt đúng lượt lệch này.
- Phép kiểm chống-báo-oan của `env_signals` ngủ 400ms rồi assert danh sách rỗng **ngay**. Request chưa kịp
  về thì mọi danh sách đều rỗng và test XANH mà chưa kiểm gì. Một phép kiểm chống-báo-oan **pass rỗng
  được** thì nó không chứng minh được điều nó nói.

### Testcase kèm câu SQL chạy tay được

Dự án nặng CSDL nên testcase giờ mang sẵn câu truy vấn để QA copy đi chạy. Đặt câu vào ô mở đúng hai đường
lách hai luật nặng nhất, và cả hai đều không nhìn ra bằng mắt khi bộ có vài trăm case: một câu `UPDATE`
lọt vào ô là QA chạy thật lên UAT; `WHERE email = '…'` là PII khách nằm trong testcase rồi lên Sheet.
Máy gác chặn cả hai, và có ba phép kiểm âm tính để nó khỏi báo oan — trong đó có ca thật: một câu `DELETE`
được **trích dẫn** để nói ra rằng proc xoá cứng, tức phát hiện có giá trị nhất của case đó.

### Neo MẪU SỐ của Phase 1

Phase 1 có ba con số quyết định "thế nào là đủ", cả ba đều do chính agent viết ra rồi gate lấy chính nó
làm chuẩn. Triệu chứng: sinh 50 case, QA đọc thấy thiếu, rà lại thì lượt sau ra nhiều hơn hẳn — không
phải lượt sau giỏi hơn, là lượt đầu **không có gì neo**. `scope_anchor` kiểm xuất xứ của mẫu số.

### Dọn văn

220 câu dài quá 35 từ xuống 0 trên toàn bộ tài liệu, và 4 lỗi ĐO của chính `writing_lint` được sửa —
khoảng 1/6 "nợ văn phong" hoá ra là do máy đo sai chứ không phải người viết dở.

### Số đo

`tests/fe/infra` 581 xanh, 0 đỏ, ổn định qua 4 lượt liên tiếp (trước đó flaky 2/5). 11/11 bước
static-check ĐẠT, gồm `library:drift` — lần đầu xanh sau nhiều đợt.

## v2.1.2 — 2026-09-19 — Soi chính thứ đã phát hành, không soi thứ định phát hành

Lượt rà này tải về đúng file `kit-2.1.1.tar.gz` từ GitHub Release rồi kiểm trên đó. Góc đó tìm ra hai
thứ mà kiểm trên bản dựng tại chỗ không thể thấy.

### Prompt template GENERIC đang khai sự thật về DB của một dự án cụ thể

`kit-layers.md` khai `prompt_templates/**` và `.agent/**` là lớp GENERIC. Ràng buộc nguyên văn: "phải
KHÔNG chứa tên hệ thống hoặc task hoặc URL của dự án cụ thể". Nhưng gói 2.1.1 phát ra ngoài kèm mục
"Hai giới hạn ĐÃ ĐO của DB NÀY". Mục đó khẳng định hai bảng cụ thể không có cột audit.
Người nhận ở dự án khác đọc đó là sự thật về DB của họ. Họ cầm oracle của người khác.

Vì sao không cửa nào bắt: `package_kit` cố ý bỏ qua mọi file `.md`. Lý do khai là "tài liệu tồn tại để
kể ví dụ có thật". Lý do đó đúng với `README.md`, thứ người ĐỌC. Nó sai với prompt và workflow, thứ
agent THI HÀNH. Nay `.md` dưới hai thư mục đó bị quét ở mức CHẶN, cùng mức với file dữ liệu.
Đo trước khi bật: sau khi khái quát hoá 3 dòng vi phạm thì 0 hit trên cả hai thư mục.

### Gói phát hành dùng LF, bản nghiệm thu tại chỗ dùng CRLF

Gói trên Release dựng trên Linux nên toàn bộ 346 file là LF. Bản tôi nghiệm thu dựng trên Windows
nên là CRLF. Nội dung giống hệt sau khi bỏ qua CR. Nhưng nghĩa là con số "508 xanh" trước đó đo trên
bản thay thế, không phải trên bytes người dùng tải về.

Đã chạy lại trên chính gói LF, trên Windows: 508 xanh, 19 bỏ qua, 0 đỏ. Công sức chuẩn hoá CRLF giữ
được cả hai chiều.

### Hai remote và toàn bộ lịch sử

So blob SHA từng file: GitHub và GitLab giống hệt nhau. Chên lệch đúng 2 file strip có chủ ý.
Quét secret trên **4.925 blob của toàn bộ lịch sử**, không chỉ cây hiện tại: **0 secret thật**.
Hai phát hiện duy nhất là placeholder bị HTML-escape. Bộ lọc placeholder đã được dạy thêm dạng
`&lt;...&gt;`.

## v2.1.1 — 2026-09-19 — Rà lại trước khi phát hành, và tìm ra một đường rò dữ liệu

Một câu hỏi của chủ repo về "bộ nhớ có theo clone không" mở ra một lượt rà toàn bộ. Lượt đó tìm ra bốn
thứ, trong đó một thứ là đường đưa dữ liệu nội bộ lên mirror public.

### `.gitignore` cho `knowledge/` là danh sách liệt kê, nên mọi thứ MỚI đều lọt

Luật cũ kể từng đường dẫn: `knowledge/index.json`, `knowledge/bugs/*.json`, `knowledge/domain/*.json`.
Danh sách kiểu đó chỉ đúng với thứ đã biết lúc viết. Đo bằng `git check-ignore` trên 7 đường dẫn thực tế:
**5 trên 7 sẽ bị commit**. Gồm `knowledge/leak_machine_map.json` mà chính `README.md` và `leak_report.js`
bảo người dùng tạo, và `knowledge/bugs/<key>.md` với tên file là slug tiêu đề defect.

Chuyện này đã xảy ra thật một lần. Lịch sử repo từng có **86 file `knowledge/`** được commit, rồi gỡ ở
`58a5fe5 chore(security)`. Chúng vẫn nằm trong lịch sử git trên bản public. Quét lại toàn bộ 86 file:
**0 file chứa email, số điện thoại hay secret**. Nội dung là tiêu đề defect nội bộ, module, Jira key và mã
testcase. Luật nay đổi thành cấm cả thư mục rồi mở lại đúng `SCHEMA.md` và các `.gitkeep`.

### Hai cửa cùng mù với file `.env` đặt tên khác

`.gitignore` chặn `.env`, `.env.local`, `.env.*.local`, `.env.bak*`. Nên `.env.uat` và `.env.production`
không bị chặn. Cùng lúc, luật `generic-secret-assign` của `secret:scan` đòi giá trị có dấu nháy, trong khi
file `.env` viết `KEY=value` không nháy.

Đo 19/09/2026: tạo `.env.uat` chứa OPS_PASSWORD và JIRA_API_TOKEN, `git add`, chạy `secret:scan`. Gate báo
OK. Hai lỗ khớp nhau thành một đường commit creds UAT lên mirror public mà mọi cửa đều xanh.

Đã vá cả hai. Thêm luật `env-assign-unquoted` neo hẹp vào khoá viết hoa đầu dòng để không báo oan
`const apiKey = req.body.apiKey`. Nghiệm thu hai chiều: chạy trên 490 file thật ra 0 báo oan, chạy trên
file `.env` giả thì bắt đúng 2 dòng, và dòng placeholder vẫn không bị tính.

### Máy mới giữ hai luật đó không trôi ngược

`tests/fe/infra/knowledge-ignore.spec.ts` hỏi chính `git check-ignore`, không tự diễn giải `.gitignore` bằng
regex. Nó có đối chứng âm ở cả hai đầu: khôi phục luật cũ thì đỏ đúng 5 test, mà nếu ai đó sửa thành
chặn sạch thì ba test khác đỏ vì khung thư mục phải đi theo clone.

### Hai thứ tài liệu chưa nói

**Bộ nhớ của agent không nằm trong repo.** Nó ở `~/.claude/projects/<đường-dẫn>/memory/` và khoá theo
đường dẫn thư mục, không theo dự án. Đo trên máy chủ repo: cùng một bộ kit đặt ở hai thư mục cho ra hai
kho riêng, 164 memory và 17 memory, không thấy nhau. Kho 17 memory còn nhớ Xray, công cụ đã bỏ từ 20/08.
`knowledge:backup` không chạm tới kho này.

**Hai hook forcing-function tắt mặc định.** `.claude/settings.json` là file local và gitignored nên người
mới nhận kit sẽ chạy mà không có `gate_on_write` lẫn `inject_context`. `preflight` có cảnh báo, nhưng
QUICKSTART và USER_GUIDE trước đó không chỗ nào nhắc. `QUICKSTART.md` nay có bước bật hook và một mục
riêng về bộ nhớ agent.

### Vặt

`eslint` trước đây soi cả file nháp `*.tmp.js` đã bị gitignore. Máy dev có file nháp thì thấy `npm run lint`
ĐỎ trong khi CI xanh. Đó cũng là lớp lỗi "kết quả phụ thuộc môi trường chạy", chỉ là ngược chiều.

Kiểm trên gói `kit-2.1.0` thật: knowledge rỗng không làm vỡ lệnh nào. `dashboard`, `risk`,
`domain:check`, `system:check`, `decisions:check`, `howto:check` đều exit 0 và báo thẳng là đang có 0 bản
ghi. Chạy một spec rồi thì `knowledge/metrics/` sinh ra và `reliability` đọc được 37 record.

## v2.1.0 — 2026-09-19 — Đọc đúng tài liệu, và bản phát hành tự chứng minh được

Bản đầu tiên được **đóng gói và nghiệm thu từ con số 0**.
Giải nén ra thư mục sạch, `npm ci`, chạy gate, rồi chạy chính bộ tự-kiểm bên trong gói.
Kết quả **508 xanh, 0 đỏ**. Trước đó `release:verify` chỉ liệt kê test chứ không chạy nó.
Nên chưa ai biết gói có hoạt động hay không.

### Việc lớn nhất: agent đang đọc thiếu spec mà không có tín hiệu nào

Hai đường fetch Confluence đổi HTML sang text bằng đúng một dòng gỡ thẻ. Đo trên 12 trang FS/BRD/US thật:

| | trước | sau |
| --- | --- | --- |
| trang giữ được bảng | 0 / 12 | **12 / 12** |
| dòng Given/When/Then giữ được | 0 / 66 | **66 / 66** |
| trang bị gộp thành một dòng | 12 / 12 | 0 / 12 |

AC của dự án nằm trong bảng. Mất bảng là đọc spec mà không thấy điều kiện chấp nhận.
File vẫn có chữ, vẫn có tiêu đề, đọc vào vẫn hợp lý. Đó là lớp lỗi im lặng tệ nhất.

### Ba máy mới, mỗi máy neo vào một sự cố có thật

- **`docs:health`** — bốn phép đo trên tài liệu đã fetch: LỆCH BẢN, RỖNG, MẤT BẢNG, CÒN ENTITY. Đo trên
  một task: 14 trên 23 trang đã bị sửa sau ngày fetch, 2 file fetch về rỗng mà không báo lỗi.
- **`docs:index` và `docs:cite`** — mọi neo `BR-`, `AC-` phải tra ngược được về file kèm SỐ DÒNG.
  Máy cũ chỉ kiểm hình dạng chuỗi, nên `BR-99` qua cửa y như `BR-07`.
- **`example-config-parity`** — bản `.example` phải đủ khoá như bản thật. Nó bắt được
  `risk_model.example.json` thiếu `minCasesPerDimension`: người nhận chép mẫu ra là mất ngưỡng theo chiều.

### AIO Field Tags

`publish` đẩy Tag dạng lồng và Module vào custom field; `pull` đọc lại được nên round-trip không mất cột.
Kèm gate chặn bộ sinh mới thiếu khối `[Loại][Chiều][Oracle-ref]`.

### Gói phát hành: 7 lỗi chỉ lộ khi soạn gói

Thiếu 10 ảnh User Guide. Thiếu `GATES.md` làm `gate:policy` đỏ. Thiếu 5 config generic.
Mẫu `risk_model` đã cũ. `gitlab_strip.json` khai file không có trong gói. Ba khoá `HUBSPOT_*` không ai
đọc. QUICKSTART bảo "cập nhật" một file gói không có.
Không lỗi nào nhìn thấy được từ trong repo.

### Bàn giao ra ngoài

Ảnh User Guide, dashboard và thư viện thuật ngữ nay **không mang nhận diện của công ty nào**.
Đã bỏ logo, bỏ khẩu hiệu, màu nhấn trung tính. Cơ chế gắn logo vẫn còn cho đội muốn thương hiệu riêng.
`QUICKSTART.md` có luồng clone cho cả hai remote, kèm số đo để người cài tự biết đã lắp đúng chưa.

### Đo được, không phải cảm giác

- `npm test` cắt **92,6%** output (143.542 byte xuống 10.646) bằng một dòng đổi reporter sang `dot`.
  Chi tiết case đỏ còn nguyên; `results.json` và `learn_reporter` vẫn chạy.
- Danh mục gate **63 lên 80 máy** — trước đó 16 file với 26 npm script vô hình với `GATES.md`, gồm cả
  `aio:verify:enforce` là cổng CHẶN.
- Đánh giá RTK (nén output bash) và **kết luận KHÔNG dùng**, kèm số đo: cách nó nén `npm test` sẽ làm hỏng
  `results.json` và `learn_reporter`.

### Lớp lỗi lặp lại nhiều nhất trong đợt này

**Kết quả phụ thuộc môi trường chạy thì "xanh" hết nghĩa.**
Năm cửa đọc không chuẩn hoá CRLF nên đỏ trên checkout Windows.
Một test ghi cứng ngày nên tự đỏ khi sang ngày.
`GATES.md` sinh từ source chưa commit nên máy dev xanh mà CI đỏ.
Cờ riêng của Chromium truyền cho WebKit làm cả lane cross-browser chết ở bước launch.
Lane đó chỉ chạy khi bấm tay nên hỏng lâu mà không ai thấy.

## 2026-09-19 (cross-browser) — Một lane hỏng suốt mà không ai thấy, vì nó chỉ chạy khi bấm tay

Chủ repo nói đây là lần xuất bản quan trọng. Nên tôi kích tay nightly thay vì tin lần chạy theo lịch.
Job `cross-browser` khai `if: github.event_name == 'workflow_dispatch'`. Hai nightly gần nhất đều
**skipped**. Bấm tay mới lộ ba lỗi. Cả ba kết lại thành một điểm mù duy nhất: **Chromium xanh không
chứng minh luật đúng, nó chỉ im.**

**1. Luật "nội dung BỊ CẮT" chưa bao giờ gác.** Hai lỗi chồng nhau trong `geometry.js`.
Thứ nhất: `/ellipsis|clip/.test(...)` — `clip` là giá trị MẶC ĐỊNH của `text-overflow`, nên vế đó đúng
với mọi phần tử. Thứ hai: `clientWidth` của phần tử inline luôn bằng 0 theo spec.
Chromium trả `scrollWidth` 0 nên phép so im. Firefox trả bề rộng thật nên báo "BỊ CẮT" cho một
`<span>` nằm trong khung rộng 1200px.

**2. Fixture thiếu khai charset.** `field-inventory.html` không có `<meta charset>`. Chromium và Firefox
tự đoán UTF-8, WebKit mặc định Latin-1 nên "Trả góp" đọc ra "Trảº£ gÃ³p". Quét cả 3 file HTML được
track: chỉ file này sót.

**3. Cờ của Chromium truyền cho WebKit, làm CẢ LANE chết ở bước launch.** Đây là cái nặng nhất:

```
Cannot parse arguments: Unknown option --disable-blink-features=AutomationControlled
<process did exit: exitCode=1>
```

Cờ đó nằm ở global `use`, kèm ghi chú "đã nghiệm thu: không làm Firefox/WebKit vỡ".
Ghi chú SAI, và sai theo NỀN TẢNG. Trên Windows WebKit bỏ qua cờ lạ nên chạy tay vẫn xanh.
Trên Linux nó từ chối thẳng. Lane này chỉ chạy trên CI Linux, nên hỏng từ lúc thêm cờ.
Đã chuyển cờ về đúng project `chromium-desktop`.

**Nghiệm thu hai tầng.** Ở máy: 597 xanh trên cả ba engine. Trên CI Linux, sau khi vá: **6 trên 6 job
đạt**, kể cả `cross-browser` — lần đầu lane này xanh.

## 2026-09-19 (xuất bản) — Gói đã phát hành được: 508 xanh, 0 đỏ ngay trong gói

**Chốt trạng thái.** `release:verify` đạt **13 trên 13**.
Quan trọng hơn: giải nén gói rồi **CHẠY THẬT** bộ tự-kiểm bên trong.
Kết quả **508 xanh, 7 bỏ qua, 0 đỏ**. `release:verify` chỉ liệt kê test chứ không chạy nó.
Nên bước này mới là bằng chứng.

**Số test đỏ trong gói đi từ 25 xuống 0**, qua bốn lượt.
Mỗi lượt là một lỗi thật. Không lỗi nào nhìn thấy được từ trong repo:

| Lỗi | Vì sao vô hình trong repo |
| --- | --- |
| thiếu 10 ảnh của USER_GUIDE | repo luôn có `docs/` |
| thiếu `GATES.md` ⇒ `gate:policy` đỏ | repo luôn có file đó |
| thiếu 5 config generic (`writing_style`, `env_lanes`…) | repo luôn có bản thật |
| `risk_model.example.json` thiếu `minCasesPerDimension` | repo dùng bản thật, không ai chép mẫu |
| `gitlab_strip.json` khai file không có trong gói | repo có đủ file bị strip |
| 3 khoá `HUBSPOT_*` không ai đọc trong gói | repo có spec DB lớp PROJECT đọc chúng |
| QUICKSTART bảo "cập nhật" file gói không có | repo luôn có sẵn |

**Hai bước setup nay đã có trong tài liệu.**
Chép `project_context` và `risk_model` từ bản mẫu, rồi chạy chính bộ tự-kiểm để biết đã lắp đúng.
Trước đó QUICKSTART bảo "cập nhật" một file gói không có. Người nhận theo tài liệu sẽ không bao
giờ tới được trạng thái xanh.

**Sạch nhận diện.** Gói không còn logo, không khẩu hiệu, không màu thương hiệu.
Bản mẫu branding cũng đổi giá trị ví dụ thành chỗ trống có nhãn. Nó là thứ người nhận chép ra để
gắn thương hiệu CỦA HỬ. Chữ "SAPP" còn lại là MÃ TASK dùng làm dẫn chứng đo, giữ có chủ ý.

**Bảy test bỏ qua đều có lý do tự khai.**
Ba cần dữ liệu trong `knowledge/`, mà thư mục đó gitignore nên gói không mang.
Bốn cần `gitlab_strip.json`, là mirror của một công ty nên không ship.

## 2026-09-19 (phát hành) — Chạy thật luồng xuất bản, lộ ra hai lỗi chỉ thấy khi soạn gói

**Lần đầu chạy trọn `package:kit` rồi `release:verify`: 12/13 bước đạt, KỐT CUỘC LÀ KHÔNG PHÁT HÀNH.**

Hai thiếu sót, đều vô hình khi nhìn trong repo:

1. **Gói không mang `docs/` nào**, trong khi `USER_GUIDE.md` nhúng đúng 10 ảnh ở `docs/user-guide-images/`.
   Người nhận mở tài liệu onboarding chính thấy **10 ảnh vỡ** ngay lần đầu.
2. **`gate:policy` trong gói ĐỎF**: npm script `writing:lint:docs` không bề mặt nào nhắc tới. Truy ra
   `.agent/config/GATES.md` là nơi DUY NHẤT nhắc nó, mà file đó không ship. Bỏ nó ra là tự làm hỏng
   phép kiểm một-nguồn-policy của chính gói. `README.md` cũng trỏ tới file này.

Thêm hai mục vào danh sách đóng gói. Gói đi từ 358 file / 1,12 MB lên **369 file / 4,32 MB**, và
`release:verify` nay **13/13 bước đạt**.

**Đóng gói phải chạy từ worktree sạch**, không phải cây làm việc. Cây đang có 12 file sửa dở của
phiên khác; đóng gói ở đó là nhét việc chưa commit vào bản phát hành. Cùng lớp lỗi với `GATES.md`
sinh từ source chưa commit hôm qua.

**Một lỗi nữa của cửa đọc CRLF, lần thứ NĂM.** Chạy suite trên worktree sạch thì
`slash-commands.spec.ts` đỏ: nó hỏi `startsWith('---
')` mà checkout Windows cho `---
`, nên báo
"thiếu frontmatter" ở CẢ 10 command. Cây làm việc của tôi đang LF nên không thấy. Đã chuẩn hoá cả
6 chỗ đọc trong file, nghiệm thu hai môi trường.

**CÒN MỘT CHẮN THẬT, và không phải việc của đợt này.** Bản đã commit đang **đỏ 13 test**:
12 ở `publish-field-mapping.spec.ts`, 1 ở `dimension-threshold.spec.ts`. Spec đã commit nhưng phần code
chúng cần thì chưa: `publish_testcases_aio.js` đã commit không có `displayTitle`, bản có đang nằm
trong cây làm việc của phiên khác. Phải commit phần đó rồi mới phát hành được.

## 2026-09-19 (khuya) — Dashboard và thư viện dùng chung giao diện với ảnh User Guide

Chủ repo yêu cầu hai trang này trông giống ảnh User Guide.
Đã đồng bộ **43 chỗ màu** trên 6 file. Dùng ĐÚNG bảng ánh xạ đã áp cho ảnh, không chế màu mới.

| Thứ | Trước | Sau |
| --- | --- | --- |
| logo | `logo-sapp.png` nhúng base64 ở cả hai trang | bỏ |
| khẩu hiệu | "Advance your career" | bỏ |
| tên thương hiệu | `brandName` và `eyebrow` mang tên công ty | "QA Automation Kit" |
| màu nhấn | vàng `#FFB700` | chàm `#4F46E5` |
| mực và nền | `#1A1916`, `#FAF8F3` | `#16161A`, `#F7F8FA` |

Font giữ Be Vietnam Pro theo yêu cầu.

**Giữ nguyên CƠ CHẾ gắn logo, chỉ bỏ đường dẫn mặc định.**
Đội nào muốn thương hiệu riêng thì khai `logoPath` trong `.agent/config/dashboard.branding.json`.
Xoá cơ chế là lấy mất lựa chọn của người dùng sau.

**Nghiệm thu bằng MẮT, không bằng grep.** Chụp màn cả hai trang rồi mở ra xem. Grep trước đó đã bỏ
lọt mũi tên màu vàng trong ảnh User Guide, nên lần này không tin grep một mình nữa.

**Chữ "SAPP" còn lại trong hai trang là MÃ TASK**, kiểu `SAPP-26878` trong bảng dữ liệu và ví dụ.
Đó không phải nhận diện, và xoá đi là mất nghĩa. Giữ.

## 2026-09-19 (tối) — Vẽ lại 10 ảnh User Guide, gỡ sạch nhận diện công ty

**Vì sao.** `USER_GUIDE.md` thuộc LỚP GENERIC, tức đi theo gói phát hành tới đội khác. Logo, khẩu hiệu
và màu thương hiệu của một công ty cụ thể không có chỗ ở đó.

**Đã gỡ bốn thứ**, không chỉ cái logo:

| Thứ | Trước | Sau |
| --- | --- | --- |
| logo nhúng | `docs/brand/logo-sapp.png` base64 trong mọi board | chữ "QA Automation Kit" |
| khẩu hiệu | "Advance your career" | bỏ hẳn |
| màu thương hiệu | vàng `#FFB700` và `#E6A300` | chàm `#4F46E5` |
| nền ấm của DS | mực `#1A1916`, nền `#FAF8F3` | trung tính `#16161A`, `#F7F8FA` |

**Font GIỮ NGUYÊN Be Vietnam Pro.** Lượt đầu tôi đổi sang Inter vì font này được khai trong design
system của công ty, nhưng chủ repo yêu cầu giữ lại. Đã trả về. Be Vietnam Pro là font công cộng trên
Google Fonts, không phải tài sản riêng của công ty, và nó đủ dấu tiếng Việt.

**Quét chữ không đủ để nghiệm thu.** Sau lượt thay token đầu, quét chữ thì sạch.
Nhưng **mở ảnh ra vẫn thấy mũi tên màu vàng**. Hai hex `#E6A300` và `#6B4C00` nằm thẳng trong SVG,
không qua token. Phải đọc ảnh thật mới thấy.

**Một lỗi thật do đổi tên khoá.** Đổi `C.gold` thành `C.accent` làm một chỗ gọi `C.gold` còn sót trỏ
vào `undefined`. Bắt được nhờ quét lại toàn bộ file sau khi thay, không phải nhờ test.

**KHÔNG đụng hai chỗ khác cùng dùng logo đó.** Đó là `scripts/qa/dashboard_generate.js` và
`docs/library/build.js`. Hai thứ đó là tài liệu NỘI BỘ, không phát ra ngoài. Chúng còn có quy định
riêng bắt phải theo design system của công ty. Đã ghi ranh giới này ngay đầu file sinh ảnh.

**Còn ba câu nhắc tên công ty** trong README, QUICKSTART và USER_GUIDE.
Cả ba cùng một ý: mô tả `npm run dashboard` dùng design system của công ty. Câu đó ĐÚNG sự thật nên
chưa sửa. Sửa thì hoặc nói sai, hoặc phải gỡ nhận diện cả dashboard. Việc đó trái quy định đang có,
nên chờ chủ repo quyết.

## 2026-09-19 (chiều) — Đổi reporter Playwright sang `dot`, và gỡ một quả bom hẹn giờ

**Đổi `['list']` thành `['dot']`.** Đây là việc mà đợt đánh giá RTK chỉ ra, và nó không cần cài gì.
Suớt 594 test hạ tầng: **143.542 byte xuống 10.646**, giảm 92,6%, tức ~33.000 token mỗi lượt chạy.
`list` in một dòng cho MỎI test đã pass, tức trả tiền context cho thông tin "không có gì xảy ra".

Đã kiểm từng điểm một, không mất gì:

| Điểm kiểm | Kết quả |
| --- | --- |
| chi tiết case ĐỎ | còn nguyên mã case, giá trị mong đợi, `file:dòng` (dựng case đỏ cố ý để so) |
| `results.json` | vẫn ghi, 13.133 byte — `bug_reporter.js` đọc file này |
| `learn_reporter.js` | vẫn chạy — `knowledge/metrics/runs.jsonl` tăng đúng 1 dòng |
| báo cáo html | vẫn sinh |
| CI | **không đổi** — mọi job đều truyền `--reporter=blob` hoặc `--reporter=html`, ghi đè dòng này |

Người ngồi xem trực tiếp muốn thấy tên từng test thì `PW_REPORTER=list npm test`. Theo đúng quy ước
`PW_*` sẵn có trong config.

**Quả bom hẹn giờ.** Chạy suớt sau khi đổi thì 1 test đỏ, nhưng **không phải do đổi reporter**.
`fixture-matrix.spec.ts` ghi cứng `verified: '2026-08-19'` trong ca "ma trận sạch". Luật coi fixture
quá 30 ngày là cũ, nên test xanh tới 18/09 rồi **tự đỏ sang ngày 19/09** mà không ai sửa dòng nào.
Nay ngày đó tính theo hôm nay. Ca đối chứng ngay trên vẫn ghi cứng `2020-01-01` và ĐÚNG phải ghi
cứng, vì nó cần luôn cũ để chứng minh cảnh báo có nổ.

Quét tiếp cả bộ spec: không còn chỗ nào đòi "sạch" mà dựa trên ngày ghi cứng. Cùng lớp với luật
"test không được kế thừa env môi trường", lần này môi trường là đồng hồ.

## 2026-09-19 — Đánh giá RTK: KHÔNG dùng, và cái đáng làm thì không cần cài gì

**Kết luận: không cài RTK.** Không phải vì nó tệ, mà vì đo xong thấy hai chuyện.

**Một: nút thắt là reporter của Playwright, và Playwright đã có sẵn cách chữa.**

| Lệnh | bytes | ước token |
| --- | --- | --- |
| `npm test` (reporter `list`, đang dùng) | 143.542 | ~35.900 |
| `npm test` (reporter `dot`) | **10.646** | **~2.700** |
| `npm run lint` | 7.601 | ~1.900 |
| `git diff` (lúc có 12 file sửa dở) | 66.066 | ~16.500 |
| `git status` | 1.283 | ~320 |
| `library:drift` | 2.874 | ~718 |
| 8 gate còn lại cộng lại | 2.635 | ~658 |
| `typecheck` | 55 | ~13 |

Một dòng đổi `['list']` thành `['dot']` cắt **92,6%** output của lệnh tốn nhất. Đã kiểm: `dot` giữ
NGUYÊN chi tiết lỗi. Dựng một case đỏ cố ý thì cả hai reporter đều in đủ mã case, giá trị mong đợi,
và `file:dòng`. Còn `results.json` vẫn được ghi (803 KB) và chuỗi reporter vẫn nguyên.

**Hai: cách RTK nén `npm test` sẽ LÀM HỎNG hai cơ chế của kit, mà hỏng IM LẶNG.**

Đọc nguồn `src/cmds/js/playwright_cmd.rs` dòng 262–269: RTK **ép `--reporter=json` và xoá `--reporter`
của người dùng**. Chạy thử đúng như vậy trên kit:

| | reporter của config | `--reporter=json` (cách RTK làm) |
| --- | --- | --- |
| `results.json` | ghi, 13.134 byte | **KHÔNG được ghi** |
| `learn_reporter.js` | chạy | **không chạy** |

Cả hai đều là cơ chế lõi. `bug_reporter.js` đọc `results.json`; `learn_reporter` là thứ tự động thu
`knowledge/metrics` và `historical_execution` sau mỗi lượt chạy. Mất hai thứ này mà không báo lỗi là
đúng lớp hỏng im lặng mà kit mất nhiều ngày để bịt.

**Không chạy tiếp Bước 2 tới 5.** Tiêu chí dừng của chính task: tổng output bash một phiên dưới
~15k token thì không đáng. Sau khi đổi reporter, tổng còn khoảng 6–8k token cho một phiên bình
thường. RTK không đụng tới chi phí lớn nhất là nạp tài liệu đầu vào.

**Không cài gì, không sửa gì.** Nguồn RTK chỉ được giải nén ra scratchpad để đọc, không biên dịch,
không chạy. `playwright.config.js` đã khôi phục nguyên trạng sau khi đo.

**Đề xuất để chủ repo quyết**, không tự làm: đổi `['list']` thành `['dot']` trong
`playwright.config.js`. Một dòng, không thêm phụ thuộc, không thêm binary, giữ nguyên chi tiết lỗi.

## 2026-09-18 (dọn) — 455 file nháp ở gốc repo là một đường rò PII

**Gốc repo có 455 file `.tmp.js` và `.out`, 5,4 MB, chưa track.** Quét thử thấy 1 file chứa email
khách và 1 file chứa số điện thoại. Chỉ cần một lần `git add .` là commit lộ lên mirror GitHub đang để public.
Đây đúng rủi ro mà luật `scratch_*` sẵn có nói tới. Nó chỉ không phủ khuôn đặt tên mà các phiên
làm task đang dùng.

**Ignore chứ KHÔNG xoá.** File mới nhất là 10:38 sáng cùng ngày, tức phiên khác đang dùng. Xoá hộ
là phá việc đang chạy. Sau khi thêm luật, `git status` còn **0** file lạ ở gốc.

**Danh mục gate đi từ 63 lên 80 nhưng trang giáo trình chỉ được sửa 1 trên 4 chỗ.** `library:drift`
bỏ lọt 3 chỗ vì nó chỉ khớp một cách viết: khuôn dấu hai chấm `N máy: A CHẬN · B SINH`. Ba chỗ còn lại viết bằng gạch ngang.
Gate chỉ nhận một cách viết thì người sửa trang yên tâm là đã xong. Ba câu sai vẫn nằm đó. Nay bắt MỌI lần xuất hiện, phân tách `:` hay `—`
đều nhận. Đối chứng âm: bơm lại con số cũ vào chỗ viết bằng gạch ngang thì gate gọi đúng câu đó.

`BUILD_JOURNAL.md` vẫn ghi "59 máy" và **giữ nguyên có chủ ý**.
Đó là số đo có ngày tháng, không phải khẳng định hiện tại.

**README và USER_GUIDE** nay có `docs:health`, `docs:index`, `docs:cite`, kèm bảng nói mỗi phép đo
nghĩa là gì và phải làm gì khi nó kêu.

## 2026-09-18 (vá) — Artifact sinh ra từ source CHƯA COMMIT thì CI đỏ, máy dev xanh

**Sự cố.** CI GitHub đỏ ở `gates:index:check` trong khi máy dev xanh.
Worktree sạch tại HEAD tái hiện ngay. `aio:publish` xếp **CHẬN** khi sinh từ HEAD, nhưng bảng đã
commit ghi **CHẬN có cờ --enforce**.

**Nguyên nhân.** `GATES.md` được sinh trong cây làm việc đang có `publish_testcases_aio.js` sửa dở
chưa commit. Bản sửa đó đổi cách phân loại. Bảng vì thế mang một mức mà source đã commit không sinh ra.
Bảng là artifact của nội dung đã commit. Sinh nó từ cây bẩn là đẩy việc của phiên khác vào một
file không ai đọc.

**Hai chỗ sửa, đều nhắm vào việc nói ĐÚNG SỰ THẬT thay vì đổ lỗi:**
- `gate_index` nay liệt kê thẳng file nguồn đang sửa dở. Thông báo cũ chỉ nói "bảng lệch source" nên
  mất một vòng mới truy ra.
- Cây bẩn mà bảng lệch thì là **KHÔNG PHÁN ĐƯỢC**, exit 2, không phải CHẬN.
  Kết tội bảng ở đó là oan. CI luôn checkout sạch nên nhánh này không chạy ở CI.
  Răng của gate giữ nguyên.

Cùng họ với luật "test không được kế thừa env môi trường": kết quả phụ thuộc môi trường chạy thì
"xanh" hết nghĩa.

**Soát nốt 11 cổng CI trong worktree sạch, ra thêm hai cái nữa sẽ đỏ.**

- `library:drift` đỏ thật: trang giáo trình khẳng định "63 máy: 42 CHẶN" trong khi danh mục nay là
  80 máy. Con số đó do người ghi, và việc mở rộng danh mục hôm nay làm nó lệch. Đã sửa trang.
- `course:maturity:check` đỏ ở worktree Windows nhưng xanh ở cây chính. Truy ra `course_maturity.js`
  không chuẩn hoá CRLF ở hai cửa đọc. Cùng một commit: bản LF 16.488 byte, bản CRLF 16.849 byte, chênh
  đúng 361 byte tức một byte mỗi dòng. CI chạy Linux nên xanh, người dùng Windows checkout mới thì đỏ
  cả 29 bài dù không ai sửa gì. Đã vá, nay xanh ở cả hai.

Cửa đọc thứ tư của cùng lớp lỗi CRLF, sau `library_drift`, `build.js` và `course_parse.js`.

**Thêm một tín hiệu sạch-giả nữa, lần này ở tầng báo cáo.** Chạy `docs:health` cho cả 16 task thì 11 task
in ra "không có tài liệu Confluence nào". Thực tế chúng có tới 68 file spec lành. Máy cần page id để
hỏi version nên bỏ qua file không có id, nhưng câu nói gọn kia đọc ra thành "task này không có tài liệu".
Nay nói rõ là thiếu id, kèm số tài liệu thật sự đang có.

**Soát xong 16 task, con số thật khác hẳn con số tôi báo lúc chưa sửa dụng cụ.** Chỉ **2 task** cần
fetch lại: `SAPP-3255` (21 tài liệu, 4 lành, 18 mất bảng) và `SAPP-21786` (3 tài liệu, 1 lành).
13 task còn lại đều lành. Con số "13 task không có tài liệu lành" báo trước đó là SAI, do ngưỡng
entity và luật đọc id của chính dụng cụ.

## 2026-09-18 (khuya) — Dụng cụ đo sai thì mọi "phát hiện" của nó đều là báo oan

**Định làm gì.** Bước E của kế hoạch là cho `docs:index` mọc răng: neo không tra được thì chặn.
Trước khi bật, đo bán kính nổ trên **cả 16 task** trong `outputs/`.

**Đo lần đầu: 14 trên 16 task có số không tài liệu lành.** Hai task còn lại bị báo là trích luật
không tồn tại. Nếu bật chặn lúc đó thì gate đã đổ lỗi cho người viết testcase vì một lỗi của chính dụng cụ.

**Ba khiếm khuyết trong dụng cụ, đều là của bản vừa giao hôm nay:**

| Lỗi | Hậu quả đo được |
| --- | --- |
| ngưỡng `entity > 0` | file spec 34 KB với 151 dòng bảng bị vứt vì **một** entity; file 48 KB vứt vì **ba** |
| id phải đứng đầu tên file | bỏ sót `ref_1437794348_fs-bulk-update.md` |
| đòi phải có page id | bỏ sót 108 KB spec lành vì tên file không mang id |

Sửa xong, đo lại: **0 trên 16 task có neo không tra được**. Một task từ 14 neo "bịa" xuống 0, task kia
từ 25 xuống 0. Toàn bộ phát hiện của bản cũ là báo oan.

**Ngưỡng entity nay tính theo TỈ LỆ.** Đo 483 tài liệu: 58 file còn entity, tách thành hai chế độ rõ
rệt. Rải rác cao nhất **1,00** trên 1000 ký tự. Hỏng hệ thống thấp nhất **1,55**, lên tới 28. Ngưỡng đặt
vào giữa khoảng trống đó.

**Thêm trạng thái thứ ba: KHÔNG PHÁN ĐƯỢC.** Luật của kit là "không phán được" KHÔNG thành PASS.
Không có tài liệu lành, hoặc testcase không nhắc neo nào, thì máy nói thẳng là chưa kết luận được.
Im lặng exit 0 ở đó là phát ra tín hiệu "đã kiểm và sạch" trong khi chưa kiểm được.

**Đã nối vào `self-review`, mức CẢNH BÁO chứ không chặn.** Số đo cho phép chặn, vì không task nào đỏ.
Nhưng chính bộ đo này đã báo oan ba lần trong ngày viết ra nó. Công cụ còn non thì chưa nên cầm
quyền chặn. Bật `--enforce` khi nào nó chạy đủ lâu trên task thật.

**Đối chứng âm bắt được thêm một lỗi nữa.** Bản đầu của phần nối vào `self-review` kiểm "neo nào
thiếu" TRƯỚC khi hỏi "có tài liệu để đối chiếu không". Task không có tài liệu thì mọi neo đều thành
"không tra được", và máy quay sang kết tội người viết testcase. Đúng cái bẫy vừa chẩn đoán ở trên.

## 2026-09-18 (tối) — Neo oracle phải tra ngược được về tài liệu, kèm số dòng

**Vấn đề.** Kit đã bắt buộc mọi phán PASS/FAIL phải kèm `oracle_ref`, và có máy kiểm ở
`scripts/lib/expansion/finding.js`. Nhưng máy đó chỉ kiểm HÌNH DẠNG chuỗi.
Nó không hỏi câu quan trọng hơn. Neo đó có thật trong tài liệu không? Nằm ở đâu? Viết `BR-07` hay `AC-9.9` đều qua
cửa như nhau, kể cả khi tài liệu không hề có mục đó.

**Cách chữa.** `npm run docs:index` lập chỉ mục neo.
`npm run docs:cite` tra một neo ra file kèm số dòng. Còn `--verify` so bộ testcase với chỉ mục. Chỉ mục **chỉ lấy tài liệu lành**, vì
trích dẫn cần số dòng. File do bộ đổi cũ sinh ra dồn cả trang vào một dòng. Trỏ vào "dòng 1" của một
trang 8 KB thì không phải trích dẫn. Đây là lý do bước này phải đi sau bước sửa bộ đổi.

**Đối chứng âm.** Bộ testcase thật của SAPP-26878 có 76 neo. **Tất cả đều tra ngược được.**
Một máy chỉ biết nói "đạt" thì vô dụng. Bơm thêm ba neo bịa thì cả ba bị gọi tên, `--enforce` exit 1.

**Hiệu chỉnh cảnh báo MƠ HỒ, từ 26 xuống 8.** Tài liệu đánh số BR theo từng US, nên cùng mã có thể
là hai luật khác hẳn. Nhưng hai bản đầu đều báo oan:

| Bản | Luật | Kêu | Vì sao sai |
| --- | --- | --- | --- |
| 1 | đếm số trang định nghĩa | 26 | `US-xx` là tên TRANG, không phải luật |
| 2 | thêm: `US-xx` phải sát ngay trước neo | 18 | testcase viết `US-02 ... BR-09` cùng dòng, vẫn đúng |
| 3 | nội dung định nghĩa phải KHÁC nhau | **8** | đúng cái đáng kêu |

Tám cái còn lại là báo thật. Ví dụ `NFR-02`: nửa tiền về là "kỳ khoá sổ", nửa DTTH là "chênh lệch
đối chiếu deferred revenue dưới 1%". Một testcase trích trần `NFR-02` chưa chỉ ra được luật nào.

**Một lỗi nữa của chính máy này.** Chỉ mục chạy ngoại tuyến nên phép đo MẤT BẢNG im lặng.
Hậu quả là 9 bản đã làm phẳng bảng vẫn lọt vào. Nay mỗi trang chỉ lấy MỘT bản tốt nhất.
Xếp hạng bằng ba tín hiệu đọc được từ chính file: có ghi version, nhiều dòng bảng, ít entity sót.

Đã nối cả hai máy vào `prompt_templates/phase1/01_setup_engine_fetch_docs.md`, kèm hai dòng checklist.
Máy không ai gọi là máy chết.

## 2026-09-18 (chiều) — Tài liệu cũ không tự nói là nó cũ, nên phải có máy hỏi hộ

**Vấn đề.** Soát lại một task thật sau khi sửa bộ đổi Confluence, và thấy bốn chuyện, cả bốn đều im lặng.

| Đo được trên SAPP-26878 | Số |
| --- | --- |
| trang đã bị sửa sau ngày fetch | 14 / 23 |
| file fetch về rỗng, không báo lỗi | 2 (72 và 91 byte) |
| file có bảng ở nguồn mà không còn dòng bảng | 13 |
| chỗ chữ còn dạng `&agrave;` thay vì `à` | 10.555 |

Không cái nào phát hiện được bằng cách mở file ra đọc. File vẫn có chữ, vẫn có tiêu đề, đọc vào
vẫn hợp lý. Mắt người không phân biệt được "tài liệu nói thế" với "tài liệu CÒN nói thế".

Riêng chuyện entity không phải thẩm mỹ. Chuỗi `tr&ecirc;n` không khớp khi tìm "trên". Tài liệu
vẫn nằm đó mà tra cứu không ra, tức là hỏng đúng tiền đề của mọi việc đọc tài liệu bằng máy.

**Cách chữa.** Thêm `npm run docs:health -- --task <KEY>`. Bốn phép đo: LỆCH BẢN, RỔNG, MẤT BẢNG, CÒN ENTITY.
Mỗi phép ứng với một sự cố ĐÃ XẢY RA, không phải rủi ro tưởng tượng. Mặc định
không chặn, vì tài liệu lệch bản là chuyện bình thường của dự án đang chạy. Chặn ở đây sẽ biến một
tín hiệu hữu ích thành tiếng ồn bị tắt.

**Bản đầu của chính máy này đã nói dối.** Nó chỉ nhận khuôn đầu file `Page ID:`, nên bỏ sót nguyên
một thư mục 16 file và vẫn in ra tín hiệu sạch. Một máy đo bỏ sót tệ hơn không có máy. Nay nó nhận cả ba
khuôn mà ba đợt fetch khác nhau sinh ra. Có test chốt điều đó.

**Danh mục gate đang thiếu 16 máy.** Thêm `docs:health` xong thì nó không vào được `GATES.md`. Truy ra
`gate_index.js` chỉ quét `scripts/qa/`. Đếm lại: **16 file với 26 npm script** nằm ngoài thư mục đó.
Chúng chưa từng có mặt trong bảng. Trong đó `aio:verify:enforce` là cổng CHẬN, `aio:publish:apply` là
cổng người. Danh mục tự nhận liệt kê mọi máy mà thiếu nhóm cổng chặn thì tệ hơn không có.
Người tra không thấy, rồi kết luận là không ai canh. **63 → 79 máy.**

**Bổ sung 4 entity** (`&asymp;` `&isin;` `&hArr;` `&prime;`), vẫn theo lối đếm chứ không đoán. Sau khi thêm,
32 trang của task fetch lại còn **0** entity sót, thu được **2.500 dòng bảng**.

## 2026-09-18 — Fetch Confluence đang đọc thiếu spec, và không ai biết

**Vấn đề.** Hai đường fetch tài liệu đổi HTML sang text bằng đúng một dòng
`.replace(/<[^>]+>/g, ' ')`. Riêng `scripts/integrations/jira/fetch_confluence.js` gộp tiếp
khoảng trắng, nên cả trang thành **một dòng**. Trong 56 file Confluence đã fetch, chỉ
**7 file (13%)** còn dòng bảng.

Đây không phải mất định dạng. Ở tài liệu của dự án này, **AC nằm trong bảng**. File fetch về
vẫn có heading, vẫn có chữ, đọc vào vẫn thấy hợp lý. Chỉ là không còn điều kiện chấp nhận nào.
Không có tín hiệu nào báo, nên không ai đi kiểm.

**Đo trên 12 trang FS/BRD/US thật.** Gọi cùng API mà fetcher gọi, chỉ đọc.

| | bản CŨ | bản MỚI |
| --- | --- | --- |
| trang có bảng ở nguồn giữ được bảng | 0 / 12 | **12 / 12** |
| dòng bảng thu được (1.652 ô nguồn) | 0 | **676** |
| dòng Given/When/Then giữ được (6 trang US) | 0 / 66 | **66 / 66** |
| trang bị gộp thành đúng một dòng | 12 / 12 | 0 / 12 |

Mất mát thứ hai lộ ra khi đo. Regex gỡ thẻ **ăn trọn khối `CDATA`** khi ruột không chứa dấu lớn hơn.
Toàn bộ AC viết bằng Gherkin trong macro code bị xóa sạch, 66 trên 66 dòng.

**Cách chữa.** Tách bộ đổi ra `scripts/lib/confluence/storage_to_markdown.js` dùng chung cho cả hai
đường. Bộ đổi giữ bảng, danh sách, heading, khối code và tiêu đề trang được liên kết. Bảng entity
của hai file gộp làm một và giải một lượt, nên không còn cảnh giải hai lần thành thẻ thật.

**Tại sao lỗi sống lâu.** Phần chuyển đổi nằm trong thân hai script CLI chạy ở top-level và không
export gì. **Không có cách nào phủ test.** Tách module là điều kiện để có lưới.
`tests/fe/infra/confluence-markdown.spec.ts` có 16 test và chốt cả hai vế. Vế một: bộ đổi giữ được
bảng. Vế hai: hai fetcher thực sự gọi nó. Thiếu vế hai thì ai cũng có thể viết lại một dòng gỡ thẻ
trong fetcher mà test vẫn xanh.

**Chống hồi quy đối kháng.** So bộ từ trên cùng 12 trang, sau khi giải entity ở cả hai vế. Bản mới
thiếu **0,33%** từ so với bản cũ. Toàn bộ phần thiếu là `text` với `gherkin`, tức tên tham số macro
bị rò thành chữ ở bản cũ. Chiều ngược lại có 2.581 từ thêm, đều là chữ nghiệp vụ. Không UUID hay
hash nào lọt vào.

**13 entity ký hiệu bổ sung là đếm chứ không đoán.** Quét lại output của 12 trang thật thấy còn sót
đúng 13 cái. Nhiều nhất là `&rarr;` với **256 lần**. Chúng mang nghĩa thật: mũi tên là luật ánh xạ
"A sang B", còn `&ge; &le; &ne;` là điều kiện biên.

**Tiện thể.** `tests/fe/infra/user-guide-images.spec.ts` spawn `git` mà không qua `gateEnv()`. Gate
tự-kiểm đang đỏ vì việc đó. Đã nối lại.

## 2026-09-07 — CI nhanh hơn 19 lần, danh mục gate tự sinh, và điểm mù ẢNH đã có máy canh

**Vấn đề 1 — CI chậm mà không ai biết chậm ở đâu.** Job `static-check` mất **527s** và mọi suy đoán về
nguyên nhân đều sai vì đo bằng `duration_s` của container thay vì đọc **trace job**. Trace thật (job 14185)
nói: `audit:ci` **421s** = 93% toàn job, `npm ci` 15s, 12 gate còn lại cộng lại **5s**, overhead ngoài các
bước **~9s** — không có "4 phút overhead ẩn" như đã đoán.

**Cách chữa.** Tách `audit` thành job riêng (`d386c5e`), chạy khi push CÓ đổi `package-lock.json`/
`package.json`, khi scheduled, hoặc bấm tay; `timeout: 12m` vì runner đang `concurrent = 1` nên một lượt
audit treo sẽ chặn mọi job khác. Rồi bỏ `npm ci` khỏi job đó (`c85db3a`, ghi chú sửa lại ở `51d48f8`) —
và đây là chỗ đáng đọc: **thứ chậm chưa bao giờ là audit, mà là audit-SAU-KHI-install**. Cùng lockfile,
cùng kết quả (`low 0 · moderate 3 · high 0 · critical 0`), nhưng có `node_modules` thì `npm audit` duyệt
cây đã cài (**421s**), không có thì nó hỏi bulk advisory từ lockfile (**1,3s** — job 14202). Việc tách job
mới là điều kiện để audit được phép không cần `node_modules`.

**Đo sau cùng:** `static-check` **527s → 24–28s**, `audit` **11s** và chỉ chạy khi bề mặt dependency đổi.

**Vấn đề 2 — một nút bấm-là-đỏ trên CI.** `integration-check` đọc creds từ `scripts/integrations/jira/.env`
(file untracked) nên trên CI nó **không thể xanh**: chết ở bước kiểm cấu hình sau ~30s. Vì là `when: manual`,
GitLab tự gán `allow_failure: true` ⇒ pipeline hiện ⚠ Warning và lỗi im lặng. **Cách chữa** (`744acf8`): job
chỉ TỒN TẠI khi thật sự có creds (`rules` + `if` trên biến token) — không dùng `allow_failure` để biến đỏ
thành vàng, vì một nút luôn-đỏ là cách nhanh nhất dạy người ta bỏ qua CI. Sau khi khai đủ 6 mục `required`
trên GitLab CI Variables: job **xanh 42s**, Jira · AIO · Confluence kết nối bằng request thật.

**Vấn đề 3 — kit có ~58 máy nhưng không chỗ nào liệt kê được chúng.** Có danh mục skill, rule, layer,
nghĩa vụ theo nhánh, tài liệu, test — thiếu đúng danh mục **gate**. Luận đề của kit là "luật cần MÁY", mà
máy không liệt kê được thì không kiểm toán được: không ai biết một gate đã âm thầm thành cảnh báo.

**Cách chữa** (`5863151`, hiệu chuẩn ở `b6961c9`): `gate_index.js` sinh `.agent/config/GATES.md` từ chính
source — **58 máy: 36 CHẶN · 16 SINH · 6 BÁO CÁO**. Cột **Mức** là thông tin chưa máy nào ghi, và đó là chỗ
dễ trôi nhất (nới một gate là sửa MỘT dòng). `gates:index:check` chặn khi bảng lệch source, ở cả hai nền CI.

**Bài học đắt hơn cả cái bảng:** 4 "phát hiện" đầu tiên của nó **đều là lỗi của bảng, không của kit** —
`bugs:checklist` bị dán nhãn CẢNH BÁO trong khi nó chỉ IN BRIEF (việc chặn nằm ở `dim:coverage`, chiều
`bug_history` §20, `minCasesPerDimension: 5`) · 9 gate bị tố "không có mô tả" vì regex quá chặt · và
`SURFACE_*` mù `exploratory/` + `RULE_GLOBAL.md` nên 2 máy trông như mồ côi. Luật đã ghi vào header script:
**thấy một máy "không bề mặt nào" thì NGHI BẢNG TRƯỚC, nghi kit sau.** Một danh mục chưa hiệu chuẩn thì
cảnh báo của nó chưa đáng tin — đúng bệnh kit đang chống.

**Vấn đề 4 — tra một luật phải đọc cả `RULE_GLOBAL.md`.** File = 465 dòng · 51.116 ký tự · ~12.800 token
(SÀN; 12% ký tự có dấu nên thực tế cao hơn). Nó **không** auto-load — file luôn-trong-ngữ-cảnh là
`CLAUDE.md` (13 dòng) — nên nó không ăn token mỗi phiên; vấn đề là lúc CẦN tra thì không có mục lục. Thước
đo của chính kit (`doc_budget`: `READ_DIRECT = 8000`) nói đọc cả file đã vượt ngưỡng "đọc thẳng" 1,6 lần.

**Cách chữa** (`1cf870f`): `rule_lookup.js` + mục lục NEO sinh tự động. `npm run rule -- security` = **287
token** (rẻ hơn **45 lần**). **KHÔNG chia file** dù chia nghe hợp lý hơn: `policy_source_check` khoá
"RULE_GLOBAL là canonical DUY NHẤT" có chủ đích, chia thành 4 file là tạo 4 chỗ để cùng một luật nói khác
nhau — kit đã bị đúng lớp lỗi đó. Chỗ dễ sai nhất là **điểm bất động**: mục lục CHỨA số dòng mà chèn nó lại
LÀM DỜI số dòng, nên bản đầu ghi "Purpose ở dòng 32" trong khi nó đã dời xuống 67; nay lặp tới khi ổn định
và `--check` so CHẶT cả khối.

**Kèm:** ngưỡng lưu trữ kho học khai bằng SỐ ở `.agent/config/retention.json`, và chính máy GHI dữ liệu
(`metrics_collect`) nhắc khi tới mốc. Đo: `runs.jsonl` 35 dòng/12KB · `tc-history` 1.558 dòng · `knowledge/`
1.3MB — còn rất xa ngưỡng nên **chưa viết code tỉa**: tỉa 35 dòng là giải bài toán chưa tồn tại. Policy khai
rõ tỉa KHÔNG BAO GIỜ là xoá, vì rule `superseded`/`invalid` còn cần cho truy vết "TC này từng PASS theo
oracle nào".

**Vấn đề 5 — ẢNH TÀI LIỆU là điểm mù có hệ thống.** Mọi gate đọc VĂN BẢN, nên nội dung sai nằm trong PNG
tồn tại vô hạn. Đo hậu quả thật: `phase-selection.png` mang badge nhãn-hai-chữ của công cụ test-management
đã bỏ HẲN 20/08 — sống sót vì luật cũ khớp TÊN ĐẦY ĐỦ (không khớp nhãn viết tắt) và vì ảnh là nhị phân.
Người dùng nhìn badge của một công cụ không còn tồn tại **suốt 2 tuần**. Kèm một glyph U+2387 mà font
Be Vietnam Pro không có → render thành ô rỗng.

**Cách chữa, HAI lớp — và phải nói rõ lớp nào bắt gì, không thì tưởng đã kín** (`b26cad7`, `11309e1`):
① `policy_source_check` siết thêm **nhãn viết tắt** (phân biệt hoa-thường + biên từ; đo trước khi thêm: 0
chỗ trùng ⇒ không báo oan) → bắt ĐÚNG lớp lỗi trên. ② `tests/fe/infra/user-guide-images.spec.ts` (4 test):
bộ ảnh phải khớp generator và khớp tài liệu — generator khai mà thiếu file · ảnh mồ côi · USER_GUIDE nhúng
link chết · ảnh CŨ HƠN generator trong lịch sử git → bắt lớp KHÁC, và **nó không bắt được vụ nhãn-viết-tắt**
(hồi đó ảnh và generator khớp nhau). Sơ đồ Prompt Map nay có cả slash command của từng nhánh.

**Vấn đề 6 — NO-XRAY bỏ sót đuôi file.** Bộ lọc là `md|js|mjs|ts|json|yml|example` nên `.sh` vô hình: script
khai CI Variables IN chữ của công cụ cũ ra màn hình mỗi lần chạy mà gate vẫn báo sạch. **Cách chữa**
(`a0ca759`): nới sang `sh|bash|ps1|sql|html|yaml`; đối chứng là **vi phạm THẬT**, không phải fixture. Cùng
script đó còn thiếu `JIRA_PROJECT_KEY` và `AIO_API_TOKEN` nên không khai đủ 6 mục `required` — đúng lý do
`integration-check` không thể xanh.

### Đính chính về xuất xứ hai thay đổi — QUAN TRỌNG khi tra ngược

Hai thay đổi dưới đây là **của chủ repo**, đang là WIP chưa commit, và bị gom vào commit của agent do agent
stage theo tên file mà không đối chiếu `git diff --cached`:

| Thay đổi | Nằm trong commit | Ghi chú |
|---|---|---|
| `RULE_GLOBAL.md`: bỏ cột `Severity`/`Mức độ rủi ro` khỏi bộ testcase; tiêu đề case = NỘI DUNG, tag sang cột `Tag` | `1cf870f` (commit về mục lục) | Nội dung không mất, nhưng commit message không nhắc — đây là chỗ tra ngược |
| `.agent/skills/INDEX.md`: description `tc_validator` từ "template 9 cột" → "template 11 cột" | `6a5811f` (commit về slash command) | INDEX.md là artifact SINH; nó phản ánh bản `tc_validator/SKILL.md` đang sửa dở |

**Lệch còn tồn tại và cách đóng:** trên `main` hiện `INDEX.md` ghi "template 11 cột" còn
`.agent/skills/phase1/tc_validator/SKILL.md` vẫn ghi "9 cột" — vì artifact sinh đã lên trước nguồn của nó.
Lệch tự hết khi chủ repo commit `tc_validator/SKILL.md`. Không viết lại lịch sử: hai commit đã ở cả hai
remote, rewrite tệ hơn vấn đề.

**Luật rút ra:** stage theo đường dẫn cụ thể là CHƯA đủ — phải đọc `git diff --cached` trước khi commit.
Và `skills_index` chỉ khoá TÊN skill, không so description, nên artifact sinh có thể trôi khỏi nguồn mà
không gate nào thấy.

## v2.0.0 — 2026-09-04 (c) — CD cho chính bộ kit: version · package · verify · release

**Vấn đề.** Kit phát cho nhiều dự án và sửa rất thường xuyên, nhưng: không biết dự án nào đang ở bản nào
(có bản vá quan trọng thì không có đường thông báo) · không có mốc để quay lui · và **bản phát ra chưa từng
được chứng minh là chạy được từ con số 0**. Cái thứ ba không phải phòng xa: `ci_scope_check.js` và
`secret_scan.js` từng crash vì gọi `git ls-files` vô điều kiện, và chỉ lộ ra khi giải nén vào thư mục sạch
rồi `npm ci` — tức đúng trải nghiệm người nhận kit, mà không CI nào mô phỏng.

**Quy ước version — semver, bump theo LẦN PHÁT HÀNH** (không theo commit; kit đang ~10 commit/ngày nên bump
mỗi shared change sẽ làm số version vô nghĩa): **MAJOR** = dự án BUỘC phải sửa lớp PROJECT · **MINOR** = thêm
năng lực, nâng lên chạy được ngay · **PATCH** = sửa lỗi, không đổi hợp đồng. CHANGELOG **giữ nguyên** định
dạng cũ (ngày + nhóm chủ đề + "vấn đề → cách chữa"), chỉ thêm version vào tiêu đề. Bản đóng gói đầu tiên là
`2.0.0` vì repo đang ở dòng v2.

**Mới — 3 máy, đi cùng nhau:**

- `version:check` — version hợp semver · khớp tag khi chạy từ tag · **CHANGELOG phải có mục cho version đó**.
  Cảnh báo (không chặn) khi có shared change kể từ tag trước mà CHANGELOG chưa có mục mới.
- `package:kit` — đóng gói **chỉ lớp GENERIC** ra `dist/`, rồi **quét lại chính gói** bằng logic secret-scan;
  phát hiện secret/PII ⇒ **xoá gói + chặn**. Gói phát ra ngoài là đường lộ dữ liệu dễ bị bỏ qua nhất.
- `release:verify` — **thước đo chính**: giải nén vào thư mục sạch NGOÀI repo (không `.git`), `npm ci`, rồi
  chạy gate. Bắt đúng loại lỗi mà 15 vòng rà soát trước phải phát hiện bằng tay.

**Hai chỗ sửa so với đề bài, vì đo ra là sai:**

1. **`db.conventions.json` KHÔNG được đóng gói.** Đề bài xếp nó vào GENERIC, nhưng đo: `entity =
   ic_payment_orders`, `allowedHosts = db-uat.sapp.edu.vn`, 8 màn với nhãn tiếng Việt của OPS — **lớp PROJECT
   đặc**. Phát nó cho dự án khác là đưa họ **bản đồ cột sai** mà vẫn "có số từ DB", đúng hiểm hoạ file đó tự
   cảnh báo. Nay đóng gói `db.conventions.example.json` (giữ khung + hướng dẫn đo), và `kit-layers.md` xếp bản
   thật vào lớp PROJECT.
2. **`preflight` PHẢI chặn ở gói sạch, không phải chỉ cảnh báo.** Đề bài yêu cầu ngược lại, nhưng gói không có
   `project_context.md` (lớp PROJECT) và preflight khai file đó là `require` ⇒ nó chặn, và **chặn là đúng**:
   kit vừa giải nén thì phải dừng cho tới khi dự án khai context của họ. Nên `release:verify` **đảo kỳ vọng**:
   khẳng định preflight chặn ĐÚNG LÝ DO. Kèm cải thiện thông điệp: thiếu input bắt buộc mà có bản `.example`
   thì gate in luôn lệnh `cp` để tạo — trước đó nó chỉ nói "THIẾU input bắt buộc: X" và người nhận phải đi
   đọc code gate.

**Không thêm dependency:** đóng gói bằng `tar` (có sẵn cả Windows lẫn Linux) thay vì `.zip`. `zip` không có
trong git-bash ở máy Windows, còn `archiver` trong cây là 4.0.2 nên khai `^7` sẽ làm `npm ci` vỡ vì lock lệch.

**Chưa nối GitLab release stage** — project vừa mới có runner (một runner trên máy QA, chỉ chạy khi máy bật),
nên thêm stage release lúc này là đưa vào một cấu hình chưa từng chạy. Waiver ghi ở `.agent/config/ci_parity.json`.

## 2026-09-04 (b) — Tài liệu bắt kịp cấu trúc: slash command, tầng DB, và 5 con số đã cũ

**Vấn đề.** README/USER_GUIDE/QUICKSTART không nhắc `.claude/commands/`, `tests/support/setup/db/`,
`ui_debug_agent`, `db.conventions.json`, `locators.schema.json` — người mới đọc tài liệu sẽ không biết
chúng tồn tại. Và tài liệu còn dạy **15 chương dimensions** trong khi thực tế đã **20** (§3–§23): người đọc
mở đúng theo tài liệu sẽ **bỏ sót §22 inbound callback và §23 DB persistence**. CHANGELOG thì dừng ở 20/08.

**Chữa.** README: cây thư mục thêm `.claude/commands/` + `tests/fe/infra/` + `tests/support/setup/db/`,
thêm 2 dòng Main Components (slash command · DB Verification Layer), thêm khối "Slash command" đầu mục
Common Commands. USER_GUIDE: **Mục 9.0** mới (bảng 9 command kèm **điểm dừng** của từng luồng), thêm 2 dòng
vào bảng folder §4, thêm `ui_debug_agent` vào bảng prompt chính. QUICKSTART: mục "Slash Commands" đặt ngay
trước "Run Phase 1" — chỗ người mới gặp đầu tiên. Sửa cả 5 chỗ ghi số cũ.

**Ghi chú kỹ thuật cho lần sau:** file trong repo dùng **CRLF**, nên chuỗi tìm-thay **nhiều dòng** viết bằng
`\n` sẽ **không khớp** (im lặng, không lỗi). Chuẩn hoá EOL trong bộ nhớ rồi ghi lại đúng định dạng gốc.

## 2026-09-04 (a) — Slash command làm điểm vào + skill `ui_debug_agent` + 3 chỗ chồng chéo đã xử lý

**Mới — `.claude/commands/` (9 lệnh).** `/preflight` `/phase1` `/phase2` `/rerun` `/partial-rerun`
`/explore` `/ui-debug` `/gates` `/publish`. Mỗi command là **con trỏ mỏng**: đọc workflow nào · chạy npm
script nào · dừng ở gate nào. Không chép policy (đã có `gate:policy` giữ `RULE_GLOBAL.md` là canonical).
Bỏ `/proof` so với đề bài vì nó chỉ là một npm script lẻ (`mutation:check`) — vi phạm chính nguyên tắc
"không tạo command cho từng script"; `/gates` trỏ `self-review` là bó gate THẬT thay vì dựng bó mới.

**`.gitignore`: `.claude/` → `.claude/*` + `!.claude/commands/`.** Vấn đề: `.claude/` ignore toàn bộ nên
command chỉ tồn tại trên máy người tạo, và test hạ tầng sẽ **đỏ trên CI** vì thư mục không có. Phải dùng
dạng `.claude/*`: git **không đi vào** thư mục đã ignore nên negation cho đường dẫn con vô tác dụng. Đối
chiếu `git add --dry-run`: đúng 9 file `.md`, `settings*.json` vẫn ignore, `secret:scan` sạch.

**Mới — skill `ui_debug_agent` (phase2, Never-auto).** Kit đã có chuẩn locator, máy sửa (healing) và máy
kiểm (`lint:locator`) nhưng **thiếu bước khám phá lúc đầu**, nên agent đoán locator từ tên tính năng — nguồn
`script_error` lớn nhất ở lượt chạy đầu. Đo lại tiền đề: `getByTestId` **0 lần dùng thật** (2 hit duy nhất
nằm trong comment giải thích chính chuyện này), `tests/**` không có `data-testid` nào ⇒ tầng testId của
`locator_strategy.md` là **tầng chết**. Skill **không** viết bảng ưu tiên riêng (trỏ về rule canonical), chỉ
nhắc 4 nguyên tắc kèm dạng `safe_target` bắt buộc, 7 playbook tình huống khó, anti-patterns, 3 output.

**Sửa một điểm của đề bài:** đề mô tả chuỗi lệnh MCP browser. Đo: repo **không khai `mcpServers`** nào ⇒
viết skill gọi tool không tồn tại là "hứa thứ máy không làm được". Giữ nguyên 6 bước và luật (snapshot để
PHÂN TÍCH, screenshot chỉ làm EVIDENCE; resize ngay sau navigate; chờ theo tín hiệu) nhưng cột thực thi là
Playwright chỉ-đọc, kèm **bảng ánh xạ** sang MCP để cài sau là dùng được ngay.

**Máy giữ command khỏi mục rữa** (`slash-commands.spec.ts`, 14 test). `gate:policy` chỉ đo hai chặng
(`workflows` + prompt entry); command là **điểm vào thứ ba** nó chưa biết tới. Kiểm: mọi `npm run X` được
nhắc phải có thật · mọi đường dẫn phải tồn tại · mỗi command phải có `description` một câu và mục "Dừng
khi" · không chép policy và không quá 60 dòng · 4 luồng chạm UAT phải nhắc xác nhận · publish phải dry-run
trước `:apply` · **mọi nhánh trong `branch_parity.json` phải có command cùng tên**. Luật cuối cố ý **không**
nhét command vào `branch_parity.json`: file đó khai "MÁY nào chạy ở nhánh nào" kèm waiver, còn command là
ĐIỂM VÀO — trộn hai khái niệm thì phải viết waiver cho thứ không waive được.

**Mới — `.agent/config/locators.schema.json` + `locator-knowledge.spec.ts`.** Skill mới yêu cầu ghi vào
`knowledge/locators/` nhưng store đang có **đúng một file**; không chốt schema thì mỗi lượt ghi một kiểu.
Schema **không thiết kế mới** — chép hình dạng file đã dùng được. Gate: field bắt buộc không rỗng · không
field lạ · tên file `<màn>__<quirk>.json` · ngưỡng độ dài chống "điền cho có" (`why` cao nhất vì không có
cơ chế thì lần sau người ta lại thử cách cũ) · `status: active` mà thiếu `confirmed_by` là **đỏ** · store
rỗng thì **skip** (knowledge/** gitignore nên máy mới clone không có file — đỏ ở đó là đỏ oan).

## 2026-09-04 — `snapshotScreen` đang MÙ ant-select + radio và không mask PII (lớp GENERIC)

**Vì sao đáng chạm lớp GENERIC:** `scripts/utils/ui/screen_snapshot.js` **không** phải util nằm không —
`scripts/qa/ui_conformance_check.js` dùng nó, nên các lượt UI-conformance đang chạy trên một instrument mù
một phần. Ba lỗ đã đo:

1. **ant-select** — OPS là ant-design, dropdown là `div` và `input.value` bên trong **rỗng** ⇒ **mọi** giá
   trị dropdown vô hình. Đây chính là chỗ suýt làm kết luận "form không có `payment_method`".
2. **radio/checkbox** — giá trị ở `checked`, không ở `value`; đọc `value` là ra giá trị ô **chưa chọn**.
3. **PII** — snapshot ghi nhãn+giá trị ra JSON mà không che gì. Đã rò thật ở tầng task: **100 email + 100
   SĐT** nằm trong một file requirements.

**Chữa.** Thêm khối `controls` (3 loại ô, kèm `label`/`kind`/`disabled`). Mask **mặc định BẬT**: email theo
MẪU, họ tên/ngày sinh/CCCD theo **NHÃN**, ô bảng theo **HEADER CỘT** (cột Email/Phone không có nhãn kề bên
nên mask-theo-nhãn không tới được — đúng chỗ đã rò). **Cố ý không** mask theo hình dạng số chung: luật
`\d{9,12}` từng che luôn **Deal ID** (11 chữ số) — khoá dùng để nối UI với DB. Xuất `normNumber()`: màn CORE
hiện `"60 000 000"` còn màn Add-on hiện `"5.000.000"`, hàm so chỉ bỏ khoảng trắng thì **trượt 129/133 hàng**.

**Hai lỗi do test mới bắt được** (không phải lỗi fixture): `labelFor` nhặt **chữ hiển thị của control khác**
làm nhãn (ô "Recipient Bank Account" nhận nhãn "Trả góp"); và `labelsLoose` chưa mask nên **họ tên/email của
khách lọt vào danh sách "nhãn"**.

## 2026-08-27 → 09-04 — DB Verification Layer (§23): đọc bản ghi để KHOANH TẦNG lỗi

**Vấn đề.** UI và API không đủ để nói bản ghi đã lưu đúng: response thường **echo lại request**, còn FE thì
format lại giá trị. Bảy lớp lỗi (đổi kiểu số · lệch múi giờ · text bị cắt · xoá mềm hỏng · bảng liên quan
không đổi · double-submit · rollback sai) đều **UI xem như đúng**.

**Mới — `tests/support/setup/db/`.** Read-only tuyệt đối, 4 lớp chặn: đọc quyền từ catalog (chứ **không**
probe-ghi — `CREATE TEMP TABLE` chứng minh sai vì Postgres cấp `TEMPORARY` cho PUBLIC) · session
`default_transaction_read_only` · lint câu lệnh · allowlist host. So sánh theo **NGHĨA**: `money()` (cùng
khái niệm tiền, hai kiểu lưu: `bigint` và `varchar`) · `instant()` · `text()`. Có **trạng thái thứ ba**
`inconclusive` — "không đo được" KHÔNG thành PASS (39/39 cột thời gian là `timestamp WITHOUT time zone`,
chưa khai `storedZone` thì so mốc là đoán).

**Bản đồ cột↔nhãn khoá THEO MÀN** (`.agent/config/db.conventions.json`, 8 màn). Hai lý do, cả hai đo được:
cùng một cột có nhãn khác nhau giữa hai màn (`original_price` = "Gross Amount" ở CORE nhưng "Gross Price" ở
SERVICE_FEE); và **cùng một nhãn có thể là hai cột khác nhau** ("Paid Amount" ở tab Overview là tiền đã trả
thật, ở form `/edit` là cột `deposit`). Cột **chưa neo thì KHÔNG được dùng để phán** — đoán sai cột vẫn ra
kết luận, lại **có số từ DB** nên trông thuyết phục hơn bug ma thường. Tra bản đồ **phải qua**
`uiLabelOfColumn`/`uiLabelOfValue` — hai hàm **ném** khi cột/enum chưa neo hoặc khi hỏi nhãn của màn khác.

**Neo được mà KHÔNG cần fixture:** `fieldmap.candidates.spec.ts` hỏi DB xem đơn nào **sẵn có** đã tự phân
biệt — 6/8 cột treo có bản ghi thật, không phải tạo dữ liệu. Trước đó cả 8 cột bị ghi "cần fixture" chỉ vì
kết luận dựa trên 6 đơn mở tay.

**`preflight_gate` chặn ở cửa vào** (`scripts/qa/lib/db_verify_preflight.js`, 28 test). Trước đó
`db.conventions.json` không được gate nào nhắc tới ⇒ thiếu config/creds chỉ lộ ra khi spec đã chạy, và
thông điệp lúc đó là lỗi kỹ thuật chứ không phải "bạn thiếu input". **Chỉ kiểm khi task KHAI dùng** (manifest
`db_persistence`, hoặc tag `[DbPersist]`) — kiểm vô điều kiện là chặn oan mọi task không đụng DB, và gate
chặn oan thì bị tắt sau hai lần. Phần **sống** đọc quyền thật: có quyền ghi ⇒ chặn; **đọc được 0 dòng quyền
cũng chặn** (phép đo hỏng, không phải "sạch").

**Từ vựng quyền chuẩn hoá ở ADAPTER** (`types.ts`: `Privilege` + `normalizePrivilege`). `guard.ts` từng so
bằng đúng chữ SQL; Postgres/MySQL dùng chữ đó nên "chạy tốt", nhưng Mongo gọi hành động ghi là
`insert`/`update`/`remove`/`drop` ⇒ thêm adapter Mongo là guard **không thấy quyền ghi nào** và kết luận
"read-only" cho một user ghi được. Kèm gate seam: `dbVerify.ts` không được chứa SQL · `guard.ts` không được
import adapter · adapter phải chuẩn hoá ở **mọi** chỗ trả `GrantRow`.

**Bốn lỗ hổng loại "vẫn xanh mà nghĩa đã sai" đã bịt:** `loadConventions()` dựng lại object theo allowlist
nên khối `fieldMap` khai trong JSON mà code **không bao giờ thấy** (9 test đỏ vì `undefined`) — nay khối lạ
⇒ **ném** kèm tên khối · gate §23 còn khoá theo tên khoá **cũ** không tồn tại · regex §23 bị escape ăn
(`\bdeleted_at\b` thành `0x08`) làm luật nhận `deleted_at` **hỏng âm thầm**, và xoá ký tự lạ thì gate xanh
lại mà **mất word-boundary** ⇒ thêm test chạy CLI thật đếm §23 · test cũ khoá `storedZone` phải **trống**
trong khi đã đo được `UTC`.

**Cột tỉ lệ tách khỏi tiền** (`rates`): `service_fee_rate` max 20 và `fixed_discount` 5/10/15 — biên độ 0..20
không thể là VND. Để trong `money` thì `money()` vẫn "chạy" nhưng nói *"lệch 5 đồng"* cho một tỉ lệ.

**Mới — `prompt_templates/phase1/dimensions/23_db_persistence.md`** (và §22 inbound callback). Tổng số chương
dimensions: **15 → 20**.
## 2026-08-20 (d) — 9 Case Type có ĐỊNH NGHĨA: một nguồn, và publisher hết đường hạ ngầm

**User mở rộng 6 → 9 loại** kèm định nghĩa đầy đủ từng loại (định nghĩa · tag đi kèm · "chọn khi" · **"KHÔNG chọn khi"**). Đối chiếu `GET /config`: AIO có đúng 9 — `UI(1) Integration(2) Functional(3) API(4) Performance(5) Security(6) Database(7) E2E(8) Accessibility(9)`; `Unit` là tên cũ của id 1, đã đổi thành `UI` nên **1.399 case đã publish giữ nguyên ID**, không phải migrate.

**Vấn đề — danh sách nằm ở 5 chỗ.** `validate.js` (regex) · converter (comment + message) · prompt gen (bảng) · publisher · test. Mở rộng bằng cách sửa tay 5 chỗ là 5 cơ hội để một chỗ còn 6 — và chỗ đó sẽ **CHẶN theo bảng cũ trong khi tài liệu dạy bảng mới**. Chữa: [`.agent/config/case_types.json`](.agent/config/case_types.json) là **nguồn duy nhất**, mọi nơi đọc file đó; bảng trong prompt và mọi test đều sinh/kiểm từ nó. Đã dính ngay lần đầu: `precondition-catalog.spec.ts` là chỗ duy nhất còn chép tay 6 giá trị và nó **đỏ đúng lúc** — bằng chứng cách làm này có răng.

**Vấn đề — publisher hạ ngầm về `Functional`.** Gặp tên loại không resolve được, bản cũ in một dòng `⚠` rồi **vẫn ghi lên AIO** với `Functional`. Cảnh báo trôi mất trong log của lệnh đẩy hàng trăm case, còn dữ liệu thì sai vĩnh viễn — **AIO không có API xoá**. Đúng cơ chế đã làm 14 case `Highest` tụt xuống Medium. Chữa: bỏ hằng `CASE_TYPE_FALLBACK`, gom lỗi trên **toàn bộ** danh sách rồi **DỪNG TRƯỚC vòng ghi** (dừng giữa vòng để lại nửa bộ trên AIO không dọn được), in kèm danh sách tên AIO đang có. Đã chạy thật: bộ đã khai đủ (SAPP-26878) dry-run **qua**; bộ chưa khai (SAPP-24395) **CHẶN** và **gọi tên từng TC ID**.

**Mới — cảnh báo tag ↔ loại.** Case gắn `[Security]` mà khai `Functional` thì kêu, kèm trỏ tới mục "KHÔNG chọn khi" của loại được gợi ý. **Cảnh báo chứ không chặn**, có lý do: chính bảng 9 loại liệt kê các ca chồng lấn HỢP LỆ (`[Display]` nhưng lỗi do BE tính sai ⇒ `Functional` chứ không phải `UI`) — chặn ở đây là phạt đúng những case phân loại tinh nhất, và dạy người ta gán tag cho khớp gate thay vì suy nghĩ. Case mang **nhiều** tag ánh xạ được thì im lặng: bản thân tag đã không quyết được loại.

Kèm: test khoá **mọi tag trong bảng phải là tag chiều CÓ THẬT** của kit (`TAG_OF`) — bảng dạy một tag mà `dim:coverage` không biết thì bảng và gate đánh nhau, người dùng lãnh đủ.

**Chi phí phải nói rõ:** gate publisher chặn cả việc **publish lại** 12 bộ cũ (chưa có cột). Lối ra là kéo lại mirror (`aio:pull:write` nay mang Case Type về) hoặc điền cột. Mirror cũ **không** dùng được: bản của SAPP-13964 có **63/63 case trống loại** vì được kéo trước khi pull có cột này.

Test: `case-type-gate.spec.ts` 16 · khối `Loại case` ở `expansion-gates.spec.ts` 7 · `precondition-catalog.spec.ts` cập nhật. Toàn bộ infra **227/227**, lint 0 error, `gate:policy` 4/4.

## 2026-08-20 (c) — trục PHÂN LOẠI của case: khai chứ không đoán; + máy gác vệ sinh mù `.md`

**Vấn đề 1 — Case Type trên AIO là trường chết.** AIO có sẵn 6 Case Type (`Unit`·`Integration`·`Functional`·`API`·`Performance`·`Security`) nhưng Excel canonical không có cột nào mang nó, nên publisher **SUY** từ tên nhóm chức năng. Đo trên 1.399 case đã publish: **96% rơi về `Functional`**, `Integration` và `Performance` = **0** ⇒ mọi phép lọc/báo cáo theo Case Type là vô nghĩa. Gốc của lỗi là ép **hai trục** làm một: nhóm chức năng trả lời *"thuộc mảng nghiệp vụ nào"* (→ thư mục), Case Type trả lời *"kiểm thử kiểu gì"*.

Chữa: thêm cột `Loại case` vào template (9→10 cột) + gate **CHẶN ở biên SINH case** (`md_to_xlsx.js`), KHÔNG thêm vào `REQUIRED_COLS`. Chỗ chặn là quyết định có đo: `validate()` là bộ đọc dùng chung — siết ở đó thì **cả 9 bộ TC cũ (đều 9 cột) đỏ oan** trong khi không ai làm sai; đo lại sau khi sửa: **13 bộ cũ, 0 bộ bị chặn vì cột mới** (523 vi phạm của SAPP-23439 là tag `Tiền điều kiện` có từ trước, 0 dòng liên quan). Một luật một chỗ: converter lo *cột vắng mặt*, `validate.js` lo *giá trị sai*.

**Vấn đề 2 — thang ưu tiên hạ cấp âm thầm.** Canonical dùng tên thang **Jira** (`Highest`) trong khi AIO đứng đầu bằng `Critical`; publisher map theo TÊN, không có khoá `highest` nên rơi fallback `|| 3` = Medium ⇒ **14 case của một bộ bị hạ ưu tiên mà không ai biết**. Chữa: canonical đổi sang `Critical|High|Medium|Low|Lowest`; `Highest` còn là alias **có cảnh báo** để không phá bộ đang chạy; đường log bug tự map ngược `Critical → Highest` cho Jira.

**Vấn đề 3 — máy gác vệ sinh nguồn mù với `.md`.** Máy gác ký tự điều khiển lạc chỉ quét `.js/.ts/.json` dưới `scripts/` + `tests/`. Quét lại **toàn bộ file đã track** thì lòi ra: chính `CHANGELOG.md` — đoạn văn **ĐANG MÔ TẢ** cái bẫy "escape bị heredoc ăn" — tự giữ **5 ký tự `0x08` thật**, và không máy nào kêu kể từ lúc viết. Chữa: mở phạm vi sang `.md` + `prompt_templates/` · `.agent/` · `partial-rerun/` + 6 doc gốc ở thư mục repo. Prompt và rule là bề mặt **ĐIỀU KHIỂN HÀNH VI** — escape hỏng ở đó làm luật im lặng không khớp y hệt như trong code. Đối chứng âm đã chạy: bơm 1 file `.md` bẩn vào `prompt_templates/` → gate **ĐỎ đúng file**, gỡ ra thì xanh (gate không chỉ sống trên fixture).

**Luật vào canonical trong CÙNG đợt** (RULE_GLOBAL §Shared Change Gate): quy ước `Loại case` + thang ưu tiên đã viết vào `RULE_GLOBAL.md` và digest `core_rules.md`. Lần commit gate đầu tiên tôi quên — đúng lớp lỗi mà điều luật đó sinh ra để chống: gate chặn người dùng theo một luật **không tồn tại trong nguồn rule**.

Kèm: `skills:index` tái sinh không còn bẩn cây — bản `INDEX.md` trong repo từng bị **sửa tay** (`**AIO Tests**`) trong khi nguồn `SKILL.md` để trơn, nên mỗi lần chạy đúng lệnh tái sinh là mất sửa tay. Đưa phần định dạng về NGUỒN; chạy 2 lần liên tiếp cây sạch.

Test: `tests/fe/infra/case-type-gate.spec.ts` (11 test) + khối `Loại case` trong `expansion-gates.spec.ts` + `cli-guard.spec.ts` mở rộng. Toàn bộ infra **215/215**, lint 0 error, `gate:policy` 4/4.

Commit: `045bcdc` · `5785f51` · `a041956` · `4067d94` · `04fca86`.

> **Cùng ngày nhưng CHƯA ghi vào file này** (luồng khác, không phải đợt này): `6056916` `4ec0b6a` `0a4c8a0` (precondition thành MỘT TRƯỜNG, bỏ mã `PRE-NN`), `64e7d22` (mirror AIO phải chứng minh còn tươi), `3fb94f9` (status không phải verdict bị đẩy thành "Not Run"), `ff8cc36` (`trace:matrix` crash + self-review báo oan task backend).

## 2026-08-20 (b) — BỎ HẲN Xray: xoá 14 file, 1 công tắc, 42 biến env, và cấm cả cái tên

User chốt: *"bây giờ cũng không cần giữ Xray nữa, tôi cần sạch và kể cả comment"*. Trước đó kit đang ở
trạng thái "AIO là đường chính, Xray là legacy có nhãn" — nghĩa là vẫn còn hai lối, vẫn còn 375 chỗ nhắc
tên công cụ cũ trên các bề mặt làm việc. Mỗi chỗ như vậy là một **đường mòn**: dẫn người/agent đi tìm lệnh
không còn tồn tại, cấu hình biến không ai đọc, hoặc tưởng còn hai lựa chọn để cân.

**ĐÓNG BĂNG BẰNG CHỨNG TRƯỚC KHI XOÁ** (việc phải làm đầu tiên, vì sau khi bỏ Xray thì không còn nguồn để
chạy lại phép đối soát): `aio:reconcile` chạy full trên **15/15** Test Execution — Run **2103/2103**,
trạng thái **`Failed=47 Not Run=70 Passed=1986`** khớp hai đầu, mỗi cycle có số case phân biệt = số run
(không case nào bị chồng attempt), Test Plan **2/2** → 2 thư mục cycle với 16/17 cycle nằm đúng chỗ (cái
ngoài là `Ad hoc` của hệ thống). Số liệu ở đây là bản lưu cuối cùng — công cụ sinh ra nó cũng đã bị xoá.

**Removed — 14 file**:
- `scripts/integrations/jira/`: `xray_cloud.js` · `publish_testcases.js` · `pull_testcases.js` ·
  `push_test_execution.js` · `update_xray_steps.js` · `cleanup_xray_tests.js` · `create_test_plan.js` ·
  `unassign_all_tests.js` · `cleanup_precondition_requirement_links.js`
- `scripts/integrations/aio/`: `migrate_testcases.js` · `migrate_execution.js` · `reconcile_migration.js`
  (di trú đã xong và đã đối soát ⇒ ba script này không còn việc)
- `scripts/integrations/tms.js` — **công tắc không còn gì để chuyển**: một tool thì không cần switch. Kéo
  theo: bỏ `TEST_MANAGEMENT_TOOL` khỏi env/doc, bỏ `assertTool` khỏi mọi entrypoint, bỏ khối test tương ứng.
- `docs/user-guide-images/xray-traceability.png`
- 9 npm script (`jira:testcase-publish*`, `jira:testcase-cleanup*`, `aio:migrate-*`, `aio:reconcile`).

**Changed — nơi Xray từng có VAI TRÒ THẬT, phải thay bằng thứ khác chứ không chỉ xoá chữ**:
- `traceability_matrix.js`: cột `Xray` đọc `reports/jira-testcase-publish.json` (artefact Xray) → cột
  **`PUBLISH`** suy từ mirror `test-cases/from-aio/*.xlsx`. Vẫn offline, vẫn giữ được flag `chưa-publish`.
- `seed_knowledge_from_jira.js`: bỏ hẳn nhánh `--with-execution` (nó đọc Xray GraphQL). Seed bug từ Jira
  giữ nguyên.
- `verdict_taxonomy.json`: bỏ cột `xray` (10 status) — còn 1 cột `aio`, đúng tinh thần 1-nguồn.
- `PUSH_XRAY_EXECUTION` → **`PUSH_EXECUTION`**, `REPUBLISH_XRAY` → **`REPUBLISH_TESTCASES`**;
  `from-xray` khỏi `TESTCASE_MIRROR_DIRS`; `xrayKey` → `caseKey` trong `test_context`.
- `.env` thật + `.env.example`: **42 biến `XRAY_*`** bị xoá (3 ở .env, 39 ở example) sau khi đo rằng
  KHÔNG script nào còn đọc chúng. Đối soát .env: 65 biến còn lại, hash `KEY=VALUE` khớp hệt (chỉ mất đúng
  phần Xray), `integration:check:live` vẫn 4/4 service OK.
- `partial-rerun/run_xray_test_cleanup.md` → **`run_testcase_cleanup.md`** + sửa 11 nơi trỏ tới.
- Sơ đồ `main-flow`/`phase1`/`phase2`/`partial-rerun`/`phase-selection` sinh lại theo AIO; `jira/README.md`
  viết lại chỉ còn phần thật sự còn: fetch requirement · log bug · publish Confluence.

**Changed — luật gate: từ "đừng dạy như đường chính" sang CẤM TUYỆT ĐỐI.** `gate:policy` cũ có cửa thoát
`legacy`, và chính cửa đó để sót 12 chỗ dạy lệnh đã bị xoá. Luật mới (`NO-XRAY`) chặn **mọi** lần xuất hiện
của cái tên trên bề mặt làm việc (prompt · workflow · skill · rule · scripts · tests · doc gốc ·
`.env.example`), KHÔNG soi `CHANGELOG.md`/`outputs/`/`knowledge/` vì đó là **lịch sử** — xoá đi là xoá dấu
vết việc đã làm. Miễn trừ đúng **hai** file: luật và test khoá luật (ở đó cái tên xuất hiện với vai trò "thứ
bị cấm"); miễn theo đường dẫn cụ thể để không thành lỗ hổng mở rộng dần.

**Đo được**: 375 chỗ → **0**. Ba test khoá luật: repo thật sạch · một dòng nhắc lại là CHẶN · lịch sử KHÔNG
bị soi (test này còn assert CHANGELOG *phải* còn dấu vết, nếu không thì chính nó vô nghĩa).

**Nghiệm thu**: `gate:policy` 4/4 xanh · **169/169** spec infra xanh · lint 0 error · typecheck sạch ·
`preflight` phase2 ĐẠT trên task thật · `aio:pull` dry-run vẫn đọc đúng 50 case · `integration:check:live`
4/4. Kit giờ chỉ còn **một** công cụ test-management, và không còn chỗ nào nhắc cái đã bỏ.


## 2026-08-20 — Xray → AIO Tests: đóng nốt LỚP TÀI LIỆU + dựng máy kiểm TMS-drift

Bối cảnh: **GĐ1–GĐ5 đã chuyển xong ở tầng CODE** (`715f8e4`, `ac49e7a`, `d5ce910`, `92ab7df`, merge `6446dd6`):
8 script trong `scripts/integrations/aio/`, công tắc duy nhất `TEST_MANAGEMENT_TOOL` mặc định `aio`
(`scripts/integrations/tms.js`), 5 entrypoint Xray **tự chặn** kèm lệnh thay thế, gate nhận cả
`from-xray`/`from-aio`. CHANGELOG chưa có mục cho đợt đó — mục này ghi bù, cùng với phần còn thiếu.

**Vấn đề đo được (20/08/2026)**: code có răng nhưng **tài liệu thì không gì gác** — 23 file hướng dẫn
(~250 lần nhắc) vẫn dạy Xray là đường chính: `prompt_templates/phase1/04_auto_publish_jira.md` 41 lần nhắc
Xray / 1 lần nhắc AIO, `run_phase2_template.md` 25/5, `USER_GUIDE.md` 69/0, `README.md` 24/0,
`QUICKSTART.md` 16/0. `.agent/workflows/phase2_01_prepare_execution.md` **tự mâu thuẫn** (dòng 19 nói mặc
định `aio`, dòng 39 nói mặc định `xray`). Nghĩa là **agent chạy đúng theo prompt sẽ đụng thẳng cửa chặn**
vừa dựng, còn người đọc thì học sai mô hình. Đúng kiểu lỗ hổng kit gặp nhiều lần: thiếu MÁY KIỂM, không
thiếu quy định.

**Changed — lớp tài liệu (AIO là đường chính, Xray xuống mục "LEGACY")**:
- Viết lại: `prompt_templates/phase1/04_auto_publish_jira.md`, `.agent/workflows/phase1_04_auto_publish_jira.md`,
  `.agent/skills/shared/jira_testcase_publisher/SKILL.md`, `partial-rerun/run_xray_test_cleanup.md`,
  §5.5.0–5.5.2 của `USER_GUIDE.md` (mô hình Case → Cycle → Run thay Test → Test Plan → Test Execution),
  §13b của `run_phase2_template.md`, mục "Mô hình Traceability" của `README.md`.
- Sửa "mặc định là Xray" → "mặc định là AIO" ở `RULE_GLOBAL.md`, `.agent/rules/core_rules.md`,
  4 workflow Phase 1/2, 2 prompt execute, 3 template run, 3 file `partial-rerun`, `QUICKSTART.md`,
  `.agent/config/project_context.md`, `verdict_taxonomy.json` (chú thích), `skills/INDEX.md`.
- Glossary web `docs/library/src/**` (+ build lại `index.html`): status ánh xạ sang **AIO** thay Xray
  (`aio:` thay `xray:`, `BLOCKED_SETUP → Blocked` thay vì bị ép thành "TO DO"), `XRAY_MODEL` → `TMS_MODEL`.
- `profiles/task.env.example`: nói rõ `JIRA_XRAY_ASSIGNEE`/`XRAY_EXECUTION_DONE_STATUS` **chỉ còn tác dụng ở
  đường legacy** (case/cycle AIO không phải Jira issue nên không có assignee/workflow).
- `.env`: khai **tường minh** `TEST_MANAGEMENT_TOOL=aio` + `TESTCASE_SOURCE=aio` thay vì sống nhờ default.

**Fixed — CI đang sẽ đỏ mà chưa ai chạy tới**: `.github/workflows/integration-check.yml` gọi
`npm run jira:testcase-publish:dry-run`, mà lệnh đó **tự chặn** khi tool là `aio` ⇒ job chắc chắn fail.
Nay: env `AIO_API_TOKEN` thay `XRAY_CLIENT_*`, bước dry-run chuyển sang `npm run aio:publish` (tự tìm Excel
canonical của task, không có thì bỏ qua chứ không fail giả).

**Added — live-check AIO trong `integration:check:live`**: trước đây nhãn ghi "Jira/Confluence/Xray" nhưng
**không có** phép kiểm Xray nào. Nay có `testAio()` gọi `GET /project/<KEY>/config` — và **coi body rỗng là
lỗi**, vì rate limit của AIO trả body rỗng chứ không phải 429 (đặc tính đã đo). Nghiệm thu thật: 4/4 service OK.

**Added — máy kiểm `TMS-DRIFT` trong `gate:policy`** (`scripts/qa/policy_source_check.js`): chặn 2 luật trên
tài liệu hướng dẫn (`prompt_templates/**`, `.agent/**`, `partial-rerun/**`, `docs/library/src/**`, README /
QUICKSTART / USER_GUIDE / RULE_GLOBAL / CLAUDE):
1. dòng dạy lệnh Xray legacy (`jira:testcase-publish`, `jira:testcase-cleanup`, 5 script Xray);
2. dòng mô tả `xray` là **mặc định**.
Thoát bằng cách ghi rõ trên CHÍNH dòng đó: `legacy`/`đóng băng`/`--test-management-tool xray`.
- **Chống báo oan**: bỏ TÊN BIẾN `*_XRAY_*`/`XRAY_*` trước khi soi — `PUSH_XRAY_EXECUTION` giữ tên cho tương
  thích ngược nhưng nay điều khiển đường AIO; không loại thì **3/15 hit đầu là oan**, mà gate báo oan thì
  người ta tắt gate chứ không sửa nội dung.
- **Có răng thật**: lượt đầu bắt **15 dòng** tôi tự sót (12 thật + 3 oan) — trong đó `README.md` còn 3 lệnh
  publish Xray ở bảng Common Commands, `partial-rerun` còn 2 lệnh cleanup, glossary còn 2 `cmd:`.
- **Đối chứng âm**: bơm lại bản CŨ của `04_auto_publish_jira.md` từ `git show HEAD:` ⇒ gate ra **4 hit**;
  phục hồi ⇒ xanh. Không dựa fixture, chạy trên nội dung thật.
- `partial-rerun` được thêm vào `SEARCH_ROOTS` của check "npm script mồ côi": nó là **điểm vào** thật, thiếu
  nó thì lệnh chỉ còn nằm ở mục LEGACY của nhánh phụ sẽ bị báo mồ côi oan.

**Added — 4 test khoá luật** (`tests/fe/infra/gates.spec.ts`): repo thật phải sạch · dòng vi phạm phải bị chặn ·
dòng có nhãn legacy KHÔNG bị chặn · tên biến `PUSH_XRAY_EXECUTION` KHÔNG bị coi là "dạy Xray". Probe là **file
thật** ghi vào root đang được quét rồi xoá trong `finally` (gate đọc đĩa). Nghiệm thu: **53/53** spec gates xanh.

**Đính chính trong cùng ngày — di trú dữ liệu ĐÃ XONG, không phải "chưa chạy"**: bản đầu của mục này ghi
`aio:migrate-tc`/`aio:migrate-exec` "chưa apply lần nào", suy ra từ việc **không có artefact di trú nào trong
`outputs/`**. Đo trực tiếp trên AIO thì ngược lại — vắng báo cáo không có nghĩa là vắng dữ liệu:

| Đối tượng | Xray | AIO |
|---|---|---|
| Testcase | 1399 (10 task) | **1399** case · 100% có `automationKey` · tất cả `Published` |
| Cây folder | 103 folder theo task | **117** folder, sâu 3 cấp (giữ cấu trúc Test Repository) |
| Test Execution → Cycle | 15 | **15/15** có cycle |
| Test Run | 2103 | **2103** · mỗi cycle có số case phân biệt = số run |
| Trạng thái run | `Failed=47 Not Run=70 Passed=1986` | **giống hệt** |

Tức bẫy "khớp theo tiêu đề làm mất 12 run" đã được xử lý xong trước đó (563/563 case phân biệt ở cả 2
execution lớn nhất).

**Added — `scripts/integrations/aio/reconcile_migration.js` + `npm run aio:reconcile`** (chỉ đọc): biến phép
đo trên thành **lệnh thường trực**. Lý do: hai script migrate báo "XONG" theo số việc **gửi đi**, không đọc lại
đích — bản đầu từng mất 12 run mà log vẫn xanh. Sau **21/08/2026** (Xray đóng băng) phát hiện thiếu thì không
còn nguồn chạy lại, nên phép đếm hai đầu phải chạy được bất cứ lúc nào. Đo 3 lớp mất dữ liệu khác nhau: số
run · số case phân biệt trong cycle (chống chồng attempt) · trạng thái run. Ghi rõ **giới hạn**: 0/15 lệch nên
**nhánh báo đỏ chưa gặp ca thật** — muốn thử răng thì thêm 1 run trên Xray rồi chạy lại trước khi migrate.
- Bẫy đọc gặp ngay khi làm: trạng thái run **không** ở `record.status` mà ở
  `record.runs[<attempt cuối>].testRunStatus.name` — đọc sai chỗ ra `?=2103` mà API vẫn trả 200 (đúng đặc
  tính #9 đã ghi trong README module).

## 2026-08-19 (r) — mở đường CHẶN cho ②: verification theo ASSERTION, không theo bước

Lượt (n) đo được 68% case ghi ít verification hơn số assertion, nhưng **cố ý chỉ cảnh báo** vì `steps[]` là *proxy*
(bằng chứng theo **bước**, không theo **assertion**). Lượt này tạo ra dữ liệu đúng chiều để gate được phép chặn.

**Added — `scripts/lib/testcase/assertions.js`**:
- `deriveAssertions(tc)` sinh khung assertion **từ chính "Kết quả mong đợi"** (mỗi dòng = 1 assertion, bỏ số đánh
  dòng của format canonical) ⇒ adoption gần như không tốn công.
- Hợp đồng dữ liệu **tùy chọn** trong bản ghi execution: `assertions: [{text, verified, evidence, note?}]`.
- `auditCase/auditExecution`: **có dữ liệu thì CHẶN** (`verified=true` mà thiếu `evidence` ⇒ chặn · chưa `verified`
  mà không nêu lý do ⇒ chặn); bản ghi **cũ không có field này thì không bị phạt**, chỉ báo tỉ lệ áp dụng. Đây là
  cách duy nhất siết dần mà không làm đỏ 2/3 bản ghi lịch sử.

**Đo trên bộ 530 case: 1217 assertion nguyên tử**, trong đó **191 dòng (16%) còn nhồi nhiều điều kiện**.
`deriveAssertions` chỉ **đánh dấu** `compound`, **không tự tách** theo dấu phẩy — tự tách sẽ cắt sai đúng những câu
có số ("Tổng 1.234.567đ, đúng định dạng"), và một gate cắt sai thì mất uy tín ngay lần đầu.

**Bẫy `\b` với chữ có dấu — lần thứ TƯ trong phiên.** `/,\s*(và|kèm)\b/` không bao giờ khớp ", và" vì "à" không
phải word-char ⇒ `compound` luôn false. Đáng ghi: **máy gác vệ sinh source không bắt được loại này**, vì `\b` ở đây
**hợp lệ về cú pháp**, chỉ sai ngữ nghĩa với tiếng Việt. Bài học: có lớp lỗi chỉ **test hành vi** mới bắt được, không
lint nào thay được — nên mỗi luật mới phải có test khẳng định nó **thật sự khớp** trên dữ liệu tiếng Việt.

Suite hạ tầng: 138 → **145 test**.

## 2026-08-19 (t) — lane visual: 1 test/màn (4 màn tất định) + nối `uiContract` từ bindings

**Fixed — gộp nhiều màn vào 1 test là sai thiết kế.** Bản đầu loop 4 màn trong MỘT test ⇒ (a) cả 4 dùng chung hạn
30s nên màn thứ 4 **timeout**, (b) một màn lỗi là mất luôn kết quả các màn sau. Nay **mỗi màn một test** (hạn riêng
90s, khai được `timeoutMs`), báo cáo chỉ đỏ đúng chỗ hỏng.

**Nghiệm thu lại trên 4 màn** (2 Chuyển nhượng + 2 Chuyển đổi, UAT read-only): lượt 1 tạo **4 baseline**, lượt 2 so
lại **4/4 PASS với 0 mask** ⇒ capture tất định trên cả 4. Vẫn giữ nguyên cảnh báo: pass ở lượt 2 chứng minh **tất
định**, KHÔNG chứng minh màn **đúng**.

**Fixed — `uiContract` sinh ra mà không có đường tới checker.** `spec_extract` không truyền `uiContract`/`visualMask`
từ bindings sang catalog ⇒ contract `UI-*` vừa xây **không cách nào được tiêu thụ** khi catalog là bản tự sinh. Đã
truyền tiếp. Cố ý **chưa bind contract nào**: contract đầu tiên mới curate 2 khối từ canvas mockup, bind vào màn
không đúng sẽ sinh rừng FAIL giả — đúng tinh thần "máy đề xuất, người chốt". Đã ghi chú cách dùng vào bindings.

## 2026-08-19 (s) — visual regression: bộ chụp riêng, và ĐO tất định thay vì tin là tất định

**Added — lane `tests/fe/visual/` + `scripts/utils/ui/visual.js`.** Ảnh evidence hiện có (~1000/ task) **không dùng
làm baseline được**: full-page · dữ liệu động · mask PII bằng cách **sửa DOM** ⇒ mỗi lần chạy một ảnh khác, diff luôn
≠ 0 và đội sẽ học cách bỏ qua. `freeze()` triệt 4 nguồn bất định (animation/transition · caret · lazy-load · scrollbar)
và **in ra đã can thiệp những gì**; `captureOptions()` mặc định **không** full-page (càng dài càng nhiễu), ngưỡng
`maxDiffPixelRatio 0.01`, `mask` khai ở **lớp task** (`requirements/visual_targets.json`).

**Nghiệm thu tất định bằng 2 lượt chạy thật, không bằng lập luận**: lượt 1 tạo baseline 2 màn (UAT, read-only) →
lượt 2 so lại **PASS** với **0 mask** ⇒ capture tất định trên 2 màn đó. (Pass ở lượt 2 chỉ chứng minh *tất định*,
KHÔNG chứng minh màn *đúng* — oracle ở đây là chính build.)

**Giới hạn ghi thẳng vào luật**: oracle = "bản build đã được chấp nhận lần trước" ⇒ bắt **regression**, **không** bắt
cái sai từ đầu. Nên nó **bổ trợ**, không thay `UI-*` contract và không thay assert hình học. Không có
`visual_targets.json` ⇒ lane **skip kèm lý do** ("CHƯA ĐO ĐƯỢC"), tuyệt đối không tính PASS.

**KHÔNG commit baseline** (`.gitignore`): (1) ảnh chụp màn UAT có tên/email/CCCD — dù là dữ liệu `IT test` vẫn là dữ
liệu khách, mà commit là publish sang 2 remote; (2) baseline Playwright gắn OS/browser (`-chromium-desktop-win32`)
nên commit từ máy Windows thì CI Linux vẫn phải chụp lại — cam kết sai chỗ.

3 test offline (DOM giả lập) khoá kỷ luật chụp: `freeze` đưa animation về `0s` + về đầu trang · `captureOptions`
không full-page + có ngưỡng · `loadTargets` loại màn thiếu `url` và **đếm số bị loại**.

## 2026-08-19 (q) — nối `UI-*` vào checker (FE có neo) + ⑤ biến thiên data theo RUN_ID

**Nối contract vào máy — mắt xích cuối của chuỗi FE.** Có contract mà **không gì tiêu thụ** thì nó là gánh nặng chứ
không phải oracle. `ui_conformance_check` giờ nhận `screen.uiContract`: nạp `knowledge/system/UI-*.json`, đi qua
`aliases` (tên design ≠ tên build) rồi đối chiếu tập nhãn từng khối. Deviation sinh ra mang **`oracle_ref`** ⇒ theo
luật mục 6 mới được phép PASS/FAIL; trước đó mọi phát hiện FE chỉ có thể là OBSERVATION.

Ba trạng thái tách bạch, mỗi cái một nghĩa khác nhau:
- `contract.label-missing` — design có nhãn, build thiếu ⇒ **có neo**, kết luận được.
- `contract.no-container` — design có khối mà **không định vị được** trên build ⇒ hoặc build thiếu khối, hoặc thiếu
  alias; **chưa kết luận**, không được coi là đã đối chiếu.
- `contract.missing` — khai `uiContract` mà file không tồn tại ⇒ báo, **không im lặng coi như đã đối chiếu design**.

Cố ý **chưa bind contract thật vào màn thật**: `UI-ORDERDETAIL-001` mới curate 2 khối, bind sai màn sẽ sinh một rừng
FAIL giả. Test dùng DOM + contract giả lập, gồm ca **có alias thì khớp / không alias thì nói chưa đối chiếu được**.

**⑤ `scripts/lib/expansion/variation.js` — xoay data nhưng TÁI LẬP.** Dùng đúng một bộ data mỗi lượt thì độ phủ
**đóng băng**: 20 lượt vẫn 1 hình dạng, trong khi bug nằm ở hình dạng khác (0 · số âm · chuỗi dài có dấu · ngày
29/31 · count 0). Xoay trong **cùng lớp tương đương** ⇒ 20 lượt phủ 20 hình dạng mà **không thêm case nào**.

Điều kiện sống còn là **tái lập**: seed bằng `RUN_ID` (cùng `RUN_ID` ⇒ cùng data). Random thuần làm bug *"biến mất
khi chạy lại"* — phá nguyên tắc rerun 2–3 lần và biến **bug thật thành flaky**, tức là đổi một lỗ hổng lấy một lỗ
hổng khác. `plan()` in ra `_runId` và **nói thẳng** khi thiếu `RUN_ID` ("mọi lượt sẽ giống nhau, độ phủ đóng băng").
Kèm điều kiện đi cùng ghi vào luật: xoay data thì phải siết **teardown/janitor**, vì UAT dùng chung — xoay mà không
dọn là đổi bug-lọt lấy **rác dữ liệu**.

Suite hạ tầng của `main`: 128 → **138 test** (10 test mới).

> **Đính chính số liệu:** con số "153" tôi báo lúc đầu là đo khi working tree đang ở nhánh `feat/xray-to-aio-migration` của user — nó gộp cả spec của nhánh đó. Số đúng trên `main` là **138**. Xem mục sự cố dưới đây.

### Sự cố cùng lượt: commit rơi vào nhánh của user

Giữa phiên, working tree bị chuyển sang nhánh **`feat/xray-to-aio-migration`** (nhánh AIO của user, chỉ có local). Tôi **không kiểm nhánh trước khi commit** ⇒ commit cuối rơi vào nhánh đó, trong khi `git push github main:main` lại đẩy bản **cũ** của `main`: GitLab có (cherry-pick theo sha), **GitHub thiếu**, và commit của tôi nằm lẫn trong nhánh tính năng của user.

Sửa không mất gì: backup file WIP → `git reset --keep HEAD~1` trên nhánh user (**`--keep`** giữ được thay đổi chưa commit; `--hard` sẽ xoá mất WIP `bug_reporter.js`) → `git checkout main` → `git cherry-pick` → push GitHub. Nghiệm thu: nhánh user về đúng 5 commit AIO, `diff -q` xác nhận WIP nguyên vẹn, 3 cây đồng bộ.

Luật rút ra: **trước mỗi commit phải `git branch --show-current`** — working tree là của user, họ có thể đổi nhánh bất cứ lúc nào; và sau push phải **so 3 sha** thay vì tin dòng "pushed".

## 2026-08-19 (p) — ④ oracle FE: Figma → `UI-*` contract, và lý do KHÔNG tự động hoá nốt

**Added — `npm run ui:contract`** (`scripts/qa/figma_to_ui_contract.js`) + `knowledge/system` nhận `type:
"ui_contract"` (prefix `UI-`, đã có sẵn trong `ORACLE_RE` của `finding.js`). Đây là fix **gốc** của bất đối xứng
oracle: BE có Swagger nên assert `total = 540000`; FE chỉ có Figma nên assert thoái hoá thành `toBeVisible()`.

**Đo thật trên canvas Figma của task (115 MB, 27.968 node, 2.221 TEXT) — và kết luận là KHÔNG tự động hoá nốt:**
- Lượt trích đầu: 12 khối, hầu hết **rác** — tiêu đề kiểu `"Or"`, `"File supported: .jpg"`, nhãn lẫn số callout `1/2/3`.
- Sau khi lọc (bỏ callout · bỏ chú thích >48 ký tự/tên file · tiêu đề phải ngắn, không kết thúc `.`/`:`): còn 7 khối
  — **vẫn lẫn** tiêu đề `"Drag & Drop your file here"` và một khối **trộn nhãn của 2 màn**. Nguyên nhân bản chất:
  canvas là **bảng mockup nhiều màn cạnh nhau**, nhóm theo trục Y sẽ tràn.
- ⇒ Thiết kế lại thành **máy đề xuất, người chốt**: mặc định xuất **bản nháp** (`reports/ui-contract-draft.md`,
  `proven=0`, nói rõ *chưa phải oracle*); `--write` **từ chối** nếu không có `--sections` do người curate.
  Ghi thẳng bản thô = tạo **oracle GIẢ** — tệ hơn không có oracle, vì mọi so sánh sau đó sai *một cách tự tin*.
- Nghiệm thu 2 chiều: `--write` không có `--sections` ⇒ **từ chối**; có bản curate ⇒ ghi được và **qua `system:check`**
  (schema bắt luôn thiếu `version`). Contract thật đầu tiên: `UI-ORDERDETAIL-001` (2 khối · 12 nhãn), nằm trong
  `knowledge/` nên **không commit** (dữ liệu công ty, đúng luật).

**Added — máy gác VỆ SINH MÃ NGUỒN** (`cli-guard.spec.ts`): quét `scripts/` + `tests/` tìm ký tự điều khiển lạc
(0x08/0x0B/0x0C/0x1B). Lý do rất cụ thể: escape đi qua shell/heredoc bị biến thành **ký tự thật** nằm trong regex —
trong phiên này tôi mắc **3 lần với `\b`** (`output_rules`, `spec_extract`, `figma_to_ui_contract`) và 2 lần với
`
`; script vẫn chạy êm nhưng luật **không bao giờ khớp**. Lần này chính test `cli-guard` bắt được thiếu
`require.main` guard (lỗi thứ 6 cùng loại) — máy gác viết ra hôm nay đã trả nợ ngay trong ngày.

Suite hạ tầng: 137 → **143 test**.

## 2026-08-19 (o) — ③ nightly + ④ FE: assert hình học và text dài tiếng Việt

**③ Nightly.** Job CI `detection-proof` (`.gitlab-ci.yml`, schedule/manual, `allow_failure: true`) chạy
`npm run proof:nightly`. Lý do là job **riêng, định kỳ**: mutation tiêm lỗi rồi mở lại từng màn nên đắt, và mục
tiêu của nó không phải bắt bug của lần push này mà **đo xem bộ kiểm còn bắt được bug hay không**. Thiếu
`DETECTION_CATALOG` thì in **"CHƯA ĐO ĐƯỢC"** chứ không im lặng xanh. Mốc để so: kiểm-kê-field **0/4** · trục ② **3/4**.
`gate:policy` bắt đúng lúc thêm (`proof:nightly` mồ côi) ⇒ đã trỏ từ README + CI, và CI gọi **npm script** chứ không
gọi thẳng file (một nguồn).

**④ FE — `scripts/utils/ui/geometry.js`.** Gốc rễ là **bất đối xứng oracle**: BE có Swagger (máy đọc được) nên
assert `total = 540000`; FE chỉ có Figma nên assertion thoái hoá thành `toBeVisible()`. Ba test trong bộ mới dựng
đúng cảnh **`toBeVisible()` xanh mà người dùng không dùng được**: element **bị đè** · **chữ trắng trên nền trắng** ·
nội dung **bị truncate**. Thêm: ngoài viewport · kích thước 0 · touch target < 44px (chỉ kiểm khi được yêu cầu, để
không báo oan desktop) · và một test **chống báo oan** (element lành ⇒ không nói gì).

Các phép này là **bất biến tự thân** — không cần Figma vẫn khẳng định được là sai — nên KHÔNG rơi vào tautology
"đúng vì app đang hiện thế". Đó cũng là lý do làm nhóm này trước khi làm Figma→`UI-*` contract.

**Text dài tiếng Việt (`LONG_VI`)**: tiếng Việt dài hơn tiếng Anh ~20–30% **và có dấu** (dòng cao hơn) nên layout
thiết kế cho text ngắn sẽ vỡ — tên người, địa chỉ, tên khoá học, ghi chú. Mẫu theo đúng quy ước đặt tên dữ liệu test
(bắt đầu `IT test`). `inspectLongText` bắt tràn khung cha; test kèm ca **khung đủ rộng ⇒ không coi là lỗi**.

Suite hạ tầng: 126 → **135 test**.

## 2026-08-19 (n) — ② đủ assertion: đo được 68% case kiểm thiếu điều kiện

Việc ② trong thứ tự đã chốt. Trước khi viết luật thì **đo** — vì đây là loại gate rất dễ báo oan.

**Số đo trên bộ 530 case + bản ghi execution thật:**

| Chỉ số | Giá trị |
|---|---|
| Trung bình dòng expected / case | **2.30** |
| Case có **≥3 assertion** | **164 (31%)** |
| Case **nhồi nhiều điều kiện trong MỘT dòng** | **50 (9%)** |
| Case ghi **ít verification hơn số assertion** | **363 (68%)** |
| Trong đó lệch **≥2** | **135** |

⇒ Cơ chế "expected có 3 điều kiện, execute kiểm 1, PASS ngầm sai" là **có thật và phổ biến**, không phải giả thuyết.

**Added — `self_review` cảnh báo độ đủ assertion** + luật vào `RULE_GLOBAL` mục 13 và digest `core_rules`. **Cố ý
chưa chặn**: `steps[]` chỉ là *proxy* của số verification (nó là bằng chứng theo bước, không theo assertion), nên
chặn ngay sẽ làm đỏ 2/3 bản ghi mà chưa chắc thiếu kiểm thật. Muốn chặn thì phải có trường verification **theo
assertion** — việc của vòng sau.

**Lỗi vận hành, lần thứ tư cùng loại:** escape `
?
` đi qua heredoc bị biến thành **ký tự CR/LF thật** nằm trong
regex ⇒ script chết ngay khi load. Sửa bằng cách dựng backslash qua `chr(92)`. Luật tôi tự đặt vẫn đúng và tôi vẫn
vi phạm: **nội dung có escape thì ghi bằng Write/Edit, đừng đi qua shell.**

## 2026-08-19 (m) — bịt vùng mù "giá trị biến mất": trục ② từ 2/4 lên 3/4

Tiếp đúng thứ tự đã chốt, việc ① là bịt vùng mù mà mutation vừa chứng minh.

**Added — `mustHaveValue` (oracle từ cột `Required` của FSD).** `spec_extract` sinh danh sách field mà tài liệu ghi
`M` (bắt buộc) hoặc `◎` (hệ thống hiển thị tự động) **và không kèm điều kiện** ⇒ trống là đáng nghi. Đây là oracle
THẬT của tài liệu, không phải suy từ app. Trên 4 màn đã bind: **57 field**. Ghi chú: chỉ **1/69** field là `M`, phần
lớn là `◎` — nên nếu chỉ lấy `M` thì luật gần như vô dụng; đó là lý do lấy cả `◎`-không-điều-kiện.

**Đo rồi mới quyết mức độ:** check `empty-value` bắn **3 finding** (D.O.B · Số CCCD/Hộ chiếu × 2 màn · Deal ID Đã
Thanh Toán Phí) và **cả 3 đều là fixture rỗng thật** (`data.dob` của API cũng không có). Nên để mức **ghi chú**
(`info.empty-value`), không phải deviation — tự nó không kết luận được; việc chứng minh thuộc phép so UI↔API. Tổng
deviation giữ nguyên **17**, không bị lạm phát bởi mục không hành động được.

**Fixed — phép đo năng lực trục ② (lần thứ ba mới đúng).** Ba lần đo cùng một thứ, mỗi lần sửa cách đo:
`4/4` (harness **tự chấm mình** bằng phép so chữ số) → `2/4` (dùng hàm thật, nhưng tra theo *giá trị bị bóp*) →
**`3/4`** (tra theo **TÊN FIELD** rồi so giá trị UI với nguồn sạch). Chốt được nhờ một lượt **chẩn đoán** thay vì
đoán tiếp: khi xoá `convertible_amount`, FE render **`0đ`** — không trống, không mất nhãn — nên mọi phép tra theo
"giá trị bị bóp" đều trượt.

| Mutant | Trục ② | Chi tiết máy in ra |
|---|---|---|
| `zero_out` | ✅ | UI `0đ` (core 0) ↔ nguồn sạch `6000000` |
| `drop_field` | ✅ **mới bắt được** | UI `0đ` ↔ nguồn sạch `6000000` — vùng mù đã bịt |
| `halve_number` | ✅ | UI `3.000.000đ` ↔ nguồn sạch `6000000` |
| `stringify_num` | ❌ | UI `6.000.000đ` ↔ nguồn sạch `6000000` — **không bắt là ĐÚNG**: FE absorb đổi kiểu, không có gì lệch để thấy |

Bài học phương pháp (lần thứ hai trong ngày): **con số dịch chuyển vì cách đo được sửa, không vì hệ thống đổi** —
nên báo cáo phải in ra *đã so cái gì với cái gì*, để người đọc tự kiểm được kết luận.

## 2026-08-19 (l) — hai cơ chế lọt chưa ai gác: NHÂN NHƯỢNG và FLAKY chôn bug thật

**Added — `PASS_WITH_DEVIATION`** (`scripts/lib/expansion/deviation.js` + verdict taxonomy). Rủi ro đặc thù của
agent: gặp trở ngại thì *làm cho nó chạy* — chờ thêm · retry · đổi locator · refresh · đi đường khác. Nút bị overlay
che (**bug thật**) biến thành "chờ thêm 3s rồi bấm được" (**case xanh**). Kit đã gác chặt phần locator
(`locator_healing_policy`) nhưng nhân nhượng **dạng rộng** thì chưa có gì gác. Nay: `newLedger(tcId).note(kind, why)`
ghi sổ; pass **sau khi** lệch ⇒ `PASS_WITH_DEVIATION` + **bắt buộc liệt kê deviation trong Actual**.

**Added — `SUSPECT_REAL_BUG`**: cơ chế flaky triage có thể đang **chôn bug thật** (race · cache · timezone lúc
chuyển ngày đều trông y như flaky; retry 3 lần có 1 lần xanh là bị dán nhãn flaky rồi bỏ qua). Luật:
**chưa nêu được CƠ CHẾ thì chưa được gọi là flaky** — giữ `SUSPECT_REAL_BUG` (vẫn loggable). Metric cần theo dõi:
**% flaky đã xác định được nguyên nhân**.

**Đo trên bản ghi execution thật (563 case) — và hai lần tự bắt lỗi của chính check này:**
1. Bản ghi ghi `PASSED` còn check so với `PASS` ⇒ **bỏ qua sạch 563 case** rồi trả về 0. Đúng loại "scanner quét
   rỗng vẫn báo ✓". Sửa: chuẩn hoá qua **synonyms của taxonomy**.
2. Sau khi sửa, ra 2 cảnh báo — soi thì **2/2 đều OAN**: "Retry" là chủ đề của `TC_034` (test retry sau sync fail),
   "tải lại trang" là bước của `TC_462` (tua đồng hồ rồi reload để xem bộ đếm). Sửa: **đối chiếu với kịch bản của
   chính case** trước khi nghi ⇒ còn **1** (`TC_462`, ranh giới: reload là kỹ thuật nhưng không có trong bước viết,
   nên vẫn đáng ghi là deviation).

Vì thế phần audit văn xuôi để **cảnh báo**, không chặn; cơ chế thật là **sổ ledger** trong script execute. Đây là
lần thứ ba trong phiên việc "suy từ văn xuôi" báo oan (trước đó: `forbiddenSections`, `self_review` #10) — mô hình
đã rõ: máy kiểm máy phải dựa vào **hợp đồng dữ liệu**, không dựa vào từ khoá trong câu người viết.

Suite hạ tầng: 119 → **126 test**.

## 2026-08-19 (k) — chạy mutation qua HÀM THẬT của trục ②: 2/4, không phải 4/4 (đính chính)

**Đính chính số tôi vừa báo:** lượt trước harness tự viết phép so chữ số của riêng nó rồi kết luận "trục ② sẽ bắt
**4/4**" — tức là **harness tự chấm mình**, đúng loại tautology mà cả vòng này sinh ra để chống. Nay `mutation_check`
gọi **hàm thật** của `cross_surface_diff` (`pairsOf` + `core`), và con số đúng là **2/4**.

| Mutant | Trục ② (hàm thật) | Vì sao |
|---|---|---|
| `zero_out` | ✅ bắt | UI `0đ` ↔ nguồn sạch `6000000` |
| `halve_number` | ✅ bắt | UI `3.000.000đ` ↔ nguồn sạch `6000000` |
| `drop_field` | ❌ **không bắt** | field mất ⇒ **không nhãn UI nào mang giá trị** để đặt cạnh nhau |
| `stringify_num` | ❌ không bắt | FE tự parse `"6000000.0"` rồi render y như cũ ⇒ ở field này mutation **vô hại thật**, không phải vùng mù |

**Vùng mù mới, có bằng chứng: "giá trị biến mất / hiện rỗng".** `drop_field` lọt qua **cả ① lẫn ②**: ① kiểm *tập
nhãn* nên nhãn vẫn còn ⇒ xanh; ② cần *một giá trị để so* nên không có gì để so ⇒ xanh. Trớ trêu là chính luật tôi
nới ngày 17/08 (nhận khẳng định **RỖNG** là oracle hiển thị hợp lệ) làm lớp này vô hình. Bịt được bằng ③persist
(payload có field, response không) hoặc bằng oracle "field này BẮT BUỘC có giá trị" — chưa làm, ghi vào phần còn lại.

Bài học phương pháp: **thước đo cũng phải được kiểm bằng máy thật, không bằng phép suy của chính nó.**

## 2026-08-19 (j) — (3) mutation check: bộ kiểm KHÔNG bắt được bug giá trị, đo được 0/4

Đây là thứ đáng giá nhất trong ba việc, và nó ra **tin xấu** — đúng bản chất của một negative control.

**Added — `scripts/qa/mutation_check.js`** (`npm run mutation:check`): tiêm lỗi ở tầng `page.route()` (**không chạm
dữ liệu UAT, không ghi gì lên server**) rồi xem máy kiểm có đỏ. 5 mutant nhắm đúng các lớp bug **đã từng lọt thật**:
`zero_out` (SAPP-28310/28376) · `drop_field` (SAPP-28404/28442) · `halve_number` · `stringify_num` (`540000` →
`"540000.0"`) · `rename_label` (lớp "Phone" vs "Phone number").

**Kết quả đo trên UAT — `mutation score = 0/4 = 0%`.** Bóp `convertible_amount` thành 0, **xoá hẳn**, chia nửa, đổi
kiểu: `ui_conformance_check` **không thấy gì**. Nguyên nhân không phải máy hỏng mà là **phạm vi**: nó kiểm *kiểm kê
field/nhãn*, KHÔNG kiểm *giá trị*. Đây đúng là giới hạn "gate kiểm HÌNH DẠNG chứ không kiểm SỰ THẬT" mà trước đó
tôi chỉ **nghi** — giờ có số.

Cùng lượt đo, harness kiểm luôn năng lực **trục ②**: UI hiển thị giá trị bị bóp trong khi API đọc lại (sạch) trả
giá trị gốc ⇒ **4/4 mutant sẽ bị bắt**. Kết luận có bằng chứng: **kiểm-kê-field và kiểm-giá-trị là hai việc khác
nhau**; xanh cái này không nói được gì về cái kia.

**Ba bẫy của chính harness, đã sửa và ghi vào luật:**
1. **Không tiêm được mà tưởng là phát hiện.** Lượt đầu 4/5 mutant "không tiêm được" vì API trả tiền dưới dạng
   **chuỗi** (`"900000"`) mà hàm mutate đòi `typeof === 'number'`. "0%" lúc đó là **harness hỏng**, không phải vùng
   mù. Nay nhận cả hai kiểu và giữ nguyên kiểu gốc.
2. **Tautology ở tầng harness.** Nếu route bóp cả request của app LẪN request xác minh thì hai bên cùng bị bóp ⇒
   không bao giờ lệch ⇒ trục ② "không bắt được" một cách GIẢ. Nay bỏ route **sau khi app load** rồi mới đọc nguồn sạch.
3. Chỉ chặn endpoint **nghiệp vụ** (lượt đầu bóp cả `analytics.tiktok.com` và `/api/v1/me` — vô nghĩa), và phân biệt
   **"sống sót"** với **"không liên quan"** (giá trị không hiển thị trên màn đang kiểm) — score chỉ tính trên mutant
   có liên quan, nếu không thì con số vô nghĩa.

**Added — `tests/fe/infra/cli-guard.spec.ts`**: quét toàn bộ `scripts/qa/*.js`; script nào có CLI + `module.exports`
mà thiếu `require.main === module` guard thì **đỏ**. Lý do rất cụ thể: trong cùng phiên tôi mắc lỗi này ở **ba** file
(`cross_surface_diff`, `fixture_matrix`, `mutation_check`) — lỗi lặp lại thì phải có máy gác, không dựa vào nhớ.

Suite hạ tầng: 110 → **119 test**.

## 2026-08-19 (i) — (2) ASSERT tín hiệu môi trường: collector đầu tiên của kit

**Đính chính trước:** trước hôm nay kit **không có collector nào** — `grep pageerror scripts/ tests/support/` = 0.
`qa_instincts.md` chỉ *dặn* agent tự soi console/Network khi điều tra, mà dặn không phải forcing function. Nên ý
này không "chỉ cần assert", mà phải viết collector.

**Added — `scripts/utils/runtime/env_signals.js`**: `attachEnvSignals(page)` nghe 4 loại tín hiệu — `pageerror`
(JS exception, **zero-tolerance**) · console.error · request **4xx/5xx chạy nền** · **lệch contract** (chỉ kiểm
endpoint mà task KHAI contract, không tự đoán schema). Kèm `expect4xx(rx, why)` để case negative khai trước 4xx cố
ý, và `toFindings()` đổi tín hiệu thành `EXPANSION_FINDING` (JS chết / API 500 trong khi UI báo bình thường **là**
app tự mâu thuẫn ⇒ không cần oracle ngoài).

Đã cắm vào `ui_conformance_check` + `cross_surface_diff` — **không thêm lượt tải trang nào** vì hai máy này vốn đã
mở đúng các màn đó.

**Đo thật trên UAT (4 màn Order Detail):** 0 JS exception · 0 request 4xx/5xx · 4 `console.error` và cả 4 là
`ERR_CERT_AUTHORITY_INVALID` — **artifact môi trường/cert, không phải lỗi sản phẩm**. Nên chúng vào diện *ghi chú*,
không phải deviation. Đây là kết quả đáng tin theo hướng ngược: máy chạy mà **không** bịa ra finding.

**Fixed ngay trong lượt cắm:** tôi push `info.console-error` vào mảng `dev` trong khi chỗ tách `info.` nằm phía
trên ⇒ ghi chú bị đếm thành deviation (17 → **21**). Đã đưa về `infos`, số trở lại **17**. Bài học lặp lại: thêm
tín hiệu mới phải kiểm **con số tổng trước/sau**, không chỉ xem log có dòng mới.

**Added — 5 test** dựng đủ 4 loại tín hiệu (`page.setContent` + `page.route`), trong đó 2 test khoá phần **chống
báo oan**: tracking bên thứ ba (gtag 404) và 4xx đã khai trước đều KHÔNG tính là tín hiệu lạ — nhưng 4xx cố ý vẫn
phải được ghi lại, không im lặng. Suite hạ tầng: 105 → **110**.

## 2026-08-19 (h) — ĐIỀU KIỆN SỐNG CÒN của phần mở rộng: oracle, verdict riêng, risk band

Phản hồi review chỉ đúng một lỗi **đang có thật** trong thứ vừa build: mở rộng quanh case mà không có nguồn thì
kit mặc định *"app đang hiện thế là đúng"* ⇒ tautology **nhân theo số trục**, sản xuất PASS giả. Bằng chứng nằm
trong test của chính tôi: `persistence_probe` trả `ok: true` cho ca SAPP-28403 (USD không quy đổi) — `form/payload/
api/ui` khớp cả 4 ở giá trị `10` trong khi đúng phải `260.500`. **Tên field `ok` chính là mầm PASS giả.**

**Added — `scripts/lib/expansion/finding.js`** (hạt nhân): ba loại kết luận, không có loại thứ tư —
`EXPANSION_FINDING` (app **tự mâu thuẫn**: lệch giữa 2 bề mặt · mắt đứt chuỗi · field thừa/thiếu — không cần oracle
ngoài vì hai nơi cùng nguồn mà khác nhau thì chắc chắn một nơi sai) · `PASS`/`FAIL` (**chỉ khi** có `oracle_ref`
hợp lệ `BR-|SM-|PM-|SS-|DM-|UI-`) · `OBSERVATION` (không neo ⇒ **nhất quán ≠ đúng**, bắt buộc kèm `open_question`).
Máy **tự hạ cấp** PASS→OBSERVATION khi thiếu neo, và `oracle_ref` sai dạng bị bỏ (không nhận id tự bịa).

**Added — verdict taxonomy** (`.agent/config/verdict_taxonomy.json`): `EXPANSION_FINDING` + `OBSERVATION`. Cả hai
**cố ý `xray: null`** — trộn finding mở rộng vào execution status sẽ làm pass-rate mất nghĩa và triage lẫn lộn;
báo riêng ở `reports/expansion-findings.md`.

**Added — risk band, làm CÙNG LÚC chứ không để sau** (`scripts/lib/expansion/depth.js` + `npm run expansion:plan`):
chi phí là thật — 1 task đang **1021 file / 136 MB** evidence, và mở đủ trục cho bộ **530 case** ước lượng
**~3740 lượt tải trang · ~9,4 giờ · ~335 MB**. Band lấy **cái nặng hơn** giữa `Mức độ rủi ro` và `Ưu tiên`
(Minor + Ưu tiên High vẫn là đường chính ⇒ high): high → đủ trục runtime · medium → ③+⑤ · low → ③. Đo trên bộ 530:
**high 172 · medium 301 · low 57**.

**Changed — phân vai Phase 1 / Phase 2** (chỉnh kiến trúc theo review, tránh làm trùng `§10 Cross-layer Guard`):
①field ②surface ③persist ⑥lặp-đồng-thời ⑦chiều-ngược **cần runtime** ⇒ Phase 2 · ④nhánh ⑤trạng-thái **đoán trước
được** từ permission matrix / state machine ⇒ **case sinh ở Phase 1** (để được đếm coverage + publish TCM). Nửa
KHÔNG đẩy về Phase 1 được: *ô nào có dữ liệu để chạy* — đó là sự thật của **môi trường**, và chính là lý do case
④⑤ chìm vào SKIP ⇒ Phase 2 giữ `fixture:matrix --discover`.

**Enforcement:** `self_review` đọc thẳng `test-results/expansion_findings.json` và **CHẶN** khi có PASS/FAIL không
neo (bắt được cả file do script tự chế sinh hoặc sửa tay) · cảnh báo số `OBSERVATION` còn treo. Nghiệm thu 2 chiều:
file thật (2 OBSERVATION, 0 vi phạm) ⇒ chỉ cảnh báo; sửa tay 1 finding lên `PASS` ⇒ **CHẶN** đúng.

**Fixed:** `persistence_probe.ok` → `consistent` (+ console đổi thành *"NHẤT QUÁN — chưa phải PASS"*). Lúc đổi tên,
patch của tôi áp nửa vời làm marker `proven` đọc field không tồn tại ⇒ báo cáo ra `proven=0`; bắt được nhờ soi lại
marker sau khi chạy, không phải nhờ đọc code.

Suite hạ tầng: 86 → **105 test** (16 test mới cho luật oracle + risk band, và 3 test cũ đổi theo tên mới).

## 2026-08-19 (g) — trục ③ có chuỗi THẬT + đổi cách gate đọc báo cáo (dòng máy thay vì sniff văn xuôi)

**Đo chuỗi 4 điểm thật trên UAT** (user xác nhận mutation): đơn Bảo lưu *IT test uiBL*, sửa `Service Fee` qua form
Edit rồi đối chiếu `form → payload → API → UI`.

- Kết quả: **4/4 điểm khớp** (`1.431.539` ở cả 4 điểm) ⇒ chuỗi lành, probe KHÔNG bịa mắt đứt.
- **Net-zero đã xác minh**: `900000` → đo → **hoàn nguyên về đúng `900000`** (script tự kiểm và in ra).
- Lượt đầu **không bắt được request nào** — hoá ra form Edit là **wizard** (`Cancel/Next/Đồng bộ thông tin`, không
  có "Save"), nên cú bấm rơi vào hư không. May là nhờ vậy **không sửa gì**. Đã sửa thành `Next…→Finish→Confirm`.

**Fixed — cách gate đọc báo cáo.** Chốt chống "có file là xong" ở check #10 ban đầu **sniff văn xuôi** nên match
chữ *"đo thiếu điểm"* trong dòng tổng kết (giá trị **0**) và báo oan đúng báo cáo SẠCH. Đổi thành **hợp đồng
máy–gate**: mỗi máy tự phát một dòng máy-đọc-được ở đầu báo cáo

```
<!-- gate: proven=N inconclusive=M broken=K -->
```

(`persistence_probe` · `cross_surface_diff` · `fixture_matrix` · `spec_gap_report`), và check #10 chỉ cảnh báo khi
**proven=0**. Nghiệm thu 2 chiều: báo cáo thật (`proven=1/14/21`) ⇒ **✓ OK 5/5 trục**; báo cáo dựng với `proven=0`
⇒ chốt nổ đúng.

**Fixed — mask PII khi chụp evidence:** regex chỉ bắt `@` và số ≥9 chữ số nên **để hở `D.O.B`**. Đã bổ sung dạng
`dd/mm/yyyy`. (Ảnh của lượt này là contact tổng hợp *IT test*, không phải khách thật.)

## 2026-08-19 (f) — luật mở rộng phạm vi: bịt đường vào còn thiếu + gắn MÁY

Rà lại câu "luật đã được ghi chưa" thì thấy **ghi rồi nhưng chưa tới được mọi đường vào**: có ở `RULE_GLOBAL`
§5 trục, digest `core_rules.md`, và `phase2/04_execute_fe_playwright.md` — **thiếu** ở `CLAUDE.md` (file auto-load
mọi session), `phase2/05_execute_api_playwright.md`, và mô tả routing trong `run_phase2_template.md`. Nghĩa là
execute **nhánh API** hoặc người đọc bản đồ prompt sẽ không thấy luật.

**Added:**
- `CLAUDE.md` mục 3 (non-negotiable, luôn trong ngữ cảnh): "execute KHÔNG chỉ bám chữ trong case — mở rộng 5 trục
  + chiều ngược `spec:gap`; bug người ngoài tìm ra = **lỗi của máy**".
- `phase2/05_execute_api_playwright.md`: lát cắt 5 trục áp cho tầng API — trục ③ (ghi payload + response, không
  dừng ở `200 OK`), trục ② (API ↔ UI ↔ list), trục ④⑤ (`--discover` trước khi bỏ case vì "không có data"), và
  guard theo trạng thái (gọi thẳng API cho hành động UI đã chặn — việc chỉ API test làm được).
- `run_phase2_template.md`: mô tả routing của cả 2 prompt execute nêu rõ "5 trục mở rộng" (bản đồ prompt phải
  phản ánh nội dung mới, không thì agent skim bản đồ sẽ bỏ qua).
- **`self_review` check #10 — "5 trục mở rộng (máy nào đã chạy)"**: luật không có máy thì trôi. Check này KHÔNG
  chấm "đã mở rộng đủ chưa" (không đo được) mà chấm thứ đo được: **artefact của từng máy có tồn tại không**. Đo
  trên SAPP-24395: **4/5 trục có artefact**, trục ③ chưa (đúng — mới backtest offline, chưa ghi chuỗi thật).
  Có `requirements/cross_surface.json`/`fixture_matrix.json` mà chưa có báo cáo ⇒ **CHẶN** (khai phạm vi rồi bỏ dở).
- **Chốt chống "có file là xong"**: báo cáo tồn tại nhưng nội dung toàn "chưa kiểm được" thì vẫn cảnh báo. Lý do
  rất cụ thể: chính tôi vừa cân nhắc tạo một artefact khuyết để check #10 xanh, nên bịt luôn đường đó. Nghiệm thu
  bằng kiểm soát ngược: dựng báo cáo yếu ⇒ chốt nổ đúng.

## 2026-08-19 (e) — B3→B7: đủ 5 trục có máy + luật đóng vòng

Hoàn tất chương trình chống lọt bug (B0–B7). Mỗi trục có **máy đứng sau**, và mọi máy đều tách được "khớp" với
"chưa kiểm được" — vì im lặng ở chỗ chưa kiểm là cách lọt bug rẻ nhất.

**B3 `spec:gap`** — chiều ngược build→tài liệu. Conformance chỉ hỏi "tài liệu khai gì, build có đủ không"; chiều
này hỏi ngược. Đo 4 màn: 14 section khớp · **2 vùng mù** (`Order Info`, `Payment Info` của Chuyển đổi) · 9 section
có field mọc thêm. Backtest tự nhiên: máy nêu ra `Pay-back` — field trước đây người phải tự mò (TC_337). Xác minh
FSD gốc: §4.3.1.6 thật sự chỉ khai **1 field** cho `Order Amount` trong khi build có **9** ⇒ tài liệu thiếu.

**B4 `probe:persist`** — chuỗi `form→payload→API→UI` (13/69 bug). Engine sinh **giá trị mồi phân biệt**, so 4 điểm,
chỉ ra **mắt đứt + tầng lỗi**. Backtest 4 bug thật: SAPP-28310 (`payload→api`, thành 0) · SAPP-28376
(`form→payload`) · SAPP-28442 (mất hẳn khỏi payload) · SAPP-28403 (lệch bậc độ lớn) — đúng cả 4, và **không bịa**
mắt đứt trên chuỗi lành. Test bắt được bẫy trong API của tôi: chuỗi đo THIẾU điểm ban đầu trả `ok:true`.

**B5 `xsurf:diff`** — cùng giá trị, khác nơi hiển thị (**21/69 bug**, trục rò nhiều nhất). Lượt chạy thật đầu tiên
lộ 2 lỗi của chính tool: so format UI vs API là vô nghĩa (`600.000đ` vs `600000`), và hai ô trống vẫn ra "✓ khớp".
Sửa: chỉ so định dạng giữa các bề mặt UI; dưới 2 bề mặt đọc được ⇒ **CHƯA KIỂM ĐƯỢC**.

**B6 `fixture:matrix`** — nhánh × trạng thái (**42/69 bug**). Lý do 2 trục này rò rất tầm thường: không có dữ liệu
để thử nên case chìm vào SKIP. `--discover` đếm fixture đang có THẬT qua list API — và việc dò đã **sửa luôn thiết
kế ma trận của tôi**: môi trường có 5 trạng thái (`PURCHASING`, `PARTIALLY_PAID`, `CANCEL`) chứ không phải 3.
Kết quả: 6 nhánh × 5 trạng thái = 30 ô → **21 CÓ · 9 n/a kèm lý do đo được · 0 trống**.

**B7 luật + máy đóng vòng.** Viết 5 trục vào `prompt_templates/phase2/04_execute_fe_playwright.md`, canonical vào
`RULE_GLOBAL.md §5 trục mở rộng` (+ TOC, digest ở `core_rules.md`). Luật cốt lõi: **bug do người ngoài tìm ra là
LỖI CỦA MÁY** — phải trả lời "máy nào lẽ ra bắt được?"; không có máy thì đề xuất máy mới, CẤM kết thúc bằng "sẽ
chú ý hơn". Máy đứng sau: `leak:report --require-machine`. Đo thật: **29 bug do người tìm · 26 đã quy được về máy
· 3 chưa** — và 1 trong 3 (`SAPP-28651` thiếu section VNPay) hoá ra có máy nhưng **chưa bind màn**, đúng nhánh (a)
của luật.

**Kỷ luật lặp lại 2 lần trong phiên:** thiếu `require.main === module` guard làm `require()` trong test khiến CLI
tự `exit(2)`. Đã vá cả hai file.

Suite hạ tầng: 69 → **85 test** (thêm 16: backtest persistence 7 · cross-surface 4 · fixture matrix 5).

## 2026-08-19 (d) — trả nợ B2: biên section theo CẤP tiêu đề + bản đồ tên đo bằng máy

Hai món nợ của B2, cả hai đều vá theo **số đo trên UAT**, không theo suy đoán.

**Nợ 1 — khối con lồng trong khối.** `closest('.collapsible-section__container')` leo lên khối CHA nên khối con
`Deal Information` kiểm kê ăn luôn field của cả tab (12 nhãn, **6 field "thừa" oan**). Luật đúng là luật duy nhất
phân biệt được cha/con: **một section kết thúc ở nơi tiêu đề CÙNG CẤP HOẶC CAO HƠN tiếp theo bắt đầu**, với "cấp"
= (độ đậm, cỡ chữ) — đo thật: cha `w700/16px`, con `w600/16px`. Áp luật này vào **cả ba** đường định vị (selector
của app · heuristic hàng · fallback). Vá xong lại lộ lớp cuối: layout **phẳng** (tiêu đề con và các hàng là anh
em) thì **không tổ tiên nào** là container ⇒ thêm đường thứ tư: quét **DẢI ANH EM** từ tiêu đề tới tiêu đề cùng
cấp kế tiếp. Kết quả: 12 nhãn → **9 nhãn đúng dải**, extra 6 → 3.

> Ba lần sai liên tiếp ở đúng một chỗ (no-container oan → ôm cả tab → hút field khối bên cạnh) là lý do thêm
> `tests/fe/infra/section-scope.spec.ts`: DOM giả lập bằng `page.setContent`, tái hiện từng layout đã gây lỗi.
> Mắt đọc code không bắt được ba lỗi đó; test bắt trong 1 giây.

**Nợ 2 — tên khối tài liệu ≠ tên build.** Thay vì đoán, thêm hai thứ:
- `ui_conformance_check` giờ ghi **`surface.json`**: bề mặt THẬT của màn — danh sách section (kèm cấp tiêu đề) và
  tập nhãn của từng section. Khối cha không có nhãn nào vẫn được giữ (nó có thật, và cần để biết cấp bậc).
- `spec:extract --suggest-aliases <surface.json>`: ghép tài liệu↔build theo **độ trùng tập nhãn (Jaccard ≥ 0.5)**.
  Nghiệm thu: máy tự tìm lại **đúng 3 alias** tôi đã suy tay trước đó (trùng 0.6 / 0.8 / 0.67) và **không** đề
  xuất bừa cho 2 tên còn lại — vì trên build **không có khối nào khớp**. Cố ý **chỉ đề xuất**, người chốt rồi dán
  vào bindings (giống `bug:tc-match` không có `--apply`).
- Kèm sản phẩm phụ đúng hướng **B3**: 4 khối **có trên build mà tài liệu không nhắc** (`Order Info`, `Payment
  Info`, `Transfer Information`, `Data Synchronized to Hubspot` của luồng Chuyển đổi) — hạt giống cho chiều ngược.

**Trạng thái lượt chạy chốt (4 màn Order Detail):** 17 deviation — `fields.missing` 6 · `fields.extra` 6 ·
`fields.label-text` 4 · `no-container` 1. Không còn deviation nào sinh do máy ôm sai vùng. Nội dung đáng chú ý:
tài liệu ghi **`Phone`** còn build ghi **`Phone number`** (4 màn — MỘT câu hỏi BA, không phải 8 bug) · thừa
**`Địa chỉ`** ở Customer Info đơn Chuyển đổi (đúng lớp STT 42, **máy tự tìm**) · thừa `Service Fee Rate` · thiếu
**`Trạng thái đồng bộ`** ở khối đồng bộ về HubSpot (2 màn) · khối ĐỒNG BỘ VỀ HUBSPOT của Chuyển đổi thừa 7 field.

Suite hạ tầng: 64 → **69 test** (5 test mới cho định vị section + đề xuất alias).

## 2026-08-19 (c) — đưa B0/B1 vào commit (trước đó chỉ nằm trong working copy)

Rà lại chương trình chống lọt bug thì phát hiện **B0 và B1 chưa hề được commit**: `scripts/qa/leak_report.js`
còn **untracked**, và check #9 "độ phủ bề mặt" chỉ tồn tại trong working copy của `self_review.js`. Đây đúng
lớp tai nạn đã xảy ra một lần với `knowledge/**` (đổi nhánh là mất sạch), nên đưa vào commit ngay.

- **`scripts/qa/leak_report.js`** (mới): đếm bug theo **nguồn phát hiện** (`found-by-kit` / `found-by-human`) và
  theo **5 trục mở rộng quanh case** để biết nên xây máy nào trước. Đo SAPP-24395: 69 bug — 46 chưa phân loại
  nguồn; theo trục: field 11 · surface 21 · persist 13 · branch 20 · state 22 · không khớp 17.
- **`scripts/qa/self_review.js` check #9**: gate cũ chỉ hỏi *"có catalog mà chưa chạy?"* ⇒ **không khai catalog
  là cách né hợp lệ**. Nay so bảng *Phân nhóm testcase* với `ui_catalog.json`. Đo thật: **28 nhóm chức năng ·
  catalog 5 màn · 23 nhóm không có màn nào**. Để **P1 warning** có chủ đích (đo artifact thật trước rồi mới quyết
  chặn), vì chặn ngay sẽ làm đỏ mọi task cũ.

**Còn nằm ngoài commit có chủ đích:** cờ `--found-by kit|human` của `bug_reporter.js` — file đó là WIP của user
và có luật **không commit**. Hệ quả phải nói rõ: `leak_report.js` đọc được nhãn nguồn, nhưng **gắn** nhãn khi log
bug mới thì phụ thuộc một file chưa vào repo.

## 2026-08-19 (b) — chạy catalog tự sinh trên UAT: 3 lỗ định vị nữa, và máy tự tìm ra bug đầu tiên

Chạy `ui_conformance_check` với catalog **tự sinh từ FSD** lên UAT (read-only, 4 màn Order Detail Chuyển
nhượng/Chuyển đổi). Lượt đầu ra 16 deviation — **soi từng cái** thì phần lớn là lỗi định vị của chính máy, không
phải lỗi build. Ba lỗ, mỗi lỗ vá xong đều đo lại:

1. **`no-container` báo oan.** `Transfer Source Package Info` có mặt rõ ràng trên màn mà máy báo không thấy:
   heuristic "hàng = con có đúng 2 con lá" cho **rows = 0 ở mọi cấp** vì nhãn/giá trị lồng sâu hơn. Thêm (a)
   `sectionContainerSelector` — gợi ý DOM của app, khai ở **bindings lớp task** (`.collapsible-section__container`),
   và (b) fallback generic: leo tới tổ tiên cuối cùng **trước khi số nhãn nhảy vọt ≥2×** (đo được 13 → 13 → 52,
   mốc nhảy chính là lúc ôm luôn khối bên cạnh).
2. **Bản vá (1) làm mọi thứ TỆ HƠN** — container đúng nhưng bộ đọc nhãn chỉ soi `el.children`, nên card bọc trả
   **0 nhãn** và toàn bộ field bị báo THIẾU oan (`build có: []` khắp báo cáo). Sửa: quét **sâu** tìm hàng
   nhãn→giá trị ở mọi độ sâu. Sau vá: đọc đúng 6/6 nhãn `Customer Info`, 6/6 `Transfer Source Package Info`.
3. **Tên khối trong tài liệu ≠ tên trên build.** FSD ghi "THÔNG TIN ĐỒNG BỘ TỪ HUBSPOT" / "Thông tin trên Deal",
   OPS render "Data Synchronized from Hubspot" / "Deal Information" ⇒ khớp theo tên tài liệu thì **không bao giờ**
   định vị được. Thêm `sectionAliases` (dữ liệu quan sát của task, đo bằng probe read-only). Tên **chưa có alias**
   được tách sang `_forbidden_unaliased` và ghi rõ **"CHƯA kiểm được"** thay vì nằm im trong danh sách đã-gác.
4. **`forbiddenSections` báo oan khối dùng chung.** Khối có ở mọi loại đơn (ĐỒNG BỘ TỪ/VỀ HUBSPOT) bị tố là
   "của loại đơn khác". Lấy ngưỡng từ **phổ đo được**: dùng-chung xuất hiện ở 5–37 màn, tên đặc trưng chỉ 1–2 màn
   ⇒ **≥3 màn = dùng chung, loại khỏi forbidden**. Ngưỡng nằm giữa hai cụm, không phải số chọn bừa.

**Máy tự tìm được bug đầu tiên** (không ai chỉ trước): Order Detail đơn **Chuyển đổi** có field **"Địa chỉ"** ở
khối Customer Info — đúng lớp bug STT 42 vốn do người báo trên đơn Chuyển nhượng (SAPP-28608, đã Done). Kèm 3
phát hiện cùng lớp: nhãn build **"Phone number"** trong khi tài liệu ghi **"Phone"** (4 màn), khối Service Info
thừa **"Service Fee Rate"**, và khối ĐỒNG BỘ VỀ HUBSPOT **thiếu "Trạng thái đồng bộ"**.

**Nghiệm thu STT 42/43/53/54 — chưa đạt, và tiêu chí của tôi có chỗ sai:** STT 42 và 43 **đã được fix trên UAT**
nên không thể "bắt lại" — dùng bug đã Done làm phép thử là sai từ đầu; bằng chứng máy chạy đúng lớp đó là nó tìm
ra **ca mới** ở trên. STT 53 (`Course Conversion Info`) trên đơn đang thử **không render** (build có "Course
Package") — chưa phân biệt được lệch-tên-tài-liệu hay thiếu section thật, cần BA/dev. STT 54 **không kiểm được
bằng tên**: tên build của khối "Thông tin Deal trừ" chưa biết (phải lấy từ evidence của bug gốc).

**Còn nợ:** container cho **khối con lồng trong khối** (`Deal Information` nằm trong `Data Synchronized from
Hubspot` ⇒ `closest()` leo quá cao và sinh extra oan) · alias cho "Thông tin Deal trừ" / "Thông tin chuyển đổi".

## 2026-08-19 — B2 chống lọt bug: FSD tự sinh ui_catalog (888 field), backtest lộ 5 lỗ

**Vấn đề (B0 đã đo):** `ui_conformance_check.js` chỉ kiểm được màn nào **người** chịu khai tay vào `ui_catalog.json`. Task SAPP-24395 có **28 nhóm chức năng** nhưng catalog chỉ **5 màn** ⇒ 23 nhóm không có gì kiểm, và bề mặt cứ rộng ra khi máy kiểm đứng yên. Khai tay 49 bảng field là việc không ai làm.

**Added — `scripts/qa/spec_extract.js`** (`npm run spec:extract`): đọc chính bảng *"Mô tả chi tiết các trường"* mà FSD đã có sẵn (khuôn 8 cột) → `screens.json` → `ui_catalog.json`. Đo trên FSD thật: **42 bảng · 47 tab · 257 section · 888 field**. Từ chối sinh catalog khi thiếu `--bindings` (URL/fixture là dữ liệu TASK, script không đoán) và **luôn in số màn chưa có binding** — 54 màn đang mù, nói ra thay vì để tưởng đã phủ.

**Nghiệm thu đã tự ràng từ đầu:** catalog tự sinh phải bắt lại được **STT 42/43/53/54** mà không biết trước. Tôi viết parser xong mới mở 4 mục đó ra. Chính phép nghiệm thu này lộ **5 lỗ**, cả 5 đều vô hình nếu chỉ đọc code:

1. **`mode:'superset'` giết phép bắt field THỪA.** Phải bật superset để né báo-thiếu-oan cho field điều kiện — nhưng nó tắt luôn `fields.extra`, tức đúng lớp bug của STT 42 (Order Detail thừa "Địa chỉ"). Sửa: thêm **`optionalFields`** vào `ui_conformance_check.js` — miễn trừ **đích danh** từng field điều kiện, `superset` chỉ còn dùng cho nhãn lặp động không liệt kê được ("Phí dịch vụ lần 1..N").
2. **Loại nhầm 78 field.** Bản đầu coi `dropdown/combobox/checkbox/tag` là "control không nhãn" — đó là **nơi bug hay sống** (SAPP-28311 Service Fee không phải Combobox, SAPP-28318 dropdown thiếu option). Nay chỉ loại `button/icon/link`.
3. **Key trùng giữa các file.** FSD copy-paste nên mục "4.3.1.6" tồn tại ở **cả** file Chuyển đổi lẫn Chuyển nhượng ⇒ binding trỏ một URL nhưng lấy tập field của **loại đơn khác** (đúng lớp "26 deviation giả"). Nay key mang tiền tố file.
4. **Section lạ không ai bắt.** STT 54 là màn mọc thêm **cả một khối** của loại đơn khác ("Thông tin Deal trừ" trên tab Hub Info của Chuyển nhượng) — kiểm-kê-field không chạm tới vì field của màn vẫn đủ. Thêm `forbiddenSections` (sinh từ spec: section cùng tab nhưng thuộc **màn khác**) + check `sections.unexpected`. Bản heuristic đầu lọc theo *file* nên vừa **bỏ sót đúng STT 54** vừa **tố oan** một section của chính màn — sửa thành lọc theo **khoá màn**.
5. **Nhãn lặp trong tài liệu.** FSD ghi `Phone` hai lần trong một khối ⇒ so-tập vô nghĩa. Nay gộp và nêu ra để hỏi BA (`_doc_duplicates`).

**Kiểm chéo offline (mạnh hơn tự tin):** so catalog tự sinh với catalog **viết tay** — màn *Add-on Order Detail / Overview* khớp **chính xác 3/3 section (6/6, 7/7, 4/4)**, kể cả giữ đúng `Net Price` (field mà bug #19 tố thiếu) và loại đúng `Note` có điều kiện. Chỗ lệch ở màn Create là **auto đúng hơn bản tay**: bản tay đưa `Deal ID Đã Thanh Toán Phí` (FSD ghi rõ "chỉ hiển thị khi có giá trị") vào tập phải-có ⇒ sẽ báo thiếu oan với mọi deal thường.

**Added — `tests/fe/infra/spec-extract.spec.ts`** (8 test, suite hạ tầng 56 → 64): mỗi test khoá đúng một lỗ ở trên, kèm fixture FSD thu nhỏ giữ nguyên các đặc điểm đã gây lỗi (heading in nghiêng, số mục trùng 2 file, nhãn lặp, field điều kiện).

**Bẫy lặp lại lần thứ ba:** ký tự `\b` bị công cụ trung gian biến thành **backspace (0x08)** nằm trong regex ⇒ `Button` không bao giờ khớp mà script vẫn chạy êm. Lần này phát hiện nhờ soi số (0 control giữa 119 button). Đã quét cả repo, không còn 0x08 lạc.

**Trạng thái nghiệm thu:** 3/4 mục (42/43/54) đã chứng minh được **catalog hỏi đúng câu** ở mức offline; STT 53 cần một fixture order Chuyển đổi để bind. Cả 4 mục **chưa** chạy thật trên UAT — đó là bước kế tiếp và cần xác nhận trước khi chạm UAT.

## 2026-08-17 — chạy 3 gate mới trên NỘI DUNG THẬT: 4 luật báo oan, đã vá

**Vấn đề:** `dim:coverage`, Lớp 1 (bằng-chứng-tối-thiểu-theo-tag) và `domain:trace-back` tới giờ **chỉ được thử trên fixture do tôi tự dựng** — mà fixture thì luôn xanh, nó được viết để khớp luật. Nên tôi viết **28 testcase Order Bảo lưu** có tag chiều thật (oracle từ `BR-BAOLUU-001…007`, `BR-TXN-003…005`) rồi chạy 3 gate đó lên. Lượt đo lộ ra **4 luật báo oan** — cả 4 vô hình với fixture.

**Fixed — bằng chứng tối thiểu (`scripts/qa/lib/output_rules.js`):**
- `[display]` **không nhận khẳng định RỖNG**. "Refund Amount rỗng" bị đòi thêm bằng chứng, trong khi §12 prompt gen nêu thẳng *"giá trị để trống đúng nghĩa"* là thứ phải kiểm.
- `[guard]` áp bằng chứng **nhánh CHẶN cho cả nhánh CHO PHÉP**: case `[Positive][Guard]` không có 4xx nào để nêu mà vẫn bị đòi "403/409 hoặc dữ liệu không đổi". Nay tách: nhánh CHẶN đòi mã lỗi/dữ-liệu-không-đổi, nhánh CHO PHÉP đòi thông báo nguyên văn hoặc giá trị cụ thể.
- Kết quả trên bộ pilot: **4/20 cảnh báo → 0**, và **4/4 cảnh báo ban đầu là oan**.

**Fixed — `scripts/qa/domain_rules.js`:**
- Kiểm ghost-ref phán **ngoài thẩm quyền**: trỏ `--tc-dir` vào một bộ hẹp (`BL_TC_*`) làm **13 rule** bị tố *"covered_by trỏ TC KHÔNG TỒN TẠI"*, chỉ vì `covered_by` của chúng trỏ `OPS_PAY_TC_*` nằm ở bộ canonical khác. Nguy hiểm thật: người đọc có thể đi xoá `covered_by` đúng. Nay chỉ kiểm khi lượt quét **chứa cùng họ TC ID**, và **in ra phần không kiểm được** thay vì im lặng báo ✓.
- Luật *"`examples[].expected` phải chứa chữ số"* quá thô: "Refund Amount = rỗng", "Edit: CHẶN", "VietQR theo tài khoản SCMA" đều đối chiếu được mà không có số nào (**9 báo oan**). Đảo chiều — không đòi dấu hiệu cụ thể, mà bắt đúng thứ cần bắt: expected chỉ nói "thành công/đúng/hợp lệ" rồi hết. Tổng: **26 cảnh báo → 2**, cả 2 đều đúng.

**Bẫy kỹ thuật đáng ghi:** `\b` trong regex JS **không dùng được với chữ có dấu** — "đ"/"ẩ" không phải word-char nên `\b` đứng trước "để trống" là biên **không bao giờ khớp**; luật im lặng mà trông như vẫn chạy. Bản vá đầu của tôi mắc đúng lỗi này và **test mới bắt được ngay** — đó là lý do phải khoá luật bằng test chứ không tin mắt.

**Added — test khoá 2 luật mới** (`tests/fe/infra/gates.spec.ts`, 54 → 56 test): `[display]` nhận rỗng nhưng vẫn bắt "hiển thị đúng thông tin"; `[guard]` phân biệt nhánh allow/deny. Kiểm soát ngược: 3 case expected mơ hồ vẫn bị bắt đủ 3 → nới luật **không** làm cùn luật. Bộ 530 thật: **0 CHẶN**, không sinh chặn mới.

**`dim:coverage` bắt gap trong nội dung do CHÍNH TÔI viết:** 20 case đầu phủ 7/15 chiều; khi buộc khai manifest thật thì 4 chiều 0-case **không khai `n/a` được** (UI có lưới/filter/sort · API vì quy tắc "test cả UI lẫn API" · E2E vì Create→Checkout→Thanh toán là chuỗi thật · Change Impact vì đơn Bảo lưu dùng chung Transaction List + property "lần đóng"). `--enforce` **chặn (exit 1)** → bổ sung 8 case. 4 chiều `n/a` có lý do kiểm chứng được, trong đó `security` = **BA chưa cấp ma trận role/permission** (cùng nguyên nhân khiến 24 case bộ 530 đang treo).

**Quyết định — CHƯA bật chặn toàn cục.** Tỷ lệ trượt Lớp 1 sau khi trừ báo oan là 0%, nhưng **không dùng để quyết được**: 28 case này do tôi viết với 10 rule mở sẵn trước mắt ⇒ đó là **trần**, không phải tỷ lệ điển hình. Căn cứ để bật chỉ có một nguồn: **một lượt Phase 1 chạy bình thường** rồi đo lại. Giữ **cảnh báo, không chặn** cho tới lúc đó.

## 2026-08-14 (l) — backup knowledge: cấu hình thật + chốt chặn "quên chạy"

Đích đã chốt: **local ngoài repo** (`D:/kit-knowledge-backup`) — user chọn, cố ý **KHÔNG** đưa business rule nội bộ lên cloud dù OneDrive có sẵn trên máy. `KNOWLEDGE_BACKUP_DIR` đặt trong `.env` (machine-local, gitignored) và ghi vào `.env.example` cho máy mới. Bundle đầu tiên: **15 file**.

**Mối nguy thật, nói cho đúng:** không phải hỏng ổ cứng mà là **tai nạn git** — và nó **đã xảy ra trong chính phiên này**: đổi nhánh lúc sync GitLab xoá sạch `knowledge/**` vừa được gitignore, phải `git restore --source=2d383e1^` lấy lại **87 file**. Lần đó cứu được vì file còn trong history; nay đã bỏ track hoàn toàn nên **cùng tai nạn = mất vĩnh viễn**. Vì vậy đích local (ngoài repo) đã chống đúng lớp nguy hiểm nhất — không cần cloud.

**Added — chốt chặn ở `self_review`** (gate trước finalize, đúng lúc vừa sinh record mới): có record ghi tay mà **chưa cấu hình đích** → nhắc · đã cấu hình mà **chưa có bundle nào** → nhắc · bundle mới nhất **quá 7 ngày** → nhắc. Nghiệm thu 2 nhánh: vừa backup xong thì **im**; xoá biến môi trường thì nhắc đúng *"15 record knowledge GHI TAY … CHƯA cấu hình"*.

Kiểm chỗ dễ hỏng: script **tự đọc `.env`** qua `runtime_config` — nếu không thì cấu hình vừa đặt là vô ích (đã chạy không truyền biến để xác nhận).

**Lỗi vận hành của tôi ở commit này:** lệnh sửa CHANGELOG viết trong `node -e` bên trong heredoc → **shell ăn backtick**, script chết, nên `d2f7dd7` commit thiếu mục này (phải bổ sung ở commit sau). Đây là **lần thứ ba** trong ngày backtick bị shell ăn. Bài học đã rõ: nội dung có backtick thì **dùng Edit tool**, đừng đi qua shell.

## 2026-08-14 (k) — sao lưu store KHÔNG nạp lại được + stale theo lịch cho rule

Review chỉ ra bảng "nạp lại" của `SCHEMA.md` đặt hai thứ **khác loại** cạnh nhau, và đúng:

| | Store | Mất thì sao |
|---|---|---|
| Nạp lại được | `bugs/` · `historical_execution/` · `metrics/` | 1 lệnh là có lại (Jira / test-results) |
| **KHÔNG** nạp lại được | `domain/` `system/` `decisions/` `setup_recipes/` `environment/` `locators/` + `bug_tc_map.json` | **Làm lại công sức người** |

Đo: **15 file** thuộc loại thứ hai, và vì `knowledge/**` bị gitignore nên chúng tồn tại trên **ĐÚNG MỘT máy — không remote nào có bản nào**. Tôi đã ghi rủi ro này rất cẩn thận cho `bug_tc_map.json` nhưng **bỏ sót đúng ba store đắt nhất**. Chi phí chỉ tăng theo thời gian và **không sửa được sau khi mất**.

**Added — `npm run knowledge:backup`.** Bundle JSON + sha từng record · `--verify` so bundle với hiện trạng · `--restore` **chỉ ghi file còn THIẾU, không đè** (bản trên đĩa có thể mới hơn bundle; khác nội dung thì chỉ BÁO). **TỪ CHỐI** khi thiếu đích và khi đích **nằm trong repo** — backup cùng chỗ bản gốc thì không phải backup, còn tạo nguy cơ commit đúng dữ liệu đã quyết định không commit. Cố ý **không** sao lưu `bugs/`/`historical_execution/`/`metrics/`: nạp lại được, thêm vào chỉ làm phình bundle và làm mờ thông điệp.
Nghiệm thu **trọn vòng**: backup 15 file → verify KHỚP → xoá 2 file (rule đắt nhất + `bug_tc_map`) → verify **exit 1, nêu đúng tên** → restore → verify KHỚP, nội dung **giống từng byte**; sửa file trên đĩa rồi restore → **không bị đè**; sau khi sửa 1 record thì `--verify` báo đúng *"đã sửa sau lần sao lưu"*.

**Added — `domain:check` stale THEO LỊCH (`--stale-months`, mặc định 9).** Khác stale cũ: cái cũ nổ khi **có người sửa rule** (rule đổi sau lần execute → TC phải chạy lại); cái mới nổ khi **KHÔNG ai làm gì** — rule active không ai chạm N tháng thì oracle có thể đã lạc hậu, và nó im lặng vì không sự kiện nào kích hoạt. Rule lạc hậu tệ hơn không có rule: mọi TC dựa vào nó sai theo mà vẫn xanh.
Tự bắt lỗi: `Number(x) || 9` làm `--stale-months 0` **rơi về 9 âm thầm** (0 là falsy) — phát hiện đúng lúc nghiệm thu ngưỡng.

**Fixed — doc drift** review nêu: khối "Thư mục" của SCHEMA thiếu `setup_recipes/`, `environment/`, `metrics/`, `bug_tc_map.json`.

## 2026-08-14 (j) — mắt xích còn hở: chiều TC → rule, và recipe tái dùng được

Hai review về knowledge. Tôi kiểm từng khẳng định trước khi làm — **đúng gần hết**, và một con số làm luận điểm chính mạnh hơn cả cách nó được trình bày.

**Lỗ hổng #1 — chiều TC → rule không có gì kiểm.** `--trace` đã kiểm chiều rule→TC (rule nào chưa có test). Chiều ngược thì `output_gate`/`design_gate` **0 lần** nhắc tới `domain/`/`BR-`, và canonical **không có cột nguồn oracle**. Đo trên bộ 530: **0/530 case** nhắc bất kỳ id rule nào — dù `§12` prompt gen **đã yêu cầu** "ghi id rule vào Kết quả mong đợi/Assumptions" từ trước. Trong đó **47 case có expected mang giá trị số/tiền/%** (chắc chắn có oracle nghiệp vụ) và **0** trỏ rule. ⇒ Quy định có, **tuân thủ 0%**, không máy nào gác.

**Đã KHÔNG chọn 2/3 phương án review đề xuất, kèm lý do:**
- *Thêm cột "Nguồn oracle"* → phá format 9 cột mà `md_to_xlsx`/publish/pull/validate đều khoá theo, và bộ 530 đã chốt không tái cấu trúc.
- *Auto `covered_by` qua `learning_recorder`* → nó là Suggest-only, tức lại phụ thuộc "agent nhớ chạy" — đúng cái đã đo là thất bại.

**Làm cách thứ tư: mang id rule vào TAG tiêu đề**, dùng lại hạ tầng tag chiều dựng cùng ngày:
```
[Positive][Calc][BR-RECIPBANK-001] TK nhận theo chương trình + mốc 01/01/2026
[Negative][Guard][SM-ORDER-001]    Đã thanh toán → Chờ thanh toán phải bị CHẶN
```
`model.oracleRefsOf()` đọc `BR-`/`SM-`/`PM-`/`SS-`/`DM-` từ tiêu đề — **không đổi format**. `npm run domain:trace-back`: (a) case mang tag cần-oracle (`calc/bedata/display/security/guard`) mà không trỏ id → cảnh báo *"expected lấy từ đâu?"*; (b) trỏ id không tồn tại → *"oracle ma"*; (c) `--apply` **tự append `covered_by`** ⇒ hết phụ thuộc người nhớ điền. Một tín hiệu gác **hai chiều**.
Nghiệm thu bằng fixture 3 case: append đúng 1, cảnh báo đúng case thiếu ref, bắt đúng ghost ref; `--apply` ghi thật rồi hoàn nguyên. Trên bộ 530 (chưa có tag) nó **nói rõ "CHƯA GÁC ĐƯỢC"** thay vì báo OK — im lặng ở đó chính là lỗi nó sinh ra để chống.

**Recipe tái dùng được (review #2).** Xác minh: `SR-ORDER-001` **không có** `applies_when`/`used_by`, và `howto_store` chỉ có `--check`/`--index` — không có tra cứu. Thêm: `applies_when` (điều kiện áp được), `used_by` (TC đã dựng state thành công = bằng chứng recipe còn dùng được, cùng khuôn `covered_by`), và `npm run howto:find -- "<precondition>"`. Chạy đúng luồng review mô tả: `PRE-03: Deal phải là loại Chuyển nhượng` → tra → `SR-ORDER-001` khớp 4 từ, hiện `applies_when` + `used_by` → **người** tự quyết.
**Cố ý KHÔNG có "match confidence"** dù review đề nghị: một điểm `0.72` trông đáng tin hơn thực tế và mời người ta bỏ qua bước đọc — mà trong ngày 14/08/2026 chấm-điểm/suy-diễn trên văn bản tiếng Việt đã sai **3 lần liên tiếp** (suy module bug 4/9 sai · `label→module` 5/17 đa nghĩa · suy chiều coverage đánh đổi recall↔precision). Xếp theo **số từ khớp**, in ra thứ để ĐỌC.
`entity/state` + `input_requirements` thì **hoãn** — cấu trúc chỉ trả lãi khi có nhiều recipe và có người truy vấn thật; hiện N=1.

**Hai lỗi nhỏ review nêu — đều đúng, đã sửa** (xem mục (k) cùng ngày).

## 2026-08-14 (i) — `docs:budget`: đo tài liệu TRƯỚC khi đọc (và bắt 2 bẫy đo được thật)

Việc #3 trong danh sách ("giao subagent đọc tài liệu lớn"). Nhưng "tài liệu lớn" là thứ **chỉ hiện ra sau khi đã đọc xong**, tức đã muộn — nên thứ cần làm trước là **đo**.

**Added — `scripts/qa/doc_budget.js` (`npm run docs:budget`).** Đo `requirements/` của task theo KÝ TỰ (không theo byte: UTF-8 tiếng Việt ~1,5 byte/ký tự nên đếm byte phóng đại ~50% và đẩy tài liệu qua ngưỡng oan) rồi phán từng file: `<8k` đọc trực tiếp · `8–25k` chỉ đọc mục cần · `>25k` **giao subagent** (`--contract` in hợp đồng trích xuất: trả JSON theo `knowledge/SCHEMA.md`, mọi rule phải có `source` tới đúng tab/mục, chỗ tài liệu không trả lời được thì vào `open_questions` — cấm suy diễn lấp chỗ trống; kết quả vẫn phải qua `domain:check`/`system:check`).

**Đo trên task thật — con số nói thay lời:** 54 tài liệu, **~38.600k token nếu đọc hết**, trong đó `figma_node_6-5.json` **37.500k** (nặng gấp **~3.180×** toàn bộ prompt gen 11,8k). Không ai đọc nổi file đó, mà nó đang nằm trong `requirements/`.

**Hai bẫy mà tool bắt được, cả hai đều tồn tại thật:**
1. **Tài liệu có nhiều bản** — FSD có cả `.json` 504k lẫn `.md` 108k; sheet mapping `.json` 56k + `.md` 33k; `tabs/` và `tabs_20260807/` là hai lần export. Bỏ bản dư = **~670k token** không mất một chữ nào.
2. **⚠⚠ Bản cũ NHỎ HƠN HẲN bản mới = bản THIẾU nội dung**, không phải "bản khác ngày".

**Tự bắt lỗi nguy hiểm trong chính tool** — bản đầu tôi cho tiêu chí "đọc bản NHẸ NHẤT", và nó khuyên đọc bản FSD **6,6k** thay vì **108k**. 6,6k chính là các bản export **bị cắt còn 1/15 tab** từ trước khi vá `includeTabsContent` **sáng cùng ngày** (mục (b)). Tức tool suýt khuyên đọc thiếu spec — đúng cái bug vừa sửa. Tiêu chí đúng: cùng basename khác **định dạng** → ưu tiên `.md`; cùng định dạng khác lần export → ưu tiên **mới nhất theo mtime**; và nếu bản mới lớn hơn hẳn thì **nói to** rằng bản cũ là bản thiếu.

Nối vào `phase1/01_setup_engine_fetch_docs.md` (+0,5k) và bảng gate của `run_phase1`. Ghi rõ trong prompt: giao subagent **KHÔNG** giảm tổng token (subagent nạp lại luật + ngữ cảnh), nó đổi lấy việc luồng chính không chứa nguyên văn tài liệu — nói thẳng để không ai kỳ vọng sai.

## 2026-08-14 (h) — auth reuse: cơ chế đã có nhưng 32/33 spec không đi qua

**Bối cảnh.** Tôi từng nói "UAT login throttle chặn cứng việc song song hoá Phase 2". **Sai** — cơ chế né throttle đã có từ trước (`session_cache` + `ensureOpsAuth` + `tokenBroker`). Nhưng đo ra thì nó **chưa được lắp**: **1 spec** dùng `ensureOpsAuth`, **32 file gọi thẳng `loginOps`** ⇒ mỗi lần chạy vẫn login lại. Thêm nữa `playwright.config.js` không có `globalSetup` và `session_cache` không có lock ⇒ **khởi động lạnh với N worker = N lần login đồng thời**, đúng cái lockout mà cache sinh ra để tránh.

**Changed — đưa cache vào THẲNG `loginOps`, không sửa 32 spec.** Sửa ở điểm vào thì không ai bypass được bằng cách quên — cùng nguyên tắc forcing-function của kit; chữ ký giữ nguyên nên **0 spec phải sửa**. Bản thuần tách thành `loginOpsForm` (dùng khi cố ý test luồng login; `ensureOpsAuth` nay gọi bản này để không lồng hai lớp cache). Cache tươi → seed cookies + localStorage **trước mọi navigation** rồi mở base; nếu vẫn bị đẩy về `/auth/login` thì xoá cache và login form. Kill-switch `AUTH_REUSE=0` cho hành vi y như trước; TTL đổi qua `AUTH_TTL_MINUTES` (mặc định 25′ < token TTL 30′).

**Added — `sessionCache.withLock`.** Lock bằng `mkdir` (atomic trên cả Windows lẫn POSIX, không cần thư viện). Lock cũ hơn `staleMs` bị **thu hồi** — nếu không thì một lần crash treo mọi lần chạy sau. Hết `timeoutMs` thì **vẫn chạy** `fn`: thà login trùng một lần còn hơn làm cả suite fail vì không lấy được lock.

**KHÔNG thêm `globalSetup`** dù nó cũng chữa được thundering-herd: globalSetup sẽ **login UAT vô điều kiện ở mọi lần chạy**, kể cả suite infra không cần auth — trái rule "xác nhận trước mỗi lượt chạm UAT". Lock giải đúng vấn đề đó mà không thêm một lượt chạm nào.

**Nghiệm thu**
- Offline (`tests/fe/infra/auth-session-lock.spec.ts`, 4 pass, **không chạm UAT, không cần creds**): quyết định tươi/hết-hạn; 5 lượt đồng thời → max 1 trong vùng găng và **đúng 1 lần "login"**; lock rác bị thu hồi; hết timeout vẫn chạy và báo rõ `gotLock=false`.
- **Liên tiến trình** (thứ mà test trong-một-tiến-trình KHÔNG chứng minh được): 5 process node song song → log ra **1 LOGIN + 4 REUSE**, max 1 process trong vùng găng.
- Regression: `tests/fe/infra` **30/30 pass**, `typecheck`/`lint` exit 0, 30 file gọi `loginOps` không phải sửa dòng nào.
- ✅ **UAT thật (đã chạy, user xác nhận chạm UAT): 2/2 pass** — `tests/fe/auth/auth-evidence.smoke.spec.ts`. Cache key thật ghi 35 cookie + `actToken`/`refreshToken`. Kill-switch `AUTH_REUSE=0` vẫn giữ để trở về hành vi cũ nếu cần.

**Hai lỗi của chính thay đổi này, phát hiện KHI chạy smoke** (không phải do đọc lại code):
1. **Tôi đã copy logic seed thành bản thứ hai.** Smoke cũ chỉ nghiệm thu bản trong `ensureOpsAuth`; bản trong `loginOps` là code chưa ai chứng minh chạy. Hai bản sao của cùng một logic khó (thứ tự `addInitScript`, chọn origin, cách xác minh) chắc chắn phân kỳ. → Tách `tests/fe/support/auth/seedSession.ts` làm **một bản duy nhất**, cả hai đường gọi vào đó; đặt ở module thứ ba để không sinh import vòng (`opsAuth` đã import `opsLogin`).
2. **Smoke cũ KHÔNG phủ `loginOps`** — nó gọi `ensureOpsAuth` với key riêng, trong khi `loginOps` mới là hàm 30 spec thật sự dùng. → Thêm test riêng cho `loginOps`. Bằng chứng "không login lại" là **`savedAt` không đổi sau lượt 2** (chọn cách đo này vì `loginOps` trả `void` — giữ chữ ký để 30 spec không phải sửa nên không đọc được "method" như `ensureOpsAuth`). Tốn đúng **1 lần login** cho cả 2 lượt.

## 2026-08-14 (g) — vá rủi ro do chính nhát cắt (f) sinh ra: khai `n/a` sai

Tách 15 chương thành file rời sinh ra một rủi ro mới: agent đọc **một dòng trigger** rồi khai `n/a`, trong khi trước đây đọc tuần tự sẽ **vô tình gặp** chương đó và nhận ra là cần. Chốt chặn cũ chỉ là "n/a phải có lý do" — tức trông chờ người review đọc.

**Added — đối chiếu manifest ↔ ARTIFACT THẬT** trong `dimension_coverage.js`. Không suy diễn văn bản (cách đó đã bị loại ở (d)), mà dựa vào **sự tồn tại của artifact** — một sự thật kiểm được:

| Khai `n/a` cho | Bị CHẶN nếu tồn tại |
|---|---|
| §11 Design | `requirements/figma/**` |
| §12 Display | `requirements/ui_catalog.{json,md}` |
| §14 BEData | `field_mapping*` trong `requirements/` |
| §5 API | `requirements/swagger/**` |
| §17 Impact | `requirements/git-impact.md` \| `knowledge/system/` có `shared_surface` |
| §10 Guard | `knowledge/system/` có `state_machine` |
| §15 Security | `knowledge/system/` có `permission_matrix` |

**Chiều ngược lại KHÔNG suy được** và script cố ý im lặng ở đó: artifact vắng **không** chứng minh chiều đó không áp dụng (có thể chỉ là chưa ai kéo Figma/swagger về). Chỉ chặn khi artifact **có** mà manifest nói `n/a`.

Chặn **độc lập** với việc thiếu case, và chạy được **cả ở chế độ GỢI Ý** — vì bằng chứng không phụ thuộc phân loại case. Artifact có mà chưa khai `required` thì cảnh báo (không chặn).

**Nghiệm thu trên task thật** (SAPP-24395 có `figma/` + `ui_catalog.json` + `field_mapping*`): manifest cố ý khai `design_figma: "n/a"` và `display_conformance: "n/a"` → không `--enforce` thì báo 2 XUNG ĐỘT + exit 0; có `--enforce` thì **exit 1**. Cảnh báo "chưa khai required" cũng nổ đúng cho §10 Guard nhờ `knowledge/system/` có `state_machine`.

Ghi vào §0b của prompt gen thành bảng, kèm câu nói rõ chiều nào suy được / chiều nào không — để agent biết `n/a` sẽ bị đối chiếu, không phải chỉ để review đọc.

## 2026-08-14 (f) — tách 15 chiều coverage thành file rời: 24,6k → 14,9–20,4k tuỳ task

Nhát cắt thứ hai, làm được vì (d) đã có gate đếm case theo tag đứng sau OUTPUT. §3–§17 nằm **liền nhau** trong file nên cắt sạch; §18 Self-check **ở lại** (nó là gate đóng lượt, không phải một chiều).

`prompt_templates/phase1/dimensions/` — 15 file, mỗi file 0,2–2,3k, mỗi file mở đầu bằng **tag bắt buộc** + **"mở khi nào"** (trigger copy từ chính tiêu đề chương, không tự bịa). Trong `02` còn lại **bảng điều hướng** §·chiều·tag·mở-khi·file.

| Lượt gen | Token | So với 24,6k |
|---|---|---|
`02_gen_testcases.md` (nạp mọi lượt) | **11,8k** | — |
Task **nặng** (payment: §3,4,12,13,14,15,17) | 11,8 + 8,6 = **20,4k** | −4,2k (**17%**) |
Task **nhẹ** (mobile UI: §4,11,12) | 11,8 + 3,1 = **14,9k** | −9,7k (**39%**) |

Nói thẳng: task dùng gần hết chiều thì tiết kiệm ít (17%) — đúng như đã cảnh báo trước khi cắt, không phải "về vài k". Lợi ích lớn thứ hai lại **không phải token**: giờ **bắt buộc khai `dimension_manifest.json` TRƯỚC khi gen** (để biết mở file nào), nên phạm vi chiều thành một tuyên bố tường minh có lý do cho từng `n/a`, và `dim:coverage --enforce` đếm lại ở cuối. Trước đây phạm vi chiều là thứ ngầm định trong đầu người gen.

**G1 bảo toàn nội dung:** 555 loại dòng · **MẤT 0**.

**8 con trỏ lệch đã sửa** (script in rõ 8/8 áp dụng, không replace im lặng): `run_phase1` ×3, `02b_output_format` ×2, `06_cross_module`, `.agent/rules/qa_instincts.md`, `.agent/skills/phase1/git_impact_analyzer/SKILL.md`. Các "mục N" **nội bộ** trong `02` giải một lần bằng quy ước ghi ngay trong bảng điều hướng (`N = 3…17` ⇒ `dimensions/`; mục 0–2 và 18 vẫn ở `02`) thay vì sửa hàng chục câu.

## 2026-08-14 (e) — cắt 3,8k khỏi prompt gen, có kiểm bảo toàn từng dòng

Sau khi (d) dựng xong gate chiều đứng sau output, việc cắt prompt mới an toàn. Cắt phần **an toàn nhất trước**: `Phase 1 Summary Report` + `Export Excel` — hai mục này là hướng dẫn **định dạng output ở cuối lượt**, KHÔNG phải luật về nội dung case, nên không cần nằm trong context suốt lúc đang sinh case. Chúng nằm liền nhau ở cuối file nên là một nhát cắt đuôi sạch.

| | Trước | Sau |
|---|---|---|
`02_gen_testcases.md` (nạp mọi lượt gen) | 24,6k tok | **20,8k** |
`02b_output_format.md` (chỉ nạp ở cuối lượt) | — | 3,9k |

**G1 — kiểm bảo toàn nội dung, không tin "nhìn có vẻ ổn".** So tập dòng không rỗng của bản gốc với hợp của hai file mới: **671 loại dòng · MẤT 0**. Cần thật, vì trong đợt này đã 2 lần backtick bị shell ăn và 1 lần dòng bị dangling sau khi Edit.

**Ba con trỏ lệch phát hiện lúc rà** (một cái hỏng từ trước, không do nhát cắt): `run_phase1` ghi "không nạp sẵn cả **6** file" (thực tế 7) và "`02_gen_testcases.md` đã **89KB**" (nay 77KB) → sửa; và câu "áp dụng quality gate trong section Phase 1 report **bên dưới**" — `run_phase1` **không có mục report nào**, tức con trỏ đã trỏ vào hư không từ trước → nay trỏ đúng `02b_output_format.md`.

`02b` được khai trong bảng "Bản đồ prompt" là **BẮT BUỘC ở CUỐI lượt**, kèm lý do bỏ qua sẽ bị chặn (`design_gate` chạy trong `md_to_xlsx`, `self_review` đọc Summary Report).

**Còn lại của việc cắt:** 9,9k của 15 chương theo chiều (§3–§17) giờ đã có gate đứng sau nên cắt được — nhưng chưa làm, vì lợi ích thật chỉ **11–27%** tuỳ task và phải sửa cả cơ chế điều hướng để nạp đúng chiều theo scope. Cắt tiếp hay không là quyết định đánh đổi, không phải việc dọn dẹp.

## 2026-08-14 (d) — 15 chiều coverage của Phase 1 chưa có MÁY nào gác

**Bối cảnh.** Câu hỏi đặt ra là cắt `02_gen_testcases.md` (24,1k token) theo mục để tiết kiệm token, với điều kiện **chất lượng không được giảm**. Đo trước khi cắt, và hai con số đổi hẳn kết luận:

1. **Tiết kiệm ít hơn tưởng.** Chia mục: **12,5k (52%) là luật xuyên suốt mọi case** (cột 1–9, phân nhóm, coverage map, self-check §18, Summary Report, Export Excel) — không cắt được; chỉ **9,9k (41%)** là 15 chương theo chiều (§3–§17). Task thật dùng 5–6 chiều ⇒ bỏ được **2,6–6,6k = 11–27%**, không phải "về vài k" như tôi nói trước đó. Y hệt kết luận đã đo với `RULE_GLOBAL` (74% xuyên suốt → chỉ tiết kiệm 7–19%).
2. **Cắt bây giờ thì chất lượng CHẮC CHẮN giảm**, vì `design_gate` **không kiểm chiều nào** (chỉ `requirements`), `tc_validator` cũng không, và nhãn chiều duy nhất tồn tại là `positive/negative/edge/boundary`. Nghĩa là thứ **duy nhất** làm 15 chiều xảy ra là agent đọc được §3–§17. Cơ chế đó vốn đã yếu: §12 là BẮT BUỘC và luôn được nạp mà cả cụm bug "thiếu trường/thừa cột/lệch nhãn" vẫn lọt.

⇒ Đảo thứ tự: **dựng gate chiều trước, cắt prompt sau.**

**Added — `scripts/qa/dimension_coverage.js` (`npm run dim:coverage`)**
Đếm case theo 15 chiều trên bộ **đã sinh** rồi chặn nếu thiếu chiều mà `requirements/dimension_manifest.json` khai `required`. Đảo phụ thuộc: kiểm ở **output**, không tin agent nhớ nạp mục nào ⇒ sau này cắt prompt thì "mất text" không còn đồng nghĩa "mất chiều".

**Hai chế độ, và đây là phần quan trọng nhất:** ban đầu tôi định suy chiều từ văn bản, nhưng đo trên bộ 530 case thật thì **suy diễn không đủ tin để chặn** — recall thiếu (§5 API đếm **0** trong khi có 17 case nhắc "api") và precision kém (§12 nhận cả `[Positive] Chọn Next → hiển thị màn Confirm`, vì **"hiển thị" là động từ chuẩn của MỌI expected tiếng Việt**; nới pattern thì §12 phồng 17 → 106). Nên: chế độ **NHÃN** (case mang tag chiều) mới được `--enforce`; chế độ **GỢI Ý** thì script **tự từ chối chặn** (exit 2) kèm đường ra — chặn bằng số liệu không đáng tin là cách nhanh nhất để gate mất uy tín. `--enforce` cũng bị từ chối khi chưa có manifest, vì lúc đó không ai khai chiều nào bắt buộc.

**Bẫy tiếng Việt ghi lại để không ai đạp lại:** bỏ dấu thì `nhan` (nhãn/label) **trùng luôn `nhận`** trong "ghi nhận", "TK nhận", "HV nhận" — thêm nó vào pattern làm §12 phồng gấp 6 lần.

**Changed — `DIMENSION_TAGS` (`scripts/lib/testcase/model.js`, lib DÙNG CHUNG)**
Thêm 13 tag chiều (`validation/ui/api/export/resilience/sideeffect/guard/design/display/calc/bedata/perf/impact`) cạnh 7 tag cũ. **Additive, đã nghiệm thu trên bộ 530**: `dimensions` parse ra y nguyên `positive=393 · negative=101 · edge=19 · boundary=12`, không tag mới nào khớp nhầm (đã liệt kê toàn bộ token `[...]` đang có để kiểm — `[Constraint]`, `[Product/Combo]`, `[CX]`… đều không trùng).

**Added — §0b prompt gen (+0,5k token):** bảng chiều → tag, kèm lý do bắt buộc. Case phủ nhiều chiều thì nhiều tag; chiều n/a phải kèm **lý do** trong manifest (thiếu lý do là bị cảnh báo — bỏ chiều im lặng đúng là thứ gate này sinh ra để chặn).

**Nghiệm thu bằng fixture** (không tin suông): bộ 2 case gắn `[Display]`/`[Validation]`, manifest yêu cầu thêm `security` → gate vào chế độ NHÃN, đếm đúng, `perf: n/a` được tôn trọng, thiếu `security` → **exit 1**; cảnh báo "n/a không có lý do" cũng nổ đúng.

**Chưa làm:** bộ 530 hiện tại chưa có tag nên gate chạy ở chế độ gợi ý (báo cáo, không chặn) — nó sẽ chặn từ bộ testcase **gen mới** trở đi. Và việc cắt `02_gen_testcases.md` vẫn để ngỏ: cắt được an toàn ngay là `Phase 1 Summary Report` + `Export Excel` = **3,7k**, vì đó là hướng dẫn định dạng output cuối lượt, không phải luật nội dung case.

## 2026-08-14 (c) — spec dạng Google Sheet: đọc được mà KHÔNG cần credential

**Bối cảnh.** BA gửi spec dạng Google Sheet liên tục (bảng mapping field↔property, biểu phí, mã môn, luồng đồng bộ). Nhưng `sheet_reader.js` đi qua Sheets API nên đòi credential, và đo 14/08/2026 thì **cả ba đường đều chết**: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` rỗng · `GOOGLE_API_KEY` rỗng · token OAuth của `google_doc` chỉ có scope `documents.readonly`+`drive.readonly` mà **Drive API đang bị TẮT** ở GCP project. Kết quả: spec dạng sheet nằm ngoài tầm đọc của mọi phase.

**Added — `scripts/integrations/google_sheet/sheet_fetch_public.js`**
Tải sheet đang bật link chia sẻ về `.xlsx` qua `/export?format=xlsx` — chỉ cần quyền đọc-bằng-link, đúng dạng link BA vẫn gửi. **Chặn cái bẫy im lặng**: sheet KHÔNG chia sẻ thì Google trả **200 + HTML trang đăng nhập**, lưu ra thành "file .xlsx" hỏng và mọi bước sau báo lỗi ở chỗ khác hẳn nguyên nhân. Script kiểm magic bytes `PK` và báo đúng nguyên nhân + cách xử lý. Giới hạn ghi rõ trong header: đây là ảnh TĨNH, không có comment/suggested edit.

**Added — `scripts/convert_excel/xlsx_to_md.js`** (chiều ngược của `md_to_xlsx.js`)
`.xlsx` → Markdown đọc được: cắt vùng dữ liệu thật (sheet của BA hay 1000×30 mà chỉ ~20 dòng có dữ liệu ⇒ không cắt thì md phình toàn dấu `|` rỗng và ngốn context), giữ hyperlink dạng `[text](url)` (link trong sheet thường trỏ tới spec khác — mất link là mất đường lần tiếp, đã gặp: bảng mapping TK nhận phí nằm sau đúng một link như vậy).

**Hai lỗi tự bắt được khi chạy thật** (kể lại vì đều là lớp lỗi hay lặp):
- **Ô gộp**: bản đầu tôi *fill-down phỏng đoán* theo hàng trên → nhân bản luôn header thành `↑ ↑ ↑ STT` trên sheet 1001 dòng. Sửa: dùng metadata `cell.isMerged`/`cell.master` của ExcelJS — chính xác, không đoán.
- **Hyperlink lồng richText**: `v.text` lại là object ⇒ `String()` cho ra `[object Object]` và **mất nhãn link**. Phải gỡ thêm một lớp.

## 2026-08-14 (b) — `doc_reader` đọc Google Doc nhiều tab chỉ được TAB ĐẦU, im lặng

**Bối cảnh.** Một câu hỏi treo 4 ngày ("TK nhận phí dịch vụ xác định theo chương trình hay theo loại tài khoản thi?") tưởng là *thiếu tài liệu, phải hỏi BA*. Hoá ra tài liệu đã trả lời từ đầu — **kit không đọc được**.

`documents.get` **thiếu `includeTabsContent: true`** thì Google Docs trả về `body` của **tab ĐẦU TIÊN** và **không báo gì**: không lỗi, không cờ, không field cảnh báo.

| | Trước | Sau |
|---|---|---|
| Nội dung | 441 paragraph · **18.5 KB** | **345.6 KB** (18.6×) |
| Số tab | 1 | **15** (7 mức 1 + 8 tab con lồng) |
| Chứa quy tắc đang tìm? | **KHÔNG** (0 lần) | **CÓ** (25 lần) |

Đây là dạng hỏng tệ nhất trong việc tra tài liệu: agent đọc, không thấy, rồi kết luận **"tài liệu không quy định"** — trong khi nó nằm ở tab 4.1. Đúng loại "cắt cụt im lặng" mà `RULE_GLOBAL` cấm, nhưng lần này chính tooling của kit vi phạm.

**Fixed**
- `includeTabsContent: true` + `flattenTabs()` **đệ quy** (tab lồng qua `childTabs` — chỉ đọc mức 1 là mất 8 tab con).
- Renderer (`docToMarkdown`/`docToPlainText`) chạy trên **mọi** tab, mỗi tab một heading `## Tab: <tên>` theo độ sâu; tách `contentToMarkdown()` ra khỏi `docToMarkdown()` để dùng lại cho từng tab.
- **Log số tab + tên tab** mỗi lần đọc ⇒ nhìn output là biết đã lấy đủ hay chưa, không phải tin vào im lặng.

**Kết quả nghiệp vụ.** Rule `BR-ADDONBANK-001` ("tài khoản thi CBE ⇒ MB SAPP", nguồn: cột bình luận trong sheet bug) bị **bác bỏ bằng tài liệu gốc**: sheet mapping khai `Recipient Bank Account ← tai_khoan_nhan_phi_dich_vu` (trục **chương trình × mốc 01/01/2026**) còn loại tài khoản thi đi qua property KHÁC (`loai_phi_dich_vu`) và chỉ quyết định *loại đơn*. Ghi rule đúng `BR-RECIPBANK-001` với `covered_by` thật (`TC_133/134/135/136/360`) — hết `covered_by` rỗng. Không bug nào phải rút lại. **Bài học ghi vào rule:** lời văn trong cột bình luận của sheet bug **không ngang hàng** FSD/mapping sheet; để nó làm oracle thì lượt gen sau sinh case sai rồi log bug không tồn tại.

## 2026-08-14 — 42% lịch sử bug vô hình với risk, và bảng risk thì toàn dòng phantom

**Bối cảnh.** `risk_score` LOẠI bug không có `module` khỏi bảng (đúng chủ ý — xem §"(unmapped)"), nhưng đo thật thì **26/57 bug** đang ở diện đó vì thiếu label TC trên Jira ⇒ **log bug rồi vẫn không làm sâu thêm test lượt sau**.

**Hai cách tự động đã thử và LOẠI** (ghi lại để không ai làm lại):
- *Suy module từ tiêu đề bug*: 9 ca "trông chắc", soi ra **≥4 sai rõ ràng** (vd "Add-on Order không đồng bộ HubSpot" bị gán "Check tiền & Ghi nhận doanh thu"). Module SAI tệ hơn `(unmapped)`: nó bơm Likelihood cho module vô can VÀ vẫn để module thật mỏng.
- *Bảng tra `label → module`*: chấm trên 30 bug đã có module thật → **5/17 label đa nghĩa**, và toàn là loại phổ biến nhất (`be` trải 6 module; `re-verify`/`reopened` 3 module). Label thực tế là nhãn **quy trình**, không phải nhãn chức năng.

**Added — `scripts/qa/bug_tc_matcher.js` (`npm run bug:tc-match`): đề xuất, KHÔNG tự ghi**
Ghép bug với TC canonical bằng trùng lặp từ khoá có idf trên `module+title+steps+expected`. **Tự kiểm bằng `--all`** trên 30 bug đã map — và chính con số đó quyết định thiết kế: argmax module đúng **40%** (⇒ không cho tự chốt), module thật có trong top-12 **73%**, đúng TC trong top-12 **67%** (⇒ đủ làm danh sách ứng viên cho người đọc). Vì vậy script **không có chế độ `--apply`**.

**Added — `knowledge/bug_tc_map.json`: nguồn thứ ba, người chốt, có `basis` kiểm lại được**
Hai hạng không trộn: **A** = `tc_id` khi expected của TC nói thẳng hành vi bug phá (module lấy theo TC ⇒ không đoán); **B** = `module` + `coverage_gap` khi **không TC nào** phát biểu hành vi đó. Kết quả: **19 hạng A + 7 hạng B → 57/57 bug có module, `(unmapped)` = 0**. `learn_bugs` đọc file này SAU label/description.

**Fixed — 3 lỗ hổng lộ ra khi làm**
- **`tc_id` sai làm record đóng băng vĩnh viễn.** Nhánh backfill chỉ chạy khi `tc_id` **rỗng**, nên bug mang label mã không tồn tại (thật: `..._TC_560` khi bộ chỉ tới `TC_530`) đứng mãi ở `(unmapped)` mà nhìn record lại tưởng đã map. Giờ mã không tra ra module thì bản đồ tay **thắng**, và ghi rõ đã ghi đè mã nào.
- **Bảng risk toàn dòng phantom.** `impact.modules` khai **18 tên tiếng Anh** (Payment/Order/…) trong khi bug + snapshot dùng tên module canonical (tiếng Việt) ⇒ **17/18 dòng đầu bảng có Impact cao với 0 bug**, còn **23 module có dữ liệu thật** rơi về `Impact=default` nên band chặn trần Medium — `executeOrder` chỉ sai chỗ. Quy định *đã có* trong `_note` của `risk_model.json` ("tên module phải khớp cột `Module` của testcase") nhưng **không có máy kiểm**. Thêm cảnh báo lệch tên (chỉ nổ khi có phantom **và** có module dữ liệu thiếu Impact) + khai đủ 33 tên canonical. Sau sửa: mọi module có dữ liệu đều `config.module`, cảnh báo tắt.
- **Key `_...` trong config thành module giả.** `ensure()` chạy trên MỌI key của `impact.modules` nên thêm một dòng ghi chú là bảng mọc dòng `_canonical_note` với Impact là chuỗi. Giờ bỏ qua key `_`-prefix.

**Added — cảnh báo MẤT `bug_tc_map.json`.** Đây là store duy nhất trong `knowledge/` **không nạp lại được từ nguồn máy**. Mất file một mình chưa hỏng (record đã giữ `module`); hỏng khi mất file **rồi** nạp lại `bugs/` từ Jira. `learn_bugs` cảnh báo khi thiếu file mà đang có bug `(unmapped)` — đã nghiệm thu bằng cách gỡ file + set 1 record về `(unmapped)`.

**Added — 1 dòng vào `§12` prompt gen: field DẪN XUẤT phải bị KHOÁ theo nguồn.** 7 hạng B chia làm 3 lớp trống (chi tiết ở `coverage-gap-tu-bug-khong-co-TC.md`), trong đó lớp "conformance liệt kê CÓ field nhưng không phát biểu ràng buộc giá trị" là lỗ hổng **quy tắc** thật: case "form hiển thị đủ field X" **PASS ngay cả khi field đó cho chọn tự do** ⇒ `SAPP-28420` (modal Add Transaction cho chọn pháp nhân khác order) không TC nào bắt. Hai lớp còn lại (định dạng, chức năng không có TC) thì `§12` **đã có** quy tắc — lỗi là bộ 530 không áp dụng, nên không thêm rule trùng.

## 2026-08-13 (b) — 11 lệnh gate chưa từng được chạy, vì chỉ nằm ở tầng workflows

**Bối cảnh.** Định hướng ban đầu cho hai tầng (`prompt_templates/phaseN/` vs `.agent/workflows/`) là "co workflow lại thành bảng neo step ↔ skill". **May là đo trước khi cắt** — kế hoạch đó sẽ xoá mất một thứ không ai ngờ.

Quét lệnh (`npm run …` / `node scripts/…`) trong workflows rồi đối chiếu với `prompt_templates`: **11 lệnh gate chỉ tồn tại ở tầng workflows**, mà `run_phase2` **không trỏ tới workflow nào** và `run_phase1` chỉ nhắc 1 lần. Nghĩa là ai theo đúng điểm vào thì **không bao giờ chạy chúng**:

| Điểm vào thiếu | Lệnh vắng mặt | Hậu quả thật |
|---|---|---|
| `run_phase2` | `npm run self-review` (**G9**) | Không có lượt tự soi trước finalize — gate gộp preflight+design+row-quality+execution không chạy |
| `run_phase2` | `npm run learn -- --scan`, `npm run learn:bugs:apply` | **Đồng bộ trạng thái bug từ Jira không bao giờ chạy** ⇒ risk model tính vòng-đời-bug trên trạng thái cũ. Quan sát khớp: 9 bug local còn ghi `In Staging` trong khi Jira đã `Done`. *(Đính chính bản đầu viết "vòng học ĐỨT" — NÓI QUÁ: `learn_reporter` đã gắn sẵn trong `playwright.config.js` nên snapshot/metrics vẫn thu **tự động** sau mỗi lần chạy test. Chỉ phần **bug sync** và **backfill `--scan`** là thủ công, và chính hai cái đó vắng ở điểm vào.)* |
| `run_phase2` | `preflight_gate --mode phase2` (**G1**), `gate:output` (**G2**), `decisions:check` | Execute trên nền sai; output sai chuẩn không bị chặn; log lại đúng bug đã Rejected |
| `run_phase1` | `design:gate`, `risk:gate`, `trace:matrix`, `risk`, `domain:check`, `system:check` | Không đối chiếu độ sâu theo band rủi ro, không có ma trận REQ↔TC, không tra business rule đã xác nhận |

**Fixed**
- Thêm bảng **"Gate bắt buộc chạy"** vào cả `run_phase1` và `run_phase2`: *khi nào · lệnh · nó chặn/sinh ra gì*. Giờ đọc mỗi điểm vào là biết phải chạy gì, không cần biết tầng workflows tồn tại.

**Added — `gate:policy` chặn lệnh gate chỉ-nằm-ở-workflow**
Mọi `npm run …`/`node scripts/…` xuất hiện trong `.agent/workflows/phaseN_*` phải có mặt ở `run_phase{N}` tương ứng. **Phân giải bí danh qua `package.json`** — `npm run trace:matrix` và `node scripts/qa/traceability_matrix.js` được coi là MỘT, nếu không thì cùng một gate viết hai kiểu sẽ báo thiếu oan (đo thật: 2/4 "thiếu" ban đầu chỉ là bí danh). Nghiệm thu: thêm `npm run reliability` vào một workflow → exit 1 đúng thông báo → hoàn nguyên → xanh.

**Chưa làm — và lý do đổi ý:** *không* co tầng workflows nữa. Chúng không phải bản trùng của `prompt_templates` mà là **nơi chứa chi tiết từng bước + lệnh gate**; co lại là mất nội dung thật. Quan hệ đúng của hai tầng giờ là canonical/digest có máy kiểm — y như `RULE_GLOBAL.md` ↔ `core_rules.md`.

## 2026-08-13 — `run_phase*` thành ĐIỂM VÀO thật: chỉ đọc 1 file là đủ điều hướng

**Bối cảnh.** Câu hỏi: "thay vì bắt đọc từng bước, chỉ bắt đọc `run_phase` thì có hợp lý không?". Đo trước khi trả lời — và hoá ra hợp lý về nguyên tắc nhưng **làm ngay lúc đó thì mất 47KB kỷ luật execute**: `run_phase2_template.md` **không hề trỏ** tới `04_execute_fe_playwright.md` (264 dòng) lẫn `05_execute_api_playwright.md` (135 dòng). Ai chỉ đọc `run_phase2` là execute mà thiếu toàn bộ phản xạ điều tra `qa_instincts`, luật khoanh tầng lỗi FE/BE, oracle mapping phải nêu cả hai giá trị, yêu cầu chạy `ui_conformance_check` và chuẩn evidence. Nghịch lý cho thấy tầng điều hướng hỏng: thứ **duy nhất** trỏ tới prompt execute FE lại là `.agent/rules/qa_instincts.md` — một file *rule* dẫn tới *prompt*, còn bản điều phối thì không.

Đo tổng: **8/11 prompt bước mồ côi** khỏi `run_phase`, trong đó **4 cái không nơi nào trỏ tới** (`01_setup_engine_fetch_docs`, `03_gen_test_data`, `05_manual_quick`, `06_triage_review`).

**Added — bảng "Bản đồ prompt" ở đầu mỗi `run_phase`**
- Mỗi prompt bước có 1 dòng: **bắt buộc hay không** + **mở khi nào**. Phân biệt rõ 3 loại thay vì gộp làm một: *bước chính bắt buộc* (`02_gen_testcases`, `04_auto_publish_jira`, hai executor, `08_log_bug_jira`), *nhánh thay thế* (`05_manual_quick` — chỉ khi cần TC chạy tay, requirement đã rõ), *công cụ khi cần* (`03_gen_test_data`, `06_cross_module`, `06_triage_review`, `07_triage_flaky` — bản thân 2 file triage đã tự khai "không bắt buộc").
- **Chọn ROUTER chứ không GỘP**, vì gộp thì riêng `02_gen_testcases.md` đã **89KB/844 dòng** — mọi session Phase 1 phải gánh nó kể cả khi chỉ chạy bước publish. Router thì đọc `run_phase2` (350 dòng) + đúng executor đang dùng (264 FE *hoặc* 135 API) thay vì cả 1087 dòng của phase 2 — rẻ hơn ~40% và nạp đúng lúc cần.
- Con trỏ đặt **ở cả bảng đầu file lẫn ngay tại bước** (`run_phase2` bước 3 ghi "MỞ NGAY BÂY GIỜ", không để đọc sau khi đã viết script xong). `run_phase_re-run_template.md` cũng nối vào 2 executor + `07_triage_flaky` trước khi tới `08_log_bug_jira`.

**Added — `gate:policy` chặn prompt bước mồ côi**
Mọi `prompt_templates/phase*/*.md` phải có đường vào từ một `run_phase*`. Trỏ được qua `.agent/workflows/` hoặc SKILL thì tính là hợp lệ nhưng **hạ xuống cảnh báo** (đến được nhưng người đọc `run_phase` không thấy). Cùng khuôn với gate rule-mồ-côi. Nghiệm thu: tạo `99_zz_dummy.md` → exit 1 đúng thông báo → xoá → xanh. Sau khi vá: **11/11 prompt đều có đường vào**.

**Chưa làm (chờ định hướng):** `prompt_templates/phaseN/` và `.agent/workflows/phaseN_NN_*` (15 file) đang là **hai tầng cùng mô tả "các bước của phase"** — mùi kiến trúc thật, nhưng gộp/tách là quyết định động vào cách chạy task nên tách riêng.

## 2026-08-12 (g) — chiều "bền vững dữ liệu sau mutation": kiểm tầng bản ghi, không đẻ TC mới

**Bối cảnh (đo, không phỏng đoán).** Câu hỏi "gen testcase đã có case kiểm DB chưa?" → **chưa, 0/1901 TC**. Chuỗi `db_readonly` xuất hiện **0 lần** trong toàn bộ `outputs/`, kể cả ở cột `Setup Verification` mà prompt vốn đã mời dùng. Trên bộ lớn nhất (563 TC): **415 case mutation**, **177 (43%)** có đọc lại — nhưng đọc lại qua **chính đường đọc của app** (list/detail/`GET`/HubSpot), tức *cùng một stack vừa ghi tự nói là đã ghi*.

Năng lực thì có sẵn và chặt: `uatPgClient.ts` mở `BEGIN TRANSACTION READ ONLY` (Postgres tự chặn INSERT/UPDATE/DDL kể cả khi DB user full quyền), lint chặn `pg_read_file`/`lo_export`/`EXPLAIN ANALYZE`/stacked query, `statement_timeout`, allowlist host. `RULE_GLOBAL` cũng đã cho phép ("DB là oracle **PHỤ**"). Khoảng trống nằm đúng ở chỗ: **lúc gen không có chiều nào bắt nghĩ tới**.

**Added — prompt gen §13b "Bền vững dữ liệu sau mutation"**
- **KHÔNG tạo TC riêng cho việc kiểm DB** — chỉ thêm một dòng verification (`db_readonly: SELECT … FROM … WHERE …` + kết quả cụ thể) vào chính case create/edit/delete đã có. Rải khắp nơi làm test dính schema, đổi tên cột là gãy hàng loạt.
- Chỉ **5 tình huống** kích hoạt, đều là chỗ UI/API *không thể* phân biệt: **soft vs hard delete** (xoá xong UI hết thấy và `GET` 404 y hệt nhau ở cả hai kiểu) · **cascade/bản ghi mồ côi** (màn cha không hiển thị bản ghi con) · **field không render** (`sync_status`, cột audit) · **ghi trùng** (lưới có phân trang/sort/filter nên dễ không thấy; `count(*)` thấy ngay) · **trường dẫn xuất lệch bản ghi gốc** (đúng lớp bug ledger 1 giao dịch mà `total_due` trừ 2 lần).
- Ranh giới giữ nguyên: read-only qua guarded client, **không** dựng state, **không** phải evidence, **không** thay oracle từ spec, mask PII. Kèm cảnh báo ngược: **DB đúng ≠ sản phẩm đúng** — assert DB xanh rất dễ ru ngủ và che bug FE, nên nó **bổ sung** chứ không thay assert trên UI.
- §9 `Setup Verification` thêm con trỏ phân biệt "verify tiền điều kiện đã dựng xong" vs "verify kết quả sau mutation".

**Added — `design_gate` cảnh báo (không chặn)**
Bộ có case **XOÁ** mà không case nào dùng `db_readonly` → nhắc §13b. Mức cảnh báo vì công cụ không biết case đó có thật sự cần xuống tầng bản ghi hay không (nhiều "xoá" chỉ là gỡ item khỏi form). Đo trước khi chọn: **11/17 bộ** có case xoá thật, cả 11 đều chưa dùng `db_readonly` — một dòng nhắc mỗi bộ, không phải tiếng ồn theo từng dòng. **Cố ý loại "huỷ/cancel"**: đo ra 111/131 case ở bộ time-off khớp chữ "huỷ" nhưng đó là chuyển TRẠNG THÁI, không phải xoá bản ghi — nếu không loại thì cảnh báo thành rác. Nghiệm thu: bộ 530 TC → cảnh báo đúng `45 case XOÁ`; bộ không có case xoá → im.

## 2026-08-12 (f) — vá advisory `brace-expansion` + khoá tên skill bằng gate

**Fixed**
- **`audit:ci` đỏ thật** (`exit 1`): `brace-expansion` dính advisory DoS (unbounded expansion → OOM). Đo hiện trạng: `low 0 · moderate 2 · **high 1** · critical 0`. `npm audit fix` xử sạch phần `high`; `package.json` **không đổi** (chỉ transitive), `package-lock.json` lệch 24 dòng. Sau vá: `high 0`, `audit:ci` exit 0. Còn 2 `moderate` trong `exceljs` — chưa chạm vì gate chỉ chặn từ `high` và bản vá của nó cần bump major.
- **Bẫy gặp khi vá, ghi lại để không mắc lại**: `npm audit fix --omit=dev` **xoá luôn devDependencies khỏi `node_modules`** (mất `typescript`, `eslint`) ⇒ `typecheck` và `lint` chuyển đỏ ngay sau đó, trông y như bản vá làm hỏng code. Không phải vậy — chạy `npm install` là khôi phục, bản vá vẫn giữ. Nếu chỉ nhìn "audit xanh rồi" mà không chạy lại toàn bộ gate thì sẽ đẩy một môi trường hỏng lên CI.
- **5/21 skill lệch frontmatter `name` với tên thư mục** (`git_impact_analyzer` ghi `git-impact-analyzer`, tương tự `requirements_analyzer`, `locator_healing_agent`, `qa_automation_engineer`, `learning_recorder`). Tra cứu skill dùng **tên thư mục** — đó là tên prompt/workflow/`INDEX.md` nhắc tới — nên frontmatter lệch làm người đọc file tưởng skill tên khác. Đã đồng bộ cả 5 + sinh lại `INDEX.md` (21 skill, hết cảnh báo). Kiểm trước khi sửa: không consumer nào trỏ bằng tên gạch-ngang (chỉ chính dòng cảnh báo trong `INDEX.md` và 1 comment) nên đổi là an toàn.

**Added**
- **`gate:policy` chặn skill lệch tên.** `skills_index.js` phát hiện được chuyện này từ lâu nhưng **chỉ cảnh báo, exit 0**, nên 5 skill lệch tồn đọng mãi — đúng bài học "quy ước không có máy chặn thì không tự khỏi". Blast radius sau khi dọn = 0 nên chặn là an toàn. Nghiệm thu: đổi tạm 1 skill về gạch-ngang → exit 1 kèm đúng thông báo → hoàn nguyên → xanh.

**Nghiệm thu chung:** `audit:ci` · `typecheck` · `lint` · `secret:scan` · `gate:policy` · `preflight` đều exit 0; infra 26/26.

## 2026-08-12 (e) — `knowledge/` thành dữ liệu công ty, không commit; và LICENSE sai chủ sở hữu

**Bối cảnh.** Rà `LICENSE` thì phát hiện nó vào repo từ commit baseline đầu tiên (`1dbe982`) và **chưa ai sửa**, nên vẫn mang tên chủ sở hữu của template scaffold gốc. Kiểm rộng ra thì lộ việc quan trọng hơn: **mirror GitHub đang PUBLIC** (`gh repo view` → `visibility: PUBLIC`, `licenseInfo: mit`), tức mọi thứ tracked đang công khai dưới MIT.

**Fixed**
- `LICENSE`: đặt lại chủ sở hữu → `SAPP - Nguyễn Hùng Mạnh`. **Không** đổi loại giấy phép (vẫn MIT) — đó là quyết định của chủ sở hữu, không phải việc của kit.
- **`knowledge/**` không còn được commit.** Mọi store trong đó là thông tin nội bộ của dự án đang test, không phải phần "kit": `bugs/` tiêu đề defect sản phẩm (và tên FILE sinh từ slug tiêu đề nên **chính đường dẫn đã mô tả defect**), `domain/` + `system/` business rule & bản đồ hệ thống, `locators/` selector của app, `historical_execution/` + `metrics/` lịch sử pass/fail kèm tên testcase, `examples/` là bug thật backfill từ task cũ (`SAPP-26276`) chứ không phải mẫu generic. Repo giữ lại **`SCHEMA.md`** (đã có 8 khối JSON mẫu `PROJ-123` nên hình dạng entry vẫn được tài liệu hoá) + các `.gitkeep`.
- **`index.json` cũng bị loại** — giữ nó là chỉ bịt một nửa, vì trường `file` của 44 entry `bug` chứa đúng slug tiêu đề defect. Kèm theo: `learn_bugs` **thôi ghi entry `type: 'bug'`** vào index và dọn sạch entry cũ — đã kiểm toàn bộ reader của index, **không nơi nào lọc `type === 'bug'`**, entry đó là ghi-mà-không-ai-đọc (`risk_score` và `decisions` đọc thẳng thư mục).
- **`preflight_gate`: `knowledge/index.json` từ `require` → `recommend`.** Nó là artifact SINH RA (`domain:index`/`system:index`/`decisions --index`/`learn --scan`); gate đòi một file generated + không-commit thì clone mới và CI sẽ đỏ vì thiếu **dữ liệu**, không phải thiếu **khung** — đúng kiểu false-block mà comment ngay trên manifest đã cảnh báo.

**Nghiệm thu bản clone mới** (dời sạch 72 file dữ liệu ra ngoài rồi chạy đúng bộ gate của CI): `preflight` · `lint` · `typecheck` · `secret:scan` · `gate:policy` · `risk` · `dashboard` **đều exit 0**; `risk` báo trung thực `(0 bug, 10 snapshot làm dữ liệu)` thay vì âm thầm coi như không có rủi ro. Dữ liệu đã hoàn nguyên đủ, không mất file nào (`root_causes/` và `locators/` vốn chỉ có `.gitkeep`).

**Đã soát cái gì KHÔNG lộ:** `outputs/` chỉ track `.gitkeep` (không có task data nào), `profiles/` chỉ track `task.env.example`, `reports/` không track, `secret:scan` xanh, và không có email/SĐT khách thật trong file tracked (các hit chỉ là email maintainer trong `package-lock.json` + mẫu tổng hợp `user@domain.tld`).

## 2026-08-12 (d) — rule "phải bắt API trước khi gán tầng FE/BE" có máy đứng sau

**Bối cảnh.** Khối rule phân tầng FE/BE (`RULE_GLOBAL` §Phân tầng lỗi + dòng digest G4b trong `core_rules` + mục `beVsFe` trong `verdict_taxonomy.json`) đang nằm chưa commit, và cả hai tài liệu gọi `beVsFe` là *"chi tiết máy-đọc"*. Grep ra: **không script nào đọc `beVsFe`** — nó là dữ liệu chết, còn `output_gate` thì chỉ chặn FAIL *không nêu tầng*, chứ không kiểm việc tầng đó có được **chứng minh bằng API** hay không. Tức là rule mạnh nhất của khối đang ở đúng trạng thái mà cả đợt này đi sửa: quy ước không có forcing function, lại còn tự nhận là đã có.

**Added**
- **`output_rules.lintBeVsFeLayer`** — bug có prefix `[FE]`/`[BE]` (đã gán tầng) mà description KHÔNG có dấu vết API cụ thể (method+path, `/api/v…`, `endpoint`/`swagger`/`curl`/`payload`, hoặc mã status **có từ ngữ cảnh**) ⇒ nêu ra. Lời nhắc lấy **từ `beVsFe.howTo`** trong JSON nên config thành nguồn thật, không còn là mục nằm không. Module giữ nguyên tính thuần: config **truyền vào**, không tự đọc file.
- **`output_gate.gateBugWarnings`** — kênh cảnh báo riêng cho mode bug. Cố ý **không** đổi chữ ký `gateBug` vì `bug_reporter.js` đang gọi nó và mong nhận mảng string.
- **`tests/fe/infra/bug-layer-gate.spec.ts`** (6 ca, tổng infra 26/26).

**Mức: CẢNH BÁO, không chặn — đo trước khi chọn.** Chạy luật lên **99 bug auto-bug thật** trên Jira: cả 99 đều có gán tầng, trong đó **71 (72%)** không có dấu vết API trong description. Chặn ngay là đỏ oan gần ba phần tư. Theo tiền lệ `locator_lint`: cảnh báo trước, siết sau khi thói quen đã đổi.

**Fixed (lỗi của chính luật này, do test bắt được)**
- `STATUS_CODE` bản đầu dùng `[45]\d\d` trần ⇒ **số tiền Việt `5.400.000đ` khớp cụm `400`** (đứng sau dấu chấm nên vẫn thoả `\b`) ⇒ bug chỉ nói về số tiền bị coi là "đã bắt API" và **lọt** cảnh báo. Giờ mã status phải có từ ngữ cảnh (`HTTP`/`status`/`mã lỗi`/`trả về`). Bỏ luôn `\bresponse\b` trần khỏi `API_TRACE` vì từ đó xuất hiện trong văn xuôi quá dễ. Con số blast radius báo ở trên là con số **sau** khi sửa (67% → 72%).

## 2026-08-12 (c) — rule mồ côi bị chặn bằng máy, và `.agent/rules/` tự giải thích được mình

**Bối cảnh.** Rà tiếp cấu trúc rule sau câu hỏi "sao có cả folder `rules` lẫn `RULE_GLOBAL.md`". Kết luận về tầng hoá: **giữ nguyên 3 tầng** (`CLAUDE.md` auto-load → `core_rules.md` digest → `RULE_GLOBAL.md` canonical) vì mỗi tầng bị một ràng buộc khác, gộp đằng nào cũng lỗ; và **không** dời `RULE_GLOBAL.md` vào `.agent/rules/` vì đang bị 20+ file trỏ tới (kể cả `.claude/settings.json`, task doc trong `outputs/`). Nhưng phần **playbook** thì có lỗ thật.

**Fixed — 2 rule mồ côi, và bản thứ hai không ai canh**
- Đo số nơi *thực sự dẫn agent tới đọc* từng file trong `.agent/rules/`: `qa_instincts` (4 nơi), `locator_strategy` (skill + **`self_review.js`** trích khi chặn), `locator_healing_policy` (skill + workflow) đều ổn — nhưng **`playwright_fe.md` và `playwright_api.md` chỉ được `AUDIT_REFERENCES.md`** nhắc tới, mà file đó tự khai là *bản kiểm kê*, không đưa ai tới đọc. Tệ hơn: chính `prompt_templates/phase2/04_execute_fe_playwright.md` — nơi cần chúng nhất — lại **tự chép lại** một phần rule của chúng (POM, `waitForTimeout`, thứ tự ưu tiên locator) ⇒ tồn tại bản thứ hai, không ai canh, drift âm thầm.
- Nối lại theo đúng cách `qa_instincts` đang được nối: prompt `04` và `05` mở section kỹ thuật bằng khối **"Playbook bắt buộc đọc"**, gọi tên đúng phần prompt KHÔNG nhắc lại (§Assertions + §Anti-Patterns của `playwright_api.md`; §Wait Strategy + §Test Structure của `playwright_fe.md`). Bỏ chuỗi ưu tiên locator chép tay trong prompt → trỏ về bảng §Priority của `locator_strategy.md` (danh sách CÓ THỨ TỰ là loại dễ drift nhất). Nuance "chờ ngắn chỉ để ổn định ảnh evidence" chuyển **vào** `playwright_fe.md` để không mất khi bỏ bản chép.

**Added**
- **`gate:policy` chặn rule mồ côi.** Mỗi `.agent/rules/*.md` phải được ít nhất một chỗ trong `prompt_templates/`, `.agent/skills/`, `.agent/workflows/`, `scripts/`, `exploratory/` hoặc `CLAUDE.md` trỏ tới. **Cố ý KHÔNG tính `AUDIT_REFERENCES.md` và `CHANGELOG.md`** — nhắc tên mà không đưa ai tới đọc thì không phải consumer. Cùng lớp vấn đề mà `.agent/skills/INDEX.md` đã chống cho skill, nay chống cho rule. Nghiệm thu: tạo `zz_dummy_orphan.md` → exit 1 đúng thông báo → xoá → xanh.
- **`.agent/rules/README.md`** — dòng đầu nói thẳng đây *không* phải bộ rule đầy đủ và canonical ở root; bảng phân biệt 1 policy vs 5 playbook kèm **ai dẫn tới đọc**; và 3 điều `gate:policy` sẽ chặn khi thêm file mới. Câu trả lời sẵn cho người tiếp theo mở thư mục này.

## 2026-08-12 (b) — `policy_source_check` canh cả `CLAUDE.md`, và danh sách đuôi evidence chỉ còn 1 nguồn

**Bối cảnh.** Câu hỏi "sao có cả folder `rules` lẫn `RULE_GLOBAL.md`?" hoá ra chạm một lỗ thật. Cấu trúc 3 tầng là có chủ ý — `CLAUDE.md` (12 dòng, Claude Code **tự nạp mọi session**) → `.agent/rules/core_rules.md` (digest, mỗi bullet trỏ `(Đầy đủ: RULE_GLOBAL §…)`) → `RULE_GLOBAL.md` (canonical, 291 dòng) — và `policy_source_check` (F3) vốn đã canh tầng 2↔3. Nhưng nó **không kiểm tầng 1**, đúng cái tầng luôn ở trong ngữ cảnh nên lệch ở đó ảnh hưởng lớn nhất. *(Lưu ý: 5/6 file trong `.agent/rules/` là playbook theo chủ đề — locator, playwright FE/API, qa_instincts — không trùng gì; chỉ `core_rules.md` mới cùng phạm vi với `RULE_GLOBAL.md`.)*

**Fixed — cùng một danh sách nằm ở 5 nơi với 4 nội dung khác nhau**
- `CLAUDE.md`: `png/jpg/webp` (**thiếu `.jpeg`**) · `core_rules.md` + `RULE_GLOBAL.md`: `png/jpg/jpeg/webp` · **thông báo lỗi** của `output_gate`: `png/jpg/webp/gif` · **code thực thi** `output_rules.VISUAL_EXT`: `png/jpe?g/webp/gif/bmp/mp4/webm/mov/m4v`. Tức `.jpeg` bị tầng auto-load cấm nhưng máy cho qua, còn `.mov/.m4v/.bmp` máy cho qua mà không tài liệu nào nhắc — và `output_gate` in ra danh sách khác chính code của nó.
- `VISUAL_EXT`/`VIDEO_EXT` giờ **export** kèm `extListText()` **sinh danh sách cho người đọc TỪ regex**; `output_gate` in từ đó thay vì viết tay.
- `policy_source_check` thêm: `CLAUDE.md` phải trỏ `RULE_GLOBAL.md`; và **so danh sách đuôi trong cả 3 tài liệu với hằng số trong code** — nêu đuôi code không nhận, hoặc nêu `.jpg` mà thiếu `.jpeg`, là **CHẶN**. Gate chạy thử: bắt đúng `CLAUDE.md` thiếu `.jpeg` → sửa → xanh. Đã có sẵn trong `.gitlab-ci.yml` + `static-check.yml` nên hiệu lực ngay.

**Đã chốt — siết danh sách về `png/jpg/jpeg/webp` + `mp4/webm`.** Tiêu chí chọn không phải "có phải ảnh không" mà là **reviewer xem được NGAY trong Jira, không phải tải về**: `.bmp/.mov/.m4v` vốn không có mime trong uploader nên đi Jira dưới dạng `application/octet-stream` ⇒ không preview ⇒ evidence mất tác dụng; `.gif` preview được nhưng 256 màu làm bệt khung đỏ + nhãn, mà chuỗi thao tác đã có luật bắt **video** riêng. Đo trước khi siết: 2224 file evidence thật gồm **png 2182 · webm 28 · jpg 14 · gif/bmp/mov/m4v = 0** ⇒ blast radius bằng 0. Siết xong tài liệu và code khớp tuyệt đối (`RULE_GLOBAL` vốn đã ghi đúng danh sách này).
- **Mime map gộp về 1 nguồn.** `push_test_execution.contentTypeOf` từng là bản chép tay riêng — chính chỗ đó cho phép "gate nhận đuôi mà uploader không gắn nổi nhãn". Giờ `MIME_BY_EXT`/`mimeOf` ở `output_rules` và uploader gọi vào đó.
- **Ràng buộc mới có máy giữ:** mọi đuôi `VISUAL_EXT` cho qua **phải có mime thật**; thiếu là `gate:policy` CHẶN. Đã nghiệm thu bằng cách cố tình thêm `.bmp` → exit 1 kèm đúng thông báo → hoàn nguyên → xanh.

## 2026-08-12 — `learn_bugs` nhận dạng bug theo Jira key, không theo tiêu đề

**Bối cảnh.** Định dùng `knowledge/bugs` làm danh sách bug cần re-verify thì phát hiện chính dữ liệu đó sai: hai record khác nhau cùng `id`, và một bug Jira đã `Done` mà local vẫn ghi `In Staging`.

**Fixed**
- **Danh tính bug = `slugify(summary)`.** Record được tìm bằng tên file `TASK__slug-tiêu-đề.json`, nên **sửa tiêu đề bug trên Jira là slug đổi ⇒ coi như bug mới ⇒ tạo record trùng**, còn record cũ bị bỏ rơi và **đóng băng trạng thái mãi mãi**. Hậu quả không nhìn thấy được: `risk_score` đếm 1 bug thành 2 (Likelihood phồng) và **vòng đời bug** (weight theo `jira_status` + decay) tính trên trạng thái sai — tức hai cơ chế vừa xây xong đều đang ăn dữ liệu bẩn. Giờ khớp theo **`id` = Jira key** (bất biến), quét cả thư mục để lập chỉ mục theo id; tiêu đề đổi thì **cập nhật tại chỗ** và ghi rõ dòng `✎`. Đo: `mới 3 → 2` (một cái là `SAPP-28420` đổi tiêu đề, đã có record).
- **Cảnh báo id trùng.** Trước đây trùng id không ai biết. Giờ báo to kèm tên 2 file. Dọn thật 1 cặp: record "[FE] Combo Version History filter Product" chính là **Vấn đề 3 của cùng ticket `SAPP-28395`** bị ghi thành bug riêng.
- **Log đồng bộ vô dụng: in `X → X`.** Gán `cur.jira_status = jiraStatus` **trước** khi dựng câu log nên old/new luôn giống nhau (`Done → Done`, `In Staging → In Staging`) — không đọc được gì đã đổi. Giờ chụp giá trị cũ trước khi gán. Lộ ngay **9 bug đã chuyển `Done`** mà local còn giữ `In Staging`.
- **Index bug không dọn entry mồ côi + không cập nhật `status`.** Khối ghi `index.json` chạy dưới điều kiện `APPLY && created.length` nên lượt chỉ-xoá hoặc chỉ-đổi-trạng-thái không chạm index ⇒ index trỏ vào file đã xoá và giữ `status` cũ. Giờ điều kiện là `APPLY`, dọn entry `type: 'bug'` trỏ file không tồn tại (đồng nhất với indexer domain/system/decisions đã có), và cập nhật cả record vừa đổi trạng thái. Dọn thật 1 entry mồ côi → index 62 entry, 0 mồ côi.

**Ý nghĩa thực tế:** danh sách "bug cần re-verify" từ 13 (dữ liệu local) về **1** (`SAPP-28411`, In Staging) — 9 cái đã `Done`, 3 cái dev chưa deploy, 1 cái Rejected đã có quyết định giải thích. Nếu tin dữ liệu cũ thì sẽ đi test lại 9 bug đã xong.

## 2026-08-11 — `ui_conformance_check` dùng được trên màn thật, và không được phép báo cáo sai

**Bối cảnh.** Đem khối `fields` ra chạy thật trên 5 màn của một task UAT (lượt 2, sau lượt 1 chỉ phủ 2 lưới). Ba lỗ hổng lộ ra ngay, đều thuộc kiểu **công cụ trả về số liệu trông như thật nhưng là rác** — nguy hơn công cụ báo lỗi.

**Fixed**
- **Login rỗng vẫn chạy tiếp ⇒ 26 deviation GIẢ.** Chạy thiếu `TASK_ENV` nên env rơi về `.env` (không có creds OPS), `page.fill` nhận chuỗi rỗng, app đứng ở màn login, và mọi màn sau đó đọc ra **0 cột / 0 field** → report in ra "thiếu toàn bộ cột" y hệt một app hỏng thật. Giờ `login()` **chặn sớm 2 lớp**: creds rỗng → lỗi ngay (kèm hướng dẫn truyền `TASK_ENV`); submit xong còn thấy ô password → lỗi "vẫn ở màn login, ĐỪNG đọc report lần này" (bắt cả sai creds lẫn throttle/lockout).
- **Fatal giữa đường vẫn `exit 0`.** Chưa đo được màn nào thì `totalDeviations = 0` ⇒ exit 0 ⇒ trông như PASS. Giờ fatal → **exit 2** (`0` khớp · `1` có deviation · `2` KHÔNG ĐO ĐƯỢC). Đúng nguyên tắc "không phán được KHÔNG thành PASS".
- **Lệch hoa/thường sinh cả `missing` lẫn `extra`.** `Full Name` vs `Full name`, `Số CCCD/Hộ chiếu` vs `Số CCCD/ Hộ chiếu` — mỗi lệch chữ ra 2 dòng, nhấn chìm tín hiệu thật (thiếu field, sai NGÔN NGỮ nhãn). Giờ so khớp theo khoá chuẩn hoá, lệch chữ gom **1 dòng `fields.label-text`/section**. Trên màn thật: 5 dòng nhiễu → còn 2 phát hiện thật (`Address` vs `Địa chỉ` giữa 2 màn; `Phone` vs `Phone number`).

**Added**
- **`fields[].headingText`** — neo section theo **tiêu đề đang hiển thị** thay vì selector. Section trên màn detail render bằng `div` không class ổn định nên khai selector là giòn, mà CSS thuần không chọn được theo text (`:has-text()` là selector riêng Playwright, `document.querySelector` không hiểu). Tool resolve trong trang → dán `data-uicheck` → chọn bằng CSS thuần. Chọn tổ tiên có **nhiều hàng nhãn→giá trị nhất** trong 6 cấp (lấy cả card thì dính field khối khác ⇒ báo thừa oan; lấy quá hẹp ⇒ báo thiếu oan).
- **Fallback đọc nhãn cho layout div** — section không có `<label>` nào thì selector chặt trả rỗng và **mọi field bị báo thiếu**. Rơi về cặp leaf-node liền kề (cùng cách `screen_snapshot` xử layout div), chỉ khi catalog không tự khai `labelSelector`.
- **Kênh `info.*`** — ghi chú cách đo (vd `info.loose-labels`), in ra report nhưng **không tính deviation**; nếu tính thì gate đỏ vì cách render của FE, không phải vì lỗi.
- Regression `tests/fe/infra/field-inventory.spec.ts` +2 ca (13/13 xanh): layout div neo theo `headingText` phải thiếu **đúng 1 field** chứ không thiếu hết; `headingText` không có trên màn → `fields.no-container` chứ không âm thầm bỏ qua section.
- `scripts/qa/README.md` — tài liệu hoá khối `fields[]` (trước đây có code mà không có doc), bảng loại deviation đầy đủ, **mã thoát**, và nhắc truyền `TASK_ENV`.

**Fixed — mắt xích HỌC bị đứt bởi một file lock của Excel**
- `learn_task` / `domain_rules` / `system_map` quét `test-cases/*.xlsx` và ăn phải **`~$tên.xlsx`** — file LOCK do Excel sinh ra khi workbook đang mở, không phải zip. ExcelJS ném lỗi **async** nên lọt khỏi `try/catch` sync và **giết cả tiến trình**: `learn:bugs:apply` chết ngay, không thu được gì. Giờ bỏ qua `~$*` / `.~*`.
- Cùng chỗ đó lộ ra lỗi **im lặng** nặng hơn: `parseXlsx` là **async** mà cả 3 hàm gọi đều **sync, không `await`** ⇒ `doc` là Promise, `doc.tests` luôn `undefined` ⇒ **đường xlsx chưa từng đóng góp gì** cho map module / tập TC ID mà không báo một chữ. Đo blast radius: **mọi task có `.xlsx` đều có `.md` kèm** nên chưa mất dữ liệu — nhưng task nào chỉ có `.xlsx` là gate mù mà không ai biết. Giờ phát hiện thenable → **cảnh báo to** nêu rõ file bị bỏ và phải dùng bản `.md`. (Sửa tận gốc = chuyển 3 hàm + chỗ gọi top-level sang async; ghi lại trong comment để không rơi.)
- Sau khi vá: `learn:bugs:apply` chạy được → **+11 bug record**, đồng bộ 2 trạng thái (SAPP-28365 `Rejected` → `Done`, xác nhận trực tiếp trên Jira). `decisions:check` từ "1 bug Rejected chưa có lý do" về **sạch**. `risk` chạy trên 43 bug · 100 module · 9 High, và vẫn nói thẳng 23 bug chưa map module.

**Kết quả trên màn thật:** 2 section khớp spec 100% (Order Amount 6/6; Add-on Product Info 4/4 — xác nhận một bug "thiếu Net Price" đã được fix), 4 phát hiện mới về lệch nhãn/điều kiện hiển thị, và **2 nghi vấn bị loại bằng dữ liệu trước khi thành bug oan** (địa chỉ nghi đọc từ property `d_o_b`: hoá ra tài liệu ghi sai tên property, app đúng).

## 2026-08-10 (b) — Bịt 4 lỗ hổng làm lọt cụm bug BE↔FE mapping và UI

**Bối cảnh (đo, không phỏng đoán).** Đối chiếu 26 bug trong sheet tổng hợp của một dự án thật với 25 bug automation đã log. *(Đính chính 2026-08-11: bản đầu ghi "bắt 8 / lọt 13" — SAI. QA xác nhận **cả 26 bug trong sheet đều do người tìm**, không phải automation; nhãn `auto-bug` chỉ chứng minh bug được TẠO qua tooling của kit, không chứng minh ai PHÁT HIỆN. Không có dữ liệu "ai tìm ra" thì **không được báo tỷ lệ phát hiện** — phần dưới giữ nguyên vì 4 cụm nguyên nhân được suy từ NỘI DUNG bug, không phụ thuộc con số đó.)* 26 bug gom thành 4 cụm có nguyên nhân hệ thống. Điểm chung cay đắng: prompt §12/§14 **vốn đã yêu cầu đúng** những thứ này, nhưng không có gì kiểm việc có làm hay không — bộ 530 case thật chỉ **12%** là case hiển thị, không ai dựng catalog, và `field_mapping*.md` nằm sẵn trong task mà chưa từng dùng để so từng field. Nên lần này **mỗi yêu cầu đều kèm artifact kiểm được hoặc gate chặn**.

**Added**
- `ui_conformance_check` — khối **`fields`**: kiểm kê **TẬP field của một section** (missing / extra / order; `mode: superset` khi catalog mới trích một phần). `table` chỉ phủ cột bảng, `texts` chỉ kiểm từng nhãn đã biết ⇒ cả hai **không** phát hiện được "section thiếu một trường" hay "màn mọc thêm trường lạ". Guard CLI (`require.main`) + export `checkScreen` để test được. Regression `tests/fe/infra/field-inventory.spec.ts` (5/5) tái tạo đúng 2 bug đã lọt + ca hai màn lệch nhãn.
- `output_rules.lintMappingOracle` (cắm vào `output_gate`) — **CHẶN** kết luận mapping/đồng bộ ở mức "có dữ liệu" (`populate` / `map đủ field` / `hiển thị đúng`), **CẢNH BÁO** khi chỉ liệt kê giá trị một phía rồi kết luận `sync_status = SUCCESS`; miễn cho case negative có mã lỗi cụ thể. Field lấy **nhầm nguồn vẫn populate** — đó là lý do lớp bug này PASS mãi. Đo: 119 case mapping đã PASS → **16 chặn · 74 cảnh báo**.
- `output_rules.lintStrayAnomaly` (cắm vào `output_gate`) — case **PASS** có từ nghi vấn (`nghi`, `có vẻ`, `chưa rõ`, `cần xác nhận`…) mà không trỏ tới **bug Jira** / **câu hỏi BA-Dev** / **`DEC-*`** = CHẶN. Đã xảy ra thật: ghi chú "nghi thiếu cấu hình X" nằm lại trong comment, sau đó chính chỗ đó là bug do người khác tìm. Đo: **6/497** case PASS (1,2%) — đủ ít để không thành tiếng ồn.
- `self_review` check #7 **vùng chưa kiểm** — có case SKIP/BLOCKED/TO-DO thì phải có mục "Vùng chưa kiểm" trong `reports/*.md` **hoặc** quyết định `test_approach` trong `knowledge/decisions` phủ chúng; không có = CHẶN. Chống đúng ca đã mất cả một họ màn hình vì gặp tường fixture rồi đi tiếp trong khi báo cáo vẫn xanh.

- `design_gate` — bộ testcase có case hiển thị mà THIẾU `requirements/ui_catalog.json` = **CHẶN** (catalog rỗng hoặc màn chưa khai `expectedColumns`/`fields[]` cũng báo). Trước đây yêu cầu dựng catalog chỉ nằm trong prompt nên không ai làm. Ngoại lệ cho task cũ: `--no-catalog` (phải nêu lý do ở report) hoặc `--qa-approved`. Blast radius đo thật: chặn đúng 1/2 task — chính task đã để lọt cụm bug UI (61 case hiển thị, không catalog); task còn lại không ảnh hưởng.
- `self_review` check #8 — case thuộc nhóm HIỂN THỊ mà kết luận chỉ dẫn chứng API (không dấu vết đọc trên màn) = **CHẶN**; ghép record status với testcase canonical theo `tcId` để phân loại. Chạy API cho case màn hình thì lỗi render/mapping FE **bất khả** lộ ra. Đo: 2–3/59 case hiển thị — ít và chính xác.

**Docs (prompt = chỗ ngăn từ đầu, gate chỉ là lưới cuối)**
- Gen §12: BẮT BUỘC sinh `requirements/ui_catalog.json` — cột **verbatim + đúng thứ tự**, `fields[]` cho **mỗi section**, `texts[]`; màn hiển thị **cùng dữ liệu ở ≥2 chỗ** phải khai cả hai với **cùng** `expectedFields` (lệch nhãn giữa 2 màn chỉ lộ khi cả hai cùng bị đối chiếu với một danh sách).
- Gen §14 thêm **"SAI NGUỒN dù CÓ giá trị"**: expected khai **hai đầu** (`field UI = object.property`); phải chọn data mà 2 nguồn **khác nhau** (trùng giá trị thì case không chứng minh được gì); có bảng field-mapping thì **mỗi dòng = ≥1 case**. Thêm mục **định dạng/đơn vị khi đẩy đi** ("đồng bộ thành công" không chứng minh bên nhận nhận đúng số).
- Execute (phase2/04) §Kỷ luật: cấm kết luận "đồng bộ đúng" (phải ghi giá trị 2 đầu) · **case hiển thị phải execute QUA UI** (chạy API thì lỗi mapping FE bất khả lộ — dùng API để dựng data thì được) · bắt buộc chạy `ui_conformance_check` · anomaly phải có nơi đến · fixture wall phải khai thành "Vùng chưa kiểm".

## 2026-08-10 — Risk phản ánh hiện tại · bản đồ hệ thống sinh nghĩa vụ test

**Changed**
- `risk_score.js` — **vòng đời bug**: Likelihood dùng *bug hiệu dụng* = `statusWeight[jira_status] × 0.5^(tuổi/halfLifeDays)` thay vì đếm mọi bug bằng nhau. Trước đó bug `Done` nửa năm trước vẫn kéo Likelihood y như bug mới mở ⇒ risk model lệch về **quá khứ**: vùng từng-hỏng-đã-fix luôn High, vùng vừa hỏng không nổi lên. Default `Done/Closed 0.4 · Rejected 0.1 · half-life 180 ngày`; thiếu ngày → **không** decay (bảo thủ); `confidence` vẫn theo tín hiệu **thô** nên module nhiều bug cũ không bị tụt về cold-start. Tắt: `halfLifeDays: 0` (hoặc `statusWeight: {}` về hành vi cũ) trong `risk_model.json`. Register in `bug thô→hiệu dụng` (vd `3→1`) + 1 dòng công thức để QA soi được vì sao band đổi. Nghiệm thu dữ liệu thật: 1 module Medium(6) → Low(3) vì cả 7 bug đều `Done` từ 46 ngày trước. (`6483ff3`)

**Added**
- `knowledge/system/` + `scripts/qa/system_map.js` (`npm run system:check` / `system:index`) + skill `system_mapper` — **bản đồ hệ thống đã xác nhận**: `state_machine` · `permission_matrix` · `shared_surface`. Vì sao cần: `domain/` lưu "giá trị đúng là gì", nhưng loại câu hỏi *"API cho huỷ đơn đã thanh toán — bug hay đúng thiết kế?"* / *"role thấp gọi được API role cao — lỗ hổng?"* / *"sửa API này regression đâu?"* thì **không thể** trả lời bằng cách bấm app (app cho làm chính là cái đang nghi sai → tautology), nên thực tế agent hay log bug đoán rồi bị dev bounce.
  Điểm khác tài liệu thường: bản đồ **sinh ra nghĩa vụ test** — cặp `(from,to)` không khai trong `transitions` là bất hợp pháp ⇒ phải có case chứng minh bị chặn; ô role×action ngoài `allow` ⇒ phải 403. `system:check` in ma trận state + liệt kê nghĩa vụ còn trống, xếp `‼` trước cho cặp xuất phát từ state `terminal` (bug toàn vẹn dữ liệu) và ô `DENY` (phân quyền). `--impact "<surface>"` → danh sách module phải regression. `--task` đối chiếu `covered_by` với TC ID thật để bắt **TC ma**.
  Validator chặn: id/type lệch nhau, state ngoài `states`, cặp vừa hợp pháp vừa bất hợp pháp, `expected` không kiểm được ("không được"), `consumers` < 2, thiếu `source`/`confirmed_by`, PII, nhiều bản `active` cùng `id`.

- `knowledge/decisions/` + `scripts/qa/decisions.js` (`npm run decisions:check` / `decisions:index`) + skill `decision_recorder` — **lý do của quyết định đã chốt** (`false_positive` · `by_design` · `risk_override` · `blocked_pass` · `wont_fix` · `test_approach`). Kit đang lưu "cái đúng" (`domain/`), "được phép làm gì" (`system/`), "cái đã sai" (`bugs/`) — thiếu đúng thứ đắt nhất: **vì sao đã kết luận thế**. Hệ quả đo được: 2 kết luận quan trọng nhất từng có (một bug IPN được dev verify code rồi Jira Rejected; một bug bị declare false positive sau khi test lại trên fixture dựng đúng luồng) **không có chỗ nào trong kit chứa** ⇒ task sau log lại đúng bug đó.
  - `--check "<triệu chứng>"` (bỏ dấu, ngưỡng ≥2 từ khớp để không nhiễu) — **bắt buộc tra trước khi log bug** (workflow `phase2_04` bước 4). Khớp `false_positive`/`by_design` ⇒ không log lại; muốn log phải có bằng chứng MỚI khác lần trước.
  - Đối chiếu `knowledge/bugs/`: bug `Rejected`/`Won't Do` **chưa có lý do lưu lại** bị nêu tên (`‼`) — đó chính là bug sẽ bị log lại. Quyết định tạm thời quá `expires_at` mà còn `active` → cảnh báo phải kiểm lại (chống "hạn chế tạm thời" hoá thành luật vĩnh viễn).
  - Validator chặn: `rationale` < 20 ký tự (bản ghi không có lý do thì lần sau vẫn phải điều tra lại = vô dụng) · `false_positive` do QA/agent tự chốt (ghi bừa là **dập luôn bug THẬT** ở task sau) · `scope` rỗng · PII · >1 bản `active` cùng id.
  - `risk_score`: nhắc lại QA override đã lưu (`type: risk_override`) ở cuối register — **suggest-only, không tự đổi band**; trước đây override chết theo task nên mỗi lần chạy lại phải override tay.
- `scripts/lib/testcase/validate.js` — kiểm **GIÁ TRỊ** 2 cột `Ưu tiên`/`Mức độ rủi ro` (trước đây `design_gate` chỉ kiểm **rỗng**, nên quy ước §7/§8 trong prompt không có gì ép). `Ưu tiên` ngoài 5 priority Jira = **CHẶN** — không phải hình thức: bug log lên Jira lấy `Priority` **từ chính cột này**, giá trị lạ (`Critical`, `P0`) ⇒ Jira dùng default ⇒ mất tín hiệu ưu tiên. `Mức độ rủi ro` ngoài `High|Medium|Low` = **CHẶN** (`risk:gate` ép độ sâu theo cột này, giá trị lạ bị bỏ qua âm thầm). 2 cột nói ngược nhau (`rủi ro High` + `ưu tiên Low`) = **cảnh báo**. Đo trước khi chọn mức chặn (bài học baseline của `locator_lint`): 1868 TC thật / 20 file → đúng 3 dòng bẩn ⇒ chặn được mà không làm đỏ hàng loạt; bộ 530 TC Payment `0 CHẶN`.

- `self_review` check #6 **knowledge ghi tay** — 3 store mới (`domain/`, `system/`, `decisions/`) máy KHÔNG tự thu được (chỉ người/agent ghi), mà ban đầu chúng chỉ được nhắc bằng 1 dòng trong workflow ⇒ rơi đúng bẫy *"có store, có validator, nhưng không gate nào gọi"* — y hệt lý do `knowledge/` từng rỗng suốt nhiều task. Nay: record đã ghi mà sai schema/PII → **CHẶN** (store rỗng không bao giờ chặn); store rỗng chỉ nhắc **khi có tín hiệu cụ thể** — clarifications đã `RESOLVED` mà `domain/` rỗng · bộ TC có case phân quyền/trạng thái/guard mà `system/` rỗng · bug `Rejected` chưa lưu lý do · quyết định quá `expires_at`. Nghiệm thu 2 task thật: SAPP-21786 → 3 case guard, SAPP-24395 → 41 case; cắm record sai vào store → gate chuyển FAIL đúng như thiết kế.

**Fixed**
- `domain_rules --index` / `system_map --index` / `decisions --index` — chỉ biết **thêm/sửa**, không bao giờ dọn: xoá 1 record thì `index.json` vẫn giữ entry trỏ vào file không còn tồn tại ⇒ tra cứu ra **kết quả ma**. Nay mỗi indexer dọn entry trỏ file đã bị xoá — nhưng **chỉ của type mình** (`business_rule` / `system_map` / `decision`), không đụng type do script khác quản.
- `risk_score` — `(unmapped)` bị xếp như một **module thật**. `learn_bugs` gán nhãn đó cho bug thiếu label `<tcId>` (không tra ra được cột Module); khi nạp 24 bug của một story, 13 bug rơi vào `(unmapped)` ⇒ nó leo lên **High risk 15** và **chen vào `executeOrder`** — chỉ đường test tới một đối tượng không tồn tại, đồng thời che mất sự thật là các module thật đang thiếu tín hiệu. Nay tách khỏi bảng, in thành **cảnh báo dữ liệu** (console + mục cuối register) kèm cách sửa tận gốc (bổ sung label `<tcId>` rồi chạy lại `learn:bugs:apply`).
- `push_test_execution.js` — import Xray bị **nginx 413** khi payload evidence lớn (`client_max_body_size` ~1MB, evidence base64 rất nặng) làm **cả lượt push chết**. Chia batch theo KÍCH THƯỚC payload (`XRAY_IMPORT_MAX_BYTES`, mặc định 600KB); `importExecution` với `testExecutionKey` gộp runs theo `testKey` nên append nhiều lần an toàn. Áp cho **cả 2** đường import-vào-execution-có-sẵn: `--execution-key` và **pre-create** (đường mà project bắt buộc custom field đi qua) — batch một đường thôi thì đường còn lại vẫn 413 đúng lúc payload to. Test đơn lẻ vượt ngưỡng → WARN nêu tên case (không chia nhỏ hơn được, phải giảm evidence).

**Docs**
- Nối bản đồ vào quy trình: prompt `02_gen_testcases.md` §nguồn-sự-thật (sinh case guard/permission/negative từ bản đồ) · workflow `phase1_01` (ghi bản đồ từ bảng trạng thái/ma trận quyền trong FSD) · workflow `phase2_04` (**bug dạng "hệ thống cho phép X" phải trích `SM-*`/`PM-*`**, chưa có bản đồ thì hỏi BA/Dev trước) · `knowledge/SCHEMA.md` §`system/` · README · USER_GUIDE §12.1.
- Cấm rõ trong skill + prompt: **không dựng bản đồ bằng cách thử API rồi ghi lại kết quả** — app đang sai thì bản đồ hợp thức hoá cái sai, TC sau đó vĩnh viễn không bắt được bug đó.
- USER_GUIDE §12.1: sửa mô tả Likelihood đã lỗi thời (`bugCount` → *bug hiệu dụng*).

## 2026-08-06 — Khép vòng học · chống flaky expand · đồng bộ tài liệu

**Added**
- `scripts/qa/learn_bugs.js` (`npm run learn:bugs[:apply]`) — nạp bug từ **Jira** (label `auto-bug` + sub-task của story) vào `knowledge/bugs/` + `index.json`. Trước đó `bugCount` luôn = 0 nên `risk_score` chỉ có `failRate`. Không cần sửa `bug_reporter.js`. Idempotent (đã có → chỉ đồng bộ `jira_status`). Nghiệm thu trên 1 task thật → 7 bug, `risk_score` từ `0 bug` → `7 bug, 9 snapshot`. (`7482523`)
- `scripts/utils/ui/ensure_expanded.js` + regression `tests/fe/infra/ensure-expanded.spec.ts` — mở panel/accordion trên DOM "nhiều icon giống nhau": thử ứng viên → **nghiệm thu bằng sentinel**, tự Escape khi click nhầm modal/dropdown, idempotent, không dùng toạ độ chuột. Thay cho click chevron theo toạ độ (nguồn flaky kinh điển; một task thật đã thử ~8 lần không ổn định). (`683d67e`)
- `select_tests.js` dùng learning data thật: xếp hạng file theo `(fail + 0.5×flaky)/runs`, `--include-risky <N>`, `--risk-first`, cảnh báo test quarantine. Trước đây code ghi rõ *"risk hiện in gợi ý, chưa auto-lọc"*. (`7482523`)

**Fixed**
- `metrics_collect.js`: test `skipped` có `results` **rỗng** nên chỉ đọc `results[last].status` → **15/26 record là `unknown`**, làm hỏng tín hiệu reliability/risk. Fallback `t.status`; đồng thời chuẩn hoá `file` về repo-relative để `select_tests` map được. (`7482523`)
- `self_review`: đòi KPI cả với task execute bằng script tự chế (không sinh `results.json`) → **chặn oan**. Nay chỉ đòi khi task thực sự có `results.json`. (`7482523`)
- `ensure_expanded`: dùng `offsetParent !== null` để kiểm hiển thị làm overlay `position: fixed` (antd/bootstrap) bị coi là ẩn → mất khả năng tự-Escape. Đổi sang `rect + computedStyle`. (`683d67e`)

**Docs**
- `README.md` + `USER_GUIDE.md` đồng bộ cho toàn bộ thay đổi kit-wide gần đây; bù **12 npm script** vốn chưa từng được ghi → nay đủ **51/51**. (`76bf164`)

## 2026-08-04 — Learning loop tự động

**Added**
- `scripts/qa/learn_task.js` (`npm run learn`, `learn:backfill`) — thu KPI + snapshot `historical_execution/<TASK>__<date>.json` với `modules` theo **tên module nghiệp vụ** (map `tcId → Module` từ testcase canonical), cập nhật `index.json`. Idempotent; thời điểm lấy từ artifact nên backfill giữ đúng trend. Backfill 16 task → 12 KPI run + 9 snapshot; `risk_score` thoát cold-start, `dashboard` từ rỗng → 9 snapshot/84 module. (`73391e3`)
- `scripts/qa/learn_reporter.js` — Playwright reporter **tự thu sau mỗi test run**, khai **cuối** danh sách `reporter`. (Đo thật: `globalTeardown` chạy *trước* khi reporter `json` ghi `results.json` nên không dùng được.) Guard: `LEARN_AFTER_RUN=0` · CI · thiếu TASK context · 0 test · run bị ngắt; never-throw. (`4399acf`)
- `self_review` check thứ 4: execute xong mà thiếu snapshot/KPI → **CHẶN** kèm lệnh sửa. (`73391e3`)

**Changed**
- `RULE_GLOBAL` §Cleanup Rules: pattern `scratch_*.py|js|ts` → **`scratch_*` mọi đuôi** + rule "dump ad-hoc ghi vào scratchpad, KHÔNG ghi root repo"; `.gitignore` thêm `scratch_*`. Lý do: 7 file `scratch_*` (dump swagger/API) sót ở root, **chưa gitignore** → một lần `git add .` là commit lộ PII (dump swagger chứa 24 email + 6 SĐT ở giá trị mẫu). (`f6f6cf1`)

## 2026-07-31 — Non-functional sâu · cross-browser lane

**Added**
- `scripts/qa/lighthouse_check.js` (`npm run lighthouse`) — điểm **Performance/Accessibility/SEO/Best-practices** qua CDP (`playwright-lighthouse`). Opt-in nặng (thiếu dep → skip sạch), never-auto + non-prod, verdict **advisory** theo dải chuẩn, evidence = ảnh bảng điểm. (`2a8ba04`)
- `perf_check --deep` — coverage động JS/CSS, `Performance.getMetrics`, heap, CPU/network throttling qua CDP thô. (`b8cd8e3`)
- **Lane cross-browser**: `CROSS_BROWSER=1` → thêm project `firefox-desktop` + `webkit-desktop`; `CROSS_BROWSER_GREP` cho tập critical; job `cross-browser` (manual) ở cả `.gitlab-ci.yml` và `ci.yml`. Lý do tách lane: `project` trong Playwright = **nhân bản suite**, gộp vào PR sẽ nhân 3× lượt chạy/evidence/nhiễu flaky. (`3ea1769`)

**Fixed**
- `desktopIgnore` dùng chung + thêm `**/support/**`: spec hạ tầng dưới `tests/support` đọc file **lúc load** làm **vỡ collection toàn suite** (`--list` ra `Total: 0` → gate F1 dễ `INFRA_FAILURE`). Sau fix: 238 test/53 file. (`3ea1769`)

## 2026-07-30 — Đọc tài liệu kỹ · siết Ambiguity Gate

- `RULE_GLOBAL` §"Analysis & Ambiguity Gate" (canonical) + digest ở `core_rules`: **đọc tài liệu THẬT KỸ** (mọi mục/bảng/ghi chú/footnote trong scope) và **gom câu hỏi làm rõ TRƯỚC khi gen testcase**; còn điểm Blocking → `AMBIGUITY_GATE: PENDING`, dừng chờ trả lời, **không đoán**. `02_gen_testcases.md` thêm "Bước 0" và bỏ escape *"cứ gen với assumption"* cho mức Critical/High. (`cb380b6`)

## 2026-07-27 — Token Broker (hết gián đoạn vì token 30')

- `tests/fe/support/auth/tokenBroker.ts` + `scripts/utils/auth/pick_token.js` — giữ 1 phiên SPA đã login sống, lấy **token tươi** mỗi lần gọi API (ưu tiên **capture header `Authorization`** thật của SPA), 401/403 → refresh → retry. Bỏ hẳn việc F12 dán `OPS_API_TOKEN`/`LMS_API_TOKEN`; `task.env` chỉ cần user/password. (`f70e786`)
- `tests/fe/support/lmsLogin.ts` + alias app-neutral cho app dùng IdP/OIDC (Keycloak…). **Fix quan trọng**: SPA phát hiện automation → loop trang login trắng; chữa bằng `--disable-blink-features=AutomationControlled` (global, đã nghiệm thu vô hại với Firefox/WebKit) + override `navigator.webdriver`. (`0e3bf79`)

## 2026-07-24 — Architecture hardening V2.1 · Forcing functions round-3

- **Canonical TestCase** (`scripts/lib/testcase/`): 1 parser duy nhất cho Markdown/XLSX, xoá 4 parser trùng; sửa lỗi `split('|')` làm lệch cột khi cell có `\|`. (`9fa14d9`→`9f537c3`)
- **GateEngine** (interface gate chuẩn + aggregate), **EvidenceManager** (sanitize + manifest), **TestContext**, **typed RuntimeConfig**, **Cleanup Manifest**, **DependencyGraph**, **QualityDecision** (GO/NO-GO). (`964efb1`, `6310e27`, `a5d6767`, `ddd6797`)
- **EvidenceRecorder** atomic + parallel-safe (shard per-TC, temp+rename). (`5717dae`)
- **Auth Strategy** — reuse session né throttle/lockout; seed localStorage bằng `addInitScript` **trước** khi SPA boot. (`415827c`, `888fced`)
- **Round-3 G1–G10**: `preflight_gate` (G1), `output_gate` phân tầng lỗi + chống oracle tautology (G2), `CLAUDE.md` non-negotiables (G3), verdict taxonomy 1 nguồn (G4), `design_gate` (G5), attestation-verify chống "tick suông" (G6), SessionStart hook bơm context (G7), bug gate (G8), `self_review` (G9).

## 2026-07-23 — CI integrity · coverage thật · metrics

- **GĐ1 CI integrity**: chống false-green (`test_inventory_gate`, SHARD_EMPTY), risk gate enforce, policy-source check, env pin, `secret_scan` + `audit_ci`, eslint/typecheck.
- **GĐ2 coverage**: suite FE/API thật đầu tiên (Order Total Amount Due, Transaction list, Product-Orders API) — verified UAT; ma trận traceability REQ→TC→AUTO→EXEC→BUG; `select_tests` (F9).
- **GĐ3 metrics**: `metrics_collect` (F11) + `reliability_index` (F10) + persistence commit-back `knowledge/metrics`.
- **Output Quality Gate** thành gate THỰC THI cho Test Execution / gen-testcase / bug + harness hook.

## 2026-07-21 — Knowledge Base · Risk-Based Testing

- `knowledge/` (schema `SCHEMA.md`) + skill `learning_recorder` + `git_impact_analyzer`.
- `risk_score`/`risk_gate` (RBT) + `seed_knowledge_from_jira` (bootstrap từ lịch sử Jira/Xray) + tune `risk_model.json` cho SAPP.
- Rule: "Kết quả mong đợi" đánh số **khớp từng bước**, cấm gộp range.
