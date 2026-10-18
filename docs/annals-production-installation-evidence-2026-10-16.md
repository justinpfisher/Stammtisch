> **Historical record — not an operating checklist.** Status, proposed work and launch gates below describe their dated checkpoint. Use [current state](current-state.md), [working instructions](../AGENTS.md) and the [production runbook](annals-production-runbook.md) for current decisions and operations. Retain this record for provenance, specifications and recovery; do not repeat completed setup or restore superseded gates.

# Annals production installation evidence — 16 October 2026

This checkpoint records the installation of the qualified release into the existing owner-controlled **Stammtisch Annals — Production** Apps Script project. Private source snapshots, OAuth credentials, deployment identifiers, URLs, and account details remain outside this public repository. [Issue #24](https://github.com/justinpfisher/Stammtisch/issues/24) tracks the release and remaining qualifications.

## Qualified source and rollback

- Pinned source commit: `ff4d48580d4339e934a7ce96d3b3b6b9237294f0`.
- Qualified ZIP SHA-256: `13409d5f1a9bc88fd3564dd8de65882fe3f9a58e8ffe4e1458f0c881f5a272c4`.
- Complete pre-install Head and immutable v28: 17 files each, including the owner-specific manifest. Private disk read-back and independent API recapture matched every file; Head and v28 had no differences at capture.
- The private rollback directory grants access only to the Windows owner, SYSTEM, and local Administrators. No Script Properties or signing credentials were exported.

## Source and deployment

- Installed all 17 qualified code/UI files: 15 updated in place and 2 new. Preserved the unchanged owner-specific manifest and one unrelated existing source file. Complete Head inventory: 19 files.
- Independent read-only API comparison of all 19 persisted Head files found zero missing or mismatched files. All 17 server-side JavaScript files parsed, with no duplicate top-level function names detected.
- The live manifest retains `America/Toronto`, V8, exception logging `NONE`, the five existing runtime OAuth scopes, `MYSELF` web-app access, and `USER_DEPLOYING` execution.
- Created immutable **v29** from verified Head. A separate read-only API fetch compared all 19 version files with zero mismatches.
- Advanced the existing web-app deployment from **v28 to v29**. A later independent deployment read-back confirmed v29, the same deployment ID and URL, `MYSELF` access, and `USER_DEPLOYING` execution. No replacement deployment was created.

## Service and qualification limits

- The owner dashboard showed one Head `runAnnalsProductionIntake` trigger before installation. No trigger was edited or removed. API process history shows 15-minute time-driven starts, and the first post-deployment intake execution completed. A fresh post-deployment trigger inventory remains an editor-only check.
- No separate Photo, History, or CoL function execution started after source installation. Installation did not read or alter publication gates, consents, cursor, budgets, journals, or signing state.
- Runtime publication gate booleans remain **unverified**. Source defaults require explicit gate properties, but source inspection does not establish actual Script Properties values.
- The private once-only codec fixture was **not run**: its existing reservation state could not be inspected through the authorized API, and no supported editor execution route was available. Do not retry an uncertain attempt.
- Genuine HEIC/JPEG and inline-photo acceptance, member-initiated CoL amendment qualification, signing remediation, and physical iPhone/Android and accessibility checks remain separate work. Ordinary intake execution completion does not prove an actual text publication.

The dedicated account's Apps Script API setting was temporarily turned On with owner authorization for source and deployment management. Returning it to Off after maintenance remains to be verified through the authenticated dashboard.

## Post-v29 independent checks — 16 October 2026

- Current `main` at `33b554ef8e6d395898ba3a7900a2ae694d3dda9c`: GitHub Pages reports `built`, with HTTPS enforced. The latest checked Sheet monitor, web-push delivery and Pages deployment runs completed successfully. Public landing, Annals, Photos, CoL revision, rule-version and Celebration pages returned HTTP 200. These observations do not prove a new private Annals text publication.
- [Fictional hosted browser qualification](https://github.com/justinpfisher/Stammtisch/actions/runs/38904680692) passed **44/44** checks across desktop Chromium, iPhone WebKit emulation and Android Chromium emulation. It used loopback fixtures, without production credentials, genuine member material or physical devices.
- [Read-only hosted CoL witness](https://github.com/justinpfisher/Stammtisch/actions/runs/38904697138) completed successfully and compared all five allowlisted public rule files with the current committed bytes. This is one network-vantage observation of existing public files, not an amendment, activation clock or release authority. Existing scoring, historical allocations and notification safeguards remain unchanged.
- The October 30-case private QA evidence and six recorded dispositions remain as [documented](annals-october-2026-qa-summary.md). The corrected engineering paths still need fresh genuine post-fix acceptance; historical attempts are not replayed.

## Remaining controlled acceptance

- **Owner-editor checks:** refresh the post-v29 single 15-minute Head trigger inventory; run the dedicated read-only publication gate reader; inspect the private one-shot photo codec fixture reservation and execute only if unconsumed and supported. Until then, runtime gate booleans and fixture outcome are unverified. Successful scheduled intake completion alone does not establish actual ordinary text publication.
- **Signing:** follow the existing owner-controlled [signing remediation sequence](annals-editorial-release-2026-10-15.md#signing-remediation--owner-controlled-still-pending), with private confirmation of the affected credential names, reconciliation of unknown dispatches, controlled replacement, old-key rejection and future exact-signing evidence. No signing value, remediation marker, secret or production state is changed by this checkpoint.
- **Photo:** after signing remediation, standing consent, rights, revocations, one-shot and budget preflight, use a new genuine authenticated source in the existing narrow exact-source, expiring acceptance lane. Preserve broad Photo/History/CoL publication gates off. Privately compare permitted HEIC/HEIF and JPEG originals with derivatives for orientation, metadata removal, real visual quality and exact live bytes; include distinct and inline images. Complete a genuinely requested caption/date correction and withdrawal with canonical index/assets and retired-ID verification, then disarm the lane. Follow the detailed [photo acceptance procedure](annals-private-qualification-2026-10-15.md#controlled-genuine-photo-acceptance-before-broad-activation). No genuine-content acceptance is claimed here.
- **CoL:** preserve the interim fail-closed activation guard. A genuinely member-initiated amendment still needs a non-operative source-bound candidate, independent hosted candidate/source/parameter/implementation evidence, a separately signed fresh-base activation transition and observed publication clock, plus delayed/partial Pages recovery, competing-amendment, Source Sheet Editor+Viewer, death-verification and notification checks. The successful public-only witness does not satisfy these controls.
- **Physical access:** record actual iPhone Safari and Android Chrome checks of photo tap/enlarge, keyboard/focus, 320px and reduced-motion behaviour, plus VoiceOver and TalkBack reading, navigation and redaction. Capture device/OS/browser/assistive-technology versions and the tested content revision privately. Browser emulation is not physical or assistive acceptance.
- **Operational limits:** retain the existing November 8 AI stop, November 9 token expiry, budget and one-shot controls; no paid request or gate activation is authorised by this evidence.

The dedicated account-level Google Apps Script API switch was last verified On. The supported Windows computer-use policy forbids changing in-app security/privacy settings, so Codex did not toggle it. The owner must use the existing authenticated Apps Script Settings page to switch Google Apps Script API Off, reload, and confirm Off. The same Chrome control could read the editor but returned “coordinate input geometry is unavailable” twice when trying to open Triggers; post-v29 editor trigger/gate/fixture checks therefore remain unverified. No account or production setting was changed in this attempt.
