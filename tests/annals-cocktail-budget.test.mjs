/* Fully fictional, offline test of the ONE owner-issued spending ledger.
 * No provider calls, Apps Script credentials, actual consent or Drive data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONTHLY_CENTS,PHOTO_CENTS,torontoPeriod,validateBudgetLedger,
  verifyIssuedCocktailBudget,imageSpendCents,reviewSpendCents,enforceTotalSpend
} from '../scripts/annals/CocktailEditorialBudget.mjs';

const id='fictional-a',source='a'.repeat(64);
const savedAt='2026-10-20T15:00:00Z',now=new Date('2026-10-20T15:03:00Z');
const reservation={entryId:id,sourceSha256:source,period:'2026-10',
  reservationCents:200,reservedAt:savedAt};
const ledger={schemaVersion:1,monthlyCeilingCents:500,
  perPhotoCeilingCents:200,reservations:[reservation]};
const permit={entryId:id,sourceSha256:source,budgetPeriod:'2026-10',
  budgetReserved:true,monthlyCeilingCents:500,perPhotoCeilingCents:200,
  reservedCents:200,issuedAt:'2026-10-20T15:00:00Z'};
const check=(l=ledger,p=permit,e=id,s=source)=>
  verifyIssuedCocktailBudget({ledger:l,permit:p,entryId:e,sourceSha256:s,now});

test('Toronto month and owner ceilings retain the exact authorised bounds',()=>{
  assert.equal(MONTHLY_CENTS,500);
  assert.equal(PHOTO_CENTS,200);
  assert.equal(torontoPeriod(new Date('2026-11-01T03:59:59Z')),'2026-10');
  assert.equal(torontoPeriod(new Date('2026-11-01T04:00:00Z')),'2026-11');
  assert.equal(torontoPeriod(new Date('2027-01-01T04:59:59Z')),'2026-12');
  assert.equal(torontoPeriod(new Date('2027-01-01T05:00:00Z')),'2027-01');
});

test('read-only verification recognises exactly one durable owner-issued reservation',()=>{
  assert.deepEqual(check(),reservation);
  assert.equal(Object.isFrozen(check()),true);
  assert.equal(ledger.reservations.length,1);
  assert.equal(ledger.reservations[0],reservation);
  // A separate second eligible reservation is valid, but a third would
  // exceed the USD 5 cap even with USD 1 notionally unspent.
  const second={...reservation,entryId:'fictional-b',
    sourceSha256:'b'.repeat(64)};
  assert.equal(validateBudgetLedger({...ledger,reservations:[reservation,second]}).reservations.length,2);
  assert.throws(()=>validateBudgetLedger({...ledger,reservations:[
    reservation,second,{...reservation,entryId:'fictional-c',
      sourceSha256:'c'.repeat(64)}]}),/oversubscribed/);
});

test('missing or duplicate source, mismatched permit, wrong month and pre-reservation issue fail closed',()=>{
  const second={...reservation,entryId:'fictional-b',
    sourceSha256:'b'.repeat(64)};
  for(const [l,p,e,s] of [
    [{...ledger,reservations:[]},permit,id,source],
    [ledger,{...permit,budgetPeriod:'2026-11'},id,source],
    [ledger,{...permit,budgetReserved:false},id,source],
    [ledger,{...permit,monthlyCeilingCents:600},id,source],
    [ledger,{...permit,perPhotoCeilingCents:300},id,source],
    [ledger,{...permit,reservedCents:100},id,source],
    [ledger,{...permit,issuedAt:'2026-10-20T14:59:59Z'},id,source],
    [ledger,{...permit,issuedAt:'invalid'},id,source],
    [ledger,{...permit,entryId:'fictional-b'},id,source],
    [ledger,{...permit,sourceSha256:'b'.repeat(64)},id,source],
    [{...ledger,reservations:[second]},permit,id,source],
    [{...ledger,reservations:[reservation,reservation]},permit,id,source],
    [ledger,permit,'fictional-b',source],
    [ledger,permit,id,'b'.repeat(64)]
  ]){
    assert.throws(()=>check(l,p,e,s),/invalid|inconsistent|oversubscribed/i);
  }
});

test('provider costs remain independently estimated, unknown usage fails closed',()=>{
  assert.equal(imageSpendCents({input_tokens_details:{image_tokens:100000,text_tokens:20000},
    output_tokens_details:{image_tokens:30000}}),180);
  assert.equal(reviewSpendCents({prompt_tokens:1000,completion_tokens:200}),1);
  assert.equal(enforceTotalSpend({editCents:180,reviewCents:1}),181);
  assert.equal(imageSpendCents({input_tokens:123}),null);
  assert.equal(imageSpendCents({
    input_tokens:120000,input_tokens_details:{image_tokens:100000,text_tokens:20000},
    output_tokens:30000
  }),180);
  assert.equal(imageSpendCents({input_tokens:120000,output_tokens:30000}),186);
  assert.equal(imageSpendCents({
    input_tokens:120000,input_tokens_details:{image_tokens:100000,text_tokens:20000},
    output_tokens:30000,output_tokens_details:{image_tokens:20000,text_tokens:0}
  }),180);
  assert.equal(imageSpendCents({input_tokens:10,output_tokens:-1}),null);
  assert.equal(imageSpendCents({input_tokens_details:{image_tokens:'0',text_tokens:30},output_tokens:100}),null);
  assert.equal(imageSpendCents({input_tokens:20,output_tokens:NaN}),null);
  assert.equal(reviewSpendCents({total_tokens:123}),null);
  assert.throws(()=>enforceTotalSpend({editCents:180,reviewCents:null}),/unknown/);
  assert.throws(()=>enforceTotalSpend({editCents:201}),/limit/);
  assert.throws(()=>enforceTotalSpend({editCents:150,reviewCents:51}),/limit/);
});
