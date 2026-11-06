#!/usr/bin/env node
/**
 * `skills:practice` — ĐỌC MỘT SKILL XONG CÓ LÀM RA ĐƯỢC SẢN PHẨM KHÔNG.
 *
 * Dùng: node scripts/qa/skills_practice.js [--bai <mã>] [--lan N] [--ra <file.md>] [--gia]
 *   exit 0 = đạt · 1 = dưới ngưỡng · 2 = KHÔNG PHÁN ĐƯỢC
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * VÌ SAO CÓ MÁY NÀY, VÀ VÌ SAO NÓ KHÁC MỌI CỬA KHÁC CỦA KIT
 *
 * `skills:lint` chấm mô tả có ĐỦ THÔNG TIN ĐỂ CHỌN. `skills:template:check` chấm mẫu có THẬT và có
 * QUA MÁY. Cả hai đo TÀI LIỆU. Không cửa nào trả lời được câu cuối cùng: **đọc skill xong có làm ra
 * được sản phẩm qua được gate không**.
 *
 * Máy này trả lời bằng cách cho model thật làm bài, mỗi bài chỉ đọc ĐÚNG MỘT skill. Thư mục fixture
 * cố ý KHÔNG có `prompt_templates/`, nên model không thể mở prompt phase để lấy thêm hướng dẫn — nếu
 * nó làm được, đó là nhờ skill, không nhờ thứ khác.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * MỖI BÀI CHẠY NHIỀU LƯỢT, và đó không phải sự thận trọng dư.
 *
 * Đo 05/11/2026 với `skills:route:live`: hai lượt của CÙNG một trạng thái lệch nhau 8,8 điểm. Một
 * lượt rồi phán là không phân biệt được "skill mỏng" với "hôm nay bốc phải lượt thấp". Mặc định 3
 * lượt, đạt khi >= 2/3 — đúng ngưỡng mục 1.4 đặt ra.
 *
 * LƯỢT KHÔNG CHẠY ĐƯỢC KHÔNG TÍNH LÀ TRƯỢT. Đọc `result.subtype` và `is_error`; lượt hỏng bị loại ra
 * khỏi mẫu số và báo riêng. Bản đầu của `skills_route_live.js` trộn hai thứ đó và làm năm lượt quét
 * 90 câu trở nên vô nghĩa — không lặp lại ở đây.
 *
 * KHÔNG VÀO CI: mỗi lượt là một phiên model thật, tốn tiền của người chạy. Cờ `--gia` chạy ĐÚNG MỘT
 * lượt và chỉ in chi phí, để đo giá trước khi quyết chạy cả bộ.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'practice');

const co = (ten, macDinh) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : macDinh;
};
const flag = (n) => process.argv.includes(`--${n}`);

const GIA = flag('gia');
const LAN = GIA ? 1 : Math.max(1, Number(co('lan', '3')));
const CHI_BAI = co('bai', null);
const RA = co('ra', null);
/* Lưu CÂU TRẢ LỜI thô. Không có nó thì khi một bài trượt, không phân biệt được 'skill mỏng'
 * với 'bộ chấm của tôi khắt khe' — và kết luận sai ở đây sẽ dẫn tới sửa nhầm skill. */
const LUU = co('luu', null);

/* ── Bộ bài ────────────────────────────────────────────────────────────────────────────────────
 *
 * Mỗi bài khai: skill DUY NHẤT được đọc, đề bài, và cách chấm. `cham` nhận câu trả lời của model rồi
 * trả `{ dat, chiTiet }` — chấm bằng máy, không bằng cách đọc rồi cảm thấy.
 */
const BAI = [
  {
    ma: 'review-5-loi',
    skill: 'automation_reviewer',
    /* Đề bài nằm ở `.de.txt` để Playwright KHÔNG thu nó làm test; trong thư mục làm bài nó mang lại
     * tên `.spec.ts` để model thấy đúng thứ nó phải review. */
    tep: [{ tu: 'spec_5_loi.de.txt', thanh: 'spec_5_loi.spec.ts' }],
    de: 'Review file `spec_5_loi.spec.ts` trong thư mục này. Nêu TỪNG lỗi kèm số dòng. Chỉ đọc skill automation_reviewer, đừng tìm tài liệu khác.',
    cham(traLoi) {
      const dapAn = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'spec_5_loi.dapan.json'), 'utf8'));
      const t = traLoi.toLowerCase();
      const soDong = new Set((traLoi.match(/\b\d{1,3}\b/g) || []).map(Number));
      const tim = [];
      for (const l of dapAn.loi) {
        const coTu = l.tu_khoa.some((k) => t.includes(String(k).toLowerCase()));
        const coDong = l.dong.some((d) => soDong.has(d));
        if (coTu && coDong) tim.push(l.ma);
      }
      return { dat: tim.length >= 4, chiTiet: `${tim.length}/5 lỗi có cả từ khoá VÀ số dòng: ${tim.join(', ') || '(không có)'}` };
    },
  },
];

function thoat2(msg, them) {
  console.log(`[practice] KHÔNG PHÁN ĐƯỢC — ${msg}`);
  if (them) console.log(`           ${them}`);
  process.exit(2);
}

let phienBan;
try {
  phienBan = execFileSync('claude', ['--version'], { timeout: 30000, shell: process.platform === 'win32' }).toString().trim();
} catch (e) {
  thoat2('không gọi được `claude` CLI.', 'Máy này CẦN model thật; không có CLI thì nó im, không đoán.');
}
if (!fs.existsSync(FIXTURE)) thoat2(`không thấy ${path.relative(REPO, FIXTURE)}.`);

/** Thư mục làm bài: chỉ một skill + các tệp đề. KHÔNG có prompt_templates/. */
function dungGoc(bai) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), `practice-${bai.ma}-`));
  const nguon = ['phase1', 'phase2', 'shared']
    .map((g) => path.join(REPO, '.agent', 'skills', g, bai.skill))
    .find((p) => fs.existsSync(p));
  if (!nguon) thoat2(`không thấy skill \`${bai.skill}\` trong .agent/skills/.`);
  const dich = path.join(goc, '.claude', 'skills', bai.skill);
  fs.mkdirSync(dich, { recursive: true });
  fs.cpSync(nguon, dich, { recursive: true });
  for (const t of bai.tep) fs.copyFileSync(path.join(FIXTURE, t.tu), path.join(goc, t.thanh));
  return goc;
}

const CAM = 'Task,Edit,Write,NotebookEdit,WebFetch,WebSearch,Monitor,Artifact,PowerShell';

function motLuot(bai, goc) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const args = ['-p', bai.de, '--output-format', 'stream-json', '--disallowed-tools', CAM, '--max-turns', '12', '--verbose'];
    const dungShell = process.platform === 'win32';
    const p = dungShell
      ? spawn(['claude', ...args.map(q)].join(' '), { cwd: goc, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('claude', args, { cwd: goc, stdio: ['ignore', 'pipe', 'pipe'] });

    let buf = '';
    let traLoi = '';
    let ketCuc = null;
    let coLoi = false;
    let token = { vao: 0, ra: 0 };
    let chiPhi = null;
    p.stdout.on('data', (d) => {
      buf += String(d);
      const dong = buf.split('\n');
      buf = dong.pop() || '';
      for (const l of dong) {
        if (!l.trim()) continue;
        let j;
        try { j = JSON.parse(l); } catch (e) { continue; }
        if (j.type === 'result') {
          ketCuc = String(j.subtype || 'success');
          if (j.is_error) coLoi = true;
          if (typeof j.total_cost_usd === 'number') chiPhi = j.total_cost_usd;
          if (j.usage) token = { vao: j.usage.input_tokens || 0, ra: j.usage.output_tokens || 0 };
          if (j.result) traLoi += String(j.result);
        }
        const noi = j.message && j.message.content;
        for (const b of (Array.isArray(noi) ? noi : [])) if (b.type === 'text') traLoi += `\n${b.text}`;
      }
    });
    p.stderr.on('data', () => {});
    p.on('close', () => {
      const chayDuoc = !coLoi && (ketCuc === 'success' || ketCuc === 'error_max_turns');
      ok({ chayDuoc, ketCuc: ketCuc || '(không có result)', traLoi, token, chiPhi, giay: Math.round((Date.now() - t0) / 1000) });
    });
    p.on('error', () => ok({ chayDuoc: false, ketCuc: '(spawn lỗi)', traLoi: '', token, chiPhi, giay: 0 }));
  });
}

(async () => {
  const ds = CHI_BAI ? BAI.filter((b) => b.ma === CHI_BAI) : BAI;
  if (!ds.length) thoat2(`không có bài nào khớp \`--bai ${CHI_BAI}\`.`, `Bài đang có: ${BAI.map((b) => b.ma).join(', ')}`);

  const soSach = [];
  for (const bai of ds) {
    const goc = dungGoc(bai);
    for (let i = 1; i <= LAN; i += 1) {
      const r = await motLuot(bai, goc);
      const cham = r.chayDuoc ? bai.cham(r.traLoi) : { dat: null, chiTiet: `LƯỢT KHÔNG CHẠY (${r.ketCuc})` };
      soSach.push({ bai: bai.ma, skill: bai.skill, lan: i, ...r, ...cham });
      if (LUU) {
        const p = path.join(REPO, LUU);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.appendFileSync(p, `
===== ${bai.ma} lượt ${i} · ${cham.chiTiet} =====
${r.traLoi}
`, "utf8");
      }
      console.log(`[practice] ${bai.ma} lượt ${i}/${LAN} · ${r.giay}s · ${r.token.vao}+${r.token.ra} token${r.chiPhi != null ? ` · $${r.chiPhi.toFixed(4)}` : ''} · ${cham.dat === null ? 'KHÔNG ĐO ĐƯỢC' : (cham.dat ? 'ĐẠT' : 'TRƯỢT')} — ${cham.chiTiet}`);
    }
    try { fs.rmSync(goc, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ }
  }

  const hong = soSach.filter((x) => x.dat === null);
  const chay = soSach.filter((x) => x.dat !== null);
  const tongGiay = soSach.reduce((a, x) => a + x.giay, 0);
  const tongToken = soSach.reduce((a, x) => a + x.token.vao + x.token.ra, 0);
  const tongTien = soSach.reduce((a, x) => a + (x.chiPhi || 0), 0);

  console.log('');
  console.log(`[practice] model ${phienBan} · ${soSach.length} lượt · ${tongGiay}s · ${tongToken} token · $${tongTien.toFixed(4)}`);
  if (hong.length) console.log(`[practice] ⚠ ${hong.length} lượt KHÔNG CHẠY ĐƯỢC, loại khỏi mẫu số`);

  if (GIA) {
    const soBai = BAI.length;
    console.log('');
    console.log('— ƯỚC CHI PHÍ CẢ BỘ, suy từ lượt vừa đo —');
    console.log(`  ${soBai} bài × 3 lượt = ${soBai * 3} lượt · ~${Math.round(tongGiay * soBai * 3 / 60)} phút · ~${tongToken * soBai * 3} token · ~$${(tongTien * soBai * 3).toFixed(2)}`);
    console.log('  Đây là ƯỚC từ MỘT lượt của MỘT bài, không phải số đo cả bộ. Bài khác đề khác, giá khác.');
    process.exit(0);
  }

  if (!chay.length) thoat2('không lượt nào chạy được.', 'Kiểm rate limit rồi chạy lại.');

  let truot = 0;
  for (const bai of ds) {
    const cua = chay.filter((x) => x.bai === bai.ma);
    const dat = cua.filter((x) => x.dat).length;
    const ok = cua.length > 0 && dat / cua.length >= 2 / 3;
    if (!ok) truot += 1;
    console.log(`[practice] ${bai.ma} (${bai.skill}): ${dat}/${cua.length} lượt đạt ⇒ ${ok ? 'ĐẠT' : 'TRƯỢT'}`);
  }

  if (RA) {
    const d = new Date().toISOString().slice(0, 10);
    const dong = [
      `# skills:practice — ${d}`, '',
      `- model CLI: \`${phienBan}\``,
      `- bài: **${ds.length}** · lượt mỗi bài: **${LAN}** · đạt khi ≥ 2/3`,
      `- tổng: ${soSach.length} lượt · ${tongGiay}s · ${tongToken} token · $${tongTien.toFixed(4)}`,
      ...(hong.length ? [`- ⚠ **${hong.length} lượt KHÔNG CHẠY ĐƯỢC**, đã loại khỏi mẫu số`] : []),
      '',
      '> Mỗi bài chỉ đọc ĐÚNG MỘT skill; thư mục làm bài KHÔNG có `prompt_templates/`, nên model không',
      '> mở được prompt phase để lấy thêm hướng dẫn. Làm được là nhờ skill, không nhờ thứ khác.',
      '>',
      '> **Giới hạn, nói thẳng:** số bài hiện tại KHÔNG phủ hết 28 skill. Bài nào trượt thì sửa SKILL,',
      '> không sửa đề.',
      '',
      '| bài | skill | lượt | kết quả | chi tiết |', '|---|---|---|---|---|',
      ...soSach.map((x) => `| ${x.bai} | ${x.skill} | ${x.lan} | ${x.dat === null ? 'KHÔNG ĐO ĐƯỢC' : (x.dat ? 'ĐẠT' : '**TRƯỢT**')} | ${x.chiTiet} |`),
    ];
    fs.mkdirSync(path.dirname(path.join(REPO, RA)), { recursive: true });
    fs.writeFileSync(path.join(REPO, RA), dong.join('\n') + '\n', 'utf8');
    console.log(`[practice] đã ghi ${RA}`);
  }

  console.log(truot === 0 ? '[practice] ✓ ĐẠT' : `[practice] ✗ ${truot}/${ds.length} bài TRƯỢT — sửa SKILL, không sửa đề.`);
  process.exitCode = truot === 0 ? 0 : 1;
})();
