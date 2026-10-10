/* ── PDF 격자 시간표 파서 (학교 무관) ──
   열=요일(헤더에 '월(10/12)' 같은 날짜), 행=교시 인 주간표 PDF. 쪽마다 한 주.
   글자 좌표(getTextContent)와 표 테두리 선(getOperatorList)을 같이 읽어서,
   교시 사이 가로선이 없는 칸은 병합된 수업으로 본다(선이 하나도 없으면 교시마다 따로).
   결과는 smartFinish() 형식 — upload.js의 xlHandlePdf가 원광대 파서 다음으로 시도한다. */

/* 한 쪽에서 글자와 선분을 뽑는다 → {text:[{s,x,y,w,h}], segs:[[x1,y1,x2,y2]]} (PDF 좌표계, y는 위가 큼) */
function pdfGridExtract(page){
  return Promise.all([page.getTextContent(),page.getOperatorList()]).then(function(r){
    var O=pdfjsLib.OPS,ol=r[1],ctm=[1,0,0,1,0,0],st=[],segs=[],cur=[0,0];
    function mul(m,n){return[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];}
    function pt(x,y){return[ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]];}
    for(var i=0;i<ol.fnArray.length;i++){
      var f=ol.fnArray[i],a=ol.argsArray[i];
      if(f===O.save)st.push(ctm.slice());
      else if(f===O.restore)ctm=st.pop()||ctm;
      else if(f===O.transform)ctm=mul(ctm,a);
      else if(f===O.constructPath){
        var ops=a[0],c=a[1],k=0;
        for(var j=0;j<ops.length;j++){
          var op=ops[j];
          if(op===O.moveTo){cur=pt(c[k],c[k+1]);k+=2;}
          else if(op===O.lineTo){var q=pt(c[k],c[k+1]);k+=2;segs.push([cur[0],cur[1],q[0],q[1]]);cur=q;}
          else if(op===O.rectangle){
            var p1=pt(c[k],c[k+1]),p2=pt(c[k]+c[k+2],c[k+1]+c[k+3]);k+=4;
            /* 가는 사각형 = 굵은 선. 넓은 사각형(칸 배경)은 테두리가 아니라서 버림 */
            if(Math.abs(p1[1]-p2[1])<2.5)segs.push([p1[0],(p1[1]+p2[1])/2,p2[0],(p1[1]+p2[1])/2]);
            else if(Math.abs(p1[0]-p2[0])<2.5)segs.push([(p1[0]+p2[0])/2,p1[1],(p1[0]+p2[0])/2,p2[1]]);
          }
          else if(op===O.curveTo)k+=6;
          else if(op===O.curveTo2||op===O.curveTo3)k+=4;
        }
      }
    }
    var text=[];
    r[0].items.forEach(function(t){
      var s=(t.str||'').replace(/\s+/g,' ').trim();
      if(s)text.push({s:s,x:t.transform[4],y:t.transform[5],w:t.width||0,h:t.height||Math.abs(t.transform[3])||10});
    });
    /* 화면 좌표(쪽 회전 반영, y는 아래로 증가) — 표 복원(pdfTableRows)용 */
    var vis=null;
    try{
      var vp=page.getViewport({scale:1}),vt=vp.transform;
      var vtext=[];
      r[0].items.forEach(function(t){
        var s=(t.str||'').replace(/\s+/g,' ').trim();if(!s)return;
        var m=pdfjsLib.Util.transform(vt,t.transform);
        var h=t.height||Math.hypot(m[2],m[3])||10;
        /* 글자 진행 방향이 가로(→)인 것만: 세로쓰기·기울인 글자는 표 내용이 아님 */
        if(Math.abs(m[1])>Math.abs(m[0])*0.3)return;
        vtext.push({s:s,x:m[4],y:m[5]-h*0.35,w:t.width||0,h:h}); /* y = 글자 가운데쯤 */
      });
      var vsegs=segs.map(function(g){
        var p=vp.convertToViewportPoint(g[0],g[1]),q=vp.convertToViewportPoint(g[2],g[3]);
        return[p[0],p[1],q[0],q[1]];
      });
      vis={text:vtext,segs:vsegs,w:vp.width,h:vp.height};
    }catch(e){}
    return{text:text,segs:segs,vis:vis};
  });
}

/* 여러 쪽 → smartFinish 결과 (못 읽으면 {error}) */
function pdfGridParse(pages){
  var items=[],warn=[],skippedWeekend=0;
  var all=pages.map(function(p){return p.text.map(function(t){return t.s;}).join(' ');}).join(' ');
  var ym=all.match(/(20\d{2})\s*(?:학년도|년)/),year=ym?+ym[1]:new Date().getFullYear();
  var sem2=/2\s*학기/.test(all);

  pages.forEach(function(pg){pdfGridPage(pg);});

  function pdfGridPage(pg){
    var T=pg.text;
    /* 쪽 머리의 '강의실: 라파엘관 120' → 칸에 따로 적힌 곳이 없을 때 기본 강의실 */
    var pageRoom='';
    T.forEach(function(t){var rm=t.s.match(/강의실\s*[:：]\s*(.{2,20})$/);if(rm&&!pageRoom)pageRoom=rm[1].trim();});
    /* ① 요일 헤더: 같은 높이에 요일+날짜가 3개 이상 */
    var heads=[];
    T.forEach(function(t){
      var m=t.s.match(/^([월화수목금토일])(?:요일)?\s*[\(\[]?\s*(\d{1,2})\s*[\/.\-월]\s*(\d{1,2})\s*일?\s*[\)\]]?$/)
           ||t.s.match(/^(\d{1,2})\s*[\/.\-월]\s*(\d{1,2})\s*일?\s*[\(\[]\s*([월화수목금토일])\s*[\)\]]$/);
      if(!m)return;
      var day,mo,dd;
      if(/^\d/.test(m[1])){mo=+m[1];dd=+m[2];day=m[3];}else{day=m[1];mo=+m[2];dd=+m[3];}
      if(mo<1||mo>12||dd<1||dd>31)return;
      heads.push({day:day,mo:mo,dd:dd,cx:t.x+t.w/2,y:t.y,h:t.h});
    });
    if(heads.length<3)return;
    /* 가장 많이 모인 높이의 헤더만 */
    var byY={};heads.forEach(function(h){var k=Math.round(h.y/4);(byY[k]=byY[k]||[]).push(h);});
    var row=[];Object.keys(byY).forEach(function(k){if(byY[k].length>row.length)row=byY[k];});
    if(row.length<3)return;
    row.sort(function(a,b){return a.cx-b.cx;});
    var headY=row[0].y;

    /* ② 선분을 가로·세로로 나누고 같은 줄끼리 묶음 */
    var H={},V={};
    pg.segs.forEach(function(s){
      var dx=Math.abs(s[0]-s[2]),dy=Math.abs(s[1]-s[3]);
      if(dy<0.8&&dx>0.3){var ky=Math.round((s[1]+s[3])/2);(H[ky]=H[ky]||[]).push([Math.min(s[0],s[2]),Math.max(s[0],s[2])]);}
      else if(dx<0.8&&dy>0.3){var kx=Math.round((s[0]+s[2])/2);(V[kx]=V[kx]||[]).push([Math.min(s[1],s[3]),Math.max(s[1],s[3])]);}
    });
    /* 1pt 차이로 갈린 같은 선 합치기 */
    function fold(M){
      var ks=Object.keys(M).map(Number).sort(function(a,b){return a-b;}),out=[];
      ks.forEach(function(k){
        var last=out[out.length-1];
        if(last&&k-last.k<=2){last.iv=last.iv.concat(M[k]);}
        else out.push({k:k,iv:M[k].slice()});
      });
      return out;
    }
    /* [a,b] 구간이 선으로 덮인 비율 (점선은 3pt 이내 틈을 이어 붙임) */
    function cover(iv,a,b){
      var s=iv.filter(function(v){return v[1]>a&&v[0]<b;}).sort(function(p,q){return p[0]-q[0];});
      var tot=0,ce=a;
      s.forEach(function(v){
        var lo=Math.max(v[0],a),hi=Math.min(v[1],b);
        if(lo-ce<=3)lo=Math.min(lo,ce);
        if(hi>ce){tot+=hi-Math.max(lo,ce);ce=hi;}
      });
      return tot/Math.max(1,b-a);
    }
    var hl=fold(H),vl=fold(V);

    /* ③ 열 경계: 헤더 중심 사이의 세로선, 없으면 중간점 */
    var gapAvg=(row[row.length-1].cx-row[0].cx)/(row.length-1);
    function vBetween(a,b){
      var best=null;
      vl.forEach(function(v){
        if(v.k<=a||v.k>=b)return;
        var len=0;v.iv.forEach(function(q){len+=q[1]-q[0];});
        if(len<30)return;
        if(!best||len>best.len)best={k:v.k,len:len};
      });
      return best?best.k:(a+b)/2;
    }
    var cols=[];
    for(var i=0;i<row.length;i++){
      var L=i===0?vBetween(row[0].cx-gapAvg,row[0].cx):cols[i-1].r;
      var R=i===row.length-1?vBetween(row[i].cx,row[i].cx+gapAvg):vBetween(row[i].cx,row[i+1].cx);
      cols.push({l:L,r:R,h:row[i]});
    }
    var leftEdge=cols[0].l;

    /* ④ 행(교시) 띠: 왼쪽 시간 칸의 '교시'·시각 글자 + 그 칸을 가로지르는 가로선 */
    var labels=T.filter(function(t){return t.x+t.w/2<leftEdge&&t.y<headY-2;});
    var marks=[];
    labels.forEach(function(t){
      var pm=t.s.match(/^(\d{1,2})\s*교시/),tr=smartTimeRange(t.s);
      if(pm||tr)marks.push({y:t.y+t.h*0.35,p:pm?+pm[1]:0,tr:tr,lunch:false});
      else if(/점심|중식|lunch/i.test(t.s))marks.push({y:t.y+t.h*0.35,p:0,tr:null,lunch:true});
    });
    if(!marks.length)return;
    var labL=Math.min.apply(null,labels.map(function(t){return t.x;}));
    var tblR=cols[cols.length-1].r;
    var rowLines=hl.filter(function(h){return h.k<headY+row[0].h*2&&(cover(h.iv,labL,leftEdge)>0.5||cover(h.iv,leftEdge,tblR)>0.6);})
      .map(function(h){return h.k;}).sort(function(a,b){return b-a;});
    var bands=[];
    if(rowLines.length>=3){
      for(var bi=0;bi+1<rowLines.length;bi++)bands.push({top:rowLines[bi],bot:rowLines[bi+1]});
    }else{
      /* 선이 없는 PDF: 교시 글자 높이 사이의 중간으로 띠를 나눔 */
      var ys=[];marks.filter(function(m){return m.p;}).forEach(function(m){ys.push(m.y);});
      ys.sort(function(a,b){return b-a;});
      if(ys.length<2)return;
      var step=(ys[0]-ys[ys.length-1])/(ys.length-1);
      for(var yi=0;yi<ys.length;yi++){
        var tp=yi===0?ys[0]+step/2:(ys[yi-1]+ys[yi])/2,bt=yi===ys.length-1?ys[yi]-step/2:(ys[yi]+ys[yi+1])/2;
        bands.push({top:tp,bot:bt});
      }
    }
    var seq=0;
    bands.forEach(function(b){
      b.p=0;b.tr=null;b.lunch=false;
      marks.forEach(function(m){
        if(m.y>b.top||m.y<b.bot)return;
        if(m.p)b.p=m.p;if(m.tr)b.tr=m.tr;if(m.lunch)b.lunch=true;
      });
    });
    bands=bands.filter(function(b){return b.p||b.tr||b.lunch;});
    if(!bands.length)return;
    /* 점심 띠: '점심' 글자가 있거나, 교시 번호 없이 시각만 있고 요일 칸 전체가 한 덩어리 */
    bands.forEach(function(b){
      if(!b.p&&b.tr&&!b.lunch){
        var mid=(b.top+b.bot)/2;
        var hit=T.some(function(t){return /점심|중식/.test(t.s)&&t.y<b.top&&t.y>b.bot;});
        if(hit)b.lunch=true;
      }
    });
    /* 교시 번호가 없는 표(시각만): 위에서부터 번호 */
    var hasNum=bands.some(function(b){return b.p;});
    bands.forEach(function(b){if(b.lunch)return;seq++;if(!hasNum)b.p=seq;});
    var useBands=bands.filter(function(b){return !b.lunch&&b.p;});
    if(!useBands.length)return;

    /* ⑤ 열마다: 가로선 없는 이웃 교시를 한 수업으로 묶고 글자를 모음 */
    var anyRule=rowLines.length>=3;
    cols.forEach(function(col){
      var h=col.h;
      if(h.day==='토'||h.day==='일'){
        var has=T.some(function(t){var cx=t.x+t.w/2;return cx>col.l&&cx<col.r&&t.y<useBands[0].top&&t.y>useBands[useBands.length-1].bot;});
        if(has)skippedWeekend++;
        return;
      }
      var yr=year;if(sem2&&h.mo<=2)yr=year+1;
      var date=yr+'-'+('0'+h.mo).slice(-2)+'-'+('0'+h.dd).slice(-2);
      var day=smartDowOf(date)||h.day;
      /* 묶음 만들기 */
      var groups=[],g=null;
      for(var i=0;i<bands.length;i++){
        var b=bands[i];
        if(b.lunch||!b.p){g=null;continue;}
        var joined=false;
        if(g&&anyRule){
          var prev=bands[i-1];
          /* 두 띠 사이 가로선이 이 열에서 절반도 안 덮이면 병합 칸 */
          var line=null;hl.forEach(function(x){if(Math.abs(x.k-b.top)<=2)line=x;});
          var cv=line?cover(line.iv,col.l+2,col.r-2):0;
          if(prev===g.bands[g.bands.length-1]&&cv<0.5)joined=true;
        }
        if(joined)g.bands.push(b);
        else{g={bands:[b],lines:[]};groups.push(g);}
      }
      /* 글자 배정: 중심이 이 열·묶음 안에 있는 것 */
      var prevGr=null;
      groups.forEach(function(gr){
        var top=gr.bands[0].top,bot=gr.bands[gr.bands.length-1].bot,ts=[];
        T.forEach(function(t){
          var cx=t.x+t.w/2,cy=t.y+t.h*0.35;
          if(cx>col.l&&cx<col.r&&cy<top&&cy>bot)ts.push(t);
        });
        if(!ts.length)return;
        ts.sort(function(a,b){return (b.y-a.y)||(a.x-b.x);});
        var lines=[],ly=null,cw=col.r-col.l;
        ts.forEach(function(t){
          var last=lines[lines.length-1];
          if(ly!==null&&Math.abs(ly-t.y)<Math.max(3,t.h*0.45)){last.s+=' '+t.s;last.x2=Math.max(last.x2,t.x+t.w);last.x1=Math.min(last.x1,t.x);}
          else{lines.push({s:t.s,x1:t.x,x2:t.x+t.w,h:t.h});ly=t.y;}
        });
        /* 칸 폭을 꽉 채우고 넘어간 한글 줄은 낱말 중간에서 줄이 바뀐 것 — 다음 줄과 붙여 읽음 */
        lines.forEach(function(ln){ln.full=(cw-(ln.x2-ln.x1))<ln.h*1.6+6;});
        var cell=pdfGridCell(lines);
        if(!cell)return;
        if(cell.orphanProf){
          /* 위 칸에서 넘쳐 내려온 '소속 이름' 줄 → 위 수업의 교수 */
          if(prevGr&&prevGr.cell&&!prevGr.cell.professor)prevGr.out.forEach(function(it){it.professor=cell.orphanProf;});
          return;
        }
        if(/^(점심|중식)(\s*시간)?$/.test(cell.subject))return;
        if(!cell.room&&pageRoom&&cell.professor)cell.room=pageRoom;
        gr.cell=cell;gr.out=[];prevGr=gr;
        gr.bands.forEach(function(b){
          var tr=b.tr||smartTimes(b.p);
          var it={week:'',date:date,day:day,period:b.p,start:tr[0],end:tr[1],
            subject:cell.subject,professor:cell.professor,is_exam:cell.isExam};
          if(cell.room)it.room=cell.room;
          if(smartIsHoliday(cell.subject))it.is_exam=false;
          items.push(it);gr.out.push(it);
        });
      });
    });
  }

  if(!items.length)return{error:'PDF에서 요일·교시 표를 찾지 못했어요.'};
  if(skippedWeekend)warn.push('토·일 수업은 주간표에 넣지 않았어요');
  return smartFinish(items,'pdf-grid',warn);
}

/* 한 칸의 줄들 → {subject,professor,room,isExam}.
   '대면/ZOOM' 표시, '(E,F,G,H,I)' 같은 코드, '10:30 - 12:00' 시각 줄은 과목명에서 뺀다.
   교수: '응급의학과 김종선'(소속 + 이름) 또는 '(김종선)' 또는 이름만 있는 줄. */
function pdfGridCell(lines){
  var room='',prof='',title=[];
  var DEPT=/(과|학|교실|병원|센터|의학|대학|학교실|내과|외과)$/;
  var glue=false;
  lines.forEach(function(ln){
    var raw=typeof ln==='string'?ln:ln.s,full=typeof ln==='string'?false:!!ln.full;
    var s=raw.replace(/\s+/g,' ').trim();
    /* 줄 끝이나 줄 전체의 영문 대문자 코드 묶음 */
    s=s.replace(/\s*\(\s*[A-Z](\s*,\s*[A-Z])*\s*\)\s*$/,'').trim();
    if(!s)return;
    if(/^(대면|비대면|온라인|실시간|녹화|ZOOM|Zoom|zoom|줌)$/.test(s)){
      if(!/^대면$/.test(s))room=room||s.toUpperCase().replace('줌','ZOOM');
      return;
    }
    if(/^\d{1,2}[:시]\d{2}\s*[~\-–—]\s*\d{1,2}[:시]\d{2}$/.test(s))return;
    var m;
    /* '소속 이름' — 마지막 어절이 한글 2~4자 이름, 그 앞이 소속으로 끝남 */
    if(!prof&&(m=s.match(/^(.*\S)\s+([가-힣]{2,4})$/))&&DEPT.test(m[1])&&title.length){prof=m[2];return;}
    /* '(이름)' 또는 '이름 교수' */
    if(!prof&&(m=s.match(/^\(?\s*([가-힣]{2,4})\s*(?:교수님?)?\s*\)?$/))&&title.length&&/^\(|교수/.test(s)){prof=m[1];return;}
    if(glue&&title.length&&/^[가-힣]/.test(s))title[title.length-1]+=s;
    else title.push(s);
    glue=full&&/[가-힣]$/.test(s);
  });
  if(!title.length)return null;
  var op;
  if(title.length===1&&!prof&&(op=title[0].match(/^(.*\S)\s+([가-힣]{2,4})$/))&&DEPT.test(op[1])&&op[1].length<=12)return{orphanProf:op[2]};
  /* 제목 끝의 '(이름)' */
  var subj=title.join(' ').replace(/\s+/g,' ').trim(),pm;
  if(!prof&&(pm=subj.match(/^(.*\S)\s*\(\s*([가-힣]{2,4})\s*\)$/))){subj=pm[1];prof=pm[2];}
  if(subj.length<2)return null;
  var isExam=/시험|고사|퀴즈|땡시|exam|quiz/i.test(subj)||(/평가$/.test(subj)&&subj.length<=10&&!/자기평가/.test(subj));
  return{subject:subj,professor:prof,room:room,isExam:isExam};
}

/* ══════════ 표 복원: PDF 쪽 → 표마다 2차원 배열(병합 칸은 같은 값으로 채움) ══════════
   테두리 선으로 격자를 만들고, 사이에 선이 없는 이웃 칸을 한 칸으로 합친 뒤 글자를 넣는다.
   결과는 엑셀 시트 행과 같은 모양이라 smartParseRows(wide·long·grid)가 그대로 읽는다.
   — 행이 날짜인 표(경희대), 날짜와 요일이 따로 적힌 요일표(이화여대)처럼 pdfGridParse가 못 읽는 양식용. */
function pdfTableRows(vis){
  if(!vis||!vis.segs||!vis.segs.length)return[];
  /* ① 선분 → 가로줄(y별 구간들)·세로줄(x별 구간들), 점선은 이어 붙임 */
  function collect(horizontal){
    var M={};
    vis.segs.forEach(function(g){
      var dx=Math.abs(g[0]-g[2]),dy=Math.abs(g[1]-g[3]);
      if(horizontal?(dy<0.8&&dx>0.3):(dx<0.8&&dy>0.3)){
        var k=Math.round(horizontal?(g[1]+g[3])/2:(g[0]+g[2])/2);
        (M[k]=M[k]||[]).push(horizontal?[Math.min(g[0],g[2]),Math.max(g[0],g[2])]:[Math.min(g[1],g[3]),Math.max(g[1],g[3])]);
      }
    });
    var ks=Object.keys(M).map(Number).sort(function(a,b){return a-b;}),out=[];
    ks.forEach(function(k){
      var last=out[out.length-1];
      if(last&&k-last.k<=2)last.iv=last.iv.concat(M[k]);else out.push({k:k,iv:M[k].slice()});
    });
    out.forEach(function(L){
      L.iv.sort(function(a,b){return a[0]-b[0];});
      var m=[];
      L.iv.forEach(function(v){var q=m[m.length-1];if(q&&v[0]-q[1]<=3.5)q[1]=Math.max(q[1],v[1]);else m.push([v[0],v[1]]);});
      L.iv=m.filter(function(v){return v[1]-v[0]>6;});
    });
    return out.filter(function(L){return L.iv.length;});
  }
  var HL=collect(true),VL=collect(false);
  if(HL.length<3||VL.length<3)return[];
  function cov(L,a,b){
    var t=0;L.iv.forEach(function(v){var lo=Math.max(v[0],a),hi=Math.min(v[1],b);if(hi>lo)t+=hi-lo;});
    return t/Math.max(1,b-a);
  }
  /* ② 표 나누기: 선들이 서로 닿는 덩어리마다 하나 (한 쪽에 표가 둘 이상인 경우) */
  var nodes=[];
  HL.forEach(function(L){L.iv.forEach(function(v){nodes.push({h:1,k:L.k,a:v[0],b:v[1],L:L});});});
  VL.forEach(function(L){L.iv.forEach(function(v){nodes.push({h:0,k:L.k,a:v[0],b:v[1],L:L});});});
  var par=nodes.map(function(_,i){return i;});
  function find(i){while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;}
  var hs=nodes.map(function(n,i){return n.h?i:-1;}).filter(function(i){return i>=0;});
  var vs=nodes.map(function(n,i){return n.h?-1:i;}).filter(function(i){return i>=0;});
  hs.forEach(function(i){
    var H=nodes[i];
    vs.forEach(function(j){
      var V=nodes[j];
      if(V.k>=H.a-3&&V.k<=H.b+3&&H.k>=V.a-3&&H.k<=V.b+3){var a=find(i),b=find(j);if(a!==b)par[a]=b;}
    });
  });
  var comps={};
  nodes.forEach(function(n,i){var r=find(i);(comps[r]=comps[r]||[]).push(n);});
  var tables=[];
  Object.keys(comps).forEach(function(r){
    var ns=comps[r],xs={},ys={};
    ns.forEach(function(n){if(n.h)ys[n.k]=n.L;else xs[n.k]=n.L;});
    var X=Object.keys(xs).map(Number).sort(function(a,b){return a-b;}),Y=Object.keys(ys).map(Number).sort(function(a,b){return a-b;});
    if(X.length<3||Y.length<3)return;
    /* ③ 칸 사이 선 유무 → 병합 */
    var nc=X.length-1,nr=Y.length-1,id=[],n=0;
    for(var rr=0;rr<nr;rr++){id.push([]);for(var cc=0;cc<nc;cc++)id[rr].push(n++);}
    /* 사각형으로만 합친다: 왼쪽 위 칸에서 오른쪽으로(세로선 없는 동안), 아래로(그 폭 전체에 가로선이 없는 동안) 넓힘.
       선 하나가 빠진 곳으로 병합이 옆 칸까지 번지는 것을 막는다(공휴일처럼 큰 칸이 있는 주). */
    function noRight(r,c){return c+1<nc&&cov(xs[X[c+1]],Y[r]+1.5,Y[r+1]-1.5)<0.5;}
    function noBottom(r,c){return r+1<nr&&cov(ys[Y[r+1]],X[c]+1.5,X[c+1]-1.5)<0.5;}
    var own=[];for(var q=0;q<n;q++)own.push(-1);
    for(var r2=0;r2<nr;r2++)for(var c2=0;c2<nc;c2++){
      if(own[id[r2][c2]]>=0)continue;
      var c1=c2;while(noRight(r2,c1)&&own[id[r2][c1+1]]<0)c1++;
      var r1=r2,grow=true;
      while(grow&&r1+1<nr){
        for(var cc2=c2;cc2<=c1&&grow;cc2++){
          if(!noBottom(r1,cc2)||own[id[r1+1][cc2]]>=0)grow=false;
          /* 아래 행 안쪽에 세로선이 있으면 다른 칸 */
          if(grow&&cc2<c1&&!noRight(r1+1,cc2))grow=false;
        }
        if(grow)r1++;
      }
      for(var ra=r2;ra<=r1;ra++)for(var ca=c2;ca<=c1;ca++)own[id[ra][ca]]=id[r2][c2];
    }
    function f2(i){return own[i];}
    /* ④ 글자 넣기 (중심점이 속한 칸 → 병합 묶음) */
    var buckets={};
    vis.text.forEach(function(t){
      var cx=t.x+t.w/2,cy=t.y;
      if(cx<X[0]||cx>X[nc]||cy<Y[0]||cy>Y[nr])return;
      var ci=0,ri=0;
      while(ci<nc-1&&cx>X[ci+1])ci++;
      while(ri<nr-1&&cy>Y[ri+1])ri++;
      var g=f2(id[ri][ci]);(buckets[g]=buckets[g]||[]).push(t);
    });
    var textOf={};
    Object.keys(buckets).forEach(function(g){
      var ts=buckets[g].sort(function(a,b){return (a.y-b.y)||(a.x-b.x);}),lines=[],ly=null;
      ts.forEach(function(t){
        if(ly!==null&&Math.abs(t.y-ly)<Math.max(2.5,t.h*0.45)){
          /* 같은 줄: x 순서로 이어 붙임 */
          lines[lines.length-1].push(t);
        }else{lines.push([t]);ly=t.y;}
      });
      textOf[g]=lines.map(function(L){
        var ln=L.sort(function(a,b){return a.x-b.x;}).map(function(t){return t.s;}).join(' ');
        /* '기 말 고 사'처럼 한 글자씩 띄운 제목은 붙임, ' ,'는 ','로 */
        ln=ln.replace(/(^|\s)((?:[가-힣] ){2,}[가-힣])(?=\s|$)/g,function(_,p,w){return p+w.replace(/ /g,'');});
        if(/^[가-힣]( [가-힣])+$/.test(ln))ln=ln.replace(/ /g,'');
        return ln.replace(/\s+,/g,',').replace(/\s{2,}/g,' ').trim();
      }).filter(Boolean).join('\n');
    });
    var rows=[],filled=0;
    for(var r3=0;r3<nr;r3++){
      var row=[];
      for(var c3=0;c3<nc;c3++){var v=textOf[f2(id[r3][c3])]||'';if(v)filled++;row.push(v);}
      rows.push(row);
    }
    if(filled>=6)tables.push({rows:rows,x:X[0],y:Y[0]});
  });
  /* 읽는 순서: 위→아래, 왼→오른쪽 */
  tables.sort(function(a,b){return (Math.abs(a.y-b.y)>20?a.y-b.y:a.x-b.x);});
  return tables.map(function(t){return t.rows;});
}

/* 여러 쪽 → 표마다 smartParseRows → 합쳐서 smartFinish. 못 읽으면 {error} */
function pdfTableParse(pages){
  var items=[],warn=[],fmt='';
  var all=pages.map(function(p){return (p&&p.text||[]).map(function(t){return t.s;}).join(' ');}).join(' ');
  var ym=all.match(/(20\d{2})\s*(?:학년도|년|[-.]\s*[12]\s*학기)/);
  var head=ym?[[ym[1]+'학년도']]:[];
  pages.forEach(function(pg){
    if(!pg||!pg.vis)return;
    pdfTableRows(pg.vis).forEach(function(rows){
      var res=null;
      try{res=smartParseRows(head.concat(rows),{fromPdf:true});}catch(e){res=null;}
      if(!res||res.error||!res.items||!res.items.length)return;
      fmt=fmt||res.format;
      res.items.forEach(function(it){it.week='';items.push(it);});
    });
  });
  if(!items.length)return{error:'PDF에서 표를 읽지 못했어요.'};
  /* 교시 번호 다시 매기기: 시작 시각이 이른 순서대로 1,2,3… — 표마다·주마다 번호가 달라지지 않게.
     (시각만 적힌 표는 번호가 2부터 시작하거나 주마다 어긋날 수 있음) */
  function tm(v){var m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?(+m[1])*60+(+m[2]):-1;}
  var cnt={};items.forEach(function(it){var t=tm(it.start);if(t>=0)cnt[t]=(cnt[t]||0)+1;});
  var starts=Object.keys(cnt).map(Number).sort(function(a,b){return a-b;});
  /* 드물게 나오는 시작 시각(전체의 2% 미만)은 가장 가까운 앞 교시에 붙임 */
  var main=starts.filter(function(t){return cnt[t]>=Math.max(2,items.length*0.02);});
  if(main.length>=3&&main.length<=14){
    items.forEach(function(it){
      var t=tm(it.start);if(t<0)return;
      var idx=0;for(var i=0;i<main.length;i++)if(main[i]<=t)idx=i;
      it.period=idx+1;
    });
  }
  /* 같은 날 같은 교시에 두 수업이 겹치면(시작 시각이 30분 어긋난 날 등) 늦게 시작하는 쪽을 비어 있는 다음 교시로 민다 */
  var maxP=0,byDate={};
  items.forEach(function(it){if(it.period>maxP)maxP=it.period;(byDate[it.date]=byDate[it.date]||[]).push(it);});
  Object.keys(byDate).forEach(function(d){
    var used={};
    byDate[d].sort(function(a,b){return (tm(a.start)-tm(b.start))||(a.period-b.period);}).forEach(function(it){
      var p=it.period;
      while(used[p]&&used[p]!==(it.subject+'|'+(it.topic||''))&&p<maxP+2)p++;
      it.period=p;used[p]=it.subject+'|'+(it.topic||'');
    });
  });
  return smartFinish(items,'pdf-table',warn);
}
