# Annals of Stammtisch — email-to-website publishing proposal

**Status:** Historical proposal from 2026-10-08; its original no-automatic-publication gate was superseded by the owner's 10 October 2026 decision for narrowly eligible, separately consented, source-grounded automatic text. **Current authority:** `docs/annals-production-runbook.md`. **Owner intent:** Almost zero manual website maintenance, one simple email submission process for the six friends, AI classification and editorial preparation, with controlled publishing.

**Do not treat this design as permission to provision services, change DNS or MX records, connect personal inboxes, incur costs, create API keys, activate automated publishing, upload private images, or broaden OneSignal notifications.** This is a proposed workflow with phased deployment gates.

See `AGENTS.md`, `docs/club-context-and-history.md`, `docs/annals-publication-guidelines.md`, and `docs/website-opportunity-review-2026-10-08.md`. These remain authoritative for club context and privacy constraints.

## Update: custom-domain forwarding first (8 October 2026)

The user prefers to establish **`annals@stammtischbrewery.com` immediately**, rather than share a temporary Gmail address with members. Historical domain-registration context points to **Porkbun**, whose current free service provides **20 custom-domain forwarding aliases**. Before using it, confirm live Porkbun account ownership, nameservers, existing MX records and any currently used domain mail service. The practical plan is **Work for secure, user-approved account/domain setup**, then **Codex for the already-started private processing system**. The preferred dedicated Gmail inbox is the private forwarding destination; members see only the custom address. Porkbun forwarding receives mail but does **not** give the club branded outbound mail. Do not rely on Gmail's third-party `Send as` after its scheduled January 2027 withdrawal.

See [the Porkbun-first Work handoff](annals-email-routing-work-handoff-2026-10-08.md) for exact actions, safety checks and stop conditions. This supersedes the earlier assumption that a third-party forwarding service might be needed. This is **still not an activation record**; no nameservers, MX, email accounts, paid services, AI processing or public publishing were changed.

## Outcome first

A member should be able to use the normal iPhone/Android Mail/Share menu to email a cocktail photo, handwritten syrup recipe, actual club quote, photograph of a keepsake, or recollection to **one address**, with no app download, account creation, template or categorisation task. The automation:

1. Receives the email and sends a brief acknowledgement.
2. Processes the content **privately**; reads attachments, extracts genuine ingredients and steps, and separates event facts from prose.
3. Classifies it as a cocktail/recipe, quote, monthly gathering, Annual Assembly, club history, artefact, or uncategorised suggestion.
4. Generates clean public-facing text in Stammtisch's restrained mock-formal voice, including a candidate title, structured facts, suggested caption and alt text as appropriate.
5. Applies objective validation and consent/privacy checks. **Uncertain facts, identities, recipes, claims, ambiguous handwriting, embedded faces and the user's quoted words are not guessed or automatically "corrected."**
6. Either requests approval with an exact **private preview**, or, only in a later separately authorised phase, publishes a narrow low-risk class under an explicit standing consent rule.
7. After publication approval, writes the approved *derivative* to the existing static GitHub Pages website and verifies the published result. It sends the contributor a link to the published entry, or a useful failure/clarification message.

**No other member needs GitHub, ChatGPT, Drive or a website account.** Emailing a submission is not by itself consent to publish identifying photos or quotes involving other people.

## Operational recommendation

**Pilot recommendation:** A **dedicated Gmail mailbox**, a **Google Apps Script time-trigger** (e.g., every 15 minutes), private staging in that account's Drive, a separately billed OpenAI API project for AI analysis, and controlled publishing to the existing public Stammtisch GitHub repository.

- Proposed friendly receiving address: **annals@stammtischbrewery.com**, if the current domain/DNS provider can provide forwarding without breaking any existing mail service. This address is **not yet created or tested**.
- Start with a distinct Gmail mailbox (address to be decided by the owner), not the owner's regular personal or college email. A public-facing custom address can forward there later. Do **not** repoint MX records or migrate the domain to another DNS provider merely for this feature without an explicit infrastructure decision and inventory of existing records.
- A Google Apps Script clock trigger can poll this mailbox at intervals; Gmail does not offer the desired generic *on email arrival* Apps Script event. The short delay is acceptable for a historical club journal.
- The dedicated mailbox and its private Drive folder hold **original emails, files and working drafts**. The **public GitHub repository, its issues, PR branches, Actions logs and Pages site must never contain a raw/unapproved submission or private preview**.
- Use an appropriately configured, dedicated OpenAI API project/key. Do not assume ChatGPT subscription usage covers external API calls or that a provider "monthly budget" guarantees a hard cap.
- Once authorised, only the exact final approved text, consented publishable image derivatives, public source identifiers and provenance/status metadata may be committed to public GitHub.
- This pipeline runs on a hosted service independent of the GMKtec; it must not enrol the GMKtec, Comparative, or LCRS as a public GitHub Actions self-hosted runner.
- The existing Celebration of Life spreadsheet, publication and OneSignal systems remain entirely separate. **An emailed report of a celebrity death never changes the CoL register, scores or push notifications.**

### Alternatives reviewed

| Option | Experience | Operations / dependency | Recommendation |
| --- | --- | --- | --- |
| Dedicated Gmail + Apps Script + private Drive + AI API | Email and attachments with minimal sender friction | One new mailbox, one scheduled trigger, AI project and restricted GitHub publishing credential | **Best small-club pilot** |
| Custom-domain inbound Cloudflare Email Routing + Worker | Attractive address and event-driven intake | Requires existing or migrated Cloudflare DNS; additional Worker/asset storage and configuration | Consider only if already in Cloudflare or Gmail trigger proves limiting |
| Gmail account reviewed through connected ChatGPT on request | No development needed to assess examples | Not reliable unattended email-to-website automation | Good **manual trial**, not production architecture |
| Public webpage form | Better prescribed fields | Extra webpage step, form/attachment backend and authentication/abuse controls | Not first choice |
| WhatsApp Business automated intake | Familiar messaging channel | Business platform onboarding, permissions and operational complexity | Do not add for six people when sending/forwarding email is sufficient |

Cloudflare's public documentation states Email Routing is available on Free and Paid plans but requires its DNS; it is not a reason to make potentially disruptive DNS changes. Google Apps Script has quotas, including six-minute executions and 25 MB outbound email attachment limits, and Google supports time-driven triggers. Recheck limits at implementation time. Public GitHub Actions on standard GitHub-hosted runners remain free for compute, but stored artefacts, APIs and other services are separate considerations.

## Zero-configuration sender experience

**Suggested instructions to the six:** "Email whatever you want considered for the Annals: a drink photo, the recipe, a memorable quote, an anecdote, or any related material. Tell us if you have a preferred title, name/anonymous credit, or if something is private. If not, the editor will choose a draft and ask when clarification or publication consent is needed."

- A subject like "Tonight's special" plus two photos is enough for intake. A forwarded email also works if authorised and its content is safe to process.
- No mandatory hashtags, categories, logging into GitHub or recipe form.
- Submission receipt: one short acknowledgement. Do **not** send several progress emails or daily no-change digests.
- If text/recipe details are clear, the private preview can be sent to the club's nominated publisher for one approval. The contributor need not do extra work unless the text is ambiguous or ownership/consent is unclear.
- If the creator wants attribution, support "first name", "nickname", "a club member", or anonymous **as an explicit choice**, without inferring approval to reveal a name.
- Offer "please don't post this" as an easy response; treat it as a block, not a suggestion.
- For updates/corrections, detect "correction to [known drink/entry]" and propose a versioned update to an existing entry, not a duplicate.
- Do not auto-forward or expose submitters' personal email addresses to the public site.

## Categorisation and publishing model

**Controlled broad intake, narrow published types.** "Any content" means "anything can be submitted for review", not "every file type can be parsed safely and published".

| Type | Extract and preserve | Default destination | Approval |
| --- | --- | --- | --- |
| Cocktail and syrup recipe | Actual quantities, units, preparation, yield if stated; keep original wording accessible for comparison | Annals / The Cocktail Register | Creator/owner validates any unclear recipe; image consent separately |
| Prepared drink/food photo | Photograph, optional date/context, suitable caption; strip location data | Corresponding Annals entry | Exact derivative photo and incidental identifiers reviewed before public publication |
| Anonymous quotation | Original **verbatim** wording with limited edits only if authorised | Annals / Quotations of Questionable Wisdom | Explicit review; "anonymous" does not prove quote is non-identifying or consented |
| Monthly meeting or Annual Assembly anecdote | Known time period, supported facts, provenance, approved summary | Annals / Monthly meetings or Annual Assemblies | Approval for naming people, identifying stories and photo context |
| Club artefact or history | Description of genuine object/document/event; distinguish fact and lore | Annals / Miscellany or History | Review for sensitive text, private documents, proprietary material |
| Unknown, suspicious, or unsupported file | Private inventory and clarification request only | **Hold**, no public record | Manual handling or refusal |

### Recipe-specific controls

- Preserve **mL, oz, tsp, g, ratios, batch yield, ingredient concentrations and syrup instructions** exactly when legible. Never silently substitute measurements or storage periods.
- Separate "for one glass" from "syrup batch" and "serves six" only if the source actually supplies those figures. Any serving-scale conversion must be explicitly labelled as an optional calculation and validated.
- A handwritten *1/2 oz* must not become *2 oz* because a model guessed the slash; ask the contributor to confirm the questionable line.
- Never invent a cocktail or attribute a newly generated recipe to a past gathering. Proposed wording must not claim it is a historical club recipe until sourced.
- Dates should be the sender-confirmed Stammtisch month/day; **email received date is not always event date**. Do not presume the last third Friday or default ambiguous dates without noting uncertainty.

### Image-specific controls

- Support common email JPEG/PNG/WebP and verify iPhone HEIC/HEIF and inline-image handling with **real devices** before promising support; add a private converter or useful fallback if necessary. PDFs of recipes may require image interpretation.
- Exclude video and oversized/unknown executable attachments from the initial pilot; send an explicit "unsupported, please resend as..." note without losing the original email.
- Treat faces, reflections, visible screens, licence plates, home interiors, location metadata, image filenames and distinguishable identifying details as review triggers.
- Strip metadata; generate a resized web-friendly derivative with accessible alt text, but do not equate cropping, removing EXIF, or a model saying "no faces" with actual consent.
- **No original/private photo in any public Git branch, PR, issue, Actions artefact or commit history**, even behind an unlinked URL. Public Git history can retain data after deletion.
- A photograph of the recipe card can remain a private evidence source while the rendered recipe is public. Do not automatically publish handwriting containing names or contact details.

## Publication modes and staged authority

### Stage A — closed pilot (recommended immediately following design approval)

- Use **invented/test submissions** and separately consented real examples to check processing.
- Inbox, staged originals, model results and full previews are private.
- Every actual public item requires **one explicit publisher approval** on the final text/image.
- Contributor is asked only for missing recipe details or when their personal/creative work would be newly attributed or posted.
- No automatic public deployment, no production emails to six people, and no expanded push until the pilot is approved.

### Stage B — ordinary production: near-zero work for the six

- Email intake and AI preparation fully automatic; items needing no clarification are grouped into a concise approval email for the nominated publisher.
- An approval can be a simple reply such as **PUBLISH [single-use ID]** to an authenticated system-generated preview. The exact mechanism must be implemented and tested against spoofing, stale versions and accidental approvals before use; **this is a design target, not an existing feature**.
- Reject/hold requires no code edit: "HOLD", "PRIVATE", or a reply with a correction.
- After approved publication, the system verifies the public URL and notifies the original sender. No email is needed on days without submissions or faults.
- **No automatic publication of identifying photos, anonymous-but-identifying quotes, private meeting details or uncertain recipes.**

### Stage C — conditional low-risk autopublish (separate authorisation)

Only after a successful history of pilot examples and explicit club publication rules:
- Consider allowing *text-only, creator-authorised, non-identifying recipe summaries* to autopublish when **all required fields are unambiguous and independently validated**. The creator must have opted in to that class of publication; the system must allow revocation and corrections.
- Continue approval of photographic images, sensitive quotations and named/embarrassing stories unless each affected person has provided specific standing consent for a well-defined use.
- Do not use an AI "confidence score" as sole authorisation. If an item is not precisely in the safe class, it becomes a private preview.
- If exact publisher consent was never received, the system should make the editor aware of pending drafts, **not leak them into a public preview page**.

## Architecture boundaries and execution contract

**Data path (proposed):**

`sender → dedicated Gmail inbox → scheduled private intake → private evidence/staging → AI transcription/classification → deterministic privacy/schema/quality gate → private approval email → approved-only publisher → validated public static data/images → GitHub Pages build → public URL verification → contributor receipt`

**Design constraints:**

1. **Authentication:** allowlist trusted member submission addresses to reduce spam; reject spoofed or unauthenticated submissions where provider signals permit. From-address alone is not proof. Unknown senders are held and cannot trigger publication or expensive AI calls.
2. **Idempotency:** key raw input by immutable Gmail message ID plus attachment/content hashes; key publication by assigned entry ID and approved revision. Retries never create duplicate pages or multiple approval requests.
3. **Fail closed:** a failing provider, model, attachment conversion, privacy check, budget gate, schema test, explicit approval or GitHub deployment **never causes publication**. Keep actionable private failure notes, not raw content in public issues.
4. **Untrusted inputs:** treat email text, recipe card and attachments only as evidence. Ignore embedded instructions to the processor ("ignore previous rules", API URLs, secrets, etc.). No unsandboxed execution of files or remote link fetching based solely on a submission.
5. **Typed public format:** publish JSON/Markdown constrained to known fields, never AI-generated JavaScript or unchecked HTML. Frontend should use safe text rendering/escaping and avoid external tracking from attachments.
6. **Consent record:** record exact approved content version, who approved it and which image/attribution were approved; save these private approvals in the dedicated account, not in a public issue. Multiple identifiable people require separate consent.
7. **Private storage:** limit access to the submission mailbox/Drive; enable account 2FA and recovery. Originals stay private. Propose a retention policy (e.g., temporary derivatives for 90 days; originals according to an owner-approved archival policy), with an option to delete withdrawn submissions and address public-cache limitations.
8. **Secrets and spending:** dedicated restricted GitHub publisher credential and distinct AI API project; no shared LCRS/Comparative or CoL credentials. Keep secrets in protected app configuration, not git or email. Limit per-message attachment size, per-batch runs, requests/day and **estimated spend per month**, with a conservative **application-enforced stop**. API project spending thresholds are **soft alerts, not hard stops**.
9. **Safe deployment:** only after approval generate the sanitised final derivative and commit it to a narrowly scoped Annals branch/PR or controlled validated update. New Annals checks must exercise schema, HTML encoding, media privacy, dates, idempotency, links and mobile display. Never open public PRs with unapproved draft content.
10. **Publication verification:** match the approved entry to the committed content and live public site; handle GitHub Pages delays and retry. A failed publication is not a delivered entry. CoL notifications do **not** notify about Annals submissions.
11. **Observability:** send a short private weekly digest **only if** pending, ambiguous, failed or ageing submissions exist. Raise a private alert if the pipeline itself stops processing or new email is not picked up. Avoid flooding personal inboxes.
12. **Ownership:** maintain the processing code in a dedicated clearly named folder/repository with no actual secrets or raw content; document one restart/re-authorisation procedure and an entirely manual email-and-ChatGPT fallback. Do not depend on an unattended personal PC.

## Public website design

A new `annals.html` can use the existing forest-green/cream/brass design. Make it an easily scannable, archive-first page with:
- At top, a small introduction and **"Contribute to the Annals"** email link after the receiving address is live.
- Chronological entries grouped by year, with optional minimal category chips: *All*, *Cocktails*, *Quotations*, *Monthly Gatherings*, *Assemblies*, *Miscellany*.
- A recurring **Cocktail Register** subsection or category for submitted named drinks; recipes and syrup preparation presented clearly and accessible on phones.
- Image-free text layouts that still look deliberate and elegant. No dependency on a group photo.
- Source/credit choices that reflect the contributor's explicit preference and permit genuinely anonymous public entries.
- A stable URL per entry for sharing within the group and making corrections without duplicating.
- **No** public submissions stored in the browser, no public moderation dashboard, no unapproved draft page, no hidden member directory.

A potential static public data contract, after review:
```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "id": "sample-test-only",
      "type": "cocktail",
      "status": "published",
      "dateLabel": "October 2026",
      "title": "Illustrative test cocktail (not a real club recipe)",
      "summary": "Placeholder content. Not for publication.",
      "attribution": "anonymous",
      "recipe": {
        "ingredients": [],
        "syrupIngredients": [],
        "instructions": []
      },
      "media": []
    }
  ]
}
```
**This is a fixture concept only.** Tests must use clearly invented examples and never publish them as authentic Stammtisch history.

## Cost and maintenance considerations (verify again at setup)

- **Inbound Gmail:** a dedicated free Gmail address is a low-cost starting point, subject to account/Drive storage limits and service policies. A custom domain address may require configured forwarding or paid hosting if the current DNS host does not provide it.
- **Automation:** Google Apps Script supports clock-triggered Gmail processing; quotas and OAuth authorisations apply. This is not free of all maintenance, and scripts can fail or need reauthorisation.
- **AI:** small-scale text/image classification and transcription are usage-billed through the API, separate from a ChatGPT subscription. Start with a low-cost multimodal model for straightforward items; escalate an unclear handwritten recipe to a stronger model **only when economically justified**, and still seek human confirmation. Suggested initial app-enforced allowance: **US$5/month**, adjustable only by the owner after real pilot measurement. This is a **recommendation**, not a purchased subscription or verified forecast.
- **GitHub:** current public GitHub Pages/static site and standard public GitHub-hosted CI are low-cost/free for compute, but API access, artefact storage and other services may have separate limits; avoid adding a new paid CMS.
- **Cloudflare:** inbound custom-domain forwarding can be free if the domain already meets Cloudflare routing prerequisites. Workers/email-routing pricing and DNS rules may change; verify if selected.
- **Manual maintenance:** low after a carefully scoped pilot, **not absolutely zero**. Someone must sometimes verify a recipe, approve a newly identifying photo/story, update credentials, respond to outages, or resolve a disputed fact. The automation should expose these exceptional actions clearly and otherwise stay silent.

External capability references consulted 8 Oct 2026:
- https://developers.google.com/apps-script/guides/triggers/installable
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/gmail/gmail-app
- https://developers.cloudflare.com/email-service/get-started/route-emails/
- https://developers.cloudflare.com/email-service/platform/pricing/
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/pricing
- https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform
- https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Pilot acceptance criteria (must pass before unattended production)

**Submission/experience**
- Each of the six can email a simple **body-only message**, drink photo, legible handwritten recipe and multi-attachment cocktail submission from an actual phone, without installing another app.
- Acknowledgement is received once; email signatures and quoted previous conversations are not accidentally published.
- Mixed-type submissions and unsupported formats receive an informative classification/fallback, never silently dropped.
- The correct original, formatted recipe and source/proposed edits are linked privately for comparison.

**Accuracy and authorship**
- Validate real sample measurements, handwritten fractions, double quantities, syrup preparation, dates, names and "anonymous" attribution. Unclear facts are flagged, not hallucinated.
- Quote text is preserved verbatim absent explicit editing consent. A disguised identifying reference triggers review, not silent automatic publication.
- No AI-created illustrative cocktail is presented as something a member made.

**Privacy and security**
- An unapproved original photo, reply-to address, private address or draft cannot enter a GitHub branch, issue, log, Pages output, cache, or publicly accessible preview.
- Real samples of face/reflection/EXIF/location/QR/contact information are caught by gate and rejected/held until proper consent.
- Unknown/spoofed emails, malformed MIME, malicious file types and instructions embedded in email or attachments cannot publish, spend freely, or read secrets.
- Private approvals bind to the exact final content/hash; old approvals cannot cover edits. A contributor can withhold a photo without losing the recipe.
- A production demonstration includes an approved public entry and a withheld example verified **not** to appear anywhere public.

**Reliability, cost and design**
- No double-publish on message replay, trigger retry, workflow interruption, or a corrected submission.
- Simulate API failure, budget exhaustion, GitHub conflict, delayed Pages build and missing consent; everything holds safely and notifies privately.
- New page renders on iPhone and Android widths, with effective keyboard/screen-reader alternatives for text-first entries.
- No changes to any CoL data, death verification, notification triggers or 2027 January draft safeguards.
- Publish a simple operator runbook: where to see pending work, reply approve/hold, stop intake, rotate secrets and correct/remove a live entry.

## Rollout plan and unresolved administrative inputs

**Phase 0 (this record):** Agree on architecture, privacy/approval policy and initial pilot boundary. No DNS/secret changes.

**Phase 1 — private prototype:** Create a dedicated submission mailbox (owner action), decide forwarding only after verifying existing DNS/MX, create private Drive staging, deploy scheduled intake behind a **disabled public publisher**, connect a narrowly scoped AI API project, and test invented examples. All evidence stays private.

**Phase 2 — real pilot:** Invite one or two members to submit actual drink/recipe/quote examples with specific consent. Collect 10–20 varied cases; review accuracy and public consent handling. Produce an exact private preview; approve a small number of entries, and verify the public page after publication.

**Phase 3 — six-person go-live:** Share one email address and one-sentence instructions; activate low-maintenance private review/reply approval; add the public Annals navigation, contributor invitation and a short runbook; turn on failure-only notifications.

**Phase 4 — limited autopublish, only if explicitly approved:** Consider text-only, non-identifying recipes under explicit standing permission. Keep identifying photos and quotes subject to consent. Review actual exception rate before adopting.

Administrative details not yet available and therefore **not assumed**: owner-approved mailbox address; existing domain mail routing/DNS; six member submission email addresses and preferred credits; real sample recipes; chosen OpenAI API account and billing authorisation; actual contributor/photo consents; whether the owner prefers reply approval or authenticated browser review. No previous ambiguity about Jan 1-to-draft CoL scoring is resolved by this design.

**Recommended next action:** Approve the **dedicated-mailbox + private staging + AI-generated drafts + one-reply approval** pilot as a concept. Only then build the non-publishing intake and prepare for owner account/DNS authorization.
