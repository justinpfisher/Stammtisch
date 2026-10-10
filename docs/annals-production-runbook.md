# Annals text-first production workflow

Updated 9 October 2026. The text-first automation source is implemented in this branch and covered by local tests. It is **not installed or active** in the owner's Apps Script project. The owner reports that the provider key was rotated, automatic recharge is off, a private synthetic AI draft succeeded, and the latest empty-site Pages deployment succeeded. Those account and deployment facts are owner-attested; they were not rechecked from this workspace. Do not repeat the completed synthetic provider test.

## Scope and gates

**Owner decisions, 10 October 2026:** Restrict contribution intake to the six individually approved member mailboxes recorded privately by the owner. The exact addresses belong **only** in the production `ANNALS_ALLOWED_SENDERS` Script Property, never in this public repository, issues, logs, tests or documentation. Check that the private value contains exactly those six distinct addresses and no synthetic, forwarded alias, additional sender or broader domain allowance. Sender authentication and separate AI/publication permissions still apply. Public Annals collections appear only if at least one **approved, currently published** entry exists in that category; private submissions, pending drafts and empty categories must remain invisible. When the last published entry is withdrawn, the category disappears from the public index.

This release automatically drafts only allowlisted plain text from members who completed an owner-issued one-time AI-processing consent challenge. It privately stages mail, requires Google's aligned DKIM or DMARC result in the sole `Authentication-Results` header, and sends at most one receipt acknowledgement to authenticated allowlisted senders. The challenge reply activates future text-only AI drafting; a matching authenticated reply or owner action revokes it. Allowlisting is not authentication. Messages with attachments, quoted/forwarded content, likely contact details, long bodies or ambiguity stay private and outside automatic AI processing.

AI runs at most once per item. Each request reserves US$0.10 before network access and the private ledger caps reservations at US$5 per Toronto month. Timeout or uncertain outcomes are never retried automatically. Automated drafts and originals stay in the private Drive folder. The owner receives a private review link. Public use requires the owner to correct or confirm an exact text preview, resolve flags, provide private evidence notes and affirm the applicable text/recipe/quotation/credit permissions. Submission and AI consent never grant publication consent.

The adapter is pinned to `gpt-4.1-mini-2025-04-14`, uses structured output with `store:false`, has no tools and caps output at 4,000 tokens. The owner reports an API project limit of US$5/month and automatic recharge off; verify both privately before activation. The application ledger is a separate conservative attempt cap, not a replacement for provider billing controls. AI processing pauses after 8 November 2026 until current pricing and request bounds are reviewed.

On exact approval, Apps Script signs a public-safe attestation that contains no reviewer address or private evidence and sends only the approved entry and attestation in a GitHub `repository_dispatch` event. The event is accepted only by `.github/workflows/annals-publish.yml`; it verifies the signature, rejects duplicates and private fields, renders the Annals page and commits the approved public entry and page to `main`. No GitHub token capable of dispatching other Actions workflows is needed. The token must be limited to this repository and the `Contents: write` permission required by GitHub's repository-dispatch API. Public source history permanently records approved content; corrections/removals require a separately approved update and do not erase old Git history or caches.

The release supports optional cocktail photographs and recipe images only through a separate per-image approval. It does not process PDF/HEIC, and it does not confirm successful Pages completion back into Apps Script. Automatic AI drafting remains text-only; originals stay private. For a proposed public image, the owner selects a JPEG/PNG derivative in the private desk. The browser re-encodes it to JPEG at no more than 1,000 pixels per side and 32 KiB, which removes EXIF metadata; Apps Script verifies its metadata-free JPEG structure and private Drive digest, and the publisher verifies the signed digest and rejects metadata-bearing JPEG segments. The exact photo and alt text are covered by the public approval signature. The owner must affirm photographer and identifiable-person permission separately from recipe/text approval. HEIC/PDF originals remain private for manual review. A dispatch acceptance response means the request entered GitHub, not that its workflow or Pages deployment succeeded. The owner must verify the completed run and live URL for each publication change.

## Required private properties

Keep every value below in the production Apps Script project's Script Properties or the named GitHub repository Action secret. Never add a value to chat, a public issue, a repository file, a log or a screenshot.

| Property | Required value |
| --- | --- |
| `ANNALS_OWNER_EMAIL` | Dedicated production account address |
| `ANNALS_PRODUCTION_FOLDER_ID` | Owner-only Drive staging folder ID |
| `ANNALS_ALLOWED_SENDERS` | Comma-separated, owner-approved member addresses; do not add synthetic test identities |
| `ANNALS_ACTIVATED_AT` | Written by `annalsStampProductionActivation()` immediately before activation |
| `ANNALS_PRODUCTION_INTAKE_ENABLED` | `false` until all checks pass |
| `ANNALS_AI_ENABLED` | `false` until all checks pass |
| `ANNALS_OPENAI_API_KEY` | The rotated private API key; enter directly in Script Properties |
| `ANNALS_APPROVAL_KEY` | Existing private approval-signing key (at least 32 characters) |
| `ANNALS_BUDGET_LEDGER` | Existing private ledger; do not reset or reinitialise it |
| `ANNALS_REVIEW_URL` | Owner-only `/exec` URL for the review deployment |
| `ANNALS_GITHUB_TOKEN` | Fine-grained GitHub token restricted to this repository and `Contents: write`, or a narrowly installed GitHub App token with the same effective scope |
| `ANNALS_GITHUB_REPOSITORY` | `justinpfisher/Stammtisch` |
| `ANNALS_PUBLISH_SIGNING_KEY` | New independent random secret, at least 32 characters; store the matching value only as GitHub Actions secret `ANNALS_PUBLISH_SIGNING_KEY` |

Never use an Actions-write token: it could dispatch unrelated Celebration of Life or notification workflows. Never use a token with access to other repositories. The GitHub secret protects the signature verification; the Apps Script copy creates the signature. The token and key are different secrets.

## One-time installation and activation

Use the existing dedicated **Stammtisch Annals — Production** Apps Script project and preserve the separate disabled synthetic pilot. Do not create another project or repeat the successful synthetic AI draft.

1. Start from the reviewed, merged source in `scripts/annals/`: copy `PilotCore.js`, `ProductionCore.js`, `Production.gs`, and `ReviewUi.html` into the existing production project. Copy `production-appsscript.json` into its manifest. Do not copy `Code.gs` or `SyntheticPilot.gs`. Save, then confirm the editor has no syntax errors.
2. In Apps Script **Project Settings → Script Properties**, preserve existing owner, folder, API key, approval key and ledger values. Add the review URL, GitHub repository, fine-grained dispatch token, and publishing signing key listed above. Never display or share the secret values. Add the same publishing signing key privately in GitHub repository **Settings → Secrets and variables → Actions → New repository secret** under the exact name `ANNALS_PUBLISH_SIGNING_KEY`.
3. Run `annalsProductionPreflight` as the owner. It should report both automation flags false, the private folder, owner, API key, approval key, ledger and review/publishing configuration present. It does not verify OpenAI billing controls or the GitHub secret; the owner must confirm the US$5 project hard limit and automatic recharge off in the provider console, and confirm the GitHub secret is saved without revealing it.
4. Confirm the production deployment is a web app executing as **User accessing the web app** with access **Only myself**. Visit its `/exec` URL as the owner, then verify another signed-in account and a signed-out session are denied. Never weaken the code's active-and-effective owner identity check.
5. Confirm the Drive staging root is owned by the dedicated account, General access is **Restricted**, and it has no other editors or viewers. Do not expose source emails, media or consent records.
6. Review the allowlist privately. Run `annalsStampProductionActivation()` while both flags are false; this writes the activation boundary and does not turn anything on. Check its timestamp and re-run preflight.
7. Only after the previous checks pass, set both `ANNALS_AI_ENABLED` and `ANNALS_PRODUCTION_INTAKE_ENABLED` to `true`. Run `annalsInstallIntakeSchedule()` once. It verifies configuration and installs at most one 15-minute trigger for the Annals intake handler. Never install a separate publication trigger. `annalsStopProduction()` disables the two flags and removes only this handler's trigger.
8. From the private desk, invite an allowlisted member to consent. The member must reply from the same mailbox with the unique challenge sentence. Check that the private status becomes active. Revocation is available in the owner desk or by that member's exact authenticated `REVOKE ANNALS AI PROCESSING` reply.

If any property, authentication result, account identity, folder access, budget, acknowledgement delivery, private review link, GitHub dispatch or workflow state is uncertain, stop and keep new items held. Do not ask a member for a contribution until the owner has verified installation, sender authentication behavior, consent activation/revocation, private draft visibility and the GitHub workflow's approved-only gate.

## First live publication verification

Once all installation checks pass, choose one member who has explicitly consented to private AI drafting and ask for one genuine cocktail text submission. The member's email must pass aligned DKIM/DMARC authentication. Confirm the acknowledgement, private staged source, single private AI draft and owner notification. In the owner-only desk, verify the exact recipe against the source, correct the draft, record actual recipe/publication consent and save the exact preview. Approve only that exact preview. Verify that the matching `annals-approved-entry` Actions run succeeded, the public commit contains only the approved entry/page and no private receipt, and the live `/annals.html#ENTRY_ID` page shows the approved content. Do not publish any synthetic content. Stop on a failed, duplicate or uncertain run; inspect GitHub Actions before any manual retry.

For an optional cocktail photograph, open the source item's private folder, review the original, download a copy, and select that JPEG/PNG in the private desk. Inspect the generated private derivative and crop it so the image contains no faces, reflections, badges, readable screens, private belongings or location clues. Enter descriptive alt text that names no person or private place. Check the separate photo-approval box only after the photographer and anyone identifiable approved that exact image and context. Save and inspect the exact preview including its photo digest and alt text; then approve text and image together. Verify the public image appears at `assets/annals/ENTRY_ID.jpg` and the image digest matches the approved entry. Removing or correcting an image requires a new exact approval; HEIC/PDF files remain private and must not be uploaded directly to the public workflow.

For a published text correction, open the already published item in the private desk, select **Prepare an exact text correction**, edit and save the corrected fields, compare the exact preview to the private source, record the correction evidence, confirm the applicable contributor/quotation/recipe/attribution permissions, and approve it. Verify the `annals-correct-entry` Actions run and live page. For withdrawal, use **Remove published entry**, review the exact current entry and private reason, confirm removal, then verify the `annals-remove-entry` run and live page. The public site and current index remove the entry, but the repository's prior commit history, caches and copies may persist. If the dispatch or deployment result is uncertain, stop and inspect Actions before attempting anything again.

## Local verification

```text
node --test tests/annals-*.test.mjs
node scripts/local-dev.mjs check
```

These offline checks validate the consent parser, sender-authentication gate, one-attempt budget reservation, approval signature, dispatch payload validation, duplicate protection and public rendering. They do not authenticate a live Gmail header, inspect Google's sharing state, run the Apps Script project, test the GitHub secret or prove the live website has updated.
