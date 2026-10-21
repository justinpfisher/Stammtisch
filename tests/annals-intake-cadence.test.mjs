import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/annals/IntakeCadence.gs',import.meta.url),'utf8');

function fixture({existing=1,canDelete=true,enabled=true,authorised=true}={}){
  const props={ANNALS_PRODUCTION_INTAKE_ENABLED:enabled?'true':'false'};
  let next=1,creations=0,deleted=0,locks=0;
  const make=()=>({id:next++,getHandlerFunction:()=> 'runAnnalsProductionIntake'});
  let triggers=Array.from({length:existing},make);
  const context={
    annalsOwner_:()=>{if(!authorised)throw Error('Owner access required')},
    annalsLocked_:fn=>{locks++;return fn()},
    annalsProps_:()=>({getProperty:key=>props[key]||null,
      setProperty:(key,value)=>{props[key]=value}}),
    ScriptApp:{
      getProjectTriggers:()=>[...triggers],
      newTrigger:handler=>{
        assert.equal(handler,'runAnnalsProductionIntake');
        return {timeBased(){return this},everyMinutes(minutes){
          assert.equal(minutes,5);return this},
          create(){creations++;const trigger=make();triggers.push(trigger);return trigger}};
      },
      deleteTrigger:trigger=>{
        if(!canDelete)throw Error('Fake delete failure');
        assert.ok(triggers.includes(trigger));
        triggers=triggers.filter(x=>x!==trigger);
        deleted++;
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source,context);
  return {run:()=>context.annalsSetFiveMinuteIntakeInEditor(),
    get state(){return {triggers:[...triggers],props,creations,deleted,locks}}};
}
test('one owner action replaces 15-minute intake without parallel permanent triggers',()=>{
  const v=fixture();
  const result=v.run();
  assert.equal(result.configured,true);
  assert.equal(result.intervalMinutes,5);
  assert.equal(result.triggerCount,1);
  assert.equal(result.alreadyConfigured,false);
  assert.equal(v.state.triggers.length,1);
  assert.equal(v.state.props.ANNALS_INTAKE_CADENCE_MINUTES,'5');
  assert.equal(v.state.creations,1);
  assert.equal(v.state.deleted,1);
  assert.equal(v.state.locks,1);
  const again=v.run();
  assert.equal(again.alreadyConfigured,true);
  assert.equal(v.state.creations,1,'the existing five-minute trigger is not recreated');
});
test('missing, duplicate or disabled triggers cause no mutation',()=>{
  for(const options of [{existing:0},{existing:2},{enabled:false}]){
    const v=fixture(options);
    assert.throws(()=>v.run());
    assert.equal(v.state.creations,0);
    assert.equal(v.state.deleted,0);
    assert.equal(v.state.props.ANNALS_INTAKE_CADENCE_MINUTES,undefined);
  }
});
test('owner authentication is required before any trigger read or write',()=>{
  const v=fixture({authorised:false});
  assert.throws(()=>v.run(),/Owner access required/);
  assert.equal(v.state.creations,0);
});
test('failed original-trigger deletion retains original and does not mark new schedule',()=>{
  const v=fixture({canDelete:false});
  assert.throws(()=>v.run(),/replacement failed/);
  assert.equal(v.state.props.ANNALS_INTAKE_CADENCE_MINUTES,undefined);
  // A provider-side delete failure still requires owner inspection, never
  // a false report that one five-minute trigger is installed and verified.
  assert.equal(v.state.creations,1);
});
