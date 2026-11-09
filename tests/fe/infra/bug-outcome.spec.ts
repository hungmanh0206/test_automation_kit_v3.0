/**
 * `bug:outcome` — sổ kết cục, và lời khai thẳng về cái KHÔNG tính được.
 *
 * BỐI CẢNH. Chủ dự án nêu: *"chưa có tỷ lệ false PASS, false bug, missed bug và inconclusive"*. Đo
 * trên dữ liệu thật (4 task, 09/11/2026): **141 claim · 119 đã log · 0/119 có nhãn kết cục · 113
 * claim quá 14 ngày chưa có nhãn**.
 *
 * Nên vấn đề không phải thiếu công cụ tính — mà là **SỔ BỎ RƠI LỚP ÂM**. Không ai tính được tỉ lệ sai
 * từ một cuốn sổ chỉ chép phần đúng.
 *
 * LUẬT LỚN NHẤT CỦA MÁY NÀY, và phần lớn ca dưới đây gác nó:
 * **không bao giờ in một tỉ lệ mà không in mẫu số của nó.** Một con số "8% false bug" tính trên 2
 * claim có nhãn trong 40 claim đã log KHÔNG phải tỉ lệ của dự án — in nó trần trụi là nói dối bằng
 * số thật.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'bug_outcome.js');

type Claim = Record<string, unknown>;

const claimMau = (tc: string, extra: Claim = {}): Claim => ({
  id: `CLAIM-${tc}`,
  tc_id: tc,
  status: 'claimed',
  summary: 'x',
  reruns: [{ at: new Date(Date.now() - 40 * 86400000).toISOString(), result: 'fail' }],
  ...extra,
});

function cay(claims: Claim[]): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-'));
  const cd = path.join(d, 'tasks', 'T1', 'reports', 'bug-claims');
  fs.mkdirSync(cd, { recursive: true });
  claims.forEach((c, i) => fs.writeFileSync(path.join(cd, `c${i}.json`), JSON.stringify(c, null, 2), 'utf8'));
  return d;
}

const chay = (goc: string, them: string[] = []) => {
  const r = spawnSync(process.execPath, [CUA, '--goc', goc, ...them], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

test.describe('@infra bug:outcome — tỉ lệ KHÔNG được rời mẫu số', () => {
  test('có claim đã log mà 0 nhãn ⇒ "CHƯA ĐO ĐƯỢC", và KHÔNG in một tỉ lệ nào', () => {
    /*
     * Đây đúng là tình trạng thật hôm nay (0/119). Làm tròn nó thành "0% false bug" là biến một chỗ
     * TRỐNG thành một kết luận TỐT — hỏng theo đúng chiều nguy hiểm.
     */
    const r = chay(cay([claimMau('TC_1'), claimMau('TC_2')]));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/CHƯA ĐO ĐƯỢC TỈ LỆ/);
    expect(r.out, 'không được in bất kỳ tỉ lệ false bug nào khi chưa có nhãn')
      .not.toMatch(/TỈ LỆ FALSE BUG/);
  });

  test('ĐỐI CHỨNG: có nhãn ⇒ in tỉ lệ, VÀ bắt buộc in kèm mẫu số thật', () => {
    const d = cay([
      claimMau('TC_1', { ket_cuc: { nhan: 'rejected', nguon: 'DEV A', at: '2026-11-01T00:00:00Z', vi_sao: 'đúng thiết kế theo FSD' } }),
      claimMau('TC_2', { ket_cuc: { nhan: 'accepted', nguon: 'DEV A', at: '2026-11-01T00:00:00Z' } }),
      claimMau('TC_3'),
      claimMau('TC_4'),
    ]);
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/TỈ LỆ FALSE BUG: 1\/2 = 50%/);
    expect(r.out, 'tỉ lệ rời mẫu số là nói dối bằng số thật').toMatch(/MẪU SỐ LÀ 2, KHÔNG PHẢI 4/);
  });

  test('HAI câu hỏi phải TÁCH: kit tự bắt (①) khác bên ngoài phán (②)', () => {
    /*
     * Gộp hai cái làm một "tỉ lệ sai" là trộn thứ kit TỰ SỬA ĐƯỢC với thứ kit CHƯA BIẾT mình sai.
     * Trên dữ liệu thật: ① = 22/141 (16%), ② = 0/119. Hai con số nói hai chuyện khác hẳn nhau.
     */
    const d = cay([
      claimMau('TC_1', { status: 'withdrawn', withdrawn_by_check: 'đo đối chứng' }),
      claimMau('TC_2'),
    ]);
    const r = chay(d);
    expect(r.out).toMatch(/① KIT TỰ BẮT: 1\/2 = 50%/);
    expect(r.out).toMatch(/② BÊN NGOÀI PHÁN/);
    expect(r.out, 'phải nói phép kiểm nào bắt được, không chỉ đếm').toContain('đo đối chứng');
  });

  test('BỐN tỉ lệ được hỏi: máy phải nói rõ HAI cái nó KHÔNG tính được, và vì sao', () => {
    /*
     * Im lặng về thứ không đo được là cách một báo cáo trông đầy đủ hơn sự thật. `false PASS` và
     * `missed bug` cần nguồn NGOÀI sổ claim — nói ra chỗ đó, đừng để người đọc tự suy là đã có.
     */
    const r = chay(cay([claimMau('TC_1')]));
    expect(r.out).toMatch(/✓ false bug/);
    expect(r.out).toMatch(/✗ false PASS/);
    expect(r.out).toMatch(/✗ missed bug/);
    expect(r.out, 'phải nêu nguồn thay thế cho missed bug, không chỉ nói "không tính được"')
      .toMatch(/929 case/);
  });

  test('cây RỖNG ⇒ "CHƯA ĐO ĐƯỢC", KHÔNG phải "0% sai"', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-rong-'));
    fs.mkdirSync(path.join(d, 'tasks'), { recursive: true });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/CHƯA ĐO ĐƯỢC/);
    expect(r.out).not.toMatch(/TỈ LỆ FALSE BUG/);
  });
});

test.describe('@infra bug:outcome — ghi nhãn phải có chủ và có lý do', () => {
  test('nhãn lạ bị TỪ CHỐI, và liệt kê nhãn hợp lệ', () => {
    const r = chay(cay([claimMau('TC_1')]), ['--ghi', 'TC_1', '--nhan', 'chac_la_sai', '--nguon', 'DEV A']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('không hợp lệ');
    expect(r.out).toContain('by_design');
  });

  test('thiếu `--nguon` ⇒ TỪ CHỐI — một nhãn vô chủ thì lần sau không ai dám tin', () => {
    const r = chay(cay([claimMau('TC_1')]), ['--ghi', 'TC_1', '--nhan', 'accepted']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('nhãn vô chủ');
  });

  test('nhãn NGƯỢC với claim (rejected/by_design/duplicate) bắt buộc `--vi-sao`', () => {
    /*
     * `accepted` chỉ xác nhận điều claim đã nói. `rejected` là một kết luận NGƯỢC LẠI — nó phải mang
     * theo lý do, nếu không sổ sẽ đầy những chữ "rejected" mà không ai tra lại được vì sao.
     */
    const d = cay([claimMau('TC_1')]);
    const thieu = chay(d, ['--ghi', 'TC_1', '--nhan', 'rejected', '--nguon', 'DEV A']);
    expect(thieu.code, 'thiếu lý do thì phải chặn').toBe(1);
    const du = chay(d, ['--ghi', 'TC_1', '--nhan', 'rejected', '--nguon', 'DEV A', '--vi-sao', 'đúng thiết kế theo FSD 4.2']);
    expect(du.code, du.out).toBe(0);
    const sau = chay(d);
    expect(sau.out, 'ghi xong thì tỉ lệ phải đọc được ngay').toMatch(/TỈ LỆ FALSE BUG: 1\/1/);
  });

  test('ĐỐI CHỨNG: `accepted` KHÔNG bị đòi lý do — luật chỉ siết chiều ngược', () => {
    const r = chay(cay([claimMau('TC_1')]), ['--ghi', 'TC_1', '--nhan', 'accepted', '--nguon', 'DEV A']);
    expect(r.code, r.out).toBe(0);
  });
});

test.describe('@infra bug:outcome — `--enforce` là cái làm sổ đầy lên', () => {
  test('claim đã log quá hạn mà chưa có nhãn ⇒ CHẶN, nêu đích danh', () => {
    const r = chay(cay([claimMau('TC_1')]), ['--enforce']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('T1/TC_1');
    expect(r.out, 'phải nói vì sao chặn, không chỉ chặn').toMatch(/bỏ rơi lớp âm/);
  });

  test('ĐỐI CHỨNG: cùng claim đó, có nhãn ⇒ KHÔNG chặn', () => {
    /* Khác ca trên ĐÚNG một thứ: có `ket_cuc` hay không. */
    const r = chay(cay([claimMau('TC_1', {
      ket_cuc: { nhan: 'accepted', nguon: 'DEV A', at: '2026-11-01T00:00:00Z' },
    })]), ['--enforce']);
    expect(r.code, r.out).toBe(0);
  });

  test('ĐỐI CHỨNG: claim MỚI (chưa quá hạn) chưa có nhãn ⇒ KHÔNG chặn', () => {
    /* Chặn ngay khi vừa log là đòi DEV trả lời tức thì — luật đó sẽ bị tắt trong một tuần. */
    const r = chay(cay([claimMau('TC_1', {
      reruns: [{ at: new Date().toISOString(), result: 'fail' }],
    })]), ['--enforce']);
    expect(r.code, r.out).toBe(0);
  });
});
