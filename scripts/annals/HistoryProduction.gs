/* Added to the EXISTING owner-only deployment; no installation or trigger reset. */
/* Member eligibility is centralized in Production.gs. */
/** Read-only rotation check using an existing private signed record. Never
 * returns keys, signatures, source text or identifiers; never re-signs a record.
 * GitHub's replacement secret still needs separate hosted verification. */
function annalsCheckSigningRotation(nonce,id){
  return annalsUiCall_(nonce,function(){
    var f=annalsFolder_(id),saved=annalsRead_(f,'approval-private.json'),p=annalsProps_();
    if(!saved||!saved.entry||!saved.receipt||!saved.publication)throw new Error('Existing signed private evidence required');
    var key=p.getProperty('ANNALS_APPROVAL_KEY')||'',publishKey=p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'';
    if(key.length<32||publishKey.length<32||key===publishKey)throw new Error('Independent signing configuration required');
    var receipt=Object.assign({},saved.receipt);delete receipt.signature;
    var fresh=Object.assign({},receipt,{signature:annalsHex_(Utilities.computeHmacSha256Signature(
      AnnalsProduction.serial({entry:saved.entry,receipt:receipt}),key,Utilities.Charset.UTF_8))});
    var proof=Object.assign({},saved.publication);delete proof.signature;
    var expected=annalsHex_(Utilities.computeHmacSha256Signature(
      AnnalsProduction.serial({entry:saved.entry,approval:proof}),publishKey,Utilities.Charset.UTF_8));
    return {separateKeys:true,newPrivateSignatureValid:annalsPrivateReceiptValid_(saved.entry,fresh),
      oldPrivateSignatureRejected:!annalsPrivateReceiptValid_(saved.entry,saved.receipt),
      oldPublicSignatureRejected:expected!==saved.publication.signature,
      githubSecretConsistencyVerified:false,publishesAnything:false};
  });
}
/** Called only while the normal intake lock is already held. One paid attempt
 * uses the EXISTING ten-cent reservation and twelve-thousand-character bound. */
function annalsPrepareRuleDraftCore_(id){
  var p=annalsProps_(),f=annalsFolder_(id),source=annalsRead_(f,'source-private.json');
  if(!source||!source.senderAuthenticated||!source.aiConsentActive||!annalsConsentActive_(source.source.sender)||
    annalsFile_(f,'quarantine-private.json')||annalsFile_(f,'ai-attempt-private.json')||
    p.getProperty('ANNALS_AI_ENABLED')!=='true'||!p.getProperty('ANNALS_OPENAI_API_KEY')||!annalsPublisherDispatchReady_()||
    source.source.sourceTruncated||source.source.subjectTruncated||source.source.excerptTruncated||
    AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt)!=='col_proposal'||
    !annalsSafeTextForAutoAi_(annalsAiSourceText_(source)))return false;
  var snapshot=annalsRead_(f,'col-official-rules-snapshot-private.json');
  if(!snapshot){
    var fetched=UrlFetchApp.fetch('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/docs/celebration-of-life-rules.md',
      {muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(fetched.getResponseCode()!==200)return false;
    var rules=fetched.getContentText();if(rules.length>30000||rules.indexOf('# STAMMTISCH')!==0)return false;
    snapshot={text:rules,sha256:annalsHash_(rules),capturedAt:new Date().toISOString()};
    annalsWriteOnce_(f,'col-official-rules-snapshot-private.json',snapshot);
  }
  var request=AnnalsGovernance.request(annalsAiSourceText_(source),snapshot.text,AnnalsProduction.MODEL);
  var ledger=AnnalsProduction.reserve(JSON.parse(p.getProperty('ANNALS_BUDGET_LEDGER')||'null'),Utilities.formatDate(new Date(),'America/Toronto','yyyy-MM'));
  p.setProperty('ANNALS_BUDGET_LEDGER',JSON.stringify(ledger));
  annalsWriteOnce_(f,'ai-attempt-private.json',{state:'attempt_reserved',reservedCents:10,at:new Date().toISOString(),model:AnnalsProduction.MODEL,purpose:'private_col_proposal'});
  var response;
  try{response=UrlFetchApp.fetch('https://api.openai.com/v1/responses',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+p.getProperty('ANNALS_OPENAI_API_KEY')},payload:JSON.stringify(request),muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});}
  catch(ignored){annalsRecordAttemptOutcome_(f,'provider_result_unknown',0);return false;}
  var status,text;
  try{
    status=response.getResponseCode();
    if(status!==200){annalsRecordAttemptOutcome_(f,'provider_http_failure',status);return false;}
    text=response.getContentText();
  }catch(ignored){annalsRecordAttemptOutcome_(f,'provider_result_unknown',0);return false;}
  if(typeof text!=='string'||text.length>100000){annalsRecordAttemptOutcome_(f,'invalid_response',200);return false;}
  annalsWriteOnce_(f,'ai-response-private.json',{responseText:text,httpStatus:200,purpose:'private_col_proposal'});
  try{
    var assessment=AnnalsGovernance.response(JSON.parse(text));
    var packet=AnnalsGovernance.packet(source,snapshot.text,assessment.heading,assessment.replacement,assessment.recommendation);
    ['scores','selections','awards','drafting','annualRollover','notifications'].forEach(function(k){packet.effects[k]=assessment[k];});
    packet.unresolved.push(assessment.effectiveDate,assessment.contradictions);
    packet.sourceId=id;packet.officialRulesDigest=snapshot.sha256;packet.preparedAt=new Date().toISOString();packet.aiSuggestionsUnverified=true;
    var digest=annalsHash_(AnnalsProduction.serial(packet));
    annalsWriteOnce_(f,'col-proposal-'+digest+'-private.json',packet);
    annalsSavePrivate_(f,'col-proposal-private.json',packet);
    return true;
  }catch(ignored){annalsRecordAttemptOutcome_(f,'invalid_response',200);return false;}
}
function annalsPrepareRuleProposal(nonce,id,heading,replacement,recommendation) {
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var f=annalsFolder_(id),source=annalsRead_(f,'source-private.json');
    if(!source || !source.senderAuthenticated || annalsFile_(f,'quarantine-private.json') ||
      AnnalsAuto.protectedRoute(source.source.subject,source.source.excerpt)!=='col_proposal') throw new Error('Authenticated rule proposal required');
    var snapshot=annalsRead_(f,'col-official-rules-snapshot-private.json');
    if(!snapshot){
      var response=UrlFetchApp.fetch('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/docs/celebration-of-life-rules.md',
        {muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
      if(response.getResponseCode()!==200)throw new Error('Official rules unavailable; no proposal changed');
      var rules=response.getContentText();
      if(rules.length>30000||rules.indexOf('# STAMMTISCH')!==0)throw new Error('Unexpected official rules');
      snapshot={text:rules,sha256:annalsHash_(rules),capturedAt:new Date().toISOString()};
      annalsWriteOnce_(f,'col-official-rules-snapshot-private.json',snapshot);
    }
    var packet=AnnalsGovernance.packet(source,snapshot.text,heading,replacement,recommendation);
    packet.sourceId=id;packet.officialRulesDigest=snapshot.sha256;packet.preparedAt=new Date().toISOString();
    // Preserve every review version, including original unadopted suggestions.
    var digest=annalsHash_(AnnalsProduction.serial(packet));
    if(!annalsFile_(f,'col-proposal-'+digest+'-private.json'))annalsWriteOnce_(f,'col-proposal-'+digest+'-private.json',packet);
    annalsSavePrivate_(f,'col-proposal-private.json',packet);
    return packet;
  });});
}
function annalsHistoryLedger_(){return annalsRead_(annalsRoot_(),'history-ledger-private.json')||AnnalsHistory.empty();}
function annalsSaveHistoryClaim(nonce,id,raw,operation,reason){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var f=annalsFolder_(id),source=annalsRead_(f,'source-private.json');
    if(!source || annalsFile_(f,'quarantine-private.json') || operation!=='withdraw'&&(!annalsConsentActive_(source.source.sender)||
      !annalsStandingPublicationActive_(source.source.sender,source.source.receivedAt)))throw new Error('Current and receipt-time consent required');
    if(operation!=='withdraw')annalsOrdinarySourceGate_(source);
    if(['add','correct','withdraw'].indexOf(operation)<0||typeof reason!=='string'||reason.trim().length<10||reason.length>1000)throw new Error('Explicit private evidence required');
    var ledger=annalsHistoryLedger_(),next,at=new Date().toISOString();
    if(operation==='withdraw')next=AnnalsHistory.withdraw(ledger,id,at,reason);
    else{
      raw=Object.assign({},raw,{sourceId:id});
      raw.id=annalsHash_(AnnalsProduction.serial(raw));
      var claim=AnnalsHistory.claim(source,raw),decision=AnnalsHistory.propose(ledger,claim);
      if(operation==='add'&&decision.kind==='dispute'){
        var dispute={state:'held_for_reconciliation',claim:claim,affected:decision.affected,at:at};
        if(!annalsFile_(f,'history-dispute-'+claim.id+'-private.json'))annalsWriteOnce_(f,'history-dispute-'+claim.id+'-private.json',dispute);
        return {held:true,reason:'conflicting_recollections',chapters:AnnalsHistory.chapters(ledger)};
      }
      next=operation==='correct'?AnnalsHistory.resolve(ledger,claim.factKey,claim,at,reason):AnnalsHistory.apply(ledger,claim,true,at,reason).ledger;
    }
    var review={expectedLedgerDigest:annalsHash_(AnnalsProduction.serial(ledger)),ledger:next,
      chapters:AnnalsHistory.chapters(next),savedAt:at,reason:reason,operation:operation};
    review.hash=annalsHash_(AnnalsProduction.serial(review));
    annalsSavePrivate_(f,'history-review-private.json',review);
    return {hash:review.hash,chapters:review.chapters,operation:operation};
  });});
}
function annalsApproveHistoryRevision(nonce,id,expectedHash,confirmed){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var p=annalsProps_(),f=annalsFolder_(id),review=annalsRead_(f,'history-review-private.json'),source=annalsRead_(f,'source-private.json');
    if(confirmed!==true||!review||review.hash!==expectedHash||!source||annalsFile_(f,'quarantine-private.json')||
      review.operation!=='withdraw'&&!annalsStandingPublicationActive_(source.source.sender,source.source.receivedAt)||
      review.expectedLedgerDigest!==annalsHash_(AnnalsProduction.serial(annalsHistoryLedger_())))throw new Error('History review changed or permission revoked');
    var unsignedReview=Object.assign({},review);delete unsignedReview.hash;
    if(annalsHash_(AnnalsProduction.serial(unsignedReview))!==expectedHash)throw new Error('History preview altered after review');
    review.ledger.claims.filter(function(c){return c.active;}).forEach(function(c){
      var original=annalsRead_(annalsFolder_(c.sourceId),'source-private.json');
      if(!original||!annalsConsentActive_(original.source.sender)||!annalsStandingPublicationActive_(original.source.sender,original.source.receivedAt))throw new Error('Active history claim permission revoked');
      if(AnnalsProduction.serial(AnnalsHistory.claim(original,c))!==AnnalsProduction.serial(c))throw new Error('History claim no longer matches immutable original');
    });
    if(review.operation!=='withdraw')annalsOrdinarySourceGate_(source);
    if(p.getProperty('ANNALS_HISTORY_PUBLICATION_ENABLED')!=='true'||!Number.isFinite(Date.parse(p.getProperty('ANNALS_SIGNING_REMEDIATED_AT'))))throw new Error('History publication awaits signing remediation and hosted qualification');
    var key=p.getProperty('ANNALS_HISTORY_SIGNING_KEY')||'';
    if(key.length<32||key===p.getProperty('ANNALS_APPROVAL_KEY')||key===p.getProperty('ANNALS_PUBLISH_SIGNING_KEY'))throw new Error('Distinct history authority required');
    var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
    if(pending&&pending.state!=='verified_live')throw new Error('Prior history dispatch must be reconciled; never automatically retry');
    var current=annalsRead_(root,'history-published-private.json')||{schemaVersion:1,revision:0,chapters:[],updatedAt:''};
    // An exact public read protects against a stale private snapshot or concurrent update.
    var fetched=UrlFetchApp.fetch('https://stammtischbrewery.com/data/club-history.json',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(fetched.getResponseCode()!==200||annalsHash_(AnnalsProduction.serial(JSON.parse(fetched.getContentText())))!==annalsHash_(AnnalsProduction.serial(current)))throw new Error('Published history reconciliation required');
    var document={schemaVersion:1,revision:current.revision+1,chapters:review.chapters,updatedAt:new Date().toISOString()};
    var proof={mode:'source-grounded-history-revision-v1',previousDigest:annalsHash_(AnnalsProduction.serial(current)),
      contentSha256:annalsHash_(AnnalsProduction.serial(document)),issuedAt:document.updatedAt};
    proof.signature=annalsHex_(Utilities.computeHmacSha256Signature(AnnalsProduction.serial({document:document,approval:proof}),key,Utilities.Charset.UTF_8));
    if(AnnalsProduction.serial({document:document,approval:proof}).length>45000)throw new Error('History update exceeds bounded publication size');
    var record={sourceId:id,review:review,document:document,approval:proof,state:'reserved_no_retry'};
    annalsWriteOnce_(root,'history-revision-'+document.revision+'-private.json',record);
    annalsSavePrivate_(root,'history-pending-private.json',record);
    var accepted=annalsDispatchEvent_(f,'annals-history-revision',{document:document,approval:proof},'history-dispatch-'+document.revision+'-private.json');
    record.state=accepted?'dispatch_accepted':'uncertain_or_rejected_no_retry';
    annalsSavePrivate_(root,'history-pending-private.json',record);
    return {dispatchAccepted:accepted,published:false};
  });});
}
function annalsReconcileHistory(nonce){
  return annalsUiCall_(nonce,function(){return annalsLocked_(function(){
    var root=annalsRoot_(),pending=annalsRead_(root,'history-pending-private.json');
    if(!pending||pending.state!=='dispatch_accepted')return {verified:false,retryAllowed:false};
    var response=UrlFetchApp.fetch('https://stammtischbrewery.com/data/club-history.json',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    var html=UrlFetchApp.fetch('https://stammtischbrewery.com/history.html',{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
    if(response.getResponseCode()!==200||html.getResponseCode()!==200||
      annalsHash_(AnnalsProduction.serial(JSON.parse(response.getContentText())))!==pending.approval.contentSha256||
      annalsHash_(html.getContentText())!==annalsHash_(AnnalsPublicDisplay.historyPage(pending.document)+'\n'))return {verified:false,retryAllowed:false};
    annalsSavePrivate_(root,'history-ledger-private.json',pending.review.ledger);
    annalsSavePrivate_(root,'history-published-private.json',pending.document);
    var name='history-live-'+pending.document.revision+'-private.json',existing=annalsRead_(root,name);
    if(existing){
      if(existing.digest!==pending.approval.contentSha256||!Number.isFinite(Date.parse(existing.verifiedAt)))throw new Error('Conflicting history verification evidence');
    }else annalsWriteOnce_(root,name,{verifiedAt:new Date().toISOString(),digest:pending.approval.contentSha256});
    // Preserve the pending attempt as evidence instead of deleting or replaying it.
    annalsSavePrivate_(root,'history-pending-private.json',Object.assign({},pending,{state:'verified_live'}));
    return {verified:true,revision:pending.document.revision};
  });});
}

/** Owner-only, non-publishing proof check. No properties, Drive records, gates,
 * credentials or histories are changed. ZIP commitment is bound to GitHub's
 * artifact digest before parsing; keys and raw HMACs never leave this runtime. */
function annalsCheckGithubSigningConsistency(nonce,challenge,artifactId,zipBase64,diagnostic){
  return annalsCheckGithubSigningConsistencyFor_(nonce,challenge,artifactId,zipBase64,false,diagnostic);
}

/** Same bounded proof for the distinct Club History authority. */
function annalsCheckGithubHistorySigningConsistency(nonce,challenge,artifactId,zipBase64,diagnostic){
  return annalsCheckGithubSigningConsistencyFor_(nonce,challenge,artifactId,zipBase64,true,diagnostic);
}

function annalsCheckGithubSigningConsistencyFor_(nonce,challenge,artifactId,zipBase64,history,diagnostic){
  return annalsUiCall_(nonce,function(){
    var config=history?{
      artifactPrefix:'history-signing-consistency',
      workflow:'.github/workflows/annals-history-signing-consistency.yml',
      workflowHash:'329481ebec13381aac81b9e633810bc461c222ce1da41fff7ee91fe738923f58',
      keyProperty:'ANNALS_HISTORY_SIGNING_KEY',
      steps:['Compute non-publishing History key commitment','Retain bounded History challenge receipt']
    }:{
      artifactPrefix:'signing-consistency',
      workflow:'.github/workflows/annals-signing-consistency.yml',
      workflowHash:'07568cb8f9eb3cf845c4aa6e1efa401faaeaf1bb5feccb61de0b75ebe002ce47',
      keyProperty:'ANNALS_PUBLISH_SIGNING_KEY',
      steps:['Compute non-publishing key commitment','Retain bounded challenge receipt']
    };
    // An optional server-local collector reports only fixed stages and HTTP codes.
    // It cannot alter validation, credentials, network destinations or return values.
    function stage(name){if(diagnostic)diagnostic.stage=name;}
    if(diagnostic){diagnostic.stage='input';diagnostic.http={};}
    if(!/^[a-f0-9]{64}$/.test(challenge)||!/^\d{1,20}$/.test(artifactId)||typeof zipBase64!=='string'||zipBase64.length>90000||! /^[A-Za-z0-9+/]+={0,2}$/.test(zipBase64))throw new Error('Invalid bounded challenge input');
    var api='https://api.github.com/repos/justinpfisher/Stammtisch';
    function get(url){
      var label=url.indexOf('/actions/artifacts/')>=0?'artifact':url.indexOf('/jobs?')>=0?'jobs':url.indexOf('/actions/runs/')>=0?'run':url.indexOf('/.github/workflows/')>=0?'workflow_source':'verifier_source';
      stage(label+'_http');
      var requestHeaders={Accept:'application/vnd.github+json'};
      // Reuse the existing repository credential only for this repository's API.
      // Raw source reads stay unauthenticated; redirects never carry credentials.
      if(url.indexOf(api+'/')===0){
        var token=annalsProps_().getProperty('ANNALS_GITHUB_TOKEN');
        if(!token)throw new Error('Existing repository verification credential required');
        requestHeaders.Authorization='Bearer '+token;
        requestHeaders['X-GitHub-Api-Version']='2022-11-28';
      }
      var response=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:requestHeaders}),code=response.getResponseCode();
      if(diagnostic)diagnostic.http[label]=Number.isInteger(code)&&code>=100&&code<=599?code:null;
      if(code!==200){
        // Fixed classifications only: never expose response bodies or arbitrary headers.
        if(diagnostic){
          var headers=response.getAllHeaders(),remaining=null;
          Object.keys(headers).forEach(function(name){if(name.toLowerCase()==='x-ratelimit-remaining'&&/^\d{1,6}$/.test(String(headers[name])))remaining=Number(headers[name]);});
          diagnostic.failure=remaining===0?'github_rate_limit':'unclassified_http';
          diagnostic.rateLimitRemaining=remaining;
        }
        throw new Error('Public verification evidence unavailable');
      }
      stage(label+'_body');var text=response.getContentText();if(text.length>200000)throw new Error('Verification evidence exceeds bound');return text;
    }
    var artifact=JSON.parse(get(api+'/actions/artifacts/'+artifactId)),bytes=Utilities.base64Decode(zipBase64);
    stage('artifact_validation');
    if(bytes.length>65536||String(artifact.id)!==artifactId||artifact.expired!==false||artifact.size_in_bytes!==bytes.length||artifact.digest!=='sha256:'+annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)))throw new Error('Artifact byte identity failed');
    var identity=new RegExp('^'+config.artifactPrefix+'-(\\d{1,20})-(\\d{1,5})$').exec(artifact.name||'');
    if(!identity||!artifact.workflow_run||String(artifact.workflow_run.id)!==identity[1]||! /^[a-f0-9]{40}$/.test(artifact.workflow_run.head_sha||''))throw new Error('Invalid artifact producer');
    var runId=identity[1],attempt=identity[2],headSha=artifact.workflow_run.head_sha;
    var run=JSON.parse(get(api+'/actions/runs/'+runId+'/attempts/'+attempt));
    stage('run_validation');
    if(!Number.isFinite(Date.parse(run.run_started_at))||!Number.isFinite(Date.parse(run.updated_at))||String(run.id)!==runId||String(run.run_attempt)!==attempt||run.event!=='workflow_dispatch'||[config.workflow,config.workflow+'@main'].indexOf(run.path)<0||run.head_branch!=='main'||run.head_sha!==headSha||!run.repository||run.repository.full_name!=='justinpfisher/Stammtisch'||run.status!=='completed'||run.conclusion!=='success')throw new Error('Hosted run identity failed');
    var jobs=JSON.parse(get(api+'/actions/runs/'+runId+'/attempts/'+attempt+'/jobs?per_page=100'));
    stage('jobs_validation');
    if(jobs.total_count!==1||!Array.isArray(jobs.jobs)||jobs.jobs.length!==1)throw new Error('Unexpected challenge jobs');
    var job=jobs.jobs[0];
    if(String(job.run_id)!==runId||String(job.run_attempt)!==attempt||job.head_sha!==headSha||job.name!=='challenge'||job.status!=='completed'||job.conclusion!=='success'||!Number.isFinite(Date.parse(job.started_at))||!Number.isFinite(Date.parse(job.completed_at)))throw new Error('Incomplete challenge job');
    config.steps.forEach(function(name){var steps=(job.steps||[]).filter(function(step){return step.name===name;});if(steps.length!==1||steps[0].status!=='completed'||steps[0].conclusion!=='success')throw new Error('Incomplete challenge step');});
    var raw='https://raw.githubusercontent.com/justinpfisher/Stammtisch/'+headSha+'/';
    if(annalsHash_(get(raw+config.workflow).replace(/\r\n/g,'\n'))!==config.workflowHash||annalsHash_(get(raw+'scripts/annals/signing-consistency.mjs').replace(/\r\n/g,'\n'))!=='9f79b645a4b3d18a4427db32428fe19768329d5c47685c0c01d8754253769a6b')throw new Error('Unreviewed challenge implementation');
    stage('archive_parse');var files=Utilities.unzip(Utilities.newBlob(bytes,'application/zip'));
    if(files.length!==1||files[0].getName()!=='signing-consistency.json'||files[0].getBytes().length>4096)throw new Error('Unexpected receipt archive');
    stage('receipt_validation');var proof=JSON.parse(files[0].getDataAsString('UTF-8'));
    if(Object.keys(proof).sort().join(',')!=='attempt,challenge,commitment,createdAt,headSha,kind,repository,runId'||proof.kind!=='annals-key-consistency-v1'||proof.repository!=='justinpfisher/Stammtisch'||proof.challenge!==challenge||!/^\d{1,20}$/.test(proof.runId)||!/^\d{1,5}$/.test(proof.attempt)||! /^[a-f0-9]{40}$/.test(proof.headSha)||! /^[a-f0-9]{64}$/.test(proof.commitment)||!Number.isFinite(Date.parse(proof.createdAt)))throw new Error('Invalid challenge receipt');
    stage('freshness');var now=Date.now(),created=Date.parse(proof.createdAt);
    if(created<Date.parse(job.started_at)||created>Date.parse(job.completed_at)||created>now||now-created>15*60*1000||Date.parse(run.run_started_at)>created||Date.parse(run.updated_at)<created||artifact.name!==config.artifactPrefix+'-'+proof.runId+'-'+proof.attempt||!artifact.workflow_run||String(artifact.workflow_run.id)!==proof.runId||artifact.workflow_run.head_sha!==proof.headSha)throw new Error('Stale or unrelated artifact');
    stage('key_configuration');var p=annalsProps_(),key=p.getProperty(config.keyProperty)||'',privateKeys=[p.getProperty('ANNALS_APPROVAL_KEY')||''];
    if(history)privateKeys.push(p.getProperty('ANNALS_PUBLISH_SIGNING_KEY')||'');
    if(key.length<32||privateKeys.some(function(value){return value.length<32||key===value;}))throw new Error('Independent signing configuration required');
    var message='ANNALS NON-PUBLISHING KEY CONSISTENCY V1\n'+JSON.stringify([proof.repository,proof.challenge,proof.runId,proof.attempt,proof.headSha,proof.createdAt]);
    var mac=annalsHex_(Utilities.computeHmacSha256Signature(message,key,Utilities.Charset.UTF_8));
    var expected=annalsHash_(mac),difference=0;for(var i=0;i<64;i++)difference|=expected.charCodeAt(i)^proof.commitment.charCodeAt(i);
    stage('complete');var result={publishesAnything:false,changesCredentials:false,changesReleaseGates:false,separateKeys:true,githubSecretConsistencyVerified:difference===0,verifiedAt:new Date().toISOString(),workflowRunId:proof.runId,workflowRunAttempt:proof.attempt,implementationCommit:proof.headSha};
    if(history)result.signingAuthority='history';return result;
  });
}

/** Records independently checked security evidence, never hosted acceptance.
 * This initial-remediation path deliberately requires the current archive empty
 * and every publication capability closed. Historical missing receipts stay missing. */
function annalsRecordSigningQualification(nonce,id,challenge,artifactId,zipBase64,reconciliationConfirmed){
  return annalsUiCall_(nonce,function(){
    if(reconciliationConfirmed!==true)throw new Error('Actual outstanding-record reconciliation must be confirmed');
    var cross=annalsCheckGithubSigningConsistency(nonce,challenge,artifactId,zipBase64),rotation=annalsCheckSigningRotation(nonce,id);
    if(!cross.githubSecretConsistencyVerified||!rotation.separateKeys||!rotation.oldPublicSignatureRejected||!rotation.oldPrivateSignatureRejected||!rotation.newPrivateSignatureValid)throw new Error('Genuine current signing qualification required');
    return annalsLocked_(function(){
      var p=annalsProps_(),root=annalsRoot_();
      ['ANNALS_AUTO_PUBLICATION_ENABLED','ANNALS_AUTO_MEDIA_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED','ANNALS_RULES_V2_ENABLED','ANNALS_RULES_V3_ENABLED'].forEach(function(k){if(p.getProperty(k)==='true')throw new Error('Publication must remain closed during initial qualification');});
      ['col-release-pending-private.json','history-pending-private.json'].forEach(function(name){var pending=annalsRead_(root,name);if(pending&&['verified_live','verified_cancelled'].indexOf(pending.state)<0)throw new Error('Pending operation requires reconciliation');});
      function read(url){var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:{'Cache-Control':'no-cache'}});if(response.getResponseCode()!==200)throw new Error('Current public archive unavailable');var text=response.getContentText();if(!text||text.length>1000000)throw new Error('Bounded public evidence required');return text;}
      var suffix='?signing-observation='+Date.now(),committed=read('https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json'+suffix),live=read('https://stammtischbrewery.com/data/annals-approved.json'+suffix),archive=JSON.parse(live),page=read('https://stammtischbrewery.com/annals.html'+suffix);
      if(committed!==live||archive.schemaVersion!==1||!Array.isArray(archive.entries)||!Array.isArray(archive.approvals)||archive.entries.length||archive.approvals.length||page.indexOf('The Annals of Stammtisch')<0||page.indexOf('</html>')<0||/<article\b[^>]*\bid=/.test(page))throw new Error('Initial empty-archive reconciliation failed');
      var name='signing-qualification-'+cross.workflowRunId+'-'+cross.workflowRunAttempt+'-private.json';
      if(annalsFile_(root,name)||p.getProperty('ANNALS_SIGNING_REMEDIATED_AT'))throw new Error('Prior security qualification preserved; no overwrite');
      var at=new Date().toISOString(),record={schemaVersion:1,state:'verified_signing_only',verifiedAt:at,crossPlatform:cross,challengeArtifactId:artifactId,challengeArchiveSha256:annalsHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Utilities.base64Decode(zipBase64))),historicalEvidence:{sourceId:id,approvalDigest:annalsHash_(AnnalsProduction.serial(annalsRead_(annalsFolder_(id),'approval-private.json')))},reconciliationMethod:'owner-authenticated-operator-confirmed-existing-journals-and-current-empty-hosted-archive',oldPrivateSignatureRejected:true,oldPublicSignatureRejected:true,newPrivateSignatureValid:true,separateKeys:true,outstandingDispatchReconciliationConfirmed:true,historicalWithdrawalReceiptGapPreserved:true,archiveSha256:annalsHash_(live),pageSha256:annalsHash_(page),publicationActivated:false};
      annalsWriteOnce_(root,name,record);
      p.setProperty('ANNALS_SIGNING_QUALIFICATION_RECORD',name);
      p.setProperty('ANNALS_SIGNING_REMEDIATED_AT',at);
      return {securityQualificationRecorded:true,verifiedAt:at,githubSecretConsistencyVerified:true,historicalWithdrawalReceiptGapPreserved:true,publicationActivated:false};
    });
  });
}

/** Owner-only observation of recorder preconditions. No writes, dispatches,
 * credentials, exception text, source identifiers or fetched bodies are returned.
 * Storage creation permissions are deliberately NOT tested by this read-only path. */
function annalsDiagnoseSigningQualification(nonce,id,challenge,artifactId,zipBase64){
  return annalsUiCall_(nonce,function(){
    var result={readOnly:true,publicationActivated:false,writePermissionTested:false,
      crossCheck:'unavailable',rotationCheck:'unavailable',lock:'unavailable',privateRoot:'unavailable',
      gates:{},pending:{},priorMarkerPresent:null,priorPointerPresent:null,priorRecordPresent:null,
      historicalEvidencePresent:null,historicalEvidenceDigestComputable:null,http:{},
      archiveBytesEqual:false,archiveShapeValid:false,archiveEmpty:false,pageRecognized:false,pageEmpty:false};
    var cross=null,crossEvidence={stage:'unavailable',http:{}};result.crossEvidence=crossEvidence;
    try{cross=annalsCheckGithubSigningConsistency(nonce,challenge,artifactId,zipBase64,crossEvidence);
      result.crossCheck=cross.githubSecretConsistencyVerified===true?'verified':'mismatch';
    }catch(held){/* Safe stage only; exceptions can contain private service details. */}
    try{var rotation=annalsCheckSigningRotation(nonce,id);
      result.rotation={separateKeys:rotation.separateKeys===true,oldPrivateSignatureRejected:rotation.oldPrivateSignatureRejected===true,
        oldPublicSignatureRejected:rotation.oldPublicSignatureRejected===true,newPrivateSignatureValid:rotation.newPrivateSignatureValid===true};
      result.rotationCheck=Object.keys(result.rotation).every(function(k){return result.rotation[k];})?'verified':'mismatch';
    }catch(held){}
    try{annalsLocked_(function(){
      result.lock='acquired';
      var p;try{p=annalsProps_();
        ['ANNALS_AUTO_PUBLICATION_ENABLED','ANNALS_AUTO_MEDIA_ENABLED','ANNALS_HISTORY_PUBLICATION_ENABLED','ANNALS_RULES_V2_ENABLED','ANNALS_RULES_V3_ENABLED'].forEach(function(k){result.gates[k]=p.getProperty(k)!=='true';});
        result.priorMarkerPresent=!!p.getProperty('ANNALS_SIGNING_REMEDIATED_AT');
        result.priorPointerPresent=!!p.getProperty('ANNALS_SIGNING_QUALIFICATION_RECORD');
      }catch(held){result.properties='unavailable';}
      var root;try{root=annalsRoot_();result.privateRoot='verified_owner_only';}catch(held){return;}
      [['col','col-release-pending-private.json'],['history','history-pending-private.json']].forEach(function(pair){
        try{var pending=annalsRead_(root,pair[1]);result.pending[pair[0]]=!pending?'absent':['verified_live','verified_cancelled'].indexOf(pending.state)>=0?'terminal':'unresolved';}
        catch(held){result.pending[pair[0]]='unavailable';}
      });
      if(cross&&/^\d{1,20}$/.test(cross.workflowRunId||'')&&/^\d{1,5}$/.test(cross.workflowRunAttempt||'')){
        try{result.priorRecordPresent=!!annalsFile_(root,'signing-qualification-'+cross.workflowRunId+'-'+cross.workflowRunAttempt+'-private.json');}catch(held){}
      }
      try{var saved=annalsRead_(annalsFolder_(id),'approval-private.json');
        result.historicalEvidencePresent=!!(saved&&saved.entry&&saved.receipt&&saved.publication);
        if(result.historicalEvidencePresent)result.historicalEvidenceDigestComputable=typeof annalsHash_(AnnalsProduction.serial(saved))==='string';
      }catch(held){}
    });}catch(held){if(result.lock!=='acquired')result.lock='unavailable';}
    function read(label,url){
      var status={status:'unavailable',httpStatus:null,redirect:false,bounded:false};result.http[label]=status;
      try{var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true,headers:{'Cache-Control':'no-cache'}}),code=response.getResponseCode();
        status.httpStatus=Number.isInteger(code)&&code>=100&&code<=599?code:null;status.redirect=code>=300&&code<400;
        if(code!==200){status.status=status.redirect?'redirect':'http_error';return null;}
        var text=response.getContentText();status.bounded=typeof text==='string'&&text.length>0&&text.length<=1000000;
        if(!status.bounded){status.status='invalid_size';return null;}status.status='ok';return text;
      }catch(held){return null;}
    }
    var suffix='?signing-observation='+Date.now();
    var committed=read('committedArchive','https://raw.githubusercontent.com/justinpfisher/Stammtisch/main/data/annals-approved.json'+suffix);
    var live=read('liveArchive','https://stammtischbrewery.com/data/annals-approved.json'+suffix);
    var page=read('livePage','https://stammtischbrewery.com/annals.html'+suffix);
    result.archiveBytesEqual=committed!==null&&live!==null&&committed===live;
    if(live!==null){try{var archive=JSON.parse(live);result.archiveShapeValid=!!(archive&&archive.schemaVersion===1&&Array.isArray(archive.entries)&&Array.isArray(archive.approvals));
      result.archiveEmpty=result.archiveShapeValid&&archive.entries.length===0&&archive.approvals.length===0;}catch(held){}}
    if(page!==null){result.pageRecognized=page.indexOf('The Annals of Stammtisch')>=0&&page.indexOf('</html>')>=0;result.pageEmpty=result.pageRecognized&&!/<article\b[^>]*\bid=/.test(page);}
    return result;
  });
}
