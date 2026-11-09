# V10 Audit — Advanced Prompt Engineering

## Core preservation

- Original Kit B files: **931 / 931 byte-identical (SHA-256)**
- Changed or missing originals: **0**
- V9.1 skill canonical layout unchanged: **28 Kit B skills + 28 Claude shims**
- New V10 files isolated to `enhancements/v10/` only.

## What improved

1. Five specialized QA prompt packs (RBT, coverage, manual execution, architecture portability, locator healing), each with method, anti-example, output contract and handoff.
2. Deterministic context planner selects opt-in pack from V5 routing, blocks missing prerequisites and never claims execution.
3. Per-pack structural contract evaluator rejects unsafe or incomplete outputs, includes negative mutation tests.
4. New tests: **22/22 PASS**. Regression groups V5 9/9, V6 13/13, V7 13/13, V9 23/23, V9.1 7/7 all PASS in this environment.

## Remaining gaps

- Prompt Quality Score remains **UNSCORED**. V10 has not been evaluated by the same LLM against Kit A's prompt output on an independent task set. Do not claim 9.5/10.
- No measured token efficiency, no semantic oracle review or human blind grading.
- Full Windows Playwright 2,602-case regression should be rerun; no new user verdict is authorized.
- Structural validation of evidence is not proof of true capture or accurate product behavior.

## Exact CLI

```powershell
node enhancements/v10/tests.js
node enhancements/v10/plan.js "FULL RBT" --context context.json --depth deep
node enhancements/v10/evaluate.js rbt artifact.json
node enhancements/v9_1/run_infra.js --focus all --workers 2
```

Note: a context file must exist; for FULL RBT use `{"requirements_available":true}`. Do not set it to true without evidence.
