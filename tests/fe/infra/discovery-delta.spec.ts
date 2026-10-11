import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * @infra — CHẾ ĐỘ DELTA (v2.6.1) và LÂN CẬN MỘT BƯỚC.
 *
 * ĐÂY LÀ MỘT LỜI KHAI SAI ĐƯỢC TRẢ LẠI. Bản v2.6.0 ghi `delta` vào bảng "10 điểm vượt kit A" trong
 * CHANGELOG — mục số 6, cột bằng chứng điền "trần token riêng 1k". Nhưng mã chỉ đặt một con số trần:
 * chạy `--mode delta` làm đúng y như `--mode task`, KHÔNG so với snapshot nào. Và `mode` chỉ đổi hành vi
 * ở đúng một chỗ (cảnh báo khi `task` thiếu `--pham-vi`), nên "ba chế độ chạy" thực ra là một chế độ với
 * ba trần token.
 *
 * CHANGELOG đó đã tag, merge và push. Một con số nghe như bằng chứng mà không đo gì — đúng lớp lỗi mà cả
 * v2.5.0 lẫn v2.6.0 đi sửa ở chỗ khác.
 */
const DIR = path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dl = require(path.join(DIR, 'delta.js'));

type Field = Record<string, unknown>;
const man = (route: string, fields: Field[] = [], components: string[] = []) => ({ route, title_observed: route, fields, components });
const f = (ten: string, over: Field = {}) => ({ ten_truong: ten, nhan: ten, code_loai: 'text', ...over });

test.describe('@infra delta — so HÌNH DẠNG, không so dữ liệu', () => {
  test('màn thêm và màn mất', () => {
    const d = dl.soSanh(
      { screens: [man('/a'), man('/b')], apis: [] },
      { screens: [man('/a'), man('/c')], apis: [] },
    );
    expect(d.man_them).toEqual(['/c']);
    expect(d.man_mat).toEqual(['/b']);
    expect(d.so_thay_doi).toBe(2);
  });

  test('field đổi RÀNG BUỘC phải bắt được — đây là thứ không gì trên UI nói cho bạn biết', () => {
    /*
     * `maxlength` đổi từ 120 xuống 60 là một case `[BVA]` phải chạy lại. Nhìn màn thì không thấy gì khác:
     * ô vẫn ở đó, vẫn gõ được. Chỉ khi gõ quá 60 ký tự mới lộ ra, mà không ai gõ thử nếu không biết.
     */
    const d = dl.soSanh(
      { screens: [man('/x', [f('ten', { maxlength: 120, required: true })])], apis: [] },
      { screens: [man('/x', [f('ten', { maxlength: 60, required: true })])], apis: [] },
    );
    expect(d.man_doi).toHaveLength(1);
    expect(d.man_doi[0].field_doi[0].field).toBe('ten');
    expect(d.man_doi[0].field_doi[0].khac).toEqual([{ rang_buoc: 'maxlength', truoc: 120, sau: 60 }]);
  });

  test('KHÔNG so giá trị dữ liệu — so nó thì lượt nào cũng "có khác biệt"', () => {
    /*
     * Giá trị trên UAT đổi mỗi ngày. Nếu delta báo khác biệt mỗi lượt thì người đọc thôi đọc nó, và lúc
     * đó một thay đổi THẬT cũng chìm theo.
     */
    const d = dl.soSanh(
      { screens: [man('/x', [f('ten', { mac_dinh: 'Trường A' })])], apis: [] },
      { screens: [man('/x', [f('ten', { mac_dinh: 'Trường B' })])], apis: [] },
    );
    expect(d.so_thay_doi, 'đổi giá trị mặc định KHÔNG phải một thay đổi hình dạng').toBe(0);
    expect(dl.RANG_BUOC).not.toContain('mac_dinh');
  });

  test('component thêm hoặc mất, và API thêm hoặc mất', () => {
    const d = dl.soSanh(
      { screens: [man('/x', [], ['data_table'])], apis: [{ method: 'GET', path_chuan: '/api/a' }] },
      { screens: [man('/x', [], ['data_table', 'pagination'])], apis: [{ method: 'GET', path_chuan: '/api/b' }] },
    );
    expect(d.man_doi[0].component_them).toEqual(['pagination']);
    expect(d.api_them).toEqual(['GET /api/b']);
    expect(d.api_mat).toEqual(['GET /api/a']);
  });

  test('hai bản đồ giống hệt ⇒ 0 thay đổi, không báo nhiễu', () => {
    const a = { screens: [man('/x', [f('ten', { maxlength: 50 })], ['modal'])], apis: [{ method: 'GET', path_chuan: '/api/a' }] };
    expect(dl.soSanh(a, JSON.parse(JSON.stringify(a))).so_thay_doi).toBe(0);
  });
});

test.describe('@infra delta — chọn snapshot để so, và ca KHÔNG CÓ GÌ ĐỂ SO', () => {
  function kho(ban: { build: string; host: string; phamVi: string | null; screens?: unknown[] }[]) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-'));
    for (const b of ban) {
      fs.mkdirSync(path.join(d, b.build), { recursive: true });
      fs.writeFileSync(path.join(d, b.build, 'system_map.json'),
        JSON.stringify({ target: { host: b.host }, pham_vi: b.phamVi, screens: b.screens || [], apis: [] }), 'utf8');
    }
    return d;
  }

  test('CÙNG phạm vi mới được so — khác phạm vi thì báo cáo vô dụng', () => {
    /*
     * Đặt một lượt bò CẢ APP cạnh một lượt bò MỘT MODULE thì mọi màn ngoài module hiện ra như "đã mất".
     * Bản báo cáo đó không sai về mặt số học, nhưng nó không nói được gì, và nó làm người đọc mất lòng
     * tin vào mục delta.
     */
    const d = kho([
      { build: 'cu-ca-app', host: 'uat.x', phamVi: null },
      { build: 'cu-mot-module', host: 'uat.x', phamVi: '^/HocSinh' },
    ]);
    try {
      const t = dl.timSnapshotTruoc(d, { host: 'uat.x', phamVi: '^/HocSinh', boQuaBuild: 'moi' });
      expect(t.build, 'phải chọn bản CÙNG phạm vi').toBe('cu-mot-module');
      expect(dl.timSnapshotTruoc(d, { host: 'uat.x', phamVi: '^/KhongCo', boQuaBuild: 'moi' }),
        'không có bản nào cùng phạm vi ⇒ null, KHÔNG lấy bừa bản gần nhất').toBeNull();
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('khác HOST thì không so', () => {
    const d = kho([{ build: 'cu', host: 'uat.a', phamVi: null }]);
    try {
      expect(dl.timSnapshotTruoc(d, { host: 'uat.b', phamVi: null, boQuaBuild: 'moi' })).toBeNull();
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('BỎ QUA chính build đang chạy — nếu không nó tự so với chính mình', () => {
    const d = kho([{ build: 'hom-nay', host: 'uat.x', phamVi: null }]);
    try {
      expect(dl.timSnapshotTruoc(d, { host: 'uat.x', phamVi: null, boQuaBuild: 'hom-nay' })).toBeNull();
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('"chưa có gì để so" KHÁC "0 khác biệt" — CLI phải nói đúng cái nào', () => {
    /*
     * Hai câu đó cho ra cùng một con số 0 mà nghĩa ngược nhau: một cái nói hệ thống không đổi, cái kia
     * nói ta chưa biết gì. Gộp chúng là cách chắc chắn nhất để một build đổi hoàn toàn đi qua êm ru.
     */
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'scripts/qa/discover.js'), 'utf8');
    expect(src).toMatch(/co_snapshot_truoc/);
    expect(src).toMatch(/CHƯA CÓ GÌ ĐỂ SO/);
    expect(src, 'phải nói rõ hai thứ đó khác nhau').toMatch(/KHÔNG phải "0 khác biệt"/);
  });
});

test.describe('@infra §B10 — đề xuất chạy lại từ delta, CHỈ đề xuất', () => {
  test('màn mới và field đổi ràng buộc ⇒ mức CAO', () => {
    const d = dl.soSanh(
      { screens: [man('/x', [f('ten', { maxlength: 120 })])], apis: [] },
      { screens: [man('/x', [f('ten', { maxlength: 60 })]), man('/moi')], apis: [] },
    );
    const dx = dl.deXuatChayLai(d).de_xuat as { route: string; muc: string; vi_sao: string }[];
    expect(dx.find((x) => x.route === '/moi')!.muc).toBe('cao');
    const doi = dx.find((x) => x.route === '/x' && /RÀNG BUỘC/.test(x.vi_sao))!;
    expect(doi.muc).toBe('cao');
    expect(doi.vi_sao).toMatch(/\[BVA\]/);
  });

  test('component mới ⇒ mức TRUNG BÌNH, không phải cao', () => {
    const d = dl.soSanh(
      { screens: [man('/x', [], ['data_table'])], apis: [] },
      { screens: [man('/x', [], ['data_table', 'pagination'])], apis: [] },
    );
    const dx = dl.deXuatChayLai(d).de_xuat as { muc: string }[];
    expect(dx.every((x) => x.muc === 'trung bình')).toBe(true);
  });

  test('KHÔNG tự chạy, và nói rõ vì sao', () => {
    /*
     * Cùng luật với `reliability --promote`. Máy biết CÁI GÌ đổi nhưng không biết thay đổi đó có đáng
     * chạy lại hay không: một đổi nhãn hiển thị và một đổi `maxlength` trông giống nhau trong diff mà
     * hệ quả khác hẳn.
     */
    const r = dl.deXuatChayLai({ man_them: ['/a'], man_mat: [], man_doi: [], api_them: [], api_mat: [] });
    expect(String(r._chi_de_xuat)).toMatch(/CHỈ ĐỀ XUẤT, KHÔNG tự chạy/);
    expect(String(r._chi_de_xuat)).toMatch(/một đổi nhãn hiển thị và một đổi `maxlength`/);
  });

  test('0 thay đổi ⇒ 0 đề xuất, không bịa việc', () => {
    expect(dl.deXuatChayLai({ man_them: [], man_mat: [], man_doi: [], api_them: [], api_mat: [] }).de_xuat).toHaveLength(0);
  });
});

test.describe('@infra ba chế độ nay THẬT SỰ khác nhau', () => {
  test('`task` có phạm vi ⇒ bò lân cận một bước; chế độ khác thì không', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'scripts/qa/discover.js'), 'utf8');
    expect(src).toMatch(/lanCan: mode === 'task' && !!phamVi/);
  });

  test('trang LÂN CẬN được thăm rồi DỪNG, không gom link tiếp', () => {
    /*
     * Thiếu chặn đó thì "lân cận 1 bước" biến thành bò cả app sau vài vòng, và cái tên `task` lại hứa
     * một thứ mã không giữ — đúng lỗi của bản v2.6.0, chỉ khác hình dạng.
     */
    const src = fs.readFileSync(path.join(DIR, 'crawl.js'), 'utf8');
    expect(src).toMatch(/if \(!o\.lanCan \|\| laLanCan\) continue;/);
    expect(src, 'và màn lân cận phải tự khai là lân cận').toMatch(/lan_can: laLanCan === true/);
  });

  test('mã KHÔNG còn chỗ nào coi `mode` chỉ là một con số trần', () => {
    /* Phép kiểm chống tái phát: `mode` phải đổi HÀNH VI, không chỉ đổi trần token. */
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'scripts/qa/discover.js'), 'utf8');
    const soChoDungMode = (src.match(/mode === '/g) || []).length;
    expect(soChoDungMode, 'ít nhất 3 chỗ: cảnh báo task, lân cận, và nhánh delta').toBeGreaterThanOrEqual(3);
  });
});
