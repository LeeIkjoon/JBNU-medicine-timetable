function buildWeekTable(w,items){
  items=viewItems(items); /* 분반 + 개인 편집 반영 */
  var dd=wdd[w]||{};
  /* 개인 추가 항목은 전 주차 목록에 합류하므로 이 주의 날짜만 남김 */
  var wkDates={};
  Object.keys(dd).forEach(function(k){if(dd[k])wkDates[dd[k]]=1;});
  items=items.filter(function(it){return it.date&&wkDates[it.date];});
  /* (과목|교수)별 마지막 수업 슬롯 — 전체 시간표 기준 */
  var lastMap={};
  var all=viewItems(merged);
  for(var li=0;li<all.length;li++){
    var a=all[li];
    if(!a.professor||!a.subject)continue;
    if(a.is_exam===true||a.is_exam==='true'||isEx(a.subject)||isHoliday(a.subject)||isEv(a.subject))continue;
    var lk=a.subject+'|'+a.professor;
    var cur=lastMap[lk];
    if(!cur||a.date>cur.date||(a.date===cur.date&&a.period>cur.period)){
      lastMap[lk]={date:a.date,period:a.period};
    }
  }
  function isLastClass(it){
    if(!it.professor)return false;
    var m=lastMap[it.subject+'|'+it.professor];
    return !!m&&m.date===it.date&&m.period===it.period;
  }
  /* 학교 교시 설정 기반 그리드 축 */
  var PERIODS=Object.keys(PERIOD_START).map(Number).sort(function(a,b){return a-b;})
    .map(function(n){return {n:n,t:PERIOD_START[n]};});
  var HOUR_TO_PERIOD={};
  PERIODS.forEach(function(pp){HOUR_TO_PERIOD[String(parseInt(pp.t.split(':')[0],10))]=pp.n;});

  /* period -> day -> item 맵 (각 교시·요일별 수업) */
  var grid={};
  PERIODS.forEach(function(pp){grid[pp.n]={};});

  for(var i=0;i<items.length;i++){
    var it=items[i];
    if(!it.day||DAYS.indexOf(it.day)<0)continue;
    var sp=parseInt(it.period,10);
    if(!sp||!PERIOD_START[sp]){
      var h=parseInt((it.start||'8:30').split(':')[0]);
      sp=HOUR_TO_PERIOD[String(h)]||1;
    }
    /* 같은 교시에 여러 항목이면 마지막 우선 (실제론 교시당 1개) */
    if(!grid[sp])grid[sp]={};
    grid[sp][it.day]=it;
  }

  /* 요일별 공휴일 여부 — 그날에 실제 수업이 하나도 없을 때만 '하루 통째 휴일'로 접음.
     (개교기념일 등 표시만 있고 수업이 같이 있는 날은 수업을 그대로 보여준다) */
  var holidayByDay={};/* day → subject */
  var classByDay={};
  for(var ci0=0;ci0<items.length;ci0++){
    var it0=items[ci0];
    if(!isHoliday(it0.subject))classByDay[it0.day]=1;
  }
  for(var hi=0;hi<items.length;hi++){
    var hit=items[hi];
    if(isHoliday(hit.subject)&&!classByDay[hit.day]){
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

    /* 점심 행 (학교 설정 위치) */
    /* 점심 뒤 첫 교시 앞 — 교시 번호가 건너뛰는 학교(3교시 뒤 5교시)도 맞게 */
    if(SCHOOL_LUNCH_AFTER&&pi>0&&PERIODS[pi-1].n===SCHOOL_LUNCH_AFTER){
      html+='<tr class="lunchrow"><td class="td-t"><span style="font-size:12px">🍱</span></td>';
      html+='<td colspan="5" class="td-lunch">'+SCHOOL_LUNCH_LABEL+'</td></tr>';
    }

    html+='<tr><td class="td-t"><span class="pn">'+pn+'</span><span class="pt">'+pt+'</span></td>';

    DAYS.forEach(function(d){
      /* 공휴일인 날: 1교시에만 아이콘, 나머지는 빈 칸 */
      if(holidayByDay[d]){
        if(pn===1){
          var holSubj=holidayByDay[d];
          html+='<td class="td-c" data-day="'+d+'" data-p="'+pn+'">';
          html+='<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">';
          html+='<div style="font-size:15px">🗓</div>';
          html+='<div style="font-size:9px;font-weight:600;color:#9CA3AF;text-align:center;word-break:keep-all;line-height:1.3">'+holSubj+'</div>';
          html+='</div></td>';
        }else{
          html+='<td class="td-c" data-day="'+d+'" data-p="'+pn+'"></td>';
        }
        return;
      }

      var it=grid[pn]&&grid[pn][d];
      if(!it){
        html+='<td class="td-c" data-day="'+d+'" data-p="'+pn+'"></td>';
        return;
      }
      /* 수업이 있는 날의 휴일 표시 항목: 해당 교시에만 작은 회색 표시 */
      if(isHoliday(it.subject)){
        html+='<td class="td-c" data-day="'+d+'" data-p="'+pn+'">';
        html+='<div class="card card-hol"><div class="cn-s cn-hol">🗓 '+it.subject+'</div></div></td>';
        return;
      }
      var bg=gcol(it.subject);
      var itIsExam=(it.is_exam===true||it.is_exam==='true');
      html+='<td class="td-c" data-day="'+d+'" data-p="'+pn+'">';
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
      if(it.topic)html+='<div class="cn-tp">'+it.topic+'</div>';
      if(it.professor)html+='<div class="cn-p">'+it.professor+(isLastClass(it)?' <span class="cn-last">❗</span>':'')+'</div>';
      html+='</div></td>';
    });

    html+='</tr>';
  }
  html+='</tbody></table>';
  return html;
}

function buildLegend(items){
  var wk0=items.length?String(items[0].week):null;
  items=viewItems(items);
  if(wk0!=null)items=items.filter(function(it){return String(it.week)===wk0;});
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
  for(var i=0;i<merged.length;i++){
    var it=merged[i];
    if((r.mode==='sec'&&it.sec)||(r.mode!=='sec'&&it.subject===r.subject)){has=true;break;}
  }
  if(!has)return'';
  var sel=secSel();
  var h='<div class="sec-bar'+(sel?'':' need')+'">';
  h+='<span class="sec-lbl">'+escHtml(r.label)+(sel?'':' 선택')+'</span>';
  var opts=r.options||[];
  for(var j=0;j<opts.length;j++){
    var o=opts[j];
    h+='<button class="sec-chip'+(sel===o.v?' on':'')+'" data-sec="'+o.v+'">'+o.t+'</button>';
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
/* 요일별 할 일 아이콘 줄 — 시간표 칼럼 위에 정렬 (가볍게, 카드 없이) */
function wkTodoRowHtml(){
  var dd=wdd[wks[ci]]||{},t=today();
  var IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 12.3l2.6 2.6 5.4-5.6"/></svg>';
  var any=false,h='<div class="wk-todos"><span class="wk-todos-sp"></span>';
  for(var i=0;i<DAYS.length;i++){
    var d=DAYS[i],dt=dd[d]||'';
    if(!dt){h+='<span class="wk-td off"></span>';continue;}
    any=true;
    var n=0;try{n=dtodoLoad(dt).length;}catch(e){}
    h+='<button class="wk-td'+(dt===t?' today':'')+'" data-date="'+dt+'" data-day="'+d+'" title="'+d+'요일 할 일">'
      +'<span class="wk-td-ic'+(n?' has':'')+'">'+(n?n:IC)+'</span></button>';
  }
  h+='</div>';
  return any?h:'';
}
/* 수업 상세 시트 — 셀 탭 시 원본 정보 전체 표시 */
function openClassInfo(dt,day,period){
  var pool=viewItems(merged);
  var list=pool.filter(function(i){return i.date===dt&&i.period===period;});
  if(!list.length)return;
  var it=list[0];
  if(isHoliday(it.subject))return;
  /* 같은 수업의 연속 교시 범위 */
  var same=pool.filter(function(i){
    return i.date===dt&&i.subject===it.subject
      &&(i.topic||'')===(it.topic||'')&&(i.professor||'')===(it.professor||'');
  }).map(function(i){return i.period;});
  var ps=it.period,pe=it.period;
  while(same.indexOf(ps-1)>=0)ps--;
  while(same.indexOf(pe+1)>=0)pe++;
  var perTxt=(ps===pe?ps+'교시':ps+'~'+pe+'교시');
  var st=PERIOD_START[ps]||it.start,en=PERIOD_END[pe]||it.end;
  var p=dt.split('-');
  var isExam=(it.is_exam===true||it.is_exam==='true')||isEx(it.subject);
  var h='<div class="cls-date">'+parseInt(p[1])+'월 '+parseInt(p[2])+'일 ('+day+') · '+perTxt+' · '+st+'~'+en+'</div>';
  h+='<div class="cls-subj"><span class="cls-dot" style="background:'+gcol(it.subject)+'"></span>'
    +escHtml(it.subject)+(isExam?'<span class="cls-exam">시험</span>':'')+'</div>';
  if(it.topic)h+='<div class="cls-row"><span class="cls-lbl">주제</span><span class="cls-val">'+escHtml(it.topic)+'</span></div>';
  if(it.professor)h+='<div class="cls-row"><span class="cls-lbl">교수</span><span class="cls-val">'+escHtml(it.professor)+'</span></div>';
  if(it.room)h+='<div class="cls-row"><span class="cls-lbl">강의실</span><span class="cls-val">'+escHtml(it.room)+'</span></div>';
  /* 교수 마지막 수업 여부 */
  if(it.professor&&!isExam){
    var pool2=viewItems(merged);
    var isLast=true;
    for(var pi2=0;pi2<pool2.length;pi2++){
      var q=pool2[pi2];
      if(q.subject===it.subject&&q.professor===it.professor
        &&!(q.is_exam===true||q.is_exam==='true')
        &&(q.date>it.date||(q.date===it.date&&q.period>pe))){isLast=false;break;}
    }
    if(isLast)h+='<div class="cls-row"><span class="cls-lbl">❗</span><span class="cls-val">'+escHtml(it.professor)+' 교수님의 마지막 수업이에요</span></div>';
  }
  /* 개인 편집 버튼 (관리자 모드가 아닐 때) */
  if(typeof isAdmin==='undefined'||!isAdmin){
    var o=ovLoad(),k=dt+'|'+period;
    var touched=!!(o.mod[k]||o.del[k]||o.add.some(function(a){return ovSlot(a)===k;}));
    h+='<div class="cls-actions">'
      +'<button class="cls-act" id="cls-edit">수정</button>'
      +'<button class="cls-act danger" id="cls-del">삭제</button>'
      +(touched?'<button class="cls-act" id="cls-reset">원래대로</button>':'')
      +'</div>';
  }
  document.getElementById('cls-body').innerHTML=h;
  var ovl=document.getElementById('cls-ovl');
  ovl.className='cls-ovl show';
  ovl.onclick=function(e){if(e.target===ovl)closeClassInfo();};
  var cx=document.getElementById('cls-x');
  if(cx)cx.onclick=function(e){e.stopPropagation();closeClassInfo();};
  var eb=document.getElementById('cls-edit');
  if(eb)eb.onclick=function(){closeClassInfo();openClassEdit(dt,day,period,it);};
  var db=document.getElementById('cls-del');
  if(db)db.onclick=function(){
    var o=ovLoad(),k=dt+'|'+period;
    o.add=o.add.filter(function(a){return ovSlot(a)!==k;});
    delete o.mod[k];
    /* 원본에 있던 슬롯이면 삭제 마크 */
    if(secFilter(merged).some(function(i){return i.date===dt&&i.period===period;}))o.del[k]=1;
    ovSave(o);closeClassInfo();ovRefresh();
  };
  var rb=document.getElementById('cls-reset');
  if(rb)rb.onclick=function(){
    var o=ovLoad(),k=dt+'|'+period;
    delete o.mod[k];delete o.del[k];
    o.add=o.add.filter(function(a){return ovSlot(a)!==k;});
    ovSave(o);closeClassInfo();ovRefresh();
  };
}
/* 편집 반영 후 재렌더 */
function ovRefresh(){
  buildFromItems(merged,wdd,ed);
  _subjColorMap=null;
  render();
}
/* 개인 편집 폼 */
var _editCtx=null;
function openClassEdit(dt,day,period,base){
  _editCtx={dt:dt,day:day,period:period};
  var p=dt.split('-');
  document.getElementById('edit-when').textContent=parseInt(p[1])+'월 '+parseInt(p[2])+'일 ('+day+')';
  /* 과목·교수 자동완성 (현재 시간표 기준) */
  var pool=viewItems(merged),subjSet={},profSet={};
  pool.forEach(function(i){
    if(i.subject&&!isEv(i.subject)&&!isHoliday(i.subject))subjSet[i.subject]=1;
    if(i.professor)i.professor.split(/[,，]/).forEach(function(x){x=x.trim();if(x)profSet[x]=1;});
  });
  document.getElementById('edit-subj-list').innerHTML=Object.keys(subjSet).sort().map(function(x){return '<option value="'+escHtml(x)+'">';}).join('');
  document.getElementById('edit-prof-list').innerHTML=Object.keys(profSet).sort().map(function(x){return '<option value="'+escHtml(x)+'">';}).join('');
  /* 교시 선택 (이동 가능) */
  var ps=document.getElementById('edit-period'),ph='';
  Object.keys(PERIOD_START).map(Number).sort(function(a,b){return a-b;}).forEach(function(pi){
    ph+='<option value="'+pi+'"'+(pi===period?' selected':'')+'>'+pi+'교시 · '+PERIOD_START[pi]+'~'+PERIOD_END[pi]+'</option>';
  });
  ps.innerHTML=ph;
  /* 날짜 선택 (다른 날로 이동 가능) — 학기 범위 안에서 */
  var de=document.getElementById('edit-date');
  if(de){
    var all=[];for(var w0 in wdd){for(var d0 in wdd[w0])if(wdd[w0][d0])all.push(wdd[w0][d0]);}
    all.sort();
    de.value=dt;de.min=all[0]||'';de.max=all[all.length-1]||'';
    de.onchange=function(){
      var v=this.value;if(!v)return;
      var q=v.split('-'),dow=new Date(+q[0],+q[1]-1,+q[2]).getDay();
      var lbl=document.getElementById('edit-when');
      if(lbl)lbl.textContent=parseInt(q[1])+'월 '+parseInt(q[2])+'일 ('+WN[dow]+')'+(v!==dt?' · 이동':'');
    };
  }
  document.getElementById('edit-subj').value=base?base.subject:'';
  document.getElementById('edit-topic').value=(base&&base.topic)||'';
  document.getElementById('edit-prof').value=(base&&base.professor)||'';
  document.getElementById('edit-exam-chk').checked=!!(base&&(base.is_exam===true||base.is_exam==='true'));
  var eo=document.getElementById('edit-ovl');
  eo.className='cls-ovl show';
  eo.onclick=function(e){if(e.target===eo)closeClassEdit();};
  var ex=document.getElementById('edit-x');
  if(ex)ex.onclick=function(e){e.stopPropagation();closeClassEdit();};
  var es=document.getElementById('edit-save');
  if(es)es.onclick=saveClassEdit;
}
function closeClassEdit(){document.getElementById('edit-ovl').className='cls-ovl';}
function saveClassEdit(){
  if(!_editCtx)return;
  var subj=document.getElementById('edit-subj').value.trim();
  if(!subj)return;
  var c=_editCtx;
  var newPeriod=parseInt(document.getElementById('edit-period').value,10)||c.period;
  /* 날짜 이동: 주말은 불가, 요일은 날짜에서 계산 */
  var de=document.getElementById('edit-date');
  var newDt=(de&&/^\d{4}-\d{2}-\d{2}$/.test(de.value))?de.value:c.dt;
  var q=newDt.split('-'),dow=new Date(+q[0],+q[1]-1,+q[2]).getDay();
  if(dow===0||dow===6){newDt=c.dt;q=newDt.split('-');dow=new Date(+q[0],+q[1]-1,+q[2]).getDay();}
  var newDay=WN[dow];
  /* 주차: wdd에서 날짜로 찾고, 없으면 그 날짜가 속한 주(월~일)의 다른 날짜로 찾음 */
  var wk=null;
  for(var w in wdd){for(var d in wdd[w]){if(wdd[w][d]===newDt){wk=w;break;}}if(wk)break;}
  if(!wk){
    var base=new Date(+q[0],+q[1]-1,+q[2]);var mon=new Date(base);mon.setDate(base.getDate()-((dow+6)%7));
    var span={};for(var k=0;k<7;k++){var dd2=new Date(mon);dd2.setDate(mon.getDate()+k);span[dd2.getFullYear()+'-'+p2(dd2.getMonth()+1)+'-'+p2(dd2.getDate())]=1;}
    for(var w2 in wdd){for(var d2 in wdd[w2]){if(span[wdd[w2][d2]]){wk=w2;break;}}if(wk)break;}
  }
  if(!wk)wk=wks[ci]||'1';
  /* 그 주에 해당 요일 날짜가 비어 있으면(휴일 등) 열이 생기도록 등록 */
  if(wdd[wk]&&!wdd[wk][newDay]){wdd[wk][newDay]=newDt;
    try{var st=JSON.parse(localStorage.getItem(ttKey())||'null');if(st&&st.wdd){st.wdd[wk]=st.wdd[wk]||{};st.wdd[wk][newDay]=newDt;localStorage.setItem(ttKey(),JSON.stringify(st));}}catch(e){}}
  var item={week:wk,date:newDt,day:newDay,period:newPeriod,
    start:PERIOD_START[newPeriod]||'',end:PERIOD_END[newPeriod]||'',
    subject:subj,professor:document.getElementById('edit-prof').value.trim(),
    is_exam:document.getElementById('edit-exam-chk').checked};
  var tp=document.getElementById('edit-topic').value.trim();
  if(tp)item.topic=tp;
  var o=ovLoad();
  var moved=(newDt!==c.dt||newPeriod!==c.period);
  /* 원래 슬롯 정리 (이동 시 원 슬롯은 삭제 처리) */
  var k0=c.dt+'|'+c.period;
  delete o.del[k0];delete o.mod[k0];
  o.add=o.add.filter(function(a){return ovSlot(a)!==k0;});
  if(moved&&secFilter(merged).some(function(i){return i.date===c.dt&&i.period===c.period;}))o.del[k0]=1;
  /* 대상 슬롯에 배치 */
  var k1=newDt+'|'+newPeriod;
  delete o.del[k1];
  o.add=o.add.filter(function(a){return ovSlot(a)!==k1;});
  if(secFilter(merged).some(function(i){return i.date===newDt&&i.period===newPeriod;}))o.mod[k1]=item;
  else o.add.push(item);
  ovSave(o);closeClassEdit();ovRefresh();
}
/* ── 내 편집 목록 (오버라이드 관리) ── */
function ovBarHtml(){
  return''; /* 관리 바 비노출 — 되돌리기는 셀 상세의 '원래대로'로 */
}
function openOvManage(){
  var o=ovLoad(),rows=[];
  Object.keys(o.mod).forEach(function(k){rows.push({k:k,t:'수정',it:o.mod[k]});});
  o.add.forEach(function(it){rows.push({k:ovSlot(it),t:'추가',it:it});});
  Object.keys(o.del).forEach(function(k){
    var p=k.split('|');
    var org=merged.filter(function(i){return i.date===p[0]&&i.period===parseInt(p[1],10);})[0];
    rows.push({k:k,t:'삭제',it:org||{date:p[0],period:p[1],subject:'(원본 수업)'}});
  });
  rows.sort(function(a,b){return a.k<b.k?-1:1;});
  var h='<div class="cls-date">내가 수정한 수업</div>';
  rows.forEach(function(r){
    var p=r.k.split('-');
    var d=r.it.date?r.it.date.slice(5).replace('-','/'):'';
    h+='<div class="ovm-row">'
      +'<span class="ovm-tag '+(r.t==='삭제'?'del':r.t==='추가'?'add':'mod')+'">'+r.t+'</span>'
      +'<span class="ovm-txt">'+d+' '+r.it.period+'교시 · '+escHtml(r.it.subject||'')+'</span>'
      +'<button class="ovm-undo" data-k="'+r.k+'">되돌리기</button>'
      +'</div>';
  });
  h+='<button class="cls-act danger" id="ovm-reset-all" style="width:100%;margin-top:12px">전체 되돌리기</button>';
  document.getElementById('cls-body').innerHTML=h;
  var ovl=document.getElementById('cls-ovl');
  ovl.className='cls-ovl show';
  ovl.onclick=function(e){if(e.target===ovl)closeClassInfo();};
  var cx=document.getElementById('cls-x');
  if(cx)cx.onclick=function(e){e.stopPropagation();closeClassInfo();};
  document.querySelectorAll('.ovm-undo').forEach(function(b){
    b.onclick=function(){
      var k=this.getAttribute('data-k'),o2=ovLoad();
      delete o2.mod[k];delete o2.del[k];
      o2.add=o2.add.filter(function(a){return ovSlot(a)!==k;});
      ovSave(o2);closeClassInfo();ovRefresh();
    };
  });
  var ra=document.getElementById('ovm-reset-all');
  if(ra)ra.onclick=function(){ovSave({mod:{},del:{},add:[]});closeClassInfo();ovRefresh();};
}
function closeClassInfo(){
  var o=document.getElementById('cls-ovl');
  if(o)o.className='cls-ovl';
}
/* 전공선택 안내 바 + 선택 시트 */
function elBarHtml(){
  if(typeof isAdmin!=='undefined'&&isAdmin)return'';
  var groups=electiveGroups();
  if(!groups.length)return'';
  var chosen=elLoad().chosen;
  if(Object.keys(chosen).length)return'';
  return '<div class="sec-bar need"><span class="sec-lbl">선택과목 고르기</span>'
    +'<button class="sec-chip" id="el-open">선택</button></div>';
}
function openElective(){
  var groups=electiveGroups(),chosen=elLoad().chosen;
  var h='<div class="cls-date">선택과목</div>'
    +'<div class="el-desc">시간이 겹치는 과목들이에요. 수강하는 과목만 체크하면 시간표에 그 과목만 표시됩니다.</div>';
  groups.forEach(function(g,gi){
    h+='<div class="el-group">';
    g.forEach(function(sub){
      var on=chosen[sub]||!Object.keys(chosen).length&&false;
      h+='<label class="el-item"><input type="checkbox" class="el-chk" value="'+escHtml(sub)+'"'+(chosen[sub]?' checked':'')+'>'
        +'<span class="el-dot" style="background:'+gcol(sub)+'"></span>'
        +'<span class="el-name">'+escHtml(sub)+'</span></label>';
    });
    h+='</div>';
  });
  h+='<button class="edit-save" id="el-save" style="margin-top:12px">저장</button>';
  h+='<div class="edit-note">전체 다시 보려면 모두 해제하고 저장</div>';
  document.getElementById('cls-body').innerHTML=h;
  var ovl=document.getElementById('cls-ovl');
  ovl.className='cls-ovl show';
  ovl.onclick=function(e){if(e.target===ovl)closeClassInfo();};
  var cx=document.getElementById('cls-x');
  if(cx)cx.onclick=function(e){e.stopPropagation();closeClassInfo();};
  document.getElementById('el-save').onclick=function(){
    var c={};
    document.querySelectorAll('.el-chk').forEach(function(b){if(b.checked)c[b.value]=true;});
    elSave({chosen:c});
    closeClassInfo();ovRefresh();
  };
}

/* 시간표 출처 표시·전환 (범례 아래) */
function ttSrcHtml(){
  if(typeof isAdmin!=='undefined'&&isAdmin)return'';
  if(ttLocalOn()){
    return '<div class="tt-src"><span class="tt-src-lbl">내가 올린 파일 사용 중 · 실시간 업데이트 꺼짐</span>'
      +'<button class="tt-src-btn" id="tt-resync">동기화 복원</button>'
      +'<button class="tt-src-btn" id="tt-upload">다시 업로드</button></div>';
  }
  var el='';
  if(electiveGroups().length)el='<button class="tt-src-btn ghost" id="el-manage">선택과목 설정</button>';
  return '<div class="tt-src">'+el+'<button class="tt-src-btn ghost" id="tt-upload">시간표 파일로 교체</button>'
    +'<button class="tt-src-btn ghost" id="tt-report">시간표 신고</button></div>';
}
/* 오늘 수업 상태 — 지금 진행 중인 수업(cur) / 쉬는·점심·등교 전이면 다음 수업(next) / 다 끝나면 done
   시각은 수업 자체의 start/end (없으면 교시 설정) 기준 */
function wkMin(v){var p=String(v||'').split(':');return p.length<2?-1:(+p[0])*60+(+p[1]||0);}
function wkItemSt(it){var m=wkMin(it.start);return m>=0?m:wkMin(PERIOD_START[it.period]);}
function wkItemEn(it){var m=wkMin(it.end);return m>=0?m:wkMin(PERIOD_END[it.period]);}
function wkTodayState(){
  var t=today(),dd=wdd[wks[ci]]||{},inWeek=false;
  for(var i=0;i<DAYS.length;i++)if(dd[DAYS[i]]===t)inWeek=true;
  if(!inWeek)return null;
  var list=viewItems(merged).filter(function(m){return m.date===t&&!isHoliday(m.subject)&&!m.is_holiday;})
    .sort(function(a,b){return wkItemSt(a)-wkItemSt(b)||a.period-b.period;});
  var d=new Date(),mins=d.getHours()*60+d.getMinutes();
  var st={list:list,mins:mins,cur:null,next:null,blockEnd:0,first:false};
  if(!list.length)return st;
  for(var j=0;j<list.length;j++){
    var s0=wkItemSt(list[j]),e0=wkItemEn(list[j]);
    if(mins>=s0&&mins<e0){st.cur=list[j];break;}
    if(s0>mins){st.next=list[j];st.first=(j===0);break;}
  }
  /* 같은 과목이 연달아 이어지면 그 블록 끝까지 */
  var base=st.cur||st.next;
  if(base){
    var k=list.indexOf(base),end=wkItemEn(base);
    while(k+1<list.length&&list[k+1].subject===base.subject&&(list[k+1].professor||'')===(base.professor||'')
      &&wkItemSt(list[k+1])-end<=20){k++;end=wkItemEn(list[k]);}
    st.blockEnd=end;
    var b=list.indexOf(base),beg=wkItemSt(base);
    while(st.cur&&b>0&&list[b-1].subject===base.subject&&(list[b-1].professor||'')===(base.professor||'')
      &&beg-wkItemEn(list[b-1])<=20){b--;beg=wkItemSt(list[b]);}
    st.blockStart=beg;
  }
  return st;
}
function wkFmtMin(m){return Math.floor(m/60)+':'+('0'+(m%60)).slice(-2);}
function wkNowBarHtml(){
  var st=wkTodayState();
  if(!st)return'';
  if(!st.list.length)return'<div class="tt-now done"><span class="tt-now-dot"></span>'
    +'<span class="tt-now-lbl">오늘</span><span class="tt-now-txt">수업이 없어요</span></div>';
  var it=st.cur||st.next;
  if(!it)return''; /* 오늘 수업 모두 끝 */
  var txt=escHtml(it.subject)+(it.professor?' <span class="tt-now-prof">'+escHtml(it.professor)+'</span>':'');
  var s0=wkItemSt(it);
  if(st.cur){
    var left=st.blockEnd-st.mins;
    return '<div class="tt-now live"><span class="tt-now-dot"></span><span class="tt-now-lbl">지금</span>'
      +'<span class="tt-now-txt">'+txt+'</span>'
      +'<span class="tt-now-time">'+wkFmtMin(st.blockStart)+' ~ '+wkFmtMin(st.blockEnd)
      +'<small>'+(left>=60?Math.floor(left/60)+'시간 '+(left%60?left%60+'분 ':''):left+'분 ')+'남음</small></span></div>';
  }
  var gap=s0-st.mins;
  return '<div class="tt-now next"><span class="tt-now-dot"></span><span class="tt-now-lbl">'+(st.first?'첫 수업':'다음')+'</span>'
    +'<span class="tt-now-txt">'+txt+'</span>'
    +'<span class="tt-now-time">'+wkFmtMin(s0)
    +'<small>'+(gap>=60?Math.floor(gap/60)+'시간 '+(gap%60?gap%60+'분 ':''):gap+'분 ')+'후</small></span></div>';
}

/* 위·아래 연속으로 비어 있는 교시는 한 줄로 접는다 (탭하면 펼침) */
var wkFoldOpen=false;
function wkFoldEmpty(){
  if(wkFoldOpen)return;
  var tbl=document.querySelector('.sw table.tt');if(!tbl)return;
  var rows=[],all=tbl.querySelectorAll('tbody tr');
  for(var i=0;i<all.length;i++){
    if(all[i].className.indexOf('lunchrow')>=0)continue;
    rows.push(all[i]);
  }
  function empty(tr){return !tr.querySelector('.card');}
  var head=0;while(head<rows.length&&empty(rows[head]))head++;
  var tail=rows.length-1;while(tail>=0&&empty(rows[tail]))tail--;
  function fold(from,to){
    if(to-from+1<2)return;
    var label=(from+1)+'~'+(to+1)+'교시 수업 없음';
    for(var r=from;r<=to;r++)rows[r].style.display='none';
    var tr=document.createElement('tr');
    tr.className='tt-fold';
    tr.innerHTML='<td colspan="6"><button type="button">'+label+' · 펼치기</button></td>';
    tr.querySelector('button').onclick=function(){wkFoldOpen=true;renderW();};
    rows[from].parentNode.insertBefore(tr,rows[from]);
  }
  if(tail<head){return;} /* 하루도 수업이 없으면 그대로 */
  fold(tail+1,rows.length-1);
  fold(0,head-1);
}

/* 좌우로 밀어 주차 이동 (표가 가로 스크롤 중이면 무시) */
function wkBindSwipe(){
  var el=document.querySelector('.sw');
  if(!el)return;
  var x0=0,y0=0,on=false;
  el.addEventListener('touchstart',function(e){
    if(e.touches.length!==1){on=false;return;}
    if(el.scrollWidth>el.clientWidth+4){on=false;return;} /* 가로 스크롤 가능한 표는 제외 */
    on=true;x0=e.touches[0].clientX;y0=e.touches[0].clientY;
  },{passive:true});
  el.addEventListener('touchend',function(e){
    if(!on)return;on=false;
    var t=e.changedTouches&&e.changedTouches[0];if(!t)return;
    var dx=t.clientX-x0,dy=t.clientY-y0;
    if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;
    wkGoWeek(dx<0?1:-1);
  },{passive:true});
}
function wkGoWeek(step){
  var ni=ci+step;
  if(ni<0||ni>=wks.length)return;
  ci=ni;wkFoldOpen=false; /* 주차를 옮기면 다시 접어서 보여준다 */
  if(typeof animMain==='function')animMain();
  render();
}

/* 지금 진행 중인 교시 번호 (없으면 0) */
function wkNowPeriod(){
  var d=new Date(),mins=d.getHours()*60+d.getMinutes();
  function toMin(v){var p=(v||'').split(':');return (+p[0])*60+(+p[1]||0);}
  for(var k in PERIOD_START){
    if(mins>=toMin(PERIOD_START[k])&&mins<toMin(PERIOD_END[k]))return parseInt(k,10);
  }
  return 0;
}
/* 오늘 칼럼 음영 + 진행 중인 수업(초록)·다음 수업(파랑) 칸 표시. 오늘 수업이 끝났으면 표시 없음 */
function wkMarkToday(){
  var dd=wdd[wks[ci]]||{},t=today(),di=-1;
  for(var i=0;i<DAYS.length;i++)if(dd[DAYS[i]]===t)di=i;
  if(di<0)return;
  var tbl=document.querySelector('.sw table.tt');
  if(!tbl)return;
  tbl.querySelectorAll('.td-now,.td-next,.td-t-now,.td-t-next').forEach(function(el){
    el.classList.remove('td-now','td-next','td-t-now','td-t-next');
  });
  var st=wkTodayState(),it=st&&(st.cur||st.next);
  var rows=tbl.querySelectorAll('tbody tr');
  for(var r=0;r<rows.length;r++){
    var tds=rows[r].querySelectorAll('td');
    var cell=tds[di+1];
    if(!cell||!cell.hasAttribute('data-p'))continue;
    cell.classList.add('td-today');
    if(it&&parseInt(cell.getAttribute('data-p'),10)===it.period){
      cell.classList.add(st.cur?'td-now':'td-next');
      tds[0].classList.add(st.cur?'td-t-now':'td-t-next');
    }
  }
}
/* 1분마다 지금/다음 표시 갱신 (시간표 탭이 보일 때만) */
function wkLiveTick(){
  if(typeof vw==='undefined'||vw!=='weekly'||document.hidden)return;
  var bar=document.querySelector('#main .tt-now'),html=wkNowBarHtml();
  if(bar){
    if(html){var tmp=document.createElement('div');tmp.innerHTML=html;bar.parentNode.replaceChild(tmp.firstChild,bar);}
    else bar.parentNode.removeChild(bar);
  }else if(html){
    var sw=document.querySelector('#main .sw'),anchor=sw&&sw.previousElementSibling&&sw.previousElementSibling.classList.contains('wk-todos')?sw.previousElementSibling:sw;
    if(anchor){var tmp2=document.createElement('div');tmp2.innerHTML=html;anchor.parentNode.insertBefore(tmp2.firstChild,anchor);}
  }
  wkMarkToday();
}
setInterval(wkLiveTick,60000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)wkLiveTick();});
/* 과목명 글자 크기 맞춤 — 칸 폭에 맞춰 줄여서 어절이 음절 중간에서 끊기지 않게.
   가장 작은 크기로도 안 들어가는 긴 어절만 비슷한 길이로 나눠 끊는다(전문외상/소생술). */
var _wkFitCtx=null;
function wkFitCards(){
  var els=document.querySelectorAll('#main .sw .card .cn-s:not(.cn-exam):not(.cn-hol)');
  if(!els.length)return;
  if(!_wkFitCtx)_wkFitCtx=document.createElement('canvas').getContext('2d');
  var ctx=_wkFitCtx,ZW='​',MIN=9;
  els[0].style.fontSize='';
  var cs0=getComputedStyle(els[0]),base=parseFloat(cs0.fontSize)||12;
  var fam=cs0.fontFamily,wt=cs0.fontWeight;
  function plan(text,size,W){
    /* 반환: {t:줄바꿈 후보(ZW) 넣은 문자열, cut:어절을 쪼갰는지} */
    ctx.font=wt+' '+size+'px '+fam;
    var cut=false;
    var out=text.split(/\s+/).map(function(word){
      /* 괄호 앞은 자연스러운 끊는 자리 */
      return word.replace(/(.)\(/g,'$1'+ZW+'(').split(ZW).map(function(part){
        var w=ctx.measureText(part).width;
        if(w<=W)return part;
        cut=true;
        var ch=Array.from(part),n=Math.ceil(w/W),per=Math.ceil(ch.length/n),r=[];
        for(var i=0;i<ch.length;i+=per)r.push(ch.slice(i,i+per).join(''));
        /* 마지막 조각이 한 글자면 앞 조각에서 하나 넘겨받음 */
        if(r.length>1&&Array.from(r[r.length-1]).length===1&&Array.from(r[r.length-2]).length>2){
          var pv=Array.from(r[r.length-2]);r[r.length-1]=pv.pop()+r[r.length-1];r[r.length-2]=pv.join('');
        }
        return r.join(ZW);
      }).join(ZW);
    }).join(' ');
    return {t:out,cut:cut};
  }
  Array.prototype.forEach.call(els,function(el){
    var card=el.parentNode;
    if(!card||!el.clientWidth)return;
    var orig=el.getAttribute('data-o');
    if(orig==null){orig=el.textContent;el.setAttribute('data-o',orig);}
    var ccs=getComputedStyle(card),other=0;
    Array.prototype.forEach.call(card.children,function(c){if(c!==el)other+=c.offsetHeight;});
    var avail=card.clientHeight-parseFloat(ccs.paddingTop)-parseFloat(ccs.paddingBottom)-other;
    card.style.paddingLeft=card.style.paddingRight='';
    var W=el.clientWidth-0.5,pick=null,soft=null,last=null;
    for(var size=base;size>=MIN;size-=0.5){
      /* 줄여야 하는 칸은 좌우 여백도 조금 좁혀 한 글자 더 들어가게 */
      if(size===base-0.5){card.style.paddingLeft=card.style.paddingRight='4px';W=el.clientWidth-0.5;}
      var pl=plan(orig,size,W),lh=size*1.2;
      var lines=Math.max(1,Math.floor((avail+1.5)/lh));
      el.style.fontSize=size+'px';
      el.style.webkitLineClamp=lines;
      el.style.overflowWrap='normal';
      el.textContent=pl.t;
      var fits=el.scrollHeight<=lines*lh+1.5;
      last={size:size,t:pl.t,lines:lines};
      if(fits&&!pl.cut){pick=last;break;}
      if(fits&&!soft)soft=last;
    }
    var use=pick||soft||last;
    if(use.size===base)card.style.paddingLeft=card.style.paddingRight='';
    el.style.fontSize=use.size===base?'':use.size+'px';
    el.style.webkitLineClamp=use.lines;
    el.textContent=use.t;
  });
}
var _wkFitTimer=null;
window.addEventListener('resize',function(){
  clearTimeout(_wkFitTimer);
  _wkFitTimer=setTimeout(function(){if(typeof vw!=='undefined'&&vw==='weekly')wkFitCards();},150);
});
function renderW(){
  var w=wks[ci],t=today(),dd=wdd[w]||{};
  /* 시간표 없음(신규 학교·학년) → 개인 업로드 안내 */
  if(!merged.length){
    var wnav=document.getElementById('wnav');
    if(wnav)wnav.style.display='none';
    document.getElementById('main').innerHTML=
      '<div class="empty-tt">'
      +'<div class="empty-tt-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5V4M12 4l-4 4M12 4l4 4"/><path d="M5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V15"/></svg></div>'
      +'<div class="empty-tt-ttl">아직 시간표가 없어요</div>'
      +'<div class="empty-tt-sub">학교에서 받은 시간표 파일(엑셀·PDF)을 올리면<br>이 기기에서 바로 볼 수 있어요</div>'
      +'<button class="empty-tt-btn" id="empty-upload">시간표 파일 업로드</button>'
      +'</div>';
    var eb=document.getElementById('empty-upload');
    if(eb)eb.onclick=function(){openXL();};
    return;
  }
  var wnavEl=document.getElementById('wnav');
  if(wnavEl&&vw==='weekly')wnavEl.style.display='flex'; /* 빈 상태에서 숨긴 것 복원 */
  document.getElementById('main').innerHTML=
    (typeof admBarHtml==='function'?admBarHtml():'')
    +secBarHtml()
    +elBarHtml()
    +ovBarHtml()
    +wkNowBarHtml()
    +wkTodoRowHtml()
    +'<div class="sw">'+(wh[w]||'<p style="padding:20px;color:#8E8E93">시간표 데이터 없음</p>')+'</div>'
    +'<div class="legend"><div class="lg-title">수강 과목</div><div class="lg-grid">'+(wl[w]||'')+'</div></div>'
    +ttSrcHtml();
  wkMarkToday();
  wkFoldEmpty();
  wkFitCards();
  wkBindSwipe();
  bindSecBar();
  var up=document.getElementById('tt-upload');
  if(up)up.onclick=function(){openXL();};
  var rp=document.getElementById('tt-report');
  if(rp)rp.onclick=function(){if(typeof rptOpen==='function')rptOpen();};
  var rs=document.getElementById('tt-resync');
  if(rs)rs.onclick=function(){
    ttLocalSet(false);
    try{localStorage.removeItem(ttKey());}catch(e){}
    loadFromFirebase();
  };
  var om=document.getElementById('ov-manage');
  if(om)om.onclick=openOvManage;
  var eb2=document.getElementById('el-open');
  if(eb2)eb2.onclick=openElective;
  var em=document.getElementById('el-manage');
  if(em)em.onclick=openElective;
  /* 셀 탭 → 수업 상세 */
  var ddNow=wdd[wks[ci]]||{};
  document.querySelectorAll('.sw .td-c[data-p]').forEach(function(td){
    td.onclick=function(){
      var d=this.getAttribute('data-day'),pn=parseInt(this.getAttribute('data-p'),10);
      var dt=ddNow[d];
      if(!dt)return;
      if(isAdmin&&typeof admInlineEdit==='function'){admInlineEdit(dt,d,pn);return;}
      var has=viewItems(merged).some(function(i){return i.date===dt&&i.period===pn&&!isHoliday(i.subject);});
      if(has)openClassInfo(dt,d,pn);
      else openClassEdit(dt,d,pn,null);
    };
  });
  document.querySelectorAll('.wk-td[data-date]').forEach(function(b){
    b.onclick=function(){
      var ds=this.getAttribute('data-date'),d=this.getAttribute('data-day'),p=ds.split('-');
      openDtodo(ds,parseInt(p[1])+'월 '+parseInt(p[2])+'일 ('+d+')');
    };
  });
  for(var i=0;i<DAYS.length;i++){
    var d=DAYS[i];
    if(dd[d]===t){
      var els=document.querySelectorAll('[data-day="'+d+'"]');
      for(var j=0;j<els.length;j++)els[j].classList.add('tc');
    }
  }
}
