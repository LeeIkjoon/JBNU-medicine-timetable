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
      state:tmState,startTs:tmStart,accumMs:tmAccum,subject:tmSubject
    }));
  }catch(e){}
}
function tmActiveRestore(){
  try{
    var s=localStorage.getItem('tm_active');if(!s)return;
    var a=JSON.parse(s);
    if(a&&(a.state==='running'||a.state==='paused')){
      tmState=a.state;tmStart=a.startTs||tmNow();tmAccum=a.accumMs||0;tmSubject=a.subject||'';
    }
  }catch(e){}
}

function tmFmt(ms){
  var s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;
  return p2(h)+':'+p2(m)+':'+p2(sc);
}
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
    if(goalSec>0&&beforeSecs<goalSec&&(beforeSecs+addSecs)>=goalSec&&typeof dashCelebrate==='function'){
      dashCelebrate('오늘 목표를 채웠어요');
    }
  }
  tmAccum=0;tmState='idle';tmActiveSave();
  tmRenderHost();
}
function tmReset(){
  tmClearTick();
  tmAccum=0;tmState='idle';tmActiveSave();
  tmRenderHost();
}

/* 어느 뷰가 타이머를 품든 그 뷰를 다시 그림 (홈에 통합) */
function tmRenderHost(){
  if(typeof renderDashboard==='function')renderDashboard();
}

/* 타이머 카드 HTML — 홈(renderDashboard)에서 삽입해 사용 */
function tmCardHtml(){
  var subjects=[],seen2={};
  for(var i=0;i<fsubj.length;i++){
    var s=fsubj[i];
    if(!isEx(s)&&!isEv(s)&&!seen2[s]){subjects.push(s);seen2[s]=true;}
  }
  subjects.sort();
  var running=tmState==='running',paused=tmState==='paused';

  var h='<div class="tm-clock-card'+(running?' running':'')+'">';
  h+='<select class="tm-subject-select" id="tm-subj">';
  h+='<option value="">과목 선택...</option>';
  for(var si=0;si<subjects.length;si++){
    var sel=(tmSubject===subjects[si])?' selected':'';
    h+='<option value="'+escHtml(subjects[si])+'"'+sel+'>'+escHtml(subjects[si])+'</option>';
  }
  h+='</select>';
  if(running)h+='<div class="tm-state-badge running">● 집중 중'+(tmSubject?' · '+escHtml(tmSubject):'')+'</div>';
  else if(paused)h+='<div class="tm-state-badge paused">⏸ 일시정지'+(tmSubject?' · '+escHtml(tmSubject):'')+'</div>';
  h+='<div class="tm-display'+(running?' running':'')+'" id="tm-disp">'+tmFmt(tmElapsed())+'</div>';
  h+='<div class="tm-btns">';
  if(tmState==='idle'){
    h+='<button class="tm-btn tm-btn-start" id="tm-start">▶ 공부 시작</button>';
  } else if(running){
    h+='<button class="tm-btn tm-btn-pause" id="tm-pause">⏸ 일시정지</button>';
    h+='<button class="tm-btn tm-btn-stop" id="tm-stop">⏹ 종료</button>';
  } else {
    h+='<button class="tm-btn tm-btn-start" id="tm-start">▶ 재개</button>';
    h+='<button class="tm-btn tm-btn-stop" id="tm-stop">⏹ 기록저장</button>';
    h+='<button class="tm-btn tm-btn-reset" id="tm-reset">↺</button>';
  }
  h+='</div></div>';
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
