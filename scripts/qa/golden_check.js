#!/usr/bin/env node
'use strict';
/*
 * golden_check — BỘ DỮ LIỆU VÀNG cho parser canonical, và HAI PHÉP ĐẾM ĐỘC LẬP (v2.7.0 §A10.4 + §A10.5).
 *
 * VÌ SAO NEO VÀO PARSER NÀY. `scripts/lib/testcase` là chỗ 30 file cùng dùng: mọi gate đọc testcase đều
 * đi qua nó. Một thay đổi nhỏ ở đây — bóc thêm một dải icon, chuẩn hoá thêm một loại khoảng trắng, đổi
 * cách tách bước đánh số — đổi đầu ra của CẢ 30 gate một lúc, và không gì so hai bên. Bộ test hiện có
 * kiểm từng hành vi riêng, nhưng không bộ nào đóng băng ĐẦU RA TOÀN PHẦN trên một tập đầu vào cố định.
 *
 * Lớp lỗi này đã xảy ra thật và đắt: một lượt đọc `.xlsx` đếm 194 case thành 1.179 vì ô stub `t:z` rơi
 * vào nhánh `String(ô)` ra `"[object Object]"`. Số sai đó đi vào fixture, vào báo cáo coverage, và chỉ
 * lộ ra nhiều lượt sau.
 *
 * HAI PHẦN, và phần thứ hai mới là phần khó bịa:
 *
 *   1. §A10.4 — so đầu ra parser với `expected.json` ĐÓNG BĂNG. Lệch là CHẶN. `--write` sinh lại, nhưng
 *      sinh lại là một LỜI KHAI ("tôi đã đổi parser và đầu ra mới mới là đúng"), nên nó in cảnh báo và
 *      đòi `--toi-da-doi-parser`.
 *   2. §A10.5 — ĐẾM SỐ CASE BẰNG HAI ĐƯỜNG ĐỘC LẬP: (a) `doc.tests.length` của model canonical, và
 *      (b) đếm thô số hàng thân bảng có TC ID, không qua model. Hai đường lệch nhau ⇒ `NGHI GATE SAI`,
 *      vì lúc đó không biết tin bên nào, và "không biết tin bên nào" KHÔNG phải "đạt".
 *
 * Vì sao phép đếm thứ hai phải NGOÀI model: nếu nó cũng gọi `parseMarkdown` thì hai đường cùng sai một
 * lúc, và phép đối chiếu không phát hiện gì. Một bộ đo kiểm chính nó bằng chính nó là tautology — đúng
 * điều non-negotiable §3 cấm ở tầng testcase, và nó cũng sai ở tầng máy gác.
 *
 * Dùng:
 *   node scripts/qa/golden_check.js [--write [--toi-da-doi-parser]] [--json]
 *
 * Exit: 0 · 1 khi lệch mốc hoặc hai phép đếm không khớp · 2 khi không đọc được fixture
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const canonical = require(path.join(REPO, 'scripts', 'lib', 'testcase'));
const BO = path.join(REPO, 'tests', 'fe', 'fixtures', 'golden', 'testcase');
const MOC = path.join(BO, 'expected.json');

const WRITE = process.argv.includes('--write');
const DA_DOI = process.argv.includes('--toi-da-doi-parser');
const JSON_OUT = process.argv.includes('--json');

/**
 * ĐẾM THÔ số case — KHÔNG qua model canonical, cố ý.
 *
 * Luật: một hàng thân bảng là hàng bắt đầu bằng `|`, không phải hàng ngăn (`|---|`), không phải hàng
 * header, và ô đầu tiên khớp khuôn TC ID. Khuôn TC ID lấy từ `gate_engine` để không có hai định nghĩa.
 *
 * Đây là phép đếm NGÂY THƠ và nó phải ngây thơ: giá trị của nó nằm ở chỗ nó KHÔNG dùng chung đường đi
 * với model. Nó không hiểu ô gộp, không hiểu `<br>`, không hiểu sheet — và đúng vì vậy nó bắt được lúc
 * model hiểu sai.
 */
function demTho(md) {
  const RE_TC = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+$/;
  let n = 0;
  for (const dong of String(md).split(/\r?\n/)) {
    const d = dong.trim();
    if (!d.startsWith('|')) continue;
    if (/^\|[\s|:-]+\|$/.test(d)) continue;
    const o = d.split('|').map((x) => x.trim()).filter((x, i, a) => !(i === 0 || i === a.length - 1));
    if (!o.length) continue;
    if (RE_TC.test(o[0])) n += 1;
  }
  return n;
}

/**
 * ẢNH CHỤP đầu ra parser cho một fixture — chọn trường nào vào mốc, và vì sao đúng từng ấy.
 *
 * KHÔNG đóng băng cả `doc`: `_cells` mang nguyên văn mọi ô nên mốc sẽ phình và mọi sửa nhãn cột thành
 * CHẶN. Đóng băng đúng phần mà 30 gate tiêu thụ, cộng những trường mà bẫy ký tự và bẫy đánh số đi qua.
 */
function anh(md) {
  const doc = canonical.parseMarkdown(md);
  return {
    so_case: doc.tests.length,
    so_warning: (doc.warnings || []).length,
    headers: doc.headers,
    case: doc.tests.map((t) => ({
      tcId: t.tcId,
      module: t.module,
      title: t.title,
      caseType: t.caseType,
      tags: t.tags,
      techniques: t.techniques,
      oracleRefs: t.oracleRefs,
      dimensions: t.dimensions,
      precondition: t.precondition,
      data: t.data,
      stepsRaw: t.stepsRaw,
      expectedRaw: t.expectedRaw,
      so_buoc: (t.steps || []).length,
      so_ky_vong: (t.expected || []).length,
      priority: t.priority,
      risk: t.risk,
    })),
  };
}

function docFixture() {
  if (!fs.existsSync(BO)) {
    console.error(`[golden] ✗ không có thư mục fixture ${path.relative(REPO, BO)}`);
    process.exit(2);
  }
  const files = fs.readdirSync(BO).filter((f) => f.endsWith('.md')).sort();
  if (!files.length) {
    console.error('[golden] ✗ 0 fixture .md — phép đo hỏng, không phải "sạch".');
    process.exit(2);
  }
  return files;
}

function dungDo() {
  const files = docFixture();
  const hien = {};
  const demLech = [];
  for (const f of files) {
    const md = fs.readFileSync(path.join(BO, f), 'utf8');
    hien[f] = anh(md);
    const tho = demTho(md);
    if (tho !== hien[f].so_case) demLech.push({ file: f, model: hien[f].so_case, tho });
  }
  return { files, hien, demLech };
}

/** So hai ảnh, trả danh sách đường dẫn khác nhau — in đường dẫn chứ không in cả cây. */
function soAnh(cu, moi, duong = '') {
  const ra = [];
  if (cu === null || moi === null || typeof cu !== typeof moi
      || typeof cu !== 'object' || Array.isArray(cu) !== Array.isArray(moi)) {
    if (JSON.stringify(cu) !== JSON.stringify(moi)) {
      ra.push({ duong: duong || '(gốc)', cu: JSON.stringify(cu), moi: JSON.stringify(moi) });
    }
    return ra;
  }
  const khoa = [...new Set([...Object.keys(cu), ...Object.keys(moi)])];
  for (const k of khoa) {
    const d = duong ? `${duong}.${k}` : k;
    if (!(k in cu)) { ra.push({ duong: d, cu: '(không có)', moi: JSON.stringify(moi[k]) }); continue; }
    if (!(k in moi)) { ra.push({ duong: d, cu: JSON.stringify(cu[k]), moi: '(không có)' }); continue; }
    ra.push(...soAnh(cu[k], moi[k], d));
  }
  return ra;
}

function main() {
  const { files, hien, demLech } = dungDo();

  if (WRITE) {
    if (!DA_DOI) {
      console.error('[golden] CHẶN sinh lại mốc: thiếu `--toi-da-doi-parser`.');
      console.error('  Sinh lại mốc là một LỜI KHAI, không phải một lệnh dọn dẹp. Nó nói: "tôi đã đổi');
      console.error('  parser canonical, và đầu ra MỚI mới là đúng". Nếu bạn không đổi parser mà mốc vẫn');
      console.error('  lệch thì chuyện cần làm là tìm xem cái gì đã đổi, không phải ghi lại mốc.');
      process.exit(1);
    }
    fs.writeFileSync(MOC, `${JSON.stringify({
      _y: 'MỐC ĐÓNG BĂNG đầu ra parser canonical trên bộ fixture vàng (v2.7.0 §A10.4). Lệch mốc = CHẶN.',
      _sinh_boi: 'node scripts/qa/golden_check.js --write --toi-da-doi-parser',
      _canh_bao: 'Sinh lại file này là LỜI KHAI rằng parser đã đổi có chủ đích. Mốc tự ghi lại thì nó không còn là mốc.',
      bo: hien,
    }, null, 2)}\n`, 'utf8');
    console.log(`[golden] đã ghi mốc cho ${files.length} fixture → ${path.relative(REPO, MOC)}`);
    return;
  }

  if (!fs.existsSync(MOC)) {
    console.error('[golden] CHƯA ĐƯỢC GÁC — không có `expected.json`.');
    console.error('  Chụp mốc bằng: node scripts/qa/golden_check.js --write --toi-da-doi-parser');
    process.exit(2);
  }

  const moc = JSON.parse(fs.readFileSync(MOC, 'utf8')).bo || {};
  const lech = [];
  for (const f of files) {
    if (!moc[f]) { lech.push({ file: f, khac: [{ duong: '(cả fixture)', cu: '(không có trong mốc)', moi: 'có' }] }); continue; }
    const k = soAnh(moc[f], hien[f]);
    if (k.length) lech.push({ file: f, khac: k });
  }
  for (const f of Object.keys(moc)) {
    if (!files.includes(f)) lech.push({ file: f, khac: [{ duong: '(cả fixture)', cu: 'có trong mốc', moi: '(đã xoá)' }] });
  }

  const kq = { so_fixture: files.length, lech, dem_lech: demLech };
  if (JSON_OUT) {
    console.log(JSON.stringify(kq, null, 2));
    process.exit(lech.length || demLech.length ? 1 : 0);
  }

  if (demLech.length) {
    console.error(`[golden] ✗ NGHI GATE SAI — ${demLech.length} fixture có HAI PHÉP ĐẾM LỆCH NHAU:`);
    for (const x of demLech) console.error(`  ${x.file}: model canonical ${x.model} case · đếm thô ${x.tho} case`);
    console.error('  Hai đường đo độc lập cho hai số khác nhau, nên KHÔNG BIẾT TIN BÊN NÀO. Đây không phải');
    console.error('  "đạt", cũng không phải "fixture sai" — phải đi tìm bên nào sai trước khi tin số nào.');
  }

  if (lech.length) {
    console.error(`[golden] ✗ ${lech.length}/${files.length} fixture LỆCH MỐC:`);
    for (const x of lech) {
      console.error(`  ${x.file} — ${x.khac.length} chỗ khác:`);
      for (const k of x.khac.slice(0, 8)) {
        console.error(`    ${k.duong}`);
        console.error(`      mốc:  ${String(k.cu).slice(0, 160)}`);
        console.error(`      giờ:  ${String(k.moi).slice(0, 160)}`);
      }
      if (x.khac.length > 8) console.error(`    … +${x.khac.length - 8} chỗ nữa`);
    }
    console.error('  Parser canonical là chỗ 30 gate cùng dùng: một thay đổi ở đây đổi đầu ra của cả 30 cùng lúc.');
  }

  if (lech.length || demLech.length) process.exit(1);
  const tongCase = files.reduce((s, f) => s + hien[f].so_case, 0);
  console.log(`[golden] ✓ ${files.length} fixture · ${tongCase} case khớp mốc, và hai phép đếm độc lập cho cùng một số.`);
}

if (require.main === module) main();

module.exports = { demTho, anh, soAnh, dungDo, BO, MOC };
