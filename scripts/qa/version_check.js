#!/usr/bin/env node
'use strict';

/*
 * version_check.js — CHẶN phát hành thiếu sót.
 *
 * VÌ SAO CẦN. Kit được phát cho nhiều dự án và sửa rất thường xuyên. Ba hệ quả của việc không có version:
 * không biết dự án nào đang ở bản nào (có bản vá quan trọng thì không có đường thông báo) · không có mốc để
 * quay lui · và bản phát ra không kèm câu trả lời cho câu hỏi duy nhất người nhận cần: **nâng bản này có phải
 * sửa gì trong lớp PROJECT không?** Chỉ MAJOR/MINOR nói được điều đó; ngày tháng thì không.
 *
 * QUY ƯỚC ĐÃ CHỐT (semver, bump theo LẦN PHÁT HÀNH chứ không theo commit — kit đang ~10 commit/ngày):
 *   MAJOR  dự án BUỘC phải sửa lớp PROJECT (đổi tên config, đổi hợp đồng script, bỏ npm script đang dùng)
 *   MINOR  thêm năng lực/gate; nâng lên là chạy được ngay
 *   PATCH  sửa lỗi, không đổi hợp đồng
 * CHANGELOG giữ nguyên định dạng cũ (ngày + nhóm chủ đề + "vấn đề → cách chữa"), chỉ thêm version vào tiêu đề.
 *
 * CHẠY ĐƯỢC TỪ ZIP KHÔNG CÓ `.git`. Đây không phải chi tiết phụ: người nhận kit giải nén rồi chạy gate, và
 * `ci_scope_check`/`secret_scan` từng crash đúng vì gọi git vô điều kiện. Mọi kiểm cần git ở đây đều
 * try/catch + bỏ qua, KHÔNG exit ≠ 0.
 *
 * Dùng: node scripts/qa/version_check.js [--tag v2.3.0]
 * Exit: 0 đạt · 1 có CHẶN · 2 dùng sai.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?$/;

/** Chạy git; KHÔNG có `.git` (hoặc không có git) thì trả null thay vì ném. */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

const hasGit = fs.existsSync(path.join(REPO, '.git')) && git(['rev-parse', '--git-dir']) !== null;

/** Shared change theo RULE_GLOBAL §Shared Change Gate — đổi ở đây là ảnh hưởng MỌI story đang chạy. */
const SHARED_PATHS = ['playwright.config.js', 'package.json', 'scripts/', 'prompt_templates/', '.agent/', 'tests/support/'];

function main() {
  const argv = process.argv.slice(2);
  const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const problems = [];
  const warnings = [];

  // 1) package.json phải có version hợp semver.
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')); } catch (e) {
    console.error(`[version] package.json không đọc được: ${e.message}`);
    process.exit(2);
  }
  const version = String(pkg.version || '');
  if (!version) problems.push('package.json THIẾU field `version` — không có version thì không phát hành được, và dự án không biết mình đang ở bản nào.');
  else if (!SEMVER.test(version)) problems.push(`version "${version}" không hợp semver (X.Y.Z).`);

  /*
   * 2) Nếu chạy TỪ TAG: version phải KHỚP tag.
   *
   * `GITHUB_REF_NAME` là TÊN NHÁNH khi sự kiện không phải tag — nó chỉ là tên tag khi
   * `GITHUB_REF_TYPE === 'tag'`. Bản đầu đọc thẳng nó, nên chạy `workflow_dispatch` trên `main` thì máy
   * so chuỗi "main" với "2.8.2" rồi CHẶN. Hệ quả đo được 14/10/2026: chế độ `dry_run` của release.yml —
   * vốn sinh ra để "chỉ đóng gói + verify" mà không tạo Release — KHÔNG BAO GIỜ qua nổi bước đầu tiên.
   * Một đường chẩn đoán không chạy được thì lúc cần nhất nó vắng mặt.
   *
   * `--tag` truyền tay vẫn luôn được tôn trọng: nó là lời khai có chủ đích của người gọi.
   */
  const refLaTag = process.env.GITHUB_REF_TYPE
    ? process.env.GITHUB_REF_TYPE === 'tag'
    : /^v?\d+\.\d+\.\d+/.test(String(process.env.GITHUB_REF_NAME || ''));
  const tag = arg('tag')
    || (refLaTag ? process.env.GITHUB_REF_NAME : '')
    || process.env.CI_COMMIT_TAG
    || (hasGit ? git(['describe', '--exact-match', '--tags', 'HEAD']) : null)
    || '';
  if (tag) {
    const want = tag.replace(/^v/, '');
    if (want !== version) {
      problems.push(`tag "${tag}" ↔ package.json version "${version}" LỆCH. Phát hành với hai con số khác nhau thì mọi báo cáo lỗi về sau không tra được về đúng bản.`);
    } else {
      console.log(`[version] tag ${tag} khớp version ${version}`);
    }
  } else {
    console.log('[version] không chạy từ tag — bỏ qua kiểm khớp tag');
  }

  // 3) CHANGELOG phải có mục cho version này.
  const clPath = path.join(REPO, 'CHANGELOG.md');
  if (!fs.existsSync(clPath)) {
    problems.push('THIẾU CHANGELOG.md.');
  } else if (version) {
    const cl = fs.readFileSync(clPath, 'utf8');
    const hasEntry = new RegExp(`^##\\s.*v${version.replace(/\./g, '\\.')}(\\s|$|\\D)`, 'm').test(cl);
    if (!hasEntry) {
      problems.push(`CHANGELOG.md KHÔNG có mục cho v${version} — phát hành mà không ghi thay đổi = dự án nhận bản mới không biết đã đổi gì, và đó chính là lý do file CHANGELOG tồn tại. Thêm một mục dạng "## v${version} — <ngày> — <chủ đề>".`);
    }
  }

  // 4) CẢNH BÁO (không chặn): có shared change kể từ tag trước mà CHANGELOG chưa có mục mới.
  if (hasGit) {
    const prev = git(['describe', '--tags', '--abbrev=0', tag ? `${tag}^` : 'HEAD']);
    if (prev) {
      const changed = (git(['diff', '--name-only', `${prev}..HEAD`]) || '').split('\n').filter(Boolean);
      const shared = changed.filter((f) => SHARED_PATHS.some((p) => f === p || f.startsWith(p)));
      if (shared.length) {
        console.log(`[version] shared change kể từ ${prev}: ${shared.length} file`);
        const cl = fs.existsSync(clPath) ? fs.readFileSync(clPath, 'utf8') : '';
        if (version && !cl.includes(`v${version}`)) {
          warnings.push(`${shared.length} shared change kể từ ${prev} mà CHANGELOG chưa có mục v${version} (vd: ${shared.slice(0, 3).join(', ')}).`);
        }
      }
    }
  } else {
    console.log('[version] không có `.git` (chạy từ gói phát hành) — bỏ qua kiểm shared change');
  }


  /*
   * 5) CHANGELOG: MỤC ĐỈNH phải là bản hiện tại, và thứ tự phải GIẢM DẦN (v2.9.6 N6).
   *
   * Phép kiểm 3) chỉ đòi "có mục cho version này" ở BẤT KỲ đâu trong file. Nó không bắt được ca đã xảy
   * ra thật: đo 30/10/2026, `package.json` ghi 2.9.4 trong khi CHANGELOG đỉnh là v2.9.5 và nhánh đang
   * làm là v2.9.6 — lệch hai bước, mục cho 2.9.4 vẫn tồn tại nên 3) vẫn xanh. Phiên bản lệch không làm
   * lượt chạy nào đỏ, nên nó trôi im lặng; đó đúng là lý do phải có máy.
   *
   * Thứ tự giảm dần là tiền đề của chữ "đỉnh": chèn một mục vào giữa thì "đỉnh" không còn là bản mới
   * nhất, và lúc đó phép kiểm trên đang so với một dòng ngẫu nhiên.
   */
  const clForNew = fs.existsSync(clPath) ? fs.readFileSync(clPath, 'utf8') : '';
  const mucVer = [...clForNew.matchAll(/^##\s+v(\d+\.\d+\.\d+)\b/gm)].map((m) => m[1]);
  if (clForNew && !mucVer.length) {
    problems.push('CHANGELOG.md không có mục nào dạng `## vX.Y.Z` — không có gì để đối chiếu, và "không phán được" KHÔNG thành đạt.');
  } else if (mucVer.length && version && mucVer[0] !== version) {
    problems.push(`CHANGELOG đỉnh là **v${mucVer[0]}** mà package.json ghi **${version}** — một trong hai chưa cập nhật. Mục cho ${version} có thể vẫn tồn tại ở giữa file, nên phép kiểm "có mục" KHÔNG bắt được ca này.`);
  }
  const soSanhVer = (a, b) => {
    const x = a.split('.').map(Number); const y = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  for (let i = 1; i < mucVer.length; i += 1) {
    if (soSanhVer(mucVer[i - 1], mucVer[i]) <= 0) {
      problems.push(`CHANGELOG KHÔNG giảm dần: \`v${mucVer[i - 1]}\` đứng trên \`v${mucVer[i]}\` — "mục đỉnh" chỉ có nghĩa khi thứ tự đúng.`);
      break;
    }
  }

  /*
   * 6) Phần mở đầu CHANGELOG không được khai NGƯỢC với cách nó đang được ghi.
   *
   * Câu cũ ở đó phủ nhận việc kit đánh số theo semver, trong khi 23/23 mục đều mang `## vX.Y.Z` và chính
   * file này đã chốt quy ước semver từ lâu. Một câu dẫn nhập sai dạy người đọc sai về cách đọc cả file.
   *
   * Phép so là so CHỮ, nên nó cũng chặn một ghi chú viết lại nguyên văn câu bị cấm — và đã chặn đúng
   * thế một lần khi tôi viết ghi chú giải thích. Giữ phép so thô có chủ ý: phân biệt "khai" với "trích"
   * bằng máy thì mong manh hơn là chỉ cần diễn đạt lại.
   */
  if (clForNew) {
    const moDau = clForNew.slice(0, clForNew.indexOf('## v') >= 0 ? clForNew.indexOf('## v') : 800);
    if (/ch[ưu]a d[ùu]ng semver|kh[ôo]ng d[ùu]ng semver/i.test(moDau)) {
      problems.push(`phần mở đầu CHANGELOG phủ nhận việc dùng semver, nhưng ${mucVer.length}/${mucVer.length} mục đều mang \`## vX.Y.Z\` — câu đó dạy người đọc sai về cách file này được ghi.`);
    }
  }

  /*
   * 7) SỐ MÁY GÁC VIẾT TAY phải khớp bản MÁY SINH.
   *
   * `GATES.md` do `gates:index` sinh nên nó là nguồn. Đo 30/10/2026: số máy xuất hiện ở 4 chỗ, trong đó
   * `README.md` và `docs/v2.9.5/A_PARITY.md` là bản sao VIẾT TAY — và bản sao viết tay của một con số do
   * máy đếm là một chỗ trôi được.
   *
   * BỎ TÀI LIỆU LỊCH SỬ, và đây là chỗ bản đầu của tôi sai theo chiều PHÁ HOẠI: lượt chạy đầu nó bắt 4
   * "chỗ lệch" ở `CHANGELOG.md` (132 · 80 · 16 máy) và `docs/v2.9.2/PLAN.md` (134 máy). Những con số ấy
   * ĐÚNG Ở THỜI ĐIỂM GHI; bắt chúng khớp số hôm nay là đòi viết lại lịch sử, và làm theo thì mất hẳn
   * khả năng tra ngược kit đã lớn thế nào. Ranh giới mechanical, không cần danh sách miễn trừ viết tay:
   * tài liệu TRẠNG THÁI HIỆN TẠI là .md không phải `CHANGELOG.md` và không nằm dưới thư mục `docs/v…`.
   *
   * ĐÁNH ĐỔI nói rõ: `docs/v2.9.5/A_PARITY.md` cũng bị bỏ qua dù là bảng nghiệm thu đang sống. Số máy ở
   * đó không được cửa này gác — bù lại nó có `parity:check` riêng. Có chủ ý, không phải sót.
   */
  const gatesPath = path.join(REPO, '.agent/config/GATES.md');
  if (!fs.existsSync(gatesPath)) {
    warnings.push('thiếu `.agent/config/GATES.md` ⇒ không đối chiếu được số máy gác viết tay (KHÔNG phải đạt).');
  } else {
    const mTong = fs.readFileSync(gatesPath, 'utf8').match(/Tổng \*\*(\d+)\*\* máy/);
    if (!mTong) {
      warnings.push('`GATES.md` không có dòng `Tổng **N** máy` để lấy làm nguồn ⇒ phép kiểm ⑦ KHÔNG phán được.');
    } else {
      const tongGate = Number(mTong[1]);
      const dsMd = (git(['ls-files', '*.md']) || '').split('\n').map((x) => x.trim()).filter(Boolean);
      let soCho = 0;
      for (const f of dsMd) {
        const duong = f.replace(/\\/g, '/');
        if (duong === 'CHANGELOG.md' || /^docs\/v\d+\.\d+(\.\d+)?\//.test(duong)) continue;
        if (/^(\.agent\/config\/GATES\.md|docs\/RULE_COVERAGE\.md)$/.test(duong)) continue;
        let noi;
        try { noi = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { continue; }
        const dong = noi.split(/\r?\n/);
        for (let i = 0; i < dong.length; i += 1) {
          if (!/GATES\.md/.test(dong[i])) continue;
          for (const m of dong[i].matchAll(/(\d{2,4})\s*(?:\*\*)?\s*(?:máy gác|máy kiểm|máy|gate)\b/gi)) {
            soCho += 1;
            if (Number(m[1]) !== tongGate) {
              problems.push(`${duong}:${i + 1} ghi **${m[1]}** máy, \`GATES.md\` (máy sinh) đếm **${tongGate}** — chạy \`npm run gates:index\` rồi sửa dòng này.`);
            }
          }
        }
      }
      if (!soCho) warnings.push('không .md trạng-thái-hiện-tại nào nhắc số máy kèm `GATES.md` ⇒ phép kiểm ⑦ CHƯA GÁC GÌ ở lượt này (không phải đạt).');
      else console.log(`[version] ⑦ ${soCho} bản sao viết tay của số máy, nguồn \`GATES.md\` = ${tongGate}`);
    }
  }

  console.log(`[version] ${version || '(chưa có)'} · ${problems.length} CHẶN · ${warnings.length} cảnh báo`);
  if (warnings.length) { console.log('\n[version] ⚠ Cảnh báo:'); warnings.forEach((w) => console.log(`  ~ ${w}`)); }
  if (!problems.length) { console.log('\n[version] ✓ ĐẠT'); process.exit(0); }
  console.log('\n[version] ✗ VI PHẠM:');
  problems.forEach((p) => console.log(`  - ${p}`));
  console.log('\n[version] BLOCK.');
  process.exit(1);
}

module.exports = { SEMVER, SHARED_PATHS };
if (require.main === module) main();
