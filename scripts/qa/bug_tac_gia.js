#!/usr/bin/env node
/**
 * bug_tac_gia.js — TÁCH tỉ lệ bug sai theo AI TẠO bug: agent, người chạy script, hay không rõ.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ FILE NÀY
 *
 * `bug:outcome:backlog` đo tỉ lệ bug QA bị DEV bác, nhưng người và agent dùng CHUNG một tài khoản Backlog, nên con số
 * là của cả hai trộn lại. Không đánh dấu được trên Backlog: chủ dự án không muốn thấy dấu của kit trong mô tả bug
 * (`go_trailer_bug.js` gỡ dòng `[found-by-kit]` sau khi log). Nên dấu nằm ở MÁY QA, hai nguồn:
 *
 *   1. SỔ LÚC TẠO (`knowledge/metrics/bug-tac-gia.jsonl`) — `bug_reporter.js` và `tao_issue_con.js` gọi `ghi()` ngay
 *      sau khi tạo. Cờ `phienAgent` lấy từ biến `CLAUDECODE=1` mà Claude Code đặt cho mọi lệnh agent chạy.
 *   2. TRANSCRIPT của phiên Claude — dựng lại LỊCH SỬ trước khi có sổ: LỆNH TẠO bug nào chạy trong một phiên agent và
 *      in ra mã issue (hoặc ghi mã vào log của đúng lượt đó) thì bug đó do agent tạo. Đo 12/11/2026: 17/96 bug QA.
 *
 * Bug không có ở cả hai nguồn là KHÔNG RÕ — KHÔNG được coi là "người". Nó có thể do người tạo trên web, do một tài
 * khoản Claude khác trên cùng máy, hoặc nằm trong transcript đã bị Claude Code dọn.
 *
 * Dùng:
 *   node scripts/qa/bug_tac_gia.js --quet       quét transcript, ghi bộ nhớ đệm, rồi báo cáo
 *   node scripts/qa/bug_tac_gia.js [--json]     báo cáo từ sổ kết cục + sổ tác giả + bộ nhớ đệm
 * Exit: 0 · 2 khi chưa có sổ kết cục (chạy `bug:outcome:backlog` trước)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REPO = path.resolve(__dirname, '..', '..');
const METRICS = path.join(REPO, 'knowledge', 'metrics');
const SO_TAC_GIA = () => process.env.BUG_TAC_GIA_SO || path.join(METRICS, 'bug-tac-gia.jsonl');
const DEM_TRANSCRIPT = path.join(METRICS, 'bug-tac-gia.transcript.json');
const SO_KET_CUC = path.join(METRICS, 'bug-outcomes-backlog.json');
/* Dòng in ra khi tạo bug THÀNH CÔNG — của `tao_issue_con.js` và bảng kết quả của `bug_reporter.js`. */
const MAU_TAO = [/\[OK\] đã tạo ([A-Z][A-Z0-9]+-\d+)/g, /\|\s*[A-Z0-9_]+_TC_\d+\s*\|\s*([A-Z][A-Z0-9]+-\d+)\s*\|\s*Created\s*\|/g];
const NHOM = ['agent', 'nguoi_qua_script', 'khong_ro'];

const laLoopback = (base) => /^https?:\/\/(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:|\/|$)/i.test(String(base || ''));

/**
 * Ghi một dòng vào sổ tác giả. KHÔNG ném: sổ hỏng không được làm hỏng lượt tạo bug — chỉ cảnh báo.
 * Backlog là loopback (server giả của bộ test) ⇒ bỏ qua: bug tạo trên máy local không phải bug thật.
 */
function ghi({ issueKey, qua, tcId }, { base = process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '', env = process.env } = {}) {
  if (!issueKey || laLoopback(base)) return 'bo-qua';
  try {
    const f = SO_TAC_GIA();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, `${JSON.stringify({ issueKey, qua, tcId: tcId || null, phienAgent: env.CLAUDECODE === '1', luc: new Date().toISOString() })}\n`);
    return 'da-ghi';
  } catch (e) {
    console.warn(`[bug-tac-gia] ⚠ không ghi được sổ tác giả cho ${issueKey}: ${e.message}`);
    return 'loi';
  }
}

function docSoTacGia(f = SO_TAC_GIA()) {
  const ra = new Map();
  if (!fs.existsSync(f)) return ra;
  for (const d of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!d.trim()) continue;
    try { const j = JSON.parse(d); if (j.issueKey && !ra.has(j.issueKey)) ra.set(j.issueKey, j); } catch (e) { /* dòng hỏng: bỏ */ }
  }
  return ra;
}

/** Tìm mã issue được TẠO trong một đoạn kết quả tool. */
function maTaoTrong(text) {
  const ra = [];
  for (const re of MAU_TAO) for (const m of String(text).matchAll(re)) ra.push(m[1]);
  return ra;
}

/*
 * Lệnh CHẠY script tạo bug (không phải đọc mã nguồn của nó, không phải --dry-run).
 *
 * Bản đầu khớp MỌI kết quả tool có dòng "Created" và đếm được 48/96 bug "do agent". Kiểm từng lệnh: 45/50 mã đến từ
 * agent ĐỌC `backlog_bug_log.md` (cat, grep) — đọc một báo cáo không chứng minh ai đã tạo bug. Neo đúng là lệnh
 * tạo, nên giờ chỉ còn 17/96 (đo 12/11/2026).
 */
/* Ba dạng gọi đã gặp: `node …/x.js`, `npm run backlog:bug-report`, và wrapper `bash backlog.sh tao_issue_con` của task
 * (TASK-4137 tạo bằng wrapper — bản đầu của mẫu này bỏ sót nó). */
const LENH_TAO = /(?:node\s+\S*(?:bug_reporter|tao_issue_con)\.js|backlog\.sh\s+(?:bug_reporter|tao_issue_con)\b|npm\s+run\s+(?:-s\s+)?backlog:bug-report(?![:\w-]))/;
const KHO = /--dry-run|:dry-run/;
const laLenhTao = (cmd) => LENH_TAO.test(String(cmd || '')) && !KHO.test(String(cmd || ''));

/** Lượt `bug_reporter` ghi log ở reports/runs/<RUN_ID>/ (hoặc reports/ khi không có RUN_ID). */
function logCuaLenh(cmd) {
  if (!/bug_reporter|backlog:bug-report/.test(cmd)) return null;
  const task = (cmd.match(/--task[ =]([\w-]+)/) || cmd.match(/TASK_KEY=([\w-]+)/) || [])[1];
  if (!task) return null;
  const run = (cmd.match(/--run-id[ =]([\w.-]+)/) || cmd.match(/RUN_ID=([\w.-]+)/) || [])[1];
  const po = ((cmd.match(/PROJECT_OUTPUT_DIR=["']?([^"'\s]+)/) || [])[1] || 'outputs/DEMO').replace(/\\/g, '/').replace(/^.*?(outputs\/)/, '$1');
  return path.join(REPO, po, 'tasks', task, 'reports', ...(run ? ['runs', run] : []), 'backlog_bug_log.md');
}

/**
 * Quét mọi transcript (đọc TỪNG DÒNG: có file > 512 MB, đọc một lần là vỡ). Trả { key: { luc, tep, qua } }.
 * Hai đường, cả hai đều neo vào LỆNH TẠO: mã in ra trong kết quả của chính lệnh đó, hoặc mã trong log của lượt chạy đó
 * (khi kết quả bị chuyển vào file). Log bị lượt sau cùng RUN_ID ghi đè thì đường thứ hai có thể nhận nhầm — hiếm.
 */
async function quetTranscript(thuMuc) {
  const ra = {};
  if (!thuMuc || !fs.existsSync(thuMuc)) return ra;
  const logs = new Map();
  for (const tep of fs.readdirSync(thuMuc).filter((x) => x.endsWith('.jsonl')).sort()) {
    const lenh = new Map();
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(thuMuc, tep), 'utf8'), crlfDelay: Infinity });
    for await (const dong of rl) {
      if (!/bug_reporter|bug-report|tao_issue_con|đã tạo|Created/.test(dong)) continue;
      let j;
      try { j = JSON.parse(dong); } catch (e) { continue; }
      const c = j.message && j.message.content;
      if (!Array.isArray(c)) continue;
      for (const x of c) {
        if (x.type === 'tool_use') {
          const cmd = String((x.input && x.input.command) || '');
          if (!laLenhTao(cmd)) continue;
          lenh.set(x.id, cmd);
          const f = logCuaLenh(cmd);
          if (f && !logs.has(f)) logs.set(f, { luc: j.timestamp || null, tep });
        }
        if (x.type === 'tool_result' && lenh.has(x.tool_use_id)) {
          const t = typeof x.content === 'string' ? x.content : (x.content || []).map((y) => y.text || '').join('\n');
          for (const k of maTaoTrong(t)) if (!ra[k]) ra[k] = { luc: j.timestamp || null, tep, qua: 'kết quả lệnh tạo' };
        }
      }
    }
  }
  for (const [f, v] of logs) {
    if (!fs.existsSync(f)) continue;
    for (const k of maTaoTrong(fs.readFileSync(f, 'utf8'))) if (!ra[k]) ra[k] = { ...v, qua: 'log của lượt chạy' };
  }
  return ra;
}

/** Xếp một bug vào nhóm. Sổ lúc tạo đi trước transcript: nó ghi cờ phiên ngay lúc tạo. */
function nhomCua(key, so, transcript) {
  const s = so.get(key);
  if (s) return s.phienAgent ? 'agent' : 'nguoi_qua_script';
  if (transcript[key]) return 'agent';
  return 'khong_ro';
}

/** Tỉ lệ sai theo nhóm, từ sổ kết cục của `bug:outcome:backlog`. */
function tinhTheoNhom(ketCuc, so, transcript, { NHAN, SAI }, wilson) {
  const ra = Object.fromEntries(NHOM.map((n) => [n, { tong: 0, coNhan: 0, sai: 0, caSai: [] }]));
  for (const [key, v] of Object.entries(ketCuc.issues || {})) {
    const n = ra[nhomCua(key, so, transcript)];
    n.tong += 1;
    if (NHAN[v.nhan]) { n.coNhan += 1; if (SAI.has(v.nhan)) { n.sai += 1; n.caSai.push(key); } }
  }
  for (const n of Object.values(ra)) { n.tiLe = n.coNhan ? n.sai / n.coNhan : null; n.ci95 = wilson(n.sai, n.coNhan); }
  return ra;
}

async function main(argv = process.argv.slice(2)) {
  const lay = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const fKetCuc = lay('--ket-cuc') ? path.resolve(lay('--ket-cuc')) : SO_KET_CUC;
  const fDem = lay('--dem') ? path.resolve(lay('--dem')) : DEM_TRANSCRIPT;
  const { NHAN, SAI } = require('./bug_outcome');
  const { wilson } = require('./pass_audit');
  if (argv.includes('--quet')) {
    const { thuMucTranscript } = require('./token_audit');
    const d = thuMucTranscript();
    if (!d) { console.log('[bug-tac-gia] không thấy thư mục transcript của repo này — giữ bộ nhớ đệm cũ.'); }
    else {
      const tim = await quetTranscript(d);
      fs.mkdirSync(path.dirname(fDem), { recursive: true });
      fs.writeFileSync(fDem, `${JSON.stringify({ quetLuc: new Date().toISOString(), soTep: fs.readdirSync(d).filter((x) => x.endsWith('.jsonl')).length, ma: tim }, null, 1)}\n`);
      console.log(`[bug-tac-gia] quét transcript: ${Object.keys(tim).length} mã issue được tạo trong phiên agent.`);
    }
  }
  let ketCuc;
  try { ketCuc = JSON.parse(fs.readFileSync(fKetCuc, 'utf8')); } catch (e) {
    console.log('[bug-tac-gia] KHÔNG PHÁN ĐƯỢC — chưa có sổ kết cục. Chạy `npm run bug:outcome:backlog` trước.');
    return 2;
  }
  let transcript = {};
  try { transcript = JSON.parse(fs.readFileSync(fDem, 'utf8')).ma || {}; } catch (e) { /* chưa quét */ }
  const so = docSoTacGia();
  const kq = tinhTheoNhom(ketCuc, so, transcript, { NHAN, SAI }, wilson);
  if (argv.includes('--json')) { console.log(JSON.stringify(kq, null, 2)); return 0; }

  const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
  const TEN = { agent: 'agent', nguoi_qua_script: 'người chạy script', khong_ro: 'KHÔNG RÕ' };
  const tong = Object.values(kq).reduce((a, n) => a + n.tong, 0);
  console.log(`[bug-tac-gia] ${tong} bug QA · nguồn: sổ lúc tạo ${so.size} mã · transcript ${Object.keys(transcript).length} mã${Object.keys(transcript).length ? '' : ' (chưa quét: thêm --quet)'}`);
  for (const k of NHOM) {
    const n = kq[k];
    console.log(`  ${TEN[k].padEnd(18)} ${String(n.tong).padStart(3)} bug · ${n.coNhan} có nhãn · ${n.sai} sai · tỉ lệ sai ${pct(n.tiLe)}${n.ci95 ? ` (95%: ${pct(n.ci95[0])}–${pct(n.ci95[1])})` : ''}`);
  }
  console.log('  "KHÔNG RÕ" không phải "người": có thể do người tạo trên web, do tài khoản Claude khác, hoặc nằm trong transcript đã bị dọn.');
  if (kq.khong_ro.tong > tong / 2) console.log('  ⚠ hơn nửa số bug chưa rõ tác giả — đừng đọc chênh lệch giữa các nhóm như một kết luận.');
  return 0;
}

if (require.main === module) main().then((c) => { process.exitCode = c; });
module.exports = { ghi, docSoTacGia, maTaoTrong, quetTranscript, nhomCua, tinhTheoNhom, laLoopback, laLenhTao, logCuaLenh, main };
