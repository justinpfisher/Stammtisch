/* Generation success and a JPEG file are not visual acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {qualifiedEditorialPhoto} from '../annals-photos.mjs';
import {photoSources,validateEditorialManifest,pruneEditorialManifest,
  verifyEditorialAssets,EDITORIAL_MANIFEST_PATH} from '../scripts/annals/EditorialPhotoManifest.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read(EDITORIAL_MANIFEST_PATH));
const archive=JSON.parse(read('data/annals-approved.json'));
const source='assets/annals/annal-96b5ae266a36793c6a203033.jpg';
const sourceSha='ee47c45a0d84121fdd761df6fb9f08e04b276a3504ab5922dd040101b2ac8b44';
function fixture(overrides={}){
  return {source,sourceSha256:sourceSha,asset:source.slice(0,-4)+'-editorial-v2.jpg',
    editorialSha256:'e'.repeat(64),status:'qualified',
    artDirection:'moody-atmospheric-v2',rightsQualified:true,safetyQualified:true,
    visualQualified:true,width:1024,height:1536,
    alt:'AI-stylized editorial photograph of an amber cocktail in a stemmed glass with apple slices.',
    generationProvider:'fictional-test-provider',generationModel:'fictional-model',
    generatedAt:'2026-10-19T20:00:00Z',reviewedAt:'2026-10-19T20:01:00Z',
    reviewMethod:'ai-visual-assessment',...overrides};
}
test('authentic Kingston signed entry and exact public JPEG remain intact',()=>{
  assert.equal(photoSources(archive.entries).get(source),sourceSha);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+source,import.meta.url))).digest('hex'),sourceSha);
  assert.match(read('annals.html'),/data-photo-sha256="ee47c45a0d84121fdd761df6fb9f08e04b276a3504ab5922dd040101b2ac8b44"/);
});
test('failed v1 segmentation cannot be used or regenerated',()=>{
  assert.ok(!existsSync(new URL('../scripts/annals/cocktail-image-style.py',import.meta.url)));
  assert.ok(!existsSync(new URL('../.github/workflows/annals-photo-style.yml',import.meta.url)));
  assert.ok(!existsSync(new URL('../'+source.slice(0,-4)+'-styled-v1.jpg',import.meta.url)));
  assert.doesNotMatch(read('annals-photos.mjs'),/styled-v1|grabCut|background isolation/);
  assert.doesNotMatch(read('.github/workflows/annals-publish.yml'),/cocktail-image-style|opencv/);
});
test('actual public manifest admits zero unqualified Kingston derivatives',()=>{
  assert.deepEqual(manifest.images,[]);
  assert.deepEqual(verifyEditorialAssets(manifest,archive.entries),{qualified:0,sourceCount:1});
  assert.match(read('docs/brand-editorial-style-guide.md'),/whole-scene generative editing/i);
});
test('a source-bound reviewed editorial JPEG can be admitted, but not by file presence alone',()=>{
  const rec=fixture();
  assert.equal(qualifiedEditorialPhoto(rec,source,sourceSha),rec);
  for(const change of [{sourceSha256:'0'.repeat(64)},{visualQualified:false},
    {rightsQualified:false},{safetyQualified:false},{status:'generated'},
    {asset:source.slice(0,-4)+'-styled-v1.jpg'},
    {alt:'A beautiful cocktail.'},{width:1}]){
    assert.equal(qualifiedEditorialPhoto(fixture(change),source,sourceSha),null);
  }
  assert.equal(qualifiedEditorialPhoto(rec,source,'f'.repeat(64)),null);
  assert.equal(qualifiedEditorialPhoto(rec,'assets/annals/evil.jpg',sourceSha),null);
});
test('manifest validation and withdrawal fail closed without changing original',()=>{
  const rec=fixture(),good={...manifest,images:[rec]};
  assert.equal(validateEditorialManifest(good,archive.entries),good);
  assert.throws(()=>validateEditorialManifest({...manifest,images:[fixture({visualQualified:false})]},archive.entries));
  assert.throws(()=>validateEditorialManifest({...manifest,images:[rec,rec]},archive.entries));
  const pruned=pruneEditorialManifest(good,[]);
  assert.deepEqual(pruned.manifest.images,[]);
  assert.deepEqual(pruned.removedAssets,[rec.asset]);
  assert.deepEqual(pruneEditorialManifest(good,archive.entries).manifest.images,[rec]);
});
test('public viewer offers original access only for an actual reviewed editorial asset',()=>{
  const ui=read('annals-photos.mjs'),css=read('annals-photos.css');
  assert.match(ui,/data-original/);assert.match(ui,/AI-stylized editorial photograph/);
  assert.match(ui,/editorialManifestPromise/);assert.match(ui,/probe.onerror/);
  assert.match(css,/\.photo-viewer \[hidden\] \{display:none!important;\}/);
});
