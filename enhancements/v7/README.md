# V7 — Workflow contracts and context planning

V7 is additive: it does not modify Kit B's original files or activate new CI gates.

## Commands

```powershell
node enhancements/v7/tests.js
node enhancements/v7/context_planner.js testcase rbt_workflow_extension
node enhancements/v7/workflow.js init workflow.json
node enhancements/v7/workflow.js advance workflow.json requirements requirement-data.json
```

Advance through `requirements`, `ambiguity`, `risk`, `testcase`, `review`, `automation`, `execution`, `evidence`, `verdict`, `report`. Each `advance` reads a JSON file containing the stage data and writes a new workflow state only after validation.

## Guarantees and limitations

- Enforces order, minimum schemas, approval, requirement IDs and evidence manifest structure.
- Does **not** run Playwright, verify evidence files or SHA hashes, authenticate the source of evidence, or validate the independent oracle. Use V6 evidence gate and existing Kit B policy for those checks.
- Context planner is advisory; skill names and reference topics are routing hints, not verified file paths. No measured token reduction is claimed.
- Do not interpret a `COMPLETE` state as proof of correct test execution. Full CI/E2E integration remains future work.
