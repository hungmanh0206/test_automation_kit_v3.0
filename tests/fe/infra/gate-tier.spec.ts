import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `gate_tier` (v2.7.0 §A1) — QUYẾT ĐỊNH CHẶN HAY CẢNH BÁO theo tầng và ngữ cảnh gọi.
 *
 * Đây là nền của cả đợt giảm ma sát, nên mỗi ô của bảng quyết định phải có test: một ô sai nghĩa là
 * hoặc một máy không-thương-lượng thôi chặn, hoặc một gate chất lượng chặn giữa lúc đang làm.
 *
 * Luật: T0 chặn ở MỌI ngữ cảnh · T1 chặn ở `exit` và `ci`, còn `write`/`phase` thì cảnh báo cộng GHI
 * SỔ NỢ · T2 không bao giờ chặn.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const gt = require(path.join(REPO, 'scripts/qa/lib/gate_tier.js'));

test.describe.configure({ mode: 'default' });

test.describe('@infra gate_tier — bảng quyết định, từng ô', () => {
  test('T0 chặn ở CẢ BỐN ngữ cảnh — không có ngoại lệ nào', () => {
    for (const nc of Object.keys(gt.NGU_CANH)) {
      const q = gt.quyetDinh('T0', nc);
      expect(q.chan, `T0 phải chặn ở ngữ cảnh ${nc}`).toBe(true);
      expect(q.ghiSoNo, 'T0 chặn luôn nên không có nợ để ghi').toBe(false);
    }
  });

  test('T1: `write` và `phase` KHÔNG chặn nhưng GHI SỔ; `exit` và `ci` thì chặn', () => {
    for (const nc of ['write', 'phase']) {
      const q = gt.quyetDinh('T1', nc);
      expect(q.chan, `T1 không được chặn giữa lúc đang làm (${nc})`).toBe(false);
      expect(q.ghiSoNo, 'nhưng phải ghi sổ — cảnh báo mà không ghi thì bằng bỏ qua').toBe(true);
    }
    for (const nc of ['exit', 'ci']) {
      const q = gt.quyetDinh('T1', nc);
      expect(q.chan, `T1 phải chặn ở cửa ra (${nc})`).toBe(true);
      expect(q.ghiSoNo).toBe(false);
    }
  });

  test('T2 không bao giờ chặn, và cũng không ghi nợ', () => {
    for (const nc of Object.keys(gt.NGU_CANH)) {
      const q = gt.quyetDinh('T2', nc);
      expect(q.chan).toBe(false);
      expect(q.ghiSoNo).toBe(false);
    }
  });

  test('"không chặn" của T1 KHÁC "không chặn" của T2 — không gộp thành một boolean', () => {
    /*
     * T1 ở `phase` là HOÃN TỚI CỬA RA và ghi sổ. T2 là KHÔNG BAO GIỜ. Gộp hai thứ đó thành một
     * `chan: false` là bỏ mất đúng phần quan trọng, nên hàm trả về cả `ghiSoNo` và `vi_sao`.
     */
    const t1 = gt.quyetDinh('T1', 'phase');
    const t2 = gt.quyetDinh('T2', 'phase');
    expect(t1.chan).toBe(t2.chan);
    expect(t1.ghiSoNo).not.toBe(t2.ghiSoNo);
    expect(t1.vi_sao).not.toBe(t2.vi_sao);
  });

  test('ngữ cảnh lạ thì NÉM, không im lặng chọn một mặc định', () => {
    expect(() => gt.quyetDinh('T1', 'luc-nao-cung-duoc')).toThrow(/ngữ cảnh lạ/);
    expect(() => gt.quyetDinh('T1', '')).toThrow();
  });
});

test.describe('@infra gate_tier — tầng lấy từ config, mặc định T1', () => {
  test('gate khai T0 ra T0, kèm non-negotiable và lý do', () => {
    const t = gt.tangCua('secret:scan');
    expect(t.tang).toBe('T0');
    expect(t.nguon).toContain('khai tay');
    expect(t.non_negotiable).toBe(1);
    expect(String(t.vi_sao).length).toBeGreaterThan(30);
  });

  test('gate KHÔNG khai T0 thì mặc định T1 — phía an toàn hơn T2', () => {
    const t = gt.tangCua('dim:coverage');
    expect(t.tang).toBe('T1');
    expect(t.nguon).toContain('mặc định');
  });

  test('gate không phát hiện vi phạm (SINH/BÁO CÁO) ra T2, và suy TỪ CODE', () => {
    const t = gt.tangCua('bat-ky-may-nao', { laBaoCao: true });
    expect(t.tang).toBe('T2');
    expect(t.nguon, 'thông tin này đến từ mức trong code, không từ bảng khai tay').toContain('suy từ code');
  });

  test('hai chế độ của `output_gate` nằm ở HAI tầng khác nhau', () => {
    /*
     * `test-execution` gác evidence (§4) nên T0 — ghi một verdict không có evidence là tạo ra kết luận
     * không ai kiểm được. `gen-testcase` gác chất lượng dòng case nên T1 — bộ đang viết dở thì thiếu
     * sót là bình thường, chỗ chặn là cửa publish.
     */
    expect(gt.tangCua('gate:output').tang).toBe('T0');
    expect(gt.tangCua('gate:gen-testcase').tang).toBe('T1');
  });

  test('THIẾU `gate_tiers.json` thì NÉM, không im lặng rơi về một mặc định', () => {
    /*
     * Mặc định nào cũng sai theo một hướng tệ: T2 là tắt sạch 70 máy chặn, T1 là hạ 13 máy
     * không-thương-lượng xuống "chỉ chặn ở cửa ra". Cả hai đều là thay đổi lớn mà không ai khai.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/lib/gate_tier.js'), 'utf8');
    expect(src).toMatch(/THIẾU \.agent\/config\/gate_tiers\.json/);
    expect(src, 'và phải chỉ đường sinh lại').toContain('gate:audit -- --write-tiers');
  });

  test('bảng ở trạng thái "đã duyệt" thì KHÔNG cảnh báo', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/gate_tiers.json'), 'utf8'));
    expect(String(cfg._trang_thai)).toMatch(/đã duyệt/i);
    expect(gt.tangCua('secret:scan').canh_bao).toBeFalsy();
  });
});

test.describe('@infra gate_tier — sổ nợ: "chưa chặn" KHÔNG thành "đã bỏ"', () => {
  function taskTam() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'debt-'));
    fs.mkdirSync(path.join(d, 'reports'), { recursive: true });
    return d;
  }

  test('T1 ở `phase` ⇒ exit 0, nhưng vi phạm có trong sổ nợ', () => {
    const d = taskTam();
    const log: string[] = [];
    const r = gt.apTang('dim:coverage', [{ ma: 'DIM_15', tcId: 'TC_001', thong_diep: 'thiếu chiều Security' }],
      { nguCanh: 'phase', taskOutputDir: d, log: (s: string) => log.push(s) });
    expect(r.exitCode, 'không chặn giữa lúc đang làm').toBe(0);
    expect(r.ghi_so_no).toBe(true);
    const so = gt.docSoNo(d);
    expect(so.mon).toHaveLength(1);
    expect(so.mon[0].gate).toBe('dim:coverage');
    expect(so.mon[0].tcId).toBe('TC_001');
    expect(log.join('\n'), 'phải nói rõ cửa ra sẽ chặn').toContain('Cửa ra sẽ chặn');
  });

  test('CÙNG vi phạm đó ở `exit` ⇒ exit 1', () => {
    const d = taskTam();
    const r = gt.apTang('dim:coverage', [{ ma: 'DIM_15', tcId: 'TC_001', thong_diep: 'thiếu chiều Security' }],
      { nguCanh: 'exit', taskOutputDir: d, log: () => {} });
    expect(r.exitCode).toBe(1);
    expect(r.chan).toBe(true);
  });

  test('T0 ⇒ exit 1 ở cả `write`, và KHÔNG ghi sổ (vì đã chặn)', () => {
    const d = taskTam();
    const r = gt.apTang('secret:scan', [{ ma: 'SECRET', thong_diep: 'token trong file' }],
      { nguCanh: 'write', taskOutputDir: d, log: () => {} });
    expect(r.exitCode).toBe(1);
    expect(r.ghi_so_no).toBe(false);
    expect(gt.docSoNo(d), 'không có nợ nên không có sổ').toBeNull();
  });

  test('sổ nợ GHI THÊM, không ghi đè — gate sau không xoá nợ của gate trước', () => {
    /*
     * Một lượt chạy một gate không biết các gate khác đã ghi gì. Ghi đè là cách chắc chắn nhất để vi
     * phạm của gate chạy trước biến mất khi gate sau chạy.
     */
    const d = taskTam();
    gt.ghiSoNo(d, 'gate-a', [{ ma: 'A1', thong_diep: 'x' }]);
    gt.ghiSoNo(d, 'gate-b', [{ ma: 'B1', thong_diep: 'y' }]);
    const so = gt.docSoNo(d);
    expect(so.mon.map((m: { gate: string }) => m.gate).sort()).toEqual(['gate-a', 'gate-b']);
  });

  test('cùng khoá thì ĐẾM LẠI, không thêm dòng — sổ không phình theo số lượt chạy', () => {
    const d = taskTam();
    for (let i = 0; i < 5; i += 1) gt.ghiSoNo(d, 'gate-a', [{ ma: 'A1', tcId: 'TC_9', thong_diep: 'x' }]);
    const so = gt.docSoNo(d);
    expect(so.mon).toHaveLength(1);
    expect(so.mon[0].so_lan, 'số lượt vẫn giữ — nó nói gate đang gây ma sát bao nhiêu').toBe(5);
    expect(so.mon[0].lan_dau).toBeTruthy();
    expect(so.mon[0].lan_cuoi).toBeTruthy();
  });

  test('THIẾU sổ KHÁC sổ RỖNG — trả null, không trả mảng rỗng', () => {
    /* Gộp hai thứ đó là cách để "chưa ai ghi gì" bị đọc thành "không còn nợ nào". */
    const d = taskTam();
    expect(gt.docSoNo(d)).toBeNull();
    gt.ghiSoNo(d, 'g', [{ ma: 'X', thong_diep: 'x' }]);
    expect(gt.docSoNo(d).mon).toHaveLength(1);
  });

  test('sổ ghi rõ KHI NÀO được xoá — xoá sổ để qua cửa ra là đúng thứ nó gác', () => {
    const d = taskTam();
    gt.ghiSoNo(d, 'g', [{ ma: 'X', thong_diep: 'x' }]);
    const so = gt.docSoNo(d);
    expect(String(so._xoa_khi_nao)).toContain('đã SỬA');
    expect(String(so._xoa_khi_nao)).toContain('Xóa sổ để qua cửa ra'.replace('Xóa', 'Xoá'));
  });

  test('T1 mà KHÔNG có chỗ ghi sổ ⇒ phải NÓI RA là mất dấu vết', () => {
    /*
     * Không có `taskOutputDir` thì vi phạm không vào sổ, nên cửa ra sẽ không thấy nó. Im lặng ở đây
     * nghĩa là "đã cảnh báo" đúng nghĩa "đã bỏ".
     */
    const log: string[] = [];
    const r = gt.apTang('dim:coverage', [{ ma: 'D', thong_diep: 'x' }],
      { nguCanh: 'phase', taskOutputDir: null, log: (s: string) => log.push(s) });
    expect(r.exitCode).toBe(0);
    expect(r.mat_dau_vet).toBe(true);
    expect(log.join('\n')).toContain('KHÔNG ghi được sổ nợ');
    expect(log.join('\n')).toContain('cửa ra sẽ không thấy');
  });

  test('`apTang` KHÔNG tự `process.exit` — gate gọi nó còn phải in phần của mình', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/lib/gate_tier.js'), 'utf8');
    const trongApTang = src.slice(src.indexOf('function apTang'));
    expect(trongApTang, 'thư viện tự exit là cắt ngang luồng in của mọi thứ gọi nó').not.toMatch(/process\.exit\(/);
  });
});

test.describe('@infra gate_on_write — hook CHỈ chặn T0', () => {
  function chayHook(filePath: string) {
    return spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/hooks/gate_on_write.js')], {
      cwd: REPO, encoding: 'utf8', env: gateEnv(),
      input: JSON.stringify({ tool_input: { file_path: filePath } }),
    });
  }

  test('file không liên quan ⇒ im lặng, exit 0', () => {
    const r = chayHook(path.join(REPO, 'README.md'));
    expect(r.status).toBe(0);
    expect(`${r.stdout}`.trim()).toBe('');
  });

  test('hook phân tầng theo CHẾ ĐỘ, và mã nói rõ vì sao', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/hooks/gate_on_write.js'), 'utf8');
    expect(src).toContain("gateId = 'gate:output'");
    expect(src).toContain("gateId = 'gate:gen-testcase'");
    expect(src, 'phải giải thích vì sao chặn giữa lúc đang làm là cách làm gate bị tắt').toMatch(/tìm cách tắt hook/);
  });

  test('bảng tầng hỏng ⇒ hook CHẶN, không cho qua', () => {
    /*
     * Đây là chỗ duy nhất trong lớp tầng chọn phía "chặn" khi không đọc được config: hook là lớp cuối
     * trước khi một artifact sai nằm trên đĩa, và cho qua vì "không đọc được bảng" là biến một lỗi cấu
     * hình thành một lỗ gác.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/hooks/gate_on_write.js'), 'utf8');
    expect(src).toMatch(/tang = 'T0'/);
    expect(src).toContain('biến một lỗi cấu hình thành một lỗ gác');
  });

  test('thư mục task suy TỪ ĐƯỜNG DẪN FILE, không từ env', () => {
    /*
     * Hook chạy trong tiến trình do harness gọi, nên `TASK_KEY` có thể không có ở đó. Suy từ đường dẫn
     * thì sổ nợ luôn vào ĐÚNG task của file vừa ghi, kể cả khi env trỏ task khác.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/hooks/gate_on_write.js'), 'utf8');
    expect(src).toMatch(/function thuMucTask/);
    expect(src).toContain('không từ env');
  });
});

test.describe('@infra GATES.md — có cột Tầng', () => {
  test('bảng gate mang cột Tầng, và giải thích ba tầng ngay đầu trang', () => {
    const md = fs.readFileSync(path.join(REPO, '.agent/config/GATES.md'), 'utf8');
    expect(md).toContain('| Tầng | Mức | npm script |');
    expect(md).toContain('**T0** chặn ở mọi ngữ cảnh');
    expect(md).toContain('reports/gate-debt.json');
  });

  test('mọi máy T0 trong config đều hiện T0 trên bảng', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/gate_tiers.json'), 'utf8'));
    const md = fs.readFileSync(path.join(REPO, '.agent/config/GATES.md'), 'utf8');
    const dongT0 = md.split(/\r?\n/).filter((l) => l.startsWith('| T0 |'));
    for (const g of Object.keys(cfg.T0)) {
      expect(dongT0.some((l) => l.includes(`\`${g}\``)), `${g} khai T0 mà bảng không ghi T0`).toBe(true);
    }
  });
});
