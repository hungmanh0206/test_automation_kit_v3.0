#!/usr/bin/env node
'use strict';
/*
 * canonical:check — GÁC MÔ HÌNH "MD CANONICAL, EXCEL/SHEET PHÁI SINH" (v2.8.0 §0c.4).
 *
 * DÙNG LẠI `canonical_drift`, KHÔNG dựng bộ so thứ hai. Máy đó (v2.7.0) đã có đúng phần khó: model
 * canonical hai phía, danh sách trường so được, phép chuẩn hoá chuỗi, và cửa sổ in quanh chỗ lệch. Chép
 * ra một bản thứ hai là lặp lại đúng lỗi mà §0b vừa sửa — hai bản lint SQL trôi khỏi nhau, năm bản mẫu
 * PII lệch nhau. Ở đây chỉ thêm thứ `canonical_drift` chưa có:
 *
 *   1. TÁCH NỘI DUNG KHỎI KẾT QUẢ. Lệch NỘI DUNG là CHẶN; lệch chỉ ở phần KẾT QUẢ là CẢNH BÁO.
 *      Vì sao phải tách: sau mỗi lượt chạy, kết quả được ghi vào MD rồi mới toả sang Excel và Sheet. Giữa
 *      hai mốc đó thì ba nơi lệch nhau một cách HỢP LỆ. Nếu gộp hai loại lệch, gate sẽ đỏ sau mọi lượt
 *      execute, và một gate đỏ-thường-xuyên thì bị bỏ qua — lúc đó nó không còn bắt được lệch NỘI DUNG,
 *      là thứ duy nhất nó sinh ra để bắt.
 *
 *   2. CHÂN THỨ BA: GOOGLE SHEET. Không so trực tiếp được (cần credential), nên đọc `sync_state.json`:
 *      `sheet_stale: true` ⇒ CẢNH BÁO kèm lý do. Nói thẳng đây là lời khai của lượt sync trước, KHÔNG
 *      phải một phép đo trên Sheet — hai thứ đó khác nhau, và gộp chúng là tự nhận mình đã kiểm Sheet.
 *
 * Dùng: node scripts/qa/canonical_check.js [--task <K>] [--json]
 * Exit: 0 · 1 khi lệch NỘI DUNG · 2 khi chưa có gì để so
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const drift = require(path.join(__dirname, 'canonical_drift.js'));
const { TEN_STATE } = require(path.join(__dirname, 'testcases', 'sync_canonical.js'));

const JSON_OUT = process.argv.includes('--json');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/*
 * TRƯỜNG NỘI DUNG — lấy từ `canonical_drift.TRUONG`, một nguồn.
 *
 * Danh sách đó KHÔNG chứa trường kết quả nào (`status`, `failureLayer`, `reruns`, `evidence` sống ở
 * `testcase-status.json`, không ở model case). Nên "tách nội dung khỏi kết quả" ở đây nghĩa là: so trên
 * `TRUONG`, và bỏ qua KHỐI KẾT QUẢ mà `sync_canonical --results` chèn vào cuối MD.
 */
const MOC_KET_QUA_DAU = '<!-- KET-QUA:BAT-DAU';
const MOC_KET_QUA_CUOI = '<!-- KET-QUA:KET-THUC -->';

/** Bỏ khối kết quả khỏi văn bản MD trước khi so nội dung. */
function boKhoiKetQua(md) {
  const s = String(md || '');
  const i = s.indexOf(MOC_KET_QUA_DAU);
  if (i < 0) return { than: s, coKhoi: false };
  const j = s.indexOf(MOC_KET_QUA_CUOI, i);
  if (j < 0) return { than: s.slice(0, i), coKhoi: true };
  return { than: s.slice(0, i) + s.slice(j + MOC_KET_QUA_CUOI.length), coKhoi: true };
}

function docState(tcDir) {
  const f = path.join(tcDir, TEN_STATE);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { _loi: e.message }; }
}

function main() {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[canonical] ✗ không xác định được task: ${e.message}`);
    process.exit(2);
  }

  const tcDir = path.join(taskOutputDir, 'test-cases');
  const state = docState(tcDir);

  /*
   * Phần so MD ↔ Excel giao hẳn cho `canonical:drift --enforce`: nó đã khai mẫu số, in cửa sổ quanh chỗ
   * lệch, và từ chối phán khi chưa có gì để so. Gọi lại nó thay vì so lần nữa ở đây.
   */
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'canonical_drift.js'), '--task', taskKey, '--json'], {
    cwd: REPO, encoding: 'utf8', env: process.env,
  });
  let kqDrift = null;
  try { kqDrift = JSON.parse(String(r.stdout || '{}')); } catch (e) { kqDrift = null; }

  const chan = [];
  const canhBao = [];

  if (r.status === 2) {
    console.error('[canonical] CHƯA ĐƯỢC GÁC — chưa có gì để so (thiếu MD canonical, hoặc chưa có bản xuất).');
    console.error('            Sinh bản xuất bằng: npm run sync:canonical -- --task ' + taskKey);
    process.exit(2);
  }

  /*
   * ĐỌC ĐÚNG KHOÁ MÀ `canonical_drift` THẬT SỰ TRẢ VỀ.
   *
   * Lượt đầu tôi đọc `kqDrift.lech` — một khoá KHÔNG TỒN TẠI. Hệ quả: `soLech` luôn bằng 0, gate luôn
   * xanh, và phép đối chứng "sửa nội dung thẳng trong Excel" đi qua sạch. Gate trông như đang gác mà
   * không gác gì — đúng loại hỏng tệ nhất, và nó chỉ lộ ra vì có phép đối chứng.
   *
   * Khoá thật: `so_thay_doi` (số ô lệch) và `phai_chan` (phán quyết của chính drift). Chi tiết từng ô ở
   * `nhom[].o_khac`.
   */
  const soLech = kqDrift && Number.isFinite(kqDrift.so_thay_doi) ? kqDrift.so_thay_doi : null;
  const driftChan = !!(kqDrift && kqDrift.phai_chan);
  if (driftChan || (soLech !== null && soLech > 0)) {
    const oKhac = (kqDrift.nhom || []).flatMap((n) => n.o_khac || []);
    chan.push(`Excel LỆCH NỘI DUNG so với MD: ${soLech ?? '?'} ô.`);
    for (const o of oKhac.slice(0, 8)) {
      chan.push(`  ${o.tcId} · ${o.nhan}: MD "${String(o.md).slice(0, 48)}" ≠ Excel "${String(o.xlsx).slice(0, 48)}"`);
    }
    if (oKhac.length > 8) chan.push(`  … +${oKhac.length - 8} ô nữa`);
  } else if (soLech === null && r.status === 1) {
    /* Drift exit 1 mà không đọc được JSON ⇒ KHÔNG kết luận "khớp". Không phán được không thành đạt. */
    chan.push('`canonical:drift` báo CHẶN mà không đọc được kết quả JSON — chạy nó trực tiếp để xem lý do.');
  }

  /* Chân thứ ba: lời khai của lượt sync trước, KHÔNG phải phép đo trên Sheet. */
  if (!state) {
    canhBao.push(`chưa có ${TEN_STATE} — chưa lượt sync nào chạy, nên KHÔNG BIẾT Sheet có mang bản mới nhất. `
      + 'Đây là "chưa kiểm", không phải "đã đồng bộ".');
  } else if (state.sheet_stale) {
    const ly = state.sheet && state.sheet.trang_thai ? ` (${state.sheet.trang_thai})` : '';
    canhBao.push(`Sheet CHƯA mang bản mới nhất${ly} theo lời khai của lượt sync lúc ${state.luc}. `
      + 'Đây là lời khai, không phải phép đo trên Sheet — so trực tiếp cần credential.');
  }

  const kq = { task: taskKey, chan, canh_bao: canhBao, drift: kqDrift, sync_state: state };
  if (JSON_OUT) { console.log(JSON.stringify(kq, null, 2)); process.exit(chan.length ? 1 : 0); }

  if (canhBao.length) {
    console.log('[canonical] ~ cảnh báo:');
    for (const c of canhBao) console.log(`  ${c}`);
  }

  if (chan.length) {
    console.error('[canonical] ✗ CHẶN — lệch NỘI DUNG:');
    for (const c of chan) console.error(`  ${c}`);
    console.error('');
    console.error('  Nội dung testcase CHỈ sửa ở MD, rồi chạy `npm run sync:canonical -- --task <K>`.');
    console.error('  Nếu ai đó sửa thẳng trên Excel hoặc Sheet thì BÊ VỀ MD thủ công rồi sync lại — đừng sync');
    console.error('  một chiều lên bản vừa sửa, vì làm vậy là xoá đúng thay đổi của họ.');
    console.error('  Chi tiết từng case lệch: npm run canonical:drift -- --task ' + taskKey);
    process.exit(1);
  }

  console.log(`[canonical] ✓ MD và Excel khớp phần NỘI DUNG${canhBao.length ? ' (xem cảnh báo về Sheet ở trên)' : ''}.`);
}

if (require.main === module) main();

module.exports = { boKhoiKetQua, MOC_KET_QUA_DAU, MOC_KET_QUA_CUOI };
