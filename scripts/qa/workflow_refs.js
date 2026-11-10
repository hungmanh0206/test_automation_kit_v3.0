#!/usr/bin/env node
/**
 * workflow_refs — mọi đường dẫn WORKFLOW / TEMPLATE được trỏ tới đều phải TỒN TẠI THẬT.
 *
 * Dùng: node scripts/qa/workflow_refs.js [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ CỬA NÀY
 *
 * Chủ dự án nói khi yêu cầu đánh số lại workflow: *"đổi tên không chỉ là đổi tên, mà sau này gọi
 * slash command hay làm việc vẫn phải đúng, không được lệch"*. Đó là một yêu cầu về HÀNH VI, không
 * về chữ — nên nó phải thành MÁY, không thành lời hứa.
 *
 * Và nó bắt được một chỗ lệch CÓ SẴN ngay lượt đầu: `.agent/config/branch_parity.json` liệt kê
 * `.agent/workflows/phase1_01_analyze_requirements.md` — **không tồn tại ở đâu trong cây**, và đã
 * lệch từ trước. `parity:check` vẫn xanh vì nó chỉ kiểm "nhánh CÓ NHẮC TỚI", không kiểm "file CÓ
 * THẬT". Hai câu hỏi khác nhau, và chỉ câu thứ hai mới trả lời được "gọi lệnh ra có chạy không".
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * TRA Ở NHIỀU GỐC, KHÔNG ĐOÁN MỘT GỐC
 *
 * Lượt dò đầu tiên của tôi giả định mọi tên `*_NN_*.md` đều nằm dưới `.agent/workflows/`, và nó báo
 * `01_run_phase2.md` là "không tồn tại" — trong khi file ấy nằm ở `prompt_templates/`. Một cửa
 * chỉ biết một gốc sẽ gọi "không tồn tại" cho mọi thứ nằm ở gốc kia; cùng lỗi với `bug:claim` hôm qua.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const JSONRA = process.argv.includes('--json');

/* Nơi ĐI TÌM đường dẫn: những bề mặt điều khiển luồng làm việc. */
const QUET = /^(\.claude\/commands|\.agent\/(config|workflows|skills)|prompt_templates)\//;
/* Gốc để GIẢI đường dẫn tương đối. */
const GOC = ['', '.agent/workflows', 'prompt_templates', 'prompt_templates/phase2',
  'prompt_templates/phase2/dimensions', 'prompt_templates/phase3', 'prompt_templates/phase4', '.agent'];

/*
 * Tên file workflow/template: `NN_*.md` (workflow phẳng và prompt_templates), `run_*_template.md`.
 *
 * ĐÃ TỪNG HỎNG Ở ĐÂY, 10/11/2026. Bản đầu khoá bằng `(?:phase\d|rerun)_\d+_…` — đúng với tên CŨ.
 * Lượt đánh số lại bỏ tiền tố `phase`, và cửa này tụt từ 103 đường dẫn xuống **4** rồi in "✓ ĐẠT".
 * Nó không phát hiện gì sai cả: nó thôi nhìn. Một cửa đếm-theo-mẫu luôn hỏng im lặng theo chiều đó,
 * nên bên dưới có SÀN: ít hơn `SAN_DUONG_DAN` đường dẫn tra được thì thoát 2, KHÔNG phải 0.
 */
const MAU = /([A-Za-z0-9_.@/-]*(?:\d{2}_[a-z][a-z0-9_]*|run_[a-z0-9_]+_template)\.md)/g;

/* Đo 10/11/2026 ngay sau khi đánh số lại: 103 đường dẫn. Sàn đặt dưới hẳn để không đỏ oan khi kit
 * co lại tự nhiên, nhưng vẫn bắt được cú tụt về 4. */
const SAN_DUONG_DAN = 40;

/*
 * DANH SÁCH FILE: git trước, ĐI BỘ CÂY khi không có `.git`.
 *
 * ĐÃ TỪNG CHẾT Ở ĐÂY. Người review giải nén gói phát hành rồi chạy cửa này: nó thoát 2 với lý do
 * "không chạy được `git ls-files`". Đúng là KHÔNG PHÁN ĐƯỢC chứ không phải "đạt giả" — nhưng hệ quả
 * vẫn là một bước audit KHÔNG chạy được trên chính thứ kit đem giao.
 *
 * Và đây là lớp hồi quy ĐÃ CÓ TÊN trong kit: `verify_release.js` giữ sẵn một danh sách "script từng
 * crash khi KHÔNG có .git" (`secret:scan`, `ci:scope`). Cửa này chỉ là chưa được thêm vào đó. Nay nó
 * tự đi bộ cây, và tên nó nằm trong danh sách ấy.
 *
 * Đi bộ cây KHÔNG tương đương `git ls-files`: nó thấy cả file chưa track. Chấp nhận được, vì câu hỏi
 * của cửa này là "đường dẫn được trỏ tới có TỒN TẠI không", chứ không phải "có được track không".
 */
function dsFile() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\0').filter(Boolean);
  } catch (e) { /* không có .git — đi bộ cây */ }

  const BO = new Set(['node_modules', '.git', 'outputs', 'dist', 'test-results', 'vendor', 'playwright-report']);
  const ra = [];
  const di = (thuMuc, tien) => {
    let es = [];
    try { es = fs.readdirSync(thuMuc, { withFileTypes: true }); } catch (err) { return; }
    for (const e of es) {
      if (BO.has(e.name)) continue;
      const rel = tien ? `${tien}/${e.name}` : e.name;
      if (e.isDirectory()) di(path.join(thuMuc, e.name), rel);
      else ra.push(rel);
    }
  };
  di(REPO, '');
  return ra.length ? ra : null;
}

const tatCa = dsFile();
if (!tatCa) {
  console.log('[workflow-refs] KHÔNG PHÁN ĐƯỢC — không liệt kê được file nào (cả `git ls-files` lẫn đi bộ cây đều rỗng).');
  console.log('  Đây KHÔNG phải là đạt: không có danh sách file thì không kiểm được đường dẫn nào.');
  process.exit(2);
}

const nguon = tatCa.filter((f) => QUET.test(f));
if (!nguon.length) {
  console.log('[workflow-refs] KHÔNG PHÁN ĐƯỢC — không có bề mặt nào để quét.');
  process.exit(2);
}

const coThat = (duong) => GOC.some((g) => fs.existsSync(path.join(REPO, g, duong)));

const thieu = new Map();
const daTra = new Set();
for (const f of nguon) {
  let s;
  try { s = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { continue; }
  for (const m of s.matchAll(MAU)) {
    const d = m[1];
    daTra.add(d);
    if (coThat(d)) continue;
    /* Thử tiếp bằng TÊN TRẦN: tài liệu hay nhắc tên file mà không kèm thư mục. */
    const ten = d.replace(/^.*\//, '');
    if (ten !== d && coThat(ten)) continue;
    if (!thieu.has(d)) thieu.set(d, new Set());
    thieu.get(d).add(f);
  }
}

if (JSONRA) {
  console.log(JSON.stringify({
    da_quet: nguon.length,
    duong_dan_tra: daTra.size,
    thieu: [...thieu].map(([d, s]) => ({ duong_dan: d, duoc_tro_tu: [...s] })),
  }, null, 2));
  process.exit(thieu.size ? 1 : 0);
}

console.log(`[workflow-refs] quét ${nguon.length} bề mặt điều khiển luồng · ${daTra.size} đường dẫn workflow/template được trỏ tới`);
if (daTra.size < SAN_DUONG_DAN) {
  console.log(`  KHÔNG PHÁN ĐƯỢC — chỉ tra được ${daTra.size} đường dẫn, dưới sàn ${SAN_DUONG_DAN}.`);
  console.log('  Đây KHÔNG phải là đạt. Hoặc mẫu tên file đã đổi mà `MAU` chưa theo, hoặc cây đã co');
  console.log('  lại thật — hai khả năng đó khác nhau, và chỉ người đọc mới phân biệt được.');
  process.exit(2);
}

if (!thieu.size) {
  console.log('  ✓ ĐẠT — mọi đường dẫn đều tồn tại thật.');
  process.exit(0);
}

console.error(`  ✗ ${thieu.size} đường dẫn TRỎ VÀO FILE KHÔNG TỒN TẠI:`);
for (const [d, s] of thieu) console.error(`      ${d}\n        ← ${[...s].join('\n        ← ')}`);
console.error('');
console.error('  Đổi tên một workflow mà quên chỗ trỏ tới nó thì slash command vẫn "chạy" nhưng đọc hư không —');
console.error('  và không lượt nào đỏ, vì mọi cửa khác chỉ kiểm "có nhắc tới", không kiểm "có thật".');
process.exit(1);
