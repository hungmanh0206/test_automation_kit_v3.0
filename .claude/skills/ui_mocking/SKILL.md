---
name: ui_mocking
description: Chặn response bằng page.route để cô lập dependency ngoài scope hoặc inject fault (5xx/timeout/abort), rồi kiểm FE xử lý response đó thế nào. Dùng khi dependency ngoài không sẵn, hoặc cần dựng nhánh lỗi không tạo được thật. KHÔNG dùng để mock chính logic đang kiểm thử, và KHÔNG dùng case mock để kết luận về backend.
---

<!-- SINH TỰ ĐỘNG bởi `node scripts/qa/skills_index.js --write` — ĐỪNG SỬA TAY. -->

**Bản đầy đủ: [`.agent/skills/phase2/ui_mocking/SKILL.md`](../../../.agent/skills/phase2/ui_mocking/SKILL.md) — đọc file đó trước khi làm.**

File này chỉ là con trỏ để harness thấy skill. Mọi luật, bảng và số đo nằm ở bản gốc.
