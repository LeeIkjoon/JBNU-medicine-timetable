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

/* null-safe HTML escape (원본의 두 escHtml 선언 중 살아 있던 버전) */
function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
