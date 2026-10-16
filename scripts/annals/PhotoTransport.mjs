import {createHash} from 'node:crypto';
import Photos from './PhotoContracts.js';
import Media from './MediaCore.js';

export function gitBlobHash(bytes){
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

export function verifyPhotoBlob(photo,ref,bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length!==ref.size||bytes.length>Photos.MAX_BYTES||
    gitBlobHash(bytes)!==ref.gitSha||createHash('sha256').update(bytes).digest('hex')!==photo.sha256)
    throw Error('Photo blob digest or size mismatch');
  const clean=Media.sanitize(bytes,true);
  if(!Buffer.from(clean.bytes).equals(bytes)||clean.width!==photo.width||clean.height!==photo.height)
    throw Error('Photo blob metadata or dimensions mismatch');
  return bytes;
}

// Only an already signed public gallery may call this. No caller URL, auth,
// redirect, retry, private Drive link or filename can enter the transport.
export async function fetchPhotoBlob(ref,{fetchImpl=fetch}={}){
  if(!ref||!/^[a-f0-9]{40}$/.test(ref.gitSha||'')||!Number.isInteger(ref.size)||ref.size<24||ref.size>Photos.MAX_BYTES)
    throw Error('Invalid bounded photo request');
  const response=await fetchImpl(`https://api.github.com/repos/justinpfisher/Stammtisch/git/blobs/${ref.gitSha}`,{
    headers:{Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'},
    redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status!==200||response.redirected||!response.body)throw Error('Photo blob unavailable');
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==ref.size)){
    await response.body.cancel();throw Error('Photo response size mismatch');
  }
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    while(true){const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;
      if(size>ref.size||size>Photos.MAX_BYTES)throw Error('Oversized photo response');
      chunks.push(Buffer.from(part.value));
    }
  }catch(error){await reader.cancel();throw error;}
  finally{reader.releaseLock();}
  if(size!==ref.size)throw Error('Truncated photo response');
  return Buffer.concat(chunks,size);
}

export async function resolvePhotoBlobs(photos,refs,fetchBlob=fetchPhotoBlob){
  Photos.blobRefs(photos,refs);
  const assets=[];
  for(let i=0;i<refs.length;i++)assets.push({path:`assets/annals/${photos[i].sha256}.jpg`,
    bytes:verifyPhotoBlob(photos[i],refs[i],await fetchBlob(refs[i]))});
  return assets;
}
