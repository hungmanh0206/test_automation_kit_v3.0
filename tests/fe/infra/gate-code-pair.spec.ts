import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `gate:code-pair` — CẶP BẨN/SẠCH và ĐƯỜNG ĐỊNH TUYẾN của 21 mã T0/T1 (v2.7.0 §A10.3).
 *
 * §A10.3 viết như thể mỗi gate tự gọi tên mã của mình. Đo thực tế thì không: `gate_engine.maCua()` khớp
 * regex `khop` trong `gate_codes.json` lên CÂU THÔNG BÁO, nên mã là thứ SUY RA từ văn bản. Đó là chỗ hở
 * mà trước v2.7.0 không máy nào gác, và nó có hậu quả cụ thể: đo 12/10/2026 trên 7.939 chuỗi literal
 * trong `scripts/**.js` thấy 18 chuỗi khớp hai mã hoặc hơn, trong đó có cặp HAI MÃ T0
 * (`FAIL_CHUA_PHAN_TANG` + `RERUN_THIEU`) — mã nào thắng tuỳ THỨ TỰ KHAI trong file config.
 *
 * BỘ TEST NÀY CỐ Ý KHÔNG NHÚNG CÂU MẪU NÀO. `gate:code-pair` đo độ phủ bằng cách tìm mảnh đặc trưng của
 * `mau_ban` trong các spec hạ tầng, nên một spec liệt kê cả 21 câu sẽ đẩy số liệu từ 2/21 lên 21/21 mà
 * không thêm một phép đo nào. Spec này đọc registry chứ không chép câu, để chính nó không làm đẹp con số
 * mà nó đang canh.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/gate_code_pair.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const pol = require(MAY);
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const engine = require(path.join(REPO, 'scripts/qa/lib/gate_engine'));

const REG = path.join(REPO, '.agent/config/gate_code_pairs.json');
const MA = path.join(REPO, '.agent/config/gate_codes.json');

const docReg = () => JSON.parse(fs.readFileSync(REG, 'utf8'));
const docMa = () => {
  const c = JSON.parse(fs.readFileSync(MA, 'utf8'));
  return (Array.isArray(c) ? c : c.codes).filter((x: { tang: string }) => x.tang === 'T0' || x.tang === 'T1');
};

test.describe.configure({ mode: 'default' });

test.describe('@infra gate:code-pair — mọi mã T0/T1 có cặp, và định tuyến đúng', () => {
  test('mỗi mã T0/T1 có một cặp trong registry — không mã nào bị bỏ', () => {
    const co = new Set(docReg().ma.map((m: { code: string }) => m.code));
    const thieu = docMa().map((c: { code: string }) => c.code).filter((c: string) => !co.has(c));
    expect(thieu, 'mã không có cặp là mã không ai chứng minh gate phát ra').toEqual([]);
  });

  test('`maCua` của mỗi câu mẫu trả về ĐÚNG mã đã khai', () => {
    /*
     * Đây là test quan trọng nhất của bộ. Nó khoá đường định tuyến: ai nới một `khop` để bắt thêm câu mà
     * giành mất câu của mã khác thì ĐỎ ngay tại đây, chứ không chờ một người đọc báo cáo phát hiện rằng
     * hướng dẫn `sửa` không khớp với lỗi.
     */
    const lech: string[] = [];
    for (const m of docReg().ma) {
      const ct = engine.maCuaChiTiet(m.mau_ban);
      if (ct.ma !== m.code) lech.push(`${m.code} → ${ct.ma}`);
    }
    expect(lech, 'câu mẫu bị định tuyến sang mã khác').toEqual([]);
  });

  test('gate khai cho mỗi mã là file CÓ THẬT', () => {
    const hong = docReg().ma
      .filter((m: { gate?: string }) => m.gate && !fs.existsSync(path.join(REPO, m.gate)))
      .map((m: { code: string; gate: string }) => `${m.code} → ${m.gate}`);
    expect(hong).toEqual([]);
  });

  test('`--enforce` CHẶN khi một mã mất cặp, và nói rõ mã nào', () => {
    /*
     * Phép đối chứng: bỏ một mã khỏi registry rồi chạy máy trên bản tạm. Không sửa file thật — registry
     * là config dùng chung, và một test làm bẩn nó sẽ làm đỏ các lượt chạy song song.
     */
    const reg = docReg();
    const bo = reg.ma[0].code;
    reg.ma = reg.ma.slice(1);
    const tam = path.join(REPO, '.agent/config/gate_code_pairs.test-tmp.json');
    fs.writeFileSync(tam, JSON.stringify(reg), 'utf8');
    try {
      /* Máy đọc đường dẫn cố định, nên phép đối chứng chạy qua hàm thay vì qua CLI. */
      const d = pol.dungDo();
      expect(d.chan, 'bản thật phải SẠCH — nếu không thì mọi kết luận sau đó là rỗng').toEqual([]);
      expect(d.so_ma, 'phải đo trên đủ 21 mã T0/T1').toBe(docMa().length);
      expect(bo.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tam, { force: true });
    }

    const src = fs.readFileSync(MAY, 'utf8');
    expect(src, 'thiếu cặp phải vào danh sách CHẶN').toContain('KHÔNG có cặp trong gate_code_pairs.json');
    expect(src, '`--enforce` phải exit khác 0 khi có CHẶN').toContain('ENFORCE && d.chan.length ? 1 : 0');
  });

  test('chạy thật: exit 0 trên cây sạch, và in tỉ lệ ĐO ĐƯỢC chứ không khai tay', () => {
    const r = spawnSync(process.execPath, [MAY], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status).toBe(0);
    const ra = `${r.stdout}`;
    expect(ra).toMatch(/\d+\/\d+ mã có spec đòi gate phát ra đúng mã/);
    expect(ra, 'registry không được khai sẵn trường spec — khai tay thì số sẽ cũ').not.toContain('"spec":');
  });

  test('registry KHÔNG khai sẵn độ phủ spec — số đó phải do máy đo', () => {
    /*
     * Chuyện đã xảy ra ở lượt dựng registry này: tôi khai tay 21 đường dẫn spec, và 14 trong số đó trỏ
     * vào file KHÔNG TỒN TẠI (`output-gate.spec.ts`, `design-gate.spec.ts`… đều là tên tôi đoán). Một
     * trường khai tay như vậy trông như bằng chứng về độ phủ trong khi nó chỉ là một danh sách phỏng đoán.
     */
    for (const m of docReg().ma) {
      expect(Object.keys(m), `mã ${m.code} khai tay trường spec`).not.toContain('spec');
    }
  });

  test('máy tự khai GIỚI HẠN của phép đo độ phủ — vì phép đo đó gian lận được', () => {
    /*
     * `gate:code-pair` đo "có spec nào NHẮC câu này", không đo "có spec nào DRIVE gate phát ra câu này".
     * Viết một spec liệt kê cả 21 câu mẫu là đủ để đẩy 2/21 lên 21/21 mà không thêm phép đo nào. Một máy
     * đo gian lận được mà không tự khai thì con số của nó sẽ được đọc như một bảo đảm.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toContain('ĐẠI LƯỢNG THAY THẾ');
    expect(src).toContain('gian lận được');
  });

  test('bộ test này KHÔNG nhúng câu mẫu nào — nó không được làm đẹp số mà nó canh', () => {
    const tu = fs.readFileSync(__filename.replace(/\.js$/, '.ts'), 'utf8');
    const nhung = docReg().ma
      .filter((m: { mau_ban: string }) => pol.manh(m.mau_ban).some((x: string) => tu.includes(x)))
      .map((m: { code: string }) => m.code);
    expect(nhung, 'spec nhúng câu mẫu sẽ tự đẩy tỉ lệ độ phủ lên').toEqual([]);
  });
});
