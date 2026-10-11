import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `expected:check` — CHẶN "đổi expected để case xanh" (non-negotiable §6, tầng T0).
 *
 * Kiểm kê gate ngày 11/10/2026 cho thấy §6 có ba vế và chỉ hai vế có máy. Vế "đổi expected để pass"
 * KHÔNG máy nào gác, trong khi nó là cách gian lận RẺ NHẤT trong cả kit: một ô, không cần sửa code, và
 * case đỏ thành xanh.
 *
 * `git diff` không dùng được vì testcase nằm trong `outputs/**` đã bị gitignore, nên máy CHỤP MỐC rồi
 * so — cùng khuôn `result_ledger`. Bộ test này khoá đường phát hiện đó, cộng bốn chỗ dễ thành đồ trang
 * trí: mốc rỗng, lý do rỗng nghĩa, mẫu số 0, và việc chụp lại mốc để che một thay đổi.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/expected_ledger.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const el = require(MAY);

test.describe.configure({ mode: 'default' });

const HEADER = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
const NGAN = '|---|---|---|---|---|---|---|---|---|---|';

function bo(cases: Array<{ id: string; expected: string }>): string {
  const dong = cases.map((c) => `| ${c.id} | Functional | [Positive] | Hồ sơ trường | Case ${c.id} | [ui] Đã đăng nhập | n/a | 1. Mở màn | ${c.expected} | Medium |`);
  return ['# Testcase', '', HEADER, NGAN, ...dong, ''].join('\n');
}

function dungTask(md: string) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'expled-'));
  const tcDir = path.join(goc, 'tasks', 'T-EXP', 'test-cases');
  fs.mkdirSync(tcDir, { recursive: true });
  fs.writeFileSync(path.join(tcDir, 'tc.md'), md, 'utf8');
  return { goc, tcDir, taskDir: path.join(goc, 'tasks', 'T-EXP') };
}

function chay(goc: string, them: string[] = []) {
  return spawnSync(process.execPath, [MAY, '--task', 'T-EXP', ...them], {
    cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-EXP' },
  });
}

function khaiLyDo(taskDir: string, dong: string[]) {
  const d = path.join(taskDir, 'reports');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'expected-changes.md'), ['# Thay đổi expected', '', ...dong, ''].join('\n'), 'utf8');
}

test.describe('@infra expected:check — bắt được thay đổi expected', () => {
  test('chụp mốc rồi ĐỔI expected mà không khai ⇒ CHẶN, nêu đích danh case', () => {
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện thông báo "Lưu thành công"' },
      { id: 'TC_002', expected: '1. Hiện 10 dòng' }]));
    expect(chay(t.goc, ['--snapshot']).status).toBe(0);

    /* Đổi expected của TC_001 cho "khớp" cái app đang trả về — đúng kịch bản §6 cấm. */
    fs.writeFileSync(path.join(t.tcDir, 'tc.md'), bo([
      { id: 'TC_001', expected: '1. Hiện thông báo bất kỳ' },
      { id: 'TC_002', expected: '1. Hiện 10 dòng' }]), 'utf8');

    const r = chay(t.goc);
    expect(r.status, 'T0 thì phải chặn').toBe(1);
    expect(`${r.stdout}`).toContain('TC_001');
    expect(`${r.stdout}`, 'case không đổi thì không được nêu').not.toContain('TC_002');
    expect(`${r.stdout}`).toContain('KHÔNG khai lý do');
  });

  test('khai lý do ĐỦ Ý ⇒ cho qua, và in lại lý do để người đọc thấy', () => {
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện thông báo "Lưu thành công"' }]));
    chay(t.goc, ['--snapshot']);
    fs.writeFileSync(path.join(t.tcDir, 'tc.md'), bo([{ id: 'TC_001', expected: '1. Hiện thông báo "Ghi thành công"' }]), 'utf8');
    khaiLyDo(t.taskDir, ['- TC_001: spec BR-HS-004 đổi nhãn nút từ Lưu sang Ghi, đã xác nhận với BA ngày 11/10']);
    const r = chay(t.goc);
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toContain('ĐÃ khai lý do');
    expect(`${r.stdout}`).toContain('đổi nhãn nút');
  });

  test('lý do RỖNG NGHĨA vẫn CHẶN — "sửa lại" không phải một lý do', () => {
    /*
     * Không có luật này thì gate thành thủ tục: dán một chữ vào file là qua. Ngưỡng 20 ký tự cộng danh
     * sách từ rỗng nghĩa là mức thấp nhất mà một câu còn mang thông tin người đọc sau không tự đoán ra.
     */
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện A' }]));
    chay(t.goc, ['--snapshot']);
    fs.writeFileSync(path.join(t.tcDir, 'tc.md'), bo([{ id: 'TC_001', expected: '1. Hiện B' }]), 'utf8');
    for (const ly of ['sửa lại', 'cập nhật', 'theo spec', 'fix']) {
      khaiLyDo(t.taskDir, [`- TC_001: ${ly}`]);
      const r = chay(t.goc);
      expect(r.status, `"${ly}" không được tính là lý do`).toBe(1);
      expect(`${r.stdout}`).toContain('RỖNG NGHĨA');
    }
  });

  test('case MỚI và case BIẾN MẤT được nêu riêng, không gộp vào "đổi expected"', () => {
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện A' }, { id: 'TC_002', expected: '1. Hiện B' }]));
    chay(t.goc, ['--snapshot']);
    fs.writeFileSync(path.join(t.tcDir, 'tc.md'), bo([
      { id: 'TC_001', expected: '1. Hiện A' }, { id: 'TC_003', expected: '1. Hiện C' }]), 'utf8');
    const r = chay(t.goc);
    expect(`${r.stdout}`).toContain('case MỚI');
    expect(`${r.stdout}`).toContain('TC_003');
    expect(`${r.stdout}`).toContain('BIẾN MẤT');
    expect(`${r.stdout}`).toContain('TC_002');
    expect(r.status, 'thêm và bớt case không phải gian lận — không chặn').toBe(0);
  });
});

test.describe('@infra expected:check — "chưa gác được" KHÔNG thành "đạt"', () => {
  test('chưa có mốc ⇒ nói rõ, và nói thẳng đây không phải là đạt', () => {
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện A' }]));
    const r = chay(t.goc);
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toContain('CHƯA CÓ MỐC');
    expect(`${r.stdout}`).toContain('KHÔNG phải là đạt');
    expect(`${r.stdout}`, 'không được in ĐẠT').not.toContain('✓ ĐẠT');
  });

  test('không đọc được case nào ⇒ CHƯA ĐƯỢC GÁC, không phải "không có gì đổi"', () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'expled-rong-'));
    fs.mkdirSync(path.join(goc, 'tasks', 'T-EXP', 'test-cases'), { recursive: true });
    const r = chay(goc);
    expect(`${r.stdout}`).toContain('CHƯA ĐƯỢC GÁC');
    expect(`${r.stdout}`).toContain('chưa có gì được đem ra so');
  });

  test('`--snapshot` nói rõ chụp sai thời điểm thì gate thành đồ trang trí', () => {
    /*
     * Đường né rõ nhất của gate này: sửa expected rồi chụp lại mốc. Máy không ngăn được chuyện đó — mốc
     * là file trong `outputs/`, người chạy có toàn quyền. Nên ít nhất nó phải NÓI RA, ở cả lúc chụp và
     * lúc báo lỗi.
     */
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện A' }]));
    chay(t.goc, ['--snapshot']);
    const moc = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'test-results', 'expected-ledger.json'), 'utf8'));
    expect(String(moc._chup_lai_khi_nao)).toContain('che một thay đổi chưa khai');
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src, 'thông điệp lúc chưa có mốc phải cảnh báo chuyện chụp muộn').toContain('mốc mang luôn bản đã sửa');
  });
});

test.describe('@infra expected:check — không tạo thêm bản sao PII', () => {
  test('file mốc chỉ lưu BĂM, không lưu nguyên văn expected', () => {
    /*
     * Expected của case QEMIS mang tên đơn vị, tên trường, có lúc cả tên người. CLAUDE.md §1 cấm tạo
     * file chứa dữ liệu cá nhân, và "file mốc nội bộ" không phải ngoại lệ.
     */
    const noiDung = 'Hiện thông báo cho Nguyễn Văn A tại trường THCS Đức Trí';
    const t = dungTask(bo([{ id: 'TC_001', expected: `1. ${noiDung}` }]));
    chay(t.goc, ['--snapshot']);
    const raw = fs.readFileSync(path.join(t.taskDir, 'test-results', 'expected-ledger.json'), 'utf8');
    expect(raw, 'nguyên văn expected KHÔNG được vào file mốc').not.toContain('Nguyễn Văn A');
    expect(raw).not.toContain('Đức Trí');
    const moc = JSON.parse(raw);
    expect(moc.expected.TC_001).toMatch(/^[0-9a-f]{16}$/);
  });

  test('băm bỏ qua khác biệt khoảng trắng và chuẩn hoá NFC', () => {
    expect(el.bam('Hiện  A')).toBe(el.bam('Hiện A'));
    expect(el.bam('ề')).toBe(el.bam('ề'));
    expect(el.bam('Hiện A')).not.toBe(el.bam('Hiện B'));
  });
});

test.describe('@infra expected:check — nối vào luật và tầng', () => {
  test('khai T0 §6 trong `gate_tiers.json`', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/gate_tiers.json'), 'utf8'));
    const g = cfg.T0['expected:check'];
    expect(g, '§6 vế "đổi expected" phải có gate T0').toBeTruthy();
    expect(g.non_negotiable).toBe(6);
  });

  test('§6 nay có HAI máy, và chỗ hở cũ được ghi là đã bịt', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/gate_tiers.json'), 'utf8'));
    const t0 = Object.entries(cfg.T0 as Record<string, { non_negotiable: number }>)
      .filter(([, v]) => v.non_negotiable === 6).map(([k]) => k);
    expect(t0).toContain('auto:review');
    expect(t0).toContain('expected:check');
    expect(JSON.stringify(cfg._non_negotiable_con_ho),
      'chỗ hở đã bịt thì phải ghi là đã bịt, không để lại một dòng nói nó còn hở').toContain('expected:check');
  });

  test('cả hai lệnh đều có nơi nhắc — không máy nào mồ côi', () => {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/policy_source_check.js')],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(`${r.stdout}${r.stderr}`).not.toContain('expected:check');
    expect(`${r.stdout}${r.stderr}`).not.toContain('expected:snapshot');
  });
});
