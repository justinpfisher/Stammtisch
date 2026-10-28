# Annals native cocktail-photo round trip (v1)

This contract describes a bounded message exchange through the existing private Annals intake and signed publisher. It does not itself activate Gmail events or native image processing. The native lane is disabled unless the dedicated `ANNALS_PHOTO_WORKFLOW_ENABLED` property is explicitly `true`; it defaults off and gates both readiness mail and result-to-publisher dispatch. This control does not disable existing photo publication routes. Source tests do not activate the private Apps Script workflow or Gmail event filters.

## One readiness notice

After matching an already published, signed cocktail source to its screened original photo and checking current transformation rights, Annals may send one notice:

- Subject: `[ANNALS PHOTO JOB v1] <32 lowercase hex characters>`
- Exactly one JPEG attachment: the screened source photo.
- UTF-8 body: one JSON object with exactly these fields:
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
- `schema` is `annals-photo-result-v1`. A `qualified` result has exactly the common fields plus `qa` and `alt`; it requires exactly six true booleans: `sameGlass`, `sameDrinkAndGarnish`, `photorealisticSubject`, `plausibleStemOrBase`, `sceneAppropriate`, `noArtifactsOrPrivateDetails`. The MIME message must include exactly one JPEG for this variant. Any false/missing flag holds the result.
- A `held` result has exactly `schema, jobToken, entryId, sourceSha256, status, reasonCode`, where `reasonCode` is one of `source_unreadable`, `identity_uncertain`, `edit_failed`, `visual_qa_failed`, or `attachment_unavailable`. It has no image attachment, provenance, `qa`, `alt`, or free-text error. This variant reports failure without implying an image or successful checks exists.
- `alt` is a bounded accessible description (20–240 characters) beginning `AI-stylized`. It must identify a cropped stem/base as an editorial reconstruction when extended. It must not claim reconstructed details were present in the original. The qualified variant also includes ISO timestamps for generation and visual review, `generationProvider: openai-chatgpt`, and `generationModel: undisclosed`; the receiver checks that these times follow the job send and do not claim a future review.
- The random token is only a correlation/replay identifier, not a bearer credential or rights grant. Sender authentication is verified from the received message's authentication evidence and exact qualified address; a From header, body, token or subject alone never authenticates a result. The token must match one unexpired, unused private job. Entry ID and source hash must match that job and the currently signed source.

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

## Parent-owned Gmail event filters

Only after a bounded private qualification event proves the actual authenticated sender and routing:

1. Worker mailbox: exact Annals sender **and** subject prefix `[ANNALS PHOTO JOB v1]`.
2. Annals mailbox: exact worker sender **and** subject prefix `[ANNALS PHOTO RESULT v1]`.

Use a case-insensitive anchored exact-address sender pattern only after verifying the actual address; do not guess or broaden the filter. The event is a wake-up only: retrieve the message and attachment, then perform all server-side validation above. No filter or automation is active by virtue of this contract or source tests.
