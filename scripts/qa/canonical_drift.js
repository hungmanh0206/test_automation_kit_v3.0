#!/usr/bin/env node
'use strict';
/*
 * canonical_drift — ĐO ĐỘ TRÔI giữa Markdown canonical và bản xuất `.xlsx`.
 *
 * VÌ SAO CẦN, và đây là một lỗ do chính luật mới mở ra. Từ v2.7.0, `RULE_GLOBAL` khai:
 *   · nội dung case: `test-cases/*.md` là nguồn sự thật;
 *   · `.xlsx` và Google Sheet là BẢN XUẤT;
 *   · Phase 2 execute ĐỌC `*.md`, vì `.xlsx` là nhị phân nên phải qua một script in bảng ra mới vào
 *     được ngữ cảnh — tức đường Markdown rẻ token hơn đúng phần chuyển đổi đó.
 *
 * Nhưng QA sửa case TRÊN GOOGLE SHEET là chuyện có thật và hợp lệ. Lúc đó bản xuất đi trước, Markdown
 * ở lại, và Phase 2 vẫn đọc Markdown — nghĩa là lượt chạy đó dùng bộ CŨ, mọi verdict của nó nói về một
 * bộ case không còn tồn tại, mà KHÔNG CÓ GÌ BÁO. Đây đúng họ lỗi "hai nguồn phân kỳ âm thầm" đã trả giá
 * một lần: ngày 08/10/2026, task TASK-9001 mất 129 ô kết quả vì bản xuất bị sinh lại đè.
 *
 * `result_ledger` canh cột `Result` (verdict). Máy này canh các cột NỘI DUNG. Hai máy, hai thứ khác nhau.
 *
 * SO BẰNG CÁCH PARSE CẢ HAI PHÍA QUA MODEL CANONICAL, không so chuỗi thô. Lý do cụ thể: exporter bóc
 * Markdown nội dòng (`**x**` → `x`), bóc emoji, và đổi `<br>` thành xuống dòng. So thô thì MỌI ô đều
 * "khác nhau" và báo cáo thành vô dụng ngay lượt đầu. `parseMarkdown` và `parseXlsx` dùng CÙNG
 * `buildTestCase` → cùng `cleanCell`, nên hai bên về chung một dạng rồi mới so.
 *
 * KHÔNG so cột `Result`/`Note`: `Result` vốn đến từ `testcase-status.json` qua `merge:execution-status`,
 * nên nó LUÔN "có ở Excel mà không có ở Markdown". Đưa nó vào phép so là tự tạo báo động giả mỗi lượt,
 * và người đọc sẽ thôi đọc mục này — rồi một thay đổi nội dung thật chìm theo.
 *
 * Dùng:
 *   node scripts/qa/canonical_drift.js [--task <TASK_KEY>] [--enforce] [--json]
 *
 * Exit: 0 không trôi hoặc chưa gác được · 1 có trôi (chỉ khi --enforce) · 2 không chạy được (thiếu input)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));

const ENFORCE = process.argv.includes('--enforce');
const JSON_OUT = process.argv.includes('--json');
const val = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};

/*
 * CÁC TRƯỜNG ĐƯỢC SO — và vì sao đúng từng ấy.
 *
 * Đây là bộ trường mà model canonical dựng từ CẢ HAI nguồn, nên hai phía chắc chắn so được. `dimensions`,
 * `techniques`, `oracleRefs` KHÔNG nằm đây: chúng là thứ SUY RA từ `tags` và `title`, nên đưa vào là đếm
 * cùng một thay đổi nhiều lần.
 */
const TRUONG = ['module', 'title', 'precondition', 'data', 'stepsRaw', 'expectedRaw', 'priority', 'risk', 'tags', 'group'];

const NHAN = {
  module: 'Module', title: 'Trường hợp kiểm thử', precondition: 'Tiền điều kiện', data: 'Dữ liệu Test',
  stepsRaw: 'Các bước thực hiện', expectedRaw: 'Kết quả mong đợi', priority: 'Ưu tiên', risk: 'Mức độ rủi ro',
  tags: 'Tag', group: 'Nhóm chức năng',
};

/** Chuẩn hoá nhẹ TRƯỚC khi so: NFC, gộp khoảng trắng, bỏ khoảng trắng hai đầu mỗi dòng. */
function chuan(v) {
  return String(v == null ? '' : v)
    .normalize('NFC')
    .split('\n').map((d) => d.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Mọi `.md` trong các thư mục testcase của task (bỏ file tạm của Office). */
function timMd(taskOutputDir) {
  const ra = [];
  const base = path.join(taskOutputDir, 'test-cases');
  if (!fs.existsSync(base)) return ra;
  for (const f of fs.readdirSync(base)) {
    if (f.endsWith('.md') && !f.startsWith('~$')) ra.push(path.join(base, f));
  }
  return ra;
}

/**
 * Mọi `.xlsx` để đối chiếu, kèm nhãn nguồn.
 *
 * `from-sheet/` được tách riêng vì nó mang nghĩa khác: đó là bản QA đang sửa trên Google Sheet, kéo về.
 * Trôi ở `from-sheet/` là tín hiệu MẠNH hơn trôi ở `test-cases/*.xlsx` — bản sau có thể chỉ là chưa
 * xuất lại sau một lần sửa Markdown, còn bản trước nghĩa là có người đã sửa ở đầu kia.
 */
function timXlsx(taskOutputDir) {
  const ra = [];
  for (const d of rc.getTestcaseDirs(taskOutputDir)) {
    if (!fs.existsSync(d)) continue;
    const laSheet = /from-sheet/.test(d.split(path.sep).join('/'));
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.xlsx') && !f.startsWith('~$')) {
        const p = path.join(d, f);
        ra.push({ duong: p, laSheet, luc: fs.statSync(p).mtimeMs });
      }
    }
  }
  return ra;
}

/*
 * HƯỚNG TRÔI, và vì sao nó quyết định chuyện có chặn hay không.
 *
 * Hai hướng mang nghĩa ngược nhau, nên gộp chúng vào một con số "N điểm trôi" là bỏ mất đúng phần
 * quan trọng:
 *
 *   · MARKDOWN MỚI HƠN  — ai đó vừa sửa Markdown mà chưa xuất lại `.xlsx`. Phase 2 đọc Markdown nên
 *     lượt chạy VẪN ĐÚNG bộ mới nhất. Chỉ cần nhắc xuất lại trước khi publish. KHÔNG chặn execute.
 *   · BẢN XUẤT MỚI HƠN  — có người sửa ở đầu kia (thường là QA sửa tay trên Google Sheet rồi kéo về).
 *     Markdown đã thôi là bộ mới nhất, nên đọc nó là chạy bộ CŨ. ĐÂY là chỗ phải chặn.
 *
 * Tín hiệu dùng là `mtime`, và nó có giới hạn phải khai: `mtime` nói LẦN GHI CUỐI, không nói NỘI DUNG
 * nào mới hơn. Một lượt `git checkout` hay copy thư mục đặt lại mtime của cả hai phía. Nên khi mtime
 * không chênh quá ngưỡng, máy KHÔNG kết luận hướng — nó trả `khong_ro` và hạ xuống cảnh báo, chứ không
 * đoán rồi chặn oan.
 */
const NGUONG_MTIME_MS = 2000;

function huongTroi(mdFiles, xlFiles) {
  if (!mdFiles.length || !xlFiles.length) return { huong: 'khong_ro', vi_sao: 'thiếu một phía' };
  const mdMoiNhat = Math.max(...mdFiles.map((f) => fs.statSync(f).mtimeMs));
  const xlMoiNhat = Math.max(...xlFiles.map((f) => f.luc));
  const chenh = xlMoiNhat - mdMoiNhat;
  if (Math.abs(chenh) <= NGUONG_MTIME_MS) {
    return { huong: 'khong_ro', vi_sao: `hai phía ghi cách nhau ${Math.abs(Math.round(chenh / 1000))}s — quá gần để kết luận hướng` };
  }
  if (chenh > 0) {
    return { huong: 'ban_xuat_moi_hon', vi_sao: `bản xuất được ghi sau Markdown ${Math.round(chenh / 1000)}s — có người sửa ở đầu kia` };
  }
  return { huong: 'markdown_moi_hon', vi_sao: `Markdown được ghi sau bản xuất ${Math.round(-chenh / 1000)}s — chỉ là chưa xuất lại` };
}

/** Gộp nhiều file cùng loại thành một map tcId → case. Trùng tcId thì giữ bản đầu và ghi nhận. */
function gomTheoTcId(docs) {
  const map = new Map();
  const trung = [];
  for (const d of docs) {
    for (const t of d.tests || []) {
      const id = String(t.tcId || '').trim();
      if (!id) continue;
      if (map.has(id)) { trung.push(id); continue; }
      map.set(id, t);
    }
  }
  return { map, trung: [...new Set(trung)] };
}

/*
 * TRƯỜNG NÀO SO ĐƯỢC — và vì sao phải hỏi câu này thay vì so cả mười.
 *
 * Lượt chạy đầu trên bộ thật (TASK-9001, 213 case) báo **428 ô khác**, nghe như bộ đã trôi hoàn toàn.
 * Đo ra thì gần hết là trường KHÔNG TỒN TẠI ở một phía:
 *   · bản xuất của bộ đó là bố cục 24 cột và KHÔNG có cột `Tag` lẫn `Loại case` ⇒ md có, xlsx rỗng;
 *   · `Nhóm chức năng` thì ngược lại: exporter suy từ TÊN SHEET, Markdown không có cột đó;
 *   · `Mức độ rủi ro` cũng không có trong bố cục đó.
 * So một trường mà một phía không bao giờ mang được nó thì mỗi case sinh một "khác biệt", và báo cáo
 * thành vô dụng ngay lượt đầu — người đọc sẽ bỏ qua mục này, rồi một thay đổi nội dung THẬT chìm theo.
 *
 * Nên: chỉ so trường có cột ở CẢ HAI phía, và KHAI RÕ trường nào không so được kèm lý do. Khai ra là
 * phần bắt buộc, không phải lịch sự: "0 điểm trôi" mà không nói đã so mấy trường thì nó có thể nghĩa là
 * "không so trường nào".
 */
/*
 * Tên trường của model KHÁC khoá của bảng khớp cột. `stepsRaw` và `expectedRaw` là trường trên object
 * TestCase, còn bảng `COL` khai chúng là `steps` và `expected`. Bản đầu tra `COL['stepsRaw']` ⇒ `undefined`
 * ⇒ máy báo "không bên nào có cột này" cho ĐÚNG hai cột quan trọng nhất, trong khi cả hai phía đều có.
 * Một phép so bỏ qua Bước và Kết quả mong đợi thì nó không còn đo cái gì đáng đo.
 */
const KHOA_COL = { stepsRaw: 'steps', expectedRaw: 'expected' };

function truongSoDuoc(mdHeaders, xlHeaders) {
  const { COL, colIndex } = canonical;
  const duoc = [];
  const khong = [];
  for (const f of TRUONG) {
    const k = KHOA_COL[f] || f;
    const coMd = COL[k] ? colIndex(mdHeaders, COL[k]) >= 0 : false;
    const coXl = COL[k] ? colIndex(xlHeaders, COL[k]) >= 0 : false;
    if (coMd && coXl) { duoc.push(f); continue; }
    let viSao;
    if (!coMd && !coXl) viSao = 'không bên nào có cột này';
    else if (!coXl) viSao = 'bản xuất không có cột này (bố cục Excel khác)';
    else viSao = 'Markdown không có cột này (exporter tự suy ra, ví dụ từ tên sheet)';
    khong.push({ truong: f, nhan: NHAN[f] || f, vi_sao: viSao });
  }
  return { duoc, khong };
}

function soSanh(md, xl, truong) {
  const chiMd = [...md.keys()].filter((k) => !xl.has(k)).sort();
  const chiXl = [...xl.keys()].filter((k) => !md.has(k)).sort();
  const oKhac = [];
  for (const [id, a] of md) {
    const b = xl.get(id);
    if (!b) continue;
    for (const f of truong) {
      const va = chuan(a[f]);
      const vb = chuan(b[f]);
      if (va !== vb) oKhac.push({ tcId: id, truong: f, nhan: NHAN[f] || f, md: va, xlsx: vb });
    }
  }
  return { chi_markdown: chiMd, chi_xlsx: chiXl, o_khac: oKhac, so_case_doi_chieu: [...md.keys()].filter((k) => xl.has(k)).length };
}

const motDong = (s) => String(s).replace(/\n/g, ' ⏎ ');

/*
 * In cửa sổ quanh CHỖ LỆCH ĐẦU TIÊN, không in từ đầu ô.
 *
 * Bản đầu in 70 ký tự đầu của mỗi bên. Trên bộ thật, hai ô dài hơn 300 ký tự và chỉ khác ở gần cuối, nên
 * hai dòng in ra GIỐNG NHAU từng chữ — báo cáo nói "có khác biệt" rồi đưa ra hai dòng y hệt. Người đọc
 * không có cách nào dùng nó, và tệ hơn là sẽ nghi máy báo oan trong khi máy đúng.
 */
function cuaSoLech(a, b, rong = 34) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const tu = Math.max(0, i - rong);
  const cat = (s) => `${tu > 0 ? '…' : ''}${motDong(s.slice(tu, i + rong))}${i + rong < s.length ? '…' : ''}`;
  return { viTri: i, md: cat(a), xlsx: cat(b) };
}

async function main() {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[drift] ✗ không xác định được task: ${e.message}`);
    console.error('        Cần TASK_KEY + PROJECT_OUTPUT_DIR (hoặc --task <TASK_KEY>).');
    process.exit(2);
  }

  const mdFiles = timMd(taskOutputDir);
  const xlFiles = timXlsx(taskOutputDir);

  /*
   * HAI CÂU "KHÔNG TRÔI" VÀ "CHƯA GÁC ĐƯỢC" PHẢI TÁCH NHAU.
   *
   * Cả hai cùng ra con số 0 mà nghĩa ngược nhau: một bên là đã so và không thấy lệch, một bên là chưa
   * so gì cả. Gộp chúng là cách chắc chắn nhất để một bộ đã trôi hoàn toàn đi qua êm ru — đúng luật
   * "kiểm 0 thứ thì không được báo ĐẠT".
   */
  if (!mdFiles.length || !xlFiles.length) {
    const thieu = !mdFiles.length ? 'không có `test-cases/*.md`' : 'không có bản xuất `.xlsx` nào';
    if (JSON_OUT) { console.log(JSON.stringify({ trang_thai: 'CHUA_GAC_DUOC', vi_sao: thieu, task: taskKey }, null, 2)); return; }
    console.log(`[drift] CHƯA ĐƯỢC GÁC — ${thieu} trong ${path.join(taskOutputDir, 'test-cases')}.`);
    console.log('        Đây KHÔNG phải "không trôi": chưa có gì được đem ra so.');
    console.log('        Phase 1 gen xong phải có CẢ `*.md` (canonical) và `*.xlsx` (bản xuất bắt buộc).');
  /*
   * EXIT 2 = "KHÔNG PHÁN ĐƯỢC", theo convention đã có của kit (`gates:index:check` dùng đúng mã này).
   *
   * Bản đầu exit 0 ở nhánh này, và CỬA RA phơi ra chỗ sai ngay lượt chạy thật đầu tiên: bảng của
   * `exit:gate` in dấu ✓ cho máy này, ngay dưới dòng chính nó vừa nói "đây KHÔNG phải là đạt". Một máy
   * nói đúng bằng chữ mà trả sai bằng mã thì mọi thứ ĐỌC MÃ sẽ hiểu ngược — và cửa ra là thứ đọc mã.
   */
    process.exit(2);
  }

  const mdDocs = mdFiles.map((f) => canonical.parseMarkdown(f));
  const xlDocs = [];
  for (const x of xlFiles) {
    /* eslint-disable-next-line no-await-in-loop */
    const doc = await canonical.parseXlsx(x.duong);
    xlDocs.push({ ...doc, _duong: x.duong, _laSheet: x.laSheet });
  }

  const g1 = gomTheoTcId(mdDocs);
  const nhomSheet = xlDocs.filter((d) => d._laSheet);
  const nhomXuat = xlDocs.filter((d) => !d._laSheet);

  const mdHeaders = [...new Set(mdDocs.flatMap((d) => d.headers || []))];
  const ra = { task: taskKey, so_file_md: mdFiles.length, so_case_md: g1.map.size, nhom: [] };
  for (const [ten, nhom] of [['from-sheet (QA đang sửa ở đây)', nhomSheet], ['bản xuất test-cases/*.xlsx', nhomXuat]]) {
    if (!nhom.length) continue;
    const g2 = gomTheoTcId(nhom);
    const xlHeaders = [...new Set(nhom.flatMap((d) => d.headers || []))];
    const tr = truongSoDuoc(mdHeaders, xlHeaders);
    const kq = soSanh(g1.map, g2.map, tr.duoc);
    ra.nhom.push({
      nguon: ten,
      files: nhom.map((d) => path.relative(REPO, d._duong).split(path.sep).join('/')),
      so_case: g2.map.size,
      truong_da_so: tr.duoc.map((f) => NHAN[f] || f),
      truong_khong_so_duoc: tr.khong,
      ...kq,
      tcid_trung: g2.trung,
    });
  }

  const tongTroi = ra.nhom.reduce((s, n) => s + n.chi_markdown.length + n.chi_xlsx.length + n.o_khac.length, 0);
  ra.so_thay_doi = tongTroi;
  const h = huongTroi(mdFiles, xlFiles);
  ra.huong = h.huong;
  ra.huong_vi_sao = h.vi_sao;
  /*
   * CHẶN chỉ khi Markdown KHÔNG còn là bộ mới nhất. Hai ca:
   *   · bản xuất được ghi sau Markdown ⇒ có người sửa ở đầu kia;
   *   · có case CHỈ tồn tại ở bản xuất ⇒ case được thêm ở đầu kia, mtime không cần nói gì thêm.
   * Markdown mới hơn thì execute vẫn đọc đúng bộ, nên đó là việc "nhớ xuất lại", không phải việc chặn.
   */
  const caseChiOBanXuat = ra.nhom.reduce((s, n) => s + n.chi_xlsx.length, 0);
  ra.phai_chan = tongTroi > 0 && (h.huong === 'ban_xuat_moi_hon' || caseChiOBanXuat > 0);

  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); process.exit(ra.phai_chan && ENFORCE ? 1 : 0); }

  console.log(`[drift] task ${taskKey} · Markdown: ${g1.map.size} case trong ${mdFiles.length} file`);
  if (g1.trung.length) console.log(`        ⚠ ${g1.trung.length} TC ID TRÙNG trong Markdown: ${g1.trung.slice(0, 6).join(', ')}`);

  for (const n of ra.nhom) {
    console.log('');
    console.log(`  ── ${n.nguon} — ${n.so_case} case · đối chiếu được ${n.so_case_doi_chieu}`);
    /* MẪU SỐ đứng trước kết luận: "0 trôi" mà không nói đã so mấy trường thì có thể nghĩa là so 0 trường. */
    console.log(`     đã so ${n.truong_da_so.length}/${TRUONG.length} trường: ${n.truong_da_so.join(' · ') || '(KHÔNG trường nào)'}`);
    if (n.truong_khong_so_duoc.length) {
      for (const k of n.truong_khong_so_duoc) console.log(`     ~ KHÔNG so được "${k.nhan}" — ${k.vi_sao}`);
    }
    if (!n.truong_da_so.length) {
      console.log('     ✗ CHƯA ĐƯỢC GÁC cho nhóm này: không trường nào so được, nên không kết luận gì.');
      continue;
    }
    if (n.tcid_trung.length) console.log(`     ⚠ TC ID trùng: ${n.tcid_trung.slice(0, 6).join(', ')}`);
    if (!n.chi_markdown.length && !n.chi_xlsx.length && !n.o_khac.length) { console.log('     ✓ không trôi'); continue; }
    if (n.chi_markdown.length) console.log(`     + ${n.chi_markdown.length} case CHỈ có ở Markdown (bản xuất chưa sinh lại): ${n.chi_markdown.slice(0, 8).join(', ')}${n.chi_markdown.length > 8 ? ' …' : ''}`);
    if (n.chi_xlsx.length) console.log(`     + ${n.chi_xlsx.length} case CHỈ có ở bản xuất (ai đó thêm case ở đầu kia): ${n.chi_xlsx.slice(0, 8).join(', ')}${n.chi_xlsx.length > 8 ? ' …' : ''}`);
    if (n.o_khac.length) {
      console.log(`     + ${n.o_khac.length} ô khác nội dung:`);
      for (const o of n.o_khac.slice(0, 12)) {
        const w = cuaSoLech(o.md, o.xlsx);
        console.log(`       · ${o.tcId} · ${o.nhan} — lệch từ ký tự ${w.viTri}`);
        console.log(`           md   : ${w.md}`);
        console.log(`           xlsx : ${w.xlsx}`);
      }
      if (n.o_khac.length > 12) console.log(`       … (+${n.o_khac.length - 12} ô nữa)`);
    }
  }

  console.log('');
  if (!tongTroi) {
    console.log('[drift] ✓ ĐẠT — bản xuất khớp Markdown canonical. Phase 2 đọc `*.md` được.');
    return;
  }

  console.log(`[drift] ${tongTroi} điểm trôi · hướng: ${ra.huong} (${ra.huong_vi_sao})`);
  if (ra.huong === 'markdown_moi_hon' && !caseChiOBanXuat) {
    console.log('        Markdown vẫn là bộ MỚI NHẤT, nên Phase 2 đọc `*.md` vẫn chạy đúng bộ.');
    console.log('        Việc cần làm: xuất lại `.xlsx` bằng `md_to_xlsx.js` rồi re-publish, TRƯỚC khi ai đó mở Sheet.');
    console.log('[drift] ⚠ CẢNH BÁO — không chặn: hướng trôi này không làm sai lượt execute.');
    return;
  }
  if (ra.huong === 'khong_ro' && !caseChiOBanXuat) {
    console.log('        KHÔNG kết luận được hướng, nên không chặn — `mtime` chỉ nói lần ghi cuối, và một lượt');
    console.log('        checkout hay copy thư mục đặt lại mtime cả hai phía. Người xem hai giá trị ở trên rồi chốt.');
    console.log('[drift] ⚠ CẢNH BÁO — không phán được hướng. Đây KHÔNG phải là đạt.');
    return;
  }
  console.log('        Bản xuất đã đi trước: Markdown KHÔNG còn là bộ mới nhất.');
  console.log('        Mang phần sửa từ Sheet về Markdown TRƯỚC khi execute. Đọc Markdown đã trôi nghĩa là lượt đó');
  console.log('        chạy bộ CŨ, và mọi verdict của nó nói về một bộ case không còn tồn tại.');
  console.log(`[drift] ${ENFORCE ? '✗ CHẶN' : '⚠ CẢNH BÁO (thêm --enforce để chặn)'}`);
  if (ENFORCE) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => { console.error(`[drift] ✗ lỗi: ${e.message}`); process.exit(2); });
}

module.exports = { chuan, soSanh, gomTheoTcId, huongTroi, truongSoDuoc, TRUONG, NHAN, NGUONG_MTIME_MS };
