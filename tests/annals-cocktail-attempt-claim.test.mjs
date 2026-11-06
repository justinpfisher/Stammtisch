import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sourceItemId='a'.repeat(64),entryId='annal-'+sourceItemId.slice(0,24),
  token='b'.repeat(32),sourceSha256='c'.repeat(64),sentAt='2026-11-06T10:00:00.000Z',
  attemptId='d'.repeat(32);
class FrozenDate extends Date {
  constructor(...args){super(...(args.length?args:['2026-11-06T10:02:00.000Z']));}
  static now(){return Date.parse('2026-11-06T10:02:00.000Z');}
}
function harness({canary=false,ackThrows=false}={}){
  const files=new Map(),driveFiles=new Map(),rootFiles=new Map(),acks=[],lockState={held:false,tries:0,releases:0};
  let nextFile=0,onAck=null;
  const root={kind:'root'},folder={kind:'folder'};
  function makeFile(name,data,id){
    return {name,id:id||'file-'+(++nextFile),data,
      getName(){return this.name;},getId(){return this.id;},
      setContent(value){this.data=value;},
      getBlob(){return {getDataAsString:()=>typeof this.data==='string'?this.data:'',
        getBytes:()=>[]};}};
  }
  const expiresAt='2026-11-13T10:00:00.000Z';
  const index={schema:'annals-photo-job-index-v1',sourceItemId,jobFilename:'job-private.json',
    jobToken:token,entryId,sourceSha256,expiresAt,sentAt,state:'sent_once'};
  rootFiles.set('cocktail-photo-job-token-'+token+'-private.json',index);
  if(canary)rootFiles.set('cocktail-photo-canary-token-'+token+'-private.json',{schema:'annals-photo-canary-index-v1'});
  files.set('job-private.json',{schema:'annals-photo-job-private-v1',state:'sent_once',job:{
    schema:'annals-photo-job-v1',jobToken:token,entryId,sourceSha256,photoIndex:0},
    sourceItemId,expiresAt,sentAt});
  files.set('auto-live-verification-private.json',{state:'verified_live',contentSha256:'e'.repeat(64)});
  files.set('approval-private.json',{receipt:{contentSha256:'e'.repeat(64)}});
  const folderApi={createFile(blob){const file=makeFile(blob.getName(),blob.getDataAsString());driveFiles.set(file.name,file);files.set(file.name,JSON.parse(file.data));return file;}};
  const properties={ANNALS_PHOTO_WORKFLOW_ENABLED:'true',ANNALS_PHOTO_WORKER_EMAIL:'annalsstammtisch@gmail.com'};
  const context={Date:FrozenDate,LockService:{getScriptLock:()=>({
    hasLock:()=>lockState.held,
    tryLock:()=>{lockState.tries++;if(lockState.held)return false;lockState.held=true;return true;},
    releaseLock:()=>{lockState.releases++;lockState.held=false;}
  })},annalsProps_:()=>({getProperty:key=>properties[key]??null}),
    Session:{getEffectiveUser:()=>({getEmail:()=>properties.ANNALS_PHOTO_WORKER_EMAIL})},
    Gmail:{Users:{Messages:{get:(_user,id)=>({id,labelIds:id.startsWith('inbox-')?['INBOX']:['SENT']})}}},
    AnnalsPilot:{senderAddress:value=>String(value)},
    annalsRoot_:()=>root,annalsFolder_:()=>folder,
    annalsRead_:(target,name)=>(target===root?rootFiles:files).get(name)||null,
    annalsFile_:(target,name)=>(target===root?rootFiles:driveFiles).get(name)||null,
    annalsPrivate_:file=>file,
    annalsSavePrivate_:(target,name,value)=>{(target===root?rootFiles:files).set(name,value);if(target!==root&&driveFiles.has(name))driveFiles.get(name).data=JSON.stringify(value);return value;},
    annalsCocktailEditorialContext_:()=>({folder,entryId,sourceSha256}),
    Utilities:{newBlob:(value,_mime,name)=>({getName:()=>name,getDataAsString:()=>String(value),getBytes:()=>[]})},
    GmailApp:{sendEmail:(...args)=>{if(ackThrows)throw Error('simulated uncertain ACK');acks.push(args);if(onAck)onAck();}},
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../scripts/annals/CocktailEditorialProduction.gs',import.meta.url),'utf8'),context);
  context.annalsCocktailEditorialContext_=()=>({folder,entryId,sourceSha256});
  function message(prefix,subjectAttempt=attemptId,body={schema:'annals-photo-attempt-claim-v1',jobToken:token,
    attemptId:subjectAttempt,entryId,sourceSha256},options={}){
    return {ownerSent:options.ownerSent!==false,id:options.id||'gmail-'+prefix+'-'+subjectAttempt,
      getId(){return this.id;},getSubject:()=>`[ANNALS PHOTO ${prefix} V1] ${token} ${subjectAttempt}`,
      getFrom:()=>properties.ANNALS_PHOTO_WORKER_EMAIL,
      getPlainBody:()=>JSON.stringify(body),getAttachments:()=>[],...options};
  }
  return {context,files,driveFiles,rootFiles,folder,folderApi,acks,lockState,message,properties,setOnAck:fn=>{onAck=fn;}};
}

test('one claim is accepted under the existing ScriptLock; a competing worker gets no ACK',()=>{
  const x=harness(),first=x.message('ATTEMPT'),second=x.message('ATTEMPT','f'.repeat(32));
  // The Drive folder object used by the owner-private write is the same folder
  // returned by annalsFolder_.
  x.context.annalsFolder_=()=>Object.assign(x.folder,x.folderApi);
  let overlappingOutcome=null;x.setOnAck(()=>{overlappingOutcome=x.context.annalsHandleCocktailPhotoAttemptClaim_(second);});
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptClaim_(first),'photo_attempt_accepted');
  assert.equal(overlappingOutcome,'photo_attempt_held','overlap sees the already-written claim while the script lock is held');
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptClaim_(second),'photo_attempt_held');
  const saved=x.files.get('cocktail-photo-attempt-'+token+'-private.json');
  assert.equal(saved.state,'claim_accepted');assert.equal(saved.attemptId,attemptId);
  assert.equal(saved.sourceSha256,sourceSha256);assert.equal(saved.claimMessageId,first.id);
  assert.equal(x.acks.length,1);assert.equal(x.acks[0][1],`[ANNALS PHOTO ATTEMPT ACK V1] ${token} ${attemptId}`);
  assert.equal(x.lockState.tries,2);assert.equal(x.lockState.releases,2);assert.equal(x.lockState.held,false);
});

test('the owner-SENT start marker durably binds the invocation time before a result can qualify',()=>{
  const x=harness();x.context.annalsFolder_=()=>Object.assign(x.folder,x.folderApi);
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptClaim_(x.message('ATTEMPT')),'photo_attempt_accepted');
  const generatedAt='2026-11-06T10:02:05.000Z',start=x.message('STARTED',attemptId,{
    schema:'annals-photo-attempt-start-v1',jobToken:token,attemptId,entryId,sourceSha256,generatedAt
  });
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptStarted_(start),'photo_attempt_started');
  const saved=x.files.get('cocktail-photo-attempt-'+token+'-private.json');
  assert.equal(saved.state,'generation_started');assert.equal(saved.generatedAt,generatedAt);
  assert.equal(saved.startMessageId,start.id);
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptStarted_(start),'photo_attempt_held','duplicate start is terminal');
});

test('an abandoned or uncertain claim is never freed for another generation attempt',()=>{
  const x=harness({ackThrows:true});x.context.annalsFolder_=()=>Object.assign(x.folder,x.folderApi);
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptClaim_(x.message('ATTEMPT')),'photo_attempt_ack_uncertain');
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptClaim_(x.message('ATTEMPT','f'.repeat(32))),'photo_attempt_held');
  const saved=x.files.get('cocktail-photo-attempt-'+token+'-private.json');
  assert.equal(saved.state,'claim_accepted');assert.equal(x.acks.length,0);
});

test('synthetic canary tokens and unauthenticated claim messages cannot claim a production job',()=>{
  const synthetic=harness({canary:true});synthetic.context.annalsFolder_=()=>Object.assign(synthetic.folder,synthetic.folderApi);
  assert.equal(synthetic.context.annalsHandleCocktailPhotoAttemptClaim_(synthetic.message('ATTEMPT')),'photo_attempt_held');
  assert.equal(synthetic.acks.length,0);assert.equal(synthetic.files.has('cocktail-photo-attempt-'+token+'-private.json'),false);
  const untrusted=harness();untrusted.context.annalsFolder_=()=>Object.assign(untrusted.folder,untrusted.folderApi);
  assert.equal(untrusted.context.annalsHandleCocktailPhotoAttemptClaim_(untrusted.message('ATTEMPT',attemptId,undefined,{id:'inbox-untrusted'})),'photo_attempt_held');
  assert.equal(untrusted.acks.length,0);
});

test('regular worker results must carry the reserved attempt ID; canary v1 stays separate',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../scripts/annals/CocktailEditorialCore.js',import.meta.url),'utf8'),context);
  const policy=context.AnnalsCocktailEditorial,job={jobToken:token,entryId,sourceSha256},
    now=vm.runInContext("new Date('2026-11-06T10:10:00.000Z')",context),
    qa={sameGlass:true,sameDrinkAndGarnish:true,photorealisticSubject:true,plausibleStemOrBase:true,
      sceneAppropriate:true,noArtifactsOrPrivateDetails:true,noVisiblePeopleOrReflections:true},
    qualified={schema:'annals-photo-result-v1',jobToken:token,attemptId,entryId,sourceSha256,status:'qualified',qa,
      alt:'AI-stylized fictional amber drink in its original glass.',generatedAt:'2026-11-06T10:02:05.000Z',
      reviewedAt:'2026-11-06T10:03:00.000Z',generationProvider:'openai-chatgpt',generationModel:'undisclosed'};
  assert.equal(policy.validatePhotoResult(qualified,job,true,now,attemptId).qualified,true);
  assert.throws(()=>policy.validatePhotoResult({...qualified,attemptId:'e'.repeat(32)},job,true,now,attemptId),/attempt mismatch/);
  const held={schema:'annals-photo-result-v1',jobToken:token,attemptId,entryId,sourceSha256,status:'held',reasonCode:'edit_failed'};
  assert.equal(policy.validatePhotoResult(held,job,true,now,attemptId).reason,'edit_failed');
  assert.throws(()=>policy.validatePhotoResult({...held,attemptId:undefined},job,true,now,attemptId),/attempt mismatch/);
});

test('the existing intake processes bounded claim pages with a resumable cursor',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8'),context);
  const properties={},queries=[],handled=[],threads=Array.from({length:11},(_,i)=>({getMessages:()=>[{
    getId:()=>`claim-${i}`,getSubject:()=>`[ANNALS PHOTO ATTEMPT V1] ${String(i).padStart(32,'a')} ${String(i+1).padStart(32,'b')}`
  }]}));
  context.annalsProps_=()=>({getProperty:key=>properties[key]??null,
    setProperty:(key,value)=>{properties[key]=value;},deleteProperty:key=>{delete properties[key];}});
  context.GmailApp={search:(query,offset,count)=>{queries.push(query);return threads.slice(offset,offset+count);}};
  const seen={};
  const pattern=/^\[ANNALS PHOTO ATTEMPT V1\] [a-f0-9]{32} [a-f0-9]{32}$/i,
    handler=message=>{handled.push(message.getId());return 'photo_attempt_accepted';};
  assert.equal(context.annalsProcessSentPhotoControl_('in:sent subject:"[ANNALS PHOTO ATTEMPT V1]" newer_than:7d',
    'ANNALS_SENT_PHOTO_CLAIM_CURSOR',pattern,handler,seen).handled,10);
  assert.equal(properties.ANNALS_SENT_PHOTO_CLAIM_CURSOR,'{"offset":10}');
  assert.equal(context.annalsProcessSentPhotoControl_('in:sent subject:"[ANNALS PHOTO ATTEMPT V1]" newer_than:7d',
    'ANNALS_SENT_PHOTO_CLAIM_CURSOR',pattern,handler,{}).handled,1);
  assert.equal(handled.length,11);assert.equal(handled[10],'claim-10');
  assert.equal(properties.ANNALS_SENT_PHOTO_CLAIM_CURSOR,undefined);
  assert.equal(queries.every(query=>query.includes('in:sent')&&query.includes('[ANNALS PHOTO ATTEMPT V1]')),true);
});
test('intake calls the locked handlers directly and never probes/releases a nested lock handle',()=>{
  const x=harness();x.context.annalsFolder_=()=>Object.assign(x.folder,x.folderApi);
  let probes=0,tries=0,releases=0;
  x.context.LockService={getScriptLock:()=>({
    hasLock:()=>{probes++;return false;},
    tryLock:()=>{tries++;return false;},
    releaseLock:()=>{releases++;}
  })};
  // Intake already owns a lock, but a second getScriptLock handle need not report it.
  assert.equal(x.context.annalsHandleCocktailPhotoAttemptClaimLocked_(x.message('ATTEMPT')),
    'photo_attempt_accepted');
  assert.equal(probes,0);assert.equal(tries,0);assert.equal(releases,0);
  const production=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
  assert.match(production,/annalsHandleCocktailPhotoAttemptClaimLocked_\(message\)/);
  assert.match(production,/annalsHandleCocktailPhotoAttemptStartedLocked_,seenInRun/);
});
