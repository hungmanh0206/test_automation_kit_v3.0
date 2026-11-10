import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * NĂM LỆNH (v2.7.0 §A7) — và sáu lệnh còn lại KHÔNG cần nhớ.
 *
 * Mốc ở `docs/v2.7.0/BASELINE.md`: 55 lệnh npm khác nhau rải khắp các điểm vào, 43 lệnh gate trong
 * chuỗi Phase 2 và 30 trong Phase 1. Đích là 5.
 *
 * Phần đáng đo không phải "đã xoá bao nhiêu lệnh" — không lệnh nào bị xoá, chúng vẫn cần thiết. Phần
 * đáng đo là: người dùng phải NHỚ bao nhiêu, và sáu lệnh còn lại có TÌM THẤY ĐƯỢC không. Nên bộ test
 * này đo hai thứ đó, không đo tổng số lệnh.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const NEXT = path.join(REPO, 'scripts/qa/next_command.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const nc = require(NEXT);

/*
 * NĂM LỆNH PHẢI NHỚ — đổi 10/11/2026 theo bốn phase mà chủ dự án chốt.
 *
 * Cũ: start · phase1 · phase2 · rerun · release. Mới: bốn phase liên tục + release.
 * `/1_start` và `/discover` KHÔNG biến mất — chúng nằm TRONG `/2_phase1`, và người mới chỉ cần nhớ
 * một tên cho cả bước chuẩn bị thay vì hai.
 *
 * ĐÁNH SỐ 10/11/2026 — tên file lệnh mang luôn thứ tự chạy. Trong Claude Code tên file CHÍNH LÀ tên
 * lệnh, nên đây không phải việc trang trí thư mục: `/phase1` không còn gõ được, phải gõ `/2_phase1`.
 * Bảy lệnh phụ trợ cố ý KHÔNG có số — chúng gọi khi cần, không có vị trí trong dòng chảy.
 */
const NAM_LENH = ['2_phase1', '3_phase2', '5_phase3', '6_phase4', '7_release'];
const GOI_Y_DUNG_LUC = ['4_publish', 'discover', 'explore', 'manual-run', 'ui-debug', 'partial-rerun'];

test.describe.configure({ mode: 'default' });

test.describe('@infra năm lệnh — có mặt, và CHEATSHEET nói đúng năm cái đó', () => {
  test('cả năm lệnh đều tồn tại dưới `.claude/commands/`', () => {
    for (const l of NAM_LENH) {
      expect(fs.existsSync(path.join(REPO, '.claude/commands', `${l}.md`)), `thiếu /${l}`).toBe(true);
    }
    expect(fs.existsSync(path.join(REPO, '.claude/commands/gates.md')), 'thiếu /gates').toBe(true);
    /*
     * KHÔNG đòi `.claude/commands/check.md`, và chú thích cũ ở đây ("/check đi qua /gates") là SAI —
     * sửa 28/10/2026. Đo: `check.md` CHƯA BAO GIỜ tồn tại (`git log --all --diff-filter=A` trả rỗng),
     * nên không ai gõ được `/check`. Và `/gates` là việc KHÁC: nó chạy bó cửa trước finalize/publish,
     * còn thứ tài liệu gọi là "/check" — tự nhận phase rồi in một bảng gọn — là `npm run check`.
     */
    expect(fs.existsSync(path.join(REPO, '.claude/commands/check.md')), 'không được có /check: nó chưa bao giờ tồn tại, và tài liệu phải trỏ `npm run check`').toBe(false);
  });

  test('`docs/CHEATSHEET.md` nêu ĐÚNG năm lệnh đó, và nêu `npm run check`', () => {
    const cs = fs.readFileSync(path.join(REPO, 'docs/CHEATSHEET.md'), 'utf8');
    for (const l of NAM_LENH) expect(cs, `CHEATSHEET thiếu /${l}`).toContain(`/${l}`);
    /*
     * BẢN TRƯỚC ĐÒI ĐÚNG CHUỖI `/check`, sửa 28/10/2026 — và nó là assertion duy nhất còn giữ cái tên
     * đó sống. README đã đổi sang `npm run check` ở lượt trước, nên hai bề mặt nói hai thứ khác nhau,
     * và CHEATSHEET bị gate giữ lại ở tên cũ. Cùng hình dạng với `manual-run-usability.spec.ts`: một
     * máy gác neo vào CHỮ của tài liệu thì khi tài liệu được sửa cho đúng, nó quay sang chặn bản đúng.
     *
     * Đo trước khi đổi: `.claude/commands/check.md` chưa bao giờ tồn tại, và không bề mặt sống nào còn
     * nhắc `/check`. Nên đòi `npm run check` mới là đòi thứ người dùng gõ được.
     */
    expect(cs, 'CHEATSHEET phải trỏ lệnh gõ ĐƯỢC').toContain('npm run check');
    expect(cs, 'không được dạy `/check` — nó không phải slash command').not.toMatch(/`\/check`/);
    /* Và nó phải nói rõ sáu lệnh kia KHÔNG cần nhớ, nếu không người đọc vẫn tưởng phải nhớ 12 lệnh. */
    expect(cs).toMatch(/KHÔNG cần nhớ/);
    for (const l of GOI_Y_DUNG_LUC) expect(cs, `CHEATSHEET không nhắc /${l}`).toContain(`/${l}`);
  });

  test('README trỏ CHEATSHEET TRƯỚC USER_GUIDE', () => {
    /*
     * Thứ tự quan trọng: người mới đọc từ trên xuống. Trỏ USER_GUIDE trước nghĩa là đưa họ vào bản tra
     * chi tiết khi họ chỉ cần biết gõ lệnh nào.
     */
    const r = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
    const iCs = r.indexOf('docs/CHEATSHEET.md');
    const iUg = r.indexOf('USER_GUIDE.md');
    expect(iCs, 'README không trỏ CHEATSHEET').toBeGreaterThan(0);
    expect(iCs, 'CHEATSHEET phải đứng trước USER_GUIDE').toBeLessThan(iUg);
  });

  test('README khai `docs/course` và `docs/library` là TÀI LIỆU ĐÀO TẠO', () => {
    const r = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
    expect(r).toMatch(/tài liệu đào tạo|tài liệu\s+\*\*đào tạo\*\*/i);
    expect(r, 'và nói rõ không cần đọc để dùng').toMatch(/không cần đọc để dùng/i);
  });

  test('CHEATSHEET nằm trong bộ bị `writing:lint` gác', () => {
    /*
     * Nó là trang ĐẦU TIÊN người dùng đọc. Một trang như vậy trôi khỏi chuẩn hành văn thì cả phần còn
     * lại của bộ tài liệu mất chỗ tựa. Và nó KHÔNG tự nhiên đạt: lúc viết xong nó có 26,5 gạch dài trên
     * 1k từ trong khi mốc là 11.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/writing_lint.js'), 'utf8');
    expect(src).toContain("'docs/CHEATSHEET.md'");
  });

  test('CHEATSHEET gọn thật — một trang, không phải một chương', () => {
    /*
     * HAI PHÉP ĐẾM TỪ, và bản đầu của test này dùng sai cái.
     *
     * Tách theo khoảng trắng đếm cả cú pháp Markdown: dấu `|` của bảng, backtick, mũi tên. File này ra
     * 1.028 token theo cách đó, trong khi `writing_lint` đếm **407 từ** cho cùng file. Ngưỡng 900 tôi
     * đặt lúc đầu dựa trên phép đếm thô mà lại mang con số của phép đếm văn xuôi, nên nó đỏ cho một
     * trang đang ở đúng độ dài.
     *
     * Nay đo cả hai, mỗi cái một ngưỡng của chính nó: văn xuôi dưới 600 từ (khoảng một mặt giấy dày),
     * và token thô dưới 1.400 (chặn trường hợp bảng phình ra mà văn xuôi vẫn ngắn).
     */
    const cs = fs.readFileSync(path.join(REPO, 'docs/CHEATSHEET.md'), 'utf8');
    const tho = cs.split(/\s+/).filter(Boolean).length;
    /*
     * Số từ VĂN XUÔI lấy từ chính `writing:lint`, không tự đếm lại.
     *
     * Tôi đã tự đếm hai lần và lệch cả hai: tách theo khoảng trắng ra 1.028, bóc cú pháp Markdown rồi
     * đếm ra 794, còn `writing_lint` nói 407. Ba con số cho cùng một file nghĩa là "số từ" không phải
     * một đại lượng hiển nhiên, và kit đã có MỘT máy định nghĩa nó. Đếm lại là tạo nguồn thứ hai.
     */
    const r = spawnSync(process.execPath,
      [path.join(REPO, 'scripts/qa/writing_lint.js'), 'docs/CHEATSHEET.md', '--profile', 'doc'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const m = `${r.stdout}`.match(/(\d+) từ/);
    expect(m, 'không đọc được số từ từ writing:lint').not.toBeNull();
    const vanXuoi = Number(m![1]);
    expect(vanXuoi, `văn xuôi ${vanXuoi} từ — quá dài thì nó thôi là cheatsheet`).toBeLessThan(600);
    expect(vanXuoi, 'quá ngắn thì nó không đủ để bắt đầu').toBeGreaterThan(200);
    expect(tho, `token thô ${tho} — bảng phình ra cũng làm mất tính một-trang`).toBeLessThan(1400);
  });
});

test.describe('@infra next — gợi ý suy từ TRẠNG THÁI ARTIFACT', () => {
  function dungTask(co: Record<string, boolean>) {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'next-'));
    const taskDir = path.join(goc, 'tasks', 'T-NEXT');
    for (const d of ['test-cases', 'test-results', 'reports', 'requirements']) {
      fs.mkdirSync(path.join(taskDir, d), { recursive: true });
    }
    if (co.case) fs.writeFileSync(path.join(taskDir, 'test-cases', 'tc.md'), '# tc\n', 'utf8');
    if (co.status) fs.writeFileSync(path.join(taskDir, 'test-results', 'testcase-status.json'), '{}', 'utf8');
    if (co.mauSo) fs.writeFileSync(path.join(taskDir, 'requirements', 'scope_inventory.md'), '# scope\n', 'utf8');
    if (co.register) fs.writeFileSync(path.join(taskDir, 'reports', 'risk-register.json'), '{"modules":[]}', 'utf8');
    if (co.lan) fs.writeFileSync(path.join(taskDir, 'reports', 'lane.json'), '{"lan":"full"}', 'utf8');
    if (co.soNoSach) fs.writeFileSync(path.join(taskDir, 'reports', 'gate-debt.json'), '{"mon":[]}', 'utf8');
    if (co.soNoCon) fs.writeFileSync(path.join(taskDir, 'reports', 'gate-debt.json'), '{"mon":[{"khoa":"a"}]}', 'utf8');
    if (co.dauVetDone) fs.writeFileSync(path.join(taskDir, 'reports', 'exit-gate-done.json'), '{"cua":"done"}', 'utf8');
    return { goc, taskDir };
  }

  test('chưa có profile ⇒ gợi ý `/1_start`', () => {
    const t = dungTask({});
    const s = nc.trangThai('T-KHONG-CO-PROFILE', t.taskDir);
    expect(s.co_profile).toBe(false);
    expect(nc.goiY(s)[0].lenh).toBe('/1_start');
  });

  test('có case mà chưa neo mẫu số ⇒ gợi ý `scope:anchor:init`', () => {
    const t = dungTask({ case: true });
    const s = { ...nc.trangThai('T-NEXT', t.taskDir), co_profile: true };
    const ds = nc.goiY(s).map((g: { lenh: string }) => g.lenh);
    expect(ds).toContain('npm run scope:anchor:init');
  });

  test('có register mà chưa chốt làn ⇒ gợi ý `lane`', () => {
    const t = dungTask({ case: true, mauSo: true, register: true });
    const s = { ...nc.trangThai('T-NEXT', t.taskDir), co_profile: true };
    expect(nc.goiY(s).map((g: { lenh: string }) => g.lenh)).toContain('npm run lane -- --task <KEY>');
  });

  test('đã execute, sổ nợ SẠCH, chưa qua cửa cuối ⇒ gợi ý `/7_release`', () => {
    const t = dungTask({ case: true, mauSo: true, status: true, soNoSach: true });
    const s = { ...nc.trangThai('T-NEXT', t.taskDir), co_profile: true };
    expect(s.so_no).toBe(0);
    expect(nc.goiY(s).map((g: { lenh: string }) => g.lenh)).toContain('/7_release');
  });

  test('sổ nợ CÒN MÓN ⇒ gợi ý `/6_phase4`, KHÔNG gợi ý `/7_release`', () => {
    /* Qua cửa cuối với sổ nợ còn món là đúng thứ §A2 chặn; gợi ý `/7_release` ở đó là dẫn người ta vào tường. */
    const t = dungTask({ case: true, mauSo: true, status: true, soNoCon: true });
    const s = { ...nc.trangThai('T-NEXT', t.taskDir), co_profile: true };
    const ds = nc.goiY(s).map((g: { lenh: string }) => g.lenh);
    expect(ds).toContain('/6_phase4');
    expect(ds).not.toContain('/7_release');
  });

  test('THIẾU sổ nợ KHÁC sổ nợ SẠCH — gợi ý `npm run check` để biết đã gate nào chạy chưa', () => {
    /* `so_no === null` nghĩa là chưa gate nào ghi gì, mà điều đó có thể nghĩa là chưa gate nào CHẠY. */
    const t = dungTask({ case: true, mauSo: true });
    const s = { ...nc.trangThai('T-NEXT', t.taskDir), co_profile: true };
    expect(s.so_no).toBeNull();
    const g = nc.goiY(s).find((x: { lenh: string }) => x.lenh === 'npm run check');
    expect(g, 'phải gợi ý `npm run check`').toBeTruthy();
    expect(g.vi_sao).toContain('chưa gate nào CHẠY');
  });

  test('MỌI lệnh `/x` mà bộ gợi ý phát ra đều phải có file CÓ THẬT', () => {
    /*
     * MÁY CHẶN LỚP LỖI VỪA BẮT ĐƯỢC, thêm 28/10/2026.
     *
     * `next_command.js` từng phát ra `/check` như một lệnh để người dùng gõ, trong khi
     * `.claude/commands/check.md` chưa bao giờ tồn tại. Nó không hỏng ở phía kit — không gate nào đỏ,
     * không log nào kêu — nó hỏng ở phía NGƯỜI DÙNG: họ gõ vào và không có gì xảy ra. Đó là chỗ không
     * ai nhìn, nên nó sống được rất lâu, và nó đã sống đủ lâu để lan vào `docs/CHEATSHEET.md` (5 chỗ),
     * README (3 chỗ, sửa ở lượt trước) và cả một assertion trong chính spec này.
     *
     * Máy này rẻ và tất định: gom mọi `lenh` bắt đầu bằng `/`, đòi có file tương ứng. Nó bắt được cả
     * trường hợp ai đó đổi tên một command mà quên sửa bộ gợi ý.
     */
    const moiLenh: string[] = [];
    const nguon = fs.readFileSync(NEXT, 'utf8');
    for (const m of nguon.matchAll(/lenh:\s*'(\/[a-z0-9:_-]+)'/g)) moiLenh.push(m[1]);
    expect(moiLenh.length, 'không bóc được lệnh nào ⇒ phép kiểm rỗng, không phải đạt').toBeGreaterThan(5);
    const thieu = [...new Set(moiLenh)]
      .filter((l) => !fs.existsSync(path.join(REPO, '.claude/commands', `${l.slice(1)}.md`)));
    expect(thieu, `bộ gợi ý phát ra lệnh KHÔNG có file: ${thieu.join(' · ')} — người dùng gõ vào thì không có gì xảy ra`).toEqual([]);
  });

  test('gợi ý theo DÒNG CHẢY, không theo mức quan trọng', () => {
    /*
     * Người đang ở bước 2 không cần nghe gợi ý của bước 5, kể cả khi bước 5 quan trọng hơn. Gợi ý sai
     * thời điểm là nhiễu, và nhiễu làm người ta thôi đọc dòng này.
     */
    const thuTu = nc.GOI_Y.map((g: { lenh: string }) => g.lenh);
    expect(thuTu.indexOf('/1_start')).toBeLessThan(thuTu.indexOf('/3_phase2'));
    expect(thuTu.indexOf('/3_phase2')).toBeLessThan(thuTu.indexOf('/5_phase3'));
    expect(thuTu.indexOf('/5_phase3')).toBeLessThan(thuTu.indexOf('/7_release'));
  });

  test('CHỈ gợi ý — không tự chạy, không tự ghi', () => {
    /*
     * Máy biết trạng thái nhưng không biết người đang muốn làm gì; họ có thể đang cố ý dừng giữa để rà
     * một chỗ. Một máy tự chạy bước tiếp theo sẽ đúng chín lần và phá một lần, và lần thứ mười là lần
     * người ta thôi dùng nó.
     */
    const src = fs.readFileSync(NEXT, 'utf8');
    expect(src).not.toMatch(/writeFileSync|spawnSync|execFileSync/);
    expect(src).toMatch(/CHỈ GỢI Ý/);
  });

  test('sáu lệnh theo TÌNH HUỐNG được liệt kê kèm khi nào dùng', () => {
    const ds = nc.THEO_TINH_HUONG.map((t: { lenh: string }) => t.lenh.replace('/', ''));
    for (const l of ['ui-debug', 'manual-run', 'explore', 'partial-rerun']) {
      expect(ds, `thiếu /${l}`).toContain(l);
    }
    for (const t of nc.THEO_TINH_HUONG) {
      expect(String(t.khi).length, `${t.lenh}: thiếu mô tả khi nào dùng`).toBeGreaterThan(25);
    }
  });

  test('không có TASK_KEY ⇒ vẫn gợi ý `/1_start`, KHÔNG báo lỗi', () => {
    /* Đây là ca của người mới, và báo lỗi ở đây là chặn đúng người cần giúp nhất. */
    const r = spawnSync(process.execPath, [NEXT, '--mot-dong'],
      { cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: '', TASK_KEY: '' } });
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toContain('/1_start');
  });
});

test.describe('@infra `/check` in dòng "Lệnh tiếp theo"', () => {
  test('`check` gọi `next_command` và in một dòng', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/check.js'), 'utf8');
    expect(src).toContain('next_command.js');
    expect(src).toContain('--mot-dong');
    /* Gợi ý thiếu KHÔNG được làm chết lượt kiểm — nó là phần thêm, không phải phần chính. */
    expect(src).toMatch(/gợi ý thiếu thì KHÔNG được làm chết lượt kiểm/);
  });

  test('`/7_release` chạy cửa `done` rồi mới `release:summary`', () => {
    /*
     * Thứ tự có nghĩa: cửa CHẶN, còn summary chỉ KHUYẾN NGHỊ. Chạy summary trước thì người ta đọc một
     * khuyến nghị go/no-go cho một task chưa qua cửa.
     */
    const r = fs.readFileSync(path.join(REPO, '.claude/commands/7_release.md'), 'utf8');
    const iCua = r.indexOf('exit:gate -- --cua done');
    const iSum = r.indexOf('release:summary');
    expect(iCua).toBeGreaterThan(0);
    expect(iCua).toBeLessThan(iSum);
    expect(r, 'phải nói rõ summary không chặn và không tự quyết').toMatch(/không chặn và không tự quyết/);
  });

  test('`/7_release` nêu ba trạng thái của cửa, gồm `○`', () => {
    const r = fs.readFileSync(path.join(REPO, '.claude/commands/7_release.md'), 'utf8');
    expect(r).toContain('không phán được');
    expect(r, 'và cảnh báo đọc ○ thành ✓').toMatch(/Đọc nó thành `✓`/);
  });
});
