function buildWeekTable(w,items){
  items=secFilter(items); /* 분반: 선택한 요일의 분반 수업만 */
  var dd=wdd[w]||{};
  var PERIODS=[
    {n:1,t:'8:30'},{n:2,t:'9:30'},{n:3,t:'10:30'},{n:4,t:'11:30'},
    {n:5,t:'13:30'},{n:6,t:'14:30'},{n:7,t:'15:30'},{n:8,t:'16:30'},
    {n:9,t:'17:30'},{n:10,t:'18:30'}
  ];
  var HOUR_TO_PERIOD={'8':1,'9':2,'10':3,'11':4,'13':5,'14':6,'15':7,'16':8,'17':9,'18':10};

  /* period -> day -> item 맵 (각 교시·요일별 수업) */
  var grid={};
  for(var pi=1;pi<=10;pi++){grid[pi]={};}

  for(var i=0;i<items.length;i++){
    var it=items[i];
    if(!it.day||DAYS.indexOf(it.day)<0)continue;
    var h=parseInt((it.start||'8:30').split(':')[0]);
    var sp=HOUR_TO_PERIOD[String(h)]||1;
    /* 같은 교시에 여러 항목이면 마지막 우선 (실제론 교시당 1개) */
    if(!grid[sp])grid[sp]={};
    grid[sp][it.day]=it;
  }

  /* 요일별 공휴일 여부 미리 계산 */
  var holidayByDay={};/* day → subject */
  for(var hi=0;hi<items.length;hi++){
    var hit=items[hi];
    if(isHoliday(hit.subject)){
      holidayByDay[hit.day]=hit.subject;
    }
  }

  /* HTML 생성 - rowspan 없이 교시별 독립 렌더 */
  var html='<table class="tt"><thead><tr><th class="th-t"></th>';
  DAYS.forEach(function(d){
    var dt=dd[d]||'';
    html+='<th class="th-d" data-day="'+d+'" data-date="'+dt+'">'+d+'<br><span class="th-date">'+(dt?fmtDate(dt):'')+'</span></th>';
  });
  html+='</tr></thead><tbody>';

  for(var pi=0;pi<PERIODS.length;pi++){
    var pn=PERIODS[pi].n;
    var pt=PERIODS[pi].t;

    /* 점심 행 */
    if(pn===5){
      html+='<tr class="lunchrow"><td class="td-t"><span style="font-size:12px">🍱</span></td>';
      html+='<td colspan="5" class="td-lunch">점심시간&nbsp;&nbsp;12:20 ~ 13:30</td></tr>';
    }

    html+='<tr><td class="td-t"><span class="pn">'+pn+'</span><span class="pt">'+pt+'</span></td>';

    DAYS.forEach(function(d){
      /* 공휴일인 날: 1교시에만 아이콘, 나머지는 빈 칸 */
      if(holidayByDay[d]){
        if(pn===1){
          var holSubj=holidayByDay[d];
          html+='<td class="td-c" data-day="'+d+'">';
          html+='<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">';
          html+='<div style="font-size:15px">🗓</div>';
          html+='<div style="font-size:9px;font-weight:600;color:#9CA3AF;text-align:center;word-break:keep-all;line-height:1.3">'+holSubj+'</div>';
          html+='</div></td>';
        }else{
          html+='<td class="td-c" data-day="'+d+'"></td>';
        }
        return;
      }

      var it=grid[pn]&&grid[pn][d];
      if(!it){
        html+='<td class="td-c" data-day="'+d+'"></td>';
        return;
      }
      var bg=gcol(it.subject);
      var itIsExam=(it.is_exam===true||it.is_exam==='true');
      html+='<td class="td-c" data-day="'+d+'">';
      html+='<div class="card" style="background:'+bg+';'+(itIsExam?'box-shadow:inset 0 0 0 2.5px #EF4444;':'')+'">';
      if(itIsExam){
        html+='<div class="cn-s cn-exam">'+it.subject+'</div>';
      }else if(isEx(it.subject)){
        var lb=exLabel(it.subject);
        html+='<div class="cn-s cn-exam">'+lb[0]+'</div>';
        if(lb[1])html+='<div class="cn-name">'+lb[1]+'</div>';
      }else{
        html+='<div class="cn-s">'+it.subject+'</div>';
      }
      if(it.professor)html+='<div class="cn-p">'+it.professor+'</div>';
      html+='</div></td>';
    });

    html+='</tr>';
  }
  html+='</tbody></table>';
  return html;
}

function buildLegend(items){
  items=secFilter(items);
  var seen={};
  var html='';
  for(var i=0;i<items.length;i++){
    var s=items[i].subject;
    if(seen[s]||isHoliday(s)||isEv(s))continue;
    seen[s]=true;
    html+='<div class="li"><span class="ld" style="background:'+gcol(s)+'"></span><span class="ln">'+s+'</span></div>';
  }
  return html;
}


/* ══════════════════════════════════════════
   주간 뷰
══════════════════════════════════════════ */
/* 분반 선택 바 — 미선택 상태의 안내용 (선택은 학년 화면에서, 선택 후엔 숨김) */
function secBarHtml(){
  var r=secRule();
  if(!r||secSel())return'';
  var has=false;
  for(var i=0;i<merged.length;i++){if(merged[i].subject===r.subject){has=true;break;}}
  if(!has)return'';
  var sel=secSel();
  var h='<div class="sec-bar'+(sel?'':' need')+'">';
  h+='<span class="sec-lbl">'+escHtml(r.label)+(sel?'':' 선택')+'</span>';
  for(var j=0;j<r.days.length;j++){
    var d=r.days[j];
    h+='<button class="sec-chip'+(sel===d?' on':'')+'" data-sec="'+d+'">'+d+'반</button>';
  }
  h+='</div>';
  return h;
}
function bindSecBar(){
  var chips=document.querySelectorAll('.sec-chip');
  for(var i=0;i<chips.length;i++){
    chips[i].onclick=function(){
      secSet(this.getAttribute('data-sec'));
      buildFromItems(merged,wdd,ed);
      render();
    };
  }
}
/* 날짜 탭 → 할일 기능 안내 (1회) */
function dtodoTipHtml(){
  try{if(localStorage.getItem('dtodo_tip_seen'))return'';}catch(e){}
  if(!merged.length)return'';
  return '<div class="dtodo-tip" id="dtodo-tip">'
    +'<span>시간표 위쪽의 날짜를 누르면 그날의 할 일을 적을 수 있어요</span>'
    +'<button class="dtodo-tip-x" id="dtodo-tip-x">확인</button></div>';
}
function dtodoTipDismiss(){
  try{localStorage.setItem('dtodo_tip_seen','1');}catch(e){}
  var el=document.getElementById('dtodo-tip');
  if(el&&el.parentNode)el.parentNode.removeChild(el);
}
function renderW(){
  var w=wks[ci],t=today(),dd=wdd[w]||{};
  document.getElementById('main').innerHTML=
    secBarHtml()
    +dtodoTipHtml()
    +'<div class="sw">'+(wh[w]||'<p style="padding:20px;color:#8E8E93">시간표 데이터 없음</p>')+'</div>'
    +'<div class="legend"><div class="lg-title">수강 과목</div><div class="lg-grid">'+(wl[w]||'')+'</div></div>';
  bindSecBar();
  var tipX=document.getElementById('dtodo-tip-x');
  if(tipX)tipX.onclick=dtodoTipDismiss;
  for(var i=0;i<DAYS.length;i++){
    var d=DAYS[i];
    if(dd[d]===t){
      var els=document.querySelectorAll('[data-day="'+d+'"]');
      for(var j=0;j<els.length;j++)els[j].classList.add('tc');
    }
  }
}
