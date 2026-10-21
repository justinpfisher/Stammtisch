/* Public-only site witness. Read-only exact bytes from a fixed origin and
 * checked-out public files. This does not certify private intake, signing,
 * member authority, source spreadsheet state or any publication clock. */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {photoSources,validateEditorialManifest} from './EditorialPhotoManifest.mjs';

export const SITE_ORIGIN='https://stammtischbrewery.com/';
export const SITE_FILES=Object.freeze([
  'index.html',
  'annals.html',
  'celebration.html',
  'celebration.mjs',
  'celebration-awards.mjs',
  'history.html',
  'photos.html',
  'annals-photos.mjs',
  'annals-photos.css',
  'data/annals-editorial-photos.json',
  'assets/annals/annal-96b5ae266a36793c6a203033.jpg',
  'data/annals-approved.json',
  'data/club-history.json',
  'data/photos/index.json',
  'data/col-rules-register.json',
  'data/col-rules-versions.json',
  'data/col-rules-release-state.json'
]);
const MAX_BYTES=1024*1024;
const MAX_EDITORIAL_BYTES=5*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Consume a Fetch stream incrementally and cancel before retaining oversized bodies. */
async function readBoundedBody(response,name,limit=MAX_BYTES){
  const reader=response.body?.getReader?.();
  if(!reader)throw Error('Live public file unreadable: '+name);
  const chunks=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      const chunk=Buffer.from(value);
      total+=chunk.length;
      if(total>limit){
        try{await reader.cancel();}catch{}
        throw Error('Live public file exceeds bound: '+name);
      }
      chunks.push(chunk);
    }
  }catch(error){
    if(error?.message==='Live public file exceeds bound: '+name)throw error;
    throw Error('Live public file unreadable: '+name);
  }finally{
    try{reader.releaseLock?.();}catch{}
  }
  return Buffer.concat(chunks,total);
}

/** Fixed, publicly accessible inputs only. No caller-selected URL or path. */
export async function observeHostedSite({fetchImpl=fetch,readFileImpl=readFile,clock=()=>new Date()}={}){
  const started=clock();
  if(!(started instanceof Date)||!Number.isFinite(started.valueOf()))
    throw Error('Observation clock unavailable');
  // Read exact public ledgers from this checkout: only their bounded photo
  // paths may extend the otherwise fixed public-origin witness. A public
  // filename supplied by an unscreened email is never a fetch target.
  let archive,editorial;
  try{
    const archiveBytes=Buffer.from(await readFileImpl('data/annals-approved.json'));
    const manifestBytes=Buffer.from(await readFileImpl('data/annals-editorial-photos.json'));
    if(!archiveBytes.length||archiveBytes.length>MAX_BYTES||
       !manifestBytes.length||manifestBytes.length>MAX_BYTES)
       throw Error('Public photo indexes exceed bound');
    archive=JSON.parse(archiveBytes.toString('utf8'));
    editorial=JSON.parse(manifestBytes.toString('utf8'));
    if(archive.schemaVersion!==1||!Array.isArray(archive.entries)||!Array.isArray(archive.approvals))
      throw Error('Public signed archive shape invalid');
    validateEditorialManifest(editorial,archive.entries);
  }catch{throw Error('Public photo evidence unavailable or invalid');}
  const originals=photoSources(archive.entries);
  const photoDigests=new Map(originals);
  for(const row of editorial.images)photoDigests.set(row.asset,row.editorialSha256);
  const paths=[...new Set([...SITE_FILES,...photoDigests.keys()])];
  const observed=[];
  for(const name of paths){
    const limit=name.endsWith('-editorial-v2.jpg')?MAX_EDITORIAL_BYTES:MAX_BYTES;
    let source;
    try{source=Buffer.from(await readFileImpl(name));}
    catch{throw Error('Public source unavailable: '+name);}
    if(source.length===0||source.length>limit)
      throw Error('Public source exceeds bound: '+name);
    const expected=digest(source);
    if(photoDigests.has(name)&&photoDigests.get(name)!==expected)
      throw Error('Public image differs from signed photo source or qualified editorial digest: '+name);
    let response;
    try{
      response=await fetchImpl(SITE_ORIGIN+name+'?source-check='+expected.slice(0,16),{
        method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
        headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)
      });
    }catch{throw Error('Live public file unavailable: '+name);}
    if(!response||response.status!==200||response.redirected===true||
       typeof response.body?.getReader!=='function')
      throw Error('Live public file unavailable: '+name);
    const reported=response.headers?.get?.('content-length');
    if(reported!==null&&reported!==undefined&&
       (!/^\d+$/.test(String(reported))||Number(reported)>limit))
      throw Error('Live public file exceeds bound: '+name);
    const bytes=await readBoundedBody(response,name,limit);
    if(bytes.length===0||digest(bytes)!==expected)
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
    signedCocktailSources:originals.size,
    qualifiedEditorialAssets:editorial.images.length,
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
