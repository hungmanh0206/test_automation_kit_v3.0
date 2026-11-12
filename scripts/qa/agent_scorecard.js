#!/usr/bin/env node
/**
 * agent_scorecard.js — ĐO LỢI THẾ VẬN HÀNH của agent, THEO TỪNG TASK.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Người review (P1): *"Lấy các task mới để đo thời gian hoàn thành, tỷ lệ tự khắc phục, số lần phải hỏi
 * QA, mức độ chính xác và chi phí trên mỗi verdict được xác minh. Đây mới là lý do đầu tư Agent thay vì
 * dùng plugin A."* Kit đã có từng MẢNH nhưng không chỗ nào ghép chúng theo task:
 *   · transcript phiên (mốc giờ, `usage` token, lời gọi `AskUserQuestion`) — `token_audit` chỉ biết phiên
 *     có CHẠY TASK hay không, không biết TASK NÀO;
 *   · `testcase-status.json` — `doiVerdict` (từ PR #59), `failureLayer`, dấu `run`;
 *   · `bug_outcome` — sổ kết cục bug.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * NĂM CHỈ SỐ, mỗi cái kèm ĐỊNH NGHĨA và chỗ nó KHÔNG đo được
 *
 *   ① THỜI GIAN — phút LÀM VIỆC gán cho task: cộng khoảng cách giữa hai sự kiện liên tiếp cùng task trong
 *     một phiên, mỗi khoảng TRẦN 10 phút (dài hơn là người rời máy, không phải agent làm). Kèm khoảng
 *     lịch (sự kiện đầu → cuối) để thấy task kéo dài bao nhiêu ngày.
 *   ② TỰ KHẮC PHỤC — trong các case từng ở trạng thái CHƯA KẾT LUẬN (FAIL tầng script_error/setup_failure,
 *     BLOCKED_*), bao nhiêu được đưa tới verdict kết luận (PASS, FAIL tầng sản phẩm/đặc tả). Nguồn:
 *     `doiVerdict` — CHỈ có ở bản ghi từ 11/11/2026. Bản ghi cũ không có ⇒ KHÔNG PHÁN ĐƯỢC, không phải 0.
 *   ③ HỎI QA — số lời gọi `AskUserQuestion` gán cho task (câu hỏi CHẶN), kèm số lượt người dùng nhắn
 *     (mọi tương tác). Câu hỏi viết trong văn bản trả lời KHÔNG đếm được bằng máy — ghi rõ là chặn dưới.
 *   ④ ĐỘ CHÍNH XÁC — tỉ lệ claim bug bị DEV bác/trùng/đúng thiết kế, từ `bug_outcome`. Chưa có nhãn ⇒
 *     KHÔNG PHÁN ĐƯỢC. Kèm tỉ lệ kit TỰ RÚT trước khi log (đo được, nhưng là chỉ số khác).
 *   ⑤ CHI PHÍ / VERDICT XÁC MINH — token gán cho task chia cho số verdict XÁC MINH ĐƯỢC: PASS/FAIL có step,
 *     có ảnh/video, và `gate:output` không chặn case đó. Token, không quy ra tiền: giá đổi theo model và
 *     theo thời gian, quy đổi là việc của người đọc.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * GÁN SỰ KIỆN VÀO TASK — theo TỪNG TIN NHẮN, không theo phiên
 *
 * Một phiên hay trộn nhiều task và cả việc sửa kit. Gán cả phiên cho task "ghi nhiều nhất" là gán nhầm phần
 * còn lại. Nên: mỗi tool_use nhắc tới `tasks/<KEY>`, `--task <KEY>` hay `TASK_KEY=<KEY>` là một MỐC; tin nhắn
 * sau mốc thuộc task đó trong 30 phút. Quá 30 phút không mốc mới ⇒ "không gán" — và phần đó được ĐẾM ra.
 * KEY chỉ nhận đúng tên thư mục task đang có, không đoán theo mẫu chữ.
 *
 * KHÔNG GHI NỘI DUNG TRANSCRIPT. Cache (`knowledge/metrics/agent-scorecard.cache.json`, gitignore) chỉ có SỐ.
 *
 * Dùng:
 *   node scripts/qa/agent_scorecard.js [--project-output outputs/DEMO] [--task <KEY>] [--json] [--khong-cache]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REPO = path.resolve(__dirname, '..', '..');
const { thuMucTranscript } = require('./token_audit');
const { liet: lietClaim, NHAN, SAI } = require('./bug_outcome');
const outcomeBacklog = require('./bug_outcome_backlog');
const og = require('./output_gate');
const rules = require('./lib/output_rules');

const CUA_SO_PHUT = 30; // tin nhắn sau mốc task bao lâu thì còn thuộc task đó
const TRAN_KHOANG_PHUT = 10; // khoảng lặng dài hơn là người rời máy
const CACHE = path.join(REPO, 'knowledge', 'metrics', 'agent-scorecard.cache.json');
const PHIEN_BAN_CACHE = 3; // đổi khi định nghĩa đếm đổi — cache cũ đếm theo định nghĩa cũ

/* ─────────────────────────────── ① ③ ⑤ — transcript ─────────────────────────────── */

function mauKey(keys) {
  const tron = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|');
  return new RegExp(`(?:tasks[\\\\/]+|--task[ =]+|TASK_KEY=)(${tron})(?![A-Za-z0-9-])`, 'g');
}

async function doPhien(file, re) {
  const theoTask = {};
  const khongGan = { tok: 0, tinNhan: 0 };
  const lay = (k) => (theoTask[k] = theoTask[k] || { phut: 0, dau: null, cuoi: null, hoi: 0, luotNguoi: 0, tokIn: 0, tokOut: 0, tokCacheDoc: 0, tokCacheGhi: 0, tinNhan: 0 });
  let hienTai = null;
  let mocLuc = 0;
  let truocLuc = null;
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line[0] !== '{') continue;
    let rec;
    try { rec = JSON.parse(line); } catch (e) { continue; }
    const luc = Date.parse(rec.timestamp || '') || null;
    const msg = rec.message || {};
    const content = Array.isArray(msg.content) ? msg.content : [];
    /* mốc task từ tool_use */
    let hoiLuotNay = 0;
    for (const b of content) {
      if (!b || b.type !== 'tool_use') continue;
      if (b.name === 'AskUserQuestion') hoiLuotNay += 1;
      /*
       * MỐC = VIỆC CHO TASK, không phải mọi lần nhắc tên task. Đo 11/11/2026 trên chính phiên dựng máy này:
       * chạy `node scripts/qa/tc_semantic.js --task TASK-9001` để PHÁT TRIỂN KIT mà cũng thành mốc, nên 30 phút
       * sửa kit sau đó bị tính vào chi phí của TASK-9001. Mốc chỉ đến từ: GHI vào thư mục task · chạy
       * automation CỦA task (chay.sh/db.sh, playwright.task.config, test:task) · lệnh mang `TASK_KEY=`.
       */
      const inp = b.input || {};
      let s = '';
      if (/^(Write|Edit|NotebookEdit)$/.test(b.name)) s = String(inp.file_path || inp.notebook_path || '');
      else if (/^(Bash|PowerShell)$/.test(b.name)) {
        const cmd = String(inp.command || '');
        if (/chay\.sh|db\.sh|playwright\.task\.config|test:task|TASK_KEY=/.test(cmd)) s = cmd;
      }
      if (!s) continue;
      re.lastIndex = 0;
      let m; let cuoi = null;
      while ((m = re.exec(s))) cuoi = m[1];
      if (cuoi && luc) { hienTai = cuoi; mocLuc = luc; }
    }
    const task = hienTai && luc && (luc - mocLuc) <= CUA_SO_PHUT * 60000 ? hienTai : null;
    /* NGƯỜI THẬT gõ — đo trên phiên lớn nhất: 491 `<task-notification>`, 7 `<ide_opened_file>`, 11 tóm tắt
     * nối phiên, bản ghi `isMeta` đều là tin MÁY gửi, không phải QA trả lời. Bản đầu đếm cả chúng ⇒ "812 lượt
     * người dùng" cho một task. `<pasted_content>` và câu ngắn kiểu "ok" là người thật — giữ. */
    const MAY_GUI = /^(<(system-reminder|task-notification|local-command|ide_opened_file|ide_selection|command-name|command-message|command-args)|This session is being continued|Caveat:)/;
    const vanNguoi = (s) => { const x = String(s || '').trim(); return x && !MAY_GUI.test(x); };
    const laNguoi = rec.type === 'user' && !rec.isMeta && (typeof msg.content === 'string' ? vanNguoi(msg.content)
      : content.some((b) => b && b.type === 'text' && vanNguoi(b.text)));
    const u = msg.usage;
    if (!task) {
      if (u) { khongGan.tinNhan += 1; khongGan.tok += Number(u.input_tokens || 0) + Number(u.output_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0); }
      truocLuc = null;
      continue;
    }
    const t = lay(task);
    if (luc) {
      if (truocLuc && truocLuc.task === task) t.phut += Math.min((luc - truocLuc.luc) / 60000, TRAN_KHOANG_PHUT);
      t.dau = t.dau === null ? luc : Math.min(t.dau, luc);
      t.cuoi = t.cuoi === null ? luc : Math.max(t.cuoi, luc);
      truocLuc = { task, luc };
    }
    t.hoi += hoiLuotNay;
    if (laNguoi) t.luotNguoi += 1;
    if (u) {
      t.tinNhan += 1;
      t.tokIn += Number(u.input_tokens || 0);
      t.tokOut += Number(u.output_tokens || 0);
      t.tokCacheDoc += Number(u.cache_read_input_tokens || 0);
      t.tokCacheGhi += Number(u.cache_creation_input_tokens || 0);
    }
  }
  return { theoTask, khongGan };
}

async function quetTranscript(keys, dungCache) {
  const dir = thuMucTranscript();
  if (!dir) return null;
  const re = mauKey(keys);
  let cache = { phienBan: PHIEN_BAN_CACHE, keys: keys.join(','), phien: {} };
  if (dungCache) {
    try {
      const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
      if (c.phienBan === PHIEN_BAN_CACHE && c.keys === keys.join(',')) cache = c;
    } catch (e) { /* không có cache — quét lại */ }
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  for (const f of files) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    const c = cache.phien[f];
    if (c && c.size === st.size && c.mtimeMs === st.mtimeMs) continue;
    cache.phien[f] = { size: st.size, mtimeMs: st.mtimeMs, ...(await doPhien(p, re)) };
  }
  for (const f of Object.keys(cache.phien)) if (!files.includes(f)) delete cache.phien[f];
  try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch (e) { /* cache best-effort */ }
  const gop = {};
  const khongGan = { tok: 0, tinNhan: 0 };
  for (const ph of Object.values(cache.phien)) {
    khongGan.tok += ph.khongGan.tok; khongGan.tinNhan += ph.khongGan.tinNhan;
    for (const [k, v] of Object.entries(ph.theoTask)) {
      const g = (gop[k] = gop[k] || { phut: 0, dau: null, cuoi: null, hoi: 0, luotNguoi: 0, tokIn: 0, tokOut: 0, tokCacheDoc: 0, tokCacheGhi: 0, tinNhan: 0, soPhien: 0 });
      g.soPhien += 1;
      for (const x of ['phut', 'hoi', 'luotNguoi', 'tokIn', 'tokOut', 'tokCacheDoc', 'tokCacheGhi', 'tinNhan']) g[x] += v[x];
      if (v.dau !== null) g.dau = g.dau === null ? v.dau : Math.min(g.dau, v.dau);
      if (v.cuoi !== null) g.cuoi = g.cuoi === null ? v.cuoi : Math.max(g.cuoi, v.cuoi);
    }
  }
  return { gop, khongGan, soFile: files.length };
}

/* ─────────────────────────────── ② ⑤ — sổ execute ─────────────────────────────── */

const CHUA_KET_LUAN = (st, layer) => /^blocked|^skip_setup/i.test(String(st || '')) || (/^fail/i.test(String(st || '')) && /script_error|setup_failure/.test(String(layer || '')));
const KET_LUAN = (st, layer) => /^pass/i.test(String(st || '')) || (/^fail/i.test(String(st || '')) && /product_bug|api_bug|doc_outdated|spec/.test(String(layer || '')));

function soExecute(po, key) {
  const f = path.resolve(REPO, po, 'tasks', key, 'test-results', 'testcase-status.json');
  if (!fs.existsSync(f)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
  const tests = d.tests || [];
  const g = og.gateTestExecution(d);
  const biChan = new Set();
  for (const p of g.problems || []) { const m = String(p).match(/^([A-Z0-9_]+_TC_\d+)/); if (m) biChan.add(m[1]); }
  const coAnh = (t) => [].concat(t.evidence || [], ...(t.steps || []).map((s) => [].concat(s.evidence || [], s.evidences || []))).some(rules.isVisualEvidence);
  const daChay = tests.filter((t) => /^(pass|fail)/i.test(String(t.status || '')));
  const xacMinh = daChay.filter((t) => (t.steps || []).length && coAnh(t) && !biChan.has(t.tcId));
  /*
   * ② tự khắc phục — chỉ đo được trên bản ghi có `doiVerdict`, và `doiVerdict` KHÔNG lưu tầng lỗi của verdict
   * cũ. Nên chỉ tính hai đường CHẮC là agent tự làm:
   *   · BLOCKED/SKIP_SETUP → kết luận            (tiền đề đã dựng được)
   *   · FAIL → kết luận mà `specDoi === true`     (agent sửa chính spec của nó)
   * FAIL → PASS mà spec KHÔNG đổi có thể là DEV sửa bug hoặc môi trường đổi — KHÔNG tính là tự khắc phục,
   * đếm riêng. Cùng lập trường với `rerun:classify`: máy không gán nguyên nhân nó không đo được.
   */
  const coDoi = tests.filter((t) => t.doiVerdict);
  const tuChan = (t) => /^blocked|^skip_setup/i.test(String(t.doiVerdict.tu || ''));
  const tuFailSuaSpec = (t) => /^fail/i.test(String(t.doiVerdict.tu || '')) && t.doiVerdict.specDoi === true;
  const tungChuaKetLuan = coDoi.filter((t) => tuChan(t) || tuFailSuaSpec(t));
  const daKhacPhuc = tungChuaKetLuan.filter((t) => KET_LUAN(t.status, t.failureLayer));
  const khongRoNguyenNhan = coDoi.filter((t) => /^fail/i.test(String(t.doiVerdict.tu || '')) && t.doiVerdict.specDoi !== true && /^pass/i.test(String(t.status || ''))).length;
  const conChuaKetLuan = tests.filter((t) => CHUA_KET_LUAN(t.status, t.failureLayer));
  return {
    tong: tests.length, daChay: daChay.length, xacMinh: xacMinh.length,
    banGhiMoi: tests.filter((t) => t.run && t.run.evidenceDir).length,
    coDoiVerdict: coDoi.length, tungChuaKetLuan: tungChuaKetLuan.length, daKhacPhuc: daKhacPhuc.length,
    khongRoNguyenNhan, conChuaKetLuan: conChuaKetLuan.length,
  };
}

/* ─────────────────────────────── ④ — sổ kết cục ─────────────────────────────── */

function soKetCuc(po, key) {
  const ds = lietClaim(path.resolve(REPO, po)).filter((c) => c.task === key);
  const daLog = ds.filter((c) => c.claim.status !== 'withdrawn');
  const coNhan = daLog.filter((c) => c.claim.ket_cuc && NHAN[c.claim.ket_cuc.nhan]);
  return { claim: ds.length, tuRut: ds.length - daLog.length, daLog: daLog.length, coNhan: coNhan.length,
    sai: coNhan.filter((c) => SAI.has(c.claim.ket_cuc.nhan)).length };
}

/* ─────────────────────────────── CLI ─────────────────────────────── */

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const kTok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`);

async function main() {
  const a = process.argv.slice(2);
  const lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : ''; };
  const po = lay('--project-output') || process.env.PROJECT_OUTPUT_DIR || 'outputs/DEMO';
  const goc = path.resolve(REPO, po, 'tasks');
  if (!fs.existsSync(goc)) { console.log(`[scorecard] KHÔNG PHÁN ĐƯỢC — không có ${po}/tasks.`); process.exit(2); }
  const keys = fs.readdirSync(goc, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);
  const chon = lay('--task') ? keys.filter((k) => k === lay('--task')) : keys;
  if (!chon.length) { console.log(`[scorecard] KHÔNG PHÁN ĐƯỢC — không có task "${lay('--task')}".`); process.exit(2); }

  const tr = await quetTranscript(keys, !a.includes('--khong-cache'));
  const bang = chon.map((key) => ({ key, phien: tr ? tr.gop[key] || null : null, ex: soExecute(po, key), kc: soKetCuc(po, key) }));

  if (a.includes('--json')) { console.log(JSON.stringify({ bang, khongGan: tr && tr.khongGan, soFile: tr && tr.soFile }, null, 2)); return; }

  console.log(`[scorecard] ${chon.length} task · transcript: ${tr ? `${tr.soFile} phiên` : 'KHÔNG THẤY — ①③⑤ không phán được'}${tr ? ` · ${kTok(tr.khongGan.tok)} token không gán được task nào (sửa kit, việc chung)` : ''}`);
  for (const { key, phien, ex, kc } of bang) {
    console.log(`\n── ${key}`);
    if (phien) {
      const ngay = phien.dau && phien.cuoi ? Math.max(1, Math.round((phien.cuoi - phien.dau) / 864e5)) : 0;
      console.log(`  ① thời gian    ${Math.round(phien.phut / 60 * 10) / 10} giờ làm việc · trải ${ngay} ngày lịch · ${phien.soPhien} phiên`);
      console.log(`  ③ hỏi QA       ${phien.hoi} câu hỏi chặn (AskUserQuestion) · ${phien.luotNguoi} lượt người dùng nhắn — câu hỏi viết trong văn bản KHÔNG đếm được, đây là chặn dưới`);
    } else {
      console.log('  ① ③           KHÔNG PHÁN ĐƯỢC — không có transcript nào gán được cho task này (phiên ở máy hoặc tài khoản khác?)');
    }
    if (ex) {
      console.log(`  ② tự khắc phục ${ex.coDoiVerdict ? `${ex.daKhacPhuc}/${ex.tungChuaKetLuan} case từng chưa kết luận đã đưa tới verdict (${pct(ex.daKhacPhuc, ex.tungChuaKetLuan)})` : 'KHÔNG PHÁN ĐƯỢC'} · ${ex.coDoiVerdict}/${ex.tong} bản ghi có \`doiVerdict\` · ${ex.khongRoNguyenNhan} FAIL→PASS không rõ nguyên nhân (không tính) · ${ex.conChuaKetLuan} case còn chưa kết luận`);
      console.log(`  ⑤ chi phí      ${ex.xacMinh}/${ex.daChay} verdict xác minh được (có step + ảnh, gate:output không chặn)${phien && ex.xacMinh ? ` · mỗi verdict: ra ${kTok(phien.tokOut / ex.xacMinh)} · vào mới ${kTok((phien.tokIn + phien.tokCacheGhi) / ex.xacMinh)} · đọc cache ${kTok(phien.tokCacheDoc / ex.xacMinh)} (giá ba loại khác nhau — không cộng)` : ' · token/verdict KHÔNG PHÁN ĐƯỢC'}`);
    } else {
      console.log('  ② ⑤           KHÔNG PHÁN ĐƯỢC — không có testcase-status.json');
    }
    console.log(`  ④ chính xác    ${kc.coNhan ? `${kc.sai}/${kc.coNhan} claim có nhãn bị bác/trùng/đúng thiết kế (${pct(kc.sai, kc.coNhan)})` : `KHÔNG PHÁN ĐƯỢC — 0/${kc.daLog} claim đã log có nhãn kết cục`} · kit tự rút ${kc.tuRut}/${kc.claim} trước khi log (${pct(kc.tuRut, kc.claim)})`);
  }
  /*
   * ④ TOÀN DỰ ÁN — sổ theo issue Backlog (`bug:outcome:backlog`). Khối theo task ở trên chỉ thấy claim có mã issue
   * (18/119); 79/96 bug QA log không có claim trỏ tới. Không gán bug vào task bằng tên issue cha: đo 11/11/2026,
   * thư mục 9001 không nhắc issue cha "hồ sơ trường" lần nào. Nên in theo issue CHA — đúng thứ Backlog ghi.
   */
  const sb = outcomeBacklog.tinh(outcomeBacklog.docSo());
  if (sb.tong) {
    console.log(`\n── ④ toàn dự án (sổ Backlog, cập nhật bằng \`npm run bug:outcome:backlog\`)`);
    console.log(`  ${sb.tong} bug QA log · ${sb.coNhan} có nhãn · ${sb.coNhan ? `sai ${sb.sai}/${sb.coNhan} (${pct(sb.sai, sb.coNhan)})` : 'KHÔNG PHÁN ĐƯỢC tỉ lệ'} · ${sb.chuaXong} chưa có kết cục · ${sb.canNguoi.length} cần người gắn nhãn`);
    for (const [k, v] of Object.entries(sb.theoCha).sort((x, y) => y[1].tong - x[1].tong)) console.log(`    cha ${k.padEnd(11)} ${v.tong} bug · sai ${v.sai}/${v.coNhan} có nhãn · ${v.chuaXong} chưa xong`);
  } else {
    console.log('\n── ④ toàn dự án: KHÔNG PHÁN ĐƯỢC — chưa có sổ Backlog. Chạy `npm run bug:outcome:backlog`.');
  }
  console.log('\nĐỌC CHO ĐÚNG: số đo trên task CŨ thiếu vế (bản ghi trước 11/11/2026 không có `doiVerdict`, claim chưa có nhãn).');
  console.log('Lợi thế so với plugin A chỉ kết luận được khi CÙNG task được làm bằng cả hai và đo bằng CÙNG định nghĩa này.');
}

if (require.main === module) main().catch((e) => { console.error(`[scorecard] KHÔNG PHÁN ĐƯỢC — lỗi khi đo: ${e && e.message}`); process.exit(2); });
module.exports = { doPhien, soExecute, soKetCuc, mauKey, CHUA_KET_LUAN, KET_LUAN };
