/* FICTIONAL OFFLINE FIXTURES ONLY. No mailbox, private data, AI or publisher.
 * Runs in hosted CI against an ephemeral loopback server, never GitHub Pages.
 * Browser emulation is not physical-device or screen-reader acceptance.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';
import {buildPublishedAnnals,contentDigest} from '../../scripts/annals/ApprovedRenderer.mjs';
import {renderRegister} from '../../scripts/annals/RulesPublisher.mjs';
import {photoIndex} from '../../scripts/annals/PhotoIndex.mjs';
import Media from '../../scripts/annals/MediaCore.js';
import Codec from '../../scripts/annals/JpegCodec.js';
import {photoThumbnail} from '../../scripts/annals/PhotoThumbnail.mjs';
import {createHash} from 'node:crypto';
import {renderHistory} from '../../scripts/annals/HistoryPublisher.mjs';
import {browserRuleFixture} from './col-fixture.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
// This literal is only an offline fixture key; no production key is read.
const fixtureKey='fictional-offline-browser-fixture-key-000000';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const recipe={drinkIngredients:['1/2 oz cordial','2 oz water'],syrupIngredients:['1 cup sugar','1 cup water'],steps:['Simmer the syrup for 5 minutes.','Stir the drink with ice.'],suggestedSteps:['Editorial suggestion: chill the empty glass first.']};
const base={year:2026,dateLabel:'Submitted 2026-12',sortDate:'',credit:'anonymous',quoteVerbatim:'',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]}};
const entries=[
  {...base,id:'offline-browser-recipe',category:'cocktail',title:'Fictional browser recipe',summary:'The rain inspired this drink.\n'+[...recipe.drinkIngredients,...recipe.syrupIngredients,...recipe.steps].join('\n'),recipe},
  {...base,id:'offline-browser-recipe-only',category:'cocktail',title:'Fictional recipe without an anecdote',summary:'3/4 oz cordial\n4 oz water\nStir gently.',recipe:{drinkIngredients:['3/4 oz cordial','4 oz water'],syrupIngredients:[],steps:['Stir gently.']}},
  {...base,id:'offline-browser-quote',category:'quotation',title:'Fictional quotation fixture',summary:'Fictional browser fixture only.',quoteVerbatim:'A fictional [EXPLETIVE] remark with [POOP] and mild damn language.',dateLabel:'Submitted 2027-01',year:2027},
  {...base,id:'offline-browser-assembly',category:'assembly',title:'Fictional Assembly fixture',summary:'This is an offline layout fixture, not a club event.'}
];
const approvals=entries.map(entry=>{
  const approval={entryId:entry.id,approvedAt:'2026-10-15T12:00:00Z',consents:{publication:true,quotePublication:entry.category==='quotation',recipeVerified:entry.category==='cocktail',namedAttribution:false,photoPublication:false},contentSha256:contentDigest(entry)};
  return {...approval,signature:createHmac('sha256',fixtureKey).update(JSON.stringify(canonical({entry,approval}))).digest('hex')};
});
const history={schemaVersion:1,revision:1,updatedAt:'2027-01-01T00:00:00Z',chapters:[
  {id:'origins',heading:'Origins',paragraphs:['A member recalls: This entirely fictional early passage tests a chapter added out of receipt order. (Historical uncertainty: an approximate period only.)']},
  {id:'traditions',heading:'Developing traditions',paragraphs:['This is fictional browser-layout prose. It must never become an actual club recollection. '.repeat(5)]}
]};
const tinyBytes=Buffer.from(Media.sanitize(Buffer.from((await readFile(path.join(root,'tests/annals-safe-media.test.mjs'),'utf8')).match(/const photo=\(\)=>Buffer.from\('([^']+)'/)[1],'base64')).bytes);
const fixturePhoto={sha256:'a'.repeat(64),alt:'Fictional browser photograph',width:1,height:1};
entries.push({...base,id:'offline-browser-gallery',category:'assembly',title:'Fictional gallery',summary:'Fictional browser photograph fixture only.',photos:[fixturePhoto,{...fixturePhoto,sha256:'b'.repeat(64),alt:'Second fictional photograph'}]});
const gallery=entries.at(-1),a={entryId:gallery.id,approvedAt:'2026-10-15T12:00:00Z',consents:{publication:true,quotePublication:false,recipeVerified:false,namedAttribution:false,photoPublication:true},contentSha256:contentDigest(gallery),mode:'standing-consent-photos-v2'};
approvals.push({...a,signature:createHmac('sha256',fixtureKey).update(JSON.stringify(canonical({entry:gallery,approval:a}))).digest('hex')});
const geometry=new Uint8Array(1600*900*4);for(let i=0;i<geometry.length;i+=4){geometry[i]=50;geometry[i+1]=150;geometry[i+2]=100;geometry[i+3]=255;}
const largeBytes=Buffer.from(Media.sanitize(Codec.encode({width:1600,height:900,data:geometry},80).data,true).bytes),largeHash=createHash('sha256').update(largeBytes).digest('hex');
const largeAsset={path:'assets/annals/'+largeHash+'.jpg',bytes:largeBytes},thumbAsset=photoThumbnail(largeAsset);
const responsiveEntry={...base,id:'offline-responsive-gallery',category:'assembly',title:'Fictional responsive image fixture',summary:'Fictional geometry only; no photographic quality claim.',photos:[{sha256:largeHash,width:1600,height:900,alt:'Fictional green geometry fixture'}]};
entries.push(responsiveEntry);const responsiveApproval={...a,entryId:responsiveEntry.id,contentSha256:contentDigest(responsiveEntry)};
approvals.push({...responsiveApproval,signature:createHmac('sha256',fixtureKey).update(JSON.stringify(canonical({entry:responsiveEntry,approval:responsiveApproval}))).digest('hex')});
// Public-safe, entirely fictional image/control fixture. Shared pixels intentionally
// test UI routing only; they do not attest real AI generation or visual quality.
const cocktailPhoto={sha256:largeHash,width:1600,height:900,
  alt:'Fictional coloured geometry representing a cocktail photograph'};
const cocktailEntry={...base,id:'offline-cocktail-editorial',
  category:'cocktail',title:'Fictional editorial cocktail viewer',
  summary:'Fictional styling controls only.',photos:[cocktailPhoto]};
entries.push(cocktailEntry);
const cocktailApproval={...a,entryId:cocktailEntry.id,contentSha256:contentDigest(cocktailEntry),
  consents:{...a.consents,recipeVerified:true}};
approvals.push({...cocktailApproval,signature:createHmac('sha256',fixtureKey).update(
  JSON.stringify(canonical({entry:cocktailEntry,approval:cocktailApproval}))).digest('hex')});
const fictionalEditorialAsset=largeAsset.path.replace(/\.jpg$/,'-editorial-v2.jpg');
const fictionalEditorialManifest={schemaVersion:1,artDirection:'moody-atmospheric-v2',images:[{
  source:largeAsset.path,sourceSha256:largeHash,asset:fictionalEditorialAsset,
  editorialSha256:'e'.repeat(64),status:'qualified',artDirection:'moody-atmospheric-v2',
  rightsQualified:true,safetyQualified:true,visualQualified:true,
  width:1600,height:900,
  alt:'AI-stylized fictional cocktail image for offline viewer tests.',
  generationProvider:'fictional-test-only',generationModel:'no-generation',
  generationOperation:'image-edit',
  generatedAt:'2026-10-19T20:00:00Z',reviewedAt:'2026-10-19T20:01:00Z',
  reviewMethod:'ai-visual-assessment'}]};
const index=photoIndex(Array.from({length:2500},(_,i)=>({...gallery,id:'offline-photo-'+String(i).padStart(6,'0'),title:'Fictional photo '+i,summary:i===2499?'needle archival caption':'Fictional archived fixture',submittedAt:(2000+i%26)+'-10-15T12:00:00Z',year:2000+i%26})));
const annals=buildPublishedAnnals(entries,approvals,fixtureKey,history).html;
const ruleRegister={schemaVersion:1,baseline:{id:'col-browser-baseline',recordedAt:'2026-10-15T12:00:00Z',description:'Fictional browser fixture baseline.'},revisions:[{id:'col-browser-fictional',member:'marc',submittedAt:'2026-10-15T12:00:00Z',publishedAt:null,effectiveAt:null,state:'awaiting_implementation',baseVersion:'col-browser-baseline',explanation:'Fictional rule-layout fixture only.',changes:[{provision:'PRIZE',before:'## PRIZE\n'+('Fictional unchanged source text. '.repeat(40)),after:'## PRIZE\n'+('Fictional revised layout text. '.repeat(40))}],correctionOf:null}],events:[]};
const documents=new Map([['/index.html',(await readFile(path.join(root,'index.html'),'utf8')).replace(/src="https:\/\/[^\"]+"/g,'src="assets/crest.webp"')],['/location.html',(await readFile(path.join(root,'location.html'),'utf8')).replace(/src="https:\/\/[^\"]+"/g,'src="assets/crest.webp"')],['/celebration.html',(await readFile(path.join(root,'celebration.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')],['/annals.html',annals],['/history.html',renderHistory(history)],['/photos.html',await readFile(path.join(root,'photos.html'),'utf8')],['/col-revisions.html',renderRegister(ruleRegister)]]);
const metadata=new Map([['/data/annals-editorial-photos.json',fictionalEditorialManifest],['/data/photos/index.json',index.manifest],...index.pages.map(p=>['/'+p.path,p.data])]);
const ruleFixture=browserRuleFixture();
documents.set('/col-reader-fixture.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fictional rule reader</title><link rel="stylesheet" href="styles.css"><main>'+ruleFixture.html+'</main><script type="module">import {refreshOfficialRules} from "./col-rules-reader.mjs"; await refreshOfficialRules(); document.documentElement.dataset.finished="true";</script></html>');
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(metadata.has(pathname)){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(metadata.get(pathname)));return;}
  if(pathname==='/'+fictionalEditorialAsset){res.setHeader('Content-Type','image/jpeg');res.end(largeBytes);return;}
  if(pathname==='/'+largeAsset.path||pathname==='/'+thumbAsset.path){res.setHeader('Content-Type','image/jpeg');res.end(pathname==='/'+largeAsset.path?largeBytes:thumbAsset.bytes);return;}
  if(/^\/assets\/annals\/[ab]{64}\.jpg$/.test(pathname)){res.setHeader('Content-Type','image/jpeg');res.end(tinyBytes);return;}
  if(documents.has(pathname)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(documents.get(pathname));return;}
  // Public stylesheet and public brand assets only. Never serve source/data files.
  if(['/styles.css','/annals.css','/annals-browse.mjs','/monthly.mjs','/assembly.mjs','/celebration.css','/history.css','/annals-photos.css','/annals-photos.mjs','/col-rules-reader.mjs','/col-rules-witness.mjs','/col-rules-register.mjs'].includes(pathname)||pathname.startsWith('/assets/')&&!pathname.includes('..')){
    try{const bytes=await readFile(path.join(root,pathname));res.setHeader('Content-Type',pathname.endsWith('.css')?'text/css':pathname.endsWith('.mjs')?'text/javascript':'application/octet-stream');res.end(bytes);return;}catch{}
  }
  res.writeHead(404).end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profiles=[
  {name:'desktop-chromium',engine:chromium,options:{viewport:{width:1280,height:800}}},
  {name:'iphone-webkit-emulation',engine:webkit,options:devices['iPhone 13']},
  {name:'android-chromium-emulation',engine:chromium,options:devices['Pixel 7']}
];
let passed=0,failed=0;
async function check(browser,profile,name,fn,options={}){
  const context=await browser.newContext({...profile.options,locale:'en-CA',timezoneId:'America/Toronto',serviceWorkers:'block',...options});
  const external=[];
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  try{await fn(page);assert.deepEqual(external,[],'Fixture attempted external network');passed++;console.log('PASS '+profile.name+' / '+name);}
  catch(error){failed++;console.error('FAIL '+profile.name+' / '+name+' / '+error.message);}
  finally{await context.close();}
}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');}
try{
  for(const profile of profiles.filter(p=>!process.argv.includes('--chromium-only')||p.engine===chromium)){
    const browser=await profile.engine.launch();
    try{
      await check(browser,profile,'CoL complete witnessed reader and failed-release fallback',async page=>{
        let mode='failed';
        await page.route('**/*',async route=>{
          const url=route.request().url(),relative=url.startsWith(origin+'/')?url.slice(origin.length+1):url;
          if(!ruleFixture.bodies.has(relative))return route.fallback();
          let body=ruleFixture.bodies.get(relative);
          if(relative==='data/col-rules-release-state.json')body=mode==='sealed'?ruleFixture.sealedState:ruleFixture.readyState;
          if(relative.startsWith(ruleFixture.api)){
            if(mode==='sealed')return route.fulfill({status:503,body:'Fictional expired metadata'});
            if(mode==='failed'&&relative.endsWith('/jobs?per_page=100'))body=ruleFixture.failedJobs;
          }
          return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
        });
        for(const expected of ['failed','complete','sealed']){
          mode=expected;await page.goto(origin+'/col-reader-fixture.html');await page.waitForSelector('html[data-finished=true]');
          const boundary=page.locator('#official-rules');
          if(expected==='failed'){
            assert.match(await boundary.textContent(),/Previous complete fictional rule/);assert.equal(await page.locator('#rules-version-status').count(),0);
          }else{
            assert.match(await boundary.textContent(),/fictional.*member’s tokens stay unchanged/);assert.match(await page.locator('#rules-version-status').innerText(),/Rules updated January 15, 2026/);
            assert.equal(await boundary.locator('.rule-topic').count(),1);
            assert.equal(await boundary.locator('.rules-reference a').getAttribute('href'),'col-rules-version.html?version='+ruleFixture.revisionId+'&reference=1');
            await boundary.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await boundary.locator('details').getAttribute('open'),'');
          }
          await noOverflow(page);
        }
      });
      await check(browser,profile,'operative register status and fixed baseline link',async page=>{
        await page.route('**/*',async route=>{
          const url=route.request().url(),relative=url.startsWith(origin+'/')?url.slice(origin.length+1):url;
          if(!ruleFixture.bodies.has(relative))return route.fallback();
          const body=relative==='data/col-rules-release-state.json'?ruleFixture.sealedState:ruleFixture.bodies.get(relative);
          return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
        });
        await page.goto(origin+'/col-revisions.html');
        const article=page.locator('#'+ruleFixture.revisionId);
        await article.waitFor();
        assert.equal(await article.locator('[data-rule-status]').innerText(),'In effect');
        assert.doesNotMatch(await article.innerText(),/Not yet in effect|Not yet established/);
        assert.equal(await page.locator('#col-browser-baseline a').getAttribute('href'),'col-rules-version.html?version=col-browser-baseline&reference=1');
        await noOverflow(page);
      });
      await check(browser,profile,'responsive thumbnail and larger accessible viewer',async page=>{
        await page.goto(origin+'/annals.html');
        const card=page.locator('#offline-responsive-gallery'),img=card.locator('img');
        await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('#offline-responsive-gallery img').complete);
        assert.match(await img.getAttribute('src'),/-thumb\.jpg$/);assert.match(await img.getAttribute('srcset'),/400w, .* 1600w$/);
        assert.equal(await img.evaluate(e=>e.naturalWidth>0),true);
        await card.locator('[data-photo-view]').click();const dialog=page.getByRole('dialog',{name:'Photograph viewer'});await dialog.waitFor({state:'visible'});
        assert.match(await dialog.locator('img').getAttribute('src'),new RegExp(largeHash+'\\.jpg$'));
        await page.keyboard.press('Escape');assert.equal(await card.locator('[data-photo-view]').evaluate(e=>document.activeElement===e),true);await noOverflow(page);
      });
      await check(browser,profile,'fictional source-bound editorial, original and compact viewer',async page=>{
        await page.setViewportSize({width:320,height:740});
        await page.goto(origin+'/annals.html');
        const card=page.locator('#offline-cocktail-editorial');
        const opener=card.locator('a[data-photo-view]');
        await page.waitForFunction(()=>document.querySelector('#offline-cocktail-editorial a[data-editorial-src]'));
        assert.equal(await opener.getAttribute('href'),largeAsset.path);
        assert.equal(await opener.getAttribute('data-editorial-src'),fictionalEditorialAsset);
        assert.match(await card.locator('img').getAttribute('alt'),/AI-stylized fictional/);
        assert.match(await card.innerText(),/AI-stylized editorial photograph/);
        await opener.click();
        const dialog=page.getByRole('dialog',{name:'Photograph viewer'});
        await dialog.waitFor({state:'visible'});
        assert.equal(await dialog.locator('img').getAttribute('src'),fictionalEditorialAsset);
        const original=dialog.getByRole('link',{name:'Original photograph'});
        assert.equal(await original.getAttribute('href'),new URL(largeAsset.path,origin).href);
        assert.equal(await original.isVisible(),true);
        assert.equal(await dialog.locator('[data-prev]').isVisible(),false);
        assert.equal(await dialog.locator('[data-next]').isVisible(),false);
        assert.equal(await dialog.locator('.photo-viewer-controls').evaluate(e=>e.classList.contains('is-single')),true);

        for(const button of await dialog.getByRole('button').all()){
          const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44);
        }
        await noOverflow(page);
        await dialog.getByRole('button',{name:'Close'}).click();
        assert.equal(await opener.evaluate(e=>document.activeElement===e),true);
      });
      await check(browser,profile,'unqualified fictional editorial falls back to signed original',async page=>{
        await page.route('**/data/annals-editorial-photos.json',route=>route.fulfill({
          status:200,contentType:'application/json',
          body:JSON.stringify({...fictionalEditorialManifest,images:[]})
        }));
        await page.goto(origin+'/annals.html');
        const card=page.locator('#offline-cocktail-editorial');
        await page.waitForLoadState('networkidle');
        const opener=card.locator('a[data-photo-view]');
        assert.equal(await opener.getAttribute('data-editorial-src'),null);
        assert.equal(await card.locator('img').getAttribute('src'),thumbAsset.path);
        await opener.click();
        const dialog=page.getByRole('dialog',{name:'Photograph viewer'});
        await dialog.waitFor({state:'visible'});
        assert.equal(await dialog.locator('img').getAttribute('src'),new URL(largeAsset.path,origin).href);
        assert.equal(await dialog.locator('[data-original]').isVisible(),false);
        assert.equal(await dialog.locator('[data-prev]').isVisible(),false);
        assert.equal(await dialog.locator('[data-next]').isVisible(),false);
        assert.equal(await dialog.getByRole('button',{name:'Close'}).isVisible(),true);

        await noOverflow(page);
      });
      await check(browser,profile,'gallery keyboard viewer restores focus',async page=>{
        await page.goto(origin+'/annals.html');
        const opener=page.locator('#offline-browser-gallery [data-photo-view]').first();
        await opener.focus();await page.keyboard.press('Enter');
        const dialog=page.getByRole('dialog',{name:'Photograph viewer'});await dialog.waitFor({state:'visible'});
        assert.equal(await dialog.locator('[data-prev]').isVisible(),true);
        assert.equal(await dialog.locator('[data-next]').isVisible(),true);
        assert.match(await dialog.innerText(),/1 of 2/);await page.keyboard.press('ArrowRight');assert.match(await dialog.innerText(),/2 of 2/);
        await page.keyboard.press('Escape');assert.equal(await opener.evaluate(e=>document.activeElement===e),true);await noOverflow(page);
      });
      await check(browser,profile,'bounded 2500-entry Photos archive and filters',async page=>{
        const requests=[];page.on('request',r=>{if(r.url().includes('/data/photos/'))requests.push(r.url());});
        await page.goto(origin+'/photos.html');await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('entries shown'));
        assert.equal(requests.length,2);assert.ok(await page.locator('.photos-card').count()<=24);
        await page.locator('[name=year]').selectOption('2025');await page.locator('[name=search]').fill('Fictional');await page.getByRole('button',{name:'Apply filters'}).click();
        await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('entries shown'));
        assert.ok(await page.locator('.photos-card').count()<=24);await noOverflow(page);
        const first=page.locator('.photos-card [data-photo-view]').first();await first.click();await page.getByRole('dialog').waitFor({state:'visible'});await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await first.evaluate(e=>document.activeElement===e),true);
      });
      await check(browser,profile,'Photos search reports unsearched older results until Load more completes',async page=>{
        await page.goto(origin+'/photos.html');
        await page.locator('[name=year] option[value="2003"]').waitFor({state:'attached'});
        await page.locator('[name=year]').selectOption('2003');await page.locator('[name=search]').fill('needle archival caption');
        await page.getByRole('button',{name:'Apply filters'}).click();
        const status=page.locator('#photo-status'),more=page.getByRole('button',{name:'Load more',exact:true});
        await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('Searched 24 of 97'));
        assert.match(await status.innerText(),/0 entries shown.*Search incomplete.*older entries/);
        assert.doesNotMatch(await status.innerText(),/No eligible photographs match/);
        for(const covered of [48,72,96,97]){await more.click();await page.waitForFunction(n=>document.querySelector('#photo-status').textContent.includes('Searched '+n+' of 97'),covered);}
        assert.match(await status.innerText(),/1 entries shown.*Search complete/);assert.equal(await more.isVisible(),false);
        assert.equal(await page.locator('.photos-card').count(),1);await noOverflow(page);
      });
      if(profile.name==='desktop-chromium')await check(browser,profile,'a failed stale photo request cannot rewind a newer filter',async page=>{
        await page.goto(origin+'/photos.html');await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('entries shown'));
        const oldPath=index.pages.find(p=>p.year===2004).path;
        let release,entered;const blocked=new Promise(r=>entered=r),resume=new Promise(r=>release=r);
        await page.route('**/'+oldPath,async route=>{entered();await resume;await route.fulfill({status:503,body:'Fictional temporary failure'});});
        await page.locator('[name=year]').selectOption('2004');await page.getByRole('button',{name:'Apply filters'}).click();await blocked;
        await page.locator('[name=year]').selectOption('2003');await page.getByRole('button',{name:'Apply filters'}).click();
        await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('Searched 24 of 97'));
        release();await page.waitForLoadState('networkidle');
        assert.match(await page.locator('#photo-status').innerText(),/Searched 24 of 97/);
        await page.getByRole('button',{name:'Load more',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('Searched 48 of 97'));
        const links=await page.locator('.photos-card h2 a').evaluateAll(a=>a.map(e=>e.getAttribute('href')));assert.equal(new Set(links).size,48);
      });
      await check(browser,profile,'photo dialog contains keyboard focus and supports reduced motion and 320px controls',async page=>{
        await page.setViewportSize({width:320,height:740});await page.goto(origin+'/annals.html');
        const opener=page.locator('#offline-browser-gallery [data-photo-view]').first();await opener.click();
        const dialog=page.getByRole('dialog',{name:'Photograph viewer'});await dialog.waitFor({state:'visible'});
        for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}
        for(const button of await dialog.getByRole('button').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44);}
        await noOverflow(page);await page.keyboard.press('Escape');assert.equal(await opener.evaluate(e=>document.activeElement===e),true);
      },{reducedMotion:'reduce'});
      await check(browser,profile,'revision register exact comparison and permanent links',async page=>{
        await page.goto(origin+'/col-revisions.html#col-browser-fictional');
        assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('#col-browser-fictional').count(),1);
        assert.match(await page.locator('main').innerText(),/Not yet in effect/);assert.match(await page.locator('main').innerText(),/Toronto/);
        await page.locator('main details summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('main details').getAttribute('open'),'');
        assert.match(await page.locator('pre').first().innerText(),/Fictional unchanged source text/);assert.match(await page.locator('pre').last().innerText(),/Fictional revised layout text/);await noOverflow(page);
      });
      await check(browser,profile,'all public pages reflow at 320px with the shared navigation',async page=>{
        await page.setViewportSize({width:320,height:760});
        for(const file of ['index.html','location.html','celebration.html','annals.html','history.html','photos.html','col-revisions.html']){
          await page.goto(origin+'/'+file);
          assert.equal(await page.locator('header.site-header').count(),1,file);
          assert.ok(await page.locator('.mobile-site-navigation').isVisible(),file+' menu');
          assert.equal(await page.locator('.mobile-site-navigation nav a').count(),5,file+' menu links');
          await noOverflow(page);
        }
      });
      await check(browser,profile,'monthly-first homepage and discoverable site navigation',async page=>{
        await page.goto(origin+'/index.html');
        const hero=page.locator('main > section.monthly-hero');
        assert.equal(await hero.getAttribute('id'),'monthly-stammtisch');
        assert.match(await hero.locator('h1').innerText(),/The next Stammtisch/);
        await page.waitForFunction(()=>/^\d{4}-\d{2}-\d{2}$/.test(
          document.querySelector('[data-monthly-date]').getAttribute('datetime')||''));
        assert.match(await hero.innerText(),/8 p.m. Toronto time/);
        assert.equal(await page.locator('header.site-header nav[aria-label="Main navigation"] a').count(),5);
        if(profile.name==='desktop-chromium'){
          assert.ok(await page.locator('header.site-header nav[aria-label="Main navigation"]').isVisible());
          assert.equal(await page.locator('.mobile-site-navigation').isVisible(),false);
        }else{
          const menu=page.locator('.mobile-site-navigation');
          assert.ok(await menu.isVisible());
          await menu.locator('summary').click();
          assert.equal(await menu.getAttribute('open'),'');
          for(const link of await menu.locator('nav a').all()){
            const box=await link.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Mobile menu target');
          }
          await menu.getByRole('link',{name:'The Annals'}).click();
          await page.waitForURL(origin+'/annals.html');
        }
        await noOverflow(page);
      });
      await check(browser,profile,'chronological cards and accessible category filtering',async page=>{
        await page.goto(origin+'/annals.html');
        const cards=page.locator('.annal-stream .annal-entry');
        assert.equal(await cards.count(),7);
        assert.equal(await cards.first().getAttribute('id'),'offline-browser-quote');
        const columns=await page.locator('.annal-stream').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
        assert.equal(columns,profile.name==='desktop-chromium'?2:1);
        await page.getByRole('link',{name:'Remarks',exact:true}).click();
        assert.equal(await page.locator('.annal-stream .annal-entry:visible').count(),1);
        assert.equal(await page.locator('.annal-stream .annal-entry:visible').first().getAttribute('id'),'offline-browser-quote');
        assert.match(await page.locator('#annal-result-count').innerText(),/1 entry shown/);
        assert.match(page.url(),/#collection-quotation$/);
        await page.reload();
        assert.equal(await page.locator('.annal-stream .annal-entry:visible').count(),1);
        await page.getByRole('link',{name:'All entries',exact:true}).click();
        assert.equal(await page.locator('.annal-stream .annal-entry:visible').count(),7);
        assert.equal(await page.locator('#offline-browser-recipe .annal-entry-link').getAttribute('href'),'#offline-browser-recipe');
        await noOverflow(page);
      });
      await check(browser,profile,'recipe fidelity and whole narrative',async page=>{
        await page.goto(origin+'/annals.html');
        const card=page.locator('#offline-browser-recipe');
        assert.equal(await card.locator('.annal-summary').innerText(),'The rain inspired this drink.');
        const text=await card.innerText();
        for(const line of Object.values(recipe).flat())assert.equal(text.split(line).length-1,1,line);
        for(const label of ['Ingredients','Homemade syrup','Preparation','Editorial suggestions'])assert.ok(text.toLowerCase().includes(label.toLowerCase()));
        assert.equal(await page.locator('#offline-browser-recipe-only .annal-summary').count(),0);
        await noOverflow(page);
      });
      await check(browser,profile,'dates and event/receipt separation',async page=>{
        await page.goto(origin+'/annals.html');
        assert.equal(await page.locator('#offline-browser-recipe .annal-date').innerText(),'Submitted December 2026');
        assert.equal(await page.locator('#offline-browser-quote .annal-date').innerText(),'Submitted January 2027');
        assert.doesNotMatch(await page.locator('body').innerText(),/Submitted \d{4}-\d{2}/);
        await page.goto(origin+'/history.html');assert.equal(await page.locator('.history-meta').first().innerText(),'Updated January 2027');
        assert.match(await page.locator('main').innerText(),/Historical uncertainty: an approximate period only/);
      });
      await check(browser,profile,'opaque bars, safe selectable text and quotation notice',async page=>{
        await page.goto(origin+'/annals.html');
        const bar=page.locator('#offline-browser-quote .annal-redaction');
        assert.equal(await bar.innerText(),'[expletive]');
        const style=await bar.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {background:s.backgroundColor,colour:s.color,width:r.width,height:r.height};});
        assert.equal(style.background,'rgb(0, 0, 0)');assert.equal(style.colour,'rgba(0, 0, 0, 0)');assert.ok(style.width>0&&style.height>0);
        assert.equal(await bar.evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);return s.toString();}),'[expletive]');
        assert.match(await page.locator('#offline-browser-quote').innerText(),/Editorially redacted quotation — not verbatim\./);
        assert.match(await page.locator('#offline-browser-quote').innerText(),/\[POOP\].*damn/);
        assert.doesNotMatch(await page.content(),/\[EXPLETIVE\]/);
        assert.equal(await bar.getAttribute('aria-hidden'),null);
        const accessible=await page.locator('#offline-browser-quote').ariaSnapshot();
        assert.match(accessible,/\[expletive\]/);assert.match(accessible,/Editorially redacted quotation/);
      });
      await check(browser,profile,'lowercase fallback with stylesheet unavailable',async page=>{
        await page.goto(origin+'/annals.html');
        await page.evaluate(()=>{for(const sheet of document.styleSheets)sheet.disabled=true;});
        const bar=page.locator('#offline-browser-quote .annal-redaction');
        assert.equal(await bar.innerText(),'[expletive]');assert.notEqual(await bar.evaluate(e=>getComputedStyle(e).color),'rgba(0, 0, 0, 0)');
      });
      await check(browser,profile,'keyboard skip, focus and contribution targets',async page=>{
        for(const file of ['annals.html','history.html']){
          await page.goto(origin+'/'+file);await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Skip to content');
          await page.keyboard.press('Enter');await page.keyboard.press('Tab');
          assert.ok(await page.evaluate(()=>document.querySelector('main').contains(document.activeElement)));
          assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');
          assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('main').count(),1);
          for(const link of await page.locator('nav a,main a,footer a').all())if(await link.isVisible())assert.ok((await link.boundingBox()).height>=44,'Small link target');
        }
      });
      await check(browser,profile,'form control focus visibility and 320px reflow',async page=>{
        await page.goto(origin+'/annals.html');
        // Fictional controls exercise the real shared stylesheet, not live data.
        await page.evaluate(()=>{
          const fixture=document.createElement('div');
          fixture.innerHTML='<label for="fictional-focus-field">Fictional search</label><input id="fictional-focus-field" type="search"><button id="fictional-focus-button" type="button">Fictional reset</button>';
          document.querySelector('main').append(fixture);
        });
        const search=page.locator('#fictional-focus-field'),reset=page.locator('#fictional-focus-button');
        await search.focus();
        assert.equal(await search.evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
        await page.keyboard.press('Tab');
        assert.equal(await reset.evaluate(e=>document.activeElement===e),true);
        assert.equal(await reset.evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
        await page.setViewportSize({width:320,height:740});
        await noOverflow(page);
      });
      await check(browser,profile,'320px populated reflow and chapter readability',async page=>{
        await page.setViewportSize({width:320,height:740});
        for(const file of ['annals.html','history.html']){await page.goto(origin+'/'+file);await noOverflow(page);}
        assert.ok(await page.locator('main').evaluate(e=>e.getBoundingClientRect().width)<=320);
        assert.equal(await page.locator('section h2').count(),2);
        assert.ok(parseFloat(await page.locator('section p').first().evaluate(e=>getComputedStyle(e).fontSize))>=16);
      });
      await check(browser,profile,'dark preference keeps safe redaction and layout',async page=>{
        await page.goto(origin+'/annals.html');await noOverflow(page);
        assert.equal(await page.locator('#offline-browser-quote .annal-redaction').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)');
      },{colorScheme:'dark'});
      if(profile.name==='desktop-chromium')await check(browser,profile,'forced-colours readable fallback',async page=>{
        await page.goto(origin+'/annals.html');
        const bar=page.locator('#offline-browser-quote .annal-redaction');
        assert.equal(await bar.innerText(),'[expletive]');assert.notEqual(await bar.evaluate(e=>getComputedStyle(e).color),'rgba(0, 0, 0, 0)');
        assert.equal(await bar.evaluate(e=>getComputedStyle(e).overflow),'visible');
      },{forcedColors:'active'});
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({checks:passed+failed,passed,failed,scope:'Fictional offline browser emulation; no physical device or screen reader'}));
if(failed)process.exitCode=1;
