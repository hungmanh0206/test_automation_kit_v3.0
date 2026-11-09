# V6 audit and next steps

- Preserves all 931 original Kit B files byte-for-byte (verified against original archive by SHA-256).
- Adds a stricter optional PASS evidence check, 13 adversarial mutation tests, and a static inventory of QA JavaScript scripts.
- No modifications to existing workflows, rules, skills, package.json, or baseline gates.
- The original V5 structural checker still accepts evidence filenames as strings; use V6 evidence gate for stronger file/hash checks.
- Tests are synthetic, not a real AI skill quality benchmark or live browser regression.
- Next: integrate opt-in gate in CI after reviewing artifacts schema, create ground-truth bug fixtures, run A/B/V6 on the same model and environment, and re-score all 18 criteria.
