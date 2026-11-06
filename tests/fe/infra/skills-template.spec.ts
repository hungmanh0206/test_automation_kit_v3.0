/*
 * `skills:template:check` — SKILL KHAI OUTPUT THÌ PHẢI CÓ MẪU, VÀ MẪU PHẢI TỰ QUA MÁY CỦA NÓ.
 *
 * Khoảng cách của tiêu chí "hướng dẫn cụ thể" không nằm ở chỗ skill thiếu chữ, mà ở chỗ đọc xong vẫn
 * chưa biết SẢN PHẨM trông thế nào. Đo 06/11/2026: 18 skill khai 47 output, và chỉ 1 output có mẫu.
 *
 * Mẫu KHÔNG phải khung trống — khung trống thì ai cũng dựng được và không ai học được gì. Mẫu là bản
 * ĐÃ ĐIỀN trên miền thật, và nếu output đó có máy kiểm thì chính mẫu phải qua được máy đó.
 *
 * Mọi ca chạy trên FIXTURE trong thư mục tạm. Bản chép giữ đúng độ sâu `scripts/qa/` so với một gốc có
 * `package.json`, vì cửa giải gốc repo từ `__dirname` — bản chép PHẲNG sẽ đo nhầm cây thật.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { gateEnv } from './_gate_env';
import { mayThu } from './_may_thu';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = mayThu('SKILLS_TEMPLATE_JS', path.join(REPO, 'scripts/qa/skills_template_check.js'));

type Mau = { ten: string; than: string };
type Dung = {
  /** mỗi skill: số output khai, và các dòng `Mẫu:` (đường dẫn tương đối từ gốc giả) */
  skills: Record<string, { out: number; mau?: string[]; trongBang?: boolean }>;
  mauFile?: Mau[];
  no?: number | null;
  noNgoai?: boolean;
};

function dungGoc(d: Dung): string {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'sktpl-'));
  fs.mkdirSync(path.join(goc, 'scripts', 'qa'), { recursive: true });
  fs.writeFileSync(path.join(goc, 'package.json'), JSON.stringify({ name: 'gia', version: '0.0.0' }), 'utf8');
  fs.copyFileSync(CUA, path.join(goc, 'scripts', 'qa', 'skills_template_check.js'));

  for (const [ten, s] of Object.entries(d.skills)) {
    const dir = path.join(goc, '.agent', 'skills', 'nhom', ten);
    fs.mkdirSync(dir, { recursive: true });
    const hang: string[] = ['## Outputs', '', '| Output | Vị trí | Mẫu |', '|---|---|---|'];
    for (let i = 0; i < s.out; i += 1) {
      const m = (s.mau || [])[i];
      hang.push(`| output ${i + 1} | chỗ nào đó | ${m && s.trongBang !== false ? `Mẫu: \`${m}\`` : ''} |`);
    }
    /* Mọi skill thật đều có dòng `Câu kích hoạt mẫu:` — chuỗi kết thúc bằng "mẫu:". Fixture PHẢI mang
     * nó, vì chính nó là thứ làm bản regex nới ra đếm thừa 18 mẫu. */
    hang.push('', '**Câu kích hoạt mẫu:** "sinh hộ tôi cái gì đó" · "làm giúp việc kia"', '');
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `# ${ten}\n\n${hang.join('\n')}\n`, 'utf8');
  }

  for (const m of (d.mauFile || [])) {
    const p = path.join(goc, m.ten);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, m.than, 'utf8');
  }

  const cfgDir = path.join(goc, '.agent', 'config');
  fs.mkdirSync(cfgDir, { recursive: true });
  const cfg: Record<string, unknown> = {};
  if (d.no !== null && d.no !== undefined) {
    if (d.noNgoai) cfg.thieuMau = d.no;
    else cfg.no = { thieuMau: d.no };
  }
  fs.writeFileSync(path.join(cfgDir, 'skills_template.json'), JSON.stringify(cfg), 'utf8');
  return goc;
}

async function chay(goc: string, them: string[] = []): Promise<{ code: number | null; out: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(goc, 'scripts', 'qa', 'skills_template_check.js'), ...them], {
      cwd: goc, env: gateEnv(),
    });
    let out = '';
    p.stdout.on('data', (x) => { out += String(x); });
    p.stderr.on('data', (x) => { out += String(x); });
    p.on('close', (code) => ok({ code, out }));
  });
}

/** Một mẫu tự qua máy: `kiem_bang` trỏ vào một script luôn exit 0. */
const MAU_QUA = (goc: string) => ({
  ten: 'tpl/ok.md',
  than: `---\nkiem_bang: node ${path.join(goc, 'may-ok.js').replace(/\\/g, '/')}\n---\n\nnội dung mẫu.\n`,
});

test.describe.configure({ mode: 'default' });

test.describe('@infra skills:template — nợ thiếu mẫu', () => {
  test('ĐỐI CHỨNG ÂM: nợ thực = nợ khai ⇒ ĐẠT', async () => {
    const r = await chay(dungGoc({ skills: { a: { out: 3 } }, no: 3 }));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('✓ ĐẠT');
  });

  test('ĐỐI CHỨNG DƯƠNG: nợ PHÌNH (thực > khai) ⇒ CHẶN', async () => {
    const r = await chay(dungGoc({ skills: { a: { out: 5 } }, no: 3 }), ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('PHÌNH');
  });

  /*
   * NỢ TRẢ RỒI MÀ KHÔNG HẠ SỔ CŨNG CHẶN. Nếu chỉ chặn chiều phình thì sổ sẽ ở mãi con số cũ, và nó
   * thành một con số không còn đo gì — đúng cách `thieuKhiDung` ở `skills_lint.json` từng trôi.
   */
  test('nợ đã trả bớt mà sổ chưa hạ ⇒ CHẶN, và in ra số để hạ', async () => {
    const r = await chay(dungGoc({ skills: { a: { out: 2 } }, no: 9 }), ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/Sửa `no\.thieuMau` thành 2/);
  });

  /*
   * KHOÁ NỢ ĐẶT NGOÀI `no` ⇒ CHẶN NGAY. Lớp lỗi này đã sống 13 ngày ở `skills_lint.json`: sổ ghi ở cấp
   * ngoài, script chỉ đọc `CFG.no`, nên gate in đúng câu mà đọc sai sổ.
   */
  test('`thieuMau` đặt NGOÀI `no` ⇒ CHẶN ngay, trước mọi phép chấm khác', async () => {
    const r = await chay(dungGoc({ skills: { a: { out: 3 } }, no: 3, noNgoai: true }), ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('NGOÀI');
  });

  test('chưa khai `no.thieuMau` ⇒ CHẶN, sổ phải là con số thấy được trong diff', async () => {
    const r = await chay(dungGoc({ skills: { a: { out: 3 } }, no: null }), ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('chưa khai số');
  });
});

test.describe('@infra skills:template — mẫu phải tồn tại và tự qua máy', () => {
  test('ĐỐI CHỨNG DƯƠNG: `Mẫu:` trỏ vào đường dẫn KHÔNG tồn tại ⇒ CHẶN', async () => {
    const goc = dungGoc({ skills: { a: { out: 1, mau: ['tpl/khong-co.md'] } }, no: 0 });
    const r = await chay(goc, ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'con trỏ chết tệ hơn chỗ trống — chỗ trống thì người ta biết là thiếu')
      .toContain('KHÔNG tồn tại');
  });

  test('mẫu không khai `kiem_bang` mà cũng không khai `vi_sao` ⇒ CHẶN', async () => {
    const goc = dungGoc({
      skills: { a: { out: 1, mau: ['tpl/tron.md'] } },
      mauFile: [{ ten: 'tpl/tron.md', than: '---\nx: 1\n---\n\nnội dung.\n' }],
      no: 0,
    });
    const r = await chay(goc, ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('vi_sao');
  });

  test('mẫu khai `vi_sao` thay cho `kiem_bang` ⇒ ĐẠT (chưa có máy kiểm là trạng thái THẬT)', async () => {
    const goc = dungGoc({
      skills: { a: { out: 1, mau: ['tpl/lydo.md'] } },
      mauFile: [{ ten: 'tpl/lydo.md', than: '---\nvi_sao: Cửa của output này đọc thư mục task, không đọc file rời.\n---\n\nnội dung.\n' }],
      no: 0,
    });
    const r = await chay(goc, ['--enforce']);
    expect(r.code, r.out).toBe(0);
  });

  test('ĐỐI CHỨNG DƯƠNG: mẫu có `kiem_bang` mà máy đó ĐỎ ⇒ CHẶN', async () => {
    const goc = dungGoc({
      skills: { a: { out: 1, mau: ['tpl/do.md'] } },
      mauFile: [{ ten: 'tpl/do.md', than: '---\nkiem_bang: node may-do.js\n---\n\nnội dung.\n' }],
      no: 0,
    });
    fs.writeFileSync(path.join(goc, 'may-do.js'), 'process.stdout.write("may bao do\\n"); process.exit(1);\n', 'utf8');
    const r = await chay(goc, ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'mẫu sai thì cửa phải đỏ, nếu không mẫu sẽ mục dần theo thời gian')
      .toContain('KHÔNG qua máy');
  });

  test('ĐỐI CHỨNG ÂM: mẫu có `kiem_bang` và máy đó XANH ⇒ ĐẠT', async () => {
    const goc = dungGoc({ skills: { a: { out: 1 } }, no: 0 });
    fs.writeFileSync(path.join(goc, 'may-ok.js'), 'process.exit(0);\n', 'utf8');
    const m = MAU_QUA(goc);
    fs.mkdirSync(path.join(goc, 'tpl'), { recursive: true });
    fs.writeFileSync(path.join(goc, m.ten), m.than, 'utf8');
    const f = path.join(goc, '.agent', 'skills', 'nhom', 'a', 'SKILL.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('| output 1 | chỗ nào đó |  |', `| output 1 | chỗ nào đó | Mẫu: \`${m.ten}\` |`), 'utf8');
    const r = await chay(goc, ['--enforce']);
    expect(r.code, r.out).toBe(0);
  });
});

test.describe('@infra skills:template — đếm mẫu không được đếm thừa', () => {
  /*
   * CA NÀY GÁC ĐÚNG LỖI ĐÃ XẢY RA. Bản regex nới ra bắt cả `Câu kích hoạt mẫu:` — chuỗi kết thúc đúng
   * bằng "mẫu:" — ở 18 skill, nên nợ tụt từ 46 xuống 29 mà không ai thêm mẫu nào. Đếm thừa mẫu thì CHE
   * nợ thật, tệ hơn hẳn báo oan.
   */
  test('`Câu kích hoạt mẫu:` KHÔNG được tính là một mẫu', async () => {
    const r = await chay(dungGoc({ skills: { a: { out: 2 } }, no: 2 }));
    expect(r.out, 'fixture có dòng "Câu kích hoạt mẫu:"; tính nó là mẫu thì nợ tụt xuống 0')
      .toMatch(/0 mẫu · nợ thực 2/);
    expect(r.code, r.out).toBe(0);
  });

  test('`Mẫu:` nằm GIỮA Ô BẢNG vẫn được đếm — ca dùng thật đầu tiên nằm đúng ở đó', async () => {
    const goc = dungGoc({ skills: { a: { out: 1, mau: ['tpl/lydo.md'] } }, mauFile: [{ ten: 'tpl/lydo.md', than: '---\nvi_sao: không có máy kiểm file rời.\n---\n\nx.\n' }], no: 0 });
    const r = await chay(goc, ['--enforce']);
    expect(r.out, 'bản neo đầu dòng trượt ca này và báo nợ phình trong khi mẫu có thật')
      .toMatch(/1 mẫu · nợ thực 0/);
    expect(r.code, r.out).toBe(0);
  });

  test('thứ bắt được phải có HÌNH DẠNG ĐƯỜNG DẪN, không phải một từ bất kỳ', async () => {
    const goc = dungGoc({ skills: { a: { out: 1 } }, no: 1 });
    const f = path.join(goc, '.agent', 'skills', 'nhom', 'a', 'SKILL.md');
    fs.appendFileSync(f, '\nMẫu: xem-o-dau-do\n', 'utf8');
    const r = await chay(goc);
    expect(r.out, '"xem-o-dau-do" không phải đường dẫn; tính nó là mẫu thì nợ bị che')
      .toMatch(/0 mẫu · nợ thực 1/);
  });
});

test.describe('@infra skills:template — không đo được thì KHÔNG phán', () => {
  test('thiếu `.agent/skills/` (như cây-gói) ⇒ exit 2, không phải 0', async () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'sktpl-trong-'));
    fs.mkdirSync(path.join(goc, 'scripts', 'qa'), { recursive: true });
    fs.writeFileSync(path.join(goc, 'package.json'), '{"name":"gia"}', 'utf8');
    fs.copyFileSync(CUA, path.join(goc, 'scripts', 'qa', 'skills_template_check.js'));
    const r = await chay(goc);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    expect(r.out).not.toContain('✓ ĐẠT');
  });

  test('không skill nào khai Outputs ⇒ exit 2, KHÔNG trả "đạt"', async () => {
    const r = await chay(dungGoc({ skills: {}, no: 0 }));
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  });
});
