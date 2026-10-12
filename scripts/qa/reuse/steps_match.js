#!/usr/bin/env node
'use strict';
/*
 * steps:match — KHỚP CÂU BƯỚC CỦA TESTCASE VỚI DANH MỤC BƯỚC (v2.8.0 §C2).
 *
 * KHỚP BẰNG LUẬT VÀ MẪU, KHÔNG DÙNG MODEL. Đó là điều kiện để cả đợt này có nghĩa: nếu khớp bước cần gọi
 * AI thì mỗi lượt chạy lại vẫn tốn token, và "dùng lại" chỉ chuyển chi phí từ viết code sang gọi model.
 * Model chỉ được gọi ở MỘT chỗ hẹp: chọn giữa các ứng viên `fuzzy` đã có sẵn (§C2.3), và nó không được
 * bịa mã ngoài danh sách.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ĐO TRƯỚC KHI THIẾT KẾ — 952 case · 4080 câu bước · 5338 mệnh đề, 5 task thật (12/10/2026).
 *
 * Ba con số đổi thiết kế, và một trong đó phủ chính mục tiêu §G:
 *
 *   1. Gộp đồng nghĩa KHÔNG phải đòn bẩy như tôi tưởng: nó nâng tỉ lệ khớp từ 25% lên 26%. Giá trị thật
 *      của nó là giảm SỐ MỤC danh mục (3 khung `kích nút`/`bấm nút`/`click nút` thành 1 mục 269 lượt),
 *      không phải nâng tỉ lệ.
 *
 *   2. Tách mệnh đề là đòn bẩy thật: 37% → 47%. Câu bước của QA là câu ghép tới bốn thao tác.
 *
 *   3. Khớp TUYỆT ĐỐI chéo task chỉ 6–21%; thêm `fuzzy` ≥0.65 lên 12–39%. §G đặt mục ≥70% cùng module và
 *      ≥50% khác module — KHÔNG đạt được trên bộ case hiện có, và lý do không phải bộ khớp yếu. Soi các
 *      cặp `fuzzy` thì thấy nguyên nhân là THAM SỐ KHÔNG ĐƯỢC BỌC: `Nhập Stt 87 = 100` và
 *      `Nhập "Hệ số phụ cấp chức vụ lãnh đạo (%)" = 14` là CÙNG một bước, khác nhau ở chỗ một bên bọc
 *      nháy một bên không. Đòn bẩy nằm ở §K (chuẩn viết câu bước), không nằm ở bộ khớp này.
 *
 * LUẬT GỘP ĐỒNG NGHĨA — và lỗi nó sinh ra ở bản đầu. Bản đầu gộp trên chữ ĐÃ BỎ DẤU, thay ở MỌI vị trí.
 * Đo ra: `nhấn`/`nhận`/`nhân`/`nhãn` cùng thành `nhan`, nên nó đổi `xác nhận` → `xác bấm` (65 câu),
 * `nhân sự` → `bấm sự` (50 câu), `ghi vào evidence` → `ghi mở evidence` (13 câu), và sửa cả nội dung câu
 * `db_readonly: SELECT COUNT(*)` (34 câu). Giữ DẤU + chỉ thay ở VỊ TRÍ ĐỘNG TỪ ⇒ 0 va chạm còn lại.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/reuse/steps_match.js --task <K> [--json] [--nguong 0.65] [--md <file>]
 * Exit: 0 · 2 khi không có testcase hoặc không có danh mục (CHƯA ĐƯỢC GÁC)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));

const DUONG_DANH_MUC = path.join(REPO, 'tests', 'fe', 'lib', 'step_catalog.json');
const DUONG_NGU_PHAP = path.join(REPO, '.agent', 'config', 'step_phrasing.json');

/**
 * Ngưỡng `fuzzy`. 0.65 đo được: ở 0.65–0.75 các cặp soi bằng mắt phần lớn ĐÚNG ở tầng bước (cùng
 * `nhập {field} = {giaTri}`), chỉ khác chỗ bọc nháy. Dưới 0.55 thì bắt đầu ghép hai việc khác nhau.
 */
const NGUONG_MAC_DINH = 0.65;

/* ────────────────────────── NẠP LUẬT NGÔN NGỮ (một nguồn, §K) ────────────────────────── */

/**
 * Nạp `.agent/config/step_phrasing.json`. Thiếu file ⇒ trả `{ thieu: true }` và NÓI RA ở báo cáo.
 *
 * KHÔNG rơi về bộ mặc định im lặng. Một bộ khớp tụt chất lượng mà không ai biết thì tỉ lệ khớp giảm, và
 * người đọc kết luận "câu bước viết tự do quá" thay vì "thiếu file cấu hình".
 */
function napNguPhap() {
  let j;
  try { j = JSON.parse(fs.readFileSync(DUONG_NGU_PHAP, 'utf8')); } catch (e) {
    return { thieu: true, nhom: [], ngat: [',', ';', '→', 'rồi'] };
  }
  /*
   * Trải PHẲNG mọi cách viết của mọi nhóm rồi sắp theo SỐ TỪ GIẢM DẦN.
   *
   * Sắp trong từng nhóm là KHÔNG ĐỦ, và fixture bắt được đúng chuyện đó: nhóm `bấm` chứa `kích` (1 từ),
   * nhóm `chọn` chứa `kích chọn` (2 từ). Thử theo thứ tự nhóm thì `kích` thắng trước, và
   * `kích chọn combobox "cbCapHoc" = "THCS"` thành `bấm chọn combobox …` — một khung không có trong danh
   * mục, nên 41 lượt `kích chọn` trong case thật rơi hết vào `none`. Cụm dài phải thắng cụm ngắn kể cả
   * khi chúng ở hai nhóm khác nhau.
   */
  const phang = [];
  for (const g of (j.dong_nghia || {}).nhom || []) {
    if (!g.chuan) continue;
    for (const t of g.cung_nghia || []) phang.push({ tu: t, chuan: g.chuan });
  }
  phang.sort((a, b) => b.tu.split(' ').length - a.tu.split(' ').length);
  return { thieu: false, nhom: phang, ngat: (j.tach_menh_de || {}).dau_ngat || [',', ';', '→', 'rồi'], _nguon: j };
}

/* ────────────────────────── CHUẨN HOÁ CÂU ────────────────────────── */

/** Bỏ dấu, hạ chữ, gộp khoảng trắng. Chỉ dùng để SO — bản gốc luôn được giữ để in. */
function boDau(s) {
  return String(s || '')
    .normalize('NFC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Câu SQL — không tách mệnh đề, không gộp đồng nghĩa, không tách giá trị bên trong. */
function laCauSql(s) {
  return /db_readonly\s*:/i.test(s) || /\bselect\b/i.test(s);
}

/**
 * Gộp đồng nghĩa — trên chữ CÒN DẤU, chỉ ở VỊ TRÍ ĐỘNG TỪ.
 *
 * Vị trí động từ = đầu mệnh đề: đầu câu, hoặc ngay sau một dấu ngắt. Xem khối chú thích đầu file để biết
 * vì sao luật này không thể nới.
 */
function gopDongNghia(cau, nhom, ngat) {
  if (laCauSql(cau)) return String(cau);
  const tapNgat = new Set((ngat || []).map((x) => String(x).toLowerCase()));
  const tu = String(cau).split(/\s+/);
  let viTriDongTu = true;

  for (let i = 0; i < tu.length; i += 1) {
    if (viTriDongTu) {
      /* `nhom` đã được trải phẳng và sắp theo số từ giảm dần ở `napNguPhap` — cụm dài thắng cụm ngắn. */
      for (const g of nhom) {
        const n = g.tu.split(' ').length;
        if (tu.slice(i, i + n).join(' ').toLowerCase() !== g.tu.toLowerCase()) continue;
        tu[i] = g.chuan;
        for (let j = 1; j < n; j += 1) tu[i + j] = '';
        break;
      }
    }
    const sach = tu[i].replace(/[.)]$/, '').toLowerCase();
    viTriDongTu = tapNgat.has(sach) || /[,;→]$/.test(tu[i]);
  }
  return tu.filter(Boolean).join(' ');
}

/* Thứ tự thay QUAN TRỌNG: URL trước, vì `<ops_base_url>/c3/lop.aspx` chứa cả biến lẫn đường dẫn. */
const RE_URL = /<[a-z0-9_]+>\S*|https?:\/\/\S+/gi;
const RE_NHAY = /["“”']([^"“”']{1,120})["“”']/g;
const RE_VUONG = /\[([^[\]]{1,120})\]/g;
const RE_BIEN = /<[a-z0-9_]+>/gi;
/* Số trần: `Stt 87`, `khối 10`, `= 14`, `2025-2026`. Không ăn số nằm trong từ (`c3`, `1.1`). */
const RE_SO = /(?<![\w.])\d{1,8}(?:[.-]\d{1,8})*(?![\w.])/g;

/**
 * Tách giá trị thành tham số, trả `{ khung, giaTri }`.
 *
 * Nhận BỐN dạng, cả bốn đo được trong mẫu: nháy kép 31% · ngoặc vuông 6% (`kích nút [Đồng bộ dữ liệu]`
 * — bản đầu BỎ SÓT dạng này) · biến môi trường 182 lượt · **số trần**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * SỐ TRẦN LÀ THAM SỐ — đính chính một quyết định sai của chính tôi.
 *
 * Bản đầu đổi số trần thành `#` và KHÔNG tính là tham số, với lý lẽ "`Stt 87` chỉ vị trí dòng trên lưới,
 * không phải giá trị người dùng nhập". Lý lẽ đó sai ở đúng chỗ quan trọng nhất: `Stt 87` là thứ XÁC ĐỊNH
 * FIELD NÀO, tức nó là tham số đầu tiên của bước. Đo trên 1.079 mệnh đề của CSDL-9001: **330 mệnh đề
 * (31%)** trỏ field bằng `Stt #`, và với `#` không phải tham số thì không bước nào khớp được chúng — bất
 * kể danh mục có bao nhiêu mục.
 *
 * MỘT LƯỢT QUÉT TỪ TRÁI SANG PHẢI, không ba lượt `replace` nối nhau.
 *
 * Bản đầu chạy `RE_NHAY` trên cả câu, rồi `RE_VUONG`, rồi `RE_SO` — nên `giaTri` xếp theo LOẠI chứ không
 * theo VỊ TRÍ. Câu `nhập 5000 vào ô "Diện tích"` cho ra `['Diện tích', '5000']`, tức ngược thứ tự, và
 * `compile:spec` sẽ sinh `nhapO(page, man, "5000", "Diện tích")` — gọi hàm đúng với đối số đảo. Lỗi đó
 * không làm spec đỏ ở tầng biên dịch; nó đỏ ở UAT, với thông báo lạc hướng.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */
function tachGiaTri(s) {
  if (laCauSql(s)) return { khung: String(s), giaTri: [] };

  /* URL và biến môi trường thay TRƯỚC: `<ops_base_url>/c3/lop.aspx` chứa cả biến lẫn đường dẫn, và
   * chúng KHÔNG phải tham số bước — đường dẫn màn thuộc tầng L1. */
  const nguon = String(s).replace(RE_URL, '<U>').replace(RE_BIEN, '<U>');

  /* Một lượt quét: lấy mốc của cả ba dạng rồi xếp theo VỊ TRÍ. */
  const moc = [];
  const quet = (re, layGiaTri) => {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of nguon.matchAll(r)) moc.push({ tu: m.index, den: m.index + m[0].length, giaTri: layGiaTri(m) });
  };
  quet(RE_NHAY, (m) => m[1].trim());
  quet(RE_VUONG, (m) => m[1].trim());
  quet(RE_SO, (m) => m[0]);

  moc.sort((a, b) => a.tu - b.tu);

  const giaTri = [];
  let khung = '';
  let i = 0;
  for (const m of moc) {
    /* Mốc LỒNG NHAU bị bỏ: số nằm trong `"Khối 10"` đã thuộc mốc nháy kép rồi. */
    if (m.tu < i) continue;
    khung += nguon.slice(i, m.tu);
    khung += '{}';
    giaTri.push(m.giaTri);
    i = m.den;
  }
  khung += nguon.slice(i);
  return { khung, giaTri };
}

/**
 * Tách câu ghép thành mệnh đề. Đòn bẩy đo được lớn nhất: 37% → 47%.
 *
 * KHÔNG tách ở `và`: nó nối cả mệnh đề (`mở màn và đọc nhãn`) lẫn danh từ (`họ và tên`), nên tách ở đó
 * làm `Xoá trắng ô "Họ và tên"` vỡ làm hai. KHÔNG tách bên trong ngoặc, và không tách câu SQL.
 */
function tachMenhDe(cau, ngat) {
  const bo = String(cau).replace(/^\s*\d+\s*[.)]\s*/, '').trim();
  if (!bo) return [];
  if (laCauSql(bo)) return [bo];

  const tapNgat = new Set((ngat || []).map((x) => String(x).toLowerCase()).filter((x) => x !== ','));
  const ra = [];
  let buf = '';
  let nhay = 0;
  let vuong = 0;

  for (const phan of bo.split(/(\s+|,)/)) {
    for (const ch of phan) {
      if (ch === '"' || ch === '“' || ch === '”') nhay += 1;
      else if (ch === '[') vuong += 1;
      else if (ch === ']') vuong -= 1;
    }
    const trongNgoac = nhay % 2 === 1 || vuong > 0;
    const laDauNgat = phan === ',' || tapNgat.has(phan.trim().toLowerCase());
    if (!trongNgoac && laDauNgat) {
      if (buf.trim()) ra.push(buf.trim());
      buf = '';
      continue;
    }
    buf += phan;
  }
  if (buf.trim()) ra.push(buf.trim());
  /* Mệnh đề quá ngắn (`ok`, `và`) không phải thao tác. */
  return ra.filter((x) => x.replace(/\s/g, '').length >= 3);
}

/** Chuẩn hoá một mệnh đề thành dạng SO ĐƯỢC. Giữ bản gốc để in. */
function chuanHoaCau(menhDe, nguPhap) {
  const daGop = gopDongNghia(menhDe, nguPhap.nhom, nguPhap.ngat);
  const { khung, giaTri } = tachGiaTri(daGop);
  return { so: boDau(khung), goc: String(menhDe).trim(), giaTri };
}

/** Mẫu `phrases` của danh mục, chuẩn hoá CÙNG cách. `{ten}` thành `{}` để so hình dạng. */
function chuanHoaMau(mau, nguPhap) {
  const daGop = gopDongNghia(String(mau).replace(/\{[a-z0-9_]+\}/gi, '"{}"'), nguPhap.nhom, nguPhap.ngat);
  const { khung } = tachGiaTri(daGop);
  return boDau(khung);
}

/* ────────────────────────── ĐIỂM TƯƠNG ĐỒNG ────────────────────────── */

/**
 * Điểm tương đồng theo TỪ, không theo ký tự.
 *
 * Theo ký tự (Levenshtein) thì `bấm nút "Ghi"` và `bấm nút "Huỷ"` rất giống nhau — khác 3 ký tự — mà
 * chúng là hai việc NGƯỢC NHAU. Theo từ thì khác biệt đó nặng hơn, đúng với nghĩa.
 *
 * Jaccard trên tập từ, nhân hệ số theo động từ: khác động từ thì tụt mạnh, vì `bấm` và `nhập` là hai
 * thao tác khác hẳn và điểm cao giữa chúng chỉ sinh ứng viên rác cho người chọn.
 */
function diem(a, b) {
  const ta = a.split(' ').filter(Boolean);
  const tb = b.split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let giao = 0;
  for (const x of sa) if (sb.has(x)) giao += 1;
  const hop = new Set([...sa, ...sb]).size;
  return Math.min(1, (giao / hop) * (ta[0] === tb[0] ? 1.15 : 0.7));
}

/* ────────────────────────── KHỚP ────────────────────────── */

function napDanhMuc() {
  let j;
  try { j = JSON.parse(fs.readFileSync(DUONG_DANH_MUC, 'utf8')); } catch (e) { return null; }
  return Array.isArray(j.buoc) ? j : null;
}

/**
 * Khớp MỘT mệnh đề. Trả `{ kieu, buoc_id, diem, ung_vien }`.
 *
 * `exact` đòi HAI điều: hình dạng trùng tuyệt đối, VÀ số giá trị tách được khớp số tham số của bước.
 * Trùng hình dạng mà thiếu giá trị thì KHÔNG gọi được hàm — đó là `fuzzy`, không phải `exact`. Đây là
 * chỗ phân biệt "khớp được" với "chạy được", và nhập nhằng nó thì §D sinh ra spec gọi hàm thiếu đối số.
 */
function khopCau(menhDe, danhMuc, nguPhap, nguong) {
  const c = chuanHoaCau(menhDe, nguPhap);
  const bang = [];

  for (const b of danhMuc.buoc) {
    let tot = 0;
    for (const p of b.phrases || []) {
      const m = chuanHoaMau(p, nguPhap);
      if (m === c.so) { tot = 1; break; }
      const d = diem(c.so, m);
      if (d > tot) tot = d;
    }
    bang.push({ id: b.id, diem: tot, soParam: Object.keys(b.params || {}).length, status: b.status });
  }

  bang.sort((x, y) => y.diem - x.diem);
  const nhat = bang[0];
  if (!nhat || nhat.diem <= 0) return { kieu: 'none', cau: c.goc, diem: 0, ung_vien: [] };

  if (nhat.diem === 1 && c.giaTri.length === nhat.soParam) {
    return { kieu: 'exact', cau: c.goc, buoc_id: nhat.id, status: nhat.status, diem: 1, gia_tri: c.giaTri, ung_vien: [] };
  }

  const ungVien = bang.filter((x) => x.diem >= nguong).slice(0, 3);
  if (!ungVien.length) return { kieu: 'none', cau: c.goc, diem: Number(nhat.diem.toFixed(3)), ung_vien: [] };

  return {
    kieu: 'fuzzy',
    cau: c.goc,
    diem: Number(nhat.diem.toFixed(3)),
    gia_tri: c.giaTri,
    /* Tối đa 3 ứng viên — subagent chọn MỘT trong số này, hoặc trả `none`. Không được bịa mã ngoài. */
    ung_vien: ungVien.map((x) => ({ id: x.id, diem: Number(x.diem.toFixed(3)) })),
    _vi_sao_khong_exact: nhat.diem === 1
      ? `hình dạng trùng nhưng tách được ${c.giaTri.length} giá trị, bước cần ${nhat.soParam}`
      : 'hình dạng không trùng tuyệt đối',
  };
}

/** Tách cột `Các bước thực hiện` thành từng câu. `<br>` và xuống dòng đều là ranh giới. */
function tachCacBuoc(stepsRaw) {
  return String(stepsRaw || '')
    .split(/<br\s*\/?>|\r?\n/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

function docCase(duongMd, taskOutputDir) {
  const cases = [];
  const ds = [];
  if (duongMd) ds.push(path.isAbsolute(duongMd) ? duongMd : path.join(REPO, duongMd));
  else if (taskOutputDir) {
    const tcDir = path.join(taskOutputDir, 'test-cases');
    if (fs.existsSync(tcDir)) for (const f of fs.readdirSync(tcDir).filter((x) => x.endsWith('.md'))) ds.push(path.join(tcDir, f));
  }
  for (const p of ds) {
    try {
      const d = canonical.parseMarkdown(fs.readFileSync(p, 'utf8'));
      cases.push(...(d.tests || []));
    } catch (e) { /* không phải bảng canonical — bỏ qua; mẫu số ở báo cáo sẽ nói ra */ }
  }
  return cases;
}

function dungDo({ taskKey, taskOutputDir, nguong, duongMd }) {
  const danhMuc = napDanhMuc();
  if (!danhMuc) return { loi: 'khong-co-danh-muc' };

  const cases = docCase(duongMd, taskOutputDir);
  if (!cases.length) return { loi: 'khong-co-case' };

  const ng = napNguPhap();
  const ra = {
    task: taskKey,
    so_muc_danh_muc: danhMuc.buoc.length,
    so_case: cases.length,
    so_cau: 0,
    so_menh_de: 0,
    exact: 0,
    fuzzy: 0,
    none: 0,
    case: [],
    _thieu_ngu_phap: ng.thieu,
  };

  for (const t of cases) {
    const menhDe = [];
    for (const cau of tachCacBuoc(t.stepsRaw)) {
      ra.so_cau += 1;
      for (const md of tachMenhDe(cau, ng.ngat)) menhDe.push(khopCau(md, danhMuc, ng, nguong));
    }
    ra.so_menh_de += menhDe.length;
    for (const b of menhDe) ra[b.kieu] += 1;
    ra.case.push({ tcId: t.tcId, module: t.module, buoc: menhDe });
  }
  return ra;
}

/* ────────────────────────── BÁO CÁO ────────────────────────── */

function inBaoCao(d) {
  /*
   * MẪU SỐ trước TỈ LỆ. Một dòng "dùng lại 62%" không có mẫu số là con số vô nghĩa: 62% của 13 mệnh đề
   * và 62% của 5338 mệnh đề là hai kết luận khác hẳn nhau.
   */
  const n = d.so_menh_de;
  const pc = (x) => (n ? `${Math.round((x / n) * 100)}%` : 'n/a');
  console.log(`[steps-match] Task ${d.task} · danh mục ${d.so_muc_danh_muc} mục · ${d.so_case} case → ${d.so_cau} câu → ${n} mệnh đề`);
  console.log(`              dùng lại ngay: ${d.exact}/${n} (${pc(d.exact)}) · cần chọn: ${d.fuzzy}/${n} (${pc(d.fuzzy)}) · viết mới: ${d.none}/${n} (${pc(d.none)})`);

  if (!d.so_muc_danh_muc) {
    console.log('');
    console.log('              Danh mục có 0 mục ⇒ mọi mệnh đề đều `none`. Con số "viết mới 100%" ở trên KHÔNG');
    console.log('              nói gì về chất lượng câu bước.');
  }

  if (d._thieu_ngu_phap) {
    console.log('');
    console.log('⚠ Thiếu `.agent/config/step_phrasing.json` ⇒ không gộp đồng nghĩa, không biết dấu ngắt mệnh đề.');
    console.log('  Tỉ lệ ở trên THẤP HƠN mức đạt được với file đó — đừng đọc nó thành "câu bước viết tự do quá".');
  }

  /* Gom mệnh đề cần viết mới THEO MÀN: viết 9 bước của cùng một màn rẻ hơn 9 bước rải rác 9 màn. */
  const theoMan = new Map();
  for (const c of d.case) {
    for (const b of c.buoc) {
      if (b.kieu !== 'none') continue;
      const k = c.module || '(không module)';
      if (!theoMan.has(k)) theoMan.set(k, new Map());
      const m = theoMan.get(k);
      m.set(b.cau, (m.get(b.cau) || 0) + 1);
    }
  }
  if (theoMan.size) {
    console.log('');
    console.log('Viết mới (gom theo màn — mệnh đề lặp nhiều lượt thì một bước ăn nhiều chỗ):');
    for (const [k, m] of [...theoMan.entries()].sort((a, b) => b[1].size - a[1].size)) {
      const tongLuot = [...m.values()].reduce((s, x) => s + x, 0);
      console.log(`  ${k}: ${m.size} mệnh đề khác nhau / ${tongLuot} lượt`);
      for (const [cau, lan] of [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
        console.log(`      ${String(lan).padStart(3)}× ${cau.slice(0, 88)}`);
      }
      if (m.size > 3) console.log(`      … +${m.size - 3} mệnh đề nữa`);
    }
  }

  const fuzzy = d.case.flatMap((c) => c.buoc.filter((b) => b.kieu === 'fuzzy'));
  if (fuzzy.length) {
    console.log('');
    console.log(`Cần CHỌN (${fuzzy.length} mệnh đề) — chọn MỘT mã trong danh sách ứng viên, hoặc trả \`none\`:`);
    for (const b of fuzzy.slice(0, 5)) {
      console.log(`  "${b.cau.slice(0, 72)}"`);
      console.log(`      ứng viên: ${b.ung_vien.map((u) => `${u.id} (${u.diem})`).join(' · ')}`);
      console.log(`      vì sao không exact: ${b._vi_sao_khong_exact}`);
    }
    if (fuzzy.length > 5) console.log(`  … +${fuzzy.length - 5} mệnh đề nữa`);
  }

  const draft = d.case.flatMap((c) => c.buoc.filter((b) => b.kieu === 'exact' && b.status === 'draft'));
  if (draft.length) {
    console.log('');
    console.log(`⚠ ${draft.length} mệnh đề khớp vào bước \`draft\` — bước chưa kiểm chứng KHÔNG được dùng để kết luận PASS.`);
  }

  console.log('');
  console.log('Agent chỉ viết các mệnh đề `none`. Viết xong thì ĐĂNG KÝ vào danh mục với `status: draft`.');
}

function main() {
  const argv = process.argv;
  const val = (nhan, md) => {
    const i = argv.indexOf(`--${nhan}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : md;
  };
  const duongMd = val('md', null);

  let taskKey = val('task', null);
  let taskOutputDir = null;
  if (!duongMd) {
    try {
      rc.loadEnvFiles();
      taskKey = taskKey || process.env.TASK_KEY || rc.getTaskKey();
      taskOutputDir = rc.getTaskOutputDir({ taskKey });
    } catch (e) {
      console.error(`[steps-match] ✗ không xác định được task: ${e.message}`);
      process.exit(2);
    }
  }

  const nguong = Number(val('nguong', NGUONG_MAC_DINH)) || NGUONG_MAC_DINH;
  const d = dungDo({ taskKey: taskKey || '(theo --md)', taskOutputDir, nguong, duongMd });

  if (d.loi === 'khong-co-danh-muc') {
    console.error('[steps-match] CHƯA ĐƯỢC GÁC — không đọc được `tests/fe/lib/step_catalog.json`.');
    process.exit(2);
  }
  if (d.loi === 'khong-co-case') {
    const o = duongMd || `${path.relative(REPO, taskOutputDir || REPO)}/test-cases`;
    console.error(`[steps-match] CHƯA ĐƯỢC GÁC — 0 case đọc được ở ${o}.`);
    process.exit(2);
  }

  if (argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); return; }
  inBaoCao(d);
}

if (require.main === module) main();

module.exports = {
  boDau, laCauSql, gopDongNghia, tachGiaTri, tachMenhDe, chuanHoaCau, chuanHoaMau, diem, khopCau,
  tachCacBuoc, dungDo, docCase, napNguPhap, napDanhMuc, inBaoCao,
  NGUONG_MAC_DINH, DUONG_DANH_MUC, DUONG_NGU_PHAP,
};
