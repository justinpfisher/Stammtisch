/* Public fictional-only qualification: image captions never rewrite recipe source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import Photos from '../scripts/annals/PhotoContracts.js';
import Production from '../scripts/annals/ProductionCore.js';
import Auto from '../scripts/annals/AutoCore.js';

function imageReview(patch={}) {
  return {
    kind:'drink_or_object',safeToPublish:true,
    privateDetails:false,thirdPartyMaterial:false,childrenOrGuests:false,
    altText:'An amber drink in a stemmed coupe glass beside a wooden table.',
    caption:'The stemmed coupe takes its place in the photographic record.',
    ...patch
  };
}

test('AI-generated editorial caption requires a safe, image-specific detail',()=>{
  const eligible=imageReview();
  assert.equal(Photos.editorialCaption(eligible),eligible.caption);
  for(const patch of [
    {kind:'unknown'}, {safeToPublish:false}, {privateDetails:true},
    {thirdPartyMaterial:true}, {childrenOrGuests:true}, {altText:''},
    {caption:'A magnificent establishment records its greatness.'},
    {caption:'Justin prepared this historical drink in Toronto.'},
    {caption:'Rum and cider were definitely used.'},
    {caption:'A stemmed coupe that won first prize.'},
    {caption:'The coupe contains 3 oz of rum.'}
  ]) assert.equal(Photos.editorialCaption(imageReview(patch)),'',JSON.stringify(patch));
  assert.equal(Photos.editorialCaption(imageReview({caption:''})),'');
  assert.equal(Photos.editorialCaption({...eligible,caption:undefined}),'');
});

test('photo caption is separate from alt text and the original recipe fields',()=>{
  const original={
    id:'fictional-cocktail-source',category:'cocktail',
    title:'Original fictional cocktail NAME',
    summary:'Member supplied wording. Not a marketing description.',
    year:2026,dateLabel:'Submitted October 2026',sortDate:'',
    quoteVerbatim:'',credit:'anonymous',
    recipe:{
      drinkIngredients:['1/2 oz test syrup','1 oz fictional fruit juice'],
      syrupIngredients:['2 tbsp synthetic sugar and 1 cup water'],
      steps:['Stir for exactly 8 seconds.','Strain into a chilled fictional glass.']
    }
  };
  const signedFields=['title','summary','recipe'];
  const fixed=Production.publicEntry(original);
  const extra={...original,photos:[{
    sha256:'f'.repeat(64),width:850,height:1200,
    alt:'A pale drink in a stemmed glass.',
    caption:'The stemmed glass is accorded photographic attention.'
  }]};
  const decorated=Production.publicEntry(extra);
  for(const field of signedFields)
    assert.deepEqual(decorated[field],fixed[field],field+' changed when a photo caption was added');
  assert.equal(decorated.photos[0].caption,extra.photos[0].caption);
  assert.equal(decorated.photos[0].alt,extra.photos[0].alt);
  assert.notEqual(Production.serial(decorated),Production.serial(fixed),
    'new signed captions must not masquerade as unchanged historical content');
});

test('source-first recipe publication ignores attempted AI rewrites of title and summary',()=>{
  const excerpt=[
    'A member-submitted drink that needs no new introduction.',
    '1 oz fictional fruit juice',
    '1/2 oz test syrup',
    'Shake over ice.',
    'Strain into a glass.'
  ].join('\n');
  const source={
    senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    attachmentManifest:{items:[]},
    source:{subject:'Original fictional cocktail NAME',excerpt,
      receivedAt:'2026-10-19T20:00:00Z',sourceTruncated:false,
      subjectTruncated:false,excerptTruncated:false}
  };
  const draft={
    category:'cocktail',title:'The Grand and Entirely Official Cocktail',
    summary:'An unsolicited and exaggerated AI rewrite.',
    riskFlags:[],quoteVerbatim:'',
    recipe:{drinkIngredients:['1 oz fictional fruit juice','1/2 oz test syrup'],
      syrupIngredients:[],steps:['Shake over ice.','Strain into a glass.']}
  };
  const decision=Auto.propose(source,draft,'a'.repeat(64),null);
  assert.equal(decision.eligible,true,decision.reason);
  assert.equal(decision.entry.title,source.source.subject);
  assert.equal(decision.entry.summary,excerpt);
  assert.deepEqual(decision.entry.recipe,draft.recipe);
});

test('new AI schema and prompt separate visual captions from protected recipe text',()=>{
  const req=Production.request('An entirely fictional member text contribution.',[]);
  assert.equal(req.input[0].content.length,1);
  const imageItem=req.text.format.schema.properties.imageReviews.items;
  assert.ok(imageItem.required.includes('altText'));
  assert.ok(imageItem.required.includes('caption'));
  assert.match(req.instructions,/recipe name, original description, ingredient list and preparation instructions must NEVER be rewritten/);
  assert.match(req.instructions,/The separate imageReviews caption is a photograph description only/);
  assert.match(req.instructions,/Never write a joke in altText/);
  const fictionalDraft={
    category:'cocktail',title:'Fictional recipe name',
    summary:'Original submitted description.',eventDate:'',quoteVerbatim:'',
    recipe:{drinkIngredients:['1 oz fictional juice'],syrupIngredients:[],steps:['Stir.']},
    riskFlags:[],imageSafety:{kind:'none',safeToPublish:false,altText:''},
    imageReviews:[imageReview({caption:undefined})],
    interpretation:{intent:'recipe',speakerId:'unknown',evidenceField:'none'}
  };
  // Existing stored drafts without captions remain readable.
  assert.equal(Production.candidate(fictionalDraft,true).imageReviews[0].caption,undefined);
});
