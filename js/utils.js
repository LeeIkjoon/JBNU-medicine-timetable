function p2(n){return ('0'+n).slice(-2);}
function today(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function isEx(s){return s.indexOf('시험')>=0||s.indexOf('퀴즈')>=0||s.indexOf('고사')>=0||s.indexOf('examination')>=0||s.indexOf('exam')>=0||s.indexOf('quiz')>=0;}
function isEv(s){return EVK.indexOf(s)>=0;}
function wvals(w){var o=wdd[w];if(!o)return[];return Object.keys(o).map(function(k){return o[k];}).filter(Boolean);}
function gcol(s){return cmap[s]||'#C4B5FD';}
/* 시험 과목명에서 원 과목명 추출: '감염학 시험' → '감염학' */
function examBase(s){
  var b=s.replace(/\s*(중간|기말|1차|2차)?\s*(시험|고사|퀴즈|땡시)\s*(\(퀴즈\))?\s*$/,'').trim();
  return b&&b!==s?b:'';
}
function isHoliday(s){
  for(var i=0;i<HOLIDAY_KW.length;i++){if(s.indexOf(HOLIDAY_KW[i])>=0)return true;}
  return false;
}
function fmtDate(ds){/* "2026-03-17" → "03.17" */if(!ds)return'';var p=ds.split('-');return p.length>=3?p[1]+'.'+p[2]:ds.slice(5).replace('-','.');}
function exLabel(s){
  var EXAM_TYPES=[
    '중간 시험 (퀴즈)','기말 시험 (퀴즈)','중간 시험','기말 시험',
    '중간고사','기말고사','중간평가','기말평가',
    'Mid-term examination','Final examination','Mid-term exam','Final exam',
    'mid-term examination','final examination','퀴즈','quiz'
  ];
  for(var ti=0;ti<EXAM_TYPES.length;ti++){
    var et=EXAM_TYPES[ti];
    if(s.toLowerCase().indexOf(et.toLowerCase())>=0){
      var subj=s.slice(0,s.toLowerCase().indexOf(et.toLowerCase())).trim()
               .replace(/[\(\-\s]+$/,'').trim();
      return[et, subj];
    }
  }
  /* 'XX 시험', 'XX고사' 일반 패턴 */
  var si=s.lastIndexOf('시험');
  if(si>=0){var pre=s.slice(0,si).trim();return[(pre?pre+' ':'')+'시험',''];}
  var gi=s.lastIndexOf('고사');
  if(gi>=0){var pre2=s.slice(0,gi).trim();return[(pre2?pre2+' ':'')+'고사',''];}
  /* 영어 exam */
  var li=s.toLowerCase().lastIndexOf('exam');
  if(li>=0)return['시험',''];
  return[s,''];
}

/* 학교·학년별 localStorage 키 (jbnu는 레거시 무접두 유지) */
function ttKey(){
  var sc=savedSchool||'jbnu';
  if(sc==='jbnu')return 'timetable_data_'+(savedGrade||'default');
  return 'timetable_data_'+sc+'_'+(savedGrade||'default');
}

/* ── 분반 (SECTION_RULES 기반) ── */
function secRule(){
  if(typeof SECTION_RULES==='undefined')return null;
  return SECTION_RULES[(savedSchool||'jbnu')+'|'+savedGrade]||null;
}
function secKey(){
  var sc=savedSchool||'jbnu';
  if(sc==='jbnu')return 'section_'+(savedGrade||'default'); /* 레거시 키 유지 */
  return 'section_'+sc+'_'+(savedGrade||'default');
}
function secSel(){try{return localStorage.getItem(secKey());}catch(e){return null;}}
function secSet(d){try{localStorage.setItem(secKey(),d);}catch(e){}}
/* 선택된 분반 요일 외의 분반 과목 수업 제거. 규칙 없거나 미선택이면 그대로 */
function secFilter(items){
  var r=secRule();if(!r)return items;
  var sel=secSel();if(!sel)return items;
  if(r.mode==='sec'){
    return items.filter(function(it){return !it.sec||it.sec===sel;});
  }
  if(r.days.indexOf(sel)<0)return items;
  return items.filter(function(it){return it.subject!==r.subject||it.day===sel;});
}

/* ── 내 파일 모드: 사용자가 직접 올린 파일 사용 중 (실시간 동기화 일시 중지) ── */
function ttLocalKey(){return 'tt_local_'+(savedSchool||'jbnu')+'_'+(savedGrade||'');}
function ttLocalOn(){try{return localStorage.getItem(ttLocalKey())==='1';}catch(e){return false;}}
function ttLocalSet(v){try{v?localStorage.setItem(ttLocalKey(),'1'):localStorage.removeItem(ttLocalKey());}catch(e){}}

/* ── 전공선택(선택과목) — 시간이 겹치는 과목 그룹에서 수강 과목 선택 ── */
function elKey(){return 'elective_'+(savedSchool||'jbnu')+'_'+(savedGrade||'');}
function elLoad(){
  try{var o=JSON.parse(localStorage.getItem(elKey())||'null');if(o&&o.chosen)return o;}catch(e){}
  return {chosen:{}};
}
function elSave(o){try{localStorage.setItem(elKey(),JSON.stringify(o));}catch(e){}}
/* 같은 교시대에 공존하는 과목들 → 선택 그룹 (연결 요소로 병합) */
function electiveGroups(){
  var src=secFilter(merged),slot={};
  for(var i=0;i<src.length;i++){
    var it=src[i],s=it.subject;
    if(!s||isEv(s)||isHoliday(s)||isEx(s)||it.is_exam===true||it.is_exam==='true')continue;
    var k=it.date+'|'+it.period;
    (slot[k]=slot[k]||{})[s]=1;
  }
  var adj={};
  Object.keys(slot).forEach(function(k){
    var subs=Object.keys(slot[k]);
    if(subs.length<2)return;
    subs.forEach(function(a){
      adj[a]=adj[a]||{};
      subs.forEach(function(b){if(a!==b)adj[a][b]=1;});
    });
  });
  var seen={},groups=[];
  Object.keys(adj).forEach(function(a){
    if(seen[a])return;
    var stack=[a],grp=[];
    while(stack.length){
      var x=stack.pop();
      if(seen[x])continue;
      seen[x]=1;grp.push(x);
      Object.keys(adj[x]||{}).forEach(function(y){if(!seen[y])stack.push(y);});
    }
    if(grp.length>1)groups.push(grp.sort());
  });
  return groups;
}
function electiveFilter(items){
  var groups=electiveGroups();
  if(!groups.length)return items;
  var chosen=elLoad().chosen;
  if(!Object.keys(chosen).length)return items; /* 미선택 → 전체 표시 */
  var inGroup={};
  groups.forEach(function(g){g.forEach(function(s){inGroup[s]=1;});});
  return items.filter(function(it){
    if(!inGroup[it.subject])return true;
    return !!chosen[it.subject];
  });
}

/* ── 개인 시간표 편집 (로컬 오버라이드 — 본인 기기에만 적용) ── */
function ovKey(){return 'tt_ov_'+(savedSchool||'jbnu')+'_'+(savedGrade||'');}
function ovLoad(){
  try{var o=JSON.parse(localStorage.getItem(ovKey())||'null');
    if(o&&o.mod&&o.del&&o.add)return o;}catch(e){}
  return {mod:{},del:{},add:[]};
}
function ovSave(o){try{localStorage.setItem(ovKey(),JSON.stringify(o));}catch(e){}}
function ovSlot(it){return it.date+'|'+it.period;}
function ovHas(){var o=ovLoad();return Object.keys(o.mod).length||Object.keys(o.del).length||o.add.length;}
function ovApply(items){
  var o=ovLoad();
  if(!Object.keys(o.mod).length&&!Object.keys(o.del).length&&!o.add.length)return items;
  var out=[];
  for(var i=0;i<items.length;i++){
    var k=ovSlot(items[i]);
    if(o.del[k])continue;
    if(o.mod[k]){out.push(o.mod[k]);continue;}
    out.push(items[i]);
  }
  for(var j=0;j<o.add.length;j++)out.push(o.add[j]);
  return out;
}
/* 뷰 표시용 아이템: 분반 필터 + 개인 오버라이드 (관리자 모드는 원본 그대로) */
function viewItems(items){
  var f=secFilter(items);
  if(typeof isAdmin!=='undefined'&&isAdmin)return f;
  return ovApply(electiveFilter(f));
}

/* null-safe HTML escape (원본의 두 escHtml 선언 중 살아 있던 버전) */
function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
