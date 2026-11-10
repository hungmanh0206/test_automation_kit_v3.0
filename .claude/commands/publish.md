---
description: Đồng bộ testcase / kết quả execution với Google Sheet — luôn xem lại bản merge local trước khi ghi đè Sheet thật.
---

Task: **$ARGUMENTS**

> `$ARGUMENTS` vào thẳng script. Thiếu/sai mã → `npm run task:which -- $ARGUMENTS` (thoát 2 = KHÔNG
> PHÁN ĐƯỢC, in danh sách để chọn); **đừng suy từ hội thoại cũ** — §5.
> Tham số thêm: prompt mẫu USER_GUIDE 9.2.

> **Đầu lượt chỉ đọc hai thứ: `handoff/phase1.md` của task, và artifact canonical.** Hội thoại của
> lượt trước KHÔNG phải nguồn — nó không qua gate nào, và sau một lần nén thì chính nó cũng mất chi
> tiết. Chưa có file bàn giao thì `preflight_gate` sẽ kêu; đọc `reports/` của phase trước thay thế.

**Publish testcase** (sau khi Phase 1 xuất `.xlsx` canonical) — đọc và làm theo:

1. `prompt_templates/phase2/06_auto_publish_backlog.md` (điểm vào, có khối QA confirmation)
2. `.agent/workflows/07_auto_publish_backlog.md` (preconditions + các bước Drive MCP)
3. Skill: `.agent/skills/shared/backlog_testcase_publisher/SKILL.md`

**Đồng bộ kết quả execute** (sau Phase 2) — đọc `.agent/workflows/12_report_and_backlog_gate.md`.
Lệnh merge:

```bash
node scripts/convert_excel/merge_execution_status.js <xlsx-đã-tải-về> <testcase-status.json>
```

Lệnh này **CHỈ ghi đè `.xlsx` LOCAL** (cột `Result`) — chưa đụng Sheet thật. Mở file local **soi lại**
(đúng case đổi, không case nào khác bị đụng) rồi mới `update_file` đè lên Drive; Drive không giữ version
cũ theo mặc định nên đây là bước tương đương "dry-run" của luồng REST ngày trước.

**Dừng khi:** chưa tải bản Sheet mới nhất về trước khi execute (luôn `download_file_content` trước mỗi
lượt Phase 2, không dùng `.xlsx` cũ) · QA chưa xác nhận Excel được phép publish · gate chất lượng của
`merge_execution_status.js` chặn mà chưa `--qa-approved` có chủ đích · chưa soi lại file local trước khi
ghi đè Drive.
