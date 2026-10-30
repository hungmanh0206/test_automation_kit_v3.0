---
name: test_data_generator
description: Sinh test data cụ thể, unique theo RUN_ID, truy vết được và rollback được cho Phase 1 và Phase 2. Dùng khi case cần dữ liệu mới thay vì dữ liệu sẵn có. KHÔNG dùng để dựng state qua DB, và KHÔNG sinh dữ liệu chứa PII khách thật.
---

<!-- SINH TỰ ĐỘNG bởi `node scripts/qa/skills_index.js --write` — ĐỪNG SỬA TAY. -->

**Bản đầy đủ: [`.agent/skills/shared/test_data_generator/SKILL.md`](../../../.agent/skills/shared/test_data_generator/SKILL.md) — đọc file đó trước khi làm.**

File này chỉ là con trỏ để harness thấy skill. Mọi luật, bảng và số đo nằm ở bản gốc.
