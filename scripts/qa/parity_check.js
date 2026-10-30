#!/usr/bin/env node
'use strict';

/*
 * parity_check.js — gác chính bảng nghiệm thu `docs/v2.9.5/A_PARITY.md`.
 *
 * VÌ SAO CẦN. Bảng này là lớp DẪN XUẤT viết tay: nó kể lại chỗ nào A còn hơn B và B đã xử lý thế nào.
 * Mọi bảng viết tay trong kit đều đã trôi ít nhất một lần, và bảng nghiệm thu trôi thì tệ hơn bảng
 * thường — nó là thứ người ta đọc để tin rằng đợt làm đã xong.
 *
 * BA THỨ ĐƯỢC GÁC, và điều kiện dừng của đợt v2.9.5 nằm ở điều ①:
 *   ① KHÔNG dòng nào "chưa xử lý". Mỗi dòng phải kết về ✅ / ⛔ / ⚠️. Để trống hay ghi "chưa xử lý",
 *      "TBD", "đang làm" đều là CHẶN — vì một bảng nghiệm thu có dòng treo thì nó không nghiệm thu gì.
 *   ② Dòng ✅ nhắc `npm run <x>` thì `<x>` phải CÓ THẬT trong `package.json`. Một tên máy bịa làm hỏng
 *      cả bảng, không chỉ một dòng: người đọc mất cách kiểm lại từng dòng.
 *   ③ Phải CÓ cả ba khối: bảng nghiệm thu, khối "cố ý KHÔNG port", khối "CHƯA CÓ MÁY". Thiếu khối thứ
 *      ba là dấu hiệu bảng đang kể một phiên bản đẹp hơn thực tế.
 *
 * GIỚI HẠN TỰ KHAI: máy đọc KÝ HIỆU và TÊN MÁY, không đọc nghĩa. Nó không biết một dòng ✅ có đúng hay
 * không — chuyện đó phải đối chiếu với `tests/fe/infra/` và với chính commit. Nó chỉ bảo đảm bảng không
 * có dòng treo và không nhắc máy không tồn tại.
 *
 * Dùng:
 *   npm run parity:check
 *   ... --file <path>   # đo bảng khác (để dựng đối chứng)
 * Exit: 0 đạt · 1 đã đo và SAI · 2 KHÔNG PHÁN ĐƯỢC (thiếu bảng, hoặc không đọc được dòng nào).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const doiSo = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const FILE = path.resolve(doiSo('file') || path.join(REPO, 'docs/v2.9.5/A_PARITY.md'));

const TT_HOP_LE = ['✅', '⛔', '⚠️'];
/* Chữ nghĩa là "chưa xong". Bắt cả ký hiệu lẫn chữ, vì người ta hay thay ký hiệu bằng chữ cho đỡ đỏ. */
const RE_TREO = /chưa xử lý|chưa làm|\bTBD\b|\bTODO\b|đang làm|để sau|\bWIP\b|🚧|⏳/i;
const KHOI = [
  { ten: 'bảng nghiệm thu', re: /^##+\s*Bảng nghiệm thu/im },
  { ten: 'cố ý KHÔNG port', re: /^##+\s*Chỗ cố ý KHÔNG port/im },
  { ten: 'CHƯA CÓ MÁY', re: /^##+\s*Chỗ ĐÃ LÀM nhưng CHƯA CÓ MÁY/im },
];

function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`[parity] KHÔNG PHÁN ĐƯỢC: thiếu ${path.relative(REPO, FILE)}`);
    return 2;
  }
  const src = fs.readFileSync(FILE, 'utf8');
  const dong = src.split(/\r?\n/);

  /*
   * Dòng nghiệm thu = dòng bảng có cột CUỐI là một ký hiệu trạng thái. Neo theo cột cuối chứ không theo
   * số cột: bảng thêm một cột ở giữa thì phép kiểm vẫn soi đúng chỗ.
   */
  const nghiemThu = [];
  for (const l of dong) {
    if (!l.trim().startsWith('|')) continue;
    const o = l.split('|').slice(1, -1).map((x) => x.trim());
    if (o.length < 3) continue;
    const cuoi = o[o.length - 1];
    if (TT_HOP_LE.includes(cuoi) || /^(TT|tt)$/.test(cuoi) || /^-+$/.test(cuoi)) {
      if (TT_HOP_LE.includes(cuoi)) nghiemThu.push({ o, tt: cuoi, l });
    }
  }

  if (nghiemThu.length === 0) {
    console.error('[parity] KHÔNG PHÁN ĐƯỢC: 0 dòng nghiệm thu đọc được (cột cuối phải là ✅ / ⛔ / ⚠️).');
    console.error('  "không có gì để gác" KHÔNG đồng nghĩa với "đạt".');
    return 2;
  }

  /* Đọc bằng `fs` chứ không `require`: không cần miễn trừ eslint nào, và không giữ cache module. */
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const sai = [];

  // ① dòng treo — soi TOÀN BỘ file, không chỉ bảng nghiệm thu.
  for (let i = 0; i < dong.length; i += 1) {
    /* Bỏ qua chính dòng ĐỊNH NGHĨA của luật này trong phần mở đầu, nếu không tài liệu tự chặn nó. */
    if (/không dòng nào được để/i.test(dong[i])) continue;
    const m = dong[i].match(RE_TREO);
    if (m) sai.push(`dòng ${i + 1}: còn dấu hiệu TREO (${JSON.stringify(m[0])}) — ${dong[i].trim().slice(0, 70)}`);
  }

  // ② máy được nhắc phải có thật.
  const goi = [...new Set([...src.matchAll(/`npm run ([a-z0-9:_-]+)/g)].map((x) => x[1]))];
  const thieuMay = goi.filter((g) => !pkg.scripts[g]);
  if (thieuMay.length) sai.push(`nhắc npm script KHÔNG tồn tại: ${thieuMay.join(', ')}`);

  // ③ ba khối phải có mặt.
  for (const k of KHOI) if (!k.re.test(src)) sai.push(`thiếu khối **${k.ten}**`);

  /*
   * ④ SỐ LIỆU VỀ A PHẢI ĐỌC ĐƯỢC TỪ BẢN A (v2.9.6 N4), không gõ tay.
   *
   * Số về A là số của MỘT BẢN GIẢI NÉN CỤ THỂ. Gõ tay thì không ai kiểm lại được, và nó trôi im lặng y
   * như mọi bảng viết tay khác của kit — đợt này vừa bắt được hai câu sai về A đúng kiểu đó.
   *
   * KHÔNG CÓ BẢN A ⇒ IN RÕ "không đo lại được" RỒI BỎ QUA. Bản A là plugin của bên khác, không thuộc
   * repo, nên máy nào cũng đỏ vì thiếu nó là đỏ oan. Nhưng "bỏ qua" phải NÓI RA — im lặng thì người đọc
   * tưởng đã đối soát.
   */
  try {
    const cfgA = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/a_parity_source.json'), 'utf8'));
    const gocA = (cfgA.duong_dan || []).find((d) => fs.existsSync(d));
    if (!gocA) {
      console.log(`\n[parity] ⓘ KHÔNG đo lại được số liệu về A — không đường dẫn nào trong`);
      console.log('[parity]   `.agent/config/a_parity_source.json` tồn tại trên máy này. Phép kiểm ④ BỎ QUA,');
      console.log('[parity]   và bỏ qua KHÔNG đồng nghĩa với đạt.');
    } else {
      const demFile = (thuMuc, duoi) => {
        try { return fs.readdirSync(path.join(gocA, thuMuc)).filter((f) => f.endsWith(duoi)).length; } catch { return -1; }
      };
      const demThuMucCoSkill = (thuMuc) => {
        try {
          return fs.readdirSync(path.join(gocA, thuMuc), { withFileTypes: true })
            .filter((e) => e.isDirectory() && fs.existsSync(path.join(gocA, thuMuc, e.name, 'SKILL.md'))).length;
        } catch { return -1; }
      };
      const lech = [];
      for (const m of (cfgA.so_do || [])) {
        const that = m.dem === 'so_thu_muc_co_SKILL_md' ? demThuMucCoSkill(m.trong) : demFile(m.trong, '.md');
        if (that < 0) { lech.push(`${m.nhan}: không đọc được \`${m.trong}\` trong bản A`); continue; }
        if (that !== m.da_ghi) lech.push(`${m.nhan}: config ghi ${m.da_ghi}, bản A thật có ${that}`);
        /* Và con số đó phải có mặt ĐÚNG trong bảng "Hai bề mặt" của tài liệu. */
        const dongBang = dong.find((l) => l.startsWith(`| ${m.nhan} |`));
        if (dongBang && !new RegExp(`\\b${that}\\b`).test(dongBang)) {
          lech.push(`${m.nhan}: bảng "Hai bề mặt" không mang số ${that} — ${dongBang.trim().slice(0, 70)}`);
        }
      }
      console.log(`\n[parity] số liệu về A đọc từ ${path.basename(gocA)} · ${(cfgA.so_do || []).length} mục đối soát`);
      if (lech.length) sai.push(...lech.map((x) => `số liệu A LỆCH — ${x}`));
    }
  } catch (e) {
    sai.push(`không đọc được \`.agent/config/a_parity_source.json\`: ${e.message}`);
  }

  /*
   * ⑤ MỘT ✅ KHÔNG ĐƯỢC DÁN KHI MỤC CON CHƯA XONG (v2.9.6 N2.4).
   *
   * Bảng chấm theo §, mà một § có thể gồm nhiều việc. v2.9.5 dán ✅ cho §7 khi nó chỉ có skill
   * `run_report_reader` + view `trace:matrix --pm`; phần LÕI của `test-report-analyzer` bên A (gom theo
   * nguyên nhân, phân loại tầng, chiều test mồ côi) thì chưa có. Dòng ✅ ấy không sai từng chữ, nhưng nó
   * làm người đọc tin cả § đã xong — và không máy nào bắt được, vì máy chỉ đọc KÝ HIỆU.
   *
   * `docs/v2.9.6/plan_items.json` khai mục con, và mỗi mục con bắt buộc có NEO MÁY PHÂN GIẢI ĐƯỢC
   * (`script` · `spec` + số phép kiểm tối thiểu · `nguon` + ký hiệu phải có trong file). Không có neo thì
   * file ấy chỉ là một lớp tự khai nữa, đúng thứ kit cấm.
   *
   * Mục `nguoi` (chỉ người kiểm được) buộc § phải là ⚠️ — KHÔNG BAO GIỜ ✅. Đó là chỗ luật "mọi mẫu lấy
   * từ A phải có máy, hoặc phải khai rõ CHƯA CÓ MÁY" được thi hành bằng máy thay vì bằng thiện chí.
   *
   * VÀ CHIỀU NGƯỢC: mọi mục con đã phân giải mà § vẫn ⚠️ thì cửa NHẮC nâng lên. Thiếu chiều này thì ⚠️
   * thành chỗ trú ẩn vĩnh viễn — hạ một dòng xuống ⚠️ là cách rẻ nhất để hết đỏ mà không làm gì.
   */
  /* `--plan <file>` để spec kiểm được mọi nhánh mà KHÔNG chạm bản kế hoạch thật. */
  const KE_HOACH = path.resolve(doiSo('plan') || path.join(REPO, 'docs/v2.9.6/plan_items.json'));
  if (!fs.existsSync(KE_HOACH)) {
    console.log('\n[parity] ⓘ không có `docs/v2.9.6/plan_items.json` ⇒ khối ⑤ BỎ QUA (không phải đạt).');
  } else {
    let kh;
    try { kh = JSON.parse(fs.readFileSync(KE_HOACH, 'utf8')); } catch (e) {
      sai.push(`\`plan_items.json\` không đọc được: ${e.message}`);
      kh = null;
    }
    if (kh && !(kh.muc || []).length) {
      sai.push('`plan_items.json` có 0 mục ⇒ khối ⑤ rỗng; file rỗng KHÔNG đồng nghĩa với đạt.');
    }
    for (const m of ((kh && kh.muc) || [])) {
      const chuaXong = [];
      let coMucNguoi = false;
      for (const c of (m.con || [])) {
        const neo = c.neo || {};
        if (neo.loai === 'nguoi') {
          coMucNguoi = true;
          if (!String(neo.vi_sao || '').trim()) {
            sai.push(`${m.section}/${c.ma}: neo \`nguoi\` mà KHÔNG ghi \`vi_sao\` — "chỉ người làm được" phải nói được vì sao máy không làm được`);
          }
          continue;
        }
        if (neo.loai === 'script') {
          if (!pkg.scripts[neo.ten]) chuaXong.push(`${c.ma}: npm script \`${neo.ten}\` không tồn tại`);
          continue;
        }
        if (neo.loai === 'spec') {
          const p = path.join(REPO, String(neo.duong || ''));
          if (!fs.existsSync(p)) { chuaXong.push(`${c.ma}: thiếu spec \`${neo.duong}\``); continue; }
          const n = (fs.readFileSync(p, 'utf8').match(/^\s*test\(/gm) || []).length;
          const min = Number(neo.toiThieu || 1);
          if (n < min) chuaXong.push(`${c.ma}: \`${neo.duong}\` chỉ có ${n} phép kiểm, khai tối thiểu ${min}`);
          continue;
        }
        if (neo.loai === 'nguon') {
          const p = path.join(REPO, String(neo.duong || ''));
          if (!fs.existsSync(p)) { chuaXong.push(`${c.ma}: thiếu file \`${neo.duong}\``); continue; }
          if (!fs.readFileSync(p, 'utf8').includes(String(neo.ky_hieu || ''))) {
            chuaXong.push(`${c.ma}: \`${neo.duong}\` KHÔNG chứa \`${neo.ky_hieu}\` ⇒ việc chưa vào mã`);
          }
          continue;
        }
        sai.push(`${m.section}/${c.ma}: neo loại \`${neo.loai}\` không hiểu được — dùng script · spec · nguon · nguoi`);
      }

      const dongSec = nghiemThu.filter((r) => r.o[0] === m.section);
      if (!dongSec.length) {
        sai.push(`${m.section}: \`plan_items.json\` khai mục con nhưng bảng nghiệm thu KHÔNG có dòng nào cho § này`);
        continue;
      }
      const coTick = dongSec.some((r) => r.tt === '✅');
      if (chuaXong.length && coTick) {
        sai.push(`${m.section} đang dán ✅ nhưng ${chuaXong.length} mục con CHƯA XONG: ${chuaXong.join(' · ')}`);
      } else if (coMucNguoi && coTick) {
        sai.push(`${m.section} đang dán ✅ nhưng có mục con chỉ NGƯỜI kiểm được ⇒ phải là ⚠️, không phải ✅`);
      } else if (!chuaXong.length && !coMucNguoi && dongSec.every((r) => r.tt === '⚠️')) {
        console.log(`\n[parity] ⓘ ${m.section}: mọi mục con đã phân giải mà dòng vẫn ⚠️ — nâng lên ✅ hoặc nói rõ còn thiếu gì.`);
      }
      console.log(`[parity] ⑤ ${m.section}: ${(m.con || []).length} mục con · ${chuaXong.length} chưa xong`
        + `${coMucNguoi ? ' · có mục chỉ người kiểm được ⇒ § phải ⚠️' : ''}`);
    }
  }

  const dem = { '✅': 0, '⛔': 0, '⚠️': 0 };
  for (const r of nghiemThu) dem[r.tt] += 1;

  /*
   * ĐẾM CẢ HAI KHỐI CÒN LẠI. Bản đầu chỉ đếm dòng có ký hiệu trạng thái, nên dòng tổng in
   * `⛔ 0 · ⚠️ 0` trong khi hai khối đó có 6 dòng mỗi khối — một dòng tổng nói sai về chính tài liệu
   * nó đang gác. Hai khối kia là bảng 2 cột không có cột trạng thái (ký hiệu đã nằm ở tiêu đề khối).
   */
  const demKhoi = (re) => {
    const i = dong.findIndex((l) => re.test(l));
    if (i < 0) return 0;
    /*
     * DỪNG Ở `##` HOẶC `###`. Bản trước chỉ dừng ở `##`, nên một mục con `###` ghi chú nằm trong khối
     * bị đếm lẫn vào: số "chưa có máy" nhảy từ 6 lên 11 chỉ vì tôi thêm một bảng giải thích. Dòng tổng
     * của cửa mà nói sai về chính tài liệu nó đang gác thì nó dạy người đọc tin một con số rỗng — đây
     * là lần thứ hai cùng lớp lỗi ở file này.
     */
    const j = dong.findIndex((l, k) => k > i && /^#{2,3}\s/.test(l));
    return dong.slice(i, j < 0 ? dong.length : j)
      .filter((l) => l.trim().startsWith('|') && !/^\|[\s|:-]*\|$/.test(l.trim()) && !/^\| A có \||^\| Việc \|/.test(l.trim()))
      .length;
  };
  const soKhongPort = demKhoi(KHOI[1].re);
  const soChuaMay = demKhoi(KHOI[2].re);

  console.log(`[parity] ${path.relative(REPO, FILE).split(path.sep).join('/')} · ${nghiemThu.length} dòng nghiệm thu`);
  console.log(`[parity]   ✅ đã làm ${dem['✅']} · ⛔ cố ý không port ${soKhongPort + dem['⛔']} · ⚠️ chưa có máy ${soChuaMay + dem['⚠️']}`);
  if (soChuaMay === 0 && dem['⚠️'] === 0) {
    sai.push('khối "CHƯA CÓ MÁY" rỗng — một đợt làm KHÔNG còn chỗ nào thiếu máy là lời khai đáng ngờ hơn là đáng mừng. Kiểm lại, hoặc ghi một dòng nói rõ vì sao rỗng.');
  }
  console.log(`[parity]   ${goi.length} máy được nhắc, tất cả đều có trong package.json`);

  if (sai.length) {
    console.error(`\n[parity] ✗ ${sai.length} chỗ SAI:`);
    for (const x of sai) console.error(`  - ${x}`);
    console.error('\n  Bảng nghiệm thu có dòng treo thì nó không nghiệm thu gì. Kết mỗi dòng về ✅ / ⛔ / ⚠️.');
    return 1;
  }

  console.log('\n[parity] ✓ ĐẠT — không dòng nào treo, mọi máy được nhắc đều có thật, đủ ba khối.');
  console.log('[parity] Giới hạn: máy đọc KÝ HIỆU và TÊN MÁY, KHÔNG đọc nghĩa. Một dòng ✅ có ĐÚNG hay');
  console.log('[parity] không thì phải đối chiếu với `tests/fe/infra/` và với chính commit.');
  return 0;
}

module.exports = { TT_HOP_LE, RE_TREO };
if (require.main === module) process.exit(main());
