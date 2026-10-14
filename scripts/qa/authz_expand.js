#!/usr/bin/env node
/**
 * authz_expand.js — TRỤC ⑥: liệt kê biến thể PHÂN QUYỀN quanh mỗi case.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * MÁY NÀY KHÔNG DÒ. Phần dò đã có: `scripts/qa/discovery/roles.js` (v2.6.0) bò theo vai trò, lập ma trận
 * vai-trò × route với BA MỨC BẰNG CHỨNG (`verified` / `config` / `unknown`) và luật cứng "ô `unknown`
 * KHÔNG được làm tròn thành *không có quyền*". Viết lại phần đó là tạo bản sao thứ hai của đúng thứ
 * v2.8.1 bước 1 vừa mất một commit để gom. Máy này ĐỌC ma trận đó, ghép với bộ case canonical, và trả lời
 * một câu khác: **case này còn thiếu biến thể phân quyền nào**.
 *
 * HAI TIỀN ĐỀ CỦA THIẾT KẾ ĐÃ BỊ BÁC KHI ĐO (13/10/2026) — và cách xử lý:
 *
 *   ① "sinh biến thể cho mỗi vai trò THẤP HƠN vai trò của case".
 *      Đo: toàn repo KHÔNG có chỗ nào khai thứ bậc vai trò — không config, không knowledge, không hằng
 *      số trong code. `roles.js` cố ý không suy thứ bậc, vì suy ra từ một tài khoản là bịa.
 *      ⇒ Không có `thu_bac` khai trong config thì máy này KHÔNG tự xếp hạng. Nó vẫn liệt kê biến thể cho
 *      mọi vai trò khác, nhưng để ở nhóm `doc_chua_xep_hang` và trạng thái `unknown`, kèm một câu hỏi cho
 *      Ambiguity Gate. "Chưa biết ai thấp hơn ai" KHÔNG được in ra như "đã phủ chiều dọc".
 *
 *   ② "ma trận vai trò × route (v2.6.0)" — như thể nó đang có sẵn.
 *      Đo: KHÔNG artefact nào trên đĩa chứa `role_route_matrix`. `discover.js` ghi nó, nhưng chưa task nào
 *      chạy phần đó.
 *      ⇒ Thiếu ma trận là `CHƯA ĐO`, không phải "không có vấn đề phân quyền". Báo cáo vẫn được ghi, với
 *      `proven=0` và lý do ghi thẳng vào file; `expansion_audit` đọc `proven=0` là CHẶN. Exit 2 — mã của
 *      "không phán được", khác hẳn exit 1 của "đo rồi và sai".
 *
 * RANH GIỚI AN TOÀN — phần sẽ không nới:
 *   · Máy này KHÔNG gửi request nào. Nó là máy LIỆT KÊ: đầu ra là danh sách biến thể + trạng thái.
 *   · Biến thể authz-GHI (vai trò thấp xoá/sửa/duyệt bản ghi của người khác) được liệt kê nhưng gắn
 *     `chi_chay_tay` — vì gửi một request ghi để thử 403 nghĩa là: NẾU phân quyền hỏng thì đã ghi thật
 *     vào UAT. Không có cờ nào ở đây bật nó lên.
 *   · Biến thể authz-ĐỌC chạy được tự động, nhưng qua `security_check --confirm-nonprod` + `write_firewall`,
 *     không phải qua máy này.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/authz_expand.js
 *   ... --config requirements/authz_matrix.json --matrix <roles.json> --out reports/authz-expansion.md
 *   ... --enforce      # exit 1 khi có biến thể trạng thái `fail` (leo thang quyền / ẩn-mà-không-cấm)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
const canonical = require(path.resolve(__dirname, '..', 'lib', 'testcase'));
const depth = require(path.resolve(__dirname, '..', 'lib', 'expansion', 'depth'));

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/* Trạng thái một biến thể. Dùng LẠI từ vựng của `roles.js` và `security_check`, không đặt từ mới. */
const TT = {
  pass: 'pass',                    // đã thử, bị chặn đúng như kỳ vọng
  fail: 'fail',                    // leo thang quyền, hoặc ẩn-mà-không-cấm
  unknown: 'unknown',              // CHƯA THỬ — không phải pass
  needs_account: 'needs_account',  // thiếu tài khoản vai trò đó (security_check: NEEDS_ACCOUNT)
  needs_config: 'needs_config',    // thiếu khai báo (thứ bậc / chủ sở hữu) nên chưa sinh được biến thể
  chi_chay_tay: 'chi_chay_tay',    // biến thể GHI — không tự chạy trên UAT
};
/* Chỉ hai trạng thái này là BẰNG CHỨNG. `unknown`/`needs_*`/`chi_chay_tay` đều là phép đo CHƯA xảy ra. */
const LA_BANG_CHUNG = new Set([TT.pass, TT.fail]);

/** Đọc ma trận: `--matrix`, rồi `roles.json`, rồi `system_map.json`. Không có thì trả lý do, không ném. */
function docMaTran(taskDir) {
  const ungVien = [arg('matrix'), path.join(taskDir, 'test-results', 'roles.json'),
    path.join(taskDir, 'test-results', 'system_map.json')].filter(Boolean);
  for (const p of ungVien) {
    if (!fs.existsSync(p)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { thieu: `${p} không đọc được JSON: ${e.message}` }; }
    if (Array.isArray(j.role_route_matrix) && j.role_route_matrix.length) {
      return { nguon: p, o: j.role_route_matrix, roles: j.roles || [], findings: j.expansion_findings || [] };
    }
  }
  return {
    thieu: `không tìm thấy \`role_route_matrix\` ở: ${ungVien.join(' · ')}. `
      + 'Ma trận do `npm run discover` (scripts/qa/discovery/roles.js) sinh ra và cần ÍT NHẤT HAI tài khoản.',
  };
}

/** Vai trò của case: tên vai trò nào xuất hiện trong `Tiền điều kiện`. Không khớp ⇒ `null`, không đoán. */
function vaiTroCuaCase(tc, tenVai) {
  const txt = `${tc.precondition || ''} ${tc.data || ''}`.toLowerCase();
  const trung = tenVai.filter((t) => txt.includes(String(t).toLowerCase()));
  /* Khớp nhiều tên ⇒ cũng là không xác định: lấy bừa cái đầu là chọn hộ người đọc. */
  return trung.length === 1 ? trung[0] : null;
}

function main() {
  const taskDir = rc.getTaskOutputDir();
  const tcDir = arg('tc-dir', path.join(taskDir, 'test-cases'));
  const out = arg('out', path.join(taskDir, 'reports', 'authz-expansion.md'));

  let cfg = {};
  const cfgPath = arg('config', path.join(rc.REPO_ROOT, 'requirements', 'authz_matrix.json'));
  if (fs.existsSync(cfgPath)) {
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) {
      console.error(`[authz] ✗ ${cfgPath} không đọc được JSON: ${e.message}`);
      process.exit(2);
    }
  }
  const thuBac = Array.isArray(cfg.thu_bac) ? cfg.thu_bac : null;   // [cao → thấp]
  const chuSoHuu = cfg.chu_so_huu && typeof cfg.chu_so_huu === 'object' ? cfg.chu_so_huu : null;

  /*
   * LUẬT CÓ NEO — sinh biến thể KHÔNG CẦN ma trận.
   *
   * Thiết kế v2.8.1 bắt cả ba nhóm biến thể chờ ma trận vai trò × route, tức chờ ≥2 tài khoản. Đo
   * 14/10/2026 trên `knowledge/domain` thì điều đó SAI: `BR-NHANSU-029` (đổi `id` sang đơn vị khác phải
   * bị từ chối · `isview=1→0` không được thành Sửa · URL popup chưa đăng nhập bị đẩy về Đăng nhập) và
   * `BR-HSLOP-025` (tài khoản gán một phân hiệu chỉ thấy phân hiệu đó) đều đo được bằng MỘT tài khoản.
   *
   * Chỉ nhóm DỌC cần vai trò thứ hai. Bắt cả ba nhóm chờ ma trận nghĩa là một dự án một-vai-trò không
   * bao giờ đo được phân quyền, trong khi hai luật trên là đúng chỗ bug phân quyền hay nằm.
   */
  const bienThe = [];
  const cauHoi = [];

  const luat = Array.isArray(cfg.luat) ? cfg.luat : [];
  const soVaiTroCo = 1; // vai trò đang đăng nhập; nhóm `doc` đòi ≥2 nên luôn thiếu khi chưa có ma trận
  for (const l of luat) {
    const du = Number(l.can_vai_tro || 1) <= soVaiTroCo;
    bienThe.push({
      nhom: l.nhom || 'ngang',
      vai_tro: '(vai trò đang đăng nhập)',
      route: '—',
      base_tc: `luật ${l.oracle_ref}`,
      trang_thai: du ? TT.unknown : TT.needs_account,
      oracle_ref: l.oracle_ref || null,
      vi_sao: du
        ? l.mo_ta
        : `${l.mo_ta} — cần ≥${l.can_vai_tro} vai trò, hiện có ${soVaiTroCo}`,
    });
  }

  const mt = docMaTran(taskDir);

  /* Bộ case: chỉ những case mà band của chúng ĐÒI trục `authz`. */
  const tests = [];
  for (const d of [tcDir]) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.md'))) {
      try { tests.push(...(canonical.parseMarkdown(fs.readFileSync(path.join(d, f), 'utf8')).tests || [])); } catch (e) { /* không phải bảng canonical */ }
    }
  }
  const canAuthz = tests.filter((t) => depth.axesFor(t).includes('authz'));

  if (mt.thieu) {
    cauHoi.push({
      muc: 'Critical',
      cau_hoi: 'Chạy `npm run discover` với ít nhất hai tài khoản để có ma trận vai trò × route.',
      vi_sao: `Chưa có ma trận thì KHÔNG biến thể phân quyền nào chấm được. ${mt.thieu}`,
    });
  } else {
    const tenVai = (mt.roles || []).map((r) => r.ten);
    const khongTaiKhoan = new Set((mt.roles || []).filter((r) => r.co_tai_khoan === false).map((r) => r.ten));

    /* ③ ẨN ≠ CẤM — lấy NGUYÊN finding của `roles.js`: app tự mâu thuẫn, không cần oracle ngoài. */
    for (const f of mt.findings || []) {
      bienThe.push({
        nhom: 'an_khac_cam', vai_tro: f.role || '—', route: f.route || '—', base_tc: '—',
        trang_thai: TT.fail, oracle_ref: null,
        vi_sao: f.vi_sao || 'route ẩn khỏi menu vai trò này nhưng vai trò khác thấy, mà mở thẳng URL thì VÀO ĐƯỢC',
      });
    }

    for (const tc of canAuthz) {
      const vai = vaiTroCuaCase(tc, tenVai);
      if (!vai) {
        bienThe.push({
          nhom: 'doc', vai_tro: '—', route: '—', base_tc: tc.tcId, trang_thai: TT.needs_config, oracle_ref: null,
          vi_sao: 'không đọc được vai trò của case từ `Tiền điều kiện` (không khớp tên vai trò nào, hoặc khớp nhiều hơn một)',
        });
        continue;
      }

      /* ① DỌC — chỉ xếp được hạng khi config KHAI thứ bậc. Không khai thì không tự suy. */
      const khac = tenVai.filter((t) => t !== vai);
      const thapHon = thuBac ? khac.filter((t) => thuBac.indexOf(t) > thuBac.indexOf(vai) && thuBac.indexOf(t) >= 0) : khac;
      for (const t of thapHon) {
        const oMt = (mt.o || []).filter((c) => c.role === t);
        for (const c of oMt) {
          const tt = khongTaiKhoan.has(t) ? TT.needs_account
            : (c.muc_bang_chung === 'verified' ? TT.pass : TT.unknown);
          bienThe.push({
            nhom: thuBac ? 'doc' : 'doc_chua_xep_hang', vai_tro: t, route: c.route, base_tc: tc.tcId,
            trang_thai: tt, oracle_ref: cfg.oracle_ref || null,
            vi_sao: thuBac ? null : 'config không khai `thu_bac` nên KHÔNG kết luận được đây là vai trò thấp hơn',
          });
        }
      }

      /* ② NGANG (IDOR) — cần biết trường nào định danh chủ sở hữu/đơn vị. Không khai thì không bịa. */
      bienThe.push({
        nhom: 'ngang', vai_tro: vai, route: '—', base_tc: tc.tcId,
        trang_thai: chuSoHuu ? TT.unknown : TT.needs_config, oracle_ref: cfg.oracle_ref || null,
        vi_sao: chuSoHuu ? null : 'config không khai `chu_so_huu` (trường định danh chủ sở hữu/đơn vị) nên chưa sinh được biến thể IDOR',
      });

      /* Biến thể GHI — liệt kê, KHÔNG chạy. */
      bienThe.push({
        nhom: 'ghi', vai_tro: thapHon[0] || '(vai trò thấp hơn)', route: '—', base_tc: tc.tcId,
        trang_thai: TT.chi_chay_tay, oracle_ref: null,
        vi_sao: 'authz-GHI không tự chạy trên UAT: gửi request ghi để thử 403 nghĩa là NẾU phân quyền hỏng thì đã ghi thật',
      });
    }

    if (!thuBac) {
      cauHoi.push({
        muc: 'Critical',
        cau_hoi: `Khai \`thu_bac\` (vai trò từ CAO xuống THẤP) trong \`${path.relative(rc.REPO_ROOT, cfgPath)}\`.`,
        vi_sao: 'Không có thứ bậc thì "vai trò thấp hơn" là thứ không máy nào tính được, và chiều dọc chưa phủ.',
      });
    }
    if (!chuSoHuu) {
      cauHoi.push({
        muc: 'Major',
        cau_hoi: `Khai \`chu_so_huu\` (trường định danh chủ sở hữu/đơn vị của bản ghi) trong \`${path.relative(rc.REPO_ROOT, cfgPath)}\`.`,
        vi_sao: 'Thiếu nó thì biến thể IDOR (cùng vai trò, chủ khác) không sinh được.',
      });
    }
    for (const t of khongTaiKhoan) {
      cauHoi.push({
        muc: 'Critical',
        cau_hoi: `Xin tài khoản vai trò \`${t}\` để kiểm chứng biến thể phân quyền.`,
        vi_sao: '`needs_account` KHÔNG phải FAIL và cũng KHÔNG phải PASS — phép đo chưa xảy ra.',
      });
    }
  }

  const dem = {};
  for (const b of bienThe) dem[b.trang_thai] = (dem[b.trang_thai] || 0) + 1;
  const proven = bienThe.filter((b) => LA_BANG_CHUNG.has(b.trang_thai)).length;
  const inconclusive = bienThe.length - proven;
  const doViPham = bienThe.filter((b) => b.trang_thai === TT.fail).length;

  const L = [
    `<!-- gate: proven=${proven} inconclusive=${inconclusive} broken=0 -->`,
    '# Mở rộng ⑥ — phân quyền quanh case', '',
    '> Sinh bởi `scripts/qa/authz_expand.js`. Máy này **liệt kê**, không gửi request nào.',
    '> `unknown` nghĩa là CHƯA THỬ — không được đọc thành "đã chặn đúng". `needs_account`/`needs_config`',
    '> nghĩa là phép đo chưa xảy ra. Chỉ `pass`/`fail` mới là bằng chứng.', '',
  ];
  if (mt.thieu) {
    /*
     * Thiếu ma trận chỉ chặn nhóm DỌC. Bản đầu của báo cáo ẩn luôn cả bảng biến thể, nên 5 biến thể sinh
     * từ luật có neo không hiện ra — tức việc làm được lại trông như không làm được gì.
     */
    L.push('## Nhóm DỌC: CHƯA ĐO ĐƯỢC', '',
      `- ${mt.thieu}`, '',
      'Chỉ nhóm **dọc** (vai trò thấp hơn) cần ma trận, tức cần ≥2 tài khoản. Nhóm **ngang (IDOR)** và',
      '**ẩn≠cấm** đo được bằng MỘT tài khoản — chúng ở bảng dưới.', '');
  }
  if (bienThe.length) {
    if (!mt.thieu) {
      L.push(`- Nguồn ma trận: \`${path.relative(rc.REPO_ROOT, mt.nguon)}\` · ${(mt.o || []).length} ô`);
    }
    L.push(`- Case thuộc band đòi trục ⑥: **${canAuthz.length}**/${tests.length}`,
      `- Biến thể: **${bienThe.length}** — ${Object.entries(dem).map(([k, v]) => `${k} **${v}**`).join(' · ')}`, '',
      '| Nhóm | Case gốc | Vai trò | Route | Trạng thái | Vì sao |', '|---|---|---|---|---|---|',
      ...bienThe.map((b) => `| ${b.nhom} | ${b.base_tc} | ${b.vai_tro} | ${b.route} | ${b.trang_thai} | ${b.vi_sao || '—'} |`), '');
  } else {
    L.push('Không biến thể nào: chưa khai luật có neo trong config, và chưa có ma trận.', '',
      'Con số proven=0 ở đây KHÔNG có nghĩa "phân quyền ổn" — nghĩa là chưa đo gì.', '');
  }
  if (cauHoi.length) {
    L.push('## Câu hỏi cho Ambiguity Gate', '',
      ...cauHoi.map((q) => `- **${q.muc}** — ${q.cau_hoi}\n  - ${q.vi_sao}`), '');
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${L.join('\n')}\n`);

  console.log(`[authz] ${bienThe.length} biến thể · proven ${proven} · chưa kết luận ${inconclusive} · vi phạm ${doViPham}`);
  console.log(`[authz] báo cáo: ${out}`);
  for (const q of cauHoi) console.log(`[authz] ? ${q.muc}: ${q.cau_hoi}`);

  if (mt.thieu && !luat.length) {
    console.error('[authz] ✗ KHÔNG PHÁN ĐƯỢC (exit 2) — thiếu ma trận vai trò × route VÀ không khai luật nào có neo.');
    process.exit(2);
  }
  if (mt.thieu) {
    console.error(`[authz] ⚠ thiếu ma trận ⇒ nhóm DỌC chưa đo được; ${luat.length} luật có neo vẫn liệt kê được.`);
  }
  if (flag('enforce') && doViPham) {
    console.error(`[authz] ✗ ${doViPham} biến thể FAIL (leo thang quyền / ẩn-mà-không-cấm).`);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { TT, LA_BANG_CHUNG, docMaTran, vaiTroCuaCase };
