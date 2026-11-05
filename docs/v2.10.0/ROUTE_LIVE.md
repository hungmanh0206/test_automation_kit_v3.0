# skills:route:live — số đo chuẩn của v2.10.0

Đo **05/11/2026**, model CLI `2.1.285 (Claude Code)`, **4 lượt TUẦN TỰ** (`--song-song 1`), mỗi lượt 90 câu
(70 ca thật + 20 ca `none`), ở **gốc repo thật** (hook SessionStart CÓ chạy, đã gỡ dòng danh sách skill).

Công cụ làm việc bị chặn để model không đi dò thay vì định tuyến. Skill được chọn đọc từ **lời gọi công
cụ `Skill`**, không từ lời model tự thuật. Lượt không chạy được bị **loại khỏi mẫu số**.

## Kết quả

| | lượt 1 | lượt 2 | dải | trung bình |
|---|---|---|---|---|
| "trước" — 12 mô tả DÀI (~250 ký tự) | 70% (49/70) | 68.6% (48/70) | 68.6–70.0 | **69.3%** |
| "sau" — 12 mô tả NGẮN (~140 ký tự) | 64.7% (44/68) | 73.5% (50/68) | 64.7–73.5 | **69.1%** |

Cả bốn lượt: **0** ca chọn SAI skill · **0** lẫn trong cặp dễ nhầm · **0** ca `none` kích hoạt nhầm.

## Đọc thế nào

**Nhát rút mô tả không gây hại đo được.** Hai dải chồng lên nhau hoàn toàn, trung bình chênh 0,2 điểm.
Luật đọc này được viết TRƯỚC khi có số.

**Độ phân giải của phép đo là ~9 điểm.** Hai lượt của CÙNG một trạng thái ("sau") lệch nhau 8,8 điểm.
Mọi chênh lệch nhỏ hơn cỡ đó không phân biệt được với dao động — nên một phép so một-lượt-một-lượt
không bao giờ đủ để kết luận về một thay đổi.

**Tiêu chí 2.2 CHƯA ĐẠT.** ~69% so với ngưỡng 90%. Mọi ca trượt đều là *"không gọi skill nào"* — không
ca nào chọn sai. Và đây là CHẶN DƯỚI: bộ đo chặn mọi công cụ làm việc, trong lượt dùng thật model có thể
mở skill muộn hơn.

## Dữ liệu từng lượt

[`RL_truoc_1.md`](RL_truoc_1.md) · [`RL_truoc_2.md`](RL_truoc_2.md) · [`RL_sau_1.md`](RL_sau_1.md) · [`RL_sau_2.md`](RL_sau_2.md)

Năm báo cáo chạy 3 luồng trước đó (`ROUTE_LIVE_*`) được giữ lại với nhãn ⛔ KHÔNG ĐỌC ĐƯỢC.

## Chạy lại

```bash
npm run skills:route:live -- --trong-repo --ra docs/<phiên bản>/RL_<nhãn>.md
```

Không vào CI: mỗi lượt là ~36 phút model thật. Chạy tay trước mỗi bản phát hành, **ít nhất 2 lượt**.
