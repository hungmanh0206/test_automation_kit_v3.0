import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { gateEnv } from './_gate_env';

/*
 * @infra — MỖI DEPENDENCY PHẢI CÓ NƠI DÙNG, HOẶC CÓ MỘT DÒNG GIẢI THÍCH.
 *
 * VÌ SAO GATE NÀY RA ĐỜI, và đây là một bài học về tiền đề chứ không về dependency:
 *
 * Một lượt rà độc lập (10/10/2026) kết luận `xlsx` là dep chết — khai bằng URL tới CDN SheetJS,
 * `npm ci` trả 403 sau proxy, và `grep` trong `scripts/` + `tests/` không thấy ai `require`. Kết luận
 * đó SAI: có 11 file dùng nó, nằm trong `outputs/**` (lớp PROJECT, gitignore). Gỡ theo kết luận đó là
 * làm gãy automation của một task đang chạy.
 *
 * Nhưng cùng lượt rà lại BỎ SÓT một dep chết thật: `form-data`. Không ai `require` nó, và chỗ duy nhất
 * dùng `new FormData()` là GLOBAL của Node (sàn Node của kit là 20). `axios` vẫn kéo nó theo dạng phụ
 * thuộc gián tiếp, nên gỡ dep trực tiếp không đổi gì lúc chạy.
 *
 * Cái thiếu không phải một lần `grep` rộng hơn. Là MỘT CHỖ KHAI: dep này dùng ở đâu, vì sao khai bằng
 * URL, và gỡ được khi nào. Nên gate không chỉ tìm dep chết — nó bắt mọi dep không tự chứng minh được
 * phải có một dòng trong `.agent/config/deps_allow.json`. Lần rà sau đọc dòng đó thay vì đoán lại.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DEPS = path.join(REPO, 'scripts/qa/deps_check.js');

/** Cây giả tối thiểu: `package.json` + `deps_allow.json` + một file mã, đã `git init` và `git add`. */
function cayGia(pkg: object, allow: object, ma = '// khong dung gi\n') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-'));
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  fs.mkdirSync(path.join(d, '.agent', 'config'), { recursive: true });
  fs.writeFileSync(path.join(d, '.agent', 'config', 'deps_allow.json'), JSON.stringify(allow, null, 2), 'utf8');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.js'), ma, 'utf8');
  /*
   * `git init` + `add` là BẮT BUỘC: phép kiểm lấy danh sách file bằng `git ls-files`, và không có git
   * thì nó thoát 0 với "KHÔNG PHÁN ĐƯỢC" — fixture sẽ xanh mà chẳng đo gì cả.
   */
  const g = (...a: string[]) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 'x@example.invalid');
  g('config', 'user.name', 'x');
  g('add', '-A');
  return d;
}

function chay(d: string) {
  const r = spawnSync(process.execPath, [DEPS, '--repo', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/**
 * Cây giả cho phép kiểm ⑤: một dep `file:` trỏ tarball nằm trong cây, kèm lockfile ghim ĐÚNG băm của
 * chính file đó.
 *
 * Băm phải TÍNH TỪ FILE, không gõ tay: gõ tay thì âm bản vẫn xanh khi phép kiểm hỏng theo chiều
 * "không bao giờ so được băm nào", vì khi đó nó cũng im lặng.
 *
 * Nội dung tarball không cần là tarball thật — phép kiểm ⑤ so byte, không giải nén.
 */
function cayGiaVendor(noiDung = 'khong-phai-tarball-that-nhung-du-de-so-bam\n') {
  const d = cayGia(
    { dependencies: { thu: 'file:vendor/thu-1.0.0.tgz' } },
    { mien_tru: { thu: { url_ok: true, noi_dung: 'x', vi_sao: 'y' } } },
  );
  fs.mkdirSync(path.join(d, 'vendor'), { recursive: true });
  const p = path.join(d, 'vendor', 'thu-1.0.0.tgz');
  fs.writeFileSync(p, noiDung, 'utf8');
  const bam = createHash('sha512').update(fs.readFileSync(p)).digest('base64');
  fs.writeFileSync(
    path.join(d, 'package-lock.json'),
    JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/thu': { integrity: `sha512-${bam}` } } }, null, 2),
    'utf8',
  );
  execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'pipe' });
  return d;
}

const LOCK_CO_HASH = {
  lockfileVersion: 3,
  packages: { 'node_modules/thu': { integrity: 'sha512-giadinhbam' } },
};

test.describe('@infra deps:check — dependency phải có nơi dùng hoặc có lý do', () => {
  test('repo thật hiện tại: ĐẠT', () => {
    const r = spawnSync(process.execPath, [DEPS], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  });

  test('dep KHÔNG ai dùng và KHÔNG có miễn trừ ⇒ CHẶN', () => {
    const d = cayGia({ dependencies: { 'khong-ai-dung': '^1.0.0' } }, { mien_tru: {} });
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('khong-ai-dung');
      expect(r.out, 'phải chỉ đường ra, không chỉ báo sai').toContain('deps_allow.json');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep có miễn trừ kèm `vi_sao` ⇒ ĐẠT', () => {
    const d = cayGia(
      { dependencies: { 'khong-ai-dung': '^1.0.0' } },
      { mien_tru: { 'khong-ai-dung': { noi_dung: 'ngoai cay track', vi_sao: 'co ly do that' } } },
    );
    try { expect(chay(d).code).toBe(0); } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep dạng URL mà miễn trừ KHÔNG có `url_ok` ⇒ CHẶN', () => {
    const d = cayGia(
      { dependencies: { thu: 'https://vi-du.invalid/thu-1.0.0.tgz' } },
      { mien_tru: { thu: { noi_dung: 'x', vi_sao: 'y' } } },
    );
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('url_ok');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep dạng URL mà lockfile KHÔNG có `integrity` ⇒ CHẶN', () => {
    /*
     * Đây là phép kiểm đáng giá nhất của nhóm URL: một tarball không khoá băm có thể đổi nội dung dưới
     * chân mình mà lockfile vẫn "khớp". `url_ok` cho phép đi đường đó, nhưng không cho phép đi mù.
     */
    const d = cayGia(
      { dependencies: { thu: 'https://vi-du.invalid/thu-1.0.0.tgz' } },
      { mien_tru: { thu: { url_ok: true, noi_dung: 'x', vi_sao: 'y' } } },
    );
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('integrity');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep dạng URL + `url_ok` + lockfile có `integrity` ⇒ ĐẠT', () => {
    const d = cayGia(
      { dependencies: { thu: 'https://vi-du.invalid/thu-1.0.0.tgz' } },
      { mien_tru: { thu: { url_ok: true, noi_dung: 'x', vi_sao: 'y' } } },
    );
    fs.writeFileSync(path.join(d, 'package-lock.json'), JSON.stringify(LOCK_CO_HASH, null, 2), 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'pipe' });
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(0);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('dep chỉ gọi ở dòng lệnh (npm script) vẫn tính là có nơi dùng', () => {
    /* `eslint`/`lighthouse` không bao giờ bị `require`. Không nhận bề mặt này thì gate báo oan. */
    const d = cayGia({ dependencies: { 'cong-cu': '^1.0.0' }, scripts: { x: 'cong-cu --check' } }, { mien_tru: {} });
    try { expect(chay(d).code, 'gọi ở npm script là một nơi dùng').toBe(0); } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('miễn trừ THỪA (dep đã tự chứng minh) ⇒ cảnh báo, không chặn', () => {
    /*
     * Cảnh báo chứ không chặn, nhưng vẫn phải kêu: một danh sách miễn trừ không ai dọn sẽ dần che đúng
     * thứ nó phải soi — `@eslint/js` đã là một ca như vậy ngay ở lượt đầu.
     */
    const d = cayGia(
      { dependencies: { codung: '^1.0.0' } },
      { mien_tru: { codung: { noi_dung: 'x', vi_sao: 'y' } } },
      "const a = require('codung');\n",
    );
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(0);
      expect(r.out).toContain('xoá dòng miễn trừ');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('`xlsx` vẫn còn, và miễn trừ của nó nói rõ nơi dùng + lý do + khi nào gỡ được', () => {
    /*
     * Khoá lại KẾT LUẬN, không chỉ khoá cơ chế. Lượt rà sau rất dễ lặp lại đúng câu "xlsx không ai
     * dùng" rồi gỡ nó. Ba trường dưới đây là câu trả lời sẵn cho lượt đó.
     */
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(co.xlsx, 'xlsx bị gỡ thì automation của task dùng nó sẽ gãy').toBeTruthy();

    const allow = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/deps_allow.json'), 'utf8'));
    const m = allow.mien_tru.xlsx;
    expect(m?.url_ok).toBe(true);
    expect(m?.noi_dung, 'phải nói nơi dùng').toContain('outputs/');
    expect(m?.vi_sao_khong_dung_registry, 'phải nói vì sao không về registry').toMatch(/CVE|lỗ/);
    expect(m?.go_duoc_khi, 'phải nói gỡ được khi nào, không để miễn trừ sống mãi').toBeTruthy();
  });

  test('`form-data` đã được gỡ khỏi dependency TRỰC TIẾP', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(co['form-data'], 'đây là dep chết thật — `new FormData()` là global của Node 20').toBeUndefined();
    const src = fs.readFileSync(path.join(REPO, 'scripts/integrations/backlog/bug_reporter.js'), 'utf8');
    expect(src, 'chỗ dùng phải là global, không phải require').toContain('new FormData()');
    expect(src).not.toMatch(/require\(\s*['"]form-data['"]/);
  });

  test('mục "Mạng cần mở" nói đúng trạng thái SAU khi vendor — không còn host nào ngoài registry', () => {
    /*
     * Test này trước 15/10/2026 ghim ĐÚNG NGƯỢC LẠI: nó đòi README phải chứa `cdn.sheetjs.com` và `403`.
     * Lúc đó đúng. Sau khi vendor tarball vào repo thì câu đó thành SAI, và một test ghim câu sai còn
     * tệ hơn không có test — nó biến tài liệu lạc hậu thành điều kiện để pipeline xanh.
     *
     * Nên bây giờ ghim theo hướng khác: README phải khai KHÔNG cần host ngoài registry, và vẫn phải
     * KỂ LẠI chuyện cũ (người dựng CI gặp một pipeline cũ 403 cần đọc được vì sao, và vì sao không
     * phải cứ hạ về registry là xong).
     */
    const r = fs.readFileSync(path.join(REPO, '.github/workflows/README.md'), 'utf8');
    expect(r, 'phải khai rõ không cần mở host nào').toMatch(/Không host nào ngoài registry/i);
    expect(r, 'phải còn kể lý do không hạ về registry').toMatch(/CVE-2023-30533/);
    expect(r, 'phải trỏ tới tarball trong repo').toContain('vendor/xlsx-0.20.3.tgz');
  });

  test('`xlsx` khai bằng `file:` và tarball CÓ THẬT trong repo', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(co.xlsx, 'đổi về URL CDN là mang lại đúng ca `npm ci` 403 sau proxy').toMatch(/^file:/);
    const duong = path.join(REPO, String(co.xlsx).replace(/^file:/, ''));
    expect(fs.existsSync(duong), 'khai `file:` mà không có file thì `npm ci` chết ở MỌI máy nhận').toBe(true);
  });

  test('gói phát hành mang `vendor/` — thiếu nó thì `npm ci` trong gói chết', () => {
    /*
     * Lỗi lặp được: `KEEP_DIRS` của `package_kit.js` đã bỏ sót `manual-run`, `tests/fe/lib`,
     * `.claude/agents`. Lần này thứ bỏ sót sẽ không làm vài test đỏ mà làm CẢ `release:verify` đỏ,
     * vì gói mang `package.json` trỏ `file:vendor/…` trong khi file không có ở đó.
     */
    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const pk = require(path.join(REPO, 'scripts/qa/package_kit.js'));
    /* eslint-enable @typescript-eslint/no-var-requires, global-require */
    expect(pk.KEEP_DIRS, '`vendor` phải nằm trong danh sách mang đi').toContain('vendor');
    expect(pk.collect().includes('vendor/xlsx-0.20.3.tgz'), 'tarball phải thật sự được thu vào gói').toBe(true);
  });

  test('⑤ băm tarball `file:` KHỚP `integrity` lockfile ⇒ ĐẠT (ÂM BẢN)', () => {
    const d = cayGiaVendor();
    try {
      const r = chay(d);
      expect(r.out, 'tarball nguyên thì KHÔNG được có dòng băm nào').not.toMatch(/KHÔNG khớp `integrity`/);
      expect(r.code, r.out).toBe(0);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('⑤ đổi MỘT bit trong tarball ⇒ CHẶN (DƯƠNG BẢN)', () => {
    /*
     * Đây là phép kiểm duy nhất còn lại trên một blob nhị phân 2,3 MB: không ai đọc được nó trong code
     * review, nên nếu băm không có máy so thì vendor = tin tưởng mù vào một file không ai mở.
     */
    const d = cayGiaVendor();
    try {
      const p = path.join(d, 'vendor/thu-1.0.0.tgz');
      const b = fs.readFileSync(p);
      b[Math.floor(b.length / 2)] ^= 0xff;
      fs.writeFileSync(p, b);
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/KHÔNG khớp `integrity`/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('⑤ tarball `file:` MẤT khỏi repo ⇒ CHẶN, và nói rõ `npm ci` sẽ chết', () => {
    const d = cayGiaVendor();
    try {
      fs.rmSync(path.join(d, 'vendor/thu-1.0.0.tgz'));
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('KHÔNG có trong repo');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('⑤ nhãn bảng in `FILE`, không in `URL` — nhãn sai làm người đọc tin dep vẫn tải qua mạng', () => {
    const d = cayGiaVendor();
    try {
      const r = chay(d);
      expect(r.out).toMatch(/thu\s+FILE/);
      expect(r.out, '`file:` không phải URL dù đi qua cùng nhánh luật').not.toMatch(/thu\s+URL/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
});
