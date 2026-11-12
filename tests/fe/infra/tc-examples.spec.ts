/*
 * @infra Ba dòng TC ví dụ của `tc_design_guide` phải TỰ QUA GATE (v2.9.5 §3.1).
 *
 * VÌ SAO CẦN SPEC NÀY. Một ví dụ trong tài liệu là thứ người ta CHÉP. Ví dụ sai thì nó không sai một
 * lần — nó sai ở mọi bộ TC chép theo nó, và không gate nào biết vì gate chỉ soi bộ TC thật, không soi
 * tài liệu dạy cách viết bộ TC.
 *
 * Nên ba ví dụ đó đi qua ĐÚNG những cửa mà một bộ TC thật phải đi: `gate:gen-testcase`, `tc:review`,
 * `dim:coverage`. Và chúng phải neo vào rule CÓ THẬT trong `knowledge/domain/`, không phải rule bịa —
 * một ví dụ neo vào `BR-XXX-001` không tồn tại dạy người đọc rằng oracle-ref chỉ là trang trí.
 *
 * ĐO ĐƯỢC GÌ KHI VIẾT: chính ba cửa này đã bắt bốn chỗ tôi viết sai ở bản đầu — `[hook]` không phải tag
 * hợp lệ (phải `[test_hook]`), bước phải bọc CẢ nhãn ô LẪN giá trị, Tiền điều kiện phải nêu vai trò cụ
 * thể (chữ "QA" bị tính là actor chung chung), và một bước chỉ một thao tác. Sau khi sửa: `tc:review`
 * 100.0%, `gate:gen-testcase` 0 chặn 0 cảnh báo.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const TECH = path.join(REPO, '.agent/skills/phase1/tc_design_guide/references/techniques.md');
/*
 * KHO RULE của ví dụ (v3.0.0): fixture đi KÈM test, không đọc `knowledge/domain/` của máy. Bản trước đọc kho
 * của dự án đang chạy — ở dự án khác hay trong gói thì kho rỗng và hai ca dưới lặng lẽ `skip`, tức tài liệu
 * dạy viết oracle-ref lại không ai gác oracle-ref của chính nó.
 */
const KHO_VI_DU = path.join(REPO, 'tests/fixtures/tc-examples/domain');
const RE_VD = /^\|\s*(HSTRUONG|BCDN|NHANSU)_TC_/;

function bocViDu() {
  const L = fs.readFileSync(TECH, 'utf8').split(/\r?\n/);
  const head = L.find((l) => l.startsWith('| TC ID |'));
  const rows = L.filter((l) => RE_VD.test(l));
  return { head, rows };
}

/** Dựng một task GIẢ chứa đúng ba dòng ví dụ, rồi chạy gate thật trên đó. */
function dungTask(rows: string[], head?: string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tcvd-'));
  const tc = path.join(d, 'tasks', 'VD-001', 'test-cases');
  fs.mkdirSync(tc, { recursive: true });
  fs.writeFileSync(path.join(tc, 'vd.md'), ['# Ví dụ TC', '', head, `|${'---|'.repeat(10)}`, ...rows, ''].join('\n'), 'utf8');
  return { d, file: path.join(tc, 'vd.md') };
}

const moiTruong = (d: string) => ({ ...gateEnv(), TASK_KEY: 'VD-001', PROJECT_OUTPUT_DIR: d });

test.describe('@infra ví dụ TC — ba dòng phải tự qua gate', () => {
  test('bóc được ĐÚNG 3 dòng ví dụ, mỗi dòng một kỹ thuật khác nhau', () => {
    const { head, rows } = bocViDu();
    expect(head, 'techniques.md mất bảng 10 cột ⇒ mọi test dưới đây thành phép kiểm rỗng').toBeTruthy();
    expect(rows.length, 'phải có đúng 3 dòng ví dụ').toBe(3);
    for (const ky of ['[BVA]', '[DT]', '[ST]']) {
      expect(rows.some((r) => r.includes(ky)), `thiếu ví dụ cho kỹ thuật ${ky}`).toBe(true);
    }
  });

  test('`gate:gen-testcase`: 0 CHẶN và 0 CẢNH BÁO', () => {
    /* Cảnh báo cũng không được có: ví dụ mẫu mà bị cảnh báo thì nó dạy đúng cái bị cảnh báo. */
    const { head, rows } = bocViDu();
    const t = dungTask(rows, head);
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/output_gate.js'), '--mode', 'gen-testcase', '--file', t.file], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${r.stdout}${r.stderr}`;
    expect(r.status, out).toBe(0);
    expect(out).toMatch(/0 CHẶN · 0 cảnh báo/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('`tc:review`: điểm 100% — ví dụ mẫu không được chỉ "đủ điểm qua"', () => {
    const { head, rows } = bocViDu();
    const t = dungTask(rows, head);
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/tc_review.js')], { cwd: REPO, encoding: 'utf8', env: moiTruong(t.d) });
    const out = `${r.stdout}${r.stderr}`;
    expect(r.status, out).toBe(0);
    const m = /trung bình ([\d.]+)%/.exec(out);
    expect(m, out).not.toBeNull();
    expect(Number(m![1]), 'ví dụ mẫu phải đạt 100% — nó là thứ người ta chép').toBe(100);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('`dim:coverage` chạy được trên bộ ví dụ', () => {
    const { head, rows } = bocViDu();
    const t = dungTask(rows, head);
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/dimension_coverage.js')], { cwd: REPO, encoding: 'utf8', env: moiTruong(t.d) });
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: làm hỏng một ví dụ ⇒ gate ĐỎ', () => {
    /*
     * Không có vế này thì ba test trên chỉ chứng minh "gate không chặn gì cả". Cài đúng lỗi mà gate
     * sinh ra để chặn: gộp hai ý vào Kết quả bằng dấu `;`.
     */
    const { head, rows } = bocViDu();
    const hong = rows.map((r) => r.replace(/<br>- Giá trị trên lưới KHÔNG đổi/, '; giá trị trên lưới KHÔNG đổi'));
    expect(hong.join('\n'), 'không cài được lỗi ⇒ đối chứng rỗng').not.toBe(rows.join('\n'));
    const t = dungTask(hong, head);
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/output_gate.js'), '--mode', 'gen-testcase', '--file', t.file], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(`${r.stdout}${r.stderr}`, 'gate phải kêu khi ví dụ bị làm hỏng').toMatch(/cảnh báo|CHẶN/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });
});

test.describe('@infra ví dụ TC — oracle-ref phải là rule CÓ THẬT', () => {
  test('mọi `BR-…` trong ví dụ đều tồn tại trong `knowledge/domain/`', () => {
    /*
     * Một ví dụ neo vào `BR-XXX-001` không tồn tại dạy người đọc rằng oracle-ref chỉ là trang trí. Và
     * `domain:check` đã có luật "oracle ma" cho bộ TC thật — tài liệu dạy cách viết bộ TC thì cũng phải
     * chịu cùng một luật, không được miễn.
     */
    const { rows } = bocViDu();
    const refs = [...new Set(rows.join('\n').match(/BR-[A-Z0-9]+-\d{3}/g) || [])];
    expect(refs.length, 'ví dụ phải mang oracle-ref').toBeGreaterThanOrEqual(3);
    const co = new Set(fs.readdirSync(KHO_VI_DU).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '').toUpperCase()));
    expect(co.size, 'kho rule ví dụ rỗng ⇒ phép đối chiếu rỗng').toBeGreaterThanOrEqual(3);
    const thieu = refs.filter((r) => !co.has(r));
    expect(thieu, `oracle-ref không có rule thật: ${thieu.join(' · ')}`).toEqual([]);
  });

  test('ví dụ TRÍCH được nguyên văn rule, không diễn giải lại', () => {
    /*
     * Ví dụ phải cho thấy expected đến TỪ ĐÂU. Mỗi ví dụ nêu neo kèm một đoạn trích, và đoạn trích đó
     * phải khớp ô `rule` của chính file neo — nếu không, nó là lời diễn giải của tôi đội tên đặc tả.
     */
    const src = fs.readFileSync(TECH, 'utf8');
    for (const id of ['BR-HSTRUONG-033', 'BR-BCDN-002', 'BR-NHANSU-003']) {
      const f = path.join(KHO_VI_DU, `${id.toLowerCase()}.json`);
      expect(fs.existsSync(f), `thiếu rule ${id} mà ví dụ trích`).toBe(true);
      const rule = String(JSON.parse(fs.readFileSync(f, 'utf8')).rule || '');
      /* Lấy một cụm đủ dài và đủ đặc trưng từ rule rồi đòi nó xuất hiện trong tài liệu. */
      const cum = rule.split(/[;.]/).map((x) => x.trim()).filter((x) => x.length > 28)[0];
      expect(cum, `${id}: rule quá ngắn để lấy cụm đối chiếu`).toBeTruthy();
      expect(src, `${id}: ví dụ không trích được nguyên văn rule — đang diễn giải lại`).toContain(cum!.slice(0, 28));
    }
  });
});
