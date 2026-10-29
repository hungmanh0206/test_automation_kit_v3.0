/*
 * @infra `recon:passive` — recon chỉ được QUAN SÁT, không được DÒ.
 *
 * Luật nguyên văn ở `requirements_analyzer/SKILL.md`: *không `curl`/`fetch`/`page.evaluate` gọi endpoint
 * để dò hành vi*. Dòng đó trước đây kết bằng "**chưa có máy gác**" — đây là máy đó, và nó là một trong
 * sáu dòng `CHƯA CÓ MÁY` của `A_PARITY.md`.
 *
 * Vì sao luật này quan trọng hơn vẻ ngoài: bản kê recon được dùng làm NGUỒN để viết case. Một endpoint
 * mình tự gọi bằng `fetch` trả 200 không nói gì về việc UI có gọi nó — nhưng nó TRÔNG như một phát hiện.
 *
 * Cửa nổ **0 lượt** trên bộ máy hiện tại (8 file, 5 chỗ nghe, 0 chỗ tự gửi). Nên phép kiểm quan trọng
 * nhất ở đây là ĐỐI CHỨNG DƯƠNG: một luật không chứng minh được là nó nổ ĐƯỢC thì 0 vi phạm sẽ bị đọc
 * thành "đã gác".
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/recon_passive.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rp = require(GATE);

const NGHE = "page.on('response', (r) => ghi(r));\n";

/** Dựng thư mục recon giả. Mặc định có listener để phép kiểm ② không nổ lẫn vào. */
function dungDir(noiDung: string, coNghe = true) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rcp-'));
  fs.writeFileSync(path.join(d, 'x.js'), `${coNghe ? NGHE : ''}${noiDung}`, 'utf8');
  return d;
}

const chay = (dir: string) => {
  const r = spawnSync(process.execPath, [GATE, '--dir', dir], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

test.describe('@infra recon:passive — ① không tự gửi request', () => {
  test('bộ máy recon THẬT đạt, và in ra cả hai con số', () => {
    const r = chay(path.join(REPO, 'scripts/qa/discovery'));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/nghe thụ động: [1-9]\d* chỗ/);
    expect(r.out).toMatch(/tự gửi request: 0 chỗ/);
  });

  test('ĐỐI CHỨNG DƯƠNG: mỗi kiểu tự-gửi-request đều bị bắt', () => {
    /* Bảy mẫu, bảy ca. Thiếu ca nào thì mẫu đó có thể đã chết mà không ai biết. */
    const ca: [string, string][] = [
      ['fetch', "const r = await fetch('/api/truong');\n"],
      ['axios', "const r = await axios.get('/api/truong');\n"],
      ['page.request', "const r = await page.request.post('/api/truong', {});\n"],
      ['xhr', 'const x = new XMLHttpRequest();\n'],
      ['jquery-ajax', "$.ajax({ url: '/api/truong' });\n"],
      ['node-http', "const h = require('https');\n"],
      ['curl', "spawnSync('curl', ['-s', '/api/truong']);\n"],
    ];
    for (const [ma, code] of ca) {
      const d = dungDir(code);
      const r = chay(d);
      expect(r.code, `${ma} phải bị CHẶN — ${r.out}`).toBe(1);
      expect(r.out, `phải nói rõ mã luật ${ma}`).toContain(`[${ma}]`);
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('ĐỐI CHỨNG ÂM: `goto` và `page.evaluate` ĐỌC DOM KHÔNG bị bắt', () => {
    /*
     * Điều hướng là cách xem app, và đọc DOM là việc chính của recon. Chặn hai thứ đó thì cửa này biến
     * recon thành không làm được gì — và người ta sẽ tắt nó chứ không sửa theo nó.
     */
    const d = dungDir([
      "await page.goto(URL, { waitUntil: 'domcontentloaded' });",
      'const nhan = await page.evaluate(() => [...document.querySelectorAll("label")].map((e) => e.textContent));',
      '',
    ].join('\n'));
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`fetch` nằm trong CHÚ THÍCH hoặc trong CHUỖI thì KHÔNG tính', () => {
    /*
     * Không có vế này thì chính `recon_passive.js` tự chặn mình — phần đầu của nó nhắc `fetch`/`axios`
     * để giải thích luật. Và một tài liệu nhắc tên hàm không phải một lời gọi.
     */
    const d = dungDir([
      '/* Luật: không dùng fetch để dò endpoint. */',
      "const canhBao = 'đừng gọi axios ở recon';",
      '// page.request.get() cũng bị cấm',
      '',
    ].join('\n'));
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/tự gửi request: 0 chỗ/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra recon:passive — ② vẫn còn NGHE', () => {
  test('ĐỐI CHỨNG DƯƠNG: xoá sạch listener ⇒ CHẶN, dù không vi phạm ①', () => {
    /*
     * Chiều này mới chống được cửa rỗng. Một thư mục recon không còn `page.on('response')` thì nó không
     * quan sát gì nữa — và phép kiểm ① vẫn xanh, vì không còn gì để vi phạm.
     */
    const d = dungDir("await page.goto('/x');\n", false);
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/KHÔNG còn chỗ nào nghe/);
    expect(r.out, 'phải nói rõ vì sao chiều này cần thiết').toMatch(/cửa rỗng/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('listener đọc trên bản CHỈ BỎ CHÚ THÍCH — lỗi làm-trắng-chuỗi đã dính một lần', () => {
    /*
     * Bản đầu dùng CHUNG một mức làm trắng cho cả hai mẫu, nên `'response'` thành `'        '` và cửa
     * báo "0 chỗ nghe" trên một bộ máy có 5 chỗ nghe — rồi tự chặn mình bằng chính phép kiểm ②.
     */
    const s = "page.on('response', f);";
    expect(rp.boChuThich(s), 'bỏ chú thích KHÔNG được xoá ruột chuỗi').toContain("'response'");
    expect(rp.chiLaMa(s), 'bản cho mẫu ① thì ruột chuỗi phải trắng').not.toContain("'response'");
  });

  test('cả bảy mẫu ① đều còn trong bộ luật — không mẫu nào bị gỡ âm thầm', () => {
    const ma = rp.TU_GUI.map((r: { ma: string }) => r.ma);
    for (const x of ['fetch', 'axios', 'page.request', 'xhr', 'jquery-ajax', 'node-http', 'curl']) {
      expect(ma, `thiếu mẫu ${x}`).toContain(x);
    }
    /* Mỗi mẫu phải có lời giải thích riêng: một tên hàm trần không nói lên vi phạm. */
    for (const r of rp.TU_GUI) expect(String(r.vi).length, `mẫu ${r.ma} thiếu lý do`).toBeGreaterThan(30);
  });

  test('"không phán được" KHÔNG thành "đạt": 0 file ⇒ exit 2', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rcp0-'));
    const r = chay(d);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: đọc TÊN HÀM, không chạy', () => {
    const src = fs.readFileSync(GATE, 'utf8');
    expect(src).toMatch(/KHÔNG chạy|không chạy/);
    expect(src, 'phải nêu ca lời gọi gián tiếp mà nó không thấy').toMatch(/gián tiếp/);
  });

  test('SKILL đã BỎ câu "chưa có máy gác" cho luật này, và trỏ tới máy thật', () => {
    /*
     * Lớp "stale gate" đã cắn kit ba lần: luật đổi mà tài liệu ở lại. Ở đây là chiều ngược — máy đã có
     * mà tài liệu vẫn nói chưa có, khiến người đọc tưởng chỗ đó còn hở.
     */
    const s = fs.readFileSync(path.join(REPO, '.agent/skills/phase1/requirements_analyzer/SKILL.md'), 'utf8');
    const i = s.indexOf('Recon chỉ quan sát THỤ ĐỘNG');
    expect(i, 'không tìm thấy luật trong SKILL').toBeGreaterThan(0);
    const doan = s.slice(i, i + 420);
    expect(doan, 'câu "chưa có máy gác" phải được bỏ').not.toMatch(/chưa có máy gác/);
    expect(doan, 'phải trỏ tới máy thật').toContain('recon:passive');
  });
});
