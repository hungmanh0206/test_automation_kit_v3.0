# v2.9.7 — chuỗi phép đo

> Đợt này không thêm năng lực nào. Nó sửa **năm con số** mà kit đang in ra và người đọc đang tin, trong
> khi không con số nào nói nó đếm trên bao nhiêu. Không lượt chạy nào đỏ vì chúng — vì chẳng có gì sai
> từng chữ.

## Vì sao cả năm cùng một họ

Mỗi mục dưới đây là một câu **đúng** bị đọc thành một kết luận **rộng hơn**:

| Cửa | Câu nó in | Người đọc nhận được | Thật ra |
|---|---|---|---|
| `expected:check` | `✓ ĐẠT` | cả bộ đã được gác | gác được 273/**312** |
| `audit:ci` | `moderate 12` | 12 lỗ hổng | **1** advisory, 12 gói bị tán |
| `full:suite` | `1 xanh · 6 đỏ` | lượt chạy gần như rỗng | **2404** xanh · 6 đỏ |
| `library` | `Phiên bản kit: 2.9.6` | bản hiện tại | `package.json` = **2.9.7** |
| `run:analysis` (phép kiểm) | hai bộ thật ở hai dải | ngưỡng phân biệt được | hai bộ nay **cùng** dải |

## ① `expected:check` — `✓ ĐẠT` trên 273/312

Đo trên CSDL-4008: bộ có **312** case, mốc băm chứa **273**. Cửa in `+ 39 case MỚI` rồi kết luận
`✓ ĐẠT`. Đúng từng chữ — không case nào **đổi** expected — nhưng 39 case kia không có băm nào để so, nên
đổi `Kết quả mong đợi` ở đúng 39 case đó là **vô hình với máy**.

Và sổ ấy **không** khai `chup_giua_task`, tức đang được đọc là *chụp ở cửa chốt*, trong khi bộ case lớn
thêm **sau** nó. Hai điều đó không thể cùng đúng.

| Task | Trước | Sau |
|---|---|---|
| CSDL-4008 | `✓ ĐẠT` | `✓ ĐẠT · gác được 273/312 (87.5%)` |
| CSDL-9001 | `✓ ĐẠT` | `✓ ĐẠT · gác được 223/223 (100%)` |

Hai dòng `✓` trước đây không phân biệt được.

**Không phải việc chụp lại 5 sổ chụp-giữa-task.** Điều kiện chụp lại là bộ case **chốt**, và dấu hiệu
máy của nó (`0 mirror from-sheet`) vẫn chưa có. Chụp lại lúc này đúng là thứ cửa đó gác: *"Chụp để che
một thay đổi chưa khai là đúng thứ gate này gác."*

**Tôi vá hụt một lượt.** Cửa có **hai** đường in `✓ ĐẠT` (0 case đổi · có đổi nhưng đã khai đủ). Lượt
đầu tôi chỉ sửa đường thứ hai, mà ca CSDL-4008 nổ ở đường **thứ nhất** — bản vá rỗng đúng với ca sinh ra
nó. Nay mỗi đường có một phép kiểm riêng.

Dạng chặn tách ra `expected:check:enforce`, gắn ở **cửa publish** (nơi bộ case đã chốt). Cửa `done` giữ
bản mặc định để không chặn 6 task đang chạy ở giữa đường.

## ② `audit:ci` — và phép đo ở đây là chính tôi

Tôi báo với người dùng `8 advisory moderate (uuid, exceljs)`. Sai con số, sai tên gói, sai cả bản chất:

| Con số | Nó thật ra là gì |
|---|---|
| 12 | số **gói** bị ảnh hưởng, cả cây |
| 8 | số **gói** bị ảnh hưởng, chỉ prod (`--omit=dev`) |
| **1** | số **advisory** — `minimatch` GHSA-g3hv-75wg-m249 |

Không có `uuid` nào. Tôi đọc con số đó từ trí nhớ vì bản thân nó không chở theo gì để đối chiếu.

**Đã thử vá và đo, không đoán.** `overrides.minimatch=^11.0.1` đưa `npm audit` về **0 vuln**. Rồi:

```
require('glob')            -> OK
require('glob').sync(...)  -> NÉM: Cannot read properties of undefined (reading 'charAt')
```

`glob@7` gọi minimatch bằng API cũ, và `glob@7` nằm trong cây **prod**
(`exceljs@4.4.0 → archiver@5.3.2 → glob@7.2.3`). Nên override làm xanh con số bằng cách làm **vỡ** thư
viện — đúng thứ non-negotiable §6 cấm. Đã trả lại (`git checkout` + `npm ci`), nghiệm thu `glob.sync`
trả **125** file.

Phép thử đó đồng thời là **đối chứng cho tính không-với-tới**: dưới minimatch@11 `glob.sync` vỡ còn
`exceljs` ghi rồi đọc lại .xlsx **vẫn chạy** (ô A2/B2 đúng) ⇒ đường exceljs của kit không chạm minimatch.
Kit cũng không `require('glob')` hay `require('minimatch')` ở bất kỳ đâu trong `scripts/` ·
`tests/support/` · `.agent/`.

Nên sổ `.agent/config/audit_allow.json` đòi **phép đo** và **hạn dùng**. Chưa khai ⇒ CHẶN, không vì nó
nguy hiểm mà vì **chưa ai xem**. Hết hạn ⇒ CHẶN.

**Bản đầu của chính máy này in `tán ra 1 gói`** cho advisory đang ảnh hưởng 8 — nó chỉ đếm gói có `via`
dạng object, bỏ cả chuỗi `via` dạng chuỗi. Lớp hỏng mà máy ra đời để chữa, tái diễn ngay trong máy.

## ③ `full:suite` — `1 xanh` cho lượt có `2404 passed`

Lộ ra khi chính lượt nghiệm thu của đợt này đỏ. `out.match` không có cờ `g` ⇒ lấy lần khớp **đầu tiên**
của `/(\d+)\s+passed/`, và lần đầu nằm trong **mã nguồn một spec được in kèm thông điệp lỗi** — chú thích
ở đó có chuỗi `"1 passed"`.

Đoạn mã đó chỉ in ra **khi có ca đỏ**. Nên sổ đúng ở mọi lượt xanh và **sai ở lượt đỏ** — sai đúng lúc
người ta cần đọc nó nhất.

```
log thật       -> 2404 + 6 + 0 + 0 = 2410  = Running 2410 tests   ✓
bẫy chú thích  -> 2 xanh (không phải 1)                            ✓
lệch tổng      -> KHÔNG ghi sổ                                     ✓
```

Phần đọc số tách ra hàm thuần `docKetQua` (kiểm bằng fixture thay vì chạy 16 phút), neo **đầu dòng**, lấy
lần khớp **cuối**, và **đối soát** với `Running <N> tests`. Lệch thì **không ghi sổ**.

**Lần thứ ba trong cùng đợt** một cửa đọc phải **chữ trong chú thích** thay vì dữ liệu: `gate:policy`
(v2.9.6) đếm tên skill trong chú thích · `version:check` ⑨ đọc chú thích của chính nó · rồi sổ này.

## ④ `version:check` ⑨ — số phiên bản cũng là bản sao viết tay

Thư viện thuật ngữ ghi `Phiên bản kit: 2.9.6` khi `package.json` đã `2.9.7`. `library:drift` xanh vì nó
so `index.html` với `src/` — **hai bản sao với nhau**; cả hai cùng sai thì nó vẫn xanh.

⑨ đỏ ngay lượt đầu vì **chính câu chú thích của nó** (chú thích dẫn `2.9.6` làm ví dụ). Nên nó dùng lại
`boChuThich`, kèm **cặp** phép kiểm phân biệt *"bỏ đúng chú thích"* với *"bỏ hết"*.

## ⑤ Trần `workers` — và lý lẽ đầu tiên tôi viết cho nó là SAI

Lượt viết đầu của chú thích trong `playwright.config.js` viện cơ sở: *"6 là cấu hình `full:suite` đã chạy
2384 xanh"*. **Không đúng.** `full_suite_ledger.js` **ghim `--workers=2`** có chủ đích, với phép đo riêng
của nó: *workers mặc định ⇒ 46 đỏ trong gói; `--workers=1` ⇒ 30/30 xanh*. Nên 6 chưa bao giờ là cấu hình
nghiệm thu — nó chính là cấu hình tôi đo được cú treo `page.goto` ở v2.9.6.

Lỗi thật của `workers: CI ? 2 : undefined` không phải con số, mà là **nó co giãn theo máy**: mỗi worker
mở một browser, một `chrome-headless-shell` chiếm **3–4 tiến trình** (đo: 0 → 3 sau launch, giữ 3–4 qua 8
lượt bò, về 0 sau khi đóng).

| Máy | `cores/2` | Tiến trình browser |
|---|---|---|
| 12 lõi | 6 | ~24 |
| 32 lõi | 16 | ~64 |

Trong khi mọi trần của `discovery-crawl` là số **tuyệt đối**: 250ms/400ms mỗi khối · 8s mỗi trang · 15s
mỗi `page.goto` · 3 phút mỗi file. Nên **máy nhiều lõi hơn không an toàn hơn**.

### Số đo, kèm phần nhiễu

Làn `tests/fe/infra`, máy 12 lõi:

| Lượt | 6 worker | 2 worker | Tỉ lệ | Nhiễu |
|---|---|---|---|---|
| 1 | 392s · 1 đỏ | 698s · 1 đỏ | 1,78× | tôi **sửa spec giữa lượt** ⇒ hai nhánh khác bộ test (2410 vs 2415) |
| 2 | 404s · **2415 xanh** | 619s · 1 đỏ | 1,53× | lượt 2-worker chạy khi có **việc khác trên máy** (xem dưới) |

**Hướng thì chắc, con số thì không**: hai lượt độc lập đều cho 6 worker nhanh hơn, 1,53–1,78×, và không
lượt nào ở 6 worker sinh thêm ca đỏ. Nên **hạ mặc định về 2 là sai hướng** — đắt mà không mua được gì
đo được.

Trần **6** vì vậy ở lại, nhưng công dụng của nó đổi: không phải "kéo 6 xuống", mà **chặn vùng trên 6** —
vùng chưa ai đo, vì không có máy nhiều lõi hơn để đo. Trần này nói *chưa biết*, không nói *đã biết là
tệ*. `PW_WORKERS` để vượt có chủ đích.

### Ca đỏ ở nhánh 2 worker KHÔNG phải do worker

`run-analysis.spec.ts` khẳng định hai bộ dữ liệu **thật** rơi vào hai dải BLOCKED khác nhau. Giữa hai
nhánh đo, `outputs/CSDL/tasks/CSDL-9004/test-results/testcase-status.json` **bị ghi lại**
(mtime 19:38), cùng với `qemis-captcha.png` và `qemis-captcha-answer.txt` lúc 19:39–19:40 — tức có một
lượt chạy QEMIS **từ IDE** song song. Dấu vết tiến trình: `playwright test-server -c
playwright.config.js` khởi tạo **19:38**.

Hệ quả: CSDL-9004 trôi về **18.5%**, rơi vào **đúng dải** của CSDL-9003, nên tiền đề của phép kiểm hết
hiệu lực và nó đỏ trong khi `run:analysis` vẫn chạy hoàn toàn đúng.

Đây là lần thứ **ba** cùng một bài học ở đúng phép kiểm đó:

1. bản đầu ghim `28.9%` ⇒ đỏ khi dữ liệu trôi còn `28.6%`;
2. sửa 13/10/2026 đổi sang ghim **dải** — thô hơn, nên lâu rotten hơn;
3. 01/11/2026 **dải cũng trôi**.

Ghim thô hơn chỉ làm bài học chậm lại. Nên nay tính chất *"ngưỡng phân biệt được"* kiểm bằng **fixture**,
cả **ba** dải (`<5%` · `5–20%` · `>20%`), nơi tỉ lệ đặt được chính xác. Dữ liệu thật giữ một phép kiểm
riêng với vai trò đúng của nó: chứng minh `run:analysis` **đọc nổi hình dạng thật** của
`testcase-status.json` — thứ fixture tự sinh không đại diện được — và **không ghim bộ đó đang ở dải nào**.

## Đối chứng không rỗng

Mọi phép kiểm mới đều chạy với bản mã **trước khi vá**:

| Bộ | Kết quả | Ghi chú |
|---|---|---|
| `expected-ledger` | **7/7 đỏ** | |
| `audit-allow` | **7/9 đỏ** | 2 phép còn xanh chỉ đọc sổ JSON ⇒ **không** phải đối chứng cho mã |
| `workers` (trần) | **4/5 đỏ** | phép thứ 5 gác nhánh CI — nó gác việc tôi **không** chạm vào CI |
| `full-suite` (đọc số) | đỏ khi gộp dải | |
| `run:analysis` (3 dải) | đỏ khi gộp 2 dải | lượt phá hoại **đầu** của tôi không ăn, và câu "đã gộp" in vô điều kiện nên nó **tự khai thành công** — phải diff mới biết |

## Sáu ca đỏ của lượt `full:suite` đầu — tất cả là lỗi của tôi

| Ca | Nguyên nhân | Sửa |
|---|---|---|
| `config-presence` | `audit_allow.json` ngoài danh sách đóng gói ⇒ người nhận có cửa mà không có sổ | đăng ký vào `package_kit.js` |
| `release-pipeline` | QUICKSTART khai 868 file / 172 spec; cây thật 870 / 173 | cập nhật bảng |
| `version-changelog:56` | phép kiểm **ghim cứng** `2.9.6` ⇒ mục mỗi lần tăng phiên bản | neo vào `package.json` |
| `version-changelog:186,197` | `require('./recon_passive.js')` ⇒ `version:check` **chết hẳn** trong cây chỉ có đúng nó | bản sao có chủ ý + phép kiểm chống trôi |
| `ci-scope:272` | IIFE phá khuôn `workers: CI ? …` mà phép kiểm đòi | viết lại config gọn hơn, **không** nới phép kiểm |

Ca `recon_passive` là **lần thứ năm** trong một phiên cùng một họ: chạy ở repo, chết trong gói. Và ⑨ của
tôi lặp lại đúng lỗi ⑦ đã sửa hôm 30/10 — chỉ hỏi `git ls-files`, nên không có `.git` thì nó quét **0
file** rồi tự khai *"CHƯA GÁC GÌ"*. Nay phần liệt kê file gộp về `lietKeFile`, dùng chung cho ⑦ và ⑨, nên
chỉ còn **một** chỗ để sai.

## Lần thứ SÁU: "chạy ở repo, chết trong gói" — và cách tái hiện trong 1 phút

`release:verify` đỏ **14/15**, 2 ca — cả hai là phép kiểm ⑨ của chính tôi:

```
ENOENT: … \kit-2.9.7\docs\library\src\shell.html
expect(received).toMatch(expected)        # dòng đếm ⑨ không có
```

Gói **không chở `docs/library/**`**. Nên vế dương ENOENT, và vế âm không thấy dòng đếm vì trong gói
không bề mặt nào khai phiên bản. Phép kiểm về một **cơ chế** mà lại neo vào một **file của repo**.

Nay cả hai dựng cây riêng (như các phép kiểm ⑦ đã làm), cộng một phép kiểm cho đúng trạng thái của gói
(*không bề mặt nào ⇒ `CHƯA GÁC GÌ`, không phải "đạt"*), và một phép kiểm về **cây đang chạy** khẳng định
**cả hai** nhánh nên không nhánh nào lặng lẽ cho qua.

### Vòng lặp 25 phút rút còn 1 phút

Mỗi lần phát hiện họ lỗi này đều mất một vòng `full:suite → package:kit → release:verify` (~25 phút).
Không cần thế. Dựng **cây giả-gói** từ chính HEAD, loại đúng những gì gói không chở, và nối
`node_modules` bằng junction thay vì chép:

```bash
d="…/nhugoi-$(date +%H%M%S)"; mkdir -p "$d"
git archive HEAD -- . ':(exclude)docs/library' | tar -x -C "$d"
powershell -NoProfile -Command "New-Item -ItemType Junction -Path '<win $d>\node_modules' -Target '<repo>\node_modules'"
(cd "$d" && npx playwright test <spec> --project=chromium-desktop)
```

Nghiệm thu rằng cách này **thật sự** tái hiện: với spec **trước khi vá** ⇒ `2 failed · 15 passed`, cùng
ENOENT y hệt `release:verify`; với spec **đã vá** ⇒ `19 passed`. Cây đó cũng không có `.git`, nên nó bắt
luôn nhánh đọc-đĩa.

### Có dựng nổi máy gác tĩnh cho họ lỗi này không — đo trước khi thiết kế

| Số đo | Giá trị |
|---|---|
| spec trong làn `tests/fe/infra` | 168 |
| tham chiếu `path.join(REPO, <hằng>)` | 625 |
| trong đó **không** có trong gói | **49** (32 đường khác nhau) |

Lượt đếm **đầu** ra **166** — và nó **sai đơn vị**: `PK.collect()` trả FILE, còn phần lớn tham chiếu là
THƯ MỤC (`scripts`, `tests`, `.agent`), nên không bao giờ khớp. Cùng lỗi đơn vị tôi đã cắn ở bucket
`firewall` đầu phiên: phải coi một đường là "có trong gói" khi nó là file **hoặc** là thư mục chứa file
của gói.

Soi 32 đường đó thì phần lớn **chính đáng**: `outputs/**` có chốt `existsSync` + `test.skip`, còn
`khong-ton-tai.md` · `scratch_doi_chung_tam.json` · `*.test-tmp.json` · `tests/fe/lib/_doi_chung_tam/**`
là file test **tự tạo** hoặc **cố tình** không tồn tại. Nên máy gác ở đây phải phân biệt *"đọc mà không
chốt"* với *"test tự tạo"* — việc thiết kế thật, có rủi ro dương-tính-giả, **không** phải việc dọn. Chưa
dựng; ghi lại số đo để lượt sau khỏi đo lại.

## Và nhan đề của chính mục này từng đếm thiếu

Nhan đề mục CHANGELOG của đợt này ban đầu ghi **"Ba con số"**. Tới lúc viết xong thì mục đó có **7
bullet**, và bảng ở đầu tài liệu này liệt **5** con số. Tôi đặt tên trước rồi thêm bullet sau, và không
ai đếm lại — tức một con số ở **nhan đề** đếm thiếu chính nội dung nó mô tả, trong một đợt phát hành đi
chữa đúng chuyện đó.

Phát hiện **sau khi đã tag** `v2.9.7`. Nên tôi tag trước bằng bản đã nghiệm thu (nội dung đúng từng
bullet; chỉ cái nhãn sai), nói ra, rồi vá riêng — không sửa âm thầm một bản đã phát hành. Nhan đề mới
(`Năm con số`) được kiểm bằng cách **đếm lại bảng** ở đầu tài liệu này, không bằng lời khai.

## Hai lần tôi tự làm rỗng phép đo

- `/usr/bin/time` không có trong Git Bash ⇒ lượt đo worker **đầu không chạy gì**, mà lớp bọc vẫn báo
  `exit 0`. Lượt sau thêm kiểm chứng *"log có dòng kết quả không"*.
- `npm run full:suite > log; echo "exit=$?"` ⇒ `$?` là mã của **`tail`**, không phải của suite. Tôi suýt
  đọc một lượt **6 đỏ** thành xanh.
- Và `mktemp -d` trả đường MSYS (`/tmp/…`) mà node đọc thành `D:\tmp\…` ⇒ cả ba fixture dải đều không
  ghi được, trong khi vòng lặp vẫn in ra bảng trông như có số.
