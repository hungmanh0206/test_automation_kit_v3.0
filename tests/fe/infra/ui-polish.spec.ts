/**
 * ui:polish — độ chỉn chu UI xuyên màn: thang khoảng cách, đồng nhất theo loại thành phần, số font/cỡ chữ/màu.
 *
 * Hai trang fixture: `chuan.html` (đồng nhất, bước 4px) và `lech.html` mang bốn lỗi CÀI SẴN — nút cao 30px giữa
 * các nút 32px, padding `0 14px`, nhãn font Comic Sans, `margin-top: 13px`. Máy phải bắt đủ bốn, KHÔNG gắn cờ gì
 * trên trang đồng nhất, KHÔNG đọc element ẩn, và KHÔNG đọc giá trị ô nhập (màn thật có thể chứa PII khách).
 *
 * Oracle: không có thang thiết kế thì "chuẩn" là ĐA SỐ — lệch đa số là OBSERVATION, không phải bug (CLAUDE.md §3).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const up = require(path.join(REPO, 'scripts/utils/ui/ui_polish.js'));
const FX = path.join(__dirname, '..', 'fixtures', 'ui-polish');

async function thu(page: any, ten: string) {
  await page.setContent(fs.readFileSync(path.join(FX, `${ten}.html`), 'utf8'));
  return up.thuThap(page, { man: ten });
}

test.describe('@infra ui:polish — thu thập', () => {
  test('KHÔNG đọc element ẩn, KHÔNG đọc giá trị ô nhập', async ({ page }) => {
    const m = await thu(page, 'chuan');
    const s = JSON.stringify(m);
    expect(s, 'nút display:none không được vào dữ liệu').not.toContain('nutAn');
    /* `visibility: hidden` VẪN có kích thước — chỉ chốt style mới loại được nó. Bản đầu của fixture chỉ có kiểu ẩn
     * `display: none`, bị loại sớm ở bước kích thước, nên phá chốt style mà 0 ca đỏ. */
    expect(s, 'nút visibility:hidden không được vào dữ liệu').not.toContain('nutVoHinh');
    expect(s, 'giá trị ô nhập có thể là PII khách').not.toContain('0912345678');
    expect(m.theoLoai.nut.map((x: any) => x.chu)).toEqual(['Ghi', 'Hủy', 'In']);
  });
});

test.describe('@infra ui:polish — phân tích', () => {
  test('ĐỐI CHỨNG ÂM: trang đồng nhất ⇒ bước 4px, 0 lẻ thang, 0 lệch, 1 font', async ({ page }) => {
    const k = up.phanTich([await thu(page, 'chuan')]);
    expect(k.khoangCach.buoc).toBe(4);
    expect(k.khoangCach.leThang).toEqual([]);
    for (const tts of Object.values(k.dongNhat) as any[]) for (const x of Object.values(tts) as any[]) expect(x.soLech).toBe(0);
    expect(k.heThong.soFont).toBe(1);
  });

  test('bốn lỗi cài sẵn đều bị bắt', async ({ page }) => {
    const k = up.phanTich([await thu(page, 'chuan'), await thu(page, 'lech')]);
    expect(k.khoangCach.leThang.map((x: any) => x.v).sort(), 'margin 13px và padding 14px lẻ bước 4px').toEqual([13, 14]);
    expect(k.dongNhat.nut.cao.lech, 'nút cao 30px giữa đa số 32px').toEqual(['lech: button#luu "Lưu" = 30']);
    expect(k.dongNhat.nut.padding.daSo).toBe('0 16 0 16');
    expect(k.dongNhat.nut.padding.soLech).toBe(1);
    expect(k.dongNhat.nhan.font.lech).toEqual(['lech: label#ghiChu = comic sans ms']);
    expect(k.heThong.soFont).toBe(2);
  });

  test('CÓ thang thiết kế ⇒ so với thang, không suy bước: 24px nằm ngoài [4, 8, 16] bị bắt', async ({ page }) => {
    const m = await thu(page, 'chuan');
    expect(up.phanTich([m], { thang: [4, 8, 16, 24] }).khoangCach.leThang).toEqual([]);
    const k = up.phanTich([m], { thang: [4, 8, 16] });
    expect(k.khoangCach.nguon).toBe('thang thiết kế');
    expect(k.khoangCach.leThang.map((x: any) => x.v)).toEqual([24]);
  });

  test('dưới 3 element cùng loại thì KHÔNG nói "đa số" — 2 phần tử không có đa số', () => {
    const m = { man: 'x', theoLoai: { nut: [{ ten: 'a', cao: 30 }, { ten: 'b', cao: 32 }] }, khoangCach: {}, viDu: {}, font: {}, coChu: {}, mau: {} };
    expect(up.phanTich([m]).dongNhat.nut).toBeUndefined();
  });

  test('không bước nào phủ ≥80% ⇒ nói thẳng "không theo một thang chung", không chọn bừa', () => {
    const m = { man: 'x', theoLoai: {}, khoangCach: { 3: 5, 7: 5, 11: 5 }, viDu: {}, font: {}, coChu: {}, mau: {} };
    const k = up.phanTich([m]);
    expect(k.khoangCach.buoc).toBeNull();
  });
});

test.describe('@infra ui:polish — CLI', () => {
  test('không có dữ liệu ⇒ exit 2, KHÔNG PHÁN ĐƯỢC, không phải "UI chỉn chu"', () => {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/ui_polish.js'), '--thu-muc', path.join(os.tmpdir(), 'khong-co-thu-muc-ui-polish')], { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/KHÔNG đồng nghĩa với "UI chỉn chu"/);
  });

  test('có dữ liệu ⇒ báo cáo nói rõ lệch đa số là OBSERVATION, không phải bug', async ({ page }) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-polish-'));
    for (const t of ['chuan', 'lech']) fs.writeFileSync(path.join(d, `${t}.json`), JSON.stringify(await thu(page, t)));
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/ui_polish.js'), '--thu-muc', d], { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    fs.rmSync(d, { recursive: true, force: true });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OBSERVATION, KHÔNG phải bug/);
    expect(r.stdout).toMatch(/lẻ thang\s+13px/);
  });
});
