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
/**
 * CHỜ MẠNG LẶNG, CÓ BIÊN — để tập request quan sát được là TẤT ĐỊNH.
 *
 * VÌ SAO (đo 14/10/2026, v2.8.1): lượt bò trước đây chỉ có `doTre` — một khoảng chờ PHẲNG, mà hai spec
 * còn truyền `doTre: 0`. Nghĩa là tập request `api_inventory` nhìn thấy = "những request KỊP về trước khi
 * đóng trang", chứ không phải "những request trang này sẽ gửi". Hai spec ghim con số đếm được từ tập đó
 * (`discovery-injection` ghim 11 điểm nhập, `discovery-api-inventory` ghim `goi_tu`) nên mỗi cái đã đỏ
 * một lượt trong `full:suite` rồi xanh 3/3 khi chạy riêng.
 *
 * Lượt đỏ tìm ra **12** điểm nhập, tức NHIỀU hơn mốc — nên 11 là phía đếm THIẾU, và "xanh" là lượt bò
 * chưa tới nơi. Một công cụ khám phá mà kết quả đổi theo lịch chạy thì nó báo bề mặt khác nhau vào những
 * ngày khác nhau, và không ai biết ngày nào đúng.
 *
 * ĐÃ THỬ VÀ BÁC BỎ hai cách chẩn: đốt 6 tiến trình CPU rồi bò 8 lượt ⇒ 8/8 giống nhau; chạy 6 spec
 * discovery cùng lúc 4 lượt ⇒ 4/4 xanh. Nên không tái hiện bằng tải. Nhưng chỗ sai KHÔNG cần tái hiện
 * mới chứng minh được: tập request không bị chặn biên thì nó là một cuộc đua, dù hôm nay đua ra kết quả
 * nào. Sửa cái đua, không sửa con số.
 *
 * Biên là ĐIỀU KIỆN để phép chờ này không thành một `waitForTimeout` trá hình: lặng `langMs` thì đi tiếp,
 * và dù sao cũng không quá `tranMs`. Long-polling hay heartbeat sẽ không bao giờ lặng — gặp nó thì hết
 * trần rồi đi, chứ không treo lượt bò.
 */
async function choLangMang(page, { langMs = 250, tranMs = 2500 } = {}) {
  let dangBay = 0;
  const len = () => { dangBay += 1; };
  const ve = () => { dangBay = Math.max(0, dangBay - 1); };
  page.on('request', len);
  page.on('requestfinished', ve);
  page.on('requestfailed', ve);
  const batDau = Date.now();
  let langTu = Date.now();
  try {
    for (;;) {
      if (Date.now() - batDau >= tranMs) return 'het-tran';
      if (dangBay > 0) langTu = Date.now();
      else if (Date.now() - langTu >= langMs) return 'lang';
      await page.waitForTimeout(50);
    }
  } finally {
    page.off('request', len);
    page.off('requestfinished', ve);
    page.off('requestfailed', ve);
  }
}

async function moCacKhoi(page, bienBan, cfg, doTre) {
  const moDuoc = [];
  /*
   * CHỈ bấm thứ để MỞ RA. `details > summary`, `[aria-expanded=false]`, `[role=tab]` — ba thứ này không
   * gửi gì đi. Mọi nhãn vẫn qua `duocBam()` trước, vì một app có thể đặt `role=tab` lên một nút Lưu.
   */
  /*
   * CHI PHÍ PHẢI BỊ CHẶN TRÊN, và bản đầu không chặn. Đo được: MỘT lượt CLI trên fixture 7 màn mất **98
   * giây** dù đã đặt độ trễ 0 — vượt timeout 90s của test. Nguyên nhân không phải mạng hay tranh chấp
   * worker (tôi đoán nhầm cả hai), mà là chính vòng lặp này: mỗi lần bấm làm DOM đổi, nên những phần tử
   * sau đã biến mất, và mỗi phần tử biến mất vẫn ngốn trọn `innerText` 800ms cộng `click` 1200ms trước
   * khi ném. 7 màn × 3 selector × 12 phần tử × 2s là hàng trăm giây chờ thuần tuý.
   *
   * Ba chỗ siết, không đổi hành vi:
   *   · timeout ngắn lại (250ms / 400ms) — phần tử CÓ THẬT thì không cần tới 800ms;
   *   · dừng một selector sau 2 lần hỏng LIÊN TIẾP: DOM đã đổi thì những phần tử còn lại cũng hỏng theo;
   *   · chốt tổng thời gian cho cả hàm, vì ba selector cộng lại vẫn có thể dài.
   */
  const batDauMo = Date.now();
  const TRAN_MO_MS = 8000;
  for (const sel of ['details:not([open]) > summary', '[aria-expanded="false"]', '[role="tab"]']) {
    if (Date.now() - batDauMo > TRAN_MO_MS) break;
    const n = await page.locator(sel).count();
    let hongLienTiep = 0;
    for (let i = 0; i < Math.min(n, 12); i += 1) {
      if (hongLienTiep >= 2 || Date.now() - batDauMo > TRAN_MO_MS) break;
      const el = page.locator(sel).nth(i);
      let nhan = '';
      try { nhan = (await el.innerText({ timeout: 250 })) || (await el.getAttribute('aria-label')) || ''; } catch (e) { hongLienTiep += 1; continue; }
      if (!bienBan.duocBam(nhan)) continue;
      bienBan.datNutDangBam(nhan);
      try {
        await el.click({ timeout: 400, noWaitAfter: true });
        moDuoc.push(nhan.trim());
        hongLienTiep = 0;
      } catch (e) { hongLienTiep += 1; }
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
  const sel = await page.evaluate(({ piiLabel, chuanHoaSrc }) => {
    const PII = new RegExp(piiLabel.source, piiLabel.flags);
    /*
     * Chuẩn hoá nhãn trước khi so — xem ghi chú ở `pii_mask.CHUAN_HOA_NHAN_SRC`. Mẫu viết ở dạng không
     * dấu để phủ cả nhãn màn lẫn tên cột DB, nên áp thẳng lên nhãn có dấu thì không khớp gì.
     */
    const chuanHoaNhan = new Function('l', chuanHoaSrc);
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
      if (!PII.test(chuanHoaNhan(norm(l.textContent)))) continue;
      danhDau(document.getElementById(l.getAttribute('for')));
    }
    // ② cột bảng có header PII — che cả cột
    for (const t of document.querySelectorAll('table')) {
      const th = [...t.querySelectorAll('thead th')];
      const cot = th.map((h, i) => (PII.test(chuanHoaNhan(norm(h.textContent))) ? i : -1)).filter((i) => i >= 0);
      if (!cot.length) continue;
      for (const tr of t.querySelectorAll('tbody tr')) {
        const td = [...tr.querySelectorAll('td')];
        for (const i of cot) danhDau(td[i]);
      }
    }
    return ra;
  }, { piiLabel: { source: snapshot.PII_LABEL.source, flags: snapshot.PII_LABEL.flags },
    chuanHoaSrc: require(path.resolve(__dirname, '..', 'lib', 'pii_mask')).CHUAN_HOA_NHAN_SRC });
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
  // `== null` chứ không `||`: `maxTrang: 0` là một yêu cầu hợp lệ (dùng để đo nhánh "bò được 0 màn") —
  // và là ngoại lệ duy nhất được phép trả về 0 màn mà không bị coi là phép đo hỏng, xem cuối hàm.
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
  /* `let` chứ không `const`: trang ĐẦU có thể phải dựng lại page — xem `diToi` bên dưới. */
  let page = await (o.context || browser).newPage();
  let bienBan = await fw.install(page, { cfg, domainChoPhep: [new URL(o.baseUrl).host] });
  /*
   * Bộ theo dõi API gắn vào CÙNG `page`, trước lần `goto` đầu tiên. Nó chỉ NGHE `response`, không gửi gì.
   * Crawler có nhiệm vụ gọi `datRoute()` trước mỗi lần điều hướng — không có bước đó thì danh mục vẫn
   * đúng về endpoint nhưng mất cột `goi_tu`, mà `goi_tu` chính là thứ suy ra `shared_surface`.
   */
  /*
   * ĐỌC `o.apiRec` THEO TỪNG LƯỢT, không chụp một lần.
   *
   * `discover.js` bọc `newPage` để gắn bộ theo dõi API cho MỖI page mới, rồi truyền vào đây bằng một
   * getter (`get apiRec() { return rec; }`). Bản trước chụp giá trị đó một lần ở đây, nên khi `diToi`
   * dựng lại page ở trang đầu, biến này vẫn trỏ vào bộ theo dõi CŨ — một bộ đang nghe trên page đã
   * đóng. Hậu quả sẽ là `api_inventory` rỗng mà không ai thấy lỗi gì: đúng kiểu hỏng im lặng.
   */
  const layApiRec = () => o.apiRec || null;

  const hangDoi = [{ url: o.baseUrl, sau: 0 }];   // mục có `lanCan: true` là trang NGOÀI phạm vi, thăm rồi dừng
  const daThay = new Set([o.baseUrl]);
  const daThamDanhTinh = new Set();
  const routeDaTham = new Set();
  const linkDaBo = new Map();   // link CỐ Ý không đi theo (đăng xuất…), giữ lại để báo cáo
  const routePhatHien = new Set([chuanHoaRoute(o.baseUrl)]);
  const screens = [];
  const khongToiDuoc = { needs_account: [], captcha: [], error: [], budget: [], firewall: [] };
  const batDau = Date.now();
  const thuLai = [];   // mỗi lượt điều hướng phải thử lại: giữ để báo cáo, vì một con số 0 ở đây mới có nghĩa

  /*
   * ĐIỀU HƯỚNG CÓ THỬ LẠI — và chỉ thử lại khi lỗi là NHẤT THỜI.
   *
   * Đo 01/11/2026: dưới tranh chấp tài nguyên, `page.goto` tới trang đầu hết hạn ở 15s, trong khi CÙNG
   * lúc đó `http.get` thuần tới CÙNG URL đáp trong 6–48ms (36 mẫu, 0 lỗi). Tức server khoẻ, app khoẻ,
   * nghẽn nằm trong đường ống của browser. Một lần hết hạn như vậy không nói gì về sản phẩm.
   *
   * Hậu quả khi KHÔNG thử lại, đo được: lượt bò trả về 0 màn, `route_toi_duoc: 0`, `ti_le: 0` — và vì
   * trang đầu là nơi mọi link khác được gom, mất nó là mất TOÀN BỘ lượt bò. Với một trang giữa lượt thì
   * nhẹ hơn nhưng cùng bản chất: mẫu số teo lại vì một sự cố nhất thời, rồi mọi tỉ lệ coverage về sau
   * tính trên mẫu số teo đó.
   *
   * KHÔNG thử lại với 4xx/5xx: đó là câu trả lời THẬT của server, phải được ghi nguyên. Chỉ thử lại khi
   * hết hạn hoặc không nối được — hai thứ không phải lời khai của app.
   */
  const RE_NHAT_THOI = /(Timeout|ERR_CONNECTION|ERR_NETWORK|ERR_EMPTY_RESPONSE|ERR_SOCKET|NS_ERROR|net::ERR_ABORTED)/i;
  const LAN_TOI_DA = 3;

  /*
   * TRANG ĐẦU HỎNG thì DỰNG LẠI PAGE, không chờ trên page đang treo. Chọn thế vì đo được, 01/11/2026,
   * ngay lúc một lượt `goto` đang treo:
   *   · goto lượt hai trên CÙNG page : qua sau **11.359ms**
   *   · page MỚI, cùng browser       : qua sau **27ms**
   *   · browser mới                  : qua sau **20ms**
   * Tức cú treo bám vào context đó, và cách ra khỏi nó rẻ hơn cách chờ nó hết **420 lần**.
   *
   * CHỈ ở trang đầu, và chỉ khi chưa thu được gì: lúc đó `bienBan` còn rỗng nên dựng lại không mất lời
   * khai nào của tường lửa. Giữa lượt bò thì KHÔNG dựng lại — `bienBan` đang giữ sổ request đã chặn, và
   * một hàng rào an toàn mất sổ thì tệ hơn một trang bị bỏ.
   *
   * `setTimeout` thuần thay cho `page.waitForTimeout`: bản trước chờ trên chính page vừa hỏng, nên khi
   * page đã đóng, bước nghỉ ném "Target page, context or browser has been closed" — một thông điệp nói
   * sai chỗ hỏng.
   */
  const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
  async function diToi(url, { laTrangDau = false } = {}) {
    let loiCuoi = null;
    for (let lan = 1; lan <= LAN_TOI_DA; lan++) {
      try {
        return { resp: await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }) };
      } catch (e) {
        loiCuoi = e;
        if (!RE_NHAT_THOI.test(String(e.message)) || lan === LAN_TOI_DA) break;
        let dungPageMoi = false;
        if (laTrangDau) {
          try {
            await page.close();
            page = await (o.context || browser).newPage();
            bienBan = await fw.install(page, { cfg, domainChoPhep: [new URL(o.baseUrl).host] });
            dungPageMoi = true;
          } catch (e2) { /* dựng lại không được thì cứ thử tiếp trên page cũ — vẫn hơn là bỏ lượt bò */ }
        }
        thuLai.push({ url, lan, page_moi: dungPageMoi, vi_sao: String(e.message).split('\n')[0].slice(0, 120) });
        await nghi(dungPageMoi ? 100 : 500 * lan);
      }
    }
    return { loi: String(loiCuoi && loiCuoi.message).slice(0, 120) };
  }

  while (hangDoi.length) {
    if (screens.length >= maxTrang) { khongToiDuoc.budget.push(...hangDoi.map((h) => h.url)); break; }
    if ((Date.now() - batDau) / 60000 > hanPhut) { khongToiDuoc.budget.push(...hangDoi.map((h) => h.url)); break; }

    const { url, sau, lanCan: laLanCan } = hangDoi.shift();
    const apiRec = layApiRec();
    if (apiRec) apiRec.datRoute(chuanHoaRoute(url));
    /* "Trang đầu" = chưa thu được màn nào, không phải "vòng lặp thứ nhất": một trang đầu 404 rồi tới
     * trang thứ hai vẫn là lúc `bienBan` còn rỗng, nên dựng lại page vẫn an toàn. */
    const dh = await diToi(url, { laTrangDau: routeDaTham.size === 0 });
    if (dh.loi) { khongToiDuoc.error.push({ url, vi_sao: dh.loi }); continue; }
    const resp = dh.resp;
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
      /*
       * Chờ TRƯỚC khi đọc dấu vân tay và trước khi đi trang kế: `api_inventory` gắn bộ theo dõi vào
       * page, nên request về muộn hơn chỗ này sẽ bị bỏ hoặc được tính tuỳ lịch chạy.
       */
      await choLangMang(page, { langMs: o.langMs == null ? 250 : o.langMs, tranMs: o.tranLangMs == null ? 2500 : o.tranLangMs });
      const route = chuanHoaRoute(url);
      const dvt = await fp.docDauVanTay(page, { route, keoSnapshot: o.keoSnapshot !== false });
      return { moDuoc, route, dvt };
    })();
    /*
     * PHẢI HUỶ TIMER. Bản đầu viết `Promise.race([xuLy, new Promise(res => setTimeout(res, tran))])` và
     * KHÔNG clear — timer vẫn treo sau khi trang xong, và Node không thoát khi còn timer đang chờ. Hậu
     * quả đo được: lệnh `discover` mất **90,7 giây cho MỘT trang** và 95,8s cho bảy trang, tức một chi
     * phí CỐ ĐỊNH bằng đúng trần 90s, không phụ thuộc số trang.
     *
     * Nó ngụy trang rất khéo: lệnh vẫn exit 0, kết quả vẫn đúng, chỉ là chậm. Tôi đã đoán sai hai lần
     * (tranh chấp worker, rồi vòng lặp mở khối) trước khi đo từng pha và thấy chi phí không đổi theo số
     * trang — chính con số "không đổi" đó mới chỉ ra đây là timer, không phải việc làm thật.
     */
    let dongHo = null;
    const kq = await Promise.race([
      xuLyTrang,
      new Promise((res) => { dongHo = setTimeout(() => res(hetGio), tranTrang); }),
    ]).catch((e) => ({ _loi: String(e.message).slice(0, 120) }));
    if (dongHo) clearTimeout(dongHo);
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
      screens.push({ ...dvt, _dt: dt, url_mau: url, do_sau: sau, lan_can: laLanCan === true, khoi_da_mo: moDuoc, evidence: anh, so_ban_ghi_da_xem: 1 });
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
      /*
       * LÂN CẬN MỘT BƯỚC. §A1 hứa `--mode task` bò "module của task CỘNG lân cận 1 bước", nhưng bản
       * v2.6.0 lọc cứng theo `phamVi` nên lân cận không bao giờ vào hàng đợi — ba chế độ chạy giống hệt
       * nhau và chỉ khác trần token. Đó là một lời hứa trong tên gọi mà mã không giữ.
       *
       * Lân cận có giá trị thật: màn ngoài phạm vi mà module của task LINK TỚI là chỗ dữ liệu đi ra hoặc
       * đi vào, tức đúng nơi lỗi xuyên module sống. Nhưng nó KHÔNG được nở ra: trang lân cận được thăm
       * rồi dừng, không gom link tiếp. Thiếu chặn đó thì "lân cận 1 bước" biến thành bò cả app sau vài
       * vòng.
       */
      const trongPhamVi = !o.phamVi || o.phamVi.test(new URL(l).pathname);
      if (!trongPhamVi) {
        if (!o.lanCan || laLanCan) continue;          // không bật lân cận, hoặc đang Ở một trang lân cận
        daThay.add(l);
        routePhatHien.add(chuanHoaRoute(l));
        hangDoi.push({ url: l, sau: sau + 1, lanCan: true });
        continue;
      }
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
  /*
   * LƯỢT BÒ TỚI 0 MÀN KHÔNG PHẢI MỘT QUAN SÁT — nó là một phép đo KHÔNG CHẠY ĐƯỢC, và hai thứ đó phải
   * ra hai kết quả khác nhau.
   *
   * Bản trước trả về `{screens: [], ti_le: 0, status: 'observed'}`. Người đọc kế tiếp không phải người
   * mà là `dimension_manifest` và `scope_anchor`: chúng lấy `screens` làm MẪU SỐ. Mẫu số 0 thì mọi tỉ lệ
   * phủ về sau là 0/0, và lượt bò vẫn tự khai `observed` — đúng lớp lỗi "0% lỗi trên 0 request" mà kit
   * đã bị cắn ở lượt k6: một con số tính trên không có gì, trông như một con số.
   *
   * Đo 01/11/2026: dưới tranh chấp, trang đầu hết hạn ở 15s (server khoẻ, http thuần 6–48ms) và lượt bò
   * trả về 0 màn, `status: 'observed'`. Phép kiểm tính tất định đọc kết quả đó rồi kết tội CRAWLER mất
   * tất định — một lời buộc tội SAI cho một phép đo chưa từng chạy.
   *
   * NÉM, không trả về. Lượt bò đã thử lại tới 3 lần mỗi trang trước khi tới đây, nên đây không phải lỗi
   * nhất thời: nó là "không vào được app", và câu trả lời đúng cho câu đó là dừng lại, không phải báo cáo.
   */
  /*
   * NGOẠI LỆ DUY NHẤT: `maxTrang: 0`. Đó là người gọi CỐ Ý xin một lượt bò 0 trang (nhánh đo ngân sách),
   * nên 0 màn ở đây là câu trả lời đúng chứ không phải phép đo hỏng. Phân biệt được vì ngân sách 0 ghi
   * toàn bộ hàng đợi vào `khong_toi_duoc.budget`, không ghi gì vào `error`.
   */
  if (soToiDuoc === 0 && maxTrang !== 0) {
    const ct = JSON.stringify(khongToiDuoc).slice(0, 400);
    const e = new Error(`[crawl] KHÔNG BÒ ĐƯỢC MÀN NÀO từ ${o.baseUrl} — đây là phép đo KHÔNG CHẠY ĐƯỢC, `
      + `không phải "app có 0 màn". Đã thử lại ${thuLai.length} lượt điều hướng `
      + `(trần ${LAN_TOI_DA} lần/lượt). Chi tiết: ${ct}`);
    e.code = 'BO_DUOC_0_MAN';
    e.chi_tiet = khongToiDuoc;
    throw e;
  }
  return {
    target: { host: kt.host, is_nonprod_confirmed: true },
    /*
     * PHẠM VI phải đi theo kết quả. `scope_anchor` chỉ được hỏi về những route NẰM TRONG phạm vi của
     * task; không biết phạm vi thì nó không gác được gì có nghĩa. Đo trên UAT: lượt `--mode task` KHÔNG
     * truyền phạm vi đã bò cả app (40 màn, phần lớn là thời khoá biểu và phân hiệu) trong khi task là
     * "Quản lý học sinh" — và gate sẽ báo 39/40 "bỏ sót" cho những màn vốn ngoài phạm vi.
     */
    pham_vi: o.phamVi ? String(o.phamVi.source) : null,
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
        /*
         * SỬA 01/11/2026. Dòng này từng là `bienBan.chan.length ? 0 : 0` — một ternary CHẾT, luôn trả 0
         * bất kể gì: một ô báo cáo KHÔNG CÓ KHẢ NĂNG báo cáo.
         *
         * Bản vá ĐẦU của tôi đặt `bienBan.chan.length`, và nó SAI VẾ: cả khối này đếm ROUTE KHÔNG TỚI
         * ĐƯỢC, còn `chan` đếm REQUEST GHI BỊ CHẶN — hai đơn vị khác nhau, và số request ghi bị chặn đã
         * có chỗ riêng ở `tuong_lua.request_ghi_bi_chan`. Đúng khuyết điểm ② mà chính hàm này ra đời để
         * chữa: tử số đếm màn, mẫu số đếm URL thô.
         *
         * Giá trị đúng là `khongToiDuoc.firewall.length`. Nó bằng 0 hôm nay, nhưng là một số 0 THẬT:
         * hiện KHÔNG nhánh nào ghi vào giỏ đó, vì tường lửa chặn request chứ chưa bao giờ làm một route
         * không tới được. Ngày có nhánh như vậy thì ô này báo, còn ternary cũ thì không.
         */
        firewall: khongToiDuoc.firewall.length,
      },
      chi_tiet_khong_toi_duoc: khongToiDuoc,
      /*
       * SỐ LẦN PHẢI THỬ LẠI điều hướng. Công khai chứ không im lặng: một lượt bò thử lại 40 lần vẫn ra
       * kết quả "đủ màn", nhưng nó đang nói rằng môi trường đo không ổn định — và người đọc phải biết
       * điều đó trước khi lấy lượt bò này làm mẫu số.
       */
      so_lan_thu_lai_dieu_huong: thuLai.length,
      chi_tiet_thu_lai: thuLai.slice(0, 20),
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

module.exports = { boApp, chuanHoaRoute, choLangMang, danhTinh, chuKyCauTruc, oCanChe, gomLink };
