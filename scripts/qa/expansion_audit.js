#!/usr/bin/env node
'use strict';
/*
 * expansion_audit.js — ĐO ĐỘ PHỦ 5 TRỤC trên MỌI task đã execute, để quyết định siết gate bằng SỐ.
 *
 * VÌ SAO CÓ FILE NÀY: câu hỏi "siết check #10 thành chặn thì đỏ bao nhiêu" không trả lời được bằng cảm tính.
 * Đo 19/08/2026 trên 9 task (1014 case, 382 case band high): chỉ 1 task đủ 5 artefact, 7 task 0/5. Quan trọng
 * hơn: task "đủ 5/5" đó có 3/7 báo cáo `proven=0` — nghĩa là chấm theo "có file hay không" sẽ dạy cả hệ thống
 * CHẠM VÀO FILE CHO CÓ. Chính con số đó đã bác bỏ phương án siết ban đầu và đổi sang: chặn "chưa lập kế hoạch"
 * (rẻ, buộc quyết định) + chặn `proven=0` ở 4 báo cáo TRỤC (hiện đỏ 0/9 — luật PHÒNG, không dọn nợ).
 *
 * Dùng LẠI depth.bandOf và ĐÚNG bộ glob của self_review #10 — đo bằng luật khác với luật sẽ áp là đo vô nghĩa.
 *
 * Dùng: node scripts/qa/expansion_audit.js        (quét toàn bộ outputs/)
 */
const fs = require('fs');
const path = require('path');
const REPO = process.argv[2] || path.resolve(__dirname, '..', '..');
const depth = require(path.join(REPO, 'scripts/lib/expansion/depth.js'));
const axes = require(path.join(REPO, 'scripts/lib/expansion/axes.js'));
const canonical = require(path.join(REPO, 'scripts/lib/testcase'));
// Thư mục testcase lấy từ MỘT nguồn (runtime_config) — ghép tay ở đây là tự tạo lại đúng lỗi mà
// check "thêm nguồn mới không được làm script đếm thiếu" sinh ra để chống.
const { getTestcaseDirs } = require(path.join(REPO, 'scripts/utils/runtime_config.js'));

const glob1 = (dir, rx) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => rx.test(f)) : []);

/** Bản sao NGUYÊN VĂN cách self_review #10 xét "trục đã chạy chưa". */
/**
 * Trục nào đã có artefact trong task này.
 *
 * ĐỌC TỪ MỘT NGUỒN `scripts/lib/expansion/axes.js` (v2.8.1 bước 1a). Trước đó file này khai bộ khoá
 * RIÊNG — `fixture` (tên artefact, gánh cả ④ lẫn ⑤) và `reverse` — khác với `leak_report.AXES`, khác
 * `depth.PLAN`, khác bảng của `self_review`. Bốn bộ từ vựng cho cùng một thứ, và hệ quả là không máy
 * nào đối chiếu được "band này đòi trục nào" với "trục nào đã chạy".
 *
 * BƯỚC 1a KHÔNG ĐỔI HÀNH VI: khoá `fixture` GIỮ NGUYÊN (④⑤ vẫn chung một ô), chỉ là định nghĩa của nó
 * nay lấy từ nguồn chung. Việc tách `fixture` thành `branch`/`state` là bước 1b, commit riêng — gom và
 * sửa cùng lúc thì khi một máy vỡ, không biết nó vỡ vì gom hay vì sửa.
 */
function axesRan(taskDir) {
  const resDir = path.join(taskDir, 'test-results');
  const repDir = path.join(taskDir, 'reports');
  const thuMuc = { 'test-results': resDir, reports: repDir };
  const co = (t) => {
    const a = t.artefact;
    const ds = glob1(thuMuc[a.thuMuc], a.re);
    if (!a.doiFile) return ds.length > 0;
    return ds.some((d) => fs.existsSync(path.join(thuMuc[a.thuMuc], d, a.doiFile)));
  };
  const ra = {};
  for (const t of axes.TRUC) ra[t.key] = co(t);
  /*
   * `reverse` TÁCH RIÊNG, không nằm trong `truc` (v2.8.1 bước 1b).
   *
   * `CLAUDE.md` §3 viết "5 trục quanh case (…) **+** chiều ngược `spec:gap`" — dấu cộng đó có nghĩa:
   * nó đi từ build về tài liệu, ngược hướng với năm trục kia. Đếm nó vào mẫu số trục làm một task chỉ
   * chạy `spec:gap` trông như "đã soi 1/5 trục", trong khi chưa trục nào được soi.
   *
   * Và `fixture` (tên ARTEFACT, gánh cả ④ lẫn ⑤) nay tách thành `branch` + `state`. Hệ quả có thật:
   * một task có `fixture-matrix` trước đây đếm 1, nay đếm 2 — vì bảng fixture-matrix thật sự phủ cả
   * hai trục. Đây là đổi hành vi CÓ CHỦ Ý của 1b, đo được ở bảng so sánh trong commit.
   */
  return { truc: ra, reverse: co(axes.CHIEU_NGUOC) };
}

/**
 * Trục mà band này ĐÒI nhưng task CHƯA chạy.
 *
 * Đây là phép đối chiếu `band → trục` đầu tiên của kit. Trước 1b, bảng `depth.PLAN` chỉ được in ra:
 * hai nơi dùng đều ở `expansion_plan` (một `console.log`, một dòng markdown), còn `axesRan` và bảng
 * `self_review` dùng khoá riêng và không đọc `PLAN`. Nên câu "case band high này đã mở đủ trục chưa"
 * KHÔNG máy nào trả lời được — chỉ trả lời được "có artefact nào không".
 */
function trucThieu(band, ranTruc) {
  /* `band === null` ⇒ không đọc được band nào ⇒ KHÔNG đòi trục nào. Xem ghi chú ở chỗ tính `bandNang`. */
  if (!band) return [];
  return (depth.PLAN[band] || []).filter((k) => !ranTruc[k]);
}

/** Báo cáo tồn tại nhưng proven=0 thì KHÔNG tính là đã soi (self_review cũng bắt điểm này). */
function provenZero(taskDir) {
  const repDir = path.join(taskDir, 'reports');
  const out = [];
  for (const f of glob1(repDir, /cross-surface|persist|probe|fixture-matrix|spec-gap/i)) {
    const m = fs.readFileSync(path.join(repDir, f), 'utf8').match(/<!--\s*gate:\s*proven=(\d+)/);
    if (m && Number(m[1]) === 0) out.push(f);
  }
  return out;
}

async function readCases(taskDir) {
  const byId = new Map();
  for (const d of getTestcaseDirs(taskDir)) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => /\.xlsx$/i.test(x))) {
      try {
        const doc = await canonical.parseXlsx(path.join(d, f));
        for (const t of doc.tests || []) {
          /*
           * `tcId` là tên trường của model canonical. Bản trước đọc `t.id` — một trường KHÔNG tồn tại — nên
           * map luôn rỗng, MỌI case báo `unknown`, và mọi dòng "NẾU SIẾT TIẾP" hiện 0/6 đỏ. Một máy đo RỖNG
           * mà kết quả lại trông yên tâm là lớp lỗi tệ nhất: nó được dùng để quyết định có siết gate hay không.
           * Giữ `t.id` và `_cells` làm đường lùi cho bản Excel cũ không qua parser canonical.
           */
          const id = String(t.tcId || t.id || (t._cells && (t._cells['TC ID'] || t._cells['TC_ID'])) || '').toUpperCase();
          if (id && !byId.has(id)) byId.set(id, t);
        }
      } catch { /* file hỏng → bỏ qua, không làm hỏng cả phép đo */ }
    }
  }
  return byId;
}

function readExecuted(taskDir) {
  const p = path.join(taskDir, 'test-results', 'testcase-status.json');
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.tests || []);
    return list.filter((t) => /^(PASS|FAIL)/i.test(String(t.status || '').trim()))
      .map((t) => String(t.tcId || '').toUpperCase()).filter(Boolean);
  } catch { return []; }
}

(async () => {
  const rows = [];
  const outputs = path.join(REPO, 'outputs');
  for (const proj of fs.readdirSync(outputs)) {
    const tasksDir = path.join(outputs, proj, 'tasks');
    if (!fs.existsSync(tasksDir)) continue;
    for (const task of fs.readdirSync(tasksDir)) {
      const taskDir = path.join(tasksDir, task);
      if (!fs.statSync(taskDir).isDirectory()) continue;
      const executed = readExecuted(taskDir);
      if (!executed.length) continue;                       // chưa execute thì không nằm trong phạm vi luật
      const cases = await readCases(taskDir);
      const bands = { high: 0, medium: 0, low: 0, unknown: 0 };
      for (const id of executed) {
        const tc = cases.get(id);
        if (!tc) { bands.unknown += 1; continue; }
        bands[depth.bandOf(tc)] += 1;
      }
      const ran = axesRan(taskDir);
      const hasPlan = glob1(path.join(taskDir, 'reports'), /expansion-plan/i).length > 0;
      /*
       * Band NẶNG NHẤT của task, và `null` khi KHÔNG ĐỌC ĐƯỢC band nào.
       *
       * Bản đầu của tôi viết `… : 'low'` ở nhánh cuối, nên một task chỉ có case `unknown` band bị gán
       * `low` rồi báo "thiếu trục ③" — tức SUY BAND TỪ KHÔNG CÓ DỮ LIỆU. Đó đúng cái `depth.thieuBand`
       * sinh ra để chống: một ô trống không được lặng lẽ thành một tầng. `null` ⇒ không đòi trục nào,
       * và con số `?` ở bảng đã nói ra có bao nhiêu case không tra được band.
       */
      const bandNang = bands.high > 0 ? 'high' : (bands.medium > 0 ? 'medium' : (bands.low > 0 ? 'low' : null));
      rows.push({
        task, executed: executed.length, ...bands, ran: ran.truc, reverse: ran.reverse, hasPlan,
        ranCount: Object.values(ran.truc).filter(Boolean).length,
        bandNang, thieu: trucThieu(bandNang, ran.truc),
        provenZero: provenZero(taskDir),
      });
    }
  }

  rows.sort((a, b) => b.executed - a.executed);
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('TASK', 14) + pad('exec', 6) + pad('high', 6) + pad('med', 5) + pad('low', 5) + pad('?', 5) + pad('trục đã chạy', 14) + 'chi tiết');
  console.log('-'.repeat(96));
  for (const r of rows) {
    const names = Object.entries(r.ran).filter(([, v]) => v).map(([k]) => k).join(',') || '—';
    console.log(pad(r.task, 14) + pad(r.executed, 6) + pad(r.high, 6) + pad(r.medium, 5) + pad(r.low, 5) + pad(r.unknown, 5) + pad(`${r.ranCount}/${axes.TRUC.length}`, 14) + names);
  }

  // ĐANG ÁP trong self_review #10 — hai luật này phải khớp với code ở đó, không thì phép đo vô nghĩa.
  const LIVE = {
    'chưa lập kế hoạch (CHẶN)': (r) => r.high > 0 && !r.hasPlan,
    'artefact proven=0 (CHẶN)': (r) => r.provenZero.length > 0,
  };
  // CHƯA áp — để cân nhắc siết tiếp khi hai luật trên đã thành nếp.
  const NEXT = {
    'có case high mà 0 trục': (r) => r.high > 0 && r.ranCount === 0,
    'thiếu trục mà band đòi': (r) => r.thieu.length > 0,
    'bắt buộc trục ③ persist': (r) => r.high > 0 && !r.ran.persist,
  };
  const show = (title, V) => {
    console.log(`\n${title} (trên ${rows.length} task đã execute):`);
    for (const [k, f] of Object.entries(V)) {
      const red = rows.filter(f);
      console.log(`  ${String(k).padEnd(26)} ${red.length}/${rows.length} đỏ` + (red.length ? ` → ${red.map((r) => r.task).join(', ')}` : ''));
    }
  };
  show('LUẬT ĐANG ÁP', LIVE);
  show('NẾU SIẾT TIẾP', NEXT);
  console.log('\nⓘ "Đỏ" ở đây là ảnh chụp THÓI QUEN quá khứ. Gate chỉ bắn lúc finalize của task ĐANG chạy —');
  console.log('  task cũ không finalize lại, nên số này không phải là số task sẽ vỡ.');
  const pz = rows.filter((r) => r.provenZero.length);
  if (pz.length) console.log('\nBáo cáo có nhưng proven=0 (artefact rỗng nghĩa): ' + pz.map((r) => `${r.task}(${r.provenZero.join('/')})`).join(' · '));
  const totalHigh = rows.reduce((s, r) => s + r.high, 0);
  console.log(`\nTổng: ${rows.reduce((s, r) => s + r.executed, 0)} case đã execute · ${totalHigh} case band high · ${rows.reduce((s, r) => s + r.unknown, 0)} case không tra được band (không thấy trong bản xuất Excel).`);
})().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
