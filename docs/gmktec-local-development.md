# GMKtec-first local development

**Status (October 8, 2026):** Stammtisch's repository instructions and local testing command prefer the GMKtec M6 Ultra for interactive development and previews. This is a repository-side preference, **not** evidence that Stammtisch has already been cloned or tested on the GMKtec. The one-time machine check below must still be run on the GMKtec.

## What runs where

| Work | Executor | Reason |
| --- | --- | --- |
| Interactive editing, Codex opened on the local checkout, Python/Node regression checks, browser preview | **GMKtec M6 Ultra, Windows 11** (preferred) | Reuses the existing local development machine without consuming GitHub-hosted CI minutes |
| Pull-request regression checks, especially when GMKtec is not available | **GitHub-hosted `ubuntu-latest`** | Independently checks proposed changes |
| Hourly spreadsheet monitoring, verified website publication and Pages builds | **GitHub-hosted** | Runs even if the GMKtec is offline |
| OneSignal notification delivery | **GitHub-hosted** | Does not depend on a home PC being online |

Do **not** attach this **public** repository to a GMKtec GitHub Actions self-hosted runner. GitHub advises against self-hosted runners in public repositories because untrusted pull requests can execute code on the runner. The physical GMKtec is also used by Comparative and LCRS, which have separate project identities and directories. Do not route Stammtisch Actions jobs to either project runner or share their credentials.

GitHub security guidance: https://docs.github.com/en/actions/reference/security/secure-use

## One-time setup on the GMKtec

On the Windows 11 GMKtec itself, use Windows Terminal / PowerShell. The requirements are **Git**, **Node.js 22 or later**, and **Python 3.12 or later**. These correspond to the existing GitHub regression-test environment (Node 22, Python 3.12). The local helper installs nothing and changes no Windows services or GitHub runner registration.

If an existing Stammtisch checkout is already present, use its actual location; do not clone over it. For a new checkout, use a directory separate from Comparative and LCRS:

```powershell
$repo = 'C:\Projects\Stammtisch\Repositories\Stammtisch'
if (-not (Test-Path $repo)) {
    New-Item -ItemType Directory -Path (Split-Path $repo -Parent) -Force | Out-Null
    git clone https://github.com/justinpfisher/Stammtisch.git $repo
    if ($LASTEXITCODE -ne 0) { throw 'Git clone failed' }
}
Set-Location $repo
node scripts/local-dev.mjs doctor
node scripts/local-dev.mjs check
```

If `doctor` reports that the Git origin does not match `justinpfisher/Stammtisch`, check that the directory really is the repository checkout. It deliberately does not display the origin URL in case the remote contains a credential. If prerequisites are missing, install the approved Git/Node/Python tools separately rather than running an unreviewed installer.

The `check` command runs the complete Python and Node test suites without live Google Sheets, OneSignal, or deployment calls. This is suitable before a pull request. It does not change the public site.

For an optional local website preview:

```powershell
node scripts/local-dev.mjs preview
```

Visit http://127.0.0.1:8765/ and http://127.0.0.1:8765/celebration.html **on the GMKtec**. The server listens on the GMKtec's loopback address only, not the home network or internet. Stop it with **Ctrl+C**. To choose another port: `node scripts/local-dev.mjs preview 8766`.

## Ongoing development

1. Open the local Stammtisch checkout in your preferred editor or Codex **on the GMKtec**. A cloud-only ChatGPT/Codex session cannot automatically select or control the physical machine just because `AGENTS.md` asks it to.
2. Review any uncommitted edits before updating the local checkout; do not run a blind `git pull` over someone else's work.
3. Make changes on a branch. Run `node scripts/local-dev.mjs check` and preview affected pages; record actual results.
4. Open a pull request and use the existing GitHub-hosted regression CI as an independent check. Live website data and push notifications continue under their existing verification and approval gates.

The scripts are local-only: they do **not** copy secrets, start an Actions runner, enrol a service, call OneSignal, read the protected spreadsheet, commit to `main`, or publish GitHub Pages.

## Acceptance check

The local preference is **fully operational for Stammtisch development** only after all of the following have been observed from the GMKtec:

- `doctor` reports a matching Git origin, Node 22+, and Python 3.12+.
- `check` completes both test suites successfully.
- The local preview serves the homepage and Celebration of Life page.
- The existing GitHub-hosted spreadsheet monitor and push workflows remain unchanged.

Until those observations exist, the repository-side setup is complete but the workstation activation is **unverified**.
