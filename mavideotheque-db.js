(function(global){
'use strict';
const DB_NAME='mavideotheque-local',DB_VERSION=1;
let opening=null;
function openDB(){
 if(opening)return opening;
 opening=new Promise((resolve,reject)=>{
  if(!('indexedDB' in global)){reject(new Error('IndexedDB n’est pas disponible dans ce navigateur.'));return}
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
   if(!db.objectStoreNames.contains('indexes'))db.createObjectStore('indexes',{keyPath:'key'});
   if(!db.objectStoreNames.contains('films'))db.createObjectStore('films',{keyPath:'key'});
   if(!db.objectStoreNames.contains('sagas'))db.createObjectStore('sagas',{keyPath:'key'});
  };
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null};resolve(db)};
  request.onerror=()=>reject(request.error||new Error('Impossible d’ouvrir IndexedDB.'));
  request.onblocked=()=>reject(new Error('La base locale est bloquée par un autre onglet. Ferme les autres onglets de la vidéothèque et réessaie.'));
 }).catch(error=>{opening=null;throw error});
 return opening;
}
function transactionDone(tx){
 return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Erreur IndexedDB.'));
  tx.onabort=()=>reject(tx.error||new Error('Transaction IndexedDB annulée.'));
 });
}
async function getRecord(storeName,key){
 const db=await openDB(),tx=db.transaction(storeName,'readonly'),request=tx.objectStore(storeName).get(key);
 const result=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)});
 await transactionDone(tx);return result;
}
async function putBatch(storeName,records){
 if(!records.length)return;
 const db=await openDB(),tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
 for(const record of records)store.put(record);
 await transactionDone(tx);
}
async function cleanupGeneration(generation){
 const db=await openDB();
 for(const name of ['films','sagas']){
  const tx=db.transaction(name,'readwrite'),store=tx.objectStore(name),range=IDBKeyRange.bound(generation+'|',generation+'|\uffff');
  await new Promise((resolve,reject)=>{
   const req=store.openCursor(range);
   req.onsuccess=()=>{const cursor=req.result;if(cursor){cursor.delete();cursor.continue()}else resolve()};
   req.onerror=()=>reject(req.error);
   tx.onabort=()=>reject(tx.error||new Error('Nettoyage IndexedDB interrompu.'));
  });
  await transactionDone(tx);
 }
 const tx=db.transaction('indexes','readwrite');tx.objectStore('indexes').delete(generation);await transactionDone(tx);
}
async function activateGeneration(generation,info){
 const db=await openDB(),tx=db.transaction('meta','readwrite');
 tx.objectStore('meta').put({key:'active',generation,importedAt:new Date().toISOString(),filmCount:info.filmCount,sagaCount:info.sagaCount,missingSagaIds:info.missingSagaIds,indexGeneratedAt:info.indexGeneratedAt||null});
 await transactionDone(tx);
}
async function importBackup(file,onProgress){
 if(!file)throw new Error('Sélectionne un fichier de sauvegarde.');
 if(typeof DecompressionStream==='undefined'||typeof TextDecoderStream==='undefined')throw new Error('Ce navigateur ne prend pas en charge la lecture progressive des sauvegardes gzip. Mets-le à jour puis réessaie.');
 const generation=Date.now().toString(36)+'-'+(global.crypto&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2));
 let staged=false,header=null,index=null,manifest=null,filmCount=0,sagaCount=0;
 const filmIds=new Set(),sagaIds=new Set(),filmBatch=[],sagaBatch=[];
 const report=message=>{if(typeof onProgress==='function')onProgress(message)};
 const flush=async()=>{
  if(filmBatch.length){const records=filmBatch.splice(0,filmBatch.length);await putBatch('films',records)}
  if(sagaBatch.length){const records=sagaBatch.splice(0,sagaBatch.length);await putBatch('sagas',records)}
 };
 try{
  await openDB();
  const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader();
  let pending='',lineNumber=0;
  const consume=async line=>{
   if(!line.trim())return;
   let record;try{record=JSON.parse(line)}catch{throw new Error('JSON invalide à la ligne '+(lineNumber+1)+'.')}
   lineNumber++;
   if(lineNumber===1){
    if(record.type!=='header'||record.format!=='mavideotheque-backup'||record.version!==1)throw new Error('Format de sauvegarde inconnu ou version non prise en charge.');
    header=record;return;
   }
   if(record.type==='index'){
    if(index||!record.data||!Array.isArray(record.data.films))throw new Error('Index absent, invalide ou présent plusieurs fois.');
    index=record.data;
    const expected=index.films.map(f=>f&&f.id);
    if(index.count!=null&&Number(index.count)!==expected.length)throw new Error('Le nombre de films de l’index est incohérent.');
    if(expected.some(id=>typeof id!=='string'||!/^t\d+(?:[-_][A-Za-z0-9_-]+)?$/.test(id))||new Set(expected).size!==expected.length)throw new Error('L’index contient un identifiant de film invalide ou en double.');
    const db=await openDB(),tx=db.transaction('indexes','readwrite');
    tx.objectStore('indexes').put({key:generation,data:index});
    await transactionDone(tx);staged=true;return;
   }
   if(record.type==='film'){
    if(!index||!record.data||record.data.id!==record.id||!index.films.some(f=>f.id===record.id))throw new Error('Fiche de film inattendue ou identifiant incohérent : '+(record.id||'?'));
    if(filmIds.has(record.id))throw new Error('Fiche de film en double : '+record.id);
    filmIds.add(record.id);filmCount++;
    filmBatch.push({key:generation+'|'+record.id,id:record.id,data:record.data});
    if(filmBatch.length>=30){await flush();report('Import en cours : '+filmCount+'/'+index.films.length+' fiches de films…')}
    return;
   }
   if(record.type==='saga'){
    if(!record.data||String(record.data.id)!==String(Number(record.id))||!Array.isArray(record.data.parts))throw new Error('Cache de saga invalide : '+(record.id||'?'));
    if(sagaIds.has(String(record.id)))throw new Error('Cache de saga en double : '+record.id);
    sagaIds.add(String(record.id));sagaCount++;
    sagaBatch.push({key:generation+'|'+String(record.id),id:String(record.id),data:record.data});
    if(sagaBatch.length>=30){await flush();report('Import en cours : '+filmCount+' films, '+sagaCount+' sagas…')}
    return;
   }
   if(record.type==='manifest'){
    if(manifest)throw new Error('Manifeste présent plusieurs fois.');
    manifest=record;return;
   }
   throw new Error('Type d’entrée inconnu dans la sauvegarde.');
  };
  while(true){
   const {value,done}=await reader.read();if(done)break;
   pending+=value;let at;
   while((at=pending.indexOf('\n'))!==-1){const line=pending.slice(0,at);pending=pending.slice(at+1);await consume(line)}
  }
  if(pending)await consume(pending);
  await flush();
  if(!header||!index||!manifest)throw new Error('Sauvegarde incomplète : en-tête, index ou manifeste manquant.');
  const expectedFilms=index.films.map(f=>f.id);
  if(filmIds.size!==expectedFilms.length||expectedFilms.some(id=>!filmIds.has(id)))throw new Error('Fiches de films manquantes : '+filmIds.size+' reçue(s) pour '+expectedFilms.length+' attendue(s).');
  const expectedSagas=[...new Set(index.films.map(f=>f.c).filter(v=>v!==null&&v!==undefined&&String(v)!=='').map(String))];
  const missing=(manifest.missingSagaIds||[]).map(String);
  if(!Array.isArray(manifest.expectedSagaIds)||manifest.expectedSagaIds.length!==expectedSagas.length||manifest.expectedSagaIds.some(id=>!expectedSagas.includes(String(id))))throw new Error('Le manifeste ne correspond pas aux sagas de l’index.');
  if(expectedSagas.some(id=>!sagaIds.has(id)&&!missing.includes(id))||[...sagaIds].some(id=>!expectedSagas.includes(id))||missing.some(id=>!expectedSagas.includes(id)||sagaIds.has(id)))throw new Error('La liste des caches de sagas est incohérente.');
  if(manifest.filmCount!==filmCount||manifest.sagaCount!==sagaCount||manifest.expectedFilmCount!==expectedFilms.length)throw new Error('Les nombres du manifeste ne correspondent pas au contenu.');
  await activateGeneration(generation,{filmCount,sagaCount,missingSagaIds:missing,indexGeneratedAt:manifest.indexGeneratedAt});
  return {filmCount,sagaCount,missingSagaIds:missing,indexGeneratedAt:manifest.indexGeneratedAt||null,importedAt:new Date().toISOString()};
 }catch(error){
  if(staged){try{await cleanupGeneration(generation)}catch(cleanError){error.message+=' Le nettoyage des données temporaires a échoué : '+cleanError.message}}
  throw error;
 }
}
async function getStatus(){
 const active=await getRecord('meta','active');
 if(!active)return {available:false,filmCount:0,sagaCount:0};
 const index=await getRecord('indexes',active.generation);
 return {available:!!index,generation:active.generation,filmCount:active.filmCount||0,sagaCount:active.sagaCount||0,missingSagaIds:active.missingSagaIds||[],importedAt:active.importedAt,indexGeneratedAt:active.indexGeneratedAt||null,indexCount:index&&index.data.films?index.data.films.length:0};
}
async function activeGeneration(){
 const active=await getRecord('meta','active');return active&&active.generation||null;
}
async function getIndex(){
 const generation=await activeGeneration();if(!generation)return null;
 const record=await getRecord('indexes',generation);return record&&record.data||null;
}
async function getFilm(id){
 const generation=await activeGeneration();if(!generation)return null;
 const record=await getRecord('films',generation+'|'+String(id));return record&&record.data||null;
}
async function getSaga(id){
 const generation=await activeGeneration();if(!generation)return null;
 const record=await getRecord('sagas',generation+'|'+String(id));return record&&record.data||null;
}

async function getAll(storeName){
 const generation=await activeGeneration();if(!generation)return [];
 const db=await openDB(),tx=db.transaction(storeName,'readonly'),store=tx.objectStore(storeName),range=IDBKeyRange.bound(generation+'|',generation+'|\uffff');
 const records=await new Promise((resolve,reject)=>{const out=[],req=store.openCursor(range);req.onsuccess=()=>{const c=req.result;if(c){out.push(c.value);c.continue()}else resolve(out)};req.onerror=()=>reject(req.error)});
 await transactionDone(tx);return records.map(record=>record.data);
}
async function removeFilms(ids){
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id))throw new Error('Liste de films à supprimer invalide.');
 if(new Set(ids).size!==ids.length)throw new Error('La liste contient des identifiants en double.');
 const active=await getRecord('meta','active');if(!active)throw new Error('Aucune base locale active.');
 const generation=active.generation,db=await openDB(),tx=db.transaction(['meta','indexes','films'],'readwrite');
 const indexStore=tx.objectStore('indexes'),filmStore=tx.objectStore('films'),metaStore=tx.objectStore('meta');
 const indexRecord=await new Promise((resolve,reject)=>{const req=indexStore.get(generation);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});
 if(!indexRecord||!indexRecord.data||!Array.isArray(indexRecord.data.films))throw new Error('Index local introuvable.');
 const remove=new Set(ids),existing=indexRecord.data.films.filter(f=>remove.has(f.id));
 if(existing.length!==ids.length)throw new Error('Au moins une fiche à supprimer est absente de l’index.');
 const films=indexRecord.data.films.filter(f=>!remove.has(f.id));
 if(!films.length)throw new Error('Impossible de supprimer tous les films de la vidéothèque.');
 for(const id of ids)filmStore.delete(generation+'|'+id);
 const next={...indexRecord.data,count:films.length,generatedAt:new Date().toISOString(),films};
 indexStore.put({key:generation,data:next});
 metaStore.put({...active,filmCount:films.length,lastModifiedAt:new Date().toISOString()});
 await transactionDone(tx);
 return {filmCount:films.length,removedFilms:ids.length};
}
async function saveChanges(payload){
 if(!payload||!payload.index||!Array.isArray(payload.index.films))throw new Error('Index local invalide.');
 const active=await getRecord('meta','active');if(!active)throw new Error('Aucune base locale active. Importe d’abord ta sauvegarde complète.');
 const generation=active.generation,films=payload.films||[],sagas=payload.sagas||[];
 if(!Array.isArray(films)||!Array.isArray(sagas))throw new Error('Lot de modifications invalide.');
 const index=payload.index,ids=new Set(index.films.map(f=>f.id));
 if(ids.size!==index.films.length||index.films.some(f=>typeof f.id!=='string'))throw new Error('L’index contient des identifiants invalides ou en double.');
 for(const film of films)if(!film||!film.id||!ids.has(film.id))throw new Error('Une fiche modifiée est absente de l’index : '+(film&&film.id||'?'));
 for(const saga of sagas)if(!saga||!saga.id||!Array.isArray(saga.parts))throw new Error('Une donnée de saga est invalide.');
 const db=await openDB(),tx=db.transaction(['meta','indexes','films','sagas'],'readwrite');
 tx.objectStore('indexes').put({key:generation,data:{...index,count:index.films.length}});
 for(const film of films)tx.objectStore('films').put({key:generation+'|'+film.id,id:film.id,data:film});
 for(const saga of sagas)tx.objectStore('sagas').put({key:generation+'|'+String(saga.id),id:String(saga.id),data:saga});
 const sagaCountRequest=tx.objectStore('sagas').count(IDBKeyRange.bound(generation+'|',generation+'|\uffff'));
 sagaCountRequest.onsuccess=()=>tx.objectStore('meta').put({...active,filmCount:index.films.length,sagaCount:sagaCountRequest.result,lastModifiedAt:new Date().toISOString()});
 await transactionDone(tx);
 return {filmCount:index.films.length,updatedFilms:films.length,updatedSagas:sagas.length};
}

function getSetting(name){if(typeof name!=='string'||!name.trim())return Promise.reject(new Error('Nom de paramètre invalide.'));return getRecord('meta','setting|'+name).then(record=>record?record.value:null)}
async function setSetting(name,value){const validValue=typeof value==='string'||(value!==null&&typeof value==='object'&&(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype));if(typeof name!=='string'||!name.trim()||!validValue)throw new Error('Paramètre local invalide.');const db=await openDB(),tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key:'setting|'+name,value,updatedAt:new Date().toISOString()});await transactionDone(tx)}
async function deleteSetting(name){if(typeof name!=='string'||!name.trim())throw new Error('Nom de paramètre invalide.');const db=await openDB(),tx=db.transaction('meta','readwrite');tx.objectStore('meta').delete('setting|'+name);await transactionDone(tx)}

 global.VideothequeDB={getStatus,getIndex,getFilm,getSaga,getSetting,setSetting,deleteSetting,getAllFilms:()=>getAll('films'),getAllSagas:()=>getAll('sagas'),saveChanges,removeFilms,importBackup};
})(window);