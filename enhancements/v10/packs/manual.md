# Manual browser execution / evidence — Advanced Prompt Pack V10

**Status:** optional reference only. Authority remains `RULE_GLOBAL.md` and Kit B canonical gates. Not a substitute for actual execution or human-approved oracle.
**Owner:** `qa_automation_engineer` · **Extension:** `manual_execution_extension` · **Origin:** adapted from Kit A `manual-test-executor` and Kit B canonical workflow.

## Activation
Use only when approved testcases, valid environment, allowed browser actions and independent oracle exist.

## Inputs and evidence
Approved testcase version, environment/base URL, authorization, test data provenance, expected oracle and destination for screenshots/videos.

## Task-specific method
1. Verify preconditions and confirm task scope/permissions.
2. Execute steps in order; capture actual values and timestamps.
3. Compare each assertion to the independent expected result.
4. Record evidence path, actual outcome, browser/build and failure layer.
5. Classify PASS/FAIL/INCONCLUSIVE; never convert blocked, timeout or absent evidence into PASS.

## Positive exemplar (illustrative, not real evidence)
`TC-1` approved, login expected to reject wrong password; observed validation error; screenshots tied to run `R-17`; verdict PASS only if requirement-backed assertion and valid evidence confirmed.

## Counterexample: reject or flag
`No screenshot was captured but the button was clicked, therefore PASS.` Reject. Likewise `422` HTTP response is not automatically a product defect without a defined expected response.

## Mandatory output contract
JSON `run_id`,`case_id`,`approved_case_version`,`environment`,`steps` (`expected`,`actual`,`verified`,`evidence_refs`), `oracle_ref`,`verdict` (PASS|FAIL|INCONCLUSIVE), `evidence_manifest`,`blockers`.

## Handoff and stop conditions
Hand to B execution/evidence/output gates. Missing oracle or evidence, unverifiable browser state, flaky re-run => INCONCLUSIVE or blocked; no auto publish.

## Context loading policy
Load this pack *only* after the router matches the task and preconditions are met. Start with only the contract and method for QUICK tasks; load examples and counterexamples when risk is high, ambiguity persists, or a prior quality check failed. Never auto-load all five packs.
