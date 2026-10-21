# @cogitator-ai/test-utils

## 0.5.0

### Minor Changes

- [#224](https://github.com/cogitator-ai/Cogitator-AI/pull/224) [`92bcc11`](https://github.com/cogitator-ai/Cogitator-AI/commit/92bcc119e71742eaf2a4a3bffdeceaa18b153e5d) - Every message and document is embedded once.

  - `MessageIndex` keeps a vector per history entry in an embedding store (`sourceType: 'message'`). Attached to an adapter it embeds new user and assistant entries in the background, in batches, and deletes vectors with their entries and threads. `ContextBuilder` takes it as `messageIndex`: `relevant` and `hybrid` then embed only the input, read kept vectors for the newest entries and find older ones of the thread with a search of the store, so recall is no longer limited to the newest 200 entries. The `Cogitator` runtime sets one up for `relevant` and `hybrid` when `memory.embedding` and an embedding store are configured (the in-process `memory` adapter keeps vectors in process as before), and `close()` waits for its work. History written before the index is indexed in the background the first time a thread is built.
  - `MemoryAdapter.onChange(listener)` reports `entry-added`, `entry-deleted`, `thread-cleared` and `thread-deleted` once stored. Every built-in adapter implements it through the new `ChangeReportingMemoryAdapter` base, which adapters of your own can extend. Redis reports threads and entries it expired once a later write or read finds them gone, and its thread index now outlives threads by seven lifetimes for that.
  - Message vectors are marked `metadata.index: 'messages'` and carry the thread's `agentId` and `userId`, so user filters on a shared store leave out other users' messages.
  - `EmbeddingAdapter.getBySources(ids)` reads embeddings with their vectors by source, `replaceBySource(embedding)` stores one as the only embedding of its source atomically (so indexes of several processes leave one vector per message), and `SearchFilter.sourceTypes` takes a list of source types. Every built-in store implements all three, stores of your own keep working without them. Semantic context now searches only facts and documents: embeddings stored as `sourceType: 'message'` no longer show up in it.
  - With `relevant` or `hybrid`, the runtime now writes message vectors into `memory.qdrant` (and the Postgres store), so a read-only Qdrant key needs write access.
  - RAG: `ingest()` skips a source whose documents, chunker and embedding model did not change, and reports them as `unchanged`. A changed source is written as a new generation before the previous one is deleted, so it is never missing from queries, and its unchanged documents keep their vectors. The first chunk of each document is written last, so an ingest that stopped is finished by the next one. Chunkers get an optional `fingerprint`, which the built-in ones have and a source needs to be skipped. A local keyword index is filled from the store for skipped sources. Chunks carry `ragContentHash`, `ragGeneration` and `ragSourceDocuments`. Chunks stored by earlier versions are replaced once as before.
  - Postgres: vectors of 2001 to 4000 dimensions get an HNSW index on their `halfvec` cast (pgvector 0.7+) instead of none, in the memory store and both knowledge graph adapters. The memory schema version is recorded in `<schema>.cogitator_schema_migrations`, and `connect()` changes tables only when it is older or they are gone. Processes connecting at once take turns under a lock on the schema instead of failing on the same `CREATE`, in one transaction, so it also holds behind a pooler in transaction mode. A table of 2001 to 4000 dimensions from before gets its index on the first connect, which on a large table takes a while: build it ahead with `CREATE INDEX CONCURRENTLY idx_embeddings_vector ON <schema>.embeddings USING hnsw ((vector::halfvec(<n>)) halfvec_cosine_ops)`. New indexes on `embeddings(source_id)` and `metadata->>'threadId'`. Qdrant gets payload indexes on `sourceId`, `sourceType` and `metadata.threadId`.
  - `@cogitator-ai/test-utils`: conformance cases `reports-changes` and `get-by-sources`, and source type lists in `filters`.

### Patch Changes

- Updated dependencies [[`92bcc11`](https://github.com/cogitator-ai/Cogitator-AI/commit/92bcc119e71742eaf2a4a3bffdeceaa18b153e5d)]:
  - @cogitator-ai/types@0.50.0

## 0.4.0

### Minor Changes

- [#223](https://github.com/cogitator-ai/Cogitator-AI/pull/223) [`db16bbc`](https://github.com/cogitator-ai/Cogitator-AI/commit/db16bbc5f7c49b052382ea8dd4c0ba597216d913) - Memory adapters share one contract, checked by a conformance suite, and threads can be listed.

  - `MemoryAdapter.listThreads(options)` pages through threads by update time, filtered by agent, metadata values (compared by type) and update time, with an opaque cursor. Every built-in adapter implements it in the database: Redis keeps an index of threads by update time and adds threads written by earlier versions to it the first time threads are listed. Adapters of your own need to implement it.
  - Every adapter now keeps the same contract: `addEntry` into a thread that does not exist fails (InMemory, Redis and MongoDB used to store an orphan entry), `updateThread` is atomic under concurrent calls (SQLite, Redis and MongoDB could lose an update), entries with one `createdAt` come back in the order they were added, a negative or fractional `getEntries` limit fails, `createThread` with an empty id fails, a field that was never set comes back absent instead of `null` (Postgres), and InMemory returns copies instead of the objects it stores.
  - `SessionManager.list()` finds sessions with `listThreads` and no longer keeps an index thread. `indexRefreshInterval` is deprecated and ignored.
  - `@cogitator-ai/test-utils` ships `memoryAdapterConformanceCases` and `embeddingAdapterConformanceCases`, framework-agnostic suites that check an adapter or embedding store against this contract. `MockMemoryAdapter` implements `listThreads`.
  - `RedisClient` gains `eval(script, numKeys, ...args)`, run on prefixed keys.

  Upgrading a database that already holds data:

  - Postgres builds its new indexes on `threads` (agent and update time, update time alone, a GIN index on `metadata`) when the adapter connects, which blocks writes to `threads` while each one builds. On a large table create them first with `CREATE INDEX CONCURRENTLY` under the same names (`idx_threads_agent_updated`, `idx_threads_updated`, `idx_threads_metadata`) so connecting finds them in place. The new `entries.seq` column is added without rewriting the table: entries written before it keep their order by `createdAt`.
  - MongoDB filters on metadata keys that contain a dot with `$getField`, which needs MongoDB 5.0 or later.
  - Redis lists threads through an index it fills the first time threads are listed, and again when the index is gone.

### Patch Changes

- Updated dependencies [[`db16bbc`](https://github.com/cogitator-ai/Cogitator-AI/commit/db16bbc5f7c49b052382ea8dd4c0ba597216d913), [`db16bbc`](https://github.com/cogitator-ai/Cogitator-AI/commit/db16bbc5f7c49b052382ea8dd4c0ba597216d913)]:
  - @cogitator-ai/types@0.49.0

## 0.3.7

### Patch Changes

- Updated dependencies [[`b42f62e`](https://github.com/cogitator-ai/Cogitator-AI/commit/b42f62ecd300cd945c42a91014b1297bc4e10c43)]:
  - @cogitator-ai/types@0.48.0

## 0.3.6

### Patch Changes

- Updated dependencies [[`ed48837`](https://github.com/cogitator-ai/Cogitator-AI/commit/ed4883796a82b5f2b832a5bb45ba861fb0b17f45)]:
  - @cogitator-ai/types@0.47.0

## 0.3.5

### Patch Changes

- Updated dependencies [[`f68ebd8`](https://github.com/cogitator-ai/Cogitator-AI/commit/f68ebd892ee493279058212105381e8acb73b70e)]:
  - @cogitator-ai/types@0.46.0

## 0.3.4

### Patch Changes

- [#209](https://github.com/cogitator-ai/Cogitator-AI/pull/209) [`bb83bdc`](https://github.com/cogitator-ai/Cogitator-AI/commit/bb83bdc6a5bfe5ec6985cd03385f0571a32218b7) Thanks [@bhushan4work](https://github.com/bhushan4work)! - Add documentation and usage examples in README.md

## 0.3.3

### Patch Changes

- Updated dependencies [[`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b), [`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b), [`c899f39`](https://github.com/cogitator-ai/Cogitator-AI/commit/c899f39352baa90d8b047bb5dea95d9c0279389b)]:
  - @cogitator-ai/types@0.45.0

## 0.3.2

### Patch Changes

- Updated dependencies [[`b5c11eb`](https://github.com/cogitator-ai/Cogitator-AI/commit/b5c11eb5368f52169273527c2ea6f16e83ab8b22)]:
  - @cogitator-ai/types@0.44.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`8524d15`](https://github.com/cogitator-ai/Cogitator-AI/commit/8524d1557e03b856de9dd2ec9bccfce91ab74765), [`8524d15`](https://github.com/cogitator-ai/Cogitator-AI/commit/8524d1557e03b856de9dd2ec9bccfce91ab74765)]:
  - @cogitator-ai/types@0.43.0

## 0.3.0

### Minor Changes

- [#202](https://github.com/cogitator-ai/Cogitator-AI/pull/202) [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd) - A conformance kit for LLM backends. `backendConformanceCases(target)` runs one set of scenarios through a backend's real SDK against a fake provider that answers in that provider's wire format: an answer, tool calls with a tool stop and with a plain stop, a tool call cut at the token limit, a content filter, an error inside a stream, an abort, and rate limit, quota, authentication, overload, server and context overflow errors. The cases do not depend on a test runner, each `run()` throws an `AssertionError` when the backend breaks the contract.

  `startFakeProvider` serves HTTP/1.1 or HTTP/2 without TLS, and wires are included for OpenAI Chat Completions and Responses, Anthropic, Gemini, Ollama and Bedrock Converse, so a backend of your own for an OpenAI-compatible server can be checked with `openAIChatWire`.

### Patch Changes

- Updated dependencies [[`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd), [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd), [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd), [`06ea6ec`](https://github.com/cogitator-ai/Cogitator-AI/commit/06ea6ec3eb96b4530d5f90f255c2e3abe630dfbd)]:
  - @cogitator-ai/types@0.42.0

## 0.2.20

### Patch Changes

- [#199](https://github.com/cogitator-ai/Cogitator-AI/pull/199) [`fd99224`](https://github.com/cogitator-ai/Cogitator-AI/commit/fd992243b89f3941f76c2acb607b59468a35480a) - Packages declare `"sideEffects": false`, so bundlers can leave out the modules an app does not use. None of them runs code at import time that depends on being kept. The repository URL in each package.json uses the `git+https` form npm expects.
- Updated dependencies [[`fd99224`](https://github.com/cogitator-ai/Cogitator-AI/commit/fd992243b89f3941f76c2acb607b59468a35480a)]:
  - @cogitator-ai/types@0.41.1

## 0.2.19

### Patch Changes

- Updated dependencies [[`9a31e38`](https://github.com/cogitator-ai/Cogitator-AI/commit/9a31e3897e0992061744bbcc5cf4075db2848b77), [`fba532a`](https://github.com/cogitator-ai/Cogitator-AI/commit/fba532a5fadc4d193f855c8aee0b44f48f9e0619)]:
  - @cogitator-ai/types@0.41.0

## 0.2.18

### Patch Changes

- Updated dependencies [[`6f09cc8`](https://github.com/cogitator-ai/Cogitator-AI/commit/6f09cc8b941ea02fd8dff1cc2f28c16b22783292), [`6f09cc8`](https://github.com/cogitator-ai/Cogitator-AI/commit/6f09cc8b941ea02fd8dff1cc2f28c16b22783292)]:
  - @cogitator-ai/types@0.40.0

## 0.2.17

### Patch Changes

- Updated dependencies [[`82aeef6`](https://github.com/cogitator-ai/Cogitator-AI/commit/82aeef692bf1d08a6b9c21adc3fdcd5437f8285e), [`82aeef6`](https://github.com/cogitator-ai/Cogitator-AI/commit/82aeef692bf1d08a6b9c21adc3fdcd5437f8285e)]:
  - @cogitator-ai/types@0.39.0

## 0.2.16

### Patch Changes

- Updated dependencies [[`d1a874c`](https://github.com/cogitator-ai/Cogitator-AI/commit/d1a874ce75b702eea77ca2a24945f383e8b63198)]:
  - @cogitator-ai/types@0.38.0

## 0.2.15

### Patch Changes

- Updated dependencies [[`95d5866`](https://github.com/cogitator-ai/Cogitator-AI/commit/95d58666629772419cf200daf120542cbe9289fa)]:
  - @cogitator-ai/types@0.37.0

## 0.2.14

### Patch Changes

- [#136](https://github.com/cogitator-ai/Cogitator-AI/pull/136) [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281) - CommonJS consumers can load the packages again. The exports maps only had an `import` condition, so `require('@cogitator-ai/core')` from NestJS, Jest in CommonJS mode or a script outside `"type": "module"` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`, although Node 22.12+ can `require()` these ES modules. Every entry now ends with a `default` condition pointing at the same file.
- Updated dependencies [[`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281), [`9593a4a`](https://github.com/cogitator-ai/Cogitator-AI/commit/9593a4a09422e082c619d991cafdfaf42bf20281)]:
  - @cogitator-ai/types@0.36.0

## 0.2.13

### Patch Changes

- Updated dependencies [[`151d675`](https://github.com/cogitator-ai/Cogitator-AI/commit/151d6758803e4f01f79bb1546784010aa702493e)]:
  - @cogitator-ai/types@0.35.0

## 0.2.12

### Patch Changes

- Updated dependencies [[`3750d25`](https://github.com/cogitator-ai/Cogitator-AI/commit/3750d2597c58c2aa7654a1d842f28489d29dc774)]:
  - @cogitator-ai/types@0.34.0

## 0.2.11

### Patch Changes

- Updated dependencies [[`561f0be`](https://github.com/cogitator-ai/Cogitator-AI/commit/561f0beb7c33c9f1fb214c2bc205a5f2f9347af2)]:
  - @cogitator-ai/types@0.33.2

## 0.2.10

### Patch Changes

- [#117](https://github.com/cogitator-ai/Cogitator-AI/pull/117) [`0caa714`](https://github.com/cogitator-ai/Cogitator-AI/commit/0caa714e0d52b0effb983f63c5edca499a22235b) - npm keywords for every package, so a search for what a package does finds it, and packages are now published with provenance: npm shows that each version was built and signed by the repository's release workflow, from which commit.
- Updated dependencies [[`0caa714`](https://github.com/cogitator-ai/Cogitator-AI/commit/0caa714e0d52b0effb983f63c5edca499a22235b)]:
  - @cogitator-ai/types@0.33.1

## 0.2.9

### Patch Changes

- Updated dependencies [[`7886808`](https://github.com/cogitator-ai/Cogitator-AI/commit/7886808f11282b2d3a0c6820ba593417865f9139)]:
  - @cogitator-ai/types@0.33.0

## 0.2.8

### Patch Changes

- Updated dependencies [[`77087fc`](https://github.com/cogitator-ai/Cogitator-AI/commit/77087fc85bc28235ec36bf39b90da8bc138d0e80)]:
  - @cogitator-ai/types@0.32.0

## 0.2.7

### Patch Changes

- Updated dependencies [[`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406), [`a74da9a`](https://github.com/cogitator-ai/Cogitator-AI/commit/a74da9aa11d338175c7a929fedb98d887e078406)]:
  - @cogitator-ai/types@0.31.0

## 0.2.6

### Patch Changes

- Updated dependencies [[`063ee72`](https://github.com/cogitator-ai/Cogitator-AI/commit/063ee7289ebb670da69951b93843652bbf0465b2)]:
  - @cogitator-ai/types@0.30.0

## 0.2.5

### Patch Changes

- bbe49d6: `MockLLMBackend` records each request as it was sent. The runtime keeps appending to the same messages array, so every recorded call used to show the final conversation.
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

## 0.2.4

### Patch Changes

- Updated dependencies [0ef09fc]
- Updated dependencies [6b16db1]
- Updated dependencies [57ac053]
- Updated dependencies [b8c7c3d]
- Updated dependencies [35701f9]
  - @cogitator-ai/types@0.28.0

## 0.2.3

### Patch Changes

- Updated dependencies [0933009]
- Updated dependencies [0933009]
- Updated dependencies [0933009]
- Updated dependencies [7bee3ef]
- Updated dependencies [7bee3ef]
- Updated dependencies [4964fb6]
  - @cogitator-ai/types@0.27.0

## 0.2.2

### Patch Changes

- Updated dependencies [9ff5a06]
- Updated dependencies [ed996c4]
  - @cogitator-ai/types@0.26.0

## 0.2.1

### Patch Changes

- Updated dependencies [c4a4252]
- Updated dependencies [f134b01]
- Updated dependencies [6404340]
- Updated dependencies [c1cd7a1]
- Updated dependencies [f36a121]
  - @cogitator-ai/types@0.25.0

## 0.2.0

### Minor Changes

- **Breaking:** requires Node.js 22.12 or newer (Node 20 reached end of life).

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.24.0

## 0.1.11

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.23.0

## 0.1.10

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.22.3

## 0.1.9

### Patch Changes

- Republish packages with resolved internal dependency versions so npm installs do not receive workspace protocol dependencies.

## 0.1.8

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.22.2

## 0.1.7

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.22.1

## 0.1.6

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.21.3

## 0.1.5

### Patch Changes

- Updated dependencies
  - @cogitator-ai/types@0.21.1

## 0.1.4

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @cogitator-ai/types@0.20.0

## 0.1.2

### Patch Changes

- fix: update repository URLs for GitHub Packages linking
- Updated dependencies
  - @cogitator-ai/types@0.19.2

## 0.1.1

### Patch Changes

- Configure GitHub Packages publishing
  - Add GitHub Packages registry configuration to all packages
  - Add integration tests for LLM backends (OpenAI, Anthropic, Google, Ollama)
  - Add comprehensive context-manager tests

- Updated dependencies
  - @cogitator-ai/types@0.19.1
