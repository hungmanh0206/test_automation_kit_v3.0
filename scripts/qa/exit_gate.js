#!/usr/bin/env node
'use strict';
/*
 * exit_gate — BA CỬA RA (v2.7.0 §A2).
 *
 * VÌ SAO ĐÂY LÀ PHẦN GIỮ LỜI CỦA §A1. Phân tầng hoãn mọi vi phạm T1 từ "chặn ngay" sang "chặn ở cửa
 * ra". Nếu cửa ra không có thật thì đợt giảm ma sát biến thành đợt NỚI GATE: 57 máy T1 thôi chặn giữa
 * lúc đang làm mà không gì chặn thay. Ba cửa này là chỗ trả lại phần đã hoãn.
 *
 * KHÔNG LIỆT KÊ LẠI GATE TRONG CODE. Bản đồ cửa → máy nằm ở `.agent/config/exit_gates.json`, mỗi máy
 * kèm một câu vì sao nó thuộc cửa đó. Khai trong code thì không ai kiểm toán được một cửa đã bị rút
 * bớt máy, và đó đúng là chỗ dễ trôi nhất: bớt một dòng là xong.
 *
 * MỖI CỬA ĐỌC SỔ NỢ, trừ cửa `bug`. Lý do cửa `bug` không đòi sổ sạch nằm trong config: log bug là việc
 * PHẢI làm khi tìm ra lỗi thật, và nợ T1 về chất lượng bộ case không liên quan tới việc một bug có thật
 * hay không. Chặn log bug vì bộ case còn nợ là chặn sai chỗ — nó làm người ta không báo bug.
 *
 * Dùng:
 *   node scripts/qa/exit_gate.js --cua publish|bug|done [--task <TASK_KEY>] [--json] [--liet-ke]
 *
 * Exit: 0 qua cửa · 1 bị chặn · 2 không chạy được (cửa lạ, thiếu input, config hỏng)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const gateTier = require(path.join(__dirname, 'lib', 'gate_tier.js'));
const napCfg = require(path.join(__dirname, 'lib', 'config_load.js'));

const DUONG_CFG = path.join(REPO, '.agent', 'config', 'exit_gates.json');
const JSON_OUT = process.argv.includes('--json');
const LIET_KE = process.argv.includes('--liet-ke');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

function docCfg() {
  return napCfg.napConfigGate({ duong: DUONG_CFG, nhan: 'exit_gates.json', phepKiem: 'cửa ra' });
}

/*
 * BĂM đầu vào đã kiểm, để một lượt qua cửa không dùng lại được cho bộ đã đổi sau đó.
 *
 * Băm gì: tên file cộng kích thước cộng thời điểm sửa của mọi testcase và file status. KHÔNG băm nội
 * dung, vì mục đích ở đây chỉ là "bộ này còn y như lúc qua cửa hay không" — và `mtime` đổi là đủ để
 * trả lời. Băm nội dung thì phải đọc cả bộ 200 case mỗi lần kiểm dấu vết, tốn mà không thêm gì.
 */
function bamDauVao(taskOutputDir) {
  const muc = [];
  const di = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { di(p); continue; }
      if (!/\.(md|xlsx|json)$/i.test(e.name) || e.name.startsWith('~$')) continue;
      const st = fs.statSync(p);
      muc.push(`${path.relative(taskOutputDir, p).split(path.sep).join('/')}|${st.size}|${Math.round(st.mtimeMs)}`);
    }
  };
  di(path.join(taskOutputDir, 'test-cases'));
  di(path.join(taskOutputDir, 'test-results'));
  muc.sort();
  return { bam: crypto.createHash('sha256').update(muc.join('\n')).digest('hex').slice(0, 20), so_file: muc.length };
}

/** Món nợ còn CHƯA TRẢ. Sổ hỏng thì coi như CÒN NỢ, không coi như sạch. */
function noConLai(taskOutputDir) {
  const so = gateTier.docSoNo(taskOutputDir);
  if (!so) {
    /*
     * THIẾU SỔ KHÁC SỔ SẠCH, và ở cửa ra thì khác biệt đó quan trọng: chưa gate T1 nào ghi gì có thể
     * nghĩa là chưa gate nào CHẠY. Nên trả `null` để chỗ gọi tự quyết, đừng tự dịch thành "sạch".
     */
    return null;
  }
  if (so._hong) return { hong: so._hong, mon: [] };
  return { mon: (so.mon || []) };
}

function chayMay(lenh, taskKey) {
  const t0 = Date.now();
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', '-s', lenh, '--', '--task', taskKey],
    { cwd: REPO, encoding: 'utf8', env: { ...process.env, TASK_KEY: taskKey }, shell: process.platform === 'win32' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { lenh, exit: r.status === null ? 2 : r.status, giay: Math.round((Date.now() - t0) / 100) / 10, out };
}

function main() {
  const cfg = docCfg();
  const ten = val('cua');

  if (LIET_KE || !ten) {
    const ds = Object.keys(cfg.cua || {});
    if (JSON_OUT) { console.log(JSON.stringify(cfg, null, 2)); return; }
    console.log('[exit-gate] BA CỬA RA của kit — mọi đường ra ngoài phải qua đúng một cửa:');
    for (const k of ds) {
      const c = cfg.cua[k];
      console.log(`\n  ── ${k}: ${c.ten}`);
      console.log(`     ${c.lenh}`);
      console.log(`     máy: ${c.may.map((m) => m.lenh).join(' · ')}`);
      console.log(`     đòi sổ nợ sạch: ${c.doi_so_no_sach ? 'CÓ' : `KHÔNG — ${c._vi_sao_khong_doi_so_no_sach}`}`);
    }
    if (cfg._con_ho) {
      console.log('\n  CÒN HỞ, nói thẳng:');
      for (const [k, v] of Object.entries(cfg._con_ho)) console.log(`    · ${k}: ${v}`);
    }
    /*
     * `--liet-ke` là một yêu cầu RÕ RÀNG ("cho tôi xem các cửa"), còn thiếu `--cua` là một lỗi gọi.
     * Hai thứ đó cùng in ra bảng cửa nhưng exit code phải khác nhau, nếu không thì một script gọi
     * `--liet-ke` để đọc config sẽ thấy exit 2 và tưởng mình gọi sai.
     */
    if (!ten && !LIET_KE) process.exit(2);
    return;
  }

  const cua = (cfg.cua || {})[ten];
  if (!cua) {
    console.error(`[exit-gate] ✗ cửa lạ: "${ten}". Chỉ có: ${Object.keys(cfg.cua || {}).join(' · ')}`);
    process.exit(2);
  }

  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    console.error(`[exit-gate] ✗ không xác định được task: ${e.message}`);
    process.exit(2);
  }

  console.log(`[exit-gate] CỬA "${ten}" — ${cua.ten} · task ${taskKey}`);

  /* ── 1. Sổ nợ T1 ───────────────────────────────────────────────────────────────────────────────── */
  const chanVi = [];
  const no = noConLai(taskOutputDir);
  if (cua.doi_so_no_sach) {
    if (no === null) {
      console.log('  sổ nợ: CHƯA CÓ — nghĩa là chưa gate T1 nào ghi gì, HOẶC chưa gate nào chạy.');
      console.log('         Hai thứ đó khác nhau, và máy này không phân biệt được. Các máy dưới đây sẽ trả lời.');
    } else if (no.hong) {
      chanVi.push(`sổ nợ HỎNG (${no.hong}) — sổ hỏng coi như CÒN NỢ, không coi như sạch`);
    } else if (no.mon.length) {
      chanVi.push(`${no.mon.length} món nợ T1 chưa trả`);
      console.log(`  sổ nợ: ✗ ${no.mon.length} món chưa trả`);
      for (const m of no.mon.slice(0, 10)) console.log(`         ${m.gate} · ${m.ma}${m.tcId ? ` · ${m.tcId}` : ''} (${m.so_lan}×): ${String(m.thong_diep).slice(0, 90)}`);
      if (no.mon.length > 10) console.log(`         … (+${no.mon.length - 10})`);
    } else {
      console.log('  sổ nợ: ✓ sạch');
    }
  } else {
    console.log(`  sổ nợ: bỏ qua ở cửa này — ${cua._vi_sao_khong_doi_so_no_sach}`);
  }

  /* ── 2. Các máy của cửa ────────────────────────────────────────────────────────────────────────── */
  const ketQua = [];
  for (const m of cua.may) {
    const r = chayMay(m.lenh, taskKey);
    ketQua.push({ ...r, vi_sao: m.vi_sao });
    const dau = r.exit === 0 ? '✓' : (r.exit === 2 ? '○' : '✗');
    console.log(`  ${dau} ${m.lenh.padEnd(24)} exit ${r.exit} · ${r.giay}s`);
    /*
     * exit 2 là "KHÔNG PHÁN ĐƯỢC", không phải đạt và cũng không phải vi phạm. Gộp nó vào một trong hai
     * phía là chỗ sai nguy hiểm nhất của một cửa ra: coi là đạt thì cửa mở cho một thứ chưa ai kiểm,
     * coi là vi phạm thì cửa chặn một task chỉ vì thiếu input không liên quan.
     */
    if (r.exit === 1) {
      chanVi.push(`${m.lenh} CHẶN — ${m.vi_sao}`);
      /* Sổ ma sát (§A9): lượt chạy thật không đi qua `apTang`, nên trước đây sổ chỉ có sự kiện của bộ test. */
      gateTier.ghiMaSat('chan', m.lenh, gateTier.tangCua(m.lenh).tang, 'exit', taskOutputDir);
    }
    if (r.exit === 2) console.log(`      ○ không phán được (thiếu input hoặc chưa áp dụng) — KHÔNG tính là đạt`);
    if (r.exit !== 0) {
      const dong = r.out.split('\n').filter((l) => /✗|CHẶN|THIẾU|lỗi/.test(l)).slice(0, 4);
      for (const l of dong) console.log(`      ${l.trim().slice(0, 150)}`);
    }
  }

  const khongPhanDuoc = ketQua.filter((r) => r.exit === 2).map((r) => r.lenh);
  const dauVao = bamDauVao(taskOutputDir);
  const ra = {
    cua: ten, task: taskKey, luc: new Date().toISOString(),
    so_no: no === null ? 'chưa có sổ' : (no.hong ? 'hỏng' : no.mon.length),
    may: ketQua.map((r) => ({ lenh: r.lenh, exit: r.exit })),
    khong_phan_duoc: khongPhanDuoc,
    chan_vi: chanVi,
    dau_vao: dauVao,
  };

  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); process.exit(chanVi.length ? 1 : 0); }

  console.log('');
  if (chanVi.length) {
    console.log(`[exit-gate] ✗ CHẶN ở cửa "${ten}" — ${chanVi.length} lý do:`);
    for (const c of chanVi) console.log(`    - ${c}`);
    console.log('');
    console.log('  Đây là chỗ các vi phạm T1 đã hoãn từ lúc đang làm quay lại. Sửa rồi chạy lại cửa.');
    console.log('  Nợ T1 trả xong thì xoá món tương ứng trong `reports/gate-debt.json` — xoá cả sổ để qua');
    console.log('  cửa là đúng thứ sổ này gác.');
    console.log('  Gate nào chặn SAI thì khai: npm run gate:friction -- --bao-oan <gate> --ma <MÃ> --ly-do "<vì sao gate sai>"');
    process.exit(1);
  }

  /*
   * DẤU VẾT QUA CỬA. Nó mang băm của đầu vào, nên một lượt qua cửa không dùng lại được cho bộ đã đổi
   * sau đó — `exit_gate.kiemDauVet()` so lại băm trước khi tin.
   */
  const duongDauVet = path.join(taskOutputDir, 'reports', `exit-gate-${ten}.json`);
  fs.mkdirSync(path.dirname(duongDauVet), { recursive: true });
  fs.writeFileSync(duongDauVet, `${JSON.stringify({
    _la_gi: `Dấu vết QUA CỬA "${ten}". Mang băm của đầu vào đã kiểm, nên nó KHÔNG dùng lại được cho một bộ đã đổi sau đó.`,
    _gioi_han: 'Dấu vết này là file trong `outputs/`, người chạy có toàn quyền sửa. Nó chứng minh "đã qua cửa" cho người đọc trung thực, KHÔNG chống được người cố ý.',
    ...ra,
  }, null, 2)}\n`, 'utf8');

  if (khongPhanDuoc.length) {
    console.log(`[exit-gate] ⚠ QUA CỬA "${ten}", nhưng ${khongPhanDuoc.length} máy KHÔNG PHÁN ĐƯỢC: ${khongPhanDuoc.join(' · ')}`);
    console.log('            Chúng không chặn, và cũng KHÔNG chứng minh được gì. Ghi vào báo cáo cửa ra.');
  } else {
    console.log(`[exit-gate] ✓ QUA CỬA "${ten}" — ${ketQua.length}/${ketQua.length} máy đạt.`);
  }
  console.log(`            Dấu vết: ${path.relative(REPO, duongDauVet).split(path.sep).join('/')} (băm đầu vào ${dauVao.bam}, ${dauVao.so_file} file)`);
}

/**
 * Kiểm dấu vết qua cửa — dùng bởi script TỰ ĐẨY RA NGOÀI (vd `bug_reporter`), để chúng không chờ ai
 * nhớ chạy cửa.
 *
 * Trả `{ ok, vi_sao }`. `ok: false` khi: không có dấu vết · dấu vết của cửa khác · đầu vào đã đổi so
 * với lúc qua cửa. Trường hợp thứ ba là chỗ quan trọng nhất: qua cửa rồi sửa tiếp rồi đẩy đi là đúng
 * đường né mà cửa ra phải bịt.
 */
function kiemDauVet(taskOutputDir, ten, { hanGio = 24 } = {}) {
  const duong = path.join(taskOutputDir, 'reports', `exit-gate-${ten}.json`);
  if (!fs.existsSync(duong)) {
    return { ok: false, vi_sao: `chưa qua cửa "${ten}" — chạy \`npm run exit:gate -- --cua ${ten}\` trước` };
  }
  let j;
  try { j = JSON.parse(fs.readFileSync(duong, 'utf8')); } catch (e) {
    return { ok: false, vi_sao: `dấu vết cửa "${ten}" hỏng JSON` };
  }
  if (j.cua !== ten) return { ok: false, vi_sao: `dấu vết là của cửa "${j.cua}", không phải "${ten}"` };
  const tuoiGio = (Date.now() - new Date(j.luc).getTime()) / 3600000;
  if (!Number.isFinite(tuoiGio) || tuoiGio > hanGio) {
    return { ok: false, vi_sao: `dấu vết cửa "${ten}" quá ${hanGio}h (${Math.round(tuoiGio)}h) — chạy lại cửa` };
  }
  const nay = bamDauVao(taskOutputDir);
  if (j.dau_vao && j.dau_vao.bam !== nay.bam) {
    return {
      ok: false,
      vi_sao: `đầu vào ĐÃ ĐỔI sau khi qua cửa "${ten}" (băm ${j.dau_vao.bam} → ${nay.bam}). `
        + 'Qua cửa rồi sửa tiếp rồi đẩy đi là đúng đường né mà cửa ra phải bịt — chạy lại cửa.',
    };
  }
  return { ok: true, luc: j.luc, bam: nay.bam };
}

if (require.main === module) main();

module.exports = { kiemDauVet, bamDauVao, noConLai, docCfg, DUONG_CFG };
