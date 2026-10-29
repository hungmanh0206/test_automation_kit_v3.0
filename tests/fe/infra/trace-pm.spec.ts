/*
 * @infra `trace:matrix --pm` — bản GỘP theo module (v2.9.5 §7).
 *
 * Vì sao cần một view riêng: ma trận per-TC của một task thật dài 275 dòng (đo trên CSDL-9004). Không ai
 * ở vai quản lý đọc 275 dòng, nên trong thực tế người ta đọc dòng `>` tóm tắt — mà dòng đó chỉ có TỔNG,
 * không nói module nào đang hổng. "80% đã execute" nghe như đều, trong khi 20% còn lại có thể dồn hết
 * vào một module. Bản gộp thật trên CSDL-9004 cho thấy đúng chuyện đó: hai module ở **0%**.
 *
 * PHÉP KIỂM QUAN TRỌNG NHẤT ở đây là `publish ?`. Cột publish có BA trạng thái, và `?` nghĩa là chưa
 * tải mirror Sheet về — tức CHƯA ĐO ĐƯỢC. Gộp `?` vào 0 làm bảng đọc như "chưa publish gì cả", một kết
 * luận khác hẳn. Đây đúng lớp lỗi "không phán được không được thành một con số".
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/traceability_matrix.js');

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  `|${'---|'.repeat(10)}`,
].join('\n');

const row = (id: string, mod: string) =>
  `| ${id} | Functional | [Positive] | ${mod} | ${id} | [api] Đã đăng nhập | x | 1. Mở màn | 1. Màn mở | Cao |`;

/** Dựng task tạm: bộ TC theo module + (tuỳ chọn) sổ verdict. */
function dungTask(cases: [string, string][], status?: [string, string][]) {
  const pod = fs.mkdtempSync(path.join(os.tmpdir(), 'tpm-'));
  const taskDir = path.join(pod, 'tasks', 'T-1');
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'test-cases', 'bo.md'),
    `# bộ\n\n${HEAD}\n${cases.map(([id, m]) => row(id, m)).join('\n')}\n`, 'utf8');
  if (status) {
    fs.mkdirSync(path.join(taskDir, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'test-results', 'testcase-status.json'),
      JSON.stringify({ taskKey: 'T-1', tests: status.map(([tcId, s]) => ({ tcId, status: s })) }, null, 2), 'utf8');
  }
  return { pod, taskDir };
}

function chay(pod: string, argv: string[] = []) {
  const r = spawnSync(process.execPath, [GATE, '--project-output', pod, '--task', 'T-1', ...argv], {
    cwd: REPO, encoding: 'utf8', env: gateEnv(),
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
const docPm = (taskDir: string) => fs.readFileSync(path.join(taskDir, 'reports', 'traceability-pm.md'), 'utf8');

test.describe('@infra trace:matrix --pm', () => {
  test('sinh LUÔN, không cần cờ — và cờ `--pm` cũ vẫn không làm vỡ lệnh', () => {
    /*
     * PHÉP KIỂM NÀY TỪNG ĐẶT NGƯỢC. Bản đầu đòi "không có `--pm` thì KHÔNG sinh", với lý lẽ "không ai
     * xin thì không sinh thêm artifact". Lý lẽ đó sai ở đây, và chỗ sai lộ ra khi đo xem ai gọi
     * `trace:matrix:pm`: **không luồng nào** — chỉ một skill nhắc tên nó. Tức nó là một bản sinh chỉ
     * tồn tại khi có người nhớ gõ thêm một cờ, đúng lớp "máy không ai gọi" mà kit vẫn chống.
     *
     * Và nó không phải artifact MỚI: nó gộp lại chính dữ liệu vừa ghi ra `traceability-matrix.md`, cùng
     * một lượt đọc, không thêm phép đo nào. Nên chi phí của "sinh luôn" gần bằng không, còn chi phí của
     * "opt-in" là nó không bao giờ được sinh.
     */
    const t = dungTask([['T_TC_001', 'Thêm mới']]);
    expect(chay(t.pod).code).toBe(0);
    expect(fs.existsSync(path.join(t.taskDir, 'reports', 'traceability-pm.md')),
      'bản gộp phải có mặt dù KHÔNG truyền cờ nào').toBe(true);

    /* Cờ cũ vẫn nhận để lệnh ai đã gõ không vỡ, nhưng nó không còn tác dụng gì. */
    const t2 = dungTask([['T_TC_001', 'Thêm mới']]);
    expect(chay(t2.pod, ['--pm']).code).toBe(0);
    expect(fs.existsSync(path.join(t2.taskDir, 'reports', 'traceability-pm.md'))).toBe(true);
    fs.rmSync(t.pod, { recursive: true, force: true });
    fs.rmSync(t2.pod, { recursive: true, force: true });
  });

  test('npm script `trace:matrix:pm` đã BỎ — một bí danh dư là cruft', () => {
    /* Sinh luôn thì một script riêng chỉ để bật cờ là thứ sẽ trôi khỏi tài liệu rồi thành tên chết. */
    // eslint-disable-next-line global-require
    const pkg = require(path.join(REPO, 'package.json'));
    expect(pkg.scripts['trace:matrix:pm'], 'bí danh này không còn lý do tồn tại').toBeUndefined();
    expect(pkg.scripts['trace:matrix'], '`trace:matrix` vẫn phải có').toBeTruthy();
  });

  test('gộp đúng theo module, và TỔNG khớp số dòng per-TC', () => {
    const t = dungTask(
      [['T_TC_001', 'Thêm mới'], ['T_TC_002', 'Thêm mới'], ['T_TC_003', 'Xoá']],
      [['T_TC_001', 'PASSED'], ['T_TC_002', 'FAILED']],
    );
    expect(chay(t.pod, ['--pm']).code).toBe(0);
    const md = docPm(t.taskDir);
    expect(md).toMatch(/\| Thêm mới \| 2 \|/);
    expect(md).toMatch(/\| Xoá \| 1 \|/);
    /* TỔNG phải là 3 TC · 2 execute · 1 FAIL — gộp không được làm trôi con số. */
    expect(md).toMatch(/\| \*\*TỔNG\*\* \| \*\*3\*\* \|.*\*\*2\*\* \| \*\*67%\*\* \| \*\*1\*\*/);
    fs.rmSync(t.pod, { recursive: true, force: true });
  });

  test('`publish ?` là cột RIÊNG — chưa đo được KHÔNG được gộp vào 0', () => {
    /* Không có mirror `from-sheet/` ⇒ publish = `?` cho mọi TC. Bảng phải nói ra, không làm tròn. */
    const t = dungTask([['T_TC_001', 'Thêm mới'], ['T_TC_002', 'Thêm mới']], [['T_TC_001', 'PASSED']]);
    expect(chay(t.pod, ['--pm']).code).toBe(0);
    const md = docPm(t.taskDir);
    expect(md, 'phải có cột publish ?').toContain('publish ?');
    expect(md, 'cả 2 TC đều chưa đo được publish').toMatch(/\| Thêm mới \| 2 \| 0 \| 2 \|/);
    expect(md, 'phải giải thích `?` KHÁC "chưa publish"').toMatch(/chưa đo được/);
    fs.rmSync(t.pod, { recursive: true, force: true });
  });

  test('chỗ hổng TO NHẤT lên dòng ĐẦU — không để nó nằm cuối bảng', () => {
    const t = dungTask(
      [['T_TC_001', 'Nhỏ'], ['T_TC_002', 'To'], ['T_TC_003', 'To'], ['T_TC_004', 'To']],
      [['T_TC_001', 'PASSED']],
    );
    expect(chay(t.pod, ['--pm']).code).toBe(0);
    const md = docPm(t.taskDir);
    const iTo = md.indexOf('| To |');
    const iNho = md.indexOf('| Nhỏ |');
    expect(iTo, 'module hổng 3/3 phải đứng trước module hổng 0/1').toBeLessThan(iNho);
    fs.rmSync(t.pod, { recursive: true, force: true });
  });

  test('mục "Chỗ hổng, nói thẳng" liệt kê module còn TC chưa execute', () => {
    const t = dungTask([['T_TC_001', 'Thêm mới'], ['T_TC_002', 'Xoá']], [['T_TC_001', 'PASSED']]);
    expect(chay(t.pod, ['--pm']).code).toBe(0);
    const md = docPm(t.taskDir);
    expect(md).toContain('Chỗ hổng, nói thẳng');
    expect(md).toMatch(/\*\*Xoá\*\*: còn 1\/1 TC chưa execute/);
    fs.rmSync(t.pod, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: execute đủ thì nói rõ là đủ, không bỏ trống mục', () => {
    const t = dungTask([['T_TC_001', 'Thêm mới']], [['T_TC_001', 'PASSED']]);
    expect(chay(t.pod, ['--pm']).code).toBe(0);
    expect(docPm(t.taskDir)).toMatch(/Mọi module đã execute đủ/);
    fs.rmSync(t.pod, { recursive: true, force: true });
  });

  test('bản gộp TỰ NÓI mẫu số của nó là số TC ĐÃ VIẾT', () => {
    /*
     * Thiếu câu này thì `100% execute` bị đọc thành "đã phủ hết" — đúng lớp "mẫu số tự khai" mà
     * `scope_anchor` nói tới. Bảng gộp càng gọn thì càng dễ bị đọc như một kết luận.
     */
    const t = dungTask([['T_TC_001', 'Thêm mới']], [['T_TC_001', 'PASSED']]);
    chay(t.pod, ['--pm']);
    const md = docPm(t.taskDir);
    expect(md).toMatch(/số TC ĐÃ VIẾT, không phải số thứ cần kiểm/);
    expect(md, 'phải trỏ chỗ neo mẫu số thật').toMatch(/scope_inventory\.md|scope:anchor/);
    expect(md, 'phải trỏ chiều ngược').toMatch(/spec:gap/);
    fs.rmSync(t.pod, { recursive: true, force: true });
  });

  test('module không khai ⇒ gộp vào một dòng CÓ TÊN, không im lặng rơi ra ngoài', () => {
    const t = dungTask([['T_TC_001', '']], [['T_TC_001', 'PASSED']]);
    expect(chay(t.pod, ['--pm']).code).toBe(0);
    expect(docPm(t.taskDir)).toContain('(không khai module)');
    fs.rmSync(t.pod, { recursive: true, force: true });
  });
});
