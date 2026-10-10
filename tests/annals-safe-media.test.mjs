import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { applyApprovedEntry } from '../scripts/annals/apply-approved-entry.mjs';
import { contentDigest,verifyPublicApproval,validatePublicTextEntry,buildPublishedAnnals } from '../scripts/annals/ApprovedRenderer.mjs';

const require=createRequire(import.meta.url);
const media=require('../scripts/annals/MediaCore.js');
const policy=require('../scripts/annals/MediaPolicy.js');
const base=require('../scripts/annals/AutoCore.js');
const secret='synthetic-test-signing-key-long-enough-for-public-HMAC';
const photo=()=>Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCgEQf/2Q==','base64');
const id='f'.repeat(64);
const source=()=>({senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,imageConsentAtReceipt:true,
  source:{sender:'member@example.test',subject:'Club cocktail snapshot',
    excerpt:'Photo attached.',receivedAt:'2026-10-10T12:00:00Z'},
  attachmentManifest:{items:[{mime:'image/jpeg',size:photo().length}],held:false}});
const draft=(category='cocktail')=>({category,title:'Club cocktail snapshot',summary:'Photo attached.',
  eventDate:'',quoteVerbatim:'',riskFlags:[],
  recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},
  imageSafety:{kind:'drink_or_object',safeToPublish:true,altText:'A glass on a plain background'}});
const canonical=value=>Array.isArray(value)?value.map(canonical):
  value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const sign=entry=>{
  const approval={entryId:entry.id,approvedAt:'2026-10-10T12:01:00Z',
    consents:{publication:true,quotePublication:false,recipeVerified:entry.category==='cocktail',
      namedAttribution:false,photoPublication:!!entry.photo},
    contentSha256:contentDigest(entry),mode:entry.photo?policy.MODE:base.MODE};
  const signature=createHmac('sha256',secret).update(JSON.stringify(canonical({entry,approval}))).digest('hex');
  return {...approval,signature};
};
test('metadata is stripped from a synthetic decodable JPEG, without changing its dimensions',()=>{
  const original=photo();const sanitized=media.sanitize([...original]);
  assert.equal(sanitized.width,1);assert.equal(sanitized.height,1);
  assert.ok(sanitized.bytes.length<original.length);
  assert.deepEqual(sanitized.bytes.slice(0,2),[255,216]);
  assert.deepEqual(sanitized.bytes.slice(-2),[255,217]);
  assert.equal(Buffer.from(sanitized.bytes).includes(Buffer.from('JFIF')),false);
  assert.equal(Buffer.from(sanitized.bytes).includes(Buffer.from('Exif')),false);
});
test('malicious, corrupt and large thumbnail structures fail closed',()=>{
  const image=photo();
  assert.throws(()=>media.sanitize(Buffer.from('not an image')),/Invalid private thumbnail/);
  assert.throws(()=>media.sanitize([...image].slice(0,-2)),/complete JPEG/);
  assert.throws(()=>media.sanitize([...image,...image]),/complete JPEG/);
  assert.throws(()=>media.sanitize(new Array(1024*1024+1).fill(0)),/Invalid private thumbnail/);
  assert.throws(()=>media.sanitize([...image].map((n,i)=>i===3?0:n)));
});
test('image eligibility requires contributor permission, positive screening and a bounded derivative',()=>{
  const original=media.sanitize([...photo()]);
  const picture={sha256:createHash('sha256').update(Buffer.from(original.bytes)).digest('hex'),
    size:original.bytes.length};
  assert.equal(policy.eligibleImage(source(),draft(),picture),true);
  for (const change of [
    {imageConsentAtReceipt:false},{senderAuthenticated:false},{autoConsentAtReceipt:false}
  ]) assert.equal(policy.eligibleImage({...source(),...change},draft(),picture),false);
  for (const change of [
    {imageSafety:{kind:'person_or_private',safeToPublish:false,altText:'Guest in a private home'}},
    {riskFlags:['faces_or_reflections']},{riskFlags:['possible_personal_identifier']}
  ]) assert.equal(policy.eligibleImage(source(),{...draft(),...change},picture),false);
  assert.equal(policy.eligibleImage(source(),draft(),{...picture,size:32769}),false);
});
test('automatically published cocktail photo is a signed, small metadata-free derivative, not a private original',async()=>{
  const picture=media.sanitize([...photo()]);
  const binary=Buffer.from(picture.bytes);
  const digest=createHash('sha256').update(binary).digest('hex');
  const decision=base.propose(source(),draft(),id);
  assert.equal(decision.eligible,false);
  const result=policy.enrich(source(),draft(),id,decision,{sha256:digest,size:binary.length});
  assert.equal(result.eligible,true);
  assert.equal(result.mode,policy.MODE);
  assert.equal(result.entry.photo.sha256,digest);
  assert.equal(result.entry.credit,'anonymous');
  assert.doesNotMatch(JSON.stringify(result.entry),/member@example\.test|JFIF|Exif/);
  const approval=sign(result.entry);
  assert.equal(verifyPublicApproval(result.entry,approval,secret),true);
  const event={action:'annals-auto-entry',client_payload:{entry:result.entry,approval,imageBase64:binary.toString('base64')}};
  const applied=await applyApprovedEntry({event,data:{schemaVersion:1,entries:[],approvals:[]},secret});
  assert.equal(applied.assetsToWrite.length,1);
  assert.equal(applied.assetsToWrite[0].path,'assets/annals/'+result.entry.id+'.jpg');
  assert.match(applied.html,/alt="Contributor-submitted cocktail photograph"/);
  assert.match(applied.html,/The Cocktail Register/);
  await assert.rejects(applyApprovedEntry({event,data:applied.data,secret}),/already exists/);
});
test('identified guests, unsafe image analysis and missing permission do not publish the photo',()=>{
  const bytes=media.sanitize([...photo()]).bytes;
  const image={sha256:createHash('sha256').update(Buffer.from(bytes)).digest('hex'),size:bytes.length};
  for (const unsafe of [
    {...source(),imageConsentAtReceipt:false},
    {...source(),source:{...source().source,excerpt:'Ken and a guest are in this picture.'}}
  ]) {
    const result=policy.enrich(unsafe,draft(),id,base.propose(unsafe,draft(),id),image);
    assert.equal(result.eligible,false);
  }
  const risky={...draft(),imageSafety:{kind:'person_or_private',safeToPublish:false,altText:'People'}};
  const result=policy.enrich(source(),risky,id,base.propose(source(),risky,id),image);
  assert.equal(result.eligible,false);
});
test('club artefact photograph can use the same signed, safe-object pathway',()=>{
  const bytes=media.sanitize([...photo()]).bytes;
  const image={sha256:createHash('sha256').update(Buffer.from(bytes)).digest('hex'),size:bytes.length};
  const src=source();src.source.subject='Club artefact';src.source.excerpt='Photo attached.';
  const cand={...draft('artefact'),title:'Club artefact'};
  const decision=policy.enrich(src,cand,id,base.propose(src,cand,id),image);
  assert.equal(decision.eligible,true);
  assert.equal(decision.entry.category,'artefact');
  assert.equal(validatePublicTextEntry(decision.entry).photo.sha256,image.sha256);
});
test('suggestions are visibly distinguished from preserved measurement-free source ingredients',()=>{
  const recipe={drinkIngredients:['gin','syrup','tonic water'],syrupIngredients:[],steps:[]};
  const suggestions=policy.suggestedQuantities(recipe,'gin and homemade syrup');
  assert.match(suggestions.join(' '),/about 45 mL|start at 15 mL/i);
  assert.match(suggestions.join(' '),/not part of the original recipe/i);
  assert.deepEqual(recipe.drinkIngredients,['gin','syrup','tonic water']);
  const e={id:'annal-'+id.slice(0,24),category:'cocktail',title:'Imaginary concoction',
    summary:'Invented synthetic test',year:2026,dateLabel:'Submitted 2026-10',sortDate:'',quoteVerbatim:'',
    recipe:{...recipe,suggestedSteps:suggestions},credit:'anonymous'};
  const html=buildPublishedAnnals([e],[sign(e)],secret).html;
  assert.match(html,/Editorial suggestions — NOT part of the original recipe/);
  assert.match(html,/about 45 mL|start at 15 mL/);
  assert.match(html,/gin/);
});
