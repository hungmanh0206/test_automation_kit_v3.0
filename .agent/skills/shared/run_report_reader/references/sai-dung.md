# Cặp sai → đúng khi đọc kết quả một lượt chạy

> Khuôn giống `tc_design_guide/references/anti_patterns.md`. Mỗi dòng ❌ là một cách đọc đã sinh ra kết
> luận sai thật; dòng ✅ là cách đọc đúng kèm nguồn phải tra.

---

## 1. Đọc tỉ lệ pass trước khi đọc mẫu số

❌ *"Lượt này 31/38 = 81,6% pass, khá ổn."*

✅ *"Bộ canonical có 44 case, lượt này chấm 38. Chênh 6: 4 case Manual-only chưa chạy tay, 2 case màn mới chưa viết spec. 81,6% là tỉ lệ của 38 case đã chấm, không phải của bộ."*

Mẫu số neo ở `requirements/scope_inventory.md`, không neo ở số case đã chạy. Đọc ngược thứ tự là lấy
một con số đẹp rồi mới tìm nó nói về cái gì.

---

## 2. `0%` lỗi trên `0` request đọc thành "đạt"

❌ *"Lượt load test 0% lỗi — hệ chịu tải tốt."*

✅ *"Lượt gửi **0** request, nên 0% lỗi là KHÔNG BIẾT, không phải đạt. Kiểm lại cấu hình trước khi đo lại."*

Áp cho mọi phép đo có mẫu số: perf, load, coverage. Một tỉ lệ trên mẫu số 0 là một ô trống mặc áo.

---

## 3. Ô trống trong biểu đọc thành "không đọc được"

❌ *"Ô Số học sinh khối 3 trống ⇒ không lấy được số ⇒ FAILED, nghi app lỗi."*

✅ *"Ở màn này ô trống nghĩa là `0`. So với SQL: khối 3 thật sự có 0 học sinh. PASSED."*

Đọc ô trống thành "không đọc được" đã sinh ra `FAILED` và `product_bug` **giả**. Tra quy ước của màn
trước khi phán.

---

## 4. `BLOCKED` cao đọc thành tin xấu về sản phẩm

❌ *"18% case BLOCKED — chất lượng build này tệ."*

✅ *"18% BLOCKED vượt dải trên, nên phần đã chạy KHÔNG còn đại diện cho bộ. `run:analysis:enforce` chặn. Đây là tin xấu về **mẫu số**, chưa nói gì về chất lượng."*

`BLOCKED` nghĩa là chưa đo được, không nghĩa là đo ra sai.

---

## 5. `script_error` đè verdict cũ

❌ *"Lượt này chết giữa đường ⇒ 12 case đó FAILED."*

✅ *"Lượt chết vì lỗi script. 12 case đó GIỮ verdict lần trước; `script_error` không đè verdict."*

Trộn hai thứ đó là **mất verdict thật**, và đã mất 18 verdict trong một ngày vì đúng lỗi này.

---

## 6. Tin lời kể của `execution-summary.md` thay vì tra artifact

❌ *"Summary ghi 'đã chạy hết P1' ⇒ P1 đã phủ."*

✅ *"Summary là lời **người** viết, máy không đối chiếu được. Tra `testcase-status.json` và `ledger:check` trước; đọc summary SAU, để biết nó kể sót gì."*

Đây là chỗ skill tự khai **không có máy kiểm**. Thứ tự đọc quan trọng: artifact trước, lời kể sau.

---

## 7. Đọc một lượt rồi kết luận về một thay đổi

❌ *"Lượt sau khi sửa ra 32,9%, lượt trước 50% ⇒ bản sửa làm hỏng."*

✅ *"Hai lượt của **cùng một trạng thái** đã lệch 8,8 điểm. Chênh nhỏ hơn cỡ đó không phân biệt được với dao động — chạy ít nhất 2 lượt mỗi bên trước khi kết luận."*

Và kiểm trước: trong hai lượt đó có lượt nào **không chạy được** mà bị đếm thành kết quả không. Một lượt
bị throttle trông y hệt một lượt "không tìm thấy gì".
