#!/usr/bin/env node
/**
 * tao_issue_con.js — tạo MỘT issue con (Task / Request / Other) dưới một issue cha.
 *
 * VÌ SAO CẦN RIÊNG. `bug_reporter.js` chỉ sinh **Sub-bug** từ case Playwright ĐỎ: nó đọc `results.json`,
 * đòi evidence ảnh/video, và chính gate của nó CẤM khai việc-cần-làm thành bug. Yêu cầu cải tiến giao
 * diện do chủ dự án nêu không có case đỏ nào, nên không đi qua đường đó được — mà cũng không nên đi,
 * vì khai nhầm loại làm hỏng thống kê bug.
 *
 * Dùng:
 *   node scripts/integrations/backlog/tao_issue_con.js \
 *     --parent CSDL-4008 --type Task --tieu-de "..." --mo-ta-file <đường dẫn .txt> [--dry-run]
 *
 * KHÔNG in apiKey. `--dry-run` in payload rồi dừng, không gọi API.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
require(path.resolve(REPO, 'scripts', 'utils', 'runtime_config'));

const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.BACKLOG_API_KEY || '');

const argv = process.argv.slice(2);
const arg = (t, md = '') => {
  const i = argv.indexOf(`--${t}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : md;
};
const co = (t) => argv.includes(`--${t}`);

const PARENT = arg('parent');
const TYPE = arg('type', 'Task');
const TIEU_DE = arg('tieu-de');
const MO_TA_FILE = arg('mo-ta-file');
const SUA = arg('update');           // issueKey cần ghi đè mô tả, thay vì tạo mới
const ANH = argv.filter((x, i) => argv[i - 1] === '--anh'); // lặp --anh <file> nhiều lần
const KHO = co('dry-run');

if (!BASE || !KEY) { console.error('[ERROR] thiếu BACKLOG_BASE_URL / BACKLOG_API_KEY'); process.exit(2); }
if (!SUA && (!PARENT || !TIEU_DE)) { console.error('[ERROR] tạo mới cần --parent và --tieu-de'); process.exit(2); }
if (!MO_TA_FILE) { console.error('[ERROR] cần --mo-ta-file'); process.exit(2); }
if (!fs.existsSync(MO_TA_FILE)) { console.error(`[ERROR] không thấy file mô tả: ${MO_TA_FILE}`); process.exit(2); }
for (const a of ANH) if (!fs.existsSync(a)) { console.error(`[ERROR] không thấy ảnh: ${a}`); process.exit(2); }

const MO_TA = fs.readFileSync(MO_TA_FILE, 'utf8');

async function api(method, duongDan, form) {
  const u = new URL(`${BASE}${duongDan}`);
  u.searchParams.set('apiKey', KEY);
  const opt = { method, headers: {} };
  if (form) {
    opt.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opt.body = new URLSearchParams(form).toString();
  }
  const r = await fetch(u, opt);
  const chu = await r.text();
  if (!r.ok) throw new Error(`${method} ${duongDan} → HTTP ${r.status}: ${chu.slice(0, 400)}`);
  return JSON.parse(chu);
}

/**
 * Tải ảnh lên kho đính kèm của space rồi trả `id` để gắn vào issue.
 *
 * Backlog tách hai bước: `POST /space/attachment` (multipart) chỉ TẢI LÊN, sau đó `PATCH issue` với
 * `attachmentId[]` mới gắn vào. `attachmentId[]` được coi là THAY THẾ cả bộ đính kèm hiện có, nên chỉ
 * dùng khi issue chưa có ảnh nào, hoặc phải gửi lại đủ id cũ.
 */
async function taiAnh(duongDan) {
  const u = new URL(`${BASE}/api/v2/space/attachment`);
  u.searchParams.set('apiKey', KEY);
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(duongDan)]), path.basename(duongDan));
  const r = await fetch(u, { method: 'POST', body: fd });
  const chu = await r.text();
  if (!r.ok) throw new Error(`tải ảnh ${path.basename(duongDan)} → HTTP ${r.status}: ${chu.slice(0, 300)}`);
  const j = JSON.parse(chu);
  console.log(`[OK] tải lên "${j.name}" (id ${j.id}, ${fs.statSync(duongDan).size} byte)`);
  return j.id;
}

(async () => {
  /* ── Chế độ SỬA: ghi đè mô tả của issue đã có, kèm đính ảnh. Không xoá issue, không tạo trùng. ── */
  if (SUA) {
    const cu = await api('GET', `/api/v2/issues/${SUA}`);
    console.log(`[OK] issue ${SUA}: "${cu.summary}" · đính kèm hiện có: ${(cu.attachments || []).length}`);
    console.log(`\n── mô tả mới (${MO_TA.length} ký tự) ──\n${MO_TA}`);
    console.log(`── ảnh đính kèm: ${ANH.map((x) => path.basename(x)).join(' · ') || '(không có)'}`);
    if (KHO) { console.log('\n[DRY-RUN] dừng, KHÔNG gọi API.'); return; }
    const form = { description: MO_TA };
    if (TIEU_DE) form.summary = TIEU_DE;
    const ids = [];
    for (const a of ANH) ids.push(await taiAnh(a));
    if (ids.length) {
      /* Giữ ảnh cũ: gửi lại id cũ kèm id mới, vì `attachmentId[]` thay thế cả bộ. */
      for (const c of (cu.attachments || [])) ids.unshift(c.id);
      form['attachmentId[]'] = ids;
    }
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
      else sp.append(k, String(v));
    }
    const u = new URL(`${BASE}/api/v2/issues/${SUA}`);
    u.searchParams.set('apiKey', KEY);
    const r = await fetch(u, { method: 'PATCH', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: sp.toString() });
    const chu = await r.text();
    if (!r.ok) throw new Error(`PATCH ${SUA} → HTTP ${r.status}: ${chu.slice(0, 400)}`);
    const j = JSON.parse(chu);
    console.log(`\n[OK] đã cập nhật ${j.issueKey} · đính kèm sau khi sửa: ${(j.attachments || []).length} — ${BASE}/view/${j.issueKey}`);
    return;
  }

  /* Cha quyết định project và nơi treo issue con — đọc cha trước, đừng đoán projectId. */
  const cha = await api('GET', `/api/v2/issues/${PARENT}`);
  console.log(`[OK] cha ${PARENT}: "${cha.summary}" · projectId ${cha.projectId} · loại "${cha.issueType?.name}"`);

  const loai = await api('GET', `/api/v2/projects/${cha.projectId}/issueTypes`);
  const t = loai.find((x) => String(x.name).toLowerCase() === TYPE.toLowerCase());
  if (!t) {
    console.error(`[ERROR] không có loại "${TYPE}". Loại thật có: ${loai.map((x) => x.name).join(' · ')}`);
    process.exit(2);
  }

  const uuTien = await api('GET', '/api/v2/priorities');
  const p = uuTien.find((x) => /normal|trung/i.test(x.name)) || uuTien[Math.floor(uuTien.length / 2)];

  const form = {
    projectId: cha.projectId,
    summary: TIEU_DE,
    issueTypeId: t.id,
    priorityId: p.id,
    parentIssueId: cha.id,
    description: MO_TA,
  };
  if (cha.assignee?.id) form.assigneeId = cha.assignee.id;

  console.log(`\n── payload ──\nloại: ${t.name} (${t.id}) · ưu tiên: ${p.name} (${p.id}) · cha: ${PARENT} (${cha.id})`
    + `${form.assigneeId ? ` · người nhận: ${cha.assignee.name} (${form.assigneeId})` : ' · người nhận: (không gán)'}`);
  console.log(`tiêu đề: ${TIEU_DE}`);
  console.log(`mô tả (${MO_TA.length} ký tự):\n${MO_TA}`);

  console.log(`ảnh đính kèm: ${ANH.map((x) => path.basename(x)).join(' · ') || '(không có)'}`);
  if (KHO) { console.log('\n[DRY-RUN] dừng ở đây, KHÔNG gọi API tạo issue.'); return; }

  /*
   * ĐÍNH ẢNH NGAY TRONG LƯỢT TẠO — nhánh này trước đây BỎ QUA `--anh` hoàn toàn và không báo gì.
   * Hậu quả đo 27/10: CSDL-4089 tạo xong, log in ra "đã tạo" như bình thường, nhưng issue có 0 tệp và
   * dòng `![image][...]` trong mô tả trỏ vào hư không — chủ dự án mở ra mới thấy bug không có evidence.
   * Nhánh `--update` vốn đã làm đúng; chỗ thiếu chỉ ở nhánh tạo.
   */
  const ids = [];
  for (const a of ANH) ids.push(await taiAnh(a));
  if (ids.length) form['attachmentId[]'] = ids;

  const moi = await api('POST', '/api/v2/issues', form);
  console.log(`\n[OK] đã tạo ${moi.issueKey} — ${BASE}/view/${moi.issueKey}`);
  /* Sổ tác giả ở máy QA (không đánh dấu trên Backlog — chủ dự án không muốn thấy dấu của kit trong mô tả bug). */
  require(path.join(__dirname, '..', '..', 'qa', 'bug_tac_gia.js')).ghi({ issueKey: moi.issueKey, qua: 'tao_issue_con' }, { base: BASE });

  /* NGHIỆM THU bằng cách đọc lại từ server, không tin mã trả về của lượt POST: `attachmentId[]` sai
   * kiểu thì Backlog vẫn trả 201 kèm issue không có tệp nào. */
  const lai = await api('GET', `/api/v2/issues/${moi.issueKey}`);
  const soTep = (lai.attachments || []).length;
  console.log(`[OK] đính kèm sau khi tạo: ${soTep}/${ANH.length}`);
  if (ANH.length && soTep < ANH.length) {
    console.error(`[ERROR] ${moi.issueKey} thiếu ${ANH.length - soTep} ảnh — mô tả đang nhúng ảnh không tồn tại.`
      + ` Chạy lại: --update ${moi.issueKey} --mo-ta-file <file> --anh <ảnh>`);
    /*
     * `process.exitCode` CHỨ KHÔNG `process.exit()` — đo 03/11/2026 trên Windows.
     *
     * `process.exit(1)` ngay sau `fetch` làm libuv sụp: `Assertion failed: !(handle->flags &
     * UV_HANDLE_CLOSING), file src\win\async.c, line 94` ⇒ `abort()` ⇒ mã thoát `3221226505`
     * (0xC0000409), KHÔNG phải `1`. Script vẫn in đủ mọi dòng đúng rồi mới chết, nên nhìn log thì
     * tưởng ổn. Là tranh chấp thời điểm nên nó CHẬP CHỜN: chạy tay được `1`, chạy trong bộ test thì
     * `0xC0000409`.
     *
     * Hệ quả: người gọi kiểm `exit === 1` để biết "thiếu evidence" sẽ TRƯỢT, và một bug không có ảnh
     * đi ra Backlog mà wrapper báo là bình thường. Đúng thứ cửa này sinh ra để chặn.
     *
     * Đo đường chữa 5 lượt: `process.exitCode = 1` rồi để Node tự thoát ⇒ 5/5 ra mã `1`, ~200ms.
     */
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error(`[ERROR] ${e.message}`);
  /* Cùng lý do ở trên: `process.exit()` trong nhánh bất đồng bộ này cũng sụp libuv trên Windows. */
  process.exitCode = 1;
});
