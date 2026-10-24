/* Hosted production witness for an already committed signed numeric release.
 * Checks exact public bytes (including immutable evidence), current source
 * dependencies, and the same browser verifier consumed by Celebration. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyNumericSiteRelease} from '../col-numeric-reader.mjs';
import {sha256} from '../col-numeric-adapter.mjs';

const ORIGIN='https://stammtischbrewery.com/';
const TRUST='data/col-numeric-trust.json';
const RELEASE='data/col-numeric-release.json';
const ROOT=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const hash=s=>createHash('sha256').update(s).digest('hex');
const json=s=>JSON.parse(s);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function observeNumericSite({fetchImpl=fetch,readImpl=readFile,
  origin=ORIGIN,now=Date.now()}={}) {
  if(origin!==ORIGIN)throw Error('Only the canonical public origin may be a production witness');
  const release=json(await readImpl(path.join(ROOT,RELEASE),'utf8'));
  const expectedDigest=sha256(release);
  const names=[TRUST,RELEASE,'data/celebration.json','data/col-club-state.json',
    'data/col-numeric-releases/'+expectedDigest+'.json',
    'data/col-numeric-releases/'+expectedDigest+'-witness.json'];
  const raw={};
  for(const name of names) {
    const expected=await readImpl(path.join(ROOT,name),'utf8');
    const response=await fetchImpl(origin+name,{cache:'no-store',redirect:'error',
      credentials:'omit',signal:AbortSignal.timeout(15000),
      headers:{'Cache-Control':'no-cache'}});
    if(response.status!==200||response.redirected)throw Error('Public signed CoL asset unavailable');
    const text=await response.text();
    if(Buffer.byteLength(text)>512*1024||hash(text)!==hash(expected))
      throw Error('Public signed CoL asset differs from qualified version');
    raw[name]=json(text);
  }
  const accepted=await verifyNumericSiteRelease({
    release:raw[RELEASE],keyring:raw[TRUST],
    baseline:raw['data/celebration.json'],clubState:raw['data/col-club-state.json'],now
  });
  if(!accepted)throw Error('Live browser numeric verifier rejected the full signed snapshot');
  if(sha256(raw[RELEASE].payload.siteResults)!==sha256(accepted))
    throw Error('Live browser result digest mismatch');
  return {kind:'col-numeric-complete-live-witness-v1',releaseDigest:expectedDigest,
    observedAt:new Date(now).toISOString()};
}

async function main() {
  for(let attempt=0;attempt<10;attempt++) {
    try {
      const proof=await observeNumericSite();
      process.stdout.write('Complete signed numerical snapshot and browser verifier observed at the canonical public origin.\n');
      return proof;
    } catch {
      if(attempt===9)throw Error('Signed numerical readback is incomplete');
      await sleep(15000);
    }
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{console.error('Protected numerical live witness FAILED; do not retire the January hold.');process.exitCode=1;});
}
