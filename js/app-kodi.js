async function loadKodiSnapshot(){
 try{
  const snapshot=await window.VideothequeDB.getSetting('kodiMovies');
  kodiMoviesSnapshot=Array.isArray(snapshot?.movies)?snapshot.movies:[];
  kodiTmdbIds=new Set(kodiMoviesSnapshot.map(m=>m.tmdbId==null?'':String(m.tmdbId)).filter(Boolean));
  kodiSnapshotSyncedAt=snapshot?.syncedAt||null;
 }catch(error){kodiMoviesSnapshot=[];kodiTmdbIds=new Set();kodiSnapshotSyncedAt=null}
}
let kodiPageQuery='',kodiPageSort='title',kodiPageDirection=1,kodiPageSaga='';
let kodiPrimeFilter=false,kodiPrimeLoading=false,kodiPrimeProgress={done:0,total:0,errors:0},kodiPrimeRun=0;
const kodiPrimeAvailability=new Map(),KODI_PRIME_CACHE_TTL=7*24*60*60*1000;
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
async function loadKodiPrimeAvailability(){
 const run=++kodiPrimeRun,ids=[...new Set(kodiMoviesSnapshot.map(m=>String(m.tmdbId||'')).filter(id=>/^\\d+$/.test(id)))];
 kodiPrimeLoading=true;kodiPrimeProgress={done:0,total:ids.length,errors:0};
 const status=$('#kodiPrimeStatus');
 if(status)status.textContent='Préparation du filtre Prime Video…';
 try{
  if(!await quickTokenState())throw new Error('Configure ton jeton TMDB dans Outils → Jeton TMDB pour vérifier les disponibilités Prime Video.');
  const now=Date.now(),pending=[];
  await Promise.all(ids.map(async id=>{
   try{
    const cached=await window.VideothequeDB.getSetting('kodiPrimeFR:'+id);
    if(cached&&typeof cached.available==='boolean'&&Number.isFinite(cached.checkedAt)&&now-cached.checkedAt<KODI_PRIME_CACHE_TTL){kodiPrimeAvailability.set(id,cached.available);kodiPrimeProgress.done++;}
    else pending.push(id);
   }catch(error){pending.push(id)}
  }));
  renderKodiMovies();
  let next=0;
  await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
   while(next<pending.length&&run===kodiPrimeRun){
    const id=pending[next++];
    try{
     const data=await quickTmdbApi('/movie/'+encodeURIComponent(id)+'/watch/providers');
     const providers=data?.results?.FR?.flatrate||[];
     const available=providers.some(provider=>/^(?:amazon )?prime video$/i.test(String(provider.provider_name||'').trim()));
     kodiPrimeAvailability.set(id,available);
     await window.VideothequeDB.setSetting('kodiPrimeFR:'+id,{available,checkedAt:Date.now()});
    }catch(error){kodiPrimeProgress.errors++}
    kodiPrimeProgress.done++;
    if(run===kodiPrimeRun){if(status)status.textContent='Vérification Prime Video : '+kodiPrimeProgress.done+' / '+kodiPrimeProgress.total+' films';renderKodiMovies()}
   }
  }));
 }catch(error){if(run===kodiPrimeRun&&status)status.textContent=error.message||String(error)}
 finally{
  if(run===kodiPrimeRun){
   kodiPrimeLoading=false;
   if(status){const found=ids.filter(id=>kodiPrimeAvailability.get(id)===true).length;status.textContent=kodiPrimeProgress.errors?found+' film(s) Prime Video confirmé(s) · '+kodiPrimeProgress.errors+' disponibilité(s) non vérifiée(s) — désactive puis réactive le filtre pour réessayer':found+' film(s) inclus dans Prime Video France'}
   renderKodiMovies();
  }
 }
}
function renderKodiMovies(){
 const root=$('#kodiPage'),query=norm(kodiPageQuery.trim());
 const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'fr',{numeric:true,sensitivity:'base'});
 const movies=kodiMoviesSnapshot.filter(m=>{
  if(query&&!norm([m.title,m.year,m.tmdbId].join(' ')).includes(query))return false;
  if(kodiPageSaga&&String(kodiSagaByMovie.get(String(m.tmdbId||''))?.id||'')!==kodiPageSaga)return false;
  if(kodiPrimeFilter&&kodiPrimeAvailability.get(String(m.tmdbId||''))!==true)return false;
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
 $('#kodiPageCount').textContent=count+' film(s) affiché(s)'+(query?' sur '+kodiMoviesSnapshot.length:'')+(kodiPrimeFilter&&kodiPrimeLoading?' · vérification Prime en cours':'');
 $('#kodiGrid').innerHTML=cards||(empty?'<p class="mute">Aucune liste enregistrée. Lance une comparaison avec Kodi dans Outils pour synchroniser les films présents dans sa bibliothèque.</p>':'<p class="mute">Aucun film ne correspond à cette recherche.</p>');
 observeKodiPosters();
}
function renderKodiPage(){
 document.title='Films sur Kodi · Ma vidéothèque';
 const root=$('#kodiPage');
 const date=kodiSnapshotSyncedAt?new Date(kodiSnapshotSyncedAt).toLocaleString('fr-FR'):'';
 kodiPageQuery='';kodiPageSort='title';kodiPageDirection=1;
 root.innerHTML='<div class="topbar"><button class="btn alt" id="kodiPageBack" type="button">← Ma vidéothèque</button></div><h1>Films présents sur Kodi</h1><p class="mute kodi-page-summary">Dernière synchronisation : '+(date?esc(date):'aucune')+'</p><div class="kodi-page-controls"><input id="kodiPageSearch" type="search" placeholder="Rechercher un film…" aria-label="Rechercher dans les films Kodi"><select id="kodiPageSaga" aria-label="Filtrer par saga" disabled><option value="">Chargement des sagas…</option></select><select id="kodiPageSort" aria-label="Trier les films Kodi"><option value="title">Titre</option><option value="year">Année</option><option value="rating">Note personnelle</option><option value="watched">Date de visionnage</option><option value="playcount">Nombre de lectures Kodi</option><option value="lastplayed">Dernière lecture Kodi</option></select><button class="btn alt sort-direction" id="kodiPageDirection" type="button" aria-label="Inverser l’ordre du tri">↑</button></div><p class="mute kodi-page-count" id="kodiPageCount" aria-live="polite"></p><label class="kodi-prime-filter"><input id="kodiPrimeFilter" type="checkbox"><span>Disponible dans l’abonnement Prime Video (France)</span></label><p class="mute kodi-prime-status" id="kodiPrimeStatus" role="status" aria-live="polite"></p><div id="kodiGrid"></div>';
 $('#kodiPageBack').onclick=()=>{location.hash=''};
 $('#kodiPageSearch').addEventListener('input',e=>{kodiPageQuery=e.target.value;renderKodiMovies()});
 $('#kodiPageSaga').addEventListener('change',e=>{kodiPageSaga=e.target.value;renderKodiMovies()});
 $('#kodiPageSort').addEventListener('change',e=>{kodiPageSort=e.target.value;renderKodiMovies()});
 $('#kodiPrimeFilter').addEventListener('change',e=>{kodiPrimeFilter=e.target.checked;if(kodiPrimeFilter){renderKodiMovies();loadKodiPrimeAvailability()}else{++kodiPrimeRun;kodiPrimeLoading=false;$('#kodiPrimeStatus').textContent='';renderKodiMovies()}});
 $('#kodiPageDirection').addEventListener('click',()=>{kodiPageDirection*=-1;$('#kodiPageDirection').textContent=kodiPageDirection===1?'↑':'↓';$('#kodiPageDirection').setAttribute('aria-label',kodiPageDirection===1?'Tri croissant':'Tri décroissant');renderKodiMovies()});
 kodiPageSaga='';kodiPrimeFilter=false;kodiPrimeLoading=false;++kodiPrimeRun;renderKodiSagaOptions();renderKodiMovies();loadAllKodiSagaMetadata();
}
let restoringHistoryNavigation=false,routeSequence=0;
if('scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('scroll',()=>{
  history.replaceState({...history.state,vtScrollY:window.scrollY},'',location.href);
},{passive:true});
window.addEventListener('popstate',()=>{restoringHistoryNavigation=true});
function route(){
  const sequence=++routeSequence;
  const m=location.hash.match(/^#film\/([\w-]+?)(?:-[a-z0-9-]+)?$/i),s=location.hash.match(/^#saga\/(\d+)(?:-[a-z0-9-]+)?$/i),isSt=location.hash==='#stats',isDiscover=location.hash==='#discover'||location.hash.startsWith('#discover?'),isKodi=location.hash==='#kodi',discoverQuery=new URLSearchParams(location.hash.split('?')[1]||''),was=document.body.classList.contains('indetail');
  const fromHistory=restoringHistoryNavigation;
  restoringHistoryNavigation=false;
  let pageTask=null,restoreY=0;
  if(m||s||isSt||isDiscover||isKodi){
    if(!was)gridScroll=window.scrollY;
    restoreY=fromHistory?Math.max(0,Number(history.state&&history.state.vtScrollY)||0):0;
    document.body.classList.add('indetail');
    $('#detail').classList.toggle('hide',!(m||s));$('#stats').classList.toggle('hide',!isSt);$('#discover').classList.toggle('hide',!isDiscover);$('#kodiPage').classList.toggle('hide',!isKodi);
    if(m)pageTask=showDetail(m[1]);else if(s)pageTask=showSaga(s[1]);else if(isSt)pageTask=showStats();else if(isDiscover)pageTask=showDiscover(discoverQuery.get('keyword'),discoverQuery.get('name'));else pageTask=renderKodiPage();
    window.scrollTo(0,0);
  }else{
    document.body.classList.remove('indetail');$('#detail').classList.add('hide');$('#stats').classList.add('hide');$('#discover').classList.add('hide');$('#kodiPage').classList.add('hide');document.title='Ma vidéothèque';
    restoreY=fromHistory?Math.max(0,Number(history.state&&history.state.vtScrollY)||0):(was?gridScroll:0);
  }
  return Promise.resolve(pageTask).catch(e=>console.error('Erreur de navigation',e)).then(()=>{
    if(sequence!==routeSequence)return;
    window.scrollTo(0,restoreY);
    document.documentElement.classList.remove('app-booting');
  });
}
window.addEventListener('hashchange',route);
window.addEventListener('hashchange',route);
