#!/usr/bin/env node
'use strict';

/*
 * skills_lint.js — MÔ TẢ SKILL CÓ ĐỦ THÔNG TIN ĐỂ CHỌN HAY CHƯA?
 *
 * VÌ SAO CÓ (v2.5.0 G3.3). `skills:index --check` đã khoá rằng `INDEX.md` khớp cây và frontmatter có
 * `name`/`description`. Nó KHÔNG chấm chất lượng: một description 20 ký tự vẫn qua.
 *
 * Mà `description` là thứ DUY NHẤT agent đọc để quyết định có mở skill hay không — 25 skill của kit không
 * auto-load. Mô tả không nói được "dùng khi nào" thì skill đó không bao giờ được gọi, và 25 skill thành 25
 * file chết. Đây là kiểu hỏng im lặng nhất trong kit: không gate nào đỏ, không ai báo lỗi, chỉ là công sức
 * viết skill không bao giờ sinh lợi.
 *
 * HAI MỨC, và ranh giới dựa trên SỐ ĐO (10/10/2026, 25 skill):
 *   CHẶN  · description < 80 ký tự — chỉ 3 skill, và cả 3 chỉ thiếu một mệnh đề "dùng khi";
 *          · hai mô tả giống nhau ≥ 0.30 Jaccard — 0 cặp, nên chặn được ngay;
 *          · wikilink `[[x]]` hoặc đường dẫn trong skill trỏ vào thứ KHÔNG tồn tại — 1 ca.
 *   CẢNH BÁO (nợ khai, khoá theo số lượng)
 *          · thiếu mục "dùng khi" — 17 skill;
 *          · thiếu mục "KHÔNG dùng khi" — 16 skill;
 *          · không nhắc máy kiểm nào — 13 skill.
 * Chặn ba cái sau là làm đỏ 17 skill ngay ngày đầu rồi gate bị tắt.
 *
 * GATE NÀY KHÔNG CHẤM MÔ TẢ CÓ ĐÚNG HAY KHÔNG — nó chấm mô tả có ĐỦ THÔNG TIN ĐỂ CHỌN hay chưa. Phần
 * đúng/sai vẫn là việc người đọc, và nói ra giới hạn đó rẻ hơn để ai đó tin gate đã kiểm nội dung.
 *
 * Dùng:
 *   npm run skills:lint
 *   npm run skills:lint:enforce
 *   node scripts/qa/skills_lint.js --dir <thư mục skill>   # dùng trong test
 */

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const cfgLoad = require(path.join(__dirname, 'lib', 'config_load'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d = '') => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ENFORCE = flag('enforce');
const REPO = rc.REPO_ROOT;
const DIR = path.resolve(arg('dir', path.join(REPO, '.agent/skills')));

/*
 * `--cfg <đường dẫn>` để spec chạy gate trên một config DỰNG RIÊNG. Không có nó thì không kiểm được
 * đối chứng âm của máy chặn "khoá nợ đặt ngoài `no`" — mà một máy chặn chưa từng đỏ thì không ai biết
 * nó có đỏ được hay không. Cùng idiom với `--repo` của `deps_check.js`.
 */
const CFG = cfgLoad.napConfigGate({
  duong: path.resolve(arg('cfg', path.join(REPO, '.agent/config/skills_lint.json'))),
  nhan: 'skills_lint.json',
  phepKiem: 'chất lượng mô tả skill (độ dài · mô tả trùng · con trỏ chết · nợ "dùng khi"/"KHÔNG dùng khi"/máy kiểm)',
  khiThieu: null,
}) || {};

const MIN = Number(CFG.descMinChars || 80);

/*
 * TRẦN ĐỘ DÀI MÔ TẢ — thêm 05/11/2026, v2.10.0.
 *
 * `description` của MỌI skill, command và agent nằm trong phần LUÔN NẠP: harness quảng bá chúng ở mỗi
 * phiên, kể cả phiên chỉ hỏi một câu. Đo 04/11/2026 bằng `token:session`: riêng 44 mô tả là 9,51 KB
 * trên tổng 16,29 KB — khối LỚN NHẤT, lớn hơn cả `CLAUDE.md`. Và nó không nằm trong `load_map.json`
 * nên `prompt:budget` không thấy nó: trước v2.10.0, một mô tả dài thêm một câu làm mọi phiên về sau
 * đắt thêm MÃI MÃI mà không gate nào kêu.
 *
 * Trần đi CẶP với sàn `descMinChars` ở trên, và hai cái kéo ngược nhau có chủ ý: quá ngắn thì skill
 * không bao giờ được gọi, quá dài thì mọi phiên trả tiền cho chữ phần lớn không dùng tới. Phần dư
 * KHÔNG xoá — nó xuống mục "Dùng khi nào" trong thân skill, chỗ chỉ ai đã mở skill mới phải đọc.
 */
const MAX = Number(CFG.descMaxChars || 200);
const DUP = Number(CFG.dupDescThreshold || 0.3);
const NO = CFG.no || {};

/*
 * KHOÁ NỢ ĐẶT NGOÀI `no` ⇒ CHẶN NGAY, trước mọi phép chấm khác. Thêm 28/10/2026.
 *
 * Lớp lỗi này đã xảy ra thật và sống 13 ngày: lần "hạ nợ" ngày 15/10 ghi `thieuKhiDung: 11` ở CẤP
 * NGOÀI, còn script chỉ đọc `CFG.no`. Nên sổ nợ thật vẫn là 12, gate vẫn in đúng câu "thực 11 < khai 12
 * ⇒ hạ số" mỗi lượt, và không ai đọc — vì người sửa tin rằng mình đã sửa rồi.
 *
 * Một con số đặt ở chỗ không ai đọc TỆ HƠN không có số: nó không gác gì, mà lại tạo cảm giác đã gác.
 * Nên đây là CHẶN chứ không phải cảnh báo.
 */
const KHOA_NO = ['thieuKhiDung', 'thieuKhiKhongDung', 'thieuMayKiem'];
const noDatSai = KHOA_NO.filter((k) => Object.prototype.hasOwnProperty.call(CFG, k));
if (noDatSai.length) {
  console.error(`[skills-lint] CHẶN: khoá nợ đặt NGOÀI \`no\`: ${noDatSai.join(' · ')}`);
  console.error('  Script chỉ đọc `CFG.no`, nên số ở cấp ngoài KHÔNG có tác dụng — và nó làm người sửa');
  console.error('  tin là đã hạ nợ. Chuyển các khoá trên vào `no`, rồi xoá bản ở cấp ngoài.');
  console.error('  (Đã xảy ra thật ngày 15/10/2026, sống 13 ngày — xem `_thieuKhiDung_ha_lan_2`.)');
  process.exit(1);
}

/** Mọi `SKILL.md` dưới `DIR`. */
function timSkill() {
  const ra = [];
  const di = (d, sau = 0) => {
    if (sau > 4) return;
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p, sau + 1);
      else if (e.name === 'SKILL.md') ra.push(p);
    }
  };
  di(DIR);
  return ra;
}

const ten = (f) => path.basename(path.dirname(f));
const moTa = (s) => ((s.match(/^description:\s*(.+)$/m) || [])[1] || '').trim();

/** Tập từ ≥ 4 ký tự, để đo trùng mô tả. Từ ngắn (và, của, cho) không mang nghĩa phân biệt. */
const tapTu = (s) => new Set(String(s).toLowerCase().replace(/[^a-zà-ỹ0-9\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 3));

function jaccard(a, b) {
  const A = tapTu(a);
  const B = tapTu(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
}

/*
 * Con trỏ trong skill phải trỏ vào thứ CÓ THẬT. Hai dạng:
 *  · `[[x]]` — wikilink, nghĩa là MỘT SKILL KHÁC. Đo 10/10/2026 có 1 ca chết:
 *    `lighthouse_check` trỏ `[[accessibility_check]]` mà không có skill tên đó — nó là một SCRIPT
 *    (`scripts/qa/accessibility_check.js`). Dùng sai dạng con trỏ thì người đọc đi tìm một skill không
 *    tồn tại, và đó cũng là lý do gate này phân biệt hai dạng.
 *  · `` `đường/dẫn.ext` `` — đường dẫn file trong repo.
 */
/**
 * Thư mục gốc của REPO **và được git track**. Mọi thứ khác không kiểm ở đây:
 *
 *  · `reports/`, `requirements/`, `test-cases/`, `test-results/`, `evidence/`, `automation/` — tương đối
 *    với `<TASK_OUTPUT_DIR>`, không tồn tại trong repo và KHÔNG nên tồn tại;
 *  · `knowledge/**` — dữ liệu lớp PROJECT, **bị gitignore**. Bản đầu có `knowledge` trong danh sách này và
 *    nó CHẶN trên worktree sạch (5 ca: `knowledge/index.json`,
 *    `knowledge/locators/appmau-login__*.json`) trong khi xanh trên cây làm việc — tức gate đúng ở một máy
 *    và sai ở máy khác, đúng lớp lỗi mà bước "kiểm trên cây sạch" tồn tại để bắt. Skill trỏ tới
 *    `knowledge/**` là ĐÚNG; chỉ là không kiểm được sự tồn tại của nó.
 */
const GOC_REPO = /^(?:scripts|tests|\.agent|prompt_templates|docs|manual-run|partial-rerun|\.claude|\.github)\//;

function conTroChet(f, src, tenSkill) {
  const xau = [];
  for (const m of src.matchAll(/\[\[([a-z0-9_]+)\]\]/g)) {
    if (!tenSkill.has(m[1])) xau.push(`\`[[${m[1]}]]\` — không có skill tên này`);
  }
  for (const m of src.matchAll(/`([a-zA-Z0-9_./-]+\.(?:md|json|js|ts|mjs))`/g)) {
    const p = m[1];
    if (/<|>|\*|\.\.\./.test(p)) continue;                     // placeholder
    /*
     * CHỈ kiểm đường dẫn của REPO. Bản đầu kiểm mọi chuỗi có `/` và nó báo oan 14 ca: `reports/
     * phase1-summary.md`, `requirements/git-impact.md`, `reports/tc-review.md` là đường dẫn tương đối với
     * `<TASK_OUTPUT_DIR>` — chúng KHÔNG nên tồn tại trong repo, và đòi chúng tồn tại là đòi sai chỗ.
     *
     * Nó cũng báo oan một câu VĂN XUÔI: `ops-transactions.load/.stress/.soak.js` trong `load_check` là
     * cách viết gọn ba tên file ĐÃ BỊ GỠ, không phải một đường dẫn. Neo vào thư mục gốc của repo thì cả
     * hai lớp báo oan đó hết.
     */
    if (!GOC_REPO.test(p)) continue;
    if (!fs.existsSync(path.join(REPO, p))) xau.push(`\`${p}\` — đường dẫn không tồn tại`);
  }
  return xau.map((x) => `${ten(f)}: ${x}`);
}

function main() {
  const files = timSkill();
  if (!files.length) {
    console.log(`[skills-lint] 0 SKILL.md trong ${path.relative(REPO, DIR) || DIR} ⇒ KHÔNG phán được gì. Đây không phải đạt.`);
    process.exit(0);
  }
  const tenSkill = new Set(files.map(ten));
  const chan = [];
  const canh = [];
  const dem = { thieuKhiDung: [], thieuKhiKhongDung: [], thieuMayKiem: [] };
  const ds = [];

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const d = moTa(src);
    const n = ten(f);
    ds.push({ n, d });

    if (d.length < MIN) {
      chan.push(`${n}: description ${d.length} ký tự < ${MIN} — đây là thứ DUY NHẤT agent đọc để quyết định có mở skill hay không. Thiếu "dùng khi nào" thì skill không bao giờ được gọi.`);
    }
    if ([...d].length > MAX) {
      chan.push(`${n}: description ${[...d].length} ký tự > ${MAX} — mô tả nằm trong phần LUÔN NẠP, mọi phiên đều trả. Chuyển phần dư xuống mục "Dùng khi nào" trong thân skill, đừng xoá. Đo bằng \`npm run token:session\`.`);
    }
    chan.push(...conTroChet(f, src, tenSkill));

    if (!/dùng khi|Khi dùng|dùng cho/i.test(src)) dem.thieuKhiDung.push(n);
    if (!/KHÔNG dùng|không dùng khi/i.test(src)) dem.thieuKhiKhongDung.push(n);
    /* Miễn trừ tường minh: skill thuần phán đoán thì khai một dòng thay vì bịa ra một gate. */
    const mienTru = /KHÔNG có máy kiểm vì\s+\S/i.test(src);
    if (!mienTru && !/npm run [a-z0-9:_-]+|⚙️/.test(src)) dem.thieuMayKiem.push(n);
  }

  /* Mô tả trùng nhau ⇒ agent không có căn cứ để chọn, và nó sẽ chọn sai hoặc mở cả hai. */
  for (let i = 0; i < ds.length; i += 1) {
    for (let j = i + 1; j < ds.length; j += 1) {
      const s = jaccard(ds[i].d, ds[j].d);
      if (s >= DUP) chan.push(`\`${ds[i].n}\` và \`${ds[j].n}\`: mô tả giống nhau ${s.toFixed(2)} (ngưỡng ${DUP}) — agent không có căn cứ để chọn giữa hai skill này.`);
    }
  }

  console.log(`[skills-lint] ${files.length} skill · ${chan.length} CHẶN`);
  for (const [k, list] of Object.entries(dem)) {
    const khai = Number(NO[k] || 0);
    const nhan = { thieuKhiDung: 'thiếu mục "dùng khi"', thieuKhiKhongDung: 'thiếu mục "KHÔNG dùng khi"', thieuMayKiem: 'không nhắc máy kiểm nào' }[k];
    if (list.length > khai) {
      chan.push(`${nhan}: ${list.length} skill, nợ khai ${khai} ⇒ ${list.length - khai} cái MỚI. ${list.slice(0, 5).join(' · ')}${list.length > 5 ? ` … +${list.length - 5}` : ''}`);
    } else if (list.length) {
      canh.push(`${nhan}: ${list.length}/${files.length} skill (nợ khai ${khai}). ${list.slice(0, 5).join(' · ')}${list.length > 5 ? ` … +${list.length - 5}` : ''}`);
      if (list.length < khai) canh.push(`  nợ đã GIẢM ở "${nhan}": thực ${list.length} < khai ${khai} ⇒ hạ số trong \`skills_lint.json\`.`);
    } else if (khai) {
      canh.push(`nợ "${nhan}" đã sạch (khai ${khai}) ⇒ hạ về 0 trong \`skills_lint.json\`.`);
    }
  }

  canh.forEach((c) => console.log(`  ⚠ ${c}`));
  if (chan.length) {
    chan.forEach((c) => console.log(`  ✗ ${c}`));
    if (ENFORCE) {
      console.log('\n[skills-lint] ✗ CHẶN. Khuôn mô tả: nói RÕ dùng khi nào và KHÔNG dùng khi nào, rồi trỏ tới máy kiểm (hoặc ghi một dòng `> KHÔNG có máy kiểm vì <lý do>`).');
      process.exit(1);
    }
    console.log('\nChặn được bằng: npm run skills:lint:enforce');
    process.exit(0);
  }
  console.log(ENFORCE ? '\n[skills-lint] ✓ ĐẠT — mô tả đủ thông tin để chọn, con trỏ đều giải được, nợ không phình.' : '\nChặn được bằng: npm run skills:lint:enforce');
  console.log('Giới hạn: gate này KHÔNG chấm mô tả có ĐÚNG hay không, chỉ chấm có ĐỦ THÔNG TIN ĐỂ CHỌN. Phần đúng/sai là việc người đọc.');
  process.exit(0);
}

module.exports = { jaccard, moTa, tapTu };
if (require.main === module) main();
