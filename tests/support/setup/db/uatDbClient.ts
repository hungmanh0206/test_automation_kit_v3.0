import { Connection, Request, TYPES, type ConnectionConfiguration } from 'tedious';
import { kiemSqlChiDoc } from './sql_readonly_lint';

/**
 * Guarded READ-ONLY SQL Server client cho kho DB UAT — cửa DUY NHẤT được phép mở kết nối DB.
 *
 * (Trước 24/09/2026 file này tên `uatPgClient.ts` và dùng PostgreSQL. DB nghiệp vụ thật là **SQL Server
 * 2019** — đo bằng gói TDS pre-login trả type `0x04`, trong khi gói `SSLRequest` kiểu Postgres bị server
 * đóng kết nối. Toàn bộ tầng đã chuyển sang T-SQL; `pg` đã gỡ khỏi dependencies.)
 *
 * Vai trò: oracle PHỤ để verify/chẩn đoán khi UI/API không expose được state
 * (vd phân biệt "field trống do FE" vs "do BE", kiểm dữ liệu có persist không).
 * KHÔNG dùng để dựng/mutate state (setup precondition vẫn qua api/factory/test_hook/fixture),
 * KHÔNG phải evidence (evidence vẫn là ảnh UI), KHÔNG thay oracle từ spec.
 *
 * ⚠️ HAI ĐIỀU KHÁC HẲN BẢN POSTGRES — ĐỌC TRƯỚC KHI SỬA:
 *
 *   1. **T-SQL KHÔNG có `BEGIN TRANSACTION READ ONLY`.** Bản Postgres dựa vào chốt phía server: dù user
 *      full quyền, Postgres vẫn tự ném khi gặp câu ghi trong transaction read-only. SQL Server không có
 *      thứ tương đương (`SET TRANSACTION ISOLATION LEVEL` chỉ đổi mức khoá, không chặn ghi).
 *      ⇒ **`assertReadOnlySql` là lớp chặn DUY NHẤT trong tiến trình này.** Nới nó là mở toang.
 *
 *   2. **Account đang dùng là `dbo` (toàn quyền).** Đo 24/09/2026 trên DB nghiệp vụ UAT: login `csdl`
 *      thuộc `db_owner` + `db_datawriter` + `db_ddladmin`, có đủ INSERT/UPDATE/DELETE/ALTER/CONTROL/
 *      TAKE OWNERSHIP trên 888 bảng. Chủ dự án đã quyết giữ account này và yêu cầu "cẩn trọng khi dùng"
 *      (xem `safety.requireReadonlyUser=false` trong `.agent/config/db.conventions.json`).
 *      ⇒ Sự cẩn trọng đó phải nằm trong CODE, không nằm trong trí nhớ: mọi câu đi qua `assertReadOnlySql`.
 *
 * Các lớp còn giữ nguyên:
 *  - `SET LOCAL`-tương đương: `requestTimeout` giới hạn thời gian mỗi câu; không log password/conn string.
 *  - Chỉ đọc env `LIB_MASTER_DB_*` (không đụng `DATABASE_URL`/`SQLSERVER_*`/`TEST_DB_*`).
 *  - Tùy chọn: `LIB_MASTER_DB_ALLOWED_HOSTS` giới hạn host, `LIB_MASTER_DB_DENY_HOST_PATTERNS` chặn mẫu.
 */

/** Prefix env mặc định. DB khác dùng prefix 'LIB_MASTER_DB2', 'LIB_MASTER_DB3'… (so nhiều bản). */
export const DEFAULT_DB_PREFIX = 'LIB_MASTER_DB';
/** Env kết nối bắt buộc theo prefix — thiếu bất kỳ cái nào ⇒ coi như chưa bật (dormant). */
const requiredKeys = (prefix: string) =>
  [`${prefix}_HOST`, `${prefix}_PORT`, `${prefix}_NAME`, `${prefix}_USERNAME`, `${prefix}_PASSWORD`] as const;

export interface UatDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Tùy chọn: nếu non-empty, chỉ cho kết nối host trong danh sách. */
  allowedHosts: string[];
  /** Tùy chọn: nếu non-empty, chặn host/dbname chứa các mẫu này. */
  denyPatterns: string[];
  ssl: boolean;
  statementTimeoutMs: number;
}

/** Lỗi guard DB — nêu rõ nguyên nhân dừng (config thiếu / host không hợp lệ / query không read-only). */
export class UatDbGuardError extends Error {
  constructor(message: string) {
    super(`[uatDbClient] ${message}`);
    this.name = 'UatDbGuardError';
  }
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** true nếu đủ env kết nối để dùng DB verify (caller có thể skip gracefully nếu false). */
export function isUatDbConfigured(prefix: string = DEFAULT_DB_PREFIX): boolean {
  return requiredKeys(prefix).every((k) => (process.env[k] ?? '').trim() !== '');
}

/**
 * Đọc + validate config từ env theo prefix. Ném `UatDbGuardError` nếu thiếu env kết nối/không hợp lệ.
 * Kết nối (HOST/PORT/NAME/USERNAME/PASSWORD) lấy đúng theo prefix.
 * Guard/tuỳ chọn (ALLOWED_HOSTS/DENY_HOST_PATTERNS/SSL/STATEMENT_TIMEOUT_MS) theo prefix, fallback về LIB_MASTER_DB_*.
 */
export function loadUatDbConfig(prefix: string = DEFAULT_DB_PREFIX): UatDbConfig {
  const missing = requiredKeys(prefix).filter((k) => (process.env[k] ?? '').trim() === '');
  if (missing.length) {
    throw new UatDbGuardError(
      `Thiếu env kết nối: ${missing.join(', ')}. DB verify chỉ chạy khi đã cấu hình kho UAT.`,
    );
  }
  const opt = (suffix: string) =>
    process.env[`${prefix}_${suffix}`] ?? process.env[`${DEFAULT_DB_PREFIX}_${suffix}`];

  const port = Number.parseInt(process.env[`${prefix}_PORT`] as string, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new UatDbGuardError(`${prefix}_PORT không hợp lệ: "${process.env[`${prefix}_PORT`]}".`);
  }

  const statementTimeoutMs = Number.parseInt(opt('STATEMENT_TIMEOUT_MS') ?? '5000', 10);

  return {
    host: (process.env[`${prefix}_HOST`] as string).trim(),
    port,
    database: (process.env[`${prefix}_NAME`] as string).trim(),
    user: (process.env[`${prefix}_USERNAME`] as string).trim(),
    password: process.env[`${prefix}_PASSWORD`] as string,
    allowedHosts: splitCsv(opt('ALLOWED_HOSTS')),
    denyPatterns: splitCsv(opt('DENY_HOST_PATTERNS')),
    ssl: (opt('SSL') ?? '').trim().toLowerCase() === 'true',
    statementTimeoutMs:
      Number.isInteger(statementTimeoutMs) && statementTimeoutMs > 0 ? statementTimeoutMs : 5000,
  };
}

/**
 * Guard host tùy chọn: chỉ áp khi bạn tự cấu hình allowlist/deny.
 * Bỏ trống cả hai ⇒ không áp (rào chính là credential kho UAT).
 */
export function assertHostGuards(cfg: UatDbConfig): void {
  const host = cfg.host.toLowerCase();
  const db = cfg.database.toLowerCase();

  if (cfg.allowedHosts.length && !cfg.allowedHosts.includes(host)) {
    throw new UatDbGuardError(
      `Host "${cfg.host}" không nằm trong LIB_MASTER_DB_ALLOWED_HOSTS (${cfg.allowedHosts.join(', ')}).`,
    );
  }
  const hit = cfg.denyPatterns.find((p) => host.includes(p) || db.includes(p));
  if (hit) {
    throw new UatDbGuardError(
      `Host/DB khớp mẫu chặn "${hit}" trong LIB_MASTER_DB_DENY_HOST_PATTERNS. (host="${cfg.host}", db="${cfg.database}")`,
    );
  }
}

/**
 * Lint read-only — ỦY QUYỀN cho `sql_readonly_lint.ts`, nguồn DUY NHẤT của luật này (v2.8.0 §0b).
 *
 * Trước v2.8.0 hàm này có bộ regex RIÊNG, và bản ở `guard.ts` cũng vậy. Chạy cả 795 câu SQL thật trong
 * repo qua hai bản ngày 12/10/2026: **4 câu hai bản BẤT ĐỒNG**, trong đó `SELECT load_file("/etc/passwd")`
 * bị `guard.ts` chặn mà bản NÀY cho qua. Hai bản trôi khỏi nhau là chuyện đã xảy ra, nên giờ chỉ còn một.
 *
 * Giữ nguyên `UatDbGuardError` để mọi caller và mọi spec cũ không phải đổi: thứ thay đổi là LUẬT ở đâu,
 * không phải kiểu lỗi ném ra.
 */
export function assertReadOnlySql(sql: string): void {
  try {
    kiemSqlChiDoc(sql);
  } catch (e) {
    throw new UatDbGuardError((e as Error).message);
  }
}

/** Suy kiểu tedious từ giá trị JS — tedious BẮT BUỘC khai kiểu cho tham số, không như `pg`. */
function addParam(req: Request, name: string, v: unknown): void {
  if (v === null || v === undefined) { req.addParameter(name, TYPES.NVarChar, null); return; }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) req.addParameter(name, TYPES.BigInt, v);
    else req.addParameter(name, TYPES.Float, v);
    return;
  }
  if (typeof v === 'boolean') { req.addParameter(name, TYPES.Bit, v); return; }
  if (v instanceof Date) { req.addParameter(name, TYPES.DateTime2, v); return; }
  if (typeof v === 'bigint') { req.addParameter(name, TYPES.BigInt, v.toString()); return; }
  // NVarChar chứ không VarChar: DB này toàn cột `nvarchar`, dùng VarChar là mất dấu tiếng Việt.
  req.addParameter(name, TYPES.NVarChar, String(v));
}

/**
 * Chạy MỘT câu SELECT read-only trên kho DB UAT, trả về `rows`.
 * Guard chạy trước; kết nối mở/đóng theo từng lần gọi (verify tần suất thấp).
 *
 * Tham số đánh tên `@p1, @p2…` theo thứ tự trong mảng `params` (T-SQL không có `$1`).
 */
/*
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 * LỚP CHẶN THỨ HAI: MỌI TRUY VẤN CHẠY TRONG TRANSACTION VÀ LUÔN ROLLBACK (v2.8.0 §0b).
 *
 * Vì sao cần lớp thứ hai khi đã có lint: lint là phép xấp xỉ theo từ khoá, không phải bộ phân tích T-SQL
 * đầy đủ. Lỗ `EXEC` từng sống trong lint đúng một tháng. Một câu ghi lọt lint mà chạy dưới `BEGIN TRAN`
 * thì vẫn bị huỷ ở `ROLLBACK` — hai lớp phải cùng hỏng mới mất dữ liệu.
 *
 * `SET XACT_ABORT ON` để lỗi giữa chừng tự huỷ cả transaction thay vì để nó treo nửa vời.
 * `SET LOCK_TIMEOUT` để một câu đọc chạm phải khoá không giữ transaction mở vô hạn trên UAT.
 *
 * GIỚI HẠN, phải đọc: lớp này KHÔNG phủ hết.
 *   · Vài thứ nằm NGOÀI transaction trên SQL Server: một số lệnh hệ thống, `xp_cmdshell` và mọi tác dụng
 *     phụ ra ngoài DB (ghi file, gọi mạng). `ROLLBACK` không gọi chúng về được.
 *   · Những thứ đó đã bị LINT chặn, nên hai lớp bù nhau chứ không chồng nhau. Mất lint thì lớp này không
 *     đỡ nổi phần đó.
 *
 * Mấy câu điều khiển dưới đây KHÔNG đi qua `assertReadOnlySql`, cố ý: chúng do chính client dựng, không
 * phải SQL của người dùng, và `BEGIN TRAN`/`ROLLBACK` đương nhiên không phải câu đọc.
 */

/** Cửa chạy lệnh — tách ra để test được chuỗi lệnh gửi đi mà không cần DB thật. */
export interface BoChayCau {
  /** Câu điều khiển, không tham số (`SET …`, `BEGIN TRAN`, `ROLLBACK`). */
  lenhDieuKhien(sql: string): Promise<void>;
  /** Câu truy vấn có tham số, trả về các dòng. */
  cauTruyVan<T>(sql: string, params: unknown[]): Promise<T[]>;
}

/** Ngưỡng chờ khoá mặc định. Ngắn có chủ đích: đây là đường ĐỌC, không phải job chạy nền. */
export const LOCK_TIMEOUT_MS_MAC_DINH = 5_000;

/**
 * Chạy MỘT câu đọc trong một transaction luôn bị ROLLBACK.
 *
 * `ROLLBACK` nằm trong `finally` nên nó chạy kể cả khi câu ném lỗi hoặc timeout. Nếu chính `ROLLBACK`
 * cũng ném (mất kết nối chẳng hạn) thì lỗi đó KHÔNG được nuốt im lặng — nó được gắn vào lỗi gốc, vì
 * "rollback thất bại" là thông tin an toàn, không phải tiếng ồn.
 */
export async function chayTrongTransaction<T>(
  bo: BoChayCau,
  sql: string,
  params: unknown[] = [],
  opts: { lockTimeoutMs?: number } = {},
): Promise<T[]> {
  const lock = Number.isFinite(opts.lockTimeoutMs) ? Number(opts.lockTimeoutMs) : LOCK_TIMEOUT_MS_MAC_DINH;
  await bo.lenhDieuKhien(`SET XACT_ABORT ON; SET LOCK_TIMEOUT ${lock};`);
  await bo.lenhDieuKhien('BEGIN TRAN;');
  try {
    return await bo.cauTruyVan<T>(sql, params);
  } finally {
    await bo.lenhDieuKhien('ROLLBACK;').catch((e) => {
      /* eslint-disable-next-line no-console */
      console.error(`[uatDbClient] ROLLBACK THẤT BẠI: ${(e as Error).message} — kết nối sẽ bị đóng ngay.`);
    });
  }
}

export async function queryUatReadonly<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  opts: { dbPrefix?: string } = {},
): Promise<T[]> {
  assertReadOnlySql(sql);
  const cfg = loadUatDbConfig(opts.dbPrefix ?? DEFAULT_DB_PREFIX);
  assertHostGuards(cfg);

  const connCfg: ConnectionConfiguration = {
    server: cfg.host,
    authentication: { type: 'default', options: { userName: cfg.user, password: cfg.password } },
    options: {
      port: cfg.port,
      database: cfg.database,
      encrypt: cfg.ssl,
      trustServerCertificate: true,
      connectTimeout: 15_000,
      requestTimeout: cfg.statementTimeoutMs,
      rowCollectionOnRequestCompletion: true,
    },
  };

  const connection: Connection = await new Promise((resolve, reject) => {
    const c = new Connection(connCfg);
    c.on('connect', (err) => (err ? reject(err) : resolve(c)));
    c.on('error', (err) => reject(err));
    c.connect();
  });

  // Audit: chỉ host/db/user, KHÔNG bao giờ log password/connection string.
  // eslint-disable-next-line no-console
  console.log(`[uatDbClient] connected UAT host=${cfg.host} db=${cfg.database} user=${cfg.user} (read-only lint)`);

  /* Cửa chạy lệnh dựng trên kết nối tedious này. Logic transaction nằm ở `chayTrongTransaction`. */
  const bo: BoChayCau = {
    lenhDieuKhien: (cau) => new Promise<void>((resolve, reject) => {
      const req = new Request(cau, (err) => (err ? reject(err) : resolve()));
      connection.execSqlBatch(req);
    }),
    cauTruyVan: <R>(cau: string, ps: unknown[]) => new Promise<R[]>((resolve, reject) => {
      const rows: R[] = [];
      const req = new Request(cau, (err) => (err ? reject(err) : resolve(rows)));
      ps.forEach((v, idx) => addParam(req, `p${idx + 1}`, v));
      req.on('row', (cols: { value: unknown; metadata: { colName: string } }[]) => {
        const o: Record<string, unknown> = {};
        for (const col of cols) o[col.metadata.colName] = col.value;
        rows.push(o as R);
      });
      connection.execSql(req);
    }),
  };

  try {
    return await chayTrongTransaction<T>(bo, sql, params, { lockTimeoutMs: cfg.statementTimeoutMs });
  } finally {
    await new Promise<void>((resolve) => {
      connection.on('end', () => resolve());
      connection.close();
    });
  }
}
