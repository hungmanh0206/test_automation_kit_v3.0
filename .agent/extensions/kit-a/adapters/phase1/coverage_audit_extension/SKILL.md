---
name: coverage_audit_extension
description: "Optional Kit A-derived RTM gap and orphan analysis; route only when specifically requested, while Kit B canonical policies and gates remain authoritative."
---

# RTM gap and orphan analysis

## Authority and precedence
1. `RULE_GLOBAL.md` (canonical), then `CLAUDE.md` and `.agent/rules/core_rules.md`.
2. Existing Kit B phase skills, artifact schemas, CI and gates.
3. This adapter's constraints.
4. Kit A source guide at `.agent/extensions/kit-a/source-references/coverage-traceability/SOURCE_GUIDE.md` (reference only, not an overriding instruction).

If any source guidance conflicts, follow the higher-priority layer and disclose the conflict. This extension does not grant permission to skip gates.

## When to use
Only for explicit requests involving rtm gap and orphan analysis. Do not replace the corresponding B skill. Invoke it as a supplementary workflow after selecting the existing B owner.

## Integration rules
- Prefer `npm run trace:matrix` and existing traceability identifiers before generating a supplementary RTM.
- Mark mappings as verified, inferred or unmapped. Never count inferred links as verified coverage.
- Report uncovered requirements, unautomated cases and orphan tests separately; missing input is UNKNOWN, not zero.

## Output contract
- Record inputs, environment, scope, provenance, verified vs inferred facts and limitations.
- Identify the B owner skill and required checks. Report PASS only with verified execution evidence.
- Keep canonical artifacts in B's task output path; optional exports must be derived from canonical data.
- Record any uncovered compatibility gaps and request approval before modifying shared files.

## Reference
Read `.agent/extensions/kit-a/source-references/coverage-traceability/SOURCE_GUIDE.md` for optional domain techniques only. It is not a source of policy authority.
