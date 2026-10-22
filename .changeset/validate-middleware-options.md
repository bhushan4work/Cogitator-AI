---
'@cogitator-ai/channels': patch
---

Validate `codeLength` in `PairingMiddleware`, `pairingCodeLength` in `DmPolicyMiddleware`, and `maxPerMinute` in `RateLimitMiddleware` constructors to reject non-positive integers and invalid values immediately at middleware creation time.
