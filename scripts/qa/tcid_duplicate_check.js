#!/usr/bin/env node
'use strict';

/*
 * tcid_duplicate_check.js — MỘT case chỉ được ĐĂNG KÝ VỚI RECORDER ở MỘT file spec.
 *
 * VÌ SAO CÓ GÁC NÀY — sự cố 16/10/2026, CSDL-9001:
 *   `diem-truong-phu.spec.ts` đăng ký tám case kèm `tc.finish('BLOCKED_SETUP')` với lý do "case chưa
 *   được hiện thực". Lời đó ĐÚNG vào lúc viết. Rồi thân thật của cả tám được viết ở ba file khác —
 *   nhưng không ai gỡ khối cũ. Từ đó mỗi lượt chạy có HAI test cùng khai một `tcId`.
 *
 *   `testcase-status.json` giữ ĐÚNG MỘT entry cho mỗi `tcId`, nên lượt ghi SAU thắng. Trong lượt MN
 *   hôm đó thân thật chạy 15:01–15:03 và chấm PASSED; khối cũ chạy 15:06–15:09 và ghi đè thành
 *   BLOCKED_SETUP — ghi đè cả ảnh evidence trùng tên. Kết quả: bảy ô Excel bị hạ từ Pass xuống
 *   Pending, và cả hai giá trị (Pass cũ, Pending mới) đều KHÔNG phải phép đo.
 *
 *   Không có dấu hiệu nào lộ ra: suite xanh, số test còn tăng, log không một chữ cảnh báo. Chỉ lộ khi
 *   đối soát Excel trước/sau merge và thấy verdict ĐI LÙI.
 *
 * HAI MỨC, vì hai loại trùng gây hại khác nhau:
 *   · CHẶN    — cùng một `tcId` được ĐĂNG KÝ với recorder ở ≥2 file. Đây là đường mất verdict.
 *   · CẢNH BÁO — `tcId` trùng ở tên test hoặc tên file ảnh nhưng không file nào đăng ký nó hai lần.
 *                Không mất verdict, nhưng ảnh evidence cùng tên vẫn đè nhau.
 *
 * ĐO CHO ĐÚNG, ba cái bẫy đã gặp khi viết chính gác này:
 *   1. Chú thích cũng chứa `tcId` ("xem TC_073"). Phải gỡ chú thích TRƯỚC khi tìm, nếu không ghi chú
 *      chỉ đường — thứ thay cho khối stub đã gỡ — lại làm gác báo động nhầm.
 *   2. `path.join(ART, 'CSDL_HS_TC_193.png')` KHÔNG phải lượt đăng ký. Bỏ chuỗi có đuôi tệp.
 *   3. Khối stub gọi `rec.case(tcId)` qua biến vòng lặp, nên tìm `rec.case('ID')` theo chữ sẽ BỎ LỌT
 *      đúng ca sinh ra gác này. Vì vậy: file có gọi `rec.case(` với biến thì mọi `tcId` dạng chuỗi
 *      đứng riêng trong file đó đều tính là đăng ký.
 *
 * Dùng:
 *   node scripts/qa/tcid_duplicate_check.js                      # quét mọi task
 *   node scripts/qa/tcid_duplicate_check.js --task CSDL-9001
 *   node scripts/qa/tcid_duplicate_check.js --cho-phep CSDL_HS_TC_193
 *
 * Exit: 0 = không trùng ở mức chặn · 1 = có · 2 = không tìm thấy thư mục nào để quét.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const arg = (ten) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const TASK = arg('task');
const CHO_PHEP = new Set(arg('cho-phep').split(',').map((s) => s.trim()).filter(Boolean));

/* Bỏ file dò (`*.probe.spec.ts`) — chúng không sinh verdict nên trùng `tcId` ở đó vô hại. */
const BO = /\.probe\.spec\.ts$/;
const LA_SPEC = /\.spec\.ts$/;
const TC_ID = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+[A-Z]?\b/g;
/* `rec.case('ID')` — đăng ký theo chữ, chắc chắn nhất. */
const KHAI_CHU = /\.case\(\s*['"`]([A-Z][A-Z0-9_]*_TC_\d+[A-Z]?)['"`]/g;
/* `rec.case(<không phải chuỗi>)` — đăng ký qua biến; chính dạng của khối stub đã gây sự cố.
 *
 * Bản đầu viết `[A-Za-z_$][\w$.]*` nên khớp `rec.case(tcId)` và `rec.case(a.b)` nhưng BỎ LỌT
 * `rec.case(TC_CUA_CAP[cap])` — dạng tra bảng theo cấp, đúng dạng hai bộ đo nhãn field của CSDL-9001
 * đang dùng. Gác bỏ lọt đúng ca phổ biến nhất thì vô dụng. Nay: bất kỳ tham số KHÔNG mở đầu bằng dấu
 * nháy đều tính là đăng ký qua biến. */
const KHAI_BIEN = /\.case\(\s*[^'"`\s)][^)]*\)/;
/* Chuỗi có đuôi tệp: đường dẫn ảnh, không phải lượt đăng ký. */
const CHUOI_TEP = /['"`][^'"`]*\.(?:png|jpe?g|webp|mp4|webm|json|md|txt|log|csv|html|zip)['"`]/g;
/* `rec.write()` — chỉ file GỌI nó mới ghi được `testcase-status.json`. File không gọi thì dù có khai
 * `rec.case()` cũng không đẩy nổi entry nào ra đĩa, nên không thể ghi đè verdict của file khác: hạ
 * xuống mức cảnh báo. Phải tìm SAU KHI gỡ chú thích — `anh-bug-chup-lai.spec.ts` nhắc `rec.write()`
 * trong chính đoạn giải thích vì sao nó KHÔNG gọi, và grep thô đọc đoạn đó thành "có gọi". */
const GHI_STATUS = /\.write\(\s*\)/;

/**
 * Gỡ chú thích khối và chú thích dòng.
 *
 * `//` đứng sau dấu hai chấm là phần của URL (`https://…`), không phải chú thích — không gỡ, nếu không
 * mọi dòng có URL bị cắt mất phần sau.
 */
function goChuThich(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((d) => d.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/**
 * Cắt nguồn thành từng KHỐI TEST, để `test.skip(true)` của một test không miễn trừ cả file.
 *
 * Mốc cắt là chỗ khai báo test (`test(`, `test.only(`, `test.skip(`). Phần đầu file trước test đầu
 * tiên cũng là một khối: bảng tra `tcId` ở mức module nằm ở đó, và khối stub gây sự cố 16/10/2026
 * khai mảng `tcId` ngay trong vòng `for` ở mức describe.
 */
function tachKhoiTest(src) {
  const moc = [...src.matchAll(/(?:^|\n)[ \t]*test(?:\.only|\.skip)?\s*\(/g)].map((m) => m.index);
  if (!moc.length) return [src];
  const ra = [src.slice(0, moc[0])];
  for (let i = 0; i < moc.length; i += 1) ra.push(src.slice(moc[i], i + 1 < moc.length ? moc[i + 1] : src.length));
  return ra;
}

function quetThuMuc(goc, ra) {
  for (const e of fs.readdirSync(goc, { withFileTypes: true })) {
    const p = path.join(goc, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      quetThuMuc(p, ra);
    } else if (LA_SPEC.test(e.name) && !BO.test(e.name)) ra.push(p);
  }
  return ra;
}

function thuMucTask() {
  const goc = path.join(REPO, 'outputs');
  if (!fs.existsSync(goc)) return [];
  const ra = [];
  for (const du of fs.readdirSync(goc, { withFileTypes: true })) {
    if (!du.isDirectory()) continue;
    const tasks = path.join(goc, du.name, 'tasks');
    if (!fs.existsSync(tasks)) continue;
    for (const t of fs.readdirSync(tasks, { withFileTypes: true })) {
      if (!t.isDirectory()) continue;
      if (TASK && t.name !== TASK) continue;
      const auto = path.join(tasks, t.name, 'automation');
      if (fs.existsSync(auto)) ra.push([t.name, auto]);
    }
  }
  return ra;
}

const nhom = thuMucTask();
if (!nhom.length) {
  console.error(`✗ không tìm thấy thư mục automation nào${TASK ? ` cho task ${TASK}` : ''} dưới outputs/*/tasks/`);
  process.exit(2);
}

let tongChan = 0;
let tongCanh = 0;
for (const [task, auto] of nhom) {
  const files = quetThuMuc(auto, []);
  const dangKy = new Map();   // tcId -> Set<file>  (đăng ký với recorder — mức CHẶN)
  const nhacTen = new Map();  // tcId -> Set<file>  (chỉ nhắc tên — mức cảnh báo)

  for (const f of files) {
    const ten = path.relative(auto, f);
    const sach = goChuThich(fs.readFileSync(f, 'utf8'));
    const khongTep = sach.replace(CHUOI_TEP, ' ');

    /*
     * BỎ THÂN CÁC TEST BỊ `test.skip(true, …)` rồi mới quét, chứ KHÔNG quét từng khối riêng.
     *
     * Quét từng khối thì bỏ lọt dạng phổ biến nhất: bảng `tcId` khai ở mức module và `rec.case(bảng[cấp])`
     * nằm trong test. Khối test không có ID nào, khối module không có `.case(` nào ⇒ gác báo "0 đăng ký"
     * cho đúng những file đăng ký thật. Đo 16/10/2026: `field-coverage.spec.ts` tụt từ 5 ID xuống 0.
     *
     * Bỏ phần skip rồi quét cả phần còn lại giữ được cả hai chiều: bảng ở mức module vẫn được thấy, mà
     * bộ đo cũ đã khoá bằng `test.skip(true)` thì không bị tính.
     */
    const songSot = tachKhoiTest(khongTep)
      .filter((khoi) => !/test\.skip\(\s*true\b/.test(khoi))
      .join('\n');

    const cuaFile = new Set();
    if (GHI_STATUS.test(khongTep)) {
      for (const m of songSot.matchAll(KHAI_CHU)) cuaFile.add(m[1]);
      /* Đăng ký qua biến: không truy được ID từ chỗ gọi, nên lấy mọi `tcId` dạng chuỗi còn sống. */
      if (KHAI_BIEN.test(songSot)) {
        for (const m of songSot.matchAll(TC_ID)) cuaFile.add(m[0]);
      }
    }
    for (const id of cuaFile) {
      if (!dangKy.has(id)) dangKy.set(id, new Set());
      dangKy.get(id).add(ten);
    }
    for (const m of khongTep.matchAll(TC_ID)) {
      if (cuaFile.has(m[0])) continue;
      if (!nhacTen.has(m[0])) nhacTen.set(m[0], new Set());
      nhacTen.get(m[0]).add(ten);
    }
  }

  const loc = (m) => [...m.entries()]
    .filter(([id, nos]) => nos.size > 1 && !CHO_PHEP.has(id))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const chan = loc(dangKy);
  /* Chỉ cảnh báo khi KHÔNG đã bị chặn — tránh kể một ca hai lần. */
  const canh = loc(nhacTen).filter(([id]) => !(dangKy.get(id) || new Set()).size || (dangKy.get(id) || new Set()).size <= 1);

  console.log(`${task}: ${files.length} file spec · ${dangKy.size} tcId đăng ký · ${chan.length} trùng-đăng-ký · ${canh.length} trùng-tên`);
  for (const [id, nos] of chan) console.log(`   ✗ ${id} ĐĂNG KÝ ở ${nos.size} file: ${[...nos].sort().join(' , ')}`);
  for (const [id, nos] of canh) console.log(`   ⚠ ${id} trùng tên ở: ${[...nos].sort().join(' , ')}`);
  tongChan += chan.length;
  tongCanh += canh.length;
}

if (tongCanh) {
  console.log(`\n⚠ ${tongCanh} tcId trùng ở tên test hoặc tên file ảnh. Không mất verdict, nhưng ảnh cùng tên đè nhau.`);
}
if (tongChan) {
  console.log(`\n✗ CHẶN: ${tongChan} tcId được ĐĂNG KÝ với recorder ở nhiều hơn một file spec.`);
  console.log('   `testcase-status.json` giữ một entry mỗi tcId ⇒ lượt chạy SAU ghi đè lượt TRƯỚC,');
  console.log('   lặng lẽ, và ghi đè cả ảnh evidence trùng tên. Gỡ bản đăng ký cũ, giữ đúng một chỗ.');
  console.log('   Nếu thật sự cần hai chỗ: khai --cho-phep <ID> và ghi rõ vì sao ngay tại chỗ khai.');
  process.exit(1);
}
console.log('\n✓ không có tcId nào được đăng ký ở hai file.');
