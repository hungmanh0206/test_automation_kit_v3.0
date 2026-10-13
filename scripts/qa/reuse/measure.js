#!/usr/bin/env node
'use strict';
/*
 * reuse:measure — ĐO NĂM MỤC TIÊU CỦA §G, VÀ NÓI RÕ MỤC NÀO CHƯA ĐO ĐƯỢC (v2.8.0 §G).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO SCRIPT NÀY CÓ MỘT CỘT "CHƯA ĐO ĐƯỢC", và vì sao cột đó quan trọng ngang cột số.
 *
 * §G đặt năm mục tiêu. Ba trong số đó đo được từ artifact trên đĩa; hai cái còn lại thì không, và lý do
 * không phải là lười:
 *
 *   - "token −50%" cần một MỐC của đường cũ. Mốc duy nhất đang có (`docs/token-diet/baseline.dynamic.
 *     json`) là token theo PHIÊN làm việc, không phải theo một lượt "sinh automation cho một module".
 *     Lấy số phiên chia cho số module là bịa ra một mẫu số.
 *   - "mutation_check không giảm" cần `mutation_check.js` chạy THẬT: nó mở chromium, bóp méo response ở
 *     tầng `page.route()` trên UAT. Không có đường chạy offline, và CLAUDE.md §2 đòi xác nhận trước mỗi
 *     lượt chạm UAT.
 *
 * Báo một con số bịa cho hai mục đó thì cả bảng mất giá trị — người đọc không phân biệt được ba con số
 * thật với hai con số đắp vào. Nên chúng được in ở cột riêng, kèm ĐIỀU KIỆN để đo được.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/reuse/measure.js [--md <file,file,...>] [--json]
 * Exit: 0 · 2 khi không có bộ case nào để đo (CHƯA ĐO ĐƯỢC, không phải "đạt")
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));

const FIXTURE_CHUAN = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');

/** Mục tiêu §G. Đổi số ở ĐÂY, không rải ra nhiều chỗ. */
const MUC_TIEU = {
  dung_lai_cung_module: 0.70,
  dung_lai_khac_module: 0.50,
  token_giam: 0.50,
  bug_gai_bat_duoc: 1.0,
};

/* ────────────────────────── GOM MỆNH ĐỀ THEO BỘ CASE ────────────────────────── */

/** Mọi bộ case canonical tìm thấy trên đĩa, mỗi bộ một "module". */
function cacBoCase(duongChiDinh) {
  if (duongChiDinh) {
    return duongChiDinh.split(',').map((p) => p.trim()).filter(Boolean).map((p) => ({
      ten: path.basename(p, '.md'),
      duong: path.isAbsolute(p) ? p : path.join(REPO, p),
    })).filter((x) => fs.existsSync(x.duong));
  }
  const ra = [];
  const outputs = path.join(REPO, 'outputs');
  if (!fs.existsSync(outputs)) return ra;
  for (const da of fs.readdirSync(outputs, { withFileTypes: true })) {
    if (!da.isDirectory()) continue;
    const tasks = path.join(outputs, da.name, 'tasks');
    if (!fs.existsSync(tasks)) continue;
    for (const t of fs.readdirSync(tasks, { withFileTypes: true })) {
      if (!t.isDirectory()) continue;
      const tc = path.join(tasks, t.name, 'test-cases');
      if (!fs.existsSync(tc)) continue;
      for (const f of fs.readdirSync(tc).filter((x) => x.endsWith('.md'))) {
        ra.push({ ten: t.name, duong: path.join(tc, f) });
      }
    }
  }
  return ra;
}

/** Khung chuẩn hoá của mọi mệnh đề trong một bộ case. */
function khungCuaBo(duong, nguPhap) {
  const cases = sm.docCase(duong, null);
  const khung = [];
  for (const t of cases) {
    const cacCau = Array.isArray(t.steps) && t.steps.length ? t.steps.map((s) => s.text) : sm.tachCacBuoc(t.stepsRaw);
    for (const cau of cacCau) {
      for (const md of sm.tachMenhDe(cau, nguPhap.ngat)) khung.push(sm.chuanHoaCau(md, nguPhap).so);
    }
  }
  return { so_case: cases.length, khung };
}

/**
 * Mô phỏng "làm task thứ N khi đã có N-1 task kia".
 *
 * Đây là phép đo ĐÚNG NGHĨA của "tỉ lệ dùng lại", và nó khác hẳn phép đo dễ hơn là "bao nhiêu mệnh đề
 * lặp lại trong CÙNG một bộ". Lặp trong cùng bộ không chứng minh gì về việc dùng lại ở task sau — nó chỉ
 * nói case trong một task hay giống nhau.
 */
function dungLaiCheoBo(bo, nguPhap) {
  const khungTheoBo = bo.map((b) => ({ ...b, ...khungCuaBo(b.duong, nguPhap) }));
  const ra = [];
  for (const dich of khungTheoBo) {
    const kho = new Set();
    for (const khac of khungTheoBo) {
      if (khac.duong === dich.duong) continue;
      for (const k of khac.khung) kho.add(k);
    }
    const co = dich.khung.filter((k) => kho.has(k)).length;
    ra.push({
      bo: dich.ten,
      file: path.relative(REPO, dich.duong).replace(/\\/g, '/'),
      so_case: dich.so_case,
      mau_so: dich.khung.length,
      co_san: co,
      ti_le: dich.khung.length ? Number((co / dich.khung.length).toFixed(3)) : null,
      kho_khung: kho.size,
    });
  }
  return ra;
}

/** Khớp một bộ case vào DANH MỤC — đây là "dùng lại" theo nghĩa thư viện, không theo nghĩa case giống case. */
function khopVaoDanhMuc(duong) {
  const d = sm.dungDo({ taskKey: path.basename(duong), taskOutputDir: null, nguong: sm.NGUONG_MAC_DINH, duongMd: duong });
  if (d.loi) return { loi: d.loi };
  return {
    so_case: d.so_case,
    mau_so: d.so_menh_de,
    exact: d.exact,
    fuzzy: d.fuzzy,
    none: d.none,
    ti_le_exact: d.so_menh_de ? Number((d.exact / d.so_menh_de).toFixed(3)) : null,
  };
}

function dungDo({ duongChiDinh } = {}) {
  const nguPhap = sm.napNguPhap();
  const bo = cacBoCase(duongChiDinh);
  if (!bo.length) return { loi: 'khong-co-bo-case' };

  const cheoBo = dungLaiCheoBo(bo, nguPhap);
  const vaoDanhMuc = bo.map((b) => ({ bo: b.ten, file: path.relative(REPO, b.duong).replace(/\\/g, '/'), ...khopVaoDanhMuc(b.duong) }));

  /* Bộ case viết ĐÚNG CHUẨN §K — đo cạnh bộ viết tự do thì mới thấy đòn bẩy nằm ở đâu. */
  const chuan = fs.existsSync(FIXTURE_CHUAN) ? khopVaoDanhMuc(FIXTURE_CHUAN) : { loi: 'khong-co-fixture-chuan' };

  /*
   * PROXY cho "token −50%", và nó được gọi thẳng là PROXY.
   *
   * Không đo được token thật (xem khối chú thích đầu file). Đo được: tỉ lệ mệnh đề PHẢI nhờ model.
   * Đường cũ: agent viết mọi mệnh đề ⇒ 100%. Đường mới: chỉ `fuzzy` + `none`. Đây là một phép đo về
   * KHỐI LƯỢNG VIỆC, không phải về token — hai thứ tương quan nhưng không bằng nhau, và gọi nhầm tên
   * là cách một con số đúng bị dùng để chứng minh một điều nó không nói.
   */
  const tongMenhDe = vaoDanhMuc.reduce((s, x) => s + (x.mau_so || 0), 0);
  const tongCanModel = vaoDanhMuc.reduce((s, x) => s + (x.fuzzy || 0) + (x.none || 0), 0);

  const danhMuc = sm.napDanhMuc();
  return {
    so_bo: bo.length,
    so_muc_danh_muc: danhMuc ? danhMuc.buoc.length : 0,
    thieu_ngu_phap: nguPhap.thieu,
    dung_lai_cheo_bo: cheoBo,
    khop_vao_danh_muc: vaoDanhMuc,
    bo_viet_dung_chuan: chuan,
    proxy_khoi_luong_viec: {
      mau_so: tongMenhDe,
      can_model: tongCanModel,
      ti_le_giam: tongMenhDe ? Number((1 - tongCanModel / tongMenhDe).toFixed(3)) : null,
      _la_proxy: 'Đây là tỉ lệ MỆNH ĐỀ không phải nhờ model, KHÔNG phải tỉ lệ token tiết kiệm.',
    },
    chua_do_duoc: [
      {
        muc_tieu: 'token −50% khi sinh/sửa automation một task cùng module',
        vi_sao: 'mốc duy nhất đang có (`docs/token-diet/baseline.dynamic.json`) là token theo PHIÊN làm việc, '
          + 'không phải theo một lượt "sinh automation cho một module". Chia số phiên cho số module là bịa mẫu số.',
        de_do_duoc: 'cần một lượt đo có mốc: ghi token của MỘT lượt sinh automation đường cũ, rồi lặp lại đường mới '
          + 'trên cùng module. Chưa có lượt nào như thế.',
      },
      {
        muc_tieu: '5 bug gài → bắt 5/5',
        vi_sao: 'spec biên dịch hiện tại gần như không có lời gọi bộ kiểm nào — mọi dòng kỳ vọng đều rơi vào '
          + '`TODO-ORACLE` (xem `replay:check`). Một bộ spec không phán gì thì không bắt được bug nào, và con số '
          + '0/5 đó nói về tình trạng thư viện, không nói về năng lực của thiết kế.',
        de_do_duoc: 'cần L1 (mô hình màn) + L2 (bước nghiệp vụ) để `compile:spec` sinh được lời gọi `_checks/`. '
          + 'Đó là §A0 `lib:buildout`.',
      },
      {
        muc_tieu: '`mutation_check` không giảm',
        vi_sao: '`scripts/qa/mutation_check.js` mở chromium và bóp méo response ở tầng `page.route()` trên UAT. '
          + 'Không có đường chạy offline, và CLAUDE.md §2 đòi xác nhận trước mỗi lượt chạm UAT.',
        de_do_duoc: 'chạy `npm run mutation:check` trước và sau §A0, trên cùng catalog, sau khi QA duyệt lượt chạm UAT.',
      },
    ],
  };
}

function pc(x) { return x === null || x === undefined ? 'n/a' : `${Math.round(x * 100)}%`; }

function main() {
  const argv = process.argv;
  const i = argv.indexOf('--md');
  const duongChiDinh = i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  const d = dungDo({ duongChiDinh });

  if (d.loi === 'khong-co-bo-case') {
    console.error('[reuse-measure] CHƯA ĐO ĐƯỢC — không tìm thấy bộ case canonical nào.');
    console.error('                Đây KHÔNG phải "chưa đạt mục tiêu", mà là "không có gì để đo".');
    process.exit(2);
  }

  if (argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); return; }

  console.log(`[reuse-measure] ${d.so_bo} bộ case canonical`);
  if (d.thieu_ngu_phap) console.log('⚠ thiếu `.agent/config/step_phrasing.json` ⇒ mọi tỉ lệ dưới đây THẤP HƠN thật.');

  console.log('');
  console.log('── §G.1 · DÙNG LẠI CHÉO BỘ: làm bộ này khi đã có mọi bộ khác ──');
  console.log('   case   mẫu số   có sẵn   tỉ lệ   bộ');
  for (const x of d.dung_lai_cheo_bo) {
    console.log(`  ${String(x.so_case).padStart(5)}  ${String(x.mau_so).padStart(6)}  ${String(x.co_san).padStart(7)}  ${pc(x.ti_le).padStart(6)}   ${x.bo}`);
  }
  const tb = d.dung_lai_cheo_bo.filter((x) => x.ti_le !== null);
  if (tb.length) {
    const tong = tb.reduce((s, x) => s + x.mau_so, 0);
    const co = tb.reduce((s, x) => s + x.co_san, 0);
    const chung = co / tong;
    console.log(`  ${'—'.repeat(5)}  ${'—'.repeat(6)}  ${'—'.repeat(7)}  ${'—'.repeat(6)}`);
    console.log(`  ${String(tb.reduce((s, x) => s + x.so_case, 0)).padStart(5)}  ${String(tong).padStart(6)}  ${String(co).padStart(7)}  ${pc(chung).padStart(6)}   CHUNG`);
    console.log('');
    console.log(`  Mục tiêu §G: ≥${pc(MUC_TIEU.dung_lai_cung_module)} cùng module · ≥${pc(MUC_TIEU.dung_lai_khac_module)} khác module.`);
    console.log(`  ${chung >= MUC_TIEU.dung_lai_khac_module ? '✓' : '✗'} Khác module: ${pc(chung)} so với mục ≥${pc(MUC_TIEU.dung_lai_khac_module)}.`);
    console.log('  (Mọi bộ ở đây là module KHÁC nhau. "Cùng module" cần hai task trên cùng màn — chưa có cặp nào.)');
  }

  console.log('');
  console.log('── §G.2 · KHỚP VÀO DANH MỤC BƯỚC ──');
  console.log('   case   mẫu số    exact   fuzzy    none   bộ');
  for (const x of d.khop_vao_danh_muc) {
    if (x.loi) { console.log(`  (lỗi: ${x.loi})  ${x.bo}`); continue; }
    console.log(`  ${String(x.so_case).padStart(5)}  ${String(x.mau_so).padStart(6)}  ${String(x.exact).padStart(7)}  ${String(x.fuzzy).padStart(6)}  ${String(x.none).padStart(6)}   ${x.bo}`);
  }
  if (!d.bo_viet_dung_chuan.loi) {
    const c = d.bo_viet_dung_chuan;
    console.log('');
    console.log(`  Bộ viết ĐÚNG CHUẨN §K (fixture): ${c.exact}/${c.mau_so} exact = ${pc(c.ti_le_exact)}`);
    console.log('  Hai con số này phải đọc CẠNH NHAU: cùng bộ khớp, cùng danh mục, khác cách viết câu.');
    console.log('  Chênh lệch giữa chúng là phần §K mua được, và nó KHÔNG mua được bằng bộ khớp tốt hơn.');
  }

  const p = d.proxy_khoi_luong_viec;
  console.log('');
  console.log('── §G.3 · PROXY cho "token −50%" ──');
  console.log(`  ${p.mau_so - p.can_model}/${p.mau_so} mệnh đề KHÔNG phải nhờ model = ${pc(p.ti_le_giam)}`);
  console.log(`  ${p._la_proxy}`);
  console.log('');
  console.log(`  MẪU SỐ CỦA MẪU SỐ: danh mục đang có ${d.so_muc_danh_muc} mục, và cả ${d.so_muc_danh_muc} đều là`);
  console.log('  bước tầng widget (combobox). Con số trên bị chặn bởi ĐỘ PHỦ DANH MỤC, không bởi thiết kế —');
  console.log('  đọc nó thành "cách làm này chỉ tiết kiệm được 1%" là đọc sai. Nó nói: thư viện mới có 6 mục.');

  console.log('');
  console.log('── CHƯA ĐO ĐƯỢC ──');
  for (const x of d.chua_do_duoc) {
    console.log(`  ✗ ${x.muc_tieu}`);
    console.log(`      vì sao: ${x.vi_sao}`);
    console.log(`      để đo được: ${x.de_do_duoc}`);
  }
  console.log('');
  console.log('Ba mục trên KHÔNG được đọc thành "đã đạt" hay "không đạt" — chúng chưa có phép đo nào.');
}

if (require.main === module) main();

module.exports = { dungDo, dungLaiCheoBo, khopVaoDanhMuc, khungCuaBo, cacBoCase, MUC_TIEU };
