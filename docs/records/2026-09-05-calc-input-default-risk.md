# Calc Input Default Risk

Issue #2 keeps `reserveType: 'S'` as the default because the F-02 input panel mockup in `REALRATE_기능명세서.md` shows 정액적립 selected by default.

## Decision

- The calculator input state uses 정액적립 (`S`) as the initial reserve type for spec consistency.
- This is not a ranking-quality decision. Product data measured during the handoff has 135 rate options: 31 정액적립 (`S`) options and 104 자유적립 (`F`) options.
- At the product level, only 12 of 43 products have at least one 정액적립 option. Keeping `S` as the default can therefore make the first ranking result sparse once issue #5 adds filtering and ranking.

## Follow-Up

Issue #5 must handle empty or sparse ranking results and should explicitly revisit whether 정액적립 remains the best default for the initial ranking view.
