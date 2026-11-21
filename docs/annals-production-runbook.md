# Annals — private production runbook

This is the **current** short operating path, not a request to repeat historical acceptance. The detailed 20–21 October historical runbook is [preserved verbatim by Git](https://github.com/justinpfisher/Stammtisch/blob/8e8df15f35d2a101e815417441195818630bdea9/docs/annals-production-runbook.md); it is not authority for superseded gates or spending limits. See [current state](current-state.md) and [Issue #24](https://github.com/justinpfisher/Stammtisch/issues/24).

## Normal operation

An authenticated message to `annals@stammtischbrewery.com` enters the existing dedicated Gmail and owner-only Drive/Apps Script intake; eligible signed material is processed under **recorded scoped standing permissions**, not a fresh owner approval. Screening must preserve actual speaker attribution, member recipe quantities and syrup steps, source photography and withdrawal/revocation checks. A held image does **not** hold otherwise safe eligible text. Confirm published state only from signed repository data **and the actual live Pages derivative**; a dispatch acceptance alone is not live success.

On **21 November 2026**, the same owner-only Apps Script deployment was read back at **Version 71**, with one `runAnnalsProductionIntake` trigger every five minutes. The disabled trigger was replaced under the same account and the replacement ran unattended. The [production record](https://github.com/justinpfisher/Stammtisch/issues/24) links the live recollection and recipe that followed. That is evidence of recovery, not a guarantee of cadence or an explanation of why Google disabled the old trigger.

For an ordinary website edit: commit reviewed source to `main`, run affected checks, let Pages deploy and verify the affected public URL. **Do not enter Apps Script or perform a signing/consent exercise for copy/layout.**

## Private source and credential changes

**Members only:** [#328](https://github.com/justinpfisher/Stammtisch/pull/328) superseded the earlier outside-contribution route. Only the six authenticated members may submit, with no special subject or formatting. The October outside-submission qualification and Version 61 are historical, not pending work. Do not reopen them.

When a genuine private-code change is necessary:
1. Compare only changed modules with the reviewed `main` baseline; if there is evidence of an incident/drift, expand the comparison. Use `scripts/annals/build-install-package.py` to prepare owner-private reviewed code, never a public kit with private settings.
2. In the **same original owner-only Apps Script project**, save the affected modules and dependencies in a safe order, read back exact saved source, then advance the **existing** `/exec` deployment in place. Saving HEAD affects its trigger immediately; it does not update a versioned `/exec`.
3. Verify only the affected non-secret settings/behaviour and exactly one owner-run intake trigger. Preserve manifest/scopes, consent, Drive folders, publication receipts, permanent historical signing keys, cursors, attempts and replay/withdrawal records. Do not reset and redispatch an uncertain request.
4. If credential access is inadequate, use one authenticated owner repair; no broad key rotation, new Apps Script project or permission expansion without a real need.

The private `ANNALS_GITHUB_TOKEN_EXPIRES_AT` must reflect the token **actually installed**, not a guessed lifetime. The installed value and authenticated provider metadata both showed **16 January 2027, 00:00 UTC**, with repository-only scope. The November source fallback is not the effective cutoff. Do not rotate now. That stop occurs at **7 p.m. Toronto time on 15 January 2027**, one hour before the 8 p.m. annual CoL handover; verify the installed expiry and renew with margin in early January. Renew in place before that verified actual stop or migrate to a supported GitHub App with only required repository dispatch permission, preserving issuance and replay safeguards. Never disable the stop merely to hide the outage risk. Read-only owner diagnostics may confirm configuration without printing token values.

## CoL and new deaths

A clear authenticated member decision needs no second Club adoption. Publish ordinary settled public wording with focused checks. For changes to **recorded scores, permissions, durable rights and independent death alerts**, reconcile the actual source and existing signed allocation safeguards. Keep signed historical releases and source witnesses; a simple editorial correction should not repeat their initial qualification. Only a genuinely **new, independently confirmed** celebrity passing may generate a deduplicated death push. Backfills, corrected dates, withdrawn content and rule changes must remain silent. Use [the existing source-bound CoL protocol](col-two-stage-release.md) only while the actual signed numeric machinery still depends upon it.

## Cocktail images and other photographs

Eligible input formats are JPEG, PNG, WebP, HEIC and HEIF; real private acceptance for the latter four has not yet been demonstrated. Apply the existing installed conversion/screening safeguards and source rights before public output, strip metadata and preserve orientation. Publish a screened authentic original rather than a fabricated photographic edit if the optional transformation fails.

The [existing native-photo route](annals-photo-roundtrip-contract.md) passed an unattended real-member round trip on **21 November 2026**: the hourly worker used one included native edit, the [signed publisher](https://github.com/justinpfisher/Stammtisch/actions/runs/44879609572) and [Pages](https://github.com/justinpfisher/Stammtisch/actions/runs/44879625433) succeeded, and both the edited image and original were verified live. The next scheduled check skipped the completed job. Keep source-bound rights and one-use attempt records. Do not resend or regenerate an uncertain attempt or substitute a paid image provider. The retired US$2 reservation, former paid procedure and supervised Kingston test remain historical; no spending authority changes. If an optional edit fails, eligible text and the screened authentic original can still publish.

## Incident rule

If intake appears stalled, inspect the original owner's trigger and recent **Time Driven** runs of `runAnnalsProductionIntake`. A completed run can report `enabled:false`; a normal `enabled:true` summary can have zero items. A saved cadence setting, cursor or empty hourly photo queue does not establish that the five-minute inbox ran. When there was an eligible item, distinguish intake, signed dispatch and live readback. Do not use the historical cadence helper to test or repair the trigger.

Hold only the affected action for absent individual rights, invalid private authentication, genuine source conflict, unknown billable result, or independently unverified death. Continue unrelated authorised publication. Log one actionable exception privately and, when safe, a metadata-only checkpoint in Issue #24. Dated private runbooks remain in Git history; do not resurrect retired acceptance gates.
