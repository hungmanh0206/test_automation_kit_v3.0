#!/usr/bin/env node
/**
 * recon_check.js — `ui_catalog.md` là ORACLE, nên nó không được chứa quan sát chưa kiểm chứng.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * PROMPT v2.9.5 §2 ĐẶT ĐẦU BÀI NGƯỢC, và tôi đổi sau khi đo.
 *
 * Đầu bài ghi: "mọi dòng trong `requirements/ui_catalog.md` khai nguồn quan sát phải trỏ tới một ảnh
 * trong danh mục evidence". Nó giả định catalog CHỨA quan sát.
 *
 * Đo 28/10/2026 trên cả 4 catalog có thật trong `outputs/`: cả 4 đều mở đầu bằng banner
 *   "Nguồn duy nhất: <file đặc tả> — trích NGUYÊN VĂN. Đây là oracle cho expected…
 *    CẤM lấy nhãn/format từ build đang chạy (RULE_GLOBAL §3, chống oracle tautological)"
 * tức ở kit này catalog là BẢN TRÍCH ĐẶC TẢ, và quan sát KHÔNG được vào đó. Một gate đòi "trỏ ảnh"
 * sẽ hợp pháp hoá đúng thứ banner đang cấm: nhãn lấy từ app, rồi chống lưng bằng ảnh của app — tức
 * so app với chính nó, và phép so đó luôn PASS kể cả khi app sai.
 *
 * Nên máy này GIỮ quy ước sẵn có thay vì dựng quy ước mới:
 *   ① catalog phải khai mình là bản trích đặc tả và cấm lấy nhãn từ build đang chạy;
 *   ② dòng nào khai quan sát thì phải đi kèm dấu CHƯA KIỂM CHỨNG ở gần đó.
 *
 * TASK-9001 là mẫu đúng: nó có một dòng quan sát, và ngay dưới là
 * "⚠️ `url` và `headingText` … chưa đo trên UAT". Luật dưới đây rút từ chính nó.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GIỚI HẠN: máy dò CÂU, không hiểu nghĩa. Nó không biết một nhãn có thật nằm trong đặc tả hay không —
 * chỉ biết catalog có khai nguồn và có khai phần chưa đo hay chưa. Phần đúng/sai vẫn là việc người đọc.
 *
 * Exit: 0 đạt · 1 có vi phạm · 2 không phán được (không tìm thấy catalog nào).
 */
const fs = require('fs');
const path = require('path');

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const REPO = path.resolve(arg('repo', path.resolve(__dirname, '..', '..')));
const TASK = arg('task');
const JSON_OUT = process.argv.includes('--json');

/*
 * BA HÌNH DẠNG HỢP LỆ, rút từ cả 4 catalog có thật — không phải từ một cái rồi suy ra ba.
 *
 * Bản đầu của tôi chỉ bắt chữ "Nguồn duy nhất" và báo TASK-9004 thiếu banner. Đó là DƯƠNG TÍNH GIẢ:
 * 9004 khai nguồn bằng chữ khác ("Nguồn-sự-thật", "Trích **máy** từ … nguyên văn từng ô"). Mẫu dò bám
 * vào cách viết của MỘT file thì luôn báo oan các file anh em.
 *
 * Và TASK-3544 lộ ra một hình dạng thứ ba, hợp lệ và rất trung thực: task KHÔNG có FS lẫn Figma, nên
 * nguồn của catalog là ẢNH CHỤP BUILD — và nó khai thẳng hệ quả: case Display dựa trên catalog này chỉ
 * chứng minh "build không trôi khỏi ảnh QA đã duyệt", KHÔNG chứng minh build đúng đặc tả.
 *
 * Một gate đòi "phải khai nguồn đặc tả" sẽ PHẠT đúng sự trung thực đó, và đẩy người ta đi bịa một nguồn
 * đặc tả không tồn tại. Nên luật là: **phải khai nguồn**, và **nếu nguồn là build/ảnh thì phải khai luôn
 * giới hạn tautology**.
 */
const RE_NGUON_DAC_TA = /(nguồn[^\n]{0,24}|trích[^\n]{0,24})`?requirements\/|requirements\/[^\n]{0,60}(mục|§)|trích\s+\*{0,2}(máy|nguyên văn)/i;
const RE_NGUON_LA_BUILD = /nguồn[^\n]{0,40}(ảnh chụp build|ảnh chụp|build)|ảnh chụp build/i;
const RE_GIOI_HAN_TAUTOLOGY = /tautolog|KHÔNG[^\n]{0,60}đúng đặc tả|hợp thức hoá cái sai/i;
const RE_BANNER_CAM = /CẤM[^\n]{0,80}(build đang chạy|app đang chạy)|oracle tautological/i;
/** Dòng khai quan sát — đây là thứ KHÔNG nên có trong một bản trích đặc tả. */
const RE_QUAN_SAT = /quan sát (thực tế|trên app|được)|đo trên UAT|UI thực tế|theo app hiện tại/i;
/** Dấu tự khai chưa kiểm chứng — thứ làm cho một dòng quan sát trở nên hợp lệ. */
const RE_CHUA_DO = /chưa đo|chưa kiểm chứng|chưa xác minh|OBSERVATION/i;

function timCatalog() {
  const ra = [];
  const goc = path.join(REPO, 'outputs');
  if (!fs.existsSync(goc)) return ra;
  for (const proj of fs.readdirSync(goc, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const td = path.join(goc, proj.name, 'tasks');
    if (!fs.existsSync(td)) continue;
    for (const t of fs.readdirSync(td, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      if (TASK && t.name !== TASK) continue;
      const f = path.join(td, t.name, 'requirements', 'ui_catalog.md');
      if (fs.existsSync(f)) ra.push({ task: t.name, file: f });
    }
  }
  return ra;
}

const ds = timCatalog();
if (!ds.length) {
  const msg = TASK
    ? `[recon-check] KHÔNG PHÁN ĐƯỢC: task "${TASK}" không có requirements/ui_catalog.md`
    : '[recon-check] KHÔNG PHÁN ĐƯỢC: không tìm thấy requirements/ui_catalog.md nào trong outputs/';
  if (JSON_OUT) console.log(JSON.stringify({ dat: null, ly_do: msg }, null, 2));
  else {
    console.error(msg);
    console.error('  Catalog là bản TRÍCH ĐẶC TẢ của màn, và là oracle cho expected của case hiển thị.');
    console.error('  Chưa có nó thì chưa gác được gì — và "không có gì để gác" KHÔNG phải "đạt".');
  }
  process.exit(2);
}

const viPham = [];
const thongKe = [];

for (const { task, file } of ds) {
  const src = fs.readFileSync(file, 'utf8');
  const dong = src.split(/\r?\n/);
  const rel = path.relative(REPO, file).split(path.sep).join('/');

  const tuDacTa = RE_NGUON_DAC_TA.test(src);
  const tuBuild = RE_NGUON_LA_BUILD.test(src);

  if (!tuDacTa && !tuBuild) {
    viPham.push({ task, file: rel, dong: 1, loai: 'KHÔNG khai nguồn', text: 'catalog không khai nguồn nào — người đọc không biết expected này lấy từ đâu, nên không biết tin tới đâu' });
  }

  /*
   * Nguồn là BUILD thì hợp lệ, nhưng phải khai giới hạn: case dựa trên nó chỉ chứng minh build không
   * trôi khỏi ảnh đã duyệt, KHÔNG chứng minh build đúng đặc tả. Thiếu câu đó thì catalog lặng lẽ hợp
   * thức hoá cái sai của build — và mọi case Display dựng trên nó là so app với chính nó.
   */
  if (tuBuild && !tuDacTa && !RE_GIOI_HAN_TAUTOLOGY.test(src)) {
    viPham.push({ task, file: rel, dong: 1, loai: 'nguồn là BUILD mà không khai giới hạn', text: 'phải nói rõ: case dựa trên catalog này KHÔNG chứng minh build đúng đặc tả, chỉ chứng minh build không trôi khỏi ảnh đã duyệt' });
  }

  /* Catalog trích từ đặc tả thì phải có lớp chặn: đừng lấy nhãn từ build đang chạy. */
  if (tuDacTa && !RE_BANNER_CAM.test(src)) {
    viPham.push({ task, file: rel, dong: 1, loai: 'thiếu banner CẤM', text: 'catalog trích đặc tả nhưng không khai "CẤM lấy nhãn/format từ build đang chạy" — mất lớp chặn oracle tautological' });
  }

  let soQuanSat = 0;
  for (let i = 0; i < dong.length; i += 1) {
    if (!RE_QUAN_SAT.test(dong[i])) continue;
    soQuanSat += 1;
    /* Dấu "chưa kiểm chứng" được tính nếu nằm cùng dòng, hoặc trong 3 dòng quanh nó. */
    const quanh = dong.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (!RE_CHUA_DO.test(quanh)) {
      viPham.push({ task, file: rel, dong: i + 1, loai: 'quan sát KHÔNG khai chưa-kiểm-chứng', text: dong[i].trim().slice(0, 140) });
    }
  }
  thongKe.push({ task, dong: dong.length, quan_sat: soQuanSat });
}

if (JSON_OUT) {
  console.log(JSON.stringify({ dat: viPham.length === 0, thong_ke: thongKe, vi_pham: viPham }, null, 2));
  process.exit(viPham.length ? 1 : 0);
}

console.log(`[recon-check] ${ds.length} catalog · ${thongKe.reduce((a, b) => a + b.quan_sat, 0)} dòng khai quan sát`);
for (const t of thongKe) console.log(`  ${t.task}: ${t.dong} dòng · ${t.quan_sat} dòng quan sát`);

if (!viPham.length) {
  console.log('[recon-check] ✓ ĐẠT — catalog nào cũng khai nguồn đặc tả, và dòng quan sát nào cũng khai là chưa kiểm chứng.');
  console.log('[recon-check] Nhắc: máy này dò CÂU. Nó không biết một nhãn có thật nằm trong đặc tả hay không.');
  process.exit(0);
}

console.error(`\n[recon-check] ✗ CHẶN — ${viPham.length} vi phạm:\n`);
for (const v of viPham) {
  console.error(`  ${v.file}:${v.dong} — ${v.loai}`);
  console.error(`      ${v.text}`);
}
console.error('\nCatalog là ORACLE cho expected của case hiển thị. Một nhãn lấy từ app rồi dùng làm expected');
console.error('là so app với chính nó — phép so đó luôn PASS, kể cả khi app sai. Quan sát thì ghi là');
console.error('`OBSERVATION`/"chưa kiểm chứng" và đưa vào câu hỏi Ambiguity Gate, đừng để nó thành expected.');
process.exit(1);
