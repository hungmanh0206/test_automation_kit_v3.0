'use strict';
/*
 * override — VƯỢT QUA CÓ KIỂM SOÁT (v2.7.0 §A8).
 *
 * ĐÂY LÀ ĐƯỜNG DUY NHẤT CỐ TÌNH MỞ RA TRONG CẢ ĐỢT, nên nó là chỗ dễ thành lỗ hổng nhất. Bốn hàng rào,
 * và mỗi cái đóng một cách người ta sẽ thử:
 *
 *   ① CHỈ T1. T0 không có cờ nào, không vai trò nào, không config nào. Thử override T0 thì bị từ chối
 *     VÀ không ghi được gì — nửa vời ở đây (từ chối nhưng vẫn ghi) tạo ra một bản ghi nói rằng T0 đã
 *     được miễn, và bản ghi đó sẽ được đọc lại sau.
 *
 *   ② PHẢI NÊU TC ID. Đây là chỗ tôi siết chặt hơn §A8 đòi. Miễn cả một MÃ cho cả task nghĩa là tắt một
 *     phép kiểm bằng một dòng, và lần sau có case mới vi phạm đúng mã đó thì nó cũng được miễn — không
 *     ai khai, không ai biết. Khoanh theo case thì cái miễn trừ chết theo case.
 *
 *   ③ CÓ HẠN. Mặc định 30 ngày. Một miễn trừ vĩnh viễn là một luật mới được viết bằng cờ dòng lệnh, mà
 *     luật thì phải vào file canonical và phải có người đọc.
 *
 *   ④ GHI RA NGOÀI TASK. Bản ghi vào `knowledge/decisions/`, không vào `outputs/<task>/`: thư mục task
 *     bị dọn thì lý do mất theo, và lần sau người ta lại miễn trừ lại từ đầu mà không biết đã từng.
 *
 * KHÔNG CÓ HÀM NÀO Ở ĐÂY TỰ GHI KHI CHƯA QUA ĐỦ BỐN HÀNG RÀO. `tao()` trả về `{ ok: false }` trước khi
 * chạm đĩa.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));

/** Vai trò được quyền miễn trừ. Lấy từ `decisions.js` để không có hai danh sách. */
const VAI_TRO = ['QA-Lead', 'PO', 'Dev-Lead'];
const TOI_THIEU_LY_DO = 20;
const HAN_MAC_DINH_NGAY = 30;

/*
 * Đọc `gate_codes.json` — KHÔNG nuốt lỗi, cố ý.
 *
 * Chỗ này trước đây là một `docAn` nuốt im lặng và trả chuỗi rỗng. `gate:selfmutate` tìm ra nó: đổi nhánh
 * `catch` mà cả bộ spec vẫn xanh. Vá đúng không phải là thêm một test cho nhánh chết, mà là BỎ nhánh đó —
 * override cần biết tầng của mã để từ chối T0, nên không đọc được bảng mã thì phải DỪNG, không phải chạy
 * tiếp với một bảng rỗng rồi báo "mã không có thật" (đúng hướng an toàn, nhưng vì lý do sai và lời báo sai).
 */
function docBangMa() {
  const p = path.join(REPO, '.agent', 'config', 'gate_codes.json');
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch (e) {
    throw new Error(`override: KHÔNG đọc được .agent/config/gate_codes.json (${e.code || e.message}). Không biết tầng của mã thì không được cấp miễn trừ.`, { cause: e });
  }
  try { return JSON.parse(txt); } catch (e) {
    throw new Error(`override: .agent/config/gate_codes.json SAI cú pháp JSON (${e.message}).`, { cause: e });
  }
}

/** Tầng của một mã, đọc từ `gate_codes.json` — một nguồn với §A5. */
function tangCuaMa(ma) {
  const cfg = docBangMa();
  const ds = Array.isArray(cfg) ? cfg : (cfg.codes || []);
  const m = ds.find((x) => String(x.code).toUpperCase() === String(ma).toUpperCase());
  return m ? { tang: m.tang, y: m.y, co_that: true } : { tang: null, co_that: false };
}

const DIR_DECISIONS = () => path.join(REPO, 'knowledge', 'decisions');

const ngayISO = (d) => d.toISOString().slice(0, 10);

/** Slug cho `id`: DEC-<SLUG>-<NNN>, SLUG chỉ A-Z0-9 theo `ID_RE` của decisions.js. */
function slugCua(taskKey, ma) {
  return `${taskKey}${ma}`.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24) || 'OVERRIDE';
}

function soTiepTheo(dir, slug) {
  if (!fs.existsSync(dir)) return 1;
  const re = new RegExp(`^DEC-${slug}-(\\d{3})\\.json$`);
  let max = 0;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/**
 * Kiểm bốn hàng rào. Trả `{ ok, vi_sao }` và KHÔNG chạm đĩa.
 */
function kiem({ ma, tcIds, lyDo, by }) {
  const t = tangCuaMa(ma);
  if (!t.co_that) {
    return { ok: false, vi_sao: `mã "${ma}" không có trong \`gate_codes.json\` — miễn trừ một mã không tồn tại là một bản ghi vô nghĩa` };
  }
  /* ① */
  if (t.tang === 'T0') {
    return {
      ok: false,
      tang: 'T0',
      vi_sao: `"${ma}" là T0 — KHÔNG có cờ override nào.\n`
        + `  ${t.y}\n`
        + '  T0 là chỗ vi phạm tạo ra NGAY một kết luận sai, làm hỏng dữ liệu, hoặc lộ thông tin. Không có\n'
        + '  vai trò nào miễn được, và cũng KHÔNG ghi bản ghi nào — một bản ghi nói "T0 đã được miễn" sẽ\n'
        + '  được đọc lại sau, và lúc đó nó là một tiền lệ.\n'
        + '  Thứ cần sửa là nội dung. Nếu gate báo oan thì sửa LUẬT của nó kèm một phép kiểm-âm.',
    };
  }
  /* ②b TC ID phải ĐÚNG KHUÔN mà kit dùng để nhận ra nó trong thông điệp.
   *
   * ĐÂY LÀ MỘT LỖ THẬT, phát hiện lúc viết spec. `gate_engine.tcIdTrong()` nhận TC ID theo khuôn
   * `<TIỀN TỐ>_TC_<số>` (vd `APP_HSTRUONG_TC_001`). Truyền `--tc TC_001` trần thì bản ghi miễn trừ
   * VẪN ĐƯỢC GHI nhưng KHÔNG BAO GIỜ khớp finding nào — và đó tệ hơn bị từ chối, vì người ta tin là
   * đã được che rồi đi tiếp.
   *
   * Khuôn lấy từ chính `gate_engine` để không có hai định nghĩa "TC ID trông thế nào".
   */
  const KHUON_TC = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+$/;
  const sai = (tcIds || []).filter((x) => !KHUON_TC.test(String(x).trim()));
  if (tcIds && tcIds.length && sai.length) {
    return {
      ok: false,
      vi_sao: [
        `TC ID sai khuôn: ${sai.join(', ')}.`,
        '  Kit nhận TC ID trong thông điệp gate theo khuôn `<TIỀN TỐ>_TC_<số>`, ví dụ `APP_HSTRUONG_TC_001`.',
        '  Truyền mã trần như `TC_001` thì bản ghi vẫn ghi được nhưng KHÔNG BAO GIỜ khớp vi phạm nào, và',
        '  điều đó tệ hơn bị từ chối: bạn tin là đã được che rồi đi tiếp.',
      ].join('\n'),
    };
  }
  /* ② */
  if (!tcIds || !tcIds.length) {
    return {
      ok: false,
      vi_sao: 'thiếu `--tc <TC_ID>` — miễn trừ phải khoanh theo CASE.\n'
        + '  Miễn cả một mã cho cả task nghĩa là tắt một phép kiểm bằng một dòng, và lần sau có case mới\n'
        + '  vi phạm đúng mã đó thì nó cũng được miễn mà không ai khai. Khoanh theo case thì miễn trừ chết\n'
        + '  theo case.',
    };
  }
  /* ③ lý do */
  if (!lyDo || String(lyDo).trim().length < TOI_THIEU_LY_DO) {
    return { ok: false, vi_sao: `\`--reason\` phải dài hơn ${TOI_THIEU_LY_DO} ký tự và nói được vì sao case này được miễn` };
  }
  /* ④ vai trò */
  if (!VAI_TRO.includes(String(by))) {
    return { ok: false, vi_sao: `\`--by\` phải ∈ ${VAI_TRO.join(' | ')} — miễn trừ là một quyết định có người chịu trách nhiệm` };
  }
  return { ok: true, tang: t.tang };
}

/**
 * Tạo bản ghi miễn trừ. Trả `{ ok, duong }` hoặc `{ ok:false, vi_sao }`.
 *
 * Ghi dạng `test_approach` chứ không `risk_override`: `risk_override` theo schema của `decisions.js` đòi
 * `scope.modules`, và nó mang nghĩa "QA đã hạ band của một module". Miễn một mã gate cho vài case là một
 * quyết định về CÁCH TEST, không phải về band rủi ro. Dùng sai type làm `risk:score` đọc nó như một
 * override band ở task sau.
 */
function tao({ taskKey, ma, tcIds, lyDo, by, evidence = '', hanNgay = HAN_MAC_DINH_NGAY, dir = null }) {
  const k = kiem({ ma, tcIds, lyDo, by });
  if (!k.ok) return k;

  const d = dir || DIR_DECISIONS();
  const slug = slugCua(taskKey, ma);
  const so = String(soTiepTheo(d, slug)).padStart(3, '0');
  const homNay = new Date();
  const hetHan = new Date(homNay.getTime() + hanNgay * 86400000);

  const ban = {
    id: `DEC-${slug}-${so}`,
    type: 'test_approach',
    subject: `Miễn trừ gate ${ma} cho ${tcIds.join(', ')} (task ${taskKey})`,
    decision: `Vi phạm \`${ma}\` ở ${tcIds.length} case được VƯỢT QUA ở tầng T1, không chặn tới ${ngayISO(hetHan)}.`,
    rationale: String(lyDo).trim(),
    decided_by: by === 'Dev-Lead' ? 'Dev' : by,
    decided_at: ngayISO(homNay),
    expires_at: ngayISO(hetHan),
    status: 'active',
    scope: { tc_ids: tcIds, modules: [], bug_keys: [] },
    /*
     * `evidence` là CẢNH BÁO chứ không CHẶN, và giữ nguyên như vậy có lý do: một miễn trừ hợp lệ có
     * thể không có gì để trỏ (vd 'module này cố ý chưa bật cho người dùng'). Bắt buộc nó sẽ làm người
     * ta dán một đường dẫn bất kỳ cho đủ ô, và lúc đó ô đó thôi mang thông tin.
     */
    evidence: String(evidence || '').trim(),
    _la_gi: 'Miễn trừ gate sinh bởi `check --override` (v2.7.0 §A8). Chỉ áp cho tầng T1; T0 không có đường này.',
    _het_han_thi_sao: 'Hết hạn mà vi phạm vẫn còn thì gate chặn lại. Gia hạn là một quyết định MỚI, không phải sửa ngày ở đây — sửa ngày là biến miễn trừ có hạn thành vĩnh viễn.',
    _ma: ma,
    _tang: k.tang,
    _task: taskKey,
    _sinh_boi: 'npm run check -- --override',
  };

  fs.mkdirSync(d, { recursive: true });
  const duong = path.join(d, `${ban.id}.json`);
  fs.writeFileSync(duong, `${JSON.stringify(ban, null, 2)}\n`, 'utf8');
  /*
   * Ghi SỔ MA SÁT (§A9). Một lượt miễn trừ là tín hiệu về ma sát của gate đó, nhưng nó KHÔNG
   * phải một lượt báo oan: người ta miễn trừ cả khi gate ĐÚNG mà việc vẫn phải đi tiếp. Hai chuyện đó
   * lẫn vào nhau thì một gate đúng mà hay bị vướng sẽ bị kết luận là gate sai, rồi bị nới.
   *
   * Bọc `try`: đây là lớp ĐO, và không ghi được sổ thì KHÔNG được làm chết việc ghi miễn trừ.
   */
  try {
    /* eslint-disable-next-line global-require */
    const fric = require(path.join(__dirname, 'gate_friction.js'));
    fric.ghi('mien_tru', { gate: ma, tang: k.tang, task: taskKey, ma, tcId: tcIds[0] || null, thuMuc: d });
  } catch (e) { /* sổ đo KHÔNG được làm chết việc ghi miễn trừ */ }
  return { ok: true, duong, ban };
}

/**
 * Đọc mọi miễn trừ CÒN HIỆU LỰC cho một task.
 *
 * "Còn hiệu lực" = `status: active` VÀ `expires_at >= hôm nay`. Hết hạn thì nó KHÔNG còn che gì, và điều
 * đó phải tự xảy ra — không cần ai đi dọn. Một miễn trừ chỉ hết tác dụng khi có người dọn là một miễn
 * trừ vĩnh viễn trên thực tế.
 */
function dangHieuLuc(taskKey, { dir = null, homNay = null } = {}) {
  const d = dir || DIR_DECISIONS();
  if (!fs.existsSync(d)) return [];
  const nay = homNay || ngayISO(new Date());
  const ra = [];
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch (e) { continue; }
    if (!j._ma || j._task !== taskKey) continue;
    if (j.status !== 'active') continue;
    if (j.expires_at && String(j.expires_at) < nay) continue;
    ra.push({
      ma: j._ma,
      tc_ids: (j.scope && j.scope.tc_ids) || [],
      ly_do: j.rationale,
      by: j.decided_by,
      het_han: j.expires_at,
      id: j.id,
    });
  }
  return ra;
}

/**
 * Lọc findings theo miễn trừ. Trả `{ con_lai, da_vuot_qua }`.
 *
 * Miễn trừ KHỚP theo cả mã VÀ TC ID. Khớp mã mà khác case thì không che — đó là ý nghĩa của hàng rào ②.
 */
function apDung(findings, mienTru, { maCua, tcIdTrong }) {
  const conLai = [];
  const daVuot = [];
  for (const f of findings) {
    const ma = maCua(f.message || f);
    const tcId = tcIdTrong(f.message || f);
    const hit = mienTru.find((m) => m.ma === ma && tcId && m.tc_ids.includes(tcId));
    if (hit) daVuot.push({ ...f, _mien_tru: hit });
    else conLai.push(f);
  }
  return { con_lai: conLai, da_vuot_qua: daVuot };
}

module.exports = {
  VAI_TRO, TOI_THIEU_LY_DO, HAN_MAC_DINH_NGAY,
  tangCuaMa, kiem, tao, dangHieuLuc, apDung, slugCua, DIR_DECISIONS,
};
