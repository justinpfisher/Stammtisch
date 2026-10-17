Non-publishing signing consistency verification

The manual annals-signing-consistency workflow has read-only repository permission. Its pinned official actions run only on main and create one bounded artifact containing random challenge/run metadata and SHA256 of a domain-separated HMAC. Neither credential nor the raw HMAC appears in logs or output. The receipt cannot authorize publication.

The owner-only private desk verifies the original ZIP against GitHub artifact metadata, reviewed source hashes, exact successful run/attempt/job/steps and a 15-minute clock. It then compares the commitment with the current production publishing key, internally. It does not update credentials, properties, release flags, source records or historical attempts. Missing artifact digest or unavailable public API evidence fails closed.

Download the original ZIP through authenticated GitHub access; never extract and rezip. Use a fresh random 32-byte lowercase hexadecimal challenge. Keep the archive private. Supply the expected challenge, artifact ID and archive base64 to the private desk. A positive result is point-in-time key equality only: repeat historical rejection checks and qualify each feature separately before activation. No signing remediation marker or hosted-acceptance gate is set by this mechanism.

Validation includes cross-runtime Unicode-key parity, mismatch, stale/future receipt, changed archive, missing digest, wrong repository/branch/workflow/commit/run/attempt, failed/skipped steps, path traversal, extra members/fields and bounded inputs. Genuine hosted execution and private deployment evidence are recorded after installation.
