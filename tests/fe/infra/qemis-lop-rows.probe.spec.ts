import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import {
  loginOps, OPS_BASE, haveOpsCreds, haveOpsUnit, QEMIS_CAP_HOC,
} from '../support/opsLogin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const safeTarget = require(path.resolve(__dirname, '../../../scripts/utils/ui/safe_target.js'));

/*
 * Đọc NHIỀU DÒNG của lưới `/C*\/Lop.aspx` để neo `fieldMap.byScreen` cho đủ chuẩn `_method`:
 * lấy giao của các tập nhãn qua NHIỀU bản ghi, không kết luận từ một dòng.
 *
 * Một dòng thì trùng hợp cũng ra khớp: lớp đầu có `THU_TU=1` và `STT=1`, không tách được "Thứ tự" với
 * "STT". Nhiều dòng có giá trị khác nhau mới loại được các cột cùng kiểu.
 *
 * CHỈ ĐỌC. Không bấm Thêm mới / Ghi / Xoá, không sửa ô nào. Thao tác duy nhất có postback là đổi bộ lọc
 * Khối để lưới nạp lại.
 */
const OUT = 'test-results/qemis-lop-rows.json';
const DUONG_DAN: Record<string, string> = {
  'Mầm non': '/C1/Lop.aspx',
  'Tiểu học': '/C1/Lop.aspx',
  'Trung học cơ sở': '/C2/Lop.aspx',
  'Trung học phổ thông': '/C3/Lop.aspx',
  'Giáo dục thường xuyên': '/GDTX/Lop.aspx',
};

/** Chỉ số cột → ý nghĩa, đo bởi `qemis-lop-map.probe.spec.ts` ngày 30/09/2026. */
const COT = { stt: 1, tenLop: 6, khoi: 7, thuTu: 9, phanHieuMa: 3, nn1: 11, nn2: 13, soBuoi: 22 } as const;
const TICK: Record<number, string> = {
  15: 'Học sinh học nghề', 16: 'Lớp ghép', 19: 'Bán trú', 20: 'Lớp song ngữ', 21: 'Lớp VNEN', 24: 'Lớp giải thể',
};

/** Khớp TRỌN chuỗi — `hasText` mặc định là so CHỨA, nên "Khối 1" lọt cả vào "Khối 12". */
const tron = (s: string): RegExp => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

test.describe('@infra QEMIS — đọc nhiều dòng lưới lớp (chỉ đọc)', () => {
  test.skip(!haveOpsCreds || !haveOpsUnit, 'chưa đủ creds/đơn vị');

  test('dump lưới ở nhiều khối để so với DB', async ({ page }) => {
    test.setTimeout(480000);
    await loginOps(page);
    await page.goto(`${OPS_BASE}${DUONG_DAN[QEMIS_CAP_HOC] || '/C2/Lop.aspx'}`, { waitUntil: 'domcontentloaded' });

    const docLuoi = async () => page.evaluate(({ COT, TICK }) => {
      const bang = Array.from(document.querySelectorAll('table[id*="RadGrid1_ctl00"]')) as HTMLTableElement[];
      const data = bang
        .filter((t) => !t.id.endsWith('_Header'))
        .sort((a, b) => b.querySelectorAll('tr > td').length - a.querySelectorAll('tr > td').length)[0];
      if (!data) return [];
      const out: Record<string, string>[] = [];
      Array.from(data.querySelectorAll('tr'))
        .filter((r) => r.querySelectorAll('td').length > 5)
        .forEach((tr) => {
          const td = Array.from(tr.querySelectorAll('td'));
          const txt = (i: number) => (td[i]?.textContent || '').trim();
          const r: Record<string, string> = {
            stt: txt(COT.stt), tenLop: txt(COT.tenLop), khoi: txt(COT.khoi), thuTu: txt(COT.thuTu),
            phanHieu: txt(COT.phanHieuMa), nn1: txt(COT.nn1), nn2: txt(COT.nn2), soBuoi: txt(COT.soBuoi),
          };
          for (const [i, ten] of Object.entries(TICK)) {
            const cb = td[Number(i)]?.querySelector('input[type=checkbox]') as HTMLInputElement | null;
            r[ten] = cb ? (cb.checked ? '1' : '0') : '?';
          }
          out.push(r);
        });
      return out;
    }, { COT, TICK });

    const rows: Record<string, string>[] = [...(await docLuoi())];

    /*
     * Đọc ở NHIỀU KHỐI: lưới luôn lọc một khối nên cột "Khối" ra hằng số, mà một cột chỉ có một giá trị
     * thì không phân biệt được với mọi cột hằng khác — chưa đủ để neo (`_method`).
     */
    const idKhoi = 'ctl00_ContentPlaceHolder1_ctl00_rcbKhoi';
    const khoiCo = (await page.locator(`#${idKhoi}_DropDown li`).allInnerTexts().catch(() => []))
      .map((t) => t.trim()).filter(Boolean);
    const dangCo = (await page.locator(`#${idKhoi}_Input`).inputValue().catch(() => '')).trim();
    console.log(`[khoi] đang lọc "${dangCo}" · danh sách: ${khoiCo.join(' | ')}`);

    for (const k of khoiCo.filter((x) => x !== dangCo)) {
      const maKhoi = String((k.match(/\d+/) || ['0'])[0]).padStart(2, '0');
      const item = page.locator(`#${idKhoi}_DropDown li`).filter({ hasText: tron(k) });
      const arrow = page.locator(`#${idKhoi}_Arrow`);
      for (let i = 0; i < 4; i += 1) {
        await arrow.click({ timeout: 10000 }).catch(() => { /* postback đang chạy */ });
        if (await item.isVisible({ timeout: 3000 }).catch(() => false)) break;
      }
      await safeTarget.one(item, { what: `mục khối "${k}"` }).catch(() => { /* để click báo lỗi thật */ });
      await item.click({ timeout: 15000 }).catch(() => { /* app từ chối — bỏ khối này */ });

      /*
       * Ô input đổi KHÔNG có nghĩa lưới đã nạp lại: bản trước đọc ngay sau đó và lấy về 24 dòng TOÀN
       * khối 06, tức ba lần đọc cùng một lưới. Tín hiệu đúng là chính ô dữ liệu của lưới.
       */
      const daNap = await page.waitForFunction(
        ([idxCot, mong]: readonly [number, string]) => {
          const bang = Array.from(document.querySelectorAll('table[id*="RadGrid1_ctl00"]')) as HTMLTableElement[];
          const data = bang.filter((t) => !t.id.endsWith('_Header'))
            .sort((a, b) => b.querySelectorAll('tr > td').length - a.querySelectorAll('tr > td').length)[0];
          if (!data) return false;
          const tr = Array.from(data.querySelectorAll('tr')).find((r) => r.querySelectorAll('td').length > 5);
          return !!tr && (tr.querySelectorAll('td')[idxCot]?.textContent || '').trim() === String(mong);
        },
        [COT.khoi, maKhoi] as const,
        { timeout: 30000 },
      ).then(() => true).catch(() => false);

      if (!daNap) { console.log(`[khoi] "${k}": lưới không nạp lại trong 30s — BỎ, không đọc lại lưới cũ`); continue; }
      const them = await docLuoi();
      console.log(`[khoi] "${k}" → thêm ${them.length} dòng`);
      rows.push(...them);
    }

    /* Khử trùng: nhiều lượt đọc có thể lặp cùng một lớp, đếm trùng làm mẫu to giả. */
    const thay = new Set<string>();
    const sach = rows.filter((r) => {
      const k = `${r.tenLop}|${r.phanHieu}`;
      if (thay.has(k)) return false;
      thay.add(k); return true;
    });
    for (const r of sach) {
      console.log(`[ui] ${r.tenLop} | khoi=${r.khoi} | thutu=${r.thuTu} | nn1=${r.nn1} | nn2=${r.nn2} | sobuoi=${r.soBuoi} `
        + `| bantru=${r['Bán trú']} songngu=${r['Lớp song ngữ']} nghe=${r['Học sinh học nghề']} ghep=${r['Lớp ghép']} vnen=${r['Lớp VNEN']}`);
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(sach, null, 1), 'utf8');
    console.log(`[xuat] ${sach.length} dòng phân biệt (từ ${rows.length} dòng đọc được) · khối: `
      + `${[...new Set(sach.map((r) => r.khoi))].join(', ')} → ${OUT}`);
  });
});
