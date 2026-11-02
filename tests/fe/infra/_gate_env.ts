/*
 * _gate_env — env SẠCH cho các test spawn gate bằng fixture.
 *
 * VÌ SAO CÓ FILE NÀY (đo 04/09/2026). Cả 9 spec hạ tầng spawn gate bằng `env: { ...process.env, ...env }`,
 * nên **biến môi trường của shell lọt vào tiến trình con**. Hệ quả: test dựng fixture ghi
 * `test-results/testcase-status.json`, nhưng nếu shell có `RUN_ID` thì gate lại đi tìm
 * `test-results/runs/<RUN_ID>/testcase-status.json` ⇒ **xanh ở máy dev, ĐỎ ở CI** (CI đặt
 * `RUN_ID=ci-<pipeline>-<shard>`). `ci-regression` đã đỏ 5 lượt liên tiếp vì đúng chuyện này, trong khi
 * `npx playwright test tests/fe/infra` ở máy vẫn 481/481.
 *
 * Đây là loại lỗi tệ nhất của một bộ kiểm: **kết quả phụ thuộc môi trường chạy**, nên "xanh" không còn nghĩa.
 *
 * Cách chữa: tiến trình con **không** được thấy các biến TASK-SCOPED của môi trường. Test muốn giá trị nào thì
 * khai tường minh — khai xong vẫn thắng vì nó ghi sau.
 *
 * LẦN THỨ HAI, cùng họ (đo 02/11/2026). Danh sách dưới đây gỡ biến task-scoped nhưng KHÔNG gỡ nhóm **danh
 * tính CI**, nên 7 phép kiểm mới của v2.9.7 xanh ở Windows và ĐỎ trên runner. Lượt `release` trên tag
 * `v2.9.7` đỏ vì đúng chuyện này và không ai nhìn nó:
 *
 *   - `playwright.config.js:101` đọc `CI` ⇒ `workers: CI ? 2 : <trần cục bộ>`. Runner có `CI=true`, nên
 *     4 đối chứng giả lập 32/64/4/12/1 lõi đều nhận về `2` — chúng đo biến môi trường, không đo trần.
 *   - `version_check.js:120` đọc `GITHUB_REF_TYPE`/`GITHUB_REF_NAME` ⇒ khi lượt CI chạy TỪ TAG, gate bắt
 *     `package.json` phải khớp tên tag. 3 đối chứng dựng cây giả có version 2.9.6/2.9.9 nên bị CHẶN bởi
 *     một phép kiểm chẳng liên quan gì tới thứ chúng đang đo.
 *
 * Tái hiện được ở máy trong 15 giây: `CI=true GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v2.9.7 npx playwright
 * test tests/fe/infra/playwright-conventions.spec.ts tests/fe/infra/version-changelog.spec.ts` ⇒ đúng 7 ca
 * đỏ ấy. Dùng lệnh này trước khi tin một phép kiểm spawn gate là xanh.
 */

/**
 * Biến TASK-SCOPED phải bị GỠ khỏi env con.
 *
 * Đều là biến quyết định gate đọc/ghi ở ĐÂU hoặc phán thế nào — để lọt là test đo môi trường thay vì đo gate.
 * Không gỡ `PATH`/`HOME`/`APPDATA`… vì `node` con vẫn cần chạy được.
 */
export const TASK_SCOPED_ENV = [
  'RUN_ID',              // quyết định test-results/ hay test-results/runs/<RUN_ID>/
  'TASK_KEY',
  'PROJECT_OUTPUT_DIR',
  'TASK_ENV',
  'ALLOW_EMPTY',
  'QA_APPROVED',
  'TESTCASE_SOURCE',
] as const;

/**
 * Biến DANH TÍNH CI phải bị GỠ khỏi env con.
 *
 * Cùng lý do, khác nguồn: chúng do runner đặt chứ không do người gọi, nên ở máy dev chúng VẮNG MẶT và ở CI
 * chúng CÓ. Một phép kiểm thừa kế chúng sẽ cho hai kết quả khác nhau trên hai máy mà không ai khai ra điều đó.
 * Test nào muốn đo NHÁNH CI thì khai `gateEnv({ CI: 'true' })` — tường minh, và đọc được ở ngay dòng gọi.
 */
export const CI_IDENTITY_ENV = [
  'CI',                  // playwright.config.js: workers 2 (CI) vs trần cục bộ
  'GITHUB_ACTIONS',
  'GITHUB_REF_TYPE',     // version_check.js: có coi lượt này là "chạy từ tag" không
  'GITHUB_REF_NAME',     // …và tag đó tên gì, để đối chiếu package.json
  'GITHUB_REF',
  'GITHUB_EVENT_NAME',
] as const;

/** Env cho tiến trình con: kế thừa env hệ thống NHƯNG gỡ hết biến task-scoped + danh tính CI, rồi phủ `extra` lên. */
export function gateEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env };
  for (const k of TASK_SCOPED_ENV) delete base[k];
  for (const k of CI_IDENTITY_ENV) delete base[k];
  return { ...base, ...extra };
}
