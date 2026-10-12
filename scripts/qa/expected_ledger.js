#!/usr/bin/env node
'use strict';
/*
 * expected_ledger — CHẶN "đổi expected để case xanh" (non-negotiable §6, tầng T0).
 *
 * VÌ SAO CẦN, và đây là một lỗ được ĐO RA chứ không phải lo xa. Kiểm kê gate ngày 11/10/2026 (v2.7.0 §1)
 * cho thấy §6 có ba vế, và chỉ hai vế có máy:
 *   · "xoá hoặc nới assertion"  → `auto:review` rule `no-assert` (P0) và `vacuous-url`/`vacuous-count`;
 *   · "hardcode data task-specific" → `package:kit` cảnh báo ở cửa phát hành;
 *   · "ĐỔI EXPECTED ĐỂ PASS"    → KHÔNG MÁY NÀO. Sửa cột `Kết quả mong đợi` rồi chạy lại thì case xanh,
 *     và không gì báo. Đây là cách gian lận RẺ NHẤT trong cả kit: một ô, không cần sửa code.
 *
 * `git diff` KHÔNG dùng được ở đây. Testcase của task nằm trong `outputs/**`, mà cây đó bị gitignore
 * (CLAUDE.md §5: output của dự án không vào repo kit). Nên không có bản commit nào để so.
 *
 * Cách làm: CHỤP MỐC rồi so, đúng khuôn `result_ledger` đang dùng cho cột `Result`. Mốc chụp ở thời điểm
 * bộ case được chốt (cửa publish), và từ đó mọi thay đổi expected phải KHAI LÝ DO.
 *
 * KHAI LÝ DO CHỨ KHÔNG PHẢI CẤM ĐỔI. Expected đổi vì spec đổi là chuyện bình thường và hay xảy ra; cấm
 * đổi thì người ta sẽ tắt gate, và tắt gate thì mất luôn phần gác đúng. Thứ phải chặn là đổi expected
 * mà KHÔNG AI BIẾT. Nên hợp đồng là: đổi thì ghi một dòng vào `reports/expected-changes.md`, có mã case
 * và lý do; thiếu dòng đó là CHẶN.
 *
 * Dùng:
 *   node scripts/qa/expected_ledger.js [--task <TASK_KEY>] [--snapshot] [--json]
 *
 * Exit: 0 không đổi, hoặc mọi thay đổi đã khai · 1 có thay đổi CHƯA khai (T0: chặn ở mọi ngữ cảnh)
 *       · 2 không chạy được (thiếu input)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));

const SNAPSHOT = process.argv.includes('--snapshot');
const JSON_OUT = process.argv.includes('--json');
const val = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};

const docAn = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

/*
 * BĂM nội dung expected, không lưu nguyên văn.
 *
 * Hai lý do, và lý do thứ hai mới là lý do chính:
 *   · file mốc gọn, không phình theo bộ 200 case;
 *   · expected của case QEMIS mang tên đơn vị, tên trường, có lúc mang cả tên người — lưu nguyên văn là
 *     tạo thêm một bản sao PII trong `test-results/`. CLAUDE.md §1 cấm tạo file chứa dữ liệu cá nhân, và
 *     "file mốc nội bộ" không phải một ngoại lệ.
 *
 * Đổi lại: khi phát hiện lệch, máy chỉ nói được "case này đổi", không nói được "đổi từ gì sang gì". Đó là
 * đánh đổi CÓ Ý: người mở hai bản ra xem được, còn máy thì không cần biết nội dung để làm việc của nó.
 */
const bam = (s) => crypto.createHash('sha256').update(String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

/** Mọi testcase canonical của task: `*.md` trước, rồi `*.xlsx` cho bộ chưa có Markdown. */
async function docCase(taskOutputDir) {
  const ra = new Map();
  const nguon = [];
  const base = path.join(taskOutputDir, 'test-cases');
  if (fs.existsSync(base)) {
    for (const f of fs.readdirSync(base).filter((x) => x.endsWith('.md') && !x.startsWith('~$'))) {
      const doc = canonical.parseMarkdown(path.join(base, f));
      nguon.push({ file: `test-cases/${f}`, so_case: doc.tests.length });
      for (const t of doc.tests) if (t.tcId) ra.set(t.tcId, t);
    }
  }
  if (!ra.size) {
    for (const d of rc.getTestcaseDirs(taskOutputDir)) {
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.xlsx') && !x.startsWith('~$'))) {
        /* eslint-disable-next-line no-await-in-loop */
        const doc = await canonical.parseXlsx(path.join(d, f));
        nguon.push({ file: path.relative(taskOutputDir, path.join(d, f)).split(path.sep).join('/'), so_case: doc.tests.length });
        for (const t of doc.tests) if (t.tcId) ra.set(t.tcId, t);
      }
    }
  }
  return { cases: ra, nguon };
}

/*
 * ĐỌC LÝ DO ĐÃ KHAI. Một dòng cho một case, dạng:
 *   - TC_012: spec BR-HS-004 đổi ngưỡng từ 30 xuống 20 ngày — xác nhận với BA 11/10
 *
 * Luật về lý do, và nó có răng: lý do phải DÀI hơn một nhãn. "sửa lại", "cập nhật", "theo spec" không
 * nói được điều gì mà người đọc sau không tự đoán ra, nên chúng không được tính. Ngưỡng 20 ký tự là mức
 * thấp nhất mà một câu còn mang được thông tin, và nó cùng ngưỡng với `--reason` của `check --override`.
 */
const TOI_THIEU_LY_DO = 20;
const LY_DO_RONG = /^(sửa|sửa lại|cập nhật|theo spec|update|fix|đã sửa|chỉnh|chỉnh lại)[\s.]*$/i;

function docLyDo(taskOutputDir) {
  const f = path.join(taskOutputDir, 'reports', 'expected-changes.md');
  const txt = docAn(f);
  const ra = new Map();
  for (const d of txt.split(/\r?\n/)) {
    const m = d.match(/^\s*[-*]\s*`?([A-Za-z0-9_.-]+)`?\s*[:：]\s*(.+)$/);
    if (!m) continue;
    const ly = m[2].trim();
    ra.set(m[1].trim(), { ly_do: ly, hop_le: ly.length >= TOI_THIEU_LY_DO && !LY_DO_RONG.test(ly) });
  }
  return { duong: f, co_file: !!txt, theoCase: ra };
}

function soSanh(cu, nay) {
  const doi = [];
  const them = [];
  const mat = [];
  for (const [id, t] of nay) {
    const truoc = cu[id];
    if (!truoc) { them.push(id); continue; }
    if (truoc !== bam(t.expectedRaw)) doi.push(id);
  }
  for (const id of Object.keys(cu)) if (!nay.has(id)) mat.push(id);
  return { doi: doi.sort(), them: them.sort(), mat: mat.sort() };
}

async function main() {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[expected] ✗ không xác định được task: ${e.message}`);
    console.error('           Cần TASK_KEY + PROJECT_OUTPUT_DIR (hoặc --task <TASK_KEY>).');
    process.exit(2);
  }

  const MOC = path.join(taskOutputDir, 'test-results', 'expected-ledger.json');
  const { cases, nguon } = await docCase(taskOutputDir);

  if (!cases.size) {
    /* Mẫu số 0 thì KHÔNG được báo đạt. Không có case để so khác hẳn "không case nào đổi". */
    if (JSON_OUT) { console.log(JSON.stringify({ trang_thai: 'CHUA_GAC_DUOC', vi_sao: 'không đọc được case nào', task: taskKey }, null, 2)); return; }
    console.log(`[expected] CHƯA ĐƯỢC GÁC — không đọc được case nào trong ${path.join(taskOutputDir, 'test-cases')}.`);
    console.log('           Đây KHÔNG phải "không có gì đổi": chưa có gì được đem ra so.');
  /*
   * EXIT 2 = "KHÔNG PHÁN ĐƯỢC", theo convention đã có của kit (`gates:index:check` dùng đúng mã này).
   *
   * Bản đầu exit 0 ở nhánh này, và CỬA RA phơi ra chỗ sai ngay lượt chạy thật đầu tiên: bảng của
   * `exit:gate` in dấu ✓ cho máy này, ngay dưới dòng chính nó vừa nói "đây KHÔNG phải là đạt". Một máy
   * nói đúng bằng chữ mà trả sai bằng mã thì mọi thứ ĐỌC MÃ sẽ hiểu ngược — và cửa ra là thứ đọc mã.
   */
    process.exit(2);
  }

  let cu = null;
  if (fs.existsSync(MOC)) {
    try { cu = JSON.parse(docAn(MOC)); } catch (e) { cu = null; }
  }

  if (SNAPSHOT) {
    const bang = {};
    for (const [id, t] of cases) bang[id] = bam(t.expectedRaw);
    fs.mkdirSync(path.dirname(MOC), { recursive: true });
    fs.writeFileSync(MOC, `${JSON.stringify({
      _la_gi: 'Mốc BĂM của cột `Kết quả mong đợi` theo từng case. Dùng để chặn "đổi expected để pass" (§6).',
      _khong_luu_nguyen_van: 'Chỉ lưu băm: expected mang tên đơn vị, tên trường, có lúc cả tên người. Lưu nguyên văn là tạo thêm một bản sao PII.',
      _chup_lai_khi_nao: 'Sau khi đã RÀ và khai lý do cho mọi thay đổi. Chụp để che một thay đổi chưa khai là đúng thứ gate này gác.',
      task: taskKey,
      chup_luc: new Date().toISOString(),
      so_case: cases.size,
      nguon,
      expected: bang,
    }, null, 2)}\n`, 'utf8');
    console.log(`[expected] đã chụp mốc ${cases.size} case → ${path.relative(REPO, MOC)}`);
    return;
  }

  if (!cu || !cu.expected) {
    if (JSON_OUT) { console.log(JSON.stringify({ trang_thai: 'CHUA_CO_MOC', so_case: cases.size, task: taskKey }, null, 2)); return; }
    console.log(`[expected] CHƯA CÓ MỐC — ${cases.size} case đọc được, nhưng chưa có gì để so.`);
    console.log(`           Chụp mốc bằng: node scripts/qa/expected_ledger.js --task ${taskKey} --snapshot`);
    console.log('           Chụp ở thời điểm bộ case được CHỐT (cửa publish). Chụp sau khi đã sửa expected thì');
    console.log('           mốc mang luôn bản đã sửa, và gate này thành đồ trang trí.');
    console.log('[expected] Đây KHÔNG phải là đạt.');
    process.exit(2);
  }

  const kq = soSanh(cu.expected, cases);
  const lyDo = docLyDo(taskOutputDir);
  const chuaKhai = [];
  const khaiRong = [];
  const daKhai = [];
  for (const id of kq.doi) {
    const l = lyDo.theoCase.get(id);
    if (!l) { chuaKhai.push(id); continue; }
    if (!l.hop_le) { khaiRong.push({ tcId: id, ly_do: l.ly_do }); continue; }
    daKhai.push({ tcId: id, ly_do: l.ly_do });
  }

  const ra = {
    task: taskKey, so_case: cases.size, chup_luc: cu.chup_luc,
    ...kq, da_khai: daKhai, chua_khai: chuaKhai, khai_rong: khaiRong,
    duong_khai: path.relative(REPO, lyDo.duong).split(path.sep).join('/'),
  };
  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); process.exit(chuaKhai.length || khaiRong.length ? 1 : 0); }

  console.log(`[expected] task ${taskKey} · ${cases.size} case · mốc chụp ${String(cu.chup_luc).slice(0, 19)}`);
  if (kq.them.length) console.log(`           + ${kq.them.length} case MỚI (chưa có trong mốc): ${kq.them.slice(0, 6).join(', ')}${kq.them.length > 6 ? ' …' : ''}`);
  if (kq.mat.length) console.log(`           - ${kq.mat.length} case BIẾN MẤT khỏi bộ: ${kq.mat.slice(0, 6).join(', ')}${kq.mat.length > 6 ? ' …' : ''}`);
  if (daKhai.length) {
    console.log(`           ✓ ${daKhai.length} case đổi expected ĐÃ khai lý do:`);
    for (const d of daKhai.slice(0, 6)) console.log(`               ${d.tcId}: ${d.ly_do.slice(0, 80)}`);
  }

  if (!kq.doi.length) {
    console.log('[expected] ✓ ĐẠT — không case nào đổi `Kết quả mong đợi` so với mốc.');
    return;
  }
  if (!chuaKhai.length && !khaiRong.length) {
    console.log('[expected] ✓ ĐẠT — mọi thay đổi expected đều đã khai lý do.');
    return;
  }

  console.log('');
  if (chuaKhai.length) {
    console.log(`[expected] ✗ CHẶN: ${chuaKhai.length} case đổi \`Kết quả mong đợi\` mà KHÔNG khai lý do:`);
    for (const id of chuaKhai.slice(0, 15)) console.log(`             ${id}`);
    if (chuaKhai.length > 15) console.log(`             … (+${chuaKhai.length - 15})`);
  }
  if (khaiRong.length) {
    console.log(`[expected] ✗ CHẶN: ${khaiRong.length} case khai lý do RỖNG NGHĨA (dưới ${TOI_THIEU_LY_DO} ký tự, hoặc chỉ là "sửa lại"):`);
    for (const k of khaiRong.slice(0, 8)) console.log(`             ${k.tcId}: "${k.ly_do}"`);
  }
  console.log('');
  console.log(`  Khai vào \`${ra.duong_khai}\`, một dòng một case:`);
  console.log('    - TC_012: spec BR-HS-004 đổi ngưỡng từ 30 xuống 20 ngày — đã xác nhận với BA ngày 11/10');
  console.log('');
  console.log('  ĐÂY KHÔNG PHẢI THỦ TỤC. Đổi expected là cách gian lận RẺ NHẤT trong cả kit: một ô, không cần');
  console.log('  sửa code, và case đỏ thành xanh. Luật không cấm đổi — expected đổi vì spec đổi là chuyện');
  console.log('  bình thường. Thứ bị chặn là đổi mà KHÔNG AI BIẾT.');
  console.log('  Rà xong và khai xong thì chụp lại mốc bằng `--snapshot`.');
  process.exit(1);
}

if (require.main === module) {
  main().catch((e) => { console.error(`[expected] ✗ lỗi: ${e.message}`); process.exit(2); });
}

module.exports = { bam, soSanh, docLyDo, TOI_THIEU_LY_DO, LY_DO_RONG };
