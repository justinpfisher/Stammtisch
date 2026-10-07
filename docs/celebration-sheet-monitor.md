# Celebration Sheet monitor

This is a separate, GitHub-only, read-only monitor for the Celebration Google Sheet. It never edits the Sheet, the website, or repository content. It uses the Sheets `spreadsheets.get` endpoint with `includeGridData=true` and a service account restricted to the `spreadsheets.readonly` scope.

The monitor compares tabs by stable Google Sheet ID, so a tab rename is an alert rather than a delete/add pair. It compares entered values and formulas, notes, user-entered and effective formats, merged ranges, row and column properties, conditional formats, validations, and tab properties. It also tracks named ranges, banding, charts, filter views, protected ranges, slicers, tables, and developer metadata. It deliberately excludes effective values and displayed values from comparison, so formula recalculation such as `TODAY()` aging does not alert. The Sheets API does not provide a complete equivalent of all drawing-layer or embedded-image content; this monitor does not replace an XLSX visual/avatar comparison.

The encrypted baseline and encrypted detailed report are uploaded as a 90-day GitHub Actions artifact. Do not commit these files. This repository is public: workflow artifacts can be downloaded by signed-in users with repository access, so encryption is required but a separate private monitoring repository is recommended for stronger operational privacy. GitHub Issues contain only sheet IDs and change categories; they never contain cell values, formulas, notes, or excerpts.

## Setup

1. Create a dedicated Google service account, enable the Google Sheets API, and share only this spreadsheet with that service account as **Viewer**. Do not grant Editor access.
2. Add `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` as a GitHub Actions secret containing the complete service-account JSON.
3. Generate a Fernet key locally with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`, then add it as the `MONITOR_STATE_KEY` Actions secret. Keep this key private; losing it makes prior state artifacts unreadable.
4. Manually run **Celebration sheet monitor** with `initialize=true`. This fetches the Sheet and creates the first encrypted baseline. It is intentionally not treated as an unchanged check.
5. Inspect that run, then set repository variable `CELEBRATION_SHEET_MONITOR_ENABLED` to `true` to enable scheduled runs. Set `CELEBRATION_SHEET_MONITOR_ISSUES_ENABLED` to `false` only if issue alerts should be disabled; alerts are enabled by default.

The workflow uses GitHub Actions' `timezone: America/Toronto` schedule at 00:00, 06:00, 12:00, and 18:00, preserving the requested local times through daylight saving changes. It has concurrency protection and fails closed if credentials, API access, state decryption, or a complete baseline is unavailable. A failed fetch never replaces the previous baseline. After an artifact expires, run the explicit manual initialization again; the scheduler never silently creates a new baseline.
