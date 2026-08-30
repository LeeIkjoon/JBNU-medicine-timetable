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
function pushHour(){var h=parseInt(localStorage.getItem('push_hour')||'7',10);return (h>=6&&h<=10)?h:7;}

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
        sec:secSel()||'',hour:pushHour(),sub:JSON.stringify(sub),ts:Date.now()
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
  fbDb.ref('push/'+syncUid()).update({grade:savedGrade||'',school:savedSchool||'jbnu',key:fbGradeKey(savedGrade||''),sec:secSel()||'',hour:pushHour()}).catch(function(){});
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
    openPushSheet();
  };
})();

/* ── 알림 설정 시트 (시간 선택 + 켬/끔) ── */
function openPushSheet(){
  var on=pushEnabled(),cur=pushHour();
  var h='<div class="cls-date">아침 수업 알림</div>'
    +'<div class="el-desc">매일 아침 오늘 수업·시험 요약을 보내드려요. 받고 싶은 시간을 고르세요.</div>'
    +'<div class="push-hours">';
  [6,7,8,9,10].forEach(function(hh){
    h+='<button class="push-hr'+(hh===cur?' on':'')+'" data-h="'+hh+'">'+hh+':30</button>';
  });
  h+='</div>';
  h+='<button class="edit-save" id="push-save" style="margin-top:14px">'+(on?'저장':'알림 켜기')+'</button>';
  if(on)h+='<button class="cls-act danger" id="push-off" style="width:100%;margin-top:8px">알림 끄기</button>';
  document.getElementById('cls-body').innerHTML=h;
  var ovl=document.getElementById('cls-ovl');
  ovl.className='cls-ovl show';
  ovl.onclick=function(e){if(e.target===ovl)closeClassInfo();};
  var cx=document.getElementById('cls-x');
  if(cx)cx.onclick=function(e){e.stopPropagation();closeClassInfo();};
  var sel=cur;
  document.querySelectorAll('.push-hr').forEach(function(bt){
    bt.onclick=function(){
      sel=parseInt(this.getAttribute('data-h'),10);
      document.querySelectorAll('.push-hr').forEach(function(x){x.classList.remove('on');});
      this.classList.add('on');
    };
  });
  document.getElementById('push-save').onclick=function(){
    try{localStorage.setItem('push_hour',String(sel));}catch(e){}
    closeClassInfo();
    if(pushEnabled()){
      pushMetaUpdate();
      pushToast('알림 시간을 '+sel+':30으로 바꿨어요');
    }else{
      pushEnable(function(err){
        pushBtnUpdate();
        pushToast(err||'매일 아침 '+sel+':30에 알려드릴게요');
      });
    }
  };
  var off=document.getElementById('push-off');
  if(off)off.onclick=function(){
    closeClassInfo();
    pushDisable(function(){pushBtnUpdate();pushToast('아침 수업 알림을 껐어요');});
  };
}
