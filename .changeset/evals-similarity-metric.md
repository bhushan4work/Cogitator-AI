---
'@cogitator-ai/evals': minor
---

Add `similarity()` metric to compute string similarity using Levenshtein distance with two-row dynamic programming. Calculates `score = 1 - distance / max(output.length, expected.length)`, scoring 1 for identical strings and two empty strings without division by zero, and near 0 for unrelated strings. Supports `caseSensitive` (default `false`), whitespace trimming matching `exactMatch`, custom `name`, and includes distance in `details` whenever score is below 1.
