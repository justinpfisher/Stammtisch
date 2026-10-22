/* Static, source-preserving display of Jerome's authored CoL rules. */
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
export function renderRules(raw){
  const blocks=sections(raw);
  let out='<div class="rules-content jerome-rule-transcript">\n',open=false;
  for(let i=0;i<blocks.length;i++){
    const {heading,text}=blocks[i];
    if(i===0){
      out+='<div class="jerome-rule-preamble"><h3>'+esc(heading)+'</h3><pre class="jerome-verbatim-text">'+esc(text)+'</pre></div>\n';
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
    out+='<pre class="jerome-verbatim-text">'+esc(text)+'</pre>\n';
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
