/* Entirely fictional, local fixtures. Never dispatch or publish these records. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash,createHmac} from 'node:crypto';
import Photos from '../scripts/annals/PhotoContracts.js';
import Rules from '../scripts/annals/RulesCore.js';
import Media from '../scripts/annals/MediaCore.js';
import Auto from '../scripts/annals/AutoCore.js';
import {photoIndex} from '../scripts/annals/PhotoIndex.mjs';
import {contentDigest,validatePublicTextEntry,buildPublishedAnnals} from '../scripts/annals/ApprovedRenderer.mjs';
import {applyApprovedEntry,approvedPhoto} from '../scripts/annals/apply-approved-entry.mjs';
import {applyRuleRelease,applyRuleStatus,renderRegister,digest,canonical,RULES_MODE,RULE_STATUS_MODE} from '../scripts/annals/RulesPublisher.mjs';
import {coordinate,RELEASE_MODE,requireNonActivatingRuleRelease} from '../scripts/annals/RulesRelease.mjs';

const at='2026-10-15T18:00:00Z',key='fictional-v2-test-key-not-a-real-production-secret';
const base={id:'col-baseline-fictional',digest:'a'.repeat(64),provisions:{PRIZE:'## PRIZE\n\nThe fictional prize is ten tokens.'}};
const source={senderAuthenticated:true,member:'marc',freshOperativeWindow:true,replayed:false,text:'Change the fictional prize to twelve tokens.',receivedAt:at};
const assessment=()=>({intent:'operative',requestExcerpt:source.text,changes:[{provision:'PRIZE',before:base.provisions.PRIZE,after:'## PRIZE\n\nThe fictional prize is twelve tokens.',sourceExcerpt:source.text}],explanation:'Fictional fixture: change the prize.',clarification:'',effectiveAt:'',retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''}});
const revision=()=>Rules.intake(source,assessment(),base,'col-fictional-000001');
const evidence=()=>({meaningVerified:true,regressionPassed:true,implementationCommit:'b'.repeat(40),sourceRequired:false,sourceVerified:false,sourceDigest:'',historicalResultsPreserved:true,retrospectiveVerified:false,releaseVerified:true});

test('one authenticated member independently authorises a prospective change, with exact request mapping',()=>{
  const r=revision();assert.equal(r.state,'awaiting_implementation');assert.equal(r.member,'marc');assert.equal(r.publishedAt,null);assert.equal(r.effectiveAt,null);
  assert.equal(r.changes[0].before,base.provisions.PRIZE);assert.equal(r.requestExcerpt,source.text);
  assert.equal('ownerApproval' in r,false);assert.equal('secondMember' in r,false);
});
test('spoofed, replayed, truncated and historical requests are rejected',()=>{
  for(const s of [{senderAuthenticated:false},{replayed:true},{freshOperativeWindow:false},{truncated:true},{member:'guest'}])assert.throws(()=>Rules.intake({...source,...s},assessment(),base,'col-fictional-000001'));
});
test('questions, jokes, quotations, recollections and tentative discussion never become revisions',()=>{
  for(const intent of ['question','joke','quotation','recollection','discussion'])assert.equal(Rules.intake(source,{intent},base,'col-fictional-000001').state,'discussion');
  assert.equal(Rules.intake(source,{intent:'unclear',clarification:'Did you intend a rule change?'},base,'col-fictional-000001').state,'awaiting_clarification');
});
test('ambiguous meaning and retrospective authority require a focused clarification',()=>{
  const a=assessment();a.clarification='Does this apply to the prize or the draft benefit?';assert.equal(Rules.intake(source,a,base,'col-fictional-000001').state,'awaiting_clarification');
  a.clarification='';a.retrospective={requested:true,period:'2025',results:'prize',clubAgreementExcerpt:''};assert.equal(Rules.intake(source,a,base,'col-fictional-000001').state,'awaiting_clarification');
});
test('unrelated provisions and arbitrary platform data cannot enter the rule language',()=>{
  for(const property of ['membership','authentication','credentials','budget','notifications','infrastructure','execute']){const a=assessment();a[property]='change';assert.throws(()=>Rules.intake(source,a,base,'col-fictional-000001'));}
  const a=assessment();a.changes[0].provision='AUTHENTICATION';assert.throws(()=>Rules.intake(source,a,base,'col-fictional-000001'));
  a.changes[0].provision='PRIZE';a.changes[0].after+='\n## OTHER\nAdditional rule';assert.throws(()=>Rules.intake(source,a,base,'col-fictional-000001'));
});
test('literal source excerpts, exact before text and unaffected provisions are preserved',()=>{
  for(const change of [{before:'invented before'},{sourceExcerpt:'invented request'}]){const a=assessment();Object.assign(a.changes[0],change);assert.throws(()=>Rules.intake(source,a,base,'col-fictional-000001'));}
  const b={...base,provisions:{...base.provisions,POINTS:'## POINTS\nUnchanged fictional points.'}},r=Rules.intake(source,assessment(),b,'col-fictional-000001');
  assert.equal(Rules.qualify(r,b,evidence()).provisions.POINTS,b.provisions.POINTS);
});
test('source spreadsheet disagreement and unverified implementation retain the prior version',()=>{
  for(const e of [{sourceRequired:true},{meaningVerified:false},{regressionPassed:false},{historicalResultsPreserved:false},{releaseVerified:false},{implementationCommit:''}])assert.throws(()=>Rules.qualify(revision(),base,{...evidence(),...e}));
  assert.equal(base.provisions.PRIZE,'## PRIZE\n\nThe fictional prize is ten tokens.');
});
test('default publication time, future scheduling and version selection are distinct',()=>{
  const q=Rules.qualify(revision(),base,evidence()),p=Rules.publish(q,base,at,base.id);assert.equal(p.revision.effectiveAt,at);assert.equal(p.revision.state,'active');
  const a=assessment();a.effectiveAt='2027-01-01T00:00:00-05:00';const r=Rules.intake(source,a,base,'col-fictional-000001');const scheduled=Rules.publish(Rules.qualify(r,base,evidence()),base,at,base.id);assert.equal(scheduled.revision.state,'scheduled');
  const versions=[{...base,verified:true,effectiveAt:at},{...scheduled.version,verified:true}];assert.equal(Rules.select(versions,at).id,base.id);assert.equal(Rules.select(versions,'2027-01-01T06:00:00Z').id,r.id);
});
test('scheduled and concurrent stale changes cannot overwrite intervening revisions',()=>{
  assert.throws(()=>Rules.qualify(revision(),{...base,digest:'c'.repeat(64)},evidence()));
  const q=Rules.qualify(revision(),base,evidence());assert.throws(()=>Rules.publish(q,base,at,'col-intervening-version'));
});
test('a new formula does not grant retrospective authority; express agreed period/results can qualify',()=>{
  const a=assessment();a.effectiveAt='2025-01-01T00:00:00-05:00';const r=Rules.intake(source,a,base,'col-fictional-000001');assert.throws(()=>Rules.publish(Rules.qualify(r,base,evidence()),base,at,base.id));
  const s={...source,text:source.text+' The club expressly agreed to revise the 2025 prize result.'};a.retrospective={requested:true,period:'2025',results:'prize result',clubAgreementExcerpt:'The club expressly agreed to revise the 2025 prize result.'};
  const retro=Rules.intake(s,a,base,'col-fictional-000001');assert.throws(()=>Rules.qualify(retro,base,evidence()));assert.equal(Rules.qualify(retro,base,{...evidence(),retrospectiveVerified:true}).revision.retrospective.period,'2025');
});
test('rules parser handles Windows line endings without changing January scoring/draft distinctions',()=>{
  const text=readFileSync(new URL('../docs/celebration-of-life-rules.md',import.meta.url),'utf8');assert.deepEqual(Rules.provisions(text),Rules.provisions(text.replace(/\r?\n/g,'\r\n')));
  const versions=JSON.parse(readFileSync(new URL('../data/col-rules-versions.json',import.meta.url)));assert.deepEqual(Rules.provisions(text),versions.versions[0].provisions);assert.equal(versions.versions[0].januaryGap,'unresolved');
});
test('public revision register strips original source and renders exact accessible differences',()=>{
  const r=Rules.publicRecord(revision());assert.equal('requestExcerpt' in r,false);assert.equal('sourceExcerpt' in r.changes[0],false);
  const register={schemaVersion:1,baseline:{id:base.id,recordedAt:at,description:'Fictional fixture baseline.'},revisions:[r],events:[]};
  const html=renderRegister(register);assert.match(html,/marc-annals.webp/);assert.match(html,/<details>/);assert.match(html,/Toronto/);assert.doesNotMatch(html,/member@example/);
});
test('signed register releases are disabled by default, exact-base bound, one-shot and append-only',()=>{
  const current={schemaVersion:1,baseline:{id:base.id,recordedAt:at,description:'Fictional fixture baseline.'},revisions:[],events:[]},release={...current,revisions:[Rules.publicRecord(revision())]};
  const proof={mode:RULES_MODE,baseDigest:digest(current),contentSha256:digest(release),issuedAt:at},approval={...proof,signature:createHmac('sha256',key).update(JSON.stringify(canonical({release,approval:proof}))).digest('hex')};
  const args={current,release,approval,secret:key,now:new Date(at)};assert.throws(()=>applyRuleRelease(args));assert.deepEqual(applyRuleRelease({...args,enabled:true}),release);assert.throws(()=>applyRuleRelease({...args,current:release,enabled:true}));assert.throws(()=>applyRuleRelease({...args,release:{...release,baseline:{...release.baseline,description:'changed'}},enabled:true}));
});

const grants=Photos.MEMBERS.map(member=>({member,active:true,atReceipt:true}));
const photoEvidence={senderAuthenticated:true,imageConsentAtReceipt:true,originalRights:true,peopleAttestedSixOnly:true};
const screen={kind:'member_group',safeToPublish:true,privateDetails:false,thirdPartyMaterial:false,childrenOrGuests:false};
test('ordinary six-member standing permission needs no per-image owner approval, but revocation holds',()=>{
  assert.equal(Photos.allowed(photoEvidence,screen,grants),true);
  assert.equal(Photos.allowed(photoEvidence,screen,grants.map((g,i)=>i?g:{...g,active:false})),false);
  assert.equal(Photos.allowed({...photoEvidence,peopleAttestedSixOnly:false},screen,grants),false);
});
test('AI face classification never establishes identity, consent, rights or third-party permission',()=>{
  for(const e of [{senderAuthenticated:false},{imageConsentAtReceipt:false},{originalRights:false}])assert.equal(Photos.allowed({...photoEvidence,...e},screen,grants),false);
  for(const a of [{childrenOrGuests:true},{privateDetails:true},{thirdPartyMaterial:true},{kind:'document_or_text'},{safeToPublish:false}])assert.equal(Photos.allowed(photoEvidence,{...screen,...a},grants),false);
});
const raw=Buffer.from(readFileSync(new URL('./annals-safe-media.test.mjs',import.meta.url),'utf8').match(/const photo=\(\)=>Buffer.from\('([^']+)'/)[1],'base64');
const bytes=Buffer.from(Media.sanitize(raw).bytes),hash=createHash('sha256').update(bytes).digest('hex');
const entry=()=>({id:'annal-fictional-v2-000001',category:'assembly',title:'Fictional photo fixture',summary:'Fictional layout fixture only.',year:2026,dateLabel:'Submitted 2026-10',sortDate:'',quoteVerbatim:'',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},credit:'anonymous',photos:[{sha256:hash,alt:'Fictional tiny image',width:1,height:1}],submittedAt:at,eventPeriod:''});
const sign=e=>{const a={entryId:e.id,approvedAt:at,consents:{publication:true,quotePublication:false,recipeVerified:false,namedAttribution:false,photoPublication:true},contentSha256:contentDigest(e),mode:'standing-consent-photos-v2'};return {...a,signature:createHmac('sha256',key).update(JSON.stringify(canonical({entry:e,approval:a}))).digest('hex')};};
test('gallery rejects duplicates, excess images, invalid dates and mismatched declarations',()=>{
  assert.throws(()=>Photos.validate([entry().photos[0],entry().photos[0]]));assert.throws(()=>Photos.validate(new Array(4).fill(entry().photos[0])));assert.throws(()=>Photos.period('2026-02-30'));assert.equal(Photos.period('2026-10'),'2026-10');assert.equal(Photos.period('2026'),'2026');assert.throws(()=>validatePublicTextEntry({...entry(),photo:{sha256:hash,alt:'Conflict'}}));
});
test('only a signed digest-bound metadata-free gallery crosses the disabled hosted gate',async()=>{
  const e=entry(),event={action:'annals-auto-entry',client_payload:{entry:e,approval:sign(e),images:[{sha256:hash,base64:bytes.toString('base64')}]}};
  const args={event,data:{schemaVersion:1,entries:[],approvals:[]},secret:key};await assert.rejects(applyApprovedEntry(args),/disabled/);
  const result=await applyApprovedEntry({...args,photosEnabled:true});assert.equal(result.assetsToWrite.length,1);assert.equal(result.assetsToWrite[0].path,'assets/annals/'+hash+'.jpg');assert.match(result.html,/data-photo-view/);assert.match(result.html,/photos.html/);
  assert.throws(()=>approvedPhoto({photo:{sha256:createHash('sha256').update(raw).digest('hex')}},raw.toString('base64')),/metadata/);
  const changed={...event,client_payload:{...event.client_payload,images:[{sha256:hash,base64:raw.toString('base64')}]}};await assert.rejects(applyApprovedEntry({...args,event:changed,photosEnabled:true}));
});
test('withdrawal retires a gallery identity and removes unreferenced derivative assets',async()=>{
  const e=entry(),p={entryId:e.id,approvedAt:at,contentSha256:contentDigest(e)},approval={...p,signature:createHmac('sha256',key).update(JSON.stringify(canonical({operation:'remove',removal:p}))).digest('hex')};
  const result=await applyApprovedEntry({event:{action:'annals-remove-entry',client_payload:{entryId:e.id,approval}},data:{schemaVersion:1,entries:[e],approvals:[sign(e)]},secret:key});assert.equal(result.data.entries.length,0);assert.ok(result.assetsToDelete.some(a=>a.path.includes(hash)));assert.ok(result.data.retiredIds.includes(e.id));
});
test('thousands of photo records have bounded paged metadata, canonical links and no cloned assets',()=>{
  const entries=Array.from({length:2500},(_,i)=>({...entry(),id:'annal-fictional-scale-'+String(i).padStart(6,'0'),year:2000+i%26}));
  const index=photoIndex(entries);assert.equal(index.manifest.count,2500);assert.ok(index.pages.every(p=>p.data.length<=24));assert.ok(index.manifest.pages.every(p=>!('photos' in p)&&!('data' in p)));assert.ok(index.pages.every(p=>p.data.every(r=>r.photos[0].src==='assets/annals/'+hash+'.jpg')));assert.equal(index.pages.reduce((n,p)=>n+p.count,0),2500);
});
test('empty production archives expose neither Photos navigation nor fabricated rule history',()=>{
  assert.doesNotMatch(buildPublishedAnnals([],[],key).html,/<a href="photos.html"/);
  assert.equal(JSON.parse(readFileSync(new URL('../data/annals-approved.json',import.meta.url))).entries.length,0);
  assert.equal(JSON.parse(readFileSync(new URL('../data/col-rules-register.json',import.meta.url))).revisions.length,0);
});
test('a signed source-grounded date correction is visible without replacing submission time',()=>{
  const e={...entry(),eventPeriod:'2025-06',correction:{at:'2026-10-16T00:30:00Z',note:'Event month corrected from the contributor record.'}};
  const result=buildPublishedAnnals([e],[sign(e)],key).html;
  assert.match(result,/Corrected <time datetime="2026-10-16T00:30:00Z">October 15, 2026/);
  assert.match(result,/Event: 2025-06/);assert.match(result,/Submitted <time datetime="2026-10-15T18:00:00Z">/);
});
test('new private capabilities stay off without all independent readiness evidence',()=>{
  for(const module of ['PhotoProduction.gs','RulesProduction.gs']){
    const values={},ctx=vm.createContext({annalsProps_:()=>({getProperty:k=>values[k]||null})});vm.runInContext(readFileSync(new URL('../scripts/annals/'+module,import.meta.url),'utf8'),ctx);
    const ready=module.startsWith('Photo')?ctx.annalsPhotosReady_:ctx.annalsRulesReady_;assert.equal(ready(),false);
    values.ANNALS_PHOTOS_V2_ENABLED=values.ANNALS_RULES_V2_ENABLED='true';assert.equal(ready(),false);values.ANNALS_SIGNING_REMEDIATED_AT=at;assert.equal(ready(),false);
  }
});

const coordinatedFixture=()=>{
  const register={schemaVersion:1,baseline:{id:base.id,recordedAt:at,description:'Fictional fixture baseline.'},revisions:[],events:[]};
  const versions={schemaVersion:1,versions:[{...base,verified:true,effectiveAt:at,parameters:{ageBase:100,centenaryPoints:10,diamondMultiplier:2,prizeDollars:100,minimumDraftSpaces:5},januaryGap:'unresolved'}]};
  const content={revision:{...Rules.publicRecord(revision()),baseDigest:base.digest,retrospective:{requested:false}},evidence:evidence(),behaviorDigest:'c'.repeat(64),sourceDigest:''};
  const proof={mode:RELEASE_MODE,baseRegisterDigest:digest(register),baseVersionsDigest:digest(versions),issuedAt:at};
  const bundle={...content,approval:{...proof,signature:createHmac('sha256',key).update(JSON.stringify(canonical({content,approval:proof}))).digest('hex')}};
  return {register,versions,bundle,secret:key,enabled:true,now:new Date(at),implementationCommit:'b'.repeat(40),behavior:'c'.repeat(64),sourceDigest:'',markdown:'# STAMMTISCH\n\n'+base.provisions.PRIZE+'\n\n---\n\nUnchanged editorial notes.',html:'<main><details class="rule-topic">Old fictional rule</details>\n      <p class="rules-reference">Unchanged reference.</p></main>'};
};
test('source-blocked changes can be publicly pending, and status publication cannot activate them',()=>{
  const args=coordinatedFixture(),record={...Rules.publicRecord(revision()),publishedAt:at};
  const proof={mode:RULE_STATUS_MODE,baseDigest:digest(args.register),contentSha256:digest(record),issuedAt:at};
  const approval={...proof,signature:createHmac('sha256',key).update(JSON.stringify(canonical({record,approval:proof}))).digest('hex')};
  const params={current:args.register,record,approval,secret:key,enabled:true,now:new Date(at)};
  const pending=applyRuleStatus(params);assert.equal(pending.revisions[0].state,'awaiting_implementation');assert.equal(args.versions.versions.length,1);
  assert.throws(()=>applyRuleStatus({...params,current:pending}));assert.throws(()=>applyRuleStatus({...params,record:{...record,state:'active'}}));
  const content={...args.bundle};delete content.approval;
  const nextProof={...args.bundle.approval,baseRegisterDigest:digest(pending)};delete nextProof.signature;
  const bundle={...content,approval:{...nextProof,signature:createHmac('sha256',key).update(JSON.stringify(canonical({content,approval:nextProof}))).digest('hex')}};
  const result=coordinate({...args,register:pending,bundle});assert.equal(result.register.revisions.length,1);assert.equal(result.register.revisions[0].state,'awaiting_implementation');assert.equal(result.register.events.at(-1).state,'active');
  assert.equal(pending.events.length,0,'adoption must not mutate the prior pending register');
});
test('a pending future revision stays scheduled until a separately qualified due-time activation',()=>{
  const args=coordinatedFixture(),future='2027-01-01T05:00:00Z';
  const record={...Rules.publicRecord(revision()),publishedAt:at,effectiveAt:future};
  const register={...args.register,revisions:[record]};
  const content={...args.bundle,revision:{...args.bundle.revision,effectiveAt:future}};delete content.approval;
  function signed(reg,vers,issuedAt){const proof={mode:RELEASE_MODE,baseRegisterDigest:digest(reg),baseVersionsDigest:digest(vers),issuedAt};return {...content,approval:{...proof,signature:createHmac('sha256',key).update(JSON.stringify(canonical({content,approval:proof}))).digest('hex')}};}
  const scheduled=coordinate({...args,register,bundle:signed(register,args.versions,at)});
  assert.equal(scheduled.register.events.at(-1).state,'scheduled');assert.equal(scheduled.versions.versions.at(-1).verified,false);assert.equal(scheduled.markdown,args.markdown);
  const active=coordinate({...args,register:scheduled.register,versions:scheduled.versions,bundle:signed(scheduled.register,scheduled.versions,future),now:new Date(future)});
  assert.equal(active.register.events.at(-1).state,'active');assert.equal(active.versions.versions.at(-1).verified,true);assert.match(active.markdown,/twelve tokens/);assert.equal(scheduled.register.events.length,1);
});
test('coordinated rules narrative, structured version and register use one exact release',()=>{
  const args=coordinatedFixture(),result=coordinate(args);assert.match(result.markdown,/twelve tokens/);assert.match(result.html,/twelve tokens/);assert.equal(result.register.revisions[0].state,'active');assert.equal(result.versions.versions.at(-1).provisions.PRIZE,revision().changes[0].after);assert.match(result.markdown,/Unchanged editorial notes/);
  assert.equal('requestExcerpt' in result.register.revisions[0],false);
});
test('live rule release fails closed before writing any unverified active version or changed rules text',()=>{
  const args=coordinatedFixture(),active=coordinate(args);
  assert.throws(()=>requireNonActivatingRuleRelease(active,args),/hosted publication clock/);
  assert.equal(args.register.revisions.length,0);
  assert.equal(args.versions.versions.length,1);
  assert.equal(args.markdown.includes('twelve tokens'),false);
  const future='2027-01-01T05:00:00Z';
  const {approval:oldApproval,...content}=args.bundle;
  const proposal={...content,revision:{...content.revision,effectiveAt:future}};
  const proof={...oldApproval};delete proof.signature;
  const bundle={...proposal,approval:{...proof,signature:createHmac('sha256',key)
    .update(JSON.stringify(canonical({content:proposal,approval:proof}))).digest('hex')}};
  const staged=coordinate({...args,bundle});
  assert.equal(staged.versions.versions.at(-1).verified,false);
  assert.equal(staged.markdown,args.markdown);
  assert.equal(requireNonActivatingRuleRelease(staged,args),staged);
  for(const unsafe of [
    {...staged,markdown:'Unverified operative text'},
    {...staged,html:'<p>Unverified operative text</p>'},
    {...staged,versions:{...staged.versions,versions:staged.versions.versions.map((v,i)=>i===staged.versions.versions.length-1?{...v,verified:true}:v)}},
    {...staged,register:{...staged.register,events:[...staged.register.events,{state:'active'}]}}
  ])assert.throws(()=>requireNonActivatingRuleRelease(unsafe,args),/hosted publication clock/);
  const source=readFileSync(new URL('../scripts/annals/RulesRelease.mjs',import.meta.url),'utf8');
  assert.match(source,/requireNonActivatingRuleRelease\(result,before\)/);
});
test('deployment preparation failures, changed code, source mismatch and replay produce no mutation',()=>{
  const args=coordinatedFixture(),original=JSON.stringify(args.register);
  for(const change of [{enabled:false},{implementationCommit:'d'.repeat(40)},{behavior:'d'.repeat(64)},{html:'missing official boundary'},{markdown:'changed source'}])assert.throws(()=>coordinate({...args,...change}));
  assert.equal(JSON.stringify(args.register),original);
  const result=coordinate(args);assert.throws(()=>coordinate({...args,register:result.register,versions:result.versions}));
});
test('private live reconciliation needs every exact hosted file before final notice',()=>{
  const pending={state:'accepted',sourceId:'x',at,expectedFiles:{'celebration.html':'expected','data/col-rules-register.json':'expected'}};
  let notices=0,writes=0;const context=vm.createContext({Date:class extends Date{static now(){return Date.parse(at);}},annalsRoot_:()=>({}),annalsRead_:()=>pending,annalsHash_:v=>v,
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=> 'mismatch'})},annalsWriteOnce_:()=>{writes++;},annalsRuleNotice_:()=>{notices++;}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),context);
  assert.equal(context.annalsReconcileRuleRelease_('x'),false);assert.equal(notices,0);assert.equal(writes,0);assert.equal(pending.state,'accepted');
});
test('integrated private rule intake consumes only one existing reservation and needs no owner adoption',()=>{
  const files=new Map(),values={ANNALS_AI_ENABLED:'true',ANNALS_RULES_ACCEPT_FROM:'2026-10-15T17:00:00Z',ANNALS_OPENAI_API_KEY:'fictional-test-value',ANNALS_BUDGET_LEDGER:JSON.stringify({schemaVersion:1,month:'2026-10',reservedCents:0})};
  const s={rulesAuthorityVersion:2,rulesActivationEligible:true,senderAuthenticated:true,aiConsentActive:true,source:{sender:'fictional@example.test',subject:'CoL rule change',excerpt:source.text,receivedAt:at}};
  files.set('source-private.json',s);let fetches=0,notices=0;
  const context=vm.createContext({AnnalsRules:Rules,Date:class extends Date{static now(){return Date.parse(at);}},
    annalsProps_:()=>({getProperty:k=>values[k]||null,setProperty:(k,v)=>values[k]=v}),annalsFolder_:()=>({}),annalsRoot_:()=>({}),
    annalsRead_:(_,name)=>files.get(name)||null,annalsFile_:(_,name)=>files.get(name)||null,
    annalsWriteOnce_:(_,name,value)=>{assert.equal(files.has(name),false);files.set(name,value);},
    annalsConsentActive_:()=>true,annalsStandingPublicationActive_:()=>true,annalsAiSourceText_:v=>v.source.subject+'\n'+v.source.excerpt,
    AnnalsProduction:{MODEL:'existing-test-model',reserve:(ledger,month)=>({...ledger,month,reservedCents:ledger.reservedCents+10})},
    Utilities:{formatDate:()=> '2026-10'},annalsSpeakerIdentities_:()=>({'fictional@example.test':'marc'}),annalsHash_:()=> 'a'.repeat(64),
    annalsRecordAttemptOutcome_:()=>assert.fail('Unexpected failure'),
    UrlFetchApp:{fetch:url=>{fetches++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('col-rules-versions')?{versions:[{...base,verified:true,effectiveAt:'2026-10-15T17:00:00Z'}]}:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(assessment())}]}]})};}}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),context);
  context.annalsRulesReady_=()=>true;context.annalsRuleNotice_=()=>{notices++;};
  assert.equal(context.annalsProcessRuleRequest_('a'.repeat(64)),true);assert.equal(files.get('col-rule-request-private.json').state,'awaiting_implementation');assert.equal(notices,1);assert.equal(fetches,2);
  assert.equal(JSON.parse(values.ANNALS_BUDGET_LEDGER).reservedCents,10);assert.equal(context.annalsProcessRuleRequest_('a'.repeat(64)),false);assert.equal(fetches,2);
});
test('integrated group photo uses six standing grants while guest images and extraction documents stay held',()=>{
  const context=vm.createContext({AnnalsPhotos:Photos,AnnalsAuto:Auto,AnnalsMediaPolicy:{MODE:'standing-consent-image-v1'}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/PhotoProduction.gs',import.meta.url),'utf8'),context);context.annalsPhotoSubjectGrants_=()=>grants;
  const s={senderAuthenticated:true,imageConsentAtReceipt:true,source:{subject:'Photographs',excerpt:'All six of us.',receivedAt:at}};
  const d={category:'assembly',riskFlags:['faces_or_reflections'],imageReviews:[screen]},set=[{sha256:hash,width:1,height:1}];
  const result=context.annalsPhotoDecision_(s,d,'a'.repeat(64),{eligible:false,reason:'material_uncertainty'},set);assert.equal(result.eligible,true);assert.equal(result.entry.photos.length,1);assert.equal(result.entry.eventPeriod,'');
  for(const risk of [{childrenOrGuests:true},{kind:'document_or_text'}])assert.equal(context.annalsPhotoDecision_(s,{...d,imageReviews:[{...screen,...risk}]},'a'.repeat(64),{eligible:false,reason:'material_uncertainty'},set).eligible,false);
});
