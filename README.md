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

The first version uses the September 19, 2026 snapshot of all eight tabs.
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
publishes changes. The separate daily Codex monitor reports changes for review;
it does not update the website automatically.

Verify search (including accented names), member selection, nested disclosures,
the commemoration filter, clearing filters, date/point details and original-sheet
links on desktop and phone. Test all three pages after shared navigation changes.
