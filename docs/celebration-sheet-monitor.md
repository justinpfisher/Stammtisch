# Celebration Sheet monitor

The Google Sheets monitor remains GitHub-only and **read-only toward the Celebration Google Sheet**. When publishing is enabled, a separate guarded step can update the website's two public data files and request a GitHub Pages build. The Sheet is never changed. Access uses Sheets `spreadsheets.get` with `includeGridData=true` and a service account restricted to `spreadsheets.readonly`.

The monitor compares tabs by stable Google Sheet ID, so a tab rename is an alert rather than a delete/add pair. It compares entered values and formulas, notes, user-entered and effective formats, merged ranges, row and column properties, conditional formats, validations, and tab properties. It also tracks named ranges, banding, charts, filter views, protected ranges, slicers, tables, and developer metadata. It deliberately excludes effective values and displayed values from comparison, so formula recalculation such as `TODAY()` aging does not alert. The Sheets API does not provide a complete equivalent of all drawing-layer or embedded-image content; this monitor does not replace an XLSX visual/avatar comparison.

The encrypted baseline and encrypted detailed report are uploaded as a 30-day GitHub Actions artifact after a successful end-to-end check. When publishing is blocked, only the encrypted change report is uploaded separately, and the last good baseline is retained for retry. Never commit the raw workbook, encrypted snapshots or reports. This repository is public: workflow artifacts can be downloaded by signed-in users with repository access, so encryption is required but a separate private monitoring repository is recommended for stronger operational privacy. GitHub Issues contain only sheet IDs and change categories; they never contain cell values, formulas, notes, or excerpts.

## Setup

1. Create a dedicated Google service account, enable the Google Sheets API, and share only this spreadsheet with that service account as **Viewer**. Do not grant Editor access.
2. Add `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` as a GitHub Actions secret containing the complete service-account JSON.
3. Generate a Fernet key locally with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`, then add it as the `MONITOR_STATE_KEY` Actions secret. Keep this key private; losing it makes prior state artifacts unreadable.
4. Manually run **Celebration sheet monitor** with `initialize=true`. This fetches the Sheet and creates the first encrypted baseline. It is intentionally not treated as an unchanged check.
5. After initialization, scheduled runs are on by default. Set repository variable `CELEBRATION_SHEET_MONITOR_ENABLED` to `false` only when you deliberately want to pause scheduled checks; unset or `true` means active. Set `CELEBRATION_SHEET_MONITOR_ISSUES_ENABLED` to `false` only if issue alerts should be disabled; alerts are enabled by default.

The workflow uses GitHub Actions' `timezone: America/Toronto` schedule hourly at minute 58 (00:58, 01:58, and so on), preserving Eastern local time through daylight saving changes. It has concurrency protection and fails closed if credentials, API access, state decryption, or a complete baseline is unavailable. A failed fetch never replaces the previous baseline. After an artifact expires, run the explicit manual initialization again; the scheduler never silently creates a new baseline.

## Guarded website publishing after a change

The monitor continues to check every tab and report formatting, notes and structural changes. Only changed user-entered values, formulas or tab structures invoke publication. A note- or formatting-only edit never triggers a website rebuild. The pipeline reuses the same read-only Google Sheets API response, without Google Drive permissions.

1. Convert the API response to the existing strict importer's cell format. Require the expected eight tabs, fifty numbered selections per member, matching scores and leaderboard totals, and an unchanged competition year.
2. Preserve reviewed corrections in `data/celebration-confirmations.json`. For any new death report, attempt public research: exact name and birth-date in Wikidata, a precise death-date claim, and two readable accounts from distinct established news organisations corroborating the identity and date.
3. If the evidence passes, store the actual death date, publication links and verification method in the public confirmation record. Preserve the club's discovery date separately. If independent sources cannot be confirmed, or the group discovery date is missing, stop and create a review issue without publishing the new claim.
4. Update only `data/celebration.json` and `data/celebration-confirmations.json`. Member lists, leaderboards, commemorations, award calculations, draft previews, search and filters all read the public data file. Dates are labelled as either group-recorded or independently verified actual deaths.
5. Run Python and Node regression tests, commit changed data to `main`, explicitly request a GitHub Pages build, and verify the target commit's successful build before advancing the encrypted monitoring baseline.

The workflow never edits the source Google Sheet, changes official rules, awards badges, conducts drafts, adds speeches or finalizes a year automatically. A competition-year change or unsupported tab structure requires review.

### Retries, permissions and privacy

The workflow needs `actions: read`, `contents: write`, `issues: write` and `pages: write`. Keep the two existing Actions secrets and explicit first initialization. Scheduled checks are enabled by default after the first explicit initialization; use repository variable `CELEBRATION_SHEET_MONITOR_ENABLED=false` to pause them. The GitHub Actions identity must be allowed to update the two site data files on `main`, which must remain the GitHub Pages publishing branch and root.

A failed import, missing death verification, test failure, git push conflict or Pages build error retains the previous encrypted baseline for a later retry. The detailed report is uploaded encrypted, not in a public issue. If the public site data has already been committed, the workflow can retry the Pages build without duplicating the commit. Checks are serialized, and competing `main` branch updates cannot be force-pushed over.

GitHub Issues include only change categories, sheet IDs, pending counts and workflow links—not cell values or celebrity names from unpublished edits. The full workbook response remains temporary on the GitHub runner, is not retained in Actions artifacts and is never committed. Only the existing public-site fields and verified public source links are committed.

The Wikidata/news research gate is intentionally conservative. If a trustworthy announcement cannot be confirmed by two independent accessible news pages, a vetted manual confirmation is still required. This avoids publishing a false death solely because a spreadsheet entry or Wikidata statement changed. The existing monthly and annual celebrity discovery searches remain separate.

### Testing

Run `python -m unittest discover -s tests -p 'test_*.py'` and `node --test tests/*.test.mjs`. The same checks run automatically on relevant pull requests. A full live check still requires valid read-only Google Sheets credentials and the Pages permissions described above.
