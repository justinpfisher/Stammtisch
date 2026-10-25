import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildPublishedAnnals, contentDigest, validatePublicTextEntry, verifyApproval, verifyPublicApproval, verifyPublicRemoval } from '../scripts/annals/ApprovedRenderer.mjs';
import { renderHistory } from '../scripts/annals/HistoryPublisher.mjs';
import { prepareApprovedBundle } from '../scripts/annals/prepare-publication.mjs';
import { applyApprovedEntry } from '../scripts/annals/apply-approved-entry.mjs';
const require = createRequire(import.meta.url);
const core = require('../scripts/annals/ProductionCore.js');
const entry = () => ({ id: 'annal-' + 'a'.repeat(24), category: 'cocktail', title: 'Invented test only', summary: 'Synthetic recipe, not club history.',
  year: 2026, dateLabel: '', sortDate: '', credit: 'anonymous', quoteVerbatim: '',
  recipe: { drinkIngredients: ['1/2 oz syrup', '1 oz water'], syrupIngredients: [], steps: ['Synthetic instruction only.'] } });
const candidate = () => ({ category: 'cocktail', title: 'Invented', summary: 'Synthetic draft', eventDate: '', quoteVerbatim: '',
  recipe: entry().recipe, riskFlags: ['handwriting_ambiguous'],
  interpretation:{intent:'recipe',speakerId:'unknown',evidenceField:'body'} });
const permissions = { publication: true, quotePublication: false, recipeVerified: true, namedAttribution: false, photoPublication: false };
const photoJpeg = () => Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCgEQf/2Q==','base64');
const iter = items => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
function mock() {
  const owner = 'owner@example.test', files = new Map(), calls = { ai: 0 }, logs = [],
    props = { ANNALS_OWNER_EMAIL: owner, ANNALS_PRODUCTION_FOLDER_ID: 'PRIVATE-ID', ANNALS_AI_ENABLED: 'true',
      ANNALS_OPENAI_API_KEY: 'PRIVATE-TEST-KEY', ANNALS_APPROVAL_KEY: 's'.repeat(40),
      ANNALS_BUDGET_LEDGER: JSON.stringify({ schemaVersion: 1, month: '2026-10', reservedCents: 0 }) };
  const privateMethods = { getUrl: () => 'https://drive.google.com/drive/folders/synthetic-private', getSharingAccess: () => 'PRIVATE', getEditors: () => [], getViewers: () => [], getOwner: () => ({ getEmail: () => owner }) };
  const folder = { ...privateMethods,
    getFiles: () => iter([...files.values()]),
    getFilesByName: name => iter(files.has(name) ? [files.get(name)] : []),
    createFile(name, data) { if (name && typeof name === 'object' && name.getName) { data = name; name = data.getName(); }
      const f = { ...privateMethods, getName: () => name,
        getMimeType: () => typeof data === 'string' ? 'text/plain' : 'image/jpeg',
        getSize: () => typeof data === 'string' ? Buffer.byteLength(data) : data.getBytes().length,
        getBlob: () => ({ getDataAsString: () => typeof data === 'string' ? data : '', getBytes: () => typeof data === 'string' ? [...Buffer.from(data)] : data.getBytes() }),
        setContent: v => { data = v; }, setTrashed: () => {} }; files.set(name, f); return f; } };
  const root = { ...folder, getFoldersByName: () => iter([folder]) };
  class FixedDate extends Date { constructor(...args){super(...(args.length?args:['2026-10-09T00:30:00Z']));} static now(){return new Date('2026-10-09T00:30:00Z').getTime();} }
  const context = { Date: FixedDate, console: { log: x => logs.push(x) }, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k,v) => {props[k]=v}, deleteProperty: k => { delete props[k] } }) },
    Session: { getActiveUser: () => ({ getEmail: () => owner }), getEffectiveUser: () => ({ getEmail: () => owner }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: { getUserCache: () => ({ get: k => k === 'annals.valid' ? '1' : null }) },
    DriveApp: { Access: { PRIVATE: 'PRIVATE' }, getFolderById: () => root },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, formatDate: () => '2026-10',
      computeDigest: (_,v) => [...createHash('sha256').update(typeof v === 'string' ? v : Buffer.from(v)).digest()],
      base64Decode: value => [...Buffer.from(value,'base64')], base64Encode: value => Buffer.from(value).toString('base64'),
      newBlob: (value,type,name) => {const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value);return{getBytes:()=>[...bytes],getName:()=>name||'blob'};},
      computeHmacSha256Signature: (v,k) => [...createHmac('sha256',k).update(v).digest()] },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    UrlFetchApp: { fetch(url, options) {
      calls.ai++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(JSON.parse(props.ANNALS_BUDGET_LEDGER).reservedCents, 10);
      assert.ok(files.has('ai-attempt-private.json'));
      assert.equal(options.followRedirects, false);
      assert.equal(JSON.parse(options.payload).store, false);
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ status: 'completed', output: [{ type:'message', content:[{type:'output_text',text:JSON.stringify(candidate())}]}] }) };
    } }
  };
  vm.createContext(context);
  vm.runInContext(['PilotCore.js','ProductionCore.js','AutoCore.js','MediaCore.js','MediaPolicy.js','PublicDisplay.js','HistoryCore.js','GovernanceCore.js','HistoryProduction.gs','Production.gs'].map(name=>readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8')).join('\n'),context);
  folder.createFile('source-private.json', JSON.stringify({source:{subject:'Offline fixture',excerpt:'Source evidence only.',receivedAt:'2026-10-09T00:00:00Z'},attachmentManifest:{items:[]}}));
  return { context, props, files, folder, root, calls, logs };
}
test('AI and public contracts retain literal fractions and match approved renderer canonical digest', () => {
  assert.equal(core.candidate(candidate()).recipe.drinkIngredients[0], '1/2 oz syrup');
  assert.ok(core.candidate(candidate()).riskFlags.includes('handwriting_ambiguous'));
  assert.ok(!core.candidate(candidate()).riskFlags.includes('recipe_unverified'));
  assert.deepEqual(core.publicEntry(entry()), validatePublicTextEntry(entry()));
  assert.equal(createHash('sha256').update(core.serial(core.publicEntry(entry()))).digest('hex'), contentDigest(entry()));
  for (const extra of ['sender','publicationApproved','media']) assert.throws(()=>core.publicEntry({...entry(),[extra]:'private'}));
  assert.throws(()=>core.candidate({...candidate(),publicationApproved:true}));
});
test('the production review model and public renderer support artefacts without treating them as recipes', () => {
  const artefact = { id: 'annal-' + 'b'.repeat(24), category: 'artefact', title: 'A test keepsake',
    summary: 'A fictional keepsake for validation.', year: 2026, dateLabel: '', sortDate: '',
    credit: 'anonymous', quoteVerbatim: '', recipe: { drinkIngredients: [], syrupIngredients: [], steps: [] } };
  assert.equal(core.publicEntry(artefact).category, 'artefact');
  assert.throws(() => core.publicEntry({ ...artefact, recipe: entry().recipe }), /Unexpected recipe/);
  const ui = readFileSync(new URL('../scripts/annals/ReviewUi.html', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /option value="artefact"|option value="monthly_gathering"/);
});
test('review UI never silently converts uncategorised AI output into club history', () => {
  const ui = readFileSync(new URL('../scripts/annals/ReviewUi.html', import.meta.url), 'utf8');
  assert.match(ui, /<option value="" selected>Choose a category<\/option>/);
  assert.match(ui, /includes\(d\.category\)\?d\.category:/);
  assert.match(ui, /if\(!val\('category'\)\)throw new Error\('Choose a category/);
  assert.doesNotMatch(ui, /d\.category==='uncategorised'\?'club_history'/);
});
test('review UI correction and removal buttons require exact review evidence and private backend gates', () => {
  const ui = readFileSync(new URL('../scripts/annals/ReviewUi.html', import.meta.url), 'utf8');
  for (const control of ['saveCorrection','approveCorrection','approveRemoval','correctionPublication','correctionReviewed','removalConfirmed']) assert.match(ui,new RegExp('id="'+control+'"'));
  assert.match(ui,/call\('annalsSaveCorrection'/);assert.match(ui,/call\('annalsApproveCorrection'/);assert.match(ui,/call\('annalsApproveRemoval'/);
  assert.match(ui,/GitHub's permanent commit history may still retain old content/);
});
test('budget admits at most fifty ten-cent attempts, never refunds uncertainty, rolls month safely', () => {
  let ledger={schemaVersion:1,month:'2026-10',reservedCents:0};
  for(let i=0;i<50;i++) ledger=core.reserve(ledger,'2026-10');
  assert.equal(ledger.reservedCents,500);assert.throws(()=>core.reserve(ledger,'2026-10'));
  assert.equal(core.reserve(ledger,'2026-11').reservedCents,10);
  for(const bad of [null,{}, {...ledger,reservedCents:-1},{...ledger,reservedCents:'0'}])assert.throws(()=>core.reserve(bad,'2026-10'));
  assert.throws(()=>core.reserve(ledger,'2026-09'));
});
test('AI request has no tools, remote URLs or publication controls; rejects excessive sources and incomplete/refusal output', () => {
  const source='EMAIL SUBJECT (original field):\nKen: A fictional remark.\n\nEMAIL BODY (original field):\n';
  const req=core.request(source,[]);
  assert.equal(req.store,false);assert.equal(req.model,'gpt-4.1-mini-2025-04-14');assert.equal(req.max_output_tokens,4000);
  assert.equal(req.tools,undefined);assert.equal(req.input[0].content[0].text,source);
  assert.equal(core.candidate({...candidate(),category:'quotation',quoteVerbatim:'A fictional remark.',
    recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},
    interpretation:{intent:'direct_quote',speakerId:'ken',evidenceField:'subject'}}).interpretation.speakerId,'ken');
  assert.throws(()=>core.candidate({...candidate(),category:'quotation',quoteVerbatim:'A guess.',
    recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},interpretation:{intent:'direct_quote',speakerId:'ghost',evidenceField:'subject'}}));
  assert.throws(()=>core.request('a'.repeat(12001),[]));assert.throws(()=>core.request('',[]));
  assert.throws(()=>core.request('test',[{mime:'image/jpeg',base64:'https://bad.example'}]));
  for(const status of ['incomplete','failed'])assert.throws(()=>core.response({status,output:[]}));
  assert.throws(()=>core.response({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}));
});
test('non-quotation response instructions match the strict quote-field gate and retain private holds', () => {
  const source = 'An invented attribution was rejected; this is only an offline contract fixture.';
  const rejectedAttribution = { category: 'uncategorised', title: 'Invented attribution',
    summary: 'No authentic remark is established by this fictional fixture.', eventDate: '',
    quoteVerbatim: 'A pretend line used only by an offline contract test.',
    recipe: { drinkIngredients: [], syrupIngredients: [], steps: [] },
    riskFlags: ['attribution_unconfirmed', 'other_uncertainty'],
    interpretation: { intent: 'other', speakerId: 'unknown', evidenceField: 'body' } };
  const response = raw => ({ status: 'completed', output: [{ type: 'message',
    content: [{ type: 'output_text', text: JSON.stringify(raw) }] }] });
  const request = core.request(source, []);
  assert.match(request.instructions, /When category is quotation, preserve quoteVerbatim exactly as submitted/);
  assert.match(request.instructions, /When category is not quotation, including uncategorised, return quoteVerbatim as an empty string/);
  assert.throws(() => core.response(response(rejectedAttribution), false), /Unexpected quotation/);
  const held = core.response(response({ ...rejectedAttribution, quoteVerbatim: '' }), false);
  assert.equal(held.category, 'uncategorised');
  assert.equal(held.interpretation.speakerId, 'unknown');
  assert.deepEqual(held.riskFlags, rejectedAttribution.riskFlags);
  const automatic = require('../scripts/annals/AutoCore.js');
  const decision = automatic.propose({ senderAuthenticated: true, aiConsentActive: true,
    autoConsentAtReceipt: true, source: { subject: '', excerpt: source,
      receivedAt: '2026-10-10T12:00:00.000Z' },
    attachmentManifest: { held: false, items: [] } }, held, 'e'.repeat(64));
  assert.equal(decision.eligible, false);
  assert.equal(decision.entry, undefined);
});

test('every private UI operation rejects a blank or different owner identity and expired session', () => {
  const x=mock();x.context.Session.getActiveUser=()=>({getEmail:()=>''});
  assert.throws(()=>x.context.annalsReviewItem('valid','a'.repeat(64)),/Owner/);
  assert.equal(x.calls.ai,0);
  assert.throws(()=>core.owner('other@example.test','owner@example.test','owner@example.test'));
  const y=mock();assert.throws(()=>y.context.annalsPrepareDraft('expired','a'.repeat(64),'Synthetic',[],true),/Reload/);
});
test('sender authentication requires an aligned Google-reported DKIM or DMARC pass', () => {
  const x=mock(), message=header=>({getRawContent:()=>`Authentication-Results: ${header}\r\n\r\nbody`});
  assert.equal(x.context.annalsAuthentication_(message('mx.google.com; dkim=pass header.d=member.example; dmarc=pass header.from=member.example'),'member@member.example'),true);
  assert.equal(x.context.annalsAuthentication_(message('mx.google.com; dkim=pass header.i=@member.example header.s=google; dmarc=pass header.from=member.example'),'member@member.example'),true);
  assert.equal(x.context.annalsAuthentication_(message('mx.google.com; dkim=pass header.d=attacker.example; dmarc=fail header.from=member.example'),'member@member.example'),false);
  assert.equal(x.context.annalsAuthentication_(message('attacker.example; dkim=pass header.d=member.example'),'member@member.example'),false);
  assert.equal(x.context.annalsAuthentication_({getRawContent:()=> 'Authentication-Results: attacker.example; dkim=pass header.d=member.example\r\nAuthentication-Results: mx.google.com; dmarc=pass header.from=member.example\r\n\r\nbody'},'member@member.example'),false);
  assert.equal(x.context.annalsAuthentication_({},'member@member.example'),false);
});
test('Porkbun forwarding preserves unique aligned Google authentication and rejects ambiguous headers', () => {
  const x=mock(), sender='member@member.example';
  const route='Received: from fwd1.porkbun.com (fwd1.porkbun.com [192.0.2.1])\r\n\tby mx.google.com with ESMTPS; example';
  const google='Authentication-Results: mx.google.com; dkim=pass header.d=member.example';
  const forwarder='Authentication-Results: fwd1.porkbun.com; dkim=pass header.d=member.example';
  const accepts=(headers)=>x.context.annalsAuthentication_({getRawContent:()=>headers.join('\r\n')+'\r\n\r\nbody'},sender);
  assert.equal(accepts([route,google,forwarder]),true);
  assert.equal(accepts([route,google.replace('; ', ';\r\n\t'),forwarder]),true);
  assert.equal(accepts([google,forwarder]),false);
  assert.equal(accepts([route.replace('from fwd1.porkbun.com','from attacker.example'),google,forwarder]),false);
  assert.equal(accepts([route,forwarder,google]),false);
  assert.equal(accepts([route,google,google]),false);
  assert.equal(accepts([route,google,forwarder,forwarder]),false);
  assert.equal(accepts([route,google,forwarder.replace('fwd1.porkbun.com','attacker.example')]),false);
  assert.equal(accepts([route,google.replace('dkim=pass','dkim=fail'),forwarder]),false);
  assert.equal(accepts([route,google.replace('member.example','attacker.example'),forwarder]),false);
  assert.equal(accepts([google.replace('mx.google.com','attacker.example mx.google.com')]),false);
  assert.equal(accepts([route.replace('from fwd1.porkbun.com','from attacker.example'),route,google,forwarder]),false);
});
test('one-time private consent challenge activates only on exact reply and can be revoked', () => {
  const x=mock(), sent=[];x.props.ANNALS_ALLOWED_SENDERS='member@example.test';x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...args)=>sent.push(args)};
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{'member@example.test':{status:'pending',scope:'future_text_ai_drafting',challenge:'opaque-token'}}}));
  assert.equal(x.context.annalsHandleConsentReply_('member@example.test','I CONSENT TO PRIVATE AI DRAFTING FOR FUTURE TEXT SUBMISSIONS. CODE: wrong'),null);
  assert.equal(x.context.annalsHandleConsentReply_('member@example.test','I CONSENT TO PRIVATE AI DRAFTING FOR FUTURE TEXT SUBMISSIONS. CODE: opaque-token'),'consent_activated');
  assert.equal(x.context.annalsConsentActive_('member@example.test'),true);
  x.props.ANNALS_ALLOWED_SENDERS='';assert.equal(x.context.annalsConsentActive_('member@example.test'),false);
  x.props.ANNALS_ALLOWED_SENDERS='member@example.test';
  assert.equal(x.context.annalsHandleConsentReply_('member@example.test','REVOKE ANNALS AI PROCESSING'),'consent_revoked');
  assert.equal(x.context.annalsConsentActive_('member@example.test'),false);assert.equal(sent.length,2);
  assert.doesNotMatch(JSON.stringify(sent),/opaque-token/);
});
test('automatic drafting rejects quoted or contact-bearing text but allows plain cocktail notes', () => {
  const x=mock();
  assert.equal(x.context.annalsSafeTextForAutoAi_('1/2 oz syrup and 1 oz juice.'),true);
  for(const unsafe of ['Email me at member@example.test','> quoted private note','From: member@example.test','Call 416-555-1212','--\nPrivate signature'])assert.equal(x.context.annalsSafeTextForAutoAi_(unsafe),false);
});
test('empty submissions stay held and image-only AI source requires an active image-processing grant',()=>{
  const x=mock();
  const empty={source:{subject:'',excerpt:''},attachmentManifest:{items:[]}};
  assert.equal(x.context.annalsHasAiSource_(empty),false);
  const image={...empty,attachmentManifest:{items:[{mime:'image/jpeg'}]}};
  assert.equal(x.context.annalsHasAiSource_(image),false);
  image.imageConsentAtReceipt=true;
  assert.equal(x.context.annalsHasAiSource_(image),true);
  const subjectOnly={source:{subject:'A complete fictional observation.',excerpt:''},attachmentManifest:{items:[]}};
  assert.equal(x.context.annalsHasAiSource_(subjectOnly),true);
});
test('drafting needs explicit consent, disabled AI never calls provider, reservation precedes network and repeats do not spend', () => {
  const x=mock(), id='a'.repeat(64);
  assert.throws(()=>x.context.annalsPrepareDraft('valid',id,'Synthetic',[],false));assert.equal(x.calls.ai,0);
  x.props.ANNALS_AI_ENABLED='false';assert.throws(()=>x.context.annalsPrepareDraft('valid',id,'Synthetic',[],true));assert.equal(x.calls.ai,0);
  x.props.ANNALS_AI_ENABLED='true';assert.equal(x.context.annalsPrepareDraft('valid',id,'Synthetic',[],true).drafted,true);
  assert.throws(()=>x.context.annalsPrepareDraft('valid',id,'Synthetic',[],true));assert.equal(x.calls.ai,1);
  assert.equal(JSON.parse(x.props.ANNALS_BUDGET_LEDGER).reservedCents,10);
});
test('provider timeout stays reserved without any automatic retry or leaked provider exception', () => {
  const x=mock();x.context.UrlFetchApp.fetch=()=>{x.calls.ai++;throw new Error('PRIVATE-TEST-KEY and raw email')};
  assert.throws(()=>x.context.annalsPrepareDraft('valid','a'.repeat(64),'Synthetic',[],true),error=>!/PRIVATE|raw email/.test(error.message));
  assert.throws(()=>x.context.annalsPrepareDraft('valid','a'.repeat(64),'Synthetic',[],true));
  assert.equal(x.calls.ai,1);assert.equal(JSON.parse(x.props.ANNALS_BUDGET_LEDGER).reservedCents,10);
  assert.equal(x.files.has('draft-private.json'),false);assert.deepEqual(x.logs,[]);
  const outcome=JSON.parse(x.files.get('ai-outcome-private.json').getBlob().getDataAsString());
  assert.deepEqual(Object.keys(outcome).sort(),['at','reason','state']);assert.equal(outcome.reason,'network_error');
});
test('provider HTTP failure records only its numeric status in private staging', () => {
  const x=mock();x.context.UrlFetchApp.fetch=()=>{x.calls.ai++;return {getResponseCode:()=>401,getContentText:()=> 'PRIVATE-KEY and provider response'};};
  assert.throws(()=>x.context.annalsPrepareDraft('valid','a'.repeat(64),'Synthetic',[],true),error=>!/PRIVATE-KEY|provider response/.test(error.message));
  const outcome=JSON.parse(x.files.get('ai-outcome-private.json').getBlob().getDataAsString());
  assert.equal(outcome.reason,'provider_http_error');assert.equal(outcome.httpStatus,401);
  assert.doesNotMatch(JSON.stringify(outcome),/PRIVATE-KEY|provider response/);
  assert.equal(x.files.has('draft-private.json'),false);assert.equal(x.calls.ai,1);
});
test('one-time synthetic integration item writes fiction privately without Gmail or AI', () => {
  const x=mock(), created=new Set();x.props.ANNALS_AI_ENABLED='false';x.files.delete('source-private.json');
  x.root.getFoldersByName=name=>iter(created.has(name)?[x.folder]:[]);
  x.root.createFolder=name=>{created.add(name);return x.folder;};
  const result=x.context.annalsCreateSyntheticCheckItem();
  assert.equal(result.created,true);assert.equal(result.automaticAi,false);assert.equal(result.publishesAnything,false);
  assert.equal(x.calls.ai,0);
  const source=JSON.parse(x.files.get('source-private.json').getBlob().getDataAsString());
  assert.match(source.source.subject,/Synthetic production integration check/);
  assert.match(source.source.excerpt,/not a real contribution and has no publication permission/);
  assert.equal(source.senderAuthenticated,false);
  assert.throws(()=>x.context.annalsCreateSyntheticCheckItem(),/already exists/);
  assert.equal(x.calls.ai,0);
});
test('shared staging and exhausted budget stop before provider call', () => {
  const x=mock();x.root.getViewers=()=>['other'];assert.throws(()=>x.context.annalsPrepareDraft('valid','a'.repeat(64),'Synthetic',[],true));assert.equal(x.calls.ai,0);
  const y=mock();y.props.ANNALS_BUDGET_LEDGER=JSON.stringify({schemaVersion:1,month:'2026-10',reservedCents:500});assert.throws(()=>y.context.annalsPrepareDraft('valid','a'.repeat(64),'Synthetic',[],true));assert.equal(y.calls.ai,0);
});
test('approval needs exact saved revision, recipe consent and evidence; private signer interoperates with public renderer', () => {
  const x=mock(), id='a'.repeat(64), first=x.context.annalsSaveReview('valid',id,entry());
  const second=x.context.annalsSaveReview('valid',id,{...entry(),title:'Revised synthetic'});
  assert.throws(()=>x.context.annalsApproveReview('valid',id,first.hash,permissions,'Synthetic consent record',true));
  assert.throws(()=>x.context.annalsApproveReview('valid',id,second.hash,{...permissions,recipeVerified:false},'Synthetic consent record',true));
  assert.throws(()=>x.context.annalsApproveReview('valid',id,second.hash,permissions,'',true));
  assert.equal(x.context.annalsApproveReview('valid',id,second.hash,permissions,'Synthetic consent record',true).published,false);
  const savedApproval=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
  const bundle=JSON.parse(JSON.stringify({entries:[savedApproval.entry],receipts:[savedApproval.receipt]}));
  assert.equal(verifyApproval(bundle.entries[0],bundle.receipts[0],x.props.ANNALS_APPROVAL_KEY),true);
  const publicationKey='p'.repeat(40),publicApproval=x.context.annalsPublicApproval_(bundle.entries[0],bundle.receipts[0],publicationKey);
  assert.equal(verifyPublicApproval(bundle.entries[0],publicApproval,publicationKey),true);
  assert.throws(()=>x.context.annalsSaveReview('valid',id,entry()));
  const prepared=prepareApprovedBundle(bundle,{entries:[]},x.props.ANNALS_APPROVAL_KEY);
  assert.equal(prepared.count,1);assert.doesNotMatch(prepared.html,/owner@example|signature|Synthetic consent record/);
  const missing={...entry(),id:'missing-existing'};assert.throws(()=>prepareApprovedBundle(bundle,{entries:[missing]},x.props.ANNALS_APPROVAL_KEY));
  bundle.entries[0].summary='Changed after approval';assert.throws(()=>prepareApprovedBundle(bundle,{entries:[]},x.props.ANNALS_APPROVAL_KEY));
});
test('corrections and removals require the exact published entry and dispatch separately signed operations', () => {
  const configurePublisher = x => {
    Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_TOKEN:'private-token',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
    const dispatches=[];
    x.context.UrlFetchApp.fetch=(url,options)=>{assert.equal(url,'https://api.github.com/repos/owner/repo/dispatches');dispatches.push(JSON.parse(options.payload));return{getResponseCode:()=>204};};
    return dispatches;
  };
  const x=mock(), dispatches=configurePublisher(x), id='a'.repeat(64);
  let review=x.context.annalsSaveReview('valid',id,entry());
  assert.equal(x.context.annalsApproveReview('valid',id,review.hash,permissions,'Synthetic original approval evidence',true).dispatchAccepted,true);
  const published=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
  assert.equal(published.publicationState,'dispatch_accepted');
  const corrected={...entry(),title:'Corrected synthetic title',summary:'Exact corrected synthetic text.'};
  review=x.context.annalsSaveCorrection('valid',id,corrected);
  assert.throws(()=>x.context.annalsApproveCorrection('valid',id,'0'.repeat(64),permissions,'Synthetic correction evidence',true));
  assert.equal(x.context.annalsApproveCorrection('valid',id,review.hash,permissions,'Synthetic correction evidence',true).dispatchAccepted,true);
  const correction=JSON.parse(x.files.get('correction-approval-private.json').getBlob().getBlob?.() || x.files.get('correction-approval-private.json').getBlob().getDataAsString());
  assert.equal(verifyPublicApproval(correction.entry,correction.publication,'p'.repeat(40)),true);
  assert.equal(dispatches[1].event_type,'annals-correct-entry');
  assert.equal(x.context.annalsApproveRemoval('valid',id,contentDigest(correction.entry),'Synthetic withdrawal after correction',true).dispatchAccepted,true);
  const correctedRemoval=JSON.parse(x.files.get('removal-private.json').getBlob().getDataAsString());
  assert.equal(verifyPublicRemoval(correction.entry,correctedRemoval.proof,'p'.repeat(40)),true);
  assert.equal(dispatches[2].event_type,'annals-remove-entry');

  const y=mock(), removalDispatches=configurePublisher(y), removalId='b'.repeat(64);
  review=y.context.annalsSaveReview('valid',removalId,{...entry(),id:'annal-'+removalId.slice(0,24)});
  assert.equal(y.context.annalsApproveReview('valid',removalId,review.hash,permissions,'Synthetic original approval evidence',true).dispatchAccepted,true);
  const original=JSON.parse(y.files.get('approval-private.json').getBlob().getDataAsString());
  assert.throws(()=>y.context.annalsApproveRemoval('valid',removalId,'0'.repeat(64),'Synthetic removal reason',true));
  assert.equal(y.context.annalsApproveRemoval('valid',removalId,contentDigest(original.entry),'Synthetic removal reason',true).dispatchAccepted,true);
  const removal=JSON.parse(y.files.get('removal-private.json').getBlob().getDataAsString());
  assert.equal(verifyPublicRemoval(original.entry,removal.proof,'p'.repeat(40)),true);
  assert.equal(removalDispatches[1].event_type,'annals-remove-entry');
});
test('photo derivatives are revalidated in private storage and require separate exact publication consent', () => {
  const x=mock(), id='a'.repeat(64), bytes=photoJpeg(), base64=bytes.toString('base64');
  const stored=x.context.annalsSavePhotoDerivative('valid',id,base64);
  const clean=Buffer.from(x.context.AnnalsMedia.sanitize([...bytes]).bytes),canonical=clean.toString('base64');
  assert.ok(stored.size<bytes.length,'JFIF metadata is removed before signing');
  assert.equal(stored.size,clean.length);
  assert.equal(x.context.annalsPhotoDerivative_(x.folder).base64,canonical);
  const withPhoto={...entry(),photo:{sha256:stored.sha256,alt:'Synthetic cocktail only'}};
  const review=x.context.annalsSaveReview('valid',id,withPhoto);
  assert.throws(()=>x.context.annalsApproveReview('valid',id,review.hash,permissions,'Synthetic image consent evidence',true));
  Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_TOKEN:'private-token',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
  let payload;
  x.context.UrlFetchApp.fetch=(url,options)=>{payload=JSON.parse(options.payload);return{getResponseCode:()=>204};};
  const consent={...permissions,photoPublication:true};
  assert.equal(x.context.annalsApproveReview('valid',id,review.hash,consent,'Synthetic photographer and exact image approval record',true).dispatchAccepted,true);
  assert.equal(payload.event_type,'annals-approved-entry');assert.equal(payload.client_payload.imageBase64,canonical);
  const bad=mock();assert.throws(()=>bad.context.annalsSavePhotoDerivative('valid',id,Buffer.from('not a JPEG').toString('base64')));
});
test('existing signed text cocktail accepts a distinct screened photo through exact one-time correction',()=>{
  const x=mock(),id='a'.repeat(64),events=[];
  Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_TOKEN:'fictional',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
  x.context.UrlFetchApp.fetch=(_url,options)=>{
    events.push(JSON.parse(options.payload));
    return {getResponseCode:()=>204};
  };
  const initial=x.context.annalsSaveReview('valid',id,entry());
  assert.equal(x.context.annalsApproveReview('valid',id,initial.hash,permissions,'Fictional source permission',true).dispatchAccepted,true);
  const original=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
  const saved=x.context.annalsSavePhotoDerivative('valid',id,photoJpeg().toString('base64'));
  const corrected={...original.entry,photo:{sha256:saved.sha256,alt:'A fictional orange glass'}};
  const preview=x.context.annalsSaveCorrection('valid',id,corrected);
  assert.throws(()=>x.context.annalsApproveCorrection('valid',id,preview.hash,permissions,'Fictional image rights',true));
  const consent={...permissions,photoPublication:true};
  assert.equal(x.context.annalsApproveCorrection('valid',id,preview.hash,consent,'Fictional scoped photographed glass permission',true).dispatchAccepted,true);
  const record=JSON.parse(x.files.get('correction-approval-private.json').getBlob().getDataAsString());
  assert.equal(record.entry.id,original.entry.id);
  assert.equal(record.entry.photo.sha256,saved.sha256);
  assert.equal(record.publicationState,'dispatch_accepted');
  assert.equal(verifyPublicApproval(record.entry,record.publication,'p'.repeat(40)),true);
  assert.equal(events.length,2);
  assert.equal(events[0].event_type,'annals-approved-entry');
  assert.equal(events[1].event_type,'annals-correct-entry');
  assert.equal(events[1].client_payload.entry.photo.sha256,saved.sha256);
  assert.equal(events[1].client_payload.imageBase64,x.context.annalsPhotoDerivative_(x.folder).base64);
  assert.equal(x.files.has('correction-dispatch-private.json'),true);
  assert.equal(x.files.has('ai-attempt-private.json'),false);
});

test('photo-only correction reuses already signed recipe and illustration permissions without weakening image scope',()=>{
  const x=mock(),id='a'.repeat(64),events=[];
  Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_TOKEN:'fictional',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
  x.context.UrlFetchApp.fetch=(_url,options)=>{events.push(JSON.parse(options.payload));return{getResponseCode:()=>204};};
  x.context.annalsContributorPortrait_=()=> 'marc';
  const originalEntry={...entry(),contributorPortrait:'marc'};
  const originalConsents={...permissions,namedAttribution:true};
  const originalReview=x.context.annalsSaveReview('valid',id,originalEntry);
  assert.equal(x.context.annalsApproveReview('valid',id,originalReview.hash,originalConsents,
    'Fictional signed recipe and portrait rights',true).dispatchAccepted,true);
  const approval=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
  assert.equal(approval.receipt.consents.recipeVerified,true);
  assert.equal(approval.receipt.consents.namedAttribution,true);
  assert.equal(approval.receipt.consents.photoPublication,false);
  const derivative=x.context.annalsSavePhotoDerivative('valid',id,photoJpeg().toString('base64'));
  const photo={sha256:derivative.sha256,alt:'A fictional drink in a glass'};
  const correction=x.context.annalsSaveCorrection('valid',id,{...approval.entry,photo});
  const hiddenUiConsents={publication:true,quotePublication:false,recipeVerified:false,
    namedAttribution:false,photoPublication:true};
  assert.equal(x.context.annalsApproveCorrection('valid',id,correction.hash,hiddenUiConsents,
    'Fictional owner review of only the screened image',true).dispatchAccepted,true);
  const saved=JSON.parse(x.files.get('correction-approval-private.json').getBlob().getDataAsString());
  assert.equal(saved.receipt.consents.recipeVerified,true);
  assert.equal(saved.receipt.consents.namedAttribution,true);
  assert.equal(saved.receipt.consents.photoPublication,true);
  assert.deepEqual(saved.entry.recipe,approval.entry.recipe);
  assert.equal(saved.entry.summary,approval.entry.summary);
  assert.equal(saved.entry.contributorPortrait,'marc');
  assert.equal(saved.entry.photo.sha256,derivative.sha256);
  assert.equal(verifyPublicApproval(saved.entry,saved.publication,'p'.repeat(40)),true);
  assert.equal(events.length,2);
  assert.equal(events[1].event_type,'annals-correct-entry');
  assert.equal(events[1].client_payload.imageBase64,
    x.context.annalsPhotoDerivative_(x.folder).base64);
});
test('signed prior permissions cannot cover modified recipe text or missing new photo permission',()=>{
  const fixture=()=>{
    const x=mock(),id='a'.repeat(64);
    Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
      ANNALS_GITHUB_TOKEN:'fictional',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
    x.context.UrlFetchApp.fetch=()=>({getResponseCode:()=>204});
    x.context.annalsContributorPortrait_=()=> 'marc';
    const review=x.context.annalsSaveReview('valid',id,{...entry(),contributorPortrait:'marc'});
    x.context.annalsApproveReview('valid',id,review.hash,
      {...permissions,namedAttribution:true},'Fictional original signed rights',true);
    const signed=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
    const photo=x.context.annalsSavePhotoDerivative('valid',id,photoJpeg().toString('base64'));
    return {x,id,signed,photo:{sha256:photo.sha256,alt:'Fictional cocktail photograph'}};
  };
  {
    const {x,id,signed,photo}=fixture();
    const preview=x.context.annalsSaveCorrection('valid',id,{...signed.entry,photo,
      summary:'This is a modified fictional summary.'});
    assert.throws(()=>x.context.annalsApproveCorrection('valid',id,preview.hash,
      {publication:true,quotePublication:false,recipeVerified:false,namedAttribution:false,photoPublication:true},
      'Fictional review requiring fresh recipe rights',true));
    assert.equal(x.files.has('correction-approval-private.json'),false);
  }
  {
    const {x,id,signed,photo}=fixture();
    const preview=x.context.annalsSaveCorrection('valid',id,{...signed.entry,photo});
    assert.throws(()=>x.context.annalsApproveCorrection('valid',id,preview.hash,
      {publication:true,quotePublication:false,recipeVerified:false,namedAttribution:false,photoPublication:false},
      'Fictional image rights not approved',true));
    assert.equal(x.files.has('correction-approval-private.json'),false);
  }
});
test('owner can import one already screened private-item JPEG without a browser picker or a new dispatch',()=>{
  const x=mock(),id='a'.repeat(64),events=[];
  Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_TOKEN:'fictional',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
  x.context.UrlFetchApp.fetch=(_url,options)=>{events.push(JSON.parse(options.payload));return{getResponseCode:()=>204};};
  const method=x.context.annalsImportScreenedPhotoFromPrivateItem;
  assert.throws(()=>method('valid',id),'an unsigned source must not be imported');
  const initial=x.context.annalsSaveReview('valid',id,entry());
  assert.equal(x.context.annalsApproveReview('valid',id,initial.hash,permissions,'Fictional permission',true).dispatchAccepted,true);
  x.folder.createFile('attachment-01.jpg',x.context.Utilities.newBlob(photoJpeg(),'image/jpeg','attachment-01.jpg'));
  assert.throws(()=>method('valid',id),'unscreened original is not a candidate');
  x.folder.createFile('fictional-screened-candidate.jpg',x.context.Utilities.newBlob(photoJpeg(),'image/jpeg','fictional-screened-candidate.jpg'));
  assert.throws(()=>method('invalid',id),'only an authenticated owner desk may import');
  const saved=method('valid',id);
  const expected=Buffer.from(x.context.AnnalsMedia.sanitize([...photoJpeg()]).bytes);
  assert.equal(saved.saved,true);
  assert.equal(saved.size,expected.length);
  assert.equal(saved.sha256,createHash('sha256').update(expected).digest('hex'));
  assert.equal(x.context.annalsPhotoDerivative_(x.folder).base64,expected.toString('base64'));
  assert.equal(events.length,1,'private import must not publish anything');
  assert.equal(x.files.has('correction-dispatch-private.json'),false);
  assert.throws(()=>method('valid',id),'repeat import must not overwrite the chosen derivative');
  const published=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
  const corrected={...published.entry,photo:{sha256:saved.sha256,alt:'Fictional glass only'}};
  const review=x.context.annalsSaveCorrection('valid',id,corrected);
  assert.throws(()=>x.context.annalsApproveCorrection('valid',id,review.hash,permissions,'Fictional image permission',true));
  const rights={...permissions,photoPublication:true};
  assert.equal(x.context.annalsApproveCorrection('valid',id,review.hash,rights,'Fictional exact image and depiction permission',true).dispatchAccepted,true);
  assert.equal(events.length,2);
  assert.equal(events[1].event_type,'annals-correct-entry');
  assert.equal(events[1].client_payload.imageBase64,expected.toString('base64'));
  assert.equal(x.files.has('ai-attempt-private.json'),false);
  assert.throws(()=>method('valid',id),'signed corrections are one-time');
});
test('picker-free private JPEG import rejects duplicate, oversized, invalid, or wrongly named candidates',()=>{
  const createApproved=()=>{
    const x=mock(),id='a'.repeat(64);
    Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
      ANNALS_GITHUB_TOKEN:'fictional',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
    x.context.UrlFetchApp.fetch=()=>({getResponseCode:()=>204});
    const review=x.context.annalsSaveReview('valid',id,entry());
    x.context.annalsApproveReview('valid',id,review.hash,permissions,'Fictional permission',true);
    return {x,id};
  };
  const add=(x,name,contents)=>x.folder.createFile(name,contents);
  {
    const {x,id}=createApproved();
    add(x,'one-screened-candidate.jpg',x.context.Utilities.newBlob(photoJpeg(),'image/jpeg','one-screened-candidate.jpg'));
    add(x,'two-screened-candidate.jpg',x.context.Utilities.newBlob(photoJpeg(),'image/jpeg','two-screened-candidate.jpg'));
    assert.throws(()=>x.context.annalsImportScreenedPhotoFromPrivateItem('valid',id));
    assert.equal(x.files.has('photo-derivative-private.jpg'),false);
  }
  {
    const {x,id}=createApproved();
    add(x,'one-screened-candidate.jpg',Buffer.from('not jpeg').toString());
    assert.throws(()=>x.context.annalsImportScreenedPhotoFromPrivateItem('valid',id));
    assert.equal(x.files.has('photo-derivative-private.jpg'),false);
  }
  {
    const {x,id}=createApproved();
    const bigger=Buffer.concat([photoJpeg(),Buffer.alloc(40000)]);
    add(x,'one-screened-candidate.jpg',x.context.Utilities.newBlob(bigger,'image/jpeg','one-screened-candidate.jpg'));
    assert.throws(()=>x.context.annalsImportScreenedPhotoFromPrivateItem('valid',id));
    assert.equal(x.files.has('photo-derivative-private.jpg'),false);
  }
});
test('picker-free private image option retains the same approval, checksum and rights controls',()=>{
  const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
  assert.match(ui,/id="importPrivatePhoto"/);
  assert.match(ui,/call\('annalsImportScreenedPhotoFromPrivateItem',nonce,current.id\)/);
  assert.match(ui,/call\('annalsSaveCorrection'/);
  assert.match(ui,/call\('annalsApproveCorrection'/);
  assert.match(ui,/photoDerivative.sha256!==saved.sha256/);
});
test('Apps Script media digest uses Byte[] overload and preserves UTF-8 string hashing',()=>{
  const x=mock(), id='a'.repeat(64), original=x.context.Utilities.computeDigest, invocations=[];
  x.context.Utilities.computeDigest=(...args)=>{
    const value=args[1], textual=typeof value==='string';
    assert.equal(args.length,textual?3:2,'Apps Script has no Byte[] plus Charset overload');
    if(!textual)assert.ok(Array.isArray(value),'media hash must receive raw byte values');
    invocations.push(textual?'text':'bytes');
    return original(...args);
  };
  assert.equal(x.context.annalsHash_('synthetic text'),
    createHash('sha256').update('synthetic text').digest('hex'));
  assert.equal(x.context.annalsHash_([...photoJpeg()]),
    createHash('sha256').update(photoJpeg()).digest('hex'),
    'the shared helper must also hash binary bytes from other photo modules');
  const metadata=x.context.annalsSavePhotoDerivative('valid',id,photoJpeg().toString('base64'));
  const canonical=Buffer.from(x.context.AnnalsMedia.sanitize([...photoJpeg()]).bytes);
  assert.equal(metadata.sha256,createHash('sha256').update(canonical).digest('hex'));
  assert.equal(x.context.annalsPhotoDerivative_(x.folder).base64,canonical.toString('base64'));
  assert.deepEqual(invocations,['text','bytes','bytes','bytes']);
});
test('previously stored matching private JPEG can receive missing manifest without replacing pixels',()=>{
  const x=mock(),id='a'.repeat(64),events=[];
  Object.assign(x.props,{ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_TOKEN:'fictional',ANNALS_GITHUB_REPOSITORY:'owner/repo'});
  x.context.UrlFetchApp.fetch=(_url,options)=>{
    events.push(JSON.parse(options.payload));
    return {getResponseCode:()=>204};
  };
  const original=x.context.annalsSaveReview('valid',id,entry());
  assert.equal(x.context.annalsApproveReview('valid',id,original.hash,permissions,
    'Synthetic original permissions',true).dispatchAccepted,true);
  const input=photoJpeg(),clean=Buffer.from(x.context.AnnalsMedia.sanitize([...input]).bytes);
  x.folder.createFile('fixture-screened-candidate.jpg',
    x.context.Utilities.newBlob(input,'image/jpeg','fixture-screened-candidate.jpg'));
  x.folder.createFile('photo-derivative-private.jpg',
    x.context.Utilities.newBlob(clean,'image/jpeg','photo-derivative-private.jpg'));
  const before=x.files.get('photo-derivative-private.jpg');
  assert.equal(x.files.has('photo-derivative-private.json'),false);
  const saved=x.context.annalsImportScreenedPhotoFromPrivateItem('valid',id);
  assert.equal(saved.reconciled,true);
  assert.equal(saved.size,clean.length);
  assert.equal(saved.sha256,createHash('sha256').update(clean).digest('hex'));
  assert.strictEqual(x.files.get('photo-derivative-private.jpg'),before);
  const manifest=JSON.parse(x.files.get('photo-derivative-private.json').getBlob().getDataAsString());
  assert.equal(manifest.sha256,saved.sha256);
  assert.equal(x.context.annalsPhotoDerivative_(x.folder).base64,clean.toString('base64'));
  assert.equal(events.length,1,'manifest recovery must not publish');
  assert.equal(x.files.has('correction-dispatch-private.json'),false);
  assert.throws(()=>x.context.annalsImportScreenedPhotoFromPrivateItem('valid',id));
});
test('production intake resumes a long thread and wraps without reading while disabled', () => {
  const x=mock(), handled=[], messages=Array.from({length:12},(_,id)=>({id,getId:()=>String(id)})),seen=new Set();
  const thread={getId:()=> 'private-thread', getMessages:()=>messages};
  x.context.GmailApp={getInboxThreads:(offset)=>offset===0?[thread]:[],getThreadById:()=>thread};
  x.context.annalsStageProduction_=m=>{handled.push(m.id);if(seen.has(m.id))return 'duplicates';seen.add(m.id);return 'staged'};
  assert.equal(x.context.runAnnalsProductionIntake().enabled,false);assert.equal(handled.length,0);
  Object.assign(x.props,{ANNALS_PRODUCTION_INTAKE_ENABLED:'true',ANNALS_AI_ENABLED:'true',ANNALS_OPENAI_API_KEY:'test',ANNALS_BUDGET_LEDGER:'{}',ANNALS_GITHUB_TOKEN:'test',ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_REPOSITORY:'owner/repo',ANNALS_REVIEW_URL:'https://script.google.com/macros/s/test/exec',ANNALS_ALLOWED_SENDERS:'sender@example.test',ANNALS_ACTIVATED_AT:'2026-10-08T23:00:00Z'});
  x.root.getFolders=()=>iter([]);
  assert.equal(x.context.runAnnalsProductionIntake().staged,12);
  assert.equal(x.context.runAnnalsProductionIntake().staged,0);
  assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i));
  x.context.runAnnalsProductionIntake();assert.equal(x.props.ANNALS_INBOX_CURSOR,undefined);
});
test('old and unknown messages are skipped before body reads and production intake copies no aggregate-oversize attachments', () => {
  const x=mock();x.files.delete('source-private.json');let bodyReads=0,copies=0;
  const m={getId:()=> 'invented',getFrom:()=> 'unknown@example.test',getDate:()=>new Date('2026-10-08T23:30:00Z'),getSubject:()=> 'Synthetic recipe',getPlainBody:()=>{bodyReads++;return 'Invented 1/2 oz syrup'},getAttachments:()=>[0,1,2].map(()=>({getContentType:()=> 'image/jpeg',getSize:()=>8388608,copyBlob:()=>{copies++;throw new Error('Must not copy')}}))};
  const activation=Date.parse('2026-10-08T23:00:00Z');
  assert.equal(x.context.annalsStageProduction_(m,activation,['sender@example.test']),'skipped');assert.equal(bodyReads,0);
  m.getFrom=()=> 'sender@example.test';assert.equal(x.context.annalsStageProduction_(m,Date.parse('2026-10-09T00:00:00Z'),['sender@example.test']),'skipped');assert.equal(bodyReads,0);
  assert.equal(x.context.annalsStageProduction_(m,activation,['sender@example.test']),'unverified');assert.equal(copies,0);
  assert.equal(x.context.annalsStageProduction_(m,activation,['sender@example.test']),'duplicates');assert.equal(bodyReads,1);
});
test('schedule installation is idempotent and stopping touches only the production intake handler', () => {
  const x=mock(), triggers=[{getHandlerFunction:()=> 'unrelatedHandler'}];
  x.context.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyMinutes:minutes=>({create:()=>{assert.equal(minutes,15);triggers.push({getHandlerFunction:()=>name})}})})}),deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1)};
  assert.throws(()=>x.context.annalsInstallIntakeSchedule());
  Object.assign(x.props,{ANNALS_PRODUCTION_INTAKE_ENABLED:'true',ANNALS_AI_ENABLED:'true',ANNALS_OPENAI_API_KEY:'test',ANNALS_BUDGET_LEDGER:'{}',ANNALS_GITHUB_TOKEN:'test',ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_REPOSITORY:'owner/repo',ANNALS_REVIEW_URL:'https://script.google.com/macros/s/test/exec',ANNALS_ACTIVATED_AT:'2026-10-08T23:00:00Z',ANNALS_ALLOWED_SENDERS:'sender@example.test'});
  x.context.annalsInstallIntakeSchedule();x.context.annalsInstallIntakeSchedule();assert.equal(triggers.length,2);
  x.context.annalsStopProduction();assert.equal(triggers.length,1);assert.equal(triggers[0].getHandlerFunction(),'unrelatedHandler');
  assert.equal(x.props.ANNALS_AI_ENABLED,'false');assert.equal(x.props.ANNALS_PRODUCTION_INTAKE_ENABLED,'false');
});


test('member standing consent is separate from AI consent, receipt-dated and independently revocable', () => {
  const x=mock(), sent=[], sender='member1@example.test';
  x.props.ANNALS_ALLOWED_SENDERS=['member1','member2','member3','member4','member5','member6'].map(n=>n+'@example.test').join(',');
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...args)=>sent.push(args)};
  const registry={schemaVersion:1,members:{
    [sender]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T18:00:00Z',
      autoPublication:{status:'pending',scope:'future_source_grounded_text_publication',challenge:'private-code',invitedAt:'2026-10-08T20:00:00Z'}}
  }};
  x.folder.createFile('consent-registry-private.json',JSON.stringify(registry));
  assert.equal(x.context.annalsStandingPublicationActive_(sender,'2026-10-09T00:31:00Z'),false);
  assert.equal(x.context.annalsHandleConsentReply_(sender,'I CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT PUBLICATION. CODE: wrong'),null);
  assert.equal(x.context.annalsHandleConsentReply_(sender,'I CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT PUBLICATION. CODE: private-code'),'auto_consent_activated');
  assert.equal(x.context.annalsStandingPublicationActive_(sender,'2026-10-09T00:29:00Z'),false);
  assert.equal(x.context.annalsStandingPublicationActive_(sender,'2026-10-09T00:31:00Z'),true);
  assert.equal(x.context.annalsHandleConsentReply_(sender,'I CONSENT TO AUTOMATIC PUBLIC ANNALS TEXT PUBLICATION. CODE: private-code'),null);
  assert.equal(x.context.annalsHandleConsentReply_(sender,'REVOKE ANNALS AUTOMATIC PUBLICATION'),'auto_consent_revoked');
  assert.equal(x.context.annalsStandingPublicationActive_(sender,'2026-10-09T00:31:00Z'),false);
  assert.equal(sent.length,2);
  assert.doesNotMatch(JSON.stringify(sent),/private-code/);
});

test('only a separate signed standing-consent proof permits unattended text dispatch, never repeats', () => {
  const x=mock(), id='a'.repeat(64), sender='member1@example.test', dispatches=[];
  Object.assign(x.props, {
    ANNALS_ALLOWED_SENDERS:['member1','member2','member3','member4','member5','member6'].map(n=>n+'@example.test').join(','),
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_GITHUB_TOKEN:'invented-test-token',
    ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_ACTIVATED_AT:'2026-10-08T23:00:00Z'
  });
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{
    [sender]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-07T00:00:00Z',
      autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-08T00:00:00Z'}}
  }}));
  const source={senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,requiresClarification:false,
    source:{sender,subject:'Fictional Test Mule',
      excerpt:'Fictional Test Mule\n1 oz invented syrup\n2 oz imaginary juice\nStir the invented liquids.',
      receivedAt:'2026-10-09T00:30:00Z'},attachmentManifest:{held:false,items:[]}};
  const candidate={category:'cocktail',title:'Fictional Test Mule',summary:'Fictional test drink',eventDate:'',
    quoteVerbatim:'',riskFlags:[],recipe:{drinkIngredients:['1 oz invented syrup','2 oz imaginary juice'],
      syrupIngredients:[],steps:['Stir the invented liquids.']}};
  x.folder.createFile('source-private.json',JSON.stringify(source));
  x.folder.createFile('draft-private.json',JSON.stringify(candidate));
  x.context.UrlFetchApp.fetch=(url,options)=>{
    assert.equal(url,'https://api.github.com/repos/justinpfisher/Stammtisch/dispatches');
    dispatches.push(JSON.parse(options.payload));
    return {getResponseCode:()=>204};
  };
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(dispatches.length,1);
  assert.equal(dispatches[0].event_type,'annals-auto-entry');
  const p=dispatches[0].client_payload;
  assert.equal(p.approval.mode,'standing-consent-text-v1');
  assert.equal(verifyPublicApproval(p.entry,p.approval,'p'.repeat(40)),true);
  assert.ok(p.entry.summary.includes('invented syrup'));
  assert.equal(p.entry.credit,'anonymous');
  assert.doesNotMatch(JSON.stringify(p),/member1|consentedAt|sourceId|private-code|owner@example/);
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(dispatches.length,1); // reserved one-shot dispatch marker
  assert.equal(JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString()).approvalMode,'standing-consent-text-v1');
});

test('live reconciliation verifies matching public archive and deployed page without re-dispatch', () => {
  const x=mock(), id='a'.repeat(64), sender='member1@example.test', mail=[];
  Object.assign(x.props,{ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_GITHUB_TOKEN:'dummy',
    ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_ACTIVATED_AT:'2026-10-08T23:00:00Z',
    ANNALS_ALLOWED_SENDERS:['member1','member2','member3','member4','member5','member6'].map(n=>n+'@example.test').join(',')});
  x.folder.getName=()=>id;x.root.getFolders=()=>iter([x.folder]);x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...args)=>mail.push(args)};
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{
    [sender]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z',
      autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-08T01:00:00Z'}}}}));
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,
    autoConsentAtReceipt:true,requiresClarification:false,source:{sender,subject:'Test Mule',
      excerpt:'Test Mule\n1 oz syrup\n1 oz juice\nStir.',receivedAt:'2026-10-09T00:30:00Z'},
    attachmentManifest:{items:[],held:false}}));
  x.folder.createFile('draft-private.json',JSON.stringify({category:'cocktail',title:'Test Mule',summary:'Test',
    eventDate:'',quoteVerbatim:'',riskFlags:[],recipe:{drinkIngredients:['1 oz syrup','1 oz juice'],syrupIngredients:[],steps:['Stir.']}}));
  let dispatchCount=0;
  x.context.UrlFetchApp.fetch=(url)=>{
    if(url.includes('/dispatches')){dispatchCount++;return{getResponseCode:()=>204}}
    const saved=JSON.parse(x.files.get('approval-private.json').getBlob().getDataAsString());
    if(url.includes('raw.githubusercontent.com'))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({schemaVersion:1,entries:[saved.entry],approvals:[saved.publication]})};
    if(url.includes('stammtischbrewery.com'))return {getResponseCode:()=>200,getContentText:()=>'<article id="'+saved.entry.id+'"></article>'};
    throw new Error('Unexpected test URL');
  };
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(x.context.annalsVerifyAutomaticPublications_(3),1);
  assert.equal(JSON.parse(x.files.get('auto-live-verification-private.json').getBlob().getDataAsString()).state,'verified_live');
  assert.equal(x.context.annalsVerifyAutomaticPublications_(3),0);
  assert.equal(mail.length,1);
  assert.equal(dispatchCount,1);
});

test('empty inbox still resumes one private AI draft with no nested script-lock acquisition', () => {
  const x=mock(), id='a'.repeat(64), sender='member@example.test';
  let lockHeld=false;
  x.context.LockService.getScriptLock=()=>({tryLock(){if(lockHeld)return false;lockHeld=true;return true},releaseLock(){lockHeld=false}});
  Object.assign(x.props,{ANNALS_PRODUCTION_INTAKE_ENABLED:'true',ANNALS_AI_ENABLED:'true',
    ANNALS_GITHUB_TOKEN:'dummy',ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_REVIEW_URL:'https://script.google.com/macros/s/invented/exec',
    ANNALS_ALLOWED_SENDERS:sender,ANNALS_ACTIVATED_AT:'2026-10-08T00:00:00Z'});
  x.context.GmailApp={getInboxThreads:()=>[]};x.folder.getName=()=>id;x.root.getFolders=()=>iter([x.folder]);
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail(){}};
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{
    [sender]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z'}}}));
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,
    autoConsentAtReceipt:false,requiresClarification:false,
    source:{sender,subject:'Fictional recipe',excerpt:'1 oz invented syrup and 1 oz juice.',excerptTruncated:false,receivedAt:'2026-10-09T00:00:00Z'},
    attachmentManifest:{held:false,items:[]}}));
  const resume=x.context.annalsResumeConsentedDrafts_;
  x.context.annalsResumeConsentedDrafts_=limit=>{assert.equal(limit,2);return resume(limit);};
  assert.equal(x.context.runAnnalsProductionIntake().drafted,1);
  assert.equal(x.calls.ai,1);
  assert.equal(lockHeld,false);
  assert.equal(x.files.has('draft-private.json'),true);
});


test('one malformed private draft is held without blocking other intake or exposing an exception',()=>{
  const x=mock(),id='a'.repeat(64);
  x.context.annalsAutoPublishCandidate_=()=>{throw new Error('INVENTED private email content')};
  assert.equal(x.context.annalsAutoAttemptSafe_(x.folder,id),false);
  assert.equal(x.context.annalsAutoAttemptSafe_(x.folder,id),false);
  const record=JSON.parse(x.files.get('auto-decision-private.json').getBlob().getDataAsString());
  assert.equal(record.state,'held');
  assert.equal(record.reason,'internal_validation_error');
  assert.doesNotMatch(JSON.stringify(record),/INVENTED private email content/);
});

test('stale unverified publication privately alerts once and never re-dispatches',()=>{
  const x=mock(),id='a'.repeat(64),sent=[];
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...args)=>sent.push(args)};
  x.props.ANNALS_AUTO_PUBLICATION_ENABLED='true';
  x.props.ANNALS_REVIEW_URL='https://script.google.com/macros/s/invented/exec';
  x.folder.getName=()=>id;
  x.root.getFolders=()=>iter([x.folder]);
  x.folder.createFile('approval-private.json',JSON.stringify({
    entry:entry(),approvalMode:'standing-consent-text-v1',publicationState:'dispatch_accepted',
    receipt:{approvedAt:'2026-10-07T00:00:00Z',contentSha256:'a'.repeat(64)}
  }));
  x.context.UrlFetchApp.fetch=()=>({getResponseCode:()=>404});
  assert.equal(x.context.annalsVerifyAutomaticPublications_(3),0);
  assert.equal(x.context.annalsVerifyAutomaticPublications_(3),0);
  assert.equal(sent.length,1);
  assert.equal(sent[0][0],'owner@example.test');
  assert.equal(JSON.parse(x.files.get('auto-publication-delay-private.json').getBlob().getDataAsString()).state,
    'unverified_after_24h');
});


test('owner can privately record six already-obtained member permissions without fabricated email challenges',()=>{
  const x=mock(), sent=[];
  const approved=Array.from({length:6},(_,i)=>'member'+(i+1)+'@example.test');
  x.props.ANNALS_ALLOWED_SENDERS=approved.join(',');
  x.props.ANNALS_AI_ENABLED='false';
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...args)=>sent.push(args)};
  const evidence='I personally verified affirmative, revocable individual consent in a private conversation.';
  assert.throws(()=>x.context.annalsRecordVerifiedExistingConsents('valid',false,evidence),/Operation held/);
  assert.throws(()=>x.context.annalsRecordVerifiedExistingConsents('valid',true,'short'),/Operation held/);
  const outcome=x.context.annalsRecordVerifiedExistingConsents('valid',true,evidence);
  assert.equal(outcome.recorded,true);
  assert.equal(outcome.memberCount,6);
  assert.equal(outcome.activationChanged,false);
  assert.equal(sent.length,6);
  assert.ok(sent.every(item=>/revoke/i.test(item[2])));
  const registry=JSON.parse(x.files.get('consent-registry-private.json').getBlob().getDataAsString());
  assert.deepEqual(Object.keys(registry.members).sort(),approved);
  for(const address of approved){
    const member=registry.members[address];
    assert.equal(member.status,'active');
    assert.equal(member.scope,'future_text_ai_drafting');
    assert.equal(member.source,'owner_attested_prior_direct_permission');
    assert.equal(member.autoPublication.status,'active');
    assert.equal(member.autoPublication.scope,'future_source_grounded_text_and_screened_image_publication');
    assert.equal(member.autoPublication.source,'owner_attested_prior_direct_permission');
    assert.equal('challenge' in member,false);
    assert.equal(x.context.annalsStandingPublicationActive_(address,'2026-10-09T00:31:00.000Z'),true);
    assert.equal(x.context.annalsImageConsentActive_(address,'2026-10-09T00:31:00.000Z'),true);
  }
  const marker=JSON.parse(x.files.get('verified-existing-consents-private.json').getBlob().getDataAsString());
  assert.equal(marker.memberCount,6);
  assert.equal(marker.state,'consent_attested_and_recorded');
  assert.equal(marker.method,'owner_attested_previous_individual_permissions');
  assert.equal(marker.privateEvidenceNote,evidence);
  assert.equal(x.props.ANNALS_AI_ENABLED,'false');
  assert.notEqual(x.props.ANNALS_PRODUCTION_INTAKE_ENABLED,'true');
  assert.notEqual(x.props.ANNALS_AUTO_PUBLICATION_ENABLED,'true');
  assert.notEqual(x.props.ANNALS_AUTO_MEDIA_ENABLED,'true');
  assert.throws(()=>x.context.annalsRecordVerifiedExistingConsents('valid',true,evidence),/Operation held/);
});
test('owner-attested prior permissions cannot override revocation, missing allowlist or active intake',()=>{
  const addresses=Array.from({length:6},(_,i)=>'member'+(i+1)+'@example.test');
  const evidence='I personally verified direct consent from all six members without copying their messages.';
  const a=mock();a.props.ANNALS_AI_ENABLED='false';
  a.props.ANNALS_ALLOWED_SENDERS=addresses.slice(0,5).join(',');
  assert.throws(()=>a.context.annalsRecordVerifiedExistingConsents('valid',true,evidence),/Operation held/);
  const b=mock();b.props.ANNALS_AI_ENABLED='false';b.props.ANNALS_ALLOWED_SENDERS=addresses.join(',');
  b.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{
    [addresses[2]]:{status:'revoked',scope:'future_text_ai_drafting',revokedAt:'2026-10-08T21:00:00Z'}
  }}));
  assert.throws(()=>b.context.annalsRecordVerifiedExistingConsents('valid',true,evidence),/Operation held/);
  assert.equal(b.files.has('verified-existing-consents-private.json'),false);
  const c=mock();c.props.ANNALS_ALLOWED_SENDERS=addresses.join(',');
  assert.throws(()=>c.context.annalsRecordVerifiedExistingConsents('valid',true,evidence),/Operation held/);
  assert.equal(c.files.has('consent-registry-private.json'),false);
});

test('Register of Remarks uses the spoken member, not the email submitter, and requires scoped private permission',()=>{
  const x=mock(),id='a'.repeat(64),names=['fish','marc','matt','ken','jamie','jerome'],
    addresses=names.map((_,i)=>'member'+(i+1)+'@example.test');
  Object.assign(x.props,{
    ANNALS_ALLOWED_SENDERS:addresses.join(','),
    ANNALS_SPEAKER_IDENTITIES:JSON.stringify(Object.fromEntries(addresses.map((a,i)=>[a,names[i]]))),
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_GITHUB_TOKEN:'synthetic-token',
    ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_ACTIVATED_AT:'2026-10-08T00:00:00Z'
  });
  const members=Object.fromEntries(addresses.map((address,i)=>[address,{
    status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-08T00:00:00Z'},
    ...(i===3 ? {quoteAttribution:{status:'active',scope:'future_attributed_member_quotation_publication',consentedAt:'2026-10-09T00:00:00Z'}} : {})
  }]));
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members}));
  const source={senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{sender:addresses[1],subject:'Register of Remarks',
      excerpt:'Ken said: "We should have brought a map."',
      receivedAt:'2026-10-10T15:00:00Z'},
    attachmentManifest:{items:[],held:false}};
  const draft={category:'quotation',title:'Register of Remarks',summary:'',
    quoteVerbatim:'We should have brought a map.',riskFlags:['quote_consent_unconfirmed'],
    interpretation:{intent:'direct_quote',speakerId:'ken',evidenceField:'body'},
    recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]}};

  x.folder.createFile('source-private.json',JSON.stringify(source));
  x.folder.createFile('draft-private.json',JSON.stringify(draft));
  const granted=x.context.annalsQuoteSpeakerPermission_(source,draft);
  assert.equal(granted.speakerPortrait,'ken');
  const dispatches=[];
  x.context.UrlFetchApp.fetch=(url,options)=>{dispatches.push(JSON.parse(options.payload));return{getResponseCode:()=>204};};
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(dispatches.length,1);
  const publicItem=dispatches[0].client_payload;
  assert.equal(publicItem.entry.speakerPortrait,'ken'); // actual speaker, not Marc the contributor
  assert.equal(publicItem.entry.contributorPortrait,undefined);
  assert.equal(publicItem.entry.credit,'anonymous');
  assert.equal(publicItem.approval.mode,'standing-consent-quote-v1');
  assert.equal(publicItem.approval.consents.namedAttribution,true);
  assert.equal(verifyPublicApproval(publicItem.entry,publicItem.approval,'p'.repeat(40)),true);
  assert.doesNotMatch(JSON.stringify(publicItem),/member2|member4|@example.test|source-private/);
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(dispatches.length,1);
  // Old email received before the speaker's grant cannot claim the likeness.
  const older={...source,source:{...source.source,receivedAt:'2026-10-08T12:00:00Z'}};
  assert.equal(x.context.annalsQuoteSpeakerPermission_(older,draft),null);
});
test('owner recovery reassesses only the saved held quotation, makes no AI call and dispatches once',()=>{
  const x=mock(),names=['fish','marc','matt','ken','jamie','jerome'],
    addresses=names.map((_,i)=>'member'+(i+1)+'@example.test'),id='d'.repeat(64),dispatches=[];
  Object.assign(x.props,{ANNALS_ALLOWED_SENDERS:addresses.join(','),
    ANNALS_SPEAKER_IDENTITIES:JSON.stringify(Object.fromEntries(addresses.map((a,i)=>[a,names[i]]))),
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_GITHUB_TOKEN:'synthetic-token',
    ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_ACTIVATED_AT:'2026-10-08T00:00:00Z'});
  const members=Object.fromEntries(addresses.map((address,i)=>[address,{
    status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-07T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-08T00:00:00Z'},
    ...(i===3?{quoteAttribution:{status:'active',scope:'future_attributed_member_quotation_publication',consentedAt:'2026-10-08T00:00:00Z'}}:{})
  }]));
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members}));
  const source={sourceId:id,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{sender:addresses[1],subject:'Register of Remarks',excerpt:'Ken said: “A fictional map is optional.”',
      receivedAt:'2026-10-09T15:00:00Z'},attachmentManifest:{items:[],held:false}};
  const savedDraft={category:'quotation',title:'Register of Remarks',summary:'',eventDate:'',
    quoteVerbatim:'A fictional map is optional.',riskFlags:['quote_consent_unconfirmed'],
    interpretation:{intent:'direct_quote',speakerId:'ken',evidenceField:'body'},
    recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]}};
  x.folder.createFile('source-private.json',JSON.stringify(source));
  x.folder.createFile('draft-private.json',JSON.stringify(savedDraft));
  x.folder.createFile('ai-attempt-private.json',JSON.stringify({state:'completed',privateOnly:true}));
  const originalHold={state:'held',reason:'quotation_not_verbatim_or_speaker_unknown',at:'2026-10-09T15:01:00Z'};
  x.folder.createFile('auto-decision-private.json',JSON.stringify(originalHold));
  x.context.UrlFetchApp.fetch=(url,options)=>{
    assert.equal(url,'https://api.github.com/repos/justinpfisher/Stammtisch/dispatches');
    dispatches.push(JSON.parse(options.payload));return {getResponseCode:()=>204};
  };
  const result=x.context.annalsReassessHeldQuote('valid',id,true);
  assert.equal(x.calls.ai,0);
  assert.equal(result.aiCall,false);
  assert.equal(result.dispatchAccepted,true);
  assert.equal(dispatches.length,1);
  assert.equal(dispatches[0].event_type,'annals-auto-entry');
  assert.equal(dispatches[0].client_payload.approval.mode,'standing-consent-quote-v1');
  assert.equal(JSON.parse(x.files.get('auto-decision-private.json').getBlob().getDataAsString()).reason,originalHold.reason);
  assert.equal(JSON.parse(x.files.get('auto-reassessment-private.json').getBlob().getDataAsString()).state,'eligible');
  assert.equal(JSON.parse(x.files.get('reassessment-attempt-private.json').getBlob().getDataAsString()).state,'dispatch_accepted');
  assert.throws(()=>x.context.annalsReassessHeldQuote('valid',id,true),/Operation held/);
  assert.equal(dispatches.length,1);
});

test('speaker quote permission can be registered once by owner without activating anything; revocation blocks later publication',()=>{
  const x=mock(),emails=[],names=['fish','marc','matt','ken','jamie','jerome'],
    addresses=names.map((_,i)=>'member'+(i+1)+'@example.test'),members={};
  Object.assign(x.props,{ANNALS_AI_ENABLED:'false',ANNALS_AUTO_PUBLICATION_ENABLED:'false',
    ANNALS_ALLOWED_SENDERS:addresses.join(','),
    ANNALS_SPEAKER_IDENTITIES:JSON.stringify(Object.fromEntries(addresses.map((a,i)=>[a,names[i]])))});
  addresses.forEach(address=>members[address]={
    status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-07T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-07T00:00:00Z'}
  });
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members}));
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...args)=>emails.push(args)};
  assert.throws(()=>x.context.annalsRecordVerifiedQuotePermissions('valid',false,'owner testimony for each member'),/Operation held/);
  assert.equal(x.files.has('verified-quote-speaker-consents-private.json'),false);
  const done=x.context.annalsRecordVerifiedQuotePermissions('valid',true,'Evidence personally verified outside public GitHub for all six speakers.');
  assert.equal(done.speakerCount,6);
  assert.equal(done.activationChanged,false);
  assert.equal(x.props.ANNALS_AUTO_PUBLICATION_ENABLED,'false');
  assert.equal(x.context.annalsReviewConsentStatus('valid').every(m=>m.quoteAttributionStatus==='active'),true);
  assert.equal(emails.length,6);
  assert.doesNotMatch(JSON.stringify(emails),/private evidence|@example.test source|code: /i);
  assert.throws(()=>x.context.annalsRecordVerifiedQuotePermissions('valid',true,'Cannot register a second time'),/Operation held/);
  const s={senderAuthenticated:true,source:{sender:addresses[1],
    receivedAt:'2026-10-10T15:00:00Z',excerpt:'Ken: "This is fictional."'}};
  const d={category:'quotation',quoteVerbatim:'This is fictional.',interpretation:{intent:'direct_quote',speakerId:'ken',evidenceField:'body'}};

  assert.equal(x.context.annalsQuoteSpeakerPermission_(s,d).speakerPortrait,'ken');
  assert.equal(x.context.annalsHandleConsentReply_(addresses[3],'REVOKE ANNALS QUOTE ATTRIBUTION'),'quote_attribution_revoked');
  assert.equal(x.context.annalsQuoteSpeakerPermission_(s,d),null);
  assert.equal(x.context.annalsReviewConsentStatus('valid')[3].quoteAttributionStatus,'revoked');
});
test('private source controls reject incorrect member speaker and only allow exact-source speaker rights',()=>{
  const x=mock(),names=['fish','marc','matt','ken','jamie','jerome'],
    addresses=names.map((_,i)=>'member'+(i+1)+'@example.test');
  Object.assign(x.props,{ANNALS_ALLOWED_SENDERS:addresses.join(','),
    ANNALS_SPEAKER_IDENTITIES:JSON.stringify(Object.fromEntries(addresses.map((a,i)=>[a,names[i]])))});
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{
    [addresses[3]]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-07T00:00:00Z',
      autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-07T00:00:00Z'},
      quoteAttribution:{status:'active',scope:'future_attributed_member_quotation_publication',consentedAt:'2026-10-09T00:00:00Z'}}
  }}));
  const source={senderAuthenticated:true,source:{sender:addresses[1],
    receivedAt:'2026-10-10T15:00:00Z',excerpt:'Ken said: "This is a test."'}};
  const d={category:'quotation',quoteVerbatim:'This is a test.',interpretation:{intent:'direct_quote',speakerId:'ken',evidenceField:'body'}};

  assert.equal(x.context.annalsQuoteSpeakerPermission_(source,d).speakerPortrait,'ken');
  assert.equal(x.context.annalsQuoteSpeakerPermission_(source,{...d,quoteVerbatim:'This is a guess.'}),null);
  assert.equal(x.context.annalsQuoteSpeakerPermission_({...source,senderAuthenticated:false},d),null);
  const registry=JSON.parse(x.files.get('consent-registry-private.json').getBlob().getDataAsString());
  registry.members[addresses[3]].portraitAttributionDisabled=true;
  x.files.get('consent-registry-private.json').setContent(JSON.stringify(registry));
  assert.equal(x.context.annalsQuoteSpeakerPermission_(source,d),null);
});



test('only a verified allowlisted sender with prior private attribution permission earns an Annals portrait',()=>{
  const x=mock(),names=['fish','marc','matt','ken','jamie','jerome'];
  const addresses=names.map((n,i)=>'person'+(i+1)+'@example.test');
  const sender=addresses[0];
  x.props.ANNALS_ALLOWED_SENDERS=addresses.join(',');
  x.props.ANNALS_SPEAKER_IDENTITIES=JSON.stringify(Object.fromEntries(
    addresses.map((addr,i)=>[addr,names[i]])));
  const member={status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',
      consentedAt:'2026-10-08T00:00:00Z'},
    quoteAttribution:{status:'active',scope:'future_attributed_member_quotation_publication',
      consentedAt:'2026-10-08T00:00:00Z'},
    contributorPortraitPublication:{status:'active',scope:'future_illustrated_contributor_identification',
      consentedAt:'2026-10-08T00:00:00Z'}};
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{[sender]:member}}));
  const original={senderAuthenticated:true,source:{sender,receivedAt:'2026-10-09T00:30:00Z',
    excerpt:'1 oz water',subject:'Invented cocktail'}};
  assert.equal(x.context.annalsContributorPortrait_(original),'fish');
  assert.equal(x.context.annalsContributorPortrait_({...original,senderAuthenticated:false}),null);
  assert.equal(x.context.annalsContributorPortrait_({...original,source:{...original.source,sender:addresses[1]}}),null);
  assert.equal(x.context.annalsContributorPortrait_({...original,source:{...original.source,
    receivedAt:'2026-10-07T00:30:00Z'}}),null);
  const saved=JSON.parse(x.props.ANNALS_SPEAKER_IDENTITIES);
  x.props.ANNALS_SPEAKER_IDENTITIES=JSON.stringify({...saved,[sender]:'marc'});
  assert.equal(x.context.annalsContributorPortrait_(original),null);
  x.props.ANNALS_SPEAKER_IDENTITIES=JSON.stringify(saved);
  const notices=[];
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:(...a)=>notices.push(a)};
  assert.equal(x.context.annalsHandleConsentReply_(sender,'HIDE MY ANNALS PORTRAIT'),'portrait_hidden');
  assert.equal(x.context.annalsContributorPortrait_(original),null);
  assert.equal(x.context.annalsHandleConsentReply_(sender,'SHOW MY ANNALS PORTRAIT'),'portrait_enabled');
  assert.equal(x.context.annalsContributorPortrait_(original),'fish');
  assert.equal(x.context.annalsHandleConsentReply_(sender,'REVOKE ANNALS QUOTE ATTRIBUTION'),'quote_attribution_revoked');
  assert.equal(x.context.annalsContributorPortrait_(original),'fish'); // quote permission is separate
  assert.equal(notices.length,3);
});
test('manual review cannot forge an unrelated contributor likeness',()=>{
  const x=mock(),names=['fish','marc','matt','ken','jamie','jerome'];
  const addresses=names.map((n,i)=>'person'+(i+1)+'@example.test');
  x.props.ANNALS_ALLOWED_SENDERS=addresses.join(',');
  x.props.ANNALS_SPEAKER_IDENTITIES=JSON.stringify(Object.fromEntries(
    addresses.map((addr,i)=>[addr,names[i]])));
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{
    [addresses[0]]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z',
      autoPublication:{status:'active',scope:'future_source_grounded_text_publication',
        consentedAt:'2026-10-08T00:00:00Z'},
      quoteAttribution:{status:'active',scope:'future_attributed_member_quotation_publication',
        consentedAt:'2026-10-08T00:00:00Z'},
    contributorPortraitPublication:{status:'active',scope:'future_illustrated_contributor_identification',
      consentedAt:'2026-10-08T00:00:00Z'}}
  }}));
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,
    source:{sender:addresses[0],receivedAt:'2026-10-09T00:30:00Z',
      excerpt:'Invented.',subject:'Test',excerptTruncated:false},
    attachmentManifest:{items:[]}}));
  const id='a'.repeat(64);
  assert.throws(()=>x.context.annalsSaveReview('valid',id,{...entry(),contributorPortrait:'ken'}),/Operation held/);
  const saved=x.context.annalsSaveReview('valid',id,{...entry(),contributorPortrait:'fish'});
  assert.equal(saved.entry.contributorPortrait,'fish');
  assert.equal(saved.entry.credit,'anonymous');
  assert.equal(x.context.annalsReviewItem('valid',id).contributorPortrait,'fish');
});


test('private contributor portrait permissions require individual owner attestation and never enable publication',()=>{
  const x=mock(),names=['fish','marc','matt','ken','jamie','jerome'];
  const addresses=names.map((name,i)=>'person'+(i+1)+'@example.test');
  x.props.ANNALS_ALLOWED_SENDERS=addresses.join(',');
  x.props.ANNALS_AI_ENABLED='false';
  x.props.ANNALS_SPEAKER_IDENTITIES=JSON.stringify(Object.fromEntries(
    addresses.map((addr,i)=>[addr,names[i]])));
  const members={};
  addresses.forEach(address=>{members[address]={
    status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z',
    autoPublication:{status:'active',scope:'future_source_grounded_text_publication',
      consentedAt:'2026-10-08T00:00:00Z'}
  }});
  x.folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members}));
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail:()=>{}};
  const evidence='Directly confirmed each person gave standing illustrated contributor permission.';
  assert.throws(()=>x.context.annalsRecordVerifiedContributorPortraitPermissions('valid',false,evidence),/Operation held/);
  assert.equal(x.files.has('verified-contributor-portraits-private.json'),false);
  const r=x.context.annalsRecordVerifiedContributorPortraitPermissions('valid',true,evidence);
  assert.equal(r.recorded,true); assert.equal(r.memberCount,6);
  assert.equal(x.props.ANNALS_PRODUCTION_INTAKE_ENABLED,undefined);
  assert.equal(x.props.ANNALS_AUTO_PUBLICATION_ENABLED,undefined);
  const rec=JSON.parse(x.files.get('consent-registry-private.json').getBlob().getDataAsString());
  assert.equal(rec.members[addresses[0]].contributorPortraitPublication.scope,
    'future_illustrated_contributor_identification');
  assert.equal(x.context.annalsProductionPreflight().contributorPortraitConsentsRecorded,true);
  assert.throws(()=>x.context.annalsRecordVerifiedContributorPortraitPermissions('valid',true,evidence),/Operation held/);
});

test('owner-confirmed quarantine preserves source, attempts and budget and blocks future drafting and publishing', () => {
  const { context, props, files, folder, calls } = mock(), id = 'd'.repeat(64);
  const original = files.get('source-private.json').getBlob().getDataAsString();
  const ledger = props.ANNALS_BUDGET_LEDGER;
  assert.throws(() => context.annalsQuarantineSubmission('valid', id, 'Owner identified invented test.', false));
  assert.ok(!files.has('quarantine-private.json'));
  assert.equal(context.annalsQuarantineSubmission('valid', id, 'Owner identified invented test.', true).quarantined, true);
  const audit = files.get('quarantine-private.json').getBlob().getDataAsString();
  assert.equal(context.annalsQuarantineSubmission('valid', id, 'A different reason cannot replace the audit.', true).alreadyRecorded, true);
  assert.equal(files.get('quarantine-private.json').getBlob().getDataAsString(), audit);
  assert.equal(files.get('source-private.json').getBlob().getDataAsString(), original);
  assert.equal(context.annalsProcessConsentedText_(id), false);
  assert.throws(() => context.annalsPrepareDraft('valid', id, 'Invented test.', [], true), /Operation held/);
  props.ANNALS_AUTO_PUBLICATION_ENABLED = 'true';
  props.ANNALS_GITHUB_REPOSITORY = 'justinpfisher/Stammtisch';
  props.ANNALS_GITHUB_TOKEN = 'synthetic-token';
  props.ANNALS_PUBLISH_SIGNING_KEY = 'p'.repeat(40);
  props.ANNALS_ALLOWED_SENDERS = 'one@example.test,two@example.test,three@example.test,four@example.test,five@example.test,six@example.test';
  assert.equal(context.annalsAutoPublishCandidate_(id), false);
  assert.equal(context.annalsAutoPublishCandidate_(id, true), false);
  assert.throws(() => context.annalsReassessHeldQuote('valid', id, true), /Operation held/);
  assert.throws(() => context.annalsDispatchApproved_(folder, entry(), {}, 'annals-auto-entry', 'publication-dispatch-private.json'), /Quarantined/);
  assert.match(context.annalsReviewStatus_(folder, {}, null), /Quarantined/);
  assert.equal(calls.ai, 0);
  assert.equal(props.ANNALS_BUDGET_LEDGER, ledger);
  for (const name of ['ai-attempt-private.json','approval-private.json','publication-dispatch-private.json','reassessment-attempt-private.json']) assert.ok(!files.has(name));
});
test('quarantine requires owner authentication and preserves uncertain publication records', () => {
  const { context, files, folder } = mock(), id = 'e'.repeat(64);
  assert.throws(() => context.annalsQuarantineSubmission('invalid', id, 'Owner identified invented test.', true));
  assert.throws(() => context.annalsQuarantineSubmission('valid', 'bad-id', 'Owner identified invented test.', true));
  folder.createFile('publication-dispatch-private.json', '{"state":"attempt_reserved"}');
  assert.throws(() => context.annalsQuarantineSubmission('valid', id, 'Owner identified invented test.', true), /Operation held/);
  assert.ok(!files.has('quarantine-private.json'));
  assert.equal(files.get('publication-dispatch-private.json').getBlob().getDataAsString(), '{"state":"attempt_reserved"}');
});
test('an unencountered quarantined email is held without staging its body or reserving an AI attempt', () => {
  const { context, files, props } = mock(), id = 'f'.repeat(64);
  files.delete('source-private.json');
  context.annalsQuarantineSubmission('valid', id, 'Owner identified invented test.', true);
  const message = {getId:()=>id,getFrom:()=> 'member@example.test',getDate:()=>new Date('2026-10-10T00:00:00Z'),getSubject:()=> 'Normal subject',getPlainBody:()=>{throw Error('Quarantined body must not be read');}};
  assert.equal(context.annalsStageProduction_(message, Date.parse('2026-10-09T00:00:00Z'), ['member@example.test']), 'held');
  assert.ok(!files.has('source-private.json'));
  assert.ok(!files.has('ai-attempt-private.json'));
  assert.equal(JSON.parse(props.ANNALS_BUDGET_LEDGER).reservedCents, 0);
});


test('invalid provider output is retained privately once, never logged, published or retried', () => {
  const { context, folder, files, props, calls, logs } = mock(), id = 'b'.repeat(64);
  const privateOutput = JSON.stringify({ status:'completed', output:[{type:'message',content:[{type:'output_text',text:'PRIVATE SYNTHETIC INVALID OUTPUT'}]}] });
  context.UrlFetchApp.fetch = () => {calls.ai++; return {getResponseCode:()=>200,getContentText:()=>privateOutput};};
  folder.createFile('source-private.json', JSON.stringify({source:{subject:'Offline fixture',excerpt:'Source evidence only.'},attachmentManifest:{items:[]}}));
  assert.throws(()=>context.annalsPrepareDraft('valid',id,'Synthetic test only.',[],true));
  const evidence = files.get('ai-response-private.json').getBlob().getDataAsString();
  assert.equal(JSON.parse(evidence).responseText, privateOutput);
  assert.equal(JSON.parse(evidence).httpStatus, 200);
  assert.equal(JSON.parse(files.get('ai-outcome-private.json').getBlob().getDataAsString()).reason,'invalid_response');
  assert.ok(!files.has('draft-private.json'));
  assert.ok(!files.has('approval-private.json'));
  assert.ok(!logs.join('').includes('PRIVATE SYNTHETIC INVALID OUTPUT'));
  assert.throws(()=>context.annalsPrepareDraft('valid',id,'Synthetic test only.',[],true));
  assert.equal(calls.ai,1);
  assert.equal(JSON.parse(props.ANNALS_BUDGET_LEDGER).reservedCents,10);
  assert.equal(files.get('ai-response-private.json').getBlob().getDataAsString(),evidence);
});
test('oversized provider response stays held without storing unbounded evidence or retrying', () => {
  const { context, files, props, calls } = mock();
  context.UrlFetchApp.fetch=()=>{calls.ai++;return {getResponseCode:()=>200,getContentText:()=> 'x'.repeat(100001)};};
  assert.throws(()=>context.annalsPrepareDraft('valid','c'.repeat(64),'Synthetic test only.',[],true));
  assert.ok(!files.has('ai-response-private.json'));
  assert.ok(!files.has('draft-private.json'));
  assert.equal(JSON.parse(files.get('ai-outcome-private.json').getBlob().getDataAsString()).reason,'provider_response_too_large');
  assert.equal(calls.ai,1);
  assert.equal(JSON.parse(props.ANNALS_BUDGET_LEDGER).reservedCents,10);
});


test('none image flag is conservatively false only when the request is known to have no images', () => {
  const raw={...candidate(),imageSafety:{kind:'none',safeToPublish:true,altText:''}};
  const response={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]};
  assert.equal(core.response(response,false).imageSafety.safeToPublish,false);
  assert.equal(raw.imageSafety.safeToPublish,true);
  assert.throws(()=>core.response(response,true),/Invalid image review/);
  assert.throws(()=>core.response(response),/Invalid image review/);
  assert.match(core.request('Synthetic text.',[]).instructions,/When no image is provided/);
});
function capturedTextFixture() {
  const state=mock(),{context,props,folder}=state,id='7'.repeat(64),sender='member@example.test';
  props.ANNALS_ALLOWED_SENDERS=sender;
  props.ANNALS_ACTIVATED_AT='2026-10-08T00:00:00Z';
  folder.createFile('consent-registry-private.json',JSON.stringify({schemaVersion:1,members:{[sender]:{status:'active',scope:'future_text_ai_drafting',consentedAt:'2026-10-08T00:00:00Z',autoPublication:{status:'active',scope:'future_source_grounded_text_publication',consentedAt:'2026-10-08T00:00:00Z'}}}}));
  const source={sourceId:id,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,attachmentManifest:{items:[]},source:{sender,subject:'Register of Remarks',excerpt:'My quote: "Synthetic diagnostic only. Not club history."',receivedAt:'2026-10-09T00:00:00Z'}};
  const raw={category:'quotation',title:'Register of Remarks',summary:'Synthetic diagnostic only.',eventDate:'',quoteVerbatim:'Synthetic diagnostic only. Not club history.',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},riskFlags:[],interpretation:{intent:'direct_quote',speakerId:'self',evidenceField:'body'},imageSafety:{kind:'none',safeToPublish:true,altText:''}};
  const responseText=JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]});
  folder.createFile('source-private.json',JSON.stringify(source));
  folder.createFile('ai-attempt-private.json',JSON.stringify({model:core.MODEL,processingConsent:true,submittedText:context.annalsAiSourceText_(source),selectedNames:[]}));
  folder.createFile('ai-outcome-private.json','{"state":"held","reason":"invalid_response"}');
  folder.createFile('ai-response-private.json',JSON.stringify({httpStatus:200,model:core.MODEL,responseText}));
  return {...state,id,source};
}
test('captured no-image repair preserves original evidence and budget and makes no AI or dispatch call', () => {
  const {context,files,props,calls,id}=capturedTextFixture();
  const names=['source-private.json','ai-attempt-private.json','ai-outcome-private.json','ai-response-private.json'];
  const before=names.map(name=>files.get(name).getBlob().getDataAsString()),ledger=props.ANNALS_BUDGET_LEDGER;
  assert.throws(()=>context.annalsRecoverCapturedTextDraft('valid',id,false));
  assert.equal(context.annalsRecoverCapturedTextDraft('valid',id,true).drafted,true);
  assert.equal(JSON.parse(files.get('draft-private.json').getBlob().getDataAsString()).imageSafety.safeToPublish,false);
  assert.equal(JSON.parse(files.get('captured-response-recovery-private.json').getBlob().getDataAsString()).state,'private_draft_recovered');
  assert.deepEqual(names.map(name=>files.get(name).getBlob().getDataAsString()),before);
  assert.equal(props.ANNALS_BUDGET_LEDGER,ledger);
  assert.equal(calls.ai,0);
  assert.ok(!files.has('approval-private.json'));
  assert.ok(!files.has('publication-dispatch-private.json'));
  assert.throws(()=>context.annalsRecoverCapturedTextDraft('valid',id,true));
});
test('captured repair rejects source drift, image inputs, revoked permission, quarantine and prior dispatch', () => {
  for(const block of ['source_drift','image','revoked','quarantine','dispatch']){
    const {context,files,props,folder,id,source}=capturedTextFixture();
    if(block==='source_drift')folder.createFile('source-private.json',JSON.stringify({...source,source:{...source.source,excerpt:'Different words.'}}));
    if(block==='image')folder.createFile('source-private.json',JSON.stringify({...source,attachmentManifest:{items:[{name:'synthetic.jpg'}]}}));
    if(block==='revoked')props.ANNALS_ALLOWED_SENDERS='other@example.test';
    if(block==='quarantine')folder.createFile('quarantine-private.json','{}');
    if(block==='dispatch')folder.createFile('publication-dispatch-private.json','{}');
    assert.throws(()=>context.annalsRecoverCapturedTextDraft('valid',id,true));
    assert.ok(!files.has('draft-private.json'));
    assert.ok(!files.has('captured-response-recovery-private.json'));
  }
});


test('captured repair refuses non-verbatim output, image attempt context and invalid activation boundary', () => {
  for (const block of ['quote_drift','image_context','activation']) {
    const {context,folder,files,props,id}=capturedTextFixture();
    if(block==='quote_drift'){const e=JSON.parse(files.get('ai-response-private.json').getBlob().getDataAsString());const r=JSON.parse(e.responseText);const d=JSON.parse(r.output[0].content[0].text);d.quoteVerbatim='Different invented words.';r.output[0].content[0].text=JSON.stringify(d);e.responseText=JSON.stringify(r);folder.createFile('ai-response-private.json',JSON.stringify(e));}
    if(block==='image_context'){const a=JSON.parse(files.get('ai-attempt-private.json').getBlob().getDataAsString());a.imageInputCount=1;folder.createFile('ai-attempt-private.json',JSON.stringify(a));}
    if(block==='activation')props.ANNALS_ACTIVATED_AT='invalid';
    assert.throws(()=>context.annalsRecoverCapturedTextDraft('valid',id,true));
    assert.ok(!files.has('draft-private.json'));
    assert.ok(!files.has('captured-response-recovery-private.json'));
  }
});


test('diagnostic framing retains its subject category without resolving material safeguards',()=>{
  const fictional='A fictional monthly account about an imaginary umbrella; no actual event is claimed.';
  const req=core.request(fictional,[]);
  assert.match(req.instructions,/classify its stated subject matter while retaining that framing/);
  assert.match(req.instructions,/rather than selecting uncategorised solely because it is not genuine club history/);
  assert.match(req.instructions,/never resolves a denied speaker attribution, uncertain measurement, privacy concern or image dependency/);
  assert.match(req.instructions,/assembly = the separate Annual Gentlemen's Assembly/);
  assert.match(req.instructions,/an invented Assembly menu belongs to assembly/);
  assert.match(req.instructions,/fictional founding custom or hypothetical commemorative badge belongs to club_history/);
  assert.match(req.instructions,/hypothetical commemorative badge belongs to club_history/);
  assert.match(req.text.format.schema.properties.category.description,/independent of whether the account is factual or explicitly fictional/);
  const policy=require('../scripts/annals/AutoCore.js');
  const source={senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{subject:'Fictional monthly account',excerpt:fictional,receivedAt:'2026-10-10T15:00:00Z'},
    attachmentManifest:{held:false,items:[]},requiresClarification:false};
  const d={...candidate(),category:'uncategorised',title:'Fictional monthly account',quoteVerbatim:'',
    interpretation:{intent:'description',speakerId:'unknown',evidenceField:'body'},
    recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},riskFlags:['other_uncertainty']};
  assert.equal(policy.propose(source,d,'e'.repeat(64)).reason,'classification_not_supported');
  assert.equal(policy.propose(source,{...d,category:'monthly_gathering',riskFlags:['private_context']},'e'.repeat(64)).eligible,false);
});


function withdrawnTestFixture(){
  const x=mock(),id='a'.repeat(64),e=entry(),approvedAt='2026-10-08T12:00:00Z';
  x.props.ANNALS_PUBLISH_SIGNING_KEY='p'.repeat(40);
  const receipt={entryId:e.id,approvedAt,reviewedBy:x.props.ANNALS_OWNER_EMAIL,
    consents:permissions,contentSha256:contentDigest(e)};
  receipt.signature=createHmac('sha256',x.props.ANNALS_APPROVAL_KEY)
    .update(core.serial({entry:e,receipt})).digest('hex');
  const removalAt='2026-10-09T00:20:00Z';
  const records={
    'approval-private.json':{entry:e,receipt,publicationState:'dispatch_accepted'},
    'publication-dispatch-private.json':{state:'accepted'},
    'auto-live-verification-private.json':{state:'verified_live',contentSha256:contentDigest(e),verifiedAt:'2026-10-09T00:10:00Z'},
    'removal-private.json':{entry:e,proof:x.context.annalsPublicRemoval_(e,removalAt,x.props.ANNALS_PUBLISH_SIGNING_KEY),approvedAt:removalAt,state:'dispatch_accepted'},
    'removal-dispatch-private.json':{state:'accepted'},
    'ai-attempt-private.json':{state:'attempt_reserved'}
  };
  for(const [name,data] of Object.entries(records))x.folder.createFile(name,JSON.stringify(data));
  const responses={archiveStatus:200,pageStatus:200,
    archive:JSON.stringify({schemaVersion:1,entries:[],approvals:[]}),
    page:buildPublishedAnnals([],[],'invented-public-page-test-secret').html};
  const gets=[];
  x.context.UrlFetchApp.fetch=(url,options)=>{
    assert.equal(options.method,'get');assert.equal(options.followRedirects,false);
    assert.equal(options.validateHttpsCertificates,true);assert.equal(options.headers,undefined);
    gets.push(url);
    if(url.startsWith('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json?'))
      return {getResponseCode:()=>responses.archiveStatus,getContentText:()=>responses.archive};
    assert.ok(url.startsWith('https://stammtischbrewery.com/annals.html?'));
    return {getResponseCode:()=>responses.pageStatus,getContentText:()=>responses.page};
  };
  return {...x,id,e,records,responses,gets};
}

test('withdrawn tests quarantine only after signed exact withdrawal and fresh matching archive and Pages absence',()=>{
  const x=withdrawnTestFixture(),prior=new Map([...x.files].map(([name,f])=>[name,f.getBlob().getDataAsString()])),ledger=x.props.ANNALS_BUDGET_LEDGER;
  assert.equal(x.context.annalsQuarantineSubmission('valid',x.id,'Owner confirmed this invented diagnostic.',true).quarantined,true);
  const check=JSON.parse(x.files.get('withdrawal-live-verification-private.json').getBlob().getDataAsString());
  assert.equal(check.state,'verified_removed');assert.equal(check.entryId,x.e.id);
  assert.equal(check.contentSha256,contentDigest(x.e));
  assert.equal(x.gets.length,2);
  for(const [name,data] of prior)assert.equal(x.files.get(name).getBlob().getDataAsString(),data,name);
  assert.equal(x.props.ANNALS_BUDGET_LEDGER,ledger);assert.equal(x.calls.ai,0);
  assert.equal(x.context.annalsQuarantineSubmission('valid',x.id,'Cannot replace the original audit.',true).alreadyRecorded,true);
  assert.equal(x.gets.length,2);
});

test('withdrawn-test quarantine rejects missing or uncertain publication, mismatched proofs and incomplete live absence',()=>{
  const cases=['no_live','bad_live_hash','bad_live_time','bad_private_signature','bad_removal_signature',
    'wrong_removed_entry','pending_removal','uncertain_removal_dispatch','uncertain_publication','uncertain_correction',
    'archive_error','archive_empty','archive_malformed','archive_wrong_schema','still_indexed','page_error','page_error_body','still_on_page','stale_page','future_removal','unsupported_media'];
  for(const type of cases){
    const x=withdrawnTestFixture();
    const change=(name,fn)=>{const value=JSON.parse(x.files.get(name).getBlob().getDataAsString());fn(value);x.files.get(name).setContent(JSON.stringify(value));};
    if(type==='no_live')x.files.delete('auto-live-verification-private.json');
    if(type==='bad_live_hash')change('auto-live-verification-private.json',v=>v.contentSha256='f'.repeat(64));
    if(type==='bad_live_time')change('auto-live-verification-private.json',v=>v.verifiedAt='2026-10-09T00:25:00Z');
    if(type==='bad_private_signature')change('approval-private.json',v=>v.receipt.signature='bad');
    if(type==='bad_removal_signature')change('removal-private.json',v=>v.proof.signature='bad');
    if(type==='wrong_removed_entry')change('removal-private.json',v=>v.entry={...v.entry,id:'annal-another-invented-entry'});
    if(type==='pending_removal')change('removal-private.json',v=>v.state='approved_removal_pending');
    if(type==='uncertain_removal_dispatch')change('removal-dispatch-private.json',v=>v.state='unknown_no_retry');
    if(type==='uncertain_publication')change('publication-dispatch-private.json',v=>v.state='attempt_reserved');
    if(type==='uncertain_correction')x.folder.createFile('correction-approval-private.json',JSON.stringify({publicationState:'unknown_no_retry'}));
    if(type==='archive_error')x.responses.archiveStatus=503;
    if(type==='archive_empty')x.responses.archive='';
    if(type==='archive_malformed')x.responses.archive='{';
    if(type==='archive_wrong_schema')x.responses.archive=JSON.stringify({entries:[],approvals:[]});
    if(type==='still_indexed')x.responses.archive=JSON.stringify({schemaVersion:1,entries:[x.e],approvals:[{entryId:x.e.id}]});
    if(type==='page_error')x.responses.pageStatus=503;
    if(type==='page_error_body')x.responses.page='<html><body>Temporary failure</body></html>';
    if(type==='still_on_page')x.responses.page=x.responses.page.replace('</main>','<article class="annal-entry" id="'+x.e.id+'"></article></main>');
    if(type==='stale_page')x.responses.archive=JSON.stringify({schemaVersion:1,entries:[{...x.e,id:'annal-another-invented-entry'}],approvals:[{entryId:'annal-another-invented-entry'}]});
    if(type==='future_removal')change('removal-private.json',v=>{v.approvedAt='2026-10-09T00:40:00Z';v.proof=x.context.annalsPublicRemoval_(x.e,v.approvedAt,x.props.ANNALS_PUBLISH_SIGNING_KEY);});
    if(type==='unsupported_media'){
      x.e.photo={sha256:'b'.repeat(64),alt:'An invented cup.'};
      change('approval-private.json',v=>{v.entry=x.e;v.receipt.contentSha256=contentDigest(x.e);v.receipt.consents.photoPublication=true;delete v.receipt.signature;v.receipt.signature=createHmac('sha256',x.props.ANNALS_APPROVAL_KEY).update(core.serial({entry:x.e,receipt:v.receipt})).digest('hex');});
      change('auto-live-verification-private.json',v=>v.contentSha256=contentDigest(x.e));
      change('removal-private.json',v=>{v.entry=x.e;v.proof=x.context.annalsPublicRemoval_(x.e,v.approvedAt,x.props.ANNALS_PUBLISH_SIGNING_KEY);});
    }
    const preserved=new Map([...x.files].map(([name,f])=>[name,f.getBlob().getDataAsString()]));
    assert.throws(()=>x.context.annalsQuarantineSubmission('valid',x.id,'Owner confirmed this invented diagnostic.',true),/Operation held/,type);
    assert.equal(x.files.has('quarantine-private.json'),false,type);
    assert.equal(x.files.has('withdrawal-live-verification-private.json'),false,type);
    assert.equal(x.calls.ai,0,type);
    for(const [name,data] of preserved)assert.equal(x.files.get(name).getBlob().getDataAsString(),data,type+': '+name);
  }
});

test('quarantine UI permits a withdrawn test provisionally but never an active, uncertain or quarantined publication',()=>{
  const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
  const source=ui.match(/function quarantineAvailable\(item\)\s*\{[^}]+\}/)?.[0];
  assert.ok(source,'UI uses the tested availability predicate');
  const available=vm.runInNewContext('('+source+')');
  assert.equal(available({approved:false,dispatchAttempted:false}),true);
  assert.equal(available({approved:true}),false);
  assert.equal(available({dispatchAttempted:true}),false);
  assert.equal(available({approved:true,removal:{state:'approved_removal_pending'}}),false);
  assert.equal(available({approved:true,removal:{state:'dispatch_accepted'}}),true);
  assert.equal(available({approved:true,removal:{state:'dispatch_accepted'},quarantined:true}),false);
});


test('owner review pages bound folder work and preserve complete continuation without changing evidence or spend',()=>{
  const x=mock(),ledger=x.props.ANNALS_BUDGET_LEDGER,ids=Array.from({length:25},(_,i)=>(i+1).toString(16).padStart(64,'0'));
  const folders=['unrelated-folder',...ids].map(id=>({...x.folder,getName:()=>id,
    getFilesByName:name=>iter(name==='source-private.json'?[{...x.folder,
      getBlob:()=>({getDataAsString:()=>JSON.stringify({senderAuthenticated:true,source:{subject:'Invented review fixture',receivedAt:'2026-10-09T00:00:00Z'}})})}]:[])}));
  let visited=0;
  function pageIterator(start){let at=start;return{hasNext:()=>at<folders.length,next:()=>{visited++;return folders[at++];},getContinuationToken:()=>String(at)};}
  x.root.getFolders=()=>pageIterator(0);
  x.context.DriveApp.continueFolderIterator=token=>pageIterator(Number(token));
  const seen=[],sizes=[];let continuation=null;
  do{const before=visited,page=x.context.annalsReviewList('valid',continuation);
    assert.ok(visited-before<=3,'one response never scans more than three folders');
    sizes.push(page.items.length);seen.push(...Array.from(page.items,item=>item.id));continuation=page.continuation;
  }while(continuation);
  assert.deepEqual(sizes,[2,3,3,3,3,3,3,3,2]);assert.deepEqual(seen,ids);
  assert.equal(new Set(seen).size,25);assert.equal(x.props.ANNALS_BUDGET_LEDGER,ledger);assert.equal(x.calls.ai,0);
  assert.throws(()=>x.context.annalsReviewList('invalid',null),/Reload the private review page/);
});


function boundedScanFixture(){
  const x=mock(),ids=Array.from({length:27},(_,i)=>(i+1).toString(16).padStart(64,'0'));
  const stores=ids.map(()=>new Map([['source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,source:{sender:'owner@example.test',subject:'Invented scan fixture',excerpt:'An invented non-identifying object.'},attachmentManifest:{items:[]}})]]));
  const folders=ids.map((id,index)=>{const records=stores[index];
    const file=name=>({...x.folder,getBlob:()=>({getDataAsString:()=>records.get(name)}),setContent:v=>records.set(name,v)});
    return {...x.folder,getName:()=>id,getFilesByName:name=>iter(records.has(name)?[file(name)]:[]),createFile:(name,data)=>{records.set(name,data);return file(name);}};
  });
  let visited=0;
  const walk=start=>{let at=start;return{hasNext:()=>at<folders.length,next:()=>{visited++;return folders[at++];},getContinuationToken:()=>String(at)};};
  x.root.getFolders=()=>walk(0);x.root.getFoldersByName=id=>iter(ids.includes(id)?[folders[ids.indexOf(id)]]:[]);
  x.context.DriveApp.continueFolderIterator=token=>walk(Number(token));
  return {...x,ids,stores,folders,visited:()=>visited};
}

test('draft scan continuation bounds work and resumes every unused one-shot candidate exactly once',()=>{
  const x=boundedScanFixture(),ledger=x.props.ANNALS_BUDGET_LEDGER,processed=[];
  x.stores.forEach((records,i)=>{if(i<24)records.set('ai-attempt-private.json','{"state":"attempt_reserved"}');});
  const original=x.stores.map(records=>new Map(records));
  x.context.annalsConsentActive_=()=>true;
  x.context.annalsProcessConsentedText_=id=>{const records=x.stores[x.ids.indexOf(id)];assert.equal(records.has('ai-attempt-private.json'),false);records.set('ai-attempt-private.json','{"state":"attempt_reserved"}');processed.push(id);return true;};
  const results=[];
  do{const before=x.visited();results.push(x.context.annalsResumeConsentedDrafts_(2));assert.ok(x.visited()-before<=12);}while(x.props.ANNALS_DRAFT_CURSOR);
  assert.deepEqual(results,[0,0,2,1]);assert.deepEqual(processed,x.ids.slice(24));
  assert.equal(x.context.annalsResumeConsentedDrafts_(2),0);assert.equal(processed.length,3);
  original.forEach((records,i)=>{for(const [name,value] of records)assert.equal(x.stores[i].get(name),value);});
  assert.equal(x.props.ANNALS_BUDGET_LEDGER,ledger);assert.equal(x.calls.ai,0);
});

test('live-verification scan resumes beyond bounded pages without redispatch or duplicate verification',()=>{
  const x=boundedScanFixture(),ledger=x.props.ANNALS_BUDGET_LEDGER,e=entry(),target=25,gets=[];
  x.props.ANNALS_AUTO_PUBLICATION_ENABLED='true';
  x.stores.forEach(records=>records.set('auto-live-verification-private.json','{"state":"verified_live"}'));
  x.stores[target].delete('auto-live-verification-private.json');
  const signature='invented-public-signature-only-for-offline-scan-fixture',mode='standing-consent-text-v1';
  x.stores[target].set('approval-private.json',JSON.stringify({entry:e,approvalMode:mode,publicationState:'dispatch_accepted',receipt:{approvedAt:'2026-10-09T00:10:00Z',contentSha256:contentDigest(e)},publication:{signature}}));
  x.context.GmailApp={...(x.context.GmailApp||{}),sendEmail(){}};
  x.context.UrlFetchApp.fetch=(url,options)=>{assert.equal(options.method,'get');gets.push(url);return{getResponseCode:()=>200,getContentText:()=>url.includes('raw.githubusercontent.com')?JSON.stringify({entries:[e],approvals:[{entryId:e.id,mode,signature}]}):'<article id="'+e.id+'"></article>'};};
  const results=[];
  do{const before=x.visited();results.push(x.context.annalsVerifyAutomaticPublications_(3));assert.ok(x.visited()-before<=12);}while(x.props.ANNALS_VERIFY_CURSOR);
  assert.deepEqual(results,[0,0,1]);assert.equal(gets.length,2);
  assert.equal(JSON.parse(x.stores[target].get('auto-live-verification-private.json')).contentSha256,contentDigest(e));
  assert.equal(x.context.annalsVerifyAutomaticPublications_(3),0);assert.equal(gets.length,2);
  assert.equal(x.props.ANNALS_BUDGET_LEDGER,ledger);assert.equal(x.calls.ai,0);
});


function reviewClientFixture(responder){
  const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
  const source=ui.slice(ui.indexOf('const reviewReadMethods='),ui.indexOf('function attemptMessage('));
  assert.ok(source.includes('async function call('));
  const calls=[],runner=(success,failure)=>new Proxy({}, {get(_,name){
    if(name==='withSuccessHandler')return handler=>runner(handler,failure);
    if(name==='withFailureHandler')return handler=>runner(success,handler);
    return (...args)=>{calls.push({name,args:Array.from(args)});try{success(responder(name,Array.from(args)));}catch(error){failure(error);}};
  }});
  const context={google:{script:{run:runner()}},Error};vm.createContext(context);
  vm.runInContext("let nonce='old-owner-nonce';\n"+source+'\nthis.runCall=call;this.readNonce=()=>nonce;',context);
  return {calls,context};
}

test('expired owner sessions refresh once for allowlisted private reads and preserve exact arguments',async()=>{
  for(const method of ['annalsReviewList','annalsReviewItem','annalsReviewConsentStatus','annalsReviewSpeakerIdentities']){
    const x=reviewClientFixture((name,args)=>{
      if(name==='annalsReviewSession')return{nonce:'renewed-owner-nonce'};
      if(args[0]==='old-owner-nonce')throw new Error('Error: Reload the private review page');
      return{ok:true};
    });
    assert.equal((await x.context.runCall(method,'old-owner-nonce','invented-id-or-continuation')).ok,true);
    assert.deepEqual(x.calls.map(c=>c.name),[method,'annalsReviewSession',method]);
    assert.deepEqual(x.calls[2].args,['renewed-owner-nonce','invented-id-or-continuation']);
    assert.equal(x.context.readNonce(),'renewed-owner-nonce');
  }
});

test('expired sessions never automatically repeat AI, consent, signing, publishing, withdrawal or quarantine mutations',async()=>{
  for(const method of ['annalsPrepareDraft','annalsApproveExact','annalsPublishApproved','annalsApproveRemoval','annalsApproveCorrection','annalsQuarantineSubmission','annalsReassessHeldQuote','annalsSaveSpeakerIdentities','annalsInviteProcessingConsent']){
    const x=reviewClientFixture(()=>{throw new Error('Error: Reload the private review page');});
    await assert.rejects(x.context.runCall(method,'old-owner-nonce','invented-exact-id',true),/session expired/);
    assert.equal(x.calls.length,1,method);assert.equal(x.context.readNonce(),'old-owner-nonce');
  }
});

test('private review failures stay bounded and never echo source text, identifiers or provider errors',async()=>{
  const secret='invented-private-marker owner@example.test https://private.example.test/token';
  for(const message of [secret,'Operation held. '+secret,'Service invoked too many times: '+secret,'Server error: '+secret]){
    const x=reviewClientFixture(()=>{throw new Error(message);});
    await assert.rejects(x.context.runCall('annalsReviewItem','old-owner-nonce','invented-id'),error=>!error.message.includes('invented-private-marker')&&!error.message.includes('owner@example.test')&&!error.message.includes('private.example.test'));
    assert.equal(x.calls.length,1);
  }
  const twice=reviewClientFixture(name=>name==='annalsReviewSession'?{nonce:'fresh'}:(()=>{throw new Error('Reload the private review page');})());
  await assert.rejects(twice.context.runCall('annalsReviewList','old-owner-nonce'),/session expired/);assert.equal(twice.calls.length,3);
  const noNonce=reviewClientFixture(name=>name==='annalsReviewSession'?{}:(()=>{throw new Error('Reload the private review page');})());
  await assert.rejects(noNonce.context.runCall('annalsReviewList','old-owner-nonce'),/session expired/);assert.equal(noNonce.calls.length,2);
});


test('notice services match existing explicit OAuth grants without adding mail permissions',()=>{
  const source=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
  const manifest=JSON.parse(readFileSync(new URL('../scripts/annals/production-appsscript.json',import.meta.url),'utf8'));
  const required={GmailApp:'https://mail.google.com/',MailApp:'https://www.googleapis.com/auth/script.send_mail'};
  const services=[...source.matchAll(/\b(GmailApp|MailApp)\.sendEmail\(/g)].map(match=>match[1]);
  assert.ok(services.length>0);
  for(const service of services)assert.ok(manifest.oauthScopes.includes(required[service]),service+' requires an explicit granted scope');
  assert.equal(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'),false,'keep the existing permission set');
});

test('one-shot acknowledgements send through the already authorized Gmail service and never operate drafts',()=>{
  const x=mock(),sent=[],ledger=x.props.ANNALS_BUDGET_LEDGER;
  x.context.GmailApp={sendEmail:(...args)=>sent.push(args),getDrafts:()=>{throw new Error('Prepared drafts must never be sent by this path');}};
  x.context.MailApp={sendEmail:()=>{throw new Error('This service has no manifest scope');}};
  assert.equal(x.context.annalsAckOnce_(x.folder,'member@example.test','a'.repeat(64),'consented_private_drafting'),true);
  assert.equal(JSON.parse(x.files.get('acknowledgement-private.json').getBlob().getDataAsString()).delivery,'sent');
  assert.equal(x.context.annalsAckOnce_(x.folder,'member@example.test','a'.repeat(64),'consented_private_drafting'),false);
  assert.equal(sent.length,1);assert.equal(sent[0][0],'member@example.test');assert.equal(sent[0][1],'Annals submission received');
  assert.equal(x.props.ANNALS_BUDGET_LEDGER,ledger);assert.equal(x.calls.ai,0);
});

test('notice transport repair never resends or overwrites previous uncertain delivery records',()=>{
  const x=mock(),sent=[];
  x.context.GmailApp={sendEmail:(...args)=>sent.push(args)};
  const ack='{"state":"consented_private_drafting","delivery":"unknown_no_retry","at":"2026-10-08T00:00:00Z"}',notice='{"state":"unknown_no_retry","at":"2026-10-08T00:00:00Z"}';
  x.folder.createFile('acknowledgement-private.json',ack);x.folder.createFile('draft-notice-private.json',notice);
  assert.equal(x.context.annalsAckOnce_(x.folder,'member@example.test','a'.repeat(64),'consented_private_drafting'),false);
  assert.equal(x.context.annalsNotifyDraftReady_(x.folder),false);assert.equal(sent.length,0);
  assert.equal(x.files.get('acknowledgement-private.json').getBlob().getDataAsString(),ack);
  assert.equal(x.files.get('draft-notice-private.json').getBlob().getDataAsString(),notice);
});


function ownerActionUiFixture(result){
  const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
  const ids=[...ui.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const controls=new Map(ids.map(id=>[id,{id,disabled:false,checked:true,hidden:false,textContent:'',dataset:{},children:[]}]));
  const get=id=>{assert.ok(controls.has(id),'UI control exists: '+id);return controls.get(id);};
  const queued={disabled:false,dataset:{itemId:'a'.repeat(64)},textContent:'Invented item — Verified live'};
  get('items').children=[queued];get('items').querySelectorAll=()=>get('items').children;
  const detailButtons=['prepare','save','approve','approveRemoval','quarantine','censorText'].map(get);
  get('detail').querySelectorAll=()=>detailButtons;
  const buttons=[...detailButtons,get('back'),get('more'),get('refreshList'),queued];
  const calls=[],messages=[],lists=[];let refreshes=0;
  const context=vm.createContext({console,document:{querySelectorAll:()=>buttons},el:get,
    val:()=> 'An invented exact-entry owner reason.',say:m=>messages.push(m),
    call:async(name,...args)=>{calls.push({name,args});return result;},
    open:async()=>{refreshes++;throw new Error('Invented detail refresh failure');},
    list:async reset=>lists.push(reset)});
  const functions=ui.split(/\r?\n/).find(l=>l.startsWith('function quarantineAvailable'))+'\n'+ui.slice(ui.indexOf('function updateQueuedItem'),ui.indexOf('async function list'))+'\n'+ui.slice(ui.indexOf('function updateRuleAcceptanceControls'),ui.indexOf("el('ruleAcceptanceSecurityConfirmed').onchange"));
  const lines=ui.split(/\r?\n/),handlers=["el('quarantine').onclick=","el('approveRemoval').onclick=","el('more').onclick="].map(prefix=>{const s=lines.find(l=>l.startsWith(prefix));assert.ok(s,prefix);return s;}).join('\n');
  const initial={id:'a'.repeat(64),subject:'Invented item',status:'Verified live',approved:true,quarantined:false,
    publishedEntry:{id:'annal-invented-test',summary:'An invented non-identifying object.'},publishedEntryHash:'invented-exact-digest',publicationState:'dispatch_accepted'};
  vm.runInContext("let nonce='owner-nonce';let continuation='invented-next-page';let ruleAcceptancePrepared=null,ruleAcceptanceState=null,literalStageQualified=false;let current="+JSON.stringify(initial)+';\n'+functions+'\n'+handlers+'\nthis.readCurrent=()=>current;this.readContinuation=()=>continuation;',context);
  return {context,controls,get,queued,calls,messages,lists,refreshes:()=>refreshes,ui};
}

test('confirmed quarantine is acknowledged without a fallible follow-up read and blocks further detail actions',async()=>{
  const x=ownerActionUiFixture({quarantined:true});
  await x.get('quarantine').onclick();
  assert.equal(x.calls.length,1);assert.equal(x.calls[0].name,'annalsQuarantineSubmission');assert.equal(x.refreshes(),0);
  assert.equal(x.context.readCurrent().quarantined,true);assert.match(x.messages.at(-1),/Test quarantined privately/);
  for(const id of ['quarantine','prepare','save','approveRemoval'])assert.equal(x.get(id).disabled,true,id);
  assert.equal(x.get('back').disabled,false);assert.match(x.queued.textContent,/Quarantined/);
});

test('confirmed removal preserves the saved dispatch result and never needs a detail read to report it',async()=>{
  for(const accepted of [true,false]){
    const x=ownerActionUiFixture({approved:true,dispatchAccepted:accepted});
    await x.get('approveRemoval').onclick();
    assert.equal(x.calls.length,1);assert.equal(x.calls[0].name,'annalsApproveRemoval');assert.equal(x.refreshes(),0);
    assert.equal(x.context.readCurrent().removal.state,accepted?'dispatch_accepted':'dispatch_not_configured_or_held');
    assert.equal(x.get('approveRemoval').disabled,true);assert.equal(x.get('quarantine').disabled,!accepted);assert.match(x.get('publishedState').textContent,/Removal status:/);
    assert.match(x.messages.at(-1),accepted?/accepted for publishing/:/dispatch was not confirmed/);
  }
});

test('unconfirmed owner write responses never become success claims or trigger automatic action repeats',async()=>{
  for(const [id,result] of [['quarantine',undefined],['approveRemoval',{approved:false,dispatchAccepted:true}]]){
    const x=ownerActionUiFixture(result);await x.get(id).onclick();
    assert.equal(x.calls.length,1);assert.equal(x.refreshes(),0);assert.match(x.messages.at(-1),/not confirmed/);
    assert.equal(x.context.readCurrent().quarantined,false);assert.equal(x.context.readCurrent().removal,undefined);
  }
});

test('back navigation keeps loaded queue pages and continuation while explicit refresh reloads them',async()=>{
  const x=ownerActionUiFixture({});await x.get('back').onclick();
  assert.equal(x.context.readCurrent(),null);assert.equal(x.get('items').children.length,1);
  assert.equal(x.context.readContinuation(),'invented-next-page');assert.equal(x.lists.length,0);assert.equal(x.calls.length,0);
  assert.equal(x.get('detail').hidden,true);assert.equal(x.get('queue').hidden,false);
  await x.get('more').onclick();await x.get('refreshList').onclick();assert.deepEqual(x.lists,[false,true]);
  assert.match(x.ui,/async function open\(id\)\{current=await call\('annalsReviewItem',nonce,id\)/,'opening any cached item still reads its current private source');
});

test('owner removal still requires explicit exact-entry confirmation before its only write',async()=>{
  const x=ownerActionUiFixture({approved:true,dispatchAccepted:true});x.get('removalConfirmed').checked=false;
  await x.get('approveRemoval').onclick();assert.equal(x.calls.length,0);assert.match(x.messages.at(-1),/confirm the exact currently published entry/);
});

// New release qualification uses only fictional offline service mocks.
test('independent proposal routing holds complete raw email before AI, preserving ledger and originals',()=>{
  const x=mock(),id='c'.repeat(64),before=x.props.ANNALS_BUDGET_LEDGER;
  x.files.delete('source-private.json');
  x.context.annalsAuthentication_=()=>true;x.context.annalsConsentActive_=()=>true;
  x.context.annalsStandingPublicationActive_=()=>true;x.context.annalsImageConsentActive_=()=>false;
  const msg={getFrom:()=> 'member@example.test',getId:()=> 'offline-proposal',getSubject:()=> 'A cocktail',getPlainBody:()=> 'Could we double points next year?',getDate:()=>new Date('2026-10-09T00:00:00Z'),getAttachments:()=>[]};
  assert.equal(x.context.annalsStageProduction_(msg,Date.parse('2026-10-08'),['member@example.test']),'held');
  assert.equal(x.calls.ai,0);assert.equal(x.props.ANNALS_BUDGET_LEDGER,before);
  assert.equal(JSON.parse(x.files.get('original-email-private.json').getBlob().getDataAsString()).body,msg.getPlainBody());
  assert.ok(!x.files.has('draft-private.json'));assert.ok(!x.files.has('publication-dispatch-private.json'));
});
test('proposal intent cannot bypass private holding through manual review, paid drafting or lower-level ordinary dispatch',()=>{
  const x=mock(),id='c'.repeat(64);
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,source:{subject:'A cocktail',excerpt:'Could we change the Diamond provision?'},attachmentManifest:{items:[]}}));
  assert.throws(()=>x.context.annalsSaveReview('valid',id,entry()));
  assert.throws(()=>x.context.annalsPrepareDraft('valid',id,'Only a cocktail.',[],true));
  assert.throws(()=>x.context.annalsDispatchApproved_(x.folder,entry(),{},'annals-approved-entry','publication-dispatch-private.json'));
  assert.equal(x.calls.ai,0);assert.ok(!x.files.has('ai-attempt-private.json'));assert.ok(!x.files.has('approval-private.json'));
});
test('owner-only CoL comparison stores private immutable versions and performs no adoption or publication',()=>{
  const x=mock(),id='c'.repeat(64),rules=readFileSync(new URL('../docs/celebration-of-life-rules.md',import.meta.url),'utf8'),requests=[];
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,source:{subject:'Change drafting',excerpt:'Could we change the celebrity draft?',receivedAt:'2026-10-09T00:00:00Z'},attachmentManifest:{items:[]}}));
  x.context.UrlFetchApp.fetch=(url)=>{requests.push(url);return {getResponseCode:()=>200,getContentText:()=>rules};};
  assert.throws(()=>x.context.annalsPrepareRuleProposal('invalid',id,'DRAFTING','',''));
  const p=x.context.annalsPrepareRuleProposal('valid',id,'DRAFTING','Suggested exact replacement.','Ask the club; not adopted.');
  assert.equal(p.adoptionConfirmed,false);assert.match(p.currentProvision,/Every January/);
  assert.equal(requests.length,1);assert.match(requests[0],/raw\.githubusercontent/);
  x.context.annalsPrepareRuleProposal('valid',id,'DRAFTING','Another proposed wording.','Still not adopted.');
  assert.equal(requests.length,1);assert.equal([...x.files.keys()].filter(k=>/^col-proposal-[a-f0-9]{64}-private/.test(k)).length,2);
  assert.ok(!x.files.has('publication-dispatch-private.json'));assert.ok(!x.files.has('approval-private.json'));
});
test('history preparation is private and signing remains blocked until explicit remediation and qualification',()=>{
  const x=mock(),id='d'.repeat(64),statement='The blue ledger appeared in 2021.';
  x.context.annalsConsentActive_=()=>true;x.context.annalsStandingPublicationActive_=()=>true;
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,source:{subject:'A recollection',excerpt:statement,receivedAt:'2026-10-09T00:00:00Z',sender:'member@example.test'},attachmentManifest:{items:[]}}));
  const raw={chapter:'origins',factKey:'ledger-arrival',field:'excerpt',statement,period:'2021',status:'recollection',uncertainty:'',evidenceNote:'Reviewed offline source fixture.',order:100};
  const r=x.context.annalsSaveHistoryClaim('valid',id,raw,'add','Reviewed offline source fixture.');
  assert.match(r.chapters[0].paragraphs[0],/A member recalls/);
  assert.throws(()=>x.context.annalsApproveHistoryRevision('valid',id,r.hash,true));
  assert.equal(x.calls.ai,0);assert.ok(!x.files.has('history-pending-private.json'));assert.ok(!x.files.has('history-ledger-private.json'));
  x.props.ANNALS_HISTORY_PUBLICATION_ENABLED='true';x.props.ANNALS_SIGNING_REMEDIATED_AT='2026-10-08T00:00:00Z';
  x.props.ANNALS_HISTORY_SIGNING_KEY=x.props.ANNALS_APPROVAL_KEY;
  assert.throws(()=>x.context.annalsApproveHistoryRevision('valid',id,r.hash,true));
});
test('verified publisher expiry pauses unattended AI before budget reservation or dispatch',()=>{
  const x=mock();
  x.context.Date={now:()=>Date.parse('2026-11-09T00:00:00Z'),parse:Date.parse};
  assert.throws(()=>x.context.annalsPrepareDraftCore_('d'.repeat(64),'Offline.',[],true,true,[]),/Publisher credential/);
  assert.equal(x.context.annalsDispatchEvent_(x.folder,'annals-auto-entry',{},'publication-dispatch-private.json'),false);
  assert.equal(x.calls.ai,0);assert.ok(!x.files.has('ai-attempt-private.json'));assert.ok(!x.files.has('publication-dispatch-private.json'));
  assert.equal(JSON.parse(x.props.ANNALS_BUDGET_LEDGER).reservedCents,0);
});

test('qualified history dispatch preserves pending evidence, rejects resend, and commits only after exact live reconciliation',()=>{
  const x=mock(),id='d'.repeat(64),statement='The blue ledger appeared in 2021.';
  x.context.annalsConsentActive_=()=>true;x.context.annalsStandingPublicationActive_=()=>true;
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,source:{subject:'A recollection',excerpt:statement,receivedAt:'2026-10-09T00:00:00Z',sender:'member@example.test'},attachmentManifest:{items:[]}}));
  Object.assign(x.props,{ANNALS_HISTORY_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:'2026-10-08T00:00:00Z',ANNALS_HISTORY_SIGNING_KEY:'h'.repeat(40),ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),ANNALS_GITHUB_TOKEN:'offline-token',ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch'});
  let publicDocument={schemaVersion:1,revision:0,chapters:[],updatedAt:''},dispatches=[];
  x.context.UrlFetchApp.fetch=(url,options)=>{
    if(url.endsWith('/dispatches')){dispatches.push(JSON.parse(options.payload));return {getResponseCode:()=>204};}
    if(url.endsWith('history.html'))return {getResponseCode:()=>200,getContentText:()=>renderHistory(publicDocument)+'\n'};
    return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(publicDocument)};
  };
  const raw={chapter:'origins',factKey:'ledger-arrival',field:'excerpt',statement,period:'2021',status:'recollection',uncertainty:'',evidenceNote:'Reviewed offline source fixture.',order:100};
  const preview=x.context.annalsSaveHistoryClaim('valid',id,raw,'add','Reviewed offline source fixture.');
  assert.equal(x.context.annalsApproveHistoryRevision('valid',id,preview.hash,true).dispatchAccepted,true);
  assert.ok(!x.files.has('history-ledger-private.json'));
  assert.equal(x.context.annalsReconcileHistory('valid').verified,false);
  assert.throws(()=>x.context.annalsApproveHistoryRevision('valid',id,preview.hash,true));assert.equal(dispatches.length,1);
  publicDocument=dispatches[0].client_payload.document;
  assert.equal(x.context.annalsReconcileHistory('valid').verified,true);
  assert.equal(JSON.parse(x.files.get('history-ledger-private.json').getBlob().getDataAsString()).claims.length,1);
  assert.equal(JSON.parse(x.files.get('history-pending-private.json').getBlob().getDataAsString()).state,'verified_live');
  assert.equal(x.context.annalsReconcileHistory('valid').verified,false);assert.equal(dispatches.length,1);
  // Revocation stops additions; owner withdrawal remains available and removes
  // every public passage relying on this source without erasing the evidence.
  x.context.annalsStandingPublicationActive_=()=>false;x.context.annalsConsentActive_=()=>false;
  assert.throws(()=>x.context.annalsSaveHistoryClaim('valid',id,{...raw,factKey:'new-topic'},'add','New addition must be refused.'));
  const withdrawal=x.context.annalsSaveHistoryClaim('valid',id,{},'withdraw','Contributor withdrew this entire source.');
  assert.equal(withdrawal.chapters.length,0);
  assert.equal(x.context.annalsApproveHistoryRevision('valid',id,withdrawal.hash,true).dispatchAccepted,true);
  assert.equal(dispatches.length,2);assert.ok(x.files.has('history-revision-1-private.json'));assert.ok(x.files.has('history-revision-2-private.json'));
});

test('private signing rotation probe rejects old signatures and validates new configuration without revealing or publishing credentials',()=>{
  const x=mock(),id='a'.repeat(64);x.props.ANNALS_PUBLISH_SIGNING_KEY='p'.repeat(40);
  const review=x.context.annalsSaveReview('valid',id,entry());
  x.context.annalsApproveReview('valid',id,review.hash,permissions,'Offline consent evidence only.',true);
  const before=x.files.get('approval-private.json').getBlob().getDataAsString();
  assert.equal(x.context.annalsCheckSigningRotation('valid',id).oldPrivateSignatureRejected,false);
  x.props.ANNALS_APPROVAL_KEY='r'.repeat(40);x.props.ANNALS_PUBLISH_SIGNING_KEY='t'.repeat(40);
  const result=x.context.annalsCheckSigningRotation('valid',id);
  assert.equal(result.newPrivateSignatureValid,true);assert.equal(result.oldPrivateSignatureRejected,true);assert.equal(result.oldPublicSignatureRejected,true);
  assert.equal(result.githubSecretConsistencyVerified,false);assert.equal(result.publishesAnything,false);
  assert.equal(x.files.get('approval-private.json').getBlob().getDataAsString(),before);
  assert.ok(Object.values(result).every(v=>typeof v==='boolean'));assert.equal(x.calls.ai,0);
});

test('one-shot private CoL assessment uses existing model, input/output bounds and budget, never signing or changing rules',()=>{
  const x=mock(),id='c'.repeat(64),rules=readFileSync(new URL('../docs/celebration-of-life-rules.md',import.meta.url),'utf8');
  x.context.annalsConsentActive_=()=>true;
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,source:{subject:'Proposal about drafting',excerpt:'Could we change the January celebrity draft?',sender:'member@example.test',receivedAt:'2026-10-09T00:00:00Z'},attachmentManifest:{items:[]}}));
  let paid=0;
  const assessment={heading:'DRAFTING',replacement:'Offline proposed replacement only.',scores:'No retrospective change established.',selections:'Pending club decision.',awards:'Unassessed.',drafting:'Proposal only.',annualRollover:'Intervening January remains unresolved.',notifications:'No change authorised.',effectiveDate:'Unresolved.',contradictions:'Needs review.',recommendation:'Private consideration only.'};
  x.context.UrlFetchApp.fetch=(url,options)=>{
    if(url.includes('raw.githubusercontent'))return {getResponseCode:()=>200,getContentText:()=>rules};
    assert.equal(url,'https://api.openai.com/v1/responses');paid++;
    const request=JSON.parse(options.payload);
    assert.equal(request.model,core.MODEL);assert.equal(request.store,false);assert.equal(request.max_output_tokens,4000);assert.equal(request.tools,undefined);
    assert.ok(request.input[0].content[0].text.length<=12000);
    assert.equal(JSON.parse(x.props.ANNALS_BUDGET_LEDGER).reservedCents,10);assert.ok(x.files.has('ai-attempt-private.json'));
    return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(assessment)}]}]})};
  };
  assert.equal(x.context.annalsPrepareRuleDraftCore_(id),true);
  const packet=JSON.parse(x.files.get('col-proposal-private.json').getBlob().getDataAsString());
  assert.equal(packet.adoptionConfirmed,false);assert.equal(packet.aiSuggestionsUnverified,true);assert.match(packet.effects.annualRollover,/unresolved/);
  assert.equal(x.context.annalsPrepareRuleDraftCore_(id),false);assert.equal(paid,1);
  assert.ok(!x.files.has('approval-private.json'));assert.ok(!x.files.has('publication-dispatch-private.json'));
});
test('uncertain CoL provider delivery never retries or refunds the attempt',()=>{
  const x=mock(),id='c'.repeat(64),rules=readFileSync(new URL('../docs/celebration-of-life-rules.md',import.meta.url),'utf8');
  x.context.annalsConsentActive_=()=>true;
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,source:{subject:'Rule proposal',excerpt:'Could we change the draft?',sender:'member@example.test'},attachmentManifest:{items:[]}}));
  let paid=0;x.context.UrlFetchApp.fetch=url=>{if(url.includes('raw.githubusercontent'))return {getResponseCode:()=>200,getContentText:()=>rules};paid++;throw Error('PRIVATE provider failure');};
  assert.equal(x.context.annalsPrepareRuleDraftCore_(id),false);assert.equal(x.context.annalsPrepareRuleDraftCore_(id),false);assert.equal(paid,1);
  assert.equal(JSON.parse(x.props.ANNALS_BUDGET_LEDGER).reservedCents,10);assert.ok(!x.files.has('col-proposal-private.json'));
  assert.ok(!x.logs.join('').includes('PRIVATE provider failure'));
});

test('an interrupted source write resumes from an identical immutable original without blocking intake',()=>{
  const x=mock(),id='c'.repeat(64);x.files.delete('source-private.json');
  x.context.annalsAuthentication_=()=>true;x.context.annalsConsentActive_=()=>true;
  x.context.annalsStandingPublicationActive_=()=>true;x.context.annalsImageConsentActive_=()=>false;
  const msg={getFrom:()=> 'member@example.test',getId:()=> 'offline-interrupted-stage',getSubject:()=> 'A rule proposal',getPlainBody:()=> 'Could we change the celebrity draft?',getDate:()=>new Date('2026-10-09T00:00:00Z'),getAttachments:()=>[]};
  const create=x.folder.createFile;x.folder.createFile=function(name,data){if(name==='source-private.json')throw Error('Offline simulated interrupted write');return create.call(this,name,data);};
  assert.throws(()=>x.context.annalsStageProduction_(msg,Date.parse('2026-10-08'),['member@example.test']));
  const original=x.files.get('original-email-private.json').getBlob().getDataAsString();
  x.folder.createFile=create;
  assert.equal(x.context.annalsStageProduction_(msg,Date.parse('2026-10-08'),['member@example.test']),'held');
  assert.equal(x.files.get('original-email-private.json').getBlob().getDataAsString(),original);
  assert.equal(x.context.annalsStageProduction_(msg,Date.parse('2026-10-08'),['member@example.test']),'duplicates');
  assert.equal(x.calls.ai,0);
});
function pendingHistoryMock(){
  const x=mock(),document={schemaVersion:1,revision:1,updatedAt:'2026-10-09T00:30:00.000Z',chapters:[{id:'origins',heading:'Origins',paragraphs:['Offline fictional history fixture only.']}]};
  const pending={state:'dispatch_accepted',document,approval:{contentSha256:createHash('sha256').update(core.serial(document)).digest('hex')},review:{ledger:{schemaVersion:1,revision:0,claims:[],revisions:[]}}};
  x.folder.createFile('history-pending-private.json',JSON.stringify(pending));
  let html='<main data-history-revision="1">Different offline text.</main>';
  x.context.UrlFetchApp.fetch=url=>({getResponseCode:()=>200,getContentText:()=>url.endsWith('history.html')?html:JSON.stringify(document)});
  return {...x,document,pending,setHtml:value=>{html=value;}};
}
test('history live verification rejects changed HTML despite matching JSON and revision marker',()=>{
  const x=pendingHistoryMock();
  assert.equal(x.context.annalsReconcileHistory('valid').verified,false);
  assert.ok(!x.files.has('history-ledger-private.json'));assert.ok(!x.files.has('history-live-1-private.json'));
});
test('history verification can finish after its final status save fails without rewriting audit or resending',()=>{
  const x=pendingHistoryMock();
  x.setHtml(renderHistory(x.document)+'\n');
  const save=x.context.annalsSavePrivate_;let fail=true;
  x.context.annalsSavePrivate_=(folder,name,value)=>{if(name==='history-pending-private.json'&&value.state==='verified_live'&&fail){fail=false;throw Error('Offline final-save interruption');}return save(folder,name,value);};
  assert.throws(()=>x.context.annalsReconcileHistory('valid'));
  const audit=x.files.get('history-live-1-private.json').getBlob().getDataAsString();
  assert.equal(x.context.annalsReconcileHistory('valid').verified,true);
  assert.equal(x.files.get('history-live-1-private.json').getBlob().getDataAsString(),audit);
  assert.equal(x.calls.ai,0);assert.ok(!x.files.has('publication-dispatch-private.json'));
});
test('CoL response-read uncertainty is recorded privately and never charged twice',()=>{
  const x=mock(),id='c'.repeat(64),rules=readFileSync(new URL('../docs/celebration-of-life-rules.md',import.meta.url),'utf8');
  x.context.annalsConsentActive_=()=>true;
  x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,aiConsentActive:true,source:{subject:'Rule proposal',excerpt:'Could we change the draft?',sender:'member@example.test'},attachmentManifest:{items:[]}}));
  let paid=0;x.context.UrlFetchApp.fetch=url=>{if(url.includes('raw.githubusercontent'))return {getResponseCode:()=>200,getContentText:()=>rules};paid++;return {getResponseCode:()=>200,getContentText:()=>{throw Error('Offline response-read interruption');}};};
  assert.equal(x.context.annalsPrepareRuleDraftCore_(id),false);
  assert.equal(x.context.annalsPrepareRuleDraftCore_(id),false);assert.equal(paid,1);
  assert.equal(JSON.parse(x.files.get('ai-outcome-private.json').getBlob().getDataAsString()).reason,'provider_result_unknown');
  assert.equal(JSON.parse(x.props.ANNALS_BUDGET_LEDGER).reservedCents,10);
});

test('interrupted intake refuses changed original evidence instead of replacing it',()=>{
  const x=mock();x.files.delete('source-private.json');x.context.annalsAuthentication_=()=>true;
  x.context.annalsConsentActive_=()=>true;x.context.annalsStandingPublicationActive_=()=>true;x.context.annalsImageConsentActive_=()=>false;
  const original={subject:'Original proposal',body:'Original private fixture.',receivedAt:'2026-10-09T00:00:00.000Z'};
  x.folder.createFile('original-email-private.json',JSON.stringify(original));
  const msg={getFrom:()=> 'member@example.test',getId:()=> 'offline-interrupted-stage',getSubject:()=> 'Changed subject',getPlainBody:()=> 'Could we change the draft?',getDate:()=>new Date(original.receivedAt),getAttachments:()=>[]};
  assert.throws(()=>x.context.annalsStageProduction_(msg,Date.parse('2026-10-08'),['member@example.test']));
  assert.equal(x.files.get('original-email-private.json').getBlob().getDataAsString(),JSON.stringify(original));
  assert.ok(!x.files.has('source-private.json'));assert.equal(x.calls.ai,0);
});
test('history signing rechecks every existing active claim against its immutable original',()=>{
  const x=mock(),id='d'.repeat(64),statement='The blue ledger appeared in 2021.';
  const source={senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,source:{subject:'A recollection',excerpt:statement,receivedAt:'2026-10-09T00:00:00Z',sender:'member@example.test'},attachmentManifest:{items:[]}};
  x.context.annalsConsentActive_=()=>true;x.context.annalsStandingPublicationActive_=()=>true;
  x.folder.createFile('source-private.json',JSON.stringify(source));
  const raw={id:'a'.repeat(64),sourceId:id,chapter:'origins',factKey:'ledger-arrival',field:'excerpt',statement,period:'2021',status:'recollection',uncertainty:'',evidenceNote:'Reviewed offline evidence only.',order:100};
  const claim=x.context.AnnalsHistory.claim(source,raw),ledger=x.context.AnnalsHistory.apply(x.context.AnnalsHistory.empty(),claim,true,'2026-10-09T00:00:00Z','Reviewed offline evidence only.').ledger;
  ledger.claims[0].statement='The blue ledger appeared in 2021 beside a throne.';
  x.root.createFile('history-ledger-private.json',JSON.stringify(ledger));
  const preview=x.context.annalsSaveHistoryClaim('valid',id,{...raw,factKey:'another-source-topic',order:200},'add','Review another original passage.');
  Object.assign(x.props,{ANNALS_HISTORY_PUBLICATION_ENABLED:'true',ANNALS_SIGNING_REMEDIATED_AT:'2026-10-08T00:00:00Z',ANNALS_HISTORY_SIGNING_KEY:'h'.repeat(40),ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40)});
  let calls=0;x.context.UrlFetchApp.fetch=()=>{calls++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({schemaVersion:1,revision:0,chapters:[],updatedAt:''})};};
  assert.throws(()=>x.context.annalsApproveHistoryRevision('valid',id,preview.hash,true));
  assert.equal(calls,0);assert.ok(!x.files.has('history-pending-private.json'));
});

test('informal proposal and rules-question messages cannot reach ordinary review or dispatch',()=>{
  for(const text of ['Here is my new points formula.','Can we use a different draft order?','A question about the scoring rules.']){
    const x=mock(),id='c'.repeat(64),before=x.props.ANNALS_BUDGET_LEDGER;
    x.folder.createFile('source-private.json',JSON.stringify({senderAuthenticated:true,source:{subject:'A cocktail',excerpt:text},attachmentManifest:{items:[]}}));
    assert.throws(()=>x.context.annalsSaveReview('valid',id,entry()));
    assert.throws(()=>x.context.annalsDispatchApproved_(x.folder,entry(),{},'annals-approved-entry','publication-dispatch-private.json'));
    assert.equal(x.calls.ai,0);assert.equal(x.props.ANNALS_BUDGET_LEDGER,before);
    assert.ok(!x.files.has('approval-private.json'));assert.ok(!x.files.has('publication-dispatch-private.json'));
  }
});


test('ordinary Annals recollections and keepsakes use signed publication dispatch without changing canonical history',()=>{
  const x=mock(),dispatched=[];
  x.context.annalsOrdinarySourceGate_=()=>true;
  x.context.annalsDispatchEvent_=(folder,eventType,payload,marker)=>{
    dispatched.push({eventType,category:payload.entry.category,marker});return true;
  };
  for(const category of ['monthly_gathering','artefact','club_history']){
    const e={...entry(),category,recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]}};
    assert.equal(x.context.annalsDispatchApproved_(x.folder,e,{mode:'standing-consent-text-v1'},'annals-auto-entry',
      'publication-dispatch-private.json'),true,category);
  }
  assert.equal(dispatched.length,3);
  assert.deepEqual(dispatched.map(x=>x.category),['monthly_gathering','artefact','club_history']);
  assert.equal(x.files.has('col-release-pending-private.json'),false);
  assert.equal(x.calls.ai,0);
});

test('persistent safe-source pre-draft holds notify owner and authenticated member exactly once without AI or replay',()=>{
  const x=mock(),messages=[],id='d'.repeat(64),oldLedger=x.props.ANNALS_BUDGET_LEDGER;
  x.props.ANNALS_ALLOWED_SENDERS='member@example.test,other@example.test';
  x.props.ANNALS_REVIEW_URL='https://script.google.com/macros/s/fictional-owner/exec';
  x.folder.getName=()=>id;
  x.root.getFolders=()=>iter([x.folder]);
  x.context.annalsConsentActive_=()=>true;
  x.context.annalsStandingPublicationActive_=()=>true;
  x.context.GmailApp={sendEmail:(to,subject,body)=>messages.push({to,subject,body})};
  const original={
    sourceId:id,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{sender:'member@example.test',subject:'Fictional club account',
      excerpt:'Please contact someone@example.test for a fictional detail.',
      receivedAt:'2026-10-08T23:45:00Z',
      sourceTruncated:false,excerptTruncated:false,subjectTruncated:false},
    attachmentManifest:{items:[]}
  };
  x.files.get('source-private.json').setContent(JSON.stringify(original));
  assert.equal(x.context.annalsResumeConsentedDrafts_(2),0);
  assert.equal(messages.length,0,'no premature hold notice while processing normally');
  original.source.receivedAt='2026-10-08T22:00:00Z';
  x.files.get('source-private.json').setContent(JSON.stringify(original));
  assert.equal(x.context.annalsResumeConsentedDrafts_(2),0);
  assert.equal(messages.length,2,'one owner notice and one contributor notice');
  assert.match(x.context.annalsReviewStatus_(x.folder,original,null),/Held.*private source review/);
  assert.equal(messages[0].to,'owner@example.test');
  assert.equal(messages[1].to,'member@example.test');
  assert.match(messages[0].body,/cannot safely proceed to automatic drafting/);
  assert.match(messages[0].body,/https:\/\/script\.google\.com\/macros\/s\/fictional-owner\/exec\?item=/);
  assert.match(messages[1].body,/has not been confirmed/);
  assert.doesNotMatch(messages[1].body,/fictional-owner|someone@example.test|fictional detail|d{64}/);
  assert.equal(x.context.annalsResumeConsentedDrafts_(2),0);
  assert.equal(messages.length,2,'no repeat reminders or repeated attempts');
  assert.equal(x.props.ANNALS_BUDGET_LEDGER,oldLedger);
  assert.equal(x.calls.ai,0);
  assert.equal(x.files.has('ai-attempt-private.json'),false);
  assert.equal(x.files.has('publication-dispatch-private.json'),false);
});

test('owner-only hold notification is safe when a contributor is not authenticated',()=>{
  const x=mock(),messages=[];
  x.folder.getName=()=> 'e'.repeat(64);
  x.props.ANNALS_REVIEW_URL='https://script.google.com/macros/s/fictional-owner/exec';
  x.props.ANNALS_ALLOWED_SENDERS='member@example.test';
  x.context.GmailApp={sendEmail:(...args)=>messages.push(args)};
  x.files.get('source-private.json').setContent(JSON.stringify({
    source:{sender:'member@example.test',receivedAt:'2026-10-08T22:00:00Z'},senderAuthenticated:false
  }));
  assert.equal(x.context.annalsNotifyDraftReady_(x.folder,'sender_unverified'),true);
  assert.equal(messages.length,1);
  assert.equal(messages[0][0],'owner@example.test');
  assert.equal(x.files.has('contributor-hold-notice-private.json'),false);
});


test('ordinary AI drafting sees only independently screened safe remainder; private original and CoL remain exact',()=>{
  const x=mock(),source={source:{subject:'Fish and Marc — fictional club note',
    excerpt:'Marc prepared imaginary drinks. We met at 2400 Example Road. Jamie was diagnosed with a condition. Matt packed imaginary lemons.'}};
  const original=structuredClone(source);
  const ai=x.context.annalsAiSafeSourceText_(source);
  assert.match(ai,/Fish and Marc/);
  assert.match(ai,/Marc prepared imaginary drinks/);
  assert.match(ai,/Matt packed imaginary lemons/);
  assert.match(ai,/\[DETAIL OMITTED\]/);
  assert.doesNotMatch(ai,/2400 Example Road|diagnosed with|condition/);
  assert.equal(x.context.annalsSafeTextForAutoAi_(ai),true);
  assert.equal(x.context.annalsAiIndependentSafeText_(source),true);
  assert.equal(source.source.excerpt,original.source.excerpt);
  assert.match(x.context.annalsAiSourceText_(source),/2400 Example Road/);
  const col={source:{subject:'CoL scoring revision',excerpt:'Change the Steal formula in a hypothetical club game.'}};
  assert.equal(x.context.annalsAiSafeSourceText_(col),'','operative rule source must use its dedicated route');
  assert.match(x.context.annalsAiSourceText_(col),/Steal formula/);
  assert.equal(x.calls.ai,0);
});
test('a separate original photo cannot suppress independent screened text, but photo-only content remains dependent',()=>{
  const x=mock();
  const text={source:{subject:'Imaginary gathering',excerpt:'Marc prepared a fictional drink. See the attached photo.'}};
  assert.equal(x.context.annalsAiIndependentSafeText_(text),true);
  assert.doesNotMatch(x.context.annalsAiSafeSourceText_(text),/See the attached photo/);
  const photo={source:{subject:'Photo submission',excerpt:'See the attached photo.'}};
  assert.equal(x.context.annalsAiIndependentSafeText_(photo),false);
  assert.match(x.context.annalsAiSafeSourceText_(photo),/See the attached photo/);
  assert.equal(x.calls.ai,0);
});

test('authenticated outside emails publish only anonymous screened text through the established signed dispatch', async () => {
  const x=mock(), id=x.context.annalsHash_('outside-recipe-message'), sent=[], mail=[];
  x.files.delete('source-private.json');
  Object.assign(x.props,{
    ANNALS_ALLOWED_SENDERS:['member1','member2','member3','member4','member5','member6'].map(n=>n+'@example.test').join(','),
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',
    ANNALS_GITHUB_TOKEN:'test-publisher',
    ANNALS_PUBLISH_SIGNING_KEY:'p'.repeat(40),
    ANNALS_GITHUB_REPOSITORY:'justinpfisher/Stammtisch',
    ANNALS_ACTIVATED_AT:'2026-10-08T00:00:00Z'
  });
  x.context.GmailApp={sendEmail:(...args)=>mail.push(args)};
  const message={
    getId:()=> 'outside-recipe-message',getFrom:()=> 'maker@example.test',
    getDate:()=>new Date('2026-10-09T00:00:00Z'),
    getSubject:()=> 'Fictional Test Cup',
    getPlainBody:()=> 'Fictional Test Cup\n1 oz imaginary syrup\n2 oz invented tea\nStir the imaginary drink.',
    getRawContent:()=> 'Authentication-Results: mx.google.com; dkim=pass header.d=example.test\n\nGenuine test only',
    getAttachments:()=>[]
  };
  const allowed=x.props.ANNALS_ALLOWED_SENDERS.split(',');
  assert.equal(x.context.annalsStageProduction_(message,Date.parse('2026-10-08T00:00:00Z'),allowed),'staged');
  const source=JSON.parse(x.files.get('source-private.json').getBlob().getDataAsString());
  assert.equal(source.externalContributionAtReceipt,true);
  assert.equal(source.clubMemberAuthenticated,false);
  assert.equal(source.senderAuthenticated,true);
  assert.equal(source.imageConsentAtReceipt,false);
  assert.equal(source.rulesAuthorityVersion,undefined);
  assert.equal(x.context.annalsOrdinaryPublicationAllowed_(source),true);
  assert.equal(mail.length,0,'outside submissions cause no automatic receipt email');
  x.folder.createFile('draft-private.json',JSON.stringify({
    category:'cocktail',title:'Fictional Test Cup',summary:'Fictional test drink',
    eventDate:'',quoteVerbatim:'',riskFlags:[],
    recipe:{drinkIngredients:['1 oz imaginary syrup','2 oz invented tea'],
      syrupIngredients:[],steps:['Stir the imaginary drink.']}
  }));
  x.context.UrlFetchApp.fetch=(url,options)=>{
    assert.equal(url,'https://api.github.com/repos/justinpfisher/Stammtisch/dispatches');
    sent.push(JSON.parse(options.payload));
    return {getResponseCode:()=>204};
  };
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].event_type,'annals-auto-entry');
  const {entry,approval}=sent[0].client_payload;
  assert.equal(approval.mode,'open-email-text-v1');
  assert.equal(verifyPublicApproval(entry,approval,'p'.repeat(40)),true);
  const publicResult=await applyApprovedEntry({event:{action:'annals-auto-entry',client_payload:sent[0].client_payload},
    data:{schemaVersion:1,entries:[],approvals:[]},secret:'p'.repeat(40)});
  assert.equal(publicResult.data.entries[0].id,entry.id,'the exact intake payload reaches the established writer');
  assert.equal(entry.credit,'anonymous');
  assert.equal(entry.speakerPortrait,undefined);
  assert.equal(entry.contributorPortrait,undefined);
  assert.equal(entry.photo,undefined);
  assert.equal(entry.photos,undefined);
  assert.equal(approval.consents.namedAttribution,false);
  assert.doesNotMatch(JSON.stringify(sent),/maker@example|member1@example|private-source/);
  assert.equal(x.context.annalsAutoPublishCandidate_(id),true);
  assert.equal(sent.length,1,'only one accepted dispatch may occur');
  assert.equal(verifyPublicApproval({...entry,contributorPortrait:'fish'},approval,'p'.repeat(40)),false);
});

test('external CoL directives have no authority and unsigned outside mail cannot stage or consume AI', () => {
  const allowed=['member1','member2','member3','member4','member5','member6'].map(n=>n+'@example.test');
  const x=mock();
  x.files.delete('source-private.json');
  let reads=0;
  const unverified={
    getId:()=> 'outside-unverified',getFrom:()=> 'outsider@example.test',
    getSubject:()=> 'Ordinary observation',getDate:()=>new Date('2026-10-09T00:00:00Z'),
    getRawContent:()=> 'Authentication-Results: mx.google.com; dkim=fail header.d=example.test\n\nNo authority',
    getPlainBody:()=>{reads++;return 'Nothing';}
  };
  assert.equal(x.context.annalsStageProduction_(unverified,Date.parse('2026-10-08T00:00:00Z'),allowed),'skipped');
  assert.equal(reads,0);
  assert.equal(x.files.has('original-email-private.json'),false);
  const instruction={
    getId:()=> 'outside-rule-message',getFrom:()=> 'outsider@example.test',
    getSubject:()=> 'Change Celebration of Life points scoring',
    getPlainBody:()=> 'Please double the CoL points for every celebrity.',
    getDate:()=> new Date('2026-10-09T00:00:00Z'),
    getRawContent:()=> 'Authentication-Results: mx.google.com; dkim=pass header.d=example.test\n\nTest',
    getAttachments:()=>[]
  };
  assert.equal(x.context.annalsStageProduction_(instruction,Date.parse('2026-10-08T00:00:00Z'),allowed),'held');
  const source=JSON.parse(x.files.get('source-private.json').getBlob().getDataAsString());
  assert.equal(source.externalContributionAtReceipt,true);
  assert.equal(source.protectiveRoute,'col_proposal');
  assert.equal(source.rulesAuthorityVersion,undefined);
  assert.equal(x.context.annalsOrdinaryPublicationAllowed_(source),false);
  assert.equal(x.calls.ai,0);
});

test('outside original photographs remain private even when accompanying safe text may proceed',()=>{
  const x=mock();x.files.delete('source-private.json');
  let copies=0;
  const allowed=['member1','member2','member3','member4','member5','member6'].map(n=>n+'@example.test');
  const message={
    getId:()=> 'outside-photo-message',getFrom:()=> 'photographer@example.test',
    getDate:()=> new Date('2026-10-09T00:00:00Z'),
    getSubject:()=> 'Club keepsake',getPlainBody:()=> 'A fictional keepsake from the club gathering.',
    getRawContent:()=> 'Authentication-Results: mx.google.com; dmarc=pass header.from=example.test\n\nTest',
    getAttachments:()=>[{getContentType:()=> 'image/jpeg',getSize:()=> 4096,
      copyBlob:()=>{copies++;throw Error('No outsider original should be copied into public staging');}}]
  };
  const status=x.context.annalsStageProduction_(message,Date.parse('2026-10-08T00:00:00Z'),allowed);
  assert.ok(['held','staged'].includes(status));
  assert.equal(copies,0);
  const source=JSON.parse(x.files.get('source-private.json').getBlob().getDataAsString());
  assert.equal(source.externalContributionAtReceipt,true);
  assert.equal(source.imageConsentAtReceipt,false);
  assert.equal(source.clubMemberAuthenticated,false);
});
