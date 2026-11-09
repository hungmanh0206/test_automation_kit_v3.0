---
name: locator_portability_extension
description: "Optional Kit A-derived Cross-framework locator guidance; route only when specifically requested, while Kit B canonical policies and gates remain authoritative."
---

# Cross-framework locator guidance

## Authority and precedence
1. `RULE_GLOBAL.md` (canonical), then `CLAUDE.md` and `.agent/rules/core_rules.md`.
2. Existing Kit B phase skills, artifact schemas, CI and gates.
3. This adapter's constraints.
4. Kit A source guide at `.agent/extensions/kit-a/source-references/smart-locator-agent/SOURCE_GUIDE.md` (reference only, not an overriding instruction).

If any source guidance conflicts, follow the higher-priority layer and disclose the conflict. This extension does not grant permission to skip gates.

## When to use
Only for explicit requests involving cross-framework locator guidance. Do not replace the corresponding B skill. Invoke it as a supplementary workflow after selecting the existing B owner.

## Integration rules
- First inspect actual DOM/accessibility tree or mobile hierarchy; never fabricate selectors.
- Prefer semantic role/name and stable test IDs, verify uniqueness and stability before proposing a change.
- Use B's `locator_healing_agent` for Playwright changes and its review flow; Selenium/Appium suggestions are advisory unless a matching runner is installed.
- Do not weaken assertions or change expected outcomes to heal a locator.

## Output contract
- Record inputs, environment, scope, provenance, verified vs inferred facts and limitations.
- Identify the B owner skill and required checks. Report PASS only with verified execution evidence.
- Keep canonical artifacts in B's task output path; optional exports must be derived from canonical data.
- Record any uncovered compatibility gaps and request approval before modifying shared files.

## Reference
Read `.agent/extensions/kit-a/source-references/smart-locator-agent/SOURCE_GUIDE.md` for optional domain techniques only. It is not a source of policy authority.
