#!/usr/bin/env node
'use strict';

/*
 * BƯỚC 0 — KHÁM PHÁ HỆ THỐNG (v2.6.0 §A1). Một lệnh, ba chế độ.
 *
 *   npm run discover -- --mode task   --base-url <url> --confirm-nonprod
 *   npm run discover -- --mode system --base-url <url> --confirm-nonprod
 *   npm run discover -- --mode delta  --base-url <url> --confirm-nonprod
 *
 * VÌ SAO LÀ SCRIPT, KHÔNG PHẢI AGENT: đây là điểm số 1 trong 10 điểm vượt kit A. A để agent tự bò qua
 * Playwright MCP — snapshot đi thẳng vào hội thoại nên rất tốn token, và mỗi lượt ra một kết quả khác.
 * Ở đây agent chỉ đọc `summary.txt`, và trần token của nó là một con số trong `prompt_budget.json`.
 *
 * TRẦN TÓM TẮT (§T.3): `task` ≤ 2k · `delta` ≤ 1k · `system` ≤ 4k token. Vượt thì script TỰ RÚT GỌN theo
 * thứ tự ưu tiên — giữ vùng mù và câu hỏi, cắt bảng màn trước. Nó KHÔNG được âm thầm cắt mục quan trọng:
 * mỗi lần rút gọn đều in một dòng nói đã cắt gì.
 *
 * AN TOÀN: mọi lượt đi qua `write_firewall` (không tắt được), và phải có `--confirm-nonprod`. Chặn prod
 * hai chiều. Xem `docs/v2.6.0/DISCOVERY_DESIGN.md §3`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const fw = require(path.join(__dirname, 'discovery', 'write_firewall.js'));
const cr = require(path.join(__dirname, 'discovery', 'crawl.js'));
const ai = require(path.join(__dirname, 'discovery', 'api_inventory.js'));
const fu = require(path.join(__dirname, 'discovery', 'fuse.js'));
const isf = require(path.join(__dirname, 'discovery', 'injection_surface.js'));
const rl = require(path.join(__dirname, 'discovery', 'roles.js'));
const dl = require(path.join(__dirname, 'discovery', 'delta.js'));

const CHARS_PER_TOK = 3.2;
const TRAN = { task: 2000, delta: 1000, system: 4000 };

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const co = (n) => process.argv.includes(`--${n}`);
const tok = (s) => Math.round(String(s).replace(/\r\n/g, '\n').length / CHARS_PER_TOK);

/**
 * Đọc một file session, BÓC bản bọc nếu có.
 *
 * `session_cache` của kit ghi `{ savedAt, storageState }`, còn Playwright đợi `cookies`/`origins` ở gốc.
 * Truyền thẳng đường dẫn thì Playwright KHÔNG ném — nó trả về một context rỗng, và lượt bò bị đẩy về màn
 * đăng nhập. Đo thật trên UAT: triệu chứng `captcha 1 · 0 màn` trông y hệt một session hết hạn.
 */
function docStorageState(duongDan) {
  const j = JSON.parse(fs.readFileSync(duongDan, 'utf8'));
  return j && j.storageState ? j.storageState : j;
}

/** `build_id` = hash của (host + phạm vi + ngày). Cùng build và cùng phạm vi ⇒ dùng lại snapshot. */
function buildId(host, mode, phamVi) {
  const h = crypto.createHash('sha256').update(`${host}\u0000${mode}\u0000${phamVi || ''}\u0000${new Date().toISOString().slice(0, 10)}`).digest('hex').slice(0, 12);
  return `${new Date().toISOString().slice(0, 10)}-${h}`;
}

/**
 * Dựng bản tóm tắt theo thứ tự ƯU TIÊN, rồi cắt từ dưới lên cho vừa trần.
 *
 * Thứ tự có chủ đích: vùng mù và câu hỏi KHÔNG BAO GIỜ bị cắt — đó là thứ duy nhất trong file này mà agent
 * buộc phải hành động theo. Bảng màn bị cắt trước vì chi tiết của nó nằm nguyên trong JSON, mở theo mục
 * bằng `--section`.
 */
function dungTomTat(d, mode) {
  const tran = TRAN[mode] || TRAN.task;
  const cc = d.crawl.crawl_completeness;
  const batBuoc = [];
  const coTheCat = [];

  batBuoc.push(`# Khám phá hệ thống — chế độ ${mode}`);
  batBuoc.push(`build: ${d.build_id} · host: ${d.crawl.target.host} · non-prod đã xác nhận`);
  batBuoc.push(`màn: ${d.crawl.screens.length} · API: ${d.api.apis.length} · vai trò: ${(d.roles || []).length || '(chưa bò theo vai trò)'}`);
  batBuoc.push(`độ đầy đủ lượt bò: ${cc.route_toi_duoc}/${cc.route_phat_hien} route (${Math.round(cc.ti_le * 100)}%)`);
  if (cc.canh_bao) batBuoc.push(`⚠ ${cc.canh_bao}`);
  const kt = cc.khong_toi_duoc;
  batBuoc.push(`không tới được: needs_account ${kt.needs_account} · captcha ${kt.captcha} · error ${kt.error} · budget ${kt.budget}`);
  batBuoc.push(`tường lửa ghi: ${d.crawl.tuong_lua.request_ghi_bi_chan} request ghi bị chặn · ${d.crawl.tuong_lua.request_ghi_lot} lọt (phải là 0)`);
  batBuoc.push('');

  // VÙNG MÙ — không bao giờ cắt.
  batBuoc.push(`## Vùng mù: ${d.fuse.vung_mu.length} màn quan sát được mà tài liệu KHÔNG có mục`);
  for (const r of d.fuse.vung_mu) batBuoc.push(`- ${r}`);
  if (!d.fuse.vung_mu.length) batBuoc.push('- (không có)');
  batBuoc.push('');

  // ĐIỂM NHẬP ưu tiên cao — không cắt.
  const bm = (d.injection.be_mat || []).filter((b) => b.muc_bang_chung === 'observed' && ['critical', 'high'].includes(b.uu_tien));
  batBuoc.push(`## Bề mặt injection cần case: ${bm.length}`);
  for (const b of bm) batBuoc.push(`- ${b.nhom}@${b.o} (${b.uu_tien}, gộp ${b.so_diem_nhap} điểm nhập)`);
  if (!bm.length) batBuoc.push('- (không có)');
  batBuoc.push('');

  /*
   * KHÁC BIỆT SO VỚI LƯỢT TRƯỚC — không cắt, và đứng TRƯỚC mọi thứ khác ở chế độ `delta`. Ở chế độ đó
   * nó là toàn bộ lý do người ta chạy lệnh; mọi mục khác chỉ là nền.
   */
  if (d.delta) {
    if (!d.delta.co_snapshot_truoc) {
      batBuoc.push('## Khác biệt: CHƯA CÓ GÌ ĐỂ SO');
      batBuoc.push(`- ${d.delta._vi_sao}`);
      batBuoc.push('');
    } else {
      batBuoc.push(`## Khác biệt so với \`${d.delta.build_truoc}\`: ${d.delta.so_thay_doi} thay đổi`);
      for (const r of d.delta.man_them) batBuoc.push(`- MÀN MỚI: ${r}`);
      for (const r of d.delta.man_mat) batBuoc.push(`- MÀN MẤT: ${r}`);
      for (const m of d.delta.man_doi) {
        const ph = [];
        if (m.field_them.length) ph.push(`+${m.field_them.length} field`);
        if (m.field_mat.length) ph.push(`-${m.field_mat.length} field`);
        if (m.field_doi.length) ph.push(`${m.field_doi.length} field đổi ràng buộc`);
        if (m.component_them.length) ph.push(`+component ${m.component_them.join(',')}`);
        if (m.component_mat.length) ph.push(`-component ${m.component_mat.join(',')}`);
        batBuoc.push(`- ${m.route}: ${ph.join(' · ')}`);
        for (const f of m.field_doi) for (const k of f.khac) batBuoc.push(`    · ${f.field}.${k.rang_buoc}: ${JSON.stringify(k.truoc)} → ${JSON.stringify(k.sau)}`);
      }
      for (const a2 of d.delta.api_them) batBuoc.push(`- API MỚI: ${a2}`);
      for (const a2 of d.delta.api_mat) batBuoc.push(`- API MẤT: ${a2}`);
      if (!d.delta.so_thay_doi) batBuoc.push('- (không có thay đổi nào)');
      batBuoc.push('');
      const dx = d.delta.de_xuat || [];
      if (dx.length) {
        batBuoc.push(`## Đề xuất chạy lại: ${dx.length} màn (CHỈ đề xuất, không tự chạy)`);
        for (const x of dx) batBuoc.push(`- [${x.muc}] ${x.route} — ${x.vi_sao}`);
        batBuoc.push('');
      }
    }
  }

  // PHÁT HIỆN từ ma trận vai trò — không cắt. Đây là thứ duy nhất trong bản tóm tắt nói app TỰ MÂU THUẪN.
  const ef = ((d.rolesOut || {}).expansion_findings) || [];
  if (ef.length) {
    batBuoc.push(`## EXPANSION_FINDING từ ma trận vai trò: ${ef.length}`);
    for (const f of ef) batBuoc.push(`- ${String(f.vi_sao).slice(0, 200)}`);
    batBuoc.push('');
  }

  // CÂU HỎI Critical/High — không cắt.
  const hoi = [...(d.fuse.cau_hoi_ambiguity || []), ...(d.injection.cau_hoi_ambiguity || []), ...((d.rolesOut || {}).cau_hoi_ambiguity || [])]
    .filter((q) => q.muc === 'Critical' || q.muc === 'High');
  batBuoc.push(`## Câu hỏi Critical/High: ${hoi.length}`);
  for (const q of hoi) batBuoc.push(`- [${q.muc}] ${q.cau_hoi}`);
  if (!hoi.length) batBuoc.push('- (không có)');
  batBuoc.push('');

  // BẢNG MÀN — cắt trước nếu vượt trần.
  coTheCat.push('## Màn quan sát được');
  coTheCat.push('| route | field | component | ô phủ tài liệu |');
  coTheCat.push('|---|---|---|---|');
  const oCua = new Map((d.fuse.doc_coverage || []).map((x) => [x.vung, x.o]));
  for (const s of d.crawl.screens) {
    coTheCat.push(`| ${s.route} | ${(s.fields || []).length} | ${(s.components || []).join(' ') || '—'} | ${oCua.get(s.route) || '?'} |`);
  }

  const ketThuc = ['', `> Chi tiết ở \`${d.outRel}\`. Mở theo mục: \`npm run discover -- --section <screens|apis|roles|coverage|injection>\`.`,
    '> Mọi bản ghi là `observed`, KHÔNG phải oracle. Muốn thành oracle thì qua Ambiguity Gate hoặc có người xác nhận.'];

  let than = [...batBuoc, ...coTheCat, ...ketThuc].join('\n');
  const ghiChuCat = [];
  if (tok(than) > tran) {
    // Cắt bảng màn còn tối đa 10 dòng, nói rõ đã cắt bao nhiêu.
    const giu = coTheCat.slice(0, 13);
    const bo = coTheCat.length - giu.length;
    ghiChuCat.push(`> ⚠ Đã rút gọn để vừa trần ${tran} token: bảng màn cắt còn 10 dòng (bỏ ${bo} màn). Vùng mù, bề mặt injection và câu hỏi KHÔNG bị cắt — xem đủ ở JSON.`);
    than = [...batBuoc, ...giu, ...ghiChuCat, ...ketThuc].join('\n');
  }
  if (tok(than) > tran) {
    ghiChuCat.push(`> ⚠ Vẫn vượt trần sau khi cắt bảng màn (${tok(than)} > ${tran}): phần còn lại toàn là vùng mù và câu hỏi, KHÔNG được cắt. Đây là tín hiệu phạm vi quá rộng — thu hẹp bằng \`--mode task\` hoặc \`--pham-vi\`.`);
    than = [...batBuoc, ...ghiChuCat, ...ketThuc].join('\n');
  }
  return { than, so_token: tok(than), tran, da_rut_gon: ghiChuCat.length > 0 };
}

async function main() {
  const mode = arg('mode', 'task');
  if (!TRAN[mode]) { console.error(`[discover] --mode phải là task|delta|system (nhận "${mode}")`); process.exit(2); }
  /*
   * Lấy URL từ profile khi không truyền cờ. `runtime_config` đã nạp `TASK_ENV` vào `process.env`, nên giá
   * trị KHÔNG phải đi qua dòng lệnh — tức nó không lọt vào history hay log của shell. `OPS_BASE_URL` là
   * tên biến lane mà kit đang dùng.
   */
  const baseUrl = arg('base-url', process.env.BASE_URL || process.env.OPS_BASE_URL || '');
  if (!baseUrl) { console.error('[discover] cần --base-url <url> (hoặc BASE_URL trong task.env)'); process.exit(2); }

  const cfg = fw.napCfg();
  const coCo = co('confirm-nonprod') || process.env[cfg.nhan_dien_prod.bien_moi_truong] === '1';
  const kt = fw.kiemTarget(baseUrl, cfg, coCo);
  if (!kt.duoc) {
    console.error(`[discover] ✗ TỪ CHỐI: ${kt.vi_sao}`);
    process.exit(1);
  }

  const phamViRaw = arg('pham-vi', '');
  const phamVi = phamViRaw ? new RegExp(phamViRaw) : null;
  /*
   * `--mode task` KHÔNG TỰ THU HẸP PHẠM VI. Đo trên UAT 11/10: lượt `--mode task` không truyền phạm vi đã
   * bò cả app — 40 màn, phần lớn là thời khoá biểu, phân hiệu, điểm trường — trong khi task là "Quản lý
   * học sinh". Trước đó `mode` chỉ đổi TRẦN TOÁN TẮT, không đổi phạm vi bò; tức cái tên "task" hứa một
   * thứ mà nó không làm.
   *
   * Không tự đoán phạm vi từ tên task: ánh xạ task → route là tri thức của dự án, đoán hộ rồi bò nhầm chỗ
   * còn tệ hơn bò cả app. Nên: KÊU TO và nói rõ hệ quả cho `scope_anchor`.
   */
  if (mode === 'task' && !phamVi) {
    console.warn('[discover] ⚠ `--mode task` mà KHÔNG có `--pham-vi` ⇒ lệnh sẽ bò CẢ APP, không chỉ module của task.');
    console.warn('      Hệ quả: `scope_anchor` không biết route nào thuộc phạm vi task, nên nó KHÔNG gác được mẫu số.');
    console.warn('      Ví dụ: --pham-vi "^/(C3/)?(HocSinh|QuanLyHocSinh)" — khuôn regex trên đường dẫn.');
  }
  const bid = buildId(kt.host, mode, phamViRaw);
  const OUT = path.resolve(arg('out', path.join(rc.REPO_ROOT, 'knowledge', 'system', 'discovery', bid)));
  fs.mkdirSync(OUT, { recursive: true });

  /*
   * KIỂM ĐỐI SỐ TRƯỚC KHI MỞ BROWSER — và đây là một lỗi thật, không phải dọn dẹp cho đẹp.
   *
   * `--storage-state-roles` được kiểm khuôn ở MÃI CUỐI hàm, sau cả lượt bò. Hậu quả trên UAT: khai sai
   * một dấu bằng thì lệnh vẫn bò hết app — trần là 20 phút — rồi mới nói "sai khuôn". Người chạy mất
   * lượt bò đó, và trên môi trường dùng chung thì mất cả lượt tải lên UAT.
   *
   * Phát hiện 01/11/2026 qua hai phép kiểm chập chờn: chúng khai "sai khuôn ⇒ từ chối" nhưng thực ra
   * phải chờ lượt bò XONG mới tới được chỗ từ chối, nên khi lượt bò hỏng vì môi trường thì chúng đỏ với
   * một thông điệp hoàn toàn khác. Một phép kiểm đối số lẽ ra không phụ thuộc gì vào việc bò được hay
   * không.
   *
   * Thông điệp và mã thoát giữ NGUYÊN — chỉ đổi THỜI ĐIỂM kiểm.
   */
  const khaiVaiSom = arg('storage-state-roles', '');
  const vaiTroDaKiem = [];
  for (const cap of khaiVaiSom.split(',').map((x) => x.trim()).filter(Boolean)) {
    const [ten, tep] = cap.split('=').map((x) => (x || '').trim());
    if (!ten || !tep) { console.error(`[discover] ✗ --storage-state-roles sai khuôn ở "${cap}" — đúng khuôn: ten=duong/dan.json`); process.exit(2); }
    let st;
    try { st = docStorageState(tep); } catch (e) { console.error(`[discover] ✗ vai trò "${ten}": không đọc được ${tep}: ${e.message}`); process.exit(2); }
    if (!((st || {}).cookies || []).length) { console.error(`[discover] ✗ vai trò "${ten}": ${tep} KHÔNG có cookie nào — một context rỗng sẽ làm mọi ô của vai trò này thành "bị chặn" một cách sai.`); process.exit(2); }
    vaiTroDaKiem.push({ ten, tep, st });
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  /*
   * SESSION ĐÃ ĐĂNG NHẬP nạp từ ngoài bằng `--storage-state`. Kit KHÔNG tự đăng nhập trong lệnh này:
   * QEMIS có captcha ở MỖI lượt đăng nhập, nên một bước login tự động sẽ hoặc hỏng, hoặc phải đọc
   * captcha — cả hai đều không thuộc việc của một lệnh khám phá. Không có session thì app nào có login
   * cũng ra "0 màn", và lệnh exit 1 kèm lý do.
   */
  const ss = arg('storage-state', '');
  let ctx = null;
  if (ss) {
    /*
     * BỌC HAY KHÔNG BỌC — và đây là một kiểu hỏng IM LẶNG.
     *
     * `session_cache` của kit ghi `.auth/<key>.json` dưới dạng **bản bọc** `{ savedAt, storageState }`,
     * còn Playwright đợi một file CÓ `cookies`/`origins` ở gốc. Truyền thẳng đường dẫn thì Playwright
     * KHÔNG ném: nó đọc được JSON, không thấy `cookies`, và trả về một context RỖNG. Lượt bò sau đó bị
     * đẩy về màn đăng nhập và báo `captcha 1 · 0 màn` — trông y hệt một session hết hạn.
     *
     * Đo thật: lượt §E đầu tiên trên UAT báo đúng như vậy, và session khi đó MỚI 1 phút tuổi.
     */
    let st = null;
    try { st = docStorageState(ss); } catch (e) {
      console.error(`[discover] ✗ không đọc được --storage-state ${ss}: ${e.message}`);
      process.exit(2);
    }
    const soCookie = ((st || {}).cookies || []).length;
    if (!soCookie) {
      console.error(`[discover] ✗ --storage-state ${ss} KHÔNG có cookie nào. Một context rỗng không ném lỗi — nó chỉ làm lượt bò dừng ở màn đăng nhập rồi báo "0 màn", nên chặn ngay ở đây thay vì để triệu chứng hiện ra ở chỗ khác.`);
      process.exit(2);
    }
    console.log(`[discover] nạp session: ${soCookie} cookie từ ${path.basename(ss)}`);
    ctx = await browser.newContext({ storageState: st });
  }
  const nguon = ctx || browser;
  let rec = null;
  const goc = nguon.newPage.bind(nguon);
  nguon.newPage = async (...a) => { const pg = await goc(...a); rec = ai.theoDoi(pg); return pg; };

  let crawl;
  try {
    crawl = await cr.boApp(browser, {
      baseUrl, coCo, cfg, outDir: OUT, chupAnh: !co('khong-chup-anh'),
      /*
       * `=== ''` chứ KHÔNG `|| undefined`. Bản đầu viết `Number(arg(...)) || undefined`, và nó NUỐT SỐ 0:
       * `0 || undefined` ra `undefined` nên `--max-trang 0` rơi về giới hạn mặc định 120. Phát hiện khi
       * một test đòi "0 màn thì phải exit 1" lại bò đủ 7 màn. Cùng lớp lỗi với `||` trên chuỗi rỗng.
       */
      maxTrang: arg('max-trang', '') === '' ? undefined : Number(arg('max-trang', '')),
      doSau: arg('do-sau', '') === '' ? undefined : Number(arg('do-sau', '')),
      phamVi,
      /*
       * `task` bò trong phạm vi CỘNG lân cận một bước; `system` và `delta` không giới hạn kiểu đó. Đây
       * là chỗ ba chế độ thật sự khác nhau — bản v2.6.0 chỉ cho chúng ba trần token khác nhau rồi khai
       * là "ba chế độ chạy".
       */
      lanCan: mode === 'task' && !!phamVi,
      context: ctx,
      /*
       * `--do-tre` ghi đè độ trễ giữa thao tác. Lượt THẬT trên UAT giữ 250ms của config vì đó là môi
       * trường dùng chung; lượt chạy trên fixture offline đặt 0, vì không có ai để mà lịch sự và một
       * spec hạ tầng chậm thì người ta thôi chạy nó trước khi commit.
       */
      doTre: arg('do-tre', '') === '' ? undefined : Number(arg('do-tre', '')),
      get apiRec() { return rec; },
    });
  } finally { await browser.close(); }

  const api = ai.tongHop(rec, { openapiPath: arg('openapi', '') || undefined });
  const taiLieu = (arg('tai-lieu', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
  /*
   * MA TRẬN VAI TRÒ (§A4), chạy khi có `--storage-state-roles "ten=file,ten2=file2"`.
   *
   * Vì sao nhận SESSION chứ không nhận credential: QEMIS có captcha ở MỖI lượt đăng nhập, nên một lệnh
   * không thể tự đăng nhập hai lần. Mỗi vai trò nạp sẵn một file `.auth` từ ngoài — và kit không bao giờ
   * đọc mật khẩu trong lệnh này.
   *
   * Vai trò KHAI TÊN mà không có session đi vào `vaiTroKhongCoTaiKhoan`: mỗi cái sinh một câu hỏi
   * Critical, và mọi ô của nó là `unknown` — KHÔNG được làm tròn thành "không có quyền".
   */
  const khaiVai = arg('storage-state-roles', '');
  const vaiKhongCo = (arg('vai-tro-chua-co-tai-khoan', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
  let rolesOut = null;
  if (khaiVai || vaiKhongCo.length) {
    const browser2 = await chromium.launch();
    try {
      /* Khuôn và cookie đã kiểm xong TRƯỚC lượt bò; ở đây chỉ còn việc dựng context. */
      const vaiTro = [];
      for (const v of vaiTroDaKiem) {
        vaiTro.push({ ten: v.ten, nguon: path.basename(v.tep), context: await browser2.newContext({ storageState: v.st }) });
      }
      if (vaiTro.length) {
        rolesOut = await rl.lapMaTran(browser2, {
          baseUrl, coCo, cfg, vaiTro, vaiTroKhongCoTaiKhoan: vaiKhongCo,
          routeCanDo: crawl.screens.map((s) => s.route),
          doTre: arg('do-tre', '') === '' ? undefined : Number(arg('do-tre', '')),
        });
      } else if (vaiKhongCo.length) {
        console.warn(`[discover] ⚠ khai ${vaiKhongCo.length} vai trò CHƯA CÓ tài khoản mà không có vai trò nào có session ⇒ không lập được ma trận. Cần ít nhất một vai trò đăng nhập được để biết route nào tồn tại.`);
      }
    } finally { await browser2.close(); }
  }

  /*
   * DELTA. So với snapshot GẦN NHẤT cùng host và CÙNG PHẠM VI. Khác phạm vi thì không so: một lượt bò
   * cả app đặt cạnh một lượt bò một module sẽ cho ra "mọi màn ngoài module đã biến mất", và bản báo cáo
   * đó vô dụng. Không có snapshot nào để so thì NÓI RA, không im lặng trả về 0 khác biệt — "chưa có gì
   * để so" và "không có gì đổi" là hai chuyện khác nhau.
   */
  let delta = null;
  if (mode === 'delta') {
    const goc = path.join(rc.REPO_ROOT, 'knowledge', 'system', 'discovery');
    const truoc = dl.timSnapshotTruoc(goc, { host: kt.host, phamVi: crawl.pham_vi, boQuaBuild: bid });
    if (!truoc) {
      delta = { co_snapshot_truoc: false, _vi_sao: `Không có snapshot nào trước đó cho host này với CÙNG phạm vi (${crawl.pham_vi || 'toàn app'}). Đây KHÔNG phải "0 khác biệt" — chưa có gì để so. Lượt này trở thành mốc cho lần sau.` };
    } else {
      const d = dl.soSanh(truoc.map, { screens: crawl.screens, apis: api.apis });
      delta = { co_snapshot_truoc: true, build_truoc: truoc.build, ...d, ...dl.deXuatChayLai(d) };
    }
  }

  const fuse = fu.gop({ crawl, api, taiLieu });
  const injection = isf.lietKe({ crawl, api, cfg });

  const outRel = path.relative(rc.REPO_ROOT, OUT).replace(/\\/g, '/');
  const goiDu = { build_id: bid, mode, crawl, api, fuse, injection, delta, rolesOut, roles: (rolesOut || {}).roles, outRel };

  fs.writeFileSync(path.join(OUT, 'system_map.json'), JSON.stringify({ build_id: bid, mode, target: crawl.target, screens: crawl.screens, apis: api.apis, doc_coverage: fuse.doc_coverage, crawl_completeness: crawl.crawl_completeness, pham_vi: crawl.pham_vi, roles: (rolesOut || {}).roles || [], role_route_matrix: (rolesOut || {}).role_route_matrix || [], status: 'observed' }, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'injection_surface.json'), JSON.stringify({ build_id: bid, ...injection }, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'api_inventory.json'), JSON.stringify({ build_id: bid, ...api }, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'doc_coverage.json'), JSON.stringify({ build_id: bid, ...fuse }, null, 2), 'utf8');
  if (delta) fs.writeFileSync(path.join(OUT, 'delta.json'), JSON.stringify({ build_id: bid, ...delta }, null, 2), 'utf8');
  if (rolesOut) fs.writeFileSync(path.join(OUT, 'roles.json'), JSON.stringify({ build_id: bid, ...rolesOut }, null, 2), 'utf8');

  const hoiTatCa = [...(fuse.cau_hoi_ambiguity || []), ...(injection.cau_hoi_ambiguity || []), ...((rolesOut || {}).cau_hoi_ambiguity || [])];
  fs.writeFileSync(path.join(OUT, 'questions.md'), [
    '# Câu hỏi tự sinh từ Bước 0 — Khám phá hệ thống', '',
    `> ${bid} · chế độ ${mode}. Gộp vào \`requirements/phase1-clarifications.md\` rồi hỏi user MỘT lần.`,
    '> Câu Critical/High chưa trả lời ⇒ giữ `AMBIGUITY_GATE: PENDING`.', '',
    '| Mức | Câu hỏi | Vì sao phải hỏi |', '|---|---|---|',
    ...hoiTatCa.map((q) => `| ${q.muc} | ${String(q.cau_hoi).replace(/\|/g, '\\|')} | ${String(q.vi_sao).replace(/\|/g, '\\|')} |`),
  ].join('\n'), 'utf8');

  const tt = dungTomTat(goiDu, mode);
  fs.writeFileSync(path.join(OUT, 'summary.txt'), tt.than, 'utf8');

  /*
   * BẢN TÓM TẮT LÀ THỨ DUY NHẤT IN RA STDOUT. Mọi thứ khác nằm trong file. Đây là chỗ cả hạng mục token
   * được giữ: agent đọc đúng từng này, và con số đó đo được.
   */
  console.log(tt.than);
  console.log('');

  /*
   * LƯỢT BÒ KHÔNG TỚI ĐƯỢC GÌ THÌ KHÔNG ĐƯỢC BÁO ✓.
   *
   * Phát hiện khi chạy thử: lượt đầu ra `0 màn · 1 lỗi · 0%` mà lệnh vẫn in dấu ✓ và exit 0. Nguyên nhân
   * lúc đó là lỗi của harness thử (chặn event loop), nhưng chuyện CLI báo THÀNH CÔNG cho một lượt bò
   * rỗng là khuyết điểm riêng của CLI, và nó tệ hơn: người chạy sẽ đi tiếp với một `system_map.json`
   * trống, rồi `scope_anchor` lấy mẫu số bằng 0 và mọi tỉ lệ coverage về sau thành vô nghĩa.
   *
   * "Không phán được" KHÔNG thành "đạt" — cùng luật với verdict (CLAUDE.md §3).
   */
  if (!crawl.screens.length) {
    console.error('[discover] ✗ KHÔNG BÒ ĐƯỢC MÀN NÀO. Đây KHÔNG phải một lượt khám phá thành công, và `system_map.json` vừa ghi là một file rỗng — đừng dùng nó làm mẫu số.');
    const loi = (crawl.crawl_completeness.chi_tiet_khong_toi_duoc || {}).error || [];
    for (const e of loi.slice(0, 3)) console.error(`      ${e.url}: ${String(e.vi_sao || e.status).slice(0, 120)}`);
    console.error('      Kiểm: URL đúng chưa · app có chạy không · có cần đăng nhập trước không (dùng --mode task sau khi nạp session).');
    process.exit(1);
  }
  const ti = crawl.crawl_completeness.ti_le;
  console.log(`[discover] ${ti < 0.8 ? '⚠' : '✓'} ${tt.so_token}/${tt.tran} token tóm tắt${tt.da_rut_gon ? ' (đã rút gọn)' : ''} · chi tiết: ${outRel}`);
  if (ti < 0.8) {
    console.warn(`[discover] ⚠ độ đầy đủ ${Math.round(ti * 100)}% dưới ngưỡng 80% — mọi tỉ lệ coverage dựa trên lượt này phải ghi kèm cảnh báo. KHÔNG chặn, vì một lượt bò hẹp vẫn dùng được khi biết rõ nó hẹp.`);
  }
  if (tt.so_token > tt.tran) {
    console.error(`[discover] ✗ tóm tắt VƯỢT trần ${tt.tran} token sau khi rút gọn — thu hẹp phạm vi.`);
    process.exit(1);
  }
  if (crawl.tuong_lua.request_ghi_lot > 0) {
    console.error(`[discover] ✗ ${crawl.tuong_lua.request_ghi_lot} request ghi LỌT qua tường lửa — đây là lỗi nghiêm trọng, dừng dùng kết quả lượt này.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`[discover] ${e.message}`); process.exit(e.code === 'TARGET_TU_CHOI' ? 1 : 2); });
}

module.exports = { dungTomTat, buildId, TRAN, CHARS_PER_TOK };
