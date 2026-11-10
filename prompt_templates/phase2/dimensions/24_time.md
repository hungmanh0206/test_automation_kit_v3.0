# §24 — Thời gian và lịch (hành vi phụ thuộc ngày, giờ, kỳ)

> Tag bắt buộc trong tiêu đề case: **`[Time]`**. Loại case: **Functional**.
>
> Mở khi hành vi phụ thuộc **thời điểm**:
>
> - hạn nộp
> - kỳ hoặc đợt
> - năm học
> - hiệu lực từ–đến
> - tuổi tính theo ngày sinh
> - job chạy theo lịch
> - hiển thị "còn N ngày"
> - khoá và mở theo mốc

## Vì sao chiều này tồn tại

Lỗi thời gian **không tự lộ ra trong ngày chạy test**. Một case "tạo lớp cho năm học 2026-2027" xanh hôm
nay và vẫn xanh suốt năm. Rồi nó sai đúng vào ngày chuyển kỳ, lúc không ai đang chạy suite.

Đây là lớp lỗi duy nhất mà **thời điểm chạy** là một phần của đầu vào. Nhưng không case nào khai nó ra.

| Lỗi | Vì sao lượt chạy bình thường không thấy |
|---|---|
| Biên mốc lệch 1 ngày (`<` thay vì `<=` ở hạn cuối) | chỉ sai đúng ngày hạn |
| Năm học suy từ `new Date()` thay vì tham số | đúng 9 tháng mỗi năm |
| Tuổi tính theo hiệu năm, không theo ngày và tháng | sai với người sinh sau ngày chạy |
| Giờ hiển thị theo máy người dùng, giờ lưu theo server | hai máy cùng múi giờ thì không thấy |
| Năm nhuận · 29/02 · 31/04 | 1 ngày trong 1.461 ngày |
| Job chạy lịch không chạy, hoặc chạy hai lần | không có dấu vết trên UI |

## Công cụ — và ĐÚNG GIỚI HẠN của nó

`page.clock` **có thật và chạy được** trong kit (đo 13/10/2026, Playwright 1.60). Ép giờ trang sang
`2030-01-02T03:04:05Z` thì `new Date()` **trong trang** trả đúng mốc đó.

```ts
await page.clock.setFixedTime(new Date('2027-05-31T23:59:00+07:00'));   // đứng yên ở một mốc
await page.clock.install({ time: new Date('2027-05-31T16:00:00Z') });   // rồi fastForward/runFor
```

> ⛔ **`page.clock` CHỈ đổi đồng hồ TRÌNH DUYỆT.** Nó không chạm đồng hồ server.
>
> Nhiều màn của dự án này tính mốc ở **server**: ASP.NET WebForms tính hạn, sinh năm học, đóng kỳ ở
> back-end. Với những màn đó, ép giờ trang **không đổi được gì** ngoài phần hiển thị và phần validate
> phía client.
>
> Hệ quả phải viết thẳng vào case, không được lờ đi. **Case nào đo mốc do server quyết thì là `Manual`.**
> Cách đo là **chọn dữ liệu có sẵn ở đúng phía mốc**, không phải "đợi tới ngày đó".

| Mốc do ai quyết | Đo thế nào | Tự động được? |
|---|---|---|
| Client: đếm ngược, bật và tắt nút theo giờ, validate ngày ở form | `page.clock` | **có** |
| Server: hạn nộp, đóng kỳ, sinh năm học, job theo lịch | chọn bản ghi đã ở đúng phía mốc; hoặc fixture có ngày đặt sẵn | **không** — `Manual` |
| Lưu trữ: múi giờ của giá trị đã ghi | §23 `instant()` | có, qua §23 |

## Checklist — mỗi dòng một case

| # | Ca | Ghi chú |
|---|---|---|
| 1 | **Đúng mốc** — ngay tại thời điểm hạn (giây cuối cùng) | biên dưới của "còn hạn" |
| 2 | **Qua mốc 1 đơn vị** — sau hạn 1 phút hoặc 1 ngày | biên trên; đây là ca hay lộ `<` vs `<=` |
| 3 | **Trước mốc 1 đơn vị** | đối chứng âm của ca 2 |
| 4 | Ngày biên của kỳ: đầu kỳ, cuối kỳ, ngày chuyển kỳ | năm học đổi vào ngày nào là **câu hỏi cho BA**, không tự suy |
| 5 | 29/02 và năm nhuận, nếu có trường ngày | |
| 6 | Múi giờ: nhập 23:00 giờ VN rồi đọc lại vẫn 23:00 | phần lưu trữ đẩy sang §23 |
| 7 | Giá trị dẫn xuất từ ngày (tuổi, số ngày còn lại, số buổi) | **neo bằng oracle ⑦**, không so với chính app |
| 8 | Job theo lịch: chạy đúng một lần, và bản ghi mang dấu vết | thường `Manual` |

## Ba ràng buộc

**① Kỳ vọng phải nói RÕ MỐC, không nói "hôm nay".** Ô `Kết quả mong đợi` ghi `"31/05/2027 23:59 còn nộp
được; 01/06/2027 00:00 báo quá hạn"`. Đừng ghi `"sau hạn thì báo lỗi"`. Một kỳ vọng không có mốc thì
không ai chạy lại được. Và đúng một năm sau, không ai biết nó từng đúng vì cái gì.

**② `[Time]` KHÔNG được dựa vào giờ thật của máy chạy.** Một case xanh vì hôm nay là 13/10 thì ngày mai
là một case khác. Hoặc ép đồng hồ phía client, hoặc ghim dữ liệu có ngày đặt sẵn phía server. Cả hai
đường đều phải ghi ra trong `Tiền điều kiện`.

**③ Năm học ghim trong tiền điều kiện.** Dự án này dùng `MA_NAM_HOC`, và bản ghi đổi theo năm. Một câu
truy vấn không ghim năm sẽ vớ phải bản ghi năm cũ rồi trả lời sai. Mỗi case `[Time]` nói rõ năm học nó
đứng, kể cả khi tưởng như không liên quan.

## Chỗ dễ sai nhất: "đợi tới ngày đó"

Đừng viết case kiểu *"đến 01/06 kiểm tra lại"*. Nó không chạy được, không rerun được, và trên thực tế
thành `SKIP` vĩnh viễn. Mà `SKIP` thì **không** được tính là PASS (`CLAUDE.md` §3).

Mốc do server quyết mà không có bản ghi nào ở đúng phía mốc thì kết luận đúng là **`BLOCKED` kèm câu hỏi
"cần fixture ngày X"**. Đó không phải một case xanh vì chưa tới hạn.

## Liên quan

- §3 Field validation: ô ngày: định dạng, biên
- §13 Business logic: công thức có ngày
- §23 DB Persistence: múi giờ của giá trị đã ghi, qua `instant()`
- §25 Legacy: bản ghi cũ mang ngày theo luật cũ
- trục ⑦ `oracle_calc`: giá trị dẫn xuất từ ngày phải có oracle độc lập
