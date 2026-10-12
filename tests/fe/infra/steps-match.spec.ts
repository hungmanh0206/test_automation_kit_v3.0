/*
 * §C — DANH MỤC BƯỚC VÀ CÁCH KHỚP. Chạy hoàn toàn OFFLINE: không mở browser, không chạm UAT.
 *
 * Spec này gác ba thứ khác nhau, và cái thứ ba là cái dễ mất nhất:
 *
 *   1. CHUẨN HOÁ CÂU — các luật mà phép đo đã quyết định (giữ dấu khi gộp đồng nghĩa · chỉ thay ở vị trí
 *      động từ · cụm dài thắng cụm ngắn · tách mệnh đề nhưng không tách trong ngoặc và không tách SQL).
 *      Mỗi test ở đây là một lỗi đã xảy ra thật, không phải một trường hợp tưởng tượng.
 *
 *   2. MÁY GÁC DANH MỤC — phép đối chứng ÂM, mỗi phép kiểm phải bắt được đúng ca làm hỏng của nó.
 *
 *   3. PHÉP ĐỐI CHỨNG DƯƠNG TRÊN FIXTURE — bộ khớp chạy trên case thật cho ra 0–3%, và một con số 0 có
 *      hai cách đọc: bộ khớp hỏng, hoặc câu bước không viết theo chuẩn tham số. Fixture là thứ duy nhất
 *      phân biệt hai cách đọc đó. Mất nó thì "0%" không được phép dùng để kết luận gì.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const gate = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_catalog_check.js'));
const schemaMini = require(path.join(REPO, 'scripts', 'qa', 'lib', 'schema_mini.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const FIXTURE = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');
const DANH_MUC = path.join(REPO, 'tests', 'fe', 'lib', 'step_catalog.json');

const ng = () => sm.napNguPhap();
const gop = (s: string) => {
  const n = ng();
  return sm.gopDongNghia(s, n.nhom, n.ngat);
};
const tach = (s: string) => sm.tachMenhDe(s, ng().ngat);

test.describe('§C1 — danh mục bước', () => {
  test('bản đang commit phải SẠCH (đối chứng dương của máy gác)', () => {
    const d = gate.kiem();
    expect(Array.isArray(d.loi), `gate không đọc được danh mục: ${d.chiTiet}`).toBe(true);
    expect(d.loi, JSON.stringify(d.loi, null, 2)).toHaveLength(0);
  });

  test('cấu hình ngữ pháp CÓ THẬT — không được chạy ở nhánh rơi về mặc định', () => {
    /*
     * Nhánh thiếu file là nhánh tồi hơn, và nó in cảnh báo. Nếu repo lỡ mất file đó thì mọi con số
     * `steps:match` trong báo cáo đều thấp hơn thật, nên phải có máy canh chính sự tồn tại của nó.
     */
    expect(ng().thieu, 'thiếu .agent/config/step_phrasing.json').toBe(false);
    expect(ng().nhom.length).toBeGreaterThan(0);
  });

  test('mọi `impl` trong danh mục trỏ tới hàm export CÓ THẬT', () => {
    const dm = JSON.parse(fs.readFileSync(DANH_MUC, 'utf8'));
    for (const b of dm.buoc) {
      const [rel, ten] = String(b.impl).split('#');
      const abs = path.join(REPO, rel);
      expect(fs.existsSync(abs), `${b.id}: thiếu file ${rel}`).toBe(true);
      expect(gate.coExport(fs.readFileSync(abs, 'utf8'), ten), `${b.id}: ${rel} không export ${ten}`).toBe(true);
    }
  });

  test('bước `draft` không được khai `ti_le_on_dinh` — chưa chạy KHÁC chập chờn', () => {
    const dm = JSON.parse(fs.readFileSync(DANH_MUC, 'utf8'));
    for (const b of dm.buoc) {
      if (b.status !== 'draft') continue;
      expect(b.thong_ke.ti_le_on_dinh, `${b.id}`).toBeNull();
      expect(b.thong_ke.so_lan_dung, `${b.id}`).toBe(0);
    }
  });
});

test.describe('§C2 — gộp đồng nghĩa: giữ dấu, chỉ vị trí động từ', () => {
  /*
   * Năm ca dưới đây là năm câu THẬT mà bản đầu của bộ gộp làm sai, đo trên 4080 câu bước. Bản đầu gộp
   * trên chữ đã bỏ dấu và thay ở mọi vị trí, nên `nhấn`/`nhận`/`nhân`/`nhãn` cùng thành `nhan`.
   */
  const caSai: Array<[string, string]> = [
    ['Bước 1 ở hệ B: xác nhận đã có hồ sơ trường', 'xác nhận'],
    ['Mở mục 4. Hồ sơ đội ngũ / Hồ sơ nhân sự', 'nhân sự'],
    ['Đọc nguyên văn nhãn từng control trên thanh lọc', 'nhãn'],
    ['Bấm vào ô Tên trường và ghi vào evidence', 'vào'],
    ['Chạy db_readonly: SELECT COUNT(*) FROM LOP', 'SELECT'],
  ];
  for (const [cau, tuPhaiCon] of caSai) {
    test(`không đổi "${tuPhaiCon}" trong: ${cau.slice(0, 44)}…`, () => {
      expect(gop(cau)).toContain(tuPhaiCon);
    });
  }

  test('ĐỔI động từ ở đầu câu', () => {
    expect(gop('Kích nút "Ghi"')).toBe('bấm nút "Ghi"');
    expect(gop('Click nút "Ghi"')).toBe('bấm nút "Ghi"');
    expect(gop('Điền ô "Tên trường"')).toBe('nhập ô "Tên trường"');
  });

  test('ĐỔI động từ ngay sau dấu ngắt mệnh đề', () => {
    /*
     * Chữ HOA của từ KHÔNG bị thay được giữ nguyên văn — `Mở` và `Chọn` ở đây vốn đã là dạng chuẩn nên
     * hàm không chạm vào chúng. Chuẩn hoá chữ là việc của `boDau` ở bước so, không phải việc của bước
     * gộp đồng nghĩa: bước này còn phải in ra cho người đọc, và hạ chữ cả câu làm báo cáo khó đọc.
     */
    expect(gop('Mở màn "1.1", kích nút "Ghi"')).toBe('Mở màn "1.1", bấm nút "Ghi"');
    expect(gop('Chọn khối 10 rồi kích "Tìm"')).toBe('Chọn khối 10 rồi bấm "Tìm"');
  });

  test('CỤM DÀI thắng cụm ngắn, kể cả khi ở hai nhóm khác nhau', () => {
    /*
     * `kích` thuộc nhóm `bấm`, `kích chọn` thuộc nhóm `chọn`. Bản đầu thử theo thứ tự NHÓM nên `kích`
     * một từ thắng trước, và 41 lượt `kích chọn` trong case thật rơi hết vào `none`.
     */
    expect(gop('Kích chọn mục "1. Trường học"')).toBe('chọn mục "1. Trường học"');
    expect(gop('Mở lại màn "1.1"')).toBe('tải lại màn "1.1"');
  });

  test('KHÔNG gộp `đọc` với `ghi lại` — ghi lại là lưu evidence, đọc là quan sát', () => {
    expect(gop('Ghi lại giá trị ô "Tên trường"')).toContain('Ghi lại');
  });

  test('`tích` KHÔNG gộp vào `bấm` — checkbox và nút là hai thao tác', () => {
    /* `Tích` vốn là dạng chuẩn ⇒ không bị thay ⇒ giữ nguyên chữ hoa. Xem test trên. */
    expect(gop('Tích ô "Chọn"')).toBe('Tích ô "Chọn"');
    expect(gop('Tick ô "Chọn"')).toBe('tích ô "Chọn"');
    expect(gop('Tích chọn ô "Chọn"')).toBe('tích ô "Chọn"');
    /* Và quan trọng hơn: cả ba đều KHÔNG được thành `bấm`. */
    for (const s of ['Tích ô "Chọn"', 'Tick ô "Chọn"', 'Tích chọn ô "Chọn"']) {
      expect(sm.boDau(gop(s))).not.toContain('bam');
    }
  });
});

test.describe('§C2 — tách giá trị thành tham số', () => {
  test('nhận nháy kép (31% câu trong mẫu)', () => {
    const r = sm.tachGiaTri('nhập "Tên trường" = "Trường A"');
    expect(r.giaTri).toEqual(['Tên trường', 'Trường A']);
    expect(r.khung).toBe('nhập {} = {}');
  });

  test('nhận ngoặc VUÔNG (6% câu — bản đầu bỏ sót dạng này)', () => {
    const r = sm.tachGiaTri('bấm nút [Đồng bộ dữ liệu]');
    expect(r.giaTri).toEqual(['Đồng bộ dữ liệu']);
    expect(r.khung).toBe('bấm nút {}');
  });

  test('URL và biến môi trường KHÔNG thành tham số bước — chúng thuộc tầng màn L1', () => {
    const r = sm.tachGiaTri('mở <ops_base_url>/c3/lop.aspx');
    expect(r.giaTri).toEqual([]);
    expect(r.khung).toBe('mở <U>');
  });

  test('số trần thành `#` nhưng KHÔNG tính là tham số', () => {
    const r = sm.tachGiaTri('nhập Stt 87 = 100');
    expect(r.giaTri).toEqual([]);
    expect(r.khung).toBe('nhập Stt # = #');
  });

  test('KHÔNG tách bên trong câu SQL', () => {
    const sql = 'Chạy db_readonly: SELECT MA_TRUONG FROM TRUONG WHERE MA_TRUONG = \'74000718\'';
    const r = sm.tachGiaTri(sql);
    expect(r.giaTri).toEqual([]);
    expect(r.khung).toBe(sql);
  });
});

test.describe('§C2 — tách mệnh đề', () => {
  test('tách ở dấu phẩy và `rồi`', () => {
    expect(tach('1. Mở màn "1.1", chọn khối 10, bấm "Tìm"')).toEqual(['Mở màn "1.1"', 'chọn khối 10', 'bấm "Tìm"']);
    expect(tach('Nhập ô "A" rồi bấm "Ghi"')).toEqual(['Nhập ô "A"', 'bấm "Ghi"']);
  });

  test('KHÔNG tách ở `và` — nó nối cả danh từ: `Họ và tên`', () => {
    expect(tach('Xoá trắng ô "Họ và tên"')).toEqual(['Xoá trắng ô "Họ và tên"']);
    expect(tach('Mở màn và đọc nhãn')).toEqual(['Mở màn và đọc nhãn']);
  });

  test('KHÔNG tách dấu phẩy nằm TRONG ngoặc', () => {
    expect(tach('chọn "Khối 10, 11" trên lưới')).toEqual(['chọn "Khối 10, 11" trên lưới']);
    expect(tach('bấm nút [Ghi, rồi đóng]')).toEqual(['bấm nút [Ghi, rồi đóng]']);
  });

  test('KHÔNG tách câu SQL ở dấu phẩy giữa danh sách cột', () => {
    const sql = 'Chạy db_readonly: SELECT MA_TRUONG, TEN_TRUONG FROM TRUONG';
    expect(tach(sql)).toEqual([sql]);
  });

  test('bỏ số thứ tự đầu câu, bỏ mệnh đề quá ngắn', () => {
    expect(tach('3) Mở màn "1.1", ok')).toEqual(['Mở màn "1.1"']);
  });
});

test.describe('§C2 — khớp: exact đòi ĐỦ tham số', () => {
  const dm = () => sm.napDanhMuc();

  test('đủ tham số ⇒ exact', () => {
    const r = sm.khopCau('chọn combobox "cbNamHoc" = "2026-2027"', dm(), ng(), sm.NGUONG_MAC_DINH);
    expect(r.kieu).toBe('exact');
    expect(r.buoc_id).toBe('widget.combobox.chon-gia-tri');
    expect(r.gia_tri).toEqual(['cbNamHoc', '2026-2027']);
  });

  test('hình dạng trùng mà THIẾU tham số ⇒ fuzzy, không được là exact', () => {
    /*
     * Phân biệt duy nhất giữa "khớp được" và "CHẠY được". Nhập nhằng nó thì §D sinh ra spec gọi hàm
     * thiếu đối số, và cái đỏ hiện ở tầng Playwright với thông báo lạc hướng.
     */
    const r = sm.khopCau('chọn combobox "cbNamHoc" =', dm(), ng(), sm.NGUONG_MAC_DINH);
    expect(r.kieu).toBe('fuzzy');
    expect(r._vi_sao_khong_exact).toContain('bước cần 2');
  });

  test('thao tác không có bước nào phủ ⇒ none, KHÔNG gán bừa', () => {
    const r = sm.khopCau('tải tệp "danh-sach.xlsx" lên ô đính kèm', dm(), ng(), sm.NGUONG_MAC_DINH);
    expect(r.kieu).toBe('none');
  });

  test('fuzzy trả TỐI ĐA 3 ứng viên, và `none` khi dưới ngưỡng', () => {
    const r = sm.khopCau('chọn combobox "cbNamHoc" =', dm(), ng(), sm.NGUONG_MAC_DINH);
    expect(r.ung_vien.length).toBeLessThanOrEqual(3);
    const q = sm.khopCau('tải tệp "x.xlsx" lên', dm(), ng(), 0.99);
    expect(q.kieu).toBe('none');
    expect(q.ung_vien).toHaveLength(0);
  });

  test('ứng viên luôn nằm TRONG danh mục — không có mã bịa', () => {
    const maThat = new Set(dm().buoc.map((b: { id: string }) => b.id));
    const r = sm.khopCau('chọn combobox "cbNamHoc" =', dm(), ng(), 0.3);
    for (const u of r.ung_vien) expect(maThat.has(u.id), `mã lạ: ${u.id}`).toBe(true);
  });

  test('điểm theo TỪ, không theo ký tự: `Ghi` và `Huỷ` không được coi là gần nhau', () => {
    const a = sm.diem('bam nut ghi', 'bam nut huy');
    const b = sm.diem('bam nut ghi', 'bam nut ghi');
    expect(b).toBe(1);
    expect(a).toBeLessThan(0.8);
  });

  test('khác ĐỘNG TỪ thì tụt điểm mạnh', () => {
    expect(sm.diem('bam o {}', 'nhap o {}')).toBeLessThan(sm.diem('bam o {}', 'bam o {} tren luoi'));
  });
});

test.describe('§C — đối chứng DƯƠNG trên fixture', () => {
  test('fixture chuẩn §K: mọi mệnh đề khớp được đều `exact`', () => {
    const d = sm.dungDo({ taskKey: 'FIXTURE', nguong: sm.NGUONG_MAC_DINH, duongMd: FIXTURE });
    expect(d.loi, `không đọc được fixture: ${d.loi}`).toBeUndefined();
    /*
     * Ba mục của fixture CỐ Ý không khớp: TC_008 (thao tác chưa có bước) · TC_009 (câu SQL) · TC_010
     * (thiếu tham số ⇒ fuzzy). Mọi mệnh đề còn lại phải `exact`. Ghim con số theo công thức chứ không
     * theo hằng số, để thêm case vào fixture không làm test này đỏ oan.
     */
    expect(d.fuzzy).toBe(1);
    expect(d.none).toBe(2);
    expect(d.exact).toBe(d.so_menh_de - 3);
    expect(d.exact).toBeGreaterThanOrEqual(11);
  });

  test('con số thật 0–3% là con số ĐÚNG, không phải bộ khớp hỏng', () => {
    /*
     * Hai phép đo cạnh nhau trong CÙNG một test, vì chỉ đứng cạnh nhau chúng mới có nghĩa: cùng một bộ
     * khớp, cùng một danh mục 6 mục; trên câu viết theo chuẩn thì 79%, trên câu viết tự do thì gần 0.
     * Kết luận rút ra được: đòn bẩy nằm ở chuẩn viết câu bước (§K), không nằm ở bộ khớp.
     */
    const chuan = sm.dungDo({ taskKey: 'FIXTURE', nguong: sm.NGUONG_MAC_DINH, duongMd: FIXTURE });
    const tiLeChuan = chuan.exact / chuan.so_menh_de;
    expect(tiLeChuan).toBeGreaterThan(0.7);
  });
});

test.describe('§C3 — máy gác danh mục: đối chứng ÂM', () => {
  const GOC = () => JSON.parse(fs.readFileSync(DANH_MUC, 'utf8'));
  let tmp: string;
  test.beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'steps-catalog-')); });
  test.afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  const chay = (ten: string, pha: (d: Record<string, any>) => void) => {
    const d = GOC();
    pha(d);
    const f = path.join(tmp, `${ten}.json`);
    fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
    return gate.kiem({ duongDanhMuc: f });
  };

  const CA: Array<[string, number, (d: Record<string, any>) => void]> = [
    ['impl-file-thieu', 2, (d) => { d.buoc[0].impl = 'tests/fe/lib/_widget/khong-co.ts#chonGiaTri'; }],
    ['impl-ham-chua-viet', 2, (d) => { d.buoc[0].impl = 'tests/fe/lib/_widget/radcombobox.ts#hamBiaRa'; }],
    ['params-khong-khai', 3, (d) => { d.buoc[0].phrases.push('chọn {khongKhai} ở {id}'); }],
    ['trung-id', 4, (d) => { d.buoc[1].id = d.buoc[0].id; }],
    ['hai-buoc-mot-cau', 5, (d) => { d.buoc[1].phrases.push(d.buoc[0].phrases[0]); }],
    ['widget-khong-co', 6, (d) => { d.buoc[0].widget = ['telerik-grid']; }],
    ['active-chua-do', 1, (d) => { d.buoc[0].status = 'active'; }],
    ['thieu-post', 1, (d) => { delete d.buoc[0].post; }],
    ['version-sai-khuon', 1, (d) => { d.buoc[0].version = '1.0'; }],
    ['status-la', 1, (d) => { d.buoc[0].status = 'xong'; }],
    ['on-dinh-qua-1', 1, (d) => { d.buoc[0].thong_ke.ti_le_on_dinh = 1.5; }],
    ['impl-ngoai-thu-vien', 1, (d) => { d.buoc[0].impl = 'scripts/qa/x.js#f'; }],
    ['khoa-la', 1, (d) => { d.buoc[0].mau_moi = 'x'; }],
  ];

  for (const [ten, phep, pha] of CA) {
    test(`bắt được: ${ten} (phép ${phep})`, () => {
      const kq = chay(ten, pha);
      const ds = Array.isArray(kq.loi) ? kq.loi : [];
      expect(ds.length, 'không bắt được gì').toBeGreaterThan(0);
      expect(ds.some((x: { phep: number }) => x.phep === phep), `bắt bằng phép ${[...new Set(ds.map((x: { phep: number }) => x.phep))].join(',')} chứ không phải ${phep}`).toBe(true);
    });
  }

  test('danh mục 0 bước KHÔNG được coi là "hợp lệ"', () => {
    const kq = chay('rong', (d) => { d.buoc = []; });
    expect(kq.so_buoc).toBe(0);
    /* Hình dạng đúng nên 0 vi phạm — nhưng báo cáo phải nói ra, và đó là việc của `main()`. */
    expect(kq.loi).toHaveLength(0);
  });
});

test.describe('schema_mini — từ khoá lạ phải NÉM, không bỏ qua', () => {
  test('ném SchemaMiniError khi schema dùng từ khoá ngoài bộ con', () => {
    expect(() => schemaMini.kiem({}, { type: 'object', oneOf: [{ type: 'object' }] }))
      .toThrow(/KHÔNG HIỂU từ khoá/);
  });

  test('ghi chú `_*` của repo được bỏ qua CÓ Ý', () => {
    const r = schemaMini.kiem({ a: 1, _y: 'ghi chú' }, { type: 'object', additionalProperties: false, properties: { a: { type: 'integer' } }, _y: 'ghi chú' });
    expect(r.hop_le).toBe(true);
  });

  test('`type: ["number","null"]` nhận null mà không so `minimum`', () => {
    const s = { type: 'object', properties: { x: { type: ['number', 'null'], minimum: 0, maximum: 1 } } };
    expect(schemaMini.kiem({ x: null }, s).hop_le).toBe(true);
    expect(schemaMini.kiem({ x: 0.5 }, s).hop_le).toBe(true);
    expect(schemaMini.kiem({ x: 1.5 }, s).hop_le).toBe(false);
  });

  test('`$ref` tới `definitions` không có thật thì NÉM', () => {
    expect(() => schemaMini.kiem({ a: [{}] }, { type: 'object', properties: { a: { type: 'array', items: { $ref: '#/definitions/khongCo' } } } }))
      .toThrow(/không có trong `definitions`/);
  });

  test('phân biệt integer với number', () => {
    expect(schemaMini.kiem({ n: 1.5 }, { type: 'object', properties: { n: { type: 'integer' } } }).hop_le).toBe(false);
    expect(schemaMini.kiem({ n: 2 }, { type: 'object', properties: { n: { type: 'integer' } } }).hop_le).toBe(true);
  });
});
