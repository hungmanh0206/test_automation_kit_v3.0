---
description: PHASE 2 — đọc tài liệu, hỏi cho hết mơ hồ, sinh Markdown canonical, xuất Excel rồi đẩy lên Sheet.
---

Task: **$ARGUMENTS**

Thiếu mã task → `npm run task:which -- $ARGUMENTS`; thoát 2 = KHÔNG PHÁN ĐƯỢC, nó in danh sách profile để chọn. **Đừng suy từ hội thoại cũ** (CLAUDE.md §5).

> **Nạp file nào, và nạp khi nào: [`.agent/config/load_map.json`](../../.agent/config/load_map.json).**
> Đừng nạp cả chuỗi. Đo bằng `npm run prompt:budget`: chuỗi của `/phase2` là 56 file, 143k token nếu
> đọc hết, mà chỉ 5,7k trong đó là bắt buộc. File có điều kiện thì chờ đúng điều kiện mới mở.

Đọc theo thứ tự, làm đúng những gì file nói:

1. `prompt_templates/phase2/01_run_phase2.md` (điểm vào)
2. `.agent/workflows/03_scope_planning.md`
3. `.agent/workflows/04_prepare_context.md`
4. `.agent/workflows/02_tong_quan_testcase.md`

Gate bắt buộc:

```bash
node scripts/qa/preflight_gate.js --mode phase1 --task $ARGUMENTS
npm run gate:gen-testcase
npm run design:gate
npm run dim:coverage
npm run risk:gate
```

**Dừng khi:** còn câu hỏi mơ hồ về spec — **Ambiguity Gate**: gộp câu hỏi, hỏi user, chờ trả lời, phân
tích lại, rồi mới sinh testcase. Không đoán rồi sinh.

**Không publish trong lượt chạy lại:** task đã có testcase trên test-management thì dừng ở Markdown canonical cùng bản xuất Excel.
