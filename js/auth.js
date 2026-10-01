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
  fbAuth.getRedirectResult().then(function(r){if(r&&r.user)authLog('redirect-ok',null);}).catch(function(err){authLog('redirect-result-fail',err);});
  fbAuth.onAuthStateChanged(function(u){
    var was=authUser&&authUser.uid;
    authUser=u||null;
    authReady=true;
    try{localStorage.setItem('auth_signed',u?'1':'0');}catch(e){}
    if(u&&u.uid!==was)authAfterSignIn();
    else if(!u&&typeof syncStart==='function')syncStart(); /* 비로그인: 코드 경로로 동기화 */
    if(u&&typeof window._onboardAfterSignIn==='function')window._onboardAfterSignIn();
    if(typeof renderDashboard==='function'&&vw==='dashboard')renderDashboard();
  });
})();

function authName(){
  if(!authUser)return '';
  return authUser.email||authUser.displayName||'로그인됨';
}

function authLog(stage,err){
  try{
    if(!fbDb)return;
    fbDb.ref('study/authlog/'+syncUid()).set({
      ts:Date.now(),stage:stage,
      code:(err&&err.code)||'',msg:((err&&err.message)||'').slice(0,200),
      host:location.hostname,standalone:!!(navigator.standalone),
      ua:navigator.userAgent.slice(0,120)
    });
  }catch(e){}
}
function authSignIn(cb){
  if(!fbAuth){authLog('no-auth-sdk',null);if(cb)cb('로그인을 사용할 수 없습니다');return;}
  var p=new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({prompt:'select_account'});
  var standalone=window.navigator&&window.navigator.standalone;
  authLog('start',null);
  if(standalone){
    fbAuth.signInWithRedirect(p).catch(function(err){
      authLog('redirect-fail',err);
      if(cb)cb('로그인 실패: '+((err&&err.code)||'알 수 없음'));
    });
    return;
  }
  fbAuth.signInWithPopup(p).then(function(){if(cb)cb(null);}).catch(function(err){
    authLog('popup-fail',err);
    if(err&&/popup/i.test(err.code||'')){
      fbAuth.signInWithRedirect(p).catch(function(e2){
        authLog('redirect-fail',e2);
        if(cb)cb('로그인 실패: '+((e2&&e2.code)||'알 수 없음'));
      });
      return;
    }
    if(cb)cb('로그인 실패: '+((err&&err.code)||'알 수 없음'));
  });
}
function authSignOut(){
  if(!fbAuth)return;
  fbAuth.signOut().then(function(){
    if(typeof renderDashboard==='function'&&vw==='dashboard')renderDashboard();
  });
}

/* 로그인 직후: 계정(u/<uid>) 실시간 동기화 시작.
   처음 로그인하는 기기면 그동안 쓰던 코드 백업(users/<코드>)도 한 번 합쳐 계정으로 올린다 */
function authAfterSignIn(){
  if(!fbDb||!authUser)return;
  var doneLegacy=false;
  try{doneLegacy=localStorage.getItem('auth_migrated')==='1';}catch(e){}
  if(doneLegacy){syncStart();return;}
  fbDb.ref('users/'+syncUid()).once('value').then(function(s2){
    var old=s2.val();
    if(old&&old.data)authMergeBlob(old.data);
    if(old&&old.k)Object.keys(old.k).forEach(function(n){
      var v=old.k[n];if(!v||v.v===null||v.v===undefined)return;
      var k=syncDec(n),cur=localStorage.getItem(k);
      if(syncWatched(k))try{localStorage.setItem(k,cur?syncMergeJson(k,cur,v.v):v.v);}catch(e){}
    });
    try{localStorage.setItem('auth_migrated','1');}catch(e){}
  }).catch(function(){}).then(function(){syncStart();});
}
function authMergeBlob(data){
  Object.keys(data).forEach(function(k){
    try{
      var cur=localStorage.getItem(k);
      localStorage.setItem(k,cur?syncMergeJson(k,cur,data[k]):data[k]);
    }catch(e){}
  });
}

