/* Static, source-preserving presentation of Jerome's Celebration of Life rules. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const HEADINGS=Object.freeze(['CELEBRATION OF LIFE POOL','POINTS','DIAMONDS','STEALS & PROTECTIONS','STEAL','PROTECTION','BIRTHDAY BUFFET','BIRTHDAYS','WINNING','ANNUAL DRAFT','ORDER OF BUSINESS','1. WINNER DECLARED','2. PROTECTIONS','3. STEALS','4. DEVIL’S SHARE','5. JETTISONS','6. DRAFT','ORDER','7. CORONATION OF DIAMONDS']);
const GROUPS=new Set(['POINTS','DIAMONDS','STEALS & PROTECTIONS','BIRTHDAY BUFFET','BIRTHDAYS','WINNING','ANNUAL DRAFT']);
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function sections(raw){
  if(typeof raw!=='string'||raw.length<3000||raw.length>12000)throw Error('Complete authored text required');
  const text=raw.replace(/\r\n/g,'\n');
  if(text.includes('\r')||!text.startsWith(HEADINGS[0]+'\n'))throw Error('Incorrect source');
  const lines=text.split('\n'),positions=HEADINGS.map(h=>{
    const found=lines.flatMap((line,i)=>line===h?[i]:[]);
    if(found.length!==1)throw Error('Original heading missing or repeated: '+h);
    return found[0];
  });
  if(positions.some((n,i)=>i>0&&n<=positions[i-1]))throw Error('Heading order changed');
  return HEADINGS.map((heading,i)=>({heading,text:lines.slice(positions[i]+1,positions[i+1]??lines.length).join('\n')}));
}

// Join email hard-wraps into normal flowing paragraphs; never edit the source text.
function paragraphs(raw){
  if(!raw.trim())return '';
  const blocks=raw.trim().split(/\n[ \t]*\n+/).map(s=>s.trim().replace(/[ \t]*\n[ \t]*/g,' ')).filter(Boolean);
  const combined=[];
  for(const block of blocks){
    if(block.startsWith('(')&&combined.length)combined[combined.length-1]+=' '+block;
    else combined.push(block);
  }
  return combined.map(s=>'<p>'+esc(s)+'</p>').join('\n');
}

function bullets(raw){
  const marks=[...raw.matchAll(/^[ \t]*-[ \t]*$/gm)];
  if(!marks.length)throw Error('Expected original bullet markers');
  let out=paragraphs(raw.slice(0,marks[0].index))+'\n<ul class="jerome-bullet-list">\n';
  for(let i=0;i<marks.length;i++){
    const body=raw.slice(marks[i].index+marks[i][0].length,marks[i+1]?.index??raw.length);
    const inner=paragraphs(body);
    if(!inner)throw Error('Empty original bullet');
    out+='<li>'+inner+'</li>\n';
  }
  return out+'</ul>';
}

function numbered(raw,kind){
  const marks=[...raw.matchAll(/^[ \t]*([1-9]\d*)\.[ \t]*$/gm)];
  if(!marks.length)throw Error('Expected original numbered items');
  let out=paragraphs(raw.slice(0,marks[0].index))+'\n<ol class="jerome-numbered-list">\n';
  for(let i=0;i<marks.length;i++){
    if(Number(marks[i][1])!==i+1)throw Error('Original numbering changed');
    const item=raw.slice(marks[i].index+marks[i][0].length,marks[i+1]?.index??raw.length).trim();
    if(!item)throw Error('Empty numbered item');
    if(kind==='benefits'){
      const pieces=item.split(/\n[ \t]*\n+/).filter(Boolean);
      const title=pieces.shift().trim().replace(/[ \t]*\n[ \t]*/g,' ');
      if(!title||!pieces.length)throw Error('Incomplete original benefit');
      out+='<li><strong class="jerome-list-title">'+esc(title)+'</strong>\n'+paragraphs(pieces.join('\n\n'))+'</li>\n';
    }else{
      out+='<li>'+paragraphs(item)+'</li>\n';
    }
  }
  return out+'</ol>';
}

function body(heading,text){
  if(!text.trim())return '';
  if(heading==='PROTECTION'){
    const phrase='There’s three ways to win Steals and Protections.';
    const at=text.indexOf(phrase);
    if(at<0)throw Error('Original Protection benefit heading missing');
    return bullets(text.slice(0,at))+'\n'+numbered(text.slice(at),'benefits');
  }
  if(heading==='5. JETTISONS'){
    const phrase='If you jettison a 100-year-old';
    const at=text.indexOf(phrase);
    if(at<0)throw Error('Original jettison penalty missing');
    return bullets(text.slice(0,at))+'\n'+paragraphs(text.slice(at));
  }
  if(['STEAL','BIRTHDAY BUFFET','3. STEALS','7. CORONATION OF DIAMONDS'].includes(heading))return bullets(text);
  if(heading==='ORDER OF BUSINESS')return numbered(text,'steps');
  return paragraphs(text);
}

export function renderRules(raw){
  const blocks=sections(raw);
  let out='<div class="rules-content jerome-rule-transcript">\n',open=false;
  for(let i=0;i<blocks.length;i++){
    const {heading,text}=blocks[i],inner=body(heading,text);
    if(i===0){
      out+='<div class="jerome-rule-preamble"><h3>'+esc(heading)+'</h3>\n'+inner+'</div>\n';
      continue;
    }
    if(GROUPS.has(heading)){
      if(open)out+='</div></details>\n';
      out+='<details class="rule-topic"><summary>'+esc(heading)+'<span aria-hidden="true">+</span></summary><div class="rule-body">\n';
      open=true;
    }else{
      if(!open)throw Error('Heading outside section');
      out+='<h4 class="jerome-subheading">'+esc(heading)+'</h4>\n';
    }
    if(inner)out+=inner+'\n';
  }
  return out+'</div></details>\n</div>';
}
export const START='<!-- Jerome verbatim rules start -->',END='<!-- Jerome verbatim rules end -->';
export function replaceRules(page,source){
  const a=page.indexOf(START),b=page.indexOf(END);
  if(a<0||b<=a||page.indexOf(START,a+1)>=0||page.indexOf(END,b+1)>=0)throw Error('One bounded rule area required');
  return page.slice(0,a+START.length)+'\n'+renderRules(source)+'\n'+page.slice(b);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv.length!==3||process.argv[2]!=='--write')throw Error('Usage: node scripts/render-jerome-rules.mjs --write');
  const root=new URL('../',import.meta.url),page=new URL('celebration.html',root);
  const current=readFileSync(page,'utf8');
  const updated=replaceRules(current,readFileSync(new URL('data/col-jerome-rules.txt',root),'utf8'));
  if(current!==updated)writeFileSync(page,updated,'utf8');
}