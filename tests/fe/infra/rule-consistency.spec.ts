/*
 * @infra rule:consistency — luật đổi ở MỘT chỗ, được nhắc lại ở hàng chục chỗ.
 *
 * VÌ SAO CÓ MÁY NÀY, bằng một phép đo chứ không phải một lo xa. Luật evidence đổi sang mức B ngày
 * 22/10/2026. Đo lại 28/10: 14 dòng ở 12 file vẫn dạy luật cũ, và nặng nhất là
 * `tests/fe/infra/manual-run-usability.spec.ts` — một máy gác đang CƯỠNG CHẾ luật cũ, nên sửa tài liệu
 * cho đúng luật hiện hành thì spec đỏ. Không chỉ tài liệu trôi: máy gác quay sang chống luật mới.
 *
 * Spec này canh ba thứ, và thứ ba mới là thứ giữ cho gate không thành đồ trang trí:
 *   1. gate CHẶN câu trái luật (đối chứng dương);
 *   2. gate THA câu nói đúng luật mới (đối chứng âm — chống báo oan);
 *   3. "không phán được" KHÔNG hoá thành "đạt": thiếu config, config hỏng, hoặc 0 mệnh đề ⇒ exit 2.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const RC = path.join(REPO, 'scripts/qa/rule_consistency.js');

/** Mệnh đề EVIDENCE-MUC-B rút gọn, đủ để chạy gate trên cây tạm. */
const CFG_MAU = {
  mien_tru: ['CHANGELOG.md', 'docs/v*/**'],
  menh_de: [
    {
      ma: 'EVIDENCE-MUC-B',
      ten: 'Độ sâu evidence theo mức B',
      canonical: { file: 'RULE_GLOBAL.md', muc: '§Evidence', tom_tat: '1 ảnh ở bước quyết định; case tầng bug thì từng step' },
      cam: {
        bat: '(MỌI|mỗi|từng)\\s+step',
        chi_khi_cung_dong_co: 'ảnh|evidence',
        tha_khi_cung_dong_co: 'bước\\s+quyết định|quyết định|tầng bug|product_bug|api_bug|status|trạng thái',
      },
      pham_vi: ['prompt_templates/**/*.md', 'docs/v*/**/*.md'],
    },
  ],
};

function chay(files: Record<string, string>, cfg: unknown = CFG_MAU) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rulecons-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
  }
  if (cfg !== null) {
    fs.mkdirSync(path.join(d, '.agent/config'), { recursive: true });
    fs.writeFileSync(
      path.join(d, '.agent/config/rule_consistency.json'),
      typeof cfg === 'string' ? cfg : JSON.stringify(cfg, null, 2),
      'utf8',
    );
  }
  const r = spawnSync(process.execPath, [RC, '--repo', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

test.describe('@infra rule:consistency — bắt được câu trái luật, và không bắt oan', () => {
  test('ĐỐI CHỨNG DƯƠNG: câu "ảnh mỗi step" trần ⇒ CHẶN, và chỉ đúng chỗ', () => {
    const r = chay({ 'prompt_templates/x.md': 'Evidence: mỗi step phải có 1 ảnh riêng.\n' });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('prompt_templates/x.md:1');
    expect(r.out, 'phải in câu canonical để người sửa biết sửa thành gì').toContain('bước quyết định');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: câu nói ĐÚNG luật mới ⇒ THA', () => {
    /* Không có vế này thì gate chỉ cần cấm sạch chữ "step" là "đạt" — một gate như vậy vô dụng. */
    const r = chay({
      'prompt_templates/x.md':
        'Evidence: 1 ảnh ở bước quyết định; case tầng bug thì ảnh từng step.\n'
        + 'Mọi step vẫn phải có status riêng.\n',
    });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('ĐẠT');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('NGOÀI phạm vi thì không soi — `pham_vi` phải có tác dụng', () => {
    const r = chay({ 'khong-trong-pham-vi/x.md': 'mỗi step phải có 1 ảnh riêng.\n' });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('vùng LỊCH SỬ được quyền nhắc câu cũ', () => {
    // Chặn lịch sử là bắt lịch sử nói dối. Thư mục `docs/v<bản>/` kể lại luật từng như thế nào.
    // (Dùng chú thích một dòng: glob `docs/v` + sao + gạch chéo sẽ ĐÓNG khối chú thích sớm.)
    const r = chay({ 'docs/v2.9.4/NOTE.md': 'Luật cũ đòi mỗi step một ảnh riêng.\n' });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra rule:consistency — "không phán được" KHÔNG thành "đạt"', () => {
  test('thiếu config ⇒ exit 2, không phải 0', () => {
    const r = chay({ 'prompt_templates/x.md': 'mỗi step một ảnh\n' }, null);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('config hỏng ⇒ exit 2', () => {
    const r = chay({ 'prompt_templates/x.md': 'mỗi step một ảnh\n' }, '{ day khong phai json }');
    expect(r.code, r.out).toBe(2);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('config 0 mệnh đề ⇒ exit 2 — gác rỗng không phải đạt', () => {
    /*
     * Đây là lớp lỗi `strip.every()` trên mảng rỗng trả TRUE đã ghi ở `release-pipeline.spec.ts`:
     * danh sách rỗng làm mọi phép kiểm thành đúng, và gate báo xanh trên 0 phép đo.
     */
    const r = chay({ 'prompt_templates/x.md': 'mỗi step một ảnh\n' }, { mien_tru: [], menh_de: [] });
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('gác rỗng');
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra rule:consistency — miễn trừ theo dòng phải có lý do', () => {
  const cfgVoiMienTru = (ly_do: string) => ({
    ...CFG_MAU,
    mien_tru_dong: [{ file: 'prompt_templates/x.md', chua: 'mỗi step một ảnh', ly_do }],
  });

  test('miễn trừ CÓ lý do đủ dài ⇒ tha dòng đó', () => {
    const r = chay(
      { 'prompt_templates/x.md': 'Ghi chú lịch sử: mỗi step một ảnh là luật trước 22/10.\n' },
      cfgVoiMienTru('Lịch sử trong tài liệu — kể lại luật cũ để người đọc hiểu vì sao đổi.'),
    );
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('miễn trừ KHÔNG có lý do ⇒ bị bỏ qua, dòng vẫn bị CHẶN', () => {
    /* Một miễn trừ không giải thích được là một lần nới luật, không phải một ngoại lệ. */
    const r = chay({ 'prompt_templates/x.md': 'Ghi chú: mỗi step một ảnh.\n' }, cfgVoiMienTru('vì thế'));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('thiếu file/chua/ly_do');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('miễn trừ KHÔNG còn khớp gì ⇒ báo là rác', () => {
    /*
     * Mục miễn trừ chết che một dòng đã biến mất. Lần sau ai viết lại đúng câu đó thì tưởng vẫn được
     * miễn — mà thực ra mục kia đang trỏ vào hư không.
     */
    const r = chay(
      { 'prompt_templates/x.md': 'Evidence 1 ảnh ở bước quyết định.\n' },
      cfgVoiMienTru('Lịch sử trong tài liệu — kể lại luật cũ để người đọc hiểu vì sao đổi.'),
    );
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('KHÔNG còn khớp gì');
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra rule:consistency — nối vào kit, không mồ côi', () => {
  test('có npm script, và repo THẬT ở HEAD phải ĐẠT', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    expect(pkg.scripts['rule:consistency'], 'chưa đăng ký npm script').toBeTruthy();
    const r = spawnSync(process.execPath, [RC], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  });

  test('config khai rõ GIỚI HẠN — gate dò câu, không hiểu nghĩa', () => {
    /*
     * Gate này dễ bị đọc thành "đã nhất quán". Nó chỉ canh mệnh đề ĐÃ KHAI. Khai sót thì nó im, và im
     * không phải bằng chứng. Giới hạn đó phải nằm trong config, không chỉ trong đầu người viết.
     */
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/rule_consistency.json'), 'utf8'));
    expect(String(cfg._gioi_han || ''), 'config phải khai giới hạn').toMatch(/dò câu|không hiểu nghĩa/i);
    expect(String(cfg._why || '').length, 'config phải khai VÌ SAO có nó, kèm số đo').toBeGreaterThan(80);
    for (const m of cfg.mien_tru_dong || []) {
      expect(String(m.ly_do || '').length, `mien_tru_dong ${m.file} thiếu lý do`).toBeGreaterThan(20);
    }
  });
});

/*
 * Mệnh đề EXPECTED-CO-MAY (v2.9.6 N5).
 *
 * VÌ SAO THÊM. Hai bề mặt của kit nói NGƯỢC NHAU về cùng một luật suốt hơn hai tuần:
 *   · `.agent/config/GATES.md` khai `expected:check` là cửa **CHẶN** (đúng — `expected_ledger.js` có từ
 *     12/10/2026);
 *   · `.agent/skills/phase2/automation_reviewer/SKILL.md` khai **"không máy nào** so expected với bản
 *     trước", và đề xuất dựng gate bằng `git diff` — **sai cả hai vế**, vì `git diff` là đường cụt đã đo
 *     (0 file testcase được git track, `outputs/*` gitignore).
 *
 * Mệnh đề mới còn lôi ra **hai chỗ nữa** mà tôi chưa biết: `scripts/qa/automation_review.js` (khai sai ở
 * thời hiện tại) và chính header của `scripts/qa/expected_ledger.js` (kể lịch sử 11/10 nhưng viết ở thời
 * hiện tại nên bị đọc như trạng thái hôm nay). Cả hai đã sửa LỜI, không miễn trừ.
 */
test.describe('@infra rule:consistency — mệnh đề EXPECTED-CO-MAY', () => {
  const CFG_EXP = {
    mien_tru: [],
    menh_de: [
      JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/rule_consistency.json'), 'utf8'))
        .menh_de.find((m: { ma: string }) => m.ma === 'EXPECTED-CO-MAY'),
    ],
  };

  test('mệnh đề CÓ trong config thật, và có cả vế cấm lẫn vế tha', () => {
    /* Thiếu phép kiểm này thì ba ca dưới chạy trên một mệnh đề tôi tự dựng, không phải mệnh đề đang dùng. */
    const m = CFG_EXP.menh_de[0];
    expect(m, '`EXPECTED-CO-MAY` phải có trong `.agent/config/rule_consistency.json`').toBeTruthy();
    /* So CHUỖI, không so regex: mẫu trong config chính nó là một regex, nên bọc thêm một lớp regex nữa
     * rất dễ sai — và đã sai một lần ở ngay dòng này. */
    expect(m.cam.bat, 'phải cấm cách nói "không máy nào … expected"').toContain('m[áa]y');
    expect(m.cam.bat, 'và phải cấm cả vế đề xuất git diff').toContain('git');
    expect(String(m.cam.tha_khi_cung_dong_co || ''), 'phải THA câu nói đúng về git diff là đường cụt')
      .toContain('đường cụt');
    expect(String(m._vi_sao_can || '').length, 'mệnh đề phải ghi vì sao cần').toBeGreaterThan(80);
  });

  test('ĐỐI CHỨNG DƯƠNG: "không máy nào so expected với bản trước" ⇒ CHẶN', () => {
    const r = chay({ 'prompt_templates/x.md': 'Chỗ này không máy nào so expected với bản trước.\n' }, CFG_EXP);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('EXPECTED-CO-MAY');
    expect(r.out, 'phải nói ra câu canonical để người sửa biết viết gì').toMatch(/CÓ máy từ 12\/10\/2026/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: đề xuất dựng gate bằng `git diff` cho expected ⇒ CHẶN', () => {
    /* Đây là vế thứ hai, và là vế tốn kém hơn: nó đẩy người đọc đi dựng lại một đường đã đo là cụt. */
    const r = chay({ 'prompt_templates/x.md': 'Muốn gác thì cần một gate dựa trên git diff cho expected.\n' }, CFG_EXP);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('EXPECTED-CO-MAY');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: nói ĐÚNG rằng gate git-diff KHÔNG DỰNG ĐƯỢC ⇒ THA', () => {
    /*
     * Chiều này bắt buộc, và nó là lớp lỗi đã cắn BA LẦN trong phiên 30/10/2026: chính đoạn văn SỬA LỖI
     * lại chứa cụm từ bị cấm, nên nó tự chặn mình. Không có nhóm tha thì không ai viết nổi phần giải
     * thích — và lúc đó luật trở thành thứ không thể dạy.
     */
    const r = chay({
      'prompt_templates/x.md': 'Gate dựa trên `git diff` cho expected thì KHÔNG DỰNG ĐƯỢC: 0 file testcase được git track.\n',
    }, CFG_EXP);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: nhắc `expected` mà không khai sai ⇒ THA', () => {
    const r = chay({ 'prompt_templates/x.md': 'Chạy `npm run expected:check` sau khi chụp mốc.\n' }, CFG_EXP);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});
