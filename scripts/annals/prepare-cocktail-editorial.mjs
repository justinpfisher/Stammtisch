#!/usr/bin/env node
/* Explicit owner-side one-shot Kingston/ordinary cocktail image-edit runner.
 * No side effects without --execute AND verified signed private authority.
 * Generation, assessment and candidates stay outside the PUBLIC repository
 * until independently qualified for guarded publication. No automatic retry.
 */
import {readFile,writeFile,realpath,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPublicApproval} from './ApprovedRenderer.mjs';
import {verifyIssuedCocktailBudget,imageSpendCents,reviewSpendCents,enforceTotalSpend} from './CocktailEditorialBudget.mjs';
import {
  verifiedCocktailSource,verifyEditorialPermit,stripJpegMetadata,makeSunburstEditRequest,
  requestSunburstEdit,makeVisualReviewRequest,assessSunburstEdit,
  proposedEditorialRecord
} from './CocktailImageEdit.mjs';

const repo=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const sourceDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
function args(argv){
  const result={execute:false};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--execute'){result.execute=true;continue}
    if(!['--entry','--reference','--permit','--budget-ledger','--private-output'].includes(argv[i])||
       i+1>=argv.length||argv[i+1].startsWith('--')||result[argv[i].slice(2)])
      throw Error('Unsupported image-edit argument');
    result[argv[i].slice(2)]=argv[++i];
  }
  if(!/^[a-z0-9][a-z0-9-]{5,63}$/.test(result.entry||''))throw Error('Invalid entry ID');
  if(!result.execute&&(result.reference||result.permit||result['budget-ledger']||result['private-output']))
    throw Error('Protected inputs require explicit --execute');
  return result;
}
async function privateFile(p,required=true){
  if(!p){if(!required)return null;throw Error('Private input unavailable')}
  if(!path.isAbsolute(p))throw Error('Private file must use an absolute path');
  const resolved=await realpath(p);
  if(resolved===repo||resolved.startsWith(repo+path.sep))
    throw Error('Private materials cannot reside inside public GitHub repository');
  const details=await stat(resolved);
  if(!details.isFile()||details.size>500000)throw Error('Invalid bounded private image/proof');
  return readFile(resolved);
}
async function privateDirectory(p){
  if(!p||!path.isAbsolute(p))throw Error('Private output directory required');
  const resolved=await realpath(p);
  const canonical=process.env.ANNALS_EDITORIAL_BUDGET_DIR;
  if(!canonical||!path.isAbsolute(canonical)||
     resolved!==await realpath(canonical))
    throw Error('Canonical private image budget directory unavailable');
  if(resolved===repo||resolved.startsWith(repo+path.sep))
    throw Error('Private outputs cannot reside inside public GitHub repository');
  if(!(await stat(resolved)).isDirectory())throw Error('Private output directory unavailable');
  return resolved;
}
async function run(){
  const options=args(process.argv.slice(2));
  const archive=JSON.parse(await readFile(path.join(repo,'data/annals-approved.json'),'utf8'));
  const entry=archive.entries?.find(e=>e.id===options.entry);
  const approval=archive.approvals?.find(a=>a.entryId===options.entry);
  if(!entry||entry.category!=='cocktail'||!approval)
    throw Error('No signed public cocktail entry');
  const photo=entry.photos?.[0]||entry.photo;
  if(!photo)throw Error('Entry has no approved photograph');
  const name=entry.photos?photo.sha256:entry.id;
  const sourcePath='assets/annals/'+name+'.jpg';
  const sourceBytes=await readFile(path.join(repo,sourcePath));
  if(sourceDigest(sourceBytes)!==photo.sha256)
    throw Error('Public source image digest mismatch');
  if(!options.execute){
    // Offline source-only check; does NOT certify the private signature, grant,
    // budget reservation, generation or published image.
    console.log(JSON.stringify({state:'preflight-source-digest-only',
      sourceSha256:photo.sha256,publisherVerified:false,providerCalled:false,
      generationEnabled:false}));
    return;
  }
  if(process.env.ANNALS_EDITORIAL_IMAGE_ENABLED!=='true'||
     !process.env.ANNALS_EDITORIAL_IMAGE_API_KEY||
     !process.env.ANNALS_PUBLISH_SIGNING_KEY||
     !process.env.ANNALS_EDITORIAL_PERMIT_SIGNING_KEY||
     process.env.ANNALS_EDITORIAL_PERMIT_SIGNING_KEY===process.env.ANNALS_PUBLISH_SIGNING_KEY||
     process.env.ANNALS_EDITORIAL_SECURITY_RECOVERY_VERIFIED!=='true'||
     process.env.ANNALS_EDITORIAL_PROJECT_HARD_LIMIT_VERIFIED!=='true')
    throw Error('Image provider, project hard cap, private signing or activation unavailable');
  if(!verifyPublicApproval(entry,approval,process.env.ANNALS_PUBLISH_SIGNING_KEY))
    throw Error('Signed source publication invalid');
  const subject=verifiedCocktailSource({entry,approval,
    signingKey:process.env.ANNALS_PUBLISH_SIGNING_KEY,
    sourcePath,sourceBytes});
  const referenceBytes=await privateFile(options.reference,
    options.entry==='annal-96b5ae266a36793c6a203033');
  const permitBytes=await privateFile(options.permit);
  let permit;
  try{permit=JSON.parse(permitBytes.toString('utf8'))}
  catch{throw Error('Private editorial rights receipt invalid')}
  const proof=verifyEditorialPermit(permit,{
    entryId:subject.entryId,sourceSha256:subject.sourceSha256,
    // Apps Script signs the ORIGINAL private reference bytes, before
    // the editor strips optional JPEG metadata for the provider request.
    referenceSha256:referenceBytes?sourceDigest(referenceBytes):'',
    signingKey:process.env.ANNALS_PUBLISH_SIGNING_KEY,
    permitSigningKey:process.env.ANNALS_EDITORIAL_PERMIT_SIGNING_KEY});
  const privateOutput=await privateDirectory(options['private-output']);
  // Validate the already-durable OWNER-ISSUER ledger before any provider call.
  // Never create a second, independently spendable local budget reservation.
  const ledgerBytes=await privateFile(options['budget-ledger']);
  let ownerLedger;
  try{ownerLedger=JSON.parse(ledgerBytes.toString('utf8'))}
  catch{throw Error('Private owner-issued budget snapshot invalid')}
  const reservation=verifyIssuedCocktailBudget({
    ledger:ownerLedger,permit,entryId:subject.entryId,
    sourceSha256:subject.sourceSha256});
  const editRequest=makeSunburstEditRequest({subject,referenceBytes});
  const prior=await readdir(privateOutput);
  if(prior.includes('cocktail-editorial-budget-private.json')||
     prior.includes('cocktail-editorial-budget.lock'))
    throw Error('Conflicting local image spending ledger; no provider call');
  // Detect older private attempt markers before migrating to the stable
  // source-based marker. Corrupt records hold rather than permit a repeat.
  for(const name of prior.filter(x=>x.endsWith('-attempt-private.json'))){
    let saved;
    try{saved=JSON.parse(await readFile(path.join(privateOutput,name),'utf8'))}
    catch{throw Error('Unreconciled prior editorial attempt; no provider call')}
    if(saved?.sourceSha256===subject.sourceSha256)
      throw Error('Previously attempted editorial source; no provider retry');
  }
  // Stable exact-source marker, not a permit-nonce marker. A newly signed
  // permit cannot evade the local one-shot ban for the same photograph.
  const marker=path.join(privateOutput,
    'cocktail-'+subject.sourceSha256+'-attempt-private.json');
  const attempt={state:'reserved-no-retry',entryId:subject.entryId,
    sourceSha256:subject.sourceSha256,attemptDigest:proof.attemptDigest,
    budgetPeriod:reservation.period,reservedCents:reservation.reservationCents,
    reservedAt:new Date().toISOString(),apiCallsAttempted:false};
  // 'wx' is deliberately exclusive; a crash or uncertain API response
  // leaves the file and prevents billing another call on re-execution.
  await writeFile(marker,JSON.stringify(attempt,null,2)+'\n',
    {flag:'wx',mode:0o600});
  let resultState='held-no-retry';
  try{
    attempt.apiCallsAttempted=true;
    await writeFile(marker,JSON.stringify(attempt,null,2)+'\n',{mode:0o600});
    const generatedAt=new Date().toISOString();
    const edited=await requestSunburstEdit({request:editRequest,
      permitVerification:proof,reservedAttempt:true,
      apiKey:process.env.ANNALS_EDITORIAL_IMAGE_API_KEY});
    // Persist paid output BEFORE any further billing or visual-qualification
    // request. Otherwise an optional-usage discrepancy, assessment hold or
    // process interruption irreversibly discards a paid, source-bound edit.
    // These files are private, *not* publication candidates or approval.
    const base='cocktail-'+subject.sourceSha256;
    await writeFile(path.join(privateOutput,base+'-generated-private.jpg'),
      edited.bytes,{flag:'wx',mode:0o600});
    await writeFile(path.join(privateOutput,base+'-generation-private.json'),
      JSON.stringify({sourceSha256:subject.sourceSha256,
        editorialSha256:edited.editedSha256,
        provider:edited.provider,model:edited.model,
        generationOperation:edited.operation,
        requestDigest:edited.requestDigest,usage:edited.usage,
        generatedAt,publicRelease:false,visualQualified:false},null,2)+'\n',
      {flag:'wx',mode:0o600});
    attempt.editedSha256=edited.editedSha256;
    attempt.generationUsage=edited.usage;
    const generationCents=imageSpendCents(edited.usage);
    // Provider usage missing or over-limit: no SECOND billable review.
    attempt.generationEstimatedCents=generationCents;
    // Hold rather than buy a second assessment with effectively no headroom.
    // Reserve a conservative USD 0.50 of the already authorised USD 2 for
    // high-detail multi-image review; still verify actual total usage after it.
    enforceTotalSpend({editCents:generationCents,reviewCents:50});
    const reviewRequest=makeVisualReviewRequest({
      subject,editedBytes:edited.bytes,referenceBytes});
    const judgement=await assessSunburstEdit({request:reviewRequest,
      permitVerification:proof,reservedAttempt:true,
      apiKey:process.env.ANNALS_EDITORIAL_IMAGE_API_KEY});
    attempt.reviewUsage=judgement.usage;
    attempt.reviewEstimatedCents=reviewSpendCents(judgement.usage);
    attempt.totalEstimatedCents=enforceTotalSpend({
      editCents:generationCents,reviewCents:attempt.reviewEstimatedCents});
    attempt.reviewedAt=new Date().toISOString();
    attempt.passed=judgement.assessment.qualified;
    attempt.failedChecks=judgement.assessment.failedChecks;
    if(judgement.assessment.qualified){
      const row=proposedEditorialRecord({subject,edited,
        review:judgement.assessment,permitVerification:proof,
        generatedAt,reviewedAt:attempt.reviewedAt});
      await writeFile(path.join(privateOutput,base+'-candidate.jpg'),
        edited.bytes,{flag:'wx',mode:0o600});
      await writeFile(path.join(privateOutput,base+'-qualified-metadata-private.json'),
        JSON.stringify({row,apiRequestDigest:edited.requestDigest,
          reviewResult:judgement.assessment,publicRelease:false},null,2)+'\n',
        {flag:'wx',mode:0o600});
      resultState='qualified-private-unpublished';
    }
  }finally{
    attempt.state=resultState;
    attempt.finishedAt=new Date().toISOString();
    await writeFile(marker,JSON.stringify(attempt,null,2)+'\n',{mode:0o600});
  }
  console.log(JSON.stringify({state:resultState,providerCallsAttempted:true,
    publicPublication:false,originalPreserved:true}));
}
run().catch(()=>{
  // No private paths, source records, proof content, keys or provider bodies
  // should be written to public workflow output.
  console.error('Cocktail editorial image held. Consult the private one-shot record.');
  process.exitCode=1;
});
