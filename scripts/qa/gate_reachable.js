#!/usr/bin/env node
/**
 * gate:reachable — mỗi MÁY có nằm trên một ĐƯỜNG CHẠY THẬT không?
 *
 * Dùng: node scripts/qa/gate_reachable.js [--enforce] [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Người review 11/11/2026: *"chưa khép kín toàn bộ các kiểm tra đó thành một quy trình end-to-end"*.
 * Đo lại thì đúng, và chỗ hỏng cụ thể hơn lời phê bình: `exec:proof`, `write:proof`, `setup:proof`
 * **không được gọi từ đâu cả**. Chúng chỉ xuất hiện ở `GATES.md` (danh mục TỰ SINH), trang thư viện,
 * `package.json` và spec của chính chúng.
 *
 * `gate:policy` vẫn ĐẠT, vì luật của nó là "mọi npm script phải được NHẮC TỚI ở đâu đó". Ba bề mặt
 * trên đều tính là "nhắc tới". Nhưng:
 *   · danh mục TỰ SINH nhắc tới mọi máy theo định nghĩa — nó không chứng minh gì;
 *   · trang thư viện là chỗ TRA CỨU, không phải chỗ chạy;
 *   · spec chứng minh máy **chạy được**, không chứng minh **có ai chạy**.
 *
 * Nên cửa này hỏi câu khác hẳn: có LỆNH, WORKFLOW, SKILL, PROMPT, CI, hay một npm script khác nào
 * GỌI nó không.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VẾ ÂM ĐÁNG TIN, VẾ DƯƠNG CHỈ LÀ CHẶN TRÊN — đọc con số cho đúng
 *
 * Không tên nào xuất hiện trên mọi bề mặt chạy ⇒ **chắc chắn** không ai chạy nó.
 * Có xuất hiện ⇒ chỉ là CHẶN TRÊN: một cái tên nằm trong câu văn giải thích cũng tính là "có", dù
 * không phải một lời gọi. Gộp hai vế thành "x% máy đã nối" là nói quá.
 *
 * MỨC BÁO CÁO. Đo 11/11/2026: 18/242 script không có đường chạy. Làm đỏ cả 18 ngay thì cửa bị tắt
 * trong một ngày — cùng tiền lệ với `_truoc_la_canh_bao` của `handoff.json`. `--enforce` chặn khi
 * vượt `MOC`, và mốc chỉ hạ khi đã nối thật.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const JSONRA = process.argv.includes('--json');
const ENFORCE = process.argv.includes('--enforce');

/*
 * MỐC = SỐ ĐÃ ĐO, không phải số mong muốn. Đo 11/11/2026 trên cây thật: **26**.
 *
 * Trong 26 đó có 5 bản `:enforce` (`expected:check:enforce`, `replay:check:enforce`,
 * `bug:outcome:enforce`, `skills:template:check:enforce`, và chính `gate:reachable:enforce`). Chúng
 * mồ côi một cách khá hợp lý — bản `:enforce` sinh ra để người siết tay chạy. Nhưng KHÔNG loại chúng
 * khỏi phép đếm: `self-review:enforce` và `prompt:budget --enforce` thì CÓ được gọi thật, nên "hễ là
 * :enforce thì bỏ qua" là một luật sai. Để nguyên trong mẫu số và nói ra, hơn là lọc cho số đẹp.
 *
 * Hạ khi nối thật, KHÔNG nâng để cho xanh.
 */
const MOC = 26;

/* Bề mặt mà một máy thật sự được GỌI RA. */
const DUONG_CHAY = /^(\.claude\/commands|\.agent\/(workflows|skills|rules)|prompt_templates|partial-rerun|exploratory|manual-run|\.github|scripts)\//;
const GOC_CHAY = new Set(['.gitlab-ci.yml', 'CLAUDE.md', 'RULE_GLOBAL.md']);
/* KHÔNG tính: danh mục tự sinh, trang tra cứu, và spec của chính máy. */
const laChay = (f) => (DUONG_CHAY.test(f) || GOC_CHAY.has(f)) && !/^scripts\/qa\/hooks\/README/.test(f);

function dsFile() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\0').filter(Boolean);
  } catch (e) { return null; }
}

const tatCa = dsFile();
if (!tatCa) {
  console.log('[reachable] KHÔNG PHÁN ĐƯỢC — không chạy được `git ls-files`.');
  console.log('  Đây KHÔNG phải là đạt: không có danh sách file thì không biết máy nào được gọi ở đâu.');
  process.exit(2);
}

/* eslint-disable-next-line global-require */
const scripts = require(path.join(REPO, 'package.json')).scripts || {};
const ten = Object.keys(scripts);
if (!ten.length) {
  console.log('[reachable] KHÔNG PHÁN ĐƯỢC — `package.json` không khai script nào.');
  process.exit(2);
}

const vanBan = {};
for (const f of tatCa.filter((x) => laChay(x) && /\.(md|js|mjs|ts|ya?ml|sh|json)$/.test(x))) {
  try { vanBan[f] = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { /* bỏ file đọc không được */ }
}
if (Object.keys(vanBan).length < 50) {
  console.log(`[reachable] KHÔNG PHÁN ĐƯỢC — chỉ đọc được ${Object.keys(vanBan).length} bề mặt chạy, quá ít để kết luận.`);
  process.exit(2);
}

/* File CHÍNH của một script, đọc thẳng từ chuỗi lệnh trong `package.json`. Bỏ nó ra khỏi phép tìm,
 * vì một máy nhắc tên chính nó trong header không phải một lời gọi.
 *
 * (Chú thích này KHÔNG được chứa dấu sao-sao-gạch: nó đóng khối comment giữa chừng. Bản đầu viết
 * đường dẫn glob vào đây và file chết ngay dòng sau.) */
const fileChinh = (k) => {
  const m = String(scripts[k] || '').match(/([A-Za-z0-9_./-]+\.m?js)/);
  return m ? m[1].replace(/^\.\//, '') : null;
};

const moCoi = [];
for (const k of ten) {
  const minh = fileChinh(k);
  /* npm script khác gọi nó: `npm run <k>` hoặc `… && <k>` trong chuỗi lệnh. */
  const npmGoi = ten.some((x) => x !== k && new RegExp(`(^|\\s)(run\\s+)?${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|&)`).test(scripts[x]));
  if (npmGoi) continue;
  const noiGoi = Object.keys(vanBan).filter((f) => f !== minh && vanBan[f].includes(k));
  if (!noiGoi.length) moCoi.push(k);
}

const ra = {
  tong_script: ten.length,
  be_mat_chay: Object.keys(vanBan).length,
  khong_co_duong_chay: moCoi.length,
  moc: MOC,
  danh_sach: moCoi,
  _luu_y: 'Vế ÂM đáng tin (không xuất hiện ⇒ chắc chắn không ai chạy). Vế DƯƠNG chỉ là chặn trên: một cái tên nằm trong câu văn giải thích cũng tính là "có".',
};

if (JSONRA) {
  console.log(JSON.stringify(ra, null, 2));
  process.exit(ENFORCE && moCoi.length > MOC ? 1 : 0);
}

console.log(`[reachable] ${ten.length} npm script · ${Object.keys(vanBan).length} bề mặt chạy được quét`);
console.log(`  KHÔNG nằm trên đường chạy nào : ${moCoi.length}  (mốc ${MOC})`);
if (moCoi.length) {
  console.log('');
  console.log('  >>> máy có spec xanh nhưng KHÔNG lệnh/workflow/skill/prompt/CI nào gọi <<<');
  for (let i = 0; i < moCoi.length; i += 6) console.log(`      ${moCoi.slice(i, i + 6).join('  ')}`);
  console.log('');
  console.log('  Nối nó vào chỗ người ta thật sự chạy (bó gate `check.js`, một workflow, hoặc CI),');
  console.log('  hoặc xoá nếu đã hết dùng. Nhắc tên trong `GATES.md` KHÔNG phải nối: danh mục đó tự sinh.');
}
console.log('');
console.log('  ĐỌC CON SỐ NÀY CHO ĐÚNG: vế ÂM đáng tin — không xuất hiện trên bề mặt chạy nào thì');
console.log('  chắc chắn không ai chạy. Vế DƯƠNG chỉ là CHẶN TRÊN: một cái tên nằm trong câu văn giải');
console.log('  thích cũng được tính là "có nối", nên đừng đọc phần còn lại thành "đã khép kín".');

/*
 * DÒNG KẾT PHẢI NÓI ĐÚNG SỐ ĐANG CÓ.
 *
 * Bản đầu in `✓ ĐẠT — ${moCoi.length} ≤ mốc ${MOC}` ở nhánh KHÔNG enforce, vô điều kiện. Lượt chạy
 * đầu tiên nó in ra "✓ ĐẠT — 27 ≤ mốc 18" — một câu tự mâu thuẫn, và là đúng lớp lỗi mà cả cửa này
 * sinh ra để chống. Không enforce nghĩa là KHÔNG CHẶN, không có nghĩa là ĐẠT.
 */
if (moCoi.length > MOC) {
  const dong = `[reachable] ${moCoi.length} máy mồ côi, TRÊN mốc ${MOC}.`;
  if (ENFORCE) {
    console.error('');
    console.error(`✗ CHẶN — ${dong}`);
    console.error('  Hạ mốc khi nối thật, KHÔNG nâng mốc để cho xanh.');
    process.exit(1);
  }
  console.log(`~ ${dong} Chạy \`npm run gate:reachable:enforce\` để chặn.`);
  process.exit(0);
}
console.log(`[reachable] ✓ ĐẠT — ${moCoi.length} ≤ mốc ${MOC}.`);
process.exit(0);
