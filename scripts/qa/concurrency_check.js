#!/usr/bin/env node
/**
 * concurrency_check.js — HARNESS ĐỒNG THỜI/TRANH CHẤP (v2.8.4 mục A).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ĐO TÍNH ĐÚNG ĐẮN KHI ĐUA, KHÔNG ĐO TỐC ĐỘ. Phân biệt với K6 (`tests/load/`): K6 hỏi "chậm bao nhiêu
 * khi 200 người cùng vào"; máy này hỏi "**kết quả có đúng không khi 2 người cùng bấm**". Một hệ duyệt
 * đúp vẫn có thể có p95 rất đẹp — K6 xanh, tiền vẫn mất. Hai câu hỏi khác nhau, nên `concurrency.json`
 * khai BẤT BIẾN chứ không khai ngưỡng thời gian.
 *
 * CHỖ KHÔNG HỨA ĐƯỢC, và vì sao nó quyết định cả thiết kế: **không thể bắn N request đúng cùng một thời
 * điểm.** Node chạy một luồng, mạng không hứa thứ tự. Thứ làm được là dựng sẵn N thunk rồi thả cùng lúc,
 * và ĐO ĐỘ LỆCH THẬT giữa request đầu và cuối rời tiến trình.
 *
 * Độ lệch vượt ngưỡng ⇒ lượt đó là `CHUA_KIEM`, KHÔNG phải PASS. Hai request cách nhau 300ms thì chúng
 * không đua, và "không đua mà không lỗi" chẳng chứng minh gì. Một harness đồng thời không đo được mình
 * có đồng thời không thì nó chỉ là một vòng lặp gọi API.
 *
 * AN TOÀN (§A.4 của thiết kế, không nới):
 *   · `chay_o: 'fixture'`  — chỉ chạy trên fixture; gặp target khác thì TỪ CHỐI.
 *   · `chay_o: 'uat_doc'`  — chỉ ĐỌC LẠI để kiểm bất biến sau một thao tác do người làm.
 *   · `chay_o: 'uat_ghi'`  — mặc định TỪ CHỐI. Cần `--resource-test <id>` cho đúng một resource dùng một
 *     lần, và người xác nhận từng lượt.
 *   · `N` có trần (mặc định 5, cứng 10). Vượt trần là TỪ CHỐI — đây không phải load test, và biến nó
 *     thành bắn tải là sai mục tiêu.
 *
 * Trên UAT kết quả là ADVISORY: môi trường có người khác dùng, nên FAIL là cờ để điều tra và phải rerun
 * 2–3 lần loại flaky trước khi gọi là bug (`CLAUDE.md` §3).
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng:
 *   node scripts/qa/concurrency_check.js --config requirements/concurrency.json --base-url <url>
 *        [--only <id,id>] [--resource-test <id>] [--out reports/concurrency.md] [--enforce]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/** Trần CỨNG của N. Config hạ xuống được, KHÔNG nâng lên được. */
const N_TRAN_CUNG = 10;
/** Độ lệch thả tối đa để còn coi là "đua". Quá ngưỡng ⇒ chưa kiểm được. */
const LECH_MAC_DINH_MS = 50;

const TT = {
  pass: 'PASS',
  fail: 'FAIL',
  chua_kiem: 'CHUA_KIEM',
  tu_choi: 'TU_CHOI',
};

/** Target có phải fixture không — neo theo host loopback, không dò chữ trong URL. */
function laFixture(baseUrl) {
  try {
    const h = new URL(baseUrl).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '::1';
  } catch (e) { return false; }
}

/**
 * Thả N request đã dựng sẵn, rồi trả kết quả kèm ĐỘ LỆCH thả thật.
 *
 * `dungThunk` nhận chỉ số và trả một hàm KHÔNG đối số — mọi chuẩn bị (URL, header, body) phải xong
 * TRƯỚC khi thả. Chuẩn bị bên trong thunk thì độ lệch đo được là độ lệch của việc chuẩn bị, không phải
 * của việc gọi.
 */
async function tha(n, dungThunk) {
  const thunk = [];
  for (let i = 0; i < n; i += 1) thunk.push(dungThunk(i));

  const moc = [];
  const chay = thunk.map((f) => {
    moc.push(Date.now());
    return f();
  });
  const lech = moc.length ? Math.max(...moc) - Math.min(...moc) : 0;
  const ra = await Promise.all(chay.map((p) => p.then(
    (v) => ({ ok: true, v }),
    (e) => ({ ok: false, loi: String(e && e.message).slice(0, 160) }),
  )));
  return { ra, lech };
}

/**
 * Chấm BẤT BIẾN ở trạng thái cuối.
 *
 * Không khai bất biến nào ⇒ `CHUA_KIEM`. Không có giá trị kỳ vọng mặc định — một harness tự đặt kỳ vọng
 * là một harness so app với chính nó (luật vàng v2.8.0).
 */
function chamBatBien(batBien, cuoi, ma) {
  if (!batBien || !Object.keys(batBien).length) {
    return { tt: TT.chua_kiem, vi_sao: 'kịch bản KHÔNG khai bất biến nào — chưa có gì để chấm' };
  }
  const loi = [];

  if (batBien.ma_tra_ve) {
    const { so_2xx, cam_500 } = batBien.ma_tra_ve;
    const hai = ma.filter((x) => x >= 200 && x < 300).length;
    if (typeof so_2xx === 'number' && hai !== so_2xx) loi.push(`số mã 2xx = ${hai}, kỳ vọng ${so_2xx} (mã: ${ma.join(',')})`);
    /*
     * 500 là FAIL, không phải "từ chối hợp lệ". App từ chối request thứ hai bằng nhiều cách được; nhưng
     * vỡ ở tầng server nghĩa là nó không có đường xử lý cho tình huống đua.
     */
    if (cam_500 !== false && ma.some((x) => x >= 500)) loi.push(`có mã ${ma.filter((x) => x >= 500).join(',')} — vỡ ở server, không phải từ chối có kiểm soát`);
  }

  for (const [khoa, muon] of Object.entries(batBien.doc || {})) {
    const thay = cuoi == null ? undefined : cuoi[khoa];
    if (thay === undefined) { loi.push(`tầng đọc KHÔNG trả trường \`${khoa}\` — không chấm được`); continue; }
    if (typeof muon === 'object' && muon !== null) {
      if (typeof muon.toi_thieu === 'number' && thay < muon.toi_thieu) loi.push(`\`${khoa}\` = ${thay}, dưới tối thiểu ${muon.toi_thieu}`);
      if (typeof muon.toi_da === 'number' && thay > muon.toi_da) loi.push(`\`${khoa}\` = ${thay}, trên tối đa ${muon.toi_da}`);
    } else if (thay !== muon) {
      loi.push(`\`${khoa}\` = ${JSON.stringify(thay)}, kỳ vọng ${JSON.stringify(muon)}`);
    }
  }

  return loi.length ? { tt: TT.fail, vi_sao: loi.join(' · ') } : { tt: TT.pass, vi_sao: null };
}

/** Một kịch bản. Trả bản ghi kết quả; KHÔNG ném — lỗi của một kịch bản không được giết cả lượt. */
async function chayKichBan(kb, o) {
  const ten = kb.id || '(không id)';
  const tren = o.laFixture ? 'fixture' : 'uat';
  const chayO = kb.chay_o || 'fixture';

  if (chayO === 'fixture' && !o.laFixture) {
    return { id: ten, tt: TT.tu_choi, vi_sao: 'kịch bản khai `chay_o: fixture` mà target KHÔNG phải fixture (host không loopback)' };
  }
  if (chayO === 'uat_ghi' && !o.resourceTest) {
    return {
      id: ten,
      tt: TT.tu_choi,
      vi_sao: 'kịch bản GHI trên UAT: cần `--resource-test <id>` cho một resource dùng một lần, và người xác nhận từng lượt',
    };
  }
  const n = Number(kb.n || 2);
  if (!Number.isInteger(n) || n < 2) return { id: ten, tt: TT.tu_choi, vi_sao: `n = ${kb.n} — cần số nguyên ≥ 2 mới có gì để đua` };
  if (n > o.nTran) return { id: ten, tt: TT.tu_choi, vi_sao: `n = ${n} vượt trần ${o.nTran} — đây KHÔNG phải load test` };

  const url = new URL(kb.duong, o.baseUrl).toString();
  const { ra, lech } = await tha(n, () => () => o.goi(url, {
    method: kb.method || 'POST',
    headers: kb.headers || {},
    body: kb.body === undefined ? undefined : JSON.stringify(kb.body),
  }));

  const ma = ra.map((x) => (x.ok ? x.v.status : 0));
  if (lech > o.lechToiDa) {
    return {
      id: ten, tt: TT.chua_kiem, lech, ma,
      vi_sao: `độ lệch thả ${lech}ms > ngưỡng ${o.lechToiDa}ms — N request này KHÔNG đua, nên lượt đo chưa xảy ra`,
    };
  }

  let cuoi = null;
  if (kb.doc_lai) {
    const r = await o.goi(new URL(kb.doc_lai, o.baseUrl).toString(), { method: 'GET' });
    cuoi = r.body;
  }

  const cham = chamBatBien(kb.bat_bien, cuoi, ma);
  /* Trên UAT mọi verdict là ADVISORY — môi trường dùng chung, FAIL là cờ điều tra chứ chưa phải bug. */
  return {
    id: ten, tt: cham.tt, lech, ma, cuoi, tren,
    advisory: tren === 'uat',
    vi_sao: cham.vi_sao,
  };
}

module.exports = { TT, N_TRAN_CUNG, LECH_MAC_DINH_MS, laFixture, tha, chamBatBien, chayKichBan };

/* ────────────────────────────── CLI ────────────────────────────── */
async function main() {
  const cfgPath = arg('config', path.join(REPO, 'requirements', 'concurrency.json'));
  if (!fs.existsSync(cfgPath)) {
    console.error(`[dong-thoi] ✗ thiếu --config: ${cfgPath}`);
    process.exit(2);
  }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) {
    console.error(`[dong-thoi] ✗ ${cfgPath} không đọc được JSON: ${e.message}`);
    process.exit(2);
  }
  const baseUrl = arg('base-url', process.env.BASE_URL || process.env.OPS_BASE_URL || '');
  if (!baseUrl) { console.error('[dong-thoi] ✗ cần --base-url'); process.exit(2); }

  const kichBan = (cfg.kich_ban || []).filter((k) => {
    const only = arg('only', '');
    return !only || only.split(',').map((x) => x.trim()).includes(k.id);
  });
  if (!kichBan.length) {
    console.error('[dong-thoi] ✗ CHƯA KIỂM (exit 2) — không kịch bản nào để chạy. Đó KHÔNG phải một lượt đo đạt.');
    process.exit(2);
  }

  const o = {
    baseUrl,
    laFixture: laFixture(baseUrl),
    resourceTest: arg('resource-test', ''),
    nTran: Math.min(Number(cfg.n_tran || 5), N_TRAN_CUNG),
    lechToiDa: Number(cfg.lech_toi_da_ms || LECH_MAC_DINH_MS),
    goi: async (url, init) => {
      const r = await fetch(url, init);
      let body = null;
      try { body = await r.json(); } catch (e) { body = null; }
      return { status: r.status, body };
    },
  };

  const ket = [];
  for (const kb of kichBan) ket.push(await chayKichBan(kb, o));   // eslint-disable-line no-await-in-loop

  const dem = {};
  for (const k of ket) dem[k.tt] = (dem[k.tt] || 0) + 1;
  const soFail = ket.filter((k) => k.tt === TT.fail).length;
  const proven = ket.filter((k) => k.tt === TT.pass || k.tt === TT.fail).length;

  const L = [
    `<!-- gate: proven=${proven} inconclusive=${ket.length - proven} broken=${soFail} -->`,
    '# Đồng thời / tranh chấp', '',
    '> Sinh bởi `scripts/qa/concurrency_check.js`. Máy này đo **tính đúng đắn khi đua**, không đo tốc độ —',
    '> K6 (`tests/load/`) trả lời câu khác. `CHUA_KIEM` nghĩa là phép đo CHƯA xảy ra (thường vì độ lệch thả',
    '> quá ngưỡng, hoặc kịch bản không khai bất biến), KHÔNG phải "không có vấn đề".', '',
    `- Target: ${o.laFixture ? '**fixture**' : '**UAT** — mọi verdict là ADVISORY'} · trần N: ${o.nTran} · ngưỡng lệch: ${o.lechToiDa}ms`,
    `- Kịch bản: **${ket.length}** — ${Object.entries(dem).map(([k, v]) => `${k} **${v}**`).join(' · ')}`, '',
    '| Kịch bản | Verdict | Lệch thả | Mã trả về | Vì sao |', '|---|---|---|---|---|',
    ...ket.map((k) => `| ${k.id} | ${k.tt}${k.advisory ? ' _(advisory)_' : ''} | ${k.lech == null ? '—' : `${k.lech}ms`} | ${(k.ma || []).join(',') || '—'} | ${k.vi_sao || '—'} |`),
    '',
  ];
  const out = arg('out', path.join(REPO, 'reports', 'concurrency.md'));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${L.join('\n')}\n`);

  console.log(`[dong-thoi] ${ket.length} kịch bản · ${Object.entries(dem).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`[dong-thoi] báo cáo: ${path.relative(REPO, out)}`);
  for (const k of ket) if (k.tt !== TT.pass) console.error(`[dong-thoi] ${k.tt} ${k.id} — ${k.vi_sao}`);

  if (flag('enforce') && soFail && o.laFixture) process.exit(1);
}

if (require.main === module) main();
