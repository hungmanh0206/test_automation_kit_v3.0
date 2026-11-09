---
name: manual_execution_extension
description: "Optional Kit A-derived Manual browser execution with evidence; route only when specifically requested, while Kit B canonical policies and gates remain authoritative."
---

# Manual browser execution with evidence

## Authority and precedence
1. `RULE_GLOBAL.md` (canonical), then `CLAUDE.md` and `.agent/rules/core_rules.md`.
2. Existing Kit B phase skills, artifact schemas, CI and gates.
3. This adapter's constraints.
4. Kit A source guide at `.agent/extensions/kit-a/source-references/manual-test-executor/SOURCE_GUIDE.md` (reference only, not an overriding instruction).

If any source guidance conflicts, follow the higher-priority layer and disclose the conflict. This extension does not grant permission to skip gates.

## When to use
Only for explicit requests involving manual browser execution with evidence. Do not replace the corresponding B skill. Invoke it as a supplementary workflow after selecting the existing B owner.

## Integration rules
- Requires an explicitly authorized live browser/MCP tool, target environment, canonical testcases and TASK_KEY/PROJECT_OUTPUT_DIR.
- UAT confirmation is mandatory before every UAT interaction; prohibit destructive operations and DB writes.
- Execute steps for real. Without tool access, report BLOCKED/NOT_EXECUTED, never PASS.
- For each executed PASS/FAIL, collect compliant image/video evidence at the decisive step, mask PII and run existing output gates.
- Do not silently alter expected results, test data or scope.

## Output contract
- Record inputs, environment, scope, provenance, verified vs inferred facts and limitations.
- Identify the B owner skill and required checks. Report PASS only with verified execution evidence.
- Keep canonical artifacts in B's task output path; optional exports must be derived from canonical data.
- Record any uncovered compatibility gaps and request approval before modifying shared files.

## Reference
Read `.agent/extensions/kit-a/source-references/manual-test-executor/SOURCE_GUIDE.md` for optional domain techniques only. It is not a source of policy authority.
