'use strict';

/*
 * gate_tier.js (v2.7.0 §A1) — QUYẾT ĐỊNH CHẶN HAY CẢNH BÁO, theo TẦNG và NGỮ CẢNH GỌI.
 *
 * VÌ SAO TÁCH KHỎI `gate_engine.js`: engine đang là lớp GỘP kết quả, và hàng chục gate cùng nhiều spec
 * đang khớp theo hợp đồng hiện tại của nó. Nhét thêm một trục quyết định vào đó là đổi hợp đồng của mọi
 * thứ đang gọi. File này là lớp RIÊNG, gate nào cần thì gọi; `gate_engine` không đổi một dòng.
 *
 * LUẬT, lấy từ `.agent/config/gate_tiers.json` (nguồn duy nhất — §A1):
 *
 *   T0  luôn CHẶN ở MỌI ngữ cảnh. Không có cờ override nào.
 *   T1  CHẶN ở `exit` và `ci`. Ở `write` và `phase` thì CẢNH BÁO, nhưng GHI SỔ NỢ.
 *   T2  không bao giờ chặn.
 *
 * VÌ SAO T1 KHÔNG CHẶN LÚC ĐANG LÀM, và đây là cả luận đề của v2.7.0: chặn một lỗi chất lượng ngay lúc
 * người ta đang viết dở thì họ phải dừng việc đang làm để sửa một thứ chưa xong. Làm thế đủ nhiều lần
 * thì người ta tìm cách tắt gate — và tắt gate thì mất luôn phần gác đúng. Chặn ở CỬA RA giữ nguyên
 * năng lực phát hiện mà không cắt ngang việc đang làm.
 *
 * NHƯNG CẢNH BÁO MÀ KHÔNG GHI SỔ THÌ LÀ BỎ QUA. Một dòng cảnh báo giữa hàng trăm dòng output sẽ trôi
 * mất, và đến cửa ra thì không ai biết đã từng có bao nhiêu vi phạm. Nên mỗi lần T1 cảnh báo, nó ghi
 * vào `reports/gate-debt.json`, và cửa ra đọc sổ đó — tức "chưa chặn" không bao giờ thành "đã bỏ".
 *
 * SỔ NỢ GHI THÊM, KHÔNG GHI ĐÈ. Một lượt chạy một gate không biết các gate khác đã ghi gì; ghi đè là
 * cách chắc chắn nhất để vi phạm của gate chạy trước biến mất khi gate sau chạy.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const DUONG_TIERS = path.join(REPO, '.agent', 'config', 'gate_tiers.json');

/** Bốn ngữ cảnh gọi. Thứ tự KHÔNG có nghĩa thang bậc — chúng là bốn chỗ khác nhau trong luồng. */
const NGU_CANH = {
  write: 'khi agent ghi hoặc sửa file (hook PostToolUse)',
  phase: 'trong lúc chạy một phase',
  exit: 'ở cửa ra (publish · log bug · Done hoặc release)',
  ci: 'trên CI',
};

const TANG = { T0: 'T0', T1: 'T1', T2: 'T2' };

let CACHE = null;

/**
 * Nạp bảng tầng. Thiếu file hoặc JSON hỏng thì KHÔNG im lặng cho qua.
 *
 * Vì sao phải ném: thiếu bảng thì mọi gate rơi về một mặc định, và mặc định nào cũng sai theo một hướng
 * tệ. Mặc định T2 là tắt sạch 70 máy chặn. Mặc định T1 là hạ 13 máy không-thương-lượng xuống "chỉ chặn
 * ở cửa ra" — tức §1 đến §6 của CLAUDE.md mất lớp gác ngay lúc đang làm. Cả hai đều là thay đổi lớn mà
 * không ai khai, nên chỗ này phải KÊU.
 */
function napBang({ batBuoc = true } = {}) {
  if (CACHE) return CACHE;
  let raw;
  try {
    raw = fs.readFileSync(DUONG_TIERS, 'utf8');
  } catch (e) {
    if (!batBuoc) return null;
    throw new Error(
      `[gate-tier] THIẾU .agent/config/gate_tiers.json — không quyết được chặn hay cảnh báo.\n`
      + '            Thiếu bảng này thì mọi gate rơi về một mặc định, và mặc định nào cũng sai theo một\n'
      + '            hướng tệ: T2 là tắt sạch máy chặn, T1 là hạ các máy không-thương-lượng xuống cửa ra.\n'
      + '            Sinh khung bằng: npm run gate:audit -- --write-tiers (rồi NGƯỜI khai khối T0).',
    );
  }
  let j;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    throw new Error(`[gate-tier] HỎNG JSON ở .agent/config/gate_tiers.json: ${e.message}`);
  }
  /*
   * Trạng thái phải là "đã duyệt". Bảng NHÁP không được dùng để quyết định chặn: nó là bản máy suy ra
   * cộng phần người đang điền dở, và dùng nó nghĩa là một dòng chưa ai đọc đã bắt đầu chặn người khác.
   */
  const daDuyet = /đã duyệt/i.test(String(j._trang_thai || ''));
  CACHE = { bang: j, daDuyet };
  return CACHE;
}

/** Chỉ dùng trong test — bảng được cache để không đọc đĩa mỗi lần gọi. */
function xoaCache() { CACHE = null; }

/**
 * Tầng của một gate. Gate KHÔNG có trong khối `T0` thì mặc định T1 — đúng luật §A1 ("gate chưa xếp tầng
 * thì mặc định T1"), và mặc định đó là phía an toàn hơn T2: nó vẫn chặn ở cửa ra.
 *
 * `laBaoCao: true` cho gate không phát hiện vi phạm (mức SINH hoặc BÁO CÁO) ⇒ T2. Thông tin đó đến từ
 * CODE qua `gate_index`, không từ bảng khai tay, nên nó không trôi khi ai đó nới một gate.
 */
function tangCua(gateId, { laBaoCao = false } = {}) {
  if (laBaoCao) return { tang: TANG.T2, nguon: 'suy từ code (gate không phát hiện vi phạm)' };
  const c = napBang();
  /*
   * BẢNG CÒN LÀ NHÁP THÌ VẪN DÙNG, NHƯNG PHẢI NÓI RA.
   *
   * Hai lựa chọn đều có cái giá. Bỏ qua bảng nháp nghĩa là 13 máy không-thương-lượng tụt xuống T1 —
   * tức §1 đến §6 mất lớp gác ngay lúc đang làm, vì một dòng trạng thái. Dùng bảng nháp nghĩa là một
   * dòng chưa ai đọc đã bắt đầu chặn người khác.
   *
   * Chọn phía DÙNG, theo đúng luật "phân vân thì xếp tầng cao hơn": chặn oan còn sửa được, còn một lỗ
   * gác mở ra im lặng thì không ai biết để sửa. Nhưng kèm cảnh báo, vì "đang dùng bảng chưa duyệt" là
   * thông tin người chạy phải biết.
   */
  const canhBao = c.daDuyet ? null
    : 'đang dùng `gate_tiers.json` ở trạng thái CHƯA DUYỆT — tầng có thể đổi sau khi người rà';
  const khai = (c.bang.T0 || {})[gateId];
  if (khai) {
    return {
      tang: TANG.T0,
      nguon: 'khai tay trong gate_tiers.json',
      non_negotiable: khai.non_negotiable,
      vi_sao: khai.vi_sao,
      canh_bao: canhBao,
    };
  }
  return { tang: TANG.T1, nguon: 'mặc định theo luật (không khai T0)', canh_bao: canhBao };
}

/**
 * Quyết định: với tầng này và ngữ cảnh này, có `exit 1` không.
 *
 * Trả về `{ chan, ghiSoNo, vi_sao }` thay vì một boolean, vì "không chặn" có HAI nghĩa khác nhau và gộp
 * chúng là bỏ mất phần quan trọng: T1 ở `phase` là *hoãn tới cửa ra và ghi sổ*, còn T2 là *không bao giờ*.
 */
function quyetDinh(tang, nguCanh) {
  if (!NGU_CANH[nguCanh]) {
    throw new Error(`[gate-tier] ngữ cảnh lạ: "${nguCanh}". Chỉ nhận: ${Object.keys(NGU_CANH).join(' · ')}`);
  }
  if (tang === TANG.T0) {
    return { chan: true, ghiSoNo: false, vi_sao: 'T0 — không thương lượng, chặn ở mọi ngữ cảnh' };
  }
  if (tang === TANG.T2) {
    return { chan: false, ghiSoNo: false, vi_sao: 'T2 — không bao giờ chặn' };
  }
  if (nguCanh === 'exit' || nguCanh === 'ci') {
    return { chan: true, ghiSoNo: false, vi_sao: `T1 ở ngữ cảnh ${nguCanh} — đây là cửa ra, chặn` };
  }
  return {
    chan: false,
    ghiSoNo: true,
    vi_sao: `T1 ở ngữ cảnh ${nguCanh} — cảnh báo và GHI SỔ NỢ, chặn ở cửa ra`,
  };
}

/** Đường sổ nợ của một task. */
function duongSoNo(taskOutputDir) {
  return path.join(taskOutputDir, 'reports', 'gate-debt.json');
}

/**
 * GHI THÊM vào sổ nợ. Khoá một món nợ là `(gateId, mã vi phạm, TC ID)` — trùng khoá thì cập nhật số
 * lần và thời điểm cuối, không thêm dòng mới.
 *
 * Vì sao gộp theo khoá chứ không ghi mọi lượt: một gate chạy mười lần trong một phiên sẽ ghi mười lần
 * CÙNG một vi phạm, và sổ nợ phình lên thành vô dụng. Cái cửa ra cần biết là "còn món nợ nào", không
 * phải "đã cảnh báo bao nhiêu lượt" — nhưng số lượt vẫn giữ, vì nó nói lên một gate đang gây ma sát
 * bao nhiêu.
 */
function ghiSoNo(taskOutputDir, gateId, viPham, { nguCanh = 'phase' } = {}) {
  const duong = duongSoNo(taskOutputDir);
  let so = { _la_gi: '', task: null, mon: [] };
  if (fs.existsSync(duong)) {
    try { so = JSON.parse(fs.readFileSync(duong, 'utf8')); } catch (e) { /* sổ hỏng thì dựng lại, nhưng KHÔNG xoá im lặng — ghi chú bên dưới */ so = { _la_gi: '', _so_cu_hong: true, mon: [] }; }
  }
  so._la_gi = 'SỔ NỢ GATE (v2.7.0 §A1): vi phạm T1 bị cảnh báo lúc đang làm, chưa chặn. Cửa ra đọc sổ này — "chưa chặn" KHÔNG bao giờ thành "đã bỏ".';
  so._xoa_khi_nao = 'Chỉ xoá một món khi vi phạm đã SỬA và gate chạy lại không còn báo. Xoá sổ để qua cửa ra là đúng thứ sổ này gác.';
  so.mon = Array.isArray(so.mon) ? so.mon : [];
  const nay = new Date().toISOString();
  for (const v of (Array.isArray(viPham) ? viPham : [viPham])) {
    const ma = (v && v.ma) || 'KHAC';
    const tcId = (v && v.tcId) || null;
    const thongDiep = String((v && v.thong_diep) || v || '').slice(0, 300);
    const khoa = `${gateId}|${ma}|${tcId || ''}`;
    const co = so.mon.find((m) => m.khoa === khoa);
    if (co) {
      co.so_lan += 1;
      co.lan_cuoi = nay;
      co.ngu_canh = [...new Set([...(co.ngu_canh || []), nguCanh])];
      continue;
    }
    so.mon.push({ khoa, gate: gateId, ma, tcId, thong_diep: thongDiep, so_lan: 1, lan_dau: nay, lan_cuoi: nay, ngu_canh: [nguCanh] });
  }
  fs.mkdirSync(path.dirname(duong), { recursive: true });
  fs.writeFileSync(duong, `${JSON.stringify(so, null, 2)}\n`, 'utf8');
  return { duong, so_mon: so.mon.length };
}

/** Đọc sổ nợ. Thiếu sổ KHÁC sổ rỗng, nên trả `null` chứ không trả mảng rỗng. */
function docSoNo(taskOutputDir) {
  const duong = duongSoNo(taskOutputDir);
  if (!fs.existsSync(duong)) return null;
  try { return JSON.parse(fs.readFileSync(duong, 'utf8')); } catch (e) { return { _hong: String(e.message), mon: [] }; }
}

/**
 * Hợp đồng dùng ở gate: trả exit code và in một dòng nói rõ vì sao.
 *
 * Không tự `process.exit` — gate gọi nó phải còn quyền in phần của mình trước khi thoát. Một thư viện
 * tự gọi `exit` là thư viện cắt ngang luồng in của mọi thứ gọi nó, và kit đã trả giá đúng chuyện đó ở
 * `require.main` guard.
 */
function apTang(gateId, viPham, { nguCanh, taskOutputDir = null, laBaoCao = false, log = console.log } = {}) {
  const t = tangCua(gateId, { laBaoCao });
  const qd = quyetDinh(t.tang, nguCanh);
  const n = Array.isArray(viPham) ? viPham.length : (viPham ? 1 : 0);
  if (t.canh_bao) log(`[${gateId}] ~ ${t.canh_bao}`);
  if (!n) return { exitCode: 0, tang: t.tang, chan: false, ghi_so_no: false };

  if (qd.chan) {
    log(`[${gateId}] ✗ CHẶN (${t.tang}, ngữ cảnh ${nguCanh}): ${n} vi phạm. ${qd.vi_sao}`);
    return { exitCode: 1, tang: t.tang, chan: true, ghi_so_no: false };
  }
  if (qd.ghiSoNo && taskOutputDir) {
    const r = ghiSoNo(taskOutputDir, gateId, viPham, { nguCanh });
    log(`[${gateId}] ⚠ ${n} vi phạm ${t.tang} — chưa chặn ở ngữ cảnh ${nguCanh}, đã ghi sổ nợ (${r.so_mon} món). Cửa ra sẽ chặn.`);
    return { exitCode: 0, tang: t.tang, chan: false, ghi_so_no: true, so_no: r.duong };
  }
  if (qd.ghiSoNo && !taskOutputDir) {
    /*
     * KHÔNG CÓ CHỖ GHI SỔ THÌ PHẢI NÓI RA. Cảnh báo rồi quên là đúng thứ sổ nợ ra đời để chặn, nên một
     * lượt T1 không ghi được sổ phải để lại dấu vết trong output — nếu không, "đã cảnh báo" biến thành
     * "đã bỏ" mà không ai biết.
     */
    log(`[${gateId}] ⚠ ${n} vi phạm ${t.tang} — chưa chặn ở ngữ cảnh ${nguCanh}, NHƯNG không có TASK_OUTPUT_DIR nên KHÔNG ghi được sổ nợ.`);
    log(`[${gateId}]   Nghĩa là cửa ra sẽ không thấy những vi phạm này. Khai TASK_KEY + PROJECT_OUTPUT_DIR rồi chạy lại.`);
    return { exitCode: 0, tang: t.tang, chan: false, ghi_so_no: false, mat_dau_vet: true };
  }
  log(`[${gateId}] ~ ${n} vi phạm ${t.tang} — ${qd.vi_sao}`);
  return { exitCode: 0, tang: t.tang, chan: false, ghi_so_no: false };
}

module.exports = {
  NGU_CANH, TANG, DUONG_TIERS,
  napBang, xoaCache, tangCua, quyetDinh, apTang,
  ghiSoNo, docSoNo, duongSoNo,
};
