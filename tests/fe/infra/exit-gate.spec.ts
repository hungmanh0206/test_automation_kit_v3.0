import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * BA CỬA RA (v2.7.0 §A2) — phần giữ lời của §A1.
 *
 * Phân tầng hoãn mọi vi phạm T1 từ "chặn ngay" sang "chặn ở cửa ra". Nếu cửa ra không có thật thì đợt
 * giảm ma sát biến thành đợt NỚI GATE: 57 máy T1 thôi chặn mà không gì chặn thay. Nên bộ test này khoá
 * đúng ba thứ:
 *   · cửa đọc sổ nợ và chặn khi còn món chưa trả;
 *   · "không phán được" (exit 2) KHÔNG được tính là đạt;
 *   · script tự đẩy ra ngoài phải TỰ kiểm cửa, và dấu vết qua cửa không dùng lại được cho bộ đã đổi.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/exit_gate.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const eg = require(MAY);

test.describe.configure({ mode: 'default' });

function taskTam() {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'exitg-'));
  const taskDir = path.join(goc, 'tasks', 'T-EXIT');
  fs.mkdirSync(path.join(taskDir, 'reports'), { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'test-results'), { recursive: true });
  return { goc, taskDir };
}

function chay(them: string[], goc?: string) {
  return spawnSync(process.execPath, [MAY, ...them], {
    cwd: REPO,
    encoding: 'utf8',
    env: goc ? { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-EXIT' } : gateEnv(),
  });
}

test.describe('@infra exit:gate — ba cửa khai trong CONFIG, không trong code', () => {
  test('đúng ba cửa, mỗi máy kèm một câu vì sao', () => {
    /*
     * Khai trong code thì không ai kiểm toán được một cửa đã bị rút bớt máy — bớt một dòng là xong.
     * Khai trong config thì `gate:policy` và test này soi được.
     */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/exit_gates.json'), 'utf8'));
    expect(Object.keys(cfg.cua).sort()).toEqual(['bug', 'done', 'publish']);
    for (const [ten, c] of Object.entries(cfg.cua as Record<string, { may: Array<{ lenh: string; vi_sao: string }>; goi_tu: string[] }>)) {
      expect(c.may.length, `cửa ${ten} không có máy nào`).toBeGreaterThan(0);
      for (const m of c.may) {
        expect(String(m.vi_sao).length, `${ten}/${m.lenh} thiếu lý do`).toBeGreaterThan(30);
      }
      expect(c.goi_tu.length, `cửa ${ten} không khai bề mặt nào gọi nó`).toBeGreaterThan(0);
    }
  });

  test('mọi máy của mọi cửa đều là npm script CÓ THẬT', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/exit_gates.json'), 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    for (const [ten, c] of Object.entries(cfg.cua as Record<string, { may: Array<{ lenh: string }> }>)) {
      for (const m of c.may) {
        expect(pkg.scripts[m.lenh], `cửa ${ten} gọi \`${m.lenh}\` mà package.json không có`).toBeTruthy();
      }
    }
  });

  test('mọi bề mặt khai trong `goi_tu` đều TỒN TẠI trên đĩa', () => {
    /* Một cửa trỏ tới file không có nghĩa là cửa đó không được gọi từ đâu cả. */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/exit_gates.json'), 'utf8'));
    const thieu: string[] = [];
    for (const c of Object.values(cfg.cua as Record<string, { goi_tu: string[] }>)) {
      for (const f of c.goi_tu) if (!fs.existsSync(path.join(REPO, f))) thieu.push(f);
    }
    expect(thieu).toEqual([]);
  });

  test('cửa `bug` CỐ Ý không đòi sổ nợ sạch, và lý do được ghi', () => {
    /*
     * Log bug là việc PHẢI làm khi tìm ra lỗi thật. Nợ T1 về chất lượng bộ case không liên quan tới
     * việc một bug có thật hay không, nên chặn log bug vì bộ case còn nợ là chặn sai chỗ — nó làm
     * người ta không báo bug, tức tệ hơn hẳn việc để nợ đó tới cửa khác.
     */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/exit_gates.json'), 'utf8'));
    expect(cfg.cua.bug.doi_so_no_sach).toBe(false);
    expect(String(cfg.cua.bug._vi_sao_khong_doi_so_no_sach).length).toBeGreaterThan(60);
    expect(cfg.cua.publish.doi_so_no_sach).toBe(true);
    expect(cfg.cua.done.doi_so_no_sach).toBe(true);
  });

  test('cửa lạ ⇒ exit 2 và nêu danh sách cửa có thật', () => {
    const r = chay(['--cua', 'cua-khong-co']);
    expect(r.status).toBe(2);
    expect(`${r.stderr}`).toContain('cửa lạ');
    expect(`${r.stderr}`).toContain('publish');
  });

  test('không truyền `--cua` ⇒ liệt kê rồi exit 2, không đoán cửa', () => {
    const r = chay([]);
    expect(r.status).toBe(2);
    expect(`${r.stdout}`).toContain('BA CỬA RA');
  });

  test('`--liet-ke` nói thẳng chỗ CÒN HỞ', () => {
    const r = chay(['--liet-ke']);
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toContain('CÒN HỞ');
    expect(`${r.stdout}`, 'đường publish qua MCP không chặn được bằng code — phải nói ra').toContain('Drive MCP');
  });
});

test.describe('@infra exit:gate — sổ nợ T1 quay lại ở cửa ra', () => {
  test('còn món nợ ⇒ cửa `publish` CHẶN và nêu đích danh', () => {
    const t = taskTam();
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const gt = require(path.join(REPO, 'scripts/qa/lib/gate_tier.js'));
    gt.ghiSoNo(t.taskDir, 'dim:coverage', [{ ma: 'DIM_15', tcId: 'TC_007', thong_diep: 'thiếu chiều Security' }], { nguCanh: 'phase' });
    const no = eg.noConLai(t.taskDir);
    expect(no.mon).toHaveLength(1);
    expect(no.mon[0].tcId).toBe('TC_007');
  });

  test('THIẾU sổ KHÁC sổ SẠCH — trả null để chỗ gọi tự quyết', () => {
    /*
     * Ở cửa ra khác biệt này quan trọng: "chưa gate T1 nào ghi gì" có thể nghĩa là "chưa gate nào
     * CHẠY". Tự dịch thành "sạch" là mở cửa cho một bộ chưa ai kiểm.
     */
    const t = taskTam();
    expect(eg.noConLai(t.taskDir)).toBeNull();
  });

  test('sổ HỎNG coi như CÒN NỢ, không coi như sạch', () => {
    const t = taskTam();
    fs.writeFileSync(path.join(t.taskDir, 'reports', 'gate-debt.json'), '{ "mon": [', 'utf8');
    const no = eg.noConLai(t.taskDir);
    expect(no.hong, 'sổ hỏng phải báo hỏng').toBeTruthy();
  });

  test('mã nói rõ exit 2 là "không phán được", KHÔNG phải đạt', () => {
    /*
     * Đây là chỗ sai nguy hiểm nhất của một cửa ra. Coi exit 2 là đạt thì cửa mở cho một thứ chưa ai
     * kiểm; coi là vi phạm thì cửa chặn một task chỉ vì thiếu input không liên quan.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toContain('KHÔNG tính là đạt');
    expect(src).toMatch(/exit 2 là "KHÔNG PHÁN ĐƯỢC"/);
    expect(src, 'và khi có exit 2 thì phải nói ra lúc qua cửa').toContain('KHÔNG PHÁN ĐƯỢC:');
  });
});

test.describe('@infra exit:gate — dấu vết qua cửa, và đường né thật', () => {
  function datDauVet(taskDir: string, ten: string, sua: Record<string, unknown> = {}) {
    const dauVao = eg.bamDauVao(taskDir);
    const j = { cua: ten, task: 'T-EXIT', luc: new Date().toISOString(), dau_vao: dauVao, ...sua };
    fs.writeFileSync(path.join(taskDir, 'reports', `exit-gate-${ten}.json`), JSON.stringify(j, null, 2), 'utf8');
    return j;
  }

  test('chưa qua cửa ⇒ `kiemDauVet` từ chối, và chỉ đúng lệnh cần chạy', () => {
    const t = taskTam();
    const r = eg.kiemDauVet(t.taskDir, 'bug');
    expect(r.ok).toBe(false);
    expect(r.vi_sao).toContain('--cua bug');
  });

  test('qua cửa rồi ⇒ chấp nhận', () => {
    const t = taskTam();
    datDauVet(t.taskDir, 'bug');
    expect(eg.kiemDauVet(t.taskDir, 'bug').ok).toBe(true);
  });

  test('ĐƯỜNG NÉ THẬT: qua cửa rồi SỬA TIẾP rồi đẩy đi ⇒ từ chối', () => {
    /*
     * Đây là đường né mà một cửa ra chỉ-kiểm-có-dấu-vết sẽ không bịt được: chạy cửa cho bộ sạch, rồi
     * sửa thêm, rồi đẩy đi. Dấu vết mang BĂM của đầu vào nên băm lệch là phát hiện được.
     */
    const t = taskTam();
    datDauVet(t.taskDir, 'bug');
    expect(eg.kiemDauVet(t.taskDir, 'bug').ok).toBe(true);
    fs.writeFileSync(path.join(t.taskDir, 'test-cases', 'them-sau.md'), '# thêm sau khi qua cửa\n', 'utf8');
    const r = eg.kiemDauVet(t.taskDir, 'bug');
    expect(r.ok, 'đầu vào đổi sau khi qua cửa thì dấu vết hết hiệu lực').toBe(false);
    expect(r.vi_sao).toContain('ĐÃ ĐỔI');
  });

  test('dấu vết của CỬA KHÁC không dùng được', () => {
    const t = taskTam();
    datDauVet(t.taskDir, 'publish');
    fs.copyFileSync(
      path.join(t.taskDir, 'reports', 'exit-gate-publish.json'),
      path.join(t.taskDir, 'reports', 'exit-gate-bug.json'),
    );
    const r = eg.kiemDauVet(t.taskDir, 'bug');
    expect(r.ok).toBe(false);
    expect(r.vi_sao).toContain('của cửa "publish"');
  });

  test('dấu vết QUÁ HẠN không dùng được', () => {
    const t = taskTam();
    datDauVet(t.taskDir, 'bug', { luc: new Date(Date.now() - 48 * 3600 * 1000).toISOString() });
    const r = eg.kiemDauVet(t.taskDir, 'bug');
    expect(r.ok).toBe(false);
    expect(r.vi_sao).toMatch(/quá 24h/);
  });

  test('dấu vết hỏng JSON ⇒ từ chối, không bỏ qua', () => {
    const t = taskTam();
    fs.writeFileSync(path.join(t.taskDir, 'reports', 'exit-gate-bug.json'), '{ "cua":', 'utf8');
    expect(eg.kiemDauVet(t.taskDir, 'bug').ok).toBe(false);
  });

  test('GIỚI HẠN của dấu vết được ghi trong chính file', () => {
    /*
     * Dấu vết là file trong `outputs/`, người chạy có toàn quyền sửa. Nó chứng minh "đã qua cửa" cho
     * người đọc trung thực, KHÔNG chống được người cố ý. Không ghi giới hạn đó ra thì nó sẽ bị đọc như
     * một bằng chứng mạnh hơn thực tế.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toContain('KHÔNG chống được người cố ý');
  });
});

test.describe('@infra không có đường NÉ cửa ra (§B.3)', () => {
  test('`bug_reporter` TỰ kiểm cửa — không chờ ai nhớ chạy', () => {
    /*
     * Né ở đây không cần ác ý: chỉ cần gọi thẳng `npm run backlog:bug-report`, mà đó là cách gọi có
     * thật trong README và CI. Nên script phải tự kiểm.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/backlog/bug_reporter.js'), 'utf8');
    expect(src).toContain("kiemDauVet(taskDir, 'bug')");
    expect(src).toContain('CỬA RA "bug" chưa qua');
    expect(src, 'và phải giải thích vì sao script tự kiểm chứ không dặn suông').toMatch(/khác biệt giữa một luật và một máy/);
  });

  test('`--dry-run` KHÔNG cần qua cửa — nó không đẩy gì ra ngoài', () => {
    /*
     * Bắt dry-run qua cửa thì người ta mất đường xem trước, rồi sẽ chạy thẳng bản thật để khỏi vướng.
     * Gate làm mất đường xem trước là gate tự tạo động cơ để bị né.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/backlog/bug_reporter.js'), 'utf8');
    const i = src.indexOf('KIỂM CỬA RA');
    expect(i).toBeGreaterThan(0);
    expect(src.slice(i, i + 1400)).toMatch(/if \(!DRY_RUN\) \{/);
    expect(src).toContain('`--dry-run` KHÔNG kiểm');
  });

  test('`md_to_xlsx --for-publish` ĐÒI dấu vết cửa publish — chặn ở ARTIFACT', () => {
    /*
     * Publish là agent gọi Drive MCP trực tiếp, không qua script nào của kit, nên không chèn kiểm cửa
     * vào chính bước publish được. Cách bịt: chuyển điểm chặn từ HÀNH ĐỘNG sang ARTIFACT — bản .xlsx
     * đem publish chỉ sinh được sau khi qua cửa.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/convert_excel/md_to_xlsx.js'), 'utf8');
    expect(src).toContain('--for-publish');
    expect(src).toContain('kiemDauVet(taskDir, "publish")');
    expect(src, 'và phải nói rõ kẽ còn lại: upload một .xlsx cũ').toMatch(/upload một `?\.xlsx`? CŨ|upload một \.xlsx CŨ/);
  });

  test('lượt xuất THƯỜNG không cần qua cửa — gate không được cắt đường xem trước', () => {
    /*
     * Xuất .xlsx để tự xem là việc làm suốt Phase 1. Bắt mọi lượt xuất qua cửa thì người ta mất đường
     * xem trước, và một gate làm mất đường xem trước là gate tự tạo động cơ để bị né.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/convert_excel/md_to_xlsx.js'), 'utf8');
    const i = src.indexOf('--for-publish');
    expect(src.slice(i - 1200, i + 2000)).toMatch(/KHÔNG áp cho lượt xuất thường/);
    expect(src).toMatch(/if \(args\.includes\("--for-publish"\)\)/);
  });

  test('kẽ còn lại được khai trong `_con_ho`, không bị xoá khi đã bịt một phần', () => {
    /*
     * Bịt được một lớp không có nghĩa là chỗ đó đã kín. Xoá dòng `_con_ho` sau khi thêm lớp chặn là
     * cách để lần sau không ai biết kẽ nào vẫn còn.
     */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/exit_gates.json'), 'utf8'));
    const ho = String(cfg._con_ho['publish qua Drive MCP']);
    expect(ho).toContain('--for-publish');
    expect(ho, 'kẽ upload bản cũ phải còn được khai').toContain('KẼ CÒN LẠI');
  });

  test('mọi script ĐẨY RA NGOÀI đều đã có kiểm cửa, hoặc được khai là còn hở', () => {
    /*
     * Phép kiểm này là mẫu số của §B.3: nó liệt kê các script thật sự gọi ra ngoài rồi đòi mỗi cái
     * hoặc có kiểm cửa, hoặc có mặt trong `_con_ho` của config. Không có mục thứ ba.
     */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/exit_gates.json'), 'utf8'));
    const hoKhai = JSON.stringify(cfg._con_ho || {});
    const dayRaNgoai = [
      { f: 'scripts/integrations/backlog/bug_reporter.js', ten: 'log bug Backlog' },
    ];
    for (const d of dayRaNgoai) {
      const src = fs.readFileSync(path.join(REPO, d.f), 'utf8');
      const coKiem = /kiemDauVet/.test(src);
      expect(coKiem || hoKhai.includes(d.ten), `${d.f} vừa không kiểm cửa vừa không khai là còn hở`).toBe(true);
    }
    /* Đường publish qua Drive MCP không có script nào, nên nó PHẢI nằm trong `_con_ho`. */
    expect(hoKhai, 'publish qua MCP không chặn được bằng code — phải khai là còn hở').toContain('Drive MCP');
  });
});
