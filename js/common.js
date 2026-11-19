/* Utilitaires partagés par les pages de Ma vidéothèque. */
(function(global){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  global.VideothequeCommon=Object.freeze({$,esc});
})(window);
