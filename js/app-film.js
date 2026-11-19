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
  ${sim.length?`<h2>Dans le même esprit</h2><div class="strip">${sim.slice(0,18).map(m=>{const id='t'+m.id,local=ALL.find(a=>a.id===id),personal=local&&local.r!=null?'<span class="badge personal-rating poster-personal-rating '+rcls(Number(local.r))+'" title="Ma note : '+fmtR(local.r)+' / 10">'+fmtR(local.r)+'<small>/10</small></span>':'';return '<a class="card same-spirit-card" href="'+esc(filmHref(id,m.title))+'"><div class="poster">'+(m.poster_path?'<img loading="lazy" decoding="async" src="'+IMG+'w342'+m.poster_path+'" alt="">':'<div class="noimg">'+esc((m.title||'?').slice(0,2))+'</div>')+(m.vote_average!=null?'<span class="badge tmdb" title="Note moyenne TMDB">'+fmtR(Number(m.vote_average))+'</span>':'')+personal+'</div><div class="card-heading"><h2>'+esc(m.title)+'</h2></div><div class="meta">'+esc((m.release_date||'').slice(0,4))+'</div>'+(local?'<div class="discover-library">Dans ma vidéothèque</div>':'')+'</a>'}).join('')}</div>`:''}
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
    if(location.hash!==canonicalHash)history.replaceState(history.state,'',location.pathname+location.search+canonicalHash);
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
  if(location.hash!==canonicalHash)history.replaceState(history.state,'',location.pathname+location.search+canonicalHash);
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
