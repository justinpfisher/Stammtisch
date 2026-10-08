# Stammtisch repository working instructions

These rules apply to website, Celebration of Life, and notification work.

## Preferred execution machine

- **GMKtec M6 Ultra (Windows 11) is the preferred local machine** for interactive development, Codex work started on that machine, offline tests, and browser previews. Prefer an existing verified checkout; for a new checkout use `C:\Projects\Stammtisch\Repositories\Stammtisch`. This preference does not prove the checkout exists or let cloud agents access the machine.
- If executing from a cloud-only environment without access to the GMKtec, work through GitHub and use GitHub-hosted pull-request checks. State where verification actually ran. Never claim a local run was completed without observed results.
- **Never enrol the shared GMKtec, Comparative runner, or LCRS runner as a GitHub Actions self-hosted runner for this public repository.** Do not repurpose their services, credentials, work directories, or project identities.
- Keep GitHub-hosted runners for the hourly Sheet monitor, guarded website publication, GitHub Pages, OneSignal push delivery, and repository pull-request CI. These must continue when the GMKtec is off or unavailable.
- Do not change existing workflow routing to satisfy the local preference. A different execution architecture requires a separately reviewed security decision.

## Local workflow

- From the Stammtisch clone, run `node scripts/local-dev.mjs doctor` to check the local setup.
- Run `node scripts/local-dev.mjs check` before proposing code changes when the GMKtec is available. It runs the Python and Node regression tests without importing a private workbook, publishing, or sending notifications.
- Run `node scripts/local-dev.mjs preview` to serve the site only on `http://127.0.0.1:8765/` for browser inspection (Ctrl+C to stop).
- The helper requires Node.js 22+ and Python 3.12+. See `docs/gmktec-local-development.md` for the first-time checkout.
- When local execution is unavailable, keep testing through existing GitHub-hosted PR CI rather than blocking routine repository work.

## Project safeguards

- The public GitHub repository and its website must never receive secrets, Google Sheets credentials, private workbook data, or notification subscription identifiers.
- The spreadsheet is source data, not permission to publish an unverified passing. Preserve the independent death-verification, reconciliation, and fail-closed publishing checks.
- Changes to the official Celebration of Life rules must stay consistent between `docs/celebration-of-life-rules.md` and the website. The site is static; `main` publishes via GitHub Pages.
- Separate Stammtisch's local checkout and credentials from both Comparative and LCRS.
