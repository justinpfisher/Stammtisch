/* Private owner-only Apps Script V8 transport primitives.
 * NO remote entrypoint, key provisioning, source authentication or authority
 * inference. Callers must separately qualify provenance, independence, identity,
 * original Viewer row and replay before invoking these primitives.
 * This file is NOT a production signing installation. */
function annalsNumericCanonical_(v) {
  if (v===null || typeof v==='string' || typeof v==='number' || typeof v==='boolean') {
    if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Invalid numeric value');
    return JSON.stringify(v);
  }
  if(Array.isArray(v))return '['+v.map(annalsNumericCanonical_).join(',')+']';
  if(typeof v==='object') {
    if(v instanceof Date)throw new Error('Raw dates must be explicit ISO strings');
    return '{'+Object.keys(v).sort().map(function(k){
      return JSON.stringify(k)+':'+annalsNumericCanonical_(v[k]);
    }).join(',')+'}';
  }
  throw new Error('Undefined or executable numeric signing input');
}

function annalsNumericRsaSign_(domain,keyId,payload,privateKeyPem) {
  var domains=[
    'Stammtisch-CoL-Authenticated-Member-Action-v1',
    'Stammtisch-CoL-Independent-Death-Witness-v1',
    'Stammtisch-CoL-Numeric-Activation-Boundary-v1',
    'Stammtisch-CoL-Viewer-Source-Row-v1',
    'Stammtisch-CoL-Numeric-Release-v1'
  ];
  if(domains.indexOf(domain)<0 || typeof keyId!=='string' ||
     !/^[a-z0-9-]{8,80}$/.test(keyId) || keyId.indexOf('test-')===0 ||
     typeof privateKeyPem!=='string' ||
     !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(privateKeyPem))
    throw new Error('Production numeric signing authority is not configured');
  var canonical=annalsNumericCanonical_(payload);
  var bytes=Utilities.computeRsaSha256Signature(domain+'\n'+canonical,privateKeyPem,Utilities.Charset.UTF_8);
  return {keyId:keyId,payload:payload,signature:Utilities.base64Encode(bytes)};
}

/* The first complete signed snapshot is larger than GitHub repository_dispatch
 * permits as raw JSON. The only event transported is a bounded, screened,
 * compressed DERIVATIVE. Do not include raw mail, chats, credentials, proofs of
 * consent, contact identifiers or private workbook exports in the input. */
function annalsNumericPackDispatch_(bundle) {
  if(!bundle || typeof bundle!=='object' || Array.isArray(bundle) ||
     Object.keys(bundle).sort().join(',')!==
       ['schemaVersion','kind','release','activationWitness','events','actionEnvelopes'].sort().join(',') ||
     bundle.schemaVersion!==1 || bundle.kind!=='col-numeric-publication-request-v1' ||
     !bundle.release || !Array.isArray(bundle.events) || !Array.isArray(bundle.actionEnvelopes) ||
     bundle.events.length>50 || bundle.actionEnvelopes.length>50)
    throw new Error('Only a bounded signed numerical publication request may be transported');
  var allowed=['name','born','diedOn','diedAt','discoveredOn','deathWitness','viewerRowWitness'];
  bundle.events.forEach(function(e){
    if(!e || typeof e!=='object' || Array.isArray(e) ||
       !['name','born','diedOn','discoveredOn','deathWitness','viewerRowWitness'].every(function(k){
         return Object.prototype.hasOwnProperty.call(e,k);
       }) ||
       Object.keys(e).some(function(k){return allowed.indexOf(k)<0;}))
      throw new Error('Unscreened evidence cannot enter public dispatch');
  });
  bundle.actionEnvelopes.forEach(function(a){
    if(!a || !a.payload || !a.payload.action || a.payload.action.kind!=='draft')
      throw new Error('Only authenticated draft actions may enter public dispatch');
  });
  var json=JSON.stringify(bundle),blob=Utilities.newBlob(json,'application/json');
  if(blob.getBytes().length>512*1024)throw new Error('Complete numerical snapshot exceeds bound');
  var packed=Utilities.gzip(blob).getBytes(),encoded=Utilities.base64Encode(packed);
  if(packed.length>45000 || encoded.length>60000)
    throw new Error('Signed numerical transport exceeds GitHub dispatch bound');
  return {schemaVersion:1,kind:'col-numeric-gzip-dispatch-v1',
    encoding:'gzip+base64',payload:encoded};
}
