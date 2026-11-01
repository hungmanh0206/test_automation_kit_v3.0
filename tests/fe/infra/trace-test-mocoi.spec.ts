/*
 * `trace:matrix` — chiều NGƯỢC: test đã chạy mà KHÔNG TC nào nhận (v2.9.6 N2.3).
 *
 * Bảng chính đi một chiều (TC canonical → đã execute chưa) nên bỏ lọt loại khó thấy nhất: một lượt chạy
 * GHI VERDICT cho một mã mà bộ case không có dòng nào nhận.
 *
 * Phép kiểm then chốt ở file này KHÔNG phải "có đếm được không" mà là **"có phân loại đúng không"**.
 * Phần lớn ca mồ côi là mở rộng §7, vốn đúng thiết kế là không có dòng canonical — nên một con số trần
 * sẽ chôn ca đáng lo dưới đống đúng-thiết-kế. Số đo 30/10/2026 trên CSDL-9004: 8/256, gồm 7 ca mở rộng
 * KHÔNG neo (5 FAILED) + 1 recon mang verdict, trong khi 6 ca mở rộng khác CÓ neo.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/traceability_matrix.js');

type Tc = { tcId: string; status: string; comment?: string; oracleRef?: string };

/** Dựng một task giả: bộ case canonical (bảng .md) + sổ verdict. */
function dungTask(canon: string[], ghi: Tc[], claims: Record<string, unknown> = {}) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'mocoi-'));
  const T = path.join(goc, 'tasks', 'T-1');
  fs.mkdirSync(path.join(T, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(T, 'test-results'), { recursive: true });
  fs.mkdirSync(path.join(T, 'reports'), { recursive: true });

  /*
   * Bảng phải đúng khuôn 11 cột mà `testcaseModel.parseMarkdown` đọc — KHÔNG phải một bảng tôi tự nghĩ ra.
   * Bản đầu của fixture này dùng bảng 9 cột tự đặt, nên bộ phân tích đọc ra 0 TC và MỌI ca kiểm rơi vào
   * nhánh "KHÔNG phán được". Bốn ca báo đỏ mà chẳng ca nào đang kiểm điều nó nói là đang kiểm.
   */
  const COT = '| TC ID | Loại case | Tag | Áp dụng cho cấp | Module | Trường hợp kiểm thử '
    + '| Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
  const dong = canon.map((id) => `| ${id} | UI | [Positive] | THCS | Module A | kiểm một thứ `
    + `| [manual] đã đăng nhập | không cần | 1. mở màn | 1. thấy nhãn đúng | High |`);
  fs.writeFileSync(path.join(T, 'test-cases', 'bo-case.md'),
    ['# T-1 — Testcase giả cho phép kiểm', '', COT, `|${'---|'.repeat(11)}`, ...dong].join('\n'), 'utf8');
  fs.writeFileSync(path.join(T, 'test-results', 'testcase-status.json'),
    JSON.stringify({ taskKey: 'T-1', tests: ghi }, null, 2), 'utf8');
  if (Object.keys(claims).length) {
    const cd = path.join(T, 'reports', 'bug-claims');
    fs.mkdirSync(cd, { recursive: true });
    for (const [id, claim] of Object.entries(claims)) {
      fs.writeFileSync(path.join(cd, `${id}.json`), JSON.stringify(claim, null, 2), 'utf8');
    }
  }
  return { goc, T };
}

function chay(goc: string) {
  const r = spawnSync(process.execPath, [GATE], {
    cwd: REPO, encoding: 'utf8',
    env: { ...gateEnv(), TASK_KEY: 'T-1', PROJECT_OUTPUT_DIR: goc },
  });
  let pm = '';
  try { pm = fs.readFileSync(path.join(goc, 'tasks/T-1/reports/traceability-pm.md'), 'utf8'); } catch { /* chưa sinh */ }
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, pm };
}
/** Cắt đúng mục mồ côi, để khẳng định không ăn nhầm chữ ở mục khác. */
const muc = (pm: string) => {
  const i = pm.indexOf('## Test đã chạy mà KHÔNG TC nào nhận');
  const j = pm.indexOf('Mẫu số của bảng này', i < 0 ? 0 : i);
  return i < 0 ? '' : pm.slice(i, j < 0 ? pm.length : j);
};

test.describe('@infra trace:matrix — test mồ côi phải được PHÂN LOẠI, không chỉ đếm', () => {
  test('ĐỐI CHỨNG ÂM: mọi tcId đều có dòng canonical ⇒ nói SẠCH, kèm mẫu số', () => {
    const k = dungTask(['A_TC_001', 'A_TC_002'], [
      { tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'A_TC_002', status: 'FAIL' },
    ]);
    const m = muc(chay(k.goc).pm);
    expect(m, 'phải nói rõ đã đối chiếu bao nhiêu').toMatch(/Mọi 2 tcId trong sổ verdict đều có dòng/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: mở rộng mang FAIL mà KHÔNG neo ⇒ nêu tên + đòi hạ về OBSERVATION', () => {
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'EXPANSION_O_KHOA', status: 'FAILED', comment: '- ô khoá vẫn ghi đè được' },
    ]);
    const m = muc(chay(k.goc).pm);
    expect(m).toContain('EXPANSION_O_KHOA');
    expect(m).toMatch(/mở rộng KHÔNG có neo oracle/);
    expect(m, 'phải nói việc cần làm, không chỉ nói sai').toMatch(/hạ về `OBSERVATION`/);
    expect(m).toMatch(/\*\*1 ca MỞ RỘNG mang PASS\/FAIL mà KHÔNG có neo oracle\*\*/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: mở rộng CÓ neo oracle ⇒ KHÔNG bị nêu, và được đếm riêng', () => {
    /*
     * Chiều này là chiều quan trọng nhất của phép kiểm neo: nếu nó kêu cả ca có neo thì người dùng sẽ
     * học cách bỏ qua mục này, và lúc đó mục này không gác gì nữa. Trên dữ liệu thật có 6 ca CÓ neo.
     */
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'EXPANSION_CO_NEO', status: 'FAILED', comment: '- lệch so với BR-HS-014 (mục 3)' },
      { tcId: 'EXPANSION_NEO_O_TRUONG', status: 'PASSED', oracleRef: 'SM-LOP-02' },
    ]);
    const m = muc(chay(k.goc).pm);
    expect(m, 'ca có neo trong comment KHÔNG được nêu').not.toContain('EXPANSION_CO_NEO');
    expect(m, 'ca khai neo ở trường riêng cũng KHÔNG được nêu').not.toContain('EXPANSION_NEO_O_TRUONG');
    /*
     * VÀ KHÔNG ĐƯỢC NÓI "mọi tcId đều có dòng canonical" — đó là câu SAI ở đây: có 2 ca mồ côi, chúng
     * chỉ không phải LỖI. Nói sai theo chiều này làm người đọc tưởng phép kiểm neo chưa chạy.
     */
    expect(m, 'phải đếm số ca CÓ neo, để người đọc biết phép kiểm đã chạy').toMatch(/2 ca mở rộng CÓ neo oracle/);
    expect(m).toMatch(/2\/3 tcId không có dòng canonical, nhưng \*\*không ca nào là lỗi\*\*/);
    expect(m, 'phải phân biệt "đã kiểm và sạch" với "không có gì để kiểm"')
      .toMatch(/khác hẳn "không có gì để kiểm"/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('mở rộng khai OBSERVATION ⇒ ĐÚNG LUẬT, không bị nêu', () => {
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'EXPANSION_KHONG_NEO', status: 'OBSERVATION', comment: '- thấy vậy nhưng không có neo' },
    ]);
    const m = muc(chay(k.goc).pm);
    expect(m, 'OBSERVATION là đúng cách khai khi không có neo').not.toContain('EXPANSION_KHONG_NEO');
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: probe mang verdict ⇒ CHẶN; probe không verdict ⇒ im', () => {
    const co = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'PROBE_DONVI', status: 'PASSED' },
    ]);
    expect(muc(chay(co.goc).pm)).toMatch(/PROBE_DONVI.*probe\/recon mang verdict/);
    fs.rmSync(co.goc, { recursive: true, force: true });

    const khong = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'PROBE_DONVI', status: 'TODO' },
    ]);
    expect(muc(chay(khong.goc).pm), 'probe không phán gì thì không có gì để nói').not.toContain('PROBE_DONVI');
    fs.rmSync(khong.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG TỔNG HỢP: mã MẠO DANH khuôn canonical ⇒ nêu', () => {
    /*
     * Loại này đo được 0 ca trên dữ liệu thật, nên nó CHỈ có đối chứng tổng hợp — và phải nói ra thế.
     * Phép đo nháp của tôi từng báo 2 ca (`CSDL_HSTRUONG_TC_127B`, `TC_161B`) vì regex nháp đòi hậu tố
     * chữ THƯỜNG nên trượt chữ `B` hoa; hai mã đó CÓ trong canonical. Bộ phân tích thật đọc đúng.
     */
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'A_TC_999', status: 'FAILED' },
    ]);
    const m = muc(chay(k.goc).pm);
    expect(m).toMatch(/A_TC_999.*MẠO DANH/);
    expect(m, 'hậu tố CHỮ HOA vẫn phải nhận ra là khuôn canonical').toBeTruthy();
    fs.rmSync(k.goc, { recursive: true, force: true });

    /* Và hậu tố chữ hoa CÓ trong canonical thì KHÔNG được coi là mạo danh — đúng cú mà tôi đã cắn. */
    const b = dungTask(['A_TC_127B'], [{ tcId: 'A_TC_127B', status: 'PASS' }]);
    expect(muc(chay(b.goc).pm)).toMatch(/Mọi 1 tcId trong sổ verdict đều có dòng/);
    fs.rmSync(b.goc, { recursive: true, force: true });
  });

  test('"KHÔNG phán được" KHÔNG thành "sạch": 0 TC canonical ⇒ nói rõ', () => {
    const k = dungTask([], [{ tcId: 'A_TC_001', status: 'FAIL' }]);
    const m = muc(chay(k.goc).pm);
    expect(m).toMatch(/KHÔNG phán được/);
    expect(m, 'phải nói thẳng đây không phải sạch').toMatch(/không phải "sạch"/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });
});

/*
 * NEO NẰM TRONG BUG CLAIM — và bỏ sót chỗ này làm cửa báo oan 5/9 ca.
 *
 * Bản đầu chỉ soi sổ verdict. Nhưng kit có cơ chế riêng cho đúng việc neo một phát hiện: bug claim ở
 * `reports/bug-claims/<tcId>.json`, mang `oracle: { type, ref, quote }`. Đo 30/10/2026: CSDL-9004 có
 * 22/22 claim CÓ `oracle.ref`, CSDL-9001 41/41, CSDL-4008 34/43 — và **5 trong 9** ca mà cửa báo "mở
 * rộng không có neo" ĐÃ CÓ claim kèm neo. Cửa đang đòi một thứ đã có, chỉ nằm chỗ khác.
 *
 * Sau khi tra claim: 11 ca bị chặn còn 6 — và cả 6 đều là `PASSED` không neo, tức hạ về `OBSERVATION`
 * không chôn mất phát hiện nào. Năm ca `FAILED` thì giữ nguyên verdict, vì chúng neo đúng.
 */
test.describe('@infra trace:matrix — bug claim cũng là NEO', () => {
  const NEO = {
    tc_id: 'EXPANSION_O_KHOA', status: 'claimed',
    oracle: { type: 'UI', ref: 'CSDL-3760 (ô khoá form Sửa)', quote: 'Ô khoá thì server phải từ chối ghi.' },
  };

  test('ĐỐI CHỨNG ÂM: không neo trong sổ nhưng CÓ claim mang `oracle.ref` ⇒ KHÔNG bị nêu', () => {
    const k = dungTask(['A_TC_001'],
      [{ tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'EXPANSION_O_KHOA', status: 'FAILED' }],
      { EXPANSION_O_KHOA: NEO });
    const m = muc(chay(k.goc).pm);
    expect(m, 'claim mang neo thì KHÔNG được đòi neo lần nữa').not.toContain('EXPANSION_O_KHOA');
    expect(m).toMatch(/1 ca mở rộng CÓ neo oracle/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: claim ĐÃ RÚT ⇒ KHÔNG tính là neo, vẫn bị nêu', () => {
    /*
     * `status: 'withdrawn'` nghĩa là chính người khai đã bỏ lời khẳng định. Tính nó là neo thì một claim
     * rút rồi vẫn giữ verdict đứng — đúng kiểu `bug_claim.js` đang gác ở chiều khác.
     */
    const k = dungTask(['A_TC_001'],
      [{ tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'EXPANSION_O_KHOA', status: 'FAILED' }],
      { EXPANSION_O_KHOA: { ...NEO, status: 'withdrawn' } });
    const m = muc(chay(k.goc).pm);
    expect(m).toContain('EXPANSION_O_KHOA');
    expect(m).toMatch(/mở rộng KHÔNG có neo oracle/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: claim CÓ mà THIẾU `oracle.ref` ⇒ vẫn bị nêu', () => {
    /* "Có claim" chưa phải "có neo" — claim không nêu được nguồn kỳ vọng thì nó chỉ là một lời kể. */
    const k = dungTask(['A_TC_001'],
      [{ tcId: 'A_TC_001', status: 'PASS' }, { tcId: 'EXPANSION_O_KHOA', status: 'FAILED' }],
      { EXPANSION_O_KHOA: { tc_id: 'EXPANSION_O_KHOA', status: 'claimed', summary: 'ô khoá ghi đè được' } });
    const m = muc(chay(k.goc).pm);
    expect(m).toContain('EXPANSION_O_KHOA');
    fs.rmSync(k.goc, { recursive: true, force: true });
  });
});
