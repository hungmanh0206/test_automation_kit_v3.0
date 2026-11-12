/**
 * bug:tac-gia — tách tỉ lệ bug sai theo ai tạo bug: agent · người chạy script · KHÔNG RÕ.
 *
 * Ca quan trọng nhất là ĐỐI CHỨNG ÂM "đọc báo cáo không phải tạo bug": bản đầu khớp mọi kết quả tool có dòng
 * "Created" và đếm 48/96 bug "do agent"; kiểm từng lệnh thì 45/50 mã đến từ agent `cat`/`grep` file
 * `backlog_bug_log.md`. Neo đúng là LỆNH TẠO ⇒ 17/96 (đo 12/11/2026).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { thuMucTam } from './_thu_muc_tam';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tg = require(path.join(REPO, 'scripts/qa/bug_tac_gia.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NHAN, SAI } = require(path.join(REPO, 'scripts/qa/bug_outcome.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { wilson } = require(path.join(REPO, 'scripts/qa/pass_audit.js'));

const BANG = (key: string) => `| TC ID | Backlog Issue | Status | URL |\n|---|---|---|---|\n| X_TC_001 | ${key} | Created | u |`;
/* Một cặp tool_use → tool_result như transcript thật của Claude Code. */
const cap = (id: string, command: string, ketQua: string) => [
  JSON.stringify({ timestamp: '2026-11-01T00:00:00Z', message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } }),
  JSON.stringify({ timestamp: '2026-11-01T00:00:01Z', message: { content: [{ type: 'tool_result', tool_use_id: id, content: ketQua }] } }),
];

test.describe('@infra bug:tac-gia — lệnh nào là lệnh TẠO', () => {
  test('ba dạng gọi được nhận; đọc mã nguồn, dry-run thì không', () => {
    for (const c of [
      'node scripts/integrations/backlog/bug_reporter.js --task T --run-id R',
      'TASK_KEY=T node scripts/integrations/backlog/tao_issue_con.js --parent P',
      'npm run backlog:bug-report -- --task T',
      'bash backlog.sh tao_issue_con --parent TASK-4008 --type Bug',
    ]) expect(tg.laLenhTao(c), c).toBe(true);
    for (const c of [
      'grep -n "argString" scripts/integrations/backlog/bug_reporter.js',
      'cat outputs/DEMO/tasks/T/reports/runs/R/backlog_bug_log.md',
      'node scripts/integrations/backlog/bug_reporter.js --dry-run',
      'npm run backlog:bug-report:dry-run -- --task T',
    ]) expect(tg.laLenhTao(c), c).toBe(false);
  });
});

test.describe('@infra bug:tac-gia — quét transcript', () => {
  test('ĐỐI CHỨNG ÂM: agent cat file báo cáo có dòng Created ⇒ KHÔNG phải agent tạo', async () => {
    const d = thuMucTam('tg-tr');
    fs.writeFileSync(path.join(d, 'a.jsonl'), [
      ...cap('t1', 'cat outputs/DEMO/tasks/T/reports/runs/R/backlog_bug_log.md', BANG('TASK-1')),
      ...cap('t2', 'node scripts/integrations/backlog/bug_reporter.js --task T', BANG('TASK-2')),
      ...cap('t3', 'node scripts/integrations/backlog/tao_issue_con.js --parent P', '[OK] đã tạo TASK-3 — u'),
      ...cap('t4', 'node scripts/integrations/backlog/bug_reporter.js --dry-run', BANG('TASK-4')),
    ].join('\n'));
    const r = await tg.quetTranscript(d);
    fs.rmSync(d, { recursive: true, force: true });
    expect(Object.keys(r).sort()).toEqual(['TASK-2', 'TASK-3']);
    expect(r['TASK-2'].qua).toBe('kết quả lệnh tạo');
  });

  test('kết quả chuyển vào file ⇒ đọc log của ĐÚNG lượt chạy lệnh tạo (RUN_ID trong lệnh)', async () => {
    const d = thuMucTam('tg-log');
    const log = path.join(d, 'tasks', 'T-9', 'reports', 'runs', 'R7', 'backlog_bug_log.md');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, BANG('TASK-77'));
    /* Đường Windows có `\` — `PROJECT_OUTPUT_DIR=` của lệnh thật mang dạng đó. */
    const po = d.replace(/\//g, '\\');
    fs.writeFileSync(path.join(d, 'b.jsonl'), cap('u1', `PROJECT_OUTPUT_DIR=${po} RUN_ID=R7 node scripts/integrations/backlog/bug_reporter.js --task T-9 > log.txt`, 'xong').join('\n'));
    const r = await tg.quetTranscript(d);
    fs.rmSync(d, { recursive: true, force: true });
    expect(r['TASK-77'] && r['TASK-77'].qua).toBe('log của lượt chạy');
  });
});

test.describe('@infra bug:tac-gia — sổ lúc tạo', () => {
  test('ghi cờ phiên agent từ CLAUDECODE; Backlog loopback (server giả của bộ test) ⇒ KHÔNG ghi', () => {
    const d = thuMucTam('tg-so');
    const f = path.join(d, 'so.jsonl');
    const cu = process.env.BUG_TAC_GIA_SO;
    process.env.BUG_TAC_GIA_SO = f;
    try {
      expect(tg.ghi({ issueKey: 'TASK-5', qua: 'x' }, { base: 'http://127.0.0.1:4321', env: { CLAUDECODE: '1' } })).toBe('bo-qua');
      expect(fs.existsSync(f), 'bug tạo trên server giả không phải bug thật').toBe(false);
      expect(tg.ghi({ issueKey: 'TASK-5', qua: 'x' }, { base: 'https://vd.backlog.com', env: { CLAUDECODE: '1' } })).toBe('da-ghi');
      expect(tg.ghi({ issueKey: 'TASK-6', qua: 'x' }, { base: 'https://vd.backlog.com', env: {} })).toBe('da-ghi');
      const so = tg.docSoTacGia(f);
      expect(so.get('TASK-5').phienAgent).toBe(true);
      expect(so.get('TASK-6').phienAgent).toBe(false);
    } finally {
      if (cu === undefined) delete process.env.BUG_TAC_GIA_SO; else process.env.BUG_TAC_GIA_SO = cu;
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('sổ hỏng KHÔNG làm hỏng lượt tạo bug — chỉ cảnh báo', () => {
    const d = thuMucTam('tg-hong');
    const cu = process.env.BUG_TAC_GIA_SO;
    process.env.BUG_TAC_GIA_SO = d; // là THƯ MỤC ⇒ appendFileSync ném
    try {
      expect(tg.ghi({ issueKey: 'TASK-5', qua: 'x' }, { base: 'https://vd.backlog.com' })).toBe('loi');
    } finally {
      if (cu === undefined) delete process.env.BUG_TAC_GIA_SO; else process.env.BUG_TAC_GIA_SO = cu;
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('cả hai script tạo bug đều gọi ghi(), kèm base để nhận ra server giả', () => {
    for (const f of ['scripts/integrations/backlog/bug_reporter.js', 'scripts/integrations/backlog/tao_issue_con.js']) {
      const s = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(s, f).toMatch(/bug_tac_gia\.js'\)\)\.ghi\(\{ issueKey: [^}]+\}, \{ base: /);
    }
  });
});

test.describe('@infra bug:tac-gia — xếp nhóm và tính', () => {
  test('sổ lúc tạo đi trước transcript; không có ở đâu ⇒ KHÔNG RÕ, không phải "người"', () => {
    const so = new Map([['A', { phienAgent: false }], ['B', { phienAgent: true }]]);
    const tr = { A: {}, C: {} };
    expect(tg.nhomCua('A', so, tr)).toBe('nguoi_qua_script');
    expect(tg.nhomCua('B', so, tr)).toBe('agent');
    expect(tg.nhomCua('C', so, tr)).toBe('agent');
    expect(tg.nhomCua('D', so, tr)).toBe('khong_ro');
  });

  test('tỉ lệ sai theo nhóm chỉ tính bug có nhãn', () => {
    const ketCuc = { issues: { A: { nhan: 'accepted' }, B: { nhan: 'rejected' }, C: { trangThai: 'Open' }, D: { nhan: 'by_design' } } };
    const k = tg.tinhTheoNhom(ketCuc, new Map(), { A: {}, B: {}, C: {} }, { NHAN, SAI }, wilson);
    expect([k.agent.tong, k.agent.coNhan, k.agent.sai]).toEqual([3, 2, 1]);
    expect(k.agent.tiLe).toBeCloseTo(0.5, 5);
    expect([k.khong_ro.tong, k.khong_ro.sai]).toEqual([1, 1]);
  });

  test('CLI: chưa có sổ kết cục ⇒ exit 2; hơn nửa không rõ ⇒ cảnh báo đừng kết luận', () => {
    const d = thuMucTam('tg-cli');
    const chay = (...a: string[]) => spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/bug_tac_gia.js'), ...a], { encoding: 'utf8', cwd: REPO, env: { ...gateEnv(), BUG_TAC_GIA_SO: path.join(d, 'so.jsonl') } });
    try {
      expect(chay('--ket-cuc', path.join(d, 'khong-co.json'), '--dem', path.join(d, 'dem.json')).status).toBe(2);
      fs.writeFileSync(path.join(d, 'kc.json'), JSON.stringify({ issues: { A: { nhan: 'accepted' }, B: { nhan: 'accepted' }, C: { nhan: 'rejected' } } }));
      fs.writeFileSync(path.join(d, 'dem.json'), JSON.stringify({ ma: { A: {} } }));
      const r = chay('--ket-cuc', path.join(d, 'kc.json'), '--dem', path.join(d, 'dem.json'));
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/agent\s+1 bug/);
      expect(r.stdout).toMatch(/KHÔNG RÕ\s+2 bug/);
      expect(r.stdout).toMatch(/"KHÔNG RÕ" không phải "người"/);
      expect(r.stdout).toMatch(/hơn nửa số bug chưa rõ tác giả/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
});
