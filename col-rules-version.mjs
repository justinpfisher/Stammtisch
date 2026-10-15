const status=document.querySelector('#version-status'),container=document.querySelector('#version-provisions');
try{
  const response=await fetch('data/col-rules-versions.json',{cache:'no-store'});if(!response.ok)throw Error('Unavailable');
  const data=await response.json(),id=new URLSearchParams(location.search).get('version');
  const versions=data.versions.filter(v=>id?v.id===id:v.verified&&Date.parse(v.effectiveAt)<=Date.now());
  const version=versions.at(-1);
  if(!version){status.textContent='This version is awaiting implementation or has not been recorded. The previous operative rules remain in force.';}
  else{
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'long',timeStyle:'short'});
    status.textContent=version.id+' · '+(version.verified?'Verified operative version for its recorded period':'Scheduled; awaiting due-time requalification')+' · Effective '+date.format(new Date(version.effectiveAt))+' (Toronto).';
    for(const [heading,text] of Object.entries(version.provisions)){const section=document.createElement('section'),h=document.createElement('h2'),p=document.createElement('pre');h.textContent=heading;p.textContent=text.slice(text.indexOf('\n')+1).trim();section.append(h,p);container.append(section);}
  }
}catch{status.textContent='The recorded version is temporarily unavailable. Please consult the current official rules.';}
