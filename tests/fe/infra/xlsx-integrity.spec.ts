import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import JSZip from 'jszip';
import { gateEnv } from './_gate_env';

/*
 * Gate TOÀN VẸN FILE .xlsx — file xuất ra phải MỞ ĐƯỢC bằng Excel, không hiện hộp thoại
 * "We found a problem with some content in '<file>'. Do you want us to try to recover…".
 *
 * VÌ SAO CÓ FILE NÀY (đo 25/09/2026, bug do người dùng phát hiện khi mở file — không gate nào bắt):
 * `md_to_xlsx.js` gán dropdown cho từng ô từ dòng 7 tới 500. ExcelJS gom các ô giống nhau lại thành vùng
 * ở `lib/xlsx/xform/sheet/data-validations-xform.js` → `optimiseDataValidations()`, nhưng nó sort địa chỉ
 * bằng SO SÁNH CHUỖI nên `"H10" < "H7"`: gom từ H10 xuống H500 ra `H10:H500`, rồi tới H7 lại gom xuống
 * H500 ra `H7:H500` ⇒ HAI vùng CHỒNG NHAU cho cùng một rule. Excel coi đó là nội dung hỏng và bắt Repair.
 * Mọi file kit từng xuất đều dính, vì dải dropdown luôn lẫn hàng 1 chữ số với hàng nhiều chữ số.
 *
 * Hai phép kiểm dưới đây soi THẲNG vào XML trong file zip, không qua ExcelJS — vì chính ExcelJS đọc lại
 * file hỏng của nó vẫn thấy bình thường, nên kiểm bằng ExcelJS là tự mình che mắt mình.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJSLib = require('exceljs');
/** File .md nguồn nằm cùng thư mục tạm với .xlsx mà buildXlsx*() vừa sinh. */
const mdOf = (xlsxPath: string) => path.join(path.dirname(xlsxPath), 'tc.md');
const CONVERT = path.join(REPO, 'scripts', 'convert_excel', 'md_to_xlsx.js');

const HEADER =
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |\n' +
  '|---|---|---|---|---|---|---|---|---|---|\n';

/** Một case có cột `Kết quả mong đợi` dài, để ép row height chạm trần. */
const LONG = 'x'.repeat(900);
const ROW =
  `| APP_TC_001 | UI | [Positive][Display] | Xem danh sách / Lưới đơn | Lưới đơn - Mở màn - Hiện đủ 3 cột | ` +
  `[ui] Đã đăng nhập OPS, ở màn Danh sách đơn | - | 1. Mở màn Danh sách đơn | ` +
  `1. Lưới hiện đúng 3 cột "Mã đơn" / "Khách hàng" / "Tổng tiền"<br>- ${LONG} | Critical |`;

function buildXlsx(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-integrity-'));
  const md = path.join(dir, 'tc.md');
  const out = path.join(dir, 'out.xlsx');
  fs.writeFileSync(md, `# TC\n\n${HEADER}${ROW}\n`, 'utf8');
  const r = spawnSync(process.execPath, [CONVERT, md, out], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  expect(r.status, `convert phải thành công:\n${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  expect(fs.existsSync(out), 'convert phải sinh ra file .xlsx').toBe(true);
  return out;
}

async function sheetXmls(xlsxPath: string): Promise<Array<{ name: string; xml: string }>> {
  const zip = await JSZip.loadAsync(fs.readFileSync(xlsxPath));
  const names = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  return Promise.all(names.map(async (name) => ({ name, xml: await zip.file(name)!.async('string') })));
}

const HEADER_5CAP =
  '| TC ID | Loại case | Tag | Áp dụng cho cấp | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |\n' +
  '|---|---|---|---|---|---|---|---|---|---|---|\n';

const ROW_5CAP =
  '| APP_TC_001 | UI | [Positive][Display] | MN, TH | Xem danh sách / Lưới đơn | Lưới đơn - Mở màn - Hiện đủ 3 cột | ' +
  '[ui] Đã đăng nhập OPS, ở màn Danh sách đơn | - | 1. Mở màn Danh sách đơn | ' +
  '1. Lưới hiện đúng 3 cột "Mã đơn" / "Khách hàng" / "Tổng tiền" | Critical |';

/** Bố cục 24 cột (bộ chuẩn 5 cấp): khối Result trải N..R chứ không nằm ở một cột L duy nhất. */
function buildXlsx5cap(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-5cap-'));
  const md = path.join(dir, 'tc.md');
  const out = path.join(dir, 'out.xlsx');
  fs.writeFileSync(md, `# TC\n\n${HEADER_5CAP}${ROW_5CAP}\n`, 'utf8');
  const r = spawnSync(process.execPath, [CONVERT, md, out], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  expect(r.status, `convert phải thành công:\n${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  return out;
}

/** Đọc công thức của một ô trên sheet dashboard, qua XML thô. */
async function dashFormula(xlsxPath: string, ref: string): Promise<string> {
  const zip = await JSZip.loadAsync(fs.readFileSync(xlsxPath));
  // Dashboard luôn là sheet ĐẦU TIÊN được add ⇒ sheet1.xml.
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  const m = xml.match(new RegExp(`<c r="${ref}"[^>]*>([\\s\\S]*?)</c>`));
  const f = m && m[1].match(/<f>([\s\S]*?)<\/f>/);
  return f ? f[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
}

/**
 * Công thức Excel có cân dấu nháy kép và ngoặc đơn không. Duyệt theo ký tự vì ngoặc nằm TRONG
 * chuỗi (ví dụ COUNTIF(...,"?*")) không được tính.
 */
function lechCongThuc(f: string): string | null {
  let trongChuoi = false;
  let ngoac = 0;
  let nhay = 0;
  for (const c of f) {
    if (c === '"') {
      nhay++;
      trongChuoi = !trongChuoi;
      continue;
    }
    if (trongChuoi) continue;
    if (c === '(') ngoac++;
    if (c === ')') ngoac--;
    if (ngoac < 0) return 'thừa dấu )';
  }
  if (nhay % 2 !== 0) return `lẻ dấu nháy kép (${nhay} dấu)`;
  if (ngoac !== 0) return `còn ${ngoac} dấu ( chưa đóng`;
  return null;
}

/** Mọi công thức trong file, kèm địa chỉ ô, đọc thẳng từ XML. */
async function moiCongThuc(xlsxPath: string): Promise<Array<{ o: string; f: string }>> {
  const ra: Array<{ o: string; f: string }> = [];
  for (const { name, xml } of await sheetXmls(xlsxPath)) {
    for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*>(?:(?!<\/c>)[\s\S])*?<f>([\s\S]*?)<\/f>/g)) {
      ra.push({
        o: `${name} ${m[1]}`,
        f: m[2].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
      });
    }
  }
  return ra;
}

test.describe('@infra toàn vẹn file .xlsx xuất ra', () => {
  test('KHÔNG có dataValidation trùng vùng — Excel bắt Repair nếu có', async () => {
    for (const { name, xml } of await sheetXmls(buildXlsx())) {
      const block = xml.match(/<dataValidations[^>]*>[\s\S]*?<\/dataValidations>/);
      if (!block) continue;

      const entries = block[0].match(/<dataValidation\b[\s\S]*?<\/dataValidation>|<dataValidation\b[^>]*\/>/g) || [];
      const declared = Number((block[0].match(/count="(\d+)"/) || [])[1]);
      expect(declared, `${name}: thuộc tính count phải khớp số <dataValidation> thật`).toBe(entries.length);

      const parse = (e: string) => {
        const m = e.match(/sqref="([A-Z]+)(\d+):\1(\d+)"/);
        return m ? { col: m[1], from: Number(m[2]), to: Number(m[3]), rule: e.replace(/\s*sqref="[^"]*"/, '') } : null;
      };
      const ranges = entries.map(parse).filter(Boolean) as Array<{ col: string; from: number; to: number; rule: string }>;

      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const a = ranges[i];
          const b = ranges[j];
          if (a.col !== b.col) continue;
          const overlap = a.from <= b.to && b.from <= a.to;
          expect(
            overlap,
            `${name}: hai dataValidation chồng vùng trên cột ${a.col} — ` +
              `${a.col}${a.from}:${a.col}${a.to} và ${b.col}${b.from}:${b.col}${b.to}. ` +
              'Đây là bug gom vùng của ExcelJS (sort địa chỉ bằng chuỗi nên "H10" < "H7"); ' +
              '`dedupeDataValidations()` trong md_to_xlsx.js phải dọn sau khi ghi file.',
          ).toBe(false);
        }
      }
    }
  });

  test('chiều cao dòng nằm trong giới hạn Excel và KHÔNG ép cắt nội dung', async () => {
    const sheets = await sheetXmls(buildXlsx());
    let tallest = 0;

    for (const { name, xml } of sheets) {
      for (const m of xml.matchAll(/<row[^>]*\bht="([0-9.]+)"/g)) {
        const h = Number(m[1]);
        // Excel từ chối mở nếu vượt 409.5pt.
        expect(h, `${name}: chiều cao dòng ${h}pt vượt giới hạn cứng 409.5pt của Excel`).toBeLessThanOrEqual(409.5);
        if (h > tallest) tallest = h;
      }
    }

    // Kiểm trên TOÀN workbook, không theo từng sheet: sheet dashboard và Hướng dẫn vốn chỉ có dòng ngắn,
    // ép chúng cao hơn 150pt là báo oan. Case dựng ở trên có ô ~900 ký tự nên PHẢI có ít nhất một dòng
    // vượt trần cũ 150pt. Trần đó là lỗi hiển thị: wrapText bật nhưng dòng thấp hơn nội dung nên chữ bị
    // CẮT mà người đọc không biết mình đang đọc thiếu.
    expect(
      tallest,
      `ô dài ~900 ký tự mà dòng cao nhất toàn file chỉ ${tallest}pt — nội dung đang bị cắt`,
    ).toBeGreaterThan(150);
  });

  test('dòng dữ liệu KHÔNG mang customHeight — nếu không Excel tắt auto-fit', async () => {
    /*
     * `customHeight="1"` nói với Excel "người dùng đã chỉnh chiều cao tay" ⇒ Excel giữ nguyên con số ta ghi
     * thay vì tự co theo nội dung. Mà con số đó do `estimateRowHeight()` ước lượng bằng độ-dài-chuỗi chia
     * độ-rộng-cột, KHÔNG dùng font metrics thật ⇒ luôn lệch. Google Sheets import thì tự tính lại nên không
     * lộ — đúng kiểu lỗi "ổn trên Sheet, sai trên Excel" mà người dùng báo 25/09/2026.
     */
    for (const { name, xml } of await sheetXmls(buildXlsx())) {
      for (const m of xml.matchAll(/<row r="(\d+)"([^>]*)>/g)) {
        const rowNum = Number(m[1]);
        if (rowNum < 7) continue; // dòng banner/nhãn: chiều cao cố định là có chủ ý
        expect(
          m[2].includes('customHeight="1"'),
          `${name}: dòng dữ liệu ${rowNum} mang customHeight ⇒ Excel sẽ KHÔNG auto-fit và chữ bị cắt. ` +
            '`normalizeXlsxForExcel()` trong md_to_xlsx.js phải gỡ cờ này ở các dòng r >= 7.',
        ).toBe(false);
      }
    }
  });

  test('workbook bật fullCalcOnLoad — nếu không, MỌI ô công thức hiện trống trong Excel', async () => {
    /*
     * exceljs ghi <f> mà KHÔNG kèm <v> (giá trị đã tính), nhưng vẫn đóng dấu calcId="171027".
     * Excel đọc calcId là "số trong file còn tươi cho engine này" nên bỏ qua việc tính lại, và vì
     * không có <v> nào thì ô hiện TRỐNG. Người dùng báo 30/09/2026: "Tổng TC ở sheet Theo dõi tiến
     * độ chưa thống kê được" — đúng triệu chứng này, ở cả 4 bộ đã xuất.
     * File mẫu của bộ chuẩn để <calcPr/> rỗng nên Excel tự tính lại; ở đây bật cờ tương đương.
     * Google Sheets tự tính lại bất kể cờ, nên lỗi này KHÔNG lộ khi kiểm bằng Google Sheets.
     */
    const zip = await JSZip.loadAsync(fs.readFileSync(buildXlsx()));
    const xml = await zip.file('xl/workbook.xml')!.async('string');
    const calcPr = xml.match(/<calcPr[^>]*\/?>/);
    expect(calcPr, 'workbook.xml phải có <calcPr>').not.toBeNull();
    expect(
      /fullCalcOnLoad="1"/.test(calcPr![0]) || !/calcId=/.test(calcPr![0]),
      `${calcPr![0]} — có calcId mà không có fullCalcOnLoad ⇒ Excel không tính lại, ô công thức hiện trống. ` +
        'Đặt workbook.calcProperties.fullCalcOnLoad = true trong md_to_xlsx.js.',
    ).toBe(true);
  });

  test('Tổng TC trên dashboard đếm cột ID_TC của ĐÚNG sheet chức năng', async () => {
    const f = await dashFormula(buildXlsx5cap(), 'H7');
    expect(f, 'H7 phải là công thức, không phải số cứng').not.toBe('');
    expect(f, `H7 = ${f} — phải đọc tên sheet từ $D7 qua INDIRECT`).toContain('INDIRECT("\'"&$D7&"\'!');
    expect(f, `H7 = ${f} — phải đếm trên cột A (ID_TC)`).toMatch(/\$A\$\d+:\$A\$\d+/);
  });

  test('Pass/Fail/Pending dò khối cột Result theo TÊN, không đóng cứng chữ cái cột', async () => {
    /*
     * Trước 30/09/2026 ba ô này đếm "Pass"/"Fail"/"Pending" ở CỘT L. Bố cục 13 cột thì cột L đúng là
     * `Result`, nhưng bố cục 24 cột (bộ chuẩn 5 cấp) cột L là `Test Level` còn kết quả nằm ở N..R
     * (Result MN/TH/THCS/THPT/GDTX) ⇒ cả ba ô vĩnh viễn ra 0, và dashboard báo "Chưa có TC" cho
     * mọi chức năng đã chấm xong. Đóng cứng chữ cái cột là gốc của lỗi, nên test khoá ở đó.
     */
    const xlsx = buildXlsx5cap();
    for (const ref of ['I7', 'J7', 'K7']) {
      const f = await dashFormula(xlsx, ref);
      expect(f, `${ref} phải là công thức`).not.toBe('');
      expect(f, `${ref} = ${f} — phải dò cột Result bằng MATCH("Result*") trên dòng header`)
        .toContain('MATCH("Result*"');
      expect(f, `${ref} = ${f} — còn đóng cứng vùng $L$…, sẽ ra 0 trên bố cục 24 cột`)
        .not.toMatch(/\$L\$\d+:\$L\$\d+/);
    }
  });

  test('mọi công thức cân dấu nháy và ngoặc — Excel từ chối công thức lệch', async () => {
    /*
     * Lỗi thật, sống trong MỌI file kit từng xuất tới 30/09/2026: công thức Tổng TC sinh ra
     *   IF($D7="","",IFERROR(COUNTIF(INDIRECT("'"&$D7&"'!$A$7:$A$500),"?*"),0))
     * thiếu dấu " đóng sau $A$500. Chuỗi trong template JS viết ...&"'!\$A\$7:\$A\$500) nên dấu
     * nháy mở không bao giờ được đóng. Không gate nào bắt vì không ai đọc lại công thức sau khi
     * sinh — và đọc bằng exceljs cũng không lộ, exceljs trả về đúng chuỗi lệch đó mà không kêu.
     * Phép kiểm này soi TOÀN BỘ công thức chứ không chỉ ô Tổng TC, vì lỗi thuộc về cách dựng
     * chuỗi chứ không thuộc về một ô nào.
     */
    for (const xlsx of [buildXlsx(), buildXlsx5cap()]) {
      const ds = await moiCongThuc(xlsx);
      expect(ds.length, 'file xuất ra phải có công thức để kiểm').toBeGreaterThan(0);
      const xau = ds.map((c) => ({ ...c, vi: lechCongThuc(c.f) })).filter((c) => c.vi);
      expect(
        xau.map((c) => `${c.o}: ${c.vi}\n    ${c.f.slice(0, 160)}`).join('\n'),
        `${xau.length}/${ds.length} công thức lệch — Excel sẽ báo lỗi hoặc bắt Repair`,
      ).toBe('');
    }
  });

  test('xuất lại KHÔNG xoá cột Result — Markdown không mang verdict', async () => {
    /*
     * Ca thật (TASK-9001, đo 06/10/2026): `reports/case-chua-co-ket-qua.md` đếm được 468 ô kết quả
     * trong Excel, nhưng file `.xlsx` cùng ngày chỉ còn **0/921** — chênh lệch đúng bằng một lượt
     * `md_to_xlsx`. Lý do: exporter dựng workbook MỚI từ Markdown rồi ghi đè, mà Markdown không
     * mang verdict. §6 đặt Markdown canonical làm nguồn của NỘI DUNG case; KẾT QUẢ là trục khác, và
     * hôm nay `.xlsx` là chỗ duy nhất giữ verdict đã merge — nên xoá trắng nó là mất dữ liệu chỉ còn
     * ở `test-results/*.json`, nơi không ai đọc khi duyệt.
     */
    const xlsx = buildXlsx5cap();

    // Giả lập một lượt merge: ghi verdict vào cột Result TH của dòng case đầu tiên.
    const wb1 = new ExcelJSLib.Workbook();
    await wb1.xlsx.readFile(xlsx);
    let daGhi = 0;
    for (const ws of wb1.worksheets) {
      const hdr: string[] = [];
      for (let i = 1; i <= 30; i += 1) hdr.push(String(ws.getRow(5).getCell(i).value ?? '').trim());
      const iTh = hdr.findIndex((h) => h.toLowerCase() === 'result th');
      if (iTh < 0 || !ws.getRow(7).getCell(1).value) continue;
      ws.getRow(7).getCell(iTh + 1).value = 'Pass';
      daGhi += 1;
    }
    expect(daGhi, 'phải tìm được sheet chức năng có cột "Result TH" để gieo verdict').toBeGreaterThan(0);
    await wb1.xlsx.writeFile(xlsx);

    // Xuất LẠI từ chính Markdown nguồn, đè lên file vừa có verdict.
    const r = spawnSync(process.execPath, [CONVERT, mdOf(xlsx), xlsx], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `convert lại phải thành công:\n${r.stdout || ''}${r.stderr || ''}`).toBe(0);

    const wb2 = new ExcelJSLib.Workbook();
    await wb2.xlsx.readFile(xlsx);
    let conLai = 0;
    for (const ws of wb2.worksheets) {
      const hdr: string[] = [];
      for (let i = 1; i <= 30; i += 1) hdr.push(String(ws.getRow(5).getCell(i).value ?? '').trim());
      const iTh = hdr.findIndex((h) => h.toLowerCase() === 'result th');
      if (iTh < 0) continue;
      if (String(ws.getRow(7).getCell(iTh + 1).value ?? '').trim() === 'Pass') conLai += 1;
    }
    expect(conLai, 'verdict đã merge phải SỐNG qua lượt xuất lại — mất là mất dữ liệu không có ở Excel nào khác').toBe(daGhi);
  });

  test('merge:execution-status ghi được vào bố cục NĂM cột Result, và đòi khai cấp', () => {
    /*
     * Ca thật: `merge_execution_status.js` dò cột kết quả bằng so khớp TUYỆT ĐỐI tên "Result".
     * Bộ chuẩn 24 cột không có cột nào tên đúng "Result" — nó có `Result MN/TH/THCS/THPT/GDTX` —
     * nên script chết với "không thấy sheet nào có header testcase", một thông báo chỉ sai hướng:
     * header TÌM THẤY rồi, thứ thiếu là cột kết quả. Đó là gốc của "chạy mà kết quả không về Excel".
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/convert_excel/merge_execution_status.js'), 'utf8');
    // Nguồn còn MỘT chỗ so khớp tuyệt đối hợp lệ (phân biệt bố cục 1 cột), nên bắt đúng DÒNG CŨ:
    // dò cột kết quả bằng findIndex trên headers.
    expect(
      /resultCol = headerRow\.headers\.findIndex/.test(src),
      'còn dò cột kết quả bằng findIndex một-cột ⇒ mọi file 24 cột lại chết như cũ',
    ).toBe(false);
    expect(src, 'phải dò cột kết quả theo tiền tố Result').toMatch(/\/\^result\\b\/i/);
    expect(src, 'nhiều cột Result mà không khai cấp thì phải CHẶN, không được đoán hộ').toContain('--cap <MN|TH|THCS|THPT|GDTX>');
  });
});
