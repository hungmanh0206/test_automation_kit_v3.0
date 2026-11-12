/**
 * finding.js — hạt nhân của phần MỞ RỘNG QUANH CASE: biến quan sát thành **finding có neo**.
 *
 * VÌ SAO TỒN TẠI (đây là chỗ dễ làm hỏng cả ý tưởng 5 trục): khi mở sang field lân cận / bề mặt khác, kit phải
 * biết **cái đúng là gì**. Không có nguồn thì mặc định "app đang hiện thế là đúng" ⇒ tautology, và nhân lên theo
 * số trục. Lúc đó không giảm bug lọt mà **sản xuất PASS giả nhìn rất thuyết phục**.
 *
 * Bằng chứng đây không phải lo xa: `persistence_probe` bản đầu trả `ok: true` khi 4 điểm khớp nhau. Test của
 * chính nó (case TASK-28403, USD không quy đổi) có `form/payload/api/ui = 10` — **khớp cả 4 mà sai cả 4**, giá
 * trị đúng phải là 260.500. Tên field `ok` chính là mầm PASS giả.
 *
 * BA LOẠI KẾT LUẬN — luật cứng:
 *   1. `EXPANSION_FINDING` — app **tự mâu thuẫn với chính nó** (giá trị lệch giữa 2 bề mặt, mắt đứt trong chuỗi
 *      lưu trữ, field thừa/thiếu so tài liệu). Đây là defect **không cần oracle ngoài**: hai nơi cùng nguồn mà
 *      khác nhau thì chắc chắn có một nơi sai. Được log bug. KHÔNG phải verdict của case gốc.
 *   2. `PASS` / `FAIL` — CHỈ khi có `oracle_ref` (`BR-`/`SM-`/`PM-`/`SS-`/`DM-`/`UI-`) và `expected` lấy từ đó.
 *   3. `OBSERVATION` — quan sát được nhưng **không có oracle**: nhất quán ≠ đúng. Bắt buộc kèm `open_question`.
 *      Không tính vào pass-rate, không log bug.
 *
 * Nói cách khác: **nhất quán KHÔNG phải bằng chứng của đúng**; nó chỉ loại được một lớp sai.
 */

const fs = require('fs');
const path = require('path');

/*
 * Trục mở rộng. ①②③ cần runtime (DOM/response thật) ⇒ thuộc Phase 2. ④⑤ sinh case được từ tài liệu
 * (permission matrix / state machine) ⇒ CASE thuộc Phase 1, Phase 2 chỉ đo "ô nào chạy được".
 *
 * SINH TỪ `axes.js` (v2.8.1 bước 1b). Bảng này trước đây gõ tay và sai hai chỗ KHÔNG nhìn ra được nếu
 * chỉ đọc một file:
 *
 *   · `⑥concurrency` / `⑦reverse` chiếm đúng hai số mà v2.8.1 định cấp cho hai trục mới. Trục mới mà
 *     vẫn đánh ⑥⑦ thì hai thứ khác nhau mang chung một `id` trong cùng một kho finding.
 *   · `reverse` ở đây định nghĩa là "huỷ/hoàn → về trạng thái cũ", trong khi `CLAUDE.md` §3 và
 *     `expansion_audit` hiểu chiều ngược là `spec:gap` (build→tài liệu). Một finding gắn `reverse` theo
 *     nghĩa huỷ/hoàn sẽ được audit tính là ĐÃ PHỦ spec:gap — tức báo phủ một chiều chưa ai đo.
 *
 * Đo trước khi đổi: toàn repo có 2 finding ghi ra đĩa, mang `①field` và `④branch`. Hai khoá kia chưa
 * từng được dùng, nên lượt này không mất dữ liệu nào.
 *
 * `label` và `hasDocOracle` Ở LẠI ĐÂY, có chủ ý: `label` là chữ hiển thị trong báo cáo finding (ngắn hơn
 * `ten` của axes.js, vốn viết cho người đọc tài liệu), còn `hasDocOracle` là chuyện của finding — trục
 * nào có thể neo thẳng vào tài liệu. `tests/fe/infra/expansion-gates.spec.ts` canh phần sinh từ nguồn.
 */
const axesSrc = require(path.join(__dirname, 'axes.js'));

const DOC_ORACLE = { field: true, surface: false, persist: false, branch: true, state: true, reverse: false };
const LABEL = {
  field: 'Field cùng khối',
  surface: 'Cùng giá trị, khác nơi hiển thị',
  persist: 'Chuỗi lưu trữ form→payload→API→UI',
  branch: 'Nhánh/biến thể',
  state: 'Trạng thái kế cận',
  reverse: 'Chiều ngược (build→tài liệu, spec:gap)',
};

const AXES = {};
for (const t of axesSrc.TRUC) {
  AXES[t.key] = { id: axesSrc.idTruc(t), label: LABEL[t.key], phase: t.phase, hasDocOracle: DOC_ORACLE[t.key] };
}
/* Chiều ngược KHÔNG mang số khoanh — `CLAUDE.md` gọi nó là "+ chiều ngược", không phải trục thứ N. */
AXES[axesSrc.CHIEU_NGUOC.key] = {
  id: axesSrc.CHIEU_NGUOC.key,
  label: LABEL[axesSrc.CHIEU_NGUOC.key],
  phase: axesSrc.CHIEU_NGUOC.phase,
  hasDocOracle: DOC_ORACLE[axesSrc.CHIEU_NGUOC.key],
};

// Oracle hợp lệ = id trong knowledge store, KHÔNG phải "theo tôi thấy". UI- dành cho contract FE trích từ design.
const ORACLE_RE = /^(BR|SM|PM|SS|DM|UI)-[A-Z0-9]+-\d{3}$/;

const VERDICTS = ['EXPANSION_FINDING', 'PASS', 'FAIL', 'OBSERVATION'];

/**
 * Quyết định verdict theo luật trên. `selfInconsistent` = app tự mâu thuẫn (đo được, không cần oracle).
 * @returns {{verdict: string, reason: string, downgraded?: string}}
 */
function decide({ selfInconsistent, oracleRef, expected, actual }) {
  const hasOracle = ORACLE_RE.test(String(oracleRef || ''));
  if (selfInconsistent) {
    return { verdict: 'EXPANSION_FINDING', reason: 'app tự mâu thuẫn với chính nó — có một nơi sai, không cần oracle ngoài' };
  }
  if (!hasOracle) {
    return {
      verdict: 'OBSERVATION',
      reason: 'không có `oracle_ref` hợp lệ ⇒ nhất quán KHÔNG phải bằng chứng của đúng; phải kèm open_question',
      downgraded: 'PASS→OBSERVATION',
    };
  }
  const same = String(expected).replace(/\s+/g, '') === String(actual).replace(/\s+/g, '');
  return same
    ? { verdict: 'PASS', reason: `khớp oracle ${oracleRef}` }
    : { verdict: 'FAIL', reason: `lệch oracle ${oracleRef}: cần "${expected}", thấy "${actual}"` };
}

/** Dựng một finding đã chuẩn hoá + tự hạ cấp nếu thiếu neo. Không bao giờ trả PASS khi thiếu oracle. */
function makeFinding(input) {
  /* Dải số khoanh lấy từ `axes.js`: thêm trục ⑧ sau này mà quên nới regex ở đây là lặng lẽ mất meta. */
  const axis = String(input.axis || '').replace(new RegExp(`^[${axesSrc.SO_KHOANH.join('')}]`), '');
  const meta = AXES[axis] || AXES[String(input.axis || '')] || null;
  const d = decide({
    selfInconsistent: !!input.self_inconsistent,
    oracleRef: input.oracle_ref,
    expected: input.expected,
    actual: input.actual,
  });
  const f = {
    axis: meta ? meta.id : String(input.axis || '?'),
    base_tc: input.base_tc || null,               // finding thuộc case NÀO — để triage nối lại được
    surface: input.surface || null,               // đo ở đâu (URL/endpoint/khối)
    expected: input.expected === undefined ? null : String(input.expected),
    actual: input.actual === undefined ? null : String(input.actual),
    oracle_ref: ORACLE_RE.test(String(input.oracle_ref || '')) ? input.oracle_ref : null,
    verdict: d.verdict,
    reason: d.reason,
    evidence: input.evidence || null,
  };
  if (d.downgraded) f.downgraded = d.downgraded;
  if (f.verdict === 'OBSERVATION') {
    f.open_question = input.open_question
      || `Giá trị này đúng theo nguồn nào? Chưa có ${meta && meta.hasDocOracle ? 'rule/bản đồ' : 'oracle ngoài app'} để đối chiếu — cần BA/Dev xác nhận rồi ghi thành BR-/SM-/UI-.`;
  }
  if (input.oracle_ref && !f.oracle_ref) {
    f.oracle_invalid = `"${input.oracle_ref}" không đúng dạng id knowledge (BR|SM|PM|SS|DM|UI)-XXX-000 ⇒ bị bỏ, coi như KHÔNG có oracle`;
  }
  return f;
}

/** Kiểm một mảng finding (kể cả file đã bị sửa tay) — trả về danh sách vi phạm luật oracle. */
function auditFindings(findings) {
  const bad = [];
  for (const f of findings || []) {
    if (!VERDICTS.includes(f.verdict)) { bad.push(`${f.axis || '?'} · verdict "${f.verdict}" không thuộc ${VERDICTS.join('/')}`); continue; }
    if ((f.verdict === 'PASS' || f.verdict === 'FAIL') && !ORACLE_RE.test(String(f.oracle_ref || ''))) {
      bad.push(`${f.axis} · ${f.base_tc || '(không rõ case)'}: verdict ${f.verdict} mà KHÔNG có oracle_ref hợp lệ — mở rộng không có neo thì chỉ được OBSERVATION`);
    }
    if (f.verdict === 'OBSERVATION' && !String(f.open_question || '').trim()) {
      bad.push(`${f.axis} · ${f.base_tc || '(không rõ case)'}: OBSERVATION mà thiếu open_question — quan sát không có câu hỏi thì sẽ tan theo lượt chạy`);
    }
  }
  return bad;
}

function summarize(findings) {
  const by = { EXPANSION_FINDING: 0, PASS: 0, FAIL: 0, OBSERVATION: 0 };
  for (const f of findings || []) if (by[f.verdict] !== undefined) by[f.verdict] += 1;
  return by;
}

/**
 * Ghi findings ra file để gate/triage đọc được. Có dòng máy `<!-- gate: … -->` như các báo cáo khác.
 * `proven` = số finding có neo (PASS/FAIL) + số EXPANSION_FINDING; `inconclusive` = số OBSERVATION.
 */
function writeFindings(taskDir, findings, opts = {}) {
  const dir = path.join(taskDir, 'test-results');
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'expansion_findings.json');
  let prev = [];
  if (opts.append && fs.existsSync(jsonPath)) {
    try { prev = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).findings || []; } catch (e) { prev = []; }
  }
  const all = [...prev, ...findings];
  const by = summarize(all);
  const violations = auditFindings(all);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ _schema: 'expansion_findings/1', summary: by, violations, findings: all }, null, 2)}\n`);

  const md = [
    `<!-- gate: proven=${by.EXPANSION_FINDING + by.PASS + by.FAIL} inconclusive=${by.OBSERVATION} broken=${violations.length} -->`,
    '# Finding từ mở rộng quanh case (5 trục)',
    '',
    '> **Nhất quán ≠ đúng.** Chỉ được `PASS`/`FAIL` khi có `oracle_ref` trỏ knowledge (`BR-`/`SM-`/`PM-`/`SS-`/',
    '> `DM-`/`UI-`). App tự mâu thuẫn ⇒ `EXPANSION_FINDING` (log bug được, KHÔNG phải verdict của case gốc).',
    '> Không có neo ⇒ `OBSERVATION` + câu hỏi mở, không tính vào pass-rate.',
    '',
    `- EXPANSION_FINDING **${by.EXPANSION_FINDING}** · PASS **${by.PASS}** · FAIL **${by.FAIL}** · OBSERVATION **${by.OBSERVATION}**`,
    '',
    '| Trục | Case gốc | Bề mặt | Cần | Thấy | Oracle | Verdict |',
    '|---|---|---|---|---|---|---|',
    ...all.map((f) => `| ${f.axis} | ${f.base_tc || '—'} | ${f.surface || '—'} | ${f.expected ?? '—'} | ${f.actual ?? '—'} | ${f.oracle_ref || '_(không có)_'} | ${f.verdict} |`),
  ];
  if (violations.length) md.push('', '## Vi phạm luật oracle (phải sửa)', '', ...violations.map((v) => `- ${v}`));
  const mdPath = path.join(taskDir, 'reports', 'expansion-findings.md');
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, `${md.join('\n')}\n`);
  return { jsonPath, mdPath, summary: by, violations };
}

module.exports = { AXES, ORACLE_RE, VERDICTS, decide, makeFinding, auditFindings, summarize, writeFindings };
