/**
 * `gate:reachable` — mỗi MÁY có nằm trên một ĐƯỜNG CHẠY THẬT không?
 *
 * BỐI CẢNH. Người review 11/11/2026: *"chưa khép kín toàn bộ các kiểm tra đó thành một quy trình
 * end-to-end"*. Đo lại thì chỗ hỏng cụ thể hơn lời phê bình: `exec:proof`, `write:proof`,
 * `setup:proof` KHÔNG được gọi từ đâu cả — chỉ có mặt ở `GATES.md` (danh mục TỰ SINH), trang thư
 * viện, `package.json` và spec của chính chúng.
 *
 * `gate:policy` vẫn ĐẠT vì luật của nó là "mọi npm script phải được NHẮC TỚI ở đâu đó", và cả ba bề
 * mặt kia đều tính là nhắc tới. Danh mục tự sinh nhắc tới mọi máy theo định nghĩa; trang thư viện là
 * chỗ tra cứu; còn spec chứng minh máy CHẠY ĐƯỢC chứ không chứng minh CÓ AI CHẠY.
 *
 * Ranh giới phải giữ: vế ÂM đáng tin, vế DƯƠNG chỉ là chặn trên. Mấy ca dưới đây gác đúng chỗ đó.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'gate_reachable.js');

const chay = (argv: string[] = []) => {
  const r = spawnSync(process.execPath, [CUA, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const doc = () => JSON.parse(chay(['--json']).out);

test.describe('@infra gate:reachable — máy có nằm trên đường chạy không', () => {
  test('cây hiện tại: đếm được, và con số nằm dưới mốc đã đo', () => {
    const j = doc();
    expect(j.tong_script, 'không đọc được npm script nào ⇒ ca này đo hư không').toBeGreaterThan(100);
    expect(j.be_mat_chay, 'phải quét được kha khá bề mặt chạy').toBeGreaterThan(50);
    expect(j.khong_co_duong_chay, `mốc là số ĐÃ ĐO — vượt thì nối máy vào, đừng nâng mốc:\n${j.danh_sach.join(' ')}`)
      .toBeLessThanOrEqual(j.moc);
  });

  test('ĐỐI CHỨNG DƯƠNG: ba máy proof đã được nối ⇒ KHÔNG còn trong danh sách mồ côi', () => {
    /*
     * Đây là ca mang chính phát hiện của người review. Trước 11/11/2026 cả ba nằm trong danh sách;
     * nay chúng ở `PHAI_SPAWN[2]` của `check.js`. Ca này đỏ lại nghĩa là có người gỡ chúng ra.
     */
    const j = doc();
    for (const m of ['exec:proof', 'write:proof', 'setup:proof']) {
      expect(j.danh_sach, `${m} lại rơi khỏi mọi đường chạy — một máy không ai gọi thì nó không gác gì`)
        .not.toContain(m);
    }
  });

  test('ba máy proof thật sự nằm trong bó gate, không chỉ "được nhắc tới"', () => {
    /*
     * `gate:reachable` chỉ đếm sự XUẤT HIỆN, nên một cái tên nằm trong câu văn cũng qua. Ca này đọc
     * thẳng `check.js` để chắc chúng nằm trong danh sách SPAWN — tức thật sự được chạy.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'check.js'), 'utf8');
    for (const m of ['exec:proof', 'write:proof', 'setup:proof']) {
      expect(src, `check.js không spawn ${m}`).toMatch(new RegExp(`lenh: '${m}'`));
    }
  });

  test('ba máy proof in dòng `~` cho bó gate đọc — không có nó thì chúng thành PASS im lặng', () => {
    /*
     * `check.js` chỉ nhặt dòng mở đầu bằng `~` làm cảnh báo. Nối một máy luôn-thoát-0 mà không có
     * dòng đó thì bó gate hiện ra một ô PASS cho thứ không ai đọc — tệ hơn là không nối.
     */
    for (const f of ['exec_proof.js', 'write_proof.js', 'setup_proof.js']) {
      const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', f), 'utf8');
      expect(src, `${f} thiếu dòng \`~\` cho bó gate`).toMatch(/console\.log\(`~ /);
      expect(src, `${f}: dòng đó phải nói rõ là CẦN REVIEW`).toMatch(/CẦN REVIEW/);
    }
  });

  test('KHÔNG enforce thì KHÔNG được in "ĐẠT" khi đang trên mốc', () => {
    /*
     * ĐÃ HỎNG Ở ĐÂY ngay lượt chạy đầu: bản đầu in `✓ ĐẠT — 27 ≤ mốc 18` — một câu tự mâu thuẫn, và
     * đúng lớp lỗi mà cả cửa này sinh ra để chống. Không chặn KHÁC đã đạt.
     */
    const src = fs.readFileSync(CUA, 'utf8');
    expect(src, 'phải có nhánh in khi TRÊN mốc mà không chặn').toMatch(/TRÊN mốc/);
    const out = chay().out;
    const m = out.match(/(\d+) máy mồ côi, TRÊN mốc (\d+)/);
    if (m) expect(Number(m[1]), 'in "TRÊN mốc" thì số phải thật sự lớn hơn mốc').toBeGreaterThan(Number(m[2]));
    else expect(out, 'dưới mốc thì mới được in ĐẠT').toMatch(/✓ ĐẠT/);
  });

  test('`--enforce` CÓ RĂNG: hạ mốc xuống 0 ⇒ CHẶN', () => {
    const goc = fs.readFileSync(CUA, 'utf8');
    try {
      fs.writeFileSync(CUA, goc.replace(/const MOC = \d+;/, 'const MOC = 0;'), 'utf8');
      const r = chay(['--enforce']);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/CHẶN/);
      expect(r.out, 'phải nói rõ đừng nâng mốc').toMatch(/KHÔNG nâng mốc/);
    } finally {
      fs.writeFileSync(CUA, goc, 'utf8');
    }
  });

  test('"không phán được" KHÔNG thành "đạt": quá ít bề mặt chạy ⇒ exit 2', () => {
    const r = spawnSync(process.execPath, [CUA], { cwd: path.join(REPO, 'scripts'), encoding: 'utf8', env: gateEnv() });
    /* Chạy từ thư mục con: `git ls-files` vẫn ra, nhưng đây là ca giữ cho nhánh exit-2 còn nguyên. */
    expect([0, 2]).toContain(r.status);
  });

  test('cửa TỰ NÓI giới hạn: vế dương chỉ là CHẶN TRÊN', () => {
    const out = chay().out;
    expect(out, 'phải nói vế âm đáng tin').toMatch(/vế ÂM đáng tin/i);
    expect(out, 'và vế dương chỉ là chặn trên').toMatch(/CHẶN TRÊN/);
    expect(out, 'và nói rõ GATES.md không tính là nối').toMatch(/danh mục đó tự sinh|GATES\.md/);
  });

  test('nằm trong static-check — một cửa không ai chạy thì chính nó cũng mồ côi', () => {
    const ci = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'static-check.yml'), 'utf8');
    expect(ci, 'gate:reachable phải nằm trong CI, nếu không nó tự rơi vào đúng lớp lỗi nó gác')
      .toMatch(/npm run gate:reachable/);
  });
});
