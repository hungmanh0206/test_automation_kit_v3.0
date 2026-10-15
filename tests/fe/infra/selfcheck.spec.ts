import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync, execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { canRepoGit } from './_trong_repo';

/*
 * KIỂM CHÍNH MÁY KIỂM (v2.7.0 §A10) — phần A10.1 và A10.6.
 *
 * Ba lỗi mở đầu §A10 đều là GATE XANH VÌ KHÔNG KIỂM GÌ, và không spec nào đỏ khi chúng xảy ra:
 *   · `expansion_audit` đọc `t.id` thay vì `t.tcId` ⇒ "0/6 đỏ" mà trông yên tâm;
 *   · `dimension_coverage` đọc config thiếu, rơi vào `catch → []` ⇒ gate tắt, không báo gì;
 *   · bộ 530 case "đủ coverage" trong khi một chiều chỉ phủ 12%.
 *
 * A10.1 là luật chống chúng; A10.6 là phép đo xem spec có đủ mạnh để bắt một gate bị làm hỏng.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const engine = require(path.join(REPO, 'scripts/qa/lib/gate_engine'));
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const sm = require(path.join(REPO, 'scripts/qa/gate_selfmutate.js'));

test.describe.configure({ mode: 'default' });

test.describe('@infra A10.1 — kiểm 0 thứ thì KHÔNG được báo ĐẠT', () => {
  test('`CHUA_KIEM` là trạng thái RIÊNG, không gộp vào PASS lẫn SKIP', () => {
    /*
     * Gộp vào `SKIP` làm nó biến mất khỏi mọi phép đếm "còn gì chưa kiểm"; gộp vào `PASS` thì đúng là
     * ba lỗi mở đầu §A10.
     */
    expect(engine.STATUS.CHUA_KIEM).toBe('CHUA_KIEM');
    expect(engine.STATUS.CHUA_KIEM).not.toBe(engine.STATUS.PASS);
    expect(engine.STATUS.CHUA_KIEM).not.toBe(engine.STATUS.SKIP);
  });

  test('mẫu số 0 ⇒ CHUA_KIEM, không PASS', () => {
    expect(engine.toResult('g', { mauSo: 0 }).status).toBe('CHUA_KIEM');
  });

  test('mẫu số KHÔNG KHAI ⇒ CHUA_KIEM khi gọi `kiemMauSo` trực tiếp', () => {
    /* Không khai mẫu số nghĩa là không biết gate đã kiểm bao nhiêu thứ — đó cũng là "chưa kiểm". */
    expect(engine.kiemMauSo(null)!.status).toBe('CHUA_KIEM');
    expect(engine.kiemMauSo(undefined)!.status).toBe('CHUA_KIEM');
  });

  test('mẫu số THẤP HƠN RÕ so với đầu vào ⇒ CHUA_KIEM', () => {
    /* Đây là ca `expansion_audit`: đọc sai tên trường nên mẫu số tụt mà gate vẫn xanh. */
    expect(engine.toResult('g', { mauSo: 2, dauVao: 10 }).status).toBe('CHUA_KIEM');
    expect(engine.toResult('g', { mauSo: 8, dauVao: 10 }).status).toBe('PASS');
    expect(engine.TI_LE_MAU_SO_TOI_THIEU).toBe(0.5);
  });

  test('WARN + mẫu số 0 ⇒ CHUA_KIEM — cảnh báo trên mẫu số 0 là cảnh báo về chỗ chưa đo gì', () => {
    /*
     * LỖ ĐÃ ĐO ĐƯỢC: bản đầu chỉ hạ `PASS`, nên `gate:output` trên một task có 0 case execute vẫn báo
     * `WARN` và luật A10.1 không áp. Chính `check` trên một task tạm phơi ra chuyện đó.
     */
    expect(engine.toResult('g', { warnings: ['x'], mauSo: 0 }).status).toBe('CHUA_KIEM');
  });

  test('FAIL KHÔNG bị hạ xuống CHUA_KIEM', () => {
    /* Gate đọc được ít nhưng ĐÃ THẤY vi phạm thì vi phạm đó vẫn thật. Hạ nó là bỏ một phát hiện. */
    expect(engine.toResult('g', { problems: ['x'], mauSo: 0 }).status).toBe('FAIL');
  });

  test('gate KHÔNG khai mẫu số thì giữ hợp đồng CŨ — không đổi hàng chục gate trong một commit', () => {
    expect(engine.toResult('g', {}).status).toBe('PASS');
  });

  test('`aggregate` KHÔNG để CHUA_KIEM rơi vào nhánh PASS', () => {
    /*
     * Thiếu chỗ này thì một bộ 40 PASS cộng 3 CHUA_KIEM gộp thành `PASS`, và dòng tổng nói "mọi thứ
     * đạt" trong khi ba phép kiểm chưa chạy được. Đó đúng là cách ba lỗi mở đầu §A10 sống sót.
     */
    const agg = engine.aggregate([engine.toResult('a', {}), engine.toResult('b', { mauSo: 0 })]);
    expect(agg.status).toBe('CHUA_KIEM');
    expect(agg.chua_kiem).toEqual(['b']);
  });

  test('CHUA_KIEM cũng KHÔNG thành FAIL — chưa kiểm được không phải một vi phạm', () => {
    const agg = engine.aggregate([engine.toResult('b', { mauSo: 0 })]);
    expect(agg.status).toBe('CHUA_KIEM');
    expect(agg.totalFail).toBe(0);
    expect(agg.blockers).toEqual([]);
  });

  test('FAIL thắng CHUA_KIEM trong phép gộp', () => {
    const agg = engine.aggregate([engine.toResult('a', { problems: ['x'] }), engine.toResult('b', { mauSo: 0 })]);
    expect(agg.status).toBe('FAIL');
    expect(agg.chua_kiem).toEqual(['b']);
  });

  test('`format` in ra CHUA_KIEM kèm câu phủ định cách đọc sai', () => {
    const out = engine.format(engine.aggregate([engine.toResult('b', { mauSo: 0 })]));
    expect(out).toContain('CHƯA KIỂM');
    expect(out).toMatch(/KHÔNG phải đạt/);
  });

  test('`check` đưa CHUA_KIEM lên DÒNG TỔNG, không giấu xuống dưới', () => {
    /*
     * Đo thật: một task chỉ có `testcase-status.json` rỗng thì `gate:output` có mẫu số 0. Trước khi vá,
     * dòng tổng nói "✓ 2 kiểm đạt" và không nhắc gì.
     */
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'a101-'));
    const taskDir = path.join(goc, 'tasks', 'T-A101');
    fs.mkdirSync(path.join(taskDir, 'test-results'), { recursive: true });
    fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'test-results', 'testcase-status.json'), '{"tests":[]}', 'utf8');
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/check.js'), '--task', 'T-A101'],
      { cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-A101' } });
    const dongDau = `${r.stdout}`.split('\n')[0];
    expect(dongDau, 'dòng tổng phải nhắc CHƯA KIỂM').toContain('CHƯA KIỂM');
    expect(`${r.stdout}`).toMatch(/◌ CHƯA KIỂM — gate đã CHẠY nhưng mẫu số 0/);
    expect(`${r.stdout}`, 'và nói rõ nguyên nhân thường gặp').toMatch(/đọc sai tên trường|rơi vào `catch`/);
  });

  test('`check` khai mẫu số cho từng gate trong tiến trình', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/check.js'), 'utf8');
    for (const g of ['design:gate', 'gate:gen-testcase', 'gate:output']) {
      const i = src.indexOf(`toResult('${g}'`);
      expect(i, `${g} không gọi toResult`).toBeGreaterThan(0);
      expect(src.slice(i, i + 260), `${g} không khai mauSo`).toContain('mauSo');
    }
  });

  test('số dòng đã chấm ĐẾM THẬT, không dùng lại `so_case`', () => {
    /*
     * Hai con số trông như một nhưng không phải: `so_case` là số case parse ra được, còn số dòng đã
     * chấm là số lần `gateTestcaseRow` thực sự chạy. Chúng lệch khi một doc parse lỗi giữa đường, và
     * đúng chỗ lệch đó là chỗ gate kiểm ít hơn tưởng mà vẫn xanh.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/check.js'), 'utf8');
    expect(src).toMatch(/soDongDaCham \+= 1/);
    expect(src).toMatch(/ĐẾM THẬT số dòng đã chấm/);
  });
});

test.describe('@infra A10.7 — bản đồ LUẬT → GATE → SPEC: không ô nào được để trống', () => {
  /*
   * Bản đồ này tồn tại để trả lời "luật nào đang có máy thi hành". Giá trị của nó nằm hết ở chỗ KHÔNG ô
   * nào trống: một mục luật không nối được gate và cũng không có lời khai sẽ được đọc thành "chưa có lỗ",
   * đúng cách đọc sai mà §A10.7 đặt ra để chặn.
   *
   * Nó đã trả về một phát hiện thật ngay lượt đầu: §Cleanup Rules liệt kê hẳn bảng pattern file dump
   * (`scratch_*`, `*_debug.txt`) và nói rõ chuyện đã xảy ra — dump API/swagger sót ở root repo, thường
   * chứa email và SĐT — mà không máy nào quét. Đó là loại `do_duoc_ma_chua_co_may`, và nhãn đó phải TỒN
   * TẠI: ghi nó là "không đo được bằng máy" là khai sai, vì quét root theo bảng pattern là phép đo hiển nhiên.
   */
  const KHAI = path.join(REPO, '.agent/config/rule_coverage_notes.json');

  test('mọi mục luật không nối được gate đều CÓ lời khai', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const rc = require(path.join(REPO, 'scripts/qa/rule_coverage.js'));
    const d = rc.dungBang();
    const trong = d.banDo.filter((x: { gate: unknown[]; khai: unknown }) => !x.gate.length && !x.khai);
    expect(trong.map((x: { muc: string }) => x.muc), 'ô trống sẽ được đọc thành "không có lỗ"').toEqual([]);
  });

  test('mẫu số spec đếm theo `git ls-files`, KHÔNG theo đĩa', () => {
    /*
     * ĐÂY LÀ LÝ DO `rule:coverage:check` CỨ ĐỎ LẠI TRÊN CI.
     *
     * Máy sinh từng đếm bằng `readdirSync`, tức gộp cả spec WIP chưa commit của người đang chạy. Đo
     * 15/10/2026: đĩa **150** spec trong `tests/fe/infra`, git track **137** — chênh 13 file probe
     * đang dở. Ai sinh lại tài liệu lúc có WIP sẽ commit số 150, rồi CI (chỉ có file đã track) tính ra
     * 137 và CHẶN. Người đó không làm gì sai; cái sai là phép đếm phụ thuộc thứ KHÔNG nằm trong commit.
     *
     * Test này neo vào `git ls-files` chứ không neo vào một con số cố định — con số sẽ đổi, còn luật
     * "mẫu số phải là thứ CI nhìn thấy" thì không.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const rc = require(path.join(REPO, 'scripts/qa/rule_coverage.js'));
    canRepoGit(REPO, 'đối chiếu mẫu số spec của `rule_coverage` với `git ls-files`');

    const d = rc.dungBang();
    expect(rc.THEO_DIA, 'trong repo git thì KHÔNG được rơi về nhánh đếm theo đĩa').toBe(false);

    const track = execFileSync('git', ['ls-files', 'tests/fe/infra/*.spec.ts'], { cwd: REPO, encoding: 'utf8' })
      .split('\n').map((x) => x.trim()).filter((x) => x.endsWith('.spec.ts')).length;
    expect(d.soSpec, 'mẫu số phải bằng số spec ĐÃ TRACK — đó là thứ CI nhìn thấy').toBe(track);

    const dia = fs.readdirSync(path.join(REPO, 'tests/fe/infra')).filter((f) => f.endsWith('.spec.ts')).length;
    if (dia === track) {
      test.skip(true, `cây đang sạch (đĩa ${dia} = track ${track}) — hai phép đếm trùng nhau nên lượt này `
        + 'không phân biệt được chúng. Phép kiểm chỉ có răng khi có file chưa track.');
      return;
    }
    expect(d.soSpec, `đĩa có ${dia} spec, track ${track} — lấy số đĩa là lấy cả WIP chưa commit`).not.toBe(dia);
  });

  test('nhãn trong lời khai phải là nhãn CÓ ĐỊNH NGHĨA, không phải chuỗi gõ tay', () => {
    /*
     * Một nhãn gõ sai vẫn render ra bảng dưới dạng chuỗi trong nháy ngược, trông y như nhãn thật. Lúc đó
     * bảng có vẻ đã rà xong mà thực ra mục đó không thuộc loại nào.
     */
    const j = JSON.parse(fs.readFileSync(KHAI, 'utf8'));
    const hopLe = Object.keys(j._loai);
    expect(hopLe.length, 'phải có đủ bốn loại').toBeGreaterThanOrEqual(4);
    for (const m of j.muc) {
      expect(hopLe, `mục "${m.ten}" khai nhãn lạ: ${m.loai}`).toContain(m.loai);
      expect(String(m.ghi_chu).length, `mục "${m.ten}" khai nhãn mà không nói vì sao`).toBeGreaterThan(80);
    }
  });

  test('`--check` CHẶN khi có mục chưa ai rà, và nói rõ phải khai ở đâu', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/rule_coverage.js'), 'utf8');
    expect(src).toContain('chưa ai phân loại');
    expect(src).toContain('rule_coverage_notes.json');
    expect(src, 'chặn thì phải exit khác 0').toMatch(/chuaRa\.length[\s\S]{0,900}?process\.exit\(1\)/);
  });

  test('file khai nằm trong gói kit — thiếu nó thì máy mới CHẶN oan 6 mục', () => {
    const pk = fs.readFileSync(path.join(REPO, 'scripts/qa/package_kit.js'), 'utf8');
    expect(pk).toContain('.agent/config/rule_coverage_notes.json');
  });
});

test.describe('@infra A10.6 — gate_selfmutate: spec có bắt được gate bị làm hỏng không', () => {
  test('bộ đột biến tái hiện lỗi THẬT, mỗi cái có nguồn', () => {
    expect(sm.DOT_BIEN.length).toBeGreaterThanOrEqual(4);
    for (const d of sm.DOT_BIEN) {
      expect(String(d.y).length, `${d.ma}: thiếu mô tả`).toBeGreaterThan(15);
      expect(String(d.lo_that).length, `${d.ma}: phải nêu lỗ THẬT nó tái hiện`).toBeGreaterThan(40);
    }
    /* Hai đột biến đầu phải là đúng hai lỗi mở đầu §A10. */
    const ma = sm.DOT_BIEN.map((d: { ma: string }) => d.ma);
    expect(ma).toContain('DOI_TEN_TRUONG');
    expect(ma).toContain('NUOT_EXCEPTION');
  });

  test('ít nhất 5 gate T0/T1 trong danh sách mục tiêu (§A10.6)', () => {
    expect(sm.MUC_TIEU.length).toBeGreaterThanOrEqual(5);
    for (const m of sm.MUC_TIEU) {
      expect(fs.existsSync(path.join(REPO, m.gate)), `thiếu gate ${m.gate}`).toBe(true);
      expect(fs.existsSync(path.join(REPO, m.spec)), `thiếu spec ${m.spec}`).toBe(true);
    }
  });

  test('TỪ CHỐI chạm file đang SỬA DỞ', () => {
    /*
     * Nó sửa file source thật. Cây bẩn thì không phân biệt được đột biến của nó với thay đổi đang sửa
     * dở, và trả lại "nguyên văn" sẽ xoá mất việc của người đang làm.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    expect(src).toMatch(/đang SỬA DỞ/);
    expect(src).toContain('git status --porcelain'.replace('git status --porcelain', "'status', '--porcelain'"));
  });

  test('LUÔN trả lại nguyên văn trong `finally`', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    const i = src.indexOf('} finally {');
    expect(i, 'phải có finally').toBeGreaterThan(0);
    expect(src.slice(i, i + 300)).toContain('writeFileSync(duong, goc');
  });

  test('spec ĐANG ĐỎ trước khi đột biến ⇒ BỎ QUA, không kết luận', () => {
    /* Spec đang đỏ thì mọi mutant "bị bắt" đều là kết luận rỗng — nó đỏ vì lý do khác. */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    expect(src).toMatch(/spec ĐANG ĐỎ trước khi đột biến/);
    expect(src).toMatch(/kết luận sau đó là rỗng/);
  });

  test('"không áp được" KHÔNG tính là "đã bắt"', () => {
    /*
     * Một mutant không áp được vào file không nói gì về spec. Gộp nó vào "bị bắt" làm tỉ lệ đẹp lên mà
     * không thêm một phép đo nào.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    expect(src).toContain('khong_ap_dung');
    expect(src).toMatch(/"không áp được" KHÔNG phải "đã bắt"/);
  });

  test('mutant sống sót TRÊN ĐƯỜNG PHÁN ⇒ exit khác 0; ngoài đường phán thì không', () => {
    /*
     * Đo 12/10/2026: bản đầu exit 1 cho MỌI mutant sống sót, và 3 trong 5 lượt đó rơi vào code không
     * thuộc luật gác (hàm đọc cờ, dòng `console.log`, nhánh lỗi I/O). Chặn vì những chỗ đó là báo oan:
     * nó đòi viết spec cho chỗ không có phép đo nào để viết, và cách duy nhất "đạt" là mở cửa sau cho
     * gate nhận đường dẫn từ env — tệ hơn thứ nó đo.
     *
     * Nhưng chiều ngược lại mới là chỗ dễ sai: xếp một mutant vào "ngoài đường phán" là MIỄN cho nó, nên
     * phép xếp loại phải hẹp và phải khai lý do. Test này khoá đúng hai vế đó.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    expect(src).toMatch(/MUTANT SỐNG SÓT = SPEC YẾU/);
    expect(src, 'exit phải theo số mutant TRÊN đường phán').toContain('process.exit(trenDuong.length ? 1 : 0)');

    /* Phép xếp loại: chỉ ba lớp, và mỗi lớp trả về LÝ DO chứ không trả `true`. */
    expect(sm.ngoaiDuongPhan('if (chanVi.length) {'), 'điều kiện chặn phải nằm TRÊN đường phán').toBeNull();
    expect(sm.ngoaiDuongPhan('console.log(`  ${m.tcId}`);')).toContain('IN ra màn hình');
    expect(sm.ngoaiDuongPhan('const i = process.argv.indexOf(`--x`);')).toContain('ĐỌC CỜ');
    expect(sm.ngoaiDuongPhan('} catch (e) { return []; }', "fs.appendFileSync(d, x); } catch (e) { return []; }")).toContain('I/O');
  });

  test('đột biến làm VỠ CÚ PHÁP không được đếm là "bị bắt"', () => {
    /*
     * Lỗi THẬT của chính máy này, tìm ra 12/10/2026. Toán tử `NUOT_EXCEPTION` cũ dùng regex `[^}]*` nên ở
     * `override.js` nó cắt giữa một template literal có `}` bên trong. File không parse được, spec đỏ, và
     * lượt đó được đếm là "bị bắt" — trong khi một file không parse được thì MỌI spec đều đỏ, kể cả spec
     * rỗng. Đúng loại màu đỏ không mang nghĩa mà nó tự nhận.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    expect(src).toContain('VỠ CÚ PHÁP');
    expect(src, 'phải có trọng tài cú pháp, không tin regex').toMatch(/vm\.Script/);

    /* Ứng viên vỡ cú pháp phải bị loại chứ không được chọn. */
    const op = sm.DOT_BIEN.find((x: { ma: string }) => x.ma === 'NUOT_EXCEPTION');
    expect(op.nhieu_ung_vien, 'toán tử phải đề xuất NHIỀU ứng viên để còn chỗ loại').toBeTruthy();
    const thuc = fs.readFileSync(path.join(REPO, 'scripts/qa/override.js'), 'utf8');
    const chon = sm.ganDotBien(thuc, op, 'override.js');
    expect(chon, 'phải chọn được một ứng viên còn parse được').not.toBeNull();
    expect(() => new (require('vm').Script)(chon as string, { filename: 'x.js' })).not.toThrow();
  });

  test('KHÁC `mutation_check` — và file nói rõ khác ở đâu', () => {
    /*
     * `mutation_check` tiêm lỗi vào DỮ LIỆU (response ở tầng page.route) và đo bộ assertion trong
     * testcase. Máy này tiêm vào CODE CỦA GATE và đo bộ spec. Lẫn hai thứ là lý do §1a khai sai cách đo
     * trùng lắp giữa gate.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_selfmutate.js'), 'utf8');
    expect(src).toMatch(/KHÁC `mutation_check` Ở ĐÂU/);
    expect(src).toContain('bộ spec của tôi có bắt được một gate bị làm hỏng không');
  });

  test('`ganDotBien` trả null khi không khớp — không sửa bừa', () => {
    const src = 'const a = 1;\n';
    for (const d of sm.DOT_BIEN) {
      const r = sm.ganDotBien(src, d);
      if (r !== null) expect(r).not.toBe(src);
    }
    /* Mutant đổi tên trường KHÔNG áp được vào source không có `.tcId`. */
    const doiTen = sm.DOT_BIEN.find((d: { ma: string }) => d.ma === 'DOI_TEN_TRUONG');
    expect(sm.ganDotBien('const x = 1;', doiTen)).toBeNull();
    expect(sm.ganDotBien('const y = t.tcId;', doiTen)).toBe('const y = t.id;');
  });
});
