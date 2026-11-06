---
vi_sao: "`exec:tally:check` đọc SỔ VERDICT trong thư mục task (suy từ TASK_KEY + PROJECT_OUTPUT_DIR) rồi đối chiếu với khối sinh trong file này; nó không nhận một file rời. Khối `exec-tally` ở mẫu dưới chép đúng khuôn `dungKhoi()` trong scripts/qa/exec_summary_tally.js."
---

# Mẫu `execution-summary.md` — bản đã điền

> Bản **đã điền xong** cho một lượt automation thật trên hồ sơ lớp học, không phải khung trống.
>
> Hai nửa của file này có hai chủ khác nhau, và lẫn chúng là lỗi hay gặp nhất: khối giữa hai mốc
> `exec-tally` là **MÁY SINH**, sửa tay thì `exec:tally:check` bắt; phần văn xuôi là **người viết**, và
> máy chỉ đối chiếu con số trong đó rồi **cảnh báo**, không chặn.

---

## Lượt chạy

- Task: `CSDL-9002` · Hồ sơ lớp học
- Môi trường: UAT · năm học 2026-2027 · cấp Tiểu học · trường `TEST 1`
- `RUN_ID`: `2026-11-06-01`
- Lệnh: `npm run test:task -- --task CSDL-9002`

<!-- exec-tally:bat-dau -->

### Số đã chấm — MÁY SINH, đừng sửa tay

> Nguồn: `outputs/CSDL/tasks/CSDL-9002/test-results/runs/2026-11-06-01/status.json`
> · sửa lần cuối 2026-11-06 09:14 · runId `2026-11-06-01`
>
> Đây là số của **sổ verdict đó**, không phải mẫu số của cả bộ case. Mẫu số neo ở
> `requirements/scope_inventory.md`; chênh giữa hai con số là chuyện cần giải thích bằng chữ,
> không phải chuyện sửa một trong hai cho khớp.

| Verdict | Số case |
|---|---|
| `PASSED` | 31 |
| `FAILED` | 4 |
| `BLOCKED` | 2 |
| `SKIPPED` | 1 |
| **TỔNG** | **38** |

<!-- exec-tally:ket-thuc -->

## Kể lại lượt chạy — phần người viết

Bộ canonical có **44** case, lượt này chấm **38**. Chênh 6 case là: 4 case `Manual-only` chưa tới lượt
chạy tay, và 2 case màn Điểm trường mới mở phạm vi ngày 04/11, chưa viết spec. **Chênh được giải
thích, không phải được làm cho khớp.**

### Bốn case FAILED

| TC | Tầng lỗi | Đã rerun | Kết luận |
|---|---|---|---|
| `NT-LOP-012` | `product_bug` | 3/3 lần đỏ | Lưu lớp ở phân hiệu thứ hai không ghi được bản ghi. Đã log `CSDL-4188`, ảnh mỗi step. |
| `NT-LOP-013` | `testcase_error` | 2/3 đỏ, 1 xanh | Ô `Kết quả mong đợi` ghi "lưu thành công" nên hai lượt phán khác nhau. Sửa case, **không** log bug. |
| `NT-LOP-020` | `setup_failure` | 3/3 đỏ | Bộ lọc Khối cần dữ liệu hai khối; UAT chỉ có một. **Không** log Backlog cho `setup_failure`. |
| `NT-PC-011` | `product_bug` | 3/3 đỏ | Gán trùng GVCN hai lớp không bị chặn. Đã log `CSDL-4191`. |

### Hai case BLOCKED, và vì sao chúng không thành FAIL

`NT-LOP-030` và `NT-LOP-031` cần lớp có học sinh ở hai khối. Đã tìm trên **toàn UAT**, không trường nào
có. Hẹn DBA nạp. **`BLOCKED` vì chưa dựng được tiền đề, không phải vì app sai** — chấm `FAIL` ở đây là
sinh hai bug giả.

`BLOCKED` 2/38 = **5,3%**. Dải cho phép là 10%, nên phần đã chạy còn đại diện được cho bộ.

### Đã học gì

- Phân hiệu thứ hai của trường `TEST 1` chỉ có cấp THCS — ghi `knowledge/system/`, để lần sau không ai
  dựng case lớp Tiểu học ở phân hiệu đó rồi tưởng app sai.
- Ô `Mã lớp` chặn trùng ở màn Thêm nhưng **không** chặn ở màn Sửa. Ghi `knowledge/domain/`.

---

## Hai bẫy khi viết nửa văn xuôi

**Đừng viết `TC_199 PASS`.** Máy đối chiếu bắt dạng `<số> PASS` để so với sổ, và `TC_199 PASS` từng bị
đọc thành *"199 PASS"*. Cách kể đó là cách tự nhiên nhất, nên lỗi này nổ ở gần như mọi file. Viết
`` `TC_199` → PASS `` hoặc `PASS: TC_199`.

**Số xấp xỉ thì để dấu `~`.** Máy bỏ qua số có `~` đứng trước, vì đó là lời khai xấp xỉ chứ không phải
lời khai sai. Bỏ `~` đi cho hết cảnh báo là làm lời khai **kém trung thực hơn**.
