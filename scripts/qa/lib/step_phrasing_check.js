'use strict';
/*
 * step_phrasing_check — CHẤM CÂU BƯỚC THEO CHUẨN §K. MỘT NGUỒN cho `tc:review` tiêu chí 9 và `steps:suggest`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CHỈ CÒN HAI LUẬT, trong khi `step_phrasing.json` khai năm (P1–P5).
 *
 * Đo trên 951 case · 5.886 mệnh đề thật, từng luật một, và ba trong năm luật KHÔNG chấm được bằng máy
 * mà không phạt oan:
 *
 *   P2 (một mệnh đề một thao tác) — TIÊU CHÍ 1 ĐÃ PHẠT RỒI. Đo chồng lấn: 8% số bước bị P2 bắt cũng
 *   đang bị tiêu chí 1 bắt. Phạt hai lần cùng một lỗi làm điểm mất nghĩa, và người viết không biết phải
 *   sửa theo cái nào.
 *
 *   P3 (dùng động từ chuẩn) — BẮT 58% SỐ MỆNH ĐỀ, và đó là lỗi của tôi chứ không phải của case. Tôi
 *   lấy danh sách `chuan` trong `step_phrasing.json` làm danh sách động từ ĐƯỢC PHÉP, nhưng nó không
 *   phải thế: nó là dạng chuẩn của các NHÓM ĐỒNG NGHĨA. `đọc`, `đếm`, `cuộn` không có đồng nghĩa nên
 *   không nằm trong nhóm nào — và chúng là động từ hoàn toàn đúng. Một tiêu chí phạt 58% số mệnh đề vì
 *   dùng chữ "đọc" sẽ bị tắt ngay trong tuần.
 *
 *   P5 (oracle không nằm trong câu bước) — tiêu chí 2 đã chấm phần kỳ vọng, và `steps:lint` canh luật
 *   vàng ở tầng code. Thêm ở đây là bản sao thứ ba.
 *
 * Còn lại hai luật, và cả hai đo được sạch: P1 và P4.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));

/**
 * P1 — GIÁ TRỊ GÁN PHẢI ĐƯỢC BỌC. `Nhập Stt 26 Diện tích đất = 5000` phải thành `Nhập "Diện tích đất" = "5000"`.
 *
 * Chỉ bắt dấu `=` với vế phải KHÔNG bọc. Bản đầu bắt cả `bằng` và `là`, và nó báo oan
 * `Chụp màn hình toàn bảng làm evidence` — vì `\b` của JavaScript tính theo ASCII, nên biên giới từ
 * quanh chữ có dấu không đáng tin. Đây là lần thứ tư trong đợt này một bộ dò bằng chữ của tôi vấp đúng
 * chỗ đó, nên luật này cố ý KHÔNG dùng `\b` cạnh chữ tiếng Việt.
 *
 * Đo: 365/5.886 mệnh đề (6%), dính ở 239/951 case (25%).
 */
const RE_GAN_KHONG_BOC = /=\s*(?!\s*["“”'[])[^\s"'“”[][^,;]*/;

/**
 * P4 — ĐƯỜNG DẪN MÀN KHÔNG DÁN VÀO CÂU BƯỚC.
 *
 * CHỈ về đường dẫn MÀN, không về dữ liệu. `Nhập Stt 15 Website = "http://truong-test.edu.vn"` là một
 * GIÁ TRỊ Ô, không phải một màn — bản đầu bắt cả nó, và 2 trong 4 ví dụ đầu tiên là loại này. Nên:
 *
 *   - đường dẫn app (`.aspx`, `<ops_base_url>`) ⇒ bắt, dù ở đâu trong câu;
 *   - `http(s)://` ⇒ chỉ bắt khi mệnh đề MỞ ĐẦU bằng động từ điều hướng.
 *
 * Và KHÔNG bắt `<script>alert(1)</script>`: đó là payload XSS. Bản đầu dùng `<[a-z0-9_]+>\S*` nên ăn
 * luôn, tức phạt đúng những case bảo mật.
 */
const RE_DUONG_DAN_MAN = /[\w/.-]+\.aspx\b|<ops_base_url>/i;
const RE_DIEU_HUONG_URL = /^\s*(mở|vào|truy cập|navigate|đi đến|chuyển đến)[^,;]{0,40}https?:\/\//i;

/**
 * P2-HẸP — MỘT MỆNH ĐỀ NỐI HAI THAO TÁC BẰNG CHỮ "VÀ".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO THÊM LẠI, trong khi khối ở đầu file nói P2 đã bị bỏ.
 *
 * Lý do bỏ P2 là "tiêu chí 1 đã phạt rồi, chồng lấn 8%". Đọc kỹ con số đó thì nó nói điều ngược lại:
 * chồng lấn 8% nghĩa là **92% vi phạm P2 KHÔNG ai phạt**. Một luật phủ 92% vùng chưa ai gác thì lý do
 * "trùng" không đứng được.
 *
 * VÀ ĐÂY LÀ CHỖ ĐÁNG GÁC NHẤT, đo 16/10/2026 trên 4 task thật:
 *   · 436/3814 câu bước (11%) chứa ≥2 động từ thao tác;
 *   · phần lớn tách được ở DẤU PHẨY — bộ tách đã xử lý, nên không cần luật nào;
 *   · phần CÒN LẠI là ca nối bằng "và", và `tach_menh_de` CỐ Ý không tách ở đó (`"Xoá trắng ô Họ và
 *     tên"` sẽ vỡ làm hai). Đo: 280/781 mệnh đề chưa khớp của CSDL-9001 chứa "và" — 36%.
 *
 * Nên chỗ này không sửa được bằng bộ tách, chỉ sửa được bằng cách VIẾT LẠI CÂU. Đó đúng là việc của
 * một luật §K, và là chỗ chênh lệch 79% (fixture viết chuẩn) với 16–36% (bộ thật) nằm.
 *
 * LUẬT HẸP CÓ CHỦ Ý: chỉ bắt khi chữ ngay SAU "và" là một ĐỘNG TỪ THAO TÁC đã khai. `"Họ và tên"`,
 * `"Stt 10 và Stt 11"`, `"DTTS và miền núi"` đều có danh từ phía sau ⇒ KHÔNG bắt. Đo trên CSDL-9001:
 * 38 ca bắt, 242 ca bỏ qua đúng.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */
let _dongTuCache = null;
function dongTuThaoTac(nguPhap) {
  if (_dongTuCache) return _dongTuCache;
  const ng = nguPhap || sm.napNguPhap();
  const ds = new Set();
  for (const g of ((ng.dong_nghia && ng.dong_nghia.nhom) || [])) {
    ds.add(String(g.chuan).toLowerCase());
    (g.cung_nghia || []).forEach((x) => ds.add(String(x).toLowerCase()));
  }
  /*
   * Động từ thao tác KHÔNG có nhóm đồng nghĩa vẫn là động từ thật — đó chính là lý lẽ đã loại luật P3
   * ("đọc", "đếm", "cuộn" không nằm nhóm nào mà hoàn toàn đúng). Khai thẳng ở đây, không suy từ nhóm.
   */
  for (const x of ['đọc', 'đếm', 'ghi', 'kiểm', 'xoá', 'xóa', 'chọn', 'lưu', 'cuộn', 'dán', 'tích', 'so']) ds.add(x);
  _dongTuCache = ds;
  return ds;
}

function noiHaiThaoTacBangVa(menhDe, nguPhap) {
  const m = /\sv[àa]\s+(\S+)/i.exec(String(menhDe));
  if (!m) return false;
  return dongTuThaoTac(nguPhap).has(String(m[1]).toLowerCase());
}

/** Luật được chấm, kèm cách chữa — `steps:suggest` in thẳng dòng `chua`. */
const LUAT = [
  {
    ma: 'P2',
    mo_ta: 'một mệnh đề chỉ một thao tác — không nối hai thao tác bằng "và"',
    test: (menhDe, ng) => !sm.laCauSql(menhDe) && noiHaiThaoTacBangVa(menhDe, ng),
    chua: 'tách thành hai bước: `Xoá trắng ô "Stt 17"` rồi `Dán chuỗi "251 ký tự"`. Bộ tách KHÔNG tách ở "và" (vì `"Họ và tên"`), nên câu ghép kiểu này không bao giờ khớp được bước nào.',
    tang: 'menh_de',
  },
  {
    ma: 'P1',
    mo_ta: 'giá trị gán phải bọc trong nháy kép',
    test: (menhDe) => !sm.laCauSql(menhDe) && RE_GAN_KHONG_BOC.test(menhDe),
    chua: 'bọc cả nhãn ô lẫn giá trị: `Nhập "Diện tích đất" = "5000"`',
    tang: 'menh_de',
  },
  {
    ma: 'P4',
    mo_ta: 'đường dẫn màn không dán vào câu bước',
    test: (menhDe) => !sm.laCauSql(menhDe) && (RE_DUONG_DAN_MAN.test(menhDe) || RE_DIEU_HUONG_URL.test(menhDe)),
    chua: 'đưa đường dẫn vào cột Tiền điều kiện, hoặc gọi tên màn có mã: `mở màn "1.1 Hồ sơ trường"`',
    tang: 'menh_de',
  },
];

/**
 * Chấm một case. Trả `{ so_menh_de, vi_pham: [{ma, menh_de, chua}] }`.
 *
 * Mẫu số là SỐ MỆNH ĐỀ, không phải số bước: một bước ghép ba thao tác có ba chỗ để sai, và đếm nó là
 * một thì case viết câu dài tự nhiên được điểm cao hơn.
 */
function chamCase(tc, nguPhap) {
  const ng = nguPhap || sm.napNguPhap();
  const cacCau = Array.isArray(tc.steps) && tc.steps.length
    ? tc.steps.map((s) => s.text)
    : sm.tachCacBuoc(tc.stepsRaw);

  const viPham = [];
  let soMenhDe = 0;
  for (const cau of cacCau) {
    for (const md of sm.tachMenhDe(cau, ng.ngat)) {
      soMenhDe += 1;
      for (const l of LUAT) {
        if (l.test(md, ng)) viPham.push({ ma: l.ma, menh_de: md.slice(0, 110), chua: l.chua });
      }
    }
  }
  return { so_menh_de: soMenhDe, vi_pham: viPham };
}

/**
 * Điểm tiêu chí 9 cho một case: 2 · 1 · 0 · `null`.
 *
 * `null` = KHÔNG CHẤM ĐƯỢC (case không có bước nào), giống cách tiêu chí 8 dùng `n/a`. Cho 0 ở đó là
 * phạt một case vì nó không có dữ liệu để chấm — và một gate phạt oan sẽ bị tắt.
 */
function diem(tc, nguPhap) {
  const r = chamCase(tc, nguPhap);
  if (!r.so_menh_de) return { diem: null, ...r, vi_sao: ['n/a — case không có bước nào để chấm'] };
  if (!r.vi_pham.length) return { diem: 2, ...r, vi_sao: [] };
  /*
   * MỘT vi phạm ⇒ 1 điểm, NHIỀU ⇒ 0. Ngưỡng theo SỐ CHỖ chứ không theo tỉ lệ: một case 3 bước và một
   * case 30 bước cùng sai hai chỗ thì việc phải sửa là như nhau, còn tỉ lệ thì khác hẳn.
   */
  return {
    diem: r.vi_pham.length === 1 ? 1 : 0,
    ...r,
    vi_sao: r.vi_pham.slice(0, 3).map((v) => `${v.ma}: "${v.menh_de}" — ${v.chua}`),
  };
}

/** Đối chứng HAI CHIỀU, ghim cạnh luật. Xem `canonical_phrases.js` để biết vì sao bắt buộc có chiều âm. */
const DOI_CHUNG = {
  phai_bat: [
    'Chọn Stt 23 Vùng đồng bào DTTS = Khu vực I',
    'Nhập Stt 26 Diện tích đất = 5000',
    'Mở tab mới vào https://vi-du.com/Manage/Log',
    'navigate đến <ops_base_url>/c3/lop.aspx',
    'mở C2/HoSoTruongDetail.aspx',
  ],
  khong_duoc_bat: [
    /* Viết đúng chuẩn. */
    'nhập "Tên trường" = "Trường THCS A"',
    'chọn combobox "Năm học" = "2026-2027"',
    'bấm nút "Ghi"',
    /* Động từ hợp lệ nhưng không nằm trong nhóm đồng nghĩa — P3 cũ phạt oan 58% vì chuyện này. */
    'đọc giá trị combobox "cbNamHoc"',
    'đếm tổng số dòng của bảng',
    'Cuộn ngang bảng hết sang phải',
    /* `\b` ASCII trên chữ có dấu — bản đầu báo oan câu này. */
    'Chụp màn hình toàn bảng làm evidence',
    /* URL là DỮ LIỆU của ô, không phải đường dẫn màn. */
    'Nhập Stt 15 Website = "http://truong-test-135.edu.vn"',
    /* Payload XSS, không phải URL. */
    'Xoá trắng ô Stt 116 và nhập <script>alert(1)</script>',
    /* Câu SQL không bị chấm. */
    "Chạy db_readonly: SELECT MA_TRUONG FROM TRUONG WHERE MA_NAM_HOC = 2026",
  ],
};

/** Một mệnh đề có vi phạm luật nào không — dùng cho đối chứng và cho `steps:suggest`. */
function viPhamCuaMenhDe(menhDe) {
  return LUAT.filter((l) => l.test(menhDe)).map((l) => ({ ma: l.ma, chua: l.chua }));
}

module.exports = { chamCase, diem, viPhamCuaMenhDe, LUAT, DOI_CHUNG, RE_GAN_KHONG_BOC, RE_DUONG_DAN_MAN, RE_DIEU_HUONG_URL };
