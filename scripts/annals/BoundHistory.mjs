// Public, source-bound projection for Club History. The signed publisher owns additions.
export const CHAPTER_IDS = Object.freeze(['origins', 'gatherings', 'assemblies', 'traditions']);
const slug = /^[a-z][a-z0-9-]{0,79}$/;
const annalId = /^annal-[a-f0-9]{24}$/;
const sha = /^[a-f0-9]{64}$/;
const portraits = Object.freeze({fish:'Justin', marc:'Marc', matt:'Matt', ken:'Ken', jamie:'Jamie', jerome:'Jerome'});
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const copy = (s, max = 1500) => typeof s === 'string' && s.trim().length > 0 && s.length <= max &&
  !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|<[^>]+>/i.test(s) &&
  !/\b(?:motherfucker|motherfucking|fucking|fucked|fucker|fuck|bullshit|shitty|shit|asshole|bastard|bitch|cunt|dickhead)\b/i.test(s);

export function validateBoundHistory(value) {
  if (!exact(value, ['schemaVersion','revision','chapters','updatedAt']) || value.schemaVersion !== 2 ||
      !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.chapters) ||
      value.chapters.length > CHAPTER_IDS.length || typeof value.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAt))) throw Error('Invalid bound History document');
  const chapters = new Set();
  for (const c of value.chapters) {
    if (!exact(c,['id','heading','passages']) || !CHAPTER_IDS.includes(c.id) || chapters.has(c.id) ||
        !copy(c.heading,80) || !Array.isArray(c.passages) || !c.passages.length || c.passages.length > 150)
      throw Error('Invalid bound History chapter');
    chapters.add(c.id);
    const ids = new Set();
    for (const p of c.passages) {
      if (!exact(p,['id','text','sources']) || typeof p.id !== 'string' || !slug.test(p.id) || ids.has(p.id) ||
          !copy(p.text) || !Array.isArray(p.sources) || !p.sources.length || p.sources.length > 30)
        throw Error('Invalid bound History passage');
      ids.add(p.id);
      const sources = new Set();
      for (const s of p.sources) {
        if (s?.kind === 'annal') {
          if (!exact(s,['kind','entryId','digest','label','portrait']) ||
              typeof s.entryId !== 'string' || !annalId.test(s.entryId) ||
              typeof s.digest !== 'string' || !sha.test(s.digest) || !copy(s.label,160) ||
              (s.portrait !== null && !Object.hasOwn(portraits,s.portrait)) || sources.has(s.entryId))
            throw Error('Invalid History Annals source');
          sources.add(s.entryId);
        } else {
          // Public reference names are intentionally opaque. No private URLs or raw evidence.
          if (!exact(s,['kind','ref']) || s.kind !== 'record' || typeof s.ref !== 'string' ||
              !slug.test(s.ref) || sources.has(s.ref)) throw Error('Invalid History record reference');
          sources.add(s.ref);
        }
      }
    }
  }
  return value;
}

export function historyCredits(value) {
  if (value.schemaVersion !== 2) return [];
  const slugs = new Set();
  for (const chapter of value.chapters) for (const passage of chapter.passages)
    for (const source of passage.sources) if (source.kind === 'annal' && source.portrait) slugs.add(source.portrait);
  return Object.entries(portraits).filter(([key]) => slugs.has(key)).map(([key,name]) => ({key,name}));
}

export function historyBacklinks(value) {
  const links = new Map();
  if (value.schemaVersion !== 2) return links;
  for (const chapter of value.chapters) for (const passage of chapter.passages)
    for (const source of passage.sources) if (source.kind === 'annal') {
      const chapters = links.get(source.entryId) || new Map();
      chapters.set(chapter.id,chapter.heading);
      links.set(source.entryId,chapters);
    }
  return links;
}

function archivedSupport(entries, receipts) {
  const records = new Map(receipts.map(r => [r.entryId,r]));
  return new Map(entries.map(e => {
    const receipt = records.get(e.id);
    return [e.id,{digest:receipt?.contentSha256,portrait:
      receipt?.consents?.namedAttribution === true ? e.contributorPortrait ?? null : null}];
  }));
}

// The two founding recipe references support separable title mentions in the
// approved opening sentence. The ordinary publisher can delete only those
// exact words (never compose new prose). Other passages remain conjunctive.
const OPENING_RECIPE_LINE = "Marc gave that tradition a place in the written record when he contributed Kingston Windfall and Daq in Black to the Annals.";
const OPENING_RECIPE_CLAIMS = Object.freeze([
  {entryId:'annal-96b5ae266a36793c6a203033',title:'Kingston Windfall'},
  {entryId:'annal-5e0607c7dc924fb5663c40e0',title:'Daq in Black'}
]);
function subtractOpeningRecipe(c,p,missing){
  if(c.id!=='gatherings'||p.id!=='opening-2'||!missing.every(s=>OPENING_RECIPE_CLAIMS.some(k=>k.entryId===s.entryId)))return null;
  const removed=new Set(missing.map(s=>s.entryId));
  const remaining=p.sources.filter(s=>!removed.has(s.entryId));
  const before=OPENING_RECIPE_CLAIMS.filter(k=>p.sources.some(s=>s.kind==='annal'&&s.entryId===k.entryId));
  const after=before.filter(k=>!removed.has(k.entryId));
  const useTitles=claims=>OPENING_RECIPE_LINE.replace('Kingston Windfall and Daq in Black',claims.map(k=>k.title).join(' and '));
  const from=useTitles(before);
  if(!p.text.includes(from)||!remaining.some(s=>s.kind==='record'))return null;
  const text=after.length?p.text.replace(from,useTitles(after)):p.text.replace(from+' ','');
  return {...p,text,sources:remaining};
}
// Call only after the ordinary publisher has verified the records' signatures.
// An Annals correction may remove support and credit, never invent a narrative.
export function subtractStaleHistory(value, entries, receipts, now) {
  if (value.schemaVersion !== 2) return value;
  validateBoundHistory(value);
  const support = archivedSupport(entries,receipts);
  let changed = false;
  const chapters = value.chapters.map(chapter => {
    const passages = chapter.passages.flatMap(original => {
      const stale=original.sources.filter(s=>s.kind==='annal'&&support.get(s.entryId)?.digest!==s.digest);
      let p=original;
      if (stale.length) {
        changed = true;
        p=subtractOpeningRecipe(chapter,original,stale);
        if(!p)return [];
      }
      let portraitChanged = false;
      const sources = p.sources.map(s => {
        if(s.kind !== 'annal' || !s.portrait || support.get(s.entryId)?.portrait === s.portrait) return s;
        changed = portraitChanged = true;
        return {...s,portrait:null};
      });
      return [portraitChanged ? {...p,sources} : p];
    });
    return passages.length === chapter.passages.length && passages.every((p,i) => p === chapter.passages[i])
      ? chapter : {...chapter,passages};
  }).filter(c => c.passages.length);
  return changed ? validateBoundHistory({...value,revision:value.revision+1,updatedAt:now.toISOString(),chapters}) : value;
}
