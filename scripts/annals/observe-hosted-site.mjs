/* Public-only site witness. Read-only exact bytes from a fixed origin and
 * checked-out public files. This does not certify private intake, signing,
 * member authority, source spreadsheet state or any publication clock. */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const SITE_ORIGIN='https://stammtischbrewery.com/';
export const SITE_FILES=Object.freeze([
  'index.html',
  'annals.html',
  'celebration.html',
  'history.html',
  'photos.html',
  'data/annals-approved.json',
  'data/club-history.json',
  'data/photos/index.json',
  'data/col-rules-register.json',
  'data/col-rules-versions.json',
  'data/col-rules-release-state.json'
]);
const MAX_BYTES=1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Fixed, publicly accessible inputs only. No caller-selected URL or path. */
export async function observeHostedSite({fetchImpl=fetch,readFileImpl=readFile,clock=()=>new Date()}={}){
  const started=clock();
  if(!(started instanceof Date)||!Number.isFinite(started.valueOf()))
    throw Error('Observation clock unavailable');
  const observed=[];
  for(const name of SITE_FILES){
    let source;
    try{source=Buffer.from(await readFileImpl(name));}
    catch{throw Error('Public source unavailable: '+name);}
    if(source.length===0||source.length>MAX_BYTES)
      throw Error('Public source exceeds bound: '+name);
    const expected=digest(source);
    let response;
    try{
      response=await fetchImpl(SITE_ORIGIN+name+'?source-check='+expected.slice(0,16),{
        method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
        headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)
      });
    }catch{throw Error('Live public file unavailable: '+name);}
    if(!response||response.status!==200||response.redirected===true||
       typeof response.arrayBuffer!=='function')
      throw Error('Live public file unavailable: '+name);
    const reported=response.headers?.get?.('content-length');
    if(reported!==null&&reported!==undefined&&
       (!/^\d+$/.test(String(reported))||Number(reported)>MAX_BYTES))
      throw Error('Live public file exceeds bound: '+name);
    let bytes;
    try{bytes=Buffer.from(await response.arrayBuffer());}
    catch{throw Error('Live public file unreadable: '+name);}
    if(bytes.length===0||bytes.length>MAX_BYTES||digest(bytes)!==expected)
      throw Error('Live public file differs from source: '+name);
    observed.push(Object.freeze({path:name,sha256:expected,bytes:bytes.length}));
  }
  const finished=clock();
  if(!(finished instanceof Date)||!Number.isFinite(finished.valueOf())||finished<started)
    throw Error('Observation clock unavailable');
  return Object.freeze({
    kind:'public-site-exact-byte-observation-only',
    origin:SITE_ORIGIN,
    startedAt:started.toISOString(),
    completedAt:finished.toISOString(),
    sourceCommit:process.env.GITHUB_SHA||null,
    files:Object.freeze(observed),
    privateReleaseQualified:false,
    publishingActivated:false
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  // A push-triggered observation can outrun the Pages build or edge refresh.
  // Retry read-only checks for at most about 3 minutes; no job is dispatched.
  let accepted=false;
  for(let attempt=1;attempt<=18;attempt++){
    try{
      process.stdout.write(JSON.stringify(await observeHostedSite(),null,2)+'\n');
      accepted=true;break;
    }catch{
      if(attempt<18)await new Promise(resolve=>setTimeout(resolve,10000));
    }
  }
  if(!accepted){
    console.error('Public site exact-byte verification held. No private or public release authority was established.');
    process.exitCode=1;
  }
}
