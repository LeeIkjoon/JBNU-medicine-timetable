function openXL(){document.getElementById('xl-ovl').classList.add('show');}
function closeXL(){
  var ovl=document.getElementById('xl-ovl');
  if(ovl){ovl.classList.remove('show');ovl.style.zIndex='';}
  pendingData=null;
  var st=document.getElementById('xl-status');
  if(st)st.textContent='';
  var ap=document.getElementById('xl-apply');
  if(ap)ap.disabled=true;
}

function handleFile(file){
  if(!file)return;
  var ext=file.name.split('.').pop().toLowerCase();
  var status=document.getElementById('xl-status');
  var applyBtn=document.getElementById('xl-apply');
  pendingData=null;
  applyBtn.disabled=true;
  status.className='xl-status';
  status.textContent='파일 읽는 중...';

  var reader=new FileReader();

  if(ext==='csv'){
    reader.onload=function(e){
      try{
        var rows=parseCSV(e.target.result);
        var result=csvRowsToItems(rows);
        if(!result){status.className='xl-status err';status.textContent='파일이 비어있습니다.';return;}
        if(result.error){status.className='xl-status err';status.textContent=result.error;return;}
        pendingData=result;
        status.className='xl-status ok';
        status.textContent='✓ '+result.length+'개 수업 항목 인식됨';
        applyBtn.disabled=false;
      }catch(err){status.className='xl-status err';status.textContent='파싱 오류: '+err.message;}
    };
    reader.readAsText(file,'UTF-8');

  }else if(ext==='xlsx'||ext==='xls'){
    if(typeof XLSX==='undefined'){
      status.className='xl-status err';
      status.textContent='XLSX 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.';
      return;
    }
    reader.onload=function(e){
      try{
        var data=new Uint8Array(e.target.result);
        var wb=XLSX.read(data,{type:'array',cellDates:false});

        /* ── 시간표 시트 자동 감지 ──
           우선순위:
           1) 헤더 row[0][0] === '주차' 인 시트
           2) row[1][0] 이 1~18 숫자이고 row[0][2]가 요일인 시트
           3) 시트명에 '학년'/'시간표' 포함
           4) 첫 번째 시트 (fallback)
        */
        var DAYS_KR=['월','화','수','목','금','토','일'];
        var targetSheet=null, targetName=wb.SheetNames[0];
        var fallbackSheet=wb.Sheets[wb.SheetNames[0]], fallbackName=wb.SheetNames[0];

        for(var si=0;si<wb.SheetNames.length;si++){
          var sname=wb.SheetNames[si];
          var ws=wb.Sheets[sname];
          /* 상위 3행만 빠르게 읽기 */
          var peek=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',range:{s:{r:0,c:0},e:{r:2,c:5}}});
          if(!peek||!peek.length)continue;
          var p0=peek[0]||[], p1=peek[1]||[];
          var c0=String(p0[0]||'').trim();
          var c2=String(p0[2]||'').trim();
          /* 조건 1: 헤더가 '주차' */
          if(c0==='주차'){targetSheet=ws;targetName=sname;break;}
          /* 조건 2: 2행 첫 셀이 1~18 정수이고 3열이 요일 */
          var d2=String(p1[2]||'').trim();
          if(typeof p1[0]==='number'&&p1[0]>=1&&p1[0]<=18&&DAYS_KR.indexOf(d2)>=0){
            targetSheet=ws;targetName=sname;break;
          }
        }
        /* 조건 3: 시트명 키워드 */
        if(!targetSheet){
          for(var si2=0;si2<wb.SheetNames.length;si2++){
            var sn2=wb.SheetNames[si2];
            if(sn2.indexOf('학년')>=0||sn2.indexOf('시간표')>=0){
              targetSheet=wb.Sheets[sn2];targetName=sn2;break;
            }
          }
        }
        if(!targetSheet){targetSheet=fallbackSheet;targetName=fallbackName;}

        var rawRows=XLSX.utils.sheet_to_json(targetSheet,{header:1,raw:true,defval:''});
        var result=csvRowsToItems(rawRows);
        if(!result){status.className='xl-status err';status.textContent='파일이 비어있습니다.';return;}
        if(result.error){status.className='xl-status err';status.textContent=result.error;return;}

        var items,nWdd,nEd;
        if(Array.isArray(result)){
          /* 전북대 native: items 배열 반환 → wdd/ed는 별도 parseNativeRows로 */
          items=result;
          var nRes=parseNativeRows(rawRows);
          nWdd=(nRes&&nRes.wddLocal)||null;
          nEd=(nRes&&nRes.edLocal)||null;
        } else if(result.items){
          /* 계명대 등 행기반 파서: {items, wddLocal, edLocal} 반환 */
          items=result.items;
          nWdd=result.wddLocal||null;
          nEd=result.edLocal||null;
        } else {
          status.className='xl-status err';status.textContent='파싱 오류';return;
        }

        if(!items||!items.length){status.className='xl-status err';status.textContent='수업 데이터를 찾을 수 없습니다.';return;}
        pendingData={items:items,nativeWdd:nWdd,nativeEd:nEd};
        status.className='xl-status ok';
        status.textContent='✓ '+items.length+'개 수업 항목 인식됨 ('+targetName+')';
        applyBtn.disabled=false;
      }catch(err){status.className='xl-status err';status.textContent='XLSX 파싱 오류: '+err.message;}
    };
    reader.readAsArrayBuffer(file);

  }else if(ext==='pdf'){
    /* ── 원광대 등 PDF 시간표 파싱 ── */
    status.className='xl-status';
    status.textContent='PDF 파싱 중...';
    applyBtn.disabled=true;

    loadPdfJs(function(){
      var fr=new FileReader();
      fr.onload=function(e){
        var typedarray=new Uint8Array(e.target.result);
        pdfjsLib.getDocument({data:typedarray}).promise.then(function(pdf){
          var numPages=pdf.numPages;
          var pagePromises=[];
          for(var p=1;p<=numPages;p++) pagePromises.push(pdf.getPage(p));
          return Promise.all(pagePromises);
        }).then(function(pages){
          return Promise.all(pages.map(function(page){
            return page.getTextContent().then(function(tc){
              return {page:page,items:tc.items};
            });
          }));
        }).then(function(pageContents){
          var result=parseWkuPdf(pageContents);
          if(!result||!result.items||!result.items.length){
            status.className='xl-status err';
            status.textContent='PDF 파싱 실패: 시간표 형식을 인식할 수 없습니다.';
            return;
          }
          /* 품질 게이트: 셀 파편이 과목으로 새는 복잡한 레이아웃이면 적용 차단 */
          var _uq={};result.items.forEach(function(i){_uq[i.subject]=1;});
          if(Object.keys(_uq).length>result.items.length*0.3){
            status.className='xl-status err';
            status.textContent='이 PDF는 자동 인식 정확도가 낮아요. 원광대 통합 시간표는 업로드 없이 학교·학년만 선택하면 자동으로 표시됩니다.';
            return;
          }
          pendingData={items:result.items,nativeWdd:result.wdd,nativeEd:result.ed};
          status.className='xl-status ok';
          status.textContent='✓ '+result.items.length+'개 수업 항목 인식됨 (PDF '+result.wks.length+'주)';
          applyBtn.disabled=false;
        }).catch(function(err){
          status.className='xl-status err';
          status.textContent='PDF 오류: '+err.message;
        });
      };
      fr.readAsArrayBuffer(file);
    });

  }else{
    status.className='xl-status err';
    status.textContent='CSV · XLSX · PDF 파일만 지원합니다.';
  }
}
