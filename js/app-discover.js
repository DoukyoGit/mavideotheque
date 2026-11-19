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
