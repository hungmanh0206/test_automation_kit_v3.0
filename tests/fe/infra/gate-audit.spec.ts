import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `gate:audit` — kiểm kê gate để phân tầng (v2.7.0 bước 1a).
 *
 * Bộ test này khoá bốn thứ, cả bốn đều là lỗi ĐÃ XẢY RA khi dựng máy, nên mỗi cái đáng một test:
 *   1. Tầng T0 lấy từ CONFIG KHAI TAY, không suy từ từ khoá. Suy bằng từ khoá đã thử hai lần: một dòng
 *      mô tả thì 66/98 máy không khớp gì, cả khối header thì T0 phình lên 40 máy với những dòng sai rõ
 *      ràng (`ci:scope` gán "lộ secret", `decisions:check` gán "lộ PII").
 *   2. `--write-tiers` KHÔNG được ghi đè khối T0 do người viết. Lượt đầu của cờ đó đã xoá sạch 12 dòng
 *      T0 mà không một lời cảnh báo.
 *   3. Mỗi non-negotiable phải có ít nhất một gate T0 (§B.4).
 *   4. Số lần chặn và trùng lắp giữa gate phải ghi `chưa đo được`, KHÔNG được đoán.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/gate_audit.js');
const TIERS = path.join(REPO, '.agent/config/gate_tiers.json');

test.describe.configure({ mode: 'default' });

function chay(them: string[] = []) {
  return spawnSync(process.execPath, [MAY, ...them], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
}

let kq: { tong_may: number; theo_tang: Record<string, number>; gate: Array<Record<string, unknown>>;
  ban_do_non_negotiable: Record<string, { ten: string; gate: string[] }>;
  non_negotiable_chua_co_gate_T0: string[]; ung_vien_T0_chua_khai: string[];
  trung_lap: { trang_thai: string }; cho_nguoi_chot: string[]; thieu_cap_doi_chung: string[] };

test.beforeAll(() => {
  const r = chay(['--json']);
  expect(r.status, `gate:audit phải chạy được: ${r.stderr}`).toBe(0);
  kq = JSON.parse(`${r.stdout}`);
});

test.describe('@infra gate:audit — dùng CHUNG phép kiểm kê với gates:index', () => {
  test('số máy khớp `gate_index`, không tự đếm lại', () => {
    /*
     * Hai máy cùng trả lời "kit có bao nhiêu gate" mà quét bằng hai cách khác nhau thì sớm muộn ra hai
     * con số, và lúc đó không ai biết số nào đúng. Nên `gate_audit` require `gate_index`, và test này
     * khoá chuyện đó lại.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const gi = require(path.join(REPO, 'scripts/qa/gate_index.js'));
    expect(kq.tong_may).toBe(gi.build().rows.length);
  });

  test('`gate_index` require được mà KHÔNG chạy CLI', () => {
    /* Thiếu `require.main` guard thì require nó trong máy khác làm CLI chạy và exit giữa lượt gọi. */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/gate_index.js'), 'utf8');
    expect(src).toContain('require.main === module');
    expect(src).toMatch(/module\.exports\s*=\s*\{[^}]*build/);
  });

  test('ba tầng cộng lại đúng tổng — không máy nào rơi ra ngoài', () => {
    const t = kq.theo_tang;
    expect(t.T0 + t.T1 + t.T2).toBe(kq.tong_may);
  });

  test('`levelOf` nhận cả ĐƯỜNG RA GIÁN TIẾP — `process.exit(main())` + `return 1`', () => {
    /*
     * Bản trước chỉ bắt `process.exit(1)` viết thẳng, nên `router_check.js` bị dán nhãn **BÁO CÁO** dù
     * nó CHẶN thật — nhãn sai theo đúng chiều nguy hiểm: người đọc danh mục tưởng chỗ đó chỉ in ra.
     *
     * Khi nới mẫu, phép đo nói "đổi đúng 1 dòng". SAI: nó đổi HAI. Phép đo chỉ soi `scripts/qa/`, còn
     * `scripts/phase1/docs_index.js` cũng theo khuôn này và đang bị gán **SINH** trong khi nó
     * `process.exit(flag('enforce') ? ma : 0)`. Nhãn mới của nó — CHẶN có cờ — mới là nhãn đúng.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const gi = require(path.join(REPO, 'scripts/qa/gate_index.js'));
    const gianTiep = 'function main() { if (x) return 1; return 0; }\nprocess.exit(main());';
    expect(gi.levelOf(gianTiep), 'đường ra gián tiếp vẫn là đường ra').toBe('CHẶN');

    /* ĐỐI CHỨNG ÂM: `process.exit(main())` mà KHÔNG có `return 1` thì không phải CHẶN. */
    const khongChan = 'function main() { console.log("x"); return 0; }\nprocess.exit(main());';
    expect(gi.levelOf(khongChan), 'không có đường ra 1 thì KHÔNG được gọi là CHẶN').toBe('BÁO CÁO');

    /* ĐỐI CHỨNG ÂM: chỉ có `return 1` mà không exit qua hàm — ví dụ một hàm helper — cũng không phải. */
    expect(gi.levelOf('function kiem() { return 1; }\nconsole.log(kiem());'), 'return 1 lẻ không phải đường ra')
      .toBe('BÁO CÁO');
  });

  test('`router:check` phải nằm ở mức CHẶN trong danh mục', () => {
    /* Phép kiểm neo vào KẾT QUẢ, không vào regex — regex đổi mà nhãn vẫn đúng thì không ai phải sửa đây. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const gi = require(path.join(REPO, 'scripts/qa/gate_index.js'));
    const dong = gi.build().rows.find((r: { npm: string[] }) => r.npm.includes('router:check'));
    expect(dong, '`router:check` phải có trong danh mục gate').toBeTruthy();
    expect(String(dong.level), 'gate exit 1 mà danh mục ghi "chỉ in" là nhãn sai chiều nguy hiểm')
      .toMatch(/^CHẶN/);
  });
});

test.describe('@infra gate:audit — T0 lấy từ CONFIG, KHÔNG suy từ từ khoá', () => {
  test('mọi dòng T0 đều có mặt trong `gate_tiers.json`, không có dòng nào do máy tự thêm', () => {
    const cfg = JSON.parse(fs.readFileSync(TIERS, 'utf8'));
    const khaiTay = new Set(Object.keys(cfg.T0 || {}));
    expect(khaiTay.size, 'config phải khai T0 bằng tay').toBeGreaterThan(0);
    const mayXep = kq.gate.filter((g) => g.tang === 'T0').map((g) => (g.npm as string[])[0]);
    for (const m of mayXep) {
      expect(khaiTay.has(m), `${m} được xếp T0 mà KHÔNG có trong config — máy đang tự suy T0`).toBe(true);
    }
    expect(mayXep.length).toBe(khaiTay.size);
  });

  test('mỗi dòng T0 ghi NGUỒN là khai tay, và kèm lý do dài hơn một nhãn', () => {
    for (const g of kq.gate.filter((x) => x.tang === 'T0')) {
      expect(g.nguon_tang).toContain('khai tay');
      expect(String(g.vi_sao).length, `${(g.npm as string[])[0]}: lý do T0 phải nói được vì sao không thương lượng`).toBeGreaterThan(40);
      expect(g.non_negotiable, `${(g.npm as string[])[0]}: T0 phải neo vào một non-negotiable`).toBeTruthy();
    }
  });

  test('ĐỐI CHỨNG ÂM: gate có từ khoá gợi ý T0 mà chưa khai tay thì VẪN là T1', () => {
    /*
     * Đây là chỗ bản trước sai. Từ khoá gợi ý T0 cho 29 máy; nếu máy lấy gợi ý làm quyết định thì T0
     * phình lên và bảng phân tầng sai 40%. Gợi ý phải nằm ở cột riêng và KHÔNG đổi tầng.
     */
    const ungVien = kq.ung_vien_T0_chua_khai;
    expect(ungVien.length, 'phải còn ứng viên để test này nói được điều gì').toBeGreaterThan(0);
    for (const u of ungVien) {
      const ten = u.split(' ')[0];
      const g = kq.gate.find((x) => (x.npm as string[])[0] === ten);
      expect(g, `không thấy ${ten}`).toBeTruthy();
      expect(g!.tang, `${ten} có gợi ý T0 nhưng chưa khai tay ⇒ phải ở T1`).toBe('T1');
    }
  });

  test('T2 suy TỪ CODE (mức không chặn), không từ văn bản', () => {
    for (const g of kq.gate.filter((x) => x.tang === 'T2')) {
      expect(String(g.muc).startsWith('CHẶN'), `${(g.npm as string[])[0]} là T2 thì không được có đường exit 1`).toBe(false);
      expect(g.nguon_tang).toContain('suy từ code');
    }
  });
});

test.describe('@infra gate:audit — §B.4: mỗi non-negotiable phải có gate T0', () => {
  test('không non-negotiable nào trống gate T0', () => {
    expect(kq.non_negotiable_chua_co_gate_T0,
      'một non-negotiable không có gate T0 nào là một luật không có máy thi hành').toEqual([]);
  });

  test('đủ cả 6 mục trong bản đồ', () => {
    expect(Object.keys(kq.ban_do_non_negotiable).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  test('§6 có máy gác, và máy đó phải THẬT SỰ có luật `no-assert` chặn', () => {
    /*
     * BẢN ĐẦU CỦA TEST NÀY TÌM CHUỖI "nới assertion / đổi expected" trong `automation_review.js` và nó
     * ĐỎ — rồi tôi suýt kết luận "§6 không có máy nào thi hành". Sai: cái đỏ là do tôi tìm sai chuỗi.
     * Máy đó có rule `no-assert` (P0, chặn) bắt test không có khẳng định nào — tức loại test luôn xanh
     * kể cả khi sản phẩm sai, đúng ruột của §6.
     *
     * Nên test này kiểm LUẬT CÓ THẬT (id trong `RULES`), không kiểm một câu văn. Câu văn đổi là chuyện
     * bình thường; một luật biến mất mới là chuyện phải đỏ.
     */
    expect(kq.ban_do_non_negotiable['6'].gate.length).toBeGreaterThan(0);
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/automation_review.js'), 'utf8');
    const ids = [...src.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(ids, 'luật chặn test-không-có-khẳng-định là ruột của §6').toContain('no-assert');
    expect(ids, 'và khẳng định rỗng nghĩa cũng là một cách làm case xanh giả').toContain('vacuous-url');
    expect(src, '`no-assert` phải là P0 và chặn, không phải cảnh báo').toMatch(/id: 'no-assert',\s*\n\s*sev: 'P0',\s*\n\s*khoi: true/);
  });

  test('chỗ §6 CÒN HỞ phải được ghi ra, không để "6/6 có gate" bị đọc thành "6/6 đã kín"', () => {
    /*
     * §B.4 chỉ đòi mỗi non-negotiable có ÍT NHẤT MỘT gate T0. Đạt điều kiện đó không có nghĩa là luật đã
     * kín. "đổi expected để pass" hiện KHÔNG có máy nào: không gì so expected với bản trước.
     */
    const cfg = JSON.parse(fs.readFileSync(TIERS, 'utf8'));
    const ho = cfg._non_negotiable_con_ho;
    expect(ho, 'config phải khai chỗ còn hở').toBeTruthy();
    expect(Object.keys(ho).filter((k) => k.startsWith('§')).length).toBeGreaterThan(0);
    expect(JSON.stringify(ho)).toContain('đổi expected');
  });

  test('bảng đo CŨ trong header gate phải tự khai là bản cũ', () => {
    /*
     * Bảng "Nhóm A đòi / Kit đã có chưa" trong `automation_review.js` là phép đo lúc lập kế hoạch
     * v2.5.0. Nó ghi "test không assertion | KHÔNG CÓ" trong khi rule `no-assert` đã được cài sau đó —
     * và chính chỗ đó làm tôi kết luận sai về §6. Một bảng đo cũ không tự khai là bản cũ thì nó sẽ được
     * đọc như trạng thái hiện tại.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/automation_review.js'), 'utf8');
    expect(src).toMatch(/BẢNG TRÊN LÀ PHÉP ĐO LÚC LẬP KẾ HOẠCH/);
    expect(src, 'và phải nói rõ hiện tại đã vượt bảng ở đâu').toContain('no-assert');
  });
});

test.describe('@infra gate:audit — "chưa đo được" KHÔNG thành một con số', () => {
  test('số lần chặn ghi `chưa đo được`, kèm điều kiện để đo', () => {
    for (const g of kq.gate.slice(0, 5)) {
      const ls = g.lich_su as Record<string, unknown>;
      /*
       * §A9 đã MỞ SỔ (`knowledge/metrics/gate-friction.jsonl`), nên lý do đổi: không còn là "chưa có
       * chỗ ghi" mà là "sổ chưa có sự kiện của gate này". Test cập nhật theo, và vẫn giữ phần quan
       * trọng: "chưa đo" KHÁC "không có", nên nó phải là chuỗi chứ không phải số 0.
       */
      expect(ls.so_lan_chan === 'chưa đo được' || typeof ls.so_lan_chan === 'number').toBe(true);
      if (ls.so_lan_chan === 'chưa đo được') {
        expect(String(ls._vi_sao_chua_do_duoc_so_lan_chan)).toMatch(/gate-friction|sổ ma sát/);
      }
    }
  });

  test('trùng lắp giữa gate ghi `chưa đo được`, và nói rõ cách đo của prompt không dùng được', () => {
    expect(kq.trung_lap.trang_thai).toBe('chưa đo được');
    const j = kq.trung_lap as unknown as Record<string, string>;
    expect(j._vi_sao, 'phải nói rõ mutation_check không chạy gate nào').toContain('mutation_check');
    expect(j._cach_do_dung, 'và phải nêu cách đo đúng').toMatch(/A10\.3|fixture/);
  });

  test('số báo oan khai rõ là "được NHẮC", không khai thành "đã báo oan"', () => {
    const ra = chay();
    expect(`${ra.stdout}`).toContain('số lần ĐƯỢC NHẮC');
    expect(`${ra.stdout}`, 'phải nói quy tắc dọn §A9 chưa đo được').toContain('KHÔNG đo được bằng nguồn này');
  });
});

test.describe('@infra gate:audit --write-tiers — KHÔNG ghi đè thứ người viết', () => {
  test('file đã có T0 khai tay ⇒ TỪ CHỐI ghi đè, ghi ra bản gợi ý bên cạnh', () => {
    /*
     * LƯỢT ĐẦU CỦA CỜ NÀY ĐÃ XOÁ SẠCH KHỐI T0: nó ghi bản suy từ từ khoá cho cả 98 máy, và 12 dòng T0
     * khai tay biến mất không một lời cảnh báo. Cùng họ lỗi với lần mất 129 ô kết quả trong Excel: một
     * bước SINH LẠI đè mất thứ NGƯỜI đã nhập.
     */
    const truoc = fs.readFileSync(TIERS, 'utf8');
    const ben = TIERS.replace(/\.json$/, '.suggested.json');
    const coSan = fs.existsSync(ben);
    try {
      const r = chay(['--write-tiers']);
      expect(r.status).toBe(0);
      expect(`${r.stdout}`).toContain('TỪ CHỐI ghi đè');
      expect(fs.readFileSync(TIERS, 'utf8'), 'file nguồn KHÔNG được đổi một byte').toBe(truoc);
      expect(fs.existsSync(ben), 'bản gợi ý phải ra file bên cạnh').toBe(true);
      const goiY = JSON.parse(fs.readFileSync(ben, 'utf8'));
      expect(Object.keys(goiY.gate).length).toBe(kq.tong_may);
    } finally {
      if (!coSan && fs.existsSync(ben)) fs.unlinkSync(ben);
    }
  });

  test('bản gợi ý KHÔNG được track — nó là artifact, không phải nguồn', () => {
    const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
    expect(gi).toContain('gate_tiers.suggested.json');
  });

  test('file CHƯA có ⇒ dựng khung với khối T0 RỖNG, và nói rõ T0 phải do người khai', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-'));
    try {
      /* Chạy trong một repo giả thì `gate_index` không quét được; nên kiểm bằng source cho chắc. */
      const src = fs.readFileSync(MAY, 'utf8');
      expect(src, 'nhánh dựng khung phải nói T0 còn rỗng').toContain('Khối `T0` còn RỖNG');
      expect(src).toMatch(/coT0KhaiTay/);
      expect(fs.existsSync(d)).toBe(true);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
});

test.describe('@infra gate:audit — thời điểm chạy suy từ bề mặt gọi', () => {
  test('gate gọi từ CI mang thời điểm `ci`, không khai tay', () => {
    const g = kq.gate.find((x) => (x.npm as string[])[0] === 'secret:scan');
    expect(g, 'không thấy secret:scan').toBeTruthy();
    expect(g!.thoi_diem as string[]).toContain('ci');
  });

  test('mọi gate đều có thời điểm, và "chưa rõ" được nói ra thay vì đoán', () => {
    for (const g of kq.gate) {
      const td = g.thoi_diem as string[];
      expect(td.length, `${(g.npm as string[])[0]} không có thời điểm nào`).toBeGreaterThan(0);
    }
    const chuaRo = kq.gate.filter((g) => (g.thoi_diem as string[]).includes('chưa rõ'));
    /* Có "chưa rõ" là bình thường; điều quan trọng là nó được NÓI RA, không bị gán bừa vào một nhóm. */
    for (const g of chuaRo) expect((g.thoi_diem as string[]).length).toBe(1);
  });
});

test.describe('@infra gate:audit — in gọn theo §T', () => {
  test('mặc định in ít hơn bản `--full`', () => {
    const gon = chay();
    const full = chay(['--full']);
    expect(`${gon.stdout}`.length).toBeLessThan(`${full.stdout}`.length);
    expect(`${gon.stdout}`, 'bản gọn phải nói rõ đã ẩn bao nhiêu').toMatch(/in \d+\/\d+/);
  });

  test('bản gọn VẪN in đủ mọi dòng T0 — không được ẩn thứ không thương lượng', () => {
    const gon = `${chay().stdout}`;
    for (const g of kq.gate.filter((x) => x.tang === 'T0')) {
      expect(gon, `bản gọn thiếu ${(g.npm as string[])[0]}`).toContain((g.npm as string[])[0]);
    }
  });
});
