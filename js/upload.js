/* ══════════════════════════════════════════
   시간표 파일 업로드
   - 어떤 형식이든 smartParseRows()로 인식 (wide/long/grid/legacy)
   - 엑셀은 모든 시트를 파싱해 후보로 제시, 내 학년 시트를 자동 선택
   - CSV는 UTF-8 → EUC-KR 순으로 디코딩 (한글 엑셀 CSV 대응)
   - 적용 로직(xlApply)은 관리자/일반 공용
══════════════════════════════════════════ */
var _xlCands=[];      /* [{name, result:{items,wddLocal,edLocal,format,warnings}}] */
var _xlSel=-1;        /* 선택된 후보 index */

function openXL(){
  var ovl=document.getElementById('xl-ovl');
  if(!ovl)return;
  xlReset();
  ovl.classList.add('show');
}
function closeXL(){
  var ovl=document.getElementById('xl-ovl');
  if(ovl){ovl.classList.remove('show');ovl.style.zIndex='';}
  xlReset();
}
function xlReset(){
  pendingData=null;_xlCands=[];_xlSel=-1;
  var st=document.getElementById('xl-status');if(st){st.textContent='';st.className='xl-status';}
  var sh=document.getElementById('xl-sheets');if(sh){sh.innerHTML='';sh.style.display='none';}
  var wn=document.getElementById('xl-warn');if(wn){wn.innerHTML='';wn.style.display='none';}
  var ap=document.getElementById('xl-apply');if(ap)ap.disabled=true;
  var fi=document.getElementById('xl-file');if(fi)fi.value='';
}
function xlStatus(msg,cls){
  var st=document.getElementById('xl-status');
  if(!st)return;
  st.className='xl-status'+(cls?' '+cls:'');
  st.textContent=msg;
}

/* ── 시트 이름 ↔ 내 학년 매칭 점수 ── */
function xlGradeScore(name){
  var g=(typeof savedGrade==='string')?savedGrade:'';
  if(!g||!name)return 0;
  var n=name.replace(/\s+/g,'');
  var gm=g.match(/(\d)\s*학년/);
  var gnum=gm?gm[1]:'';
  var isPre=/의예|예과/.test(g),isMed=/의학과|본과/.test(g);
  /* 시트명에서 학년 숫자: '2학년', '의예2', '본2', 'M2', 'premed2' */
  var nm=n.match(/(\d)학년/)||n.match(/(?:의예과?|예과|본과?|의학과?|premed|med|pre|m)(\d)/i);
  var nnum=nm?nm[1]:'';
  var nPre=/의예|예과|premed|pre(?!s)/i.test(n),nMed=/의학과?|본과?|(?:^|[^a-z])med(?!ical)/i.test(n);
  var s=0;
  if(gnum&&nnum){s+=nnum===gnum?3:-3;}
  else if(gnum&&new RegExp('(^|[^0-9])'+gnum+'([^0-9]|$)').test(n))s+=1;
  if(isPre&&nPre)s+=2;
  if(isMed&&nMed&&!nPre)s+=2;
  if(isPre&&nMed&&!nPre)s-=3;
  if(isMed&&nPre)s-=3;
  return s;
}

/* ── 후보 목록 → UI ── */
function xlSetCands(cands){
  _xlCands=cands;
  if(!cands.length){xlStatus('수업 데이터를 찾을 수 없습니다.','err');return;}
  /* 기본 선택: 학년 매칭 점수 → 항목 수 */
  var best=0,bestScore=-1e9;
  for(var i=0;i<cands.length;i++){
    var sc=xlGradeScore(cands[i].name)*10000+cands[i].result.items.length;
    if(sc>bestScore){bestScore=sc;best=i;}
  }
  xlSelect(best);
}
function xlSelect(i){
  _xlSel=i;
  var c=_xlCands[i];if(!c)return;
  var r=c.result;
  pendingData={items:r.items,nativeWdd:r.wddLocal,nativeEd:r.edLocal};

  /* 요약: N개 수업 · M주 (시작~끝) · 시험 K회 */
  var weeks=Object.keys(r.wddLocal||{});
  var dates=r.items.map(function(it){return it.date;}).sort();
  var span=dates.length?xlMd(dates[0])+' ~ '+xlMd(dates[dates.length-1]):'';
  var msg='수업 '+r.items.length+'개 · '+weeks.length+'주'+(span?' ('+span+')':'')+(r.edLocal&&r.edLocal.length?' · 시험 '+r.edLocal.length+'일':'');
  xlStatus(msg,'ok');

  /* 시트 칩 (후보가 2개 이상일 때) */
  var sh=document.getElementById('xl-sheets');
  if(sh){
    if(_xlCands.length>1){
      var h='<div class="xl-sheets-lbl">시트 선택</div><div class="xl-chips">';
      for(var k=0;k<_xlCands.length;k++){
        h+='<button class="xl-chip'+(k===i?' on':'')+'" data-i="'+k+'">'+escHtml(_xlCands[k].name)
          +'<span class="xl-chip-n">'+_xlCands[k].result.items.length+'</span></button>';
      }
      h+='</div>';
      sh.innerHTML=h;sh.style.display='block';
      sh.querySelectorAll('.xl-chip').forEach(function(b){
        b.onclick=function(){xlSelect(parseInt(this.getAttribute('data-i'),10));};
      });
    }else{sh.innerHTML='';sh.style.display='none';}
  }
  /* 경고 */
  var wn=document.getElementById('xl-warn');
  if(wn){
    var ws=(r.warnings||[]).slice();
    if(ws.length){wn.innerHTML=ws.map(function(w){return '<div>'+escHtml(w)+'</div>';}).join('');wn.style.display='block';}
    else{wn.innerHTML='';wn.style.display='none';}
  }
  var ap=document.getElementById('xl-apply');if(ap)ap.disabled=false;
}
function xlMd(ds){var p=ds.split('-');return parseInt(p[1],10)+'/'+parseInt(p[2],10);}

/* ── 텍스트 디코딩: UTF-8(BOM 포함) 실패 시 EUC-KR ── */
function xlDecodeText(buf){
  var u8=new Uint8Array(buf);
  if(u8.length>=3&&u8[0]===0xEF&&u8[1]===0xBB&&u8[2]===0xBF)u8=u8.subarray(3);
  if(typeof TextDecoder==='undefined')return String.fromCharCode.apply(null,u8);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(u8);}
  catch(e){
    try{return new TextDecoder('euc-kr').decode(u8);}
    catch(e2){return new TextDecoder('utf-8').decode(u8);}
  }
}
/* 구분자 감지: 탭이 쉼표보다 많으면 TSV */
function xlParseDelimited(text){
  var head=text.split('\n').slice(0,5).join('\n');
  var tabs=(head.match(/\t/g)||[]).length,commas=(head.match(/,/g)||[]).length;
  if(tabs>commas){
    return text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')
      .filter(function(l){return l.trim();})
      .map(function(l){return l.split('\t');});
  }
  return parseCSV(text);
}

/* ── 엑셀: 모든 시트 → 후보. 'N주차' 시트가 여러 개면 하나로 합침 ── */
function xlWorkbookCands(wb){
  var cands=[],weekSheets=[];
  for(var si=0;si<wb.SheetNames.length;si++){
    var sname=wb.SheetNames[si];
    var rows=smartSheetRows(wb.Sheets[sname]);
    if(!rows.length)continue;
    /* 학년 병렬 시트('전체'): 학년 열마다 후보 */
    var multi=(typeof smartParseMultiGrade==='function')?smartParseMultiGrade(rows):null;
    if(multi){
      multi.forEach(function(mc){cands.push({name:(wb.SheetNames.length>1?sname+' · ':'')+mc.name,result:mc.result});});
      continue;
    }
    var res=smartParseRows(rows);
    if(res&&!res.error&&res.items.length){
      cands.push({name:sname,result:res});
      var wm=sname.replace(/\s+/g,'').match(/^(\d{1,2})주차?$/);
      if(wm)weekSheets.push({wk:String(parseInt(wm[1],10)),result:res});
    }
  }
  if(weekSheets.length>=2){
    var all=[];
    weekSheets.forEach(function(ws){ws.result.items.forEach(function(it){var c=JSON.parse(JSON.stringify(it));c.week=ws.wk;all.push(c);});});
    var merged2=smartFinish(all,'grid',['주차별 시트 '+weekSheets.length+'개를 하나로 합쳤어요']);
    if(!merged2.error)cands.unshift({name:'전체 ('+weekSheets.length+'개 시트)',result:merged2});
  }
  return cands;
}

/* 파일 종류 판별: 확장자보다 내용(매직 바이트) 우선 — 포털에서 .tmp 등으로 받히는 엑셀 대응 */
function xlSniff(u8,ext){
  if(u8.length>=5&&u8[0]===0x25&&u8[1]===0x50&&u8[2]===0x44&&u8[3]===0x46)return'pdf';        /* %PDF */
  if(u8.length>=2&&u8[0]===0x50&&u8[1]===0x4B)return'sheet';                                 /* PK — xlsx/xlsm/ods/numbers */
  if(u8.length>=4&&u8[0]===0xD0&&u8[1]===0xCF&&u8[2]===0x11&&u8[3]===0xE0)return'sheet';     /* OLE — xls */
  if(ext==='pdf')return'pdf';
  if(ext==='xlsx'||ext==='xls'||ext==='xlsm'||ext==='xlsb'||ext==='ods'||ext==='numbers')return'sheet';
  if(ext==='csv'||ext==='tsv'||ext==='txt')return'text';
  /* 텍스트로 읽어 표(구분자) 또는 HTML 표인지 확인 */
  var head='';
  try{head=xlDecodeText(u8.slice(0,4096).buffer);}catch(e){}
  if(/^\s*<(!doctype|html|table|\?xml)/i.test(head))return'sheet';                          /* HTML/XML 표 → SheetJS가 처리 */
  if(/[,\t;]/.test(head)&&/\n/.test(head))return'text'; /* 구분자 + 줄바꿈(\r\n 포함) */
  return'sheet';
}

/* 원격 진단용 서명: 파일명·크기·첫 바이트 (오류 문구에 붙여 캡처로 원인 파악) */
function xlSig(u8,file){
  var hex=[];for(var i=0;i<Math.min(4,u8.length);i++)hex.push(('0'+u8[i].toString(16)).slice(-2));
  var asc='';for(var j=0;j<Math.min(12,u8.length);j++){var c=u8[j];asc+=(c>=32&&c<127)?String.fromCharCode(c):'.';}
  return (file&&file.name?file.name:'?')+' '+Math.round((file&&file.size||u8.length)/1024)+'KB ['+hex.join(' ')+' '+asc+']';
}
function handleFile(file){
  if(!file)return;
  var ext=(file.name.split('.').pop()||'').toLowerCase();
  if(file.name.indexOf('.')<0)ext='';
  xlReset();
  xlStatus('파일 읽는 중...');

  var reader=new FileReader();
  reader.onerror=function(){xlStatus('파일을 읽을 수 없습니다.','err');};
  reader.onload=function(e){
    var buf=e.target.result,u8=new Uint8Array(buf);
    var kind=xlSniff(u8,ext);
    if(kind==='pdf'){xlHandlePdf(file);return;}
    if(kind==='text'){
      try{
        var rows=xlParseDelimited(xlDecodeText(buf));
        var res=smartParseRows(rows);
        if(res.error){xlStatus(res.error,'err');return;}
        xlSetCands([{name:file.name,result:res}]);
      }catch(err){xlStatus('파싱 오류: '+err.message,'err');}
      return;
    }
    /* 스프레드시트(xlsx·xls·xlsm·xlsb·ods·numbers·HTML 표): SheetJS가 형식 자동 감지 */
    if(typeof XLSX==='undefined'){
      xlStatus('엑셀 라이브러리를 아직 불러오지 못했어요. 잠시 후 다시 시도해주세요.','err');
      return;
    }
    try{
      var wb=XLSX.read(u8,{type:'array',cellDates:false});
      var cands=xlWorkbookCands(wb);
      if(!cands.length){
        xlStatus('시간표를 인식하지 못했어요 · 시트: '+wb.SheetNames.join(', ')+' · '+xlSig(u8,file),'err');
        return;
      }
      xlSetCands(cands);
    }catch(err){
      /* 엑셀로 안 열리면 텍스트 표로 한 번 더 시도 */
      try{
        var rows2=xlParseDelimited(xlDecodeText(buf));
        var res2=smartParseRows(rows2);
        if(!res2.error){xlSetCands([{name:file.name,result:res2}]);return;}
      }catch(e2){}
      xlStatus('파일을 열 수 없어요 · '+xlSig(u8,file)+' · '+err.message,'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ── PDF (원광대 등) ── */
function xlHandlePdf(file){
  xlStatus('PDF 파싱 중...');
  loadPdfJs(function(){
    var fr=new FileReader();
    fr.onload=function(e){
      var typedarray=new Uint8Array(e.target.result);
      pdfjsLib.getDocument({data:typedarray}).promise.then(function(pdf){
        var pagePromises=[];
        for(var p=1;p<=pdf.numPages;p++)pagePromises.push(pdf.getPage(p));
        return Promise.all(pagePromises);
      }).then(function(pages){
        return Promise.all(pages.map(function(page){
          return page.getTextContent().then(function(tc){return{page:page,items:tc.items};});
        }));
      }).then(function(pageContents){
        var result=parseWkuPdf(pageContents);
        if(!result||!result.items||!result.items.length){
          xlStatus('PDF에서 시간표를 인식하지 못했어요. 엑셀 파일이 있다면 그쪽을 올려주세요.','err');
          return;
        }
        /* 품질 게이트: 셀 파편이 과목으로 새는 복잡한 레이아웃이면 적용 차단 */
        var uq={};result.items.forEach(function(i){uq[i.subject]=1;});
        if(Object.keys(uq).length>result.items.length*0.3){
          xlStatus('이 PDF는 자동 인식 정확도가 낮아요. 원광대 통합 시간표는 업로드 없이 학교·학년만 선택하면 자동으로 표시됩니다.','err');
          return;
        }
        xlSetCands([{name:file.name,result:{items:result.items,wddLocal:result.wdd,edLocal:result.ed,format:'pdf',warnings:[]}}]);
      }).catch(function(err){xlStatus('PDF 오류: '+err.message,'err');});
    };
    fr.readAsArrayBuffer(file);
  });
}

/* ── 적용 (관리자: 작업본에 반영 → 배포 필요 / 일반: 내 기기에 바로 적용) ── */
function xlApply(){
  if(!pendingData)return;
  var newItems=Array.isArray(pendingData)?pendingData:(pendingData.items||[]);
  var nWdd=(!Array.isArray(pendingData)&&pendingData.nativeWdd)||null;
  var nEd=(!Array.isArray(pendingData)&&pendingData.nativeEd)||null;
  if(!newItems.length)return;
  var items=JSON.parse(JSON.stringify(newItems));

  if(typeof isAdmin!=='undefined'&&isAdmin){
    _workingMerged=items;
    if(nWdd)wdd=JSON.parse(JSON.stringify(nWdd));
    if(nEd){ed.length=0;nEd.forEach(function(d){ed.push(d);});}
    /* 주차 목록도 새 파일 기준으로 */
    var ws={};items.forEach(function(it){ws[it.week]=1;});
    wks=Object.keys(ws).sort(function(a,b){return parseInt(a,10)-parseInt(b,10);});
    _subjColorMap=null;ci=0;
    if(typeof admDirty!=='undefined')admDirty=true;
    closeXL();
    var panel=document.getElementById('admin-panel');
    if(panel&&panel.classList.contains('show')){renderAdminBody();}
    else{
      buildFromItems(JSON.parse(JSON.stringify(items)),JSON.parse(JSON.stringify(wdd)),ed.slice());
      goTodayWeek();render();
    }
    xlToast('작업본에 반영됐어요 · 배포하면 학우들에게 전달됩니다');
    return;
  }

  merged.length=0;
  items.forEach(function(it){merged.push(it);});
  buildFromItems(merged,nWdd||wdd,nEd||ed);
  _subjColorMap=null;
  try{localStorage.setItem(ttKey(),JSON.stringify({items:merged,wdd:nWdd||wdd,ed:nEd||ed,grade:savedGrade,ts:Date.now()}));}catch(e){}
  if(typeof ttLocalSet==='function')ttLocalSet(true); /* 내 파일 모드 — 공유 동기화 일시 중지 */
  goTodayWeek();
  closeXL();
  if(typeof setView==='function')setView('weekly');else render();
  xlToast('시간표를 적용했어요');
}
function xlToast(msg){
  var t=document.getElementById('update-toast');
  if(!t)return;
  t.textContent=msg;t.className='update-toast show';
  setTimeout(function(){t.className='update-toast';},2600);
}

/* ── 업로드 시트 이벤트 바인딩 (한 번만) ── */
function xlBind(){
  var ovl=document.getElementById('xl-ovl');
  if(!ovl||ovl._bound)return;
  ovl._bound=true;
  ovl.onclick=function(e){if(e.target===ovl)closeXL();};
  var x=document.getElementById('xl-x');if(x)x.onclick=closeXL;
  var dropzone=document.getElementById('xl-drop');
  var fileInput=document.getElementById('xl-file');
  if(dropzone&&fileInput){
    dropzone.onclick=function(){fileInput.click();};
    fileInput.onchange=function(){if(fileInput.files[0])handleFile(fileInput.files[0]);};
    dropzone.ondragover=function(e){e.preventDefault();dropzone.classList.add('drag');};
    dropzone.ondragleave=function(){dropzone.classList.remove('drag');};
    dropzone.ondrop=function(e){
      e.preventDefault();dropzone.classList.remove('drag');
      var f=e.dataTransfer&&e.dataTransfer.files[0];
      if(f)handleFile(f);
    };
  }
  var ap=document.getElementById('xl-apply');if(ap)ap.onclick=xlApply;
}
