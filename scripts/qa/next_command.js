#!/usr/bin/env node
'use strict';
/*
 * next_command — LỆNH TIẾP THEO, suy từ TRẠNG THÁI ARTIFACT (v2.7.0 §A7).
 *
 * VÌ SAO CÓ. Đo ở `docs/v2.7.0/BASELINE.md`: 55 lệnh npm khác nhau rải khắp các điểm vào, 43 lệnh gate
 * trong chuỗi Phase 2 và 30 trong Phase 1. Đích của v2.7.0 là người dùng chỉ cần nhớ NĂM lệnh. Nhưng
 * sáu lệnh còn lại (`/publish`, `/discover`, `/explore`, `/manual-run`, `/ui-debug`, `/partial-rerun`)
 * vẫn cần thiết — chúng chỉ không nên cần NHỚ.
 *
 * Nên file này trả lời đúng một câu: "ở trạng thái này, việc tiếp theo là gì". Và nó trả lời bằng cách
 * đọc FILE CÓ THẬT, không bằng cách đoán theo tên task hay theo hội thoại.
 *
 * MỘT RÀNG BUỘC: nó CHỈ GỢI Ý. Không tự chạy gì, không tự ghi gì. Lý do giống `reliability --promote` và
 * `expansion:plan`: máy biết trạng thái, nhưng không biết người đang muốn làm gì — họ có thể đang cố ý
 * dừng ở giữa để rà một chỗ. Một máy tự chạy bước tiếp theo sẽ đúng chín lần và phá một lần, và lần thứ
 * mười là lần người ta thôi dùng nó.
 *
 * Dùng:
 *   node scripts/qa/next_command.js [--task <KEY>] [--json] [--mot-dong]
 *
 * Exit: 0 luôn (máy BÁO CÁO).
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));

const JSON_OUT = process.argv.includes('--json');
const MOT_DONG = process.argv.includes('--mot-dong');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

const co = (p) => fs.existsSync(p);
const coFile = (d, re) => {
  if (!co(d)) return false;
  try { return fs.readdirSync(d).some((f) => re.test(f)); } catch (e) { return false; }
};
const docJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

/**
 * Đọc trạng thái từ artifact. Mỗi cờ là một FILE CÓ THẬT, không phải một suy đoán.
 */
function trangThai(taskKey, taskOutputDir) {
  const tcDir = path.join(taskOutputDir, 'test-cases');
  const trDir = path.join(taskOutputDir, 'test-results');
  const rpDir = path.join(taskOutputDir, 'reports');
  const soNo = docJson(path.join(rpDir, 'gate-debt.json'));
  return {
    co_profile: co(path.join(REPO, 'profiles', taskKey, 'task.env')),
    co_ban_do_he_thong: co(path.join(rpDir, 'system_map.json')) || co(path.join(taskOutputDir, 'requirements', 'system_map.json')),
    co_mau_so: co(path.join(taskOutputDir, 'requirements', 'scope_inventory.md')),
    co_cau_hoi_cho: co(path.join(rpDir, 'phase1-clarifications.md')),
    co_register: co(path.join(rpDir, 'risk-register.json')),
    co_lan: co(path.join(rpDir, 'lane.json')),
    co_case_md: coFile(tcDir, /\.md$/i),
    co_case_xlsx: coFile(tcDir, /\.xlsx$/i),
    co_moc_expected: co(path.join(trDir, 'expected-ledger.json')),
    co_status: coFile(trDir, /^testcase-status.*\.json$/i),
    co_dau_vet_publish: co(path.join(rpDir, 'exit-gate-publish.json')),
    co_dau_vet_done: co(path.join(rpDir, 'exit-gate-done.json')),
    so_no: soNo ? (soNo.mon || []).length : null,
    co_ke_hoach_mo_rong: co(path.join(rpDir, 'expansion-plan.md')),
  };
}

/*
 * BẢNG GỢI Ý — thứ tự trong mảng là thứ tự ưu tiên, và nó theo DÒNG CHẢY của một task, không theo mức
 * quan trọng. Lý do: người đang ở bước 2 không cần nghe gợi ý của bước 5, kể cả khi bước 5 quan trọng
 * hơn. Gợi ý sai thời điểm là nhiễu, và nhiễu làm người ta thôi đọc dòng này.
 *
 * `khi` nhận trạng thái và trả true nếu gợi ý đó ĐANG đúng lúc.
 */
const GOI_Y = [
  {
    lenh: '/start',
    khi: (s) => !s.co_profile,
    vi_sao: 'chưa có `profiles/<TASK>/task.env` — chưa có creds và scope thì không bước nào chạy được',
    nhom: 'năm lệnh',
  },
  {
    lenh: '/discover',
    khi: (s) => s.co_profile && !s.co_ban_do_he_thong && !s.co_case_md,
    vi_sao: 'chưa có bản đồ hệ thống — sinh case trên một hệ chưa khám phá thì mẫu số coverage là số bạn tự đặt',
    nhom: 'gợi ý đúng lúc',
  },
  {
    lenh: '/phase1',
    khi: (s) => s.co_profile && !s.co_case_md,
    vi_sao: 'chưa có `test-cases/*.md` — đây là bước sinh bộ case',
    nhom: 'năm lệnh',
  },
  {
    lenh: 'npm run scope:anchor:init',
    khi: (s) => s.co_case_md && !s.co_mau_so,
    vi_sao: 'chưa neo MẪU SỐ — mọi tỉ lệ coverage sau đó là % của một mẫu số bạn tự khai',
    nhom: 'gợi ý đúng lúc',
  },
  {
    lenh: 'npm run risk:score -- --task <KEY>',
    khi: (s) => s.co_case_md && !s.co_register,
    vi_sao: 'chưa có `risk-register.json` — chưa chọn được làn, và `risk:gate` không có gì để đối chiếu',
    nhom: 'gợi ý đúng lúc',
  },
  {
    lenh: 'npm run lane -- --task <KEY>',
    khi: (s) => s.co_register && !s.co_lan,
    vi_sao: 'chưa chốt làn — `lite` hay `full` quyết độ sâu của Phase 2',
    nhom: 'gợi ý đúng lúc',
  },
  {
    /*
     * `npm run check`, KHÔNG phải `/check` — sửa 28/10/2026.
     *
     * Dòng này từng phát ra `/check` như một lệnh để người dùng gõ. Nhưng `.claude/commands/check.md`
     * CHƯA BAO GIỜ tồn tại (`git log --all --diff-filter=A` trả rỗng), nên người đọc gợi ý này gõ vào
     * thì không có gì xảy ra. Mọi lệnh `/x` khác mà bộ gợi ý phát ra đều có file thật; chỉ cái này không.
     * Và nó không hỏng im lặng ở phía kit — nó hỏng ở phía NGƯỜI DÙNG, chỗ không ai nhìn.
     */
    lenh: 'npm run check',
    khi: (s) => s.co_case_md && (s.so_no === null || s.so_no > 0),
    vi_sao: (s) => (s.so_no > 0
      ? `${s.so_no} món nợ T1 trong sổ — cửa ra sẽ chặn, trả trước khi tới đó`
      : 'chưa gate nào ghi sổ nợ: có thể chưa gate nào CHẠY'),
    nhom: 'năm lệnh',
  },
  {
    lenh: '/publish',
    khi: (s) => s.co_case_md && s.co_mau_so && !s.co_dau_vet_publish && !s.co_status,
    vi_sao: 'bộ case đã có mà chưa qua cửa publish — Phase 2 chạy theo bộ đã publish',
    nhom: 'gợi ý đúng lúc',
  },
  {
    lenh: '/phase2',
    khi: (s) => s.co_case_md && !s.co_status,
    vi_sao: 'chưa có file status — đây là bước execute',
    nhom: 'năm lệnh',
  },
  {
    lenh: 'npm run expansion:plan -- --task <KEY>',
    khi: (s) => s.co_status && !s.co_ke_hoach_mo_rong,
    vi_sao: 'đã execute mà chưa cân nhắc mở rộng trục nào — gate finalize sẽ chặn',
    nhom: 'gợi ý đúng lúc',
  },
  {
    lenh: '/rerun',
    khi: (s) => s.co_status && s.so_no !== null && s.so_no > 0,
    vi_sao: 'có kết quả rồi nhưng sổ nợ chưa sạch — sửa rồi chạy lại đúng case đỏ',
    nhom: 'năm lệnh',
  },
  {
    lenh: '/release',
    khi: (s) => s.co_status && (s.so_no === 0) && !s.co_dau_vet_done,
    vi_sao: 'sổ nợ sạch mà chưa qua cửa cuối — đây là bước chuyển Done',
    nhom: 'năm lệnh',
  },
];

/** Các lệnh KHÔNG theo dòng chảy: chúng được gợi ý theo TÌNH HUỐNG, không theo bước. */
const THEO_TINH_HUONG = [
  { lenh: '/ui-debug', khi: 'một case đỏ mà chưa rõ vì sao — soi DOM và locator' },
  { lenh: '/manual-run', khi: 'case `Manual-only`: lượt chạy tay vẫn phải có evidence và verdict' },
  { lenh: '/explore', khi: 'muốn soi quanh một màn mà chưa có case — phiên exploratory có đóng vòng học' },
  { lenh: '/partial-rerun', khi: 'requirement đổi: chạy lại đúng phần bị ảnh hưởng, không chạy cả bộ' },
];

function goiY(s) {
  const ra = [];
  for (const g of GOI_Y) {
    if (!g.khi(s)) continue;
    ra.push({ lenh: g.lenh, vi_sao: typeof g.vi_sao === 'function' ? g.vi_sao(s) : g.vi_sao, nhom: g.nhom });
  }
  return ra;
}

function main() {
  let taskKey; let taskOutputDir;
  try {
    rc.loadEnvFiles();
    taskKey = val('task', process.env.TASK_KEY) || rc.getTaskKey();
    taskOutputDir = rc.getTaskOutputDir({ taskKey });
  } catch (e) {
    /*
     * KHÔNG CÓ TASK THÌ GỢI Ý VẪN ĐÚNG MỘT CÁI: `/start`. Đây là ca của người mới, và báo lỗi ở đây là
     * chặn đúng người cần giúp nhất.
     */
    if (JSON_OUT) { console.log(JSON.stringify({ goi_y: [{ lenh: '/start', vi_sao: 'chưa có TASK_KEY hoặc PROJECT_OUTPUT_DIR' }] }, null, 2)); return; }
    console.log('Lệnh tiếp theo: `/start` — chưa có TASK_KEY hoặc PROJECT_OUTPUT_DIR.');
    return;
  }

  const s = trangThai(taskKey, taskOutputDir);
  const ds = goiY(s);
  const ra = { task: taskKey, trang_thai: s, goi_y: ds, theo_tinh_huong: THEO_TINH_HUONG };

  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); return; }

  if (MOT_DONG) {
    /* Một dòng để `check` và các command nhúng vào output của chúng. */
    console.log(ds.length
      ? `Lệnh tiếp theo: \`${ds[0].lenh}\` — ${ds[0].vi_sao}`
      : 'Lệnh tiếp theo: không có gợi ý nào — mọi artifact của dòng chảy đã có mặt.');
    return;
  }

  console.log(`[next] task ${taskKey}`);
  if (!ds.length) {
    console.log('  không có gợi ý nào — mọi artifact của dòng chảy đã có mặt.');
  } else {
    console.log(`  Lệnh tiếp theo: ${ds[0].lenh}`);
    console.log(`    ${ds[0].vi_sao}`);
    if (ds.length > 1) {
      console.log('\n  Sau đó, theo thứ tự dòng chảy:');
      for (const g of ds.slice(1)) console.log(`    ${g.lenh.padEnd(38)} ${g.vi_sao}`);
    }
  }
  console.log('\n  NĂM LỆNH bạn cần nhớ: /start → /phase1 → /phase2 → /rerun → /release · cộng /check lúc nào cũng được.');
  console.log('  Mấy lệnh dưới đây KHÔNG cần nhớ — chúng được gợi ý khi đúng tình huống:');
  for (const t of THEO_TINH_HUONG) console.log(`    ${t.lenh.padEnd(16)} ${t.khi}`);
}

if (require.main === module) main();

module.exports = { trangThai, goiY, GOI_Y, THEO_TINH_HUONG };
