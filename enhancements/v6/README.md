# Enhanced V6 — harness reliability (additive only)

The entire original Kit B remains byte-for-byte unchanged. This folder is an **optional** additional safety layer. It does not replace or automatically intercept the existing gates.

Run from project root:

```powershell
node enhancements/v6/mutation_tests.js
node enhancements/v6/inventory.js
node enhancements/v5/tests.js
node enhancements/v5/benchmark.js
```

To validate an artifact containing `verdict: PASS`, provide evidence records `{ "path": "trace.txt", "sha256": "64 hex chars" }` and run:

```powershell
node enhancements/v6/evidence_gate.js artifact.json evidence-folder
```

The evidence gate verifies that a file exists under the supplied root and matches its digest. **It cannot prove evidence authenticity, that a test ran, that expected results are correct, or that the verdict is true.** A human or independent oracle remains necessary. The original V5 quality checker is not modified.

The gate inventory is a static report, not a validation of 157 documented gates. No automatic integration into existing CI is performed.
