---
name: framework_portability_extension
description: "Optional Kit A-derived Multi-framework architecture planning; route only when specifically requested, while Kit B canonical policies and gates remain authoritative."
---

# Multi-framework architecture planning

## Authority and precedence
1. `RULE_GLOBAL.md` (canonical), then `CLAUDE.md` and `.agent/rules/core_rules.md`.
2. Existing Kit B phase skills, artifact schemas, CI and gates.
3. This adapter's constraints.
4. Kit A source guide at `.agent/extensions/kit-a/source-references/framework-architect/SOURCE_GUIDE.md` (reference only, not an overriding instruction).

If any source guidance conflicts, follow the higher-priority layer and disclose the conflict. This extension does not grant permission to skip gates.

## When to use
Only for explicit requests involving multi-framework architecture planning. Do not replace the corresponding B skill. Invoke it as a supplementary workflow after selecting the existing B owner.

## Integration rules
- Default to B's existing Playwright architecture; never scaffold over the current framework.
- For Selenium/Appium, generate an isolated proposal or separate workspace only after explicit user approval.
- Document dependencies, maintenance cost, CI, evidence contracts and compatibility with B gates; no claim that B gates automatically support other frameworks.
- Keep UAT/DB/security rules unchanged.

## Output contract
- Record inputs, environment, scope, provenance, verified vs inferred facts and limitations.
- Identify the B owner skill and required checks. Report PASS only with verified execution evidence.
- Keep canonical artifacts in B's task output path; optional exports must be derived from canonical data.
- Record any uncovered compatibility gaps and request approval before modifying shared files.

## Reference
Read `.agent/extensions/kit-a/source-references/framework-architect/SOURCE_GUIDE.md` for optional domain techniques only. It is not a source of policy authority.
