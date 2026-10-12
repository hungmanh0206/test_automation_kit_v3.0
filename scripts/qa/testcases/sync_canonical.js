#!/usr/bin/env node
'use strict';
/*
 * sync_canonical — MỘT BỘ GHI, TOẢ BA NƠI (v2.8.0 §0c).
 *
 * MÔ HÌNH CHỐT, và nó khác hẳn thực trạng trước v2.8.0:
 *   · **MD là canonical duy nhất** cho nội dung testcase. Mọi lần execute chỉ đọc MD.
 *   · **Excel và Google Sheet là BẢN PHÁI SINH** — để người đọc, và để điền kết quả. Không bao giờ là
 *     nguồn nội dung khi execute.
 *   · Mọi thay đổi đi qua ĐÚNG MỘT đường ghi, rồi toả ra cả ba, theo thứ tự **MD → Excel → Sheet**.
 *
 * VÌ SAO CẦN, có số đo. `CLAUDE.md` §6 đã nói "MD canonical" từ đợt trước, nhưng đo 12/10/2026: **9 file
 * tài liệu lớp kit** vẫn gọi Excel là canonical, và **6 prompt + 2 skill** vẫn dặn "tải bản Sheet mới nhất"
 * trước execute. Tức tài liệu mâu thuẫn với chính non-negotiable của kit, và mỗi lượt execute vẫn trả giá
 * token cho một cú tải Sheet không cần thiết.
 *
 * (`TESTCASE_SOURCE` thì KHÔNG máy nào đọc — đo cùng lúc: nó chỉ bị gỡ khỏi env ở `_gate_env` và
 * `verify_release`, phần còn lại là văn xuôi. Nên "xoá đường =sheet làm mặc định" là việc tài liệu.)
 *
 * THỨ TỰ LÀ BẮT BUỘC, không phải cho gọn. MD ghi xong mới tới Excel; Excel xong mới tới Sheet. Nếu toả
 * ngược (Sheet trước) thì một lần Sheet lỗi sẽ để lại ba nơi ba nội dung khác nhau, và không ai biết nơi
 * nào đúng.
 *
 * MỘT BƯỚC TOẢ THẤT BẠI KHÔNG ĐƯỢC IM LẶNG. Drive MCP offline, hay chưa cấu hình `GOOGLE_SPREADSHEET_ID`,
 * thì MD và Excel vẫn đúng — nhưng `sync_state.json` phải ghi `sheet_stale: true` và máy phải NÓI RA. Một
 * lần toả nửa vời mà im lặng tạo ra đúng tình huống tệ nhất: người đọc Sheet tin mình đang đọc bản mới.
 *
 * Dùng:
 *   node scripts/qa/testcases/sync_canonical.js --task <K> [--results] [--cham-sheet] [--json]
 *
 * `--cham-sheet` là bắt buộc để chạm Google Sheet: đó là bề mặt dùng chung của cả team, nên nó cần một
 * lần xác nhận tường minh mỗi lượt (cùng tinh thần với luật "xác nhận trước mỗi lượt chạm UAT").
 *
 * Exit: 0 · 1 khi một bước toả thất bại · 2 khi MD canonical không đọc được
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));

const RESULTS = process.argv.includes('--results');
const CHAM_SHEET = process.argv.includes('--cham-sheet');
const JSON_OUT = process.argv.includes('--json');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/** Tên file trạng thái. Nằm cạnh MD canonical, vì nó nói về lần toả của chính bộ đó. */
const TEN_STATE = 'sync_state.json';

function timMd(tcDir) {
  if (!fs.existsSync(tcDir)) return [];
  return fs.readdirSync(tcDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(tcDir, f));
}

/** Bước 1 — MD là nguồn. Không ghi gì, chỉ XÁC NHẬN nó đọc được và khai mẫu số. */
function buocMd(files) {
  let soCase = 0;
  const loi = [];
  for (const f of files) {
    try {
      const d = canonical.parseMarkdown(fs.readFileSync(f, 'utf8'));
      soCase += (d.tests || []).length;
    } catch (e) {
      loi.push(`${path.basename(f)}: ${e.message}`);
    }
  }
  return { ok: !loi.length && soCase > 0, so_case: soCase, loi };
}

/** Bước 2 — Excel sinh LẠI từ MD. Dùng `md_to_xlsx.js` có sẵn, không viết bộ xuất thứ hai. */
function buocExcel(files, tcDir) {
  const ra = [];
  for (const f of files) {
    const out = path.join(tcDir, `${path.basename(f, '.md')}.xlsx`);
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/convert_excel/md_to_xlsx.js'), f, out], {
      cwd: REPO, encoding: 'utf8',
    });
    ra.push({
      md: path.basename(f),
      xlsx: path.basename(out),
      ok: r.status === 0,
      loi: r.status === 0 ? null : String(r.stderr || r.stdout || '').trim().slice(0, 300),
    });
  }
  return { ok: ra.every((x) => x.ok), file: ra };
}

/**
 * Bước 3 — Sheet. Có BA kết cục khác nhau, và gộp chúng lại là chỗ dễ nói sai nhất:
 *   · `chua_cau_hinh` — không có `GOOGLE_SPREADSHEET_ID`. KHÔNG phải lỗi, và cũng KHÔNG phải "đã đồng bộ".
 *   · `chua_xac_nhan` — thiếu cờ `--cham-sheet`. Cố ý: Sheet là bề mặt dùng chung của cả team.
 *   · `loi` — đã thử và thất bại ⇒ `sheet_stale: true`.
 */
function buocSheet(xlsxFiles) {
  if (!CHAM_SHEET) return { trang_thai: 'chua_xac_nhan', stale: true };
  if (!process.env.GOOGLE_SPREADSHEET_ID) return { trang_thai: 'chua_cau_hinh', stale: true };

  let writer;
  try {
    writer = require(path.join(REPO, 'scripts/integrations/google_sheet/sheet_writer.js'));
  } catch (e) {
    return { trang_thai: 'loi', stale: true, loi: `không nạp được sheet_writer: ${e.message}` };
  }
  if (typeof writer.importExcel !== 'function') {
    return { trang_thai: 'loi', stale: true, loi: 'sheet_writer không export importExcel' };
  }
  return { trang_thai: 'can_chay_tay', stale: true, xlsx: xlsxFiles, _y: 'importExcel là hàm async cần credential — gọi từ luồng publish, không gọi trong lượt sync đồng bộ này.' };
}

/**
 * KẾT QUẢ CHẠY cũng toả ba, nhưng ghi vào KHỐI RIÊNG của MD.
 *
 * Nội dung do thiết kế TC sửa; kết quả do execute ghi. Tách khối thì `git diff` nói được "đổi nội dung"
 * hay "ghi kết quả" — gộp một chỗ thì mọi lượt chạy trông như một lượt sửa case, và lúc đó không ai dám
 * tin `canonical:check`.
 */
function ghiKetQuaVaoMd(tcDir, files, taskOutputDir) {
  const fStatus = path.join(taskOutputDir, 'test-results', 'testcase-status.json');
  if (!fs.existsSync(fStatus)) return { ok: false, vi_sao: `không có ${path.relative(REPO, fStatus)}` };
  let ds;
  try {
    const j = JSON.parse(fs.readFileSync(fStatus, 'utf8'));
    ds = Array.isArray(j) ? j : (j.tests || j.cases || []);
  } catch (e) { return { ok: false, vi_sao: `status hỏng: ${e.message}` };
  }
  if (!ds.length) return { ok: false, vi_sao: 'file status rỗng — không có kết quả nào để toả' };

  const MOC_DAU = '<!-- KET-QUA:BAT-DAU — sinh bởi `sync_canonical --results`. Đừng sửa tay. -->';
  const MOC_CUOI = '<!-- KET-QUA:KET-THUC -->';
  const dong = ['| TC ID | Verdict | Tầng lỗi | Số lượt rerun | Evidence |', '|---|---|---|---|---|'];
  for (const t of ds) {
    const ev = Array.isArray(t.evidence) ? t.evidence.length : 0;
    dong.push(`| ${t.tcId || t.testKey || '(no-id)'} | ${t.status || ''} | ${t.failureLayer || ''} | ${t.reruns ?? ''} | ${ev} tệp |`);
  }
  const khoi = [MOC_DAU, '', '## Kết quả lượt chạy', '', ...dong, '', MOC_CUOI].join('\n');

  let ghi = 0;
  for (const f of files) {
    let t = fs.readFileSync(f, 'utf8');
    const i = t.indexOf(MOC_DAU);
    const j = t.indexOf(MOC_CUOI);
    t = (i >= 0 && j > i)
      ? t.slice(0, i) + khoi + t.slice(j + MOC_CUOI.length)
      : `${t.replace(/\s*$/, '')}\n\n${khoi}\n`;
    fs.writeFileSync(f, t, 'utf8');
    ghi += 1;
  }
  return { ok: true, so_file: ghi, so_case: ds.length };
}

function main() {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[sync] ✗ không xác định được task: ${e.message}`);
    process.exit(2);
  }

  const tcDir = path.join(taskOutputDir, 'test-cases');
  const files = timMd(tcDir);
  if (!files.length) {
    console.error(`[sync] CHƯA ĐƯỢC GÁC — 0 file MD canonical ở ${path.relative(REPO, tcDir)}.`);
    console.error('       MD là NGUỒN. Không có nguồn thì không toả được gì, và đây không phải "không có việc".');
    process.exit(2);
  }

  const md = buocMd(files);
  if (!md.ok) {
    console.error('[sync] ✗ MD canonical không đọc được — DỪNG, không toả tiếp:');
    for (const l of md.loi) console.error(`  ${l}`);
    if (!md.so_case) console.error('  (hoặc 0 case đọc được — phép đo hỏng, không phải "bộ rỗng")');
    process.exit(2);
  }

  const kq = { task: taskKey, so_file_md: files.length, so_case: md.so_case };

  if (RESULTS) {
    kq.ket_qua = ghiKetQuaVaoMd(tcDir, files, taskOutputDir);
    if (!kq.ket_qua.ok) {
      console.error(`[sync] ✗ không toả được kết quả: ${kq.ket_qua.vi_sao}`);
      process.exit(1);
    }
  }

  kq.excel = buocExcel(files, tcDir);
  if (!kq.excel.ok) {
    console.error('[sync] ✗ sinh lại Excel THẤT BẠI — DỪNG, không toả sang Sheet:');
    for (const f of kq.excel.file.filter((x) => !x.ok)) console.error(`  ${f.md}: ${f.loi}`);
    console.error('       MD vẫn đúng. Thứ tự MD → Excel → Sheet là bắt buộc, nên không nhảy qua bước lỗi.');
    ghiState(tcDir, { ...kq, sheet_stale: true });
    process.exit(1);
  }

  kq.sheet = buocSheet(kq.excel.file.map((x) => x.xlsx));
  ghiState(tcDir, { ...kq, sheet_stale: !!kq.sheet.stale });

  if (JSON_OUT) { console.log(JSON.stringify(kq, null, 2)); process.exit(kq.sheet.stale ? 1 : 0); }

  console.log(`[sync] MD ✓ ${md.so_case} case / ${files.length} file  →  Excel ✓ ${kq.excel.file.length} file`);
  if (RESULTS) console.log(`[sync] kết quả: ghi khối riêng vào ${kq.ket_qua.so_file} file MD (${kq.ket_qua.so_case} case)`);
  const s = kq.sheet;
  if (s.trang_thai === 'chua_xac_nhan') {
    console.log('[sync] ○ Sheet: CHƯA ĐỒNG BỘ — thiếu cờ `--cham-sheet`. Sheet là bề mặt dùng chung của cả team,');
    console.log('       nên mỗi lượt chạm nó cần một lần xác nhận tường minh.');
  } else if (s.trang_thai === 'chua_cau_hinh') {
    console.log('[sync] ○ Sheet: CHƯA ĐỒNG BỘ — thiếu `GOOGLE_SPREADSHEET_ID`. Đây KHÔNG phải lỗi, và cũng');
    console.log('       KHÔNG phải "đã đồng bộ". `sync_state.json` ghi `sheet_stale: true`.');
  } else if (s.trang_thai === 'can_chay_tay') {
    console.log('[sync] ○ Sheet: cần luồng publish chạy `importExcel` (cần credential). Đã ghi `sheet_stale: true`.');
  } else {
    console.log(`[sync] ✗ Sheet: ${s.loi}`);
  }
  console.log(`[sync] trạng thái → ${path.relative(REPO, path.join(tcDir, TEN_STATE))}`);
  process.exit(s.stale ? 1 : 0);
}

function ghiState(tcDir, kq) {
  const f = path.join(tcDir, TEN_STATE);
  fs.writeFileSync(f, `${JSON.stringify({
    _y: 'Trạng thái lượt toả MD → Excel → Sheet (v2.8.0 §0c). `sheet_stale: true` nghĩa là Sheet CHƯA mang bản mới nhất.',
    luc: new Date().toISOString(),
    ...kq,
  }, null, 2)}\n`, 'utf8');
  return f;
}

if (require.main === module) main();

module.exports = { timMd, buocMd, buocExcel, buocSheet, ghiKetQuaVaoMd, TEN_STATE };
