/* Local fictional fixtures. No credential, source or network access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../scripts/annals/HistoryProduction.gs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
const sentinel='PRIVATE-CONTENT-MUST-NOT-RETURN';
const gates=['ANNALS_AUTO_PUBLICATION_ENABLED','ANNALS_AUTO_MEDIA_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED','ANNALS_RULES_V2_ENABLED','ANNALS_RULES_V3_ENABLED'];
function fixture(change=()=>{}){
  const s={properties:{},pending:{},cross:true,rotation:true,mutations:0,fetches:[],propertyReads:[],existing:false,
    archive:JSON.stringify({schemaVersion:1,entries:[],approvals:[]}),page:'<html>The Annals of Stammtisch</html>',responses:{}};change(s);
  const mutate=()=>{s.mutations++;throw Error(sentinel);};
  const c={Date,Number,AnnalsProduction:{serial:JSON.stringify},annalsHash_:()=> 'fictional-digest',
    annalsUiCall_:(nonce,fn)=>{if(nonce!=='owner-session')throw Error('Owner session required');return fn();},
    annalsLocked_:fn=>{if(s.lockError)throw Error(sentinel);return fn();},
    annalsProps_:()=>({getProperty:k=>{s.propertyReads.push(k);assert.ok([...gates,'ANNALS_SIGNING_REMEDIATED_AT','ANNALS_SIGNING_QUALIFICATION_RECORD'].includes(k));return s.properties[k]||null;},setProperty:mutate}),
    annalsRoot_:()=>{if(s.rootError)throw Error(sentinel);return 'root';},annalsFolder_:()=> 'historical',
    annalsRead_:(folder,name)=>{if(s.readError)throw Error(sentinel);return folder==='historical'?(s.missingHistorical?null:{entry:{secret:sentinel},receipt:{signature:sentinel},publication:{signature:sentinel}}):s.pending[name]||null;},
    annalsFile_:()=>s.existing,annalsWriteOnce_:mutate,annalsSavePrivate_:mutate,annalsDispatchEvent_:mutate,
    UrlFetchApp:{fetch:(url,options)=>{
      s.fetches.push(url);assert.equal(options.followRedirects,false);assert.equal(options.muteHttpExceptions,true);assert.equal(options.validateHttpsCertificates,true);
      assert.equal(options.headers['Cache-Control'],'no-cache');assert.match(url,/^https:\/\/(raw\.githubusercontent\.com\/justinpfisher\/Stammtisch\/main\/data\/annals-approved\.json|stammtischbrewery\.com\/(data\/annals-approved\.json|annals\.html))\?signing-observation=\d+$/);
      const label=url.includes('raw.githubusercontent')?'committedArchive':url.includes('annals-approved')?'liveArchive':'livePage',r=s.responses[label]||{};
      if(r.error)throw Error(sentinel);return {getResponseCode:()=>r.code??200,getContentText:()=>r.body??(label==='livePage'?s.page:s.archive)};
    }}
  };
  vm.createContext(c);vm.runInContext(code,c);
  c.annalsCheckGithubSigningConsistency=()=>{if(s.crossError)throw Error(sentinel);return {githubSecretConsistencyVerified:s.cross,workflowRunId:'123',workflowRunAttempt:'1',privateValue:sentinel};};
  c.annalsCheckSigningRotation=()=>{if(s.rotationError)throw Error(sentinel);return {separateKeys:true,oldPrivateSignatureRejected:s.rotation,oldPublicSignatureRejected:true,newPrivateSignatureValid:true,privateValue:sentinel};};
  return {s,run:(nonce='owner-session')=>{const r=c.annalsDiagnoseSigningQualification(nonce,sentinel,sentinel,sentinel,sentinel);assert.equal(s.mutations,0);assert.ok(!JSON.stringify(r).includes(sentinel));return r;}};
}
test('complete observation returns booleans/enums only and never claims write permission or publication',()=>{
  const f=fixture(),r=f.run();assert.equal(r.readOnly,true);assert.equal(r.publicationActivated,false);assert.equal(r.writePermissionTested,false);
  assert.equal(r.crossCheck,'verified');assert.equal(r.rotationCheck,'verified');assert.equal(r.lock,'acquired');assert.equal(r.privateRoot,'verified_owner_only');
  assert.ok(gates.every(k=>r.gates[k]===true));assert.equal(r.priorMarkerPresent,false);assert.equal(r.priorPointerPresent,false);assert.equal(r.priorRecordPresent,false);
  for(const k of ['archiveBytesEqual','archiveShapeValid','archiveEmpty','pageRecognized','pageEmpty','historicalEvidencePresent','historicalEvidenceDigestComputable'])assert.equal(r[k],true,k);
  assert.equal(f.s.fetches.length,3);assert.equal(r.pending.col,'absent');assert.equal(r.pending.history,'absent');
});
test('owner session is required before any diagnostic work',()=>{const f=fixture();assert.throws(()=>f.run('invalid'),/Owner session/);assert.equal(f.s.fetches.length,0);assert.equal(f.s.propertyReads.length,0);});
test('reports individual open gates, separate marker/pointer presence and immutable record existence without values',()=>{
  for(const gate of gates){const f=fixture(s=>{s.properties[gate]='true';s.properties.ANNALS_SIGNING_QUALIFICATION_RECORD=sentinel;s.existing=true;});const r=f.run();assert.equal(r.gates[gate],false);assert.equal(r.priorPointerPresent,true);assert.equal(r.priorMarkerPresent,false);assert.equal(r.priorRecordPresent,true);}
  const r=fixture(s=>s.properties.ANNALS_SIGNING_REMEDIATED_AT=sentinel).run();assert.equal(r.priorMarkerPresent,true);assert.equal(r.priorPointerPresent,false);
});
test('distinguishes terminal, unresolved and inaccessible private records without private states',()=>{
  for(const state of ['verified_live','verified_cancelled','unknown_no_retry']){const r=fixture(s=>s.pending['col-release-pending-private.json']={state,private:sentinel}).run();assert.equal(r.pending.col,state.startsWith('verified_')?'terminal':'unresolved');}
  const r=fixture(s=>s.readError=true).run();assert.equal(r.pending.col,'unavailable');assert.equal(r.historicalEvidencePresent,null);
  assert.equal(fixture(s=>s.missingHistorical=true).run().historicalEvidencePresent,false);
});
test('lock contention and root ACL failure are localized without write attempts or exception leakage',()=>{
  let r=fixture(s=>s.lockError=true).run();assert.equal(r.lock,'unavailable');assert.equal(r.priorMarkerPresent,null);assert.equal(r.archiveEmpty,true);
  r=fixture(s=>s.rootError=true).run();assert.equal(r.lock,'acquired');assert.equal(r.privateRoot,'unavailable');assert.equal(r.priorMarkerPresent,false);assert.equal(r.priorRecordPresent,null);
});
test('HTTP diagnostics expose response status but never follow redirects or return bodies/locations',()=>{
  const r=fixture(s=>{s.responses.committedArchive={code:302,body:sentinel};s.responses.liveArchive={code:403,body:sentinel};s.responses.livePage={error:true};}).run();
  assert.equal(r.http.committedArchive.httpStatus,302);assert.equal(r.http.committedArchive.redirect,true);assert.equal(r.http.committedArchive.status,'redirect');
  assert.equal(r.http.liveArchive.httpStatus,403);assert.equal(r.http.liveArchive.status,'http_error');assert.equal(r.http.livePage.status,'unavailable');assert.equal(r.archiveBytesEqual,false);
});
test('exact-byte, schema, nonempty, oversized and page checks match recorder rejection conditions',()=>{
  assert.equal(fixture(s=>s.responses.committedArchive={body:s.archive+'\n'}).run().archiveBytesEqual,false);
  for(const body of ['not-json','null','{"schemaVersion":2,"entries":[],"approvals":[]}'])assert.equal(fixture(s=>s.responses.liveArchive={body}).run().archiveShapeValid,false);
  assert.equal(fixture(s=>s.archive=JSON.stringify({schemaVersion:1,entries:[{}],approvals:[{}]})).run().archiveEmpty,false);
  assert.equal(fixture(s=>s.page='<html>The Annals of Stammtisch<article id="historic"></article></html>').run().pageEmpty,false);
  assert.equal(fixture(s=>s.page='unrelated').run().pageRecognized,false);
  assert.equal(fixture(s=>s.responses.liveArchive={body:'x'.repeat(1000001)}).run().http.liveArchive.status,'invalid_size');
});
test('failed cryptographic observations remain unavailable or mismatch, never fabricated success',()=>{
  let r=fixture(s=>{s.crossError=true;s.rotationError=true;}).run();assert.equal(r.crossCheck,'unavailable');assert.equal(r.rotationCheck,'unavailable');assert.equal(r.priorRecordPresent,null);
  r=fixture(s=>{s.cross=false;s.rotation=false;}).run();assert.equal(r.crossCheck,'mismatch');assert.equal(r.rotationCheck,'mismatch');
});
test('diagnostic desk button calls only the read-only endpoint and clears stale display on record change',()=>{
  const handler=ui.slice(ui.indexOf("el('diagnoseSigningQualification').onclick="),ui.indexOf("el('recordSigningQualification').onclick="));
  assert.match(handler,/call\('annalsDiagnoseSigningQualification'/);assert.doesNotMatch(handler,/call\('annalsRecordSigningQualification'/);
  assert.ok(ui.includes("el('signingDiagnosticResult').textContent='';"));
});
