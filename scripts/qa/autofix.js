'use strict';
/*
 * autofix — TỰ SỬA ĐỊNH DẠNG, KHÔNG ĐỔI NGHĨA (v2.7.0 §A4).
 *
 * VÌ SAO CÓ. Một phần đáng kể vi phạm mà gate bắt là lỗi định dạng thuần: thang `Ưu tiên` dùng tên cũ,
 * tag nằm trong tiêu đề thay vì cột `Tag`, đánh số bước nhảy nấc, khoảng trắng đôi. Chúng không cần
 * người đọc — nhưng mỗi cái vẫn làm một lượt chạy đỏ, và người ta phải mở file sửa tay.
 *
 * VÌ SAO NGUY HIỂM, và đây là phần quyết định cách file này được viết. Một máy tự sửa testcase ở sai chỗ
 * là một máy **gian lận thay cho người**: sửa `Kết quả mong đợi` cho khớp cái app đang trả về thì mọi
 * case đỏ thành xanh, và non-negotiable §6 bị phá bởi chính công cụ của kit. Nên:
 *
 *   · mỗi luật khai CỘT nó được phép chạm, và danh sách đó là dữ liệu, không phải quy ước trong đầu;
 *   · `CAM_CHAM` là danh sách cột KHÔNG luật nào được sửa nội dung;
 *   · luật duy nhất chạm được `Kết quả mong đợi` chỉ sửa TIỀN TỐ SỐ, không bao giờ chữ sau số — và nó
 *     chứng minh chuyện đó bằng cách so phần chữ trước và sau khi sửa, lệch một ký tự là bỏ luật.
 *
 * KHÔNG DỰNG LẠI CẢ BẢNG. Sửa theo từng Ô rồi ghép lại đúng dòng cũ. Dựng lại bảng từ model sẽ chuẩn hoá
 * mọi thứ cùng lúc — kể cả những chỗ người ta cố ý viết vậy — và diff sẽ to đến mức không ai rà nổi.
 */
const canonical = require('../lib/testcase');

/*
 * CỘT KHÔNG LUẬT NÀO ĐƯỢC SỬA NỘI DUNG.
 *
 * `Kết quả mong đợi` là oracle: sửa nó là đổi thứ case dùng để phán đúng/sai. `Dữ liệu Test` quyết định
 * case chạy với giá trị nào. `Loại case` và `Tiền điều kiện` mang tag ngữ nghĩa mà Phase 2 đọc để dựng
 * state — đoán sai ở đó làm mọi verdict sau vô nghĩa.
 */
const CAM_CHAM = ['Kết quả mong đợi', 'Dữ liệu Test', 'Loại case', 'Tiền điều kiện'];

/*
 * Ký tự vô hình hay lọt vào ô khi copy từ Word hoặc Sheet.
 *
 * DỰNG BẰNG `new RegExp` TỪ CHUỖI, không viết regex literal. Bản đầu viết literal và các escape bị
 * giải mã thành KÝ TỰ THẬT trong source — `eslint` bắt đúng (`no-irregular-whitespace`), và đó là lỗi
 * đáng bắt: một zero-width nằm trong chính dòng code đi tìm zero-width thì không ai đọc ra được.
 */
/*
 * Li\u1EC7t k\u00EA R\u1EDCI ch\u1EE9 kh\u00F4ng g\u1ED9p v\u00E0o m\u1ED9t character class: `\u200D` (ZWJ) \u0111\u1EE9ng c\u1EA1nh `\u200C` (ZWNJ) trong
 * c\u00F9ng m\u1ED9t class l\u00E0m `eslint` b\u00E1o `no-misleading-character-class` \u2014 v\u00E0 n\u00F3 c\u00F3 l\u00FD, v\u00EC hai k\u00FD t\u1EF1 \u0111\u00F3 l\u00E0
 * th\u1EE9 d\u00F9ng \u0111\u1EC3 GH\u00C9P chu\u1ED7i, n\u00EAn \u0111\u1ECDc ch\u00FAng nh\u01B0 m\u1ED9t d\u1EA3i l\u00E0 \u0111\u1ECDc sai. M\u1ED7i k\u00FD t\u1EF1 m\u1ED9t nh\u00E1nh th\u00EC \u00FD r\u00F5: t\u00ECm
 * t\u1EEBng c\u00E1i m\u1ED9t, kh\u00F4ng t\u00ECm d\u1EA3i.
 */
const VO_HINH = new RegExp(['\u200B', '\u200C', '\u200D', '\uFEFF', '\u00A0'].join('|'), 'g');

const TAG_DAU = /^\s*((?:\[[^\]\n]{1,40}\]\s*)+)/;

/** Tách một dòng bảng markdown thành các ô, giữ nguyên khoảng trắng để ghép lại đúng. */
function tachO(dong) {
  if (!/^\s*\|/.test(dong)) return null;
  const than = dong.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
  return than.split(/(?<!\\)\|/);
}

function ghepO(o) { return `| ${o.map((x) => String(x).trim()).join(' | ')} |`; }

/** Chỉ số cột theo TÊN, dùng header đã chuẩn hoá — không theo vị trí. */
function chiSoCot(header) {
  const map = {};
  header.forEach((h, i) => { map[canonical.normalizeHeader(h)] = i; });
  const tim = (ten) => {
    const n = canonical.normalizeHeader(ten);
    return map[n] === undefined ? -1 : map[n];
  };
  return { tim, map };
}

/*
 * ── LUẬT ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Mỗi luật: { ma, cot, y, sua(giaTri, ctx) → giaTri mới hoặc null nếu không đổi }.
 * `cot` là tên cột nó được phép chạm. Luật nào khai một cột trong `CAM_CHAM` sẽ bị `kiemLuat()` chặn
 * ngay lúc nạp — một luật sai chỗ không được phép chạy lần nào.
 */
const LUAT = [
  {
    ma: 'UU_TIEN_ALIAS',
    cot: 'Ưu tiên',
    y: 'thang `Ưu tiên` dùng tên cũ của Backlog',
    vi_sao: 'Canonical nay là Critical|High|Medium|Low|Lowest (khớp Google Sheet). `Highest` là tên của '
      + 'Backlog, và publisher chỉ map đúng nhờ alias — còn báo cáo và bộ lọc thì hai tên khác nhau làm '
      + 'số liệu tách đôi.',
    sua: (v) => (/^\s*highest\s*$/i.test(v) ? 'Critical' : null),
  },
  {
    ma: 'BR_CHUAN',
    cot: '*',
    y: '`<BR>` hoặc `<br/>` không chuẩn',
    vi_sao: 'Exporter đổi `<br>` thành xuống dòng khi ghi Excel. Biến thể khác hoa thường hoặc có dấu '
      + 'gạch chéo thì không khớp, và ô Excel nhận nguyên chuỗi `<br/>` làm chữ.',
    sua: (v) => {
      const m = v.replace(/<\s*br\s*\/?\s*>/gi, '<br>');
      return m === v ? null : m;
    },
  },
  {
    ma: 'KY_TU_VO_HINH',
    cot: '*',
    y: 'ký tự vô hình hoặc khoảng trắng đôi',
    vi_sao: 'Zero-width và non-breaking space lọt vào khi copy từ Word hoặc Sheet. Chúng không hiện ra '
      + 'nhưng làm mọi phép so chuỗi lệch, kể cả phép so của `canonical:drift`.',
    sua: (v) => {
      const m = v.replace(VO_HINH, ' ').replace(/[ \t]{2,}/g, ' ').trim();
      return m === v ? null : m;
    },
  },
  {
    ma: 'TAG_TRONG_TIEU_DE',
    cot: 'Trường hợp kiểm thử',
    y: 'tag nằm trong tiêu đề thay vì cột `Tag`',
    vi_sao: 'Model đọc tag từ HỢP của cột `Tag` và tiêu đề, nên chuyển chỗ không đổi nghĩa một chút nào. '
      + 'Đổi lại tiêu đề đọc thẳng: người mở case trên Sheet để chạy không phải đi qua ba khối ngoặc mới '
      + 'tới nội dung.',
    /* Luật này đổi HAI ô, nên nó nhận cả hàng — xem `apDungHang`. */
    sua: null,
    hai_o: true,
  },
  {
    ma: 'SO_BUOC_LECH',
    cot: 'Các bước thực hiện',
    y: 'đánh số bước nhảy nấc hoặc trùng',
    vi_sao: 'Số bước là thứ người chạy tay đối chiếu với `Kết quả mong đợi`. Nhảy nấc thì họ phải tự đếm '
      + 'lại, và đếm lệch một nấc là chấm sai một bước.',
    sua: null,
    danh_so: true,
  },
];

/*
 * KIỂM CHÍNH BỘ LUẬT, lúc nạp module.
 *
 * Một luật khai cột nằm trong `CAM_CHAM` là một lỗ để máy sửa oracle. Không để nó chạy rồi mới phát
 * hiện: ném ngay khi require, vì đây là lớp an toàn chứ không phải một phép kiểm chất lượng.
 */
function kiemLuat() {
  for (const l of LUAT) {
    if (l.cot !== '*' && CAM_CHAM.includes(l.cot)) {
      throw new Error(`[autofix] LUẬT SAI CHỖ: "${l.ma}" khai cột "${l.cot}" nằm trong danh sách CẤM CHẠM.`);
    }
    if (l.cot === '*' && !l.sua) {
      throw new Error(`[autofix] LUẬT "${l.ma}" khai cột "*" mà không có hàm sửa.`);
    }
  }
}
kiemLuat();

/** Luật `*` chỉ chạy trên cột KHÔNG bị cấm — đó là cách "mọi cột" vẫn tôn trọng `CAM_CHAM`. */
function duocCham(tenCot) {
  return !CAM_CHAM.some((c) => canonical.normalizeHeader(c) === canonical.normalizeHeader(tenCot));
}

/**
 * Đánh số lại một ô nhiều bước. CHỈ sửa tiền tố số, giữ nguyên từng chữ sau số.
 *
 * Và nó TỰ CHỨNG MINH chuyện đó: sau khi dựng chuỗi mới, nó bóc lại phần chữ của hai bên rồi so. Lệch
 * một ký tự thì bỏ luật, trả `null`. Đây là chỗ duy nhất trong file chạm được tới một ô nội dung, nên
 * nó phải mang theo phép tự kiểm của chính nó.
 */
function danhSoLai(v) {
  const dong = String(v).split(/<br>|\n/).map((x) => x.trim()).filter((x) => x.length);
  if (dong.length < 2) return null;
  const tach = dong.map((d) => {
    const m = d.match(/^(\d+)\s*[.)]\s*(.*)$/);
    return m ? { so: Number(m[1]), chu: m[2] } : null;
  });
  if (tach.some((x) => !x)) return null;                 // có dòng không đánh số ⇒ không phải ca này
  const dungRoi = tach.every((x, i) => x.so === i + 1);
  if (dungRoi) return null;
  const moi = tach.map((x, i) => `${i + 1}. ${x.chu}`).join('<br>');
  /* TỰ KIỂM: phần chữ phải y nguyên. */
  const chuCu = tach.map((x) => x.chu).join('\u0000');
  const chuMoi = moi.split('<br>').map((d) => (d.match(/^\d+\.\s*(.*)$/) || ['', ''])[1]).join('\u0000');
  if (chuCu !== chuMoi) return null;
  return moi;
}

/** Chuyển tag từ tiêu đề sang cột `Tag`, hợp lại và bỏ trùng. */
function chuyenTag(tieuDe, tagHienCo) {
  const m = String(tieuDe).match(TAG_DAU);
  if (!m) return null;
  const khoi = m[1].match(/\[[^\]]+\]/g) || [];
  if (!khoi.length) return null;
  const conLai = String(tieuDe).slice(m[0].length).trim();
  if (!conLai) return null;                               // tiêu đề chỉ có tag ⇒ KHÔNG chuyển, để người xem
  const dangCo = (String(tagHienCo).match(/\[[^\]]+\]/g) || []);
  const hop = [...dangCo];
  for (const k of khoi) if (!hop.some((x) => x.toLowerCase() === k.toLowerCase())) hop.push(k);
  return { tieuDe: conLai, tag: hop.join('') };
}

/**
 * Áp mọi luật lên MỘT hàng. Trả `{ o, doi: [{ma, cot, cu, moi}] }`.
 */
function apDungHang(o, header) {
  const { tim } = chiSoCot(header);
  const doi = [];
  /*
   * TRIM TRƯỚC KHI ÁP LUẬT, và đây là chỗ bản đầu KHÔNG idempotent.
   *
   * `tachO` cắt theo `|` mà không trim, nên mỗi ô mang khoảng trắng viền của `| ô |`. Luật
   * `KY_TU_VO_HINH` thì trim, nên nó LUÔN thấy khác và LUÔN báo một thay đổi — chạy `--fix` mười lần
   * thì mười lần nó báo "6 ô sửa", và `reports/autofix.log` đầy diff rỗng. Test idempotent bắt đúng
   * chỗ này ngay lượt đầu.
   *
   * `ghepO` tự thêm lại khoảng trắng viền, nên trim ở đây không mất gì về hình thức bảng.
   */
  const ra = o.map((x) => String(x).trim());

  for (const l of LUAT) {
    if (l.hai_o) {
      const iT = tim('Trường hợp kiểm thử');
      const iG = tim('Tag');
      if (iT < 0 || iG < 0) continue;
      const kq = chuyenTag(ra[iT], ra[iG]);
      if (!kq) continue;
      doi.push({ ma: l.ma, cot: 'Trường hợp kiểm thử', cu: ra[iT].trim(), moi: kq.tieuDe });
      doi.push({ ma: l.ma, cot: 'Tag', cu: ra[iG].trim(), moi: kq.tag });
      ra[iT] = kq.tieuDe; ra[iG] = kq.tag;
      continue;
    }
    if (l.danh_so) {
      for (const ten of ['Các bước thực hiện', 'Kết quả mong đợi']) {
        const i = tim(ten);
        if (i < 0) continue;
        const moi = danhSoLai(ra[i]);
        if (moi === null) continue;
        doi.push({ ma: l.ma, cot: ten, cu: ra[i].trim(), moi });
        ra[i] = moi;
      }
      continue;
    }
    if (l.cot === '*') {
      header.forEach((h, i) => {
        if (!duocCham(h)) return;
        const moi = l.sua(ra[i]);
        if (moi === null || moi === undefined) return;
        doi.push({ ma: l.ma, cot: h.trim(), cu: ra[i].trim(), moi });
        ra[i] = moi;
      });
      continue;
    }
    const i = tim(l.cot);
    if (i < 0) continue;
    const moi = l.sua(ra[i]);
    if (moi === null || moi === undefined) continue;
    doi.push({ ma: l.ma, cot: l.cot, cu: ra[i].trim(), moi });
    ra[i] = moi;
  }
  return { o: ra, doi };
}

/**
 * Sửa cả một file Markdown testcase. Trả `{ txt, doi }` — KHÔNG ghi đĩa (chỗ gọi quyết).
 *
 * Chỉ chạm những dòng là HÀNG DỮ LIỆU của một bảng testcase. Mọi dòng khác — tiêu đề, văn xuôi, bảng
 * khác — giữ nguyên từng ký tự.
 */
function suaVanBan(txt) {
  const dong = String(txt).split(/\r?\n/);
  const doi = [];
  let header = null;
  for (let i = 0; i < dong.length; i += 1) {
    const o = tachO(dong[i]);
    if (!o) { header = null; continue; }
    if (/^[\s:|-]+$/.test(dong[i].replace(/\|/g, ''))) continue;      // dòng ngăn
    if (!header) {
      if (canonical.isTestCaseHeader(o)) header = o.map((x) => x.trim());
      continue;
    }
    if (o.length !== header.length) continue;                          // số ô lệch ⇒ không chắc, bỏ
    const kq = apDungHang(o, header);
    if (!kq.doi.length) continue;
    const idx = chiSoCot(header).tim('TC ID');
    const tcId = idx >= 0 ? String(o[idx]).trim() : '(no-id)';
    for (const d of kq.doi) doi.push({ ...d, tcId, dong: i + 1 });
    dong[i] = ghepO(kq.o);
  }
  return { txt: dong.join('\n'), doi };
}

module.exports = {
  LUAT, CAM_CHAM, suaVanBan, apDungHang, danhSoLai, chuyenTag, duocCham, kiemLuat, tachO, ghepO,
};
