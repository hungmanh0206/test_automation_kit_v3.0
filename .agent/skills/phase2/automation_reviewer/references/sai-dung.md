# Cặp sai → đúng khi viết spec cho qua được review

> Khuôn giống `tc_design_guide/references/anti_patterns.md`. Mỗi dòng ❌ là một finding thật của
> `auto:review` trên repo này; dòng ✅ là bản viết lại, và **cột ✅ không vi phạm rule nào** của
> `auto:review` hay `locator_lint`.

---

## 1. Oracle so app với chính app

❌
```ts
const ten = await page.locator('#grid tr').first().textContent();
expect(ten).toContain(ten);
```

✅
```ts
// Kỳ vọng lấy từ ô `Kết quả mong đợi` của NT-LOP-005, không lấy từ app.
await expect(page.locator('#grid tr').first()).toContainText(`1C-${process.env.RUN_ID}`);
```

Bản ❌ **luôn đúng**, kể cả khi app lưu sai. Đây là rule `no-assert` ở mức P0 — 502 finding trên repo
này, nhóm lớn nhất của tầng chặn.

---

## 2. Test không có khẳng định nào

❌
```ts
test('thêm lớp mới', async ({ page }) => {
  await page.fill('#MaLop', '1C');
  await page.click('#btnGhi');
});
```

✅
```ts
test('thêm lớp mới', async ({ page }) => {
  await page.fill('#MaLop', `1C-${process.env.RUN_ID}`);
  await page.click('#btnGhi');
  await expect(page.getByText('Lưu thành công')).toBeVisible();
  await expect(page.locator('#grid')).toContainText(`1C-${process.env.RUN_ID}`);
});
```

Bản ❌ xanh miễn là bấm được nút. Nó không kiểm gì, nên nó không chứng minh gì.

---

## 3. Chờ theo đồng hồ, không theo điều kiện

❌ `await page.waitForTimeout(1500);`

✅ `await expect(page.getByText('Lưu thành công')).toBeVisible({ timeout: 10000 });`

`hard-sleep` là P0: máy nhanh thì dư thời gian, máy chậm thì vẫn đỏ. Và 3 chỗ `waitForTimeout` nằm
trong `opsLogin.ts` **dùng chung** nên nó làm chậm mọi task khác.

---

## 4. Đếm rỗng nghĩa

❌ `expect(rows.length).toBeGreaterThan(0);`

✅ `expect(rows).toHaveCount(3);` hoặc `await expect(rows.nth(0)).toContainText('1A');`

`vacuous-count`: *"có ít nhất 1 dòng"* pass với **bất kỳ** lưới không rỗng, kể cả lưới đang hiện dữ
liệu của lớp khác.

---

## 5. Khẳng định đứng trước hành động cuối

❌
```ts
await expect(page.getByText('Lưu thành công')).toBeVisible();
await page.click('#btnDong');
```

✅
```ts
await page.click('#btnDong');
await expect(page.locator('#grid')).toContainText(`1C-${process.env.RUN_ID}`);  // oracle SAU hành động cuối
```

`no-assert-after-act`: tác động của hành động cuối **không được kiểm**. Nếu hành động cuối chỉ để dọn
trạng thái thì nó thuộc `afterEach`, không thuộc thân test.

---

## 6. Test phụ thuộc thứ tự chạy

❌ `NT-LOP-012` (mã trùng) dựa vào lớp `1C` do `NT-LOP-004` tạo trước đó.

✅ `NT-LOP-012` tự tạo lớp `1C-${RUN_ID}` trong `beforeEach`, rồi mới thử mã trùng.

Chạy riêng bản ❌ thì nó **xanh vì không có lớp nào để trùng** — xanh giả. Máy không bắt được; đây là
một trong năm chỗ phải soi tay. Phép thử rẻ nhất: chạy bộ **hai lượt liền nhau**.

---

## 7. `console.log` sót lại

❌ `console.log('đã lưu, kiểm lưới', rows);`

✅ `await test.step('kiểm lưới sau khi lưu', async () => { ... });` hoặc `testInfo.attach(...)`.

`console-log` là P1 nhưng đông nhất (1145 finding): log lượt chạy ngập thì **dòng báo lỗi thật bị che**.
