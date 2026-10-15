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
features are **not live merely because this source is merged**. The existing
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
is never redispatched automatically. Only matching hosted JSON and HTML revision
markers allow private reconciliation to commit the new ledger. Private source
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
   `GovernanceCore.js`, and `HistoryProduction.gs`, and the existing manifest.
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

The full cloud offline check currently passes **64 Python and 237 Node tests**.
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
