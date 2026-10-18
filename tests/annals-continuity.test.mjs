import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function source(name) {
  return readFileSync(new URL('../scripts/annals/' + name, import.meta.url), 'utf8');
}

test('no arbitrary November AI deadline remains across owner-only and hosted paths', () => {
  for (const name of ['Production.gs','HistoryProduction.gs','RulesProduction.gs',
    'GuardedRelease.gs','PhotoProduction.gs','apply-approved-entry.mjs']) {
    assert.doesNotMatch(source(name), /2026-11-08T00:00:00Z/, name);
  }
  assert.match(source('Production.gs'), /ANNALS_AI_ENABLED/);
  assert.match(source('Production.gs'), /ANNALS_BUDGET_LEDGER/);
  assert.match(source('GuardedRelease.gs'), /ANNALS_PHOTOS_GUARDED_JPEG_ENABLED/);
});

test('publisher clock is fail-closed and can be extended only by recorded real token expiry', () => {
  const props = {};
  let now = Date.parse('2026-11-08T23:59:59Z');
  class Clock extends Date { static now() {return now;} }
  const c = vm.createContext({Date:Clock,annalsProps_:()=>({getProperty:key=>props[key]||null})});
  vm.runInContext(source('Production.gs'),c);
  c.annalsProps_=()=>({getProperty:key=>props[key]||null});
  assert.equal(c.annalsPublisherDispatchReady_(),true);
  now = Date.parse('2026-11-09T00:00:00Z');
  assert.equal(c.annalsPublisherDispatchReady_(),false);
  props.ANNALS_GITHUB_TOKEN_EXPIRES_AT='2027-10-18T00:00:00Z';
  assert.equal(c.annalsPublisherDispatchReady_(),true);
  now=Date.parse('2027-10-18T00:00:00Z');
  assert.equal(c.annalsPublisherDispatchReady_(),false);
  for (const invalid of ['garbage','2027-13-18T00:00:00Z','2027-02-30T00:00:00Z','2027-10-18','2027-10-18T00:00:00+00:00']) {
    props.ANNALS_GITHUB_TOKEN_EXPIRES_AT=invalid;
    now=Date.parse('2026-10-18T12:00:00Z');
    assert.equal(c.annalsPublisherDispatchReady_(),false,invalid);
  }
});

test('automatic processing and signed photo upload preflight before the AI call or public blob operation',()=>{
  const production=source('Production.gs'),history=source('HistoryProduction.gs'),
    rules=source('RulesProduction.gs'),photos=source('PhotoProduction.gs');
  assert.match(production,/intakeLockHeld === true && !annalsPublisherDispatchReady_\(\)/);
  assert.match(production,/if \(!annalsPublisherDispatchReady_\(\)\) return false;/);
  assert.match(history,/!annalsPublisherDispatchReady_\(\)/);
  assert.match(rules,/!annalsPublisherDispatchReady_\(\)/);
  assert.equal((photos.match(/!annalsPublisherDispatchReady_\(\)/g)||[]).length,2);
});

test('one-shot reservation still fails closed at the unchanged US$5 monthly cap',()=>{
  const c=vm.createContext({});
  vm.runInContext(source('ProductionCore.js'),c);
  const base={schemaVersion:1,month:'2027-01',reservedCents:490};
  assert.equal(c.AnnalsProduction.reserve(base,'2027-01').reservedCents,500);
  assert.throws(()=>c.AnnalsProduction.reserve({...base,reservedCents:500},'2027-01'));
  assert.equal(c.AnnalsProduction.reserve({...base,reservedCents:500},'2027-02').reservedCents,10);
});
