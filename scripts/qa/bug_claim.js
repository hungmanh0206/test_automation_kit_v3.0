#!/usr/bin/env node
'use strict';

/*
 * bug_claim — một phát hiện bug phải QUA MÁY trước khi được nói thành lời.
 *
 * VÌ SAO CÓ FILE NÀY. Chủ repo chỉ ra lỗi lặp lại ngày 16/09/2026: ở Phase 2 tôi báo "phát hiện bug,
 * có log không", bạn hỏi lại "chắc chưa", tôi kiểm lại rồi rút lời. Tức phát hiện kỹ thuật sai ngay
 * từ đầu, và câu hỏi của người dùng đang làm việc mà gate lẽ ra phải làm.
 *
 * Chẩn đoán là lỗi THỨ TỰ, không phải bất cẩn. Đo trên chính repo này:
 *   · `.agent/workflows/11_execute_and_auto_heal.md` dòng 25, chỗ tôi phát hiện và nói ra, đòi
 *     đúng HAI điều kiện: rerun đủ vòng, thu evidence.
 *   · `.agent/workflows/12_report_and_backlog_gate.md` dòng 30, chỗ log Backlog, mới là bar thật với
 *     khoảng TÁM điều kiện: oracle độc lập, expected đã xác nhận, phân tầng có chứng minh, bản đồ hệ
 *     thống cho bug thiết kế, cấm lấy app làm expected.
 * Tôi nói ở bước 03 nhưng bar nằm ở bước 04. Nên mọi câu "chắc chưa" đều ép tôi làm sớm phần còn lại,
 * và một trong số đó trượt.
 *
 * LỖI NÀY CHƯA TỪNG ĐƯỢC ĐẾM. Claim bị rút trước khi log thì không lên Backlog, nên không vào
 * `knowledge/bugs`. Store đó có 62 bản ghi với 1 Rejected, trong khi memory ghi ít nhất 2 bug Rejected
 * (TASK-28776, TASK-28126). Thứ không đo được thì không sửa được, nên `--report` ở đây đếm cả claim
 * bị rút và phép kiểm nào đã bắt được nó.
 *
 * Dùng:
 *   node scripts/qa/bug_claim.js --new <TC_ID>     tạo bản nháp đủ trường để điền
 *   node scripts/qa/bug_claim.js --check           CHẶN nếu claim thiếu trường, hoặc có FAIL
 *                                                  product_bug mà không có claim nào
 *   node scripts/qa/bug_claim.js --report          đếm claim theo trạng thái, kể cả đã rút
 * Exit: 0 đạt · 1 có claim không hợp lệ hoặc thiếu claim · 2 dùng sai.
 */
const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

const CFG_PATH = path.join(rc.REPO_ROOT, '.agent', 'config', 'bug_claim.json');
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));
/*
 * Evidence dùng lại `isVisualEvidence` của `output_rules.js` — KHÔNG khai lại danh sách đuôi file ở đây.
 * Danh sách đó là non-negotiable §4 và đã được đo trên 2224 file evidence thật; bản thứ hai sẽ trôi.
 */
const { isVisualEvidence, extListText, VISUAL_EXT } = require(path.join(__dirname, 'lib', 'output_rules'));

/*
 * VÒNG ĐỜI RETEST (v2.5.0 G1.8) — nhận của A. NGUỒN DUY NHẤT của 4 trạng thái là
 * `verdict_taxonomy.json.retest`, không khai lại ở `bug_claim.json`: hai bảng trạng thái cùng nghĩa là
 * nguồn trôi, và kit vừa trả giá đúng chuyện đó ở hai bản lint SQL.
 */
const RETEST = (() => {
  const vt = cfgLoad.napConfigGate({
    duong: path.join(rc.REPO_ROOT, '.agent', 'config', 'verdict_taxonomy.json'),
    nhan: 'verdict_taxonomy.json',
    phepKiem: 'vòng đời RETEST của bug (FIXED/NOT_FIXED/PARTIAL/CANNOT_VERIFY) và luật "CANNOT_VERIFY không đóng bug"',
    khiThieu: null,
  });
  return (vt && vt.retest) || null;
})();

function loadCfg() {
  try {
    return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  } catch (e) {
    console.error(`[bug-claim] không đọc được config: ${CFG_PATH} — ${e.message}`);
    process.exit(2);
  }
}
const cfg = loadCfg();

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const has = (flag) => process.argv.includes(`--${flag}`);

function taskDirs() {
  let taskOut;
  try {
    taskOut = rc.getTaskOutputDir();
  } catch (e) {
    console.error(`[bug-claim] ${e.message}`);
    console.error('  Cần TASK_KEY và PROJECT_OUTPUT_DIR, hoặc TASK_ENV=profiles/<TASK>/task.env.');
    process.exit(2);
  }
  return { taskOut, claimDir: path.join(taskOut, cfg.claimDir) };
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const atLeast = (v, n) => typeof v === 'string' && v.trim().length >= n;

/** Một `measurement` phải DẪN phép đo, không phải khẳng định. Mẫu khai ở config để soi được. */
function looksLikeMeasurement(s) {
  if (!atLeast(s, cfg.falsification.minMeasurementChars)) return false;
  return cfg.falsification.measurementMustMatchOneOf.some((p) => new RegExp(p).test(s));
}

/*
 * NEO PHÉP ĐO VÀO MỘT ARTIFACT CÓ THẬT (09/11/2026).
 *
 * `looksLikeMeasurement` ở trên chấm CHÍNH TẢ. Đo được: một claim HOÀN TOÀN BỊA — ba phép đo phản
 * chứng là văn xuôi nghĩ ra tại chỗ, không lượt chạy nào xảy ra — qua cửa với `OK, 1 claim hợp lệ`.
 * Câu "chạy lại phép đếm 5 lần, cả 5 lần đều ra 12 hàng" đủ 20 ký tự và có chữ số, thế là xong.
 *
 * Không máy nào xác minh được một phép đo ĐÃ XẢY RA, trừ khi nó ĐỂ LẠI DẤU VẾT. Nên phép đo phải trỏ
 * tới một file có thật trong cây kết quả của chính task — thứ chỉ tồn tại nếu lượt chạy đã xảy ra.
 *
 * LỐI THOÁT, và vì sao nó phải tồn tại: có phép đo thật mà không sinh file (đọc ngày sửa một tài
 * liệu, so hai dòng trong spec). Cấm tiệt thì người ta bịa một ĐƯỜNG DẪN thay vì bịa một CÂU — tệ
 * hơn, vì đường dẫn trông như bằng chứng. Nên cho phép `khong-do-duoc: <lý do>`, nhưng lý do phải
 * đủ dài VÀ số lần dùng bị ĐẾM RA: một lối thoát không ai đếm thì nó thành lối đi chính.
 */
const mienNeo = [];
const chuaPhanHanDung = [];
const chuaPhanOracle = [];
const chuaNeo = [];

/*
 * ĐỐI CHIẾU `oracle.quote` VỚI BẢN GHI NGUỒN (tăng 3, 09/11/2026).
 *
 * `oracle.quote` KHAI là trích nguyên văn, nhưng cửa chỉ kiểm ĐỘ DÀI ≥ 15. Một câu bịa 40 ký tự qua
 * cửa y như một câu trích thật — cùng lớp defect với `looksLikeMeasurement` trước khi neo artifact:
 * một LỜI KHAI VỀ XUẤT XỨ chỉ được kiểm bằng HÌNH DẠNG. Và oracle là chỗ nguy hiểm nhất để lời khai
 * lọt, vì TOÀN BỘ kết luận bug treo trên nó: sai oracle thì mọi thứ phía sau đúng quy trình mà vẫn sai.
 *
 * BỎ DẤU KHI SO, có lý do đo được: `knowledge/domain` trộn hai quy ước — 43 bản CÓ DẤU, 102 bản
 * KHÔNG DẤU. So nguyên byte sẽ chặn oan claim trích đúng nhưng gõ khác dấu, và chặn oan một claim
 * đúng là cách nhanh nhất để người ta tắt cửa. Bản chất luật là "câu trích CÓ THẬT trong nguồn",
 * không phải "giống từng byte".
 */
const CHUAN = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/\s+/g, ' ').trim();

function vanBanNguon(ban) {
  const truong = (cfg.oracleTypes.doiChieuNguon || {}).truongVanBan || [];
  const phan = [];
  for (const t of truong) {
    const v = ban[t];
    if (typeof v === 'string') phan.push(v);
    else if (Array.isArray(v)) phan.push(JSON.stringify(v));
    else if (v && typeof v === 'object') phan.push(JSON.stringify(v));
  }
  return phan.join('\n');
}

/*
 * NGUỒN THỨ HAI: `requirements/*.md` CỦA CHÍNH TASK (10/11/2026).
 *
 * Đo trên TASK-4008: 4 claim trỏ `BR-BCX-034` / `BR-BCX-042`, và cửa báo "không có bản ghi … trong
 * knowledge/domain". ĐÚNG THEO CHỮ, nhưng SAI VỀ NGHĨA — nó khiến người đọc tưởng oracle không truy
 * được. Thực tế cả hai rule TỒN TẠI, trạng thái `confirmed`, trong `requirements/spec_digest_TH.md`
 * của chính task, và câu trích là NGUYÊN VĂN.
 *
 * Dự án dùng HAI HỌ MÃ cho hai nguồn khác nhau: `BR-BCDN-*` (27 bản ghi ở `knowledge/domain`) và
 * `BR-BCX-*` (71 mã khai trong bản tóm tắt đặc tả của task). Regex của tôi khớp cả hai rồi chỉ tra
 * một chỗ — và tôi đã báo cáo cái lệch đó cho chủ dự án như một phát hiện về công việc của họ.
 *
 * Bài học, và nó cùng họ với mọi thứ đợt này: **một cửa chỉ biết một nguồn sẽ gọi "không tồn tại"
 * cho mọi thứ nằm ở nguồn kia.**
 */
/*
 * TRÍCH GHÉP: một `quote` có thể dẫn NHIỀU nguồn trong một ô, dạng
 *     BR-BCX-042: "…câu của rule…" — Ô kỳ vọng bước 5: "…câu của case…"
 * Khi đó phép so "cả chuỗi phải nằm trong nguồn" LUÔN trượt, và cửa gọi nó là "lệch" — tức tố oan.
 * Nên: nếu `quote` có các đoạn trong ngoặc kép, chỉ cần MỘT đoạn đủ dài khớp nguồn là đạt.
 *
 * Đây KHÔNG phải nới: một câu bịa vẫn không khớp đoạn nào. Nó chỉ thôi đòi tác giả trích đúng MỘT
 * nguồn khi họ đang dẫn hai.
 */
function docDoanTrich(quote) {
  const min = (cfg.oracleTypes && cfg.oracleTypes.minQuoteChars) || 15;
  const s = String(quote || '');
  const ra = [...s.matchAll(/[“"«]([^”"»]{8,})[”"»]/g)].map((m) => m[1].trim());
  /*
   * CẮT THEO GẠCH NGANG nữa. Đo trên TASK-4008/TC_183: phần trích từ rule nằm NGOÀI ngoặc kép, chỉ
   * phần "Ô kỳ vọng bước 5" mới trong ngoặc — nên chỉ bóc đoạn-trong-ngoặc là bỏ sót đúng cái cần so.
   */
  for (const d of s.split(/\s[—–]\s|\s\|\s/)) ra.push(d.replace(/^[^:]{0,24}:\s*/, '').trim());
  return [...new Set(ra)].filter((x) => x.length >= min);
}

/** Nguồn có chứa `quote` (nguyên chuỗi) hoặc MỘT đoạn trích đủ dài của nó. */
function nguonChua(vanBan, quote) {
  const vb = CHUAN(vanBan);
  if (vb.includes(CHUAN(quote))) return true;
  return docDoanTrich(quote).some((d) => vb.includes(CHUAN(d)));
}

function timTrongYeuCau(gocTask, ma, quote) {
  const thu = path.join(gocTask, 'requirements');
  let ds = [];
  try { ds = fs.readdirSync(thu).filter((f) => /\.md$/i.test(f)); } catch (e) { return null; }
  const coMa = [];
  for (const f of ds) {
    let noi;
    try { noi = fs.readFileSync(path.join(thu, f), 'utf8'); } catch (e) { continue; }
    if (!CHUAN(noi).includes(CHUAN(ma))) continue;
    /*
     * TRA HẾT MỌI FILE rồi mới kết luận "lệch".
     *
     * Bản đầu `return` ngay ở file ĐẦU TIÊN chứa mã. Đo trên TASK-4008/TC_165: cả 3 đoạn trích đều
     * CÓ trong `spec_digest_TH.md`, nhưng một file khác cũng nhắc mã đó và được duyệt trước, nên cửa
     * tố oan. Dừng ở bằng chứng đầu tiên tìm thấy là cách chắc chắn để kết luận sai.
     */
    if (nguonChua(noi, quote)) return { trangThai: 'khop', nguon: `requirements/${f}` };
    coMa.push(`requirements/${f}`);
  }
  if (coMa.length) return { trangThai: 'lech', nguon: coMa.join(' · ') };
  return null;
}

/** `khop` ⇒ trích đúng · `lech` ⇒ không có trong nguồn · `chua-phan` ⇒ không có nguồn để đối chiếu. */
function doiChieuNguon(o, gocTask) {
  const C = cfg.oracleTypes.doiChieuNguon || {};
  if (!C.batBuoc) return { trangThai: 'chua-phan', viSao: 'đối chiếu nguồn chưa bật' };
  const ma = String(o.ref || '').match(new RegExp(C.mauMa));
  if (!ma) return { trangThai: 'chua-phan', viSao: `\`oracle.ref\` không chứa mã dạng ${C.mauMa} nên không tra được bản ghi nguồn` };
  /* NGUỒN THỨ HAI trước: bản tóm tắt đặc tả của chính task. Mã họ `BR-BCX-*` sống ở đây, không ở
   * `knowledge/domain` — tra sai chỗ rồi kết luận "không tồn tại" là lỗi tôi đã mắc 09/11. */
  const tuYeuCau = gocTask ? timTrongYeuCau(gocTask, ma[0], o.quote) : null;
  if (tuYeuCau) return tuYeuCau;

  const thu = path.join(rc.REPO_ROOT, C.thuMuc);
  if (!fs.existsSync(thu)) return { trangThai: 'chua-phan', viSao: `không có \`${C.thuMuc}\` trong cây này (gói phát hành chở knowledge/ rỗng)` };
  let ds = [];
  try { ds = fs.readdirSync(thu).filter((f) => f.endsWith('.json')); } catch (e) { ds = []; }
  for (const f of ds) {
    let ban;
    try { ban = JSON.parse(fs.readFileSync(path.join(thu, f), 'utf8')); } catch (e) { continue; }
    if (CHUAN(ban.id) !== CHUAN(ma[0])) continue;
    return nguonChua(vanBanNguon(ban), o.quote)
      ? { trangThai: 'khop', nguon: f }
      : { trangThai: 'lech', nguon: f };
  }
  /* NÓI ĐỦ HAI NGUỒN ĐÃ TRA. Thông báo cũ chỉ nhắc `knowledge/domain`, nên người đọc tưởng oracle
   * không truy được — trong khi nó nằm ở nguồn kia. Một cửa nói thiếu nguồn là một cửa nói sai. */
  return {
    trangThai: 'chua-phan',
    viSao: `không tra được \`${ma[0]}\`: không có trong \`${C.thuMuc}\`, cũng không có trong `
      + '`requirements/*.md` của task',
  };
}
const NEO = (cfg.falsification && cfg.falsification.neoArtifact) || {};
/*
 * CHO PHÉP ÉP MỨC QUA BIẾN MÔI TRƯỜNG — để SPEC kiểm được CẢ HAI mức.
 *
 * Mức thật nằm ở config dùng chung, nên nếu spec chỉ kiểm mức đang bật thì nhánh kia KHÔNG BAO GIỜ
 * được chạy, và ngày ai đó siết lên "block" sẽ không có phép kiểm nào đỡ. Đây không phải cửa hậu để
 * nới: `block` chỉ làm luật CHẶT HƠN mức mặc định.
 */
if (process.env.BUG_CLAIM_NEO === 'block' || process.env.BUG_CLAIM_NEO === 'warn') {
  NEO.batBuoc = process.env.BUG_CLAIM_NEO;
}
/** Token trông như đường dẫn: có đuôi file, và không phải là một lệnh npm. */
/*
 * CHỈ NHẬN ĐUÔI CỦA ARTIFACT THẬT.
 *
 * Lượt đầu nhận mọi đuôi bắt đầu bằng chữ, và chạy trên claim THẬT của TASK-4008 nó bắt nhầm 7 chỗ:
 * `toastr.error` (tên hàm JS) · `ASP.NET` (tên nền tảng) · một HOSTNAME · `C1/…aspx` (đường URL).
 * Thông báo khi đó SAI hẳn nghĩa: "trỏ tới X nhưng không file nào" trong khi tác giả chưa bao giờ
 * định X là một file. Một cửa nói sai lý do còn tệ hơn cửa không nói.
 */
const DUOI_ARTIFACT = 'png|jpe?g|webp|gif|bmp|mp4|webm|json|md|txt|log|csv|tsv|xlsx?|docx?|pdf|zip|sql|har|ts|js|mjs|cjs|yml|yaml';
const MAU_DUONG_DAN = new RegExp(`(?:^|[\\s'"\`(=])([A-Za-z0-9_@][A-Za-z0-9_@./-]*\\.(?:${DUOI_ARTIFACT}))(?=$|[\\s'"\`),.;])`, 'gi');

function neoArtifact(s, goc, moc) {
  if (!NEO.batBuoc) return { dat: true };
  const chuoi = typeof s === 'string' ? s : '';
  const iMien = chuoi.indexOf(NEO.tienToMien);
  if (iMien >= 0) {
    const lyDo = chuoi.slice(iMien + NEO.tienToMien.length).trim();
    if (lyDo.length < NEO.minLyDoMienChars) {
      return { dat: false, viSao: `\`${NEO.tienToMien}\` phải KÈM LÝ DO ≥ ${NEO.minLyDoMienChars} ký tự — `
        + 'một lối thoát không đòi lý do thì nó là công tắc tắt cửa' };
    }
    return { dat: true, mien: true };
  }
  const ds = [...chuoi.matchAll(MAU_DUONG_DAN)].map((m) => m[1]);
  const duongThat = ds
    .map((d) => [d, path.join(goc, d), path.join(rc.REPO_ROOT, d)])
    .map(([d, a, b]) => [d, fs.existsSync(a) ? a : (fs.existsSync(b) ? b : null)])
    .filter(([, p]) => p);
  if (duongThat.length) {
    /*
     * HẠN DÙNG (tăng 2, 09/11/2026). Neo vào file CÓ THẬT chặn được claim BỊA, chưa chặn được claim
     * DÙNG LẠI ĐỒ CŨ: một probe chạy 11 ngày trước vẫn là file có thật, nhưng nó đo một build khác.
     * Mốc lấy từ `max(reruns[].at)` vì `reruns` nằm trong khối băm bằng chứng — không sửa ngược được
     * sau `--chot`, khác với mtime của file claim vốn sờ vào là đổi.
     *
     * Chỉ chặn chiều CŨ HƠN. Artifact mới hơn mốc là chuyện bình thường: điều tra tiếp sau khi rerun.
     */
    if (!(NEO.maxTuoiNgay > 0) || !Number.isFinite(moc)) {
      return { dat: true, neo: duongThat[0][0], chuaPhanHan: true };
    }
    const qua = duongThat
      .map(([d, p]) => {
        let mt = NaN;
        try { mt = fs.statSync(p).mtimeMs; } catch (e) { mt = NaN; }
        return [d, Number.isFinite(mt) ? (moc - mt) / 86400000 : NaN];
      })
      .filter(([, ngay]) => Number.isFinite(ngay) && ngay > NEO.maxTuoiNgay);
    if (qua.length === duongThat.length) {
      const [d, ngay] = qua[0];
      return {
        dat: false,
        viSao: `trỏ tới \`${d}\` nhưng file đó CŨ HƠN lượt rerun gần nhất ${Math.round(ngay)} ngày `
          + `(mức cho phép ${NEO.maxTuoiNgay}) — một artifact cũ vẫn là file có thật, nhưng nó đo một build khác. `
          + `Đo lại, hoặc khai \`${NEO.tienToMien} <lý do>\``,
      };
    }
    return { dat: true, neo: duongThat[0][0] };
  }
  return {
    dat: false,
    viSao: ds.length
      ? `trỏ tới ${ds.map((d) => `\`${d}\``).join(', ')} nhưng KHÔNG file nào có thật trong cây kết quả của task `
        + '— một phép đo đã xảy ra thì để lại dấu vết'
      : 'không trỏ tới ARTIFACT nào có thật. Một câu có chữ số không chứng minh phép đo đã xảy ra — '
        + `claim bịa qua cửa này được. Trỏ vào file lượt chạy sinh ra, hoặc khai \`${NEO.tienToMien} <lý do>\``,
  };
}

/**
 * Băm KHỐI BẰNG CHỨNG của một claim — nền của luật gốc của A: "lịch sử retest là phần DUY NHẤT được thêm
 * vào bug sau khi đã log".
 *
 * Chỉ băm những trường là BẰNG CHỨNG TẠI THỜI ĐIỂM PHÁT HIỆN. `summary`, `status`, `retest` và `_chot`
 * KHÔNG vào băm: tiêu đề còn sửa chính tả được, trạng thái thì phải đổi được, và retest thì chính là phần
 * được phép thêm.
 */
function bamBangChung(claim) {
  const khoi = {
    tc_id: claim.tc_id,
    oracle: claim.oracle,
    expected: claim.expected,
    actual: claim.actual,
    reruns: claim.reruns,
    layer: claim.layer,
    layer_probe: claim.layer_probe,
    instrument: claim.instrument,
    fixture_path: claim.fixture_path,
    falsified: claim.falsified,
  };
  return require('crypto').createHash('sha256').update(JSON.stringify(khoi)).digest('hex').slice(0, 16);
}

/**
 * Kiểm phần RETEST. Tách riêng vì nó có hai mức khác nhau, và sự khác nhau đó dựa trên SỐ ĐO:
 *
 *  · Lượt retest thiếu `build` ⇒ CHẶN, vô điều kiện. Đo 10/10/2026: 0 trong 107 claim đang có mang
 *    `retest`, nên luật này không làm đỏ một claim cũ nào.
 *  · Claim KHÔNG có retest mà thiếu `build` ⇒ chỉ CẢNH BÁO, theo cờ `requireBuild` trong `bug_claim.json`.
 *    Đo cùng lúc: 0 trong 107 claim có trường `build`, nên chặn ngay là làm đỏ 105 claim đang sống rồi
 *    gate bị tắt. Cờ đó có đường siết, và lúc còn ở mức cảnh báo thì gate PHẢI nói là chưa được gác.
 */
function kiemRetest(claim, at) {
  const rt = Array.isArray(claim.retest) ? claim.retest : [];
  if (!RETEST) {
    if (rt.length) at('có `retest` nhưng thiếu `verdict_taxonomy.json` ⇒ KHÔNG phán được trạng thái retest, và "không phán được" không thành đạt');
    return;
  }
  const hopLe = Object.keys(RETEST.states || {});

  if (!rt.length) {
    const mucBuild = String(cfg.requireBuild || 'warn');
    if (!nonEmpty(claim.build)) {
      if (mucBuild === 'block') at('thiếu `build` — bug không ghi build thì lượt retest sau không kiểm lại được');
      else THIEU_BUILD.push(path.basename(file0()));   // gộp, in MỘT dòng ở cuối — xem `inCanhBaoBuild`
    }
    return;
  }

  if (!nonEmpty(claim.build)) at('có lịch sử `retest` nhưng thiếu `build` của lần PHÁT HIỆN — không có mốc thì không so được build nào đã sửa');

  rt.forEach((r, i) => {
    const w = `\`retest[${i}]\``;
    if (!nonEmpty(r && r.at)) at(`${w} thiếu \`at\` (dấu thời gian)`);
    if (!nonEmpty(r && r.build)) at(`${w} thiếu \`build\` — cùng một bug cho hai kết quả khác nhau trên hai build là chuyện thường`);
    if (!hopLe.includes(r && r.result)) at(`${w} \`result\` phải là một trong ${hopLe.join(', ')}`);
    if (!isVisualEvidence(r && r.evidence)) {
      at(`${w} \`evidence\` phải là ${extListText(VISUAL_EXT)} (non-negotiable §4) — không nhận .json/.md/.txt/.log`);
    }
    if (r && r.result === 'PARTIAL' && !atLeast(r.con_sai, 15)) {
      at(`${w} là PARTIAL nhưng thiếu \`con_sai\` — "fix một phần" mà không nói phần nào thì lượt sau không ai kiểm được`);
    }
  });

  /* `CANNOT_VERIFY`/`NOT_FIXED`/`PARTIAL` KHÔNG được dùng để đóng bug. */
  const cuoi = rt[rt.length - 1] || {};
  const st = (RETEST.states || {})[cuoi.result];
  if (claim.dong === true && !(st && st.coTheDong)) {
    at(`\`dong: true\` nhưng lượt retest cuối là \`${cuoi.result}\` — chỉ trạng thái có \`coTheDong\` mới được đóng bug. "Không phán được" KHÔNG thành đã-sửa`);
  }

  /*
   * LUẬT GỐC CỦA A, gác bằng băm: khi đã có retest thì khối bằng chứng của lần phát hiện phải KHÔNG ĐỔI.
   * Sửa `expected`/`actual`/tầng cho khớp build mới là xoá dấu vết của chính thứ đã được báo.
   * Chốt lần đầu bằng `npm run bug:claim:chot`.
   */
  const bam = bamBangChung(claim);
  const chot = (claim._chot || {}).hash;
  if (!nonEmpty(chot)) {
    at('có `retest` nhưng chưa chốt khối bằng chứng — chạy `npm run bug:claim:chot` (một lần cho mỗi bug) rồi mới ghi lượt retest');
  } else if (chot !== bam) {
    at(`khối bằng chứng ĐÃ ĐỔI sau khi có retest (chốt \`${chot}\`, hiện \`${bam}\`) — lịch sử retest là phần DUY NHẤT được thêm sau khi log; expected/actual/tầng/evidence là bằng chứng tại thời điểm phát hiện`);
  }
}

/** Tên file đang kiểm, để cảnh báo ngoài danh sách lỗi vẫn gọi được tên. */
let _file = '';
const file0 = () => _file;

/*
 * Claim thiếu `build` được GOM rồi in MỘT dòng, không in mỗi file một dòng. Bản đầu in 23 dòng y hệt nhau
 * trên một task thật — và một cảnh báo lặp 23 lần thì người đọc cuộn qua, tức nó không còn là cảnh báo.
 */
const THIEU_BUILD = [];
function inCanhBaoBuild() {
  if (!THIEU_BUILD.length) return;
  const muc = String(cfg.requireBuild || 'warn');
  console.log(`[bug-claim] ⚠ ${THIEU_BUILD.length} claim thiếu \`build\` ⇒ luật "bug phải ghi build" CHƯA ĐƯỢC GÁC (\`requireBuild: "${muc}"\` trong bug_claim.json).`);
  console.log(`  ${THIEU_BUILD.slice(0, 5).join(' · ')}${THIEU_BUILD.length > 5 ? ` … (+${THIEU_BUILD.length - 5})` : ''}`);
  console.log('  Không có build thì lượt retest sau không so được build nào đã sửa. Khai `build` rồi siết cờ thành "block".');
}

/** Kiểm MỘT claim. Trả mảng lỗi rỗng nghĩa là đạt. */
function validate(claim, file) {
  const e = [];
  _file = file;
  const at = (m) => e.push(`${path.basename(file)}: ${m}`);

  if (!nonEmpty(claim.id)) at('thiếu `id`');
  if (!nonEmpty(claim.tc_id)) at('thiếu `tc_id`');
  if (!nonEmpty(claim.summary)) at('thiếu `summary`');
  if (!cfg.statuses.includes(claim.status)) at(`\`status\` phải là một trong ${cfg.statuses.join(', ')}`);

  /*
   * Claim ĐÃ RÚT chỉ cần ghi lý do và phép kiểm nào bắt được. Không bắt nó đủ trường, vì mục đích của
   * bản ghi rút là ĐẾM ĐƯỢC lỗi, không phải phạt việc thành thật. Bắt nó đầy đủ thì lần sau sẽ không
   * ai ghi nữa, và ta quay lại chỗ cũ: lỗi vô hình.
   */
  if (claim.status === 'withdrawn') {
    if (!atLeast(claim.withdrawn_reason, 15)) at('đã rút nhưng `withdrawn_reason` quá ngắn hoặc thiếu');
    if (!nonEmpty(claim.withdrawn_by_check)) at('đã rút nhưng thiếu `withdrawn_by_check` — phép kiểm nào bắt được');
    return e;
  }

  const o = claim.oracle || {};
  if (!cfg.oracleTypes.allowed.includes(o.type)) {
    at(`\`oracle.type\` phải thuộc ${cfg.oracleTypes.allowed.join(', ')} — app không được làm oracle của chính nó`);
  }
  if (!nonEmpty(o.ref)) at('thiếu `oracle.ref` — neo cụ thể, ví dụ BR-12 hoặc FSD §4.1.1');
  if (!atLeast(o.quote, cfg.oracleTypes.minQuoteChars)) {
    at(`\`oracle.quote\` phải TRÍCH nguyên văn từ nguồn, tối thiểu ${cfg.oracleTypes.minQuoteChars} ký tự`);
  } else {
    const dc = doiChieuNguon(o, path.resolve(path.dirname(file || "."), "..", ".."));
    if (dc.trangThai === 'lech') {
      at(`\`oracle.quote\` KHÔNG có trong \`${dc.nguon}\` — nó khai là TRÍCH NGUYÊN VĂN, nhưng đối chiếu `
        + 'với bản ghi nguồn thì không tìm thấy câu đó. Một câu bịa 40 ký tự qua cửa y như một câu trích '
        + 'thật nếu chỉ đếm độ dài, mà toàn bộ kết luận bug treo trên oracle.');
    } else if (dc.trangThai === 'chua-phan') {
      chuaPhanOracle.push(`${path.basename(file || '?')} — ${dc.viSao}`);
    }
  }

  const minVal = cfg.field.minExpectedActualChars;
  if (!atLeast(claim.expected, minVal)) at(`\`expected\` quá ngắn, cần ít nhất ${minVal} ký tự và là GIÁ TRỊ`);
  if (!atLeast(claim.actual, minVal)) at(`\`actual\` quá ngắn, cần ít nhất ${minVal} ký tự và là GIÁ TRỊ`);
  if (nonEmpty(claim.expected) && String(claim.expected).trim() === String(claim.actual).trim()) {
    at('`expected` trùng `actual` — không có gì lệch thì không có bug');
  }

  const rr = Array.isArray(claim.reruns) ? claim.reruns : [];
  if (rr.length < cfg.minReruns) {
    at(`\`reruns\` có ${rr.length} lượt, cần ít nhất ${cfg.minReruns} để loại flaky và setup`);
  } else {
    const results = rr.map((r) => String((r && r.result) || '').trim());
    if (results.some((r) => !r)) at('`reruns` có lượt thiếu `result`');
    else if (new Set(results.map((r) => r.toLowerCase())).size > 1) {
      at(`\`reruns\` không ổn định (${results.join(', ')}) — kết quả đổi giữa các lượt là flaky, chưa phải bug`);
    } else if (!cfg.failResults.map((x) => x.toLowerCase()).includes(results[0].toLowerCase())) {
      at(`\`reruns\` toàn "${results[0]}" — claim bug thì mọi lượt phải fail`);
    }
    if (rr.some((r) => !nonEmpty(r && r.at))) at('`reruns` có lượt thiếu `at` (dấu thời gian)');
  }

  if (!['fe', 'be'].includes(claim.layer)) at('`layer` phải là `fe` hoặc `be` — đoán tầng là gán sai người');
  if (!atLeast(claim.layer_probe, cfg.field.minLayerProbeChars)) {
    at('`layer_probe` thiếu — phải nói ĐO BẰNG GÌ mà biết tầng, ví dụ response API trả gì');
  }

  const ins = claim.instrument || {};
  if (!nonEmpty(ins.control_type)) at('thiếu `instrument.control_type` — ant-select, radio, input, cell bảng');
  if (!nonEmpty(ins.read_method)) at('thiếu `instrument.read_method` — đọc value, đọc checked, hay đọc textContent');

  if (!cfg.fixturePaths.allowed.includes(claim.fixture_path)) {
    at(`\`fixture_path\` phải thuộc ${cfg.fixturePaths.allowed.join(', ')} — dựng thẳng DB thì app chưa từng đi qua trạng thái đó`);
  }

  const fal = Array.isArray(claim.falsified) ? claim.falsified : [];
  const need = Object.keys(cfg.falsification.requiredCategories);
  const seen = new Set(fal.map((f) => f && f.category));
  for (const c of need) {
    if (!seen.has(c)) at(`\`falsified\` thiếu nhóm "${c}" — ${cfg.falsification.requiredCategories[c].split('.')[0]}`);
  }
  fal.forEach((f, i) => {
    const w = `\`falsified[${i}]\``;
    if (!nonEmpty(f && f.category)) at(`${w} thiếu \`category\``);
    if (!atLeast(f && f.hypothesis, cfg.falsification.minHypothesisChars)) at(`${w} \`hypothesis\` quá ngắn`);
    /*
     * NEO-ARTIFACT THAY THẾ KHỚP-CHÍNH-TẢ, không cộng thêm.
     *
     * Đo bằng đối chứng 09/11/2026: để hai phép kiểm chồng nhau thì CẢ BỐN biến thể đều bị chặn, kể
     * cả biến neo artifact THẬT — vì `measurementMustMatchOneOf` không có đuôi ảnh, nên một câu trỏ
     * đúng vào `evidence/.../buoc-ghi.png` vẫn bị kêu là "chưa dẫn phép đo". Và lối thoát
     * `khong-do-duoc:` thì bị đòi "trông như phép đo" — vô nghĩa, vì nó tồn tại đúng cho trường hợp
     * KHÔNG đo thành file được.
     *
     * Trỏ vào một file CÓ THẬT là bằng chứng mạnh hơn "trong câu có chữ số", nên nó thay thế. Danh
     * sách mẫu cũ vẫn giữ cho đường `batBuoc: false` — gỡ nó đi là bỏ phép kiểm ở cấu hình chưa bật.
     */
    const mea = f && f.measurement;
    if (!NEO.batBuoc) {
      if (!looksLikeMeasurement(mea)) at(`${w} \`measurement\` chưa dẫn PHÉP ĐO — cần số, lệnh, endpoint hoặc đường dẫn file`);
    } else if (!atLeast(mea, cfg.falsification.minMeasurementChars)) {
      at(`${w} \`measurement\` quá ngắn (cần ≥ ${cfg.falsification.minMeasurementChars} ký tự)`);
    } else {
      /* Thư mục kết quả của task: `<taskOut>/reports/bug-claims/X.json` ⇒ lùi ba cấp. */
      const gocTask = path.resolve(path.dirname(file || '.'), '..', '..');
      /* Mốc hạn dùng: lượt rerun GẦN NHẤT. `reruns[].at` là bắt buộc và nằm trong khối băm. */
      const mocRerun = Math.max(...(Array.isArray(claim.reruns) ? claim.reruns : [])
        .map((r) => Date.parse((r && r.at) || '')).filter(Number.isFinite), -Infinity);
      const neo = neoArtifact(mea, gocTask, mocRerun);
      if (!neo.dat) {
        /*
         * HAI MỨC, theo đúng tiền lệ `requireBuild` trong cùng file config: "warn" đếm và in tỉ lệ,
         * "block" mới chặn. Đo trên TASK-4008 (task thật, đã chạy xong): 113/… phép đo không neo
         * được, trải đều cả ba nhóm phản chứng — mức "block" sẽ đẩy gần như mọi phép đo vào lối
         * thoát, tức biến lối thoát thành lối đi chính.
         */
        if (NEO.batBuoc === 'warn') chuaNeo.push(`${path.basename(file || '?')} ${w}`);
        else at(`${w} \`measurement\` ${neo.viSao}`);
      } else if (neo.mien) mienNeo.push(`${path.basename(file || '?')} ${w}`);
      else if (neo.chuaPhanHan) chuaPhanHanDung.push(`${path.basename(file || '?')} ${w}`);
    }
    if (!nonEmpty(f && f.result)) at(`${w} thiếu \`result\` — phản chứng đó bị loại bằng kết quả gì`);
  });

  kiemRetest(claim, at);
  return e;
}

function readClaims(claimDir) {
  if (!fs.existsSync(claimDir)) return [];
  return fs.readdirSync(claimDir).filter((f) => f.endsWith('.json')).map((f) => {
    const p = path.join(claimDir, f);
    try {
      return { file: p, claim: JSON.parse(fs.readFileSync(p, 'utf8')) };
    } catch (e) {
      return { file: p, parseError: e.message };
    }
  });
}

/*
 * Nửa quan trọng của máy này: đối chiếu NGƯỢC. Nếu chỉ kiểm claim đã viết thì bỏ qua claim KHÔNG viết,
 * mà đó mới đúng là lỗi cần chặn. Đọc `testcase-status.json` tổng hợp, mọi case FAIL mang failureLayer
 * product_bug hoặc api_bug đều phải có claim.
 */
function missingClaims(taskOut, claims) {
  const statusFile = path.join(taskOut, 'test-results', 'testcase-status.json');
  if (!fs.existsSync(statusFile)) return { checked: false, missing: [] };
  let tests = [];
  try {
    const j = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    tests = Array.isArray(j) ? j : (j.tests || []);
  } catch (e) {
    return { checked: false, missing: [], error: e.message };
  }
  const active = new Set(claims.filter((c) => c.claim && c.claim.status !== 'withdrawn').map((c) => c.claim && c.claim.tc_id));
  const withdrawn = new Set(claims.filter((c) => c.claim && c.claim.status === 'withdrawn').map((c) => c.claim && c.claim.tc_id));
  /*
   * Hai tình huống KHÁC NHAU, và nói gộp thì người đọc sửa nhầm chỗ:
   *   · chưa có claim nào  → viết claim trước khi nói "bug"
   *   · claim ĐÃ RÚT mà case vẫn chấm product_bug → verdict chưa được sửa theo. Rút claim thì phải hạ
   *     verdict, nếu không thì bug đã rút vẫn đi tiếp tới bước log Backlog.
   */
  const missing = [];
  let grandfathered = 0;
  for (const t of tests) {
    if (!cfg.blockingLayers.includes(String(t.failureLayer || ''))) continue;
    /*
     * Hai đời khuôn `testcase-status.json` cùng tồn tại: bộ cũ dùng `id`, bộ mới dùng `tcId`. Đọc một
     * khoá thì bộ kia ra `undefined` và thông báo vô dụng. Đã dính thật khi chạy trên TASK-28905.
     */
    const id = t.id || t.tcId || '(không đọc được id)';
    /*
     * BỎ QUA case ĐÃ CÓ BUG KEY. Gate này sinh ra để chặn claim CHƯA kiểm chứng lọt tới người đọc,
     * không phải để đòi hồi tố cho bug đã log và đã đóng. Case có `bug: <KEY>-<số>` nghĩa là nó đã đi
     * qua gate của phase2_04 rồi. Bắt nó viết claim ngược là biến gate thành tiếng ồn trên nợ cũ, và
     * gate hay báo oan thì bị tắt. Vẫn ĐẾM và in ra, để việc bỏ qua không âm thầm.
     */
    if (nonEmpty(t.bug)) { grandfathered += 1; continue; }
    if (active.has(id)) continue;
    if (withdrawn.has(id)) {
      missing.push(`${id}: claim ĐÃ RÚT nhưng case vẫn chấm ${t.failureLayer} — sửa verdict trong testcase-status.json cho khớp`);
    } else {
      missing.push(`${id} (${t.failureLayer}) được chấm là bug nhưng KHÔNG có claim — viết claim trước, đừng nói "bug" trước`);
    }
  }
  return { checked: true, total: tests.length, missing, grandfathered };
}

const TEMPLATE = (tcId) => ({
  id: `CLAIM-${tcId}`,
  tc_id: tcId,
  summary: '',
  status: 'claimed',
  /*
   * `build` — build/version quan sát thấy lỗi. Bắt buộc khi có `retest` (xem `kiemRetest`): một retest
   * không ghi build là một câu không kiểm lại được.
   */
  build: '',
  oracle: { type: '', ref: '', quote: '' },
  expected: '',
  actual: '',
  reruns: [{ at: '', result: 'fail' }, { at: '', result: 'fail' }],
  layer: '',
  layer_probe: '',
  instrument: { control_type: '', read_method: '' },
  fixture_path: '',
  falsified: Object.entries(cfg.falsification.requiredCategories).map(([category, why]) => ({
    category, hypothesis: '', measurement: '', result: '', _goi_y: why,
  })),
  /*
   * `retest` để RỖNG lúc tạo. Nó là phần DUY NHẤT được thêm vào sau khi bug đã log — mọi trường trên là
   * bằng chứng tại thời điểm phát hiện, và sửa chúng cho khớp build mới là xoá dấu vết của chính thứ đã
   * được báo. Thêm lượt đầu thì chạy `npm run bug:claim:chot` trước để chốt khối bằng chứng.
   */
  retest: [],
  _retest_mau: { at: '<ISO>', build: '<build mới>', result: 'FIXED|NOT_FIXED|PARTIAL|CANNOT_VERIFY', evidence: '<đường dẫn ảnh/video>', con_sai: '(chỉ khi PARTIAL) phần nào còn sai' },
});

/*
 * Ba bộ đếm của cửa, gom lại để in được ở CẢ HAI nhánh.
 *
 * Lượt đầu chúng chỉ in ở nhánh ĐẠT. Chạy trên task thật TASK-4008 thì cửa CHẶN, và con số biến
 * mất ĐÚNG LÚC CẦN NÓ NHẤT: người đọc thấy 7 vấn đề mà không biết 113 phép đo kia đang ở đâu.
 * Một số đo chỉ xuất hiện khi mọi thứ đã ổn thì nó không phải số đo, nó là lời chúc mừng.
 */
function inSoDem(claims) {
  if (chuaNeo.length) {
    /* Mức "warn": đếm và IN TỈ LỆ, để quyết định siết sau này dựa trên SỐ chứ không trên cảm giác. */
    const tongPD = claims.reduce((a, c) => a + ((c.claim && Array.isArray(c.claim.falsified)) ? c.claim.falsified.length : 0), 0);
    const neoDuoc = tongPD - chuaNeo.length;
    const ti = tongPD ? Math.round((neoDuoc / tongPD) * 100) : 0;
    console.log(`  ⚠ NEO ARTIFACT đang ở mức "warn": ${neoDuoc}/${tongPD} phép đo neo được vào artifact có thật (${ti}%).`);
    console.log('    Siết lên "block" khi tỉ lệ này của một task MỚI vượt 70% — xem `_cach_siet` trong bug_claim.json.');
  }
  if (chuaPhanOracle.length) {
    /* Oracle không đối chiếu được thì phải NÓI RA — "không đo được" không thành "đo ra đạt". */
    console.log(`  ⚠ ${chuaPhanOracle.length} claim CHƯA ĐỐI CHIẾU ĐƯỢC \`oracle.quote\` với nguồn: ${chuaPhanOracle.join(' · ')}`);
  }
  if (chuaPhanHanDung.length) {
    /* "Không đo được" KHÔNG thành "đo ra đạt" — cùng doctrine ⑦/⑨/⑩ của `version:check`. */
    console.log(`  ⚠ ${chuaPhanHanDung.length} phép đo CHƯA PHÁN ĐƯỢC HẠN DÙNG (thiếu mốc rerun hoặc chưa bật \`maxTuoiNgay\`): ${chuaPhanHanDung.join(' · ')}`);
  }
}

function main() {
  if (has('new')) {
    const tcId = arg('new');
    if (!tcId) { console.error('[bug-claim] cần: --new <TC_ID>'); process.exit(2); }
    const { claimDir } = taskDirs();
    fs.mkdirSync(claimDir, { recursive: true });
    const out = path.join(claimDir, `${tcId}.json`);
    if (fs.existsSync(out)) { console.error(`[bug-claim] đã có: ${out}`); process.exit(2); }
    fs.writeFileSync(out, `${JSON.stringify(TEMPLATE(tcId), null, 2)}\n`, 'utf8');
    console.log(`[bug-claim] đã tạo bản nháp: ${path.relative(rc.REPO_ROOT, out).split(path.sep).join('/')}`);
    console.log('  Điền đủ rồi chạy `npm run bug:claim` TRƯỚC khi nhắc chữ "bug" trong hội thoại.');
    process.exit(0);
  }

  const { taskOut, claimDir } = taskDirs();
  const claims = readClaims(claimDir);

  /*
   * `--chot [TC_ID]` — ghi băm của khối bằng chứng vào `_chot`, một lần cho mỗi bug, TRƯỚC khi ghi lượt
   * retest đầu tiên. Tách thành lệnh riêng chứ không tự ghi trong `--check`: một bộ kiểm mà tự sửa file nó
   * đang kiểm thì lần sau không ai tin nó đã kiểm cái gì.
   */
  if (has('chot')) {
    const chi = arg('chot');
    let n = 0;
    for (const c of claims) {
      if (!c.claim || (chi && c.claim.tc_id !== chi)) continue;
      const bam = bamBangChung(c.claim);
      const cu = (c.claim._chot || {}).hash;
      if (cu === bam) continue;
      if (cu) {
        console.error(`[bug-claim] ✗ ${path.basename(c.file)} ĐÃ chốt (\`${cu}\`) mà khối bằng chứng nay khác (\`${bam}\`).`);
        console.error('  Chốt lại là ghi đè dấu vết của lần phát hiện. Muốn đổi bằng chứng thì mở một bug MỚI, hoặc xoá `_chot` có chủ ý và ghi lý do.');
        process.exit(1);
      }
      c.claim._chot = { hash: bam, at: new Date().toISOString(), _y_nghia: 'băm khối bằng chứng của LẦN PHÁT HIỆN. Từ đây chỉ `retest` được thêm; sửa expected/actual/tầng/falsified sẽ bị `bug:claim` CHẶN.' };
      fs.writeFileSync(c.file, `${JSON.stringify(c.claim, null, 2)}\n`, 'utf8');
      console.log(`[bug-claim] đã chốt ${path.basename(c.file)} — ${bam}`);
      n += 1;
    }
    console.log(n ? `[bug-claim] chốt ${n} claim. Giờ mới được ghi lượt \`retest\`.` : '[bug-claim] không có claim nào cần chốt.');
    process.exit(0);
  }

  if (has('report')) {
    const by = {};
    const caught = {};
    for (const c of claims) {
      const s = (c.claim && c.claim.status) || '(hỏng)';
      by[s] = (by[s] || 0) + 1;
      if (c.claim && c.claim.status === 'withdrawn') {
        const k = c.claim.withdrawn_by_check || '(không ghi)';
        caught[k] = (caught[k] || 0) + 1;
      }
    }
    console.log(`[bug-claim] ${claims.length} claim trong ${path.relative(rc.REPO_ROOT, claimDir).split(path.sep).join('/')}`);
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
    const w = by.withdrawn || 0;
    if (claims.length) console.log(`  tỉ lệ rút: ${((w / claims.length) * 100).toFixed(0)}%`);
    if (w) {
      console.log('  phép kiểm đã bắt được:');
      for (const [k, v] of Object.entries(caught).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k}`);
    }
    process.exit(0);
  }

  // mặc định là --check
  const problems = [];
  for (const c of claims) {
    if (c.parseError) { problems.push(`${path.basename(c.file)}: không parse được — ${c.parseError}`); continue; }
    problems.push(...validate(c.claim, c.file));
  }

  const mc = missingClaims(taskOut, claims);
  for (const m of mc.missing) problems.push(`case ${m}`);

  const ok = claims.filter((c) => c.claim && !c.parseError);
  const nActive = ok.filter((c) => c.claim.status !== 'withdrawn').length;
  const nWithdrawn = ok.length - nActive;

  inCanhBaoBuild();

  /*
   * IN SỐ ĐẾM Ở CẢ HAI NHÁNH, không chỉ khi ĐẠT.
   *
   * Lượt đầu tôi để ba bộ đếm (neo "warn" · lối thoát · oracle chưa đối chiếu) chỉ in ở nhánh ĐẠT.
   * Chạy trên task thật TASK-4008 thì cửa CHẶN, và con số biến mất ĐÚNG LÚC CẦN NÓ NHẤT — người đọc
   * thấy 7 vấn đề mà không biết 113 phép đo kia đang ở đâu. Một số đo chỉ xuất hiện khi mọi thứ đã
   * ổn thì nó không phải số đo, nó là lời chúc mừng.
   */
  inSoDem(claims);

  if (problems.length) {
    console.error(`[bug-claim] CHẶN: ${problems.length} vấn đề trên ${claims.length} claim.`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('');
    console.error('  Luật: claim phải qua máy TRƯỚC khi nói thành lời. Câu hỏi cho người dùng khi đó chỉ còn là');
    console.error('  "có log không", không phải "có phải bug không". Tạo bản nháp: `npm run bug:claim:new -- --new <TC_ID>`.');
    process.exit(1);
  }

  const scope = mc.checked ? `, đối chiếu ${mc.total} case trong testcase-status.json` : ', chưa có testcase-status.json để đối chiếu';
  const gf = mc.grandfathered ? ` Bỏ qua ${mc.grandfathered} case đã có bug key (đã log trước khi có gate này).` : '';
  console.log(`[bug-claim] OK — ${nActive} claim hợp lệ, ${nWithdrawn} đã rút${scope}.${gf}`);
  if (mienNeo.length) {
    /* Lối thoát không ai đếm thì nó thành lối đi chính. Con số này phải ở trong tầm mắt. */
    console.log(`  ⚠ ${mienNeo.length} phép đo dùng lối thoát \`${NEO.tienToMien}\` — không neo được artifact: ${mienNeo.join(' · ')}`);
  }
  process.exit(0);
}

/*
 * Xuất `bamBangChung` để test gọi ĐÚNG công thức của script, không tự dựng lại. Dựng lại công thức băm
 * trong test là cách chắc chắn nhất để test xanh trong khi script sai — hai bên cùng một lỗi.
 */
module.exports = { bamBangChung, validate };
if (require.main === module) main();
