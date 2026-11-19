const {$,esc,isValidTmdbToken}=window.VideothequeCommon;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let ALL=[],view=[],shown=120,dir=-1;
let kodiMoviesSnapshot=[],kodiTmdbIds=new Set(),kodiSnapshotSyncedAt=null;
const KODI_ICON='<span class="badge kodi-badge" title="Présent sur Kodi" aria-label="Présent sur Kodi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 22h8M12 18v4"/></svg></span>';
const PAGE=120;

/* ---------- affichage ---------- */
const fmtR=r=>r==null?'–':(Number.isInteger(r)?String(r):r.toFixed(1).replace('.',','));
const fmtM=m=>m?`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}`:'';
const fmtD=d=>d?new Date(d+'T00:00:00').toLocaleDateString('fr-FR'):'';
const fmtDS=(d,y)=>d?new Date(d+'T00:00:00').toLocaleDateString('fr-FR',y?{day:'numeric',month:'short',year:'numeric'}:{day:'numeric',month:'short'}):'';
const EYE='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
const monthLabel=m=>{const t=new Date(m+'-01T00:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});return t.charAt(0).toUpperCase()+t.slice(1)};
const tmdbRatings=new Map(),tmdbPending=new Set();
let ratingObserver;
function filmSlug(title){return String(title||'film').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'film'}
function filmHref(id,title){return '#film/'+encodeURIComponent(String(id))+'-'+filmSlug(title)}
function currentFilmRouteId(){const match=location.hash.match(/^#film\/([\w-]+?)(?:-[a-z0-9-]+)?$/i);return match?match[1]:null}
function sagaHref(id,name){return '#saga/'+encodeURIComponent(String(id))+'-'+filmSlug(name)}
function currentSagaRouteId(){const match=location.hash.match(/^#saga\/(\d+)(?:-[a-z0-9-]+)?$/i);return match?match[1]:null}
function card(f,byDate){
  const img=f.p?`<img loading="lazy" decoding="async" src="https://image.tmdb.org/t/p/w342${f.p}" alt="">`:`<div class="noimg">${esc((f.t||'?').slice(0,2))}</div>`;
  const rating=tmdbRatings.get(f.id),director=(f.d||[]).join(', ');
  const release=f.y?String(f.y):'';
  return `<a class="card" href="${esc(filmHref(f.id,f.t))}"><div class="poster">${img}
    <span class="badge tmdb${rating==null?' hide':''}" data-tmdb-rating="${esc(f.id)}" title="Note moyenne TMDB">${rating==null?'':fmtR(rating)}</span>
    ${f.r!=null?`<span class="badge personal-rating poster-personal-rating ${f.r>=7?'rg':f.r>=5?'ro':'rr'}" title="Ma note : ${fmtR(f.r)} / 10">${fmtR(f.r)}<small>/10</small></span>`:''}
    ${kodiTmdbIds.has(String(f.id).replace(/^t/,''))?KODI_ICON:''}
    ${f.w?`<span class="poster-date">${EYE}<span>Vu le ${fmtD(f.w)}</span></span>`:''}
  </div><div class="card-heading"><h2>${esc(f.t)}</h2></div>
  <div class="meta release-director">${esc([release,director].filter(Boolean).join(' · '))}</div>
</a>`;
}
async function getFilmRecord(id){
 const local=await window.VideothequeDB.getFilm(id);
 if(!local)throw new Error('Fiche absente de la base locale : '+id);
 return local;
}
const detailCacheKey=id=>'tmdbDetail:'+String(id).replace(/^t/,'');
async function makeTmdbRecord(movie){
 if(!movie.overview){
  const en=((movie.translations||{}).translations||[]).find(x=>x.iso_639_1==='en'&&x.data?.overview);
  if(en){movie.overview=en.data.overview;movie.overviewLang='en'}
 }
 const tmdb=shape(movie),title=movie.title||movie.original_title||'Film sans titre',
 year=Number((movie.release_date||'').slice(0,4))||null,
 directors=[...new Set(((movie.credits||{}).crew||[]).filter(x=>x.job==='Director').map(x=>x.name))],
 csv={title,year,directors,rating:null,watchedDate:null},
 extra=fitExtra(buildExtra(movie));
 return {id:'t'+movie.id,key:norm(title)+'|'+(year||''),csv,status:'ok',tmdb,extra};
}
async function getOrFetchTmdbDetail(id){
 const tmdbId=String(id).replace(/^t/,'');
 const local=await window.VideothequeDB.getFilm('t'+tmdbId);
 if(local)return local;
 const key=detailCacheKey(tmdbId),cached=await window.VideothequeDB.getSetting(key);
 if(cached&&cached.record)return cached.record;
 const movie=await quickTmdbApi('/movie/'+encodeURIComponent(tmdbId),{language:'fr-FR',append_to_response:'credits,alternative_titles,external_ids,keywords,release_dates,translations,videos,images,recommendations,similar,watch/providers,reviews',include_image_language:'fr,en,null',include_video_language:'fr,en,null'});
 const record=await makeTmdbRecord(movie);
 await window.VideothequeDB.setSetting(key,{savedAt:Date.now(),record});
 return record;
}
async function getSagaRecord(id){
 const local=await window.VideothequeDB.getSaga(id);
 if(!local)throw new Error('Les informations de cette saga (ID TMDB '+id+') ne sont pas encore enregistrées dans la base locale.');
 return local;
}
async function loadCardRating(id){
  if(tmdbRatings.has(id)||tmdbPending.has(id))return;
  tmdbPending.add(id);
  try{
    const f=await getFilmRecord(id),v=f.tmdb&&f.tmdb.voteAverage;
    if(v!=null&&Number.isFinite(Number(v)))tmdbRatings.set(id,Number(v));
    const el=document.querySelector(`[data-tmdb-rating="${CSS.escape(id)}"]`);
    if(el&&tmdbRatings.has(id)){el.textContent=fmtR(tmdbRatings.get(id));el.classList.remove('hide')}
  }catch(e){/* La note reste absente si la fiche ne peut pas être chargée. */}
  finally{tmdbPending.delete(id)}
}
function observeCardRatings(){
  if(!('IntersectionObserver' in window)){
    document.querySelectorAll('[data-tmdb-rating]').forEach(el=>loadCardRating(el.dataset.tmdbRating));
    return;
  }
  if(ratingObserver)ratingObserver.disconnect();
  ratingObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        ratingObserver.unobserve(entry.target);
        loadCardRating(entry.target.dataset.tmdbRating);
      }
    });
  },{rootMargin:'180px'});
  document.querySelectorAll('[data-tmdb-rating]').forEach(el=>{
    const rating=tmdbRatings.get(el.dataset.tmdbRating);
    if(rating!=null){el.textContent=fmtR(rating);el.classList.remove('hide')}
    else ratingObserver.observe(el);
  });
}
function render(){
  const byDate=$('#sort').value==='w';let lastMonth;
  $('#grid').innerHTML=view.slice(0,shown).map(f=>{let h='';if(byDate){const m=f.w?f.w.slice(0,7):'';if(m!==lastMonth){lastMonth=m;h=`<h3 class="month-sep">${m?monthLabel(m):'Sans date de visionnage'}</h3>`}}return h+card(f,byDate)}).join('');
  observeCardRatings();
  $('#more').classList.toggle('hide',shown>=view.length);
  if(ALL.length){
    $('#status').classList.toggle('hide',view.length>0);
    if(!view.length)$('#status').textContent='Aucun film ne correspond à ces filtres.';
  }
}

/* ---------- tri et filtres ---------- */
const keyf={w:f=>f.w,r:f=>f.r,t:f=>f.t,m:f=>f.m};
const num=id=>{const v=$(id).value;return v===''?null:parseFloat(v)};
function apply(){
  const d=norm($('#dsel').value.trim()),g=$('#gsel').value;
  const rmin=num('#rmin'),rmax=num('#rmax'),mmin=num('#mmin'),mmax=num('#mmax'),a=$('#dfrom').value,b=$('#dto').value;
  view=ALL.filter(f=>{
    if(d&&!(f.d||[]).some(x=>norm(x).includes(d)))return false;
    if(g&&!(f.g||[]).includes(g))return false;
    if(rmin!=null&&(f.r==null||f.r<rmin))return false;
    if(rmax!=null&&(f.r==null||f.r>rmax))return false;
    if(mmin!=null&&(!f.m||f.m<mmin))return false;
    if(mmax!=null&&(!f.m||f.m>mmax))return false;
    if(a&&(!f.w||f.w<a))return false;
    if(b&&(!f.w||f.w>b))return false;
    return true;
  });
  const k=keyf[$('#sort').value];
  view.sort((x,y)=>{
    const u=k(x),v=k(y),nu=u==null||u==='',nv=v==null||v==='';
    if(nu&&nv)return 0;if(nu)return 1;if(nv)return -1;
    return (typeof u==='string'?u.localeCompare(v,'fr',{sensitivity:'base'}):u-v)*dir;
  });
  shown=PAGE;render();
}
let tm;const deb=()=>{clearTimeout(tm);tm=setTimeout(apply,150)};
document.querySelectorAll('#filters input,#filters select').forEach(el=>el.addEventListener('input',deb));
$('#sort').addEventListener('change',()=>{dir=$('#sort').value==='t'?1:-1;$('#dirb').textContent=dir<0?'↓':'↑';apply()});
$('#dirb').onclick=()=>{dir=-dir;$('#dirb').textContent=dir<0?'↓':'↑';apply()};
$('#fbtn').onclick=()=>{const h=$('#filters').classList.toggle('hide');$('#fbtn').setAttribute('aria-expanded',String(!h))};
$('#reset').onclick=()=>{document.querySelectorAll('#filters input,#filters select').forEach(e=>e.value='');apply()};
$('#more').onclick=()=>{shown+=PAGE;render()};

function build(films){
  ALL=films;
  const gs=[...new Set(ALL.flatMap(f=>f.g||[]))].sort((a,b)=>a.localeCompare(b,'fr')),cur=$('#gsel').value;
  $('#gsel').innerHTML='<option value="">Tous</option>'+gs.map(x=>`<option>${esc(x)}</option>`).join('');
  $('#gsel').value=cur;
  if(!ALL.length){$('#status').classList.remove('hide');$('#status').textContent='Aucun film pour l’instant.'}
  apply();
}

/* ---------- page de détail ---------- */
const IMG='https://image.tmdb.org/t/p/';
const fmtLong=d=>d?new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
const money=n=>n?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'';
const rcls=r=>r>=7?'rg':r>=5?'ro':'rr';
const names=a=>(a||[]).filter(Boolean).map(esc).join(', ');
let gridScroll=0;
function pcard(href,img,title,sub,ext,badge,rating){
  return `<a class="pcard" href="${esc(href)}"${ext?' target="_blank" rel="noopener"':''}>${img?`<img loading="lazy" src="${img}" alt="">`:`<div class="ph noimg">${esc((title||'?').slice(0,2))}</div>`}${rating!=null?`<span class="badge tmdb" title="Note moyenne TMDB">${fmtR(Number(rating))}</span>`:''}<b>${esc(title)}</b>${sub?`<span>${esc(sub)}</span>`:''}${badge?'<span class="inlib">Dans ma vidéothèque</span>':''}</a>`;
}
function detailHTML(f){
  const t=f.tmdb||{},x=f.extra||{},c=f.csv||{},lib=new Set(ALL.map(a=>a.id));
  const title=t.title||c.title;
  const cast=(x.credits&&x.credits.cast&&x.credits.cast.length)?x.credits.cast:(t.cast||[]).map(a=>({id:a.id,name:a.name,character:a.character,profile_path:a.profilePath}));
  const kv=(k,v)=>v?`<dt>${k}</dt><dd>${v}</dd>`:'';
  const money1=[t.budget?`Budget : ${money(t.budget)}`:'',t.revenue?`Recettes : ${money(t.revenue)}`:''].filter(Boolean).join(' · ');
  const seen=new Set([t.tmdbId]),sim=[];
  [...(x.recommendations||[]),...(x.similar||[])].forEach(m=>{if(!seen.has(m.id)){seen.add(m.id);sim.push(m)}});
  const crew=(x.credits&&x.credits.crew)||[];
  const crewNames=a=>(a||[]).filter(Boolean).map(name=>{const person=crew.find(p=>p.name===name&&p.id!=null);return person?`<a href="https://www.themoviedb.org/person/${encodeURIComponent(person.id)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`:esc(name)}).join(', ');
  const crewBy={};crew.forEach(p=>{(crewBy[p.department]=crewBy[p.department]||new Map()).set(p.job,[...(crewBy[p.department].get(p.job)||[]),p.name])});
  const bd=t.backdropPath?`style="--bd:url(${IMG}w1280${t.backdropPath})"`:'';
  const fmtV=n=>Number(n).toLocaleString('fr-FR');
  const entry=ALL.find(a=>a.id===f.id),rate=entry?entry.r:null,watchedDate=entry?entry.w:null;
  const inLibrary=!!entry;
  const scoreHTML=(()=>{
    const cal='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
    const mine=`<div class="score"><span class="score-badge ${rate!=null?rcls(rate):'empty'}" title="${rate!=null?'Ma note : '+fmtR(rate)+' sur 10':'Ma note à renseigner'}">${rate!=null?fmtR(rate):'–'}<small>/10</small></span><div class="score-text"><span class="score-label">Ma note</span><span class="score-sub">${cal}Vu le ${watchedDate?fmtD(watchedDate):'–'}</span></div></div>`;
    const avg=Number(t.voteAverage),n=Number(t.voteCount);
    const tmdb=avg>0?`<div class="score"><span class="score-pill" title="Note moyenne TMDB : ${fmtR(avg)} sur 10">${fmtR(avg)}<small>/10</small></span><div class="score-text"><span class="score-label">TMDB</span>${n>0?`<span class="score-sub">${fmtV(n)} vote${n>1?'s':''}</span>`:''}</div></div>`:'';
    const editor='';

    const dialog=`<dialog class="personal-dialog" id="personalEditDialog" aria-labelledby="personalDialogTitle"><form id="personalEditForm" data-save-personal="${esc(f.id)}"><div class="personal-dialog-inner"><h2 class="personal-dialog-title" id="personalDialogTitle">${inLibrary?'Modifier mon avis':'Ajouter à ma vidéothèque'}</h2><div class="personal-dialog-fields"><label class="personal-field">Ma note / 10<select id="personalRating" aria-label="Ma note sur 10"><option value="">—</option>${Array.from({length:10},(_,i)=>i+1).map(v=>`<option value="${v}" ${Number(rate)===v?'selected':''}>${fmtR(v)}</option>`).join('')}</select></label><label class="personal-field">Vu le <input id="personalWatchedDate" type="date" value="${esc(watchedDate||'')}" aria-label="Date de visionnage"></label></div><p class="personal-dialog-error" id="personalDialogError" role="alert" aria-live="polite"></p><div class="personal-dialog-actions"><button class="btn alt" type="button" data-clear-personal>Effacer</button><button class="btn alt" type="button" data-close-personal>Annuler</button><button class="btn" type="submit">Valider</button></div></div></form></dialog>`;
    return `<div class="scorebox" data-edit-personal tabindex="0" role="button" aria-label="${inLibrary?'Modifier':'Ajouter'} ma note et ma date de visionnage" title="Cliquer pour renseigner ma note et ma date de visionnage">${mine}${tmdb}</div>${dialog}`;
  })();
  return `
  <div class="topbar"><button class="btn alt" id="back" type="button">Ma vidéothèque</button></div>
  <div class="hero" ${bd}><div class="hero-in">
    ${t.posterPath?`<img class="dposter" src="${IMG}w500${t.posterPath}" alt="Affiche de ${esc(title)}">`:''}
    <div class='dinfo'><h1>${esc(title)}</h1>${t.tmdbId?`<div class="film-source-links"><a class="film-source-icon tmdb-source" href="https://www.themoviedb.org/movie/${encodeURIComponent(t.tmdbId)}" target="_blank" rel="noopener noreferrer" aria-label="Voir la fiche du film sur TMDB" title="Voir la fiche sur TMDB"><span aria-hidden="true">TMDB</span></a><a class="film-source-icon sc-source" href="https://www.senscritique.com/search?query=${encodeURIComponent([title,t.releaseDate&&t.releaseDate.slice(0,4)].filter(Boolean).join(' '))}" target="_blank" rel="noopener noreferrer" aria-label="Rechercher ce film sur SensCritique" title="Rechercher sur SensCritique"><span aria-hidden="true">SC</span></a></div>`:""}
      ${t.originalTitle&&t.originalTitle!==title?`<p class="orig">${esc(t.originalTitle)}</p>`:''}
      
      <p class="meta-line">${[[t.releaseDate&&t.releaseDate.slice(0,4),fmtM(t.runtime),t.certificationFR].filter(Boolean).map(esc).join(' · '),(t.genres||[]).map((g,i)=>{const id=(t.genreIds||[])[i];return id?`<a class='genre-link' href='https://www.themoviedb.org/genre/${encodeURIComponent(id)}-${norm(g).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}/movie' target='_blank' rel='noopener noreferrer' title='Voir les films de ce genre sur TMDB'>${esc(g)}</a>`:`<span class='genre-link'>${esc(g)}</span>`}).join(", ")].filter(Boolean).join(' · ')}</p>
      </div>
    ${scoreHTML}
  </div></div>
  ${t.overview?`<h2>Synopsis</h2><p>${esc(t.overview)}</p>${t.overviewLang==='en'?'<p class="mute">Synopsis non disponible en français.</p>':''}`:''}
  <div class="cols"><div><h2>Équipe</h2><dl class="kv">${kv('Réalisation',crewNames(t.directors))}${kv('Scénario',crewNames(t.writers))}${kv('Musique',crewNames(t.composers))}${kv('Photographie',crewNames(t.cinematographers))}${kv('Montage',crewNames(t.editors))}${kv('Production',crewNames(t.producers))}</dl></div>
  <div><h2>Informations</h2><dl class="kv">${kv('Sortie',fmtLong(t.releaseDate))}${kv('Pays',names(t.countries))}${kv('Langues',names(t.languages))}${kv('Studios',names((t.companies||[]).slice(0,6)))}${kv('Saga',(t.collection||{}).id?'<a href="'+esc(sagaHref(t.collection.id,(t.collection||{}).name||'Saga'))+'">'+esc((t.collection||{}).name||'Voir la saga')+'</a>':esc((t.collection||{}).name||''))}${kv('Chiffres',esc(money1))}</dl></div></div>
  ${cast.length?`<h2>Distribution</h2><div class="strip">${cast.slice(0,20).map(a=>pcard('https://www.themoviedb.org/person/'+a.id,a.profile_path?IMG+'w185'+a.profile_path:null,a.name,a.character,true)).join('')}</div>
    ${cast.length>20?`<details><summary>Distribution complète (${cast.length})</summary>${cast.map(a=>`<span>${a.id!=null?`<a href='https://www.themoviedb.org/person/${encodeURIComponent(a.id)}' target='_blank' rel='noopener noreferrer'>${esc(a.name)}</a>`:esc(a.name)}${a.character?` <span class='mute'>(${esc(a.character)})</span>`:""}</span>`).join("<br>")}</details>`:""}`:""}
  ${Object.keys(crewBy).length?`<details><summary>Équipe technique complète</summary>${Object.keys(crewBy).sort().map(d=>`<p><b>${esc(d)}</b><br>${[...crewBy[d]].map(([j,n])=>`<span class="mute">${esc(j)} :</span> ${crewNames([...new Set(n)])}`).join('<br>')}</p>`).join('')}</details>`:''}
  ${sim.length?`<h2>Dans le même esprit</h2><div class="strip">${sim.slice(0,18).map(m=>{const id='t'+m.id,inl=lib.has(id);return pcard(filmHref(id,m.title),m.poster_path?IMG+'w185'+m.poster_path:null,m.title,(m.release_date||'').slice(0,4),false,inl,m.vote_average)}).join('')}</div>`:''}
  ${(t.keywords||[]).length?(()=>{const keywordIds=new Map((x.keywords||[]).filter(q=>q&&q.id!=null&&q.name).map(q=>[q.name,Number(q.id)]));return '<h2>Mots-clés</h2><div class="chips">'+t.keywords.map(k=>{const id=keywordIds.get(k);return Number.isSafeInteger(id)&&id>0?'<a class="chip" href="#discover?'+new URLSearchParams({keyword:String(id),name:k}).toString()+'" title="Découvrir les films associés à ce mot-clé">'+esc(k)+'</a>':'<span class="chip">'+esc(k)+'</span>'}).join('')+'</div>'})():''}
  ${((x.images||{}).backdrops||[]).length?`<h2>Images</h2><div class="gal">${x.images.backdrops.slice(0,12).map(i=>`<a href="${IMG}original${i.file_path}" target="_blank" rel="noopener"><img loading="lazy" src="${IMG}w300${i.file_path}" alt=""></a>`).join('')}</div>`:''}
`;
}
async function showDetail(id){
  const el=$('#detail');el.classList.remove('hide');
  el.innerHTML='<div class="topbar"><button class="btn alt" id="back" type="button">Ma vidéothèque</button></div><p class="mute">Chargement…</p>';
  try{
    const f=await getOrFetchTmdbDetail(id);
    if(currentFilmRouteId()!==String(id))return;
    const filmTitle=(f.tmdb&&f.tmdb.title)||(f.csv&&f.csv.title)||'Film';
    const canonicalHash=filmHref(id,filmTitle);
    if(location.hash!==canonicalHash)history.replaceState(null,'',location.pathname+location.search+canonicalHash);
    el.innerHTML=detailHTML(f);
    document.title=filmTitle+' · Ma vidéothèque';
  }catch(e){if(currentFilmRouteId()!==String(id))return;el.innerHTML='<div class="topbar"><button class="btn alt" id="back" type="button">Ma vidéothèque</button></div><p class="mute">Impossible d’afficher ce film : '+esc(e.message)+'</p>'}
}

async function showSaga(id){
 const el=$('#detail');el.classList.remove('hide');
 el.innerHTML='<div class="topbar"><button class="btn alt" id="back" type="button">Ma vidéothèque</button></div><p class="mute">Chargement de la saga…</p>';
 try{
  if(!/^\d+$/.test(String(id)))throw new Error('Identifiant de saga invalide.');
  const saga=await getSagaRecord(id);
  if(currentSagaRouteId()!==String(id))return;
  const sagaName=saga.name||'Saga',canonicalHash=sagaHref(id,sagaName);
  if(location.hash!==canonicalHash)history.replaceState(null,'',location.pathname+location.search+canonicalHash);
  const parts=[...(saga.parts||[])].sort((a,b)=>(a.release_date||'9999').localeCompare(b.release_date||'9999'));
  const matches=parts.map(m=>{
   const exact='t'+m.id,film=ALL.find(a=>a.id===exact)||ALL.find(a=>a.id.startsWith(exact+'-')||a.id.startsWith(exact+'_'));
   return {m,film};
  });
  const watched=matches.filter(x=>x.film&&x.film.w).length,inLibrary=matches.filter(x=>x.film).length;
  const bd=saga.backdrop_path?'style="--bd:url('+IMG+'w1280'+saga.backdrop_path+')"':'';
  const poster=saga.poster_path?'<img class="dposter" src="'+IMG+'w500'+saga.poster_path+'" alt="Affiche de '+esc(saga.name)+'">':'';
  const cards=matches.map(({m,film})=>{
   const title=m.title||m.original_title||'Film sans titre';
   const href=filmHref('t'+m.id,title);
   const release=m.release_date?fmtLong(m.release_date):'Date de sortie inconnue';
   const img=m.poster_path?'<img loading="lazy" decoding="async" src="'+IMG+'w342'+m.poster_path+'" alt="">':'<div class="noimg">'+esc(title.slice(0,2))+'</div>';
   return '<a class="saga-row" href="'+esc(href)+'">'+
    '<div class="saga-cover">'+img+
     '<div class="saga-ratings">'+
      (m.vote_average!=null?'<span class="badge tmdb" title="Note moyenne TMDB">'+fmtR(Number(m.vote_average))+'</span>':'')+
      (film&&film.r!=null?'<span class="badge '+rcls(film.r)+'" title="Ma note : '+fmtR(film.r)+' / 10">'+fmtR(film.r)+'</span>':'')+
     '</div>'+
     (film&&film.w?'<span class="poster-date">'+EYE+'<span>Vu le '+fmtD(film.w)+'</span></span>':'')+
    '</div><div class="saga-info"><h3>'+esc(title)+'</h3><div class="saga-release">'+esc(release)+'</div>'+
     (m.overview?'<p class="saga-overview">'+esc(m.overview)+'</p>':'<p class="saga-overview mute">Synopsis non disponible.</p>')+
    '</div></a>';
  }).join('');
  el.innerHTML='<div class="topbar"><button class="btn alt" id="back" type="button">Ma vidéothèque</button></div>'+
   '<div class="hero" '+bd+'><div class="hero-in">'+poster+'<div class="dinfo"><h1>'+esc(saga.name||'Saga')+'</h1><p class="meta-line">'+parts.length+' films référencés · '+inLibrary+' dans ma vidéothèque · '+watched+' vus</p></div></div></div>'+
   (saga.overview?'<h2>À propos de la saga</h2><p>'+esc(saga.overview)+'</p>':'')+
   '<h2>Films de la saga</h2><p class="mute">Les films déjà présents dans ta vidéothèque ouvrent leur fiche. Les autres renvoient vers TMDB.</p><div class="saga-grid">'+(cards||'<p class="mute">Aucun film référencé dans cette collection.</p>')+'</div>'+
   '<p class="mute">Données TMDB · actualisées le '+(saga.fetchedAt?fmtD(saga.fetchedAt.slice(0,10)):'date inconnue')+'.</p>';
  document.title=sagaName+' · Ma vidéothèque';
 }catch(e){
  if(currentSagaRouteId()!==String(id))return;
  el.innerHTML='<div class="topbar"><button class="btn alt" id="back" type="button">Ma vidéothèque</button></div><p class="mute">'+esc(e.message)+'</p>'+(String(e.message).includes('ne sont pas encore enregistrées')?'<p><a href="tools.html?saga='+encodeURIComponent(id)+'">Actualiser cette saga dans les outils</a></p>':'');
  document.title='Saga · Ma vidéothèque';
 }
}

$('#detail').addEventListener('click',e=>{
 const edit=e.target.closest('.scorebox[data-edit-personal]');
 if(edit){const dialog=$('#personalEditDialog');if(dialog&&!dialog.open)dialog.showModal();return}
 const close=e.target.closest('[data-close-personal]');
 if(close){$('#personalEditDialog')?.close();return}
 const clear=e.target.closest('[data-clear-personal]');
 if(clear){
  const form=$('#personalEditForm'),id=form?.dataset.savePersonal;
  if(!id)return;
  clear.disabled=true;clear.textContent='Effacement…';
  $('#personalDialogError').textContent='';
  (async()=>{
   try{
    const base=await window.VideothequeDB.getIndex();
    if(!base)throw Error('Aucune base locale active.');
    const existing=base.films.some(f=>f.id===id);
    if(existing){
     const films=base.films.filter(f=>f.id!==id);
     const next={...base,count:films.length,generatedAt:new Date().toISOString(),films};
     await window.VideothequeDB.saveChanges({index:next,films:[],sagas:[]});
     build(next.films);
     await showDetail(id);
    }else{
     $('#personalRating').value='';
     $('#personalWatchedDate').value='';
     $('#personalDialogError').textContent='';
     clear.disabled=false;clear.textContent='Effacer';
    }
   }catch(err){
    clear.disabled=false;clear.textContent='Effacer';
    $('#personalDialogError').textContent='Effacement impossible : '+(err.message||String(err));
   }
  })();
  return;
 }
 if(e.target.id==='back'){location.hash='';return}
});
$('#detail').addEventListener('keydown',e=>{
 const edit=e.target.closest('.scorebox[data-edit-personal]');
 if(edit&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const dialog=$('#personalEditDialog');if(dialog&&!dialog.open)dialog.showModal()}
});
$('#detail').addEventListener('submit',async e=>{
 const form=e.target.closest('#personalEditForm');
 if(!form)return;
 e.preventDefault();
 const id=form.dataset.savePersonal,button=form.querySelector('[type="submit"]');
 const ratingValue=$('#personalRating').value,dateValue=$('#personalWatchedDate').value;
 const rating=ratingValue===''?null:Number(ratingValue),watchedDate=dateValue||null;
 if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>10)){$('#personalDialogError').textContent='La note doit être un nombre entier compris entre 1 et 10.';return}
 if(rating===null&&!watchedDate){$('#personalDialogError').textContent='Renseigne une note ou une date de visionnage pour ajouter ce film.';return}
 button.disabled=true;button.textContent='Enregistrement…';
 try{
  const base=await window.VideothequeDB.getIndex();
  if(!base)throw Error('Aucune base locale active.');
  const record=await getOrFetchTmdbDetail(id);
  record.csv={...(record.csv||{}),rating,watchedDate};
  const existing=base.films.find(f=>f.id===id),t=record.tmdb||{};
  const idx=existing?{...existing,r:rating,w:watchedDate}:{id:record.id,t:record.csv.title,o:t.originalTitle||null,y:record.csv.year,d:t.directors||[],r:rating,w:watchedDate,m:t.runtime||null,g:t.genres||[],p:t.posterPath||null,s:'ok',h:h53(JSON.stringify(record)),c:t.collection?.id??null,cn:t.collection?.name??null};
  const films=existing?base.films.map(f=>f.id===id?idx:f):[...base.films,idx];
  const next={...base,count:films.length,generatedAt:new Date().toISOString(),films:films.sort((x,y)=>x.id.localeCompare(y.id))};
  await window.VideothequeDB.saveChanges({index:next,films:[record],sagas:[]});
  build(next.films);await showDetail(id);
 }catch(err){
  button.disabled=false;button.textContent='Valider';
  $('#personalDialogError').textContent='Enregistrement impossible : '+(err.message||String(err));
 }
});
$('#detail').addEventListener('click',e=>{
 const edit=e.target.closest('.scorebox[data-edit-personal]');
 if(edit){const dialog=$('#personalEditDialog');if(dialog&&!dialog.open)dialog.showModal();return}
 const close=e.target.closest('[data-close-personal]');
 if(close){$('#personalEditDialog')?.close();return}
 const clear=e.target.closest('[data-clear-personal]');
 if(clear){$('#personalRating').value='';$('#personalWatchedDate').value='';$('#personalDialogError').textContent='';return}
 if(e.target.id==='back'){location.hash='';return}
});
$('#detail').addEventListener('keydown',e=>{
 const edit=e.target.closest('.scorebox[data-edit-personal]');
 if(edit&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const dialog=$('#personalEditDialog');if(dialog&&!dialog.open)dialog.showModal()}
});

async function loadKodiSnapshot(){
 try{
  const snapshot=await window.VideothequeDB.getSetting('kodiMovies');
  kodiMoviesSnapshot=Array.isArray(snapshot?.movies)?snapshot.movies:[];
  kodiTmdbIds=new Set(kodiMoviesSnapshot.map(m=>m.tmdbId==null?'':String(m.tmdbId)).filter(Boolean));
  kodiSnapshotSyncedAt=snapshot?.syncedAt||null;
 }catch(error){kodiMoviesSnapshot=[];kodiTmdbIds=new Set();kodiSnapshotSyncedAt=null}
}
let kodiPageQuery='',kodiPageSort='title',kodiPageDirection=1,kodiPageSaga='';
const kodiPosterCache=new Map(),kodiPosterPending=new Set(),kodiSagaByMovie=new Map(),kodiMetaPending=new Map();
let kodiPosterObserver,kodiSagaLoadStarted=false;
function renderKodiSagaOptions(){
 const select=$('#kodiPageSaga');
 if(!select)return;
 const selected=kodiPageSaga;
 const sagas=new Map(),counts=new Map();
 kodiMoviesSnapshot.forEach(movie=>{
  const meta=kodiSagaByMovie.get(String(movie.tmdbId||''));
  if(!meta?.id||!meta?.name)return;
  const id=String(meta.id);
  counts.set(id,(counts.get(id)||0)+1);
  sagas.set(id,meta.name);
 });
 // Ne proposer que les collections représentées par au moins deux films Kodi.
 const eligible=[...sagas].filter(([id])=>(counts.get(id)||0)>=2);
 select.innerHTML='<option value="">Toutes les sagas</option>'+eligible.sort((a,b)=>a[1].localeCompare(b[1],'fr',{sensitivity:'base'})).map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
 select.value=selected;
}
let kodiSagaLoadErrors=0;
async function loadKodiMovieMeta(movie){
 const id=String(movie.tmdbId||'');
 if(!/^\d+$/.test(id)||kodiSagaByMovie.has(id)||kodiMetaPending.has(id))return kodiMetaPending.get(id);
 const task=(async()=>{
  try{
   let tmdb=null;
   const local=ALL.find(f=>String(f.id).replace(/^t/,'')===id);
   if(local){
    const record=await getFilmRecord(local.id);
    tmdb=record.tmdb||null;
   }
   let collection=tmdb?.collection||null;
   if(!collection){
    const cached=await window.VideothequeDB.getSetting('kodiMeta:'+id);
    collection=cached?.collection||null;
   }
   // Une fiche locale ou un cache sans collection ne doit pas empêcher
   // une nouvelle consultation de TMDB.
   if(!collection){
    if(!quickTmdb)await quickTokenState();
    if(quickTmdb){
     const detail=await quickTmdbApi('/movie/'+encodeURIComponent(id),{language:'fr-FR'});
     collection=detail.belongs_to_collection?{id:detail.belongs_to_collection.id,name:detail.belongs_to_collection.name}:null;
     await window.VideothequeDB.setSetting('kodiMeta:'+id,{collection});
    }
   }
   if(collection?.id&&collection?.name)kodiSagaByMovie.set(id,{id:String(collection.id),name:collection.name});
   else kodiSagaByMovie.set(id,null);
  }catch(error){kodiSagaLoadErrors++}
 })();
 kodiMetaPending.set(id,task);
 try{await task}finally{kodiMetaPending.delete(id)}
}
async function loadAllKodiSagaMetadata(){
 if(kodiSagaLoadStarted)return;
 kodiSagaLoadStarted=true;
 const queue=kodiMoviesSnapshot.filter(m=>m.tmdbId&&/^\d+$/.test(String(m.tmdbId)));
 let next=0;
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
  while(next<queue.length){const movie=queue[next++];await loadKodiMovieMeta(movie)}
 }));
 const select=$('#kodiPageSaga'),count=kodiSagaByMovie.size;
 if(select){
  renderKodiSagaOptions();
  select.disabled=false;
  if(select.options.length===1)select.options[0].textContent='Aucune saga identifiée';
 }
 renderKodiMovies();
 const summary=$('#kodiPageCount');
 if(summary&&kodiSagaLoadErrors)summary.textContent+=' · '+kodiSagaLoadErrors+' fiche(s) TMDB non récupérée(s) — vérifie le jeton TMDB ou réessaie';
 else if(summary&&count===0&&queue.length)summary.textContent+=' · Aucune collection TMDB détectée parmi les films identifiés';
}

async function loadKodiPoster(id){
 if(!/^\d+$/.test(String(id))||kodiPosterPending.has(String(id)))return;
 const key=String(id),selector='[data-kodi-poster="'+key+'"]';
 kodiPosterPending.add(key);
 try{
  let path=kodiPosterCache.get(key);
  if(path===undefined){
   path=await window.VideothequeDB.getSetting('kodiPoster:'+key);
   if(path===undefined||path===null){
    const movie=await quickTmdbApi('/movie/'+encodeURIComponent(key),{language:'fr-FR'});
    path=typeof movie.poster_path==='string'&&/^\/[A-Za-z0-9._-]+$/.test(movie.poster_path)?movie.poster_path:'';
    await window.VideothequeDB.setSetting('kodiPoster:'+key,path);
   }
   kodiPosterCache.set(key,path);
  }
  const target=document.querySelector(selector);
  if(target&&path)target.innerHTML='<img loading="lazy" decoding="async" src="https://image.tmdb.org/t/p/w342'+esc(path)+'" alt="">';
 }catch(error){/* L’affiche reste remplacée par les initiales si TMDB est indisponible. */}
 finally{kodiPosterPending.delete(key)}
}
function observeKodiPosters(){
 const elements=document.querySelectorAll('[data-kodi-poster]');
 if(!('IntersectionObserver' in window)){elements.forEach(el=>loadKodiPoster(el.dataset.kodiPoster));return}
 if(kodiPosterObserver)kodiPosterObserver.disconnect();
 kodiPosterObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting){kodiPosterObserver.unobserve(entry.target);loadKodiPoster(entry.target.dataset.kodiPoster)}})
 },{rootMargin:'220px'});
 elements.forEach(el=>kodiPosterObserver.observe(el));
}
function renderKodiMovies(){
 const root=$('#kodiPage'),query=norm(kodiPageQuery.trim());
 const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'fr',{numeric:true,sensitivity:'base'});
 const movies=kodiMoviesSnapshot.filter(m=>{
  if(query&&!norm([m.title,m.year,m.tmdbId].join(' ')).includes(query))return false;
  if(kodiPageSaga&&String(kodiSagaByMovie.get(String(m.tmdbId||''))?.id||'')!==kodiPageSaga)return false;
  return true;
 });
 const localFor=m=>m.tmdbId?ALL.find(f=>String(f.id).replace(/^t/,'')===String(m.tmdbId)):null;
 movies.sort((a,b)=>{
  const la=localFor(a),lb=localFor(b);
  let result=0;
  if(kodiPageSort==='year')result=(Number(a.year)||0)-(Number(b.year)||0);
  else if(kodiPageSort==='playcount')result=(Number(a.playcount)||0)-(Number(b.playcount)||0);
  else if(kodiPageSort==='lastplayed')result=compare(a.lastplayed||'',b.lastplayed||'');
  else if(kodiPageSort==='rating'){
   const av=la?.r==null?null:Number(la.r),bv=lb?.r==null?null:Number(lb.r);
   if(av==null&&bv!=null)return 1;
   if(bv==null&&av!=null)return -1;
   result=av==null?0:av-bv;
  }else if(kodiPageSort==='watched'){
   if(!la?.w&&lb?.w)return 1;
   if(!lb?.w&&la?.w)return -1;
   result=compare(la?.w||'',lb?.w||'');
  }else result=compare(a.title||'',b.title||'');
  return result*kodiPageDirection||compare(a.title||'',b.title||'');
 });
 const cards=movies.map(m=>{
  const tmdbId=String(m.tmdbId||''),local=tmdbId?ALL.find(f=>String(f.id).replace(/^t/,'')===tmdbId):null;
  const poster=local&&local.p?'<img loading="lazy" decoding="async" src="https://image.tmdb.org/t/p/w342'+esc(local.p)+'" alt="">':tmdbId?'<div class="noimg" data-kodi-poster="'+esc(tmdbId)+'">'+esc(String(m.title||'?').slice(0,2))+'</div>':'<div class="noimg">'+esc(String(m.title||'?').slice(0,2))+'</div>';
  const personal=local&&local.r!=null?'<span class="badge personal-rating poster-personal-rating '+rcls(Number(local.r))+'">'+fmtR(local.r)+'<small>/10</small></span>':'';
  const rating=local&&tmdbRatings.has(local.id)?'<span class="badge tmdb">'+fmtR(tmdbRatings.get(local.id))+'</span>':'';
  const watched=local&&local.w?'<span class="poster-date">'+EYE+'<span>Vu le '+fmtD(local.w)+'</span></span>':'';
  const body='<div class="poster">'+poster+rating+personal+watched+'</div><div class="card-heading"><h2>'+esc(m.title||'Titre inconnu')+'</h2></div>'+(m.fileName?'<div class="meta kodi-filename" title="'+esc(m.fileName)+'">'+esc(m.fileName)+'</div>':'')+'<div class="meta">'+(m.year?esc(m.year):'')+'</div>';
  return tmdbId?'<a class="kodi-card" href="'+esc(filmHref('t'+tmdbId,local&&local.t||m.title))+'">'+body+'</a>':'<article class="kodi-card">'+body+'<div class="meta">Identifiant TMDB absent</div></article>';
 }).join('');
 const count=movies.length,empty=kodiMoviesSnapshot.length===0;
 $('#kodiPageCount').textContent=count+' film(s) affiché(s)'+(query?' sur '+kodiMoviesSnapshot.length:'');
 $('#kodiGrid').innerHTML=cards||(empty?'<p class="mute">Aucune liste enregistrée. Lance une comparaison avec Kodi dans Outils pour synchroniser les films présents dans sa bibliothèque.</p>':'<p class="mute">Aucun film ne correspond à cette recherche.</p>');
 observeKodiPosters();
}
function renderKodiPage(){
 document.title='Films sur Kodi · Ma vidéothèque';
 const root=$('#kodiPage');
 const date=kodiSnapshotSyncedAt?new Date(kodiSnapshotSyncedAt).toLocaleString('fr-FR'):'';
 kodiPageQuery='';kodiPageSort='title';kodiPageDirection=1;
 root.innerHTML='<div class="topbar"><button class="btn alt" id="kodiPageBack" type="button">← Ma vidéothèque</button></div><h1>Films présents sur Kodi</h1><p class="mute kodi-page-summary">Dernière synchronisation : '+(date?esc(date):'aucune')+'</p><div class="kodi-page-controls"><input id="kodiPageSearch" type="search" placeholder="Rechercher un film…" aria-label="Rechercher dans les films Kodi"><select id="kodiPageSaga" aria-label="Filtrer par saga" disabled><option value="">Chargement des sagas…</option></select><select id="kodiPageSort" aria-label="Trier les films Kodi"><option value="title">Titre</option><option value="year">Année</option><option value="rating">Note personnelle</option><option value="watched">Date de visionnage</option><option value="playcount">Nombre de lectures Kodi</option><option value="lastplayed">Dernière lecture Kodi</option></select><button class="btn alt sort-direction" id="kodiPageDirection" type="button" aria-label="Inverser l’ordre du tri">↑</button></div><p class="mute kodi-page-count" id="kodiPageCount" aria-live="polite"></p><div id="kodiGrid"></div>';
 $('#kodiPageBack').onclick=()=>{location.hash=''};
 $('#kodiPageSearch').addEventListener('input',e=>{kodiPageQuery=e.target.value;renderKodiMovies()});
 $('#kodiPageSaga').addEventListener('change',e=>{kodiPageSaga=e.target.value;renderKodiMovies()});
 $('#kodiPageSort').addEventListener('change',e=>{kodiPageSort=e.target.value;renderKodiMovies()});
 $('#kodiPageDirection').addEventListener('click',()=>{kodiPageDirection*=-1;$('#kodiPageDirection').textContent=kodiPageDirection===1?'↑':'↓';$('#kodiPageDirection').setAttribute('aria-label',kodiPageDirection===1?'Tri croissant':'Tri décroissant');renderKodiMovies()});
 kodiPageSaga='';renderKodiSagaOptions();renderKodiMovies();loadAllKodiSagaMetadata();
}
function route(){
  const m=location.hash.match(/^#film\/([\w-]+?)(?:-[a-z0-9-]+)?$/i),s=location.hash.match(/^#saga\/(\d+)(?:-[a-z0-9-]+)?$/i),isSt=location.hash==='#stats',isDiscover=location.hash==='#discover'||location.hash.startsWith('#discover?'),isKodi=location.hash==='#kodi',discoverQuery=new URLSearchParams(location.hash.split('?')[1]||''),was=document.body.classList.contains('indetail');
  if(m||s||isSt||isDiscover||isKodi){
    if(!was)gridScroll=window.scrollY;
    document.body.classList.add('indetail');window.scrollTo(0,0);
    $('#detail').classList.toggle('hide',!(m||s));$('#stats').classList.toggle('hide',!isSt);$('#discover').classList.toggle('hide',!isDiscover);$('#kodiPage').classList.toggle('hide',!isKodi);
    if(m)showDetail(m[1]);else if(s)showSaga(s[1]);else if(isSt)showStats();else if(isDiscover)showDiscover(discoverQuery.get('keyword'),discoverQuery.get('name'));else renderKodiPage();
  }else{
    document.body.classList.remove('indetail');$('#detail').classList.add('hide');$('#stats').classList.add('hide');$('#discover').classList.add('hide');$('#kodiPage').classList.add('hide');document.title='Ma vidéothèque';
    if(was)window.scrollTo(0,gridScroll);
  }
}
window.addEventListener('hashchange',route);

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


let quickTmdb='',searchTimer=null,searchSequence=0,searchBusy=false;
async function quickTokenState(){try{quickTmdb=await window.VideothequeDB.getSetting('tmdbToken')||''}catch(e){quickTmdb=''}$('#tmdbMissingAlert').hidden=!!quickTmdb;return !!quickTmdb}
async function quickTmdbApi(path,params={}){return window.VideothequeTMDB.request(quickTmdb,path,params)}

const DISCOVER_SORTS=[
 ['vote_average.desc','Note TMDB décroissante'],['vote_average.asc','Note TMDB croissante'],
 ['popularity.desc','Popularité décroissante'],['popularity.asc','Popularité croissante'],
 ['vote_count.desc','Nombre de votes décroissant'],['vote_count.asc','Nombre de votes croissant'],
 ['primary_release_date.desc','Date de sortie, plus récente'],['primary_release_date.asc','Date de sortie, plus ancienne'],
 ['revenue.desc','Revenus décroissants'],['revenue.asc','Revenus croissants'],['original_title.asc','Titre alphabétique']
];
let discoverInitialized=false,discoverPage=1,discoverBusy=false,discoverSequence=0,discoverItems=[],discoverTotal=0,discoverMetaReady=false,discoverKeywordIds=[];
function renderDiscoverShell(){
 $('#discover').innerHTML='<div class="topbar"><button class="btn alt" id="discoverBack" type="button">← Ma vidéothèque</button></div><h1>Découvrir</h1><p class="discover-intro">Compose librement ta recherche parmi les critères TMDB. Les films de ta vidéothèque sont signalés ; tu peux masquer ceux que tu as déjà vus. Seuls les films ayant au moins 500 votes sont proposés.</p><div class="discover-filters"><label class="discover-field">Genre <select id="discoverGenres" aria-label="Genre"><option value="">Tous les genres</option></select></label><div class="discover-field wide"><span>Mots-clés TMDB</span><div class="discover-keyword"><input id="discoverKeywordQuery" type="search" placeholder="Rechercher un mot-clé"><button class="btn alt" id="discoverKeywordSearch" type="button">Rechercher</button></div><div id="discoverKeywordResults"></div><div id="discoverKeywords"></div></div><label class="discover-field wide">Trier les résultats <select id="discoverSort">'+DISCOVER_SORTS.map(x=>'<option value="'+x[0]+'">'+esc(x[1])+'</option>').join('')+'</select></label></div><div class="discover-actions"><button id="discoverSearch" class="btn" type="button">Rechercher les films</button><button id="discoverReset" class="btn alt" type="button">Réinitialiser</button><button id="discoverHideWatched" class="btn alt" type="button" aria-pressed="false">Masquer les films vus</button></div><div id="discoverStatus" role="status" aria-live="polite">Préparation…</div><div id="discoverGrid"></div><button id="discoverMore" class="btn alt hide" type="button">Afficher plus</button>';
 refreshDiscoverWatchedIds();
 $('#discoverBack').addEventListener('click',()=>{location.hash=''});
 $('#discoverSearch').addEventListener('click',()=>loadDiscover(true));
 $('#discoverReset').addEventListener('click',resetDiscoverFilters);
 $('#discoverSort').addEventListener('change',()=>loadDiscover(true));
 $('#discoverKeywordSearch').addEventListener('click',searchDiscoverKeywords);
 $('#discoverKeywordQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchDiscoverKeywords()}});
 $('#discoverHideWatched').addEventListener('click',()=>{
  discoverHideWatched=!discoverHideWatched;
  const button=$('#discoverHideWatched');
  button.setAttribute('aria-pressed',String(discoverHideWatched));
  button.textContent=discoverHideWatched?'Afficher les films vus':'Masquer les films vus';
  renderDiscoverResults();
 });
 $('#discoverMore').addEventListener('click',()=>loadDiscover(false));
 loadDiscoverMetadata();
}
let discoverHideWatched=false,discoverPendingKeyword=null;
const discoverWatchedIds=new Set();
function refreshDiscoverWatchedIds(){
 discoverWatchedIds.clear();
 ALL.filter(f=>f.w).forEach(f=>{const id=String(f.id||'').replace(/^t/,'');if(id)discoverWatchedIds.add(id)});
}
function discoverOptions(selectId,items,valueFn,labelFn){
 $(selectId).innerHTML=items.map(item=>'<option value="'+esc(String(valueFn(item)))+'">'+esc(String(labelFn(item)))+'</option>').join('');
}
async function loadDiscoverMetadata(){
 const status=$('#discoverStatus');
 try{
  if(!await quickTokenState())throw Error('Configure ton jeton TMDB dans Outils → Jeton TMDB pour utiliser Découvrir.');
  const genres=await quickTmdbApi('/genre/movie/list',{language:'fr-FR'});
  discoverOptions('#discoverGenres',genres.genres||[],x=>x.id,x=>x.name);
  $('#discoverGenres').insertAdjacentHTML('afterbegin','<option value="">Tous les genres</option>');
  discoverMetaReady=true;
  if(discoverPendingKeyword){discoverKeywordIds=[discoverPendingKeyword];discoverPendingKeyword=null;renderDiscoverKeywords();loadDiscover(true)}else status.textContent='Choisis tes critères puis lance la recherche.';
 }catch(error){status.className='bad';status.textContent=error.message||String(error)}
}
async function searchDiscoverKeywords(){
 const query=$('#discoverKeywordQuery').value.trim(),target=$('#discoverKeywordResults');target.innerHTML='';
 if(!query)return;
 try{
  const data=await quickTmdbApi('/search/keyword',{query,page:'1'});
  const results=(data.results||[]).slice(0,8).filter(x=>!discoverKeywordIds.some(k=>k.id===x.id));
  target.innerHTML=results.length?results.map(x=>'<button class="discover-keyword-result" type="button" data-keyword-id="'+Number(x.id)+'" data-keyword-name="'+esc(x.name)+'">'+esc(x.name)+'</button>').join(''):'<small class="mute">Aucun mot-clé trouvé.</small>';
 }catch(error){target.textContent=error.message||String(error)}
}
function renderDiscoverKeywords(){
 $('#discoverKeywords').innerHTML=discoverKeywordIds.map(x=>'<span class="discover-keyword-chip">'+esc(x.name)+' <button type="button" aria-label="Retirer '+esc(x.name)+'" data-remove-keyword="'+x.id+'">×</button></span>').join('');
}
$('#discover').addEventListener('click',e=>{
 const add=e.target.closest('[data-keyword-id]');
 if(add){const id=Number(add.dataset.keywordId);if(Number.isSafeInteger(id)&&id>0&&!discoverKeywordIds.some(x=>x.id===id))discoverKeywordIds.push({id,name:add.dataset.keywordName});$('#discoverKeywordResults').innerHTML='';$('#discoverKeywordQuery').value='';renderDiscoverKeywords();return}
 const remove=e.target.closest('[data-remove-keyword]');
 if(remove){discoverKeywordIds=discoverKeywordIds.filter(x=>x.id!==Number(remove.dataset.removeKeyword));renderDiscoverKeywords()}
});
function resetDiscoverFilters(){
 Array.from($('#discoverGenres').options).forEach(o=>o.selected=false);
 $('#discoverSort').value='vote_average.desc';$('#discoverKeywordQuery').value='';$('#discoverKeywordResults').innerHTML='';discoverKeywordIds=[];renderDiscoverKeywords();loadDiscover(true);
}
function discoverSelected(id){return Array.from($(id).selectedOptions).map(o=>o.value).filter(Boolean)}
function discoverParams(){
 const params={language:'fr-FR',include_adult:'false',sort_by:$('#discoverSort').value,'vote_count.gte':'500',page:String(discoverPage)};
 const genre=$('#discoverGenres').value;
 if(genre)params.with_genres=genre;
 if(discoverKeywordIds.length)params.with_keywords=discoverKeywordIds.map(x=>x.id).join(',');
 return params;
}
function discoverCard(movie){
 const id=Number(movie.id),title=movie.title||movie.original_title||'Film sans titre',year=(movie.release_date||'').slice(0,4),rating=Number(movie.vote_average),votes=Number(movie.vote_count)||0;
 const libraryFilm=ALL.find(f=>String(f.id)==='t'+id),inLibrary=!!libraryFilm,poster=movie.poster_path?'<img loading="lazy" decoding="async" src="https://image.tmdb.org/t/p/w342'+esc(movie.poster_path)+'" alt="">':'<div class="noimg">'+esc(title.slice(0,2))+'</div>';
 const personalRating=libraryFilm&&libraryFilm.r!=null?'<span class="badge personal-rating poster-personal-rating '+rcls(Number(libraryFilm.r))+'" title="Ma note : '+fmtR(libraryFilm.r)+' / 10">'+fmtR(libraryFilm.r)+'<small>/10</small></span>':'';
 return '<a class="card" href="'+esc(filmHref('t'+id,title))+'"><div class="poster">'+poster+(Number.isFinite(rating)?'<span class="badge tmdb">'+rating.toFixed(1).replace('.',',')+'</span>':'')+personalRating+(kodiTmdbIds.has(String(id))?KODI_ICON:'')+'</div><div class="card-heading"><h2>'+esc(title)+'</h2></div><div class="meta">'+esc(year||'Année inconnue')+' · '+votes.toLocaleString('fr-FR')+' votes</div>'+(inLibrary?'<div class="discover-library">Dans ma vidéothèque</div>':'')+'</a>';
}
function renderDiscoverResults(){
 const visible=discoverHideWatched?discoverItems.filter(movie=>!discoverWatchedIds.has(String(movie.id))):discoverItems;
 $('#discoverGrid').innerHTML=visible.map(discoverCard).join('');
 const hidden=discoverItems.length-visible.length,total=discoverTotal||discoverItems.length;
 $('#discoverStatus').textContent=visible.length+' film(s) affiché(s) sur '+total.toLocaleString('fr-FR')+(hidden?' · '+hidden+' film(s) déjà vu(s) masqué(s)':'')+' · au moins 500 votes';
}
async function loadDiscover(reset){
 if(discoverBusy)return;
 if(reset){discoverPage=1;discoverItems=[];discoverTotal=0;discoverSequence++;$('#discoverGrid').innerHTML='';$('#discoverMore').classList.add('hide')}
 const seq=discoverSequence;discoverBusy=true;
 const status=$('#discoverStatus'),more=$('#discoverMore');
 status.className='';status.textContent=reset?'Recherche TMDB…':'Chargement de la suite…';more.disabled=true;
 $('#discoverSearch').disabled=true;$('#discoverReset').disabled=true;$('#discoverMore').disabled=true;
 try{
  if(!await quickTokenState())throw Error('Configure ton jeton TMDB dans Outils → Jeton TMDB pour utiliser Découvrir.');
  if(!discoverMetaReady)throw Error('Les filtres TMDB ne sont pas encore chargés. Réessaie dans un instant.');
  const data=await quickTmdbApi('/discover/movie',discoverParams());
  if(seq!==discoverSequence)return;
  const results=Array.isArray(data.results)?data.results:[];
  discoverItems.push(...results);discoverTotal=Number(data.total_results)||discoverItems.length;
  renderDiscoverResults();discoverPage++;
  more.classList.toggle('hide',discoverPage>Math.min(Number(data.total_pages)||1,500)||!results.length);
 }catch(error){if(seq===discoverSequence){status.className='bad';status.textContent=error.message||String(error)}}
 finally{if(seq===discoverSequence){discoverBusy=false;more.disabled=false;$('#discoverSearch').disabled=false;$('#discoverReset').disabled=false}}
}
function showDiscover(keywordId,keywordName){
 document.title='Découvrir · Ma vidéothèque';
 if(!discoverInitialized){discoverInitialized=true;renderDiscoverShell()}
 const id=String(keywordId||'').trim();
 if(/^\d+$/.test(id)){
  const keyword={id:Number(id),name:keywordName||'Mot-clé TMDB'};
  if(discoverMetaReady){discoverKeywordIds=[keyword];renderDiscoverKeywords();loadDiscover(true)}else discoverPendingKeyword=keyword;
 }
}
function searchStatus(message,kind=''){const el=$('#tmdbSearchStatus');el.textContent=message;el.className='mute '+kind}
function renderSearchResults(hits){$('#tmdbSearchResults').innerHTML=hits.map(x=>'<button class="tmdb-result" type="button" data-tmdb-movie="'+Number(x.id)+'" data-tmdb-title="'+esc(x.title||x.original_title||'Film')+'">'+(x.poster_path?'<img alt="" loading="lazy" src="https://image.tmdb.org/t/p/w185'+esc(x.poster_path)+'">':'<div></div>')+'<span><b>'+esc(x.title||x.original_title||'Film sans titre')+'</b><p>'+esc((x.release_date||'').slice(0,4)||'Année inconnue')+' · '+esc((x.overview||'').slice(0,120))+'</p><small>Voir le détail</small></span></button>').join('')}
const SEARCH_CACHE_KEY='tmdbSearchCache',SEARCH_CACHE_TTL=7*24*60*60*1000,SEARCH_CACHE_LIMIT=50;
function normalizeSearchKey(q){return String(q||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
async function readSearchCache(){try{return await window.VideothequeDB.getSetting(SEARCH_CACHE_KEY)||{}}catch(e){return {}}}
async function writeSearchCache(cache){try{const entries=Object.entries(cache).sort((a,b)=>(b[1]?.savedAt||0)-(a[1]?.savedAt||0)).slice(0,SEARCH_CACHE_LIMIT);await window.VideothequeDB.setSetting(SEARCH_CACHE_KEY,Object.fromEntries(entries))}catch(e){/* Le cache ne doit jamais bloquer une recherche TMDB. */}}
async function searchTmdb(){const q=$('#q').value.trim(),seq=++searchSequence;$('#tmdbSearchResults').innerHTML='';if(!q){searchStatus('');$('#tmdbSearchResults').classList.add('hide');$('#grid').classList.remove('hide');$('#more').classList.toggle('hide',shown>=view.length);return}$('#grid').classList.add('hide');$('#more').classList.add('hide');$('#tmdbSearchResults').classList.remove('hide');if(!await quickTokenState()){searchStatus('Configure ton jeton TMDB dans Outils pour rechercher.','bad');return}const key=normalizeSearchKey(q);if(!key)return;try{const cache=await readSearchCache(),entry=cache[key],now=Date.now();if(entry&&Array.isArray(entry.results)&&now-entry.savedAt<SEARCH_CACHE_TTL){if(seq!==searchSequence)return;const hits=entry.results;renderSearchResults(hits);searchStatus(hits.length?'Résultats réutilisés depuis le cache. Sélectionne un film pour voir son détail.':'Aucun résultat (recherche en cache).');return}if(entry){delete cache[key];await writeSearchCache(cache)}searchStatus('Recherche TMDB…');const data=await quickTmdbApi('/search/movie',{query:q,language:'fr-FR',include_adult:'false'});if(seq!==searchSequence)return;const hits=(data.results||[]).slice(0,10);cache[key]={savedAt:Date.now(),results:hits};await writeSearchCache(cache);if(seq!==searchSequence)return;if(!hits.length){searchStatus('Aucun résultat TMDB.');return}renderSearchResults(hits);searchStatus('Sélectionne un résultat pour voir son détail.')}catch(e){if(seq===searchSequence)searchStatus(e.message||String(e),'bad')}}
$('#q').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchTmdb,350)});
$('#q').addEventListener('search',()=>{clearTimeout(searchTimer);searchTmdb()});
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(searchTimer);searchTmdb()}});
$('#tmdbSearchResults').addEventListener('click',e=>{const button=e.target.closest('[data-tmdb-movie]');if(button){const id=Number(button.dataset.tmdbMovie);if(Number.isSafeInteger(id)&&id>0)location.hash=filmHref('t'+id,button.dataset.tmdbTitle)}});
quickTokenState();
function shape(d){const crew=(d.credits||{}).crew||[],uniq=a=>[...new Set(a)],by=(...jobs)=>uniq(crew.filter(x=>jobs.includes(x.job)).map(x=>x.name));const rd=(d.release_dates||{}).results||[];const cert=c=>{const x=rd.find(r=>r.iso_3166_1===c),y=x&&(x.release_dates||[]).find(z=>z.certification);return y?y.certification:null};const ext=d.external_ids||{};return {tmdbId:d.id,imdbId:d.imdb_id||ext.imdb_id||null,wikidataId:ext.wikidata_id||null,title:d.title,originalTitle:d.original_title,altTitles:[...new Set(((d.alternative_titles||{}).titles||[]).map(x=>x.title))],tagline:d.tagline||'',overview:d.overview||'',overviewLang:d.overviewLang||'fr',releaseDate:d.release_date||null,runtime:d.runtime||null,status:d.status||null,genres:(d.genres||[]).map(g=>g.name),genreIds:(d.genres||[]).map(g=>g.id),countries:(d.production_countries||[]).map(x=>x.name),originCountry:d.origin_country||[],languages:(d.spoken_languages||[]).map(x=>x.name||x.english_name),originalLanguage:d.original_language,directors:by('Director'),directorIds:uniq(crew.filter(x=>x.job==='Director').map(x=>x.id)),writers:by('Screenplay','Writer','Novel'),composers:by('Original Music Composer'),cinematographers:by('Director of Photography'),editors:by('Editor'),producers:by('Producer'),cast:((d.credits||{}).cast||[]).slice(0,15).map(x=>({id:x.id,name:x.name,character:x.character,profilePath:x.profile_path||null})),companies:(d.production_companies||[]).map(x=>x.name),collection:d.belongs_to_collection?{id:d.belongs_to_collection.id,name:d.belongs_to_collection.name}:null,keywords:((d.keywords||{}).keywords||[]).map(x=>x.name),certificationFR:cert('FR'),certificationUS:cert('US'),budget:d.budget||null,revenue:d.revenue||null,popularity:d.popularity,voteAverage:d.vote_average,voteCount:d.vote_count,adult:!!d.adult,posterPath:d.poster_path,backdropPath:d.backdrop_path,homepage:d.homepage||null,social:{facebook:ext.facebook_id||null,instagram:ext.instagram_id||null,twitter:ext.twitter_id||null}}}
function buildExtra(d){const A=x=>Array.isArray(x)?x:[],pick=(o,ks)=>{const r={};ks.forEach(k=>{if(o[k]!==undefined)r[k]=o[k]});return r};const im=d.images||{},ik=['file_path','width','height','iso_639_1','vote_average','vote_count'],mk=['id','title','original_title','release_date','poster_path','vote_average','genre_ids','original_language'];return {credits:{cast:A((d.credits||{}).cast).map(x=>pick(x,['id','name','original_name','character','order','gender','known_for_department','profile_path'])),crew:A((d.credits||{}).crew).map(x=>pick(x,['id','name','original_name','job','department','gender','profile_path']))},alternativeTitles:A((d.alternative_titles||{}).titles),externalIds:d.external_ids||{},keywords:A((d.keywords||{}).keywords),releaseDates:A((d.release_dates||{}).results),translations:A((d.translations||{}).translations).map(t=>({iso_639_1:t.iso_639_1,iso_3166_1:t.iso_3166_1,name:t.name,english_name:t.english_name,title:(t.data||{}).title||'',overview:(t.data||{}).overview||'',tagline:(t.data||{}).tagline||''})).filter(t=>t.title||t.overview||t.tagline),videos:A((d.videos||{}).results).map(x=>pick(x,['key','site','type','name','iso_639_1','official','published_at','size'])),images:{posters:A(im.posters).slice(0,40).map(x=>pick(x,ik)),backdrops:A(im.backdrops).slice(0,40).map(x=>pick(x,ik)),logos:A(im.logos).slice(0,20).map(x=>pick(x,ik))},recommendations:A((d.recommendations||{}).results).slice(0,20).map(x=>pick(x,mk)),similar:A((d.similar||{}).results).slice(0,20).map(x=>pick(x,mk)),watchProviders:(d['watch/providers']||{}).results||{},reviews:A((d.reviews||{}).results).slice(0,5).map(x=>({author:x.author,rating:(x.author_details||{}).rating??null,created_at:x.created_at,url:x.url,content:(x.content||'').slice(0,3000)})),belongsToCollection:d.belongs_to_collection||null,productionCompanies:A(d.production_companies),productionCountries:A(d.production_countries),spokenLanguages:A(d.spoken_languages),genres:A(d.genres)}}
function fitExtra(x){const big=()=>JSON.stringify(x).length>230000;const trims=[()=>{x.images.posters.length=Math.min(x.images.posters.length,15);x.images.backdrops.length=Math.min(x.images.backdrops.length,15);x.images.logos.length=Math.min(x.images.logos.length,5)},()=>{x.reviews=x.reviews.slice(0,2)},()=>{x.similar=x.similar.slice(0,8);x.recommendations=x.recommendations.slice(0,8)},()=>{x.credits.crew=x.credits.crew.slice(0,150)},()=>{x.credits.cast=x.credits.cast.slice(0,100)},()=>{x.translations=x.translations.filter(t=>t.iso_639_1==='fr'||t.iso_639_1==='en')}];for(const t of trims){if(!big())break;t()}return x}
function h53(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)}