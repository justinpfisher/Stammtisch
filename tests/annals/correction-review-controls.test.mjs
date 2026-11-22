import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const require=createRequire(import.meta.url);
const {consents}=require('../../scripts/annals/ProductionCore.js');
const ui=readFileSync(new URL('../../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
const handler=ui.split('\n').find(line=>line.startsWith("el('approveCorrection').onclick="));
const controls=ui.slice(ui.indexOf('id="correctionApproval"'),ui.indexOf('id="approveCorrection"'));
const fixture=(entry,checked)=>{
  const ids=['correctionPublication','correctionReviewed','correctionNamedAttribution','correctionRecipeVerified','correctionQuotePublication','correctionPhotoPublication'];
  const fields=Object.fromEntries(ids.map(id=>[id,{checked:checked.includes(id)}]));
  fields.approveCorrection={};
  // Hidden initial publication fields can have stale selections. They must not
  // be read by the exact-correction handler.
  for(const id of ['namedAttribution','recipeVerified','quotePublication'])
    Object.defineProperty(fields,id,{get(){throw Error('Original approval control was read');}});
  const calls=[];
  runInNewContext(handler,{
    el:id=>fields[id],act:fn=>fn(),open:async()=>{},say:()=>{},
    nonce:'fictional',current:{id:'fictional-id'},entry:()=>entry,review:{entry,hash:'preview-hash'},
    val:()=> 'Checked against fictional source.',
    call:async(...args)=>{const validated=consents(entry,args[4]);calls.push(validated);return {dispatchAccepted:true};}
  });
  return {run:()=>fields.approveCorrection.onclick(),calls};
};
const reviewed=['correctionPublication','correctionReviewed'];
test('portrait correction uses its visible attribution control and still requires it',async()=>{
  assert.match(controls,/id="correctionNamedAttribution"/);
  assert.match(ui,/contributor portrait and first name in/);
  const entry={category:'miscellany',title:'',credit:'anonymous',contributorPortrait:'matt'};
  const denied=fixture(entry,reviewed);
  await assert.rejects(denied.run(),/Required consent missing/);
  assert.equal(denied.calls.length,0);
  const allowed=fixture(entry,[...reviewed,'correctionNamedAttribution']);
  await allowed.run();
  assert.equal(allowed.calls[0].namedAttribution,true);
  assert.equal(allowed.calls[0].photoPublication,false);
});
test('quotation, recipe and included photograph attestations remain source specific',async()=>{
  assert.match(controls,/id="correctionQuotePublication"/);
  assert.match(controls,/id="correctionRecipeVerified"/);
  const cases=[
    [{category:'quotation',credit:'anonymous',speakerPortrait:'matt'},['correctionNamedAttribution'],'correctionQuotePublication','quotePublication'],
    [{category:'cocktail',credit:'anonymous'},[],'correctionRecipeVerified','recipeVerified'],
    [{category:'miscellany',credit:'anonymous',photo:{sha256:'fixture'}},[],'correctionPhotoPublication','photoPublication']
  ];
  for(const [entry,other,control,field] of cases){
    await assert.rejects(fixture(entry,[...reviewed,...other]).run(),/Required consent missing/);
    const ok=fixture(entry,[...reviewed,...other,control]);
    await ok.run();
    assert.equal(ok.calls[0][field],true);
  }
});
