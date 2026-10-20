#!/usr/bin/env node
/* Explicit owner-side one-shot Kingston/ordinary cocktail image-edit runner.
 * No side effects without --execute AND verified signed private authority.
 * Generation, assessment and candidates stay outside the PUBLIC repository
 * until independently qualified for guarded publication. No automatic retry.
 */
import {readFile,writeFile,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPublicApproval} from './ApprovedRenderer.mjs';
import {reserveCocktailBudget,imageSpendCents,reviewSpendCents,enforceTotalSpend} from './CocktailEditorialBudget.mjs';
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
    if(!['--entry','--reference','--permit','--private-output'].includes(argv[i])||
       i+1>=argv.length||argv[i+1].startsWith('--')||result[argv[i].slice(2)])
      throw Error('Unsupported image-edit argument');
    result[argv[i].slice(2)]=argv[++i];
  }
  if(!/^[a-z0-9][a-z0-9-]{5,63}$/.test(result.entry||''))throw Error('Invalid entry ID');
  if(!result.execute&&(result.reference||result.permit||result['private-output']))
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
     !process.env.ANNALS_PUBLISH_SIGNING_KEY)
    throw Error('Image provider, private signing or explicit spending activation unavailable');
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
    referenceSha256:referenceBytes?sourceDigest(stripJpegMetadata(referenceBytes)):'',
    signingKey:process.env.ANNALS_PUBLISH_SIGNING_KEY});
  const privateOutput=await privateDirectory(options['private-output']);
  // Perform ALL no-spend validation before a durable one-shot reservation.
  const editRequest=makeSunburstEditRequest({subject,referenceBytes});
  // One canonical owner-private ledger, independent of the existing text AI
  // allowance. A valid signed budget flag is not itself a spend reservation.
  const reservation=await reserveCocktailBudget({directory:privateOutput,
    entryId:subject.entryId,sourceSha256:subject.sourceSha256,permit});
  const marker=path.join(privateOutput,
    sourceDigest(Buffer.from(proof.attemptDigest+subject.sourceSha256))+'-attempt-private.json');
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
    attempt.generationUsage=edited.usage;
    const generationCents=imageSpendCents(edited.usage);
    // Provider usage missing or over-limit: no SECOND billable review.
    attempt.generationEstimatedCents=generationCents;
    enforceTotalSpend({editCents:generationCents});
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
      const base='cocktail-'+subject.sourceSha256;
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
