# Annals of Stammtisch — private email-intake prototype runbook

**Status (8 October 2026):** The receiving address works. The owner has reported one manual **synthetic-only** intake run. Production Annals processing, automated triggers, AI interpretation and public publication are not activated.

**Routing and intake update:** The owner confirmed the dedicated private Gmail inbox, free domain forward, two deliveries and an opened test attachment; two-step verification is enabled. Later manual Apps Script logs supplied by the owner show the synthetic preflight with production gates off and `staged:1`. The actual private Drive artefacts, authenticated Google permissions, duplicate-run outcome and absence of a trigger have **not been independently inspected**. See [issue #24](https://github.com/justinpfisher/Stammtisch/issues/24). Follow [the narrower synthetic pilot setup](annals-synthetic-pilot-setup.md), deploying **only** `PilotCore.js` + `SyntheticPilot.gs`; the broader prototype instructions below are historical and do not authorise broader inbox scanning.

## Custom-domain receiving address — established

The owner has confirmed working **receiving-only** forwarding for `annals@stammtischbrewery.com` to a dedicated private Gmail account; delivery and a test attachment were checked. See the [original routing handoff](annals-email-routing-work-handoff-2026-10-08.md) and issue #24 for operational evidence. This does **not** make the address ready for general member submissions or authorise routine processing. Keep all production Apps Script switches **off**. The manual synthetic adapter has separate switches and must be disabled after completing its controlled test.

## Outcome and current scope

This package is the **first functioning, safe engineering layer** beneath the [email-to-Annals design](annals-email-publishing-proposal-2026-10-08.md). It is not yet the finished email → AI → approval → website system.

**Implemented and testable without credentials:**
- `scripts/annals/PilotCore.js` — deterministic private intake, sender allowlist triage, attachment types/sizes, provisional categories, private evidence/draft contract, and unconditionally blocked publication.
- `scripts/annals/Code.gs` — hosted Google Apps Script **source code only** for manual/deliberately enabled **private** Gmail-to-Drive staging; no mail or external API calls on default setup. It requires **two separate activation switches**, a dedicated Drive folder, and allowlisted addresses. No Apps Script project, Gmail account, Drive folder, or scheduled trigger is created by committing these files.
- `scripts/annals/PrivatePreview.mjs` — validates an **AI-shaped but untrusted** candidate and creates a text-only, escaped, private HTML preview with recipe/syrup and quote sections and review flags.
- `scripts/annals/private-preview-cli.mjs` — writes the preview **only outside the public checkout**; refuses an existing preview (no silent overwrite); never sends mail or publishes content.
- `tests/annals-private-intake.test.mjs` and `tests/annals-private-preview.test.mjs` — synthetic Node tests for gates, idempotence, unknown/untrusted senders, MIME types, iPhone HEIC holding, recipe facts, quote handling, escaping, and paths.

**Still unimplemented/unapproved:** model calls and handwriting/HEIC/PDF interpretation, paid-processing cost enforcement, acknowledgement emails, authenticated reply-based approval, specific photographic consent, public Annals page, publishing and publication verification. The owner reported a one-message synthetic Apps Script staging run, but provider settings, private Drive contents and duplicate-run behaviour still need private acceptance checks. Source code, tests and one staged synthetic message do **not** establish a running automatic Annals system.

**Important:** The heuristic category selection is a *suggestion*, not AI analysis. The preview engine renders a structured candidate from a separate model or reviewer; the external model is not connected yet. All drafts and photos remain private and cannot be published through this prototype.

## Security boundaries

1. **Public repo:** This project is public. Never commit submitted emails, mailbox IDs, sender allowlists, source/sensitive image blobs, output previews, full email bodies, signed approvals, secrets, or even "unlisted" private page content. Do not store them in public PRs, issues, workflow logs or artefacts.
2. **Dedicated account:** Apps Script's `GmailApp` requires broad Gmail authorisation; `DriveApp` can also access the account's Drive. Use an **empty dedicated club mailbox**, not a personal/work/college account or a shared Comparative/LCRS identity.
3. **Allowlist is triage, not authentication.** Email From addresses can be spoofed. This prototype has no approval handler and cannot publish anything; any future approval command needs provider authentication, exact approved revision and anti-replay controls.
4. **Private Drive:** All originals, allowed media and manifests live in an owner-only folder in the dedicated account. The sender's Gmail original remains available privately for unsupported/oversized attachments. Confirm Drive sharing is not public or inherited from a shared location.
5. **No API costs:** No paid AI calls exist in this source package. Later AI integration needs a separate API project and key, explicit data-processing consent, a conservative **application-enforced US$5/month allowance** (proposed, not activated), fixed processing limits, usage ledger and stop condition. An API "budget" should not be assumed to enforce an absolute ceiling.
6. **No publication:** A valid private preview is not publication consent. No publisher or automatic GitHub commit is included. Potentially identifying quotes, faces, home settings and ambiguous handwritten amounts must be reviewed by a person.

## Developer test procedure (no private data)

From a normal Stammtisch checkout:

```sh
node --test tests/annals-private-intake.test.mjs tests/annals-private-preview.test.mjs
```

The existing `node scripts/local-dev.mjs check` also runs Node/Python regressions including the new tests. The tests use invented `@example.test` senders and artificial attachments, never original club photographs or real submissions.

A private *synthetic* preview can be prepared without calling a model:
1. Outside the Git checkout, create two temporary JSON files: `source.json` with `state: "private_review_required"`, `publicationApproved: false`, `publishable: false`; and `candidate.json` with a `category`, `title`, `summary`, `eventDate`, `quoteVerbatim`, `recipe` fields (`drinkIngredients`, `syrupIngredients`, `steps`) and `riskFlags` array.
2. Call `node scripts/annals/private-preview-cli.mjs /private/source.json /private/candidate.json /private/preview.html`. The destination must already be a directory outside the public repo, and an existing preview will not be replaced.
3. Open the private HTML locally; it shows a prominent **not approved for publication** banner. Do not email or upload it without authorising the actual sender/recipient and content.

## Approved-only public page generator (additional offline component)

- `scripts/annals/ApprovedRenderer.mjs` can compose a text-first, mobile-readable Annals HTML **string** from explicitly approved public entries. It has **no** Gmail, Drive, OpenAI or GitHub publishing connection, does not write an `annals.html` file, and is not linked from the live website.
- `tests/annals-approved-renderer.test.mjs` uses **clearly invented** drinks, quotations and reviewers to verify dates, quotes, recipes, HTML escaping, sorting, duplicate suppression and the privacy boundary.
- The renderer refuses photographs entirely in its first iteration. Publication data allows only a narrow whitelist of public fields (category, title, date/summary, quote or creator-verified recipe, selected credit); a raw email, private source field or unrecognised category fails.
- It will not render a nonempty batch without **a private per-entry approval receipt**, bound cryptographically to the exact normalised content (SHA-256 and HMAC-SHA-256). Separate confirmation is required for quote publication, recipe accuracy and named attribution.
- **The signer and authentication service are not implemented.** The future approval system must authenticate the nominated publisher, obtain specific creator/affected-person consents, bind those approvals to exact final content and sign privately using a secret never stored in this repository. A string saying `approved: true`, or an AI-generated "consent", must never satisfy the gate.
- A successful test of a synthetic signature is not real publication authority; no live Pages build should use invented receipts or a test-only HMAC key.
- Only after a successful real pilot and exact human approval should a future publisher write validated output to the existing GitHub Pages source, request a Pages build, and compare the actual visitor-facing result. The existing CoL and OneSignal pathways must not be touched.

## Original broader Apps Script setup — historical, NOT the synthetic pilot

**Do not use these older `Code.gs` instructions to repeat or expand the already owner-reported synthetic test.** They describe an earlier, wider inbox-scanning prototype, not the approved labelled-message adapter. The account and forwarding prerequisites were owner-reported as completed. For any further authorised manual synthetic checks use `PilotCore.js` + `SyntheticPilot.gs` and the [specific setup guide](annals-synthetic-pilot-setup.md); never deploy `Code.gs` beside `SyntheticPilot.gs`.

1. In a newly created dedicated Stammtisch Gmail account with 2FA/recovery, make a private `Annals Staging` folder in My Drive. Verify it is not shared.
2. Create a standalone Google Apps Script project under that account. Copy `scripts/annals/PilotCore.js` and `scripts/annals/Code.gs` as two script code files. If deploying with `clasp`, exclude credentials and private manifest files from the publicly published repository; keep the Apps Script project private. Apps Script does not execute these files merely because they exist in the GitHub repository.
3. In **Script Properties** (not source control), configure:
   - `ANNALS_PRIVATE_FOLDER_ID`: private folder ID (never commit);
   - `ANNALS_ALLOWED_SENDERS`: six validated sender email addresses, comma-separated (never commit);
   - `ANNALS_INTAKE_ENABLED=false`;
   - `ANNALS_ALLOW_PRODUCTION_MAIL=false`.
4. Run `annalsPilotPreflight()` first. It reveals **boolean readiness and a sender count only**, not stored addresses. Initially it should report `enabled: false`.
5. **Separately authorise** mailbox reads. After reviewing exact permissions, enable both switches only for a controlled Gmail inbox containing consented pilot messages. Run `runAnnalsPrivateIntake()` manually to test one message. Confirm a unique hash-named private Drive folder, generic media filenames, and a `manifest-private.json` with `publishable: false`.
6. An exception must not expose body/subject/address in logs. A retry should not duplicate a completely staged message. Unsupported/HEIC material is held for later conversion; actual handwritten/OCR interpretation **does not yet happen**.
7. Only after manually validating this closed pilot, configure a **15-minute installable time trigger** for `runAnnalsPrivateIntake` from the dedicated account. Do not register a trigger in this public repository or from a shared workstation account.
8. Keep publishing disabled. Review every staged item privately. Do not share a public `annals@...` address until real routing is verified and the end-to-end extraction/approval step is ready.
9. To pause, set either `ANNALS_INTAKE_ENABLED=false` or `ANNALS_ALLOW_PRODUCTION_MAIL=false`; disable/delete the time trigger separately if required. No public website content will be affected.

### Technical limitations of this first intake

- The Apps Script sample checks **up to 30 inbox threads per cycle**. For an unexpected backlog or spam volume, investigate manually; do not claim guaranteed delivery of every earlier message from a full mailbox. The eventual production processor should paginate and privately alert on backlog.
- Google Apps Script, Gmail and Drive access are subject to Google authorisation, quotas and normal account safety controls. This package has not been tested against a real Google account.
- Email text is truncated in the private manifest at 16,000 characters; the original Gmail message remains accessible. Up to six attachments are supported, max 8 MiB per individual item and 20 MiB total admitted media. HEIC/HEIF is **held privately** for later conversion rather than claiming it has been interpreted. Unsupported formats are retained **only in original Gmail**.
- Only the specific source message is used to derive the private manifest. The separate external-AI and authorised-publication pipeline still requires engineering, real fixtures and security review.
- Date of receipt is **not** proof of date of the club meeting. The new month's Stammtisch date continues to come from `monthly.mjs` and any submitted historical date still requires confirmation.
- An email mentioning celebrity deaths is **never authority** to alter the Celebration of Life register, scoring or OneSignal events.

## Acceptance gates to finish the whole product

Before declaring an operational six-member intake and hands-free website maintenance:
- Verify actual dedicated mailbox, routing, service authorisation and phone attachments.
- Implement external model parsing for actual recipe handwriting/photo/PDF with image conversion if necessary, using structured outputs and tests. Compare against legible originals and ask the creator about uncertain measures.
- Deliver short private acknowledgements and exact private previews to an approved publisher, with robust consent and signed/authenticated reply handling; no spoofed From-based approvals.
- Implement a **separate, narrow approved-only** publication path that creates validated static Annals content, no raw input, with idempotency and public-site verification.
- Test retries, backlog handling, quota failures, prompt injection, ambiguous or embarrassing quotes, image metadata and faces, budgets, and removal/correction process.
- Pilot with one or two consenting members, then move to all six when approved; do not expand OneSignal beyond CoL.

**Next acceptance gate:** privately verify the one synthetic message's owner-only Drive outputs, run the duplicate/idempotency check, and disable the two synthetic switches again. No real submissions should be processed, and any future external AI transmission/API billing, standing trigger, authenticated approval or public publishing requires separate explicit authority.
