#!/usr/bin/env node
'use strict';
/*
 * db:query — LỆNH TRA CỨU DB DUY NHẤT cho người và cho AI (v2.8.0 §0b.4).
 *
 * VÌ SAO PHẢI CÓ MỘT LỆNH. Trước v2.8.0, muốn tra DB thì mỗi người tự viết một đoạn code kết nối. Mỗi
 * đoạn như vậy là một đường đi RIÊNG: không qua lint, không có transaction rollback, không che PII, không
 * để lại dấu vết. Hook `PreToolUse` giờ chặn các đường đó — nên phải có MỘT đường được phép, nếu không
 * thì cái bị chặn là công việc chứ không phải rủi ro.
 *
 * BỐN THỨ LỆNH NÀY LÀM MÀ MỘT ĐOẠN CODE TỰ VIẾT KHÔNG LÀM:
 *   1. đi qua `queryUatReadonly` ⇒ có lint câu SQL VÀ transaction luôn rollback;
 *   2. CHE email và SĐT **trước khi ghi file**, không chỉ trước khi in — CLAUDE.md §1 cấm TẠO FILE chứa
 *      dữ liệu cá nhân khách, nên che lúc in mà ghi nguyên văn ra đĩa là vi phạm đúng điều đó;
 *   3. chặn trần số dòng, và kết quả dài thì ra file thay vì đổ vào context của agent;
 *   4. ghi một dòng AUDIT cho mỗi lượt — hash câu SQL, số dòng, thời lượng. KHÔNG ghi giá trị dữ liệu,
 *      không ghi tham số, không ghi mật khẩu.
 *
 * Dùng:
 *   npm run db:query -- --task <K> --sql-file <f.sql> [--param <v> …] [--max-rows <n>] [--json]
 *
 * Vì sao `--sql-file` chứ không `--sql "<câu>"`: câu SQL trên dòng lệnh đi vào lịch sử shell và vào
 * transcript của agent. File thì nằm trong task và xoá được.
 *
 * Exit: 0 · 1 khi lint chặn hoặc truy vấn lỗi · 2 khi thiếu đầu vào
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const { cheHang, cheChuoi } = require(path.join(__dirname, 'lib', 'pii_mask'));

/** Trần số dòng mặc định. Đủ để nhìn một bảng danh mục, không đủ để kéo cả bảng nghiệp vụ về máy. */
const MAX_ROWS_MAC_DINH = 500;
/** In ra màn hình tối đa ngần này dòng — phần còn lại ra file. */
const IN_TOI_DA = 5;

const val = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const JSON_OUT = process.argv.includes('--json');

/** Mọi `--param <v>` theo thứ tự xuất hiện, map vào `@p1`, `@p2`… */
function docParams() {
  const ra = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--param' && process.argv[i + 1] !== undefined) ra.push(process.argv[i + 1]);
  }
  return ra;
}

/**
 * Ghi MỘT dòng audit. Append-only.
 *
 * Cố ý KHÔNG ghi: nguyên văn câu SQL (có thể mang tên/giá trị thật trong `WHERE`), giá trị tham số, và
 * dĩ nhiên không ghi gì liên quan tới kết nối. Hash đủ để biết "cùng một câu đã chạy bao nhiêu lần" mà
 * không chép dữ liệu ra thêm một chỗ nữa.
 */
function ghiAudit(taskOutputDir, ban) {
  const f = path.join(taskOutputDir, 'db_audit.jsonl');
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, `${JSON.stringify(ban)}\n`, 'utf8');
  } catch (e) {
    /* Audit hỏng KHÔNG được làm chết truy vấn, nhưng phải kêu — một sổ im lặng là sổ không ai tin. */
    console.error(`[db:query] ⚠ không ghi được audit (${e.message}).`);
  }
  return f;
}

async function main() {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[db:query] ✗ không xác định được task: ${e.message}`);
    console.error('          Cần TASK_KEY + PROJECT_OUTPUT_DIR (hoặc --task <TASK_KEY>).');
    process.exit(2);
  }

  const sqlFile = val('sql-file', null);
  if (!sqlFile) {
    console.error('[db:query] ✗ thiếu `--sql-file <f.sql>`.');
    console.error('          Không nhận câu SQL trên dòng lệnh, cố ý: nó đi vào lịch sử shell và vào transcript.');
    process.exit(2);
  }
  const duongSql = path.resolve(sqlFile);
  if (!fs.existsSync(duongSql)) {
    console.error(`[db:query] ✗ không thấy file SQL: ${sqlFile}`);
    process.exit(2);
  }
  const sql = fs.readFileSync(duongSql, 'utf8').trim();
  const hash = crypto.createHash('sha256').update(sql).digest('hex');
  const maxRows = Math.max(1, Number(val('max-rows', MAX_ROWS_MAC_DINH)) || MAX_ROWS_MAC_DINH);
  const params = docParams();

  /* Lint TRƯỚC để ghi được audit kể cả khi câu bị chặn — lượt bị chặn cũng là một lượt cần dấu vết. */
  const { lyDoChan } = require(path.join(REPO, 'tests', 'support', 'setup', 'db', 'sql_readonly_lint.ts'));
  const viPham = lyDoChan(sql);
  const batDau = Date.now();

  if (viPham) {
    ghiAudit(taskOutputDir, {
      luc: new Date().toISOString(),
      task: taskKey,
      nguon: 'db:query',
      sql_sha256: hash,
      so_dong: 0,
      ms: 0,
      lint: 'CHAN',
      lint_ly_do: viPham,
    });
    console.error(`[db:query] ✗ CHẶN: ${viPham}`);
    console.error('          Tầng kiểm DB chỉ đọc. Dựng state qua UI/API/factory, không qua DB.');
    process.exit(1);
  }

  const { queryUatReadonly } = require(path.join(REPO, 'tests', 'support', 'setup', 'db', 'uatDbClient.ts'));
  let rows;
  try {
    rows = await queryUatReadonly(sql, params);
  } catch (e) {
    ghiAudit(taskOutputDir, {
      luc: new Date().toISOString(),
      task: taskKey,
      nguon: 'db:query',
      sql_sha256: hash,
      so_dong: 0,
      ms: Date.now() - batDau,
      lint: 'QUA',
      loi: cheChuoi(String(e.message || '')).slice(0, 200),
    });
    console.error(`[db:query] ✗ truy vấn lỗi: ${cheChuoi(String(e.message || ''))}`);
    process.exit(1);
  }
  const ms = Date.now() - batDau;

  const tong = rows.length;
  const cat = tong > maxRows;
  const giu = cat ? rows.slice(0, maxRows) : rows;
  /* CHE TRƯỚC KHI GHI, không chỉ trước khi in. Xem ghi chú đầu file. */
  const daChe = giu.map(cheHang);

  ghiAudit(taskOutputDir, {
    luc: new Date().toISOString(),
    task: taskKey,
    nguon: 'db:query',
    sql_sha256: hash,
    so_dong: tong,
    ms,
    lint: 'QUA',
    cat_bot: cat ? { tran: maxRows } : undefined,
  });

  let fileKq = null;
  if (daChe.length > IN_TOI_DA) {
    const d = path.join(taskOutputDir, 'db');
    fs.mkdirSync(d, { recursive: true });
    fileKq = path.join(d, `${new Date().toISOString().replace(/[:.]/g, '-')}-${hash.slice(0, 8)}.json`);
    fs.writeFileSync(fileKq, `${JSON.stringify({
      _canh_bao: 'Kết quả ĐÃ CHE email và SĐT. Họ tên/địa chỉ che theo TÊN CỘT. Đừng gỡ phần che rồi commit.',
      task: taskKey,
      sql_sha256: hash,
      so_dong: tong,
      cat_bot: cat ? maxRows : null,
      dong: daChe,
    }, null, 2)}\n`, 'utf8');
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ so_dong: tong, ms, cat_bot: cat, file: fileKq, mau: daChe.slice(0, IN_TOI_DA) }, null, 2));
    return;
  }

  console.log(`[db:query] ${tong} dòng · ${ms}ms${cat ? ` · CẮT còn ${maxRows} (trần --max-rows)` : ''}`);
  if (!tong) {
    console.log('           0 dòng — đọc kỹ câu lọc trước khi kết luận "không có dữ liệu".');
    return;
  }
  console.log(`           mẫu ${Math.min(IN_TOI_DA, daChe.length)}/${daChe.length} dòng, ĐÃ CHE PII:`);
  for (const h of daChe.slice(0, IN_TOI_DA)) console.log(`  ${JSON.stringify(h)}`);
  if (fileKq) console.log(`           đầy đủ (đã che) → ${path.relative(REPO, fileKq)}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`[db:query] ✗ ${cheChuoi(String(e && e.message))}`);
    process.exit(1);
  });
}

module.exports = { MAX_ROWS_MAC_DINH, IN_TOI_DA, ghiAudit };
