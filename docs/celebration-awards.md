> **Current authority — 15 October 2026, photographs and CoL implementation:**
> Read [the current photo/CoL release and handoff](annals-photos-col-release-2026-10-15.md).
> The owner authorises automatic eligible six-member photographs under standing
> private attestation, subject to revocations and exceptional third-party/privacy
> holds. One genuinely authenticated member may independently introduce a prospective
> CoL change; no second member, vote or owner-adoption approval is required.
> Older proposal-only/per-image restrictions below are superseded within that scope.
> Preserve source consistency, exact meaning, historical results and all platform
> safeguards. New capabilities stay disabled until signing remediation, hosted
> acceptance and the documented private adapters are qualified.

# Celebration of Life award calculations

The website's **Awards & the next draft** section is recalculated in the browser from the shared Sheet's screened `data/celebration.json` and the Club's canonical GitHub `data/col-club-state.json` for Protection placements and corrected report dates. Publishing refreshed records updates the corresponding preview. It does not fetch news, edit the spreadsheet, allocate
points, choose benefits, conduct steals or finalize the year automatically.

The [official pool rules](celebration-of-life-rules.md) govern pool benefits.
The spreadsheet's `distinctions` entries supply the separate button ideas.

## Automated views

- The $100 prize leader and Devil's Share contender use recorded member scores.
  Tied winners share the prize; everyone tied for lowest receives Devil’s Share.
- The youngest-death view compares complete-year ages, then age in days when
  needed, as confirmed by Justin. Day-level comparison requires actual death
  dates. Missing dates leave contenders provisional; exact day-level ties are
  not silently resolved.
- Blue Diamond deaths indicate a Steal; Brown Diamond deaths indicate a Blood
  Diamond. Deaths at 100 indicate a Steal except under Birthday Buffet. A Blue
  Diamond death at 100 earns two Steals; a Brown Diamond death at 100 earns two
  Blood Diamonds (not a Blood Diamond plus a Steal). Benefits that lack the necessary dates remain unconfirmed.
- The draft preview orders members by ascending score with shared ranks for ties.
  Rock, paper, scissors resolves draft-order ties; alphabetical display within
  a tie does not decide who drafts first.
  Replacement counts use numbered selections with dated passings, excluding BB
  entries. Optional jettisons show the maximum needed to reach five spaces,
  before steals or jettisons. The preview does not choose any celebrity to remove.
- Birthday Buffet matches use the dates recorded in the shared Sheet as the presumed first WhatsApp group report, unless a member provides a correction in GitHub `data/col-club-state.json`. Blue, Brown and separately placed Blood Diamond Protections are excluded. Existing score allocations remain unchanged. Justin confirmed that Kevin Keegan's
  12 points for Matt and 13 for Ken were approved by a group vote; this is a
  settled exception, not an allocation needing review.

## Button previews and confirmed definitions

These are provisional candidates, not recorded button awards. On September 20,
2026, Justin confirmed that Rainmaker and Droughtmaker use group discovery dates
within each calendar year. Justin confirmed that Cavalcade of Calamity and
Copycat are for the cottage badge ceremony and are not needed for day-to-day
CoL. Justin confirmed Cavalcade's count-based definition and that Copycat uses
the actual date and time of death. Neither affects standings or scoring.

- **Rainmaker / Droughtmaker:** longest completed interval between group discovery
  dates within the current calendar year. Use the owners at the end/start of the
  interval respectively. Display tied intervals and all owners at a shared
  endpoint. Report elapsed days between dates, and show the current unfinished
  interval separately. Do not invent a January 1 passing or an earlier-year event.
  Missing discovery dates make the preview incomplete.
- **Cavalcade of Calamity:** goes to the player with the most deaths worth
  strictly fewer than 9 points, with a minimum of three qualifying deaths.
  Exactly 9 points does not qualify. Count dated, awarded deaths on the player's
  numbered list in the current season; count each death once per player and
  exclude birthday-only entries. Average points do not determine the result.
  Equal highest counts are shown as tied candidates for resolution at the
  cottage ceremony; no tiebreaker has been supplied.
  The original imported spreadsheet wording is retained in the source snapshot,
  but `celebration-rules.mjs` supplies the confirmed wording for both the badge
  card and button notes, so a register refresh cannot restore the old definition.
- **Copycat:** when two different celebrities on different members' lists die on
  the same actual date, the member whose celebrity dies second gets the button.
  Compare confirmed actual death times, including their timezone offsets;
  discovery dates, report order and numbered pick positions do not determine it.
  Missing, invalid, conflicting or equal times leave the recipient unconfirmed.
  More than two deaths on a date or shared celebrity selections are left for
  group review rather than extending the two-person rule. Matching calendar
  dates use the recorded actual death dates; offsets establish chronological
  order. The confirmed wording overrides the old spreadsheet button notes.
- **Hand of Providence:** by nomination; no recipient inferred.
- **Summit in Purgatory:** needs evidence of a shared mass casualty event; matching
  dates alone do not award the button.

## Dates and finalization

The legacy `dateOfPassing` field represents the group's discovery date unless
`dateSource` supplies an independently sourced actual date of death. Award
calculations respect that distinction without rewriting the imported register.

Optional pick fields can clarify the record: `discoveryDate`, `actualDeathDate`,
`ageAtDeath` (completed years), and `bloodDiamond` (boolean). An actual date from
`dateSource.dateOfPassing` is also recognized. Dates are `YYYY-MM-DD`. Do not
populate group discovery dates from automated news alerts. These optional fields
can be preserved through the confirmations file for discovery and actual death
dates; `actualDeathSource` records the supporting source separately. The
importer also preserves confirmed allocation decisions without treating them as
verified death dates. Justin confirmed Dolly’s discovery date equals the recorded
death date (August 25, 2026); this is saved in the confirmations file. Preserve
other reviewed optional fields when refreshing the register.

For Copycat, `actualDeathAt` is an optional verified ISO timestamp with an
explicit offset, for example `2026-02-07T14:30:00-05:00`. Its date must match
`actualDeathDate` (or the verified `dateSource.dateOfPassing`). Never fill in a
time from a publication timestamp or invent midnight when only a date is known.
The confirmations file and importer preserve this field and its
`actualDeathTimeSource` evidence. No death times have been inferred for the
current register.

Brad Arnold and Jason Collins have verified actual death dates in the
confirmations file, with the imported group discovery dates and scores preserved.
Brad's September 27, 1978–February 7, 2026 lifespan is 17,300 days; Jason's
December 2, 1978–May 12, 2026 lifespan is 17,328 days. Brad was 28 days younger,
so Matt is the current youngest-death contender, ahead of Marc. This does not
assign a Blood Diamond before the year-end award is settled.
Sources: [3 Doors Down announcement](https://3doorsdown.com/),
[Brad Arnold biography](https://celebrities.legacy.com/legacy/notable-deaths/brad-arnold),
[NBA family announcement report](https://www.nba.com/news/jason-collins-obit-dies-47-brain-cancer),
and [Jason Collins NBA profile](https://www.nba.com/stats/player/2215).

If the actual age is unknown, the age on the discovery date is an estimate and
the youngest-death result remains provisional. Duplicate celebrity/BB records
are grouped into one event; missing or conflicting dates do not earn benefits.
The browser's provisional award model now keeps independently dated January passings in the preceding competition year until the Club's 8 p.m. Toronto third-Friday handover. A death *on* handover Friday needs a verified actual death time to establish which side of that hour it belongs to. The 2026 recorded totals are not retrospectively reassigned, and the new public preview is not itself a signed scoring release. A pick already marked dead by its independently verified source is not available for a speculative Jettison. Draft benefits display placed Protections before Steals, with Steals ordered by their actual death dates; a same-date tie without enough evidence stays visibly unsettled.

The year now changes at **8 p.m. America/Toronto on the third Friday of January** (15 January 2027 for the upcoming handover). A bare death date or December 31 does not prove that an award is final. The legacy `awardSettings.finalizedYear` flag is deliberately ignored by the public preview after PR #229. The source-bound January transition, final points, awards and historic protections must first be reconciled under the existing safeguards; the approved website wording does not itself recalculate these outcomes. The importer does not carry a finalized-year flag into a fresh snapshot.

## Verification

Run `node --test tests/*.test.mjs`. The award checks cover score ties, year
boundaries, discovery versus actual dates, duplicate BB allocations, all diamond
types, centenary benefits, open/tied streaks, Cavalcade qualification, and escaped
rendered names. Inspect the dashboard, badge disclosures, draft preview and its
member links on desktop and phone widths when changing the UI.

## Current Blood Diamond status

The previous owner-confirmed state was that **no separately placed Blood Diamonds had been assigned**. Blue and Brown Diamonds remain numbered selections #1 and #50 and are protected by position. All future actual placements, report-date corrections and annual draft actions are kept in the GitHub Club register, not a new spreadsheet tab. An empty placements array means none have been recorded there; it does not fabricate any past draft decision.

## Independent post-snapshot reports

On October 7, 2026, Eva Marie Saint's death on October 6 was corroborated by [Reuters](https://www.reuters.com/lifestyle/eva-marie-saint-north-by-northwest-movie-star-dies-102-2026-10-06/) and [Associated Press](https://www.washingtonpost.com/entertainment/2026/10/06/eva-marie-saint-dies/e09c31a8-c1d0-11f1-8170-681419af1cc9_story.html). She was 102. Her independently confirmed actual death date is held in `data/celebration-confirmations.json` and the public register, separately from the club's discovery date.

Jerome holds her as selection #13. Under the published rules, the result is a **−2-point penalty**. The original September 19 published register recorded Jerome at 109 points and had not yet assigned that penalty. A later club Sheet update can supply the group-recorded discovery date and counted allocation; the importer must then preserve the independently verified October 6 death date, reconcile every member's total and publish the Sheet's current score without double-counting. The date the club learned about the death must never be inferred from media publication times. This paragraph documents the historical pre-synchronisation state, not the current standings.
