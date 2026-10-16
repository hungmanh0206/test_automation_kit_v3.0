import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';

/*
 * @infra — CỔNG MƠ HỒ, nay có code đứng sau.
 *
 * Trước v2.9.2, `phase1_01_prepare_context.md` bước 7 bảo "DỪNG tới khi RESOLVED" nhưng KHÔNG script
 * nào đọc khoá đó rồi `exit 1`. Đo 16/10/2026: 0 máy.
 *
 * Hai cái bẫy ĐO ĐƯỢC trên 5 task thật, và chúng đổi hẳn thiết kế:
 *
 *   ① `RESOLVED` không phải một trạng thái — có BA (`RESOLVED`, `PARTIALLY RESOLVED`,
 *     `RESOLVED-BY-DEFAULT`), và hai cái sau CHỨA chuỗi `RESOLVED`. `includes()` cho chúng lọt im
 *     lặng; `=== 'RESOLVED'` chặn 3/5 task đang chạy.
 *   ② Dòng khoá có BỐN hình dạng (bold inline · tiêu đề · ô bảng · bold kèm hậu tố).
 *
 * Và một cái bẫy thứ ba lộ ra lúc dựng: file clarifications dùng CRLF, mà trong JS `.` không khớp `\r`
 * và `$` không khớp trước `\r` — nên regex kết thúc bằng `(.*)$` trượt TOÀN BỘ dòng, im lặng.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const AG = path.join(REPO, 'scripts/qa/ambiguity_gate.js');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const A = require(AG);
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const CFG = A.napCauHinh();

function cayTask(gateLine: string, clarif: string | null, coCase = true) {
  const d = thuMucTam('ambi');
  const t = path.join(d, 'tasks', 'T-1');
  fs.mkdirSync(path.join(t, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(t, 'task.md'), `# T-1\n\n${gateLine}\n`, 'utf8');
  if (coCase) {
    fs.mkdirSync(path.join(t, 'test-cases'), { recursive: true });
    fs.writeFileSync(path.join(t, 'test-cases', 'bo.md'), '# case\n', 'utf8');
  }
  if (clarif !== null) fs.writeFileSync(path.join(t, 'reports', 'phase1-clarifications.md'), clarif, 'utf8');
  return { goc: d, task: t };
}

function chay(goc: string, them: string[] = []) {
  const r = spawnSync(process.execPath, [AG, '--task', 'T-1', '--pod', goc, ...them], {
    cwd: REPO, encoding: 'utf8', env: gateEnv(),
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

test.describe('@infra ambiguity:gate — đọc trạng thái, bốn hình dạng và bẫy chuỗi con', () => {
  test('BỐN hình dạng dòng khoá đều đọc được', () => {
    const ca: [string, string][] = [
      ['**AMBIGUITY_GATE: PARTIALLY RESOLVED** — Q3 vẫn PENDING', 'PARTIALLY RESOLVED'],
      ['## AMBIGUITY_GATE: RESOLVED (25/09/2026)', 'RESOLVED'],
      ['| **AMBIGUITY_GATE** | **RESOLVED** (25/09/2026) |', 'RESOLVED'],
      ['**AMBIGUITY_GATE: RESOLVED-BY-DEFAULT** — QA chốt 25/09/2026', 'RESOLVED-BY-DEFAULT'],
    ];
    for (const [dong, mong] of ca) {
      expect(A.bocTrangThai(dong).gia_tri, `đọc trượt hình dạng: ${dong}`).toBe(mong);
    }
  });

  test('BẪY CHUỖI CON: `PARTIALLY RESOLVED` KHÔNG được nhận nhầm thành `RESOLVED`', () => {
    /*
     * Đây là điều kiện đáng khoá nhất của cả khối. Nhận nhầm ⇒ áp nghĩa vụ của `RESOLVED` lên một
     * trạng thái còn câu mở, tức gate xanh mà không gác gì.
     */
    const t1 = A.khopTrangThai('PARTIALLY RESOLVED', CFG);
    expect(t1.ten).toBe('PARTIALLY RESOLVED');
    expect(t1.nghia_vu).toContain('cau_con_mo_phai_noi_chan_gi');

    const t2 = A.khopTrangThai('RESOLVED-BY-DEFAULT', CFG);
    expect(t2.ten, '`RESOLVED` là tiền tố của nó — khớp dài nhất, không khớp đầu tiên').toBe('RESOLVED-BY-DEFAULT');
    expect(t2.nghia_vu).toContain('phai_co_nguoi_va_ngay');

    expect(A.khopTrangThai('RESOLVED', CFG).ten).toBe('RESOLVED');
  });

  test('trạng thái LẠ ⇒ không khớp gì, không im lặng nhận bừa', () => {
    expect(A.khopTrangThai('DONE', CFG)).toBeNull();
    expect(A.khopTrangThai('RESOLVEDISH', CFG), 'tiền tố KHÔNG đủ để nhận').toBeNull();
  });

  test('BẪY CRLF: file xuống dòng kiểu Windows vẫn đọc được câu hỏi', () => {
    /*
     * Trong JS, `.` không khớp `\r` và `$` không khớp trước `\r`. Bản đầu tách dòng bằng `\n` nên mọi
     * tiêu đề của file CRLF trượt hết — `CSDL-9004` có 21 câu mà máy đọc ra 0. Trong chế độ CHẶT, task
     * đó bị chặn vì BỘ ĐỌC thiếu: một hạn chế của máy hoá thành cáo buộc về công việc của người.
     */
    const lf = '### Q1 — hỏi gì đó · Critical\ntrả lời có\n';
    const crlf = lf.split('\n').join('\r\n');
    expect(A.docCauHoi(lf).length, 'LF phải đọc được').toBe(1);
    expect(A.docCauHoi(crlf).length, 'CRLF cũng phải đọc được — đây là lần thứ BẢY kit vấp lớp lỗi này').toBe(1);
    expect(A.docCauHoi(crlf)[0].muc).toBe('Critical');
  });

  test('HAI khuôn câu hỏi: hàng bảng và tiêu đề', () => {
    expect(A.docCauHoi('| Q7 | Medium | nội dung | trả lời |').length, 'khuôn bảng').toBe(1);
    expect(A.docCauHoi('### Q2 — nội dung · High\nthân\n').length, 'khuôn tiêu đề').toBe(1);
  });
});

test.describe('@infra ambiguity:gate — chặn đúng ca, không chặn ca đang chạy', () => {
  test('A1 DƯƠNG: `PENDING` + đã có case ⇒ CHẶN (ở CẢ hai chế độ)', () => {
    /* Đây là ca rõ ràng sai: case sinh qua một cổng chưa mở. Chặn kể cả chế độ di trú. */
    const c = cayTask('**AMBIGUITY_GATE: PENDING**', '| Q1 | High | hỏi | |');
    try {
      const r = chay(c.goc);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(/cổng chưa mở/);
    } finally { donThuMucTam(c.goc); }
  });

  test('A1 ÂM: `PENDING` mà CHƯA có case ⇒ không chặn — chưa tới lúc', () => {
    const c = cayTask('**AMBIGUITY_GATE: PENDING**', null, false);
    try { expect(chay(c.goc).code).toBe(0); } finally { donThuMucTam(c.goc); }
  });

  test('A1 DI TRÚ: thiếu hẳn khoá + đã có case ⇒ CẢNH BÁO, KHÔNG chặn', () => {
    /*
     * Prompt gốc bảo coi "không khai" là chặn. Đo trước đã: dòng khoá có bốn hình dạng, nên "không
     * thấy khoá" rất có thể là lỗi ĐỌC. Biến một lỗi đọc thành lệnh chặn là cách nhanh nhất để người
     * ta tắt gate — nên di trú cảnh báo, và `--chat` mới chặn.
     */
    const c = cayTask('(không khai gì)', '| Q1 | High | hỏi | đáp |');
    try {
      expect(chay(c.goc).code, 'di trú: cảnh báo').toBe(0);
      expect(chay(c.goc).out).toMatch(/CẢNH BÁO/);
      expect(chay(c.goc, ['--chat']).code, 'chế độ chặt: chặn').toBe(1);
    } finally { donThuMucTam(c.goc); }
  });

  test('A2 DƯƠNG: `RESOLVED` mà một câu Critical bỏ trống ⇒ nêu ĐÚNG câu đó', () => {
    const c = cayTask('**AMBIGUITY_GATE: RESOLVED**', [
      '| Q1 | Critical | câu đã trả lời | đáp án rõ ràng |',
      '| Q2 | Critical | câu bỏ trống |  |',
      '| Q3 | Medium | không chặn |  |',
    ].join('\n'));
    try {
      const r = chay(c.goc, ['--chat']);
      expect(r.code, r.out).toBe(1);
      expect(r.out, 'phải nêu đúng câu còn thiếu').toContain('Q2');
      expect(r.out, 'Q1 đã trả lời thì không được nêu').not.toMatch(/- Q1 \(/);
      expect(r.out, 'Medium không chặn').not.toMatch(/- Q3 \(/);
    } finally { donThuMucTam(c.goc); }
  });

  test('A2 ÂM: câu Critical bỏ trống nhưng có `ACCEPTED-BY` ⇒ ĐẠT', () => {
    const c = cayTask('**AMBIGUITY_GATE: RESOLVED**',
      '| Q1 | Critical | câu khó | ACCEPTED-BY: QA-Hung 25/09/2026 |');
    try {
      const r = chay(c.goc, ['--chat']);
      expect(r.code, r.out).toBe(0);
    } finally { donThuMucTam(c.goc); }
  });

  test('A2: `PARTIALLY RESOLVED` — câu còn mở phải nói nó CHẶN GÌ', () => {
    const mo = cayTask('**AMBIGUITY_GATE: PARTIALLY RESOLVED**',
      '| Q1 | High | còn mở | ⚠️ đang chạy theo assumption |');
    try {
      expect(chay(mo.goc, ['--chat']).code, 'không nói chặn gì ⇒ không phân biệt được với PENDING').toBe(1);
    } finally { donThuMucTam(mo.goc); }

    const ro = cayTask('**AMBIGUITY_GATE: PARTIALLY RESOLVED**',
      '| Q1 | High | còn mở | ⚠️ chặn Phase 2, không drive UAT tới khi chốt |');
    try {
      expect(chay(ro.goc, ['--chat']).code, 'nói rõ chặn gì ⇒ hợp lệ').toBe(0);
    } finally { donThuMucTam(ro.goc); }
  });

  test('A2: `RESOLVED-BY-DEFAULT` phải có NGƯỜI và NGÀY', () => {
    const thieu = cayTask('**AMBIGUITY_GATE: RESOLVED-BY-DEFAULT**', '| Q1 | High | hỏi | chạy theo mặc định |');
    try {
      expect(chay(thieu.goc, ['--chat']).code, 'không chủ thì chỉ là PENDING đổi tên').toBe(1);
    } finally { donThuMucTam(thieu.goc); }

    /* Nhận CẢ khuôn `QA chốt <ngày>` — đó là thứ 5 task thật đang dùng, không ép chúng đổi. */
    const du = cayTask('**AMBIGUITY_GATE: RESOLVED-BY-DEFAULT** — QA chốt 25/09/2026', '| Q1 | High | hỏi | mặc định |');
    try {
      expect(chay(du.goc, ['--chat']).code).toBe(0);
    } finally { donThuMucTam(du.goc); }
  });

  test('A3: vùng mù của discovery chưa thành câu hỏi ⇒ CẢNH BÁO, không chặn', () => {
    const dc = { doc_coverage: [
      { o: 'undocumented_present', vung: '/ManHinhLa.aspx' },
      { o: 'documented_present', vung: '/CoTaiLieu.aspx' },
    ] };
    expect(A.vungMuChuaHoi({ docCoverage: dc, noiDungClarif: '' }), 'vùng mù chưa hỏi')
      .toEqual(['/ManHinhLa.aspx']);
    expect(A.vungMuChuaHoi({ docCoverage: dc, noiDungClarif: 'có nhắc /ManHinhLa.aspx rồi' }),
      'đã thành câu hỏi thì không cảnh báo').toEqual([]);

    const kq = { ma: 0, dong: [] as string[] };
    A.themCanhBaoVungMu(kq, { docCoverage: dc, noiDungClarif: '' });
    expect(kq.ma, 'A3 KHÔNG được đổi verdict').toBe(0);
    expect(kq.dong.join('\n')).toMatch(/không chặn/);
  });
});

test.describe('@infra ambiguity:gate — đo trên 5 task THẬT trước khi bật chặn', () => {
  test('cả 5 task đọc ra đúng trạng thái, và di trú KHÔNG làm đỏ task nào', () => {
    /*
     * Điều kiện của chế độ di trú: bật gate mà không làm đỏ việc đang chạy. Đo trên dữ liệu thật chứ
     * không trên fixture — fixture do tôi viết nên nó chỉ chứng minh máy khớp với giả định của tôi.
     */
    const pod = path.join(REPO, 'outputs', 'CSDL');
    test.skip(!fs.existsSync(pod), 'không có task thật trong cây này (lớp PROJECT, gitignore)');

    const mong: Record<string, string> = {
      'CSDL-3544': 'PARTIALLY RESOLVED',
      'CSDL-9001': 'RESOLVED',
      'CSDL-9002': 'PARTIALLY RESOLVED',
      'CSDL-9003': 'RESOLVED',
      'CSDL-9004': 'RESOLVED-BY-DEFAULT',
    };
    for (const [t, tt] of Object.entries(mong)) {
      if (!fs.existsSync(path.join(pod, 'tasks', t, 'task.md'))) continue;
      const r = spawnSync(process.execPath, [AG, '--task', t, '--pod', 'outputs/CSDL'], {
        cwd: REPO, encoding: 'utf8', env: gateEnv(),
      });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      expect(out, `${t}: đọc sai trạng thái`).toContain(`\`${tt}\``);
      expect(r.status, `${t}: chế độ di trú KHÔNG được làm đỏ task đang chạy.\n${out.slice(0, 400)}`).toBe(0);
    }
  });
});
