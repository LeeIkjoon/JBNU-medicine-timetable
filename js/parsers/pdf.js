/* pdf.js 동적 로드 */
function loadPdfJs(cb){
  if(typeof pdfjsLib!=='undefined'){cb();return;}
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload=function(){
    pdfjsLib.GlobalWorkerOptions.workerSrc=
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    cb();
  };
  document.head.appendChild(s);
}

/* ── 원광대 PDF 파서 ── */
function parseWkuPdf(pageContents){
  var PERIOD_TIMES={
    1:['8:30','9:20'],2:['9:30','10:20'],3:['10:30','11:20'],4:['11:30','12:20'],
    5:['13:30','14:20'],6:['14:30','15:20'],7:['15:30','16:20'],8:['16:30','17:20']
  };
  var HOLIDAY_KW=['삼일절','현충일','광복절','어린이날','근로자의날','부처님','대체휴일',
    '대각개교','개교기념','육일대재','지방선거','재시험','예과체육','국군의날','한글날'];
  var EXAM_KW=['시험','고사','평가'];

  function isHol(s){return HOLIDAY_KW.some(function(k){return s.indexOf(k)>=0;});}
  function isExamStr(s){if(s.indexOf('교육과정')>=0&&s.indexOf('평가')>=0)return false;return EXAM_KW.some(function(k){return s.indexOf(k)>=0;});}

  function parseCell(text){
    if(!text||!text.trim())return null;
    var s=text.trim();
    var lines=s.split('\n').map(function(l){return l.trim();}).filter(Boolean);
    /* 세로 텍스트: 1~4글자짜리 줄이 여러 개 */
    if(lines.length>=2&&lines.every(function(l){return l.length<=2;})){
      var joined=lines.join('');
      if(isHol(joined))return{subj:joined,prof:'',isExam:false};
      if(joined.length>=3&&joined.length<=8)s=joined;
    }
    /* 교수명 추출: 마지막 유효 괄호 (분반·숫자 괄호 제외) */
    var prof='';
    var groups=s.match(/\([^)]{1,30}\)/g)||[];
    for(var gi=groups.length-1;gi>=0;gi--){
      var cand=groups[gi].slice(1,-1).replace(/\s+/g,' ').trim();
      if(cand.indexOf('분반')<0&&/^[가-힣A-Za-z·,/ ]{2,20}$/.test(cand)){prof=cand;break;}
    }
    var fp=s.indexOf('(');
    if(fp>0)s=s.slice(0,fp).trim();
    var subjLines=s.split('\n').map(function(l){return l.trim();}).filter(Boolean);
    var subj=subjLines.length?subjLines[0].replace(/[,，]$/,'').trim():'';
    if(subj==='중간'||subj==='기말')subj=subj+'고사';
    if(subj.length<2)return null;
    if(/^-\s*\d+\s*-$/.test(subj))return null;      /* 페이지 번호 */
    if(subj.charAt(0)==='(')return null;              /* 이전 셀 잔재 */
    return{subj:subj,prof:prof,isExam:isExamStr(subj)||isExamStr(text)};
  }

  var items=[],wdd={},ed=[],wks=[];

  pageContents.forEach(function(pc){
    var allText=pc.items.map(function(i){return i.str;}).join(' ');
    var wkMatch=allText.match(/수\s*업\s*주\s*[:：]\s*(\d+)\s*주/);
    if(!wkMatch)return;
    var wk=wkMatch[1];
    /* 전 학년 통합 PDF: 현재 선택 학년 페이지만 파싱 */
    var gm=allText.match(/대상학년\s*[:：]\s*(의예과|의학과)\s*(\d)\s*학년/);
    if(gm&&typeof savedGrade!=='undefined'&&savedGrade){
      if((gm[1]+' '+gm[2]+'학년')!==savedGrade)return;
    }

    var pageH=pc.page.view[3];
    var pageW=pc.page.view[2];

    /* ① 헤더에서 요일컬럼 X 중심좌표 감지 */
    var dayDates=[];
    pc.items.forEach(function(item){
      var m=item.str.match(/^([월화수목금])\((\d+)\.(\d+)\)$/);
      if(m){
        dayDates.push({
          day:m[1],
          date:'2026-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2),
          xMid:item.transform[4]
        });
      }
    });
    if(!dayDates.length){
      /* 조각난 헤더: "월" + 근처의 "8.17)" 조합 */
      var dayCands=[],dateCands=[];
      pc.items.forEach(function(item){
        var t=item.str.trim();
        if(/^[월화수목금]$/.test(t))dayCands.push({d:t,x:item.transform[4],y:item.transform[5]});
        var dm=t.match(/^\(?(\d{1,2})\.(\d{1,2})\)?$/);
        if(dm)dateCands.push({mm:dm[1],dd:dm[2],x:item.transform[4],y:item.transform[5]});
      });
      dayCands.forEach(function(dc){
        var best=null;
        dateCands.forEach(function(t){
          if(Math.abs(t.y-dc.y)<7&&t.x>dc.x-5&&(t.x-dc.x)<70){if(!best||t.x<best.x)best=t;}
        });
        if(best)dayDates.push({
          day:dc.d,
          date:'2026-'+('0'+best.mm).slice(-2)+'-'+('0'+best.dd).slice(-2),
          xMid:dc.x
        });
      });
    }
    if(!dayDates.length)return;
    dayDates.sort(function(a,b){return a.xMid-b.xMid;});

    /* 컬럼 경계 */
    var colW=(dayDates[dayDates.length-1].xMid-dayDates[0].xMid)/(dayDates.length-1||1);
    var colBounds=dayDates.map(function(dd2,i){
      return{
        day:dd2.day,date:dd2.date,
        xMin:dd2.xMid-(colW*0.45),
        xMax:dd2.xMid+(colW*0.55)
      };
    });

    if(!wdd[wk])wdd[wk]={};
    colBounds.forEach(function(cb){wdd[wk][cb.day]=cb.date;});

    var periodColMax=dayDates[0].xMid-(colW*0.6);/* 교시열 오른쪽 경계 */
    var annotMinX=pageW*0.78;/* 우측 주석 시작 */

    /* ② Y좌표로 행 그룹핑 (tolerance 5pt) */
    var rowMap={};
    pc.items.forEach(function(item){
      var y=Math.round((pageH-item.transform[5])/5)*5;
      if(!rowMap[y])rowMap[y]=[];
      rowMap[y].push(item);
    });
    var rowYs=Object.keys(rowMap).map(Number).sort(function(a,b){return a-b;});

    /* ③ 교시별 셀 텍스트 누적 */
    var currentPeriod=null;
    var cellTexts={};

    rowYs.forEach(function(y){
      var rowItems=rowMap[y];
      /* 교시 번호 감지 */
      rowItems.forEach(function(item){
        if(item.transform[4]<periodColMax&&/^[1-8]$/.test(item.str.trim())){
          currentPeriod=parseInt(item.str.trim());
        }
      });
      if(!currentPeriod)return;

      rowItems.forEach(function(item){
        var x=item.transform[4];
        var s=item.str;
        if(!s.trim()||x>=annotMinX||x<=periodColMax)return;
        if(/^-\s*\d+\s*-$/.test(s.trim()))return;
        for(var ci=0;ci<colBounds.length;ci++){
          if(x>=colBounds[ci].xMin&&x<colBounds[ci].xMax){
            var key=currentPeriod+'_'+colBounds[ci].day;
            if(!cellTexts[key])cellTexts[key]='';
            cellTexts[key]+=s+'\n';
            break;
          }
        }
      });
    });

    /* ④ cellTexts → items */
    Object.keys(cellTexts).forEach(function(key){
      var parts=key.split('_'),period=parseInt(parts[0]),day=parts[1];
      var parsed=parseCell(cellTexts[key]);
      if(!parsed)return;
      var cb=colBounds.filter(function(c){return c.day===day;})[0];
      if(!cb)return;
      var t=PERIOD_TIMES[period];if(!t)return;
      if(parsed.isExam&&ed.indexOf(cb.date)<0)ed.push(cb.date);
      items.push({
        week:wk,date:cb.date,day:day,period:period,
        start:t[0],end:t[1],subject:parsed.subj,professor:parsed.prof,
        is_exam:parsed.isExam
      });
    });

    if(wks.indexOf(wk)<0)wks.push(wk);
  });

  wks.sort(function(a,b){return parseInt(a)-parseInt(b);});
  if(!items.length)return null;
  return{items:items,wdd:wdd,wks:wks,ed:ed.sort()};
}
