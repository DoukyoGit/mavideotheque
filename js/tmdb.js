/* Client HTTP TMDB partagé. Les paramètres personnels restent fournis par l’appelant. */
(function(global){
  'use strict';
  async function request(token,path,params={}){
    if(!global.VideothequeCommon.isValidTmdbToken(token)){
      throw new Error('Jeton TMDB invalide : vérifie Outils → Jeton TMDB.');
    }
    const url=new URL('https://api.themoviedb.org/3'+path);
    Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
    const response=await fetch(url.href,{headers:{Authorization:'Bearer '+token.trim()}});
    if(!response.ok){
      throw new Error(response.status===401?'Jeton TMDB invalide ou expiré.':'Erreur TMDB '+response.status+'.');
    }
    return response.json();
  }
  global.VideothequeTMDB=Object.freeze({request});
})(window);
