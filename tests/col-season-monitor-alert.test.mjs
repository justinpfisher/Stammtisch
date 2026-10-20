import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/celebration-sheet-monitor.yml', import.meta.url), 'utf8').replace(/\r\n/g,'\n');
const segment = workflow.split('      - name: Open or update a monitor failure alert\n')[1];
assert.ok(segment, 'The existing bounded failure alert must remain available');
const script = segment.split('          script: |\n')[1].trimEnd().split('\n')
  .map(line => line.startsWith('            ') ? line.slice(12) : line).join('\n');
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'github', 'context', 'require', script
);

function records() {
  return {issues: [], comments: []};
}

async function runAlert({db, code, pending, fingerprint, runId}) {
  const status = pending == null
    ? {status:'failed', errorCode:code}
    : {status:'review_required', pending};
  const files = {
    'monitor-state/site-sync-status.json': JSON.stringify(status),
    ...(fingerprint ? {'monitor-result.json':JSON.stringify({alertKey:fingerprint})} : {})
  };
  const fs = {
    existsSync: path => Object.hasOwn(files, path),
    readFileSync: (path) => {
      if (!Object.hasOwn(files,path)) throw Error('Unexpected file read');
      return files[path];
    }
  };
  const github = {rest:{issues:{
    listForRepo: async () => ({data:db.issues}),
    listComments: async ({issue_number}) => ({data:db.comments.filter(x => x.issue_number===issue_number)}),
    create: async ({title,body}) => {
      db.issues.push({number:db.issues.length+1,title,body});
      return {data:db.issues.at(-1)};
    },
    createComment: async ({issue_number,body}) => {
      db.comments.push({issue_number,body});
      return {data:db.comments.at(-1)};
    }
  }}};
  await execute(github, {serverUrl:'https://github.com',repo:{owner:'fixture',repo:'fixture'},runId},
    name => {
      assert.equal(name,'fs');
      return fs;
    });
}

test('unchanged January rollover hold creates one issue, not hourly comments', async () => {
  const db=records(), fingerprint='a'.repeat(64);
  await runAlert({db,code:'season_review',fingerprint,runId:1});
  await runAlert({db,code:'season_review',fingerprint,runId:2});
  await runAlert({db,code:'season_review',fingerprint,runId:3});
  assert.equal(db.issues.length,1);
  assert.equal(db.comments.length,0);
  assert.match(db.issues[0].title,/season transition/);
  assert.match(db.issues[0].body,/last accepted baseline/);
  assert.match(db.issues[0].body,/col-season-hold:season_review/);
  assert.doesNotMatch(db.issues[0].body,/private person|unpublished score/);
});

test('new Sheet states or a different year-end hold remain actionable', async () => {
  const db=records();
  await runAlert({db,code:'season_review',fingerprint:'a'.repeat(64),runId:1});
  await runAlert({db,code:'season_review',fingerprint:'b'.repeat(64),runId:2});
  await runAlert({db,code:'season_boundary_review',fingerprint:'b'.repeat(64),runId:3});
  await runAlert({db,code:'season_boundary_review',fingerprint:'b'.repeat(64),runId:4});
  assert.equal(db.issues.length,1);
  assert.equal(db.comments.length,2);
  assert.match(db.comments[0].body,/col-season-hold:season_review:b{64}/);
  assert.match(db.comments[1].body,/col-season-hold:season_boundary_review:b{64}/);
});

test('missing comparison hash never silently suppresses a season problem', async () => {
  const db=records();
  await runAlert({db,code:'season_review',runId:11});
  await runAlert({db,code:'season_review',runId:12});
  assert.equal(db.issues.length,1);
  assert.equal(db.comments.length,1);
  assert.match(db.comments[0].body,/runs\/12/);
});

test('independent-death review and unexpected failures retain existing alerts', async () => {
  const db=records();
  await runAlert({db,pending:2,runId:21});
  await runAlert({db,code:'verified_scoring_conflict',runId:22});
  await runAlert({db,code:'verified_scoring_conflict',runId:23});
  assert.equal(db.issues.length,2);
  assert.equal(db.comments.length,1);
  assert.match(db.issues[0].body,/2 newly reported passing/);
  assert.match(db.issues[1].body,/Safe diagnostic category: verified_scoring_conflict/);
  assert.match(db.comments[0].body,/runs\/23/);
});
