import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `gate_codes.json` (v2.7.0 §A5) — MÃ LỖI PHẢI NÓI ĐƯỢC CÁCH SỬA.
 *
 * Một mã chỉ có tên là một NHÃN: người đọc biết tên vấn đề rồi vẫn phải tự đi tìm cách sửa, và
 * `--explain` trả về nửa câu — tệ hơn không có, vì họ tưởng đã đọc hết hướng dẫn rồi dừng.
 *
 * Bộ test này khoá ba thứ: mỗi mã đủ bốn trường · gate CÓ RĂNG (bỏ một trường thì đỏ) · và danh sách
 * miễn trừ `_no_ma_cu` phải RỖNG, để không ai lặng lẽ thêm vào đó thay vì viết hướng dẫn.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const P = path.join(REPO, '.agent/config/gate_codes.json');
const cfg = JSON.parse(fs.readFileSync(P, 'utf8'));
const DS: Array<Record<string, string>> = Array.isArray(cfg) ? cfg : (cfg.codes || []);

test.describe.configure({ mode: 'default' });

test.describe('@infra gate_codes — mỗi mã đủ bốn trường', () => {
  test('21 mã đều có `vi_sao` · `sua` · `vi_du` · `tang`', () => {
    const thieu: string[] = [];
    for (const m of DS) {
      const t = ['vi_sao', 'sua', 'vi_du', 'tang'].filter((k) => !m[k]);
      if (t.length) thieu.push(`${m.code}: thiếu ${t.join(', ')}`);
    }
    expect(thieu).toEqual([]);
    expect(DS.length, 'bộ mã phải có mặt để test này nói được gì').toBeGreaterThan(15);
  });

  test('`sua` nói được VIỆC CẦN LÀM, không chỉ nhắc lại vấn đề', () => {
    /*
     * Ngưỡng độ dài là một phép đo thô, nhưng nó bắt được ca tệ nhất: `sua` dán lại đúng câu `y`. Cái
     * phép kiểm này KHÔNG đo được là `sua` có đúng hay không — đó là việc người đọc, và giới hạn đó
     * đáng ghi ra thay vì để người sau tưởng gate đã chấm nội dung.
     */
    for (const m of DS) {
      expect(String(m.sua).length, `${m.code}: \`sua\` quá ngắn để nói được việc cần làm`).toBeGreaterThan(40);
      expect(String(m.sua), `${m.code}: \`sua\` chỉ dán lại \`y\``).not.toBe(String(m.y));
    }
  });

  test('`vi_du` có CẢ hai phía sai và đúng', () => {
    for (const m of DS) {
      expect(String(m.vi_du), `${m.code}: ví dụ thiếu phía SAI`).toMatch(/SAI:/);
      expect(String(m.vi_du), `${m.code}: ví dụ thiếu phía ĐÚNG`).toMatch(/ĐÚNG:/);
    }
  });

  test('`tang` chỉ nhận T0 hoặc T1 — không có mã T2', () => {
    /*
     * T2 là mức "không bao giờ chặn", dành cho máy không phát hiện vi phạm. Một MÃ VI PHẠM mà xếp T2
     * là tự mâu thuẫn: nó mô tả một vi phạm nhưng khai rằng vi phạm đó không bao giờ bị chặn.
     */
    for (const m of DS) expect(['T0', 'T1'], `${m.code} xếp tầng ${m.tang}`).toContain(m.tang);
  });

  test('T0 giữ HẸP — chỉ chỗ tạo ra ngay kết luận sai, hỏng dữ liệu, hoặc lộ thông tin', () => {
    /*
     * Xếp rộng tay T0 là đi ngược cả mục đích v2.7.0: nó đưa việc chặn về lại giữa lúc đang làm. Đo
     * bằng tỉ lệ: T0 không được quá nửa bộ mã.
     */
    const t0 = DS.filter((m) => m.tang === 'T0');
    expect(t0.length).toBeGreaterThan(0);
    expect(t0.length, 'T0 quá nửa bộ mã nghĩa là phân tầng đã mất ý nghĩa').toBeLessThanOrEqual(Math.floor(DS.length / 2));
    /* Và những mã này PHẢI là T0: chúng nằm thẳng trong 6 non-negotiables. */
    for (const c of ['PII', 'SQL_CAM', 'EVID_THIEU', 'ORACLE_TAUTOLOGY', 'RERUN_THIEU']) {
      const m = DS.find((x) => x.code === c);
      expect(m, `không thấy mã ${c}`).toBeTruthy();
      expect(m!.tang, `${c} phải là T0`).toBe('T0');
    }
  });

  test('`khop` của mọi mã vẫn là regex hợp lệ', () => {
    /*
     * `khop` là regex dạng chuỗi, và nó đi qua mọi lượt sửa file config. Một escape bị nuốt làm mã đó
     * thôi khớp vi phạm nào — gate vẫn xanh, nhưng vi phạm rơi vào `KHAC` và mất tên.
     */
    for (const m of DS) {
      expect(m.khop, `${m.code} không có \`khop\``).toBeTruthy();
      expect(() => new RegExp(m.khop, 'i'), `${m.code}: \`khop\` không parse được`).not.toThrow();
    }
  });
});

test.describe('@infra gates:index --check — CÓ RĂNG với mã thiếu hướng dẫn', () => {
  function chayCheck() {
    return spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/gate_index.js'), '--check'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  }

  test('ĐỐI CHỨNG: bỏ `sua` của một mã ⇒ exit 1 và nêu đích danh', () => {
    const bak = fs.readFileSync(P, 'utf8');
    try {
      const c = JSON.parse(bak);
      const ds = Array.isArray(c) ? c : c.codes;
      delete ds.find((x: { code: string }) => x.code === 'PII').sua;
      fs.writeFileSync(P, `${JSON.stringify(c, null, 2)}\n`, 'utf8');
      const r = chayCheck();
      expect(r.status).toBe(1);
      expect(`${r.stderr}`).toContain('PII (thiếu sua)');
      expect(`${r.stderr}`, 'phải nói vì sao một mã chỉ có tên là chưa đủ').toContain('NHÃN');
    } finally {
      fs.writeFileSync(P, bak, 'utf8');
    }
  });

  test('ĐỐI CHỨNG: bỏ `tang` cũng CHẶN', () => {
    const bak = fs.readFileSync(P, 'utf8');
    try {
      const c = JSON.parse(bak);
      const ds = Array.isArray(c) ? c : c.codes;
      delete ds.find((x: { code: string }) => x.code === 'EVID_THIEU').tang;
      fs.writeFileSync(P, `${JSON.stringify(c, null, 2)}\n`, 'utf8');
      const r = chayCheck();
      expect(r.status).toBe(1);
      expect(`${r.stderr}`).toContain('EVID_THIEU (thiếu tang)');
    } finally {
      fs.writeFileSync(P, bak, 'utf8');
    }
  });

  test('HAI TẦNG: mã khai trong `_no_ma_cu` chỉ CẢNH BÁO, không chặn', () => {
    const bak = fs.readFileSync(P, 'utf8');
    try {
      const c = JSON.parse(bak);
      const ds = Array.isArray(c) ? c : c.codes;
      delete ds.find((x: { code: string }) => x.code === 'QUY_MO').sua;
      c._no_ma_cu = ['QUY_MO'];
      fs.writeFileSync(P, `${JSON.stringify(c, null, 2)}\n`, 'utf8');
      const r = chayCheck();
      expect(`${r.stderr}`).toContain('còn NỢ hướng dẫn');
      expect(`${r.stderr}`, 'và phải nói rõ nợ chỉ miễn một release').toContain('MỘT release');
      expect(r.status, 'mã khai nợ thì không chặn').not.toBe(1);
    } finally {
      fs.writeFileSync(P, bak, 'utf8');
    }
  });

  test('`_no_ma_cu` hiện phải RỖNG — không ai được lặng lẽ thêm vào đó', () => {
    /*
     * Danh sách miễn trừ là đường thoát cần có, nhưng nó cũng là đường dễ nhất để không viết hướng dẫn.
     * Test này giữ nó rỗng; muốn thêm một mã vào đó thì phải sửa test, tức phải có người đọc.
     */
    expect(cfg._no_ma_cu || [], 'cả 21 mã đã điền đủ — danh sách nợ phải rỗng').toEqual([]);
  });
});

test.describe('@infra check --explain — in đủ bốn phần và cả TẦNG', () => {
  function explain(ma: string) {
    return spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/check.js'), '--explain', ma],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  }

  test('in TẦNG ngay dòng đầu, và nói tầng đó nghĩa là gì', () => {
    /*
     * Tầng quyết định người đọc phải sửa NGAY hay sửa trước cửa ra. Thiếu nó thì mọi mã trông cùng mức
     * khẩn, và cái khẩn thật bị trộn vào đám còn lại.
     */
    const r = explain('PII');
    expect(`${r.stdout}`.split('\n')[0]).toContain('[T0]');
    expect(`${r.stdout}`).toContain('chặn ở MỌI ngữ cảnh');
    const r2 = explain('QUY_MO');
    expect(`${r2.stdout}`.split('\n')[0]).toContain('[T1]');
    expect(`${r2.stdout}`).toContain('CỬA RA sẽ chặn');
  });

  test('in cả bốn phần cho MỌI mã, và dưới 300 token', () => {
    for (const m of DS) {
      const r = explain(m.code);
      expect(r.status, `${m.code}: --explain lỗi`).toBe(0);
      const out = `${r.stdout}`;
      for (const nhan of ['VÌ SAO:', 'SỬA:', 'VÍ DỤ sai → đúng:']) {
        expect(out, `${m.code}: thiếu mục ${nhan}`).toContain(nhan);
      }
      /* §A5: dưới 300 token. `CHARS_PER_TOK = 3.2` theo `prompt_budget`. */
      expect(Math.ceil(out.length / 3.2), `${m.code}: --explain dài ${Math.ceil(out.length / 3.2)} token`).toBeLessThan(300);
    }
  });

  test('mã lạ ⇒ exit 2 và liệt kê mã có thật, không im lặng', () => {
    const r = explain('KHONG_TON_TAI');
    expect(r.status).toBe(2);
    expect(`${r.stderr}`).toContain('PII');
  });
});
