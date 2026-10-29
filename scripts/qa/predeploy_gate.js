#!/usr/bin/env node
'use strict';
/*
 * predeploy — CHỐT TIỀN-ĐẨY: không bao giờ phát hành khi bảng gate đang lệch nguồn.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY — hai lần vấp liên tiếp, của chính tác giả nó.
 *
 *   · **v2.9.0 ra mắt khi `gates:index:check` đang ĐỎ.** `.agent/config/GATES.md` thiếu 12 dòng gate.
 *     `release:verify` chạy `gate:policy` và `skills:index` nhưng KHÔNG chạy `gates:index:check`, nên
 *     "15/15 bước đạt" không hề nói gì về bảng gate.
 *   · **v2.9.1 suýt lặp lại.** Lần đó tôi có chạy `gates:index:check` — ở CÂY LÀM VIỆC. Nó trả
 *     "KHÔNG PHÁN ĐƯỢC" (exit 2) vì có file WIP chưa commit, và tôi đọc im lặng đó thành "không sao".
 *     Chỉ khi chạy trong worktree sạch tại HEAD nó mới CHẶN — lệch đúng một dòng.
 *
 * Nên chốt này KHÔNG chạy tại chỗ. Nó dựng **worktree sạch tại HEAD** rồi đo ở đó.
 *
 * Máy của người dùng kit này gần như luôn có vài file WIP, nên "chạy tại chỗ" đồng nghĩa với "gần như
 * không bao giờ phán được" — và một cửa không bao giờ phán được là một cửa không tồn tại.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/predeploy_gate.js [--json]
 * Exit: 0 đạt · 1 có cửa CHẶN · 2 không phán được (không có git, không dựng được worktree)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');

/**
 * Cửa phải xanh TRƯỚC khi đóng gói.
 *
 * Cố ý HẸP: chỉ những cửa đo "tài liệu sinh từ nguồn đã lệch chưa" — lớp lỗi đã làm hai bản liên tiếp
 * ra mắt khi đang đỏ. Không nhét cả `static-check` vào đây: `release:verify` đã chạy phần của nó, và
 * một chốt chạy 20 phút là chốt người ta tìm cách bỏ qua.
 */
const CUA = [
  { ten: 'gates:index:check', file: 'scripts/qa/gate_index.js', args: ['--check'] },
  { ten: 'rule:coverage:check', file: 'scripts/qa/rule_coverage.js', args: ['--check'] },
  /*
   * `rule:consistency` vào đây (28/10/2026) vì nó cùng HỌ với hai cửa trên: cả ba canh "tài liệu khớp
   * nguồn", và cả ba chỉ đáng tin khi đo ở CÂY SẠCH. Lý do cụ thể: luật evidence đổi sang mức B ngày
   * 22/10 mà 14 dòng ở 12 file vẫn dạy luật cũ — trong đó một máy gác còn đang CƯỠNG CHẾ luật cũ. Phát
   * hành một gói dạy hai luật trái nhau thì người nhận làm theo cái nào cũng có cửa chặn họ.
   */
  { ten: 'rule:consistency', file: 'scripts/qa/rule_consistency.js', args: [] },
];

function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e) { return null; }
}

/** Dựng worktree sạch tại HEAD. Trả `{ duong }` hoặc `{ loi }`. */
function dungCaySach() {
  const sha = headSha();
  if (!sha) return { loi: 'không đọc được HEAD (thiếu .git hoặc thiếu git) — không dựng được cây sạch để đo.' };
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'predeploy-'));

  /*
   * THỬ LẠI khi `git worktree add` vấp — và đây KHÔNG phải "chạy lại tới khi may mắn".
   *
   * git ghi `.git/worktrees` dưới một khoá dùng chung. Hai tiến trình cùng dựng worktree thì một bên
   * trượt, và lỗi đó TRANSIENT: lần sau là được, không phải "HEAD có vấn đề".
   *
   * Đo 16/10/2026: `predeploy` chạy riêng thì xanh, nhưng ĐỎ trong `full:suite` — vì spec của nó và
   * `prompt-budget.spec.ts` đều dựng worktree sạch, và suite chạy `--workers=2`. Nếu không thử lại,
   * một lỗi khoá của git sẽ bị báo thành "chốt tiền-đẩy không phán được", tức đổ lỗi sai chỗ.
   *
   * Thử có TRẦN (3 lần) và vẫn hỏng thì NÓI RA, không im: khác hẳn vòng lặp vô hạn chờ may mắn.
   */
  let r = null;
  for (let i = 0; i < 3; i += 1) {
    r = spawnSync('git', ['worktree', 'add', '-q', '--detach', d, sha], { cwd: REPO, encoding: 'utf8' });
    if (r.status === 0) return { duong: d, sha };
    /* Nghỉ ngắn, chặn đồng bộ: máy này là CLI, không có vòng lặp sự kiện nào để nhường. */
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 300)'], { encoding: 'utf8' });
  }
  return { loi: `không dựng được worktree sau 3 lần: ${(r.stderr || r.stdout || '').trim().slice(0, 200)}` };
}

function donCaySach(d) {
  try { spawnSync('git', ['worktree', 'remove', '--force', d], { cwd: REPO, encoding: 'utf8' }); } catch (e) { /* kệ */ }
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* kệ */ }
}

function chayCua(cay) {
  const ra = [];
  for (const c of CUA) {
    const r = spawnSync(process.execPath, [path.join(cay, c.file), ...c.args], {
      cwd: cay, encoding: 'utf8', env: { ...process.env, PROJECT_OUTPUT_DIR: 'outputs/_predeploy', TASK_KEY: 'PRE-0' },
    });
    ra.push({
      ten: c.ten,
      ma: r.status,
      /* exit 2 = KHÔNG PHÁN ĐƯỢC. Ở cây sạch thì nó KHÔNG được phép xảy ra — xem `main`. */
      out: `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-3).join(' | ').slice(0, 300),
    });
  }
  return ra;
}

function main() {
  const cay = dungCaySach();
  if (cay.loi) {
    console.error(`[predeploy] KHÔNG PHÁN ĐƯỢC: ${cay.loi}`);
    process.exit(2);
  }

  let kq;
  try { kq = chayCua(cay.duong); } finally { donCaySach(cay.duong); }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ sha: cay.sha, cua: kq }, null, 2));
  } else {
    console.log(`[predeploy] đo ở CÂY SẠCH tại HEAD ${String(cay.sha).slice(0, 8)} — không đo ở cây làm việc.`);
    for (const c of kq) console.log(`  ${c.ma === 0 ? '✓' : '✗'} ${c.ten} (exit ${c.ma})`);
  }

  /*
   * exit 2 ở CÂY SẠCH là bất thường, và phải coi là KHÔNG PHÁN ĐƯỢC chứ không phải đạt.
   *
   * Ở cây làm việc, exit 2 nghĩa là "có file WIP nên chưa kết luận được" — hợp lý. Ở cây sạch thì không
   * có WIP nào, nên exit 2 nghĩa là máy đó hỏng. Cho qua ở đây là tái lập đúng lỗ của v2.9.1.
   */
  const khongPhan = kq.filter((c) => c.ma === 2);
  if (khongPhan.length) {
    console.error(`\n[predeploy] KHÔNG PHÁN ĐƯỢC: ${khongPhan.length} cửa trả exit 2 ở CÂY SẠCH — bất thường.`);
    for (const c of khongPhan) console.error(`  - ${c.ten}: ${c.out}`);
    process.exit(2);
  }

  const do_ = kq.filter((c) => c.ma !== 0);
  if (do_.length) {
    console.error(`\n[predeploy] ✗ CHẶN PHÁT HÀNH — ${do_.length} cửa ĐỎ ở HEAD:`);
    for (const c of do_) console.error(`  - ${c.ten}: ${c.out}`);
    console.error('\n  v2.9.0 đã ra mắt khi `gates:index:check` đỏ, và `release:verify` không bắt được.');
    console.error('  Sinh lại tài liệu (`npm run gates:index` / `npm run rule:coverage`) rồi COMMIT, rồi chạy lại.');
    process.exit(1);
  }

  console.log('\n[predeploy] ✓ ĐẠT — bảng gate và bản đồ luật khớp nguồn ở HEAD.');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { CUA, dungCaySach, donCaySach, chayCua };
