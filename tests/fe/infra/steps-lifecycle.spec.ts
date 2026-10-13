/*
 * §E — VÒNG ĐỜI BƯỚC. Chạy hoàn toàn OFFLINE: không mở browser, không chạm UAT.
 *
 * Bốn chuyển trạng thái của bảng §5, và luật xuyên suốt cả bốn: **"chưa đo" không được biến thành một
 * kết luận.** Mỗi máy ở đây có ít nhất một test chứng minh nó TỪ CHỐI kết luận khi thiếu đầu vào — vì
 * một cửa luôn mở và một cửa luôn đóng đều vô dụng như nhau, chỉ khác chiều.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { thuMucTam } from './_thu_muc_tam';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const ss = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_stats.js'));
const sp = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_promote.js'));
const si = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_impact.js'));
const sr = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_reverify.js'));
const cs = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_spec.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const FIXTURE = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');

/** Dựng một cây `outputs/` giả có shard kết quả đúng khuôn, để đo `steps:stats` thật sự đọc được. */
function dungCayShard(cacStep: Array<{ tcId: string; name: string; status: string }>, runId = 'r1') {
  const goc = thuMucTam('stats');
  const dir = path.join(goc, 'DA', 'tasks', 'T1', 'test-results', 'testcase-status');
  fs.mkdirSync(dir, { recursive: true });
  const theoTc = new Map<string, Array<{ name: string; status: string }>>();
  for (const s of cacStep) {
    if (!theoTc.has(s.tcId)) theoTc.set(s.tcId, []);
    theoTc.get(s.tcId)!.push({ name: s.name, status: s.status });
  }
  for (const [tcId, steps] of theoTc) {
    fs.writeFileSync(path.join(dir, `${tcId}.json`), JSON.stringify({
      taskKey: 'T1', runId, at: '2026-10-12T00:00:00Z', test: { tcId, status: 'PASS', steps },
    }), 'utf8');
  }
  return goc;
}

test.describe('§E — steps:stats đọc được lượt chạy thật', () => {
  test('ĐỐI CHỨNG DƯƠNG: shard đúng khuôn `<mã> · <câu>` thì đo ra số', () => {
    /*
     * Trên repo này, 686/686 lượt step hiện có đều KHÔNG theo khuôn (chúng là spec viết tay). Nên nếu
     * chỉ chạy trên dữ liệu thật, `steps:stats` in một bảng rỗng và không ai biết nó có chạy hay không.
     * Đây là phép đo duy nhất chứng minh bộ đọc hoạt động.
     */
    const goc = dungCayShard([
      { tcId: 'TC_1', name: 'widget.combobox.chon-gia-tri · chọn combobox "A" = "B"', status: 'PASSED' },
      { tcId: 'TC_1', name: 'widget.combobox.doc-gia-tri · đọc giá trị combobox "A"', status: 'PASSED' },
      { tcId: 'TC_2', name: 'widget.combobox.chon-gia-tri · chọn combobox "C" = "D"', status: 'FAILED' },
    ]);
    const d = ss.dungDo(null, goc);
    fs.rmSync(goc, { recursive: true, force: true });

    expect(d.soStepKhongKhuon).toBe(0);
    const chon = d.buoc.find((b: { id: string }) => b.id === 'widget.combobox.chon-gia-tri');
    expect(chon.so_luot).toBe(2);
    expect(chon.so_luot_hong).toBe(1);
    expect(chon.so_lan_dung, 'dùng ở 2 case').toBe(2);
    expect(chon.ti_le_on_dinh).toBe(0.5);
  });

  test('bước KHÔNG có lượt nào ⇒ `ti_le_on_dinh` là `null`, KHÔNG phải 0', () => {
    const goc = dungCayShard([{ tcId: 'TC_1', name: 'widget.combobox.doc-items · đọc danh sách', status: 'PASSED' }]);
    const d = ss.dungDo(null, goc);
    fs.rmSync(goc, { recursive: true, force: true });
    expect(d.chua_do).toContain('widget.combobox.chon-gia-tri');
    /* Và mục chưa đo KHÔNG xuất hiện trong bảng với số 0 — nó nằm ở danh sách riêng. */
    expect(d.buoc.some((b: { id: string }) => b.id === 'widget.combobox.chon-gia-tri')).toBe(false);
  });

  test('step KHÔNG theo khuôn thì được đếm riêng, không bị bỏ qua im lặng', () => {
    const goc = dungCayShard([
      { tcId: 'TC_1', name: 'Mở màn hồ sơ trường', status: 'PASSED' },
      { tcId: 'TC_1', name: 'widget.combobox.doc-items · đọc danh sách', status: 'PASSED' },
    ]);
    const d = ss.dungDo(null, goc);
    fs.rmSync(goc, { recursive: true, force: true });
    expect(d.soStep).toBe(2);
    expect(d.soStepKhongKhuon).toBe(1);
  });

  test('mã bước chạy thật mà KHÔNG có trong danh mục thì bị nêu ra', () => {
    const goc = dungCayShard([{ tcId: 'TC_1', name: 'man.hoso.bam-ghi · bấm Ghi', status: 'PASSED' }]);
    const d = ss.dungDo(null, goc);
    fs.rmSync(goc, { recursive: true, force: true });
    expect(d.la_ma).toContain('man.hoso.bam-ghi');
  });

  test('tên thư mục shard lấy TỪ recorder, không gõ lại', () => {
    /* Hai bản sao sẽ trôi khỏi nhau, và khi trôi thì `steps:stats` quét sai chỗ rồi báo 0 bước. */
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'utils', 'evidence_recorder.js'), 'utf8');
    expect(src).toContain(`STATUS_DIRNAME = '${ss.tenThuMucShard()}'`);
  });
});

test.describe('§E — steps:promote: "chưa đo" không bao giờ đủ điều kiện', () => {
  const buocGia = (thongKe: Record<string, unknown>, status = 'draft') => ({
    id: 'x', status, thong_ke: thongKe,
  });

  test('`ti_le_on_dinh: null` ⇒ TỪ CHỐI, kể cả khi dùng nhiều case', () => {
    const r = sp.duDieuKien(buocGia({ so_lan_dung: 99, ti_le_on_dinh: null }), { so_luot: 99, so_lan_dung: 99 });
    expect(r.dat).toBe(false);
    expect(r.vi_sao).toContain('CHƯA ĐO');
  });

  test('`ti_le_on_dinh: 0` KHÁC `null` — nó là một phép đo, và nó trượt ngưỡng', () => {
    const r = sp.duDieuKien(buocGia({ so_lan_dung: 5, ti_le_on_dinh: 0 }), { so_luot: 5, so_lan_dung: 5 });
    expect(r.dat).toBe(false);
    expect(r.vi_sao).toContain('ổn định 0%');
    expect(r.vi_sao).not.toContain('CHƯA ĐO');
  });

  test('đủ cả ba ngưỡng ⇒ ĐẠT đường A', () => {
    const r = sp.duDieuKien(buocGia({ so_lan_dung: 2, ti_le_on_dinh: 1 }), { so_luot: 3, so_lan_dung: 2 });
    expect(r.dat).toBe(true);
    expect(r.duong).toBe('A');
  });

  test('thiếu MỘT ngưỡng là trượt, và báo đúng ngưỡng nào thiếu', () => {
    const itLuot = sp.duDieuKien(buocGia({ so_lan_dung: 2, ti_le_on_dinh: 1 }), { so_luot: 2, so_lan_dung: 2 });
    expect(itLuot.dat).toBe(false);
    expect(itLuot.vi_sao).toContain('2 lượt < 3');

    const itCase = sp.duDieuKien(buocGia({ so_lan_dung: 1, ti_le_on_dinh: 1 }), { so_luot: 5, so_lan_dung: 1 });
    expect(itCase.dat).toBe(false);
    expect(itCase.vi_sao).toContain('1 case < 2');
  });

  test('KHÔNG suy số LƯỢT từ `so_lan_dung` — hai đại lượng khác nhau', () => {
    /*
     * Một case có thể chạy bước đó ba lần, và ba case có thể mỗi case chạy một lần. Không có bản đo
     * của `steps:stats` thì không biết số lượt, và đoán nó là trượt điều kiện A.
     */
    const r = sp.duDieuKien(buocGia({ so_lan_dung: 9, ti_le_on_dinh: 1 }), null);
    expect(r.dat).toBe(false);
    expect(r.vi_sao).toContain('số LƯỢT');
  });

  test('bước không ở `draft` thì không có gì để thăng', () => {
    expect(sp.duDieuKien(buocGia({ so_lan_dung: 5, ti_le_on_dinh: 1 }, 'active'), { so_luot: 9, so_lan_dung: 5 }).dat).toBe(false);
    expect(sp.duDieuKien(buocGia({ so_lan_dung: 5, ti_le_on_dinh: 1 }, 'needs_reverify'), { so_luot: 9, so_lan_dung: 5 }).dat).toBe(false);
  });

  test('đường B (review) BẮT BUỘC có người ký và lý do', () => {
    const thieuNguoi = sp.thang({ id: 'widget.combobox.chon-gia-tri', review: true, viSao: 'có lý do' });
    expect(thieuNguoi.loi).toContain('BẮT BUỘC');
    const thieuViSao = sp.thang({ id: 'widget.combobox.chon-gia-tri', review: true, nguoi: 'ai đó' });
    expect(thieuViSao.loi).toContain('BẮT BUỘC');
  });

  test('đường B ghi NGƯỜI, LÝ DO và NGÀY vào chính danh mục — không ghi thì không đối chất được', () => {
    /* `ghi: false` ⇒ không chạm file thật; chỉ kiểm nội dung bản ghi sẽ được viết. */
    const r = sp.thang({ id: 'widget.combobox.chon-gia-tri', review: true, nguoi: 'QA-lead', viSao: 'chỉ chạy ở GDTX', ghi: false });
    expect(r.ok).toBe(true);
    expect(r.duong).toBe('B');
    expect(r.ghi_chu).toContain('QA-lead');
    expect(r.ghi_chu).toContain('chỉ chạy ở GDTX');
    expect(r.ghi_chu).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('danh mục trên đĩa KHÔNG bị đổi khi chưa truyền `--ghi`', () => {
    const truoc = fs.readFileSync(sm.DUONG_DANH_MUC, 'utf8');
    sp.thang({ id: 'widget.combobox.chon-gia-tri', review: true, nguoi: 'x', viSao: 'y', ghi: false });
    expect(fs.readFileSync(sm.DUONG_DANH_MUC, 'utf8')).toBe(truoc);
  });
});

test.describe('§E — cửa phiên bản: đổi hợp đồng phải tăng số chính', () => {
  const dm = (over: Record<string, unknown> = {}) => ({
    buoc: [{
      id: 'a.b.c', version: '1.0.0', status: 'active',
      params: { id: 'string' }, pre: 'p', post: 'q', impl: 'tests/fe/lib/x.ts#f',
      mo_ta: 'm', phrases: ['x {id}'], screen: '*', thong_ke: {},
      ...over,
    }],
  });

  test('đổi `params` mà không tăng số chính ⇒ CHẶN', () => {
    const d = si.cuaPhienBan({ nay: dm({ params: { id: 'string', them: 'string' } }), cu: dm(), dung: new Map() });
    expect(d.chan).toHaveLength(1);
    expect(d.chan[0].doi).toContain('params');
  });

  for (const k of ['pre', 'post', 'impl']) {
    test(`đổi \`${k}\` mà không tăng số chính ⇒ CHẶN`, () => {
      const d = si.cuaPhienBan({ nay: dm({ [k]: 'KHÁC' }), cu: dm(), dung: new Map() });
      expect(d.chan).toHaveLength(1);
      expect(d.chan[0].doi).toContain(k);
    });
  }

  test('đổi hợp đồng VÀ tăng số chính ⇒ qua, nhưng vẫn nêu vùng ảnh hưởng', () => {
    const d = si.cuaPhienBan({ nay: dm({ pre: 'KHÁC', version: '2.0.0' }), cu: dm(), dung: new Map() });
    expect(d.chan).toHaveLength(0);
    expect(d.canh_bao).toHaveLength(1);
  });

  test('tăng số PHỤ không đủ cho một đổi hợp đồng', () => {
    const d = si.cuaPhienBan({ nay: dm({ pre: 'KHÁC', version: '1.1.0' }), cu: dm(), dung: new Map() });
    expect(d.chan).toHaveLength(1);
  });

  test('đổi `mo_ta`/`phrases`/`ghi_chu` KHÔNG phải đổi hợp đồng', () => {
    /*
     * Thêm một cách diễn đạt chỉ làm bước khớp được nhiều câu hơn, không làm spec đang chạy vỡ. Cửa báo
     * oan mỗi lần ai đó thêm `phrases` thì người ta sẽ học cách bỏ qua nó.
     */
    const d = si.cuaPhienBan({
      nay: dm({ mo_ta: 'mô tả mới', phrases: ['x {id}', 'cách viết mới {id}'], ghi_chu: 'thêm ghi chú' }),
      cu: dm(),
      dung: new Map(),
    });
    expect(d.chan).toHaveLength(0);
    expect(d.canh_bao).toHaveLength(0);
  });

  test('bước MỚI không có hợp đồng cũ để phá', () => {
    const nay = dm();
    nay.buoc.push({ ...dm().buoc[0], id: 'moi.toanh' } as never);
    const d = si.cuaPhienBan({ nay, cu: dm(), dung: new Map() });
    expect(d.chan).toHaveLength(0);
  });

  test('XOÁ bước khỏi danh mục mà spec còn gọi ⇒ CHẶN; không ai gọi ⇒ chỉ cảnh báo', () => {
    const conGoi = new Map([['a.b.c', [{ file: 'f.spec.ts', tcId: 'TC_1', version: '1.0.0' }]]]);
    const coNguoiDung = si.cuaPhienBan({ nay: { buoc: [] }, cu: dm(), dung: conGoi, so_file: 1 });
    expect(coNguoiDung.chan).toHaveLength(1);
    expect(coNguoiDung.chan[0].doi).toContain('XOÁ KHỎI DANH MỤC');

    const khongAiDung = si.cuaPhienBan({ nay: { buoc: [] }, cu: dm(), dung: new Map(), so_file: 1 });
    expect(khongAiDung.chan).toHaveLength(0);
    expect(khongAiDung.canh_bao).toHaveLength(1);
  });

  test('chưa có danh mục ở HEAD ⇒ nói "chưa có gì để so", không nói "không có thay đổi"', () => {
    const d = si.cuaPhienBan({ nay: dm(), cu: null });
    expect(d.chua_co_o_head).toBe(true);
  });

  test('`aiDangDung` đọc được dấu `Bước đã dùng` của TỪNG case, không chỉ case đầu', () => {
    const out = thuMucTam('impact');
    cs.bienDich({ taskKey: 'FIXTURE', duongMd: FIXTURE, outDir: out });
    const src = fs.readdirSync(out).filter((f) => f.endsWith('.spec.ts'))
      .map((f) => fs.readFileSync(path.join(out, f), 'utf8')).join('\n');
    fs.rmSync(out, { recursive: true, force: true });
    /* Fixture có nhiều case khớp bước, nên dấu phải xuất hiện nhiều lần. */
    expect((src.match(/Bước đã dùng:/g) || []).length).toBeGreaterThan(1);
  });
});

test.describe('§E — needs_reverify theo delta của discovery', () => {
  const buoc = (over: Record<string, unknown> = {}) => ({
    id: 'a.b.c', status: 'active', screen: 'HoSoTruong.aspx', widget: ['radcombobox'],
    thong_ke: { screen_fingerprint: 'fp-cu' }, ...over,
  });

  test('màn của bước nằm trong delta ⇒ bị đánh dấu', () => {
    const d = sr.anhHuongTuDelta({ buoc: [buoc()] }, { man_doi: [{ route: 'HoSoTruong.aspx', component_mat: [] }] });
    expect(d.anh_huong).toHaveLength(1);
  });

  test('màn BIẾN MẤT cũng tính', () => {
    const d = sr.anhHuongTuDelta({ buoc: [buoc()] }, { man_mat: ['HoSoTruong.aspx'], man_doi: [] });
    expect(d.anh_huong).toHaveLength(1);
  });

  test('bước `screen: "*"` KHÔNG đổ đồng theo mọi màn đổi', () => {
    /*
     * Bước tầng widget áp cho mọi màn. Nếu hễ màn nào đổi là chúng chuyển `needs_reverify` thì cả danh
     * mục đỏ sau mỗi lượt discovery, và một tín hiệu luôn bật thì không còn là tín hiệu.
     */
    const d = sr.anhHuongTuDelta(
      { buoc: [buoc({ screen: '*' })] },
      { man_doi: [{ route: 'ManKhac.aspx', component_mat: [] }] },
    );
    expect(d.anh_huong).toHaveLength(0);
    expect(d.khong_anh_huong).toHaveLength(1);
  });

  test('bước `screen: "*"` BỊ đánh dấu khi chính widget của nó biến mất', () => {
    const d = sr.anhHuongTuDelta(
      { buoc: [buoc({ screen: '*' })] },
      { man_doi: [{ route: 'ManKhac.aspx', component_mat: ['RadComboBox'] }] },
    );
    expect(d.anh_huong).toHaveLength(1);
    expect(d.anh_huong[0].vi_sao).toContain('radcombobox');
  });

  test('`screen_fingerprint: null` ⇒ KHÔNG KẾT LUẬN ĐƯỢC, không phải "không bị ảnh hưởng"', () => {
    const d = sr.anhHuongTuDelta(
      { buoc: [buoc({ thong_ke: { screen_fingerprint: null } })] },
      { man_doi: [{ route: 'HoSoTruong.aspx', component_mat: [] }] },
    );
    expect(d.anh_huong).toHaveLength(0);
    expect(d.khong_anh_huong).toHaveLength(0);
    expect(d.khong_ket_luan_duoc).toHaveLength(1);
    expect(d.khong_ket_luan_duoc[0].vi_sao).toContain('CHƯA CÓ DẤU');
  });

  test('bước không ở `active` nằm ngoài phép chuyển này', () => {
    const d = sr.anhHuongTuDelta(
      { buoc: [buoc({ status: 'draft' })] },
      { man_doi: [{ route: 'HoSoTruong.aspx', component_mat: [] }] },
    );
    expect(d.anh_huong).toHaveLength(0);
    expect(d.khong_ket_luan_duoc).toHaveLength(1);
  });

  test('đề xuất `deprecated` TỪ CHỐI chạy khi mẫu số spec bằng 0', () => {
    /*
     * "Không ai dùng" và "chưa có spec nào được sinh ra" cho cùng một con số 0, và chúng là hai chuyện
     * khác hẳn nhau. Trên checkout sạch, `outputs/**` trống nên đây đúng là tình huống thật.
     */
    const r = sr.deXuatDeprecated();
    if (r.loi) expect(r.loi).toContain('quét 0 spec');
    else expect(r.so_spec_quet).toBeGreaterThan(0);
  });
});
