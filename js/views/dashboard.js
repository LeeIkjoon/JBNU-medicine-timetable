/* ══════════════════════════════════════════
   공부 탭 — 타이머 · 오늘 플래너 · 기록 · 시험
   tmLogs(공부시간) + merged(시험) + plan_<날짜>(플래너) 집계
══════════════════════════════════════════ */

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

/* 완료 토스트 (플래너 목표 달성 등) */
function dashCelebrate(msg){
  var el=document.getElementById('dash-celebrate');
  if(el)el.parentNode.removeChild(el);
  el=document.createElement('div');
  el.id='dash-celebrate';el.className='dash-celebrate';
  el.innerHTML='<div class="dash-celebrate-check">✓</div><div class="dash-celebrate-msg">'+escHtml(msg||'목표 시간을 채웠어요')+'</div>';
  document.body.appendChild(el);
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
/* ── 시험 소스: 시간표(merged)의 is_exam 항목 (분반 필터 적용) ── */
function dashExamSource(){
  return viewItems(merged).filter(function(m){return m.is_exam;});
}
/* 다가오는 시험 (오늘 이후, 날짜+과목 중복 제거, 가까운 순) */
function dashUpcomingExams(){
  var todayK=dashYmd(new Date()),seen={},out=[];
  var rows=dashExamSource().filter(function(m){return m.date>=todayK;})
    .sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  for(var i=0;i<rows.length;i++){
    var k=rows[i].date+'|'+rows[i].subject;
    if(seen[k])continue;seen[k]=true;
    out.push({date:rows[i].date,subject:rows[i].subject,dday:dashDday(rows[i].date)});
  }
  return out;
}
/* 본 시험 (오늘 이전, 날짜+과목 중복 제거, 최근 순) */
function dashPastExams(){
  var todayK=dashYmd(new Date()),seen={},out=[];
  var rows=dashExamSource().filter(function(m){return m.date<todayK;})
    .sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0;});
  for(var i=0;i<rows.length;i++){
    var k=rows[i].date+'|'+rows[i].subject;
    if(seen[k])continue;seen[k]=true;
    out.push({date:rows[i].date,subject:rows[i].subject});
  }
  return out;
}

/* 시험 카드 — 한 카드에 [남은 | 본] 세그먼트, 더보기 (전역 — 인라인 onclick에서 호출) */
var dashExamTab='upc',dashExamOpen=false;
function dashExamSeg(t){dashExamTab=t;dashExamOpen=false;renderDashboard();}
function dashToggleExam(){dashExamOpen=!dashExamOpen;renderDashboard();}
function dashMd(dateStr){var p=dateStr.split('-');return parseInt(p[1],10)+'/'+parseInt(p[2],10);}
function dashExamCardHtml(){
  var upc=dashUpcomingExams(),past=dashPastExams();
  var isUpc=dashExamTab==='upc',items=isUpc?upc:past,LIM=4;
  var h='<div class="dash-card">';
  h+='<div class="dash-card-head"><div class="dash-card-ttl">시험</div>';
  h+='<div class="dash-seg">'
    +'<button class="dash-seg-b'+(isUpc?' on':'')+'" onclick="dashExamSeg(\'upc\')">남은 <b>'+upc.length+'</b></button>'
    +'<button class="dash-seg-b'+(!isUpc?' on':'')+'" onclick="dashExamSeg(\'past\')">본 <b>'+past.length+'</b></button>'
    +'</div></div>';
  if(!items.length){
    h+='<div class="dash-empty">'+(isUpc?'예정된 시험이 없어요':'아직 본 시험이 없어요')+'</div></div>';
    return h;
  }
  var show=dashExamOpen?items.length:Math.min(items.length,LIM);
  h+='<div class="dash-exam-list">';
  for(var i=0;i<show;i++){
    var ex=items[i];
    h+='<div class="dash-exam-item'+(isUpc?'':' past')+'">';
    h+='<span class="dash-exam-dot" style="background:'+gcol(examBase(ex.subject)||ex.subject)+'"></span>';
    h+='<span class="dash-exam-subj">'+escHtml(ex.subject)+'</span>';
    h+='<span class="dash-exam-date">'+dashMd(ex.date)+'</span>';
    if(isUpc){
      var ddClass=ex.dday<=3?' urgent':ex.dday<=7?' soon':'';
      h+='<span class="dash-exam-dday'+ddClass+'">'+(ex.dday===0?'D-DAY':'D-'+ex.dday)+'</span>';
    }
    h+='</div>';
  }
  h+='</div>';
  if(items.length>LIM)h+='<button class="dash-more" onclick="dashToggleExam()">'+(dashExamOpen?'접기':(items.length-LIM)+'개 더보기')+'</button>';
  h+='</div>';
  return h;
}

/* ── 백업 카드 (컴팩트 — 탭하면 펼침) ── */
var syncOpen=false,syncRestoreOpen=false;
function syncCardHtml(){
  var h='<div class="dash-card">';
  h+='<button class="sync-head" id="sync-head">'
    +'<span class="dash-card-ttl">백업</span>'
    +'<span class="sync-code sm">'+syncUid()+'</span>'
    +'<span class="sync-status-txt" id="sync-status">'+syncStatusText()+'</span>'
    +'<span class="hrs-arrow'+(syncOpen?' open':'')+'">›</span>'
    +'</button>';
  if(syncOpen){
    h+='<div class="sync-body">';
    h+='<div class="sync-desc">공부기록·플래너·할 일이 이 코드로 자동 백업돼요. 새 기기에서 코드를 입력하면 그대로 복원됩니다.</div>';
    if(syncRestoreOpen){
      h+='<div class="memo-add-row">'
        +'<input class="memo-input" id="sync-code-input" placeholder="코드 8자리" maxlength="8" style="text-transform:uppercase" autocapitalize="characters" autocomplete="off">'
        +'<button class="memo-add-btn" id="sync-restore-btn">가져오기</button>'
        +'</div>';
      h+='<div class="sync-warn" id="sync-restore-msg">가져오면 현재 기기의 기록을 덮어씁니다</div>';
    }else{
      h+='<button class="dash-more" id="sync-restore-open">다른 기기에서 가져오기</button>';
    }
    h+='</div>';
  }
  h+='</div>';
  return h;
}
function syncBind(){
  var hd=document.getElementById('sync-head');
  if(hd)hd.onclick=function(){syncOpen=!syncOpen;if(!syncOpen)syncRestoreOpen=false;renderDashboard();};
  var op=document.getElementById('sync-restore-open');
  if(op)op.onclick=function(){syncRestoreOpen=true;renderDashboard();};
  var btn=document.getElementById('sync-restore-btn');
  if(btn)btn.onclick=function(){
    var v=document.getElementById('sync-code-input').value;
    var msg=document.getElementById('sync-restore-msg');
    syncRestore(v,function(err){
      if(err){if(msg)msg.textContent=err;return;}
      if(msg)msg.textContent='복원 완료 — 새로고침합니다';
      setTimeout(function(){location.reload();},700);
    });
  };
}

/* ══════════ 오늘 플래너 (내용·목표·실제·시간대, 타이머 연동) ══════════ */
function planKey(d){return 'plan_'+(d||dashYmd(new Date()));}
function planLoad(d){
  try{var a=JSON.parse(localStorage.getItem(planKey(d))||'[]');if(Array.isArray(a))return a;}catch(e){}
  return[];
}
function planSave(arr,d){try{localStorage.setItem(planKey(d),JSON.stringify(arr));}catch(e){}}
function planAdd(text,goalMin){
  var a=planLoad();
  a.push({id:Date.now(),text:text,goal:goalMin,secs:0,sessions:[],done:false});
  planSave(a);renderDashboard();
}
function planToggle(id){
  var a=planLoad();
  a.forEach(function(it){if(it.id===id)it.done=!it.done;});
  planSave(a);renderDashboard();
}
function planDel(id){
  planSave(planLoad().filter(function(it){return it.id!==id;}));
  renderDashboard();
}
/* 타이머 종료 시 플래너 항목에 시간·세션 기록 (timer.js에서 호출) */
function planRecord(planId,addSecs,startMs,endMs){
  var a=planLoad(),hit=false,justDone=null;
  function hm(ms){var d=new Date(ms);return p2(d.getHours())+':'+p2(d.getMinutes());}
  a.forEach(function(it){
    if(it.id===planId){
      it.secs=(it.secs||0)+addSecs;
      (it.sessions=it.sessions||[]).push(hm(startMs)+'~'+hm(endMs));
      if(it.goal&&it.secs>=it.goal*60&&!it.done){it.done=true;justDone=it;}
      hit=true;
    }
  });
  if(hit)planSave(a);
  if(justDone)setTimeout(function(){dashCelebrate('목표 시간을 채웠어요 · '+justDone.text);},350);
}
function planMetaLoad(d){
  try{var m=JSON.parse(localStorage.getItem('plan_meta_'+(d||dashYmd(new Date())))||'null');if(m)return m;}catch(e){}
  return {res:'',ref:'',rate:0};
}
function planMetaSave(m,d){try{localStorage.setItem('plan_meta_'+(d||dashYmd(new Date())),JSON.stringify(m));}catch(e){}}
/* 오늘 플래너 합계: 총 공부시간·목표 합·달성률 */
function planSummary(a){
  var secs=0,goal=0,done=0;
  a.forEach(function(it){secs+=(it.secs||0);goal+=(it.goal||0)*60;if(it.done)done++;});
  return{secs:secs,goal:goal,done:done,total:a.length,pct:goal?Math.min(100,Math.round(secs/goal*100)):0};
}
function planGoalLabel(min){
  if(!min)return'';
  return min>=60?Math.floor(min/60)+'시간'+(min%60?' '+(min%60)+'분':''):min+'분';
}
/* 타임테이블 스트립: 세션(HH:MM~HH:MM)들을 6시~26시 축에 표시 */
function planTimelineHtml(items){
  var segs=[];
  items.forEach(function(it){
    (it.sessions||[]).forEach(function(sv){
      var m=sv.match(/^(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})$/);
      if(!m)return;
      var a=parseInt(m[1],10)*60+parseInt(m[2],10);
      var b=parseInt(m[3],10)*60+parseInt(m[4],10);
      if(a<360)a+=1440; if(b<360)b+=1440; /* 새벽은 다음날로 */
      if(b<=a)b=a+5;
      segs.push([a,b]);
    });
  });
  var lo=360,hi=1560; /* 6:00~26:00 */
  var h='<div class="pln-tl"><div class="pln-tl-track">';
  segs.forEach(function(sg){
    var l=Math.max(0,(sg[0]-lo)/(hi-lo)*100),w=Math.max(0.8,(Math.min(sg[1],hi)-Math.max(sg[0],lo))/(hi-lo)*100);
    h+='<span class="pln-tl-seg" style="left:'+l.toFixed(1)+'%;width:'+w.toFixed(1)+'%"></span>';
  });
  h+='</div><div class="pln-tl-ticks">';
  [6,9,12,15,18,21,24].forEach(function(t){
    h+='<span style="left:'+((t*60-lo)/(hi-lo)*100).toFixed(1)+'%">'+(t>=24?t-24:t)+'</span>';
  });
  h+='</div></div>';
  return h;
}
var PLN_IC={
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.6" height="14" rx="1.3"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.3"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4 4L18.5 7.5"/></svg>'
};
var planRefOpen=null; /* null=자동(내용 있거나 18시 이후 펼침) / true / false */
function planCardHtml(){
  var a=planLoad();
  var d=new Date();
  var meta=planMetaLoad();
  var sum=planSummary(a);
  var h='<div class="dash-card pln-card">';
  h+='<div class="pln-head">';
  h+='<div class="dash-card-ttl">오늘 플래너<span class="ttl-caption">'+(d.getMonth()+1)+'월 '+d.getDate()+'일</span></div>';
  if(a.length){
    h+='<div class="pln-sum">'+(sum.total?sum.done+'/'+sum.total+' 완료':'')
      +(sum.secs?' · '+tmFmtShort(sum.secs*1000):'')
      +(sum.goal?' · '+sum.pct+'%':'')+'</div>';
  }
  h+='</div>';
  if(sum.goal){
    h+='<div class="pln-sum-track"><div class="pln-sum-bar'+(sum.pct>=100?' done':'')+'" style="width:'+sum.pct+'%"></div></div>';
  }
  h+='<input class="pln-res" id="pln-res" placeholder="오늘의 각오" maxlength="60" value="'+escHtml(meta.res||'')+'" autocomplete="off">';
  if(a.length){
    h+='<div class="pln-list">';
    a.forEach(function(it){
      var pct=it.goal?Math.min(100,Math.round((it.secs||0)/(it.goal*60)*100)):0;
      var linked=(typeof tmPlanId!=='undefined'&&tmPlanId===it.id&&tmState!=='idle');
      var running=linked&&tmState==='running';
      h+='<div class="pln-item'+(it.done?' done':'')+(linked?' live':'')+'">';
      h+='<button class="pln-chk'+(it.done?' on':'')+'" data-id="'+it.id+'" aria-label="완료">'+(it.done?PLN_IC.chk:'')+'</button>';
      h+='<div class="pln-body">';
      h+='<div class="pln-text">'+escHtml(it.text)+'</div>';
      var meta2=[];
      meta2.push(tmFmtShort((it.secs||0)*1000)+(it.goal?' / '+planGoalLabel(it.goal):''));
      if(it.goal)meta2.push(pct+'%');
      h+='<div class="pln-meta">'+meta2.join(' · ')+(running?'<span class="pln-live">기록 중</span>':linked?'<span class="pln-live paused">일시정지</span>':'')+'</div>';
      if(it.goal)h+='<div class="pln-track"><div class="pln-bar'+(it.done?' done':'')+'" style="width:'+pct+'%"></div></div>';
      if(it.sessions&&it.sessions.length)h+='<div class="pln-sess">'+it.sessions.join(' · ')+'</div>';
      h+='</div>';
      h+='<button class="pln-play'+(running?' running':'')+'" data-id="'+it.id+'" data-text="'+escHtml(it.text)+'" aria-label="'+(running?'일시정지':'시작')+'">'
        +(running?PLN_IC.pause:PLN_IC.play)+'</button>';
      h+='<button class="pln-del" data-id="'+it.id+'" aria-label="삭제">'+PLN_IC.x+'</button>';
      h+='</div>';
    });
    h+='</div>';
  }else{
    h+='<div class="dash-empty">오늘 공부할 내용을 적어보세요. 항목마다 목표 시간을 두면 달성률이 표시돼요.</div>';
  }
  /* 타임테이블 (세션이 있을 때만) */
  var hasSess=a.some(function(it){return it.sessions&&it.sessions.length;});
  if(hasSess)h+=planTimelineHtml(a);
  h+='<div class="pln-add">'
    +'<input class="memo-input" id="pln-text" placeholder="공부할 내용" maxlength="60" autocomplete="off" enterkeyhint="done">'
    +'<select class="memo-input pln-goal" id="pln-goal" aria-label="목표 시간">'
    +'<option value="">목표</option><option value="30">30분</option><option value="60">1시간</option>'
    +'<option value="90">1.5시간</option><option value="120">2시간</option><option value="180">3시간</option><option value="240">4시간</option>'
    +'</select>'
    +'<button class="memo-add-btn" id="pln-add-btn">추가</button></div>';
  /* 회고 — 내용이 있거나 저녁(18시 이후)이면 펼침, 아니면 접힘 */
  var hr=new Date().getHours();
  var refOpen=(planRefOpen!==null)?planRefOpen:(!!meta.ref||meta.rate>0||hr>=18);
  h+='<div class="pln-ref-wrap'+(refOpen?' open':'')+'">';
  h+='<button class="pln-ref-head" id="pln-ref-toggle"><span>오늘 회고</span>';
  h+='<span class="pln-rate">';
  for(var ri=1;ri<=5;ri++)h+='<span class="pln-rate-b'+(meta.rate>=ri?' on':'')+'" data-r="'+ri+'" role="button" aria-label="'+ri+'점">'+ri+'</span>';
  h+='</span><svg class="pln-ref-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>';
  if(refOpen)h+='<textarea class="pln-ref" id="pln-ref" placeholder="오늘의 반성과 내일의 다짐" maxlength="200" rows="2">'+escHtml(meta.ref||'')+'</textarea>';
  h+='</div>';
  h+='</div>';
  return h;
}
function planBind(){
  var btn=document.getElementById('pln-add-btn');
  var inp=document.getElementById('pln-text');
  function add(){
    if(!inp||!inp.value.trim())return;
    planAdd(inp.value.trim(),parseInt(document.getElementById('pln-goal').value,10)||0);
    setTimeout(function(){var el=document.getElementById('pln-text');if(el)el.focus();},40);
  }
  if(btn)btn.onclick=add;
  if(inp)inp.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();add();}};
  var res=document.getElementById('pln-res');
  if(res)res.onchange=function(){var m=planMetaLoad();m.res=this.value.trim();planMetaSave(m);};
  var ref=document.getElementById('pln-ref');
  if(ref)ref.onchange=function(){var m=planMetaLoad();m.ref=this.value.trim();planMetaSave(m);};
  var rt=document.getElementById('pln-ref-toggle');
  if(rt)rt.onclick=function(e){
    if(e.target.classList&&e.target.classList.contains('pln-rate-b'))return;
    planRefOpen=!document.querySelector('.pln-ref-wrap').classList.contains('open');
    renderDashboard();
  };
  document.querySelectorAll('.pln-rate-b').forEach(function(b){
    b.onclick=function(e){
      e.stopPropagation();
      var r=parseInt(this.getAttribute('data-r'),10);
      var m=planMetaLoad();
      m.rate=(m.rate===r)?0:r;
      planMetaSave(m);renderDashboard();
    };
  });
  document.querySelectorAll('.pln-chk').forEach(function(b){
    b.onclick=function(){planToggle(parseInt(this.getAttribute('data-id'),10));};
  });
  document.querySelectorAll('.pln-del').forEach(function(b){
    b.onclick=function(){
      var id=parseInt(this.getAttribute('data-id'),10);
      var row=this.closest('.pln-item');
      if(row){row.classList.add('removing');setTimeout(function(){planDel(id);},220);}
      else planDel(id);
    };
  });
  document.querySelectorAll('.pln-play').forEach(function(b){
    b.onclick=function(){
      var id=parseInt(this.getAttribute('data-id'),10);
      if(typeof tmPlanId!=='undefined'&&tmPlanId===id&&tmState==='running'){tmPause();return;}
      if(tmState==='running')tmPause(); /* 다른 항목 진행 중이면 일시정지 후 전환 */
      if(tmPlanId!==id&&tmState==='paused'){tmStop();} /* 다른 항목이 일시정지 상태면 그 기록을 저장하고 전환 */
      tmSubject=this.getAttribute('data-text');
      tmPlanId=id;
      tmStart_();
    };
  });
}

/* ══════════ 렌더 ══════════ */
function dashGreetHtml(){
  var d=new Date();
  var WN2=['일','월','화','수','목','금','토'];
  var dateStr=(d.getMonth()+1)+'월 '+d.getDate()+'일 '+WN2[d.getDay()]+'요일';
  var a=planLoad(),sum=planSummary(a);
  var title;
  if(tmState==='running')title='집중 중';
  else if(!a.length)title='오늘 계획을 세워보세요';
  else if(sum.done===sum.total)title='오늘 계획을 모두 마쳤어요';
  else title='계획 '+sum.total+'개 중 '+sum.done+'개 완료';
  var h='<div class="dash-greet"><div class="dash-greet-top">'+dateStr+'</div>';
  h+='<div class="dash-greet-row"><div class="dash-greet-msg">'+title+'</div>';
  var upc=dashUpcomingExams();
  if(upc.length){
    var ex=upc[0],cls=ex.dday<=3?' urgent':ex.dday<=7?' soon':'';
    h+='<span class="dash-next-exam'+cls+'"><b>'+(ex.dday===0?'D-DAY':'D-'+ex.dday)+'</b>'+escHtml(ex.subject)+'</span>';
  }
  h+='</div></div>';
  return h;
}
function dashRecordHtml(){
  var streak=dashStreak(),best=dashBestStreak(),week=dashWeekTotal();
  var h='<div class="dash-card dash-record">';
  h+='<div class="dash-card-ttl">기록</div>';
  h+='<div class="dash-rec-grid">';
  h+='<div class="dash-rec"><div class="dash-rec-n">'+streak+'<span>일</span></div><div class="dash-rec-l">연속 공부</div></div>';
  h+='<div class="dash-rec"><div class="dash-rec-n">'+best+'<span>일</span></div><div class="dash-rec-l">최고 연속</div></div>';
  h+='<div class="dash-rec"><div class="dash-rec-n">'+(week?tmFmtShort(week*1000):'0분')+'</div><div class="dash-rec-l">이번 주</div></div>';
  h+='</div>';
  h+='<button class="dash-more" onclick="histOpen()">날짜별 기록 보기</button>';
  h+='</div>';
  return h;
}
function renderDashboard(){
  if(dashPage==='hist'&&typeof histHtml==='function'){
    document.getElementById('main').innerHTML=histHtml();
    return;
  }
  var h='<div class="dash-wrap">';
  h+=dashGreetHtml();
  h+='<div class="dash-col dash-col-a">';
  h+=(typeof tmCardHtml==='function')?tmCardHtml():'';
  h+=planCardHtml();
  h+='</div>';
  h+='<div class="dash-col dash-col-b">';
  h+=dashExamCardHtml();
  h+=dashRecordHtml();
  h+=syncCardHtml();
  h+='</div>';
  h+='</div>';
  document.getElementById('main').innerHTML=h;
  if(typeof tmBind==='function')tmBind();
  planBind();
  syncBind();
}
