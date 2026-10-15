#!/usr/bin/env node
/**
 * skills_refcheck.js — mọi LINK THẬT trong skill phải trỏ tới file có thật.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * CÁI BẪY MÁY NÀY PHẢI TRÁNH, và nó là lý do máy tồn tại ở dạng này.
 *
 * Kit A (QIG QA) bị đếm là "5 link chết". Mở từng cái ra ngày 14/10/2026 thì **cả 5 là đường dẫn MINH
 * HOẠ**, không phải tham chiếu tới file lẽ ra phải tồn tại:
 *
 *   · `../../requirements/<module>/requirements_<module>.md` — có `<module>`, là đường dẫn MẪU;
 *   · `parts/part_01_danh_sach.md`, `part_02_tao_sua.md` — nằm trong bảng, sau chữ "VD";
 *   · `stories/story_01_danh_sach.md` — ví dụ minh hoạ output;
 *   · `execution_report.md` — tên file ĐẦU RA vẽ trong sơ đồ luồng.
 *
 * Tức A có **0 link gãy thật**, và con số 5 là dương tính giả của phép đếm. Một máy canh viết ngây thơ
 * sẽ tái tạo đúng dương tính giả đó — rồi người ta sẽ tắt nó, hoặc tệ hơn: sửa tài liệu cho hết đỏ bằng
 * cách bỏ các ví dụ, tức làm tài liệu nghèo đi để chiều một cái máy đếm sai.
 *
 * Nên máy này phân biệt hai loại, và có đối chứng hai chiều trong `tests/fe/infra/skills-refcheck.spec.ts`
 * dùng CHÍNH 5 ca của A làm bộ âm bản — chúng là ví dụ thật, không phải ca bịa ra cho vừa.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: npm run skills:refcheck [-- --dir <thư mục skill>]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

/**
 * Đường dẫn MINH HOẠ — không tính là link cần tồn tại.
 *
 * Bốn dấu hiệu, mỗi cái ứng với một ca thật quan sát được ở kit A. Thiếu một dấu hiệu nào thì ca tương
 * ứng quay lại thành dương tính giả.
 */
function laMinhHoa(duong, dongChua) {
  /* ① placeholder: `<module>`, `{task}`, `[TÊN]`… — không phải đường dẫn của một file cụ thể nào. */
  if (/[<{]\w|\$\{/.test(duong)) return 'placeholder';
  /*
   * ĐÃ THỬ VÀ BỎ: luật "đứng sau chữ VD/ví dụ trên cùng dòng".
   *
   * Nó quá rộng. Chạy trên kit A ngày 14/10/2026: luật đó bỏ qua 3 link tới
   * `references/CODE_TEMPLATES.md` — một file CÓ THẬT, tức link thật bị xếp nhầm thành ví dụ. Một luật
   * bỏ qua được link thật thì nó nuốt luôn link gãy thật, và cửa này mất tác dụng đúng lúc cần.
   *
   * Ba dấu hiệu còn lại (placeholder · ô bảng mô tả đầu ra · khối mã) đủ phủ cả 5 ca của A.
   */
  /* ③ nằm trong một ô bảng mô tả output (dòng bảng có chữ "output"/"đầu ra"/"sinh ra"). */
  if (/^\s*\|/.test(dongChua) && /(output|đầu ra|sinh ra|kết quả)/i.test(dongChua)) return 'tên-file-đầu-ra';
  /* ④ nằm trong khối mã — do người gọi truyền vào. */
  return null;
}

/** Tách link markdown kèm số dòng và nội dung dòng, BỎ phần trong khối mã. */
function timLink(src) {
  const dong = src.split(/\r?\n/);
  const ra = [];
  let trongKhoiMa = false;
  for (let i = 0; i < dong.length; i += 1) {
    const l = dong[i];
    if (/^\s*```/.test(l)) { trongKhoiMa = !trongKhoiMa; continue; }
    if (trongKhoiMa) continue;                       /* ④ khối mã là ví dụ, không phải tham chiếu */
    for (const m of l.matchAll(/\]\(([^)\s]+)\)/g)) {
      const d = m[1];
      if (/^(?:https?:|mailto:|#)/.test(d)) continue; /* link ngoài và neo trong trang: không kiểm ở đây */
      ra.push({ duong: d, dong: i + 1, noiDung: l });
    }
  }
  return ra;
}

function quet(goc) {
  const ra = [];
  const di = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, f.name);
      if (f.isDirectory()) { di(q); continue; }
      if (!f.name.endsWith('.md')) continue;
      const src = fs.readFileSync(q, 'utf8');
      for (const l of timLink(src)) {
        const sach = l.duong.split('#')[0];
        if (!sach) continue;
        const lydo = laMinhHoa(sach, l.noiDung);
        const dich = path.resolve(path.dirname(q), sach);
        ra.push({
          file: path.relative(REPO, q), ...l, minhHoa: lydo, ton_tai: fs.existsSync(dich),
        });
      }
    }
  };
  di(goc);
  return ra;
}

module.exports = { laMinhHoa, timLink, quet };

if (require.main === module) {
  const dir = path.resolve(arg('dir', path.join(REPO, '.agent', 'skills')));
  if (!fs.existsSync(dir)) {
    console.error(`[refcheck] ✗ không có thư mục: ${dir}`);
    process.exit(2);
  }
  const tatCa = quet(dir);
  const that = tatCa.filter((x) => !x.minhHoa);
  const gay = that.filter((x) => !x.ton_tai);
  const boQua = tatCa.filter((x) => x.minhHoa);

  console.log(`[refcheck] ${tatCa.length} link · ${that.length} link THẬT · ${boQua.length} đường dẫn minh hoạ (bỏ qua) · ${gay.length} GÃY`);
  for (const b of boQua) console.log(`[refcheck]   bỏ qua (${b.minhHoa}): ${b.file}:${b.dong} → ${b.duong}`);
  for (const g of gay) console.error(`[refcheck] ✗ GÃY: ${g.file}:${g.dong} → ${g.duong}`);

  if (gay.length) {
    console.error('[refcheck] Link trong skill phải trỏ file có thật. Nếu đó là ĐƯỜNG DẪN MINH HOẠ thì viết nó');
    console.error('           dùng placeholder, để trong khối mã, hoặc đặt ở ô bảng mô tả đầu ra —');
    console.error('           đừng gỡ ví dụ đi cho hết đỏ: đó là làm tài liệu nghèo hơn để chiều một máy đếm.');
    process.exit(1);
  }
}
