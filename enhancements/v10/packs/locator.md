# Locator healing / portability — Advanced Prompt Pack V10

**Status:** optional reference only. Authority remains `RULE_GLOBAL.md` and Kit B canonical gates. Not a substitute for actual execution or human-approved oracle.
**Owner:** `locator_healing_agent` · **Extension:** `locator_portability_extension` · **Origin:** adapted from Kit A `smart-locator-agent` and Kit B canonical workflow.

## Activation
Use for broken selectors backed by DOM snapshots or accessibility tree. Do not perform healing without reproducible evidence.

## Inputs and evidence
Original locator, DOM/accessibility snapshot, element role/name, intended interaction, unique match count, before/after test evidence.

## Task-specific method
1. Confirm the intended element and selector failure.
2. Prefer role+accessible name or stable test ID; use CSS/XPath only if stable semantics unavailable.
3. Validate uniqueness, visibility/actionability and the same post-action oracle.
4. Record fallback chain and why alternatives were rejected.
5. Do not silently change a locator to make a failing product assertion PASS.

## Positive exemplar (illustrative, not real evidence)
Button label changed but test ID `submit-order` remains stable: validate uniqueness and click, then re-run original assertion about order creation.

## Counterexample: reject or flag
`Old Save button missing; click first button on page and mark PASS.` Reject (wrong target possible, oracle bypass).

## Mandatory output contract
JSON `original_locator`,`proposed_locator`,`dom_evidence_ref`,`match_count`,`confidence_rationale`,`post_action_assertions`,`validation_status`.

## Handoff and stop conditions
Handoff to `locator_healing_agent` and B locator-validation gate; zero/multiple matches or absent DOM evidence => BLOCKED, no automatic healing.

## Context loading policy
Load this pack *only* after the router matches the task and preconditions are met. Start with only the contract and method for QUICK tasks; load examples and counterexamples when risk is high, ambiguity persists, or a prior quality check failed. Never auto-load all five packs.
