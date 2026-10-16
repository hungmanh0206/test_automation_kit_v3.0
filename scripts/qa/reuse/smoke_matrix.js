#!/usr/bin/env node
'use strict';
/*
 * smoke:matrix — CHẠY BỘ SMOKE QUA NHIỀU TRÌNH DUYỆT × KÍCH THƯỚC, rồi gom BẢNG Ô ĐỎ.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY, và vì sao nó KHÔNG thêm project nào.
 *
 * `playwright.config.js` ĐÃ có lane cross-browser (`CROSS_BROWSER=1` ⇒ firefox-desktop + webkit-desktop)
 * và hai project mobile. Thứ còn thiếu không phải project — là một lượt chạy CÙNG MỘT kịch bản qua cả
 * ma trận rồi trả lời được câu "màn nào vỡ ở nhân nào". Chạy từng lane rồi tự so trong đầu không phải
 * câu trả lời: nó không để lại gì đọc được, và không ai đếm được ô nào chưa chạy.
 *
 * BA ĐIỀU KIỆN THIẾT KẾ, mỗi điều vá một cách bảng này tự biến thành vô nghĩa:
 *
 *   1. **KHÔNG bắc cầu qua ba lớp chặn của `smoke_run`.** Máy này gọi lại `kiemTruocKhiChay()` của nó.
 *      Một máy mới mà đi vòng qua lớp chặn của máy cũ là cách lớp chặn chết lặng lẽ: lần sau không ai
 *      nhớ rằng smoke từng đòi gốc URL tường minh, và ma trận sẽ chạy với host đoán được.
 *
 *   2. **Ô KHÔNG CHẠY phải đếm riêng, không được trông giống ô xanh.** Ký hiệu `▢`. Kit đã trả giá cho
 *      đúng lớp lỗi này: `full:suite` từng đếm cả spec WIP chưa commit, và `rule_coverage` từng đếm theo
 *      đĩa — cả hai đều "có số" nhưng số đó nói về một tập khác tập người đọc tưởng.
 *
 *   3. **Nói thẳng đây là GIẢ LẬP.** WebKit là nhân Safari, không phải iPhone. Báo cáo bắt buộc mang câu
 *      đó, và có test chặn mọi câu kiểu "đã test trên thiết bị thật".
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng:
 *   node scripts/qa/reuse/smoke_matrix.js --spec <file.spec.ts> [--config <browser_matrix.json>]
 *                                         [--out <reports/browser-matrix.md>] [--deep --toi-dong-y-cham-du-lieu]
 * Exit: 0 không ô đỏ · 1 có ô đỏ · 2 bị chặn trước khi chạy / không phán được
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const CFG_MAC_DINH = path.join(REPO, '.agent', 'config', 'browser_matrix.json');

/** Câu bắt buộc trong báo cáo. Đổi chữ ở đây thì test sẽ đỏ — cố ý. */
const CAU_GIA_LAP = 'Playwright là GIẢ LẬP THIẾT BỊ, không phải thiết bị thật. '
  + 'WebKit là nhân Safari — không phải iPhone, không phải iOS.';

/** Ký hiệu ô. `▢` = không chạy, và nó KHÔNG đồng nghĩa với đạt. */
const O = { pass: 'PASS', fail: 'FAIL', bo: '▢' };

function napCauHinh(duong = CFG_MAC_DINH) {
  if (!fs.existsSync(duong)) {
    return { loi: `thiếu \`${path.relative(REPO, duong).split(path.sep).join('/')}\` — không có ma trận thì không có gì để chạy.` };
  }
  let j;
  try { j = JSON.parse(fs.readFileSync(duong, 'utf8')); } catch (e) {
    return { loi: `\`browser_matrix.json\` SAI cú pháp JSON (${e.message}).` };
  }
  const prj = Array.isArray(j.project) ? j.project : [];
  const kt = Array.isArray(j.kich_thuoc) ? j.kich_thuoc : [];
  if (!prj.length || !kt.length) {
    return { loi: 'ma trận phải có ít nhất một `project` và một `kich_thuoc`.' };
  }
  /*
   * `bo_qua` BẮT BUỘC kèm `vi_sao`. Bỏ một ô mà không nói vì sao thì lần sau không ai biết nó bị bỏ vì
   * một lý do còn đúng, hay vì một lần ai đó muốn bảng xanh nhanh.
   */
  for (const b of (j.bo_qua || [])) {
    if (!b.vi_sao) return { loi: `mục \`bo_qua\` cho (${b.project}, ${b.kich_thuoc}) thiếu \`vi_sao\`.` };
  }
  return { project: prj, kich_thuoc: kt, bo_qua: j.bo_qua || [] };
}

/** Danh sách ô của ma trận, kèm cờ `bo` cho ô cố ý không chạy. */
function dungO(cfg) {
  const bo = new Set((cfg.bo_qua || []).map((b) => `${b.project}|${b.kich_thuoc}`));
  const ra = [];
  for (const p of cfg.project) {
    for (const k of cfg.kich_thuoc) {
      ra.push({
        project: p.ten,
        device: p.device,
        nhan: p.nhan || '',
        kich_thuoc: k.ten,
        w: k.w,
        h: k.h,
        ten: `${p.ten}@${k.ten}`,
        bo: bo.has(`${p.ten}|${k.ten}`),
      });
    }
  }
  return ra;
}

/**
 * Config tạm cho một lượt chạy: kế thừa config của task rồi THAY `projects` bằng cả ma trận.
 *
 * Viết ra file thay vì truyền qua tham số dòng lệnh, vì `--project` chỉ CHỌN project có sẵn chứ không
 * tạo được project mới, và viewport thì không có cờ dòng lệnh nào đặt được. Một lượt `playwright test`
 * phủ trọn ma trận cũng rẻ hơn N lượt spawn.
 */
function noiDungConfig(duongConfigTask, oChay) {
  const req = duongConfigTask.split(path.sep).join('/');
  /*
   * `@playwright/test` nhúng bằng ĐƯỜNG DẪN TUYỆT ĐỐI, không bằng tên gói.
   *
   * Config tạm có thể nằm ngoài cây repo (ví dụ khi spec ở thư mục tạm lúc chạy đối chứng), và ở đó
   * `require('@playwright/test')` không phân giải được vì không có `node_modules` nào ở trên nó —
   * MODULE_NOT_FOUND, đo 16/10/2026. Phân giải sẵn từ gốc repo rồi nhúng kết quả.
   */
  let pw = '@playwright/test';
  try { pw = require.resolve('@playwright/test', { paths: [REPO] }).split(path.sep).join('/'); } catch (e) { /* giữ tên gói */ }
  const prj = oChay.map((o) => `  {
    name: ${JSON.stringify(o.ten)},
    use: { ...devices[${JSON.stringify(o.device)}], viewport: { width: ${o.w}, height: ${o.h} } },
  }`).join(',\n');
  return `/* SINH TỰ ĐỘNG bởi smoke_matrix.js — file TẠM, xoá sau mỗi lượt. Đừng sửa tay. */
const { devices } = require(${JSON.stringify(pw)});
const base = require(${JSON.stringify(req)});
module.exports = { ...base, projects: [
${prj}
] };
`;
}

/** Đọc kết quả từ reporter JSON của Playwright thành map `tenO -> {pass,fail}` theo từng test. */
function docKetQua(json) {
  const theoO = new Map();
  const duyet = (suite) => {
    for (const s of (suite.suites || [])) duyet(s);
    for (const sp of (suite.specs || [])) {
      for (const t of (sp.tests || [])) {
        const o = t.projectName || '(không rõ)';
        if (!theoO.has(o)) theoO.set(o, new Map());
        const ok = (t.results || []).length > 0
          && (t.results || []).every((r) => r.status === 'passed' || r.status === 'skipped');
        theoO.get(o).set(sp.title, ok ? O.pass : O.fail);
      }
    }
  };
  for (const s of (json.suites || [])) duyet(s);
  return theoO;
}

/** Bảng markdown: hàng = tên test (màn × vai trò), cột = ô ma trận. */
function gomBang({ o, theoO, spec }) {
  const hang = [...new Set([...theoO.values()].flatMap((m) => [...m.keys()]))].sort();
  const cot = o.map((x) => x.ten);

  const dong = [];
  dong.push('# Ma trận smoke — trình duyệt × kích thước', '');
  dong.push(`> **${CAU_GIA_LAP}**`, '');
  dong.push(`Spec: \`${spec}\` · sinh bởi \`npm run smoke:matrix\` · ${new Date().toISOString().slice(0, 10)}`, '');

  let pass = 0; let fail = 0; let bo = 0;
  dong.push(`| Màn × vai trò | ${cot.join(' | ')} |`);
  dong.push(`|---|${cot.map(() => '---').join('|')}|`);
  for (const h of hang) {
    const o_ = o.map((x) => {
      if (x.bo) { bo += 1; return O.bo; }
      const v = theoO.get(x.ten)?.get(h);
      if (v === O.pass) { pass += 1; return O.pass; }
      if (v === O.fail) { fail += 1; return `**${O.fail}**`; }
      /* Không có kết quả cho ô này ⇒ KHÔNG CHẠY, không phải đạt. */
      bo += 1;
      return O.bo;
    });
    dong.push(`| ${h} | ${o_.join(' | ')} |`);
  }

  dong.push('');
  dong.push(`**Tổng ô:** ${pass + fail + bo} — ${pass} PASS · ${fail} FAIL · ${bo} ▢ (không chạy).`);
  dong.push('');
  dong.push('> `▢` **không** đồng nghĩa với đạt. Nó nghĩa là ô đó chưa có phép đo nào, và đọc nó thành');
  dong.push('> "ổn" đúng là cách một bảng đủ màu xanh che mất vùng chưa ai sờ tới.');
  dong.push('');
  dong.push('## Nhân của từng project');
  dong.push('', '| Project | Nhân |', '|---|---|');
  for (const p of [...new Map(o.map((x) => [x.project, x.nhan])).entries()]) dong.push(`| \`${p[0]}\` | ${p[1]} |`);

  return { md: `${dong.join('\n')}\n`, pass, fail, bo };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const spec = val('spec');

  /* LỚP CHẶN: dùng lại nguyên của `smoke_run`, không viết bản thứ hai. */
  /* eslint-disable-next-line global-require */
  const { kiemTruocKhiChay } = require('./smoke_run.js');
  const r = kiemTruocKhiChay({
    spec,
    deep: argv.includes('--deep'),
    dongY: argv.includes('--toi-dong-y-cham-du-lieu'),
  });
  if (!r.chay) {
    console.error(`[smoke-matrix] CHẶN TRƯỚC KHI CHẠY — ${r.ly_do}`);
    process.exit(2);
  }

  const cfg = napCauHinh(val('config') ? path.resolve(val('config')) : CFG_MAC_DINH);
  if (cfg.loi) { console.error(`[smoke-matrix] KHÔNG PHÁN ĐƯỢC: ${cfg.loi}`); process.exit(2); }

  const o = dungO(cfg);
  const oChay = o.filter((x) => !x.bo);
  if (!oChay.length) { console.error('[smoke-matrix] KHÔNG PHÁN ĐƯỢC: mọi ô đều bị bỏ qua.'); process.exit(2); }

  const specAbs = path.resolve(REPO, spec);
  const cfgTask = path.join(path.dirname(specAbs), 'playwright.task.config.js');
  if (!fs.existsSync(cfgTask)) {
    console.error(`[smoke-matrix] KHÔNG PHÁN ĐƯỢC: thiếu \`playwright.task.config.js\` cạnh spec — chạy \`smoke:gen\` trước.`);
    process.exit(2);
  }

  const cfgTam = path.join(path.dirname(specAbs), `.playwright.matrix.${process.pid}.config.js`);
  fs.writeFileSync(cfgTam, noiDungConfig(cfgTask, oChay), 'utf8');
  const jsonOut = path.join(os.tmpdir(), `smoke-matrix-${process.pid}.json`);

  console.log(`[smoke-matrix] ${oChay.length} ô sẽ chạy, ${o.length - oChay.length} ô bỏ qua (khai trong config).`);
  console.log(`[smoke-matrix] ${CAU_GIA_LAP}`);

  let kq;
  try {
    /*
     * Lọc bằng TÊN FILE, không bằng cả đường dẫn.
     *
     * Tham số vị trí của `playwright test` là REGEX khớp đường dẫn file. Truyền `C:/Users/...` (gạch
     * chuôi) thì trên Windows nó không khớp `C:\Users\...` (gạch ngược), và Playwright chạy 0 test rồi
     * thoát 0 — bảng rỗng, exit 0, trông y như "không có gì đỏ". Đo 16/10/2026.
     *
     * `testDir` đã do config của task ghim, nên tên file là đủ hẹp.
     */
    const loc = path.basename(specAbs).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    kq = spawnSync('npx', ['playwright', 'test', loc, '--config', cfgTam, '--workers=1', '--reporter=json'], {
      cwd: REPO,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 1024 * 1024 * 64,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut },
    });
  } finally {
    try { fs.unlinkSync(cfgTam); } catch (e) { /* đã xoá */ }
  }

  let json = null;
  try { json = JSON.parse(fs.readFileSync(jsonOut, 'utf8')); } catch (e) {
    try { json = JSON.parse(kq.stdout || ''); } catch (e2) { json = null; }
  }
  try { fs.unlinkSync(jsonOut); } catch (e) { /* không sao */ }

  if (!json) {
    console.error('[smoke-matrix] KHÔNG PHÁN ĐƯỢC: không đọc được kết quả JSON của Playwright.');
    console.error((kq.stderr || kq.stdout || '').slice(-600));
    process.exit(2);
  }

  const bang = gomBang({ o, theoO: docKetQua(json), spec });

  /*
   * KHÔNG CÓ HÀNG NÀO ⇒ KHÔNG PHÁN ĐƯỢC, không phải "không có gì đỏ".
   *
   * Lỗ này có thật trong chính máy này: lúc lọc spec sai, Playwright chạy 0 test và thoát 0, nên máy
   * ghi ra một bảng RỖNG rồi exit 0. Một bảng rỗng với exit 0 đọc y hệt một bảng toàn xanh — và đó là
   * lớp lỗi "chưa đo ≠ đạt" mà kit đã vá ở ba chỗ khác.
   */
  if (bang.pass + bang.fail === 0) {
    console.error('[smoke-matrix] KHÔNG PHÁN ĐƯỢC: 0 ô có kết quả — lượt chạy không khớp spec nào.');
    console.error('  Kiểm `--spec` có nằm trong `testDir` của `playwright.task.config.js` không.');
    process.exit(2);
  }

  const out = path.resolve(REPO, val('out') || 'reports/browser-matrix.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bang.md, 'utf8');

  console.log(`[smoke-matrix] ${bang.pass} PASS · ${bang.fail} FAIL · ${bang.bo} ▢ — ${path.relative(REPO, out).split(path.sep).join('/')}`);
  process.exit(bang.fail ? 1 : 0);
}

if (require.main === module) main();

module.exports = { napCauHinh, dungO, docKetQua, gomBang, noiDungConfig, CAU_GIA_LAP, O, CFG_MAC_DINH };
