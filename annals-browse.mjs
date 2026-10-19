/* Lightweight optional filtering of already-public cards; no votes, accounts or analytics. */
const cards=[...document.querySelectorAll('.annal-stream .annal-entry[data-annals-category]')];
const filters=[...document.querySelectorAll('.annal-collections [data-annals-filter]')];
const status=document.getElementById('annal-result-count');
if(cards.length && filters.length && status){
  const allowed=new Set(['all',...cards.map(card=>card.dataset.annalsCategory)]);
  const fromHash=()=>{
    const value=location.hash.startsWith('#collection-')
      ? location.hash.slice('#collection-'.length).replaceAll('-','_'):'all';
    return allowed.has(value)?value:'all';
  };
  const activate=category=>{
    const value=allowed.has(category)?category:'all';
    let shown=0;
    for(const card of cards){
      const visible=value==='all'||card.dataset.annalsCategory===value;
      card.hidden=!visible;
      if(visible)shown++;
    }
    for(const link of filters){
      if(link.dataset.annalsFilter===value)link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
    const plural=shown===1?'entry':'entries';
    status.textContent=shown+' '+plural+' shown · Newest first';
  };
  for(const link of filters){
    link.addEventListener('click',event=>{
      event.preventDefault();
      history.replaceState(null,'',link.getAttribute('href'));
      activate(link.dataset.annalsFilter);
      document.getElementById('annals-entries')?.scrollIntoView({block:'start'});
    });
  }
  window.addEventListener('hashchange',()=>activate(fromHash()));
  activate(fromHash());
}
