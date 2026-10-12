'use strict';

/*
 * gate_engine.js (#2 architecture hardening) — INTERFACE gate CHUẨN + aggregator.
 *
 * Round-3 đẻ ra nhiều gate (preflight/design/output/risk/inventory...), mỗi cái tự console.log +
 * tự quyết exit → khó gộp "task fail vì gate nào?". GateEngine chuẩn hoá:
 *   GateResult = { gateId, status: PASS|WARN|FAIL|SKIP, severity: P0|P1|P2, findings:[{level,message}], counts }
 * và `aggregate()` gộp → 1 quyết định. Đa số gate đã trả {problems, warnings} → `toResult()` bọc lại;
 * KHÔNG cần sửa lõi gate (CI/hook/bug_reporter vẫn gọi hàm cũ). Engine là lớp GỘP thêm (self_review dùng).
 *
 * @typedef {'PASS'|'WARN'|'FAIL'|'SKIP'} GateStatus
 * @typedef {{ level: 'FAIL'|'WARN', message: string }} Finding
 * @typedef {{ gateId: string, status: GateStatus, severity: 'P0'|'P1'|'P2', findings: Finding[], note: string, counts: {fail:number, warn:number} }} GateResult
 */

/*
 * ── IN GỌN (`--compact`, H5 của token-diet) ──────────────────────────────────────────────────────────
 *
 * VÌ SAO: đo bằng `npm run token:audit` trên 4 lượt chạy task thật thì `output gate` chiếm 4,3 đến 8,9%
 * khối lượng kết quả tool, khoảng 54k token mỗi lượt. Phần lớn là lời giải thích DÀI lặp lại cho từng
 * case. Lời giải thích đó cần thiết lần đầu; từ lần thứ hai nó là bản sao.
 *
 * VÀ ĐÂY LÀ LỚP TRÌNH BÀY, KHÔNG PHẢI LỚP LỌC. Hai ràng buộc không được phá:
 *   ① KHÔNG bỏ dòng nào. Mọi vi phạm đều xuất hiện, kể cả vi phạm không khớp mã nào (nhận mã `KHAC`).
 *      `--compact` làm output ngắn bằng cách bớt LỜI GIẢI THÍCH, không bằng cách bớt VI PHẠM.
 *   ② KHÔNG sửa thông điệp gốc. Hàng chục spec đang khớp theo chữ trong thông điệp; thêm mã vào thông
 *      điệp sẽ làm đỏ chúng hàng loạt. Mã được gán bằng cách KHỚP vào thông điệp, nên chế độ đầy đủ
 *      giữ nguyên từng chữ.
 *
 * Spec tương đương (`compact-mode.spec.ts`) khoá cả hai: cùng exit code, và cùng TẬP (mã, TC ID).
 */
let CODES_CACHE = null;
function loadCodes() {
  if (CODES_CACHE) return CODES_CACHE;
  try {
    /* require TĨNH: đường dẫn cứng nên không cần `path.resolve`, và không cần tắt luật lint nào. */
    const cfg = require('../../../.agent/config/gate_codes.json');
    CODES_CACHE = {
      nguong: cfg.nguong_gop || 5,
      codes: (cfg.codes || []).map((c) => ({ code: c.code, re: new RegExp(c.khop, 'i'), y: c.y })),
    };
  } catch (e) {
    CODES_CACHE = { nguong: 5, codes: [] };
  }
  return CODES_CACHE;
}

/*
 * MÃ ỔN ĐỊNH của một thông điệp vi phạm — và vì sao KHÔNG lấy mã khớp đầu tiên.
 *
 * Bản trước duyệt danh sách mã theo thứ tự khai và trả cái khớp đầu. Đo 12/10/2026 trên 7.939 chuỗi
 * literal trong `scripts/**.js`: 18 chuỗi khớp HAI mã hoặc hơn, và trong đó có cặp hai mã T0 —
 * `FAIL_CHUA_PHAN_TANG` và `RERUN_THIEU`. Nghĩa là THỨ TỰ KHAI quyết định mã, và người sửa đọc sai hướng
 * dẫn `vì sao`/`sửa` của mã khác.
 *
 * Nguyên nhân là vài `khop` chỉ có một từ: `rỗng`, `comment`, `rerun`. Một từ như vậy khớp cả câu không
 * liên quan (`catalog rỗng không kiểm được gì` là chuyện của `UI_CATALOG`).
 *
 * Luật mới: KHỚP DÀI NHẤT THẮNG. Đoạn khớp dài hơn nghĩa là mẫu mang nhiều ngữ cảnh hơn, nên nó cụ thể
 * hơn. Bằng nhau thì theo thứ tự khai, để kết quả không đổi giữa hai lượt.
 *
 * GIỚI HẠN, và nó quan trọng: khớp-dài-nhất là phỏng đoán, không phải chứng minh. Nó chỉ đổi mặc định từ
 * "mã nào khai trước" sang "mã nào cụ thể hơn". Chỗ nhập nhằng vẫn PHẢI được khai và rà — đó là việc của
 * `gate:policy`, và vì vậy `maCuaChiTiet` trả về cả danh sách ứng viên chứ không chỉ một mã.
 */
function maCuaChiTiet(message) {
  const s = String(message || '');
  const ungVien = [];
  for (const c of loadCodes().codes) {
    const m = s.match(c.re);
    if (m) ungVien.push({ code: c.code, dai: m[0].length, khop: m[0] });
  }
  if (!ungVien.length) return { ma: 'KHAC', ung_vien: [] };
  let tot = ungVien[0];
  for (const u of ungVien) if (u.dai > tot.dai) tot = u;
  return { ma: tot.code, ung_vien: ungVien };
}

/** Mã ổn định của một thông điệp vi phạm. Không khớp mã nào thì `KHAC` — vẫn được in. */
function maCua(message) {
  return maCuaChiTiet(message).ma;
}

/** TC ID trong thông điệp, nếu có. Không có thì trả chuỗi rỗng — KHÔNG bịa. */
function tcIdTrong(message) {
  const m = String(message || '').match(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+)\b/);
  return m ? m[1] : '';
}

/** Ý chính: bỏ tiền tố file và TC ID, cắt còn tối đa `max` ký tự. */
function yChinh(message, max = 120) {
  let s = String(message || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^\u00b7]*\.md \u00b7 /, '');
  const i = s.indexOf(': ');
  if (i > 0 && i < 40) s = s.slice(i + 2);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Dựng các dòng in gọn từ danh sách thông điệp.
 * Trả `{ dong, tap }` — `tap` là tập (mã, TC ID) dùng để chứng minh tương đương với chế độ đầy đủ.
 */
function nenGon(messages) {
  const { nguong } = loadCodes();
  const theoMa = new Map();
  const tap = new Set();
  for (const m of messages || []) {
    const ma = maCua(m);
    const id = tcIdTrong(m);
    tap.add(ma + '|' + id);
    if (!theoMa.has(ma)) theoMa.set(ma, []);
    theoMa.get(ma).push({ id, y: yChinh(m) });
  }
  const dong = [];
  for (const [ma, list] of theoMa) {
    for (const x of list.slice(0, nguong)) {
      dong.push(ma + ' \u00b7 ' + (x.id || '-') + ' \u00b7 ' + x.y);
    }
    if (list.length > nguong) {
      const con = list.slice(nguong);
      const ids = con.map((x) => x.id).filter(Boolean);
      dong.push(ma + ' \u00b7 và ' + con.length + ' case cùng lỗi' + (ids.length ? ': ' + ids.join(', ') : ''));
    }
  }
  return { dong, tap };
}

/** In khối vi phạm ở chế độ gọn. `nhan` là chữ đứng đầu mỗi dòng. */
function inGon(messages, { nhan = '-', log = console.log } = {}) {
  const { dong } = nenGon(messages);
  dong.forEach((d) => log('  ' + nhan + ' ' + d));
  /* Chú thích phải NGẮN. Đo trên dải 1, 2, 3, 4, 6, 8, 11 vi phạm: bản chú thích dài tốn khoảng
   * 125 byte, đủ để chế độ GỌN to hơn chế độ đầy đủ ở khoảng 3 đến 6 vi phạm. Một chế độ tiết kiệm
   * mà tốn thêm là một chế độ không ai bật. */
  if (dong.length >= 3) log('  (bỏ --compact để xem giải thích đầy đủ)');
  return dong.length;
}

/*
 * ── LUẬT "KIỂM 0 THỨ THÌ KHÔNG ĐƯỢC BÁO ĐẠT" (v2.7.0 §A10.1) ────────────────────────────────────────
 *
 * BA LỖI THẬT CÙNG MỘT KIỂU, và cả ba đều xanh:
 *   · `expansion_audit` đọc `t.id` thay vì `t.tcId` ⇒ báo "0/6 đỏ" mà trông rất yên tâm;
 *   · `dimension_coverage` đọc một file config bị thiếu, rơi vào `catch → []` ⇒ gate tắt, không báo gì;
 *   · bộ 530 case được tính "đủ coverage" trong khi một chiều chỉ phủ 12%.
 *
 * Cùng một gốc: **gate xanh vì không kiểm gì, chứ không phải vì đúng.** Và nó không phát hiện được từ
 * output, vì một gate kiểm 0 thứ in ra đúng y như một gate kiểm xong và không thấy vi phạm.
 *
 * Nên `CHUA_KIEM` là một trạng thái RIÊNG, không gộp vào `SKIP` lẫn `PASS`:
 *   · `PASS`      — đã kiểm N thứ, N > 0, không thấy vi phạm;
 *   · `SKIP`      — chiều/phép kiểm này KHÔNG áp dụng cho task (người khai, có lý do);
 *   · `CHUA_KIEM` — đã CHẠY nhưng mẫu số bằng 0, hoặc thấp hơn rõ so với đầu vào thực tế.
 *
 * Gộp `CHUA_KIEM` vào `SKIP` làm nó biến mất khỏi mọi phép đếm "còn gì chưa kiểm"; gộp vào `PASS` thì
 * đúng là ba lỗi trên.
 */
const STATUS = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL', SKIP: 'SKIP', CHUA_KIEM: 'CHUA_KIEM' };
const SEVERITY = { P0: 'P0', P1: 'P1', P2: 'P2' };

/*
 * Ngưỡng "thấp hơn rõ": mẫu số dưới 50% đầu vào thực tế là dấu hiệu gate đọc sai trường hoặc rơi vào
 * `catch`. Không đặt 100% vì có phép kiểm chỉ áp cho một phần đầu vào một cách hợp lệ (vd chỉ case đã
 * execute). Chọn một nửa vì nó bắt được ba ca ở trên (0/6, 0 case, 12%) mà không báo oan ca hợp lệ.
 */
const TI_LE_MAU_SO_TOI_THIEU = 0.5;

/**
 * Chấm mẫu số của một gate. Trả `null` nếu ổn, hoặc một `{ status, note }` để `toResult` dùng.
 *
 * @param {number|null} mauSo    số thứ gate ĐÃ ĐỌC được (case, file, ảnh, dòng)
 * @param {number|null} dauVao   số thứ ĐÁNG LẼ có (nếu biết). Không biết thì truyền `null`.
 */
function kiemMauSo(mauSo, dauVao = null) {
  if (mauSo === null || mauSo === undefined) {
    return { status: STATUS.CHUA_KIEM, note: 'gate KHÔNG khai mẫu số — không biết nó đã kiểm bao nhiêu thứ' };
  }
  if (mauSo === 0) {
    return { status: STATUS.CHUA_KIEM, note: 'mẫu số = 0: gate đã CHẠY nhưng không đọc được thứ gì để kiểm' };
  }
  if (dauVao !== null && dauVao > 0 && mauSo / dauVao < TI_LE_MAU_SO_TOI_THIEU) {
    return {
      status: STATUS.CHUA_KIEM,
      note: `mẫu số ${mauSo} trên ${dauVao} đầu vào (${Math.round((mauSo / dauVao) * 100)}%) — thấp hơn rõ, `
        + 'thường là đọc sai tên trường hoặc rơi vào `catch`',
    };
  }
  return null;
}

/**
 * Bọc kết quả 1 gate (shape {problems, warnings}) → GateResult chuẩn.
 * @param {string} gateId
 * @param {{ problems?: string[], warnings?: string[], skipped?: boolean, severity?: string, note?: string }} o
 * @returns {GateResult}
 */
function toResult(gateId, {
  problems = [], warnings = [], skipped = false, severity = SEVERITY.P1, note = '',
  mauSo = undefined, dauVao = null,
} = {}) {
  const findings = [
    ...problems.map((m) => ({ level: STATUS.FAIL, message: String(m) })),
    ...warnings.map((m) => ({ level: STATUS.WARN, message: String(m) })),
  ];
  let status = skipped ? STATUS.SKIP : (problems.length ? STATUS.FAIL : (warnings.length ? STATUS.WARN : STATUS.PASS));
  let ghiChu = note;

  /*
   * MẪU SỐ CHỈ CHẤM KHI GATE KHAI NÓ. Nó hạ `PASS` **và** `WARN` xuống `CHUA_KIEM`; chỉ `FAIL` được miễn.
   *
   * Vì sao không chấm khi gate không khai: hàng chục gate đang gọi `toResult` theo hợp đồng cũ, và bắt
   * mọi gate khai mẫu số NGAY sẽ đổi tất cả chúng thành `CHUA_KIEM` trong một commit. Lúc đó cả bộ đỏ
   * vì một thay đổi hợp đồng, không vì một vi phạm nào — và không ai đọc được cái đỏ đó.
   *
   * Vì sao `WARN` CŨNG bị hạ, và đây là một lỗ đã đo được: bản đầu chỉ hạ `PASS`, nên `gate:output`
   * chạy trên một task có 0 case execute vẫn báo `WARN` và luật A10.1 không áp. Một cảnh báo trên mẫu
   * số 0 là cảnh báo về chỗ CHƯA ĐO GÌ — nó không nói được điều gì về sản phẩm.
   *
   * Vì sao `FAIL` được miễn: một gate đọc được ít nhưng ĐÃ THẤY vi phạm thì vi phạm đó vẫn thật. Hạ nó
   * xuống "chưa kiểm" là bỏ một phát hiện có thật.
   *
   * Phần ÉP mọi gate khai mẫu số là việc của `gate:policy` (xem §A10.3), không của hàm này.
   */
  if (mauSo !== undefined && (status === STATUS.PASS || status === STATUS.WARN)) {
    const v = kiemMauSo(mauSo, dauVao);
    if (v) {
      status = v.status;
      ghiChu = ghiChu ? `${ghiChu} · ${v.note}` : v.note;
    }
  }

  return {
    gateId,
    status,
    severity,
    findings,
    note: ghiChu,
    mau_so: mauSo === undefined ? null : mauSo,
    dau_vao: dauVao,
    counts: { fail: problems.length, warn: warnings.length },
  };
}

/**
 * Gộp nhiều GateResult → quyết định tổng. overall = FAIL nếu có gate FAIL, else WARN nếu có WARN, else PASS.
 * @param {GateResult[]} results
 */
function aggregate(results) {
  const list = (results || []).filter(Boolean);
  const totalFail = list.reduce((s, r) => s + r.counts.fail, 0);
  const totalWarn = list.reduce((s, r) => s + r.counts.warn, 0);
  const chuaKiem = list.filter((r) => r.status === STATUS.CHUA_KIEM).map((r) => r.gateId);
  /*
   * `CHUA_KIEM` KHÔNG được rơi vào nhánh `PASS` của phép gộp.
   *
   * Nếu không có nó ở đây thì một bộ gồm 40 gate PASS và 3 gate CHUA_KIEM sẽ gộp thành `PASS`, và dòng
   * tổng nói "mọi thứ đạt" trong khi ba phép kiểm chưa chạy được. Đó đúng là cách ba lỗi ở đầu file
   * sống sót: mỗi cái đều nằm trong một bộ trông toàn xanh.
   *
   * Nó cũng KHÔNG thành `FAIL`: chưa kiểm được không phải một vi phạm, và gộp nó vào FAIL làm người ta
   * đi tìm một lỗi không tồn tại.
   */
  const status = list.some((r) => r.status === STATUS.FAIL) ? STATUS.FAIL
    : (chuaKiem.length ? STATUS.CHUA_KIEM
      : (list.some((r) => r.status === STATUS.WARN) ? STATUS.WARN : STATUS.PASS));
  const blockers = list.filter((r) => r.status === STATUS.FAIL).map((r) => r.gateId);
  return { status, totalFail, totalWarn, blockers, chua_kiem: chuaKiem, results: list };
}

const MARK = { PASS: '✓ OK', WARN: '⚠ warn', FAIL: '✗ CHẶN', SKIP: '○ n/a', CHUA_KIEM: '◌ CHƯA KIỂM' };

/** Format 1 báo cáo checklist người-đọc từ aggregate(). */
function format(agg, { title = 'GATE ENGINE', failHead = 15, warnHead = 8 } = {}) {
  const L = [`\n=== ${title} ===`];
  for (const r of agg.results) {
    L.push(`\n${MARK[r.status] || r.status}  [${r.severity}] ${r.gateId}${r.note ? ` (${r.note})` : ''}`);
    const fails = r.findings.filter((f) => f.level === STATUS.FAIL);
    fails.slice(0, failHead).forEach((f) => L.push(`    - ${f.message}`));
    if (fails.length > failHead) L.push(`    … +${fails.length - failHead} CHẶN nữa`);
    const warns = r.findings.filter((f) => f.level === STATUS.WARN);
    warns.slice(0, warnHead).forEach((f) => L.push(`    ~ ${f.message}`));
    if (warns.length > warnHead) L.push(`    … +${warns.length - warnHead} cảnh báo nữa`);
  }
  L.push(`\n=== Tổng: ${agg.totalFail} CHẶN · ${agg.totalWarn} cảnh báo · overall ${agg.status}${agg.blockers.length ? ` (CHẶN ở: ${agg.blockers.join(', ')})` : ''} ===`);
  /*
   * CHƯA KIỂM phải KÈM CÂU PHỦ ĐỊNH, không chỉ một dấu `◌`.
   *
   * Dấu riêng là cần nhưng chưa đủ: người đọc thấy một dòng không có `✗` sẽ đọc nó thành "không có vấn
   * đề". `◌ CHƯA KIỂM` nghĩa là gate ĐÃ CHẠY mà không đọc được gì — tức chỗ đó KHÔNG CÓ phép đo nào, và
   * đó là trạng thái cần xử lý, không phải trạng thái sạch. Non-negotiable §3: "không phán được" KHÔNG
   * thành PASS.
   */
  if (agg.chua_kiem && agg.chua_kiem.length) {
    L.push(`    ◌ ${agg.chua_kiem.length} gate CHƯA KIỂM được gì (${agg.chua_kiem.join(', ')}) — đây KHÔNG phải đạt,`);
    L.push('      mà là chỗ chưa có phép đo nào. Xem gate đó đọc đầu vào ở đâu và vì sao mẫu số bằng 0.');
  }
  return L.join('\n');
}

module.exports = { STATUS, SEVERITY, TI_LE_MAU_SO_TOI_THIEU, kiemMauSo, toResult, aggregate, format, maCua, maCuaChiTiet, tcIdTrong, yChinh, nenGon, inGon,};
