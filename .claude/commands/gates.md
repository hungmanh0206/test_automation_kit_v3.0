---
description: Chạy bó gate trước khi finalize/publish một task — checklist gộp preflight + design + row-quality + execution + attestation.
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

```bash
npm run check -- --task $ARGUMENTS
```

`check` là MỘT lệnh thay cho chuỗi gate rời: tự nhận phase theo artifact, parse bộ case một lượt, chạy
gate của phase đó, rồi in một bảng gọn. Đo trên bộ 213 case: **2.3k byte thay cho 12.7k** của
`self-review`, và một lượt gọi thay cho hàng chục.

Nó áp luôn lớp TẦNG: vi phạm T0 chặn ngay, T1 ở đây chỉ cảnh báo nhưng vào sổ nợ
`reports/gate-debt.json` và cửa ra sẽ chặn. Muốn chặn ngay tại đây thì `--context exit`.

`npm run check -- --explain <MÃ>` để biết vì sao và sửa thế nào. `--full` để đọc nguyên văn.

`npm run self-review` vẫn còn cho người bảo trì: nó in báo cáo dài theo từng gate.

Thêm `--compact` vào bất kỳ gate LẺ nào để in gọn: mỗi vi phạm một dòng `MÃ · TC ID · ý chính`.
Nó là cách IN khác, không phải cách LỌC — mọi vi phạm vẫn có mặt. Bỏ `--compact` để đọc lại
lời giải thích đầy đủ của một mã.

Gate lẻ khi cần xem riêng nguyên nhân: `gate:output` · `gate:gen-testcase` · `design:gate` ·
`dim:coverage` · `tc:review` · `expansion:audit` · `bugs:checklist` · `gate:policy` · `mutation:check` ·
`unit:stamp` (mọi verdict đã chạy phải khai ĐƠN VỊ đã đo — `unit:stamp:enforce` để chặn).

**Dừng khi:** còn dòng CHẶN. Sửa nội dung cho đúng luật — **không** nới ngưỡng gate, không dùng cờ bỏ qua
để cho xanh. Gate báo oan thì sửa **luật** (kèm kiểm-âm), đừng tắt gate.
