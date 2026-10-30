/*
 * `parity:check` khối ⑤ — một ✅ không được dán khi mục con chưa xong (v2.9.6 N2.4).
 *
 * VÌ SAO CẦN. Bảng nghiệm thu chấm theo §, mà một § có thể gồm nhiều việc. v2.9.5 dán ✅ cho §7 khi nó
 * chỉ có skill `run_report_reader` + view `trace:matrix --pm`; phần LÕI của `test-report-analyzer` bên A
 * (gom theo nguyên nhân · phân loại tầng · chiều test mồ côi) thì chưa có. Dòng ✅ ấy không sai từng chữ,
 * nhưng nó làm người đọc tin cả § đã xong — và không máy nào bắt được, vì máy chỉ đọc KÝ HIỆU.
 *
 * `plan_items.json` khai mục con, và mỗi mục con bắt buộc có NEO MÁY PHÂN GIẢI ĐƯỢC. Không có neo thì
 * file ấy chỉ là một lớp tự khai nữa — đúng thứ kit cấm, và đúng thứ phép kiểm dưới đây gác.
 *
 * Khối ⑤ chặn THẬT ngay lượt đầu, trên dữ liệu thật: nó đỏ vì chính spec này chưa tồn tại.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/parity_check.js');
const DOC = path.join(REPO, 'docs/v2.9.5/A_PARITY.md');
const KE_HOACH_THAT = path.join(REPO, 'docs/v2.9.6/plan_items.json');

/** Ghi một bản tài liệu + bản kế hoạch ra thư mục tạm. KHÔNG chạm bản thật. */
function dungTam(tt: '✅' | '⚠️' | '⛔', con: unknown[], section = '§TEST') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-plan-'));
  /* Giữ nguyên bản tài liệu thật rồi THÊM một dòng § riêng, để mọi phép kiểm khác của cửa vẫn đạt. */
  const goc = fs.readFileSync(DOC, 'utf8');
  const them = `| ${section} | việc giả cho phép kiểm | mô tả | \`npm run parity:check\` | ${tt} |`;
  const L = goc.split('\n');
  const i = L.findIndex((l) => l.startsWith('| §7 |'));
  L.splice(i + 1, 0, them);
  const f = path.join(d, 'A_PARITY.md');
  fs.writeFileSync(f, L.join('\n'), 'utf8');

  const kh = path.join(d, 'plan.json');
  fs.writeFileSync(kh, JSON.stringify({ muc: [{ section, ten: 'việc giả', con }] }, null, 2), 'utf8');
  return { d, f, kh };
}

function chay(f: string, kh: string) {
  const r = spawnSync(process.execPath, [GATE, '--file', f, '--plan', kh],
    { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/* Một mục con CÓ neo phân giải được, dùng làm nền cho các ca khác. */
const CON_OK = {
  ma: 'X1', viec: 'việc đã xong',
  neo: { loai: 'spec', duong: 'tests/fe/infra/parity-plan-items.spec.ts', toiThieu: 1 },
};

test.describe('@infra parity:check ⑤ — ✅ phải có mọi mục con đã xong', () => {
  test('ĐỐI CHỨNG DƯƠNG: mục con thiếu spec mà § dán ✅ ⇒ CHẶN, và NÊU TÊN mục con', () => {
    const t = dungTam('✅', [CON_OK, {
      ma: 'X2', viec: 'việc chưa xong',
      neo: { loai: 'spec', duong: 'tests/fe/infra/khong-he-co-file-nay.spec.ts', toiThieu: 3 },
    }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/§TEST đang dán ✅ nhưng 1 mục con CHƯA XONG/);
    expect(r.out, 'phải nêu MÃ mục con, không chỉ nói "có chỗ chưa xong"').toContain('X2');
    expect(r.out, 'và nêu đúng cái thiếu').toContain('khong-he-co-file-nay.spec.ts');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: spec có mặt nhưng ÍT phép kiểm hơn mức đã khai ⇒ CHẶN', () => {
    /* Trỏ vào một file spec có thật nhưng đòi một mức không ai đạt — "có file" ≠ "đã làm". */
    const t = dungTam('✅', [{
      ma: 'X3', viec: 'khai thừa mức',
      neo: { loai: 'spec', duong: 'tests/fe/infra/parity-plan-items.spec.ts', toiThieu: 9999 },
    }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/chỉ có \d+ phép kiểm, khai tối thiểu 9999/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: mục chỉ NGƯỜI kiểm được mà § dán ✅ ⇒ CHẶN, đòi hạ về ⚠️', () => {
    /*
     * Đây là chỗ luật "mọi mẫu lấy từ A phải có máy, hoặc phải khai rõ CHƯA CÓ MÁY" được thi hành bằng
     * máy thay vì bằng thiện chí. Một § còn việc chỉ người làm được thì nó CHƯA có máy, dù phần còn lại
     * có đủ máy đến đâu.
     */
    const t = dungTam('✅', [CON_OK, {
      ma: 'X4', viec: 'việc chỉ người chốt được',
      neo: { loai: 'nguoi', vi_sao: 'bật chặn sẽ chặn dữ liệu đang chạy thật của người dùng' },
    }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/có mục con chỉ NGƯỜI kiểm được ⇒ phải là ⚠️, không phải ✅/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: cùng mục đó mà § khai ⚠️ ⇒ SẠCH', () => {
    const t = dungTam('⚠️', [CON_OK, {
      ma: 'X4', viec: 'việc chỉ người chốt được',
      neo: { loai: 'nguoi', vi_sao: 'người dùng phải chốt chỗ nối' },
    }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/§TEST: 2 mục con · 0 chưa xong · có mục chỉ người kiểm được/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: neo `nguoi` mà KHÔNG ghi `vi_sao` ⇒ CHẶN', () => {
    /*
     * Không có phép kiểm này thì `nguoi` thành đường thoát: khai một mục "người làm" là § hết bị đòi máy,
     * mà chẳng ai phải nói vì sao máy không làm được.
     */
    const t = dungTam('⚠️', [{ ma: 'X5', viec: 'việc gì đó', neo: { loai: 'nguoi' } }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/neo `nguoi` mà KHÔNG ghi `vi_sao`/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('CHIỀU NGƯỢC: mọi mục con đã xong mà § vẫn ⚠️ ⇒ NHẮC nâng lên (không chặn)', () => {
    /*
     * Thiếu chiều này thì ⚠️ thành chỗ trú ẩn vĩnh viễn — hạ một dòng xuống ⚠️ là cách rẻ nhất để hết đỏ
     * mà không làm gì. Nhắc chứ không chặn: hạ xuống ⚠️ có thể là quyết định đúng, chỉ cần nói ra.
     */
    const t = dungTam('⚠️', [CON_OK]);
    const r = chay(t.f, t.kh);
    expect(r.code, 'nhắc thì KHÔNG được làm đỏ').toBe(0);
    expect(r.out).toMatch(/mọi mục con đã phân giải mà dòng vẫn ⚠️ — nâng lên ✅/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: mọi mục con đã xong và § dán ✅ ⇒ SẠCH', () => {
    const t = dungTam('✅', [CON_OK, {
      ma: 'X6', viec: 'việc neo vào npm script',
      neo: { loai: 'script', ten: 'parity:check' },
    }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/§TEST: 2 mục con · 0 chưa xong/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('neo `nguon` đòi KÝ HIỆU có thật trong file — "có file" chưa phải "đã làm"', () => {
    const co = dungTam('✅', [{
      ma: 'X7', viec: 'việc đã vào mã',
      neo: { loai: 'nguon', duong: 'scripts/qa/parity_check.js', ky_hieu: 'plan_items.json' },
    }]);
    expect(chay(co.f, co.kh).code, chay(co.f, co.kh).out).toBe(0);
    fs.rmSync(co.d, { recursive: true, force: true });

    const khong = dungTam('✅', [{
      ma: 'X8', viec: 'việc chưa vào mã',
      neo: { loai: 'nguon', duong: 'scripts/qa/parity_check.js', ky_hieu: 'khongHeCoKyHieuNayTrongFile' },
    }]);
    const r = chay(khong.f, khong.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/KHÔNG chứa `khongHeCoKyHieuNayTrongFile` ⇒ việc chưa vào mã/);
    fs.rmSync(khong.d, { recursive: true, force: true });
  });

  test('neo loại LẠ ⇒ CHẶN, không bỏ qua im lặng', () => {
    /* Bỏ qua loại không hiểu là cách êm nhất để vô hiệu hoá cả khối: khai `loai: "xong_roi"` là hết đỏ. */
    const t = dungTam('✅', [{ ma: 'X9', viec: 'neo lạ', neo: { loai: 'xong_roi' } }]);
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/neo loại `xong_roi` không hiểu được/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('"KHÔNG phán được" KHÔNG thành "đạt": kế hoạch 0 mục ⇒ CHẶN; thiếu file ⇒ nói BỎ QUA', () => {
    const t = dungTam('✅', []);
    fs.writeFileSync(t.kh, JSON.stringify({ muc: [] }), 'utf8');
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/có 0 mục ⇒ khối ⑤ rỗng; file rỗng KHÔNG đồng nghĩa với đạt/);

    const r2 = chay(t.f, path.join(t.d, 'khong-co-file-nao.json'));
    expect(r2.out, 'thiếu file thì phải NÓI bỏ qua, không im lặng').toMatch(/khối ⑤ BỎ QUA \(không phải đạt\)/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('§ khai trong kế hoạch mà bảng KHÔNG có dòng nào ⇒ CHẶN', () => {
    /* Hai tài liệu lệch nhau thì bảng đang chấm một thứ khác với thứ kế hoạch nói. */
    const t = dungTam('✅', [CON_OK], '§KHONG_CO_TRONG_BANG');
    /* Gỡ dòng vừa thêm để § chỉ còn trong kế hoạch. */
    fs.writeFileSync(t.f, fs.readFileSync(t.f, 'utf8').split('\n')
      .filter((l) => !l.startsWith('| §KHONG_CO_TRONG_BANG |')).join('\n'), 'utf8');
    const r = chay(t.f, t.kh);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/bảng nghiệm thu KHÔNG có dòng nào cho § này/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('BẢN KẾ HOẠCH THẬT: mọi mục con đều phân giải được, và mục `nguoi` có `vi_sao`', () => {
    /*
     * Phép kiểm này soi chính `docs/v2.9.6/plan_items.json`, nên nó là chỗ bắt được việc khai một mã
     * chưa có neo. Nó KHÔNG đọc ký hiệu — nó đòi neo phân giải thật.
     */
    const kh = JSON.parse(fs.readFileSync(KE_HOACH_THAT, 'utf8'));
    expect((kh.muc || []).length, 'bản kế hoạch rỗng thì khối ⑤ không gác gì').toBeGreaterThan(0);
    for (const m of kh.muc) {
      expect((m.con || []).length, `${m.section} khai 0 mục con`).toBeGreaterThan(0);
      for (const c of m.con) {
        const neo = c.neo || {};
        expect(['script', 'spec', 'nguon', 'nguoi'], `${m.section}/${c.ma}`).toContain(neo.loai);
        if (neo.loai === 'nguoi') {
          expect(String(neo.vi_sao || '').length, `${m.section}/${c.ma} phải nói vì sao máy không làm được`)
            .toBeGreaterThan(40);
        } else if (neo.loai === 'script') {
          const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
          expect(pkg.scripts, `${m.section}/${c.ma}`).toHaveProperty(neo.ten);
        } else {
          expect(fs.existsSync(path.join(REPO, neo.duong)), `${m.section}/${c.ma}: thiếu ${neo.duong}`).toBe(true);
        }
      }
    }
  });
});
