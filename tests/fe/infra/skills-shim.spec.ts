/*
 * @infra shim `.claude/skills/` — để harness TỰ NẠP 28 skill của kit (v2.9.6 N1).
 *
 * VẤN ĐỀ: skill của kit nằm ở `.agent/skills/**`, mà harness chỉ dò `.claude/skills/`. Nên 28 skill
 * không bao giờ tự xuất hiện, và kit phải bơm danh sách TÊN qua hook SessionStart — đo 30/10/2026 là
 * **232 token mỗi phiên**, mà vẫn chỉ cho agent cái tên chứ không cho mô tả.
 *
 * SHIM LÀ CON TRỎ, KHÔNG PHẢI BẢN SAO: thân ≤ 5 dòng trỏ về bản gốc. Chép nội dung sang đây là dựng
 * nguồn thứ hai, và kit đã trả giá đúng chuyện đó ở hai bản lint SQL.
 *
 * GIỚI HẠN CỦA CHÍNH FILE NÀY, nói trước: đây là phép kiểm TĨNH. Nó chứng minh shim tồn tại và khớp
 * nguồn; nó KHÔNG chứng minh harness thật sự nạp. Chuyện đó chỉ nghiệm thu được ở một phiên khởi động
 * SAU khi shim đã có trên đĩa — và kết quả phải ghi vào `docs/v2.9.6/BASELINE.md`.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/skills_index.js');
const GOC = path.join(REPO, '.agent/skills');
const SHIM = path.join(REPO, '.claude/skills');

const chay = (argv: string[]) => {
  const r = spawnSync(process.execPath, [GATE, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/** Mọi SKILL.md gốc. */
function skillGoc(): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p);
      else if (e.name === 'SKILL.md') ra.push(path.basename(path.dirname(p)));
    }
  };
  di(GOC);
  return ra.sort();
}

/** Sửa một shim rồi trả lại nguyên trạng — KHÔNG để cây bẩn nếu assertion ném. */
function voiShimHong<T>(ten: string, bien: (s: string) => string, lam: () => T): T {
  const f = path.join(SHIM, ten, 'SKILL.md');
  const cu = fs.readFileSync(f, 'utf8');
  try {
    fs.writeFileSync(f, bien(cu), 'utf8');
    return lam();
  } finally {
    fs.writeFileSync(f, cu, 'utf8');
  }
}

test.describe('@infra shim skill — đủ, khớp, và không thừa', () => {
  test('mỗi skill gốc có đúng một shim, và `--check` sạch', () => {
    const goc = skillGoc();
    expect(goc.length, 'phải có skill để nói chuyện').toBeGreaterThanOrEqual(20);
    const co = fs.readdirSync(SHIM, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    expect(co, 'danh sách shim phải khớp danh sách skill gốc').toEqual(goc);
    const r = chay(['--check']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/\d+ shim khớp nguồn/);
  });

  test('shim là CON TRỎ: ≤ 5 dòng thân, và trỏ tới bản gốc CÓ THẬT', () => {
    for (const ten of skillGoc()) {
      const s = fs.readFileSync(path.join(SHIM, ten, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
      const than = s.split('\n---\n').slice(1).join('\n---\n').split('\n').filter((l) => l.trim()).length;
      expect(than, `${ten}: thân shim ${than} dòng — shim là con trỏ, không phải bản sao`).toBeLessThanOrEqual(5);

      const m = s.match(/\[`([^`]+)`\]/);
      expect(m, `${ten}: shim không trỏ tới file nào`).toBeTruthy();
      expect(fs.existsSync(path.join(REPO, m![1])), `${ten}: trỏ tới ${m![1]} — file KHÔNG tồn tại`).toBe(true);
      expect(s, `${ten}: shim phải tự khai là bản sinh`).toMatch(/SINH TỰ ĐỘNG/);
    }
  });

  test('frontmatter shim chép NGUYÊN VĂN `name` + `description` của bản gốc', () => {
    /* Lệch một chữ là agent chọn theo một mô tả khác với mô tả người viết — nguồn trôi âm thầm. */
    for (const ten of skillGoc()) {
      const shim = fs.readFileSync(path.join(SHIM, ten, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
      const dShim = (shim.match(/\ndescription: (.+)\n/) || [])[1];
      const fGoc = chay(['--json']);
      const rows = JSON.parse(fGoc.out) as { name: string; description: string }[];
      const goc = rows.find((r) => r.name === ten);
      expect(goc, `${ten}: không có trong index`).toBeTruthy();
      expect(dShim, `${ten}: description shim lệch bản gốc`).toBe(goc!.description);
      break; // một skill là đủ để khoá khuôn; vòng đầy đủ đã do `--check` lo
    }
  });

  test('ĐỐI CHỨNG DƯƠNG: SỬA TAY một shim ⇒ CHẶN, và gọi đúng tên', () => {
    const r = voiShimHong('run_report_reader', (s) => `${s}\nmột dòng thêm bằng tay\n`, () => chay(['--check']));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/SỬA TAY/);
    expect(r.out).toContain('run_report_reader');
  });

  test('ĐỐI CHỨNG DƯƠNG: THIẾU shim ⇒ CHẶN', () => {
    const d = path.join(SHIM, 'run_report_reader');
    const f = path.join(d, 'SKILL.md');
    const cu = fs.readFileSync(f, 'utf8');
    try {
      fs.rmSync(d, { recursive: true, force: true });
      const r = chay(['--check']);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/THIẾU shim/);
    } finally {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(f, cu, 'utf8');
    }
  });

  test('ĐỐI CHỨNG DƯƠNG: shim THỪA (skill gốc không còn) ⇒ CHẶN', () => {
    /*
     * Chiều này dễ bị bỏ quên nhất, và nó mới là chiều hại: agent thấy skill trong danh sách, mở ra, và
     * gặp một con trỏ chết.
     */
    const d = path.join(SHIM, 'skill_khong_ton_tai');
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: x\ndescription: y\n---\n', 'utf8');
      const r = chay(['--check']);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/THỪA/);
      expect(r.out).toContain('skill_khong_ton_tai');
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('ĐỐI CHỨNG ÂM: sau `--write` thì `--check` phải sạch ngay', () => {
    expect(chay(['--write']).code).toBe(0);
    const r = chay(['--check']);
    expect(r.code, r.out).toBe(0);
  });

  test('phép kiểm này TĨNH — nó KHÔNG chứng minh harness nạp thật', () => {
    /*
     * Ghi thẳng giới hạn vào spec, vì đây đúng là chỗ dễ đọc nhầm nhất: "28 shim khớp nguồn" KHÔNG
     * đồng nghĩa "harness đã nạp 28 skill". Chuyện sau chỉ nghiệm thu được ở một phiên khởi động SAU
     * khi shim có trên đĩa, và số đo phải nằm ở `docs/v2.9.6/BASELINE.md`.
     */
    const src = fs.readFileSync(__filename.replace(/\.js$/, '.ts'), 'utf8');
    expect(src).toMatch(/KHÔNG chứng minh harness thật sự nạp/);
    const gateSrc = fs.readFileSync(GATE, 'utf8');
    expect(gateSrc, 'gate phải nói rõ shim là con trỏ').toMatch(/CON TRỎ, KHÔNG PHẢI BẢN SAO/);
  });
});
