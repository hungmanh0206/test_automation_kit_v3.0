---
description: Chạy tay case Manual-only để chúng có verdict thật, thay vì nằm mãi ở SKIP_SETUP. Never-auto, chỉ chạy khi user yêu cầu.
---

Task: **$ARGUMENTS**

**Chưa có mã task thì XÁC ĐỊNH TRƯỚC, đừng đoán.** `$ARGUMENTS` rỗng nghĩa là người dùng gõ lệnh
không kèm mã — KHÔNG được lấy mã của lượt trước trong cùng cuộc hội thoại (CLAUDE.md §5: `.auth/`
và UAT dùng chung, chạy nhầm mã là ghi kết quả sang thư mục task khác).

```bash
npm run task:which -- $ARGUMENTS
```

Thoát 0 thì mã task in ra ở stdout, dùng nó. Thoát 2 là **KHÔNG PHÁN ĐƯỢC** — nó in sẵn danh sách
profile đang có; đưa danh sách đó cho người dùng chọn rồi chạy lại. Không profile nào thì `/start`.

Nhánh này chạm UAT bằng tay, nên **xác nhận với user trước mỗi lượt chạm**.

Đọc theo đúng thứ tự:

1. `manual-run/reference.md` — ranh giới, và ba luật của kit đè luật ngoài
2. `manual-run/run_manual_execution.md` — workflow và khuôn `session.md`

Điều kiện vào: case định chạy **đã khai `[manual]`** ở ô Tiền điều kiện của bộ canonical. Chưa khai thì
**dừng** — sửa lời khai ở Phase 1 kèm lý do, hoặc mở `reports/capability-request.md` để xin test hook.
Chạy tay không phải đường lách khi viết automation khó.

Gate bắt buộc:

```bash
npm run expansion:plan
npm run manual:check -- --task $ARGUMENTS
npm run manual:check:enforce -- --task $ARGUMENTS
npm run self-review:enforce -- --task $ARGUMENTS
```

**Dừng khi:** case chưa khai `[manual]`, hoặc `manual:check:enforce` còn CHẶN → **không** ghi kết quả về
cột `Result`.
