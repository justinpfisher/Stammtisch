import test from 'node:test';
import assert from 'node:assert/strict';
import {OLDEST_DEATH_STEAL_CLAUSE,verifiedAwardPolicy} from '../col-award-policy.mjs';

const now=Date.parse('2026-11-01T12:00:00Z');
function witnessed(overrides={}){
  return {candidateDigest:'b'.repeat(64),version:{
    verified:true,effectiveAt:'2026-10-17T19:00:00Z',
    provisions:{'DRAFT - ORDER OF BUSINESS':'## DRAFT - ORDER OF BUSINESS\n\n'+OLDEST_DEATH_STEAL_CLAUSE},
    ...overrides
  }};
}

test('oldest-death benefit is absent from baseline, unsigned and unverified releases',()=>{
  assert.equal(verifiedAwardPolicy(null,now).oldestDeathSteal,false);
  assert.equal(verifiedAwardPolicy({version:witnessed().version},now).oldestDeathSteal,false);
  assert.equal(verifiedAwardPolicy(witnessed({verified:false}),now).oldestDeathSteal,false);
  assert.equal(verifiedAwardPolicy(witnessed({effectiveAt:'2026-12-01T19:00:00Z'}),now).oldestDeathSteal,false);
  assert.equal(verifiedAwardPolicy(witnessed({provisions:{'DRAFT - ORDER OF BUSINESS':'## DRAFT - ORDER OF BUSINESS\n\nOldest death gets a Steal.'}}),now).oldestDeathSteal,false);
});

test('prequalified full operative snapshots may enable only the canonical supported clause',()=>{
  const snapshot=witnessed();
  assert.equal(verifiedAwardPolicy(snapshot,now).oldestDeathSteal,true);
  assert.equal(verifiedAwardPolicy(snapshot,Date.parse('2026-10-17T18:59:59Z')).oldestDeathSteal,false);
  assert.equal(verifiedAwardPolicy({...snapshot,candidateDigest:'not-a-hash'},now).oldestDeathSteal,false);
});
