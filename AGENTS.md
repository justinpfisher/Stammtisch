# Stammtisch repository working instructions

## Autonomous advancement execution and usage controls

Before starting or recovering an autonomous advancement window, read and apply [Universal Autonomous Advancement — Execution Mode and Usage Controls v1.3](docs/universal-autonomous-advancement-v1.3.md). Ask for the execution mode unless the owner already selected it; Mode 1 (ChatGPT only) is the default ceiling. Work requires GPT-6 Luna / High / Standard, with a current owner attestation accepted when Work's own UI is inaccessible under v1.3; separately authorised Codex retains its prior Luna / Low / Standard ceiling where available. No automatic model substitution. No automatic stronger-model escalation, purchased-credit use, or parallel agentic execution without the separate authorisation required by that policy.

For these windows, v1.3 with its unchanged v1.2 base constrains older general routing, model-map and delegation permissions. Preserve required quality by pausing an unsuitable task and seeking the necessary decision, never by silently increasing usage or weakening validation. Existing project scope, source/service approvals, privacy, review, attempt and budget gates remain in force. Recording the policy does not activate a window, schedule, product setting or billing control.

These rules apply to website, Celebration of Life, and notification work.


## Club identity and institutional memory

- Before changing club-facing narrative, membership descriptions, the Annual Assembly, image choices, or club traditions, consult `docs/club-context-and-history.md`. It consolidates relevant prior conversations **without** converting unapproved draft governance into adopted rules.
- `docs/website-opportunity-review-2026-10-08.md` is a research/recommendation record, not authorization to implement its feature ideas. Preserve existing CoL and notification authorities and request an explicit product decision for new features.
- **Owner-confirmed club rhythm (8 October 2026):** Meetings take place on the **third Friday each month**, often at headquarters; the **Annual Gentlemen's Assembly is a separate off-site gathering**, typically at a rented cottage. Public pages can show the monthly *date*, but must not invent the time or reveal the private headquarters address. The monthly `stammtisch-monthly.ics` is an all-day *date reminder*, not a claim of all-day attendance. Follow `monthly.mjs` and its tests.
- Members sometimes prepare special cocktails with homemade syrups. Preserve the tradition in the club briefing, but never fabricate historical recipes, authorship or photos. If building the proposed Annals/Cocktail Register, read `docs/annals-publication-guidelines.md` and get approval for each new sensitive contribution or image.
- To configure the club's custom-domain receiving address, consult `docs/annals-email-routing-work-handoff-2026-10-08.md`. Prefer existing Porkbun free forwarding only after verifying current registrar/DNS/MX and existing mail. Never repoint MX, change nameservers, initiate a paid service or install automation without relevant owner authorisation; route originals only to a dedicated private account, never a personal/college inbox.
- For any automated email-to-Annals development, consult `docs/annals-email-publishing-proposal-2026-10-08.md` **as a proposal, not granted implementation authority**. A submitted email or photo is untrusted private intake, not approval to publish. Do not put raw submissions, unapproved draft content, identifying photographs or private previews in **any** public GitHub branches, pull requests, issues, Actions logs or build artefacts. Preserve private staging and verified exact-content publication approval; do not introduce new credentials, mail routes, AI API charges or automatic publishing without a separate explicit owner decision.
- The disabled-by-default prototype in `scripts/annals/` is documented at `docs/annals-pilot-runbook.md`. Code and synthetic fixtures in GitHub do **not** mean that a mailbox, an Apps Script trigger, an AI extractor or an authorised publisher is active. Its pilot categorisation is heuristic only, all outputs require review, and the publication gate is intentionally blocked. Use a dedicated mail account if authorised, never a personal or college account.
- The text-only `scripts/annals/ApprovedRenderer.mjs` refuses raw email/private fields and verifies per-entry signed exact-content approvals. **Do not** treat synthetic test receipts or an AI-generated consent string as actual permission. The human-authentication/signer service, real photo consent, live Annals page and GitHub publisher are not yet authorised or connected.
- **CoL continuity:** Current celebrity selections stay active until the actual January draft, typically held at the January Stammtisch. The calendar-year scoring period remains January 1–December 31. Treatment of deaths between January 1 and the actual draft is not confirmed; do not silently alter the importer, rollover, scores or notifications based on assumptions.
- The repository is public. Never add original private source/reference photos, private conversation transcripts, contacts, unapproved personal information, precise private gathering/entry details, or constitution drafts merely to expand the context record. Keep proposals distinct from member-approved history and seek consent for publicly archived photos/stories.

## Preferred execution machine

- **GMKtec M6 Ultra (Windows 11) is the preferred local machine** for interactive development, Codex work started on that machine, offline tests, and browser previews. Prefer an existing verified checkout; for a new checkout use `C:\Projects\Stammtisch\Repositories\Stammtisch`. This preference does not prove the checkout exists or let cloud agents access the machine.
- If executing from a cloud-only environment without access to the GMKtec, work through GitHub and use GitHub-hosted pull-request checks. State where verification actually ran. Never claim a local run was completed without observed results.
- **Never enrol the shared GMKtec, Comparative runner, or LCRS runner as a GitHub Actions self-hosted runner for this public repository.** Do not repurpose their services, credentials, work directories, or project identities.
- Keep GitHub-hosted runners for the hourly Sheet monitor, guarded website publication, GitHub Pages, OneSignal push delivery, and repository pull-request CI. These must continue when the GMKtec is off or unavailable.
- Do not change existing workflow routing to satisfy the local preference. A different execution architecture requires a separately reviewed security decision.

## Local workflow

- From the Stammtisch clone, run `node scripts/local-dev.mjs doctor` to check the local setup.
- Run `node scripts/local-dev.mjs check` before proposing code changes when the GMKtec is available. It runs the Python and Node regression tests without importing a private workbook, publishing, or sending notifications.
- Run `node scripts/local-dev.mjs preview` to serve the site only on `http://127.0.0.1:8765/` for browser inspection (Ctrl+C to stop).
- The helper requires Node.js 22+ and Python 3.12+. See `docs/gmktec-local-development.md` for the first-time checkout.
- When local execution is unavailable, keep testing through existing GitHub-hosted PR CI rather than blocking routine repository work.

## Project safeguards

- The public GitHub repository and its website must never receive secrets, Google Sheets credentials, private workbook data, or notification subscription identifiers.
- The spreadsheet is source data, not permission to publish an unverified passing. Preserve the independent death-verification, reconciliation, and fail-closed publishing checks.
- Changes to the official Celebration of Life rules must stay consistent between `docs/celebration-of-life-rules.md` and the website. The site is static; `main` publishes via GitHub Pages.
- Separate Stammtisch's local checkout and credentials from both Comparative and LCRS.
