/**
 * SIẾT CHO LƯỢT MỚI, KHÔNG LÀM ĐỎ VIỆC ĐÃ XONG — ba lỗ hổng đang sống.
 *
 * BỐI CẢNH. Người review đối chiếu bản kit mới với output local và nêu ba con số. Tôi đo lại trên
 * TOÀN CORPUS (1161 bản ghi, 6 task) thì **cả ba đều đúng**, và hai trong ba là chỗ tôi đã nói sai:
 *
 *   · 124 case comment đúng chữ `Executed` — tôi từng báo "0/241, lỗ tiềm ẩn, chưa phải lỗi đang
 *     sống" sau khi nhìn ĐÚNG MỘT task. 106 trong số đó nằm ở TASK-9004, task tôi không mở.
 *   · 154 case PASS KHÔNG có bản ghi step nào — toàn bộ ở TASK-9003. Tôi từng báo "0 ở cả ba task".
 *   ·  16 case FAIL mà mọi step PASS — khớp y hệt con số họ đưa.
 *
 * CÙNG MỘT KIỂU SAI HAI LẦN: đo trên tập con rồi phát biểu như toàn cục.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO HAI MỨC, và vì sao mốc KHÔNG phải ngày tháng
 *
 * Chặn thẳng cả ba là làm đỏ bốn task đã xong cùng lúc, và một cửa đỏ-sẵn thì bị tắt trong một ngày.
 * Để mãi ở mức cảnh báo thì nó không gác gì cho lượt sắp tới.
 *
 * `run.evidenceDir` chỉ có ở bản ghi do recorder SAU 11/11/2026 ghi. Đó là một dấu MÁY ĐẶT, không
 * phải lời khai — nên không ai "chọn" được mức nghiêm ngặt cho mình. Mốc là một THUỘC TÍNH ĐO ĐƯỢC
 * của chính bản ghi, không phải một ngày trong config.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const og = require(path.join(REPO, 'scripts/qa/output_gate.js'));

const EV = ['a/step-01-passed.png'];
const STEP_OK = [{ name: 'b', status: 'PASSED', evidence: ['a/x.png'] }];
const DAU_MOI = { evidenceDir: 'e/TC_X', spec: 's.spec.ts' };

/** Một bản ghi; `moi=true` thì mang dấu `run` do recorder mới đặt. */
const ban = (o: Record<string, unknown>, moi: boolean) => ({
  tests: [{ tcId: 'TC_X', evidence: EV, steps: STEP_OK, comment: 'có nội dung thật', ...o, ...(moi ? { run: DAU_MOI } : {}) }],
});
const M = /có comment RỖNG RUỘT|ghi PASS mà KHÔNG có bản ghi step|chấm FAIL tầng bug/;
const P = (d: unknown) => ((og.gateTestExecution(d).problems || []) as string[]).filter((x) => M.test(x));
const W = (d: unknown) => ((og.gateTestExecution(d).warnings || []) as string[]).filter((x) => M.test(x));

/* Ba hình dạng vi phạm. */
const RONG = { status: 'PASSED', comment: 'Executed' };
const KHONG_STEP = { status: 'PASSED', steps: [] };
const BUG_KHONG_DO = { status: 'FAILED', failureLayer: 'product_bug', reruns: 2 };

test.describe('@infra siết cho lượt MỚI — bản ghi cũ chỉ cảnh báo', () => {
  for (const [ten, hinh] of [['comment rỗng ruột', RONG], ['PASS không step', KHONG_STEP], ['FAIL bug không step đỏ', BUG_KHONG_DO]] as [string, Record<string, unknown>][]) {
    test(`${ten}: bản ghi MỚI ⇒ CHẶN · bản ghi CŨ ⇒ cảnh báo`, () => {
      const moi = ban(hinh, true);
      const cu = ban(hinh, false);
      expect(P(moi), `${ten}: bản ghi có dấu \`run\` phải bị CHẶN`).toHaveLength(1);
      expect(W(moi), 'đã chặn thì thôi cảnh báo — không nói hai lần một chuyện').toHaveLength(0);
      expect(P(cu), `${ten}: bản ghi cũ KHÔNG được chặn — làm đỏ việc đã xong thì cửa bị tắt`).toHaveLength(0);
      expect(W(cu), `${ten}: nhưng phải KÊU, im lặng thì luật không tồn tại`).toHaveLength(1);
      expect(W(cu)[0], 'và phải nói rõ lượt mới sẽ bị chặn').toMatch(/Lượt chạy MỚI sẽ bị CHẶN/);
    });
  }

  test('ĐỐI CHỨNG ÂM: bản ghi MỚI mà sạch ⇒ im lặng hoàn toàn', () => {
    const d = ban({ status: 'PASSED', comment: 'Lưới 38 dòng khớp SQL theo DD; mã 112 đúng BR-BCDN-017' }, true);
    expect(P(d)).toHaveLength(0);
    expect(W(d)).toHaveLength(0);
  });

  test('`doc_outdated` mà mọi step PASS ⇒ KHÔNG chặn — app đúng, ĐẶC TẢ mới sai', () => {
    /*
     * Đây là chỗ mẫu phải HẸP. 16 case "FAIL mà mọi step PASS", nhưng 8 trong đó là `doc_outdated`:
     * app chạy đúng, case lại dựng trên một kỳ vọng đã lỗi thời. Không step nào đỏ là HỢP LÝ.
     * Gắn cờ cả 16 là tố oan đúng một nửa.
     */
    for (const layer of ['doc_outdated', 'setup_failure', 'script_error']) {
      expect(P(ban({ status: 'FAILED', failureLayer: layer, reruns: 2 }, true)),
        `${layer}: FAIL không do sản phẩm thì không đòi step đỏ`).toHaveLength(0);
    }
  });

  test('lượt CHẠY TAY miễn RIÊNG luật "PASS không step" — hai luật kia vẫn áp', () => {
    /*
     * Chạy tay không có recorder nên không bao giờ có step: bắt nó là báo oan, và `manual-run-gate.spec.ts`
     * đã đỏ đúng vì thế. Nhưng miễn trừ phải HẸP — nếu `chayTay` nới luôn comment rỗng ruột hay FAIL
     * không step đỏ thì nhánh chạy tay thành đường lách.
     */
    const tay = (d: unknown) => {
      const g = og.gateTestExecution(d, { chayTay: true });
      return [...(g.problems || []), ...(g.warnings || [])].filter((x: string) => M.test(x));
    };
    expect(tay(ban(KHONG_STEP, false)), 'PASS không step ở lượt chạy tay: im lặng').toHaveLength(0);
    expect(tay(ban(RONG, false)), 'comment rỗng ruột vẫn bị nêu').toHaveLength(1);
    expect(tay(ban(BUG_KHONG_DO, false)), 'FAIL bug không step đỏ vẫn bị nêu').toHaveLength(1);
    expect(P(ban(KHONG_STEP, true)), 'và KHÔNG có cờ thì vẫn chặn như cũ').toHaveLength(1);
  });

  test('mốc là THUỘC TÍNH của bản ghi, không phải ngày trong config', () => {
    /*
     * `run.evidenceDir` do recorder đặt, không phải người khai. Nếu một ngày ai đó đổi sang so ngày
     * tháng trong config thì mức nghiêm ngặt lại trở thành thứ chọn được — ca này giữ chỗ đó.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/output_gate.js'), 'utf8');
    expect(src).toMatch(/const banGhiMoi = \(t\) => Boolean\(t && t\.run && t\.run\.evidenceDir\)/);
    expect(src, 'phải nói rõ vì sao dùng dấu máy-đặt chứ không dùng lời khai').toMatch(/không phải lời khai/);
  });

  test('CON SỐ ĐÃ ĐO trên corpus phải còn trong mã — xoá đi là mất mẫu số', () => {
    /*
     * 124 / 154 / 8 là ba con số đã trả giá để có, và hai trong ba là chỗ tôi báo sai trước đó. Không
     * ghi lại thì lần sau ai đó lại đo một task rồi kết luận cho cả corpus.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/output_gate.js'), 'utf8');
    for (const n of ['124', '154', '1161']) expect(src, `thiếu con số ${n}`).toContain(n);
    expect(src, 'và phải ghi lại chính chỗ tôi đo sai').toMatch(/đúng MỘT task/);
  });
});

test.describe('@infra dữ liệu THẬT — không task cũ nào bị chặn, nhưng tất cả đều được KÊU', () => {
  const BASE = path.join(REPO, 'outputs/DEMO/tasks');

  test('0 case bị CHẶN trên mọi task hiện có (chưa task nào có dấu `run`)', () => {
    if (!fs.existsSync(BASE)) { test.skip(true, 'không có outputs trong checkout này'); return; }
    for (const t of fs.readdirSync(BASE)) {
      const f = path.join(BASE, t, 'test-results', 'testcase-status.json');
      if (!fs.existsSync(f)) continue;
      let d: unknown;
      try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
      expect(P(d), `${t}: luật mới làm đỏ một task đã xong ⇒ xem lại mốc siết`).toHaveLength(0);
    }
  });

  test('ba lỗ hổng vẫn được NÊU RA trên dữ liệu thật — cảnh báo, không im lặng', () => {
    /*
     * Ca song sinh của ca trên. "Không chặn" rất dễ trượt thành "không thấy"; ca này đòi cửa vẫn phải
     * nói ra, nếu không thì mức cảnh báo chỉ là một cách tắt luật cho lịch sự.
     */
    if (!fs.existsSync(BASE)) { test.skip(true, 'không có outputs trong checkout này'); return; }
    const thay = new Set<string>();
    for (const t of fs.readdirSync(BASE)) {
      const f = path.join(BASE, t, 'test-results', 'testcase-status.json');
      if (!fs.existsSync(f)) continue;
      let d: unknown;
      try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
      for (const w of W(d)) {
        if (/comment RỖNG RUỘT/.test(w)) thay.add('rong');
        if (/KHÔNG có bản ghi step/.test(w)) thay.add('khongStep');
        if (/KHÔNG step nào đỏ/.test(w)) thay.add('bugKhongDo');
      }
    }
    expect([...thay].sort(), 'cả ba lỗ hổng đều phải được nêu trên corpus thật').toEqual(['bugKhongDo', 'khongStep', 'rong']);
  });
});
