---
name: load_check
description: Chạy load/stress/soak (Loại B, nhiều VU) qua k6 — wrapper mỏng, parse summary → report. k6 là binary NGOÀI (không phải npm dep). Never-auto, chỉ non-prod, cap khiêm tốn. Loại A single-user dùng perf_check.
---

<!-- SINH TỰ ĐỘNG bởi `node scripts/qa/skills_index.js --write` — ĐỪNG SỬA TAY. -->

**Bản đầy đủ: [`.agent/skills/phase2/load_check/SKILL.md`](../../../.agent/skills/phase2/load_check/SKILL.md) — đọc file đó trước khi làm.**

File này chỉ là con trỏ để harness thấy skill. Mọi luật, bảng và số đo nằm ở bản gốc.
