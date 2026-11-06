---
vi_sao: "`auto:review` quét CÂY SPEC của repo rồi in ra màn hình, nó không nhận một file rời. Khuôn ở đây chép từ một lượt chạy thật ngày 06/11/2026, không suy từ code."
---

# Mẫu `automation-review.md` — bản đã điền

> Bản **đã điền xong** cho một bộ spec hồ sơ lớp học, không phải khung trống. Phần trong khối mã là
> khuôn `npm run auto:review` in ra; phần dưới là chỗ **người** phải viết, vì máy không viết hộ được.
>
> Điều mẫu này dạy mà mô tả skill không dạy được: **đọc theo TẦNG trước, theo rule sau**. 1702 finding
> trông như thảm hoạ, nhưng 1666 cái ở tầng `wip` — chúng chưa vào gói và chưa chặn ai. Tầng `track`
> chỉ có 36, trong đó 7 là P0. Đọc ngược thứ tự là tự làm mình tê liệt.

---

## Máy chạy trước

```
[auto-review] 735 file · 1702 finding (P0 538)
[auto-review] theo tầng: track 36 (P0 7 — tầng CHẶN) · wip 1666 · task 0

— Theo rule —
  P1  1145  console-log: `console.log` sót lại làm log lượt chạy ngập, và che mất dòng báo lỗi thật
  P0   502  no-assert: Test KHÔNG có khẳng định nào: nó chỉ thao tác rồi kết thúc, nên luôn XANH
  P0    36  hard-sleep: Ngủ cứng 1–5s: chờ theo ĐỒNG HỒ chứ không theo điều kiện
  P1    18  vacuous-count: "có ít nhất 1 dòng" pass với bất kỳ lưới không rỗng
  P1     1  no-assert-after-act: Mọi khẳng định đứng TRƯỚC hành động cuối

— Ví dụ (P0 ở tầng CHẶN) —
  tests/fe/support/opsLogin.ts:235 [hard-sleep]
      await page.waitForTimeout(1500);
```

## Bảng 6 nhóm — chấm theo Definition of Done

| # | Nhóm | Máy chấm được | Kết quả bộ này | Vi phạm chặn bàn giao |
|---|---|---|---|---|
| 1 | Oracle thật, không tautology | một phần | 2/6 spec so app với chính app | **CÓ** — `NT-LOP-005` đọc lưới rồi khẳng định lưới |
| 2 | Chờ theo điều kiện, không theo đồng hồ | có | 3 chỗ `waitForTimeout` | **CÓ** — cả 3 ở `opsLogin.ts`, dùng chung |
| 3 | Test độc lập, không phụ thuộc thứ tự | không | `NT-LOP-012` cần `004` chạy trước | **CÓ** |
| 4 | Cleanup dọn đúng thứ của lượt này | không | xoá theo tên lớp `1C`, không theo `RUN_ID` | **CÓ** — hai lượt song song xoá của nhau |
| 5 | Locator bền, không inline | có | 0 vi phạm | không |
| 6 | Evidence ở bước quyết định | một phần | 5/6 case có ảnh đúng bước | không — case thiếu là `SKIP`, hợp lệ |

## Năm chỗ máy mù — soi tay, và đây là kết quả soi

**① Test phụ thuộc nhau.** `NT-LOP-012` (mã lớp trùng) cần lớp `1C` do `NT-LOP-004` tạo. Chạy riêng
`012` thì nó xanh vì... không có lớp nào để trùng. Đó là xanh giả.

**② Cleanup dọn sai thứ.** `afterEach` xoá mọi lớp tên `1C`. Lượt khác đang chạy cũng tạo `1C` thì mất
dữ liệu của nhau. Phải neo theo `RUN_ID`.

**③ Oracle so app với chính app.** `NT-LOP-005` đọc tên lớp từ lưới rồi khẳng định lưới chứa tên đó.
Luôn đúng, kể cả khi app lưu sai. Oracle phải là giá trị từ `Kết quả mong đợi` của case.

**④ Dữ liệu trùng giữa hai lượt.** Mã lớp cố định `1C` — lượt thứ hai gặp lỗi trùng mã và FAIL, rồi bị
đọc thành bug sản phẩm.

**⑤ Data của task lọt vào suite chung.** `tests/fe/support/opsLogin.ts` bị thêm 3 `waitForTimeout` cho
riêng task này. File dùng chung, nên nó làm chậm mọi task khác.

## Kết luận bàn giao

**CHƯA bàn giao được.** Bốn vi phạm chặn, và ba trong số đó (①②④) đều cùng một gốc: bộ này **chưa bao
giờ chạy hai lượt liền nhau**. Chạy lại lần hai là thấy ngay — đó là phép thử rẻ nhất và nên làm trước
khi review tay.
