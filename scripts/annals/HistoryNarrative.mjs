import {CHAPTER_IDS,validateBoundHistory} from './BoundHistory.mjs';
import {historyDigest} from './HistoryPublisher.mjs';

/* Staging only. The reviewed digest must come from the existing private
 * evidence and editorial review boundary, never from the model or proposal.
 * This contract does not qualify a source, write a ledger or sign a release. */
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const id=/^[a-z][a-z0-9-]{0,79}$/;
const digest=/^[a-f0-9]{64}$/;
const firstPerson=/\b(?:i|me|my|mine|myself|we|us|our|ours|ourselves)\b/i;
const excerptLead=/\b(?:one|a) member (?:recalls|remembers)\b|\b(?:recalls|remembers):/i;
const excludedCopy=/\b(?:germany\b.{0,45}\b(?:trip|visit|holiday|journey|vacation)|(?:trip|visit|holiday|journey|vacation)\b.{0,45}\bgermany|(?:draft|unadopted|proposed)\s+by[\s-]?laws)\b/i;
const disagreement=/\b(?:accounts differ|accounts disagree|the record remains divided|the record does not settle)\b/i;
const uncertainty=/\b(?:may|might|uncertain|approximately|around|roughly|appears|seems)\b/i;
const words=text=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ')||'';
const phrase=(haystack,needle)=>needle.length>0&&(' '+haystack+' ').includes(' '+needle+' ');

export function narrativeReviewDigest(current,proposal,evidence){
  return historyDigest({previousDigest:historyDigest(current),proposal,evidence});
}

function requireStage(condition){
  if(!condition)throw Error('Unqualified History narrative');
}

function copy(value,limit,names,spans){
  requireStage(typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=limit&&
    !/["“”«»\r\n\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(value)&&
    !firstPerson.test(value)&&!excerptLead.test(value)&&!excludedCopy.test(value));
  const normalized=words(value);
  requireStage(!names.some(name=>phrase(normalized,name))&&!spans.some(span=>phrase(normalized,span)));
  return value;
}

function stageChapter(section,claims,names,spans){
  requireStage(exact(section,['id','heading','paragraphs'])&&CHAPTER_IDS.includes(section.id)&&
    Array.isArray(section.paragraphs)&&section.paragraphs.length>=1&&section.paragraphs.length<=30);
  const chapterClaims=claims.filter(claim=>claim.chapter===section.id);
  const byId=new Map(chapterClaims.map(claim=>[claim.id,claim]));
  const heading=copy(section.heading,80,names,spans);
  let lastOrder=-1, observations=0, poignant=false;
  const passages=section.paragraphs.map((paragraph,index)=>{
    requireStage(Array.isArray(paragraph)&&paragraph.length>=2&&paragraph.length<=12);
    const sources=new Map();
    const sentences=paragraph.map((clause,position)=>{
      requireStage(exact(clause,['kind','text','claims'])&&Array.isArray(clause.claims)&&
        new Set(clause.claims).size===clause.claims.length&&clause.claims.length<=12);
      const text=copy(clause.text,600,names,spans);
      requireStage(/[.!?]$/.test(text));
      if(clause.kind==='observation'){
        requireStage(clause.claims.length===0&&position>0&&position<paragraph.length-1);
        observations++;
        return text;
      }
      requireStage(['record','disagreement'].includes(clause.kind)&&clause.claims.length>0);
      const used=clause.claims.map(claimId=>byId.get(claimId));
      requireStage(used.every(claim=>claim&&claim.status==='eligible'));
      if(clause.kind==='disagreement'){
        const issue=used[0].dispute;
        const variants=chapterClaims.filter(claim=>claim.status==='eligible'&&claim.dispute===issue);
        const meanings=variants.map(claim=>words(claim.variant));
        requireStage(issue&&variants.length>=2&&used.length===variants.length&&
          variants.every(claim=>clause.claims.includes(claim.id))&&disagreement.test(text)&&
          new Set(meanings).size===variants.length&&meanings.every(meaning=>phrase(words(text),meaning)));
      }else requireStage(used.every(claim=>claim.dispute===''));
      if(used.some(claim=>claim.uncertain))requireStage(uncertainty.test(text)||clause.kind==='disagreement');
      const order=Math.min(...used.map(claim=>claim.order));
      requireStage(order>=lastOrder);
      lastOrder=order;
      for(const claim of used){
        poignant ||= claim.poignant;
        const source=claim.publicSource.kind==='annal'&&!claim.portraitAllowed?
          {...claim.publicSource,portrait:null}:claim.publicSource;
        const key=source.kind==='annal'?source.entryId:source.ref;
        requireStage(!sources.has(key)||historyDigest(sources.get(key))===historyDigest(source));
        sources.set(key,source);
      }
      return text;
    });
    requireStage(sources.size>0);
    const text=copy(sentences.join(' '),1500,names,spans);
    return {id:'narrative-'+(index+1),text,sources:[...sources.values()]};
  });
  requireStage(observations<=1&&(!poignant||observations===0));
  return {id:section.id,heading,passages};
}

export function stageHistoryNarrative({current,proposal,evidence,reviewedDigest}){
  try {
    requireStage(exact(proposal,['mode','chapter','sections'])&&Array.isArray(proposal.sections)&&
      exact(evidence,['aliases','claims'])&&Array.isArray(evidence.aliases)&&evidence.aliases.length>0&&
      evidence.aliases.every(name=>typeof name==='string'&&words(name).length>0)&&
      Array.isArray(evidence.claims)&&evidence.claims.length>0);
    requireStage(digest.test(reviewedDigest||'')&&narrativeReviewDigest(current,proposal,evidence)===reviewedDigest);
    const names=evidence.aliases.map(words), claims=evidence.claims;
    const claimIds=new Set();
    for(const claim of claims){
      requireStage(exact(claim,['id','chapter','status','order','dispute','variant','uncertain','poignant','span','publicSource','portraitAllowed'])&&
        id.test(claim.id||'')&&!claimIds.has(claim.id)&&CHAPTER_IDS.includes(claim.chapter)&&
        ['eligible','excluded-origin-trip','excluded-unadopted-bylaws','withdrawn'].includes(claim.status)&&
        Number.isSafeInteger(claim.order)&&claim.order>=0&&typeof claim.dispute==='string'&&
        (!claim.dispute||id.test(claim.dispute))&&typeof claim.variant==='string'&&
        (claim.dispute?words(claim.variant).length>0:claim.variant==='')&&
        typeof claim.uncertain==='boolean'&&typeof claim.poignant==='boolean'&&
        typeof claim.span==='string'&&claim.span.length>=18&&words(claim.span).length>0&&
        typeof claim.portraitAllowed==='boolean'&&claim.publicSource);
      claimIds.add(claim.id);
    }
    const spans=claims.map(claim=>words(claim.span));
    const opening=proposal.mode==='opening';
    if(opening)requireStage(proposal.chapter===null&&proposal.sections.length===CHAPTER_IDS.length&&
      proposal.sections.every((section,i)=>section?.id===CHAPTER_IDS[i]));
    else requireStage(proposal.mode==='revision'&&current.schemaVersion===2&&proposal.sections.length===1&&
      proposal.sections[0]?.id===proposal.chapter&&current.chapters.some(c=>c.id===proposal.chapter));
    const composed=proposal.sections.map(section=>stageChapter(section,claims,names,spans));
    const chapters=opening?composed:current.chapters.map(chapter=>chapter.id===proposal.chapter?composed[0]:chapter);
    validateBoundHistory({schemaVersion:2,revision:current.revision+1,updatedAt:new Date(0).toISOString(),chapters});
    return {status:'staged',chapters};
  }catch{
    return {status:'held',chapters:current.chapters};
  }
}
