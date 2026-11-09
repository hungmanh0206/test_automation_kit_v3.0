# V8 benchmark and audit

Run core check: `python enhancements/v8/verify_core.py`

Run structural A/B/Enhanced comparison (from any directory):
`python enhancements/v8/compare.py --a kit_A_qig-qa-automation.zip --b test-automation-kit-qig-main.zip --enhanced test-automation-kit-qig-enhanced-v8.zip`

Read `V8_AUDIT_AND_COMPARISON.md` and `benchmark_protocol.md`. This is a static and local regression audit, not a live AI benchmark.
