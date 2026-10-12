import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * BỘ DỮ LIỆU VÀNG + HAI PHÉP ĐẾM ĐỘC LẬP (v2.7.0 §A10.4 + §A10.5).
 *
 * `scripts/lib/testcase` là chỗ 30 file cùng dùng. Một thay đổi nhỏ ở đó — bóc thêm một dải icon, chuẩn
 * hoá thêm một loại khoảng trắng, đổi cách tách bước đánh số — đổi đầu ra của CẢ 30 gate một lúc. Bộ test
 * hiện có kiểm từng hành vi riêng, nhưng trước v2.7.0 không bộ nào đóng băng ĐẦU RA TOÀN PHẦN trên một
 * tập đầu vào cố định.
 *
 * Lớp lỗi này đã xảy ra thật và đắt: một lượt đọc `.xlsx` đếm 194 case thành 1.179 vì ô stub `t:z` rơi
 * vào nhánh `String(ô)` ra `"[object Object]"`. Số sai đi vào fixture, vào báo cáo coverage, rồi mới lộ.
 *
 * Hai test quan trọng nhất ở đây là hai PHÉP ĐỐI CHỨNG. Một mốc không bao giờ đỏ thì không ai biết nó có
 * tác dụng gì, và một bộ đo không chứng minh được mình bắt được thì nó chỉ là một dòng xanh.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/golden_check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const g = require(MAY);

const BO = path.join(REPO, 'tests/fe/fixtures/golden/testcase');
const MOC = path.join(BO, 'expected.json');
const MODEL = path.join(REPO, 'scripts/lib/testcase/model.js');

const chay = (them: string[] = []) => spawnSync(process.execPath, [MAY, ...them], {
  cwd: REPO, encoding: 'utf8', env: gateEnv(),
});

test.describe.configure({ mode: 'serial' });

test.describe('@infra golden:check — mốc đóng băng của parser canonical', () => {
  test('cây sạch ⇒ exit 0, và nói rõ đã khớp bao nhiêu case', () => {
    const r = chay();
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(`${r.stdout}`).toMatch(/\d+ fixture · \d+ case khớp mốc/);
  });

  test('bộ fixture phủ đúng những bẫy ĐÃ TỪNG làm sai số liệu', () => {
    /*
     * Ba bẫy, mỗi cái là một lỗi đã xảy ra: đánh số bước (số không liên tục, bước không số), ký tự (icon
     * ⚠/⛔ nằm ngoài dải bóc cũ, mũi tên → là chữ nghĩa chứ không phải trang trí, khoảng trắng không ngắt
     * và zero-width), và một bộ tối thiểu làm mốc so sánh.
     */
    const f = fs.readdirSync(BO).filter((x) => x.endsWith('.md')).sort();
    expect(f.length, 'ít hơn 3 fixture thì bộ vàng không phủ được bẫy nào').toBeGreaterThanOrEqual(3);
    const tt = f.join(' ');
    expect(tt).toContain('danh-so');
    expect(tt).toContain('ky-tu');
  });

  test('mốc KHÔNG tự ghi lại được — sinh lại là một lời khai', () => {
    /*
     * Chỗ này quyết định mốc có giá trị hay không. Nếu `--write` chạy được không điều kiện thì cách rẻ
     * nhất để làm xanh một lượt đỏ là ghi lại mốc, và lúc đó mốc chỉ còn ghi lại hiện trạng — đúng kiểu
     * tautology mà non-negotiable §3 cấm ở tầng testcase.
     */
    const r = chay(['--write']);
    expect(r.status, '`--write` trần phải bị chặn').toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('--toi-da-doi-parser');
    const moc = JSON.parse(fs.readFileSync(MOC, 'utf8'));
    expect(moc._canh_bao, 'chính file mốc phải nói nó là lời khai').toContain('LỜI KHAI');
  });

  test('ĐỐI CHỨNG 1: đổi parser canonical ⇒ mốc ĐỎ, và nêu đúng trường nào lệch', () => {
    /*
     * Phép đối chứng thật: nới dải bóc icon để nó ăn cả mũi tên `→`, chạy máy, rồi trả lại nguyên văn.
     * Đây là đúng loại thay đổi trông vô hại nhất — một dải Unicode rộng thêm một chút — và nó đổi nội
     * dung ô của mọi case có mũi tên trong câu.
     */
    const goc = fs.readFileSync(MODEL, 'utf8');
    const hong = goc.replace('☀-➿', '←-➿');
    expect(hong, 'không tìm thấy dải bóc icon — đối chứng này đã mất neo, phải sửa lại test').not.toBe(goc);

    try {
      fs.writeFileSync(MODEL, hong, 'utf8');
      const r = chay();
      expect(r.status, 'đổi parser mà mốc vẫn xanh thì mốc vô dụng').toBe(1);
      const ra = `${r.stdout}${r.stderr}`;
      expect(ra).toContain('LỆCH MỐC');
      expect(ra, 'phải nêu ĐƯỜNG DẪN tới trường lệch, không chỉ nói "có lệch"').toMatch(/case\.\d+\.(stepsRaw|expectedRaw)/);
      expect(ra, 'phải in cả giá trị mốc và giá trị hiện tại').toContain('mốc:');
    } finally {
      fs.writeFileSync(MODEL, goc, 'utf8');
    }

    const sau = chay();
    expect(sau.status, 'phải trả lại được nguyên văn — một file model để lại dạng hỏng là tệ nhất').toBe(0);
  });

  test('ĐỐI CHỨNG 2: hai phép đếm lệch nhau ⇒ NGHI GATE SAI, không phải "đạt"', () => {
    /*
     * Fixture tạm có một hàng trông đúng khuôn case nhưng nằm trong khối code. Model bỏ nó (đúng), đếm
     * thô tính nó (sai). Lưu ý điều này: ở ca này bên SAI lại là phép đếm thô — và đó chính là lý do câu
     * thông báo nói "chưa biết tin bên nào" chứ không nói "model sai".
     */
    const tam = path.join(BO, '99-doi-chung-tam.md');
    const md = [
      '# Fixture tạm — chỉ sống trong một test',
      '',
      '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
      '| TAM_TC_001 | Functional | [Positive] | M | T | [ui] x | n/a | 1. a | 1. b | Medium | Medium |',
      '',
      '```',
      '| TAM_TC_999 | Functional | [Positive] | M | T | [ui] x | n/a | 1. a | 1. b | Medium | Medium |',
      '```',
      '',
    ].join('\n');

    expect(g.demTho(md), 'đếm thô phải thấy 2 hàng khớp khuôn TC ID').toBe(2);
    expect(g.anh(md).so_case, 'model phải chỉ thấy 1 case thật').toBe(1);

    try {
      fs.writeFileSync(tam, md, 'utf8');
      const r = chay();
      expect(r.status).toBe(1);
      const ra = `${r.stdout}${r.stderr}`;
      expect(ra).toContain('NGHI GATE SAI');
      expect(ra).toContain('KHÔNG BIẾT TIN BÊN NÀO');
    } finally {
      fs.rmSync(tam, { force: true });
    }

    expect(chay().status, 'dọn fixture tạm xong phải xanh lại').toBe(0);
  });

  test('phép đếm thứ hai KHÔNG đi qua model — nếu không thì hai đường cùng sai một lúc', () => {
    /*
     * Đây là điều kiện làm cho §A10.5 có nghĩa. Một bộ đo kiểm chính nó bằng chính nó là tautology: nếu
     * `demTho` cũng gọi `parseMarkdown` thì hai số luôn khớp, kể cả khi parser sai.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    const than = src.slice(src.indexOf('function demTho'), src.indexOf('function anh'));
    expect(than).not.toContain('parseMarkdown');
    expect(than).not.toContain('canonical.');
  });

  test('mốc KHÔNG đóng băng `_cells` — nếu đóng băng thì mọi sửa nhãn cột thành CHẶN', () => {
    const moc = JSON.parse(fs.readFileSync(MOC, 'utf8'));
    const mot = Object.values(moc.bo as Record<string, { case: Array<Record<string, unknown>> }>)[0];
    expect(Object.keys(mot.case[0]), 'mốc phải hẹp đúng phần 30 gate tiêu thụ').not.toContain('_cells');
    expect(Object.keys(mot.case[0])).toContain('oracleRefs');
    expect(Object.keys(mot.case[0])).toContain('techniques');
  });
});
