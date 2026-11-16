#!/usr/bin/env node
'use strict';
/*
 * smoke:gate — CỬA CHẶN ĐẦU /phase3: chạy smoke nông trước, rồi mới cho chạy cả bộ.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ CỬA NÀY: chạy cả bộ lên một môi trường đã chết sinh ra hàng trăm FAIL, và mỗi FAIL đó phải
 * được rerun 2–3 lần rồi phân tầng (CLAUDE.md §3) trước khi ai đó nhận ra cả lượt vô nghĩa. Một lượt
 * smoke vài chục giây trả lời câu đó trước.
 *
 * NHƯNG "SMOKE ĐỎ" KHÔNG PHẢI MỘT THỨ. Spec smoke gắn nhãn `[smoke:<loại>]` cho từng màn đỏ, và cửa này
 * xử theo nhãn:
 *
 *   · moi-truong / loi-may-chu ở MỌI màn  ⇒ DỪNG — failureLayer `infra`. Môi trường chết thật.
 *   · dang-nhap ở bất kỳ màn nào          ⇒ DỪNG — failureLayer `setup_failure`. Mọi case đều cần phiên,
 *                                            nên chạy tiếp chỉ là nhân lỗi đăng nhập lên N lần.
 *   · neo-troi / khong-thay-man            ⇒ CHẠY TIẾP, kèm danh sách màn cần soi. Môi trường VẪN SỐNG;
 *                                            dừng cả lượt vì thư viện cũ là chặn oan.
 *   · moi-truong / loi-may-chu ở MỘT PHẦN  ⇒ CHẠY TIẾP, kèm cảnh báo. 5xx ở một màn trong khi màn khác
 *                                            sống KHÔNG phải "môi trường sập" — nó có thể là lỗi của chính
 *                                            màn đó, và smoke không đủ căn cứ để gọi nó là bug.
 *
 * "KHÔNG KIỂM ĐƯỢC" KHÔNG THÀNH XANH (CLAUDE.md §3). Thiếu catalog, catalog không màn nào có neo, thiếu
 * gốc URL, hoặc không test nào chạy ⇒ exit 2 và báo cáo nói thẳng "chưa kiểm môi trường". Nó không chặn
 * cứng — có task không có catalog — nhưng cũng không được đọc thành "môi trường ổn".
 *
 * Retries=2 ghim cứng: kết luận DỪNG đắt (cả lượt không chạy), nên một nhịp mạng chập chờn không được
 * phép tự nó gây ra. Màn chỉ xanh sau retry được ghi lại là `chap_chon`.
 *
 * Lớp NÔNG, chỉ đọc: `goto` + đếm neo, không ghi ô nào. Vẫn là một lượt CHẠM UAT, nên chỉ chạy SAU khi
 * user đã xác nhận lượt chạm đầu tiên (CLAUDE.md §2).
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/reuse/smoke_gate.js --task <TASK_KEY> [--catalog <ui_catalog.json>] [--dang-nhap ops|khong]
 * Ra:   <task>/reports/smoke-gate.{json,md}
 * Exit: 0 = cho chạy (SACH hoặc CHAY_TIEP_CO_CANH_BAO) · 1 = DUNG · 2 = KHONG_KIEM_DUOC
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config.js'));
const sg = require('./smoke_gen.js');
const sr = require('./smoke_run.js');

const VERDICT = {
  SACH: 'SACH',
  CANH_BAO: 'CHAY_TIEP_CO_CANH_BAO',
  DUNG: 'DUNG',
  KHONG_KIEM_DUOC: 'KHONG_KIEM_DUOC',
};
const EXIT = { SACH: 0, CHAY_TIEP_CO_CANH_BAO: 0, DUNG: 1, KHONG_KIEM_DUOC: 2 };

/** Việc cần làm cho từng nhãn khi màn đỏ mà lượt vẫn chạy tiếp. */
const VIEC_CAN_LAM = {
  'neo-troi': 'neo control đã trôi — chạy `/ui-debug` cho màn này trước khi tin FAIL của nó (FAIL ở đây nghiêng về script_error).',
  'khong-thay-man': 'URL trong catalog có thể đã cũ — đối chiếu lại route trước khi chạy case của màn này.',
  'moi-truong': 'màn này không mở được trong khi màn khác mở được — soi riêng, KHÔNG kết luận bug từ smoke.',
  'loi-may-chu': 'màn này trả 5xx trong khi màn khác sống — điều tra riêng; smoke KHÔNG đủ căn cứ để gọi là bug.',
  'khong-ro': 'smoke đỏ mà không mang nhãn phân loại — đọc log của test này trước khi tin case của màn.',
};

/** Che host trong mọi chuỗi đi ra báo cáo. */
const anHost = (s) => String(s || '').replace(/(https?:\/\/)[^\s/'"`)]+/g, '$1<host>');

/** Nhãn từ thông báo lỗi: `[smoke:<loại>]`. Không có ⇒ `khong-ro`. */
function nhanTuLoi(msg) {
  const m = /\[smoke:([a-z-]+)\]/.exec(String(msg || ''));
  return m && sg.NHAN_LOAI.includes(m[1]) ? m[1] : 'khong-ro';
}

/**
 * Đọc báo cáo JSON của Playwright → mỗi test một dòng { ten, ket_qua, loai, loi, chap_chon }.
 *
 * `ket_qua` lấy LẦN CHẠY CUỐI (sau retry). Có lần đỏ trước đó mà lần cuối xanh ⇒ `chap_chon: true`.
 */
function docKetQua(json) {
  const ra = [];
  const di = (suite) => {
    for (const s of suite.suites || []) di(s);
    for (const sp of suite.specs || []) {
      for (const t of sp.tests || []) {
        const rs = t.results || [];
        const cuoi = rs[rs.length - 1] || {};
        const st = cuoi.status || 'skipped';
        const loiCuoi = (cuoi.errors && cuoi.errors[0] && cuoi.errors[0].message) || (cuoi.error && cuoi.error.message) || '';
        const xanh = st === 'passed';
        /* Tên test là `nông · <màn> — <mô tả>` — báo cáo chỉ cần tên màn. */
        const mTen = /·\s*(.+?)\s+—/.exec(sp.title);
        /* Dòng ĐẦU của thông báo: các dòng sau là code frame của Playwright, vô nghĩa ngoài terminal. */
        const dongDau = String(loiCuoi).replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim()) || '';
        ra.push({
          ten: mTen ? mTen[1] : sp.title,
          ket_qua: xanh ? 'passed' : st,
          loai: xanh ? null : nhanTuLoi(loiCuoi),
          loi: xanh ? '' : anHost(dongDau.trim()).slice(0, 300),
          chap_chon: xanh && rs.some((r) => r.status && r.status !== 'passed'),
        });
      }
    }
  };
  for (const s of (json && json.suites) || []) di(s);
  return ra;
}

/**
 * PHÁN XỬ — hàm thuần, tách ra để spec gọi được. Nhận danh sách test đã đọc, trả { verdict, ... }.
 */
function phanXu(tests) {
  const chay = tests.filter((t) => t.ket_qua !== 'skipped');
  if (!chay.length) {
    return {
      verdict: VERDICT.KHONG_KIEM_DUOC,
      ly_do: 'không test smoke nào chạy — chưa kiểm được môi trường, và "chưa kiểm" KHÔNG phải "ổn".',
      failureLayer: null,
      man_can_soi: [],
    };
  }
  const do_ = chay.filter((t) => t.ket_qua !== 'passed');
  const chapChon = chay.filter((t) => t.chap_chon).map((t) => t.ten);

  const dangNhap = do_.filter((t) => t.loai === 'dang-nhap');
  if (dangNhap.length) {
    return {
      verdict: VERDICT.DUNG,
      failureLayer: 'setup_failure',
      ly_do: `${dangNhap.length}/${chay.length} màn bị đẩy về đăng nhập hoặc đăng nhập trượt — mọi case đều cần phiên, chạy tiếp chỉ nhân lỗi này lên N lần.`,
      man_can_soi: dangNhap.map((t) => ({ ten: t.ten, loai: t.loai, loi: t.loi })),
      chap_chon: chapChon,
    };
  }

  const chet = do_.filter((t) => t.loai === 'moi-truong' || t.loai === 'loi-may-chu');
  if (chet.length === chay.length) {
    return {
      verdict: VERDICT.DUNG,
      failureLayer: 'infra',
      ly_do: `${chay.length}/${chay.length} màn không mở được (mạng, hết giờ hoặc 5xx) — môi trường không sẵn sàng.`,
      man_can_soi: chet.map((t) => ({ ten: t.ten, loai: t.loai, loi: t.loi })),
      chap_chon: chapChon,
    };
  }

  if (!do_.length) {
    return {
      verdict: VERDICT.SACH,
      failureLayer: null,
      ly_do: `${chay.length}/${chay.length} màn mở được và đủ neo.`,
      man_can_soi: [],
      chap_chon: chapChon,
    };
  }

  return {
    verdict: VERDICT.CANH_BAO,
    failureLayer: null,
    ly_do: `${chay.length - do_.length}/${chay.length} màn sạch — môi trường sống. ${do_.length} màn cần soi trước khi tin case của chúng.`,
    man_can_soi: do_.map((t) => ({ ten: t.ten, loai: t.loai, loi: t.loi, viec: VIEC_CAN_LAM[t.loai] })),
    chap_chon: chapChon,
  };
}

/** Ghi báo cáo .json + .md. Host đã che trước khi tới đây. */
function ghiBaoCao(dirReports, kq) {
  fs.mkdirSync(dirReports, { recursive: true });
  fs.writeFileSync(path.join(dirReports, 'smoke-gate.json'), JSON.stringify(kq, null, 2), 'utf8');

  const L = [
    '# Smoke gate — đầu /phase3', '',
    `> ${kq.thoi_diem} · task ${kq.task} · SINH TỰ ĐỘNG bởi \`smoke:gate\`, đừng sửa tay.`, '',
    `**Verdict: \`${kq.verdict}\`**${kq.failureLayer ? ` · failureLayer: \`${kq.failureLayer}\`` : ''}`, '',
    kq.ly_do, '',
  ];
  if (kq.verdict === VERDICT.DUNG) {
    L.push('**DỪNG — không chạy bộ case.** Đây là sự cố môi trường, KHÔNG log Backlog. Báo user, chờ môi trường',
      'ổn rồi chạy lại `smoke:gate`. Đừng chạy cả bộ "cho chắc": mọi FAIL sinh ra đều mang cùng một nguyên nhân.', '');
  }
  if (kq.verdict === VERDICT.KHONG_KIEM_DUOC) {
    L.push('**CHƯA KIỂM ĐƯỢC MÔI TRƯỜNG.** Đây không phải xanh. Báo user và ghi rõ vào báo cáo execute rằng lượt',
      'này chạy mà không có smoke gate.', '');
  }
  if (kq.man_can_soi && kq.man_can_soi.length) {
    L.push('| Màn | Loại | Lỗi | Việc cần làm |', '|---|---|---|---|');
    for (const m of kq.man_can_soi) {
      const o = (s) => String(s || '').replace(/\|/g, '\\|');
      L.push(`| ${o(m.ten)} | \`${m.loai}\` | ${o(m.loi)} | ${o(m.viec || '—')} |`);
    }
    L.push('');
  }
  if (kq.chap_chon && kq.chap_chon.length) {
    L.push(`Chỉ xanh sau retry (chập chờn): ${kq.chap_chon.join(' · ')}`, '');
  }
  if (kq.man_bo_qua && kq.man_bo_qua.length) {
    L.push(`Màn KHÔNG được smoke (thiếu URL hoặc chưa có neo): ${kq.man_bo_qua.join(' · ')}`, '');
  }
  fs.writeFileSync(path.join(dirReports, 'smoke-gate.md'), L.join('\n'), 'utf8');
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };

  let taskDir;
  let task;
  try {
    task = rc.getTaskKey({ task: val('task') });
    taskDir = rc.getTaskOutputDir({ task });
  } catch (e) {
    console.error(`[smoke-gate] ${e.message}`);
    process.exit(2);
  }
  const dirReports = path.join(taskDir, 'reports');
  const thoiDiem = new Date().toISOString();
  const coBan = { task, thoi_diem: thoiDiem };

  const ketThuc = (kq) => {
    const day = { ...coBan, ...kq };
    ghiBaoCao(dirReports, day);
    const nhan = { SACH: '✓', CHAY_TIEP_CO_CANH_BAO: '⚠', DUNG: '✗', KHONG_KIEM_DUOC: '?' }[day.verdict];
    console.log(`[smoke-gate] ${nhan} ${day.verdict}${day.failureLayer ? ` (failureLayer=${day.failureLayer})` : ''} — ${day.ly_do}`);
    for (const m of day.man_can_soi || []) console.log(`  · ${m.ten} [${m.loai}] ${m.viec || m.loi}`);
    console.log(`  Báo cáo: ${path.relative(REPO, path.join(dirReports, 'smoke-gate.md'))}`);
    /* DUNG viết thẳng `exit(1)` — `gate_index` suy mức CHẶN từ đúng dòng này, không đọc bảng EXIT. */
    if (day.verdict === VERDICT.DUNG) process.exit(1);
    process.exit(EXIT[day.verdict]);
  };
  const khongKiem = (lyDo) => ketThuc({ verdict: VERDICT.KHONG_KIEM_DUOC, failureLayer: null, ly_do: lyDo, man_can_soi: [] });

  /* ① Catalog — không có thì smoke không biết màn nào để mở. */
  const catalog = path.resolve(REPO, val('catalog') || path.join(taskDir, 'requirements', 'ui_catalog.json'));
  if (!fs.existsSync(catalog)) {
    khongKiem(`không có catalog màn (${path.relative(REPO, catalog)}) — smoke không biết màn nào để mở. Dựng catalog ở bước discover/ui-debug.`);
  }

  /* ② Gốc URL — không đoán (cùng lớp chặn với `smoke:run`). */
  if (!sr.gocUrl()) khongKiem('thiếu `SMOKE_BASE_URL` (hoặc `OPS_BASE_URL`) trong task.env — KHÔNG đoán host.');

  /*
   * ③ Đăng nhập: mặc định `ops` khi task.env có tài khoản, vì màn thật của app đòi phiên — smoke không
   * đăng nhập sẽ bị đẩy về /Login.aspx ở MỌI màn và cửa này DỪNG oan. `--dang-nhap khong` để tắt (app
   * không cần đăng nhập, hoặc fixture).
   */
  const coTaiKhoan = Boolean(process.env.OPS_USERNAME && process.env.OPS_PASSWORD);
  const yeuCau = val('dang-nhap');
  const dangNhap = yeuCau === 'khong' ? null : (yeuCau || (coTaiKhoan ? 'ops' : null));

  /* ④ Sinh spec nông vào thư mục của task. */
  const outDir = path.join(taskDir, 'automation', '_smoke');
  const sinh = sg.sinh({ duongCatalog: catalog, outDir, deep: false, dangNhap });
  if (sinh.loi) khongKiem(`không sinh được smoke — ${sinh.loi}.`);
  coBan.man_bo_qua = (sinh.bo_qua || []).map((m) => m.ten);
  coBan.dang_nhap = dangNhap || 'khong';

  /* ⑤ Chạy: một worker (lớp chặn 3 của `smoke:run`), retries=2, reporter JSON vào thư mục của task. */
  const chan = sr.kiemTruocKhiChay({ spec: sinh.file, deep: false, dongY: false });
  if (!chan.chay) khongKiem(`smoke:run chặn trước khi chạy — ${chan.ly_do}`);

  const dirChay = path.join(dirReports, '_smoke');
  fs.rmSync(dirChay, { recursive: true, force: true });
  fs.mkdirSync(dirChay, { recursive: true });
  const fileJson = path.join(dirChay, 'results.json');
  const lenh = chan.lenh
    .filter((a) => !a.startsWith('--reporter'))
    .concat(['--reporter=line,json', '--retries=2', `--output=${path.join(dirChay, 'test-results')}`]);

  console.log(`[smoke-gate] ${sinh.so_man_sinh} màn · đăng nhập: ${dangNhap || 'không'} · gốc = ${anHost(sr.gocUrl())}`);
  const kq = spawnSync('npx', lenh, {
    cwd: REPO,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: fileJson, LEARN_AFTER_RUN: '0' },
  });

  let json = null;
  try { json = JSON.parse(fs.readFileSync(fileJson, 'utf8')); } catch (e) { /* xử ở dưới */ }
  if (!json) khongKiem(`Playwright không ra báo cáo JSON (exit ${kq.status}) — lượt smoke không chạy tới test nào.`);

  ketThuc(phanXu(docKetQua(json)));
}

if (require.main === module) main();

module.exports = { phanXu, docKetQua, nhanTuLoi, anHost, VERDICT, EXIT };
