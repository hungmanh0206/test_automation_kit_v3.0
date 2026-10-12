#!/usr/bin/env node
'use strict';
/*
 * gate_code_pair — MỖI MÃ GATE PHẢI CÓ MỘT CẶP BẨN/SẠCH, VÀ PHẢI ĐỊNH TUYẾN ĐÚNG (v2.7.0 §A10.3).
 *
 * VÌ SAO CẦN, và nó khác điều §A10.3 giả định. Prompt viết mục này như thể mỗi gate tự gọi tên mã của
 * mình. Đo thực tế thì không: mã gate KHÔNG do gate gọi tên — `gate_engine.maCua()` khớp regex `khop`
 * trong `gate_codes.json` lên CÂU THÔNG BÁO. Hệ quả là một lớp lỗi mà trước đây không máy nào gác:
 *
 *   · hai mã cùng khớp một câu ⇒ mã nào thắng tuỳ THỨ TỰ KHAI. Đo 12/10/2026 trên 7.939 chuỗi literal
 *     trong `scripts/**.js`: 18 chuỗi khớp hai mã hoặc hơn, trong đó có cặp HAI MÃ T0
 *     (`FAIL_CHUA_PHAN_TANG` + `RERUN_THIEU`). Người sửa đọc `vì sao`/`sửa` của mã khác.
 *   · nới một `khop` để bắt thêm câu ⇒ có thể giành mất câu của mã khác, và không gì báo.
 *
 * Nên máy này khoá ĐƯỜNG ĐỊNH TUYẾN: mỗi mã khai một câu THẬT mà gate phát ra, và `maCua(câu)` phải trả
 * về đúng mã đó. Sửa regex làm lệch một mã ⇒ CHẶN ngay, không chờ ai phát hiện trên báo cáo.
 *
 * VÀ NÓ ĐO MỘT SỐ KHÔNG ĐẸP, cố ý. Phần thứ hai đếm xem có bao nhiêu mã được một spec đòi gate PHÁT RA
 * đúng mã đó. Lượt đầu: 2/21. Con số đó là sự thật của §A10.3 — spec hiện kiểm gate ĐỎ hay XANH, không
 * kiểm mã đính kèm, nên một gate phát sai mã vẫn xanh hết. Số này được ĐO mỗi lượt, không khai tay, để
 * nó không bao giờ cũ.
 *
 * CẢNH BÁO VỀ CHÍNH PHÉP ĐO ĐÓ, và nó quan trọng hơn con số. Máy đo "có spec nào NHẮC câu này", không đo
 * "có spec nào DRIVE gate phát ra câu này" — cái sau cần chạy gate thật, cái trước chỉ cần tìm chuỗi. Nên
 * nó là ĐẠI LƯỢNG THAY THẾ, và nó gian lận được: viết một spec liệt kê cả 21 `mau_ban` thì số nhảy lên
 * 21/21 mà không thêm một phép đo nào. Ai chạm vào phần này phải biết: con số chỉ có nghĩa khi spec được
 * đếm là spec DỰNG đầu vào bẩn rồi đọc mã từ kết quả gate. Vì vậy `gate-code-pair.spec.ts` cố ý KHÔNG nhúng
 * câu mẫu nào — nó đọc registry — để chính nó không làm số liệu đẹp lên.
 *
 * Dùng:
 *   node scripts/qa/gate_code_pair.js [--enforce] [--json]
 *
 * Exit: 0 · 1 khi `--enforce` và có vi phạm CHẶN · 2 khi không đọc được nguồn
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const engine = require(path.join(__dirname, 'lib', 'gate_engine'));

const ENFORCE = process.argv.includes('--enforce');
const JSON_OUT = process.argv.includes('--json');
const TOI_THIEU_MAU = 30;

function doc(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    console.error(`[code-pair] ✗ không đọc được ${path.relative(REPO, p)}: ${e.message}`);
    process.exit(2);
    return null;
  }
}

/**
 * MẢNH ĐẶC TRƯNG của một câu: bỏ TC ID và số, rồi lấy các cụm chữ dài nhất.
 *
 * Bỏ số vì câu thật mang `3/7 step` còn spec thường đo một bộ khác, nên so cả số thì không bao giờ khớp.
 * Ngưỡng 18 ký tự để một cụm còn đủ đặc trưng: `thiếu cột` khớp nhầm khắp nơi, `Bảng testcase THIẾU cột`
 * thì không.
 */
function manh(s) {
  const sach = String(s).replace(/[A-Z][A-Z0-9_]*_TC_\d+/g, '').replace(/\d+/g, '');
  return sach.split(/[:·—(){}[\]"`]|\s{2,}/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 18)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
}

function docSpecs() {
  const d = path.join(REPO, 'tests', 'fe', 'infra');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.spec.ts'))
    .map((f) => ({ ten: `tests/fe/infra/${f}`, txt: fs.readFileSync(path.join(d, f), 'utf8') }));
}

function dungDo() {
  const codes = doc(path.join(REPO, '.agent', 'config', 'gate_codes.json'));
  const pol = doc(path.join(REPO, '.agent', 'config', 'gate_code_pairs.json'));
  const ds = (Array.isArray(codes) ? codes : codes.codes).filter((x) => x.tang === 'T0' || x.tang === 'T1');
  const bang = new Map((pol.ma || []).map((m) => [m.code, m]));
  const specs = docSpecs();

  const chan = [];
  const nhapNhang = [];
  const coSpec = [];
  const khongSpec = [];

  for (const c of ds) {
    const m = bang.get(c.code);
    if (!m) {
      chan.push(`${c.tang} ${c.code}: KHÔNG có cặp trong gate_code_pairs.json — không ai chứng minh gate phát ra mã này`);
      continue;
    }
    if (!m.mau_ban || String(m.mau_ban).length < TOI_THIEU_MAU) {
      chan.push(`${c.tang} ${c.code}: \`mau_ban\` ngắn hơn ${TOI_THIEU_MAU} ký tự — một câu cụt không chứng minh được đường định tuyến`);
      continue;
    }
    if (m.gate && !fs.existsSync(path.join(REPO, m.gate))) {
      chan.push(`${c.tang} ${c.code}: khai gate \`${m.gate}\` mà file không tồn tại`);
    }

    const ct = engine.maCuaChiTiet(m.mau_ban);
    if (ct.ma !== c.code) {
      const uv = ct.ung_vien.map((u) => `${u.code}/${u.dai}`).join(', ');
      chan.push(`${c.tang} ${c.code}: câu mẫu bị định tuyến sang \`${ct.ma}\` (ứng viên: ${uv || 'không có'})`);
    } else if (ct.ung_vien.length > 1) {
      nhapNhang.push({ code: c.code, ung_vien: ct.ung_vien.map((u) => `${u.code}/${u.dai}`) });
    }

    const ms = manh(m.mau_ban);
    const hit = specs.filter((sp) => ms.some((x) => sp.txt.includes(x))).map((sp) => sp.ten);
    if (hit.length) coSpec.push({ code: c.code, spec: hit });
    else khongSpec.push({ code: c.code, tang: c.tang, manh: ms });
  }

  const la = [...bang.keys()].filter((k) => !ds.some((c) => c.code === k));
  for (const k of la) {
    chan.push(`\`${k}\` có cặp trong gate_code_pairs.json nhưng không có trong gate_codes.json (hoặc không phải T0/T1)`);
  }

  return {
    so_ma: ds.length,
    chan,
    nhap_nhang: nhapNhang,
    co_spec: coSpec,
    khong_spec: khongSpec,
    so_spec: specs.length,
  };
}

function main() {
  const d = dungDo();
  if (JSON_OUT) {
    console.log(JSON.stringify(d, null, 2));
    process.exit(ENFORCE && d.chan.length ? 1 : 0);
  }

  console.log(`[code-pair] ${d.so_ma} mã T0/T1 · ${d.chan.length} vi phạm CHẶN · ${d.co_spec.length}/${d.so_ma} mã có spec đòi gate phát ra đúng mã`);

  if (d.chan.length) {
    console.log('');
    console.log('✗ CHẶN:');
    for (const x of d.chan) console.log(`  ${x}`);
  }

  if (d.nhap_nhang.length) {
    console.log('');
    console.log(`○ ${d.nhap_nhang.length} mã có câu mẫu KHỚP NHIỀU MÃ — đúng mã thắng nhờ luật khớp-dài-nhất,`);
    console.log('  nhưng đó là phỏng đoán chứ không phải chứng minh. Một câu mang hai chủ đề thật thì để');
    console.log('  nguyên là đúng; một `khop` quá rộng thì phải siết lại:');
    for (const x of d.nhap_nhang) console.log(`  ${x.code.padEnd(20)} ${x.ung_vien.join(', ')}`);
  }

  if (d.khong_spec.length) {
    console.log('');
    console.log(`○ ${d.khong_spec.length}/${d.so_ma} mã KHÔNG có spec nào đòi gate phát ra đúng mã đó (đo trên ${d.so_spec} spec hạ tầng).`);
    console.log('  Đây là sự thật của §A10.3 và nó không đẹp: spec hiện kiểm gate ĐỎ hay XANH, không kiểm MÃ');
    console.log('  đính kèm, nên một gate phát SAI mã vẫn xanh hết. Đường định tuyến đã được khoá ở phần');
    console.log('  trên; phần còn thiếu là spec chạy gate thật rồi đọc mã ra.');
    for (const x of d.khong_spec) console.log(`  ${x.tang} ${x.code}`);
  }

  if (!d.chan.length) console.log('\n✓ Mọi mã T0/T1 đều có cặp và định tuyến đúng.');
  process.exit(ENFORCE && d.chan.length ? 1 : 0);
}

if (require.main === module) main();

module.exports = { manh, dungDo };
