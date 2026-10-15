import fs from 'fs';

/*
 * ĐỌC FILE VĂN BẢN CỦA REPO, ĐÃ CHUẨN HOÁ CRLF.
 *
 * VÌ SAO CÓ FILE NÀY. Kit đã trả giá SÁU lần cho đúng một lớp lỗi: một máy kiểm đọc file bằng
 * `readFileSync(p, 'utf8')` rồi so với chuỗi chứa `\n` (hay dễ thấy nhất: `startsWith('---\n')` để
 * kiểm frontmatter). Trên Windows `core.autocrlf=true` cho ra `---\r\n` ở cây làm việc, trong khi
 * trong git vẫn là `---\n` và `git status` vẫn SẠCH. Nên:
 *
 *   · CI Linux xanh, người checkout mới trên Windows đỏ — mà không ai sửa gì;
 *   · thông điệp lỗi nói "thiếu frontmatter", tức nó chỉ sai hướng hoàn toàn;
 *   · và nó còn làm phồng mọi phép đếm theo `length` (một byte mỗi dòng).
 *
 * Năm lần trước: `library_drift`, `build.js`, `course_parse.js`, `course_maturity.js`,
 * `slash-commands.spec.ts`. Lần thứ sáu là `tc-design-guide.spec.ts` (đo 15/10/2026, đỏ trong
 * `full:suite` ở `.agent/skills/phase1/tc_design_guide/SKILL.md`).
 *
 * Sáu lần thì cái thiếu không phải thêm một lần nhớ — là MỘT CỬA ĐỌC dùng chung, để người viết máy
 * kiểm sau không phải biết chuyện CRLF mới viết đúng.
 *
 * Đây KHÔNG phải nới assertion: nội dung trả về vẫn đủ nguyên văn để so, chỉ bỏ `\r` cuối dòng.
 */

/** `\r` viết bằng mã, không viết thẳng — tránh chính nó bị một cửa đọc nào đó chuẩn hoá mất. */
const CR = String.fromCharCode(13);

/** Bỏ `\r` của cặp CRLF trong một chuỗi đã đọc sẵn. */
export function boCR(s: string): string {
  return s.split(CR + '\n').join('\n');
}

/** Đọc UTF-8 và chuẩn hoá CRLF về LF. */
export function docSach(duong: string): string {
  return boCR(fs.readFileSync(duong, 'utf8'));
}
