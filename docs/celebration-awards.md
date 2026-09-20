# Celebration of Life award calculations

The website's **Awards & the next draft** section is recalculated in the browser
from `data/celebration.json` on each page load. Publishing a refreshed register
updates these results. It does not fetch news, edit the spreadsheet, allocate
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
- Birthday Buffet matches use group discovery dates and the six birthdays in the
  rules. Blue, Brown and explicitly recorded Blood Diamonds are excluded. Existing
  score allocations remain unchanged. Justin confirmed that Kevin Keegan's
  12 points for Matt and 13 for Ken were approved by a group vote; this is a
  settled exception, not an allocation needing review.

## Button previews and confirmed definitions

These are provisional candidates, not recorded button awards. On September 20,
2026, Justin confirmed that Rainmaker and Droughtmaker use group discovery dates
within each calendar year. Justin confirmed that Cavalcade of Calamity and
Copycat are for the cottage badge ceremony and are not needed for day-to-day
CoL. Cavalcade's count-based definition is now confirmed by Justin, its author;
clarifying Copycat is deferred until ceremony prep. Neither affects standings
or scoring.

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
- **Copycat:** surface recorded passings in the same numbered position on different
  lists. The group must confirm what “same CoL pick position” means before awarding
  the button.
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
Prior-year and future-dated events are excluded from the season calculation.

The clock alone never finalizes an award. After reviewing the completed annual
register, a maintainer may set `awardSettings.finalizedYear` on that snapshot to
the matching `year`, with `asOf` at December 31 or later. This permits the
points winner (or shared winners) and Devil's Share eligibility to be labelled final. It does not
resolve badge definitions, ties, unconfirmed ages or nominations. The importer
does not carry this reviewed finalization flag into a fresh snapshot.

## Verification

Run `node --test tests/*.test.mjs`. The award checks cover score ties, year
boundaries, discovery versus actual dates, duplicate BB allocations, all diamond
types, centenary benefits, open/tied streaks, Cavalcade qualification, and escaped
rendered names. Inspect the dashboard, badge disclosures, draft preview and its
member links on desktop and phone widths when changing the UI.

## Current Blood Diamond status

Justin confirmed that no Blood Diamonds have been assigned yet. Blue and Brown
Diamonds remain selections #1 and #50 respectively.
