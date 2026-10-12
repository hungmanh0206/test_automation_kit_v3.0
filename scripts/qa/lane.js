#!/usr/bin/env node
'use strict';
/*
 * lane — CHỌN LÀN theo risk, và CHẶN việc hạ làn ở chỗ rủi ro cao (v2.7.0 §A6).
 *
 * VÌ SAO CÓ LÀN. Phần đắt nhất của Phase 2 là mở rộng 5 trục quanh mỗi case. Nó đáng giá ở chỗ rủi ro
 * cao, và ở band Low thì chi phí đó lớn hơn thứ nó mua. Nhưng "cho nhẹ bớt" là một cánh cửa rất dễ bị
 * mở rộng dần, nên làn phải do SỐ quyết, không do người chạy quyết.
 *
 * LÀN QUYẾT ĐỘ SÂU, KHÔNG QUYẾT MỨC AN TOÀN. Đây là ranh giới quan trọng nhất của file này:
 *   · 13 máy T0 chặn y nguyên ở `lite` — secret, PII, chạm UAT, evidence, oracle rỗng, đổi expected;
 *   · evidence giữ nguyên luật 4 ở cả hai làn;
 *   · số lần rerun của một FAIL giữ nguyên ngưỡng `verdict_taxonomy`;
 *   · ba cửa ra của §A2 áp cho cả hai làn.
 * Nới bất kỳ thứ nào trong số đó theo làn nghĩa là một task rủi ro thấp được phép lộ secret, và không
 * có task nào rủi ro thấp đến mức đó.
 *
 * Dùng:
 *   node scripts/qa/lane.js [--task <KEY>] [--json]
 *   node scripts/qa/lane.js --task <KEY> --dat lite|full [--ly-do "<lý do>"]
 *
 * Exit: 0 · 1 khi từ chối đổi làn · 2 khi không chạy được
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const napCfg = require(path.join(__dirname, 'lib', 'config_load.js'));

const DUONG_CFG = path.join(REPO, '.agent', 'config', 'risk_lanes.json');
const JSON_OUT = process.argv.includes('--json');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const TOI_THIEU_LY_DO = 20;

function docCfg() {
  return napCfg.napConfigGate({ duong: DUONG_CFG, nhan: 'risk_lanes.json', phepKiem: 'làn theo risk' });
}

/** Band có hiệu lực của một module: override thắng band máy tính. */
function bandCua(m) {
  return m.band_override || m.band || 'UNKNOWN';
}

/**
 * Suy làn từ register.
 *
 * `UNKNOWN` ⇒ `full`, và đây là chỗ dễ làm sai nhất: UNKNOWN nghĩa là CHƯA ĐO ĐƯỢC impact, không nghĩa
 * là impact thấp. Gộp nó vào `lite` là cho một task chưa ai đo chạy ở làn nhẹ — tức làn nhẹ thành mặc
 * định cho mọi task mới, đúng ngược với ý định.
 */
function suyLan(register) {
  const ds = (register && register.modules) || [];
  if (!ds.length) {
    return {
      lan: null,
      vi_sao: 'register không có module nào — chưa chọn được làn',
      _khong_phan_duoc: true,
    };
  }
  const band = ds.map(bandCua);
  const high = ds.filter((m) => bandCua(m) === 'High').map((m) => m.module);
  const unknown = ds.filter((m) => bandCua(m) === 'UNKNOWN').map((m) => m.module);
  if (high.length) {
    return {
      lan: 'full',
      vi_sao: `${high.length} module band High (${high.slice(0, 5).join(', ')}${high.length > 5 ? '…' : ''}) — một module High kéo cả task sang full`,
      high,
      unknown,
    };
  }
  if (unknown.length) {
    return {
      lan: 'full',
      vi_sao: `${unknown.length} module band UNKNOWN (${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}) — chưa đo được impact KHÔNG phải rủi ro thấp`,
      high,
      unknown,
    };
  }
  return {
    lan: 'lite',
    vi_sao: `${ds.length} module, không có High và không có UNKNOWN (${[...new Set(band)].join(', ')})`,
    high,
    unknown,
  };
}

/** Đường file ghi làn đã chốt của task. */
function duongLan(taskOutputDir) {
  return path.join(taskOutputDir, 'reports', 'lane.json');
}

function docLan(taskOutputDir) {
  const p = duongLan(taskOutputDir);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { _hong: String(e.message) }; }
}

/**
 * Xin đổi làn. Trả `{ ok, vi_sao }` — KHÔNG tự ghi, chỗ gọi quyết.
 *
 * Ba nhánh, và luật của từng nhánh nằm trong config chứ không trong code:
 *   · nâng `lite → full`: luôn được, không cần lý do. Chọn kiểm nhiều hơn thì không ai phải xin phép.
 *   · hạ `full → lite` khi có module High hoặc UNKNOWN: CHẶN, không có cờ nào;
 *   · hạ `full → lite` ở band Medium: được, nhưng phải có lý do ghi lại.
 */
function xinDoiLan(suy, lanMoi, lyDo) {
  if (!['lite', 'full'].includes(lanMoi)) {
    return { ok: false, vi_sao: `làn lạ: "${lanMoi}". Chỉ có: lite · full` };
  }
  if (lanMoi === 'full') {
    return { ok: true, vi_sao: 'nâng lên full — luôn được, không cần lý do' };
  }
  /* lanMoi === 'lite' */
  if (suy.high && suy.high.length) {
    return {
      ok: false,
      vi_sao: `CHẶN: ${suy.high.length} module band High (${suy.high.slice(0, 4).join(', ')}). `
        + 'Hạ làn cho band High là bỏ phần mở rộng ở đúng chỗ rủi ro cao nhất, và không có cờ nào mở được. '
        + 'Muốn hạ thì phải hạ BAND trước, bằng `band_override` kèm lý do trong register — và đó là một '
        + 'quyết định về rủi ro, không phải một quyết định về chi phí.',
    };
  }
  if (suy.unknown && suy.unknown.length) {
    return {
      ok: false,
      vi_sao: `CHẶN: ${suy.unknown.length} module band UNKNOWN (${suy.unknown.slice(0, 4).join(', ')}). `
        + 'Chưa đo được impact KHÔNG phải rủi ro thấp. Đo rồi hạ, đừng hạ rồi mới đo.',
    };
  }
  if (!lyDo || String(lyDo).trim().length < TOI_THIEU_LY_DO) {
    return {
      ok: false,
      vi_sao: `hạ xuống lite cần LÝ DO dài hơn ${TOI_THIEU_LY_DO} ký tự, ghi qua \`--ly-do\`. `
        + 'Lý do phải nói được vì sao module này không cần mở rộng. "Để kịp deadline" không phải lý do '
        + 'kỹ thuật, nhưng nó là lý do THẬT và ghi ra được — nên nó vẫn hợp lệ nếu có người chịu trách nhiệm.',
    };
  }
  return { ok: true, vi_sao: `hạ xuống lite ở band Medium/Low, có lý do: ${lyDo}` };
}

function main() {
  const cfg = docCfg();
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[lane] ✗ không xác định được task: ${e.message}`);
    process.exit(2);
  }

  const duongReg = path.join(taskOutputDir, 'reports', 'risk-register.json');
  let register = null;
  if (fs.existsSync(duongReg)) {
    try { register = JSON.parse(fs.readFileSync(duongReg, 'utf8')); } catch (e) { register = null; }
  }
  if (!register) {
    /*
     * KHÔNG CÓ REGISTER THÌ KHÔNG CHỌN LÀN, và KHÔNG mặc định `full` lẫn `lite`.
     *
     * Mặc định `lite` là cho mọi task chưa đo rủi ro chạy ở làn nhẹ. Mặc định `full` thì nghe an toàn,
     * nhưng nó làm người ta bỏ hẳn bước neo risk: cứ chạy full là xong, và `risk:gate` mất lý do tồn
     * tại. Nên: nói rõ là chưa chọn được, và chỉ đường tạo register.
     */
    console.log(`[lane] CHƯA CHỌN ĐƯỢC LÀN — không có \`reports/risk-register.json\` cho task ${taskKey}.`);
    console.log('       Chạy `npm run risk:score -- --task <KEY>` để sinh register, rồi QA rà band.');
    console.log('       KHÔNG mặc định làn nào: mặc định lite là cho mọi task chưa đo chạy ở làn nhẹ, còn');
    console.log('       mặc định full làm người ta bỏ hẳn bước neo risk — cứ chạy full là xong.');
    process.exit(2);
  }

  const suy = suyLan(register);
  if (suy._khong_phan_duoc) {
    console.log(`[lane] CHƯA CHỌN ĐƯỢC LÀN — ${suy.vi_sao}.`);
    process.exit(2);
  }

  const lanMoi = val('dat');
  const daChot = docLan(taskOutputDir);

  if (!lanMoi) {
    const ra = {
      task: taskKey, lan_suy_ra: suy.lan, vi_sao: suy.vi_sao,
      high: suy.high, unknown: suy.unknown,
      lan_da_chot: daChot ? daChot.lan : null,
      quy_tac_khong_doi: Object.keys(cfg._luat_khong_doi_duoc),
    };
    if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); return; }
    console.log(`[lane] task ${taskKey} · làn suy ra: ${suy.lan.toUpperCase()}`);
    console.log(`       ${suy.vi_sao}`);
    if (daChot && daChot.lan && daChot.lan !== suy.lan) {
      console.log(`       ⚠ làn ĐÃ CHỐT trong reports/lane.json là ${daChot.lan.toUpperCase()}, khác làn suy ra.`);
      if (daChot.ly_do) console.log(`         lý do đã ghi: ${daChot.ly_do}`);
    }
    console.log('');
    console.log('       GIỮ NGUYÊN ở cả hai làn — làn quyết ĐỘ SÂU, không quyết mức an toàn:');
    for (const [k, v] of Object.entries(cfg._luat_khong_doi_duoc)) console.log(`         · ${k}: ${v}`);
    return;
  }

  const kq = xinDoiLan(suy, lanMoi, val('ly-do'));
  if (!kq.ok) {
    console.error(`[lane] ✗ TỪ CHỐI đổi sang "${lanMoi}": ${kq.vi_sao}`);
    process.exit(1);
  }
  const ghi = {
    _la_gi: 'Làn đã chốt cho task này (v2.7.0 §A6). Làn quyết ĐỘ SÂU; T0, evidence, rerun và cửa ra giữ nguyên ở cả hai làn.',
    task: taskKey,
    lan: lanMoi,
    lan_suy_ra: suy.lan,
    vi_sao_suy_ra: suy.vi_sao,
    ly_do_doi: val('ly-do') || null,
    luc: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(duongLan(taskOutputDir)), { recursive: true });
  fs.writeFileSync(duongLan(taskOutputDir), `${JSON.stringify(ghi, null, 2)}\n`, 'utf8');
  console.log(`[lane] ✓ đã chốt làn ${lanMoi.toUpperCase()} cho ${taskKey} — ${kq.vi_sao}`);
  /*
   * Nhắc ghi quyết định DÀI HẠN mỗi khi hạ làn CÓ LÝ DO, không chỉ khi làn suy ra là `full`.
   *
   * Bản đầu chỉ nhắc ở nhánh `full → lite`, nên ca hay gặp nhất bị bỏ: task band Medium suy ra `lite`
   * rồi người ta chốt `lite` kèm lý do. Lý do đó nằm trong `reports/lane.json`, và thư mục task bị dọn
   * là nó mất theo — `knowledge/decisions/` là nơi nó còn lại.
   */
  if (lanMoi === 'lite' && val('ly-do')) {
    console.log('       Hạ làn phải được ghi dài hạn: chạy `npm run decisions:new -- --type risk_override` để');
    console.log('       lý do này còn lại sau khi thư mục task bị dọn.');
  }
}

if (require.main === module) main();

module.exports = { suyLan, xinDoiLan, bandCua, docLan, duongLan, docCfg, TOI_THIEU_LY_DO };
