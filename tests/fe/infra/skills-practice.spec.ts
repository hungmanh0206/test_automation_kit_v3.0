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
import { spawnSync } from 'child_process';
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

test.describe('@infra skills:practice — năm bài, và bộ chấm không được tự khen', () => {
  /*
   * Bốn bài thêm ở v2.10.0 chấm bằng LUẬT HÌNH THỨC (`hinh_thuc.dapan.json`) thay vì đáp án nội dung,
   * vì sản phẩm của chúng là một văn bản. Chỗ dễ hỏng nhất của kiểu chấm đó là TAUTOLOGY: nếu luật neo
   * vào TỪ VỰNG của skill thì model chỉ cần nhắc lại skill là đạt. Nên mỗi ca dưới đây gác một tính
   * chất làm bộ chấm còn là một phép đo.
   */
  const src = () => fs.readFileSync(CUA, 'utf8');
  const HT = () => JSON.parse(fs.readFileSync(path.join(FIXTURE, 'hinh_thuc.dapan.json'), 'utf8'));
  const KQ = () => JSON.parse(fs.readFileSync(path.join(FIXTURE, 'ket_qua.dapan.json'), 'utf8'));

  const MA_BAI = ['review-5-loi', 'doc-ket-qua', 'bug-than-backlog', 'du-lieu-run-id', 'dac-ta-ban-phan'];

  test('đủ 5 bài, mỗi bài một skill KHÁC nhau', () => {
    const s = src();
    const i = s.indexOf('const BAI = [');
    const khoi = s.slice(i, s.indexOf('\n];', i));
    for (const m of MA_BAI) expect(khoi, `thiếu bài ${m}`).toContain(`ma: '${m}'`);

    const skill = [...khoi.matchAll(/skill: '([a-z_]+)'/g)].map((x) => x[1]);
    expect(skill.length, 'mỗi bài phải khai đúng một skill').toBe(5);
    expect(new Set(skill).size, `hai bài cùng skill thì bài thứ hai không đo thêm gì: ${skill.join(', ')}`).toBe(5);
  });

  test('mọi skill được khai đều CÓ THẬT trong `.agent/skills/`', () => {
    const s = src();
    const i = s.indexOf('const BAI = [');
    const khoi = s.slice(i, s.indexOf('\n];', i));
    for (const m of [...khoi.matchAll(/skill: '([a-z_]+)'/g)].map((x) => x[1])) {
      const co = ['phase1', 'phase2', 'shared']
        .some((g) => fs.existsSync(path.join(REPO, '.agent/skills', g, m, 'SKILL.md')));
      expect(co, `${m}: không có skill này ⇒ bài đó sẽ KHÔNG PHÁN ĐƯỢC mãi mãi`).toBe(true);
    }
  });

  test('mọi fixture được khai đều CÓ THẬT', () => {
    const s = src();
    const i = s.indexOf('const BAI = [');
    const khoi = s.slice(i, s.indexOf('\n];', i));
    const tu = [...khoi.matchAll(/tu: '([^']+)'/g)].map((x) => x[1]);
    expect(tu.length, 'năm bài phải khai năm nguồn fixture').toBe(5);
    for (const t of tu) {
      expect(fs.existsSync(path.join(FIXTURE, t)), `fixture không tồn tại: ${t}`).toBe(true);
    }
  });

  test('`tep` chép được cả THƯ MỤC, vì bài `doc-ket-qua` cần hình dạng thư mục task', () => {
    const s = src();
    const i = s.indexOf('function dungGoc(');
    const than = s.slice(i, s.indexOf('\n}', i));
    expect(than, 'thiếu nhánh thư mục thì bài doc-ket-qua chép ra một file rỗng').toMatch(/isDirectory\(\)/);
    expect(than, 'fixture mất mà im lặng thì bài đó chấm trên thư mục trống').toMatch(/không tồn tại/);
  });

  test('ĐÁP ÁN TẦNG chỉ dùng tên tầng CÓ THẬT trong taxonomy', () => {
    const tax = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/verdict_taxonomy.json'), 'utf8'));
    const hop = Object.keys(tax.failureLayers);
    const da = KQ();
    expect(da.tang.length, 'đề bài có 5 ca FAIL').toBe(5);
    for (const m of da.tang) {
      expect(hop, `${m.tcId}: tầng "${m.tang}" không có trong verdict_taxonomy`).toContain(m.tang);
      expect(String(m.vi_sao).length, `${m.tcId}: thiếu lý do ⇒ đáp án thành lời khai`).toBeGreaterThan(40);
    }
    expect(new Set(da.tang.map((x: { tang: string }) => x.tang)).size,
      'năm ca trùng tầng thì bài này không phân biệt được gì').toBe(5);
  });

  test('ĐỀ BÀI KHÔNG MỚM ĐÁP ÁN: tên tầng không được xuất hiện trong thư mục đề', () => {
    /*
     * Lỗi đã suýt mắc: bản đầu của `phase2-execution.md` có hẳn một mục *"thứ lượt chạy này KHÔNG ghi"*
     * liệt kê sẵn điều model phải tự suy ra. Để vậy thì model chỉ cần chép, và bài này đo khả năng chép.
     */
    const goc = path.join(FIXTURE, 'ket_qua.de');
    const doc = (d: string): string => fs.readdirSync(d, { withFileTypes: true })
      .map((e) => (e.isDirectory() ? doc(path.join(d, e.name)) : fs.readFileSync(path.join(d, e.name), 'utf8')))
      .join('\n');
    const noi = doc(goc);
    for (const t of KQ().tang.map((x: { tang: string }) => x.tang)) {
      expect(noi, `đề bài chứa chữ "${t}" ⇒ model chỉ cần chép`).not.toContain(t);
    }
    for (const id of KQ().thieu_evidence.tcId) {
      expect(noi.includes(id), `${id} phải CÓ trong đề (để suy ra được), nhưng đề không được nói nó thiếu ảnh`).toBe(true);
    }
    expect(noi, 'đề không được tự kết luận về bước quyết định').not.toMatch(/bước quyết định/i);
  });

  test('LUẬT HÌNH THỨC neo vào NỘI DUNG đề, không neo vào từ vựng skill', () => {
    const ht = HT();
    for (const ten of ['bug-than-backlog', 'du-lieu-run-id', 'dac-ta-ban-phan']) {
      const c = ht[ten];
      expect(c, `hinh_thuc.dapan.json thiếu mục ${ten}`).toBeTruthy();
      expect(c.kiem.length, `${ten}: phải có 5 phép kiểm`).toBe(5);
      expect(c.nguong, `${ten}: ngưỡng phải < số phép kiểm, nếu không một lượt lệch là trượt cả bài`)
        .toBeLessThan(c.kiem.length);
      for (const k of c.kiem) {
        expect(String(k.vi_sao).length, `${ten}/${k.ma}: thiếu vì sao`).toBeGreaterThan(25);
      }
    }
    expect(JSON.stringify(ht), 'phải khai thẳng giới hạn: đây KHÔNG phải "qua được gate"')
      .toMatch(/KHÔNG phải/);
  });

  test('`gom` CHẶN khi số phép kiểm lệch khỏi đáp án', () => {
    /*
     * Chỗ trôi im lặng điển hình: thêm một phép kiểm vào mã mà quên khai trong đáp án, rồi ngưỡng 4
     * trên 6 phép kiểm thành dễ hơn 4 trên 5 — bài tự nới ra mà không ai thấy trong diff.
     */
    const s = src();
    const i = s.indexOf('function gom(');
    expect(i, 'không tìm thấy hàm gom').toBeGreaterThan(0);
    const than = s.slice(i, s.indexOf('\n}', i));
    expect(than, 'phải so số phép kiểm với đáp án').toMatch(/cfg\.kiem\.length !== ket\.length/);
    expect(than, 'và phải NÉM, không phải cảnh báo').toMatch(/throw new Error/);
  });

  test('bài `doc-ket-qua` đọc tầng ĐẦU TIÊN trong cửa sổ, không phải "có chứa"', () => {
    const s = src();
    const i = s.indexOf("ma: 'doc-ket-qua'");
    const than = s.slice(i, s.indexOf("ma: 'bug-than-backlog'", i));
    expect(than, 'phải sắp theo vị trí rồi lấy cái đầu tiên').toMatch(/sort\(\(a, b\) => a\.at - b\.at\)/);
    expect(than, '"có chứa" thì model liệt kê cả 8 tầng cho mọi ca là đạt').toMatch(/thay\[0\]\.x === m\.tang/);
    expect(KQ()._luat_doc, 'luật đọc phải viết TRƯỚC khi đo, và ghi lại').toMatch(/TRƯỚC khi chạy/);
  });
});

test.describe('@infra skills:practice — fixture phải TRACK được, không chỉ có trên đĩa', () => {
  /*
   * LỖI THẬT, bắt được 07/11/2026 lúc stage: thư mục đề `ket_qua.de/` mang tên thư mục của một lượt
   * chạy THẬT — `reports/` và `test-results/` — và `.gitignore` chặn đúng hai tên đó (dòng `Reports/`,
   * `test-results/`), cộng `*.log` chặn `run.log`. Ba file đề sống trên đĩa của tôi và KHÔNG vào repo.
   *
   * Phép kiểm "fixture có tồn tại" KHÔNG bắt được chuyện này: trên máy người viết thì nó tồn tại. Chỉ
   * người clone mới thấy, và họ thấy dưới dạng một bài KHÔNG PHÁN ĐƯỢC mãi mãi.
   *
   * Không đổi tên thư mục để lách: `run_report_reader` dạy *"artifact nào trả lời được câu gì"*, nên
   * tên thư mục thật là phần đang được đo. Vá bằng phủ định tường minh trong `.gitignore`.
   */
  test('mọi file fixture mà bộ bài khai đều được git track', () => {
    const r = spawnSync('git', ['ls-files', 'tests/fixtures/practice'], { cwd: REPO, encoding: 'utf8' });
    test.skip(r.status !== 0, 'không phải repo git ⇒ không phán được');
    const track = new Set(String(r.stdout).split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
    expect(track.size, 'không file nào được track ⇒ ca này RỖNG').toBeGreaterThan(3);

    const s = fs.readFileSync(CUA, 'utf8');
    const i = s.indexOf('const BAI = [');
    const khoi = s.slice(i, s.indexOf('\n];', i));
    const tu = [...khoi.matchAll(/tu: '([^']+)'/g)].map((x) => x[1]);
    expect(tu.length, 'năm bài phải khai năm nguồn fixture').toBe(5);

    const thieu: string[] = [];
    const duyet = (rel: string) => {
      const abs = path.join(FIXTURE, rel);
      if (!fs.existsSync(abs)) { thieu.push(`${rel} (không có trên đĩa)`); return; }
      if (fs.statSync(abs).isDirectory()) {
        for (const e of fs.readdirSync(abs)) duyet(path.join(rel, e).replace(/\\/g, '/'));
        return;
      }
      const key = `tests/fixtures/practice/${rel.replace(/\\/g, '/')}`;
      if (!track.has(key)) thieu.push(key);
    };
    tu.forEach((x) => duyet(x));

    expect(thieu, 'file đề KHÔNG track thì người clone không có nó, và bài đó KHÔNG PHÁN ĐƯỢC mãi mãi'
      + ` — vá bằng phủ định trong .gitignore, đừng đổi tên thư mục để lách: ${thieu.join(', ')}`)
      .toEqual([]);
  });

  test('và cả đáp án cũng phải track', () => {
    const r = spawnSync('git', ['ls-files', 'tests/fixtures/practice'], { cwd: REPO, encoding: 'utf8' });
    test.skip(r.status !== 0, 'không phải repo git');
    const track = new Set(String(r.stdout).split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
    for (const f of ['spec_5_loi.dapan.json', 'ket_qua.dapan.json', 'hinh_thuc.dapan.json']) {
      expect(track.has(`tests/fixtures/practice/${f}`), `${f}: đáp án không track ⇒ bộ chấm vỡ ở bản clone`).toBe(true);
    }
  });
});
