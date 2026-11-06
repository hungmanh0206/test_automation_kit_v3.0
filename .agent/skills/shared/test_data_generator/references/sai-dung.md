# Cặp sai → đúng khi sinh test data

> Khuôn giống `tc_design_guide/references/anti_patterns.md`. Dòng ❌ là chỗ đã gặp thật trên UAT QEMIS;
> dòng ✅ là bản viết lại, và **cột ✅ không vi phạm gate nào**.

---

## 1. Dữ liệu cố định, không mang `RUN_ID`

❌ `Mã lớp: 1C` · `Tên lớp: 1C`

✅ `Mã lớp: 1C-${RUN_ID}` · `Tên lớp: Lớp thử ${RUN_ID}`

Mã cố định thì **lượt thứ hai gặp lỗi trùng mã và FAIL** — rồi FAIL đó bị đọc thành bug sản phẩm. Đã
xảy ra thật. Và hai lượt song song của hai task sẽ xoá dữ liệu của nhau ở bước cleanup.

---

## 2. Cleanup dọn theo TÊN thay vì theo `RUN_ID`

❌ `afterEach: xoá mọi lớp có tên "1C"`

✅ `afterEach: xoá mọi lớp có mã khớp "1C-${RUN_ID}"`

Dọn theo tên là dọn cả của lượt khác. Đây là một trong năm chỗ `automation_reviewer` soi tay, vì máy
không bắt được: cleanup vẫn chạy, vẫn xanh, chỉ là nó xoá sai thứ.

---

## 3. Dựng tiền đề bằng DB

❌ `INSERT INTO LOP (MA_LOP, TEN_LOP, ID_TRUONG) VALUES (...)` để có lớp cho case Sửa.

✅ Dựng qua UI hoặc API: gọi màn Thêm lớp, hoặc endpoint tạo lớp, rồi đọc lại để xác nhận.

DB chỉ **read-only** và chỉ để verify. Dựng state bằng DB thì bỏ qua đúng phần logic mà case định kiểm,
và một bản ghi do `INSERT` tạo có thể thiếu cột mà app luôn điền — case xanh trên một trạng thái app
không bao giờ tự tạo ra.

---

## 4. Dữ liệu chứa PII khách thật

❌ Lấy 20 học sinh thật từ UAT làm fixture, kèm họ tên và ngày sinh.

✅ Sinh tên giả theo khuôn `HS Thử ${i} ${RUN_ID}`; cần ca thật thì chỉ nhắc **mã hồ sơ**, không nhắc họ tên.

Và **không xuất file** chứa email hay số điện thoại khách từ bất kỳ nguồn nào, kể cả nguồn đã có sẵn.
Được yêu cầu xuất thì từ chối.

---

## 5. Dữ liệu không truy được về lượt nào tạo

❌ `Tên lớp: Lớp test`

✅ `Tên lớp: Lớp thử ${RUN_ID}` và ghi `NGUOI_TAO` + `NGAY_TAO` vào sổ dọn rác của task.

Không truy được thì đến lúc dọn UAT không ai biết bản ghi nào của ai. Một kho rác 34 nghìn hồ sơ đã
từng sinh ra đúng từ chỗ này, và phải nhờ DBA xoá bằng SQL.

---

## 6. Chuỗi dữ liệu nhiều module mà chỉ dựng khâu cuối

❌ Case cần *"học sinh trong lớp có môn học"*, chỉ tạo học sinh rồi gán vào lớp `1A` có sẵn.

✅ Dựng đủ chuỗi: trường → lớp → môn của lớp (`LOP_MON`, theo đúng học kỳ) → học sinh → gán học sinh vào lớp. Mỗi khâu xác nhận trước khi sang khâu sau.

Thiếu một khâu thì case đỏ ở khâu đó, và verdict trông như lỗi chức năng cuối. `data:chain:check` chặn
đúng chuyện này: verdict đứng trên một tiền đề chưa dựng.
