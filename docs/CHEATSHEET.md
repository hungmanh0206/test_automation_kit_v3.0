# Một trang — đủ để dùng kit

> Trang này là thứ duy nhất bạn cần đọc trước khi bắt đầu. `docs/course/` và `docs/library/` là **tài
> liệu đào tạo**: chúng giải thích vì sao kit làm vậy. Không cần đọc chúng để dùng kit.

## Năm lệnh

```
/phase1  →  /phase2  →  /phase3  →  /phase4  →  /release
```

cộng **`npm run check`** — gọi lúc nào cũng được.

| Lệnh | Nó làm gì | Xong thì có gì |
|---|---|---|
| `/phase1` | **chuẩn bị**: `/start` tạo `profiles/<TASK>/task.env` rồi `/discover` bò app | profile · bản đồ màn và API |
| `/phase2` | đọc spec, hỏi cho hết mơ hồ, sinh Markdown canonical rồi xuất Excel | `test-cases/*.md` và `*.xlsx` |
| `/phase3` | execute, ghi verdict và evidence | `test-results/testcase-status.json` |
| `/phase4` | chạy lại đúng case đỏ, cập nhật evidence và verdict | status đã cập nhật |
| `/release` | cửa cuối: chạy cửa ra `done` rồi khuyến nghị go/no-go | dấu vết qua cửa |
| `npm run check` | **một lệnh kiểm**: tự nhận phase, chạy gate của phase, in một bảng gọn | biết còn phải sửa gì |


**Chín lệnh còn lại bạn KHÔNG cần nhớ**, vì `npm run check` gợi ý đúng lúc ở dòng **Lệnh tiếp theo**.
Xem thẳng bằng `npm run next -- --task <KEY>`.

| Nhóm | Lệnh |
|---|---|
| Trong dòng chảy chính | `/start`, `/publish` |
| Công cụ, gọi khi cần | `/discover`, `/preflight`, `/gates`, `/explore`, `/manual-run`, `/ui-debug`, `/partial-rerun` |

Thứ tự chạy nằm ở bảng trên, **không nằm trong tên lệnh**: trong Claude Code tên file chính là tên
lệnh, nên đánh số file là bắt bạn gõ số mỗi lần. `.agent/workflows/` và `prompt_templates/` thì CÓ
đánh số, vì chúng là file được đọc chứ không phải lệnh được gõ.

## Ba cửa ra

Mọi đường đi **ra ngoài kit** phải qua đúng một cửa. Cửa là chỗ các vi phạm đã hoãn quay lại.

| Cửa | Lệnh | Chặn khi |
|---|---|---|
| trước publish lên Sheet | `npm run exit:gate -- --cua publish` | sổ nợ còn món, hoặc gate Phase 1 còn đỏ |
| trước log bug lên Backlog | `npm run exit:gate -- --cua bug` | `bug:claim` chưa qua, thiếu tầng lỗi, thiếu evidence |
| trước chuyển Done | `npm run exit:gate -- --cua done` | sổ nợ còn món, hoặc gate Phase 2 còn đỏ |

Cửa `bug` **cố ý** không đòi sổ nợ sạch. Log bug là việc phải làm khi tìm ra lỗi thật, và nợ về chất
lượng bộ case không liên quan tới việc một bug có thật hay không.

## Đọc output của `npm run check`

```
✗ 3 lỗi phải sửa · ⚠ 5 cảnh báo · ✓ 41 kiểm đạt · ○ 1 không phán được
  task CSDL-9001 · Phase 2 · ngữ cảnh phase · 6.1s · 213 case, 83 đã execute
  làn: FULL — 32 module band High

[T0] CHẶN
  T0 EVID_THIEU · TC_138 · evidence RỖNG RUỘT step-01.png — 1280×720 mà chỉ 4 KB

[T1] chưa chặn ở ngữ cảnh này — đã ghi sổ nợ, cửa ra sẽ chặn
  T1 ORACLE_THIEU_NEO · TC_045 · kết luận mở rộng mà không có neo

sửa: `npm run check -- --explain <CODE>`
Lệnh tiếp theo: `/publish` — bộ case đã có mà chưa qua cửa publish
```

**Bốn con số, và một trong bốn hay bị đọc sai.**

- `✗` **phải sửa.**
- `⚠` cảnh báo. Đọc rồi quyết.
- `✓` số phép kiểm đã đạt.
- `○` **không phán được**: máy thiếu input để kết luận. Nó **không** phải `✓`. Coi nó là đạt là cho một
  thứ chưa ai kiểm đi qua.

**Hai tầng.** `T0` chặn ở mọi lúc, không có cờ bỏ qua. `T1` lúc đang làm chỉ cảnh báo nhưng vào sổ nợ
`reports/gate-debt.json`, và **cửa ra sẽ chặn**. Trả nợ là sửa vi phạm rồi chạy lại gate, **không**
phải xoá file sổ.

`npm run check -- --fix` tự sửa phần định dạng: alias thang `Ưu tiên`, `<br>` chuẩn, ký tự vô hình, tag
nằm nhầm trong tiêu đề, đánh số bước lệch. Nó **không** chạm `Kết quả mong đợi`, `Dữ liệu Test`,
`Loại case`, `Tiền điều kiện`. Dùng `--dry-run` để xem trước.

## Xin vượt qua cho hợp lệ

Có hai đường, và chúng khác nhau:

| Muốn gì | Đường | Giới hạn |
|---|---|---|
| bỏ qua một vi phạm **T1** | `npm run check -- --override <MÃ> --reason "<lý do>" --by <vai trò>` | lý do ≥20 ký tự; tự ghi vào `knowledge/decisions` kèm `expires_at` |
| hạ làn `full → lite` | `npm run lane -- --dat lite --ly-do "<lý do>"` | **CHẶN** nếu có module band High hoặc UNKNOWN |

**Không có đường nào vượt T0.** Không cờ, không config, không vai trò nào. Nếu bạn thấy mình đang tìm
cách tắt một gate T0 thì thứ cần sửa là nội dung, không phải gate. Gate báo oan thì sửa **luật** của nó
kèm một phép kiểm-âm, đừng tắt nó.

## Năm chỗ hay sai, và dấu hiệu

| Dấu hiệu | Thực ra là | Làm gì |
|---|---|---|
| `0 màn` sau `/discover` | session chết hoặc chưa truyền `--storage-state` | đọc dòng lỗi; đừng lấy `system_map.json` rỗng làm mẫu số |
| `canonical:drift` báo trôi | Markdown và bản xuất lệch nhau | xem **hướng** trôi. Markdown mới hơn chỉ là chưa xuất lại |
| `expected:check` báo CHƯA CÓ MỐC | chưa chụp mốc ở cửa publish | `npm run expected:snapshot`. Chụp SAU khi sửa thì gate thành đồ trang trí |
| `golden:check` LỆCH MỐC | parser canonical vừa đổi, và nó đổi đầu ra của **cả 30 gate** | đọc trường nào lệch. Chỉ `npm run golden:snapshot` khi bạn **chủ ý** đổi parser |
| `golden:check` báo NGHI GATE SAI | hai phép đếm độc lập cho hai số | đi tìm bên nào sai trước. "Chưa biết tin bên nào" không phải đạt |
| gate xanh mà bạn thấy lạ | có thể nó **kiểm 0 thứ** | đọc mẫu số trong output, ví dụ "đã so 7/10 trường" |
| `npm run check` báo CHƯA BIẾT PHASE | không có `test-cases/` lẫn file status | sinh case hoặc execute trước |

## Sáu điều không thương lượng

Đầy đủ ở [`CLAUDE.md`](../CLAUDE.md), và cả sáu đều có máy thi hành:

1. **Bảo mật**: không commit secret; mask PII; không tạo file chứa email hoặc SĐT khách.
2. **UAT không phá**: không mutate dữ liệu UAT; DB chỉ SELECT qua client guarded.
3. **Verify thật**: drive thật rồi mới phán; FAIL rerun 2–3 lần; oracle độc lập theo spec.
4. **Evidence**: mọi case đã execute, PASS và FAIL, phải có ảnh hoặc video.
5. **Scope**: `TASK_KEY` và `PROJECT_OUTPUT_DIR` bắt buộc; creds ở `profiles/<TASK>/task.env`.
6. **Không gian lận để PASS**: không nới assertion, không đổi expected để pass.
