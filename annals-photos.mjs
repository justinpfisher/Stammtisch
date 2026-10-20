// Public approved derivatives only. No identities, tracking or external service.
export function installViewer(root=document){
  let dialog,previous,links=[],index=0;
  function show(i){
    index=(i+links.length)%links.length;
    const a=links[index],img=a.querySelector('img');
    const caption=a.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
    // The signed original stays available. An independently generated visual
    // treatment is explicitly labelled as editorial, never as source evidence.
    const hasStyle=!!a.dataset.styledSrc,original=dialog.querySelector('[data-original]');
    dialog.querySelector('img').src=hasStyle?a.dataset.styledSrc:a.href;
    dialog.querySelector('img').alt=img.alt;
    dialog.querySelector('p').textContent=(caption||img.alt)+(hasStyle?' · Editorial image treatment.':'')+
      ' — '+(index+1)+' of '+links.length;
    original.href=a.href;original.hidden=!hasStyle;
  }
  root.addEventListener('click',event=>{
    const a=event.target.closest('a[data-photo-view]');if(!a||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(typeof HTMLDialogElement==='undefined')return;
    event.preventDefault();previous=a;
    links=[...a.closest('.annal-gallery,.photos-card').querySelectorAll('a[data-photo-view]')];
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='photo-viewer';dialog.setAttribute('aria-label','Photograph viewer');
      dialog.innerHTML='<div class="photo-viewer-controls"><button class="photo-button" data-prev type="button">Previous</button><button class="photo-button" data-next type="button">Next</button><a class="photo-button" data-original href="" target="_blank" rel="noopener noreferrer" hidden>Original photograph</a><button class="photo-button" data-close type="button">Close</button></div><img alt=""><p aria-live="polite"></p>';
      document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-prev]').onclick=()=>show(index-1);dialog.querySelector('[data-next]').onclick=()=>show(index+1);
      dialog.addEventListener('keydown',e=>{
        if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowLeft'?-1:1));}
        if(e.key==='Tab'){
          const buttons=[...dialog.querySelectorAll('button,a:not([hidden])')],first=buttons[0],last=buttons.at(-1);
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }
      });
      dialog.addEventListener('close',()=>{dialog.querySelector('img').removeAttribute('src');previous?.focus();});
    }
    show(links.indexOf(a));dialog.showModal();dialog.querySelector('[data-close]').focus();
  });
}
// Progressive presentation only; no signed source, caption or alt text changes.
// Missing/invalid transformations leave the approved documentary JPEG intact.
export function styleCocktailPreviews(root=document){
  if(typeof Image==='undefined')return;
  const links=root.querySelectorAll(
    '.annal-entry[data-annals-category="cocktail"] a[data-photo-view],'+
    '.photos-card[data-photos-collection="cocktail"] a[data-photo-view]');
  for(const a of links){
    const original=a.getAttribute('href');
    if(!/^assets\/annals\/(?:annal-[a-f0-9]{24}|[a-f0-9]{64})\.jpg$/.test(original||''))continue;
    const styled=original.slice(0,-4)+'-styled-v1.jpg',probe=new Image();
    probe.onload=()=>{
      if(!a.isConnected||a.getAttribute('href')!==original)return;
      const img=a.querySelector('img');if(!img)return;
      img.removeAttribute('srcset');img.removeAttribute('sizes');
      img.src=styled;
      a.dataset.styledSrc=styled;
      a.dataset.editorialStyle='moody';
    };
    probe.onerror=()=>{}; // no style asset means show the original
    probe.src=styled;
  }
}
const labels={cocktail:'The Cocktail Register',assembly:'Annual Assemblies',club_history:'Club History'};
export async function installIndex(){
  const results=document.querySelector('#photo-results');if(!results)return;
  const more=document.querySelector('#photo-more'),status=document.querySelector('#photo-status'),form=document.querySelector('#photo-filter');
  const fetchJson=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Archive temporarily unavailable');return r.json();};
  const manifest=await fetchJson('data/photos/index.json');
  for(const year of [...new Set(manifest.pages.map(p=>p.year))].sort((a,b)=>b-a)){const option=new Option(String(year),String(year));form.elements.year.add(option);}
  let cursor=0,busy=false,generation=0,count=0,examined=0;
  async function load(reset=false){
    if(busy&&!reset)return;
    if(reset){generation++;cursor=0;count=0;examined=0;results.replaceChildren();}
    const current=generation;busy=true;more.disabled=true;
    const filters=new FormData(form),year=filters.get('year'),collection=filters.get('collection'),month=filters.get('month'),query=String(filters.get('search')).normalize('NFKC').toLocaleLowerCase('en-CA').trim();
    const pages=manifest.pages.filter(p=>(!year||String(p.year)===year)&&(!collection||p.collection===collection));
    const total=pages.reduce((n,p)=>n+p.count,0);
    try{
      // One bounded shard per action, even when search finds no matches.
      if(cursor<pages.length){
        const next=cursor,rows=await fetchJson(pages[next].path);if(current!==generation)return;
        cursor=next+1;examined+=rows.length;
        for(const row of rows){
          const period=row.eventPeriod||row.submittedAt.slice(0,7);
          if(month&&period.slice(5,7)!==month||query&&![row.title,row.text].join(' ').normalize('NFKC').toLocaleLowerCase('en-CA').includes(query))continue;
          const card=document.createElement('article');card.className='photos-card';card.dataset.photosCollection=row.collection;
          const title=document.createElement('h2'),link=document.createElement('a');link.href='annals.html#'+row.entryId;link.textContent=row.title;title.append(link);card.append(title);
          const date=document.createElement('p');date.textContent=(labels[row.collection]||'Annals')+' · '+(row.eventPeriod?'Event: '+row.eventPeriod:'Event date unrecorded')+(row.submittedAt?' · Submitted '+new Intl.DateTimeFormat('en-CA',{dateStyle:'medium',timeZone:'America/Toronto'}).format(new Date(row.submittedAt)):'');card.append(date);
          const gallery=document.createElement('div');gallery.className='photos-grid';
          for(const p of row.photos){const figure=document.createElement('figure'),a=document.createElement('a'),img=document.createElement('img');a.href=p.src;a.dataset.photoView='';const responsive=/^assets\/annals\/[a-f0-9]{64}\.jpg$/.test(p.src)&&Math.max(p.width,p.height)>=800;img.src=responsive?p.src.replace(/\.jpg$/,'-thumb.jpg'):p.src;if(responsive){img.srcset=img.src+' '+Math.round(p.width*400/Math.max(p.width,p.height))+'w, '+p.src+' '+p.width+'w';img.sizes='(max-width: 560px) 90vw, (max-width: 900px) 45vw, 360px';}img.alt=p.alt;img.loading='lazy';img.decoding='async';if(p.width){img.width=p.width;img.height=p.height;}a.append(img);figure.append(a);if(p.caption){const caption=document.createElement('figcaption');caption.textContent=p.caption;figure.append(caption);}gallery.append(figure);}
          card.append(gallery);results.append(card);styleCocktailPreviews(card);count++;
        }
      }
      status.textContent=count+' entries shown. Searched '+examined+' of '+total+' entries in the selected year and collection.'+(cursor<pages.length?' Search incomplete: use Load more to search older entries.':' Search complete.'+(count?'':' No eligible photographs match these filters.'));
      more.hidden=cursor>=pages.length;
    }catch{if(current!==generation)return;status.textContent='The photo archive is temporarily unavailable. Please try again. Search coverage: '+examined+' of '+total+' entries.';more.hidden=false;}
    finally{if(current===generation){busy=false;more.disabled=false;}}
  }
  form.addEventListener('submit',e=>{e.preventDefault();load(true);});more.onclick=()=>load();await load();
}
if(typeof document!=='undefined'){installViewer();styleCocktailPreviews(document);installIndex().catch(()=>{const s=document.querySelector('#photo-status');if(s)s.textContent='The photo archive is temporarily unavailable.';});}
