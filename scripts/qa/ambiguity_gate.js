#!/usr/bin/env node
'use strict';
/*
 * ambiguity:gate — CỔNG MƠ HỒ, nay có CODE đứng sau chứ không chỉ có lời dặn.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY.
 *
 * `04_prepare_context.md` bước 7 bảo "DỪNG tới khi `AMBIGUITY_GATE: RESOLVED`". Đo 16/10/2026:
 * **không script nào** đọc khoá đó rồi `exit 1`. `discover.js` chỉ GHI dòng đó vào file câu hỏi. Tức
 * việc dừng phụ thuộc hoàn toàn vào agent tự tuân thủ, và `RESOLVED` thì do người tick.
 *
 * Kit có một câu riêng cho chuyện này: luật không có máy thi hành là luật chỉ dặn suông.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * HAI CÁI BẪY ĐO ĐƯỢC, và chúng đổi hẳn thiết kế so với bản phác đầu.
 *
 * **① `RESOLVED` không phải một trạng thái — có BA, và hai cái CHỨA chuỗi `RESOLVED`.**
 *
 *   TASK-3544 `PARTIALLY RESOLVED` · TASK-9001 `RESOLVED` · TASK-9002 `PARTIALLY RESOLVED` ·
 *   TASK-9003 `RESOLVED` · TASK-9004 `RESOLVED-BY-DEFAULT`.
 *
 *   Kiểm bằng `includes('RESOLVED')` ⇒ hai cái kia lọt qua IM LẶNG: gate xanh mà không gác gì, đúng lớp
 *   lỗi "không chạy mà báo đạt". Kiểm bằng `=== 'RESOLVED'` ⇒ chặn 3/5 task ĐANG CHẠY, trong đó 9004 đã
 *   có quyết định của QA hẳn hoi. Cả hai hướng đều sai, nên phải so KHỚP CHÍNH XÁC với một danh sách
 *   khai tường minh (`ambiguity_states.json`), và mỗi trạng thái gánh một NGHĨA VỤ riêng.
 *
 * **② Dòng khoá có BỐN hình dạng** trên 5 task: bold inline · tiêu đề `##` · ô bảng markdown · bold kèm
 *   hậu tố. Một regex một-khuôn đọc trượt ít nhất một task — và "đọc trượt" ở đây ra kết quả
 *   "không thấy khoá", mà bản phác đầu lại bảo coi "không khai" là CHẶN. Tức một lỗi đọc sẽ hoá thành
 *   một lệnh chặn sai.
 *
 * CHẾ ĐỘ DI TRÚ (`_che_do: "di_tru"`): chỉ CHẶN ca rõ ràng sai — `PENDING` mà đã có case. Trạng thái lạ
 * hoặc thiếu khoá ⇒ CẢNH BÁO + ghi sổ nợ. Bật `chat` khi sổ nợ về 0. Bật sớm thì 3/5 task đỏ ngay, và
 * một cửa đỏ oan là cửa người ta tắt — kit đã nói câu đó ở năm chỗ khác.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/ambiguity_gate.js --task <TASK_KEY> [--pod <PROJECT_OUTPUT_DIR>] [--json] [--chat]
 * Exit: 0 đạt (có thể kèm cảnh báo) · 1 CHẶN · 2 không phán được
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const CFG = path.join(REPO, '.agent', 'config', 'ambiguity_states.json');

function napCauHinh(duong = CFG) {
  if (!fs.existsSync(duong)) return { loi: `thiếu \`${path.relative(REPO, duong).split(path.sep).join('/')}\`` };
  try {
    const j = JSON.parse(fs.readFileSync(duong, 'utf8'));
    if (!Array.isArray(j.trang_thai) || !j.trang_thai.length) return { loi: 'config không khai `trang_thai` nào' };
    return j;
  } catch (e) { return { loi: `config SAI cú pháp JSON (${e.message})` }; }
}

/**
 * Bóc giá trị `AMBIGUITY_GATE` khỏi `task.md`, chịu được cả bốn hình dạng đã đo.
 *
 * Trả `{ gia_tri }`, hoặc `{ thieu: true }` khi không có khoá nào.
 *
 * KHÔNG dùng `includes`: xem bẫy ① ở đầu file. Cắt ở dấu câu kết thúc mệnh đề (`—`, `(`, `.`, `|`) vì
 * ba task ghi thêm lời giải thích ngay sau giá trị.
 */
function bocTrangThai(noiDung) {
  const m = String(noiDung).match(/AMBIGUITY_GATE\s*\**\s*[:|]?\s*\**\s*([A-Za-z][A-Za-z\s-]*)/);
  if (!m) return { thieu: true };
  const tho = m[1]
    .replace(/\*+/g, ' ')
    .split(/[—(.|]/)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return { gia_tri: tho };
}

/**
 * Trạng thái khai trong config khớp DÀI NHẤT với chuỗi đọc được.
 *
 * Khớp dài nhất chứ không khớp đầu tiên: `RESOLVED` là tiền tố của `RESOLVED-BY-DEFAULT`, và khớp đầu
 * tiên sẽ nhận nhầm cái sau thành cái trước — tức áp sai nghĩa vụ, và áp sai theo hướng NHẸ hơn.
 */
function khopTrangThai(giaTri, cfg) {
  const ds = [...cfg.trang_thai].sort((a, b) => b.ten.length - a.ten.length);
  /*
   * KHỚP CHÍNH XÁC trước. Chỉ khi không có mới cho phép "trạng thái + chữ thừa phía sau", và vẫn theo
   * thứ tự DÀI NHẤT trước — vì `RESOLVED` là tiền tố của `RESOLVED-BY-DEFAULT`, và nhận nhầm cái sau
   * thành cái trước là áp sai nghĩa vụ theo hướng NHẸ hơn.
   */
  return ds.find((t) => giaTri === t.ten)
    || ds.find((t) => giaTri.startsWith(`${t.ten} `))
    || null;
}

/** Chuẩn hoá nhãn mức về một trong bốn giá trị, hoặc trả nguyên văn nếu không nhận ra. */
function chuanMuc(tho) {
  const s = String(tho).replace(/~~/g, '').replace(/\*+/g, '').trim();
  if (/critical/i.test(s)) return 'Critical';
  if (/high/i.test(s)) return 'High';
  if (/medium/i.test(s)) return 'Medium';
  if (/low/i.test(s)) return 'Low';
  return s;
}

/**
 * Câu hỏi trong `phase1-clarifications.md`. HAI KHUÔN, vì task thật dùng cả hai:
 *
 *   · HÀNG BẢNG   — `| Q7 | Medium | nội dung | trả lời |`            (TASK-9002)
 *   · TIÊU ĐỀ     — `### Q1 — nội dung · Critical` rồi thân ở dưới     (TASK-9003, 9004, 3544)
 *
 * Bản đầu chỉ đọc khuôn bảng, và hệ quả đo được: 3/5 task ra "không đọc được câu hỏi nào". Trong chế độ
 * CHẶT, ba task đó sẽ bị chặn vì BỘ ĐỌC của tôi thiếu khuôn — tức một hạn chế của máy hoá thành một
 * cáo buộc về công việc của người. Đó là dương tính giả tệ nhất: nó đổ lỗi sai chỗ.
 */
function docCauHoi(noiDung) {
  const ra = [];
  /*
   * TÁCH DÒNG BẰNG `\r?\n`, không bằng `\n`.
   *
   * Lần thứ BẢY kit vấp lớp lỗi CRLF, và lần này nó ẩn hơn sáu lần trước. Trong JavaScript, `.` KHÔNG
   * khớp `\r` (nó là ký tự kết thúc dòng), và `$` không khớp trước `\r`. Nên một regex kết thúc bằng
   * `(.*)$` trượt TOÀN BỘ dòng của file CRLF — im lặng, không lỗi.
   *
   * Hệ quả đo được 16/10/2026: `TASK-9004` có 21 tiêu đề câu hỏi mà máy đọc ra **0**. Trong chế độ
   * CHẶT, task đó sẽ bị chặn vì BỘ ĐỌC thiếu, tức một hạn chế của máy hoá thành cáo buộc về công việc
   * của người — dương tính giả tệ nhất, vì nó đổ lỗi sai chỗ.
   */
  const dong = String(noiDung).split(/\r?\n/);

  /* ── Khuôn 1: hàng bảng ────────────────────────────────────────────────────────────────────────── */
  for (const d of dong) {
    const m = d.match(/^\s*\|\s*(Q[0-9][0-9a-z]*)\s*\|\s*([^|]*)\|(.*)$/);
    if (!m) continue;
    /*
     * GIỮ Ô RỖNG. Bản đầu lọc `x !== ''` NGAY ở đây, và hệ quả: hàng `| Q2 | Critical | câu hỏi |  |`
     * mất ô trả lời rỗng, `than` còn lại đúng chữ câu hỏi, nên câu CHƯA CÓ ĐÁP ÁN trông như đã có đáp.
     * Phép kiểm toàn vẹn khi đó xanh trên đúng ca nó sinh ra để bắt.
     *
     * Chỉ bỏ ô cuối rỗng do dấu `|` kết thúc bảng, rồi mới tách: ô cuối là TRẢ LỜI, các ô trước là câu.
     * Bảng 3 cột (`| Qn | Mức | trạng thái |`) thì ô duy nhất đó chính là trả lời.
     */
    const con = m[3].split('|').map((x) => x.trim());
    if (con.length && con[con.length - 1] === '') con.pop();
    const traLoi = con.length ? con[con.length - 1] : '';
    ra.push({
      ma: m[1],
      muc: chuanMuc(m[2]),
      /* `~~Critical~~` = đã gạch bỏ, tức đã giải — cờ riêng, đừng coi như chưa có mức. */
      da_gach: /~~/.test(m[2]),
      than: con.filter((x) => x !== '').join(' | '),
      tra_loi: traLoi,
      khuon: 'bang',
    });
  }

  /*
   * ── Khuôn 2: tiêu đề `### Qn — … · Mức`, HOẶC mức THỪA KẾ TỪ MỤC CHA ───────────────────────────
   *
   * Bản đầu chỉ đọc mức ở DÒNG CÂU HỎI, và đo 16/10/2026 cho thấy hệ quả: **41/83 câu (49%) trên 5
   * task thật không có mức nào máy đọc được** — nên chúng KHÔNG được áp nghĩa vụ nào. Một gate gác
   * im lặng nửa số câu thì phần "đã gác" của nó là lời khai, không phải phép đo.
   *
   * Nguyên nhân không phải tài liệu thiếu nhãn: `TASK-9004` đặt mức ở TIÊU ĐỀ MỤC (`## CRITICAL`,
   * `## HIGH — …`), `TASK-9003` nhóm theo `## Blocking` / `## Non-blocking`. Nhãn có đủ, máy đọc thiếu.
   *
   * Thừa kế CÓ ĐIỀU KIỆN, cố ý hẹp: chỉ khi tiêu đề mục nói rõ một mức, hoặc nói rõ "non-blocking".
   * Tiêu đề kiểu `## Blocking — đã trả lời` KHÔNG suy ra Critical: "chặn" và "mức" là hai chuyện, và
   * suy bừa ở đây sẽ tạo nghĩa vụ cho câu mà người viết không hề gán mức.
   */
  const mucCuaMuc = (tieuDeMuc) => {
    const s = String(tieuDeMuc).toLowerCase();
    if (/non-?blocking|không chặn/.test(s)) return 'Medium';
    if (/\bcritical\b/.test(s)) return 'Critical';
    if (/\bhigh\b/.test(s)) return 'High';
    if (/\bmedium\b/.test(s)) return 'Medium';
    if (/\blow\b/.test(s)) return 'Low';
    return null;
  };

  let mucThuaKe = null;
  for (let i = 0; i < dong.length; i += 1) {
    /* Tiêu đề mục (không phải câu hỏi) ⇒ cập nhật mức thừa kế cho các câu phía dưới. */
    const h = dong[i].match(/^#{1,3}\s+(?!Q[0-9])(.*)$/);
    if (h) mucThuaKe = mucCuaMuc(h[1]);

    const m = dong[i].match(/^#{2,4}\s*(Q[0-9][0-9a-z]*)\b(.*)$/);
    if (!m) continue;
    const tieuDe = m[2];
    /* Thân = tới tiêu đề cùng mức kế tiếp. Đó là chỗ chứa câu trả lời, nên phải lấy để biết rỗng hay không. */
    const than = [];
    for (let j = i + 1; j < dong.length && !/^#{2,4}\s/.test(dong[j]); j += 1) than.push(dong[j]);
    ra.push({
      ma: m[1],
      /* Mức ở DÒNG CÂU HỎI thắng; không có thì thừa kế từ mục cha. */
      muc: (() => {
        const tren_dong = chuanMuc(tieuDe);
        const nhanRo = ['Critical', 'High', 'Medium', 'Low'].includes(tren_dong);
        return nhanRo ? tren_dong : (mucThuaKe || tren_dong);
      })(),
      da_gach: /~~/.test(tieuDe) || /đã giải|đã trả lời|resolved/i.test(tieuDe),
      than: than.join('\n').trim(),
      /* Khuôn tiêu đề không có ô riêng cho trả lời — cả THÂN là chỗ câu trả lời nằm. */
      tra_loi: than.join('\n').trim(),
      khuon: 'tieu_de',
    });
  }

  /* Cùng một mã xuất hiện ở cả hai khuôn ⇒ giữ bản TIÊU ĐỀ (thân dài hơn, nhiều thông tin hơn). */
  const theoMa = new Map();
  for (const c of ra) {
    const cu = theoMa.get(c.ma);
    if (!cu || (cu.khuon === 'bang' && c.khuon === 'tieu_de')) theoMa.set(c.ma, c);
  }
  return [...theoMa.values()];
}

const CO_NGUOI_NGAY = /ACCEPTED-BY\s*:\s*\S+|QA\s*chốt\s*\d|chốt\s*\d{1,2}\/\d{1,2}\/\d{4}/i;

/** Kiểm nghĩa vụ của một trạng thái. Trả danh sách vi phạm (chuỗi đọc được). */
function kiemNghiaVu({ trangThai, cauHoi, noiDungClarif, noiDungTask }) {
  const viPham = [];
  for (const nv of (trangThai.nghia_vu || [])) {
    if (nv === 'cau_critical_high_phai_co_tra_loi') {
      for (const c of cauHoi) {
        if (!['Critical', 'High'].includes(c.muc) || c.da_gach) continue;
        /*
         * Hỏi Ô TRẢ LỜI, không hỏi cả hàng: chữ của chính câu hỏi không phải câu trả lời.
         *
         * Và hỏi "có CHỮ hoặc SỐ nào không", chứ không liệt kê emoji để trừ đi. Bản đầu dùng lớp ký
         * tự `[⚠️🟡✅🔴…]` — eslint bắt đúng: emoji ghép và cặp surrogate trong lớp ký tự khớp sai âm
         * thầm. Một ô chỉ có emoji cũng không phải câu trả lời, nên phép hỏi này vừa đúng hơn vừa
         * không phải nuôi một danh sách emoji.
         */
        const coTraLoi = /[\p{L}\p{N}]/u.test(String(c.tra_loi || ''));
        if (!coTraLoi && !CO_NGUOI_NGAY.test(c.than)) {
          viPham.push(`${c.ma} (${c.muc}) chưa có câu trả lời, và không có dấu chấp nhận kèm người + ngày`);
        }
      }
    }
    if (nv === 'cau_con_mo_phai_noi_chan_gi') {
      for (const c of cauHoi) {
        if (!['Critical', 'High'].includes(c.muc) || c.da_gach) continue;
        /* Câu còn mở nhận ra bằng dấu cảnh báo hoặc chữ "chưa"; phải nói nó chặn gì. */
        const conMo = /⚠|🟡|chưa|pending/i.test(c.than);
        if (conMo && !/chặn|block|không drive|dừng/i.test(c.than)) {
          viPham.push(`${c.ma} (${c.muc}) còn mở mà KHÔNG nói nó chặn gì — không phân biệt được với PENDING`);
        }
      }
    }
    if (nv === 'phai_co_nguoi_va_ngay') {
      const nguon = `${noiDungTask}\n${noiDungClarif}`;
      if (!CO_NGUOI_NGAY.test(nguon)) {
        viPham.push('trạng thái chốt-theo-mặc-định mà KHÔNG có người + ngày — không có chủ thì nó chỉ là PENDING đổi tên');
      }
    }
  }
  return viPham;
}

/**
 * A3 — VÙNG MÙ CỦA DISCOVERY MÀ CHƯA THÀNH CÂU HỎI. **Cảnh báo, không chặn.**
 *
 * `discovery/fuse.js` xếp mỗi vùng vào bốn ô; `undocumented_present` (quan sát được trên app nhưng
 * tài liệu không có) là vùng mù chính. Nếu một vùng mù không xuất hiện trong `phase1-clarifications.md`
 * thì nó sẽ được viết case bằng cách nhìn app — tautology, và nó nhân lên theo số case.
 *
 * KHÔNG tự thêm câu hỏi, và KHÔNG chặn: máy đọc được "có vùng mù chưa thành câu hỏi", nhưng không biết
 * vùng đó có đáng hỏi hay không. Quyết định đó là của người, và một gate chặn ở đây sẽ ép người ta viết
 * câu hỏi lấy lệ cho đủ số.
 */
function vungMuChuaHoi({ docCoverage, noiDungClarif }) {
  if (!docCoverage || !Array.isArray(docCoverage.doc_coverage)) return [];
  const mu = docCoverage.doc_coverage
    .filter((x) => x && x.o === 'undocumented_present' && x.vung)
    .map((x) => String(x.vung));
  return [...new Set(mu)].filter((v) => !String(noiDungClarif).includes(v));
}

/** Phán một task. Trả `{ ma, dong[] }` — `ma` 0 đạt · 1 chặn · 2 không phán được. */
function phan({ taskDir, cfg, chat = false }) {
  const dong = [];
  const taskMd = path.join(taskDir, 'task.md');
  if (!fs.existsSync(taskMd)) {
    return { ma: 2, dong: [`KHÔNG PHÁN ĐƯỢC: thiếu \`${path.relative(REPO, taskMd).split(path.sep).join('/')}\``] };
  }
  const noiDungTask = fs.readFileSync(taskMd, 'utf8');

  const caseDir = path.join(taskDir, 'test-cases');
  const coCase = fs.existsSync(caseDir) && fs.readdirSync(caseDir).some((f) => f.endsWith('.md'));

  const clarif = path.join(taskDir, String(cfg._duong_dan_clarifications || 'reports/phase1-clarifications.md').split('/').slice(-2).join(path.sep));
  const coClarif = fs.existsSync(clarif);
  const noiDungClarif = coClarif ? fs.readFileSync(clarif, 'utf8') : '';

  const doc = bocTrangThai(noiDungTask);

  if (doc.thieu) {
    if (!coCase) return { ma: 0, dong: ['chưa có case và chưa khai khoá — chưa tới lúc gác.'] };
    /* Thiếu khoá + đã có case: ca đáng ngờ, nhưng chế độ di trú KHÔNG chặn — xem khối đầu file. */
    dong.push('CẢNH BÁO: đã có testcase mà `task.md` KHÔNG khai `AMBIGUITY_GATE`.');
    return { ma: chat ? 1 : 0, dong, no: true };
  }

  const tt = khopTrangThai(doc.gia_tri, cfg);
  if (!tt) {
    dong.push(`CẢNH BÁO: trạng thái lạ \`${doc.gia_tri}\` — không có trong \`ambiguity_states.json\`.`);
    dong.push('  Khai nó vào config (kèm nghĩa vụ), hoặc sửa `task.md` cho khớp một trạng thái đã khai.');
    return { ma: chat ? 1 : 0, dong, no: true };
  }

  dong.push(`trạng thái: \`${tt.ten}\``);

  /* CHẶN THẬT, ở cả hai chế độ: cổng chưa mở mà đã sinh case. */
  if (!tt.cho_sinh_case && coCase) {
    dong.push(`CHẶN: \`${tt.ten}\` mà task ĐÃ CÓ testcase — case sinh qua một cổng chưa mở.`);
    return { ma: 1, dong };
  }
  if (!tt.cho_sinh_case) {
    dong.push('chưa có case — đúng, cổng chưa mở.');
    return { ma: 0, dong };
  }

  if (!coClarif) {
    dong.push('CẢNH BÁO: chưa có `reports/phase1-clarifications.md` — không có gì để đối chiếu, nên cổng này CHƯA ĐƯỢC GÁC.');
    return { ma: chat ? 1 : 0, dong, no: true };
  }

  const cauHoi = docCauHoi(noiDungClarif);
  if (!cauHoi.length) {
    dong.push('CẢNH BÁO: không đọc được câu hỏi nào trong clarifications — khuôn bảng có thể đã đổi.');
    return { ma: chat ? 1 : 0, dong, no: true };
  }

  const viPham = kiemNghiaVu({ trangThai: tt, cauHoi, noiDungClarif, noiDungTask });
  dong.push(`đọc ${cauHoi.length} câu hỏi · nghĩa vụ: ${(tt.nghia_vu || []).join(', ') || '(không)'}`);

  /*
   * CÂU KHÔNG CÓ MỨC ⇒ CẢNH BÁO. Đây là chỗ máy PHÁN ĐƯỢC, khác hẳn chỗ nó không phán được.
   *
   * Máy KHÔNG thẩm định được một câu gán `Critical` có đúng là Critical không — đó là việc của người.
   * Nhưng "không gán mức nào" thì máy thấy rõ, và nó là đường lách IM LẶNG: mọi nghĩa vụ ở trên đều
   * lọc theo `Critical/High`, nên câu không nhãn đi qua mà không chạm phép kiểm nào.
   *
   * Đo 16/10/2026 trên 5 task thật: **25/83 câu (30%) không có mức** máy đọc được, sau khi đã thừa kế
   * mức từ tiêu đề mục. Chúng nằm dưới những mục như "Câu hỏi PHÁT SINH từ dò quan hệ bảng DB" — tức
   * tài liệu thật sự không gán, không phải máy đọc thiếu.
   *
   * CẢNH BÁO chứ không chặn: gán mức là việc của người, và chặn ở đây sẽ ép gán mức lấy lệ cho đủ số.
   */
  const khongMuc = cauHoi.filter((c) => !['Critical', 'High', 'Medium', 'Low'].includes(c.muc));
  if (khongMuc.length) {
    const ty = Math.round((khongMuc.length / cauHoi.length) * 100);
    dong.push(`CẢNH BÁO (không chặn): ${khongMuc.length}/${cauHoi.length} câu (${ty}%) KHÔNG gán mức —`
      + ` mọi nghĩa vụ đều lọc theo Critical/High, nên câu không nhãn không chạm phép kiểm nào.`);
    dong.push(`  · ${khongMuc.slice(0, 6).map((c) => c.ma).join(', ')}${khongMuc.length > 6 ? ` … (+${khongMuc.length - 6})` : ''}`);
  }
  if (viPham.length) {
    dong.push(`${chat ? 'CHẶN' : 'CẢNH BÁO'}: ${viPham.length} nghĩa vụ chưa thoả:`);
    for (const v of viPham) dong.push(`  - ${v}`);
    return { ma: chat ? 1 : 0, dong, no: true };
  }

  dong.push('nghĩa vụ của trạng thái này đã thoả.');
  return { ma: 0, dong };
}

/** Gắn cảnh báo A3 vào kết quả. Tách khỏi `phan()` vì nó KHÔNG đổi verdict — chỉ thêm dòng đọc được. */
function themCanhBaoVungMu(kq, { docCoverage, noiDungClarif }) {
  const mu = vungMuChuaHoi({ docCoverage, noiDungClarif });
  if (!mu.length) return kq;
  kq.dong.push(`CẢNH BÁO (không chặn): ${mu.length} vùng mù của discovery CHƯA thành câu hỏi:`);
  for (const v of mu.slice(0, 8)) kq.dong.push(`  · ${v}`);
  if (mu.length > 8) kq.dong.push(`  · … (+${mu.length - 8} vùng nữa)`);
  kq.dong.push('  Vùng không có nguồn thì expected chỉ còn là "app đang hiện thế" — tautology.');
  return kq;
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const task = val('task') || process.env.TASK_KEY;
  const pod = val('pod') || process.env.PROJECT_OUTPUT_DIR;
  if (!task || !pod) {
    console.error('[ambiguity] KHÔNG PHÁN ĐƯỢC: thiếu `--task` hoặc `--pod` (TASK_KEY / PROJECT_OUTPUT_DIR).');
    process.exit(2);
  }

  const cfg = napCauHinh();
  if (cfg.loi) { console.error(`[ambiguity] KHÔNG PHÁN ĐƯỢC: ${cfg.loi}`); process.exit(2); }

  const chat = argv.includes('--chat') || cfg._che_do === 'chat';
  const taskDir = path.resolve(REPO, pod, 'tasks', task);
  const r = phan({ taskDir, cfg, chat });

  /*
   * A3 — cảnh báo vùng mù. Đọc lượt discovery MỚI NHẤT; không có thì bỏ qua im lặng, vì discovery là
   * bước tuỳ chọn và "chưa chạy discovery" không phải một vi phạm của cổng mơ hồ.
   */
  try {
    const goc = path.join(REPO, 'knowledge', 'system', 'discovery');
    const lan = fs.existsSync(goc)
      ? fs.readdirSync(goc).filter((d) => fs.existsSync(path.join(goc, d, 'doc_coverage.json'))).sort().pop()
      : null;
    if (lan) {
      const clarif = path.join(taskDir, 'reports', 'phase1-clarifications.md');
      themCanhBaoVungMu(r, {
        docCoverage: JSON.parse(fs.readFileSync(path.join(goc, lan, 'doc_coverage.json'), 'utf8')),
        noiDungClarif: fs.existsSync(clarif) ? fs.readFileSync(clarif, 'utf8') : '',
      });
    }
  } catch (e) { /* vùng mù là phần THÊM; hỏng ở đây không được làm hỏng verdict chính */ }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ task, ma: r.ma, dong: r.dong, no: !!r.no }, null, 2));
    process.exit(r.ma);
  }

  console.log(`[ambiguity] ${task} · chế độ ${chat ? 'CHẶT' : 'DI TRÚ'}`);
  for (const d of r.dong) console.log(`  ${d}`);

  if (r.no && !chat) {
    console.log('\n  Chế độ DI TRÚ: ghi sổ nợ, chưa chặn. Bật chặn toàn phần bằng `--chat` hoặc đổi');
    console.log('  `_che_do` trong `ambiguity_states.json` — làm khi sổ nợ về 0.');
  }
  process.exit(r.ma);
}

if (require.main === module) main();

module.exports = { napCauHinh, bocTrangThai, khopTrangThai, docCauHoi, kiemNghiaVu, phan, vungMuChuaHoi, themCanhBaoVungMu, CFG };
