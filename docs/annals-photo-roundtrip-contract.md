# Annals native cocktail-photo round trip (v1)

This contract describes a bounded message exchange through the existing private Annals intake and signed publisher. It does not itself activate Gmail events or native image processing. The native lane is disabled unless the dedicated `ANNALS_PHOTO_WORKFLOW_ENABLED` property is explicitly `true`; it defaults off and gates both readiness mail and result-to-publisher dispatch. This control does not disable existing photo publication routes. Source tests do not activate the private Apps Script workflow or Gmail event filters.

## One readiness notice

After matching an already published, signed cocktail source to its screened original photo and checking current transformation rights, Annals may send one notice:

- Subject: `[ANNALS PHOTO JOB v1] <32 lowercase hex characters>`
- Exactly one JPEG attachment: the screened source photo.
- UTF-8 body: the exact header line `[ANNALS PHOTO JOB JSON V1]`, followed by LF or CRLF and a Base64URL encoding of the UTF-8 JSON bytes. The worker checks the header text exactly (excluding the CR in a CRLF separator), removes ASCII space, tab, CR and LF from the encoded payload, validates the Base64URL alphabet and padding, then decodes UTF-8 and parses JSON. The decoded object has exactly these fields:
  `schema, jobToken, entryId, sourceSha256, photoIndex, name, description, ingredients, keywords`.
- `schema` is `annals-photo-job-v1`; `jobToken` is a random one-use 128-bit token and must equal the subject suffix. `entryId` and photo index are bound to the current signed Annals entry; `sourceSha256` is the digest of the selected JPEG bytes and must equal that photo's signed `sha256` field. It is not a digest of the whole entry.
- Name, description, ingredients and optional final-line keywords are bounded descriptive cues only. No raw email, contributor contact, private permission record, internal URL or instruction is included.
- The private record binds the source hash and style version, expires after seven days, and is reserved before send. A duplicate intake sees the reservation and cannot send again. A failed or uncertain send remains no-retry; no automatic resend occurs.

## One worker result

The included native image worker replies to the Annals account:

- Subject: `[ANNALS PHOTO RESULT v1] <the same token>`
- Exactly one `image/jpeg` attachment, at most 5 MiB. The receiver independently verifies and sanitizes it, rejects metadata and enforces bounded baseline JPEG dimensions.
- UTF-8 body: one JSON object, at most 2 KiB, with exactly these fields:
  `schema, jobToken, entryId, sourceSha256, status, qa, alt, generatedAt, reviewedAt, generationProvider, generationModel`.
- `schema` is `annals-photo-result-v1`. A `qualified` result has exactly the common fields plus `qa` and `alt`; it requires exactly seven true booleans: `sameGlass`, `sameDrinkAndGarnish`, `photorealisticSubject`, `plausibleStemOrBase`, `sceneAppropriate`, `noArtifactsOrPrivateDetails`, `noVisiblePeopleOrReflections`. Drink renditions remove visible people, body parts and person reflections while preserving the exact drink and glass. The MIME message must include exactly one JPEG for this variant. Any false/missing flag holds the result.
- A `held` result has exactly `schema, jobToken, entryId, sourceSha256, status, reasonCode`, where `reasonCode` is one of `source_unreadable`, `identity_uncertain`, `edit_failed`, `visual_qa_failed`, `attachment_unavailable`, or `provenance_unavailable`. Human presence or uncertain person identity alone is never a reason to hold a member photo. Ordinary group photos remain on the authentic-photo route and are not transformed into cocktail imagery. It has no image attachment, timestamp, `qa`, `alt`, or free-text error. `provenance_unavailable` means generation or visual review may have succeeded, but a trustworthy invocation time was not durably recorded; it does not claim editing or visual review failed. A held result is consumed once and is not retried.
- `alt` is a bounded accessible description (20–240 characters) beginning `AI-stylized`. It must identify a cropped stem/base as an editorial reconstruction when extended. It must not claim reconstructed details were present in the original. The qualified variant also includes ISO timestamps for generation and visual review, `generationProvider: openai-chatgpt`, and `generationModel: undisclosed`; `generatedAt` is captured immediately before invoking the image tool for this exact job and persisted with its existing one-attempt evidence before the call, including uncertain outcomes. The receiver checks that these times follow the job send and do not claim a future review. If the start time was not durably recorded, return the attachment-free `provenance_unavailable` hold instead of estimating it.
- The random token is only a correlation/replay identifier, not a bearer credential or rights grant. A result is read from the Annals mailbox and accepted only when the configured worker address matches the effective Annals account and Gmail metadata for that exact message ID reports the `SENT` system label. `SENT` is owner-mailbox write provenance, not proof of an SMTP round trip; the From header, body, token or subject alone never authenticates a result. The token must match one unexpired, unused private job. Entry ID and source hash must match that job and the currently signed source.

## Typed signed publisher event

A fully qualified private result may be handed to the existing publisher only after a second private source, live-marker, original-photo-permission and transformation-rights check. The existing publisher receives a `repository_dispatch` event with action `annals-editorial-photo-v1` and exactly these client-payload fields:

- `photo`: one complete existing editorial-manifest row, source-bound to the existing signed cocktail photo.
- `blob`: `{ gitSha, size }` for the metadata-free derivative Git blob.
- `issuedAt`: an ISO timestamp, accepted for at most five minutes.
- `signature`: HMAC-SHA256 using the existing separate `ANNALS_PUBLISH_SIGNING_KEY`, over the canonical `{ operation: "editorial-photo-v1", photo, blob, issuedAt }` object.

The publisher accepts this event only when the existing photo-release and blob-transport controls are enabled, the signature and timestamp validate, the source is present in the current signed archive, and the source has no existing editorial row. It fetches the Git blob by its fixed GitHub blob ID, verifies Git SHA, SHA-256, bounded size, metadata-free JPEG format and dimensions, then writes only the derivative asset and matching manifest row. A replay fails because the source already has a row. Archive entries, approvals, recipe, original photo and other entries are unchanged. The renderer emits the authentic original as its initial `<img>` and clickable link. The existing public photo-viewer script verifies the source-bound manifest and probes the derivative before swapping it in; a failed load retains or restores the original. Do not use an unconditional `<picture><source>` override, which prevents reliable fallback. The Pages action and existing private readback still distinguish dispatch acceptance from confirmed live publication.
## Publication boundary

A qualified result is not an approval by itself. Immediately before publication, the existing private Apps Script rechecks current transformation rights, source signature/digest, photo permission, revocation, quarantine/removal and replay state. It sends only an HMAC-signed, source-bound editorial-manifest update through the existing Annals publisher. That event updates the derivative and its manifest row only; it cannot change recipe text, signed approval, original photo or another entry. The existing publisher verifies the signature, source approval, exact blob reference, Git blob SHA, SHA-256, JPEG validity and manifest contract. Any invalid, expired, duplicate, held, uncertain or revoked case stops without public mutation.

The original photo stays reachable as fallback. There is no second intake trigger, publisher, public endpoint, credential or signing key.

## Worker activation boundary

The existing installable five-minute Apps Script trigger executes as its Annals-owned creator. During each run, intake performs a bounded search of recent Annals Sent threads for exact photo-result subjects and passes only those messages to the result verifier. Sent messages never enter member staging. The verifier reads per-message Gmail metadata; it does not rely on thread labels or sender authentication headers.

The manifest uses the existing `mail.google.com/` OAuth grant and enables the Gmail Advanced Service for per-message metadata. No Gmail event filter or account-ambiguous webhook is used. The dedicated `ANNALS_PHOTO_WORKFLOW_ENABLED` property remains off until one fresh private canary verifies the complete AI edit and returned result.