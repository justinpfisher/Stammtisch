import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {photoThumbnail} from '../scripts/annals/PhotoThumbnail.mjs';
import {buildPublishedAnnals,contentDigest} from '../scripts/annals/ApprovedRenderer.mjs';
import {createHmac} from 'node:crypto';
const require=createRequire(import.meta.url),codec=require('../scripts/annals/JpegCodec.js');
const derivative=require('../scripts/annals/PhotoDerivative.js'),media=require('../scripts/annals/MediaCore.js');
function image(w,h){const data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;data[p]=x<w/2?240:20;data[p+1]=y<h/2?240:20;data[p+2]=80;data[p+3]=255;}return {width:w,height:h,data};}
function exif(jpeg,orientation,{little=true,duplicate=false}={}){
  const t=Buffer.alloc(duplicate?38:26), order=little?'LE':'BE';t.write(little?'II':'MM',0);t['writeUInt16'+order](42,2);t['writeUInt32'+order](8,4);t['writeUInt16'+order](duplicate?2:1,8);
  for(let i=0;i<(duplicate?2:1);i++){const p=10+i*12;t['writeUInt16'+order](274,p);t['writeUInt16'+order](3,p+2);t['writeUInt32'+order](1,p+4);t['writeUInt16'+order](orientation,p+8);}
  const payload=Buffer.concat([Buffer.from('Exif\0\0'),t]),head=Buffer.alloc(4);head[0]=255;head[1]=225;head.writeUInt16BE(payload.length+2,2);
  return Buffer.concat([Buffer.from(jpeg).subarray(0,2),head,payload,Buffer.from(jpeg).subarray(2)]);
}
test('JPEG adapter renders every EXIF orientation before dropping metadata',()=>{
  const raw=codec.encode(image(1000,800),85).data;
  for(const little of [true,false])for(let rotation=1;rotation<=8;rotation++){
    const original=exif(raw,rotation,{little}),clean=derivative.convert(original,codec,media);
    assert.equal(clean.width,rotation>=5?800:1000);assert.equal(clean.height,rotation>=5?1000:800);
    assert.equal(clean.orientation,rotation);assert.ok(clean.bytes.length<=524288);
    assert.equal(Buffer.from(clean.bytes).includes(Buffer.from('Exif')),false);
    assert.deepEqual(media.sanitize(clean.bytes,true).bytes,clean.bytes);
    const decoded=codec.decode(clean.bytes,{useTArray:true}),corners=[[240,240,80],[20,240,80],[240,20,80],[20,20,80]];
    // Independent EXIF corner permutations, deliberately not resize() output.
    const order=[[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]][rotation-1];
    for(const [i,[x,y]] of [[50,50],[decoded.width-51,50],[50,decoded.height-51],[decoded.width-51,decoded.height-51]].entries()){
      const p=(y*decoded.width+x)*4;for(let c=0;c<3;c++)assert.ok(Math.abs(decoded.data[p+c]-corners[order[i]][c])<20,'upright quadrant color');
    }
  }
});
test('phone-sized JPEG is resized without upscaling and can be independently decoded',()=>{
  const clean=derivative.convert(codec.encode(image(4032,3024),85).data,codec,media);
  assert.equal(clean.width,1600);assert.equal(clean.height,1200);
  const decoded=codec.decode(clean.bytes,{useTArray:true});assert.equal(decoded.width,1600);assert.equal(decoded.height,1200);
  // This is a fictional geometry fixture, not genuine photographic quality evidence.
});
test('invalid, conflicting orientation and excessive decoded dimensions stay private',()=>{
  const raw=codec.encode(image(800,800),75).data;
  for(const bytes of [Buffer.from('not JPEG'),exif(raw,9),exif(raw,1,{duplicate:true}),exif(raw,1).subarray(0,20)])assert.throws(()=>derivative.convert(bytes,codec,media));
  assert.throws(()=>derivative.convert(codec.encode(image(100,100),75).data,codec,media),/too small/);
  const oversize=Buffer.from(raw);let p=2;while(oversize[p+1]!==192)p+=oversize.readUInt16BE(p+2)+2;
  oversize.writeUInt16BE(8192,p+5);oversize.writeUInt16BE(8192,p+7);
  assert.throws(()=>derivative.convert(oversize,codec,media),/resolution/);
});
test('a short entropy scan cannot manufacture a larger photograph from missing source pixels',()=>{
  const raw=Buffer.from(codec.encode(image(8,8),75).data);let p=2;
  while(raw[p+1]!==192)p+=raw.readUInt16BE(p+2)+2;
  raw.writeUInt16BE(800,p+5);raw.writeUInt16BE(800,p+7);
  const malformed=Buffer.concat([raw.subarray(0,2),Buffer.from([255,221,0,4,0,1]),raw.subarray(2)]);
  assert.throws(()=>derivative.convert(malformed,codec,media),/Incomplete JPEG scan/);
});
test('non-pixel bytes appended to a JPEG scan stay private instead of surviving in a public asset',()=>{
  const raw=Buffer.from(codec.encode(image(800,800),75).data);
  const extra=Buffer.concat([raw.subarray(0,-2),Buffer.from('SYNTHETIC_UNUSED_NONPIXEL_PAYLOAD'),raw.subarray(-2)]);
  assert.throws(()=>derivative.convert(extra,codec,media),/marker/);
  assert.throws(()=>derivative.thumbnail(extra,codec,media),/marker/);
});
test('native Apps Script context needs no Buffer, browser, network or module loader',()=>{
  const context=vm.createContext({});
  for(const name of ['JpegCodec.js','PhotoDerivative.js','MediaCore.js'])vm.runInContext(readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8'),context);
  const raw=codec.encode(image(800,800),80).data;context.raw=Array.from(raw);
  assert.equal(vm.runInContext('AnnalsPhotoDerivative.convert(raw,AnnalsJpegCodec,AnnalsMedia).width',context),800);
  assert.equal(vm.runInContext('typeof Buffer+","+typeof XMLHttpRequest+","+typeof window',context),'undefined,undefined,undefined');
  assert.equal(context.annalsQualifiedPhotoDerivative_({getBlob(){throw Error('should not read HEIC');}},{mime:'image/heic'}),null);
});
test('responsive thumbnail is a deterministic metadata-free downscale of approved pixels',()=>{
  const full=derivative.convert(codec.encode(image(1600,1200),85).data,codec,media);
  const asset={path:'assets/annals/'+'a'.repeat(64)+'.jpg',bytes:Buffer.from(full.bytes)};
  const thumb=photoThumbnail(asset),frame=media.sanitize(thumb.bytes,true);
  assert.equal(frame.width,400);assert.equal(frame.height,300);assert.ok(thumb.bytes.length<=98304);
  assert.ok(thumb.path.endsWith('-thumb.jpg'));
  assert.deepEqual(photoThumbnail(asset),thumb);
  const context=vm.createContext({raw:full.bytes});for(const name of ['JpegCodec.js','PhotoDerivative.js','MediaCore.js'])vm.runInContext(readFileSync(new URL('../scripts/annals/'+name,import.meta.url),'utf8'),context);
  assert.deepEqual(Buffer.from(vm.runInContext('AnnalsPhotoDerivative.thumbnail(raw,AnnalsJpegCodec,AnnalsMedia).bytes',context)),thumb.bytes);
  assert.equal(photoThumbnail({path:'assets/annals/legacy.jpg',bytes:asset.bytes}),null);
});
test('gallery uses actual responsive thumbnail widths while enlargement retains full screened asset',()=>{
  const entry={id:'offline-responsive-photo',year:2026,dateLabel:'',sortDate:'',credit:'anonymous',quoteVerbatim:'',recipe:{drinkIngredients:[],syrupIngredients:[],steps:[]},category:'assembly',title:'Fictional responsive fixture',summary:'Offline fixture only.',photos:[{sha256:'a'.repeat(64),width:1200,height:1600,alt:'Fictional geometry fixture'}]};
  const key='fictional-responsive-test-key-not-production',canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  const approval={entryId:entry.id,approvedAt:'2026-10-15T12:00:00Z',mode:'standing-consent-photos-v2',consents:{publication:true,photoPublication:true,quotePublication:false,recipeVerified:false,namedAttribution:false},contentSha256:contentDigest(entry)};
  approval.signature=createHmac('sha256',key).update(JSON.stringify(canon({entry,approval}))).digest('hex');
  const html=buildPublishedAnnals([entry],[approval],key).html;
  assert.match(html,/-thumb\.jpg 300w/);assert.match(html,/\.jpg 1200w/);assert.match(html,/data-photo-view data-photo-sha256="[a-f0-9]{64}" href="assets\/annals\/[a-f0-9]{64}\.jpg"/);assert.match(html,/loading="lazy"/);
});
