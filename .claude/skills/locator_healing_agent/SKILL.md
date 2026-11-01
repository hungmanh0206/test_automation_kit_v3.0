---
name: locator_healing_agent
description: Khi locator ACTION fail lúc execute, thử fallback chain và tự áp dụng nếu confidence cao (accessible name exact + role + vùng DOM); ghi lịch sử vào knowledge/locators/. KHÔNG heal locator assertion. Threshold-gated, opt-in LOCATOR_HEAL=1.
---

<!-- SINH TỰ ĐỘNG bởi `node scripts/qa/skills_index.js --write` — ĐỪNG SỬA TAY. -->

**Bản đầy đủ: [`.agent/skills/phase2/locator_healing_agent/SKILL.md`](../../../.agent/skills/phase2/locator_healing_agent/SKILL.md) — đọc file đó trước khi làm.**

File này chỉ là con trỏ để harness thấy skill. Mọi luật, bảng và số đo nằm ở bản gốc.
