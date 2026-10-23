#!/usr/bin/env node
'use strict';
/*
 * guard_db_access — HOOK `PreToolUse` CHẶN AI ĐI VÒNG QUA TẦNG DB (v2.8.0 §0b.3).
 *
 * VÌ SAO CẦN, và nó bịt đúng lỗ nào. Kit có hai lớp chặn ghi: lint câu SQL và transaction luôn rollback.
 * Cả hai chỉ có tác dụng với câu đi QUA `queryUatReadonly`. Chúng không có tác dụng gì nếu agent tự gõ
 * `sqlcmd -Q "DELETE …"`, tự viết một script `require('tedious')` rồi chạy, hay đọc mật khẩu trong
 * `profiles/<TASK>/task.env` rồi dùng chỗ khác.
 *
 * Trước v2.8.0, `.claude/settings.json` chỉ khai `SessionStart` và `PostToolUse` — tức không gì chặn
 * TRƯỚC khi lệnh chạy. Hook này là `PreToolUse`, nên nó chặn được.
 *
 * ĐÂY LÀ RÀO CHO AI, KHÔNG PHẢI RANH GIỚI BẢO MẬT. Nói thẳng vì chỗ này dễ tưởng nhầm:
 *   · Người mở SSMS, DBeaver, hay `sqlcmd` trong terminal riêng KHÔNG đi qua hook.
 *   · Hook chỉ thấy lệnh agent định chạy qua công cụ của harness.
 *   · Ranh giới thật vẫn là QUYỀN DB. Khuyến nghị vẫn là login chỉ-SELECT; khi có thì đặt
 *     `requireReadonlyUser: true` và preflight chặn cứng.
 *
 * FAIL-CLOSED. Hook lỗi nội bộ thì CHẶN, không im lặng cho qua. Một hook an toàn mà hỏng lặng lẽ thì tệ
 * hơn không có hook: nó tạo ra niềm tin sai.
 *
 * KHÔNG IN NỘI DUNG LỆNH. Lệnh bị chặn có thể chứa mật khẩu hoặc chuỗi kết nối, và `reason` của hook đi
 * thẳng vào context của agent rồi vào transcript. Chỉ in MỘT DÒNG nói chặn vì luật nào.
 *
 * ┌─ TEST HOOK NÀY PHẢI VIẾT TRONG SPEC, KHÔNG THỬ BẰNG LỆNH BASH ─────────────────────────────────────┐
 * │ Hook soi VĂN BẢN của lệnh, nên một lệnh `node -e "…pyodbc.connect(…)…"` dùng để THỬ hook cũng khớp  │
 * │ đúng mẫu đó và bị chặn. Đã xảy ra khi dựng hook này: lệnh thử bị chính nó chặn.                      │
 * │                                                                                                     │
 * │ Đó KHÔNG phải lỗi của hook — một lệnh mang chuỗi kết nối thì chặn là đúng, dù người gõ định làm gì.  │
 * │ Nên ca thử sống trong `tests/fe/infra/guard-db-access.spec.ts`: spec nạp module rồi gọi hàm, và lệnh │
 * │ chạy spec (`npx playwright test …`) không mang chuỗi nào đáng ngờ.                                   │
 * └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */

const fs = require('fs');

/** Trả quyết định cho harness rồi thoát. */
function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function chan(luat, goiY) {
  emit({
    decision: 'block',
    reason: `[guard-db] CHẶN (${luat}). ${goiY}`,
    suppressOutput: true,
  });
}

/*
 * ĐƯỜNG CHẠY SQL NGOÀI KIT. Mỗi mẫu là một cách nối thẳng tới DB mà không đi qua lint và transaction.
 * `\b` không đủ cho `sp_*`-kiểu tên, nhưng ở đây là tên CÔNG CỤ nên biên từ là đúng.
 */
const CONG_CU_SQL = [
  /\bsqlcmd\b/i, /\bbcp\b/i, /\bosql\b/i, /\bisql\b/i, /\bInvoke-Sqlcmd\b/i,
  /\bmysql\b/i, /\bpsql\b/i, /\bsqlplus\b/i,
];

/*
 * Nạp driver DB thẳng trong một lệnh chạy (one-liner `node -e`, script tạm…).
 *
 * Mẫu nháy phải nhận cả nháy ĐÃ THOÁT. Một lệnh `node -e` đi qua shell thường mang dạng
 * `require(\"tedious\")`, và lượt thử đầu của hook này cho ca đó LỌT — nó lọt vì mẫu `['"]` quá hẹp,
 * không vì lệnh vô hại. Đây đúng loại mẫu trông-như-đã-gác mà chỉ phép thử mới phát hiện.
 */
const NHAY = '[\\\\\'"`]+';
const DRIVER = [
  new RegExp(`require\\(\\s*${NHAY}tedious${NHAY}\\s*\\)`),
  new RegExp(`require\\(\\s*${NHAY}mssql${NHAY}\\s*\\)`),
  new RegExp(`from\\s+${NHAY}(tedious|mssql)${NHAY}`),
  /import\s+tedious\b/,
  /*
   * TÊN DRIVER PHẢI ĐI KÈM NGỮ CẢNH NẠP, không bắt tên trần.
   *
   * Mẫu `\bpyodbc\b` trần đã chặn oan ngay lần đầu dùng thật: file đang viết là một script CẬP NHẬT LỜI
   * KHAI MIỄN TRỪ, và nó nhắc `pyodbc` trong một câu tiếng Việt mô tả chính hook này. Tức hook cấm người
   * ta VIẾT TÀI LIỆU về nó.
   *
   * Đó là loại báo oan tệ nhất: nó chặn đúng việc an toàn nhất (ghi lại rủi ro), nên nó sẽ bị gỡ. Giờ
   * phải có `import`, `require`, hoặc một lời gọi `.connect(` đi kèm.
   */
  /import\s+(pyodbc|pymssql)\b/, /\b(pyodbc|pymssql)\.connect\s*\(/,
  /from\s+(pyodbc|pymssql)\s+import\b/,
  /new\s+SqlConnection\s*\(/, /using\s+System\.Data\.SqlClient\b/,
];

/**
 * Lệnh có THỰC THI hoặc GHI code hay không.
 *
 * Dùng để phân biệt "lệnh dùng chuỗi kết nối" với "lệnh đi tìm chuỗi kết nối". Chỉ có cái thứ nhất đáng
 * chặn: `grep`, `rg`, `findstr` không nối được DB, và một lệnh rà soát chuỗi kết nối trong repo chính là
 * việc hook này muốn người ta làm.
 */
const NGU_CANH_CHAY = /(\bnode\s+-e\b|\bnode\s+--eval\b|\bpython3?\s+-c\b|-Command\b|\bIex\b|\beval\b|>\s*\S|>>\s*\S|\btee\b)/i;

/** Chuỗi kết nối viết thẳng. */
const CHUOI_KET_NOI = [
  /Server\s*=\s*[^;]+;\s*Database\s*=/i,
  /Data\s+Source\s*=\s*[^;]+;\s*Initial\s+Catalog\s*=/i,
  /\bmssql:\/\//i, /\bsqlserver:\/\//i,
];

/** File chứa bí mật. `*.example` là bản mẫu, KHÔNG phải bí mật — chặn nó là báo oan mỗi ngày. */
const FILE_BI_MAT = /(^|\/)(profiles\/[^/]+\/task\.env|\.env)(\.|$)|(^|\/)task\.env$/i;
const LA_MAU = /\.example($|\.)/i;

/*
 * Lệnh shell ĐỌC NỘI DUNG file. Thêm `grep/rg/sed/awk/Select-String/Get-Content`: chúng đọc và IN
 * nội dung y hệt `cat`, mà trước đây lọt — đo 23/10/2026: `grep PASSWORD <file bí mật>` đi qua cửa.
 */
const LENH_DOC = /^(cat|head|tail|less|more|type|bat|nl|od|xxd|strings|grep|egrep|fgrep|rg|sed|awk|gawk|select-string|get-content|gc)$/i;

/*
 * TÁCH LỆNH GHÉP rồi mới xét. Bản cũ hỏi "chuỗi có chứa từ-đọc KHÔNG?" và "có chứa đường-dẫn-bí-mật
 * KHÔNG?" một cách RỜI RẠC, nên hai thứ chẳng liên quan gì nhau vẫn thành một lời buộc tội.
 *
 * Đo 23/10/2026, hai lỗi NGƯỢC CHIỀU nhau cùng tồn tại:
 *   · `git commit -F - <<EOF ...<nhắc tên file>... EOF && git push | tail -2` → CHẶN OAN. Cái `tail`
 *     đọc output của `git push`, không đọc file nào; đường dẫn chỉ nằm trong THÂN thông điệp commit.
 *     Chính lỗi này chặn một commit mô tả cách dùng profile.
 *   · `grep PASSWORD <file bí mật>` → LỌT, dù đó mới đúng là đọc bí mật.
 *
 * Nay: cắt theo `| ; && ||` và xuống dòng, rồi với MỖI đoạn chỉ xét khi TỪ ĐẦU TIÊN của đoạn là lệnh
 * đọc — và chỉ soi ĐỐI SỐ của chính đoạn đó. Hẹp hơn mà bắt đúng hơn.
 */
function doanLenh(s) {
  return String(s).split(/\|\||&&|[|;\n]/).map((x) => x.trim()).filter(Boolean);
}

/** Token đầu tiên của đoạn, bỏ tiền tố gán biến (`FOO=bar cat x` → `cat`). */
function lenhDauDoan(doan) {
  for (const tok of doan.split(/\s+/)) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue; // gán biến môi trường, chưa phải lệnh
    return tok.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
  }
  return '';
}

/** In env ra màn hình — một cách lấy mật khẩu không cần chạm file nào. */
const IN_ENV = [
  /(^|[;&|]\s*)(env|printenv)\s*$/m,
  /(^|[;&|]\s*)set\s*$/m,
  /\b(echo|printf|Write-Host|Write-Output)\b[^\n]*\$(\{)?(LIB_MASTER_DB|[A-Z_]*PASSWORD|[A-Z_]*SECRET|[A-Z_]*TOKEN)/,
  /\$env:(LIB_MASTER_DB|[A-Z_]*PASSWORD)/i,
];

/** File ĐƯỢC PHÉP nạp driver DB — tầng DB của kit và test của chính nó. */
const DUOC_PHEP_DRIVER = [
  /tests\/support\/setup\/db\//,
  /scripts\/qa\/lib\/db_verify_preflight\.js$/,
  /scripts\/qa\/db_query\.js$/,
  /tests\/fe\/infra\/.*\.spec\.ts$/,
  /scripts\/qa\/hooks\/guard_db_access\.js$/,
];

function kiemBash(cmd) {
  const s = String(cmd || '');
  if (CONG_CU_SQL.some((re) => re.test(s))) {
    chan('công cụ SQL ngoài kit', 'Tra DB bằng `npm run db:query -- --task <K> --sql-file <f.sql>`, hoặc `queryUatReadonly` trong spec. Hai đường đó đi qua lint và transaction rollback.');
  }
  if (DRIVER.some((re) => re.test(s))) {
    chan('nạp driver DB thẳng trong lệnh', 'Dùng `npm run db:query` hoặc `queryUatReadonly`. Nối thẳng là bỏ qua cả lint lẫn rollback.');
  }
  /*
   * CHUỖI KẾT NỐI: chỉ chặn khi lệnh THỰC THI hoặc GHI code, không chặn khi lệnh TÌM nó.
   *
   * Báo oan thật, gặp ngay lần dùng thứ hai: `grep -oE "Server\\s*=|Data Source" <file>` bị chặn vì MẪU
   * TÌM KIẾM của nó khớp mẫu chuỗi kết nối. Nhưng `grep` không nối được DB — lệnh đó đang RÀ SOÁT xem có
   * chuỗi kết nối nào lọt vào repo, tức làm đúng việc hook này muốn người ta làm.
   *
   * Chặn nó thì hook cấm chính việc kiểm toán nó, và đó là loại báo oan làm hook bị gỡ. Nên phép chặn
   * đòi thêm NGỮ CẢNH CHẠY: `node -e`, `python -c`, `-Command`, hoặc một phép ghi file.
   */
  if (CHUOI_KET_NOI.some((re) => re.test(s)) && NGU_CANH_CHAY.test(s)) {
    chan('chuỗi kết nối trong lệnh THỰC THI code', 'Cấu hình đi qua `profiles/<TASK>/task.env` và `loadUatDbConfig`, không viết thẳng.');
  }
  if (IN_ENV.some((re) => re.test(s))) {
    chan('in biến môi trường chứa bí mật', 'Không cần đọc mật khẩu để tra DB: `npm run db:query` tự nạp cấu hình.');
  }
  /* Chỉ chặn khi CHÍNH một lệnh đọc nhắm vào file bí mật THẬT — không chặn mọi `cat` trong chuỗi. */
  for (const doan of doanLenh(s)) {
    if (!LENH_DOC.test(lenhDauDoan(doan))) continue;
    for (const tok of doan.split(/\s+/).slice(1)) {
      const p = tok.replace(/^["']|["']$/g, '').replace(/\\/g, '/');
      if (FILE_BI_MAT.test(p) && !LA_MAU.test(p)) {
        chan('đọc file chứa bí mật', 'Bản mẫu `profiles/task.env.example` đọc được. File thật thì không — và không cần đọc nó để chạy việc gì trong kit.');
      }
    }
  }
}

function kiemDoc(fp) {
  const p = String(fp || '').replace(/\\/g, '/');
  if (!p) return;
  if (FILE_BI_MAT.test(p) && !LA_MAU.test(p)) {
    chan('đọc file chứa bí mật', 'Bản mẫu `profiles/task.env.example` đọc được. File thật thì không.');
  }
}

function kiemGhi(fp, noiDung) {
  const p = String(fp || '').replace(/\\/g, '/');
  const s = String(noiDung || '');
  if (!p) return;
  if (DUOC_PHEP_DRIVER.some((re) => re.test(p))) return;
  if (DRIVER.some((re) => re.test(s))) {
    chan('file mới nạp driver DB ngoài tầng DB của kit', 'Mọi đường chạm DB đi qua `tests/support/setup/db/`. Thêm đường riêng là tạo một lối không ai gác.');
  }
  if (CHUOI_KET_NOI.some((re) => re.test(s))) {
    chan('file mới chứa chuỗi kết nối DB', 'Cấu hình đi qua `profiles/<TASK>/task.env`, không viết thẳng vào code.');
  }
}

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (e) { raw = ''; }
  let data = {};
  try { data = JSON.parse(raw || '{}'); } catch (e) {
    chan('không đọc được input của hook', 'Hook an toàn hỏng lặng lẽ thì tệ hơn không có hook — nên nó chặn. Báo maintainer.');
  }

  const ten = String(data.tool_name || data.toolName || '');
  const inp = data.tool_input || data.toolInput || {};

  if (/^Bash$|^PowerShell$/i.test(ten)) kiemBash(inp.command);
  else if (/^Read$/i.test(ten)) kiemDoc(inp.file_path || inp.path);
  else if (/^Grep$/i.test(ten)) kiemDoc(inp.path);
  else if (/^(Write|Edit)$/i.test(ten)) kiemGhi(inp.file_path || inp.path, inp.content || inp.new_string || '');

  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    /* FAIL-CLOSED: lỗi nội bộ thì CHẶN. */
    chan(`lỗi nội bộ của hook: ${String(e && e.message).slice(0, 80)}`, 'Hook an toàn phải fail-closed. Báo maintainer thay vì bỏ qua.');
  }
}

module.exports = {
  CONG_CU_SQL, DRIVER, CHUOI_KET_NOI, NGU_CANH_CHAY, FILE_BI_MAT, LA_MAU, IN_ENV, LENH_DOC, DUOC_PHEP_DRIVER,
  kiemBash, kiemDoc, kiemGhi,
};
