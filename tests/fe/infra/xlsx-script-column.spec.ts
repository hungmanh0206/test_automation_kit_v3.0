import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Cột SCRIPT trong bản xuất Excel — bố cục của bộ testcase BCX mà QA dùng ("Testcase BCX 2025.xlsx"):
 * case cần truy vấn SQL mang câu SQL ở cột SCRIPT, đứng ngay sau Expected Result.
 *
 * Chèn một cột vào giữa là đúng kiểu thay đổi làm lệch dropdown và công thức đếm nếu chúng đóng cứng chữ cái
 * (bố cục cũ neo Result ở cột L). Các phép kiểm dưới đây khoá ba điều: bố cục cũ KHÔNG đổi khi Markdown không
 * khai SCRIPT; khai SCRIPT thì header khớp thứ tự file mẫu; dropdown và COUNTIF đi theo cột Result mới.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');
const CONVERT = path.join(REPO, 'scripts', 'convert_excel', 'md_to_xlsx.js');

const COT = ['TC ID', 'Loại case', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Tiền điều kiện', 'Dữ liệu Test',
  'Các bước thực hiện', 'Kết quả mong đợi'];
const SQL = '-- Mã 33<br>DECLARE @MA_NAM_HOC INT = 2026;<br>SELECT COUNT(HS.ID) AS TONG FROM HOC_SINH HS';

function bang(coScript: boolean, haiBang = false): string {
  const cot = coScript ? [...COT, 'SCRIPT', 'Ưu tiên'] : [...COT, 'Ưu tiên'];
  const dau = `| ${cot.join(' | ')} |\n|${cot.map(() => '---').join('|')}|\n`;
  const o = ['APP_TC_001', 'Database', '[Positive][Calc][EP]', 'Học sinh / Tab Học sinh', 'Tab Học sinh - Đọc mã 33 - khớp SQL',
    '[pre_existing] Trường test có dữ liệu', 'năm học 2026', '1. Mở màn<br>2. Đọc mã 33', '1. Màn mở<br>2. Mã 33 = kết quả SQL'];
  const dong = coScript ? [...o, SQL, 'High'] : [...o, 'High'];
  let md = `# TC\n\n${dau}| ${dong.join(' | ')} |\n`;
  if (haiBang) {
    const cot2 = [...COT, 'Ưu tiên'];
    const o2 = ['APP_TC_002', ...o.slice(1, 9), 'Medium'];
    md += `\n| ${cot2.join(' | ')} |\n|${cot2.map(() => '---').join('|')}|\n| ${o2.join(' | ')} |\n`;
  }
  return md;
}

async function xuat(md: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-script-'));
  const f = path.join(dir, 'tc.md');
  const out = path.join(dir, 'out.xlsx');
  fs.writeFileSync(f, md, 'utf8');
  const r = spawnSync(process.execPath, [CONVERT, f, out], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  expect(r.status, `convert phải thành công:\n${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(out);
  const ws = wb.worksheets.find((w: any) => String(w.getRow(5).getCell(1).value) === 'ID_TC');
  const header: string[] = [];
  for (let i = 1; i <= 25; i += 1) { const v = ws.getRow(5).getCell(i).value; if (v) header.push(String(v)); }
  const chu = (ten: string) => String.fromCharCode(64 + header.indexOf(ten) + 1);
  return { ws, header, chu };
}

test.describe('@infra cột SCRIPT trong bản xuất Excel', () => {
  test('không khai SCRIPT thì bố cục cũ giữ nguyên: Result ở cột L', async () => {
    const { ws, header, chu } = await xuat(bang(false));
    expect(header).not.toContain('SCRIPT');
    expect(chu('Result')).toBe('L');
    expect(ws.getCell('D4').value.formula).toContain('$L$7:$L$500');
  });

  test('khai SCRIPT thì header khớp thứ tự file mẫu BCX, SCRIPT ngay sau Expected Result', async () => {
    const { header } = await xuat(bang(true));
    expect(header.slice(0, 17)).toEqual(['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps',
      'Expected Result', 'SCRIPT', 'Test Type', 'Priority', 'Test Level', 'Actor / Role', 'Result', 'Note',
      'Test Objective', 'Technique', 'REQ ID']);
  });

  test('câu SQL giữ nguyên xuống dòng, dropdown và COUNTIF đi theo cột Result mới', async () => {
    const { ws, header, chu } = await xuat(bang(true));
    const iScript = header.indexOf('SCRIPT') + 1;
    expect(String(ws.getRow(7).getCell(iScript).value)).toContain('DECLARE @MA_NAM_HOC INT = 2026;\nSELECT');
    expect(chu('Result')).toBe('M');
    expect(ws.getCell('D4').value.formula).toContain('$M$7:$M$500');
    expect(String(ws.getRow(7).getCell(header.indexOf('Result') + 1).dataValidation.formulae[0])).toContain('Pass');
    expect(String(ws.getRow(7).getCell(header.indexOf('Priority') + 1).value)).toBe('High');
  });

  test('gate soi cả cột SCRIPT: câu GHI bị CHẶN, SELECT ở SCRIPT thoả case [DbPersist]', () => {
    const GATE = path.join(REPO, 'scripts', 'qa', 'output_gate.js');
    const chay = (sql: string, tag: string) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-script-'));
      const f = path.join(dir, 'tc.md');
      const md = bang(true).replace(SQL, sql).replace('[Positive][Calc][EP]', tag);
      fs.writeFileSync(f, md, 'utf8');
      const r = spawnSync(process.execPath, [GATE, '--mode', 'gen-testcase', '--file', f], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
      return `${r.stdout || ''}${r.stderr || ''}`;
    };
    const ghi = chay('UPDATE HOC_SINH SET MA_KHOI = 01 WHERE ID = 1', '[Positive][Calc][EP]');
    expect(ghi).toMatch(/"SCRIPT" có câu SQL GHI/);
    const doc = chay('SELECT COUNT(1) FROM HOC_SINH', '[Positive][DbPersist][EP]');
    expect(doc).not.toMatch(/\[DbPersist\]` nhưng không có câu `SELECT`/);
  });

  test('hai bảng, chỉ một bảng khai SCRIPT: dòng của bảng kia không lệch cột', async () => {
    const { ws, header } = await xuat(bang(true, true));
    const iPrio = header.indexOf('Priority') + 1;
    const giaTri = [7, 8].map((r) => String(ws.getRow(r).getCell(iPrio).value));
    expect(giaTri.sort()).toEqual(['High', 'Medium']);
  });
});
