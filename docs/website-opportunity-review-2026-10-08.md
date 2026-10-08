# Stammtisch website and opportunity review — 8 October 2026

**Scope:** https://stammtischbrewery.com/ and public justinpfisher/Stammtisch main, plus historical club context recovered from relevant earlier conversations. **Type:** read-only review and recommendation; this document does not authorize or implement new website features.

**Review method and limits:** Examined the public site's text rendering, current GitHub HTML/CSS/JavaScript/manifests, README/AGENTS, CoL/notification/automation documents, GitHub issue state and recent Actions conclusions. Read existing physical GMKtec verification evidence in issue #20. This session **did not control a real iPhone/Android, complete a screen-reader or Lighthouse audit, run an authenticated Sheet refresh, send a live push, measure performance, or independently rerun all tests**. Some webpage indexing showed older cached subpage copy (notably a 2026 location), while current main and successful current Pages deployments show the 2027 Assembly; treat as a live device/cache recheck, **not a confirmed current production defect**. No source or website changes were made as part of the review itself.

## Owner clarifications and resulting decisions — later on 8 October 2026

The original review below is retained as a dated baseline. The owner subsequently confirmed:

1. **Recurring date:** Monthly Stammtisch is the **third Friday**, with many meetings at the **headquarters**. The Annual Gentlemen's Assembly is different: an **off-site**, typically rented-cottage gathering. The homepage can display the next third-Friday calendar date and offer a date-only recurring calendar reminder. No regular start hour, exact headquarters address or assumption that every month is held there is authorized.
2. **Cocktail ritual:** At many gatherings **one or two members make a special cocktail**, often including syrups or other homemade ingredients. This deserves eventual documentation in a voluntary **Cocktail Register** or the Annals, when actual recipes and publication permissions are available. No historical recipes, attributions or photos should be invented.
3. **Annals commitment and privacy:** The owner enthusiastically supports an Annals concept but is concerned about identifying photographs and personal details on the **public** website. Start with **real text and non-identifying imagery** (cocktails, ingredients, scenery, objects, approved club art). Obtain content-specific consent for any new portraits, names in new contexts, sensitive stories, and recipes. Current approved stylized likenesses and public CoL data appear acceptable so far; do not expand those permissions by inference. The public GitHub repository is not a private gallery. Detailed procedure: docs/annals-publication-guidelines.md.
4. **January draft timing:** Current CoL celebrity selections stay active **until the January meeting/draft**, not only through December 31. At the same time the official **scoring year is January 1–December 31**. The fate of passings between Jan 1 and the actual draft is a genuine interpretation gap, **not** permission to automatically alter the competition's new-year scoring. The existing strict season/year guard remains necessary. Resolve the gap before making any CoL automation change.

**Implementation scope for this iteration:** A compact monthly date/countdown section, a recurring all-day calendar **date reminder** (not an all-day gathering), low-maintenance tests, and updated institutional/editorial documentation. No new Annals content, real cocktails, personal photos, member-only system, changes to the Assembly start, CoL scores or notifications.

## Executive judgement

**Stammtisch should develop into a lightweight digital clubhouse and institutional memory, not another social network.** The six-member relationship, recurring get-togethers, annual cottage retreat, distinctive mock-formal voice and Celebration of Life provide authentic reasons to return. Building features simply because the website *can* host them would weaken the result by adding upkeep, passwords and duplication of the group's existing conversations.

The current design and CoL functionality are relatively mature. The biggest product gaps are:
1. **No enduring, permission-conscious record of past gatherings and club moments.** The website celebrates a tradition but rarely shows its history.
2. **Little utility between the annual Assembly and CoL events.** A simple "next gathering" area or annual planning page could help, without reproducing WhatsApp.
3. **The 2026-to-2027 CoL season transition needs deliberate governance and technical planning.** Existing guarded import rules intentionally refuse unfamiliar competition years or formats. This is a near-term continuity obligation, not a suggestion to let automation guess.

### Priority table

| Priority | Recommendation | Benefit | Complexity/upkeep | Boundary |
| --- | --- | --- | --- | --- |
| P0 | Reconfirm production mobile rendering, public CoL subscription and end-to-end alert/points contract; triage outstanding monitor incident | Protect trust and correctness | Low–moderate initial; small monitoring load | Do not send a fabricated death notification; use approved tests and pilot mechanisms |
| P0 | Plan the **2027 CoL rollover and January draft** before the season changes | Avoid broken year transitions and loss of 2026 history | Moderate and domain-specific | Approved rules/register always win; new year not auto-inferred |
| P1 | Add a small **Annals of Stammtisch** archive, initially one entry per past Assembly/year | Permanent identity and shared memory | Low if editorially curated | Only real memories/photos, with member consent |
| P1 | Add an unobtrusive **Next Stammtisch / in the diary** area on home | Practical reason to revisit monthly | Low if owner can update a short text/calendar link | No public private home address, precise logistics or group invite link |
| P1 | Convert the Assembly page into a reusable seasonal template; add useful confirmed essentials | Better planning, less yearly reconstruction | Low–moderate | Public generalities; private logistics stay in existing group channel |
| P2 | Archive 2026 CoL results and actual award outcomes, with year chooser | Preserve competition history; make January draft meaningful | Moderate | No provisional badges presented as final |
| P2 | Enable a lightweight consent-based photo/story gallery or simple member contributions | Belonging and active participation | Moderate editorial/permissions work | Explicit contributor/editor approval; don't expose private source photos |
| P3 | Polls, member profiles, merchandise, beer catalogue, expense tooling | May be fun later | Variable, potentially high | Build only for demonstrated recurring demand |

## Current functionality review

### 1. Homepage and identity — strong

**Observed:** Distinctive heritage-inspired crest and refined warm cream / dark forest / brass styling; concise statement of purpose; prominent Feb 5, 2027 countdown and Assembly link; cottage preview; Celebration of Life invitation; responsive layouts, social-sharing metadata and Home Screen icon support. The writing successfully preserves intentionally disproportionate ceremony.

**Strengths:** Memorable identity, restrained navigation, a clear upcoming focal event, consistent visual vocabulary, coherent between pages.

**Gap:** No visible historical continuity (previous Assemblies, meaningful moments or membership timeline), and little indicating the next *monthly* Stammtisch. Visitors could reasonably mistake the Assembly and CoL for the full extent of the club.

**Recommendation:** Keep the main page uncluttered. Add only a compact "Coming up" entry and a small, exceptional "From the Annals" teaser linking to a separate archive page. Avoid a generic news feed or dozens of equal-weight home cards.

### 2. Annual Assembly — functional, with sensible privacy limits

**Observed:** Current repository gives Huntsville 2027, published start 9 a.m. on Friday Feb 5, cottage listing and descriptive photos, general essentials, a calendar invitation and navigation. The README explicitly distinguishes start from property check-in; private reservation/entry details are not published.

**Strengths:** Useful shared public reference, concise arrangements, existing calendar integration, no invented checkout/programme details. External Airbnb photographs are credited.

**Gaps / checks:** Verify the start-only .ics renders sensibly in common calendar clients (some may impose default duration); confirm links and external Airbnb photos still render; check the current phone page rather than cached crawler copy. As an external host can change listings/images, a missing photograph should degrade gracefully. Confirm the level of publicly disclosed trip date, destination and lodging link is acceptable to all six.

**Recommendation:** A reusable "Annual Assembly" model containing confirmed date and high-level location, diary link, an optional confirmed itinerary/packing checklist, and a clearly separated annual archive. Send exact arrival, access, expense or private accommodation instructions through the group's established private communications rather than this public static site.

### 3. Celebration of Life — unusually capable for the group's size

**Observed:** Six standings, 300 established numbered selections with a separate BB source entry, member filters, name search, passing/selection-status and double-point filters, commemoration cards with date provenance, official rules, award previews, draft projections and original-Sheet access. JavaScript rendering includes accessible labels, HTML escaping/HTTPS-source-link restrictions, keyboard-friendly disclosures and no-script fallback. The public JSON is about 141 kB. The page has a compact notification accordion near the foot rather than a large permanent interruption to the standings.

**Strengths:** A genuinely recurring reason to return; one published data model feeds multiple derived views; points and rules are specific to this club. The site explains the difference between awarded and merely potential points and treats commemorations as people, not just scores.

**Risks:** Scoring is socially consequential in a small group. False or misattributed deaths, negative points, shared allocations, double points or wrong Birthday Buffet discovery dates would erode confidence. Rules and website must stay synchronized. The source includes personally identifiable member faces and birthday month/day data that visitors can view; confirm the group intends this to be public. The original Google Sheet link is public on the website; its actual sharing permissions should be reviewed so it exposes no unapproved additional information.

**Recommendation:** Preserve the verification gates. Add an annual results/award archive before expanding the core game. Treat unsupported interpretations as flagged human decisions rather than silent algorithmic inventions. A "share this commemoration" link via standard phone sharing could be useful later if it does not expose private contacts.

### 4. Spreadsheet publishing — strong controls; operational dependency

**Observed:** Hourly GitHub-hosted Sheet monitoring, strict eight-tab member/year mapping and total reconciliation, independent death-date verification, a separate reviewed confirmations record, multiple tests, guarded Pages publication and encrypted monitoring artefacts. Failed verification retains the last known good baseline; source-only notes/formatting and no-change checks do not automatically produce new notifications or unnecessary content updates.

**Strengths:** Low manual burden for normal cases and deliberate refusal of ambiguities. Production jobs run independently of the GMKtec. Current physical GMKtec verification is recorded completed in GitHub issue #20, including 63 Python and 49 Node tests; this review relied on that result rather than claiming another local test.

**Risks:** The existing design intentionally stops on a new season/member/unknown workbook structure; the yearly draft will need a controlled migration. GitHub Actions scheduling is hourly, not real-time. Encrypted 30-day artefact retention can require manual baseline recreation if operations stall for too long. Embedded spreadsheet drawings/portraits are not fully covered by the Sheets API comparison. One failure issue (#17) remains open while later successful runs exist; triage its cause and close/update only with evidence of resolution. A production check must still detect source permissions and workbook changes.

**Recommendation:** Add a small documented monthly operational review (monitor/Pages/notification success, open incidents, yearly transition readiness); avoid adding a second platform/database simply to improve a six-person website.

### 5. Web push — public opt-in live mode, but delivery needs continuing evidence

**Observed:** OneSignal app and public subscription configuration were enabled on Oct 8 following an iPhone pilot. Subscriptions are voluntary, available to any consenting website visitor, do not require a new App Store application, and have unsubscribe guidance. Android instructions are present; physical Android pilot was previously waived. The source deploys a dedicated OneSignal worker, lazy-loads its SDK after consent, has a visible status/error state, and uses a delivery ledger (issue #18) seeded with historical events. The site uses a compact "Stay in the loop" disclosure near the footer plus a top jump link.

**Strengths:** Low participation friction, appropriate restraint in the user interface, separation of verified website publication from sending, deduplication and publication-specific links. Intended messages identify each newly deceased celebrity, every recipient and actually awarded **signed** points.

**Risks/checks:** A successful workflow or seeded ledger is not proof of future message receipt. Verify a legitimate next new event is notified once, only after independently confirmed death and reconciled published points; ordinary data corrections/redeployments/no-change checks should be silent. Test subscribe/unsubscribe/resubscribe and browser notification permissions when device access is available. The site must not claim Android physical testing occurred when it did not. OneSignal is an external provider; review privacy policy/consent language when integrations change. Any expansion beyond CoL would require an explicit new product decision.

### 6. Design, accessibility, performance and discoverability — good foundation, audit incomplete

**Positive source evidence:** Responsive breakpoints including narrow mobile widths, semantic headings, labels and alt text, a keyboard skip link, visible focus indicators, reduced-motion accommodation, native disclosure controls, sized WebP crest assets, lazy loading for noncritical images, social previews, descriptive page titles and first-party Home Screen icons.

**Not yet proven:** Screen-reader interaction for nested filters/disclosures, keyboard behaviour across every state, colour contrast against WCAG targets, actual performance on slow phones, Safari/iPhone and Android visual differences, offline behaviour, and full live production asset availability. No Lighthouse result or real-device recording was produced in this review.

**Recommendation:** Run one bounded real-device/screen-reader/contrast/performance pass before making more design changes. Preserve the currently compact notification widget. Do not enlarge it again merely to convey rollout information.

### 7. Security and privacy — important because this is public

- GitHub repository and Pages output are public, and CoL opt-in is intentionally open to all visitors. A public web page is **not a members-only area**.
- Existing published material includes first names, portraits, birthday month/day data, celebrity lists, scores and event/lodging context. This may be acceptable, but should be an intentional group decision, not an accident of convenience.
- Original reference photos are private in ChatGPT Library; only approved stylized composite assets should appear in the public repository unless separately cleared.
- Do not upload the club constitution drafts or private chat archive merely to "complete" the institutional memory. Never publish member contact details, private WhatsApp invite links, private itineraries, finances or accommodation entry instructions.
- If a truly confidential gallery, planning space or member directory becomes essential, it needs a real access-control solution or an already-used private channel; obscuring a GitHub Pages URL is not security.
- The Google Sheet remains read-only for the site workflow. Review its own sharing permissions independently.

## The actual opportunity: shared memory + a few useful rituals

The durable value for six friends is not traffic, monetization, advertising, user accounts or a feature count. It is that the site can **record the traditions they already have**, **make their next gathering easier**, and **accumulate stories that become more valuable with time**. The nickname-like ceremonial voice makes this archive distinctive; ordinary photo galleries and event feeds would not have the same identity.

### Recommended concept: "The Annals of Stammtisch"

A short page organised by year:
- Confirmed Assembly date/general location, one short authentic caption and two or three explicitly approved photos if available.
- A small "matters for posterity" note, such as the agreed award winners, a charity team activity or a memorable official-sounding decision, only where supported.
- A link to that year's finalized CoL standings when available.
- An optional tiny archival item from ordinary monthly gatherings, but **no fictional reports, attendance or quotations**.

Start with one authentic year/Assembly rather than requiring a full historical rewrite. Editors should have to approve public wording and imagery before publication. A deliberately restrained "Minutes of exceptional insignificance" tone may work, but parody must not attribute fake words or embarrassing stories to real members.

### The monthly usefulness test

A small "Next Stammtisch" module should answer one member question in seconds: *When is the next gathering?* If venue details are private, use "arrangements in the group chat" rather than posting the address publicly. A simple agreed date, one calendar file or button to open the existing communication channel is enough. A separate RSVP service or group-chat replacement is not justified unless the club finds itself repeatedly unable to plan using its current tools.

### The annual continuity test

The January CoL draft and February Assembly recur every year. Preserve **history across years** without allowing the pipeline to guess new rules or carry 2026 picks forward incorrectly. Archive and label the old season; validate the fresh 2027 sheet, approved roster, points and date interpretations; migrate with explicit review and tests. At the Assembly, publish only confirmed public-facing material, then add a retrospective after the group has approved it.

## Suggested delivery sequence

**Now (operations):** Triaging issue #17; fresh phone checks for three pages, manifest icons, the compact notification disclosure and public opt-in; read-only production check of Sheet/Pages/update health; define the owner-approved 2027 CoL transition. No invented alerts or re-sent historic notifications.

**Next small website release:** Create a minimal Annals page and single "Next Stammtisch" area (if a public date is acceptable). Preserve the established design and mobile performance. Add a simple publication/consent checklist rather than a new admin backend.

**Before the January 2027 draft:** Finalize 2026 results, distinguish provisional from awarded distinctions, establish the season archive and validated 2027 source mapping. Test that year rollover cannot accidentally republish 2026 as live results.

**Before/after the February 2027 Assembly:** Recheck calendar/time and lodging details; optionally curate an Assembly checklist; after the event gather one or two member-approved images or real moments for the Annals.

**Only when requested and justified:** Photo contribution workflow, club calendar, votes/polls, extra interactive games, venue/beer lists and private member content. Keep photographs, costs and group logistics private when necessary; WhatsApp and existing tools remain the default for conversation.

## Specific acceptance tests for future work

1. **Identity:** Club and CoL/Assembly pages retain the understated mock-institutional voice, current event date and six-person approved art. Nothing falsely suggests an actual commercial brewery.
2. **CoL correctness:** Full source-to-site row/score/member reconciliation; special 100/101+ cases; double points; BB; reviewed shared-score exceptions; distinct actual and discovery dates; unsupported records fail closed.
3. **Delivery:** New events alert once after publication with correct recipients and signed points; historical, edited, ambiguous and unchanged items never alert; subscribed users can opt out.
4. **Navigation and phones:** Home, Assembly and CoL display at common iPhone/Android widths; screen-reader basics and tap/focus states work; notification accordion stays compact and out of the primary standings.
5. **Calendar:** 2027 Assembly start remains 09:00 America/Toronto everywhere, with no invented cottage check-in or end time.
6. **Privacy:** No original private member photos or personal communications in git; no private Sheet export, secrets or subscriber identifiers; publicly disclosed group information reviewed by the responsible members.
7. **Continuity:** Historical CoL results remain readable after 2027 launch; there is no silent season rollover or irreversible loss of records.
8. **Maintenance:** All recurring features have a named simple content-update method that still works if the GMKtec is off.

## Evidence links / source of truth

- Website: https://stammtischbrewery.com/ ; https://stammtischbrewery.com/celebration.html ; https://stammtischbrewery.com/location.html
- Repository: https://github.com/justinpfisher/Stammtisch
- Rules: https://github.com/justinpfisher/Stammtisch/blob/main/docs/celebration-of-life-rules.md
- Award and draft interpretation: https://github.com/justinpfisher/Stammtisch/blob/main/docs/celebration-awards.md
- Source monitoring: https://github.com/justinpfisher/Stammtisch/blob/main/docs/celebration-sheet-monitor.md
- Mapping and automation audit: https://github.com/justinpfisher/Stammtisch/blob/main/docs/celebration-automation-audit-2026-10-07.md
- Notification contract and public activation: https://github.com/justinpfisher/Stammtisch/blob/main/docs/col-push-rollout.md
- Production push ledger: https://github.com/justinpfisher/Stammtisch/issues/18
- Pending alert triage: https://github.com/justinpfisher/Stammtisch/issues/17
- Completed GMKtec tests/non-interference: https://github.com/justinpfisher/Stammtisch/issues/20
- Recorded successful Pages deployment on Oct 8: https://github.com/justinpfisher/Stammtisch/actions/runs/37782016117
- Recorded successful CoL web-push workflow on Oct 8: https://github.com/justinpfisher/Stammtisch/actions/runs/37782141950
- Related contextual history and uncertain governance details: docs/club-context-and-history.md and its source register.

**Decision requested before implementing the new product backlog:** Confirm whether the club wants a simple public archive of group experiences (with specific photo/text approval), and whether public monthly dates are appropriate. The CoL and notification controls remain authoritative regardless of that choice.
