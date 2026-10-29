/*
 * @infra `exec:tally` — số trong `execution-summary.md` phải TRUY được về một sổ verdict có tên.
 *
 * `automation_reviewer` khai "bản summary có kể đúng lượt chạy không" là chỗ **máy không phán được**.
 * Đo lại 29/10/2026 thì lý lẽ đó đúng một nửa, và nửa sai mới là chỗ làm được.
 *
 * ĐO TRƯỚC KHI DỰNG, và phép đo đổi hẳn thiết kế. Bốn `execution-summary.md` thật ghi số theo BỐN khuôn
 * khác nhau — một cái văn xuôi (`146/273 … ~28 FAIL`), ba cái bảng với tiêu đề khác nhau. Nên một cửa dò
 * "khuôn chuẩn" chỉ chạy được trên một phần tư. Thiết kế đúng là khuôn `phase1:tables`: máy SINH một
 * khối có mốc rồi gác chính khối đó, còn văn xuôi để tự do.
 *
 * VÀ SỐ LỆCH THẬT: CSDL-9004 summary ghi PASS 31 · BLOCKED 27 · FAIL 3, sổ verdict có PASSED 140 ·
 * BLOCKED_SETUP 62 · OBSERVATION 30 · FAILED 24. Nhưng lệch KHÔNG tự nghĩa là sai — sổ có thể là của
 * một lô. Chỗ hỏng thật là không gì nói con số đến từ đâu, nên không ai phân xử được.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/exec_summary_tally.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const et = require(GATE);

type Tc = { tcId: string; status: string };

/** Dựng task tạm: sổ verdict + (tuỳ chọn) execution-summary.md. */
function dungTask(tests: Tc[], vanXuoi?: string | null) {
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'etly-'));
  const t = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(t, 'test-results'), { recursive: true });
  fs.mkdirSync(path.join(t, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(t, 'test-results', 'testcase-status.json'),
    JSON.stringify({ taskKey: 'T-1', runId: 'r-001', tests }, null, 2), 'utf8');
  if (vanXuoi !== null) {
    fs.writeFileSync(path.join(t, 'reports', 'execution-summary.md'),
      vanXuoi ?? '# T-1 — Tổng kết\n\nMột đoạn kể không có số.\n', 'utf8');
  }
  return { pod, t, md: path.join(t, 'reports', 'execution-summary.md') };
}

const chay = (pod: string, argv: string[] = []) => {
  const r = spawnSync(process.execPath, [GATE, ...argv], {
    cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), TASK_KEY: 'T-1', PROJECT_OUTPUT_DIR: pod },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const BA = [
  { tcId: 'T_TC_001', status: 'PASSED' }, { tcId: 'T_TC_002', status: 'PASSED' },
  { tcId: 'T_TC_003', status: 'FAILED' }, { tcId: 'T_TC_004', status: 'BLOCKED_SETUP' },
];

test.describe('@infra exec:tally — khối số MÁY SINH', () => {
  test('sinh khối, và `--check` ngay sau đó phải ĐẠT', () => {
    const k = dungTask(BA);
    expect(chay(k.pod).code).toBe(0);
    const md = fs.readFileSync(k.md, 'utf8');
    expect(md).toContain(et.MOC_DAU);
    expect(md).toContain(et.MOC_CUOI);
    expect(md).toMatch(/\| `PASSED` \| 2 \|/);
    expect(md).toMatch(/\| \*\*TỔNG\*\* \| \*\*4\*\* \|/);
    expect(chay(k.pod, ['--check']).code, 'sinh rồi check phải khớp').toBe(0);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('khối ghi RÕ NGUỒN — tên sổ, mốc thời gian, runId', () => {
    /* Thiếu ba thứ này thì con số lại thành số không truy được, đúng cái bệnh máy này chữa. */
    const k = dungTask(BA);
    chay(k.pod);
    const md = fs.readFileSync(k.md, 'utf8');
    expect(md, 'phải ghi tên sổ').toContain('testcase-status.json');
    expect(md, 'phải ghi mốc thời gian').toMatch(/sửa lần cuối \d{4}-\d{2}-\d{2}/);
    expect(md, 'phải ghi runId').toMatch(/runId `r-001`/);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('khối TỰ NÓI nó KHÔNG phải mẫu số của cả bộ case', () => {
    /*
     * Một bảng verdict gọn rất dễ bị đọc thành độ phủ. Mẫu số thật neo ở `scope_inventory.md`, và
     * chênh giữa hai con số là chuyện phải giải thích bằng chữ — không phải chuyện sửa một bên cho khớp.
     */
    const k = dungTask(BA);
    chay(k.pod);
    const md = fs.readFileSync(k.md, 'utf8');
    expect(md).toMatch(/KHÔNG phải mẫu số của cả bộ case|không phải mẫu số của cả bộ case/);
    expect(md).toContain('scope_inventory.md');
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: chưa có khối ⇒ `--check` CHẶN', () => {
    const k = dungTask(BA);
    const r = chay(k.pod, ['--check']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/CHƯA có khối số/);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: SỬA TAY con số trong khối ⇒ `--check` CHẶN', () => {
    const k = dungTask(BA);
    chay(k.pod);
    fs.writeFileSync(k.md, fs.readFileSync(k.md, 'utf8').replace('| `PASSED` | 2 |', '| `PASSED` | 99 |'), 'utf8');
    const r = chay(k.pod, ['--check']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/LỆCH sổ verdict/);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: sổ ĐỔI mà khối ở lại ⇒ `--check` CHẶN', () => {
    /* Đường hỏng thứ hai của mọi bảng sinh: kẻ đúng rồi dữ liệu đổi mà bảng không đổi theo. */
    const k = dungTask(BA);
    chay(k.pod);
    const so = path.join(k.t, 'test-results', 'testcase-status.json');
    const j = JSON.parse(fs.readFileSync(so, 'utf8'));
    j.tests.push({ tcId: 'T_TC_005', status: 'PASSED' });
    fs.writeFileSync(so, JSON.stringify(j, null, 2), 'utf8');
    const r = chay(k.pod, ['--check']);
    expect(r.code, r.out).toBe(1);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": thiếu sổ ⇒ exit 2 · sổ 0 case ⇒ exit 2', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'etly0-'));
    fs.mkdirSync(path.join(d, 'tasks', 'T-1', 'test-results'), { recursive: true });
    const r1 = chay(d);
    expect(r1.code, r1.out).toBe(2);
    expect(r1.out).toContain('KHÔNG PHÁN ĐƯỢC');

    const k = dungTask([]);
    const r2 = chay(k.pod);
    expect(r2.code, r2.out).toBe(2);
    expect(r2.out).toMatch(/0 case/);
    fs.rmSync(d, { recursive: true, force: true });
    fs.rmSync(k.pod, { recursive: true, force: true });
  });
});

test.describe('@infra exec:tally — đối chiếu VĂN XUÔI chỉ cảnh báo', () => {
  /** Sổ giả tối thiểu để gọi `doiChieuVanXuoi` trực tiếp, không cần dựng cả task. */
  const soGia = { dem: new Map([['PASSED', 2], ['FAILED', 1]]), tong: 3 };

  test('văn xuôi LỆCH sổ ⇒ cảnh báo, nhưng KHÔNG chặn', () => {
    const k = dungTask(BA, '# T-1\n\nĐã chấm 9 PASS và 5 FAIL.\n');
    const r = chay(k.pod);
    expect(r.code, 'đây là máy cảnh báo ở phần văn xuôi, không chặn').toBe(0);
    expect(r.out).toMatch(/văn xuôi ghi 9 PASS, sổ verdict có 2/);
    expect(r.out).toMatch(/văn xuôi ghi 5 FAIL, sổ verdict có 1/);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: văn xuôi KHỚP sổ ⇒ im lặng', () => {
    const k = dungTask(BA, '# T-1\n\nĐã chấm 2 PASS và 1 FAIL.\n');
    const r = chay(k.pod);
    expect(r.out, 'khớp thì không được kêu').not.toMatch(/văn xuôi ghi/);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('số khai XẤP XỈ `~N` được TÔN TRỌNG, không bị kêu', () => {
    /*
     * Vu oan một lời khai xấp xỉ là dạy người ta bỏ dấu `~` đi cho hết cảnh báo — tức làm lời khai KÉM
     * trung thực hơn. `CSDL-4008` thật có đúng dạng này: "~28 FAIL product_bug".
     */
    const k = dungTask(BA, '# T-1\n\nKhoảng ~9 PASS, con số chính xác xem khối sinh.\n');
    const r = chay(k.pod);
    expect(r.out).not.toMatch(/văn xuôi ghi 9 PASS/);
    fs.rmSync(k.pod, { recursive: true, force: true });
  });

  test('MÃ TESTCASE không được đọc thành SỐ ĐẾM — hai lần siết, cả hai từ file thật', () => {
    /*
     * Bản đầu đọc `TC_199 PASS` thành "199 PASS": 6 cảnh báo trên 4 file thật, trong đó có mã TC. Siết
     * lần một chặn `[A-Za-z_]` đứng trước. Lần hai phải chặn thêm `/`, vì
     * `TC_184/185/206/215/217 PASS` là một DANH SÁCH mã và ký tự trước `217` là `/`.
     * Đo được: 6 → 5 → 4 cảnh báo, và 4 cái còn lại đã soi ngữ cảnh là THẬT.
     */
    for (const van of ['TC_199 PASS thật.', 'TC_184/185/206/215/217 PASS thật.', 'CSDL_HS_TC_088 PASS.']) {
      expect(et.doiChieuVanXuoi(van, soGia), `mã TC trong "${van}" KHÔNG được tính là số đếm`).toEqual([]);
    }
    /* ĐỐI CHỨNG ÂM của chính phép kiểm này: một số ĐỨNG RIÊNG thì vẫn phải bị bắt. */
    expect(et.doiChieuVanXuoi('Đã chấm 9 PASS.', soGia), 'siết quá tay thì luật mất răng')
      .toEqual(['văn xuôi ghi 9 PASS, sổ verdict có 2']);
  });

  test('gate TỰ NÓI giới hạn: nó KHÔNG chấm phần kể đúng hay không', () => {
    const src = fs.readFileSync(GATE, 'utf8');
    expect(src).toMatch(/KHÔNG chấm phần văn xuôi|không chấm văn xuôi/i);
    expect(src, 'phải nói rõ phần kể đúng vẫn là review tay').toMatch(/review tay/);
  });

  test('BỐN file thật: cảnh báo còn lại đều là báo cáo CŨ so với sổ, không phải nhiễu', () => {
    /*
     * Phép kiểm này neo vào số đo của đợt dựng. Nó xanh cả khi báo cáo đã được cập nhật — lúc đó số
     * cảnh báo giảm, và điều kiện duy nhất là KHÔNG tăng vọt (dấu hiệu mẫu lại đọc mã TC thành số).
     */
    let tong = 0;
    for (const t of ['CSDL-4008', 'CSDL-9002', 'CSDL-9003', 'CSDL-9004']) {
      const so = path.join(REPO, 'outputs/CSDL/tasks', t, 'test-results/testcase-status.json');
      const md = path.join(REPO, 'outputs/CSDL/tasks', t, 'reports/execution-summary.md');
      if (!fs.existsSync(so) || !fs.existsSync(md)) continue;
      tong += et.doiChieuVanXuoi(fs.readFileSync(md, 'utf8'), et.demSo(so)).length;
    }
    expect(tong, 'bật lên nhiều là dấu hiệu mẫu lại đọc mã TC thành số đếm').toBeLessThanOrEqual(6);
  });
});
