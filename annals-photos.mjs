// Public approved derivatives only. No identities, tracking or external service.
export function installViewer(root=document){
  let dialog,previous,links=[],index=0;
  function show(i){
    index=(i+links.length)%links.length;
    const a=links[index],img=a.querySelector('img');
    const caption=a.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
    // The signed original stays available. An independently generated visual
    // treatment is explicitly labelled as editorial, never as source evidence.
    const hasStyle=!!a.dataset.editorialSrc,original=dialog.querySelector('[data-original]');
    dialog.querySelector('img').src=hasStyle?a.dataset.editorialSrc:a.href;
    dialog.querySelector('img').alt=hasStyle?a.dataset.editorialAlt||img.alt:img.alt;
    dialog.querySelector('p').textContent=(caption||img.alt)+(hasStyle?' · AI-stylized editorial photograph; setting illustrative.':'')+
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
// Editorial photographs are opt-in by a qualified, source-matched manifest.
// An asset's presence or successful encoding is never evidence of visual quality.
const editorialSource=/^assets\/annals\/(?:annal-[a-f0-9]{24}|[a-f0-9]{64})\.jpg$/;
const sha256=/^[a-f0-9]{64}$/;
let editorialManifestPromise;
export function qualifiedEditorialPhoto(record,source,sourceSha){
  if(!record||!editorialSource.test(source||'')||!sha256.test(sourceSha||''))return null;
  const output=source.slice(0,-4)+'-editorial-v2.jpg';
  if(record.source!==source||record.sourceSha256!==sourceSha||
     record.asset!==output||record.status!=='qualified'||
     record.artDirection!=='moody-atmospheric-v2'||
     record.rightsQualified!==true||record.safetyQualified!==true||
     record.visualQualified!==true||!sha256.test(record.editorialSha256||'')||
     !Number.isInteger(record.width)||!Number.isInteger(record.height)||
     record.width<480||record.height<480||record.width>2560||record.height>2560||
     typeof record.alt!=='string'||record.alt.length<12||record.alt.length>240||
     !record.alt.includes('AI-stylized'))return null;
  return record;
}
function editorialManifest(){
  if(!editorialManifestPromise) editorialManifestPromise=fetch('data/annals-editorial-photos.json',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('No editorial manifest');return r.json();})
    .then(data=>data?.schemaVersion===1&&data.artDirection==='moody-atmospheric-v2'&&
      Array.isArray(data.images)&&data.images.length<=1000?data.images:[])
    .catch(()=>[]);
  return editorialManifestPromise;
}
export async function styleCocktailPreviews(root=document){
  if(typeof Image==='undefined'||typeof fetch!=='function')return;
  const links=[...root.querySelectorAll(
    '.annal-entry[data-annals-category="cocktail"] a[data-photo-view],'+
    '.photos-card[data-photos-collection="cocktail"] a[data-photo-view]')];
  if(!links.length)return;
  const images=await editorialManifest();
  for(const a of links){
    if(!a.isConnected||a.dataset.editorialSrc)continue;
    const source=a.getAttribute('href'),sourceSha=a.dataset.photoSha256;
    const record=images.map(item=>qualifiedEditorialPhoto(item,source,sourceSha)).find(Boolean);
    if(!record)continue;
    const probe=new Image();
    probe.onload=()=>{
      if(!a.isConnected||a.getAttribute('href')!==source||a.dataset.photoSha256!==sourceSha)return;
      const img=a.querySelector('img');if(!img)return;
      const originalAlt=img.alt;
      img.removeAttribute('srcset');img.removeAttribute('sizes');
      img.addEventListener('error',()=>{
        if(img.getAttribute('src')===record.asset){
          img.src=source;img.alt=originalAlt;delete a.dataset.editorialSrc;
          delete a.dataset.editorialAlt;delete a.dataset.editorialStyle;
          a.closest('figure')?.querySelector('[data-editorial-caption]')?.remove();
        }
      },{once:true});
      img.src=record.asset;img.alt=record.alt;img.width=record.width;img.height=record.height;
      a.dataset.editorialSrc=record.asset;a.dataset.editorialAlt=record.alt;
      a.dataset.editorialStyle='moody-atmospheric-v2';
      const figure=a.closest('figure');
      if(figure){
        let caption=figure.querySelector('figcaption');
        if(!caption){caption=document.createElement('figcaption');figure.append(caption);}
        const label=document.createElement('span');label.dataset.editorialCaption='';
        label.textContent=(caption.textContent.trim()?' · ':'')+
          'AI-stylized editorial photograph; setting illustrative.';
        caption.append(label);
      }
    };
    probe.onerror=()=>{}; // A missing/unreadable editorial asset leaves the original intact.
    probe.src=record.asset;
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
          for(const p of row.photos){const figure=document.createElement('figure'),a=document.createElement('a'),img=document.createElement('img');a.href=p.src;a.dataset.photoView='';a.dataset.photoSha256=p.sha256;const responsive=/^assets\/annals\/[a-f0-9]{64}\.jpg$/.test(p.src)&&Math.max(p.width,p.height)>=800;img.src=responsive?p.src.replace(/\.jpg$/,'-thumb.jpg'):p.src;if(responsive){img.srcset=img.src+' '+Math.round(p.width*400/Math.max(p.width,p.height))+'w, '+p.src+' '+p.width+'w';img.sizes='(max-width: 560px) 90vw, (max-width: 900px) 45vw, 360px';}img.alt=p.alt;img.loading='lazy';img.decoding='async';if(p.width){img.width=p.width;img.height=p.height;}a.append(img);figure.append(a);if(p.caption){const caption=document.createElement('figcaption');caption.textContent=p.caption;figure.append(caption);}gallery.append(figure);}
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
