# Danh mục GATE của kit

> **SINH TỰ ĐỘNG** bởi `node scripts/qa/gate_index.js --write`. Đừng sửa tay — `--check` sẽ chặn khi
> bảng lệch source. Cột **Mức** suy từ code: `exit 1` = CHẶN · ghi artifact = SINH · chỉ in = BÁO CÁO.
>
> Cột **Tầng** (v2.7.0) nói máy đó chặn Ở ĐÂU: **T0** chặn ở mọi ngữ cảnh và không có cờ override ·
> **T1** chỉ chặn ở cửa ra, lúc đang làm thì cảnh báo và ghi `reports/gate-debt.json` · **T2** không
> bao giờ chặn. T0 khai tay trong `.agent/config/gate_tiers.json`; không khai thì mặc định T1.

Tổng **146** máy — **104 CHẶN** · 23 SINH (ghi artifact) · 19 BÁO CÁO (chỉ in).

SINH/BÁO CÁO **không phải gate bị nới** — chúng không kiểm vi phạm. Ví dụ `bugs:checklist` in brief bug
lịch sử, còn việc CHẶN nằm ở `dim:coverage` (chiều `bug_history` §20).

| Tầng | Mức | npm script | Chặn/kiểm cái gì | File | Gọi từ |
|---|---|---|---|---|---|
| T1 | CHẶN | `library:build` | ghép src/ thành docs/library/index.html (một file duy nhất, self-contained). | `docs/library/build.js` | docs/kit-map.md |
| T1 | CHẶN | `merge:execution-status` | ghi kết quả execute (testcase-status.json) NGƯỢC vào cột `Result` của file | `scripts/convert_excel/merge_execution_status.js` | RULE_GLOBAL.md · .agent/skills · tests/fe/infra |
| T1 | CHẶN | `backlog:bug-report`, `backlog:bug-report:dry-run` | Create Backlog Sub-bug issues for failed Playwright test cases. | `scripts/integrations/backlog/bug_reporter.js` | docs/kit-map.md · .github/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN | `integration:check`, `integration:check:live` | const axios = require('axios'); | `scripts/integrations/backlog/check_connection.js` | .gitlab-ci.yml · USER_GUIDE.md · QUICKSTART.md · docs/kit-map.md · .github/workflows · .agent/skills · tests/fe/infra |
| T1 | CHẶN | `gdoc:read` | Đọc nội dung từ Google Docs | `scripts/integrations/google_doc/doc_reader.js` | prompt_templates |
| T1 | CHẶN | `audit:ci` | npm audit cho CI, phân biệt rõ 2 tình huống: | `scripts/qa/audit_ci.js` | .gitlab-ci.yml · docs/kit-map.md · .github/workflows |
| T0 | CHẶN | `bug:claim`, `bug:claim:new`, `bug:claim:report`, `bug:claim:chot` | một phát hiện bug phải QUA MÁY trước khi được nói thành lời. | `scripts/qa/bug_claim.js` | RULE_GLOBAL.md · .agent/workflows · prompt_templates · manual-run · tests/fe/infra |
| T1 | CHẶN | `case:paths` | ĐƯỜNG IMPORT TƯƠNG ĐỐI PHẢI KHỚP TÊN FILE THẬT, ĐÚNG HOA-THƯỜNG. | `scripts/qa/case_paths.js` | .github/workflows · tests/fe/infra |
| T1 | CHẶN | `check` | MỘT LỆNH KIỂM (v2.7.0 §A3). | `scripts/qa/check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · manual-run · .claude/commands · tests/fe/infra |
| T0 | CHẶN | `ci:scope` | MÁY ĐỨNG SAU LUẬT "CI generic KHÔNG tự chạm UAT". | `scripts/qa/ci_scope_check.js` | .gitlab-ci.yml · QUICKSTART.md · docs/kit-map.md · .github/workflows · .agent/rules · .agent/skills · tests/fe/infra |
| T1 | CHẶN | `course:maturity`, `course:maturity:check` | sinh khối "Bộ kit của bạn đang ở đâu" cho từng bài giảng. | `scripts/qa/course_maturity.js` | .gitlab-ci.yml · .github/workflows |
| T1 | CHẶN | `course:numbers` | CHẶN "ví dụ trong bài giảng không khớp sản phẩm thực hành". | `scripts/qa/course_numbers.js` | .gitlab-ci.yml · .github/workflows |
| T0 | CHẶN | `db:paths:check` | QUÉT ĐƯỜNG VÒNG TỚI DB TRONG CODE (v2.8.0 §0b.5). | `scripts/qa/db_paths_check.js` | tests/fe/infra |
| T1 | CHẶN | `db:query` | LỆNH TRA CỨU DB DUY NHẤT cho người và cho AI (v2.8.0 §0b.4). | `scripts/qa/db_query.js` | tests/fe/infra |
| T1 | CHẶN | `deps:check` | MỖI DEPENDENCY PHẢI CÓ NƠI DÙNG, HOẶC CÓ MỘT DÒNG GIẢI THÍCH. | `scripts/qa/deps_check.js` | .github/workflows · tests/fe/infra |
| T1 | CHẶN | `design:gate` | round-3) — Gate CHẤT LƯỢNG THIẾT KẾ testcase (Phase 1), THỰC THI. | `scripts/qa/design_gate.js` | RULE_GLOBAL.md · scripts/qa/README.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · partial-rerun · .claude/commands · tests/fe/infra |
| T0 | CHẶN | `discover` | KHÁM PHÁ HỆ THỐNG (v2.6.0 §A1). Một lệnh, ba chế độ. | `scripts/qa/discover.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN | `exit:gate` | BA CỬA RA (v2.7.0 §A2). | `scripts/qa/exit_gate.js` | .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN | `expansion:audit` | ĐO ĐỘ PHỦ 5 TRỤC trên MỌI task đã execute, để quyết định siết gate bằng SỐ. | `scripts/qa/expansion_audit.js` | RULE_GLOBAL.md · .claude/commands · tests/fe/infra |
| T0 | CHẶN | `expected:check`, `expected:snapshot` | CHẶN "đổi expected để case xanh" (non-negotiable §6, tầng T0). | `scripts/qa/expected_ledger.js` | RULE_GLOBAL.md · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN | `full:suite`, `full:suite:check` | SỔ GHI LƯỢT CHẠY CẢ BỘ, và cửa chặn đóng gói khi sổ đã cũ. | `scripts/qa/full_suite_ledger.js` | docs/kit-map.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `golden:check`, `golden:snapshot` | BỘ DỮ LIỆU VÀNG cho parser canonical, và HAI PHÉP ĐẾM ĐỘC LẬP (v2.7.0 §A10.4 + §A10.5). | `scripts/qa/golden_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `json:check` | kiểm MỌI file .json ĐANG ĐƯỢC TRACK có parse được không. | `scripts/qa/json_check.js` | .gitlab-ci.yml · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `judge` | CHẤM PHẦN MÁY KHÔNG ĐO ĐƯỢC, có lấy mẫu và có hiệu chuẩn (v2.7.0 §A11). | `scripts/qa/judge.js` | RULE_GLOBAL.md · prompt_templates · tests/fe/infra |
| T1 | CHẶN | `lane` | CHỌN LÀN theo risk, và CHẶN việc hạ làn ở chỗ rủi ro cao (v2.7.0 §A6). | `scripts/qa/lane.js` | .gitlab-ci.yml · RULE_GLOBAL.md · docs/kit-map.md · .github/workflows · .agent/rules · prompt_templates · exploratory · tests/fe/infra |
| T1 | CHẶN | `leak:report` | đo "kit đang rò bao nhiêu và rò kiểu gì" (baseline cho mọi cải tiến sau). | `scripts/qa/leak_report.js` | RULE_GLOBAL.md · docs/kit-map.md · .agent/workflows · prompt_templates · tests/fe/infra |
| T1 | CHẶN | `learn:bugs`, `learn:bugs:apply` | nối mắt xích còn ĐỨT: bug đã log Backlog → knowledge/bugs/ (+ root_causes ref, index). | `scripts/qa/learn_bugs.js` | QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates |
| T1 | CHẶN | `library:drift` | CHẶN "thư viện thuật ngữ đã trôi khỏi repo". | `scripts/qa/library_drift.js` | .gitlab-ci.yml · docs/kit-map.md · .github/workflows |
| T0 | CHẶN | `gate:output`, `gate:output:fix`, `gate:gen-testcase` | Gate chất lượng output THỰC THI, tự chạy trước khi push Backlog/Sheet. | `scripts/qa/output_gate.js` | RULE_GLOBAL.md · scripts/qa/README.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T0 | CHẶN | `package:kit` | đóng gói bản phát hành SẠCH của kit vào `dist/`. | `scripts/qa/package_kit.js` | README.md · docs/kit-map.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `gate:policy` | giữ 1 NGUỒN policy duy nhất: RULE_GLOBAL.md là canonical. | `scripts/qa/policy_source_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · USER_GUIDE.md · docs/kit-map.md · .github/workflows · .agent/rules · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN | `predeploy` | CHỐT TIỀN-ĐẨY: không bao giờ phát hành khi bảng gate đang lệch nguồn. | `scripts/qa/predeploy_gate.js` | .github/workflows · tests/fe/infra |
| T0 | CHẶN | `preflight`, `preflight:lanes` | round-3) — CHẶN "miss đọc file / input hỏng" TRƯỚC khi workflow chạy. | `scripts/qa/preflight_gate.js` | .gitlab-ci.yml · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN | `probe:page` | biến artifact KHÁM PHÁ thành bản đồ field DÙNG ĐƯỢC cho spec. | `scripts/qa/probe_to_page.js` | **KHÔNG BỀ MẶT NÀO** |
| T1 | CHẶN | `recon:check` | `ui_catalog.md` là ORACLE, nên nó không được chứa quan sát chưa kiểm chứng. | `scripts/qa/recon_check.js` | prompt_templates · tests/fe/infra |
| T1 | CHẶN | `compile:check` | CANH LUẬT "CASE CHƯA ĐỦ KHÔNG ĐƯỢC PASS" (v2.8.0 §D). | `scripts/qa/reuse/compile_check.js` | tests/fe/infra |
| T1 | CHẶN | `compile:spec` | BIÊN DỊCH TESTCASE THÀNH SPEC (v2.8.0 §D). KHÔNG GỌI MODEL, 0 token AI. | `scripts/qa/reuse/compile_spec.js` | .agent/skills · tests/fe/infra |
| T1 | CHẶN | `smoke:gen` | SINH SMOKE HỆ THỐNG TỪ MÔ HÌNH MÀN (v2.8.0 §L). 0 token AI. | `scripts/qa/reuse/smoke_gen.js` | tests/fe/infra |
| T1 | CHẶN | `steps:catalog` | GÁC DANH MỤC BƯỚC (v2.8.0 §C1 + §C3). | `scripts/qa/reuse/steps_catalog_check.js` | **KHÔNG BỀ MẶT NÀO** |
| T1 | CHẶN | `steps:impact` | AI PHỤ THUỘC BƯỚC NÀO, VÀ CỬA CHẶN ĐỔI HỢP ĐỒNG (v2.8.0 §E). | `scripts/qa/reuse/steps_impact.js` | **KHÔNG BỀ MẶT NÀO** |
| T1 | CHẶN | `steps:lint` | CANH LUẬT VÀNG CỦA THƯ VIỆN BƯỚC (v2.8.0 §A, luật L2–L4). | `scripts/qa/reuse/steps_lint.js` | .agent/skills · tests/fe/infra |
| T1 | CHẶN | `steps:promote` | THĂNG BƯỚC `draft` → `active` (v2.8.0 §E). | `scripts/qa/reuse/steps_promote.js` | tests/fe/infra |
| T1 | CHẶN | `steps:stats` | ĐO THỐNG KÊ CỦA TỪNG BƯỚC TỪ LƯỢT CHẠY THẬT (v2.8.0 §E). | `scripts/qa/reuse/steps_stats.js` | tests/fe/infra |
| T1 | CHẶN | `stt:map` | SUY BẢN ĐỒ `Stt đặc tả → nhãn của từng cấp`, và TỪ CHỐI GHI KHI CÒN NHẬP NHẰNG (v2.8.0 §A0). | `scripts/qa/reuse/stt_map.js` | **KHÔNG BỀ MẶT NÀO** |
| T1 | CHẶN | `router:check` | BẢNG ĐỊNH TUYẾN phải phủ MỌI điểm vào, và mỗi dòng phải nói RANH GIỚI. | `scripts/qa/router_check.js` | .github/workflows · .agent/skills · tests/fe/infra |
| T1 | CHẶN | `rule:consistency` | luật đổi ở MỘT chỗ, nhưng được nhắc lại ở hàng chục chỗ. | `scripts/qa/rule_consistency.js` | .github/workflows · tests/fe/infra |
| T1 | CHẶN | `rule:coverage`, `rule:coverage:check` | BẢN ĐỒ LUẬT → GATE → SPEC (v2.7.0 §A10.7). | `scripts/qa/rule_coverage.js` | .gitlab-ci.yml · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `rule`, `rule:toc` | tra RULE_GLOBAL.md THEO MỤC, thay vì đọc cả file. | `scripts/qa/rule_lookup.js` | .gitlab-ci.yml · RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · manual-run · .claude/commands · tests/fe/infra |
| T0 | CHẶN | `secret:scan` | quet secret bi commit nham tren cac file DA TRACK trong git. | `scripts/qa/secret_scan.js` | .gitlab-ci.yml · RULE_GLOBAL.md · docs/kit-map.md · .github/workflows · .agent/rules · .agent/skills · tests/fe/infra |
| T1 | CHẶN | `seed:knowledge`, `seed:knowledge:apply` | Seed Knowledge từ lịch sử Backlog (Suggest-only, DRY-RUN mặc định). | `scripts/qa/seed_knowledge_from_backlog.js` | scripts/qa/README.md · docs/kit-map.md |
| T1 | CHẶN | `skills:index`, `skills:index:check` | sinh bảng tra skill từ frontmatter của `.agent/skills/**\/SKILL.md`. | `scripts/qa/skills_index.js` | .gitlab-ci.yml · docs/kit-map.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `skills:refcheck` | mọi LINK THẬT trong skill phải trỏ tới file có thật. | `scripts/qa/skills_refcheck.js` | docs/kit-map.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `skills:route:check` | hai skill mô tả giống nhau thì agent KHÔNG có căn cứ để chọn. | `scripts/qa/skills_route.js` | .github/workflows · tests/fe/infra |
| T1 | CHẶN | `lint:tcid` | MỘT case chỉ được ĐĂNG KÝ VỚI RECORDER ở MỘT file spec. | `scripts/qa/tcid_duplicate_check.js` | **KHÔNG BỀ MẶT NÀO** |
| T1 | CHẶN | `sync:canonical` | MỘT BỘ GHI, TOẢ BA NƠI (v2.8.0 §0c). | `scripts/qa/testcases/sync_canonical.js` | RULE_GLOBAL.md · .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN | `trace:matrix` | sinh ma trận REQ → TC → AUTO → EXEC → BUG dạng artifact. | `scripts/qa/traceability_matrix.js` | docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates |
| T1 | CHẶN | `ui:conformance` | "visual oracle" tự động. | `scripts/qa/ui_conformance_check.js` | prompt_templates |
| T1 | CHẶN | `release:verify` | CHỨNG MINH bản phát hành chạy được từ con số 0. Đây là thước đo chính của cả luồng CD, | `scripts/qa/verify_release.js` | README.md · docs/kit-map.md · .github/workflows · .agent/skills · tests/fe/infra |
| T1 | CHẶN | `version:check` | CHẶN phát hành thiếu sót. | `scripts/qa/version_check.js` | README.md · docs/kit-map.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN | `writing:lint`, `writing:lint:docs` | output phải đọc như QA viết, không như máy viết. | `scripts/qa/writing_lint.js` | RULE_GLOBAL.md · prompt_templates · tests/fe/infra |
| T1 | CHẶN | `profile:create` | Tạo profile task từ template: profiles/task.env.example -> profiles/<TASK_KEY>/task.env | `scripts/utils/create_profile.js` | RULE_GLOBAL.md · USER_GUIDE.md · docs/kit-map.md · .claude/commands · tests/fe/infra |
| T1 | CHẶN | `user-guide:images` | User Guide board renderer (HTML/CSS + Playwright) | `scripts/utils/generate_user_guide_images.mjs` | docs/kit-map.md · tests/fe/infra |
| T1 | CHẶN | `test:task`, `test:task:fe`, `test:task:api` | const { spawn } = require('child_process'); | `scripts/utils/run_playwright_task.js` | USER_GUIDE.md · docs/kit-map.md · prompt_templates |
| T1 | CHẶN | `sync:gitlab` | đẩy `main` sang nhánh GitLab, TRỪ những đường dẫn khai trong | `scripts/utils/sync_gitlab.js` | tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `docs:index`, `docs:cite` | mỗi neo yêu cầu trong tài liệu phải TRA NGƯỢC ĐƯỢC về file và số dòng. | `scripts/phase1/docs_index.js` | USER_GUIDE.md · docs/kit-map.md · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `authz:expand` | TRỤC ⑥: liệt kê biến thể PHÂN QUYỀN quanh mỗi case. | `scripts/qa/authz_expand.js` | RULE_GLOBAL.md · .agent/skills |
| T0 | CHẶN (có cờ --enforce) | `auto:review`, `auto:review:enforce` | GATE chất lượng code automation, phần `lint:locator` KHÔNG gác. | `scripts/qa/automation_review.js` | RULE_GLOBAL.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · tests/fe/infra |
| T0 | CHẶN (có cờ --enforce) | `canonical:check` | GÁC MÔ HÌNH "MD CANONICAL, EXCEL/SHEET PHÁI SINH" (v2.8.0 §0c.4). | `scripts/qa/canonical_check.js` | prompt_templates · tests/fe/infra |
| T0 | CHẶN (có cờ --enforce) | `canonical:drift`, `canonical:drift:enforce` | ĐO ĐỘ TRÔI giữa Markdown canonical và bản xuất `.xlsx`. | `scripts/qa/canonical_drift.js` | RULE_GLOBAL.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `concurrency:check` | HARNESS ĐỒNG THỜI/TRANH CHẤP (v2.8.4 mục A). | `scripts/qa/concurrency_check.js` | docs/kit-map.md · .agent/skills |
| T1 | CHẶN (có cờ --enforce) | `xsurf:diff` | TRỤC 2: **cùng một giá trị, khác nơi hiển thị**. | `scripts/qa/cross_surface_diff.js` | RULE_GLOBAL.md · docs/kit-map.md · prompt_templates |
| T1 | CHẶN (có cờ --enforce) | `decisions:check`, `decisions:index` | quản lý `knowledge/decisions/`: LÝ DO của những quyết định QA đã chốt. | `scripts/qa/decisions.js` | docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `dim:coverage` | đếm case theo 15 CHIỀU coverage của `prompt_templates/phase1/02_gen_testcases.md` | `scripts/qa/dimension_coverage.js` | RULE_GLOBAL.md · USER_GUIDE.md · docs/kit-map.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · partial-rerun · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `domain:check`, `domain:index`, `domain:trace-back` | quản lý `knowledge/domain/` (business rule đã XÁC NHẬN = nền của oracle). | `scripts/qa/domain_rules.js` | RULE_GLOBAL.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · partial-rerun · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `expansion:plan` | QUYẾT TRƯỚC KHI CHẠY: case nào mở rộng trục nào, và tốn bao nhiêu. | `scripts/qa/expansion_plan.js` | RULE_GLOBAL.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · manual-run · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `explore:check`, `explore:check:enforce`, `explore:close` | MÁY cho nhánh exploratory: kiểm phiên + đóng vòng học. | `scripts/qa/explore_session.js` | exploratory · .claude/commands |
| T1 | CHẶN (có cờ --enforce) | `fixture:matrix` | TRỤC 4 + 5: **nhánh/biến thể** × **trạng thái kế cận** (42/69 bug của CSDL-24395). | `scripts/qa/fixture_matrix.js` | RULE_GLOBAL.md · docs/kit-map.md · prompt_templates |
| T1 | CHẶN (có cờ --enforce) | `gates:index`, `gates:index:check` | sinh DANH MỤC GATE của kit từ chính source, không viết tay. | `scripts/qa/gate_index.js` | .gitlab-ci.yml · docs/kit-map.md · .github/workflows · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `howto:check`, `howto:index`, `howto:find` | quản lý 2 store trả lời câu hỏi "LÀM SAO tới được đó": | `scripts/qa/howto_store.js` | docs/kit-map.md · prompt_templates |
| T1 | CHẶN (có cờ --enforce) | `lighthouse` | điểm Performance / Accessibility / SEO / Best-practices thật, chạy qua CDP. | `scripts/qa/lighthouse_check.js` | USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `load` | wrapper MỎNG cho k6 (Loại B: load/stress/soak nhiều VU). Loại A (single-user) dùng perf_check.js. | `scripts/qa/load_check.js` | RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · manual-run · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `lint:locator`, `lint:locator:enforce` | GATE chống "bắt sai element → log sai bug". | `scripts/qa/locator_lint.js` | docs/kit-map.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `manual:check`, `manual:check:enforce` | MÁY cho nhánh `manual-run/`: lượt CHẠY TAY của case `Manual-only`. | `scripts/qa/manual_run_check.js` | docs/kit-map.md · manual-run · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `matrix:coverage`, `matrix:coverage:enforce` | PAIRWISE PHỦ CẶP GIÁ TRỊ, KHÔNG PHỦ KẾT QUẢ. | `scripts/qa/matrix_coverage.js` | .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `mutation:check`, `proof:nightly` | NEGATIVE CONTROL: cố ý tiêm lỗi rồi xem máy kiểm có ĐỎ không. | `scripts/qa/mutation_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `oracle:calc` | TRỤC ⑦: canh bộ oracle giá trị tính toán. | `scripts/qa/oracle_calc_check.js` | RULE_GLOBAL.md · .agent/skills |
| T1 | CHẶN (có cờ --enforce) | `probe:persist` | TRỤC 3: chuỗi lưu trữ `form → payload → đọc lại (API) → UI`. | `scripts/qa/persistence_probe.js` | RULE_GLOBAL.md · docs/kit-map.md · prompt_templates |
| T1 | CHẶN (có cờ --enforce) | `phase1:check`, `phase2:check` | BÓ các gate của một phase vào MỘT lượt gọi. | `scripts/qa/phase_check.js` | .agent/workflows · prompt_templates |
| T1 | CHẶN (có cờ --enforce) | `phase1:tables`, `phase1:tables:check` | ba bảng đối soát cuối bộ, MÁY SINH chứ không để agent tự kẻ. | `scripts/qa/phase1_tables.js` | .agent/workflows · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `prompt:budget` | ĐO TĨNH: mỗi điểm vào bảo AI đọc bao nhiêu token hướng dẫn. | `scripts/qa/prompt_budget.js` | .gitlab-ci.yml · RULE_GLOBAL.md · docs/kit-map.md · .github/workflows · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `release:summary`, `release:summary:enforce`, `release:summary:init` | KHUYẾN NGHỊ go/no-go, có căn cứ, và KHÔNG tự quyết. | `scripts/qa/release_summary.js` | .agent/rules · .agent/skills · .claude/commands · tests/fe/infra |
| T0 | CHẶN (có cờ --enforce) | `ledger:check`, `ledger:check:enforce`, `ledger:snapshot` | Chống MẤT KẾT QUẢ ÂM THẦM ở cột `Result` của bản xuất Excel. | `scripts/qa/result_ledger.js` | RULE_GLOBAL.md · .agent/workflows · prompt_templates |
| T1 | CHẶN (có cờ --enforce) | `replay:check`, `replay:check:enforce` | ĐO SỐ LẦN PHẢI GỌI AI ĐỂ CHẠY LẠI MỘT TASK KHÔNG ĐỔI (v2.8.0 §F). | `scripts/qa/reuse/replay_check.js` | tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `risk:gate`, `risk:gate:enforce` | ép Risk-Based Testing: đối chiếu testcase với depthPolicy theo band trong risk-register. | `scripts/qa/risk_gate.js` | docs/kit-map.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `rule:parity`, `rule:parity:enforce` | RÚT GỌN `core_rules.md` MÀ KHÔNG MẤT LUẬT NÀO. | `scripts/qa/rule_parity.js` | .github/workflows · tests/fe/infra |
| T0 | CHẶN (có cờ --enforce) | `run:analysis`, `run:analysis:enforce` | LƯỢT CHẠY NÀY CÓ ĐƯỢC DÙNG ĐỂ KẾT LUẬN CHẤT LƯỢNG KHÔNG? | `scripts/qa/run_analysis.js` | .agent/workflows · .agent/rules · .agent/skills · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `scope:anchor`, `scope:anchor:enforce`, `scope:anchor:init` | NEO MẪU SỐ của Phase 1. | `scripts/qa/scope_anchor.js` | .agent/workflows · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `self-review`, `self-review:enforce` | Lượt 2: đối chiếu CHECKLIST trước finalize (ADVISORY). | `scripts/qa/self_review.js` | RULE_GLOBAL.md · USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · manual-run · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `skills:lint`, `skills:lint:enforce` | MÔ TẢ SKILL CÓ ĐỦ THÔNG TIN ĐỂ CHỌN HAY CHƯA? | `scripts/qa/skills_lint.js` | .github/workflows · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `spec:gap` | CHIỀU NGƯỢC: build CÓ mà tài liệu KHÔNG NHẮC (B3 của chương trình chống lọt bug). | `scripts/qa/spec_gap_report.js` | RULE_GLOBAL.md · CLAUDE.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `system:check`, `system:index` | quản lý `knowledge/system/`: bản đồ HỆ THỐNG đã được xác nhận. | `scripts/qa/system_map.js` | docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · partial-rerun · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `tc:review`, `tc:review:enforce` | CHẤM CHẤT LƯỢNG bộ testcase theo rubric 8 tiêu chí, 0–2 điểm mỗi tiêu chí. | `scripts/qa/tc_review.js` | .agent/workflows · .agent/skills · prompt_templates · partial-rerun · .claude/commands · tests/fe/infra |
| T1 | CHẶN (có cờ --enforce) | `typecheck:task`, `typecheck:task:enforce` | chạy `tsc --noEmit` trên automation CỦA MỘT TASK. | `scripts/qa/typecheck_task.js` | prompt_templates |
| T0 | CHẶN (có cờ --enforce) | `unit:stamp`, `unit:stamp:enforce` | mọi verdict ĐÃ CHẠY phải khai ĐƠN VỊ đã đo. | `scripts/qa/unit_stamp_check.js` | .agent/workflows · prompt_templates · .claude/commands |
| T2 | SINH | `accessibility` | tái dùng hạ tầng của ui_conformance_check.js (login/pre-steps/catalog schema | `scripts/qa/accessibility_check.js` | README.md · USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .agent/rules · .agent/skills · prompt_templates · tests/fe/infra |
| T2 | SINH | `dashboard` | đọc dữ liệu ĐÃ CÓ (knowledge/ + flaky-triage.md), KHÔNG thu thập lại, | `scripts/qa/dashboard_generate.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T2 | SINH | `dep:graph` | GỘP traceability + impact-map thành 1 graph query-được. | `scripts/qa/dependency_graph.js` | scripts/qa/README.md · docs/kit-map.md |
| T2 | SINH | `explore:charter` | CHỌN VÙNG DÒ BẰNG DỮ LIỆU, không bằng cảm tính. | `scripts/qa/explore_charter.js` | exploratory · .claude/commands |
| T2 | SINH | `ui:contract` | biến DESIGN thành ORACLE MÁY ĐỌC ĐƯỢC (`knowledge/system/UI-*.json`). | `scripts/qa/figma_to_ui_contract.js` | RULE_GLOBAL.md · docs/kit-map.md · .agent/rules |
| T2 | SINH | `gate:audit` | KIỂM KÊ GATE để phân tầng (v2.7.0 bước 1a). | `scripts/qa/gate_audit.js` | tests/fe/infra |
| T2 | SINH | `gate:friction` | SỔ MA SÁT của gate, và quy tắc dọn (v2.7.0 §A9). | `scripts/qa/gate_friction.js` | RULE_GLOBAL.md · tests/fe/infra |
| T2 | SINH | `gate:selfmutate` | ĐỘT BIẾN CHÍNH CODE CỦA GATE, rồi đòi spec của nó phải ĐỎ (v2.7.0 §A10.6). | `scripts/qa/gate_selfmutate.js` | tests/fe/infra |
| T2 | SINH | `knowledge:backup` | sao lưu / khôi phục các store knowledge KHÔNG NẠP LẠI ĐƯỢC. | `scripts/qa/knowledge_backup.js` | .gitlab-ci.yml · QUICKSTART.md · docs/kit-map.md · .github/workflows · .agent/workflows · prompt_templates · tests/fe/infra |
| T2 | SINH | `knowledge:bootstrap` | DỰNG KHUNG `domain/` ở trạng thái `draft`, để kho không ở lại rỗng. | `scripts/qa/knowledge_bootstrap.js` | tests/fe/infra |
| T2 | SINH | `learn:report` | trả lời câu "chạy task này thì đã HỌC được gì?". | `scripts/qa/learn_report.js` | docs/kit-map.md · .agent/skills · prompt_templates |
| T2 | SINH | `learn`, `learn:backfill` | MẮT XÍCH HỌC còn thiếu: biến kết quả execute của 1 task thành learning data. | `scripts/qa/learn_task.js` | RULE_GLOBAL.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T2 | SINH | `metrics:collect` | thu KPI mỗi lần chạy test → knowledge/metrics/ (tích luỹ theo thời gian). | `scripts/qa/metrics_collect.js` | docs/kit-map.md |
| T2 | SINH | `perf` | biến mục 16 (Performance/SLA) thành ĐO THẬT, so ngưỡng catalog → verdict. | `scripts/qa/perf_check.js` | RULE_GLOBAL.md · README.md · USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/skills · prompt_templates · tests/fe/infra |
| T2 | SINH | `perf:report` | dựng báo cáo HTML từ artifact k6 CỦA MỘT LƯỢT CHẠY. CHỈ ĐỌC ĐĨA: | `scripts/qa/perf_report.js` | .agent/skills |
| T2 | SINH | `reliability` | Test Reliability Index (TRI) per-testcase + flaky quarantine. | `scripts/qa/reliability_index.js` | .gitlab-ci.yml · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/skills · tests/fe/infra |
| T2 | SINH | `smoke:matrix` | CHẠY BỘ SMOKE QUA NHIỀU TRÌNH DUYỆT × KÍCH THƯỚC, rồi gom BẢNG Ô ĐỎ. | `scripts/qa/reuse/smoke_matrix.js` | tests/fe/infra |
| T2 | SINH | `steps:reverify` | DANH MỤC PHẢN ỨNG VỚI MÀN ĐỔI VÀ VỚI BƯỚC KHÔNG AI DÙNG (v2.8.0 §E, dòng 2 và 4). | `scripts/qa/reuse/steps_reverify.js` | **KHÔNG BỀ MẶT NÀO** |
| T2 | SINH | `risk` | Risk-Based Testing CÓ THỰC THI (Suggest-only). | `scripts/qa/risk_score.js` | .gitlab-ci.yml · RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · .claude/commands · tests/fe/infra |
| T2 | SINH | `security`, `security:check` | biến phần deterministic của mục 15 thành ĐO THẬT. | `scripts/qa/security_check.js` | .gitlab-ci.yml · RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · tests/fe/infra |
| T2 | SINH | `spec:extract` | bảng field trong FSD (markdown) → `screens.json` → (tuỳ chọn) `ui_catalog.json`. | `scripts/qa/spec_extract.js` | RULE_GLOBAL.md · docs/kit-map.md · prompt_templates |
| T2 | SINH | `inventory:gate` | Chống "CI false green" (F1). | `scripts/qa/test_inventory_gate.js` | docs/kit-map.md |
| T2 | SINH | `token:audit` | ĐO ĐỘNG: một lượt chạy thật đã tiêu token vào đâu. | `scripts/qa/token_audit.js` | RULE_GLOBAL.md · docs/kit-map.md · tests/fe/infra |
| T2 | BÁO CÁO | `docs:health` | trả lời "tài liệu tôi đang đọc có còn đúng không" bằng MỘT LỆNH. | `scripts/phase1/docs_health.js` | prompt_templates |
| T2 | BÁO CÁO | `ambiguity:gate` | CỔNG MƠ HỒ, nay có CODE đứng sau chứ không chỉ có lời dặn. | `scripts/qa/ambiguity_gate.js` | .agent/workflows · prompt_templates · tests/fe/infra |
| T2 | BÁO CÁO | `bug:tc-match` | ĐỀ XUẤT (không tự ghi) TC canonical cho bug đang `module: "(unmapped)"`. | `scripts/qa/bug_tc_matcher.js` | docs/kit-map.md · .claude/commands |
| T2 | BÁO CÁO | `bugs:checklist` | biến `knowledge/bugs/` thành CHECKLIST lúc SINH CASE (chiều §20 Error Guessing). | `scripts/qa/bugs_checklist.js` | .agent/workflows · .agent/skills · prompt_templates · .claude/commands · tests/fe/infra |
| T2 | BÁO CÁO | `cleanup:check`, `cleanup:check:enforce` | QUÉT FILE DUMP LỌT Ở ROOT REPO (§Cleanup Rules của RULE_GLOBAL). | `scripts/qa/cleanup_check.js` | .gitlab-ci.yml · .github/workflows · tests/fe/infra |
| T2 | BÁO CÁO | `docs:budget` | đo TÀI LIỆU đầu vào của task rồi nói rõ: đọc trực tiếp, hay GIAO SUBAGENT trích ra rồi chỉ | `scripts/qa/doc_budget.js` | docs/kit-map.md · prompt_templates |
| T2 | BÁO CÁO | `gate:code-pair`, `gate:code-pair:enforce` | MỖI MÃ GATE PHẢI CÓ MỘT CẶP BẨN/SẠCH, VÀ PHẢI ĐỊNH TUYẾN ĐÚNG (v2.7.0 §A10.3). | `scripts/qa/gate_code_pair.js` | .gitlab-ci.yml · .github/workflows · tests/fe/infra |
| T2 | BÁO CÁO | `(không npm — đăng ký ở playwright.config.js)` | Playwright reporter TỰ ĐỘNG thu learning data sau MỖI lần chạy test. | `scripts/qa/learn_reporter.js` | playwright.config.js (tự động) |
| T2 | BÁO CÁO | `next` | LỆNH TIẾP THEO, suy từ TRẠNG THÁI ARTIFACT (v2.7.0 §A7). | `scripts/qa/next_command.js` | README.md · .agent/workflows · .agent/rules · prompt_templates · partial-rerun · .claude/commands · tests/fe/infra |
| T2 | BÁO CÁO | `quality:decision` | Quality Decision Engine, capstone). Gộp tín hiệu chất lượng → 1 quyết định | `scripts/qa/quality_decision.js` | scripts/qa/README.md · docs/kit-map.md |
| T2 | BÁO CÁO | `rerun:failed` | chạy lại ĐÚNG case đỏ của lượt vừa rồi, bằng MỘT lệnh. | `scripts/qa/rerun_failed.js` | RULE_GLOBAL.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · tests/fe/infra |
| T2 | BÁO CÁO | `reuse:measure` | ĐO NĂM MỤC TIÊU CỦA §G, VÀ NÓI RÕ MỤC NÀO CHƯA ĐO ĐƯỢC (v2.8.0 §G). | `scripts/qa/reuse/measure.js` | **KHÔNG BỀ MẶT NÀO** |
| T2 | BÁO CÁO | `smoke:run` | CHẠY SMOKE HỆ THỐNG, với ba lớp chặn trước khi nó được phép chạy (v2.8.0 §L). | `scripts/qa/reuse/smoke_run.js` | tests/fe/infra |
| T2 | BÁO CÁO | `steps:match` | KHỚP CÂU BƯỚC CỦA TESTCASE VỚI DANH MỤC BƯỚC (v2.8.0 §C2). | `scripts/qa/reuse/steps_match.js` | .agent/skills · tests/fe/infra |
| T2 | BÁO CÁO | `steps:suggest` | CHỈ RA CÂU BƯỚC NÀO NÊN VIẾT LẠI, VÀ VIẾT LẠI THẾ NÀO (v2.8.0 §K). | `scripts/qa/reuse/steps_suggest.js` | tests/fe/infra |
| T2 | BÁO CÁO | `select:tests` | Intelligent Test Selection từ git diff. | `scripts/qa/select_tests.js` | docs/kit-map.md · tests/fe/infra |
| T2 | BÁO CÁO | `results:summary` | đọc `results.json` của Playwright, in BẢN TÓM TẮT có TRẦN DÒNG. | `scripts/qa/summarize_results.js` | docs/kit-map.md · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · tests/fe/infra |
| T2 | BÁO CÁO | `report` | const { spawnSync } = require('child_process'); | `scripts/show_report.js` | .gitlab-ci.yml · RULE_GLOBAL.md · CLAUDE.md · README.md · USER_GUIDE.md · scripts/qa/README.md · docs/kit-map.md · .github/workflows · .agent/workflows · .agent/rules · .agent/skills · prompt_templates · exploratory · partial-rerun · manual-run · .claude/commands · tests/fe/infra |
| T2 | BÁO CÁO | `task:which` | XÁC ĐỊNH TASK_KEY cho một lượt chạy slash command. | `scripts/utils/task_hien_tai.js` | README.md · USER_GUIDE.md · QUICKSTART.md · .claude/commands |

## File trong `scripts/qa/` KHÔNG có npm script nào gọi

Không hẳn là lỗi — có thể là thư viện dùng chung. Nhưng nếu là gate thì nó đang chết.

- `scripts/qa/autofix.js`
- `scripts/qa/k6_dashboard_import.js`
- `scripts/qa/override.js`
- `scripts/qa/perf_index.js`
