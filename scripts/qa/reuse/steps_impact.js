#!/usr/bin/env node
'use strict';
/*
 * steps:impact — AI PHỤ THUỘC BƯỚC NÀO, VÀ CỬA CHẶN ĐỔI HỢP ĐỒNG (v2.8.0 §E).
 *
 * Hai việc, và việc thứ hai mới là cái có răng:
 *
 *   1. `--id <id>` — liệt kê spec nào đang dùng bước đó, ở phiên bản nào. Đọc từ dấu `Bước đã dùng:
 *      <id>@<version>` mà `compile:spec` ghi vào đầu mỗi case.
 *
 *   2. (mặc định) **CỬA PHIÊN BẢN** — so danh mục ở cây làm việc với danh mục ở `HEAD`. Bước nào đổi
 *      HỢP ĐỒNG (`params` · `pre` · `post`) mà SỐ CHÍNH không tăng thì CHẶN, kèm danh sách spec sẽ vỡ.
 *
 * VÌ SAO CỬA PHIÊN BẢN QUAN TRỌNG HƠN. Đổi `params` của một bước là đổi chữ ký hàm mà hàng chục spec
 * đang gọi. Không có cửa này thì cái sai hiện ra ở tầng Playwright, trong một lượt chạy UAT, dưới dạng
 * một case FAIL trông như lỗi sản phẩm — và người ta đi tìm bug trong app cho một thay đổi ở thư viện.
 * Cùng một lớp lỗi với việc dựng state sai rồi gán nhầm tầng lỗi.
 *
 * Đổi `mo_ta`/`phrases`/`ghi_chu` KHÔNG phải đổi hợp đồng: thêm một cách diễn đạt chỉ làm bước khớp được
 * nhiều câu hơn, không làm spec đang chạy vỡ. Phân biệt đó phải rạch ròi, nếu không cửa báo oan mỗi lần
 * ai đó thêm một `phrases` và người ta sẽ học cách bỏ qua nó.
 *
 * Dùng:
 *   node scripts/qa/reuse/steps_impact.js            # cửa phiên bản (so với HEAD)
 *   node scripts/qa/reuse/steps_impact.js --id <id>  # ai đang dùng bước này
 * Exit: 0 · 1 khi đổi hợp đồng mà không tăng số chính · 2 khi không đọc được danh mục ở HEAD
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const cc = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_check.js'));

/** Khoá tạo thành HỢP ĐỒNG của một bước. Đổi chúng ⇒ spec đang gọi có thể vỡ. */
const KHOA_HOP_DONG = ['params', 'pre', 'post', 'impl'];

/** Dấu `compile:spec` ghi ở đầu mỗi case. */
const RE_BUOC_DA_DUNG = /Bước đã dùng:\s*(.+)$/m;

function soChinh(v) { return Number(String(v || '0').split('.')[0]) || 0; }

/** Danh mục ở `HEAD`. Trả `null` khi chưa có (lần commit đầu) — đó KHÔNG phải lỗi. */
function danhMucOHead() {
  const rel = path.relative(REPO, sm.DUONG_DANH_MUC).replace(/\\/g, '/');
  try {
    const txt = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: REPO, encoding: 'utf8' });
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

/** Quét spec sinh tự động, trả Map<id, [{file, tcId, version}]>. */
function aiDangDung() {
  const theo = new Map();
  const files = [];
  for (const g of cc.cacGoc(null)) {
    const q = (d) => {
      let muc;
      try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
      for (const f of muc) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) { q(p); continue; }
        if (/\.spec\.ts$/.test(f.name) && fs.readFileSync(p, 'utf8').includes(cc.DAU_SINH)) files.push(p);
      }
    };
    q(g);
  }

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    /* Mỗi case một dấu, nên phải tách theo case rồi mới đọc dấu — đọc cả file chỉ lấy được case đầu. */
    const { ds } = cc.tachCase(src);
    for (const c of ds) {
      const m = RE_BUOC_DA_DUNG.exec(c.dau);
      if (!m) continue;
      for (const phan of m[1].split('·').map((x) => x.trim()).filter(Boolean)) {
        const [id, ver] = phan.split('@');
        if (!id || id.startsWith('(')) continue;
        if (!theo.has(id)) theo.set(id, []);
        theo.get(id).push({ file: rel, tcId: c.ten, version: ver || '(không ghi)' });
      }
    }
  }
  return { theo, so_file: files.length };
}

/**
 * So danh mục cây làm việc với HEAD.
 *
 * `opts.nay`/`opts.cu`/`opts.dung` nhận từ ngoài CHỈ để spec tiêm dữ liệu. Phép đối chứng ÂM của cửa
 * này cần một danh mục đã đổi hợp đồng, và sửa file thật rồi hoàn nguyên là cách chắc chắn để một lượt
 * chạy hỏng giữa chừng bỏ lại repo ở trạng thái sai.
 *
 * LƯU Ý VỀ MẪU SỐ: `so_spec_quet` và danh sách CHẶN là hai phép đo ĐỘC LẬP. Chặn dựa trên phần so
 * danh mục, nên nó đúng kể cả khi chưa biên dịch spec nào; còn `so_spec` của từng mục là vùng ảnh hưởng
 * ĐÃ BIẾT, và nó bằng 0 khi chưa có spec nào được sinh ra — không phải khi không ai dùng bước đó.
 */
function cuaPhienBan(opts = {}) {
  const nay = opts.nay || sm.napDanhMuc();
  if (!nay) return { loi: 'không đọc được danh mục ở cây làm việc' };
  const cu = opts.cu !== undefined ? opts.cu : danhMucOHead();
  if (!cu) return { chua_co_o_head: true, chan: [], canh_bao: [], so_buoc: nay.buoc.length };

  const theoCu = new Map(cu.buoc.map((b) => [b.id, b]));
  const { theo: dung, so_file } = opts.dung ? { theo: opts.dung, so_file: opts.so_file || 0 } : aiDangDung();

  const chan = [];
  const canhBao = [];

  for (const b of nay.buoc) {
    const truoc = theoCu.get(b.id);
    if (!truoc) continue; /* bước MỚI — không có hợp đồng cũ để phá */

    const doi = KHOA_HOP_DONG.filter((k) => JSON.stringify(truoc[k]) !== JSON.stringify(b[k]));
    if (!doi.length) continue;

    const tangChinh = soChinh(b.version) > soChinh(truoc.version);
    const anhHuong = dung.get(b.id) || [];
    if (!tangChinh) {
      chan.push({
        id: b.id,
        doi,
        version: `${truoc.version} → ${b.version}`,
        so_spec: anhHuong.length,
        anh_huong: anhHuong.slice(0, 10),
      });
    } else {
      canhBao.push({ id: b.id, doi, version: `${truoc.version} → ${b.version}`, so_spec: anhHuong.length });
    }
  }

  /* Bước BIẾN MẤT khỏi danh mục mà spec còn gọi — không tự xoá file khi còn người tham chiếu (§5). */
  for (const [id] of theoCu) {
    if (nay.buoc.some((b) => b.id === id)) continue;
    const anhHuong = dung.get(id) || [];
    if (anhHuong.length) {
      chan.push({ id, doi: ['XOÁ KHỎI DANH MỤC'], version: '—', so_spec: anhHuong.length, anh_huong: anhHuong.slice(0, 10) });
    } else {
      canhBao.push({ id, doi: ['XOÁ KHỎI DANH MỤC'], version: '—', so_spec: 0 });
    }
  }

  return { so_buoc: nay.buoc.length, so_spec_quet: so_file, chan, canh_bao: canhBao };
}

/** File nào thuộc thư viện bước v2.8.0. `.agent/config/step_phrasing.json` tính là thư viện: nó quyết định câu nào khớp bước nào. */
const laThuVienBuoc = (f) => /^tests\/fe\/lib\//.test(String(f).replace(/\\/g, '/'))
  || String(f).replace(/\\/g, '/') === '.agent/config/step_phrasing.json';

/**
 * Từ danh sách FILE ĐỔI → vùng spec bị ảnh hưởng. Dùng bởi `select:tests` (§F).
 *
 * Trả `{ thu_vien_doi, dien_rong, spec, ly_do }`. `dien_rong: true` nghĩa **CHƯA BIẾT** vùng ảnh hưởng
 * — và lúc đó người gọi phải chạy TẤT CẢ, không được rơi về `@smoke`.
 *
 * Ba nhánh, và ranh giới giữa chúng là chỗ dễ sai nhất:
 *
 *   - **0 spec biên dịch** ⇒ `dien_rong`. Con số 0 ở đây là "chưa có gì để soi", không phải "không ai
 *     bị ảnh hưởng". Biến nó thành `@smoke` là đổi một phép đo thiếu thành một lời bảo đảm.
 *   - **Đổi `step_catalog.json` / `step_phrasing.json`** ⇒ mọi spec biên dịch. Một mục đổi `phrases`
 *     làm MỌI câu khớp lại, nên không khoanh theo mã bước được.
 *   - **Đổi file thi hành** (`_widget/*.ts`, `_checks/*.ts`, …) ⇒ chỉ những bước có `impl` trỏ vào đó.
 *     Không mục nào trỏ tới ⇒ lại là `dien_rong`, vì file đó có thể đang được gọi từ chỗ khác.
 */
function vungAnhHuongTuFileDoi(fileDoi, opts = {}) {
  const thuVien = (fileDoi || []).map((f) => String(f).replace(/\\/g, '/')).filter(laThuVienBuoc);
  if (!thuVien.length) return { thu_vien_doi: [], dien_rong: false, spec: [], ly_do: '' };

  const { theo, so_file: soSpec } = opts.dung ? { theo: opts.dung, so_file: opts.so_file || 0 } : aiDangDung();
  if (!soSpec) {
    return {
      thu_vien_doi: thuVien,
      dien_rong: true,
      spec: [],
      ly_do: `đổi ${thuVien.length} file thư viện bước, nhưng quét được 0 spec biên dịch ⇒ CHƯA BIẾT vùng ảnh hưởng`,
    };
  }

  if (thuVien.some((f) => /step_catalog\.json$|step_phrasing\.json$/.test(f))) {
    const spec = [...new Set([...theo.values()].flat().map((x) => x.file))];
    return { thu_vien_doi: thuVien, dien_rong: false, spec, ly_do: `đổi danh mục/ngữ pháp bước ⇒ mọi spec biên dịch (${spec.length} file)` };
  }

  const dm = opts.danhMuc || sm.napDanhMuc();
  const idLienQuan = ((dm && dm.buoc) || []).filter((b) => thuVien.some((f) => String(b.impl || '').startsWith(f))).map((b) => b.id);
  const spec = [...new Set(idLienQuan.flatMap((id) => (theo.get(id) || []).map((x) => x.file)))];
  if (!spec.length) {
    return {
      thu_vien_doi: thuVien,
      dien_rong: true,
      spec: [],
      ly_do: `đổi ${thuVien.length} file thư viện bước mà không spec biên dịch nào gọi tới ⇒ CHƯA BIẾT vùng ảnh hưởng`,
    };
  }
  return { thu_vien_doi: thuVien, dien_rong: false, spec, ly_do: `đổi thi hành của ${idLienQuan.length} bước ⇒ ${spec.length} spec biên dịch` };
}

function main() {
  const argv = process.argv;
  const i = argv.indexOf('--id');
  const id = i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  const json = argv.includes('--json');

  if (id) {
    const { theo, so_file } = aiDangDung();
    const ds = theo.get(id) || [];
    if (json) { console.log(JSON.stringify({ id, so_spec_quet: so_file, so_case: ds.length, case: ds }, null, 2)); return; }
    console.log(`[steps-impact] \`${id}\` · quét ${so_file} spec sinh tự động · ${ds.length} case đang dùng`);
    if (!so_file) {
      console.log('');
      console.log('  Quét 0 spec sinh tự động ⇒ con số 0 ở trên KHÔNG nói "không ai dùng bước này",');
      console.log('  mà nói "chưa có spec nào được biên dịch ra". Chạy `compile:spec` trước.');
      return;
    }
    const theoFile = new Map();
    for (const x of ds) {
      if (!theoFile.has(x.file)) theoFile.set(x.file, []);
      theoFile.get(x.file).push(x);
    }
    for (const [f, xs] of theoFile) {
      console.log(`  ${xs.length} case  ${f}  (phiên bản: ${[...new Set(xs.map((x) => x.version))].join(', ')})`);
    }
    return;
  }

  const d = cuaPhienBan();
  if (d.loi) { console.error(`[steps-impact] CHƯA ĐƯỢC GÁC — ${d.loi}`); process.exit(2); }

  if (json) { console.log(JSON.stringify(d, null, 2)); process.exit(d.chan.length ? 1 : 0); }

  if (d.chua_co_o_head) {
    console.log('[steps-impact] ○ danh mục chưa có ở `HEAD` — không có bản cũ để so.');
    console.log('               Đây KHÔNG phải "không có thay đổi phá vỡ", mà là "chưa có gì để so".');
    return;
  }

  console.log(`[steps-impact] ${d.so_buoc} bước · quét ${d.so_spec_quet} spec sinh tự động · ${d.chan.length} vi phạm · ${d.canh_bao.length} cảnh báo`);

  if (d.canh_bao.length) {
    console.log('');
    console.log('~ Đổi hợp đồng VÀ đã tăng số chính (đúng luật, nêu ra để biết vùng ảnh hưởng):');
    for (const c of d.canh_bao) console.log(`  ${c.id}  [${c.doi.join(', ')}]  ${c.version}  → ${c.so_spec} case`);
  }

  if (d.chan.length) {
    console.error('');
    console.error('✗ CHẶN — đổi hợp đồng mà KHÔNG tăng số chính:');
    for (const c of d.chan) {
      console.error(`  ${c.id}  đổi [${c.doi.join(', ')}]  version ${c.version}  → ${c.so_spec} case bị ảnh hưởng`);
      for (const a of c.anh_huong) console.error(`      ${a.file}  ${a.tcId}  (đang gọi @${a.version})`);
      if (c.so_spec > c.anh_huong.length) console.error(`      … +${c.so_spec - c.anh_huong.length} case nữa`);
    }
    console.error('');
    console.error('  Đổi `params`/`pre`/`post`/`impl` là đổi chữ ký mà spec đang gọi. Không tăng số chính thì');
    console.error('  cái sai hiện ra trong một lượt chạy UAT, dưới dạng một case FAIL trông như lỗi sản phẩm.');
    process.exit(1);
  }

  console.log('');
  console.log('✓ Không bước nào đổi hợp đồng mà quên tăng số chính.');
  if (!d.so_spec_quet) {
    console.log('  (quét 0 spec sinh tự động — phần CHẶN vẫn đúng vì nó so danh mục, nhưng cột "case bị');
    console.log('   ảnh hưởng" sẽ là 0 cho mọi bước cho tới khi `compile:spec` chạy.)');
  }
}

if (require.main === module) main();

module.exports = {
  cuaPhienBan, aiDangDung, danhMucOHead, soChinh, vungAnhHuongTuFileDoi, laThuVienBuoc,
  KHOA_HOP_DONG, RE_BUOC_DA_DUNG,
};
