/* Utilitaires partagés par les pages de Ma vidéothèque. */
(function(global){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const isValidTmdbToken=value=>{const token=String(value??'').trim();return !!token&&/^[A-Za-z0-9._-]+$/.test(token)};
  global.VideothequeCommon=Object.freeze({$,esc,isValidTmdbToken});
})(window);
