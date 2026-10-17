Non-publishing signing consistency verification

The manual annals-signing-consistency workflow has read-only repository permission. Its pinned official actions run only on main and create one bounded artifact containing random challenge/run metadata and SHA256 of a domain-separated HMAC. Neither credential nor the raw HMAC appears in logs or output. The receipt cannot authorize publication.

The owner-only private desk verifies the original ZIP against GitHub artifact metadata, reviewed source hashes, exact successful run/attempt/job/steps and a 15-minute clock. It then compares the commitment with the current production publishing key, internally. It does not update credentials, properties, release flags, source records or historical attempts. Missing artifact digest or unavailable public API evidence fails closed.

Download the original ZIP through authenticated GitHub access; never extract and rezip. Use a fresh random 32-byte lowercase hexadecimal challenge. Keep the archive private. Supply the expected challenge, artifact ID and archive base64 to the private desk. A positive result is point-in-time key equality only: repeat historical rejection checks and qualify each feature separately before activation. No signing remediation marker or hosted-acceptance gate is set by this mechanism.

Validation includes cross-runtime Unicode-key parity, mismatch, stale/future receipt, changed archive, missing digest, wrong repository/branch/workflow/commit/run/attempt, failed/skipped steps, path traversal, extra members/fields and bounded inputs. Genuine hosted execution and private deployment evidence are recorded after installation.

## Genuine production comparison — 17 October 2026

PR #93 merged as `84006cc5e67a1ac7dc4ef35219867316160919ee`. Hosted regression run 39050767132 and browser run 39050767128 succeeded. The existing owner-only Apps Script deployment was advanced in place from v31 to v32; all 19 immutable files matched the reviewed installation or preserved private rollback. The single intake trigger remains present, and read-only preflight retains the private store, activation boundary, budget ledger and consent configuration. Ordinary/media publication remains off.

The real non-publishing challenge run [39050983662](https://github.com/justinpfisher/Stammtisch/actions/runs/39050983662) succeeded. The original 424-byte artifact ZIP matched the GitHub API archive digest. At `2026-10-17T16:48:58.945Z`, the deployed private verifier independently returned `githubSecretConsistencyVerified:true`, `separateKeys:true`, `publishesAnything:false`, `changesCredentials:false` and `changesReleaseGates:false`. Private historical verification independently returned old-private rejection, old-public rejection and new-private validity all true. Its legacy GitHub field remains hardcoded false and is not a contradictory comparison result.

No credential was read into output or changed. The result is point-in-time key equality, not feature acceptance. A later security qualification record must rerun the fresh challenge and historical checks within the existing fifteen-minute window; this document cannot substitute for that record.

Read-only reconciliation found no CoL/History pending record or historical continuation reservation. Existing journals retain 19 accepted publication/live confirmations, 19 accepted removals and 18 final withdrawal receipts. The historical missing withdrawal receipt remains missing: the associated earlier removal workflow 38657734130 and Pages run 38657748990 succeeded, and the current archive is empty. No historic operation was replayed. There is no unconsumed ordinary/Photo/History acceptance contribution in the inspected source queue and no preserved attachment sample. The original authenticated oldest-death amendment remains held and unconsumed.

Post-merge Pages 39050923805, monitor 39050885151, web-push 39050956030, fresh read-only source witness 39051325399 and public-file witness 39051327245 succeeded. These are operational continuity evidence, not an adopted rule or restored automatic publication.
