/*
 * @infra skills:route:check — hai skill mô tả giống nhau thì agent KHÔNG có căn cứ để chọn.
 *
 * Đây là thứ kit A KHÔNG có. A thắng ở chỗ skill của nó là plugin thật nên Claude tự nạp theo
 * `description`; B thì phải nhờ hook nhắc tên. Khoảng cách cơ chế đó không bù được bằng cách viết.
 * Nhưng có một chiều B làm được mà A không làm: ĐO xem phần chữ hiện có ĐỦ để phân biệt hay chưa.
 *
 * GIỚI HẠN, và nó phải nằm trong spec chứ không chỉ trong đầu người viết: đây là phép đo ĐẠI DIỆN trên
 * TỪ NGỮ. Nó bắt được hai mô tả gần nhau, một skill không có từ khoá nào của việc nó làm, một cặp dễ
 * nhầm mà chữ nghĩa không tách được. Nó KHÔNG chứng minh model sẽ chọn đúng — model đọc cả ngữ cảnh.
 * Đọc "98%" thành "agent chọn đúng 98%" là đọc sai.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const SR = path.join(REPO, 'scripts/qa/skills_route.js');
const FIXTURE = path.join(REPO, 'tests/fixtures/skills_route.json');

function chay(argv: string[] = []) {
  const r = spawnSync(process.execPath, [SR, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Fixture tạm, để dựng đối chứng mà không sửa fixture thật. */
function chayVoiFixture(noiDung: unknown, argv: string[] = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'skroute-'));
  const f = path.join(d, 'fx.json');
  fs.writeFileSync(f, typeof noiDung === 'string' ? noiDung : JSON.stringify(noiDung), 'utf8');
  const r = chay(['--fixture', f, ...argv]);
  return { ...r, d };
}

test.describe('@infra skills:route — repo thật phải ĐẠT, và số đo phải đọc được', () => {
  test('repo hiện tại: ĐẠT, top-1 ≥ 90%', () => {
    const r = chay();
    expect(r.code, r.out).toBe(0);
    const m = /top-1 (\d+)\/(\d+) = ([\d.]+)%/.exec(r.out);
    expect(m, 'không đọc được số đo ⇒ gate không báo cáo được gì').not.toBeNull();
    expect(Number(m![3]), 'ngưỡng của v2.9.5 là 90%').toBeGreaterThanOrEqual(90);
  });

  test('fixture có ít nhất 60 ca, và có ca `none`', () => {
    /*
     * 60 là số prompt v2.9.5 đặt. Ca `none` thì bắt buộc vì thiếu chúng, bộ chấm chỉ cần gán bừa một
     * skill cho MỌI câu là đạt — và nó đã làm đúng thế ở bản đầu, cho tới khi có sàn tự tin.
     */
    const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    expect(fx.ca.length, 'fixture phải có ≥ 60 ca').toBeGreaterThanOrEqual(60);
    expect(fx.ca.filter((c: { skill: string }) => c.skill === 'none').length, 'phải có ca `none`').toBeGreaterThan(0);
  });

  test('MỌI skill trong cây đều có ít nhất một ca trong fixture', () => {
    /* Skill không có ca nào thì phần chữ của nó chưa từng được đo — và đó là chỗ nó âm thầm mỏng đi. */
    const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const coCa = new Set(fx.ca.map((c: { skill: string }) => c.skill));
    const SK = path.join(REPO, '.agent/skills');
    const thieu: string[] = [];
    for (const g of fs.readdirSync(SK, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      for (const s of fs.readdirSync(path.join(SK, g.name), { withFileTypes: true }).filter((e) => e.isDirectory())) {
        if (!fs.existsSync(path.join(SK, g.name, s.name, 'SKILL.md'))) continue;
        if (!coCa.has(s.name)) thieu.push(s.name);
      }
    }
    expect(thieu, `skill chưa có ca nào trong fixture: ${thieu.join(' · ')}`).toEqual([]);
  });

  test('gate TỰ NÓI giới hạn — không được đọc tỉ lệ thành độ chính xác của agent', () => {
    const r = chay();
    expect(r.out, 'phải khai đây là phép đo đại diện').toMatch(/ĐẠI DIỆN|đại diện/);
    expect(r.out, 'phải nói rõ nó KHÔNG chứng minh model chọn đúng').toMatch(/KHÔNG chứng minh/);
  });
});

test.describe('@infra skills:route — đối chứng hai chiều', () => {
  test('ĐỐI CHỨNG DƯƠNG: fixture gán SAI skill ⇒ CHẶN, và gọi đúng tên ca', () => {
    const r = chayVoiFixture({
      cap_de_nham: [],
      ca: [{ cau: 'chạy load test nhiều VU bằng k6', skill: 'tc_reviewer' }],
    });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('chạy load test nhiều VU bằng k6');
    expect(r.out).toContain('mong tc_reviewer');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: fixture gán ĐÚNG ⇒ ĐẠT', () => {
    /* Không có vế này thì gate chỉ cần chặn mọi thứ là "có răng" — một gate như vậy vô dụng. */
    const r = chayVoiFixture({
      cap_de_nham: [],
      ca: [{ cau: 'chạy load test nhiều VU bằng k6', skill: 'load_check' }],
    });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('SÀN TỰ TIN: câu không thuộc skill nào ⇒ `none` là ĐÚNG, không gán bừa', () => {
    /*
     * Bản đầu của bộ chấm luôn trả skill điểm cao nhất, nên ba câu đời thường ("đặt vé máy bay…") đều
     * bị gán một skill với 2,56 điểm. Sàn 3,0 đặt theo phân bố đo được: ca khớp đúng thấp nhất 3,52,
     * ca `none` cao nhất 2,56.
     */
    const r = chayVoiFixture({ cap_de_nham: [], ca: [{ cau: 'đặt vé máy bay đi Hà Nội', skill: 'none' }] });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('hạ sàn xuống 0 ⇒ ca `none` SẬP — chứng minh sàn thật sự đang gác', () => {
    const r = chayVoiFixture(
      { cap_de_nham: [], ca: [{ cau: 'đặt vé máy bay đi Hà Nội', skill: 'none' }] },
      ['--san', '0'],
    );
    expect(r.code, 'không có sàn thì bộ chấm gán bừa một skill').toBe(1);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": thiếu fixture ⇒ exit 2', () => {
    const r = chay(['--fixture', path.join(REPO, 'khong-ton-tai.json')]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  });

  test('fixture 0 ca ⇒ exit 2, chấm rỗng không phải đạt', () => {
    const r = chayVoiFixture({ ca: [] });
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('chấm rỗng');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('CẶP DỄ NHẦM: khai cặp mà một ca trong cặp trượt ⇒ CHẶN riêng vì lý do đó', () => {
    const r = chayVoiFixture({
      cap_de_nham: [['tc_reviewer', 'tc_validator']],
      ca: [
        { cau: 'kiểm bộ case có đủ cột theo template chưa', skill: 'tc_reviewer' },
        { cau: 'soát chất lượng nội dung bộ testcase trước khi giao', skill: 'tc_reviewer' },
      ],
    });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('CẶP DỄ NHẦM không tách được');
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});
