import {loadOperativeSnapshot} from './col-rules-reader.mjs';
const status=document.querySelector('#version-status'),container=document.querySelector('#version-provisions');
try{
  const query=new URLSearchParams(location.search),id=query.get('version'),hosted=await loadOperativeSnapshot({versionId:id});
  let data;
  if(hosted)data={versions:hosted.versions};
  else{const response=await fetch('data/col-rules-versions.json',{cache:'no-store'});if(!response.ok)throw Error('Unavailable');data=await response.json();}
  const versions=data.versions.filter(version=>version.verified===true&&version.effectiveAt&&Date.parse(version.effectiveAt)<=Date.now()&&(!id||version.id===id));
  const version=versions.at(-1);
  if(!version){status.textContent='This edition is not yet available. The current rules are listed on the Celebration of Life page.';}
  else{
    // Supported amendment classes preserve the baseline preamble exactly.
    document.querySelector('#rules-preamble').hidden=false;
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'long'});
    status.textContent='Rules in effect from '+date.format(new Date(version.effectiveAt))+'.';
    for(const [heading,source] of Object.entries(version.provisions)){
      const section=document.createElement('section'),h=document.createElement('h2'),p=document.createElement('pre');
      h.textContent=heading;p.textContent=source.slice(source.indexOf('\n')+1).trim();section.append(h,p);container.append(section);
    }
  }
}catch{status.textContent='This edition is temporarily unavailable. Read the current rules on the Celebration of Life page.';}
