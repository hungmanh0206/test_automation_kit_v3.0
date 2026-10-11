'use strict';

/*
 * BẢN ĐỒ ĐIỂM NHẬP VÀ ORACLE INJECTION (v2.6.0 §A9).
 *
 * LÝ DO RIÊNG CHO DỰ ÁN NÀY: back-end là SQL Server và tài khoản có quyền `dbo` (đã ghi nhận), nên một lỗ
 * injection lọt là rủi ro dữ liệu THẬT. Mục tiêu là **kiểm chứng ứng dụng có xử lý input đúng cách**
 * (tham số hoá / escape / từ chối) — không phải hướng dẫn tấn công.
 *
 * KIT KIỂM *ỨNG DỤNG CÓ CHẶN INJECTION KHÔNG*. KIT KHÔNG TỰ INJECTION VÀO DB. File này không nối DB, và
 * không có hàm nào gửi request.
 *
 * HAI VIỆC, dùng chung một nguồn cấu hình (`.agent/config/discovery.json`):
 *   `lietKe()`    — máy liệt kê điểm nhập từ lượt bò + danh mục API, thay vì để người nhớ;
 *   `chamOracle()` — chấm một phản hồi theo bốn dấu hiệu quan sát được ở A9.3.
 *
 * MỨC BẰNG CHỨNG LÀ PHẦN KHÔNG ĐƯỢC BỎ. Một nửa các nhóm điểm nhập chỉ SUY ĐƯỢC chứ không quan sát trực
 * tiếp: `api_body` cần thấy payload (mà tường lửa chặn đường ghi), `export_filter` suy từ tên route,
 * `second_order` suy từ việc trùng TÊN TRƯỜNG giữa hai màn vì kit không lưu giá trị. Gộp chúng vào cùng
 * một bảng với `observed` thì gate sẽ chặn dựa trên phỏng đoán, và người ta sẽ tắt gate.
 */
const fs = require('fs');
const path = require('path');

const CFG_PATH = path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'discovery.json');

const napCfg = (p) => JSON.parse(fs.readFileSync(p || CFG_PATH, 'utf8'));

/** Tên tham số gợi từng nhóm. Khớp theo TÊN, không theo giá trị — giá trị là dữ liệu người. */
const TEN_THAM_SO = {
  sort: /^(sort|sort_?by|order|order_?by|sortField|sortColumn|cot|sapxep)$/i,
  paging: /^(page|page_?no|page_?size|size|limit|offset|skip|take|trang)$/i,
  search: /^(q|query|search|keyword|tim|tu_?khoa|filter_?text)$/i,
  filter: /^(filter|loc|cap|trang_?thai|status|type|loai|[a-z_]*_?id|ma_[a-z_]+)$/i,
  date_range: /^(tu|den|from|to|start|end|tu_?ngay|den_?ngay|date_?from|date_?to)$/i,
};

/** Nhãn ô trên form gợi nhóm lọc/tìm. Dùng khi tham số không xuất hiện ở URL (lọc phía client rồi mới gọi). */
const NHAN_LOC = /(^|[^\p{L}])(tìm|tim|lọc|loc|search|filter|từ ngày|tu ngay|đến ngày|den ngay)([^\p{L}]|$)/iu;

/** Route gợi màn xuất/báo cáo. Đây là SUY DIỄN theo tên — đánh dấu `inferred`, không khai `observed`. */
const ROUTE_XUAT = /(bao-?cao|report|export|xuat|ket-?xuat|thong-?ke)/i;

function nhomCuaThamSo(ten) {
  for (const [nhom, re] of Object.entries(TEN_THAM_SO)) if (re.test(ten)) return nhom;
  return null;
}

/**
 * Liệt kê điểm nhập.
 *
 * @param {{crawl:any, api?:any, cfg?:any}} o
 */
function lietKe(o) {
  const cfg = o.cfg || napCfg();
  const uuTien = cfg.nhom_diem_nhap || {};
  const screens = ((o.crawl || {}).screens) || [];
  const apis = ((o.api || {}).apis) || [];
  const ra = [];
  let n = 0;
  const them = (x) => {
    n += 1;
    ra.push({ id: `IS-${String(n).padStart(3, '0')}`, uu_tien: uuTien[x.nhom] || 'low', ...x });
  };

  /*
   * ① Tham số QUERY quan sát được trên API. Đây là nhóm `observed` chắc nhất: request có thật, tên tham số
   * có thật, và việc nó đi tới truy vấn suy được từ chỗ endpoint trả dữ liệu danh sách.
   */
  for (const a of apis) {
    for (const ten of (a.query_thay || [])) {
      const nhom = nhomCuaThamSo(ten);
      if (!nhom) continue;
      them({
        nhom,
        diem: `tham số \`${ten}\` của \`${a.method} ${a.path_chuan}\``,
        o: a.path_chuan,
        goi_tu: a.goi_tu || [],
        kieu_khai_bao: 'chưa biết — cần đối chiếu đặc tả hoặc OpenAPI',
        di_toi_db: true,
        muc_bang_chung: 'observed',
        vi_sao: nhom === 'sort'
          ? '`ORDER BY` là chỗ khó tham số hoá nhất: thư viện ORM nhận tham số cho GIÁ TRỊ nhưng không nhận cho TÊN CỘT, nên đường sort hay bị ghép chuỗi.'
          : `tham số \`${ten}\` đi vào truy vấn đọc dữ liệu`,
      });
    }
    /*
     * ② Tham số PATH (`:id`). `observed` vì path chuẩn hoá đã thấy đoạn động thật.
     */
    if (/:id/.test(a.path_chuan)) {
      them({
        nhom: 'api_path',
        diem: `đoạn động \`:id\` của \`${a.method} ${a.path_chuan}\``,
        o: a.path_chuan,
        goi_tu: a.goi_tu || [],
        kieu_khai_bao: 'chưa biết',
        di_toi_db: true,
        muc_bang_chung: 'observed',
        vi_sao: 'đoạn path đi thẳng vào điều kiện WHERE; mảng id và trường lồng nhau hay không được validate',
      });
    }
    /*
     * ③ BODY của endpoint ghi. Chỉ SUY ĐƯỢC: tường lửa chặn đường ghi nên kit không bao giờ thấy payload
     * thật. Đánh dấu `inferred` và nói rõ vì sao không quan sát được — đây đúng là chỗ mà một bảng
     * "observed" giả sẽ khiến gate chặn dựa trên phỏng đoán.
     */
    if (!/^(GET|HEAD|OPTIONS)$/.test(a.method)) {
      them({
        nhom: 'api_body',
        diem: `body của \`${a.method} ${a.path_chuan}\``,
        o: a.path_chuan,
        goi_tu: a.goi_tu || [],
        kieu_khai_bao: 'chưa biết',
        di_toi_db: true,
        muc_bang_chung: 'inferred',
        vi_sao: 'KHÔNG quan sát được payload: tường lửa ghi chặn mọi method ngoài GET/HEAD/OPTIONS, nên đây là suy diễn từ việc endpoint tồn tại.',
      });
    }
  }

  /*
   * ④ Ô LỌC / TÌM trên form, kể cả khi tham số không xuất hiện ở URL (lọc client rồi mới gọi API).
   */
  for (const s of screens) {
    /*
     * ĐIỀU KIỆN CẦN: màn phải CÓ thành phần lọc, hoặc nhãn ô phải nói nó là ô lọc/tìm.
     *
     * Bản đầu nhận mọi ô `date_range` làm điểm nhập, bất kể màn nào. Đo ra hai dòng sai: "Khoảng ngày —
     * từ/đến" trên màn `/them-truong` — đó là ô của form THÊM MỚI, giá trị của nó đi vào INSERT chứ không
     * vào điều kiện SELECT. Gọi nó là `date_range` (một nhóm thuộc đường lọc) là xếp sai bản chất, và nó
     * làm bảng nở ra bằng mọi ô ngày của mọi form.
     *
     * Ô form vẫn có thể bị injection qua INSERT. Nhưng đó là chuyện của chiều `[Validation]` và
     * `[DbPersist]`, không phải của bản đồ điểm nhập-vào-truy-vấn này. Trộn hai thứ là làm cả hai mờ đi.
     */
    const manCoLoc = (s.components || []).includes('filter');
    for (const f of (s.fields || [])) {
      const nhan = String(f.nhan || f.ten_truong || '');
      const laNhanLoc = NHAN_LOC.test(nhan);
      const nhom = laNhanLoc ? (/tìm|tim|search/i.test(nhan) ? 'search' : 'filter')
        : ((f.code_loai === 'date_range' && manCoLoc) ? 'date_range' : null);
      if (!nhom) continue;
      them({
        nhom,
        diem: `ô \`${nhan}\` trên màn \`${s.route}\``,
        o: s.route,
        kieu_khai_bao: f.code_loai || 'text',
        di_toi_db: true,
        muc_bang_chung: 'observed',
        vi_sao: 'ô lọc hoặc tìm kiếm đi tới truy vấn dữ liệu',
      });
    }
    /*
     * ⑤ NỘI DUNG FILE IMPORT. `observed` vì ô upload có thật trên DOM. Ưu tiên cao vì nội dung Excel đi
     * thẳng vào DB, và kit đã biết bảng lỗi import của QEMIS rỗng ⇒ phản hồi mù.
     */
    for (const f of (s.fields || [])) {
      if (f.code_loai !== 'file_upload') continue;
      them({
        nhom: 'import_file',
        diem: `tệp nhập ở ô \`${f.nhan || f.ten_truong}\` trên màn \`${s.route}\``,
        o: s.route,
        kieu_khai_bao: `file${f.accept ? ` (${f.accept})` : ''}`,
        di_toi_db: true,
        muc_bang_chung: 'observed',
        vi_sao: 'nội dung tệp đi thẳng vào DB, và phản hồi lỗi theo dòng thường mù',
      });
    }
    /*
     * ⑥ FILTER CỦA MÀN XUẤT / BÁO CÁO. SUY theo TÊN ROUTE — một màn tên "báo cáo" thường dùng lại truy
     * vấn của lưới. Đây là suy diễn, không phải quan sát.
     */
    if (ROUTE_XUAT.test(s.route) && (s.fields || []).length > 0) {
      them({
        nhom: 'export_filter',
        diem: `bộ lọc của màn xuất/báo cáo \`${s.route}\``,
        o: s.route,
        kieu_khai_bao: 'chưa biết',
        di_toi_db: true,
        muc_bang_chung: 'inferred',
        vi_sao: 'SUY theo tên route: màn báo cáo thường dùng lại truy vấn của lưới. Chưa quan sát được truy vấn thật.',
      });
    }
  }

  /*
   * ⑦ SECOND-ORDER. Giá trị nhập ở màn A xuất hiện trong truy vấn của màn B.
   *
   * Kit KHÔNG lưu giá trị (luật PII), nên không so được giá trị. Thay bằng một proxy CẤU TRÚC: cùng một
   * TÊN TRƯỜNG vừa là ô nhập ở màn A, vừa là tham số query hoặc khoá response ở màn B. Proxy này suy
   * diễn, và nó bỏ sót đúng ca khó nhất (tên khác nhau giữa hai màn) — nói ra thay vì vờ như đủ.
   */
  const oNhap = new Map();   // tên trường -> route nhập
  for (const s of screens) {
    for (const f of (s.fields || [])) {
      const t = String(f.ten_truong || '').toLowerCase();
      if (t && !oNhap.has(t)) oNhap.set(t, s.route);
    }
  }
  for (const a of apis) {
    const khoa = new Set([...(a.query_thay || []).map((x) => x.toLowerCase()),
      ...Object.keys(a.hinh_dang || {}).map((k) => k.split('.').pop().replace(/\[\]$/, '').toLowerCase())]);
    for (const t of khoa) {
      const nhapO = oNhap.get(t);
      if (!nhapO) continue;
      const dungO = (a.goi_tu || [])[0] || a.path_chuan;
      if (nhapO === dungO) continue;         // cùng màn thì không phải second-order
      them({
        nhom: 'second_order',
        diem: `trường \`${t}\` nhập ở \`${nhapO}\`, xuất hiện lại ở \`${a.method} ${a.path_chuan}\``,
        o: a.path_chuan,
        second_order_cap: { nhap_o: nhapO, xuat_hien_o: dungO },
        kieu_khai_bao: 'chưa biết',
        di_toi_db: true,
        muc_bang_chung: 'inferred',
        vi_sao: 'Proxy CẤU TRÚC (trùng tên trường), KHÔNG so giá trị — kit không lưu giá trị. Bỏ sót ca tên khác nhau giữa hai màn.',
      });
    }
  }

  /*
   * BỀ MẶT GỘP — thứ gate đem ra đếm, chứ KHÔNG phải từng dòng điểm nhập.
   *
   * Phép đo nói thẳng vì sao cần: trên fixture 6 màn đã ra 12/13 điểm nhập ưu tiên cao. Một app thật có
   * 342 module thì con số đó lên hàng trăm, và một gate đòi "mỗi điểm nhập một case injection" sẽ chặn
   * mọi bộ testcase. Gate bị chặn oan thì người ta tắt gate — đúng lớp lỗi kit đã trả giá nhiều lần.
   *
   * Gộp theo `(nhóm, màn/endpoint)`: ba ô lọc trên cùng một lưới dùng CÙNG một đường tới truy vấn, nên
   * một case injection cho đường đó là đủ để nói "đường này có được tham số hoá hay không". Từng dòng
   * điểm nhập vẫn giữ nguyên trong `diem_nhap` để người đọc biết case ấy phải thử ở những ô nào.
   */
  const gopMap = new Map();
  for (const x of ra) {
    const k = `${x.nhom}\u0000${x.o}`;
    const cu = gopMap.get(k);
    if (!cu) {
      gopMap.set(k, {
        id_be_mat: `BM-${String(gopMap.size + 1).padStart(3, '0')}`,
        nhom: x.nhom, o: x.o, uu_tien: x.uu_tien,
        muc_bang_chung: x.muc_bang_chung, diem_nhap_id: [x.id], so_diem_nhap: 1,
      });
      continue;
    }
    cu.diem_nhap_id.push(x.id);
    cu.so_diem_nhap += 1;
    // Bề mặt lấy mức bằng chứng TỐT NHẤT trong nhóm: một ô quan sát được thì cả đường đó quan sát được.
    if (x.muc_bang_chung === 'observed') cu.muc_bang_chung = 'observed';
  }
  const beMat = [...gopMap.values()];
  const uuTienCao = ra.filter((x) => x.uu_tien === 'critical' || x.uu_tien === 'high');
  const beMatCanCase = beMat.filter((x) => (x.uu_tien === 'critical' || x.uu_tien === 'high') && x.muc_bang_chung === 'observed');
  const dem = ra.reduce((m, x) => { m[x.nhom] = (m[x.nhom] || 0) + 1; return m; }, {});
  const demBangChung = ra.reduce((m, x) => { m[x.muc_bang_chung] = (m[x.muc_bang_chung] || 0) + 1; return m; }, {});

  return {
    build_id: (o.crawl || {}).build_id || null,
    diem_nhap: ra,
    be_mat: beMat,
    tong: {
      tong: ra.length,
      theo_nhom: dem,
      theo_muc_bang_chung: demBangChung,
      uu_tien_cao: uuTienCao.length,
      be_mat: beMat.length,
      // Con số DUY NHẤT mà gate phủ đem ra đếm. Xem chú thích ở chỗ gộp để biết vì sao không đếm từng ô.
      be_mat_can_case: beMatCanCase.length,
    },
    /*
     * CÂU HỎI cho Ambiguity Gate (A9.6): điểm nhập ưu tiên cao mà chưa biết kiểu khai báo. Không tự đoán
     * "sort nhận cột tự do" — đó là thứ phải hỏi, và câu trả lời quyết định case là PASS/FAIL hay `N/A`.
     */
    cau_hoi_ambiguity: uuTienCao
      .filter((x) => /chưa biết/.test(String(x.kieu_khai_bao)))
      .map((x) => ({
        muc: x.uu_tien === 'critical' ? 'Critical' : 'High',
        cau_hoi: `Điểm nhập \`${x.diem}\`: đặc tả có quy định giá trị hợp lệ không (danh sách cố định phía server, hay nhận chuỗi tự do)? Có cho ký tự đặc biệt không?`,
        vi_sao: 'Câu trả lời quyết định case injection ở đây là PASS/FAIL hay được khai `N/A` có lý do. Tự đoán là tự đặt expected.',
        diem_nhap_id: x.id,
      })),
    _kit_khong_injection_vao_db: 'Kit kiểm ỨNG DỤNG có chặn injection không. Kit KHÔNG tự injection vào DB; nhóm quan sát an toàn chỉ đọc phản hồi HTTP/UI, và việc đối chiếu DB (nếu cần) đi qua client CHỈ-ĐỌC của kit.',
    status: 'observed',
  };
}

/**
 * Chấm một phản hồi theo bốn dấu hiệu quan sát được của A9.3.
 *
 * KHÔNG nhận "không thực thi" làm oracle — đó là app==app. Bốn dấu hiệu đều là thứ đọc được từ ngoài:
 *   ① status không 500;
 *   ② KHÔNG lộ thông báo lỗi của DBMS ra UI hay response (từ điển ở `discovery.json`);
 *   ③ một chuỗi điều kiện luôn ĐÚNG và một chuỗi luôn SAI cho CÙNG một kết quả (hệ thống coi cả hai là
 *      chuỗi thường, không phải mệnh đề logic);
 *   ④ giá trị nhập hiển thị lại NGUYÊN VĂN, không bị cắt tại dấu nháy.
 *
 * Dấu hiệu ② một mình đủ để FAIL: thông báo lỗi DB lọt ra ngoài đã là lỗ thông tin, bất kể có inject
 * được hay không.
 *
 * @param {{status?:number, body?:string, hien_thi_lai?:string, gia_tri_nhap?:string,
 *          ket_qua_dieu_kien_dung?:unknown, ket_qua_dieu_kien_sai?:unknown}} pr
 */
function chamOracle(pr, cfg) {
  const c = cfg || napCfg();
  const dauHieu = (c.dau_hieu_loi_sql || []).map((x) => String(x).toLowerCase());
  const than = `${String(pr.body || '')} ${String(pr.hien_thi_lai || '')}`.toLowerCase();
  const khop = dauHieu.filter((d) => than.includes(d));
  const ly = [];

  if (khop.length) {
    return {
      verdict: 'FAIL',
      vi_sao: `Lộ thông báo lỗi của tầng dữ liệu ra ngoài: khớp dấu hiệu ${khop.map((x) => `"${x}"`).join(', ')}. Đây đã là lỗ thông tin, không cần biết có inject được hay không.`,
      dau_hieu_khop: khop,
      self_inconsistent: false,
    };
  }
  if (Number(pr.status) >= 500) {
    return {
      verdict: 'FAIL',
      vi_sao: `HTTP ${pr.status}: input được xử lý như dữ liệu thường thì không làm server lỗi.`,
      self_inconsistent: false,
    };
  }

  /*
   * Cặp điều kiện đúng/sai: CHỈ chấm được khi bên gọi cung cấp CẢ HAI kết quả. Thiếu một vế thì KHÔNG
   * PHÁN ĐƯỢC — và "không phán được" không thành PASS (CLAUDE.md §3).
   */
  const coCap = pr.ket_qua_dieu_kien_dung !== undefined && pr.ket_qua_dieu_kien_sai !== undefined;
  if (coCap) {
    const giong = JSON.stringify(pr.ket_qua_dieu_kien_dung) === JSON.stringify(pr.ket_qua_dieu_kien_sai);
    if (!giong) {
      return {
        verdict: 'FAIL',
        vi_sao: 'Chuỗi điều kiện luôn ĐÚNG và chuỗi luôn SAI cho hai kết quả KHÁC nhau ⇒ hệ thống đang đọc chuỗi nhập như một mệnh đề logic, không như dữ liệu.',
        self_inconsistent: false,
      };
    }
    ly.push('cặp điều kiện đúng/sai cho cùng kết quả');
  }

  if (pr.gia_tri_nhap !== undefined && pr.hien_thi_lai !== undefined) {
    if (!String(pr.hien_thi_lai).includes(String(pr.gia_tri_nhap))) {
      return {
        verdict: 'FAIL',
        vi_sao: `Giá trị nhập KHÔNG hiển thị lại nguyên văn (nhập \`${pr.gia_tri_nhap}\`, hiện \`${pr.hien_thi_lai}\`) ⇒ chuỗi bị cắt, dấu hiệu của ghép chuỗi hoặc escape sai.`,
        self_inconsistent: false,
      };
    }
    ly.push('giá trị hiển thị lại nguyên văn');
  }
  ly.push(`status ${pr.status}`, 'không lộ dấu hiệu lỗi tầng dữ liệu');

  /*
   * ĐỦ BẰNG CHỨNG để PASS hay chưa? Cần ít nhất một dấu hiệu CHỦ ĐỘNG (cặp đúng/sai, hoặc hiển thị lại
   * nguyên văn). Chỉ "không 500 và không lộ lỗi" là hai dấu hiệu THỤ ĐỘNG — một endpoint trả 200 rỗng
   * cũng qua được cả hai, mà nó không chứng minh gì về cách xử lý input.
   */
  const coChuDong = coCap || (pr.gia_tri_nhap !== undefined && pr.hien_thi_lai !== undefined);
  if (!coChuDong) {
    return {
      verdict: 'OBSERVATION',
      vi_sao: 'Chỉ có dấu hiệu THỤ ĐỘNG (không 500, không lộ lỗi). Một endpoint trả 200 rỗng cũng qua được cả hai mà không chứng minh gì về cách xử lý input. Cần cặp điều kiện đúng/sai, hoặc kiểm giá trị hiển thị lại.',
      can_them: ['ket_qua_dieu_kien_dung + ket_qua_dieu_kien_sai', 'hoặc gia_tri_nhap + hien_thi_lai'],
      self_inconsistent: false,
    };
  }
  return { verdict: 'PASS', vi_sao: `Input được xử lý như dữ liệu thường: ${ly.join(' · ')}.`, self_inconsistent: false };
}

module.exports = { lietKe, chamOracle, nhomCuaThamSo, napCfg };
