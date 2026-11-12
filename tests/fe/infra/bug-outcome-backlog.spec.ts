/**
 * bug:outcome:backlog — sổ kết cục THEO ISSUE BACKLOG (11/11/2026).
 *
 * Đo trên Backlog: tài khoản QA log 96 bug trong CSDL, chỉ 17 có file claim trỏ tới — sổ claim thấy được 18%.
 * Máy chỉ tự gắn ĐÚNG MỘT trường hợp: *Ready for Product* (quy trình dự án: DEV báo sửa ⇒ Ready For Test ⇒ QA
 * chạy lại ⇒ Ready for Product). "Resolved" trên dự án này có lúc là đã sửa, có lúc là bác ("bảng này k dùng
 * nữa"), có lúc là tranh chấp tài liệu, và `resolution` luôn trống — nên người gắn, kèm lý do.
 * Chỉ test HÀM THUẦN: CI không có credential Backlog, và phép đo này CHỈ GET.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ob = require(path.join(REPO, 'scripts/qa/bug_outcome_backlog.js'));

const bug = (key: string, trangThai: string, cha = 'P-1') => ({ key, cha, trangThai, resolution: null, tao: '2026-10-01', sua: '2026-10-02' });

test.describe('@infra bug:outcome:backlog — máy chỉ tự gắn một trường hợp', () => {
  test('Ready for Product ⇒ accepted, ghi rõ nguồn là trạng thái', () => {
    const so = ob.gop({ issues: {} }, [bug('B-1', 'Ready for Product')]);
    expect(so.issues['B-1']).toMatchObject({ nhan: 'accepted', nguonNhan: 'tự gắn' });
  });

  test('Resolved / Closed ⇒ KHÔNG tự gắn — "Resolved" có lúc là bác', () => {
    const so = ob.gop({ issues: {} }, [bug('B-2', 'Resolved'), bug('B-3', 'Closed')]);
    expect(so.issues['B-2'].nhan).toBeUndefined();
    expect(so.issues['B-3'].nhan).toBeUndefined();
    expect(ob.tinh(so).canNguoi).toEqual(['B-2:Resolved', 'B-3:Closed']);
  });

  test('Open ⇒ chưa có kết cục: không gắn, không tính vào tỉ lệ, không đòi người', () => {
    const t = ob.tinh(ob.gop({ issues: {} }, [bug('B-4', 'Open'), bug('B-5', 'Ready For Test')]));
    expect(t).toMatchObject({ coNhan: 0, chuaXong: 2, canNguoi: [] });
  });
});

test.describe('@infra bug:outcome:backlog — nhãn tay', () => {
  const so0 = () => ob.gop({ issues: {} }, [bug('B-1', 'Resolved'), bug('B-2', 'Open'), bug('B-3', 'Ready for Product')]);

  test('gắn tay đòi lý do đủ dài — một chữ "ok" không phải căn cứ', () => {
    expect(() => ob.ganTay(so0(), 'B-1', 'rejected', 'ok')).toThrow(/lý do/);
    expect(ob.ganTay(so0(), 'B-1', 'rejected', 'DEV: "bảng này k dùng nữa" — claim dựa vào bảng đã bỏ').issues['B-1'].nhan).toBe('rejected');
  });

  test('KHÔNG cho gắn khi bug còn mở — chưa ai phán thì chưa có kết cục', () => {
    expect(() => ob.ganTay(so0(), 'B-2', 'accepted', 'DEV nói sẽ sửa trong sprint tới')).toThrow(/chưa có kết cục/);
  });

  test('nhãn không có trong danh sách ⇒ từ chối', () => {
    expect(() => ob.ganTay(so0(), 'B-1', 'fixed', 'DEV đã sửa trên môi trường dev')).toThrow(/không hợp lệ/);
  });

  test('nhãn TAY sống qua lượt đọc Backlog sau; nhãn TỰ GẮN tính lại theo trạng thái mới', () => {
    const coTay = ob.ganTay(so0(), 'B-1', 'by_design', 'DEV: "form này đúng thiết kế, không cần modal"');
    const lai = ob.gop(coTay, [bug('B-1', 'Resolved'), bug('B-2', 'Open'), bug('B-3', 'Open')]);
    expect(lai.issues['B-1'].nhan, 'nhãn tay giữ nguyên').toBe('by_design');
    expect(lai.issues['B-3'].nhan, 'Ready for Product bị mở lại ⇒ mất nhãn tự gắn').toBeUndefined();
  });

  test('nhãn tay lệch trạng thái hiện tại ⇒ được nêu ra, không lặng lẽ đè', () => {
    const coTay = ob.ganTay(ob.gop({ issues: {} }, [bug('B-1', 'Resolved')]), 'B-1', 'rejected', 'DEV bác: dữ liệu nguồn đã đổi');
    const lai = ob.gop(coTay, [bug('B-1', 'Ready for Product')]);
    expect(ob.tinh(lai).lech).toHaveLength(1);
  });
});

test.describe('@infra bug:outcome:backlog — tỉ lệ', () => {
  test('sai = rejected + by_design + duplicate trên số CÓ NHÃN; nhóm theo issue cha', () => {
    let so = ob.gop({ issues: {} }, [bug('A', 'Ready for Product', 'P-1'), bug('B', 'Ready for Product', 'P-1'), bug('C', 'Resolved', 'P-2'), bug('D', 'Resolved', 'P-2'), bug('E', 'Open', 'P-2')]);
    so = ob.ganTay(so, 'C', 'by_design', 'DEV: yêu cầu đã đổi sau đặc tả');
    const t = ob.tinh(so);
    expect(t).toMatchObject({ tong: 5, coNhan: 3, sai: 1, chuaXong: 1, canNguoi: ['D:Resolved'] });
    expect(t.theoCha['P-2']).toEqual({ tong: 3, coNhan: 1, sai: 1, chuaXong: 1 });
  });

  test('CLI --bao-cao không gọi mạng', () => {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/bug_outcome_backlog.js'), '--bao-cao'], { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\[outcome-backlog\]/);
  });
});
