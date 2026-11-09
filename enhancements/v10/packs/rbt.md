# RBT / testcase design — Advanced Prompt Pack V10

**Status:** optional reference only. Authority remains `RULE_GLOBAL.md` and Kit B canonical gates. Not a substitute for actual execution or human-approved oracle.
**Owner:** `tc_design_guide` · **Extension:** `rbt_workflow_extension` · **Origin:** adapted from Kit A `rbt-manual-testing` and Kit B canonical workflow.

## Activation
Use for testcase design and risk prioritization; QUICK for small/clear tasks, FULL RBT for complex/high risk, CHECKLIST for concise release checks. Do not treat CHECKLIST as execution evidence.

## Inputs and evidence
Requirement IDs and cited requirement text; affected roles, supported behavior, constraints, preconditions; explicit unknowns and owner-approved assumptions.

## Task-specific method
1. Enumerate requirement IDs and ambiguities; mark unresolved rather than guessing.
2. Select mode with reason and risk criteria (impact × likelihood), expose assumptions.
3. Derive positive, negative, boundary, state transition, security and permission cases where relevant; never invent unsupported behavior.
4. Write independent expected result for each testcase based on requirements, not observed UI.
5. Map case ID to requirement ID, mark uncovered conditions and seek review before execution.

## Positive exemplar (illustrative, not real evidence)
`REQ-LOGIN-01` says five failed logins lock an account. `TC-LOGIN-BVA-01`: given four failures, fifth invalid password causes lock; expected: locked state and stated error *if specified*; if message not specified, mark message oracle unresolved.

## Counterexample: reject or flag
`TC-01: Click Login; expected: page looks correct; status PASS` — no requirement link, no independent oracle, no execution evidence. Reject.

## Mandatory output contract
JSON artifact with `requirements` (IDs), `testcases` array (`id`,`requirement_ids`,`steps`,`expected`,`risk`,`technique`), `ambiguities` array, `coverage_gaps` array, `review_status`. Each expected must be nonempty and testable.

## Handoff and stop conditions
Handoff to `tc_reviewer` and B risk/ambiguity gates. `review_status` cannot be `approved` unless external review evidence exists. Missing requirement or undefined oracle => BLOCKED/NEEDS_CLARIFICATION, never PASS.

## Context loading policy
Load this pack *only* after the router matches the task and preconditions are met. Start with only the contract and method for QUICK tasks; load examples and counterexamples when risk is high, ambiguity persists, or a prior quality check failed. Never auto-load all five packs.
