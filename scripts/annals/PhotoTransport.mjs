import {createHash} from 'node:crypto';
import Photos from './PhotoContracts.js';
import Media from './MediaCore.js';
import Jpeg from './JpegCodec.js';
import {metadataFreeJpegDimensions} from './EditorialPhotoManifest.mjs';

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

// Editorial outputs use the same Git blob transport as signed source photos,
 // but bind to the derivative digest and dimensions in the typed signed event.
export async function fetchEditorialBlob(ref,{fetchImpl=fetch}={}){
  if(!ref||Object.keys(ref).sort().join(',')!=='gitSha,height,sha256,size,width'||
    !/^[a-f0-9]{40}$/.test(ref.gitSha||'')||!/^[a-f0-9]{64}$/.test(ref.sha256||'')||
    !Number.isInteger(ref.size)||ref.size<4000||ref.size>5*1024*1024||
    !Number.isInteger(ref.width)||!Number.isInteger(ref.height))
    throw Error('Invalid bounded editorial blob request');
  const response=await fetchImpl(`https://api.github.com/repos/justinpfisher/Stammtisch/git/blobs/${ref.gitSha}`,{
    headers:{Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'},
    redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status!==200||response.redirected||!response.body)throw Error('Editorial blob unavailable');
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==ref.size)){
    await response.body.cancel();throw Error('Editorial response size mismatch');
  }
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    while(true){const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;
      if(size>ref.size||size>5*1024*1024)throw Error('Oversized editorial response');
      chunks.push(Buffer.from(part.value));
    }
  }catch(error){await reader.cancel();throw error;}
  finally{reader.releaseLock();}
  if(size!==ref.size)throw Error('Truncated editorial response');
  const bytes=Buffer.concat(chunks,size);
  if(gitBlobHash(bytes)!==ref.gitSha||createHash('sha256').update(bytes).digest('hex')!==ref.sha256)
    throw Error('Editorial blob digest or size mismatch');
  const dimensions=metadataFreeJpegDimensions(bytes),clean=Media.sanitizeEditorial(bytes,Jpeg);
  if(dimensions.width!==ref.width||dimensions.height!==ref.height||
    clean.width!==ref.width||clean.height!==ref.height||!Buffer.from(clean.bytes).equals(bytes))
    throw Error('Editorial blob dimensions or image decode mismatch');
  return bytes;
}

export async function resolvePhotoBlobs(photos,refs,fetchBlob=fetchPhotoBlob){
  Photos.blobRefs(photos,refs);
  const assets=[];
  for(let i=0;i<refs.length;i++)assets.push({path:`assets/annals/${photos[i].sha256}.jpg`,
    bytes:verifyPhotoBlob(photos[i],refs[i],await fetchBlob(refs[i]))});
  return assets;
}
