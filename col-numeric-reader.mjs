/* Browser verifier for the independently signed, whole-site numeric snapshot.
 * Missing/invalid trust material returns null so the prior display is retained. */
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
const bytes=s=>new TextEncoder().encode(s);
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|[+-]\d\d:\d\d)$/;
async function digest(value){const hash=await crypto.subtle.digest('SHA-256',bytes(canonical(value)));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function fromBase64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
function pemBytes(pem){return fromBase64(String(pem).replace(/-----[^-]+-----/g,'').replace(/\s/g,''));}
function completeSnapshot(snapshot){
  const ids=['fish','marc','matt','ken','jamie','jerome'];
  if(!snapshot||!Number.isInteger(snapshot.year)||typeof snapshot.asOf!=='string'||!Array.isArray(snapshot.members)||snapshot.members.length!==6)return false;
  const seen=new Set();
  for(const m of snapshot.members){if(!ids.includes(m.id)||seen.has(m.id)||!Array.isArray(m.picks)||!Number.isInteger(m.score))return false;seen.add(m.id);
    if(m.picks.filter(p=>p.counted).reduce((n,p)=>n+p.points,0)!==m.score)return false;}
  return ids.every(id=>seen.has(id));
}

export async function verifyNumericSiteRelease({release,keyring,baseline,clubState,now=Date.now()}){
  try{
    const p=release?.payload;
    if(!p||release.schemaVersion!==1||release.kind!=='col-numeric-site-release-v1'||p.kind!=='col-numeric-release-payload-v1'||
      p.siteResultsDigest!==await digest(p.siteResults)||!completeSnapshot(p.siteResults)||p.baselineDigest!==await digest(baseline)||
      p.correctionsDigest!==await digest(clubState)||!/^[a-f0-9]{40}$/.test(p.implementationCommit||'')||
      !/^[a-f0-9]{64}$/.test(p.behaviorDigest||'')||!/^[a-f0-9]{64}$/.test(p.viewerSourceDigest||'')||
      !/^[0-9]{1,24}$/.test(p.viewerRunId||'')||!/^[a-f0-9]{64}$/.test(p.viewerQualificationDigest||'')||
      !ISO.test(p.viewerObservedAt||'')||Date.parse(p.viewerObservedAt)>now||
      !ISO.test(p.activationAt||'')||!ISO.test(p.observedAt||'')||Date.parse(p.activationAt)>Date.parse(p.observedAt)||
      !Array.isArray(p.consumedPeople)||new Set(p.consumedPeople).size!==p.consumedPeople.length||
      !Array.isArray(p.actionReplayKeys)||new Set(p.actionReplayKeys).size!==p.actionReplayKeys.length||
      p.actionDigest!==await digest(p.actionReplayKeys)||!Array.isArray(p.sourceRowDigests)||
      p.sourceRowDigests.some(x=>!/^[a-f0-9]{64}$/.test(x))||!Array.isArray(p.calculated)||
      new Set(p.calculated.map(x=>x.personKey)).size!==p.calculated.length||
      p.calculated.some(x=>x.status!=='calculated'||!p.consumedPeople.includes(x.personKey))||
      p.keyringDigest!==await digest({schemaVersion:keyring?.schemaVersion??1,keys:keyring?.keys??[]})||
      p.previousReleaseDigest!==(keyring.previousReleaseDigest??null)||keyring.currentReleaseDigest!==await digest(release)||
      !Array.isArray(keyring?.keys))return null;
    // Historical awarded rows are immutable across prospective releases.
    for(const member of baseline.members){const current=p.siteResults.members.find(m=>m.id===member.id);if(!current)return null;
      for(const old of member.picks.filter(x=>x.counted)){const row=current.picks.find(x=>x.id===old.id);if(!row||!row.counted||row.points!==old.points)return null;}}
    const key=keyring.keys.find(k=>k.id===release.keyId&&k.purpose==='numeric-release'&&
      (k.algorithm==='Ed25519'||k.algorithm==='RSA-SHA256'));
    if(!key||typeof key.publicKey!=='string')return null;
    const rsa=key.algorithm==='RSA-SHA256',algorithm=rsa?
      {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}:{name:'Ed25519'};
    const publicKey=await crypto.subtle.importKey('spki',pemBytes(key.publicKey),algorithm,false,['verify']);
    if(rsa&&publicKey.algorithm.modulusLength<2048)return null;
    const signature=fromBase64(release.signature),length=rsa?publicKey.algorithm.modulusLength/8:64;
    if(signature.length!==length)return null;
    const signed=bytes(`Stammtisch-CoL-Numeric-Release-v1\n${canonical(p)}`);
    if(!await crypto.subtle.verify({name:algorithm.name},publicKey,signature,signed))return null;
    const issued=Date.parse(p.createdAt);if(!Number.isFinite(issued)||issued>now+60000||now-issued>365*86400000)return null;
    return structuredClone(p.siteResults);
  }catch{return null;}
}

export async function loadNumericSiteResults({baseline,clubState,fetchImpl=fetch}={}){
  try{
    const [releaseResponse,keyringResponse]=await Promise.all([
      fetchImpl('data/col-numeric-release.json',{cache:'no-store'}),fetchImpl('data/col-numeric-trust.json',{cache:'no-store'})]);
    if(!releaseResponse.ok||!keyringResponse.ok)return null;
    const [release,keyring]=await Promise.all([releaseResponse.json(),keyringResponse.json()]);
    return await verifyNumericSiteRelease({release,keyring,baseline,clubState});
  }catch{return null;}
}
