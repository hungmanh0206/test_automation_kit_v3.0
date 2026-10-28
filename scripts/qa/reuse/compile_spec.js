#!/usr/bin/env node
'use strict';
/*
 * compile:spec — BIÊN DỊCH TESTCASE THÀNH SPEC (v2.8.0 §D). KHÔNG GỌI MODEL, 0 token AI.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * HAI LUẬT ĐỊNH HÌNH CẢ FILE NÀY, và chúng đi ngược bản năng "sinh cho đủ":
 *
 *   1. CASE CHƯA ĐỦ THÌ KHÔNG ĐƯỢC PASS. Một case còn `TODO-STEP` hoặc `TODO-ORACLE` được sinh ra dưới
 *      dạng `test.skip(...)`, nên Playwright báo SKIPPED và nó KHÔNG BAO GIỜ thành PASS. Đây không phải
 *      sự cẩn thận quá mức: nếu sinh ra một `test()` thật mà thân chỉ có vài lời gọi khớp được, nó sẽ
 *      XANH — xanh vì chẳng kiểm gì — và một case chưa làm xong được đếm vào cột PASS. Đúng chỗ
 *      CLAUDE.md §3 gọi là "không phán được KHÔNG thành PASS".
 *
 *   2. BỘ BIÊN DỊCH KHÔNG BỊA GIÁ TRỊ KỲ VỌNG. Ô `Kết quả mong đợi` là văn xuôi tiếng Việt. Rút một giá
 *      trị kỳ vọng từ văn xuôi bằng máy chỉ đáng tin khi giá trị đó được BỌC NHÁY trong chính ô đó. Mọi
 *      dòng kỳ vọng khác thành `// TODO-ORACLE`. Cố suy ra giá trị kỳ vọng từ câu chữ là cách nhanh nhất
 *      để sinh ra một bộ kiểm so app với app: nó sẽ khớp, vì nó được viết ra từ cùng nguồn mà nó kiểm.
 *
 * Luật 2 làm tỉ lệ "sinh được hoàn toàn bằng máy" thấp. Đó là con số thật, và nó được in ra kèm MẪU SỐ.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/reuse/compile_spec.js --task <K> [--md <file>] [--out <dir>] [--json]
 * Exit: 0 · 2 khi không có case hoặc không có danh mục (CHƯA ĐƯỢC GÁC)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const pwConfig = require(path.join(REPO, 'scripts', 'qa', 'lib', 'pw_task_config.js'));

/** Dấu máy đọc được, để `compile:check` biết file nào chưa đủ. Đổi chuỗi này là đổi hợp đồng. */
const DAU_CHUA_DU = 'BIEN-DICH:CHUA-DU';
const DAU_DU = 'BIEN-DICH:DU';

/** Phương pháp dựng tiền điều kiện hợp lệ — cùng danh sách với `scripts/lib/testcase/validate.js`. */
const METHODS = ['api', 'factory', 'test_hook', 'ui', 'pre_existing', 'manual'];

/* ────────────────────────── TRÍCH TỪ TESTCASE ────────────────────────── */

/** Tách ô `Tiền điều kiện` thành từng dòng `[method] nội dung`. */
function tachTienDieuKien(o) {
  const ra = [];
  for (const dong of String(o || '').split(/<br\s*\/?>|\r?\n/i)) {
    const s = dong.trim();
    if (!s) continue;
    const m = /^\[([a-z_]+)\]\s*(.*)$/i.exec(s);
    if (m && METHODS.includes(m[1].toLowerCase())) ra.push({ method: m[1].toLowerCase(), noi_dung: m[2].trim() });
    else ra.push({ method: null, noi_dung: s });
  }
  return ra;
}

/**
 * Rút giá trị kỳ vọng từ một dòng của ô `Kết quả mong đợi`.
 *
 * CHỈ nhận giá trị được BỌC NHÁY (hoặc ngoặc vuông) trong chính dòng đó. Xem luật 2 ở đầu file để biết vì
 * sao không suy thêm. Trả `null` khi dòng không mang giá trị nào neo được.
 */
function rutKyVong(dong) {
  const s = String(dong || '').trim();
  if (!s) return null;
  const nhay = [...s.matchAll(/["“”]([^"“”]{1,160})["“”]/g)].map((m) => m[1].trim());
  const vuong = [...s.matchAll(/\[([^[\]]{1,160})\]/g)].map((m) => m[1].trim());
  const gt = [...nhay, ...vuong].filter(Boolean);
  if (!gt.length) return null;

  /*
   * Chọn BỘ KIỂM theo động từ của dòng kỳ vọng, không theo phỏng đoán. Bốn khuôn dưới đây là bốn bộ kiểm
   * L4 đã có; dòng không khớp khuôn nào thì vẫn trả `null` kể cả khi có giá trị bọc nháy — có giá trị
   * KHÔNG có nghĩa là biết phải kiểm cái gì với nó.
   */
  const k = sm.boDau(s);
  if (/\b(thong bao|canh bao|toast|bao loi|hien thi thong bao)\b/.test(k)) return { kiem: 'expectToast', gia_tri: gt[0] };
  if (/\b(o|field|truong|cell|luoi) .*(mang|bang|la|hien) /.test(k) && gt.length >= 1) return { kiem: 'expectCell', gia_tri: gt[0] };
  if (/\b(luu|ghi|persist|tai lai van)\b/.test(k)) return { kiem: 'expectPersisted', gia_tri: gt[0] };
  if (/\b(chan|khong cho|khong luu duoc|bi tu choi)\b/.test(k)) return { kiem: 'expectBlocked', gia_tri: gt[0] };
  return null;
}

/* ────────────────────────── SINH MÃ ────────────────────────── */

/** Chuỗi an toàn trong mã nguồn TypeScript. Dùng `JSON.stringify` — không tự escape bằng tay. */
const q = (s) => JSON.stringify(String(s == null ? '' : s));

/** Tên hàm import từ `impl` dạng `tests/fe/lib/x.ts#tenHam`. */
function phanTichImpl(impl) {
  const [rel, ten] = String(impl).split('#');
  return { rel: rel.replace(/\.ts$/, ''), ten };
}

/**
 * Đường dẫn import TƯƠNG ĐỐI từ thư mục spec tới file thư viện.
 *
 * NÉM khi không dựng được đường tương đối, thay vì sinh ra một import hỏng.
 *
 * Bản đầu không kiểm, và nó sinh ra `from './D:/Project/.../radcombobox'` khi thư mục đích nằm ở Ổ ĐĨA
 * KHÁC: trên Windows, `path.relative` giữa hai ổ trả về chính đường tuyệt đối của đích, rồi dòng
 * `if (!p.startsWith('.'))` dán thêm `./` vào trước. File sinh ra vẫn trông bình thường, và chỉ vỡ lúc
 * Playwright nạp — với một thông báo lạc hướng về module không tìm thấy.
 */
function duongImport(tuDir, relLib) {
  const dich = path.join(REPO, relLib);
  const tho = path.relative(tuDir, dich);
  if (!tho || path.isAbsolute(tho) || /^[A-Za-z]:/.test(tho)) {
    throw new Error(
      `compile:spec không dựng được đường import tương đối từ ${tuDir} tới ${relLib}. `
      + 'Thư mục đích phải nằm cùng ổ đĩa với repo — thường là `<PROJECT_OUTPUT_DIR>/tasks/<TASK>/automation/`.',
    );
  }
  const p = tho.replace(/\\/g, '/');
  return p.startsWith('.') ? p : `./${p}`;
}

/**
 * Sinh thân một case. Trả `{ dong: string[], chuaDu: string[], import: Set, buocDaDung: Map }`.
 *
 * `buocDaDung` ghi PHIÊN BẢN của từng bước đã dùng — §D.4 cần nó để `steps:impact` biết spec nào bị ảnh
 * hưởng khi một bước tăng số chính.
 */
function sinhThanCase(tc, danhMuc, nguPhap, specDir) {
  const dong = [];
  const chuaDu = [];
  const canImport = new Map(); /* file -> Set<tên hàm> */
  const buocDaDung = new Map(); /* id -> version */
  const theoId = new Map(danhMuc.buoc.map((b) => [b.id, b]));

  const them = (impl) => {
    const { rel, ten } = phanTichImpl(impl);
    const key = duongImport(specDir, rel);
    if (!canImport.has(key)) canImport.set(key, new Set());
    canImport.get(key).add(ten);
    return ten;
  };

  /* ── Tiền điều kiện ── */
  const tdk = tachTienDieuKien(tc.precondition);
  dong.push('    /* ── Tiền điều kiện ── */');
  for (const p of tdk) {
    if (p.method === 'pre_existing' || p.method === 'manual') {
      dong.push(`    /* [${p.method}] ${p.noi_dung} — không dựng bằng máy, chỉ ghi lại để người đọc biết. */`);
      continue;
    }
    if (p.method === null) {
      dong.push(`    // TODO-SETUP (thiếu tag [<method>]): ${p.noi_dung}`);
      chuaDu.push(`TODO-SETUP: ${p.noi_dung.slice(0, 70)}`);
      continue;
    }
    /*
     * CÓ tag phương pháp nhưng bộ biên dịch chưa có đường nối tới factory/hook cụ thể. Ghi `TODO-SETUP`
     * thay vì sinh một lời gọi đoán ra: dựng state sai mà case vẫn chạy thì cái FAIL sinh ra sẽ bị gán
     * sai tầng lỗi, và người ta đi tìm bug sản phẩm cho một setup hỏng.
     */
    dong.push(`    // TODO-SETUP [${p.method}]: ${p.noi_dung}`);
    chuaDu.push(`TODO-SETUP [${p.method}]: ${p.noi_dung.slice(0, 70)}`);
  }

  /* ── Các bước ── */
  dong.push('');
  dong.push('    /* ── Các bước thực hiện ── */');
  let soThuTu = 0;
  /*
   * Lấy câu bước từ MẢNG `steps` mà bộ đọc canonical đã tách, không tự tách lại từ `stepsRaw`.
   *
   * Hai bộ tách sẽ trôi khỏi nhau — đợt này đã trả giá ba lần cho đúng chuyện đó (hai bản lint SQL lệch
   * 4/795 câu; năm bản mẫu PII lệch ở SĐT 9 chữ số). `scripts/lib/testcase` là nguồn duy nhất cho việc
   * đọc testcase, kể cả việc đánh số bước.
   */
  const cacCau = Array.isArray(tc.steps) && tc.steps.length
    ? tc.steps.map((s) => s.text)
    : sm.tachCacBuoc(tc.stepsRaw);
  for (const cau of cacCau) {
    for (const md of sm.tachMenhDe(cau, nguPhap.ngat)) {
      soThuTu += 1;
      const kq = sm.khopCau(md, danhMuc, nguPhap, sm.NGUONG_MAC_DINH);
      if (kq.kieu === 'exact') {
        const b = theoId.get(kq.buoc_id);
        const ten = them(b.impl);
        const dsParam = Object.keys(b.params || {});
        const doi = kq.gia_tri.map((v) => q(v));
        buocDaDung.set(b.id, b.version);
        /*
         * MỖI BƯỚC MỘT ẢNH, và tên step mang MÃ BƯỚC.
         *
         * Hai lý do, cả hai đều bắt buộc:
         *   - Evidence: mức B (CLAUDE.md §4, đổi 22/10/2026) chỉ ĐÒI 1 ảnh ở bước quyết định cho case
         *     thường, và ảnh từng step cho case tầng bug. Bộ biên dịch vẫn chụp MỌI bước, vì lúc sinh
         *     spec chưa biết case sẽ thành tầng bug hay không — chụp đủ thì luôn hợp luật, chụp thiếu
         *     thì case nào hoá bug là thiếu chuỗi và `output_gate` chặn. Đây là lựa chọn ĐỦ-CHO-CẢ-HAI,
         *     không phải vì luật đòi hỏi mức đó với case thường. Bản đầu sinh ra một chuỗi lời gọi
         *     trần, không ảnh nào — tức sinh ra sẵn một case không chứng minh được gì.
         *   - §E cần đo `ti_le_on_dinh` của từng bước. Tên step là chỗ DUY NHẤT nối được một lượt chạy
         *     thật với một mã bước trong danh mục. Khuôn `<id> · <câu>` là hợp đồng với `steps:stats`.
         *
         * Bọc `try/catch` để bước NÉM được ghi là FAILED rồi mới ném tiếp. Không bọc thì `tc.step` không
         * bao giờ chạy, step không có bản ghi nào, và `ti_le_on_dinh` tính ra 100% cho một bước vừa vỡ —
         * một phép đo luôn báo "ổn định" là một phép đo vô dụng.
         */
        const nhanStep = q(`${b.id} · ${md.slice(0, 80)}`);
        dong.push(`    /* ${soThuTu}. ${md} */`);
        dong.push('    try {');
        dong.push(`      await ${ten}(page${doi.length ? `, ${doi.join(', ')}` : ''});`);
        dong.push(`      await tc.step(page, ${nhanStep});`);
        dong.push('    } catch (e) {');
        dong.push(`      await tc.step(page, ${nhanStep}, { status: 'FAILED', comment: \`script_error: \${(e as Error).message}\` });`);
        dong.push('      throw e;');
        dong.push('    }');
        if (dsParam.length !== doi.length) {
          /* Không bao giờ nên xảy ra — `exact` đã đòi khớp số tham số. Để lại máy canh, không để lại niềm tin. */
          dong.push(`    /* ✗ BỘ BIÊN DỊCH SAI: bước ${b.id} cần ${dsParam.length} đối số, dựng được ${doi.length}. */`);
          chuaDu.push(`LOI-BIEN-DICH: ${b.id} lệch số đối số`);
        }
        if (b.status === 'draft') {
          dong.push(`    /* ⚠ bước \`${b.id}\` đang \`draft\` — chưa kiểm chứng, không dùng để kết luận PASS. */`);
          chuaDu.push(`BUOC-DRAFT: ${b.id}`);
        }
      } else if (kq.kieu === 'fuzzy') {
        dong.push(`    // TODO-STEP ${soThuTu}: ${md}`);
        dong.push(`    //   ứng viên: ${kq.ung_vien.map((u) => `${u.id} (${u.diem})`).join(' · ')}`);
        dong.push(`    //   ${kq._vi_sao_khong_exact}`);
        chuaDu.push(`TODO-STEP: ${md.slice(0, 70)}`);
      } else {
        dong.push(`    // TODO-STEP ${soThuTu}: ${md}`);
        chuaDu.push(`TODO-STEP: ${md.slice(0, 70)}`);
      }
    }
  }

  /* ── Kết quả mong đợi ── */
  dong.push('');
  dong.push('    /* ── Kết quả mong đợi ── */');
  /* Cùng lý lẽ với câu bước: dùng mảng `expected` đã tách của bộ đọc canonical. */
  const dsKyVong = Array.isArray(tc.expected) && tc.expected.length
    ? tc.expected.map((x) => x.text).filter(Boolean)
    : String(tc.expectedRaw || '').split(/<br\s*\/?>|\r?\n/i).map((x) => x.trim()).filter(Boolean);
  if (!dsKyVong.length) {
    dong.push('    // TODO-ORACLE: ô `Kết quả mong đợi` RỖNG.');
    chuaDu.push('TODO-ORACLE: ô kỳ vọng rỗng');
  }
  for (const kv of dsKyVong) {
    const r = rutKyVong(kv);
    if (!r) {
      dong.push(`    // TODO-ORACLE: ${kv.slice(0, 110)}`);
      chuaDu.push(`TODO-ORACLE: ${kv.slice(0, 70)}`);
      continue;
    }
    const ten = them(`tests/fe/lib/_checks/index.ts#${r.kiem}`);
    dong.push(`    /* kỳ vọng: ${kv.slice(0, 100)} */`);
    if (r.kiem === 'expectToast') {
      dong.push(`    await ${ten}(page, ${q(r.gia_tri)});`);
    } else {
      /*
       * Ba bộ kiểm còn lại cần thêm thứ bộ biên dịch KHÔNG suy ra được: `expectCell` cần một Locator,
       * `expectPersisted` cần hàm đọc lại, `expectBlocked` cần cả hai vế. Sinh lời gọi thiếu đối số là
       * sinh ra một file không biên dịch nổi — nên ghi TODO kèm ĐÚNG giá trị kỳ vọng đã neo được, để
       * người viết chỉ phải thêm phần máy không biết.
       */
      dong.push(`    // TODO-ORACLE: ${ten}(…, ${q(r.gia_tri)}) — máy neo được GIÁ TRỊ kỳ vọng, nhưng`);
      dong.push('    //   bộ kiểm này còn cần phần máy không suy ra được (locator / hàm đọc lại / vế thứ hai).');
      chuaDu.push(`TODO-ORACLE: ${r.kiem} thiếu đối số không suy được`);
    }
  }

  return { dong, chuaDu, canImport, buocDaDung };
}

/** Sinh cả file spec cho một nhóm case. */
function sinhFile({ taskKey, nhanFile, cases, danhMuc, nguPhap, specDir }) {
  const thanCase = [];
  const canImport = new Map();
  let soDu = 0;

  for (const tc of cases) {
    const r = sinhThanCase(tc, danhMuc, nguPhap, specDir);
    for (const [k, v] of r.canImport) {
      if (!canImport.has(k)) canImport.set(k, new Set());
      for (const x of v) canImport.get(k).add(x);
    }
    const du = r.chuaDu.length === 0;
    if (du) soDu += 1;

    const phienBan = [...r.buocDaDung.entries()].map(([id, v]) => `${id}@${v}`);
    const dau = [];
    dau.push('  /*');
    dau.push(`   * ${tc.tcId} — ${String(tc.title || tc.caseName || '').slice(0, 100)}`);
    dau.push(`   * Module: ${tc.module || '(không khai)'}`);
    if (phienBan.length) dau.push(`   * Bước đã dùng: ${phienBan.join(' · ')}`);
    else dau.push('   * Bước đã dùng: (không bước nào khớp)');
    if (!du) {
      dau.push(`   * ${DAU_CHUA_DU} — ${r.chuaDu.length} chỗ còn thiếu:`);
      for (const x of r.chuaDu.slice(0, 8)) dau.push(`   *   - ${x}`);
      if (r.chuaDu.length > 8) dau.push(`   *   - … +${r.chuaDu.length - 8} chỗ nữa`);
    } else {
      dau.push(`   * ${DAU_DU} — mọi bước khớp, mọi dòng kỳ vọng neo được.`);
    }
    dau.push('   */');

    const moTa = q(`${tc.tcId} · ${String(tc.title || tc.caseName || '').slice(0, 90)}`);
    thanCase.push(dau.join('\n'));
    if (du) {
      thanCase.push(`  test(${moTa}, async ({ page }) => {`);
      thanCase.push(`    const tc = rec.case(${q(tc.tcId)});`);
    } else {
      /*
       * `test.skip` — không `test()` thường, và cũng không `test.fail()`.
       *
       * `test()` thường: thân chỉ còn vài lời gọi khớp được, nên nó XANH mà chẳng kiểm gì, và một case
       * chưa làm xong được đếm vào cột PASS. `test.fail()`: Playwright coi là ĐẠT khi nó đỏ, nên vẫn
       * thành PASS trong báo cáo. `test.skip` là cách duy nhất khiến kết quả KHÔNG BAO GIỜ là PASS.
       */
      thanCase.push(`  test.skip(${moTa}, async ({ page }) => {`);
      thanCase.push(`    const tc = rec.case(${q(tc.tcId)});`);
      thanCase.push(`    /* ${DAU_CHUA_DU}: case này CHƯA ĐỦ để phán. Điền hết TODO rồi đổi \`test.skip\` thành \`test\`. */`);
    }
    /* Dùng lại `r.dong` — bản đầu gọi `sinhThanCase` lần thứ hai ở đây, tức sinh cùng một thân hai lượt. */
    thanCase.push(...r.dong);
    thanCase.push('');
    thanCase.push(`    await tc.finish(${du ? "'PASS'" : "'SKIP'"});`);
    thanCase.push('  });');
    thanCase.push('');
  }

  const dsImport = [];
  for (const [p, tens] of [...canImport.entries()].sort()) {
    dsImport.push(`import { ${[...tens].sort().join(', ')} } from '${p}';`);
  }

  const dauFile = [
    '/*',
    ` * SINH TỰ ĐỘNG bởi \`compile:spec\` (v2.8.0 §D) — 0 token AI. ĐỪNG sửa tay rồi sinh lại.`,
    ` *`,
    ` * Task ${taskKey} · ${cases.length} case · ${soDu} case sinh được ĐỦ · ${cases.length - soDu} case còn TODO.`,
    ` *`,
    ` * Case còn TODO được sinh dưới dạng \`test.skip\`, nên nó KHÔNG BAO GIỜ thành PASS. Điền hết TODO rồi`,
    ` * đổi \`test.skip\` thành \`test\`. \`compile:check\` canh đúng luật đó: file còn TODO mà đã bỏ \`skip\``,
    ` * là CHẶN.`,
    ` *`,
    ` * Nguồn: MD canonical. Bộ biên dịch KHÔNG đọc Excel, KHÔNG đọc Sheet.`,
    ' */',
    "import { test } from '@playwright/test';",
    ...dsImport,
    '',
    "const { EvidenceRecorder } = require('" + duongImport(specDir, 'scripts/utils/evidence_recorder.js').replace(/\.js$/, '') + "');",
    '',
    `const TASK_KEY = ${q(taskKey)};`,
    'const rec = new EvidenceRecorder({',
    '  taskKey: TASK_KEY,',
    "  projectOutputDir: process.env.PROJECT_OUTPUT_DIR || '',",
    '  runId: process.env.RUN_ID || `local-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, \'\')}`,',
    '});',
    '',
    'test.afterAll(async () => { await rec.write(); });',
    '',
    `test.describe(${q(`${taskKey} · ${nhanFile}`)}, () => {`,
  ];

  return { noiDung: `${dauFile.join('\n')}\n${thanCase.join('\n')}});\n`, so_du: soDu, so_case: cases.length };
}

/* ────────────────────────── ĐIỀU PHỐI ────────────────────────── */

function bienDich({ taskKey, taskOutputDir, duongMd, outDir }) {
  const danhMuc = sm.napDanhMuc();
  if (!danhMuc) return { loi: 'khong-co-danh-muc' };
  const cases = sm.docCase(duongMd, taskOutputDir);
  if (!cases.length) return { loi: 'khong-co-case' };

  const nguPhap = sm.napNguPhap();
  const specDir = outDir;
  fs.mkdirSync(specDir, { recursive: true });

  /*
   * Gom theo ĐOẠN ĐẦU của `Module` (phần trước dấu `/`), không theo module đầy đủ.
   *
   * Đo trên CSDL-9001: 213 case có **196** module đầy đủ khác nhau nhưng chỉ **5** đoạn đầu. Gom theo
   * module đầy đủ sinh ra 196 file cho 213 case — đúng kỹ thuật, và vô dụng. Đoạn đầu là MÀN/CHỨC NĂNG
   * (`Cập nhật hồ sơ trường`), đoạn sau là tình huống cụ thể; gom theo màn mới là đơn vị mà
   * `steps:impact` khoanh được vùng ảnh hưởng.
   */
  const theoModule = new Map();
  for (const tc of cases) {
    const day = tc.module || '(khong-module)';
    const k = day.split('/')[0].trim() || day;
    if (!theoModule.has(k)) theoModule.set(k, []);
    theoModule.get(k).push(tc);
  }

  /*
   * SINH NỐT `playwright.task.config.js` — qua MỘT NGUỒN dùng chung với `smoke:gen`.
   *
   * Không có nó thì spec sinh ra KHÔNG CHẠY ĐƯỢC: config gốc khai `testDir` là `./tests` và không
   * project nào trỏ tới `outputs/**`, nên gọi thẳng file spec ở đây trả "No tests found" — đo được ở
   * CSDL-9001 ngày 30/09/2026, và đo lại ngày 12/10 khi `smoke:gen` sinh spec đầu tiên của nó.
   *
   * Bản đầu CHÉP cả khối sinh config vào đây. `smoke:gen` cần đúng thứ đó, và lúc đó thành hai bản sao —
   * đợt này đã trả giá bốn lần cho chuyện hai bản sao trôi khỏi nhau. Lý lẽ của từng cái bẫy trong file
   * config (reporter đường dẫn tương đối · cố ý không sửa config gốc) nằm ở `lib/pw_task_config.js`.
   */
  pwConfig.ghiConfigTask(specDir, taskKey);

  const raFile = [];
  /*
   * CHỐNG TRÙNG TÊN FILE. Cắt 60 ký tự làm hai module khác nhau ra cùng một slug, và `writeFileSync` thứ
   * hai GHI ĐÈ file thứ nhất — im lặng, mất trọn case của module trước. Đo được ở CSDL-9001: `compile:
   * spec` báo 196 file, trên đĩa chỉ có 195, và không gì nói ra. Cùng một lớp lỗi với chuyện Excel mất
   * 129 ô: con số báo ra và hiện thực lệch nhau mà không ai thấy.
   */
  const daDung = new Map();
  const trungTen = [];
  for (const [mod, ds] of theoModule) {
    let ten = sm.boDau(mod).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'khong-module';
    if (daDung.has(ten)) {
      const n = daDung.get(ten) + 1;
      daDung.set(ten, n);
      trungTen.push({ slug: ten, module: mod, thanh: `${ten}-${n}` });
      ten = `${ten}-${n}`;
    }
    daDung.set(ten, daDung.get(ten) || 1);
    const f = path.join(specDir, `${ten}.spec.ts`);
    const r = sinhFile({ taskKey, nhanFile: mod, cases: ds, danhMuc, nguPhap, specDir });
    fs.writeFileSync(f, r.noiDung, 'utf8');
    raFile.push({ file: path.relative(REPO, f).replace(/\\/g, '/'), module: mod, so_case: r.so_case, so_du: r.so_du });
  }

  /* Máy canh chính phép đếm: số file BÁO RA phải bằng số file trên ĐĨA. */
  const trenDia = fs.readdirSync(specDir).filter((x) => x.endsWith('.spec.ts')).length;
  if (trenDia !== raFile.length) {
    throw new Error(
      `compile:spec: báo ${raFile.length} file nhưng trên đĩa có ${trenDia}. Có file bị ghi đè — `
      + 'đừng tin con số báo ra cho tới khi sửa xong.',
    );
  }

  return {
    task: taskKey,
    so_case: cases.length,
    so_du: raFile.reduce((s, x) => s + x.so_du, 0),
    so_file: raFile.length,
    trung_ten: trungTen,
    file: raFile,
    _thieu_ngu_phap: nguPhap.thieu,
    so_muc_danh_muc: danhMuc.buoc.length,
  };
}

function main() {
  const argv = process.argv;
  const val = (nhan, md) => {
    const i = argv.indexOf(`--${nhan}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : md;
  };
  const duongMd = val('md', null);
  let taskKey = val('task', null);
  let taskOutputDir = null;

  if (!duongMd) {
    try {
      rc.loadEnvFiles();
      taskKey = taskKey || process.env.TASK_KEY || rc.getTaskKey();
      taskOutputDir = rc.getTaskOutputDir({ taskKey });
    } catch (e) {
      console.error(`[compile-spec] ✗ không xác định được task: ${e.message}`);
      process.exit(2);
    }
  }
  taskKey = taskKey || 'FIXTURE';
  const outDir = val('out', null)
    ? path.resolve(REPO, val('out', ''))
    : path.join(taskOutputDir || path.join(REPO, 'outputs', '_scratch'), 'automation', 'compiled');

  const d = bienDich({ taskKey, taskOutputDir, duongMd, outDir });

  if (d.loi === 'khong-co-danh-muc') {
    console.error('[compile-spec] CHƯA ĐƯỢC GÁC — không đọc được `tests/fe/lib/step_catalog.json`.');
    process.exit(2);
  }
  if (d.loi === 'khong-co-case') {
    console.error('[compile-spec] CHƯA ĐƯỢC GÁC — 0 case đọc được.');
    process.exit(2);
  }

  if (argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); return; }

  const pc = d.so_case ? Math.round((d.so_du / d.so_case) * 100) : 0;
  console.log(`[compile-spec] Task ${d.task} · danh mục ${d.so_muc_danh_muc} mục · ${d.so_case} case → ${d.so_file} file`);
  console.log(`               sinh ĐỦ: ${d.so_du}/${d.so_case} (${pc}%) · còn TODO: ${d.so_case - d.so_du}/${d.so_case}`);
  console.log('');
  for (const f of d.file) console.log(`  ${f.so_du}/${f.so_case}  ${f.file}`);
  console.log('');
  console.log('Case còn TODO là `test.skip` ⇒ KHÔNG BAO GIỜ thành PASS. Điền TODO rồi bỏ `skip`.');
  console.log('`compile:check` canh luật đó; spec sinh ra vẫn phải qua `lint:locator` và `output_gate`.');
  if (d._thieu_ngu_phap) console.log('⚠ thiếu `.agent/config/step_phrasing.json` ⇒ tỉ lệ khớp thấp hơn thật.');
}

if (require.main === module) main();

module.exports = {
  bienDich, sinhFile, sinhThanCase, tachTienDieuKien, rutKyVong, phanTichImpl, duongImport,
  DAU_CHUA_DU, DAU_DU, METHODS,
};
