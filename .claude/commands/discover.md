---
description: Bước 0 của Phase 1 — bò app bằng script tất định rồi trả bản đồ màn, API, vùng mù tài liệu và bề mặt injection. Dùng khi mở một hệ thống hoặc một module mà chưa biết nó có những gì.
---

Task: **$ARGUMENTS**

Script làm hết việc bò, đọc DOM, bắt network, gộp nguồn. **Bạn chỉ đọc bản tóm tắt** mà lệnh in ra
(`task` ≤ 2k token · `delta` ≤ 1k · `system` ≤ 4k). Chi tiết nằm trong JSON — mở đúng mục cần, đừng đọc cả file.

| Chế độ | Khi dùng | Phạm vi |
|---|---|---|
| `task` | đầu mỗi Phase 1 (mặc định) | module của task + lân cận 1 bước |
| `delta` | build mới, trước regression | chỉ phần khác so với snapshot gần nhất (v2.6.1) |
| `system` | nhận dự án mới | toàn app, theo giới hạn lượt bò |

```bash
TASK_ENV=profiles/<TASK>/task.env npm run discover -- --mode task \
  --base-url <url UAT> --confirm-nonprod \
  --tai-lieu <đường dẫn .md đặc tả, cách nhau bằng dấu phẩy>
```

Không có `--confirm-nonprod` thì lệnh **từ chối**. Host không khớp dấu hiệu non-prod cũng từ chối — nó
không đoán.

`--mode delta` so **hình dạng** với lượt bò gần nhất **cùng host và cùng phạm vi**. Nó nêu màn mới, màn
biến mất, field đổi ràng buộc (`maxlength`, `required`, `pattern`), rồi component và API mới hoặc mất.
Nó **không** so giá trị dữ liệu. Dữ liệu UAT đổi mỗi ngày, nên so nó thì lượt nào cũng có khác biệt và một
thay đổi thật chìm theo. Đọc kỹ một phân biệt: **"chưa có snapshot để so" KHÁC "0 khác biệt"**. Hai câu
cùng ra số 0 mà nghĩa ngược nhau. Phần đề xuất chạy lại chỉ là đề xuất, người chốt phạm vi.

## Rồi làm hai việc với kết quả

1. **Gộp `questions.md` vào `requirements/phase1-clarifications.md`** rồi hỏi user **một lần**. Câu
   Critical/High chưa trả lời thì giữ `AMBIGUITY_GATE: PENDING`.
2. **Copy `injection_surface.json` vào `<task>/requirements/`** — `dim:coverage` đọc nó để gác phủ
   injection. Thiếu file đó thì gate chỉ cảnh báo "chưa được gác".

Mọi bản ghi mang `status: observed`. Đó là **sự thật quan sát, không phải oracle**: muốn dùng làm căn cứ
PASS/FAIL thì phải qua Ambiguity Gate hoặc có người xác nhận, rồi mới vào `knowledge/`.

## Dừng khi

- **Chưa xác nhận chạm UAT với user.** Lệnh này mở hàng chục trang trên môi trường thật.
- **`0 màn` hoặc lệnh exit ≠ 0.** Đọc dòng lỗi rồi sửa nguyên nhân. Một `system_map.json` rỗng mà đem
  làm mẫu số thì mọi tỉ lệ coverage về sau vô nghĩa.
- **Có `request ghi lọt` > 0.** Dừng dùng kết quả lượt đó và báo ngay: tường lửa ghi là điều kiện để
  được phép chạm UAT.
- **Độ đầy đủ dưới 80%.** Không chặn, nhưng mọi con số coverage sau đó phải ghi kèm cảnh báo đó.
