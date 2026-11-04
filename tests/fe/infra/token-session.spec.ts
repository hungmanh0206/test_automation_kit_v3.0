/*
 * `token:session` — ĐO PHẦN LUÔN NẠP, VÀ KHÔNG ĐƯỢC PHÁN KHI CHƯA ĐO ĐƯỢC.
 *
 * Phần luôn nạp là thứ MỌI phiên đều trả, kể cả phiên chỉ hỏi một câu: CLAUDE.md + đầu ra hook
 * SessionStart + frontmatter `description` của mọi skill/command/agent mà harness quảng bá.
 *
 * Khối thứ ba là khối dễ quên nhất và đo 04/11/2026 nó LỚN NHẤT: 10,05 trên 16,29 KB, riêng 28 skill
 * chiếm 7,28 KB. Nó không nằm trong `load_map.json` nên `prompt:budget` không thấy nó — tức trước cửa
 * này, một `description` dài thêm một câu làm mọi phiên về sau đắt thêm mà KHÔNG gate nào kêu.
 *
 * MỌI CA CHẠY TRÊN FIXTURE trong thư mục tạm. Bản chép giữ đúng độ sâu `scripts/qa/` so với một gốc
 * có `package.json`, vì cửa giải gốc repo từ `__dirname` — bản chép PHẲNG sẽ đo nhầm cây thật và mọi
 * ca xanh giả. Xem `_may_thu.ts`.
 *
 * ⚠️ `spawn` BẤT ĐỒNG BỘ, không `spawnSync` — cùng khuôn với các spec infra khác của kit.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { gateEnv } from './_gate_env';
import { mayThu } from './_may_thu';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = mayThu('TOKEN_SESSION_JS', path.join(REPO, 'scripts/qa/token_session.js'));

type Dung = {
  claudeMd?: string;
  hook?: string | null;
  skills?: Record<string, string>;
  commands?: Record<string, string>;
  agents?: Record<string, string>;
  nguong?: number | null;
  phaseMax?: Record<string, number> | null;
  loadMap?: unknown;
};

/** Dựng một gốc repo giả đủ để cửa đo được, rồi chép cửa vào đúng `scripts/qa/`. */
function dungGoc(d: Dung): string {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'tokensess-'));
  fs.mkdirSync(path.join(goc, 'scripts', 'qa', 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(goc, 'package.json'), JSON.stringify({ name: 'gia', version: '0.0.0' }), 'utf8');
  fs.copyFileSync(CUA, path.join(goc, 'scripts', 'qa', 'token_session.js'));

  if (d.claudeMd !== undefined) fs.writeFileSync(path.join(goc, 'CLAUDE.md'), d.claudeMd, 'utf8');

  if (d.hook !== null) {
    const noi = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: d.hook ?? 'x' } });
    fs.writeFileSync(
      path.join(goc, 'scripts', 'qa', 'hooks', 'inject_context.js'),
      `process.stdout.write(${JSON.stringify(noi)});\n`,
      'utf8',
    );
  }

  const viet = (thuMuc: string, ds: Record<string, string> | undefined, trongThuMucRieng: boolean) => {
    if (!ds) return;
    const base = path.join(goc, '.claude', thuMuc);
    fs.mkdirSync(base, { recursive: true });
    for (const [ten, mo] of Object.entries(ds)) {
      const than = `---\nname: ${ten}\ndescription: ${mo}\n---\n\nthân.\n`;
      if (trongThuMucRieng) {
        fs.mkdirSync(path.join(base, ten), { recursive: true });
        fs.writeFileSync(path.join(base, ten, 'SKILL.md'), than, 'utf8');
      } else {
        fs.writeFileSync(path.join(base, `${ten}.md`), than, 'utf8');
      }
    }
  };
  viet('skills', d.skills, true);
  viet('commands', d.commands, false);
  viet('agents', d.agents, false);

  const cfgDir = path.join(goc, '.agent', 'config');
  fs.mkdirSync(cfgDir, { recursive: true });
  const cfg: Record<string, unknown> = {};
  if (d.nguong !== null && d.nguong !== undefined) cfg.alwaysOnMaxKB = d.nguong;
  if (d.phaseMax) cfg.phaseMaxKB = d.phaseMax;
  fs.writeFileSync(path.join(cfgDir, 'prompt_budget.json'), JSON.stringify(cfg), 'utf8');
  if (d.loadMap) fs.writeFileSync(path.join(cfgDir, 'load_map.json'), JSON.stringify(d.loadMap), 'utf8');

  return goc;
}

async function chay(goc: string, them: string[] = []): Promise<{ code: number | null; out: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(goc, 'scripts', 'qa', 'token_session.js'), ...them], {
      cwd: goc,
      env: gateEnv(),
    });
    let out = '';
    p.stdout.on('data', (x) => { out += String(x); });
    p.stderr.on('data', (x) => { out += String(x); });
    p.on('close', (code) => ok({ code, out }));
  });
}

/** Một bộ tối thiểu, đủ 5 khối, nhỏ gọn. */
const TOI_THIEU: Dung = {
  claudeMd: 'x'.repeat(100),
  hook: 'y'.repeat(100),
  skills: { mot: 'mô tả một' },
  commands: { hai: 'mô tả hai' },
  agents: { ba: 'mô tả ba' },
};

test.describe.configure({ mode: 'default' });

test.describe('@infra token:session — đếm đúng phần luôn nạp', () => {
  test('ĐỐI CHỨNG ÂM: dưới ngưỡng ⇒ ĐẠT', async () => {
    const r = await chay(dungGoc({ ...TOI_THIEU, nguong: 50 }));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('✓ ĐẠT');
  });

  test('ĐỐI CHỨNG DƯƠNG: vượt ngưỡng ⇒ CHẶN', async () => {
    const r = await chay(dungGoc({ ...TOI_THIEU, nguong: 0.1 }));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('VƯỢT NGƯỠNG');
  });

  /*
   * CA CỐT LÕI. Đây là khối mà `prompt:budget` KHÔNG thấy, nên nếu cửa bỏ sót nó thì cửa vô dụng
   * đúng ở chỗ nó sinh ra để gác. Thêm một description dài phải làm tổng TĂNG.
   */
  test('`description` của skill PHẢI được tính — thêm mô tả dài thì tổng tăng', async () => {
    const it = await chay(dungGoc({ ...TOI_THIEU, nguong: 50 }));
    const nhieu = await chay(dungGoc({
      ...TOI_THIEU,
      skills: { mot: 'mô tả một', hai: 'z'.repeat(3000) },
      nguong: 50,
    }));
    const soKB = (s: string) => Number((s.match(/TỔNG luôn nạp\s+([\d.]+) KB/) || [])[1]);
    expect(soKB(nhieu.out), 'mô tả skill không được tính ⇒ cửa mù đúng chỗ nó sinh ra để gác')
      .toBeGreaterThan(soKB(it.out) + 2.5);
  });

  test('description TRẢI NHIỀU DÒNG vẫn đọc trọn, không cắt ở dòng đầu', async () => {
    const goc = dungGoc({ ...TOI_THIEU, nguong: 50 });
    const f = path.join(goc, '.claude', 'skills', 'mot', 'SKILL.md');
    fs.writeFileSync(f, '---\nname: mot\ndescription: dòng một\n  dòng hai kéo dài thêm rất nhiều chữ nữa\ntools: Bash\n---\n\nthân.\n', 'utf8');
    const r = await chay(goc);
    const kb = Number((r.out.match(/description skill \(1\)\s+([\d.]+) KB/) || [])[1]);
    expect(kb, 'cắt ở dòng đầu thì khối này bị đếm hụt và cửa báo rẻ hơn thực tế').toBeGreaterThan(0.05);
  });
});

test.describe('@infra token:session — không đo được thì KHÔNG phán', () => {
  /*
   * Bài học cửa ⑩ của `version_check.js` ở v2.9.10: trong cây-gói phát hành không có `.claude/`, và
   * một cửa trả "đạt" ở đó là khai một điều nó chưa đo. Lần ấy nó làm `release:verify` đọc thành 13/15.
   */
  test('thiếu `.claude/` (như cây-gói phát hành) ⇒ exit 2, TUYỆT ĐỐI không phải 0', async () => {
    const r = await chay(dungGoc({ claudeMd: 'x'.repeat(100), hook: 'y', nguong: 50 }));
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    expect(r.out).not.toContain('✓ ĐẠT');
  });

  test('chưa khai `alwaysOnMaxKB` ⇒ exit 2, và chỉ đường chốt ngưỡng', async () => {
    const r = await chay(dungGoc({ ...TOI_THIEU, nguong: null }));
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    expect(r.out, 'nói thiếu mà không chỉ cách chốt thì người đọc tự đặt số bừa').toContain('--moc');
  });
});

test.describe('@infra token:session --phase — khối bắt buộc của một luồng', () => {
  const MAP = {
    luong: {
      phase1: { diem_vao: 'a.md', bat_buoc: ['b.md'], co_dieu_kien: [{ file: 'to.md', khi: 'hiếm' }] },
    },
  };

  function gocPhase(nguongPhase: number | null, thieuFile = false) {
    const goc = dungGoc({ ...TOI_THIEU, nguong: 50, phaseMax: nguongPhase === null ? null : { phase1: nguongPhase }, loadMap: MAP });
    fs.writeFileSync(path.join(goc, 'a.md'), 'a'.repeat(2048), 'utf8');
    if (!thieuFile) fs.writeFileSync(path.join(goc, 'b.md'), 'b'.repeat(2048), 'utf8');
    fs.writeFileSync(path.join(goc, 'to.md'), 'c'.repeat(200000), 'utf8');
    return goc;
  }

  test('ĐỐI CHỨNG ÂM: dưới ngưỡng ⇒ ĐẠT, và `co_dieu_kien` KHÔNG bị tính', async () => {
    const r = await chay(gocPhase(10), ['--phase', 'phase1']);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'to.md 195 KB là co_dieu_kien — tính vào là thổi phồng số rồi đi cắt nhầm chỗ')
      .not.toContain('to.md');
  });

  test('ĐỐI CHỨNG DƯƠNG: vượt ngưỡng ⇒ CHẶN', async () => {
    const r = await chay(gocPhase(0.1), ['--phase', 'phase1']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('VƯỢT NGƯỠNG');
  });

  /*
   * File khai trong load_map mà không tồn tại thì TỔNG ĐANG THIẾU. Phán trên một tổng thiếu là tệ hơn
   * im: nó cho một con số nhỏ hơn thực tế, và người đọc kết luận "còn dư chỗ".
   */
  test('file khai trong load_map không tồn tại ⇒ exit 2, không phán trên tổng thiếu', async () => {
    const r = await chay(gocPhase(10, true), ['--phase', 'phase1']);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  });

  test('chưa khai `phaseMaxKB.phase1` ⇒ exit 2', async () => {
    const r = await chay(gocPhase(null), ['--phase', 'phase1']);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  });
});

test.describe('@infra token:session — một thước, không phải hai', () => {
  /*
   * Hệ số ký-tự-mỗi-token phải CÙNG `prompt_budget.js` và `doc_budget.js`. Ba bảng số chỉ so được với
   * nhau khi dùng chung một thước; đổi ở một chỗ là làm cả ba hết so được mà không ai thấy ngay.
   */
  test('hệ số 3,2 ký tự/token khớp `prompt_budget.js`', () => {
    /*
     * ĐỌC `CUA`, KHÔNG đọc `path.join(REPO, ...)`. Bản đầu của ca này đọc đường dẫn repo cố định, nên
     * lượt phá hoại sửa BẢN CHÉP thì nó không thấy gì và cho 0 ca đỏ — một đối chứng RỖNG trông y hệt
     * một đối chứng đạt. Phép phá T7 bắt được đúng chỗ đó.
     */
    const heSo = (duong: string) => {
      const s = fs.readFileSync(duong, 'utf8');
      const m = s.match(/KY_TU_MOI_TOKEN\s*=\s*([\d.]+)/) || s.match(/CHARS_PER_TOK\s*=\s*([\d.]+)/);
      return m ? Number(m[1]) : null;
    };
    expect(heSo(CUA), 'token_session.js phải khai hệ số 3,2').toBe(3.2);
    expect(heSo(path.join(REPO, 'scripts/qa/prompt_budget.js')), 'prompt_budget.js phải khai hệ số 3,2').toBe(3.2);
  });
});
