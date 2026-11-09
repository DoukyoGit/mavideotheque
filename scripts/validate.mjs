import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const failures=[];
const check=(ok,message)=>{if(!ok)failures.push(message)};
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));

for(const file of ['index.html','tools.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  check(scripts.length>0,file+': aucun script inline trouvé');
  scripts.forEach((match,i)=>{
    try{new vm.Script(match[1],{filename:file+'#script-'+(i+1)});}
    catch(error){failures.push(file+': syntaxe JavaScript invalide : '+error.message);}
  });
  check(/name="robots" content="noindex/.test(html),file+': directive noindex absente');
  check(/Content-Security-Policy/.test(html),file+': CSP absente');
  check(!/(?:github_pat_|ghp_|gho_|ghu_)[A-Za-z0-9_]{20,}/.test(html),file+': possible GitHub token hardcodé');
}

const index=readJson('data/index.json');
check(Array.isArray(index.films),'data/index.json: films doit être un tableau');
check(index.count===index.films.length,'data/index.json: count différent du nombre de films');
const ids=new Set();
const files=new Set(fs.readdirSync(path.join(root,'data/films')).filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5)));
for(const film of index.films){
  check(typeof film.id==='string'&&film.id.length>0,'Index: identifiant absent');
  if(ids.has(film.id))failures.push('Index: identifiant dupliqué '+film.id);
  ids.add(film.id);
  check(typeof film.t==='string'&&film.t.trim().length>0,film.id+': titre absent');
  check(film.r==null||(Number.isFinite(Number(film.r))&&Number(film.r)>=0&&Number(film.r)<=10),film.id+': note invalide');
  if(film.w!=null){
    const valid=/^\d{4}-\d{2}-\d{2}$/.test(film.w)&&!Number.isNaN(Date.parse(film.w+'T00:00:00Z'))&&new Date(film.w+'T00:00:00Z').toISOString().slice(0,10)===film.w;
    check(valid,film.id+': date de visionnage invalide');
  }
  check(files.has(film.id),film.id+': fiche JSON manquante');
  const detail=readJson('data/films/'+film.id+'.json');
  check(detail.id===film.id,film.id+': ID de fiche différent de l’index');
}
for(const id of files)check(ids.has(id),id+': fichier détaillé absent de l’index');
check(files.size===index.films.length,'Nombre de fiches JSON différent du nombre d’entrées d’index');

if(failures.length){
  console.error('ÉCHEC — '+failures.length+' problème(s) :');
  failures.forEach(message=>console.error(' - '+message));
  process.exitCode=1;
}else{
  console.log('OK — '+index.films.length+' films, '+files.size+' fiches synchronisées ; JavaScript, JSON, dates, notes, directives robots et CSP valides.');
}
