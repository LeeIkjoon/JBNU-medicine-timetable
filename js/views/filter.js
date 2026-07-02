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
    '<th>교시</th><th></th><th>과목</th><th>교수</th><th>시간</th>'+
  '</tr></thead><tbody>';
  for(var di=0;di<dates.length;di++){
    var dt=dates[di],d=new Date(dt),grp=bd[dt];
    var isToday=(dt===todayStr);
    var m=d.getMonth()+1,day=d.getDate(),dow=WK[d.getDay()];
    var lbl=m+'/'+day+' ('+dow+')';
    var hx=false;for(var gi=0;gi<grp.length;gi++)if(isEx(grp[gi].subject)){hx=true;break;}
    var todayCls=isToday?' today':'';
    h+='<tr class="xl-date-row'+todayCls+'"><td colspan="5">'+lbl+
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
      var perTxt=it2.period===it2.endPeriod?it2.period+'교시':it2.period+'~'+it2.endPeriod+'교시';
      var timeTxt=it2.start+'~'+it2.end;
      h+='<tr class="xl-row'+(isE?' exam-row':'')+'">'+
        '<td class="xl-period">'+perTxt+'</td>'+
        '<td class="xl-dot" style="background:'+c+'"></td>'+
        '<td class="xl-subj'+(isE?' exam':'')+'">'+subjTxt+'</td>'+
        '<td class="xl-prof">'+(it2.professor||'')+'</td>'+
        '<td class="xl-time">'+timeTxt+'</td>'+
      '</tr>';
    }
  }
  h+='</tbody></table>';
  return h;
}
function renderL(){
  document.getElementById('main').innerHTML='<div class="list-wrap">'+byDateH(merged)+'</div>';
}

/* ══════════════════════════════════════════
   필터 뷰
══════════════════════════════════════════ */
function renderF(){
  /* merged에서 직접 과목 목록 추출 - 항상 현재 시간표 기준 */
  var subjSet={};
  for(var mi=0;mi<merged.length;mi++){
    var s0=merged[mi].subject;
    if(s0&&!isEv(s0)) subjSet[s0]=true;
  }
  var allSubj=Object.keys(subjSet).sort(function(a,b){return a.localeCompare(b,'ko');});
  /* fsubj2 초기화: 아직 설정 안 됐거나 현재 과목과 동기화 */
  if(fsubj2.length===0 || fsubj2.some(function(s){return subjSet[s]===undefined;})){
    fsubj2=allSubj.slice();
  }

  var eS=allSubj.filter(function(s){return isEx(s);});
  var nS=allSubj.filter(function(s){return!isEx(s);});

  var h='<div class="fw">';
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
  if(eS.length){
    h+='<div class="fs"><div class="fs-ttl">시험</div><div class="chips">';
    for(var j=0;j<eS.length;j++){
      var se=eS[j],ce=gcol(se),oe=(!fExam&&fsubj2.indexOf(se)>=0)||fExam;
      var lb2=exLabel(se),et2=lb2[0],ba2=lb2[1];
      h+='<button class="chip fchip '+(oe?'on':'off')+'" data-s="'+se+'" style="border-color:'+ce+';'+(oe?'background:'+ce+';':'')+'">'+et2+(ba2?' '+ba2:'')+'</button>';
    }
    h+='</div></div>';
  }
  h+='<div id="fres"></div></div>';
  document.getElementById('main').innerHTML=h;

  document.getElementById('chip-exam').onclick=function(){
    fExam=!fExam;
    fsubj2=fExam?allSubj.filter(function(s){return isEx(s);}):allSubj.slice();
    renderF();
  };
  document.getElementById('chip-all').onclick=function(){fExam=false;fsubj2=allSubj.slice();renderF();};
  document.getElementById('chip-clr').onclick=function(){fExam=false;fsubj2=[];renderF();};
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
function renderFR(){
  var items=merged.slice();
  if(fExam){
    items=items.filter(function(i){return isEx(i.subject);});
  }else{
    items=items.filter(function(i){return fsubj2.indexOf(i.subject)>=0;});
  }
  var el=document.getElementById('fres');if(!el)return;
  if(!items.length){el.innerHTML='<div class="no-res">조건에 맞는 수업이 없습니다</div>';return;}
  el.innerHTML='<div class="list-wrap">'+byDateH(items)+'</div>';
}
