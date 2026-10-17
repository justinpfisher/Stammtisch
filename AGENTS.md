> **Latest release checkpoint — 17 October 2026 (GitHub merged; private acceptance incomplete):**
> Public `main` contains [PR #94](https://github.com/justinpfisher/Stammtisch/pull/94) (supervised CoL acceptance)
> and [PR #95](https://github.com/justinpfisher/Stammtisch/pull/95) (owner-only signing diagnostic).
> The last independently verified private installation is **Stammtisch Annals — Production v32**;
> newer merged private source is **not confirmed installed**. A genuine 17 October
> read-only check confirmed old private/public signatures rejected, new private
> signing valid and GitHub signing-key consistency at that moment. **This is not**
> the required immutable signing-qualification record or permission to activate.
> Do not re-rotate keys based solely on stale incident notes. Verify live owner-only
> state, outstanding/uncertain operations and the historical missing withdrawal
> proof; then diagnose the blocked recorder using a newly fresh challenge.
> Leave ordinary, photo, History and CoL publication gates closed until separately
> qualified. See [current signing handoff](docs/annals-signing-consistency.md)
> and [Issue #24](https://github.com/justinpfisher/Stammtisch/issues/24).

> **Current authority — 15 October 2026, photographs and CoL implementation:**
> Read [the current photo/CoL release and handoff](docs/annals-photos-col-release-2026-10-15.md).
> The owner authorises automatic eligible six-member photographs under standing
> private attestation, subject to revocations and exceptional third-party/privacy
> holds. One genuinely authenticated member may independently introduce a prospective
> CoL change; no second member, vote or owner-adoption approval is required.
> Older proposal-only/per-image restrictions below are superseded within that scope.
> Preserve source consistency, exact meaning, historical results and all platform
> safeguards. New capabilities stay disabled until signing remediation, hosted
> acceptance and the documented private adapters are qualified.

# Stammtisch repository working instructions

## Current Annals release authority — 15 October 2026

The owner's final QA/editorial/history/CoL assignment supersedes older category
and display proposals below. Read `docs/annals-editorial-release-2026-10-15.md`
and `docs/annals-october-2026-qa-summary.md` first. Ordinary text production was
already activated; never repeat setup or reset live state. New merged private
source is not proof of an updated Apps Script deployment. The reported
signing exposures required owner-controlled remediation. On 17 October,
point-in-time historical-signature rejection and GitHub publishing-key equality
were verified. The one-time immutable security qualification and feature-specific
hosted acceptance remain unverified; do not repeat rotations merely because
older incident notes described them as pending. Do not enable new publishing
capabilities before all current gates qualify. History signing is separately
gated and disabled by default. Use four surviving collections, display-only recipe/date/
redaction transformations, and private protective CoL proposal routing. A
proposal is never adoption. Automatic media remains off. Preserve all CoL rules,
records, awards and notifications. Do not close the six original QA failures
without the private completed matrix and case-level evidence.


## Club identity and institutional memory

- Before changing club-facing narrative, membership descriptions, the Annual Assembly, image choices, or club traditions, consult `docs/club-context-and-history.md`. It consolidates relevant prior conversations **without** converting unapproved draft governance into adopted rules.
- `docs/website-opportunity-review-2026-10-08.md` is a research/recommendation record, not authorization to implement its feature ideas. Preserve existing CoL and notification authorities and request an explicit product decision for new features.
- **Owner-confirmed club rhythm (8 October 2026):** Meetings take place on the **third Friday each month**, often at headquarters; the **Annual Gentlemen's Assembly is a separate off-site gathering**, typically at a rented cottage. The owner confirmed the monthly **8 p.m. America/Toronto start on 15 October 2026**; count down to that hour on the third Friday. Never reveal the private headquarters address. The monthly `stammtisch-monthly.ics` is an all-day *date reminder*, not a claim of all-day attendance. The countdown retains the current gathering through the meeting day, shows that it has begun from 8 p.m., and advances at Toronto midnight. Follow `monthly.mjs` and its tests.
- Members sometimes prepare special cocktails with homemade syrups. Preserve the tradition in the club briefing, but never fabricate historical recipes, authorship or photos. If building the proposed Annals/Cocktail Register, read `docs/annals-publication-guidelines.md` and get approval for each new sensitive contribution or image.
- To configure the club's custom-domain receiving address, consult `docs/annals-email-routing-work-handoff-2026-10-08.md`. Prefer existing Porkbun free forwarding only after verifying current registrar/DNS/MX and existing mail. Never repoint MX, change nameservers, initiate a paid service or install automation without relevant owner authorisation; route originals only to a dedicated private account, never a personal/college inbox.
- **Owner authorisation, 10 October 2026:** Automatic publication is approved as the **default** for ordinary, *source-grounded* member text (including contributor-owned quotations) after genuinely authenticated allowlisted email and **two separately affirmative, revocable member permissions** (AI processing and public automatic text publication). This supersedes per-entry owner review for eligible text and separately screened, consented non-identifying photographs; minor editorial uncertainty is not a reason to hold. Clearly marked editorial suggestions may fill missing recipe steps or amounts, but recorded original quantities must remain authentic. Identifying images, concrete private details, unconsented third-party quotes, sensitive allegations and unclear rights remain privately held. Consent must come from each actual member, not the owner on their behalf. See the current `docs/annals-production-runbook.md` and `scripts/annals/AutoCore.js`. The older email proposal is historical, not authority. Never put raw submissions, contacts, private originals, consent records or account secrets in any public GitHub surface.
- **Register of Remarks — owner decision, 10 October 2026:** The existing quotation category is named **The Register of Remarks**; display a verified quotation beside its speaker's owner-approved Annals illustration, not the member who submitted it by email. Require exact source-matched words, authenticated sender, separately recorded active speaker-specific permission for future quoted remarks and public likeness attribution, and a distinct signed quote publishing mode before any unattended third-party quotation. Keep email-to-speaker mapping and scoped consent evidence only in the owner-controlled private script. Unknown identities or permissions stay held. Reuse the approved `assets/members/annals/` images from merged PR #44; do not publish private originals or overwrite contributor credits, CoL or notifications. Production remains OFF until private setup and preflight.
- **Illustrated contributor option, 10 October 2026:** An ordinary authenticated Annals submission can display a small member illustration rather than a name/email **only** after its contributor's separate private, affirmative and revocable `contributorPortraitPublication` grant. This differs from the Register of Remarks speaker portrait and must not be inferred from that speaker's quote permission alone. Preserve exact signature validation, source authentication, per-entry omission, opt-out via HIDE MY ANNALS PORTRAIT, six-only private mapping and non-public consent provenance. Neither photographs nor email addresses may enter public GitHub.
- The disabled-by-default prototype in `scripts/annals/` is documented at `docs/annals-pilot-runbook.md`. Code and synthetic fixtures in GitHub do **not** mean that a mailbox, an Apps Script trigger, an AI extractor or an authorised publisher is active. Its pilot categorisation is heuristic only, all outputs require review, and the publication gate is intentionally blocked. Use a dedicated mail account if authorised, never a personal or college account.
- `scripts/annals/ApprovedRenderer.mjs` validates separately signed text, image and manual exact owner approvals. The optional image path in `MediaCore.js` / `MediaPolicy.js` uses a privately screened, metadata-stripped derivative and never publishes originals. Neither AI output nor a simple sender allowlist is publication consent. Preserve private authentication, policy checks, publisher signature validation, censorship notice, deduplication and private live reconciliation. Automatic publication stays **OFF until** the newer Apps Script source, GitHub keys, six-address private allowlist, actual member consents, provider spending controls and owner-only account permissions are verified. Never infer activation from merged source or synthetic tests.
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
