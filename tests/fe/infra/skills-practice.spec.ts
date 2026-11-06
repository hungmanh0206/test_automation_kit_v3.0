/*
 * `skills:practice` — ĐỌC MỘT SKILL XONG CÓ LÀM RA ĐƯỢC SẢN PHẨM KHÔNG.
 *
 * Cửa này gọi `claude -p` thật nên KHÔNG chạy trong CI và KHÔNG chạy trong spec. Nhưng những tính chất
 * làm nó thành một phép đo — thay vì một cái máy sinh số — thì kiểm được tất định, và mỗi ca dưới đây
 * gác đúng một lỗi đã xảy ra thật trong v2.10.0:
 *
 *   ① Lượt KHÔNG CHẠY ĐƯỢC không được tính là TRƯỢT. Bản đầu của `skills_route_live.js` trộn hai thứ
 *      đó và làm năm lượt quét 90 câu trở nên vô nghĩa, kèm một kết luận đã phải rút lại.
 *   ② Mặc định NHIỀU LƯỢT. Đo 06/11: hai lượt cùng bài cùng bộ chấm cho 2/5 rồi 5/5. Một lượt rồi phán
 *      là tung đồng xu, và lượt 2/5 suýt làm tôi đi sửa một skill không hỏng.
 *   ③ Thư mục làm bài KHÔNG có `prompt_templates/`. Có nó thì model lấy hướng dẫn từ prompt phase, và
 *      phép đo không còn nói gì về SKILL.
 *   ④ Đáp án trỏ ĐÚNG DÒNG của file đề. Bản đầu tôi đếm bằng mắt và sai cả 5 mục — nếu để vậy, bài tập
 *      chấm model "sai dòng" trong khi model nêu đúng.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { mayThu } from './_may_thu';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = mayThu('SKILLS_PRACTICE_JS', path.join(REPO, 'scripts/qa/skills_practice.js'));
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'practice');
const src = () => fs.readFileSync(CUA, 'utf8');

test.describe.configure({ mode: 'default' });

test.describe('@infra skills:practice — lượt hỏng không được thành TRƯỢT', () => {
  test('đọc `result.subtype` + `is_error` để biết lượt có chạy được', () => {
    const s = src();
    expect(s).toMatch(/j\.type === 'result'/);
    expect(s, 'thiếu nhánh này thì lượt bị throttle bị chấm là làm bài sai')
      .toMatch(/chayDuoc\s*=\s*!coLoi/);
  });

  test('lượt không chạy được cho `dat: null`, không phải `false`', () => {
    expect(src(), '`false` nghĩa là làm bài sai; `null` nghĩa là chưa đo được — hai thứ khác hẳn nhau')
      .toMatch(/dat:\s*null/);
  });

  test('mẫu số chỉ gồm lượt CHẠY ĐƯỢC', () => {
    const s = src();
    expect(s).toMatch(/const chay = soSach\.filter\(\(x\) => x\.dat !== null\)/);
    expect(s, 'tỉ lệ đạt phải tính trên lượt chạy được, không trên mọi lượt')
      .toMatch(/chay\.filter\(\(x\) => x\.bai === bai\.ma\)/);
  });

  test('không lượt nào chạy được ⇒ KHÔNG PHÁN ĐƯỢC, không phải TRƯỢT', () => {
    expect(src()).toMatch(/if \(!chay\.length\) thoat2\(/);
  });
});

test.describe('@infra skills:practice — nhiều lượt, vì một lượt là tung đồng xu', () => {
  test('mặc định 3 lượt', () => {
    expect(src(), 'đo 06/11: hai lượt cùng bài cho 2/5 rồi 5/5').toMatch(/co\('lan', '3'\)/);
  });

  test('ngưỡng đạt là 2/3, đúng con số bản chấm đặt', () => {
    expect(src()).toMatch(/dat \/ cua\.length >= 2 \/ 3/);
  });

  test('có `--gia` để đo chi phí MỘT lượt trước khi chạy cả bộ', () => {
    const s = src();
    expect(s, 'mỗi lượt tốn tiền thật của người chạy; phải đo được giá trước khi quyết')
      .toMatch(/GIA = flag\('gia'\)/);
    expect(s).toMatch(/ƯỚC CHI PHÍ CẢ BỘ/);
    expect(s, 'ước từ một lượt phải tự dán nhãn là ước').toMatch(/không phải số đo cả bộ/);
  });

  test('có `--luu` để phân biệt "skill mỏng" với "bộ chấm khắt khe"', () => {
    expect(src(), 'không lưu câu trả lời thì một bài trượt không nói được vì sao')
      .toMatch(/LUU = co\('luu', null\)/);
  });
});

test.describe('@infra skills:practice — chỉ đọc MỘT skill', () => {
  test('thư mục làm bài KHÔNG chép `prompt_templates/`', () => {
    const s = src();
    /*
     * SOI THÂN HÀM `dungGoc`, KHÔNG soi cả file.
     *
     * Bản đầu của ca này cấm chuỗi `prompt_templates` ở MỌI nơi, nên nó đỏ vì chính câu chú thích giải
     * thích *vì sao* thư mục làm bài không có prompt phase. Một phép kiểm bắt oan đúng dòng viết ra để
     * giải thích nó thì người ta sẽ xoá dòng giải thích, không sửa theo nó.
     */
    const i = s.indexOf('function dungGoc(');
    expect(i, 'không tìm thấy hàm dựng thư mục làm bài').toBeGreaterThan(0);
    const than = s.slice(i, s.indexOf('\n}', i));
    expect(than, 'có prompt phase thì model lấy hướng dẫn từ đó, và phép đo không còn nói gì về SKILL')
      .not.toMatch(/prompt_templates/);
    expect(than, 'chỉ được chép đúng một skill vào .claude/skills/').toMatch(/\.claude', 'skills', bai\.skill/);
  });

  test('chặn công cụ sửa file và tìm web', () => {
    const s = src();
    for (const t of ['Edit', 'Write', 'WebFetch', 'WebSearch']) {
      expect(s, `${t} phải nằm trong danh sách chặn`).toContain(t);
    }
  });

  test('mỗi bài khai ĐÚNG MỘT skill và một hàm chấm bằng máy', () => {
    const s = src();
    const i = s.indexOf('const BAI = [');
    expect(i, 'không tìm thấy bộ bài').toBeGreaterThan(0);
    const khoi = s.slice(i, s.indexOf('\n];', i));
    expect(khoi).toMatch(/skill:\s*'/);
    expect(khoi, 'chấm bằng cách đọc rồi cảm thấy thì không phải một phép đo').toMatch(/cham\(traLoi\)/);
  });
});

test.describe('@infra skills:practice — đáp án bài 2 trỏ đúng dòng', () => {
  const DAP_AN = path.join(FIXTURE, 'spec_5_loi.dapan.json');
  const DE = path.join(FIXTURE, 'spec_5_loi.de.txt');

  /*
   * Mẫu nhận dạng từng lỗi, giữ RỜI khỏi file đáp án có chủ ý: nếu lấy chính `tu_khoa` của đáp án để
   * kiểm đáp án thì phép kiểm tautology — nó luôn đúng. Mẫu ở đây mô tả ĐOẠN MÃ, không mô tả nhãn.
   */
  const MAU: Record<string, RegExp[]> = {
    'L1-hard-sleep': [/waitForTimeout/],
    'L2-console-log': [/console\.log/],
    'L3-vacuous-count': [/toBeGreaterThan\(0\)/],
    'L4-tautology': [/expect\(ten\)\.toContain\(ten\)/],
    'L5-phu-thuoc-thu-tu': [/maLopDaTao = /, /fill\('#MaLop', maLopDaTao\)/, /btnXoaTatCa/],
  };

  test('file đề và đáp án đều có', () => {
    expect(fs.existsSync(DE), `thiếu ${path.relative(REPO, DE)}`).toBe(true);
    expect(fs.existsSync(DAP_AN), `thiếu ${path.relative(REPO, DAP_AN)}`).toBe(true);
  });

  test('đáp án có đúng 5 lỗi, mỗi lỗi có `dong` và `tu_khoa`', () => {
    const j = JSON.parse(fs.readFileSync(DAP_AN, 'utf8'));
    expect(j.loi.length, 'đề bài là "spec cài sẵn 5 lỗi"').toBe(5);
    for (const l of j.loi) {
      expect(l.dong.length, `${l.ma}: thiếu số dòng`).toBeGreaterThan(0);
      expect(l.tu_khoa.length, `${l.ma}: thiếu từ khoá`).toBeGreaterThan(0);
    }
  });

  test('mỗi số dòng trong đáp án TRỎ ĐÚNG đoạn mã của lỗi đó', () => {
    const ds = fs.readFileSync(DE, 'utf8').split(/\r?\n/);
    const j = JSON.parse(fs.readFileSync(DAP_AN, 'utf8'));
    const sai: string[] = [];
    for (const l of j.loi) {
      const res = MAU[l.ma];
      expect(res, `${l.ma}: spec này chưa có mẫu nhận dạng ⇒ ca RỖNG cho lỗi đó`).toBeTruthy();
      for (const n of l.dong) {
        const d = ds[n - 1];
        if (d === undefined || !res.some((re) => re.test(d))) sai.push(`${l.ma}→dòng ${n}`);
      }
    }
    expect(sai, `đáp án trỏ sai dòng: ${sai.join(', ')} — bài tập sẽ chấm model "sai dòng" trong khi model nêu đúng`)
      .toEqual([]);
  });

  test('và KHÔNG bỏ sót dòng nào mang lỗi', () => {
    const ds = fs.readFileSync(DE, 'utf8').split(/\r?\n/);
    const j = JSON.parse(fs.readFileSync(DAP_AN, 'utf8'));
    const sot: string[] = [];
    for (const [ma, res] of Object.entries(MAU)) {
      const thuc: number[] = [];
      ds.forEach((d, i) => { if (res.some((re) => re.test(d))) thuc.push(i + 1); });
      const khai = (j.loi.find((x: { ma: string }) => x.ma === ma) || {}).dong || [];
      for (const n of thuc) if (!khai.includes(n)) sot.push(`${ma}→dòng ${n}`);
    }
    expect(sot, `đề có lỗi ở dòng mà đáp án không khai: ${sot.join(', ')} — model nêu đúng dòng đó sẽ bị chấm sai`)
      .toEqual([]);
  });
});

test.describe('@infra skills:practice — đề bài KHÔNG được là một test chạy thật', () => {
  /*
   * ĐO ĐƯỢC 06/11/2026, và đây là lỗi nặng nhất của cả đợt v2.10.0 chứ không phải một dòng gate đỏ.
   *
   * Bản đầu của đề bài tên `spec_5_loi.spec.ts` và tự ghi trong chú thích rằng nó "KHÔNG được chạy".
   * Câu đó là một tiền đề SAI: `playwright.config` khai `testDir: './tests'`, nên `npx playwright test
   * --list` thu nó thành **4 test thật** — trong đó một test bấm `#btnXoaTatCa` và một `afterEach` bấm
   * tiếp cái đó sau MỖI test. Trên máy có profile ghim sẵn, cả bộ sẽ lái UAT và bấm "Xoá tất cả".
   *
   * Nên luật ở đây không phải "đừng đặt tên thế" mà là: KHÔNG file nào dưới `tests/fixtures/**` được
   * khớp `testMatch` của Playwright. Một chú thích "đừng chạy file này" không chặn được bộ chạy.
   */
  const FIX = path.join(REPO, 'tests', 'fixtures');
  const THU = /\.(test|spec)\.(js|ts|mjs|cjs|mts)$/;

  const bo = (d: string, ra: string[] = []): string[] => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) bo(p, ra);
      else if (THU.test(e.name)) ra.push(path.relative(REPO, p).replace(/\\/g, '/'));
    }
    return ra;
  };

  test('không file nào dưới `tests/fixtures/**` khớp `testMatch`', () => {
    expect(fs.existsSync(FIX), 'không có tests/fixtures ⇒ ca này RỖNG').toBe(true);
    expect(bo(FIX), 'file đề/fixture khớp testMatch sẽ bị chạy như test thật — đổi đuôi, đừng dựa vào chú thích')
      .toEqual([]);
  });

  test('ĐỐI CHỨNG: phép kiểm bắt được đúng cái tên đã gây ra lỗi', () => {
    expect(THU.test('spec_5_loi.spec.ts'), 'tên cũ phải bị bắt, nếu không ca trên rỗng').toBe(true);
    expect(THU.test('spec_5_loi.de.txt'), 'tên nay dùng phải KHÔNG bị bắt').toBe(false);
  });
});
