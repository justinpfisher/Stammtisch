# Annals editorial release — qualification and operating boundaries

Owner authority: the 15 October 2026 final-QA/editorial/history/CoL assignment.
This supersedes older category and display proposals. It does not adopt any CoL
amendment or activate photographic publication.

## Implementation and activation are separate

The public renderer provides recipe introduction filtering, Month Year labels,
black redaction bars with lowercase fallback, and surviving collection labels.
These are display transformations: existing signed entries and digests stay
unchanged. Legacy monthly/artefact entries still validate for existing evidence,
correction and withdrawal, and render under Club History.

The private production source adds protective CoL routing, an owner-only
proposal comparison, and a conservative source-first history ledger. These
features are **not live merely because this source is merged**. Until the
private source is updated, legacy automatic history/monthly/artefact requests
are rejected by the public publisher because they lack distinct narrative
authority. The older desk may show them awaiting verification; preserve their
attempts and do not resend them. The existing
private Apps Script project must be updated and its existing owner-only web-app
deployment version advanced. Do not reinstall it or reset any live records,
permissions, cursor, activation boundary, schedule or reservations.

The cloud workspace has no authenticated Google production session and cannot
rotate its credentials or update that private deployment. History publication
remains disabled by default in both Apps Script and GitHub. No new production
publication capability may be enabled until signing remediation is verified.

## Public presentation

- Final collections: The Cocktail Register; The Register of Remarks; Annual
  Assemblies; Club History. Hide empty collections. No invented filler.
- `EditorialDisplay.mjs` removes literal structured-recipe duplication from the
  rendered introduction. Complete narrative sentences survive; recipe-only
  entries have no generated introduction. Recorded quantities and instructions
  stay in their structured lists and in the private originals. Ambiguous
  fragments are omitted from the introduction rather than rewritten as facts.
- `Submitted YYYY-MM` is displayed as `Submitted October 2026`, for example.
  Internal canonical dates, signed data and event/receipt distinctions remain.
- Strong profanity is replaced privately by `[expletive]`; the renderer turns
  either case of that harmless token into an opaque black bar. With styles
  absent or forced colours active the readable lowercase token remains. The
  token is real text for assistive technology and safe copying. No original
  profanity enters public text, alt text or JSON. `[POOP]`, mild language, exact
  source verification and speaker-specific permissions remain in force.
- Redacted quotations display: **Editorially redacted quotation — not verbatim.**
  The bottom notice preserves the disclosure that the Committee is AI we tried
  to train. Original uncensored text remains private.

## Club History

The dedicated reader is `history.html`; its Annals link appears only after a
qualified narrative exists. It has chapter headings, readable paragraphs and
minimal controls. The empty reader invents no origins, dates or traditions.

`HistoryCore.js` keeps exact source passages, source/claim identities, receipt
timestamps, separately evidenced event periods, uncertainty, chapter and
ordering privately. The owner assesses topic keys, evidence and factual status
in the existing authenticated desk. New claims require reconciliation; the
offline core permits unattended corroboration only for an unchanged already
reconciled claim. **General unattended semantic rewriting is not qualified or
activated in this release.** A new email does not automatically establish
historical truth or overwrite existing prose.

Conflicting claims on a factual topic create a private dispute record; the
owner must explicitly reconcile them before a correction. Exact corroboration
does not duplicate paragraphs. Corrections replace only the affected factual
topic and preserve all prior claims/revisions. A source withdrawal removes
every dependent passage while preserving private evidence. Withdrawal remains
possible after contributor consent is revoked. Unknown event dates remain
unknown; ordering is explicitly reviewed, never inferred from email receipt.

The conservative narrative uses exact source passages and fixed editorial
joins, labelling recollections as such and retaining material uncertainty. It
does not run a second model pass or paraphrase unsupported historical facts.
Stable unaffected chapters retain their wording. Further fluent autonomous
claim extraction/reconciliation requires qualification beyond these controls.

`HistoryProduction.gs` prepares an exact preview, compares the current private
ledger digest and public previous revision, rechecks active-source permissions,
then reserves an immutable one-shot attempt. A distinct
`source-grounded-history-revision-v1` signature binds the full public document
and previous digest. A changed base, invalid/expired signature, wrong key,
duplicate revision or uncertain operation stops publication. Pending evidence
is never redispatched automatically. Only exact matching hosted JSON and
generated HTML allow private reconciliation to commit the new ledger. Private source
relationships do not enter the public document.

Publication needs all of the following, **after** security remediation and
hosted qualification: a third independent `ANNALS_HISTORY_SIGNING_KEY` in the
existing private project and GitHub secret; GitHub variable
`ANNALS_HISTORY_RELEASE_ENABLED=true`; private
`ANNALS_HISTORY_PUBLICATION_ENABLED=true`; and an owner-recorded
`ANNALS_SIGNING_REMEDIATED_AT`. These controls are not set by this release.

## CoL proposals

The independent whole-email protective route precedes AI processing and is
rechecked before manual review, signing/dispatch and automatic eligibility.
Potential CoL amendments, including mixed-intent messages, remain private even
when a category proposal says cocktail or quotation. The check intentionally
holds ambiguous rule references. It is a conservative language heuristic, not
a claim to understand every possible formulation.

The private desk snapshots the current official provision and its digest,
stores proposed exact replacement wording and a before/after comparison, and
records effects/questions for scores, selections, awards, drafting, rollover,
notifications, effective dates and retrospective application. For a complete consented proposal, the existing one-shot AI path privately
suggests replacement wording, effects, unresolved interpretations and a
recommendation against a captured official-rules snapshot. Those suggestions
remain explicitly unverified. No second paid attempt is allowed; over-limit,
ambiguous or failed outputs stay held. The owner can edit the private comparison;
manual fallback effect fields remain unassessed until actually reviewed.
Each version is preserved privately. There is **no adoption or rules-editing
API** in this workflow. A separate authenticated, explicit owner confirmation
of an actual club decision is required before a later implementation task can
change official text or calculations.

No CoL source data, awards, confirmed allocations, spreadsheet, death
verification, deduplication or notification code changes here. January 1
calendar-year scoring and the actual January draft remain distinct; the
intervening-January ambiguity remains unresolved.

## Signing remediation — owner-controlled, still pending

The owner reports two signing credentials appeared in private tool output, with
no reported public exposure. The completion matrix is unavailable here; the
affected names have **not been privately confirmed**. This architecture uses
`ANNALS_APPROVAL_KEY` (private receipts) and `ANNALS_PUBLISH_SIGNING_KEY` (public
dispatches). Confirm the affected names from the private report; do not treat a
similarly named API credential as identified by inference.

Secure owner actions, without sending any values to chat:

1. In the existing private project, temporarily set
   `ANNALS_AUTO_PUBLICATION_ENABLED=false`, leave history/media off, and refrain
   from manual approvals/dispatches. Preserve the trigger and all private state.
   Reconcile outstanding accepted/unknown dispatches; do not replay them.
2. Privately preserve the audit records and verify the current public archive
   after pending workflows finish. It was empty during this review. If it has
   since become populated, preserve and plan exact re-attestation of existing
   approvals before rotating: the archive verifier uses the current public key.
   Do not keep a compromised key as an accepted publishing key or silently
   re-sign uncertain pending requests.
3. Generate two independent replacement secrets using a trusted local password
   manager or cryptographic generator, at least 32 characters each. Enter them
   directly in their existing secure Apps Script properties. Enter the identical
   replacement **public publishing** key directly into the GitHub repository
   secret `ANNALS_PUBLISH_SIGNING_KEY`. The private receipt key stays private.
   Never paste or screenshot values in chat or public logs.
4. Install the qualified source into the existing private project: the seven
   existing production source/UI files, plus `HistoryCore.js`,
   `GovernanceCore.js`, `HistoryProduction.gs`, and the shared pure
   `PublicDisplay.js`, plus the existing manifest.
   Preserve deployment URL, owner-only access and the existing schedule. Do
   not install historical `Code.gs` or `SyntheticPilot.gs`.
5. Use the owner-authenticated `annalsCheckSigningRotation` with an existing
   private signed diagnostic record. It returns booleans only: a new private
   signature validates and the old private/public signatures fail under the new
   keys. Originals remain unchanged. This does **not** verify the GitHub secret.
6. Advance the existing web-app deployment version. Preflight must still show
   existing owner-only storage, consents, separate keys, cursor/boundary and
   ledger. Restore ordinary text publication after a legitimate future request
   verifies through Actions, Pages and private live reconciliation. Use genuine
   eligible content if available; do not resend an old uncertain attempt.

The automated offline tests demonstrate old-key rejection using fictional
keys. They are **not evidence of actual production credential rotation**.
History activation additionally needs its own hosted acceptance and remains off.

## Limits, regression and rollback

The full cloud offline check now passes **64 Python and 247 Node tests**.
The original release below passed 237 Node tests; the continuation adds ten.
These include integrated private service mocks, exact history signing/replay,
revoked-consent withdrawal, protected proposal routing, unchanged recipe
measurements, display-only digest preservation and ordinary CoL regressions.
They are not physical-device, live Gmail or Apps Script deployment acceptance.

No provider requests or new AI reservations were made by this release work.
Owner-reported October reservations remain US$3.20 of US$5.00; US$1.80 headroom
is reported, not a freshly read provider balance. Preserve the processing stop
at **8 November 2026 00:00 UTC** and restricted token stop at
**9 November 2026 00:00 UTC**. The private dispatcher now explicitly enforces
the latter. No limit, paid service, token scope or deadline is extended.

Ordinary incoming dispatch approvals expire after 24 hours; existing archived
attestations remain verifiable. Withdrawn IDs are retained in a public-safe
replay ledger. Corrections require a newer approval timestamp than the current
entry. History and ordinary publication share one GitHub concurrency group.

Rollback: keep the preceding Apps Script deployment version, source commit and
private audit snapshots. Stop new publication before a rollback, reconcile any
reserved/accepted operation, and never reset attempt markers. Keep the protective
proposal hold in place if reverting a presentation change. Disable the history
flag in both environments before reverting its reader/publisher. Once new
withdrawal replay IDs exist, do not return to a publisher that ignores them;
forward-fix it or preserve their denial explicitly. No old credential is restored
as part of rollback. No source evidence, ledger or consent is erased.

Remaining acceptance gaps: unchanged completed QA matrix and exact six-case
reconciliation; actual two-key rotation; authenticated private deployment;
hosted genuine-content acceptance for the new private workflows; iPhone Safari,
Android Chrome and assistive-technology device checks. The cloud browser can
inspect the live desktop site but cannot reach this workspace's private local
server. Photographic qualification remains separate and disabled.


## Release execution evidence — 15 October 2026

- [PR #69](https://github.com/justinpfisher/Stammtisch/pull/69) merged at
  `fef98b2285cdc44898155d1fadd24197e53b9b8b`; implementation head
  `bf8ff3bb725ed622e9ffc91fc8a126a7de88a2df`. The remote source tree exactly matched
  the locally tested tree (`b15b97f17238aef69b5802580972ca97ce23a129`).
- [GitHub-hosted CI](https://github.com/justinpfisher/Stammtisch/actions/runs/38743520514)
  passed all **64 Python and 237 Node tests**, plus the existing public CoL
  register connectivity check. The implementation review is recorded on the PR;
  it is not an independent production acceptance or a private-credential audit.
- [Pages deployment](https://github.com/justinpfisher/Stammtisch/actions/runs/38743729887)
  succeeded for the merged commit. The preceding Pages run was cancelled and
  superseded by this successful deployment.
- At **13:35:20 UTC**, all four public files below returned HTTP 200 and matched
  the released bytes exactly. The live desktop browser independently showed the
  new notice, empty Annals and empty dedicated History reader. No fabricated
  history, recipe or member quotation was published for acceptance.

| Public path | Verified SHA-256 |
| --- | --- |
| `annals.html` | `fd8c778b846fd79dfd5fadde0d9a07e435d083af9851e1b2b8b6f02a4c5997d7` |
| `history.html` | `8b49391e65c60f25c36937b15421ab7445cfa0f97af0401978fae93fc0438f10` |
| `data/club-history.json` | `96a743e83e479bf1d4f5d04803b485d46196817b1d9187d071d3193a39ad9281` |
| `data/annals-approved.json` | `c7ef371fd3108000284e7f011095f668ef5f94e078d649847035cf7ca388c6e5` |

Public locations: [Annals](https://stammtischbrewery.com/annals.html) and
[Club History](https://stammtischbrewery.com/history.html). Empty collections
remain hidden from Annals navigation. Rendered recipe/date/redaction behaviour
is covered by fictional offline exact-signature tests; because the archive is
empty, it is not claimed as genuine-content live acceptance.

Private Apps Script installation, actual credential rotation, the six original
case-level dispositions, genuine-content end-to-end acceptance, physical-device
and screen-reader checks remain **blocked/unverified**. General unattended
history interpretation is **not qualified**. No production setting, consent,
cursor, trigger, activation timestamp, ledger, paid allowance or actual CoL rule
was changed by this cloud release work.


## Interruption and source-integrity follow-up — 15 October 2026

Ten additional fictional offline regression cases cover the following fixes.
These findings are independent of the six original strict QA failures; the
completed private matrix is still required to determine their disposition.

- An intake retry can resume after saving an immutable original but before
  saving its private source record. It reuses only an identical original and
  refuses changed evidence; it does not replay a paid extraction or dispatch.
- A CoL provider response that cannot be read is recorded as unknown delivery.
  The existing one-shot reservation remains consumed, with no automatic retry.
- History live reconciliation requires the exact generated HTML as well as
  the exact public JSON. A matching revision marker alone is insufficient.
  A retry can finish after an interrupted final status save while preserving
  the original live audit timestamp and never re-dispatching publication.
- Corroboration cannot change certainty, evidence status or passage order.
  Corrections require a new claim identity. Private claim validation rejects
  inherited chapter names, invalid receipt dates and non-boolean active flags.
  Before signing, every active claim is rechecked against its immutable source
  and current permissions, including claims in unchanged chapters.
- Recipe filtering omits an entire duplicated or ambiguous recipe clause;
  it never manufactures a sentence by cutting an ingredient phrase from its
  middle. Distinct submitted introductory sentences remain intact.

`PublicDisplay.js` is a pure shared renderer used by Node and the private script
for exact history HTML comparison. It must be installed in the existing Apps
Script project alongside the other qualified files. The current empty Annals
and History HTML remain byte-identical to the preceding release. No signature
format, signed record, official CoL provision, publication switch, consent,
media setting, budget or deadline was changed by this follow-up.

The cloud offline suite passed 64 Python and 247 Node tests. Private deployment,
credential rotation and genuine-content acceptance remain unverified; merging
this follow-up does not perform those owner-account operations.

Follow-up implementation: [PR #71](https://github.com/justinpfisher/Stammtisch/pull/71),
source `5772522004774832bfa40556ab28101c83ddf5bc`, tested tree
`5d376cb5c52bce16a997ee82f89b92ab9e040f51`.
[GitHub-hosted regression run 38752944919](https://github.com/justinpfisher/Stammtisch/actions/runs/38752944919)
passed all 64 Python and 247 Node tests and the existing public CoL register
connectivity check. A later documentation-only commit corrects the older
revision-marker description to the exact-HTML check.


## Owner sequencing decision — 15 October 2026 (rotation deliberately last)

The owner explicitly requested that **all independent QA, readiness and private-installation
work proceed now, while the two reported signing-key rotations are postponed
until the final security step**. This changes the work sequence, **not** the
assessment of exposed secrets or the authority to enable new publication.

### Work authorised before rotation

1. Obtain the *completed* private 30-case QA results matrix, leaving its
   original unchanged. Reconcile the six strict mismatches case by case;
   distinguish false publications, false holds and presentation differences.
   The original unexecuted test register is insufficient evidence.
2. Run focused offline and hosted regression checks, source-integrity checks,
   accessibility checks that do not require physical devices, and private
   owner-only workflow reviews. Avoid repeated paid AI requests or replaying
   uncertain one-shot dispatches.
3. Prepare the existing Apps Script project for an in-place qualified source
   update, including `HistoryCore.js`, `GovernanceCore.js`,
   `HistoryProduction.gs` and `PublicDisplay.js`, plus all required
   current production source/UI files and manifest. **Only perform the
   private installation through an authenticated owner session.** Preserve
   the owner-only deployment URL, triggers, registry, ledger, inbox cursor,
   activation timestamp, audit evidence and existing configuration.
4. A controlled temporary pause of ordinary publication is permitted for
   deployment and reconciliation. Preserve the existing text service; do
   not introduce a new publishing permission or create new credentials.
   Confirm private consent and CoL proposal routing with safe fictional
   offline fixtures and owner-only private tests. Never publish such
   fixtures to the public archive.
5. Document exact independent checks, hosted acceptance still pending,
   physical-device/screen-reader results when available, and any genuine
   owner-access blocker. The code and public pages are already deployed
   through PRs #69 and #71; do not confuse that with a private Apps Script
   deployment.

### Non-negotiable interim safeguards

- **Do not rotate or reveal any signing credential yet.** Do not read
  secret values into AI/tool output merely to identify them.
- **Do not enable new history publication, new public-media publication,
  broader CoL automation or unqualified automatic history rewriting.**
  Keep `ANNALS_HISTORY_PUBLICATION_ENABLED` and
  `ANNALS_HISTORY_RELEASE_ENABLED` disabled until the distinct
  signing remediation and hosted qualification requirements are met.
- A CoL rule email remains **only a private proposal**, never adoption.
  Do not change adopted rules, scoring, recipient allocations,
  deduplication or notification behaviour.
- No inference that postponing rotation makes exposed credentials safe.
  Preserve current incident evidence and include rotation, old-key
  rejection and exact hosted signing verification as the **final**
  security/activation stage, not as already completed.
- Respect the 8 November AI processing stop, 9 November publishing-token
  expiry and existing US$5 monthly application reservation ceiling.

### Completion criteria for this interim stage

Give a case-level QA reconciliation or explicitly state the missing private
evidence; a deployment version / preflight record if the actual private
project was updated; results of available independent accessibility and
workflow testing; and a precise final security/activation handoff. Do not
call history automation or private CoL routing live until directly verified.


## Non-rotation acceptance continuation after PR #72 — 15 October 2026

**Private installation remains blocked, not completed.** One navigation to
Apps Script home in the available cloud browser returned Google's public
Apps Script information page with a Sign in link. No authenticated project
editor or deployment was available. No login retry, password operation,
source installation, publication pause or deployment-version change occurred.
The newly connected Drive service can read production evidence, but exposes no
Apps Script source-update/deployment operation. Drive OAuth does not prove a
signed-in browser session. No secret-recovery file, signing value or signing
remediation marker was read or changed.

The GMKtec Windows filesystem is not mounted or otherwise accessible. Searches
of the accessible workspace, Library and connected Drive did not find the
completed `private-results-matrix.html`. Do not substitute the unexecuted
register or a new reconstruction for the missing original. The
[sanitized QA summary](annals-october-2026-qa-summary.md) now includes a
case-by-case read-only inventory of actual production evidence. All 30 sources
matched uniquely; 18 have historical live verification and corresponding
withdrawal evidence, and all 30 have quarantine evidence. Q02 additionally has
an owner-confirmed, no-AI recovery and subsequent live verification. Four
classification holds and one category discrepancy are identified for further
matrix reconciliation. The exact original six strict dispositions remain open.
A separately retained private evidence inventory contains no raw submissions
or credentials and preserves the original records unchanged.

The private consent registry was read without alteration. It contains six
active AI-processing grants and six active grants each for standing text,
quote attribution and contributor portraits. This is a current registry read,
not a new consent registration, account preflight or publishing activation.
No current Script Properties budget/cursor/activation value was inspected.

### Independent routing correction

Offline probes reproduced an ordinary-publication bypass for natural wording
such as “Here is my new points formula”, “I recommend a different drafting
procedure”, and “Can we use a different draft order?”. The prior detector also
missed an ambiguous scoring-rules question. `AutoCore.js` now recognises these
proposal cues and conservatively routes explicit rules/scoring/drafting
references privately, independently of category. This may hold some harmless
rule-related text; private clarification is preferable to accidental ordinary
publication of a suspected amendment. An ordinary cocktail recommendation
without a governance reference remains on the Annals path.

Two new fictional regression cases exercise both subject/body routing and
private review/lower-level dispatch refusal. The full cloud offline suite
passes **64 Python and 249 Node tests**. All provider and dispatch services in
these tests are mocks. No real AI call, reservation, mail, dispatch or CoL rule,
score, allocation, spreadsheet or notification change occurred. This fix needs
the pending private source installation before its live route can be claimed.

### Available browser accessibility evidence

Actual desktop Chrome observations at 1363 × 936 CSS pixels on the empty live
Annals and History pages confirmed one H1 and main landmark per page, visible
keyboard focus, working Skip to content followed by the first main-content
link, and no horizontal overflow. Visible navigation/contribution links were
at least 44 pixels high. History uses a 720-pixel reading column and 17-pixel
body text; measured foreground colours on the live cream background give
contrast ratios of 4.95:1 or higher for the inspected brass, muted, forest and
link colours. Screenshots were inspected privately, not saved as deliverables.

This is **desktop browser evidence**, not device emulation, physical iPhone/
Android acceptance or VoiceOver/TalkBack testing. The available browser API
exposes no viewport/device/forced-colours emulation control; an attempted zoom
shortcut did not change the measured viewport and is not counted as coverage.
The live archive is empty, so populated recipe/date/redaction/portrait layouts
remain covered by offline fixtures, not by genuine-content browser acceptance.
No fictional content was published to obtain those screenshots.

### Remaining in-place installation and final security boundary

Once the existing authenticated owner project is accessible, install the
qualified files from current main without creating a new project or resetting
state: `PilotCore.js`, `ProductionCore.js`, `AutoCore.js`, `MediaCore.js`,
`MediaPolicy.js`, `Production.gs`, `ReviewUi.html`, `HistoryCore.js`,
`GovernanceCore.js`, `HistoryProduction.gs`, `PublicDisplay.js`, and the existing
`production-appsscript.json` manifest. Do not install legacy `Code.gs` or
`SyntheticPilot.gs`. Add dependencies before changing their callers. Preserve
OAuth scopes, owner-only access, URL, existing schedule and all properties and
private files. A code update must not run setup, clear attempts or automatically
reassess quarantined/uncertain submissions. Record the actual installed source,
existing deployment's new version and safe boolean preflight results; source
checksums and a merged PR alone are insufficient. No fresh installed version
is claimed in this continuation.

Signing rotation remains the explicitly deferred final stage. Do not invoke
the rotation probe or set `ANNALS_SIGNING_REMEDIATED_AT` during this interim
work. Leave History and automatic media publication disabled. After eventual
rotation, verify old-key rejection and matching future exact-content signing
through the existing secure settings, followed by genuine eligible hosted
acceptance; never resend an uncertain earlier dispatch. Distinct History
activation requires its own qualification after that security stage. The
November 8 AI stop, November 9 dispatch expiry and US$5 monthly ceiling are
unchanged. US$3.20 remains the last owner-reported reservation, not a fresh
private balance verification.


## Further account-independent qualification — 15 October 2026

A separate GitHub-hosted browser workflow now exercises the real public
renderers against fictional fixtures served only on an ephemeral loopback
address. It has read-only repository permissions and no private credentials,
mailbox, provider request, dispatch or live-data input. The browser contexts
block all non-loopback requests. No generated fixture HTML or history JSON is
written to the public archive or Pages. Test dependencies are pinned with a
lockfile under `tests/browser/` and installed only for this optional workflow.

The planned profiles are desktop Chromium, WebKit with an iPhone descriptor,
and Chromium with an Android descriptor. Checks cover whole recipe narratives,
exact quantities and syrup/preparation divisions, recipe-only introduction
omission, December/January month display, event/receipt separation, black bars,
lowercase selectable fallback, quotation notices, stylesheet loss, keyboard
skip/focus/target size, populated 320px reflow and dark preference. A separate
Chromium check exercises forced-colours fallback. This is browser emulation,
not physical Safari/Chrome, VoiceOver or TalkBack acceptance. Hosted results
must be observed before claiming these checks passed; source alone is not
qualification. Genuine eligible-content hosted acceptance remains separate.

The normal supported offline check now includes **66 Python and 251 Node tests**.
The two additional Python cases verify the source package whitelist, unchanged
file hashes/manifest, reproducibility and refusal to write artifacts into the
public checkout. They do not authenticate or install a private project.

### Ready-to-install source package

Run from the checkout, using an exact reviewed commit and a destination outside
it:

```sh
python scripts/annals/build-install-package.py --ref COMMIT --output /private/path/annals-install.zip
```

The builder reads only twelve explicitly allowed files from git objects. It
maps public `.js` module names to native Apps Script `.gs` filenames, maps the
existing production manifest to `appsscript.json`, and adds a source-commit/
SHA-256 manifest plus in-place instructions. File content, OAuth scopes and
private exception policy remain unchanged. Fixed archive metadata makes
repeated builds with the same source and toolchain reproducible. The package
contains no private originals, contacts, consent registry, account settings,
credential-recovery file, signing value or QA evidence. Legacy `Code.gs` and
`SyntheticPilot.gs` are excluded.

The ZIP does not authenticate, install, change a deployment, create a trigger,
rotate credentials, set remediation markers or activate a publisher. Actual
installation still requires the authenticated existing owner project. Preserve
its previous deployment for rollback, URL/access, consents, trigger, cursor,
activation boundary, budget and one-shot evidence. Do not import the ZIP as a
new project or run setup. Leave History and automatic media disabled. Neither
package checks nor browser emulation closes the missing original QA matrix or
the six case-level dispositions. November deadlines and spending limits remain
unchanged.


### Browser and installation qualification evidence

[First hosted browser run 38765383921](https://github.com/justinpfisher/Stammtisch/actions/runs/38765383921)
passed **22/22** fictional checks: eight desktop Chromium checks (including
forced colours), seven WebKit/iPhone-descriptor checks and seven
Chromium/Android-descriptor checks. All ran against ephemeral loopback fixtures;
none were real phone, screen-reader or genuine-content production tests.
The quotation check additionally inspects the browser accessibility tree for
the harmless lowercase redaction token and non-verbatim notice. Final-head
results after the installation-source fix must also pass before merge.

Package review reproduced an order-dependent initialisation defect: loading
History before AutoCore in an Apps Script-like context without Node's `require`
threw before any service function could run. The existing media policy could
also retain an unavailable policy reference if loaded first. Both now resolve
the shared editorial dependency when used, and dependent operations fail closed
if it is missing. This changes no permissions or media eligibility rules and
does not enable media. Two new offline Node cases exercise complete production
modules in normal, reverse and cyclic orders, and missing-dependency refusal.
No Google account or secret is needed to reproduce them. The full supported
suite passes **66 Python and 251 Node tests**. These source changes require the
pending in-place installation; they are not proof of an updated live script.
