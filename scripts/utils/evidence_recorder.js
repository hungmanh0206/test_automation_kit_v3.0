/**
 * EvidenceRecorder — chuẩn hoá evidence Phase 2 theo mức B (đổi 22/10/2026):
 *   - MỌI step của MỌI case đã execute phải có trạng thái pass/fail — chỗ này KHÔNG đổi;
 *   - ẢNH thì theo độ sâu: case thường 1 ảnh ở BƯỚC QUYẾT ĐỊNH, case tầng bug
 *     (`product_bug`/`api_bug`) ảnh TỪNG step, đủ chuỗi để dev dựng lại;
 *   - ảnh nào cũng highlight vào đúng element được kiểm ở step đó.
 *
 * Recorder vẫn chụp được từng step — nó là công cụ, không phải chỗ phán. Máy quyết định đủ hay thiếu
 * là `scripts/qa/output_gate.js` (nhận tầng bug bằng `laTangBug()` trong `lib/output_rules.js`).
 * Luật: `RULE_GLOBAL.md` §Evidence. Số đo và lý do: `docs/rationale/evidence-muc-b.md`.
 *
 * Ảnh lưu: <projectOutputDir>/tasks/<taskKey>/test-results/evidence/<TC_ID>/<CẤP>/step-NN-<status>.png
 * Ghi ra:  <projectOutputDir>/tasks/<taskKey>/test-results/testcase-status.json
 *   schema đúng với push_test_execution.js:
 *   { taskKey, generatedAt, runId?, tests: [ {
 *       tcId, status, comment, evidence:[...], steps:[ {name, status, comment, evidence:[...], tienDe?} ],
 *       recordedAt, scope?,
 *       run: { evidenceDir, id?, spec?, title?, project?, retry?, worker? }   // NGUỒN GỐC, đóng dấu từng case
 *   } ] }
 *
 * Cách dùng trong automation task-scoped (standalone Playwright):
 *   const { EvidenceRecorder } = require('<repo>/scripts/utils/evidence_recorder');
 *   const rec = new EvidenceRecorder({ taskKey:'<TASK_KEY>', projectOutputDir:'outputs/<PROJECT>', runId });
 *   const tc = rec.case('OPS_ORD_TC_021');
 *   await tc.step(page, 'Mở dropdown Hình thức', { highlight: page.getByLabel('Hình thức'),
 *        assert: async () => (await page.getByRole('option').count()) === 2 });   // pass/fail suy từ assert
 *   await tc.step(page, 'Kiểm giá trị', { highlight: locator, status: 'PASSED' });  // hoặc set tay
 *   await tc.finish();            // status tổng = FAILED nếu có step fail, else PASSED
 *   await rec.write();            // ghi testcase-status.json (merge)
 *
 * TODO không cần evidence: đừng gọi step()/case() cho case chưa chạy — chỉ ghi case đã execute.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitize } = require('./evidence/sanitize');   // #3: PII safety-net
const { buildManifest, readManifest } = require('./evidence/manifest'); // #3: index evidence + kiểm tồn tại

// Danh mục tầng lỗi lấy TỪ MỘT NGUỒN (.agent/config/verdict_taxonomy.json), không chép lại thành hằng
// ở đây — chép là mở đường cho hai danh mục trôi khỏi nhau.
const VERDICT_TAXONOMY = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.agent/config/verdict_taxonomy.json'), 'utf8'));
  } catch (e) {
    return {};   // thiếu file thì bước preflight config-integrity đã chặn riêng
  }
})();

/*
 * TÊN CHUẨN CỦA VERDICT — và vì sao recorder BẮT BUỘC phải tra bảng này.
 *
 * `verdict_taxonomy.json` khai tên chuẩn là `FAIL`, còn `FAILED` chỉ là **đồng nghĩa**
 * (`synonyms: {"PASSED":"PASS","FAILED":"FAIL",…}`). Recorder trước đây ghim nguyên văn `'FAILED'` ở
 * bảy chỗ và không hề tra `synonyms`. Hệ quả: gọi `finish('FAIL', …)` — **đúng tên chuẩn** — thì
 *
 *   · `failureLayer` bị xoá trắng,
 *   · phép kiểm "FAIL bắt buộc khai tầng" không nổ,
 *   · phép kiểm "tầng phải nằm trong taxonomy" không chạy,
 *   · `reruns` không được đếm,
 *   · và `bug_claim.js` lọc CHỈ theo `failureLayer` nên không thấy case nào để đòi claim.
 *
 * Bốn cửa tắt cùng lúc, và cách tắt chúng là **viết đúng chuẩn**. Đo 30/10/2026 bằng
 * `tests/fe/infra/verdict-dong-nghia.spec.ts`: 4/5 ca kiểm đỏ trước khi vá. Trên sổ thật có 55 ca đỏ
 * mang `status: 'FAIL'`, trong đó 6 ca khai tầng `be`/`fe` — hai giá trị KHÔNG nằm trong 8 tầng
 * taxonomy khai, tức đúng loại giá trị mà phép kiểm lẽ ra phải chặn.
 *
 * Chỉ chuẩn hoá để QUYẾT ĐỊNH; `status` ghi ra sổ vẫn giữ nguyên chữ người gọi truyền, vì `output_gate`
 * và `run:analysis` đều đã tự chuẩn hoá khi đọc — đổi dữ liệu ghi ra là đổi một lỗ lấy một lỗ.
 */
function chuanHoaVerdict(s) {
  const v = String(s || '').trim().toUpperCase();
  const dn = VERDICT_TAXONOMY.synonyms || {};
  return dn[v] || v;
}
/** Case này có phải một lượt FAIL không — bất kể viết `FAIL` hay `FAILED`. */
function laFail(s) { return chuanHoaVerdict(s) === 'FAIL'; }

function pad2(n) { return String(n).padStart(2, '0'); }
function ts() { try { return new Date().toISOString(); } catch { return ''; } }

// G0 (round-3 hardening): tên shard file an toàn + ghi JSON ATOMIC (temp → rename; rename thay thế
// atomic cross-platform qua libuv) → không bao giờ đọc trúng file ghi dở, không mất update do đè.
const STATUS_DIRNAME = 'testcase-status';
function safeName(id) { return String(id || 'unknown').replace(/[^\w.-]+/g, '_'); }
function writeJsonAtomic(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * PHẠM VI của lượt chạy hiện tại — đơn vị/cấp mà kết quả này thuộc về.
 *
 * Đọc từ env chứ không nhận tham số: mọi spec đều đã lấy đơn vị làm việc từ đúng những biến này, nên
 * đọc lại ở đây thì dấu LUÔN khớp thứ thật sự được drive. Nếu bắt spec tự khai, sẽ có spec khai sai
 * hoặc quên khai — mà dấu sai còn tệ hơn không có dấu.
 *
 * `capHocLamViec` ưu tiên trước `capHoc`: biến sau là cấp ở FORM ĐĂNG NHẬP, biến trước mới là cấp của
 * ĐƠN VỊ LÀM VIỆC — và chính chỗ lệch giữa hai biến này từng làm 8 spec đo nhầm màn.
 *
 * Trả `null` khi không có biến nào: task không chạy app có ngữ cảnh ngầm thì không bịa ra dấu.
 */
/**
 * Mã cấp học ngắn, an toàn cho tên thư mục: MN · TH · THCS · THPT · GDTX.
 *
 * Trùng bảng quy đổi của `scripts/qa/result_ledger.js` — cùng một khái niệm thì phải cùng một phép
 * quy đổi, nếu không ảnh nằm ở `THCS/` mà verdict đóng dấu `THPT` và không ai đối soát được.
 * Không suy được cấp thì dùng `khong-ro-cap` chứ KHÔNG gộp vào gốc: gộp là quay lại đúng lỗi ghi đè.
 */
/* Biến nào mang ngữ cảnh, và bảng quy đổi ra mã ngắn, là DỮ LIỆU của dự án: `.agent/config/context_pins.json`
 * (v3.0.0). Chưa khai thì không có dấu ngữ cảnh — đúng như task không chạy app có ngữ cảnh ngầm. */
const PINS = require('./context_pins');
function maCapAn() {
  const p = PINS.docPins();
  const v = PINS.giaTri(p, 'capHoc');
  return (v && PINS.maNgan(p, 'capHoc', v)) || 'khong-ro-cap';
}

function scopeHienTai() {
  const p = PINS.docPins();
  const s = {
    capHoc: PINS.giaTri(p, 'capHoc'),
    truong: PINS.giaTri(p, 'truong'),
    namHoc: PINS.giaTri(p, 'namHoc'),
  };
  return Object.values(s).some(Boolean)
    ? Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined))
    : null;
}

/**
 * Aggregator (dùng chung): gộp testcase-status.json cũ + mọi shard testcase-status/<TC>.json
 * → ghi lại testcase-status.json (atomic). Idempotent; runner/CI gọi 1 lần cuối để có bản đầy đủ
 * sau khi mọi worker đã ghi shard. shard (per-TC) là source-of-truth, không đua chéo TC.
 */
function aggregateStatus({ testResultsDir, taskKey = '', runId = '', log = false } = {}) {
  const statusFile = path.join(testResultsDir, 'testcase-status.json');
  const shardDir = path.join(testResultsDir, STATUS_DIRNAME);
  const byId = new Map();
  try { const ex = JSON.parse(fs.readFileSync(statusFile, 'utf8')); for (const t of ex.tests || []) if (t && t.tcId) byId.set(t.tcId, t); } catch { /* chưa có / hỏng → bỏ qua */ }
  let shards = 0;
  try {
    for (const f of fs.readdirSync(shardDir)) {
      if (!f.endsWith('.json')) continue;
      try { const s = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); if (s && s.test && s.test.tcId) { byId.set(s.test.tcId, s.test); shards++; } } catch { /* shard hỏng → skip */ }
    }
  } catch { /* chưa có shard dir */ }
  const scope = scopeHienTai();
  const out = {
    taskKey, generatedAt: ts(), ...(runId ? { runId } : {}), ...(scope ? { scope } : {}), tests: [...byId.values()],
  };
  writeJsonAtomic(statusFile, out);
  let missingCount = 0;
  try { missingCount = buildManifest(testResultsDir).missingCount; } catch (e) { /* best-effort */ }
  if (log) console.log(`[evidence] aggregate: ${byId.size} case (từ ${shards} shard + status cũ) → ${statusFile}${missingCount ? ` · ⚠ ${missingCount} evidence THIẾU file (xem evidence-manifest.json)` : ''}`);
  return { statusFile, count: byId.size, shards, missingCount };
}

async function highlight(page, target) {
  if (!target) return null;
  let handle = null;
  try {
    if (typeof target === 'string') handle = await page.$(target);
    else if (typeof target.elementHandle === 'function') handle = await target.first().elementHandle({ timeout: 2000 }).catch(() => null);
    else if (typeof target.evaluate === 'function') handle = target; // đã là ElementHandle
  } catch { handle = null; }
  if (!handle) return null;
  try {
    await page.evaluate((el) => {
      el.__evPrev = { outline: el.style.outline, box: el.style.boxShadow, offset: el.style.outlineOffset };
      el.style.outline = '3px solid #e11d48';
      el.style.outlineOffset = '2px';
      el.style.boxShadow = '0 0 0 4px rgba(225,29,72,.30)';
      el.scrollIntoView({ block: 'center', inline: 'center' });
    }, handle);
  } catch { return null; }
  return handle;
}
async function unhighlight(page, handle) {
  if (!handle) return;
  try { await page.evaluate((el) => { const p = el.__evPrev || {}; el.style.outline = p.outline || ''; el.style.boxShadow = p.box || ''; el.style.outlineOffset = p.offset || ''; }, handle); } catch { /* noop */ }
}

class Case {
  constructor(recorder, tcId) {
    this.rec = recorder;
    this.tcId = tcId;
    this.steps = [];
    /*
     * GHI DANH NGAY KHI TẠO — để `write()` phát hiện case nào CHƯA `finish()`.
     *
     * Vì sao cần: recorder chỉ ghi shard khi `finish()` chạy. Mà mọi spec đều có `expect` chốt tiền
     * điều kiện TRƯỚC khi gọi `finish` (vd "form không mở"); assert đó ném là `finish` không bao giờ
     * tới, shard GIỮ NGUYÊN verdict của LƯỢT TRƯỚC — và một verdict cũ trông y hệt một verdict mới.
     * Đo 09/10/2026: `TC_123` mang nhãn `BLOCKED_SETUP` sai suốt 4 lượt vì chuyện này, dù lượt nào
     * cũng trích đủ dữ liệu. Quét toàn bộ spec thấy 9 chỗ cùng mẫu.
     *
     * Sửa ở ĐÂY thay vì ở 9 chỗ gọi: spec mới viết sai thứ tự vẫn không để lại kết quả cũ.
     */
    if (recorder && recorder._dangTreo) recorder._dangTreo.add(tcId);
    /*
     * TÁCH THEO CẤP HỌC — không có tầng này thì evidence của các cấp GHI ĐÈ nhau.
     *
     * Đường dẫn cũ là `evidence/<TC_ID>/step-NN-<status>.png`, không mang chiều cấp. Case khai
     * "Áp dụng cho cấp = Tất cả" chạy ở 5 cấp thì cả 5 lượt ghi vào CÙNG tên file: thứ còn lại là
     * mảnh ghép của nhiều lượt, mỗi cặp (step, status) giữ dấu của lượt ghi sau cùng.
     *
     * Đo TASK-9001 ngày 15/10/2026: 41/210 thư mục chứa ảnh của ≥2 lượt, thêm 129 thư mục mà Excel
     * khai kết quả ở ≥2 cấp nhưng chỉ còn ảnh của một lượt ⇒ 170/210 (81%) có ảnh không khớp verdict.
     * Nhìn tận mắt `TC_059`: `step-03-passed.png` chụp ở GDTX, `step-04-failed.png` chụp ở THPT.
     *
     * Hệ quả nặng nhất là CLAUDE.md §4 ("mọi case đã execute phải có ảnh đúng màn") không còn đúng
     * trên thực tế, mà gate vẫn xanh vì nó chỉ kiểm CÓ FILE, không kiểm file thuộc đúng lượt nào.
     */
    this.dir = path.join(recorder.artifactsRoot, tcId, maCapAn());
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Chụp evidence 1 step, highlight element cụ thể, đánh dấu pass/fail.
   * opts: { highlight?: Locator|selector|ElementHandle, assert?: ()=>bool|Promise<bool>, status?: 'PASSED'|'FAILED', comment?, mask?: Locator[] }
   */
  async step(page, name, opts = {}) {
    const idx = this.steps.length + 1;
    let status = opts.status;
    let comment = opts.comment || name;
    if (!status && typeof opts.assert === 'function') {
      try { status = (await opts.assert()) ? 'PASSED' : 'FAILED'; }
      catch (e) { status = 'FAILED'; comment = `${name} — lỗi assert: ${e.message}`; }
    }
    if (!status) status = 'PASSED';
    const h = await highlight(page, opts.highlight);
    // #3/problem-4: settle 1 paint (double-rAF) sau highlight+scroll → giảm chụp trúng lúc rerender detach.
    if (h) { try { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))); } catch (e) { /* settle best-effort */ } }
    const file = path.join(this.dir, `step-${pad2(idx)}-${status.toLowerCase()}.png`);
    try {
      await page.screenshot({ path: file, fullPage: true, mask: opts.mask || [], maskColor: '#8a8a8a' });
    } catch (e) {
      try { await page.screenshot({ path: file, mask: opts.mask || [] }); } catch { /* give up */ }
    }
    await unhighlight(page, h);
    const rel = path.relative(this.rec.repoRoot, file).split(path.sep).join('/');
    /* Giữ CẢ tên bước lẫn comment.
     *
     * Trước đây record chỉ có `comment`, và `comment = opts.comment || name` ⇒ bước nào có comment thì
     * TÊN BƯỚC biến mất khỏi file kết quả, chỉ còn trên console. Người đọc report sau đó thấy một dãy
     * số đo không biết đang đo cái gì. Tên bước là thứ nói "đang kiểm điều gì", comment là "đo được gì"
     * — hai vai khác nhau, phải giữ cả hai. */
    this.steps.push({
      name: sanitize(name), status, comment: sanitize(comment), evidence: [rel],
      ...(opts.tienDe ? { tienDe: true } : {}),
      ...(opts.xacMinhLai ? { xacMinhLai: true } : {}),
    }); // #3: mask PII lỡ quên
    if (this.rec.log) console.log(`   [step ${idx}] ${status} — ${name} → ${path.basename(file)}`);
    return status;
  }

  /**
   * Ghi BẰNG CHỨNG TIỀN ĐỀ: trạng thái mà case GIẢ ĐỊNH là đã có, được kiểm THẬT trước khi đo.
   *
   * Dùng: `await ca.tienDe(page, 'Báo cáo đầu năm ở trạng thái Chưa gửi', { assert: () => …, highlight: … })`
   *
   * ────────────────────────────────────────────────────────────────────────────────────────────────
   * VÌ SAO Ở ĐÂY, KHÔNG PHẢI Ở GATE ĐỌC SPEC
   *
   * Chủ dự án nêu điều #2: *"chưa chứng minh Agent … dựng đúng state"*. Tôi đã thử đo bằng cách ĐỌC
   * SPEC, hai lần, và cả hai đều sai:
   *   · bản chặt (đòi `expect` ngay trong `beforeAll`) gắn cờ **267/303 case** của TASK-4008 — tố oan,
   *     vì khối dựng gọi helper trong `lib/` và CHÍNH helper mới là chỗ ném lỗi;
   *   · bản nới (đi theo đường nhập, chấp nhận `throw` ở bất kỳ lib nào) gắn cờ **0** — vô nghĩa, vì
   *     gần như lib nào cũng có một `throw` ở đâu đó.
   * Một phép đo cho ra 267 hoặc 0 tuỳ cách viết regex thì nó đang đo chính regex, không đo tiền đề.
   *
   * Thứ KHÔNG đọc được từ mã nguồn: trạng thái ấy có THẬT lúc chạy hay không. Chỉ lượt chạy mới biết,
   * nên chỉ lượt chạy mới ghi được. Hàm này là chỗ ghi.
   *
   * KHÔNG tự chấm case: nó là một step như mọi step, có ảnh, có status. Tiền đề hỏng ⇒ step FAILED ⇒
   * `finish()` thấy có step fail và case thành FAILED — rồi người đọc thấy ngay tầng lỗi là tiền đề,
   * không phải sản phẩm. Đó đúng là điều `BLOCKED_SETUP` sinh ra để nói.
   */
  async tienDe(page, moTa, opts = {}) {
    return this.step(page, `TIỀN ĐỀ · ${moTa}`, { ...opts, tienDe: true });
  }

  /**
   * Ghi BẰNG CHỨNG PHỤC HỒI: đo LẠI đúng điều mà step xấu trước đó chưa đo được, sau khi đã sửa.
   *
   * Dùng: `await ca.xacMinhLai(page, 'lưới đủ 38 dòng sau khi dựng lại tiền đề', { assert: () => … })`
   * rồi `finish('PASSED', { phucHoi: 'dựng lại tiền đề qua UI rồi đếm lại lưới' })`.
   *
   * ────────────────────────────────────────────────────────────────────────────────────────────────
   * VÌ SAO CẦN HÀM NÀY — trước 11/11/2026 đường thoát chỉ là LỜI
   *
   * `finish()` cho PASS đứng trên step xấu khi có `phucHoi` ≥ 25 ký tự; cửa đọc thì nhận khi comment có
   * chữ "phục hồi". Cả hai chỉ đếm chữ. Đo trên corpus 1161 bản ghi: **0** case đi qua đường đó — nên
   * siết bây giờ không làm đỏ việc nào, còn đợi tới khi có người dùng mới siết là làm đỏ việc của họ.
   * Và chữ khớp nhầm có thật: TASK-9004 ghi *"hệ phục hồi sau khi rút tải"* — nói về HỆ THỐNG, không
   * nói về lượt test — vẫn khớp regex của cửa đọc.
   *
   * BẮT BUỘC có `assert`, và `status` tự khai bị BỎ QUA. Không có assert thì `step()` mặc định
   * PASSED, và "bằng chứng phục hồi" chỉ còn là lời khai mặc áo step — đúng cái lỗ hàm này sinh ra
   * để bịt. Ảnh do `step()` chụp sẵn — cửa đọc đòi ảnh ở CHÍNH step xác minh lại này.
   */
  async xacMinhLai(page, moTa, opts = {}) {
    if (typeof opts.assert !== 'function') {
      throw new Error(`${this.tcId}: xacMinhLai("${moTa}") phải có \`assert\` — không có phép đo thì step mặc định PASSED, `
        + 'và bằng chứng phục hồi chỉ còn là lời khai.');
    }
    const { status: _boQua, ...conLai } = opts; // eslint-disable-line no-unused-vars
    return this.step(page, `XÁC MINH LẠI · ${moTa}`, { ...conLai, xacMinhLai: true });
  }

  /**
   * NGUỒN GỐC của verdict: nó ra từ LƯỢT CHẠY NÀO, SPEC nào, và ảnh nằm ở đâu.
   *
   * ──────────────────────────────────────────────────────────────────────────────────────────────
   * VÌ SAO Ở CẤP CASE, KHÔNG Ở CẤP FILE
   *
   * Đây là nối tiếp đúng lập luận đã có sẵn ở `_put()`: `testcase-status.json` gộp cả shard của lượt
   * trước, nên MỘT file chứa kết quả của NHIỀU lượt. `runId` ở mức file vì thế không nói được case
   * nào thuộc lượt nào — cùng lý do `recordedAt` và `scope` đã phải đóng dấu từng case.
   *
   * Lớp lỗi đã trả giá (08/10/2026, ghi ở `_put`): 45 verdict của lượt GDTX ghi đè cột `Result THCS`,
   * và KHÔNG MÁY NÀO BÁO vì bản ghi không mang dấu vết lượt chạy để đối chiếu.
   *
   * ──────────────────────────────────────────────────────────────────────────────────────────────
   * LẤY DANH TÍNH TỪ ĐÂU, và ranh giới của từng nguồn
   *
   *   · `test.info()` — nguồn ĐÁNG TIN NHẤT: spec, tên test, project, lần retry, worker. Nó do chính
   *     Playwright cấp nên không đoán. Gọi ngoài runner thì NÉM, nên phải bọc try/catch; recorder còn
   *     được dùng ở script ngoài Playwright.
   *   · `RUN_ID` — chỉ có khi người chạy khai. KHÔNG tự sinh một id thay thế: mỗi worker là một tiến
   *     trình riêng nên id tự sinh sẽ KHÁC NHAU giữa các worker của CÙNG một lượt, và một dấu vết sai
   *     tệ hơn không có dấu vết.
   *   · `evidenceDir` — thứ kiểm lại được bằng tay: ảnh của case này, của chính lượt này, nằm ở đó.
   *     Đây là câu trả lời cho "kể cả khi sổ không lưu step trực tiếp".
   */
  /**
   * Bản ghi của LƯỢT TRƯỚC cho chính case này: shard trước, bản gộp sau.
   *
   * Tách ra khỏi nhánh `laFail` vì nó vốn nằm trong đó — tức chỉ đọc được khi case ĐỎ. Phân loại
   * "verdict đổi vì sao" cần đọc ở MỌI trạng thái, kể cả FAIL → PASS, là chiều đáng quan tâm nhất.
   *
   * SHARD MẤT THÌ ĐỌC TIẾP BẢN GỘP. Shard theo TC nằm trong thư mục của MỘT lượt chạy, nên nó đi theo
   * lượt đó khi người ta archive (`archive-cap-THCS/`) hoặc dọn thư mục. Bản gộp `testcase-status.json`
   * sống lâu hơn.
   *
   * Đo trên TASK-9001: bản archive 02/10 ghi `APP_HSTRUONG_TC_123` có `reruns: 2`; mọi bản từ 06/10
   * ghi 0, vì shard theo TC đã biến mất cùng lượt được archive. Verdict sống sót qua carry-over nhưng
   * BẰNG CHỨNG đã rerun thì reset — 7 verdict vốn đúng luật bị `output_gate` chặn vì "chỉ rerun 0 lần",
   * và người gặp sẽ hoặc chạy lại vô ích, hoặc sửa tay `reruns`, tức bịa đúng con số gate sinh ra để chặn.
   *
   * Vẫn KHÔNG phải "khai tay": bản gộp cũng do máy ghi.
   */
  _banGhiTruoc() {
    try {
      const shard = path.join(this.rec.shardDir, `${safeName(this.tcId)}.json`);
      const prev = JSON.parse(fs.readFileSync(shard, 'utf8'));
      if (prev && prev.test) return prev.test;
    } catch { /* chưa có shard */ }
    try {
      const goc = JSON.parse(fs.readFileSync(this.rec.statusFile, 'utf8'));
      const ds = Array.isArray(goc) ? goc : (goc.tests || []);
      return ds.find((x) => x && x.tcId === this.tcId) || null;
    } catch { /* chưa có bản gộp = lượt chạy đầu */ }
    return null;
  }

  _nguonGoc() {
    /*
     * Đường dẫn phải NGẮN và dùng `/`, kể cả trên Windows — nó đi vào JSON mà người khác đọc.
     * Và `repoRoot` không phải lúc nào cũng là gốc repo (test dựng cây tạm), nên khi `relative()`
     * trả ra đường đi lên (`..`) hoặc đường tuyệt đối thì rơi về `process.cwd()`. Một đường dẫn
     * tuyệt đối của MÁY TÔI trong sổ kết quả là vô dụng với người đọc sau.
     */
    const goiGon = (p) => {
      for (const goc of [this.rec.repoRoot, process.cwd()]) {
        const r = path.relative(goc, p).split(path.sep).join('/');
        if (r && !r.startsWith('../') && !path.isAbsolute(r)) return r;
      }
      return String(p).split(path.sep).join('/');
    };
    const ra = { evidenceDir: goiGon(this.dir) };
    if (this.rec.runId) ra.id = this.rec.runId;
    try {
      /* eslint-disable-next-line global-require */
      const ti = require('@playwright/test').test.info();
      if (ti) {
        if (ti.file) {
          ra.spec = goiGon(ti.file);
          /*
           * VÂN TAY SPEC — 12 ký tự đầu của sha256 nội dung file lúc chạy.
           *
           * Đây là thứ DUY NHẤT cho phép trả lời "automation có đổi giữa hai lượt không" mà không
           * phải đoán. So `mtime` thì không dùng được: checkout lại, `git stash pop`, hay chỉ mở file
           * ra lưu cũng đổi `mtime` trong khi nội dung y nguyên.
           *
           * Chỉ 12 ký tự: đủ để phân biệt hai bản khác nhau, và không biến bản ghi thành bãi hash.
           */
          try { ra.specSha = crypto.createHash('sha256').update(fs.readFileSync(ti.file)).digest('hex').slice(0, 12); }
          catch (e2) { /* đọc không được thì bỏ — thiếu vân tay vẫn hơn vân tay bịa */ }
        }
        /* Bỏ phần tử đầu của `titlePath`: nó là ĐƯỜNG DẪN FILE, đã có ở `spec`, và mang dấu `\`
         * của Windows vào giữa câu tiêu đề. */
        if (Array.isArray(ti.titlePath) && ti.titlePath.length) {
          const t = ti.titlePath.filter(Boolean).filter((x) => !/\.spec\.[tj]s$/.test(String(x)));
          if (t.length) ra.title = sanitize(t.join(' › '));
        }
        if (ti.project && ti.project.name) ra.project = ti.project.name;
        if (typeof ti.retry === 'number') ra.retry = ti.retry;
        if (typeof ti.workerIndex === 'number') ra.worker = ti.workerIndex;
      }
    } catch (e) { /* không chạy trong Playwright — evidenceDir vẫn đủ để lần lại */ }
    return ra;
  }

  /** Kết thúc case: status tổng (mặc định = FAILED nếu có step FAILED). Evidence cấp case = ảnh step lỗi (nếu có) hoặc step cuối. */
  /**
   * Step nào là XẤU: đã chạy và sai, HOẶC chưa chạy được vì bị chặn.
   *
   * `laFail()` KHÔNG đủ ở đây. Nó chuẩn hoá qua taxonomy, mà `BLOCKED` → `BLOCKED_SETUP` — một
   * trạng thái "chưa thực thi", không phải `FAIL`. Đó chính là lỗ: case có step BLOCKED mà người gọi
   * không tự khai verdict thì rơi vào nhánh `steps.length ? 'PASSED' : 'TODO'` và vào sổ là PASSED.
   */
  static _stepXau(s) {
    const v = chuanHoaVerdict(s && s.status);
    return v === 'FAIL' || v === 'BLOCKED_SETUP' || v === 'SKIP_SETUP' || v === 'SKIP';
  }

  async finish(overallStatus, opts = {}) {
    // opts.evidence: file cấp CASE thêm vào (vd video mô tả cả chuỗi thao tác — ảnh tĩnh không tả nổi).
    const anyFail = this.steps.some((s) => laFail(s.status));
    let status = overallStatus || (anyFail ? 'FAILED' : (this.steps.length ? 'PASSED' : 'TODO'));

    /*
     * ──────────────────────────────────────────────────────────────────────────────────────────────
     * GỘP VERDICT: KHÔNG ghi PASS khi còn step XẤU, trừ khi khai được đã PHỤC HỒI và xác minh lại.
     *
     * LỖ HỔNG ĐÃ MỞ TỚI 11/11/2026, ở ngay dòng trên. `laFail()` chỉ nhận `FAIL`, mà `BLOCKED` chuẩn
     * hoá thành `BLOCKED_SETUP` — "chưa thực thi", không phải fail. Nên case có step BLOCKED mà người
     * gọi không tự khai verdict rơi vào nhánh `steps.length ? 'PASSED'` và vào sổ là **PASSED**.
     * TASK-4008 ra 0/284 ca dính, nhưng chỉ vì spec ở đó luôn khai verdict tay — dữ liệu sạch KHÔNG
     * chứng minh lỗ đã bịt.
     *
     * HAI ĐƯỜNG ĐỀU BỊT, vì chúng hỏng khác nhau:
     *   · không khai verdict ⇒ trước đây thành PASSED. Nay LAN trạng thái xấu nhất của step lên.
     *   · khai thẳng `finish('PASSED')` trong khi còn step xấu ⇒ trước đây im lặng chấp nhận. Nay bị
     *     HẠ xuống trạng thái xấu nhất, kèm ghi chú nói rõ đã hạ và vì sao.
     *
     * VÌ SAO HẠ CHỨ KHÔNG NÉM: ném sẽ cắt ngang lượt chạy và làm mất verdict của mọi case sau — đúng
     * lớp "lượt chết cụt" kit đã trả giá. Sổ phải ghi được điều đã xảy ra, kể cả khi nó xấu.
     *
     * ĐƯỜNG THOÁT DUY NHẤT cần HAI thứ (siết 11/11/2026):
     *   · `opts.phucHoi` — LỜI: đã phục hồi bằng cách nào. Sàn 25 ký tự, cùng khuôn `minLyDoMienChars`.
     *   · một step `xacMinhLai()` PASSED nằm SAU step xấu cuối — BẰNG CHỨNG: có assert, có ảnh.
     * Trước đây chỉ cần lời: một câu đủ dài là qua, dù không bước nào đo lại điều đã hỏng.
     * Phải nằm SAU step xấu CUỐI: xác minh lại xong rồi lại hỏng tiếp thì chưa phục hồi gì cả.
     */
    const xau = this.steps.filter((s) => Case._stepXau(s));
    if (xau.length && chuanHoaVerdict(status) === 'PASS') {
      const phucHoi = String(opts.phucHoi || '').trim();
      let viTriXauCuoi = -1;
      this.steps.forEach((s, i) => { if (Case._stepXau(s)) viTriXauCuoi = i; });
      const bangChung = this.steps.slice(viTriXauCuoi + 1)
        .find((s) => s.xacMinhLai && chuanHoaVerdict(s.status) === 'PASS');
      const thieuBangChung = phucHoi.length >= 25 && !bangChung
        ? 'Có khai `phucHoi` nhưng KHÔNG có step `xacMinhLai()` PASSED nằm SAU step xấu cuối — lời khai không có phép đo đứng sau. '
        : '';
      if (phucHoi.length >= 25 && bangChung) {
        opts.comment = `${opts.comment || ''}\nPHỤC HỒI: ${phucHoi} (step xấu: ${xau.map((s) => `${s.name}=${s.status}`).join(' · ')}`
          + ` · xác minh lại: ${bangChung.name})`.trim();
      } else if (xau.some((s) => laFail(s.status)) && !opts.failureLayer) {
        /*
         * STEP FAILED + khai PASS + không khai tầng lỗi ⇒ NÉM, và đây là ngoại lệ có lý do.
         *
         * Hai luật gặp nhau ở đây: luật mới nói "không PASS khi còn step xấu", luật cũ nói "FAIL phải
         * khai failureLayer". Hạ xuống FAILED thì luật cũ ném ngay dòng dưới, với một thông điệp nói
         * về FAILED trong khi tác giả tưởng mình đang khai PASSED — đọc xong không biết sửa gì.
         *
         * Và KHÔNG được tự gán tầng lỗi thay tác giả: taxonomy CỐ Ý không có tầng "chưa phân tầng",
         * nên mọi giá trị tôi điền vào đều là một lời khẳng định về NGUYÊN NHÂN mà không ai đo.
         *
         * Vì sao ném ở đây mà không ném ở nhánh BLOCKED: step FAILED + khai PASS là một MÂU THUẪN
         * trong chính spec, không phải một tình huống chạy. Nó phải lộ ra ngay chỗ viết sai. Còn
         * BLOCKED là chuyện có thật lúc chạy, nên nó được ghi vào sổ chứ không làm chết lượt.
         */
        throw new Error(`${this.tcId}: khai PASS trong khi step "${xau.find((s) => laFail(s.status)).name}" FAILED. ${thieuBangChung}`
          + 'Chọn một trong hai: khai `failureLayer` để case thành FAILED đúng tầng, hoặc khai `phucHoi` '
          + '(≥25 ký tự) VÀ ghi một step `xacMinhLai()` PASSED sau step xấu cuối.');
      } else {
        const te = xau.map((s) => chuanHoaVerdict(s.status));
        const haXuong = te.includes('FAIL') ? 'FAILED' : (te.includes('BLOCKED_SETUP') ? 'BLOCKED_SETUP' : te[0]);
        const vi = `GỘP VERDICT: HẠ từ "${status}" xuống "${haXuong}" — còn ${xau.length} step xấu `
          + `(${xau.map((s) => `${s.name}=${s.status}`).join(' · ')}) mà chưa chứng minh đã phục hồi. ${thieuBangChung}`
          + 'PASS chỉ được ghi khi khai `phucHoi` (tối thiểu 25 ký tự) VÀ có step `xacMinhLai()` PASSED sau step xấu cuối.';
        if (this.rec && this.rec.log) console.log(`   [verdict] ${this.tcId}: ${vi}`);
        opts.comment = `${opts.comment || ''}\n${vi}`.trim();
        status = haXuong;
      }
    }
    /*
     * ──────────────────────────────────────────────────────────────────────────────────────────────
     * ĐỔI VERDICT: ghi thứ ĐO ĐƯỢC, KHÔNG tự gán nguyên nhân.
     *
     * Chủ dự án nêu (ưu tiên #4): phân biệt verdict đổi vì FIX BUG, vì MÔI TRƯỜNG, vì SỬA AUTOMATION,
     * hay vì FLAKY. Máy không đọc được ý định, nên nó chỉ được ghi BẰNG CHỨNG để phân loại:
     *
     *   · `tu`/`sang`   — verdict cũ và mới. Không có cái này thì không biết đã đổi.
     *   · `cungLuot`    — cùng một lượt chạy mà verdict đổi. Playwright retry trong một lượt: đây là
     *                     tín hiệu FLAKY mạnh nhất đo được, vì mã và môi trường chưa kịp đổi.
     *   · `specDoi`     — vân tay spec khác lượt trước ⇒ AUTOMATION có đổi. `null` khi lượt trước
     *                     không có vân tay (bản ghi cũ) — "không biết" khác "không đổi".
     *   · `lyDo`        — lời khai của người chạy. Máy KHÔNG điền hộ.
     *
     * VÌ SAO KHÔNG TỰ GÁN NHÃN: "fix bug" và "đổi môi trường" đều cho cùng một dấu vết đo được là
     * verdict đổi mà spec không đổi. Chọn một trong hai thay người chạy là bịa nguyên nhân — đúng thứ
     * đã bị chặn ở `failureLayer`, và đúng thứ `SUSPECT_REAL_BUG` sinh ra để chống: dán nhãn flaky cho
     * một lượt chưa giải thích được cơ chế là chôn bug thật.
     */
    const truocChung = this._banGhiTruoc();
    const nguonGoc = this._nguonGoc();
    let doiVerdict = null;
    if (truocChung && truocChung.status && chuanHoaVerdict(truocChung.status) !== chuanHoaVerdict(status)) {
      const tr = truocChung.run || {};
      const specDoi = (tr.specSha && nguonGoc.specSha) ? (tr.specSha !== nguonGoc.specSha) : null;
      doiVerdict = {
        tu: truocChung.status,
        sang: status,
        cungLuot: Boolean(tr.id && nguonGoc.id && tr.id === nguonGoc.id),
        specDoi,
        ...(opts.lyDoDoiVerdict ? { lyDo: sanitize(String(opts.lyDoDoiVerdict)) } : {}),
      };
    }

    const failEv = this.steps.find((s) => laFail(s.status));
    const caseEv = [...((failEv || this.steps[this.steps.length - 1] || {}).evidence || []), ...[].concat(opts.evidence || [])];

    /* `failureLayer` — verdict_taxonomy bắt buộc mọi FAIL phải khai tầng lỗi, và `bug_claim.js` đọc
     * `t.failureLayer` để chặn việc gọi "bug" khi chưa viết claim. Nhưng recorder trước đây KHÔNG có
     * đường nào truyền nó vào, nên mọi FAIL ghi ra đều thiếu trường bắt buộc và bug_claim không bao giờ
     * thấy case nào để chặn — luật có mà không ai áp được. Nay nhận qua opts, và kiểm theo đúng danh mục
     * trong taxonomy để không đẻ ra giá trị tự phát. */
    // Chỉ gắn khi case THẬT SỰ fail: khai tầng lỗi trên một case PASS là thông tin sai trong file kết
    // quả, và `bug_claim.js` đọc trường này để đòi claim ⇒ sẽ đòi claim cho case không có lỗi nào.
    let failureLayer = (opts.failureLayer && laFail(status)) ? String(opts.failureLayer) : '';
    if (failureLayer) {
      const allowed = Object.keys(VERDICT_TAXONOMY.failureLayers || {});
      if (allowed.length && !allowed.includes(failureLayer)) {
        throw new Error(`failureLayer "${failureLayer}" không có trong verdict_taxonomy.failureLayers `
          + `(${allowed.join(' | ')}) — đừng tự đặt tầng lỗi mới`);
      }
    } else if (laFail(status)) {
      throw new Error(`${this.tcId} chấm FAILED nhưng thiếu failureLayer. `
        + `verdict_taxonomy bắt buộc khai tầng lỗi: finish('FAILED', { failureLayer: 'product_bug' | 'script_error' | … }). `
        + `FAIL không nói được là lỗi tầng nào thì chưa phán được, và "chưa phán được" KHÔNG thành bug.`);
    }

    /* `reruns` phải ĐẾM ĐƯỢC, không khai tay.
     *
     * `output_gate` đòi case FAIL ở tầng product/api_bug khai số lần rerun, để chứng minh đã loại flaky
     * trước khi gọi là bug. Nhưng nếu con số do người gõ vào thì nó chỉ là lời khai — đúng thứ gate sinh
     * ra để chặn. Nên recorder tự đếm: mỗi lần case này lại FAIL trong một lượt chạy mới, đọc shard của
     * lượt trước và cộng 1. Muốn `reruns: 2` thì phải chạy thật 3 lượt, không có đường tắt.
     *
     * Case chuyển từ FAILED sang PASSED thì bộ đếm về 0 — lần fail sau là một quan sát mới, không được
     * cộng dồn vào chuỗi cũ. */
    let reruns = 0;
    if (laFail(status)) {
      let truoc = truocChung;

      /*
       * SHARD MẤT THÌ ĐỌC TIẾP BẢN GỘP. Shard theo TC nằm trong thư mục của MỘT lượt chạy, nên nó đi theo
       * lượt đó khi người ta archive (`archive-cap-THCS/`) hoặc dọn thư mục. Bản gộp `testcase-status.json`
       * thì sống lâu hơn.
       *
       * Đo trên TASK-9001: bản archive ngày 02/10 ghi `APP_HSTRUONG_TC_123` có `reruns: 2`; mọi bản từ
       * 06/10 ghi 0, vì shard theo TC đã biến mất cùng lượt chạy được archive. Verdict sống sót qua
       * carry-over nhưng BẰNG CHỨNG đã rerun thì reset. Hệ quả: 7 verdict vốn đúng luật bị `output_gate`
       * chặn với lý do "chỉ rerun 0 lần", và người gặp sẽ hoặc chạy lại một cách vô ích, hoặc sửa tay
       * `reruns` — tức bịa đúng con số mà gate sinh ra để chặn.
       *
       * Vẫn KHÔNG phải "khai tay": bản gộp cũng do máy ghi, không phải người gõ.
       */
      if (truoc && laFail(truoc.status)) reruns = Number(truoc.reruns || 0) + 1;
    }

    this.rec._put({
      tcId: this.tcId,
      status,
      ...(failureLayer ? { failureLayer } : {}),
      ...(laFail(status) ? { reruns } : {}),
      /*
       * COMMENT MẶC ĐỊNH KHÔNG ĐƯỢC LÀ MỘT CHỮ RỖNG RUỘT (11/11/2026).
       *
       * Chủ dự án nêu (ưu tiên #5): thay `Executed` bằng tóm tắt expected, actual và nguồn đo.
       *
       * `'Executed'` nói đúng một điều người đọc đã biết — case này đã chạy — và chiếm đúng chỗ của
       * thứ đáng đọc. Đo trên TASK-4008: 0/241 case dùng giá trị này, nên đây là lỗ TIỀM ẨN ở default
       * chứ chưa phải lỗi đang sống. Vì thế việc đúng là BỊT DEFAULT, không phải thêm một cửa ồn ào.
       *
       * Không ném: thiếu comment là chuyện biên tập, không phải mâu thuẫn trong spec. Nhưng chữ ghi ra
       * phải TỰ TỐ CÁO mình, để `output_gate` đếm được và người đọc thấy ngay là còn thiếu.
       */
      comment: sanitize(opts.comment || (anyFail
        ? 'Có step FAILED — xem step evidence'
        : '(CHƯA KHAI) — comment phải nêu expected, actual và nguồn đo')),
      evidence: caseEv,
      steps: this.steps,
      run: nguonGoc,
      ...(doiVerdict ? { doiVerdict } : {}),
    });
    return status;
  }
}

class EvidenceRecorder {
  constructor({ taskKey, projectOutputDir, runId = '', repoRoot = process.cwd(), log = true } = {}) {
    if (!taskKey || !projectOutputDir) throw new Error('EvidenceRecorder cần taskKey + projectOutputDir');
    this.taskKey = taskKey;
    this.runId = runId;
    this.repoRoot = repoRoot;
    this.log = log;
    this.taskDir = path.join(repoRoot, projectOutputDir, 'tasks', taskKey);
    this.testResults = path.join(this.taskDir, 'test-results');
    /* `evidence/`, KHÔNG phải `artifacts/`.
     *
     * `playwright.config.js` đặt `outputDir: <test-results>/artifacts`, và Playwright XOÁ SẠCH outputDir
     * ở đầu MỖI lượt chạy. Recorder trước đây ghi evidence vào đúng thư mục đó ⇒ mỗi lượt chạy sau xoá
     * hết evidence của các lượt trước. Đã dựng lại được 30/09: chấm 4 case xong, chạy tiếp
     * `--project infra-verify` là toàn bộ ảnh của 4 case bốc hơi, trong khi `testcase-status.json` và
     * `evidence-manifest.json` vẫn ghi `exists: true` (manifest chỉ là ảnh chụp lúc sinh, không soi lại).
     *
     * Hậu quả đúng bằng thứ CLAUDE.md §4 muốn chặn: case có verdict mà KHÔNG có bằng chứng, lại trông
     * như có. Nên evidence phải nằm NGOÀI outputDir. */
    this.artifactsRoot = path.join(this.testResults, 'evidence');
    fs.mkdirSync(this.artifactsRoot, { recursive: true });
    this.statusFile = path.join(this.testResults, 'testcase-status.json');
    // G0: thư mục shard per-TC (atomic, chống race) — nguồn để aggregate ra statusFile.
    this.shardDir = path.join(this.testResults, STATUS_DIRNAME);
    fs.mkdirSync(this.shardDir, { recursive: true });
    this._tests = new Map();
    /** TC đã `case()` nhưng chưa `finish()` — `write()` sẽ tự đóng để không để lại verdict cũ. */
    this._dangTreo = new Set();
    this.startedAt = Date.now();
  }
  case(tcId) { return new Case(this, tcId); }
  _put(entry) {
    if (this._dangTreo) this._dangTreo.delete(entry.tcId);
    // `recordedAt` = lúc case NÀY thật sự chạy xong. Provenance phải bám vào từng case: nếu chỉ dựa
    // `generatedAt` của file thì mỗi lần write() lại đóng dấu mới cho cả case cũ → rửa sạch dấu vết.
    entry.recordedAt = ts();
    /*
     * ĐÓNG DẤU PHẠM VI vào TỪNG case, không chỉ vào file.
     *
     * Vì sao từng case: `testcase-status.json` gộp cả shard của lượt trước, nên một file có thể chứa
     * kết quả của NHIỀU lượt — dấu ở mức file thì không nói được case nào thuộc lượt nào.
     *
     * Vì sao cần: 08/10/2026 phát hiện cột `Result THCS` của TASK-9001 bị ghi đè bằng 45 verdict của
     * lượt chạy GDTX. Đường đi: `merge-theo-cap.js --cap THCS` chạy trong lúc `testcase-status.json`
     * đang chứa kết quả lượt GDTX. Không ai sai một cách cố ý, và KHÔNG MÁY NÀO BÁO — vì file kết quả
     * không ghi nó thuộc cấp nào, nên bên merge không có gì để đối chiếu. Dấu này là thứ để đối chiếu.
     */
    const scope = scopeHienTai();
    if (scope) entry.scope = scope;
    this._tests.set(entry.tcId, entry);
    // G0: PERSIST NGAY per-TC shard (atomic) khi case finish → process chết vẫn giữ case đã xong;
    // mỗi TC 1 file riêng → 2 worker khác TC KHÔNG đè nhau (khác file cũ read→merge→write chung).
    try {
      const shard = path.join(this.shardDir, `${safeName(entry.tcId)}.json`);
      writeJsonAtomic(shard, { taskKey: this.taskKey, ...(this.runId ? { runId: this.runId } : {}), at: ts(), test: entry });
    } catch (e) { if (this.log) console.warn(`[evidence] ghi shard ${entry.tcId} lỗi: ${e.message} (giữ in-memory, write() sẽ gộp)`); }
  }

  /**
   * Aggregate → testcase-status.json (atomic). Gộp: status cũ + mọi shard per-TC trên đĩa (mọi
   * worker/run) + case in-memory lần này. Giữ API cũ (consumer vẫn đọc testcase-status.json).
   * Idempotent — dưới parallel, gọi write()/aggregateStatus() lần cuối cho bản đầy đủ.
   */
  write() {
    /*
     * TỰ ĐÓNG CASE TREO trước khi gộp.
     *
     * Case đã `case()` mà chưa `finish()` nghĩa là test ném giữa chừng (thường là `expect` chốt
     * tiền điều kiện). Không đóng thì shard giữ verdict của LƯỢT TRƯỚC, và kết quả cũ đó trông y
     * hệt kết quả mới — nguy hiểm hơn hẳn việc thiếu kết quả.
     *
     * Đóng thành `BLOCKED_SETUP`: test có chạy nhưng KHÔNG kết luận được. Không dùng `FAILED` vì
     * chưa biết sai ở sản phẩm hay ở dụng cụ, mà `FAILED` thì kéo theo đòi `failureLayer` và rerun.
     */
    if (this._dangTreo && this._dangTreo.size) {
      const treo = [...this._dangTreo];
      for (const tcId of treo) {
        this._put({
          tcId,
          status: 'BLOCKED_SETUP',
          comment: '- Test ném giữa chừng nên case KHÔNG tự ghi verdict (thường do assert chốt tiền '
            + 'điều kiện chạy trước finish).'
            + String.fromCharCode(10)
            + '- Recorder tự đóng để KHÔNG để lại verdict của lượt chạy trước — kết quả cũ trông '
            + 'giống hệt kết quả mới.'
            + String.fromCharCode(10)
            + '- Xem log lượt chạy để biết nó dừng ở bước nào.',
          evidence: [],
          steps: [],
        });
      }
      if (this.log) {
        console.warn(`
⚠ ${treo.length} case ném giữa chừng, recorder tự đóng thành BLOCKED_SETUP: ${treo.join(', ')}`);
        console.warn('  Sửa gốc: gọi finish() TRƯỚC các assert trong spec, để verdict phản ánh đúng lượt này.');
      }
    }
    const byId = new Map();
    /*
     * KẾ THỪA KẾT QUẢ CŨ — phải ĐÁNH DẤU, không được im lặng.
     * Gộp mọi shard là CỐ Ý (nhiều worker, và giữ được case đã xong khi process chết). Nhưng nó cũng
     * kéo theo kết quả của những LƯỢT CHẠY TRƯỚC: chạy lại 3 case mà status ra 51 case PASSED, đóng
     * dấu `generatedAt` hôm nay — đẩy lên TCM là báo PASS cho 48 case lượt này chưa hề chạy.
     * (Đã xảy ra thật: TASK-26523 chạy 3 case, status gộp thành 51, 48 case từ 13/07.)
     * Nên: entry cũ hơn lượt này được gắn `carriedOver` + `carriedFrom`, và cảnh báo ra stdout.
     * Ngưỡng GRACE 6h chứ không so đúng mốc start: Playwright khởi động các worker LỆCH NHAU vài giây,
     * so chính xác sẽ gắn nhầm cờ cho case của worker chạy trước.
     */
    const GRACE_MS = 6 * 60 * 60 * 1000;
    const cutoff = this.startedAt - GRACE_MS;
    const mark = (t, fileAt) => {
      // Sticky: đã từng bị đánh dấu thì giữ nguyên — không có đường "tẩy trắng" bằng cách write() lại.
      if (t.carriedOver) return t;
      const at = Date.parse(t.recordedAt || '') || fileAt;
      return at && at < cutoff ? { ...t, carriedOver: true, carriedFrom: new Date(at).toISOString() } : t;
    };

    // 1) status cũ (giữ TC không thuộc lần này — tương thích ngược)
    try {
      const ex = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
      const at = Date.parse(ex.generatedAt || '') || 0;
      for (const t of ex.tests || []) if (t && t.tcId) byId.set(t.tcId, mark(t, at));
    } catch { /* new */ }
    // 2) shard trên đĩa (mọi worker) — nguồn atomic, không đua chéo TC
    try {
      for (const f of fs.readdirSync(this.shardDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const s = JSON.parse(fs.readFileSync(path.join(this.shardDir, f), 'utf8'));
          if (s && s.test && s.test.tcId) byId.set(s.test.tcId, mark(s.test, Date.parse(s.at || '') || 0));
        } catch { /* skip shard hỏng */ }
      }
    } catch { /* chưa có shard dir */ }
    // 3) case in-memory lần này — LUÔN thắng, và không bao giờ mang cờ carriedOver.
    for (const [id, e] of this._tests) byId.set(id, e);
    /* Dấu phạm vi ở mức FILE nói "lượt chạy vừa rồi làm trên đơn vị nào". Nó KHÔNG thay dấu ở mức
     * case: file gộp cả shard của lượt trước nên có thể trộn nhiều cấp, và khi đó chỉ dấu từng case
     * mới phân biệt được. Hai dấu phục vụ hai câu hỏi khác nhau, giữ cả hai. */
    const scope = scopeHienTai();
    const out = {
      taskKey: this.taskKey,
      generatedAt: ts(),
      ...(this.runId ? { runId: this.runId } : {}),
      ...(scope ? { scope } : {}),
      tests: [...byId.values()],
    };
    writeJsonAtomic(this.statusFile, out);
    const carried = out.tests.filter((t) => t.carriedOver);
    if (carried.length && this.log) {
      console.warn(`\n⚠ ${carried.length}/${out.tests.length} case KẾ THỪA từ lượt chạy trước (lượt này chỉ chạy ${this._tests.size}).`);
      console.warn(`  Chúng mang cờ "carriedOver" — ĐỪNG đẩy lên TCM như kết quả hôm nay. Dọn: xoá ${path.relative(this.repoRoot, this.shardDir).split(path.sep).join('/')}`);
    }
    // #3: sinh evidence-manifest.json (index + kiểm tồn tại) cạnh status.
    try { buildManifest(this.testResults, { repoRoot: this.repoRoot }); } catch (e) { if (this.log) console.warn(`[evidence] manifest skip: ${e.message}`); }
    if (this.log) console.log(`\nĐã ghi ${byId.size} case (aggregate shard+in-memory, atomic) → ${path.relative(this.repoRoot, this.statusFile).split(path.sep).join('/')}`);
    return this.statusFile;
  }
}

module.exports = { EvidenceRecorder, highlight, unhighlight, aggregateStatus, writeJsonAtomic, sanitize, buildManifest, readManifest };

// CLI: gộp shard → testcase-status.json (chạy 1 lần cuối ở global-teardown / job merge CI).
//   node scripts/utils/evidence_recorder.js --aggregate --test-results <dir> [--task <KEY>] [--run <RUN_ID>]
if (require.main === module && process.argv.includes('--aggregate')) {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
  const dir = arg('test-results', '');
  if (!dir) { console.error('[evidence] --aggregate cần --test-results <dir chứa testcase-status.json + testcase-status/>'); process.exit(2); }
  const r = aggregateStatus({ testResultsDir: path.resolve(dir), taskKey: arg('task', ''), runId: arg('run', ''), log: true });
  console.log(`[evidence] aggregate xong: ${r.count} case (${r.shards} shard).`);
}
