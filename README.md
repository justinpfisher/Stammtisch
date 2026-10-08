# Stammtisch Social Club

Static website published through GitHub Pages at https://stammtischbrewery.com/.
The publishing branch is `main`; there is no build step.

## Files

- `index.html`: Club introduction and Assembly countdown.
- `location.html`: Assembly details; the original URL is retained.
- `styles.css`: shared responsive design.
- `assembly.mjs`: countdown based on the page's `time[data-assembly-start]`.
- `assembly-2027.ics`: a calendar start reminder, with no invented end time.
- `assets/`: resized crest files; the original PNG remains for sharing previews.
- `celebration.html`, `celebration.css`, `celebration.mjs`: Celebration of Life standings, searchable member lists, commemorations, scoring, and button ideas.
- `celebration-awards.mjs`, `celebration-rules.mjs`: calculated award leaders, badge previews and draft benefits, using the pool's scoring rules.
- `data/celebration.json`: dated import of the club's full register, with recorded scores and source formulas.
- `data/celebration-confirmations.json`: independently sourced corrections kept separately from the spreadsheet import.
- `scripts/import-celebration.py`: standard-library-only importer for an authorized XLSX export of the Google spreadsheet.

## Event details

Confirmed start: February 5, 2027, at 09:00 America/Toronto (14:00 UTC).
When changing the gathering, update the visible dates and `datetime` values
on both pages, the sharing descriptions, the calendar file, and the
completion message in `assembly.mjs` together.

09:00 is the Assembly start, not cottage check-in. No end date, programme,
room allocations, or travel arrangements have been supplied. Exact address
and entry instructions are referred to the group's reservation.

Cottage details and externally hosted photographs are from the listing
supplied by the user: https://www.airbnb.ca/rooms/605759557639781130
Details checked September 19, 2026. Photographs remain on Airbnb's image
service and depend on its availability.

## Verification

Serve the folder with a local static server and inspect both pages at
desktop and phone widths. Check navigation, disclosure sections, cottage
and area-map links, and the calendar download. Calendar clients may apply
their own default duration to the start-only calendar reminder.

Run the countdown and calendar regression checks:

```
node --test tests/assembly.test.mjs
```

## Celebration of Life

The [official Celebration of Life rules](docs/celebration-of-life-rules.md)
are the reference for scoring, diamonds, Birthday Buffet, prizes and drafting.
The full rules are also published on [the Celebration of Life page](celebration.html#official-rules).
When updating the reference, update that website section to match.
Consult them before changing related behaviour. They include the confirmed Brown Diamond wording correction and the adopted
youngest-death Blood Diamond rule. Spreadsheet dates record when the group learned of a passing, which
may differ from the actual date of death.

The [awards and draft dashboard](celebration.html#awards) recalculates when the
website's register is refreshed. See [award calculation notes](docs/celebration-awards.md)
for the date distinctions, provisional badge interpretations, ties, and year-end
finalization. Existing scores and allocations are preserved.

The initial version used the September 19, 2026 snapshot of all eight tabs. When the hourly monitor is enabled, validated changes to published register fields can refresh the site automatically.
It contains 300 numbered selections and Ken's extra BB entry, the six recorded
totals, birth and passing dates, and all six button ideas. Member portraits
come from the spreadsheet. No speeches or speech scheduling are included.

Source: https://docs.google.com/spreadsheets/d/1B8tZFjIa5FsyBaex42Atg7pJ5Y86Lj1vHeJMRhrqrCY/edit

The standings preserve awarded allocations, including Kevin Keegan's 12/13
split. Unawarded point values use complete calendar-year age at the snapshot
date: 100 minus age, 10 at age 100, and negative values from 101 onward.
The sheet's first/last selection multipliers are retained. BB is not expanded
because its meaning has not been confirmed. Passings are records from the
club spreadsheet; speeches are not assumed to have happened.

Dolly Parton's August 25, 2026 date of passing was verified against her
official announcement and is supplied by the confirmations file. Her 20
points were already in Jamie's 25-point total and are never added twice.
The original Google spreadsheet has not been edited.

To refresh after reviewing a new full-workbook export:

```
python scripts/import-celebration.py path/to/export.xlsx --captured-at 2026-09-19T19:54:06Z
node --test tests/*.test.mjs
```

Use the actual export capture time. The importer rejects unfamiliar sheet
structure, unreconciled totals, formula changes it cannot interpret, and
conflicting confirmed dates. Review its output and any changed regression
expectations before publishing. It neither fetches private credentials nor
publishes changes. The separate GitHub Actions monitor checks hourly at :58 Eastern when enabled. Every normal check also reconciles the current workbook with the website, catching changes already present in the encrypted baseline when publishing was enabled. Entered register changes are imported, reconciled and checked against independent evidence for any newly reported passing. Verified data is committed and a GitHub Pages build is explicitly requested. If independent verification fails, no new website data is published and a metadata-only review issue is opened. See [monitor and publishing procedure](docs/celebration-sheet-monitor.md).

Verify search (including accented names), member selection, nested disclosures,
the commemoration filter, clearing filters, date/point details and original-sheet
links on desktop and phone. Test all three pages after shared navigation changes.

## Celebration of Life web notifications

The site includes an **inactive-by-default** web-push integration prepared for a future OneSignal pilot. After a successful iPhone and Android pilot, subscribers may opt in from the CoL website; the intended audience is **any visitor who opts in**, not a private six-person list. No SMS numbers or additional app-store downloads are required. iPhone users must open Stammtisch from its Home Screen icon.

Notification sending is separate from the existing verified CoL data publication, and is restricted to material Celebration of Life register updates. The pilot can send only to explicitly supplied test subscription identifiers. Public delivery requires a separate OneSignal configuration and two GitHub approval variables. **No OneSignal account, live message or subscription is activated by this code alone.**

See [controlled notification rollout](docs/col-push-rollout.md) for configuration, test steps, safety gates, duplicate avoidance and manual activation.

## Home Screen icons (iPhone and Android)

The approved six-person composite is `assets/stammtisch-app-icon-approved.png`.
Only this approved composite is public; the original reference photographs and
individual reference portraits remain private and are not committed here.
`apple-touch-icon.png` is the 180 × 180 icon for iOS; the 192 × 192, 512 × 512,
and maskable 512 × 512 PWA variants live in `assets/`.
`site-manifest.json` supports the Club and Assembly pages, while
`manifest.json` keeps the existing Celebration of Life app identity and
start URL so that its optional notification pilot is not disturbed.
Both use the short Home Screen name `Stammtisch`.
Existing installed iPhone Home Screen shortcuts may retain cached icons and
can be removed and re-added from Safari if they do not refresh.
