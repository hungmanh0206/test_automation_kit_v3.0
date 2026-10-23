# Mô hình Google Sheet, và vì sao nó phẳng

> Luật nằm ở [`USER_GUIDE.md`](../../USER_GUIDE.md) mục 3.4. File này giữ chi tiết mô hình và lý do.

![Mô hình Google Sheet](../user-guide-images/sheet-traceability.png)

Một task chạy trọn bộ testcase cùng lúc. Testcase management là **Google Sheet qua Drive MCP**, theo
mô hình **phẳng**: Markdown canonical, xuất `.xlsx`, upload nguyên file, mỗi nhóm chức năng một tab.

Không còn Test Set, Test Plan, Precondition issue, folder, Cycle hay Run như công cụ TMS trước đây.

## Năm lớp, mỗi lớp một vai

| Lớp | Vai trò | Kit làm gì |
|---|---|---|
| **Markdown canonical** | Nguồn sự thật của NỘI DUNG case | Sửa nội dung luôn làm ở đây |
| **Bản xuất Excel** | Bản để người đọc và chạy | `md_to_xlsx.js` xuất từ Markdown |
| **`testcase-status.json`** | Nguồn sự thật của VERDICT một lượt chạy | Ghi ra cột `Result` một chiều |
| **Sheet** | Bản đồng bộ hiển thị trên Drive | Ghi đè NGUYÊN file, không có API sửa một ô |
| **Cột `Result`** | Kết quả execute | `merge_execution_status.js` rồi `update_file` |

## Ba hệ quả của mô hình phẳng

**Sửa thẳng trên Excel hay Sheet sẽ mất.** Lần `sync:canonical` kế tiếp ghi đè lại từ Markdown, và
`canonical:check` chặn trước đó. Muốn giữ thì mang thay đổi về Markdown.

**Không cần lifecycle Deprecated.** Case rời khỏi Excel thì tự động không còn trên Sheet ở lần
`update_file` kế tiếp. Không có bước cleanup riêng.

**Publish chỉ làm được trong phiên chat.** Drive MCP không gọi được từ script CLI hay CI headless.
Đổi lại, không phải quản lý token và rate limit của một TMS riêng.

## Khoá nối là TC ID, không bao giờ là tiêu đề

Schema của `testcase-status.json`:

```json
{ "tests": [ { "tcId": "...", "status": "...", "comment": "...",
               "evidence": [], "steps": [ { "status": "...", "evidence": [] } ] } ] }
```

`tcId` phải khớp TC ID canonical (cột `ID_TC`) vì đó là khoá nối sang đúng dòng trên Sheet.

**Tuyệt đối không khớp theo tiêu đề.** Nhiều case trùng tiêu đề ở nhóm chức năng khác nhau; khớp kiểu
đó dồn nhiều lượt chạy vào một case. Đã mất **12 lượt chạy** vì chuyện này khi migrate.

## Hai máy gác trước khi ghi lên Sheet

1. `output_gate` kiểm chất lượng output.
2. **Mở rộng 7 trục**: task có case band *high* đã execute mà chưa có `reports/expansion-plan.md` thì
   chặn. Bỏ qua có chủ đích bằng `--qa-approved`.

An toàn thêm: lượt chạy **0 case conclusive** (toàn Not Run) không ghi đè. Case `carriedOver` của lượt
trước tự bị loại.

## Đầu sprint không phải tạo gì

Sheet không có Test Plan hay sprint folder. Muốn ghi chú theo sprint thì thêm cột hoặc tab riêng, đó
là lựa chọn của team chứ không phải cấu trúc bắt buộc.

Case cũng không có assignee, vì Sheet không phải issue tracker. Muốn ghi người chạy thì để trong
`comment` của test result.
