import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { awardEvents, calculateAwards, awardsMarkup, draftMarkup } from '../celebration-awards.mjs';

const source = JSON.parse(readFileSync(new URL('../data/celebration.json', import.meta.url), 'utf8'));
const pick = (name, fields = {}) => ({ pick:2, name, born:'1950-01-01', counted:true, points:24, discoveryDate:'2026-02-01', actualDeathDate:'2026-01-30', ...fields });
const member = (id, score, picks = []) => ({ id, name:id, score, picks });
const season = members => ({ year:2026, asOf:'2026-09-19', members });
const card = (model,id) => model.cards.find(c => c.id === id);

test('current register produces provisional leaders, preserves scores and excludes BB from vacancies', () => {
  const before = JSON.stringify(source);
  const model = calculateAwards(source);
  assert.equal(card(model,'pool-prize').value,'Jerome');
  assert.equal(card(model,'pool-prize').status,'Leading');
  assert.equal(card(model,'devils-share').value,'Justin');
  assert.equal(card(model,'youngest').value,'Matt & Marc');
  assert.equal(card(model,'rainmaker').value,'Marc');
  assert.equal(card(model,'droughtmaker').value,'Ken');
  assert.equal(card(model,'copycat').value,'2 matching pick positions');
  assert.deepEqual(model.draft.map(m => m.id), ['fish','jamie','ken','marc','matt','jerome']);
  assert.equal(model.draft.find(m => m.id === 'ken').vacancies,1);
  assert.equal(model.draft.find(m => m.id === 'jerome').benefits[0].confirmed,false);
  assert.match(card(model,'birthday-buffet').details.join(' '),/Matt 12, Ken 13/);
  assert.match(card(model,'birthday-buffet').details.join(' '),/Group vote approved/);
  assert.doesNotMatch(card(model,'birthday-buffet').details.join(' '),/flagged for review/);
  assert.equal(model.events.find(x=>x.name==='Dolly Parton').discoveredOn,'2026-08-25');
  assert.doesNotMatch(card(model,'rainmaker').details.join(' '),/lack a group discovery date/);
  assert.equal(JSON.stringify(source),before);
});

test('youngest uses day-level ages when actual dates are available, preserving unknown and exact ties', () => {
  const data=season([member('a',50,[pick('Older',{born:'1976-01-01',actualDeathDate:'2026-02-02'})]),
    member('b',50,[pick('Younger',{born:'1976-01-01',actualDeathDate:'2026-02-01'})])]);
  assert.equal(card(calculateAwards(data),'youngest').value,'b');
  data.members[1].picks[0].actualDeathDate='2026-02-02';
  assert.equal(card(calculateAwards(data),'youngest').value,'a & b');
  assert.match(card(calculateAwards(data),'youngest').details.join(' '),/Still tied at the day level/);
  delete data.members[1].picks[0].actualDeathDate;
  assert.equal(card(calculateAwards(data),'youngest').value,'a & b');
  assert.match(card(calculateAwards(data),'youngest').details.join(' '),/Actual death dates are needed/);
});

test('score ties share ranks, and an old snapshot never becomes a final winner on its own', () => {
  const data = season([member('a',10),member('b',10),member('c',0),member('d',0)]);
  let model = calculateAwards(data,{finalizedYear:2026});
  assert.equal(model.final,false);
  assert.equal(card(model,'pool-prize').status,'Tied on points');
  assert.equal(card(model,'devils-share').status,'Tied on points');
  assert.deepEqual(model.draft.map(m=>m.rank),[1,1,3,3]);
  data.asOf='2026-12-31';
  data.members[0].score=11;
  assert.equal(card(calculateAwards(data),'pool-prize').status,'Leading');
  assert.equal(card(calculateAwards(data,{finalizedYear:2026}),'pool-prize').status,'Winner');
});

test('group discoveries, actual deaths, missing dates and duplicate BB allocations stay distinct', () => {
  const data = season([member('matt',24,[pick('A',{dateOfPassing:'2026-06-25',discoveryDate:undefined,actualDeathDate:undefined})]),
    member('ken',5,[pick('A',{pick:'BB',dateOfPassing:'2026-06-25',discoveryDate:undefined,actualDeathDate:undefined,points:5}),
      pick('B',{discoveryDate:undefined,actualDeathDate:undefined,dateOfPassing:'2026-04-01',dateSource:{dateOfPassing:'2026-04-01'}}),
      pick('C',{discoveryDate:undefined,actualDeathDate:undefined})])]);
  const events=awardEvents(data);
  assert.equal(events.length,3);
  assert.equal(events[0].owners.length,1);
  assert.equal(events[0].allocations.length,2);
  assert.equal(events[0].diedOn,null);
  assert.equal(events[0].ageConfirmed,false);
  assert.equal(events[1].discoveredOn,null);
  assert.equal(events[1].ageConfirmed,true);
  assert.equal(calculateAwards(data).undated,1);
});

test('only current dated events contribute, including no benefit from future or conflicting records', () => {
  const data=season([member('a',1,[pick('Last year',{pick:1,actualDeathDate:'2025-12-31'}),pick('Future',{pick:50,actualDeathDate:'2026-12-01'}),
    pick('Conflict',{pick:1,discoveryDate:'2026-02-01'})]), member('b',2,[pick('Conflict',{discoveryDate:'2026-03-01'})])]);
  const model=calculateAwards(data);
  assert.equal(model.events.length,0);
  assert.equal(model.draft.flatMap(m=>m.benefits).length,0);
  assert.equal(model.undated,1);
});

test('diamonds earn their distinct benefits; negative values still earn benefits and blood protection is not a multiplier', () => {
  const data=season([member('a',0,[pick('Blue',{pick:1,born:'1920-01-01'}),pick('Brown',{pick:50}),pick('Blood',{pick:3,bloodDiamond:true})])]);
  const benefits=calculateAwards(data).draft[0].benefits;
  assert.deepEqual(benefits.map(b=>[b.kind,b.reason,b.confirmed]),[['Steal','Blue Diamond',true],['Blood Diamond','Brown Diamond',true]]);
});

test('age-100 Birthday Buffet never grants a Steal; all diamond types are excluded from Birthday Buffet', () => {
  const fields={born:'1926-01-01',actualDeathDate:'2026-03-25',discoveryDate:'2026-03-26',points:10};
  const data=season([member('matt',10,[pick('Ordinary',fields),pick('Brown',{...fields,pick:50}),pick('Protected',{...fields,pick:3,bloodDiamond:true})]),member('marc',0)]);
  const model=calculateAwards(data);
  assert.deepEqual(model.draft[0].id,'marc');
  const benefits=model.draft.find(m=>m.id==='matt').benefits;
  assert.equal(benefits.some(b=>b.event==='Ordinary'),false);
  assert.equal(benefits.filter(b=>b.event==='Brown').length,2);
  assert.match(card(model,'birthday-buffet').details[0],/Ordinary/);
  assert.doesNotMatch(card(model,'birthday-buffet').details.join(' '),/Protected|Brown/);
});

test('Blue Diamond at 100 does not silently double the Steal entitlement', () => {
  const model=calculateAwards(season([member('a',20,[pick('Centenarian',{pick:1,born:'1926-01-01'})])]));
  assert.equal(model.draft[0].benefits.filter(b=>b.kind==='Steal').length,1);
  assert.equal(model.draft[0].benefits.filter(b=>b.kind==='Review').length,1);
});

test('same-day discoveries share a gap endpoint, equal gaps remain tied and the open gap is not awarded', () => {
  const data=season([member('a',5,[pick('Start',{actualDeathDate:'2026-01-01',discoveryDate:'2026-01-01'}),pick('End',{actualDeathDate:'2026-01-21',discoveryDate:'2026-01-21'})]),
    member('b',5,[pick('Middle',{actualDeathDate:'2026-01-11',discoveryDate:'2026-01-11'}),pick('Also middle',{pick:3,actualDeathDate:'2026-01-11',discoveryDate:'2026-01-11'})])]);
  const model=calculateAwards(data);
  assert.equal(card(model,'rainmaker').value,'a & b');
  assert.equal(card(model,'droughtmaker').value,'a & b');
  assert.match(card(model,'rainmaker').description,/10 days/);
  assert.match(card(model,'rainmaker').details.join(' '),/still open/);
});

test('Cavalcade requires three qualifying numbered deaths and supports either requested averaging definition', () => {
  const data=season([member('a',45,[pick('a1',{points:5}),pick('a2',{pick:3,points:5}),pick('a3',{pick:4,points:5}),pick('a4',{pick:5,points:30})]),
    member('b',24,[pick('b1',{points:8}),pick('b2',{pick:3,points:8}),pick('b3',{pick:4,points:8})]),
    member('c',3,[pick('c1',{points:1}),pick('c2',{pick:3,points:1}),pick('c3',{pick:'BB',points:1})])]);
  assert.equal(card(calculateAwards(data),'calamity').value,'b');
  assert.equal(card(calculateAwards(data,{calamityAverage:'low-only'}),'calamity').value,'a');
});

test('empty records give no invented badge holders, and names are escaped in both renderers', () => {
  const model=calculateAwards(season([member('<img src=x>',0)]));
  assert.equal(card(model,'youngest').value,'No contender yet');
  assert.equal(card(model,'rainmaker').value,'No completed gap yet');
  assert.equal(card(model,'calamity').status,'No one qualifies yet');
  assert.doesNotMatch(awardsMarkup(model)+draftMarkup(model),/<img/);
  assert.match(awardsMarkup(model),/&lt;img/);
});
