import Media from './MediaCore.js';
import Jpeg from './JpegCodec.js';
import Photos from './PhotoContracts.js';
import {resolvePhotoBlobs,fetchEditorialBlob} from './PhotoTransport.mjs';
import {photoThumbnail} from './PhotoThumbnail.mjs';
import {EDITORIAL_MANIFEST_PATH,validateEditorialManifest,pruneEditorialManifest,metadataFreeJpegDimensions} from './EditorialPhotoManifest.mjs';

// Trusted deployment configuration only. An email/payload cannot arm this lane.
export function photoReleaseAllowed({photosEnabled,guardedJpegEnabled=false,securityVerified}){
  return securityVerified===true && (photosEnabled===true || guardedJpegEnabled===true);
}
import {writePhotoIndex} from './PhotoIndex.mjs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublishedAnnals, contentDigest, validatePublicTextEntry, verifyPublicApproval, verifyPublicRemoval } from './ApprovedRenderer.mjs';
import { emptyHistory } from './HistoryPublisher.mjs';

export function approvedPhoto(entry, base64) {
  if (!entry.photo) {
    if (base64 !== undefined) throw new Error('Unexpected image payload');
    return null;
  }
  if (typeof base64 !== 'string' || base64.length > 44000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Invalid image payload');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 32768 || bytes.toString('base64') !== base64 || createHash('sha256').update(bytes).digest('hex') !== entry.photo.sha256) throw new Error('Image digest mismatch');
  if (bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error('Unsupported image');
  const clean=Media.sanitize(bytes);
  if(!Buffer.from(clean.bytes).equals(bytes))throw new Error('Derivative contains metadata');
  let offset = 2, width = 0, height = 0;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) throw new Error('Malformed JPEG');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) break;
    if (marker === 0xd9 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 1 >= bytes.length) throw new Error('Malformed JPEG');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length || (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) throw new Error('JPEG metadata or malformed segment');
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5);
    }
    offset += length;
  }
  if (!width || !height || width > 1200 || height > 1200) throw new Error('Photo derivative dimensions are invalid');
  return bytes;
}

export function assertFreshDispatch(event, now) {
  const timestamp=event?.client_payload?.approval?.approvedAt;
  const at=Date.parse(timestamp);
  if(!Number.isFinite(at)||at>now.getTime()+60000||now.getTime()-at>86400000)
    throw new Error('Expired or future publication approval');
}

function canonicalEditorial(value){
  if(Array.isArray(value))return value.map(canonicalEditorial);
  if(value&&typeof value==='object'){
    const result={};
    for(const key of Object.keys(value).sort())result[key]=canonicalEditorial(value[key]);
    return result;
  }
  return value;
}

export async function applyApprovedEntry({ event, data, secret, history = emptyHistory(), now, photosEnabled=false, blobTransportEnabled=false, fetchBlob, fetchEditorialBytes=fetchEditorialBlob, editorialManifest }) {
  const actions = ['annals-approved-entry', 'annals-auto-entry', 'annals-correct-entry', 'annals-remove-entry', 'annals-editorial-photo-v1'];
  if (!event || !actions.includes(event.action) || !event.client_payload) throw new Error('Invalid dispatch event');
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.approvals) ||
      Object.keys(data).some(k => !['schemaVersion', 'entries', 'approvals', 'retiredIds'].includes(k))) throw new Error('Invalid public archive');
  if (now&&event.action!=='annals-editorial-photo-v1') assertFreshDispatch(event,now);
  const retiredIds=[...(data.retiredIds || [])];
  if(!Array.isArray(data.retiredIds || [])||retiredIds.length>5000||new Set(retiredIds).size!==retiredIds.length||retiredIds.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{5,63}$/.test(id)))throw new Error('Invalid withdrawal replay ledger');
  const entries = data.entries.map(validatePublicTextEntry);
  const approvals = [...data.approvals];
  const assetsToWrite = [], assetsToDelete = [];
  // Refuse to mutate an archive that already contains invalid public approvals.
  buildPublishedAnnals(entries, approvals, secret, history, editorialManifest);
  if(event.action==='annals-editorial-photo-v1'){
    if(photosEnabled!==true||blobTransportEnabled!==true)
      throw Error('Editorial photo publication remains disabled');
    const payload=event.client_payload;
    if(Object.keys(payload).sort().join(',')!=='blob,issuedAt,photo,signature')
      throw Error('Invalid editorial photo event payload');
    const issued=Date.parse(payload.issuedAt);
    if(!now||!Number.isFinite(now.getTime())||!Number.isFinite(issued)||
       issued>now.getTime()+30000||now.getTime()-issued>5*60*1000)
      throw Error('Stale editorial photo event');
    if(typeof secret!=='string'||secret.length<32||typeof payload.signature!=='string'||
       !/^[a-f0-9]{64}$/.test(payload.signature))
      throw Error('Invalid editorial event signature');
    const signed=JSON.stringify(canonicalEditorial({
      operation:'editorial-photo-v1',photo:payload.photo,blob:payload.blob,issuedAt:payload.issuedAt
    }));
    const expected=createHmac('sha256',secret).update(signed).digest();
    const supplied=Buffer.from(payload.signature,'hex');
    if(supplied.length!==expected.length||!timingSafeEqual(expected,supplied))
      throw Error('Invalid editorial event signature');
    if(!editorialManifest)throw Error('Editorial manifest unavailable');
    validateEditorialManifest(editorialManifest,entries);
    validateEditorialManifest({schemaVersion:1,artDirection:'moody-atmospheric-v2',images:[payload.photo]},entries);
    if(editorialManifest.images.some(row=>row.source===payload.photo.source))
      throw Error('An editorial photo already exists for this source');
    if(!payload.blob||Object.keys(payload.blob).sort().join(',')!=='gitSha,size'||
       !/^[a-f0-9]{40}$/.test(payload.blob.gitSha||'')||
       !Number.isInteger(payload.blob.size)||payload.blob.size<4000||payload.blob.size>5*1024*1024)
      throw Error('Invalid editorial blob reference');
    const ref={gitSha:payload.blob.gitSha,size:payload.blob.size,
      sha256:payload.photo.editorialSha256,width:payload.photo.width,height:payload.photo.height};
    const bytes=await fetchEditorialBytes(ref);
    if(!Buffer.isBuffer(bytes)||bytes.length!==payload.blob.size||
       createHash('sha256').update(bytes).digest('hex')!==payload.photo.editorialSha256)
      throw Error('Editorial image digest mismatch');
    const dimensions=metadataFreeJpegDimensions(bytes),clean=Media.sanitizeEditorial(bytes,Jpeg);
    if(dimensions.width!==payload.photo.width||dimensions.height!==payload.photo.height||
       clean.width!==payload.photo.width||clean.height!==payload.photo.height||
       !Buffer.from(clean.bytes).equals(bytes))
      throw Error('Editorial image dimensions or decode mismatch');
    const nextManifest={...editorialManifest,images:[...editorialManifest.images,payload.photo]};
    validateEditorialManifest(nextManifest,entries);
    const rendered=buildPublishedAnnals(entries,approvals,secret,history,nextManifest);
    return {data:{...data,entries,approvals},html:rendered.html,
      assetsToWrite:[{path:payload.photo.asset,bytes}],assetsToDelete:[],
      editorialManifest:nextManifest};
  }
  if (event.action === 'annals-remove-entry') {
    if (Object.keys(event.client_payload).sort().join(',') !== 'approval,entryId') throw new Error('Invalid removal payload');
    const index = entries.findIndex(item => item.id === event.client_payload.entryId);
    const approvalIndex = approvals.findIndex(item => item?.entryId === event.client_payload.entryId);
    if (index < 0 || approvalIndex < 0 || !verifyPublicRemoval(entries[index], event.client_payload.approval, secret)) throw new Error('Missing exact removal approval');
    const removed=entries[index];
    entries.splice(index, 1); approvals.splice(approvalIndex, 1);
    retiredIds.push(event.client_payload.entryId);
    const removalManifest=editorialManifest?pruneEditorialManifest(editorialManifest,entries).manifest:undefined;
    const result = buildPublishedAnnals(entries, approvals, secret, history, removalManifest);
    return { data: { schemaVersion: 1, entries, approvals, retiredIds }, html: result.html,
      assetsToDelete: [{ path: `assets/annals/${event.client_payload.entryId}.jpg` }, {path:`assets/annals/${event.client_payload.entryId}-editorial-v2.jpg`}, ...Photos.photos(removed).filter(p=>!entries.some(e=>Photos.photos(e).some(x=>x.sha256===p.sha256))).flatMap(p=>[{path:`assets/annals/${p.sha256}.jpg`},{path:`assets/annals/${p.sha256}-thumb.jpg`},{path:`assets/annals/${p.sha256}-editorial-v2.jpg`}])], assetsToWrite: [] };
  } else {
    const keys = Object.keys(event.client_payload).sort().join(',');
    if (keys !== 'approval,entry' && keys !== 'approval,entry,imageBase64' && keys !== 'approval,entry,images' && keys !== 'approval,entry,imageBlobs') throw new Error('Invalid entry payload');
    const entry = validatePublicTextEntry(event.client_payload.entry), approval = event.client_payload.approval;
    if(entry.photos && photosEnabled!==true)throw Error('Photographic v2 release remains disabled');
    if(retiredIds.includes(entry.id))throw new Error('Withdrawn identity cannot be replayed');
    if (!verifyPublicApproval(entry, approval, secret)) throw new Error('Missing exact public approval');
    if (event.action === 'annals-auto-entry') {
      if (!entry.photos && ['club_history','monthly_gathering','artefact'].includes(entry.category))
        throw new Error('Living History requires distinct signed revision authority');
      if ((['standing-consent-text-v1','open-email-text-v1'].includes(approval.mode) && (entry.photo || entry.photos || event.client_payload.imageBase64 !== undefined || event.client_payload.images !== undefined || event.client_payload.imageBlobs !== undefined)) ||
          (['standing-consent-image-v1','standing-consent-photos-v2'].includes(approval.mode) && (!(entry.photo || entry.photos) || entry.photo && event.client_payload.imageBase64 === undefined || entry.photos && event.client_payload.images === undefined && event.client_payload.imageBlobs === undefined)) ||
          (approval.mode === 'standing-consent-quote-v1' &&
            (entry.category !== 'quotation' || !entry.speakerPortrait || entry.photo || entry.photos ||
             event.client_payload.imageBase64 !== undefined)) ||
          !['standing-consent-text-v1','open-email-text-v1','standing-consent-image-v1','standing-consent-photos-v2','standing-consent-quote-v1'].includes(approval.mode))
        throw new Error('Automated publication requires signed standing-consent proof and bounded media');
    } else if (approval.mode !== undefined) {
      throw new Error('Standing-consent proof cannot be reused for manual publication or correction');
    }
    const index = entries.findIndex(item => item.id === entry.id);
    if(event.action!=='annals-correct-entry'&&(index>=0||approvals.some(item=>item.entryId===entry.id)))throw Error('Entry already exists; no duplicate publication');
    if(event.action==='annals-correct-entry'){
      const previousApproval=approvals.find(item=>item?.entryId===entry.id);
      if(index<0||!previousApproval||Date.parse(approval.approvedAt)<=Date.parse(previousApproval.approvedAt)||contentDigest(entries[index])===contentDigest(entry))throw Error('Correction must replace an existing entry with changed exact text');
      // Photo corrections change captions/date/text only. Replacing or adding
      // an asset requires separately qualified source/rights engineering.
      if((entries[index].photos||entry.photos)&&(!entries[index].photos||!entry.photos||!Photos.sameAssets(entries[index].photos,entry.photos)))throw Error('Gallery replacement remains held');
    }
    let imageBytes=null;
    if(event.client_payload.imageBlobs!==undefined){
      if(!entry.photos||!blobTransportEnabled)throw Error('Photo blob transport remains disabled');
      // Gate and signature validation above precede every network request. Each
      // response is streamed under its declared bound before any file is written.
      assetsToWrite.push(...await resolvePhotoBlobs(entry.photos,event.client_payload.imageBlobs,fetchBlob));
    }else if(entry.photos){
      const payload=event.client_payload.images;
      if(event.client_payload.imageBase64!==undefined||!Array.isArray(payload)||payload.length!==entry.photos.length||new Set(payload.map(p=>p.sha256)).size!==payload.length)throw Error('Exact gallery payload required');
      let total=0;
      for(const p of entry.photos){const image=payload.find(x=>x.sha256===p.sha256);
        if(!image||Object.keys(image).sort().join(',')!=='base64,sha256')throw Error('Unexpected image payload');
        const bytes=approvedPhoto({photo:p},image.base64);total+=bytes.length;
        const frame=Media.sanitize(bytes);if(frame.width!==p.width||frame.height!==p.height)throw Error('Photo dimensions mismatch');
        assetsToWrite.push({path:`assets/annals/${p.sha256}.jpg`,bytes});
      }
      if(total>32768)throw Error('Gallery exceeds existing dispatch bound');
    }else{
      if(event.client_payload.images!==undefined)throw Error('Unexpected gallery payload');
      imageBytes=approvedPhoto(entry,event.client_payload.imageBase64);
    }
    if (event.action === 'annals-approved-entry' || event.action === 'annals-auto-entry') {
      if (index >= 0 || approvals.some(item => item.entryId === entry.id)) throw new Error('Entry already exists; no duplicate publication');
      entries.push(entry); approvals.push(approval);
    } else {
      const approvalIndex = approvals.findIndex(item => item?.entryId === entry.id);
      if (index < 0 || approvalIndex < 0 || Date.parse(approval.approvedAt) <= Date.parse(approvals[approvalIndex].approvedAt) || contentDigest(entries[index]) === contentDigest(entry)) {
        throw new Error('Correction must replace an existing entry with changed exact text');
      }
      if (entries[index].photo && !entry.photo) assetsToDelete.push({ path: `assets/annals/${entry.id}.jpg` }, { path: `assets/annals/${entry.id}-editorial-v2.jpg` });
      const priorPhotos=entries[index].photos || [];
      entries[index] = entry; approvals[approvalIndex] = approval;
      for(const p of priorPhotos)if(!entries.some(e=>Photos.photos(e).some(x=>x.sha256===p.sha256)))assetsToDelete.push({path:`assets/annals/${p.sha256}.jpg`},{path:`assets/annals/${p.sha256}-thumb.jpg`},{path:`assets/annals/${p.sha256}-editorial-v2.jpg`});
    }
    if (imageBytes) assetsToWrite.push({ path: `assets/annals/${entry.id}.jpg`, bytes: imageBytes });
  }
  // A signed text correction may remove a legacy photo. Prune its optional
  // derivative before rendering so the old row cannot invalidate the corrected
  // entry; main() still compares the returned archive and deletes stale assets.
  const renderManifest=event.action==='annals-correct-entry'&&editorialManifest
    ?pruneEditorialManifest(editorialManifest,entries).manifest:editorialManifest;
  const rendered = buildPublishedAnnals(entries, approvals, secret, history, renderManifest);
  for(const asset of [...assetsToWrite]){const thumb=photoThumbnail(asset);if(thumb)assetsToWrite.push(thumb);}
  return { data: { schemaVersion: 1, entries, approvals, ...(retiredIds.length ? {retiredIds} : {}) }, html: rendered.html, assetsToWrite, assetsToDelete };
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const dataPath = 'data/annals-approved.json';
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const history = JSON.parse(await readFile('data/club-history.json', 'utf8'));
  const now=new Date(),photosEnabled=photoReleaseAllowed({
    photosEnabled:process.env.ANNALS_PHOTOS_V2_RELEASE_ENABLED==='true',
    guardedJpegEnabled:process.env.ANNALS_PHOTOS_GUARDED_JPEG_ENABLED==='true',
    securityVerified:process.env.ANNALS_SIGNING_REMEDIATION_VERIFIED==='true'
  });
  if(Buffer.byteLength(JSON.stringify({event_type:event.action,client_payload:event.client_payload}))>60000)throw Error('Dispatch envelope exceeds bound');
  const originalManifest=JSON.parse(await readFile(EDITORIAL_MANIFEST_PATH,'utf8'));
  validateEditorialManifest(originalManifest,data.entries);
  const result = await applyApprovedEntry({ event, data, secret: process.env.ANNALS_PUBLISH_SIGNING_KEY, history, now, photosEnabled,
    blobTransportEnabled:process.env.ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED==='true',
    editorialManifest:originalManifest }); 
  const pruned=pruneEditorialManifest(result.editorialManifest||originalManifest,result.data.entries);
  for(const asset of pruned.removedAssets)result.assetsToDelete.push({path:asset});
  for (const item of result.assetsToDelete) await rm(item.path, { force: true });
  for (const item of result.assetsToWrite) { await mkdir(path.dirname(item.path), { recursive: true }); await writeFile(item.path, item.bytes); }
  await writeFile(dataPath, JSON.stringify(result.data, null, 2) + '\n');
  await writeFile(EDITORIAL_MANIFEST_PATH,JSON.stringify(pruned.manifest,null,2)+'\n');
  await writeFile('annals.html', result.html + '\n');
  await writePhotoIndex(result.data.entries);
  console.log('Approved Annals entry rendered.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Approved Annals publish rejected; no private details logged.'); process.exitCode = 1; });
}
