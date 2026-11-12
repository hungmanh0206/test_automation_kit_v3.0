#!/usr/bin/env node
'use strict';
/*
 * gate_friction — SỔ MA SÁT của gate, và quy tắc dọn (v2.7.0 §A9).
 *
 * VÌ SAO CÓ. Kiểm kê ở §1 kết luận bốn thứ "chưa đo được", và ba trong bốn cùng một gốc: không nguồn
 * nào trong repo ghi lại "gate X đã chặn N lần". Transcript không được track, và thư mục `reports` của
 * task ghi kết quả task chứ không ghi lượt bị gate chặn. Nên mọi câu về ma sát của gate đều là cảm giác.
 *
 * File này mở sổ. Nó KHÔNG tạo ra số ngay: sổ rỗng ở lượt đầu, và nó phải chạy vài sprint mới có gì để
 * đọc. Đó là lý do §A9 ghi "chạy định kỳ" chứ không "chạy một lần rồi kết luận".
 *
 * BA SỰ KIỆN, và chỉ ba:
 *   · `chan`      — gate chặn một lượt (T0 ở mọi ngữ cảnh, T1 ở cửa ra);
 *   · `so_no`     — gate cảnh báo và ghi sổ nợ (T1 ở `write`/`phase`);
 *   · `mien_tru`  — có người miễn trừ một vi phạm T1.
 *
 * "BÁO OAN" KHÔNG SUY ĐƯỢC TỪ BA SỰ KIỆN TRÊN. Một lượt chặn không nói gate đúng hay sai; một lượt miễn
 * trừ cũng không, vì người ta miễn trừ cả khi gate đúng mà việc vẫn phải đi tiếp. Nên báo oan là sự
 * kiện thứ tư và nó CHỈ vào sổ khi có người khai thẳng:
 *
 *     npm run gate:friction -- --bao-oan <gate> --ma <MÃ> --ly-do "<vì sao gate SAI>"
 *
 * Suy báo oan từ số lượt override là cách chắc chắn nhất để một gate ĐÚNG mà hay bị vướng bị kết luận
 * là gate sai, rồi bị nới. Đó là đúng hướng tệ nhất của cả đợt giảm ma sát.
 *
 * Dùng:
 *   node scripts/qa/gate_friction.js [--doc] [--json]
 *   node scripts/qa/gate_friction.js --bao-oan <gate> --ma <MÃ> --ly-do "<lý do>"
 *
 * Exit: 0 luôn (máy BÁO CÁO) · 2 khi khai thiếu
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');

const SU_KIEN = ['chan', 'so_no', 'mien_tru', 'bao_oan'];
const TOI_THIEU_LY_DO = 20;

/* Ngưỡng của quy tắc dọn. Khai thành hằng để con số trong luật và con số trong code là một. */
const NGUONG = {
  toi_thieu_luot_chan: 10,
  ti_le_bao_oan: 0.2,
};

function duongSo() {
  /* `knowledge/**` là lớp PROJECT và bị gitignore — sổ này là dữ liệu của dự án, không phải của kit. */
  return process.env.GATE_FRICTION_SO || path.join(REPO, 'knowledge', 'metrics', 'gate-friction.jsonl');
}

/*
 * SỰ KIỆN TRÊN THƯ MỤC TẠM KHÔNG PHẢI SỰ KIỆN THẬT.
 *
 * Đo 12/11/2026: sổ có 2745 dòng và CẢ 2745 đến từ bộ test (task `debt-*`, `T-OV`, `T-KHAC` trên thư mục tạm) —
 * 0 sự kiện của task thật. Mọi con số "gate X chặn N lần" đọc từ sổ đó là số lượt chạy bộ test. Bộ test dựng task
 * giả trong `os.tmpdir()` hoặc `outputs/_scratch/`, nên thư mục là dấu hiệu phân biệt được, không cần đoán theo tên.
 */
function laThuMucTam(d) {
  if (!d) return false;
  const chuan = (x) => path.resolve(x).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  const x = chuan(d);
  return [os.tmpdir(), path.join(REPO, 'outputs', '_scratch')].map(chuan).some((g) => x === g || x.startsWith(`${g}/`));
}

/**
 * GHI THÊM một sự kiện. Append-only, một dòng JSON.
 *
 * Không bao giờ ghi đè và không bao giờ sửa dòng cũ: sổ ma sát là bằng chứng về quá khứ, và một bằng
 * chứng sửa được thì không còn là bằng chứng. Hệ quả phải chịu: sổ chỉ dài thêm, nên phần đọc phải
 * chịu được file lớn.
 *
 * KHÔNG NÉM khi ghi lỗi. Đây là lớp đo, không phải lớp gác: một lượt kiểm thất bại vì không ghi được
 * sổ là đổi một phép đo thành một lỗi chặn người dùng.
 */
function ghi(suKien, { gate, tang = null, nguCanh = null, task = null, ma = null, tcId = null, lyDo = null, thuMuc = null } = {}) {
  if (!SU_KIEN.includes(suKien)) return { ok: false, vi_sao: `sự kiện lạ: ${suKien}` };
  if (laThuMucTam(thuMuc)) return { ok: true, bo_qua: 'thư mục tạm — không phải task thật' };
  const ban = {
    luc: new Date().toISOString(),
    su_kien: suKien,
    gate: String(gate || '(không rõ)'),
    tang, ngu_canh: nguCanh, task, ma, tcId,
  };
  if (lyDo) ban.ly_do = String(lyDo).trim();
  try {
    const d = duongSo();
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.appendFileSync(d, `${JSON.stringify(ban)}\n`, 'utf8');
    return { ok: true, duong: d };
  } catch (e) {
    return { ok: false, vi_sao: e.message };
  }
}

/** Đọc sổ. Dòng hỏng thì BỎ QUA và ĐẾM, không im lặng. */
function doc() {
  const d = duongSo();
  if (!fs.existsSync(d)) return { co_so: false, su_kien: [], dong_hong: 0 };
  const dong = fs.readFileSync(d, 'utf8').split(/\r?\n/).filter(Boolean);
  const ra = [];
  let hong = 0;
  for (const l of dong) {
    try { ra.push(JSON.parse(l)); } catch (e) { hong += 1; }
  }
  return { co_so: true, su_kien: ra, dong_hong: hong, duong: d };
}

/** Gộp theo gate. */
function gopTheoGate(suKien) {
  const map = new Map();
  for (const e of suKien) {
    if (!map.has(e.gate)) map.set(e.gate, { gate: e.gate, chan: 0, so_no: 0, mien_tru: 0, bao_oan: 0, tang: e.tang || null, ly_do_bao_oan: [] });
    const g = map.get(e.gate);
    if (SU_KIEN.includes(e.su_kien)) g[e.su_kien] += 1;
    if (e.tang && !g.tang) g.tang = e.tang;
    if (e.su_kien === 'bao_oan' && e.ly_do) g.ly_do_bao_oan.push(e.ly_do);
  }
  return [...map.values()].sort((a, b) => (b.chan + b.so_no) - (a.chan + a.so_no));
}

/*
 * QUY TẮC DỌN — và cái quan trọng nhất là quy tắc KHÔNG được áp.
 *
 * §A9 viết rõ: "Chưa từng đỏ → KHÔNG được đề xuất bỏ chỉ vì lý do này." Đây là chỗ dễ sai nhất của cả
 * hạng mục, vì "gate này chưa bắt được gì" nghe như một lý lẽ mạnh. Nó không phải:
 *   · một gate chưa đỏ có thể đang gác một lớp lỗi mà kit CHƯA gặp — và nó sẽ gặp;
 *   · hoặc nó chưa đỏ vì chưa ai chạy nó;
 *   · hoặc nó chưa đỏ vì nó hỏng và `catch` nuốt mọi thứ. Đúng chuyện đã xảy ra với `dimension_coverage`
 *     (đọc file config thiếu, rơi vào `catch → []`, gate tắt mà không báo gì).
 * Ba lý do đó không phân biệt được bằng số lượt đỏ, nên số lượt đỏ không phải căn cứ để bỏ.
 *
 * Mọi đề xuất ở đây CHỈ LÀ ĐỀ XUẤT. Máy biết số, nhưng không biết một gate đang gác thứ gì ở lớp mà
 * chưa lần nào tới.
 */
function quyTacDon(theoGate, { trungLap = null } = {}) {
  const deXuat = [];
  const khongDuLieu = [];

  for (const g of theoGate) {
    const tongChan = g.chan;
    if (tongChan < NGUONG.toi_thieu_luot_chan) {
      khongDuLieu.push({
        gate: g.gate,
        vi_sao: `chỉ ${tongChan} lượt chặn, quy tắc đòi ≥${NGUONG.toi_thieu_luot_chan} mới đủ cơ sở`,
      });
      continue;
    }
    const tiLe = g.bao_oan / tongChan;
    if (tiLe > NGUONG.ti_le_bao_oan) {
      deXuat.push({
        gate: g.gate,
        loai: 'sua_gate',
        vi_sao: `${g.bao_oan}/${tongChan} lượt chặn bị khai BÁO OAN (${Math.round(tiLe * 100)}%, ngưỡng ${NGUONG.ti_le_bao_oan * 100}%)`,
        lam_gi: 'Sửa LUẬT của gate kèm một phép kiểm-âm, đừng nới ngưỡng và đừng tắt. Lý do báo oan đã khai: '
          + g.ly_do_bao_oan.slice(0, 3).join(' · '),
      });
    }
  }

  /*
   * TRÙNG LẮP: chỉ đề xuất gộp khi CHỨNG MINH ĐƯỢC trùng, và hiện chưa có cách chứng minh. §1a khai
   * cách đo là mutant của `mutation_check`, nhưng máy đó tiêm lỗi vào response ở tầng `page.route()`,
   * cần session UAT thật, và nó đo bộ assertion trong testcase chứ không chạy gate nào.
   */
  const trung = trungLap || {
    trang_thai: 'chưa đo được',
    vi_sao: 'cần bộ fixture cặp đối chứng (§A10.3) cộng bộ dữ liệu vàng (§A10.4): chạy MỌI gate trên từng '
      + 'fixture lỗi, hai gate cùng đỏ trên cùng tập fixture là ứng viên trùng. Offline, không chạm UAT.',
  };

  return {
    de_xuat: deXuat,
    khong_du_du_lieu: khongDuLieu,
    trung_lap: trung,
    _khong_bao_gio_de_xuat_bo_vi_chua_do: 'Gate chưa từng đỏ KHÔNG phải căn cứ để bỏ. Chưa đỏ có thể là: '
      + 'đang gác một lớp lỗi kit chưa gặp · chưa ai chạy nó · hoặc nó HỎNG và `catch` nuốt mọi thứ '
      + '(đã xảy ra với `dimension_coverage`). Ba thứ đó không phân biệt được bằng số lượt đỏ.',
    _chi_de_xuat: 'CHỈ ĐỀ XUẤT. Người duyệt mới làm, và gate nào gộp thì `mutation_check` trước/sau phải '
      + 'bắt đúng cùng tập mutant.',
  };
}

const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

function main() {
  const JSON_OUT = process.argv.includes('--json');
  const gateOan = val('bao-oan');

  if (gateOan) {
    const ma = val('ma');
    const lyDo = val('ly-do');
    if (!ma || !lyDo || String(lyDo).trim().length < TOI_THIEU_LY_DO) {
      console.error('[friction] ✗ khai báo oan cần `--ma <MÃ>` và `--ly-do` dài hơn '
        + `${TOI_THIEU_LY_DO} ký tự, nói được vì sao gate SAI (không phải vì sao việc vẫn phải đi tiếp).`);
      console.error('           Hai chuyện đó khác nhau: gate đúng mà vướng thì dùng `check --override`,');
      console.error('           còn báo oan là gate kết luận sai. Lẫn hai thứ làm một gate ĐÚNG bị nới.');
      process.exit(2);
    }
    const r = ghi('bao_oan', { gate: gateOan, ma, lyDo });
    if (!r.ok) { console.error(`[friction] ✗ không ghi được: ${r.vi_sao}`); process.exit(2); }
    console.log(`[friction] đã ghi BÁO OAN cho \`${gateOan}\` · mã ${ma}`);
    console.log(`           ${path.relative(REPO, r.duong).split(path.sep).join('/')}`);
    console.log(`           Quy tắc dọn chỉ xét khi gate đó đã có ≥${NGUONG.toi_thieu_luot_chan} lượt chặn.`);
    return;
  }

  const s = doc();
  const theoGate = gopTheoGate(s.su_kien);
  const don = quyTacDon(theoGate);
  const ra = { co_so: s.co_so, so_su_kien: s.su_kien.length, dong_hong: s.dong_hong, theo_gate: theoGate, ...don };

  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); return; }

  if (!s.co_so) {
    console.log('[friction] CHƯA CÓ SỔ — `knowledge/metrics/gate-friction.jsonl` chưa tồn tại.');
    console.log('           Sổ được ghi TỰ ĐỘNG khi gate chặn hoặc ghi sổ nợ, và khi có người miễn trừ.');
    console.log('           Nó rỗng ở lượt đầu, và phải chạy vài sprint mới có gì để đọc. Đây KHÔNG phải');
    console.log('           "kit không có ma sát" — nó là "chưa đo".');
    return;
  }

  console.log(`[friction] ${s.su_kien.length} sự kiện · ${theoGate.length} gate${s.dong_hong ? ` · ${s.dong_hong} dòng HỎNG (bỏ qua)` : ''}`);
  console.log('');
  console.log('| gate | tầng | chặn | sổ nợ | miễn trừ | báo oan |');
  console.log('|---|---|---|---|---|---|');
  for (const g of theoGate.slice(0, 20)) {
    console.log(`| \`${g.gate}\` | ${g.tang || '?'} | ${g.chan} | ${g.so_no} | ${g.mien_tru} | ${g.bao_oan} |`);
  }

  console.log('');
  if (don.de_xuat.length) {
    console.log(`ĐỀ XUẤT DỌN (${don.de_xuat.length}) — chỉ đề xuất, người duyệt mới làm:`);
    for (const d of don.de_xuat) {
      console.log(`  ${d.gate} · ${d.loai}: ${d.vi_sao}`);
      console.log(`    ${d.lam_gi}`);
    }
  } else {
    console.log('ĐỀ XUẤT DỌN: không có.');
  }
  if (don.khong_du_du_lieu.length) {
    console.log(`\n${don.khong_du_du_lieu.length} gate CHƯA ĐỦ DỮ LIỆU để xét:`);
    for (const k of don.khong_du_du_lieu.slice(0, 8)) console.log(`  ${k.gate} — ${k.vi_sao}`);
    if (don.khong_du_du_lieu.length > 8) console.log(`  … (+${don.khong_du_du_lieu.length - 8})`);
  }
  console.log(`\nTrùng lắp giữa gate: ${don.trung_lap.trang_thai}.`);
  console.log(`  ${don.trung_lap.vi_sao}`);
  console.log(`\n${don._khong_bao_gio_de_xuat_bo_vi_chua_do}`);
}

if (require.main === module) main();

module.exports = { ghi, doc, gopTheoGate, quyTacDon, duongSo, laThuMucTam, SU_KIEN, NGUONG, TOI_THIEU_LY_DO };
