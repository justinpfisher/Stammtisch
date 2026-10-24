import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,sign} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createContext,runInContext} from 'node:vm';
import {ACTIVATION_DOMAIN,verifyAttestation} from '../col-numeric-adapter.mjs';
import {numericDispatchBundle} from '../scripts/col-numeric-publication.mjs';

const source=await readFile(new URL('../scripts/annals/NumericTransport.gs',import.meta.url),'utf8');
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'});
const publicKey=pair.publicKey.export({type:'spki',format:'pem'});
const numericKey='owner-numeric-activation';
const mock={
  Charset:{UTF_8:'UTF_8'},
  computeRsaSha256Signature: (message,key,charset)=>{
    assert.equal(charset,'UTF_8');
    assert.equal(key,privateKey);
    return Array.from(sign('RSA-SHA256',Buffer.from(message,'utf8'),privateKey));
  },
  base64Encode: bytes=>Buffer.from(bytes).toString('base64'),
  newBlob: body=>({getBytes:()=>Array.from(Buffer.from(body,'utf8'))}),
  gzip: blob=>({getBytes:()=>Array.from(gzipSync(Buffer.from(blob.getBytes())))})
};
const context=createContext({Utilities:mock,Date,JSON,Object,Number,Array});
runInContext(source,context);
const base=JSON.parse(await readFile(new URL('../data/celebration.json',import.meta.url)));

test('owner-only Apps Script signs canonical Unicode RSA-SHA256 bytes Node can verify',()=>{
  const payload={issuedAt:'2026-10-23T11:59:00.000Z',schemaVersion:1,
    text:'Crème brûlée — Montréal — ceremonial 🍁',nested:{z:2,a:['a',true,null]}};
  const signed=context.annalsNumericRsaSign_(ACTIVATION_DOMAIN,numericKey,payload,privateKey);
  const ring={keys:[{id:numericKey,purpose:'numeric-activation-boundary',
    publicKey,algorithm:'RSA-SHA256'}]};
  assert.equal(verifyAttestation(signed,{domain:ACTIVATION_DOMAIN,keyring:ring,
    purpose:'numeric-activation-boundary',
    now:new Date('2026-10-23T12:00:00.000Z')}),payload);
  assert.throws(()=>context.annalsNumericRsaSign_('Wrong domain',numericKey,payload,privateKey),
    /authority is not configured/);
  assert.throws(()=>context.annalsNumericRsaSign_(ACTIVATION_DOMAIN,'test-key',payload,privateKey),
    /authority is not configured/);
});

test('complete historical snapshot compresses into GitHub dispatch and round-trips byte-equivalently',()=>{
  const request={schemaVersion:1,kind:'col-numeric-publication-request-v1',
    release:{schemaVersion:1,payload:{siteResults:base}},activationWitness:null,
    events:[],actionEnvelopes:[]};
  const packed=context.annalsNumericPackDispatch_(request);
  assert(Buffer.byteLength(JSON.stringify(request))>65535);
  assert(Buffer.byteLength(JSON.stringify(packed))<65535);
  assert.deepEqual(numericDispatchBundle(packed),request);
});

test('private transport blocks unreviewed source fields, oversized binary, and non-draft actions',()=>{
  const request={schemaVersion:1,kind:'col-numeric-publication-request-v1',
    release:{payload:{siteResults:base}},activationWitness:null,
    events:[],actionEnvelopes:[]};
  assert.throws(()=>context.annalsNumericPackDispatch_({...request,privateMail:'x'}),
    /bounded signed numerical/);
  assert.throws(()=>context.annalsNumericPackDispatch_({...request,
    events:[{name:'Fictional',born:'1900-01-01',diedOn:'2026-10-23',discoveredOn:'2026-10-23',
      deathWitness:{},viewerRowWitness:{},rawEmail:'sensitive'}]}),
    /Unscreened evidence/);
  assert.throws(()=>context.annalsNumericPackDispatch_({...request,
    actionEnvelopes:[{payload:{action:{kind:'note'}}}]}),
    /Only authenticated draft actions/);
});
