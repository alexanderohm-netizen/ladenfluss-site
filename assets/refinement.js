document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const search=document.getElementById('staffSearch'),clear=document.getElementById('clearStaffSearch');
  if(search&&clear){
    search.addEventListener('input',()=>{clear.hidden=!search.value;});
    clear.addEventListener('click',()=>{search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));search.focus();});
  }
});
