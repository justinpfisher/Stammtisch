import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Fictional owner-only ScriptApp API. No real accounts, triggers or credentials.
const source=readFileSync(new URL('../scripts/annals/GuardedRelease.gs',import.meta.url),'utf8');
function fixture({authorized=true,wrongHandler=false,oldDeletionFails=false,createFails=false}={}){
  const old={id:'old',getHandlerFunction:()=>wrongHandler?'unrelated':'runAnnalsProductionIntake',getUniqueId:()=> 'old'};
  const replacement={id:'new',getHandlerFunction:()=> 'runAnnalsProductionIntake',getUniqueId:()=> 'new'};
  const triggers=[old],actions=[],ctx={
    annalsOwner_:()=>{actions.push('owner');if(!authorized)throw Error('Owner required')},
    ScriptApp:{
      getProjectTriggers:()=>triggers.slice(),
      newTrigger:name=>{
        actions.push('new:'+name);
        if(createFails)throw Error('Provider unavailable');
        return {timeBased:()=>({
          everyMinutes:minutes=>{actions.push('minutes:'+minutes);return {
            create:()=>{triggers.push(replacement);actions.push('created');return replacement}
          }}
        })};
      },
      deleteTrigger:t=>{
        actions.push('delete:'+t.id);
        if(t===old && oldDeletionFails)throw Error('Cannot remove old trigger');
        const index=triggers.indexOf(t);if(index>=0)triggers.splice(index,1);
      }
    }
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {run:()=>ctx.annalsUseFiveMinuteIntakeInEditor(),triggers,actions,old,replacement};
}

test('one owner action replaces the old trigger with a single five-minute trigger',()=>{
  const f=fixture(),r=f.run();
  assert.equal(r.singleTrigger,true);
  assert.equal(r.cadenceMinutes,5);
  assert.equal(r.sourceDeploymentChanged,false);
  assert.equal(r.privateStateChanged,false);
  assert.deepEqual(f.triggers,[f.replacement]);
  assert.deepEqual(f.actions,['owner','new:runAnnalsProductionIntake','minutes:5',
    'created','delete:old']);
});

test('non-owner invocation and unexpected existing trigger never change schedule',()=>{
  for(const config of [{authorized:false},{wrongHandler:true}]){
    const f=fixture(config);
    assert.throws(()=>f.run());
    assert.deepEqual(f.triggers,[f.old]);
    assert.ok(!f.actions.some(x=>x==='created'));
  }
});

test('failed create and failed old-trigger removal do not leave duplicate triggers',()=>{
  const a=fixture({createFails:true});assert.throws(()=>a.run());
  assert.deepEqual(a.triggers,[a.old]);
  const b=fixture({oldDeletionFails:true});
  assert.throws(()=>b.run(),/replacement incomplete/);
  assert.deepEqual(b.triggers,[b.old],'new trigger is rolled back after deletion failure');
  assert.ok(b.actions.includes('delete:new'));
});

test('source contains no automatic invocation or new deployment / consent mutation',()=>{
  assert.equal((source.match(/function annalsUseFiveMinuteIntakeInEditor\(/g)||[]).length,1);
  const body=source.split('function annalsUseFiveMinuteIntakeInEditor(){',2)[1];
  assert.ok(body.includes('.everyMinutes(5).create()'));
  assert.doesNotMatch(body,/setProperty\(|deploy|ANNALS_ALLOWED_SENDERS|ANNALS_APPROVAL_KEY|sendEmail\(/);
});
