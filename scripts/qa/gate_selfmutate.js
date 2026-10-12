#!/usr/bin/env node
'use strict';
/*
 * gate_selfmutate — ĐỘT BIẾN CHÍNH CODE CỦA GATE, rồi đòi spec của nó phải ĐỎ (v2.7.0 §A10.6).
 *
 * KHÁC `mutation_check` Ở ĐÂU. `mutation_check` tiêm lỗi vào DỮ LIỆU: nó bóp méo response ở tầng
 * `page.route()` rồi xem bộ assertion trong testcase có bắt không. Máy này tiêm lỗi vào CODE CỦA GATE
 * rồi xem spec của gate có bắt không. Hai câu hỏi khác nhau:
 *   · `mutation_check` : "bộ testcase của tôi có bắt được bug không?"
 *   · máy này          : "bộ spec của tôi có bắt được một gate bị làm hỏng không?"
 *
 * VÌ SAO CẦN. Ba lỗi mở đầu §A10 đều là gate xanh vì không kiểm gì, và không spec nào đỏ khi chúng xảy
 * ra. Tức spec của những gate đó không đủ mạnh để phát hiện chính gate bị hỏng. "Máy kiểm chỉ tốt bằng
 * chính nó" là câu nói; máy này là phép đo cho câu đó.
 *
 * MUTANT SỐNG SÓT = SPEC YẾU, KHÔNG PHẢI GATE YẾU. Đọc ngược lại là sai và tốn công: thấy mutant sống
 * thì phải bổ sung SPEC, không phải sửa gate.
 *
 * AN TOÀN. Nó sửa file source thật, nên:
 *   · chỉ chạy khi cây git SẠCH ở những file nó sẽ chạm — bẩn thì từ chối, vì không phân biệt được
 *     thay đổi của nó với thay đổi đang sửa dở;
 *   · luôn trả lại nguyên văn trong `finally`, kể cả khi bị ngắt;
 *   · không chạm `node_modules`, không chạm config, không chạm `outputs/`.
 *
 * Dùng:
 *   node scripts/qa/gate_selfmutate.js [--gate <file.js>] [--json] [--liet-ke]
 *
 * Exit: 0 mọi mutant bị bắt · 1 có mutant SỐNG SÓT · 2 không chạy được
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const JSON_OUT = process.argv.includes('--json');
const LIET_KE = process.argv.includes('--liet-ke');
const val = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/*
 * BỘ ĐỘT BIẾN — mỗi cái tái hiện MỘT lỗi thật đã xảy ra trong kit, không phải một lỗi tưởng tượng.
 *
 * `tim` là chuỗi hoặc regex tìm trong source; `thay` là bản đã làm hỏng. Mutant nào không khớp file thì
 * BỎ QUA và ghi là `khong_ap_dung` — không tính vào tỉ lệ, vì một mutant không áp được không nói gì về
 * spec.
 */
const DOT_BIEN = [
  {
    ma: 'DOI_TEN_TRUONG',
    y: 'đọc `t.id` thay vì `t.tcId`',
    lo_that: '`expansion_audit` đã làm đúng vậy và báo "0/6 đỏ" mà trông rất yên tâm.',
    tim: /\.tcId\b/,
    thay: '.id',
  },
  {
    ma: 'NUOT_EXCEPTION',
    y: 'đổi `catch` thành nuốt im lặng và trả mảng rỗng',
    lo_that: '`dimension_coverage` đọc một config bị thiếu, rơi vào `catch → []`, gate tắt mà không báo gì.',
    tim: /catch \(e\) \{ return \[/,
    thay: 'catch (e) { return [',
    /*
     * Sinh một ứng viên cho MỖI khối `catch` trong file, bằng cách đếm ngoặc từ chỗ mở. Đếm ngoặc KHÔNG
     * chính xác (ngoặc trong chuỗi làm lệch), nên máy để `vm.Script` loại ứng viên vỡ cú pháp — xem
     * `ganDotBien`. Bản trước dùng một regex `[^}]*` và nó cắt giữa template literal ở `override.js`:
     * file không parse được, spec đỏ, và lượt đó bị đếm là "bị bắt" trong khi nó không đo gì cả.
     */
    nhieu_ung_vien: (src) => {
      const ra = [];
      const MO = 'catch (e) {';
      let tu = src.indexOf(MO);
      while (tu !== -1) {
        let sau = 1;
        let i = tu + MO.length;
        while (i < src.length && sau > 0) {
          if (src[i] === '{') sau += 1;
          else if (src[i] === '}') sau -= 1;
          i += 1;
        }
        if (sau === 0) ra.push(`${src.slice(0, tu)}catch (e) { return []; }${src.slice(i)}`);
        tu = src.indexOf(MO, tu + 1);
      }
      return ra;
    },
  },
  {
    ma: 'DAO_DIEU_KIEN',
    y: 'đảo một điều kiện chặn: `length` thành `!length`',
    lo_that: 'Một gate đảo điều kiện vẫn chạy, vẫn in ra, và vẫn exit 0 — nó chỉ thôi bắt.',
    tim: /if \((\w+)\.length\)/,
    thay_dac_biet: (src) => src.replace(/if \((\w+)\.length\)/, 'if (!$1.length)'),
  },
  {
    ma: 'BO_NGUONG',
    y: 'nới một ngưỡng số lên mức không bao giờ chạm tới',
    lo_that: 'Nới ngưỡng là cách nới gate rẻ nhất, và nó không đổi một dòng logic nào.',
    tim: /(>=?|<=?)\s*(\d+)/,
    thay_dac_biet: (src) => src.replace(/(>=?|<=?)\s*(\d+)/, '$1 999999'),
  },
];

/** Gate T0/T1 quan trọng và spec canh chúng. §A10.6 đòi ít nhất 5 gate. */
const MUC_TIEU = [
  { gate: 'scripts/qa/lib/gate_tier.js', spec: 'tests/fe/infra/gate-tier.spec.ts', tang: 'T0 (lớp quyết định)' },
  { gate: 'scripts/qa/override.js', spec: 'tests/fe/infra/override.spec.ts', tang: 'T0 (đường miễn trừ)' },
  { gate: 'scripts/qa/expected_ledger.js', spec: 'tests/fe/infra/expected-ledger.spec.ts', tang: 'T0 §6' },
  { gate: 'scripts/qa/canonical_drift.js', spec: 'tests/fe/infra/canonical-drift.spec.ts', tang: 'T0 §3' },
  { gate: 'scripts/qa/exit_gate.js', spec: 'tests/fe/infra/exit-gate.spec.ts', tang: 'T1 (cửa ra)' },
  { gate: 'scripts/qa/autofix.js', spec: 'tests/fe/infra/autofix.spec.ts', tang: 'T0 §6 (hàng rào tự sửa)' },
  { gate: 'scripts/qa/gate_friction.js', spec: 'tests/fe/infra/gate-friction.spec.ts', tang: 'T2 (sổ đo)' },
];

const RE_DONG = /\r?\n/;
const RE_IN = /^(?:console\.|L\.push\()/;
/*
 * Dòng nào nhắc `process.argv` là dòng ĐỌC THAM SỐ, không phải dòng phán. Nhận cả `process.argv[i+1]`
 * chứ không chỉ `.indexOf`: toán tử `BO_NGUONG` rơi đúng vào phép so `i >= 0` của hàm đọc cờ, và phép
 * so đó nằm cùng dòng với `process.argv[i + 1]`.
 */
const RE_CO = /process\.argv/;
const RE_CATCH_RONG = /^catch \(e\) \{\s*(?:\/\*|\}|$)/;
/*
 * Mutant rơi vào `catch` của một phép đọc file là chỗ mà KHÔNG spec nào bắt được một cách lành mạnh:
 * muốn nó xảy ra thì phải làm config thật không đọc được (đổi tên file dùng chung giữa các lượt test,
 * vỡ khi chạy song song) hoặc mở một cửa sau nhận đường dẫn từ env vào chính gate. Cả hai đều tệ hơn
 * cái nó đo. Nên máy KHAI đây là chỗ bộ đột biến không với tới, chứ không gọi là spec yếu.
 */
const RE_CATCH = /catch \([a-z]+\)/;
const RE_IO = /fs\.(?:read|exists|stat|mkdir|write|append|copy|rename|rm|unlink)/;

/*
 * ĐỘT BIẾN RƠI VÀO ĐÂU — và vì sao phải biết.
 *
 * Lượt chạy đầu tiên (12/10/2026) cho 5 mutant sống sót, và tôi đã suýt kết luận "5 spec yếu". Đi xem
 * từng chỗ thì 3 trong 5 rơi vào code KHÔNG THUỘC đường phán của gate: một hàm đọc cờ dòng lệnh, một
 * dòng `console.log` in sổ nợ, một `catch` của nhánh chết. Toán tử đột biến thay chỗ KHỚP VĂN BẢN ĐẦU
 * TIÊN, mà chỗ đó hay là hàm tiện ích đứng đầu file.
 *
 * Phân biệt này KHÔNG phải để bỏ qua: hai trong ba chỗ đó vẫn là lỗ spec thật và đã được vá (cờ `--task`
 * phải thắng env; dòng sổ nợ phải nêu TC ID). Nó để tránh một kết luận sai HƯỚNG — "spec yếu" khi sự thật
 * là "toán tử đột biến không với tới được đường phán", và hai thứ đó cần hai cách sửa khác nhau.
 */
function viTri(goc, hong) {
  const a = goc.split(RE_DONG);
  const b = hong.split(RE_DONG);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      /*
       * `quanh` = ba dòng trước cộng dòng bị đổi. Cần nó vì phân loại theo MỘT dòng đọc sai ngữ cảnh:
       * `} catch (e) { return []; }` của `gate_friction` là nhánh lỗi của `fs.appendFileSync`, mà lệnh
       * `fs.*` nằm ở dòng trên. Nhìn một dòng thì chỗ đó bị xếp vào "đường phán" và báo oan spec.
       */
      return {
        dong: i + 1,
        van: (b[i] || a[i] || '').trim(),
        quanh: b.slice(Math.max(0, i - 3), i + 1).map((x) => String(x).trim()).join(' ').trim(),
      };
    }
  }
  return null;
}

/** Dòng bị đột biến có thuộc ĐƯỜNG PHÁN của gate hay không. Trả lý do nếu KHÔNG, `null` nếu CÓ. */
function ngoaiDuongPhan(van, quanh) {
  if (!van) return null;
  if (RE_IN.test(van)) return 'dòng IN ra màn hình — đổi nó không đổi phán quyết, chỉ đổi chữ';
  if (RE_CO.test(van)) return 'hàm ĐỌC CỜ dòng lệnh — thuộc lớp vào/ra, không thuộc luật gác';
  if (RE_CATCH_RONG.test(van)) return 'catch RỖNG của nhánh phụ — mutant không thay đổi hành vi nào quan sát được';
  const khoi = quanh || van;
  if (RE_CATCH.test(khoi) && RE_IO.test(khoi)) return 'nhánh LỖI I/O — spec không làm nó xảy ra được mà không đặt cửa sau vào gate';
  return null;
}

/** Cây git có sạch ở file này không. Bẩn thì KHÔNG được chạm. */
function sachChua(rel) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', rel], { cwd: REPO, encoding: 'utf8' });
    return out.trim() === '';
  } catch (e) {
    return null;    /* không phải git repo ⇒ không phán được */
  }
}

function chaySpec(spec) {
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['playwright', 'test', spec, '--reporter=line'],
    { cwd: REPO, encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { do: r.status !== 0, exit: r.status, out };
}

function ganDotBien(src, mt, duong) {
  /*
   * Toán tử có thể đề xuất NHIỀU ứng viên, và máy lấy cái đầu tiên CÒN PARSE ĐƯỢC.
   *
   * Vì sao cần: `NUOT_EXCEPTION` phải tìm ranh giới của một khối `catch`, mà tìm ranh giới khối bằng đếm
   * ngoặc thì sai ở chỗ có ngoặc nằm trong chuỗi (`${e.code || e.message}`). Thay vì viết một bộ đọc
   * JavaScript đầy đủ, máy thử lần lượt và để `vm.Script` làm trọng tài. Ứng viên vỡ cú pháp bị loại,
   * không bị đếm là "bị bắt".
   */
  if (mt.nhieu_ung_vien) {
    for (const ung of mt.nhieu_ung_vien(src)) {
      if (ung && ung !== src && cuPhapOn(ung, duong || 'mutant.js')) return ung;
    }
    return null;
  }
  if (mt.thay_dac_biet) {
    const moi = mt.thay_dac_biet(src);
    return moi === src ? null : moi;
  }
  if (!mt.tim.test(src)) return null;
  const moi = src.replace(mt.tim, mt.thay);
  return moi === src ? null : moi;
}

/*
 * ĐỘT BIẾN LÀM VỠ CÚ PHÁP = KẾT LUẬN RỖNG, phải loại trước khi đếm.
 *
 * Đo 12/10/2026: toán tử `NUOT_EXCEPTION` dùng `catch \(e\) \{[^}]*\}` nên ở `override.js` nó cắt giữa
 * một template literal (`${e.code || e.message}` có dấu `}` ở trong). File thành không parse được, spec
 * đỏ, và máy đếm đó là "bị bắt".
 *
 * Nhưng một file không parse được thì MỌI spec đều đỏ, kể cả spec rỗng. "Bị bắt" ở đó không nói gì về
 * spec — nó chỉ nói `node` biết đọc cú pháp. Đây đúng loại lỗi mà kit cấm ở chỗ khác: một màu đỏ không
 * mang nghĩa mà nó tự nhận.
 */
function cuPhapOn(src, duong) {
  try { new vm.Script(src, { filename: duong }); return true; } catch (e) { return false; }
}

function chayMotGate(m) {
  const duong = path.join(REPO, m.gate);
  if (!fs.existsSync(duong)) return { ...m, bo_qua: 'không có file gate' };
  if (!fs.existsSync(path.join(REPO, m.spec))) return { ...m, bo_qua: 'không có spec' };

  const sach = sachChua(m.gate);
  if (sach === false) {
    return { ...m, bo_qua: 'file đang SỬA DỞ — không chạm, vì không phân biệt được đột biến với thay đổi của bạn' };
  }
  if (sach === null) return { ...m, bo_qua: 'không phải git repo — không bảo đảm trả lại được nguyên văn' };

  /* Spec phải XANH TRƯỚC đã. Spec đang đỏ thì mọi mutant "bị bắt" đều là kết luận rỗng. */
  const truoc = chaySpec(m.spec);
  if (truoc.do) {
    return { ...m, bo_qua: 'spec ĐANG ĐỎ trước khi đột biến — mọi kết luận sau đó là rỗng' };
  }

  const goc = fs.readFileSync(duong, 'utf8');
  const kq = [];
  try {
    for (const mt of DOT_BIEN) {
      const hong = ganDotBien(goc, mt, duong);
      if (hong === null) { kq.push({ ma: mt.ma, y: mt.y, trang_thai: 'khong_ap_dung', vi_sao: 'file không có chỗ nào khớp toán tử' }); continue; }
      if (!cuPhapOn(hong, duong)) {
        const vt = viTri(goc, hong);
        kq.push({
          ma: mt.ma, y: mt.y, trang_thai: 'khong_ap_dung',
          vi_sao: 'đột biến làm VỠ CÚ PHÁP — mọi spec đều đỏ nên kết luận rỗng, KHÔNG đếm là bị bắt',
          vi_tri: vt,
        });
        continue;
      }
      fs.writeFileSync(duong, hong, 'utf8');
      const sau = chaySpec(m.spec);
      const vt = viTri(goc, hong);
      kq.push({
        ma: mt.ma,
        y: mt.y,
        lo_that: mt.lo_that,
        trang_thai: sau.do ? 'bi_bat' : 'song_sot',
        vi_tri: vt,
        ngoai_duong_phan: vt ? ngoaiDuongPhan(vt.van, vt.quanh) : null,
      });
      fs.writeFileSync(duong, goc, 'utf8');
    }
  } finally {
    /* TRẢ LẠI NGUYÊN VĂN, kể cả khi ném giữa đường. Một file gate bị để lại dạng hỏng là tệ nhất. */
    fs.writeFileSync(duong, goc, 'utf8');
  }
  return { ...m, mutant: kq };
}

function main() {
  if (LIET_KE) {
    console.log('[selfmutate] BỘ ĐỘT BIẾN — mỗi cái tái hiện một lỗi THẬT đã xảy ra trong kit:');
    for (const d of DOT_BIEN) {
      console.log(`\n  ${d.ma}: ${d.y}`);
      console.log(`    ${d.lo_that}`);
    }
    console.log(`\n[selfmutate] MỤC TIÊU — ${MUC_TIEU.length} gate:`);
    for (const m of MUC_TIEU) console.log(`  ${m.gate.padEnd(38)} ${m.tang.padEnd(26)} ${m.spec}`);
    console.log('\nMUTANT SỐNG SÓT = SPEC YẾU, không phải gate yếu. Thấy mutant sống thì bổ sung SPEC.');
    return;
  }

  const chi = val('gate');
  const ds = chi ? MUC_TIEU.filter((m) => m.gate.includes(chi)) : MUC_TIEU;
  if (!ds.length) {
    console.error(`[selfmutate] ✗ không có mục tiêu nào khớp "${chi}". Xem \`--liet-ke\`.`);
    process.exit(2);
  }

  const ra = [];
  for (const m of ds) {
    if (!JSON_OUT) console.log(`[selfmutate] ${m.gate} …`);
    ra.push(chayMotGate(m));
  }

  const songSot = [];
  const boQua = [];
  let biBat = 0;
  let khongApDung = 0;
  for (const r of ra) {
    if (r.bo_qua) { boQua.push({ gate: r.gate, vi_sao: r.bo_qua }); continue; }
    for (const mu of r.mutant) {
      if (mu.trang_thai === 'bi_bat') biBat += 1;
      else if (mu.trang_thai === 'song_sot') songSot.push({ gate: r.gate, ...mu });
      else khongApDung += 1;
    }
  }

  const kq = { so_gate: ds.length, bi_bat: biBat, song_sot: songSot, khong_ap_dung: khongApDung, bo_qua: boQua, chi_tiet: ra };
  if (JSON_OUT) { console.log(JSON.stringify(kq, null, 2)); process.exit(songSot.filter((x) => !x.ngoai_duong_phan).length ? 1 : 0); }

  console.log('');
  console.log(`[selfmutate] ${biBat} mutant BỊ BẮT · ${songSot.length} SỐNG SÓT · ${khongApDung} không áp được`);
  if (boQua.length) {
    console.log(`\n${boQua.length} gate BỎ QUA:`);
    for (const b of boQua) console.log(`  ${b.gate} — ${b.vi_sao}`);
  }
  if (!songSot.length) {
    console.log('\n✓ Mọi mutant áp được đều bị spec bắt.');
    console.log('  GIỚI HẠN: "không áp được" KHÔNG phải "đã bắt". Bộ đột biến chỉ phủ bốn lớp lỗi đã gặp,');
    console.log('  nên kết quả này nói "spec bắt được bốn lớp đó", không nói "spec đủ mạnh".');
    return;
  }
  const trenDuong = songSot.filter((x) => !x.ngoai_duong_phan);
  const ngoaiDuong = songSot.filter((x) => x.ngoai_duong_phan);

  if (trenDuong.length) {
    console.log(`\n✗ ${trenDuong.length} MUTANT SỐNG SÓT TRÊN ĐƯỜNG PHÁN — spec KHÔNG bắt được khi gate bị làm hỏng:`);
    for (const s of trenDuong) {
      console.log(`  ${s.gate}:${s.vi_tri ? s.vi_tri.dong : '?'} · ${s.ma}: ${s.y}`);
      console.log(`    ${s.lo_that}`);
      if (s.vi_tri) console.log(`    dòng bị đổi: ${s.vi_tri.van.slice(0, 110)}`);
    }
    console.log('\n  Đây mới là SPEC YẾU. Bổ sung spec cho đúng lớp lỗi đó.');
  }

  if (ngoaiDuong.length) {
    console.log(`\n○ ${ngoaiDuong.length} mutant sống sót NGOÀI đường phán — đây là giới hạn của BỘ ĐỘT BIẾN,`);
    console.log('  không phải kết luận về spec. Toán tử thay chỗ KHỚP VĂN BẢN ĐẦU TIÊN, và chỗ đó không');
    console.log('  thuộc luật gác:');
    for (const s of ngoaiDuong) {
      console.log(`  ${s.gate}:${s.vi_tri ? s.vi_tri.dong : '?'} · ${s.ma} — ${s.ngoai_duong_phan}`);
      if (s.vi_tri) console.log(`    dòng bị đổi: ${s.vi_tri.van.slice(0, 110)}`);
    }
    console.log('  Vẫn phải ĐỌC từng dòng, vì loại này KHÔNG có nghĩa "không sao". Lượt đầu 12/10/2026 có 3');
    console.log('  mutant loại này và 2 trong 3 dẫn tới lỗ spec THẬT ở chỗ khác — cờ `--task` phải thắng env,');
    console.log('  và dòng sổ nợ phải nêu TC ID. Hai cái còn sống là nhánh lỗi I/O trên đường ghi file cố định;');
    console.log('  đo được chúng thì phải cho gate nhận đường dẫn từ env, tức mở một cửa sau tệ hơn cái nó đo.');
  }
  process.exit(trenDuong.length ? 1 : 0);
}

if (require.main === module) main();

module.exports = { DOT_BIEN, MUC_TIEU, ganDotBien, sachChua, chayMotGate, viTri, ngoaiDuongPhan };
