import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { awardEvents, calculateAwards, awardsMarkup, draftMarkup, metricBirthdayLabel, birthdayCalendar } from '../celebration-awards.mjs';
import { distinctionReason } from '../celebration-rules.mjs';

const source = JSON.parse(readFileSync(new URL('../data/celebration.json', import.meta.url), 'utf8'));
const pick = (name, fields = {}) => ({ pick:2, name, born:'1950-01-01', counted:true, points:24, discoveryDate:'2026-02-01', actualDeathDate:'2026-01-30', ...fields });
const member = (id, score, picks = []) => ({ id, name:id, score, picks });
const season = members => ({ year:2026, asOf:'2026-09-19', members });
const card = (model,id) => model.cards.find(c => c.id === id);

test('current register calculates leaders and draft order dynamically without mutating the source', () => {
  const before = JSON.stringify(source);
  const model = calculateAwards(source);
  const scoreDescending = [...source.members].sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
  const scoreAscending = [...source.members].sort((a,b) => a.score - b.score || a.name.localeCompare(b.name));
  assert.equal(card(model,'pool-prize').value, scoreDescending.filter(m => m.score === scoreDescending[0].score).map(m => m.name).join(' & '));
  assert.equal(card(model,'devils-share').value, scoreAscending.filter(m => m.score === scoreAscending[0].score).map(m => m.name).join(' & '));
  assert.deepEqual(model.draft.map(m => m.id), scoreAscending.map(m => m.id));
  assert.equal(card(model,'pool-prize').status, scoreDescending[0].score === scoreDescending[1].score ? 'Tied on points' : 'Leading');
  assert.equal(model.final, false);
  assert.ok(model.events.some(event => event.name === 'Dolly Parton' && event.discoveredOn === '2026-08-25'));
  assert.match(card(model,'birthday-buffet').details.join(' '),/Matt 12, Ken 13/);
  assert.match(card(model,'birthday-buffet').details.join(' '),/Group vote approved/);
  assert.equal(JSON.stringify(source),before);
});

test('verified Brad Arnold and Jason Collins dates retain their 28-day comparison', () => {
  const model=calculateAwards(source);
  const brad=model.events.find(event=>event.name==='Brad Arnold');
  const jason=model.events.find(event=>event.name==='Jason Collins');
  assert.equal(brad.ageInDays,17300);
  assert.equal(jason.ageInDays,17328);
  assert.equal(jason.ageInDays-brad.ageInDays,28);
  assert.equal(brad.discoveredOn,'2026-02-07');
  assert.equal(jason.discoveredOn,'2026-05-12');
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

test('prospective age-100 benefit retirement remains dormant until explicitly qualified', () => {
  const data=season([member('example',100,[
    pick('Earlier',{born:'1926-01-01',actualDeathDate:'2026-03-01',discoveryDate:'2026-03-02',points:10}),
    pick('Release day',{born:'1926-01-01',actualDeathDate:'2026-05-20',discoveryDate:'2026-05-21',points:10}),
    pick('Later ordinary',{born:'1926-01-01',actualDeathDate:'2026-07-01',discoveryDate:'2026-07-02',points:10}),
    pick('Later Blue',{pick:1,born:'1926-01-01',actualDeathDate:'2026-07-03',discoveryDate:'2026-07-04',points:20}),
    pick('Later Brown',{pick:50,born:'1926-01-01',actualDeathDate:'2026-07-05',discoveryDate:'2026-07-07',points:20})
  ])]);
  const before=JSON.stringify(data);
  const baseline=calculateAwards(data).draft[0].benefits;
  assert.deepEqual(baseline.map(b=>b.event),[
    'Earlier','Release day','Later ordinary','Later Blue','Later Blue','Later Brown','Later Brown'
  ]);
  const pending=calculateAwards(data,{}, {age100PrivilegeEndsAt:'2026-05-20T17:00:00Z'}).draft[0].benefits;
  assert.deepEqual(pending.map(b=>b.event),['Earlier','Release day','Later Blue','Later Brown']);
  assert.equal(pending.find(b=>b.event==='Earlier').confirmed,true);
  assert.equal(pending.find(b=>b.event==='Release day').confirmed,false);
  assert.match(pending.find(b=>b.event==='Release day').reason,/needs individual verification/);
  assert.deepEqual(pending.filter(b=>b.event==='Later Blue').map(b=>b.reason),['Blue Diamond']);
  assert.deepEqual(pending.filter(b=>b.event==='Later Brown').map(b=>b.reason),['Brown Diamond']);
  assert.equal(pending.some(b=>b.event==='Later ordinary'),false);
  assert.deepEqual(calculateAwards(data,{}, {age100PrivilegeEndsAt:'not-a-date'}).draft[0].benefits,baseline);
  assert.equal(JSON.stringify(data),before,'historical awarded points and sources were not changed');
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

test('oldest-death Steal is dormant until a verified rule policy activates it', () => {
  const data=season([
    member('older',10,[pick('Older fictional pick',{born:'1920-01-01',actualDeathDate:'2026-03-01'})]),
    member('younger',11,[pick('Younger fictional pick',{born:'1930-01-01',actualDeathDate:'2026-03-01'})])
  ]);
  const baseline=calculateAwards(data);
  assert.equal(card(baseline,'oldest'),undefined);
  assert.equal(baseline.draft.flatMap(x=>x.benefits).some(x=>x.reason==='Oldest celebrity death of the year'),false);
  const enabled=calculateAwards(data,{}, {oldestDeathSteal:true});
  assert.equal(card(enabled,'oldest').value,'older');
  assert.equal(enabled.officialAwardCards,4);
  assert.equal(enabled.draft.find(x=>x.id==='older').benefits.filter(x=>x.reason==='Oldest celebrity death of the year').length,1);
  assert.equal(enabled.draft.find(x=>x.id==='younger').benefits.some(x=>x.reason==='Oldest celebrity death of the year'),false);
  assert.equal(card(enabled,'youngest').value,'younger');
});

test('verified exact age ties remain provisional without an invented shared Steal award', () => {
  const data=season([
    member('a',10,[pick('First fictional pick',{born:'1920-01-01',actualDeathDate:'2026-02-01'})]),
    member('b',10,[pick('Second fictional pick',{born:'1920-01-01',actualDeathDate:'2026-02-01'})]),
    member('c',10,[pick('Later fictional pick',{born:'1930-01-01',actualDeathDate:'2026-02-01'})])
  ]);
  const result=calculateAwards(data,{}, {oldestDeathSteal:true});
  assert.equal(card(result,'oldest').value,'a & b');
  assert.equal(card(result,'oldest').status,'Tie unresolved');
  assert.match(card(result,'oldest').details.join(' '),/An exact tie remains unresolved/);
  for (const id of ['a','b']) {
    const benefits=result.draft.find(m=>m.id===id).benefits.filter(x=>x.reason==='Oldest celebrity death of the year');
    assert.equal(benefits.length,1);
    assert.equal(benefits[0].confirmed,false);
  }
  assert.equal(result.draft.find(m=>m.id==='c').benefits.some(x=>x.reason==='Oldest celebrity death of the year'),false);
});

test('missing death evidence prevents a final oldest-death award without altering scores', () => {
  const data=season([
    member('a',10,[pick('Dated fictional pick',{born:'1920-01-01',actualDeathDate:'2026-02-01'})]),
    member('b',10,[pick('Undated fictional pick',{born:'1910-01-01',actualDeathDate:undefined})])
  ]);
  data.asOf='2026-12-31';
  const before=JSON.stringify(data);
  let result=calculateAwards(data,{finalizedYear:2026},{oldestDeathSteal:true});
  assert.notEqual(card(result,'oldest').status,'Eligible at the next draft');
  assert.equal(result.draft.find(m=>m.id==='a').benefits.filter(x=>x.reason==='Oldest celebrity death of the year')[0].confirmed,false);
  data.members[1].picks[0].actualDeathDate='2026-02-01';
  result=calculateAwards(data,{finalizedYear:2026},{oldestDeathSteal:true});
  assert.equal(card(result,'oldest').value,'b');
  assert.equal(card(result,'oldest').status,'Eligible at the next draft');
  assert.equal(result.draft.find(m=>m.id==='b').benefits.filter(x=>x.reason==='Oldest celebrity death of the year')[0].confirmed,true);
  assert.equal(JSON.parse(before).members[0].score,data.members[0].score);
});

test('conflicting age claims cannot finalize an oldest-death Steal',()=>{
  const data=season([
    member('a',10,[pick('Conflicting fictional pick',{born:'1920-01-01',actualDeathDate:'2026-02-01',ageAtDeath:106})]),
    member('b',10,[pick('Conflicting fictional pick',{born:'1920-01-01',actualDeathDate:'2026-02-01',ageAtDeath:99})]),
    member('c',10,[pick('Younger fictional pick',{born:'1930-01-01',actualDeathDate:'2026-02-01'})])
  ]);
  data.asOf='2026-12-31';const before=JSON.stringify(data);
  const result=calculateAwards(data,{finalizedYear:2026},{oldestDeathSteal:true});
  assert.doesNotMatch(card(result,'oldest').description,/null years/);
  assert.notEqual(card(result,'oldest').status,'Eligible at the next draft');
  assert.equal(result.draft.flatMap(x=>x.benefits).some(x=>x.reason==='Oldest celebrity death of the year'&&x.confirmed),false);
  assert.equal(JSON.stringify(data),before);
});

test('Metric Calendar birthday labels match the official ordinal method and retain Gregorian eligibility', () => {
  const common=birthdayCalendar(2026);
  assert.deepEqual(common.map(b=>`${b.member}: ${b.metric} (${b.gregorian})`),[
    'Marc: Bloom 12 (March 26)',
    'Jerome: Thrive 20 (May 9)',
    'Matt: Radiate 30 (June 25)',
    'Justin: Sustain 5 (July 6)',
    'Ken: Sustain 19 (July 20)',
    'Jamie: Reflect 7 (September 19)'
  ]);
  assert.equal(metricBirthdayLabel(2027,'03-26'),'Bloom 12');
  assert.equal(metricBirthdayLabel(2028,'03-26'),'Bloom 13');
  assert.equal(metricBirthdayLabel(2028,'09-19'),'Reflect 8');
  assert.equal(metricBirthdayLabel(2028,'02-29'),'Awaken 24');
  assert.equal(metricBirthdayLabel(2026,'02-29'),null);
  assert.equal(metricBirthdayLabel(2026,'not-a-date'),null);
  const saved=JSON.stringify(source);
  const model=calculateAwards(source);
  assert.match(card(model,'birthday-buffet').details[0],/Birthday register \(2026, Metric first\): Marc: Bloom 12 \(March 26\)/);
  assert.equal(JSON.stringify(source),saved,'metric labels must never mutate awarded data');
});
