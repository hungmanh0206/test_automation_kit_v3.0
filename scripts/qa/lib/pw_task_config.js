'use strict';
/*
 * pw_task_config — MỘT NGUỒN sinh `playwright.task.config.js` cho spec nằm NGOÀI `tests/`.
 *
 * VÌ SAO CẦN, và đây là một phép đo chứ không phải phỏng đoán: `playwright.config.js` ở gốc khai
 * `testDir: './tests'` và không project nào trỏ tới `outputs/**`. Gọi thẳng một spec ở đó trả **"No
 * tests found"** — đo được ngày 30/09/2026 ở task CSDL-9001, và đo lại ngày 12/10/2026 khi `smoke:gen`
 * sinh spec đầu tiên của nó.
 *
 * VÌ SAO LÀ MỘT NGUỒN. `compile:spec` và `smoke:gen` đều cần file này. Giữ hai bản là dựng sẵn hai thứ
 * sẽ trôi khỏi nhau, và đợt này đã trả giá bốn lần cho đúng chuyện đó: hai bản lint SQL lệch 4/795 câu;
 * năm bản mẫu PII lệch ở SĐT 9 chữ số; hai gate canh "Excel là nguồn" cùng xanh trong khi 7 bề mặt vi
 * phạm; và hai bộ tách câu bước.
 *
 * CỐ Ý KHÔNG SỬA CONFIG GỐC: nó là file dùng chung, và thêm một project quét `outputs/**` sẽ kéo
 * automation của MỌI task vào lane mặc định của người khác (CLAUDE.md §5 isolation).
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');

/** Tên project an toàn: chữ thường, gạch nối. */
function tenProject(nhan) {
  return `task-${String(nhan || 'khong-ten')
    .normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'khong-ten'}`;
}

/**
 * Ghi `playwright.task.config.js` vào `specDir`. Trả đường dẫn file.
 *
 * `ghiDe: false` (mặc định) thì KHÔNG ghi đè file đã có — người ta có thể đã sửa tay nó cho một lượt
 * chạy riêng, và ghi đè âm thầm là xoá việc của họ.
 *
 * NÉM khi `specDir` khác ổ đĩa với repo: `path.relative` giữa hai ổ trên Windows trả về đường TUYỆT ĐỐI,
 * và `require('D:/...')` trong một file config nằm ở ổ C: sẽ vỡ lúc nạp, với thông báo lạc hướng.
 */
function ghiConfigTask(specDir, nhan, { ghiDe = false } = {}) {
  const sauRepo = path.relative(specDir, REPO).replace(/\\/g, '/') || '.';
  if (path.isAbsolute(sauRepo) || /^[A-Za-z]:/.test(sauRepo)) {
    throw new Error(
      `pw_task_config: ${specDir} không nằm cùng ổ đĩa với repo, không dựng được đường require tương đối.`,
    );
  }

  const duong = path.join(specDir, 'playwright.task.config.js');
  if (fs.existsSync(duong) && !ghiDe) return duong;

  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(duong, [
    '/*',
    ' * SINH TỰ ĐỘNG bởi `scripts/qa/lib/pw_task_config.js`.',
    ' *',
    " * Vì sao cần: `playwright.config.js` ở gốc khai `testDir: './tests'` và không project nào trỏ tới",
    ' * `outputs/**`, nên gọi thẳng spec ở thư mục này trả "No tests found".',
    ' *',
    ' * CỐ Ý không sửa config gốc: đó là file dùng chung, thêm một project quét `outputs/**` sẽ kéo',
    ' * automation của MỌI task vào lane mặc định của người khác (CLAUDE.md §5).',
    ' */',
    "const path = require('path');",
    `const base = require('${sauRepo}/playwright.config.js');`,
    "const { devices } = require('@playwright/test');",
    '',
    `const REPO = path.resolve(__dirname, '${sauRepo}');`,
    '',
    '/*',
    " * Reporter của config gốc khai đường dẫn TƯƠNG ĐỐI (`./scripts/qa/...`). Playwright resolve nó theo",
    ' * thư mục CHỨA CONFIG, nên khi config nằm ở đây thì nó tìm trong thư mục này và vỡ với',
    ' * MODULE_NOT_FOUND. Chuyển mọi path reporter sang tuyệt đối theo gốc repo.',
    ' */',
    "const reporter = (base.reporter || []).map((r) => (Array.isArray(r) && typeof r[0] === 'string' && r[0].startsWith('.')",
    '  ? [path.resolve(REPO, r[0]), ...r.slice(1)]',
    '  : r));',
    '',
    'module.exports = {',
    '  ...base,',
    '  reporter,',
    '  testDir: __dirname,',
    '  projects: [',
    '    {',
    `      name: ${JSON.stringify(tenProject(nhan))},`,
    '      use: {',
    "        ...devices['Desktop Chrome'],",
    "        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },",
    '      },',
    '    },',
    '  ],',
    '};',
    '',
  ].join('\n'), 'utf8');

  return duong;
}

module.exports = { ghiConfigTask, tenProject };
