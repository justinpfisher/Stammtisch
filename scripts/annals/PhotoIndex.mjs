import Photos from './PhotoContracts.js';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readdir,unlink} from 'node:fs/promises';

export function photoIndex(entries, pageSize=24) {
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>48)throw Error('Bounded photo index required');
  const rows=entries.filter(e=>Photos.photos(e).length).map(e=>({entryId:e.id,collection:['monthly_gathering','artefact'].includes(e.category)?'club_history':e.category,
    title:e.title,text:[e.summary,...Photos.photos(e).flatMap(p=>[p.alt,p.caption||''])].join(' '),
    submittedAt:e.submittedAt||'',eventPeriod:e.eventPeriod||e.sortDate||'',year:e.eventPeriod?Number(e.eventPeriod.slice(0,4)):e.submittedAt?Number(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric'}).format(new Date(e.submittedAt))):e.year,
    photos:Photos.photos(e).map(p=>({src:`assets/annals/${e.photos?p.sha256:e.id}.jpg`,alt:p.alt,...(p.width?{width:p.width,height:p.height}:{}),...(p.caption?{caption:p.caption}:{})}))}));
  rows.sort((a,b)=>b.year-a.year||(b.submittedAt||b.eventPeriod).localeCompare(a.submittedAt||a.eventPeriod)||a.entryId.localeCompare(b.entryId));
  const partitions=new Map();
  for(const row of rows){const key=row.collection+'/'+row.year;if(!partitions.has(key))partitions.set(key,[]);partitions.get(key).push(row);}
  const pages=[];
  for(const [key,group] of partitions)for(let i=0;i<group.length;i+=pageSize){
    const data=group.slice(i,i+pageSize),json=JSON.stringify(data)+'\n';
    const digest=createHash('sha256').update(json).digest('hex');
    pages.push({path:'data/photos/'+digest+'.json',data,collection:key.split('/')[0],year:Number(key.split('/')[1]),count:data.length});
  }
  return {manifest:{schemaVersion:1,count:rows.length,pages:pages.map(({data,...metadata})=>metadata)},pages};
}
export async function writePhotoIndex(entries){
  const result=photoIndex(entries);await mkdir('data/photos',{recursive:true});
  for(const page of result.pages)await writeFile(page.path,JSON.stringify(page.data)+'\n');
  await writeFile('data/photos/index.json',JSON.stringify(result.manifest,null,2)+'\n');
  const current=new Set(result.pages.map(p=>p.path.split('/').pop()));
  for(const name of await readdir('data/photos'))if(/^[a-f0-9]{64}\.json$/.test(name)&&!current.has(name))await unlink('data/photos/'+name);
}
