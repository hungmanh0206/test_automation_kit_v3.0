# Enhanced V3 — release notes

## Scope
Kit B remains canonical. Five Kit A-derived adapters remain optional. This release addresses the V2 legacy-tool policy failure and adds deterministic router regression tests.

## Changes
- Replaced obsolete tool references in the two affected imported SOURCE_GUIDE.md files with Kit B-approved destinations (Backlog, Google Sheets, Markdown task folder).
- Updated SHA-256 manifest entries to match adapted documents. These documents are **adaptations**, not verbatim copies of Kit A. Consult original Kit A ZIP for provenance.
- Added `extension:benchmark` deterministic smoke benchmark with 7 labeled examples.
- Extended `extension:test` to include routing regression and authorization-invariant tests.

## Verification (Node 22 environment)
- `node scripts/qa/policy_source_check.js`: PASS
- `node scripts/qa/extension_integrity_check.js`: PASS, 5 adapters
- `npm run extension:test`: PASS, 18 tests
- `npm run extension:benchmark`: PASS, 7/7 hand-authored cases

## Known limitations
- No LLM evaluation, no live Playwright/browser run, no full CI pipeline execution.
- Small smoke benchmark is not evidence of semantic routing accuracy.
- The adaptation changed source reference prose. It does not validate any third-party integration.
- Do not interpret READY_FOR_REVIEW as execution permission or PASS verdict.

## Commands
```
npm run gate:policy
npm run extension:check
npm run extension:test
npm run extension:benchmark
```
