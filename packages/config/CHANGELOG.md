# @cogitator-ai/config

## 0.19.0

### Minor Changes

- [#228](https://github.com/cogitator-ai/Cogitator-AI/pull/228) [`99ceb01`](https://github.com/cogitator-ai/Cogitator-AI/commit/99ceb0107f7403fba0a95e31fd2d10b743144a03) - A thread can be compacted into a tree of grounded atoms that is never summarized again and does not lose what is still open, and a Cogitator compacts a run's thread after the run.

  - `CompactionStrategy` gains `hierarchical`. The entries new since the last compaction, up to the kept tail, are read in chapters of about `chapterTokens` tokens (default 4000), each opening with the end of the one before, one at a time (`chapterConcurrency` reads more at once), and the summarizer lists the atoms of each, told the items still open before it so it can close them (`CompactionAtom`: `kind` `fact`, `task`, `decision`, `constraint`, `error`, `file` or `thread`, `status` `open` or `closed`, `text`, `evidence`, `verified`). Every quote is checked against its entry, an answer that is not a valid array is asked for again up to three tries, a constraint or a decision only tool outputs show is not verified, and files tool calls worked on, failed tool calls (known by their tool and files, or arguments when they name no files, and closed by a later call of the same tool on them that succeeds) and task lines (`TODO:`, `- [ ]`, closed by `- [x]`) are taken from the entries with no model. The transcript indents further lines of an entry and cuts one at about `chapterTokens`, and a part to compact under a tenth of the kept tail is left for later. Chapters beyond `chaptersPerArc` (default 4) fold into arcs and arcs beyond `arcsPerSaga` (default 4) into the saga, which keeps every open item and the newest 200 facts and files (`SAGA_ATOMS`), with no model, and an open item is closed only by an atom whose evidence holds. A control item is closed or opened again only by an atom whose evidence holds, and `messageThreshold` counts only the entries written since the last summary. The summary is written only when every open item of the one before is still there or was closed, else `compact()` throws and the thread stays as it was. The whole tree is one `compaction` entry, `CompactionEvent.levels` (`CompactionLevels` of `CompactionNode`s), and its message is the handoff, laid out as open tasks, constraints, decisions, unresolved errors, open questions, files, facts and done, in the same order every time so it stays in the prompt cache. `CompactionService.chapterAtoms(window, config, { own, open })` returns the checked atoms of one window. On an adapter without branches the levels are kept in the summary entry's metadata (`compactionLevels`).
  - `CompactionConfig.keepRecentTokens` keeps the newest tokens of the conversation verbatim for the `hierarchical` strategy, as whole turns that open with a user message, so a tool call keeps its result.
  - `memory.compaction` (`MemoryCompactionConfig`) compacts a run's thread `hierarchical`ly after the run once the conversation of its branch passes `at` (default 0.8) of the window of the model the run ended on, keeping `keepRecentTokens` (default the less of 20000 and a quarter of the window, unless only `keepRecent` is set). `beforeCompact({ threadId, tokens, threshold })` can return `false` to skip it or `{ instructions }` to add to the summarizer's prompt, and `afterCompact(result)` gets the `CompactionResult`. A thread that outgrows its window again within two turns of its last compaction is not compacted again, with a warning to clear tool outputs (`context.clearToolOutputs`) instead, a run on another branch than the active one is left alone, and a compaction that fails is logged while the run keeps its result, and the thread is left alone for a minute, doubled after each failure in a row up to an hour. The summarizer's calls are counted in the run's costs and in the `usage` it returns, and they stop with the run's signal. `compact()` refuses `chapterTokens`, `chapterConcurrency`, `chaptersPerArc` and `arcsPerSaga` that are not whole numbers above 0 (`checkCompactionSettings`). It is the built-in middleware `cogitator:memory-compaction` (`memoryCompactionMiddleware`), and `MemoryCompactionConfigSchema` validates it in `@cogitator-ai/config`.
  - Run middleware gets an `afterRun({ result, model }, context)` hook (`RunEndEvent`), called once a run finished and its writes settled, before `run()` returns. It is not called for a run that failed or paused, and an error it throws is logged without failing the run, the next hook still running.
  - Core: `anthropicCompactionSummarizer({ model, client?, apiKey?, maxTokens? })` is a `SummarizeFn` that has Anthropic's compaction on request (`ANTHROPIC_COMPACTION_BETA`, `compact-2026-09-04`) write the answer, with the prompt as its instructions. The answer is parsed and checked like any other, and the signed block is not kept, so the conversation goes on with Cogitator's own summary on every model.
  - Channels: the gateway's summarizer asks the model and prompt each call names, falling back to `summaryModel` and `summaryPrompt`, then to the agent's model. `Gateway.compactAll()` compacts every thread served since the start and the thread of every stored session (unless `session.threadKey` is set), one at a time past those that fail, and `/compact all` with `RuntimeBuilder` calls it instead of compacting a thread named `all`.
  - Breaking: `RuntimeBuilder` (`cogitator up`) compacts chat threads with the `hierarchical` strategy, keeping about 4000 tokens (`keepRecentTokens`) of the newest turns verbatim, instead of the `summary` strategy that kept the 10 newest messages. A thread compacted before is read on: its old summary becomes one closed, unverified fact of the first chapter.

### Patch Changes

- Updated dependencies [[`99ceb01`](https://github.com/cogitator-ai/Cogitator-AI/commit/99ceb0107f7403fba0a95e31fd2d10b743144a03)]:
  - @cogitator-ai/types@0.53.0

## 0.18.0

### Minor Changes

- [#226](https://github.com/cogitator-ai/Cogitator-AI/pull/226) [`85d05b2`](https://github.com/cogitator-ai/Cogitator-AI/commit/85d05b20fe48738ee6ddcea83a043bb890b6d077) - A context is assembled by partitions and ordered for the prompt cache, and old tool outputs can be cleared before anything is summarized.

  - `ContextAssembler` shares a token budget among the partitions of a context (`ContextPartition`): `system`, `pinned`, `index`, `summaries`, `facts`, `recall`, `brief`, `recent` and `final`. Each has a `ContextPartitionBudget` (`share`, `required`). By default (`DEFAULT_PARTITIONS`) `system`, `pinned`, `index`, `summaries`, `brief` and `final` are required, `facts` takes 15%, `recall` 35% and `recent` the rest. Required partitions are fitted first, the others split what they leave by their shares, and what the shares cannot place goes to the partitions still short of room in fill order, `recent` last. The shares of the partitions that are not required add up to 1 at most, or the constructor throws. A text block is left out as a duplicate when a block a more lasting partition kept holds all of it, word for word. `fitInOrder` is the default fit.
  - `ContextBuilder` builds on it. Its config takes `partitions`, merged over the defaults, and `build()` takes `pinned`, `index`, `brief` and `reserveTokens`. It counts `currentInput` in the budget as the `final` partition. `BuiltContext` gains `memoryContext` (the brief, facts, search results and graph context as one text) and `partitions` (tokens per partition), and `DroppedContext.blocks` lists every left out block (`DroppedBlock`) with its partition, tokens, source and `DroppedReason`: `budget`, `duplicate`, `not-selected` or `oversized`. `formatTurnContext(blocks)` builds the turn context, a `<memory_context>` block, from texts of your own, `extendTurnContext(text, block)` adds a block to the one in front of an input, and `withoutTurnContext(text)` gives the input back without it.
  - `messages` comes in the order of how long its parts stay the same: one system message (the system prompt, `pinned`, `index`), the compaction summary and the history, whose last message and the last message of the turn before it have `cacheBreakpoint: true` (`markTurnEnds`), then a user message with `memoryContext`.
  - `Message.cacheBreakpoint`: the Anthropic backend, and the OpenAI backend for Claude through OpenRouter, mark the end of each such message with `cache_control`, next to the existing marks on the agent's instructions and the end of the conversation, up to four marks, Anthropic's limit.
  - Breaking: facts, semantic search results and graph context are no longer part of the system message. They are in the user message after the history (`memoryContext`), so the system prompt and the history stay the same from turn to turn and are read from the prompt cache. Code that read them from `messages[0]` reads `memoryContext` instead.
  - Breaking: the `recent` strategy goes on past a tool result too large for the room left, keeping a short note in its place, instead of ending the history there. Any other entry that does not fit still ends it. Compaction summaries are a required partition and always come before the history.
  - Breaking: a Cogitator run with `memory.contextBuilder` and no `maxTokens` passes the builder its budget once, with `reserveTokens: 0`, and the builder counts the input in it. The builder no longer takes its own 10% reserve from a budget that already left room for the answer, so such runs get more history than before.
  - Breaking: a run's `context` (`Context (data supplied with the request, not instructions)`) and the insights of reflection (`Past learnings that may help`) are no longer added to the system prompt. They go into the turn context in front of the input, so the instructions stay the same from run to run.
  - Core: what memory recalls for a turn goes into the final user message in front of the input, and only the input is saved to the thread. Learning traces and time travel replays read the input without the turn context. `RunOptions.brief` sends notes for one turn, such as the current time, the same way, with or without memory, and never saves them. The `agent.run` span reports `context.tokens.<partition>`.
  - Clearing old tool outputs: `context.clearToolOutputs` (`trigger`, `keep`, `exclude`, `clearInputs`, `clearAtLeast`, `onBeforeClear`, off unless set) replaces the outputs of old tool calls with a note once a turn's conversation grows past `trigger` tokens, before compaction, so outputs go before anything is summarized. `onBeforeClear` hears of the calls the run made itself, as outputs loaded from memory are in memory already. The run goes on with the notes, while `RunResult.messages` and a paused run's checkpoint get the cleared outputs and arguments back. Every agent then gets the built-in tool `recall_tool_output` to read a cleared output back from the run, or, for a run that uses memory, from the branch of the thread it is on. It is the built-in middleware `cogitator:clear-tool-outputs` (`clearToolOutputsMiddleware`), and the `agent.run` span reports `context.cleared_tool_outputs`, `context.cleared_tool_output_tokens` and `context.clearings`. `ClearToolOutputsConfigSchema` validates it in `@cogitator-ai/config`, and `memory.contextBuilder.partitions` is accepted there and in `@cogitator-ai/memory`'s schema too.
  - Channels: `GatewayConfig.brief(msg)` returns notes for the run of each message, passed as `RunOptions.brief`. `RuntimeBuilder` sends the current date and time this way instead of writing them into the instructions, so the instructions stay cacheable.

### Patch Changes

- Updated dependencies [[`85d05b2`](https://github.com/cogitator-ai/Cogitator-AI/commit/85d05b20fe48738ee6ddcea83a043bb890b6d077)]:
  - @cogitator-ai/types@0.52.0

## 0.17.6

### Patch Changes

- Updated dependencies [[`c46adb9`](https://github.com/cogitator-ai/Cogitator-AI/commit/c46adb9429ef9686697a020d4d97634c907117d0)]:
  - @cogitator-ai/types@0.51.0

## 0.17.5

### Patch Changes

- Updated dependencies [[`92bcc11`](https://github.com/cogitator-ai/Cogitator-AI/commit/92bcc119e71742eaf2a4a3bffdeceaa18b153e5d)]:
  - @cogitator-ai/types@0.50.0

## 0.17.4

### Patch Changes

- Updated dependencies [[`db16bbc`](https://github.com/cogitator-ai/Cogitator-AI/commit/db16bbc5f7c49b052382ea8dd4c0ba597216d913), [`db16bbc`](https://github.com/cogitator-ai/Cogitator-AI/commit/db16bbc5f7c49b052382ea8dd4c0ba597216d913)]:
  - @cogitator-ai/types@0.49.0

## 0.17.3

### Patch Changes

- Updated dependencies [[`b42f62e`](https://github.com/cogitator-ai/Cogitator-AI/commit/b42f62ecd300cd945c42a91014b1297bc4e10c43)]:
  - @cogitator-ai/types@0.48.0

## 0.17.2

### Patch Changes

- Updated dependencies [[`ed48837`](https://github.com/cogitator-ai/Cogitator-AI/commit/ed4883796a82b5f2b832a5bb45ba861fb0b17f45)]:
  - @cogitator-ai/types@0.47.0

## 0.17.1

### Patch Changes

- Updated dependencies [[`f68ebd8`](https://github.com/cogitator-ai/Cogitator-AI/commit/f68ebd892ee493279058212105381e8acb73b70e)]:
  - @cogitator-ai/types@0.46.0

## 0.17.0

### Minor Changes

- [#210](https://github.com/cogitator-ai/Cogitator-AI/pull/210) [`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b) - Agents can fall back to other models. `fallbackModels` on an agent lists models a turn moves to, in order, when its model fails in a way another model may not: the provider is down, overloaded or timing out after its retries, the account is out of quota, the key is rejected, the model is gone, the prompt does not fit its context window or its answer could not be read. Rate limits and server errors are still retried on the same model first (`llm.retry`), quota, authentication, permission and missing-model errors move at once, and `content_filter` and `invalid_request` failures, which another model would refuse as well, never move. An aborted run never moves either.

  Each model has a circuit breaker shared by the runtime's runs, `llm.modelCircuitBreaker` (`failureThreshold` 5, `resetTimeout` 30 000 ms, `halfOpenRequests` 3 by default, also accepted by `cogitator.yml` through `@cogitator-ai/config`): a model that keeps failing, or fails in a way that lasts, is skipped until its breaker lets a call through again. A prompt too long for a model and a call cut short by the run's abort or timeout do not count against it. Every turn starts from the agent's model, a stream moves only before its first token, a fallback turn is priced at the model that answered it, `onModelFallback` and an `llm.fallback` span report every move, and `RunResult.modelUsed` names the model of the final answer. When every model fails the run ends with their shared error code, or `LLM_UNAVAILABLE` when they failed differently, each failure in `details.attempts`. `fallbackModels` survives `agent.serialize()` (and `Agent.validateSnapshot` checks it) and the agent wire format.

  A turn the provider ends with `finishReason: 'error'` moves like an unreadable answer, its tokens still counted. A turn that moves to a model with a smaller context window than the agent's model gets its messages cut to fit that window: the system prompt and the newest messages stay, and no tool result loses its call.

  An agent without `fallbackModels` behaves exactly as before. New exports: `FallbackModel`, `ModelFallbackEvent`, `ModelCircuitBreakerConfig` and `ModelCircuitBreakerConfigSchema`.

### Patch Changes

- Updated dependencies [[`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b), [`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b), [`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b)]:
  - @cogitator-ai/types@0.45.0

## 0.16.1

### Patch Changes

- Updated dependencies [[`b5c11eb`](https://github.com/cogitator-ai/Cogitator-AI/commit/b5c11eb5368f52169273527c2ea6f16e83ab8b22)]:
  - @cogitator-ai/types@0.44.0

## 0.16.0

### Minor Changes

- [#205](https://github.com/cogitator-ai/Cogitator-AI/pull/205) [`8524d15`](https://github.com/cogitator-ai/Cogitator-AI/commit/8524d1557e03b856de9dd2ec9bccfce91ab74765) - Tool results gain two parts and a size cap.

  `toolContent()` takes `{ type: 'json', value }` for structured data, which the application gets as it is and the model reads as JSON, and `{ type: 'resource', uri, name?, description?, mediaType?, text?, data? }` for a file, document or page. With `text` the model reads the contents under a line naming the resource, with base64 `data` it reads a description and the application keeps the bytes, with neither it reads the line alone, as a link. The MCP adapter serves them as JSON text and embedded resources, and a text resource that comes back from an MCP server with media keeps its URI.

  The model reads at most `limits.maxToolResultLength` characters of a tool result, 100 000 by default (about 25 000 tokens), and a tool's own `maxResultLength` overrides it. A longer result keeps its start and end, with a note in the middle of how much was left out, and errors are cut the same way. `onToolResult` still gets the whole result, while `RunResult.messages` and the thread history keep what the model read. The config schema and `COGITATOR_LIMITS_MAX_TOOL_RESULT_LENGTH` set the limit.

  `isToolContentResult`, `toolResultParts`, `toolPartsToText`, `truncateToolResultText` and `DEFAULT_TOOL_RESULT_MAX_LENGTH` now live in `@cogitator-ai/types`, so packages that do not depend on core read results the same way. Core re-exports them, imports from core keep working.

  **Migration:**

  - A tool result over 100 000 characters used to reach the model whole and now arrives cut, and so does the tool message in `RunResult.messages` and in the saved thread history. Checkpoints and learning traces built from those messages hold what the model read as well. Read whole results in `onToolResult`. Set `limits.maxToolResultLength`, or `maxResultLength` on the tool, to a larger number where a model really needs all of it. Both must be positive integers, anything else throws, in `tool()`, the `Cogitator` constructor and `ToolRegistry.register()` for tools built without `tool()` (in code, `Infinity` turns the cut off).
  - `toolPartsToMessageContent(parts, maxLength?)` cuts at 100 000 characters unless given another `maxLength`. The text parts of a result with images are cut as one text: start and end kept, parts in between left out.
  - `ToolContentPart` has two new members, so an exhaustive `switch` over `part.type` needs cases for `json` and `resource`.
  - A result from an MCP server that mixes media with a text resource now holds a `resource` part (with the URI) where it held a `text` part. Code that keeps only `text` parts should take `resource` parts too.

### Patch Changes

- Updated dependencies [[`8524d15`](https://github.com/cogitator-ai/Cogitator-AI/commit/8524d1557e03b856de9dd2ec9bccfce91ab74765), [`8524d15`](https://github.com/cogitator-ai/Cogitator-AI/commit/8524d1557e03b856de9dd2ec9bccfce91ab74765)]:
  - @cogitator-ai/types@0.43.0

## 0.15.0

### Minor Changes

- [#202](https://github.com/cogitator-ai/Cogitator-AI/pull/202) [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd) - Model prices of your own and an offline catalogue. `llm.pricing` sets prices in USD per million tokens by model, for a fine-tune, a model newer than the catalogue or a negotiated rate: `pricing: { 'openai/gpt-4o': { input: 2, output: 8 } }`. A key matches the model string a run uses or its tail after any `/`: `openai/gpt-4o` prices that model string and the ones ending in it, such as `openrouter/openai/gpt-4o`, and `gpt-4o` the model at every provider that serves it under that name. These prices win over the model registry for run costs, cost-routing budgets, `estimateCost()`, Tree of Thoughts and `decide()`, and `Cogitator.pricer` exposes them.

  A call whose provider reports no cost and whose model has no price used to count as $0 without a word. It still counts as $0, and the runtime now warns once per model, naming the `llm.pricing` key that fixes it. Ollama and vLLM run on your own hardware, so their calls are free unless `llm.pricing` prices them, even when a reseller lists a model of the same name, and stay quiet. A call is priced by the provider it routes to, under the name it is registered by (`llm.backends.vllm` prices as `vllm/...`), and a model string without a provider by the provider it runs on, `cog.pricedModel(model)` says which.

  An Ollama or vLLM backend you register under a name of your own (`llm.backends.gpu2`) is free the same way.

  A catalogue model listed without a price is no longer priced at $0: it keeps its context window and capabilities, carries `priceUnknown: true`, and the price lookups answer `null`, so its calls warn like any model without a price. A listing with a price wins over one without when a name matches several, automatic model selection skips cloud models without a price, and file caches written by earlier versions are fetched again (offline, an older cache gives way to the bundled copy).

  `@cogitator-ai/models` ships a trimmed copy of the LiteLLM catalogue with its MIT notice (`LITELLM_SNAPSHOT`), the priced text and embedding models at a pinned LiteLLM commit named in `source`. The registry prices models from it when it can neither fetch the catalogue nor read its cache, and for lookups made before `initializeModels()`, where it used to know only the built-in models. Refresh it with `pnpm --filter @cogitator-ai/models snapshot`. `ModelPricer` prices by overrides of your own over the registry and `costOf` prices usage at a given `ModelPricing`.

- [#202](https://github.com/cogitator-ai/Cogitator-AI/pull/202) [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd) - OpenAI-compatible servers get only the request fields they understand. A server profile says which field takes the output token limit, whether streams ask for usage with `stream_options` and which `reasoning_effort` values the server takes. Set it with `profile` on `llm.providers.openai` or `llm.providers.vllm`, by preset name (`openai`, `generic`, `vllm`, `ollama`, `lmstudio`, `llamacpp`, `groq`, `together`, `deepseek`, `mistral`, `openrouter`) or field by field over a preset. An effort the server does not take is sent as the nearest one it does.

  The built-in providers use their own preset. Mistral rejects fields it does not know, so it no longer gets `stream_options` (its streams failed with 422) or efforts beyond `high`. DeepSeek gets `none`, `low`, `high` or `max`, Together `low`, `medium` or `high` and no `stream_options`, Groq `max_completion_tokens`. A server without a preset keeps the request it got before. The Responses API path of the official OpenAI provider follows the profile's `reasoningEffort` too.

- [#202](https://github.com/cogitator-ai/Cogitator-AI/pull/202) [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd) - Anthropic and Google take `baseUrl` and `headers`, for a gateway or proxy in front of the provider: `llm.providers.anthropic.baseUrl` (or `ANTHROPIC_BASE_URL`, `COGITATOR_ANTHROPIC_BASE_URL`) and `llm.providers.google.baseUrl` (or `COGITATOR_GOOGLE_BASE_URL`), the Gemini one with its API version, `https://generativelanguage.googleapis.com/v1beta` by default. `headers` also works for `openai`, `openrouter` (for example OpenRouter's `HTTP-Referer` and `X-Title`) and `vllm`, and Bedrock takes an `endpoint` for VPC endpoints and proxies.

### Patch Changes

- Updated dependencies [[`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd), [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd), [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd), [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd)]:
  - @cogitator-ai/types@0.42.0

## 0.14.2

### Patch Changes

- [#199](https://github.com/cogitator-ai/Cogitator-AI/pull/199) [`fd99224`](https://github.com/cogitator-ai/Cogitator-AI/commit/fd992243b89f3941f76c2acb607b59468a35480a) - Packages declare `"sideEffects": false`, so bundlers can leave out the modules an app does not use. None of them runs code at import time that depends on being kept. The repository URL in each package.json uses the `git+https` form npm expects.
- Updated dependencies [[`fd99224`](https://github.com/cogitator-ai/Cogitator-AI/commit/fd992243b89f3941f76c2acb607b59468a35480a)]:
  - @cogitator-ai/types@0.41.1

## 0.14.1

### Patch Changes

- Updated dependencies [[`9a31e38`](https://github.com/cogitator-ai/Cogitator-AI/commit/9a31e3897e0992061744bbcc5cf4075db2848b77), [`fba532a`](https://github.com/cogitator-ai/Cogitator-AI/commit/fba532a5fadc4d193f855c8aee0b44f48f9e0619)]:
  - @cogitator-ai/types@0.41.0

## 0.14.0

### Minor Changes

- [#155](https://github.com/cogitator-ai/Cogitator-AI/pull/155) [`6f09cc8`](https://github.com/cogitator-ai/Cogitator-AI/commit/6f09cc8b941ea02fd8dff1cc2f28c16b22783292) - Decision models and OpenRouter as a built-in provider.

  - `cog.decide()` asks a decision model typed questions about a state and returns typed answers with probabilities instead of text: `noul` for yes or no, `choice` for one of several options, `score` for a level on a scale. Answers are typed by the questions, the request is checked before the call and the answer after it, and the call goes through the LLM retry policy, is checked against cost-routing budgets before it is sent, goes through `security.pii` masking or blocking, is priced and is reported to run observers as a run with one `llm.decide` span.
  - `decisionTool()` turns fixed questions into a tool an agent passes the state to.
  - OpenRouter's Decisions API is built in, with TypeSafe's Jev (`openrouter/typesafe/jev-1.13`). Other providers plug in through `llm.decisionBackends` and the `DecisionBackend` interface.
  - OpenRouter is a built-in provider for chat too: `llm.providers.openrouter` with `apiKey` and an optional `baseUrl`, or `OPENROUTER_API_KEY` through `@cogitator-ai/config`.
  - A chat run on a decision model fails at once with `CONFIGURATION_ERROR` instead of a provider error.
  - `LLMRetryPolicy` and `retryLLMCall` give calls that are not chat the retry policy of LLM backends.
  - `@cogitator-ai/models` knows Jev with its price, marks models with `kind: 'chat' | 'decision'` and adds `isDecisionModel()`.
  - Studio shows `llm.decide` spans.

  **Breaking:** a model string starting with `openrouter/` now runs on the OpenRouter provider. Before, the prefix stayed part of the model name on `llm.defaultProvider`.

### Patch Changes

- Updated dependencies [[`6f09cc8`](https://github.com/cogitator-ai/Cogitator-AI/commit/6f09cc8b941ea02fd8dff1cc2f28c16b22783292), [`6f09cc8`](https://github.com/cogitator-ai/Cogitator-AI/commit/6f09cc8b941ea02fd8dff1cc2f28c16b22783292)]:
  - @cogitator-ai/types@0.40.0

## 0.13.0

### Minor Changes

- [#149](https://github.com/cogitator-ai/Cogitator-AI/pull/149) [`82aeef6`](https://github.com/cogitator-ai/Cogitator-AI/commit/82aeef692bf1d08a6b9c21adc3fdcd5437f8285e) - A model call that hangs no longer eats the whole run. `llm.retry.requestTimeout` sets how long one call may take: a call with no answer by then is aborted and retried like a dropped connection, as a retryable `LLM_TIMEOUT`, and a stream gets that long for each chunk (a stream that stalls after its first chunk fails, as any broken stream does). Before, a request the provider never answered waited for the SDK's own timeout, ten minutes for OpenAI-compatible servers, so a run with a shorter `timeout` failed without a retry while other calls to the same model answered in seconds. It is off by default, and YAML configs take it as `llm.retry.requestTimeout`.

### Patch Changes

- Updated dependencies [[`82aeef6`](https://github.com/cogitator-ai/Cogitator-AI/commit/82aeef692bf1d08a6b9c21adc3fdcd5437f8285e), [`82aeef6`](https://github.com/cogitator-ai/Cogitator-AI/commit/82aeef692bf1d08a6b9c21adc3fdcd5437f8285e)]:
  - @cogitator-ai/types@0.39.0

## 0.12.2

### Patch Changes

- [#144](https://github.com/cogitator-ai/Cogitator-AI/pull/144) [`d1a874c`](https://github.com/cogitator-ai/Cogitator-AI/commit/d1a874ce75b702eea77ca2a24945f383e8b63198) - Prompt caching for Claude shares the system prompt between runs and reaches Claude through OpenRouter.

  Anthropic requests now mark the end of the agent's instructions at the start of the system prompt, so runs with different input, such as single-turn runs that share only their instructions, read those from the cache instead of writing them again. The top-level mark on the end of the conversation is set only when another turn is likely (the request offers tools or continues earlier turns), since a single turn with unique input only paid the cache write premium on it. `llm.promptCache.conversation` overrides that choice, and `ChatRequest.cachePrefix` names the stable start of a request's system prompt.

  An `OpenAIBackend` for OpenRouter (`provider: 'openrouter'` or an `openrouter.ai` base URL) marks `anthropic/*` models the same way, where before it sent no marks and Claude never cached. Its usage reports OpenRouter's `cache_write_tokens` as `cacheWriteTokens`. Other OpenAI-compatible servers and models are left unmarked.

- Updated dependencies [[`d1a874c`](https://github.com/cogitator-ai/Cogitator-AI/commit/d1a874ce75b702eea77ca2a24945f383e8b63198)]:
  - @cogitator-ai/types@0.38.0

## 0.12.1

### Patch Changes

- Updated dependencies [[`95d5866`](https://github.com/cogitator-ai/Cogitator-AI/commit/95d58666629772419cf200daf120542cbe9289fa)]:
  - @cogitator-ai/types@0.37.0

## 0.12.0

### Minor Changes

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - Bedrock works with temporary AWS credentials again. `loadConfig` no longer copies `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into `llm.providers.bedrock`, where they replaced the SDK credential chain without the session token and STS, SSO or CI role credentials failed with `UnrecognizedClientException`. The AWS SDK now resolves them itself, together with `AWS_SESSION_TOKEN` and `AWS_PROFILE`. Static credentials come only from `COGITATOR_BEDROCK_*` or `llm.providers.bedrock`, which gains `sessionToken` and `profile` (also `COGITATOR_BEDROCK_SESSION_TOKEN` and `COGITATOR_BEDROCK_PROFILE`), and `BedrockBackend` sends them to the SDK.

  `PROVIDER_ENV` in `@cogitator-ai/config` lists the environment of every built-in provider, and `resolveModelRoute()` in `@cogitator-ai/types` is the one rule for which provider a model string runs on, used by the runtime and by `cogitator deploy`.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - `cogitator deploy` tells servers from workers. `deploy.kind` is `server` (answers HTTP, gets a health check, may scale to zero on Fly) or `worker` (a channel gateway or queue worker: no health check, a port only when one is set, never stopped by the Fly proxy), detected from the project's dependencies. A project that is neither, such as a script that exits after one call, fails preflight instead of being restarted forever. Tetsu and Next.js join the detected servers, with `/health` as the Tetsu health path, and a server whose health path is unknown gets no failing health check.

  Preflight now starts with project checks every target shares: a missing `package.json` (a `cogitator wizard` assistant runs with `cogitator up`), an unknown project kind, a `start` script that loads `.env` with `--env-file` (the file stays out of the image, use `--env-file-if-exists`), and a project whose `.env` holds variables while no secrets were detected. On Docker, a deploy only succeeds when the app container keeps running for a few seconds after it starts, otherwise it fails with the container's last log lines.

  A SQLite memory keeps its database directory on a Docker named volume or a Fly volume (`deploy.volumes`, created on the first Fly deploy), and the directory stays out of the image. A local Ollama on the docker target is reached on the host through `host.docker.internal` (`deploy.hostGateway`). On Fly, Redis and Postgres are no longer silently dropped: `REDIS_URL` and `DATABASE_URL` become required secrets.

  Secrets follow the runtime: the provider is resolved the way the runtime routes the model (`meta-llama/...` on Together needs `TOGETHER_API_KEY`), Azure needs its endpoint, Bedrock a region, an alias such as `GEMINI_API_KEY` is passed when it is the one set, and values written in `llm.providers` count as provided. Names passed to `requireEnv('NAME')` in `src/` and set variables of `.env.example` are detected too.

  The Dockerfile copies `pnpm-workspace.yaml`, `.npmrc`, `patches/` and the other files the install step reads before it runs, so pnpm's `allowBuilds`, overrides, patches and private registries apply in the image. Yarn Berry installs with `--immutable` (and `workspaces focus` for production on Yarn 4), and Bun projects build on `oven/bun:1-alpine` and start with `bun run start`.

  `DeployOptions` gains `configPath` (the file `cogitator deploy -c` passes, read for the model, memory and deploy section alike) and `env`, `status` and `destroy` take `{ configPath }`, and `PackageManager` gains `yarn-berry` and `bun`.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - `OLLAMA_HOST`, `OLLAMA_URL` and the new `OLLAMA_BASE_URL` are read the way Ollama reads `OLLAMA_HOST`. `OLLAMA_HOST=0.0.0.0`, set so `ollama serve` listens on every interface, used to send every call to port 80 and fail with `ECONNREFUSED`. Now a value without a scheme gets port 11434 and a wildcard address is reached as `localhost`, in `loadConfig` and in the CLI alike (`resolveOllamaHost()`). These variables also no longer replace an explicit `llm.providers.ollama.baseUrl` from cogitator.yml, they apply only when the file sets none (`loadEnvDefaults()`), while `COGITATOR_OLLAMA_BASE_URL` still overrides it. `loadEnvConfig()` therefore no longer returns them.

  `loadConfig` looks for `cogitator.yml`, `cogitator.yaml`, `.cogitator.yml` and `.cogitator.yaml` in that order, the same order `cogitator run` and `cogitator deploy` use (`findConfigFile()`).

### Patch Changes

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - CommonJS consumers can load the packages again. The exports maps only had an `import` condition, so `require('@cogitator-ai/core')` from NestJS, Jest in CommonJS mode or a script outside `"type": "module"` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`, although Node 22.12+ can `require()` these ES modules. Every entry now ends with a `default` condition pointing at the same file.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - Trailing slashes of base paths and URLs (A2A server and client, `OLLAMA_HOST`, the vector search Ollama URL, the scaffolder's Ollama URL, deploy volume names and paths) are trimmed with a loop instead of `replace(/\/+$/, '')`. That pattern backtracks in quadratic time, so a value with a long run of slashes followed by any other character took seconds to process.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - `PostgresAdapter` checks the vector size of an existing `embeddings` table on `connect()`. An adapter without a configured size adopts it, and one configured for another size (after switching the embedding model) reports the mismatch through `vectorStatus()` and a clear failure from `addEmbedding` and `search` instead of a Postgres error on each search. The size can now be set with `dimensions` in `PostgresAdapterConfig` and `memory.postgres.dimensions`, as well as `setVectorDimensions()`.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - `PostgresAdapter` connects to Postgres without pgvector. Before, the `CREATE TABLE ... vector(N)` that followed a failed `CREATE EXTENSION` failed `connect()`, so memory was off entirely even for users who only need threads. Threads, entries and facts now work on any Postgres, embedding operations return a failed result naming the reason, and the new `vectorStatus()` tells whether vectors are usable. The runtime does not use such a store for semantic context and logs why.

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - Reasoning models get the parameters they accept on Chat Completions too. `azure/gpt-5` with `maxTokens` sent `{ temperature: 0.7, max_tokens: 500 }` and Azure rejected every call, and `openai/gpt-5` with stop sequences or `api: 'chat-completions'` sent the agent's default temperature. Reasoning models (o-series, GPT-5 and later) now get no `temperature` / `top_p` and their limit as `max_completion_tokens`. Azure tells them by the deployment name or by the new `providers.azure.model` when the name is your own, and its default `apiVersion` is now `2025-04-01-preview`, the first that serves these models.
- Updated dependencies [[`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281)]:
  - @cogitator-ai/types@0.36.0

## 0.11.8

### Patch Changes

- Updated dependencies [[`151d675`](https://github.com/cogitator-ai/Cogitator-AI/commit/151d6758803e4f01f79bb1546784010aa702493e)]:
  - @cogitator-ai/types@0.35.0

## 0.11.7

### Patch Changes

- Updated dependencies [[`3750d25`](https://github.com/cogitator-ai/Cogitator-AI/commit/3750d2597c58c2aa7654a1d842f28489d29dc774)]:
  - @cogitator-ai/types@0.34.0

## 0.11.6

### Patch Changes

- Updated dependencies [[`561f0be`](https://github.com/cogitator-ai/Cogitator-AI/commit/561f0beb7c33c9f1fb214c2bc205a5f2f9347af2)]:
  - @cogitator-ai/types@0.33.2

## 0.11.5

### Patch Changes

- [#117](https://github.com/cogitator-ai/Cogitator-AI/pull/117) [`0caa714`](https://github.com/cogitator-ai/Cogitator-AI/commit/0caa714e0d52b0effb983f63c5edca499a22235b) - npm keywords for every package, so a search for what a package does finds it, and packages are now published with provenance: npm shows that each version was built and signed by the repository's release workflow, from which commit.
- Updated dependencies [[`0caa714`](https://github.com/cogitator-ai/Cogitator-AI/commit/0caa714e0d52b0effb983f63c5edca499a22235b)]:
  - @cogitator-ai/types@0.33.1

## 0.11.4

### Patch Changes

- Updated dependencies [[`7886808`](https://github.com/cogitator-ai/Cogitator-AI/commit/7886808f11282b2d3a0c6820ba593417865f9139)]:
  - @cogitator-ai/types@0.33.0

## 0.11.3

### Patch Changes

- Updated dependencies [[`77087fc`](https://github.com/cogitator-ai/Cogitator-AI/commit/77087fc85bc28235ec36bf39b90da8bc138d0e80)]:
  - @cogitator-ai/types@0.32.0

## 0.11.2

### Patch Changes

- [#110](https://github.com/cogitator-ai/Cogitator-AI/pull/110) [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406) - Close the code scanning findings that were real. `webScrape` reads HTML with a linear tokenizer instead of chained regular expressions, so a hostile page can no longer block the event loop (200 KB of unclosed tags took over 20 seconds). It decodes each entity once (an escaped `&amp;lt;` no longer turns into `<`), treats `script` and `style` content as raw text the way browsers do, keeps a `>` inside a quoted attribute in its tag, matches `.class` selectors by class name and nested elements by depth, puts multi-line link text on one line, and drops `javascript:`, `data:` and `vbscript:` links in any letter case. A run or swarm timeout beyond what a timer can hold (about 24.8 days) no longer aborts the run at once, and the HTTP adapters refuse such a swarm `timeout` with 400. The `random_string` tool picks characters without modulo bias. Regular expressions that ran in polynomial time on crafted input (env interpolation, JSON fences, model ids, the injection classifier, the knowledge graph query tokenizer and others) are now linear. The a2a error log passes its context as an argument instead of building the format string from it.
- Updated dependencies [[`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406)]:
  - @cogitator-ai/types@0.31.0

## 0.11.1

### Patch Changes

- Updated dependencies [[`063ee72`](https://github.com/cogitator-ai/Cogitator-AI/commit/063ee7289ebb670da69951b93843652bbf0465b2)]:
  - @cogitator-ai/types@0.30.0

## 0.11.0

### Minor Changes

- 8bcf914: The config schema silently dropped runtime options it did not know. YAML and `defineConfig` now keep `sandbox.allowNativeFallback`, `sandbox.pool.reuseContainers`, sandbox `defaults` mounts/env/WASM fields, embedding `dimensions` (and the Google `baseUrl`), every `contextBuilder.graphContextOptions` field, prompt injection `patterns` and `failMode`, `guardrails.constitution`, `llm.plugins` and `prompts.autoDeployWinner`.

### Patch Changes

- Updated dependencies [9175c69]
- Updated dependencies [e70e482]
- Updated dependencies [8d520c0]
- Updated dependencies [1993d56]
- Updated dependencies [c117071]
- Updated dependencies [b8c9eca]
- Updated dependencies [9175c69]
- Updated dependencies [db2e373]
- Updated dependencies [e2da4f9]
- Updated dependencies [e2da4f9]
- Updated dependencies [e2da4f9]
- Updated dependencies [6b7e672]
- Updated dependencies [ae26101]
  - @cogitator-ai/types@0.29.0

## 0.10.1

### Patch Changes

- Updated dependencies [0ef09fc]
- Updated dependencies [6b16db1]
- Updated dependencies [57ac053]
- Updated dependencies [b8c7c3d]
- Updated dependencies [35701f9]
  - @cogitator-ai/types@0.28.0

## 0.10.0

### Minor Changes

- 0933009: Personal data stays away from the model provider. `security.pii` replaces emails, phone numbers, card numbers (Luhn-checked), IBANs (mod-97), SSNs, IP addresses, API keys and your own patterns with placeholders such as `[EMAIL_1]` in every LLM request. In `mask` mode the answer, its stream and tool call arguments get the real values back, so tools still act on the real address; `redact` keeps the placeholders everywhere, and `block` rejects such input with `PII_DETECTED`. `onDetect` receives counts per kind for audit logs, never the values. `PiiMasker`, `PiiVault` and `withPiiMasking` are exported for use outside a run, and YAML config accepts custom patterns as strings.
- 7bee3ef: Reasoning models and prompt caching work the same way on every provider.

  - **Reasoning.** `reasoning: { effort, budgetTokens?, summary? }` on an agent, a run or a `ChatRequest` (`effort` from `none` to `max`). Anthropic and Bedrock get adaptive thinking with the closest effort the Claude model accepts (`disabled` / `between_tools` / lowest effort for `none`, a thinking budget on Claude 3.7 – 4.5); OpenAI gets `reasoning.effort` and summaries; OpenAI-compatible servers `reasoning_effort`; Gemini `thinkingLevel` (3+) or `thinkingBudget` (2.5) with `includeThoughts`; Ollama `think`. The summary comes back as `ChatResponse.reasoning` / `delta.reasoning`, `RunResult.reasoning` and `onReasoning`; server adapters, Next.js handlers and hooks, and the AI SDK adapter stream it as `reasoning-start` / `reasoning-delta` / `reasoning-end` parts.
  - **Thinking across tool calls.** Claude thinking blocks (Anthropic and Bedrock) are kept with the tool calls they preceded and sent back during the tool loop — only after the latest user message, since they are bound to the conversation that produced them — and a request whose replayed blocks the API refuses is retried once without them.
  - **Prompt caching.** Agent runs cache by default (`llm.promptCache`, `false` turns it off): Anthropic requests carry `cache_control`, Bedrock requests cache points; every backend reports `usage.cachedInputTokens` / `cacheWriteTokens` / `reasoningTokens`. `@cogitator-ai/models` prices cache reads and writes (`inputCached`, new `inputCacheWrite`, `calculateCost()`), so run costs account for them.

  **Fixes:** Anthropic and Bedrock `inputTokens` now include cache reads and writes (they counted only uncached input); Gemini `outputTokens` now include thinking tokens (`thoughtsTokenCount`), which were billed but not counted.

### Patch Changes

- Updated dependencies [0933009]
- Updated dependencies [0933009]
- Updated dependencies [0933009]
- Updated dependencies [7bee3ef]
- Updated dependencies [7bee3ef]
- Updated dependencies [4964fb6]
  - @cogitator-ai/types@0.27.0

## 0.9.0

### Minor Changes

- 9ff5a06: Agent runs retry failed LLM calls instead of failing on the first 429 or 5xx.

  - New `llm.retry` (`maxRetries` 2, `baseDelay` 1000, `maxDelay` 30000, `maxRetryAfter` 60000, `onRetry`; `false` turns it off) applies to every backend the runtime uses, `llm.backends` and plugins included. Only retryable errors are retried: rate limits, 5xx, timeouts, dropped connections.
  - A provider's wait is honoured: `retry-after`, `retry-after-ms`, an HTTP date or Gemini's `RetryInfo.retryDelay`. A wait longer than `maxRetryAfter` fails the call at once.
  - Streams are retried only before their first chunk; the run's timeout and abort signal stop the waits.
  - `withLLMRetry(backend, config)` / `RetryingBackend` give a standalone backend the same behaviour; `retryAfterFromHeaders` is exported.

  **Behaviour changes:** backends created by `createLLMBackend` no longer retry inside the OpenAI, Anthropic, Azure and Bedrock SDKs (new `maxRetries` backend option, the runtime passes 0), so attempts never multiply — wrap such a backend with `withLLMRetry` when using it on its own. `LLMError.retryAfter` now holds only a wait the provider asked for; it is `undefined` instead of an invented 60 s (429), 5 s (5xx) or 1 s otherwise. `cogitator.route()` returns the retrying wrapper unless `llm.retry` is `false`.

### Patch Changes

- Updated dependencies [9ff5a06]
- Updated dependencies [ed996c4]
  - @cogitator-ai/types@0.26.0

## 0.8.0

### Minor Changes

- f134b01: Config keys that did nothing now either work or are gone.

  - `reflection.reflectAfterError` works: a failed tool call gets the error reflection (`ReflectionEngine.reflectOnError`), and its suggestion reaches the next model call.
  - `TimeTravelConfig.maxCheckpointsPerTrace` and `checkpointRetention` are enforced when `TimeTravel` saves checkpoints.

  **Breaking (types):** removed keys nothing read — `CogitatorConfig.knowledgeGraph` and `promptOptimization` (the knowledge-graph and prompt-optimization classes keep their own config types), `ContextManagerConfig.windowOverlap`, `TimeTravelConfig.autoCheckpoint` / `autoCheckpointInterval`, `ReplayOptions.onStep` / `pauseAt`, and `CompileOptions.teacherModel` / `verbose`. The YAML schema drops the same keys.

- c1cd7a1: Guardrails take partial configs and keep the revisions they produce.

  - `CogitatorConfig.guardrails` and `security.promptInjection` are `Partial<…>`: fields left out take the defaults, as the runtime always merged them. The YAML schema accepts partial blocks too (`thresholds` may name some categories).
  - Guardrails are on when configured, unless `enabled: false`, matching `DEFAULT_GUARDRAIL_CONFIG`. The run checks the merged config: a partial config such as `{ enabled: true }` filtered nothing before.
  - When the output filter blocked an answer and the critique-revise loop produced a safe one, `filterOutput()` returned `allowed: true` with the revision, so the run kept the original harmful text and the violation was never logged. It now returns the block with `suggestedRevision`, the run answers with the revision, and the violation reaches the log and `onViolation`.
  - `filterToolResults` is implemented: tool results pass the input filter before the model reads them (`ConstitutionalAI.filterToolResult()`).

### Patch Changes

- Updated dependencies [c4a4252]
- Updated dependencies [f134b01]
- Updated dependencies [6404340]
- Updated dependencies [c1cd7a1]
- Updated dependencies [f36a121]
  - @cogitator-ai/types@0.25.0

## 0.7.0

### Minor Changes

- `providers.openai.api` (`responses` | `chat-completions`) is accepted in YAML config.
- **Breaking:** requires Node.js 22.12 or newer (Node 20 reached end of life).

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.24.0

## 0.6.0

### Minor Changes

- The documented `${VAR}` references in cogitator.yml were never interpolated: a literal '${OPENAI_API_KEY}' was sent as the API key. ${VAR}, ${VAR:-default}, ${VAR-default} and $$ are now implemented and exported. OLLAMA_API_KEY in the environment overrode a YAML Ollama baseUrl with https://ollama.com; the schema now applies the Ollama default after merging. OLLAMA_URL is now supported, OLLAMA_HOST without a scheme is normalised, and GEMINI_API_KEY is accepted as a Google alias. YAML whose top level is not a mapping was merged as garbage; it now fails with the file path. Prototype keys are skipped during merge. Validation errors are formatted with z.prettifyError. Port and integer fields are validated. The DeployTarget enum is narrowed to docker|fly. Added a shared parseDotenv/loadDotenvFile, now used by the CLI and deploy; a round-trip test caught an escaped-quote bug in it, now fixed. Removed the bogus typescript peerDependency. Fixed an env-dependent flaky test.

  **Breaking changes**
  - The env layer no longer sets the Ollama baseUrl when only OLLAMA_API_KEY is set. The default is applied after merging, so a YAML baseUrl now wins (previously env forced https://ollama.com).
  - ProvidersConfigSchema.ollama input `baseUrl` is now optional; output still always has baseUrl.
  - DeployTargetSchema is narrowed to 'docker' | 'fly'.
  - deploy.port must be an integer in 1-65535. instances, maxConcurrentRuns and maxTokensPerRun must be integers.
  - YAML strings containing `${...}` or `$$` are now interpolated.
  - loadYamlConfig throws for non-mapping files and includes the path in parse errors.

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.23.0

## 0.5.6

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.22.3

## 0.5.5

### Patch Changes

- Republish packages with resolved internal dependency versions so npm installs do not receive workspace protocol dependencies.

## 0.5.4

### Patch Changes

- Publish audit hardening fixes for provider configuration, model registry data, core runtime behavior, shared runtime types, and channel delivery reliability.
- Updated dependencies
  - @cogitator-ai/types@0.22.2

## 0.5.3

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.22.1

## 0.5.2

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.21.3

## 0.5.1

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.21.1

## 0.4.0

### Minor Changes

- Add one-command deployment engine (`cogitator deploy`)
  - New deploy types: `DeployTarget`, `DeployConfig`, `DeployResult`, `DeployPlan`
  - Deploy section in `cogitator.yml` schema with target, port, region, instances, registry, services, secrets
  - CLI `deploy` command with `--target`, `--dry-run`, `--push`, `status`, and `destroy` subcommands

- Add Ollama Cloud support with API key authentication
  - `apiKey` field in `OllamaProviderConfig` for cloud authentication
  - `OLLAMA_API_KEY` env variable auto-detection with default base URL `https://ollama.com`
  - `Authorization: Bearer` header in OllamaBackend when API key is configured

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @cogitator-ai/types@0.20.0

## 0.3.13

### Patch Changes

- fix: update repository URLs for GitHub Packages linking
- Updated dependencies
  - @cogitator-ai/types@0.19.2

## 0.3.12

### Patch Changes

- Configure GitHub Packages publishing
  - Add GitHub Packages registry configuration to all packages
  - Add integration tests for LLM backends (OpenAI, Anthropic, Google, Ollama)
  - Add comprehensive context-manager tests

- Updated dependencies
  - @cogitator-ai/types@0.19.1

## 0.3.11

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.19.0

## 0.3.10

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.18.0

## 0.3.9

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.17.0

## 0.3.8

### Patch Changes

- Updated dependencies [6b09d54]
  - @cogitator-ai/types@0.16.0

## 0.3.7

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.15.0

## 0.3.6

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.14.0

## 0.3.5

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.13.0

## 0.3.4

### Patch Changes

- docs: sync package READMEs with main documentation

## 0.3.3

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.12.0

## 0.3.2

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.11.0

## 0.3.1

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.10.1

## 0.3.0

### Minor Changes

- DX Improvements - Phases 1-3

  Phase 1: Foundation
  - Added comprehensive JSDoc documentation to core public APIs
  - Extended config schema with memory, sandbox, reflection, guardrails, costRouting, logging

  Phase 2: Critical Fixes
  - ThreadManager: Added persistent storage with InMemoryThreadStorage, RedisThreadStorage, PostgresThreadStorage
  - SSE Streaming: EventEmitter-based real-time streaming for openai-compat
  - MCP Retry: Exponential backoff with auto-reconnect and connection recovery

  Phase 3: Polish
  - New examples: memory-persistence, openai-compat-server, mcp-integration, constitutional-guardrails

## 0.2.8

### Patch Changes

- Updated dependencies [58a7271]
  - @cogitator-ai/types@0.10.0

## 0.2.7

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.9.0

## 0.2.6

### Patch Changes

- Updated dependencies [faed1e7]
  - @cogitator-ai/types@0.8.1

## 0.2.5

### Patch Changes

- Updated dependencies [70679b8]
- Updated dependencies [2f599f0]
- Updated dependencies [10956ae]
- Updated dependencies [218d91f]
  - @cogitator-ai/types@0.8.0

## 0.2.4

### Patch Changes

- Updated dependencies [a7c2b43]
  - @cogitator-ai/types@0.7.0

## 0.2.3

### Patch Changes

- Updated dependencies [f874e69]
  - @cogitator-ai/types@0.6.0

## 0.2.2

### Patch Changes

- Updated dependencies
- Updated dependencies [05de0f1]
- Updated dependencies [fb21b64]
- Updated dependencies [05de0f1]
  - @cogitator-ai/types@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.4.0

## 0.2.0

### Minor Changes

- Add YAML loader tests (file not found, parsing, default paths)
- Add config merge tests (priority order, deep merge, validation)
- Fix unsafe type cast for LLM provider validation
- Fix parseInt edge case (stricter number parsing with regex)

## 0.1.1

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.2.0
