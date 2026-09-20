# Celebration of Life award calculations

The website's **Awards & the next draft** section is recalculated in the browser
from `data/celebration.json` on each page load. Publishing a refreshed register
updates these results. It does not fetch news, edit the spreadsheet, allocate
points, choose benefits, conduct steals or finalize the year automatically.

The [official pool rules](celebration-of-life-rules.md) govern pool benefits.
The spreadsheet's `distinctions` entries supply the separate button ideas.

## Automated views

- The $100 prize leader and Devil's Share contender use recorded member scores.
- The youngest-death view compares complete-year ages and displays every tied
  contender. It does not invent a tie-break or promise multiple Blood Diamonds.
- Blue Diamond deaths indicate a Steal; Brown Diamond deaths indicate a Blood
  Diamond. Deaths at 100 indicate a Steal except under Birthday Buffet. A Blue
  Diamond death at 100 is flagged for a stacking decision rather than silently
  awarding two Steals. Benefits that lack the necessary dates remain unconfirmed.
- The draft preview orders members by ascending score with shared ranks for ties.
  Replacement counts use numbered selections with dated passings, excluding BB
  entries. Optional jettisons show the maximum needed to reach five spaces,
  before steals or jettisons. The preview does not choose any celebrity to remove.
- Birthday Buffet matches use group discovery dates and the six birthdays in the
  rules. Blue, Brown and explicitly recorded Blood Diamonds are excluded. Existing
  score allocations, including Kevin Keegan's 12/13 split, remain unchanged.

## Button previews awaiting interpretation

These are provisional candidates, not recorded button awards. Justin was asked
on September 20, 2026 to confirm the streak period/date basis and the averaging
method; no answer had been received when these previews were introduced.

- **Rainmaker / Droughtmaker:** longest completed interval between group discovery
  dates within the current calendar year. Use the owners at the end/start of the
  interval respectively. Display tied intervals and all owners at a shared
  endpoint. Report elapsed days between dates, and show the current unfinished
  interval separately. Do not invent a January 1 passing or an earlier-year event.
  Missing discovery dates make the preview incomplete.
- **Cavalcade of Calamity:** require at least three numbered-list deaths with
  awarded values of 9 or less, then compare average awarded points across all
  dated deaths on that numbered list. Birthday-only entries are excluded.
  `awardSettings.calamityAverage: "low-only"` selects the alternate average across
  qualifying deaths if the group chooses that interpretation.
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
are not currently populated by the XLSX importer; preserve reviewed additions
when refreshing the register.

If the actual age is unknown, the age on the discovery date is an estimate and
the youngest-death result remains provisional. Duplicate celebrity/BB records
are grouped into one event; missing or conflicting dates do not earn benefits.
Prior-year and future-dated events are excluded from the season calculation.

The clock alone never finalizes an award. After reviewing the completed annual
register, a maintainer may set `awardSettings.finalizedYear` on that snapshot to
the matching `year`, with `asOf` at December 31 or later. This permits the untied
points winner and Devil's Share eligibility to be labelled final. It does not
resolve badge definitions, ties, unconfirmed ages or nominations. The importer
does not carry this reviewed finalization flag into a fresh snapshot.

## Verification

Run `node --test tests/*.test.mjs`. The award checks cover score ties, year
boundaries, discovery versus actual dates, duplicate BB allocations, all diamond
types, centenary benefits, open/tied streaks, Cavalcade qualification, and escaped
rendered names. Inspect the dashboard, badge disclosures, draft preview and its
member links on desktop and phone widths when changing the UI.
