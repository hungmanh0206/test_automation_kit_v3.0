#!/usr/bin/env node
/**
 * `skills:route:live` — ĐO ĐỊNH TUYẾN SKILL BẰNG CHÍNH MODEL, không bằng đếm từ.
 *
 * Dùng: node scripts/qa/skills_route_live.js [--gioi-han N] [--song-song N] [--ra <file.md>]
 *   exit 0 = đạt · 1 = dưới ngưỡng · 2 = KHÔNG PHÁN ĐƯỢC (thiếu `claude` hoặc fixture)
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * VÌ SAO CẦN MÁY NÀY, KHI ĐÃ CÓ `skills:route:check`
 *
 * Máy kia chấm bằng TỪ NGỮ: tách `description` + "Câu kích hoạt mẫu" thành túi từ rồi tính idf. Nó
 * tự khai giới hạn ngay trong đầu ra của mình — "nó KHÔNG chứng minh model sẽ chọn đúng".
 *
 * Giới hạn ấy không phải lý thuyết. Đo 04/11/2026: câu "soak test nửa tiếng" bị bộ chấm từ ngữ xếp
 * DƯỚI SÀN (3,57 điểm, không đủ tự tin để chọn ai), trong khi model thật gọi thẳng `load_check` ngay
 * lượt đầu. Tức thước đại diện ĐO HỤT, và nếu chỉ có nó thì người ta sẽ đi sửa `description` cho vừa
 * một bag-of-words — làm mô tả tệ đi cho model thật để một con số đại diện đẹp lên.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * CÁCH ĐO
 *
 * Mỗi câu chạy một phiên `claude -p` trong một THƯ MỤC FIXTURE chỉ chứa `.claude/skills`. Cố ý KHÔNG
 * chép `.claude/settings.json`, nên hook SessionStart KHÔNG chạy: ta muốn biết harness định tuyến
 * được tới đâu CHỈ bằng mô tả skill, không nhờ hook nhắc tên. Đó cũng đúng trạng thái sau khi mục 3.2
 * gỡ danh sách tên skill khỏi hook.
 *
 * Skill được chọn đọc từ lời gọi công cụ `Skill` đầu tiên trong stream — KHÔNG đọc từ lời model tự
 * thuật. Model nói "tôi sẽ dùng X" mà không gọi X là một lời khai, không phải một phép đo.
 *
 * KHÔNG VÀO CI: mỗi lượt là một phiên model thật, tốn tiền của người chạy. Chạy tay trước mỗi bản
 * phát hành, kết quả ghi vào docs/<phiên bản>/ROUTE_LIVE.md kèm NGÀY và PHIÊN BẢN MODEL — một con số
 * định tuyến không kèm phiên bản model thì năm sau không ai đọc được nó nói về cái gì.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'skills_route.json');

const co = (ten, macDinh) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : macDinh;
};

/*
 * `--lan N` — CHẠY LẠI N LƯỢT, vì quyết định "có gọi skill không" của model là NGẪU NHIÊN.
 *
 * Bản đầu chạy đúng một lượt rồi in một con số, và con số đó trông y hệt một phép đo. Đo 05/11/2026
 * cho thấy nó không phải:
 *
 *   lượt A (trước khi rút mô tả) ... top-1 50,0%
 *   lượt B (sau khi rút mô tả) .... top-1 32,9%
 *
 * Nhìn hai số ấy thì kết luận hiển nhiên là "rút mô tả làm hỏng định tuyến". Nhưng so từng câu giữa
 * hai lượt: 17 ca hỏng đi, và **8 trong số đó thuộc skill KHÔNG hề bị sửa** giữa hai lượt. Thêm 5 ca
 * khá lên, trong đó có cả skill vừa bị rút. Tức phần lớn chênh lệch là DAO ĐỘNG GIỮA HAI LƯỢT.
 *
 * ĐÍNH CHÍNH 05/11/2026: hai lượt A/B ở trên chạy 3 LUỒNG, và phần lớn chênh lệch của chúng là do
 * throttle bị đếm thành "không gọi skill" — xem khối mặc định --song-song. Nhưng kết luận của khối này
 * vẫn đứng: đo lại TUẦN TỰ thì hai lượt của CÙNG một trạng thái vẫn lệch 8,8 điểm (64,7% và 73,5%).
 *
 * Một lượt so một lượt KHÔNG phân biệt được "bản vá làm hỏng" với "hôm nay bốc phải lượt thấp". Nên
 * mặc định nay là 2 lượt, và báo cáo in CẢ dải (thấp nhất–cao nhất) chứ không chỉ trung bình: một con
 * số đơn lẻ giấu mất chính thông tin cần để đọc nó.
 */
const LAN = Math.max(1, Number(co('lan', '2')));
const GIOI_HAN = Number(co('gioi-han', '0')) || 0;
/*
 * MẶC ĐỊNH 1 LUỒNG — đổi từ 2 xuống 1 ngày 05/11/2026, và đây là lý do.
 *
 * Bốn lượt quét 90 câu chạy ở 3 luồng cho 38,6% / 24,3% / 50,0% / 32,9% / 2,9%. Lượt 2,9% có 68/70
 * ca 'không gọi skill' — một con số không nói gì về định tuyến. Chạy lại 6 câu ở MỘT luồng ngay sau
 * đó: 5/5 đúng, 0 lượt hỏng, 0 ca không gọi.
 *
 * Nhiều phiên model song song bị throttle, và bản đầu của cửa đếm lượt bị throttle THÀNH 'không gọi
 * skill'. Tức song song vừa làm hỏng phép đo, vừa làm nó hỏng theo cách trông giống một kết quả.
 * Ai muốn chạy nhanh hơn thì tự khai --song-song, và đọc ô 'KHÔNG CHẠY ĐƯỢC' trước khi tin con số.
 */
const SONG_SONG = Math.max(1, Number(co('song-song', '1')));
const RA = co('ra', null);
const NGUONG_TOP1 = Number(co('nguong', '0.90'));
const TRAN_NONE = Number(co('tran-none', '0.10'));

function thoat2(msg, them) {
  console.log(`[route-live] KHÔNG PHÁN ĐƯỢC — ${msg}`);
  if (them) console.log(`             ${them}`);
  process.exit(2);
}

/* ── tiền đề ────────────────────────────────────────────────────────────────────────────────── */

let phienBan = null;
try {
  /* `shell: true` BẮT BUỘC trên Windows: `claude` ở đó là shim .cmd, execFile thuần không chạy nổi.
   * Thiếu cờ này thì máy trả "KHÔNG PHÁN ĐƯỢC — không gọi được claude" ngay cả khi CLI có thật. */
  phienBan = execFileSync('claude', ['--version'], { timeout: 30000, shell: process.platform === 'win32' }).toString().trim();
} catch (e) {
  thoat2('không gọi được `claude` CLI.', 'Máy này CẦN model thật; không có CLI thì nó im, không đoán.');
}
if (!fs.existsSync(FIXTURE)) thoat2(`không thấy fixture ${path.relative(REPO, FIXTURE)}.`);
if (!fs.existsSync(path.join(REPO, '.claude', 'skills'))) thoat2('không thấy .claude/skills/.');

const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
let CA = fx.ca.slice();
if (GIOI_HAN > 0) {
  /*
   * `--gioi-han` LÀ MẪU, KHÔNG PHẢI PHÉP ĐO. Nó giữ đúng tỉ lệ ca thật / ca `none` của bộ đầy đủ, nên
   * tỉ lệ `none` không bị méo. Nhưng nó KHÔNG đại diện về ĐỘ KHÓ: lấy cách quãng thì rơi vào câu nào
   * là tình cờ.
   *
   * Đo 04/11/2026, và tôi đã giẫm đúng vào đây: bộ 20 câu lấy cách quãng cho 75% trong khi bộ 90 câu
   * đầy đủ cho 38,6%. Tôi mang hai con số đó so với nhau rồi kết luận "ngữ cảnh làm nên khác biệt" —
   * một kết luận nhân quả rút từ HAI MẪU SỐ KHÁC NHAU. Đối chứng cùng mẫu bác nó ngay: 20 câu ấy chạy
   * ở repo thật ra 68,8%, tức thấp hơn, không cao hơn.
   *
   * Nên cửa in ra lời nhắc này mỗi lượt có `--gioi-han`, và dòng nhắc đi vào CẢ báo cáo .md: một con
   * số lấy từ mẫu mà không mang nhãn "mẫu" thì lần sau sẽ bị đọc như số đo đầy đủ.
   */
  const that = CA.filter((x) => x.skill !== 'none');
  const none = CA.filter((x) => x.skill === 'none');
  const nThat = Math.max(1, Math.round(GIOI_HAN * (that.length / CA.length)));
  const buoc = (ds, n) => ds.filter((_, i) => i % Math.max(1, Math.floor(ds.length / n)) === 0).slice(0, n);
  CA = [...buoc(that, nThat), ...buoc(none, GIOI_HAN - nThat)];
  console.log(`[route-live] ⚠ MẪU ${CA.length}/${fx.ca.length} câu (--gioi-han). Giữ đúng tỉ lệ none, nhưng KHÔNG`);
  console.log('[route-live]   đại diện về độ khó. ĐỪNG so con số của mẫu này với con số của bộ đầy đủ,');
  console.log('[route-live]   và đừng so hai lượt khác mẫu số rồi kết luận nhân quả.');
}

/* ── fixture: chỉ `.claude/skills`, KHÔNG settings (nên không có hook) ───────────────────────── */

/*
 * `--trong-repo` — PHÉP PHÂN BIỆT, không phải một tuỳ chọn tiện lợi.
 *
 * Lượt quét đầu (04/11/2026) cho top-1 38,6%, nhưng gồm **0 ca chọn SAI** và **43 ca không gọi skill
 * nào**. Khi model có chọn thì nó chọn đúng 27/27. Con số 38,6% vì thế KHÔNG phân biệt được hai giả
 * thuyết:
 *
 *   H1 — mô tả skill không đủ kích hoạt, tức định tuyến kém.
 *   H2 — trong thư mục tạm RỖNG, không task, mọi công cụ làm việc bị chặn, model trả lời luôn những
 *        câu mang tính giảng giải vì KHÔNG CẦN mở skill. Tỉ lệ gọi là tính chất của NGỮ CẢNH.
 *
 * Chạy cùng bộ câu ở gốc repo thật tách được hai cái: nếu tỉ lệ gọi nhảy lên thì H2, nếu giữ nguyên
 * thì H1. Không có phép này thì 38,6% chỉ là một con số trông như kết quả.
 *
 * LƯU Ý: ở gốc repo thì hook SessionStart CÓ chạy, nên lượt đó đo "mô tả + hook" chứ không chỉ mô tả.
 * Đó chính là điều cần biết: hook có đang gánh phần định tuyến hay không — câu hỏi mà mục 3.2 phải
 * trả lời trước khi gỡ danh sách skill khỏi hook.
 */
const TRONG_REPO = process.argv.includes('--trong-repo');
let goc;
if (TRONG_REPO) {
  goc = REPO;
} else {
  goc = fs.mkdtempSync(path.join(os.tmpdir(), 'routelive-'));
  fs.mkdirSync(path.join(goc, '.claude'), { recursive: true });
  fs.cpSync(path.join(REPO, '.claude', 'skills'), path.join(goc, '.claude', 'skills'), { recursive: true });
}

/*
 * CHẶN CÔNG CỤ DÒ DẪM, ĐỂ PHÉP ĐO ĐO ĐÚNG THỨ NÓ ĐỊNH ĐO.
 *
 * Đo 04/11/2026, ba điều phải biết trước khi tin con số của máy này:
 *
 * ① `--allowed-tools Skill` KHÔNG giới hạn gì. Lượt init vẫn khai đủ bộ công cụ, và model đi
 *    `PowerShell`/`Bash` dò thư mục tạm rỗng rồi hết lượt. Kết quả: "không gọi skill nào" — trông y
 *    hệt một lượt định tuyến kém, trong khi model chưa hề được hỏi đúng câu hỏi. Phải dùng
 *    `--disallowed-tools`. Đổi sang nó thì cùng câu ấy ra `Skill → perf_check` ngay lượt đầu, 8 giây.
 *
 * ② `stdio` phải chặn stdin. Để mặc thì tiến trình con in "no stdin data received in 3s" và CHỜ 3
 *    giây mỗi lượt — 90 câu là mất gần 5 phút chỉ để chờ một thứ không bao giờ tới.
 *
 * ③ Trên Windows phải TỰ BỌC NHÁY (xem khối trong `mot`), nếu không câu tiếng Việt vỡ thành nhiều
 *    tham số và model nhận prompt rác.
 *
 * Cả ba đều cho cùng một triệu chứng: "model không gọi skill nào". Ba nguyên nhân khác hẳn nhau, và
 * không cái nào là lỗi định tuyến. Một phép đo hỏng trả về thứ trông như một kết quả.
 */
const CAM_CONG_CU = 'Bash,PowerShell,Read,Glob,Grep,Task,Edit,Write,NotebookEdit,WebFetch,WebSearch,Monitor,Artifact,ToolSearch';

function mot(cau) {
  return new Promise((ok) => {
    const t0 = Date.now();
    /*
     * TỰ BỌC NHÁY KHI DÙNG SHELL. Trên Windows `claude` là shim .cmd nên phải qua shell, mà với
     * `shell: true` thì Node NỐI mảng tham số lại KHÔNG escape (chính nó cảnh báo DEP0190). Câu hỏi
     * tiếng Việt có dấu cách sẽ vỡ thành nhiều tham số, model nhận prompt rác và không gọi skill nào.
     *
     * Lượt hiệu chuẩn đầu tiên ra 0/6 vì đúng lỗi này — và "không gọi skill nào" trông y hệt một lượt
     * định tuyến kém. Một phép đo hỏng trả về thứ trông như một kết quả.
     */
    const dungShell = process.platform === 'win32';
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const args = ['-p', cau, '--output-format', 'stream-json', '--disallowed-tools', CAM_CONG_CU, '--max-turns', '2', '--verbose'];
    const tuyChon = { cwd: goc, stdio: ['ignore', 'pipe', 'pipe'] };
    const p = dungShell
      ? spawn(['claude', ...args.map(q)].join(' '), { ...tuyChon, shell: true })
      : spawn('claude', args, tuyChon);

    let buf = '';
    let chon = null;
    /*
     * PHẢI PHÂN BIỆT "MODEL KHÔNG GỌI" VỚI "LƯỢT CHẠY HỎNG" — thêm 05/11/2026 sau khi bản đầu trộn
     * hai thứ đó và làm BỐN lượt quét trở nên vô nghĩa.
     *
     * Bản đầu gán `chon = 'none'` cho mọi lượt không thấy lời gọi `Skill`, bất kể vì sao. Bốn lượt
     * quét ra 38,6% → 24,3% → 50,0% → 32,9% → 2,9%, và lượt 2,9% có 68/70 "không gọi" — con số ấy
     * không nói về định tuyến, nó nói rằng các lượt con đã hỏng. Chạy lại MỘT lượt ngay sau đó thì
     * model gọi đúng `load_check`, rate limit `allowed_warning` ở 29%.
     *
     * Đây đúng lớp hỏng cả kit đi chữa, lần này nằm trong dụng cụ của chính tôi: một lượt KHÔNG đo
     * được trả về thứ trông như một kết quả. Nên nay đọc `result.subtype` và cờ `is_error`, rồi tách
     * ra ô `KHÔNG ĐO ĐƯỢC` — ô đó KHÔNG được tính vào mẫu số của tỉ lệ.
     */
    let ketCuc = null;
    let coLoi = false;
    p.stdout.on('data', (d) => {
      buf += String(d);
      const dong = buf.split('\n');
      buf = dong.pop() || '';
      for (const l of dong) {
        if (chon || !l.trim()) continue;
        let j;
        try { j = JSON.parse(l); } catch (e) { continue; }
        if (j.type === 'result') { ketCuc = String(j.subtype || 'success'); if (j.is_error) coLoi = true; }
        const noi = j.message && j.message.content;
        for (const b of (Array.isArray(noi) ? noi : [])) {
          /* CHỈ đọc lời GỌI công cụ. Model tự thuật "tôi sẽ dùng X" là lời khai, không phải phép đo. */
          if (!chon && b.type === 'tool_use' && b.name === 'Skill' && b.input && b.input.skill) chon = String(b.input.skill);
        }
      }
    });
    p.stderr.on('data', () => {});
    p.on('close', () => {
      /* 'success' và 'error_max_turns' đều là lượt CHẠY ĐƯỢC: max_turns chỉ nghĩa là hết lượt sau khi
       * đã có cơ hội gọi skill. Mọi subtype khác, hoặc is_error, là lượt KHÔNG ĐO ĐƯỢC. */
      const chayDuoc = !coLoi && (ketCuc === 'success' || ketCuc === 'error_max_turns');
      ok({ chon: chon || (chayDuoc ? 'none' : null), ketCuc: ketCuc || '(không có result)', giay: Math.round((Date.now() - t0) / 1000) });
    });
    p.on('error', () => ok({ chon: null, giay: Math.round((Date.now() - t0) / 1000) }));
  });
}

(async () => {
  const kq = [];
  let i = 0;
  async function chayMot() {
    while (i < CA.length) {
      const c = CA[i]; i += 1;
      const r = await mot(c.cau);
      kq.push({ cau: c.cau, mong: c.skill, ra: r.chon, giay: r.giay });
      const dau = r.chon === null ? '!' : (r.chon === c.skill ? '·' : 'x');
      process.stdout.write(dau);
    }
  }
  await Promise.all(Array.from({ length: SONG_SONG }, chayMot));
  process.stdout.write('\n');

  /* KHÔNG xoá khi đo trong repo thật — goc LÀ gốc repo. */
  if (!TRONG_REPO) { try { fs.rmSync(goc, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ } }

  /*
   * LƯỢT HỎNG KHÔNG ĐƯỢC VÀO MẪU SỐ. Tính chúng như "không gọi skill" là trộn một lỗi hạ tầng vào một
   * phép đo chất lượng — và đó chính là cách bản đầu sinh ra con số 2,9% (68/70 "không gọi") mà ngay
   * sau đó một lượt đơn lẻ vẫn gọi đúng `load_check`.
   *
   * Trần 10% đặt thấp có chủ ý: trên mức đó thì con số còn lại không đủ để nói gì, và cửa phải IM chứ
   * không phán. `thoat2` trả exit 2 "KHÔNG PHÁN ĐƯỢC".
   */
  const hong = kq.filter((x) => x.ra === null);
  if (hong.length) {
    const theoKetCuc = {};
    for (const h of hong) theoKetCuc[h.ketCuc] = (theoKetCuc[h.ketCuc] || 0) + 1;
    console.log(`[route-live] ⚠ ${hong.length}/${kq.length} lượt KHÔNG CHẠY ĐƯỢC — loại khỏi mẫu số: ${JSON.stringify(theoKetCuc)}`);
  }
  if (hong.length > kq.length * 0.1) {
    thoat2(
      `${hong.length}/${kq.length} lượt KHÔNG chạy được (quá 10%).`,
      'Con số còn lại không đủ để nói gì về định tuyến. Kiểm rate limit, rồi chạy lại với --song-song 1.',
    );
  }

  /* Chỉ lượt CHẠY ĐƯỢC mới vào thống kê. */
  const dungDuoc = kq.filter((x) => x.ra !== null);
  const that = dungDuoc.filter((x) => x.mong !== 'none');
  const none = dungDuoc.filter((x) => x.mong === 'none');
  const dung = that.filter((x) => x.ra === x.mong);
  const sai = that.filter((x) => x.ra !== x.mong && x.ra !== 'none');
  const khongGoi = that.filter((x) => x.ra === 'none');
  const noneNham = none.filter((x) => x.ra !== 'none');

  const tiLe = that.length ? dung.length / that.length : 0;
  const tiLeNone = none.length ? noneNham.length / none.length : 0;

  /* Cặp dễ nhầm: chỉ tính khi top-1 rơi vào MỘT THÀNH VIÊN KHÁC của chính cặp đó. */
  const capLoi = [];
  for (const cap of (fx.cap_de_nham || [])) {
    const x = that.filter((r) => cap.includes(r.mong) && r.ra !== r.mong && cap.includes(r.ra));
    if (x.length) capLoi.push({ cap, sai: x });
  }

  console.log(`[route-live] model ${phienBan} · ${kq.length} câu · ${SONG_SONG} luồng`);
  console.log(`[route-live] top-1 ${dung.length}/${that.length} = ${(tiLe * 100).toFixed(1)}% (ngưỡng ${(NGUONG_TOP1 * 100).toFixed(0)}%)`);
  console.log(`[route-live] ca "none": ${noneNham.length}/${none.length} kích hoạt nhầm = ${none.length ? (tiLeNone * 100).toFixed(0) : 'n/a'}% (trần ${(TRAN_NONE * 100).toFixed(0)}%)`);
  console.log(`[route-live] ca thật KHÔNG gọi skill nào: ${khongGoi.length}/${that.length}`);
  console.log(`[route-live] lẫn trong cặp dễ nhầm: ${capLoi.length} cặp`);
  for (const x of sai) console.log(`  ✗ "${x.cau}" → ${x.ra} (mong ${x.mong})`);
  for (const x of khongGoi) console.log(`  ~ "${x.cau}" → KHÔNG gọi skill nào (mong ${x.mong})`);
  for (const x of noneNham) console.log(`  ✗ KHÔNG NÊN kích hoạt: "${x.cau}" → ${x.ra}`);

  if (RA) {
    const d = new Date().toISOString().slice(0, 10);
    const dong = [
      `# skills:route:live — ${d}`,
      '',
      `- model CLI: \`${phienBan}\``,
      `- số câu: **${kq.length}** (${that.length} ca thật · ${none.length} ca \`none\` được tính)`,
      /* Báo cáo PHẢI tự khai số lượt bị loại. Bản đầu ghi "số câu: 90" rồi để người đọc tự cộng
       * 68 + 19 = 87 mới thấy thiếu 3 — tức một phép đo giấu đúng thông tin cần để đọc nó. */
      ...(hong.length ? [`- ⚠ **${hong.length} lượt KHÔNG CHẠY ĐƯỢC, đã loại khỏi mẫu số**: ${JSON.stringify(hong.reduce((a, h) => { a[h.ketCuc] = (a[h.ketCuc] || 0) + 1; return a; }, {}))}`] : []),
      ...(GIOI_HAN > 0 ? [
        `- ⚠ **ĐÂY LÀ MẪU ${kq.length}/${fx.ca.length} câu** (\`--gioi-han\`). Giữ đúng tỉ lệ \`none\`, nhưng KHÔNG đại diện`,
        '  về độ khó. Đừng so con số này với con số của bộ đầy đủ, và đừng so hai lượt khác mẫu số rồi',
        '  kết luận nhân quả — chính tôi đã làm thế một lần ngày 04/11/2026 và phải rút lại.',
      ] : []),
      `- ngữ cảnh chạy: **${TRONG_REPO ? 'gốc repo thật (hook SessionStart CÓ chạy)' : 'thư mục tạm chỉ có .claude/skills (KHÔNG hook)'}**`,
      `- top-1: **${dung.length}/${that.length} = ${(tiLe * 100).toFixed(1)}%** (ngưỡng ${(NGUONG_TOP1 * 100).toFixed(0)}%)`,
      `- \`none\` kích hoạt nhầm: **${noneNham.length}/${none.length}** (trần ${(TRAN_NONE * 100).toFixed(0)}%)`,
      `- ca thật không gọi skill nào: **${khongGoi.length}**`,
      `- lẫn trong cặp dễ nhầm: **${capLoi.length}**`,
      `- tổng thời gian máy: ~${kq.reduce((a, x) => a + x.giay, 0)} giây-CPU trên ${SONG_SONG} luồng`,
      '',
      /*
       * KHỐI NÀY TỪNG BỊ GHI CỨNG, và nó đã nói SAI về chính lượt sinh ra nó: bản 04/11/2026 của
       * ROUTE_LIVE_REPO.md khai "đo trong thư mục fixture, không có settings.json" trong khi lượt đó
       * chạy `--trong-repo`. Một báo cáo mô tả sai điều kiện tạo ra nó thì tệ hơn không có báo cáo —
       * người đọc sau sẽ so hai con số sinh ra trong hai ngữ cảnh khác nhau mà tưởng là một.
       */
      ...(TRONG_REPO ? [
        '> Đo ở **GỐC REPO THẬT**, nên hook SessionStart CÓ chạy và `CLAUDE.md` có được nạp. Tức con số',
        '> này đo "mô tả skill + hook + ngữ cảnh repo", KHÔNG phải riêng mô tả skill.',
      ] : [
        '> Đo trong thư mục tạm chỉ có `.claude/skills`, KHÔNG có `settings.json` nên hook SessionStart',
        '> không chạy. Tức con số này nói: harness định tuyến được tới đâu CHỈ bằng `description` của skill.',
      ]),
      '>',
      '> Skill được chọn đọc từ lời GỌI công cụ `Skill`, không đọc từ lời model tự thuật.',
      '> Công cụ làm việc (`Bash`, `Read`, `Glob`…) bị chặn, nên model không thể đi dò thay vì định tuyến.',
      '',
      '| câu | mong | model gọi |',
      '|---|---|---|',
      ...kq.map((x) => `| ${x.cau} | ${x.mong} | ${x.ra === x.mong ? '✓ ' : '**✗** '}${x.ra} |`),
    ];
    fs.mkdirSync(path.dirname(path.join(REPO, RA)), { recursive: true });
    fs.writeFileSync(path.join(REPO, RA), dong.join('\n') + '\n', 'utf8');
    console.log(`[route-live] đã ghi ${RA}`);
  }

  const dat = tiLe >= NGUONG_TOP1 && tiLeNone <= TRAN_NONE && capLoi.length === 0;
  console.log(dat ? '[route-live] ✓ ĐẠT' : '[route-live] ✗ DƯỚI NGƯỠNG');
  process.exitCode = dat ? 0 : 1;
})();
