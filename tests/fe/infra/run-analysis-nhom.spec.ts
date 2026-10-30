/*
 * @infra `run:analysis --nhom` — gom case đỏ theo nguyên nhân gốc (v2.9.6 N2.1).
 *
 * Đây là lõi của `test-report-analyzer` bên A mà `run_report_reader` chưa có: một lượt 40 case đỏ
 * thường không phải 40 việc, mà 3–4 nguyên nhân.
 *
 * NHƯNG PHÉP ĐO ĐÃ HẠ KỲ VỌNG XUỐNG, và spec này khoá đúng mức đã hạ:
 *   · 336 ca đỏ trên 5 task thật → 251 nhóm, **nén 1,34×**; hai task nén **1,0×** (không gom được gì);
 *   · chỉ **38/336 = 11%** ca nối được CÂU LỖI THẬT — và **ba trong năm task có 0 dòng lỗi** (193 ca),
 *     chỗ đó phải sửa ở lượt chạy, không sửa được ở bộ gom;
 *   · soi tay 9 nhóm: **6 nhóm gom sai**, vì `comment` phần lớn là câu KHUÔN MẪU chứ không phải
 *     nguyên nhân (một nhóm 23 case chỉ chung câu "Lệch kỳ vọng ở N bước");
 *   · và tỉ lệ nén KHÔNG phải điểm chất lượng: vá bộ nối làm CSDL-9004 từ 57 lên **65 nhóm** — nén tụt
 *     đúng vì gom ĐÚNG HƠN.
 *
 * Nên nó là BẢN NHÌN ĐẦU, và spec bên dưới có một phép kiểm riêng bắt buộc bản in phải TỰ NÓI điều đó.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/run_analysis.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ra = require(GATE);

type Tc = { tcId: string; status: string; comment?: string; failureLayer?: string };

/** Dựng sổ verdict + (tuỳ chọn) results.json mang câu lỗi theo tiêu đề. */
function dungLuot(tests: Tc[], loi?: [string, string][]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nhom-'));
  const tr = path.join(d, 'test-results');
  fs.mkdirSync(tr, { recursive: true });
  const f = path.join(tr, 'testcase-status.json');
  fs.writeFileSync(f, JSON.stringify({ taskKey: 'T-1', tests }, null, 2), 'utf8');
  if (loi) {
    fs.mkdirSync(path.join(tr, 'runs', 'r1'), { recursive: true });
    fs.writeFileSync(path.join(tr, 'runs', 'r1', 'results.json'), JSON.stringify({
      suites: [{ specs: loi.map(([title, msg]) => ({ title, tests: [{ results: [{ error: { message: msg } }] }] })) }],
    }, null, 2), 'utf8');
  }
  return { d, f };
}

const chay = (f: string) => {
  const r = spawnSync(process.execPath, [GATE, '--nhom', '--status', f], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const soNhom = (out: string) => Number((out.match(/→ \*\*(\d+) nhóm\*\*/) || [])[1]);

test.describe('@infra run:analysis --nhom — gom đúng, tách đúng', () => {
  test('ĐỐI CHỨNG ①: 5 case CÙNG một locator hỏng ⇒ MỘT nhóm', () => {
    const msg = 'Error: locator.click: Timeout 15000ms exceeded waiting for #btnGhi';
    const tests: Tc[] = [1, 2, 3, 4, 5].map((i) => ({
      tcId: `M_TC_00${i}`, status: 'FAILED', failureLayer: 'script_error',
    }));
    const loi: [string, string][] = tests.map((t, i) => [`${t.tcId} — bước ${i}`, msg]);
    const k = dungLuot(tests, loi);
    const r = chay(k.f);
    expect(r.code, r.out).toBe(0);
    expect(soNhom(r.out), `5 case cùng lỗi phải ra 1 nhóm — ${r.out}`).toBe(1);
    expect(r.out).toMatch(/5 case:/);
    fs.rmSync(k.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ②: hai lỗi KHÁC nhau cùng mã HTTP 500 ⇒ HAI nhóm', () => {
    /*
     * Chuẩn hoá bỏ số, nhưng PHẢI giữ mã HTTP. Gộp hai lỗi này là dạy người đọc rằng "500" là một
     * nguyên nhân — trong khi 500 chỉ là cách server kêu đau.
     */
    const tests: Tc[] = [
      { tcId: 'M_TC_001', status: 'FAILED', failureLayer: 'be' },
      { tcId: 'M_TC_002', status: 'FAILED', failureLayer: 'be' },
    ];
    const loi: [string, string][] = [
      ['M_TC_001 — lưu hồ sơ', 'Error: POST /api/hoso trả HTTP 500 — khoá ngoại ID_TRUONG không tồn tại'],
      ['M_TC_002 — xuất Excel', 'Error: GET /api/xuat trả HTTP 500 — hết bộ nhớ khi dựng tệp'],
    ];
    const k = dungLuot(tests, loi);
    const r = chay(k.f);
    expect(soNhom(r.out), `hai nguyên nhân khác nhau phải là hai nhóm — ${r.out}`).toBe(2);
    fs.rmSync(k.d, { recursive: true, force: true });
  });

  test('chuẩn hoá bỏ SỐ · ID · ĐƯỜNG DẪN · THỜI GIAN, nhưng GIỮ mã HTTP', () => {
    const n = ra.chuanHoaLoi;
    expect(n('Error: chờ 15000 ms ở D:/tmp/x/a.png lúc 2026-10-30 09:12'))
      .toBe('chờ <ms> ở <đường-dẫn> lúc <lúc>');
    expect(n('AssertionError: CSDL_HS_TC_048 lệch 3 dòng')).toBe('<TC> lệch <số> dòng');
    /* Hai câu CÙNG nguyên nhân, khác số ⇒ cùng chữ ký. */
    expect(n('Error: lệch 3 dòng')).toBe(n('Error: lệch 97 dòng'));
    /* Mã HTTP giữ nguyên ⇒ hai mã khác nhau vẫn là hai chữ ký. */
    expect(n('trả HTTP 500 ở A')).not.toBe(n('trả HTTP 404 ở A'));
    expect(n('trả HTTP 500 ở A')).toContain('500');
  });

  test('tầng lỗi là MỘT PHẦN của chữ ký — cùng câu, khác tầng ⇒ khác nhóm', () => {
    /* Cùng triệu chứng mà khác tầng thì khác việc phải làm: sửa script ≠ log bug sản phẩm. */
    const tests: Tc[] = [
      { tcId: 'M_TC_001', status: 'FAILED', failureLayer: 'script_error', comment: 'Lệch kỳ vọng ở 2 bước' },
      { tcId: 'M_TC_002', status: 'FAILED', failureLayer: 'product_bug', comment: 'Lệch kỳ vọng ở 2 bước' },
    ];
    const k = dungLuot(tests);
    expect(soNhom(chay(k.f).out)).toBe(2);
    fs.rmSync(k.d, { recursive: true, force: true });
  });

  test('BẢN IN PHẢI TỰ KHAI BA GIỚI HẠN — tỉ lệ nén, tỉ lệ nối được, và "không cửa nào được chặn"', () => {
    /*
     * Phép kiểm QUAN TRỌNG NHẤT ở file này. Một bản gom gọn rất dễ bị đọc thành "4 nguyên nhân" trong
     * khi thật ra là "4 câu khuôn mẫu". Số đo thật: nén 1,4× trên 5 task, 7% ca nối được câu lỗi thật,
     * 6/9 nhóm mẫu gom sai. Giấu ba số đó đi thì bản gom thành một lời khai đẹp hơn thực tế.
     */
    const tests: Tc[] = [
      { tcId: 'M_TC_001', status: 'FAILED', comment: 'a' },
      { tcId: 'M_TC_002', status: 'FAILED', comment: 'b' },
    ];
    const k = dungLuot(tests);
    const out = chay(k.f).out;
    expect(out, 'phải in tỉ lệ nén').toMatch(/Nén [\d.]+×/);
    expect(out, 'phải in tỉ lệ nối được câu lỗi thật').toMatch(/\d+\/\d+ ca nối được/);
    expect(out, 'phải nói rõ nén ~1,0× là không gom được gì').toMatch(/KHÔNG gom được gì/);
    expect(out, 'phải cấm dùng bản gom này để chặn').toMatch(/KHÔNG cửa nào được chặn/);
    fs.rmSync(k.d, { recursive: true, force: true });
  });

  test('0 case đỏ ⇒ nói rõ KHÔNG phải kết luận về chất lượng', () => {
    const k = dungLuot([{ tcId: 'M_TC_001', status: 'PASSED' }]);
    const r = chay(k.f);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/KHÔNG phải một kết luận về chất lượng/);
    fs.rmSync(k.d, { recursive: true, force: true });
  });

  test('mã TC có HẬU TỐ CHỮ vẫn nối được (`TC_078c`)', () => {
    /*
     * Mẫu đầu dùng `TC_\d+\b` nên bỏ sót đúng những mã kiểu `CSDL_HS_TC_078c` — bộ case thật có chúng.
     */
    expect('CSDL_HS_TC_078c — thôi học'.match(ra.RE_TC_TRONG_TIEU_DE)?.[0]).toBe('CSDL_HS_TC_078c');
    expect('M_TC_010 — x'.match(ra.RE_TC_TRONG_TIEU_DE)?.[0]).toBe('M_TC_010');
  });

  test('MÃ TRẦN trong tiêu đề nối được MÃ ĐỦ trong sổ (`TC_021` ⇄ `CSDL_NHANSU_TC_021`)', () => {
    /*
     * Lỗi thật: CSDL-9004 có 39 dòng lỗi, 28 mã TC trong tiêu đề, mà nối được 0/86 ca — chỉ vì spec đặt
     * tiêu đề bằng mã trần còn sổ ghi mã đủ. Một giới hạn GIẢ bị tôi ghi vào tài liệu như giới hạn thật.
     */
    const noi = ra.boNoi(
      [{ tcId: 'CSDL_NHANSU_TC_021', status: 'FAILED' }],
      new Map([['TC_021 — lưu hồ sơ đội ngũ', 'Error: ô bắt buộc không được bỏ trống']]),
    );
    expect(noi('CSDL_NHANSU_TC_021')).toMatch(/ô bắt buộc/);
  });

  test('ĐỐI CHỨNG ÂM: hậu tố NHẬP NHẰNG (2 ca cùng `TC_021`) ⇒ TỪ CHỐI nối', () => {
    /*
     * Nối sai tệ hơn không nối: người đọc được đưa một câu lỗi của case KHÁC và tin đó là nguyên nhân.
     * Đo toàn repo thì hiện 0 trường hợp nhập nhằng — nhưng "hiện chưa xảy ra" không phải lý do bỏ gác.
     */
    const noi = ra.boNoi(
      [
        { tcId: 'CSDL_NHANSU_TC_021', status: 'FAILED' },
        { tcId: 'CSDL_LOP_TC_021', status: 'FAILED' },
      ],
      new Map([['TC_021 — một màn nào đó', 'Error: câu lỗi không rõ của ai']]),
    );
    expect(noi('CSDL_NHANSU_TC_021'), 'nhập nhằng thì thà KHÔNG nối').toBeUndefined();
    expect(noi('CSDL_LOP_TC_021')).toBeUndefined();
  });

  test('mã ĐỦ khớp chính xác vẫn thắng, và KHÔNG khớp nhầm mã dài hơn', () => {
    const noi = ra.boNoi(
      [{ tcId: 'A_TC_01', status: 'FAILED' }, { tcId: 'A_TC_010', status: 'FAILED' }],
      new Map([['A_TC_010 — x', 'Error: của 010']]),
    );
    expect(noi('A_TC_010')).toMatch(/của 010/);
    expect(noi('A_TC_01'), '`TC_01` KHÔNG được ăn câu lỗi của `TC_010`').toBeUndefined();
  });

  test('con số "nối được" in ra PHẢI dùng cùng bộ nối với phép gom', () => {
    /*
     * Bản đầu có HAI bản sao logic nối, nên bản in khai "0 ca nối được" trong khi phép gom đã nối 15 ca.
     * Một con số tự nói sai về chính mình thì tệ hơn là không in.
     */
    const tests: Tc[] = [{ tcId: 'CSDL_NHANSU_TC_021', status: 'FAILED', failureLayer: 'fe' }];
    const k = dungLuot(tests, [['TC_021 — lưu hồ sơ', 'Error: ô bắt buộc không được bỏ trống']]);
    const out = chay(k.f).out;
    expect(out, 'nối bằng mã trần thì số in ra phải là 1/1, không phải 0/1').toMatch(/1\/1 ca nối được/);
    fs.rmSync(k.d, { recursive: true, force: true });
  });

  test('`--nhom` KHÔNG được nối vào bó gate nào — nó là báo cáo', () => {
    /*
     * Điều kiện DỪNG của prompt v2.9.6: gom sai > 2/10 nhóm mẫu ⇒ giữ ở mức báo cáo. Đo được 6/9.
     * Khoá lại để lần sau không ai lặng lẽ đưa nó vào cửa.
     */
    const pc = fs.readFileSync(path.join(REPO, 'scripts/qa/phase_check.js'), 'utf8');
    expect(pc, '`--nhom` không được có trong bó gate cuối phase').not.toMatch(/--nhom/);
  });
});
