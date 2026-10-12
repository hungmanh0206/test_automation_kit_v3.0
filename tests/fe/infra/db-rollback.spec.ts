import { test, expect } from '@playwright/test';
import { chayTrongTransaction, LOCK_TIMEOUT_MS_MAC_DINH, type BoChayCau } from '../../support/setup/db/uatDbClient';

/*
 * LỚP CHẶN THỨ HAI: transaction luôn ROLLBACK (v2.8.0 §0b).
 *
 * Vì sao cần lớp thứ hai khi đã có lint: lint là phép xấp xỉ theo từ khoá, không phải bộ phân tích T-SQL
 * đầy đủ, và lỗ `EXEC` từng sống trong nó đúng một tháng. Một câu ghi lọt lint mà chạy dưới `BEGIN TRAN`
 * thì vẫn bị huỷ — hai lớp phải cùng hỏng mới mất dữ liệu.
 *
 * Bộ test dùng STUB ghi lại chuỗi lệnh gửi đi, nên nó đo được thứ quan trọng nhất mà KHÔNG chạm DB UAT:
 * `ROLLBACK` có chạy kể cả khi câu ném lỗi hay timeout hay không.
 */

function stub(ketQua: () => Promise<unknown[]>) {
  const log: string[] = [];
  const bo: BoChayCau = {
    lenhDieuKhien: async (sql) => { log.push(sql.trim()); },
    cauTruyVan: async <T>(sql: string) => { log.push(`QUERY: ${sql.trim()}`); return (await ketQua()) as T[]; },
  };
  return { bo, log };
}

const CHUOI = (log: string[]) => log.map((x) => x.split(/[;\s]/)[0].toUpperCase()).join(' → ');

test.describe.configure({ mode: 'default' });

test.describe('@infra db rollback — mọi truy vấn trong transaction bị huỷ', () => {
  test('đường thành công: SET → BEGIN TRAN → QUERY → ROLLBACK', async () => {
    const { bo, log } = stub(async () => [{ a: 1 }]);
    const rows = await chayTrongTransaction(bo, 'SELECT 1 AS a');
    expect(rows).toEqual([{ a: 1 }]);
    expect(CHUOI(log)).toBe('SET → BEGIN → QUERY: → ROLLBACK');
    expect(log[0]).toContain('XACT_ABORT ON');
    expect(log[0]).toContain(`LOCK_TIMEOUT ${LOCK_TIMEOUT_MS_MAC_DINH}`);
  });

  test('câu NÉM LỖI vẫn ROLLBACK, và lỗi gốc vẫn nổi lên', async () => {
    /*
     * Đây là ca quan trọng nhất của lớp này. Nếu `ROLLBACK` chỉ chạy ở đường thành công thì nó bảo vệ
     * đúng lúc không cần, và bỏ trống đúng lúc cần: một câu ghi lọt lint thường LÀM XONG VIỆC rồi mới
     * ném (hoặc không ném gì cả).
     */
    const { bo, log } = stub(async () => { throw new Error('lỗi cú pháp giả lập'); });
    await expect(chayTrongTransaction(bo, 'SELECT 1')).rejects.toThrow('lỗi cú pháp giả lập');
    expect(log.at(-1), 'lệnh cuối phải là ROLLBACK').toContain('ROLLBACK');
  });

  test('câu TIMEOUT vẫn ROLLBACK', async () => {
    const { bo, log } = stub(async () => { const e = new Error('RequestError: Timeout'); e.name = 'RequestError'; throw e; });
    await expect(chayTrongTransaction(bo, 'SELECT 1')).rejects.toThrow(/Timeout/);
    expect(log.at(-1)).toContain('ROLLBACK');
  });

  test('ROLLBACK thất bại KHÔNG nuốt lỗi gốc, và được báo ra', async () => {
    /*
     * "Rollback thất bại" là thông tin an toàn, không phải tiếng ồn: nó nghĩa là transaction có thể còn
     * mở trên server. Nuốt nó đi thì một lượt mất dữ liệu sẽ trông y như một lượt bình thường.
     */
    const log: string[] = [];
    const bo: BoChayCau = {
      lenhDieuKhien: async (sql) => {
        log.push(sql.trim());
        if (/rollback/i.test(sql)) throw new Error('mất kết nối khi rollback');
      },
      cauTruyVan: async () => { throw new Error('lỗi gốc'); },
    };
    const canhBao: string[] = [];
    const cu = console.error;
    console.error = (...a: unknown[]) => { canhBao.push(a.join(' ')); };
    try {
      await expect(chayTrongTransaction(bo, 'SELECT 1')).rejects.toThrow('lỗi gốc');
    } finally { console.error = cu; }
    expect(canhBao.join(' ')).toContain('ROLLBACK THẤT BẠI');
  });

  test('`BEGIN TRAN` hỏng thì KHÔNG chạy câu truy vấn', async () => {
    const log: string[] = [];
    let chayQuery = false;
    const bo: BoChayCau = {
      lenhDieuKhien: async (sql) => { log.push(sql); if (/begin tran/i.test(sql)) throw new Error('không mở được transaction'); },
      cauTruyVan: async () => { chayQuery = true; return []; },
    };
    await expect(chayTrongTransaction(bo, 'SELECT 1')).rejects.toThrow('không mở được transaction');
    expect(chayQuery, 'không mở được transaction thì không được chạy câu nào').toBe(false);
  });

  test('`lockTimeoutMs` truyền vào được dùng', async () => {
    const { bo, log } = stub(async () => []);
    await chayTrongTransaction(bo, 'SELECT 1', [], { lockTimeoutMs: 1234 });
    expect(log[0]).toContain('LOCK_TIMEOUT 1234');
  });

  test('tham số được chuyển nguyên vẹn xuống câu truy vấn', async () => {
    let nhan: unknown[] = [];
    const bo: BoChayCau = {
      lenhDieuKhien: async () => {},
      cauTruyVan: async <T>(_s: string, ps: unknown[]) => { nhan = ps; return [] as T[]; },
    };
    await chayTrongTransaction(bo, 'SELECT @p1', [42]);
    expect(nhan).toEqual([42]);
  });
});
