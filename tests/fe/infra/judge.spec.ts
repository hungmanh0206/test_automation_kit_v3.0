import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * TẦNG CHẤM CHO PHẦN MÁY KHÔNG ĐO ĐƯỢC (v2.7.0 §A11).
 *
 * `rule:coverage` (§A10.7) trả lời được "luật nào có máy thi hành". Phần còn lại KHÔNG được để trống:
 * một mục ghi "không đo được bằng máy" mà rồi không ai chấm thì nhãn đó chỉ là một lời miễn trừ.
 *
 * Chỗ dễ sai nhất của một tầng như thế là tin nó quá mức. Nên `judge.js` KHÔNG chấm — nó chọn mẫu, giữ
 * thang, kiểm lời chấm có đủ neo, và đo xem người chấm có hiệu chuẩn hay không. Bộ test này nặng về ba
 * luật không đổi được: chấm chưa hiệu chuẩn là CHƯA ĐƯỢC GÁC, lời chấm phải có neo, và tầng này không
 * được ghi đè verdict của máy T0.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/judge.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const j = require(MAY);

const HEADER = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
const NGAN = '|---|---|---|---|---|---|---|---|---|---|';

function boCase(n: number, modun: (i: number) => string) {
  const dong = [];
  for (let i = 1; i <= n; i += 1) {
    const id = `GOLD_TC_${String(i).padStart(3, '0')}`;
    dong.push(`| ${id} | Functional | [Positive] | ${modun(i)} | Case ${i} | [ui] x | n/a | 1. a | 1. b | Medium |`);
  }
  return ['# Bộ', '', HEADER, NGAN, ...dong, ''].join('\n');
}

function dungTask(md: string, taskKey = 'T-JUDGE') {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-'));
  const taskDir = path.join(goc, 'tasks', taskKey);
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'test-cases', 'tc.md'), md, 'utf8');
  return { goc, taskDir, taskKey };
}

const chay = (them: string[], goc?: string, taskKey = 'T-JUDGE') => spawnSync(process.execPath, [MAY, ...them], {
  cwd: REPO,
  encoding: 'utf8',
  env: goc ? gateEnv({ PROJECT_OUTPUT_DIR: goc, TASK_KEY: taskKey }) : gateEnv(),
});

test.describe.configure({ mode: 'default' });

test.describe('@infra judge — lấy mẫu TẤT ĐỊNH, không chọn tuỳ ý', () => {
  test('cùng task + cùng bộ ⇒ cùng mẫu; đổi bộ ⇒ đổi mẫu', () => {
    /*
     * Vì sao mẫu phải tất định: một mẫu chọn tuỳ ý thì người chấm chọn được case dễ, và tỉ lệ đạt sẽ nói
     * về cách chọn mẫu chứ không nói về bộ case. Tất định cũng là điều kiện để người khác KIỂM LẠI được
     * lời chấm — "chấm lại thấy khác" không được phép mơ hồ giữa "bộ đã đổi" và "mẫu đã đổi".
     */
    const a = Array.from({ length: 40 }, (_, i) => ({ tcId: `T_TC_${i}`, module: `M${i % 4}` }));
    const m1 = j.layMau(a, 8, 'T-X');
    const m2 = j.layMau(a, 8, 'T-X');
    expect(m1.chon.map((c: { tcId: string }) => c.tcId)).toEqual(m2.chon.map((c: { tcId: string }) => c.tcId));

    const m3 = j.layMau(a, 8, 'T-Y');
    expect(m3.hat, 'task khác phải ra hạt khác').not.toBe(m1.hat);

    const b = [...a, { tcId: 'T_TC_99', module: 'M0' }];
    const m4 = j.layMau(b, 8, 'T-X');
    expect(m4.hat, 'mẫu số đổi thì hạt phải đổi — nếu không, mẫu cũ sẽ được dùng cho một bộ khác').not.toBe(m1.hat);
  });

  test('phân tầng theo PHẦN TRƯỚC dấu `/` của cột Module', () => {
    /*
     * Đo thật trên CSDL-9001 (213 case): ô `Module` mang cả phần mô tả sau dấu gạch, nên cắt theo cả ô
     * cho 196 tầng trên 213 case — gần như mỗi case một tầng, và phân tầng mất hết tác dụng. Cắt trước
     * dấu `/` cho 5 tầng thật.
     */
    const ds = [
      ...Array.from({ length: 10 }, (_, i) => ({ tcId: `A_TC_${i}`, module: `Xem hồ sơ / chi tiết ${i}` })),
      ...Array.from({ length: 10 }, (_, i) => ({ tcId: `B_TC_${i}`, module: `Cập nhật hồ sơ / chi tiết ${i}` })),
    ];
    const m = j.layMau(ds, 4, 'T-Z');
    expect(m.so_tang, 'phải thấy 2 tầng, không phải 20').toBe(2);
    expect(m.tang_vo_nghia).toBe(false);
  });

  test('phân tầng MẤT TÁC DỤNG thì phải KHAI, không im lặng', () => {
    /*
     * Nếu số tầng xấp xỉ số case thì "mỗi tầng một case" chỉ là liệt kê, và câu "mẫu phân tầng theo
     * module" trong báo cáo sẽ nói về một thứ không xảy ra.
     */
    const ds = Array.from({ length: 20 }, (_, i) => ({ tcId: `C_TC_${i}`, module: `Module ${i}` }));
    const m = j.layMau(ds, 5, 'T-W');
    expect(m.tang_vo_nghia).toBe(true);

    const t = dungTask(boCase(20, (i) => `Module ${i}`));
    const r = chay(['--sample', '--n', '5'], t.goc);
    expect(`${r.stdout}${r.stderr}`).toContain('PHÂN TẦNG MẤT TÁC DỤNG');
  });

  test('0 case đọc được ⇒ CHƯA ĐƯỢC GÁC (exit 2), không phải "không có gì để chấm"', () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-rong-'));
    fs.mkdirSync(path.join(goc, 'tasks', 'T-JUDGE', 'test-cases'), { recursive: true });
    const r = chay(['--sample'], goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toContain('phép đo hỏng');
  });

  test('mẫu ghi lại MẪU SỐ và hạt giống — một tỉ lệ không có mẫu số là con số không nghĩa', () => {
    const t = dungTask(boCase(30, (i) => `M${i % 3}`));
    expect(chay(['--sample', '--n', '6'], t.goc).status).toBe(0);
    const mau = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'reports', 'judge-sample.json'), 'utf8'));
    expect(mau.mau_so).toBe(30);
    expect(mau.chon.length).toBe(6);
    expect(String(mau.hat).length).toBeGreaterThan(8);
  });
});

test.describe('@infra judge — hiệu chuẩn, và vì sao thiếu nó là CHƯA ĐƯỢC GÁC', () => {
  test('bộ hiệu chuẩn tự khai GIỚI HẠN của chính nó', () => {
    /*
     * Bộ chỉ gồm ca RÕ RÀNG, nên nó bắt được lệch thang THÔ (quá dễ dãi, quá khắt khe, đọc sai mục nào đo
     * cái gì) và KHÔNG nói gì về ca biên — mà ca biên mới là chỗ phán đoán thật sự khó. Một bộ hiệu chuẩn
     * không khai giới hạn đó sẽ được đọc như "người chấm này chấm đúng".
     */
    const cfg = JSON.parse(fs.readFileSync(j.CALIB, 'utf8'));
    expect(cfg._gioi_han_phai_doc).toContain('ca biên');
    expect(cfg.ca.length, 'quá ít ca thì một lỗi gõ hạ cả lượt').toBeGreaterThanOrEqual(15);
    for (const c of cfg.ca) {
      expect(['dat', 'khong_dat']).toContain(c.nhan);
      expect(String(c.vi_sao_nhan || '').length, `${c.id} có nhãn mà không nói vì sao`).toBeGreaterThan(20);
    }
  });

  test('TỰ CHẤM bị đánh dấu — người chấm trùng người viết nhãn thì tỉ lệ không đo gì', () => {
    /*
     * Chỗ này quyết định cả tầng có nghĩa hay không. Nếu cùng một thứ vừa chấm vừa tự xác nhận mình chấm
     * đúng thì không có phép đo nào xảy ra, chỉ có một con số đẹp.
     */
    const cfg = JSON.parse(fs.readFileSync(j.CALIB, 'utf8'));
    expect(cfg._nhan_do_ai_viet, 'phải khai AI viết nhãn, để so được với ai chấm').toBeTruthy();
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toContain('tu_cham');
    expect(src, 'không khai `cham_boi` thì không biết có phải tự chấm').toContain('cham_boi');
  });

  test('chấm THIẾU ca ⇒ CHẶN: chấm một phần rồi tính tỉ lệ là chọn mẫu sau khi thấy kết quả', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'calib-'));
    const f = path.join(d, 'thieu.json');
    fs.writeFileSync(f, JSON.stringify({ cham_boi: 'test', cham: [{ id: 'CAL-01', cham: 'khong_dat' }] }), 'utf8');
    const r = chay(['--calib-score', f]);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('chọn mẫu sau khi thấy kết quả');
  });

  test('không khai `cham_boi` ⇒ CHẶN', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'calib-'));
    const f = path.join(d, 'khong-ai.json');
    const cfg = JSON.parse(fs.readFileSync(j.CALIB, 'utf8'));
    fs.writeFileSync(f, JSON.stringify({ cham: cfg.ca.map((c: { id: string; nhan: string }) => ({ id: c.id, cham: c.nhan })) }), 'utf8');
    const r = chay(['--calib-score', f]);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('cham_boi');
  });

  test('mốc hiệu chuẩn HIỆN TẠI có thật, trên ngưỡng, và chấm MÙ', () => {
    /*
     * Mốc của v2.7.0 do một subagent chấm MÙ: nó được đưa thang chấm và 20 câu đầu vào, không đưa cột
     * nhãn. 20/20. Đó là lý do con số này dùng được, khác với một lượt tự chấm.
     */
    const r = chay(['--calib-status']);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    const moc = JSON.parse(fs.readFileSync(j.MOC_CALIB, 'utf8'));
    expect(moc.ti_le).toBeGreaterThanOrEqual(0.9);
    expect(moc.tu_cham, 'mốc đang dùng phải là mốc chấm mù').toBe(false);
    expect(String(moc.cham_boi)).toContain('mù');
  });
});

test.describe('@infra judge — ba luật không đổi được', () => {
  test('thang chấm khai, cho TỪNG mục, vì sao nó không có máy', () => {
    /*
     * Không có dòng đó thì tầng này thành chỗ chấm lại những thứ máy đã gác — và lúc ấy một lời chấm
     * "đạt" sẽ được dùng để phản bác một gate T0 đang đúng.
     */
    const r = JSON.parse(fs.readFileSync(j.RUBRIC, 'utf8'));
    expect(r.muc.length).toBeGreaterThanOrEqual(5);
    for (const m of r.muc) {
      expect(String(m.vi_sao_khong_co_may || '').length, `${m.id} không nói vì sao nó không có máy`).toBeGreaterThan(60);
      expect(String(m.bang_chung_phai_neu || '').length, `${m.id} không nói phải nêu bằng chứng gì`).toBeGreaterThan(20);
      expect(String(m.nguon_luat || ''), `${m.id} không neo vào luật nào`).toMatch(/RULE_GLOBAL|non-negotiable/);
    }
    expect(r._luat_khong_doi_duoc.join(' ')).toContain('KHÔNG được ghi đè');
  });

  test('lời chấm KHÔNG có neo ⇒ CHẶN', () => {
    const t = dungTask(boCase(6, () => 'M'));
    expect(chay(['--sample', '--n', '2'], t.goc).status).toBe(0);
    const mau = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'reports', 'judge-sample.json'), 'utf8'));
    const rubric = JSON.parse(fs.readFileSync(j.RUBRIC, 'utf8'));

    const cham = [];
    for (const id of mau.chon) {
      for (const m of rubric.muc) cham.push({ tcId: id, muc: m.id, cham: 'dat', bang_chung: 'thấy ổn' });
    }
    fs.writeFileSync(path.join(t.taskDir, 'reports', 'judge-verdicts.json'), JSON.stringify({ cham }), 'utf8');

    const r = chay(['--check'], t.goc);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('không có neo cụ thể');
  });

  test('lời chấm có neo ⇒ ĐẠT; và lời chấm đòi GHI ĐÈ verdict máy ⇒ CHẶN', () => {
    const t = dungTask(boCase(6, () => 'M'));
    expect(chay(['--sample', '--n', '2'], t.goc).status).toBe(0);
    const mau = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'reports', 'judge-verdicts.json').replace('verdicts', 'sample'), 'utf8'));
    const rubric = JSON.parse(fs.readFileSync(j.RUBRIC, 'utf8'));
    const f = path.join(t.taskDir, 'reports', 'judge-verdicts.json');

    const dungNeo = mau.chon.flatMap((id: string) => rubric.muc.map((m: { id: string }) => ({
      tcId: id, muc: m.id, cham: 'dat', bang_chung: `${id}: xem test-cases/tc.md dòng 5`,
    })));
    fs.writeFileSync(f, JSON.stringify({ cham: dungNeo }), 'utf8');
    const ok = chay(['--check'], t.goc);
    expect(ok.status, `${ok.stdout}${ok.stderr}`).toBe(0);
    expect(`${ok.stdout}`).toContain('đủ neo');

    /*
     * Cho tầng phán đoán quyền ghi đè là mở một đường "phán đoán thắng phép đo", và đường đó sẽ được
     * dùng đúng vào lúc máy đang đúng.
     */
    const doiGhiDe = [...dungNeo];
    doiGhiDe[0] = { ...doiGhiDe[0], ghi_de: true };
    fs.writeFileSync(f, JSON.stringify({ cham: doiGhiDe }), 'utf8');
    const r = chay(['--check'], t.goc);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('GHI ĐÈ');
  });

  test('chấm thiếu case trong mẫu ⇒ CHẶN, không cho chấm một nửa rồi báo tỉ lệ', () => {
    const t = dungTask(boCase(10, () => 'M'));
    expect(chay(['--sample', '--n', '4'], t.goc).status).toBe(0);
    const mau = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'reports', 'judge-sample.json'), 'utf8'));
    const rubric = JSON.parse(fs.readFileSync(j.RUBRIC, 'utf8'));
    const motNua = mau.chon.slice(0, 2).flatMap((id: string) => rubric.muc.map((m: { id: string }) => ({
      tcId: id, muc: m.id, cham: 'dat', bang_chung: `${id}: dòng 5`,
    })));
    fs.writeFileSync(path.join(t.taskDir, 'reports', 'judge-verdicts.json'), JSON.stringify({ cham: motNua }), 'utf8');
    const r = chay(['--check'], t.goc);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('chưa chấm');
  });

  test('OBSERVATION không kèm câu hỏi mở ⇒ cảnh báo (không chặn)', () => {
    /*
     * `OBSERVATION` là verdict hợp lệ khi chưa phán được — nhưng một quan sát không có câu hỏi thì không
     * ai theo tiếp được, và nó sẽ chết ở đó. Cảnh báo chứ không chặn: chặn sẽ đẩy người chấm sang `dat`
     * cho nhanh, tức làm mất đúng thứ cần giữ.
     */
    const t = dungTask(boCase(6, () => 'M'));
    expect(chay(['--sample', '--n', '2'], t.goc).status).toBe(0);
    const mau = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'reports', 'judge-sample.json'), 'utf8'));
    const rubric = JSON.parse(fs.readFileSync(j.RUBRIC, 'utf8'));
    const cham = mau.chon.flatMap((id: string) => rubric.muc.map((m: { id: string }, i: number) => ({
      tcId: id, muc: m.id, cham: i === 0 ? 'OBSERVATION' : 'dat', bang_chung: `${id}: dòng 5`,
    })));
    fs.writeFileSync(path.join(t.taskDir, 'reports', 'judge-verdicts.json'), JSON.stringify({ cham }), 'utf8');
    const r = chay(['--check'], t.goc);
    expect(r.status, 'OBSERVATION thiếu câu hỏi là CẢNH BÁO, không phải CHẶN').toBe(0);
    expect(`${r.stdout}${r.stderr}`).toContain('cau_hoi_mo');
  });
});
