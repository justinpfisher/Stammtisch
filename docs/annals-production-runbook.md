# Annals production operations

[Current state](current-state.md) is the single production reference; [publication guidelines](annals-publication-guidelines.md) define content/rights. This runbook describes recurring operations and changes. Older launch procedures remain in Git history and dated evidence, not as prerequisites to routine updates.

## Routine operation

The existing dedicated Gmail → private Drive/Apps Script → signed GitHub publisher → Pages service is established. One existing **15-minute `runAnnalsProductionIntake` HEAD trigger** handles intake and reconciliation. The private desk is owner-only. Do not recreate accounts, stamp activation, reset cursors, register existing consents again, clear attempts or rerun billed diagnostics.

The shared 15-minute inbox scanner checks new conversations first, then continues the historical cursor. A failure staging one message must not stop other messages: an incomplete pre-source attempt is placed on an owner-only, one-shot hold with a generic owner notice, and the existing summary logs only an aggregate `staging_errors` count. Do not delete that hold, manually shift the inbox cursor or automatically replay its message without reconciling what was already written. A staged source, signed event or attempted provider request retains its original one-shot identity.

Mail must authenticate against the six-member private allowlist using the existing aligned DKIM/DMARC rules. Read subject and body as equally valid source fields. Clipped/incomplete text stays held. Separate scoped rights are captured at receipt and checked again before use. Owner-attested permissions retain that provenance. Revocation commands and private owner corrections remain available.

The one-shot AI request proposes structured private material; deterministic policy and exact source checks decide eligibility. The model has no tools or power to grant permission. Quotes, recipes, portraits, photos and CoL each retain their own meaning/rights checks. Ordinary eligible text needs no per-entry owner approval. The JPEG-only guarded mode is independent of broad genuine photo acceptance, which must remain truthfully unset/false until demonstrated.

**Complete CoL rules by email:** A member can send a whole revised rules document without a prescribed template. The private intake preserves up to 36,000 body characters for CoL material (38,000 including the subject), independently of the smaller ordinary Annals excerpt limit. A bounded one-shot AI interpretation can compare up to 54,000 characters of member source and operative provisions, with an 8,000-token response limit, within the existing US$5 monthly ledger. Fresh eligible CoL mail receives priority during the normal 15-minute intake. Authenticated prospective instructions need no member vote or routine owner adoption approval.

Only complete, verbatim member-authored **formatting-only** replacements, in which every original word, number, punctuation mark and exception remains identical, are eligible for unattended multi-section CoL publication through the existing v3 signed candidate / independent source and clock witness. The model cannot certify its own semantic equivalence. New scoring rules, draft allocations, exceptional conditions, uncertain intent and changed interpretations are still captured/interpreted automatically but must remain non-operative pending actual matching code/data qualification. An owner receives one-shot private exception notices, including when a captured CoL AI response fails exact source mapping or response validation. Such a response stays held without a second provider attempt; the owner notice contains no member text or model output. Oversized or ambiguous material is never silently adopted, truncated into a rule, published with private source, or retried after an uncertain provider/dispatch attempt. Previous versions, annual scores and push deduplication stay unchanged unless the applicable prospective change is independently verified.

**HTTP 204 means accepted for processing.** Record `verified_live` only after the matching signed digest/ID is actually observed in public data and live Pages. The existing status notice after 24 hours is an exception alert, not a redispatch. Interrupted provider attempts, unknown dispatch results and conflicting journals stay held; never automatically retry them. Corrections, withdrawals and quarantine preserve audit/replay evidence.

## Ordinary website update

Use the authorised branch → relevant checks → review/merge → existing Pages → affected live verification workflow in [AGENTS.md](../AGENTS.md). A copy/style/frontend-only update does not touch Apps Script, credentials, member consent, full private-source hashes or launch qualifications. Reuse established evidence unless the affected assumptions changed.

Repository-dispatch publishers use `GITHUB_TOKEN`; their commits need an explicit Pages-build request. The Annals/History workflows make that request after a successful commit. The private reconciler remains the authority for real contribution live success. Existing CoL workflows retain their source/version/clock witnesses; their phases are not ordinary site-update gates.

## Private code updates only

1. Identify affected public-source modules and their last installed baseline from the recorded deployment. Preserve any private-only diagnostics and manifest fields. Use the existing private rollback; do not re-export everything for an unrelated site change. A first unmanaged installation, unexplained source drift, private-only edits or a security incident justifies a full comparison.
2. Prepare exact reviewed source with `python scripts/annals/build-install-package.py --help` and the existing package tool where useful. It contains a source whitelist and hashes, never credentials. Apply only changed modules plus required dependencies; add dependencies before callers. Preserve the existing owner-only manifest/scopes and all private properties.
3. **HEAD executes on the schedule immediately.** Avoid partial incompatible saves: use an existing controlled pause only when needed, preserve prior flags, and restore only that authorised state after verification. Do not call emergency stop merely to install; it removes the trigger.
4. Independently read back/hash changed modules against reviewed source; check relevant dependency/interface parity. Reuse the trusted unchanged baseline. If it cannot be trusted, perform the full private comparison before installation. Advance the **existing** owner-only web-app deployment in place and confirm its version and affected behaviour; source saving alone does not update `/exec`.
5. Check non-secret effective settings and a natural scheduled run where affected. Preserve deployment URL/identity, cursor, activation boundary, consent, ledger, journals, credentials and exactly one trigger. Update current-state evidence only for what was observed.

**Offline editor-transfer method (when the private source API is unavailable):** A one-time GitHub-hosted release artifact contains only reviewed public source, a manifest and file hashes; it has no private project source, credentials or authority to deploy. Prefer opening `scripts/annals/private-source-transfer-offline.html` as a local file in the same controlled browser as the owner-only Apps Script editor. **If a cloud browser rejects `file://`, do not repeat the failed step:** the same already-reviewed file is present in the deployed Pages artifact and has the browser-compatible HTTPS route `https://stammtischbrewery.com/scripts/annals/private-source-transfer-offline.html`. Verify that the loaded helper is the reviewed one (SHA-256 `808bbfb608882e7473184dcbbeec20fa9e5ac4fb838b488c1982280a5aad671f`). Its reviewed content-security policy prohibits network requests, external resources and form submission. The user-selected files and pasted complete readback remain in that browser tab; **never enter credentials, member originals, private-only diagnostics or Script Properties**. This HTTPS route is a temporary source-transfer fallback, not a new publication or data-transfer service. Remove the public helper after transfer is verified; its original source already exists in public GitHub history. Load the package's `source-manifest.json` and seven affected `install/*.gs` files, confirm the pinned GitHub commit, copy each verified complete source into the existing matching editor module, then copy **the saved editor content back** into the local verifier. Require seven exact or explicitly documented editor-newline-only matches and resolve any other drift before advancing the same deployment. The local page has no network access and does not read credentials or Script Properties. This is a transfer/readback aid, **not** proof of deployment, live service state, private-only file parity or naturally scheduled intake; finish the normal in-place deployment checks above. Remove the one-time artifact workflow after the original transfer is completed or abandoned; do not turn it into a recurring process.

The private source API/export requires existing owner authentication. Google Drive access alone does not grant source/deployment access. Never widen OAuth scope or copy secret values to work around missing access. Credential entry follows the actual supported secure owner process; it is a one-time owner dependency when required, not a routine release gate.

## Configuration reference

These are **initial requirements/defaults**, not instructions to reset established live settings. Effective state is recorded in [current state](current-state.md). Values and member identities remain private.

| Private setting | Requirement |
| --- | --- |
| `ANNALS_OWNER_EMAIL` | Dedicated owner account |
| `ANNALS_PRODUCTION_FOLDER_ID` | Owner-only private Drive root, restricted, no additional editors/viewers |
| `ANNALS_ALLOWED_SENDERS` | **Exactly the six owner-confirmed addresses**, privately recorded |
| `ANNALS_SPEAKER_IDENTITIES` | Owner-only JSON matching six verified sender addresses to six approved public Annals portrait slugs. The same private mapping may identify the actual speaker for a quote or sender for another entry, but distinct individual permissions control these uses; never put addresses in GitHub |
| `ANNALS_ACTIVATED_AT` | Written **once** by `annalsStampProductionActivation()` after safe preflight; excludes historic mail |
| `ANNALS_PRODUCTION_INTAKE_ENABLED` | `false` until all deployment gates pass |
| `ANNALS_AI_ENABLED` | `false` until all deployment gates pass |
| `ANNALS_AUTO_PUBLICATION_ENABLED` | **`false` by default**; unattended public text must be deliberately activated |
| `ANNALS_AUTO_MEDIA_ENABLED` | **`false` by default**; independent stop switch for automatic image conversion/AI screening/public photo publication |
| `ANNALS_OPENAI_API_KEY` | Existing dedicated rotated key; never shared with other projects |
| `ANNALS_APPROVAL_KEY` | Existing private receipt-signing key, 32+ characters |
| `ANNALS_BUDGET_LEDGER` | Existing ledger; **never reinitialise** to bypass spend limits |
| `ANNALS_REVIEW_URL` | Verified private owner-only `/exec` URL |
| `ANNALS_GITHUB_TOKEN` | Fine-grained token **only** for `justinpfisher/Stammtisch`, `Contents:write` only; **no Actions-write** |
| `ANNALS_GITHUB_TOKEN_EXPIRES_AT` | Optional until the first renewal; exact independently verified UTC expiry `YYYY-MM-DDTHH:MM:SSZ` for the token actually installed. An absent setting retains the recorded 9 November 2026 dispatch stop; malformed or expired values stop dispatch. Never record a later date before installing and verifying the corresponding restricted token. |
| `ANNALS_GITHUB_REPOSITORY` | Exactly `justinpfisher/Stammtisch` |
| `ANNALS_PUBLISH_SIGNING_KEY` | Separate independent 32+-character signing key, identical in Apps Script property and GitHub Actions repository secret of the same name |


Additional production controls include private `ANNALS_PHOTOS_V2_ENABLED`, `ANNALS_PHOTOS_GUARDED_JPEG_ENABLED`, `ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED` and the independent media stop switch; the hosted guarded/transport flags must match. `ANNALS_PHOTOS_HOSTED_ACCEPTED` is genuine-acceptance evidence, not a convenient enable switch. Keep the broader hosted photo-release flag unchanged under the guarded release.

History requires a distinct 32+-character `ANNALS_HISTORY_SIGNING_KEY` in private Script Properties and the encrypted repository Actions secret, different from private-approval and ordinary-publishing keys. `ANNALS_HISTORY_PUBLICATION_ENABLED` and hosted `ANNALS_HISTORY_RELEASE_ENABLED` are separate authority switches. Complete non-publishing matching verification and relevant exact-source review before controlled activation; never substitute the ordinary key. The existing History implementation does not become unattended claim synthesis merely by enabling flags.

## Spending and dates

Reserve **US$0.10 before each one-shot AI attempt**, within **US$5 per Toronto month**. Preserve the existing ledger; reservation is not measured provider billing. Keep provider limits, one-shot journals, scoped member permissions, `ANNALS_AI_ENABLED` and automatic-recharge controls intact. Reviewed repository source has no arbitrary calendar AI stop; the existing private Version 43 still stops AI at **8 November 2026 00:00 UTC** until the updated source is installed in place. Automatic AI pauses if the separate publisher expiry gate is closed, avoiding paid unpublishable attempts. Dispatch remains limited to the actual expiry of the fine-grained publisher token: **9 November 2026 00:00 UTC** is the fail-closed fallback until a renewed restricted token is securely installed and the matching verified `ANNALS_GITHUB_TOKEN_EXPIRES_AT` property is set. Later renewals require only the controlled credential/property update, not a new code release. Neither property nor code can extend the actual GitHub token's validity.

## Recovery and one-time work

- For a fault in one capability, use its narrow stop switch; unrelated qualified service can continue. Preserve pending/uncertain journals and do not replay them as a test.
- Source rollback restores the preserved compatible HEAD files **and** selects the prior immutable version on the same owner-only deployment. Preserve settings/state and the single trigger. Use the recorded baseline rollback; do not recreate the project or reset keys.
- Initial authentication, consent registration, first activation boundary, signing remediation and genuine text publish/withdrawal have completed. Requalify only for a material relevant change, revocation, expiry, incident or contradictory evidence. A routine release is not another launch.
- The historical missing withdrawal receipt stays explicitly missing. Existing successful removal and empty public archive do not authorise fabrication/backfill or replay.
- New test-only contributions and physical-device/screen-reader checks are no longer launch gates under the owner's guarded-release direction. Preserve their evidence limits and record future observations without pretending they passed.

[Signing consistency](annals-signing-consistency.md) is a diagnostic when keys or signing assumptions change. [Guarded release](annals-guarded-production-2026-10-18.md) preserves the launch rationale and rollback. [CoL staged protocol](col-two-stage-release.md) applies only to that high-integrity subsystem. None requires repeating setup for an ordinary update.
