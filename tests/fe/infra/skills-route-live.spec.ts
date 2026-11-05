/*
 * `skills:route:live` — GÁC PHẦN KHÔNG CẦN MODEL CỦA MỘT CỬA CẦN MODEL.
 *
 * Cửa này gọi `claude -p` thật nên KHÔNG thể chạy trong CI và KHÔNG chạy trong spec. Nhưng ba thứ
 * quanh nó thì kiểm được tất định, và cả ba đều đã từng sai thật ngày 04/11/2026:
 *
 *   ① `--trong-repo` làm `goc` LÀ gốc repo, mà cuối lượt script có `fs.rmSync(goc, {recursive, force})`.
 *      Chạy một lần là XOÁ SẠCH cây làm việc. Bắt được trước khi gọi, nhưng chỉ vì tình cờ đọc lại —
 *      và cây này dùng chung với các phiên khác. Ca ở đây là chốt duy nhất giữ nó đóng.
 *   ② `--gioi-han` là MẪU. Tôi đã so 20 câu (75%) với 90 câu (38,6%) rồi kết luận nhân quả về ngữ
 *      cảnh; đối chứng cùng mẫu bác ngay. Nhãn "đây là mẫu" phải có trong CẢ stdout và file báo cáo.
 *   ③ Khối ghi chú trong báo cáo từng GHI CỨNG "đo trong thư mục fixture" và nói SAI về chính lượt
 *      `--trong-repo` sinh ra nó. Một báo cáo mô tả sai điều kiện tạo ra nó thì tệ hơn không có.
 *
 * Kiểm bằng cách đọc SOURCE, không bằng cách chạy — vì chạy là tốn lượt model. Đọc source để gác một
 * tính chất an toàn là hợp lệ khi tính chất đó nằm ngay trong một dòng mã.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { mayThu } from './_may_thu';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = mayThu('ROUTE_LIVE_JS', path.join(REPO, 'scripts/qa/skills_route_live.js'));
const src = () => fs.readFileSync(CUA, 'utf8');

test.describe.configure({ mode: 'default' });

test.describe('@infra skills:route:live — không được xoá gốc repo', () => {
  /*
   * CA QUAN TRỌNG NHẤT CỦA FILE NÀY. Mọi lệnh `rmSync` đệ quy trong script phải nằm sau một phép thử
   * loại trừ chế độ trong-repo. Thiếu nó thì một lượt `--trong-repo` xoá cả cây làm việc.
   */
  test('mọi `rmSync` đệ quy đều có phép thử `!TRONG_REPO` ngay trước', () => {
    const s = src();
    const viTri = [...s.matchAll(/rmSync\s*\(\s*goc/g)].map((m) => m.index as number);
    expect(viTri.length, 'không thấy rmSync nào ⇒ ca này RỖNG, phải sửa ca chứ không mừng').toBeGreaterThan(0);
    for (const i of viTri) {
      const truoc = s.slice(Math.max(0, i - 220), i);
      expect(truoc, `rmSync(goc) ở vị trí ${i} KHÔNG có phép thử !TRONG_REPO che — một lượt --trong-repo sẽ xoá cả repo`)
        .toMatch(/!\s*TRONG_REPO/);
    }
  });

  test('`--trong-repo` KHÔNG tạo thư mục tạm, mà trỏ thẳng vào REPO', () => {
    const s = src();
    expect(s, 'phải có nhánh gán goc = REPO khi TRONG_REPO').toMatch(/if\s*\(\s*TRONG_REPO\s*\)\s*\{\s*\n\s*goc\s*=\s*REPO\s*;/);
  });
});

test.describe('@infra skills:route:live — mẫu phải tự dán nhãn là mẫu', () => {
  test('`--gioi-han` in cảnh báo ra stdout', () => {
    expect(src(), 'một con số lấy từ mẫu mà không mang nhãn "mẫu" sẽ bị đọc như số đo đầy đủ')
      .toMatch(/MẪU \$\{CA\.length\}\/\$\{fx\.ca\.length\}/);
  });

  test('nhãn mẫu đi vào CẢ file báo cáo, không chỉ stdout', () => {
    const s = src();
    const i = s.indexOf('const dong = [');
    expect(i, 'không tìm thấy khối sinh báo cáo').toBeGreaterThan(0);
    const khoi = s.slice(i);
    expect(khoi, 'stdout thì người chạy thấy, nhưng người ĐỌC báo cáo về sau mới là người bị số liệu lừa')
      .toMatch(/GIOI_HAN\s*>\s*0\s*\?/);
    expect(khoi).toMatch(/ĐÂY LÀ MẪU/);
  });
});

test.describe('@infra skills:route:live — báo cáo phải mô tả ĐÚNG lượt sinh ra nó', () => {
  test('khối ghi chú sinh THEO ngữ cảnh, không ghi cứng', () => {
    const s = src();
    const i = s.indexOf('const dong = [');
    const khoi = s.slice(i);
    expect(khoi, 'ghi cứng một ngữ cảnh thì lượt --trong-repo sẽ khai sai về chính nó')
      .toMatch(/TRONG_REPO\s*\?\s*\[/);
    expect(khoi, 'phải khai rõ ngữ cảnh chạy thành một dòng đọc được').toMatch(/ngữ cảnh chạy/);
  });

  test('báo cáo khai PHIÊN BẢN MODEL — thiếu nó thì năm sau không ai đọc được con số', () => {
    expect(src()).toMatch(/model CLI.*phienBan|phienBan.*model CLI/s);
  });
});

test.describe('@infra skills:route:live — đo cái gọi, không đo cái tự thuật', () => {
  /*
   * Model nói "tôi sẽ dùng X" mà không gọi X là một LỜI KHAI, không phải một phép đo. Cửa chỉ được
   * tính khi thấy lời gọi công cụ `Skill` thật trong stream.
   */
  test('chỉ nhận `tool_use` tên `Skill`, không quét văn bản trả lời', () => {
    const s = src();
    expect(s).toMatch(/b\.type === 'tool_use'\s*&&\s*b\.name === 'Skill'/);
    expect(s, 'quét chữ trong câu trả lời là đo lời khai, không đo hành vi')
      .not.toMatch(/b\.type === 'text'[\s\S]{0,120}chon\s*=/);
  });

  test('chặn công cụ dò dẫm, và KHÔNG dùng `--allowed-tools` (nó không giới hạn gì)', () => {
    const s = src();
    expect(s, 'đo 04/11: --allowed-tools Skill vẫn khai đủ bộ công cụ, model đi PowerShell dò thư mục rỗng')
      .not.toMatch(/'--allowedTools'|'--allowed-tools'/);
    expect(s).toMatch(/'--disallowed-tools'/);
    for (const t of ['Bash', 'PowerShell', 'Read', 'Glob', 'Grep']) {
      expect(s, `công cụ ${t} phải nằm trong danh sách chặn`).toContain(t);
    }
  });

  test('stdin bị chặn — để mặc thì mỗi lượt chờ 3 giây một thứ không bao giờ tới', () => {
    expect(src()).toMatch(/stdio:\s*\['ignore'/);
  });

  test('tham số được BỌC NHÁY khi qua shell — câu tiếng Việt có dấu cách', () => {
    const s = src();
    expect(s, 'spawn với shell:true nối tham số KHÔNG escape; thiếu bọc nháy thì prompt vỡ thành nhiều tham số')
      .toMatch(/const q = \(s\) =>/);
    expect(s).toMatch(/args\.map\(q\)/);
  });
});
