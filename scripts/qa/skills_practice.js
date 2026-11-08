#!/usr/bin/env node
/**
 * `skills:practice` — ĐỌC MỘT SKILL XONG CÓ LÀM RA ĐƯỢC SẢN PHẨM KHÔNG.
 *
 * Dùng: node scripts/qa/skills_practice.js [--bai <mã>] [--lan N] [--ra <file.md>] [--gia]
 *   exit 0 = đạt · 1 = dưới ngưỡng · 2 = KHÔNG PHÁN ĐƯỢC
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * VÌ SAO CÓ MÁY NÀY, VÀ VÌ SAO NÓ KHÁC MỌI CỬA KHÁC CỦA KIT
 *
 * `skills:lint` chấm mô tả có ĐỦ THÔNG TIN ĐỂ CHỌN. `skills:template:check` chấm mẫu có THẬT và có
 * QUA MÁY. Cả hai đo TÀI LIỆU. Không cửa nào trả lời được câu cuối cùng: **đọc skill xong có làm ra
 * được sản phẩm qua được gate không**.
 *
 * Máy này trả lời bằng cách cho model thật làm bài, mỗi bài chỉ đọc ĐÚNG MỘT skill. Thư mục fixture
 * cố ý KHÔNG có `prompt_templates/`, nên model không thể mở prompt phase để lấy thêm hướng dẫn — nếu
 * nó làm được, đó là nhờ skill, không nhờ thứ khác.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * MỖI BÀI CHẠY NHIỀU LƯỢT, và đó không phải sự thận trọng dư.
 *
 * Đo 05/11/2026 với `skills:route:live`: hai lượt của CÙNG một trạng thái lệch nhau 8,8 điểm. Một
 * lượt rồi phán là không phân biệt được "skill mỏng" với "hôm nay bốc phải lượt thấp". Mặc định 3
 * lượt, đạt khi >= 2/3 — đúng ngưỡng mục 1.4 đặt ra.
 *
 * LƯỢT KHÔNG CHẠY ĐƯỢC KHÔNG TÍNH LÀ TRƯỢT. Đọc `result.subtype` và `is_error`; lượt hỏng bị loại ra
 * khỏi mẫu số và báo riêng. Bản đầu của `skills_route_live.js` trộn hai thứ đó và làm năm lượt quét
 * 90 câu trở nên vô nghĩa — không lặp lại ở đây.
 *
 * KHÔNG VÀO CI: mỗi lượt là một phiên model thật, tốn tiền của người chạy. Cờ `--gia` chạy ĐÚNG MỘT
 * lượt và chỉ in chi phí, để đo giá trước khi quyết chạy cả bộ.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'practice');
/* Cửa THẬT của kit, không phải luật tôi tự đặt: `lintBugHeadings` là thứ `output_gate` dùng để chặn
 * description bug khác 4 mục. Gọi đúng nó thì bài này thành phép đo "qua được cửa", không còn là
 * "giống cái tôi hình dung". */
const { lintBugHeadings } = require(path.join(REPO, 'scripts', 'qa', 'lib', 'output_rules.js'));

const co = (ten, macDinh) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : macDinh;
};
const flag = (n) => process.argv.includes(`--${n}`);

const GIA = flag('gia');
const LAN = GIA ? 1 : Math.max(1, Number(co('lan', '3')));
const CHI_BAI = co('bai', null);
const RA = co('ra', null);
/* Lưu CÂU TRẢ LỜI thô. Không có nó thì khi một bài trượt, không phân biệt được 'skill mỏng'
 * với 'bộ chấm của tôi khắt khe' — và kết luận sai ở đây sẽ dẫn tới sửa nhầm skill. */
const LUU = co('luu', null);

/* ── Bộ bài ────────────────────────────────────────────────────────────────────────────────────
 *
 * Mỗi bài khai: skill DUY NHẤT được đọc, đề bài, và cách chấm. `cham` nhận câu trả lời của model rồi
 * trả `{ dat, chiTiet }` — chấm bằng máy, không bằng cách đọc rồi cảm thấy.
 */
/*
 * HAI KIỂU CHẤM, và khác nhau về SỨC.
 *
 *   ① Chấm bằng ĐÁP ÁN NỘI DUNG — `review-5-loi` và `doc-ket-qua`. Có một câu trả lời đúng khách quan
 *      (lỗi nào ở dòng nào · ca nào thuộc tầng nào), nên phép đo mạnh.
 *   ② Chấm bằng LUẬT HÌNH THỨC — ba bài còn lại, nơi sản phẩm là một văn bản. Luật ở
 *      `hinh_thuc.dapan.json`, mỗi luật neo vào NỘI DUNG của đề (mã nhân sự, số mục §, giới hạn ký tự)
 *      chứ KHÔNG neo vào từ vựng của skill — neo vào từ vựng thì model chỉ cần nhắc lại skill là đạt.
 *
 * GIỚI HẠN PHẢI KHAI: kiểu ② trả lời *"sản phẩm có theo đúng luật skill dạy"*, KHÔNG phải *"sản phẩm qua
 * được gate"*. `bug:claim`, `gate:output`, `data:chain:check` đều đọc THƯ MỤC OUTPUT của task chứ không
 * nhận file lẻ; dựng một task giả để gọi chúng thì phép đo đo cái tôi dựng, không đo sản phẩm.
 */
const HINH_THUC = () => JSON.parse(fs.readFileSync(path.join(FIXTURE, 'hinh_thuc.dapan.json'), 'utf8'));

/** Gom N phép kiểm thành verdict theo ngưỡng ĐÃ KHAI trong đáp án (không phải ngưỡng chọn sau khi đo). */
function gom(ten, ket) {
  const cfg = HINH_THUC()[ten];
  if (!cfg) throw new Error(`hinh_thuc.dapan.json thiếu mục "${ten}"`);
  if (cfg.kiem.length !== ket.length) {
    throw new Error(`"${ten}": đáp án khai ${cfg.kiem.length} phép kiểm, bộ chấm chạy ${ket.length} — một bên đã trôi`);
  }
  const dat = ket.filter((x) => x.ok).length;
  const truot = ket.filter((x) => !x.ok).map((x) => x.ma);
  return {
    dat: dat >= cfg.nguong,
    chiTiet: `${dat}/${ket.length} phép kiểm (ngưỡng ${cfg.nguong})${truot.length ? ` · trượt ${truot.join(', ')}` : ''}`,
  };
}

/**
 * Bóc SẢN PHẨM ra khỏi câu trả lời: khối ``` lớn nhất nếu có, không thì cả câu trả lời.
 *
 * VÌ SAO BẮT BUỘC — lỗi thật của bản đầu, đo 07/11/2026: bài `bug-than-backlog` trượt 3/3 lượt, và hai
 * trong các phép kiểm trượt vì chấm chữ ở phần model VIẾT QUANH sản phẩm. Model ghi hẳn *"đã cố tình để
 * NGOÀI thân bug: năm giả thuyết đối thủ…"* — tức nó làm ĐÚNG — rồi bị chính câu đó đánh trượt. Chấm cả
 * câu trả lời là chấm sai đối tượng.
 */
function sanPham(traLoi) {
  const khoi = [...String(traLoi).matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (!khoi.length) return String(traLoi);
  return khoi.sort((a, b) => b.length - a.length)[0];
}

/**
 * Tách tiêu đề mục của một description bug viết dạng văn bản.
 *
 * LUẬT ĐỌC, viết ra vì nó là phần XẤP XỈ của phép đo: cửa thật `lintBugHeadings` nhận mảng heading do
 * `buildBugDescription` dựng theo cấu trúc; ở đây đề bài là văn bản nên phải đoán ranh giới mục. Dòng
 * được coi là tiêu đề khi: <= 40 ký tự · không mở đầu bằng `-`, `*` hay `<số>.` · không chứa nháy
 * ngược · dòng ngay sau KHÔNG rỗng · và không phải dòng marker `TC:`/`Tầng:`.
 */
function tachMuc(than) {
  const d = String(than).split(/\r?\n/);
  const ra = [];
  for (let i = 0; i < d.length; i += 1) {
    const tho = d[i];
    const l = tho.trim();
    if (!l || l.length > 40) continue;
    /*
     * HAI LUẬT NÀY LÀ BẢN VÁ MỘT LỖI THẬT CỦA CHÍNH BỘ TÁCH, đo 07/11/2026.
     *
     * Bản đầu chỉ `trim()` rồi xét, nên nó vớ dòng `   (PASS - step3-truoc-khi-ghi.png)` — một dòng
     * NỐI TIẾP của bước 3, thụt lề — làm "mục thứ 5". Cửa thật `lintBugHeadings` nhận đầu vào rác đó
     * rồi phán "description có 5 phần", và bài này trượt 3/3 lượt trong khi thân bug có ĐÚNG 4 mục.
     * Một cửa thật ăn đầu vào sai thì kết luận của nó sai y như một cửa tự bịa.
     *
     * Luật: tiêu đề mục của một description văn bản nằm ở CỘT 0, và mở đầu một đoạn (dòng trước rỗng
     * hoặc nó là dòng đầu).
     */
    if (/^\s/.test(tho)) continue;
    if (i > 0 && (d[i - 1] || '').trim()) continue;
    if (/^([-*(]|\d+[.)])/.test(l)) continue;
    if (l.includes('`')) continue;
    if (/^(TC|Tầng)\s*:/i.test(l)) continue;
    if (!(d[i + 1] || '').trim()) continue;
    ra.push(l.replace(/[:.]$/, '').trim());
  }
  return ra;
}

const CHI_DAN = 'Chỉ đọc skill trong `.claude/skills/` của thư mục này, đừng tìm tài liệu khác.';

const BAI = [
  {
    ma: 'review-5-loi',
    skill: 'automation_reviewer',
    /* Đề bài nằm ở `.de.txt` để Playwright KHÔNG thu nó làm test; trong thư mục làm bài nó mang lại
     * tên `.spec.ts` để model thấy đúng thứ nó phải review. */
    tep: [{ tu: 'spec_5_loi.de.txt', thanh: 'spec_5_loi.spec.ts' }],
    de: `Review file \`spec_5_loi.spec.ts\` trong thư mục này. Nêu TỪNG lỗi kèm số dòng. ${CHI_DAN}`,
    cham(traLoi) {
      const dapAn = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'spec_5_loi.dapan.json'), 'utf8'));
      const t = traLoi.toLowerCase();
      const soDong = new Set((traLoi.match(/\b\d{1,3}\b/g) || []).map(Number));
      const tim = [];
      for (const l of dapAn.loi) {
        const coTu = l.tu_khoa.some((k) => t.includes(String(k).toLowerCase()));
        const coDong = l.dong.some((d) => soDong.has(d));
        if (coTu && coDong) tim.push(l.ma);
      }
      return { dat: tim.length >= 4, chiTiet: `${tim.length}/5 lỗi có cả từ khoá VÀ số dòng: ${tim.join(', ') || '(không có)'}` };
    },
  },

  {
    ma: 'doc-ket-qua',
    skill: 'run_report_reader',
    /* Thư mục output của một lượt chạy thật, chép nguyên cây — đây là bài DUY NHẤT cần hình dạng thư
     * mục task, vì câu hỏi của skill là "artifact nào trả lời được câu gì". */
    tep: [{ tu: 'ket_qua.de', thanh: path.join('outputs', 'DEMO', 'tasks', 'TASK-DEMO') }],
    /*
     * ĐỀ BÀI SỬA 07/11: bản đầu hỏi chung *"nêu điều gì lượt chạy này KHÔNG trả lời được"* nhưng phép
     * kiểm lại đòi đúng một thứ — ca PASS nào thiếu ảnh ở bước quyết định. Ba lượt đo cho 0/2, 1/2, 0/2:
     * model trả lời ĐÚNG CÂU ĐƯỢC HỎI, còn phép kiểm đòi một câu khác. Chỗ phải sửa là CÂU HỎI, không
     * phải hạ phép kiểm. */
    de: 'Đọc kết quả lượt chạy ở `outputs/DEMO/tasks/TASK-DEMO/`. Với MỖI case FAIL, nói nó thuộc '
      + '`failureLayer` nào và vì sao. Rồi soát evidence của CẢ lượt chạy: case nào — kể cả case PASS — '
      + 'thiếu ảnh ở BƯỚC QUYẾT ĐỊNH? Nêu đúng mã case. ' + CHI_DAN,
    cham(traLoi) {
      const da = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'ket_qua.dapan.json'), 'utf8'));
      const TANG = ['product_bug', 'api_bug', 'setup_failure', 'script_error', 'infra', 'flaky', 'dependency', 'doc_outdated'];
      const dung = [];
      const sai = [];
      for (const m of da.tang) {
        /*
         * LUẬT ĐỌC (viết TRƯỚC khi chạy lượt nào, xem `_luat_doc` trong đáp án): tầng ĐẦU TIÊN xuất hiện
         * trong 160 ký tự sau tcId phải đúng bằng tầng kỳ vọng. Nhờ vậy một câu trả lời liệt kê CẢ danh
         * sách tầng cho mọi ca KHÔNG qua được — bản chấm chỉ cần "có chứa" thì nó qua.
         */
        let ok = false;
        for (let i = traLoi.indexOf(m.tcId); i >= 0; i = traLoi.indexOf(m.tcId, i + 1)) {
          const cua = traLoi.slice(i + m.tcId.length, i + m.tcId.length + 160);
          const thay = TANG.map((x) => ({ x, at: cua.indexOf(x) })).filter((y) => y.at >= 0).sort((a, b) => a.at - b.at);
          if (thay.length && thay[0].x === m.tang) { ok = true; break; }
        }
        (ok ? dung : sai).push(`${m.tcId}${ok ? '' : `→cần ${m.tang}`}`);
      }
      const ev = da.thieu_evidence;
      const neu = ev.tcId.filter((x) => traLoi.includes(x));
      const okEv = neu.length >= ev.can_neu_duoc;
      const diem = dung.length + (okEv ? 1 : 0);
      return {
        dat: diem >= 5,
        chiTiet: `${dung.length}/5 tầng đúng${sai.length ? ` · sai: ${sai.join(', ')}` : ''}`
          + ` · ca thiếu ảnh bước quyết định nêu được ${neu.length}/${ev.can_neu_duoc} ⇒ ${diem}/6`,
      };
    },
  },

  {
    ma: 'bug-than-backlog',
    skill: 'backlog_bug_reporter',
    tep: [{ tu: 'bug_claim.de.txt', thanh: 'claim.txt' }],
    de: 'Đọc `claim.txt`. Viết THÂN BUG để log lên Backlog cho claim đã chốt đó — chỉ phần thân, '
      + 'không cần tiêu đề. ' + CHI_DAN,
    cham(traLoi) {
      /*
       * BẢN ĐẦU CỦA BỘ CHẤM NÀY SAI, và sai theo đúng hình lặp lại của cả bản v2.10.0: tôi dựng ba
       * phép kiểm từ GIẢ ĐỊNH của mình ("tối đa 4 bước", "tối đa 3 gạch", "không được có dòng `TC:`")
       * rồi để model trượt 3/3 lượt. Đi tra nguồn thì:
       *   · KHÔNG luật nào trong `RULE_GLOBAL.md`, `core_rules.md` hay chính skill nói "4 bước / 3 gạch";
       *     hai số đó đến từ ghi chú trí nhớ của tôi, không phải từ repo.
       *   · Dòng `TC: [<tcId>]` là MARKER MÁY ĐỌC có chủ ý — `bug_reporter.js:719` ghi rõ: mất nó thì
       *     mỗi lượt rerun log thêm một bug TRÙNG, và bug đó không map được về Module.
       * Thứ máy thật gác là `lintBugHeadings`: description phải ĐÚNG 4 mục, đúng thứ tự, không mục thừa.
       * Nên bản này gọi chính cửa đó, cộng bốn luật trích được từ `RULE_GLOBAL §Giọng văn output`.
       */
      const than = sanPham(traLoi);
      const dong = than.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      const cuoi = dong[dong.length - 1] || '';
      return gom('bug-than-backlog', [
        { ma: 'C1', ok: lintBugHeadings(tachMuc(than)).length === 0 },
        { ma: 'C2', ok: /^TC\s*:\s*\[?TC_0147\]?/.test(cuoi) && !cuoi.includes('**') },
        { ma: 'C3', ok: /`NS-QA-20261107-[AB]`/.test(than) },
        { ma: 'C4', ok: !/giả thuyết|bác bằng|đối thủ/i.test(than) },
        { ma: 'C5', ok: /COUNT\s*=\s*1/i.test(than) && /3\/3/.test(than) },
      ]);
    },
  },

  {
    ma: 'du-lieu-run-id',
    skill: 'test_data_generator',
    tep: [{ tu: 'du_lieu.de.txt', thanh: 'case.txt' }],
    de: 'Đọc `case.txt`. Ra bản kế hoạch dữ liệu test cho case đó. ' + CHI_DAN,
    cham(traLoi) {
      const t = traLoi;
      const soRun = (t.match(/RUN_ID/g) || []).length;
      const dong = t.split(/\r?\n/);
      return gom('du-lieu-run-id', [
        { ma: 'D1', ok: soRun >= 2 },
        { ma: 'D2', ok: dong.some((l) => /mã lớp/i.test(l) && /RUN_ID/.test(l)) },
        { ma: 'D3', ok: /dọn|cleanup|rollback|hoàn tác|xoá sau/i.test(t) },
        { ma: 'D4', ok: /truy vết|nhận ra|lọc theo|tiền tố|prefix|NGUOI_TAO|đánh dấu/i.test(t) },
        { ma: 'D5', ok: /20 ký tự|<=\s*20|≤\s*20/i.test(t) },
      ]);
    },
  },

  {
    ma: 'dac-ta-ban-phan',
    skill: 'requirements_analyzer',
    tep: [{ tu: 'dac_ta.de.txt', thanh: 'dac-ta.txt' }],
    de: 'Đọc `dac-ta.txt`. Phân tích nó thành scope, business rule và câu hỏi còn mở cho Phase 1. '
      + CHI_DAN,
    cham(traLoi) {
      const t = traLoi;
      const cauHoi = (t.match(/\?\s*$/gm) || []).length;
      return gom('dac-ta-ban-phan', [
        { ma: 'T1', ok: /§\s*3|lưới danh sách/i.test(t) && /trắng|chưa có|chưa viết|recon|khảo sát|thiếu/i.test(t) },
        { ma: 'T2', ok: /§\s*4|phân quyền/i.test(t) && /§\s*7|luồng duyệt|duyệt/i.test(t) },
        { ma: 'T3', ok: /phòng gd/i.test(t) && /bỏ|sáp nhập|không còn|lỗi thời|đã đổi/i.test(t) },
        { ma: 'T4', ok: cauHoi >= 2 },
        { ma: 'T5', ok: !/BR-DIEMTRUONG-0*(?:0[3-9]|[1-9]\d)/i.test(t) },
      ]);
    },
  },
];

function thoat2(msg, them) {
  console.log(`[practice] KHÔNG PHÁN ĐƯỢC — ${msg}`);
  if (them) console.log(`           ${them}`);
  process.exit(2);
}

let phienBan;
try {
  phienBan = execFileSync('claude', ['--version'], { timeout: 30000, shell: process.platform === 'win32' }).toString().trim();
} catch (e) {
  thoat2('không gọi được `claude` CLI.', 'Máy này CẦN model thật; không có CLI thì nó im, không đoán.');
}
if (!fs.existsSync(FIXTURE)) thoat2(`không thấy ${path.relative(REPO, FIXTURE)}.`);

/** Thư mục làm bài: chỉ một skill + các tệp đề. KHÔNG có prompt_templates/. */
function dungGoc(bai) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), `practice-${bai.ma}-`));
  const nguon = ['phase1', 'phase2', 'shared']
    .map((g) => path.join(REPO, '.agent', 'skills', g, bai.skill))
    .find((p) => fs.existsSync(p));
  if (!nguon) thoat2(`không thấy skill \`${bai.skill}\` trong .agent/skills/.`);
  const dich = path.join(goc, '.claude', 'skills', bai.skill);
  fs.mkdirSync(dich, { recursive: true });
  fs.cpSync(nguon, dich, { recursive: true });
  for (const t of bai.tep) {
    /* Bài `doc-ket-qua` cần cả một THƯ MỤC output, nên nhận cả hai dạng — không cần cờ riêng. */
    const nguonT = path.join(FIXTURE, t.tu);
    const dichT = path.join(goc, t.thanh);
    if (!fs.existsSync(nguonT)) thoat2(`fixture không tồn tại: ${t.tu}`);
    fs.mkdirSync(path.dirname(dichT), { recursive: true });
    if (fs.statSync(nguonT).isDirectory()) fs.cpSync(nguonT, dichT, { recursive: true });
    else fs.copyFileSync(nguonT, dichT);
  }
  return goc;
}

const CAM = 'Task,Edit,Write,NotebookEdit,WebFetch,WebSearch,Monitor,Artifact,PowerShell';

function motLuot(bai, goc) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const args = ['-p', bai.de, '--output-format', 'stream-json', '--disallowed-tools', CAM, '--max-turns', '12', '--verbose'];
    const dungShell = process.platform === 'win32';
    const p = dungShell
      ? spawn(['claude', ...args.map(q)].join(' '), { cwd: goc, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('claude', args, { cwd: goc, stdio: ['ignore', 'pipe', 'pipe'] });

    let buf = '';
    let traLoi = '';
    let ketCuc = null;
    let coLoi = false;
    let token = { vao: 0, ra: 0 };
    let chiPhi = null;
    p.stdout.on('data', (d) => {
      buf += String(d);
      const dong = buf.split('\n');
      buf = dong.pop() || '';
      for (const l of dong) {
        if (!l.trim()) continue;
        let j;
        try { j = JSON.parse(l); } catch (e) { continue; }
        if (j.type === 'result') {
          ketCuc = String(j.subtype || 'success');
          if (j.is_error) coLoi = true;
          if (typeof j.total_cost_usd === 'number') chiPhi = j.total_cost_usd;
          if (j.usage) token = { vao: j.usage.input_tokens || 0, ra: j.usage.output_tokens || 0 };
          if (j.result) traLoi += String(j.result);
        }
        const noi = j.message && j.message.content;
        for (const b of (Array.isArray(noi) ? noi : [])) if (b.type === 'text') traLoi += `\n${b.text}`;
      }
    });
    p.stderr.on('data', () => {});
    p.on('close', () => {
      const chayDuoc = !coLoi && (ketCuc === 'success' || ketCuc === 'error_max_turns');
      ok({ chayDuoc, ketCuc: ketCuc || '(không có result)', traLoi, token, chiPhi, giay: Math.round((Date.now() - t0) / 1000) });
    });
    p.on('error', () => ok({ chayDuoc: false, ketCuc: '(spawn lỗi)', traLoi: '', token, chiPhi, giay: 0 }));
  });
}

(async () => {
  const ds = CHI_BAI ? BAI.filter((b) => b.ma === CHI_BAI) : BAI;
  if (!ds.length) thoat2(`không có bài nào khớp \`--bai ${CHI_BAI}\`.`, `Bài đang có: ${BAI.map((b) => b.ma).join(', ')}`);

  const soSach = [];
  for (const bai of ds) {
    const goc = dungGoc(bai);
    for (let i = 1; i <= LAN; i += 1) {
      const r = await motLuot(bai, goc);
      const cham = r.chayDuoc ? bai.cham(r.traLoi) : { dat: null, chiTiet: `LƯỢT KHÔNG CHẠY (${r.ketCuc})` };
      soSach.push({ bai: bai.ma, skill: bai.skill, lan: i, ...r, ...cham });
      if (LUU) {
        /* `path.resolve` chứ KHÔNG `path.join(REPO, …)`: join nối đường dẫn TUYỆT ĐỐI vào sau REPO và
         * ném ENOENT với một đường dẫn ghép dị dạng. Người soi câu trả lời thường lưu ra ngoài repo. */
        const p = path.resolve(REPO, LUU);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.appendFileSync(p, `
===== ${bai.ma} lượt ${i} · ${cham.chiTiet} =====
${r.traLoi}
`, "utf8");
      }
      console.log(`[practice] ${bai.ma} lượt ${i}/${LAN} · ${r.giay}s · ${r.token.vao}+${r.token.ra} token${r.chiPhi != null ? ` · $${r.chiPhi.toFixed(4)}` : ''} · ${cham.dat === null ? 'KHÔNG ĐO ĐƯỢC' : (cham.dat ? 'ĐẠT' : 'TRƯỢT')} — ${cham.chiTiet}`);
    }
    try { fs.rmSync(goc, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ }
  }

  const hong = soSach.filter((x) => x.dat === null);
  const chay = soSach.filter((x) => x.dat !== null);
  const tongGiay = soSach.reduce((a, x) => a + x.giay, 0);
  const tongToken = soSach.reduce((a, x) => a + x.token.vao + x.token.ra, 0);
  const tongTien = soSach.reduce((a, x) => a + (x.chiPhi || 0), 0);

  console.log('');
  console.log(`[practice] model ${phienBan} · ${soSach.length} lượt · ${tongGiay}s · ${tongToken} token · $${tongTien.toFixed(4)}`);
  if (hong.length) console.log(`[practice] ⚠ ${hong.length} lượt KHÔNG CHẠY ĐƯỢC, loại khỏi mẫu số`);

  if (GIA) {
    const soBai = BAI.length;
    console.log('');
    console.log('— ƯỚC CHI PHÍ CẢ BỘ, suy từ lượt vừa đo —');
    console.log(`  ${soBai} bài × 3 lượt = ${soBai * 3} lượt · ~${Math.round(tongGiay * soBai * 3 / 60)} phút · ~${tongToken * soBai * 3} token · ~$${(tongTien * soBai * 3).toFixed(2)}`);
    console.log('  Đây là ƯỚC từ MỘT lượt của MỘT bài, không phải số đo cả bộ. Bài khác đề khác, giá khác.');
    process.exit(0);
  }

  if (!chay.length) thoat2('không lượt nào chạy được.', 'Kiểm rate limit rồi chạy lại.');

  let truot = 0;
  for (const bai of ds) {
    const cua = chay.filter((x) => x.bai === bai.ma);
    const dat = cua.filter((x) => x.dat).length;
    const ok = cua.length > 0 && dat / cua.length >= 2 / 3;
    if (!ok) truot += 1;
    console.log(`[practice] ${bai.ma} (${bai.skill}): ${dat}/${cua.length} lượt đạt ⇒ ${ok ? 'ĐẠT' : 'TRƯỢT'}`);
  }

  if (RA) {
    const d = new Date().toISOString().slice(0, 10);
    const dong = [
      `# skills:practice — ${d}`, '',
      `- model CLI: \`${phienBan}\``,
      `- bài: **${ds.length}** · lượt mỗi bài: **${LAN}** · đạt khi ≥ 2/3`,
      `- tổng: ${soSach.length} lượt · ${tongGiay}s · ${tongToken} token · $${tongTien.toFixed(4)}`,
      ...(hong.length ? [`- ⚠ **${hong.length} lượt KHÔNG CHẠY ĐƯỢC**, đã loại khỏi mẫu số`] : []),
      '',
      '> Mỗi bài chỉ đọc ĐÚNG MỘT skill; thư mục làm bài KHÔNG có `prompt_templates/`, nên model không',
      '> mở được prompt phase để lấy thêm hướng dẫn. Làm được là nhờ skill, không nhờ thứ khác.',
      '>',
      '> **Giới hạn, nói thẳng:** số bài hiện tại KHÔNG phủ hết 28 skill. Bài nào trượt thì sửa SKILL,',
      '> không sửa đề.',
      '',
      '| bài | skill | lượt | kết quả | chi tiết |', '|---|---|---|---|---|',
      ...soSach.map((x) => `| ${x.bai} | ${x.skill} | ${x.lan} | ${x.dat === null ? 'KHÔNG ĐO ĐƯỢC' : (x.dat ? 'ĐẠT' : '**TRƯỢT**')} | ${x.chiTiet} |`),
    ];
    fs.mkdirSync(path.dirname(path.join(REPO, RA)), { recursive: true });
    fs.writeFileSync(path.join(REPO, RA), dong.join('\n') + '\n', 'utf8');
    console.log(`[practice] đã ghi ${RA}`);
  }

  console.log(truot === 0 ? '[practice] ✓ ĐẠT' : `[practice] ✗ ${truot}/${ds.length} bài TRƯỢT — sửa SKILL, không sửa đề.`);
  process.exitCode = truot === 0 ? 0 : 1;
})();
