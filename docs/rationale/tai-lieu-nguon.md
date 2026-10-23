# Vì sao phải soát tài liệu nguồn trước khi sinh testcase

> Luật nằm ở [`USER_GUIDE.md`](../../USER_GUIDE.md) mục 3.2. File này giữ số đo và lý do.

Tài liệu hỏng không tự báo là nó hỏng. File vẫn có chữ, vẫn có tiêu đề, đọc vào vẫn hợp lý. Đó là
điều khiến lớp lỗi này nguy hiểm hơn một file rỗng.

```bash
npm run docs:index -- --task <TASK_KEY>
npm run docs:cite  -- --task <TASK_KEY> BR-07
```

## Bốn lỗi im lặng

| Phép đo | Nghĩa là gì | Làm gì |
|---|---|---|
| **LỆCH BẢN** | Tài liệu nguồn đã sửa sau ngày fetch | Đọc lại phần đã đổi trước khi gen |
| **RỖNG** | Fetch về không có thân bài, và không báo lỗi | Fetch lại |
| **MẤT BẢNG** | Nguồn có bảng, file fetch về không còn dòng bảng nào | Fetch lại |
| **CÒN ENTITY** | Chữ còn dạng `&agrave;` thay vì `à` | Fetch lại |

## Mất bảng là lỗi tệ nhất

Bạn đọc spec mà **không thấy điều kiện chấp nhận**, và không tín hiệu nào báo.

Đo trên một task thật: **12 trên 12 trang** có bảng ở nguồn, file fetch về còn **0 dòng bảng**.
**66 trên 66 dòng AC** viết bằng Gherkin bị xoá sạch.

Với dự án dùng bảng để viết AC, mất bảng nghĩa là mất toàn bộ điều kiện chấp nhận, trong khi bộ
testcase sinh ra vẫn trông đầy đủ.

## Còn entity thì tìm kiếm trượt

Chữ `tr&ecirc;n` không khớp khi tìm "trên". Mọi phép dò theo từ khoá đều trượt, kể cả phép dò của
chính agent khi nó đi tìm neo.

## `docs:cite` và cảnh báo MƠ HỒ

`docs:cite` trả về **số dòng** của một neo, nên tra ngược được.

Nó còn báo **MƠ HỒ** khi cùng một mã mang luật khác nhau giữa các trang. Đo thật: `NFR-02` ở một
trang là "kỳ khoá sổ", trang khác là "chênh lệch deferred revenue". Trích trần `NFR-02` không chỉ ra
được luật nào.

Cách viết neo an toàn là kèm trang: `US-01 BR-07`.
