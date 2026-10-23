/* Recover only an unrelated main-branch race after a signed Annals render.
 * Never rerender, resign, resend a dispatch, rewrite a ledger or force-push.
 * A remote rejection is not assumed to mean that the previous push failed. */
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const publicationPath=p=>['annals.html','data/annals-approved.json','data/annals-editorial-photos.json'].includes(p)||p.startsWith('data/photos/')||p.startsWith('assets/annals/');
// Only these unrelated content changes can be crossed. A changed workflow,
// script, permission policy, signature input or archive always stops recovery.
const unrelated=p=>['data/celebration.json','data/celebration-confirmations.json','index.html','location.html','styles.css'].includes(p);
export function canRecover(written,remoteChanges) {
  return written.length>0&&written.every(publicationPath)&&remoteChanges.length>0&&remoteChanges.every(p=>unrelated(p)&&!written.includes(p));
}
export function pushApprovedCommit({cwd=process.cwd(),gitImpl=null}={}) {
  const git=gitImpl||((...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim());
  if(git('status','--porcelain'))throw Error('Publication recovery requires a clean committed tree');
  const original=git('rev-parse','HEAD'),parent=git('rev-parse','HEAD^');
  if(git('rev-list','--parents','-n','1','HEAD').split(/\s+/).length!==2)throw Error('Single publication commit required');
  const paths=git('diff','--name-only',parent,original).split('\n').filter(Boolean);
  if(!paths.length||!paths.every(publicationPath))throw Error('Unexpected publication paths');
  let candidate=original;
  for(let attempt=0;attempt<3;attempt++) {
    try{git('push','origin',candidate+':refs/heads/main');return {status:'pushed',commit:candidate,attempts:attempt+1};}catch{}
    // Check remote ancestry before doing anything else: an interrupted push
    // may have succeeded. Do not create a second commit for that event.
    git('fetch','--no-tags','origin','refs/heads/main');
    const remote=git('rev-parse','FETCH_HEAD');
    try{git('merge-base','--is-ancestor',candidate,remote);return {status:'already-received',commit:candidate,attempts:attempt+1};}catch{}
    const currentParent=git('rev-parse',candidate+'^');
    try{git('merge-base','--is-ancestor',currentParent,remote);}catch{throw Error('Publication branch ancestry changed');}
    const changed=git('diff','--name-only',currentParent,remote).split('\n').filter(Boolean);
    if(!canRecover(paths,changed)||attempt===2)throw Error('Concurrent publication needs exact-source reconciliation');
    // merge-tree computes a three-way tree without touching the worktree.
    // It may only carry our original exact asset changes onto unrelated main.
    const tree=git('merge-tree','--write-tree',remote,candidate).split('\n')[0];
    if(!/^[a-f0-9]{40}$/.test(tree))throw Error('Publication merge tree unavailable');
    const delta=git('diff','--binary',currentParent,candidate,'--',...paths);
    if(git('diff','--binary',remote,tree,'--',...paths)!==delta)throw Error('Signed publication bytes changed during recovery');
    if(git('diff','--name-only',remote,tree).split('\n').filter(Boolean).some(p=>!paths.includes(p)))throw Error('Unexpected recovery change');
    // Fixed message, no event/source content in command arguments or logs.
    candidate=git('commit-tree',tree,'-p',remote,'-m','Publish approved Annals update after unrelated main update');
  }
  throw Error('Publication recovery exhausted');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const r=pushApprovedCommit();console.log(`Approved publication ${r.status}; attempts ${r.attempts}.`);}
  catch{console.error('Approved publication held; preserve its exact signed request for reconciliation.');process.exitCode=1;}
}
