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

/**
 * Danh sách spec hạ tầng — ĐẾM THEO FILE ĐÃ GIT TRACK, không theo đĩa.
 *
 * ĐÂY LÀ LÝ DO CỬA `rule:coverage:check` CỨ ĐỎ LẠI. Bản trước đọc `readdirSync`, tức đếm mọi file trên
 * đĩa kể cả spec WIP chưa commit. Đo 15/10/2026: đĩa có **150** spec trong `tests/fe/infra`, git track
 * **137** — chênh đúng 13 file probe đang dở của người dùng. Ai sinh lại tài liệu lúc có WIP sẽ commit
 * con số 150, rồi CI (chỉ có file đã track) tính ra 137 và CHẶN. Người đó không làm gì sai; cái sai là
 * phép đếm phụ thuộc thứ KHÔNG nằm trong commit.
 *
 * Cùng lớp lỗi với ca CRLF ở `_doc_sach.ts`: kết quả phụ thuộc trạng thái máy người chạy thì "xanh"
 * hết nghĩa. Và nó tệ hơn một bậc, vì ở đây máy sinh và máy kiểm là HAI lượt chạy khác môi trường.
 *
 * Không có git ⇒ NÉM, không im lặng quay về đếm đĩa: quay về đếm đĩa đúng là cách con số sai lọt ra.
 */
function docSpecs() {
  const d = path.join(REPO, 'tests', 'fe', 'infra');
  if (!fs.existsSync(d)) return [];
  let ra = null;
  try {
    ra = require('child_process')
      /*
       * `stdio` nuốt stderr CÓ CHỦ Ý: chạy trong gói phát hành (không `.git`) thì git in
       * `fatal: not a git repository`, và dòng đó nằm giữa output của một lệnh đang chạy BÌNH THƯỜNG
       * sẽ làm người nhận kit tưởng hỏng. Việc thiếu git đã được xử lý tử tế ngay dưới.
       */
      .execFileSync('git', ['ls-files', 'tests/fe/infra/*.spec.ts'],
        { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { ra = null; }

  if (ra === null) {
    /*
     * KHÔNG có git ⇒ đếm theo đĩa, nhưng BẬT CỜ và cấm ghi tài liệu (xem `THEO_DIA`).
     *
     * Ném thẳng ở đây là bản đầu của tôi, và `release:verify` bác nó: trong GÓI phát hành không có
     * `.git` (cố ý — đó là một bước kiểm riêng), nên `selfcheck.spec.ts` gọi `dungBang()` liền chết.
     *
     * Rủi ro thật mà luật này chặn KHÔNG phải "đếm theo đĩa", mà là "sinh tài liệu với số theo đĩa rồi
     * COMMIT, để CI tính ra số khác". Chuyện đó chỉ xảy ra trong repo git. Ngoài repo thì không ai
     * commit tài liệu, và ở đó đĩa cũng chính là tập file đã phát hành — không có WIP nào lẫn vào.
     *
     * Nên phạm vi đúng là: cấm GHI khi không có git, chứ không cấm ĐỌC.
     */
    module.exports.THEO_DIA = true;
    return fs.readdirSync(d).filter((f) => f.endsWith('.spec.ts'))
      .map((f) => ({ ten: `tests/fe/infra/${f}`, txt: docAn(path.join(d, f)) }));
  }
  module.exports.THEO_DIA = false;
  return ra.split('\n').map((x) => x.trim()).filter((x) => x.endsWith('.spec.ts'))
    .map((f) => ({ ten: f, txt: docAn(path.join(REPO, f)) }));
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
    /*
     * CẤM GHI khi mẫu số đếm theo đĩa.
     *
     * Đây là chỗ rủi ro thật nằm: ghi một con số đếm theo đĩa rồi commit, xong CI (chỉ có file đã
     * track) tính ra số khác và CHẶN. Đo 15/10/2026: đĩa 150 spec, git track 137 — chênh 13 file WIP
     * chưa commit. Đọc thì vẫn cho (gói phát hành không có `.git` nhưng vẫn cần `dungBang()`); ghi
     * thì không.
     */
    if (module.exports.THEO_DIA) {
      console.error('[rule-coverage] CHẶN ghi: không đọc được `git ls-files`, nên mẫu số đang đếm THEO ĐĨA.');
      console.error('  Đĩa gộp cả spec WIP chưa commit, nên con số ghi ra sẽ khác con số CI tính được.');
      console.error('  Chạy lại từ một bản clone git đầy đủ.');
      process.exit(2);
    }
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
