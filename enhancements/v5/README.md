# V5 — Router and skill-quality foundation

This is an **additive, advisory extension**. No existing Kit B file is overwritten.

## Run (Node.js 20+)

```bash
node enhancements/v5/router.js "thiết kế testcase và độ bao phủ"
node enhancements/v5/tests.js
node enhancements/v5/benchmark.js
node enhancements/v5/quality_check.js path/to/artifact.json
```

## Boundaries

- Router uses normalized lexical matching, **not AI semantic inference**. Multiple matches require human/agent review.
- Routing never executes tests, grants permission, bypasses phase gates, or issues a PASS verdict.
- Quality checker enforces a **minimal artifact contract**. It does not prove evidence authenticity, oracle validity, bug detection, or testcase correctness.
- Curated routing cases are regression fixtures, **not independent holdout benchmark**.
- `RULE_GLOBAL.md` and existing Kit B gates remain authoritative.

## Next production work

Add a separately evaluated model-backed semantic router with confidence calibration and abstention; benchmark A, B and V5 against independently labeled QA scenarios, using identical model and runtime budgets. Add browser execution and adversarial evidence tests before assigning runtime quality scores.
