/**
 * agent:scorecard — đo lợi thế vận hành của agent theo TỪNG TASK (11/11/2026).
 *
 * Người review (P1): "thời gian hoàn thành, tỷ lệ tự khắc phục, số lần phải hỏi QA, mức độ chính xác và chi
 * phí trên mỗi verdict được xác minh". Bốn lần sửa trên dữ liệu thật trước khi số đáng tin, mỗi lần thành một ca:
 *   · "812 lượt người dùng" cho một task — đếm cả `<task-notification>`, `<ide_opened_file>`, tóm tắt nối phiên;
 *   · lệnh PHÂN TÍCH `tc_semantic --task X` thành mốc task ⇒ 30 phút sửa kit bị tính vào task X;
 *   · FAIL→PASS bị tính "tự khắc phục" trong khi có thể là DEV sửa bug — `doiVerdict` không lưu tầng lỗi cũ;
 *   · token cộng gộp `cache_read` với input mới — giá khác nhau cả bậc.
 * Transcript ở đây TỔNG HỢP, không đọc transcript thật (chứa nội dung phiên).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sc = require(path.join(REPO, 'scripts/qa/agent_scorecard.js'));

const T0 = Date.parse('2026-11-11T08:00:00Z');
const luc = (phut: number) => new Date(T0 + phut * 60000).toISOString();
const dung = (ndung: Record<string, number>) => ({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20, ...ndung });
const tro = (phut: number, tool?: { name: string; input: unknown }) => ({ type: 'assistant', timestamp: luc(phut),
  message: { usage: dung({}), content: tool ? [{ type: 'tool_use', id: `t${phut}`, name: tool.name, input: tool.input }] : [{ type: 'text', text: 'x' }] } });
const nguoi = (phut: number, text: string, them: Record<string, unknown> = {}) => ({ type: 'user', timestamp: luc(phut), message: { content: [{ type: 'text', text }] }, ...them });

async function doTranscript(dong: unknown[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'scorecard-'));
  const f = path.join(d, 's.jsonl');
  fs.writeFileSync(f, dong.map((x) => JSON.stringify(x)).join('\n'));
  const r = await sc.doPhien(f, sc.mauKey(['T1', 'T2']));
  fs.rmSync(d, { recursive: true, force: true });
  return r;
}

const PHIEN = [
  tro(0, { name: 'Write', input: { file_path: 'outputs/X/tasks/T1/test-cases/a.md', content: 'x' } }), // mốc T1
  nguoi(2, 'ok tiếp đi'),                                                                              // người thật
  nguoi(3, '<task-notification>xong</task-notification>'),                                             // máy gửi
  nguoi(3.5, '<ide_opened_file>a.ts</ide_opened_file>'),                                               // máy gửi
  nguoi(3.8, 'đồng ý', { isMeta: true }),                                                              // máy gửi
  tro(4, { name: 'AskUserQuestion', input: { questions: [] } }),                                       // câu hỏi chặn
  tro(5, { name: 'Bash', input: { command: 'node scripts/qa/tc_semantic.js --task T2' } }),            // KHÔNG phải mốc
  tro(40),                                                                                             // quá 30' sau mốc ⇒ không gán
  tro(41, { name: 'Bash', input: { command: 'cd outputs/X/tasks/T2/automation && bash ./chay.sh GDTX x' } }), // mốc T2
  tro(70),                                                                                             // 29' lặng ⇒ trần 10'
];

test.describe('@infra agent:scorecard — gán sự kiện vào task', () => {
  test('mốc T1 từ GHI vào thư mục task; tin nhắn sau đó thuộc T1', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.theoTask.T1.tinNhan).toBe(3);
  });

  test('lệnh PHÂN TÍCH `--task T2` KHÔNG thành mốc — sửa kit không bị tính vào task', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.theoTask.T2.tinNhan, 'T2 chỉ có tin từ lúc chạy chay.sh của nó').toBe(2);
  });

  test('quá 30 phút không mốc mới ⇒ "không gán", và phần đó được ĐẾM ra', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.khongGan.tinNhan).toBe(1);
  });

  test('chỉ đếm người THẬT: bỏ `<task-notification>`, `<ide_opened_file>`, `isMeta`', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.theoTask.T1.luotNguoi).toBe(1);
  });

  test('câu hỏi chặn = lời gọi AskUserQuestion', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.theoTask.T1.hoi).toBe(1);
  });

  test('khoảng lặng bị TRẦN 10 phút — người rời máy không tính là agent làm', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.theoTask.T2.phut, 'T2: một khoảng 29 phút ⇒ tính 10').toBeCloseTo(10, 5);
    expect(r.theoTask.T1.phut, 'T1: 2 + 1 + 0,5 + 0,3 + 0,2 + 1 phút').toBeCloseTo(5, 5);
  });

  test('token tách BA loại — đọc cache không cộng với input mới', async () => {
    const r = await doTranscript(PHIEN);
    expect(r.theoTask.T1).toMatchObject({ tokIn: 30, tokOut: 15, tokCacheDoc: 300, tokCacheGhi: 60 });
  });
});

test.describe('@infra agent:scorecard — sổ execute và sổ kết cục', () => {
  const ANH = ['a/step-01-passed.png'];
  const BUOC = [{ name: 'b', status: 'PASSED', evidence: ANH }];
  const cm = 'Lưới 38 dòng khớp SQL theo đặc tả; mã 112 đúng';
  let goc = '';
  test.beforeAll(() => {
    goc = fs.mkdtempSync(path.join(os.tmpdir(), 'scorecard-out-'));
    const tr = path.join(goc, 'tasks', 'T1', 'test-results');
    fs.mkdirSync(tr, { recursive: true });
    fs.writeFileSync(path.join(tr, 'testcase-status.json'), JSON.stringify({ tests: [
      { tcId: 'T1_TC_001', status: 'PASSED', comment: cm, evidence: ANH, steps: BUOC },
      { tcId: 'T1_TC_002', status: 'PASSED', comment: cm, evidence: ANH, steps: [] },
      { tcId: 'T1_TC_003', status: 'PASSED', comment: cm, evidence: ANH, steps: BUOC, doiVerdict: { tu: 'BLOCKED_SETUP', sang: 'PASSED' } },
      { tcId: 'T1_TC_004', status: 'PASSED', comment: cm, evidence: ANH, steps: BUOC, doiVerdict: { tu: 'FAILED', sang: 'PASSED', specDoi: false } },
      { tcId: 'T1_TC_005', status: 'PASSED', comment: cm, evidence: ANH, steps: BUOC, doiVerdict: { tu: 'FAILED', sang: 'PASSED', specDoi: true } },
      { tcId: 'T1_TC_006', status: 'BLOCKED_SETUP', comment: 'thiếu tài khoản cấp Sở', evidence: ANH, steps: [] },
    ] }));
    const bc = path.join(goc, 'tasks', 'T1', 'reports', 'bug-claims');
    fs.mkdirSync(bc, { recursive: true });
    fs.writeFileSync(path.join(bc, 'a.json'), JSON.stringify({ status: 'logged', ket_cuc: { nhan: 'rejected', nguon: 'DEV' } }));
    fs.writeFileSync(path.join(bc, 'b.json'), JSON.stringify({ status: 'logged', ket_cuc: { nhan: 'accepted', nguon: 'DEV' } }));
    fs.writeFileSync(path.join(bc, 'c.json'), JSON.stringify({ status: 'logged' }));
    fs.writeFileSync(path.join(bc, 'd.json'), JSON.stringify({ status: 'withdrawn' }));
  });
  test.afterAll(() => { fs.rmSync(goc, { recursive: true, force: true }); });

  test('verdict XÁC MINH cần step + ảnh: case PASS không step không được tính', () => {
    const ex = sc.soExecute(goc, 'T1');
    expect(ex.daChay).toBe(5);
    expect(ex.xacMinh).toBe(4);
  });

  test('tự khắc phục: BLOCKED→PASS và FAIL→PASS có sửa spec; FAIL→PASS KHÔNG sửa spec để riêng', () => {
    const ex = sc.soExecute(goc, 'T1');
    expect(ex.tungChuaKetLuan).toBe(2);
    expect(ex.daKhacPhuc).toBe(2);
    expect(ex.khongRoNguyenNhan, 'có thể là DEV sửa bug — máy không gán nguyên nhân nó không đo được').toBe(1);
    expect(ex.conChuaKetLuan).toBe(1);
  });

  test('độ chính xác chỉ tính trên claim CÓ NHÃN; tự rút đếm riêng', () => {
    expect(sc.soKetCuc(goc, 'T1')).toEqual({ claim: 4, tuRut: 1, daLog: 3, coNhan: 2, sai: 1 });
  });
});

test.describe('@infra agent:scorecard — "không phán được" không phải 0', () => {
  test('không có thư mục tasks ⇒ exit 2', () => {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/agent_scorecard.js'), '--project-output', 'khong-co-thu-muc-nay'],
      { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/KHÔNG PHÁN ĐƯỢC/);
  });
});
