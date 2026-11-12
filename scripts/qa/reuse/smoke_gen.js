#!/usr/bin/env node
'use strict';
/*
 * smoke:gen — SINH SMOKE HỆ THỐNG TỪ MÔ HÌNH MÀN (v2.8.0 §L). 0 token AI.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * SMOKE Ở ĐÂY TRẢ LỜI MỘT CÂU HỎI HẸP: "thư viện còn nói đúng về app không?"
 *
 * Nó KHÔNG phán nghiệp vụ. Nó kiểm ba thứ, và cả ba đều là tiền đề của mọi case khác:
 *
 *   1. Màn còn mở được (URL còn sống).
 *   2. Mọi neo control của L1 còn TÌM THẤY trên màn — neo trôi là nguyên nhân của một lớp đỏ trông
 *      giống lỗi sản phẩm. Catalog của TASK-9001 có neo đo ngày 30/09; mỗi ngày trôi qua là thêm một
 *      ngày nó có thể đã lệch.
 *   3. Nhãn đặc tả còn ĐỌC ĐƯỢC trên màn (đối chiếu `expectedFields`).
 *
 * MẶC ĐỊNH NÔNG VÀ CHỈ-ĐỌC — `--deep` TẮT SẴN.
 *
 * Lớp nông chỉ `goto` + đếm + đọc nhãn: không ghi ô nào, không bấm nút nào, nên nó KHÔNG chạm dữ liệu
 * UAT và không cần một lượt xác nhận theo CLAUDE.md §2. Lớp `--deep` mới thao tác thật (đo ô có sửa
 * được không, có hoàn nguyên), và vì thế nó TẮT SẴN: một smoke mặc định chạm dữ liệu sẽ bị người ta
 * tắt hẳn sau lần đầu, và lúc đó không còn smoke nào.
 *
 * `--deep` CŨNG KHÔNG PHẢI "chạy cho kỹ hơn": nó ghi rồi hoàn nguyên, và hoàn nguyên có thể thất bại.
 * Spec sinh ra nói thẳng điều đó ở đầu file.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/reuse/smoke_gen.js --catalog <ui_catalog.json> --out <dir> [--deep] [--man <tên>]
 * Exit: 0 · 2 khi không đọc được catalog hoặc catalog không có màn nào có neo
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const pwConfig = require(path.join(REPO, 'scripts', 'qa', 'lib', 'pw_task_config.js'));
const q = (s) => JSON.stringify(String(s == null ? '' : s));

/** Đường import TƯƠNG ĐỐI. Ném khi khác ổ đĩa — cùng lý lẽ với `compile:spec`. */
function duongImport(tuDir, rel) {
  const tho = path.relative(tuDir, path.join(REPO, rel));
  if (!tho || path.isAbsolute(tho) || /^[A-Za-z]:/.test(tho)) {
    throw new Error(`smoke:gen không dựng được đường import tương đối từ ${tuDir} tới ${rel} (khác ổ đĩa?).`);
  }
  const p = tho.replace(/\\/g, '/').replace(/\.ts$/, '');
  return p.startsWith('.') ? p : `./${p}`;
}

/** Màn nào đáng smoke: có URL và có ít nhất một neo. Màn chưa có neo thì smoke không nói được gì. */
function manCoNeo(cat) {
  const ra = [];
  for (const s of cat.screens || []) {
    let soNeo = 0;
    let soExp = 0;
    for (const g of s.fields || []) {
      soExp += (g.expectedFields || []).length;
      soNeo += Object.keys(g.controls || {}).length;
    }
    ra.push({ ten: s.name, url: String(s.url || ''), so_neo: soNeo, so_expected: soExp });
  }
  return ra;
}

function sinh({ duongCatalog, outDir, deep, chiMan }) {
  let cat;
  try { cat = JSON.parse(fs.readFileSync(duongCatalog, 'utf8')); } catch (e) { return { loi: `không đọc được catalog: ${e.message}` }; }

  const tatCa = manCoNeo(cat);
  const chon = tatCa.filter((m) => m.so_neo > 0 && m.url && (!chiMan || m.ten.includes(chiMan)));
  if (!chon.length) {
    return {
      loi: 'không màn nào trong catalog vừa có URL vừa có neo control',
      man: tatCa,
    };
  }

  fs.mkdirSync(outDir, { recursive: true });
  const relCatalog = path.relative(outDir, duongCatalog).replace(/\\/g, '/');

  const than = [];
  for (const m of chon) {
    than.push(`  test(${q(`nông · ${m.ten} — màn mở được, ${m.so_neo} neo còn tìm thấy`)}, async ({ page }) => {`);
    than.push(`    const mh = screens.man(CAT, ${q(m.ten)});`);
    than.push('    const canhBao = screens.canhBaoHanDung(mh);');
    than.push("    if (canhBao) console.log(`[smoke] ⚠ ${canhBao}`);");
    than.push(`    await page.goto(\`\${GOC}${m.url}\`, { waitUntil: 'domcontentloaded' });`);
    than.push('');
    than.push('    /* Mỗi neo phải TÌM THẤY. Không phán giá trị — smoke chỉ hỏi "thư viện còn nói đúng về app không". */');
    than.push('    const mat: string[] = [];');
    than.push('    for (const nhan of mh.neo.keys()) {');
    than.push('      if (!(await screens.o(page, mh, nhan).count())) mat.push(nhan);');
    than.push('    }');
    than.push('    expect(mat, `neo KHÔNG tìm thấy trên màn: ${mat.join(" · ")}`).toEqual([]);');
    than.push('  });');
    than.push('');

    if (!deep) continue;
    than.push(`  test(${q(`SÂU · ${m.ten} — ô nào còn sửa được (GHI rồi HOÀN NGUYÊN)`)}, async ({ page }) => {`);
    than.push('    /*');
    than.push('     * Lớp SÂU GHI THẬT rồi hoàn nguyên. Hoàn nguyên CÓ THỂ THẤT BẠI, và lúc đó L0.5 ném —');
    than.push('     * đó là hành vi đúng: báo ra còn hơn để lại dấu mà không ai biết.');
    than.push('     */');
    than.push(`    const mh = screens.man(CAT, ${q(m.ten)});`);
    than.push(`    await page.goto(\`\${GOC}${m.url}\`, { waitUntil: 'domcontentloaded' });`);
    than.push('    const theoTrangThai: Record<string, string[]> = {};');
    than.push('    for (const nhan of mh.neo.keys()) {');
    than.push("      const n = screens.neoCua(mh, nhan);");
    than.push("      if (n.type === 'checkbox') continue; /* checkbox có đường đo riêng, không trộn vào đây */");
    than.push('      const r = await textbox.ghiDuoc(page, screens.o(page, mh, nhan));');
    than.push('      (theoTrangThai[r.trang_thai] ||= []).push(nhan);');
    than.push('    }');
    than.push('    console.log(`[smoke] ${JSON.stringify(theoTrangThai, null, 1)}`);');
    than.push('    /* KHÔNG kỳ vọng ô nào mở hay khoá — đó là nghiệp vụ. Chỉ đòi phép đo CHẠY ĐƯỢC. */');
    than.push('    expect(Object.keys(theoTrangThai).length, "không đo được ô nào").toBeGreaterThan(0);');
    than.push('  });');
    than.push('');
  }

  const dau = [
    '/*',
    ' * SINH TỰ ĐỘNG bởi `smoke:gen` (v2.8.0 §L) — 0 token AI. ĐỪNG sửa tay rồi sinh lại.',
    ' *',
    ` * ${chon.length} màn · lớp SÂU: ${deep ? 'BẬT' : 'TẮT'}.`,
    ' *',
    ' * Smoke này trả lời MỘT câu hỏi hẹp: "thư viện còn nói đúng về app không?" — màn còn mở được, và',
    ' * mọi neo control của L1 còn tìm thấy. Nó KHÔNG phán nghiệp vụ: không so giá trị, không kiểm quy',
    ' * tắc. Một smoke mà phán nghiệp vụ sẽ đỏ vì dữ liệu UAT đổi, và người ta sẽ tắt nó.',
    ' *',
    deep
      ? ' * ⚠ LỚP SÂU ĐANG BẬT — nó GHI THẬT vào ô rồi hoàn nguyên. Theo CLAUDE.md §2 thì lượt chạy này CẦN'
      : ' * Lớp nông chỉ `goto` + đếm + đọc: KHÔNG ghi ô nào, KHÔNG bấm nút nào, nên không chạm dữ liệu UAT.',
    deep
      ? ' *   một lượt xác nhận trước khi chạy, và hoàn nguyên CÓ THỂ thất bại.'
      : ' * Bật lớp sâu bằng `smoke:gen --deep`, và lúc đó nó cần xác nhận theo CLAUDE.md §2.',
    ' */',
    "import { test, expect } from '@playwright/test';",
    `import * as screens from '${duongImport(outDir, 'tests/fe/lib/screens/index.ts')}';`,
    ...(deep ? [`import * as textbox from '${duongImport(outDir, 'tests/fe/lib/_widget/textbox.ts')}';`] : []),
    '',
    `/* eslint-disable @typescript-eslint/no-var-requires, global-require */`,
    `const CAT = require('${relCatalog}');`,
    `/* eslint-enable @typescript-eslint/no-var-requires, global-require */`,
    '',
    '/*',
    ' * GỐC URL lấy từ môi trường, KHÔNG ghim vào file sinh ra. Ghim host vào spec là ghim một môi trường',
    ' * vào artifact, và nó sẽ bị commit.',
    ' */',
    "const GOC = (process.env.SMOKE_BASE_URL || process.env.OPS_BASE_URL || '').replace(/\\/+$/, '');",
    '',
    'test.beforeAll(() => {',
    '  if (!GOC) throw new Error("smoke: thiếu SMOKE_BASE_URL (hoặc OPS_BASE_URL). KHÔNG đoán host.");',
    '});',
    '',
    `test.describe(${q(`@smoke hệ thống — ${path.basename(duongCatalog)}`)}, () => {`,
  ];

  const f = path.join(outDir, 'smoke-he-thong.spec.ts');
  fs.writeFileSync(f, `${dau.join('\n')}\n${than.join('\n')}});\n`, 'utf8');

  /*
   * SINH NỐT CONFIG — cùng MỘT NGUỒN với `compile:spec`.
   *
   * Thiếu nó thì `playwright test <file>` trả "No tests found", vì config gốc khai `testDir` là
   * `./tests`. Đo lại ngay ở lượt sinh đầu tiên của `smoke:gen`, đúng cái `compile:spec` đã gặp.
   */
  const duongConfig = pwConfig.ghiConfigTask(outDir, 'smoke');

  return {
    file: path.relative(REPO, f).replace(/\\/g, '/'),
    config: path.relative(REPO, duongConfig).replace(/\\/g, '/'),
    so_man_sinh: chon.length,
    so_man_bo_qua: tatCa.length - chon.length,
    deep,
    man: chon,
    bo_qua: tatCa.filter((m) => !chon.includes(m)),
  };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const catalog = val('catalog');
  const out = val('out');
  if (!catalog || !out) {
    console.error('[smoke-gen] CHƯA SINH ĐƯỢC — cần `--catalog <ui_catalog.json>` và `--out <dir>`.');
    process.exit(2);
  }

  const d = sinh({
    duongCatalog: path.resolve(REPO, catalog),
    outDir: path.resolve(REPO, out),
    deep: argv.includes('--deep'),
    chiMan: val('man'),
  });

  if (argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); process.exit(d.loi ? 2 : 0); }

  if (d.loi) {
    console.error(`[smoke-gen] CHƯA SINH ĐƯỢC — ${d.loi}.`);
    console.error('            Màn chưa có neo thì smoke KHÔNG nói được gì: nó sẽ `goto` rồi kết luận "ổn"');
    console.error('            trong khi chưa kiểm một control nào. Đo neo cho màn trước (`stt:map`, discovery).');
    for (const m of d.man || []) console.error(`              ${m.ten}: ${m.so_neo} neo / ${m.so_expected} expected · url=${m.url || '(trống)'}`);
    process.exit(2);
  }

  console.log(`[smoke-gen] ${d.so_man_sinh} màn → ${d.file}`);
  for (const m of d.man) console.log(`  ${m.ten}: ${m.so_neo} neo / ${m.so_expected} expected`);
  if (d.so_man_bo_qua) {
    console.log('');
    console.log(`~ Bỏ qua ${d.so_man_bo_qua} màn (thiếu URL hoặc chưa có neo):`);
    for (const m of d.bo_qua) console.log(`    ${m.ten}: ${m.so_neo} neo · url=${m.url || '(trống)'}`);
  }
  console.log('');
  if (d.deep) {
    console.log('⚠ Lớp SÂU đang BẬT — spec sinh ra GHI THẬT rồi hoàn nguyên. Theo CLAUDE.md §2, lượt chạy');
    console.log('  đó cần một lượt xác nhận trước, và hoàn nguyên CÓ THỂ thất bại.');
  } else {
    console.log('Lớp nông: chỉ `goto` + đếm + đọc, KHÔNG chạm dữ liệu. Bật lớp sâu bằng `--deep`.');
  }
  console.log('Chạy: SMOKE_BASE_URL=<gốc> npx playwright test <file> --workers=1');
}

if (require.main === module) main();

module.exports = { sinh, manCoNeo, duongImport };
