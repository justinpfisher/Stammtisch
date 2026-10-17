import {loadOperativeSnapshot} from './col-rules-reader.mjs';
const snapshot=await loadOperativeSnapshot();
if(snapshot){
  const current=document.querySelector('main'),parsed=new DOMParser().parseFromString(snapshot.files['col-revisions.html'],'text/html'),next=parsed.querySelector('main');
  if(current&&next){
    for(const executable of next.querySelectorAll('script'))executable.remove();
    const replacement=document.importNode(next,true);
    const reference=replacement.querySelector('a[href="docs/celebration-of-life-rules.md"]');
    if(reference){reference.href='col-rules-version.html?version='+encodeURIComponent(snapshot.version.id)+'&reference=1';reference.textContent='Read the official rules';}
    const article=replacement.querySelector('#'+snapshot.version.id);
    if(article){
      for(const p of article.querySelectorAll('p'))if(p.textContent.startsWith('Status: '))p.textContent='In effect';
      for(const dt of article.querySelectorAll('dt'))if(['Published','Effective'].includes(dt.textContent)){
        const time=document.createElement('time');time.dateTime=snapshot.version.effectiveAt;time.textContent=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'long',timeStyle:'short'}).format(new Date(time.dateTime))+' (Toronto)';dt.nextElementSibling.replaceChildren(time);
      }
    }
    current.replaceWith(replacement);
    if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));target?.scrollIntoView();}
  }
}
