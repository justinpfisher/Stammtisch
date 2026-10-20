/* Public derivative qualifications only; private consents and visual evidence
 * must be verified by the authorised publisher before these assertions are set.
 * A manifest declaration alone never grants transformation or publication rights.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sha=/^[0-9a-f]{64}$/;
const sourcePattern=/^assets\/annals\/(?:annal-[0-9a-f]{24}|[0-9a-f]{64})\.jpg$/;
export const EDITORIAL_MANIFEST_PATH='data/annals-editorial-photos.json';

export function photoSources(entries){
  const result=new Map();
  for(const entry of entries){
    if(entry.category!=='cocktail')continue;
    for(const p of entry.photos||entry.photo&&[entry.photo]||[]){
      const name=entry.photos?p.sha256:entry.id;
      const source='assets/annals/'+name+'.jpg';
      if(!sha.test(p.sha256)||!sourcePattern.test(source))throw Error('Invalid signed photo source');
      result.set(source,p.sha256);
    }
  }
  return result;
}

export function validateEditorialManifest(manifest,entries){
  if(!manifest||manifest.schemaVersion!==1||
     manifest.artDirection!=='moody-atmospheric-v2'||
     !Array.isArray(manifest.images)||manifest.images.length>1000||
     Object.keys(manifest).sort().join(',')!=='artDirection,images,schemaVersion')
     throw Error('Invalid editorial manifest');
  const source=photoSources(entries),seen=new Set();
  for(const row of manifest.images){
    if(!row||typeof row!=='object'||Array.isArray(row)||
       Object.keys(row).sort().join(',')!==
       'alt,artDirection,asset,editorialSha256,generatedAt,generationModel,generationProvider,height,reviewMethod,reviewedAt,rightsQualified,safetyQualified,source,sourceSha256,status,visualQualified,width')
       throw Error('Unqualified editorial manifest fields');
    if(!sourcePattern.test(row.source||'')||source.get(row.source)!==row.sourceSha256||
       !sha.test(row.sourceSha256)||!sha.test(row.editorialSha256)||
       row.asset!==row.source.slice(0,-4)+'-editorial-v2.jpg'||
       row.status!=='qualified'||row.artDirection!=='moody-atmospheric-v2'||
       row.rightsQualified!==true||row.safetyQualified!==true||row.visualQualified!==true||
       !Number.isInteger(row.width)||!Number.isInteger(row.height)||
       Math.min(row.width,row.height)<480||Math.max(row.width,row.height)>2560||
       typeof row.alt!=='string'||row.alt.length<12||row.alt.length>240||
       !row.alt.includes('AI-stylized')||/[<>]/.test(row.alt)||
       !/^[a-z][a-z0-9-]{2,63}$/.test(row.generationProvider||'')||
       typeof row.generationModel!=='string'||row.generationModel.length<3||row.generationModel.length>100||
       !['ai-visual-assessment','owner-visual-assessment'].includes(row.reviewMethod)||
       ![row.generatedAt,row.reviewedAt].every(d=>typeof d==='string'&&
         /^\d{4}-\d{2}-\d{2}T/.test(d)&&Number.isFinite(Date.parse(d)))||
       Date.parse(row.reviewedAt)<Date.parse(row.generatedAt)||seen.has(row.source))
       throw Error('Editorial image is not source-matched and visually qualified');
    seen.add(row.source);
  }
  return manifest;
}

// A revoked/withdrawn/replaced source invalidates only the optional derivative.
// Existing signed text, publication and original photo bytes remain untouched.
export function pruneEditorialManifest(manifest,publishedEntries){
  const source=photoSources(publishedEntries);
  const removed=manifest.images.filter(row=>source.get(row.source)!==row.sourceSha256);
  return {manifest:{...manifest,images:manifest.images.filter(row=>source.get(row.source)===row.sourceSha256)},
          removedAssets:removed.map(row=>row.asset)};
}

export function metadataFreeJpegDimensions(bytes){
  if(bytes.length<4000||bytes.length>5*1024*1024||bytes[0]!==0xff||
     bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)
     throw Error('Editorial output is not bounded JPEG');
  let offset=2,width=0,height=0;
  while(offset<bytes.length-2){
    if(bytes[offset++]!==0xff)throw Error('Invalid JPEG marker');
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xda)break;
    if(marker===0xd8||marker===0xd9||marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
    if(offset+1>=bytes.length)throw Error('Truncated JPEG');
    const length=bytes.readUInt16BE(offset);
    if(length<2||offset+length>bytes.length||marker>=0xe1&&marker<=0xef||marker===0xfe)
      throw Error('JPEG metadata or malformed segment');
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);
    }
    offset+=length;
  }
  if(!width||!height)throw Error('JPEG dimensions missing');
  return {width,height};
}

export function verifyEditorialAssets(manifest,entries,root='.'){
  validateEditorialManifest(manifest,entries);
  for(const row of manifest.images){
    for(const [name,digest] of [[row.source,row.sourceSha256],[row.asset,row.editorialSha256]]){
      const full=path.resolve(root,name),base=path.resolve(root,'assets/annals')+path.sep;
      if(!full.startsWith(base))throw Error('Editorial path outside public assets');
      const bytes=readFileSync(full);
      if(createHash('sha256').update(bytes).digest('hex')!==digest)
        throw Error('Published image digest mismatch');
      const dimensions=metadataFreeJpegDimensions(bytes);
      if(name===row.asset&&(dimensions.width!==row.width||dimensions.height!==row.height))
        throw Error('Editorial image dimensions mismatch');
    }
  }
  return {qualified:manifest.images.length,sourceCount:photoSources(entries).size};
}
