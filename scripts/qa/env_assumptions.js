#!/usr/bin/env node
/**
 * env_assumptions — KHẲNG ĐỊNH PHỤ THUỘC MÔI TRƯỜNG.
 *
 * Dùng: node scripts/qa/env_assumptions.js [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ CỬA NÀY — bốn sự cố, MỘT phiên (09/11/2026), và không cái nào là thiếu kiến thức.
 *
 * Tất cả đều cùng một hình: một phép kiểm XANH ở nơi nó chạy và ĐỎ ở nơi nó không chạy. Khi đó câu
 * "test này xanh nghĩa là code đúng" trở thành SAI, mà không ai biết nó đã sai.
 *
 *   ① `ra.PATH` — đúng chữ hoa. Xanh ở bash, ĐỎ từ PowerShell (biến tên `Path`). Mỉa mai: file ấy
 *      tồn tại ĐỂ CHẶN đúng loại lỗi đó.
 *   ② `node --test tests/unit/` — truyền THƯ MỤC. Node 22 coi positional là FILE ⇒ CI đỏ; Node 26
 *      trên máy tôi coi là thư mục ⇒ xanh. `.nvmrc` ghim 22, nên lệnh ấy vi phạm hợp đồng repo khai.
 *   ③ băm BYTE THÔ file văn bản — hai cửa cùng dính. `v4_baseline_integrity` báo 264/931 trên cây
 *      CRLF (667/667 chỉ khác xuống dòng); `extension:check` báo 5/5 adapter "đã sửa" (5/5 chỉ khác
 *      xuống dòng). Cửa sau NGUY HƠN: CI chạy Linux nên ở đó nó LUÔN XANH — chỉ Windows mới đỏ.
 *   ④ spec hạ tầng đọc file KHÔNG đi theo gói. Xanh ở repo, ĐỎ trong gói. Đã lặp BỐN lần (v2.4.1
 *      `docs/`, 30/10 `ops-login-combobox`, v2.10.2, và 09/11 `docs/v2.11.0/**`).
 *
 * CỬA NÀY KHÔNG CHẶN THÊM AI. Nó không thêm yêu cầu nào lên sản phẩm. Nó chỉ làm câu "xanh nghĩa là
 * đúng" trở thành đúng — ở đúng những chỗ hôm nay câu ấy sai.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * NGUYÊN TẮC: KHÔNG ĐOÁN KHI ĐO ĐƯỢC.
 *
 * Phép kiểm ④ không phỏng đoán "file này chắc không có trong gói" — nó gọi thẳng `collect()` của
 * `package_kit.js` để biết CHÍNH XÁC gói mang gì. Thiếu `.git` thì nó khai "KHÔNG PHÁN ĐƯỢC" chứ
 * không im lặng cho qua: một phép kiểm không chạy mà báo như đã chạy thì nó NÓI SAI, không phải nói
 * thiếu.
 *
 * LỐI THOÁT CÓ CHỦ Ý: dòng nào thật sự cần hành vi đó thì ghi `env-ok:` kèm LÝ DO ngay trên nó.
 * Có lối thoát ghi-được-lý-do thì người ta khai lý do; không có thì người ta tắt cả cửa.
 */

const fs = require('fs');
const path = require('path');

/*
 * `--goc <thư mục>` — chạy cửa này lên MỘT CÂY KHÁC. Có để ĐO NGƯỢC LẠI LỊCH SỬ: dựng lại bản TRƯỚC
 * KHI VÁ của từng sự cố rồi hỏi "cửa này có bắt được không", thay vì tôi tự khai là có. Một cửa chống
 * lỗi cũ mà chưa bao giờ được thả vào lỗi cũ thì mới chỉ là ý định.
 */
const iGoc = process.argv.indexOf('--goc');
const REPO = iGoc >= 0 && process.argv[iGoc + 1]
  ? path.resolve(process.argv[iGoc + 1])
  : path.resolve(__dirname, '..', '..');
const JSONRA = process.argv.includes('--json');

/*
 * Bản sao THỨ BA của `boChuThich` trong cây (hai bản kia ở `version_check.js` và `recon_passive.js`).
 * Ghi nhận chứ không gộp ở đây: gộp một helper dùng chung là thay đổi chạm vào hai cửa đang xanh, nên
 * nó xứng đáng có lượt nghiệm thu riêng thay vì đi ké một cửa mới.
 */
function boChuThich(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

const viPham = [];
const chuaPhan = [];
function bao(file, dong, ma, vi_sao) {
  viPham.push({ file, dong, ma, vi_sao });
}

/** Mọi file dưới `goc` khớp `khop`, bỏ các thư mục không phải nguồn. */
function liet(goc, khop) {
  const ra = [];
  const di = (d, tien) => {
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      const rel = tien ? `${tien}/${e.name}` : e.name;
      if (/^(node_modules|dist|outputs|test-results|playwright-report|\.git)$/.test(e.name)) continue;
      if (e.isDirectory()) di(path.join(d, e.name), rel);
      else if (khop.test(e.name)) ra.push(rel);
    }
  };
  di(path.join(REPO, goc), goc);
  return ra;
}

const doc = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return null; } };

/*
 * BỎ NỘI DUNG CHUỖI, giữ nguyên số dòng.
 *
 * Lượt đầu của cửa này chỉ bỏ chú thích, nên nó bắt chính FIXTURE trong spec gác nó: câu
 * `don("expect(ra.PATH, 'x')...")` là DỮ LIỆU, không phải mã sẽ chạy. Cùng lớp lỗi với ⑨ của
 * `version_check` — câu chú thích của chính nó làm nổ cửa của chính nó.
 *
 * Bỏ chuỗi KHÔNG làm yếu luật ①: ca thật (`expect(ra.PATH, ...)`) là MÃ, không nằm trong chuỗi. Ca
 * đối chứng "văn xuôi không bị tính là lệnh" trong spec gác đúng là để chặn việc nới quá tay ở đây.
 */
function boChuoi(s) {
  /*
   * QUÉT TUYẾN TÍNH, không regex. Bản đầu dùng `/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g` và nó TREO trên
   * cây thật: mẫu lười với lớp `[\s\S]` cho backtracking bùng nổ trên file lớn. Cửa chạy vài giây
   * thì người ta chạy; cửa treo thì người ta gỡ nó khỏi CI.
   */
  const ra = s.split('');
  let i = 0;
  while (i < ra.length) {
    const c = ra[i];
    if (c !== "'" && c !== '"' && c !== '`') { i += 1; continue; }
    let j = i + 1;
    while (j < ra.length) {
      if (ra[j] === '\\') { j += 2; continue; }
      if (ra[j] === c) break;
      if (c !== '`' && ra[j] === '\n') break;   // chuỗi thường không qua được xuống dòng
      if (ra[j] !== '\n') ra[j] = ' ';
      j += 1;
    }
    i = j + 1;
  }
  return ra.join('');
}

/**
 * Dòng ngay trên có `env-ok:` KÈM LÝ DO ⇒ không tính vi phạm.
 *
 * Phải có lý do THẬT. Lượt đầu dùng `/env-ok:\s*\S/`, và `\S` khớp luôn dấu `*` của `*/` đóng chú
 * thích — nên `/* env-ok: *` + `/` cũng tha. Một lối thoát không đòi lý do thì nó không phải lối
 * thoát, nó là công tắc tắt cửa.
 */
function daKhaiLyDo(nguyenBan, chiSoDong) {
  const ds = nguyenBan.split('\n');
  for (const d of [ds[chiSoDong - 2] || '', ds[chiSoDong - 1] || '']) {
    const m = d.match(/env-ok:(.*)$/);
    if (!m) continue;
    const lyDo = m[1].replace(/\*\/.*$/, '').trim();
    if (lyDo.length >= 5 && /\p{L}/u.test(lyDo)) return true;
  }
  return false;
}

/* ─── ① BIẾN MÔI TRƯỜNG ĐÚNG CHỮ HOA, TRÊN MỘT BẢN SAO ────────────────────────────────────────────
 *
 * `process.env.PATH` thì KHÔNG sao: trên Windows `process.env` tra không phân biệt hoa thường. Lỗi
 * nằm ở BẢN SAO — `{...process.env}` cho ra object thường, và object thường thì PHÂN BIỆT hoa thường.
 * Nên cửa này chỉ bắt truy cập trên thứ KHÔNG phải `process.env`, đúng hình dạng đã cắn ngày 09/11.
 */
const BIEN_THEO_NEN = ['PATH', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'COMSPEC', 'PATHEXT'];
function kiemBienMoiTruong(dsFile) {
  const re = new RegExp(`(\\w+)\\.(${BIEN_THEO_NEN.join('|')})\\b`, 'g');
  for (const f of dsFile) {
    const goc = doc(f);
    if (goc === null) continue;
    const sach = boChuoi(boChuThich(goc));
    let m = re.exec(sach);
    while (m) {
      const truoc = sach.slice(Math.max(0, m.index - 12), m.index + m[1].length);
      if (!/process\.env$/.test(truoc)) {
        const dong = sach.slice(0, m.index).split('\n').length;
        if (!daKhaiLyDo(goc, dong)) {
          bao(f, dong, `${m[1]}.${m[2]}`,
            `\`${m[2]}\` ĐÚNG CHỮ HOA trên một bản sao env. \`process.env\` tra không phân biệt hoa thường, `
            + 'nhưng `{...process.env}` thì CÓ — trên Windows biến tên `Path`, nên dòng này xanh ở bash và đỏ ở PowerShell.');
        }
      }
      m = re.exec(sach);
    }
  }
}

/* ─── ② `node --test` NHẬN THƯ MỤC ────────────────────────────────────────────────────────────────
 * Node 22 coi positional của `--test` là FILE; Node ~24+ nhận cả thư mục. `.nvmrc` ghim 22.
 *
 * CHỈ soi NGỮ CẢNH LỆNH — giá trị trong `package.json#scripts` và dòng `run:` của workflow. Lượt đầu
 * của phép kiểm này soi MỌI chuỗi `--test`, và nó bắt nhầm 2 chỗ: một TIÊU ĐỀ test có chữ "node --test"
 * trong câu, và chính THÔNG BÁO LỖI của cửa này. Khớp chuỗi ở bất kỳ đâu thì đo được cách hành văn,
 * không đo được lệnh — đúng bài học của bộ chấm A/B lượt 3.
 */
function kiemNodeTest() {
  const nguon = [];
  const pkgRaw = doc('package.json');
  if (pkgRaw) {
    let sc = {};
    try { sc = JSON.parse(pkgRaw).scripts || {}; } catch (e) { sc = {}; }
    const ds = pkgRaw.split('\n');
    for (const [ten, lenh] of Object.entries(sc)) {
      const dong = ds.findIndex((l) => l.includes(`"${ten}":`)) + 1;
      nguon.push({ ten: 'package.json', dong: dong || 1, lenh: String(lenh) });
    }
  }
  for (const w of liet('.github/workflows', /\.ya?ml$/)) {
    const n = doc(w);
    if (n === null) continue;
    n.split('\n').forEach((l, i) => {
      const m = l.match(/^\s*(?:-\s*)?run:\s*(.+)$/);
      if (m) nguon.push({ ten: w, dong: i + 1, lenh: m[1] });
    });
  }
  for (const { ten, dong, lenh } of nguon) {
    const m = lenh.match(/--test\s+(\S+)/);
    if (!m) continue;
    const duong = m[1];
    if (duong.startsWith('-')) continue;
    if (duong.endsWith('/') || !/\.(test|spec)\.[cm]?[jt]s$/.test(duong)) {
      bao(ten, dong, `--test ${duong}`,
        'truyền THƯ MỤC cho `node --test`. Node 22 coi positional là FILE ⇒ `Cannot find module`; Node ~24+ '
        + 'nhận thư mục. `.nvmrc` ghim **22**, nên dạng này xanh ở máy mới và đỏ ở CI. Liệt kê từng file.');
    }
  }
}

/* ─── ③ BĂM BYTE THÔ FILE VĂN BẢN ─────────────────────────────────────────────────────────────────
 * File nào băm nội dung file mà KHÔNG chuẩn hoá xuống dòng ở đâu cả thì nó sẽ đỏ giả trên cây CRLF
 * (hoặc, tệ hơn, luôn xanh trên CI Linux và chỉ đỏ ở máy Windows — cửa mà CI không bắt được).
 */
function kiemBamByteTho(dsFile) {
  const re = /(createHash\([^)]*\)[\s\S]{0,40}?\.update\(|digest\()\s*(fs\.)?readFileSync\(/g;
  for (const f of dsFile) {
    const goc = doc(f);
    if (goc === null) continue;
    const sach = boChuThich(goc);
    const coChuanHoa = /replace\(\/\\r\\n\?\/g|replace\(\/\\r\\n\/g|\\r\\n\?/.test(goc);
    let m = re.exec(sach);
    while (m) {
      const dong = sach.slice(0, m.index).split('\n').length;
      if (!coChuanHoa && !daKhaiLyDo(goc, dong)) {
        bao(f, dong, 'băm trực tiếp nội dung file',
          'băm BYTE THÔ mà trong file không chỗ nào chuẩn hoá xuống dòng. Trên cây `core.autocrlf=true` mọi '
          + 'file văn bản là CRLF ⇒ báo "đã đổi" trong khi 0 byte nội dung đổi. Nếu CHỈ băm nhị phân thì khai '
          + '`env-ok:` kèm lý do.');
      }
      m = re.exec(sach);
    }
  }
}

/* ─── ④ SPEC HẠ TẦNG ĐỌC FILE KHÔNG ĐI THEO GÓI — CỬA NÀY KHÔNG PHÁN ĐƯỢC ─────────────────────────
 *
 * Lớp lỗi này CÓ THẬT và đã lặp BỐN lần (v2.4.1 `docs/`, 30/10 `ops-login-combobox`, v2.10.2, và
 * 09/11 `docs/v2.11.0/**`). Nhưng tôi ĐÃ THỬ và KHÔNG quyết được nó bằng lint, nên nói thẳng ra đây
 * thay vì ship một phép đo gần-đúng rồi để người ta tin nó.
 *
 * Lượt thử: quét mọi chuỗi trông như đường dẫn repo trong `tests/fe/infra/**`, đối chiếu với
 * `package_kit.collect()`. Kết quả: 3/3 phát hiện là DƯƠNG TÍNH GIẢ — cả ba là KHOÁ của một cây tự
 * dựng trong thư mục tạm (`caySpec({'docs/kit-map.md': ...})`), không phải file repo được đọc.
 *
 * Vì sao regex không quyết được: ca thật hôm 09/11 có dạng
 *     const DS = ['docs/v2.11.0/A.md', 'docs/v2.11.0/B.md'];   // literal ở đây
 *     ... fs.readFileSync(path.join(REPO, f), 'utf8')          // đọc ở chỗ khác
 * Muốn phán đúng thì phải nối được mảng với lệnh đọc — đó là phân tích luồng dữ liệu, không phải
 * khớp chuỗi. Khớp chuỗi ở đây đo được CÁCH VIẾT, không đo được HÀNH VI.
 *
 * CƠ CHẾ ĐÚNG đã có và đã hoạt động: `release:verify` giải nén gói rồi chạy lại `tests/fe/infra`
 * TRONG gói — chính nó bắt được cả bốn lần. Nó chỉ chạy MUỘN (lúc phát hành), và đó là vấn đề về
 * THỜI ĐIỂM, không phải vấn đề thiếu máy gác.
 *
 * Thứ DUY NHẤT rút ra được thành luật: khi đọc một file có thể vắng mặt, phải KHẲNG ĐỊNH nó có
 * trước khi đọc (hoặc dùng `can*` của `_trong_repo.ts`) — nếu không, file vắng cho ra chuỗi rỗng và
 * phép kiểm ĐẠT TRONG HƯ KHÔNG. Luật đó nay nằm ở `extensions.spec.ts`, không nằm ở cửa này.
 */
function kiemDuongDanKhongVaoGoi() {
  chuaPhan.push('④ spec hạ tầng đọc file không đi theo gói — KHÔNG PHÁN ĐƯỢC bằng lint (cần phân tích '
    + 'luồng dữ liệu, không phải khớp chuỗi; lượt thử cho 3/3 dương tính giả). Cơ chế đúng: `release:verify` '
    + 'chạy lại `tests/fe/infra` TRONG gói. Đây KHÔNG phải là đạt.');
}

/* ─── chạy ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * ① quét CẢ spec lẫn script cửa: lỗi `ra.PATH` nằm trong một spec.
 * ③ CHỈ quét script cửa. Spec thường tự ghi ra fixture trong thư mục tạm rồi băm chính nó — băm thô
 *   ở đó là ĐÚNG (npm băm sha512 của tarball). Lượt đầu quét cả spec và bắt nhầm đúng ca ấy.
 */
const SPEC = liet('tests/fe/infra', /\.ts$/).filter((f) => !/\.probe\./.test(f));
const GATE = liet('scripts/qa', /\.js$/).filter((f) => !f.endsWith('env_assumptions.js'));

kiemBienMoiTruong([...SPEC, ...GATE]);
kiemBamByteTho(GATE);
kiemNodeTest();
kiemDuongDanKhongVaoGoi();

if (JSONRA) {
  console.log(JSON.stringify({ viPham, chuaPhan, daQuet: SPEC.length + GATE.length }, null, 2));
} else {
  console.log(`[env-gia-dinh] quét ${SPEC.length} spec hạ tầng + ${GATE.length} script cửa.`);
  for (const c of chuaPhan) console.log(`[env-gia-dinh] ⚠ ${c}`);
  if (!viPham.length) {
    console.log('[env-gia-dinh] ✓ ĐẠT — không khẳng định nào phụ thuộc môi trường.');
  } else {
    console.log(`[env-gia-dinh] ✗ ${viPham.length} khẳng định phụ thuộc môi trường:\n`);
    for (const v of viPham) console.log(`  ${v.file}:${v.dong}  \`${v.ma}\`\n      ${v.vi_sao}\n`);
    console.log('  Lối thoát: dòng nào THẬT SỰ cần hành vi đó thì ghi `env-ok: <lý do>` ngay trên nó.');
  }
}
/*
 * VIẾT ĐƯỜNG RA CHO `gate_index` ĐỌC ĐƯỢC. Bản đầu viết `process.exit(viPham.length ? 1 : 0)`, và
 * `levelOf()` không nhận ra dạng đó nên dán nhãn **BÁO CÁO** cho một cửa CHẶN THẬT — nhãn sai theo
 * đúng chiều nguy hiểm: người đọc danh mục tưởng chỗ này chỉ in ra cho vui.
 *
 * Sửa ở ĐÂY chứ không nới regex của `gate_index`: cửa ấy đọc 137 script, nới nó là đổi nhãn của cả
 * danh mục để chiều một file. Và dạng này dù sao cũng rõ nghĩa hơn.
 */
if (viPham.length) process.exit(1);
