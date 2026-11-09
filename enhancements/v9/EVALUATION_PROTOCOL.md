# A/B/V9 evaluation protocol

1. Freeze versions and verify the original B SHA-256 manifest.
2. Select 30+ unseen requirements across UI/API/mobile, including deliberately ambiguous and contradictory cases. Keep expected outputs hidden from all agents.
3. Use the same model, prompts, tool permissions, time budgets, hardware, browser versions, and application state for A, B and V9. Report if a kit needs host dependencies.
4. Run each case three times per kit. Log artifacts, tool calls, tokens, latency, runner exit codes, and human QA review.
5. Label true bugs and non-bugs against an independent oracle. Compute recall, precision, false-PASS rate, false-bug rate, traceability coverage, and cost per accepted testcase.
6. Audit T0 gates with positive and negative mutation cases. Verify they are actually invoked by normal execution paths.
7. Score all 18 original architecture criteria using the same weights, with evidence for each score; keep runtime score separate.
8. Publish confidence intervals, failures and unresolved metrics. Never replace missing data with estimates.
