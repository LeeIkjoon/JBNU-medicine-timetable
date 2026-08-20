var fbDb = null;
try {
  var _fbCfg = {
    apiKey: "AIzaSyBZ6wJKM4sku2ag0Ac2idDgKnl85_Ctuc4",
    authDomain: "jbnu-med-timetable.firebaseapp.com",
    databaseURL: "https://jbnu-med-timetable-default-rtdb.firebaseio.com",
    projectId: "jbnu-med-timetable",
    storageBucket: "jbnu-med-timetable.firebasestorage.app",
    messagingSenderId: "679126215673",
    appId: "1:679126215673:web:2ab9ba2f5170b43d61eb28"
  };
  firebase.initializeApp(_fbCfg);
  fbDb = firebase.database();
} catch(e) {
  console.warn('Firebase 초기화 실패:', e.message);
}

function checkSharedUpdate(){}  /* Firebase listener로 대체 */

/* ── Firebase 헬퍼 ── */
function fbGradeKey(grade){
  var m={'의학과 1학년':'med1','의학과 2학년':'med2','의예과 2학년':'premed2'};
  return m[grade]||grade.replace(/\s/g,'_');
}
function fbRef(grade){
  if(!fbDb||!grade) return null;
  return fbDb.ref('timetable/'+fbGradeKey(grade));
}

/* Firebase 데이터를 받아서 시간표에 적용 */
function applyFirebaseData(data){
  if(!data||!data.items||!data.items.length) return;
  /* Firebase가 항상 최신 - 로컬 캐시와 비교 없이 바로 적용 */
  var prevTs=0;
  try{ prevTs=(JSON.parse(localStorage.getItem(ttKey())||'{}').ts)||0; }catch(e){}
  var newTs=data.ts||0;
  /* 완전히 같은 데이터면 skip (불필요한 re-render 방지) */
  if(newTs && newTs===prevTs) return;

  /* 변경 내역 저장 (비관리자에게 나중에 표시) */
  var isUpdate=prevTs>0 && newTs && newTs!==prevTs;
  var changelogEntry=data.changelog||null;
  if(changelogEntry && isUpdate && !isAdmin){
    try{
      var logs=JSON.parse(localStorage.getItem('changelog_'+fbGradeKey(savedGrade))||'[]');
      /* 동일 타임스탬프 중복 방지 */
      if(!logs.some(function(l){return l.ts===changelogEntry.ts;})){
        logs.unshift(changelogEntry);
        if(logs.length>20)logs=logs.slice(0,20);
        localStorage.setItem('changelog_'+fbGradeKey(savedGrade),JSON.stringify(logs));
      }
    }catch(e){}
  }

  merged.length=0;
  data.items.forEach(function(it){merged.push(it);});
  if(data.wdd){
    Object.keys(wdd).forEach(function(k){delete wdd[k];});
    Object.keys(data.wdd).forEach(function(wk){wdd[wk]=data.wdd[wk];});
  }
  if(data.wks&&data.wks.length){
    wks.length=0;
    data.wks.forEach(function(w){wks.push(w);});
  }
  if(data.ed){ed.length=0;data.ed.forEach(function(d){ed.push(d);});}
  buildFromItems(merged,wdd,ed);
  _subjColorMap=null;
  try{localStorage.setItem(ttKey(),JSON.stringify({items:merged,wdd:wdd,ed:ed,grade:savedGrade,ts:newTs||Date.now()}));}catch(e){}
  goTodayWeek(); /* 새 학기 데이터로 바뀌면 주차 인덱스 재계산 */
  render();
  /* 초기 로드가 아닌 실시간 업데이트일 때만 알림 */
  if(isUpdate && !isAdmin){
    if(changelogEntry && changelogEntry.msg){
      showChangelogBanner(changelogEntry);
    } else {
      var toast=document.getElementById('update-toast');
      if(toast){
        toast.textContent='📢 시간표가 업데이트되었습니다!';
        toast.className='update-toast show';
        setTimeout(function(){toast.className='update-toast';},3500);
      }
    }
  } else if(!isUpdate && !isAdmin && prevTs===0){
    /* 앱 첫 접속 시 미확인 변경 내역 있으면 배너 표시 */
    showUnreadChangelogBanner();
  }
}

/* 변경 내역 배너 표시 */
function showChangelogBanner(entry){
  removeChangelogBanner();
  var banner=document.createElement('div');
  banner.id='changelog-banner';
  banner.className='changelog-banner';
  banner.innerHTML='<span class="changelog-banner-icon">🔔</span>'+
    '<span class="changelog-banner-text">시간표 변경: '+escHtml(entry.msg.substring(0,50))+(entry.msg.length>50?'..':'')+' <span style="opacity:.7;font-size:11px;">탭하여 내역 보기</span></span>'+
    '<span class="changelog-banner-arrow">›</span>';
  banner.onclick=function(){openChangelogModal();};
  document.body.appendChild(banner);
  /* 읽음 처리용 마지막 확인 ts 저장 */
  try{localStorage.setItem('changelog_seen_'+fbGradeKey(savedGrade), entry.ts+'');}catch(e){}
}

/* 미확인 내역 배너 (앱 접속 시) */
function showUnreadChangelogBanner(){
  try{
    var logs=JSON.parse(localStorage.getItem('changelog_'+fbGradeKey(savedGrade))||'[]');
    if(!logs.length) return;
    var lastSeen=parseInt(localStorage.getItem('changelog_seen_'+fbGradeKey(savedGrade))||'0');
    var unread=logs.filter(function(l){return l.ts>lastSeen;});
    if(!unread.length) return;
    removeChangelogBanner();
    var banner=document.createElement('div');
    banner.id='changelog-banner';
    banner.className='changelog-banner';
    banner.innerHTML='<span class="changelog-banner-icon">🔔</span>'+
      '<span class="changelog-banner-text">미확인 시간표 변경 '+unread.length+'건 <span style="opacity:.7;font-size:11px;">탭하여 내역 보기</span></span>'+
      '<span class="changelog-banner-arrow">›</span>';
    banner.onclick=function(){openChangelogModal();};
    document.body.appendChild(banner);
  }catch(e){}
}

function removeChangelogBanner(){
  var old=document.getElementById('changelog-banner');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
}


/* 변경 내역 모달 */
function openChangelogModal(){
  removeChangelogBanner();
  try{
    var logs=JSON.parse(localStorage.getItem('changelog_'+fbGradeKey(savedGrade))||'[]');
    /* 읽음 처리 */
    if(logs.length) localStorage.setItem('changelog_seen_'+fbGradeKey(savedGrade), logs[0].ts+'');
    var ovl=document.createElement('div');
    ovl.className='changelog-modal-ovl';
    ovl.onclick=function(e){if(e.target===ovl&&ovl.parentNode)ovl.parentNode.removeChild(ovl);};
    var modal=document.createElement('div');
    modal.className='changelog-modal';
    var hdr='<div class="changelog-modal-hdr"><div class="changelog-modal-title">📋 시간표 변경 내역</div>'+
      '<button class="changelog-modal-close" onclick="this.closest(\'.changelog-modal-ovl\').remove()">✕</button></div>';
    var body='';
    if(!logs.length){
      body='<div style="color:#8E8E93;font-size:13px;text-align:center;padding:20px 0;">변경 내역이 없습니다.</div>';
    } else {
      logs.forEach(function(entry){
        var d=new Date(entry.ts);
        var ds=d.getFullYear()+'.'+(d.getMonth()+1)+'.'+(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes());
        body+='<div class="changelog-item"><div class="changelog-item-date">'+ds+'</div>'+
          '<div class="changelog-item-msg">'+escHtml(entry.msg)+'</div></div>';
      });
    }
    modal.innerHTML=hdr+body;
    ovl.appendChild(modal);
    document.body.appendChild(ovl);
  }catch(e){}
}

/* 최초 1회 로드 */
function loadFromFirebase(){
  var ref=fbRef(savedGrade);
  if(!ref) return;
  ref.once('value').then(function(snap){
    applyFirebaseData(snap.val());
  }).catch(function(e){console.warn('Firebase load:',e);});
}

/* 실시간 리스너 (비관리자용) */
var _fbListener=null;
var _fbListenerGrade=null;
function startFirebaseListener(){
  if(_fbListener&&_fbListenerGrade===savedGrade) return;
  stopFirebaseListener();
  var ref=fbRef(savedGrade);
  if(!ref) return;
  _fbListenerGrade=savedGrade;
  _fbListener=ref.on('value',function(snap){
    if(isAdmin) return; /* 관리자 편집 중엔 수신 무시 */
    applyFirebaseData(snap.val());
  },function(err){
    console.warn('Firebase 리스너 오류:',err);
  });
}
function stopFirebaseListener(){
  if(_fbListenerGrade&&_fbListener){
    var ref=fbRef(_fbListenerGrade);
    if(ref) ref.off('value',_fbListener);
  }
  _fbListener=null;
  _fbListenerGrade=null;
}
function initFirebaseListener(){
  startFirebaseListener();
}
