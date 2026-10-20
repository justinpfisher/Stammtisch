/* Offline-only private budget and one-shot risk tests; no provider network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {
 MONTHLY_CENTS,PHOTO_CENTS,torontoPeriod,validateBudgetLedger,
 imageSpendCents,reviewSpendCents,enforceTotalSpend,reserveCocktailBudget
} from '../scripts/annals/CocktailEditorialBudget.mjs';

const fakePermit=(id,hash,month='2026-10')=>({
 entryId:id,sourceSha256:hash,budgetPeriod:month,
 monthlyCeilingCents:500,perPhotoCeilingCents:200,
 reservedCents:200,budgetReserved:true
});
async function withDir(fn){
 const dir=await mkdtemp(path.join(tmpdir(),'stammtisch-cocktail-budget-'));
 try{return await fn(dir)}finally{await rm(dir,{recursive:true,force:true})}
}
const reserve=(directory,id,hash,month,date)=>reserveCocktailBudget({
 directory,entryId:id,sourceSha256:hash,
 permit:fakePermit(id,hash,month),now:new Date(date)
});
test('owner ceilings are exact USD 5/Toronto month and USD 2 per cocktail',()=>{
 assert.equal(MONTHLY_CENTS,500);assert.equal(PHOTO_CENTS,200);
 assert.equal(torontoPeriod(new Date('2026-11-01T03:59:59Z')),'2026-10');
 assert.equal(torontoPeriod(new Date('2026-11-01T04:00:00Z')),'2026-11');
 assert.equal(torontoPeriod(new Date('2027-01-01T04:59:59Z')),'2026-12');
 assert.equal(torontoPeriod(new Date('2027-01-01T05:00:00Z')),'2027-01');
});
test('two photos consume USD 4; third is held even under remaining USD 1',async()=>{
 await withDir(async directory=>{
   const when='2026-10-20T15:00:00Z';
   const first=await reserve(directory,'fictional-a','a'.repeat(64),'2026-10',when);
   const second=await reserve(directory,'fictional-b','b'.repeat(64),'2026-10',when);
   assert.equal(first.reservationCents,200);
   assert.equal(second.reservationCents,200);
   await assert.rejects(reserve(directory,'fictional-c','c'.repeat(64),'2026-10',when),
     /USD 5.*budget exhausted/);
   const ledger=JSON.parse(await readFile(path.join(directory,'cocktail-editorial-budget-private.json'),'utf8'));
   assert.equal(validateBudgetLedger(ledger),ledger);
   assert.equal(ledger.reservations.length,2);
   assert.deepEqual(ledger.reservations.map(r=>r.sourceSha256),['a'.repeat(64),'b'.repeat(64)]);
 });
});
test('same signed photo cannot retry in a new budget month',async()=>{
 await withDir(async directory=>{
   await reserve(directory,'fictional-a','a'.repeat(64),'2026-10','2026-10-20T15:00:00Z');
   await assert.rejects(reserve(directory,'fictional-a','a'.repeat(64),'2026-11',
     '2026-11-20T15:00:00Z'),/already reserved/);
   const next=await reserve(directory,'fictional-b','b'.repeat(64),'2026-11','2026-11-20T15:00:00Z');
   assert.equal(next.period,'2026-11');
 });
});
test('invalid signed scope, increased caps or wrong period cannot reserve',async()=>{
 await withDir(async directory=>{
   for(const patch of [
     {budgetPeriod:'2026-11'},{monthlyCeilingCents:600},
     {perPhotoCeilingCents:300},{reservedCents:100},{budgetReserved:false},
     {entryId:'different'},{sourceSha256:'e'.repeat(64)}
   ]){
     const id='fictional-a',hash='a'.repeat(64);
     await assert.rejects(reserveCocktailBudget({directory,entryId:id,
       sourceSha256:hash,permit:{...fakePermit(id,hash),...patch},
       now:new Date('2026-10-20T15:00:00Z')}),/authorisation/);
   }
   assert.deepEqual(await readdir(directory),[]);
 });
});
test('pre-existing one-shot marker cannot be evaded by deleting the budget ledger',async()=>{
 await withDir(async directory=>{
   await writeFile(path.join(directory,'abc-attempt-private.json'),'{}');
   await assert.rejects(reserve(directory,'fictional-a','a'.repeat(64),
     '2026-10','2026-10-20T15:00:00Z'),/Existing one-shot evidence/);
   assert.equal((await readdir(directory)).includes('cocktail-editorial-budget-private.json'),false);
 });
});
test('invalid ledger, duplicate source or oversubscribed month is rejected before billing',async()=>{
 await withDir(async directory=>{
   const a={entryId:'fictional-a',sourceSha256:'a'.repeat(64),
     period:'2026-10',reservationCents:200,reservedAt:'2026-10-20T15:00:00Z'};
   const ledger={schemaVersion:1,monthlyCeilingCents:500,perPhotoCeilingCents:200,
     reservations:[a,a]};
   await writeFile(path.join(directory,'cocktail-editorial-budget-private.json'),JSON.stringify(ledger));
   await assert.rejects(reserve(directory,'fictional-b','b'.repeat(64),
     '2026-10','2026-10-20T15:00:00Z'),/corrupt/);
   const entries=[a,{...a,entryId:'fictional-b',sourceSha256:'b'.repeat(64)},
     {...a,entryId:'fictional-c',sourceSha256:'c'.repeat(64)}];
   assert.throws(()=>validateBudgetLedger({...ledger,reservations:entries}),/oversubscribed/);
 });
});
test('an existing lock stops parallel calls without guessing prior provider outcome',async()=>{
 await withDir(async directory=>{
   await writeFile(path.join(directory,'cocktail-editorial-budget.lock'),'locked');
   await assert.rejects(reserve(directory,'fictional-a','a'.repeat(64),
     '2026-10','2026-10-20T15:00:00Z'),/budget lock unavailable/);
   assert.equal((await readdir(directory)).includes('cocktail-editorial-budget.lock'),true);
 });
});
test('model usage is priced separately and unknown usage fails closed',()=>{
 assert.equal(imageSpendCents({input_tokens_details:{image_tokens:100000,text_tokens:20000},
   output_tokens_details:{image_tokens:30000}}),180);
 assert.equal(reviewSpendCents({prompt_tokens:1000,completion_tokens:200}),1);
 assert.equal(enforceTotalSpend({editCents:180,reviewCents:1}),181);
 assert.equal(imageSpendCents({input_tokens:123}),null);
 // Image Edit responses may omit the optional output breakdown while still
 // reporting total output tokens; these must not be mistaken for free requests.
 assert.equal(imageSpendCents({
   input_tokens:120000,input_tokens_details:{image_tokens:100000,text_tokens:20000},
   output_tokens:30000
 }),180);
 assert.equal(imageSpendCents({input_tokens:120000,output_tokens:30000}),186);
 assert.equal(imageSpendCents({
   input_tokens:120000,input_tokens_details:{image_tokens:100000,text_tokens:20000},
   output_tokens:30000,output_tokens_details:{image_tokens:20000,text_tokens:0}
 }),180);
 // Reject garbage and incomplete provider usage, rather than sending a second
 // chargeable request based on an invented zero.
 assert.equal(imageSpendCents({input_tokens:10,output_tokens:-1}),null);
 assert.equal(imageSpendCents({input_tokens_details:{image_tokens:'0',text_tokens:30},output_tokens:100}),null);
 assert.equal(imageSpendCents({input_tokens:20,output_tokens:NaN}),null);
 assert.equal(reviewSpendCents({total_tokens:123}),null);
 assert.throws(()=>enforceTotalSpend({editCents:180,reviewCents:null}),/unknown/);
 assert.throws(()=>enforceTotalSpend({editCents:201}),/limit/);
 assert.throws(()=>enforceTotalSpend({editCents:150,reviewCents:51}),/limit/);
});
