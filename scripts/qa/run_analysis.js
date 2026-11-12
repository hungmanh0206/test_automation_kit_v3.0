#!/usr/bin/env node
'use strict';

/*
 * run_analysis.js — LƯỢT CHẠY NÀY CÓ ĐƯỢC DÙNG ĐỂ KẾT LUẬN CHẤT LƯỢNG KHÔNG?
 *
 * VÌ SAO CÓ (v2.5.0 G1.2, nhận của A `qig-qa-automation`). Kit đã có `metrics_collect` (KPI mỗi lượt) và
 * `reliability_index` (độ tin cậy mỗi case), và `summarize_results` tóm tắt MỘT lượt. Không có gì đọc
 * **tỉ lệ BLOCKED** rồi quyết định xem lượt đó còn đủ mẫu số để nói về chất lượng hay chưa.
 *
 * Chuyện này không lý thuyết. Đo 10/10/2026 trên 78 file `testcase-status.json` của repo, trong 11 lượt có
 * từ 20 case trở lên: 4 lượt BLOCKED vượt 20% (20.5 · 21.7 · 22.2 · 28.9%). Ở lượt 28.9%, gần ba trong mười
 * case chưa chạy được — mà "pass rate" vẫn được tính trên phần còn lại rồi đọc như tỉ lệ trên phạm vi.
 *
 * BA VIỆC, mỗi việc một lý do riêng:
 *  ① Dải BLOCKED (ngưỡng ở `.agent/config/run_analysis.json`). Trên 20% ⇒ `--enforce` CHẶN kết luận
 *    chất lượng. Đây KHÔNG phải nói lượt chạy sai; nó nói mẫu số không đủ để phán.
 *  ② Nợ kiểm thử: SKIP vì thao tác PHÁ HUỶ tách riêng khỏi SKIP vì thiếu tiền đề. Hai thứ khác nhau hẳn —
 *    cái sau sẽ tự chạy khi có capability, cái trước thì KHÔNG BAO GIỜ tự chạy.
 *  ③ Xu hướng giữa các lượt, và chỉ so khi **cùng nguồn TC**. Nguồn đổi mà vẫn so số thô thì "pass rate
 *    tăng 4%" có thể chỉ là đã bỏ bớt case khó.
 *
 * Trạng thái lấy từ `verdict_taxonomy.json` (một nguồn), kể cả bảng `synonyms` — dữ liệu thật dùng
 * `BLOCKED` trong khi taxonomy khai `BLOCKED_SETUP`, và `synonyms` đã nối hai cái đó.
 *
 * Dùng:
 *   npm run run:analysis                 # báo cáo (cần TASK context, hoặc --status <file>)
 *   npm run run:analysis:enforce         # BLOCKED vượt dải trên → exit 1
 *   node scripts/qa/run_analysis.js --status <f> [--write] [--history <f>]
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d = '') => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;

const CFG = cfgLoad.napConfigGate({
  duong: path.join(REPO, '.agent/config/run_analysis.json'),
  nhan: 'run_analysis.json',
  phepKiem: 'dải BLOCKED (trên 20% thì KHÔNG kết luận chất lượng), nợ kiểm thử, và luật "chỉ so xu hướng khi cùng nguồn TC"',
  khiThieu: null,
}) || {};

const VT = cfgLoad.napConfigGate({
  duong: path.join(REPO, '.agent/config/verdict_taxonomy.json'),
  nhan: 'verdict_taxonomy.json',
  phepKiem: 'chuẩn hoá trạng thái (gồm bảng `synonyms`: dữ liệu thật dùng `BLOCKED`, taxonomy khai `BLOCKED_SETUP`)',
  khiThieu: null,
}) || {};

/** Chuẩn hoá verdict qua `synonyms` — KHÔNG tự lập bảng ánh xạ ở đây. */
const chuanHoa = (s) => {
  const k = String(s || '').trim().toUpperCase();
  return (VT.synonyms && VT.synonyms[k]) || k;
};

function docStatus() {
  const f = arg('status') || (() => {
    try { return path.join(rc.getTestResultsDir ? rc.getTestResultsDir() : '', 'testcase-status.json'); } catch { return ''; }
  })();
  if (!f || !fs.existsSync(f)) {
    console.error(`[run-analysis] không thấy testcase-status.json (${f || 'chưa có TASK context'}).`);
    console.error('  Truyền `--status <file>`, hoặc đặt TASK_KEY + PROJECT_OUTPUT_DIR.');
    process.exit(2);
  }
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
    console.error(`[run-analysis] ${path.basename(f)} parse lỗi: ${e.message}`);
    process.exit(2);
  }
  return { f, tests: Array.isArray(j.tests) ? j.tests : [], taskKey: j.taskKey || '', at: j.generatedAt || '' };
}

/**
 * Dấu vân tay NGUỒN TC = băm tập `tcId` đã sắp xếp + số case.
 *
 * KHÔNG dùng mtime hay băm file canonical: bản tải lại từ Google Sheet đổi byte mà nội dung không đổi, nên
 * hai cách đó sẽ báo "nguồn đổi" ở MỌI lượt, và luật "chỉ so khi cùng nguồn" sẽ không bao giờ cho so.
 */
function dauVanTay(tests) {
  const ids = tests.map((t) => String(t.tcId || '')).filter(Boolean).sort();
  const h = require('crypto').createHash('sha256').update(ids.join('|')).digest('hex').slice(0, 12);
  return { hash: h, n: ids.length };
}

/*
 * ─── GOM LỖI THEO NGUYÊN NHÂN GỐC (`--nhom`, v2.9.6 N2.1) ────────────────────────────────────────────
 *
 * VÌ SAO. Một lượt chạy 40 case đỏ không phải 40 việc. Thường là 3–4 nguyên nhân, mỗi nguyên nhân kéo
 * theo chục case. Đọc theo từng case thì người sửa đi hết 40 lượt và vẫn không thấy nguyên nhân chung —
 * đây đúng là lõi của `test-report-analyzer` bên A mà `run_report_reader` chưa có.
 *
 * NGUỒN DỮ LIỆU, đo 30/10/2026 trên toàn repo trước khi dựng:
 *   · `testcase-status.json` — 407 case đỏ/chặn, **203 có `failureLayer`**, và **0 ca có trường `error`**;
 *   · `results.json`        — 550 file, **193 file có lỗi**, **286 dòng lỗi** (câu assertion thật).
 * Nên chữ ký phải ghép HAI nguồn: tầng lỗi lấy từ sổ verdict, câu lỗi lấy từ `results.json`. Chỉ dùng
 * một nguồn thì hoặc mất tầng, hoặc mất câu.
 *
 * CHUẨN HOÁ GÌ, VÀ VÌ SAO CHỈ CHỪNG ẤY. Bỏ số, id, đường dẫn tạm, thời gian — những thứ khác nhau giữa
 * hai lượt chạy của CÙNG một lỗi. KHÔNG bỏ mã HTTP: hai lỗi khác nhau cùng trả 500 phải là HAI nhóm,
 * vì gộp chúng là dạy người đọc rằng "500" là một nguyên nhân.
 */
function chuanHoaLoi(s) {
  return String(s || '')
    .split('\n')[0]
    .replace(/^(Error|AssertionError|TimeoutError):\s*/i, '')
    /* đường dẫn tạm và đường dẫn tuyệt đối — khác nhau mỗi lượt, không phải nguyên nhân */
    .replace(/[A-Za-z]:[\\/][^\s"')]+/g, '<đường-dẫn>')
    .replace(/\/tmp\/[^\s"')]+/g, '<đường-dẫn>')
    /* thời gian và mốc */
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/g, '<lúc>')
    .replace(/\b\d+\s?ms\b/gi, '<ms>')
    /* id và mã case — khác nhau giữa các case CÙNG một lỗi */
    .replace(/\b[A-Z][A-Z0-9_]*_TC_\d+\b/g, '<TC>')
    /*
     * Số còn lại, NHƯNG giữ mã HTTP 3 chữ số đứng sau chữ "HTTP"/"status".
     *
     * BẢN ĐẦU CÓ LÍNH GÁC NÀY MÀ NÓ VÔ DỤNG, và chỉ phép kiểm đơn vị trong
     * `tests/fe/infra/run-analysis-nhom.spec.ts` lôi ra: neo `§500§` bị chính lượt `\b\d+\b` bên dưới ăn
     * thành `§<số>§`, nên lượt tháo neo không còn gì để tháo. Hai lỗi trả 500 và 404 ra CÙNG một chữ ký.
     * Đối chứng ở mức bản in thì vẫn xanh (phần còn lại của câu khác nhau) — nên lỗi này chỉ hiện ra ở
     * mức hàm. Vá bằng lookaround chừa đúng chữ số đang nằm trong neo, KHÔNG nới phép chuẩn hoá.
     */
    .replace(/(HTTP|status)\s*(\d{3})/gi, (m, a, b) => `${a} §${b}§`)
    .replace(/(?<!§)\b\d+\b(?!§)/g, '<số>')
    .replace(/§(\d{3})§/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mọi dòng lỗi trong một `results.json`, theo tiêu đề spec. */
function loiTuResults(duong) {
  const ra = new Map();
  let j;
  try { j = JSON.parse(fs.readFileSync(duong, 'utf8')); } catch { return ra; }
  const di = (s) => {
    for (const sp of (s.specs || [])) {
      for (const t of (sp.tests || [])) {
        for (const r of (t.results || [])) {
          if (r.error && r.error.message) ra.set(sp.title, String(r.error.message));
        }
      }
    }
    for (const c of (s.suites || [])) di(c);
  };
  for (const s of (j.suites || [])) di(s);
  return ra;
}

/**
 * MỌI `results.json` của task, gộp lại.
 *
 * Bản đầu chỉ nhìn cạnh sổ verdict và thư mục cha — và nó nối được **0/86** ca, vì file cạnh sổ có
 * **0 dòng lỗi**. Đo 30/10/2026: lỗi thật nằm ở `test-results/runs/<id>/results.json`, mỗi lượt một
 * file; riêng TASK-9004 có **59/126** file mang lỗi. Nhìn một chỗ là nhìn đúng chỗ KHÔNG có gì.
 */
function timResults(duongStatus) {
  const goc = path.dirname(duongStatus);
  const ra = [];
  const di = (d, sau = 0) => {
    if (sau > 3) return;
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p, sau + 1);
      else if (e.name === 'results.json') ra.push(p);
    }
  };
  di(goc);
  return ra;
}

/** Gộp dòng lỗi của NHIỀU `results.json`. Lượt mới ghi đè lượt cũ cho cùng một tiêu đề. */
function loiCuaTask(duongStatus) {
  const ra = new Map();
  for (const f of timResults(duongStatus)) {
    for (const [k, v] of loiTuResults(f)) ra.set(k, v);
  }
  return ra;
}

/*
 * Mã TC trong tiêu đề spec. PHẢI nhận hậu tố chữ: bộ case thật có `APP_HS_TC_078c`, `TC_084b` — và
 * mẫu `TC_\d+\b` bỏ sót đúng những ca đó, làm tỉ lệ nối tụt từ thật xuống 70%.
 */
const RE_TC_TRONG_TIEU_DE = /\b(?:[A-Z][A-Z0-9]*_)*TC_\d+[a-z]?\b/;

/**
 * Gom case đỏ thành nhóm theo chữ ký `<tầng lỗi> ‖ <câu lỗi đã chuẩn hoá>`.
 * Trả `[{ chuKy, tang, cau, tc: [], anh: '' }]`, nhóm lớn nhất trước.
 */
/*
 * BỘ NỐI — dùng chung cho cả phép gom và con số "nối được" in ra.
 *
 * Tách ra vì bản đầu có HAI bản sao logic nối: một trong `gomTheoNguyenNhan`, một trong chỗ đếm của
 * `inNhom`. Hai bản sao thì bản in có thể khai "0 ca nối được" trong khi phép gom đã nối 28 ca — và
 * một con số tự nói sai về chính mình thì tệ hơn là không in.
 */
function boNoi(tests, loiTheoTieuDe) {
  /*
   * MÃ TRẦN TRONG TIÊU ĐỀ, MÃ ĐỦ TRONG SỔ — và bản đầu so bằng-nhau-tuyệt-đối nên trượt sạch.
   *
   * Đo 30/10/2026: TASK-9004 có 39 dòng lỗi, 28 mã TC trong tiêu đề, mà nối được **0/86** ca. Lý do:
   * spec đặt tiêu đề `TC_021` còn sổ ghi `APP_NHANSU_TC_021`. Đó là GIỚI HẠN GIẢ, không phải thiếu dữ
   * liệu — nên vá: mã trần được khớp mã đủ khi và CHỈ KHI sổ có ĐÚNG MỘT ca mang hậu tố ấy. Đo trên 536
   * ca đỏ toàn repo: **0 trường hợp nhập nhằng**, nối 41 → 56 ca.
   *
   * Nhưng nói nốt cho đúng: 8% → **10%**, KHÔNG đổi kết luận. Nguyên nhân chính nằm chỗ khác — ba trong
   * năm task có **0 dòng lỗi** (193 ca đỏ), và không logic nối nào cứu được chỗ không có gì để nối.
   */
  const theoHauTo = new Map();
  for (const t of tests) {
    const h = (String(t.tcId || '').match(/TC_\d+[a-z]?$/) || [])[0];
    if (h) theoHauTo.set(h, (theoHauTo.get(h) || 0) + 1);
  }
  const maTuTieuDe = new Map();
  for (const [tieuDe, msg] of loiTheoTieuDe) {
    const m = (tieuDe.match(RE_TC_TRONG_TIEU_DE) || [])[0];
    if (m && !maTuTieuDe.has(m)) maTuTieuDe.set(m, msg);
  }
  /** Câu lỗi THẬT của một mã TC, hoặc `undefined` nếu không nối được. */
  return (tcId) => {
    const ma = String(tcId || '');
    if (!ma) return undefined;
    if (maTuTieuDe.has(ma)) return maTuTieuDe.get(ma);
    const hau = (ma.match(/TC_\d+[a-z]?$/) || [])[0];
    /* mã trần ⇄ mã đủ: chỉ nhận khi hậu tố là DUY NHẤT trong sổ, nếu không thì thà không nối */
    return hau && theoHauTo.get(hau) === 1 ? maTuTieuDe.get(hau) : undefined;
  };
}

function gomTheoNguyenNhan(tests, loiTheoTieuDe) {
  const nhom = new Map();
  const cauThat = boNoi(tests, loiTheoTieuDe);

  for (const t of tests) {
    const st = String(t.status || '');
    if (!/^(FAIL|TIMED|BLOCK)/i.test(st)) continue;
    const tang = t.failureLayer || (t.steps || []).map((s) => s.failureLayer).find(Boolean) || '(chưa khai tầng)';
    /*
     * Câu lỗi: ưu tiên `results.json` (lỗi thật của Playwright), lùi về `comment` của sổ verdict.
     * Lùi chứ không bỏ, vì 0/407 case có trường `error` trong sổ — bỏ là mất gần hết nhóm.
     */
    /*
     * NỐI THEO MÃ TC RÚT TỪ TIÊU ĐỀ, không bằng `includes` trần. `includes` làm `TC_01` khớp nhầm
     * `TC_010`, và nó cũng không nhận hậu tố chữ (`TC_078c`) — hai lỗi ngược chiều nhau.
     */
    const tho = cauThat(t.tcId) || String(t.comment || '');
    const cau = chuanHoaLoi(tho) || '(không có câu lỗi)';
    const chuKy = `${tang} ‖ ${cau}`;
    if (!nhom.has(chuKy)) nhom.set(chuKy, { chuKy, tang, cau, tc: [], anh: '' });
    const g = nhom.get(chuKy);
    g.tc.push(t.tcId);
    if (!g.anh) g.anh = (t.evidence || [])[0] || ((t.steps || []).flatMap((s) => s.evidence || [])[0] || '');
  }
  return [...nhom.values()].sort((a, b) => b.tc.length - a.tc.length);
}

const khopTinHieu = (s, list) => {
  const t = String(s || '').toLowerCase();
  return (list || []).filter((k) => t.includes(String(k).toLowerCase()));
};

/** `--nhom`: in bản gom theo nguyên nhân gốc rồi thoát. Đây là BÁO CÁO, không phải cửa. */
function inNhom(f, tests, taskKey) {
  const dsRj = timResults(f);
  const loi = loiCuaTask(f);
  const nhom = gomTheoNguyenNhan(tests, loi);
  const soDo = tests.filter((t) => /^(FAIL|TIMED|BLOCK)/i.test(String(t.status || ''))).length;

  console.log(`[run-analysis] ${taskKey || '(không rõ task)'} · ${soDo} case đỏ/chặn → **${nhom.length} nhóm**`);
  console.log(`[run-analysis] câu lỗi: ${dsRj.length} file results.json · ${loi.size} dòng lỗi đọc được`
    + ' — ca không nối được thì lùi về `comment` của sổ');
  if (!soDo) {
    console.log('[run-analysis] 0 case đỏ ⇒ không có gì để gom. Đây KHÔNG phải một kết luận về chất lượng.');
    return 0;
  }

  console.log('');
  for (const [i, g] of nhom.entries()) {
    console.log(`${String(i + 1).padStart(2)}. [${g.tang}] ${g.cau.slice(0, 110)}`);
    console.log(`    ${g.tc.length} case: ${g.tc.slice(0, 8).join(' · ')}${g.tc.length > 8 ? ` … (+${g.tc.length - 8})` : ''}`);
    if (g.anh) console.log(`    ảnh đại diện: ${g.anh}`);
  }

  /* Tỉ lệ nối được — con số quyết định bản gom này đáng tin tới đâu. */
  const cauThat = boNoi(tests, loi);
  const noiDuoc = tests.filter((t) => /^(FAIL|TIMED|BLOCK)/i.test(String(t.status || ''))
    && cauThat(t.tcId) !== undefined).length;

  console.log('\n[run-analysis] ĐỌC ĐÚNG BẢN NÀY — ba giới hạn, đều đo được:');
  console.log(`  ① Nén ${(soDo / nhom.length).toFixed(1)}× (${soDo} ca → ${nhom.length} nhóm). Nén ~1,0× nghĩa là KHÔNG gom được gì.`);
  console.log(`  ② Chỉ ${noiDuoc}/${soDo} ca nối được CÂU LỖI THẬT từ \`results.json\`; số còn lại gom theo`);
  console.log('     `comment` của sổ verdict — mà comment phần lớn là CÂU KHUÔN MẪU, không phải nguyên nhân.');
  console.log('  ③ Vì vậy nhóm to KHÔNG tự nghĩa là một nguyên nhân. Đo 30/10/2026 trên 9 nhóm mẫu: 6 nhóm');
  console.log('     gom sai — nhóm 23 case chỉ chung câu "Lệch kỳ vọng ở N bước", và hai nhóm cùng nghĩa bị');
  console.log('     tách vì lệch một chữ ("trên phạm vi" ≠ "trong phạm vi").');
  console.log('  ④ Và ĐỪNG đọc tỉ lệ nén như điểm chất lượng: vá bộ nối cho TASK-9004 làm nén TỤT');
  console.log('     (57 → 65 nhóm) đúng vì gom ĐÚNG HƠN — câu lỗi thật thì khác nhau, comment khuôn mẫu');
  console.log('     thì gom bừa. Nén cao có thể chỉ nghĩa là đang gom theo câu khuôn mẫu.');
  console.log('');
  console.log('[run-analysis] Nên đây là BẢN NHÌN ĐẦU, KHÔNG phải kết luận: dùng để đoán chỗ đáng soi trước,');
  console.log('[run-analysis] rồi mở ảnh. KHÔNG cửa nào được chặn dựa trên bản gom này.');
  console.log('[run-analysis] Mã HTTP được GIỮ khi chuẩn hoá: hai lỗi cùng trả 500 vẫn là hai nhóm.');
  return 0;
}

function main() {
  const { f, tests, taskKey, at } = docStatus();
  if (flag('nhom')) process.exit(inNhom(f, tests, taskKey));
  if (!tests.length) {
    console.log(`[run-analysis] ${path.basename(f)} có 0 case ⇒ KHÔNG phán được gì. Đây không phải đạt.`);
    process.exit(0);
  }

  const by = new Map();
  for (const t of tests) {
    const s = chuanHoa(t.status);
    by.set(s, (by.get(s) || 0) + 1);
  }
  const n = tests.length;
  const blocked = (by.get('BLOCKED_SETUP') || 0);
  const skip = (by.get('SKIP') || 0) + (by.get('SKIP_SETUP') || 0);
  const tiLeBlocked = blocked / n;
  const band = CFG.blockedBands || { binhThuong: 0.05, neuDauBaoCao: 0.2 };

  const pc = (x) => `${(100 * x).toFixed(1)}%`;
  console.log(`[run-analysis] ${taskKey || '(không rõ task)'} · ${n} case${at ? ` · ${at}` : ''}`);
  console.log(`  verdict: ${[...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · ')}`);

  /* ① DẢI BLOCKED — in NGAY, trước mọi tỉ lệ khác. Đó là điểm của luật này. */
  let chan = false;
  if (tiLeBlocked > band.neuDauBaoCao) {
    console.log(`  ✗ BLOCKED ${blocked}/${n} = ${pc(tiLeBlocked)} VƯỢT ${pc(band.neuDauBaoCao)} ⇒ KHÔNG được kết luận chất lượng từ lượt này.`);
    console.log('    Hơn một phần năm phạm vi chưa chạy được thì "pass rate" là tỉ lệ trên PHẦN CÒN LẠI, không phải trên phạm vi.');
    console.log('    Việc cần làm: dựng capability cho phần BLOCKED, hoặc thu hẹp phạm vi đã khai rồi báo lại mẫu số.');
    chan = true;
  } else if (tiLeBlocked >= band.binhThuong) {
    console.log(`  ⚠ BLOCKED ${blocked}/${n} = ${pc(tiLeBlocked)} (dải ${pc(band.binhThuong)}–${pc(band.neuDauBaoCao)}) ⇒ phải NÊU NGAY ĐẦU báo cáo.`);
    console.log('    Mẫu số đã khuyết đủ để một tỉ lệ pass nghe hay hơn thực tế.');
  } else {
    console.log(`  BLOCKED ${blocked}/${n} = ${pc(tiLeBlocked)} — dưới ${pc(band.binhThuong)}, không cần nêu riêng.`);
  }

  /* ② NỢ KIỂM THỬ — SKIP vì phá huỷ, tách khỏi SKIP vì thiếu tiền đề. */
  const noKt = [];
  for (const t of tests) {
    if (!['SKIP', 'SKIP_SETUP'].includes(chuanHoa(t.status))) continue;
    const hit = khopTinHieu(`${t.comment || ''} ${t.reason || ''}`, (CFG.noKiemThu || {}).signals);
    if (hit.length) noKt.push({ id: t.tcId, hit });
  }
  if (noKt.length) {
    console.log(`  NỢ KIỂM THỬ: ${noKt.length} case SKIP vì thao tác PHÁ HUỶ — khác hẳn SKIP vì thiếu tiền đề, vì nó sẽ KHÔNG tự chạy ở lượt sau.`);
    noKt.slice(0, 10).forEach((x) => console.log(`    ${x.id} (dấu hiệu: ${x.hit.join(', ')})`));
    if (noKt.length > 10) console.log(`    … +${noKt.length - 10}`);
  } else if (skip) {
    console.log(`  ${skip} case SKIP, không case nào mang dấu hiệu thao tác phá huỷ.`);
  } else {
    /*
     * Nói ra thay vì im lặng: đo 10/10/2026 là 0 case SKIP trong toàn bộ 78 file status của repo, nên phép
     * kiểm nợ kiểm thử HIỆN CHƯA GÁC DỮ LIỆU THẬT NÀO. Không in "đạt" cho một phép kiểm không có gì để gác.
     */
    console.log('  0 case SKIP ⇒ phép kiểm "nợ kiểm thử" CHƯA GÁC GÌ ở lượt này (không phải đạt).');
  }

  /* Tín hiệu dữ liệu bẩn — TÍN HIỆU, không phải verdict. */
  const ban = tests.filter((t) => khopTinHieu(t.comment, (CFG.duLieuBan || {}).signals).length);
  if (ban.length) {
    console.log(`  ⚠ ${ban.length} case có dấu hiệu DỮ LIỆU BẨN trong comment ⇒ cả PASS và FAIL ở những case đó đều đáng soi lại.`);
    console.log(`    ${ban.slice(0, 5).map((t) => t.tcId).join(' · ')}${ban.length > 5 ? ` … +${ban.length - 5}` : ''}`);
    console.log('    Đây là TÍN HIỆU để người đọc soi, KHÔNG phải một verdict.');
  }

  /* ③ XU HƯỚNG — chỉ so khi cùng dấu vân tay nguồn TC. */
  const vt = dauVanTay(tests);
  const hFile = path.resolve(arg('history', path.join(REPO, CFG.historyFile || 'knowledge/metrics/run-analysis.jsonl')));
  let truoc = null;
  try {
    const dong = fs.readFileSync(hFile, 'utf8').split('\n').map((d) => d.trim()).filter(Boolean);
    for (let i = dong.length - 1; i >= 0; i -= 1) {
      const r = JSON.parse(dong[i]);
      if (r.taskKey === taskKey) { truoc = r; break; }
    }
  } catch { truoc = null; }

  if (!truoc) {
    console.log('  xu hướng: chưa có lượt trước của task này để so.');
  } else if (truoc.tcHash !== vt.hash) {
    console.log(`  ✗ xu hướng: KHÔNG so được — nguồn TC đã ĐỔI (${truoc.tcN} → ${vt.n} case, dấu vân tay ${truoc.tcHash} → ${vt.hash}).`);
    console.log('    So số thô qua hai nguồn khác nhau thì "pass rate tăng" có thể chỉ là đã bỏ bớt case khó.');
  } else {
    const d = (a, b) => { const x = b - a; return `${x > 0 ? '+' : ''}${x}`; };
    console.log(`  xu hướng (cùng nguồn TC, ${vt.n} case): BLOCKED ${d(truoc.blocked, blocked)} · FAIL ${d(truoc.fail || 0, by.get('FAIL') || 0)} · PASS ${d(truoc.pass || 0, by.get('PASS') || 0)}`);
  }

  if (flag('write')) {
    const rec = {
      at: new Date().toISOString(), taskKey, n, blocked, skip,
      pass: by.get('PASS') || 0, fail: by.get('FAIL') || 0,
      tcHash: vt.hash, tcN: vt.n,
    };
    fs.mkdirSync(path.dirname(hFile), { recursive: true });
    fs.appendFileSync(hFile, `${JSON.stringify(rec)}\n`, 'utf8');
    console.log(`  đã ghi lịch sử: ${path.relative(REPO, hFile).split(path.sep).join('/')}`);
  }

  if (ENFORCE && chan) {
    console.log('\n[run-analysis] ✗ CHẶN — mẫu số không đủ để kết luận chất lượng. Đây không phải "lượt chạy sai", mà là "chưa đủ để phán".');
    process.exit(1);
  }
  console.log(ENFORCE ? '\n[run-analysis] ✓ ĐẠT — tỉ lệ BLOCKED trong dải cho phép.' : '\nChặn được bằng: npm run run:analysis:enforce');
  process.exit(0);
}

module.exports = { dauVanTay, chuanHoa, chuanHoaLoi, boNoi, gomTheoNguyenNhan, loiTuResults, timResults, loiCuaTask, RE_TC_TRONG_TIEU_DE };
if (require.main === module) main();
