import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  kiemSqlChiDoc, lyDoChan, bocBinhLuan, bocChuoi, chuanHoaDeSoi, SqlReadonlyLintError,
} from '../../support/setup/db/sql_readonly_lint';
import { assertReadOnlyQuery } from '../../support/setup/db/guard';
import { assertReadOnlySql } from '../../support/setup/db/uatDbClient';
import { DbGuardError } from '../../support/setup/db/types';
import { goEscape } from './_go_escape';

/*
 * `sql_readonly_lint` — NGUỒN DUY NHẤT của luật "câu này có phải câu đọc không" (v2.8.0 §0b).
 *
 * Đây là lớp chặn ghi DUY NHẤT trong tiến trình: login DB UAT là `db_owner` trên 888 bảng theo quyết định
 * đã ký của chủ dự án, và T-SQL không có transaction READ ONLY. Nên bộ test này nặng về HAI phía cùng lúc,
 * và phía thứ hai mới là phía hay bị bỏ:
 *
 *   · câu lách phải bị CHẶN — hiển nhiên;
 *   · câu đọc hợp lệ phải QUA — vì một lint báo oan sẽ bị ai đó nới ra cho xong việc, và lúc nới thì lỗ
 *     thật mở theo. Báo oan không phải phiền toái, nó là đường dẫn tới lỗ.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

test.describe.configure({ mode: 'default' });

test.describe('@infra sql lint — bóc bình luận và bóc chuỗi trước khi soi', () => {
  test('bóc `--` tới hết DÒNG, không tới hết câu', () => {
    /*
     * Nếu bóc `--` tới hết chuỗi thì `SELECT 1 -- ok\nDROP TABLE x` sẽ mất luôn phần `DROP`, và câu ghi
     * đi qua sạch. Đây là ca đã có test từ bản cũ, giữ lại nguyên nghĩa.
     */
    expect(bocBinhLuan('SELECT 1 -- ghi chú\nDROP TABLE x')).toContain('DROP');
    expect(bocBinhLuan('SELECT 1 /* update */ FROM t')).not.toMatch(/update/i);
  });

  test('bóc NỘI DUNG chuỗi, GIỮ cặp nháy', () => {
    expect(chuanHoaDeSoi(`WHERE note = N'update'`)).toBe(`WHERE note = N''`);
    expect(chuanHoaDeSoi(`EXEC('DEL'+'ETE')`)).toBe(`EXEC(''+'')`);
  });

  test('nháy ĐÔI bên trong chuỗi là một nháy, không phải hai chuỗi', () => {
    /*
     * T-SQL thoát nháy đơn bằng cách nhân đôi: `'it''s'` là MỘT chuỗi. Một regex `'[^']*'` viết vội sẽ
     * cắt nó làm hai và phần `s'` trôi ra ngoài — lúc đó nội dung chuỗi lọt vào vùng bị soi, và câu đọc
     * hợp lệ bị chặn oan. Bộ quét tự viết nên có test riêng cho đúng ca này.
     */
    expect(bocChuoi(`SELECT a FROM t WHERE x = 'it''s delete'`)).toBe(`SELECT a FROM t WHERE x = ''`);
    expect(lyDoChan(`SELECT a FROM t WHERE x = 'it''s delete'`)).toBeNull();
  });

  test('KHÔNG coi `[định danh]` là chuỗi — tên bảng vẫn phải bị soi', () => {
    /*
     * Dấu ngoặc vuông là định danh, không phải chuỗi. Nội dung của nó là tên THẬT, nên một bảng tên
     * `[delete]` là chuyện cần biết chứ không phải chuyện cần bỏ qua.
     */
    expect(lyDoChan('SELECT 1 INTO [dbo].[bang_moi]')).toBeTruthy();
  });
});

test.describe('@infra sql lint — câu lách phải bị CHẶN', () => {
  /*
   * Mỗi câu ở đây là một đường ghi THẬT trên SQL Server, không phải ví dụ sách vở. T-SQL không cần dấu
   * `;` giữa hai statement, nên `SELECT 1 EXEC(…)` là hai lệnh hợp lệ và login `db_owner` sẽ chạy lệnh
   * thứ hai.
   */
  const LACH: Array<[string, RegExp]> = [
    [`SELECT 1 EXEC('DEL'+'ETE FROM dbo.t WHERE 1=0')`, /exec/i],
    [`SELECT 1 EXECUTE('DROP TABLE dbo.x')`, /exec/i],
    [`SELECT 1 DECLARE @s NVARCHAR(99) SET @s='x' EXEC(@s)`, /declare/i],
    [`SELECT 1 UPDATE dbo.t SET a=1`, /update/i],
    [`SELECT 1 BEGIN UPDATE dbo.t SET a=1 END`, /begin/i],
    [`SELECT 1 IF 1=1 DELETE FROM t`, /if/i],
    [`SELECT 1 WHILE 1=1 DELETE FROM t`, /while/i],
    [`SELECT a INTO dbo.x FROM dbo.y`, /INTO/i],
    [`SELECT a INTO #t FROM dbo.y`, /INTO/i],
    [`SELECT 1; DELETE FROM orders`, /stacked/i],
    [`SELECT 1 -- ok\nDROP TABLE orders`, /drop/i],
    [`EXEC sp_executesql N'SELECT 1'`, /SELECT hoặc WITH/],
    [`SELECT * FROM OPENROWSET('SQLNCLI','...','SELECT 1')`, /openrowset/i],
    [`SELECT load_file("/etc/passwd")`, /load_file/i],
    [`SELECT 1 WAITFOR DELAY '00:00:10'`, /waitfor/i],
    [`SELECT 1 DBCC CHECKDB`, /dbcc/i],
  ];

  for (const [sql, tuKhoa] of LACH) {
    test(`CHẶN: ${sql.replace(/\s+/g, ' ').slice(0, 54)}`, () => {
      expect(() => kiemSqlChiDoc(sql)).toThrow(SqlReadonlyLintError);
      expect(() => kiemSqlChiDoc(sql), `phải chặn vì ĐÚNG lý do (${tuKhoa})`).toThrow(tuKhoa);
    });
  }
});

test.describe('@infra sql lint — câu đọc hợp lệ phải QUA (chống báo oan)', () => {
  /*
   * Bốn ca đầu là BÁO OAN THẬT của bản cũ, đo ngày 12/10/2026. Chúng không phải câu hiếm: lọc theo một
   * trạng thái, tìm theo một tên, đếm theo `CASE WHEN`. Bản cũ chặn chúng vì soi từ khoá trên nguyên văn,
   * không bóc nội dung chuỗi.
   */
  const QUA = [
    `SELECT set_id, note FROM dbo.t WHERE note = N'update'`,
    `SELECT a FROM dbo.t WHERE note = 'delete me'`,
    `SELECT a FROM dbo.t WHERE ten = N'Bệnh viện Set 1'`,
    `SELECT a FROM dbo.t WHERE mo_ta LIKE N'%exec%'`,
    `SELECT COUNT(*) AS n, SUM(CASE WHEN a > 1 THEN 1 ELSE 0 END) AS m FROM dbo.t`,
    `SELECT x FROM t ORDER BY y OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`,
    `SELECT TOP (10) id, updated_at FROM dbo.TRUONG WHERE id IN (SELECT id FROM dbo.X)`,
    `WITH c AS (SELECT 1 AS a) SELECT a FROM c`,
    `SELECT a FROM dbo.t JOIN dbo.u ON t.id = u.tid WHERE t.created_at > @p1`,
    `SELECT 1;`,
  ];

  for (const sql of QUA) {
    test(`QUA: ${sql.replace(/\s+/g, ' ').slice(0, 54)}`, () => {
      expect(lyDoChan(sql), 'câu đọc hợp lệ bị chặn oan — lint báo oan sẽ bị nới, và lúc nới thì lỗ mở theo').toBeNull();
    });
  }

  test('`END` của `CASE` KHÔNG bị cấm — đo được 62 câu thật sẽ gãy nếu cấm', () => {
    /*
     * `END` không mở đầu được statement nào, nó chỉ đóng `BEGIN`/`CASE`/`TRY`. Chặn `BEGIN` đã đủ. Thêm
     * `END` chỉ báo oan 62/748 câu đọc thật trong repo.
     */
    const src = fs.readFileSync(path.join(REPO, 'tests/support/setup/db/sql_readonly_lint.impl.js'), 'utf8');
    expect(src).toContain('`END` CỐ Ý KHÔNG CÓ Ở ĐÂY');
    expect(lyDoChan('SELECT CASE WHEN a IS NULL THEN 1 ELSE 0 END AS c FROM t')).toBeNull();
  });

  test('`FETCH` của phân trang KHÔNG bị cấm — con trỏ đã bị chặn ở `declare`/`open`', () => {
    const src = fs.readFileSync(path.join(REPO, 'tests/support/setup/db/sql_readonly_lint.impl.js'), 'utf8');
    expect(src).toContain('`FETCH` CŨNG KHÔNG CÓ Ở ĐÂY');
    expect(lyDoChan('SELECT 1 DECLARE c CURSOR FOR SELECT 1'), 'con trỏ vẫn phải bị chặn').toBeTruthy();
  });
});

test.describe('@infra sql lint — MỘT nguồn, không hai bản trôi khỏi nhau', () => {
  test('cả `guard.ts` lẫn `uatDbClient.ts` đều ỦY QUYỀN, không còn regex riêng', () => {
    /*
     * Đo 12/10/2026 trên 795 câu SQL thật trong repo: hai bản lint cũ BẤT ĐỒNG ở 4 câu, trong đó
     * `SELECT load_file("/etc/passwd")` bị `guard.ts` chặn mà `uatDbClient.ts` CHO QUA. Lỗ `EXEC` từng
     * sống ở đúng khoảng trôi đó. Nên test này canh chuyện gốc: không có bản thứ hai.
     */
    for (const f of ['tests/support/setup/db/guard.ts', 'tests/support/setup/db/uatDbClient.ts']) {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(src, `${f} phải gọi nguồn chung`).toContain('kiemSqlChiDoc');
      expect(src, `${f} còn danh sách từ khoá riêng`).not.toMatch(/insert\|update\|delete\|truncate/);
    }
  });

  test('hai cửa vào cho CÙNG một kết quả trên mọi ca', () => {
    const CA = [
      `SELECT load_file("/etc/passwd")`,
      `SELECT a FROM dbo.t WHERE ten = N'Bệnh viện Set 1'`,
      `SELECT 1 EXEC(@s)`,
      `SELECT 1`,
    ];
    for (const sql of CA) {
      const g = (() => { try { assertReadOnlyQuery(sql); return 'qua'; } catch { return 'chặn'; } })();
      const u = (() => { try { assertReadOnlySql(sql); return 'qua'; } catch { return 'chặn'; } })();
      expect(g, `hai cửa bất đồng ở: ${sql}`).toBe(u);
    }
  });

  test('giữ nguyên KIỂU LỖI cũ — spec và caller cũ không phải đổi', () => {
    expect(() => assertReadOnlyQuery('UPDATE t SET a=1')).toThrow(DbGuardError);
  });
});

test.describe('@infra sql lint — ĐỐI CHỨNG: giải escape trước khi soi', () => {
  /*
   * Phép quét dưới đây bốc chuỗi ra khỏi SOURCE, nên nó phải giải escape trước. Không có đối chứng
   * thì ngày ai đó bỏ bước giải, cửa sẽ chặn oan một câu đọc hợp lệ — và cách "sửa" nhanh nhất là cho
   * file đó vào danh sách bỏ qua, tức mất luôn phép canh.
   */
  const BS = String.fromCharCode(92);
  const MOT_CAU_KEM_COMMENT = `SELECT TEN FROM dbo.LOP WHERE MA_TRUONG = 1;${BS}n${BS}n-- ghi chu`;

  test('DƯƠNG TÍNH GIẢ: chưa giải escape ⇒ câu đọc hợp lệ bị chặn', () => {
    expect(lyDoChan(MOT_CAU_KEM_COMMENT), 'đây chính là hình dạng đã làm `full:suite` đỏ 15/10/2026')
      .toMatch(/stacked/i);
  });

  test('ĐÃ GIẢI: cùng câu đó ⇒ CHO QUA', () => {
    expect(lyDoChan(goEscape(MOT_CAU_KEM_COMMENT)), 'một câu rồi một comment là SQL đọc hợp lệ')
      .toBeFalsy();
  });

  test('giải escape KHÔNG làm mất răng: stacked query thật vẫn bị chặn', () => {
    /* Điều kiện quan trọng nhất — một bước "chống báo oan" mà nuốt luôn ca thật thì tệ hơn báo oan. */
    expect(lyDoChan(goEscape(`SELECT 1;${BS}nDELETE FROM dbo.t`))).toMatch(/stacked/i);
    expect(lyDoChan(goEscape(`SELECT 1;${BS}n-- vo hai${BS}nDELETE FROM dbo.t`))).toMatch(/stacked/i);
  });

  test('chỉ giải escape của chuỗi JS, KHÔNG giải `\\uXXXX`', () => {
    /* Giải nửa vời thì tệ hơn không giải: người đọc sẽ tưởng hàm trả đúng chuỗi lúc chạy mọi trường hợp. */
    expect(goEscape(`a${BS}u0041b`), 'giữ nguyên để không ai tưởng nó xử lý được mọi escape')
      .toBe(`a${BS}u0041b`);
    expect(goEscape(`x${BS}ny`)).toBe('x\ny');
    expect(goEscape(`q${BS}${BS}nz`), 'gạch chéo đôi là gạch chéo thật, không phải xuống dòng').toBe(`q${BS}nz`);
  });
});

test.describe('@infra sql lint — mọi câu SQL THẬT trong repo phải qua', () => {
  test('0 câu đọc thật bị chặn', () => {
    /*
     * Phép đo cuối cùng, và là phép đo quyết định lint này có dùng được không. Quét mọi chuỗi bắt đầu
     * bằng SELECT/WITH trong repo, bỏ các file CỐ Ý chứa câu lách (negative control + chính file lint +
     * chú thích trong guard/uatDbClient), rồi chạy hết qua lint.
     *
     * Luật: câu nào bị chặn thì BÁO, không tự nới luật. Lượt 12/10/2026: 743 câu, 0 bị chặn.
     */
    /*
     * File CỐ Ý chứa câu lách: negative control, chính file lint, và các spec của §0b dùng payload lách
     * làm dữ liệu thử. Danh sách này phải khai TỪNG TÊN chứ không dùng mẫu rộng — một mẫu rộng sẽ âm
     * thầm loại cả file thật, và lúc đó phép đo "0 câu đọc thật bị chặn" nói về một tập rỗng.
     */
    const BO_QUA = new RegExp([
      'db-verify-layer', 'sql-readonly-lint', '_probe', 'readonly\.verify',
      'setup/db/guard\.ts', 'setup/db/uatDbClient\.ts', 'sql_readonly_lint',
      'guard-db-access\.spec\.ts', 'db-query-paths\.spec\.ts', 'db-rollback\.spec\.ts',
      'hooks/guard_db_access\.js', 'db_paths_check\.js', 'db_query\.js',
    ].join('|'));
    const files: string[] = [];
    const walk = (d: string) => {
      let muc: fs.Dirent[];
      try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const f of muc) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) { if (!/node_modules|\.git|dist|test-results/.test(p)) walk(p); }
        else if (/\.(ts|js|sql)$/.test(f.name)) files.push(p);
      }
    };
    walk(REPO);

    const chan: string[] = [];
    let dem = 0;
    for (const f of files) {
      const rel = path.relative(REPO, f).replace(/\\/g, '/');
      if (BO_QUA.test(rel)) continue;
      let t: string;
      try { t = fs.readFileSync(f, 'utf8'); } catch { continue; }
      for (const re of [/`([^`]*)`/g, /'((?:[^'\\]|\\.)*)'/g, /"((?:[^"\\]|\\.)*)"/g]) {
        for (const m of t.matchAll(re)) {
          /*
           * GIẢI ESCAPE TRƯỚC KHI SOI — không soi văn bản nguồn.
           *
           * `m[1]` là chuỗi NHƯ NÓ NẰM TRONG SOURCE, nên một câu SQL viết trong nháy kép mang `\n`
           * dưới dạng HAI ký tự (`\` và `n`), không phải xuống dòng. Lint thì soi SQL thật.
           *
           * Đo 15/10/2026, ca có thật trong `outputs/**`: `SELECT … WHERE … ;\n\n-- ghi chú`.
           *   · `\n` là xuống dòng thật ⇒ lint CHO QUA (đúng: một câu, rồi một comment);
           *   · `\n` là hai ký tự      ⇒ sau khi bóc comment tới cuối dòng, phần còn lại sau dấu `;`
           *     vẫn còn mấy ký tự `\n` chưa giải ⇒ lint kết luận "còn statement nữa" và CHẶN.
           *
           * Tức dương tính giả, và nó chỉ lộ ra khi ai đó viết câu SQL nhiều dòng bằng nháy kép thay
           * vì nháy ngược. Dương tính giả ở cửa SQL là loại nguy hiểm nhất: cách "sửa" nhanh nhất
           * luôn là thêm file vào `BO_QUA`, và thế là mất luôn phép canh trên file đó.
           *
           * Hàm giải escape nằm ở `./_go_escape` — MỘT nguồn, để bản trong phép quét và bản trong đối
           * chứng không trôi khỏi nhau.
           */
          const s = goEscape(String(m[1] || '')).trim();
          if (!/^(select|with)\b/i.test(s) || s.length < 15) continue;
          if (s.includes('${')) continue;      /* template literal chưa nội suy — không phải SQL thật */
          dem += 1;
          const why = lyDoChan(s);
          if (why) chan.push(`${rel}\n    ${s.replace(/\s+/g, ' ').slice(0, 100)}\n    => ${why}`);
        }
      }
    }
    /*
     * MẪU SỐ NHỎ ⇒ BỎ QUA KÈM LÝ DO, KHÔNG ĐỎ VÀ CŨNG KHÔNG XANH.
     *
     * Đo 13/10/2026 bằng `release:verify`: trong repo quét được 743 câu, trong GÓI chỉ **6**. Lý do
     * không phải lint hỏng — phần lớn câu SQL thật nằm ở `outputs/**` (lớp PROJECT, gitignore) và ở các
     * spec probe chưa track, nên gói không mang chúng. Ngưỡng `>300` là ngưỡng của REPO.
     *
     * Ba cách xử lý, và chỉ một cách đúng (xem `_trong_repo.ts`): cho đỏ thì người nhận kit học cách bỏ
     * qua màu đỏ; cho xanh thì một phép kiểm không chạy mà báo đạt — đúng lớp lỗi mà chính spec này sinh
     * ra để chống. Nên BỎ QUA kèm lý do, và `verify_release` đếm số skip.
     *
     * Phần `chan` vẫn kiểm trên 6 câu đó: lint chặn một câu đọc thật thì vẫn phải đỏ, dù mẫu số nhỏ.
     */
    expect(chan, `lint chặn câu đọc thật:\n${chan.join('\n')}`).toEqual([]);
    test.skip(dem <= 300,
      `mẫu số chỉ ${dem} câu SELECT/WITH (repo có 743) — phần lớn nằm ở \`outputs/**\` và spec probe, `
      + 'không được đóng gói. Phép đo "0 câu đọc thật bị chặn" cần mẫu số của REPO mới có nghĩa.');
    expect(dem, 'quét được 0 câu nghĩa là phép đo hỏng, không phải "sạch"').toBeGreaterThan(300);
  });
});
