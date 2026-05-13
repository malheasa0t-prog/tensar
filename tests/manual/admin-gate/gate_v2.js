
(function(){
var U="https://test.supabase.co",K="test_key",P="/__tz-panel.html?v=20260426-5",S="/api/admin/session";
var statusNode=document.getElementById("gateStatus");
var loadingNode=document.getElementById("gateLoading");
var deniedNode=document.getElementById("gateDenied");
var deniedMsg=document.getElementById("gateDeniedMsg");
function setMessage(msg){if(statusNode){statusNode.textContent=msg;}}
function showDenied(msg){
  if(loadingNode){loadingNode.style.display="none";}
  if(deniedNode){deniedNode.style.display="block";}
  if(deniedMsg){deniedMsg.textContent=msg;}
}
function clearAdminShellCaches(){
  if(!("caches" in window)){return Promise.resolve();}
  return window.caches.keys()
    .then(function(keys){
      var cacheKeys=keys.filter(function(key){return String(key||"").indexOf("tz-admin-shell-")===0;});
      return Promise.all(cacheKeys.map(function(key){return window.caches.delete(key);}));
    })
    .catch(function(){return null;});
}
function unregisterAdminServiceWorkers(){
  if(!("serviceWorker" in navigator) || typeof navigator.serviceWorker.getRegistrations!=="function"){
    return Promise.resolve();
  }
  return navigator.serviceWorker.getRegistrations()
    .then(function(registrations){
      var adminRegistrations=registrations.filter(function(registration){
        var url = String(registration?.active?.scriptURL || registration?.waiting?.scriptURL || registration?.installing?.scriptURL || "");
        return url.indexOf("admin-sw.js") !== -1;
      });
      return Promise.all(adminRegistrations.map(function(registration){return registration.unregister();}));
    })
    .catch(function(){return null;});
}
function resetLegacyAdminShellState(){
  return Promise.all([clearAdminShellCaches(), unregisterAdminServiceWorkers()]).then(function(){return null;});
}
function loadShell(){
  resetLegacyAdminShellState()
    .then(function(){
      return fetch(P+window.location.search,{credentials:"same-origin"});
    })
    .then(function(response){if(!response.ok)throw new Error("panel");return response.text();})
    .then(function(html){document.open();document.write(html);document.close();})
    .catch(function(){
      setMessage("تعذر تحميل لوحة الإدارة. أعد المحاولة.");
    });
}
function validateAdminSession(token){
  if(!token){loadShell();return;}
  fetch(S,{
    method:"GET",
    credentials:"same-origin",
    headers:{
      "Accept":"application/json",
      "Authorization":"Bearer "+token
    }
  })
  .then(function(response){
    if(response.status===401){
      showDenied("جلستك غير صالحة. سجل دخولك مرة أخرى.");
      return null;
    }
    if(response.status===403){
      showDenied("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
      return null;
    }
    if(!response.ok)throw new Error("session");
    return response.json();
  })
  .then(function(payload){
    if(payload===null){return;}
    if(!payload||payload.success!==true||!payload.user){
      showDenied("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
      return;
    }
    loadShell();
  })
  .catch(function(){
    setMessage("تعذر التحقق من الجلسة. أعد المحاولة.");
  });
}
if(!U||!K){
  setMessage("تعذر تحميل إعدادات لوحة الإدارة.");
  return;
}
if(!window.supabase||typeof window.supabase.createClient!=="function"){
  setMessage("تعذر تحميل مكتبة تسجيل الدخول.");
  return;
}
var client=window.supabase.createClient(U,K);
client.auth.getSession()
  .then(function(result){
    var session=result&&result.data&&result.data.session;
    if(!session||!session.access_token){
      loadShell();
      return;
    }
    validateAdminSession(session.access_token);
  })
  .catch(function(){loadShell();});
})();
