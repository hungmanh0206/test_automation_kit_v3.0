#!/usr/bin/env node
'use strict';
/*
 * gate_audit — KIỂM KÊ GATE để phân tầng (v2.7.0 bước 1a).
 *
 * VÌ SAO CẦN. `gates:index` trả lời "kit có máy nào, chặn gì, gọi ở đâu". Nó KHÔNG trả lời được câu
 * quyết định việc phân tầng: máy đó chặn vào LÚC NÀO, nó đã từng chặn oan bao nhiêu lần, và nó có bị
 * máy khác bắt trùng không. Thiếu ba thứ đó thì "giảm ma sát" chỉ còn là cảm giác ai chặn nhiều quá.
 *
 * KHÔNG TỰ ĐẾM LẠI. Phép kiểm kê dùng `gate_index.build()`. Hai máy cùng trả lời "kit có bao nhiêu gate"
 * mà quét bằng hai cách khác nhau thì sớm muộn ra hai con số, và lúc đó không ai biết số nào đúng.
 *
 * LUẬT CỦA MÁY NÀY: thiếu dữ liệu thì ghi `chưa đo được`, KHÔNG đoán. Một con số bịa ra ở bảng kiểm kê
 * sẽ được dùng để quyết định hạ tầng một gate — tức nó biến thành một lỗ thật trong bộ kiểm.
 *
 * Dùng:
 *   node scripts/qa/gate_audit.js [--json] [--write-tiers] [--full]
 *
 * Exit: 0 luôn (đây là máy BÁO CÁO, không chặn) · 2 khi không đọc được nguồn
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const gateIndex = require(path.join(__dirname, 'gate_index.js'));

const JSON_OUT = process.argv.includes('--json');
const WRITE_TIERS = process.argv.includes('--write-tiers');
const FULL = process.argv.includes('--full');
const TIERS_OUT = path.join(REPO, '.agent', 'config', 'gate_tiers.json');

const docAn = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

/*
 * THỜI ĐIỂM CHẠY, suy từ BỀ MẶT GỌI chứ không khai tay.
 *
 * Khai tay thì bảng trôi ngay lần một gate được nối thêm vào một bước khác. Suy từ bề mặt thì bảng tự
 * đúng theo source — cùng lý do `gates:index` không viết tay cột "Gọi từ".
 *
 * Một gate có thể có NHIỀU thời điểm, và đó là thông tin quan trọng nhất cho việc phân tầng: gate vừa
 * chạy lúc ghi file vừa chạy ở cửa ra là gate gây ma sát giữa lúc đang làm mà vẫn được gác ở cửa.
 */
const THOI_DIEM = [
  { ma: 'write', khop: (s) => /settings\.json|hooks/.test(s), nghia: 'khi agent ghi hoặc sửa file (hook)' },
  { ma: 'ci', khop: (s) => /\.github|gitlab-ci/.test(s), nghia: 'trên CI' },
  {
    ma: 'exit',
    khop: (s) => /publish|release|finalize|report_and_backlog|self.?review|cleanup/i.test(s),
    nghia: 'ở cửa ra (publish · log bug · Done hoặc release)',
  },
  { ma: 'phase', khop: (s) => /phase|prompt_templates|workflows|exploratory|manual-run|commands|rules|skills|partial-rerun/i.test(s), nghia: 'trong lúc chạy phase' },
];

function thoiDiemCua(called) {
  const ra = new Set();
  for (const s of called) {
    for (const t of THOI_DIEM) if (t.khop(s)) ra.add(t.ma);
  }
  return [...ra];
}

/*
 * TẦNG ĐỀ XUẤT — neo vào 6 NON-NEGOTIABLES, không vào cảm giác.
 *
 * BẢN ĐẦU SUY TỪ MỘT DÒNG MÔ TẢ, VÀ NÓ KHÔNG DÙNG ĐƯỢC. Đo ngày 11/10/2026: 66/98 máy ra "không dấu
 * hiệu nào khớp", tức phép suy gần như không nói gì. Tệ hơn, nó xếp `prompt:budget` vào T0 "lộ secret"
 * vì chữ *token* trong mô tả nó nghĩa là token của prompt. Một bảng phân tầng sai kiểu đó sẽ được dùng
 * để quyết định hạ tầng một gate — tức nó biến thành một lỗ thật trong bộ kiểm.
 *
 * Hai thứ đổi:
 *   1. Đọc CẢ KHỐI HEADER của file gate, không chỉ một dòng `purpose`. Header là nơi kit ghi "vì sao
 *      cần máy này", nên nó mang đúng tín hiệu cần.
 *   2. Mỗi dấu hiệu T0 neo vào MỘT non-negotiable có số. §B.4 đòi mỗi non-negotiable phải có ít nhất
 *      một gate T0 thi hành nó, nên bản đồ đó là thứ phải có, không phải thứ thêm cho đẹp.
 *
 * Vẫn là PHÉP SUY TỪ VĂN BẢN: nó đúng tới mức header đúng. `do_tin: "thap"` nghĩa là chưa suy được và
 * đang chờ người chốt.
 */
const NON_NEGOTIABLE = {
  1: 'Bảo mật tuyệt đối (secret · PII)',
  2: 'UAT non-destructive + DB read-only',
  3: 'Verify thật trước khi kết luận',
  4: 'Evidence bắt buộc',
  5: 'Scope & isolation',
  6: 'Không gian lận để PASS',
};

/*
 * Thứ tự QUAN TRỌNG: dấu hiệu hẹp đứng trước dấu hiệu rộng, vì vòng lặp dừng ở cái khớp đầu tiên.
 * `token` KHÔNG nằm trong nhóm secret: trong kit này "token" gần như luôn là token của prompt, và chính
 * chỗ đó đã làm bản đầu xếp `prompt:budget` vào T0.
 */
const DAU_HIEU_T0 = [
  { nn: 1, re: /\bsecret\b|mật khẩu|password|service.account|api[ _-]?key|credential/i, vi: 'lộ secret' },
  { nn: 1, re: /\bPII\b|mask PII|che PII|số điện thoại|căn cước|CCCD|định danh cá nhân/i, vi: 'lộ PII khách' },
  { nn: 2, re: /chạm prod|non.?prod|môi trường thật|tường lửa ghi|request ghi|chỉ SELECT|read.only|read only/i, vi: 'chạm prod hoặc ghi lên UAT' },
  { nn: 2, re: /mutate|thay đổi dữ liệu UAT|dựng state bằng DB/i, vi: 'thay đổi dữ liệu UAT' },
  { nn: 4, re: /evidence|ảnh đúng màn|\.png|\.mp4|highlight element|ảnh hoặc video/i, vi: 'thiếu evidence cho case đã execute' },
  { nn: 6, re: /nới assertion|xoá assertion|đổi expected|gian lận|hardcode data task/i, vi: 'gian lận để PASS' },
  { nn: 3, re: /tautology|app ?== ?app|oracle rỗng|oracle_ref|không phán được/i, vi: 'oracle rỗng hoặc kết luận không có neo' },
  { nn: 3, re: /mất kết quả|mất verdict|mất ô kết quả/i, vi: 'mất kết quả âm thầm' },
  { nn: 5, re: /TASK_KEY|PROJECT_OUTPUT_DIR|task\.env|lẫn task|cách ly/i, vi: 'phạm vi và cách ly task' },
];

const DAU_HIEU_T1 = [
  { re: /độ phủ|coverage|chiều bắt buộc|risk band|depth|kỹ thuật thiết kế/i, vi: 'độ phủ và độ sâu của bộ case' },
  { re: /chất lượng.{0,15}testcase|row.quality|rubric|thiết kế testcase|ô lõi|thiếu cột/i, vi: 'chất lượng dòng testcase' },
  { re: /locator|selector|strict mode/i, vi: 'chất lượng locator' },
  { re: /bug claim|phản chứng|log bug|repro/i, vi: 'chất lượng bug' },
  { re: /mở rộng|expansion|mẫu số|scope_inventory/i, vi: 'phạm vi và neo mẫu số' },
  { re: /lệch source|lệch nguồn|TRÔI|trôi khỏi|parity|khớp source|khớp nguồn/i, vi: 'lớp dẫn xuất trôi khỏi nguồn' },
  { re: /token|ngân sách|phần nạp/i, vi: 'ngân sách token' },
  { re: /tài liệu|giáo trình|bài giảng|writing|hành văn/i, vi: 'chất lượng tài liệu' },
];

/** Khối chú thích đầu file — nơi kit ghi "vì sao cần máy này". */
function headerCua(file) {
  const t = docAn(path.join(REPO, file));
  if (!t) return '';
  const ra = [];
  for (const d of t.split(/\r?\n/).slice(0, 60)) {
    const l = d.trim();
    if (/^(const|let|function|module\.exports|if |async )/.test(l)) break;
    ra.push(l.replace(/^(\/\*+|\*+\/?|\/\/)\s?/, ''));
  }
  return ra.join(' ');
}

/*
 * TẦNG LẤY TỪ CONFIG, KHÔNG SUY. `gate_tiers.json` là nguồn duy nhất (§A1).
 *
 * ĐÃ THỬ SUY BẰNG TỪ KHOÁ, HAI LẦN, VÀ CẢ HAI ĐỀU KHÔNG DÙNG ĐƯỢC:
 *   · Suy từ MỘT DÒNG mô tả — 66/98 máy ra "không dấu hiệu nào khớp", tức phép suy gần như không nói gì.
 *     Và nó xếp `prompt:budget` vào T0 "lộ secret", vì chữ *token* trong mô tả nó nghĩa là token của prompt.
 *   · Suy từ CẢ KHỐI HEADER — T0 phình lên 40 máy: `ci:scope` và `auto:review` bị gán "lộ secret",
 *     `decisions:check` bị gán "lộ PII". Header dài 60 dòng nhắc những chữ đó TRONG KHI GIẢI THÍCH, nên
 *     khớp ở đâu cũng khớp.
 *
 * Một bảng phân tầng sai 40% sẽ được dùng để quyết định hạ tầng một gate — tức nó biến thành một lỗ thật
 * trong bộ kiểm. Nên T0 là danh sách KHAI TAY trong config, và từ khoá hạ xuống làm CỘT GỢI Ý: nó chỉ
 * dùng để soi xem danh sách khai tay có bỏ sót ứng viên nào.
 *
 * Mức CHẶN/SINH/BÁO CÁO vẫn suy TỪ CODE qua `gate_index`, không khai tay: nới một gate từ CHẶN thành
 * cảnh báo là sửa một dòng, và một bảng khai tay sẽ không biết chuyện đó.
 */
function docTiers() {
  const t = docAn(TIERS_OUT);
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { return { _loi: e.message }; }
}

/** Dấu hiệu từ khoá — CHỈ để gợi ý, không quyết định tầng. */
function goiYTuTuKhoa(row) {
  const van = `${row.purpose} ${headerCua(row.file)} ${row.file} ${row.npm.join(' ')}`;
  for (const d of DAU_HIEU_T0) if (d.re.test(van)) return { tang: 'T0', vi: d.vi, nn: d.nn };
  for (const d of DAU_HIEU_T1) if (d.re.test(van)) return { tang: 'T1', vi: d.vi, nn: null };
  return null;
}

function tangCua(row, tiers) {
  const goiY = goiYTuTuKhoa(row);
  /* BÁO CÁO và SINH không kiểm vi phạm nên không chặn được gì ⇒ T2. Đây là suy luận CHẮC, từ code. */
  if (!row.level.startsWith('CHẶN')) {
    return {
      tang: 'T2', vi_sao: `mức ${row.level} — không phát hiện vi phạm nên không có gì để chặn`,
      do_tin: 'cao', non_negotiable: null, nguon_tang: 'suy từ code (mức không chặn)', goi_y: goiY,
    };
  }
  const khai = tiers && tiers.T0 && tiers.T0[row.npm[0]];
  if (khai) {
    return {
      tang: 'T0', vi_sao: khai.vi_sao, do_tin: khai.do_tin || 'cao',
      non_negotiable: khai.non_negotiable, nguon_tang: 'khai tay trong gate_tiers.json', goi_y: goiY,
    };
  }
  return {
    tang: 'T1', vi_sao: 'không khai T0 ⇒ mặc định T1 (chặn ở cửa ra, cảnh báo lúc đang làm)',
    do_tin: 'cao', non_negotiable: null, nguon_tang: 'mặc định theo luật', goi_y: goiY,
  };
}

/*
 * SỐ LẦN CHẶN và SỐ LẦN BÁO OAN — đếm từ dấu vết có thật, và nói rõ dấu vết đó là gì.
 *
 * Nguồn duy nhất đang có dấu vết dùng được là CHANGELOG: mỗi lần một gate báo oan và được vá, mục
 * CHANGELOG của lần đó ghi lại. Thư mục `reports` của task thì ghi kết quả task, không ghi "gate nào đã
 * chặn mình bao nhiêu lần".
 *
 * GIỚI HẠN PHẢI KHAI: đây là số lần một gate ĐƯỢC NHẮC trong một đoạn nói về báo oan, không phải số lần
 * nó thực sự báo oan. Nó chỉ dùng để XẾP THỨ TỰ cái nào đáng soi trước. Dùng nó làm căn cứ hạ tầng một
 * gate là dùng sai, và quy tắc dọn ở §A9 (báo oan > 20% trong ≥10 lần chặn) KHÔNG đo được bằng nguồn này.
 */
const TU_BAO_OAN = /báo oan|chặn oan|dương tính giả|đỏ oan|tố oan|sai oan/i;

function tenCua(row) {
  return [...row.npm, path.basename(row.file)].filter((x) => !x.startsWith('('));
}

function lichSu(row, changelogDoan, reportVan) {
  const ten = tenCua(row);
  let oan = 0;
  const viDu = [];
  for (const doan of changelogDoan) {
    if (!TU_BAO_OAN.test(doan)) continue;
    if (!ten.some((t) => doan.includes(t))) continue;
    oan += 1;
    if (viDu.length < 2) viDu.push(doan.replace(/\s+/g, ' ').slice(0, 110));
  }
  const nhacTrongReport = ten.reduce((s, t) => s + (reportVan.split(t).length - 1), 0);
  return {
    so_lan_bao_oan_nhac_trong_changelog: oan,
    vi_du_bao_oan: viDu,
    nhac_trong_report_task: nhacTrongReport,
    so_lan_chan: 'chưa đo được',
    _vi_sao_chua_do_duoc_so_lan_chan:
      'Không nguồn nào trong repo ghi "gate X đã chặn N lần". Transcript không được track, và thư mục '
      + 'reports của task ghi kết quả task chứ không ghi lượt bị gate chặn. Muốn đo thì phải ghi sổ ở '
      + '`gate_engine` (§A9: knowledge/metrics/gate-friction.jsonl) rồi dùng vài sprint.',
  };
}

/*
 * CẶP ĐỐI CHỨNG (§A10.3): gate phải có fixture LỖI (đỏ, đúng mã) và fixture SẠCH (xanh, chứng minh
 * không báo oan). Đo bằng cách soi spec nào nhắc gate đó và có CẢ assert khác 0 lẫn assert bằng 0.
 *
 * Đây là phép suy từ VĂN BẢN của spec, nên nó trả lời "có dấu hiệu của cặp đối chứng", không trả lời
 * "cặp đối chứng đúng". Khai rõ để không ai đọc cột này thành đã kiểm chứng.
 */
function capDoiChung(row, specs) {
  const ten = tenCua(row);
  const lienQuan = specs.filter((s) => ten.some((t) => s.txt.includes(t)));
  if (!lienQuan.length) return { co_spec: false, co_ca_hai_chieu: false, spec: [] };
  const coDo = lienQuan.some((s) => /toBe\(1\)|toBe\(2\)|not\.toBe\(0\)|toBeGreaterThan\(0\)/.test(s.txt));
  const coXanh = lienQuan.some((s) => /toBe\(0\)/.test(s.txt));
  return { co_spec: true, co_ca_hai_chieu: coDo && coXanh, spec: lienQuan.map((s) => s.ten).slice(0, 3) };
}

function docSpecs() {
  const d = path.join(REPO, 'tests', 'fe', 'infra');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.spec.ts'))
    .map((f) => ({ ten: `tests/fe/infra/${f}`, txt: docAn(path.join(d, f)) }));
}

/** Toàn bộ văn bản report trong `outputs` — để đếm gate nào được nhắc trong task thật. */
function vanReport() {
  const goc = path.join(REPO, 'outputs');
  if (!fs.existsSync(goc)) return '';
  let ra = '';
  const di = (dir, sau) => {
    if (sau > 5) return;
    let ds;
    try { ds = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ds) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { di(p, sau + 1); continue; }
      if (/\.(md|json)$/.test(e.name) && /reports/.test(dir)) ra += docAn(p);
    }
  };
  di(goc, 0);
  return ra;
}

/*
 * TRÙNG LẮP GIỮA CÁC GATE — `chưa đo được`, và lý do phải ghi ra vì prompt khai một cách đo KHÔNG dùng
 * được.
 *
 * §1a nói lấy từ "mutant của `mutation_check` mà ≥2 gate cùng bắt". Đã đọc `mutation_check.js`: nó tiêm
 * lỗi vào RESPONSE ở tầng `page.route()` và cần một session UAT thật cộng `ui_catalog.json`. Nó đo năng
 * lực phát hiện của BỘ ASSERTION trong testcase, không chạy gate nào. Nên nó không thể trả ra bản đồ
 * gate-bắt-trùng.
 *
 * Cách đo đúng, và chính prompt này đã đòi ở chỗ khác: bộ fixture cặp đối chứng của §A10.3 cộng bộ dữ
 * liệu vàng của §A10.4. Có chúng rồi thì "gate X và Y cùng đỏ trên cùng một fixture lỗi" là một phép đo
 * thật, offline, không chạm UAT.
 */
const TRUNG_LAP = {
  trang_thai: 'chưa đo được',
  _vi_sao:
    '§1a khai cách đo là mutant của `mutation_check`. Đọc source: máy đó tiêm lỗi vào response ở tầng '
    + 'page.route(), cần session UAT thật và ui_catalog.json, và nó đo bộ ASSERTION trong testcase chứ '
    + 'không chạy gate nào. Không có đường nào từ nó ra bản đồ gate-bắt-trùng.',
  _cach_do_dung:
    'Dựng bộ fixture cặp đối chứng (§A10.3) và bộ dữ liệu vàng (§A10.4), rồi chạy MỌI gate trên từng '
    + 'fixture lỗi: hai gate cùng đỏ trên cùng tập fixture là ứng viên trùng. Offline, không chạm UAT.',
};

function kiemKe() {
  const data = gateIndex.build();
  const changelogDoan = docAn(path.join(REPO, 'CHANGELOG.md')).split(/\n\s*\n/);
  const reportVan = vanReport();
  const specs = docSpecs();
  const tiers = docTiers();

  const rows = data.rows.map((r) => {
    const td = thoiDiemCua(r.called);
    return {
      npm: r.npm, file: r.file, muc: r.level, chan_gi: r.purpose,
      goi_tu: r.called, thoi_diem: td.length ? td : ['chưa rõ'],
      ...tangCua(r, tiers),
      doi_chung: capDoiChung(r, specs),
      lich_su: lichSu(r, changelogDoan, reportVan),
    };
  });

  const dem = (t) => rows.filter((r) => r.tang === t).length;
  /* §B.4: mỗi non-negotiable phải có ≥1 gate T0 thi hành nó. Thiếu một là phải nói ra. */
  const banDoNN = {};
  for (const k of Object.keys(NON_NEGOTIABLE)) {
    banDoNN[k] = {
      ten: NON_NEGOTIABLE[k],
      gate: rows.filter((r) => String(r.non_negotiable) === k).map((r) => r.npm[0]),
    };
  }
  return {
    _sinh_boi: 'node scripts/qa/gate_audit.js',
    tong_may: rows.length,
    theo_tang: { T0: dem('T0'), T1: dem('T1'), T2: dem('T2') },
    cho_nguoi_chot: rows.filter((r) => r.do_tin === 'thap').map((r) => r.npm[0]),
    thieu_cap_doi_chung: rows.filter((r) => r.tang !== 'T2' && !r.doi_chung.co_ca_hai_chieu).map((r) => r.npm[0]),
    non_negotiable_chua_co_gate_T0: Object.entries(banDoNN)
      .filter(([, v]) => !v.gate.length).map(([k, v]) => `§${k} ${v.ten}`),
    /*
     * ỨNG VIÊN T0 BỊ BỎ SÓT: từ khoá gợi ý T0 mà danh sách khai tay không có. Đây là lý do GIỮ cột gợi
     * ý sau khi đã hạ nó khỏi việc quyết định tầng — nó không đủ tin để xếp tầng, nhưng đủ dùng để hỏi
     * "có bỏ sót cái nào không". Danh sách này DÀI là bình thường: phần lớn sẽ là dương tính giả.
     */
    ung_vien_T0_chua_khai: rows
      .filter((r) => r.tang === 'T1' && r.goi_y && r.goi_y.tang === 'T0')
      .map((r) => `${r.npm[0]} (gợi ý: ${r.goi_y.vi})`),
    ban_do_non_negotiable: banDoNN,
    trung_lap: TRUNG_LAP,
    gate: rows,
  };
}

function inRa(ra) {
  const rows = ra.gate;
  console.log(`[gate-audit] ${rows.length} máy · T0 ${ra.theo_tang.T0} · T1 ${ra.theo_tang.T1} · T2 ${ra.theo_tang.T2}`);
  console.log('');
  console.log('| Tầng | Tin | npm | Thời điểm | Vì sao tầng đó | Đối chứng |');
  console.log('|---|---|---|---|---|---|');
  const thuTu = { T0: 0, T1: 1, T2: 2 };
  const sap = rows.slice().sort((a, b) => (thuTu[a.tang] - thuTu[b.tang])
    || ((a.do_tin === 'thap' ? 0 : 1) - (b.do_tin === 'thap' ? 0 : 1))
    || a.npm[0].localeCompare(b.npm[0]));
  const hien = FULL ? sap : sap.filter((x) => x.tang === 'T0' || x.do_tin === 'thap');
  for (const r of hien) {
    const dc = r.doi_chung.co_ca_hai_chieu ? 'đủ hai chiều' : (r.doi_chung.co_spec ? 'MỘT chiều' : 'KHÔNG spec');
    const nn = r.non_negotiable ? ` (§${r.non_negotiable})` : '';
    console.log(`| ${r.tang} | ${r.do_tin === 'thap' ? '⚠ thấp' : 'cao'} | \`${r.npm[0]}\` | ${r.thoi_diem.join('+')} | ${r.vi_sao}${nn} | ${dc} |`);
  }
  if (!FULL) console.log(`\n(in ${hien.length}/${rows.length}: mọi T0 cộng mọi dòng độ-tin-thấp. \`--full\` để xem hết)`);

  console.log('');
  console.log('BẢN ĐỒ 6 NON-NEGOTIABLE → GATE T0 (§B.4 đòi mỗi mục phải có ít nhất một):');
  for (const [k, v] of Object.entries(ra.ban_do_non_negotiable)) {
    console.log(`  §${k} ${v.ten}: ${v.gate.length ? v.gate.join(' · ') : '✗ KHÔNG GATE T0 NÀO'}`);
  }

  console.log('');
  console.log(`⚠ ${ra.cho_nguoi_chot.length} máy khai T0 với độ tin THẤP ⇒ chờ người chốt: ${ra.cho_nguoi_chot.join(' · ') || 'không có'}`);
  console.log(`~ ${ra.ung_vien_T0_chua_khai.length} ứng viên T0 do TỪ KHOÁ gợi ý mà chưa khai tay — phần lớn là dương tính giả, nhưng nên rà một lượt:`);
  for (const u of ra.ung_vien_T0_chua_khai.slice(0, 10)) console.log(`    ${u}`);
  if (ra.ung_vien_T0_chua_khai.length > 10) console.log(`    … (+${ra.ung_vien_T0_chua_khai.length - 10})`);
  console.log(`⚠ ${ra.thieu_cap_doi_chung.length}/${rows.filter((r) => r.tang !== 'T2').length} máy T0+T1 chưa có dấu hiệu cặp đối chứng đủ hai chiều (§A10.3).`);

  const oan = rows.filter((r) => r.lich_su.so_lan_bao_oan_nhac_trong_changelog > 0)
    .sort((a, b) => b.lich_su.so_lan_bao_oan_nhac_trong_changelog - a.lich_su.so_lan_bao_oan_nhac_trong_changelog);
  console.log(`\nMáy được nhắc nhiều nhất trong các đoạn CHANGELOG nói về BÁO OAN (${oan.length} máy):`);
  for (const r of oan.slice(0, 8)) console.log(`  ${String(r.lich_su.so_lan_bao_oan_nhac_trong_changelog).padStart(2)}× ${r.npm[0]}`);
  console.log('  GIỚI HẠN: đây là số lần ĐƯỢC NHẮC trong một đoạn nói về báo oan, KHÔNG phải số lần báo oan.');
  console.log('  Quy tắc dọn §A9 (báo oan >20% trong ≥10 lần chặn) KHÔNG đo được bằng nguồn này — phải ghi sổ');
  console.log('  ở `gate_engine` trước rồi dùng vài sprint.');
  console.log('\nSố lần CHẶN: chưa đo được. Trùng lắp giữa gate: chưa đo được.');
  console.log(`  ${TRUNG_LAP._vi_sao}`);
  console.log(`  Cách đo đúng: ${TRUNG_LAP._cach_do_dung}`);
}

/*
 * `--write-tiers` CHỈ DỰNG KHUNG KHI FILE CHƯA CÓ, và TỪ CHỐI ghi đè khối `T0` do người viết.
 *
 * LƯỢT ĐẦU CỦA CỜ NÀY ĐÃ GHI ĐÈ VÀ XOÁ SẠCH KHỐI T0. Nó ghi ra bản suy từ từ khoá cho cả 98 máy, và
 * 12 dòng T0 khai tay — mỗi dòng một câu giải thích vì sao máy đó không thương lượng — biến mất không
 * một lời cảnh báo. Nếu không ai kiểm lại ngay thì bảng phân tầng mất cả phần quan trọng nhất của nó.
 *
 * Đây là đúng họ lỗi mà kit này đi sửa ở chỗ khác: một bước SINH LẠI đè mất thứ NGƯỜI đã nhập. Ngày
 * 08/10/2026 nó làm mất 129 ô kết quả trong Excel, và `ledger:check` tồn tại vì chuyện đó.
 *
 * Nên: có file rồi thì ghi ra `<file>.suggested.json` cạnh bên và nói rõ chênh lệch. Người gộp, không
 * phải máy gộp.
 */
function ghiTiers(ra) {
  const tiers = {
    _sinh_boi: 'node scripts/qa/gate_audit.js --write-tiers',
    _trang_thai: 'NHÁP — chờ người duyệt. `gate_engine` chỉ được đọc file này sau khi trạng thái đổi thành "đã duyệt".',
    _luat: {
      T0: 'Không thương lượng. Luôn exit 1 ở MỌI ngữ cảnh. Không có cờ override nào.',
      T1: 'Chặn ở cửa ra (exit, ci). Ở write và phase thì cảnh báo cộng ghi sổ nợ.',
      T2: 'Không bao giờ exit 1.',
    },
    _mac_dinh: 'Gate chưa có mặt trong khối `T0` thì mặc định T1 nếu nó có đường exit 1, T2 nếu không.',
    _gioi_han:
      'Khối `gate` dưới đây là bản SUY TỪ TỪ KHOÁ, chỉ để tham khảo. Nguồn sự thật của tầng là khối '
      + '`T0` do NGƯỜI viết — suy từ từ khoá đã được đo là không dùng được (xem `_vi_sao_khai_tay_chu_khong_suy`).',
    _non_negotiable: NON_NEGOTIABLE,
    gate: Object.fromEntries(ra.gate.map((r) => [r.npm[0], {
      tang: r.tang, do_tin: r.do_tin, vi_sao: r.vi_sao, non_negotiable: r.non_negotiable,
      file: r.file, thoi_diem: r.thoi_diem,
    }])),
  };

  const dangCo = docTiers();
  const coT0KhaiTay = dangCo && dangCo.T0 && Object.keys(dangCo.T0).length > 0;
  if (coT0KhaiTay) {
    const ben = TIERS_OUT.replace(/\.json$/, '.suggested.json');
    fs.writeFileSync(ben, `${JSON.stringify(tiers, null, 2)}\n`, 'utf8');
    const khaiTay = new Set(Object.keys(dangCo.T0));
    const goiYThem = ra.ung_vien_T0_chua_khai.length;
    console.log(`\n[gate-audit] TỪ CHỐI ghi đè .agent/config/gate_tiers.json — file đó có ${khaiTay.size} dòng T0 do NGƯỜI viết.`);
    console.log(`             Đã ghi bản gợi ý ra ${path.basename(ben)} để đối chiếu. Người gộp, không phải máy gộp.`);
    console.log(`             Chênh lệch cần rà: ${goiYThem} ứng viên T0 do từ khoá gợi ý mà chưa khai tay.`);
    return;
  }
  fs.writeFileSync(TIERS_OUT, `${JSON.stringify(tiers, null, 2)}\n`, 'utf8');
  console.log(`\n[gate-audit] đã dựng KHUNG .agent/config/gate_tiers.json — ${ra.gate.length} máy.`);
  console.log('             Khối `T0` còn RỖNG: tầng T0 phải do người khai, máy không suy được (đã đo).');
}

function main() {
  let ra;
  try {
    ra = kiemKe();
  } catch (e) {
    console.error(`[gate-audit] ✗ không kiểm kê được: ${e.message}`);
    process.exit(2);
  }
  if (JSON_OUT) { console.log(JSON.stringify(ra, null, 2)); return; }
  inRa(ra);
  if (WRITE_TIERS) ghiTiers(ra);
}

if (require.main === module) main();

module.exports = {
  kiemKe, thoiDiemCua, tangCua, goiYTuTuKhoa, docTiers, lichSu, capDoiChung, headerCua,
  THOI_DIEM, TU_BAO_OAN, NON_NEGOTIABLE, TRUNG_LAP, DAU_HIEU_T0, DAU_HIEU_T1,
};
