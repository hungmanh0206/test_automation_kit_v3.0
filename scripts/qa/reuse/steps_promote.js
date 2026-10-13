#!/usr/bin/env node
'use strict';
/*
 * steps:promote — THĂNG BƯỚC `draft` → `active` (v2.8.0 §E).
 *
 * Chỉ bước `active` mới được dùng để kết luận PASS. Nên cái cửa này là chỗ một con số chưa đo biến thành
 * một lời bảo đảm, và nó phải chặt.
 *
 * ĐIỀU KIỆN THĂNG (theo bảng vòng đời §5), hai đường:
 *
 *   A. ĐO ĐƯỢC: `ti_le_on_dinh >= 0.95` qua **≥3 lượt chạy** VÀ bước được dùng ở **≥2 case**.
 *   B. REVIEW THEO LÔ: người ký duyệt, có lý do, có ngày — `--review --nguoi <ai> --vi-sao <...>`.
 *
 * LUẬT KHÔNG NHƯỢNG BỘ: `ti_le_on_dinh === null` (CHƯA ĐO) **KHÔNG BAO GIỜ** đủ điều kiện ở đường A, và
 * cũng không được "coi như 1.0". Đây là cùng một luật với `CHUA_KIEM` của v2.7.0 và với "không phán được
 * KHÔNG thành PASS" ở CLAUDE.md §3: một bước chưa chạy lần nào không phải một bước ổn định, nó là một
 * bước chưa biết gì về nó.
 *
 * Đường B tồn tại vì có bước không đo được bằng lượt chạy thường (bước chỉ chạy ở một cấp học hiếm, bước
 * cần dữ liệu mà UAT không có). Nhưng nó ghi lại NGƯỜI và LÝ DO vào chính danh mục, nên về sau còn đối
 * chất được — khác hẳn việc sửa tay `status` rồi không ai biết vì sao.
 *
 * Dùng:
 *   node scripts/qa/reuse/steps_promote.js                       # xem bước nào ĐỦ điều kiện
 *   node scripts/qa/reuse/steps_promote.js --id <id> --ghi
 *   node scripts/qa/reuse/steps_promote.js --id <id> --review --nguoi <ai> --vi-sao "<...>" --ghi
 * Exit: 0 · 1 khi thăng hỏng · 2 khi không đọc được danh mục
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));

/** Ngưỡng đường A. Đổi số ở ĐÂY, không rải ra nhiều chỗ. */
const NGUONG = { on_dinh: 0.95, so_luot: 3, so_case: 2 };

/**
 * Bước này đủ điều kiện thăng chưa? Trả `{ dat, duong, vi_sao }`.
 *
 * `thongKe` là bản ghi đo được của `steps:stats` (có `so_luot`), còn `b.thong_ke` là bản đã ghi vào danh
 * mục. Ưu tiên bản đo được: danh mục chỉ giữ `so_lan_dung` và `ti_le_on_dinh`, không giữ số LƯỢT, mà
 * điều kiện ≥3 lượt cần đúng con số đó. Thiếu bản đo được thì KHÔNG suy ra từ `so_lan_dung` — hai đại
 * lượng khác nhau: một case có thể chạy bước đó ba lần, và ba case có thể mỗi case chạy một lần.
 */
function duDieuKien(b, thongKe) {
  if (b.status !== 'draft') return { dat: false, vi_sao: `đang ở \`${b.status}\`, không phải \`draft\`` };

  const onDinh = b.thong_ke ? b.thong_ke.ti_le_on_dinh : null;
  if (onDinh === null || onDinh === undefined) {
    return {
      dat: false,
      vi_sao: '`ti_le_on_dinh` là CHƯA ĐO (`null`) — chạy `steps:stats --ghi` trước. Chưa chạy lần nào '
        + 'không phải ổn định, và cũng không phải chập chờn.',
    };
  }
  if (!thongKe) {
    return { dat: false, vi_sao: 'không có bản đo nào từ `steps:stats` ⇒ không biết số LƯỢT chạy, mà điều kiện đường A cần đúng con số đó.' };
  }
  const thieu = [];
  if (onDinh < NGUONG.on_dinh) thieu.push(`ổn định ${Math.round(onDinh * 100)}% < ${NGUONG.on_dinh * 100}%`);
  if (thongKe.so_luot < NGUONG.so_luot) thieu.push(`${thongKe.so_luot} lượt < ${NGUONG.so_luot}`);
  if (thongKe.so_lan_dung < NGUONG.so_case) thieu.push(`${thongKe.so_lan_dung} case < ${NGUONG.so_case}`);
  if (thieu.length) return { dat: false, vi_sao: thieu.join(' · ') };
  return { dat: true, duong: 'A', vi_sao: `ổn định ${Math.round(onDinh * 100)}% qua ${thongKe.so_luot} lượt ở ${thongKe.so_lan_dung} case` };
}

function napThongKe() {
  const ss = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_stats.js'));
  try {
    const d = ss.dungDo(null);
    return new Map(d.buoc.map((b) => [b.id, b]));
  } catch (e) {
    return new Map();
  }
}

function thang({ id, review, nguoi, viSao, ghi }) {
  const duong = sm.DUONG_DANH_MUC;
  let dm;
  try { dm = JSON.parse(fs.readFileSync(duong, 'utf8')); } catch (e) { return { loi: `không đọc được danh mục: ${e.message}` }; }

  const b = dm.buoc.find((x) => x.id === id);
  if (!b) return { loi: `không có bước \`${id}\` trong danh mục` };

  const tk = napThongKe().get(id);

  if (review) {
    if (!nguoi || !viSao) {
      return { loi: 'đường B (review theo lô) BẮT BUỘC có `--nguoi` và `--vi-sao`. Thiếu một trong hai thì bản ghi duyệt không đối chất được, và nó thành một lần sửa tay có vỏ bọc.' };
    }
    b.status = 'active';
    b.ghi_chu = `${b.ghi_chu ? `${b.ghi_chu} ` : ''}[thăng qua REVIEW ${new Date().toISOString().slice(0, 10)} bởi ${nguoi}: ${viSao}]`;
    if (ghi) fs.writeFileSync(duong, `${JSON.stringify(dm, null, 2)}\n`, 'utf8');
    return { ok: true, duong: 'B', id, ghi: Boolean(ghi), ghi_chu: b.ghi_chu };
  }

  const kq = duDieuKien(b, tk);
  if (!kq.dat) return { loi: `\`${id}\` CHƯA đủ điều kiện: ${kq.vi_sao}` };

  b.status = 'active';
  if (ghi) fs.writeFileSync(duong, `${JSON.stringify(dm, null, 2)}\n`, 'utf8');
  return { ok: true, duong: 'A', id, ghi: Boolean(ghi), vi_sao: kq.vi_sao };
}

function liet() {
  const dm = sm.napDanhMuc();
  if (!dm) return { loi: 'không đọc được danh mục' };
  const tk = napThongKe();
  return {
    so_buoc: dm.buoc.length,
    buoc: dm.buoc.map((b) => ({ id: b.id, status: b.status, ...duDieuKien(b, tk.get(b.id)) })),
  };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const id = val('id');
  const json = argv.includes('--json');

  if (!id) {
    const d = liet();
    if (d.loi) { console.error(`[steps-promote] CHƯA ĐƯỢC GÁC — ${d.loi}`); process.exit(2); }
    if (json) { console.log(JSON.stringify(d, null, 2)); return; }
    const san = d.buoc.filter((b) => b.dat);
    console.log(`[steps-promote] ${d.so_buoc} bước · ${san.length} ĐỦ điều kiện thăng`);
    console.log('');
    for (const b of d.buoc) {
      console.log(`  ${b.dat ? '✓' : '·'} ${b.id.padEnd(34)} ${b.status.padEnd(15)} ${b.dat ? b.vi_sao : `chưa: ${b.vi_sao}`}`);
    }
    console.log('');
    console.log(`Ngưỡng đường A: ổn định ≥${NGUONG.on_dinh * 100}% · ≥${NGUONG.so_luot} lượt · ≥${NGUONG.so_case} case.`);
    console.log('Đường B (review theo lô) cần `--review --nguoi <ai> --vi-sao "<...>"`.');
    return;
  }

  const r = thang({
    id,
    review: argv.includes('--review'),
    nguoi: val('nguoi'),
    viSao: val('vi-sao'),
    ghi: argv.includes('--ghi'),
  });

  if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.loi ? 1 : 0); }
  if (r.loi) { console.error(`[steps-promote] ✗ ${r.loi}`); process.exit(1); }
  console.log(`[steps-promote] ✓ \`${r.id}\` → \`active\` qua đường ${r.duong}${r.vi_sao ? ` (${r.vi_sao})` : ''}`);
  if (!r.ghi) console.log('                (chưa ghi — thêm `--ghi`)');
}

if (require.main === module) main();

module.exports = { duDieuKien, thang, liet, napThongKe, NGUONG };
