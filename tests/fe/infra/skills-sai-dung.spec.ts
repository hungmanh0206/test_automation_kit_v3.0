/*
 * CẶP SAI → ĐÚNG (mục 1.3) — GÁC CHÍNH CỘT ✅.
 *
 * Sáu skill dạy viết đều có `references/sai-dung.md` với các cặp ❌/✅. Phần dễ làm là viết chúng; phần
 * dễ sai là **cột ✅ tự vi phạm một luật khác**. Một ví dụ "đúng" mà vi phạm gate thì nó dạy sai, và nó
 * dạy sai một cách thuyết phục — người đọc tin vì nó nằm ở cột ✅.
 *
 * Ca ở đây gác ba thứ đo được:
 *   ① mỗi file có ít nhất 3 cặp, và số ❌ khớp số ✅ (một cặp thiếu nửa thì nó không phải cặp);
 *   ② cột ✅ KHÔNG mang các mẫu mà `auto:review` xếp P0, và KHÔNG mang dữ liệu cố định không `RUN_ID`;
 *   ③ mỗi file được thân skill TRỎ TỚI — một file không ai trỏ thì không ai đọc.
 *
 * KHÔNG gác "ví dụ có hay không": đó là việc người đọc. Cửa chỉ gác thứ đối chiếu được.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GOC = path.join(REPO, '.agent', 'skills');

/** Sáu skill dạy viết, theo mục 1.3. `tc_design_guide` dùng tên file cũ `anti_patterns.md`. */
const SKILL: { ten: string; duong: string; tep: string }[] = [
  { ten: 'tc_design_guide', duong: 'phase1/tc_design_guide', tep: 'anti_patterns.md' },
  { ten: 'test_data_generator', duong: 'shared/test_data_generator', tep: 'sai-dung.md' },
  { ten: 'automation_reviewer', duong: 'phase2/automation_reviewer', tep: 'sai-dung.md' },
  { ten: 'requirements_analyzer', duong: 'phase1/requirements_analyzer', tep: 'sai-dung.md' },
  { ten: 'backlog_bug_reporter', duong: 'shared/backlog_bug_reporter', tep: 'sai-dung.md' },
  { ten: 'run_report_reader', duong: 'shared/run_report_reader', tep: 'sai-dung.md' },
];

const docRef = (s: { duong: string; tep: string }) => {
  const f = path.join(GOC, s.duong, 'references', s.tep);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

/** Khối ✅: từ dấu ✅ tới dấu ❌ kế tiếp (hoặc hết file). Dùng để soi riêng cột đúng. */
function khoiDung(src: string): string[] {
  const ra: string[] = [];
  const re = /✅/g;
  let m = re.exec(src);
  while (m) {
    const sau = src.slice(m.index);
    const het = sau.search(/❌|\n## /);
    ra.push(het < 0 ? sau : sau.slice(0, het));
    m = re.exec(src);
  }
  return ra;
}

test.describe.configure({ mode: 'default' });

test.describe('@infra cặp sai → đúng — có mặt và đủ cặp', () => {
  for (const s of SKILL) {
    test(`${s.ten}: có file, ≥3 cặp, và số ❌ khớp số ✅`, () => {
      const src = docRef(s);
      expect(src, `thiếu .agent/skills/${s.duong}/references/${s.tep}`).not.toBeNull();
      /*
       * ĐẾM DẤU MỞ ĐẦU DÒNG, không đếm mọi lần xuất hiện.
       *
       * Bản đầu đếm cả chỗ nhắc trong văn xuôi — câu "Bản ❌ luôn đúng, kể cả khi app lưu sai" bị tính
       * là một cặp mới. `automation_reviewer` khi đó ra 11 ❌ / 8 ✅ và cửa báo lệch cặp, trong khi file
       * có đúng 7 cặp. Một cửa báo oan thì người ta tắt nó, chứ không sửa theo nó.
       */
      const demDau = (ky: string) => (src!.match(new RegExp(`^\\s*${ky}`, 'gmu')) || []).length;
      const sai = demDau('❌');
      const dung = demDau('✅');
      expect(sai, 'mục 1.3 đòi ít nhất 3 cặp mỗi skill').toBeGreaterThanOrEqual(3);
      expect(dung, 'một cặp thiếu nửa thì nó không phải cặp — ❌ không có ✅ chỉ là lời phàn nàn')
        .toBe(sai);
    });
  }
});

test.describe('@infra cặp sai → đúng — cột ✅ không tự vi phạm luật khác', () => {
  /*
   * Danh sách lấy từ các rule mà `auto:review` xếp P0, cộng hai luật dữ liệu của kit. Cố ý KHÔNG quét
   * cả file: cột ❌ PHẢI chứa các mẫu này, đó là việc của nó. Chỉ quét khối sau mỗi dấu ✅.
   */
  const CAM: { ten: string; re: RegExp; vi_sao: string }[] = [
    { ten: 'hard-sleep', re: /waitForTimeout\s*\(/, vi_sao: 'chờ theo đồng hồ, P0 của auto:review' },
    { ten: 'console-log', re: /\bconsole\.log\s*\(/, vi_sao: 'log ngập thì che dòng báo lỗi thật' },
    { ten: 'vacuous-count', re: /toBeGreaterThan\s*\(\s*0\s*\)/, vi_sao: '"có ít nhất 1 dòng" pass với mọi lưới không rỗng' },
    { ten: 'DB dựng state', re: /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i, vi_sao: 'DB chỉ read-only; precondition dựng qua UI/API/factory' },
  ];

  for (const s of SKILL) {
    test(`${s.ten}: khối ✅ sạch các mẫu bị cấm`, () => {
      const src = docRef(s);
      expect(src).not.toBeNull();
      const khoi = khoiDung(src!);
      expect(khoi.length, 'không tách được khối ✅ nào ⇒ ca này RỖNG').toBeGreaterThan(0);
      const viPham: string[] = [];
      for (const k of khoi) {
        for (const c of CAM) if (c.re.test(k)) viPham.push(`${c.ten} (${c.vi_sao})`);
      }
      expect(viPham, `cột ✅ mang mẫu bị cấm: ${viPham.join(' · ')} — một ví dụ "đúng" vi phạm luật khác thì nó dạy sai, và dạy sai một cách thuyết phục`)
        .toEqual([]);
    });
  }

  /*
   * DỮ LIỆU TRONG CỘT ✅ PHẢI MANG `RUN_ID`. Chỉ áp cho hai skill thật sự dạy về dữ liệu — áp cho cả
   * sáu là báo oan, vì cặp của `run_report_reader` nói về cách ĐỌC số, không về cách sinh dữ liệu.
   */
  for (const ten of ['test_data_generator', 'automation_reviewer']) {
    test(`${ten}: khối ✅ nào nhắc mã/tên dữ liệu thì phải có RUN_ID`, () => {
      const s = SKILL.find((x) => x.ten === ten)!;
      const khoi = khoiDung(docRef(s)!);
      const coDuLieu = khoi.filter((k) => /Mã lớp|Tên lớp|MaLop|1C/.test(k));
      expect(coDuLieu.length, 'không khối ✅ nào nhắc dữ liệu ⇒ ca này RỖNG, phải sửa ca').toBeGreaterThan(0);
      for (const k of coDuLieu) {
        expect(k, 'dữ liệu cố định làm lượt thứ hai FAIL vì trùng, rồi FAIL đó bị đọc thành bug sản phẩm')
          .toMatch(/RUN_ID/);
      }
    });
  }
});

test.describe('@infra cặp sai → đúng — phải có ai trỏ tới', () => {
  for (const s of SKILL) {
    test(`${s.ten}: thân skill TRỎ tới file cặp sai/đúng`, () => {
      const f = path.join(GOC, s.duong, 'SKILL.md');
      const src = fs.readFileSync(f, 'utf8');
      expect(src, `một file không ai trỏ tới thì không ai đọc — thêm con trỏ vào ${s.duong}/SKILL.md`)
        .toContain(`references/${s.tep}`);
    });
  }
});
