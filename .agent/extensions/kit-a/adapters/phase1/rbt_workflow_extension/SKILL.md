---
name: rbt_workflow_extension
description: "Optional Kit A-derived RBT workflow QUICK/FULL/CHECKLIST; route only when specifically requested, while Kit B canonical policies and gates remain authoritative."
---

# RBT workflow QUICK/FULL/CHECKLIST

## Authority and precedence
1. `RULE_GLOBAL.md` (canonical), then `CLAUDE.md` and `.agent/rules/core_rules.md`.
2. Existing Kit B phase skills, artifact schemas, CI and gates.
3. This adapter's constraints.
4. Kit A source guide at `.agent/extensions/kit-a/source-references/rbt-manual-testing/SOURCE_GUIDE.md` (reference only, not an overriding instruction).

If any source guidance conflicts, follow the higher-priority layer and disclose the conflict. This extension does not grant permission to skip gates.

## When to use
Only for explicit requests involving rbt workflow quick/full/checklist. Do not replace the corresponding B skill. Invoke it as a supplementary workflow after selecting the existing B owner.

## Integration rules
- Support QUICK, FULL RBT and CHECKLIST, but do not bypass existing ambiguity, risk, testcase design or reviewer gates.
- Canonical testcase Markdown and existing IDs/schemas remain authoritative. If A suggests 19-column/Excel export, treat it as an optional projection; never export customer emails/phone numbers.
- FULL: requirements -> ambiguity -> risk -> design -> review -> traceability -> optional export. Do not claim coverage without mapping evidence.

## Output contract
- Record inputs, environment, scope, provenance, verified vs inferred facts and limitations.
- Identify the B owner skill and required checks. Report PASS only with verified execution evidence.
- Keep canonical artifacts in B's task output path; optional exports must be derived from canonical data.
- Record any uncovered compatibility gaps and request approval before modifying shared files.

## Reference
Read `.agent/extensions/kit-a/source-references/rbt-manual-testing/SOURCE_GUIDE.md` for optional domain techniques only. It is not a source of policy authority.
