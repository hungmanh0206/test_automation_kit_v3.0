#!/usr/bin/env node
/**
 * `env:scope` — MỖI PROFILE PHẢI GHIM CẤP HỌC NÓ ĐANG ĐO, VÀ BÍ MẬT CHẾT PHẢI BỊ GỌI TÊN.
 *
 * Dùng: node scripts/qa/env_scope_check.js [--root <thư mục>] [--soi]
 *   exit 0 = đạt · 1 = vi phạm · 2 = KHÔNG PHÁN ĐƯỢC (thiếu thứ để đo)
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ① THIẾU `QEMIS_CAP_HOC` THÌ APP LẶNG LẼ VỀ "MẦM NON"
 *
 * Neo là mã, không phải suy đoán — `tests/fe/support/opsLogin.ts:419`:
 *
 *     console.warn('[qemis] QEMIS_CAP_HOC chưa khai ⇒ giữ mặc định của app ("Mầm non"). ...')
 *
 * Một `console.warn`. Lượt chạy KHÔNG gãy: nó đăng nhập được, đi hết các bước, chụp đủ ảnh, và chấm
 * PASS — trên một cấp học KHÔNG phải cấp mà case nói tới. Đo 03/11/2026: `profiles/CSDL-4039` (EMIS
 * **THCS**) và `profiles/CSDL-3544` không ghim khoá này.
 *
 * Đây đúng lớp hỏng cả đợt v2.9.8–v2.9.10 đi chữa: một lượt không đo được thứ nó tưởng đang đo, mà vẫn
 * trả về thứ trông như một kết quả. Chỉ khác là lần này "thứ trông như kết quả" là cả một bộ verdict.
 *
 * ② BÍ MẬT KHÔNG ĐƯỜNG NÀO ĐỌC TỚI
 *
 * `uatDbClient.ts` đọc theo khuôn `<TIEN_TO>_<HAU_TO>` (HOST/PORT/NAME/USERNAME/PASSWORD/SSL/...).
 * Một khoá tên `LIB_MASTER_DB_RO_USERNAME_ADMIN` KHÔNG khớp khuôn ấy — muốn đọc được thì phải là
 * `LIB_MASTER_DB_RO_ADMIN_USERNAME`. Bí mật không ai đọc được là rủi ro thuần: vẫn lộ được, mà không
 * đổi lấy gì. Thêm nữa, một tài khoản **ADMIN** nằm dưới tiền tố **RO** đi ngược CLAUDE.md §2
 * ("DB chỉ UAT read-only").
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ĐIỀU CỬA NÀY CỐ Ý **KHÔNG** ĐÒI, và vì sao — bản đầu của nó đòi, và đã TỐ OAN 7/8 profile.
 *
 * Bản đầu bắt mỗi profile tự khai `OPS_USERNAME`/`OPS_PASSWORD`, dựa trên câu "creds ở task.env" trong
 * CLAUDE.md §5. Chạy thật thì nó tố 7 trong 8 profile — và khi một cửa mới tố gần như toàn bộ hiện
 * trạng, giả thuyết đầu tiên phải là CỬA SAI, không phải hiện trạng sai.
 *
 * Đo bằng `--soi`: cả 8 profile đều ghim `QEMIS_SO` + `QEMIS_TRUONG`. Cộng với
 * `reference_qemis_master_root_isolation` (một tài khoản đổi được Sở/cấp/trường qua
 * `/Manage/ChonTruong.aspx`), thiết kế thật là: MỘT tài khoản ở `.env` chung + mỗi profile tự ghim
 * ĐƠN VỊ. Đó là thiết kế hợp lý, và `.env` giữ tài khoản ấy KHÔNG phải lệch.
 *
 * Nên ràng buộc đúng không nằm ở chỗ ĐỂ bí mật, mà ở chỗ profile có ghim nổi CẤP HỌC nó đo hay không.
 * Một cửa tố oan gần hết hiện trạng thì tệ hơn không có cửa — vì người ta sẽ tắt nó.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * CỬA NÀY KHÔNG BAO GIỜ IN GIÁ TRỊ. Chỉ in TÊN khoá và tên file. Nó gác chỗ để bí mật, nên bản thân
 * nó mà rò thì tự phản lại mục đích — và log CI thì ai đọc được repo cũng xem được. Có một ca test
 * riêng khai đúng điều này (`tests/fe/infra/env-scope.spec.ts`).
 *
 * KHÔNG CÓ GÌ ĐỂ ĐO THÌ NÓI THẾ, exit 2 — không trả 0. Trong cây-gói phát hành không có `profiles/`
 * lẫn `.env`; cửa ⑩ của `version_check.js` từng trả "đạt" trong hoàn cảnh y hệt và làm `release:verify`
 * đọc thành 13/15. Một cửa thà im còn hơn đoán.
 */
const fs = require('fs');
const path = require('path');

/*
 * CỐ Ý KHÔNG `require('../utils/runtime_config.js')` dù nó có sẵn `REPO_ROOT`.
 *
 * File đó gọi `loadEnvFiles()` ngay lúc nạp module, tức require nó là KÉO TOÀN BỘ `.env` thật vào
 * `process.env` của tiến trình này. Một cửa có việc duy nhất là gác chỗ để bí mật thì không nên tự nạp
 * bí mật vào mình — nhất là trong lượt test, nơi nó bị chạy hàng chục lần với `--root` trỏ vào fixture.
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Thiếu thì app LẶNG LẼ về "Mầm non" (opsLogin.ts:419) ⇒ CHẶN. */
const PHAI_GHIM = ['QEMIS_CAP_HOC'];

/** Thiếu thì app giữ mặc định của nó, có cảnh báo ở runtime (opsLogin.ts:412) ⇒ chỉ cảnh báo. */
const NEN_GHIM = ['QEMIS_NAM_HOC'];

/** Hậu tố hợp lệ của khuôn `<TIEN_TO>_<HAU_TO>` mà `uatDbClient.ts` đọc. */
const HAU_TO_DB = ['HOST', 'PORT', 'NAME', 'USERNAME', 'PASSWORD', 'SSL', 'ALLOWED_HOSTS', 'DENY_HOST_PATTERNS', 'STATEMENT_TIMEOUT_MS'];
const TIEN_TO_DB = 'LIB_MASTER_DB_RO';

function cho(ten) {
  const i = process.argv.indexOf(ten);
  return i >= 0 ? process.argv[i + 1] : null;
}

/*
 * `--root` SAI ĐƯỜNG THÌ NÉM, không lặng lẽ lùi về gốc repo.
 *
 * Lùi là chỗ phép thử tự rỗng: lượt đối chứng gõ sai một ký tự thì nó đo CÂY THẬT, kết quả trông vẫn
 * hợp lý, và người đọc kết luận "fixture này không bắt được gì" trong khi fixture chưa bao giờ được đo.
 * Cùng bài với `tests/fe/infra/_may_thu.ts`.
 */
const rootCho = cho('--root');
if (rootCho && !fs.existsSync(path.resolve(rootCho))) {
  console.error(`[env-scope] --root="${rootCho}" không tồn tại. NÉM thay vì lùi về gốc repo:`);
  console.error('            lùi thì lượt đối chứng đo nhầm cây thật và phép thử tự rỗng.');
  process.exit(2);
}
const GOC = path.resolve(rootCho || REPO_ROOT);

/** Trả Set TÊN khoá trong một file env. Không giữ, không trả, không in giá trị. */
function tenKhoa(duong) {
  if (!fs.existsSync(duong)) return null;
  let noiDung = '';
  try {
    noiDung = fs.readFileSync(duong, 'utf8');
  } catch (e) {
    return null;
  }
  const ten = new Set();
  for (const dong of noiDung.split(/\r?\n/)) {
    const t = dong.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    ten.add(t.slice(0, i).trim().replace(/^export\s+/, ''));
  }
  return ten;
}

const khoaEnv = tenKhoa(path.join(GOC, '.env'));
const thuMucProfile = path.join(GOC, 'profiles');

let profile = [];
if (fs.existsSync(thuMucProfile)) {
  profile = fs.readdirSync(thuMucProfile, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ task: e.name, duong: path.join(thuMucProfile, e.name, 'task.env') }))
    .filter((p) => fs.existsSync(p.duong));
}

if (!khoaEnv && profile.length === 0) {
  console.log('[env-scope] KHÔNG PHÁN ĐƯỢC — không có `.env` lẫn `profiles/<TASK>/task.env` ở ' + GOC);
  console.log('            Đây là trạng thái BÌNH THƯỜNG của cây-gói phát hành và của CI. Cửa này đo chỗ');
  console.log('            ĐỂ credential trên máy người chạy, nên không có file thì nó im — KHÔNG trả "đạt".');
  process.exit(2);
}

/*
 * `--soi` — chế độ ĐO, không phán. In mỗi profile khai những khoá neo nào, để chọn luật dựa trên số đo
 * chứ không dựa trên điều mình tưởng. Chính chế độ này bác bản luật đầu của cửa. Vẫn chỉ in TÊN khoá.
 */
if (process.argv.includes('--soi')) {
  const NEO = ['OPS_USERNAME', 'OPS_PASSWORD', 'QEMIS_SO', 'QEMIS_CAP_HOC', 'QEMIS_TRUONG', 'QEMIS_PHUONG_XA', 'QEMIS_NAM_HOC'];
  console.log(`[soi] .env chung khai: ${NEO.filter((x) => khoaEnv && khoaEnv.has(x)).join(', ') || '(không có khoá neo nào)'}`);
  for (const p of profile) {
    const k = tenKhoa(p.duong) || new Set();
    console.log(`[soi] ${p.task.padEnd(12)} ${NEO.filter((x) => k.has(x)).join(', ') || '(không khai khoá neo nào)'}`);
  }
  process.exit(0);
}

const loi = [];
const canhBao = [];

/* ① Mỗi profile phải ghim cấp học nó đang đo. */
if (profile.length === 0) {
  canhBao.push('không có profile nào để kiểm — có `.env` nhưng `profiles/` trống');
} else {
  for (const p of profile) {
    const k = tenKhoa(p.duong);
    if (!k) { canhBao.push(`${p.task}: không đọc được task.env`); continue; }

    const thieuNang = PHAI_GHIM.filter((x) => !k.has(x));
    if (thieuNang.length) {
      loi.push(
        `profiles/${p.task}/task.env THIẾU ${thieuNang.join(', ')}`
        + ' — app sẽ lặng lẽ giữ mặc định "Mầm non" (opsLogin.ts:419) và lượt chạy vẫn XANH trên'
        + ' cấp học KHÔNG phải cấp mà case nói tới.',
      );
    }

    const thieuNhe = NEN_GHIM.filter((x) => !k.has(x));
    if (thieuNhe.length) {
      canhBao.push(
        `profiles/${p.task}/task.env thiếu ${thieuNhe.join(', ')} ⇒ giữ mặc định của app;`
        + ' runtime có cảnh báo (opsLogin.ts:412) nên không âm thầm, nhưng ID_TRUONG đổi theo năm học.',
      );
    }
  }
}

/* ② Bí mật không đường nào đọc tới. */
if (khoaEnv) {
  for (const ten of khoaEnv) {
    if (!ten.startsWith(`${TIEN_TO_DB}_`)) continue;
    const hauTo = ten.slice(TIEN_TO_DB.length + 1);
    if (HAU_TO_DB.includes(hauTo)) continue;
    loi.push(
      `\`.env\` có \`${ten}\` — KHÔNG khớp khuôn \`<TIEN_TO>_<HAU_TO>\` mà uatDbClient.ts đọc`
      + ` (hậu tố hợp lệ: ${HAU_TO_DB.join(', ')}), nên không đường nào chạm tới nó.`
      + ' Bí mật không ai đọc được là rủi ro thuần — rotate rồi xoá.',
    );
  }
}

for (const c of canhBao) console.log('[env-scope] ⚠ ' + c);

if (loi.length === 0) {
  console.log(`[env-scope] ✓ ĐẠT — ${profile.length} profile đều ghim ${PHAI_GHIM.join(' + ')}; không thấy bí mật chết.`);
  process.exit(0);
}

console.error(`[env-scope] ✗ ${loi.length} vấn đề:`);
for (const l of loi) console.error('  - ' + l);
console.error('');
console.error('  Vì sao CHẶN chứ không cảnh báo: thiếu cấp học thì lượt chạy không gãy — nó đăng nhập');
console.error('  được, đi hết các bước, chụp đủ ảnh, và chấm PASS trên cấp sai. Xem USER_GUIDE muc 2.2.');
process.exitCode = 1;
