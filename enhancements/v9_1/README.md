# V9.1 Compatibility Hotfix — opt-in Kit A extensions without changing Kit B

Date: 2026-11-08. This report supersedes earlier packaging/location instructions for the **five A-derived adapters** only; it does not rewrite historical release notes.

## Why V9.1 exists

A Windows infra regression of V9 had 2,523 passed, 10 failed, 61 skipped and 8 not run (2,602 total). Failure classification from the user-supplied Playwright log:

- **Seven failures:** A-derived skills were placed under `.agent/skills/{phase1,phase2,shared}` but were not fully registered in B's canonical index, Claude shims or routing fixture. This breaks B's `skills-shim`, `skills-route` and `/start` infra tests. **V9.1 removes this conflict at source:** the five adapters are now non-canonical under `.agent/extensions/kit-a/adapters/<phase>/<skill>/SKILL.md`. The existing source guides remain unchanged.
- **Two failures:** a Windows env variable may be called `Path` rather than `PATH`. `gateEnv()` clones the env into a plain JS object whose keys are case-sensitive. V9.1 adds a **non-core launch wrapper** that normalizes PATH before starting Playwright. Original B implementation remains untouched. Needs Windows execution verification.
- **One failure:** `env-signals.spec.ts` did not observe the expected HTTP 422 within 10 seconds in the 6-worker run. V9.1 offers a focused isolated run with workers=1 for diagnosis; it does NOT weaken the assertion, suppress a failure or classify it as fixed.

## Invariants and constraints

- **931/931 Kit B original files remain byte-identical (SHA-256).** This includes package.json, README, original `.agent/skills`, `.claude/skills`, config, CI and test suites.
- 28 canonical Kit B skills + 28 canonical Claude shims are preserved. The 5 A-derived adapters remain optional, referenced by manifest and extension router, not auto-registered as canonical Kit B skills.
- Unlike V9's placement in `.agent/skills`, adapters must now be loaded **explicitly by their path from** `scripts/qa/extension_router.js`. They are NOT automatically advertised as Claude skills. This is the deliberate tradeoff required for zero-core-change compatibility.
- The extension router is deterministic/advisory. It never authorizes execution or verdict. Canonical Kit B rules and task/profile workflow win.
- This does not change test expectations or add retries, nor does it create task execution verdicts. `PROJECT_OUTPUT_DIR` and profile-based execution are still required for formal QA verdicts.

## Run on Windows (PowerShell)

From the extracted V9.1 repository root (where `package.json` is):

```powershell
npm.cmd ci --no-audit --no-fund
npx.cmd playwright install chromium

# Dependency-free checks
node enhancements/v9_1/tests.js
node scripts/qa/extension_integrity_check.js
node scripts/qa/skills_index.js --check
node scripts/qa/skills_route.js
node scripts/qa/policy_source_check.js
node scripts/qa/router_check.js
node scripts/qa/parity_check.js
python enhancements/v8/verify_core.py

# Check two former PATH failures through runner env normalization
node enhancements/v9_1/run_infra.js --focus windows --workers 1
node enhancements/v9_1/run_infra.js --focus windows-selftest --workers 1

# Isolate HTTP 422 recording (no injected retries)
node enhancements/v9_1/run_infra.js --focus env --workers 1

# Skills-compatibility and start-command tests
node enhancements/v9_1/run_infra.js --focus skills --workers 1
node enhancements/v9_1/run_infra.js --focus routing --workers 1
node enhancements/v9_1/run_infra.js --focus start --workers 1

# Full infra regression (2 workers rather than previous 6, no extra retries)
node enhancements/v9_1/run_infra.js --focus all --workers 2
```

Run the full suite only after the focused checks. The wrapper is a separate Node launcher that sets uppercase PATH in the environment passed to the Playwright Node process, without modifying Kit B source files.

To request optional guidance, use (still advisory):

```powershell
node scripts/qa/extension_router.js "FULL RBT"
node enhancements/v5/router.js "thiết kế testcase"
```

Then open the `adapter_path` from the first command, and follow the Kit B owner, prerequisites and canonical gates. The V5 router returns intent candidates but not an adapter file path.

## Local verification actually run

- B file integrity: 931/931 SHA-256 unchanged
- Canonical index + shim check: 28/28 PASS
- Original B `skills_route.js`, `policy_source_check.js`, `router_check.js`, `parity_check.js`: successful exit codes
- V5 unit, V5 curated lexical benchmark, V6 mutation, V7 unit, V9 contract benchmark: successful exit codes
- Extension router unit suite: 18/18 passed
- V9.1 Node test suite: 7/7 passed
- Extension integrity structural check: 5/5 passed

**Not verified locally:** Full Playwright 2,602-test Windows regression; the 2 PATH scenarios and the 422 scenario require a real rerun on Windows with dependencies and Chromium. An exit-code-zero static check does not establish runtime correctness.

## Acceptance criteria before 'fixed 10/10'

1. All 7 formerly failing skill tests pass in the full infra suite, not only isolated checks.
2. Both formerly failing Windows `PATH` tests pass through the launcher without B code modification.
3. HTTP 422 capture test passes in isolation and under full suite at least twice without hidden retries. Any intermittent failure must be reported as flaky, not waived.
4. Core SHA-256 verification passes on the extracted package.
5. No mandatory test is skipped or assertion weakened to turn the suite green. Existing skips and not-run cases are counted separately, not converted to PASS.
