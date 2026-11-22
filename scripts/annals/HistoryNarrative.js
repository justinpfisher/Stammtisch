/* Shared pure contract. The caller owns the independent private review boundary.
 * This module never qualifies a source, writes a ledger or signs a release. */
var AnnalsHistoryNarrative=(function(){
'use strict';
const CHAPTER_IDS=['origins','gatherings','assemblies','traditions'];
const MEMBER_ALIASES=Object.freeze(['Justin','Fish','Marc','Matt','Ken','Jamie','Jerome']);
// Retain exact revision 2 examples to verify already authenticated assessments.
const REVISION_TWO_VOICE=Object.freeze({
  assembly:'The cottage had evidently been fit for purpose before it acquired a formal title.',
  solemn:'This part of the evening belongs to the life being remembered.'
});
// Exact Club-authored example from the Brand and Editorial Style Guide.
const VOICE_EXAMPLES=Object.freeze({
  origins:'The beginnings of the Club are to be found, sometime before the pandemic, in the perfectly ordinary circumstance of six friends getting together whenever they could. Both evenings in company and weekends at the cottage are remembered from this early period. The surviving recollections do not permit either to claim precedence.',
  evening:'Once the pleasure of assembling had been established, there remained the less agreeable business of arranging to do it again. In due course the Club set aside the third Friday of each month, at eight o’clock by the Eastern clock, which in winter stands five hours behind Greenwich. This relieved six calendars of the obligation to enter into fresh negotiations on every occasion.',
  observances:'Several of the Club’s observances owe their existence to a suggestion originally advanced for no more solemn purpose than the diversion of the company. The company, finding the suggestion agreeable, would then bestow upon it rather more attention than the occasion strictly warranted. The cottage weekend itself came, in time, to bear the title of Annual Gentlemen’s Assembly.',
  solemn:REVISION_TWO_VOICE.solemn
});
const CONTINUITY_LIMIT=160;
const sentences=text=>text.split(/(?<=[.!?])\s+/);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const id=/^[a-z][a-z0-9-]{0,79}$/;
const hexDigest=/^[a-f0-9]{64}$/;
const firstPerson=/\b(?:i|me|my|mine|myself|we|us|our|ours|ourselves)\b/i;
const excerptLead=/\b(?:one|a) member (?:recalls|remembers)\b|\b(?:recalls|remembers):/i;
const excludedCopy=/\b(?:germany\b.{0,45}\b(?:trip|visit|holiday|journey|vacation)|(?:trip|visit|holiday|journey|vacation|went|travelled|returned)\b.{0,45}\bgermany|(?:draft|unadopted|proposed)\s+by[\s-]?laws)\b/i;
const disagreement=/\b(?:accounts differ|accounts disagree|the record remains divided|the record does not settle)\b/i;
const uncertainty=/\b(?:may|might|uncertain|approximately|around|roughly|appears|seems)\b/i;
const words=text=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ')||'';
const phrase=(haystack,needle)=>needle.length>0&&(' '+haystack+' ').includes(' '+needle+' ');

function narrativeReviewDigest(current,proposal,evidence,historyDigest){
  return historyDigest({previousDigest:historyDigest(current),proposal,evidence});
}

function requireStage(condition){
  if(!condition)throw Error('Unqualified History narrative');
}

function copy(value,limit,names,spans){
  requireStage(typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=limit&&
    !/["“”«»\r\n\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(value)&&
    !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|<[^>]+>|\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/i.test(value)&&!firstPerson.test(value)&&!excerptLead.test(value)&&!excludedCopy.test(value));
  const normalized=words(value);
  requireStage(!names.some(name=>phrase(normalized,name))&&!spans.some(span=>phrase(normalized,span)));
  return value;
}

function generationContext(edition,historyDigest,isSensitive,maxLength){
  const names=MEMBER_ALIASES.map(words), chapterDigests={}, chapterContinuity=[];
  function safe(value,limit){
    try { return !isSensitive(copy(value,limit,names,[])); }
    catch { return false; }
  }
  for(const chapter of edition.chapters){
    if(!CHAPTER_IDS.includes(chapter.id)||!safe(chapter.heading,80))continue;
    // Give the full stylistic example room while preserving each available chapter.
    let prose;
    for(const passage of chapter.passages.slice().reverse()){
      if(!safe(passage.text,1500))continue;
      prose=passage.text.length<=CONTINUITY_LIMIT?passage.text:
        sentences(passage.text).find(sentence=>safe(sentence,CONTINUITY_LIMIT));
      if(prose)break;
    }
    if(!prose)continue;
    chapterContinuity.push({chapter:chapter.id,heading:chapter.heading,prose:prose});
    chapterDigests[chapter.id]=historyDigest(chapter);
  }
  if(!chapterContinuity.length)return null;
  const reference=JSON.stringify({voiceOnly:VOICE_EXAMPLES,chapterContinuity:chapterContinuity});
  return reference.length<=maxLength?{revision:edition.revision,chapterDigests:chapterDigests,reference:reference}:null;
}

function copiesGenerationReference(proposal,packet){
  const sources=Object.values(packet.voiceOnly).concat(packet.chapterContinuity.map(c=>c.prose));
  const phrases=sources.flatMap(source=>sentences(source).flatMap(sentence=>{
    const tokens=words(sentence).split(' ');
    if(tokens.length<5)return [];
    if(tokens.length<=8)return [tokens.join(' ')];
    return tokens.slice(7).map((_,index)=>tokens.slice(index,index+8).join(' '));
  }));
  const passages=proposal.paragraphs.map(paragraph=>paragraph.map(clause=>clause.text).join(' '));
  return passages.concat(proposal.claims.map(claim=>claim.span)).some(text=>{
    const normalized=words(text);
    return phrases.some(referencePhrase=>phrase(normalized,referencePhrase));
  });
}

function matchesVoiceExamples(sample){
  return [VOICE_EXAMPLES,REVISION_TWO_VOICE].some(example=>{
    const keys=Object.keys(example);
    return exact(sample,keys)&&keys.every(key=>sample[key]===example[key]);
  });
}

function bindGeneration(proposal,context,maxLength){
  try{
    if(!proposal||!exact(context,['revision','chapterDigests','reference'])||
      !Number.isSafeInteger(context.revision)||context.revision<1||typeof context.reference!=='string'||
      context.reference.length>maxLength)return null;
    const packet=JSON.parse(context.reference), names=MEMBER_ALIASES.map(words);
    if(!exact(packet,['voiceOnly','chapterContinuity'])||!matchesVoiceExamples(packet.voiceOnly)||
      !Array.isArray(packet.chapterContinuity)||!packet.chapterContinuity.length||
      packet.chapterContinuity.length>CHAPTER_IDS.length)return null;
    const chapters=packet.chapterContinuity.map(sample=>{
      requireStage(exact(sample,['chapter','heading','prose'])&&CHAPTER_IDS.includes(sample.chapter));
      copy(sample.heading,80,names,[]);
      copy(sample.prose,320,names,[]);
      return sample.chapter;
    });
    if(new Set(chapters).size!==chapters.length||!exact(context.chapterDigests,chapters)||
      !chapters.every(id=>typeof context.chapterDigests[id]==='string'&&hexDigest.test(context.chapterDigests[id]))||
      !chapters.includes(proposal.chapter)||copiesGenerationReference(proposal,packet))return null;
    return {revision:context.revision,chapterDigest:context.chapterDigests[proposal.chapter],reference:context.reference};
  }catch{return null;}
}

function stageChapter(section,claims,names,spans,historyDigest){
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
        poignant = poignant || claim.poignant;
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

function stageHistoryNarrative({current,proposal,evidence,reviewedDigest},historyDigest,validate){
  try {
    requireStage(exact(proposal,['mode','chapter','sections'])&&Array.isArray(proposal.sections)&&
      exact(evidence,['aliases','claims'])&&Array.isArray(evidence.aliases)&&evidence.aliases.length>0&&
      evidence.aliases.every(name=>typeof name==='string'&&words(name).length>0)&&
      Array.isArray(evidence.claims)&&evidence.claims.length>0);
    requireStage(hexDigest.test(reviewedDigest||'')&&narrativeReviewDigest(current,proposal,evidence,historyDigest)===reviewedDigest);
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
        (claim.status!=='eligible'||!excludedCopy.test(claim.span))&&
        typeof claim.portraitAllowed==='boolean'&&claim.publicSource);
      claimIds.add(claim.id);
    }
    const spans=claims.map(claim=>words(claim.span));
    const opening=proposal.mode==='opening';
    if(opening)requireStage(proposal.chapter===null&&proposal.sections.length===CHAPTER_IDS.length&&
      proposal.sections.every((section,i)=>section?.id===CHAPTER_IDS[i]));
    else requireStage(proposal.mode==='revision'&&current.schemaVersion===2&&proposal.sections.length===1&&
      proposal.sections[0]?.id===proposal.chapter&&current.chapters.some(c=>c.id===proposal.chapter));
    const composed=proposal.sections.map(section=>stageChapter(section,claims,names,spans,historyDigest));
    const chapters=opening?composed:current.chapters.map(chapter=>chapter.id===proposal.chapter?composed[0]:chapter);
    if(validate)validate({schemaVersion:2,revision:current.revision+1,updatedAt:new Date(0).toISOString(),chapters});
    return {status:'staged',chapters};
  }catch{
    return {status:'held',chapters:current.chapters};
  }
}

// The signed correction may add the first photo to an already public recipe.
// Reconstruct the entire previous Annals entry. No text comparison or model
// annotation can substitute for the exact original source digest.
function rebindPhotoOnlyCorrection(passage,entry,receipt,digest){
  const source=passage.sources[0];
  if(!/^narrative-[a-f0-9]{24}-[1-9][0-9]*$/.test(passage.id)||passage.sources.length!==1||
     source.kind!=='annal'||source.label!=='Supporting Annals entry'||entry?.id!==source.entryId||
     entry.category!=='cocktail'||!entry.photo||entry.photos||receipt?.entryId!==entry.id||
     receipt.mode!==undefined||receipt.consents?.publication!==true||receipt.consents.photoPublication!==true||
     receipt.contentSha256===source.digest||!hexDigest.test(receipt.contentSha256)||
     digest(entry)!==receipt.contentSha256)return passage;
  const {photo,...previous}=entry;
  if(digest(previous)!==source.digest)return passage;
  return {...passage,sources:[{...source,digest:receipt.contentSha256}]};
}

return Object.freeze({MEMBER_ALIASES,generationContext,bindGeneration,
  narrativeReviewDigest,stageHistoryNarrative,rebindPhotoOnlyCorrection});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsHistoryNarrative;
