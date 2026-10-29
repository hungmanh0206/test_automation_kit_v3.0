# ui_debug_agent — tra cứu: công thức đọc DOM và anti-pattern

> Tách khỏi `SKILL.md` ngày 28/10/2026 (v2.9.5 §1.2) để skill về dưới trần 200 dòng. Đây là phần TRA
> CỨU: đọc khi thật sự cần công thức hoặc cần đối chiếu một anti-pattern, không cần nạp mỗi lượt.

## Công thức chốt SỰ THẬT QUAN SÁT bằng một lượt đọc DOM

Dùng khi cần chốt nhãn, option, giá trị mặc định hoặc trạng thái khoá. Đây là hạng 3 trong thứ tự nguồn
(`RULE_GLOBAL` mục Oracle). Nó chốt **cái đang hiện là gì**, KHÔNG phán cái đó đúng hay sai.

Vì sao phải đọc DOM chứ không nhìn ảnh: ảnh độ phân giải thường **không phân biệt nổi** `disabled` với
`không tick`, không đếm được option rỗng, và không cho biết option nào đang `selected`.

```js
() => {
  const q = (s) => document.querySelector(s);
  const sel = q('<select_id>');
  return {
    options: sel ? [...sel.options].map((o) => ({ v: o.value, text: o.text.trim() })) : null,
    selectedIndex: sel ? sel.selectedIndex : null,
    checkboxes: [...document.querySelectorAll('<scope> input[type=checkbox]')]
      .map((c) => ({ name: c.name, checked: c.checked, disabled: c.disabled })),
    fieldOrder: [...document.querySelectorAll('<form> input:not([type=hidden]), <form> select, <form> textarea')]
      .filter((e) => e.offsetParent !== null).map((e) => e.id || e.name),
  };
}
```

| Chốt được | Vì sao ảnh không chốt được |
|---|---|
| Số option thật, kể cả option rỗng | Dropdown đóng thì ảnh không thấy gì |
| `selectedIndex` và option đang chọn | Nhìn chữ không biết đó là mặc định hay người chọn |
| `disabled` so với không tick | Hai thứ này trông gần giống nhau trên ảnh |
| Thứ tự focus thật | Bố cục hai cột làm thứ tự Tab khác hẳn thứ tự đọc từ trên xuống |

Ghi kết quả vào `requirements/` của task rồi trỏ case tới đó. Đọc DOM mà không lưu lại thì lần sau vẫn
phải mở lại app, và case vẫn không có nguồn chống lưng.


## Anti-Patterns

| Anti-pattern | Vì sao sai |
|---|---|
| Đoán locator từ **tên tính năng** | Nguồn `script_error` số 1 ở lượt đầu |
| Dùng **screenshot** để chọn locator | Ảnh không mang accessible name lẫn cấu trúc |
| Copy locator cũ **không verify** | Màn đã đổi mà locator vẫn "trông đúng" |
| Class **động**: `.ant-*`, `.css-*`, `.sc-*` | Đổi theo build/thư viện |
| **Positional xpath** | Thêm/xoá một hàng là vỡ |
| `.first()` khi match nhiều | Bắt nhầm phần tử mà test vẫn xanh |
| `force: true` click xuyên overlay | Che mất lỗi thật |
| `waitForTimeout` | Bị `playwright_fe.md` cấm; flaky theo mạng |
| Locator **trần**, không bọc `safe_target` | Mất luôn lớp chặn mơ hồ / nghiệm thu |
| Kết luận "màn không có field X" khi mới đọc `textContent` | **Instrument mù**: form giữ giá trị ở `input.value`; radio ở trạng thái `checked`. Ví dụ dưới đây có **xuất xứ dự án TRƯỚC (OPS/LMS), không phải app hiện tại**: ant-select là `div` (`.ant-select-selection-item`), và bộ đọc báo `select=0` ở form OPS ⇒ **sửa công cụ**, không phải kết luận. App hiện tại là ASP.NET WebForms + Telerik — xem `tests/fe/support/opsLogin.ts` |

