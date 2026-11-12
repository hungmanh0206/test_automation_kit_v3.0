'use strict';

/*
 * BÒ THEO VAI TRÒ (v2.6.0 §A4) — điểm số 2 trong 10 điểm vượt kit A.
 *
 * Điểm yếu của A: nó chỉ thấy phần MỘT tài khoản thấy. Đo được ở chính dự án này: lượt bò fixture bằng vai
 * trò mặc định tìm 6/7 màn — `/admin` bị ẩn khỏi menu nên BFS theo link không có đường tới, trong khi
 * server vẫn trả 200 cho URL đó.
 *
 * BA MỨC BẰNG CHỨNG, giữ nguyên của A (`requirements-analyzer` §3.1.2) và đây là phần không được làm hỏng:
 *   `verified` — đã đăng nhập đúng vai trò đó và thử thật;
 *   `config`   — đọc từ màn cấu hình quyền của chính hệ thống, chưa đăng nhập thử;
 *   `unknown`  — không có căn cứ (không có tài khoản, không có màn cấu hình).
 *
 * LUẬT CỨNG: ô `unknown` **KHÔNG được làm tròn thành "không có quyền"**. "Chưa kiểm chứng" khác "bị chặn".
 * Làm tròn một lần là mất luôn cả lớp case phân quyền, và báo cáo vẫn trông đầy đủ.
 *
 * KHI NÀO LÀ `EXPANSION_FINDING`. `finding.js` định nghĩa nó là **app tự mâu thuẫn với chính nó** — hai bề
 * mặt cùng nguồn mà nói khác nhau thì chắc chắn có một nơi sai, và không cần oracle ngoài. Ở đây điều kiện
 * phải ĐỦ HAI VẾ:
 *   ① route ẩn khỏi menu của vai trò này, NHƯNG hiện trong menu của vai trò khác;
 *   ② mở thẳng URL bằng vai trò này thì VÀO ĐƯỢC.
 * Thiếu vế ① thì ẩn menu không chứng minh gì: rất nhiều app ẩn menu cho gọn trong khi route cố ý mở cho
 * mọi người. Chỉ khi app TỰ phân biệt theo vai trò thì việc ẩn mới là một lời khai về quyền, và lúc đó
 * lời khai đó mâu thuẫn với hành vi của server.
 *
 * CHỈ THỬ URL ĐỌC. Không bao giờ thử URL xoá/sửa — cùng luật của A, và tường lửa ghi vẫn đứng sau chặn.
 * File này KHÔNG đọc và KHÔNG in giá trị credential: hàm đăng nhập do bên gọi truyền vào.
 */
const path = require('path');

const fw = require(path.join(__dirname, 'write_firewall.js'));
const { chuanHoaRoute } = require(path.join(__dirname, 'crawl.js'));

/** Đọc menu điều hướng: nhãn, đích, và ẩn so với hiện-nhưng-disabled. */
async function docMenu(page) {
  return page.evaluate(() => {
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const hien = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const ra = [];
    for (const a of document.querySelectorAll('nav a[href], [role="navigation"] a[href], aside a[href]')) {
      let p = '';
      try { p = new URL(a.href).pathname; } catch (e) { continue; }
      /*
       * `disabled` trên thẻ `<a>` không tồn tại theo chuẩn, nên app thật khai nó bằng ba cách khác nhau.
       * Đọc cả ba: `aria-disabled`, class `disabled`, và `pointer-events: none`. Thiếu một cách là xếp
       * một ô "hiện nhưng không bấm được" thành "vào được" — hai thứ có case khác nhau.
       */
      const khoa = a.getAttribute('aria-disabled') === 'true'
        || /\bdisabled\b/.test(a.className || '')
        || getComputedStyle(a).pointerEvents === 'none';
      ra.push({ nhan: norm(a.textContent), route: p, hien: hien(a), disabled: khoa });
    }
    return ra;
  });
}

/**
 * Thử mở thẳng một route bằng vai trò đang đăng nhập. CHỈ GET.
 *
 * Phân biệt bốn phản ứng, vì chúng dẫn tới bốn kết luận khác nhau:
 *   `vao_duoc`  — 200 và URL không bị đổi;
 *   `chuyen_huong` — 200 nhưng bị đẩy sang màn khác (thường là login);
 *   `bi_chan`   — 401/403;
 *   `loi`       — không phán được (timeout, 5xx) ⇒ phải thành `unknown`, không thành `bi_chan`.
 */
async function thuMoTrucTiep(page, baseUrl, route) {
  let resp = null;
  try {
    resp = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 12000 });
  } catch (e) {
    return { phan_ung: 'loi', vi_sao: String(e.message).slice(0, 80) };
  }
  const code = resp ? resp.status() : 0;
  if (code === 401 || code === 403) return { phan_ung: 'bi_chan', status: code };
  if (code >= 400) return { phan_ung: 'loi', status: code };
  const sau = chuanHoaRoute(page.url());
  if (sau !== chuanHoaRoute(route)) return { phan_ung: 'chuyen_huong', status: code, toi: sau };
  return { phan_ung: 'vao_duoc', status: code };
}

/**
 * Lập ma trận `vai trò × route`.
 *
 * @param {import('playwright').Browser} browser
 * MỘT VAI TRÒ KHAI BẰNG MỘT TRONG HAI CÁCH, và cách thứ hai là cách dùng được từ dòng lệnh:
 *   · `dangNhap(page)` — hàm đăng nhập do bên gọi truyền vào (dùng trong test);
 *   · `context`        — một `BrowserContext` đã nạp sẵn session của vai trò đó. Đây là cách `discover`
 *     dùng: mỗi vai trò một file `.auth`, vì app mẫu có captcha ở MỖI lượt đăng nhập nên không thể đăng
 *     nhập tự động nhiều lần trong một lệnh.
 *
 * @param {{baseUrl:string, vaiTro:{ten:string, dangNhap?:(page:any)=>Promise<void>, context?:any}[],
 *          routeCanDo?:string[], cfg?:any, coCo?:boolean, doTre?:number}} o
 */
async function lapMaTran(browser, o) {
  const cfg = o.cfg || fw.napCfg();
  const kt = fw.kiemTarget(o.baseUrl, cfg, o.coCo === true);
  if (!kt.duoc) {
    const e = new Error(`[roles] TỪ CHỐI: ${kt.vi_sao}`);
    e.code = 'TARGET_TU_CHOI';
    throw e;
  }
  if (!Array.isArray(o.vaiTro) || !o.vaiTro.length) {
    throw new Error('[roles] cần ít nhất một vai trò. KHÔNG tự suy ma trận từ một tài khoản — đó là chỗ A đã nói rõ là bịa.');
  }

  const menuTheoVai = new Map();     // ten -> [{nhan, route, hien, disabled}]
  const tuongLua = [];

  for (const v of o.vaiTro) {
    const page = await ((v.context) || browser).newPage();
    const bb = await fw.install(page, { cfg, domainChoPhep: [new URL(o.baseUrl).host] });
    await page.goto(o.baseUrl, { waitUntil: 'domcontentloaded' });
    if (v.dangNhap) await v.dangNhap(page);
    await page.goto(o.baseUrl, { waitUntil: 'domcontentloaded' });
    menuTheoVai.set(v.ten, await docMenu(page));
    tuongLua.push({ vai_tro: v.ten, ...bb.tomTat() });
    await page.close();
  }

  /*
   * Tập route cần chấm = HỢP menu của mọi vai trò, cộng route bên gọi chỉ định. Lấy hợp chứ không lấy
   * giao: route chỉ một vai trò thấy mới đúng là route đáng đo, và nó sẽ bị bỏ nếu lấy giao.
   */
  const tapRoute = new Set(o.routeCanDo || []);
  for (const ds of menuTheoVai.values()) for (const m of ds) if (m.hien) tapRoute.add(chuanHoaRoute(m.route));

  const oMaTran = [];
  for (const v of o.vaiTro) {
    const page = await ((v.context) || browser).newPage();
    const bb = await fw.install(page, { cfg, domainChoPhep: [new URL(o.baseUrl).host] });
    await page.goto(o.baseUrl, { waitUntil: 'domcontentloaded' });
    if (v.dangNhap) await v.dangNhap(page);

    const menu = menuTheoVai.get(v.ten) || [];
    for (const route of [...tapRoute].sort()) {
      const trongMenu = menu.find((m) => chuanHoaRoute(m.route) === route && m.hien);
      // Vai trò KHÁC có thấy route này trong menu không? Đây là vế ① của điều kiện EXPANSION_FINDING.
      const vaiKhacThay = [...menuTheoVai.entries()]
        .filter(([ten]) => ten !== v.ten)
        .filter(([, ds]) => ds.some((m) => chuanHoaRoute(m.route) === route && m.hien))
        .map(([ten]) => ten);

      if (trongMenu && trongMenu.disabled) {
        /*
         * Ô disabled VẪN thử URL. Một nút bị khoá ở client mà route vẫn mở là CÙNG MỘT LỖ với menu ẩn —
         * chỉ khác đường vào. Không thử thì `hien_disabled` đọc như "đã bị chặn", trong khi ta chỉ biết
         * client đang khoá nút, chưa biết server có chặn.
         */
        const puD = await thuMoTrucTiep(page, o.baseUrl, route);
        oMaTran.push({
          role: v.ten, route, quan_sat: 'hien_disabled', muc_bang_chung: 'verified',
          nhan_menu: trongMenu.nhan, vai_khac_thay: vaiKhacThay,
          server_co_chan: puD.phan_ung === 'bi_chan' || puD.phan_ung === 'chuyen_huong' ? true
            : (puD.phan_ung === 'vao_duoc' ? false : 'khong_phan_duoc'),
          _phan_ung_url: puD,
        });
        continue;
      }
      if (trongMenu) {
        oMaTran.push({
          role: v.ten, route, quan_sat: 'vao_duoc', muc_bang_chung: 'verified',
          qua: 'menu', nhan_menu: trongMenu.nhan, vai_khac_thay: vaiKhacThay,
        });
        continue;
      }

      // Không có trong menu ⇒ thử mở thẳng URL, CHỈ GET.
      const pu = await thuMoTrucTiep(page, o.baseUrl, route);
      if (pu.phan_ung === 'loi') {
        /*
         * KHÔNG PHÁN ĐƯỢC THÌ LÀ `unknown`. Xếp nó thành `bi_chan` là đúng cái A cấm: "chưa kiểm chứng"
         * khác "không có quyền", và làm tròn một lần là mất luôn cả lớp case phân quyền.
         */
        oMaTran.push({
          role: v.ten, route, quan_sat: 'khong_phan_duoc', muc_bang_chung: 'unknown',
          vi_sao: pu.vi_sao || `status ${pu.status}`, vai_khac_thay: vaiKhacThay,
        });
        continue;
      }
      oMaTran.push({
        role: v.ten, route,
        quan_sat: pu.phan_ung === 'vao_duoc' ? 'vao_duoc_qua_url' : (pu.phan_ung === 'chuyen_huong' ? 'bi_chuyen_huong' : 'bi_chan'),
        muc_bang_chung: 'verified',
        qua: 'url_truc_tiep', status: pu.status, toi: pu.toi,
        vai_khac_thay: vaiKhacThay,
      });
      if (o.doTre > 0) await page.waitForTimeout(o.doTre);
    }
    tuongLua.push({ vai_tro: v.ten, giai_doan: 'do_truc_tiep', ...bb.tomTat() });
    await page.close();
  }

  /*
   * EXPANSION_FINDING: đủ HAI VẾ. Ẩn khỏi menu của vai trò này, hiện với vai trò khác, VÀ mở thẳng URL
   * thì vào được. Lúc đó menu và server của CÙNG một app nói hai điều khác nhau.
   *
   * KHÔNG tự kết luận là bug — `finding.js` nói rõ `EXPANSION_FINDING` là defect không cần oracle ngoài,
   * nhưng nó KHÔNG phải verdict của case gốc, và việc log bug là quyết định của người.
   */
  const findings = oMaTran
    .filter((c) => (c.quan_sat === 'vao_duoc_qua_url' && c.vai_khac_thay.length > 0)
      // Nút bị khoá ở client mà server vẫn cho vào: cùng một mâu thuẫn, khác đường vào.
      || (c.quan_sat === 'hien_disabled' && c.server_co_chan === false))
    .map((c) => ({
      loai: 'EXPANSION_FINDING',
      truc: '④branch',
      vi_sao: c.quan_sat === 'hien_disabled'
        ? `Menu của vai trò \`${c.role}\` hiện mục \`${c.nhan_menu}\` nhưng KHOÁ nó (disabled), trong khi mở thẳng URL \`${c.route}\` bằng chính vai trò đó thì VÀO ĐƯỢC (HTTP ${(c._phan_ung_url || {}).status}). Tức việc chặn chỉ nằm ở client.`
        : `Route \`${c.route}\` KHÔNG có trong menu của vai trò \`${c.role}\` nhưng CÓ trong menu của ${c.vai_khac_thay.map((x) => `\`${x}\``).join(', ')} — tức app tự phân biệt theo vai trò. Mở thẳng URL bằng \`${c.role}\` thì vẫn vào được (HTTP ${c.status}). Menu và server của cùng một app đang nói hai điều khác nhau.`,
      self_inconsistent: true,
      can_nguoi_quyet: 'Có thể là lỗ phân quyền, hoặc menu ẩn cho gọn mà route cố ý mở. Hỏi BA trước khi log bug.',
      evidence: { role: c.role, route: c.route, status: c.status, vai_khac_thay: c.vai_khac_thay },
      status: 'observed',
    }));

  /*
   * VAI TRÒ KHÔNG CÓ TÀI KHOẢN — tình huống A gọi là phổ biến nhất ("hệ thống có 5 role nhưng QA chỉ đưa
   * 1 account admin"). Không được BỎ TRỐNG, cũng không được BỊA. Nên mỗi ô của vai trò đó là `unknown`,
   * và mỗi vai trò như vậy sinh một câu hỏi riêng cho Ambiguity Gate.
   *
   * Mức `config` chỉ vào được qua `oConfig` do BÊN GỌI truyền — tức ai đó đã đọc màn cấu hình quyền của
   * chính hệ thống. Kit KHÔNG tự tìm màn đó: nó khác nhau ở mỗi app, và một bộ dò đoán mò sẽ đọc nhầm
   * một màn danh sách người dùng thành ma trận quyền. Nói ra giới hạn này thay vì làm nửa vời.
   */
  const choCfg = new Map();
  for (const c of (o.oConfig || [])) choCfg.set(`${c.role}\u0000${chuanHoaRoute(c.route)}`, c);
  for (const ten of (o.vaiTroKhongCoTaiKhoan || [])) {
    for (const route of [...tapRoute].sort()) {
      const cfgO = choCfg.get(`${ten}\u0000${route}`);
      if (cfgO) {
        oMaTran.push({
          role: ten, route,
          quan_sat: cfgO.cho_phep ? 'cho_phep_theo_cau_hinh' : 'khong_cho_phep_theo_cau_hinh',
          muc_bang_chung: 'config',
          nguon_cau_hinh: cfgO.nguon || '(bên gọi không khai nguồn)',
          chua_dang_nhap_thu: true,
          vai_khac_thay: [],
        });
        continue;
      }
      oMaTran.push({
        role: ten, route, quan_sat: 'khong_co_tai_khoan', muc_bang_chung: 'unknown',
        vi_sao: 'không có tài khoản vai trò này, và không có bản đọc từ màn cấu hình quyền',
        vai_khac_thay: [],
      });
    }
  }

  const dem = { verified: 0, config: 0, unknown: 0 };
  for (const c of oMaTran) dem[c.muc_bang_chung] = (dem[c.muc_bang_chung] || 0) + 1;
  const cauHoi = (o.vaiTroKhongCoTaiKhoan || [])
    .filter((ten) => oMaTran.some((c) => c.role === ten && c.muc_bang_chung === 'unknown'))
    .map((ten) => ({
      muc: 'Critical',
      cau_hoi: `Xin tài khoản vai trò \`${ten}\` để kiểm chứng ${oMaTran.filter((c) => c.role === ten && c.muc_bang_chung === 'unknown').length} ô đang ở mức \`unknown\`.`,
      vi_sao: 'Ô `unknown` KHÔNG được đọc thành "không có quyền". Không có tài khoản thì cả lớp case phân quyền của vai trò này chưa đo được.',
    }));

  return {
    roles: [
      ...o.vaiTro.map((v) => ({ ten: v.ten, nguon: v.nguon || 'task.env', co_tai_khoan: true })),
      ...(o.vaiTroKhongCoTaiKhoan || []).map((ten) => ({ ten, nguon: 'khai tên, chưa có tài khoản', co_tai_khoan: false })),
    ],
    role_route_matrix: oMaTran,
    /*
     * Dòng tổng bắt buộc, theo A: người đọc biết NGAY tin được bao nhiêu phần. Không có dòng này thì một
     * ma trận toàn `unknown` trông y như một ma trận đã kiểm chứng.
     */
    tong_bang_chung: { ...dem, tong: oMaTran.length },
    canh_bao_unknown: dem.unknown > 0
      ? `${dem.unknown}/${oMaTran.length} ô ở mức \`unknown\` — KHÔNG được đọc thành "không có quyền". Mỗi ô như vậy là một câu hỏi cho Ambiguity Gate, không phải một kết luận.`
      : null,
    expansion_findings: findings,
    cau_hoi_ambiguity: cauHoi,
    tuong_lua: tuongLua,
    status: 'observed',
  };
}

module.exports = { lapMaTran, docMenu, thuMoTrucTiep };
