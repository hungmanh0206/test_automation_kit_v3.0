#!/usr/bin/env node
'use strict';
/*
 * compile:check — CANH LUẬT "CASE CHƯA ĐỦ KHÔNG ĐƯỢC PASS" (v2.8.0 §D).
 *
 * `compile:spec` sinh case chưa đủ dưới dạng `test.skip`. Luật đó chỉ có giá trị nếu nó còn đúng SAU KHI
 * người ta sửa file — và chỗ nó sẽ bị phá là chỗ dễ nhất: bỏ chữ `.skip` đi cho case chạy, rồi để TODO ở
 * nguyên đó. Lúc đó case chạy vài lời gọi khớp được, không kiểm gì, và XANH. Một case chưa làm xong được
 * đếm vào cột PASS, và không ai thấy vì màu nó đúng.
 *
 * BỐN LUẬT:
 *   1. `test(` (không `.skip`) mà thân còn `TODO-STEP`/`TODO-ORACLE`/`TODO-SETUP` ⇒ CHẶN.
 *   2. `test(` mà đầu case còn dấu `BIEN-DICH:CHUA-DU` ⇒ CHẶN. Hai luật này không trùng nhau: luật 1 bắt
 *      TODO còn trong thân, luật 2 bắt trường hợp TODO bị XOÁ mà việc thì chưa làm.
 *   3. `finish('PASS')` trong một case còn TODO ⇒ CHẶN. Bỏ `skip` là một đường; khai thẳng PASS là đường
 *      khác, và nó ngắn hơn.
 *   4. `test.skip` mà thân KHÔNG còn TODO nào ⇒ cảnh báo: hoặc việc đã làm xong mà quên bỏ `skip` (mất
 *      một case), hoặc `skip` còn đó vì lý do khác và lý do đó chưa được ghi.
 *
 * Quét những thư mục `automation/**` có file do `compile:spec` sinh ra. File không mang dấu sinh tự động
 * thì KHÔNG quét — spec người viết tay có luật riêng ở `output_gate`.
 *
 * Dùng: node scripts/qa/reuse/compile_check.js [--goc <dir>] [--json]
 * Exit: 0 · 1 khi có vi phạm · 2 khi quét 0 file do sinh (phép đo hỏng, KHÔNG phải "sạch")
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const cs = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_spec.js'));

const DAU_SINH = 'SINH TỰ ĐỘNG bởi `compile:spec`';
const RE_TODO = /\bTODO-(STEP|ORACLE|SETUP)\b/;

/** Những gốc có thể chứa spec sinh tự động. `outputs/**` là lớp PROJECT, có thể không tồn tại. */
function cacGoc(gocTuyChon) {
  if (gocTuyChon) return [path.resolve(REPO, gocTuyChon)];
  const ra = [];
  const outputs = path.join(REPO, 'outputs');
  if (!fs.existsSync(outputs)) return ra;
  for (const p of fs.readdirSync(outputs, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    const tasks = path.join(outputs, p.name, 'tasks');
    if (!fs.existsSync(tasks)) {
      /* `outputs/_scratch` và các thư mục nháp không có `tasks/` — quét thẳng chúng. */
      ra.push(path.join(outputs, p.name));
      continue;
    }
    for (const t of fs.readdirSync(tasks, { withFileTypes: true })) {
      if (t.isDirectory()) ra.push(path.join(tasks, t.name, 'automation'));
    }
  }
  return ra;
}

function quetSpec(d, ra) {
  let muc;
  try { muc = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const f of muc) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { quetSpec(p, ra); continue; }
    if (!/\.spec\.ts$/.test(f.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (src.includes(DAU_SINH)) ra.push({ file: p, src });
  }
}

/**
 * Tách file thành từng khối case.
 *
 * Tách theo dòng khai `test(`/`test.skip(` và đếm ngoặc nhọn để biết thân kết thúc ở đâu. Đếm ngoặc
 * trên văn bản THÔ là đủ tin ở đây vì đầu vào là file do chính `compile:spec` sinh — nó không sinh chuỗi
 * chứa `{`/`}` lạc. Nhưng file có thể đã bị sửa tay, nên nếu đếm không về 0 thì BÁO RA chứ không im lặng
 * bỏ qua khối đó: một bộ dò bỏ qua phần nó không hiểu là một bộ dò in dấu ✓ trên thứ nó chưa đọc.
 */
function tachCase(src) {
  const dong = src.split('\n');
  const ra = [];
  const loiTach = [];
  for (let i = 0; i < dong.length; i += 1) {
    const m = /^\s*test(\.skip)?\s*\(/.exec(dong[i]);
    if (!m) continue;
    const coSkip = Boolean(m[1]);
    let sau = 0;
    let j = i;
    let batDau = false;
    for (; j < dong.length; j += 1) {
      for (const ch of dong[j]) {
        if (ch === '{') { sau += 1; batDau = true; } else if (ch === '}') sau -= 1;
      }
      if (batDau && sau <= 0) break;
    }
    if (j >= dong.length) {
      loiTach.push(`dòng ${i + 1}: không tìm được chỗ kết thúc thân case`);
      continue;
    }
    /* Đầu case = khối bình luận ngay trên dòng `test(` — chứa dấu `BIEN-DICH:*`. */
    let k = i - 1;
    while (k >= 0 && !/^\s*\/\*/.test(dong[k])) k -= 1;
    const dau = k >= 0 ? dong.slice(k, i).join('\n') : '';
    ra.push({
      dong: i + 1,
      co_skip: coSkip,
      ten: (/["'](.+?)["']/.exec(dong[i]) || ['', '(không đọc được tên)'])[1],
      dau,
      than: dong.slice(i, j + 1).join('\n'),
    });
    i = j;
  }
  return { ds: ra, loiTach };
}

function kiem(gocTuyChon) {
  const files = [];
  for (const g of cacGoc(gocTuyChon)) quetSpec(g, files);

  const chan = [];
  const canhBao = [];

  for (const { file, src } of files) {
    const rel = path.relative(REPO, file).replace(/\\/g, '/');
    const { ds, loiTach } = tachCase(src);
    for (const x of loiTach) chan.push({ luat: 0, file: rel, y: `không đọc được cấu trúc file: ${x}` });

    for (const c of ds) {
      const coTodo = RE_TODO.test(c.than);
      const dauChuaDu = c.dau.includes(cs.DAU_CHUA_DU);
      const khaiPass = /finish\(\s*['"]PASS['"]/.test(c.than);

      if (!c.co_skip && coTodo) {
        chan.push({ luat: 1, file: rel, y: `dòng ${c.dong} · ${c.ten}: \`test(\` mà thân còn TODO — case chưa làm xong sẽ XANH vì nó chẳng kiểm gì.` });
      }
      if (!c.co_skip && dauChuaDu) {
        chan.push({ luat: 2, file: rel, y: `dòng ${c.dong} · ${c.ten}: bỏ \`.skip\` mà đầu case còn dấu \`${cs.DAU_CHUA_DU}\` — TODO bị xoá nhưng việc chưa làm.` });
      }
      if (khaiPass && (coTodo || dauChuaDu)) {
        chan.push({ luat: 3, file: rel, y: `dòng ${c.dong} · ${c.ten}: khai \`finish('PASS')\` trong một case còn TODO.` });
      }
      if (c.co_skip && !coTodo && !dauChuaDu) {
        canhBao.push({ luat: 4, file: rel, y: `dòng ${c.dong} · ${c.ten}: \`test.skip\` mà không còn TODO nào — nếu đã làm xong thì bỏ \`skip\`, nếu skip vì lý do khác thì GHI lý do đó.` });
      }
    }
  }

  return { so_file: files.length, chan, canh_bao: canhBao };
}

function main() {
  const i = process.argv.indexOf('--goc');
  const goc = i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
  const d = kiem(goc);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(d, null, 2));
    process.exit(d.chan.length ? 1 : 0);
  }

  if (!d.so_file) {
    /*
     * 0 file là PHÉP ĐO HỎNG, không phải "sạch". Khác với `steps:lint` (thư viện đang dựng dần nên 0
     * file là bình thường): ở đây gate được gọi vì người ta vừa biên dịch ra spec, nên 0 file nghĩa là
     * nó đang quét sai chỗ.
     */
    console.error('[compile-check] CHƯA ĐƯỢC GÁC — quét 0 file do `compile:spec` sinh.');
    console.error('                Đây KHÔNG phải "không có vi phạm", mà là "không tìm thấy gì để kiểm".');
    console.error('                Chỉ đúng chỗ bằng `--goc <dir>`.');
    process.exit(2);
  }

  console.log(`[compile-check] ${d.so_file} file sinh tự động · ${d.chan.length} vi phạm · ${d.canh_bao.length} cảnh báo`);

  if (d.canh_bao.length) {
    console.log('');
    console.log('~ Cảnh báo:');
    for (const c of d.canh_bao) console.log(`  [luật ${c.luat}] ${c.file}\n      ${c.y}`);
  }

  if (d.chan.length) {
    console.error('');
    console.error('✗ CHẶN:');
    for (const c of d.chan) console.error(`  [luật ${c.luat}] ${c.file}\n      ${c.y}`);
    console.error('');
    console.error('  Bỏ `.skip` KHÔNG làm case xong. Nó chỉ làm case chạy vài lời gọi khớp được rồi báo');
    console.error('  xanh — và một case chưa làm xong được đếm vào cột PASS thì không ai thấy, vì màu đúng.');
    process.exit(1);
  }

  console.log('');
  console.log('✓ Mọi case còn TODO đều là `test.skip`; không case nào khai PASS khi chưa đủ.');
}

if (require.main === module) main();

module.exports = { kiem, tachCase, cacGoc, DAU_SINH, RE_TODO };
