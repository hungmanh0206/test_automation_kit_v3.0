/*
 * SMOKE GATE đầu /phase3 — phán xử và hợp đồng nhãn. OFFLINE, không chạm UAT.
 *
 * Cửa này tồn tại vì "smoke đỏ" gộp hai thứ trái ngược: môi trường chết (phải DỪNG) và thư viện neo đã
 * cũ (môi trường vẫn sống, dừng là chặn oan). Spec gác đúng ranh giới đó.
 *
 * ĐÃ CHẠY THẬT trên app fixture `discovery-app` ngày 16/11/2026, sáu kịch bản, đều ra đúng verdict:
 * sạch → SACH · neo trôi → CANH_BAO/neo-troi · URL cũ → CANH_BAO/khong-thay-man · 5xx một màn →
 * CANH_BAO/loi-may-chu · bị đẩy về /Login.aspx → DUNG/setup_failure · cổng đóng → DUNG/infra.
 * Spec này gác phần PHÁN XỬ và phần SINH; chạy Playwright lồng trong Playwright thì quá nặng cho làn infra.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { thuMucTam } from './_thu_muc_tam';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const gate = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'smoke_gate.js'));
const sg = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'smoke_gen.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const CAT_FX = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'ui_catalog_fixture.json');

type T = { ten: string; ket_qua: string; loai: string | null; loi?: string; chap_chon?: boolean };
const xanh = (ten: string, chapChon = false): T => ({ ten, ket_qua: 'passed', loai: null, chap_chon: chapChon });
const do_ = (ten: string, loai: string): T => ({ ten, ket_qua: 'failed', loai, loi: `[smoke:${loai}] x` });

test.describe('smoke:gate — phán xử', () => {
  test('mọi màn xanh ⇒ SACH, exit 0', () => {
    const r = gate.phanXu([xanh('A'), xanh('B')]);
    expect(r.verdict).toBe('SACH');
    expect(gate.EXIT[r.verdict]).toBe(0);
  });

  test('MỌI màn không mở được ⇒ DUNG, failureLayer infra, exit 1', () => {
    const r = gate.phanXu([do_('A', 'moi-truong'), do_('B', 'loi-may-chu')]);
    expect(r.verdict).toBe('DUNG');
    expect(r.failureLayer).toBe('infra');
    expect(gate.EXIT[r.verdict]).toBe(1);
  });

  test('5xx ở MỘT PHẦN màn ⇒ KHÔNG dừng — đó không phải "môi trường sập", và không gọi là bug', () => {
    const r = gate.phanXu([xanh('A'), do_('B', 'loi-may-chu')]);
    expect(r.verdict).toBe('CHAY_TIEP_CO_CANH_BAO');
    expect(r.failureLayer).toBeNull();
    expect(r.man_can_soi[0].viec).toContain('KHÔNG đủ căn cứ');
  });

  test('bị đẩy về đăng nhập dù chỉ MỘT màn ⇒ DUNG, setup_failure — mọi case đều cần phiên', () => {
    const r = gate.phanXu([xanh('A'), do_('B', 'dang-nhap')]);
    expect(r.verdict).toBe('DUNG');
    expect(r.failureLayer).toBe('setup_failure');
  });

  test('neo trôi ở MỌI màn vẫn KHÔNG dừng — môi trường sống, chỉ thư viện cũ', () => {
    /* Đây là ca chặn oan mà cửa này sinh ra để tránh: dừng cả lượt vì locator cũ. */
    const r = gate.phanXu([do_('A', 'neo-troi'), do_('B', 'khong-thay-man')]);
    expect(r.verdict).toBe('CHAY_TIEP_CO_CANH_BAO');
    expect(gate.EXIT[r.verdict]).toBe(0);
    expect(r.man_can_soi.map((m: { loai: string }) => m.loai)).toEqual(['neo-troi', 'khong-thay-man']);
    expect(r.man_can_soi[0].viec).toContain('/ui-debug');
  });

  test('không test nào chạy ⇒ KHONG_KIEM_DUOC, exit 2 — "chưa kiểm" KHÔNG phải xanh', () => {
    for (const ds of [[], [{ ten: 'A', ket_qua: 'skipped', loai: null }]]) {
      const r = gate.phanXu(ds);
      expect(r.verdict).toBe('KHONG_KIEM_DUOC');
      expect(gate.EXIT[r.verdict]).toBe(2);
    }
  });

  test('xanh sau retry được ghi là chập chờn, không bị nuốt', () => {
    const r = gate.phanXu([xanh('A', true), xanh('B')]);
    expect(r.verdict).toBe('SACH');
    expect(r.chap_chon).toEqual(['A']);
  });
});

test.describe('smoke:gate — đọc báo cáo JSON của Playwright', () => {
  const json = (results: Array<{ status: string; msg?: string }>, title = 'nông · Hồ sơ — màn mở được, 3 neo còn tìm thấy') => ({
    suites: [{ suites: [{ specs: [{ title, tests: [{ results: results.map((r) => ({ status: r.status, errors: r.msg ? [{ message: r.msg }] : [] })) }] }] }] }],
  });

  test('lấy LẦN CHẠY CUỐI, nhãn từ tiền tố, chỉ DÒNG ĐẦU của lỗi, tên màn tách khỏi tên test', () => {
    const [t] = gate.docKetQua(json([{ status: 'failed', msg: 'Error: [smoke:neo-troi] neo KHÔNG tìm thấy: A\n\n  41 | code frame' }]));
    expect(t.ten).toBe('Hồ sơ');
    expect(t.loai).toBe('neo-troi');
    expect(t.loi).not.toContain('code frame');
  });

  test('đỏ rồi xanh ở retry ⇒ passed + chap_chon', () => {
    const [t] = gate.docKetQua(json([{ status: 'failed', msg: '[smoke:moi-truong] x' }, { status: 'passed' }]));
    expect(t.ket_qua).toBe('passed');
    expect(t.chap_chon).toBe(true);
  });

  test('lỗi không mang nhãn ⇒ khong-ro, KHÔNG đoán thành nhãn nào', () => {
    expect(gate.nhanTuLoi('ScreenError: khớp 2 màn')).toBe('khong-ro');
    expect(gate.nhanTuLoi('[smoke:nhan-la] x')).toBe('khong-ro');
  });

  test('host bị che trong mọi chuỗi ra báo cáo', () => {
    const [t] = gate.docKetQua(json([{ status: 'failed', msg: '[smoke:moi-truong] net::ERR at https://uat.vi-du.vn/ho-so' }]));
    expect(t.loi).not.toContain('uat.vi-du.vn');
    expect(t.loi).toContain('https://<host>/ho-so');
  });
});

test.describe('smoke:gen — hợp đồng nhãn với smoke:gate', () => {
  const sinh = (o: Record<string, unknown> = {}) => {
    const out = thuMucTam('sg-gate');
    const r = sg.sinh({ duongCatalog: CAT_FX, outDir: out, deep: false, ...o });
    const src = r.loi ? '' : fs.readFileSync(path.join(REPO, r.file), 'utf8');
    fs.rmSync(out, { recursive: true, force: true });
    return { r, src };
  };

  test('spec sinh ra phát ĐỦ năm nhãn mà gate biết', () => {
    const { src } = sinh();
    for (const n of sg.NHAN_LOAI) expect(src, `thiếu nhãn ${n}`).toContain(`[smoke:${n}]`);
  });

  test('mở màn qua `moMan` (có phân loại), không `page.goto` trần trong thân test', () => {
    const { src } = sinh();
    expect(src).toContain('await moMan(page,');
    expect(src.split('async function moMan')[1].split('test.describe')[1]).not.toContain('page.goto(');
  });

  test('mặc định KHÔNG đăng nhập; `dangNhap: ops` mới import `loginOps` và gắn nhãn khi trượt', () => {
    expect(sinh().src).not.toContain('loginOps');
    const { r, src } = sinh({ dangNhap: 'ops' });
    expect(r.dang_nhap).toBe('ops');
    expect(src).toContain('tests/fe/support/opsLogin');
    expect(src).toMatch(/test\.beforeEach[\s\S]*loginOps[\s\S]*\[smoke:dang-nhap\]/);
  });

  test('`dangNhap` lạ ⇒ từ chối sinh, không âm thầm bỏ qua', () => {
    expect(sinh({ dangNhap: 'sso' }).r.loi).toContain('ops');
  });
});
