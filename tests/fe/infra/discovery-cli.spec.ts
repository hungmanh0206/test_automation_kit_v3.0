import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — LỆNH `discover` + BA ĐIỂM NỐI GATE (v2.6.0 §A1 · §B2 · §B11).
 *
 * Lệnh này là thứ sinh ra input cho mọi điểm nối khác, nên nó phải chạy đủ chuỗi crawl → api → fuse →
 * injection → tóm tắt, trên một app thật (fixture offline).
 *
 * TRẦN TOÁN TẮT (§T.3) là phần dễ trôi nhất: `task` ≤ 2k · `delta` ≤ 1k · `system` ≤ 4k token. Phải kiểm
 * trên fixture LỚN, không chỉ fixture 7 màn — một trần chỉ đo trên dữ liệu nhỏ thì nó chưa được gác.
 *
 * MỘT KHUYẾT ĐIỂM THẬT phát hiện khi chạy thử: lượt đầu ra `0 màn · 1 lỗi · 0%` mà lệnh vẫn in dấu ✓ và
 * exit 0. Nguyên nhân lúc đó là lỗi của harness thử (`spawnSync` chặn event loop nên server fixture trong
 * cùng tiến trình không nhận nổi kết nối), nhưng chuyện CLI báo THÀNH CÔNG cho một lượt bò rỗng là khuyết
 * điểm riêng của CLI — và nó tệ hơn: người chạy sẽ đi tiếp với `system_map.json` trống, rồi `scope_anchor`
 * lấy mẫu số bằng 0 và mọi tỉ lệ coverage về sau vô nghĩa.
 */
const FXDIR = path.resolve(__dirname, '..', 'fixtures', 'discovery-app');
const REPO = path.resolve(__dirname, '..', '..', '..');
const CLI = path.join(REPO, 'scripts/qa/discover.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(path.join(FXDIR, 'server.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dc = require(CLI);

type Ket = { status: number | null; out: string };

let srv: { url: string; close(): Promise<void> };
test.beforeAll(async () => { srv = await fixture.start(); });
test.afterAll(async () => { await srv.close(); });

/*
 * `spawn` ASYNC, KHÔNG `spawnSync`. Server fixture chạy trong CÙNG tiến trình với test, nên `spawnSync`
 * chặn event loop và server không nhận nổi kết nối — lượt thử đầu ra đúng "0 màn · timeout" vì chuyện này.
 */
function chay(args: string[]): Promise<Ket> {
  return new Promise((res) => {
    const c = spawn(process.execPath, [CLI, ...args], { cwd: REPO, env: gateEnv() });
    let o = '';
    c.stdout.on('data', (d) => { o += d; });
    c.stderr.on('data', (d) => { o += d; });
    c.on('close', (code) => res({ status: code, out: o }));
  });
}

function tmpOut() { return fs.mkdtempSync(path.join(os.tmpdir(), 'disc-')); }

/*
 * DÙNG LẠI MỘT LƯỢT CHẠY cho các test chỉ ĐỌC kết quả. Bản đầu của spec này mất 3,0 phút vì mỗi test
 * spawn một tiến trình, mở một browser và bò lại cả app. Một spec hạ tầng chậm thế thì người ta thôi chạy
 * nó trước khi commit, và lúc đó nó không gác gì nữa. Test đo nhánh TỪ CHỐI và nhánh rỗng vẫn chạy riêng.
 */
let motLuot: Promise<{ r: Ket; out: string }> | null = null;
function luotChung() {
  if (motLuot) return motLuot;
  motLuot = (async () => {
    const out = tmpOut();
    const r = await chay(['--mode', 'task', ...ARG_CHUNG(out)]);
    return { r, out };
  })();
  return motLuot;
}
const ARG_CHUNG = (out: string) => [
  '--base-url', srv.url, '--confirm-nonprod', '--out', out, '--khong-chup-anh',
  '--tai-lieu', path.join(FXDIR, 'fsd.md'),
  '--openapi', path.join(FXDIR, 'openapi.json'),
];

test.describe('@infra `discover` chạy đủ chuỗi trên app thật', () => {
  test('một lệnh ⇒ 4 file JSON + questions.md + summary.txt', async () => {
    const out = (await luotChung()).out;
    {
      const r = (await luotChung()).r;
      expect(r.status, r.out).toBe(0);
      for (const f of ['system_map.json', 'injection_surface.json', 'api_inventory.json', 'doc_coverage.json', 'questions.md', 'summary.txt']) {
        expect(fs.existsSync(path.join(out, f)), `thiếu ${f}`).toBe(true);
      }
      const sm = JSON.parse(fs.readFileSync(path.join(out, 'system_map.json'), 'utf8'));
      expect(sm.screens.length, 'bò được màn').toBeGreaterThanOrEqual(6);
      expect(sm.status, 'mọi bản ghi là observed, KHÔNG phải oracle').toBe('observed');
    }
  });

  test('bản tóm tắt in ra stdout mang đúng bốn khối bắt buộc', async () => {
    {
      const r = (await luotChung()).r;
      expect(r.out).toMatch(/độ đầy đủ lượt bò:/);
      expect(r.out).toMatch(/## Vùng mù:/);
      expect(r.out).toMatch(/## Bề mặt injection cần case:/);
      expect(r.out).toMatch(/## Câu hỏi Critical\/High:/);
      expect(r.out, 'và nhắc rằng đây không phải oracle').toMatch(/KHÔNG phải oracle/);
      expect(r.out, 'tường lửa phải báo 0 lọt').toMatch(/0 lọt \(phải là 0\)/);
    }
  });

  test('bẫy fixture ra đúng kết quả: 2 vùng mù, 6 bề mặt cần case', async () => {
    {
      const r = (await luotChung()).r;
      expect(r.out).toMatch(/## Vùng mù: 2 màn/);
      expect(r.out).toMatch(/- \/bao-cao$/m);
      expect(r.out).toMatch(/## Bề mặt injection cần case: 6/);
      expect(r.out, '`sort` phải là critical').toMatch(/sort@\/api\/truong \(critical/);
    }
  });

  test('`questions.md` gộp câu hỏi của cả fuse và injection', async () => {
    {
      const out = (await luotChung()).out;
      const q = fs.readFileSync(path.join(out, 'questions.md'), 'utf8');
      expect(q, 'câu hỏi vùng mù').toMatch(/\/bao-cao/);
      expect(q, 'câu hỏi điểm nhập').toMatch(/đặc tả có quy định giá trị hợp lệ/);
      expect(q, 'phải chỉ sang chỗ gộp').toMatch(/phase1-clarifications\.md/);
      expect(q, 'và nhắc giữ AMBIGUITY_GATE').toMatch(/AMBIGUITY_GATE: PENDING/);
    }
  });
});

test.describe('@infra an toàn của lệnh — từ chối trước khi mở trang nào', () => {
  test('thiếu `--confirm-nonprod` ⇒ TỪ CHỐI', async () => {
    const out = tmpOut();
    try {
      const r = await chay(['--mode', 'task', '--base-url', srv.url, '--out', out]);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/TỪ CHỐI/);
      expect(fs.existsSync(path.join(out, 'system_map.json')), 'không được ghi file nào').toBe(false);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });

  test('host không khớp dấu hiệu non-prod ⇒ TỪ CHỐI, không đoán', async () => {
    const r = await chay(['--mode', 'task', '--base-url', 'https://qemis.example.vn/', '--confirm-nonprod']);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/KHÔNG khớp dấu hiệu non-prod nào/);
  });

  test('`--mode` lạ ⇒ từ chối, nêu đúng ba chế độ', async () => {
    const r = await chay(['--mode', 'tatca', '--base-url', srv.url, '--confirm-nonprod']);
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/task\|delta\|system/);
  });
});

test.describe('@infra lượt bò rỗng KHÔNG được báo ✓ — khuyết điểm đã sửa', () => {
  test('0 màn ⇒ exit 1, và nói rõ `system_map.json` vừa ghi là file rỗng', async () => {
    /*
     * Chặn mọi route bằng `--pham-vi` khớp một đường không tồn tại ⇒ bò được 0 màn. Đây là ca mà bản đầu
     * in ✓ và exit 0.
     */
    const out = tmpOut();
    try {
      const r = await chay(['--mode', 'task', ...ARG_CHUNG(out), '--max-trang', '0']);
      expect(r.status, 'phải exit 1').toBe(1);
      expect(r.out).toMatch(/KHÔNG BÒ ĐƯỢC MÀN NÀO/);
      expect(r.out, 'và nói rõ hậu quả nếu đi tiếp').toMatch(/đừng dùng nó làm mẫu số/);
      expect(r.out, 'KHÔNG được in dấu đạt').not.toMatch(/\[discover\] ✓/);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });

  test('độ đầy đủ dưới 80% ⇒ CẢNH BÁO nhưng KHÔNG chặn', async () => {
    /* Một lượt bò hẹp vẫn dùng được khi biết rõ nó hẹp. Chặn nó là mất cả thông tin đã bò được. */
    const out = tmpOut();
    try {
      const r = await chay(['--mode', 'task', ...ARG_CHUNG(out), '--max-trang', '2']);
      expect(r.status, 'không chặn').toBe(0);
      expect(r.out).toMatch(/độ đầy đủ \d+% dưới ngưỡng 80%/);
      expect(r.out).toMatch(/KHÔNG chặn, vì một lượt bò hẹp vẫn dùng được/);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
});

test.describe('@infra trần token tóm tắt — kiểm trên fixture LỚN', () => {
  /** Dựng một gói kết quả GIẢ với n màn, để đo đúng logic rút gọn mà không cần app n màn. */
  function goi(n: number, soVungMu: number, soHoi: number) {
    const screens = Array.from({ length: n }, (_, i) => ({
      route: `/man-${i}`, title_observed: `Màn số ${i}`,
      fields: Array.from({ length: 12 }, (_, k) => ({ nhan: `Ô nhập số ${k} của màn ${i}` })),
      components: ['data_table', 'pagination', 'filter'],
    }));
    return {
      build_id: '2026-10-11-abc', outRel: 'knowledge/system/discovery/x',
      crawl: {
        target: { host: 'uat.example.vn' }, screens,
        crawl_completeness: { route_toi_duoc: n, route_phat_hien: n, ti_le: 1, khong_toi_duoc: { needs_account: 0, captcha: 0, error: 0, budget: 0 }, canh_bao: null },
        tuong_lua: { request_ghi_bi_chan: 3, request_ghi_lot: 0 },
      },
      api: { apis: Array.from({ length: n }, (_, i) => ({ method: 'GET', path_chuan: `/api/man-${i}` })) },
      fuse: {
        vung_mu: Array.from({ length: soVungMu }, (_, i) => `/man-mu-${i}`),
        doc_coverage: screens.map((s) => ({ vung: s.route, o: 'documented_present' })),
        cau_hoi_ambiguity: Array.from({ length: soHoi }, (_, i) => ({ muc: 'High', cau_hoi: `Câu hỏi số ${i} về một màn không có tài liệu nào mô tả`, vi_sao: 'x' })),
      },
      injection: { be_mat: [], cau_hoi_ambiguity: [] },
    };
  }

  test('fixture LỚN (120 màn) ⇒ `task` vẫn trong trần 2k, và nói đã cắt gì', () => {
    /*
     * 120 màn là giới hạn lượt bò mặc định (`so_trang_toi_da`), tức đúng trường hợp xấu nhất của chế độ
     * `system`. Không kiểm ở mức này thì trần token chưa được gác — nó chỉ được gác trên fixture 7 màn.
     */
    const t = dc.dungTomTat(goi(120, 3, 5), 'task');
    expect(t.so_token, `${t.so_token} token`).toBeLessThanOrEqual(dc.TRAN.task);
    expect(t.da_rut_gon, 'phải có rút gọn ở quy mô này').toBe(true);
    expect(t.than, 'và nói rõ đã cắt bao nhiêu màn').toMatch(/bảng màn cắt còn 10 dòng \(bỏ \d+ màn\)/);
  });

  test('rút gọn KHÔNG BAO GIỜ cắt vùng mù, bề mặt injection, hay câu hỏi', () => {
    /*
     * Đây là thứ duy nhất trong bản tóm tắt mà agent buộc phải hành động theo. Cắt nó để vừa trần là tiết
     * kiệm token bằng cách bỏ đúng phần có giá trị.
     */
    const t = dc.dungTomTat(goi(120, 9, 12), 'task');
    for (let i = 0; i < 9; i += 1) expect(t.than, `vùng mù ${i} bị cắt`).toContain(`/man-mu-${i}`);
    for (let i = 0; i < 12; i += 1) expect(t.than, `câu hỏi ${i} bị cắt`).toContain(`Câu hỏi số ${i}`);
  });

  test('ba chế độ có ba trần khác nhau, và `delta` chặt nhất', () => {
    expect(dc.TRAN.delta).toBe(1000);
    expect(dc.TRAN.task).toBe(2000);
    expect(dc.TRAN.system).toBe(4000);
    const d = dc.dungTomTat(goi(60, 2, 3), 'delta');
    expect(d.so_token).toBeLessThanOrEqual(dc.TRAN.delta);
  });

  test('vượt trần dù đã cắt hết ⇒ nói thẳng đó là tín hiệu phạm vi quá rộng', () => {
    /*
     * Khi phần KHÔNG được cắt (vùng mù + câu hỏi) tự nó đã vượt trần thì không còn gì để cắt. Lúc đó im
     * lặng trả về một bản tóm tắt quá dài là tệ nhất: agent đọc hết và trần token thành con số trang trí.
     */
    const t = dc.dungTomTat(goi(5, 200, 200), 'delta');
    expect(t.so_token).toBeGreaterThan(dc.TRAN.delta);
    expect(t.than).toMatch(/Vẫn vượt trần sau khi cắt bảng màn/);
    expect(t.than).toMatch(/tín hiệu phạm vi quá rộng/);
  });

  test('trần khai trong `prompt_budget.json`, không chỉ trong code', () => {
    /* Một nguồn: `prompt_budget.json` là NGUỒN DUY NHẤT của ngưỡng token trong kit. */
    const pb = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/prompt_budget.json'), 'utf8'));
    expect(pb.tran_tom_tat_discover, 'thiếu khối trần tóm tắt discover').toBeTruthy();
    expect(pb.tran_tom_tat_discover.task).toBe(dc.TRAN.task);
    expect(pb.tran_tom_tat_discover.delta).toBe(dc.TRAN.delta);
    expect(pb.tran_tom_tat_discover.system).toBe(dc.TRAN.system);
  });
});

test.describe('@infra §B2 `scope_anchor` — mẫu số phải phủ thứ quan sát được', () => {
  const SA = path.join(REPO, 'scripts/qa/scope_anchor.js');

  function taskTam(o: { sm?: unknown; danhMuc?: string[] }) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-'));
    const req = path.join(d, 'tasks', 'T1', 'requirements');
    fs.mkdirSync(req, { recursive: true });
    fs.mkdirSync(path.join(d, 'tasks', 'T1', 'test-cases'), { recursive: true });
    if (o.sm) fs.writeFileSync(path.join(req, 'system_map.json'), JSON.stringify(o.sm), 'utf8');
    if (o.danhMuc) {
      fs.writeFileSync(path.join(req, 'scope_inventory.md'), [
        '# Danh mục phạm vi', '', '| # | Mục | Nguồn |', '|---|---|---|',
        ...o.danhMuc, '',
      ].join('\n'), 'utf8');
    }
    return d;
  }

  function chaySA(pod: string) {
    const r = spawnSync(process.execPath, [SA], {
      cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: pod, TASK_KEY: 'T1' },
    });
    return `${r.stdout || ''}${r.stderr || ''}`;
  }

  const SM = {
    screens: [{ route: '/truong', title_observed: 'Hồ sơ trường' }, { route: '/bao-cao', title_observed: 'Báo cáo' }],
    apis: [{ method: 'GET', path_chuan: '/api/truong' }],
  };

  test('CHƯA có `system_map.json` ⇒ nói "CHƯA GÁC ĐƯỢC", không im lặng', () => {
    const d = taskTam({ danhMuc: ['| 1 | Hồ sơ trường | FSD §2 |'] });
    const out = chaySA(d);
    expect(out).toMatch(/CHƯA GÁC ĐƯỢC/);
    expect(out, 'và nói rõ hệ quả').toMatch(/agent tự liệt kê từ tài liệu/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('danh mục BỎ SÓT màn quan sát được ⇒ nêu đúng tên, nói đúng hệ quả', () => {
    const d = taskTam({ sm: SM, danhMuc: ['| 1 | Hồ sơ trường `/truong` | FSD §2 |'] });
    const out = chaySA(d);
    expect(out).toMatch(/Mẫu số BỎ SÓT 2 thứ QUAN SÁT ĐƯỢC/);
    expect(out).toMatch(/\/bao-cao/);
    expect(out).toMatch(/\/api\/truong/);
    expect(out, 'hệ quả phải nói ra').toMatch(/vùng không ai test mà coverage vẫn báo đủ/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('danh mục phủ ĐỦ ⇒ không còn dòng bỏ sót', () => {
    const d = taskTam({
      sm: SM,
      danhMuc: [
        '| 1 | Hồ sơ trường `/truong` | FSD §2 |',
        '| 2 | Báo cáo `/bao-cao` | FSD §3 |',
        '| 3 | API `/api/truong` | OpenAPI |',
      ],
    });
    const out = chaySA(d);
    expect(out).not.toMatch(/Mẫu số BỎ SÓT/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('CỐ Ý loại ra thì phải ghi lý do TRÊN DÒNG đó, và gate nhắc người review', () => {
    const d = taskTam({
      sm: SM,
      danhMuc: [
        '| 1 | Hồ sơ trường `/truong` | FSD §2 |',
        '| 2 | Báo cáo `/bao-cao` | ngoài phạm vi đợt này, chủ DA chốt 10/10 |',
        '| 3 | API `/api/truong` | OpenAPI |',
      ],
    });
    const out = chaySA(d);
    expect(out).not.toMatch(/Mẫu số BỎ SÓT/);
    expect(out, 'lý do loại trừ là một lời khai ⇒ phải nhắc người đọc lại').toMatch(/bị loại khỏi phạm vi CÓ lý do/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('lượt bò chưa đầy đủ ⇒ "phủ hết thứ quan sát được" KHÔNG đồng nghĩa "phủ hết hệ thống"', () => {
    const d = taskTam({
      sm: { ...SM, crawl_completeness: { canh_bao: 'Chỉ bò tới 3/10 route (30%)' } },
      danhMuc: [
        '| 1 | Hồ sơ trường `/truong` | FSD §2 |',
        '| 2 | Báo cáo `/bao-cao` | FSD §3 |',
        '| 3 | API `/api/truong` | OpenAPI |',
      ],
    });
    const out = chaySA(d);
    expect(out).toMatch(/KHÔNG đồng nghĩa "đã phủ hết hệ thống"/);
    expect(out).toMatch(/3\/10 route/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra §B11 `preflight --mode phase1` — cảnh báo, chặn được khi dự án muốn', () => {
  const PF = path.join(REPO, 'scripts/qa/preflight_gate.js');

  function taskTam(co: { sm?: boolean; isf?: boolean; cu?: boolean }) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    const req = path.join(d, 'tasks', 'T1', 'requirements');
    fs.mkdirSync(req, { recursive: true });
    if (co.sm) {
      const p = path.join(req, 'system_map.json');
      fs.writeFileSync(p, JSON.stringify({ screens: [] }), 'utf8');
      if (co.cu) {
        const cu = Date.now() - 40 * 86400000;
        fs.utimesSync(p, cu / 1000, cu / 1000);
      }
    }
    if (co.isf) fs.writeFileSync(path.join(req, 'injection_surface.json'), '{"be_mat":[]}', 'utf8');
    return d;
  }

  function chayPF(pod: string, env: Record<string, string> = {}) {
    const r = spawnSync(process.execPath, [PF, '--mode', 'phase1', '--task', 'T1'], {
      cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: pod, ...env },
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  }

  test('thiếu `system_map.json` ⇒ CẢNH BÁO, không chặn', () => {
    /* Task hiện có đều chưa chạy Bước 0; chặn ngay là làm đỏ mọi task đang chạy rồi gate bị tắt. */
    const d = taskTam({});
    const r = chayPF(d);
    expect(r.out).toMatch(/chưa có `requirements\/system_map\.json`/);
    expect(r.out, 'và nói rõ hệ quả').toMatch(/màn\/API không có trong tài liệu sẽ không ai test/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`DISCOVERY_REQUIRED=1` ⇒ CHẶN — dự án siết được khi muốn', () => {
    const d = taskTam({});
    const r = chayPF(d, { DISCOVERY_REQUIRED: '1' });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/DISCOVERY_REQUIRED=1/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('snapshot quá cũ ⇒ cảnh báo, và nói đúng vì sao nó im lặng hơn', () => {
    /* Bản đồ của build trước vẫn parse được và vẫn đủ màn — nó chỉ mô tả một app KHÁC. */
    const d = taskTam({ sm: true, isf: true, cu: true });
    const r = chayPF(d);
    expect(r.out).toMatch(/đã \d+ ngày \(ngưỡng 14\)/);
    expect(r.out).toMatch(/mô tả một app KHÁC/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('có `system_map` mà thiếu `injection_surface` ⇒ cảnh báo đúng chỗ hở', () => {
    const d = taskTam({ sm: true });
    const r = chayPF(d);
    expect(r.out).toMatch(/thiếu `requirements\/injection_surface\.json`/);
    expect(r.out).toMatch(/quay về chấm bằng regex trên văn bản/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('đủ cả hai và còn mới ⇒ KHÔNG cảnh báo gì về Bước 0', () => {
    const d = taskTam({ sm: true, isf: true });
    const r = chayPF(d);
    expect(r.out).not.toMatch(/system_map\.json`/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});
