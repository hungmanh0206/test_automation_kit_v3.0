import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * SỔ MA SÁT và QUY TẮC DỌN (v2.7.0 §A9).
 *
 * §1 kết luận bốn thứ "chưa đo được", ba trong bốn cùng một gốc: không nguồn nào ghi "gate X đã chặn N
 * lần". §A9 mở sổ cho chuyện đó. Nhưng sổ RỖNG ở lượt đầu, nên phần quan trọng nhất của bộ test này là:
 * sổ rỗng phải nói "CHƯA ĐO", không được nói "không có ma sát".
 *
 * Và quy tắc nguy hiểm nhất là quy tắc KHÔNG được áp: "gate chưa từng đỏ" KHÔNG phải căn cứ để bỏ gate.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/gate_friction.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const fric = require(MAY);

test.describe.configure({ mode: 'default' });

const LY_DO = 'Gate đếm cả case Manual-only vào mẫu số chiều security nên báo thiếu trong khi bộ đã đủ';

/** Sự kiện giả, không ghi đĩa — `gopTheoGate` và `quyTacDon` là hàm thuần. */
const sk = (gate: string, su_kien: string, n: number, extra: Record<string, unknown> = {}) =>
  Array.from({ length: n }, () => ({ gate, su_kien, tang: 'T1', ...extra }));

test.describe('@infra gate:friction — sổ rỗng nói "CHƯA ĐO", không nói "không có"', () => {
  test('chưa có sổ ⇒ nói rõ, và phủ định cách đọc sai', () => {
    /*
     * Gộp "chưa đo" với "không có ma sát" là đúng chỗ sai mà cả §1 đi vá: một con số 0 không nói được
     * nó đến từ phép đo nào.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toContain('CHƯA CÓ SỔ');
    expect(src).toMatch(/KHÔNG phải/);
    expect(src).toContain('nó là "chưa đo"');
  });

  test('`doc()` phân biệt KHÔNG CÓ SỔ với SỔ RỖNG', () => {
    const s = fric.doc();
    expect(typeof s.co_so).toBe('boolean');
    expect(Array.isArray(s.su_kien)).toBe(true);
    /* Dòng hỏng phải được ĐẾM, không im lặng bỏ qua. */
    expect(typeof s.dong_hong).toBe('number');
  });

  test('`gate:audit` lấy số TỪ SỔ, và trả "chưa đo được" khi gate chưa có sự kiện', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_audit.js'), 'utf8');
    expect(src).toContain('gate_friction.js');
    expect(src).toMatch(/chưa đo KHÁC không có/);
  });
});

test.describe('@infra gate:friction — bốn sự kiện, và "báo oan" KHÔNG suy được', () => {
  test('đúng bốn loại sự kiện', () => {
    expect(fric.SU_KIEN.sort()).toEqual(['bao_oan', 'chan', 'mien_tru', 'so_no']);
  });

  test('sự kiện lạ bị TỪ CHỐI, không ghi', () => {
    const r = fric.ghi('lenh_la', { gate: 'x' });
    expect(r.ok).toBe(false);
  });

  test('"báo oan" CHỈ vào sổ khi có người khai — không suy từ số lượt override', () => {
    /*
     * Một lượt chặn không nói gate đúng hay sai; một lượt miễn trừ cũng không, vì người ta miễn trừ cả
     * khi gate đúng mà việc vẫn phải đi tiếp. Suy báo oan từ số override là cách chắc chắn nhất để một
     * gate ĐÚNG mà hay bị vướng bị kết luận là gate sai, rồi bị nới.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toMatch(/KHÔNG SUY ĐƯỢC TỪ BA SỰ KIỆN TRÊN/);
    /* Và `quyTacDon` chỉ đọc `bao_oan`, không đọc `mien_tru`, để tính tỉ lệ. */
    const i = src.indexOf('function quyTacDon');
    const khoi = src.slice(i, src.indexOf('\n}', i));
    expect(khoi).toContain('g.bao_oan / tongChan');
    expect(khoi, 'tỉ lệ báo oan không được tính từ số miễn trừ').not.toMatch(/mien_tru\s*\/\s*tongChan/);
  });

  test('khai báo oan THIẾU lý do ⇒ exit 2, và nói rõ khác gì với override', () => {
    const r = spawnSync(process.execPath, [MAY, '--bao-oan', 'dim:coverage', '--ma', 'DIM_15'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status).toBe(2);
    expect(`${r.stderr}`).toContain("`check --override`");
    expect(`${r.stderr}`, 'phải phân biệt "gate sai" với "việc vẫn phải đi tiếp"').toMatch(/gate kết luận sai/);
  });

  test('khai báo oan lý do NGẮN ⇒ exit 2', () => {
    const r = spawnSync(process.execPath, [MAY, '--bao-oan', 'x', '--ma', 'Y', '--ly-do', 'sai'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status).toBe(2);
  });
});

test.describe('@infra quy tắc dọn — ngưỡng, và quy tắc KHÔNG được áp', () => {
  test('dưới 10 lượt chặn ⇒ CHƯA ĐỦ DỮ LIỆU, không đề xuất gì', () => {
    const theoGate = fric.gopTheoGate([...sk('g1', 'chan', 9), ...sk('g1', 'bao_oan', 9)]);
    const d = fric.quyTacDon(theoGate);
    expect(d.de_xuat).toEqual([]);
    expect(d.khong_du_du_lieu.length).toBe(1);
    expect(d.khong_du_du_lieu[0].vi_sao).toContain('≥10');
  });

  test('≥10 lượt chặn và báo oan >20% ⇒ đề xuất SỬA GATE', () => {
    const theoGate = fric.gopTheoGate([...sk('g1', 'chan', 12), ...sk('g1', 'bao_oan', 3, { ly_do: LY_DO })]);
    const d = fric.quyTacDon(theoGate);
    expect(d.de_xuat.length).toBe(1);
    expect(d.de_xuat[0].loai).toBe('sua_gate');
    expect(d.de_xuat[0].vi_sao).toContain('25%');
    expect(d.de_xuat[0].lam_gi, 'phải nói sửa LUẬT kèm kiểm-âm, không nới ngưỡng').toMatch(/kiểm-âm/);
    expect(d.de_xuat[0].lam_gi).toMatch(/đừng nới ngưỡng và đừng tắt/);
  });

  test('ĐÚNG ngưỡng 20% thì CHƯA đề xuất — ngưỡng là "quá", không phải "bằng"', () => {
    const theoGate = fric.gopTheoGate([...sk('g1', 'chan', 10), ...sk('g1', 'bao_oan', 2)]);
    expect(fric.quyTacDon(theoGate).de_xuat).toEqual([]);
  });

  test('gate CHƯA TỪNG ĐỎ: KHÔNG bao giờ đề xuất bỏ', () => {
    /*
     * Đây là quy tắc nguy hiểm nhất của §A9, vì "gate này chưa bắt được gì" nghe như một lý lẽ mạnh.
     * Nó không phải: chưa đỏ có thể là đang gác một lớp lỗi kit CHƯA gặp · chưa ai chạy nó · hoặc nó
     * HỎNG và `catch` nuốt mọi thứ (đã xảy ra thật với `dimension_coverage`). Ba thứ đó không phân biệt
     * được bằng số lượt đỏ.
     */
    const theoGate = fric.gopTheoGate(sk('g-im-lang', 'so_no', 50));
    const d = fric.quyTacDon(theoGate);
    for (const dx of d.de_xuat) expect(dx.loai, 'không được có đề xuất bỏ gate').not.toMatch(/bo|remove|xoa/i);
    expect(String(d._khong_bao_gio_de_xuat_bo_vi_chua_do)).toContain('KHÔNG phải căn cứ để bỏ');
    expect(String(d._khong_bao_gio_de_xuat_bo_vi_chua_do), 'phải nêu cả ba cách đọc').toContain('catch` nuốt mọi thứ');
  });

  test('TRÙNG LẮP: luôn "chưa đo được", kèm cách đo đúng', () => {
    const d = fric.quyTacDon([]);
    expect(d.trung_lap.trang_thai).toBe('chưa đo được');
    expect(d.trung_lap.vi_sao).toMatch(/A10\.3/);
    expect(d.trung_lap.vi_sao).toMatch(/không chạm UAT/);
  });

  test('mọi đề xuất đều khai CHỈ LÀ ĐỀ XUẤT', () => {
    const d = fric.quyTacDon([]);
    expect(String(d._chi_de_xuat)).toContain('Người duyệt mới làm');
    expect(String(d._chi_de_xuat), 'và gate nào gộp thì mutation_check phải bắt cùng tập mutant')
      .toContain('mutation_check');
  });

  test('ngưỡng khai thành HẰNG — số trong luật và số trong code là một', () => {
    expect(fric.NGUONG.toi_thieu_luot_chan).toBe(10);
    expect(fric.NGUONG.ti_le_bao_oan).toBe(0.2);
  });
});

test.describe('@infra sổ ma sát — ghi ở chỗ sự kiện THẬT xảy ra, và không làm chết lớp gác', () => {
  test('`gate_tier.apTang` ghi sổ khi CHẶN và khi ghi sổ nợ', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/lib/gate_tier.js'), 'utf8');
    expect(src).toContain("ghiMaSat('chan'");
    expect(src).toContain("ghiMaSat('so_no'");
  });

  test('`override.tao` ghi sổ khi có miễn trừ — nhưng KHÔNG ghi là báo oan', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/override.js'), 'utf8');
    expect(src).toContain("fric.ghi('mien_tru'");
    expect(src, 'miễn trừ không phải báo oan').not.toContain("fric.ghi('bao_oan'");
    expect(src).toMatch(/KHÔNG\s*\n?\s*\*?\s*phải một lượt báo oan/);
  });

  test('sổ đo KHÔNG được làm chết lớp gác — mọi chỗ ghi đều bọc `try`', () => {
    /*
     * Đây là lớp ĐO, không phải lớp gác. Một lượt kiểm thất bại vì không ghi được sổ là đổi một phép đo
     * thành một lỗi chặn người dùng.
     */
    for (const f of ['scripts/qa/lib/gate_tier.js', 'scripts/qa/override.js']) {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      const i = src.indexOf('gate_friction.js');
      expect(i, `${f} không nhắc sổ ma sát`).toBeGreaterThan(0);
      const quanh = src.slice(Math.max(0, i - 400), i + 400);
      expect(quanh, `${f}: chỗ ghi sổ phải bọc try`).toMatch(/try\s*\{/);
      expect(quanh).toMatch(/catch \(e\)/);
    }
  });

  test('`ghi()` KHÔNG ném khi lỗi — trả `{ok:false}`', () => {
    const src = fs.readFileSync(MAY, 'utf8');
    const i = src.indexOf('function ghi(');
    const khoi = src.slice(i, src.indexOf('\n}', src.indexOf('catch', i)));
    expect(khoi).toContain('return { ok: false');
    expect(khoi, 'không được ném').not.toMatch(/throw /);
  });

  test('sổ là APPEND-ONLY — không ghi đè, không sửa dòng cũ', () => {
    /* Sổ ma sát là bằng chứng về quá khứ, và một bằng chứng sửa được thì không còn là bằng chứng. */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toContain('appendFileSync');
    expect(src, 'không được dùng writeFileSync cho sổ').not.toMatch(/writeFileSync\([^)]*duongSo/);
    expect(src).toMatch(/Append-only/);
  });

  test('sổ nằm ở `knowledge/metrics/` — lớp PROJECT, không vào repo kit', () => {
    expect(fric.duongSo().replace(/\\/g, '/')).toMatch(/knowledge\/metrics\/gate-friction\.jsonl$/);
    const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
    expect(gi, '`knowledge/**` phải bị gitignore — đây là dữ liệu dự án').toMatch(/knowledge/);
  });
});

test.describe('@infra gate:friction — sổ chỉ nhận sự kiện của task THẬT (đo 12/11/2026)', () => {
  /*
   * Sổ thật có 2745 dòng và CẢ 2745 đến từ bộ test (task `debt-*`, `T-OV`, `T-KHAC`), 0 dòng của task thật:
   * bộ test dựng task giả trong thư mục tạm rồi gọi đúng các hàm ghi sổ. Và lượt chạy thật thì không ghi gì, vì
   * chỉ `apTang` ghi sự kiện "chặn" mà `check`/`exit:gate` không đi qua nó.
   */
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const tier = require(path.join(REPO, 'scripts/qa/lib/gate_tier.js'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const os = require('os');

  const voiSoTam = (fn: (f: string) => void) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fric-so-'));
    const f = path.join(d, 'so.jsonl');
    const cu = process.env.GATE_FRICTION_SO;
    process.env.GATE_FRICTION_SO = f;
    try { fn(f); } finally {
      if (cu === undefined) delete process.env.GATE_FRICTION_SO; else process.env.GATE_FRICTION_SO = cu;
      fs.rmSync(d, { recursive: true, force: true });
    }
  };

  test('thư mục tạm của bộ test (os.tmpdir, outputs/_scratch) ⇒ KHÔNG ghi; thư mục task thật ⇒ ghi', () => {
    expect(fric.laThuMucTam(path.join(os.tmpdir(), 'debt-abc'))).toBe(true);
    expect(fric.laThuMucTam(path.join(REPO, 'outputs', '_scratch', 'x'))).toBe(true);
    expect(fric.laThuMucTam(path.join(REPO, 'outputs', 'CSDL', 'tasks', 'CSDL-9001'))).toBe(false);
    expect(fric.laThuMucTam(null)).toBe(false);
    voiSoTam((f) => {
      expect(fric.ghi('chan', { gate: 'g', thuMuc: path.join(os.tmpdir(), 'debt-x') }).bo_qua).toMatch(/thư mục tạm/);
      expect(fs.existsSync(f)).toBe(false);
      expect(fric.ghi('chan', { gate: 'g', thuMuc: path.join(REPO, 'outputs', 'CSDL', 'tasks', 'K-1') }).ok).toBe(true);
      expect(fs.readFileSync(f, 'utf8').trim().split('\n')).toHaveLength(1);
    });
  });

  test('đường ghi của bộ test (apTang trên task tạm) KHÔNG làm sổ dài thêm', () => {
    voiSoTam((f) => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'debt-'));
      try {
        tier.apTang('dim:coverage', [{ ma: 'X', thong_diep: 'm' }], { nguCanh: 'exit', taskOutputDir: d, log: () => {} });
        tier.apTang('dim:coverage', [{ ma: 'X', thong_diep: 'm' }], { nguCanh: 'phase', taskOutputDir: d, log: () => {} });
      } finally { fs.rmSync(d, { recursive: true, force: true }); }
      expect(fs.existsSync(f), 'sự kiện của task giả không phải sự kiện thật').toBe(false);
    });
  });

  test('cửa THẬT ghi sổ: `check` ghi chặn + sổ nợ, `exit:gate` ghi chặn — và cả hai chỉ cách khai báo oan', () => {
    const check = fs.readFileSync(path.join(REPO, 'scripts/qa/check.js'), 'utf8');
    const exit = fs.readFileSync(path.join(REPO, 'scripts/qa/exit_gate.js'), 'utf8');
    expect(check).toMatch(/if \(qd\.chan\) \{ coChan = true; gateTier\.ghiMaSat\('chan', r\.gateId/);
    expect(check).toMatch(/gateTier\.ghiMaSat\('so_no', r\.gateId/);
    expect(exit).toMatch(/gateTier\.ghiMaSat\('chan', m\.lenh/);
    for (const s of [check, exit]) expect(s).toContain('npm run gate:friction -- --bao-oan <gate>');
  });

  test('miễn trừ ghi trên thư mục quyết định tạm ⇒ KHÔNG vào sổ', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const ov = require(path.join(REPO, 'scripts/qa/override.js'));
    voiSoTam((f) => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-'));
      try {
        const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['CSDL_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'QA-Lead', dir: d });
        expect(r.ok).toBe(true);
      } finally { fs.rmSync(d, { recursive: true, force: true }); }
      expect(fs.existsSync(f)).toBe(false);
    });
  });
});
