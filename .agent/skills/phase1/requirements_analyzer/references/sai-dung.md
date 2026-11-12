# Cặp sai → đúng khi phân tích requirement

> Khuôn giống `tc_design_guide/references/anti_patterns.md`. Dòng ❌ là chỗ đã gặp thật khi đọc đặc tả
> app mẫu; dòng ✅ là cách đọc đúng kèm nguồn phải tra.

---

## 1. Trích một câu rồi kết luận, không đọc trọn ô

❌ *"Đặc tả ghi 'Phân hiệu chỉ đổi khi thêm mới' ⇒ ô Phân hiệu phải khoá ở màn Sửa."*

✅ *"Đọc TRỌN ô `Kết quả mong đợi` của Stt 6a: câu quyết định nằm ở **gạch đầu dòng cuối**, và nó nói ô khoá chỉ áp cho luồng thêm. Tra lại trước khi viết case."*

Câu quyết định hay nằm ở cuối ô, không ở đầu. Đã có ba case bị chặn oan vì đọc nửa ô.

---

## 2. Lấy digest làm canonical

❌ *"`CLAUDE.md` §5 ghi 'creds ở `task.env`, KHÔNG `.env` chung' ⇒ chỗ này đang lệch luật."*

✅ *"Tra cả ba tầng: `CLAUDE.md` (digest, viết phẳng nên mất ngoại lệ) → `RULE_GLOBAL.md` (canonical) → artifact thực thi (`task.env.example`). Hai nguồn sau đặt key cấp tài khoản ở `.env` chung, nên đây KHÔNG lệch."*

Chính `CLAUDE.md` ghi *"mâu thuẫn thì theo `RULE_GLOBAL.md`"*. Digest viết ngắn nên viết phẳng, và chỗ
phẳng là chỗ mất ngoại lệ.

---

## 3. Suy ràng buộc từ thông báo lỗi của app

❌ *"App báo 'Vui lòng nhập Mã lớp' ⇒ Mã lớp là ô bắt buộc."*

✅ *"Neo quyết định là **số thứ tự màu đỏ** trên form, không phải thông báo lỗi. Suy từ thông báo đã sai nhiều lần: app có thể báo lỗi cho ô không bắt buộc khi nó phụ thuộc ô khác."*

Oracle suy từ app là `app == app`. Nó luôn khớp, kể cả khi app sai.

---

## 4. Thiếu ràng buộc thì coi như không có ràng buộc

❌ *"Tài liệu không nói gì về độ dài Tên lớp ⇒ không cần case biên."*

✅ *"Ghi `spec:gap`: tài liệu KHÔNG nêu ràng buộc độ dài. Vẫn viết case biên và chấm `OBSERVATION` (không `PASS`/`FAIL`), rồi hỏi BA."*

*"Tài liệu không nói"* khác *"không có ràng buộc"*. Bỏ qua là tạo một vùng mù mà không ai biết nó tồn tại.

---

## 5. Gộp hai trục phân loại làm một

❌ *"Nhóm chức năng: Validation"*

✅ *"`Nhóm chức năng` = test Ở ĐÂU (màn Hồ sơ lớp học) · `Loại case` = KIỂM KIỂU GÌ (`Functional`). Hai trục khác nhau, hai cột khác nhau."*

Gộp lại thì không lọc được theo trục nào, và báo cáo theo loại case mất nghĩa.

---

## 6. Tin hai cột gần như luôn bằng nhau là một cột

❌ *"`MA_TRUONG` và mã Bộ luôn giống nhau ⇒ dùng cột nào cũng được."*

✅ *"Đo trên toàn bộ dữ liệu: hai cột lệch ở một số trường. 'Gần như luôn bằng nhau' không phải 'bằng nhau' — neo theo cột mà đặc tả nêu."*

Hai vế từng khớp 5/5 trong một mẫu nhỏ rồi bị bác khi đo mẫu lớn. Nhất quán không phải bằng chứng của
đúng.

---

## 7. Mẫu số coverage do chính mình đặt ra

❌ *"Đã phủ 42/42 requirement ⇒ 100%."*

✅ *"42 là con số **tôi** liệt kê. Neo mẫu số ở `requirements/scope_inventory.md`, mỗi mục kèm nguồn (file#anchor), rồi `scope:anchor:enforce` mới có gì để đối chiếu."*

Không có danh mục thì `100%` chỉ nghĩa *"đủ theo tôi thấy"*, và con số đó không phân biệt được với một
bộ sinh thiếu.
