/* ══════════════════════════════════════════
   대시보드 (홈) — 공부 동기부여
   tmLogs(공부시간) + merged(시험) + plTodos(할일) 집계
══════════════════════════════════════════ */

/* ── 일일 목표 (분) ── */
function dashGoalMin(){
  var v=parseInt(localStorage.getItem('study_goal_min'),10);
  return (v&&v>0)?v:240; /* 기본 4시간 */
}
function dashSetGoal(min){
  min=Math.max(30,Math.min(720,min)); /* 30분 ~ 12시간 */
  try{localStorage.setItem('study_goal_min',min);}catch(e){}
}

/* ── 날짜/집계 헬퍼 ── */
function dashYmd(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function dashDayTotal(key){
  return tmLogs.filter(function(l){return l.date===key;}).reduce(function(a,l){return a+l.secs;},0);
}
/* 연속 공부 일수 — 오늘 공부했으면 오늘 포함, 아니면 어제부터 카운트(아직 만회 가능) */
function dashStreak(){
  var n=0,d=new Date();
  if(dashDayTotal(dashYmd(d))===0)d.setDate(d.getDate()-1);
  while(dashDayTotal(dashYmd(d))>0){n++;d.setDate(d.getDate()-1);}
  return n;
}
function dashWeekTotal(){
  var now=new Date(),dow=now.getDay(),sum=0;
  for(var i=0;i<7;i++){var dd=new Date(now);dd.setDate(now.getDate()-dow+i);sum+=dashDayTotal(dashYmd(dd));}
  return sum;
}
function dashMonthTotal(){
  var now=new Date(),pre=now.getFullYear()+'-'+p2(now.getMonth()+1)+'-';
  return tmLogs.filter(function(l){return l.date.indexOf(pre)===0;}).reduce(function(a,l){return a+l.secs;},0);
}
function dashTotalAll(){return tmLogs.reduce(function(a,l){return a+l.secs;},0);}

/* 최장 연속 공부일 (전체 기록 기준) */
function dashBestStreak(){
  var set={};
  tmLogs.forEach(function(l){if(l.secs>0)set[l.date]=1;});
  var keys=Object.keys(set).sort();
  if(!keys.length)return 0;
  function num(s){var p=s.split('-');return Math.round(new Date(+p[0],+p[1]-1,+p[2])/86400000);}
  var best=1,cur=1;
  for(var i=1;i<keys.length;i++){
    if(num(keys[i])-num(keys[i-1])===1){cur++;if(cur>best)best=cur;}
    else cur=1;
  }
  return best;
}
/* 학습 기록 히트맵 — 최근 N주, 열=주(일~토), 행=요일. 미래/공부없음 단계 0~4 */
function dashHeatmap(weeks){
  var now=new Date(),dow=now.getDay(),todayK=dashYmd(now);
  var goalSec=dashGoalMin()*60;
  var start=new Date(now);start.setDate(now.getDate()-dow-(weeks-1)*7); /* (weeks-1)주 전 일요일 */
  var cells=[]; /* 열 우선: 주 → 요일 */
  for(var w=0;w<weeks;w++){
    for(var d=0;d<7;d++){
      var cd=new Date(start);cd.setDate(start.getDate()+w*7+d);
      var k=dashYmd(cd);
      if(k>todayK){cells.push({date:k,level:-1});continue;} /* 미래 */
      var secs=dashDayTotal(k),lvl;
      if(secs<=0)lvl=0;
      else{var r=goalSec>0?secs/goalSec:0;lvl=r>=1?4:r>=0.5?3:r>=0.25?2:1;}
      cells.push({date:k,secs:secs,level:lvl,isToday:k===todayK});
    }
  }
  return cells;
}

/* 목표 달성 축하 토스트 (어디서든 호출 가능) */
function dashCelebrate(msg){
  var el=document.getElementById('dash-celebrate');
  if(el)el.parentNode.removeChild(el);
  el=document.createElement('div');
  el.id='dash-celebrate';el.className='dash-celebrate';
  el.innerHTML='<div class="dash-celebrate-check">✓</div><div class="dash-celebrate-msg">'+escHtml(msg||'오늘 목표를 채웠어요')+'</div>';
  document.body.appendChild(el);
  /* reflow 후 in 클래스로 애니메이션 */
  void el.offsetWidth;el.classList.add('in');
  setTimeout(function(){el.classList.remove('in');},2600);
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},3100);
}

/* D-day 일수 (자정 기준) */
function dashDday(dateStr){
  var t=new Date();t.setHours(0,0,0,0);
  var p=dateStr.split('-');
  var d=new Date(+p[0],+p[1]-1,+p[2]);
  return Math.round((d-t)/86400000);
}
/* 다가오는 시험 (오늘 이후, 날짜+과목 중복 제거, 가까운 순) */
function dashUpcomingExams(){
  var todayK=dashYmd(new Date()),seen={},out=[];
  var rows=merged.filter(function(m){return m.is_exam&&m.date>=todayK;})
    .sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  for(var i=0;i<rows.length;i++){
    var k=rows[i].date+'|'+rows[i].subject;
    if(seen[k])continue;seen[k]=true;
    out.push({date:rows[i].date,subject:rows[i].subject,dday:dashDday(rows[i].date)});
  }
  return out;
}

/* 이번 주 과목별 공부시간 */
function dashWeekBySubject(){
  var now=new Date(),dow=now.getDay();
  var s=new Date(now);s.setDate(now.getDate()-dow);var sk=dashYmd(s);
  var e=new Date(now);e.setDate(now.getDate()-dow+6);var ek=dashYmd(e);
  var map={};
  tmLogs.forEach(function(l){if(l.date>=sk&&l.date<=ek)map[l.subject]=(map[l.subject]||0)+l.secs;});
  return Object.keys(map).map(function(k){return {subject:k,secs:map[k]};})
    .sort(function(a,b){return b.secs-a.secs;});
}

/* 동기부여 카피 */
function dashGreeting(todaySecs,goalSec){
  var h=new Date().getHours();
  var greet=h<6?'늦은 밤':h<12?'아침':h<18?'오후':'저녁';
  var pct=goalSec>0?todaySecs/goalSec:0,msg;
  if(todaySecs===0)msg='오늘 기록이 아직 없어요';
  else if(pct<1)msg='목표까지 '+tmFmtShort(Math.max(0,goalSec-todaySecs)*1000)+' 남음';
  else msg='오늘 목표 달성';
  return {greet:greet,msg:msg};
}

function renderDashboard(){
  var todayKey=dashYmd(new Date());
  var todaySecs=dashDayTotal(todayKey);
  var goalMin=dashGoalMin(),goalSec=goalMin*60;
  var pct=goalSec>0?Math.min(1,todaySecs/goalSec):0;
  var pctLabel=Math.round((goalSec>0?todaySecs/goalSec:0)*100);
  var achieved=goalSec>0&&todaySecs>=goalSec;
  var streak=dashStreak();
  var best=dashBestStreak();
  var g=dashGreeting(todaySecs,goalSec);

  /* 목표 라벨 (분 → "N시간 M분") */
  var gh=Math.floor(goalMin/60),gm=goalMin%60;
  var goalLabel=(gh?gh+'시간':'')+(gm?(gh?' ':'')+gm+'분':'')||goalMin+'분';

  /* SVG 링 */
  var R=52,C=2*Math.PI*R,off=C*(1-pct);

  var h='<div class="dash-wrap">';

  /* 인사 */
  h+='<div class="dash-greet">';
  h+='<div class="dash-greet-top">'+g.greet+'</div>';
  h+='<div class="dash-greet-msg">'+g.msg+'</div>';
  h+='</div>';

  /* 메인 링 — 오늘 공부시간 vs 목표 */
  h+='<div class="dash-ring-card'+(achieved?' achieved':'')+'">';
  h+='<div class="dash-ring-box">';
  h+='<svg class="dash-ring" viewBox="0 0 120 120">';
  h+='<defs><linearGradient id="dashGrad" x1="0" y1="0" x2="1" y2="1">';
  h+='<stop offset="0" class="dash-grad-0"/><stop offset="1" class="dash-grad-1"/>';
  h+='</linearGradient></defs>';
  h+='<circle class="dash-ring-bg" cx="60" cy="60" r="'+R+'"/>';
  h+='<circle class="dash-ring-fg" cx="60" cy="60" r="'+R+'" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>';
  h+='</svg>';
  h+='<div class="dash-ring-center">';
  h+='<div class="dash-ring-time">'+tmFmtShort(todaySecs*1000)+'</div>';
  if(achieved)h+='<div class="dash-ring-sub achieved">목표 달성</div>';
  else h+='<div class="dash-ring-sub">목표 '+goalLabel+' · '+pctLabel+'%</div>';
  h+='</div>';
  h+='</div>';

  /* 목표 조절 */
  h+='<div class="dash-goal-row">';
  h+='<button class="dash-goal-btn" id="dash-goal-minus">−</button>';
  h+='<span class="dash-goal-lbl">일일 목표 '+goalLabel+'</span>';
  h+='<button class="dash-goal-btn" id="dash-goal-plus">+</button>';
  h+='</div>';

  h+='</div>'; /* close ring card */

  /* 라이브 공부 타이머 (홈에 통합) */
  if(typeof tmCardHtml==='function')h+=tmCardHtml();

  /* 스트릭 + 누적 */
  h+='<div class="dash-stat-grid">';
  h+='<div class="dash-stat">';
  h+='<div class="dash-stat-n">'+streak+'<span class="dash-stat-unit">일</span></div>';
  h+='<div class="dash-stat-l">연속 공부'+(best>0?' · 최고 '+best+'일':'')+'</div>';
  h+='</div>';
  h+='<div class="dash-stat">';
  h+='<div class="dash-stat-n">'+tmFmtShort(dashWeekTotal()*1000)+'</div>';
  h+='<div class="dash-stat-l">이번 주</div>';
  h+='</div>';
  h+='<div class="dash-stat">';
  h+='<div class="dash-stat-n">'+tmFmtShort(dashMonthTotal()*1000)+'</div>';
  h+='<div class="dash-stat-l">이번 달</div>';
  h+='</div>';
  h+='<div class="dash-stat">';
  h+='<div class="dash-stat-n">'+tmFmtShort(dashTotalAll()*1000)+'</div>';
  h+='<div class="dash-stat-l">전체 누적</div>';
  h+='</div>';
  h+='</div>';

  /* 시험 D-day */
  var exams=dashUpcomingExams();
  if(exams.length){
    h+='<div class="dash-card">';
    h+='<div class="dash-card-ttl">다가오는 시험</div>';
    h+='<div class="dash-exam-list">';
    for(var i=0;i<Math.min(exams.length,4);i++){
      var ex=exams[i];
      var ddClass=ex.dday<=3?' urgent':ex.dday<=7?' soon':'';
      h+='<div class="dash-exam-item">';
      h+='<span class="dash-exam-dday'+ddClass+'">'+(ex.dday===0?'D-DAY':'D-'+ex.dday)+'</span>';
      h+='<span class="dash-exam-subj">'+escHtml(ex.subject)+'</span>';
      h+='<span class="dash-exam-date">'+ex.date.slice(5).replace('-','/')+'</span>';
      h+='</div>';
    }
    h+='</div></div>';
  }

  /* 주간 그래프 */
  var weekData=[],now=new Date(),dow=now.getDay();
  var WN3=['일','월','화','수','목','금','토'];
  for(var wi=0;wi<7;wi++){
    var dd2=new Date(now);dd2.setDate(now.getDate()-dow+wi);
    var dk=dashYmd(dd2);
    weekData.push({lbl:WN3[wi],secs:dashDayTotal(dk),isToday:wi===dow});
  }
  var maxW=Math.max.apply(null,weekData.map(function(d){return d.secs;}));
  h+='<div class="dash-card">';
  h+='<div class="dash-card-ttl">주간 공부량</div>';
  h+='<div class="dash-week-bars">';
  for(var wj=0;wj<weekData.length;wj++){
    var wd=weekData[wj];
    var barH=maxW>0?Math.round(wd.secs/maxW*64):0;
    h+='<div class="dash-wbar-wrap">';
    if(wd.secs>0)h+='<div class="dash-wbar-val">'+tmFmtShort(wd.secs*1000)+'</div>';
    h+='<div class="dash-wbar-track"><div class="dash-wbar'+(wd.isToday?' today':'')+'" style="height:'+Math.max(barH,wd.secs>0?4:0)+'px"></div></div>';
    h+='<span class="dash-wbar-lbl'+(wd.isToday?' today':'')+'">'+wd.lbl+'</span>';
    h+='</div>';
  }
  h+='</div></div>';

  /* 공부 잔디 (최근 14주) */
  var HMW=14,cells=dashHeatmap(HMW);
  h+='<div class="dash-card">';
  h+='<div class="dash-card-ttl">학습 기록 <span class="dash-hm-cap">최근 '+HMW+'주</span></div>';
  h+='<div class="dash-hm-grid">';
  for(var ci2=0;ci2<cells.length;ci2++){
    var c=cells[ci2];
    if(c.level<0){h+='<div class="dash-hm-cell empty"></div>';continue;}
    h+='<div class="dash-hm-cell lvl'+c.level+(c.isToday?' today':'')+'" title="'+c.date+' · '+tmFmtShort(c.secs*1000)+'"></div>';
  }
  h+='</div>';
  h+='<div class="dash-hm-legend"><span>적음</span><i class="dash-hm-cell lvl0"></i><i class="dash-hm-cell lvl1"></i><i class="dash-hm-cell lvl2"></i><i class="dash-hm-cell lvl3"></i><i class="dash-hm-cell lvl4"></i><span>많음</span></div>';
  h+='</div>';

  /* 과목별 비중 (이번 주) */
  var bySubj=dashWeekBySubject();
  if(bySubj.length){
    var maxS=bySubj[0].secs;
    h+='<div class="dash-card">';
    h+='<div class="dash-card-ttl">이번 주 과목별</div>';
    h+='<div class="dash-subj-list">';
    for(var si=0;si<Math.min(bySubj.length,6);si++){
      var bs=bySubj[si],sp=maxS>0?Math.round(bs.secs/maxS*100):0;
      h+='<div class="dash-subj-item">';
      h+='<span class="dash-subj-name">'+escHtml(bs.subject)+'</span>';
      h+='<div class="dash-subj-bar-wrap"><div class="dash-subj-bar" style="width:'+sp+'%"></div></div>';
      h+='<span class="dash-subj-time">'+tmFmtShort(bs.secs*1000)+'</span>';
      h+='</div>';
    }
    h+='</div></div>';
  }

  h+='</div>';
  document.getElementById('main').innerHTML=h;

  /* 이벤트 */
  document.getElementById('dash-goal-minus').onclick=function(){dashSetGoal(dashGoalMin()-30);renderDashboard();};
  document.getElementById('dash-goal-plus').onclick=function(){dashSetGoal(dashGoalMin()+30);renderDashboard();};
  if(typeof tmBind==='function')tmBind(); /* 통합 타이머 카드 이벤트 */
}
