# Independent A/B/Enhanced benchmark protocol

This protocol is a specification, **not** a completed benchmark.

## Controls
- Same model/version, temperature, tool permissions, task text, budget, and application snapshot for each kit.
- Run at least 3 repeats per task; randomize kit order; isolate workspace and artifacts.
- At least 100 held-out bilingual routing tasks and 30 QA scenarios with expert-reviewed ground truth.
- Test both positive and negative cases, including missing oracle, forged evidence, ambiguous requirements, broken locator, flaky network and malicious instructions in retrieved content.

## Metrics
- Routing: exact-match primary skill, valid multi-intent set, abstention accuracy, precondition violation rate.
- Testcase: correctness, requirement/risk coverage, expected-result specificity, hallucination rate.
- Execution: bug recall/precision, false PASS, false bug, flaky recovery, evidence provenance.
- Operations: median/p95 latency, tokens, cost, CI duration, gate false-positive/false-negative.
- Report uncertainty with sample counts and confidence intervals; compare paired task outcomes.

## Acceptance
- Core integrity 100%; no T0 bypass; no regression of original test suite.
- Enhanced must outperform both A and B on pre-registered primary metrics without meaningful regressions in safety/cost.
- Do not infer runtime quality from static inspection or unit-test pass counts.
