import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { applyApprovedEntry } from '../scripts/annals/apply-approved-entry.mjs';
import { contentDigest, verifyPublicApproval } from '../scripts/annals/ApprovedRenderer.mjs';
import { readFile } from 'node:fs/promises';

const secret = 'synthetic-publication-test-key-not-a-real-secret';
const entry = { id: 'annal-aaaaaaaaaaaaaaaaaaaaaaaa', category: 'cocktail', title: 'Synthetic cocktail',
  summary: 'Fictional test entry.', year: 2026, dateLabel: '', sortDate: '', credit: 'anonymous', quoteVerbatim: '',
  recipe: { drinkIngredients: ['1/2 oz imaginary syrup'], syrupIngredients: [], steps: ['Synthetic only.'] } };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const makeApproval = source => {
  const unsigned = { entryId: source.id, approvedAt: '2026-10-09T12:00:00.000Z',
    consents: { publication: true, quotePublication: false, recipeVerified: true, namedAttribution: false },
    contentSha256: contentDigest(source) };
  return { ...unsigned, signature: createHmac('sha256', secret)
    .update(JSON.stringify(canonical({ entry: source, approval: unsigned }))).digest('hex') };
};
const eventFor = (source = entry, approval = makeApproval(source)) => ({ action: 'annals-approved-entry', client_payload: { entry: source, approval } });
const emptyArchive = () => ({ schemaVersion: 1, entries: [], approvals: [] });
const makeRemoval = source => {
  const unsigned={entryId:source.id,approvedAt:'2026-10-09T12:00:00.000Z',contentSha256:contentDigest(source)};
  return {...unsigned,signature:createHmac('sha256',secret).update(JSON.stringify(canonical({operation:'remove',removal:unsigned}))).digest('hex')};
};

test('only a valid exact public approval is added and rendered', async () => {
  const approval = makeApproval(entry);
  assert.equal(verifyPublicApproval(entry, approval, secret), true);
  const result = await applyApprovedEntry({ event: eventFor(entry, approval), data: emptyArchive(), secret });
  assert.equal(result.data.entries.length, 1);
  assert.equal(result.data.approvals.length, 1);
  assert.match(result.html, /Synthetic cocktail/);
  assert.doesNotMatch(result.html, /reviewedBy|owner@example|private evidence/);
});

test('changed text, invalid event, duplicate identity and private fields fail closed', async () => {
  const approval = makeApproval(entry);
  await assert.rejects(applyApprovedEntry({ event: eventFor({ ...entry, summary: 'Changed.' }, approval), data: emptyArchive(), secret }));
  await assert.rejects(applyApprovedEntry({ event: { ...eventFor(), action: 'workflow_dispatch' }, data: emptyArchive(), secret }));
  await assert.rejects(applyApprovedEntry({ event: eventFor(), data: { ...emptyArchive(), entries: [entry], approvals: [approval] }, secret }));
  await assert.rejects(() => applyApprovedEntry({ event: { action: 'annals-approved-entry', client_payload: { entry: { ...entry, sender: 'member@example.test' }, approval: makeApproval(entry) } }, data: emptyArchive(), secret }));
});

test('preserves prior approved entries and rejects forged or missing approval signatures', async () => {
  const approval = makeApproval(entry);
  const previous = { ...entry, id: 'annal-bbbbbbbbbbbbbbbbbbbbbbbb', title: 'Existing approved item' };
  const previousApproval = makeApproval(previous);
  const result = await applyApprovedEntry({ event: eventFor(), data: { schemaVersion: 1, entries: [previous], approvals: [previousApproval] }, secret });
  assert.equal(result.data.entries.length, 2);
  assert.match(result.html, /Existing approved item/);
  await assert.rejects(applyApprovedEntry({ event: eventFor(entry, { ...approval, signature: '0'.repeat(64) }), data: emptyArchive(), secret }));
  await assert.rejects(applyApprovedEntry({ event: eventFor(entry, { ...approval, reviewerEmail: 'private@example.test' }), data: emptyArchive(), secret }));
});

test('publisher workflow is reachable only through the dedicated repository dispatch and writes only Annals files', async () => {
  const workflow = await readFile(new URL('../.github/workflows/annals-publish.yml', import.meta.url), 'utf8');
  assert.match(workflow, /repository_dispatch:\s*\n\s*types:\s*\[annals-approved-entry, annals-correct-entry, annals-remove-entry\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*write/);
  assert.doesNotMatch(workflow, /actions:\s*write|workflow_dispatch|pull_request|schedule:/);
  assert.match(workflow, /git add annals\.html data\/annals-approved\.json/);
  assert.match(workflow, /ANNALS_PUBLISH_SIGNING_KEY/);
});

test('signed correction replaces only the exact existing entry and preserves the rest', async () => {
  const previous={...entry,id:'annal-bbbbbbbbbbbbbbbbbbbbbbbb',title:'Prior public entry'}, previousApproval=makeApproval(previous);
  const corrected={...previous,title:'Corrected public entry',summary:'Corrected exact content.'}, correctionApproval=makeApproval(corrected);
  const event={action:'annals-correct-entry',client_payload:{entry:corrected,approval:correctionApproval}};
  const result=await applyApprovedEntry({event,data:{schemaVersion:1,entries:[previous],approvals:[previousApproval]},secret});
  assert.equal(result.data.entries.length,1);assert.equal(result.data.entries[0].title,'Corrected public entry');
  assert.equal(result.data.approvals[0].signature,correctionApproval.signature);assert.match(result.html,/Corrected public entry/);
  await assert.rejects(applyApprovedEntry({event,data:emptyArchive(),secret}));
  await assert.rejects(applyApprovedEntry({event:{...event,client_payload:{...event.client_payload,entry:{...corrected,title:'Altered after approval'}}},data:{schemaVersion:1,entries:[previous],approvals:[previousApproval]},secret}));
});

test('signed removal deletes only the requested currently approved entry', async () => {
  const previous={...entry,id:'annal-bbbbbbbbbbbbbbbbbbbbbbbb',title:'Entry for removal'}, approval=makeApproval(previous);
  const event={action:'annals-remove-entry',client_payload:{entryId:previous.id,approval:makeRemoval(previous)}};
  const result=await applyApprovedEntry({event,data:{schemaVersion:1,entries:[previous],approvals:[approval]},secret});
  assert.deepEqual(result.data.entries,[]);assert.deepEqual(result.data.approvals,[]);assert.doesNotMatch(result.html,/Entry for removal/);
  await assert.rejects(applyApprovedEntry({event,data:emptyArchive(),secret}));
  await assert.rejects(applyApprovedEntry({event:{...event,client_payload:{...event.client_payload,approval:makeRemoval({...previous,summary:'Changed'})}},data:{schemaVersion:1,entries:[previous],approvals:[approval]},secret}));
});

