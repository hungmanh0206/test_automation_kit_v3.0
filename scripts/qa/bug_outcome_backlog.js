#!/usr/bin/env node
/**
 * bug_outcome_backlog.js — SỔ KẾT CỤC THEO ISSUE BACKLOG: DEV nhận hay bác từng bug QA đã log.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO KHÔNG ĐỦ VỚI `bug_outcome`
 *
 * `bug_outcome` ghi nhãn vào FILE CLAIM (`reports/bug-claims/<TC>.json`). Đo 11/11/2026 trên Backlog: tài khoản
 * QA đã tạo **96 bug** trong dự án CSDL, chỉ **17** có file claim trỏ tới. 79 bug (82%) không có claim, nên mọi
 * tỉ lệ tính từ sổ claim chỉ là một góc. Thêm nữa, sổ claim gọi "đã log 119" cho cả 90 claim mới ở trạng thái
 * `claimed` — chưa từng lên Backlog. Mẫu số đúng cho "DEV nhận hay bác" là BUG TRÊN BACKLOG.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * GẮN NHÃN — máy chỉ tự gắn ĐÚNG MỘT trường hợp
 *
 * Quy trình của dự án (đọc lịch sử trạng thái CSDL-4087, CSDL-3801): `Open → Ready For Test` (DEV báo đã
 * sửa) `→ Ready for Product` (QA chạy lại xác nhận). Nên *Ready for Product* = DEV NHẬN và QA ĐÃ XÁC MINH sửa
 * ⇒ máy tự gắn `accepted`. MỌI trạng thái khác:
 *   · Open / Ready For Test / In Progress — CHƯA có kết cục, không gắn.
 *   · Resolved / Closed — `resolution` trên dự án này luôn trống (16/16 issue đọc được), và "Resolved" có lúc là
 *     đã sửa, có lúc là bác ("bảng này k dùng nữa"), có lúc là tranh chấp tài liệu. Máy KHÔNG đoán: người
 *     gắn bằng `--nhan`, BẮT BUỘC kèm lý do (trích lời DEV). Chưa gắn thì liệt kê ra, không tính vào tỉ lệ.
 * Nhãn tay luôn thắng nhãn tự gắn.
 *
 * CHỈ GET lên Backlog. Sổ ở `knowledge/metrics/bug-outcomes-backlog.json` (gitignore): mã issue, trạng thái,
 * nhãn, lý do — không có mô tả bug, không có apiKey.
 *
 * Dùng:
 *   node scripts/qa/bug_outcome_backlog.js [--project CSDL]                       đọc Backlog, cập nhật sổ, báo cáo
 *   node scripts/qa/bug_outcome_backlog.js --nhan <KEY> --la <nhãn> --vi-sao <...> gắn nhãn tay (không gọi mạng)
 *   node scripts/qa/bug_outcome_backlog.js --bao-cao                             chỉ đọc sổ, không gọi mạng
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const { NHAN, SAI } = require('./bug_outcome');

const SO = path.join(REPO, 'knowledge', 'metrics', 'bug-outcomes-backlog.json');
const TU_GAN = { 'ready for product': { nhan: 'accepted', nguon: 'trạng thái Backlog', viSao: 'Ready for Product: DEV sửa, QA chạy lại xác nhận (Open → Ready For Test → Ready for Product)' } };
const CHUA_XONG = /^(open|ready for test|in progress|reopen|reopened|mở|đang xử lý)$/i;
const SAN_LY_DO = 15;

const docSo = () => { try { return JSON.parse(fs.readFileSync(SO, 'utf8')); } catch (e) { return { issues: {} }; } };
const ghiSo = (s) => { fs.mkdirSync(path.dirname(SO), { recursive: true }); fs.writeFileSync(SO, JSON.stringify(s, null, 1)); };

/**
 * Gộp dữ liệu Backlog mới đọc vào sổ cũ. HÀM THUẦN — test được không cần mạng.
 * Nhãn TAY được giữ; nhãn TỰ GẮN được tính lại theo trạng thái mới (bug Ready for Product bị mở lại thì mất nhãn).
 */
function gop(soCu, issuesMoi) {
  const ra = { capNhat: new Date().toISOString(), issues: {} };
  for (const i of issuesMoi) {
    const cu = (soCu.issues || {})[i.key] || {};
    const tt = String(i.trangThai || '').trim();
    const tu = TU_GAN[tt.toLowerCase()];
    const tay = cu.nhan && cu.nguonNhan === 'tay' ? { nhan: cu.nhan, nguonNhan: 'tay', viSao: cu.viSao, luc: cu.luc } : null;
    ra.issues[i.key] = {
      cha: i.cha || null, trangThai: tt, resolution: i.resolution || null, tao: i.tao, sua: i.sua,
      ...(tay || (tu ? { nhan: tu.nhan, nguonNhan: 'tự gắn', viSao: tu.viSao } : {})),
      ...(tay && tu && tay.nhan !== tu.nhan ? { lech: `nhãn tay "${tay.nhan}" khác trạng thái hiện tại "${tt}"` } : {}),
    };
  }
  return ra;
}

/** Gắn nhãn tay — có điều kiện, không gọi mạng. */
function ganTay(so, key, nhan, viSao) {
  const i = (so.issues || {})[key];
  if (!i) throw new Error(`${key} chưa có trong sổ — chạy đọc Backlog trước`);
  if (!NHAN[nhan]) throw new Error(`nhãn "${nhan}" không hợp lệ. Chọn: ${Object.keys(NHAN).join(' · ')}`);
  if (String(viSao || '').trim().length < SAN_LY_DO) throw new Error(`lý do phải ≥ ${SAN_LY_DO} ký tự — trích lời DEV hoặc nơi có kết cục`);
  if (CHUA_XONG.test(i.trangThai)) throw new Error(`${key} đang "${i.trangThai}" — chưa có kết cục để gắn nhãn`);
  so.issues[key] = { ...i, nhan, nguonNhan: 'tay', viSao: String(viSao).trim(), luc: new Date().toISOString() };
  delete so.issues[key].lech;
  return so;
}

/** Tỉ lệ từ sổ — HÀM THUẦN. */
function tinh(so) {
  const ds = Object.entries(so.issues || {}).map(([key, v]) => ({ key, ...v }));
  const coNhan = ds.filter((x) => NHAN[x.nhan]);
  const sai = coNhan.filter((x) => SAI.has(x.nhan));
  const chuaXong = ds.filter((x) => CHUA_XONG.test(x.trangThai));
  const canNguoi = ds.filter((x) => !NHAN[x.nhan] && !CHUA_XONG.test(x.trangThai));
  const theoNhan = {}; for (const x of coNhan) theoNhan[x.nhan] = (theoNhan[x.nhan] || 0) + 1;
  const theoCha = {};
  for (const x of ds) {
    const c = (theoCha[x.cha || '(không cha)'] = theoCha[x.cha || '(không cha)'] || { tong: 0, coNhan: 0, sai: 0, chuaXong: 0 });
    c.tong += 1; if (NHAN[x.nhan]) c.coNhan += 1; if (SAI.has(x.nhan)) c.sai += 1; if (CHUA_XONG.test(x.trangThai)) c.chuaXong += 1;
  }
  return { tong: ds.length, coNhan: coNhan.length, sai: sai.length, chuaXong: chuaXong.length, canNguoi: canNguoi.map((x) => `${x.key}:${x.trangThai}`), theoNhan, theoCha, lech: ds.filter((x) => x.lech).map((x) => `${x.key}: ${x.lech}`) };
}

async function docBacklog(duAn) {
  require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
  const BASE = String(process.env.BACKLOG_BASE_URL || process.env.BACKLOG_URL || '').replace(/\/+$/, '');
  const KEY = process.env.BACKLOG_API_KEY || '';
  if (!BASE || !KEY) return null;
  const get = async (d) => {
    const r = await fetch(`${BASE}/api/v2/${d}${d.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(KEY)}`);
    if (!r.ok) throw new Error(`${d.split('?')[0]} → HTTP ${r.status}`);
    return r.json();
  };
  const toi = await get('users/myself');
  const pj = await get(`projects/${encodeURIComponent(duAn)}`);
  const loai = (await get(`projects/${pj.id}/issueTypes`)).filter((t) => /bug/i.test(t.name));
  if (!loai.length) throw new Error(`dự án ${duAn} không có loại issue Bug`);
  const tat = [];
  for (let off = 0; ; off += 100) {
    const p = await get(`issues?projectId[]=${pj.id}&createdUserId[]=${toi.id}${loai.map((t) => `&issueTypeId[]=${t.id}`).join('')}&count=100&offset=${off}`);
    tat.push(...p);
    if (p.length < 100) break;
  }
  const cha = new Map();
  for (const id of [...new Set(tat.map((i) => i.parentIssueId).filter(Boolean))]) { const c = await get(`issues/${id}`); cha.set(id, c.issueKey); }
  return tat.map((i) => ({ key: i.issueKey, cha: i.parentIssueId ? cha.get(i.parentIssueId) : null,
    trangThai: i.status && i.status.name, resolution: i.resolution && i.resolution.name,
    tao: String(i.created || '').slice(0, 10), sua: String(i.updated || '').slice(0, 10) }));
}

function baoCao(so) {
  const t = tinh(so);
  console.log(`[outcome-backlog] ${t.tong} bug QA đã log · ${t.chuaXong} chưa có kết cục · ${t.coNhan} có nhãn · ${t.canNguoi.length} đã xong mà CHƯA gắn nhãn (cần người)`);
  if (t.coNhan) {
    console.log(`  sai (bác · trùng · đúng thiết kế): ${t.sai}/${t.coNhan} = ${Math.round((t.sai / t.coNhan) * 100)}% · ${Object.entries(t.theoNhan).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  } else console.log('  KHÔNG PHÁN ĐƯỢC tỉ lệ — chưa bug nào có nhãn.');
  console.log('  theo issue cha:');
  for (const [k, v] of Object.entries(t.theoCha).sort((a, b) => b[1].tong - a[1].tong)) console.log(`    ${k.padEnd(12)} ${v.tong} bug · ${v.coNhan} có nhãn · ${v.sai} sai · ${v.chuaXong} chưa xong`);
  if (t.canNguoi.length) console.log(`  cần người gắn: ${t.canNguoi.join(' · ')}`);
  if (t.lech.length) console.log(`  ⚠ nhãn tay lệch trạng thái hiện tại: ${t.lech.join(' · ')}`);
  console.log('  Tỉ lệ này là của BUG QA LOG (người và agent cùng một tài khoản) — chưa tách được phần do agent soạn.');
}

async function main() {
  const a = process.argv.slice(2);
  const lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : ''; };
  if (a.includes('--nhan')) {
    try { ghiSo(ganTay(docSo(), lay('--nhan'), lay('--la'), lay('--vi-sao'))); console.log(`[outcome-backlog] đã gắn ${lay('--nhan')} = ${lay('--la')}`); return 0; } catch (e) { console.error(`[outcome-backlog] ✗ ${e.message}`); return 1; }
  }
  if (a.includes('--bao-cao')) { baoCao(docSo()); return 0; }
  const moi = await docBacklog(lay('--project') || 'CSDL');
  if (!moi) { console.log('[outcome-backlog] KHÔNG PHÁN ĐƯỢC — thiếu BACKLOG_BASE_URL hoặc BACKLOG_API_KEY. Đây KHÔNG đồng nghĩa với "không có bug sai".'); return 2; }
  const so = gop(docSo(), moi);
  ghiSo(so);
  baoCao(so);
  return 0;
}

if (require.main === module) main().then((c) => process.exit(c)).catch((e) => { console.error(`[outcome-backlog] KHÔNG PHÁN ĐƯỢC — ${e.message}`); process.exit(2); });
module.exports = { gop, ganTay, tinh, docSo, SO, TU_GAN, CHUA_XONG };
