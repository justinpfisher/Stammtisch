# Celebration of Life: spreadsheet-to-website automation audit

**Audit date:** October 7, 2026  
**Scope:** Current 2026 season and six existing Stammtisch participants  
**Source authority:** The established Google Sheet, read-only through the repository's existing service account; reviewed independent confirmations are additive death-date evidence.  
**Publishing target:** GitHub Pages from repository `main`, custom domain `stammtischbrewery.com`.

## Operating conclusion

The October 7 end-to-end run [37703773395](https://github.com/justinpfisher/Stammtisch/actions/runs/37703773395) fetched the actual Google Sheet, validated the existing register, committed the data and completed a [Pages deployment](https://github.com/justinpfisher/Stammtisch/actions/runs/37703806630). Eva Marie Saint's source-recorded -2 points were applied to Jerome's official 107-point score. This proves the current source layout works; it is not a guarantee that any arbitrary future schema change can safely be imported.

The present published register has 6 members, 300 numbered picks, 1 additional BB entry, 14 awarded rows and 6 button definitions. The sum of each member's awarded rows matches the public standings. The 14 awarded values match calendar-age scoring except for Kevin Keegan's **approved** Birthday Buffet allocation (12/13 points), which is preserved as a reviewed exception. All of these records are already public.

## Source-to-site field contract

| Source location | Website data | Consumer and checks |
| --- | --- | --- |
| `LEADERBOARD!A1` | `year` | Published season, unchanged unless annual rollover is explicitly reviewed |
| `LEADERBOARD!B2:G2` | Member ordering and total cross-check | Each of six formulas must identify one established member; values reconcile to that member's `E1` |
| `LEADERBOARD` pick rows | `leaderboardName` / marker cross-check | Compare selection names by rank; no silent reassignment of a person's picks |
| Each six member tabs, `A1` | `asOf` | Same valid snapshot date across all tabs, never in the future |
| Member `B1` | Member name | Verified against the known six identities, even if the tab title is unchanged |
| Member `E1` | `score`, source formula | Supported explicit score references only; no duplicate or missing source rows |
| Member `A3:E...` | `pick`, `name`, `born`, `dateOfPassing`, `points`, `counted`, source row/formula | Exactly fifty unique numbered positions per member plus supported `BB`; validated dates, totals and uniqueness |
| `buttons!A:C` | `distinctions` | Published button names/notes; existing confirmed award definitions still take precedence |
| `data/celebration-confirmations.json` | `actualDeathDate`, sources, group-approved exceptions | Additive independent evidence; does not silently change group discovery dates or allocate points |

The register is the public data source for standings, player lists, searching, commemorations, award previews, point calculations, and draft previews. The webpage views use the same published JSON, not separate hand-maintained lists.

## Failure cases now exercised

1. Missing/duplicated numbered positions; illegal or ambiguous pick identifiers
2. E1 score formula referencing absent or repeated source rows
3. Duplicate celebrity selected by a single member, blank names and missing/invalid birth dates
4. A counted death lacking a date **after** applying already-reviewed confirmations (historical Dolly Parton backfill supported)
5. Text-formatted death dates being silently interpreted as ages rather than passings
6. Verified death scoring discrepancies even when member and leaderboard totals both reconcile
7. One shared celebrity recorded with incompatible club-discovery or verified death dates
8. Club discovery dates earlier than independently confirmed deaths
9. Deleting previously published recorded passings without a reviewed correction
10. Renamed tabs matched only by unambiguous identity; exact-titled but wrong-member content must not silently import
11. Browser-cached older site JSON, a Pages build preceding CDN availability, unavailable public endpoint, or public JSON not matching the commit
12. Existing encrypted monitor baseline already containing a change not yet published, versus a no-change idempotent run

Tests use a full 301-entry fixture reconstructed from the **already published** data plus separate small synthetic adversarial examples. The private full workbook is not embedded in repository test fixtures or GitHub issues.

## Automation and operational limits

**Expected automatic behaviour:** Every normal hourly reconciliation fetches the current Sheet through read-only credentials, maps the existing season and members, applies reviewed independent confirmations, researches newly recorded deaths where required, validates every public data change, tests it, updates the allowlisted public JSON files, and explicitly builds GitHub Pages. After deployment, the live public JSON must match the committed data; only then does the encrypted baseline advance. An unchanged public register does not cause a redundant data commit.

**Deliberate review gates:** New seasons, an additional participant, unfamiliar tabs, unsupported formula structure, contested facts, unsourced deaths, removal of established passings and ambiguous score/identity changes stop with a metadata-only issue. A source edit is not authority to invent an actual death date or when the club learned of it. Independent death research is conservative and will sometimes require a person to supply an adequate source or approve a decision.

**Not automatically controlled by this Sheet:** Embedded drawings/portraits that the Sheets API does not fully expose; official rules and approvals; other pages such as travel/cottage information; and live-refreshing an already-open visitor browser tab. Daily recalculations with no meaningful published change are intentionally suppressed.

**Scheduling and retention:** Monitoring is by GitHub's hourly scheduled check, nominally at minute 58 Eastern, not an instantaneous Sheets webhook. Schedule delays/outages are possible. The existing encrypted artifact has time-limited retention; an expired/missing original baseline deliberately requires reinitialisation rather than silently creating a replacement. Real source credentials and permission errors also stop and notify; no raw worksheet content is exposed in issues.

## Evidence and validation standard

- Last successful end-to-end source run: [37703773395](https://github.com/justinpfisher/Stammtisch/actions/runs/37703773395).
- Last completed Pages deployment of that data: [37703806630](https://github.com/justinpfisher/Stammtisch/actions/runs/37703806630).
- Post-audit validation: all Python source/contract checks, Node scoring/UI tests and read-only public-site health smoke must pass in this audit pull request.
- Deployment of the audit itself must pass a fresh read-only Google Sheet reconciliation **without publishing incorrect data**; after that, future supported changes are automatically processed within the scheduler's operating limits.

**Assurance level:** Tested, fail-closed automation for this existing 2026 mapping. Not a guarantee of automatic publication for every possible future change, particularly source structure or governance changes.
