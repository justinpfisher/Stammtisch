/* Read-only exact public CoL file observation. No signing, activation or mutation.
 * A matching snapshot establishes bytes observable from ONE network vantage
 * at an observed time. It is NOT atomic publication, a trusted activation
 * clock, a credential check or authority to revise rules.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const COL_RULE_PUBLIC_FILES=Object.freeze([
  'data/col-rules-register.json',
  'data/col-rules-versions.json',
  'docs/celebration-of-life-rules.md',
  'celebration.html',
  'col-revisions.html'
]);
const ORIGIN='https://stammtischbrewery.com/';
const MAX_BYTES=512*1024;
const sha256=value=>createHash('sha256').update(value).digest('hex');

function expectedDigests(expected){
  if(!expected||typeof expected!=='object'||Array.isArray(expected)||
     Object.keys(expected).sort().join('|')!==[...COL_RULE_PUBLIC_FILES].sort().join('|')||
     COL_RULE_PUBLIC_FILES.some(name=>!/^[a-f0-9]{64}$/.test(expected[name]||'')))
    throw Error('Exactly five source-bound CoL file hashes are required');
  return COL_RULE_PUBLIC_FILES.map(name=>({name,sha256:expected[name]}));
}
function observedTime(clock){
  const now=clock();
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Valid observation clock required');
  return now;
}
/** Public-only observer. The caller supplies expected Git source hashes;
 * a successful observation is still insufficient for rule activation.
 * Never accept a caller URL, credentials, source snippets or private data.
 */
export async function observeHostedCoL(expected,{fetchImpl=fetch,clock=()=>new Date()}={}){
  const files=expectedDigests(expected);
  if(typeof fetchImpl!=='function'||typeof clock!=='function')throw Error('Observation dependencies unavailable');
  const started=observedTime(clock),out=[];
  for(const file of files){
    let response;
    try{
      response=await fetchImpl(ORIGIN+file.name,{
        method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
        headers:{'Cache-Control':'no-cache'}
      });
    }catch{throw Error('CoL hosted evidence unavailable for '+file.name);}
    if(!response||response.status!==200||response.redirected===true||
       typeof response.arrayBuffer!=='function')
      throw Error('CoL hosted evidence unavailable for '+file.name);
    const reported=Number(response.headers?.get?.('content-length'));
    if(Number.isFinite(reported)&&reported>MAX_BYTES)
      throw Error('CoL hosted evidence exceeds safe bound for '+file.name);
    let bytes;
    try{bytes=Buffer.from(await response.arrayBuffer());}
    catch{throw Error('CoL hosted evidence unreadable for '+file.name);}
    if(!bytes.length||bytes.length>MAX_BYTES||sha256(bytes)!==file.sha256)
      throw Error('CoL hosted byte mismatch for '+file.name);
    out.push(Object.freeze({path:file.name,sha256:file.sha256,bytes:bytes.length}));
  }
  const completed=observedTime(clock);
  if(completed.getTime()<started.getTime())throw Error('CoL observation clock moved backwards');
  return Object.freeze({
    kind:'public-col-byte-observation-only',
    origin:ORIGIN,
    startedAt:started.toISOString(),
    completedAt:completed.toISOString(),
    files:Object.freeze(out)
  });
}

/** Explicit operator CLI. It reads PUBLIC checkout bytes and compares PUBLIC
 * GitHub Pages assets. No authenticated APIs or release mutation exists.
 */
async function main(){
  const expected={};
  for(const file of COL_RULE_PUBLIC_FILES)expected[file]=sha256(await readFile(file));
  const result=await observeHostedCoL(expected);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{console.error('Public CoL hosted byte observation FAILED; no activation evidence established.');process.exitCode=1;});
}
