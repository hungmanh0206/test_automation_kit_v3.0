import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import {
  loginOpsForm, OPS_BASE, haveOpsCreds, haveOpsUnit, QEMIS_CAP_HOC,
} from '../support/opsLogin';

/*
 * ĐỌC MÀN "2.1.1 Quản lý hồ sơ lớp học" để neo `fieldMap.byScreen` trong
 * `.agent/config/db.conventions.json` — chặn cuối của `preflight --mode phase2`.
 *
 * CHỈ ĐỌC. Không bấm Thêm mới/Ghi/Xoá, không sửa ô nào, không gửi form nghiệp vụ nào.
 * Thao tác duy nhất có postback là chọn bộ lọc Khối để lưới nạp dữ liệu — không ghi gì.
 *
 * ⚠️ Cái đọc được ở đây là NHÃN TRÊN MÀN, tức một NỬA của bản đồ. Nửa còn lại (nhãn ↔ CỘT DB) chỉ neo
 * được khi so cặp nhãn→giá trị qua nhiều bản ghi phân biệt được nhau, đúng `_method` của file config.
 * Vì vậy spec này KHÔNG tự ghi `byScreen` — nó chỉ xuất bằng chứng ra file để người soi rồi mới neo.
 * Ghi thẳng `byScreen` từ việc tên nhãn giống tên cột chính là thứ `_canh_bao_nhan_trung_ten_cot` cấm.
 */
const OUT = 'test-results/qemis-lop-catalog.json';

/* Đường dẫn màn theo cấp — đo được từ chính testcase: THCS dùng /C2/, THPT /C3/. */
const DUONG_DAN: Record<string, string> = {
  'Mầm non': '/C1/Lop.aspx',
  'Tiểu học': '/C1/Lop.aspx',
  'Trung học cơ sở': '/C2/Lop.aspx',
  'Trung học phổ thông': '/C3/Lop.aspx',
  'Giáo dục thường xuyên': '/GDTX/Lop.aspx',
};

test.describe('@infra QEMIS — đọc màn Quản lý hồ sơ lớp học (chỉ đọc)', () => {
  test.skip(!haveOpsCreds, 'chưa đủ OPS_USERNAME/OPS_PASSWORD/OPS_LOGIN_URL');
  test.skip(!haveOpsUnit, 'chưa khai QEMIS_SO/QEMIS_TRUONG');

  test('đăng nhập rồi kiểm kê lưới và form', async ({ page }) => {
    test.setTimeout(480000);   // gồm thời gian CHỜ NGƯỜI nhập captcha

    await loginOpsForm(page);
    console.log(`[login] xong — đang ở ${page.url()}`);

    const duong = DUONG_DAN[QEMIS_CAP_HOC] || '/C2/Lop.aspx';
    const url = `${OPS_BASE}${duong}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log(`[man] goto ${url} → ${page.url()}`);
    console.log(`[man] title = "${await page.title()}"`);

    /* Neo theo CẤU TRÚC: liệt kê mọi bảng có tiêu đề, không dò theo chữ. */
    const luoi = await page.evaluate(() => {
      const out: { id: string; cols: string[]; rows: number }[] = [];
      document.querySelectorAll('table').forEach((t) => {
        const ths = Array.from(t.querySelectorAll('th')).map((x) => (x.textContent || '').trim()).filter(Boolean);
        if (ths.length < 2) return;
        out.push({
          id: (t as HTMLElement).id || (t.closest('[id]') as HTMLElement | null)?.id || '(không id)',
          cols: ths,
          rows: t.querySelectorAll('tbody tr').length,
        });
      });
      return out;
    });
    for (const l of luoi) console.log(`[luoi] ${l.id} · ${l.cols.length} cột · ${l.rows} dòng\n        ${l.cols.join(' | ')}`);

    /* Mọi control nhập liệu đang có trên màn, kèm nhãn gần nhất. */
    const controls = await page.evaluate(() => {
      const nhanCua = (el: Element): string => {
        const id = (el as HTMLElement).id;
        if (id) {
          const lab = document.querySelector(`label[for="${id}"]`);
          if (lab && lab.textContent) return lab.textContent.trim();
        }
        const td = el.closest('td');
        const truoc = td?.previousElementSibling;
        if (truoc && truoc.textContent) return truoc.textContent.trim().slice(0, 60);
        return '';
      };
      const out: { kind: string; id: string; nhan: string }[] = [];
      document.querySelectorAll('input:not([type=hidden]), select, textarea, div.RadComboBox').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const kind = tag === 'div' ? 'RadComboBox' : `${tag}${tag === 'input' ? `[${(el as HTMLInputElement).type}]` : ''}`;
        out.push({ kind, id: (el as HTMLElement).id || '', nhan: nhanCua(el) });
      });
      return out;
    });
    const dangKe = controls.filter((c) => c.id && !/^ctl00_(ContentPlaceHolder1_)?$/.test(c.id));
    console.log(`[control] ${dangKe.length} control có id:`);
    for (const c of dangKe.slice(0, 60)) console.log(`   ${c.kind.padEnd(16)} ${c.id}  ← "${c.nhan}"`);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({
      _doNgay: new Date().toISOString().slice(0, 10),
      _url: page.url(),
      _capHoc: QEMIS_CAP_HOC,
      _canhBao: 'ĐÂY LÀ NHÃN TRÊN MÀN, CHƯA PHẢI BẢN ĐỒ nhãn↔cột DB. Không chép thẳng vào fieldMap.byScreen.',
      luoi,
      controls: dangKe,
    }, null, 1), 'utf8');
    console.log(`[xuat] → ${OUT}`);
  });
});
