/* ══════════════════════════════════════════
   스터디 타이머
   - 활성 세션을 localStorage(tm_active)에 영속화 →
     새로고침/백그라운드(모바일 Safari 리로드)에도 세션 유지.
   - 경과는 절대 시각(Date.now) 기준이라 백그라운드에서도 정확.
══════════════════════════════════════════ */
var tmState='idle'; /* idle | running | paused */
var tmStart=0, tmAccum=0, tmTick=null;
var tmLogs=[]; /* {date,subject,secs} */
var tmSubject='';
var tmPlanId=null,tmPlanStartMs=0; /* 플래너 항목 연동 */
(function(){
  try{var s=localStorage.getItem('tm_logs');if(s)tmLogs=JSON.parse(s);}catch(e){}
  tmActiveRestore();
})();
function tmSave(){try{localStorage.setItem('tm_logs',JSON.stringify(tmLogs));}catch(e){}}
function tmNow(){return Date.now();}
function tmElapsed(){return tmAccum+(tmState==='running'?tmNow()-tmStart:0);}

/* ── 활성 세션 영속화 ── */
function tmActiveSave(){
  try{
    if(tmState==='idle'){localStorage.removeItem('tm_active');return;}
    localStorage.setItem('tm_active',JSON.stringify({
      state:tmState,startTs:tmStart,accumMs:tmAccum,subject:tmSubject,
      planId:tmPlanId,planStart:tmPlanStartMs
    }));
  }catch(e){}
}
function tmActiveRestore(){
  try{
    var s=localStorage.getItem('tm_active');if(!s)return;
    var a=JSON.parse(s);
    if(a&&(a.state==='running'||a.state==='paused')){
      tmState=a.state;tmStart=a.startTs||tmNow();tmAccum=a.accumMs||0;tmSubject=a.subject||'';
      tmPlanId=a.planId||null;tmPlanStartMs=a.planStart||0;
    }
  }catch(e){}
}

function tmFmt(ms){
  var s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;
  return (h>0?h+':'+p2(m):p2(m))+':'+p2(sc); /* <1h → MM:SS, 이상 → H:MM:SS */
}
/* 타이머 버튼용 SVG 아이콘 */
var TM_IC={
  play:'<svg class="tm-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
  pause:'<svg class="tm-ic" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.6" height="14" rx="1.3"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.3"/></svg>',
  stop:'<svg class="tm-ic" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  save:'<svg class="tm-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 6.8"/></svg>',
  reset:'<svg class="tm-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 8.5V4.2M4.5 8.5H8.8M4.6 8.4a8 8 0 1 1-1.4 5"/></svg>'
};
function tmFmtShort(ms){
  var s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  if(h>0)return m>0?h+'시간 '+m+'분':h+'시간';
  if(m>0)return m+'분';
  return s+'초';
}
function tmTodayKey(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}

/* 인터벌 보장 — running이면 디스플레이를 갱신 (리로드 후 복귀 시에도) */
function tmEnsureTick(){
  if(tmState==='running'&&!tmTick){
    tmTick=setInterval(function(){
      var el=document.getElementById('tm-disp');
      if(el)el.textContent=tmFmt(tmElapsed());
    },500);
  }
}
function tmClearTick(){if(tmTick){clearInterval(tmTick);tmTick=null;}}

function tmStart_(){
  if(tmState==='idle'||tmState==='paused'){
    if(tmState==='idle')tmPlanStartMs=tmNow();
    tmStart=tmNow();tmState='running';
    tmEnsureTick();tmActiveSave();
    tmRenderHost();
  }
}
function tmPause(){
  if(tmState==='running'){
    tmAccum+=tmNow()-tmStart;tmState='paused';
    tmClearTick();tmActiveSave();
    tmRenderHost();
  }
}
function tmStop(){
  if(tmState==='idle')return;
  var elapsed=tmElapsed();
  tmClearTick();
  if(elapsed>3000){/* 3초 이상만 기록 */
    var subj=tmSubject||'기타';
    var key=tmTodayKey();
    /* 목표 달성 축하: 이번 기록으로 일일 목표를 처음 넘기는 순간 감지 */
    var goalSec=(typeof dashGoalMin==='function')?dashGoalMin()*60:0;
    var beforeSecs=(typeof dashDayTotal==='function')?dashDayTotal(key):0;
    var addSecs=Math.floor(elapsed/1000);
    var found=false;
    for(var i=0;i<tmLogs.length;i++){
      if(tmLogs[i].date===key&&tmLogs[i].subject===subj){
        tmLogs[i].secs+=addSecs;found=true;break;
      }
    }
    if(!found)tmLogs.push({date:key,subject:subj,secs:addSecs});
    tmSave();
    if(tmPlanId&&typeof planRecord==='function'){
      planRecord(tmPlanId,addSecs,tmPlanStartMs||tmNow()-elapsed,tmNow());
    }
    if(goalSec>0&&beforeSecs<goalSec&&(beforeSecs+addSecs)>=goalSec&&typeof dashCelebrate==='function'){
      dashCelebrate('오늘 목표를 채웠어요');
    }
  }
  tmAccum=0;tmState='idle';tmPlanId=null;tmPlanStartMs=0;tmActiveSave();
  tmRenderHost();
}
function tmReset(){
  tmClearTick();
  tmAccum=0;tmState='idle';tmPlanId=null;tmPlanStartMs=0;tmActiveSave();
  tmRenderHost();
}

/* 어느 뷰가 타이머를 품든 그 뷰를 다시 그림 (홈에 통합) */
function tmRenderHost(){
  if(typeof renderDashboard==='function')renderDashboard();
}

/* 타이머 카드 HTML — 홈(renderDashboard)에서 삽입해 사용 */
function tmCardHtml(){
  var running=tmState==='running',paused=tmState==='paused';
  return '<div class="tm-clock-card'+(running?' running':paused?' paused':'')+'">'+tmInnerHtml()+'</div>';
}
function tmInnerHtml(){
  var subjects=[],seen2={};
  for(var i=0;i<fsubj.length;i++){
    var s=fsubj[i];
    if(!isEx(s)&&!isEv(s)&&!seen2[s]){subjects.push(s);seen2[s]=true;}
  }
  subjects.sort();
  var running=tmState==='running',paused=tmState==='paused';

  var active=running||paused;
  var h='';
  if(active){
    /* 실행/일시정지: 과목 라이브 헤더 */
    h+='<div class="tm-live-head'+(running?' running':' paused')+'">';
    h+='<span class="tm-live-dot"></span>';
    h+='<span class="tm-live-txt">'+(running?'집중 중':'일시정지')+(tmSubject?' · '+escHtml(tmSubject):'')+'</span>';
    h+='</div>';
  } else {
    /* 대기: 과목 선택 */
    h+='<div class="tm-subj-wrap">';
    h+='<select class="tm-subject-select" id="tm-subj">';
    h+='<option value="">과목 선택</option>';
    for(var si=0;si<subjects.length;si++){
      var sel=(tmSubject===subjects[si])?' selected':'';
      h+='<option value="'+escHtml(subjects[si])+'"'+sel+'>'+escHtml(subjects[si])+'</option>';
    }
    h+='</select>';
    h+='<svg class="tm-subj-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    h+='</div>';
  }
  h+='<div class="tm-display'+(running?' running':paused?' paused':'')+'" id="tm-disp">'+tmFmt(tmElapsed())+'</div>';
  h+='<div class="tm-btns">';
  if(tmState==='idle'){
    h+='<button class="tm-btn tm-btn-start" id="tm-start">'+TM_IC.play+'공부 시작</button>';
  } else if(running){
    h+='<button class="tm-btn tm-btn-pause" id="tm-pause">'+TM_IC.pause+'일시정지</button>';
    h+='<button class="tm-btn tm-btn-stop" id="tm-stop">'+TM_IC.stop+'종료</button>';
  } else {
    h+='<button class="tm-btn tm-btn-start" id="tm-start">'+TM_IC.play+'재개</button>';
    h+='<button class="tm-btn tm-btn-stop" id="tm-stop">'+TM_IC.save+'기록 저장</button>';
    h+='<button class="tm-btn tm-btn-reset" id="tm-reset" title="초기화">'+TM_IC.reset+'</button>';
  }
  h+='</div>';
  return h;
}

/* 타이머 카드 이벤트 바인딩 — innerHTML 세팅 후 호출 */
function tmBind(){
  tmEnsureTick();
  var subjEl=document.getElementById('tm-subj');
  if(subjEl)subjEl.onchange=function(){tmSubject=this.value;tmActiveSave();if(tmState!=='idle')tmRenderHost();};
  var startEl=document.getElementById('tm-start');
  var pauseEl=document.getElementById('tm-pause');
  var stopEl=document.getElementById('tm-stop');
  var resetEl=document.getElementById('tm-reset');
  if(startEl)startEl.onclick=function(){var e=document.getElementById('tm-subj');if(e)tmSubject=e.value;tmStart_();};
  if(pauseEl)pauseEl.onclick=tmPause;
  if(stopEl)stopEl.onclick=tmStop;
  if(resetEl)resetEl.onclick=tmReset;
}
