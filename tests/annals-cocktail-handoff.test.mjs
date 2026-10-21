/* Entirely offline, fictional private handoff acceptance.
 * Copies only public source code and the already-screened public Kingston JPEG
 * to a temporary test repository. No real private key, source or owner Drive.
 * Tests the actual CLI path with paid activation explicitly disabled.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {cp,copyFile,mkdir,mkdtemp,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {torontoPeriod} from '../scripts/annals/CocktailEditorialBudget.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const entryId='annal-96b5ae266a36793c6a203033';
const publisherKey='fictional-publisher-for-offline-handoff-'+('p'.repeat(48));
const permitKey='fictional-independent-editorial-permit-'+('s'.repeat(48));
const canonical=v=>Array.isArray(v)?v.map(canonical):
  v&&typeof v==='object'?Object.fromEntries(
    Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hmac=(key,v)=>createHmac('sha256',key)
  .update(JSON.stringify(canonical(v))).digest('hex');
const digest=b=>createHash('sha256').update(b).digest('hex');

async function fixture(){
  const temp=await mkdtemp(path.join(tmpdir(),'stammtisch-private-handoff-fictional-'));
  const mock=path.join(temp,'mock-repo'),priv=path.join(temp,'private'),
    output=path.join(priv,'output');
  await mkdir(path.join(mock,'data'),{recursive:true});
  await mkdir(path.join(mock,'docs'),{recursive:true});
  await mkdir(path.join(mock,'assets','annals'),{recursive:true});
  await mkdir(output,{recursive:true});
  await cp(path.join(root,'scripts','annals'),path.join(mock,'scripts','annals'),{recursive:true});
  await copyFile(path.join(root,'docs','brand-editorial-style-guide.md'),
    path.join(mock,'docs','brand-editorial-style-guide.md'));
  const photo=path.join('assets','annals',entryId+'.jpg');
  await copyFile(path.join(root,photo),path.join(mock,photo));
  const archive=JSON.parse(await readFile(path.join(root,'data','annals-approved.json'),'utf8'));
  const entry=archive.entries.find(x=>x.id===entryId);
  const approval={...archive.approvals.find(x=>x.entryId===entryId)};
  const unsignedApproval={entryId:approval.entryId,
    approvedAt:approval.approvedAt,consents:approval.consents,
    contentSha256:approval.contentSha256};
  approval.signature=hmac(publisherKey,{entry,approval:unsignedApproval});
  await writeFile(path.join(mock,'data','annals-approved.json'),
    JSON.stringify({schemaVersion:1,entries:[entry],approvals:[approval]}));
  const reference=path.join(priv,'reference.jpg');
  await copyFile(path.join(mock,photo),reference);
  const sourceSha=digest(await readFile(reference));
  assert.equal(sourceSha,entry.photo.sha256);
  const now=Date.now(),issuedAt=new Date(now-30000).toISOString(),period=torontoPeriod(new Date(now));
  const unsignedPermit={
    scope:'cocktail-editorial-transform-v1',entryId,
    sourceSha256:sourceSha,referenceSha256:sourceSha,
    rightsActive:true,screened:true,budgetReserved:true,
    budgetPeriod:period,monthlyCeilingCents:500,perPhotoCeilingCents:200,
    reservedCents:200,nonce:'b'.repeat(32),issuedAt,
    expiresAt:new Date(now+3600000).toISOString()
  };
  const permit={...unsignedPermit,signature:hmac(permitKey,unsignedPermit)};
  const issuedRecord={permit,state:'reserved_unspent',at:new Date(now).toISOString(),
    providerCalled:false,generatedImageQualified:false,publicRelease:false};
  const receipt=path.join(priv,'issuer-receipt.json');
  await writeFile(receipt,JSON.stringify(issuedRecord));
  const ledger=path.join(priv,'owner-budget-snapshot.json');
  await writeFile(ledger,JSON.stringify({
    schemaVersion:1,monthlyCeilingCents:500,perPhotoCeilingCents:200,
    reservations:[{entryId,sourceSha256:sourceSha,period,reservationCents:200,reservedAt:issuedAt}]
  }));
  const invoke=()=>spawnSync(process.execPath,[
    path.join(mock,'scripts','annals','prepare-cocktail-editorial.mjs'),
    '--entry',entryId,'--check-handoff',
    '--reference',reference,'--permit',receipt,
    '--budget-ledger',ledger,'--private-output',output
  ],{
    cwd:mock,encoding:'utf8',timeout:15000,
    env:{...process.env,
      ANNALS_PUBLISH_SIGNING_KEY:publisherKey,
      ANNALS_EDITORIAL_PERMIT_SIGNING_KEY:permitKey,
      ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED:'true',
      ANNALS_EDITORIAL_BUDGET_DIR:output,
      ANNALS_EDITORIAL_IMAGE_ENABLED:'false',
      ANNALS_EDITORIAL_IMAGE_API_KEY:'',
      ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED:'false'
    }
  });
  return {temp,output,receipt,ledger,sourceSha,invoke};
}

test('signed owner-issued journal and ledger pass entire offline CLI without an API key, marker, reservation or publication',async()=>{
 const f=await fixture();
 try{
   const before=await readdir(f.output);
   assert.deepEqual(before,[]);
   const result=f.invoke();
   assert.equal(result.status,0,result.stderr);
   const state=JSON.parse(result.stdout);
   assert.deepEqual(state,{
     state:'private-handoff-verified-offline',publisherVerified:true,
     issuerPermitVerified:true,sourceReferenceBound:true,
     ownerLedgerReservationMatched:true,priorSourceAttemptAbsent:true,
     providerCalled:false,paidRequestMade:false,markerCreated:false,
     budgetReservationMade:false,published:false
   });
   assert.deepEqual(await readdir(f.output),[]);
   assert.doesNotMatch(result.stdout+result.stderr,/Bearer |fictional-publisher|fictional-independent|reference\.jpg|issuer-receipt/i);
 }finally{await rm(f.temp,{recursive:true,force:true})}
});

test('modified issuer state, counterfeit ledger or consumed source marker fail before provider access and preserve evidence',async()=>{
 const f=await fixture();
 try{
   let record=JSON.parse(await readFile(f.receipt,'utf8'));
   await writeFile(f.receipt,JSON.stringify({...record,providerCalled:true}));
   let result=f.invoke();
   assert.notEqual(result.status,0);
   assert.deepEqual(await readdir(f.output),[]);
   await writeFile(f.receipt,JSON.stringify(record));
   const originalLedger=await readFile(f.ledger,'utf8');
   const changed=JSON.parse(originalLedger);changed.reservations=[];
   await writeFile(f.ledger,JSON.stringify(changed));
   result=f.invoke();assert.notEqual(result.status,0);
   assert.deepEqual(await readdir(f.output),[]);
   await writeFile(f.ledger,originalLedger);
   const marker='cocktail-'+f.sourceSha+'-attempt-private.json';
   await writeFile(path.join(f.output,marker),JSON.stringify({sourceSha256:f.sourceSha}));
   result=f.invoke();assert.notEqual(result.status,0);
   assert.deepEqual(await readdir(f.output),[marker]);
   assert.doesNotMatch(result.stdout+result.stderr,/Bearer |fictional-publisher|fictional-independent/i);
 }finally{await rm(f.temp,{recursive:true,force:true})}
});
