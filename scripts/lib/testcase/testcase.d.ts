// Canonical TestCase model — types cho consumer TS (tests/). Impl là JS CommonJS (scripts/lib/testcase).
// Full JS→TS để #7; file .d.ts này cho type-safety phía tests/ mà không cần build-step.

export interface NumberedLine { n: number | null; text: string; }

export interface SetupContract {
  preId: string; desc: string; type: string; method: string; source: string;
  verification: string; cleanup: string; readiness: string; linked: string;
}

export interface TestCase {
  tcId: string;
  module: string;
  title: string;
  precondition: string;
  data: string;
  steps: NumberedLine[];
  stepsRaw: string;
  expected: NumberedLine[];
  expectedRaw: string;
  priority: string;
  risk: string;
  dimensions: string[];
  /*
   * BỐN TRƯỜNG DƯỚI ĐÂY BỊ KHAI THIẾU cho tới 12/10/2026, và chúng không phải trường phụ.
   *
   * `parseMarkdown` đã trả về chúng từ lâu, nhưng file hợp đồng này không khai, nên mọi consumer TS đọc
   * `t.techniques` hay `t.oracleRefs` đều phải lách kiểu — và `validate.js` (chính file thi hành luật
   * technique và luật neo oracle) dùng cả bốn. Chúng chỉ lộ ra khi `checkJs` được bật lần đầu cho
   * `scripts/**.js`: 11 lỗi, 10 trong đó là bốn tên trường này.
   *
   * Bài học cho chính §A10.2: một hợp đồng dữ liệu KHÔNG ĐƯỢC KIỂM thì nó không phải hợp đồng, nó là
   * một ghi chú. File `.d.ts` này tồn tại từ trước và vẫn trôi khỏi model, vì không gì so hai bên.
   */
  /** Mã neo oracle (`BR-`/`SM-`/`UI-`…) trích từ tag và tiêu đề. Rỗng = kết luận không có neo. */
  oracleRefs: string[];
  /*
   * `tags` là CHUỖI THÔ, không phải mảng — và tôi đã khai sai thành `string[]` ở lượt đầu đúng vì cái tên.
   * Chính `checkJs` bắt được: `validate.js:262` gọi `(t.tags || '').toLowerCase()`, và với khai báo mảng
   * thì dòng đó đỏ. Suýt báo đó là bug sản phẩm trong khi bug ở khai báo của tôi.
   *
   * Giữ nguyên dạng chuỗi chứ không "sửa cho đẹp": đổi nó thành mảng là đổi hợp đồng dữ liệu mà 30 file
   * đang dùng, và `oracleRefs`/`techniques` vốn đã là bản ĐÃ TÁCH của cùng chuỗi này.
   */
  /** Nguyên văn cột `Tag` nối với tag trong tiêu đề: `"[Positive][BR-X-001][EP]"`. */
  tags: string;
  /** Kỹ thuật thiết kế suy ra từ tag, đối chiếu `.agent/config/design_techniques.json`. */
  techniques: string[];
  /** Giá trị cột `Loại case`, đối chiếu `.agent/config/case_types.json`. */
  caseType: string;
  group: string;
  traceability: { reqId: string; story: string };
  /** original-header → cleaned cell (fidelity / migration bridge) */
  _cells: Record<string, string>;
}

export interface TestCaseDoc {
  source: 'md' | 'xlsx';
  tests: TestCase[];
  setup: SetupContract[];
  headers: string[];
  groups: string[];
  warnings: string[];
  /** Chỉ có khi `source === 'xlsx'`: tên sheet đã gộp. `parseMarkdown` không đặt trường này. */
  sheetName?: string;
  /** Mọi sheet đã gộp, theo thứ tự đọc. `sheetName` là phần tử đầu. */
  sheetNames?: string[];
}

export interface ValidateResult { problems: string[]; warnings: string[]; }

export function parseMarkdown(mdOrPath: string, opts?: { story?: string }): TestCaseDoc;
export function parseXlsx(filePath: string, opts?: { story?: string }): Promise<TestCaseDoc>;
export function validate(doc: TestCaseDoc): ValidateResult;
export function cleanCell(text: string): string;
export function normalizeHeader(text: string): string;
export function splitNumbered(cell: string): NumberedLine[];
export function dimensionsOf(title: string): string[];
