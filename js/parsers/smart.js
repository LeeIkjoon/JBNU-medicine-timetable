/* ══════════════════════════════════════════
   범용 시간표 파서 — 어떤 형식의 표든 최대한 인식
   입력: rows (2차원 배열; SheetJS sheet_to_json(header:1) 또는 parseCSV 결과)
   출력: {items, wddLocal, edLocal, format, warnings} 또는 {error}

   지원 레이아웃
   · wide  — 행=날짜, 열=교시 (전북대 배부 엑셀: 주차/날짜/요일/1~10교시)
             헤더가 몇 번째 행에 있어도, 열 순서가 달라도, 주차 셀이 병합돼 비어 있어도 OK
   · long  — 행=수업 하나 (계명대: 일자/교시/교과목명/교수명 …) 헤더 이름으로 열 매핑
   · grid  — 열=요일, 행=교시, 주차별 블록 반복 (요일 헤더 행 + 날짜 행)
   · legacy— week,date,day,period,start,end,subject,professor,is_exam (앱 내보내기 CSV)
══════════════════════════════════════════ */

var SMART_DAY_MAP={'월':'월','화':'화','수':'수','목':'목','금':'금','토':'토','일':'일',
  'mon':'월','tue':'화','wed':'수','thu':'목','fri':'금','sat':'토','sun':'일'};
var SMART_DOW=['일','월','화','수','목','금','토'];

function smartStr(v){
  if(v===null||v===undefined)return'';
  if(v instanceof Date)return smartDateFromObj(v);
  return String(v).trim();
}
function smartDateFromObj(d){
  if(isNaN(d.getTime()))return'';
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}
/* 요일 토큰 → '월'~'일' (없으면 '') : '월', '월요일', '(월)', 'Mon', 'MONDAY', '9/1(월)'의 괄호 안 */
function smartDay(v){
  var s=smartStr(v);
  if(!s)return'';
  var m=s.match(/[（(]\s*([월화수목금토일])\s*[)）]/);
  if(m)return m[1];
  /* '월(8/31)', '월 9/1', '월요일 9.1' — 요일이 앞에 오고 뒤에 날짜 */
  m=s.match(/^([월화수목금토일])(?:요일)?\s*(?:[（(]|\d|$)/);
  if(m)return m[1];
  var t=s.replace(/요일$/,'').trim();
  if(SMART_DAY_MAP[t])return SMART_DAY_MAP[t];
  var en=t.toLowerCase().slice(0,3);
  if(/^[a-z]{3}$/.test(en)&&SMART_DAY_MAP[en]&&/^[a-z]+\.?$/i.test(t))return SMART_DAY_MAP[en];
  return'';
}
/* 날짜 → 'YYYY-MM-DD' (없으면 ''). yearHint: 연도 없는 'M/D' 형식용 */
function smartDate(v,yearHint){
  if(v===null||v===undefined||v==='')return'';
  if(v instanceof Date)return smartDateFromObj(v);
  if(typeof v==='number'){
    /* Excel 시리얼 (1900 기준). 20000~60000 ≈ 1954~2064 */
    if(v>20000&&v<60000){
      var d=new Date(Math.round((v-25569)*86400*1000));
      return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2);
    }
    /* 20260901 형태 */
    if(v>19000000&&v<21000000){var s8=String(v);return s8.slice(0,4)+'-'+s8.slice(4,6)+'-'+s8.slice(6,8);}
    return'';
  }
  var s=String(v).trim();
  if(!s)return'';
  /* 괄호 요일·시간 제거: '2026-09-01(월)', '2026-09-01 00:00:00' */
  s=s.replace(/[（(][^)）]*[)）]/g,'').replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/,'').trim();
  var m;
  if((m=s.match(/^(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})일?\.?$/)))
    return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  if((m=s.match(/^(\d{4})(\d{2})(\d{2})$/)))return m[1]+'-'+m[2]+'-'+m[3];
  if((m=s.match(/^(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/)))
    return '20'+m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  if((m=s.match(/^(\d{1,2})[.\/월]\s*(\d{1,2})일?\.?$/))){
    var y=yearHint||new Date().getFullYear();
    return y+'-'+('0'+m[1]).slice(-2)+'-'+('0'+m[2]).slice(-2);
  }
  return'';
}
function smartDowOf(dateStr){
  var p=dateStr.split('-');
  return SMART_DOW[new Date(+p[0],+p[1]-1,+p[2]).getDay()];
}
/* 교시 헤더/라벨 → 교시 번호 (없으면 0): '1교시', '1', '1교시(08:30)', '08:30~09:20', '8:30' */
function smartPeriod(v){
  var s=smartStr(v);
  if(!s)return 0;
  var m=s.match(/^(\d{1,2})\s*교시/);
  if(m)return parseInt(m[1],10);
  if(/^\d{1,2}$/.test(s)){var n=parseInt(s,10);return(n>=1&&n<=12)?n:0;}
  if(typeof v==='number'&&v>=1&&v<=12&&v===Math.floor(v))return v;
  m=s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*(period|p)\b/i);
  if(m)return parseInt(m[1],10);
  /* 시각 → 교시: 시작 시각의 시(hour) 기준 */
  m=s.match(/(\d{1,2}):(\d{2})/);
  if(m){
    var h=parseInt(m[1],10),mm=parseInt(m[2],10);
    /* 정오 이전엔 시:분 → 교시, 12:xx는 4교시 끝/점심 → 5로 취급하지 않음 */
    var H2P={8:1,9:2,10:3,11:4,13:5,14:6,15:7,16:8,17:9,18:10};
    if(h===12)return mm>=50?5:4;
    return H2P[h]||0;
  }
  return 0;
}
/* 헤더 셀 분류 */
function smartHeaderKind(v){
  var s=smartStr(v).toLowerCase().replace(/\s+/g,'');
  if(!s)return'';
  if(/^(주차|주|week|wk)$/.test(s))return'week';
  if(/^(날짜|일자|일시|date|수업일|강의일)$/.test(s)||/^(날짜|일자|date)/.test(s))return'date';
  if(/^(요일|day|dow)$/.test(s))return'day';
  if(/^(교시|period|시수|차시)$/.test(s))return'period';
  if(/^(시작|시작시간|시간|강의시간|수업시간|time|start|starttime)$/.test(s))return'time';
  if(/^(종료|종료시간|end|endtime)$/.test(s))return'end';
  if(/^(과목|과목명|교과목|교과목명|강의명|강좌명|수업명|subject|course|lecture|블록|block)$/.test(s)||/과목명|교과목/.test(s))return'subject';
  if(/^(교수|교수명|담당교수|담당|담당자|강사|강사명|professor|instructor|lecturer|teacher)$/.test(s)||/교수/.test(s))return'prof';
  if(/^(주제|강의주제|수업주제|내용|강의내용|수업내용|학습목표|topic|title|contents?)$/.test(s)||/주제/.test(s))return'topic';
  if(/^(강의실|장소|실습실|교실|room|place|location)$/.test(s))return'room';
  if(/^(구분|비고|note|remark|type|형태|수업형태|분반|section)$/.test(s))return'note';
  if(/^(is_exam|exam|시험)$/.test(s))return'exam';
  return'';
}

/* 셀 → {subj, prof, topic?} : 전북대 대시 표기 → 괄호 표기 → 줄바꿈 표기 순으로 시도 */
function smartCell(val){
  var s=smartStr(val);
  if(!s||s===','||s==='-'||s==='·'||s==='x'||s==='X')return null;
  /* 숫자·시각·날짜만 있는 셀은 과목이 아님 (열 추정 실패 시 쓰레기 방지) */
  if(/^[\d.:\-~\/\s]+$/.test(s))return null;
  var r=(typeof parseNativeCell==='function')?parseNativeCell(s):{subj:s,prof:''};
  if(!r||!r.subj)return null;
  if(!r.prof){
    /* '과목명 ( 교수명 )' / '과목명(교수명)' */
    var m=r.subj.match(/^(.*?)\s*[（(]\s*([가-힣]{2,5}|[A-Za-z][A-Za-z .]{1,24})\s*[)）]\s*$/);
    if(m&&m[1].trim()&&!/시험|퀴즈|중간|기말/.test(m[2])){r.subj=m[1].trim();r.prof=m[2].trim();}
  }
  if(!r.prof){
    /* '과목명 / 교수명' , '과목명 | 교수명' */
    var m2=r.subj.match(/^(.*?)\s*[\/|]\s*([가-힣]{2,5})\s*$/);
    if(m2&&m2[1].trim()){r.subj=m2[1].trim();r.prof=m2[2];}
  }
  r.subj=r.subj.replace(/\s{2,}/g,' ').trim();
  if(!r.subj)return null;
  return r;
}
function smartIsExam(s,topic){
  var t=(s||'')+' '+(topic||'');
  return /시험|퀴즈|고사|평가|exam|quiz|test\b|땡시/i.test(t)&&!/평가원|자기평가|self/i.test(t);
}
function smartIsHoliday(s){
  if(typeof isHoliday==='function'&&isHoliday(s))return true;
  return /공휴일|휴일|휴업|휴강|방학|삼일절|현충일|광복절|개천절|한글날|어린이날|근로자|부처님|석가탄신|대체휴|선거|창립기념|개교기념|체육대회|추석|설날|연휴|성탄|크리스마스|신정/.test(s);
}
function smartTimes(p){
  var st=(typeof PERIOD_START!=='undefined'&&PERIOD_START[p])||({1:'8:30',2:'9:30',3:'10:30',4:'11:30',5:'13:30',6:'14:30',7:'15:30',8:'16:30',9:'17:30',10:'18:30'})[p]||'8:30';
  var en=(typeof PERIOD_END!=='undefined'&&PERIOD_END[p])||({1:'9:20',2:'10:20',3:'11:20',4:'12:20',5:'14:20',6:'15:20',7:'16:20',8:'17:20',9:'18:20',10:'19:20'})[p]||'9:20';
  return[st,en];
}

/* ── 주차 없는 파일: 날짜 → 주차 (가장 이른 날짜가 속한 주의 월요일 기준, 1부터) ── */
function smartDnum(ds){var p=ds.split('-');return Math.round(new Date(+p[0],+p[1]-1,+p[2]).getTime()/86400000);}
/* 해당 날짜가 속한 주의 월요일 day-number */
function smartMonNum(ds){var p=ds.split('-');var dow=new Date(+p[0],+p[1]-1,+p[2]).getDay();return smartDnum(ds)-((dow+6)%7);}
function smartAssignWeeks(items){
  if(!items.length)return;
  var minMon=null;
  items.forEach(function(it){var n=smartMonNum(it.date);if(minMon===null||n<minMon)minMon=n;});
  items.forEach(function(it){it.week=String(Math.floor((smartMonNum(it.date)-minMon)/7)+1);});
}

/* ── 과목명 없는 '시험' 셀: 직전 7일간 가장 많이 들은 과목 이름을 붙임 ('감염학 시험') ── */
function smartNameBareExams(items){
  var n=0;
  var bare=items.filter(function(it){return /^(중간|기말|[1-4]차)?\s*(시험|고사|퀴즈)\s*(\(퀴즈\))?$/.test(it.subject);});
  if(!bare.length)return 0;
  var byDate={};
  items.forEach(function(it){
    if(it.is_exam||smartIsHoliday(it.subject))return;
    (byDate[it.date]=byDate[it.date]||[]).push(it.subject);
  });
  var dates=Object.keys(byDate).sort();
  bare.forEach(function(ex){
    var cnt={},best='',bestN=0,end=smartDnum(ex.date);
    for(var i=0;i<dates.length;i++){
      var dn=smartDnum(dates[i]);
      if(dn>end||dn<end-7)continue;
      byDate[dates[i]].forEach(function(sub){cnt[sub]=(cnt[sub]||0)+1;if(cnt[sub]>bestN){bestN=cnt[sub];best=sub;}});
    }
    if(best){ex.subject=best+' '+ex.subject.replace(/\s+/g,' ').trim();ex.is_exam=true;n++;}
  });
  return n;
}

/* ── 결과 조립 (공통) ── */
function smartFinish(items,format,warnings){
  if(!items.length)return{error:'수업 데이터를 찾을 수 없습니다. 파일 형식을 확인해주세요.'};
  /* 주차가 하나도 없으면 날짜로 부여, 일부만 비어 있으면 그 행만 날짜로 추정 */
  var noWeek=items.filter(function(it){return!it.week;}).length;
  if(noWeek===items.length)smartAssignWeeks(items);
  else if(noWeek){
    var byMon={};
    items.forEach(function(it){if(it.week)byMon[smartMonNum(it.date)]=it.week;});
    items.forEach(function(it){if(!it.week)it.week=byMon[smartMonNum(it.date)]||'';});
    items=items.filter(function(it){return it.week;});
  }
  var named=smartNameBareExams(items);
  if(named)warnings=(warnings||[]).concat(['과목명 없는 시험 '+named+'개는 직전 수업 과목 이름을 붙였어요']);
  var wddLocal={},edLocal=[];
  /* 같은 날짜·교시 중복 제거 (병합 셀 확장 등으로 생긴 완전 중복만) */
  var seen={},out=[];
  items.forEach(function(it){
    var k=it.date+'|'+it.period+'|'+it.subject+'|'+(it.professor||'');
    if(seen[k])return;seen[k]=1;
    out.push(it);
    if(!wddLocal[it.week])wddLocal[it.week]={};
    if(!wddLocal[it.week][it.day])wddLocal[it.week][it.day]=it.date;
    if(it.is_exam&&edLocal.indexOf(it.date)<0)edLocal.push(it.date);
  });
  edLocal.sort();
  /* 주차 번호 재정렬: 문자열 → 정수 문자열 */
  out.forEach(function(it){it.week=String(parseInt(it.week,10));});
  var wdd2={};Object.keys(wddLocal).forEach(function(w){wdd2[String(parseInt(w,10))]=wddLocal[w];});
  return{items:out,wddLocal:wdd2,edLocal:edLocal,format:format,warnings:warnings||[]};
}

/* ══════════ wide 레이아웃 ══════════ */
function smartFindWideHeader(rows){
  var limit=Math.min(rows.length,30);
  for(var r=0;r<limit;r++){
    var row=rows[r]||[];
    var map={week:-1,date:-1,day:-1},periods={},nPer=0;
    for(var c=0;c<row.length;c++){
      var k=smartHeaderKind(row[c]);
      if(k==='week'&&map.week<0)map.week=c;
      else if(k==='date'&&map.date<0)map.date=c;
      else if(k==='day'&&map.day<0)map.day=c;
      else{
        var p=smartPeriod(row[c]);
        if(p&&!periods[c]){periods[c]=p;nPer++;}
      }
    }
    if((map.date>=0||map.day>=0)&&nPer>=4)return{row:r,map:map,periods:periods};
  }
  return null;
}
/* 헤더가 없을 때: 데이터 행 모양으로 열 추정 (날짜 셀·요일 셀·그 뒤 연속 교시) */
function smartGuessWide(rows){
  var limit=Math.min(rows.length,40);
  for(var r=0;r<limit;r++){
    var row=rows[r]||[];
    var dc=-1,dyc=-1;
    for(var c=0;c<Math.min(row.length,6);c++){
      if(dc<0&&smartDate(row[c]))dc=c;
      else if(dc>=0&&dyc<0&&smartDay(row[c]))dyc=c;
    }
    if(dc<0||dyc<0)continue; /* 날짜와 요일 열이 모두 보여야 추정 */
    var first=dyc+1;
    if(row.length-first<4)continue;
    var wc=-1;
    for(var c2=0;c2<dc;c2++){var n=parseInt(smartStr(row[c2]),10);if(!isNaN(n)&&n>=1&&n<=52&&String(n)===smartStr(row[c2])){wc=c2;break;}}
    var periods={};for(var p=1;p<=10&&first+p-1<Math.max(row.length,first+10);p++)periods[first+p-1]=p;
    return{row:r-1,map:{week:wc,date:dc,day:dyc},periods:periods,guessed:true};
  }
  return null;
}
function smartParseWide(rows,hdr){
  var items=[],warnings=[],mismatch=0,curWeek='',yearHint=null;
  var pcols=Object.keys(hdr.periods).map(Number).sort(function(a,b){return a-b;});
  /* 연도 힌트: 파일 안에서 4자리 연도 찾기 */
  for(var r0=0;r0<Math.min(rows.length,60)&&!yearHint;r0++){
    var rw=rows[r0]||[];
    for(var c0=0;c0<rw.length;c0++){var m=smartStr(rw[c0]).match(/(20\d{2})/);if(m){yearHint=parseInt(m[1],10);break;}}
  }
  for(var r=hdr.row+1;r<rows.length;r++){
    var row=rows[r];if(!row)continue;
    var wkRaw=hdr.map.week>=0?smartStr(row[hdr.map.week]):'';
    var wkNum=parseInt(wkRaw.replace(/주차?$/,''),10);
    if(!isNaN(wkNum)&&wkNum>=1&&wkNum<=60&&/^\d+\s*주?차?$/.test(wkRaw))curWeek=String(wkNum);
    var dateStr=hdr.map.date>=0?smartDate(row[hdr.map.date],yearHint):'';
    var day=hdr.map.day>=0?smartDay(row[hdr.map.day]):'';
    if(!dateStr){
      /* 날짜 열이 없거나 비어 있는데 요일만 있는 행: 날짜 못 잡으면 건너뜀 */
      continue;
    }
    var realDay=smartDowOf(dateStr);
    if(!day)day=realDay;
    else if(day!==realDay){mismatch++;day=realDay;}
    if(day==='토'||day==='일')continue;
    var wk=curWeek; /* 병합 셀로 빈 주차 → 직전 주차 승계 */
    for(var i=0;i<pcols.length;i++){
      var c=pcols[i],p=hdr.periods[c];
      if(c>=row.length)break;
      var cell=smartCell(row[c]);
      if(!cell)continue;
      var t=smartTimes(p);
      var ex=smartIsExam(cell.subj);
      var it={week:wk,date:dateStr,day:day,period:p,start:t[0],end:t[1],
        subject:cell.subj,professor:cell.prof||'',is_exam:ex};
      if(smartIsHoliday(cell.subj))it.is_holiday=true;
      items.push(it);
    }
  }
  if(mismatch)warnings.push('요일과 날짜가 다른 행 '+mismatch+'개는 날짜 기준으로 맞췄어요');
  return smartFinish(items,'wide',warnings);
}

/* ══════════ long 레이아웃 (행 = 수업 1개) ══════════ */
function smartFindLongHeader(rows){
  var limit=Math.min(rows.length,30);
  for(var r=0;r<limit;r++){
    var row=rows[r]||[],map={},n=0;
    for(var c=0;c<row.length;c++){
      var k=smartHeaderKind(row[c]);
      if(k&&map[k]===undefined){map[k]=c;n++;}
    }
    if(map.date!==undefined&&map.subject!==undefined&&(map.period!==undefined||map.time!==undefined))return{row:r,map:map};
  }
  return null;
}
function smartParseLong(rows,hdr){
  var m=hdr.map,items=[],warnings=[],yearHint=null,curWeek='',curDate='';
  for(var r0=0;r0<Math.min(rows.length,60)&&!yearHint;r0++){
    var rw=rows[r0]||[];
    for(var c0=0;c0<rw.length;c0++){var mm=smartStr(rw[c0]).match(/(20\d{2})/);if(mm){yearHint=parseInt(mm[1],10);break;}}
  }
  var holidayAdded={};
  for(var r=hdr.row+1;r<rows.length;r++){
    var row=rows[r];if(!row)continue;
    if(m.week!==undefined){
      var wkRaw=smartStr(row[m.week]),wkNum=parseInt(wkRaw.replace(/주차?$/,''),10);
      if(!isNaN(wkNum)&&wkNum>=1&&wkNum<=60)curWeek=String(wkNum);
    }
    var ds=smartDate(row[m.date],yearHint);
    if(ds)curDate=ds;else ds=curDate; /* 병합 셀: 날짜 승계 */
    if(!ds)continue;
    var subj=smartStr(row[m.subject]);
    if(!subj)continue;
    var day=(m.day!==undefined&&smartDay(row[m.day]))||smartDowOf(ds);
    if(day==='토'||day==='일')continue;
    var period=0;
    if(m.period!==undefined)period=smartPeriod(row[m.period]);
    if(!period&&m.time!==undefined)period=smartPeriod(row[m.time]);
    if(!period)continue;
    if(period>10)continue;
    var prof=m.prof!==undefined?smartStr(row[m.prof]):'';
    var topic=m.topic!==undefined?smartStr(row[m.topic]):'';
    var room=m.room!==undefined?smartStr(row[m.room]):'';
    /* 과목 셀 자체에 교수 표기가 섞인 경우 */
    if(!prof){var sc=smartCell(subj);if(sc){subj=sc.subj;prof=sc.prof||'';}}
    var t=smartTimes(period);
    var start=t[0];
    if(m.time!==undefined){var tm=smartStr(row[m.time]).match(/(\d{1,2}):(\d{2})/);if(tm)start=parseInt(tm[1],10)+':'+tm[2];}
    var end=t[1];
    if(m.end!==undefined){var te=smartStr(row[m.end]).match(/(\d{1,2}):(\d{2})/);if(te)end=parseInt(te[1],10)+':'+te[2];}
    if(smartIsHoliday(subj)){
      if(holidayAdded[ds])continue;holidayAdded[ds]=true;
      items.push({week:curWeek,date:ds,day:day,period:1,start:'8:30',end:'17:00',subject:subj,professor:'',is_exam:false,is_holiday:true});
      continue;
    }
    var ex=smartIsExam(subj,topic)||(m.exam!==undefined&&/^(true|1|yes|y|o|시험)$/i.test(smartStr(row[m.exam])));
    var display=subj;
    if(ex&&topic&&topic!==subj&&!smartIsExam(subj)){display=subj+' ('+(topic.length<=8?topic:'시험')+')';}
    var it={week:curWeek,date:ds,day:day,period:period,start:start,end:end,subject:display,professor:prof,is_exam:ex};
    if(topic)it.topic=topic;
    if(room)it.room=room;
    items.push(it);
  }
  return smartFinish(items,'long',warnings);
}

/* ══════════ grid 레이아웃 (열=요일, 행=교시, 주차 블록 반복) ══════════ */
function smartFindDayHeaderRow(row){
  var cols={},n=0;
  for(var c=0;c<row.length;c++){
    var d=smartDay(row[c]);
    if(d&&d!=='토'&&d!=='일'&&!cols[d]){cols[d]=c;n++;}
  }
  return n>=3?cols:null;
}
function smartParseGrid(rows){
  var items=[],warnings=[],yearHint=null;
  for(var r0=0;r0<Math.min(rows.length,80)&&!yearHint;r0++){
    var rw=rows[r0]||[];
    for(var c0=0;c0<rw.length;c0++){var mm=smartStr(rw[c0]).match(/(20\d{2})/);if(mm){yearHint=parseInt(mm[1],10);break;}}
  }
  var r=0,blockIdx=0;
  while(r<rows.length){
    var row=rows[r]||[];
    var dayCols=smartFindDayHeaderRow(row);
    if(!dayCols){r++;continue;}
    blockIdx++;
    /* 주차 라벨: 헤더 행 ±2행 안의 'N주차' */
    var week='';
    for(var rr=Math.max(0,r-2);rr<=r+1&&!week;rr++){
      var rw2=rows[rr]||[];
      for(var cc=0;cc<rw2.length;cc++){var wm=smartStr(rw2[cc]).match(/(\d{1,2})\s*주\s*차?/);if(wm){week=String(parseInt(wm[1],10));break;}}
    }
    /* 날짜: 헤더 셀 자체('월(9/1)') → 아래 1~2행 → 위 1행 */
    var dates={},days=Object.keys(dayCols);
    days.forEach(function(d){
      var c=dayCols[d];
      var inHdr=smartStr(row[c]).replace(/[월화수목금토일]요?일?/,'').replace(/[（()）]/g,' ').trim();
      var ds=smartDate(inHdr,yearHint);
      if(!ds){for(var k=1;k<=2&&!ds;k++){var nr=rows[r+k]||[];ds=smartDate(nr[c],yearHint);}}
      if(!ds){var pr=rows[r-1]||[];ds=smartDate(pr[c],yearHint);}
      if(ds)dates[d]=ds;
    });
    /* 날짜가 하나만 있어도 나머지는 요일 차로 보정 */
    var anchorDay=null;
    for(var i=0;i<days.length;i++)if(dates[days[i]]){anchorDay=days[i];break;}
    if(anchorDay){
      var p=dates[anchorDay].split('-'),base=new Date(+p[0],+p[1]-1,+p[2]);
      var ai=SMART_DOW.indexOf(anchorDay);
      days.forEach(function(d){
        if(dates[d])return;
        var di=SMART_DOW.indexOf(d),nd=new Date(base);nd.setDate(base.getDate()+(di-ai));
        dates[d]=smartDateFromObj(nd);
      });
    }
    /* 교시 라벨 열: 첫 요일 열보다 왼쪽 */
    var firstDayCol=Math.min.apply(null,days.map(function(d){return dayCols[d];}));
    var rr2=r+1,seq=0;
    while(rr2<rows.length){
      var row2=rows[rr2]||[];
      if(smartFindDayHeaderRow(row2))break; /* 다음 블록 */
      var period=0;
      for(var lc=0;lc<firstDayCol;lc++){period=smartPeriod(row2[lc]);if(period)break;}
      /* 교시 라벨 없는 행: 날짜 행/빈 행이면 건너뜀. 좌측 열이 시간(예 '8:30')이면 smartPeriod가 처리 */
      if(period&&period<=10){
        seq=period;
        days.forEach(function(d){
          var ds=dates[d];if(!ds)return;
          var cell=smartCell(row2[dayCols[d]]);if(!cell)return;
          var t=smartTimes(period);
          var it={week:week,date:ds,day:d,period:period,start:t[0],end:t[1],
            subject:cell.subj,professor:cell.prof||'',is_exam:smartIsExam(cell.subj)};
          if(smartIsHoliday(cell.subj))it.is_holiday=true;
          items.push(it);
        });
      }
      rr2++;
    }
    if(!anchorDay&&days.length)warnings.push((week?week+'주차':blockIdx+'번째')+' 블록에서 날짜를 찾지 못해 건너뛰었어요');
    r=rr2;
  }
  return smartFinish(items,'grid',warnings);
}

/* ══════════ legacy (앱 CSV 내보내기) ══════════ */
function smartParseLegacy(rows){
  var hdr=rows[0].map(function(h){return smartStr(h).toLowerCase();});
  var need=['date','period','subject'];
  for(var i=0;i<need.length;i++)if(hdr.indexOf(need[i])<0)return null;
  var idx={};hdr.forEach(function(h,c){idx[h]=c;});
  var items=[];
  for(var r=1;r<rows.length;r++){
    var row=rows[r];if(!row||row.every(function(c){return!smartStr(c);}))continue;
    var g=function(k){return idx[k]!==undefined?smartStr(row[idx[k]]):'';};
    var ds=smartDate(g('date'));if(!ds)continue;
    var period=parseInt(g('period'),10)||smartPeriod(g('period'));if(!period)continue;
    var subj=g('subject');if(!subj)continue;
    var day=smartDay(g('day'))||smartDowOf(ds);
    var t=smartTimes(period);
    var ex=g('is_exam').toLowerCase();
    var it={week:g('week'),date:ds,day:day,period:period,start:g('start')||t[0],end:g('end')||t[1],
      subject:subj,professor:g('professor'),is_exam:(ex==='true'||ex==='1'||ex==='yes')||smartIsExam(subj)};
    if(g('topic'))it.topic=g('topic');
    if(g('room'))it.room=g('room');
    items.push(it);
  }
  return smartFinish(items,'legacy',[]);
}

/* ══════════ 학년 병렬 long 레이아웃 (계명대 '전체' 시트) ══════════
   헤더: 일시 | 교시 | 시작시간 | 의예과 1학년 | 교수명 | 강의실 | 의예과 2학년 | 교수명 | 강의실 …
   → 학년 열마다 별도 결과 [{name, result}] */
function smartParseMultiGrade(rows){
  var limit=Math.min(rows.length,30),hdrRow=-1,map={},grades=[];
  for(var r=0;r<limit&&hdrRow<0;r++){
    var row=rows[r]||[],m={},gs=[];
    for(var c=0;c<row.length;c++){
      var txt=smartStr(row[c]);
      if(/학년/.test(txt)&&!/^(학년)$/.test(txt)){gs.push({col:c,name:txt.replace(/\s+/g,' ')});continue;}
      var k=smartHeaderKind(row[c]);
      if(k&&m[k]===undefined&&(k==='date'||k==='period'||k==='time'||k==='week'||k==='day'))m[k]=c;
    }
    if(m.date!==undefined&&(m.period!==undefined||m.time!==undefined)&&gs.length>=1){hdrRow=r;map=m;grades=gs;}
  }
  if(hdrRow<0)return null;
  var hdr=rows[hdrRow];
  var out=[];
  grades.forEach(function(g,gi){
    var endCol=gi+1<grades.length?grades[gi+1].col:hdr.length;
    var gm={date:map.date,period:map.period,time:map.time,week:map.week,day:map.day,subject:g.col};
    for(var c=g.col+1;c<endCol;c++){
      var k=smartHeaderKind(hdr[c]);
      if(k==='prof'&&gm.prof===undefined)gm.prof=c;
      else if(k==='room'&&gm.room===undefined)gm.room=c;
      else if(k==='topic'&&gm.topic===undefined)gm.topic=c;
    }
    var res=smartParseLong(rows,{row:hdrRow,map:gm});
    if(res&&!res.error&&res.items.length)out.push({name:g.name,result:res});
  });
  return out.length?out:null;
}

/* ══════════ 진입점 ══════════ */
function smartParseRows(rows){
  if(!rows||!rows.length)return{error:'파일이 비어있습니다.'};
  /* 완전히 빈 행·열 정리 */
  rows=rows.map(function(r){return Array.isArray(r)?r:[];});
  var results=[];
  var legacy=(rows[0]&&rows[0].some(function(h){return /^(subject|period|date)$/i.test(smartStr(h));}))?smartParseLegacy(rows):null;
  if(legacy&&!legacy.error)results.push(legacy);
  var wideH=smartFindWideHeader(rows);
  if(wideH){var w=smartParseWide(rows,wideH);if(!w.error)results.push(w);}
  var longH=smartFindLongHeader(rows);
  if(longH){var l=smartParseLong(rows,longH);if(!l.error)results.push(l);}
  var g=smartParseGrid(rows);if(!g.error)results.push(g);
  if(!results.length&&!wideH&&!longH){
    var guess=smartGuessWide(rows);
    if(guess){
      var w2=smartParseWide(rows,guess);
      /* 추정 결과는 과목명에 글자가 있는 항목이 대부분일 때만 채택 */
      if(!w2.error){
        var alpha=w2.items.filter(function(it){return /[가-힣A-Za-z]/.test(it.subject);}).length;
        if(alpha>=w2.items.length*0.8){w2.warnings.push('헤더가 없어 열 순서를 추정했어요 (주차·날짜·요일·1~10교시)');results.push(w2);}
      }
    }
  }
  if(!results.length)return{error:'시간표 형식을 인식할 수 없습니다. 날짜·교시·과목이 있는 표인지 확인해주세요.'};
  /* 가장 많이 인식한 결과 채택 (동률이면 wide > long > grid > legacy) */
  var order={wide:0,long:1,grid:2,legacy:3};
  results.sort(function(a,b){return b.items.length-a.items.length||order[a.format]-order[b.format];});
  return results[0];
}

/* SheetJS 워크시트 → rows (병합 셀은 좌상단 값으로 채움 — 병합된 주차/과목 칸 대응) */
function smartSheetRows(ws){
  if(!ws||!ws['!ref'])return[];
  var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  var merges=ws['!merges']||[];
  for(var i=0;i<merges.length;i++){
    var m=merges[i];
    var top=rows[m.s.r]&&rows[m.s.r][m.s.c];
    if(top===undefined||top==='')continue;
    for(var r=m.s.r;r<=m.e.r;r++){
      if(!rows[r])rows[r]=[];
      for(var c=m.s.c;c<=m.e.c;c++){
        if(rows[r][c]===undefined||rows[r][c]==='')rows[r][c]=top;
      }
    }
  }
  return rows;
}
