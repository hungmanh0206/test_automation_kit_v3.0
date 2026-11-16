#!/usr/bin/env node
'use strict';

/*
 * release_summary.js — KHUYẾN NGHỊ go/no-go, có căn cứ, và KHÔNG tự quyết.
 *
 * VÌ SAO CÓ (v2.5.0 G1.1, nhận của A `qig-qa-automation`). Kit có `results:summary` (tóm tắt MỘT lượt
 * chạy) và `release:verify` (kiểm BẢN ĐÓNG GÓI chạy được). Không có gì gộp nhiều lượt của một mốc rồi
 * đối chiếu với tiêu chí exit.
 *
 * BỐN LUẬT CỦA A ĐƯỢC GIỮ NGUYÊN, và ba trong số đó là máy gác được:
 *  ① Tiêu chí exit chốt TRƯỚC khi xem kết quả. Nhìn số rồi mới đặt ngưỡng là hợp thức hoá kết quả, không
 *    phải đánh giá. ⇒ Thiếu `exit_criteria.json` thì TỪ CHỐI chạy; file đó MỚI HƠN dữ liệu kết quả thì
 *    cũng TỪ CHỐI.
 *  ② Vùng CHƯA TEST đứng trước mọi tỉ lệ. Một tỉ lệ pass 96% trên phần đã chạy nghe khác hẳn khi biết
 *    40 case chưa từng chạy.
 *  ③ BLOCKED và SKIP KHÔNG tính là PASS.
 *  ④ QA khuyến nghị, PM quyết. Nên đầu ra luôn là "ĐỀ XUẤT", và `--enforce` KHÔNG chặn vì NO-GO — nó
 *    chỉ chặn hai chuyện ở ① (thiếu tiêu chí, hoặc tiêu chí chốt sau kết quả).
 *
 * TIÊU CHÍ KHÔNG ĐO ĐƯỢC THÌ GHI "KHÔNG ĐO ĐƯỢC", KHÔNG BAO GIỜ GHI "ĐẠT". Đo 10/10/2026 trên repo:
 *  · `testcase-status.json` KHÔNG có `priority` và KHÔNG có `module` ⇒ tiêu chí "pass rate TC Priority
 *    High" và "module trong phạm vi đã chạy" không đo được từ đó.
 *  · `knowledge/bugs` có **0 file** ⇒ hai tiêu chí về bug Critical/Major đang mở không đo được.
 *  · `runId` là chuỗi TỰ DO (`20261006-donvi`…) ⇒ KHÔNG phân biệt được manual với automation. Script nói
 *    ra chuyện đó kèm đường khai báo, chứ không bịa ra một phép chia.
 *
 * Dùng:
 *   npm run release:summary -- --task <K>            # báo cáo
 *   npm run release:summary:enforce -- --task <K>    # thiếu/sửa-sau tiêu chí → exit 1
 *   node scripts/qa/release_summary.js --init --task <K>   # dựng exit_criteria.json mặc định
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d = '') => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;

const VT = cfgLoad.napConfigGate({
  duong: path.join(REPO, '.agent/config/verdict_taxonomy.json'),
  nhan: 'verdict_taxonomy.json',
  phepKiem: 'chuẩn hoá verdict, và luật "BLOCKED/SKIP không tính là PASS"',
  khiThieu: null,
}) || {};
const chuanHoa = (s) => {
  const k = String(s || '').trim().toUpperCase();
  return (VT.synonyms && VT.synonyms[k]) || k;
};

/**
 * BẢY TIÊU CHÍ MẶC ĐỊNH của A, kèm `nguon` — nguồn số của từng tiêu chí.
 *
 * `nguon` là phần B thêm vào. A để tiêu chí ở dạng chữ, nên một tiêu chí không có dữ liệu vẫn có thể bị
 * chấm bằng cảm nhận. Khai nguồn thì máy tự biết tiêu chí nào nó ĐO ĐƯỢC và tiêu chí nào không.
 */
const MAC_DINH = [
  { id: 1, ten: 'Bug Critical đang mở', nguong: '0', nguon: 'knowledge/bugs' },
  { id: 2, ten: 'Bug Major đang mở', nguong: '0, hoặc có workaround PM chấp nhận bằng văn bản', nguon: 'knowledge/bugs' },
  { id: 3, ten: 'Pass rate TC Priority High', nguong: '>= 95%', nguon: 'priority' },
  { id: 4, ten: 'Pass rate toàn bộ TC đã chạy', nguong: '>= 90%', nguon: 'status' },
  { id: 5, ten: 'Tỉ lệ BLOCKED', nguong: '<= 5%', nguon: 'status' },
  { id: 6, ten: 'REQ mức Critical có ít nhất 1 TC PASS', nguong: '100%', nguon: 'req' },
  { id: 7, ten: 'Module trong phạm vi release đã có TC và đã chạy', nguong: '100%', nguon: 'module' },
];

/*
 * Sổ quyết định — nơi đọc CẢ miễn trừ gate (`override.js`) LẪN ngoại lệ phát hành (`release_exception`).
 * `--decisions-dir` để spec chạy trên thư mục tạm, không đụng `knowledge/` thật của repo.
 */
const DIR_DECISIONS = path.resolve(arg('decisions-dir', path.join(REPO, 'knowledge', 'decisions')));

/**
 * Ngoại lệ phát hành CÒN HIỆU LỰC cho một task, đã qua ĐÚNG luật schema của `decisions.js`.
 *
 * Trả `{ hopLe: Map<id tiêu chí, bản ghi>, boQua: [{ id, vi_sao }] }`. Bản ghi sai schema, hết hạn hoặc
 * `superseded` KHÔNG được hạ đề xuất — và cũng không được biến mất: nó vào `boQua` để báo cáo nói ra.
 */
function ngoaiLePhatHanh(taskKey, homNay = new Date().toISOString().slice(0, 10)) {
  const dec = require(path.join(__dirname, 'decisions.js'));
  const hopLe = new Map();
  const boQua = [];
  for (const r of dec.loadAll(DIR_DECISIONS)) {
    const j = r.data || {};
    if (j.type !== 'release_exception' || j.task_key !== taskKey) continue;
    const ten = j.id || path.basename(r.file);
    const v = dec.validate(r);
    if (v.problems.length) { boQua.push({ id: ten, vi_sao: `sai schema — ${v.problems[0].replace(/^[^:]+:\s*/, '')}` }); continue; }
    if (j.status !== 'active') { boQua.push({ id: ten, vi_sao: `status \`${j.status}\`` }); continue; }
    if (String(j.expires_at) < homNay) { boQua.push({ id: ten, vi_sao: `HẾT HẠN ${j.expires_at}` }); continue; }
    hopLe.set(j.exit_criterion_id, j);
  }
  return { hopLe, boQua };
}

function thuMuc() {
  let taskOut;
  try { taskOut = rc.getTaskOutputDir(); } catch (e) {
    console.error(`[release-summary] ${e.message}`);
    console.error('  Cần TASK_KEY + PROJECT_OUTPUT_DIR, hoặc TASK_ENV=profiles/<TASK>/task.env.');
    process.exit(2);
  }
  return {
    taskOut,
    tieuChi: path.join(taskOut, 'reports', 'exit_criteria.json'),
    status: path.join(taskOut, 'test-results', 'testcase-status.json'),
    trace: path.join(taskOut, 'reports', 'traceability-matrix.md'),
  };
}

function init(p) {
  if (fs.existsSync(p)) { console.error(`[release-summary] đã có: ${p}`); process.exit(2); }
  const doc = {
    _canh_bao: 'ĐÂY LÀ BỘ MẶC ĐỊNH CỦA AGENT, CHƯA ĐƯỢC PM XÁC NHẬN. Báo cáo sẽ ghi rõ như vậy cho tới khi `laMacDinh` đổi thành false kèm `nguoiXacNhan` và `ngayXacNhan`.',
    _luat: 'Chốt tiêu chí TRƯỚC khi xem kết quả. `release:summary` TỪ CHỐI chạy nếu file này mới hơn `testcase-status.json` — nhìn số rồi mới đặt ngưỡng là hợp thức hoá kết quả.',
    laMacDinh: true,
    nguoiXacNhan: '',
    ngayXacNhan: '',
    manualRunIdPrefix: [],
    _manualRunIdPrefix: '`runId` trong testcase-status là chuỗi TỰ DO nên máy không biết lượt nào chạy tay. Khai tiền tố ở đây (ví dụ ["manual-", "tay-"]) thì báo cáo tách được manual với automation; không khai thì nó NÓI RÕ là không tách được, chứ không bịa.',
    tieuChi: MAC_DINH.map((c) => ({ ...c, ketQua: '', soThucTe: '', ngoaiLe: '' })),
  };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`[release-summary] đã dựng ${path.relative(REPO, p).split(path.sep).join('/')} với 7 tiêu chí mặc định của A.`);
  console.log('  SỬA NGƯỠNG THEO DỰ ÁN rồi mới chạy test — chốt sau khi xem kết quả sẽ bị TỪ CHỐI.');
  process.exit(0);
}

function main() {
  const d = thuMuc();
  if (flag('init')) init(d.tieuChi);

  /* ① TỪ CHỐI khi thiếu tiêu chí. "Không có tiêu chí" KHÔNG thành "đạt mọi tiêu chí". */
  if (!fs.existsSync(d.tieuChi)) {
    console.error('[release-summary] ✗ TỪ CHỐI — không có `reports/exit_criteria.json`.');
    console.error('  Không có tiêu chí thì mọi con số dưới đây chỉ là số, không phải đánh giá. Dựng bằng:');
    console.error('    node scripts/qa/release_summary.js --init --task <TASK_KEY>');
    process.exit(ENFORCE ? 1 : 2);
  }
  let tc;
  try { tc = JSON.parse(fs.readFileSync(d.tieuChi, 'utf8')); } catch (e) {
    console.error(`[release-summary] ✗ exit_criteria.json HỎNG JSON: ${e.message}`);
    process.exit(1);
  }
  if (!fs.existsSync(d.status)) {
    console.error('[release-summary] ✗ TỪ CHỐI — chưa có `test-results/testcase-status.json`, nên chưa có gì để đối chiếu.');
    process.exit(ENFORCE ? 1 : 2);
  }

  /*
   * ① phần hai — TIÊU CHÍ CHỐT SAU KẾT QUẢ. Đây là luật đáng giá nhất của A và cũng là luật dễ lách
   * nhất: chỉ cần mở file tiêu chí ra hạ một ngưỡng là báo cáo "đạt". So mtime bắt được đúng việc đó.
   */
  const mTc = fs.statSync(d.tieuChi).mtimeMs;
  const mSt = fs.statSync(d.status).mtimeMs;
  if (mTc > mSt) {
    console.error('[release-summary] ✗ TỪ CHỐI — `exit_criteria.json` MỚI HƠN `testcase-status.json`.');
    console.error(`    tiêu chí: ${new Date(mTc).toISOString()}`);
    console.error(`    kết quả : ${new Date(mSt).toISOString()}`);
    console.error('  Tiêu chí sửa SAU khi có kết quả là hợp thức hoá kết quả, không phải đánh giá — đừng sửa ngưỡng.');
    console.error('  PO chấp nhận một tiêu chí không đạt thì ghi `release_exception` vào knowledge/decisions/ (skill');
    console.error('  `decision_recorder`) — KHÔNG ghi vào file này: sửa file này sau kết quả thì chính luật này từ chối.');
    process.exit(ENFORCE ? 1 : 2);
  }

  const st = JSON.parse(fs.readFileSync(d.status, 'utf8'));
  const tests = Array.isArray(st.tests) ? st.tests : [];
  const by = new Map();
  for (const t of tests) by.set(chuanHoa(t.status), (by.get(chuanHoa(t.status)) || 0) + 1);
  const n = tests.length;
  const pass = (by.get('PASS') || 0) + (by.get('PASS_WITH_DEVIATION') || 0);
  const fail = by.get('FAIL') || 0;
  const blocked = by.get('BLOCKED_SETUP') || 0;
  const skip = (by.get('SKIP') || 0) + (by.get('SKIP_SETUP') || 0);
  /* ③ BLOCKED/SKIP KHÔNG tính là PASS, và cũng KHÔNG tính vào "đã chạy". */
  const daChay = pass + fail;

  console.log(`[release-summary] ${st.taskKey || arg('task') || '(không rõ task)'} — ĐỀ XUẤT, không phải quyết định`);
  if (tc.laMacDinh !== false) {
    console.log('  ⚠ Bộ tiêu chí đang dùng là MẶC ĐỊNH CỦA AGENT, chưa có người xác nhận. PM phải xác nhận hoặc thay bằng tiêu chí dự án.');
  } else {
    console.log(`  Bộ tiêu chí của dự án · xác nhận bởi ${tc.nguoiXacNhan || '(thiếu tên)'} ${tc.ngayXacNhan || ''}`);
  }

  /* ② VÙNG CHƯA TEST — in TRƯỚC mọi tỉ lệ. */
  console.log('\n— Vùng CHƯA TEST (đọc trước mọi tỉ lệ) —');
  const idStatus = new Set(tests.map((t) => String(t.tcId || '')).filter(Boolean));
  let idTrace = new Set();
  if (fs.existsSync(d.trace)) {
    const raw = fs.readFileSync(d.trace, 'utf8');
    /*
     * Tiền tố là TUỲ CHỌN: bản đầu đòi `PREFIX_TC_123` (khuôn của dự án này, `APP_HS_TC_001`) nên nó bỏ
     * sót mọi bộ dùng `TC_123` trần — và lớp GENERIC thì không được khoá vào khuôn tên của một dự án.
     */
    idTrace = new Set([...raw.matchAll(/\b(?:[A-Z][A-Z0-9_]*_)?TC_\d+\b/g)].map((m) => m[0]));
  }
  const chuaChay = [...idTrace].filter((x) => !idStatus.has(x));
  if (!idTrace.size) {
    console.log('  KHÔNG đo được: chưa có `reports/traceability-matrix.md` để biết tập TC đầy đủ. Đây không phải "đã test hết".');
  } else if (chuaChay.length) {
    console.log(`  ${chuaChay.length}/${idTrace.size} TC trong traceability KHÔNG có trong kết quả ⇒ chưa từng chạy.`);
    console.log(`    ${chuaChay.slice(0, 8).join(' · ')}${chuaChay.length > 8 ? ` … +${chuaChay.length - 8}` : ''}`);
  } else {
    console.log(`  Mọi TC trong traceability (${idTrace.size}) đều có kết quả.`);
  }
  if (blocked || skip) console.log(`  Thêm vào đó: ${blocked} BLOCKED và ${skip} SKIP KHÔNG tính là đã chạy, nên mẫu số thật là ${daChay}/${n}.`);

  /* Đối chiếu HAI NGUỒN SỐ. */
  console.log('\n— Đối chiếu nguồn số —');
  if (idTrace.size && idTrace.size !== n) {
    console.log(`  ✗ LỆCH: traceability-matrix có ${idTrace.size} TC, testcase-status có ${n}. Hai nguồn không khớp thì KHÔNG được chọn một cái rồi báo như sự thật duy nhất.`);
  }
  const mTrace = /execute:\s*(\d+)/.exec(fs.existsSync(d.trace) ? fs.readFileSync(d.trace, 'utf8') : '');
  if (mTrace && Number(mTrace[1]) !== daChay) {
    console.log(`  ✗ LỆCH: traceability-matrix ghi "execute: ${mTrace[1]}", testcase-status cho ${daChay} case đã chạy. Một trong hai đã cũ — sinh lại traceability trước khi báo cáo.`);
  }
  if ((!idTrace.size || idTrace.size === n) && !(mTrace && Number(mTrace[1]) !== daChay)) {
    console.log('  Không thấy lệch giữa các nguồn đọc được.');
  }

  /* Manual vs automation. */
  console.log('\n— Manual và automation —');
  const pre = Array.isArray(tc.manualRunIdPrefix) ? tc.manualRunIdPrefix.filter(Boolean) : [];
  if (!pre.length) {
    console.log('  KHÔNG tách được: `runId` trong testcase-status là chuỗi TỰ DO nên máy không biết lượt nào chạy tay.');
    console.log('    Khai `manualRunIdPrefix` trong exit_criteria.json để tách. Không khai thì báo cáo KHÔNG được nói "automation N%".');
  } else {
    const laManual = (t) => pre.some((p) => String(t.runId || '').startsWith(p));
    const m = tests.filter(laManual).length;
    console.log(`  manual ${m} case · automation ${n - m} case (theo tiền tố ${pre.join(', ')}).`);
  }

  /* ② Bảng tiêu chí. */
  console.log('\n— Đối chiếu tiêu chí exit —');
  const ds = Array.isArray(tc.tieuChi) && tc.tieuChi.length ? tc.tieuChi : MAC_DINH;
  const nguonCo = {
    status: true,
    priority: tests.some((t) => t.priority !== undefined),
    module: tests.some((t) => t.module !== undefined),
    req: idTrace.size > 0,
    'knowledge/bugs': (() => { try { return fs.readdirSync(path.join(REPO, 'knowledge/bugs')).some((f) => f.endsWith('.json')); } catch { return false; } })(),
  };
  let khongDo = 0;
  let khongDat = 0;
  /*
   * Mã task lấy từ ĐƯỜNG DẪN thư mục task: `getTaskOutputDir()` đã giải xong mọi nguồn (env, --task,
   * TASK_ENV), nên tên thư mục cuối chính là mã task đã được giải.
   */
  const maTask = path.basename(d.taskOut);
  const nl = ngoaiLePhatHanh(maTask);
  /* Tiêu chí KHÔNG ĐẠT nhưng PO đã chấp nhận kèm giảm thiểu — nguồn của CONCERNS. */
  const daChapNhan = [];
  for (const c of ds) {
    const co = nguonCo[c.nguon];
    let kq;
    let so = '';
    if (!co) {
      kq = 'KHÔNG ĐO ĐƯỢC';
      so = `thiếu nguồn \`${c.nguon}\``;
      khongDo += 1;
    } else if (c.id === 4) {
      const r = daChay ? pass / daChay : 0;
      so = `${(100 * r).toFixed(1)}% (${pass}/${daChay} đã chạy)`;
      kq = r >= 0.9 ? 'Đạt' : 'Không đạt';
    } else if (c.id === 5) {
      const r = n ? blocked / n : 0;
      so = `${(100 * r).toFixed(1)}% (${blocked}/${n})`;
      kq = r <= 0.05 ? 'Đạt' : 'Không đạt';
    } else {
      kq = 'KHÔNG ĐO ĐƯỢC';
      so = 'chưa có phép đo trong kit';
      khongDo += 1;
    }
    /*
     * NGOẠI LỆ CHỈ ÁP CHO "Không đạt" — tức rủi ro ĐÃ ĐO, đã biết lớn cỡ nào. Không áp cho "KHÔNG ĐO
     * ĐƯỢC": chấp nhận một thứ chưa ai đo là biến "không phán được" thành đạt (CLAUDE.md §3).
     */
    const nx = nl.hopLe.get(c.id);
    let ghiChuNx = '';
    if (nx && kq === 'Không đạt') {
      kq = 'Đạt có ĐK';
      daChapNhan.push({ c, nx, so });
      ghiChuNx = ` · CHẤP NHẬN bởi PO (${nx.id}), hết hạn ${nx.expires_at}`;
    } else if (nx && kq === 'KHÔNG ĐO ĐƯỢC') {
      ghiChuNx = ` · ngoại lệ ${nx.id} KHÔNG áp: không chấp nhận được thứ chưa đo`;
    }
    if (kq === 'Không đạt') khongDat += 1;
    const ghiTay = String(c.ngoaiLe || '').trim();
    console.log(`  ${String(c.id).padStart(2)} ${kq.padEnd(14)} ${c.ten} (ngưỡng ${c.nguong}) — ${so}${ghiTay ? ` · NGOẠI LỆ: ${ghiTay}` : ''}${ghiChuNx}`);
  }
  for (const b of nl.boQua) console.log(`  ⚠ ngoại lệ ${b.id} BỊ BỎ QUA — ${b.vi_sao}. Nó KHÔNG hạ đề xuất.`);

  /*
   * ĐÃ VƯỢT QUA (§A8) — mọi miễn trừ CÒN HIỆU LỰC ở mốc này.
   *
   * Không có mục này thì miễn trừ thành vô hình ở đúng chỗ nó cần được thấy nhất: báo cáo phát hành.
   * Một tiêu chí "đạt" nhờ ba miễn trừ khác hẳn một tiêu chí đạt thật, và người đọc báo cáo phải phân
   * biệt được hai thứ đó.
   *
   * Nó KHÔNG đổi đề xuất go/no-go: miễn trừ là quyết định đã có người chịu trách nhiệm, nên hạ đề xuất
   * vì nó là phủ quyết lại người đã quyết. Nhưng nó phải CÓ MẶT. Nó cũng KHÔNG thành CONCERNS (chốt
   * 16/11/2026): CONCERNS đòi "có người chịu VÀ có cách giảm thiểu", mà sổ miễn trừ gate không có ô giảm
   * thiểu. Dòng ĐỀ XUẤT GO vẫn nêu số miễn trừ, để "đạt nhờ miễn trừ" không đọc được thành "đạt thật".
   *
   * ĐO 16/11/2026: mục này CHƯA TỪNG chạy được. Nó tham chiếu `p.taskOut` trong khi biến của `main()` là
   * `d`, nên luôn rơi vào nhánh `catch` và in "KHÔNG đọc được sổ miễn trừ (p is not defined)". Không spec
   * nào phủ mục này — giờ có.
   */
  console.log('\n— Đã vượt qua (miễn trừ T1 còn hiệu lực) —');
  let soMienTru = 0;
  const mienTru = [];
  try {
    const ov = require(path.join(__dirname, 'override.js'));
    const ds = ov.dangHieuLuc(maTask, { dir: DIR_DECISIONS });
    mienTru.push(...ds);
    if (!ds.length) {
      console.log('  không có miễn trừ nào còn hiệu lực.');
    } else {
      for (const m of ds) {
        console.log(`  ${m.ma} · ${m.tc_ids.join(', ')} · ${m.by} · hết hạn ${m.het_han} · ${m.id}`);
        console.log(`    ${String(m.ly_do).slice(0, 110)}`);
      }
      console.log('  Một tiêu chí "đạt" nhờ miễn trừ KHÁC một tiêu chí đạt thật. Hết hạn thì gate chặn lại.');
    }
  } catch (e) {
    /*
     * Đọc được hay không thì cũng phải NÓI RA. Im lặng ở đây nghĩa là báo cáo phát hành khai "không có
     * miễn trừ nào" trong khi thực ra nó chưa đọc được sổ.
     */
    console.log(`  KHÔNG đọc được sổ miễn trừ (${e.message}) — đây KHÔNG phải "không có miễn trừ nào".`);
    soMienTru = null;
  }

  /*
   * ④ ĐỀ XUẤT, không quyết. BA nhãn:
   *   NO-GO    — còn tiêu chí không đạt CHƯA ai chấp nhận, tiêu chí không đo được, TC chưa chạy, hoặc
   *              không đọc được sổ miễn trừ (không đọc được thì không khẳng định được "không có gì bị che").
   *   CONCERNS — không còn lý do NO-GO nào, nhưng có tiêu chí KHÔNG ĐẠT mà PO đã chấp nhận kèm cách giảm
   *              thiểu (`release_exception`). Liệt kê từng cái kèm người chịu, giảm thiểu, hạn.
   *   GO       — mọi tiêu chí đạt. Miễn trừ gate còn hiệu lực KHÔNG đổi nhãn này (xem mục "Đã vượt qua"),
   *              nhưng dòng GO phải nêu số của chúng.
   * CONCERNS chỉ thay NO-GO ở ĐÚNG tiêu chí đã được chấp nhận. Không có đường nào để "không đo được" hay
   * "chưa chạy" thành CONCERNS.
   */
  console.log('\n— ĐỀ XUẤT —');
  const ly = [];
  if (khongDat) ly.push(`${khongDat} tiêu chí KHÔNG ĐẠT`);
  if (khongDo) ly.push(`${khongDo} tiêu chí KHÔNG ĐO ĐƯỢC (và "không đo được" KHÔNG thành đạt)`);
  if (chuaChay.length) ly.push(`${chuaChay.length} TC chưa từng chạy`);
  if (soMienTru === null) ly.push('KHÔNG đọc được sổ miễn trừ (không khẳng định được không có gì đang bị che)');
  if (ly.length) {
    console.log(`  ĐỀ XUẤT: NO-GO — ${ly.join(' · ')}.`);
    if (daChapNhan.length) console.log(`  (${daChapNhan.length} tiêu chí đã được PO chấp nhận — chúng không phải lý do NO-GO, nhưng không cứu được các lý do trên.)`);
    console.log('  Đây là KHUYẾN NGHỊ. Quyết định release là của PM/PO: họ cân thêm áp lực thị trường, hợp đồng, chi phí trễ hạn mà QA không nắm.');
  } else if (daChapNhan.length) {
    console.log(`  ĐỀ XUẤT: CONCERNS — đạt, nhưng ${daChapNhan.length} tiêu chí đạt NHỜ PO chấp nhận rủi ro.`);
    for (const x of daChapNhan) {
      console.log(`    · tiêu chí ${x.c.id} ${x.c.ten}: ${x.so}`);
      console.log(`      người chịu: PO (${x.nx.id}) · hết hạn ${x.nx.expires_at}`);
      console.log(`      giảm thiểu: ${String(x.nx.mitigation).trim().slice(0, 160)}`);
    }
    if (mienTru.length) console.log(`  Kèm ${mienTru.length} miễn trừ gate còn hiệu lực (xem "Đã vượt qua").`);
    console.log('  CONCERNS KHÔNG phải GO: phát hành được nếu PM/PO đồng ý mang theo đúng các rủi ro trên. Hết hạn thì chúng thôi che.');
  } else {
    console.log(`  ĐỀ XUẤT: GO — mọi tiêu chí đo được đều đạt, không có vùng chưa test${mienTru.length ? ` · kèm ${mienTru.length} miễn trừ gate còn hiệu lực (xem "Đã vượt qua")` : ''}.`);
    console.log('  Vẫn là KHUYẾN NGHỊ, không phải quyết định.');
  }

  console.log(ENFORCE ? '\n[release-summary] ✓ ĐẠT — tiêu chí có mặt và được chốt TRƯỚC kết quả. (Khuyến nghị go/no-go ở trên KHÔNG quyết định exit code.)' : '\nChặn được bằng: npm run release:summary:enforce');
  process.exit(0);
}

module.exports = { MAC_DINH };
if (require.main === module) main();
