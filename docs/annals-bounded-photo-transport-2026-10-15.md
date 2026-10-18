> **Historical record — not an operating checklist.** Status, proposed work and launch gates below describe their dated checkpoint. Use [current state](current-state.md), [working instructions](../AGENTS.md) and the [production runbook](annals-production-runbook.md) for current decisions and operations. Retain this record for provenance, specifications and recovery; do not repeat completed setup or restore superseded gates.

# Bounded photographic derivatives and transport

Engineering continuation of the [private qualification record](annals-private-qualification-2026-10-15.md).
This replaces the three-image / 32 KiB combined transport design for the separately
gated new route. It does not qualify genuine photographic quality, remediate
signing, arm acceptance, install private source or activate publication.

## Capacity and conversion

The new gallery accepts one to three distinct baseline JPEG derivatives, each
at most **524,288 bytes (512 KiB)**, at most **1600 pixels per edge**, and at least
**800 pixels on the longer edge**. The gallery is at most **1,572,864 bytes
(1.5 MiB)**. These are engineering bounds, not proof that every photo looks good.
No upscaling or original-resolution download is implied. The enlargement viewer
uses this full screened derivative. A separate deterministic thumbnail has a
400-pixel longer edge and a **98,304-byte (96 KiB)** cap, encoded from the screened
public pixels. Responsive markup selects the thumbnail or full derivative; no
extra original or blob upload is needed. Three full/thumbnail pairs total at most
1,867,776 bytes on disk. Thumbnail generation is verified privately before upload
and independently reproduced by the hosted publisher and final verifier.

JPEG originals use the bounded local pure-JavaScript decoder/resizer/encoder
adapter. It applies supported EXIF orientation before stripping metadata and
encodes a fresh derivative. A failed JPEG conversion stays private; it cannot
fall back to a thumbnail that bypasses its orientation checks. Refer to
`PhotoDerivative.js` and its pinned codec provenance for input, memory and
encoding limits. The final shared parser strips all APP0–APP15 and COM segments,
and the hosted publisher requires the already-clean exact bytes.

Each JPEG attachment has a private conversion journal reserved before decoding.
An exact successful derivative can be reused; a failure, timeout or interrupted
reservation cannot be retried on subsequent intake walks. Existing old attempt
records remain intact. The decoder's 256 MiB accounting limit is not a guarantee
of total Apps Script memory use. Up to twelve encode attempts per full derivative
and three for its thumbnail are finite bounds, but genuine runtime qualification
is still required before activation.

PNG/WebP/HEIC/HEIF retain the existing private Drive thumbnail conversion path.
Google's supported [File.getThumbnail](https://developers.google.com/apps-script/reference/drive/file#getThumbnail())
and [thumbnailLink](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
interfaces do not specify a requested output dimension or universal HEIC support.
No undocumented thumbnail URL rewrite is used. A missing, undersized, oversized,
non-baseline or malformed result stays private; safe text can proceed independently.
If genuine HEIC samples cannot meet the minimum resolution and visual-quality
acceptance, HEIC remains an explicit converter qualification gap. Do not claim it
is solved by increasing a byte limit or testing synthetic JPEG structure.

All original attachments, names, EXIF, contacts and consent evidence stay private.
The actual final derivative is the image screened by the existing single reserved
AI attempt. Existing image count, model/output, permanent ten-cent reservation,
provider/application ceilings and processing stops are unchanged.

## Public storage and bounded publication

The [GitHub Git Blob API](https://docs.github.com/en/rest/git/blobs) creates blobs
using the already-authorised repository-specific `Contents:write` token. No new
account, service, action permission, OAuth scope, credential or paid converter is
needed. The hosted reader uses the public fixed-repository endpoint without a token.
This is simpler than chunk dispatches, artifact assembly or a separate asset service.

**A Git blob is public storage immediately, even before a branch references it.**
Only exact approved, screened, consented, metadata-free derivatives can be uploaded.
Uploads are never private staging. Partial uploads and unreferenced blobs may
remain accessible. Withdrawal removes current entry/index/unused asset references;
it cannot erase Git objects, previous commits or external caches. This is the same
public-history limitation requiring informed photographic publication permission.

The private process validates the current source, receipt and exact public approval,
active rights/revocations, security/acceptance gates, expiry, digest, dimensions and
final dispatch size **before** reserving an upload journal. It makes at most three
serial upload requests. Each upload JSON body is at most **699,086 bytes** including
base64; this is a separate bounded Git Blob request, not a larger dispatch envelope.
The final existing dispatch carries only `{sha256, gitSha, size}` references for
the signed gallery. Its **60,000-byte ceiling is unchanged**. No original source ID,
private URL, filename or consent record enters a public payload.

The operation journal is written before the first request. It records completed
uploads privately and permanently blocks another invocation. A rejected, malformed,
partial or unknown response stops the operation without retries or dispatch.
Revocation and gate/expiry closure between uploads stop the remaining writes.
There is no automatic resume even when all uploads completed but dispatch did not.
Recovery requires existing private reconciliation and an explicit engineering
decision; never clear a marker or replay an uncertain action.

The hosted publisher validates the exact signed approval and release gates before
fetching. It rejects duplicate/retired publication and invalid corrections before
fetching. References cannot select a repository, URL or path. Reads reject redirects,
errors, missing bytes and overflows while streaming under the declared size. The
publisher verifies SHA-256, Git blob SHA-1, actual byte count, dimensions and absence
of metadata. All assets must validate before the file-writing stage. A failed job
does not commit partial public archive changes. No fetch retry is built in.

## Gates, corrections and final reconciliation

`ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED` is a new **default-off** private property and
GitHub repository variable. It is additional to the existing photo gates, not an
alternative to signing remediation or exact-source acceptance. Leave it and every
new publication gate off/unset in this release. After separate signing remediation,
a supervised genuine acceptance may use this flag with the existing exact-source,
short-expiry private/hosted acceptance lane while broad publication stays off.
The flag must be installed/configured on both sides before that controlled trial.
Private code cannot attest the actual state of hosted variables; verify them
independently before arming to avoid publicly stored orphan derivatives.

Existing text/caption/date corrections preserve the same gallery, submission time,
exact signature requirements and visible correction note. Replacement/addition of
gallery assets remains held for separate source/rights qualification. A correction
has its own one-shot upload journal and signed dispatch. Withdrawal retains retired
entry IDs and removes unused current assets/index shards; no image upload is needed.

Caption and alternative-text edits pin ordered digests and dimensions rather than
requiring descriptive text to remain identical. The private desk exposes those
fields. Rights are rechecked for each selected screened image; a depiction-only
revocation holds people, while independently eligible objects/scenery retain their
own permissions. The transport stop is rechecked after the final upload and just
before dispatch. A correction requires its own exact raw/hosted archive, approval,
HTML, full images, thumbnails and index proof, even if it precedes initial live
reconciliation. The old entry ID or original live marker is insufficient. The
original final email is attempted at most once; corrections do not repeat it.

The owner-only private runtime fixture (`annalsQualifyPhotoCodec`, or the
editor-only `annalsQualifyPhotoCodecInEditor_`) reserves one diagnostic record,
then converts three fictional 12-megapixel geometry images in memory. It stores
only timing/dimensions and never calls AI, uploads images, sends mail, reads signing
values/markers or changes gates. An interrupted reservation is not retried. Passing
this fixture establishes only that workload in the actual V8 runtime; it cannot
establish genuine photographic quality, phone decoding or worst-case performance.

The gallery signing mode is now consistently `standing-consent-photos-v2` through
decision, receipt, dispatch and pending/live recognition. This fixes the previous
v1/v2 comparison that would reject a gallery after signing. Private success
reconciliation now checks all exact hosted full/thumbnail pairs plus the target's
canonical index shard before marking a gallery live: at most six image reads, the
index manifest and one 24-record shard. It shares the index row/order implementation with
the hosted writer. Missing/stale/changed assets or index keep the item pending.

## Acceptance still required

Offline tests cover the exact byte capacity, reference envelope, security/gate
refusals, metadata/digest mismatch, truncation/overflow, one-shot partial/unknown
uploads, revocations, corrections, retired IDs and exact hosted asset/index checks.
Structural oversized fixtures are explicitly not decoder or visual-quality proof.
Synthetic codec tests are not genuine phone-quality or Apps Script performance proof.

Use fresh genuinely authenticated, permitted samples only after the separate signing
work: an ordinary phone JPEG, a genuine HEIC/HEIF portrait, multiple distinct images
and an inline image. Privately compare original and final derivative for correct
orientation, detail, readability, skin/colour, absence of metadata and unwanted
identifying information. Record actual dimensions/bytes, decoder success, exact
hosted bytes, canonical index references, upload and dispatch journals, and live
reconciliation. Check physical phone enlargement and keyboard/assistive behaviour.
Exercise only genuinely intended corrections/withdrawal; use fictional private
fixtures for missing mutation cases. Confirm Apps Script runtime/memory is adequate.
Disarm the exact acceptance lane after the outcome. No genuine sample or production
request was supplied or processed by this engineering work.

Rollback leaves/disarms the new transport and photo gates, preserves all one-shot
journals and public-history evidence, and uses the documented source/deployment
rollback. Never restore exposed keys, reset attempts or turn an unknown upload
into permission to retry. The legacy inline route retains its original 32 KiB
combined bound and is not reclassified as generally adequate photographic quality.
