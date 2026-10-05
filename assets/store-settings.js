(function(){
 const KEY='ladenfluss.store.v1';
 function read(){try{return Object.assign({open:'09:00',close:'18:00',minStaff:2,state:'HE'},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return{open:'09:00',close:'18:00',minStaff:2,state:'HE'}}}
 function save(next){localStorage.setItem(KEY,JSON.stringify(Object.assign({},read(),next)))}
 function bind(){
  const s=read(),open=document.getElementById('store_open'),close=document.getElementById('store_close'),min=document.getElementById('store_min_staff');
  if(open)open.value=s.open;if(close)close.value=s.close;if(min)min.value=s.minStaff;
  document.getElementById('storeProfile')?.addEventListener('submit',()=>{if(open&&close&&min&&open.value<close.value&&Number(min.value)>0)save({open:open.value,close:close.value,minStaff:Number(min.value)})});
 }
 window.LadenflussStoreSettings={read,save};document.addEventListener('DOMContentLoaded',bind);
})();