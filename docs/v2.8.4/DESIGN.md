# v2.8.4 — Harness đồng thời/tranh chấp + bù bảo mật read-only — THIẾT KẾ

> Prompt gọi đợt này là "v2.8.2". Số đó **đã dùng rồi**: `v2.8.2` được tag và đẩy lên GitHub ngày
> 14/10/2026 với nội dung khác hẳn (trả nợ v2.8.1), và `v2.8.3` đang dở (đã bump + CHANGELOG, chưa tag).
> Nên đợt này là **v2.8.4**. Đổi số một tag đã phát hành thì mọi báo cáo lỗi trỏ vào nó mất đường tra.

---

## 0. Bốn điều prompt nói không khớp cây code

Đo 14/10/2026, trước khi thiết kế. Ba cái đầu đổi việc phải làm.

| # | Prompt nói | Đo ra | Hệ quả |
|---|---|---|---|
| 1 | "dùng lại **tầng API client `tests/fe/lib/api`** (v2.8.0)" | **KHÔNG tồn tại.** v2.8.0 dựng `_widget/` · `screens/` · `steps/` · `_checks/`; v2.8.1 thêm `oracles/`. Không có tầng API nào. | Harness **không có gì để dùng lại**. Xem §A.1. |
| 2 | "khai trong `security_catalog.json`" — như thể đang có | **KHÔNG có file nào** trong repo, kể cả bản mẫu. `security_check.js` đòi `--catalog` và thoát nếu thiếu. | Máy bảo mật hiện có **nhiều khả năng chưa từng chạy**. Xem §B.0. |
| 3 | "case đỏ mới giao **`case-debugger`** (v2.4.1)" | **KHÔNG có skill nào** tên đó trong `.agent/skills/`. | Bỏ phần giao việc đó, hoặc nói rõ là chưa có. |
| 4 | "`security_check.js` đang chạy header, cookie, unauth 401/403, authz dọc, IDOR theo id, transport" | **ĐÚNG** — 6 nhóm, khớp từng cái. | Không đổi gì. |

Có sẵn và dùng được: `tests/load/` + `load_check.js` (K6) · `mutation:check` · `writing:lint:docs` ·
`smoke:run` · fixture `discovery-app` **có POST và có trạng thái sống** (`store.truong`, `soLanGhi`).

---

## A. Harness đồng thời — `scripts/qa/concurrency_check.js`

### A.1. Bắn N request "cùng lúc" — và chỗ KHÔNG hứa được

Không có tầng API client để dùng lại, nên harness gọi thẳng `request` context của Playwright — đúng cách
`security_check.js` đang làm. Dựng thêm một tầng mới chỉ cho việc này là tạo bản sao thứ hai của chỗ đã
có người đi.

**Điều phải nói thẳng: không thể bắn N request ĐÚNG cùng một thời điểm.** Node chạy một luồng, và mạng
không hứa thứ tự. Thứ làm được:

1. Dựng sẵn N "thunk" — mọi thứ (URL, header, body, token) chuẩn bị xong trước.
2. Thả cùng lúc bằng một `Promise.all` trên các thunk đã dựng.
3. Đo **độ lệch thật**: ghi `t0` của request đầu và cuối rời tiến trình, in ra báo cáo.

Nếu độ lệch lớn hơn ngưỡng khai trong config (mặc định 50ms) thì lượt đó là **`CHƯA KIỂM`**, không phải
PASS: hai request cách nhau 300ms thì chúng không đua, và "không đua mà không lỗi" chẳng chứng minh gì.
Đây là chỗ dễ tự lừa nhất của cả mục A — một harness đồng thời không đo được mình có đồng thời không thì
nó chỉ là một vòng lặp gọi API.

### A.2. Kịch bản — `requirements/concurrency.json`

Năm nhóm theo prompt: `mot_lan` (duyệt/huỷ một lần) · `submit_dup` · `khoa_lac_quan` · `tru_tai_nguyen`
· `callback_trung`. Mỗi kịch bản khai: endpoint, N, cách dựng request, **bất biến** (§A.3), và
`chay_o: 'fixture' | 'uat_doc' | 'uat_ghi'`.

Mẫu số đề xuất lấy từ `api_inventory` + `SM-*` như prompt nêu — nhưng **không tự sinh kịch bản**: máy chỉ
liệt kê endpoint ứng viên và nói "chưa khai kịch bản nào cho endpoint này". Tự sinh kịch bản ghi là tự
quyết thay người về chuyện chạm dữ liệu.

### A.3. Oracle — bất biến ở TRẠNG THÁI CUỐI

| Loại | Kiểm gì |
|---|---|
| `dem` | số bản ghi tạo ra = kỳ vọng (1, không phải N) |
| `tong` | số dư/số lượng sau = trước − đúng một lần trừ |
| `trang_thai` | bản ghi ở đúng MỘT trạng thái hợp lệ, không trạng thái lai |
| `ma_tra_ve` | đúng một 2xx; còn lại là mã từ chối hợp lệ (409/422), **không** 500 |

`ma_tra_ve` là bất biến **duy nhất không cần tầng đọc** — ba cái kia phải đọc lại trạng thái cuối. Không
khai bất biến nào ⇒ `CHƯA KIỂM`, **không** PASS. Không có giá trị kỳ vọng mặc định (luật vàng v2.8.0).

**500 là FAIL, không phải "từ chối hợp lệ".** App có thể từ chối request thứ hai bằng nhiều cách; nhưng
vỡ ở tầng server thì nghĩa là nó không có đường xử lý cho tình huống đua.

### A.4. Ranh giới an toàn — phần sẽ không nới

| `chay_o` | Trên fixture | Trên UAT |
|---|---|---|
| `fixture` | chạy, PASS/FAIL cứng | **không chạy** |
| `uat_doc` | — | chạy: chỉ ĐỌC LẠI để kiểm bất biến sau một thao tác do người làm |
| `uat_ghi` | — | **mặc định TỪ CHỐI**; chỉ chạy khi có cờ `--resource-test <id>` cho đúng một resource dùng một lần, và user xác nhận từng lượt |

Mọi lượt đi qua `write_firewall`. `N` có trần trong config (mặc định 5, cứng 10) — vượt trần là **từ
chối**, vì đây không phải load test và biến nó thành bắn tải là sai mục tiêu.

Trên UAT kết quả là **ADVISORY**: môi trường có người khác dùng, nên FAIL là cờ để điều tra, rerun 2–3
lần loại flaky trước khi gọi là bug (`CLAUDE.md` §3).

### A.5. Vì sao K6 không thay được

K6 đo **thông lượng và độ trễ dưới tải**: nó hỏi "chậm bao nhiêu khi 200 người cùng vào". Mục A hỏi
"**kết quả có đúng không khi 2 người cùng bấm**". Một hệ duyệt đúp vẫn có thể có p95 rất đẹp — K6 xanh,
tiền vẫn mất. Ngược lại một hệ đúng-nhưng-chậm thì K6 đỏ còn mục A xanh. Hai câu hỏi khác nhau, và
`concurrency.json` khai bất biến chứ không khai ngưỡng thời gian.

---

## B. Bù bảo mật read-only

### B.0. Việc đầu tiên: catalog chưa từng tồn tại

Không có `security_catalog.json` nào trong repo. Nên trước khi thêm ba nhóm mới, phải có **bản mẫu**
`.agent/config/security_catalog.example.json` — nếu không thì ba nhóm mới cũng không ai chạy được, đúng
như sáu nhóm cũ hiện giờ. Đây là cùng một lớp lỗi với `knowledge/domain` rỗng trong gói mà v2.8.2 vừa
xử: một máy không có đầu vào là một máy không chạy.

### B.1. Ba nhóm mới — tất cả chỉ GET

| Nhóm | Control | Verdict khi thiếu |
|---|---|---|
| `session` | token sau logout → 401 · token hết hạn → từ chối · phiên song song (chỉ kiểm nếu spec nói) | `n/a` kèm lý do, hoặc `NEEDS_ACCOUNT` |
| `tenantIsolation` | tài khoản đơn vị A gọi **danh sách/tìm kiếm/export** → không có bản ghi đơn vị B | `NEEDS_ACCOUNT` khi thiếu tài khoản thứ hai |
| `jwt` | sửa payload không ký lại → từ chối · `alg=none` → từ chối · chữ ký sai → từ chối | `n/a` nếu hệ không dùng JWT |

`tenantIsolation` khác IDOR đã có: IDOR hỏi "đổi id có lấy được bản ghi người khác không"; nhóm này hỏi
"**tập** dữ liệu trả về có lẫn đơn vị khác không". Rò ở mức tập thì một bản ghi đúng cũng không cứu được.

**Đổi mật khẩu thật không thuộc đợt này** — nó là thao tác ghi. Ghi rõ trong tài liệu là fixture/thủ
công, để không ai tưởng đã phủ.

### B.2. Khai `n/a` trái tín hiệu discovery ⇒ cảnh báo

Hệ có JWT (thấy `Authorization: Bearer` trong `api_inventory`) mà khai `jwt: n/a` thì cảnh báo. Cùng cơ
chế `dimension_manifest` đang dùng cho chiều coverage.

---

## C. Nối vào bộ máy đang có

1. `security_catalog.example.json` + ba khối mới · `security_check.js` nhận chúng.
2. `requirements/concurrency.json` + schema; `dimension_manifest` cảnh báo khi scope có hành động
   một-lần/trừ tài nguyên/callback mà bỏ chiều §8. **Không tạo chiều mới** — §8 đã có.
3. `smoke:run --concurrency` opt-in, **mặc định tắt**, chỉ chạy kịch bản `fixture`.
4. `leak_report.js`: thêm hai trục phân loại bug — `dua` (đồng thời) và `phien_token`. Mỗi mẫu dò phải có
   **đối chứng hai chiều** như sáu trục hiện có.
5. Dashboard/report: mục kết quả đồng thời + bảng control bảo mật mới.
6. `verdict_taxonomy`: dùng lại verdict hiện có. Fixture ⇒ PASS/FAIL cứng; UAT ⇒ ADVISORY.

---

## D. Test offline (`tests/fe/infra/`)

Fixture `discovery-app` đã có POST và trạng thái sống, nên mở rộng nó thay vì dựng fixture mới. Cần
**cài lỗi đua có chủ ý** sau một cờ: duyệt hai lần · submit đúp tạo 2 bản ghi · trừ kho xuống âm ·
callback cộng tiền hai lần. Mỗi lỗi phải có **cặp**: bản hỏng ⇒ FAIL, bản đúng ⇒ PASS. Một harness chỉ
được thử trên bản đúng thì chưa ai biết nó bắt được gì.

Cộng các ca an toàn: kịch bản ghi không chạy trên target kiểu UAT khi thiếu cờ resource-test · request
ghi ngoài khai bị `write_firewall` chặn · N vượt trần ⇒ từ chối · **độ lệch thả quá ngưỡng ⇒ `CHƯA
KIỂM`** (§A.1).

---

## E. Ước tính token

| Phần | Token vào prompt bắt buộc |
|---|---|
| `concurrency_check.js`, `security_check.js` mở rộng | **0** — code, chạy bằng script |
| `concurrency.json`, `security_catalog.example.json` | **0** — config, không vào prompt |
| Bài giảng `docs/course/` | 0 — không nằm trong luồng bắt buộc |
| Mục `CHANGELOG`, `USER_GUIDE`, skill `security_check` | 0 — skill chỉ nạp khi dùng |

Replay: **0 token AI** — kịch bản khai bằng JSON, máy chạy bằng Node. Ngân sách `prompt:budget` không
tăng; nếu có chỗ nào chạm luồng bắt buộc thì cắt bù trong cùng luồng, không nới số.

---

## F. Ba chỗ rủi ro nhất, theo thứ tự

1. **Harness không đo được mình có đồng thời không** (§A.1). Chống bằng: đo độ lệch thả, quá ngưỡng ⇒
   `CHƯA KIỂM`.
2. **Fixture cài lỗi không bắt được lỗi** — thì control đó chưa có hiệu lực. Chống bằng: mỗi lỗi một cặp
   hỏng/đúng, và `mutation:check` phải giết được chúng. Prompt đặt đây là điều kiện DỪNG, tôi giữ.
3. **Kịch bản ghi trôi lên UAT.** Chống bằng: `chay_o` mặc định `fixture`, `uat_ghi` phải có cờ
   resource-test + xác nhận từng lượt, và `write_firewall` đứng sau.

---

## G. Ba câu cần bạn chốt

1. **Số hiệu `v2.8.4`** thay cho "v2.8.2" trong prompt — đồng ý không?
2. **`security_catalog.example.json`**: tôi dựng bản mẫu GENERIC (endpoint giả, để người nhận kit điền),
   hay dựng thẳng cho CSDL-9001 (có endpoint thật, dùng được ngay nhưng là dữ liệu dự án)?
3. **Phần `uat_ghi` của mục A**: để nguyên là "từ chối trừ khi có cờ + xác nhận" như thiết kế, hay đợt
   này **bỏ hẳn** đường đó cho tới khi có môi trường test riêng?
