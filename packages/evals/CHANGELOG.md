# @cogitator-ai/evals

## 0.13.0

### Minor Changes

- [#264](https://github.com/cogitator-ai/Cogitator-AI/pull/264) [`c757489`](https://github.com/cogitator-ai/Cogitator-AI/commit/c75748968d50646a9ba1f78102f1692a25f05220) - Experiment tracking: named runs saved as versioned run files, a `RunStore`, `compareRuns()`, Markdown and HTML reports, and `reportComparison()`

  Agent case results now keep the `traceId` of their run (`RunResult.trace.traceId`) and the versioned instructions it used in `prompt` (`{ key, versionId?, version?, abTest? }`, from `RunResult.prompt`). Each turn of a multi-turn case keeps its own and the case keeps the last turn's, each trial its own. The JSON report carries them.

  `EvalSuite` takes `name` and JSON-serializable `metadata` describing the experiment. `EvalSuiteResult` gains `runId`, `startedAt`, `finishedAt`, `toRun()` and `saveRun()`, so hand-written mocks of it need them, and the JSON report gains a top-level `name` and `runId`. `result.saveRun(target)` writes a run file (`format: 'cogitator.eval-run'`, `version: 1`, `<runId>.json` in a directory target) with the dataset fingerprint (SHA-256 of the canonical JSON of the cases run), the configuration (metric names, judge model, temperature and samples, trials, concurrency, target kind, agent name and model, never functions, Cogitator instances or keys), the prompt versions used, every case result with a stable `caseKey`, the aggregates, assertions and stats. `result.toRun()` returns it without writing, `loadRun(path)` reads it back validated with Zod, and `RunStore` keeps runs in a directory with `save()`, `list()` (newest first, with metric means), `load(id)` and `latest(filter?)`. `list()` and `latest()` skip `.json` entries they cannot use, reporting each to the `onSkip` option (a process warning by default), while `load(id)` throws for them. Runs are validated before they are written, so a hand-made `runId` cannot lead outside the directory.

  `compareRuns(base, head, { alpha?, test?, seed?, metrics? })` matches cases by `caseKey`, lists the cases only one run has in `added` and `removed`, and compares each metric both runs have with the statistics of `EvalComparison` (means, difference, bootstrap CI, effect size, p-value, Holm-adjusted p-value, significance and winner), plus the `improved` and `regressed` cases. `warnings` say when the dataset fingerprints, the prompt versions, the metrics or the judge differ. A metric no matched case was scored on is left out and named in `warnings`, so it does not weaken the Holm correction of the others.

  `result.report()` takes two new types: `markdown`, a compact summary for pull request comments, and `html`, a self-contained page that reads well in light and dark color schemes. `reportComparison(comparison, 'markdown' | 'html' | 'console', { path? })` renders `compareRuns()` and `EvalComparison` results with the winner, a metric table, regressions, improvements and warnings, and `comparisonMarkdown()` and `comparisonHtml()` return the text. The statistics of `EvalComparison` moved into a module shared with `compareRuns()`, with no change to their results.

## 0.12.0

### Minor Changes

- [#262](https://github.com/cogitator-ai/Cogitator-AI/pull/262) [`62113ba`](https://github.com/cogitator-ai/Cogitator-AI/commit/62113bac3519fc7101a32e5633f430660fe967b9) - Sturdier LLM judges and sounder A/B statistics: injection-safe prompts, sampling, rubrics, G-Eval, pairwise judging, judge calibration, Holm's correction, bootstrap intervals and effect sizes

  Judge prompts now keep every untrusted value of a case (input, response, expected answer, context, retrieved passages, the turns of a conversation) inside XML-like tags such as `<input>` and `<response>`, with `<`, `>` and `&` escaped, and tell the judge that tag contents are data to evaluate, never instructions. An answer that tells the judge to give it full marks can no longer close its tag and speak as the rubric. This applies to every judge metric, and the cache key version is bumped, so verdicts cached by an earlier version miss once and are judged again.

  `judge.samples` asks the judge several times per case and metric and scores the mean of the verdicts it could read, with their spread in `details`, each verdict in `metadata.samples` and the summed `usage`. Each sample has its own cache key. `llmMetric()` takes a discrete `rubric` (at least two levels with distinct scores) as an alternative to its free prompt: the judge picks a level, normalized to 0 - 1. The new `gEval({ name, criteria, steps?, scale? })` scores on a scale following evaluation steps, which the judge writes from the criteria once per metric instance when none are given. `calibrateJudge(metric, examples)` scores labelled examples and reports Pearson, Spearman, the mean absolute error and Cohen's kappa against the labels.

  `EvalComparison` takes `pairwise: { criteria?, name? }`: the judge reads both answers of each case twice, swapped the second time, and `result.pairwise` reports wins, ties, the challenger's win rate and each verdict. Each metric comparison now reports `difference`, a seeded bootstrap `ci` of the paired differences, `effectSize` (Cohen's d), the `test` it ran and `adjustedPValue`, and `summary.latency` and `summary.cost` compare the two sides per case, lower being better, outside the vote on the winner. New options: `alpha` (0.05 by default), `test: 't' | 'wilcoxon'` and `seed`. The statistics are exported: `wilcoxonSignedRank`, `mcnemarExact`, `holm`, `bootstrapCI`, `cohensD`, `pearson` and `spearman`.

  Behaviour changes: a metric of a comparison is now `significant` when its Holm-adjusted p-value across the compared metrics is below `alpha`, so a comparison of several metrics declares fewer winners than before, while `pValue` stays the test's own. Binary metrics with fewer than 25 discordant pairs take the exact McNemar test instead of the chi-square approximation. Judge prompts leave out the expected answer when a case has none instead of writing `N/A`, the judge's instructions changed, and `llmMetric()` now refuses an empty name or prompt. `pairedTTest` rounds the paired differences to 12 significant digits, so a constant difference with float noise counts as constant. `JudgeCogitator.run` may receive a `signal`, which pairwise judging passes so a cancelled comparison stops promptly.

## 0.11.0

### Minor Changes

- [#260](https://github.com/cogitator-ai/Cogitator-AI/pull/260) [`4a0643b`](https://github.com/cogitator-ai/Cogitator-AI/commit/4a0643bd72753e12d7c526cf6f2fd1209ee1c55e) Thanks [@bhushan4work](https://github.com/bhushan4work)! - Add `tokenF1` deterministic metric for token-level precision, recall, and F1 scoring with normalization and multiset token overlap.

## 0.10.0

### Minor Changes

- [#261](https://github.com/cogitator-ai/Cogitator-AI/pull/261) [`d33a8e6`](https://github.com/cogitator-ai/Cogitator-AI/commit/d33a8e6e4f0d094f77e39fcd747cebbebc9211aa) - Agent-native evaluation: tool calls, trajectories, retrieval, multi-turn cases, trials with pass@k and Vitest matchers

  A case can now say what the agent should do, not only what it should answer. `expectedToolCalls` (`{ name, arguments? }[]`) is scored by `toolCalls()`, which pairs the calls of the run with the expected ones as multisets (arguments compared as a subset, exactly or not at all, scored as F1, recall or precision), and by `trajectory()`, which compares the sequence of tool names exactly, in order or in any order. `expectedPassages` (ids or texts) is scored by `retrievalRecall()`, `retrievalPrecision()` and `retrievalMRR()`, and the new `contextRelevance()` judge asks whether the retrieved passages fit the input.

  An agent target records the raw tool results of the run (`toolResults`, through `onToolResult`) and the passages they surfaced (`retrieved`). The target's new `retrieval` option reads passages out of a tool result, by default `ragSearchPassages`, which reads the `rag_search` tool of `@cogitator-ai/rag`. `faithfulness()` checks the response against the retrieved passages when there are some, the case `context` otherwise.

  A case with `turns` runs as a conversation: an agent target answers every turn on one thread of its own, so the Cogitator's memory carries it, and a `fn` target is called once per turn with `context.turn` and `context.history`. The case output is the last answer, tool calls, results, passages and usage are summed over the turns, and `turns` lists each. A failing turn fails the case with its error.

  The suite's new `trials` option runs each case several times, each trial scored on its own, the case result being the first trial that answered and holding them all in `trials` and the aggregates taking the mean of a case's trials. `passAtK(metric, { k, threshold })` scores the unbiased pass@k estimate over the trials, and the suite refuses a `k` above `trials` or a metric it does not have.

  The new `@cogitator-ai/evals/matchers` entry exports `evalMatchers` for `expect.extend()`: `toHaveCalledTool`, `toFollowTrajectory`, `toHaveRetrieved` and `toScoreAtLeast`. It is typed for Vitest 5, whose matcher types changed, and sits apart from `@cogitator-ai/evals/vitest` so `describeEval` keeps working from Vitest 3. The custom `metric()` callback also gets the run's tool calls, tool results, passages, turns and the whole case result. The CSV loader reads `turns`, `expectedToolCalls` and `expectedPassages` from JSON cells, the json report keeps the agent data and trials of each case, and the console and GitHub reports show the trials per case.

  Datasets now validate `turns`, `expectedToolCalls` and `expectedPassages`: a CSV column or a JSONL field with one of those names that does not hold a valid value now fails the load, where it used to be ignored. The `faithfulness()` prompt changed, so cached faithfulness verdicts miss and its scores against saved baselines may shift. With several trials, `latency()`, `cost()` and `tokenUsage()` see every trial, and `stats.errors` counts a case as errored only when every trial errored. `EvalComparison` takes `trials` as well. LLM judges read a multi-turn case as the conversation, the last user message marked as the one the response answers.

## 0.9.0

### Minor Changes

- [#252](https://github.com/cogitator-ai/Cogitator-AI/pull/252) [`5c952d4`](https://github.com/cogitator-ai/Cogitator-AI/commit/5c952d4ccb3cc3a826c81f568eaf82c32c1560d7) - Evals skip scoring cases that failed, carry how agent runs ended, cache and limit the judge, run under Vitest and report to CI as JUnit and GitHub annotations

  A case whose every attempt failed is no longer scored: its empty output costs no judge calls and no longer counts as a 0 in the means. Aggregates cover the cases that answered, `aggregated.<metric>.count` says how many, and the new `maxErrorRate(rate)` assertion fails a run where too many cases errored. This raises the means of a run with failed cases, so pair metric thresholds with `maxErrorRate` and save `noRegression` baselines again. An agent target's case result now carries `truncated`, `iterationLimitReached` and `paused`, and the reporters show them.

  The judge takes `cache` (`true` for memory, or a `JudgeCache` with `get` and `set`), which reuses a verdict for the same model, settings and prompt and never caches an unreadable one, and `concurrency`, which caps the judge calls running at once. Both belong to the suite and its runs share them. A `JudgeCache` that fails to read or write only warns, and the judge runs as if there were no cache.

  `describeEval(name, { suite, run?, timeout? })` from `@cogitator-ai/evals/vitest` runs a suite once under Vitest, with a test per case that fails when the case errored and one for the assertions. `vitest` is an optional peer dependency.

  The `ci` reporter sets `process.exitCode` instead of calling `process.exit(1)`, so output flushes and later hooks run. The new `junit` reporter writes `<path>.xml`, and the `github` reporter prints workflow command annotations and appends a summary to `$GITHUB_STEP_SUMMARY`.

  `Dataset.sample(n, { seed })` and `shuffle({ seed })` pick and order the same cases on every run for a number or string seed. The JSONL and CSV loaders name the line of the file a case the schema refuses comes from. The CSV loader now splits on commas instead of guessing the delimiter, so a single column with semicolons stays whole, and throws on a malformed row such as a quote never closed instead of folding the rest of the file into one case.

  `EvalComparison` counts a case that errored on one side as a 0 for that side, so a challenger that fails cases loses on them, leaves out the cases neither side scored, and gives each metric `n`, the cases it was compared on.

## 0.8.0

### Minor Changes

- [#241](https://github.com/cogitator-ai/Cogitator-AI/pull/241) [`ce435e0`](https://github.com/cogitator-ai/Cogitator-AI/commit/ce435e087d2bfd167a9f76a3036806321990ee10) Thanks [@WilliamK112](https://github.com/WilliamK112)! - Add containsAll and containsAny deterministic keyword metrics.

## 0.7.0

### Minor Changes

- [#206](https://github.com/cogitator-ai/Cogitator-AI/pull/206) [`b1730d6`](https://github.com/cogitator-ai/Cogitator-AI/commit/b1730d6516e0501a2ecdae9530bf4e1c9482ac05) Thanks [@bhushan4work](https://github.com/bhushan4work)! - Add `similarity()` metric to compute string similarity using Levenshtein distance with two-row dynamic programming. Calculates `score = 1 - distance / max(output.length, expected.length)`, scoring 1 for identical strings and two empty strings without division by zero, and near 0 for unrelated strings. Supports `caseSensitive` (default `false`), whitespace trimming matching `exactMatch`, custom `name`, and includes distance in `details` whenever score is below 1.

## 0.6.1

### Patch Changes

- [#199](https://github.com/cogitator-ai/Cogitator-AI/pull/199) [`fd99224`](https://github.com/cogitator-ai/Cogitator-AI/commit/fd992243b89f3941f76c2acb607b59468a35480a) - Packages declare `"sideEffects": false`, so bundlers can leave out the modules an app does not use. None of them runs code at import time that depends on being kept. The repository URL in each package.json uses the `git+https` form npm expects.
- Updated dependencies [[`fd99224`](https://github.com/cogitator-ai/Cogitator-AI/commit/fd992243b89f3941f76c2acb607b59468a35480a)]:
  - @cogitator-ai/core@0.39.1

## 0.6.0

### Minor Changes

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - A timed-out eval attempt is now cancelled instead of abandoned. The suite aborts an `AbortSignal` per attempt: an agent target gets it as `cogitator.run(agent, { input, context, signal })`, so its run stops instead of finishing and paying in the background, and a `fn` target is called as `fn(input, { signal, case, attempt })`. The suite waits for a cancelled attempt to stop (at most another `timeout`) before it retries, so attempts of one case never overlap and `concurrency` holds. `suite.run({ signal })` and `comparison.run({ signal })` cancel a whole run, which then rejects with the signal's reason.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - `stats.cost` now includes the LLM judge, so a budget assertion sees what the run really spent, and `stats.targetCost` and `stats.judgeCost` split it. Each judge score carries the judge's `usage`. A case's `usage` sums every attempt that reported one, so an attempt that finished after it timed out still counts, and `attempts` says how many attempts the case took.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - A metric that throws no longer drops its case from the results and crashes Node with an unhandled rejection, and an `onProgress` callback that throws is reported as a process warning instead. The failing metric scores 0 for that case with the reason in the new `MetricScore.error`, which the LLM judge (unreadable verdict, failed call) and `metric()` (throwing `evaluate`) set as well. A score that is not a finite number, such as NaN from `0 / 0`, counts as such a failure instead of poisoning the aggregate. `stats.errors` counts cases whose every attempt failed and `stats.metricErrors` the failed scores. `threshold` and `noRegression` fail plainly on a value that is not a finite number, and `saveBaseline()` refuses to write one, so a NaN can no longer become a `null` baseline that every later run passes.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - Every built-in per-case metric takes a `name` option, such as `regex(/\[\d+\]/, { name: 'hasCitation' })` or `faithfulness({ name: 'faithfulToSources' })`. A suite refuses two metrics with the same name: before, two `regex()` checks merged into one `regex` aggregate, so a check that failed every case could hide behind one that passed. `regex()` also ignores the `g` and `y` flags, which made identical outputs alternate between pass and fail.

### Patch Changes

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - The LLM judge reads its verdict more carefully. A `{"score": "0.8"}` verdict in a code fence scored 0 and `There is 1 factual error. Score: 0.4` scored 1: now a fenced verdict and a numeric string score are read, and an answer without JSON falls back to its last labelled score (`Score: 0.4`, `score is 4/5`) instead of the first number that looks like 0 or 1.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - `pairedTTest` keeps the sign of an infinite t statistic when the differences have no variance, `VERSION` reports the installed package version instead of a stale `0.1.0`, and `EvalComparison` checks `concurrency`, `timeout` and `retries` when it is created.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - CommonJS consumers can load the packages again. The exports maps only had an `import` condition, so `require('@cogitator-ai/core')` from NestJS, Jest in CommonJS mode or a script outside `"type": "module"` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`, although Node 22.12+ can `require()` these ES modules. Every entry now ends with a `default` condition pointing at the same file.
- Updated dependencies [[`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281)]:
  - @cogitator-ai/core@0.34.0

## 0.5.1

### Patch Changes

- [#117](https://github.com/cogitator-ai/Cogitator-AI/pull/117) [`0caa714`](https://github.com/cogitator-ai/Cogitator-AI/commit/0caa714e0d52b0effb983f63c5edca499a22235b) - npm keywords for every package, so a search for what a package does finds it, and packages are now published with provenance: npm shows that each version was built and signed by the repository's release workflow, from which commit.
- Updated dependencies [[`0caa714`](https://github.com/cogitator-ai/Cogitator-AI/commit/0caa714e0d52b0effb983f63c5edca499a22235b)]:
  - @cogitator-ai/core@0.30.2

## 0.5.0

### Minor Changes

- [#110](https://github.com/cogitator-ai/Cogitator-AI/pull/110) [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406) - LLM judge metrics now read the case's `context`. The judge saw only the input, the expected answer and the response, so checking faithfulness against source documents meant stuffing them into `input`. The context goes into the judge's prompt between the input and the expected answer, each key on its own line and objects as JSON, and `faithfulness()` judges against the input and the context.

### Patch Changes

- Updated dependencies [[`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406)]:
  - @cogitator-ai/core@0.28.0

## 0.4.0

### Minor Changes

- 27789fc: The `run_eval` tool ran the whole dataset even with `maxCases` and reported `assertionsPassed: true` for limited runs. `EvalSuite.run({ maxCases })` now executes only the first `maxCases` cases, and the tool passes the limit through and reports the real assertion results.

### Patch Changes

- 27789fc: Judge configs had to set `temperature` in TypeScript although the schema defines a default, and that default was never applied. `judge` now takes `JudgeConfigInput` with an optional `temperature`, and the suite resolves it to 0 when it is omitted.
- fd688a0: `threshold` and `noRegression` treated `tokenUsage` as higher-is-better; it is now lower-is-better like `latency` and `cost`. McNemar's test clamps the continuity correction at zero, so equal discordant counts give chi-square 0 and p-value 1.
- Updated dependencies [9175c69]
- Updated dependencies [e70e482]
- Updated dependencies [1993d56]
- Updated dependencies [1369ed1]
- Updated dependencies [0bf2e44]
- Updated dependencies [bc76f42]
- Updated dependencies [1993d56]
- Updated dependencies [1993d56]
- Updated dependencies [1993d56]
- Updated dependencies [1993d56]
- Updated dependencies [1993d56]
- Updated dependencies [c117071]
- Updated dependencies [656499e]
- Updated dependencies [1993d56]
- Updated dependencies [bc76f42]
- Updated dependencies [656499e]
- Updated dependencies [bc76f42]
- Updated dependencies [b8c9eca]
- Updated dependencies [b8c9eca]
- Updated dependencies [9175c69]
- Updated dependencies [d35ef2a]
- Updated dependencies [db2e373]
- Updated dependencies [49503b9]
- Updated dependencies [a36cde4]
  - @cogitator-ai/core@0.26.0

## 0.3.0

### Minor Changes

- 6a9453d: LLM-judge metrics, statistical metrics and file reporters report real numbers.

  - The judge configured on `EvalSuite`, `EvalBuilder` or `EvalComparison` was wired to a stub that echoed its own prompt, so judge metrics scored 0 (or whatever number the prompt contained). The judge now runs as a Cogitator agent on `judge.model` with a `{ score, reasoning }` JSON schema, through `judge.cogitator` or the `cogitator` of an agent target. **Breaking:** a suite with LLM metrics and nothing to run the judge now fails when it is built instead of scoring 0.
  - `latency()`, `cost()` and `tokenUsage()` reported a score of 0, so `aggregated.latency.p95` and `threshold('latency.p95', …)` were always 0 and always passed. They now return one value per case, the aggregate covers those values, and `aggregated.<name>.metadata` holds totals.
  - `report(['json', 'csv'], { path })` treats `path` as a base and writes `.json` and `.csv` files next to each other instead of overwriting one file, creates missing directories, and runs `ci` last.

### Patch Changes

- Updated dependencies [480f2a3]
- Updated dependencies [c4a4252]
- Updated dependencies [f134b01]
- Updated dependencies [6404340]
- Updated dependencies [c1cd7a1]
- Updated dependencies [22f47c9]
- Updated dependencies [51d581e]
- Updated dependencies [5b12191]
- Updated dependencies [f36a121]
  - @cogitator-ai/core@0.22.0

## 0.2.0

### Minor Changes

- **Breaking:** requires Node.js 22.12 or newer (Node 20 reached end of life).

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.21.0

## 0.1.13

### Patch Changes

- Internal peer dependencies are now declared as version ranges instead of exact pins, so the package keeps installing cleanly alongside newer 0.x releases of @cogitator-ai/core.
- EvalSuite no longer swallows case failures silently: a case whose attempts all fail or time out now carries an `error` message on its result, timeouts are retried like other failures, and the per-attempt timeout timer is cleared.
- Updated dependencies
  - @cogitator-ai/core@0.20.0

## 0.1.12

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.19.4

## 0.1.11

### Patch Changes

- Republish packages with resolved internal dependency versions so npm installs do not receive workspace protocol dependencies.
- Updated dependencies
  - @cogitator-ai/core@0.19.3

## 0.1.10

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.19.2

## 0.1.9

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.19.1

## 0.1.8

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.18.7

## 0.1.7

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.18.6

## 0.1.6

### Patch Changes

- Updated dependencies
  - @cogitator-ai/core@0.18.5

## 0.1.5

### Patch Changes

- @cogitator-ai/core@0.18.4

## 0.1.4

### Patch Changes

- @cogitator-ai/core@0.18.3

## 0.1.3

### Patch Changes

- @cogitator-ai/core@0.18.2

## 0.1.2

### Patch Changes

- fix(evals): audit — 7 bugs fixed, +5 tests
  - csv-loader: replaced blocking `readFileSync` with async `readFile`
  - eval-suite: retry fallback now returns real elapsed duration instead of 0
  - eval-builder: removed duplicate `isLLMMetric` function (now imported from eval-suite)
  - regression: fixed `isLowerBetter` to include `*Duration` and `*Latency` suffix checks
  - regression: `noRegression` now fails when no baseline metrics found in current results (was incorrectly passing)
  - custom: assertion `check()` errors are now caught and returned as `passed: false`
  - statistical: converted index loop to for-of in tokenUsage

  Also removed unused dependencies `@cogitator-ai/types` and `nanoid`.
  Exported `isLLMMetric` as part of public API.
