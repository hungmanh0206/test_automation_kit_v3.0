/**
 * ORACLE CONFIDENCE (#2) và CHẤT LƯỢNG LỜI GHI (#5) — hai thứ đứng cạnh nhau trong `output_gate`.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * #2 — PASS chính thức KHÔNG được đứng trên một CÂU HỎI CÒN TREO
 *
 * Chủ dự án nêu: *"Nếu comment ghi rõ chưa đủ đặc tả để kết luận thì không được phát hành PASS chính
 * thức."*
 *
 * HAI MẪU ĐÃ THỬ VÀ BỎ — ghi lại vì chúng là lý do mẫu hiện tại hẹp đến vậy:
 *   · dò chữ "không có neo / chưa neo": gắn cờ 3 case của CSDL-4008, đọc nguyên văn thì chỉ **1** sai.
 *     Hai case kia ghi `OBSERVATION` cho một khía cạnh PHỤ trong khi oracle chính vẫn có neo — tức
 *     dùng ĐÚNG doctrine. 67% dương tính giả thì không chặn được.
 *   · đòi mã `BR-…`: **50 case PASS** không mang mã BR, nhưng mẫu toàn case cấu trúc kiểu "mở màn,
 *     header ghi đúng cấp" — oracle của chúng nằm ở đặc tả màn, không ở một business rule. Gắn cờ cả
 *     50 là tố oan hàng loạt.
 *
 * MẪU CÒN LẠI: một CÂU HỎI CHƯA ĐƯỢC TRẢ LỜI. Đo trên CSDL-4008: 3 case, 2 PASSED, và cả 2 đều sai
 * thật. Case thứ ba đã FAILED nên không sao. Chặn vì tín hiệu đủ hẹp, không chỉ cảnh báo.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * #5 — comment RỖNG RUỘT
 *
 * `'Executed'` nói đúng một điều người đọc đã biết, và chiếm chỗ của expected/actual/nguồn đo. Đo:
 * **0/241** case của CSDL-4008 dùng nó — đây là lỗ TIỀM ẨN ở giá trị mặc định của recorder, nên việc
 * đúng là BỊT DEFAULT, không phải dựng thêm một cửa ồn ào.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const og = require(path.join(REPO, 'scripts/qa/output_gate.js'));

const ban = (status: string, comment: string, steps: unknown[] = [{ name: 'b', status: 'PASSED', evidence: ['a/x.png'] }]) => ({
  tests: [{ tcId: 'TC_O', status, comment, evidence: ['a/step-01-passed.png'], steps, run: { evidenceDir: 'e/TC_O' } }],
});
const locP = (d: unknown) => ((og.gateTestExecution(d).problems || []) as string[]).filter((p) => /ghi PASS trong khi/.test(p));
const locW = (d: unknown) => ((og.gateTestExecution(d).warnings || []) as string[]).filter((p) => /RỖNG RUỘT/.test(p));

test.describe('@infra #2 oracle confidence — PASS không đứng trên câu hỏi còn treo', () => {
  test('ĐỐI CHỨNG DƯƠNG: PASS + "cần chủ dự án chốt" ⇒ CHẶN, và chỉ đúng verdict thay thế', () => {
    const p = locP(ban('PASSED', 'BR-EMISDN-001 v2 chưa neo hành vi với số nhập tay — cần chủ dự án chốt'));
    expect(p).toHaveLength(1);
    expect(p[0], 'phải chỉ ra verdict đúng là OBSERVATION, không chỉ nói sai').toMatch(/OBSERVATION/);
    expect(p[0], 'và nhắc open_question').toMatch(/open_question/);
  });

  test('ĐỐI CHỨNG ÂM: PASS với lời ghi có căn cứ ⇒ im lặng', () => {
    expect(locP(ban('PASSED', 'Lưới 38 dòng khớp SQL theo DD; mã 112 đúng BR-EMISDN-017'))).toHaveLength(0);
  });

  test('FAILED + câu hỏi treo ⇒ KHÔNG chặn — nó đã không phải PASS', () => {
    expect(locP(ban('FAILED', 'Cần BA chốt: mở mã 144 hay loại người dưới 20'))).toHaveLength(0);
  });

  test('ĐƯỜNG THOÁT: nói rõ câu hỏi KHÔNG ảnh hưởng verdict ⇒ không chặn', () => {
    /*
     * Một câu hỏi treo về khía cạnh PHỤ là chuyện bình thường — chính hai case bị mẫu cũ tố oan là
     * kiểu đó. Cái phải chặn là verdict DỰA TRÊN nó.
     */
    expect(locP(ban('PASSED', 'Tab hiện lưu vết hay không: chưa chốt, nhưng không ảnh hưởng verdict của case này')))
      .toHaveLength(0);
  });

  test('câu hỏi treo nằm ở comment của STEP cũng tính', () => {
    const d = ban('PASSED', 'ổn', [{ name: 'b', status: 'PASSED', comment: 'mã diện chưa chốt — Q9', evidence: ['a/x.png'] }]);
    expect(locP(d)).toHaveLength(1);
  });

  test('MẪU PHẢI HẸP — hai cách dò đã bỏ không được quay lại', () => {
    /*
     * Nếu một ngày ai đó nới mẫu về "chưa neo" hay "thiếu BR", ca này đỏ. Hai chuỗi dưới là đúng hai
     * kiểu câu mà mẫu cũ tố oan.
     */
    expect(locP(ban('PASSED', 'Phím Enter ghi nhận là OBSERVATION — không có neo trong BR-EMISDN-017')),
      '"không có neo" cho một khía cạnh phụ KHÔNG phải vi phạm').toHaveLength(0);
    expect(locP(ban('PASSED', 'Màn mở, không lỗi 500, header ghi đúng cấp Tiểu học')),
      'case cấu trúc không mang mã BR cũng KHÔNG phải vi phạm').toHaveLength(0);
  });

  test('HỒI QUY — năm case CSDL-9002 mà mẫu ĐẦU bỏ lọt 0/5', () => {
    /*
     * PHẢN BIỆN ĐÚNG, 11/11/2026. Người review đối chiếu 5 case này với mẫu đầu và ra **0/5**. Đọc
     * lại: cả 5 đều `PASSED` trong khi comment TỰ KHAI không kết luận được —
     *   "Ghi nhận hành vi thực tế, không chấm đạt hay không đạt vì đặc tả không quy định."
     * Dạng này còn RÕ HƠN cái mẫu đầu bắt: tự nhận không phán được, chứ không phải một câu hỏi treo.
     *
     * LỖI GỐC LÀ CỦA TÔI: tôi neo mẫu vào đúng MỘT task (CSDL-4008), task đó dùng từ "cần … chốt".
     * Con số "2/2 đúng" tôi báo là thật, nhưng nó là độ chính xác TRÊN MỘT TASK — và tôi đã đọc nó
     * thành độ chính xác của luật.
     *
     * Ca này ghim đích danh 5 mã đó. Nới hay siết mẫu về sau đều phải chạy qua đây.
     */
    const p = path.join(REPO, 'outputs/CSDL/tasks/CSDL-9002/test-results/testcase-status.json');
    if (!fs.existsSync(p)) { test.skip(true, 'không có dữ liệu CSDL-9002 trong checkout này'); return; }
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    const bi = locP(doc).join('\n');
    for (const id of ['TC_028', 'TC_030', 'TC_077', 'TC_081', 'TC_112']) {
      expect(bi, `${id}: PASS mà comment tự khai "không chấm đạt hay không đạt" — phải bị chặn`).toContain(id);
    }
    /* Đo lại trên corpus còn tìm ra MỘT case nữa mà bản đối chiếu kia bỏ sót. */
    expect(bi, 'TC_134 cùng họ, cũng phải bị chặn').toContain('TC_134');
  });

  test('ĐỐI CHỨNG ÂM trên dữ liệu THẬT: đã PHỤC HỒI rồi mới chấm ⇒ KHÔNG chặn', () => {
    /*
     * `CSDL_HS_TC_006` nói "BƯỚC NÀY không kết luận được gì; ĐÃ ĐỔI SANG trường có lớp thật, đếm bằng
     * câu lệnh chỉ-đọc". Đó là làm ĐÚNG — một bước không phán được, đổi sang nguồn đo khác, rồi mới
     * kết luận. Mẫu rộng bắt nó; đường thoát phải loại nó ra.
     *
     * Không có ca này thì lần nới mẫu tiếp theo sẽ lặng lẽ biến một việc làm đúng thành vi phạm.
     */
    const p = path.join(REPO, 'outputs/CSDL/tasks/CSDL-9003/test-results/testcase-status.json');
    if (!fs.existsSync(p)) { test.skip(true, 'không có dữ liệu CSDL-9003 trong checkout này'); return; }
    expect(locP(JSON.parse(fs.readFileSync(p, 'utf8'))).join('\n')).not.toContain('TC_006');
  });

  test('`OBSERVATION` KHÔNG bị chặn — đó là verdict ĐÚNG cho tình huống này', () => {
    /*
     * Cửa chỉ soi case PASS. CSDL-9002 có 25 case dùng `OBSERVATION`, tức đội đã biết dùng đúng
     * doctrine; 6 case PASS kia mới là chỗ trượt. Chặn luôn cả OBSERVATION là phạt người làm đúng.
     */
    expect(locP(ban('OBSERVATION', 'Ghi nhận hành vi thực tế, không chấm đạt hay không đạt vì đặc tả không quy định')))
      .toHaveLength(0);
  });

  test('thông điệp gọi ĐÚNG TÊN họ vi phạm — ba họ, ba cách sửa khác nhau', () => {
    const g = (c: string) => locP(ban('PASSED', c))[0] || '';
    expect(g('cần chủ dự án chốt việc này')).toMatch(/CÂU HỎI CHƯA ĐƯỢC TRẢ LỜI/);
    expect(g('Ghi nhận hành vi thực tế, không chấm đạt hay không đạt')).toMatch(/TỰ KHAI KHÔNG KẾT LUẬN ĐƯỢC/);
    expect(g('đặc tả không quy định cột lưới nào')).toMatch(/KHÔNG CÓ ĐẶC TẢ ĐỂ NEO/);
  });

  test('lý do bỏ hai mẫu kia phải còn trong mã — xoá đi là mời người sau làm lại y hệt', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/output_gate.js'), 'utf8');
    expect(src, 'phải ghi con số 50 case BR để người sau không thử lại').toMatch(/50 case PASS/);
    expect(src, 'và tỉ lệ dương tính giả của mẫu dò chữ').toMatch(/67%/);
  });
});

test.describe('@infra #5 chất lượng lời ghi — comment rỗng ruột', () => {
  test('ĐỐI CHỨNG DƯƠNG: `Executed` ⇒ cảnh báo', () => {
    expect(locW(ban('PASSED', 'Executed'))).toHaveLength(1);
    expect(locW(ban('PASSED', 'OK'))).toHaveLength(1);
  });

  test('giá trị mặc định mới cũng bị bắt — nó TỰ TỐ CÁO mình', () => {
    expect(locW(ban('PASSED', '(CHƯA KHAI) — comment phải nêu expected, actual và nguồn đo'))).toHaveLength(1);
  });

  test('ĐỐI CHỨNG ÂM: lời ghi có nội dung ⇒ im lặng', () => {
    expect(locW(ban('PASSED', 'Lưới 38 dòng khớp SQL theo DD, mã 112 đúng BR-EMISDN-017'))).toHaveLength(0);
  });

  test('recorder KHÔNG còn ghi `Executed` làm mặc định', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/utils/evidence_recorder.js'), 'utf8');
    expect(src, 'mặc định phải tự tố cáo là còn thiếu').toMatch(/\(CHƯA KHAI\) — comment phải nêu expected/);
    expect(src, "và không được quay lại giá trị 'Executed'").not.toMatch(/: 'Executed'\)/);
  });

  test('CHỐNG BÁO OAN trên dữ liệu THẬT: CSDL-4008 không sinh cảnh báo rỗng ruột', () => {
    const p = path.join(REPO, 'outputs/CSDL/tasks/CSDL-4008/test-results/testcase-status.json');
    if (!fs.existsSync(p)) { test.skip(true, 'không có dữ liệu task trong checkout này'); return; }
    expect(locW(JSON.parse(fs.readFileSync(p, 'utf8'))), 'đo trước khi sửa: 0/241 — luật mới không được làm đỏ nó')
      .toHaveLength(0);
  });
});
