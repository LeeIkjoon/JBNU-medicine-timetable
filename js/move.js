/* ══════════════════════════════════════════
   주소 이전: leeikjoon.github.io → sehyunlee.vercel.app
   GitHub Pages는 인증 프록시를 둘 수 없어 아이폰 홈 화면 앱에서 구글 로그인이 안 된다.
   - 옛 주소: 기록을 서버(users/<코드>)에 다 올린 뒤 새 주소로 보냄
       브라우저 → 바로 이동 / 홈 화면 앱 → 안내 화면 (홈 화면에 다시 추가해야 하므로)
   - 새 주소: ?link=<코드>로 들어오면 그 코드의 기록을 먼저 받아 두고 앱 시작
══════════════════════════════════════════ */
var MOVE_NEW_URL='https://sehyunlee.vercel.app/';
function moveIsOld(){return location.hostname==='leeikjoon.github.io';}
function moveStandalone(){
  return window.navigator.standalone===true||
    (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
}
/* 새 주소로 갈 URL — 로그인 안 했으면 코드를 붙여 기록이 따라오게 */
function moveTarget(){
  var signed=!!(window.authUser&&authUser.uid);
  return MOVE_NEW_URL+(signed?'':'?link='+encodeURIComponent(syncUid()));
}

/* ── 새 주소: ?link=<코드> 처리. 처리 중이면 true (init 중단 → 끝나면 새로고침) ── */
function moveLinkHandle(){
  var m=location.search.match(/[?&]link=([A-Za-z0-9]{8})\b/);
  if(!m)return false;
  var code=m[1].toUpperCase(),clean=location.pathname;
  function done(){try{history.replaceState(null,'',clean);}catch(e){}location.replace(clean);}
  if(!fbDb||!/^[A-Z2-9]{8}$/.test(code)){done();return true;}
  var main=document.getElementById('main');
  if(main)main.innerHTML='<div class="empty-tt"><div class="empty-tt-ttl">기록을 옮기는 중</div>'
    +'<div class="empty-tt-sub">이전 주소에서 쓰던 시간표 설정과 공부 기록을 가져오고 있어요</div></div>';
  var timer=setTimeout(done,10000);
  fbDb.ref('users/'+code).once('value').then(function(snap){
    var b=snap.val()||{};
    /* 옛 형식(data) + 새 형식(k) 모두 이 기기 기록과 합침 */
    Object.keys(b.data||{}).forEach(function(k){
      if(!syncWatched(k)&&k.indexOf('timetable_data_')!==0)return;
      var cur=localStorage.getItem(k);
      try{localStorage.setItem(k,cur?syncMergeJson(k,cur,b.data[k]):b.data[k]);}catch(e){}
    });
    var kt=syncKT();
    Object.keys(b.k||{}).forEach(function(n){
      var v=b.k[n];if(!v)return;
      var k=syncDec(n);
      if(!syncWatched(k)&&k.indexOf('timetable_data_')!==0)return;
      var lv=localStorage.getItem(k);
      var mv=syncMerge(k,lv,kt[k]||0,v.v===undefined?null:v.v,v.t||0);
      try{if(mv===null)localStorage.removeItem(k);else localStorage.setItem(k,mv);}catch(e){}
    });
    /* 이 기기도 같은 코드를 씀 → 옛 기기와 계속 동기화, 로그인하면 계정으로 합쳐짐 */
    try{localStorage.setItem('sync_uid',code);localStorage.setItem('moved_from_gh','1');}catch(e){}
    clearTimeout(timer);done();
  }).catch(function(){clearTimeout(timer);done();});
  return true;
}

/* ── 옛 주소: 기록 올리고 새 주소로 ── */
function moveGo(btn){
  if(btn){btn.disabled=true;btn.textContent='기록 올리는 중...';}
  syncFlushAll(10000).then(function(ok){
    if(!ok&&btn){
      btn.disabled=false;btn.textContent='새 주소 열기';
      var n=document.getElementById('move-note');
      if(n)n.textContent='인터넷 연결을 확인하고 다시 눌러 주세요 (기록이 아직 다 올라가지 않았어요)';
      return;
    }
    location.href=moveTarget();
  });
}
function moveScreenShow(){
  if(document.getElementById('move-screen'))return;
  var d=document.createElement('div');
  d.id='move-screen';d.className='gs-screen';d.style.display='flex';
  d.innerHTML='<div class="gs-logo"><div class="gs-title">새 주소로 옮겨 주세요</div>'
    +'<div class="gs-sub move-sub">이 주소에서는 구글 로그인이 되지 않아요.<br>새 주소에서는 로그인해서 폰·태블릿을 함께 쓸 수 있어요.</div></div>'
    +'<div class="auth-box">'
    +'<ol class="move-steps">'
    +'<li>아래 버튼으로 새 주소를 사파리에서 열어요</li>'
    +'<li>사파리 공유 버튼 → <b>홈 화면에 추가</b></li>'
    +'<li>새로 생긴 아이콘으로 쓰고, 이 아이콘은 지워도 돼요</li>'
    +'</ol>'
    /* 홈 화면 앱에선 target=_blank 링크라야 실제 사파리로 열림 (앱 안 간이 창엔 '홈 화면에 추가'가 없음) */
    +'<a class="gs-ok move-go wait" id="move-go" href="'+escHtml(moveTarget())+'" target="_blank" rel="noopener">기록 올리는 중...</a>'
    +'<div class="auth-note" id="move-note">시간표 설정과 공부 기록은 그대로 옮겨져요</div>'
    +'<button class="auth-skip" id="move-later">나중에</button>'
    +'</div>';
  document.body.appendChild(d);
  var go=document.getElementById('move-go');
  go.onclick=function(e){if(go.classList.contains('wait'))e.preventDefault();};
  /* 화면이 뜨자마자 기록을 올려 두고, 끝나면 버튼 활성화 */
  syncFlushAll(10000).then(function(ok){
    go.href=moveTarget();go.classList.remove('wait');go.textContent='사파리에서 새 주소 열기';
    if(!ok){var n=document.getElementById('move-note');if(n)n.textContent='오프라인이라 기록 일부가 아직 안 올라갔을 수 있어요. 연결되면 자동으로 올라가요';}
  });
  document.getElementById('move-later').onclick=function(){
    try{localStorage.setItem('move_later_at',String(Date.now()));}catch(e){}
    d.parentNode.removeChild(d);
  };
}
/* init 끝에서 호출 */
function moveOldCheck(){
  if(!moveIsOld())return;
  if(!localStorage.getItem('user_grade'))return; /* 신규 사용자는 온보딩 중 — 다음 실행 때 */
  if(moveStandalone()){
    /* 홈 화면 앱: '나중에'를 누르면 3일 뒤 다시 안내 */
    var t=0;try{t=parseInt(localStorage.getItem('move_later_at')||'0',10);}catch(e){}
    if(Date.now()-t<3*86400000)return;
    moveScreenShow();
  }else{
    /* 브라우저: 기록 올리고 바로 이동 (실패하면 안내 화면) */
    syncFlushAll(10000).then(function(ok){
      if(ok)location.replace(moveTarget());else moveScreenShow();
    });
  }
}
