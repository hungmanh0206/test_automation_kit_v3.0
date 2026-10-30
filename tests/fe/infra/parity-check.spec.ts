/*
 * @infra `parity:check` — gác chính bảng nghiệm thu `docs/v2.9.5/A_PARITY.md`.
 *
 * Bảng nghiệm thu là lớp DẪN XUẤT viết tay, và mọi bảng viết tay trong kit đều đã trôi ít nhất một lần.
 * Bảng nghiệm thu trôi thì tệ hơn bảng thường: nó là thứ người ta đọc để tin rằng đợt làm đã xong.
 *
 * HAI LỖI CỦA CHÍNH TÔI mà cửa này bắt được ngay lượt chạy đầu:
 *   · phần mở đầu của tài liệu dùng chính cụm từ mà luật cấm, nên nó tự chặn mình (lần thứ TƯ trong
 *     phiên một đoạn văn tự gây ra phép kiểm nó đang giải thích). Đã đổi lời, KHÔNG thêm miễn trừ.
 *   · bảng nhắc `npm run manual:run:check` — một tên máy KHÔNG TỒN TẠI (tên thật là `manual:check`).
 *     Một tên bịa làm hỏng cả bảng chứ không chỉ một dòng, vì người đọc mất cách kiểm lại từng dòng.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/parity_check.js');
const DOC = path.join(REPO, 'docs/v2.9.5/A_PARITY.md');

const chay = (argv: string[] = []) => {
  const r = spawnSync(process.execPath, [GATE, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/** Ghi một bản bảng đã sửa ra file tạm — KHÔNG sửa bảng thật. */
function bangTam(bien: (s: string) => string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
  const f = path.join(d, 'A_PARITY.md');
  fs.writeFileSync(f, bien(fs.readFileSync(DOC, 'utf8')), 'utf8');
  return { d, f };
}

test.describe('@infra parity:check', () => {
  test('bảng THẬT đạt, và in ra đủ ba con số', () => {
    const r = chay();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/✅ đã làm \d+ · ⛔ cố ý không port \d+ · ⚠️ chưa có máy \d+/);
    /* Dòng tổng phải nói ĐÚNG: bản đầu in `⛔ 0 · ⚠️ 0` trong khi hai khối đó có 5 và 6 dòng. */
    expect(r.out, 'hai khối kia KHÔNG được in ra 0').not.toMatch(/⛔ cố ý không port 0/);
    expect(r.out).not.toMatch(/⚠️ chưa có máy 0/);
  });

  test('mục con `###` trong khối KHÔNG được đếm lẫn vào số "chưa có máy"', () => {
    /*
     * Lỗi thật: thêm một mục `### Ghi chú` kèm bảng 4 dòng vào khối CHƯA CÓ MÁY làm số nhảy 6 → 11.
     * Bản trước của `demKhoi` chỉ dừng ở `##`. Dòng tổng của cửa mà nói sai về chính tài liệu nó đang
     * gác thì nó dạy người đọc tin một con số rỗng.
     */
    const s = fs.readFileSync(DOC, 'utf8');
    const i = s.indexOf('## Chỗ ĐÃ LÀM nhưng CHƯA CÓ MÁY');
    const j = s.indexOf('### Ghi chú', i);
    expect(j, 'tài liệu phải CÓ mục con trong khối, nếu không phép kiểm này rỗng').toBeGreaterThan(i);

    const r = chay();
    expect(r.code, r.out).toBe(0);
    const m = r.out.match(/⚠️ chưa có máy (\d+)/);
    expect(m, 'phải in số "chưa có máy"').toBeTruthy();
    const n = Number(m![1]);
    /* Số dòng bảng NGAY dưới tiêu đề khối, trước mục con đầu tiên. */
    const that = s.slice(i, j).split('\n')
      .filter((l) => l.trim().startsWith('|') && !/^\|[\s|:-]*\|$/.test(l.trim()) && !/^\| Việc \|/.test(l.trim()))
      .length;
    expect(n, `cửa in ${n}, bảng thật có ${that} dòng`).toBe(that);
  });

  test('ĐỐI CHỨNG DƯƠNG: một dòng còn dấu hiệu TREO ⇒ CHẶN', () => {
    const t = bangTam((s) => s.replace('| ✅ |', '| TBD |'));
    const r = chay(['--file', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('TREO');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: nhắc npm script KHÔNG tồn tại ⇒ CHẶN', () => {
    /* Đây là lỗi thật của bản đầu: bảng ghi `manual:run:check`, tên thật là `manual:check`. */
    const t = bangTam((s) => s.replace('npm run router:check', 'npm run khong-he-co-may-nay'));
    const r = chay(['--file', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('khong-he-co-may-nay');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: thiếu khối "CHƯA CÓ MÁY" ⇒ CHẶN', () => {
    /*
     * Khối này là khối dễ bị bỏ nhất, vì nó là chỗ tài liệu tự nhận còn thiếu. Thiếu nó là dấu hiệu
     * bảng đang kể một phiên bản đẹp hơn thực tế.
     */
    const t = bangTam((s) => s.replace(/^##+\s*Chỗ ĐÃ LÀM nhưng CHƯA CÓ MÁY.*$/im, '## Ghi chú khác'));
    const r = chay(['--file', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/thiếu khối \*\*CHƯA CÓ MÁY\*\*/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: khối "CHƯA CÓ MÁY" rỗng ⇒ CHẶN', () => {
    /* Một đợt làm KHÔNG còn chỗ nào thiếu máy là lời khai đáng ngờ hơn đáng mừng. */
    const t = bangTam((s) => {
      const L = s.split('\n');
      const i = L.findIndex((l) => /^##+\s*Chỗ ĐÃ LÀM nhưng CHƯA CÓ MÁY/i.test(l));
      const j = L.findIndex((l, k) => k > i && /^##\s/.test(l));
      return [...L.slice(0, i + 1), '', 'Không còn gì.', '', ...L.slice(j < 0 ? L.length : j)].join('\n');
    });
    const r = chay(['--file', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/rỗng/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": thiếu bảng, và bảng 0 dòng ⇒ exit 2', () => {
    expect(chay(['--file', path.join(os.tmpdir(), 'khong-co-parity.md')]).code).toBe(2);

    const t = bangTam(() => '# Rỗng\n\nkhông có bảng nào.\n');
    const r = chay(['--file', t.f]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/KHÔNG đồng nghĩa với "đạt"/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: đọc ký hiệu và tên máy, không đọc nghĩa', () => {
    const src = fs.readFileSync(GATE, 'utf8');
    expect(src).toMatch(/KHÔNG đọc nghĩa|không đọc nghĩa/);
    expect(src, 'phải trỏ chỗ đối chiếu thật').toMatch(/tests\/fe\/infra/);
  });

  test('bảng KHÔNG tự xưng là "B hơn A" — nó chỉ nói chỗ A hơn đã xử lý thế nào', () => {
    /*
     * Một bảng parity rất dễ biến thành bảng khoe. Mẫu số của nó là thứ A đã làm, nên `100%` của nó
     * không nói gì về chỗ cả hai đều không có — và tài liệu phải tự ghi điều đó.
     */
    const s = fs.readFileSync(DOC, 'utf8');
    expect(s).toMatch(/không nói "B hơn A"|KHÔNG chứng minh/);
    expect(s, 'phải tự ghi giới hạn mẫu số').toMatch(/Mẫu số vẫn là thứ A đã làm/);
    expect(s, 'phải tự ghi rằng máy có mặt ≠ phép đo đúng').toMatch(/Máy có mặt ≠ phép đo đúng/);
  });
});
