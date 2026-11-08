/*
 * `quickstart:numbers` — bảng số đo trong QUICKSTART.md phải do MÁY SINH.
 *
 * VÌ SAO CỬA NÀY RA ĐỜI, và nó là một con số chứ không phải một cảm giác: bảng đó là số DẪN XUẤT (số
 * file `git ls-files`, số spec `ci:scope` đếm) nhưng từng được giữ bằng TAY, nên nó trôi BA lần trong
 * một đợt phát hành — 919→920 · 920→928 · 928→929 — và lần nào cũng chỉ lộ ra sau 10 phút chạy cả bộ.
 *
 * `GATES.md`, `docs/RULE_COVERAGE.md` và trang thư viện đều đã có máy sinh. Bảng này là chỗ cuối cùng
 * còn chép tay, tức chỗ duy nhất còn trôi được.
 *
 * SPEC NÀY KHÔNG CHÉP LẠI PHÉP SO. Nó gác chính cửa: cửa phải ĐỎ trên một trang đã bị phá, phải XANH
 * trên trang đúng, phải TỰ SỬA được, và phải thoát 2 khi không đo được chứ không kết luận "khớp".
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts/qa/quickstart_numbers.js');
const QS = path.join(REPO, 'QUICKSTART.md');

const chay = (argv: string[] = []) => {
  const r = spawnSync(process.execPath, [CUA, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/**
 * Hai ca dưới cần CÂY GIT và lớp PROJECT. Gói phát hành không có cả hai, nên chúng phải `test.skip`
 * kèm lý do — KHÔNG đỏ.
 *
 * ĐÂY LÀ LẦN THỨ BA cùng một bài học trong repo này, và lần này là của tôi: `release-pipeline.spec.ts:275`
 * đã ghi sẵn *"spec hạ tầng mới phải chạy thử TRONG GÓI, không chỉ trong repo"*, tôi trích đúng câu đó vào
 * header của `quickstart_numbers.js` rồi KHÔNG áp cho spec. Lượt dry-run 42438958803 đỏ vì vậy: trong gói
 * cửa thoát 2 (đúng thiết kế — "không đo được"), spec lại đòi 0.
 *
 * Mọi điều kiện bỏ qua phải đứng TRƯỚC lần đọc đầu tiên.
 */
function boQuaNeuThieuCay() {
  test.skip(!fs.existsSync(path.join(REPO, '.agent/config/gitlab_strip.json')),
    'gói phát hành không mang gitlab_strip.json (lớp PROJECT) — không có mốc để so');
  const r = spawnSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  test.skip(r.status !== 0, 'không có .git (đang chạy trong gói phát hành) — không đếm được cây track');
}

test.describe.configure({ mode: 'serial' });

test.describe('@infra quickstart:numbers — số dẫn xuất phải do máy sinh', () => {
  test('cửa và trang đều có', () => {
    expect(fs.existsSync(CUA), 'thiếu scripts/qa/quickstart_numbers.js').toBe(true);
    expect(fs.existsSync(QS), 'thiếu QUICKSTART.md').toBe(true);
  });

  test('repo hiện tại: ĐẠT, và in ra con số nó đo được', () => {
    boQuaNeuThieuCay();
    const r = chay(['--check']);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải in số đo, nếu không người đọc không kiểm lại được').toMatch(/\d+ file track · \d+ spec/);
    expect(r.out).toMatch(/✓ ĐẠT/);
  });

  test('ĐỐI CHỨNG DƯƠNG: phá trang thì CHẶN, và `--write` sửa lại ĐÚNG TỪNG BYTE', () => {
    boQuaNeuThieuCay();
    /*
     * Phá trang THẬT rồi trả lại trong `finally`, cùng khuôn với phép phá "skill MỒ CÔI" ở
     * `gates.spec.ts`. Và phải nghiệm thu phần TRẢ LẠI: một phép phá làm bẩn file đã track rồi không
     * hoàn nguyên đúng từng byte chính là lỗi tôi vừa vá ở `skills-shim.spec.ts` hôm nay (nó ghi LF vào
     * 29 file CRLF, làm `full:suite` từ chối phán).
     */
    const goc = fs.readFileSync(QS);
    try {
      const pha = goc.toString('utf8').replace(/^\| file được track \|[^|]*\|[^|]*\|$/m, '| file được track | 777 | 777 |');
      expect(pha, 'phép phá RỖNG — không đổi được dòng nào').not.toBe(goc.toString('utf8'));
      fs.writeFileSync(QS, pha, 'utf8');

      const r = chay(['--check']);
      expect(r.code, `phá trang mà vẫn exit 0 ⇒ cửa rỗng — ${r.out}`).toBe(1);
      expect(r.out).toMatch(/LỆCH/);
      expect(r.out, 'phải nói rõ trang ghi gì và cây thật là gì').toMatch(/trang ghi 777 \/ 777, cây thật \d+ \/ \d+/);
      expect(r.out, 'và phải chỉ đúng lệnh sửa').toMatch(/npm run quickstart:numbers/);

      expect(chay(['--write']).code, 'ghi lại phải thành công').toBe(0);
      expect(fs.readFileSync(QS).equals(goc), '`--write` phải trả về ĐÚNG TỪNG BYTE, kể cả xuống dòng').toBe(true);
      expect(chay(['--check']).code, 'sau khi ghi lại phải sạch').toBe(0);
    } finally {
      fs.writeFileSync(QS, goc);
    }
    expect(fs.readFileSync(QS).equals(goc), 'trang phải nguyên như trước khi chạy spec này').toBe(true);
  });

  test('"không đo được" KHÔNG thành "khớp": thiếu mốc ⇒ exit 2', () => {
    /*
     * Gói phát hành cố ý KHÔNG mang `gitlab_strip.json` (lớp PROJECT). Cửa phải thoát 2 ở đó, không
     * thoát 0 — đúng chỗ `release-pipeline.spec.ts` từng đỏ oan trong gói, và cũng là luật nền của kit.
     */
    const src = fs.readFileSync(CUA, 'utf8');
    expect(src, 'thiếu mốc strip phải thoát 2').toMatch(/gitlab_strip\.json[\s\S]{0,200}thoat2|thoat2\([^)]*gitlab_strip/);
    expect(src, 'không có .git cũng phải thoát 2').toMatch(/git ls-files[\s\S]{0,400}thoat2/);
    expect(src, 'và phải nói rõ exit 2 KHÔNG đồng nghĩa với khớp').toMatch(/KHÔNG đồng nghĩa với "khớp"/);
  });

  test('số spec lấy từ `ci:scope`, KHÔNG tự đếm lại', () => {
    /*
     * Hai bên tự đếm theo cách riêng thì một ngày nào đó chúng lệch nhau, và cả hai đều tự tin. Neo vào
     * nguồn: cửa phải gọi `ci_scope_check.js` và đọc stdout của nó.
     */
    const src = fs.readFileSync(CUA, 'utf8');
    expect(src).toMatch(/ci_scope_check\.js/);
    expect(src, 'phải đọc số từ stdout của ci:scope, không tự glob cây tests/').toMatch(/spec được track/);
    expect(src, 'không được tự đếm spec bằng readdir').not.toMatch(/readdirSync[\s\S]{0,120}\.spec\./);
  });

  test('đã nối vào `static-check`, nếu không nó chỉ chạy khi có người nhớ', () => {
    const wf = fs.readFileSync(path.join(REPO, '.github/workflows/static-check.yml'), 'utf8');
    expect(wf, 'cửa không ở CI thì nó gác bằng sự tự giác').toMatch(/npm run quickstart:numbers:check/);
  });
});
