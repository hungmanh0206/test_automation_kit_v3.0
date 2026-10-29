import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';
import { docSach } from './_doc_sach';

/*
 * Skill `tc_design_guide` (v2.9.0) + cửa `skills:refcheck`.
 *
 * Phần đáng khoá nhất không phải "skill tồn tại", mà là HAI điều kiện làm nó khác kit A:
 *   · phần LUÔN-NẠP nhỏ (A nhồi ~16k vào một file), phần dày nằm ở `references/`;
 *   · bảng "điểm dạy → máy kiểm" chỉ nêu máy CÓ THẬT, và chỗ nào chưa có máy thì NÓI THẲNG.
 *
 * Và cửa refcheck phải phân biệt link thật với đường dẫn minh hoạ — nếu không nó tái tạo đúng dương
 * tính giả đã làm kit A bị đếm là "5 link chết" (đo 14/10/2026: cả 5 là ví dụ, A có 0 link gãy thật).
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const SKILL = path.join(REPO, '.agent/skills/phase1/tc_design_guide');
/*
 * CHUẨN HOÁ CRLF ngay ở cửa đọc — cửa thứ SÁU cùng lớp lỗi của kit, sau `library_drift`, `build.js`,
 * `course_parse.js`, `course_maturity.js` và `slash-commands.spec.ts` (xem ghi chú ở file đó).
 *
 * Đo 15/10/2026: test "thiếu frontmatter" ĐỎ trong `full:suite` dù không ai sửa skill. Trong git file
 * là `---\n`, trên đĩa là `---\r\n` vì `core.autocrlf=true`, và `git status` vẫn sạch vì git chuẩn hoá
 * lúc commit. Nên một assertion ghim đúng byte LF trên file trong CÂY LÀM VIỆC chỉ xanh khi lần
 * checkout gần nhất tình cờ cho LF: CI Linux xanh, Windows checkout mới thì đỏ. Kết quả phụ thuộc
 * môi trường checkout thì "xanh" hết nghĩa.
 *
 * Chuẩn hoá ở cửa đọc chứ không nới assertion: test vẫn đòi file MỞ ĐẦU bằng dấu frontmatter. Và nó
 * sửa luôn phép đếm token — CRLF làm `s.length` phồng lên một byte mỗi dòng, tức trần 2.500 đang được
 * đo trên một con số không phải nội dung thật.
 */
const doc = (p: string) => docSach(path.join(SKILL, p));
const tok = (s: string) => Math.round(s.length / 3.6);

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const rc = require(path.join(REPO, 'scripts/qa/skills_refcheck.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

test.describe('@infra tc_design_guide — phần luôn-nạp phải NHỎ', () => {
  test('`SKILL.md` có frontmatter hợp lệ và ≤ 2.500 token', () => {
    const s = doc('SKILL.md');
    expect(s.startsWith('---\n'), 'thiếu frontmatter').toBe(true);
    expect(s).toMatch(/\nname: tc_design_guide\n/);
    const d = s.match(/\ndescription: (.+)\n/);
    expect(d, 'thiếu description').toBeTruthy();
    expect(String(d![1]).trim().length, 'description rỗng thì skill không bao giờ được chọn').toBeGreaterThan(40);

    /*
     * Trần 2.500. A nhồi `rbt-manual-testing` ~16.200 token vào MỘT file 937 dòng, và đó là tật chính
     * phải không mang theo: phần luôn-nạp càng to thì càng ít lượt nào thật sự đọc hết.
     */
    expect(tok(s), 'SKILL.md vượt trần — đẩy phần dày xuống `references/`, đừng nới trần').toBeLessThanOrEqual(2500);
  });

  test('phần dày nằm ở `references/`, không nằm trong phần luôn-nạp', () => {
    const refs = fs.readdirSync(path.join(SKILL, 'references')).filter((f) => f.endsWith('.md'));
    expect(refs.length, 'phải có file references').toBeGreaterThanOrEqual(4);
    const tongRef = refs.reduce((n, f) => n + tok(doc(path.join('references', f))), 0);
    /* Điều kiện "giàu hơn A mà không phình": tổng nội dung lớn, phần luôn-nạp nhỏ. */
    expect(tongRef, 'references phải mang phần lớn nội dung').toBeGreaterThan(tok(doc('SKILL.md')) * 2);
  });
});

test.describe('@infra tc_design_guide — nội dung phải đo được', () => {
  test('bảng "điểm dạy → máy kiểm" chỉ nêu máy CÓ THẬT', () => {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const pkg = require(path.join(REPO, 'package.json'));
    /* eslint-enable @typescript-eslint/no-var-requires, global-require */
    const s = doc('SKILL.md') + doc('references/techniques.md') + doc('references/anti_patterns.md')
      + doc('references/component_checklist.md') + doc('references/field_checklist.md');

    const goi = [...s.matchAll(/`npm run ([a-z0-9:_-]+)`/g)].map((m) => m[1]);
    expect(goi.length, 'skill phải trỏ tới máy thật, không dạy chay').toBeGreaterThan(8);
    const thieu = [...new Set(goi)].filter((g) => !pkg.scripts[g]);
    /*
     * Bịa một tên máy là điều kiện DỪNG của đợt này: bảng chỉ có giá trị khi người đọc kiểm lại được
     * từng dòng, và một tên sai làm hỏng cả bảng chứ không chỉ một dòng.
     */
    expect(thieu, `skill nhắc npm script KHÔNG tồn tại: ${thieu.join(', ')}`).toEqual([]);
  });

  test('chỗ CHƯA có máy phải nói thẳng, không bỏ trống cũng không bịa', () => {
    const s = doc('SKILL.md');
    expect(s, 'phải có ít nhất một dòng ghi rõ chưa có máy').toMatch(/chưa có máy/i);
    expect(s).toMatch(/review tay/i);
  });

  test('dạy quan sát ≠ oracle, và KHÔNG có câu kiểu "ảnh thắng tài liệu"', () => {
    const s = doc('SKILL.md') + doc('references/anti_patterns.md');
    expect(s, 'phải dạy quan sát không phải oracle').toMatch(/observed|quan sát/i);
    expect(s).toMatch(/Ambiguity Gate/);
    /*
     * Kit A có mục tiêu đề "Xung đột giữa tài liệu và ảnh → ảnh thắng". Thân mục của A thật ra nói
     * "KHÔNG tự chọn bên nào", nhưng nó vẫn bảo VIẾT TC theo những gì ảnh cho thấy — tức quan sát trở
     * thành kỳ vọng đã viết. Đó là chỗ B khác, và test này chặn câu đó quay lại.
     */
    expect(/ảnh\s*(thắng|ưu tiên)|hình\s*thắng/i.test(s), 'không được dạy "ảnh thắng tài liệu"').toBe(false);
  });

  test('phủ rộng hơn A: có pairwise và classification tree, và hai mã có trong config', () => {
    const t = doc('references/techniques.md');
    expect(t).toMatch(/Pairwise/i);
    expect(t).toMatch(/Classification Tree/i);

    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const dt = require(path.join(REPO, '.agent/config/design_techniques.json'));
    const m = require(path.join(REPO, 'scripts/lib/testcase/model.js'));
    /* eslint-enable @typescript-eslint/no-var-requires, global-require */
    const ma = dt.techniques.map((x: { code: string }) => x.code);
    expect(ma, 'thiếu mã thì case gắn tag xong KHÔNG máy nào thấy').toContain('PW');
    expect(ma).toContain('CT');

    /* ĐỐI CHỨNG: `CT` là chuỗi con của `sideeffect`/`impact` — khớp phải CHÍNH XÁC, không `includes`. */
    expect(m.techniquesOf('', '[SideEffect] abc'), '`CT` không được khớp nhầm trong `sideeffect`').toEqual([]);
    expect(m.techniquesOf('', '[Impact] abc')).toEqual([]);
    expect(m.techniquesOf('', '[CT] abc')).toEqual(['CT']);
  });

  test('KHÔNG dạy locator và KHÔNG đặt luật evidence mới', () => {
    const s = doc('SKILL.md');
    expect(/data-testid|getByRole|css selector|xpath/i.test(s), 'locator thuộc `locator_strategy`').toBe(false);
    /* Được phép TRỎ tới luật evidence, nhưng không được đặt luật mới. */
    expect(/chụp (ảnh|màn).{0,30}(mọi|khi fail)/i.test(s), 'đừng đặt luật evidence thứ hai').toBe(false);
  });
});

test.describe('@infra skills:refcheck — link thật vs đường dẫn minh hoạ', () => {
  test('bộ skill của repo: 0 link gãy', () => {
    const ds = rc.quet(path.join(REPO, '.agent/skills'));
    const gay = ds.filter((x: { minhHoa: string | null; ton_tai: boolean }) => !x.minhHoa && !x.ton_tai);
    expect(gay, 'link trong skill phải trỏ file có thật').toEqual([]);
  });

  test('ĐỐI CHỨNG DƯƠNG: link thật gãy ⇒ bị bắt', () => {
    const tmp = thuMucTam('ref-gay');
    try {
      fs.mkdirSync(path.join(tmp, 'x'));
      fs.writeFileSync(path.join(tmp, 'x/SKILL.md'), '---\nname: x\n---\n\nXem [bảng](references/khong-co.md).\n');
      const ds = rc.quet(tmp);
      const gay = ds.filter((d: { minhHoa: string | null; ton_tai: boolean }) => !d.minhHoa && !d.ton_tai);
      expect(gay.length, 'một link thật trỏ file không có phải bị bắt').toBe(1);
    } finally { donThuMucTam(tmp); }
  });

  test('ĐỐI CHỨNG ÂM: ba dạng đường dẫn minh hoạ KHÔNG bị bắt', () => {
    /*
     * Ba dạng này lấy từ CHÍNH kit A — chúng là ví dụ thật, không phải ca bịa cho vừa luật. Đếm ngây
     * thơ gắn cờ cả ba, và đó là cách con số "A có 5 link chết" ra đời.
     */
    const tmp = thuMucTam('ref-vidu');
    try {
      fs.mkdirSync(path.join(tmp, 'x'));
      fs.writeFileSync(path.join(tmp, 'x/SKILL.md'), [
        '---', 'name: x', '---', '',
        'Đọc [yêu cầu](../../requirements/<module>/requirements_<module>.md).',
        '',
        '| File | Vai trò |',
        '|---|---|',
        '| [report](execution_report.md) | file đầu ra của lượt chạy |',
        '',
        '```markdown',
        'docs/testcases/customers/[parts/part_01.md](parts/part_01.md)',
        '```',
        '',
      ].join('\n'));
      const ds = rc.quet(tmp);
      const gay = ds.filter((d: { minhHoa: string | null; ton_tai: boolean }) => !d.minhHoa && !d.ton_tai);
      expect(gay, 'đường dẫn minh hoạ KHÔNG phải link gãy — gắn cờ chúng là ép người ta gỡ ví dụ đi').toEqual([]);
    } finally { donThuMucTam(tmp); }
  });

  test('ĐỐI CHỨNG: luật "đứng sau chữ VD" đã BỎ — link thật không bị xếp nhầm thành ví dụ', () => {
    /*
     * Luật đó từng bỏ qua 3 link tới `CODE_TEMPLATES.md` của kit A — một file CÓ THẬT. Một luật bỏ qua
     * được link thật thì nó nuốt luôn link gãy thật.
     */
    const tmp = thuMucTam('ref-vd');
    try {
      fs.mkdirSync(path.join(tmp, 'x'));
      fs.writeFileSync(path.join(tmp, 'x/SKILL.md'), '---\nname: x\n---\n\nVD: xem [mẫu](references/khong-co.md).\n');
      const ds = rc.quet(tmp);
      const gay = ds.filter((d: { minhHoa: string | null; ton_tai: boolean }) => !d.minhHoa && !d.ton_tai);
      expect(gay.length, 'chữ "VD" đứng trước KHÔNG được biến một link gãy thành hợp lệ').toBe(1);
    } finally { donThuMucTam(tmp); }
  });
});

/*
 * DANH MỤC CANONICAL ⇄ CHECKLIST CON NGƯỜI ĐỌC (v2.9.5 §3.3).
 *
 * `.agent/config/ui_components.json` là nguồn duy nhất của hai danh mục field/component, và
 * `field-component-checklist.spec.ts` đã khoá nó với các file CHIỀU (`prompt_templates/phase1/dimensions/`).
 * Nhưng hai checklist của skill `tc_design_guide` thì KHÔNG ai đối soát — và chúng đã lệch thật:
 *
 *   đo 29/10/2026 · `field_checklist.md` khai "18 loại" đúng bằng con số của danh mục canonical, nhưng
 *   18 của nó là 18 KHÁC: thiếu `password`, `date_month_filter`, `otp`, `richtext`, `multiselect`,
 *   `slider`; bù lại có 4 dòng mịn hơn (tiếng Việt có dấu, cascade, mã định danh, ô tự tính).
 *   `component_checklist.md` thiếu `crud`, `permission`, `status_flow`, `tab` — tức thiếu đúng ba nhóm
 *   nặng nhất: vòng đời CRUD, ma trận phân quyền và bảng trạng thái.
 *
 * Hai con số 18 bằng nhau là chỗ nguy hiểm nhất: nó làm người đọc tin hai bên đã khớp.
 *
 * Nên checklist phải mang MÃ canonical, không chỉ tên tiếng Việt — tên thì hai bên đặt khác nhau là
 * chuyện bình thường, còn mã thì đối soát được. Mã nào chưa gặp trên app thì khai ở bảng "chưa gặp"
 * KÈM NGÀY ĐO; đó vẫn là một lời khai, khác hẳn im lặng.
 */
test.describe('@infra checklist của skill ⇄ danh mục canonical', () => {
  /* eslint-disable @typescript-eslint/no-var-requires, global-require */
  const UIC = require(path.join(REPO, '.agent/config/ui_components.json'));
  /* eslint-enable @typescript-eslint/no-var-requires, global-require */

  /** Mã trong cột `Mã` của bảng field, cộng mã khai ở bảng "chưa gặp". */
  const maField = (s: string) => new Set([
    ...[...s.matchAll(/^\| *\d+ *\| *`([a-z_]+)` *\|/gm)].map((m) => m[1]),
    ...[...s.matchAll(/^\| *`([a-z_]+)` *\| *\*\*chưa gặp\*\*/gm)].map((m) => m[1]),
  ]);

  /** Mã gắn trên tiêu đề mục của checklist component. */
  const maComponent = (s: string) => new Set(
    [...s.matchAll(/^## .*?— `([a-z_]+)`/gm)].map((m) => m[1]),
  );

  /** Mã canonical nào KHÔNG có mặt trong checklist. Tách ra để chạy được đối chứng dương. */
  const thieu = (canon: string[], co: Set<string>) => canon.filter((c) => !co.has(c));

  test('mọi mã `field_types` đều có dòng checklist, hoặc khai "chưa gặp" kèm ngày', () => {
    const s = doc('references/field_checklist.md');
    const co = maField(s);
    /*
     * CHỐNG RỖNG. Đổi hình bảng (bỏ cột `Mã`, đổi dấu nháy) làm regex trượt sạch, và lúc đó phép kiểm
     * vẫn XANH vì `thieu` so với một tập rỗng... không, nó sẽ đỏ. Nhưng chiều ngược thì im: nếu ai đó
     * đổi `maField` thành bắt mọi chuỗi trong nháy ngược thì tập `co` phình ra và phép kiểm mất nghĩa.
     * Nên ghim luôn ĐỘ LỚN hợp lý của tập mã đọc được.
     */
    expect(co.size, 'không đọc được mã nào — bảng đã đổi hình, sửa regex chứ đừng bỏ phép kiểm')
      .toBeGreaterThanOrEqual(10);
    expect(co.size, 'đọc ra quá nhiều mã — regex đang bắt cả thứ không phải mã').toBeLessThanOrEqual(UIC.field_types.length);

    const canon = UIC.field_types.map((f: { code: string }) => f.code);
    const t = thieu(canon, co);
    expect(t, `mã canonical KHÔNG có trong field_checklist.md: ${t.join(', ')} — viết dòng checklist, `
      + 'hoặc khai ở bảng "chưa gặp" kèm ngày đo').toEqual([]);
  });

  test('mọi mã `components` đều có một mục trong component_checklist.md', () => {
    const s = doc('references/component_checklist.md');
    const co = maComponent(s);
    expect(co.size, 'không đọc được mã nào trên tiêu đề mục — sửa regex chứ đừng bỏ phép kiểm')
      .toBeGreaterThanOrEqual(5);

    const canon = UIC.components.map((c: { code: string }) => c.code);
    const t = thieu(canon, co);
    expect(t, `mã canonical KHÔNG có mục trong component_checklist.md: ${t.join(', ')}`).toEqual([]);
  });

  test('ĐỐI CHỨNG DƯƠNG: thêm một mã vào danh mục canonical ⇒ phép kiểm ĐỎ', () => {
    /*
     * Đây là phép kiểm của chính phép kiểm. Không có nó thì một `thieu()` luôn trả `[]` (ví dụ vì so
     * sai chiều) sẽ xanh mãi, và hai bên lại trôi khỏi nhau đúng như đã trôi lần này.
     */
    const co = maField(doc('references/field_checklist.md'));
    expect(thieu(['mot_ma_khong_ton_tai'], co), 'mã không có trong checklist PHẢI bị báo thiếu')
      .toEqual(['mot_ma_khong_ton_tai']);
  });

  test('"chưa gặp" phải có NGÀY ĐO — lời khai không ngày thì không biết đã cũ bao nhiêu', () => {
    const s = doc('references/field_checklist.md');
    /*
     * Chỉ soi DÒNG BẢNG, không soi văn xuôi. Bản đầu bắt mọi dòng có chữ "chưa gặp", nên nó đỏ vì đúng
     * cái đoạn giải thích *cách dùng* bảng — một dương tính giả, và kiểu dương tính giả hay dẫn tới
     * chuyện tệ hơn: người ta gỡ đoạn giải thích đi cho hết đỏ.
     */
    const dong = s.split('\n').filter((l) => l.startsWith('| `') && /\*\*chưa gặp\*\*/.test(l));
    expect(dong.length, 'không còn dòng "chưa gặp" nào thì bỏ cả phép kiểm này đi').toBeGreaterThan(0);
    for (const l of dong) {
      expect(l, `dòng "chưa gặp" thiếu ngày đo: ${l.slice(0, 60)}`).toMatch(/đo \d{2}\/\d{2}\/\d{4}/);
    }
  });
});
