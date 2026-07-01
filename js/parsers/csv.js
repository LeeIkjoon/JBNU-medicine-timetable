function parseCSV(text){
  var rows=[];
  var lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  for(var i=0;i<lines.length;i++){
    if(!lines[i].trim())continue;
    var cols=[],cur='',inQ=false;
    for(var j=0;j<lines[i].length;j++){
      var ch=lines[i][j];
      if(ch==='"'){
        if(inQ&&lines[i][j+1]==='"'){cur+='"';j++;}
        else inQ=!inQ;
      }else if(ch===','&&!inQ){cols.push(cur);cur='';}
      else cur+=ch;
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function csvRowsToItems(rows){
  /* ── 계명대 형식 감지: 헤더 = 주차/일자/교시/시작시간/교과목명/교수명 ── */
  function isKeimyungFormat(rows){
    if(!rows||rows.length<2)return false;
    var h=rows[0]||[];
    var h0=String(h[0]||'').trim();
    var h1=String(h[1]||'').trim();
    var h2=String(h[2]||'').trim();
    var h4=String(h[4]||'').trim();
    return h0==='주차'&&(h1==='일자'||h1==='날짜')&&h2==='교시'&&(h4==='교과목명'||h4==='과목명');
  }

  /* ── 계명대 파서: 행 하나 = 교시 하나 ── */
  function parseKeimyungRows(rows){
    var PERIOD_END={1:'9:20',2:'10:20',3:'11:20',4:'12:20',
      5:'14:20',6:'15:20',7:'16:20',8:'17:20',9:'18:20',10:'19:20'};
    var DEFAULT_STARTS={1:'8:30',2:'9:30',3:'10:30',4:'11:30',5:'13:30',6:'14:30',7:'15:30',8:'16:30'};
    var EXAM_KW=['시험','고사','퀴즈','평가','examination','exam','quiz','TBL','PBL'];
    var HOLIDAY_KW=['공휴일','휴일','휴업','삼일절','현충일','광복절','개천절','한글날',
      '어린이날','근로자','부처님','대체휴일','선거','창립기념','개교기념','체육대회'];
    var items=[],wddLocal={},edLocal=[];

    /* 공휴일: 날짜당 1번만 추가하기 위한 집합 */
    var holidayAdded={};/* "date" → true */
    /* 시험: 날짜+교시 단위로 중복 방지 */
    var addedKeys={};/* "date_period" → true */

    for(var r=1;r<rows.length;r++){
      var row=rows[r];
      if(!row||!row[0])continue;
      var wk=String(row[0]).trim();
      if(!wk||isNaN(parseInt(wk)))continue;
      wk=String(parseInt(wk));

      /* 날짜 파싱 */
      var dateRaw=row[1];
      var dateStr='';
      if(typeof dateRaw==='number'){
        var d=new Date(Math.round((dateRaw-25569)*86400*1000));
        dateStr=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
      }else if(dateRaw&&String(dateRaw).match(/\d{4}/)){
        var ds=String(dateRaw).replace(/[\/\.]/g,'-').trim().slice(0,10);
        var pp=ds.split('-');
        if(pp.length===3)dateStr=pp[0]+'-'+('0'+pp[1]).slice(-2)+'-'+('0'+pp[2]).slice(-2);
      }
      if(!dateStr)continue;

      /* 요일 계산 */
      var ddObj=new Date(dateStr);
      var dow=ddObj.getDay();
      if(dow===0||dow===6)continue;
      var day=['일','월','화','수','목','금','토'][dow];

      var period=parseInt(row[2])||0;
      if(period<1||period>10)continue;

      /* 시작 시간 */
      var timeRaw=row[3],start='';
      if(typeof timeRaw==='number'&&timeRaw<1){
        var totalMin=Math.round(timeRaw*24*60);
        var hh=Math.floor(totalMin/60),mm=totalMin%60;
        start=hh+':'+('0'+mm).slice(-2);
      }else if(timeRaw){
        var tm=String(timeRaw).match(/(\d{1,2}):(\d{2})/);
        if(tm)start=tm[1]+':'+tm[2];
      }
      if(!start)start=DEFAULT_STARTS[period]||'8:30';
      var end=PERIOD_END[period]||'';

      var subj=String(row[4]||'').trim();
      var prof=String(row[5]||'').trim();
      var topic=String(row[6]||'').trim();/* 수업주제 컬럼 */
      if(!subj)continue;

      /* wdd 저장 */
      if(!wddLocal[wk])wddLocal[wk]={};
      wddLocal[wk][day]=dateStr;

      /* ── 공휴일: 같은 날 1번만 ── */
      var isHol=HOLIDAY_KW.some(function(k){return subj.indexOf(k)>=0;});
      if(isHol){
        if(holidayAdded[dateStr])continue;/* 이미 추가했으면 skip */
        holidayAdded[dateStr]=true;
        /* 공휴일은 1교시 자리에만 표시 */
        items.push({week:wk,date:dateStr,day:day,period:1,
          start:'8:30',end:'17:00',subject:subj,professor:'',is_exam:false,is_holiday:true});
        continue;
      }

      /* 중복 교시 방지 */
      var key=dateStr+'_'+period;
      if(addedKeys[key])continue;
      addedKeys[key]=true;

      /* ── 시험: 교과목명 또는 수업주제에 시험 키워드 ── */
      var examFlag=EXAM_KW.some(function(k){return subj.indexOf(k)>=0||topic.indexOf(k)>=0;});

      /* 시험이면 과목명에 [시험] 표시 */
      var displaySubj=subj;
      if(examFlag&&topic&&topic!==subj){
        /* 수업주제가 별도 시험명인 경우 과목명 뒤에 붙임 */
        var shortTopic=topic.length<=8?topic:'시험';
        displaySubj=subj+' ('+shortTopic+')';
      }

      if(examFlag&&edLocal.indexOf(dateStr)<0)edLocal.push(dateStr);

      items.push({week:wk,date:dateStr,day:day,period:period,
        start:start,end:end,subject:displaySubj,professor:prof,is_exam:examFlag});
    }
    if(!items.length)return{error:'수업 데이터를 찾을 수 없습니다.'};
    return{items:items,wddLocal:wddLocal,edLocal:edLocal};
  }

  /* ── native 형식 감지: 전북대 형식 (주차/날짜/요일/1~10교시) ── */
  function isNativeTimetable(rows){
    if(!rows||rows.length<2)return false;
    var r0=rows[0]||[], r1=rows[1]||[];
    var h0=String(r0[0]||'').trim();
    var h1=String(r0[1]||'').trim();
    var h2=String(r0[2]||'').trim();
    var DAYS=['월','화','수','목','금','토','일'];
    if(h0==='주차'&&(h1==='날짜'||h1.indexOf('날짜')>=0))return true;
    if(typeof r0[0]==='number'&&r0[0]>=1&&r0[0]<=50&&DAYS.indexOf(String(r0[2]||'').trim())>=0)return true;
    if(typeof r1[0]==='number'&&r1[0]>=1&&r1[0]<=50&&DAYS.indexOf(String(r1[2]||'').trim())>=0)return true;
    return false;
  }

  /* 계명대 형식 우선 감지 */
  if(isKeimyungFormat(rows)){
    var res=parseKeimyungRows(rows);
    if(res.error)return res;
    return res;/* {items, wddLocal, edLocal} — XLSX 핸들러에서 처리 */
  }

  /* 전북대 native 형식 */
  if(isNativeTimetable(rows)){
    var res2=parseNativeRows(rows);
    if(res2.error)return res2;
    return res2.items;
  }

  /* 기존 CSV 형식 (week,date,day,...) */
  if(rows.length<2)return null;
  var hdr=rows[0].map(function(h){return String(h).trim().toLowerCase();});
  var need=['week','date','day','period','start','end','subject','professor','is_exam'];
  for(var i=0;i<need.length;i++){
    if(hdr.indexOf(need[i])<0)return{error:'필수 열 "'+need[i]+'"이 없습니다.'};
  }
  var items2=[];
  for(var r=1;r<rows.length;r++){
    var row2=rows[r];
    if(row2.every(function(c){return!String(c||'').trim();}))continue;
    var obj={};
    for(var c=0;c<hdr.length;c++){obj[hdr[c]]=String(row2[c]||'').trim();}
    var examVal=(obj['is_exam']||'').toLowerCase();
    items2.push({week:obj['week'],date:obj['date'],day:obj['day'],
      period:parseInt(obj['period'])||1,start:obj['start'],end:obj['end'],
      subject:obj['subject'],professor:obj['professor'],
      is_exam:(examVal==='true'||examVal==='1'||examVal==='yes')});
  }
  return items2;
}
