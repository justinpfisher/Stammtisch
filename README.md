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
