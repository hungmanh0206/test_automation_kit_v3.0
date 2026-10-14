/*
 * sql_readonly_lint — NGUỒN DUY NHẤT của luật "câu này có phải câu đọc không" (v2.8.0 §0b).
 *
 * ╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ ĐÂY LÀ LỚP CHẶN GHI DUY NHẤT TRONG TIẾN TRÌNH. Nới nó là mở toang.                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * Vì sao nó là lớp duy nhất, và vì sao điều đó không phải lựa chọn của kit:
 *   · Login DB UAT là `db_owner` + `db_datawriter` + `db_ddladmin` trên 888 bảng. Chủ dự án đã QUYẾT giữ
 *     account này (`safety.requireReadonlyUser=false`, ký 24/09/2026, rà lại 30/09/2026).
 *   · T-SQL KHÔNG có transaction READ ONLY. `SET TRANSACTION ISOLATION LEVEL` chỉ đổi mức khoá, không
 *     chặn ghi. Nên không có lớp nào ở tầng DB đỡ hộ.
 *
 * VÌ SAO GỘP MỘT NGUỒN — có số đo, không phải nguyên tắc suông. Trước v2.8.0 kit có HAI bản lint:
 * `assertReadOnlySql` (uatDbClient.ts, đường chính) và `assertReadOnlyQuery` (guard.ts, đường dbVerify).
 * Chạy cả 795 câu SQL thật trong repo qua cả hai ngày 12/10/2026: **4 câu hai bản BẤT ĐỒNG**, trong đó
 * `SELECT load_file("/etc/passwd")` bị `guard.ts` chặn mà `uatDbClient.ts` CHO QUA. Hai bản trôi khỏi
 * nhau là chuyện đã xảy ra rồi, không phải rủi ro lý thuyết.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 * BỐN LUẬT, theo đúng thứ tự áp dụng. Thứ tự quan trọng: luật 2 phải chạy TRƯỚC luật 3 và 4.
 *
 * 1. CHỈ `SELECT` hoặc `WITH` được mở đầu câu.
 *    Bản cũ của `guard.ts` còn nhận `explain|show|table` — di sản từ thời Postgres. Đã đo: **0/795 câu
 *    SQL trong repo** bắt đầu bằng ba từ đó, nên bỏ chúng KHÔNG phá câu nào đang chạy.
 *
 * 2. BÓC BÌNH LUẬN, RỒI BÓC NỘI DUNG CHUỖI.
 *    Đây là phần sửa quan trọng nhất của v2.8.0, và nó sửa một lỗi ĐI NGƯỢC hướng người ta hay lo. Lỗi
 *    không phải "chuỗi giấu được lệnh ghi" — một từ khoá nằm trong chuỗi thì không chạy được. Lỗi là
 *    CHẶN OAN câu đọc hợp lệ. Đo ngày 12/10/2026 trên bản cũ:
 *
 *        CHẶN OAN   SELECT set_id, note FROM dbo.t WHERE note = N'update'
 *        CHẶN OAN   SELECT a FROM dbo.t WHERE note = 'delete me'
 *        CHẶN OAN   SELECT a FROM dbo.t WHERE mo_ta LIKE N'%exec%'
 *
 *    Những câu đó là câu verify bình thường: lọc theo một trạng thái, tìm theo một tên. Một lint báo oan
 *    sẽ được ai đó nới ra cho xong việc, và lúc nới thì lỗ thật mở theo. Nên bóc chuỗi KHÔNG phải để
 *    dễ tính hơn — nó để lint còn ĐÁNG TIN, tức còn được giữ nguyên.
 *
 *    Bóc nội dung nhưng GIỮ cặp nháy (`N'update'` thành `N''`), để cấu trúc câu không đổi và luật 3
 *    vẫn thấy đúng ranh giới token.
 *
 *    Mẹo ghép chuỗi `'DEL'+'ETE'` KHÔNG được chống bằng cách đoán nội dung chuỗi — sau khi bóc nó thành
 *    `''+''`. Nó bị chặn ở luật 3 vì muốn chạy được chuỗi ghép thì phải có `EXEC`.
 *
 * 3. ĐÚNG MỘT CÂU LỆNH, theo kiểu T-SQL — KHÔNG dựa vào dấu `;`.
 *    T-SQL không cần `;` giữa hai statement: `SELECT 1 EXEC(…)` là hai lệnh hợp lệ. Nên phép chặn
 *    stacked-query theo `;` chỉ là MỘT NỬA hàng rào. Nửa còn lại: cấm mọi từ khoá có thể MỞ ĐẦU một câu
 *    lệnh mới, kể cả những từ tự nó không ghi được gì (`declare`, `set`, `if`, `while`) — chúng là cách
 *    lắp SQL động để né danh sách từ khoá ghi.
 *
 * 4. CẤM ĐƯỜNG GHI GIÁN TIẾP: `SELECT … INTO <bảng>` (tạo bảng thật), họ `sp_*`/`xp_*`, và các hàm đọc
 *    ghi file / nguồn ngoài (`openrowset`, `opendatasource`, `openquery`, `bulk insert`).
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 * GIỚI HẠN, nói thẳng:
 *   · Đây là lint TRONG TIẾN TRÌNH. Người mở SSMS hay `sqlcmd` ngoài kit không đi qua đây.
 *   · Lint theo từ khoá là phép xấp xỉ, không phải bộ phân tích T-SQL đầy đủ. Nó chặn rộng hơn mức cần,
 *     và đó là hướng sai AN TOÀN — nhưng chặn rộng quá thì bị nới, nên luật 2 tồn tại để giảm báo oan.
 *   · Khuyến nghị vẫn là login chỉ-SELECT. Khi có, đặt `requireReadonlyUser: true` và preflight sẽ chặn
 *     cứng nếu login còn quyền ghi — lúc đó lint này thành lớp phụ, đúng vai của nó.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO LOGIC NẰM Ở `.impl.js` CHỨ KHÔNG Ở `.ts` (14/10/2026).
 *
 * `scripts/qa/db_query.js` là một script Node thuần, và nó cần CHÍNH luật này — không được có bản thứ
 * hai, vì hai bản lint đã từng trôi khỏi nhau: chạy 795 câu SQL thật qua cả hai ngày 12/10/2026 thì
 * **4 câu bất đồng**, trong đó `SELECT load_file("/etc/passwd")` bị một bản chặn và bản kia CHO QUA.
 *
 * Bản đầu giải bằng cách `require()` thẳng file `.ts`. Chạy được ở máy tôi (Node 24 tự bóc kiểu) và
 * VỠ trên CI: kit khai `engines: >=20`, `.nvmrc` ghi 20, mà Node 20 đọc `.ts` như JS rồi chết ở dấu
 * `:` đầu tiên — thông báo ra là `Unexpected token ':'`, không ai đoán được nó nói về chuyện gì.
 * Đo 14/10/2026 bằng lượt `release` chạy thật trên Linux.
 *
 * Nên NGUỒN là `.js` (chạy trên mọi Node), còn `.ts` chỉ là lớp bọc có kiểu cho consumer TypeScript.
 * Tên file khác nhau là CỐ Ý: nếu đặt cùng tên thì `import './sql_readonly_lint'` phân giải nhập nhằng
 * giữa hai file, và chỗ nhập nhằng đó sẽ im lặng chọn một bản.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Lỗi do lint câu SQL. Caller bọc lại thành lỗi của tầng mình để giữ nguyên kiểu lỗi cũ. */
class SqlReadonlyLintError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SqlReadonlyLintError';
  }
}

/** Chỉ hai từ này được mở đầu một câu đọc. Xem luật 1. */
const DAU_CAU = /^\s*(select|with)\b/i;

/*
 * TỪ KHOÁ MỞ ĐẦU CÂU LỆNH MỚI + từ khoá ghi/DDL + đường ghi gián tiếp.
 *
 * Gộp một danh sách thay vì nhiều nhóm, vì thông điệp lỗi phải NÊU TÊN từ khoá đã khớp — bộ test hồi quy
 * của lỗ `EXEC` assert đúng chuyện đó (`toThrow(/exec/i)`), nên "chặn vì lý do đúng" là một hợp đồng.
 */
const TU_KHOA_CAM = new RegExp(
  '\\b('
  /*
   * `END` CỐ Ý KHÔNG CÓ Ở ĐÂY, và đây là chỗ dễ thêm vào cho "đủ bộ" nhất.
   *
   * Đo 12/10/2026 trên 748 câu SQL đọc THẬT trong repo (đã bỏ 47 câu negative control): 55/57 từ khoá
   * trong danh sách này không khớp câu thật nào, tức cấm chúng tốn 0 báo oan. `END` thì khớp **62 câu** —
   * vì `CASE WHEN … ELSE … END` là cấu trúc đọc phổ biến nhất trong các câu verify.
   *
   * Và cấm nó không mua thêm gì: `END` KHÔNG mở đầu được statement nào, nó chỉ ĐÓNG `BEGIN`, `CASE` hoặc
   * `TRY`. Chặn `BEGIN` đã đủ để một khối `BEGIN … END` không lọt. Thêm `END` chỉ làm lint báo oan 62 câu
   * đang chạy, và một lint báo oan thì sẽ bị ai đó nới — lúc nới thì lỗ thật mở theo.
   */
  // mở đầu câu lệnh mới (T-SQL không cần `;`)
  + 'exec|execute|declare|set|if|while|begin|use|goto|print|raiserror|throw|return|break|continue'
  /*
   * `FETCH` CŨNG KHÔNG CÓ Ở ĐÂY — và chỗ này bị bắt bởi POSITIVE CONTROL có sẵn trong
   * `db-verify-layer.spec.ts`, không phải bởi phép đo 748 câu của tôi.
   *
   * `OFFSET … ROWS FETCH NEXT n ROWS ONLY` là cú pháp PHÂN TRANG chuẩn của T-SQL, tức cấu trúc ĐỌC. Lúc
   * đo trên repo thì chưa câu nào dùng nó nên phép đo im lặng, và nếu chỉ tin phép đo đó thì lint này đã
   * đi vào với một báo oan cài sẵn, nổ ở câu phân trang đầu tiên ai đó viết.
   *
   * Cấm `fetch` cũng không mua gì: `FETCH` của con trỏ cần `DECLARE CURSOR` rồi `OPEN` đi trước, mà cả
   * `declare` lẫn `open` đều đã bị cấm ở trên. Giữ `open`/`close`/`deallocate` vì chúng không đụng cú
   * pháp đọc nào.
   */
  + '|open|close|deallocate|waitfor|try|catch'
  // ghi dữ liệu + DDL
  + '|insert|update|delete|truncate|drop|alter|create|grant|revoke|deny|merge|replace|copy|vacuum|reindex'
  + '|call|do|backup|restore|shutdown|reconfigure|checkpoint|dbcc|writetext|updatetext|setuser|revert'
  // đọc/ghi file và nguồn ngoài
  + '|load_file|outfile|dumpfile|openrowset|opendatasource|openquery|openxml|bulk\\s+insert'
  // họ thủ tục hệ thống
  + '|xp_[a-z0-9_]+|sp_[a-z0-9_]+|fn_trace_[a-z0-9_]+'
  + ')\\b',
  'i',
);

/** `SELECT … INTO <bảng>` tạo bảng thật. `INTO @bien` (table variable) thì không, nên loại trừ `@`. */
const SELECT_INTO = /\binto\s+(?!@)[[#a-z_"]/i;

/**
 * Bóc bình luận `--…` và `/*…*\/`.
 *
 * Bóc `--` tới hết DÒNG (không tới hết câu): `SELECT 1 -- ok\nDROP TABLE x` phải còn lại `DROP` để luật 3
 * bắt. Bản cũ làm đúng chuyện này và có test khoá nó.
 */
function bocBinhLuan(sql) {
  return String(sql || '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Bóc NỘI DUNG chuỗi literal, giữ lại cặp nháy. `N'update'` thành `N''`.
 *
 * Tự quét ký tự thay vì dùng một regex: T-SQL thoát nháy đơn bằng CÁCH NHÂN ĐÔI (`'it''s'`), và một
 * regex `'(?:[^']|'')*'` đọc được ca đó nhưng rất dễ viết sai thành `'[^']*'` — lúc đó `'it''s'` bị cắt
 * làm hai và phần `s'` còn lại trôi ra ngoài chuỗi. Quét tay thì ca đó hiển nhiên đúng, và có test riêng.
 *
 * KHÔNG xử lý `[tên cột có dấu ngoặc]` như chuỗi: đó là định danh, nội dung của nó là tên thật và luật 3
 * vẫn phải soi (một bảng tên `[delete]` là chuyện cần biết, không phải chuyện cần bỏ qua).
 */
function bocChuoi(sql) {
  const s = String(sql || '');
  let ra = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c !== "'") { ra += c; i += 1; continue; }
    ra += "'";
    i += 1;
    while (i < s.length) {
      if (s[i] === "'" && s[i + 1] === "'") { i += 2; continue; }   /* nháy đôi = một nháy trong chuỗi */
      if (s[i] === "'") break;
      i += 1;
    }
    if (i < s.length) { ra += "'"; i += 1; }                        /* nháy đóng */
  }
  return ra;
}

/** Chuẩn hoá câu để soi: bóc bình luận rồi bóc nội dung chuỗi. Xuất ra để test đo từng bước. */
function chuanHoaDeSoi(sql) {
  return bocChuoi(bocBinhLuan(sql));
}

/**
 * KIỂM một câu SQL có phải câu ĐỌC không. Ném `SqlReadonlyLintError` nếu không.
 *
 * Thông điệp lỗi luôn NÊU TÊN thứ làm nó bị chặn — người sửa cần biết chặn vì cái gì, và bộ test hồi quy
 * khoá đúng chuyện đó.
 */
function kiemSqlChiDoc(sql) {
  const tho = String(sql || '').trim();
  if (!tho) throw new SqlReadonlyLintError('Câu truy vấn rỗng.');

  const s = chuanHoaDeSoi(tho);

  if (!DAU_CAU.test(s)) {
    throw new SqlReadonlyLintError(
      `Câu truy vấn không bắt đầu bằng SELECT hoặc WITH: "${tho.slice(0, 60)}…"`,
    );
  }

  /* Stacked query theo `;` — nửa hàng rào thứ nhất. `;` ở CUỐI câu là hợp lệ. */
  if (/;\s*\S/.test(s.trim())) {
    throw new SqlReadonlyLintError('Nhiều statement trong một câu (stacked query) — không cho.');
  }

  const hit = TU_KHOA_CAM.exec(s);
  if (hit) {
    throw new SqlReadonlyLintError(`Câu truy vấn chứa từ khoá ghi/nguy hiểm: "${hit[0]}".`);
  }

  if (SELECT_INTO.test(s)) {
    throw new SqlReadonlyLintError(
      'Câu truy vấn có `SELECT … INTO <bảng>` — tạo bảng thật, không phải câu đọc.',
    );
  }
}

/** Phiên bản không ném: trả lý do chặn, hoặc `null` nếu câu hợp lệ. Dùng cho báo cáo hàng loạt. */
function lyDoChan(sql) {
  try { kiemSqlChiDoc(sql); return null; } catch (e) { return e.message; }
}

module.exports = { SqlReadonlyLintError, bocBinhLuan, bocChuoi, chuanHoaDeSoi, kiemSqlChiDoc, lyDoChan };
