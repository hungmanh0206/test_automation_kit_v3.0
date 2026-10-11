'use strict';

/*
 * DANH MỤC API (v2.6.0 §A5) — điểm số 3 trong 10 điểm vượt kit A.
 *
 * A có đọc tầng network, nhưng chỉ GHI LẠI danh sách endpoint. Nó không lập danh mục, nên không trả lời
 * được ba câu mà Phase 1 cần: endpoint nào UI gọi mà đặc tả không có · endpoint nào đặc tả có mà không UI
 * nào gọi · trường nào là enum (tức ứng viên trạng thái cho `state_machine`).
 *
 * LUẬT CỨNG, giữ nguyên của A: **CẤM gọi API trực tiếp.** Chỉ quan sát request do UI tự phát sinh. Một
 * request tự tay tạo ra không chứng minh được gì về hành vi của UI, và trên môi trường dùng chung thì nó
 * là hành vi kiểm thử xâm nhập. File này KHÔNG có hàm nào gửi request.
 *
 * PII: response thật chứa họ tên, email, số điện thoại. Nên mặc định chỉ lưu **KHOÁ và KIỂU**, không lưu
 * giá trị. Ngoại lệ duy nhất là giá trị trông như MÃ TRẠNG THÁI (xem `laMaTrangThai`), vì đó đúng là thứ
 * `state_machine` cần và nó không phải dữ liệu người. Mọi ngoại lệ đều có ba điều kiện phải thoả cùng lúc.
 */
const fs = require('fs');
const path = require('path');

const { chuanHoaRoute } = require(path.join(__dirname, 'crawl.js'));

/** Khoá có tên gợi PII thì KHÔNG lấy giá trị, kể cả khi nó trông như mã. */
const KHOA_PII = /ten|name|ho_?ten|fullname|email|mail|phone|sdt|dien_?thoai|cccd|cmnd|dinh_?danh|address|dia_?chi|birth|ngay_?sinh|password|token/i;

/**
 * Giá trị này có trông như MÃ TRẠNG THÁI? Phải thoả CẢ BA, không lấy hai trong ba:
 *   ① là chuỗi ngắn (≤ 40 ký tự);
 *   ② chỉ gồm chữ không dấu, số, `_`, `-` — tức dạng mã, không phải câu hay tên người;
 *   ③ không chứa khoảng trắng.
 * Ba điều kiện cùng lúc thì "Nguyễn Văn A" (có dấu, có khoảng trắng) và "a@b.vn" (có @) đều bị loại.
 */
function laMaTrangThai(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return s.length > 0 && s.length <= 40 && /^[A-Za-z0-9_-]+$/.test(s);
}

/**
 * Chuẩn hoá path của API. Dùng lại `chuanHoaRoute` của crawler để **một nguồn một luật**: nếu hai nơi
 * chuẩn hoá khác nhau thì `goi_tu` (màn nào gọi) sẽ không khớp được với `screens[].route`.
 */
function chuanHoaPath(u) {
  return chuanHoaRoute(u);
}

/**
 * Rút HÌNH DẠNG của response: khoá → kiểu. Không lưu giá trị, trừ ứng viên enum.
 *
 * `enumUngVien` gom giá trị theo đường dẫn khoá (`items[].trangThai`). Một trường chỉ thành ứng viên enum
 * khi số giá trị RIÊNG BIỆT thấp và mọi giá trị đều là mã trạng thái. Ngưỡng 12: cao hơn thì nó là dữ
 * liệu, không phải tập trạng thái.
 */
function rutHinhDang(o, duong, hd, enumUngVien, sau) {
  if (sau > 4) return;
  if (Array.isArray(o)) {
    hd[`${duong}[]`] = 'array';
    // Chỉ soi 3 phần tử đầu: đủ để biết hình dạng, không đủ để tích trữ dữ liệu.
    for (const x of o.slice(0, 3)) rutHinhDang(x, `${duong}[]`, hd, enumUngVien, sau + 1);
    return;
  }
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) rutHinhDang(v, duong ? `${duong}.${k}` : k, hd, enumUngVien, sau + 1);
    return;
  }
  const kieu = o === null ? 'null' : typeof o;
  hd[duong] = hd[duong] && hd[duong] !== kieu ? `${hd[duong]}|${kieu}` : kieu;

  const khoaCuoi = String(duong).split('.').pop().replace(/\[\]$/, '');
  if (KHOA_PII.test(khoaCuoi)) return;
  if (!laMaTrangThai(o)) return;
  const tap = enumUngVien[duong] || (enumUngVien[duong] = new Set());
  if (tap.size <= 24) tap.add(o);
}

/**
 * Gắn bộ theo dõi vào một `page`. KHÔNG gửi request nào, chỉ nghe `response`.
 *
 * `datRoute(route)` do crawler gọi trước mỗi lần `goto`, để quy được request cho màn nào. Không có nó thì
 * danh mục vẫn đúng về endpoint nhưng mất cột `goi_tu` — và `goi_tu` chính là thứ suy ra `shared_surface`.
 */
function theoDoi(page, tuyChon = {}) {
  const chiNhan = tuyChon.chiNhanApi || /\/api\//;
  const bang = new Map();   // key: `METHOD path_chuan`
  const soKhongPhaiApi = { n: 0 };
  let routeHienTai = null;

  const rec = {
    datRoute(r) { routeHienTai = r || null; },
    get bang() { return bang; },
    soKhongPhaiApi,
  };

  page.on('response', async (resp) => {
    const req = resp.request();
    const url = req.url();
    if (!chiNhan.test(url)) { soKhongPhaiApi.n += 1; return; }

    const method = String(req.method() || '').toUpperCase();
    const p = chuanHoaPath(url);
    const key = `${method} ${p}`;
    const e = bang.get(key) || {
      method, path_chuan: p, so_lan: 0, status_quan_sat: new Set(),
      goi_tu: new Set(), hinh_dang: {}, _enum: {}, query_thay: new Set(),
    };
    e.so_lan += 1;
    e.status_quan_sat.add(resp.status());
    if (routeHienTai) e.goi_tu.add(routeHienTai);
    for (const k of new URL(url).searchParams.keys()) e.query_thay.add(k);

    /*
     * Đọc body trong try/catch và BỎ QUA nếu không được. Body có thể là stream đã đóng, là nhị phân, hoặc
     * request bị tường lửa abort. Một lỗi đọc body KHÔNG được làm chết lượt bò — nhưng cũng không được âm
     * thầm: bản ghi vẫn có mặt với `hinh_dang` rỗng, nên người đọc thấy ngay là chưa rút được hình dạng.
     */
    try {
      const ct = String(resp.headers()['content-type'] || '');
      if (/json/i.test(ct)) {
        const body = await resp.json();
        rutHinhDang(body, '', e.hinh_dang, e._enum, 0);
      }
    } catch (err) { /* không rút được hình dạng lượt này; lượt khác của cùng endpoint vẫn có cơ hội */ }

    bang.set(key, e);
  });

  /*
   * REQUEST BỊ TƯỜNG LỬA CHẶN CŨNG LÀ DỮ LIỆU — và bỏ nó ra thì danh mục kết luận SAI.
   *
   * Đo được trên fixture: `POST /api/truong` và `DELETE /api/truong/:id` bị xếp vào vế "spec khai mà
   * KHÔNG UI nào gọi", trong khi UI gọi cả hai. Lý do: tường lửa `abort()` nên không có `response` nào
   * phát ra, và bộ nghe `response` không thấy gì. Tức chính HÀNG RÀO AN TOÀN của Bước 0 tạo ra một kết
   * luận sai về đặc tả. Đó là lớp lỗi tệ nhất ở đây: không ai nghi ngờ một con số do cơ chế an toàn sinh ra.
   *
   * Nên: endpoint bị chặn VẪN vào danh mục, mang `bi_tuong_lua_chan: true` và `status_quan_sat: []`.
   * "Không quan sát được phản hồi" KHÁC "không ai gọi" — và `tongHop` phải trừ chúng ra khỏi vế đối chiếu.
   */
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!chiNhan.test(url)) return;
    const method = String(req.method() || '').toUpperCase();
    const p = chuanHoaPath(url);
    const key = `${method} ${p}`;
    const e = bang.get(key) || {
      method, path_chuan: p, so_lan: 0, status_quan_sat: new Set(),
      goi_tu: new Set(), hinh_dang: {}, _enum: {}, query_thay: new Set(),
    };
    /*
     * PHÂN BIỆT BA LÝ DO request thất bại. Bản đầu gộp hết thành "bị tường lửa chặn", và nó báo
     * `GET /api/truong` bị chặn — sai, vì GET nằm trong `method_cho_phep`. Thật ra lượt fetch đó bị HUỶ
     * khi crawler điều hướng sang trang khác. Gộp lại thì một cơ chế an toàn bị gán cho một chuyện nó
     * không làm, và người đọc mất đường lần ra nguyên nhân thật.
     */
    const loi = String((req.failure() || {}).errorText || '');
    e.so_lan += 1;
    if (/BLOCKED_BY_CLIENT/i.test(loi)) e.bi_tuong_lua_chan = true;
    else e.that_bai_khac = loi.slice(0, 60);   // thường là ERR_ABORTED do điều hướng
    e.ly_do_that_bai = loi.slice(0, 60);
    if (routeHienTai) e.goi_tu.add(routeHienTai);
    bang.set(key, e);
  });

  return rec;
}

/** Đọc endpoint khai trong một file OpenAPI. Trả `Set` các khoá `METHOD path_chuan`. */
function docOpenapi(duongDan) {
  if (!duongDan || !fs.existsSync(duongDan)) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(duongDan, 'utf8')); } catch (e) { return null; }
  const ra = new Set();
  for (const [p, obj] of Object.entries(j.paths || {})) {
    // `/api/truong/{id}` của OpenAPI và `/api/truong/:id` của crawler là cùng một thứ.
    const chuan = String(p).replace(/\{[^}]+\}/g, ':id').replace(/\/+$/, '');
    for (const m of Object.keys(obj || {})) {
      if (!/^(get|post|put|patch|delete|head|options)$/i.test(m)) continue;
      ra.add(`${m.toUpperCase()} ${chuan}`);
    }
  }
  return ra;
}

/**
 * Tổng hợp danh mục.
 *
 * @param {ReturnType<typeof theoDoi>} rec
 * @param {{openapiPath?:string, soModuleToiThieu?:number}} o
 */
function tongHop(rec, o = {}) {
  const apis = [...rec.bang.values()].map((e) => {
    const enums = {};
    for (const [duong, tap] of Object.entries(e._enum)) {
      /*
       * Ngưỡng 12 giá trị riêng biệt. Trên ngưỡng thì trường đó là DỮ LIỆU (mã trường, mã lớp), không
       * phải tập trạng thái — và lưu nó lại là vừa vô ích vừa tích trữ dữ liệu không cần thiết.
       *
       * NHƯNG NGƯỠNG MỘT MÌNH KHÔNG ĐỦ, và phép đo nói thẳng chuyện đó: trên fixture 5 bản ghi,
       * `items[].ma` (mã trường: C1-010, C2-001, C2-002) lọt vào vì chỉ có 3 giá trị. Trên dữ liệu thật
       * 500 trường thì nó vượt ngưỡng và bị loại — tức cùng một trường cho ra hai kết luận khác nhau tuỳ
       * số bản ghi. Một tín hiệu như vậy không dùng để chấm được.
       *
       * Nên gắn MỨC TIN CẬY, không lọc bỏ: `cao` khi TÊN KHOÁ gợi trạng thái (hoặc có khoá `enum_*` cùng
       * tên), `thap` khi chỉ dựa vào số giá trị ít. `fuse` và `state_machine` chỉ lấy mức `cao` làm ứng
       * viên; mức `thap` vẫn hiện ra để người đọc tự quyết, chứ không bị chôn.
       */
      if (!(tap.size >= 1 && tap.size <= 12)) continue;
      const khoaCuoi = duong.split('.').pop().replace(/\[\]$/, '');
      const tenGoiTrangThai = /trang_?thai|status|state|tinh_?trang|loai|type|kind|muc|level|vai_?tro|role/i.test(khoaCuoi);
      const coKhoaEnum = Object.keys(e._enum).some((d) => /^enum_/i.test(d.split('.').pop().replace(/\[\]$/, '')) && d !== duong);
      enums[duong] = {
        gia_tri: [...tap].sort(),
        do_tin: tenGoiTrangThai ? 'cao' : 'thap',
        vi_sao: tenGoiTrangThai
          ? `tên khoá "${khoaCuoi}" gợi trạng thái`
          : `chỉ dựa vào số giá trị riêng biệt ít (${tap.size}) — trên dữ liệu lớn hơn, trường này có thể là DỮ LIỆU chứ không phải tập trạng thái`,
        _co_khoa_enum_khac: coKhoaEnum || undefined,
      };
    }
    return {
      method: e.method,
      path_chuan: e.path_chuan,
      so_lan: e.so_lan,
      status_quan_sat: [...e.status_quan_sat].sort((a, b) => a - b),
      goi_tu: [...e.goi_tu].sort(),
      query_thay: [...e.query_thay].sort(),
      hinh_dang: e.hinh_dang,
      truong_enum: enums,
      bi_tuong_lua_chan: e.bi_tuong_lua_chan === true,
      that_bai_khac: e.that_bai_khac || undefined,
      ly_do_that_bai: e.ly_do_that_bai || undefined,
      status: 'draft',
    };
  }).sort((a, b) => a.path_chuan.localeCompare(b.path_chuan) || a.method.localeCompare(b.method));

  /*
   * `shared_surface`: endpoint được từ 2 MÀN trở lên gọi. Đây là ứng viên, không phải kết luận — hai màn
   * cùng gọi `/api/truong` có thể là hai màn của cùng một module. Việc gom màn thành module là của
   * `fuse.js`, nên ở đây chỉ nêu số màn và để `status: draft`.
   */
  const nguong = o.soModuleToiThieu || 2;
  const sharedSurface = apis.filter((a) => a.goi_tu.length >= nguong)
    .map((a) => ({ endpoint: `${a.method} ${a.path_chuan}`, so_man_goi: a.goi_tu.length, goi_tu: a.goi_tu, status: 'draft' }));

  /*
   * Ứng viên trạng thái cho `state_machine`. CHỈ mức `cao` vào danh sách ứng viên; mức `thap` nằm ở
   * `apis[].truong_enum` để người đọc thấy, nhưng không được đẩy lên thành ứng viên — một "trạng thái"
   * suy từ 3 mã trường trên fixture nhỏ mà thành `SM-*` thì nó là oracle bịa.
   */
  const ungVienTrangThai = apis.flatMap((a) => Object.entries(a.truong_enum)
    .filter(([, v]) => v.do_tin === 'cao')
    .map(([duong, v]) => ({
      endpoint: `${a.method} ${a.path_chuan}`, truong: duong, gia_tri: v.gia_tri,
      do_tin: v.do_tin, vi_sao: v.vi_sao, status: 'draft',
    })));
  const enumDoTinThap = apis.flatMap((a) => Object.entries(a.truong_enum)
    .filter(([, v]) => v.do_tin !== 'cao')
    .map(([duong, v]) => ({ endpoint: `${a.method} ${a.path_chuan}`, truong: duong, so_gia_tri: v.gia_tri.length, vi_sao: v.vi_sao })));

  const spec = docOpenapi(o.openapiPath);
  let doiChieu = null;
  if (spec) {
    /*
     * `quanSat` gồm CẢ endpoint bị tường lửa chặn. Chúng đã được UI gọi thật — chỉ là ta không thấy phản
     * hồi. Không gom vào thì vế `spec_khai_khong_ai_goi` nở ra bằng chính số endpoint ghi của app.
     */
    const quanSat = new Set(apis.map((a) => `${a.method} ${a.path_chuan}`));
    doiChieu = {
      /*
       * HAI CHIỀU, và hai chiều có ý nghĩa KHÁC NHAU:
       *   · UI gọi mà spec không khai ⇒ đặc tả thiếu, hoặc UI gọi sai endpoint. Phải HỎI.
       *   · spec khai mà không UI nào gọi ⇒ tính năng chưa build, đã gỡ giao diện, hoặc lượt bò chưa tới.
       *     Vế thứ ba quan trọng: KHÔNG được kết luận "chưa build" khi độ đầy đủ lượt bò chưa đạt.
       */
      ui_goi_spec_khong_khai: [...quanSat].filter((k) => !spec.has(k)).sort(),
      /*
       * TÁCH THEO METHOD, vì hai nhóm này đọc KHÁC NHAU hoàn toàn:
       *
       *   · endpoint GHI (POST/PUT/PATCH/DELETE) vắng mặt là CHUYỆN BÌNH THƯỜNG và đã biết trước:
       *     crawler CỐ Ý không bấm nút Lưu/Xoá, nên nó không bao giờ kích hoạt đường ghi. Để lẫn vào vế
       *     dưới thì người đọc thấy "POST /api/truong: không ai gọi" rồi hiểu thành "tính năng chưa
       *     build" — một kết luận sai sinh ra bởi chính luật an toàn của Bước 0.
       *   · endpoint ĐỌC vắng mặt thì MỚI đáng hỏi: hoặc chưa build, hoặc đã gỡ giao diện, hoặc lượt bò
       *     chưa tới màn gọi nó.
       */
      endpoint_ghi_crawler_co_y_khong_goi: [...spec]
        .filter((k) => !quanSat.has(k) && !/^(GET|HEAD|OPTIONS) /.test(k)).sort(),
      spec_khai_khong_ai_goi: [...spec]
        .filter((k) => !quanSat.has(k) && /^(GET|HEAD|OPTIONS) /.test(k)).sort(),
      // UI CÓ gọi nhưng tường lửa chặn ⇒ tách riêng. Chỉ tính lượt thất bại vì BLOCKED_BY_CLIENT.
      ui_goi_nhung_bi_chan: apis.filter((a) => a.bi_tuong_lua_chan).map((a) => `${a.method} ${a.path_chuan}`).sort(),
      _luu_y: 'Vế `spec_khai_khong_ai_goi` CHỈ đọc được là "chưa build" khi `crawl_completeness` đạt ngưỡng. Lượt bò chưa tới màn gọi endpoint đó thì nó cũng rơi vào vế này. Endpoint GHI nằm ở `endpoint_ghi_crawler_co_y_khong_goi` và KHÔNG được đọc là chưa build: crawler cố ý không kích hoạt đường ghi.',
      so_endpoint_spec: spec.size,
    };
  }

  return {
    apis,
    shared_surface_ung_vien: sharedSurface,
    ung_vien_trang_thai: ungVienTrangThai,
    enum_do_tin_thap: enumDoTinThap,
    doi_chieu_openapi: doiChieu,
    _khong_co_openapi: spec ? undefined : 'Không có file OpenAPI đọc được ⇒ KHÔNG đối chiếu được hai chiều. Đây không phải lỗi: dự án này chưa có swagger (đã xác nhận). Danh mục vẫn dùng được, chỉ thiếu vế "spec khai gì".',
    status: 'observed',
  };
}

module.exports = { theoDoi, tongHop, chuanHoaPath, docOpenapi, laMaTrangThai, rutHinhDang };
