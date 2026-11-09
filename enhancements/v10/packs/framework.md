# Framework portability / architecture — Advanced Prompt Pack V10

**Status:** optional reference only. Authority remains `RULE_GLOBAL.md` and Kit B canonical gates. Not a substitute for actual execution or human-approved oracle.
**Owner:** `qa_automation_engineer` · **Extension:** `framework_portability_extension` · **Origin:** adapted from Kit A `framework-architect` and Kit B canonical workflow.

## Activation
Use on explicit Playwright/Selenium/Appium comparison or migration tasks; retain Playwright canonical implementation unless user approves separate runner.

## Inputs and evidence
Runtime/platform constraints, target browsers/devices, repository topology, current runner capabilities, intended migration scope, CI and evidence requirements.

## Task-specific method
1. State target framework and assumptions.
2. Map test layers (fixtures, actions, assertions, evidence, retries, reports) to target.
3. Preserve independent oracle and B output contract.
4. Provide migration plan and rollback, identify parity gaps and experimental code.
5. Require real runnable tests and CI checks before claiming parity.

## Positive exemplar (illustrative, not real evidence)
`Playwright to Appium`: keep testcase IDs and oracle, replace device driver, add Android/iOS capability config, mark CI and device-farm parity UNVERIFIED until run.

## Counterexample: reject or flag
`Selenium and Appium fully supported` based on generated sample pseudocode, without installed packages, runner or executed tests. Reject.

## Mandatory output contract
JSON `source_framework`,`target_framework`,`capability_matrix` (`feature`,`status`,`evidence`), `migration_steps`,`missing_dependencies`,`rollback`,`validation_status`.

## Handoff and stop conditions
Handoff to canonical framework owner and gate review; never edit Kit B core directly. Any unsupported framework must be reported as proposed, not operational.

## Context loading policy
Load this pack *only* after the router matches the task and preconditions are met. Start with only the contract and method for QUICK tasks; load examples and counterexamples when risk is high, ambiguity persists, or a prior quality check failed. Never auto-load all five packs.
