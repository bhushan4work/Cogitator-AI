---
'@cogitator-ai/channels': patch
---

Validate `codeLength` and `expiresIn` in `PairingMiddleware`, `pairingCodeLength` and `pairingExpiresMs` in `DmPolicyMiddleware`, and `maxPerMinute` in `RateLimitMiddleware` constructors to reject invalid and non-positive numbers immediately at middleware creation time.
