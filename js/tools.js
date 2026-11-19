'use strict';
const {$,esc,isValidTmdbToken}=window.VideothequeCommon;
try{localStorage.removeItem('mavideotheque_github_token');localStorage.removeItem('mavideotheque_tmdb_token')}catch(e){}

function setStatus(el,msg,cls=''){el.textContent=msg;el.className=cls||'mute'}
async function saveToken(){
 const value=$('#token').value.trim();
 if(!value){setStatus($('#tokenState'),'Colle d’abord ton jeton TMDB Read Access Token.','bad');return}
 if(!isValidTmdbToken(value)){setStatus($('#tokenState'),'Le jeton contient des caractères non autorisés (espace, retour à la ligne ou caractère invisible). Recopie le Read Access Token directement depuis TMDB.','bad');return}
 if(value.length<40){setStatus($('#tokenState'),'Le jeton semble trop court. Utilise le Read Access Token, pas la clé API v3.','bad');return}
 $('#saveToken').disabled=true;
 try{await window.VideothequeDB.setSetting('tmdbToken',value);setStatus($('#tokenState'),'Jeton TMDB enregistré dans IndexedDB sur cet appareil.','good')}
 catch(e){setStatus($('#tokenState'),'Impossible d’enregistrer le jeton : '+e.message,'bad')}
 finally{$('#saveToken').disabled=false}
}
async function restoreTokens(){
 try{const value=await window.VideothequeDB.getSetting('tmdbToken');if(value){$('#token').value=value;setStatus($('#tokenState'),'Jeton TMDB chargé depuis IndexedDB.','good')}else setStatus($('#tokenState'),'Aucun jeton enregistré dans IndexedDB.','')}
 catch(e){setStatus($('#tokenState'),'Impossible de lire le jeton local : '+e.message,'bad')}
}
async function clearToken(){
 $('#clearToken').disabled=true;
 try{await window.VideothequeDB.deleteSetting('tmdbToken');$('#token').value='';setStatus($('#tokenState'),'Jeton TMDB effacé de la base IndexedDB.','good')}
 catch(e){setStatus($('#tokenState'),'Impossible d’effacer le jeton : '+e.message,'bad')}
 finally{$('#clearToken').disabled=false}
}

function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000)}
let kodiSocket=null,kodiRequestId=0,kodiPending=new Map(),kodiBusy=false;
function kodiSetStatus(id,message,kind=''){const el=$('#'+id);el.classList.remove('hide');el.className='status'+(kind?' '+kind:'');el.textContent=message}
async function restoreKodiIp(){
 try{
  const saved=await window.VideothequeDB.getSetting('kodiIp');
  if(saved){$('#kodiHost').value=saved;kodiSetStatus('kodiIpState','Adresse Kodi chargée depuis IndexedDB.','good')}
  else kodiSetStatus('kodiIpState','Aucune adresse Kodi enregistrée.','');
 }catch(e){kodiSetStatus('kodiIpState','Impossible de lire l’adresse Kodi : '+e.message,'bad')}
}
async function saveKodiIp(){
 try{
  const address=kodiAddress();
  $('#saveKodiIp').disabled=true;
  await window.VideothequeDB.setSetting('kodiIp',address.host);
  kodiSetStatus('kodiIpState','Adresse Kodi enregistrée dans IndexedDB sur cet appareil.','good');
 }catch(e){kodiSetStatus('kodiIpState','Impossible d’enregistrer l’adresse : '+e.message,'bad')}
 finally{$('#saveKodiIp').disabled=false}
}
async function clearKodiIp(){
 $('#clearKodiIp').disabled=true;
 try{
  await window.VideothequeDB.deleteSetting('kodiIp');
  $('#kodiHost').value='';
  kodiSetStatus('kodiIpState','Adresse Kodi effacée de la base IndexedDB.','good');
 }catch(e){kodiSetStatus('kodiIpState','Impossible d’effacer l’adresse : '+e.message,'bad')}
 finally{$('#clearKodiIp').disabled=false}
}
function kodiAddress(){const host=$('#kodiHost').value.trim().replace(/^https?:\/\//i,'').replace(/\/.*$/,'');if(!host||/[\s/?#@]/.test(host))throw new Error('Saisis une adresse IP ou un nom d’hôte valide.');const port=Number($('#kodiPort').value);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Le port doit être compris entre 1 et 65535.');return {host,port,url:'ws://'+host+':'+port+'/jsonrpc'}}
function kodiDisconnect(){if(kodiSocket){try{kodiSocket.close()}catch{}}kodiSocket=null;for(const [,p] of kodiPending)p.reject(new Error('Connexion Kodi interrompue.'));kodiPending.clear()}
function kodiRpc(method,params={}){return new Promise((resolve,reject)=>{if(!kodiSocket||kodiSocket.readyState!==WebSocket.OPEN){reject(new Error('Aucune connexion Kodi active.'));return}const id=++kodiRequestId,timer=setTimeout(()=>{kodiPending.delete(id);reject(new Error('Kodi ne répond pas à '+method+'.'))},15000);kodiPending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});try{kodiSocket.send(JSON.stringify({jsonrpc:'2.0',id,method,params}))}catch(e){clearTimeout(timer);kodiPending.delete(id);reject(e)}})}
async function kodiConnect(){const {url}=kodiAddress();kodiDisconnect();return new Promise((resolve,reject)=>{let settled=false;const fail=e=>{if(settled)return;settled=true;kodiDisconnect();reject(e)};try{kodiSocket=new WebSocket(url)}catch(e){reject(new Error('Impossible de démarrer la connexion : '+e.message));return}const timer=setTimeout(()=>fail(new Error('Délai dépassé. Vérifie l’adresse IP, le port 9090 et le réglage de contrôle à distance dans Kodi.')),10000);kodiSocket.onopen=async()=>{try{const pong=await kodiRpc('JSONRPC.Ping');if(pong!=='pong')throw new Error('Réponse inattendue de Kodi.');if(!settled){settled=true;clearTimeout(timer);resolve(true)}}catch(e){clearTimeout(timer);fail(e)}};kodiSocket.onmessage=event=>{let data;try{data=JSON.parse(event.data)}catch{return}if(data.id!==undefined&&kodiPending.has(data.id)){const p=kodiPending.get(data.id);kodiPending.delete(data.id);if(data.error)p.reject(new Error(data.error.message||'Erreur JSON-RPC Kodi.'));else p.resolve(data.result)}};kodiSocket.onerror=()=>{clearTimeout(timer);fail(new Error('Connexion refusée ou bloquée. Vérifie le réglage de contrôle à distance et le port 9090.'))};kodiSocket.onclose=()=>{if(!settled)fail(new Error('Kodi a fermé la connexion.'))}})}
async function kodiEnsureConnected(){if(kodiSocket&&kodiSocket.readyState===WebSocket.OPEN)return true;await kodiConnect();return true}
async function kodiFetchMovies(){const all=[];let start=0,total=Infinity;const pageSize=200;while(start<total){const result=await kodiRpc('VideoLibrary.GetMovies',{properties:['title','originaltitle','year','playcount','uniqueid','imdbnumber','lastplayed','file'],limits:{start,end:start+pageSize},sort:{method:'title',order:'ascending'}});const movies=result.movies||[],limits=result.limits||{};all.push(...movies);total=Number(limits.total??all.length);if(!movies.length)break;start+=movies.length;if(movies.length<pageSize)break;kodiSetStatus('kodiCompareStatus','Récupération des films Kodi : '+Math.min(all.length,total)+' / '+total+'…')}return all}
function kodiFileName(value){
 const raw=String(value||'').split(/[?#]/,1)[0];
 const name=raw.split(/[\\/]/).pop()||'';
 try{return decodeURIComponent(name)}catch{return name}
}
function kodiTmdbId(m){
 const ids=m.uniqueid||{};
 const raw=ids.tmdb??ids.tmdbid??ids.themoviedb;
 const value=raw&&typeof raw==='object'?(raw.value??raw.id):raw;
 const match=String(value??'').match(/^\s*(\d+)\s*$/);
 return match?match[1]:null;
}
function appTmdbId(f){const match=String(f.id||'').match(/^t(\d+)/);return match?match[1]:null}
function appWatched(f){return Boolean(f.w&&/^\d{4}-\d{2}-\d{2}$/.test(f.w))}
function kodiWatched(m){return Number(m.playcount||0)>0}
function kodiRenderList(id,items){
 const el=$('#'+id);
 if(!items.length){el.innerHTML='<p class="mute">Aucun élément dans cette catégorie.</p>';return}
 el.innerHTML=items.map(x=>'<article class="comparison-item">'+(x.filmId?'<a class="film-link" href="./#film/'+encodeURIComponent(x.filmId)+'"><b>'+esc(x.title)+(x.year?' ('+esc(x.year)+')':'')+'</b></a>':'<b>'+esc(x.title)+(x.year?' ('+esc(x.year)+')':'')+'</b>')+'<span class="mute">'+esc(x.detail||'')+'</span><div class="row"><button type="button" class="alt" data-kodi-ignore="'+esc(x.ignoreKey)+'" data-kodi-title="'+esc(x.title)+'">Ignorer</button></div></article>').join('');
 el.querySelectorAll('[data-kodi-ignore]').forEach(button=>{button.onclick=async()=>{button.disabled=true;try{await kodiIgnoreMovie(button.dataset.kodiIgnore,button.dataset.kodiTitle);const item=button.closest('.comparison-item');if(item)item.remove();const counter=document.querySelector('[data-kodi-summary="'+id+'"]');if(counter)counter.textContent=String(Math.max(0,Number(counter.textContent)-1));if(!el.querySelector('.comparison-item'))el.innerHTML='<p class="mute">Aucun élément dans cette catégorie.</p>'}catch(e){button.disabled=false;kodiSetStatus('kodiCompareStatus','Impossible d’ignorer ce film : '+(e.message||e),'bad')}}})
}
async function kodiIgnoreMovie(key,title){
 const current=await window.VideothequeDB.getSetting('kodiIgnoredMovies');
 const ignored=Array.isArray(current)?current:[];
 if(!ignored.includes(key)){ignored.push(key);await window.VideothequeDB.setSetting('kodiIgnoredMovies',ignored)}
 kodiSetStatus('kodiCompareStatus','« '+title+' » est maintenant ignoré dans les comparaisons Kodi.','good');
}
async function kodiCompare(){
 if(kodiBusy)return;kodiBusy=true;$('#kodiCompare').disabled=true;$('#kodiTest').disabled=true;$('#kodiResults').classList.add('hide');$('#kodiSummary').classList.add('hide');
 try{
  const address=kodiAddress();kodiSetStatus('kodiCompareStatus','Connexion à Kodi…');await kodiEnsureConnected();
  kodiSetStatus('kodiCompareStatus','Lecture de ta vidéothèque locale…');
  const [appIndex,kodiMovies]=await Promise.all([window.VideothequeDB.getIndex(),kodiFetchMovies()]);
  if(!appIndex||!Array.isArray(appIndex.films))throw new Error('Aucune base locale active. Importe une sauvegarde complète.');
  const kodiSnapshot={syncedAt:new Date().toISOString(),movies:kodiMovies.map(m=>({movieId:Number(m.movieid)||null,tmdbId:kodiTmdbId(m),title:String(m.title||m.originaltitle||'Titre inconnu'),year:Number(m.year)||null,playcount:Number(m.playcount)||0,lastplayed:m.lastplayed||null,fileName:kodiFileName(m.file)})).sort((a,b)=>a.title.localeCompare(b.title,'fr',{sensitivity:'base'}))};
  await window.VideothequeDB.setSetting('kodiMovies',kodiSnapshot);
  const appFilms=appIndex.films,byTmdb=new Map(),ignoredValue=await window.VideothequeDB.getSetting('kodiIgnoredMovies'),ignored=new Set(Array.isArray(ignoredValue)?ignoredValue:[]);
  for(const f of appFilms){const tid=appTmdbId(f);if(tid){if(!byTmdb.has(tid))byTmdb.set(tid,[]);byTmdb.get(tid).push(f)}}
  kodiSetStatus('kodiCompareStatus','Comparaison TMDB stricte de '+appFilms.length+' entrées avec '+kodiMovies.length+' films Kodi…');
  const appOnly=[],kodiOnly=[],unidentified=[];
  for(const m of kodiMovies){
   const tid=kodiTmdbId(m),title=m.title||m.originaltitle||'Titre inconnu',year=Number(m.year)||null,watched=kodiWatched(m),ignoreKey=tid?'tmdb:'+tid:'kodi:'+String(m.movieid??(title+'|'+(year||'')));
   if(ignored.has(ignoreKey))continue;
   if(!tid){unidentified.push({title,year,ignoreKey,detail:(watched?'Kodi : vu':'Kodi : non vu')+' · aucun identifiant TMDB fourni par Kodi.'});continue}
   const candidates=byTmdb.get(tid)||[];
   if(!candidates.length){if(watched)kodiOnly.push({title,year,ignoreKey,detail:'Kodi : vu · absent de ta vidéothèque · TMDB '+tid});continue}
   const seen=candidates.some(appWatched);
   if(seen&&!watched){const f=candidates.find(appWatched);appOnly.push({title:f.t||title,year:f.y||year,filmId:f.id,ignoreKey,detail:'Application : vu le '+f.w+' · Kodi : non vu · TMDB '+tid})}
   else if(watched&&!seen)kodiOnly.push({title:candidates[0].t||title,year:candidates[0].y||year,filmId:candidates[0].id,ignoreKey,detail:'Kodi : vu · application : non marqué vu · TMDB '+tid});
  }
  kodiRenderList('kodiAppOnly',appOnly);kodiRenderList('kodiKodiOnly',kodiOnly);kodiRenderList('kodiUnidentified',unidentified);
  $('#kodiSummary').classList.remove('hide');$('#kodiSummary').innerHTML='<div class="results"><article class="comparison-item"><b data-kodi-summary="kodiAppOnly">'+appOnly.length+'</b><span class="mute">Vus dans l’application, non vus dans Kodi</span></article><article class="comparison-item"><b data-kodi-summary="kodiKodiOnly">'+kodiOnly.length+'</b><span class="mute">Vus dans Kodi, non marqués vus dans l’application</span></article><article class="comparison-item"><b data-kodi-summary="kodiUnidentified">'+unidentified.length+'</b><span class="mute">Films Kodi sans identifiant TMDB</span></article><article class="comparison-item"><b data-kodi-summary="kodiLowRated">'+lowRated.length+'</b><span class="mute">Présents dans Kodi, notés strictement moins de 5/10</span></article></div><p class="mute">Comparaison terminée : '+kodiMovies.length+' films Kodi et '+appFilms.length+' entrées dans l’application. Les exclusions sont conservées dans IndexedDB.</p>';
  $('#kodiResults').classList.remove('hide');kodiSetStatus('kodiCompareStatus','Comparaison terminée. Aucun élément n’a été modifié.','good');
 }catch(e){let msg=e.message||'Erreur inconnue.';if(/Failed to fetch|NetworkError|WebSocket/i.test(msg))msg+=' Chrome peut bloquer l’accès au réseau local : autorise-le pour ce site.';kodiSetStatus('kodiCompareStatus',msg,'bad')}
 finally{kodiBusy=false;$('#kodiCompare').disabled=false;$('#kodiTest').disabled=false}
}
async function kodiTest(){if(kodiBusy)return;kodiBusy=true;$('#kodiTest').disabled=true;$('#kodiCompare').disabled=true;try{const address=kodiAddress();kodiSetStatus('kodiConnectionStatus','Connexion à '+address.host+':'+address.port+'…');await kodiConnect();const v=await kodiRpc('JSONRPC.Version'),label=v?.version?'API JSON-RPC '+v.version.major+'.'+v.version.minor+'.'+v.version.patch:'API JSON-RPC disponible';kodiSetStatus('kodiConnectionStatus','Connexion réussie à Kodi ('+label+').','good')}catch(e){let msg=e.message||'Erreur inconnue.';if(/Failed to fetch|NetworkError|WebSocket/i.test(msg))msg+=' Vérifie l’adresse, le port 9090, le contrôle depuis les autres systèmes et l’autorisation réseau local de Chrome.';kodiSetStatus('kodiConnectionStatus',msg,'bad')}finally{kodiBusy=false;$('#kodiTest').disabled=false;$('#kodiCompare').disabled=false}}
function setKodiWorkflow(){setWorkflow('kodi')}
let duplicateGroups=[];
function duplicateTmdbId(id){const m=String(id||'').match(/^t(\\d+)/);return m?m[1]:null}
function duplicateTitleKey(f){
 const title=String(f.t||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim();
 const year=String(f.y||'').trim();
 return title&&year?title+'|'+year:null;
}
function renderDuplicateGroups(){
 const root=$('#duplicatesResults');
 if(!duplicateGroups.length){root.innerHTML='';return}
 root.innerHTML=duplicateGroups.map((group,index)=>'<article class="comparison-item"><b>'+esc(group.items[0].t||'Film sans titre')+(group.items[0].y?' ('+esc(group.items[0].y)+')':'')+'</b><span class="mute">'+group.items.length+' fiches · '+esc(group.reason)+'</span>'+group.items.map(f=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line)"><span><b>'+esc(f.t||'Film sans titre')+(f.y?' ('+esc(f.y)+')':'')+'</b><span class="mute">'+esc(f.w?'Vu le '+f.w:'Aucune date de visionnage')+(f.r!=null?' · Note '+esc(f.r)+'/10':' · Sans note')+' · '+esc(f.id)+'</span></span>'+(group.keepId===f.id?'<span class="good">À conserver</span>':group.keepId?'<button type="button" class="alt" data-delete-duplicate="'+esc(f.id)+'" data-group="'+index+'">Supprimer cette fiche</button>':'<button type="button" class="alt" data-keep-duplicate="'+esc(f.id)+'" data-group="'+index+'">Conserver cette fiche</button>')+'</div>').join('')+'</article>').join('');
}
async function scanDuplicates(){
 const button=$('#scanDuplicates');button.disabled=true;$('#duplicatesResults').innerHTML='';
 setStatus($('#duplicatesStatus'),'Analyse des fiches locales et de leurs identifiants TMDB…');
 try{
  const index=await window.VideothequeDB.getIndex();if(!index||!Array.isArray(index.films))throw new Error('Aucune base locale active.');
  const enriched=await Promise.all(index.films.map(async f=>{
   try{const record=await window.VideothequeDB.getFilm(f.id);return {...f,_tmdbId:record?.tmdb?.tmdbId??duplicateTmdbId(f.id)}}catch{return {...f,_tmdbId:duplicateTmdbId(f.id)}}
  }));
  const groups=new Map(),claimed=new Set();
  for(const f of enriched){const id=f._tmdbId==null?null:String(f._tmdbId);if(!id)continue;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(f)}
  duplicateGroups=[...groups.entries()].filter(([,items])=>items.length>1).map(([tmdbId,items])=>({tmdbId,reason:'Même fiche TMDB : '+tmdbId,items:items.slice().sort((a,b)=>(a.w||'').localeCompare(b.w||'')||a.id.localeCompare(b.id)),keepId:null}));
  for(const group of duplicateGroups)for(const film of group.items)claimed.add(film.id);
  const byTitle=new Map();
  for(const f of enriched){if(claimed.has(f.id))continue;const key=duplicateTitleKey(f);if(!key)continue;if(!byTitle.has(key))byTitle.set(key,[]);byTitle.get(key).push(f)}
  for(const items of byTitle.values())if(items.length>1)duplicateGroups.push({tmdbId:null,reason:'Même titre et même année · doublon potentiel',items:items.slice().sort((a,b)=>(a.w||'').localeCompare(b.w||'')||a.id.localeCompare(b.id)),keepId:null});
  duplicateGroups.sort((a,b)=>(a.items[0].t||'').localeCompare(b.items[0].t||'','fr'));
  renderDuplicateGroups();
  setStatus($('#duplicatesStatus'),duplicateGroups.length?duplicateGroups.length+' groupe(s) de doublons ou doublons potentiels détecté(s). Vérifie les dates et les notes avant de choisir la fiche à conserver.':'Aucun doublon détecté : aucun identifiant TMDB ni couple titre/année n’apparaît plusieurs fois.','good');
 }catch(e){setStatus($('#duplicatesStatus'),'Détection impossible : '+(e.message||e),'bad')}
 finally{button.disabled=false}
}
$('#duplicatesResults').addEventListener('click',async e=>{
 const keep=e.target.closest('[data-keep-duplicate]'),remove=e.target.closest('[data-delete-duplicate]');
 if(keep){const group=duplicateGroups[Number(keep.dataset.group)];if(!group)return;group.keepId=keep.dataset.keepDuplicate;renderDuplicateGroups();return}
 if(!remove)return;
 const group=duplicateGroups[Number(remove.dataset.group)],id=remove.dataset.deleteDuplicate;
 if(!group||!group.keepId||id===group.keepId)return;
 const film=group.items.find(f=>f.id===id);if(!film)return;
 if(!confirm('Supprimer définitivement « '+(film.t||film.id)+' » de cette vidéothèque locale ? La fiche conservée sera « '+(group.items.find(f=>f.id===group.keepId)?.t||group.keepId)+' ».'))return;
 remove.disabled=true;
 try{
  await window.VideothequeDB.removeFilms([id]);
  setStatus($('#duplicatesStatus'),'Fiche supprimée. Actualisation de la liste…','good');
  await scanDuplicates();
 }catch(error){remove.disabled=false;setStatus($('#duplicatesStatus'),'Suppression impossible : '+(error.message||error),'bad')}
});
$('#scanDuplicates').onclick=scanDuplicates;
$('#workflowDuplicates').onclick=()=>setWorkflow('duplicates');$('#workflowKodi').onclick=setKodiWorkflow;$('#saveKodiIp').onclick=saveKodiIp;$('#clearKodiIp').onclick=clearKodiIp;$('#kodiTest').onclick=kodiTest;$('#kodiCompare').onclick=kodiCompare;restoreKodiIp();window.addEventListener('pagehide',kodiDisconnect);

let exportIndex=null;
function setWorkflow(which){
 const isToken=which==='token',isExport=which==='export',isBackup=which==='backup',isKodi=which==='kodi',isDuplicates=which==='duplicates';
 $('#tokenWorkflow').classList.toggle('hide',!isToken);
 $('#kodiWorkflow').classList.toggle('hide',!isKodi);
 $('#duplicatesWorkflow').classList.toggle('hide',!isDuplicates);
 $('#exportWorkflow').classList.toggle('hide',!isExport);
 $('#backupWorkflow').classList.toggle('hide',!isBackup);

 for(const [id,active] of [['workflowToken',isToken],['workflowExport',isExport],['workflowBackup',isBackup],['workflowKodi',isKodi],['workflowDuplicates',isDuplicates]]){
  $('#'+id).classList.toggle('alt',!active);
  $('#'+id).setAttribute('aria-pressed',String(active));
 }
 const hints={token:'Gestion du jeton TMDB. Il est conservé dans IndexedDB sur cet appareil et n’est pas inclus dans les sauvegardes de la vidéothèque.',export:'Parcours export sélectionné. Aucun identifiant ni connexion à Letterboxd n’est nécessaire.',backup:'Sauvegarde complète sélectionnée. Les fiches détaillées et le cache des sagas sont inclus ; aucune donnée n’est remplacée.',kodi:'Comparaison Kodi sélectionnée. Connexion locale en lecture seule ; aucun jeton requis.',duplicates:'Détection des fiches qui partagent le même identifiant TMDB. Les suppressions sont déclenchées individuellement après ton choix.'};
 $('#workflowHint').textContent=hints[which]||'Sélectionne un parcours pour afficher uniquement les outils correspondants.';
 if(isExport)loadExportIndex();
}
async function createFullBackup(){
 const button=$('#createBackup'),status=$('#backupCreateStatus');if(button.disabled)return;button.disabled=true;setStatus(status,'Lecture de la base locale…');
 try{
  if(typeof CompressionStream==='undefined')throw new Error('La compression native n’est pas disponible dans ce navigateur.');
  const [index,films,sagas]=await Promise.all([window.VideothequeDB.getIndex(),window.VideothequeDB.getAllFilms(),window.VideothequeDB.getAllSagas()]);
  if(!index||!Array.isArray(index.films))throw new Error('Aucune base locale active. Importe une sauvegarde complète.');
  const filmMap=new Map(films.map(f=>[f.id,f])),sagaMap=new Map(sagas.map(x=>[String(x.id),x]));
  const filmIds=index.films.map(f=>f.id),sagaIds=[...new Set(index.films.map(f=>f.c).filter(v=>v!==null&&v!==undefined&&String(v)!=='').map(String))].sort();
  const missingSagas=sagaIds.filter(id=>!sagaMap.has(id));for(const id of filmIds)if(!filmMap.has(id))throw new Error('Fiche locale absente : '+id);
  const createdAt=new Date().toISOString(),encoder=new TextEncoder();
  const source=new ReadableStream({start(controller){
   const write=record=>controller.enqueue(encoder.encode(JSON.stringify(record)+'\n'));
   write({type:'header',format:'mavideotheque-backup',version:1,createdAt});write({type:'index',data:index});
   for(let i=0;i<filmIds.length;i++){const id=filmIds[i];write({type:'film',id,data:filmMap.get(id)});if((i+1)%100===0||i===filmIds.length-1)setStatus(status,'Sauvegarde locale : '+(i+1)+' / '+filmIds.length+' films…')}
   let sagaDone=0;for(const id of sagaIds){const saga=sagaMap.get(id);if(saga){write({type:'saga',id,data:saga});sagaDone++}}
   write({type:'manifest',createdAt,indexGeneratedAt:index.generatedAt||null,filmCount:filmIds.length,sagaCount:sagaDone,expectedFilmCount:filmIds.length,expectedSagaIds:sagaIds,missingSagaIds:missingSagas});controller.close();
  }});
  const blob=await new Response(source.pipeThrough(new CompressionStream('gzip'))).blob();saveBlob(blob,'mavideotheque-sauvegarde-'+today()+'.jsonl.gz');
  setStatus(status,'Sauvegarde créée : '+filmIds.length+' fiches de films et '+(sagaIds.length-missingSagas.length)+' caches de sagas. Taille : '+(blob.size/1024/1024).toFixed(1)+' Mo.'+(missingSagas.length?' '+missingSagas.length+' cache(s) de saga absent(s), signalés dans le fichier.':'')+' Dépose ce fichier sur Google Drive.','good');
 }catch(error){setStatus(status,'Échec de la sauvegarde : '+(error.message||error),'bad')}finally{button.disabled=false}
}

let verifiedBackupFile=null;
async function verifyFullBackup(){
 const file=$('#backupFile').files[0],button=$('#verifyBackup'),status=$('#backupVerifyStatus');
 if(!file)return;
 button.disabled=true;setStatus(status,'Vérification du fichier compressé…');
 try{
  if(typeof DecompressionStream==='undefined')throw new Error('La décompression native n’est pas disponible dans ce navigateur. Mets-le à jour puis réessaie.');
  const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader();
  let pending='',header=null,index=null,manifest=null,filmIds=new Set(),sagaIds=new Set(),lineCount=0;
  const consume=line=>{
   if(!line.trim())return;
   let record;try{record=JSON.parse(line)}catch{throw new Error('Ligne JSON invalide : '+(lineCount+1))}
   lineCount++;
   if(lineCount===1){
    if(record.type!=='header'||record.format!=='mavideotheque-backup'||record.version!==1)throw new Error('Format de sauvegarde inconnu ou version non prise en charge.');
    header=record;return;
   }
   if(record.type==='index'){
    if(index||!record.data||!Array.isArray(record.data.films))throw new Error('Index absent, invalide ou présent plusieurs fois.');
    index=record.data;return;
   }
   if(record.type==='film'){
    if(!index||!record.data||record.data.id!==record.id)throw new Error('Fiche de film inattendue ou identifiant incohérent : '+(record.id||'?'));
    if(filmIds.has(record.id))throw new Error('Fiche de film en double : '+record.id);
    filmIds.add(record.id);return;
   }
   if(record.type==='saga'){
    if(!record.data||String(record.data.id)!==String(Number(record.id))||!Array.isArray(record.data.parts))throw new Error('Cache de saga invalide : '+(record.id||'?'));
    if(sagaIds.has(String(record.id)))throw new Error('Cache de saga en double : '+record.id);
    sagaIds.add(String(record.id));return;
   }
   if(record.type==='manifest'){if(manifest)throw new Error('Manifeste présent plusieurs fois.');manifest=record;return}
   throw new Error('Type d’entrée inconnu dans la sauvegarde.');
  };
  while(true){
   const {value,done}=await reader.read();if(done)break;
   pending+=value;let at;
   while((at=pending.indexOf('\n'))!==-1){const line=pending.slice(0,at);pending=pending.slice(at+1);consume(line)}
  }
  if(pending)consume(pending);
  if(!header||!index||!manifest)throw new Error('Sauvegarde incomplète : en-tête, index ou manifeste manquant.');
  const expectedFilms=index.films.map(f=>f.id);
  if(new Set(expectedFilms).size!==expectedFilms.length)throw new Error('L’index de la sauvegarde contient des doublons.');
  if(filmIds.size!==expectedFilms.length||expectedFilms.some(id=>!filmIds.has(id)))throw new Error('Nombre de fiches incohérent : '+filmIds.size+' fiche(s) pour '+expectedFilms.length+' films dans l’index.');
  const expectedSagas=[...new Set(index.films.map(f=>f.c).filter(v=>v!==null&&v!==undefined&&String(v)!=='').map(String))];
  const missing=(manifest.missingSagaIds||[]).map(String);
  if(manifest.filmCount!==filmIds.size||manifest.sagaCount!==sagaIds.size||manifest.expectedFilmCount!==expectedFilms.length)throw new Error('Les nombres du manifeste ne correspondent pas au contenu.');
  if(expectedSagas.some(id=>!sagaIds.has(id)&&!missing.includes(id))||[...sagaIds].some(id=>!expectedSagas.includes(id))||missing.some(id=>!expectedSagas.includes(id)||sagaIds.has(id)))throw new Error('La liste des caches de sagas est incohérente.');
  if(!Array.isArray(manifest.expectedSagaIds)||manifest.expectedSagaIds.length!==expectedSagas.length||manifest.expectedSagaIds.some(id=>!expectedSagas.includes(String(id))))throw new Error('Le manifeste ne correspond pas aux sagas de l’index.');
  setStatus(status,'Sauvegarde valide : '+filmIds.size+' fiches de films, '+sagaIds.size+' caches de sagas.'+(missing.length?' '+missing.length+' cache(s) de saga étaient absents du site au moment de l’export.':'')+' Index daté du '+(manifest.indexGeneratedAt||'date inconnue')+'. Aucune donnée de la vidéothèque n’a été modifiée.','good');
  verifiedBackupFile=file;$('#importBackupToDb').disabled=false;
 }catch(error){verifiedBackupFile=null;$('#importBackupToDb').disabled=true;setStatus(status,'Sauvegarde invalide ou illisible : '+(error.message||error),'bad')}
 finally{button.disabled=!$('#backupFile').files.length}
}
function csvCell(value){const s=String(value??'');return '"'+s.replace(/"/g,'""')+'"'}
function csvText(rows){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'}
function exportableFilms(){
 if(!exportIndex||!Array.isArray(exportIndex.films))throw new Error('Index de vidéothèque indisponible.');
 return exportIndex.films.filter(f=>/^t(\d+)/.test(f.id||'')&&/^\d{4}-\d{2}-\d{2}$/.test(f.w||''))
  .sort((a,b)=>b.w.localeCompare(a.w)||(a.t||'').localeCompare(b.t||''));
}
async function loadExportIndex(){
 const status=$('#exportAvailable');status.textContent='Lecture de la base locale…';$('#exportLetterboxdCsv').disabled=true;
 try{exportIndex=await window.VideothequeDB.getIndex();if(!exportIndex)throw new Error('Aucune base locale active. Importe une sauvegarde complète.');const films=exportableFilms();status.textContent=films.length+' films avec une date de visionnage peuvent être exportés. '+(exportIndex.films.length-films.length)+' film(s) sans date sont ignorés.';$('#exportLetterboxdCsv').disabled=false}
 catch(e){status.textContent=e.message;status.className='mute bad'}
}
function selectedExportFilms(){
 const n=Number($('#exportLimit').value);
 if(!Number.isInteger(n)||n<1)throw new Error('Indique un nombre de films supérieur à zéro.');
 const all=exportableFilms();
 return all.slice(0,Math.min(n,all.length));
}
function downloadCsv(){
 try{
  const films=selectedExportFilms();
  if(!films.length)throw new Error('Aucun film à exporter.');
  const rows=[['tmdbID','Title','Year','Rating10','WatchedDate'],...films.map(f=>{
   const tmdbId=(f.id.match(/^t(\\d+)/)||[])[1],rating=Number(f.r);
   return [tmdbId,f.t,f.y||'',Number.isInteger(rating)&&rating>=1&&rating<=10?rating:'',f.w];
  })];
  const name='mavideotheque-letterboxd-'+films.length+'-films.csv';
  saveBlob(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}),name);
  const box=$('#externalExportStatus');box.classList.remove('hide');box.className='status good';
  box.textContent=films.length+' film(s) exporté(s), du '+films[0].w+' au '+films[films.length-1].w+'.'+(films.length<Number($('#exportLimit').value)?' La collection contient moins de films exportables que le nombre demandé.':'');
 }catch(e){const box=$('#externalExportStatus');box.classList.remove('hide');box.className='status bad';box.textContent=e.message}
}
$('#workflowToken').onclick=()=>setWorkflow('token');$('#saveToken').onclick=saveToken;$('#clearToken').onclick=clearToken;
$('#workflowExport').onclick=()=>setWorkflow('export');
$('#workflowBackup').onclick=()=>setWorkflow('backup');
$('#createBackup').onclick=createFullBackup;
$('#backupFile').addEventListener('change',()=>{verifiedBackupFile=null;$('#verifyBackup').disabled=!$('#backupFile').files.length;$('#importBackupToDb').disabled=true;$('#backupVerifyStatus').textContent=$('#backupFile').files.length?$('#backupFile').files[0].name+' — prêt à vérifier.':'Aucun fichier sélectionné.';$('#backupVerifyStatus').className='status'});
async function refreshDatabaseStatus(){
 const el=$('#databaseStatus');
 try{
  const state=await window.VideothequeDB.getStatus();
  if(!state.available){setStatus(el,'Aucune base locale importée. Importe une sauvegarde complète pour initialiser la base locale.');return}
  setStatus(el,'Base locale active : '+state.filmCount+' films et '+state.sagaCount+' sagas. Importée le '+new Date(state.importedAt).toLocaleString('fr-FR')+'.'+(state.missingSagaIds.length?' '+state.missingSagaIds.length+' cache(s) de saga étaient absents de la sauvegarde.':'')+' La version précédente reste conservée.','good');
 }catch(error){setStatus(el,'IndexedDB indisponible : '+(error.message||error),'bad')}
}
async function importVerifiedBackup(){
 const file=$('#backupFile').files[0],button=$('#importBackupToDb'),status=$('#databaseImportStatus');
 if(!file||file!==verifiedBackupFile){setStatus(status,'Sélectionne et vérifie à nouveau le fichier avant de l’importer.','warn');button.disabled=true;return}
 if(!confirm('Importer cette sauvegarde dans la base locale ? La version actuellement active restera conservée si l’import échoue. En cas de succès, la nouvelle version sera utilisée par la vidéothèque.'))return;
 button.disabled=true;setStatus(status,'Préparation de l’import…');
 try{
  const result=await window.VideothequeDB.importBackup(file,message=>setStatus(status,message));
  await refreshDatabaseStatus();
  setStatus(status,'Import terminé : '+result.filmCount+' films et '+result.sagaCount+' sagas. La base locale est maintenant active. Recharge la page d’accueil pour lire les données importées.'+(result.missingSagaIds.length?' '+result.missingSagaIds.length+' cache(s) de saga étaient absents du site et de la sauvegarde.':''),'good');
  verifiedBackupFile=null;
 }catch(error){setStatus(status,'Import interrompu : '+(error.message||error)+'. La base locale précédemment active n’a pas été remplacée.','bad')}
 finally{button.disabled=verifiedBackupFile!==file}
}
$('#verifyBackup').onclick=verifyFullBackup;
$('#importBackupToDb').onclick=importVerifiedBackup;
refreshDatabaseStatus();
$('#exportLetterboxdCsv').onclick=()=>downloadCsv();
restoreTokens();