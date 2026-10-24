/* Protected prospective CoL publication: no private key, raw Sheet cell,
 * member message, credential, notification sender, or private source access.
 * Only GitHub's main-branch hosted job may provide independent Viewer evidence.
 * Importing this module has no network, Git, or publication side effects. */
import {createPublicKey} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildNumericPayload,sha256,verifyNumericRelease} from '../col-numeric-adapter.mjs';
import {verifyNumericSiteRelease} from '../col-numeric-reader.mjs';
import {prospectiveBehaviorDigest} from './annals/RulesRelease.mjs';

const REPO='justinpfisher/Stammtisch';
const TRUST='data/col-numeric-trust.json';
const CURRENT='data/col-numeric-release.json';
const ARCHIVE='data/col-numeric-releases/';
const purposes=['authenticated-member-action','independent-death-verifier',
  'numeric-activation-boundary','viewer-source-row-observer','numeric-release'];
const allowedKeys=['schemaVersion','kind','release','activationWitness','events','actionEnvelopes'];
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const safeJson=v=>JSON.stringify(v,null,2)+'\n';

/* Repository-dispatch payloads are bounded (~65 KB), but the signed complete
 * six-member snapshot is already larger. Private Apps Script should gzip the
 * compact JSON bundle and base64-encode it with Utilities.gzip/newBlob and
 * Utilities.base64Encode. The compression envelope grants no authority. */
export function numericDispatchBundle(input) {
  assert(exact(input,['schemaVersion','kind','encoding','payload'])&&
    input.schemaVersion===1&&input.kind==='col-numeric-gzip-dispatch-v1'&&
    input.encoding==='gzip+base64'&&typeof input.payload==='string'&&
    input.payload.length>0&&input.payload.length<=60000&&
    /^[A-Za-z0-9+/]+={0,2}$/.test(input.payload),
    'Bounded compressed numeric dispatch required');
  const compressed=Buffer.from(input.payload,'base64');
  assert(compressed.length<=45000,'Compressed numeric dispatch exceeds GitHub limit');
  let expanded;
  try{expanded=gunzipSync(compressed,{maxOutputLength:512*1024});}
  catch{throw Error('Invalid or oversized numeric dispatch compression');}
  const raw=expanded.toString('utf8');
  assert(Buffer.byteLength(raw,'utf8')===expanded.length,'Invalid UTF-8 numeric dispatch');
  try{return JSON.parse(raw);}catch{throw Error('Invalid numeric dispatch JSON');}
}

export function verifyNumericTrust(keyring) {
  assert(keyring?.schemaVersion===1&&Array.isArray(keyring.keys)&&
    keyring.keys.length>=5&&keyring.keys.length<=15,'Five qualified numeric trust purposes required');
  const identities=new Set(),ids=new Set(),found=new Set();
  for(const k of keyring.keys) {
    assert(k&&exact(k,['id','purpose','algorithm','publicKey'])&&
      typeof k.id==='string'&&/^[a-z0-9-]{8,80}$/.test(k.id)&&!k.id.startsWith('test-')&&
      purposes.includes(k.purpose)&&['Ed25519','RSA-SHA256'].includes(k.algorithm)&&
      typeof k.publicKey==='string'&&!ids.has(k.id),'Invalid or duplicate numeric trust anchor');
    const material=createPublicKey(k.publicKey);
    assert(k.algorithm==='Ed25519'?material.asymmetricKeyType==='ed25519':
      material.asymmetricKeyType==='rsa'&&material.asymmetricKeyDetails?.modulusLength>=2048,
      'Insufficient numerical signing key strength');
    const identity=material.export({type:'spki',format:'der'}).toString('base64');
    assert(!identities.has(identity),'Signing purpose reuses a trust key');
    ids.add(k.id);identities.add(identity);found.add(k.purpose);
  }
  assert(purposes.every(p=>found.has(p)),'A numeric trust purpose is missing');
  assert(keyring.currentReleaseDigest===null||hex(keyring.currentReleaseDigest),
    'Invalid current numeric release pointer');
  assert(keyring.previousReleaseDigest===undefined||keyring.previousReleaseDigest===null||
    hex(keyring.previousReleaseDigest),'Invalid previous numeric release pointer');
  return true;
}

/* The Viewer file and run metadata MUST be obtained by the runner itself via
 * authenticated GitHub Actions artifact download and run readback, never by
 * trusting a submitted JSON field or a digest-shaped payload. */
export function verifyNumericViewerRun(run,qualification,{implementationCommit}={}) {
  assert(run&&qualification&&String(run.id)===qualification.workflowRunId&&
    run.status==='completed'&&run.conclusion==='success'&&
    run.head_sha===implementationCommit&&run.repository?.full_name===REPO&&
    typeof run.path==='string'&&
    run.path.endsWith('/.github/workflows/col-source-observe.yml@refs/heads/main')&&
    ['push','workflow_dispatch'].includes(run.event),
    'Independent exact-commit Viewer workflow identity unverified');
  assert(qualification.implementationCommit===implementationCommit&&
    qualification.sourceObservation?.workflowRunId===qualification.workflowRunId&&
    qualification.sourceObservation?.implementationCommit===implementationCommit,
    'Downloaded Viewer artifact is not from its claimed exact implementation');
  return true;
}

export function verifyIndependentSource(observation,qualification,{commit,publisherRunId,now=new Date()}={}) {
  assert(observation?.kind==='col-source-readonly-observation-v1'&&
    observation.scope==='spreadsheets.readonly'&&
    observation.implementationCommit===commit&&observation.workflowRunId===String(publisherRunId)&&
    observation.sourceDigest===qualification?.sourceObservation?.sourceDigest&&
    hex(observation.sourceDigest)&&stamp(observation.observedAt)&&
    Date.parse(observation.observedAt)<=now.getTime()+60000&&
    now.getTime()-Date.parse(observation.observedAt)<=10*60*1000,
    'Final independent Viewer source changed or is stale');
  return true;
}

/* One self-contained public-safe signed request: private production has already
 * authenticated people and death proof; the publisher independently verifies
 * their separately signed claims and reconstructs every derived release byte. */
export async function prepareNumericPublication({
  bundle,qualification,viewerRun,sourceObservation,baseline,clubState,
  keyring,previousRelease=null,checkoutCommit,publisherRunId,now=new Date(),
  behaviorDigest=null
}={}) {
  assert(bundle&&exact(bundle,allowedKeys)&&bundle.schemaVersion===1&&
    bundle.kind==='col-numeric-publication-request-v1'&&
    Array.isArray(bundle.events)&&Array.isArray(bundle.actionEnvelopes)&&
    bundle.events.length<=50&&bundle.actionEnvelopes.length<=50,
    'Bounded signed numerical publication request required');
  assert(/^[a-f0-9]{40}$/.test(checkoutCommit||'')&&
    /^[0-9]{1,24}$/.test(String(publisherRunId||''))&&now instanceof Date&&
    Number.isFinite(now.getTime()),'Trusted hosted publication identity required');
  verifyNumericTrust(keyring);
  const release=bundle.release,p=release?.payload;
  assert(p&&p.kind==='col-numeric-release-payload-v1'&&
    /^[a-f0-9]{40}$/.test(p.implementationCommit||'')&&
    hex(p.behaviorDigest)&&stamp(p.createdAt)&&
    Date.parse(p.createdAt)<=now.getTime()+60000&&
    now.getTime()-Date.parse(p.createdAt)<=15*60*1000,
    'Fresh signed complete numeric release required');
  verifyNumericViewerRun(viewerRun,qualification,{implementationCommit:p.implementationCommit});
  verifyIndependentSource(sourceObservation,qualification,{commit:checkoutCommit,publisherRunId,now});
  assert(sourceObservation.sourceDigest===p.sourceDigest&&
    now.getTime()-Date.parse(qualification.sourceObservation.observedAt)<=30*60*1000,
    'Independent source qualification changed or expired');
  const digest=behaviorDigest??await prospectiveBehaviorDigest();
  assert(digest===p.behaviorDigest,'Reviewed numerical implementation has changed');
  const oldDigest=keyring.currentReleaseDigest??null;
  assert(oldDigest===null?previousRelease===null:
    previousRelease!==null&&sha256(previousRelease)===oldDigest,
    'Existing signed numerical release pointer or history mismatch');
  assert(oldDigest===null?bundle.activationWitness!==null:
    bundle.activationWitness===null,
    'Initial activation witness must be present only at first release');
  const reconstructed=buildNumericPayload({
    baseline,clubState,websiteResults:p.siteResults,events:bundle.events,
    actionEnvelopes:bundle.actionEnvelopes,draft:null,viewerQualification:qualification,
    sourceDigest:p.sourceDigest,implementationCommit:p.implementationCommit,
    behaviorDigest:digest,keyring,activationWitness:bundle.activationWitness,
    previousRelease,expectedPreviousDigest:oldDigest,now:new Date(p.createdAt)
  });
  assert(sha256(reconstructed)===sha256(p),
    'Signed numerical output cannot be independently reconstructed');
  verifyNumericRelease(release,{keyring,expectedPreviousDigest:oldDigest,
    now,commit:p.implementationCommit,behaviorDigest:digest});
  const releaseDigest=sha256(release);
  const nextTrust={...keyring,previousReleaseDigest:oldDigest,currentReleaseDigest:releaseDigest};
  assert(await verifyNumericSiteRelease({release,keyring:nextTrust,baseline,clubState,now:now.getTime()}),
    'The browser cannot admit the full signed numerical snapshot');
  const witness={schemaVersion:1,kind:'col-numeric-hosted-source-witness-v1',
    releaseDigest,previousReleaseDigest:oldDigest,implementationCommit:p.implementationCommit,
    publisherCommit:checkoutCommit,publisherRunId:String(publisherRunId),
    viewerRunId:qualification.workflowRunId,sourceDigest:p.sourceDigest,
    sourceObservedAt:sourceObservation.observedAt,preparedAt:now.toISOString()};
  const files={
    [CURRENT]:safeJson(release),
    [TRUST]:safeJson(nextTrust),
    [ARCHIVE+releaseDigest+'.json']:safeJson(release),
    [ARCHIVE+releaseDigest+'-witness.json']:safeJson(witness)
  };
  assert(Object.values(files).every(body=>Buffer.byteLength(body,'utf8')<=512*1024),
    'Numeric publication exceeds bounded public asset size');
  return {releaseDigest,files,witness};
}

export async function writeNumericPublication(result,{cwd=process.cwd()}={}) {
  assert(result&&exact(result,['releaseDigest','files','witness'])&&
    hex(result.releaseDigest),'Qualified publication required');
  const names=Object.keys(result.files);
  assert(names.length===4&&names.includes(TRUST)&&names.includes(CURRENT)&&
    names.includes(ARCHIVE+result.releaseDigest+'.json')&&
    names.includes(ARCHIVE+result.releaseDigest+'-witness.json'),
    'Unexpected numerical publication paths');
  await mkdir(path.join(cwd,ARCHIVE),{recursive:true});
  for(const name of names) {
    const existing=await readFile(path.join(cwd,name),'utf8').catch(e=>{
      if(e.code==='ENOENT')return null;throw e;
    });
    if(name.startsWith(ARCHIVE)&&existing!==null)
      throw Error('Immutable numerical release identity already consumed');
    if(name===CURRENT&&result.witness.previousReleaseDigest===null&&existing!==null)
      throw Error('An unrecognised existing release file requires private reconciliation');
    if(name===CURRENT&&result.witness.previousReleaseDigest!==null&&existing===null)
      throw Error('Existing release file missing from signed publication chain');
  }
  for(const name of names)await writeFile(path.join(cwd,name),result.files[name],{
    flag:name.startsWith(ARCHIVE)?'wx':'w'
  });
}

async function main() {
  const repoRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
  const git=(...args)=>execFileSync('git',args,{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  assert(process.env.GITHUB_EVENT_NAME==='repository_dispatch'&&
    process.env.GITHUB_EVENT_ACTION==='annals-col-numeric-release-v1'&&
    process.env.GITHUB_REF==='refs/heads/main'&&
    process.env.COL_NUMERIC_RELEASE_ENABLED==='true',
    'Hosted numerical activation is not enabled');
  assert(!git('status','--porcelain')&&git('branch','--show-current')==='main',
    'Clean protected main checkout required');
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const bundle=numericDispatchBundle(event.client_payload);
  const qualification=JSON.parse(await readFile(process.env.COL_NUMERIC_VIEWER_PATH,'utf8'));
  const viewerRun=JSON.parse(await readFile(process.env.COL_NUMERIC_VIEWER_RUN_PATH,'utf8'));
  const sourceObservation=JSON.parse(await readFile(process.env.COL_NUMERIC_SOURCE_PATH,'utf8'));
  const baseline=JSON.parse(await readFile(path.join(repoRoot,'data/celebration.json'),'utf8'));
  const clubState=JSON.parse(await readFile(path.join(repoRoot,'data/col-club-state.json'),'utf8'));
  const keyring=JSON.parse(await readFile(path.join(repoRoot,TRUST),'utf8'));
  const previousRelease=keyring.currentReleaseDigest===null?null:
    JSON.parse(await readFile(path.join(repoRoot,CURRENT),'utf8'));
  const checkoutCommit=git('rev-parse','HEAD');
  git('merge-base','--is-ancestor',bundle.release.payload.implementationCommit,checkoutCommit);
  const result=await prepareNumericPublication({bundle,qualification,viewerRun,
    sourceObservation,baseline,clubState,keyring,previousRelease,checkoutCommit,
    publisherRunId:process.env.GITHUB_RUN_ID});
  await writeNumericPublication(result,{cwd:repoRoot});
  // Only SHA and count are printed; never serialize provider or member proofs.
  process.stdout.write('Qualified complete numeric publication prepared; immutable assets: 2.\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(()=>{console.error('Protected numeric publication held; no source or signer material logged.');process.exitCode=1;});
}
