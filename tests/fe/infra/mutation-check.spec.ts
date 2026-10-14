import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * @infra — phép biến đổi của mutation harness.
 *
 * Vì sao cần test: lượt chạy đầu **4/5 mutant không tiêm được** chỉ vì API trả tiền dưới dạng CHUỖI ("900000")
 * mà hàm mutate đòi `typeof === 'number'`. Một harness không tiêm được thì báo "0% score" nghe như phát hiện to,
 * thực chất là chính nó hỏng. Test dưới đây khoá đúng chỗ đó.
 */
const mut = require(path.resolve(__dirname, '../../../scripts/qa/mutation_check.js'));

test.describe('@infra mutation_check — phép tiêm phải thật sự tiêm được', () => {
  test('nhận cả số DẠNG SỐ và số DẠNG CHUỖI (API thật trả chuỗi)', () => {
    const asNum = { data: { service_fee: 900000 } };
    const asStr = { data: { service_fee: '900000' } };
    expect(mut.mutateBody(JSON.parse(JSON.stringify(asNum)), 'zero_money').changed).toContain('900000');
    const r = mut.mutateBody(asStr, 'zero_money');
    expect(r.changed, 'chuỗi số phải tiêm được — đây là lỗi làm 4/5 mutant vô hiệu lượt đầu').toContain('900000');
    expect(asStr.data.service_fee, 'giữ nguyên KIỂU của field (chuỗi vào, chuỗi ra)').toBe('0');
  });

  test('4 phép biến đổi đúng ngữ nghĩa và ghi lại giá trị GỐC', () => {
    const mk = () => ({ data: { total_amount: 540000, note: 'abc' } });
    const zero = mut.mutateBody(mk(), 'zero_money');
    expect(zero.original).toBe('540000');
    const half = mut.mutateBody(mk(), 'halve_money');
    expect(half.changed).toContain('270000');
    const str = mut.mutateBody(mk(), 'stringify_money');
    expect(str.changed).toContain('"540000.0"');
    const body = mk();
    mut.mutateBody(body, 'drop_first_money');
    expect(Object.prototype.hasOwnProperty.call(body.data, 'total_amount'), 'phải XOÁ hẳn field').toBe(false);
  });

  test('chỉ bóp field TIỀN, không bóp field vô can', () => {
    const body = { data: { page_index: 3, description: 'x', service_fee: 100 } };
    mut.mutateBody(body, 'zero_money');
    expect(body.data.page_index, 'page_index không phải tiền — không được chạm').toBe(3);
    expect(body.data.service_fee).toBe(0);
  });

  test('không có field tiền thì báo KHÔNG tiêm được, không im lặng coi như đã tiêm', () => {
    const r = mut.mutateBody({ data: { name: 'IT test', page: 1 } }, 'zero_money');
    expect(r.changed).toBeNull();
    expect(r.original).toBeNull();
  });

  test('⑥ mutant quyền: lật cờ false→true, và KHÔNG chạm field nghiệp vụ có chữ "quyền"', () => {
    const body = {
      data: {
        canEdit: false, duoc_phep: false,
        so_quyen_sach: 3, quyen_su_dung_dat: 'có', canhBaoHienThi: false, island: false,
      },
    };
    const r = mut.mutateBody(body, 'grant_permission');
    expect(r.changed, 'phải tiêm được vào cờ quyền thật').toContain('canEdit');
    expect(body.data.canEdit).toBe(true);
    /*
     * VẾ ÂM — chỗ mẫu này suýt sai HAI lần. Dò chữ `quyen` trần thì `so_quyen_sach` và
     * `quyen_su_dung_dat` đều trúng; và bật cờ `/i` cho mẫu camelCase thì `canhBaoHienThi`/`island`
     * trúng, vì `[A-Z]` khi đó khớp luôn chữ thường. Tiêm nhầm làm mutant "sống sót" vì bộ kiểm đúng ra
     * KHÔNG phải bắt — tức điểm mutation tụt vì một lý do bịa ra.
     */
    expect(body.data.so_quyen_sach, 'số quyển sách không phải quyền').toBe(3);
    expect(body.data.quyen_su_dung_dat).toBe('có');
    expect(body.data.canhBaoHienThi, '`canh`… không phải `can`+chữ HOA').toBe(false);
    expect(body.data.island, '`is`+`l` thường không phải cờ `isX`').toBe(false);
  });

  test('⑥ cờ quyền đã `true` thì KHÔNG tiêm — bật thứ đang bật không chứng minh gì', () => {
    const r = mut.mutateBody({ data: { canEdit: true, isAdmin: true } }, 'grant_permission');
    expect(r.changed, 'không có gì để lật thì phải báo KHÔNG tiêm được').toBeNull();
  });

  test('bộ mutant mặc định nhắm đúng các lớp bug ĐÃ từng lọt', () => {
    const ids = mut.DEFAULT_MUTANTS.map((m: any) => m.id);
    for (const id of ['zero_out', 'drop_field', 'halve_number', 'stringify_num', 'grant_permission']) expect(ids).toContain(id);
    for (const m of mut.DEFAULT_MUTANTS) expect(String(m.why).length, 'mỗi mutant phải nói rõ nhắm lớp bug nào').toBeGreaterThan(10);
  });
});
