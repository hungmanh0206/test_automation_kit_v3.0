import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/*
 * CHIỀU COVERAGE — mỗi chiều phải được khai ở ĐỦ BỐN CHỖ.
 *
 * `model.js` ghi bài học này ngay cạnh `DIMENSION_TAGS`: *"thêm ở đây MỚI có tác dụng — chiều mới mà quên
 * khai thì case gắn tag vẫn ra 0"*. Lời dặn đó đã được viết hai lần (§22 rồi §23) và vẫn hỏng lần thứ ba:
 * khi thêm §24/§25 (13/10/2026) tôi tìm ra bảng tag ở `02_gen_testcases.md` **dừng ở §17**, tức sáu chiều
 * có file và có gate đếm mà không có dòng nào ở bảng cho người đọc.
 *
 * Một lời dặn lặp ba lần mà vẫn hỏng thì vấn đề không phải người đọc — là nó chưa có máy. Đây là máy đó.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const DIR = path.join(REPO, 'prompt_templates', 'phase1', 'dimensions');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const model = require(path.join(REPO, 'scripts/lib/testcase/model.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

/** Đọc tag bắt buộc khai ngay dòng đầu mỗi file chiều: "> Tag bắt buộc … **`[Xxx]`**". */
function tagCuaFile(f: string): { sec: string; tag: string | null } {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const sec = `§${f.match(/^(\d+)_/)?.[1]?.replace(/^0/, '')}`;
  const m = src.match(/Tag bắt buộc[^\n]*?\[([A-Za-z0-9]+)\]/);
  return { sec, tag: m ? m[1].toLowerCase() : null };
}

test.describe('@infra chiều coverage — khai đủ BỐN chỗ, không ba', () => {
  const files = fs.readdirSync(DIR).filter((f) => /^\d+_.*\.md$/.test(f)).sort();

  test('mỗi file chiều khai TAG ngay đầu file', () => {
    expect(files.length, 'phải có file chiều để kiểm').toBeGreaterThan(15);
    for (const f of files) {
      const { tag } = tagCuaFile(f);
      expect(tag, `${f}: không đọc được "Tag bắt buộc … [Xxx]" ở đầu file`).toBeTruthy();
    }
  });

  test('tag của mọi chiều đều có trong `DIMENSION_TAGS` — nếu không, case gắn tag vẫn đếm 0', () => {
    for (const f of files) {
      const { tag } = tagCuaFile(f);
      if (!tag) continue;
      expect(model.DIMENSION_TAGS, `${f}: tag \`[${tag}]\` chưa khai trong DIMENSION_TAGS`).toContain(tag);
    }
  });

  test('`dimension_coverage` có mục cho mọi chiều, và `TAG_OF` trỏ đúng tag', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/dimension_coverage.js'), 'utf8');
    for (const f of files) {
      const { sec, tag } = tagCuaFile(f);
      if (!tag) continue;
      expect(src, `${f}: \`dimension_coverage\` không có dòng nào mang ${sec}`).toContain(`sec: '${sec}'`);
      expect(src, `${f}: \`TAG_OF\` thiếu ánh xạ tới '${tag}'`).toMatch(new RegExp(`: '${tag}'`));
    }
  });

  test('`load_map.json` khai mọi file chiều — nếu không, luồng nạp nó mà không ai khai điều kiện', () => {
    /*
     * Chỗ thứ NĂM, không phải bốn. Thiết kế v2.8.1 liệt kê bốn điểm nối; `load-map.spec.ts` bắt được chỗ
     * thứ năm ngay lượt chạy cả bộ đầu tiên của bước 4. Ghi vào đây để lần sau không phải phát hiện lại.
     */
    const src = fs.readFileSync(path.join(REPO, '.agent/config/load_map.json'), 'utf8');
    for (const f of files) {
      expect(src, `${f}: chưa khai trong load_map.json`).toContain(`dimensions/${f}`);
    }
  });

  test('`02_gen_testcases.md` có dòng ở CẢ bảng tag lẫn bảng điều hướng', () => {
    const src = fs.readFileSync(path.join(REPO, 'prompt_templates/phase1/02_gen_testcases.md'), 'utf8');
    for (const f of files) {
      const { sec, tag } = tagCuaFile(f);
      if (!tag) continue;
      /* Bảng điều hướng trỏ thẳng file — đây là đường người đọc mở được chương chiều. */
      expect(src, `${f}: bảng điều hướng không trỏ tới \`dimensions/${f}\``).toContain(`dimensions/${f}`);
      /*
       * CHỈ MỘT bảng. Bảng tag §0b riêng đã bị bỏ 13/10/2026: nó trùng hoàn toàn cột Tag của bảng điều
       * hướng, và đã trôi đúng kiểu bản sao-không-máy-canh (dừng ở §17 khi thư mục đã tới §23). Bảng điều
       * hướng phải mang CẢ tag lẫn đường dẫn, nếu không thì người đọc lại cần bảng thứ hai.
       */
      const oBangDieuHuong = new RegExp(`\|\s*${sec}\s*\|[^\n]*\`\[${tag}\]\`[^\n]*dimensions/${f}`, 'i');
      expect(oBangDieuHuong.test(src), `${f}: bảng điều hướng thiếu dòng ${sec} có cả tag \`[${tag}]\` lẫn file`).toBe(true);
    }
  });

  test('ĐỐI CHỨNG: số chiều ở tài liệu KHỚP số file — không để "15 chương" khi đã 22', () => {
    /*
     * Hai template run_* từng dạy "15 chương (§3–§17)" trong khi thư mục có 20 file tới §23. Con số trong
     * tài liệu là thứ duy nhất người đọc dùng để biết mình đã xem hết hay chưa.
     */
    for (const p of ['prompt_templates/run_phase1_template.md', 'prompt_templates/run_phase2_template.md']) {
      const src = fs.readFileSync(path.join(REPO, p), 'utf8');
      const so = [...src.matchAll(/(\d+) chương/g)].map((m) => Number(m[1]));
      for (const n of so) expect(n, `${p}: khai "${n} chương" nhưng thư mục có ${files.length} file chiều`).toBe(files.length);
    }
  });
});
