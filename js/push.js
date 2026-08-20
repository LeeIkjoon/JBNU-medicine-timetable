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
        grade:savedGrade||'',sec:secSel()||'',sub:JSON.stringify(sub),ts:Date.now()
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
  fbDb.ref('push/'+syncUid()).update({grade:savedGrade||'',sec:secSel()||''}).catch(function(){});
}

function pushCardHtml(){
  var h='<div class="dash-card"><div class="dash-card-ttl">알림</div>';
  var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(!pushSupported()||(isIOS&&!pushStandalone())){
    h+='<div class="sync-desc">'+(isIOS
      ?'홈 화면에 추가한 앱에서 알림을 켤 수 있어요 (공유 → 홈 화면에 추가)'
      :'이 브라우저는 알림을 지원하지 않아요')+'</div></div>';
    return h;
  }
  h+='<div class="push-row">'
    +'<div><div class="push-ttl">아침 수업 알림</div>'
    +'<div class="sync-desc" style="margin-top:2px">매일 아침 7시 반쯤 오늘 수업·시험을 알려드려요</div></div>'
    +'<button class="push-toggle'+(pushEnabled()?' on':'')+'" id="push-toggle"><span class="push-knob"></span></button>'
    +'</div>';
  h+='<div class="sync-warn" id="push-msg" style="display:none"></div>';
  h+='</div>';
  return h;
}
function pushBind(){
  pushMetaUpdate();
  var t=document.getElementById('push-toggle');
  if(!t)return;
  t.onclick=function(){
    var msg=document.getElementById('push-msg');
    var done=function(err){
      if(err&&msg){msg.textContent=err;msg.style.display='block';}
      renderDashboard();
    };
    if(pushEnabled())pushDisable(done);else pushEnable(done);
  };
}
