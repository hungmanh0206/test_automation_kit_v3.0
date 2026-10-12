#!/usr/bin/env node
'use strict';
/*
 * smoke:run — CHẠY SMOKE HỆ THỐNG, với ba lớp chặn trước khi nó được phép chạy (v2.8.0 §L).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * BA LỚP CHẶN, và mỗi lớp vá một cách smoke tự biến thành vô nghĩa:
 *
 *   1. **Không có gốc URL ⇒ DỪNG, không đoán.** Smoke chạy với host sai sẽ đỏ toàn bộ và người đọc kết
 *      luận "app chết". Gốc lấy từ `SMOKE_BASE_URL` hoặc `OPS_BASE_URL`, không có mặc định.
 *
 *   2. **Lớp SÂU đòi cờ `--toi-dong-y-cham-du-lieu`.** Lớp sâu GHI THẬT rồi hoàn nguyên, và hoàn nguyên
 *      có thể thất bại. CLAUDE.md §2 đòi xác nhận trước mỗi lượt chạm UAT, và một cờ phải gõ tay là
 *      cách gần nhất với "xác nhận" mà một script có thể đòi. `--deep` một mình KHÔNG đủ.
 *
 *   3. **`--workers=1`, không thương lượng.** Đo 12/10/2026: chạy cả bộ offline với `workers` mặc định
 *      làm hai phép đo HÀNH VI THEO THỜI GIAN của L0.5 ĐỎ, và cả lượt mất 2.1 giờ; cùng bộ đó với một
 *      worker thì 47/47 trong 2.0 phút. Smoke cũng đo theo thời gian (màn mở được trong bao lâu), nên
 *      nó chịu đúng lớp bỏ đói đó.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Dùng: node scripts/qa/reuse/smoke_run.js --spec <file.spec.ts> [--deep --toi-dong-y-cham-du-lieu]
 * Exit: mã của Playwright · 2 khi bị chặn trước khi chạy
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');

/** Gốc URL. KHÔNG có mặc định — xem lớp chặn 1. */
function gocUrl(env = process.env) {
  return String(env.SMOKE_BASE_URL || env.OPS_BASE_URL || '').replace(/\/+$/, '');
}

/**
 * Ba lớp chặn. Trả `{ chay: boolean, ly_do?: string, lenh?: string[] }`.
 *
 * Tách khỏi `main()` để spec gọi được: một lớp chặn chưa ai thử là một lớp chặn có thể đã hở.
 */
function kiemTruocKhiChay({ spec, deep, dongY, env = process.env }) {
  if (!spec) return { chay: false, ly_do: 'thiếu `--spec <file.spec.ts>`' };
  if (!fs.existsSync(path.resolve(REPO, spec))) {
    return { chay: false, ly_do: `không thấy spec ${spec} — chạy \`smoke:gen\` trước` };
  }
  if (!gocUrl(env)) {
    return {
      chay: false,
      ly_do: 'thiếu `SMOKE_BASE_URL` (hoặc `OPS_BASE_URL`). KHÔNG đoán host: smoke chạy với host sai '
        + 'sẽ đỏ toàn bộ và người đọc kết luận "app chết".',
    };
  }
  if (deep && !dongY) {
    return {
      chay: false,
      ly_do: 'lớp SÂU GHI THẬT vào ô rồi hoàn nguyên, và hoàn nguyên CÓ THỂ thất bại. CLAUDE.md §2 đòi '
        + 'xác nhận trước mỗi lượt chạm dữ liệu — thêm `--toi-dong-y-cham-du-lieu` nếu đã xác nhận.',
    };
  }
  return {
    chay: true,
    /* `--workers=1` ghim cứng, xem lớp chặn 3. */
    lenh: ['playwright', 'test', spec, '--config', path.join(path.dirname(path.resolve(REPO, spec)), 'playwright.task.config.js'), '--workers=1', '--reporter=line'],
  };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const r = kiemTruocKhiChay({
    spec: val('spec'),
    deep: argv.includes('--deep'),
    dongY: argv.includes('--toi-dong-y-cham-du-lieu'),
  });

  if (!r.chay) {
    console.error(`[smoke-run] CHẶN TRƯỚC KHI CHẠY — ${r.ly_do}`);
    process.exit(2);
  }

  console.log(`[smoke-run] gốc = ${gocUrl().replace(/^(https?:\/\/)([^/]+)/, '$1<host đã ẩn>')}`);
  console.log(`[smoke-run] ${r.lenh.join(' ')}`);
  const kq = spawnSync('npx', r.lenh, { cwd: REPO, stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(kq.status === null ? 1 : kq.status);
}

if (require.main === module) main();

module.exports = { kiemTruocKhiChay, gocUrl };
