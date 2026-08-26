/* ══════════════════════════════════════════
   푸시 알림 — Web Push (VAPID) + Firebase push/<코드>에 구독 저장
   발송은 Vercel cron(/api/notify)이 매일 아침 처리
══════════════════════════════════════════ */
var PUSH_PUB='BCkC8VtIz5bDEr4d4jwI2GVHGJ3l5szqgmhqSCSfWeZfeJTTGkjpg-yZ4NvU9A03aGyiqYb-MJe-MZoYuA_V-lo';

/* 서비스워커 등록 (푸시 전용) */
if('serviceWorker' in navigator){
  try{navigator.serviceWorker.register('sw.js');}catch(e){}
}

function pushSupported(){
  return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
}
function pushStandalone(){
  return window.navigator.standalone===true||
    (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
}
function pushEnabled(){try{return localStorage.getItem('push_on')==='1';}catch(e){return false;}}

function pushB64ToU8(s){
  var pad='='.repeat((4-s.length%4)%4);
  var b64=(s+pad).replace(/-/g,'+').replace(/_/g,'/');
  var raw=atob(b64),arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return arr;
}

function pushEnable(cb){
  Notification.requestPermission().then(function(p){
    if(p!=='granted'){cb('알림 권한이 꺼져 있어요. 설정에서 허용해주세요');return;}
    navigator.serviceWorker.ready.then(function(reg){
      return reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:pushB64ToU8(PUSH_PUB)
      });
    }).then(function(sub){
      if(!fbDb)throw new Error('no-db');
      return fbDb.ref('push/'+syncUid()).set({
        grade:savedGrade||'',school:savedSchool||'jbnu',key:fbGradeKey(savedGrade||''),
        sec:secSel()||'',sub:JSON.stringify(sub),ts:Date.now()
      });
    }).then(function(){
      try{localStorage.setItem('push_on','1');}catch(e){}
      cb(null);
    }).catch(function(){cb('알림 등록에 실패했어요');});
  }).catch(function(){cb('알림 등록에 실패했어요');});
}

function pushDisable(cb){
  navigator.serviceWorker.ready.then(function(reg){
    return reg.pushManager.getSubscription();
  }).then(function(sub){
    if(sub)return sub.unsubscribe();
  }).then(function(){
    if(fbDb)return fbDb.ref('push/'+syncUid()).remove();
  }).then(function(){
    try{localStorage.setItem('push_on','0');}catch(e){}
    cb(null);
  }).catch(function(){
    try{localStorage.setItem('push_on','0');}catch(e){}
    cb(null);
  });
}

/* 학년·분반 변경 시 구독 메타 갱신 */
function pushMetaUpdate(){
  if(!pushEnabled()||!fbDb)return;
  fbDb.ref('push/'+syncUid()).update({grade:savedGrade||'',school:savedSchool||'jbnu',key:fbGradeKey(savedGrade||''),sec:secSel()||''}).catch(function(){});
}

/* ── 헤더 벨 버튼 ── */
function pushToast(msg){
  var t=document.getElementById('update-toast');
  if(!t)return;
  t.textContent=msg;
  t.className='update-toast show';
  setTimeout(function(){t.className='update-toast';},3000);
}
function pushBtnUpdate(){
  var b=document.getElementById('push-btn');if(!b)return;
  b.classList.toggle('on',pushEnabled());
}
(function(){
  var b=document.getElementById('push-btn');if(!b)return;
  pushBtnUpdate();
  pushMetaUpdate();
  b.onclick=function(){
    var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(!pushSupported()||(isIOS&&!pushStandalone())){
      pushToast(isIOS?'홈 화면에 추가한 앱에서 알림을 켤 수 있어요':'이 브라우저는 알림을 지원하지 않아요');
      return;
    }
    if(pushEnabled()){
      pushDisable(function(){pushBtnUpdate();pushToast('아침 수업 알림을 껐어요');});
    }else{
      pushEnable(function(err){
        pushBtnUpdate();
        pushToast(err||'매일 아침 오늘 수업·시험을 알려드릴게요');
      });
    }
  };
})();
