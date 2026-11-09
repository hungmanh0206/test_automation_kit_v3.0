import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * Máy `bug:claim` chặn "phát hiện bug sai rồi phải rút lời".
 *
 * Bối cảnh, chủ repo chỉ ra 16/09/2026: ở Phase 2 agent báo "phát hiện bug, có log không", user hỏi
 * lại "chắc chưa", agent kiểm lại rồi rút. Gốc là lỗi THỨ TỰ: bar khẳng định bug nằm ở
 * `phase2_04` với khoảng tám điều kiện, còn lời nói ra ở `phase2_03` với hai điều kiện.
 *
 * File này khoá hành vi của máy bằng đối chứng âm. Một gate chỉ xanh trên đường tốt thì chưa chứng
 * minh được gì: phải thấy nó ĐỎ đúng chỗ, và đỏ với thông báo chỉ ra được việc cần làm.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MACHINE = path.join(REPO, 'scripts', 'qa', 'bug_claim.js');

/** Chạy máy trong một task NHÁP ngoài repo, để không chạm outputs thật. */
function run(tmp: string, args: string[] = ['--check']) {
  const r = spawnSync(process.execPath, [MACHINE, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: gateEnv({ PROJECT_OUTPUT_DIR: tmp, TASK_KEY: 'CLAIM-TEST' }),
  });
  return { code: r.status === null ? 1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function mkTask(): { root: string; claims: string; results: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bugclaim-'));
  const task = path.join(root, 'tasks', 'CLAIM-TEST');
  const claims = path.join(task, 'reports', 'bug-claims');
  const results = path.join(task, 'test-results');
  fs.mkdirSync(claims, { recursive: true });
  fs.mkdirSync(results, { recursive: true });
  /* Hợp đồng mới: phản chứng phải neo vào artifact CÓ THẬT, nên cây mẫu phải có chúng. */
  dungArtifact(root);
  return { root, claims, results };
}

/** Claim hợp lệ đầy đủ — mọi test dưới đây làm hỏng đúng MỘT chỗ từ bản này. */
const validClaim = () => ({
  id: 'CLAIM-TC_001',
  tc_id: 'TC_001',
  summary: 'Paid Amount cong doi khi callback lap lai',
  status: 'claimed',
  oracle: { type: 'FSD', ref: 'FSD 4.2.3', quote: 'Moi giao dich da xac nhan chi duoc cong dung mot lan' },
  expected: 'Paid Amount = 2.000.000',
  actual: 'Paid Amount = 4.000.000',
  reruns: [{ at: '2026-09-16T09:10:00Z', result: 'fail' }, { at: '2026-09-16T09:22:00Z', result: 'fail' }],
  layer: 'be',
  layer_probe: 'GET /api/v1/orders/1774127 tra paid_amount=4000000, UI cung hien the nen lech o BE',
  instrument: { control_type: 'cell bang', read_method: 'doc textContent theo chi so cot lay tu th' },
  fixture_path: 'api',
  /*
   * CẬP NHẬT 09/11/2026 — mỗi `measurement` nay phải NEO vào một artifact có thật của lượt chạy.
   *
   * Ba câu cũ ở đây đều là văn xuôi có chữ số, và chúng qua cửa. Đo được: một claim mà CẢ BA phản
   * chứng là văn xuôi nghĩ ra tại chỗ — không lượt chạy nào xảy ra — vẫn cho `OK, 1 claim hợp lệ`.
   * Nên fixture này đổi theo hợp đồng MỚI, không phải nới ra cho qua: nó nay phải trỏ vào file mà
   * `mkTask()` thật sự tạo.
   */
  falsified: [
    { category: 'doc_outdated', hypothesis: 'FSD co the cu hon build', measurement: 'doi chieu FSD voi build, ket qua o evidence/fsd-version/v35.png', result: 'FSD moi hon build' },
    { category: 'instrument', hypothesis: 'Doc nham cell vi bang co cot an', measurement: 'doi chieu chi so cot tu th 7/11, doc lai bang evidence/doi-chieu-cot/lan-2.png', result: 'hai nguon cung gia tri' },
    { category: 'fixture', hypothesis: 'Deal dung khong tu nhien', measurement: 'tao qua UI OPS luong Next-Finish-Confirm, buoc ghi o evidence/fixture-ui/confirm.png', result: 'fixture di dung luong app' },
  ],
});

/** Những artifact mà `validClaim()` trỏ tới — phải CÓ THẬT, nếu không claim hợp lệ cũng bị chặn. */
const NEO_CUA_VALID = ['fsd-version/v35.png', 'doi-chieu-cot/lan-2.png', 'fixture-ui/confirm.png'];
function dungArtifact(root: string): void {
  for (const p of NEO_CUA_VALID) {
    const f = path.join(root, 'tasks', 'CLAIM-TEST', 'evidence', p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from('89504e470d0a1a0a', 'hex'));
  }
}

const writeClaim = (dir: string, name: string, obj: unknown) => fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(obj, null, 2), 'utf8');

test.describe('@infra bug:claim — kiểm chứng phải đi trước lời nói', () => {
  test('claim đầy đủ thì QUA', () => {
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', validClaim());
    const r = run(t.root);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('1 claim hợp lệ');
  });

  test('thiếu oracle độc lập thì CHẶN — app không được làm oracle của chính nó', () => {
    const t = mkTask();
    const c = validClaim();
    (c as Record<string, unknown>).oracle = { type: '', ref: '', quote: '' };
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('oracle.type');
  });

  test('rerun không ổn định thì CHẶN — đó là flaky, chưa phải bug', () => {
    const t = mkTask();
    const c = validClaim();
    c.reruns = [{ at: '2026-09-16T09:10:00Z', result: 'fail' }, { at: '2026-09-16T09:22:00Z', result: 'pass' }];
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('không ổn định');
  });

  test('thiếu một nhóm phản chứng thì CHẶN', () => {
    const t = mkTask();
    const c = validClaim();
    c.falsified = c.falsified.filter((f) => f.category !== 'instrument');
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('instrument');
  });

  test('phản chứng không NEO vào artifact có thật thì CHẶN', () => {
    /*
     * ĐÍNH CHÍNH TIỀN ĐỀ, 09/11/2026. Chú thích cũ ở đây viết: *"Bịa một phép đo khó hơn bịa một
     * câu."* — và nó SAI. Đo được: một claim mà CẢ BA phản chứng là văn xuôi nghĩ ra tại chỗ (không
     * lượt chạy nào xảy ra, không file nào được sinh) qua cửa với `OK, 1 claim hợp lệ`. Vì phép kiểm
     * cũ chỉ đòi ≥20 ký tự và có một chữ số — nó chấm CHÍNH TẢ, không chấm phép đo.
     *
     * Hợp đồng mới: phép đo phải trỏ tới một file CÓ THẬT trong cây kết quả của task — thứ chỉ tồn
     * tại nếu lượt chạy đã xảy ra. Không máy nào xác minh được một phép đo đã xảy ra bằng cách khác;
     * mọi cách khác đều là kiểm HÌNH THỨC, và hình thức thì bịa được.
     */
    const t = mkTask();
    const c = validClaim();
    c.falsified[1].measurement = 'toi da kiem tra lai nhieu lan va thay dung roi, 5 lan deu the';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code, 'câu này có chữ số và đủ dài — phép kiểm cũ cho qua').toBe(1);
    expect(r.out).toContain('ARTIFACT');
  });

  test('ĐỐI CHỨNG: trỏ tới file KHÔNG tồn tại cũng CHẶN — và nói ra tên file', () => {
    /*
     * Cặp với ca trên. Nếu chỉ đòi "có dạng đường dẫn" thì bịa một ĐƯỜNG DẪN dễ hơn bịa một câu, và
     * đường dẫn còn trông giống bằng chứng hơn. Khác biệt duy nhất giữa hai ca là file có thật hay không.
     */
    const t = mkTask();
    const c = validClaim();
    c.falsified[1].measurement = 'doi chieu lai, ket qua o evidence/khong-he-ton-tai/lan-9.png';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('khong-he-ton-tai/lan-9.png');
  });

  test('lối thoát `khong-do-duoc:` KÈM LÝ DO thì qua, và BỊ ĐẾM RA', () => {
    /*
     * Có phép đo thật mà không sinh file: đọc ngày sửa một tài liệu, so hai dòng trong spec. Cấm tiệt
     * thì người ta bịa một đường dẫn thay vì bịa một câu — tệ hơn. Nhưng lối thoát không ai đếm thì
     * nó thành lối đi chính, nên cửa phải IN RA số lần dùng.
     */
    const t = mkTask();
    const c = validClaim();
    c.falsified[0].measurement = 'khong-do-duoc: doc ngay sua cua FSD tren Google Sheet, thao tac khong sinh file nao';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'dùng lối thoát mà không ai đếm thì nó thành lối đi chính').toMatch(/1 phép đo dùng lối thoát/);
  });

  test('ĐỐI CHỨNG: lối thoát KHÔNG lý do thì CHẶN', () => {
    const t = mkTask();
    const c = validClaim();
    c.falsified[0].measurement = 'khong-do-duoc: x';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code, 'lối thoát không đòi lý do thì nó là công tắc tắt cửa').toBe(1);
  });

  test('fixture dựng thẳng DB thì CHẶN', () => {
    const t = mkTask();
    const c = validClaim();
    c.fixture_path = 'db';
    writeClaim(t.claims, 'TC_001', c);
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('fixture_path');
  });

  test('CHIỀU NGƯỢC: case chấm product_bug mà không có claim thì CHẶN', () => {
    /* Nửa quan trọng nhất. Chỉ kiểm claim đã viết thì bỏ lọt claim KHÔNG viết, mà đó mới là lỗi cần chặn. */
    const t = mkTask();
    fs.writeFileSync(path.join(t.results, 'testcase-status.json'), JSON.stringify({
      tests: [{ id: 'TC_099', status: 'FAIL', failureLayer: 'product_bug' }],
    }), 'utf8');
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('TC_099');
    expect(r.out).toContain('KHÔNG có claim');
  });

  test('claim đã RÚT mà verdict chưa hạ thì CHẶN, và nói đúng việc cần làm', () => {
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', {
      id: 'C1', tc_id: 'TC_001', summary: 'Paid Amount cong doi', status: 'withdrawn',
      withdrawn_reason: 'FSD v35 moi hon build, con so cu la tai lieu het han', withdrawn_by_check: 'doc_outdated',
    });
    fs.writeFileSync(path.join(t.results, 'testcase-status.json'), JSON.stringify({
      tests: [{ id: 'TC_001', status: 'FAIL', failureLayer: 'product_bug' }],
    }), 'utf8');
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('ĐÃ RÚT');
    expect(r.out).toContain('sửa verdict');
  });

  test('claim RÚT chỉ cần lý do và tên phép kiểm, không bắt đủ trường', () => {
    /*
     * Cố ý nới ở đây. Mục đích của bản ghi rút là ĐẾM ĐƯỢC lỗi, không phải phạt việc thành thật.
     * Bắt nó đầy đủ thì lần sau sẽ không ai ghi, và ta quay lại chỗ cũ: lỗi vô hình, không đo được.
     */
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', {
      id: 'C1', tc_id: 'TC_001', summary: 'Paid Amount cong doi', status: 'withdrawn',
      withdrawn_reason: 'doc lai bang API thay UI hien dung, dung cu doc sai cell', withdrawn_by_check: 'instrument',
    });
    const r = run(t.root);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('1 đã rút');
  });

  test('đọc được CẢ HAI đời khuôn status: `id` và `tcId`', () => {
    /*
     * Chạy trên task thật mới lộ ra: bộ cũ ghi `id`, bộ mới ghi `tcId`. Đọc một khoá thì bộ kia in
     * "case undefined" và thông báo thành vô dụng. Đã dính thật ở CSDL-28905.
     */
    const t = mkTask();
    fs.writeFileSync(path.join(t.results, 'testcase-status.json'), JSON.stringify({
      tests: [{ tcId: 'CSDL_CFMIG_TC_070', status: 'FAIL', failureLayer: 'product_bug' }],
    }), 'utf8');
    const r = run(t.root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('CSDL_CFMIG_TC_070');
    expect(r.out).not.toContain('undefined');
  });

  test('case ĐÃ CÓ bug key thì bỏ qua, nhưng phải ĐẾM và nói ra', () => {
    /*
     * Gate này chặn claim CHƯA kiểm chứng lọt tới người đọc, không đòi hồi tố cho bug đã log và đã
     * đóng. Case mang `bug: <KEY>-<số>` nghĩa là đã qua gate của phase2_04. Bắt nó viết claim ngược
     * là biến gate thành tiếng ồn trên nợ cũ, mà gate hay báo oan thì bị tắt.
     * Vẫn phải IN ra số bỏ qua: bỏ qua âm thầm là cách một gate chết dần mà không ai biết.
     */
    const t = mkTask();
    fs.writeFileSync(path.join(t.results, 'testcase-status.json'), JSON.stringify({
      tests: [{ id: 'SAP_SYNC_TC_032', status: 'FAIL', failureLayer: 'product_bug', bug: 'CSDL-29161' }],
    }), 'utf8');
    const r = run(t.root);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('Bỏ qua 1 case đã có bug key');
  });

  test('--report đếm tỉ lệ rút và phép kiểm nào bắt được', () => {
    const t = mkTask();
    writeClaim(t.claims, 'TC_001', validClaim());
    writeClaim(t.claims, 'TC_002', {
      id: 'C2', tc_id: 'TC_002', summary: 'Hạn checkout sai', status: 'withdrawn',
      withdrawn_reason: 'FSD ghi 24h la tai lieu cu, build dung 720h', withdrawn_by_check: 'doc_outdated',
    });
    const r = run(t.root, ['--report']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('tỉ lệ rút: 50%');
    expect(r.out).toContain('doc_outdated');
  });
});
