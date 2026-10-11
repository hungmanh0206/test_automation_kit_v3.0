'use strict';

/*
 * BÒ UI TẤT ĐỊNH (v2.6.0 §A2) — điểm số 1 trong 10 điểm vượt kit A.
 *
 * A để agent tự bò qua Playwright MCP: snapshot đi thẳng vào hội thoại nên rất tốn token, và **mỗi lượt
 * chạy ra một kết quả khác** vì thứ tự agent chọn bấm phụ thuộc vào ngữ cảnh lúc đó. Script này đổi cả
 * hai: một lệnh, thứ tự BFS cố định, đầu ra là JSON — agent chỉ đọc bản tóm tắt.
 *
 * TẤT ĐỊNH NGHĨA LÀ GÌ Ở ĐÂY, cụ thể:
 *   · BFS một luồng, hàng đợi theo thứ tự phát hiện; link trong một trang xếp theo thứ tự DOM;
 *   · danh tính màn tính từ (đường dẫn đã chuẩn hoá + tiêu đề), không từ thứ tự thăm;
 *   · hết ngân sách thì CẮT Ở ĐUÔI hàng đợi — nên hai lượt cùng cấu hình cắt đúng cùng chỗ.
 * Mất tính tất định thì `delta` báo khác biệt GIẢ, và đó là lỗi tệ hơn bò chậm.
 *
 * AN TOÀN: mọi `page` đều đi qua `write_firewall` trước khi `goto` lần đầu. Crawler KHÔNG bấm nút nào có
 * nhãn trong `nut_cam_bam`, và chỉ bấm thứ để MỞ RA (accordion, tab) chứ không bấm thứ để GỬI ĐI.
 *
 * KHÔNG BAO GIỜ gọi API trực tiếp. Giữ đúng luật của A: chỉ quan sát request do UI tự phát sinh.
 */
const fs = require('fs');
const path = require('path');

const fw = require(path.join(__dirname, 'write_firewall.js'));
const fp = require(path.join(__dirname, 'fingerprint.js'));
const snapshot = require(path.resolve(__dirname, '..', '..', 'utils', 'ui', 'screen_snapshot.js'));

/**
 * Chuẩn hoá đường dẫn để gộp màn trùng: đoạn số và đoạn dạng uuid/hash thành `:id`.
 *
 * Vì sao cần: `/truong/1` và `/truong/2` là CÙNG một màn. Không gộp thì một lưới 500 bản ghi sinh ra 500
 * "màn", ăn hết ngân sách bò và làm mẫu số coverage vô nghĩa.
 */
function chuanHoaRoute(u) {
  let p;
  try { p = new URL(u).pathname; } catch (e) { p = String(u); }
  return p.replace(/\/+$/, '')
    .split('/')
    .map((seg) => {
      if (/^\d+$/.test(seg)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id';
      if (/^[0-9a-f]{24,}$/i.test(seg)) return ':id';
      return seg;
    })
    .join('/') || '/';
}

/**
 * Danh tính màn = route chuẩn hoá + CHỮ KÝ CẤU TRÚC. KHÔNG dùng tiêu đề.
 *
 * SỬA SAU KHI ĐO (11/10). Bản đầu dùng `route + tiêu đề`, theo đúng chữ trong §A2 ("nhận diện màn bằng
 * tiêu đề, URL chuẩn hoá và tập nhãn chính"). Chạy trên fixture thì `/truong/:id` ra **5 dòng** — mỗi bản
 * ghi một dòng, vì tiêu đề màn chi tiết là `Trường THCS Âu Cơ`, `Trường THCS Thủ Lệ`… Tức nó vỡ đúng ở ca
 * mà tôi viết `chuanHoaRoute` để chống: một lưới 500 bản ghi sinh 500 "màn".
 *
 * Tiêu đề của màn chi tiết là **DỮ LIỆU**, không phải danh tính. Chữ ký cấu trúc thì không: cùng một màn
 * chi tiết thì tập nhãn field, tập component và header bảng giống nhau với mọi bản ghi. Tiêu đề vẫn giữ
 * lại, nhưng chỉ làm TÊN HIỂN THỊ.
 *
 * Đổi lại, hai màn KHÁC nhau mà cùng route và cùng cấu trúc sẽ bị gộp (ví dụ SPA đổi view theo query mà
 * giữ y nguyên bố cục). Ghi rõ giới hạn đó ở đây chứ không vờ như không có.
 */
function chuKyCauTruc(dvt) {
  const nhan = (dvt.fields || []).map((f) => String(f.nhan || f.ten_truong || '').toLowerCase().trim()).filter(Boolean).sort();
  const comp = [...(dvt.components || [])].sort();
  const header = (((dvt.snapshot || {}).tables) || []).flatMap((t) => t.headers || []).map((h) => String(h).toLowerCase().trim()).sort();
  return JSON.stringify([nhan, comp, header]);
}

function danhTinh(route, chuKy) {
  return `${route}\u0000${chuKy}`;
}

/** Mở các khối co lại trên màn (accordion, tab) để dấu vân tay thấy được field bên trong. */
async function moCacKhoi(page, bienBan, cfg, doTre) {
  const moDuoc = [];
  /*
   * CHỈ bấm thứ để MỞ RA. `details > summary`, `[aria-expanded=false]`, `[role=tab]` — ba thứ này không
   * gửi gì đi. Mọi nhãn vẫn qua `duocBam()` trước, vì một app có thể đặt `role=tab` lên một nút Lưu.
   */
  for (const sel of ['details:not([open]) > summary', '[aria-expanded="false"]', '[role="tab"]']) {
    const n = await page.locator(sel).count();
    for (let i = 0; i < Math.min(n, 12); i += 1) {
      const el = page.locator(sel).nth(i);
      let nhan = '';
      try { nhan = (await el.innerText({ timeout: 800 })) || (await el.getAttribute('aria-label')) || ''; } catch (e) { continue; }
      if (!bienBan.duocBam(nhan)) continue;
      bienBan.datNutDangBam(nhan);
      try { await el.click({ timeout: 1200, noWaitAfter: true }); moDuoc.push(nhan.trim()); } catch (e) { /* phần tử biến mất sau lượt bấm trước — bỏ qua, không chặn lượt bò */ }
      if (doTre > 0) await page.waitForTimeout(doTre);
    }
  }
  bienBan.datNutDangBam(null);
  return moDuoc;
}

/**
 * Các vùng phải CHE trong ảnh chụp màn.
 *
 * LỖ HỔNG ĐÃ CÓ THẬT, và nó chỉ lộ ra khi sắp chạm UAT: `§C` đòi che PII trong JSON **và trong ảnh**.
 * JSON đã che (qua `screen_snapshot` và `fingerprint`), nhưng ảnh thì `page.screenshot` chụp thô — tức
 * một lượt bò trên UAT có dữ liệu thật sẽ ghi ra hàng chục ảnh đầy họ tên, ngày sinh và CCCD. Kit đã trả
 * giá cho đúng lớp lỗi này một lần (100 email + 100 SĐT rò ra một file requirements).
 *
 * Che theo HAI đường, vì một đường không đủ:
 *   ① Ô nhập có nhãn PII — `<label for>` khớp `PII_LABEL` thì che chính ô đó;
 *   ② CỘT bảng có header PII — che cả cột, vì ô trong lưới KHÔNG có nhãn kề bên nên đường ① không tới.
 *
 * Dùng `page.screenshot({ mask })` của Playwright: nó tô đè vùng đó lúc chụp, nên dữ liệu không bao giờ
 * nằm trong tệp ảnh — khác hẳn việc chụp xong rồi bôi, lúc đó bản gốc đã tồn tại một nhịp trên đĩa.
 */
async function oCanChe(page) {
  const sel = await page.evaluate(({ piiLabel }) => {
    const PII = new RegExp(piiLabel.source, piiLabel.flags);
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/[:*]\s*$/, '');
    const ra = [];
    let n = 0;
    const danhDau = (el) => {
      if (!el) return;
      const d = `qa-che-${n}`;
      n += 1;
      el.setAttribute('data-qa-che', d);
      ra.push(`[data-qa-che="${d}"]`);
    };
    // ① ô nhập có nhãn PII
    for (const l of document.querySelectorAll('label[for]')) {
      if (!PII.test(norm(l.textContent))) continue;
      danhDau(document.getElementById(l.getAttribute('for')));
    }
    // ② cột bảng có header PII — che cả cột
    for (const t of document.querySelectorAll('table')) {
      const th = [...t.querySelectorAll('thead th')];
      const cot = th.map((h, i) => (PII.test(norm(h.textContent)) ? i : -1)).filter((i) => i >= 0);
      if (!cot.length) continue;
      for (const tr of t.querySelectorAll('tbody tr')) {
        const td = [...tr.querySelectorAll('td')];
        for (const i of cot) danhDau(td[i]);
      }
    }
    return ra;
  }, { piiLabel: { source: snapshot.PII_LABEL.source, flags: snapshot.PII_LABEL.flags } });
  return sel.map((s) => page.locator(s));
}

/** Gom link trong trang, theo thứ tự DOM, chỉ giữ link cùng origin. */
/**
 * Gom link trong trang, theo thứ tự DOM, chỉ giữ link cùng origin.
 *
 * LỖ HỔNG ĐO ĐƯỢC TRÊN UAT THẬT (11/10, lượt §E đầu tiên): crawler ĐI THEO LINK ĐĂNG XUẤT và tự huỷ
 * session của chính nó. `nut_cam_bam` chỉ gác lượt BẤM NÚT; `gomLink` thì gom mọi `a[href]` mà không
 * kiểm nhãn. Trên QEMIS, Đăng xuất là một thẻ `<a>` trong menu người dùng, nằm ngay đầu thứ tự DOM.
 *
 * Hậu quả đo được, và nó ngụy trang rất khéo: bò được 6 màn rồi chạm `/Logout.aspx`, sau đó **292/321
 * route** bị đẩy về màn đăng nhập và bộ dò captcha gắn nhãn `captcha` cho tất cả. Báo cáo đọc ra như
 * "app này bắt captcha ở mọi màn" — một kết luận SAI HẲN về sản phẩm, sinh ra từ một lỗi của chính kit.
 *
 * Chặn theo HAI đường, vì mỗi đường bắt một dạng khác nhau:
 *   ① NHÃN link khớp `nut_cam_bam` — bắt được "Đăng xuất", "Thoát", "Logout";
 *   ② ĐƯỜNG DẪN khớp khuôn đăng xuất — bắt được link chỉ có icon, không chữ.
 */
async function gomLink(page, origin, cfg) {
  const camNhan = (cfg.nut_cam_bam || []).map((x) => fw.chuanHoa(x));
  const ra = await page.evaluate(({ org, cam }) => {
    const chuan = (s) => String(s == null ? '' : s)
      .normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ')
      .trim();
    const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.href); } catch (e) { continue; }
      if (u.origin !== org || /^javascript:/i.test(a.href)) continue;
      const nhan = chuan(a.textContent || a.getAttribute('aria-label') || a.getAttribute('title'));
      const camTheoNhan = cam.some((c) => c && new RegExp(`(^|[^a-z0-9])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(nhan));
      u.hash = '';
      out.push({ url: u.toString(), path: u.pathname, nhan, camTheoNhan });
    }
    return out;
  }, { org: origin, cam: camNhan });

  const RE_THOAT = /(logout|signout|sign-?out|dang-?xuat|dangxuat|thoat)/i;
  const bo = [];
  const giu = [];
  for (const l of ra) {
    if (l.camTheoNhan || RE_THOAT.test(l.path)) { bo.push({ url: l.url, nhan: l.nhan }); continue; }
    giu.push(l.url);
  }
  return { giu, bo };
}

/**
 * Bò một app.
 *
 * @param {import('playwright').Browser} browser
 * @param {{baseUrl:string, outDir?:string, maxTrang?:number, doSau?:number, cfg?:any, chupAnh?:boolean,
 *          phamVi?:RegExp, coCo?:boolean}} o
 */
async function boApp(browser, o) {
  const cfg = o.cfg || fw.napCfg();
  const gh = cfg.gioi_han_luot_bo;
  // `== null` chứ không `||`: `maxTrang: 0` là một yêu cầu hợp lệ (dùng để đo nhánh "bò được 0 màn").
  const maxTrang = o.maxTrang == null ? gh.so_trang_toi_da : o.maxTrang;
  const doSau = o.doSau == null ? gh.do_sau_toi_da : o.doSau;
  const hanPhut = gh.thoi_gian_toi_da_phut || 20;
  /*
   * ĐỘ TRỄ ghi đè được, và mặc định là giá trị trong config (250ms). Lượt THẬT giữ độ trễ đó vì UAT là
   * môi trường dùng chung — bò không trễ thì làm chậm người khác và dễ bị coi là tải bất thường. Lượt
   * TEST chạy trên fixture offline nên đặt 0: spec đầu tiên mất 4,1 phút chỉ vì chờ, và một spec hạ tầng
   * chậm thế thì người ta thôi chạy nó trước khi commit — lúc đó nó không gác gì nữa.
   */
  const doTre = o.doTre == null ? (gh.do_tre_giua_thao_tac_ms || 150) : o.doTre;

  // CHẶN PROD trước mọi thứ. Không có cờ, hoặc host không rõ ⇒ KHÔNG mở trang nào.
  const kt = fw.kiemTarget(o.baseUrl, cfg, o.coCo === true);
  if (!kt.duoc) {
    const e = new Error(`[crawl] TỪ CHỐI BÒ: ${kt.vi_sao}`);
    e.code = 'TARGET_TU_CHOI';
    throw e;
  }

  const origin = new URL(o.baseUrl).origin;
  /*
   * `o.context` cho phép bò bằng một SESSION ĐÃ ĐĂNG NHẬP (`browser.newContext({ storageState })`).
   * Không có nó thì mọi app có login đều ra "0 màn": crawler đứng ở màn đăng nhập và không có đường nào
   * đi tiếp. Và kit KHÔNG tự đăng nhập ở đây — QEMIS có captcha mỗi lượt, nên session phải được nạp sẵn
   * từ ngoài. `context.newPage()` và `browser.newPage()` cùng chữ ký nên chỗ gọi không đổi gì khác.
   */
  const page = await (o.context || browser).newPage();
  const bienBan = await fw.install(page, { cfg, domainChoPhep: [new URL(o.baseUrl).host] });
  /*
   * Bộ theo dõi API gắn vào CÙNG `page`, trước lần `goto` đầu tiên. Nó chỉ NGHE `response`, không gửi gì.
   * Crawler có nhiệm vụ gọi `datRoute()` trước mỗi lần điều hướng — không có bước đó thì danh mục vẫn
   * đúng về endpoint nhưng mất cột `goi_tu`, mà `goi_tu` chính là thứ suy ra `shared_surface`.
   */
  const apiRec = o.apiRec || null;

  const hangDoi = [{ url: o.baseUrl, sau: 0 }];
  const daThay = new Set([o.baseUrl]);
  const daThamDanhTinh = new Set();
  const routeDaTham = new Set();
  const linkDaBo = new Map();   // link CỐ Ý không đi theo (đăng xuất…), giữ lại để báo cáo
  const routePhatHien = new Set([chuanHoaRoute(o.baseUrl)]);
  const screens = [];
  const khongToiDuoc = { needs_account: [], captcha: [], error: [], budget: [], firewall: [] };
  const batDau = Date.now();

  while (hangDoi.length) {
    if (screens.length >= maxTrang) { khongToiDuoc.budget.push(...hangDoi.map((h) => h.url)); break; }
    if ((Date.now() - batDau) / 60000 > hanPhut) { khongToiDuoc.budget.push(...hangDoi.map((h) => h.url)); break; }

    const { url, sau } = hangDoi.shift();
    if (apiRec) apiRec.datRoute(chuanHoaRoute(url));
    let resp = null;
    try {
      resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
      khongToiDuoc.error.push({ url, vi_sao: String(e.message).slice(0, 120) });
      continue;
    }
    const code = resp ? resp.status() : 0;
    if (code === 401 || code === 403) { khongToiDuoc.needs_account.push({ url, status: code }); continue; }
    if (code >= 400) { khongToiDuoc.error.push({ url, status: code }); continue; }

    /*
     * CAPTCHA: nhận theo dấu hiệu DOM, rồi DỪNG NHÁNH — không thử vượt. Kit đã biết captcha QEMIS hiện ở
     * mỗi lượt đăng nhập, và một crawler cố vượt captcha là một crawler bị khoá tài khoản.
     */
    const coCaptcha = await page.locator('[class*="captcha" i], [id*="captcha" i], iframe[src*="recaptcha"], img[alt*="captcha" i]').count();
    if (coCaptcha) { khongToiDuoc.captcha.push({ url }); continue; }

    /*
     * TRẦN MỖI TRANG. Trần TỔNG ở đầu vòng lặp KHÔNG đủ: nó chỉ được kiểm GIỮA các trang, nên một trang
     * treo thì nó không bao giờ bắn và lượt bò chạy vô hạn mà vẫn "trong ngân sách".
     *
     * Chỗ treo được: `page.evaluate` của dấu vân tay và của `gomLink` KHÔNG có timeout nào — trên một
     * lưới Telerik hàng chục nghìn node, phép lọc leaf node có thể rất lâu. Và `moCacKhoi` bấm vào
     * `[aria-expanded]`/`[role=tab]`, mà trên app ASP.NET những nút đó gây POSTBACK — tức một request
     * ghi, bị chính tường lửa của ta abort, để lại trang ở trạng thái điều hướng dở.
     *
     * Hết giờ thì ghi trang đó vào `khong_toi_duoc.error` rồi ĐI TIẾP. Một trang hỏng không được làm
     * chết cả lượt: 11 trang còn lại vẫn là dữ liệu thật.
     */
    const tranTrang = (gh.thoi_gian_moi_trang_giay || 90) * 1000;
    const hetGio = Symbol('het-gio');
    const xuLyTrang = (async () => {
      const moDuoc = await moCacKhoi(page, bienBan, cfg, doTre);
      const route = chuanHoaRoute(url);
      const dvt = await fp.docDauVanTay(page, { route, keoSnapshot: o.keoSnapshot !== false });
      return { moDuoc, route, dvt };
    })();
    const kq = await Promise.race([
      xuLyTrang,
      new Promise((res) => { setTimeout(() => res(hetGio), tranTrang); }),
    ]).catch((e) => ({ _loi: String(e.message).slice(0, 120) }));
    if (kq === hetGio) {
      khongToiDuoc.error.push({ url, vi_sao: `quá ${tranTrang / 1000}s cho một trang — bỏ qua, đi tiếp` });
      continue;
    }
    if (kq && kq._loi) { khongToiDuoc.error.push({ url, vi_sao: kq._loi }); continue; }
    const { moDuoc, route, dvt } = kq;
    const dt = danhTinh(route, chuKyCauTruc(dvt));
    routeDaTham.add(route);

    if (!daThamDanhTinh.has(dt)) {
      daThamDanhTinh.add(dt);
      let anh = null;
      if (o.chupAnh && o.outDir) {
        const ten = `${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}.png`;
        const duong = path.join(o.outDir, 'screens', ten);
        fs.mkdirSync(path.dirname(duong), { recursive: true });
        await page.screenshot({ path: duong, fullPage: true, mask: await oCanChe(page), maskColor: '#111' });
        anh = path.posix.join('screens', ten);
      }
      screens.push({ ...dvt, _dt: dt, url_mau: url, do_sau: sau, khoi_da_mo: moDuoc, evidence: anh, so_ban_ghi_da_xem: 1 });
    } else {
      /*
       * Màn trùng: KHÔNG thêm dòng mới. Ghi `so_ban_ghi_da_xem` để biết màn chi tiết này đã mở trên mấy
       * bản ghi — con số đó có ích (một màn mở được 5 bản ghi khác nhau mà cấu trúc không đổi là bằng
       * chứng cấu trúc ổn định), nhưng nó KHÔNG được làm nở mẫu số coverage.
       */
      const cu = screens.find((s) => s._dt === dt);
      if (cu) {
        cu.so_ban_ghi_da_xem = (cu.so_ban_ghi_da_xem || 1) + 1;
        cu.url_khac = cu.url_khac || [];
        if (cu.url_khac.length < 5) cu.url_khac.push(url);
      }
    }

    if (sau >= doSau) continue;
    const lk = await gomLink(page, origin, cfg);
    for (const x of lk.bo) {
      if (linkDaBo.has(x.url)) continue;
      linkDaBo.set(x.url, x.nhan);
    }
    for (const l of lk.giu) {
      if (daThay.has(l)) continue;
      if (o.phamVi && !o.phamVi.test(new URL(l).pathname)) continue;
      daThay.add(l);
      routePhatHien.add(chuanHoaRoute(l));
      hangDoi.push({ url: l, sau: sau + 1 });
    }
    if (doTre > 0) await page.waitForTimeout(doTre);
  }

  await page.close();

  /*
   * MẪU SỐ PHẢI CÙNG ĐƠN VỊ VỚI TỬ SỐ. Bản đầu lấy `daThay.size` (URL THÔ) làm mẫu số và `screens.length`
   * làm tử số, rồi báo "chỉ bò tới 10/34 route (29%)" trên fixture — một BÁO ĐỘNG GIẢ: 34 gồm cả
   * `/truong?sort=ma`, `/truong?page=2`, `/truong/1..5`, vốn là cùng mấy màn đã thăm. Crawler thật ra đã
   * tới hết.
   *
   * Nay cả hai vế đếm bằng ROUTE ĐÃ CHUẨN HOÁ. Số URL thô vẫn giữ riêng (`url_tho_phat_hien`) vì nó cho
   * biết lượt bò đi qua bao nhiêu đường, nhưng nó KHÔNG phải mẫu số của độ phủ.
   *
   * Giới hạn còn lại, nói thẳng: hai màn khác nhau nằm trên cùng một route đã chuẩn hoá thì mẫu số đếm
   * thiếu. Đổi lại là không còn báo động giả — và một mẫu số nở ra vì `?page=2` thì tệ hơn, vì nó làm mọi
   * tỉ lệ coverage về sau sai theo.
   */
  const soPhatHien = routePhatHien.size;
  const soToiDuoc = routeDaTham.size;
  return {
    target: { host: kt.host, is_nonprod_confirmed: true },
    screens,
    crawl_completeness: {
      route_phat_hien: soPhatHien,
      route_toi_duoc: soToiDuoc,
      url_tho_phat_hien: daThay.size,
      man_rieng_biet: screens.length,
      ti_le: soPhatHien ? Math.round((soToiDuoc / soPhatHien) * 100) / 100 : 0,
      khong_toi_duoc: {
        needs_account: khongToiDuoc.needs_account.length,
        captcha: khongToiDuoc.captcha.length,
        error: khongToiDuoc.error.length,
        budget: khongToiDuoc.budget.length,
        firewall: bienBan.chan.length ? 0 : 0,
      },
      chi_tiet_khong_toi_duoc: khongToiDuoc,
      /*
       * Link CỐ Ý KHÔNG đi theo. Ghi ra chứ không im lặng: người đọc phải biết lượt bò đã tránh những
       * đường nào, nếu không thì "không thấy màn Đăng xuất" trông như một thiếu sót của lượt bò.
       */
      link_co_y_bo_qua: [...linkDaBo.entries()].map(([url, nhan]) => ({ url, nhan })),
      /*
       * Dưới ngưỡng thì MỌI con số coverage về sau phải mang cảnh báo. Không có dòng này thì một lượt bò
       * tới được 40% route vẫn sinh ra một mẫu số trông như đầy đủ.
       */
      /*
       * SESSION CHẾT GIỮA CHỪNG ngụy trang thành "app bắt captcha ở mọi màn". Đo thật trên UAT: 292/321
       * route bị gắn nhãn `captcha`, và báo cáo đọc ra như một đặc điểm của sản phẩm — trong khi nguyên
       * nhân là lượt bò tự đi vào `/Logout.aspx`. Một tỉ lệ captcha cao là tín hiệu của PHIÊN, không
       * phải của app, nên nói thẳng ra ở đây.
       */
      canh_bao_session: (khongToiDuoc.captcha.length > 3 && khongToiDuoc.captcha.length > soToiDuoc)
        ? `${khongToiDuoc.captcha.length} route báo captcha trong khi chỉ bò được ${soToiDuoc} màn. Một app hiếm khi bắt captcha ở mọi màn — nhiều khả năng SESSION ĐÃ CHẾT giữa chừng và mọi trang sau đó là màn đăng nhập. Kiểm "link_co_y_bo_qua" và lịch sử điều hướng trước khi kết luận gì về sản phẩm.`
        : null,
      canh_bao: soPhatHien && soToiDuoc / soPhatHien < 0.8
        ? `Chỉ bò tới ${soToiDuoc}/${soPhatHien} route (${Math.round((soToiDuoc / soPhatHien) * 100)}%) — mọi tỉ lệ coverage dựa trên lượt bò này phải ghi kèm cảnh báo này.`
        : null,
    },
    tuong_lua: bienBan.tomTat(),
    status: 'observed',
  };
}

module.exports = { boApp, chuanHoaRoute, danhTinh, chuKyCauTruc, oCanChe, gomLink };
