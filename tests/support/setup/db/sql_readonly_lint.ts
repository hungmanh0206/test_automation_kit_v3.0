/*
 * sql_readonly_lint (.ts) — LỚP BỌC CÓ KIỂU.
 *
 * Logic ở `./sql_readonly_lint.impl.js`: nó phải chạy được từ `scripts/qa/db_query.js`, một script Node
 * thuần, trên Node 20 (mức kit khai hỗ trợ). Xem khối chú thích đầy đủ trong file đó — gồm cả số đo về
 * hai bản lint từng trôi khỏi nhau, và lý do `require()` thẳng `.ts` đã vỡ trên CI.
 *
 * File này KHÔNG chứa luật nào. Thêm luật vào đây là tạo lại đúng bản thứ hai mà v2.8.0 đã đi gộp.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const impl = require('./sql_readonly_lint.impl.js');

export type SqlReadonlyLintErrorType = Error & { name: 'SqlReadonlyLintError' };

export const SqlReadonlyLintError: new (message: string) => SqlReadonlyLintErrorType = impl.SqlReadonlyLintError;
export const bocBinhLuan: (sql: string) => string = impl.bocBinhLuan;
export const bocChuoi: (sql: string) => string = impl.bocChuoi;
export const chuanHoaDeSoi: (sql: string) => string = impl.chuanHoaDeSoi;
export const kiemSqlChiDoc: (sql: string) => void = impl.kiemSqlChiDoc;
export const lyDoChan: (sql: string) => string | null = impl.lyDoChan;
