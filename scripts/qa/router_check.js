#!/usr/bin/env node
'use strict';

/*
 * router_check.js — BẢNG ĐỊNH TUYẾN phải phủ MỌI điểm vào, và mỗi dòng phải nói RANH GIỚI.
 *
 * VÌ SAO CẦN. Kit có 13 lệnh `/`, 16 workflow, 3 subagent. Ba chỗ đã liệt kê chúng
 * (`docs/CHEATSHEET.md`, `docs/kit-map.md`, `.agent/skills/INDEX.md`) nhưng — đo 29/10/2026 — KHÔNG chỗ
 * nào ghi "KHÔNG dùng khi". Một danh sách không ranh giới trả lời được "kit có lệnh gì", không trả lời
 * được "lệnh nào SAI cho việc này"; và chọn sai điểm vào tốn cả một lượt chạy, thường kết thúc bằng một
 * kết luận nhìn rất hợp lý.
 *
 * HAI ĐIỀU ĐƯỢC GÁC, và điều thứ hai mới là điều khó:
 *   ① PHỦ. Thêm command/workflow/agent mà không thêm dòng ⇒ CHẶN. Mẫu số đọc từ ĐĨA, không gõ tay —
 *      đây đúng lớp lỗi "mẫu số tự khai" mà `scope_anchor.js` nói tới.
 *   ② RANH GIỚI KHÔNG RỖNG. Bảng mà cột `KHÔNG dùng khi` để trống thì nó tụt về đúng ba bản liệt kê đã
 *      có, và lúc đó phép kiểm ① vẫn xanh. Một cửa chỉ gác ① là cửa dạy người ta điền dấu `-` cho đủ.
 *
 * GIỚI HẠN TỰ KHAI: máy đọc TÊN và ĐỘ DÀI ô, **không hiểu nghĩa**. Nó không biết ranh giới viết ra có
 * đúng hay không — chuyện đó phải review tay. Nó chỉ bảo đảm mỗi điểm vào có một dòng, và dòng đó có
 * một câu ranh giới đủ dài để chứa được một lý do.
 *
 * Dùng:
 *   node scripts/qa/router_check.js
 *   ... --bang <path>   # đo trên bảng KHÁC (để dựng đối chứng, không sửa file thật)
 *   ... --repo <dir>    # đo trên cây KHÁC
 * Exit: 0 đạt · 1 đã đo và SAI · 2 KHÔNG PHÁN ĐƯỢC (thiếu bảng, hoặc không đọc được điểm vào nào).
 */

const fs = require('fs');
const path = require('path');

const doiSo = (ten) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};

const REPO = path.resolve(doiSo('repo') || path.join(__dirname, '..', '..'));
const BANG = path.resolve(doiSo('bang')
  || path.join(REPO, '.agent/skills/phase2/qa_automation_engineer/references/router.md'));

/* Ô ranh giới phải đủ dài để chứa một LÝ DO, không chỉ một dấu. Sàn 25 ký tự đo từ chính bảng hiện có:
 * ô ngắn nhất ở đó là 44 ký tự, nên 25 vẫn còn chỗ cho câu ngắn mà loại sạch `-`, `n/a`, `chưa rõ`. */
const SAN_RANH_GIOI = 25;

/* Mẫu số: đọc từ ĐĨA. Thêm file là tự có mặt trong phép đo. */
function diemVao() {
  const liet = (dir, duoi) => {
    try {
      return fs.readdirSync(path.join(REPO, dir)).filter((f) => f.endsWith(duoi)).map((f) => f.slice(0, -duoi.length));
    } catch { return []; }
  };
  return [
    { loai: 'command', nhan: 'lệnh `/`', ten: liet('.claude/commands', '.md') },
    { loai: 'workflow', nhan: 'workflow', ten: liet('.agent/workflows', '.md') },
    { loai: 'agent', nhan: 'subagent', ten: liet('.claude/agents', '.md') },
  ];
}

/*
 * Dòng bảng Markdown → Map `<loai>:<ten>` → ô ranh giới.
 *
 * KHOÁ PHẢI GỒM LOẠI. Bản đầu khoá bằng TÊN TRẦN, và nó báo ĐẠT trên một bảng thiếu một dòng: `rerun`
 * tồn tại vừa là lệnh `/6_phase4` vừa là workflow `13_tong_quan_rerun.md`, nên MỘT dòng che được HAI điểm vào. 31 dòng
 * phủ 32 điểm vào mà cửa vẫn xanh — đúng kiểu hỏng mà một cửa phủ sinh ra: nó đếm khớp, không đếm phủ.
 *
 * Mốc phân vùng là COMMENT MÁY-ĐỌC (`<!-- router:command -->`), KHÔNG phải câu chữ tiêu đề. Neo vào
 * câu chữ là lớp "stale gate" đã cắn kit ba lần: đổi lời tiêu đề thì cửa quay lại chống chính tài liệu.
 */
function docBang(noiDung) {
  const ra = new Map();
  let loai = null;
  for (const dong of noiDung.split(/\r?\n/)) {
    const moc = dong.match(/^<!--\s*router:([a-z]+)\s*-->/);
    if (moc) { loai = moc[1] === 'het' ? null : moc[1]; continue; }
    if (!loai || !dong.startsWith('|')) continue;
    const o = dong.split('|').slice(1, -1).map((x) => x.trim());
    if (o.length < 3) continue;
    const m = o[0].match(/^`\/?([a-z0-9_-]+)`$/);
    if (!m) continue;
    /* Cột CUỐI là `KHÔNG dùng khi` ở cả ba bảng. Lấy theo vị trí cuối, không theo số 3: bảng nào thêm
     * cột ở giữa thì phép kiểm vẫn soi đúng ô ranh giới. */
    ra.set(`${loai}:${m[1]}`, o[o.length - 1]);
  }
  return ra;
}

function main() {
  if (!fs.existsSync(BANG)) {
    console.error(`[router-check] KHÔNG PHÁN ĐƯỢC: thiếu bảng ${path.relative(REPO, BANG)}`);
    return 2;
  }
  const nhom = diemVao();
  const tong = nhom.reduce((n, g) => n + g.ten.length, 0);
  if (tong === 0) {
    console.error('[router-check] KHÔNG PHÁN ĐƯỢC: không đọc được điểm vào nào từ đĩa.');
    console.error('  "không có gì để gác" KHÔNG đồng nghĩa với "đạt" — kiểm lại --repo.');
    return 2;
  }

  const bang = docBang(fs.readFileSync(BANG, 'utf8'));
  const thieuDong = [];
  const ranhGioiYeu = [];

  for (const g of nhom) {
    for (const t of g.ten) {
      const khoa = `${g.loai}:${t}`;
      if (!bang.has(khoa)) { thieuDong.push(`${g.nhan} \`${t}\``); continue; }
      const rg = bang.get(khoa);
      if (rg.replace(/[`*\s-]/g, '').length < SAN_RANH_GIOI) {
        ranhGioiYeu.push(`${g.nhan} \`${t}\` — ô "KHÔNG dùng khi" chỉ có: ${JSON.stringify(rg)}`);
      }
    }
  }

  /* Dòng MỒ CÔI: bảng còn tên mà trên đĩa không còn. Không chặn — xoá một lệnh rồi quên xoá dòng là
   * chuyện nhỏ hơn nhiều so với thêm lệnh mà quên thêm dòng. Nhưng phải NÓI, vì dòng mồ côi dạy người
   * đọc một lệnh không tồn tại. */
  const coThat = new Set(nhom.flatMap((g) => g.ten.map((t) => `${g.loai}:${t}`)));
  const moCoi = [...bang.keys()].filter((k) => !coThat.has(k));

  console.log(`[router-check] bảng ${path.relative(REPO, BANG)} · ${bang.size} dòng · ${tong} điểm vào trên đĩa`);
  for (const g of nhom) console.log(`[router-check]   ${g.nhan}: ${g.ten.length}`);

  if (moCoi.length) {
    console.log(`[router-check] ⚠ ${moCoi.length} dòng MỒ CÔI (trên đĩa không còn): ${moCoi.join(', ')}`);
  }

  if (thieuDong.length) {
    console.error(`\n[router-check] ✗ ${thieuDong.length} điểm vào KHÔNG có dòng trong bảng định tuyến:`);
    for (const x of thieuDong) console.error(`  - ${x}`);
    console.error('\n  Thêm một dòng vào bảng. Điểm vào không có dòng thì nó tồn tại mà không ai biết');
    console.error('  khi nào nên dùng — và quan trọng hơn, khi nào KHÔNG nên.');
  }
  if (ranhGioiYeu.length) {
    console.error(`\n[router-check] ✗ ${ranhGioiYeu.length} dòng có ô "KHÔNG dùng khi" quá ngắn (sàn ${SAN_RANH_GIOI} ký tự):`);
    for (const x of ranhGioiYeu) console.error(`  - ${x}`);
    console.error('\n  Cột này là lý do bảng tồn tại. Điền dấu cho đủ ô thì bảng tụt về đúng ba bản');
    console.error('  liệt kê lệnh đã có ở CHEATSHEET / kit-map / skills INDEX.');
  }
  if (thieuDong.length || ranhGioiYeu.length) return 1;

  console.log('[router-check] ✓ ĐẠT — mọi điểm vào có dòng, và mọi dòng có ranh giới.');
  console.log('[router-check] Nhắc: máy đọc TÊN và ĐỘ DÀI ô, KHÔNG hiểu nghĩa. Ranh giới viết ra có đúng');
  console.log('[router-check] hay không thì phải review tay — cửa này chỉ bảo đảm nó có mặt và đủ dài.');
  return 0;
}

process.exit(main());
