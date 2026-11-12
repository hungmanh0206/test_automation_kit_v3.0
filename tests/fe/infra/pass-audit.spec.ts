/**
 * pass:audit — đo tỉ lệ PASS SAI bằng mẫu ngẫu nhiên người chấm lại.
 *
 * Mỗi ca giữ một chốt chặn đường làm con số đẹp mà sai: chọn case bằng tay, bỏ case khó, sửa phần đầu phiếu, đọc lời
 * khai của automation trước khi chấm, coi "không phán được" là đúng, để agent tự chấm verdict của agent.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { thuMucTam } from './_thu_muc_tam';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pa = require(path.join(REPO, 'scripts/qa/pass_audit.js'));

const ID = (i: number) => `X_TC_${String(i).padStart(3, '0')}`;
const MD = (ids: string[]) => [
  '| TC ID | Trường hợp kiểm thử | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi |',
  '|---|---|---|---|---|',
  ...ids.map((id) => `| ${id} | Tiêu đề ${id} | dữ liệu ${id} | 1. Bấm | Kỳ vọng của ${id}<br>dòng hai |`),
].join('\n');
const buoc = (id: string) => ({
  tcId: id, status: 'PASSED', comment: 'LỜI KHAI CẤP CASE',
  steps: [
    { name: 'Bước 1 — Đúng 3 lựa chọn, đúng từng ký tự', status: 'PASSED', comment: 'LỜI KHAI CỦA STEP', evidence: [`ev/${id}/step-01-passed.png`] },
    { name: 'Hậu kiểm', status: 'PASSED', evidence: [`ev/${id}/step-01-passed.png`, `ev/${id}/log.json`] },
  ],
});

test.describe('@infra pass:audit — bốc mẫu', () => {
  test('cùng seed ⇒ cùng mẫu; khác seed ⇒ khác; không trùng; không vượt tổng thể', () => {
    const tt = Array.from({ length: 50 }, (_, i) => ID(i));
    const a = pa.boc(tt, 10, 7);
    expect(pa.boc([...tt].reverse(), 10, 7), 'thứ tự đầu vào không đổi được mẫu').toEqual(a);
    expect(pa.boc(tt, 10, 8)).not.toEqual(a);
    expect(new Set(a).size).toBe(10);
    expect(pa.boc(tt.slice(0, 3), 10, 7)).toHaveLength(3);
  });

  test('tổng thể chỉ gồm case PASSED CÓ trong testcase canonical; phần thiếu được nêu ra', () => {
    const status = { tests: [{ tcId: ID(1), status: 'PASSED' }, { tcId: ID(2), status: 'FAILED' }, { tcId: ID(3), status: 'PASSED' }, { tcId: ID(9), status: 'PASSED' }] };
    const r = pa.tongTheTu(status, [{ id: ID(1) }, { id: ID(2) }, { id: ID(3) }]);
    expect(r.coThe).toEqual([ID(1), ID(3)]);
    expect(r.thieuMd).toEqual([ID(9)]);
  });
});

test.describe('@infra pass:audit — phiếu chấm', () => {
  const mk = () => pa.phieu({
    maMau: 'M1', task: 'T', seed: 1, tongThe: [ID(1), ID(2)], chon: [ID(1), ID(2)],
    caseMd: [{ id: ID(1), tieuDe: 'tiêu đề 1', duLieu: 'dl', kyVong: 'Kỳ vọng 1<br>dòng hai' }, { id: ID(2), tieuDe: 't2', duLieu: '', kyVong: 'k2' }],
    tests: [buoc(ID(1)), { tcId: ID(2), status: 'PASSED' }], thuMucPhieu: path.join(REPO, 'r'),
  });

  test('KHÔNG chứa lời khai của automation — cả comment lẫn TÊN bước', () => {
    const p = mk();
    expect(p).not.toContain('LỜI KHAI');
    expect(p, 'tên bước "Đúng 3 lựa chọn" là kết luận của agent — đọc nó là bị neo').not.toContain('Đúng 3 lựa chọn');
    expect(p).toContain('Kỳ vọng 1 · dòng hai');
  });

  test('ảnh trùng giữa các bước liệt kê một lần; tệp không phải ảnh bị bỏ; case không ảnh nói rõ', () => {
    const p = mk();
    expect(p.match(/step-01-passed\.png\]/g)).toHaveLength(1);
    expect(p).not.toContain('log.json');
    expect(p).toMatch(/không có ảnh — chỉ chấm được `khong_phan_duoc`/);
  });
});

test.describe('@infra pass:audit — nhập phiếu', () => {
  const mau = { maMau: 'M1', chon: [ID(1), ID(2)], bam: pa.bam([ID(1), ID(2)]) };
  const dien = (o: { nguoi?: string; bam?: string; kq?: Record<string, [string, string]> } = {}) => [
    '- ma_mau: M1',
    `- seed: 1 · tổng thể 2 case PASS · bốc 2 · bam ${o.bam || mau.bam}`,
    `- nguoi_cham: ${o.nguoi === undefined ? 'Nguyễn Văn A' : o.nguoi}`,
    ...Object.entries(o.kq || { [ID(1)]: ['dung', ''], [ID(2)]: ['khong_phan_duoc', ''] }).flatMap(([id, [k, l]]) => [`ket_luan[${id}]: ${k}`, `ly_do[${id}]: ${l}`]),
  ].join('\n');
  const loi = (o?: any, m: any = mau) => pa.kiemPhieu(pa.docPhieu(dien(o)), m).join(' | ');

  test('phiếu đủ và đúng ⇒ 0 lỗi', () => {
    expect(loi()).toBe('');
  });

  test('bỏ case khó ⇒ TỪ CHỐI', () => {
    expect(loi({ kq: { [ID(1)]: ['dung', ''] } })).toMatch(/thiếu 1 case/);
  });

  test('chèn case ngoài mẫu ⇒ TỪ CHỐI', () => {
    expect(loi({ kq: { [ID(1)]: ['dung', ''], [ID(2)]: ['dung', ''], [ID(7)]: ['dung', ''] } })).toMatch(/KHÔNG thuộc mẫu/);
  });

  test('sửa phần đầu phiếu ⇒ TỪ CHỐI', () => {
    expect(loi({ bam: '0000000000000000' })).toMatch(/bam/);
  });

  test('người chấm là máy hoặc để trống ⇒ TỪ CHỐI', () => {
    expect(loi({ nguoi: 'Claude' })).toMatch(/app==app/);
    expect(loi({ nguoi: 'agent QA' })).toMatch(/app==app/);
    expect(loi({ nguoi: '' })).toMatch(/thiếu `nguoi_cham`/);
  });

  test('kết luận lạ, hoặc "sai" mà không nói vì sao ⇒ TỪ CHỐI', () => {
    expect(loi({ kq: { [ID(1)]: ['ok', ''], [ID(2)]: ['dung', ''] } })).toMatch(/phải là dung \| sai \| khong_phan_duoc/);
    expect(loi({ kq: { [ID(1)]: ['sai', 'x'], [ID(2)]: ['dung', ''] } })).toMatch(/ly_do/);
    expect(loi({ kq: { [ID(1)]: ['sai', 'ảnh 2 hiện 4 lựa chọn, kỳ vọng 3'], [ID(2)]: ['dung', ''] } })).toBe('');
  });

  test('mẫu đã ghi ⇒ không ghi lần hai; mẫu không có trong sổ ⇒ TỪ CHỐI', () => {
    expect(loi(undefined, { ...mau, ketQua: {}, ghiLuc: 'hôm qua' })).toMatch(/ĐÃ được ghi/);
    expect(loi(undefined, null)).toMatch(/không có mẫu/);
  });
});

test.describe('@infra pass:audit — tính tỉ lệ', () => {
  test('"không phán được" KHÔNG thành đúng: tỉ lệ trên phần phán được, kèm hai cận trên toàn mẫu', () => {
    const k = (n: number, v: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${v}${i}`, { ketLuan: v, lyDo: v === 'sai' ? 'ảnh khác kỳ vọng' : '' }]));
    const t = pa.tinh([{ task: 'T', ketQua: { ...k(6, 'dung'), ...k(2, 'sai'), ...k(2, 'khong_phan_duoc') } }]);
    expect([t.n, t.dung, t.sai, t.khong_phan_duoc]).toEqual([10, 6, 2, 2]);
    expect(t.tiLeSai).toBeCloseTo(0.25, 5);
    expect(t.canDuoi).toBeCloseTo(0.2, 5);
    expect(t.canTren).toBeCloseTo(0.4, 5);
    expect(t.caSai).toHaveLength(2);
  });

  test('0 sai trên 20 vẫn có cận trên ~16% — "chưa thấy sai" không phải "không sai"', () => {
    const [d, tr] = pa.wilson(0, 20);
    expect(d).toBe(0);
    expect(tr).toBeGreaterThan(0.15);
    expect(tr).toBeLessThan(0.17);
    expect(pa.wilson(0, 0)).toBeNull();
  });
});

test.describe('@infra pass:audit — CLI trọn vòng', () => {
  test('bốc → điền → ghi → báo cáo; ghi lần hai bị từ chối; chưa chấm ⇒ exit 2', () => {
    const goc = thuMucTam('pass-audit');
    const po = path.relative(REPO, goc);
    const tdir = path.join(goc, 'tasks', 'T-1');
    fs.mkdirSync(path.join(tdir, 'test-results'), { recursive: true });
    fs.mkdirSync(path.join(tdir, 'test-cases'), { recursive: true });
    const ids = Array.from({ length: 12 }, (_, i) => ID(i));
    fs.writeFileSync(path.join(tdir, 'test-cases', 'a.md'), MD(ids));
    fs.writeFileSync(path.join(tdir, 'test-results', 'testcase-status.json'), JSON.stringify({ runId: 'r1', tests: ids.map(buoc) }));
    const so = path.join(goc, 'so.json');
    const chay = (...a: string[]) => spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/pass_audit.js'), '--so', so, ...a], { encoding: 'utf8', cwd: REPO, env: gateEnv() });

    try {
      expect(chay('--task', 'T-1').status, 'chưa chấm mẫu nào').toBe(2);
      const b = chay('--task', 'T-1', '--chon', '5', '--seed', '3', '--project-output', po);
      expect(b.status, b.stderr).toBe(0);
      const thu = path.join(tdir, 'reports', 'pass-audit');
      const f = path.join(thu, fs.readdirSync(thu)[0]);
      const ledger = JSON.parse(fs.readFileSync(so, 'utf8'));
      expect(ledger.mau[0].chon).toEqual(pa.boc(ids, 5, 3));
      expect(chay('--task', 'T-1').stdout, 'mẫu chờ chấm được nêu').toMatch(/1 mẫu đang chờ chấm/);

      let md = fs.readFileSync(f, 'utf8').replace(/^- nguoi_cham: $/m, '- nguoi_cham: Trần Thị B');
      let i = 0;
      md = md.replace(/^ket_luan\[([^\]]+)\]: $/gm, (_m: string, id: string) => `ket_luan[${id}]: ${['sai', 'dung', 'khong_phan_duoc', 'dung', 'dung'][i++]}`);
      md = md.replace(/^ly_do\[([^\]]+)\]: $/m, (_m: string, id: string) => `ly_do[${id}]: ảnh 1 hiện thông báo khác kỳ vọng`);
      fs.writeFileSync(f, md);
      const g = chay('--ghi', f);
      expect(g.status, g.stderr).toBe(0);
      expect(chay('--ghi', f).status, 'ghi lần hai').toBe(1);

      const r = chay('--task', 'T-1');
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/3 đúng · 1 SAI · 1 không phán được/);
      expect(r.stdout).toMatch(/tỉ lệ PASS sai \(trên 4 case phán được\): 25\.0%/);
      expect(r.stdout).toMatch(/20\.0% \(coi "không phán được" là đúng\) – 40\.0% \(coi là sai\)/);
      expect(r.stdout).toMatch(/mới 5 case — khoảng tin cậy còn rộng/);
    } finally {
      fs.rmSync(goc, { recursive: true, force: true });
    }
  });
});
