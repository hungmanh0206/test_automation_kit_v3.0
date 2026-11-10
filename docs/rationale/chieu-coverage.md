# Vì sao bộ testcase có trục thứ hai: CHIỀU coverage

> Luật nằm ở [`USER_GUIDE.md`](../../USER_GUIDE.md) mục 3.2. File này giữ số đo và lý do.

Bộ testcase có **hai trục**, không phải một.

| Trục | Trả lời câu hỏi |
|---|---|
| **Module** | Test **ở đâu** |
| **Chiều** | Hỏi **loại câu hỏi nào** |

Chiều gồm: validate field, định dạng hiển thị, công thức tiền, backend trả gì, guard và phân quyền,
bảo mật, hiệu năng, ảnh hưởng lan sang nơi khác.

## Vấn đề: phủ kín module vẫn có thể trống hẳn một chiều

Khi đó bộ testcase **trông** đầy đủ. Mọi module đều có case, bảng coverage xanh, không gate nào kêu.

Đo trên một bộ **530 case thật**:

| Chiều | Số case |
|---|---|
| E2E | **0** |
| Change impact | **0 đến 1** |
| Hiển thị | **khoảng 12%**, dù mục đó là bắt buộc |

Một bộ như vậy không bắt được lỗi hiển thị, cũng không biết sửa chỗ này thì vỡ chỗ nào.

## Ba việc, theo thứ tự

1. **Khai phạm vi chiều TRƯỚC khi gen.** Mỗi chiều trong `requirements/dimension_manifest.json` phải
   là `required` hoặc `n/a` **kèm lý do**. Khai `n/a` cho chiều mà artifact chứng minh là có (ví dụ có
   `requirements/figma/**` mà khai `design: n/a`) thì gate **chặn**.

   ```bash
   npm run dim:coverage
   ```

2. **Mở đúng chương của các chiều `required`.** Mỗi chương nói chiều đó phải sinh case gì. Không nạp
   cả bộ: [`prompt_templates/phase2/dimensions/`](../../prompt_templates/phase2/dimensions/).

3. **Gắn tag chiều trong tiêu đề case**, và expected phải mang **bằng chứng** của chiều đó.

   | Tag | Expected phải có |
   |---|---|
   | `[Calc]` | Giá trị số tự tính ra |
   | `[Display]` | Chuỗi trích nguyên văn, định dạng, hoặc danh sách cột |
   | `[Guard]` | Mã 4xx **kèm** khẳng định dữ liệu không đổi |

   Ví dụ tiêu đề đúng:
   `[Positive][Calc][BR-RECIPBANK-001] TK nhận theo chương trình, mốc 01/01/2026`
   (tag loại, tag chiều, id rule làm oracle).

## Kiểm trước khi đưa QA duyệt

```bash
npm run dim:coverage -- --enforce   # thiếu chiều required thì chặn
npm run domain:trace-back           # case có oracle nghiệp vụ mà không trỏ rule nào
```

**Bộ chưa gắn tag thì gate tự từ chối chặn.** Đó là trạng thái *chưa được gác*, không phải *đã đạt*.
