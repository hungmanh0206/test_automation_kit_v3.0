# V8 — Independent comparison and verification status

## Verified baseline

- Kit B original: 931 files; SHA-256 unchanged in V8: 931/931.
- Static file inventory: A 65, B 931, V8 985.
- New files relative to B: 54.
- No original Kit B files were overwritten or deleted.

## Regression executed in this environment

| Command | Exit |
|---|---|
| `node enhancements/v5/tests.js` | 0 |
| `node enhancements/v5/benchmark.js` | 0 |
| `node enhancements/v6/mutation_tests.js` | 0 |
| `node enhancements/v7/tests.js` | 0 |
| `python enhancements/v8/verify_core.py` | 0 |

## Historical architecture scoring — NOT new measured scores

- Previously published summary: A 70.7/100; B 88.4/100.
- **Arithmetic audit:** applying the published weights to the published 18 criterion scores yields A **67.35/100** and B **90.63/100**. The earlier summary numbers do not reconcile with that table; they must not be treated as reproducible scores.
- V8 score: **not assigned** pending independent rubric assessment and runtime benchmark.

| Criterion | Weight | Historical A /10 | Historical B /10 | V8 /10 |
|---|---:|---:|---:|---|
| Skill design and content | 10% | 9.0 | 8.7 | Not yet independently scored |
| Skill routing | 6% | 8.7 | 9.0 | Not yet independently scored |
| Prompt engineering | 5% | 9.0 | 8.8 | Not yet independently scored |
| Harness architecture | 12% | 5.0 | 9.5 | Not yet independently scored |
| Deterministic gates | 9% | 3.0 | 9.5 | Not yet independently scored |
| Automation framework | 9% | 5.5 | 9.3 | Not yet independently scored |
| Test design and RBT | 7% | 9.3 | 9.1 | Not yet independently scored |
| Oracle and evidence | 7% | 7.3 | 9.5 | Not yet independently scored |
| CI/CD | 6% | 2.0 | 9.3 | Not yet independently scored |
| Debug and flaky handling | 5% | 7.5 | 9.1 | Not yet independently scored |
| Security and governance | 5% | 6.0 | 9.2 | Not yet independently scored |
| Traceability and reporting | 5% | 8.5 | 9.2 | Not yet independently scored |
| Integration and MCP | 3% | 8.5 | 8.5 | Not yet independently scored |
| Developer experience | 3% | 9.0 | 7.2 | Not yet independently scored |
| Scalability | 3% | 8.2 | 8.8 | Not yet independently scored |
| Maintenance and drift | 2% | 6.0 | 8.8 | Not yet independently scored |
| Context efficiency | 2% | 6.5 | 8.5 | Not yet independently scored |
| Multi-framework flexibility | 1% | 9.5 | 6.5 | Not yet independently scored |

## What this V8 actually adds

- A reproducible ZIP structural comparison tool.
- A complete SHA-256 manifest of the 931 original B files.
- A regression execution log with exit codes and output tails.
- The original 18-criterion rubric in machine-readable JSON.
- A controlled A/B/Enhanced benchmark protocol.

## What is NOT verified

- No live browser E2E against an application.
- No AI model was run against the same QA tasks for A, B and V8.
- No independent test of skill output quality, token efficiency, bug detection, or false PASS.
- Existing historical architecture scores are subjective and not a controlled benchmark.
