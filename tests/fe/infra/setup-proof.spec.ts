/**
 * `setup:proof` — case GIẢ ĐỊNH một trạng thái thì lượt chạy có GHI LẠI việc kiểm trạng thái đó không?
 *
 * BỐI CẢNH. Vế còn lại của điều #2 chủ dự án nêu: *"chưa chứng minh Agent … dựng đúng state"*.
 *
 * HAI PHÉP ĐO ĐÃ BỊ BỎ, và chúng là lý do phép đo hiện tại có hình dạng này. Hướng đầu tiên là ĐỌC
 * SPEC — xem khối `beforeAll` có dựng và có nghiệm thu tiền đề không:
 *   · bản CHẶT (đòi `expect` ngay trong thân `beforeAll`) gắn cờ **267/303 case** của CSDL-4008. Tố
 *     oan: khối dựng gọi `damBaoDonVi()`, `bamLayDuLieu()` trong `lib/`, và helper mới là chỗ ném lỗi.
 *   · bản NỚI (đi theo đường nhập, chấp nhận `throw` ở bất kỳ lib nào) gắn cờ **0**. Vô nghĩa theo
 *     chiều ngược lại: gần như lib nào cũng có một `throw`.
 *   · bộ cắt khối còn cắt nhầm — `test.beforeAll(async ({ browser }) => {…})` thì `{` đầu tiên là
 *     THAM SỐ, không phải thân. Hai lượt đo đầu đo nhầm chỗ mà vẫn in ra số.
 *
 * 267 hay 0 tuỳ cách viết regex ⇒ phép đo đang đo chính regex. Trạng thái có thật lúc chạy hay không
 * là chuyện chỉ LƯỢT CHẠY biết, nên chỉ lượt chạy ghi được. Máy đo việc GHI LẠI.
 *
 * Ranh giới phải giữ: nó nói "không ai kiểm lại được tiền đề", KHÔNG nói "tiền đề đã sai". Mấy ca
 * dưới đây gác đúng ranh giới ấy — bỏ chúng đi là biến một lỗ hổng truy vết thành một lời buộc tội.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'setup_proof.js');

type Ca = { id: string; tienDeCell: string };
type Ghi = { steps: { name: string; tienDe?: boolean }[] };

/** Cây task tạm: bộ .md canonical + testcase-status.json. */
function cay(cases: Ca[], ghi: Record<string, Ghi>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'setupproof-'));
  const T = path.join(d, 'tasks', 'T1');
  fs.mkdirSync(path.join(T, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(T, 'test-results'), { recursive: true });

  const head = '| TC ID | Loại case | Module | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi |';
  const sep = '|---|---|---|---|---|---|';
  const rows = cases.map((c) => `| ${c.id} | UI | M | ${c.tienDeCell} | 1. bước | ok |`);
  fs.writeFileSync(path.join(T, 'test-cases', 'bo.md'), [head, sep, ...rows].join('\n'), 'utf8');

  const tests = Object.entries(ghi).map(([tcId, v]) => ({
    tcId,
    status: 'PASSED',
    comment: '',
    evidence: [],
    steps: v.steps.map((s) => ({ name: s.name, status: 'PASSED', comment: '', evidence: [], ...(s.tienDe ? { tienDe: true } : {}) })),
  }));
  fs.writeFileSync(path.join(T, 'test-results', 'testcase-status.json'), JSON.stringify({ tests }, null, 2), 'utf8');
  return d;
}

const chay = (goc: string, them: string[] = []) => {
  const r = spawnSync(process.execPath, [CUA, '--task', 'T1', '--goc', goc, ...them], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const doc = (goc: string) => JSON.parse(chay(goc, ['--json']).out);

const BUOC_THUONG = { steps: [{ name: 'mở màn' }, { name: 'bấm Ghi' }] };

test.describe('@infra setup:proof — bằng chứng tiền đề', () => {
  test('ĐỐI CHỨNG ÂM: có ghi bằng chứng tiền đề ⇒ đếm vào vế "có"', () => {
    const d = cay(
      [{ id: 'X_TC_001', tienDeCell: '[ui] Báo cáo ở trạng thái Chưa gửi' }],
      { X_TC_001: { steps: [{ name: 'TIỀN ĐỀ · Báo cáo ở trạng thái Chưa gửi', tienDe: true }, { name: 'bấm Ghi' }] } },
    );
    const j = doc(d);
    expect(j.co_ghi_tien_de).toBe(1);
    expect(j.khong_ghi).toBe(0);
    expect(j.ti_le_phan_tram).toBe(100);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: cùng case đó, BỎ bước tiền đề ⇒ con số dịch chuyển', () => {
    /* Đây là phép phá. Không có nó thì "100%" ở ca trên không chứng minh được máy đang ĐO, chứ không
     * phải đang đếm mọi case là đạt. */
    const d = cay(
      [{ id: 'X_TC_001', tienDeCell: '[ui] Báo cáo ở trạng thái Chưa gửi' }],
      { X_TC_001: BUOC_THUONG },
    );
    const j = doc(d);
    expect(j.co_ghi_tien_de).toBe(0);
    expect(j.khong_ghi).toBe(1);
    expect(j.ti_le_phan_tram).toBe(0);
    expect(chay(d).out).toContain('X_TC_001');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`pre_existing` và `manual` KHÔNG vào mẫu số — chúng không dựng gì', () => {
    /*
     * Nếu tính cả hai loại đó thì mẫu số phình lên và tỉ lệ tụt, trong khi không case nào trong đó
     * CÓ THỂ ghi bằng chứng dựng. Một mẫu số sai làm con số đúng trở thành câu sai.
     */
    const d = cay([
      { id: 'X_TC_001', tienDeCell: '[ui] trạng thái Chưa gửi' },
      { id: 'X_TC_002', tienDeCell: '[pre_existing] tài khoản đăng nhập được' },
      { id: 'X_TC_003', tienDeCell: '[manual] cần người thao tác' },
    ], { X_TC_001: BUOC_THUONG, X_TC_002: BUOC_THUONG, X_TC_003: BUOC_THUONG });
    const j = doc(d);
    expect(j.case_tong).toBe(3);
    expect(j.can_dung_tien_de, 'chỉ case [ui] mới cần dựng').toBe(1);
    expect(j.da_chay).toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('case CHƯA CHẠY không bị tính là "không ghi"', () => {
    /* Case chưa chạy thì không có gì để ghi. Gộp nó vào vế "không ghi" là đổ lỗi cho một lượt chạy
     * chưa xảy ra — và làm tỉ lệ tụt vì một lý do không liên quan. */
    const d = cay([
      { id: 'X_TC_001', tienDeCell: '[ui] trạng thái Chưa gửi' },
      { id: 'X_TC_002', tienDeCell: '[ui] trạng thái Đã gửi' },
    ], { X_TC_001: BUOC_THUONG });
    const j = doc(d);
    expect(j.can_dung_tien_de).toBe(2);
    expect(j.da_chay, 'chỉ case có trong sổ kết quả').toBe(1);
    expect(j.chua_chay).toBe(1);
    expect(j.khong_ghi).toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('nhận CẢ cờ `tienDe` lẫn tên bước quy ước — spec viết tay trước khi có API vẫn được tính', () => {
    const d = cay(
      [{ id: 'X_TC_001', tienDeCell: '[api] bản ghi đã tạo' }],
      { X_TC_001: { steps: [{ name: 'TIỀN ĐỀ · bản ghi đã tạo' }, { name: 'bấm Ghi' }] } },
    );
    expect(doc(d).co_ghi_tien_de, 'tên bước mang tiền tố quy ước là đủ').toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": thiếu sổ kết quả ⇒ exit 2', () => {
    const d = cay([{ id: 'X_TC_001', tienDeCell: '[ui] trạng thái Chưa gửi' }], {});
    fs.rmSync(path.join(d, 'tasks', 'T1', 'test-results', 'testcase-status.json'));
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('KHÔNG case nào khai tag method ⇒ exit 2, và nói rõ hai khả năng', () => {
    /*
     * Bộ case thiếu tag `[<method>]` trông y hệt bộ case chỉ dùng dữ liệu có sẵn. Im lặng cho qua ở
     * đây là biến "chưa khai" thành "không cần dựng".
     */
    const d = cay([{ id: 'X_TC_001', tienDeCell: 'tài khoản đăng nhập được' }], { X_TC_001: BUOC_THUONG });
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/thiếu tag/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('cửa TỰ NÓI giới hạn mỗi lượt — và nói rõ nó KHÔNG phán "dựng sai state"', () => {
    const d = cay([{ id: 'X_TC_001', tienDeCell: '[ui] trạng thái Chưa gửi' }], { X_TC_001: BUOC_THUONG });
    const out = chay(d).out;
    expect(out, 'phải nói đây là đo việc GHI LẠI').toMatch(/GHI LẠI/);
    expect(out, 'và nói rõ không có nghĩa tiền đề đã sai').toMatch(/KHÔNG có nghĩa là tiền đề đã sai/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('hai phép đo đã bỏ phải còn trong mã — xoá đi là mời người sau làm lại y hệt', () => {
    /*
     * 267 và 0 là hai con số đã trả giá để có. Không ghi lại thì lần sau ai đó sẽ lại viết một gate
     * đọc `beforeAll` và tin con số nó in ra.
     */
    const src = fs.readFileSync(CUA, 'utf8');
    expect(src).toContain('267');
    expect(src, 'và nói rõ vì sao bản nới cũng sai').toMatch(/gắn cờ \*\*0\*\*/);
    expect(src, 'phải nêu nguyên nhân: helper trong lib mới là chỗ ném lỗi').toMatch(/lib\//);
  });

  test('`EvidenceRecorder` có API `tienDe` — quy ước ở MỘT chỗ, không ở 33 spec', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'utils', 'evidence_recorder.js'), 'utf8');
    expect(src, 'thiếu API thì luật chỉ còn là lời dặn').toMatch(/async tienDe\s*\(/);
    expect(src, 'bước tiền đề phải mang cờ để máy đọc được').toMatch(/tienDe: true/);
    expect(src, 'và phải nói rõ nó KHÔNG tự chấm case').toMatch(/KHÔNG tự chấm case/);
  });
});
