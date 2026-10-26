import Media from '../scripts/annals/MediaCore.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { applyApprovedEntry } from '../scripts/annals/apply-approved-entry.mjs';
import { gitBlobHash } from '../scripts/annals/PhotoTransport.mjs';
import { validateEditorialManifest } from '../scripts/annals/EditorialPhotoManifest.mjs';
import { contentDigest, verifyPublicApproval } from '../scripts/annals/ApprovedRenderer.mjs';
import { readFile } from 'node:fs/promises';

const secret = 'synthetic-publication-test-key-not-a-real-secret';
const entry = { id: 'annal-aaaaaaaaaaaaaaaaaaaaaaaa', category: 'cocktail', title: 'Synthetic cocktail',
  summary: 'Fictional test entry.', year: 2026, dateLabel: '', sortDate: '', credit: 'anonymous', quoteVerbatim: '',
  recipe: { drinkIngredients: ['1/2 oz imaginary syrup'], syrupIngredients: [], steps: ['Synthetic only.'] } };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const makeApproval = (source,approvedAt='2026-10-09T12:00:00.000Z') => {
  const unsigned = { entryId: source.id, approvedAt,
    consents: { publication: true, quotePublication: false, recipeVerified: true, namedAttribution: false, photoPublication: false },
    contentSha256: contentDigest(source) };
  return { ...unsigned, signature: createHmac('sha256', secret)
    .update(JSON.stringify(canonical({ entry: source, approval: unsigned }))).digest('hex') };
};
const eventFor = (source = entry, approval = makeApproval(source)) => ({ action: 'annals-approved-entry', client_payload: { entry: source, approval } });
const emptyArchive = () => ({ schemaVersion: 1, entries: [], approvals: [] });
const rawPhoto = () => Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCgEQf/2Q==','base64');
const photoJpeg = () => Buffer.from(Media.sanitize(rawPhoto()).bytes);
const makeRemoval = source => {
  const unsigned={entryId:source.id,approvedAt:'2026-10-09T12:00:00.000Z',contentSha256:contentDigest(source)};
  return {...unsigned,signature:createHmac('sha256',secret).update(JSON.stringify(canonical({operation:'remove',removal:unsigned}))).digest('hex')};
};

test('only a valid exact public approval is added and rendered', async () => {
  const approval = makeApproval(entry);
  assert.equal(verifyPublicApproval(entry, approval, secret), true);
  const result = await applyApprovedEntry({ event: eventFor(entry, approval), data: emptyArchive(), secret });
  assert.equal(result.data.entries.length, 1);
  assert.equal(result.data.approvals.length, 1);
  assert.match(result.html, /Synthetic cocktail/);
  assert.doesNotMatch(result.html, /reviewedBy|owner@example|private evidence/);
});

test('the established publisher accepts only signed anonymous text from the open inbox mode', async () => {
  const outside={...entry,credit:'anonymous'};
  const unsigned={entryId:outside.id,approvedAt:'2026-10-09T12:00:00.000Z',
    mode:'open-email-text-v1',
    consents:{publication:true,quotePublication:false,recipeVerified:true,namedAttribution:false,photoPublication:false},
    contentSha256:contentDigest(outside)};
  const approval={...unsigned,signature:createHmac('sha256',secret)
    .update(JSON.stringify(canonical({entry:outside,approval:unsigned}))).digest('hex')};
  const payload={entry:outside,approval};
  const result=await applyApprovedEntry({event:{action:'annals-auto-entry',client_payload:payload},data:emptyArchive(),secret});
  assert.equal(result.data.entries.length,1);
  assert.equal(result.data.approvals[0].mode,'open-email-text-v1');
  assert.match(result.html,/Synthetic cocktail/);
  for(const extra of [{imageBase64:'ZmFrZQ=='},{images:[]},{imageBlobs:[]}]) {
    await assert.rejects(applyApprovedEntry({event:{action:'annals-auto-entry',client_payload:{...payload,...extra}},data:emptyArchive(),secret}));
  }
  const identified={...outside,credit:'a club member'};
  const identifiedUnsigned={...unsigned,contentSha256:contentDigest(identified)};
  const identifiedApproval={...identifiedUnsigned,signature:createHmac('sha256',secret)
    .update(JSON.stringify(canonical({entry:identified,approval:identifiedUnsigned}))).digest('hex')};
  await assert.rejects(applyApprovedEntry({event:{action:'annals-auto-entry',client_payload:{entry:identified,approval:identifiedApproval}},data:emptyArchive(),secret}));
});

test('changed text, invalid event, duplicate identity and private fields fail closed', async () => {
  const approval = makeApproval(entry);
  await assert.rejects(applyApprovedEntry({ event: eventFor({ ...entry, summary: 'Changed.' }, approval), data: emptyArchive(), secret }));
  await assert.rejects(applyApprovedEntry({ event: { ...eventFor(), action: 'workflow_dispatch' }, data: emptyArchive(), secret }));
  await assert.rejects(applyApprovedEntry({ event: eventFor(), data: { ...emptyArchive(), entries: [entry], approvals: [approval] }, secret }));
  await assert.rejects(() => applyApprovedEntry({ event: { action: 'annals-approved-entry', client_payload: { entry: { ...entry, sender: 'member@example.test' }, approval: makeApproval(entry) } }, data: emptyArchive(), secret }));
});

test('preserves prior approved entries and rejects forged or missing approval signatures', async () => {
  const approval = makeApproval(entry);
  const previous = { ...entry, id: 'annal-bbbbbbbbbbbbbbbbbbbbbbbb', title: 'Existing approved item' };
  const previousApproval = makeApproval(previous);
  const result = await applyApprovedEntry({ event: eventFor(), data: { schemaVersion: 1, entries: [previous], approvals: [previousApproval] }, secret });
  assert.equal(result.data.entries.length, 2);
  assert.match(result.html, /Existing approved item/);
  await assert.rejects(applyApprovedEntry({ event: eventFor(entry, { ...approval, signature: '0'.repeat(64) }), data: emptyArchive(), secret }));
  await assert.rejects(applyApprovedEntry({ event: eventFor(entry, { ...approval, reviewerEmail: 'private@example.test' }), data: emptyArchive(), secret }));
});

test('publisher workflow is reachable only through the dedicated repository dispatch and writes only Annals files', async () => {
  const workflow = await readFile(new URL('../.github/workflows/annals-publish.yml', import.meta.url), 'utf8');
  assert.match(workflow, /repository_dispatch:\s*\n\s*types:\\s*\\[annals-approved-entry, annals-auto-entry, annals-correct-entry, annals-remove-entry, annals-editorial-photo-v1\\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*write/);
  assert.doesNotMatch(workflow, /actions:\s*write|workflow_dispatch|pull_request|schedule:/);
  assert.match(workflow, /git add -A -- annals\.html data\/annals-approved\.json data\/annals-editorial-photos\.json data\/photos assets/);
  assert.match(workflow, /ANNALS_PUBLISH_SIGNING_KEY/);
});

test('signed correction replaces only the exact existing entry and preserves the rest', async () => {
  const previous={...entry,id:'annal-bbbbbbbbbbbbbbbbbbbbbbbb',title:'Prior public entry'}, previousApproval=makeApproval(previous);
  const corrected={...previous,title:'Corrected public entry',summary:'Corrected exact content.'}, correctionApproval=makeApproval(corrected,'2026-10-09T12:00:01.000Z');
  const event={action:'annals-correct-entry',client_payload:{entry:corrected,approval:correctionApproval}};
  const result=await applyApprovedEntry({event,data:{schemaVersion:1,entries:[previous],approvals:[previousApproval]},secret});
  assert.equal(result.data.entries.length,1);assert.equal(result.data.entries[0].title,'Corrected public entry');
  assert.equal(result.data.approvals[0].signature,correctionApproval.signature);assert.match(result.html,/Corrected public entry/);
  await assert.rejects(applyApprovedEntry({event,data:emptyArchive(),secret}));
  await assert.rejects(applyApprovedEntry({event:{...event,client_payload:{...event.client_payload,entry:{...corrected,title:'Altered after approval'}}},data:{schemaVersion:1,entries:[previous],approvals:[previousApproval]},secret}));
});

test('signed removal deletes only the requested currently approved entry', async () => {
  const previous={...entry,id:'annal-bbbbbbbbbbbbbbbbbbbbbbbb',title:'Entry for removal'}, approval=makeApproval(previous);
  const event={action:'annals-remove-entry',client_payload:{entryId:previous.id,approval:makeRemoval(previous)}};
  const result=await applyApprovedEntry({event,data:{schemaVersion:1,entries:[previous],approvals:[approval]},secret});
  assert.deepEqual(result.data.entries,[]);assert.deepEqual(result.data.approvals,[]);assert.doesNotMatch(result.html,/Entry for removal/);
  await assert.rejects(applyApprovedEntry({event,data:emptyArchive(),secret}));
  await assert.rejects(applyApprovedEntry({event:{...event,client_payload:{...event.client_payload,approval:makeRemoval({...previous,summary:'Changed'})}},data:{schemaVersion:1,entries:[previous],approvals:[approval]},secret}));
});

test('a consented exact cocktail photo is digest-checked and staged only after signed approval', async () => {
  const image=photoJpeg(), photoEntry={...entry,photo:{sha256:createHash('sha256').update(image).digest('hex'),alt:'A fictional cocktail in a glass'}};
  const unsigned={entryId:photoEntry.id,approvedAt:'2026-10-09T12:00:00.000Z',consents:{publication:true,quotePublication:false,recipeVerified:true,namedAttribution:false,photoPublication:true},contentSha256:contentDigest(photoEntry)};
  const approval={...unsigned,signature:createHmac('sha256',secret).update(JSON.stringify(canonical({entry:photoEntry,approval:unsigned}))).digest('hex')};
  const event={action:'annals-approved-entry',client_payload:{entry:photoEntry,approval,imageBase64:image.toString('base64')}};
  const result=await applyApprovedEntry({event,data:emptyArchive(),secret});
  assert.equal(result.assetsToWrite[0].path,`assets/annals/${photoEntry.id}.jpg`);assert.deepEqual(result.assetsToWrite[0].bytes,image);
  assert.match(result.html,/alt="A fictional cocktail in a glass"/);
  await assert.rejects(applyApprovedEntry({event:{...event,client_payload:{...event.client_payload,imageBase64:Buffer.concat([image,Buffer.from([0])]).toString('base64')}},data:emptyArchive(),secret}));
  const metadataImage=Buffer.concat([image.subarray(0,2),Buffer.from([255,225,0,4,1,2]),image.subarray(2)]);
  const metadataEntry={...entry,photo:{sha256:createHash('sha256').update(metadataImage).digest('hex'),alt:'A drink'}};
  const unsignedMetadata={...unsigned,entryId:metadataEntry.id,contentSha256:contentDigest(metadataEntry)};
  const metadataApproval={...unsignedMetadata,signature:createHmac('sha256',secret).update(JSON.stringify(canonical({entry:metadataEntry,approval:unsignedMetadata}))).digest('hex')};
  await assert.rejects(applyApprovedEntry({event:{action:'annals-approved-entry',client_payload:{entry:metadataEntry,approval:metadataApproval,imageBase64:metadataImage.toString('base64')}},data:emptyArchive(),secret}));
});

const editorialJpeg=()=>{
  const head=Buffer.from([
    0xff,0xd8,
    0xff,0xc0,0x00,0x11,0x08,0x03,0x84,0x02,0x58,0x03,
    0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,
    0xff,0xdb,0x00,0x02,
    0xff,0xda,0x00,0x02
  ]);
  return Buffer.concat([head,Buffer.alloc(5000,0x11),Buffer.from([0xff,0xd9])]);
};
const editorialEvent=(photo,bytes,issuedAt,overrides={})=>{
  const blob={gitSha:gitBlobHash(bytes),size:bytes.length};
  const unsigned={operation:'editorial-photo-v1',photo,blob,issuedAt};
  const signature=createHmac('sha256',secret).update(JSON.stringify(canonical(unsigned))).digest('hex');
  return {action:'annals-editorial-photo-v1',client_payload:{photo,blob,issuedAt,signature,...overrides}};
};
const photoArchive=()=>{
  const sourceSha='b'.repeat(64);
  const source={...entry,photos:[{sha256:sourceSha,alt:'Original textured glass',width:600,height:900}]};
  const unsigned={entryId:source.id,approvedAt:'2026-10-26T11:00:00.000Z',
    consents:{publication:true,quotePublication:false,recipeVerified:true,namedAttribution:false,photoPublication:true},
    contentSha256:contentDigest(source)};
  const approval={...unsigned,signature:createHmac('sha256',secret)
    .update(JSON.stringify(canonical({entry:source,approval:unsigned}))).digest('hex')};
  return {source,data:{schemaVersion:1,entries:[source],approvals:[approval]},sourceSha};
};
const editorialRow=(sourceSha,bytes,now='2026-10-26T12:00:00.000Z')=>({
  source:'assets/annals/'+sourceSha+'.jpg',sourceSha256:sourceSha,
  asset:'assets/annals/'+sourceSha+'-editorial-v2.jpg',
  editorialSha256:createHash('sha256').update(bytes).digest('hex'),
  width:600,height:900,alt:'AI-stylized amber cocktail in its original textured glass',
  artDirection:'moody-atmospheric-v2',status:'qualified',rightsQualified:true,
  safetyQualified:true,visualQualified:true,generationProvider:'openai-chatgpt',
  generationModel:'undisclosed',generationOperation:'image-edit',
  reviewMethod:'ai-visual-assessment',generatedAt:now,reviewedAt:now
});
test('signed editorial event updates only the derivative and matching manifest row',async()=>{
  const {data,sourceSha}=photoArchive(),bytes=editorialJpeg(),now=new Date('2026-10-26T12:01:00.000Z');
  const photo=editorialRow(sourceSha,bytes),event=editorialEvent(photo,bytes,now.toISOString());
  const originalManifest={schemaVersion:1,artDirection:'moody-atmospheric-v2',images:[]};
  const result=await applyApprovedEntry({event,data,secret,now,photosEnabled:true,blobTransportEnabled:true,
    editorialManifest:originalManifest,fetchEditorialBytes:async ref=>{
      assert.equal(ref.sha256,photo.editorialSha256);assert.equal(ref.width,600);return bytes;
    }});
  assert.deepEqual(result.data,data);
  assert.equal(result.assetsToWrite.length,1);assert.equal(result.assetsToWrite[0].path,photo.asset);
  assert.deepEqual(result.assetsToWrite[0].bytes,bytes);assert.deepEqual(result.assetsToDelete,[]);
  assert.deepEqual(result.editorialManifest.images,[photo]);
  validateEditorialManifest(result.editorialManifest,data.entries);
});
test('editorial publisher rejects tampering, stale events, wrong sources and duplicate rows',async()=>{
  const {data,sourceSha}=photoArchive(),bytes=editorialJpeg(),now=new Date('2026-10-26T12:01:00.000Z');
  const photo=editorialRow(sourceSha,bytes),manifest={schemaVersion:1,artDirection:'moody-atmospheric-v2',images:[]};
  const base={data,secret,now,photosEnabled:true,blobTransportEnabled:true,editorialManifest:manifest,
    fetchEditorialBytes:async()=>bytes};
  const event=editorialEvent(photo,bytes,now.toISOString());
  await assert.rejects(applyApprovedEntry({...base,event:{...event,client_payload:{...event.client_payload,signature:'0'.repeat(64)}}}),/signature/i);
  await assert.rejects(applyApprovedEntry({...base,event:editorialEvent(photo,bytes,'2026-10-26T11:00:00.000Z')}),/Stale/i);
  await assert.rejects(applyApprovedEntry({...base,event:editorialEvent({...photo,sourceSha256:'c'.repeat(64)},bytes,now.toISOString())}));
  await assert.rejects(applyApprovedEntry({...base,event,photosEnabled:false}),/disabled/i);
  await assert.rejects(applyApprovedEntry({...base,event,blobTransportEnabled:false}),/disabled/i);
  await assert.rejects(applyApprovedEntry({...base,event:{...event,client_payload:{...event.client_payload,unexpected:true}}}),/payload/i);
  await assert.rejects(applyApprovedEntry({...base,event,editorialManifest:{...manifest,images:[photo]}}),/already exists/i);
  await assert.rejects(applyApprovedEntry({...base,event,fetchEditorialBytes:async()=>Buffer.from('not jpeg')}));
});
