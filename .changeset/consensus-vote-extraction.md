---
'@cogitator-ai/swarms': patch
---

The consensus strategy no longer counts a line that only repeats the vote format, like `VOTE: [your decision]`, as a vote, and asks an agent once more for its vote when an answer has none, before treating the vote as missing.
