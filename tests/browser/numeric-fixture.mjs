/* Synthetic browser-only RSA signature interoperability fixture.
 * No private Club evidence, provider keys, network requests or live release. */
import {generateKeyPairSync,sign} from 'node:crypto';
import {sha256,attestationBytes,NUMERIC_DOMAIN} from '../../col-numeric-adapter.mjs';

export function numericReaderFixture(){
  const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
  const createdAt='2026-10-23T12:00:00.000Z',now=Date.parse('2026-10-23T12:10:00.000Z');
  const members=['fish','marc','matt','ken','jamie','jerome'].map(id=>({id,picks:[],score:0}));
  const baseline={year:2026,members},clubState={schemaVersion:1};
  const siteResults={year:2026,asOf:createdAt,members};
  const keyring={schemaVersion:1,keys:[{id:'fictional-browser-rsa',purpose:'numeric-release',
    algorithm:'RSA-SHA256',publicKey:keys.publicKey.export({type:'spki',format:'pem'})}],
    currentReleaseDigest:null,previousReleaseDigest:null};
  const payload={schemaVersion:1,kind:'col-numeric-release-payload-v1',
    implementationCommit:'b'.repeat(40),behaviorDigest:'f'.repeat(64),
    viewerSourceDigest:'a'.repeat(64),viewerRunId:'123456',
    viewerQualificationDigest:'c'.repeat(64),viewerObservedAt:createdAt,
    activationAt:'2026-10-23T11:00:00.000Z',observedAt:createdAt,createdAt,
    baselineDigest:sha256(baseline),correctionsDigest:sha256(clubState),
    siteResults,siteResultsDigest:sha256(siteResults),
    consumedPeople:[],actionReplayKeys:[],actionDigest:sha256([]),
    sourceRowDigests:[],calculated:[],previousReleaseDigest:null,
    keyringDigest:sha256({schemaVersion:1,keys:keyring.keys})};
  const release={schemaVersion:1,kind:'col-numeric-site-release-v1',
    keyId:'fictional-browser-rsa',payload,
    signature:sign('RSA-SHA256',attestationBytes(NUMERIC_DOMAIN,payload),keys.privateKey).toString('base64')};
  keyring.currentReleaseDigest=sha256(release);
  const tampered={...release,signature:Buffer.alloc(256).toString('base64')};
  return {release,keyring,baseline,clubState,now,tampered,
    tamperedKeyring:{...keyring,currentReleaseDigest:sha256(tampered)}};
}
