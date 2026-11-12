#!/usr/bin/env node
'use strict';
/*
 * stt:map — SUY BẢN ĐỒ `Stt đặc tả → nhãn của từng cấp`, và TỪ CHỐI GHI KHI CÒN NHẬP NHẰNG (v2.8.0 §A0).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO MỤC NÀY LÀ NÚT THẮT, có số đo.
 *
 * Đo trên 1.079 mệnh đề của TASK-9001: **330 mệnh đề (31%)** trỏ field bằng `Stt #` chứ không bằng nhãn
 * — `tải lại màn và đọc lại Stt #` 56 lượt, `Stt # = #` 19 lượt. Không có bản đồ này thì L1 không tra
 * được, và 31% câu bước của module rơi vào `none` bất kể danh mục có bao nhiêu bước.
 *
 * VÌ SAO KHÔNG SUY THEO THỨ TỰ. Đặc tả có 120 dòng Stt cho CẢ 5 CẤP; màn THCS chỉ hiển thị 89 nhãn. Khớp
 * theo vị trí lệch ngay từ dòng đầu không áp dụng cho cấp đó. Catalog cũng tự ghi con số chứng minh:
 * `screenIdx` (số `[N]` app in ra) khớp Stt đặc tả **10/89**.
 *
 * CÁCH SUY, và nó dựa trên dữ liệu ĐÃ CÓ chứ không trên một lượt đo mới: đặc tả viết nhãn GHÉP cho 5 cấp
 * (`Tên trường / Cơ sở GDMN / Tên trung tâm`), còn `expectedFields` của từng màn đã là nhãn ĐƠN của cấp
 * đó — việc tách nhánh nào cho cấp nào đã chốt từ trước bằng số đo (`_label_split_chot` của catalog).
 * Nên chỉ cần đối chiếu: nhánh nào của nhãn ghép có trong `expectedFields` của màn thì Stt đó trỏ vào đó.
 *
 * THỬ NGUYÊN NHÃN TRƯỚC, RỒI MỚI TÁCH NHÁNH. Bản đầu tách ngay ở dấu `/` và làm vỡ đúng những nhãn CÓ
 * CHỨA dấu `/`: `Phường/Xã`, `Khu công nghiệp/Khu chế xuất`. Chúng thành `Phường` + `Xã`, không nhánh nào
 * khớp, và Stt 16 mất bản đồ ở cả 5 cấp.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * LUẬT: nhãn ghép khớp NHIỀU HƠN MỘT `expectedField` ⇒ KHÔNG ghi mục đó, và báo ra. Một bản đồ đoán làm
 * case ghi vào SAI Ô, và kết quả là một FAIL trông như lỗi sản phẩm.
 *
 * Dùng: node scripts/qa/reuse/stt_map.js --spec <file.md> --catalog <ui_catalog.json> [--ghi] [--json]
 * Exit: 0 · 1 khi `--ghi` mà còn nhập nhằng · 2 khi không đọc được đầu vào
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');

/** Chuẩn hoá để SO. Bản gốc luôn được giữ để ghi vào bản đồ. */
function chuan(s) {
  return String(s || '')
    .normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Đọc bảng `| Stt | Nhãn | …` từ đặc tả Markdown.
 *
 * Nhận cả Stt dạng `6a` — đặc tả dùng nó cho dòng chèn thêm, và bỏ sót dạng đó là bỏ sót đúng những
 * field được thêm sau.
 */
function docBangStt(duongMd) {
  const ra = [];
  for (const l of fs.readFileSync(duongMd, 'utf8').split(/\r?\n/)) {
    const m = /^\|\s*(\d+[a-z]?)\s*\|\s*([^|]+?)\s*\|/.exec(l);
    if (m) ra.push({ stt: m[1], nhan_ghep: m[2].trim() });
  }
  return ra;
}

/** Mọi nhãn expected của một màn, kèm bản chuẩn hoá để so. */
function nhanCuaMan(screen) {
  const ra = [];
  for (const g of screen.fields || []) for (const e of g.expectedFields || []) ra.push(e);
  return ra;
}

/**
 * Suy bản đồ cho MỘT màn. Trả `{ ban_do, nhap_nhang, stt_khong_khop, nhan_khong_ai_tro_toi }`.
 */
function suyChoMan(screen, bang) {
  const nhan = nhanCuaMan(screen);
  const theoChuan = new Map();
  for (const e of nhan) {
    const c = chuan(e);
    /* Nhãn TRÙNG trong cùng màn: giữ cái đầu, và đếm — ghi đè im lặng là cách một neo đúng bị thay. */
    if (!theoChuan.has(c)) theoChuan.set(c, e);
  }

  const banDo = {};
  const nhapNhang = [];
  const khongKhop = [];

  for (const r of bang) {
    /* 1. Thử NGUYÊN nhãn — vá đúng ca nhãn có chứa dấu `/`. */
    const nguyen = chuan(r.nhan_ghep);
    if (theoChuan.has(nguyen)) { banDo[r.stt] = theoChuan.get(nguyen); continue; }

    /* 2. Rồi mới tách nhánh ở dấu `/`. */
    const nhanh = r.nhan_ghep.split('/').map((x) => x.trim()).filter(Boolean);
    const trung = [...new Set(nhanh.map(chuan).filter((c) => theoChuan.has(c)))];
    if (trung.length === 1) { banDo[r.stt] = theoChuan.get(trung[0]); continue; }
    if (trung.length > 1) {
      nhapNhang.push({ stt: r.stt, nhan_ghep: r.nhan_ghep, ung_vien: trung.map((c) => theoChuan.get(c)) });
      continue;
    }
    khongKhop.push({ stt: r.stt, nhan_ghep: r.nhan_ghep });
  }

  const daTro = new Set(Object.values(banDo).map(chuan));
  return {
    man: screen.name,
    so_expected: nhan.length,
    ban_do: banDo,
    so_khop: Object.keys(banDo).length,
    nhap_nhang: nhapNhang,
    stt_khong_khop: khongKhop,
    nhan_khong_ai_tro_toi: nhan.filter((e) => !daTro.has(chuan(e))),
  };
}

function suy({ duongSpec, duongCatalog }) {
  let bang;
  let cat;
  try { bang = docBangStt(duongSpec); } catch (e) { return { loi: `không đọc được đặc tả: ${e.message}` }; }
  try { cat = JSON.parse(fs.readFileSync(duongCatalog, 'utf8')); } catch (e) { return { loi: `không đọc được catalog: ${e.message}` }; }
  if (!bang.length) return { loi: `đặc tả ${path.basename(duongSpec)} không có dòng nào dạng \`| Stt | Nhãn |\`` };

  return { so_dong_spec: bang.length, man: (cat.screens || []).map((s) => suyChoMan(s, bang)), _cat: cat };
}

function ghiVaoCatalog(duongCatalog, kq) {
  const cat = kq._cat;
  let soGhi = 0;
  for (const s of cat.screens || []) {
    const m = kq.man.find((x) => x.man === s.name);
    if (!m) continue;
    /*
     * CHỈ ghi khi màn đó KHÔNG CÒN nhập nhằng. Ghi một phần và bỏ qua phần nhập nhằng cũng được, nhưng
     * lúc đó bản đồ trông đầy đủ trong khi nó có lỗ — và `oTheoStt` sẽ ném "không có Stt N" thay vì nói
     * "Stt N còn nhập nhằng", tức thông điệp lạc hướng.
     */
    if (m.nhap_nhang.length) continue;
    s.stt_nhan = m.ban_do;
    soGhi += 1;
  }
  cat._stt_nhan = `SINH bởi \`stt:map\` ngày ${new Date().toISOString().slice(0, 10)}. Suy từ bảng Stt của đặc tả `
    + 'đối chiếu `expectedFields` của từng màn — KHÔNG suy theo thứ tự (đặc tả 120 dòng cho cả 5 cấp, mỗi màn ít nhãn hơn). '
    + 'Mục nào nhãn ghép khớp nhiều hơn một expectedField thì KHÔNG ghi, và `stt:map` báo ra.';
  fs.writeFileSync(duongCatalog, `${JSON.stringify(cat, null, 2)}\n`, 'utf8');
  return soGhi;
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const spec = val('spec');
  const catalog = val('catalog');
  if (!spec || !catalog) {
    console.error('[stt-map] CHƯA ĐO ĐƯỢC — cần `--spec <file.md>` và `--catalog <ui_catalog.json>`.');
    process.exit(2);
  }
  const duongSpec = path.resolve(REPO, spec);
  const duongCatalog = path.resolve(REPO, catalog);

  const kq = suy({ duongSpec, duongCatalog });
  if (kq.loi) { console.error(`[stt-map] CHƯA ĐO ĐƯỢC — ${kq.loi}`); process.exit(2); }

  if (argv.includes('--json')) {
    const { _cat, ...sach } = kq;
    console.log(JSON.stringify(sach, null, 2));
    return;
  }

  console.log(`[stt-map] đặc tả ${kq.so_dong_spec} dòng Stt · ${kq.man.length} màn`);
  console.log('');
  console.log('  khớp  expected  nhập nhằng  Stt không khớp  nhãn không ai trỏ tới  màn');
  let tongNhapNhang = 0;
  for (const m of kq.man) {
    tongNhapNhang += m.nhap_nhang.length;
    console.log(`  ${String(m.so_khop).padStart(4)}  ${String(m.so_expected).padStart(8)}  ${String(m.nhap_nhang.length).padStart(10)}  ${String(m.stt_khong_khop.length).padStart(14)}  ${String(m.nhan_khong_ai_tro_toi.length).padStart(21)}  ${m.man}`);
  }

  for (const m of kq.man) {
    if (!m.nhap_nhang.length) continue;
    console.log('');
    console.log(`✗ ${m.man} — ${m.nhap_nhang.length} Stt NHẬP NHẰNG, KHÔNG ghi mục nào của chúng:`);
    for (const x of m.nhap_nhang.slice(0, 8)) console.log(`    Stt ${x.stt}  "${x.nhan_ghep}"  →  ${x.ung_vien.map((v) => `"${v}"`).join(' | ')}`);
  }

  for (const m of kq.man) {
    if (!m.nhan_khong_ai_tro_toi.length) continue;
    console.log('');
    console.log(`~ ${m.man} — ${m.nhan_khong_ai_tro_toi.length} nhãn expected KHÔNG Stt nào trỏ tới:`);
    for (const x of m.nhan_khong_ai_tro_toi.slice(0, 6)) console.log(`    "${x}"`);
    console.log('  Case gọi field đó bằng nhãn thì vẫn chạy; gọi bằng Stt thì không tra được.');
  }

  console.log('');
  console.log('`Stt không khớp` là chuyện BÌNH THƯỜNG: đặc tả gộp 120 dòng của cả 5 cấp, và một cấp chỉ');
  console.log('hiển thị phần của nó. Con số đáng lo là cột `nhập nhằng`.');

  if (argv.includes('--ghi')) {
    if (tongNhapNhang) {
      console.error('');
      console.error(`✗ Còn ${tongNhapNhang} Stt nhập nhằng — vẫn ghi phần sạch, nhưng các màn có nhập nhằng bị BỎ QUA hoàn toàn.`);
    }
    const soGhi = ghiVaoCatalog(duongCatalog, kq);
    console.log('');
    console.log(`✓ Đã ghi \`stt_nhan\` cho ${soGhi}/${kq.man.length} màn vào ${path.relative(REPO, duongCatalog)}`);
    if (tongNhapNhang) process.exit(1);
  } else {
    console.log('');
    console.log('(chưa ghi — thêm `--ghi` để ghi `stt_nhan` vào catalog)');
  }
}

if (require.main === module) main();

module.exports = { suy, suyChoMan, docBangStt, nhanCuaMan, ghiVaoCatalog, chuan };
