/* ══════════════════════════════════════════
   구글 로그인 (Firebase Auth)
   - 로그인하면 공부기록 백업이 users/<8자리 코드> → u/<계정 uid> 로 옮겨간다.
   - 기존 코드 백업은 처음 로그인할 때 한 번 합쳐서 가져온다 (지우지 않음).
   - 아이폰 홈 화면 앱에서는 팝업이 막히므로 리다이렉트 방식으로 대체.
══════════════════════════════════════════ */
var authUser=null, fbAuth=null, authReady=false;

(function(){
  try{ if(window.firebase&&firebase.auth) fbAuth=firebase.auth(); }catch(e){}
  if(!fbAuth)return;
  /* 리다이렉트로 돌아온 경우 결과 수신 */
  fbAuth.getRedirectResult().catch(function(){});
  fbAuth.onAuthStateChanged(function(u){
    var was=authUser&&authUser.uid;
    authUser=u||null;
    authReady=true;
    try{localStorage.setItem('auth_signed',u?'1':'0');}catch(e){}
    if(u&&u.uid!==was)authAfterSignIn();
    if(u&&typeof window._onboardAfterSignIn==='function')window._onboardAfterSignIn();
    if(typeof renderDashboard==='function'&&vw==='dashboard')renderDashboard();
  });
})();

function authName(){
  if(!authUser)return '';
  return authUser.email||authUser.displayName||'로그인됨';
}

function authSignIn(cb){
  if(!fbAuth){if(cb)cb('로그인을 사용할 수 없습니다');return;}
  var p=new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({prompt:'select_account'});
  var standalone=window.navigator&&window.navigator.standalone;
  if(standalone){fbAuth.signInWithRedirect(p);return;}
  fbAuth.signInWithPopup(p).then(function(){if(cb)cb(null);}).catch(function(err){
    /* 팝업이 막히면 리다이렉트로 */
    if(err&&/popup/i.test(err.code||'')){fbAuth.signInWithRedirect(p);return;}
    if(cb)cb('로그인에 실패했습니다');
  });
}
function authSignOut(){
  if(!fbAuth)return;
  fbAuth.signOut().then(function(){
    if(typeof renderDashboard==='function'&&vw==='dashboard')renderDashboard();
  });
}

/* 로그인 직후: 계정 백업 + (처음이면) 기존 코드 백업을 이 기기 기록과 합치고 다시 올린다 */
function authAfterSignIn(){
  if(!fbDb||!authUser)return;
  var uid=authUser.uid;
  fbDb.ref('u/'+uid).once('value').then(function(snap){
    var b=snap.val();
    if(b&&b.data)authMergeBlob(b.data);
    var doneLegacy=false;
    try{doneLegacy=localStorage.getItem('auth_migrated')==='1';}catch(e){}
    if(doneLegacy){authPushAndRender();return;}
    fbDb.ref('users/'+syncUid()).once('value').then(function(s2){
      var old=s2.val();
      if(old&&old.data)authMergeBlob(old.data);
      try{localStorage.setItem('auth_migrated','1');}catch(e){}
      authPushAndRender();
    }).catch(authPushAndRender);
  }).catch(function(){});
}
function authMergeBlob(data){
  Object.keys(data).forEach(function(k){
    try{
      var cur=localStorage.getItem(k);
      localStorage.setItem(k,cur?syncMergeJson(k,cur,data[k]):data[k]);
    }catch(e){}
  });
}
function authPushAndRender(){
  if(typeof syncPush==='function')syncPush();
  if(typeof render==='function')render();
}
