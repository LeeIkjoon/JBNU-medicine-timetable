function buildWeekTable(w,items){
  items=viewItems(items); /* 분반 + 개인 편집 반영 */
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
      if(it.professor)html+='<div class="cn-p">'+it.professor+'</div>';
      html+='</div></td>';
    });

    html+='</tr>';
  }
  html+='</tbody></table>';
  return html;
}

function buildLegend(items){
  items=viewItems(items);
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
  for(var pi=1;pi<=10;pi++)ph+='<option value="'+pi+'"'+(pi===period?' selected':'')+'>'+pi+'교시 · '+PERIOD_START[pi]+'~'+PERIOD_END[pi]+'</option>';
  ps.innerHTML=ph;
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
  var wk=null;for(var w in wdd){if(wdd[w]&&wdd[w][c.day]===c.dt){wk=w;break;}}
  var item={week:wk||wks[ci]||'1',date:c.dt,day:c.day,period:newPeriod,
    start:PERIOD_START[newPeriod]||'',end:PERIOD_END[newPeriod]||'',
    subject:subj,professor:document.getElementById('edit-prof').value.trim(),
    is_exam:document.getElementById('edit-exam-chk').checked};
  var tp=document.getElementById('edit-topic').value.trim();
  if(tp)item.topic=tp;
  var o=ovLoad();
  /* 원래 슬롯 정리 (교시 이동 시 원 슬롯은 삭제 처리) */
  var k0=c.dt+'|'+c.period;
  delete o.del[k0];delete o.mod[k0];
  o.add=o.add.filter(function(a){return ovSlot(a)!==k0;});
  if(newPeriod!==c.period&&secFilter(merged).some(function(i){return i.date===c.dt&&i.period===c.period;}))o.del[k0]=1;
  /* 대상 슬롯에 배치 */
  var k1=c.dt+'|'+newPeriod;
  delete o.del[k1];
  o.add=o.add.filter(function(a){return ovSlot(a)!==k1;});
  if(secFilter(merged).some(function(i){return i.date===c.dt&&i.period===newPeriod;}))o.mod[k1]=item;
  else o.add.push(item);
  ovSave(o);closeClassEdit();ovRefresh();
}
/* ── 내 편집 목록 (오버라이드 관리) ── */
function ovBarHtml(){
  if(typeof isAdmin!=='undefined'&&isAdmin)return'';
  var o=ovLoad();
  var n=Object.keys(o.mod).length+Object.keys(o.del).length+o.add.length;
  if(!n)return'';
  return '<div class="ov-bar"><span class="ov-bar-lbl">내가 수정한 수업 '+n+'개</span>'
    +'<button class="ov-bar-btn" id="ov-manage">관리</button></div>';
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
  document.getElementById('main').innerHTML=
    (typeof admBarHtml==='function'?admBarHtml():'')
    +secBarHtml()
    +ovBarHtml()
    +wkTodoRowHtml()
    +'<div class="sw">'+(wh[w]||'<p style="padding:20px;color:#8E8E93">시간표 데이터 없음</p>')+'</div>'
    +'<div class="legend"><div class="lg-title">수강 과목</div><div class="lg-grid">'+(wl[w]||'')+'</div></div>';
  bindSecBar();
  var om=document.getElementById('ov-manage');
  if(om)om.onclick=openOvManage;
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
