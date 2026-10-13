#!/usr/bin/env node
'use strict';
/*
 * full:suite — SỔ GHI LƯỢT CHẠY CẢ BỘ, và cửa chặn đóng gói khi sổ đã cũ.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ FILE NÀY — một lỗi có thật, của chính tác giả nó, trong đợt v2.8.0.
 *
 * Suốt v2.8.0 tôi chỉ chạy các spec VỪA VIẾT sau mỗi thay đổi, rồi báo con số đó như thể là của cả bộ:
 * "169/169 xanh". Đúng với TẬP ĐÃ CHỌN, sai với toàn bộ. Cả bộ thật ra có **15 test đỏ**, và thứ duy
 * nhất phát hiện ra là `release:verify` — đúng, nhưng đắt: nó đỏ **bốn vòng liên tiếp**, mỗi vòng ~25
 * phút, và trong hai vòng đầu tôi còn chẩn đoán sai nguyên nhân.
 *
 * Bài học đã được GHI vào `BAO_CAO_CUOI.md` và QUICKSTART. Nhưng kit có một câu riêng cho chuyện đó:
 * **luật không có máy thi hành là luật chỉ dặn suông.** Một dòng chữ không chặn được ai lặp lại.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * LUẬT THIẾT KẾ QUAN TRỌNG NHẤT: GATE NÀY **TỰ CHẠY SUITE**, KHÔNG TIN MỘT LỜI KHAI.
 *
 * Cách làm dễ hơn là có một cờ `--da-chay-roi` để người/agent tự khai. Làm thế thì gate chặn đúng cái
 * nó sinh ra để chặn — một con số tự khai — và nó vô dụng ngay từ dòng đầu. Nên `--chay` THỰC SỰ gọi
 * Playwright, đọc kết quả từ output, và chỉ ghi sổ khi có số thật.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * SỔ GHI GÌ, và vì sao từng thứ:
 *   · `head` — commit lúc chạy. Đổi commit thì kết quả cũ không còn mô tả cây hiện tại.
 *   · `van_tay_goi` — băm nội dung MỌI file sẽ vào gói. Đây mới là phần chặt: `head` giống nhau mà một
 *     file được sửa chưa commit thì suite cũ KHÔNG nói gì về bản sắp đóng gói. Đợt v2.8.0 có đúng tình
 *     huống đó — một file WIP nằm nguyên trong gói.
 *   · `so_do` — chạy mà còn đỏ thì sổ vẫn ghi, nhưng `--kiem` CHẶN. Ghi cả lượt đỏ để không ai chạy lại
 *     tới khi may mắn rồi mới ghi.
 *
 * Dùng:
 *   node scripts/qa/full_suite_ledger.js --chay     # chạy cả bộ rồi ghi sổ
 *   node scripts/qa/full_suite_ledger.js --kiem     # cửa chặn: sổ có khớp cây hiện tại không
 * Exit: 0 · 1 khi `--kiem` không đạt · 2 khi không chạy được phép đo
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SO = path.join(REPO, 'knowledge', 'metrics', 'full-suite.json');

/** Phạm vi "cả bộ". Đổi chuỗi này là đổi nghĩa của sổ, nên nó nằm ở MỘT chỗ. */
const PHAM_VI = 'tests/fe/infra';

/**
 * `--workers=2`, cùng lý lẽ với `verify_release`: vài spec đo HÀNH VI THEO THỜI GIAN trên app fixture,
 * và dưới `workers` mặc định chúng bị bỏ đói rồi vượt `timeout` — đỏ vì tải, không vì sai. Đo
 * 12–13/10/2026: workers mặc định ⇒ 46 đỏ trong gói; `--workers=1` chạy riêng ⇒ 30/30 xanh.
 */
const WORKERS = '2';

function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e) { return null; }
}

/**
 * Vân tay của BẢN SẼ ĐÓNG GÓI: băm nội dung từng file mà `package_kit.collect()` chọn.
 *
 * Dùng chính danh sách của `package_kit`, không tự dựng danh sách thứ hai — hai bản sao sẽ trôi khỏi
 * nhau, và đợt v2.8.0 đã trả giá năm lần cho đúng chuyện đó.
 */
function vanTayGoi() {
  const pk = require(path.join(REPO, 'scripts', 'qa', 'package_kit.js'));
  const thu = pk.collect();
  const ds = (Array.isArray(thu) ? thu : (thu.files || [])).slice().sort();
  const h = crypto.createHash('sha256');
  let dem = 0;
  for (const rel of ds) {
    const p = path.join(REPO, rel);
    let noi;
    try { noi = fs.readFileSync(p); } catch (e) { continue; }
    h.update(rel);
    h.update(noi);
    dem += 1;
  }
  return { bam: h.digest('hex').slice(0, 16), so_file: dem };
}

function docSo() {
  try { return JSON.parse(fs.readFileSync(SO, 'utf8')); } catch (e) { return null; }
}

/** Chạy cả bộ THẬT rồi ghi sổ. Trả bản ghi. */
function chay({ im = false } = {}) {
  const truoc = vanTayGoi();
  if (!im) {
    console.log(`[full-suite] chạy ${PHAM_VI} với --workers=${WORKERS} — đây là lượt ĐO, không phải lời khai.`);
  }
  const r = spawnSync('npx', ['playwright', 'test', PHAM_VI, `--workers=${WORKERS}`, '--reporter=line'], {
    cwd: REPO,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 1024 * 1024 * 64,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const so = (re) => { const m = out.match(re); return m ? Number(m[1]) : 0; };
  const xanh = so(/(\d+)\s+passed/);
  const do_ = so(/(\d+)\s+failed/);
  const boQua = so(/(\d+)\s+skipped/);

  if (!xanh && !do_) {
    /* Không đọc được con số nào ⇒ phép đo HỎNG. Ghi sổ lúc này là ghi một con số bịa. */
    return { loi: 'không đọc được kết quả từ output Playwright — phép đo hỏng, KHÔNG ghi sổ', out: out.slice(-600) };
  }

  /*
   * Lấy vân tay LẠI sau khi chạy, và đòi nó GIỐNG lúc trước. Suite chạy mất nhiều phút; nếu ai đó sửa
   * file giữa chừng thì kết quả không mô tả cây nào cả.
   */
  const sau = vanTayGoi();
  if (sau.bam !== truoc.bam) {
    return { loi: `cây làm việc ĐỔI trong lúc suite chạy (${truoc.bam} → ${sau.bam}) — kết quả không mô tả cây nào, KHÔNG ghi sổ` };
  }

  /*
   * GHI TÊN TEST ĐỎ, không chỉ ghi SỐ.
   *
   * Bản đầu chỉ in "1 đỏ" rồi bắt người dùng chạy lại 6 phút nữa mới biết đỏ ở đâu — một công cụ báo
   * có vấn đề mà không nói vấn đề ở đâu thì nó đẩy chi phí sang người đọc. Lấy tên từ khối tổng kết
   * của reporter `line`, và lưu trọn output ra file cạnh sổ để truy lại được.
   */
  const tenDo = [];
  {
    const dong = out.split(/\r?\n/).map((l) => l.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').trim());
    const i = dong.findIndex((l) => /^\d+ failed$/.test(l));
    if (i >= 0) {
      for (let j = i + 1; j < dong.length && tenDo.length < 20; j += 1) {
        if (/^\d+ (passed|skipped|flaky)/.test(dong[j])) break;
        if (dong[j].includes('.spec.ts')) tenDo.push(dong[j].slice(0, 160));
      }
    }
  }
  const duongLog = path.join(path.dirname(SO), 'full-suite.last.log');
  try { fs.mkdirSync(path.dirname(SO), { recursive: true }); fs.writeFileSync(duongLog, out, 'utf8'); } catch (e) { /* log là tiện ích, không phải điều kiện */ }

  const ban = {
    _y: 'Sổ lượt chạy CẢ BỘ gần nhất. Sinh bằng `npm run full:suite`. KHÔNG sửa tay — sửa tay là quay về đúng lời khai mà gate này sinh ra để chặn.',
    test_do: tenDo,
    log_day_du: path.relative(REPO, duongLog).replace(/\\/g, '/'),
    pham_vi: PHAM_VI,
    workers: Number(WORKERS),
    head: headSha(),
    van_tay_goi: sau.bam,
    so_file_goi: sau.so_file,
    so_xanh: xanh,
    so_do: do_,
    so_bo_qua: boQua,
    luc: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(SO), { recursive: true });
  fs.writeFileSync(SO, `${JSON.stringify(ban, null, 2)}\n`, 'utf8');
  return { ban };
}

/** Cửa chặn. Trả `{ dat, ly_do[] }`. */
function kiem() {
  const s = docSo();
  if (!s) {
    return {
      dat: false,
      ly_do: ['CHƯA CÓ SỔ — chưa lượt chạy cả bộ nào được ghi. Chạy `npm run full:suite` trước khi đóng gói.'],
    };
  }
  const lyDo = [];
  const head = headSha();
  if (head && s.head !== head) {
    lyDo.push(`sổ ghi ở commit ${String(s.head).slice(0, 8)}, HEAD hiện tại là ${head.slice(0, 8)} — kết quả cũ không mô tả cây này.`);
  }
  const vt = vanTayGoi();
  if (s.van_tay_goi !== vt.bam) {
    lyDo.push(
      `vân tay bản-sẽ-đóng-gói đổi (${s.van_tay_goi} → ${vt.bam}, ${s.so_file_goi} → ${vt.so_file} file) — `
      + 'có file sẽ vào gói đã sửa SAU lượt chạy. HEAD giống nhau KHÔNG đủ: một file chưa commit vẫn đi vào gói.',
    );
  }
  if (s.so_do > 0) {
    lyDo.push(`lượt chạy gần nhất còn ${s.so_do} ĐỎ — sổ ghi cả lượt đỏ CÓ Ý, để không ai chạy lại tới khi may mắn rồi mới ghi.`);
  }
  if (s.pham_vi !== PHAM_VI) {
    lyDo.push(`sổ ghi phạm vi \`${s.pham_vi}\`, nay phạm vi là \`${PHAM_VI}\` — hai phép đo khác nhau.`);
  }
  return { dat: lyDo.length === 0, ly_do: lyDo, so: s };
}

function main() {
  const argv = process.argv;

  if (argv.includes('--kiem')) {
    const d = kiem();
    if (d.dat) {
      console.log(`[full-suite] ✓ sổ khớp cây hiện tại — ${d.so.so_xanh} xanh · ${d.so.so_bo_qua} bỏ qua · 0 đỏ (${d.so.luc.slice(0, 16)})`);
      return;
    }
    console.error('[full-suite] ✗ CHẶN — sổ lượt chạy cả bộ không mô tả cây sắp đóng gói:');
    for (const l of d.ly_do) console.error(`  · ${l}`);
    console.error('');
    console.error('  Vì sao cửa này tồn tại: ở v2.8.0, tác giả nó chỉ chạy các spec vừa viết rồi báo con số đó');
    console.error('  như thể của cả bộ. Cả bộ có 15 test đỏ, và `release:verify` phải đỏ BỐN vòng (~25 phút mỗi');
    console.error('  vòng) mới lôi ra. Chạy `npm run full:suite` (~6 phút) rẻ hơn hẳn.');
    process.exit(1);
  }

  const d = chay();
  if (d.loi) {
    console.error(`[full-suite] CHƯA ĐO ĐƯỢC — ${d.loi}`);
    if (d.out) console.error(d.out);
    process.exit(2);
  }
  const b = d.ban;
  console.log(`[full-suite] ${b.so_xanh} xanh · ${b.so_do} đỏ · ${b.so_bo_qua} bỏ qua — ghi sổ ${path.relative(REPO, SO).replace(/\\/g, '/')}`);
  console.log(`[full-suite] head ${String(b.head).slice(0, 8)} · vân tay gói ${b.van_tay_goi} (${b.so_file_goi} file)`);
  if (b.so_do > 0) {
    console.error('');
    console.error(`[full-suite] ✗ còn ${b.so_do} ĐỎ:`);
    for (const t of b.test_do) console.error(`    ${t}`);
    if (!b.test_do.length) console.error('    (không đọc được tên từ output — xem log đầy đủ)');
    console.error(`[full-suite] log đầy đủ: ${b.log_day_du}`);
    console.error('[full-suite] `--kiem` sẽ CHẶN đóng gói. Sửa rồi chạy lại, đừng chạy lại tới khi may mắn.');
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { chay, kiem, docSo, vanTayGoi, PHAM_VI, SO };
