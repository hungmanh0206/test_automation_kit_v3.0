#!/usr/bin/env node
'use strict';
/*
 * steps:stats — ĐO THỐNG KÊ CỦA TỪNG BƯỚC TỪ LƯỢT CHẠY THẬT (v2.8.0 §E).
 *
 * Nguồn dữ liệu là shard kết quả mà `EvidenceRecorder` ghi ra: `<task>/test-results/<shard>/<tc>.json`,
 * trong đó mỗi step có `name` theo khuôn `<ma_buoc> · <câu bước>` do `compile:spec` sinh. Khuôn đó là
 * HỢP ĐỒNG giữa hai file; đổi một bên mà không đổi bên kia thì thống kê tụt về 0 bước đo được, và
 * script này nói ra điều đó thay vì in một bảng rỗng.
 *
 * HAI LUẬT:
 *
 *   1. `ti_le_on_dinh: null` nghĩa CHƯA ĐO, và nó KHÁC `0`. Bước chưa chạy lần nào không phải bước chập
 *      chờn. Script chỉ ghi số khi có ít nhất một lượt chạy thật; không có thì giữ `null`.
 *
 *   2. KHÔNG ghi đè `so_lan_dung` bằng số nhỏ hơn khi chỉ quét được MỘT task. Thống kê là tích luỹ qua
 *      nhiều task và nhiều lượt; quét một task rồi ghi đè là xoá mất phần đã đo trước đó. Mặc định
 *      script quét MỌI task tìm thấy; `--task` thu hẹp phạm vi thì nó CỘNG DỒN, không thay thế — và
 *      `--dat-lai` mới là cách xoá, có cờ riêng để không ai làm nhầm.
 *
 * `ti_le_on_dinh` đo cái gì: tỉ lệ lượt chạy mà bước KHÔNG NÉM. Nó không đo bước phán đúng hay sai —
 * phán đúng/sai là việc của bộ kiểm L4. Một bước ném là `script_error` (locator trôi, hết giờ chờ,
 * postback chưa xong), và đó đúng là thứ `ti_le_on_dinh` cần nói.
 *
 * Dùng: node scripts/qa/reuse/steps_stats.js [--task <K>] [--ghi] [--dat-lai] [--json]
 * Exit: 0 · 2 khi không tìm thấy shard nào (CHƯA ĐO ĐƯỢC, không phải "mọi bước đều ổn")
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));

/** Khuôn tên step do `compile:spec` sinh. Hợp đồng giữa hai file. */
const RE_TEN_STEP = /^([a-z0-9]+(?:[.-][a-z0-9]+)*)\s+·\s+/;

/** Tên thư mục shard — lấy từ chính recorder để hai bên không trôi khỏi nhau. */
function tenThuMucShard() {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'utils', 'evidence_recorder.js'), 'utf8');
  const m = /STATUS_DIRNAME\s*=\s*['"]([^'"]+)['"]/.exec(src);
  if (!m) {
    throw new Error(
      'steps:stats không đọc được `STATUS_DIRNAME` từ `scripts/utils/evidence_recorder.js`. '
      + 'Đoán tên thư mục shard là cách chắc chắn nhất để đo nhầm chỗ rồi báo 0 bước — nên dừng ở đây.',
    );
  }
  return m[1];
}

/**
 * Mọi thư mục shard của mọi task (hoặc của một task nếu khai `--task`).
 *
 * `gocOutputs` nhận từ ngoài CHỈ để spec chỉ vào cây fixture. Không có đường đó thì phép đối chứng
 * DƯƠNG duy nhất là chạy thật trên UAT, và một bộ đọc thống kê chưa bao giờ đọc nổi một bản ghi đúng
 * khuôn là một bộ đọc chưa ai chứng minh là chạy.
 */
function cacThuMucShard(taskKey, gocOutputs) {
  const shardDir = tenThuMucShard();
  const ra = [];
  const outputs = gocOutputs || path.join(REPO, 'outputs');
  if (!fs.existsSync(outputs)) return ra;
  for (const p of fs.readdirSync(outputs, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    const tasks = path.join(outputs, p.name, 'tasks');
    if (!fs.existsSync(tasks)) continue;
    for (const t of fs.readdirSync(tasks, { withFileTypes: true })) {
      if (!t.isDirectory()) continue;
      if (taskKey && t.name !== taskKey) continue;
      const d = path.join(tasks, t.name, 'test-results', shardDir);
      if (fs.existsSync(d)) ra.push({ task: t.name, dir: d });
    }
  }
  return ra;
}

/**
 * Đọc mọi shard, gom theo mã bước.
 *
 * Mỗi bản ghi là MỘT LƯỢT CHẠY của một bước trong một case. Đếm theo (task, tcId) cho `so_lan_dung` —
 * "bao nhiêu case dùng bước này" — và theo từng lượt cho `ti_le_on_dinh`.
 */
function docShard(taskKey, gocOutputs) {
  const dirs = cacThuMucShard(taskKey, gocOutputs);
  const theoBuoc = new Map();
  let soShard = 0;
  let soStep = 0;
  let soStepKhongKhuon = 0;

  for (const { task, dir } of dirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
      soShard += 1;
      const t = j.test || {};
      for (const s of t.steps || []) {
        soStep += 1;
        const m = RE_TEN_STEP.exec(String(s.name || ''));
        if (!m) { soStepKhongKhuon += 1; continue; }
        const id = m[1];
        if (!theoBuoc.has(id)) theoBuoc.set(id, { id, luot: 0, luot_hong: 0, case: new Set(), task: new Set(), run: new Set() });
        const b = theoBuoc.get(id);
        b.luot += 1;
        if (String(s.status).toUpperCase() === 'FAILED') b.luot_hong += 1;
        b.case.add(`${task}/${t.tcId}`);
        b.task.add(task);
        if (j.runId) b.run.add(j.runId);
      }
    }
  }
  return { theoBuoc, soShard, soStep, soStepKhongKhuon, soThuMuc: dirs.length };
}

function dungDo(taskKey, gocOutputs) {
  const d = docShard(taskKey, gocOutputs);
  const danhMuc = sm.napDanhMuc();
  const trongDanhMuc = new Set((danhMuc ? danhMuc.buoc : []).map((b) => b.id));

  const buoc = [...d.theoBuoc.values()].map((b) => ({
    id: b.id,
    trong_danh_muc: trongDanhMuc.has(b.id),
    so_lan_dung: b.case.size,
    so_luot: b.luot,
    so_luot_hong: b.luot_hong,
    so_task: b.task.size,
    so_run: b.run.size,
    /* Chỉ có số khi đã chạy thật. Không lượt nào ⇒ `null` (CHƯA ĐO), không phải 0. */
    ti_le_on_dinh: b.luot ? Number(((b.luot - b.luot_hong) / b.luot).toFixed(3)) : null,
  })).sort((x, y) => y.so_luot - x.so_luot);

  /* Bước có trong danh mục mà KHÔNG có lượt nào — phải hiện ra, vì đó là phần "chưa đo". */
  const chuaDo = [...trongDanhMuc].filter((id) => !d.theoBuoc.has(id));
  /* Bước chạy thật mà KHÔNG có trong danh mục — spec sửa tay, hoặc danh mục đã xoá mục còn spec thì chưa. */
  const laMa = buoc.filter((b) => !b.trong_danh_muc).map((b) => b.id);

  return { ...d, theoBuoc: undefined, buoc, chua_do: chuaDo, la_ma: laMa, so_muc_danh_muc: trongDanhMuc.size };
}

/** Ghi thống kê ngược vào danh mục. CỘNG DỒN theo mặc định; `datLai` mới là ghi đè. */
function ghiVaoDanhMuc(ketQua, { datLai = false } = {}) {
  const duong = sm.DUONG_DANH_MUC;
  const dm = JSON.parse(fs.readFileSync(duong, 'utf8'));
  const theo = new Map(ketQua.buoc.map((b) => [b.id, b]));
  const doi = [];

  for (const b of dm.buoc) {
    const m = theo.get(b.id);
    if (!m) continue;
    const truoc = { ...b.thong_ke };
    const soCu = Number(b.thong_ke.so_lan_dung || 0);
    b.thong_ke.so_lan_dung = datLai ? m.so_lan_dung : Math.max(soCu, m.so_lan_dung);
    if (m.ti_le_on_dinh !== null) b.thong_ke.ti_le_on_dinh = m.ti_le_on_dinh;
    doi.push({ id: b.id, truoc, sau: { ...b.thong_ke } });
  }

  fs.writeFileSync(duong, `${JSON.stringify(dm, null, 2)}\n`, 'utf8');
  return doi;
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const taskKey = val('task');
  const d = dungDo(taskKey);

  if (argv.includes('--json')) {
    console.log(JSON.stringify(d, null, 2));
    return;
  }

  if (!d.soThuMuc) {
    console.error('[steps-stats] CHƯA ĐO ĐƯỢC — không tìm thấy thư mục shard kết quả nào.');
    console.error('              Đây KHÔNG phải "mọi bước đều ổn định", mà là "chưa có lượt chạy nào để đọc".');
    process.exit(2);
  }

  console.log(`[steps-stats] ${d.soThuMuc} thư mục kết quả · ${d.soShard} shard · ${d.soStep} lượt step`);
  console.log(`              ${d.buoc.length}/${d.so_muc_danh_muc} mục danh mục đã có số · ${d.chua_do.length} mục CHƯA ĐO`);

  if (d.soStepKhongKhuon) {
    const pc = Math.round((d.soStepKhongKhuon / d.soStep) * 100);
    console.log('');
    console.log(`~ ${d.soStepKhongKhuon}/${d.soStep} lượt step (${pc}%) không theo khuôn \`<mã bước> · <câu>\`.`);
    console.log('  Đó là step của spec viết tay — bình thường. Nhưng nếu con số này là 100% thì hợp đồng');
    console.log('  tên step giữa `compile:spec` và `steps:stats` đã trôi, và bảng dưới đây RỖNG vì thế,');
    console.log('  không phải vì các bước chưa chạy.');
  }

  if (d.buoc.length) {
    console.log('');
    console.log('  lượt  hỏng  case  task  ổn định   mã bước');
    for (const b of d.buoc) {
      const od = b.ti_le_on_dinh === null ? 'CHƯA ĐO' : `${Math.round(b.ti_le_on_dinh * 100)}%`;
      console.log(`  ${String(b.so_luot).padStart(4)}  ${String(b.so_luot_hong).padStart(4)}  ${String(b.so_lan_dung).padStart(4)}  ${String(b.so_task).padStart(4)}  ${od.padStart(7)}   ${b.id}${b.trong_danh_muc ? '' : '  ← KHÔNG CÓ TRONG DANH MỤC'}`);
    }
  }

  if (d.chua_do.length) {
    console.log('');
    console.log(`Chưa đo (${d.chua_do.length}): ${d.chua_do.join(' · ')}`);
    console.log('  `ti_le_on_dinh` của chúng giữ `null`. Chưa chạy lần nào KHÁC chập chờn, và');
    console.log('  `steps:promote` sẽ từ chối thăng các bước này.');
  }

  if (d.la_ma.length) {
    console.log('');
    console.log(`⚠ ${d.la_ma.length} mã bước chạy thật mà KHÔNG có trong danh mục: ${d.la_ma.join(' · ')}`);
    console.log('  Hoặc spec bị sửa tay, hoặc danh mục đã xoá mục mà spec thì chưa — `steps:impact` soi được.');
  }

  if (argv.includes('--ghi')) {
    const doi = ghiVaoDanhMuc(d, { datLai: argv.includes('--dat-lai') });
    console.log('');
    console.log(`✓ Ghi vào danh mục: ${doi.length} mục.`);
    for (const x of doi) {
      console.log(`  ${x.id}: dùng ${x.truoc.so_lan_dung}→${x.sau.so_lan_dung} · ổn định ${x.truoc.ti_le_on_dinh}→${x.sau.ti_le_on_dinh}`);
    }
  } else if (d.buoc.length) {
    console.log('');
    console.log('(chưa ghi — thêm `--ghi` để cập nhật `thong_ke` trong danh mục)');
  }
}

if (require.main === module) main();

module.exports = { dungDo, docShard, ghiVaoDanhMuc, cacThuMucShard, tenThuMucShard, RE_TEN_STEP };
