/* ── 실제 엑셀 형식 파서 (주차/날짜/요일/1교시~10교시) ── */
var PERIOD_TIMES_MAP={1:['8:30','9:20'],2:['9:30','10:20'],3:['10:30','11:20'],4:['11:30','12:20'],
  5:['13:30','14:20'],6:['14:30','15:20'],7:['15:30','16:20'],8:['16:30','17:20'],9:['17:30','18:20'],10:['18:30','19:20']};
var KNOWN_SUBJ_SET={
  '진급식':1,'근로자의날':1,'대체휴무':1,'어린이날':1,'지방선거':1,
  '문제바탕학습1':1,'생애주기':1,'시험':1,'실험및논문연구2':1,'의료면담1':1,
  '의학생화학':1,'의학생화학 기말 시험':1,'의학생화학 중간 시험 (퀴즈)':1,
  '인체미세구조 실습':1,'인체미세구조와 기능':1,'인체반응 및 병태생리':1,
  '인체질병형태학실습':1,'조직학 시험':1,'환자의사사회1':1
};
var KNOWN_SUBJ_LIST=Object.keys(KNOWN_SUBJ_SET);

function parseNativeCell(val){
  /* 엑셀 셀 파싱:
     형태1: "과목명-교수명"          → subj=과목명, prof=교수명
     형태2: "과목명\n세부-교수명"    → subj=과목명, prof=교수명  (임상의학입문\n1-1-정연준)
     형태3: "과목명\n시험명-교수명"  → subj=과목명 시험명, prof=교수명
     형태4: "시험" / "문제바탕학습1" → subj=그대로, prof=''
  */
  if(!val&&val!==0)return null;
  var s=String(val).trim();
  if(!s||s===',')return null;

  var lines=s.split(/[\n\r]+/).map(function(l){return l.trim();}).filter(Boolean);
  var main=lines[0];
  var extra=lines.length>1?lines.slice(1).join(' '):'';

  var subj=main,prof='';

  /* main에서 과목명-교수명 분리 */
  var dashIdx=main.lastIndexOf('-');
  if(dashIdx>0){
    var beforeDash=main.slice(0,dashIdx).trim();
    var afterDash=main.slice(dashIdx+1).trim();
    /* afterDash가 한국어 이름(2~4글자)이면 교수명 */
    if(afterDash.length>=2&&afterDash.length<=5&&/^[가-힣]+$/.test(afterDash)){
      subj=beforeDash;
      prof=afterDash;
    }
    /* afterDash가 영문 약자(S, K, C 등)이면 교수명 */
    else if(/^[A-Z,\s]+$/.test(afterDash)){
      subj=beforeDash;
      prof=afterDash;
    }
    /* 그 외(숫자 포함 등)는 과목명의 일부 */
  }

  /* extra(두 번째 줄) 처리 */
  if(extra){
    var eDash=extra.lastIndexOf('-');
    if(eDash>0){
      var eAfter=extra.slice(eDash+1).trim();
      /* eAfter가 한국어 이름이면 교수명, 앞부분은 서브타입으로 버림(과목명에 합치지 않음) */
      if(eAfter.length>=2&&eAfter.length<=5&&/^[가-힣]+$/.test(eAfter)){
        if(!prof)prof=eAfter;
        /* extra의 과목명 부분(세부번호 등)은 무시 - 과목명에 합치지 않음 */
      } else {
        /* 시험명 등 의미있는 텍스트면 과목명에 추가 */
        var eBefore=extra.slice(0,eDash).trim();
        if(eBefore&&!/^\d/.test(eBefore))subj=subj+' '+eBefore;
        if(!prof&&eAfter)/^[가-힣]+$/.test(eAfter)?prof=eAfter:null;
      }
    } else {
      /* 대시 없는 두 번째 줄: 시험명 등 */
      if(!/^\d/.test(extra))subj=subj+' '+extra;
    }
  }

  return{subj:subj,prof:prof};
}

function isNativeFormat(rows){
  /* 헤더 행에 "주차","날짜","요일" 이 있으면 native 형식 */
  if(!rows||!rows[0])return false;
  var h0=String(rows[0][0]||'').trim();
  var h1=String(rows[0][1]||'').trim();
  var h2=String(rows[0][2]||'').trim();
  return(h0==='주차'||h0==='1')&&(h1==='날짜'||h1.match(/\d{4}/))&&(h2==='요일'||['월','화','수','목','금','토','일'].indexOf(h2)>=0)
    ||(h0==='주차'&&(h1==='날짜'||h1==='date')&&(h2==='요일'||h2==='day'));
}

function parseNativeRows(rows){
  var VALID={'월':1,'화':1,'수':1,'목':1,'금':1};
  var items=[],wddLocal={},edLocal=[];
  /* 헤더 행 체크 - 첫 행이 주차/날짜/요일이면 skip */
  var startRow=0;
  if(rows[0]&&(String(rows[0][0]).trim()==='주차'||String(rows[0][0]).trim()==='week'))startRow=1;

  for(var r=startRow;r<rows.length;r++){
    var row=rows[r];
    var weekRaw=row[0],dateRaw=row[1],dayRaw=row[2];
    if(!weekRaw||!dateRaw||!dayRaw)continue;
    var wk=String(weekRaw).trim();
    if(!wk||isNaN(parseInt(wk)))continue;
    wk=String(parseInt(wk));
    var day=String(dayRaw).trim();
    if(!VALID[day])continue;
    /* 날짜 정규화 */
    var dateStr='';
    if(typeof dateRaw==='string'&&dateRaw.match(/\d{4}-\d{2}-\d{2}/)){
      dateStr=dateRaw.slice(0,10);
    }else if(typeof dateRaw==='string'&&dateRaw.match(/\d{4}\/\d{1,2}\/\d{1,2}/)){
      var dp=dateRaw.split('/');dateStr=dp[0]+'-'+('0'+dp[1]).slice(-2)+'-'+('0'+dp[2]).slice(-2);
    }else if(typeof dateRaw==='number'){
      /* Excel serial date */
      var d=new Date(Math.round((dateRaw-25569)*86400*1000));
      dateStr=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    }else{
      var dp2=String(dateRaw).replace(/[.\-\/]/g,'-').trim();
      if(dp2.match(/^\d{4}-\d{1,2}-\d{1,2}$/)){
        var pp=dp2.split('-');dateStr=pp[0]+'-'+('0'+pp[1]).slice(-2)+'-'+('0'+pp[2]).slice(-2);
      }
    }
    if(!dateStr)continue;
    if(!wddLocal[wk])wddLocal[wk]={};
    wddLocal[wk][day]=dateStr;
    /* 교시 1~10 = 컬럼 3~12 */
    for(var p=1;p<=10;p++){
      var cellVal=row[2+p];
      if(cellVal===null||cellVal===undefined||cellVal==='')continue;
      var parsed=parseNativeCell(cellVal);
      if(!parsed||!parsed.subj)continue;
      var t=PERIOD_TIMES_MAP[p];
      var examFlag=parsed.subj.indexOf('시험')>=0||parsed.subj.indexOf('퀴즈')>=0;
      if(examFlag&&edLocal.indexOf(dateStr)<0)edLocal.push(dateStr);
      items.push({week:wk,date:dateStr,day:day,period:p,
        start:t[0],end:t[1],subject:parsed.subj,professor:parsed.prof,is_exam:examFlag});
    }
  }
  if(!items.length)return{error:'수업 데이터를 찾을 수 없습니다. 엑셀 형식을 확인해주세요.'};
  return{items:items,wddLocal:wddLocal,edLocal:edLocal};
}
