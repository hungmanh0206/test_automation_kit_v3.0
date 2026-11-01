/*
 * `frontmatter:check` — file định nghĩa agent/skill phải THẬT SỰ NẠP ĐƯỢC (v2.9.6 N8).
 *
 * LỖ ĐÃ ĐO RA. `.claude/agents/case-debugger.md` vào repo từ 10–11/10/2026 và **chưa bao giờ được harness
 * đăng ký** — quan sát ở BA phiên. `Agent(case-debugger)` trả `Agent type 'case-debugger' not found`.
 *
 * TÔI ĐOÁN SAI SUỐT BA PHIÊN. Khác biệt duy nhất tôi thấy là file thiếu dòng `model:`, nên tôi ghi vào
 * tài liệu rằng đó là nghi vấn chính — và còn ghi rằng "mọi giả thuyết khác đã loại". Tài liệu Claude
 * Code nói `model:` là **TUỲ CHỌN** (chỉ `name` + `description` bắt buộc) và liệt kê các điều kiện làm
 * file bị BỎ QUA, trong đó có **YAML không parse được**.
 *
 * Parse bằng parser thật thì ra ngay: `description` chứa `: ` mà không bọc nháy ⇒ `Nested mappings are
 * not allowed in compact mappings`. Quét toàn bộ: **5/75** file frontmatter vỡ cùng kiểu.
 *
 * Bài học nằm ở chỗ tôi dừng quá sớm: tôi so ba file bằng MẮT, thấy một khác biệt, rồi gọi phần còn lại
 * là "đã loại". Thứ lôi ra sự thật là một parser — tức một phép đo, không phải một vòng so sánh nữa.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/frontmatter_check.js');

/** Dựng một cây tạm có `.claude/agents/<tên>.md`. */
function dungCay(ten: string, fm: string, than = '\nThân file.\n') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fmchk-'));
  fs.mkdirSync(path.join(d, '.claude/agents'), { recursive: true });
  fs.writeFileSync(path.join(d, '.claude/agents', `${ten}.md`), `---\n${fm}\n---\n${than}`, 'utf8');
  return d;
}
function chay(dir: string) {
  const r = spawnSync(process.execPath, [GATE, '--dir', dir], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const OK_FM = 'name: a-agent\ndescription: Mot viec gi do, khong co dau hai cham\ntools: Bash, Read';

test.describe('@infra frontmatter:check — định nghĩa phải nạp được', () => {
  test('ĐỐI CHỨNG ÂM: repo THẬT ⇒ ĐẠT, và in ra mẫu số', () => {
    const r = spawnSync(process.execPath, [GATE], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    expect(r.status, out).toBe(0);
    expect(out, 'phải in số file đã soi, nếu không "đạt" là lời khai rỗng').toMatch(/\d+ file có frontmatter/);
    expect(out, 'và phải tự khai giới hạn').toMatch(/KHÔNG parse YAML/);
  });

  test('ĐỐI CHỨNG DƯƠNG: giá trị chứa `: ` không bọc nháy ⇒ CHẶN, nói rõ hậu quả', () => {
    /* Đúng lỗi đã làm `case-debugger` không đăng ký suốt 20 ngày. */
    const d = dungCay('a-agent', 'name: a-agent\ndescription: Go MOT case do: doc log va anh FAIL\ntools: Bash');
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/chứa `: ` mà KHÔNG bọc nháy/);
    expect(r.out, 'phải nói hậu quả là bị bỏ qua IM LẶNG, không chỉ "sai cú pháp"').toMatch(/bỏ qua im lặng/);
    expect(r.out, 'và nói cách sửa').toMatch(/Bọc cả giá trị trong nháy đôi/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: cùng giá trị đó mà BỌC NHÁY ⇒ sạch', () => {
    const d = dungCay('a-agent', 'name: a-agent\ndescription: "Go MOT case do: doc log va anh FAIL"\ntools: Bash');
    expect(chay(d).code, chay(d).out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: thiếu `name` hoặc `description` ⇒ CHẶN', () => {
    const a = dungCay('a-agent', 'description: khong co ten');
    expect(chay(a).code).toBe(1);
    expect(chay(a).out).toMatch(/THIẾU `name`/);
    fs.rmSync(a, { recursive: true, force: true });

    const b = dungCay('a-agent', 'name: a-agent');
    expect(chay(b).code).toBe(1);
    expect(chay(b).out).toMatch(/THIẾU `description`/);
    fs.rmSync(b, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: `name` KHÁC tên file ⇒ CHẶN', () => {
    /*
     * Harness tra agent theo TÊN FILE và skill theo TÊN THƯ MỤC. Lệch thì gọi theo tên nào cũng có
     * đường trượt, và triệu chứng lại giống hệt "không đăng ký".
     */
    const d = dungCay('a-agent', 'name: ten-khac\ndescription: mo ta gi do');
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/KHÁC chỗ harness tra/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: giá trị mở đầu bằng ký tự CÚ PHÁP của YAML ⇒ CHẶN', () => {
    for (const c of ['{', '[', '*', '!', '|']) {
      const d = dungCay('a-agent', `name: a-agent\ndescription: ${c}mo ta`);
      const r = chay(d);
      expect(r.code, `ký tự "${c}" phải bị chặn — ${r.out}`).toBe(1);
      expect(r.out).toMatch(/YAML coi đó là cú pháp/);
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test('ĐỐI CHỨNG DƯƠNG: giá trị chứa ` #` ⇒ CHẶN (YAML cắt thành chú thích)', () => {
    const d = dungCay('a-agent', 'name: a-agent\ndescription: mo ta #phan nay bi cat');
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/cắt phần sau thành chú thích/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: frontmatter MỞ mà không ĐÓNG ⇒ CHẶN', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fmchk-'));
    fs.mkdirSync(path.join(d, '.claude/agents'), { recursive: true });
    fs.writeFileSync(path.join(d, '.claude/agents/a-agent.md'), '---\nname: a-agent\ndescription: x\n', 'utf8');
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/MỞ mà không ĐÓNG/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: file văn xuôi KHÔNG có frontmatter thì không bị kêu', () => {
    /*
     * `.agent/workflows` và `references/` có nhiều file văn xuôi thuần. Kêu chúng là tiếng ồn, và tiếng
     * ồn làm người đọc bỏ qua cả dòng thật.
     */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fmchk-'));
    fs.mkdirSync(path.join(d, '.agent/workflows'), { recursive: true });
    fs.writeFileSync(path.join(d, '.agent/workflows/ghi-chu.md'), '# Ghi chú\n\nVăn xuôi thuần.\n', 'utf8');
    expect(chay(d).code, chay(d).out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('"KHÔNG phán được" KHÔNG thành "đạt": 0 file ⇒ exit 2', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fmchk-'));
    const r = chay(d);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/KHÔNG đồng nghĩa với "đạt"/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('CỬA KHÔNG RỖNG: nó bắt đúng nội dung Ở HEAD TRƯỚC khi vá', () => {
    /*
     * Phép kiểm quan trọng nhất ở file này. Một cửa mới luôn xanh trên cây đã vá; điều cần chứng minh là
     * nó ĐÃ đỏ trên cây chưa vá. Lấy nội dung thật từ git, không dựng giả.
     */
    const cu = spawnSync('git', ['log', '--diff-filter=M', '-1', '--format=%H', '--', '.claude/agents/case-debugger.md'],
      { cwd: REPO, encoding: 'utf8' });
    const sha = String(cu.stdout || '').trim().split('\n')[0];
    test.skip(!sha, 'chưa có commit nào sửa file này để lấy bản trước');

    const truoc = spawnSync('git', ['show', `${sha}^:.claude/agents/case-debugger.md`], { cwd: REPO, encoding: 'utf8' });
    test.skip(truoc.status !== 0, 'không lấy được bản trước từ git');

    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fmchk-head-'));
    fs.mkdirSync(path.join(d, '.claude/agents'), { recursive: true });
    fs.writeFileSync(path.join(d, '.claude/agents/case-debugger.md'), truoc.stdout, 'utf8');
    const r = chay(d);
    expect(r.code, `bản TRƯỚC khi vá phải bị CHẶN, nếu không cửa này rỗng — ${r.out}`).toBe(1);
    expect(r.out).toMatch(/chứa `: ` mà KHÔNG bọc nháy/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('cửa nằm trong bó `predeploy` — kit phát hành kèm agent không nạp được là kit hỏng', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/predeploy_gate.js'), 'utf8');
    expect(src).toMatch(/ten: 'frontmatter:check'/);
  });
});
