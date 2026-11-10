---
description: PHASE 4 — rerun sau khi bug được sửa. Chạy lại case liên quan và cập nhật kết quả; không sinh testcase mới.
---

Task: **$ARGUMENTS**

Thiếu mã task → `npm run task:which -- $ARGUMENTS`; thoát 2 = KHÔNG PHÁN ĐƯỢC, nó in danh sách profile để chọn. **Đừng suy từ hội thoại cũ** (CLAUDE.md §5).

> **Nạp file nào, và nạp khi nào: [`.agent/config/load_map.json`](../../.agent/config/load_map.json).**
> Đừng nạp cả chuỗi. Đo bằng `npm run prompt:budget`: chuỗi của `/phase2` là 56 file, 143k token nếu
> đọc hết, mà chỉ 5,7k trong đó là bắt buộc. File có điều kiện thì chờ đúng điều kiện mới mở.

> Chỉ truyền đúng `<TASK_KEY>`, **không kèm bug key** — `$ARGUMENTS` đi thẳng vào
> `preflight_gate.js --task`, thêm chữ là gate nhận sai task rồi chặn. Bug/case cần rerun thì nói ở
> câu tiếp theo ("rerun bug CSDL-1234"), hoặc dùng prompt mẫu ở USER_GUIDE Mục 9.2.

> **Đầu lượt chỉ đọc hai thứ: `handoff/phase2.md` của task, và artifact canonical.** Hội thoại của
> lượt trước KHÔNG phải nguồn — nó không qua gate nào, và sau một lần nén thì chính nó cũng mất chi
> tiết. Chưa có file bàn giao thì `preflight_gate` sẽ kêu; đọc `reports/` của phase trước thay thế.

Đọc: `prompt_templates/phase4/01_run_phase4.md` → `.agent/workflows/13_tong_quan_rerun.md`
(→ `14_map_bug_to_testcase.md` · `15_rerun_and_verify.md` · `16_update_backlog_and_report.md`).

Gate bắt buộc:

```bash
node scripts/qa/preflight_gate.js --mode phase2 --task $ARGUMENTS
npm run bug:tc-match
npm run expansion:plan
npm run gate:output
npm run bugs:checklist
```

**Dừng khi:** chưa xác nhận chạm UAT · kết quả rerun cách thời điểm comment quá xa (deploy có thể lật
ngược kết quả — xác nhận sát giờ) · map bug→case còn ở mức "đề xuất" mà chưa ai duyệt.
