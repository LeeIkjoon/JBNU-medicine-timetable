/* ══════════════════════════════════════════
   목록 뷰
══════════════════════════════════════════ */
function lcardH(it){
  var c=gcol(it.subject),sh='',ex='';
  var itIsExam=(it.is_exam===true||it.is_exam==='true')||isEx(it.subject);
  if(itIsExam){
    var lb=exLabel(it.subject),et=lb[0],ba=lb[1];
    var dispName=(et&&et!==it.subject)?et:it.subject;
    sh='<div class="lc-s" style="color:var(--danger-strong);font-weight:700">'+dispName+'</div>'+(ba?'<div style="font-size:12px;color:var(--text-muted);margin-top:2px">'+ba+'</div>':'');
    ex='border:2px solid '+c+';';
  }else{sh='<div class="lc-s">'+it.subject+'</div>';}
  var ph=it.professor?'<div class="lc-p">'+it.professor+'</div>':'';
  return'<div class="lcard'+(itIsExam?' exam-card':'')+'" style="'+ex+'"><div class="lc-bar" style="background:'+c+'"></div>'
    +'<div class="lc-body">'+sh+ph+'<div class="lc-t">'+it.day+'요일 '+it.start+'~'+it.end+'</div></div></div>';
}
function byDateH(items){
  var bd={};
  for(var i=0;i<items.length;i++){var it=items[i];if(!bd[it.date])bd[it.date]=[];bd[it.date].push(it);}
  var dates=Object.keys(bd).sort();
  var todayStr=today();
  var WK=['일','월','화','수','목','금','토'];
  var h='<table class="xl-table"><thead><tr>'+
    '<th>시간</th><th></th><th>과목</th><th>교수</th>'+
  '</tr></thead><tbody>';
  for(var di=0;di<dates.length;di++){
    var dt=dates[di],d=new Date(dt),grp=bd[dt];
    var isToday=(dt===todayStr);
    var m=d.getMonth()+1,day=d.getDate(),dow=WK[d.getDay()];
    var lbl=m+'/'+day+' ('+dow+')';
    var hx=false;for(var gi=0;gi<grp.length;gi++)if(isEx(grp[gi].subject)){hx=true;break;}
    var todayCls=isToday?' today':'';
    h+='<tr class="xl-date-row'+todayCls+'"><td colspan="4">'+lbl+
      (isToday?'<span class="xl-today-badge">오늘</span>':'')+
      (hx?'<span class="exam-flag">시험</span>':'')+
    '</td></tr>';
    grp.sort(function(a,b){return a.period-b.period;});

    /* 인접한 같은 과목+교수 묶기 */
    var merged2=[];
    for(var gi2=0;gi2<grp.length;gi2++){
      var it=grp[gi2];
      var last=merged2.length>0?merged2[merged2.length-1]:null;
      if(last && last.subject===it.subject && last.professor===it.professor
         && it.period===last.endPeriod+1){
        last.endPeriod=it.period;
        last.end=it.end;
      } else {
        merged2.push({subject:it.subject,professor:it.professor,
          period:it.period,endPeriod:it.period,start:it.start,end:it.end});
      }
    }

    for(var mi=0;mi<merged2.length;mi++){
      var it2=merged2[mi];
      var c=gcol(it2.subject);
      var isE=isEx(it2.subject);
      var lb=isE?exLabel(it2.subject):null;
      var subjTxt=isE?(lb?lb[0]:it2.subject):it2.subject;
      h+='<tr class="xl-row'+(isE?' exam-row':'')+'">'+
        '<td class="xl-tm"><b>'+it2.start+'</b><span>'+it2.end+'</span></td>'+
        '<td class="xl-dot" style="background:'+c+'"></td>'+
        '<td class="xl-subj'+(isE?' exam':'')+'">'+subjTxt+'</td>'+
        '<td class="xl-prof">'+(it2.professor||'')+'</td>'+
      '</tr>';
    }
  }
  h+='</tbody></table>';
  return h;
}
function renderL(){
  document.getElementById('main').innerHTML='<div class="list-wrap">'+byDateH(viewItems(merged))+'</div>';
}

/* ══════════════════════════════════════════
   시수 뷰 — 과목별·교수별 수업 시수
   (시험 배점이 교수별 시수에 비례하므로 비율 표시)
══════════════════════════════════════════ */
var fView='hours';      /* 'hours' | 'sched' — 시수가 기본 */
var fCleared=false;     /* 전체 해제 상태 (빈 선택을 전체선택으로 되돌리지 않게) */
var hrsRange='all';     /* 시수 범위: all | mid(중간까지) | fin(중간 이후) */
var fHoursOpen={};      /* 과목명 → 펼침 여부 */

function hoursData(){
  var subj={};
  var src=viewItems(merged);
  /* 과목(베이스)별 중간고사 날짜 — 범위 분할 기준 */
  function baseName(x){
    return x.replace(/\s*\(([^)]*)\)\s*$/,function(m,inner){
      return /^\d+$/.test(inner.trim())?m:'';
    })||x;
  }
  var midDate={};
  for(var mi2=0;mi2<src.length;mi2++){
    var m2=src[mi2];
    var txt=(m2.subject||'')+' '+(m2.topic||'');
    if(/중간/.test(txt)&&/(고사|시험|평가)/.test(txt)){
      var b2=baseName(m2.subject);
      if(!midDate[b2]||m2.date<midDate[b2])midDate[b2]=m2.date;
    }
  }
  for(var i=0;i<src.length;i++){
    var it=src[i],s=it.subject;
    if(!s||isEv(s)||isHoliday(s))continue;
    if((it.is_exam===true||it.is_exam==='true')||isEx(s))continue;
    /* 범위 필터: 그 과목에 중간고사가 있을 때만 분할 */
    if(hrsRange!=='all'){
      var bb=baseName(s),md=midDate[bb];
      if(md){
        if(hrsRange==='mid'&&it.date>=md)continue;
        if(hrsRange==='fin'&&it.date<md)continue;
      }
    }
    /* 끝 괄호 분파 통합 — 단 (1)(2)처럼 숫자 괄호는 별개 과목이므로 유지 */
    s=s.replace(/\s*\(([^)]*)\)\s*$/,function(m,inner){
      return /^\d+$/.test(inner.trim())?m:'';
    })||s;
    var p=(it.professor||'').trim()||'미정';
    if(!subj[s])subj[s]={total:0,prof:{},rep:it.subject}; /* rep: 색상용 원본 과목명 */
    subj[s].total++;
    var pr=subj[s].prof[p]||(subj[s].prof[p]={n:0,last:''});
    pr.n++;
    if(it.date>pr.last)pr.last=it.date; /* 마지막 수업일 → 시험 시점 가늠 */
  }
  return Object.keys(subj).map(function(s){
    var profs=Object.keys(subj[s].prof).map(function(p){
      return {name:p,hours:subj[s].prof[p].n,last:subj[s].prof[p].last};
    }).sort(function(a,b){return b.hours-a.hours||a.name.localeCompare(b.name,'ko');});
    return {subject:s,rep:subj[s].rep,total:subj[s].total,profs:profs};
  }).sort(function(a,b){return b.total-a.total||a.subject.localeCompare(b.subject,'ko');});
}

function renderHours(){
  var data=hoursData();
  var h='';
  if(!data.length){
    h+='<div class="no-res">수업 데이터가 없습니다</div>';
  }else{
    h+='<div class="hrs-note">1교시 = 1시간 · 시험·행사 제외 · 배점은 교수님별 시수에 비례 · ~날짜는 그 교수님의 마지막 수업</div>';
    h+='<div class="hrs-range">'
      +'<button class="hrs-range-btn'+(hrsRange==='all'?' on':'')+'" data-r="all">전체</button>'
      +'<button class="hrs-range-btn'+(hrsRange==='mid'?' on':'')+'" data-r="mid">중간 범위</button>'
      +'<button class="hrs-range-btn'+(hrsRange==='fin'?' on':'')+'" data-r="fin">기말 범위</button>'
      +'</div>';
    for(var i=0;i<data.length;i++){
      var d=data[i],c=gcol(cmap[d.subject]?d.subject:d.rep),open=!!fHoursOpen[d.subject];
      h+='<div class="hrs-card">';
      h+='<button class="hrs-head" data-i="'+i+'">';
      h+='<span class="hrs-dot" style="background:'+c+'"></span>';
      h+='<span class="hrs-subj">'+escHtml(d.subject)+'</span>';
      h+='<span class="hrs-total">'+d.total+'시간</span>';
      h+='<span class="hrs-arrow'+(open?' open':'')+'">›</span>';
      h+='</button>';
      if(open){
        h+='<div class="hrs-body">';
        for(var j=0;j<d.profs.length;j++){
          var pr=d.profs[j];
          var pct=d.total>0?Math.round(pr.hours/d.total*100):0;
          var lastTxt=pr.last?('~'+parseInt(pr.last.slice(5,7),10)+'/'+parseInt(pr.last.slice(8,10),10)):'';
          h+='<div class="hrs-row">';
          h+='<div class="hrs-row-top"><span class="hrs-prof">'+escHtml(pr.name)
            +(lastTxt?'<span class="hrs-last">'+lastTxt+'</span>':'')+'</span>'
            +'<span class="hrs-meta">'+pr.hours+'시간 · '+pct+'%</span></div>';
          h+='<div class="hrs-track"><div class="hrs-bar" style="width:'+pct+'%;background:'+c+'"></div></div>';
          h+='</div>';
        }
        h+='</div>';
      }
      h+='</div>';
    }
  }
  var el=document.getElementById('fres');if(!el)return;
  el.innerHTML=h;
  el.querySelectorAll('.hrs-range-btn').forEach(function(b){
    b.onclick=function(){hrsRange=this.getAttribute('data-r');renderF();};
  });
  var heads=el.querySelectorAll('.hrs-head');
  for(var k=0;k<heads.length;k++){
    heads[k].onclick=function(){
      var s=data[parseInt(this.getAttribute('data-i'),10)].subject;
      fHoursOpen[s]=!fHoursOpen[s];
      renderF();
    };
  }
}

/* ══════════════════════════════════════════
   필터 뷰
══════════════════════════════════════════ */
function renderF(){
  /* merged에서 직접 과목 목록 추출 - 항상 현재 시간표 기준 */
  var subjSet={};
  for(var mi=0;mi<merged.length;mi++){
    var s0=merged[mi].subject;
    /* 시험 항목은 원 과목 칩에 귀속 (별도 칩 없음) */
    if(s0&&!isEv(s0)&&!isHoliday(s0)&&!isEx(s0)) subjSet[s0]=true;
  }
  var allSubj=Object.keys(subjSet).sort(function(a,b){return a.localeCompare(b,'ko');});
  /* fsubj2 동기화: 사라진 과목만 제거. 빈 목록은 '전체 해제' 상태로 존중
     (최초 진입 등 미설정 상태에서만 전체 선택) */
  fsubj2=fsubj2.filter(function(s){return subjSet[s]!==undefined;});
  if(fsubj2.length===0 && !fCleared){
    fsubj2=allSubj.slice();
  }

  var nS=allSubj;

  var h='<div class="fw">';
  h+='<div class="fseg">'
    +'<button class="fseg-btn'+(fView==='hours'?' on':'')+'" id="fseg-hours">수업 시수</button>'
    +'<button class="fseg-btn'+(fView==='sched'?' on':'')+'" id="fseg-sched">수업 일정</button>'
    +'</div>';

  if(fView==='hours'){
    h+='<div id="fres"></div></div>';
    document.getElementById('main').innerHTML=h;
    bindFSeg();
    renderHours();
    return;
  }

  h+='<div class="fs"><div class="fs-ttl">빠른 필터</div><div class="chips">';
  h+='<button class="chip chip-exam'+(fExam?' on':'')+'" id="chip-exam">시험만 보기</button>';
  var aon=!fExam&&fsubj2.length===allSubj.length;
  h+='<button class="chip chip-all'+(aon?' on':'')+'" id="chip-all">전체 선택</button>';
  h+='<button class="chip" id="chip-clr">전체 해제</button>';
  h+='</div></div>';

  if(nS.length){
    h+='<div class="fs"><div class="fs-ttl">일반 과목</div><div class="chips">';
    for(var i=0;i<nS.length;i++){
      var s=nS[i],c=gcol(s),on2=!fExam&&fsubj2.indexOf(s)>=0;
      h+='<button class="chip fchip '+(on2?'on':'off')+'" data-s="'+s+'" style="border-color:'+c+';'+(on2?'background:'+c+';':'')+'">'+s+'</button>';
    }
    h+='</div></div>';
  }
  h+='<div id="fres"></div></div>';
  document.getElementById('main').innerHTML=h;
  bindFSeg();

  document.getElementById('chip-exam').onclick=function(){
    fExam=!fExam;
    fsubj2=fExam?allSubj.filter(function(s){return isEx(s);}):allSubj.slice();
    renderF();
  };
  document.getElementById('chip-all').onclick=function(){fExam=false;fCleared=false;fsubj2=allSubj.slice();renderF();};
  document.getElementById('chip-clr').onclick=function(){fExam=false;fCleared=true;fsubj2=[];renderF();};
  var chips=document.querySelectorAll('.fchip');
  for(var k=0;k<chips.length;k++){
    chips[k].onclick=function(){
      var s=this.getAttribute('data-s');
      fExam=false;
      var idx=fsubj2.indexOf(s);
      if(idx>=0)fsubj2.splice(idx,1);else fsubj2.push(s);
      renderF();
    };
  }
  renderFR();
}
function bindFSeg(){
  document.getElementById('fseg-sched').onclick=function(){if(fView!=='sched'){fView='sched';window.scrollTo(0,0);renderF();}};
  document.getElementById('fseg-hours').onclick=function(){if(fView!=='hours'){fView='hours';window.scrollTo(0,0);renderF();}};
}
function renderFR(){
  var items=viewItems(merged).slice();
  if(fExam){
    items=items.filter(function(i){return isEx(i.subject)||i.is_exam===true||i.is_exam==='true';});
  }else{
    /* 시험 항목은 원 과목이 선택돼 있으면 함께 표시 */
    items=items.filter(function(i){
      var s=i.subject;
      if(fsubj2.indexOf(s)>=0)return true;
      if(isEx(s)){var b=examBase(s);return b&&fsubj2.indexOf(b)>=0;}
      return false;
    });
  }
  var el=document.getElementById('fres');if(!el)return;
  if(!items.length){el.innerHTML='<div class="no-res">조건에 맞는 수업이 없습니다</div>';return;}
  el.innerHTML='<div class="list-wrap">'+byDateH(items)+'</div>';
}
