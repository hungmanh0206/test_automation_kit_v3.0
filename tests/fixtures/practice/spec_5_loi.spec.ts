/*
 * FIXTURE BÀI TẬP 2 — spec cài sẵn ĐÚNG 5 lỗi. Đáp án ở `spec_5_loi.dapan.json`.
 *
 * File này KHÔNG phải spec thật của kit và KHÔNG được chạy: nó là đề bài cho `skills:practice`.
 * Tên file cố ý không khớp `tests/fe/**` nên lưới chắn của `ci:scope` không vớ phải nó.
 *
 * Năm lỗi được chọn là năm lỗi `auto:review` xếp P0 hoặc năm chỗ máy mù mà `automation_reviewer`
 * dạy soi tay — tức đọc skill đó xong là đủ căn cứ để tìm ra cả năm.
 */
import { test, expect } from '@playwright/test';

test.describe('Hồ sơ lớp học', () => {
  let maLopDaTao: string;

  test('thêm lớp mới', async ({ page }) => {
    await page.goto('/HoSoLop.aspx');
    maLopDaTao = '1C';
    await page.fill('#MaLop', maLopDaTao);
    await page.fill('#TenLop', '1C');
    await page.click('#btnGhi');
    await page.waitForTimeout(2000);
    console.log('đã ghi lớp', maLopDaTao);
  });

  test('mã lớp trùng bị chặn', async ({ page }) => {
    await page.goto('/HoSoLop.aspx');
    await page.fill('#MaLop', maLopDaTao);
    await page.fill('#TenLop', 'lớp trùng');
    await page.click('#btnGhi');
    const rows = await page.locator('#grid tr').all();
    expect(rows.length).toBeGreaterThan(0);
  });

  test('lưới hiện đúng lớp vừa tạo', async ({ page }) => {
    await page.goto('/HoSoLop.aspx');
    const ten = await page.locator('#grid tr').first().textContent();
    expect(ten).toContain(ten);
  });

  test('xoá lớp', async ({ page }) => {
    await page.goto('/HoSoLop.aspx');
    await page.fill('#loc', '1C');
    await page.click('#btnXoa');
  });

  test.afterEach(async ({ page }) => {
    await page.goto('/HoSoLop.aspx');
    await page.fill('#loc', '1C');
    await page.click('#btnXoaTatCa');
  });
});
