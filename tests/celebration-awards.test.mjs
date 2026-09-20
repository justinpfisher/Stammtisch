import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { awardEvents, calculateAwards, awardsMarkup, draftMarkup } from '../celebration-awards.mjs';
import { distinctionReason } from '../celebration-rules.mjs';

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
  assert.equal(card(model,'youngest').value,'Matt');
  assert.equal(card(model,'rainmaker').value,'Marc');
  assert.equal(card(model,'droughtmaker').value,'Ken');
  assert.equal(card(model,'copycat').value,'No confirmed match yet');
  assert.equal(card(model,'copycat').status,'Actual death dates needed');
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

test('verified Brad Arnold and Jason Collins dates resolve the youngest contender to Matt by 28 days', () => {
  const model=calculateAwards(source);
  const brad=model.events.find(event=>event.name==='Brad Arnold');
  const jason=model.events.find(event=>event.name==='Jason Collins');
  assert.equal(brad.ageInDays,17300);
  assert.equal(jason.ageInDays,17328);
  assert.equal(jason.ageInDays-brad.ageInDays,28);
  assert.equal(brad.discoveredOn,'2026-02-07');
  assert.equal(jason.discoveredOn,'2026-05-12');
  assert.equal(card(model,'youngest').value,'Matt');
  assert.deepEqual(model.draft.filter(member=>member.youngest).map(member=>member.id),['matt']);
  assert.match(card(model,'youngest').details.join(' '),/17,300 days old/);
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
  assert.match(card(model,'pool-prize').details.join(' '),/share the \$100 prize/);
  assert.match(card(model,'devils-share').details.join(' '),/Every player/);
  assert.equal(model.draft.filter(m=>m.devil).length,2);
  assert.match(draftMarkup(model),/Rock, paper, scissors/);
  data.asOf='2026-12-31';
  assert.equal(card(calculateAwards(data,{finalizedYear:2026}),'pool-prize').status,'Shared winners');
  assert.equal(card(calculateAwards(data,{finalizedYear:2026}),'devils-share').status,'Eligible');
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

test('at 100 Blue earns two Steals and Brown earns two Blood Diamonds, including birthday discoveries', () => {
  for (const [slot,kind] of [[1,'Steal'],[50,'Blood Diamond']]) {
    const data=season([member('marc',20,[pick('Centenarian',{pick:slot,born:'1926-01-01',discoveryDate:'2026-03-26'})])]);
    const benefits=calculateAwards(data).draft[0].benefits;
    assert.deepEqual(benefits.map(b=>b.kind),[kind,kind]);
    assert.ok(benefits.every(b=>b.confirmed));
    delete data.members[0].picks[0].actualDeathDate;
    assert.ok(calculateAwards(data).draft[0].benefits.every(b=>!b.confirmed));
  }
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

test('Cavalcade ranks the number of qualifying deaths rather than average points', () => {
  const data=season([member('a',3,[pick('a1',{points:1}),pick('a2',{pick:3,points:1}),pick('a3',{pick:4,points:1})]),
    member('b',72,[pick('b1',{points:8}),pick('b2',{pick:3,points:8}),pick('b3',{pick:4,points:8}),pick('b4',{pick:5,points:8}),pick('b5',{pick:6,points:40})])]);
  const result = card(calculateAwards(data),'calamity');
  assert.equal(result.value,'b');
  assert.ok(result.details.includes('b: 4 qualifying deaths'));
});

test('Cavalcade requires three deaths strictly under 9 and excludes birthday-only and unawarded entries', () => {
  const data=season([member('a',24,[pick('a1',{points:7}),pick('a2',{pick:3,points:8}),pick('a3',{pick:4,points:9}),
    pick('birthday',{pick:'BB',points:1}),pick('unawarded',{pick:5,points:1,counted:false})])]);
  let result = card(calculateAwards(data),'calamity');
  assert.equal(result.status,'No one qualifies yet');
  assert.ok(result.details.includes('a: 2 qualifying deaths · minimum 3 needed'));
  data.members[0].picks[2].points=8;
  result = card(calculateAwards(data),'calamity');
  assert.equal(result.value,'a');
  assert.ok(result.details.includes('a: 3 qualifying deaths'));
});

test('Cavalcade preserves equal-count ties, includes zero and negative points, and counts each death once', () => {
  const data=season([member('a',-1,[pick('a1',{points:0}),pick('a2',{pick:3,points:-1}),pick('a3',{pick:4,points:0}),pick('a3',{pick:5,points:0})]),
    member('b',24,[pick('b1',{points:8}),pick('b2',{pick:3,points:8}),pick('b3',{pick:4,points:8})])]);
  const result = card(calculateAwards(data),'calamity');
  assert.equal(result.value,'a & b');
  assert.equal(result.status,'Tied badge candidates');
  assert.ok(result.details.includes('a: 3 qualifying deaths'));
  assert.match(result.details.join(' '),/resolve the tie/);
});

test('Cavalcade button notes use the confirmed rule even when the imported spreadsheet has older wording', () => {
  const entry=source.distinctions.find(item => item.name.toLowerCase() === 'cavalcade of calamity');
  assert.equal(distinctionReason(entry), 'Goes to the player with the most deaths worth fewer than 9 points, with a minimum of three qualifying deaths.');
  assert.equal(card(calculateAwards(source),'calamity').description, distinctionReason(entry));
  const copycat=source.distinctions.find(item => item.name.toLowerCase() === 'copycat');
  assert.equal(distinctionReason(copycat), card(calculateAwards(source),'copycat').description);
  assert.match(distinctionReason(copycat), /actual date and time of death/);
});

test('Copycat uses actual chronology including timezone offsets, regardless of discovery order or pick position', () => {
  const data=season([
    member('a',24,[pick('Later',{pick:2,actualDeathAt:'2026-01-30T09:00:00-05:00',discoveryDate:'2026-02-01'})]),
    member('b',24,[pick('Earlier',{pick:7,actualDeathAt:'2026-01-30T13:00:00Z',discoveryDate:'2026-02-03'})])]);
  assert.equal(card(calculateAwards(data),'copycat').value,'a');
  assert.match(card(calculateAwards(data),'copycat').details.join(' '), /Later died second: a/);
});

test('Copycat does not infer death order from missing, invalid, date-mismatched or equal times', () => {
  for (const timestamp of [undefined, '2026-01-30T15:00:00', '2026-01-30T25:00:00Z', '2026-01-31T15:00:00Z', '2026-01-30T13:00:00Z']) {
    const data=season([member('a',24,[pick('A',{actualDeathAt:timestamp})]),
      member('b',24,[pick('B',{actualDeathAt:'2026-01-30T13:00:00Z'})])]);
    assert.equal(card(calculateAwards(data),'copycat').value,'Recipient unconfirmed');
  }
});

test('Copycat needs separate celebrities and members sharing an actual death date', () => {
  const cases=[
    [member('a',24,[pick('A',{actualDeathDate:undefined})]),member('b',24,[pick('B',{actualDeathDate:undefined})])],
    [member('a',24,[pick('A')]),member('b',24,[pick('B',{actualDeathDate:'2026-01-31'})])],
    [member('a',24,[pick('Shared')]),member('b',24,[pick('Shared')])],
    [member('a',48,[pick('A'),pick('B',{pick:3})])]
  ];
  for (const members of cases) assert.equal(card(calculateAwards(season(members)),'copycat').value,'No confirmed match yet');
});

test('Copycat leaves multiple deaths, shared selections and conflicting actual times for review', () => {
  const a=pick('A',{actualDeathAt:'2026-01-30T09:00:00Z'});
  const b=pick('B',{actualDeathAt:'2026-01-30T13:00:00Z'});
  const c=pick('C',{actualDeathAt:'2026-01-30T15:00:00Z'});
  assert.equal(card(calculateAwards(season([member('a',24,[a]),member('b',24,[b]),member('c',24,[c])])),'copycat').value,'Recipient unconfirmed');
  assert.equal(card(calculateAwards(season([member('a',24,[a]),member('b',24,[b]),member('c',24,[b])])),'copycat').value,'Recipient unconfirmed');
  const conflict=season([member('a',48,[a,{...a,pick:3,actualDeathAt:'2026-01-30T10:00:00Z'}]),member('b',24,[b])]);
  assert.equal(card(calculateAwards(conflict),'copycat').value,'Recipient unconfirmed');
});

test('empty records give no invented badge holders, and names are escaped in both renderers', () => {
  const model=calculateAwards(season([member('<img src=x>',0)]));
  assert.equal(card(model,'youngest').value,'No contender yet');
  assert.equal(card(model,'rainmaker').value,'No completed gap yet');
  assert.equal(card(model,'calamity').status,'No one qualifies yet');
  assert.doesNotMatch(awardsMarkup(model)+draftMarkup(model),/<img/);
  assert.match(awardsMarkup(model),/&lt;img/);
});
