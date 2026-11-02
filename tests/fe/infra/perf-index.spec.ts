/*
 * `perf_index.js` — TRANG CHỈ MỤC HIỆU NĂNG, VÀ BA CON SỐ TRONG BẢNG TỔNG.
 *
 * Script này đã có hai nhánh hiển thị mới (`detailHtml` cho case đo ở TẦNG UI, chip `BLOCKED_SETUP`)
 * mà KHÔNG có đối chứng nào. Khi đi viết đối chứng thì lộ ra ba lỗ, và cả ba cùng một lớp hỏng với
 * đợt v2.9.8 — một con số đúng được đọc thành kết luận rộng hơn, vì nó không nói nó đếm trên bao nhiêu:
 *
 *   ① `BLOCKED_SETUP` không có nhãn trong `NHAN` ⇒ hiện ra chuỗi khoá thô cho người đọc.
 *   ② `BLOCKED_SETUP` và `ERROR` được ĐẾM vào `dem` nhưng không có ô nào trong bảng tổng ⇒ bảng tổng
 *      KHÔNG cộng lại thành tổng số case, và không dòng nào nói ra là đang thiếu.
 *   ③ `daChay` là `tổng − CHUA_CHAY`, nên một case `BLOCKED_SETUP` được đếm là **đã có lượt chạy**
 *      trong khi `verdict_taxonomy.json` nói thẳng nó `executed: false`. Đó là "không đo được" bị cộng
 *      vào số đã đo — đúng thứ CLAUDE.md §3 cấm.
 *
 * CHẠY HOÀN TOÀN TRÊN FIXTURE: dựng một bộ canonical `.md` tối thiểu + `so-case.json`, gọi script thật
 * bằng tiến trình con, rồi đọc HTML nó sinh ra. Không gọi k6, không chạm UAT.
 *
 * Phép kiểm ĐÁNG GIÁ nhất ở đây là ca "bảng tổng phải cộng lại bằng tổng số case": nó không neo vào
 * một danh sách verdict chép tay, nên THÊM một verdict mới mà quên cho nó ô sẽ đỏ ngay — thay vì để
 * case ấy biến mất khỏi bảng tổng và không ai biết.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/perf_index.js');

type Ghi = { trangThai?: string; lyDo?: string; detailHtml?: string };

/**
 * Dựng cây fixture: bộ canonical `.md` có `ids.length` case Performance, cộng `so-case.json` theo `so`.
 * Trả về `{ dir, html }` — `html` là trang script thật vừa sinh.
 */
function chay(ids: string[], so: Record<string, Ghi> = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'perfidx-'));
  const perfDir = path.join(d, 'performance');
  fs.mkdirSync(perfDir, { recursive: true });

  /* Bảng canonical: cột 1 = tcId, cột 2 = Loại, cột 6 = Tiêu đề — đúng thứ `docCase()` đọc. */
  const dong = ids.map((id) => `| ${id} | Performance | x | x | Nhóm A | Tiêu đề ${id} - chi tiết | x | Cao | x |`);
  fs.writeFileSync(path.join(d, 'tc.md'),
    `# Bộ case\n\n| tcId | Loại | a | b | Nhóm | Tiêu đề | c | Ưu tiên | d |\n|---|---|---|---|---|---|---|---|---|\n${dong.join('\n')}\n`,
    'utf8');
  fs.writeFileSync(path.join(perfDir, 'so-case.json'), JSON.stringify(so, null, 2), 'utf8');

  const r = spawnSync(process.execPath, [MAY, '--perf-dir', perfDir, '--testcases', path.join(d, 'tc.md')],
    { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  expect(r.status, `perf_index hỏng: ${out}`).toBe(0);
  const fHtml = path.join(perfDir, 'index.html');
  expect(fs.existsSync(fHtml), `không sinh được index.html: ${out}`).toBe(true);
  return { d, out, html: fs.readFileSync(fHtml, 'utf8') };
}

/** Đọc số trong ô bảng tổng theo nhãn. `null` = KHÔNG có ô nào mang nhãn đó. */
function oTong(html: string, nhan: string): number | null {
  const khoi = html.match(/<div class="tong">([\s\S]*?)<\/div>\s*\n\s*<table/);
  if (!khoi) return null;
  const re = new RegExp(`<div class="nhan">${nhan}</div><div class="so">(\\d+)</div>`);
  const m = khoi[1].match(re);
  return m ? Number(m[1]) : null;
}

/** Tổng MỌI ô verdict trong bảng tổng (bỏ hai ô "Tổng case" và "Đã có lượt chạy"). */
function tongCacO(html: string): number {
  const khoi = html.match(/<div class="tong">([\s\S]*?)<\/div>\s*\n\s*<table/);
  if (!khoi) return -1;
  let t = 0;
  for (const m of khoi[1].matchAll(/<div class="nhan">([^<]+)<\/div><div class="so">(\d+)<\/div>/g)) {
    if (m[1] === 'Tổng case' || m[1] === 'Đã có lượt chạy') continue;
    t += Number(m[2]);
  }
  return t;
}

test.describe.configure({ mode: 'default' });

test.describe('@infra perf_index — bảng tổng phải cộng lại bằng mẫu số', () => {
  test('ĐỐI CHỨNG DƯƠNG: `BLOCKED_SETUP` có ô riêng, và bảng tổng cộng đủ', () => {
    const { d, html } = chay(['PERF_TC_001', 'PERF_TC_002', 'PERF_TC_003'], {
      PERF_TC_001: { trangThai: 'PASS' },
      PERF_TC_002: { trangThai: 'BLOCKED_SETUP', lyDo: 'thiếu hook đăng nhập nhiều phiên' },
    });
    expect(oTong(html, 'Tổng case')).toBe(3);
    expect(oTong(html, 'CHẶN · THIẾU HOOK'), 'verdict có case mà không có ô ⇒ nó biến mất khỏi bảng tổng').toBe(1);
    expect(tongCacO(html), 'bảng tổng phải cộng lại bằng tổng số case, nếu không thì nó che mất case nào đó').toBe(3);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: không có `BLOCKED_SETUP` thì KHÔNG hiện ô rỗng', () => {
    const { d, html } = chay(['PERF_TC_001', 'PERF_TC_002'], { PERF_TC_001: { trangThai: 'PASS' } });
    expect(oTong(html, 'CHẶN · THIẾU HOOK'), 'ô 0 case chỉ làm rối bảng tổng').toBeNull();
    expect(tongCacO(html)).toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('`ERROR` cũng phải có ô — nó đã bị đếm mà không hiện ở đâu từ trước', () => {
    const { d, html } = chay(['PERF_TC_001', 'PERF_TC_002'], {
      PERF_TC_001: { trangThai: 'ERROR' },
      PERF_TC_002: { trangThai: 'PASS' },
    });
    expect(oTong(html, 'ERROR')).toBe(1);
    expect(tongCacO(html)).toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });

  /*
   * MỘT VERDICT CHƯA AI BIẾT. Đây là ca chứng minh phép kiểm không neo vào danh sách chép tay: verdict
   * này không có trong `NHAN`, không có chip, không có ô viết tay — nó VẪN phải hiện ra chứ không được
   * biến mất, và bảng tổng vẫn phải cộng đủ.
   */
  test('verdict LẠ vẫn phải hiện ra, không được âm thầm rơi khỏi bảng tổng', () => {
    const { d, html } = chay(['PERF_TC_001', 'PERF_TC_002'], {
      PERF_TC_001: { trangThai: 'MOT_VERDICT_CHUA_CO' },
      PERF_TC_002: { trangThai: 'PASS' },
    });
    expect(oTong(html, 'MOT_VERDICT_CHUA_CO'), 'verdict không khai trước vẫn là một case thật').toBe(1);
    expect(tongCacO(html)).toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra perf_index — "chưa thực thi" KHÔNG được cộng vào "đã có lượt chạy"', () => {
  test('`BLOCKED_SETUP` có `executed: false` ⇒ KHÔNG tính là đã chạy', () => {
    const { d, html, out } = chay(['PERF_TC_001', 'PERF_TC_002', 'PERF_TC_003'], {
      PERF_TC_001: { trangThai: 'PASS' },
      PERF_TC_002: { trangThai: 'BLOCKED_SETUP' },
    });
    expect(oTong(html, 'Đã có lượt chạy'),
      '3 case − 1 chưa chạy − 1 BLOCKED_SETUP = 1; đếm 2 là cộng "không đo được" vào số đã đo').toBe(1);
    expect(out).toContain('1 đã chạy');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG: cùng cây đó nhưng verdict là `FAIL` ⇒ FAIL LÀ đã chạy', () => {
    const { d, html } = chay(['PERF_TC_001', 'PERF_TC_002', 'PERF_TC_003'], {
      PERF_TC_001: { trangThai: 'PASS' },
      PERF_TC_002: { trangThai: 'FAIL' },
    });
    expect(oTong(html, 'Đã có lượt chạy'),
      'FAIL là một phép đo ĐÃ xảy ra — trừ nó ra là nới lỏng theo hướng ngược lại').toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('danh sách `CHUA_THUC_THI` phải khớp `executed: false` của sổ chuẩn', () => {
    const src = fs.readFileSync(MAY, 'utf8');
    const m = src.match(/const CHUA_THUC_THI = \[([^\]]*)\]/);
    expect(m, '`perf_index.js` phải khai danh sách này tường minh để đối chiếu được').not.toBeNull();
    const khai = [...m![1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);

    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const so = require(path.join(REPO, '.agent/config/verdict_taxonomy.json'));
    const khongChay = Object.keys(so.statuses).filter((k) => so.statuses[k].executed === false);
    expect(khongChay.length, 'sổ chuẩn không có verdict `executed: false` nào ⇒ phép kiểm này RỖNG').toBeGreaterThan(0);

    /* Chỉ đòi: verdict nào perf_index DÙNG (có trong `NHAN`) và `executed: false` thì phải được trừ ra. */
    const nhanKhoi = src.match(/const NHAN = \{([\s\S]*?)\n\};/);
    const dungO = [...nhanKhoi![1].matchAll(/([A-Z_]+):\s*'/g)].map((x) => x[1]);
    const phaiTru = khongChay.filter((k) => dungO.includes(k));
    expect(phaiTru.filter((k) => !khai.includes(k)),
      'verdict này `executed: false` và perf_index có dùng, nhưng `daChay` vẫn đếm nó là đã chạy').toEqual([]);
  });
});

test.describe('@infra perf_index — `detailHtml` cho case đo ở tầng UI', () => {
  test('ĐỐI CHỨNG DƯƠNG: khai `detailHtml` ⇒ mở được trang chi tiết dù KHÔNG có lượt k6', () => {
    const { d, html } = chay(['PERF_TC_001'], {
      PERF_TC_001: { trangThai: 'PASS', detailHtml: 'ui/PERF_TC_001/chi-tiet.html' },
    });
    expect(html, 'không có link thì con số trên trang không tra lại được về đâu')
      .toContain('href="ui/PERF_TC_001/chi-tiet.html"');
    expect(html, 'cả hàng phải bấm được, không chỉ cái tên').toContain("window.location='ui/PERF_TC_001/chi-tiet.html'");
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: KHÔNG khai `detailHtml` ⇒ không có link, và hàng không bấm được', () => {
    const { d, html } = chay(['PERF_TC_001'], { PERF_TC_001: { trangThai: 'PASS' } });
    expect(html, 'link rỗng còn tệ hơn không có link').not.toContain('href=""');
    expect(html).not.toContain('window.location=');
    expect(html, 'hàng không mở được gì thì phải mang class `khong`').toContain('<tr class="khong"');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('link chi tiết KHÔNG có số k6 phải phân biệt được bằng mắt', () => {
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src, '`class="dui"` được gắn vào link nhưng không có luật CSS nào ⇒ phân biệt mà mã muốn thể hiện là vô hình')
      .toMatch(/\.dui\{[^}]+\}/);
    const { d, html } = chay(['PERF_TC_001'], {
      PERF_TC_001: { trangThai: 'PASS', detailHtml: 'ui/x.html' },
    });
    expect(html).toContain('class="dui"');
    fs.rmSync(d, { recursive: true, force: true });
  });
});
