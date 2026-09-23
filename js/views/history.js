/* ══════════════════════════════════════════
   공부 기록 (공부 탭 하위 화면)
   - 이미 저장된 tm_logs · plan_<날짜> · plan_meta_<날짜>를 날짜별로 다시 보여줌
   - 월 달력(날짜별 공부시간) + 선택한 날의 플래너(읽기 전용)·회고(나중에 써도 되게 편집 가능)
══════════════════════════════════════════ */
var dashPage='main';   /* main | hist */
var histYm=null;       /* [연, 월(0-11)] */
var histSel=null;      /* 선택한 날짜 'YYYY-MM-DD' */

function histOpen(){
  var d=studyDate();
  histYm=[d.getFullYear(),d.getMonth()];
  histSel=dashYmd(d);
  dashPage='hist';
  animMain();renderDashboard();mainTop();
}
function histClose(){dashPage='main';animMain();renderDashboard();mainTop();}
function histMonth(delta){
  var d=new Date(histYm[0],histYm[1]+delta,1);
  histYm=[d.getFullYear(),d.getMonth()];
  /* 이동한 달에서 기록이 있는 마지막 날(없으면 1일, 이번 달이면 오늘)을 선택 */
  var todayK=dashYmd(studyDate()),pre=histYm[0]+'-'+p2(histYm[1]+1)+'-',last=null;
  var n=new Date(histYm[0],histYm[1]+1,0).getDate();
  for(var i=1;i<=n;i++){var k=pre+p2(i);if(k<=todayK&&histHasData(k))last=k;}
  histSel=last||(todayK.indexOf(pre)===0?todayK:pre+'01');
  renderDashboard();
}
function histPick(k){histSel=k;renderDashboard();}

/* 가장 오래된 기록의 'YYYY-MM' (이전 달 이동 한계) */
function histFirstYm(){
  var min=null;
  tmLogs.forEach(function(l){if(l.secs>0&&(!min||l.date<min))min=l.date;});
  try{
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i),m=k&&k.match(/^plan_(?:meta_)?(\d{4}-\d{2}-\d{2})$/);
      if(m&&(!min||m[1]<min))min=m[1];
    }
  }catch(e){}
  return min?min.slice(0,7):null;
}
/* 하루 요약: 공부시간(tm_logs 기준) + 플래너 */
function histDay(k){
  var items=planLoad(k),meta=planMetaLoad(k);
  return{secs:dashDayTotal(k),items:items,sum:planSummary(items),meta:meta};
}
function histHasData(k){
  if(dashDayTotal(k)>0)return true;
  try{
    if((localStorage.getItem('plan_'+k)||'[]')!=='[]')return true;
    var m=JSON.parse(localStorage.getItem('plan_meta_'+k)||'null');
    if(m&&(m.res||m.ref||m.rate))return true;
  }catch(e){}
  return false;
}
/* 달력 칸용 짧은 시간 표기: 2h 30m / 45m / 3h */
function histShort(secs){
  var m=Math.round(secs/60),h=Math.floor(m/60);
  if(!h)return (m||1)+'m';
  return m%60?h+'h '+(m%60)+'m':h+'h';
}

function histHtml(){
  var y=histYm[0],mo=histYm[1],todayK=dashYmd(studyDate());
  var pre=y+'-'+p2(mo+1)+'-',n=new Date(y,mo+1,0).getDate();
  var days=0,total=0,daySecs={};
  for(var i=1;i<=n;i++){
    var s=dashDayTotal(pre+p2(i));daySecs[i]=s;
    if(s>0){days++;total+=s;}
  }
  var isCur=(todayK.indexOf(pre)===0);
  var firstYm=histFirstYm(),isFirst=!firstYm||(y+'-'+p2(mo+1))<=firstYm;

  var h='<div class="dash-wrap hist-wrap">';
  h+='<div class="hist-top"><button class="hist-back" onclick="histClose()" aria-label="공부 탭으로">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>'
    +'</button><div class="hist-title">공부 기록</div></div>';

  /* 월 카드: 이동 + 요약 + 달력 */
  h+='<div class="dash-card">';
  h+='<div class="hist-mnav">'
    +'<button class="hist-mbtn" onclick="histMonth(-1)"'+(isFirst?' disabled':'')+' aria-label="이전 달">‹</button>'
    +'<div class="hist-mlbl">'+y+'년 '+(mo+1)+'월</div>'
    +'<button class="hist-mbtn" onclick="histMonth(1)"'+(isCur?' disabled':'')+' aria-label="다음 달">›</button>'
    +'</div>';
  h+='<div class="hist-msum">'
    +'<div><b>'+days+'일</b><span>공부한 날</span></div>'
    +'<div><b>'+(total?tmFmtShort(total*1000):'0분')+'</b><span>합계</span></div>'
    +'<div><b>'+(days?tmFmtShort(Math.round(total/days)*1000):'-')+'</b><span>하루 평균</span></div>'
    +'</div>';
  h+='<div class="hist-cal">';
  ['일','월','화','수','목','금','토'].forEach(function(w){h+='<div class="hist-wd">'+w+'</div>';});
  var first=new Date(y,mo,1).getDay();
  for(var b=0;b<first;b++)h+='<div></div>';
  for(var dd=1;dd<=n;dd++){
    var k=pre+p2(dd),s2=daySecs[dd],fut=k>todayK;
    var cls='hist-day'+(k===histSel?' sel':'')+(k===todayK?' today':'')+(fut?' fut':'');
    var sub=s2>0?histShort(s2):'',dot=!sub&&!fut&&histHasData(k);
    h+='<button class="'+cls+'"'+(fut?' disabled':' onclick="histPick(\''+k+'\')"')+'>'
      +'<span class="hist-dn">'+dd+'</span><span class="hist-dt'+(dot?' dot':'')+'">'+(dot?'•':sub)+'</span></button>';
  }
  h+='</div></div>';

  h+=histDayCardHtml(histSel);
  h+='</div>';
  return h;
}

/* 선택한 날의 상세 (읽기 전용) */
function histDayCardHtml(k){
  var p=k.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);
  var WN2=['일','월','화','수','목','금','토'];
  var day=histDay(k),a=day.items,sum=day.sum,meta=day.meta;
  var h='<div class="dash-card hist-dcard">';
  h+='<div class="hist-dhead"><div class="hist-dttl">'+(d.getMonth()+1)+'월 '+d.getDate()+'일 '+WN2[d.getDay()]+'요일</div>';
  h+='<div class="hist-dtot">'+(day.secs?tmFmtShort(day.secs*1000):'공부 기록 없음')+'</div></div>';

  var meta2=[];
  if(sum.total)meta2.push('계획 '+sum.total+'개 중 '+sum.done+'개 완료');
  if(sum.goal)meta2.push('목표 달성 '+sum.pct+'%');

  if(meta2.length)h+='<div class="hist-dmeta">'+meta2.join(' · ')+'</div>';
  if(meta.res)h+='<div class="hist-res">'+escHtml(meta.res)+'</div>';

  if(a.length){
    h+='<div class="pln-list hist-list">';
    a.forEach(function(it){
      var pct=it.goal?Math.min(100,Math.round((it.secs||0)/(it.goal*60)*100)):0;
      h+='<div class="pln-item'+(it.done?' done':'')+'">';
      h+='<span class="pln-chk'+(it.done?' on':'')+'">'+(it.done?PLN_IC.chk:'')+'</span>';
      h+='<div class="pln-body"><div class="pln-text">'+escHtml(it.text)+'</div>';
      h+='<div class="pln-meta">'+tmFmtShort((it.secs||0)*1000)+(it.goal?' / '+planGoalLabel(it.goal)+' · '+pct+'%':'')+'</div>';
      if(it.goal)h+='<div class="pln-track"><div class="pln-bar'+(it.done?' done':'')+'" style="width:'+pct+'%"></div></div>';
      if(it.sessions&&it.sessions.length)h+='<div class="pln-sess">'+it.sessions.join(' · ')+'</div>';
      h+='</div></div>';
    });
    h+='</div>';
    if(a.some(function(it){return it.sessions&&it.sessions.length;}))h+=planTimelineHtml(a);
  }

  /* 플래너 항목과 연결되지 않은 타이머 기록 (과목 직접 선택 등) */
  var names={};a.forEach(function(it){names[it.text]=1;});
  var extra=tmLogs.filter(function(l){return l.date===k&&l.secs>0&&!names[l.subject];});
  if(extra.length){
    h+='<div class="hist-sub">타이머</div><div class="hist-logs">';
    extra.forEach(function(l){
      h+='<div class="hist-log"><span class="hist-log-dot" style="background:'+gcol(l.subject||'')+'"></span>'
        +'<span class="hist-log-s">'+escHtml(l.subject||'과목 없음')+'</span>'
        +'<span class="hist-log-t">'+tmFmtShort(l.secs*1000)+'</span></div>';
    });
    h+='</div>';
  }

  if(!a.length&&!extra.length&&!meta.res&&!day.secs)
    h+='<div class="dash-empty">이 날은 남긴 계획이나 공부 기록이 없어요.</div>';

  /* 회고·자기평가 — 지난 날도 나중에 적을 수 있게 편집 가능 */
  h+='<div class="hist-sub hist-ref-head"><span>회고</span><span class="pln-rate">';
  for(var ri=1;ri<=5;ri++)h+='<span class="pln-rate-b hist-rate-b'+(meta.rate>=ri?' on':'')+'" data-r="'+ri+'" role="button" aria-label="'+ri+'점">'+ri+'</span>';
  h+='</span></div>';
  h+='<textarea class="pln-ref" id="hist-ref" placeholder="이 날의 반성과 다음 날의 다짐" maxlength="200" rows="2">'+escHtml(meta.ref||'')+'</textarea>';
  h+='</div>';
  return h;
}

function histBind(){
  var k=histSel;
  var ref=document.getElementById('hist-ref');
  if(ref)ref.onchange=function(){var m=planMetaLoad(k);m.ref=this.value.trim();planMetaSave(m,k);};
  document.querySelectorAll('.hist-rate-b').forEach(function(b){
    b.onclick=function(){
      var r=parseInt(this.getAttribute('data-r'),10),m=planMetaLoad(k);
      m.rate=(m.rate===r)?0:r;planMetaSave(m,k);renderDashboard();
    };
  });
}
