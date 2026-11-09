# Traceability / coverage audit — Advanced Prompt Pack V10

**Status:** optional reference only. Authority remains `RULE_GLOBAL.md` and Kit B canonical gates. Not a substitute for actual execution or human-approved oracle.
**Owner:** `tc_reviewer` · **Extension:** `coverage_audit_extension` · **Origin:** adapted from Kit A `coverage-traceability` and Kit B canonical workflow.

## Activation
Use when requirements and testcase IDs exist and user asks for RTM, gaps, or orphan test detection. Do not infer achieved runtime/code coverage from a text RTM.

## Inputs and evidence
Authoritative list of requirement IDs with versions, testcase IDs, relation map, execution statuses only when accompanied by real run IDs.

## Task-specific method
1. Normalize IDs without silently merging distinct requirements.
2. Build bipartite map Requirement→Testcase; identify missing requirements and orphan cases.
3. Distinguish structural coverage from verified runtime coverage.
4. Flag unknown applicability and duplicate mappings for manual decision.
5. Report numerator, denominator, excluded items, provenance.

## Positive exemplar (illustrative, not real evidence)
`REQ-1` mapped to `TC-1`; `REQ-2` unmapped => coverage 1/2 = 50% structural, runtime coverage UNKNOWN. `TC-3` maps to nonexisting REQ-4 => orphan.

## Counterexample: reject or flag
`All requirements covered 100%` because three testcase files exist, without listing requirement IDs or denominator. Reject.

## Mandatory output contract
JSON `requirements` array, `testcases` array, `links` array (`requirement_id`,`testcase_id`), `uncovered_requirement_ids`, `orphan_testcase_ids`, `coverage_numerator`, `coverage_denominator`, `coverage_kind` = structural|runtime, `evidence_refs`.

## Handoff and stop conditions
Owner `tc_reviewer`; report unknown/ambiguous link as unresolved. Do not upgrade structural coverage to runtime PASS.

## Context loading policy
Load this pack *only* after the router matches the task and preconditions are met. Start with only the contract and method for QUICK tasks; load examples and counterexamples when risk is high, ambiguity persists, or a prior quality check failed. Never auto-load all five packs.
