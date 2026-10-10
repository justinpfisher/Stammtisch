# Annals private drafting and approval candidate

Prepared 8 October 2026. **Source candidate, not deployed and not an operational publishing service.**

## Authority and verified evidence

The owner approved OpenAI API processing of **consented** submissions with **US$5 per Toronto calendar month** of API usage, before tax and currency conversion, at 20:30 EDT on 8 October. See issue #24. An upfront credit purchase, automatic recharge, shared credentials, and blanket publication consent remain outside that approval. This work is the direct continuation of the Annals setup; it does not restart the completed Mode 1 autonomous window.

Receiving email works. The owner supplied logs showing one synthetic item staged, then one duplicate and zero newly staged items; confirmed the preview checks and disabling both synthetic switches. Ordinary-reply exclusion passed automated simulation, not a live Google reply test. Do not require the owner to repeat completed tests. The synthetic project remains separate and disabled.

## What this candidate implements

- A bounded, resumable inbox scan of allowlisted senders after an explicit activation timestamp. Raw material stays in a separate owner-only Drive folder. Originals and unapproved drafts never enter GitHub.
- An owner-authenticated review page. From-address matching is **not sender authentication**. Before AI processing the owner verifies the submission, removes contacts/signatures from the text, selects relevant images and confirms processing consent. This extra action is deliberate until trusted mail authentication has been demonstrated in the real forwarded mailbox.
- One bounded OpenAI Responses request per staged item, pinned to `gpt-4.1-mini-2025-04-14`, with structured output, `store:false`, no tools, no URL following and no model escalation. Text up to 12,000 characters; up to three JPEG/PNG images of at most 4 MiB each. PDF, HEIC and larger material remain private for manual handling. Source originals are not treated as approved public images.
- Editable text-only public proposals. Year/date/credit must be confirmed by a human; receipt dates do not silently become event dates. An owner saves and sees the exact public fields before approving. The approval requires a private evidence note and relevant creator/quotation/attribution permissions. Changes invalidate earlier draft hashes.
- Private HMAC approval receipts compatible with `ApprovedRenderer.mjs`, with a private approved-bundle download. An offline preparation command verifies every receipt and emits only approved HTML/public JSON. Neither account IDs, consent notes nor signatures enter those public outputs.
- An optional 15-minute **intake-only** schedule and stop function. AI requires an owner action; no public web submission endpoint or email approval parser exists.

## Remaining gaps before calling this production

This is an intermediate production candidate. It does **not** yet implement acknowledgement/approval emails, hands-off AI on authenticated submissions, photo publication or an automatic GitHub publisher. The existing renderer supports text only. The owner still needs to open the private desk to prepare and approve a draft; an operator must prepare and publish the signed export. Do not advertise the one-email-to-automatic-publication experience as ready.

Secure Google deployment and OpenAI account access are unavailable from the current execution environment. Actual OAuth, owner identity in the selected web-app deployment, Drive privacy, real model output quality and approved publication must be checked after secure configuration. Automated tests simulate services; they do not replace that evidence. Do not weaken identity checks if Google returns a blank active user.

## Cost and privacy controls

Pricing verified on 8 October 2026: GPT-4.1 mini input US$0.40 and output US$1.60 per million tokens. The pinned model supports image input and structured output. The adapter permits at most 12,000 text characters (at most 48,000 UTF-8 bytes), three images, and 4,000 output tokens. Current documentation gives a 6,144-patch resizing budget and 1.62 multiplier for this model, or at most 9,954 billed image tokens per image. Reserving 60,000 tokens for text and static prompt/schema overhead, 29,862 image tokens, and 4,000 output tokens yields US$0.042345 as a conservative calculated upper bound at the checked rates. The application nevertheless permanently reserves **10 cents per attempt** before sending, including failures and uncertain timeouts. At most 50 attempts fit in the monthly allowance; unused reservation is not refunded. This is an application ceiling, not measured invoiced spend. It deliberately leaves budget unused in exchange for a simple conservative bound.

The ledger is stored in private Script Properties under a script lock. Missing/corrupt ledgers stop processing; a private initialization marker prevents accidental reset against a used staging folder. The owner can change settings, so this is not tamper-proof protection against an account administrator. Never delete or reset a used ledger to unblock processing. No automatic request retry exists. A crash after reservation may consume allowance without producing a draft.

Configure a dedicated project hard limit of US$5 as a backstop and disable automatic credit recharge. OpenAI now documents hard project limits; the older proposal's statement that project limits are always only soft alerts is outdated. Provider enforcement can lag, so it is not a guarantee against small overage from other project traffic. Reserve this project exclusively for this adapter and keep other keys/callers out. AI pauses after 8 November 2026 until pricing and bounds are reviewed in code. No payment or credit purchase was made while preparing this candidate.

API data is not used for training by default. `store:false` is not zero retention: standard abuse-monitoring retention and exceptions still apply. Selected original image bytes (including any embedded metadata) go to the API, so processing consent must cover them. This version does not re-encode images or promise metadata stripping; all images remain private and are never included in approved public exports.

Official references checked:
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/your-data
- https://developers.openai.com/api/docs/guides/spend-limits
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/base/session

## Secure deployment handoff

Do this only in the dedicated Annals account. Keep the script project, properties, Drive IDs, API key, approval key, originals and previews private. Never paste secrets into chat or a public issue. The existing broad Gmail/Drive permissions are still broad; using an owner-only screen does not reduce those underlying OAuth scopes.

1. Create a separate owner-only **Annals Production Staging** folder in My Drive and a separate Apps Script project. Preserve the disabled synthetic project.
2. Copy `PilotCore.js`, `ProductionCore.js`, `Production.gs` into script files named `PilotCore`, `ProductionCore`, `Production`. Add an HTML file named `ReviewUi` with `ReviewUi.html`. Do **not** add legacy `Code.gs` or `SyntheticPilot.gs`.
3. Show the manifest in project settings, then copy `production-appsscript.json` into the project's `appsscript.json`. `exceptionLogging:NONE` prevents automatic exception forwarding to Cloud Logging. Runtime logs must contain counts/booleans only. Review the actual consent screen before granting the dedicated account's access.
4. Configure the following private Script Properties; no placeholders or real values belong in GitHub:

| Property | Value |
| --- | --- |
| `ANNALS_OWNER_EMAIL` | Dedicated account's actual email |
| `ANNALS_PRODUCTION_FOLDER_ID` | New private folder ID |
| `ANNALS_ALLOWED_SENDERS` | Comma-separated actual submission addresses approved by the owner; start with the existing test sender |
| `ANNALS_ACTIVATED_AT` | Explicit ISO timestamp for new submission processing, recorded at activation |
| `ANNALS_PRODUCTION_INTAKE_ENABLED` | `false` initially |
| `ANNALS_AI_ENABLED` | `false` initially |
| `ANNALS_OPENAI_API_KEY` | New restricted key for the dedicated Stammtisch API project |
| `ANNALS_APPROVAL_KEY` | Independently generated random secret, at least 32 characters; keep a private recovery copy |

5. Create/select a **dedicated Stammtisch API project** in an owner-authorised account. Do not inspect or reuse Comparative/LCRS project secrets. Configure project hard limit US$5, request permissions restricted to Responses as available, and disable automatic recharge. If a credit purchase is required, show the exact charge for separate approval. Never claim that a project budget is already set merely because this guide lists it.
6. Run `annalsProductionPreflight`. It reports only readiness booleans. Run `annalsInitialiseBudget` once with AI disabled; it uses the current Toronto month and refuses a previously initialised root. No AI call occurs.
7. Deploy a web app with **execution as the user accessing the web app**, restricted to **only the owner** wherever the account offers that setting. Verify both active and effective identities match `ANNALS_OWNER_EMAIL`. If the required deployment combination is unavailable or identity is blank, stop; do not publish to everyone or remove the identity guard. Record the private URL outside GitHub.
8. After the owner-only web app and denial checks pass, run `annalsCreateSyntheticCheckItem` once from the script editor. It creates one fixed fictional source in private Drive, reads no Gmail, calls no AI and refuses to create a second copy. Do not delete the older held item.
9. To test the rotated provider key, temporarily set only `ANNALS_AI_ENABLED` to `true`; keep intake `false` and install no trigger. In the private desk, open the new synthetic item, confirm its fictional text, check the explicit AI-processing box and click **Prepare draft** once. This reserves US$0.10. Turn `ANNALS_AI_ENABLED` back to `false` immediately after the result. Check the draft and actual usage privately. If held, read only the fixed failure category/HTTP status in the private desk and stop; never retry that item. Never approve or publish synthetic material as real history.
10. Obtain a real contribution with permission for AI processing, validate its extraction and creator consent, then approve its exact text. Publication needs this actual content; no real approved entry currently exists.
11. For background private staging, run `annalsInstallIntakeSchedule` once. It creates at most one 15-minute trigger for this handler only. It does not start automatic AI or publishing. Keep new mail in the inbox until staged. Traversal revisits the inbox; concurrent inbox edits can delay discovery, and an archived/removed item may require a private operator rescan. An interrupted item pauses its cursor safely for recovery.

## Private approved export and publication

The downloaded `annals-approved-private.json` contains approval identity and signatures. Keep it outside every public checkout. Merge private approved bundles locally when adding to an existing archive; the preparer requires retention of every existing public entry. The signing key must match the private project's key and be supplied through `ANNALS_APPROVAL_KEY` in the process environment, without echoing it.

```text
node scripts/annals/prepare-publication.mjs PRIVATE_BUNDLE EXISTING_PUBLIC_JSON_OR_NEW ABSOLUTE_NEW_OUTPUT_DIRECTORY
```

Use `NEW` only for the first archive after checking that no existing public archive exists. The command refuses an existing output directory and private inputs inside its repository, checks every exact-content signature, then writes `annals.html` and `annals-approved.json` without any network call. Before public commit, the operator must inspect the outputs for incidental private facts that a syntactically valid schema cannot detect. A signature records human approval, not automatic proof of privacy or truth.

Publication integration remains a separate implementation step: preserve existing entries, copy only the approved outputs, run site/CoL regressions, publish via the existing guarded repository process, verify the live URL and return it privately. Do not put receipts, originals, unapproved alternatives or private previews in any branch/PR. The code contains no credentials capable of publishing GitHub content. No notification changes belong here.

## Stop, recover and correct

- Run `annalsStopProduction` under the owner account: disables intake and AI and removes only this project's intake handler trigger. Receiving mail continues. No files or approvals are deleted.
- An AI attempt without a draft remains held, with the 10-cent reservation intact. Inspect privately; never delete the attempt record and rerun blindly. A deliberate retry mechanism with a fresh reservation is not implemented in this candidate.
- After the sanitized attempt-diagnostics update, the private review page may show only a fixed failure category and an HTTP status code. It never displays or stores provider response bodies or exception text. Older held attempts have no diagnostic record and remain unknown; do not retry their source item.
- If owner identity or folder checks fail, fix access privately; never bypass them. If ledger initialization was interrupted, preserve the marker and reconcile the private ledger instead of starting over.
- An approved entry is immutable in this interface. Corrections/revocations require a private operator review and new exact approval, then replacement/removal of public derivatives. Public Git history and caches may retain earlier copies. Do not silently rewrite the approval record.
- No automatic retention/deletion policy is active. Gmail/Drive storage is finite; monitor it privately. Original records and consent evidence remain until the owner approves a retention policy.

## Verification commands

```text
node --test tests/annals-*.test.mjs
node scripts/local-dev.mjs check
```

Tests cover account denial, source limits, fixed model/no tools, budget exhaustion/rollover, unknown outcomes, private storage, exact-version approval, receipt interoperability, preservation of existing public entries, and absence of private approval fields from public output. Record the actual environment and results. Live API/Google tests, UI provider checks, automatic publishing and first real publication remain open until observed.

