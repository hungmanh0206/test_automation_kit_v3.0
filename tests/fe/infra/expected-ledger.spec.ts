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

test.describe('@infra expected:check — cờ `--task` phải THẮNG env', () => {
  /*
   * LỖ NÀY DO `gate:selfmutate` TÌM RA (§A10.6). Nó nới `i >= 0` trong hàm đọc cờ `val()` lên một ngưỡng
   * không bao giờ chạm tới — tức MỌI cờ dòng lệnh bị bỏ qua — và cả bộ spec vẫn XANH.
   *
   * Nguyên nhân: mọi test ở đây truyền CẢ cờ `--task` LẪN env `TASK_KEY` cùng một giá trị, nên env gánh
   * thay khi cờ chết. Hợp đồng thật là cờ THẮNG env (`val('task', process.env.TASK_KEY)`), và nó chưa
   * từng được đo. Chuyện này có hệ quả thật: một shell còn `TASK_KEY` của task cũ thì `--task` của lượt
   * mới bị bỏ qua, và gate đi gác task SAI mà không ai báo.
   */
  test('env trỏ task KHÔNG tồn tại, cờ trỏ task thật ⇒ gate gác theo CỜ', () => {
    const t = dungTask(bo([{ id: 'CSDL_HSTRUONG_TC_001', expected: '1. Màn mở được' }]));
    const r = spawnSync(process.execPath, [MAY, '--task', 'T-EXP', '--snapshot'], {
      cwd: REPO, encoding: 'utf8',
      env: { ...gateEnv(), PROJECT_OUTPUT_DIR: t.goc, TASK_KEY: 'T-KHONG-CO-THAT' },
    });
    const ra = `${r.stdout}${r.stderr}`;
    expect(ra, 'cờ `--task` bị bỏ qua thì gate rơi về env và đi gác task không tồn tại')
      .not.toContain('T-KHONG-CO-THAT');
    expect(fs.existsSync(path.join(t.taskDir, 'test-results', 'expected-ledger.json')),
      'chụp được mốc nghĩa là gate đã đọc đúng task từ cờ').toBe(true);
  });
});

test.describe('@infra expected:check — "chưa gác được" KHÔNG thành "đạt"', () => {
  test('chưa có mốc ⇒ exit 2 ("không phán được"), KHÔNG phải exit 0', () => {
    /*
     * CỬA RA (§A2) phơi ra chỗ này ngay lượt chạy thật đầu tiên: bản đầu exit 0, nên bảng của
     * `exit:gate` in dấu ✓ cho máy này — ngay dưới dòng chính nó vừa nói "đây KHÔNG phải là đạt".
     * Một máy nói đúng bằng chữ mà trả sai bằng mã thì mọi thứ ĐỌC MÃ sẽ hiểu ngược, và cửa ra là thứ
     * đọc mã. Exit 2 là convention đã có của kit cho "không phán được".
     */
    const t = dungTask(bo([{ id: 'TC_001', expected: '1. Hiện A' }]));
    const r = chay(t.goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}`).toContain('CHƯA CÓ MỐC');
    expect(`${r.stdout}`).toContain('KHÔNG phải là đạt');
    expect(`${r.stdout}`, 'không được in ĐẠT').not.toContain('✓ ĐẠT');
  });

  test('không đọc được case nào ⇒ CHƯA ĐƯỢC GÁC, không phải "không có gì đổi"', () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'expled-rong-'));
    fs.mkdirSync(path.join(goc, 'tasks', 'T-EXP', 'test-cases'), { recursive: true });
    const r = chay(goc);
    expect(r.status, 'mẫu số 0 là không phán được, không phải đạt').toBe(2);
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

/*
 * `--giua-task` — mốc chụp GIỮA task phải TỰ KHAI điều đó (v2.9.6).
 *
 * VÌ SAO THÊM. Mốc chỉ đáng tin khi chụp lúc bộ case được CHỐT; chụp giữa task thì nó mang luôn mọi thay
 * đổi đã xảy ra trước đó, nên KHÔNG chứng minh được expected hiện tại là bản gốc. Nhưng đo 30/10/2026:
 * 5/6 task KHÔNG có mốc nào, tức cửa ở trạng thái `CHƯA ĐƯỢC GÁC` **vĩnh viễn** — và không có dấu hiệu
 * máy nào cho biết bộ case đã chốt (0 mirror `from-sheet` trên cả 6 task).
 *
 * Chụp giữa task tốt hơn không chụp, nhưng CHỈ KHI không ai đọc nó thành "chưa từng có expected nào bị
 * sửa". Nên cờ này đòi lý do, ghi vào chính mốc, và in lại cảnh báo ở MỌI lượt so về sau.
 */
test.describe('@infra expected:check — mốc chụp giữa task phải tự khai', () => {
  test('ĐỐI CHỨNG DƯƠNG: `--giua-task` KHÔNG kèm lý do ⇒ exit 2', () => {
    /* Không có phép kiểm này thì cờ thành đường thoát: chụp giữa task mà chẳng ai phải nói vì sao. */
    const t = dungTask(bo([{ id: 'T_001', expected: 'Lưu thành công' }]));
    const r = chay(t.goc, ['--snapshot', '--giua-task']);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/`--giua-task` PHẢI kèm lý do/);
    fs.rmSync(t.goc, { recursive: true, force: true });
  });

  test('có lý do ⇒ ghi vào mốc, và CẢNH BÁO in lại ở lượt SO về sau', () => {
    /*
     * "In lại ở lượt sau" là vế quan trọng nhất. Một cảnh báo chỉ hiện lúc chụp thì người đọc báo cáo ba
     * tuần sau không bao giờ thấy — và lúc đó mốc lại được đọc như mốc chốt.
     */
    const t = dungTask(bo([{ id: 'T_001', expected: 'Lưu thành công' }]));
    const LY_DO = 'chụp giữa task vì trước đó cửa ở trạng thái CHƯA ĐƯỢC GÁC vĩnh viễn';
    const c = chay(t.goc, ['--snapshot', '--giua-task', LY_DO]);
    expect(c.status, `${c.stdout}${c.stderr}`).toBe(0);
    expect(`${c.stdout}`).toMatch(/MỐC CHỤP GIỮA TASK/);

    const moc = JSON.parse(fs.readFileSync(
      path.join(t.taskDir, 'test-results', 'expected-ledger.json'), 'utf8',
    ));
    expect(moc.chup_giua_task, 'mốc phải mang cờ').toBeTruthy();
    expect(moc.chup_giua_task.ly_do).toBe(LY_DO);
    expect(String(moc.chup_giua_task._nghia), 'mốc phải tự giải thích nó tin được tới đâu')
      .toMatch(/KHÔNG chứng minh/);

    /* Lượt SO (không có cờ) vẫn phải in cảnh báo. */
    const s = chay(t.goc);
    const out = `${s.stdout}${s.stderr}`;
    expect(out).toMatch(/MỐC NÀY CHỤP GIỮA TASK, không ở cửa chốt/);
    expect(out, 'phải in lại đúng lý do đã ghi').toContain(LY_DO.slice(0, 40));
    expect(out, 'và vẫn phải so được').toMatch(/✓ ĐẠT|đổi `Kết quả mong đợi`/);
    fs.rmSync(t.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: mốc chụp BÌNH THƯỜNG ⇒ KHÔNG in cảnh báo đó', () => {
    /* Nếu cảnh báo in cả khi mốc chụp đúng lúc thì nó thành tiếng ồn, và tiếng ồn làm người đọc bỏ qua. */
    const t = dungTask(bo([{ id: 'T_001', expected: 'Lưu thành công' }]));
    chay(t.goc, ['--snapshot']);
    const out = `${chay(t.goc).stdout}`;
    expect(out).not.toMatch(/CHỤP GIỮA TASK/);
    fs.rmSync(t.goc, { recursive: true, force: true });
  });

  test('mốc chụp giữa task VẪN gác được thay đổi SAU đó', () => {
    /*
     * Điểm của cả việc này: mốc giữa task gác TỪ ĐÓ TRỞ ĐI. Nếu nó không chặn nổi một thay đổi sau khi
     * chụp thì nó đúng là đồ trang trí, và lúc ấy thà đừng chụp.
     */
    const t = dungTask(bo([{ id: 'T_001', expected: 'Lưu thành công' }]));
    chay(t.goc, ['--snapshot', '--giua-task', 'lý do đủ dài để hợp lệ cho phép kiểm này']);
    fs.writeFileSync(path.join(t.tcDir, 'tc.md'),
      bo([{ id: 'T_001', expected: 'Chặn lưu vì sai định dạng' }]), 'utf8');
    const r = chay(t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('T_001');
    fs.rmSync(t.goc, { recursive: true, force: true });
  });
});
