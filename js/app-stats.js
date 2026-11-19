/* ---------- statistiques ---------- */
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const sum=a=>a.reduce((x,y)=>x+y,0);
const fmtA=v=>v==null?'–':v.toFixed(1).replace('.',',');
function groupBy(list,fn){const m=new Map();list.forEach(f=>{const r=fn(f);(Array.isArray(r)?r:[r]).forEach(k=>{if(k==null||k==='')return;if(!m.has(k))m.set(k,[]);m.get(k).push(f)})});return m}
const st=list=>({n:list.length,avg:avg(list.filter(f=>f.r!=null).map(f=>f.r)),h:sum(list.map(f=>f.m||0))/60});
const rc=r=>r==null?'':r>=7?'c-g':r>=5?'c-o':'c-r';
let ymetric='n';
function vchart(items,metric){
  const val=i=>metric==='avg'?i.avg:metric==='h'?i.h:i.n,max=Math.max(...items.map(i=>val(i)||0),1);
  return `<div class="vb">${items.map(i=>{const v=val(i)||0,txt=metric==='avg'?fmtA(i.avg):metric==='h'?Math.round(i.h)+' h':i.n;
    return `<div class="vcol" title="${esc(i.label)} : ${i.n} film(s), note moyenne ${fmtA(i.avg)}"><span class="vv">${txt}</span><div class="vbar ${i.cls||(metric==='avg'?rc(i.avg):'')}" style="height:${Math.max(2,(metric==='avg'?v/10:v/max)*150)}px"></div><span class="vl">${esc(i.label)}</span></div>`}).join('')}</div>`;
}
function hrows(items,opt){
  const max=Math.max(...items.map(i=>opt.avg?10:i.n),1);
  return items.map(i=>`<button class="hrow${opt.key?'':' static'}" type="button" ${opt.key?`data-${opt.key}="${esc(i.label)}"`:''}><span class="hl">${esc(i.label)}</span><span class="hb"><i class="${opt.avg?rc(i.avg):''}" style="width:${((opt.avg?i.avg:i.n)/max)*100}%"></i></span><span class="hv">${opt.avg?fmtA(i.avg):i.n} <small>${opt.avg?'('+i.n+')':(i.avg!=null?'· '+fmtA(i.avg):'')}</small></span></button>`).join('');
}
const MONTHS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],DAYS=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];
function statsYear(){
  const w=ALL.filter(f=>f.w);
  const byY=[...groupBy(w,f=>f.w.slice(0,4))].sort((a,b)=>a[0]<b[0]?-1:1).map(([k,l])=>({label:k,...st(l)}));
  const lab={n:'Nombre de films',h:'Heures de films',avg:'Note moyenne'};
  return `<div class="tabs" role="group" aria-label="Indicateur">${Object.keys(lab).map(k=>`<button type="button" data-ym="${k}" aria-pressed="${k===ymetric}">${lab[k]}</button>`).join('')}</div>${vchart(byY,ymetric)}`;
}
function renderStats(){
  const all=st(ALL),w=ALL.filter(f=>f.w),years=new Set(w.map(f=>f.w.slice(0,4))),dates=w.map(f=>f.w).sort();
  const months=dates.length?Math.max(1,(new Date(dates[dates.length-1])-new Date(dates[0]))/2629800000):1;
  const kpi=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  const dec=[...groupBy(ALL,f=>f.y?Math.floor(f.y/10)*10:null)].sort((a,b)=>a[0]-b[0]).map(([k,l])=>({label:k+'s',...st(l)}));
  const gen=[...groupBy(ALL,f=>f.g)].map(([k,l])=>({label:k,...st(l)}));
  const dirs=[...groupBy(ALL,f=>f.d)].map(([k,l])=>({label:k,...st(l)}));
  const rated=ALL.filter(f=>f.r!=null),dist=Array.from({length:10},(_,i)=>({label:String(i+1),n:rated.filter(f=>Math.round(f.r)===i+1).length,avg:i+1,h:0,cls:rc(i+1)}));
  const mon=Array.from({length:12},(_,i)=>({label:MONTHS[i],...st(w.filter(f=>+f.w.slice(5,7)===i+1))}));
  const day=Array.from({length:7},(_,i)=>({label:DAYS[i],...st(w.filter(f=>(new Date(f.w+'T12:00:00').getDay()+6)%7===i))}));
  const rec=(t,l)=>`<div><h2 style="margin-top:18px;font-size:1rem">${t}</h2><ul class="reclist">${l.map(f=>`<li><a href="#film/${esc(f.id)}">${esc(f.t)}</a> <span class="mute">${esc(f.y||'')}${f.m?' · '+fmtM(f.m):''}${f.r!=null?' · note '+fmtR(f.r):''}</span></li>`).join('')}</ul></div>`;
  const withM=ALL.filter(f=>f.m);
  $('#stats').innerHTML=`<div class="topbar"><button class="btn alt" id="back" type="button">← Ma vidéothèque</button></div>
  <h1>Statistiques</h1><p class="mute">Calculées sur ${ALL.length} films, dont ${w.length} avec une date de visionnage.</p>
  <div class="cards">${kpi(ALL.length,'films vus')}${kpi(Math.round(all.h).toLocaleString('fr-FR')+' h','de films, soit '+(all.h/24).toFixed(0)+' jours')}${kpi(fmtA(all.avg),'note moyenne')}${kpi(fmtM(Math.round(avg(withM.map(f=>f.m))||0)),'durée moyenne')}${kpi(w.length?(w.length/months).toFixed(1).replace('.',','):'–','films par mois en moyenne')}${kpi(years.size,'années de visionnage')}</div>
  <h2>Films vus par année</h2><div id="ychart">${statsYear()}</div>
  <div class="two-col"><div><h2>Par mois de l’année</h2>${vchart(mon,'n')}</div><div><h2>Par jour de la semaine</h2>${vchart(day,'n')}</div></div>
  <h2>Répartition de mes notes</h2>${vchart(dist,'n')}
  <div class="two-col"><div><h2>Note moyenne par genre</h2><p class="mute">Genres avec au moins 5 films. Clique pour filtrer.</p>${hrows(gen.filter(g=>g.n>=5).sort((a,b)=>b.avg-a.avg),{avg:1,key:'genre'})}</div>
  <div><h2>Genres les plus vus</h2><p class="mute">Nombre de films et note moyenne.</p>${hrows(gen.sort((a,b)=>b.n-a.n).slice(0,14),{key:'genre'})}</div></div>
  <div class="two-col"><div><h2>Par décennie de sortie</h2>${hrows(dec,{})}</div><div><h2>Note moyenne par décennie</h2>${hrows(dec.filter(d=>d.n>=3),{avg:1})}</div></div>
  <div class="two-col"><div><h2>Réalisateurs les plus vus</h2>${hrows(dirs.sort((a,b)=>b.n-a.n||b.avg-a.avg).slice(0,12),{key:'dir'})}</div>
  <div><h2>Réalisateurs les mieux notés</h2><p class="mute">Au moins 3 films vus.</p>${hrows(dirs.filter(d=>d.n>=3&&d.avg!=null).sort((a,b)=>b.avg-a.avg||b.n-a.n).slice(0,12),{avg:1,key:'dir'})}</div></div>
  <h2>Records</h2><div class="two-col">${rec('Les plus longs',[...withM].sort((a,b)=>b.m-a.m).slice(0,5))}${rec('Les plus courts',[...withM].sort((a,b)=>a.m-b.m).slice(0,5))}${rec('Les plus anciens',ALL.filter(f=>f.y).sort((a,b)=>a.y-b.y).slice(0,5))}${rec('Les mieux notés (les plus récemment vus)',rated.filter(f=>f.r>=10).sort((a,b)=>(b.w||'')<(a.w||'')?-1:1).slice(0,5))}</div>`;
}
function showStats(){document.title='Statistiques · Ma vidéothèque';$('#stats').classList.remove('hide');if(ALL.length)renderStats();else $('#stats').innerHTML='<div class="topbar"><button class="btn alt" id="back" type="button">← Ma vidéothèque</button></div><p class="mute">Chargement…</p>'}
$('#stats').addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.id==='back'){location.hash='';return}
  if(t.dataset.ym){ymetric=t.dataset.ym;$('#ychart').innerHTML=statsYear();return}
  if(t.dataset.genre||t.dataset.dir){
    document.querySelectorAll('#filters input,#filters select').forEach(x=>x.value='');
    if(t.dataset.genre)$('#gsel').value=t.dataset.genre;else $('#dsel').value=t.dataset.dir;
    $('#filters').classList.remove('hide');apply();gridScroll=0;location.hash='';
  }
});

/* ---------- démarrage ---------- */
(async()=>{
  const to=setTimeout(()=>{if(!ALL.length)$('#status').textContent='Chargement lent…'},10000);
  try{
    const j=await window.VideothequeDB.getIndex();
    if(!j)throw new Error('Aucune base locale active. Ouvre Outils et importe ta sauvegarde complète (.jsonl.gz).');
    clearTimeout(to);
    build(j.films||[]);
    await loadKodiSnapshot();
    render();
  }catch(e){clearTimeout(to);$('#status').textContent='Les données ne sont pas encore disponibles ('+e.message+').'}
  route();
})();
