# Prospective CoL implementation

`col-prospective.mjs` implements pure numerical and draft operations. It has no
network access, signing authority, publishing side effects or notification sender.
It is a calculation candidate, **not a new operative scoring release**.

## Numeric release candidate — 24 October 2026

PR [#277](https://github.com/justinpfisher/Stammtisch/pull/277) added
`col-numeric-adapter.mjs` and the browser-side `col-numeric-reader.mjs` at main
commit `4a41873f61f2563f93a16305da15ebb4a5d2d558`. The additive prospective
behavior digest now includes these files, the public trust registry, and the
exact-commit qualification workflow/tests; the operative rules manifest is
unchanged. Candidate checks use distinct Ed25519 domains/keys for authenticated
member actions, independent death witnesses and numeric release signatures;
reject replay, stale Viewer observations, historical summary actions, mismatched
baseline/corrections, altered prior awards, site-total mismatch and failed
compare-and-swap; and let the website accept only a whole signed site snapshot.

The current public trust registry intentionally has no production keys, and no
numeric release asset is published. The website reader falls back to the existing
result when the release or valid trust root is absent. Exact-commit Viewer run
[40052653786](https://github.com/justinpfisher/Stammtisch/actions/runs/40052653786)
succeeded, matching 301 historical entries, 14 counted awards and all six member
totals, while explicitly reporting `signedRelease: false`. Pages run
[40052648304](https://github.com/justinpfisher/Stammtisch/actions/runs/40052648304)
and live witness [40052648572](https://github.com/justinpfisher/Stammtisch/actions/runs/40052648572)
passed on the merge commit. This is candidate engineering and qualification, not
protected production activation.

Production activation still needs the owner-controlled private member-action
attestor, independent death-witness signer, separate numeric signing key and
their real public trust anchors; a protected release publisher with immutable
evidence, independently verified Viewer/workflow identity, compare-and-swap
recovery and operative-version readback; and source-level binding of each action,
death and group-report date to the authoritative Viewer row. None of those live
private authorities or integration services is connected by this repository
change. After completing them, qualify the final exact commit again, sign and
publish its full site snapshot, independently verify live consumption, and only
then retire the January numerical hold. Do not repurpose the v3 rules signer.

The baseline migration preserves every source row and signed allocation, including
negative points and the historical Birthday Buffet split. GitHub corrections are
applied to a separate view. Previously recorded people are consumed identities,
so migrating or replaying them cannot create another award.

Prospective calculations use independently verified actual death dates/times,
the third-Friday January 8 p.m. Toronto handover and the previous-season default
for an unknown handover-day time. The first group report date comes from the
Sheet unless corrected in the GitHub Club record. Placed Protections and Diamond
slots exclude Birthday Buffet; Protections do not double points. Age 100 remains
ten points and ordinary Diamond rights remain, without reviving retired extras.
Release-day date-only evidence, shared ownership, missing group reports and
unresolved exact age or chronological Steal ties remain held. Verified actual
death instants are compared as instants even when their source-local date differs
from UTC; the Club's WhatsApp report date is compared in Toronto local time.
Ambiguous date-only timing around an age-100 Jettison remains held rather than
inventing which event occurred first.

Draft operations enforce the seven stages, chronological Steals, single theft per
person per draft, permanent placed Protections, immediate Devil's Share use,
optional jettisons to five vacancies, snake order, the 50-selection ceiling and
vacant-Diamond coronation. Recorded rock-paper-scissors outcomes are required for
tied draft order. Unused rights cannot be spent in a later draft. Expired
Protections remain historical evidence, while living placements carry forward.

## Qualification and integration boundary

The existing read-only source workflow has a `prospective` qualification option.
It reads the canonical workbook through the existing Viewer, passes it through
the canonical importer in memory, compares every historical allocation and
selection with the public baseline, and runs calculation and protected-release
regressions on the exact commit. Its artifact contains hashes/counts/results,
never workbook cells, credentials, original communications or rights records.
The ordinary snapshot option retains its original semantics for existing v3 jobs.

A separate `prospectiveBehaviorDigest()` covers the existing rule sources and prospective calculator plus `col-numeric-adapter.mjs`, `col-numeric-reader.mjs`, the trust registry, qualification code and tests. The operative v3 rule staging manifest remains unchanged. The digest is included in the numeric candidate contract but does not provision trust keys or authenticate a production signature.

Neither the qualification artifact nor a PR merge activates this engine. The
repository currently lacks a private production adapter that obtains genuine
authenticated member actions, independent actual-death evidence and a Viewer-
bound discovery date, then releases those inputs through a distinct numeric
signer and independent hosted verifier. Test keys and digest-shaped fixtures are
not authenticated death witnesses or member decisions. Do not feed model output
or an email directly into these operations.

The January numeric hold remains until that adapter, independent exact-commit
qualification, protected signed release and live readback all succeed. The current
browser and Sheet monitor continue to use their existing operative calculations;
the new module does not alter their results. Only the established independent
new-passing/deduplication path may send an alert.

## Activation-time and cumulative-release contract — 24 October 2026

The public candidate now distinguishes an immutable first-activation boundary
from the time each source observation is made. The first payload requires a
domain-separated `numeric-activation-boundary` attestation bound to the exact
Viewer qualification, source digest, implementation commit and behavior digest.
Callers cannot choose an unsigned boundary. Later payloads must name the
previous signed release and its exact digest; they inherit its original
`activationAt`, while `observedAt` records the current observation. A stale or
concurrent parent is rejected.

Subsequent candidates carry forward prior calculations, site snapshot, consumed
person identities, death-witness hashes and the complete action replay-key set.
They reject previously counted passings, deleted prior awards and a changed
correction-state digest until that correction is requalified. Each new passing
also requires a separately signed Viewer-row observation bound to the current
Viewer run/source and its exact group report date, alongside the independent
death witness. Public output retains only the Viewer row digest.

Fictional regression coverage exercises the initial boundary, a later cumulative
release, unchanged activation time, current observation time, replay, deleted
awards, source-row binding, distinct signing keys and CAS. The repository does
**not** yet provide the production Viewer row signer, Apps Script authorities,
hosted numerical publisher or public stable key anchors. The January hold remains
active; no signed numerical snapshot is operative.
