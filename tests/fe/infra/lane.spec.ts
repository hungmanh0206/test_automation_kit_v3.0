import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * HAI LÀN theo risk (v2.7.0 §A6) — `lite` và `full`.
 *
 * Làn là một cánh cửa rất dễ bị mở rộng dần: "cho nhẹ bớt" hôm nay thành mặc định tuần sau. Nên bộ test
 * này nặng về phần KHÔNG ĐỔI ĐƯỢC, không về phần nhẹ đi:
 *   · T0, evidence, rerun và ba cửa ra giữ nguyên ở CẢ HAI làn — và config không có cách nào khai ngược;
 *   · `UNKNOWN` ⇒ `full`, vì chưa đo được impact KHÔNG phải rủi ro thấp;
 *   · hạ làn ở band High thì CHẶN, không có cờ nào;
 *   · không có register thì KHÔNG mặc định làn nào.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/lane.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const lane = require(MAY);
const CFG = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/risk_lanes.json'), 'utf8'));

test.describe.configure({ mode: 'default' });

const mod = (module: string, band: string, override: string | null = null) => ({
  module, band, band_override: override, impact: 3, likelihood: 3, risk: 9,
});

function dungTask(modules: Array<Record<string, unknown>> | null) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-'));
  const taskDir = path.join(goc, 'tasks', 'T-LANE');
  fs.mkdirSync(path.join(taskDir, 'reports'), { recursive: true });
  if (modules) {
    fs.writeFileSync(path.join(taskDir, 'reports', 'risk-register.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), modules }, null, 2), 'utf8');
  }
  return { goc, taskDir };
}

function chay(goc: string, them: string[] = []) {
  return spawnSync(process.execPath, [MAY, '--task', 'T-LANE', ...them], {
    cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-LANE' },
  });
}

test.describe('@infra lane — chọn làn do SỐ quyết, không do người chạy', () => {
  test('toàn band Low ⇒ lite', () => {
    const r = lane.suyLan({ modules: [mod('A', 'Low'), mod('B', 'Low')] });
    expect(r.lan).toBe('lite');
  });

  test('MỘT module High kéo cả task sang full', () => {
    /*
     * Case của một module chạm dữ liệu và trạng thái của module khác. Chạy nửa task ở làn nhẹ nghĩa là
     * phần mở rộng quanh ranh giới hai module không ai soi — mà đó đúng là chỗ bug xuyên module sống.
     */
    const r = lane.suyLan({ modules: [mod('A', 'Low'), mod('B', 'Low'), mod('C', 'High')] });
    expect(r.lan).toBe('full');
    expect(r.high).toEqual(['C']);
    expect(r.vi_sao).toContain('kéo cả task');
  });

  test('UNKNOWN ⇒ full, KHÔNG phải lite', () => {
    /*
     * Chỗ dễ làm sai nhất. UNKNOWN nghĩa là CHƯA ĐO ĐƯỢC impact, không nghĩa là impact thấp. Gộp nó
     * vào `lite` là cho một task chưa ai đo chạy ở làn nhẹ — tức làn nhẹ thành mặc định cho mọi task
     * mới, đúng ngược với ý định.
     */
    const r = lane.suyLan({ modules: [mod('A', 'Low'), mod('B', 'UNKNOWN')] });
    expect(r.lan).toBe('full');
    expect(r.vi_sao).toContain('KHÔNG phải rủi ro thấp');
  });

  test('`band_override` THẮNG band máy tính', () => {
    /* QA đã rà và hạ band thì làn tính theo band đã rà — nhưng override được ghi dài hạn, không mất dấu. */
    expect(lane.bandCua(mod('A', 'High', 'Low'))).toBe('Low');
    expect(lane.suyLan({ modules: [mod('A', 'High', 'Low')] }).lan).toBe('lite');
    /* Và ngược lại: override LÊN High cũng kéo sang full. */
    expect(lane.suyLan({ modules: [mod('A', 'Low', 'High')] }).lan).toBe('full');
  });

  test('register RỖNG ⇒ không phán được, không đoán làn', () => {
    const r = lane.suyLan({ modules: [] });
    expect(r.lan).toBeNull();
    expect(r._khong_phan_duoc).toBe(true);
  });

  test('KHÔNG có register ⇒ exit 2, và KHÔNG mặc định làn nào', () => {
    /*
     * Mặc định `lite` là cho mọi task chưa đo rủi ro chạy ở làn nhẹ. Mặc định `full` thì nghe an toàn,
     * nhưng nó làm người ta bỏ hẳn bước neo risk: cứ chạy full là xong, và `risk:gate` mất lý do tồn tại.
     */
    const t = dungTask(null);
    const r = chay(t.goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}`).toContain('CHƯA CHỌN ĐƯỢC LÀN');
    expect(`${r.stdout}`).toContain('KHÔNG mặc định làn nào');
  });
});

test.describe('@infra lane — đổi làn: nâng tự do, hạ có điều kiện', () => {
  test('nâng `lite → full` LUÔN được, không cần lý do', () => {
    const suy = lane.suyLan({ modules: [mod('A', 'Low')] });
    const kq = lane.xinDoiLan(suy, 'full', null);
    expect(kq.ok).toBe(true);
    expect(kq.vi_sao).toContain('không cần lý do');
  });

  test('hạ `full → lite` khi có module High ⇒ CHẶN, không có cờ nào', () => {
    /*
     * Lý do duy nhất người ta hạ làn ở band High là cho nhanh. Nên chỗ này không có đường thoát: muốn
     * hạ thì phải hạ BAND trước, và đó là một quyết định về rủi ro, không phải về chi phí.
     */
    const suy = lane.suyLan({ modules: [mod('A', 'High')] });
    for (const lyDo of [null, 'vì cần gấp', 'một lý do rất dài và chi tiết nhưng vẫn không được phép hạ']) {
      const kq = lane.xinDoiLan(suy, 'lite', lyDo);
      expect(kq.ok, `lý do "${lyDo}" không được mở cửa này`).toBe(false);
      expect(kq.vi_sao).toContain('CHẶN');
    }
  });

  test('hạ `full → lite` khi có UNKNOWN ⇒ CHẶN, và nói "đo rồi hạ"', () => {
    const suy = lane.suyLan({ modules: [mod('A', 'UNKNOWN')] });
    const kq = lane.xinDoiLan(suy, 'lite', 'lý do rất dài và đầy đủ ở đây');
    expect(kq.ok).toBe(false);
    expect(kq.vi_sao).toContain('Đo rồi hạ, đừng hạ rồi mới đo');
  });

  test('hạ ở band Medium: KHÔNG lý do ⇒ từ chối; CÓ lý do đủ dài ⇒ cho', () => {
    const suy = lane.suyLan({ modules: [mod('A', 'Medium'), mod('B', 'Low')] });
    expect(lane.xinDoiLan(suy, 'lite', null).ok).toBe(false);
    expect(lane.xinDoiLan(suy, 'lite', 'ngắn').ok).toBe(false);
    const kq = lane.xinDoiLan(suy, 'lite', 'Module này chỉ hiển thị, không có ô nhập nào nên mở rộng không mua thêm gì');
    expect(kq.ok).toBe(true);
  });

  test('ngưỡng lý do khai thành hằng, không rải trong thông điệp', () => {
    expect(lane.TOI_THIEU_LY_DO).toBeGreaterThanOrEqual(20);
  });

  test('làn lạ ⇒ từ chối, nêu hai làn có thật', () => {
    const suy = lane.suyLan({ modules: [mod('A', 'Low')] });
    const kq = lane.xinDoiLan(suy, 'sieu-nhe', 'lý do rất dài và đầy đủ ở đây');
    expect(kq.ok).toBe(false);
    expect(kq.vi_sao).toContain('lite · full');
  });

  test('CLI: hạ làn ở High ⇒ exit 1, file `lane.json` KHÔNG được ghi', () => {
    const t = dungTask([mod('A', 'High')]);
    const r = chay(t.goc, ['--dat', 'lite', '--ly-do', 'một lý do rất dài và đầy đủ để thử']);
    expect(r.status).toBe(1);
    expect(fs.existsSync(path.join(t.taskDir, 'reports', 'lane.json')),
      'từ chối thì không được để lại dấu vết như đã chốt').toBe(false);
  });

  test('CLI: nâng lên full ⇒ ghi `lane.json` kèm làn SUY RA để còn đối chiếu', () => {
    const t = dungTask([mod('A', 'Low')]);
    const r = chay(t.goc, ['--dat', 'full']);
    expect(r.status).toBe(0);
    const j = JSON.parse(fs.readFileSync(path.join(t.taskDir, 'reports', 'lane.json'), 'utf8'));
    expect(j.lan).toBe('full');
    expect(j.lan_suy_ra, 'phải giữ cả làn máy suy ra, để thấy người đã đổi gì').toBe('lite');
    expect(j.luc).toBeTruthy();
  });

  test('CLI: làn đã chốt KHÁC làn suy ra thì phải CẢNH BÁO', () => {
    const t = dungTask([mod('A', 'Low')]);
    chay(t.goc, ['--dat', 'full']);
    const r = chay(t.goc);
    expect(`${r.stdout}`).toContain('khác làn suy ra');
  });

  test('CLI: hạ ở Medium thì nhắc ghi quyết định DÀI HẠN', () => {
    /* Thư mục task bị dọn thì lý do mất theo. `knowledge/decisions/` là nơi nó còn lại. */
    const t = dungTask([mod('A', 'Medium')]);
    chay(t.goc, ['--dat', 'full']);
    const r = chay(t.goc, ['--dat', 'lite', '--ly-do', 'Module chỉ hiển thị, không ô nhập nào nên mở rộng không mua thêm gì']);
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toContain('risk_override');
  });
});

test.describe('@infra lane — làn KHÔNG nới được mức an toàn', () => {
  test('config khai rõ bốn thứ giữ nguyên ở cả hai làn', () => {
    const k = Object.keys(CFG._luat_khong_doi_duoc);
    expect(k.length).toBe(4);
    const all = JSON.stringify(CFG._luat_khong_doi_duoc);
    expect(all).toContain('T0');
    expect(all).toContain('Evidence');
    expect(all).toContain('Rerun');
    expect(all).toContain('Cửa ra');
  });

  test('`lite` KHÔNG có khoá nào tắt evidence hoặc giảm rerun', () => {
    /*
     * Phép kiểm cấu trúc: nếu config có cách KHAI "evidence: false" thì sớm muộn sẽ có người khai. Nên
     * nhánh `lite` chỉ được mang giá trị mô tả, và hai khoá đó phải là chuỗi nói "KHÔNG giảm".
     */
    const lite = CFG.lan.lite;
    expect(String(lite.phase2.evidence)).toContain('KHÔNG giảm');
    expect(String(lite.phase2.rerun)).toContain('KHÔNG giảm');
    expect(typeof lite.phase2.evidence, 'evidence không được là boolean — boolean thì tắt được').toBe('string');
    expect(typeof lite.phase2.rerun).toBe('string');
  });

  test('chỉ `mo_rong_5_truc` là boolean — tức chỉ ĐỘ SÂU bị đổi theo làn', () => {
    for (const [ten, l] of Object.entries(CFG.lan as Record<string, { phase1: Record<string, unknown>; phase2: Record<string, unknown> }>)) {
      const bool = Object.entries(l.phase2).filter(([, v]) => typeof v === 'boolean').map(([k]) => k);
      expect(bool, `làn ${ten} có khoá boolean ngoài mo_rong_5_truc`).toEqual(['mo_rong_5_truc']);
      for (const v of Object.values(l.phase1)) expect(typeof v).toBe('string');
    }
  });

  test('tên config KHÔNG trùng `env_lanes.json` — chữ "làn" đã có nghĩa khác', () => {
    /*
     * `env_lanes.json` dùng "lane" cho làn MÔI TRƯỜNG (biến env nào mỗi phase cần). Đặt cùng tên là
     * tạo một từ hai nghĩa trong cùng thư mục config.
     */
    expect(fs.existsSync(path.join(REPO, '.agent/config/risk_lanes.json'))).toBe(true);
    expect(fs.existsSync(path.join(REPO, '.agent/config/lanes.json')),
      'đặt tên `lanes.json` sẽ trộn hai nghĩa của chữ làn').toBe(false);
    expect(String(CFG._vi_sao_ten_la_risk_lanes)).toContain('env_lanes.json');
  });
});
