---
description: Sinh bộ testcase cho một task (Phase 1) — đọc spec, hỏi cho hết mơ hồ, rồi mới sinh Markdown canonical và xuất Excel.
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

> **Nạp file nào, và nạp khi nào: [`.agent/config/load_map.json`](../../.agent/config/load_map.json).**
> Đừng nạp cả chuỗi. Đo bằng `npm run prompt:budget`: chuỗi của `/phase1` là 56 file, 143k token nếu
> đọc hết, mà chỉ 5,7k trong đó là bắt buộc. File có điều kiện thì chờ đúng điều kiện mới mở.

Đọc theo thứ tự, làm đúng những gì file nói:

1. `prompt_templates/run_phase1_template.md` (điểm vào)
2. `.agent/workflows/phase1_00_scope_planning.md`
3. `.agent/workflows/phase1_01_prepare_context.md`
4. `.agent/workflows/phase1_generate_tc.md`

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
