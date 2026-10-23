---
description: Execute testcase của một task (Phase 2) — dựng automation, chạy thật trên UAT, chấm verdict theo taxonomy.
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

> **Đầu lượt chỉ đọc hai thứ: `handoff/phase1.md` của task, và artifact canonical.** Hội thoại của
> lượt trước KHÔNG phải nguồn — nó không qua gate nào, và sau một lần nén thì chính nó cũng mất chi
> tiết. Chưa có file bàn giao thì `preflight_gate` sẽ kêu; đọc `reports/` của phase trước thay thế.

Đọc: `prompt_templates/run_phase2_template.md` → `.agent/workflows/phase2_execute.md` (nó dẫn tiếp sang
`phase2_01`…`phase2_04`).

Gate bắt buộc:

```bash
node scripts/qa/preflight_gate.js --mode phase2 --task $ARGUMENTS
npm run expansion:plan
npm run gate:output
npm run self-review -- --task $ARGUMENTS
npm run bugs:checklist
```

**Dừng khi:**
- Chưa **xác nhận với user** trước lượt chạm UAT đầu tiên.
- Có FAIL mà chưa rerun 2–3 lần để loại flaky/setup.
- `self-review` còn CHẶN — sửa nguyên nhân, không nới ngưỡng.
