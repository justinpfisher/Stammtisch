# Annals synthetic private pilot

**Status (8 October 2026):** The owner authorised this private synthetic pilot and later supplied Google Apps Script execution logs showing preflight enabled with production switches off, followed by `staged:1`, `held:0`, `duplicates:0`, `skipped:0`. Treat this as **owner-reported account-side execution**, not independent verification of Google permissions, staged files, previews, retry behaviour or triggers. No real-member or production intake is authorised.

Receiving-only `annals@stammtischbrewery.com` forwarding is working: the owner verified two deliveries and a usable attachment, with two-step verification enabled on the dedicated private Gmail account. See issue #24. This does not authorise paid AI, real member processing, scheduled triggers, acknowledgement emails, public publication or notification changes.

## What this pilot proves

Deploy **only `PilotCore.js` and `SyntheticPilot.gs`** to a private standalone Apps Script project in the dedicated account. Do not deploy `Code.gs` alongside them: its older entry point scans the inbox more broadly. The new pilot:

- Does nothing until two private properties are enabled.
- Reads only threads under the fixed `Annals-Pilot` label, up to ten per manual run.
- Checks every message's subject prefix and sender allowlist before reading its body or attachments. Labels are thread-level, so ordinary replies are skipped.
- Requires owner-only Drive staging (no link sharing, editors or viewers), checks existing child folders/files, and holds oversized or unsupported material.
- Writes generic media filenames, an escaped `preview-private.html`, then the completion marker `manifest-private.json`. Repeating a completed message does not stage it again. Interrupted partial staging can be retried.
- Logs only readiness booleans and aggregate counts. Provider errors are replaced with a generic error to avoid leaking private identifiers.
- Never calls AI, sends mail, registers a trigger, fetches submitted links, deploys a web app or publishes anything.

**This is a source-text preview, not recipe extraction.** Category is a keyword suggestion. Quantities remain in the original test text; ambiguous measurements, event date, attribution and consent remain unverified. HEIC is held, not interpreted. No member invitation is authorised by this pilot.

## Access review before execution

`GmailApp` requests broad Gmail access and `DriveApp` broad Drive access, even though this code only reads marked mail and writes private staging. Label filtering limits code behaviour; it does not narrow Google's permission grant. Run only under the dedicated club account. The owner must inspect and approve the actual Google consent screen before granting access. If another account is selected, stop. Do not grant access to personal, college, Comparative or LCRS accounts. Do not bypass a browser security warning or an unexpected organisation restriction.

The Apps Script source and this setup document can be public; its project, properties, mailbox and Drive content must stay private. Never put real senders, mailbox identity, folder/project IDs, originals, previews or OAuth credentials in GitHub or public logs.

## Account setup

1. Sign into Google Apps Script and Drive with the dedicated account. Owner completes authentication and two-step challenges securely.
2. Create an `Annals Staging` folder in **My Drive**. Its sharing should show **Restricted**, with only the owner having access. Keep its folder ID private.
3. Create a private standalone Apps Script project named `Stammtisch Annals — Synthetic Pilot`. Copy the reviewed `PilotCore.js` and `SyntheticPilot.gs` into separate script files. No web-app deployment is needed.
4. In Project Settings → Script Properties, enter the following privately:

| Property | Initial value |
| --- | --- |
| `ANNALS_PRIVATE_FOLDER_ID` | Private staging folder ID |
| `ANNALS_ALLOWED_SENDERS` | One actual controlled test sender address; not all six members yet |
| `ANNALS_SYNTHETIC_PILOT_ENABLED` | `false` |
| `ANNALS_SYNTHETIC_READ_APPROVED` | `false` |
| `ANNALS_INTAKE_ENABLED` | `false` |
| `ANNALS_ALLOW_PRODUCTION_MAIL` | `false` |

5. Run `annalsSyntheticPreflight`. Review any requested Google permissions before accepting. Execution log should show `enabled:false`, `hasPrivateFolder:true`, `trustedSenderCount:1`, `productionEnabled:false`, `usesPaidAI:false`, `publishesAnything:false`. No mail/Drive reads occur within this function.
6. In the dedicated Gmail inbox create a label named exactly `Annals-Pilot`. Do not label old delivery tests or genuine member submissions.

## One synthetic case and repeat test

From the privately allowlisted separate sending account, email the working public alias:

- Subject: `[ANNALS SYNTHETIC PILOT] Invented cocktail recipe`
- Body: `SYNTHETIC TEST ONLY. Invented recipe: 1/2 oz syrup and 1 oz water. Syrup instructions intentionally absent. Event date and attribution unconfirmed. Do not publish.`
- Attachment: a small non-identifying test JPEG/PNG, with no personal images or private details.

In the destination inbox apply `Annals-Pilot` to this test thread. After the owner approves the actual access grant and test-message reads, set both synthetic properties to `true`; leave both production properties `false`. Manually run `runAnnalsSyntheticPilot`.

The owner has reported one staged case, but the outputs below still require **private inspection**. Inspect the owner-only hash-named subfolder: generic attachment filename, `preview-private.html`, and `manifest-private.json`. Download/open the HTML locally if Drive does not render it; do not host it or enable link sharing. Confirm original quantities remain unchanged, category is only a suggestion, review caveats are visible and `publishable` remains false.

Repeat the same run: expect **one duplicate**, with no new source folder, output file or second media copy. The supplied first-run `duplicates:0` is expected and does **not** verify this idempotency test. Send an ordinary reply without the test prefix: it must be skipped even if it shares the labelled thread. Do not use fabricated member history or death notifications as test content.

After checking results, set both synthetic properties back to `false`. There is no unattended trigger. Record only non-sensitive counts/pass-fail results in issue #24; the actual preview and account evidence remain private.

## Verification limits and next steps

Local tests simulate Google services; they do not prove actual OAuth, Drive sharing, forwarding sender headers, Gmail labels, repeat idempotence or trigger state. The owner-reported first staged run confirms only that a manually invoked process returned the stated counts. Before declaring the **manual synthetic pilot accepted**, privately confirm permissions, artefact contents, expected duplicate-run result and both synthetic switches returned to `false`; never publish private account evidence. The allowlist is triage, not authentication, and no approval command exists here. Use a separate test sender that the owner controls and verify its actual forwarded From header privately.

Next separately reviewed work: robust real-message authentication/backlog processing, consented image/handwriting interpretation and conversion, cost controls, authenticated exact-content approvals and approved-only publishing. These remain inactive. Website, CoL, OneSignal and shared runners are outside this pilot.
