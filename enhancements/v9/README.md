# V9 — Independent deterministic contract fixtures

Run from repository root:

```powershell
node enhancements/v9/benchmark.js enhancements/v9/results.json
python enhancements/v8/verify_core.py
```

This fixture suite checks the V5 artifact validator and V7 workflow stage contracts. Its fixture set is curated by the same development process, so results are **not independent evidence of generalization**. The suite does not execute Claude/LLM skills, browsers, CI, or Playwright, and does not establish authenticity of screenshots or correctness of PASS verdicts.

**Required next step:** Run A, B, V9 with identical model settings against a separately held-out corpus of real QA tasks and instrument token usage, latency, bug recall, false PASS, and false bug rates. Do not award V9 a runtime score until those measurements exist.
