/*
 * §F — CHẠY LẠI KHÔNG TỐN LƯỢT AI, VÀ CHỌN TEST THEO BƯỚC ĐỔI. OFFLINE, không chạm UAT.
 *
 * Hai luật, và cả hai đều là luật về CÁCH ĐỌC MỘT CON SỐ 0:
 *
 *   - `replay:check` đếm số lượt phải gọi người/model để chạy lại. Số 0 chỉ có nghĩa khi có spec để
 *     đếm; 0 spec thì nó phải nói "chưa đo được", không nói "miễn phí".
 *   - `select:tests` khi KHÔNG tính được vùng ảnh hưởng của một bước đổi thì phải chạy TẤT CẢ, không
 *     rơi về `@smoke`. 0 spec biên dịch nghĩa "chưa biết", không nghĩa "không ai bị ảnh hưởng".
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { thuMucTam } from './_thu_muc_tam';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const cs = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_spec.js'));
const rp = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'replay_check.js'));
const si = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_impact.js'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const FIXTURE = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');
const tmp = (ten: string) => thuMucTam(ten);

test.describe('§F — replay:check đếm lượt phải gọi AI', () => {
  test('fixture còn TODO ⇒ con số LỚN HƠN 0, và tách theo từng loại', () => {
    const out = tmp('rp');
    cs.bienDich({ taskKey: 'FIXTURE', duongMd: FIXTURE, outDir: out });
    const d = rp.dungDo({ taskKey: 'FIXTURE', duongMd: FIXTURE, gocSpec: out });
    fs.rmSync(out, { recursive: true, force: true });

    expect(d.tong_luot_can_ai).toBeGreaterThan(0);
    expect(d.luot_can_ai.TODO_ORACLE, 'fixture có 10 case, mỗi case một dòng kỳ vọng không neo được').toBe(10);
    expect(d.luot_can_ai.TODO_SETUP, '9 case có tag [ui], 1 case [pre_existing] không sinh TODO').toBe(9);
    expect(d.luot_can_ai.fuzzy, 'TC_010 cố ý thiếu tham số').toBe(1);
    /* Tổng phải đúng bằng tổng bốn cột — không được là một con số rời. */
    const l = d.luot_can_ai;
    expect(d.tong_luot_can_ai).toBe(l.TODO_STEP + l.TODO_ORACLE + l.TODO_SETUP + l.fuzzy);
  });

  test('ĐỐI CHỨNG DƯƠNG: case đủ mọi mặt ⇒ 0 lượt', () => {
    /*
     * Thiếu phép đo này thì `replay:check` chỉ chứng minh được một điều — rằng nó biết đếm TODO. Nó
     * chưa bao giờ chạm con số 0, và con số 0 mới là thứ §7 hứa.
     *
     * Dựng danh mục có `status: active` (danh mục thật đang toàn `draft`, và bước `draft` làm case
     * thành `test.skip`), case dùng `[pre_existing]` và dòng kỳ vọng có thông báo bọc nháy.
     */
    const danhMuc = {
      buoc: [{
        id: 'x.bam.ghi',
        mo_ta: 'Bấm nút Ghi trên form',
        phrases: ['bấm nút {nhan}'],
        params: { nhan: 'string' },
        screen: '*',
        pre: 'đang ở form',
        post: 'đã gửi form',
        impl: 'tests/fe/lib/_widget/radcombobox.ts#chonChuoi',
        version: '1.0.0',
        status: 'active',
        thong_ke: { so_lan_dung: 3, ti_le_on_dinh: 1, last_verified_build: 'b1', screen_fingerprint: 'fp' },
      }],
    };
    const tc = {
      tcId: 'DU_TC_001',
      module: 'Đủ / một case',
      title: 'case đủ mọi mặt',
      precondition: '[pre_existing] Đã có sẵn dữ liệu',
      steps: [{ n: 1, text: 'bấm nút "Ghi"' }],
      expected: [{ n: 1, text: 'Hiển thị thông báo "Lưu thành công"' }],
    };
    const out = tmp('rp-du');
    const r = cs.sinhFile({ taskKey: 'DU', nhanFile: 'Đủ', cases: [tc], danhMuc, nguPhap: sm.napNguPhap(), specDir: out });
    fs.writeFileSync(path.join(out, 'du.spec.ts'), r.noiDung, 'utf8');

    const todo = rp.demTodo(out);
    fs.rmSync(out, { recursive: true, force: true });

    expect(todo.TODO_STEP).toHaveLength(0);
    expect(todo.TODO_ORACLE, 'dòng kỳ vọng có thông báo bọc nháy ⇒ sinh được `expectToast`').toHaveLength(0);
    expect(todo.TODO_SETUP, '`[pre_existing]` không dựng bằng máy nên không phải TODO').toHaveLength(0);
    expect(todo.so_case_du).toBe(1);
    expect(todo.case_skip_khac).toHaveLength(0);
  });

  test('case KHÔNG còn TODO nhưng vẫn `test.skip` thì KHÔNG tính là "chạy được ngay"', () => {
    /*
     * Chỗ hở thật: bước `draft` đẩy case thành `test.skip` mà không để lại TODO nào. Đếm nó vào "đủ"
     * là khai một case chạy được trong khi Playwright sẽ bỏ qua nó.
     */
    const danhMuc = {
      buoc: [{
        id: 'x.bam.ghi',
        mo_ta: 'Bấm nút Ghi trên form',
        phrases: ['bấm nút {nhan}'],
        params: { nhan: 'string' },
        screen: '*',
        pre: 'đang ở form',
        post: 'đã gửi form',
        impl: 'tests/fe/lib/_widget/radcombobox.ts#chonChuoi',
        version: '1.0.0',
        status: 'draft', /* ← khác biệt duy nhất so với test trên */
        thong_ke: { so_lan_dung: 0, ti_le_on_dinh: null, last_verified_build: null, screen_fingerprint: null },
      }],
    };
    const tc = {
      tcId: 'DRAFT_TC_001',
      module: 'Draft / một case',
      title: 'case dùng bước draft',
      precondition: '[pre_existing] Đã có sẵn dữ liệu',
      steps: [{ n: 1, text: 'bấm nút "Ghi"' }],
      expected: [{ n: 1, text: 'Hiển thị thông báo "Lưu thành công"' }],
    };
    const out = tmp('rp-draft');
    const r = cs.sinhFile({ taskKey: 'DR', nhanFile: 'Draft', cases: [tc], danhMuc, nguPhap: sm.napNguPhap(), specDir: out });
    fs.writeFileSync(path.join(out, 'draft.spec.ts'), r.noiDung, 'utf8');

    const todo = rp.demTodo(out);
    fs.rmSync(out, { recursive: true, force: true });

    expect(todo.so_case, 'vẫn là 1 case').toBe(1);
    expect(todo.so_case_du, 'KHÔNG được đếm là chạy được ngay').toBe(0);
    expect(todo.case_skip_khac).toHaveLength(1);
  });

  test('bước `draft` KHÔNG cộng vào tổng lượt cần AI — nó là rủi ro kết luận, không phải chi phí chạy', () => {
    const out = tmp('rp-d');
    cs.bienDich({ taskKey: 'FIXTURE', duongMd: FIXTURE, outDir: out });
    const d = rp.dungDo({ taskKey: 'FIXTURE', duongMd: FIXTURE, gocSpec: out });
    fs.rmSync(out, { recursive: true, force: true });
    expect(d.buoc_draft.length, 'danh mục thật đang toàn draft').toBeGreaterThan(0);
    const l = d.luot_can_ai;
    expect(d.tong_luot_can_ai).toBe(l.TODO_STEP + l.TODO_ORACLE + l.TODO_SETUP + l.fuzzy);
  });

  test('0 spec biên dịch ⇒ CHƯA ĐO ĐƯỢC, không phải "chạy lại miễn phí"', () => {
    const out = tmp('rp-rong');
    const todo = rp.demTodo(out);
    fs.rmSync(out, { recursive: true, force: true });
    expect(todo.so_file).toBe(0);
    expect(todo.so_case).toBe(0);
    /* `main()` biến đúng tình huống này thành exit 2 — xem `replay_check.js`. */
  });
});

test.describe('§F — select:tests thấy được thư viện bước', () => {
  const specGia = new Map([['x.bam.ghi', [{ file: 'outputs/DA/tasks/T/automation/compiled/a.spec.ts', tcId: 'TC_1', version: '1.0.0' }]]]);
  const dmGia = {
    buoc: [{ id: 'x.bam.ghi', impl: 'tests/fe/lib/_widget/radcombobox.ts#chonChuoi', version: '1.0.0', status: 'active' }],
  };

  test('nhận đúng file nào thuộc thư viện bước', () => {
    /*
     * LỖ ĐÃ ĐO: trước §F, cả bốn đường dẫn dưới đây đều rơi vào nhánh "@smoke" của `select:tests` —
     * kể cả `_checks/index.ts`, tầng DUY NHẤT được phép chứa `expect`.
     */
    for (const f of [
      'tests/fe/lib/step_catalog.json',
      'tests/fe/lib/_widget/radcombobox.ts',
      'tests/fe/lib/_checks/index.ts',
      '.agent/config/step_phrasing.json',
    ]) expect(si.laThuVienBuoc(f), f).toBe(true);

    for (const f of ['tests/fe/infra/x.spec.ts', 'scripts/qa/judge.js', 'tests/support/setup/index.ts']) {
      expect(si.laThuVienBuoc(f), f).toBe(false);
    }
  });

  test('đổi `step_catalog.json` ⇒ MỌI spec biên dịch, không khoanh theo mã bước', () => {
    /* Một mục đổi `phrases` làm MỌI câu khớp lại, nên không khoanh theo mã bước được. */
    const v = si.vungAnhHuongTuFileDoi(['tests/fe/lib/step_catalog.json'], { dung: specGia, so_file: 1 });
    expect(v.dien_rong).toBe(false);
    expect(v.spec).toHaveLength(1);
    expect(v.ly_do).toContain('mọi spec biên dịch');
  });

  test('đổi file thi hành ⇒ chỉ spec gọi bước có `impl` trỏ vào file đó', () => {
    const v = si.vungAnhHuongTuFileDoi(['tests/fe/lib/_widget/radcombobox.ts'], { dung: specGia, so_file: 1, danhMuc: dmGia });
    expect(v.dien_rong).toBe(false);
    expect(v.spec).toEqual(['outputs/DA/tasks/T/automation/compiled/a.spec.ts']);
  });

  test('0 spec biên dịch ⇒ DIỆN RỘNG, KHÔNG phải "không ai bị ảnh hưởng"', () => {
    /*
     * Đây là luật quan trọng nhất của §F ở phía chọn test. Rơi về `@smoke` ở đây là biến một phép đo
     * thiếu thành một lời bảo đảm — và nó im lặng, vì suite vẫn xanh.
     */
    const v = si.vungAnhHuongTuFileDoi(['tests/fe/lib/_checks/index.ts'], { dung: new Map(), so_file: 0 });
    expect(v.dien_rong).toBe(true);
    expect(v.spec).toHaveLength(0);
    expect(v.ly_do).toContain('CHƯA BIẾT');
  });

  test('có spec nhưng không bước nào trỏ tới file đổi ⇒ vẫn DIỆN RỘNG', () => {
    const v = si.vungAnhHuongTuFileDoi(['tests/fe/lib/_checks/index.ts'], { dung: specGia, so_file: 1, danhMuc: dmGia });
    expect(v.dien_rong).toBe(true);
    expect(v.ly_do).toContain('CHƯA BIẾT');
  });

  test('không file thư viện nào đổi ⇒ không can thiệp vào quyết định cũ', () => {
    const v = si.vungAnhHuongTuFileDoi(['scripts/qa/judge.js', 'tests/fe/infra/x.spec.ts']);
    expect(v.thu_vien_doi).toHaveLength(0);
    expect(v.dien_rong).toBe(false);
    expect(v.spec).toHaveLength(0);
  });

  test('`select_tests.js` thật sự gọi hàm này, không giữ bản sao logic', () => {
    /* Hai bản sao sẽ trôi khỏi nhau — đợt này đã trả giá ba lần cho đúng chuyện đó. */
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'select_tests.js'), 'utf8');
    expect(src).toContain('vungAnhHuongTuFileDoi');
    expect(src, 'khi diện rộng thì phải chạy TẤT CẢ, không @smoke').toMatch(/buocDienRong\s*\)\s*\{\s*args\s*=\s*'tests'/);
  });
});
