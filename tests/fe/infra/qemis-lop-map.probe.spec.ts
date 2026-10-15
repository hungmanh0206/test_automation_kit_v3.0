import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import {
  loginOps, OPS_BASE, haveOpsCreds, haveOpsUnit, QEMIS_CAP_HOC,
} from '../support/opsLogin';

/*
 * NEO nhãn cột ↔ cột DB trên màn "2.1.1 Quản lý hồ sơ lớp học", THEO VỊ TRÍ CỘT.
 *
 * Vì sao theo vị trí chứ không theo tên: `_canh_bao_nhan_trung_ten_cot` trong
 * `.agent/config/db.conventions.json` cấm suy neo từ việc tên nhãn giống tên cột — đã có ca cột
 * `full_name` toàn NULL trong khi màn vẫn hiện nhãn "Full name" lấy giá trị từ hai cột khác.
 *
 * Ở đây có thứ mạnh hơn tên giống nhau: mỗi ô dữ liệu của RadGrid chứa control có `id` mang tên cột DB
 * (`ckIS_LOP_GHEP`…), và ô đó nằm ở MỘT CHỈ SỐ CỘT xác định, nên ghép được với đúng tiêu đề của chỉ số
 * cột ấy. Đó là ràng buộc cấu trúc, không phải phép so chữ. Bước kiểm cuối vẫn phải là: tên cột đó CÓ
 * THẬT trong `dbo.LOP` (xem `csdl9002.lopcols.spec.ts`).
 *
 * CHỈ ĐỌC: không bấm Thêm mới / Ghi / Xoá, không sửa ô nào.
 */
const OUT = 'test-results/qemis-lop-map.json';

const DUONG_DAN: Record<string, string> = {
  'Mầm non': '/C1/Lop.aspx',
  'Tiểu học': '/C1/Lop.aspx',
  'Trung học cơ sở': '/C2/Lop.aspx',
  'Trung học phổ thông': '/C3/Lop.aspx',
  'Giáo dục thường xuyên': '/GDTX/Lop.aspx',
};

test.describe('@infra QEMIS — neo nhãn cột ↔ cột DB theo vị trí (chỉ đọc)', () => {
  test.skip(!haveOpsCreds, 'chưa đủ creds OPS');
  test.skip(!haveOpsUnit, 'chưa khai QEMIS_SO/QEMIS_TRUONG');

  test('ghép tiêu đề cột với control trong cùng chỉ số cột', async ({ page }) => {
    test.setTimeout(480000);
    await loginOps(page);                       // tái dùng phiên nếu còn hạn ⇒ thường không phải nhập captcha lại
    const url = `${OPS_BASE}${DUONG_DAN[QEMIS_CAP_HOC] || '/C2/Lop.aspx'}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log(`[man] ${page.url()}`);

    /*
     * RadGrid render TIÊU ĐỀ và DỮ LIỆU ở HAI BẢNG RIÊNG (lưới cuộn được), nên không tìm hàng `th`
     * bên trong bảng dữ liệu — lượt trước ném "không thấy hàng tiêu đề" đúng vì lý do đó.
     * Và tiêu đề có HAI TẦNG (nhóm + lá); chỉ số cột của ô dữ liệu khớp với tầng LÁ, không phải tầng gộp.
     * Spec này chỉ DUMP, không tự kết luận — ghép xong mới neo.
     */
    const map = await page.evaluate(() => {
      const bang = Array.from(document.querySelectorAll('table[id*="RadGrid1_ctl00"]')) as HTMLTableElement[];
      const header = bang.find((t) => t.id.endsWith('_Header')) || null;
      const data = bang
        .filter((t) => t !== header)
        .sort((a, b) => b.querySelectorAll('tr > td').length - a.querySelectorAll('tr > td').length)[0] || null;

      const hangTieuDe: string[][] = [];
      if (header) {
        header.querySelectorAll('tr').forEach((tr) => {
          const ths = Array.from(tr.querySelectorAll('th'));
          if (!ths.length) return;
          const hang: string[] = [];
          ths.forEach((th) => {
            const span = Number(th.getAttribute('colspan') || 1);
            const t = (th.textContent || '').trim();
            for (let i = 0; i < span; i += 1) hang.push(t);
          });
          hangTieuDe.push(hang);
        });
      }

      const hangData = data
        ? Array.from(data.querySelectorAll('tr')).find((r) => r.querySelectorAll('td').length > 5)
        : null;
      const o: { idx: number; controlIds: string[]; text: string }[] = [];
      if (hangData) {
        Array.from(hangData.querySelectorAll('td')).forEach((td, i) => {
          o.push({
            idx: i,
            controlIds: Array.from(td.querySelectorAll('[id]')).map((e) => {
              const el = e as HTMLInputElement;
              const tick = el.type === 'checkbox' ? (el.checked ? ' [TICK]' : ' [trong]') : '';
              return el.id + tick;
            }),
            text: (td.textContent || '').trim().slice(0, 40),
          });
        });
      }
      return {
        idHeader: header ? header.id : '(không thấy)',
        idData: data ? data.id : '(không thấy)',
        hangTieuDe,
        o,
      };
    });

    const m = map as any;
    console.log(`[bang] header=${m.idHeader} · data=${m.idData}`);
    m.hangTieuDe.forEach((h: string[], i: number) => console.log(`[tieude-${i}] ${h.length} ô: ${h.join(' | ')}`));
    const la: string[] = m.hangTieuDe[m.hangTieuDe.length - 1] || [];
    console.log(`[ghep] ${m.o.length} ô dữ liệu × ${la.length} tiêu đề lá:`);
    for (const c of m.o) {
      const ids = c.controlIds.map((id: string) => id.replace(/^.*_ctl\d+_/, '')).filter(Boolean);
      console.log(`  [${String(c.idx).padStart(2)}] "${la[c.idx] ?? '(thiếu tiêu đề)'}"  ← ${ids.length ? ids.join(', ') : `giá trị "${c.text}"`}`);
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ _doNgay: new Date().toISOString().slice(0, 10), _url: page.url(), ...(map as object) }, null, 1), 'utf8');
    console.log(`[xuat] → ${OUT}`);
  });
});
