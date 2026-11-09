/**
 * `boChuThich` — một nguồn, và một bản sao CHỊU LỰC được đo.
 *
 * BỐI CẢNH (09/11/2026). Hàm này từng có BA bản giống hệt từng byte: `version_check.js` ·
 * `recon_passive.js` · `env_assumptions.js`. Ba bản của một hàm phân tích nguồn là ba chỗ để trôi
 * khỏi nhau, và khi chúng trôi thì ba cửa đọc CÙNG một file ra BA kết quả khác nhau — kiểu hỏng
 * không ai nhìn thấy cho tới lúc hai cửa cãi nhau về cùng một dòng mã.
 *
 * Nay còn HAI: `lib/js_source.js` (nguồn) và bản trong `version_check.js`.
 *
 * VÌ SAO BẢN KIA KHÔNG GỘP — và đây là quyết định có lý do, không phải bỏ sót. Phép kiểm
 * `⑦ chạy được trong gói` dựng một cây chỉ có ĐÚNG MỘT file là `scripts/qa/version_check.js`. Lượt
 * đầu từng `require('./recon_passive.js')` và cửa CHẾT HẲN (`Cannot find module`) trong cây đó. Bản
 * sao ấy là thứ giữ cho cửa chạy được ở nơi không có file anh em.
 *
 * VÀ ĐÂY LÀ PHẦN ĐÁNG KỂ. Chú thích trong `version_check.js` từng viết rằng
 * `version-changelog.spec.ts` "có một phép kiểm đòi hai bản cho CÙNG kết quả". Grep toàn bộ spec:
 * KHÔNG CÓ. Phép kiểm ấy chưa bao giờ được viết.
 *
 * Một đối chứng được KHAI mà không TỒN TẠI thì **tệ hơn không có**: người đọc tin chỗ đó đang được
 * canh nên thôi không đi canh nữa. File này là phép kiểm ấy, viết thật.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const LIB = path.join(REPO, 'scripts', 'qa', 'lib', 'js_source.js');
const VC = path.join(REPO, 'scripts', 'qa', 'version_check.js');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const boLib = require(LIB).boChuThich as (s: string) => string;
const boVC = require(VC).boChuThich as (s: string) => string;

/*
 * BỘ MẪU. Mỗi mẫu là một hình dạng ĐÃ TỪNG làm hỏng một cửa trong kit, không phải mẫu nghĩ ra cho
 * đẹp — một bộ mẫu toàn ca dễ thì hai bản sai GIỐNG NHAU vẫn qua.
 */
const MAU: Array<[string, string]> = [
  ['chú thích khối', 'const a = 1;\n/* bỏ\n   đi */\nconst b = 2;\n'],
  ['chú thích dòng', 'const a = 1; // bỏ đi\nconst b = 2;\n'],
  ['URL KHÔNG được ăn mất', "const u = 'https://vi.du/x';\nconst b = 2;\n"],
  ['`://` giữa dòng', 'const p = x ? "a://b" : "c";\n'],
  ['chú thích lồng dấu sao', '/* a ** b */\nconst c = 1;\n'],
  ['chuỗi CHỨA dấu chú thích', "const s = '/* không phải chú thích */';\n"],
  ['chú thích cuối file không xuống dòng', 'const a = 1; // hết'],
  ['nhiều dòng trống trong khối', '/*\n\n\n*/\nconst a = 1;\n'],
  ['rỗng', ''],
  ['chỉ có chú thích', '/* chỉ thế thôi */'],
];

test.describe('@infra boChuThich — hai bản phải cho CÙNG kết quả', () => {
  test('bộ mẫu: hai bản giống nhau từng ký tự', () => {
    const lech: string[] = [];
    for (const [ten, src] of MAU) {
      if (boLib(src) !== boVC(src)) lech.push(ten);
    }
    expect(lech, 'hai bản đã trôi khỏi nhau — hai cửa sẽ đọc cùng một file ra hai kết quả').toEqual([]);
    expect(MAU.length, 'bộ mẫu rỗng thì phép so ở trên luôn đạt').toBeGreaterThanOrEqual(10);
  });

  test('ĐỐI CHỨNG: phép so này PHÂN BIỆT ĐƯỢC — một bản sai thì nó phải thấy', () => {
    /*
     * Thiếu ca này thì "hai bản giống nhau" không phân biệt được với "bộ mẫu không chạm tới chỗ khác
     * nhau". Dựng một bản HỎNG có chủ ý — bỏ cái chốt `(^|[^:])` vốn giữ cho `https://` không bị ăn —
     * rồi đòi phép so bắt được nó.
     */
    const hong = (s: string) => s
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
    const batDuoc = MAU.filter(([, src]) => boLib(src) !== hong(src));
    expect(batDuoc.length, 'bộ mẫu không chạm tới khác biệt nào ⇒ nó không gác được gì')
      .toBeGreaterThan(0);
  });

  test('bộ mẫu PHẢI có ca `https://` — đó là chỗ hai bản dễ lệch nhất', () => {
    /* Ca đối chứng ở trên dựa vào đúng mẫu này. Mất nó thì phép phá kia thành rỗng. */
    expect(MAU.some(([, s]) => s.includes('https://'))).toBe(true);
  });
});

test.describe('@infra boChuThich — không được đẻ bản thứ BA', () => {
  test('chỉ `lib/js_source.js` và `version_check.js` được tự định nghĩa', () => {
    /*
     * Gộp một lần mà không gác thì lần sau lại có bản thứ ba, và lý do sẽ y hệt lần này: "chép cho
     * nhanh, ghi nợ lại sau". Ca này biến món nợ đó thành thứ nhìn thấy được ngay khi nó phát sinh.
     */
    const duocPhep = new Set(['lib/js_source.js', 'version_check.js']);
    const co: string[] = [];
    const di = (d: string, tien: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const rel = tien ? `${tien}/${e.name}` : e.name;
        if (e.isDirectory()) { di(path.join(d, e.name), rel); continue; }
        if (!e.name.endsWith('.js')) continue;
        const s = fs.readFileSync(path.join(d, e.name), 'utf8');
        if (/function\s+boChuThich\s*\(/.test(s)) co.push(rel);
      }
    };
    di(path.join(REPO, 'scripts', 'qa'), '');
    expect(co.length, 'không file nào định nghĩa `boChuThich` ⇒ ca này đo hư không').toBeGreaterThan(0);
    const thua = co.filter((f) => !duocPhep.has(f));
    expect(thua, 'bản sao mới của `boChuThich` — dùng `lib/js_source.js`, hoặc nếu là bản CHỊU LỰC '
      + 'như `version_check.js` thì khai vào danh sách này KÈM lý do và thêm vào bộ mẫu so ở trên').toEqual([]);
  });
});
