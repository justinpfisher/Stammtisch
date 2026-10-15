# Annals photographs and member-initiated CoL revisions

Authority: Justin's implementation-and-release instruction of 15 October 2026.
This supersedes earlier per-image review for ordinary eligible photographs of
the six members, and earlier proposal/owner-adoption requirements for prospective
CoL changes. It does not expand account access, budgets or platform safeguards.

## Established baseline

Started from `76527141ac63cf983b19bb8c640604fa22827f47` (PR #74), using a managed
worktree of the existing GMKtec checkout. The original checkout has unrelated
unfinished edits and was preserved. Latest Issue #24 evidence distinguishes the
14 October ordinary-text activation from the newer uninstalled private modules.
The existing 15-minute trigger is already active; never run setup or activation
again. Pages run 38766466995 succeeded for the baseline; subsequent sheet monitor
38778062007 and push job 38778146132 succeeded. These do not verify new features.

Issue #24 still reports an unusable authenticated production browser session,
unverified installation of the recent source, an unavailable original completed
QA matrix, and deferred signing remediation. No new Google sign-in, credential
read, remediation probe or marker write was performed for this release. Existing
standing consents and evidence must be preserved. Source packaging is not install
or deployment evidence. The six prior strict QA dispositions remain open.

## Photographic publication authority

Authenticated submissions from the existing six-member allowlist may publish
ordinary photographs of those six members, drinks, recipes, objects and scenery
under the owner's standing attestation. Record its real provenance privately with
`annalsRecordSixMemberPhotoAttestation`; do not fabricate direct member replies or
backdate consent. No per-image owner approval is needed within this scope.
Individual revocations prevail. `REVOKE ANNALS PHOTO DEPICTION` holds future group
images; image-publication revocation also takes precedence over broader text grants.
The private owner can record a revocation or withdrawal even without command syntax.

The model screens content, never authenticates faces. For group images the private
policy requires authenticated source evidence that the people are only members,
and conservatively checks all six depiction grants. An unknown person stays held;
an ordinary caption such as “all six of us” can supply member evidence, without
person tagging or a mandatory form. Guests, children, uncertain photographer rights,
private addresses/interiors, readable screens/documents and sensitive/third-party
material need private clarification, separate permission or omission. Cropping
requires a separately reviewed safe derivative; the implementation does not guess
an automated crop. Original source/recipe photographs remain extraction evidence
unless independently eligible as photographs. Never publish the reference collection.

Reuse `getAttachments` with supported inline images. Up to three images per entry
are privately converted through Drive thumbnails (JPEG/PNG/WebP/HEIC/HEIF input),
orientation rendered by Drive, then parsed as baseline JPEG and stripped of **all**
APP/EXIF/comment metadata. Derivatives are at most 1000 pixels per edge, with a
combined 32 KiB limit preserving the existing 60,000-byte dispatch bound. Unsupported,
unavailable, oversized, corrupt or undecodable conversions stay private; safe text
continues independently. HEIC is a practical conversion path, not a claim that
every iPhone file is supported. Actual orientation/HEIC acceptance needs genuine
consented phone samples. Duplicate derivative hashes are omitted. No paid converter.

Each public gallery is signed into its canonical collection entry. Neutral asset
names use derivative digests; originals, filenames, addresses and face identities
never enter public data. Optional source-grounded captions are supported by the
public schema; the automatic path uses literal safe entry text and neutral alt text.
The small bounded derivative serves responsive thumbnails and tap-to-enlarge views;
there is no original-resolution public download. Lazy loading avoids eager image
archive fetches. The native dialog supplies modal keyboard handling, Escape,
previous/next, arrow keys and focus restoration. Direct image links work without JS.

`photos.html` is an index, not another content archive. Metadata shards reference
canonical entries and the same assets; filters cover year, month, collection and
source-grounded text. One action reads at most 24 records. Searching all history
may need repeated accessible **Load more** actions; it never downloads the entire
archive automatically. Unknown event dates remain unknown. `eventPeriod` supports
year/month/day precision separately from `submittedAt`. Corrections use the existing
signed correction path and visibly corrected source text; withdrawals retain replay
IDs and remove unused current derivative/shard files. Git history/caches persist.
The Photos navigation is absent until genuine eligible entries exist.

## CoL authority, interpretation and implementation

Any one genuinely authenticated member can introduce an ordinary prospective CoL
rule change. No second member, vote, owner approval or statement of prior agreement
is required. The same inbox accepts natural prose. Existing authentication and
source-ID deduplication apply before processing. `RulesProduction.gs` uses the
existing one-shot AI reservation, model, input/output bound, private evidence and
Gmail transactional facilities. The model proposes intent and exact provision edits;
unclear intent, contradictory meaning or uncertain effective dates require a focused
private clarification. Questions/jokes/quotes/recollections/discussion are not changes.

Fresh requests are separately marked at intake only after a recorded
`ANNALS_RULES_ACCEPT_FROM` boundary. **Do not reuse the existing text activation
boundary, relabel old sources, clear attempts, or adopt/replay historic proposals.**
Old comparison records retain `proposal_only` provenance. Existing ordinary-text
consent is checked for processing/publication; rule authority itself comes from
the authenticated member request, not an owner adoption action.

`RulesCore.js` binds each request to the precise version/digest, literal source
excerpts and exact before/after provisions. Its constrained data language cannot
contain executable commands or modify services, credentials, membership, sender
authentication, privacy, budgets or notifications. Semantic engineering review is
still essential: matching excerpts and an audit trail do not prove correct meaning.
Unchanged provisions remain byte-for-byte intact. The club's dry voice can be used
only after that review preserves essence and qualifications.

`RulesRelease.mjs` accepts a signed engineering bundle, never raw email instructions
or code. Calculation changes must first be implemented through a bounded reviewed
PR with regression evidence. The bundle binds the exact implementation commit and
digest of scoring/awards/import/monitor code. Official Markdown, structured rules,
website narrative and revision register form one Git commit. Unsupported changes
remain **awaiting implementation**, with the previous operative version retained.
No rule email can write arbitrary repository paths or run a supplied command.

The source spreadsheet remains authoritative. Existing credentials are Viewer-only.
This release does not invent an authorised Sheet write route or expand permissions.
Changes affecting formulas/allocations require the owner's existing supported
editor route, independent read-back/reconciliation and an exact verified source
digest bound to implementation evidence. Until available, they remain pending.
`COL_VERIFIED_SOURCE_DIGEST` is evidence from that route, not permission to edit.
An arbitrary “verified” flag, AI assertion or public register alone is insufficient.
`annalsRecordPendingRule` publishes a sanitised pending status through a separate
signed bounded dispatch; it cannot activate rules or change their narrative/code.
The desk exposes this engineering action so a source-access blocker can be visible
in the public register while the previous operative rules remain unchanged.

Submission, publication and effective timestamps are distinct. Explicit timestamps
need an offset; ambiguous dates ask clarification. Otherwise effectiveness begins
at verified coordinated publication. Toronto display retains full machine timestamps.
Future versions are recorded as scheduled and non-operative until due-time base,
implementation, source and deployment requalification. `RulesCore.select` excludes
unverified future versions. The existing bounded private intake walk queues due-time requalification;
a bounded engineering continuation must append activation evidence.
Do not silently activate a scheduled record or overwrite an intervening version.

Historical signed allocations, already-awarded benefits and results are protected
by default. Retrospective application requires an explicit period/results and the
member's statement of express club agreement, then verification of that authority
and the affected implementation. A formula alone is not retrospective authority.
January 1 scoring and the January draft remain distinct; the gap remains unresolved.
Death verification, Birthday Buffet discovery evidence, approved exceptions and
notification deduplication are unchanged. No CoL passing alerts are used here.

## Revision register and transactional feedback

`col-revisions.html` links from the main rules. Its dated baseline preserves existing
rules/verified editorial confirmations without manufacturing amendment chronology.
The append-only schema records stable IDs/links, first name/approved illustration,
submission/publication/effective timestamps, explanation, affected provisions,
expandable exact wording, base version, correction/reversal links and status events.
Original email, authentication, consent and mapping excerpts remain private.
Sanitised awaiting-clarification/implementation, scheduled, active, failed and
superseded records can be displayed. Current production has **zero new revisions**.

Private authenticated acknowledgement and interpretation/clarification outcome
notices reserve one-shot markers before Gmail sends. Unknown sends are never retried.
The final publication notice must follow exact hosted reconciliation, not dispatch
acceptance. `annalsReleaseRuleImplementation` signs only the stored request plus bounded
engineering evidence, serialises through one private pending record and dispatches
once. The existing intake walk reconciles all five exact public files before
recording live acceptance and sending the final notice. Due-time checks queue a
fresh engineering qualification, never replay a dispatch. These adapters and the
coordinator/disabled hosted workflow are source implementations, not proven
unattended end-to-end adoption. Semantic implementation review and a supported
Sheet editing/read-back route remain external engineering dependencies.

## Disabled gates and exact owner-controlled handoff

1. Preserve the current private project, deployment URL/owner-only permissions,
   single trigger, activation/cursor, consents, quarantines, one-shot records,
   ledgers, budget and token expiry. Restore a usable owner session through the
   existing approved handoff only; no repeated sign-in attempts are authorised here.
2. Install the exact merged source kit **in place**. It now includes PhotoContracts,
   PhotoProduction, RulesCore and RulesProduction with the existing modules/manifest.
   Advance the existing web-app version; saving source does not advance deployment.
   Record installed commit/module hashes and actual deployment version privately.
3. Record the 15 October six-member photo attestation through the existing private
   consent mechanism, respecting revocations. Do not ask for ordinary per-image
   consent again. Preserve all older attestations and audit provenance.
4. The final signing-remediation step remains owner-controlled and **outside this
   task**: do not read/regenerate/rotate keys, run remediation probes, or write a
   completion marker. The existing editorial release runbook remains the exact
   separate secure handoff. No verified completion evidence was found in Issue #24.
5. Until that step and hosted genuine acceptance are evidenced, leave
   `ANNALS_AUTO_MEDIA_ENABLED`, `ANNALS_PHOTOS_V2_ENABLED`,
   `ANNALS_PHOTOS_HOSTED_ACCEPTED`, `ANNALS_RULES_V2_ENABLED`,
   `ANNALS_RULES_HOSTED_ACCEPTED`, GitHub `ANNALS_PHOTOS_V2_RELEASE_ENABLED` and
   `ANNALS_RULES_V2_RELEASE_ENABLED` off/unset. Do not set
   `ANNALS_SIGNING_REMEDIATION_VERIFIED` merely to pass the hosted job guard.
6. Qualify the private rule release adapters and supported source
   consistency route before enabling rule intake. Record a new rules boundary
   only for future fresh requests. Qualification needs genuine member-intended
   content: a permitted member photo/phone sample and a fresh authenticated operative
   rule request with exact clarified meaning. Do not email examples as acceptance.
7. Verify actual installed source, permissions, trigger preservation, private
   one-shot acknowledgements, signed dispatch, hosted checks, coordinated Pages bytes
   and final private outcomes separately. Physical iPhone/Android and assistive
   technology acceptance, original six QA dispositions and genuine archive-content
   acceptance remain outstanding. Mock tests and emulation cannot close them.

The application/provider US$5 ceilings, recharge-off control, permanent ten-cent
attempt reservations, 8 November 2026 00:00 UTC processing stop and 9 November UTC
dispatch expiry remain unchanged. Existing restricted token expiry is not extended.
No additional paid service, credentials, OAuth scopes, account system or group mail.
Hosting, monitor, CI, Pages and push stay GitHub-hosted and GMKtec-independent.

## Qualification and rollback

Run `node scripts/local-dev.mjs check` and the fictional browser suite. New tests
cover 2,500 metadata records, source mapping, unilateral authority, spoof/replay,
intent, default/future dates, retrospective authority, stale bases, source mismatch,
metadata, revocations, duplicates and default-off gates. No fabricated archive
content or rule is written by those tests. Byte-level JPEG parsing does not prove
real phone orientation, reliable AI screening or human consent.

On failure, keep the previous operative rules/Sheet version. Leave new flags off,
retain uncertain reservations and reconcile before any new operation. Revert the
presentation/source commit through a reviewed Git revert if needed; preserve
retired photo IDs, revision records and status events in a forward fix. Roll back
the private web-app to its recorded previous deployment without resetting Head
trigger state or private storage; account for its Head-source execution separately.
Never restore an exposed key or replay accepted/unknown dispatches. An adopted
rule reversal is a new linked revision, not deletion of history.

## Illustrative emails only — never real club content

To: annals@stammtischbrewery.com
Subject: A photograph for the Annals
“Here are my photographs of the glasses and all six of us. I took these myself.
Caption: Glasses raised. I do not remember the event date.” Attach the actual images.

To: annals@stammtischbrewery.com
Subject: Change to the CoL prize rule
“Please change the annual prize from $100 to $120 for scoring years beginning
January 1, 2027, at midnight Toronto time. Leave every earlier prize and result
unchanged.” This example is not adopted; it would require qualified implementation
and source-consistency checks.
