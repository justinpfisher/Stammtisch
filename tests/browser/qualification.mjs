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
import {renderHistory} from '../../scripts/annals/HistoryPublisher.mjs';

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
const annals=buildPublishedAnnals(entries,approvals,fixtureKey,history).html;
const documents=new Map([['/annals.html',annals],['/history.html',renderHistory(history)]]);
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(documents.has(pathname)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(documents.get(pathname));return;}
  // Public stylesheet and public brand assets only. Never serve source/data files.
  if(pathname==='/styles.css'||pathname.startsWith('/assets/')&&!pathname.includes('..')){
    try{const bytes=await readFile(path.join(root,pathname));res.setHeader('Content-Type',pathname.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes);return;}catch{}
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
  for(const profile of profiles){
    const browser=await profile.engine.launch();
    try{
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
