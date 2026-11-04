#!/usr/bin/env node
/**
 * `token:session` — ĐO PHẦN LUÔN NẠP, ĐÚNG NHƯ HARNESS THẤY NÓ.
 *
 * Dùng: node scripts/qa/token_session.js [--json] [--moc]
 *   exit 0 = dưới ngưỡng · 1 = vượt ngưỡng · 2 = KHÔNG PHÁN ĐƯỢC (thiếu thứ để đo)
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PHẦN LUÔN NẠP LÀ GÌ, VÀ VÌ SAO NÓ KHÁC `prompt:budget`
 *
 * `prompt:budget` đo NGÂN SÁCH MỘT LUỒNG: nền auto-load cộng mọi file mà `load_map.json` khai là bắt
 * buộc cho luồng đó. Nó trả lời "chạy Phase 1 tốn bao nhiêu".
 *
 * Máy này đo thứ khác: phần mà MỌI phiên đều trả, kể cả phiên chỉ hỏi một câu. Gồm ba khối, và khối
 * thứ ba là khối dễ quên nhất:
 *
 *   ① CLAUDE.md                     — harness nạp nguyên văn mỗi phiên
 *   ② đầu ra hook SessionStart      — `additionalContext` của inject_context.js
 *   ③ frontmatter `description` của MỌI skill, command, agent mà harness quảng bá
 *
 * Khối ③ không nằm trong `load_map.json` và không ai viết nó vào ngân sách, nhưng đo 04/11/2026 nó là
 * khối LỚN NHẤT: 10,05 KB trên tổng 16,29 KB, trong đó riêng 28 skill chiếm 7,28 KB. Một dòng
 * `description` dài thêm một câu là mọi phiên về sau đắt thêm, mãi mãi, và không gate nào kêu.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * NGƯỠNG LẤY TỪ `.agent/config/prompt_budget.json` khoá `alwaysOnMaxKB` — MỘT NGUỒN DUY NHẤT, cùng
 * chỗ với các ngưỡng còn lại. Không ghi ngưỡng trong file này: hai chỗ khai cùng một số thì sớm muộn
 * lệch nhau, và `_luong_hien_tai` trong chính file config đó đã lệch thật một lần.
 *
 * KHÔNG ĐỦ THỨ ĐỂ ĐO THÌ NÓI THẾ, exit 2 — không trả 0. Trong cây-gói phát hành không có `.claude/`,
 * nên máy này không đo được gì ở đó. Cửa ⑩ của `version_check.js` từng trả "đạt" trong hoàn cảnh y
 * hệt và làm `release:verify` đọc thành 13/15. Một cửa thà im còn hơn đoán.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CAU_HINH = path.join(REPO, '.agent', 'config', 'prompt_budget.json');

/** Hệ số ký-tự-mỗi-token, giữ CÙNG 3,2 với prompt_budget.js và doc_budget.js để hai số so được. */
const KY_TU_MOI_TOKEN = 3.2;

function docFrontmatter(duong) {
  const s = fs.readFileSync(duong, 'utf8');
  const m = s.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

/**
 * Lấy `description` từ khối frontmatter.
 *
 * KHÔNG dùng YAML parser vì không muốn thêm dependency cho một cửa đo; nhưng cũng KHÔNG cắt theo dòng
 * đơn, vì description của kit thường trải nhiều dòng. Nên: đọc từ `description:` tới khoá kế tiếp ở
 * cột 0. Mẫu `": "` không bọc nháy từng làm vỡ YAML và giết agent — xem reference_frontmatter_vo_yaml.
 */
function docDescription(khoi) {
  /*
   * CỐ Ý KHÔNG DÙNG CỜ `/m`. Với `/m`, `$` khớp cuối MỖI DÒNG, nên `[\s\S]*?` lười sẽ dừng ngay cuối
   * dòng đầu và description trải nhiều dòng bị đếm hụt — cửa khi đó báo rẻ hơn thực tế, tức sai đúng
   * về phía nguy hiểm. Bản đầu của hàm này mắc lỗi đó và ca "description trải nhiều dòng" bắt được.
   * Nên: không `/m`, và tự neo đầu dòng bằng `(?:^|\n)`.
   */
  const m = khoi.match(/(?:^|\n)description:\s*([\s\S]*?)(?=\n[A-Za-z_-]+:\s|$)/);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function kb(byte) { return byte / 1024; }

/** Đọc từng mục trong một thư mục quảng bá. `tepCon` khác null ⇒ mỗi mục là một thư mục chứa tệp đó. */
function quetThuMuc(duong, tepCon) {
  if (!fs.existsSync(duong)) return null;
  const ra = [];
  for (const e of fs.readdirSync(duong).sort()) {
    const p = tepCon ? path.join(duong, e, tepCon) : path.join(duong, e);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
    const ten = tepCon ? e : e.replace(/\.md$/, '');
    const mo = docDescription(docFrontmatter(p));
    if (mo === null) continue;
    ra.push({ ten, mo, byte: Buffer.byteLength(`${ten}: ${mo}`, 'utf8'), kyTu: [...mo].length, duong: path.relative(REPO, p) });
  }
  return ra;
}

function dauRaHook() {
  const f = path.join(REPO, 'scripts', 'qa', 'hooks', 'inject_context.js');
  if (!fs.existsSync(f)) return null;
  try {
    const raw = execFileSync(process.execPath, [f], { cwd: REPO, timeout: 30000 }).toString();
    const j = JSON.parse(raw);
    return j.hookSpecificOutput ? String(j.hookSpecificOutput.additionalContext || '') : '';
  } catch (e) {
    return null;
  }
}

function do_() {
  const khoi = [];

  const fClaude = path.join(REPO, 'CLAUDE.md');
  const claude = fs.existsSync(fClaude) ? fs.statSync(fClaude).size : null;
  if (claude !== null) khoi.push({ ten: 'CLAUDE.md', byte: claude, muc: null });

  const hook = dauRaHook();
  if (hook !== null) khoi.push({ ten: 'hook SessionStart', byte: Buffer.byteLength(hook, 'utf8'), muc: null });

  const nhom = [
    ['description skill', path.join(REPO, '.claude', 'skills'), 'SKILL.md'],
    ['description command', path.join(REPO, '.claude', 'commands'), null],
    ['description agent', path.join(REPO, '.claude', 'agents'), null],
  ];
  for (const [nhan, duong, tepCon] of nhom) {
    const muc = quetThuMuc(duong, tepCon);
    if (!muc) continue;
    khoi.push({ ten: `${nhan} (${muc.length})`, byte: muc.reduce((a, x) => a + x.byte, 0), muc });
  }

  const tong = khoi.reduce((a, x) => a + x.byte, 0);
  return { khoi, tong, token: Math.round(tong / KY_TU_MOI_TOKEN) };
}

/**
 * `--phase <tên>` — đo khối BẮT BUỘC của một luồng, tính bằng KB.
 *
 * VÌ SAO Ở ĐÂY CHỨ KHÔNG NHÉT VÀO `prompt_budget.js`. Máy đó đã đo cùng thứ nhưng bằng TOKEN, và nó
 * mang sẵn hai khái niệm riêng là `tran` và `moc` với luật khác nhau. Nhét thêm một đơn vị thứ hai
 * vào đó là dựng hai thước trong một cửa — đúng cách `_luong_hien_tai` trong chính file config ấy đã
 * trôi và tự ghi lệch một lần. Nên: cửa riêng, CÙNG một file ngưỡng, và nói rõ quan hệ.
 *
 * `co_dieu_kien` KHÔNG tính, đúng nghĩa của nó: chỉ nạp khi gặp điều kiện. Tính vào là thổi phồng
 * con số rồi đi cắt nhầm chỗ.
 */
function doPhase(ten) {
  const fMap = path.join(REPO, '.agent', 'config', 'load_map.json');
  if (!fs.existsSync(fMap)) return null;
  let luong;
  try {
    luong = JSON.parse(fs.readFileSync(fMap, 'utf8')).luong;
  } catch (e) {
    return null;
  }
  const c = luong && luong[ten];
  if (!c) return null;
  const ds = [c.diem_vao, ...(c.bat_buoc || [])].filter(Boolean);
  const muc = ds.map((f) => {
    const p = path.join(REPO, f);
    return { ten: f, byte: fs.existsSync(p) ? fs.statSync(p).size : null };
  });
  return { muc, thieu: muc.filter((x) => x.byte === null), tong: muc.reduce((a, x) => a + (x.byte || 0), 0) };
}

const iPhase = process.argv.indexOf('--phase');
if (iPhase >= 0) {
  const ten = process.argv[iPhase + 1];
  if (!ten) { console.error('[token-session] --phase cần tên luồng, ví dụ: --phase phase1'); process.exit(2); }
  const p = doPhase(ten);
  if (!p) {
    console.log(`[token-session] KHÔNG PHÁN ĐƯỢC — không đọc được luồng "${ten}" trong .agent/config/load_map.json.`);
    process.exit(2);
  }
  for (const m of p.muc) {
    console.log('  ' + (m.byte === null ? '  n/a' : kb(m.byte).toFixed(1).padStart(6)) + ' KB  ' + m.ten + (m.byte === null ? '  ← KHÔNG THẤY' : ''));
  }
  console.log('  ' + kb(p.tong).toFixed(1).padStart(6) + ` KB  TỔNG bắt buộc của ${ten}  (~${Math.round(p.tong / KY_TU_MOI_TOKEN)} token)`);
  if (p.thieu.length) {
    console.log('');
    console.log(`[token-session] KHÔNG PHÁN ĐƯỢC — ${p.thieu.length} file trong load_map không tồn tại, nên tổng trên là THIẾU.`);
    process.exit(2);
  }
  let nguongP = null;
  try { nguongP = (JSON.parse(fs.readFileSync(CAU_HINH, 'utf8')).phaseMaxKB || {})[ten]; } catch (e) { nguongP = null; }
  if (typeof nguongP !== 'number') {
    console.log('');
    console.log(`[token-session] KHÔNG PHÁN ĐƯỢC — prompt_budget.json chưa có số ở \`phaseMaxKB.${ten}\`.`);
    process.exit(2);
  }
  console.log('');
  if (kb(p.tong) <= nguongP) { console.log(`[token-session] ✓ ĐẠT — ${ten} ${kb(p.tong).toFixed(1)} KB ≤ ngưỡng ${nguongP} KB.`); process.exit(0); }
  console.error(`[token-session] ✗ VƯỢT NGƯỠNG — ${ten} ${kb(p.tong).toFixed(1)} KB > ${nguongP} KB (phaseMaxKB.${ten}).`);
  console.error('  Cắt bằng cách tách lõi (thứ tự bước · luật chặn · lệnh gate) khỏi phần mở theo nhu cầu,');
  console.error('  rồi khai phần mở ở `co_dieu_kien` — KHÔNG xoá luật, vì `rule:parity` sẽ bắt được ngay.');
  process.exitCode = 1;
  return;
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────── */

const kq = do_();

if (kq.khoi.length < 3) {
  console.log('[token-session] KHÔNG PHÁN ĐƯỢC — thiếu phần để đo (thấy ' + kq.khoi.length + '/5 khối).');
  console.log('                Cây-gói phát hành không có `.claude/`, nên máy này không đo được ở đó.');
  console.log('                KHÔNG trả "đạt": một cửa không đo được mà báo xanh là khai điều nó chưa đo.');
  process.exit(2);
}

if (process.argv.includes('--moc')) {
  console.log(JSON.stringify({ alwaysOnMaxKB: Number((kb(kq.tong) * 1.05).toFixed(2)) }, null, 2));
  process.exit(0);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    tongKB: Number(kb(kq.tong).toFixed(2)),
    token: kq.token,
    khoi: kq.khoi.map((x) => ({ ten: x.ten, KB: Number(kb(x.byte).toFixed(2)) })),
  }, null, 2));
  process.exit(0);
}

for (const k of kq.khoi) console.log('  ' + k.ten.padEnd(26) + kb(k.byte).toFixed(2).padStart(6) + ' KB');
console.log('  ' + ''.padEnd(26, '-') + '-------');
console.log('  ' + 'TỔNG luôn nạp'.padEnd(26) + kb(kq.tong).toFixed(2).padStart(6) + ` KB  ~${kq.token} token`);

let nguong = null;
try {
  nguong = JSON.parse(fs.readFileSync(CAU_HINH, 'utf8')).alwaysOnMaxKB;
} catch (e) {
  nguong = null;
}

if (typeof nguong !== 'number') {
  console.log('');
  console.log('[token-session] KHÔNG PHÁN ĐƯỢC — `.agent/config/prompt_budget.json` chưa có khoá số `alwaysOnMaxKB`.');
  console.log('                Chốt ngưỡng bằng: node scripts/qa/token_session.js --moc');
  process.exit(2);
}

console.log('');
if (kb(kq.tong) <= nguong) {
  console.log(`[token-session] ✓ ĐẠT — ${kb(kq.tong).toFixed(2)} KB ≤ ngưỡng ${nguong} KB.`);
  process.exit(0);
}

console.error(`[token-session] ✗ VƯỢT NGƯỠNG — ${kb(kq.tong).toFixed(2)} KB > ${nguong} KB (alwaysOnMaxKB).`);
console.error('');
const skill = kq.khoi.find((x) => x.ten.startsWith('description skill'));
if (skill && skill.muc) {
  const dai = skill.muc.filter((x) => x.kyTu > 200).sort((a, b) => b.kyTu - a.kyTu).slice(0, 5);
  if (dai.length) {
    console.error('  Mô tả dài nhất (ký tự) — cắt ở đây rẻ nhất, phần dư chuyển xuống mục "Dùng khi" trong thân skill:');
    for (const x of dai) console.error(`    ${String(x.kyTu).padStart(4)} ký tự  ${x.ten}`);
  }
}
console.error('  Đây là phần MỌI phiên đều trả, kể cả phiên chỉ hỏi một câu.');
console.error('  Nâng ngưỡng mà không kèm số đo là bỏ cái gác — xem `_muon_them_chu_thi_sao` trong prompt_budget.json.');
process.exitCode = 1;
