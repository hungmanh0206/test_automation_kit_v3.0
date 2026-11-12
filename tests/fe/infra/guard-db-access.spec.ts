import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * HOOK `PreToolUse` CHẶN AI ĐI VÒNG QUA TẦNG DB (v2.8.0 §0b.3).
 *
 * Kit có hai lớp chặn ghi — lint câu SQL và transaction luôn rollback — nhưng cả hai chỉ có tác dụng với
 * câu đi QUA `queryUatReadonly`. Chúng không đỡ được gì nếu agent tự gõ `sqlcmd -Q "DELETE …"`, tự viết
 * một script `require('tedious')`, hay đọc mật khẩu trong `profiles/<TASK>/task.env` rồi dùng chỗ khác.
 *
 * Trước v2.8.0 `.claude/settings.json` chỉ khai `SessionStart` và `PostToolUse`, tức KHÔNG gì chặn trước
 * khi lệnh chạy.
 *
 * Bộ test này nặng đều hai phía: chặn đúng thứ phải chặn, và KHÔNG chặn lệnh thường. Một hook báo oan sẽ
 * bị gỡ khỏi `settings.json` trong tuần đầu, và lúc đó lỗ mở lại toàn phần.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const HOOK = path.join(REPO, 'scripts/qa/hooks/guard_db_access.js');

function chay(payload: unknown): { chan: boolean; reason: string } {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: REPO, encoding: 'utf8', input: JSON.stringify(payload), env: gateEnv(),
  });
  const out = String(r.stdout || '').trim();
  if (!out) return { chan: false, reason: '' };
  try {
    const j = JSON.parse(out);
    return { chan: j.decision === 'block', reason: String(j.reason || '') };
  } catch { return { chan: false, reason: out }; }
}

const bash = (command: string) => chay({ tool_name: 'Bash', tool_input: { command } });

test.describe.configure({ mode: 'default' });

test.describe('@infra guard-db hook — chặn đường chạy SQL ngoài kit', () => {
  const CAM: Array<[string, RegExp]> = [
    ['sqlcmd -S host -Q "DELETE FROM dbo.t"', /công cụ SQL/],
    ['bcp dbo.t out c:\\x.dat -T', /công cụ SQL/],
    ['Invoke-Sqlcmd -Query "SELECT 1"', /công cụ SQL/],
    [`node -e "require('tedious')"`, /driver DB/],
    ['node -e "require(\\"tedious\\")"', /driver DB/],
    ['python -c "import pyodbc"', /driver DB/],
    ['node -e "const s=\'Server=a;Database=b\'"', /chuỗi kết nối/],
  ];

  /*
   * BỘ TEST NÀY SỐNG TRONG SPEC, không phải trong lệnh Bash — và lý do là một chuyện đã xảy ra khi dựng
   * hook: lệnh `node -e` dùng để THỬ hook cũng mang đúng chuỗi bị cấm, nên nó bị chính hook chặn.
   *
   * Đó không phải lỗi của hook. Một lệnh mang chuỗi kết nối thì chặn là đúng, dù người gõ định làm gì với
   * nó. Spec thì nạp module rồi gọi hàm, còn lệnh chạy spec không mang chuỗi nào đáng ngờ.
   */
  for (const [cmd, ly] of CAM) {
    test(`CHẶN: ${cmd.slice(0, 46)}`, () => {
      const r = bash(cmd);
      expect(r.chan, `lệnh này phải bị chặn: ${cmd}`).toBe(true);
      expect(r.reason).toMatch(ly);
    });
  }
});

test.describe('@infra guard-db hook — chặn đường lấy mật khẩu', () => {
  const CAM = [
    'cat profiles/TASK-9001/task.env',
    'head -5 profiles/X/task.env',
    'type profiles\\X\\task.env',
    'echo $LIB_MASTER_DB_PASSWORD',
    'printf "%s" $DB_PASSWORD',
    'printenv',
    'env',
  ];
  for (const cmd of CAM) {
    test(`CHẶN: ${cmd.slice(0, 42)}`, () => {
      expect(bash(cmd).chan, `lệnh này phải bị chặn: ${cmd}`).toBe(true);
    });
  }

  test('CHẶN cả khi đi qua công cụ Read, không chỉ Bash', () => {
    expect(chay({ tool_name: 'Read', tool_input: { file_path: 'profiles/TASK-9001/task.env' } }).chan).toBe(true);
  });

  test('bản MẪU `.example` thì KHÔNG chặn — chặn nó là báo oan mỗi ngày', () => {
    expect(bash('cat profiles/task.env.example').chan).toBe(false);
    expect(chay({ tool_name: 'Read', tool_input: { file_path: 'profiles/task.env.example' } }).chan).toBe(false);
  });
});

test.describe('@infra guard-db hook — KHÔNG báo oan lệnh thường', () => {
  const QUA = [
    'npm run db:query -- --task TASK-9001 --sql-file q.sql',
    'cat README.md',
    'grep -rn "foo" scripts/',
    'npx playwright test tests/fe/infra',
    'git status --short',
    'node -e "console.log(1)"',
    'npm run check',
    'cat .env.example',
  ];
  for (const cmd of QUA) {
    test(`QUA: ${cmd.slice(0, 44)}`, () => {
      const r = bash(cmd);
      expect(r.chan, `lệnh thường bị chặn oan: ${cmd} — ${r.reason}`).toBe(false);
    });
  }
});

test.describe('@infra guard-db hook — ghi file mở đường riêng tới DB', () => {
  test('CHẶN: file mới ngoài tầng DB nạp driver', () => {
    const r = chay({
      tool_name: 'Write',
      tool_input: { file_path: 'tests/fe/lib/csdl/steps/tra-db.ts', content: "import { Connection } from 'tedious';" },
    });
    expect(r.chan).toBe(true);
    expect(r.reason).toMatch(/driver DB/);
  });

  test('QUA: tầng DB của kit ĐƯỢC phép nạp driver', () => {
    const r = chay({
      tool_name: 'Write',
      tool_input: { file_path: 'tests/support/setup/db/uatDbClient.ts', content: "import { Connection } from 'tedious';" },
    });
    expect(r.chan, 'chặn chính tầng DB thì không ai sửa được nó nữa').toBe(false);
  });

  test('CHẶN: file mới chứa chuỗi kết nối', () => {
    const r = chay({
      tool_name: 'Write',
      tool_input: { file_path: 'scripts/tam.js', content: "const s = 'Server=10.0.0.1;Database=csdl;User Id=sa';" },
    });
    expect(r.chan).toBe(true);
  });

  test('QUA: tài liệu NHẮC TÊN driver mà không nạp nó', () => {
    /*
     * Báo oan thật, gặp ngay lần dùng đầu: một script cập nhật LỜI KHAI MIỄN TRỪ bị chặn vì câu tiếng
     * Việt của nó nhắc `pyodbc` khi mô tả chính hook này. Tức hook cấm người ta viết tài liệu về nó.
     *
     * Đó là loại báo oan tệ nhất — nó chặn đúng việc an toàn nhất (ghi lại rủi ro), nên hook sẽ bị gỡ.
     * Tên driver giờ phải đi kèm ngữ cảnh nạp: `import`, `require`, hoặc `.connect(`.
     */
    const vanBan = 'Hook chặn nạp tedious, mssql, pyodbc hay pymssql thẳng trong lệnh.';
    const r = chay({ tool_name: 'Write', tool_input: { file_path: 'docs/ghi-chu.md', content: vanBan } });
    expect(r.chan, `tài liệu bị chặn oan: ${r.reason}`).toBe(false);
  });

  test('vẫn CHẶN khi tên driver đi kèm ngữ cảnh NẠP', () => {
    for (const noiDung of ['import pyodbc', 'conn = pymssql.connect(x)', 'from pyodbc import connect']) {
      const r = chay({ tool_name: 'Write', tool_input: { file_path: 'scripts/tam.py', content: noiDung } });
      expect(r.chan, `phải chặn: ${noiDung}`).toBe(true);
    }
  });
});

test.describe('@infra guard-db hook — fail-closed và không rò bí mật', () => {
  test('input hỏng ⇒ CHẶN, không im lặng cho qua', () => {
    /*
     * Một hook an toàn hỏng lặng lẽ thì TỆ HƠN không có hook: nó tạo ra niềm tin sai. `settings.json`
     * vẫn khai nó, báo cáo vẫn nói "có PreToolUse", mà thực tế không gì được gác.
     */
    const r = spawnSync(process.execPath, [HOOK], { cwd: REPO, encoding: 'utf8', input: '{khong-phai-json', env: gateEnv() });
    const j = JSON.parse(String(r.stdout).trim());
    expect(j.decision).toBe('block');
    expect(String(j.reason)).toMatch(/fail-closed|không đọc được/i);
  });

  test('thông điệp KHÔNG in lại nội dung lệnh — lệnh có thể chứa mật khẩu', () => {
    /*
     * `reason` của hook đi thẳng vào context của agent rồi vào transcript. In lại lệnh bị chặn là chép
     * mật khẩu vào đúng nơi khó xoá nhất.
     */
    const mk = 'MatKhauSieuBiMat123';
    const r = bash(`echo $LIB_MASTER_DB_PASSWORD # ${mk}`);
    expect(r.chan).toBe(true);
    expect(r.reason, 'thông điệp chứa lại nội dung lệnh').not.toContain(mk);
    expect(r.reason.split('\n').length, 'phải gọn một dòng').toBeLessThanOrEqual(2);
  });
});

test.describe('@infra guard-db hook — đã ĐĂNG KÝ, không chỉ tồn tại', () => {
  test('`.claude/settings.json` khai `PreToolUse` trỏ đúng hook', () => {
    /*
     * Một hook không được đăng ký thì nó là một file chết. Chuyện đó đã xảy ra với `gate_on_write.js`:
     * viết từ round-3 mà chưa máy nào khai, trong khi `CLAUDE.md` vẫn tuyên bố "có harness hook".
     */
    const j = JSON.parse(fs.readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8'));
    const pre = j.hooks?.PreToolUse;
    expect(pre, 'chưa khai PreToolUse').toBeTruthy();
    const txt = JSON.stringify(pre);
    expect(txt).toContain('guard_db_access.js');
    for (const t of ['Bash', 'Read', 'Grep', 'Edit', 'Write']) {
      expect(txt, `matcher thiếu ${t}`).toContain(t);
    }
  });
});

test.describe('@infra guard-db hook — ĐỐI SỐ của lệnh đọc, không phải chuỗi ở đâu đó', () => {
  /*
   * Đo 23/10/2026: hook hỏi "chuỗi có từ-đọc không?" và "có đường-dẫn-bí-mật không?" RỜI RẠC, nên hai
   * thứ chẳng liên quan vẫn thành một lời buộc tội. Hai lỗi NGƯỢC CHIỀU cùng tồn tại:
   *   · `git commit -F - <<EOF …nhắc tên file… EOF && git push | tail -2` → CHẶN OAN (cái `tail` đọc
   *     output của `git push`, đường dẫn chỉ nằm trong thân thông điệp commit);
   *   · `grep PASSWORD <file bí mật>` → LỌT, dù đó mới đúng là đọc bí mật.
   * Nay cắt theo `| ; && ||` rồi chỉ xét đoạn có TỪ ĐẦU là lệnh đọc, soi ĐỐI SỐ của chính đoạn đó.
   */
  const P = 'profiles/TASK-9001/task.env';

  for (const [ten, cmd] of [
    ['cat thẳng', `cat ${P}`],
    ['grep vào file bí mật', `grep PASSWORD ${P}`],
    ['sed đọc file bí mật', `sed -n '1,5p' ${P}`],
    ['Get-Content (PowerShell)', `Get-Content ${P}`],
    ['cat ở đoạn sau &&', `npm run lint && cat ${P}`],
    ['cat sau tiền tố gán biến', `FOO=1 cat ${P}`],
  ] as [string, string][]) {
    test(`CHẶN: ${ten}`, () => {
      expect(bash(cmd).chan, `phải chặn: ${cmd}`).toBe(true);
    });
  }

  for (const [ten, cmd] of [
    ['commit NHẮC tên + pipe tail', `git commit -m "doc ve ${P}" && git push | tail -2`],
    ['echo tên file rồi head output khác', `echo ${P} | head -1`],
    ['gán TASK_ENV= (không in ra)', `TASK_ENV=${P} npm run preflight -- --task X`],
    ['cat BẢN MẪU', 'cat profiles/task.env.example'],
  ] as [string, string][]) {
    test(`CHO QUA: ${ten}`, () => {
      expect(bash(cmd).chan, `không được chặn: ${cmd}`).toBe(false);
    });
  }
});
