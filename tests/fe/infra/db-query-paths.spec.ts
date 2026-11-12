import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `db:query` và `db:paths:check` (v2.8.0 §0b.4 · §0b.5 · §0b.6).
 *
 * Hook `PreToolUse` chặn mọi đường tự nối DB — nên phải có MỘT đường được phép, nếu không thì cái bị chặn
 * là công việc chứ không phải rủi ro. `db:query` là đường đó, và nó phải làm bốn thứ mà một đoạn code tự
 * viết không làm: đi qua lint và transaction, CHE PII **trước khi ghi file**, chặn trần số dòng, và để lại
 * một dòng audit.
 *
 * GIỚI HẠN CỦA BỘ TEST NÀY, nói trước: đường chạy THÀNH CÔNG của `db:query` cần một DB thật, nên nó KHÔNG
 * được test ở đây — chạm UAT phải có xác nhận của user từng lượt (non-negotiable §2). Thứ test được mà
 * không cần DB: đường bị lint chặn, hình dạng dòng audit, phép che PII, và toàn bộ `db:paths:check`.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DB_QUERY = path.join(REPO, 'scripts/qa/db_query.js');
const DB_PATHS = path.join(REPO, 'scripts/qa/db_paths_check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const pii = require(path.join(REPO, 'scripts/qa/lib/pii_mask.js'));

function taskTam() {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'dbq-'));
  fs.mkdirSync(path.join(goc, 'tasks', 'T-DBQ'), { recursive: true });
  return { goc, taskDir: path.join(goc, 'tasks', 'T-DBQ') };
}

const chayQuery = (args: string[], goc: string) => spawnSync(process.execPath, [DB_QUERY, ...args], {
  cwd: REPO, encoding: 'utf8', env: gateEnv({ PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-DBQ' }),
});

test.describe.configure({ mode: 'default' });

test.describe('@infra db:query — đường tra cứu DUY NHẤT được phép', () => {
  test('KHÔNG nhận câu SQL trên dòng lệnh — chỉ nhận `--sql-file`', () => {
    /*
     * Cố ý. Câu SQL trên dòng lệnh đi vào lịch sử shell VÀ vào transcript của agent, và câu verify thật
     * thường mang tên đơn vị hoặc giá trị thật trong `WHERE`. File thì nằm trong task và xoá được.
     */
    const t = taskTam();
    const r = chayQuery([], t.goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toContain('--sql-file');
  });

  test('câu bị lint CHẶN ⇒ exit 1, và VẪN ghi audit', () => {
    /*
     * Lượt bị chặn cũng là một lượt cần dấu vết: nó cho biết ai đang thử đi đường nào. Nếu chỉ audit
     * lượt thành công thì sổ sẽ im lặng đúng lúc đáng nói nhất.
     */
    const t = taskTam();
    const f = path.join(t.goc, 'bad.sql');
    fs.writeFileSync(f, "SELECT 1 EXEC('DELETE FROM dbo.t')", 'utf8');
    const r = chayQuery(['--sql-file', f], t.goc);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/CHẶN.*EXEC/i);

    const audit = path.join(t.taskDir, 'db_audit.jsonl');
    expect(fs.existsSync(audit), 'lượt bị chặn phải có dòng audit').toBe(true);
    const ban = JSON.parse(fs.readFileSync(audit, 'utf8').trim().split('\n')[0]);
    expect(ban.lint).toBe('CHAN');
    expect(ban.task).toBe('T-DBQ');
    expect(ban.nguon).toBe('db:query');
  });

  test('audit ghi HASH câu SQL, KHÔNG ghi nguyên văn câu, tham số, hay mật khẩu', () => {
    /*
     * Hash đủ để biết "cùng một câu đã chạy bao nhiêu lần" mà không chép dữ liệu ra thêm một chỗ nữa.
     * Ghi nguyên văn thì sổ audit thành bản sao thứ hai của chính thứ nó đang canh.
     */
    const t = taskTam();
    const f = path.join(t.goc, 'q.sql');
    const cau = "SELECT 1 EXEC('x') -- bi-mat-abc123";
    fs.writeFileSync(f, cau, 'utf8');
    chayQuery(['--sql-file', f, '--param', 'MatKhauTrongThamSo'], t.goc);

    const noiDung = fs.readFileSync(path.join(t.taskDir, 'db_audit.jsonl'), 'utf8');
    expect(noiDung, 'audit chứa nguyên văn câu SQL').not.toContain('bi-mat-abc123');
    expect(noiDung, 'audit chứa giá trị tham số').not.toContain('MatKhauTrongThamSo');
    const ban = JSON.parse(noiDung.trim().split('\n')[0]);
    expect(String(ban.sql_sha256), 'phải là hash sha256 64 ký tự hex').toMatch(/^[0-9a-f]{64}$/);
  });

  test('file SQL không tồn tại ⇒ exit 2, nói rõ thiếu gì', () => {
    const t = taskTam();
    const r = chayQuery(['--sql-file', path.join(t.goc, 'khong-co.sql')], t.goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/không thấy file SQL/);
  });

  test('không xác định được task ⇒ exit 2, KHÔNG đoán', () => {
    const r = spawnSync(process.execPath, [DB_QUERY, '--sql-file', 'x.sql'], {
      cwd: REPO, encoding: 'utf8', env: gateEnv({ TASK_KEY: 'T-MOT', TASK_OUTPUT_DIR: path.join(os.tmpdir(), 'tasks', 'T-HAI') }),
    });
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toContain('không xác định được task');
  });
});

test.describe('@infra db:query — CHE PII trước khi GHI, không chỉ trước khi in', () => {
  test('cột PII bị che theo TÊN CỘT, cột thường giữ nguyên', () => {
    /*
     * Tên cột DB của dự án này không dấu và nối gạch dưới (`HO_TEN`, `NGAY_SINH`). Lượt viết đầu của
     * `pii_mask` chỉ phủ nhãn tiếng Việt có dấu, nên `cheHang({HO_TEN: 'Nguyễn Văn A'})` trả về nguyên văn
     * họ tên — non-negotiable §1 hở ở đúng đường `db:query` dùng nhiều nhất.
     */
    const h = pii.cheHang({
      HO_TEN: 'Nguyễn Văn A',
      'Họ và tên': 'Trần B',
      DIA_CHI: '12 Lê Lợi',
      NGAY_SINH: '2001-01-01',
      SO_CMTND: '001234567890',
      EMAIL: 'a@b.vn',
      SO_DIEN_THOAI: '0912345678',
      MA: 'TH001',
      TEN_TRUONG: 'THCS X',
    });
    for (const k of ['HO_TEN', 'Họ và tên', 'DIA_CHI', 'NGAY_SINH', 'SO_CMTND', 'EMAIL', 'SO_DIEN_THOAI']) {
      expect(h[k], `cột PII "${k}" KHÔNG được che`).toBe('<masked>');
    }
    expect(h.MA, 'mã nghiệp vụ bị che oan thì mất chính thứ cần đọc').toBe('TH001');
    expect(h.TEN_TRUONG, 'tên trường là tên tổ chức, không phải tên người').toBe('THCS X');
  });

  test('email và SĐT trong GIÁ TRỊ bị che dù tên cột không phải PII', () => {
    const h = pii.cheHang({ GHI_CHU: 'liên hệ a@b.vn hoặc 0912345678' });
    expect(h.GHI_CHU).toContain('<email-masked>');
    expect(h.GHI_CHU).toContain('<phone-masked>');
  });

  test('SĐT 9 chữ số CŨNG bị che — hợp hai dải của 5 bản cũ', () => {
    /*
     * Trước v2.8.0 kit có 5 bản mẫu PII, và chúng LỆCH: bản ở `screen_snapshot.js` chỉ bắt `0` + 9..10
     * chữ số, bốn bản kia bắt `0` + 8..10. Hệ quả: một SĐT 9 chữ số được che trong báo cáo nhưng KHÔNG
     * che trong ảnh chụp màn — tức evidence đính kèm bug mang SĐT thật.
     */
    expect(pii.cheChuoi('091234567')).toBe('<phone-masked>');
    expect(pii.cheChuoi('0912345678')).toBe('<phone-masked>');
    expect(pii.cheChuoi('09123456789')).toBe('<phone-masked>');
  });

  test('bộ chuẩn hoá nhãn bản Node và bản dựng-trong-trình-duyệt KHỚP NHAU', () => {
    /*
     * `PII_LABEL` viết ở dạng KHÔNG DẤU để phủ cả nhãn trên màn ("Họ và tên") lẫn tên cột DB (`HO_TEN`),
     * nên nó chỉ khớp sau khi nhãn được chuẩn hoá. Nhưng hai chỗ áp nó nằm TRONG `page.evaluate`
     * (`snapshotScreen` và `crawl.oCanChe`), mà hàm không qua được biên đó — nên mã nguồn bộ chuẩn hoá
     * được truyền qua rồi dựng lại bằng `new Function`.
     *
     * Hậu quả đo được khi bỏ qua chuyện này, ở lượt gộp một nguồn đầu tiên: hai test che PII trong ảnh
     * chụp màn tụt từ "che 3 ô" xuống "che 1 ô" rồi "che 0 ô" — ảnh evidence bắt đầu mang họ tên và SĐT
     * thật. Và hai bản còn từng lệch ở chữ `Đ`: bản Node dùng `/gi` nên biến `Đ` thành `d` THƯỜNG.
     */
    // eslint-disable-next-line no-new-func
    const banTrinhDuyet = new Function('l', pii.CHUAN_HOA_NHAN_SRC) as (l: string) => string;
    const CA = [
      'Họ và tên', 'HO_TEN', 'Ngày sinh', 'NGAY_SINH', 'Số điện thoại', 'SO_DIEN_THOAI',
      'Địa chỉ', 'DIA_CHI', 'ĐỊA CHỈ', 'Đ_IEN_THOAI', 'Tên trường', 'Mã', 'Sĩ số', '',
    ];
    for (const c of CA) {
      expect(banTrinhDuyet(c), `hai bộ chuẩn hoá lệch ở nhãn "${c}"`).toBe(pii.chuanHoaNhan(c));
    }
  });

  test('hai chỗ áp mẫu PII trong trình duyệt đều CHUẨN HOÁ trước khi so', () => {
    for (const f of ['scripts/utils/ui/screen_snapshot.js', 'scripts/qa/discovery/crawl.js']) {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(src, `${f} dùng mẫu PII mà KHÔNG chuẩn hoá nhãn ⇒ nhãn có dấu sẽ không khớp`).toContain('chuanHoaNhan');
      expect(src, `${f} chép tay bộ chuẩn hoá thay vì dựng từ nguồn chung`).toContain('chuanHoaSrc');
    }
  });

  test('chỉ còn MỘT nguồn mẫu PII trong scripts/', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) { if (!/node_modules/.test(p)) walk(p); } else if (/\.js$/.test(f.name)) files.push(p);
      }
    };
    walk(path.join(REPO, 'scripts'));
    const tuKhai = files.filter((f) => !/pii_mask\.js$/.test(f))
      .filter((f) => /const\s+(EMAIL_RE|PHONE_RE)\s*=\s*\//.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO, f));
    expect(tuKhai, 'còn bản mẫu PII riêng — hai bản sẽ trôi khỏi nhau').toEqual([]);
  });
});

test.describe('@infra db:paths:check — quét đường vòng trong CODE', () => {
  test('cây hiện tại: 0 đường vòng MỚI, nợ cũ được ĐẾM', () => {
    const r = spawnSync(process.execPath, [DB_PATHS], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(`${r.stdout}`).toMatch(/0 đường vòng MỚI/);
  });

  test('quét được số file lớn — 0 file nghĩa là phép đo hỏng', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const m = require(DB_PATHS);
    const d = m.dungDo();
    expect(d.so_file, '0 file quét được là phép đo hỏng, không phải "sạch"').toBeGreaterThan(300);
  });

  test('phạm vi quét có `tests/fe/lib` — thư viện bước của v2.8.0', () => {
    /*
     * Đây là chỗ nguy hiểm nhất của cả đợt: một BƯỚC DÙNG LẠI mà tự nối DB thì MỌI spec dùng bước đó cùng
     * đi vòng, không chỉ một. Nên vùng này nằm trong phạm vi quét từ §0b, trước khi thư viện có file nào.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const m = require(DB_PATHS);
    expect(m.VUNG.join(' ')).toContain('tests');
    const src = fs.readFileSync(DB_PATHS, 'utf8');
    expect(src).toContain('tests/fe/lib');
  });

  test('DÙNG CHUNG mẫu với hook, không có bản thứ hai', () => {
    /*
     * Chép mẫu ra một bản thứ hai là lặp lại đúng lỗi mà cả §0b sinh ra để sửa: hai bản lint SQL trôi
     * khỏi nhau, năm bản mẫu PII lệch nhau. Một nguồn thì không có chuyện "hook chặn mà gate cho qua".
     */
    const src = fs.readFileSync(DB_PATHS, 'utf8');
    expect(src).toContain("require(path.join(__dirname, 'hooks', 'guard_db_access.js'))");
    expect(src, 'gate tự khai lại mẫu driver').not.toMatch(/const\s+DRIVER\s*=\s*\[/);
  });

  test('miễn trừ phải có LÝ DO và HẠN rà soát', () => {
    /* v3.0.0: danh sách miễn trừ là lớp PROJECT (đường dẫn file task thật), không vào gói — gói chỉ có bản mẫu rỗng. */
    const f = path.join(REPO, '.agent/config/db-paths.allow.json');
    test.skip(!fs.existsSync(f), 'không có db-paths.allow.json (lớp PROJECT) — cây này chưa khai miễn trừ nào để soát');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    expect(j.mien_tru.length, 'danh sách rỗng thì test này vô nghĩa — kiểm lại').toBeGreaterThan(0);
    for (const m of j.mien_tru) {
      expect(String(m.ly_do || '').length, `${m.file} khai miễn trừ mà không nói vì sao`).toBeGreaterThan(60);
      expect(String(m.ra_soat_truoc || ''), `${m.file} thiếu hạn rà soát — miễn trừ không hạn là vĩnh viễn`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(String(j._khong_phai_la), 'file phải nói rõ nó KHÔNG khẳng định các file đó an toàn').toMatch(/db_owner|không.*an toàn/i);
  });

  test('miễn trừ QUÁ HẠN ⇒ CHẶN', () => {
    const src = fs.readFileSync(DB_PATHS, 'utf8');
    expect(src).toContain('QUÁ HẠN');
    expect(src, 'quá hạn phải exit khác 0').toMatch(/qua_han\.length[\s\S]{0,400}?process\.exit\(1\)/);
  });
});
