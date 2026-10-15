/*
 * `goEscape` — ĐỔI CHUỖI NHƯ-NÓ-NẰM-TRONG-SOURCE thành chuỗi NHƯ-NÓ-CHẠY.
 *
 * Máy kiểm nào bốc một chuỗi ra khỏi mã nguồn bằng regex đều nhận `\n` dưới dạng HAI ký tự (`\` và
 * `n`), chứ không phải xuống dòng. Đem văn bản đó đi soi như thể nó là nội dung thật thì kết luận sai.
 *
 * Ca đã xảy ra (15/10/2026, `sql-readonly-lint.spec.ts`): một câu SQL viết trong nháy kép,
 * `SELECT … ;\n\n-- ghi chú`. Với xuống dòng THẬT, lint cho qua đúng — một câu, rồi một comment. Với
 * `\n` chưa giải, sau khi bóc comment tới cuối dòng thì sau dấu `;` vẫn còn mấy ký tự `\` và `n`, nên
 * lint kết luận "còn statement nữa" và CHẶN. Dương tính giả.
 *
 * Dương tính giả ở cửa SQL là loại nguy hiểm nhất: cách "sửa" nhanh nhất luôn là thêm file vào danh
 * sách bỏ qua, và thế là mất luôn phép canh trên file đó.
 *
 * CHỈ giải các escape mà một chuỗi nháy đơn/nháy kép của JS thật sự mang. KHÔNG giải `\uXXXX` hay
 * `\xNN`: chúng hiếm trong SQL, và giải nửa vời thì tệ hơn không giải — người đọc sẽ tưởng hàm này
 * trả về đúng chuỗi lúc chạy trong mọi trường hợp.
 */

const BANG: Record<string, string> = { n: '\n', r: '\r', t: '\t' };

export function goEscape(s: string): string {
  return String(s).replace(/\\(n|r|t|'|"|\\)/g, (_x, c: string) => BANG[c] ?? c);
}
