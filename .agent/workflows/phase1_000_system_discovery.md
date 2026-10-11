# Phase 1 — Bước 0: Khám phá hệ thống

> Chạy **trước** `phase1_00_scope_planning`. Nạp **có điều kiện**: chỉ mở file này khi task chưa có
> `knowledge/system/discovery/<build>/system_map.json` cho build hiện tại.

## Vì sao có bước này

Trước v2.6.0 kit chỉ khám phá ở mức một task hoặc một màn, và luôn đi từ tài liệu. Hệ quả đo được là mẫu số
coverage chỉ gồm những gì **tài liệu nhắc tới**. Màn hoặc API không có trong tài liệu thì không ai test, và
không gate nào biết.

## Làm

```bash
TASK_ENV=profiles/<TASK>/task.env npm run discover -- --mode task \
  --base-url <url UAT> --confirm-nonprod --tai-lieu <các file .md đặc tả>
```

**Xác nhận với user trước.** Bước này chạm UAT.

Script bò bằng Playwright. Mọi request đi qua tường lửa ghi: mọi method ngoài GET, HEAD và OPTIONS bị
chặn, trừ đăng nhập. Nó cũng không bấm nút nào trong danh sách cấm bấm của
[`.agent/config/discovery.json`](../config/discovery.json).

Agent đọc **đúng bản tóm tắt** mà lệnh in ra. Không mở ảnh. Không đọc cả JSON. Cần chi tiết thì mở theo
mục.

## Đầu ra, và dùng vào đâu

| File | Ai đọc |
|---|---|
| `system_map.json` | `scope_anchor` lấy mẫu số: mọi màn và API quan sát được của module task |
| `injection_surface.json` | `dim:coverage` gác phủ injection. **Copy vào `<task>/requirements/`** |
| `doc_coverage.json` | bốn ô phủ tài liệu. Ô `undocumented_present` là vùng mù phải hỏi BA |
| `questions.md` | gộp vào `requirements/phase1-clarifications.md`, hỏi user **một lần** |
| `summary.txt` | bản tóm tắt agent đã đọc. Giữ lại để lượt sau so `delta` |

## DỪNG xin duyệt

Trình cho user bốn thứ: bản đồ module, prefix đề xuất, phạm vi task, và danh sách câu hỏi mức Critical
hoặc High.

Chưa duyệt thì **chưa ghi gì vào `knowledge/`**. Lý do: prefix và ranh giới module là quyết định đắt. Sửa
sau tốn hơn hỏi trước rất nhiều.

## Điều kiện dừng

- **Bò được 0 màn, hoặc lệnh exit khác 0.** Không đi tiếp. Một `system_map.json` rỗng đem làm mẫu số thì
  mọi tỉ lệ coverage về sau vô nghĩa.
- **Có request ghi lọt qua tường lửa.** Dừng dùng kết quả lượt đó và báo ngay.
- **Độ đầy đủ lượt bò dưới 80%.** Vẫn dùng được, nhưng **mọi** con số coverage sau đó phải ghi kèm cảnh
  báo đó.
- **Câu hỏi Critical hoặc High chưa có trả lời.** Giữ `AMBIGUITY_GATE: PENDING`, và không sinh case cho
  vùng đó.

Mọi bản ghi mang `status: observed`. Đó là thứ quan sát được, **không phải oracle**.
