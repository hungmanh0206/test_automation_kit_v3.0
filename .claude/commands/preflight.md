---
description: Kiểm input/config bắt buộc TRƯỚC khi bắt đầu một phase — thiếu file, JSON hỏng, hoặc chưa có testcase canonical thì chặn.
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

Chạy cửa vào:

```bash
node scripts/qa/preflight_gate.js --mode phase2 --task $ARGUMENTS
```

Đổi `--mode` theo việc đang làm: `phase1` · `phase2` · `publish` · `generic` (CI/static).

Nếu task khai dùng §23 (`db_persistence` trong `dimension_manifest.json`, hoặc testcase có tag
`[DbPersist]`) thì gate còn đọc quyền DB thật; mất VPN thì dùng `--skip-db-live` **và nói ra** là chưa
có bằng chứng read-only.

**Dừng khi:** exit ≠ 0. Đọc từng dòng CHẶN và sửa nguyên nhân — không dùng `--qa-approved` để đi tiếp
trừ khi user yêu cầu tường minh.
