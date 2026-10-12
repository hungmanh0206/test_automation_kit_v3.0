#!/usr/bin/env node
'use strict';
/*
 * rule_coverage — BẢN ĐỒ LUẬT → GATE → SPEC (v2.7.0 §A10.7).
 *
 * VÌ SAO CẦN. Kit có 102 máy gác và một file luật canonical dài. Không chỗ nào trả lời được câu đơn
 * giản nhất: **luật nào đang có máy thi hành, và luật nào chỉ nói bằng chữ.** Thiếu câu đó thì "kit có
 * 102 gate" nghe như một bảo đảm, trong khi nó không nói gì về việc 102 cái đó phủ đúng chỗ nào.
 *
 * VÀ KHÔNG ĐƯỢC ĐỂ TRỐNG. §A10.7 nói rõ: luật không có gate thì ghi thẳng *"không đo được bằng máy —
 * xem A11"*. Một ô trống trong bảng này sẽ được đọc thành "chưa rà tới", còn một ô ghi "không đo được"
 * là một lời khai — và lời khai thì rà lại được.
 *
 * CÁCH NỐI, và giới hạn của nó. Nối bằng cách tìm TÊN LỆNH gate trong văn bản của mục luật. Đó là phép
 * suy từ văn bản, nên:
 *   · luật nhắc tên lệnh ⇒ nối được, và nối đó CHẮC;
 *   · luật KHÔNG nhắc tên lệnh ⇒ máy này ghi "chưa nối được", KHÔNG kết luận là không có gate.
 * Phân biệt đó quan trọng: `secret:scan` chặn theo §Security mà mục đó không nhắc tên lệnh — luật *có*
 * máy, chỉ là không nhắc tên. Đo trên bản máy của `gate:policy`: 19/24 script sẽ báo oan nếu đòi luật
 * canonical phải nhắc TÊN mọi lệnh.
 *
 * Dùng:
 *   node scripts/qa/rule_coverage.js [--write] [--check] [--json]
 *
 * Exit: 0 · 1 khi `--check` thấy bảng lệch · 2 khi không đọc được nguồn
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'docs', 'RULE_COVERAGE.md');
const KHAI = path.join(REPO, '.agent', 'config', 'rule_coverage_notes.json');
const gateIndex = require(path.join(__dirname, 'gate_index.js'));

const JSON_OUT = process.argv.includes('--json');

const docAn = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

/**
 * Cắt `RULE_GLOBAL.md` thành các MỤC theo heading. Mỗi mục là một đơn vị luật.
 *
 * Cắt theo heading chứ không theo đoạn: một luật thường trải vài đoạn, và cắt theo đoạn sẽ tạo ra hàng
 * trăm "luật" rời rạc mà không mục nào đủ ngữ cảnh để nối với gate nào.
 */
function catMuc(txt) {
  const dong = txt.split(/\r?\n/);
  const muc = [];
  let hien = null;
  for (const d of dong) {
    const m = d.match(/^(#{2,4})\s+(.+)$/);
    if (m) {
      if (hien) muc.push(hien);
      hien = { cap: m[1].length, ten: m[2].replace(/[`*]/g, '').trim(), than: [] };
      continue;
    }
    if (hien) hien.than.push(d);
  }
  if (hien) muc.push(hien);
  return muc.map((x) => ({ ...x, than: x.than.join('\n') }));
}

/** Spec nào nhắc tên lệnh của một gate. */
function specCua(tenLenh, specs) {
  return specs.filter((s) => tenLenh.some((t) => s.txt.includes(t))).map((s) => s.ten);
}

function docSpecs() {
  const d = path.join(REPO, 'tests', 'fe', 'infra');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.spec.ts'))
    .map((f) => ({ ten: `tests/fe/infra/${f}`, txt: docAn(path.join(d, f)) }));
}

/**
 * Nạp LỜI KHAI của người cho các mục không nối được gate bằng tên lệnh.
 *
 * Phép nối theo tên lệnh chỉ trả lời được một nửa câu hỏi. Nửa còn lại — "mục này không nối được là vì
 * luật có máy mà không nhắc tên, vì luật đo được mà chưa có máy, hay vì luật không đo được" — là việc của
 * người, và ba câu trả lời đó dẫn tới ba việc sửa khác nhau. Để trống cả ba thì lần sau không ai biết đã
 * rà tới đâu.
 */
function napKhai() {
  const txt = docAn(KHAI);
  if (!txt) return { muc: new Map(), loai: {} };
  let j;
  try { j = JSON.parse(txt); } catch (e) {
    throw new Error(`rule-coverage: .agent/config/rule_coverage_notes.json SAI cú pháp JSON (${e.message}).`, { cause: e });
  }
  const m = new Map();
  for (const x of (j.muc || [])) m.set(String(x.ten).trim(), x);
  return { muc: m, loai: j._loai || {}, do_ngay: j._do_ngay };
}

function dungBang() {
  const rows = gateIndex.build().rows;
  const specs = docSpecs();
  const muc = catMuc(docAn(path.join(REPO, 'RULE_GLOBAL.md')));

  /* Mỗi gate: tên npm + tên file, để khớp vào văn bản luật. */
  const gate = rows.map((r) => ({
    npm: r.npm.filter((x) => !x.startsWith('(')),
    file: r.file,
    base: path.basename(r.file),
    muc: r.level,
  }));

  const banDo = [];
  for (const m of muc) {
    if (!m.than.trim()) continue;
    const van = `${m.ten}\n${m.than}`;
    const noi = [];
    for (const g of gate) {
      const ten = [...g.npm, g.base];
      if (ten.some((t) => van.includes(t))) noi.push(g);
    }
    banDo.push({
      muc: m.ten,
      cap: m.cap,
      so_tu: m.than.split(/\s+/).filter(Boolean).length,
      gate: noi.map((g) => ({ npm: g.npm[0] || g.base, file: g.file, spec: specCua([...g.npm, g.base], specs) })),
    });
  }
  const khai = napKhai();
  for (const r of banDo) {
    if (r.gate.length) continue;
    const k = khai.muc.get(r.muc.trim());
    r.khai = k ? { loai: k.loai, ghi_chu: k.ghi_chu } : null;
  }
  return { banDo, soGate: gate.length, soSpec: specs.length, loai_khai: khai.loai, khai_do_ngay: khai.do_ngay };
}

function render(d) {
  const coGate = d.banDo.filter((x) => x.gate.length);
  const chuaNoi = d.banDo.filter((x) => !x.gate.length);
  const L = [];
  L.push('# Bản đồ LUẬT → GATE → SPEC');
  L.push('');
  L.push('> **SINH TỰ ĐỘNG** bởi `node scripts/qa/rule_coverage.js --write`. Đừng sửa tay — `--check` chặn khi');
  L.push('> bảng lệch nguồn.');
  L.push('');
  L.push('Trang này trả lời một câu mà không chỗ nào khác trả lời được: **luật nào đang có máy thi hành, và');
  L.push('luật nào chỉ nói bằng chữ.** Thiếu câu đó thì "kit có nhiều gate" nghe như một bảo đảm, trong khi nó');
  L.push('không nói gì về việc những gate đó phủ đúng chỗ nào.');
  L.push('');
  L.push('## Giới hạn của phép nối, đọc trước khi dùng số ở đây');
  L.push('');
  L.push('Nối bằng cách tìm **tên lệnh gate** trong văn bản của mục luật. Nên:');
  L.push('');
  L.push('- mục luật nhắc tên lệnh thì nối được, và nối đó **chắc**;');
  L.push('- mục luật **không** nhắc tên lệnh thì bảng ghi `chưa nối được`, và đó **KHÔNG** phải "không có gate".');
  L.push('');
  L.push('Ví dụ cụ thể: `secret:scan` chặn theo mục Security mà mục đó không nhắc tên lệnh. Luật *có* máy, chỉ là');
  L.push('không nhắc tên. Đã đo trên bản máy của `gate:policy`: đòi luật canonical nhắc TÊN mọi lệnh thì **19/24');
  L.push('script báo oan**. Nên con số `chưa nối được` ở dưới là **việc cần rà**, không phải một lỗ đã chứng minh.');
  L.push('');
  L.push(`Nguồn: \`RULE_GLOBAL.md\` (${d.banDo.length} mục có nội dung) · ${d.soGate} gate · ${d.soSpec} spec hạ tầng.`);
  L.push('');
  L.push(`## Mục luật ĐÃ nối được gate (${coGate.length})`);
  L.push('');
  L.push('| Mục luật | Gate thi hành | Spec canh gate |');
  L.push('|---|---|---|');
  for (const r of coGate) {
    const g = r.gate.map((x) => `\`${x.npm}\``).join(' · ');
    const s = [...new Set(r.gate.flatMap((x) => x.spec))];
    const sTxt = s.length ? s.slice(0, 3).map((x) => `\`${path.basename(x)}\``).join(' · ') + (s.length > 3 ? ` +${s.length - 3}` : '') : '**KHÔNG SPEC NÀO**';
    L.push(`| ${r.muc.replace(/\|/g, '&#124;')} | ${g} | ${sTxt} |`);
  }
  L.push('');
  L.push(`## Mục luật CHƯA nối được gate bằng tên lệnh (${chuaNoi.length})`);
  L.push('');
  L.push('Không nối được là **ba chuyện khác nhau**, và ba chuyện đó cần ba cách sửa khác nhau. Nhãn ở cột cuối');
  L.push('là **lời khai của người**, nạp từ `.agent/config/rule_coverage_notes.json`:');
  L.push('');
  for (const [k, v] of Object.entries(d.loai_khai || {})) L.push(`- \`${k}\` — ${v}`);
  L.push('');
  L.push('Một ô `CHƯA RÀ` nghĩa là mục luật đó mới xuất hiện và chưa ai phân loại — không phải "không có lỗ".');
  L.push('');
  L.push('| Mục luật | Số từ | Loại | Khai |');
  L.push('|---|---|---|---|');
  for (const r of chuaNoi) {
    const ten = r.muc.replace(/\|/g, '&#124;');
    const loai = r.khai ? `\`${r.khai.loai}\`` : '**CHƯA RÀ**';
    const gc = r.khai ? r.khai.ghi_chu.replace(/[|\n\r]+/g, ' ').trim() : 'chưa có lời khai nào';
    L.push(`| ${ten} | ${r.so_tu} | ${loai} | ${gc} |`);
  }
  L.push('');
  return L.join('\n');
}

function main() {
  let d;
  try { d = dungBang(); } catch (e) {
    console.error(`[rule-coverage] ✗ không dựng được bảng: ${e.message}`);
    process.exit(2);
  }
  const md = render(d);

  if (JSON_OUT) { console.log(JSON.stringify(d, null, 2)); return; }
  if (process.argv.includes('--check')) {
    const cur = docAn(OUT);
    if (!cur) {
      console.error('[rule-coverage] CHẶN: thiếu docs/RULE_COVERAGE.md — chạy `npm run rule:coverage`.');
      process.exit(1);
    }
    if (cur.replace(/\r\n/g, '\n').trim() !== md.trim()) {
      console.error('[rule-coverage] CHẶN: docs/RULE_COVERAGE.md LỆCH nguồn. Chạy `npm run rule:coverage` rồi commit.');
      process.exit(1);
    }
    const coGate = d.banDo.filter((x) => x.gate.length).length;
    const chuaRa = d.banDo.filter((x) => !x.gate.length && !x.khai);
    if (chuaRa.length) {
      /*
       * Mục luật MỚI mà chưa ai phân loại thì CHẶN, và chặn ở đây là đúng chỗ.
       *
       * Cái bản đồ này tồn tại để trả lời 'luật nào có máy thi hành'. Một mục không nối được gate và
       * cũng không có lời khai là một ô trống, mà ô trống sẽ được đọc thành 'chưa có lỗ' — đúng cách
       * đọc sai mà §A10.7 đặt ra để chặn. Khai một trong bốn loại mất một câu; để trống mất một lỗ.
       */
      console.error(`[rule-coverage] CHẶN: ${chuaRa.length} mục luật chưa ai phân loại:`);
      for (const r of chuaRa) console.error(`  · ${r.muc}`);
      console.error('  Khai vào `.agent/config/rule_coverage_notes.json` — xem `_loai` để chọn một trong bốn loại.');
      process.exit(1);
    }
    console.log(`[rule-coverage] OK — ${d.banDo.length} mục luật, ${coGate} đã nối được gate, ${d.banDo.length - coGate} đã khai lý do.`);
    return;
  }
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, md, 'utf8');
    const coGate = d.banDo.filter((x) => x.gate.length).length;
    console.log(`[rule-coverage] đã ghi docs/RULE_COVERAGE.md — ${d.banDo.length} mục luật, ${coGate} nối được gate, ${d.banDo.length - coGate} khai bằng tay, ${d.banDo.filter((x) => !x.gate.length && !x.khai).length} CHƯA RÀ.`);
    return;
  }
  console.log(md);
}

if (require.main === module) main();

module.exports = { catMuc, dungBang, render, OUT };
