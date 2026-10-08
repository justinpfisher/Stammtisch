# Stammtisch Celebration of Life web push — controlled rollout

**Status: IPHONE PILOT VERIFIED; PUBLIC DELIVERY OFF.** The existing OneSignal app and protected GitHub secrets are configured. The owner confirmed iPhone lock-screen receipt, click-through to CoL, and receipt after re-subscribing on October 7, 2026. Android testing was waived by the owner. Website mode and delivery mode remain `pilot`; public activation is not approved. Deploying the interface or sender does not send a test or public notification.

## Agreed product contract

- Subscription audience after a successful pilot: **any website visitor who deliberately opts in**, not just the six Stammtisch members.
- Source of messages: **genuinely new, independently confirmed passing events with confirmed awarded allocations in the shared CoL register only**. No emails, SMS, other website pages or hourly no-change alerts.
- iPhone/iPad: first add the CoL page to the Home Screen, then open it as a standalone web app and grant permission. Requires iOS/iPadOS 16.4 or newer. No App Store download.
- Android: use the CoL website in a supported browser, allow notifications when requested. Home Screen installation not ordinarily required.
- Provider: OneSignal Web SDK v16 using its Custom Code web integration.
- Subscriber permission: an explicit setting on the CoL page, followed by a browser permission prompt. OneSignal is loaded only after informed setup consent (or after returning with remembered consent).
- Recipients: OneSignal's built-in Subscribed Users push segment after the public rollout. The site does not request or collect telephone numbers or email addresses. Anonymous browser subscriptions are managed by OneSignal.
- One notification per new passing: `Celebration of Life: [Celebrity]`, with each actual recipient and signed points. It links to that person’s stable commemoration anchor. Score corrections, ordinary edits, redeployments and historical records are silent. No estimated age-value points or member-total deltas are used.
- GitHub Pages remains a static site. No custom server or API keys are embedded in its front-end files.

## Prepared code

- /manifest.json: installable CoL start page with its existing `/celebration.html` identity. The approved Stammtisch Home Screen artwork is already deployed as 180/192/512-pixel icons (including Android maskable). `/site-manifest.json` supports installs from the Club homepage; preserve both app identities.
- /push/onesignal/OneSignalSDKWorker.js: dedicated permanent service worker at /push/onesignal/ with no root-scope caching or interception of unrelated pages.
- /col-push.mjs: one optional subscription panel on celebration.html. The compact “Stay in the loop” box is below the standings and before selections, with a top introductory jump link. Ordinary pilot visitors see a disabled preview. The pilot URL or an installed standalone app can manage voluntary subscriptions. The iOS instructions appear before permission is attempted; the SDK still loads only after consent.
- /data/col-push-config.json: public, non-secret mode and OneSignal app ID; currently mode `pilot` with the existing Stammtisch OneSignal app ID.
- /.github/workflows/celebration-push.yml: independent workflow, manual pilot-test action, scheduled retry at 29 minutes past the hour UTC, and successful CoL publisher completion trigger. It cannot delay or undo the separate CoL website publisher.
- /scripts/col-push-delivery.py: no-send first live checkpoint, site-publication verification, material-data hashes, message composition, persistent issue-based delivery acknowledgement, UUIDv4 OneSignal deduplication, and 25-day maximum safe retry window.
- Automated Node and Python tests guard the off state, audience, pilot-only sending, public go-live gate, invalid recipient lists, stale-public-site blocking and lost-acknowledgement retry.

## Existing OneSignal setup and repeatable pilot procedure

1. Reuse the existing Stammtisch Social Club OneSignal app; do not create another service. Configure Web Push, **Custom Code** integration, using the production site URL https://stammtischbrewery.com. Configure the browser VAPID details as required in the dashboard.
2. In OneSignal Settings > Keys & IDs, retrieve the public OneSignal App ID and separate secret REST API key. Never paste the REST key into public issues, source code, PR descriptions or the website configuration.
3. Inspect the deployed service worker directly at https://stammtischbrewery.com/push/onesignal/OneSignalSDKWorker.js. It must serve JavaScript under this origin, without a redirect or login. The code's fixed worker path and scope must remain /push/onesignal/.
4. Update the public config file with the real App ID and mode pilot, keeping the subscriber audience type unchanged. In pilot mode subscription controls are enabled only for the special test URL or installed standalone app:
   https://stammtischbrewery.com/celebration.html?colPushPilot=1
   This query parameter is a **UI aid, not security or an authentication secret**. iPhone Home Screen apps can open the manifest's fixed start URL without retaining the pilot query; therefore its subscription controls also work when a visitor opens the already-installed standalone Stammtisch web app. Public notifications are still impossible in pilot mode because the sender only supports a manual, individually allowlisted test.
5. Create a GitHub Actions secret named COL_PUSH_ONESIGNAL_API_KEY containing the OneSignal app REST API key. Create another secret COL_PUSH_TEST_SUBSCRIPTION_IDS containing a JSON array of one or two confirmed pilot Subscription IDs from the OneSignal dashboard. These IDs are never committed to the repo or included in GitHub issues.
6. Set GitHub repository variable COL_PUSH_DELIVERY_MODE to pilot. Leave COL_PUSH_LIVE_APPROVED absent or false.
7. Have the iPhone pilot participant subscribe through the test URL (Android testing waived by the owner). Validate their devices appear subscribed in OneSignal and that the browser's native notification setting is enabled.
8. In GitHub Actions, manually dispatch Celebration of Life web push with pilot_test=true. This sends a **test-only message** to the protected test Subscription IDs. It never addresses the public subscriber segment, even if other people discovered the test URL.
9. Test locked-screen reception on the iPhone Home Screen app, click-to-CoL behaviour, opt-out, opt-in and multiple manually initiated sends. The sender now fails the pilot when OneSignal reports no subscribed recipients, partial acceptance, or an unexpected error response. Even a fully accepted API request is not proof that either device displayed a notification; confirm delivery on the physical iPhone.
10. Confirm the main website publishing workflow still succeeds independently and that its public-data verification catches stale pages. The push notification workflow is a separate non-blocking integration.

## Explicit public activation after successful pilot

The owner must explicitly approve public activation after the successful iPhone pilot. Two independent changes are required; neither is performed by this update:

1. Change the public config mode from pilot to public. The opt-in setting then appears on the CoL website for **any visitor**. Anyone can choose Enable notifications or Disable notifications on each device.
2. Set GitHub repository variable COL_PUSH_DELIVERY_MODE=live and separately COL_PUSH_LIVE_APPROVED=true after owner review. The sender refuses broad messages if either gate or the corresponding website config does not match.

**First live run creates an issue-based checkpoint for the current public register and sends no historical notification.** This prevents replaying previously published events such as Eva Marie Saint. A legacy v1 checkpoint is also migrated without sending. Subsequent newly recorded, verified passing events can send after the public site reflects the validated register and all recipients’ actual allocations are confirmed.

## When notifications are sent

- The independent push workflow is awakened by a successful Celebration sheet monitor run. It can also respond to an ordinary direct commit that changes the CoL JSON, or its hourly fallback run. For commits made with GitHub's built-in Actions token, the monitor-completion event and schedule provide the notification path.
- It uses a permanent event ledger keyed by normalized celebrity name and birth date. All already-known passing identities are seeded without sending, including independently verified but unawarded records. Date corrections, point corrections, deletions/re-additions and deployments cannot replay a seeded or acknowledged event.
- A new event must concern a person present in the activation baseline, newly acquire a group discovery date, have independent death evidence, and have discovery and death dates within the active window. Historical backfills and inserted historical rows are suppressed. New seasons/list identities need reviewed re-baselining, which itself sends nothing.
- Awarded rows must be included in reconciled member totals, contain finite signed points, and satisfy the same centenary and double-point rules as the website; explicit reviewed allocations preserve Birthday Buffet and group-approved splits. Missing, unawarded, disputed or inconsistent points prevent sending. Partial allocations require a reviewed allocation decision. The original baseline remains available so a pending award can be confirmed later without being lost when another event sends.
- No new confirmed event means no alert, even if the material register hash changes. One separate packet includes every recipient of each eligible celebrity; recipients are never truncated out of the message.
- Before sending, it confirms the visitor-facing CoL JSON equals the current repository data. The notification is submitted through OneSignal with a UUIDv4 idempotency key.
- A single public GitHub Issue tracks the acknowledged digest, activation baseline, known event identities and each pending event’s stable idempotency key. It contains only already-public CoL content and non-sensitive hashes, not OneSignal identifiers, phone numbers, emails or REST credentials.
- If an outbound request succeeds but GitHub fails to acknowledge it, the next run repeats the same OneSignal key within the provider's 30-day deduplication window. After 25 days, an unacknowledged send stops for manual review rather than risk a duplicate.
- If the source changes *again* while an earlier push remains unacknowledged, the system stops for review rather than silently replacing or duplicating that unknown send.
- If the provider returns no subscribers, the event can be acknowledged without claiming successful delivery to a phone.
- A push failure opens or updates a metadata-only issue, without failing or rolling back the website publication.

## Limits and privacy

- No message can reach a browser unless that browser has opted in and its operating system permits notifications.
- Free service tiers, browser background behaviour, vendor outages, privacy settings, Home Screen requirements and user preferences can all affect actual delivery.
- The site itself is public, and public-mode subscribers may exceed six. No member-identification or login is required. A visitor can unsubscribe on their device.
- OneSignal necessarily processes subscription identifiers and browser/device information. The website links to OneSignal's privacy policy and does not initiate the SDK before voluntary setup consent.
- The GitHub scheduler is an hourly polling fallback, not a real-time guarantee. The primary signal is successful publication of the monitored CoL register.
- The approved Stammtisch crest icon is already installed in both app manifests; confirm it appears correctly with notifications on iPhone and Android during the device pilot.
- If GitHub Actions runs are paused, disabled, or out of retention/permission scope, investigate and recover manually; the public site itself can continue to operate without notifications.

## Source references

- Apple, Sending web push notifications in web apps and browsers: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- OneSignal, Web SDK reference: https://documentation.onesignal.com/docs/en/web-sdk-reference
- OneSignal, Service worker guidance: https://documentation.onesignal.com/docs/en/onesignal-service-worker
- OneSignal, Sending messages: https://documentation.onesignal.com/reference/create-message
- OneSignal, Node SDK idempotency details (30-day duplicate window): https://github.com/OneSignal/onesignal-node-api

