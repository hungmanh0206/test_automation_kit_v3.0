# V10 Advanced Prompt Engineering — opt-in, no Kit B core edits

Five **deep prompt packs** adapted from Kit A methodology and aligned to Kit B canonical governance:
`rbt`, `coverage`, `manual`, `framework`, `locator`.
Each pack defines activation, inputs, concrete method, positive and negative example, output contract and handoff conditions.

## Run (Windows PowerShell)

```powershell
node enhancements/v10/tests.js
node enhancements/v10/plan.js "FULL RBT" --context context.json --depth deep
node enhancements/v10/evaluate.js rbt artifact.json
```

Create `context.json` containing `{"requirements_available":true}` for the example. `--depth deep` includes examples/counterexamples in the *suggested load plan*; it does not call a model or auto-load files. The operator/agent must read the selected Markdown pack and apply it subordinate to `RULE_GLOBAL.md`. The evaluator only checks structural contracts; it **does not** measure semantic QA correctness, actual AI quality, latency or tokens.

## Quality and rollout

- Router operates in opt-in advisory mode. Unknown and missing prerequisites never authorize execution.
- The canonical 28 skill set and its `.claude` shim count remain unchanged.
- Regression checks aim to detect input contract flaws; do not count fixtures as live agent benchmark.
- Do not claim prompt score 9.5/10 or superiority to A unless held-out same-model prompts are tested for validity, coverage, oracle quality, hallucination and cost.
- For fair evaluation: same model, same requirements, A/B/V10 prompts, blind expert-scored outputs, minimum 3 trials per task; report bootstrap CI and disagreements.

## Source trace

The five supplied A reference guides are retained under `.agent/extensions/kit-a/source-references/`. New prompt packs are *curated derivatives*, not verbatim copies. Existing policy gates and execution interfaces remain authoritative.
