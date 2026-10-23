---
description: Sửa/dọn một phần bộ testcase khi requirement đổi — chuẩn bị bản review trước, chỉ apply sau khi user duyệt.
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

Đọc theo đúng thứ tự (bản review TRƯỚC, apply SAU):

1. `partial-rerun/reference.md`
2. `partial-rerun/run_requirement_prepare_review.md`
3. `partial-rerun/run_requirement_apply_approved.md` — **chỉ khi user đã duyệt bản review**
4. `partial-rerun/run_testcase_cleanup.md` (khi cần dọn case cũ)

Gate bắt buộc:

```bash
npm run gate:gen-testcase
npm run gate:output
npm run self-review -- --task $ARGUMENTS
npm run expansion:plan
```

**Dừng khi:** chưa có xác nhận của user cho bản review → **không** chạy bước apply.
