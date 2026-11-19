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
