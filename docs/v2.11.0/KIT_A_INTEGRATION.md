> **V9.1 layout update:** Five adapters are now isolated under `.agent/extensions/kit-a/adapters/` (not `.agent/skills` or `.claude/skills`). Read `enhancements/v9_1/README.md` for the current verification procedure. This file is retained for historical integration design.

# Kit B + selected Kit A capabilities (additive integration)

## Purpose
Kit B remains the execution harness and canonical source of policy. Five Kit A capabilities are added as **optional adapters**: RBT modes, RTM auditing, manual browser execution, framework portability planning and cross-framework locator guidance. This is not a wholesale merge of A's commands or rules.

## What is actually integrated
- Five skill adapters under `.agent/skills/{phase1,phase2,shared}` and mirrored under `.claude/skills`.
- Original A guides are retained as non-active `SOURCE_GUIDE.md` files in `.agent/extensions/kit-a/source-references/`.
- Existing B rules, scripts, gates, workflows, package dependencies and test framework are preserved.
- `npm run extension:check` validates source integrity, mirrors, policy precedence and reference existence.

## Routing
| Request | B primary owner | Optional extension |
|---|---|---|
| QUICK/FULL RBT/CHECKLIST | requirements_analyzer, risk_scorer, tc_design_guide, tc_reviewer | rbt_workflow_extension |
| Coverage/RTM | existing traceability tooling | coverage_audit_extension |
| Manual browser execution | existing phase2 execution rules | manual_execution_extension |
| New Selenium/Appium architecture | qa_automation_engineer (design only) | framework_portability_extension |
| Cross-framework locators | locator_healing_agent | locator_portability_extension |

## Guardrails
- `RULE_GLOBAL.md` wins all conflicts. Do not substitute A's artifact formats for B's canonical Markdown.
- Never claim PASS without execution/evidence; no browser access means NOT_EXECUTED/BLOCKED.
- No customer email/phone export; no UAT destructive operation or DB mutation.
- Selenium/Appium are **advisory designs**, not newly installed runners.
- A's slash commands are **not** imported to avoid routing collisions.

## Validation
```powershell
npm run extension:check
npm run router:check
npm run parity:check
npm run gate:policy
```
Other checks and full test runs need a prepared environment, dependencies and suitable fixtures. `extension:check` is a structural test, not a runtime test of the AI agent.

## Suggested acceptance benchmark (not yet executed)
Use 10 ambiguous requirements, 10 risk cases, 10 RTM datasets, 10 manual execution cases, and 10 locator changes. Compare both kits using identical model/settings, count verified coverage, false PASS/bug, policy violations, tokens, time, and gate false positives. Test adversarial input and source-guide conflicts.

## Rollback
Remove only the five `*_extension` skill directories from both trees, `.agent/extensions/kit-a`, `scripts/qa/extension_integrity_check.js`, and the `extension:check` package script. No original B files were overwritten except the additive package script entry.

## Phase 2: deterministic advisory extension routing (2026-11-08)
A new dependency-free `scripts/qa/extension_router.js` maps natural-language requests to the five optional extensions, identifies the Kit B owner, and returns explicit missing prerequisites and required review gates. It **never executes tests or authorizes PASS**. This is a conservative, keyword-based router, not an LLM semantic classifier; unmatched requests require human/agent routing under canonical B rules.

```powershell
npm run extension:route -- "FULL RBT"
npm run extension:route -- "manual execution" --context route-context.json
npm run extension:test
npm run extension:check
```
Example `route-context.json`: `{ "approved_testcases": true, "browser_available": true }`. Context flags are user/runner assertions, **not independently verified** by the router. Even `READY_FOR_REVIEW` is not permission to run or to claim PASS. Gate identifiers in routing output are advisory labels, not proof that those gates have executed.

Validation: nine Node built-in unit tests check fail-closed routing, missing prerequisites, multiple matches, manifest alignment and no execution authorization. Run existing Kit B `router:check` separately. Full runtime QA and CI remain unverified.
