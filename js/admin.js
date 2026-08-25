
/* ── 현재 편집 중인 데이터 소스 ── */
function admSrc(){ return (_workingMerged && isAdmin) ? _workingMerged : merged; }
/* 해당 과목의 교수 목록 (시수 많은 순) — 원본 시간표 기준 */
function admProfsFor(subj){
  var m={};
  var src=admSrc();
  for(var i=0;i<src.length;i++){
    var it=src[i];
    if(it.subject===subj&&it.professor)m[it.professor]=(m[it.professor]||0)+1;
  }
  return Object.keys(m).sort(function(a,b){return m[b]-m[a]||a.localeCompare(b,'ko');});
}
function admProfOptsHtml(subj,cur){
  var ps=admProfsFor(subj),found=!cur;
  var h='<option value="">교수 없음</option>';
  ps.forEach(function(pn){
    if(pn===cur)found=true;
    h+='<option value="'+escAdm(pn)+'"'+(pn===cur?' selected':'')+'>'+escAdm(pn)+'</option>';
  });
  h+='<option value="__custom"'+(!found?' selected':'')+'>직접 입력…</option>';
  return h;
}

/* ── FAB / 패널 ── */
function updateAdminFab(){
  var fab=document.getElementById('admin-fab');
  if(fab) fab.style.display=(wks&&wks.length>0)?'flex':'none';
}
function openAdminPanel(){
  var panel=document.getElementById('admin-panel');
  if(panel) panel.className='admin-panel show';
  admEditIdx=-1;
  _workingMerged=JSON.parse(JSON.stringify(merged));
  renderAdminBody();
}
function closeAdminPanel(){
  var panel=document.getElementById('admin-panel');
  if(panel) panel.className='admin-panel';
  admCloseModal();
  admEditIdx=-1;
  _workingMerged=null;
}
function escAdm(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── 모달 열기/닫기 ── */
function admOpenModal(ri){
  var src=admSrc();
  if(ri<0||ri>=src.length) return;
  admEditIdx=ri;
  renderAdminEditModal();
}
function admCloseModal(){
  admEditIdx=-1;
  var modal=document.getElementById('adm-edit-modal');
  if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

/* ── 편집 모달 렌더 ── */
function renderAdminEditModal(){
  var src=admSrc();
  var ri=admEditIdx;
  if(ri<0||ri>=src.length) return;
  var it=src[ri];

  /* 기존 모달 제거 */
  var old=document.getElementById('adm-edit-modal');
  if(old && old.parentNode) old.parentNode.removeChild(old);

  var modal=document.createElement('div');
  modal.id='adm-edit-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:950;display:flex;align-items:flex-end;justify-content:center;';
  modal.onclick=function(e){ if(e.target===modal) admCloseModal(); };
  document.body.appendChild(modal);

  var box=document.createElement('div');
  box.style.cssText='background:var(--surface-muted);border-radius:22px 22px 0 0;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));';
  box.onclick=function(e){ e.stopPropagation(); };

  /* 헤더 */
  var hdr=document.createElement('div');
  hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px;border-bottom:1px solid var(--border);background:var(--surface);border-radius:22px 22px 0 0;position:sticky;top:0;z-index:1;';
  var closeBtn=document.createElement('button');
  closeBtn.style.cssText='background:var(--surface-muted);border:none;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;';
  closeBtn.textContent='✕';
  closeBtn.onclick=function(){ admCloseModal(); };
  hdr.innerHTML='<div style="font-size:16px;font-weight:700;color:var(--text)">수업 편집</div>';
  hdr.appendChild(closeBtn);
  box.appendChild(hdr);

  /* 과목명 선택 */
  var subjects=getUniqueSubjects();
  var subjOpts='<option value="">-- 과목 선택 --</option>';
  subjects.forEach(function(s){
    subjOpts+='<option value="'+escAdm(s)+'"'+(s===it.subject?' selected':'')+'>'+escAdm(s)+'</option>';
  });
  if(it.subject && subjects.indexOf(it.subject)<0){
    subjOpts+='<option value="'+escAdm(it.subject)+'" selected>'+escAdm(it.subject)+'</option>';
  }

  var formDiv=document.createElement('div');
  formDiv.style.cssText='padding:16px;display:flex;flex-direction:column;gap:12px;';
  formDiv.innerHTML=
    '<div style="background:var(--surface);border-radius:14px;padding:14px 16px;">'+
      '<div style="font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:8px;">과목명 선택</div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'+
        '<div id="adm-dot" style="width:14px;height:14px;border-radius:50%;background:'+gcol(it.subject||'')+';flex-shrink:0;"></div>'+
        '<div id="adm-cur" style="font-size:14px;font-weight:700;color:var(--text);">'+escAdm(it.subject||'과목 선택')+'</div>'+
      '</div>'+
      '<select id="adm-sel" style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px;font-size:14px;font-family:inherit;background:var(--surface-2);box-sizing:border-box;">'+subjOpts+'</select>'+
    '</div>'+
    '<div style="background:var(--surface);border-radius:14px;padding:14px 16px;">'+
      '<div style="font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:8px;">교수명</div>'+
      '<select id="adm-prof-sel" style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px;font-size:14px;font-family:inherit;background:var(--surface-2);box-sizing:border-box;">'+admProfOptsHtml(it.subject||'',it.professor||'')+'</select>'+
      '<input id="adm-prof" value="'+escAdm(it.professor||'')+'" placeholder="교수명 직접 입력" style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px;font-size:14px;color:var(--text);background:var(--surface-2);box-sizing:border-box;margin-top:8px;display:'+((it.professor&&admProfsFor(it.subject||'').indexOf(it.professor)<0)?'block':'none')+';outline:none;">'+
    '</div>'+
    '<div style="background:var(--surface);border-radius:14px;padding:14px 16px;">'+
      '<label style="display:flex;align-items:center;gap:12px;cursor:pointer;">'+
        '<div id="adm-exam-box" style="width:24px;height:24px;border-radius:6px;border:2px solid '+(it.is_exam?'#EF4444':'var(--border-strong)')+';background:'+(it.is_exam?'#EF4444':'var(--surface)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;">'+
          (it.is_exam?'<span style="color:#fff;font-size:14px;font-weight:800;">✓</span>':'')+
        '</div>'+
        '<div>'+
          '<div style="font-size:14px;font-weight:600;color:var(--text);">시험</div>'+
          '<div style="font-size:11px;color:var(--text-soft);margin-top:1px;">체크하면 ‼️ 표시 + 빨간 테두리 강조</div>'+
        '</div>'+
      '</label>'+
    '</div>';
  box.appendChild(formDiv);

  /* 날짜 선택 - 캘린더 */
  var dateDiv=document.createElement('div');
  dateDiv.style.cssText='margin:0 16px 12px;';
  dateDiv.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:8px;">날짜 선택</div>';

  var calCard=document.createElement('div');
  calCard.style.cssText='background:var(--surface);border-radius:14px;overflow:hidden;';

  var initDate=it.date?new Date(it.date):new Date();
  var calY=initDate.getFullYear(), calM=initDate.getMonth();

  var calHdr=document.createElement('div');
  calHdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #F3F4F6;';
  var prevB=document.createElement('button');
  prevB.style.cssText='background:var(--surface-muted);border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;';
  prevB.innerHTML='&#8249;';
  var calTit=document.createElement('div');
  calTit.style.cssText='font-size:15px;font-weight:700;color:var(--text);';
  var nextB=document.createElement('button');
  nextB.style.cssText='background:var(--surface-muted);border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;';
  nextB.innerHTML='&#8250;';
  calHdr.appendChild(prevB); calHdr.appendChild(calTit); calHdr.appendChild(nextB);

  var calGrid=document.createElement('div');
  calGrid.style.cssText='display:grid;grid-template-columns:repeat(7,1fr);padding:8px 12px 14px;gap:2px;';
  calCard.appendChild(calHdr); calCard.appendChild(calGrid);
  dateDiv.appendChild(calCard);
  box.appendChild(dateDiv);

  /* 교시 선택 */
  var perDiv=document.createElement('div');
  perDiv.style.cssText='margin:0 16px 12px;';
  perDiv.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:8px;">교시 선택</div>';
  var perCard=document.createElement('div');
  perCard.style.cssText='background:var(--surface);border-radius:14px;overflow:hidden;';
  perDiv.appendChild(perCard);
  box.appendChild(perDiv);

  /* 저장/삭제 버튼 */
  var btnDiv=document.createElement('div');
  btnDiv.style.cssText='margin:0 16px;display:flex;flex-direction:column;gap:10px;';
  var saveB=document.createElement('button');
  saveB.style.cssText='width:100%;background:#007AFF;color:#fff;border:none;border-radius:14px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;';
  saveB.textContent='💾 저장';

  var delB=document.createElement('button');
  delB.style.cssText='width:100%;background:#FFE4E6;color:#BE123C;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;';
  delB.textContent='🗑 삭제';

  btnDiv.appendChild(saveB); btnDiv.appendChild(delB);
  box.appendChild(btnDiv);
  modal.appendChild(box);

  /* ── 캘린더 렌더 함수 (클로저) ── */
  function renderCal(y, m){
    calY=y; calM=m;
    var ML=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var WL=['일','월','화','수','목','금','토'];
    calTit.textContent=y+'년 '+ML[m];

    var validDates={};
    Object.keys(wdd).forEach(function(wk){
      Object.keys(wdd[wk]).forEach(function(d){ validDates[wdd[wk][d]]=true; });
    });

    calGrid.innerHTML='';
    WL.forEach(function(w){
      var c=document.createElement('div');
      c.style.cssText='text-align:center;font-size:11px;font-weight:600;color:#9CA3AF;padding:6px 0;';
      c.textContent=w; calGrid.appendChild(c);
    });
    var firstDay=new Date(y,m,1).getDay();
    var lastDate=new Date(y,m+1,0).getDate();
    for(var b=0;b<firstDay;b++) calGrid.appendChild(document.createElement('div'));
    for(var d2=1;d2<=lastDate;d2++){
      var ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d2).padStart(2,'0');
      var isV=!!validDates[ds];
      var isSel=(ds===admSrc()[ri].date);
      var c2=document.createElement('div');
      c2.style.cssText='text-align:center;padding:7px 2px;border-radius:10px;font-size:14px;margin:1px;cursor:'+(isV?'pointer':'default')+';';
      if(isSel) c2.style.cssText+='background:#007AFF;color:#fff;font-weight:700;';
      else if(isV) c2.style.cssText+='color:var(--text);font-weight:500;';
      else c2.style.cssText+='color:#D1D5DB;';
      c2.textContent=d2;
      if(isV)(function(dateStr){
        c2.onclick=function(){
          admSrc()[ri].date=dateStr;
          /* 요일/주차 업데이트 */
          Object.keys(wdd).forEach(function(wk){
            Object.keys(wdd[wk]).forEach(function(day){
              if(wdd[wk][day]===dateStr){
                admSrc()[ri].week=wk;
                admSrc()[ri].day=day;
              }
            });
          });
          renderCal(calY, calM); /* 선택 표시 갱신 */
        };
      })(ds);
      calGrid.appendChild(c2);
    }
  }
  prevB.onclick=function(){ var m2=calM-1,y2=calY; if(m2<0){m2=11;y2--;} renderCal(y2,m2); };
  nextB.onclick=function(){ var m2=calM+1,y2=calY; if(m2>11){m2=0;y2++;} renderCal(y2,m2); };
  renderCal(calY, calM);

  /* ── 교시 목록 렌더 ── */
  function renderPer(){
    perCard.innerHTML='';
    for(var p=1;p<=10;p++){
      var pI=PERIOD_INFO[p];
      var isOn=(p===admSrc()[ri].period);
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:12px 16px;cursor:pointer;border-bottom:1px solid #F3F4F6;'+(isOn?'background:#EFF6FF;':'');
      var circBg=isOn?'background:#007AFF;color:#fff':'background:#F3F4F6;color:#374151';
      row.innerHTML=
        '<div style="display:flex;align-items:center;gap:12px">'+
          '<div style="width:28px;height:28px;border-radius:50%;'+circBg+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">'+p+'</div>'+
          '<div style="font-size:14px;'+(isOn?'color:#1D4ED8;font-weight:700':'color:#1C1C1E')+'">'+pI.label+'</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<span style="font-size:12px;color:#6B7280">'+pI.time+'</span>'+
          (isOn?'<span style="color:#007AFF;font-size:16px">✓</span>':'')+
        '</div>';
      (function(pNum){ row.onclick=function(){
        admSrc()[ri].period=pNum;
        admSrc()[ri].start=PERIOD_START[pNum]||'';
        admSrc()[ri].end=PERIOD_END[pNum]||'';
        renderPer();
      }; })(p);
      perCard.appendChild(row);
    }
  }
  renderPer();

  /* ── 과목 선택 이벤트 ── */
  setTimeout(function(){
    var sel=document.getElementById('adm-sel');
    if(sel) sel.onchange=function(){
      var v=this.value;
      var dot=document.getElementById('adm-dot');
      var cur=document.getElementById('adm-cur');
      if(dot) dot.style.background=gcol(v);
      if(cur) cur.textContent=v||'과목 선택';
      /* 과목이 바뀌면 그 과목의 교수 목록으로 갱신 */
      var ps=document.getElementById('adm-prof-sel');
      if(ps){ps.innerHTML=admProfOptsHtml(v,'');var pi=document.getElementById('adm-prof');if(pi)pi.style.display='none';}
    };
    var psel=document.getElementById('adm-prof-sel');
    if(psel) psel.onchange=function(){
      var pi=document.getElementById('adm-prof');
      if(!pi)return;
      if(this.value==='__custom'){pi.style.display='block';pi.focus();}
      else pi.style.display='none';
    };

    /* ── 시험 체크박스 클릭 ── */
    var examBox=document.getElementById('adm-exam-box');
    if(examBox) examBox.parentNode.onclick=function(){
      admSrc()[ri].is_exam=!admSrc()[ri].is_exam;
      var chk=admSrc()[ri].is_exam;
      examBox.style.border='2px solid '+(chk?'#EF4444':'var(--border-strong)');
      examBox.style.background=chk?'#EF4444':'var(--surface)';
      examBox.innerHTML=chk?'<span style="color:#fff;font-size:14px;font-weight:800;">✓</span>':'';
    };
  },30);

  /* ── 저장 버튼 ── */
  saveB.onclick=function(){
    var sel=document.getElementById('adm-sel');
    var psel=document.getElementById('adm-prof-sel');
    var prof=document.getElementById('adm-prof');
    var subj=sel?sel.value.trim():'';
    if(subj) admSrc()[ri].subject=subj;
    var pv='';
    if(psel)pv=(psel.value==='__custom')?(prof?prof.value.trim():''):psel.value;
    else if(prof)pv=prof.value.trim();
    admSrc()[ri].professor=pv;
    /* is_exam은 체크박스에서 이미 실시간 반영됨 - 별도 처리 불필요 */
    _subjColorMap=null;
    admCloseModal();
    renderAdminBody();
  };

  /* ── 삭제 버튼 ── */
  delB.onclick=function(e){
    e.stopPropagation();
    var capturedRi=ri;
    /* 인라인 확인 UI - edit modal 위에 직접 띄움 */
    var confirmDiv=document.createElement('div');
    confirmDiv.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:10;display:flex;align-items:center;justify-content:center;padding:20px;border-radius:22px 22px 0 0;';
    var confirmBox=document.createElement('div');
    confirmBox.style.cssText='background:var(--surface);border-radius:16px;padding:24px 20px;width:100%;max-width:280px;text-align:center;';
    confirmBox.innerHTML='<div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:20px;line-height:1.5">이 수업을 삭제할까요?</div>'+
      '<div style="display:flex;gap:10px;">'+
        '<button id="del-cancel" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);font-size:15px;cursor:pointer;">취소</button>'+
        '<button id="del-ok" style="flex:1;padding:12px;border-radius:12px;border:none;background:#FF3B30;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">삭제</button>'+
      '</div>';
    confirmDiv.appendChild(confirmBox);
    box.appendChild(confirmDiv);
    confirmDiv.querySelector('#del-cancel').onclick=function(e2){
      e2.stopPropagation();
      box.removeChild(confirmDiv);
    };
    confirmDiv.querySelector('#del-ok').onclick=function(e2){
      e2.stopPropagation();
      /* 모달 닫기 */
      if(modal.parentNode) modal.parentNode.removeChild(modal);
      admEditIdx=-1;
      /* 삭제 */
      var src=admSrc();
      if(capturedRi>=0&&capturedRi<src.length) src.splice(capturedRi,1);
      renderAdminBody();
    };
  };
}

/* ── 주간 탭 변경 ── */
function adminChangeWk(w){
  ci=wks.indexOf(w); if(ci<0)ci=0;
  render(); renderAdminBody();
}

/* ── 수업 추가 ── */
function addAItem(){
  var curWk=wks[ci]||wks[0]||'1';
  var dd2=wdd[curWk]||{};
  var date=dd2['월']||dd2['화']||dd2['수']||Object.values(dd2)[0]||'';
  var src=admSrc();
  var newItem={week:curWk,date:date,day:'월',period:1,
    start:'8:30',end:'9:20',subject:getUniqueSubjects()[0]||'새 수업',
    professor:'',is_exam:false};
  src.push(newItem);
  admEditIdx=src.length-1;
  renderAdminEditModal();
}

/* ── 메인 패널 렌더 ── */
function renderAdminBody(){
  var body=document.getElementById('admin-panel-body');
  var titleEl=document.getElementById('admin-panel-title');
  if(!body) return;

  if(!isAdmin){
    if(titleEl) titleEl.textContent='관리자 로그인';
    body.innerHTML=
      '<div class="admin-login-box">'+
        '<div style="background:#EFF6FF;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;color:#1D4ED8;margin-bottom:14px;text-align:center">'+(savedGrade||'학년 미선택')+' 관리자</div>'+
        '<div class="admin-login-title">시간표 관리자</div>'+
        '<div class="admin-login-sub">해당 학년 관리자 비밀번호를 입력하세요</div>'+
        '<input class="admin-pw-field" id="adm-pw" type="password" placeholder="비밀번호">'+
        '<button class="admin-login-btn" id="adm-login-btn">로그인</button>'+
        '<div class="admin-err" id="adm-err"></div>'+
      '</div>';
    document.getElementById('adm-login-btn').onclick=doLogin;
    document.getElementById('adm-pw').onkeydown=function(e){if(e.key==='Enter')doLogin();};
    return;
  }

  if(titleEl) titleEl.textContent='✅ '+(savedGrade||'')+' 관리자 편집';

  var src=admSrc();
  if(!src||!src.length){
    body.innerHTML=
      '<div style="text-align:center;padding:40px 20px">'+
        '<div style="font-size:40px;margin-bottom:16px">⚠️</div>'+
        '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">시간표 데이터가 없습니다</div>'+
        '<div style="font-size:13px;color:var(--text-soft);margin-bottom:16px">엑셀 파일을 업로드하여 시간표를 등록하세요</div>'+
        '<button onclick="admOpenUpload();" style="width:100%;background:#059669;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:10px">📂 엑셀/PDF 업로드</button>'+
        '<button onclick="closeAdminPanel();" style="width:100%;background:var(--surface-muted);color:#636366;border:none;border-radius:12px;padding:12px;font-size:14px;cursor:pointer">닫기</button>'+
      '</div>';
    return;
  }

  var curWk=wks[ci]||wks[0]||'1';

  /* 주차 탭 */
  var tabsH='<div style="display:flex;gap:5px;flex-wrap:nowrap;overflow-x:auto;padding:12px 16px 8px;-webkit-overflow-scrolling:touch">';
  wks.forEach(function(w){
    var on=(w===curWk)?'background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700':'background:var(--surface);color:var(--text-muted);border-color:var(--border)';
    tabsH+='<button onclick="adminChangeWk(\''+w+'\')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1.5px solid;font-size:12px;cursor:pointer;'+on+'">'+w+'주차</button>';
  });
  tabsH+='</div>';

  /* 시간표 테이블 */
  var weekItems=src.filter(function(it){return it.week===curWk;});
  var tableHTML=buildAdminTable(curWk, weekItems, src);

  body.innerHTML='';

  var tabsDiv=document.createElement('div');
  tabsDiv.innerHTML=tabsH;
  body.appendChild(tabsDiv.firstChild);

  var hint=document.createElement('div');
  hint.style.cssText='font-size:12px;color:var(--text-soft);padding:4px 16px 10px;text-align:center;';
  hint.textContent='수업 블럭을 탭하여 편집 · 빈 칸 탭하여 수업 추가';
  body.appendChild(hint);

  var swDiv=document.createElement('div');
  swDiv.className='sw';
  swDiv.style.cssText='margin:0 8px;border-radius:12px;overflow:hidden;';
  swDiv.innerHTML=tableHTML;
  body.appendChild(swDiv);

  var btns=document.createElement('div');
  btns.style.cssText='padding:12px 12px 0;display:flex;flex-direction:column;gap:8px;';
  btns.innerHTML=
    '<button class="admin-add-btn" onclick="addAItem()">＋ 수업 추가</button>'+
    '<button onclick="admOpenUpload()" style="width:100%;background:#F0FDF4;color:#059669;border:2px solid #059669;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;">📂 엑셀/PDF 업로드</button>'+
    '<button class="admin-publish-btn" onclick="publishTT()">📢 전체 배포</button>'+
    '<button style="background:none;border:none;color:var(--text-soft);font-size:13px;cursor:pointer;padding:8px;" onclick="doLogout()">로그아웃</button>';
  body.appendChild(btns);

  setTimeout(function(){bindAdminTableClicks(curWk);},30);
}

/* ── 관리자용 시간표 테이블 ── */
function buildAdminTable(w, items, srcArr){
  srcArr=srcArr||admSrc();
  var dd=wdd[w]||{};
  var PERIODS=[{n:1,t:'8:30'},{n:2,t:'9:30'},{n:3,t:'10:30'},{n:4,t:'11:30'},
    {n:5,t:'13:30'},{n:6,t:'14:30'},{n:7,t:'15:30'},{n:8,t:'16:30'},{n:9,t:'17:30'},{n:10,t:'18:30'}];
  var H2P={'8':1,'9':2,'10':3,'11':4,'13':5,'14':6,'15':7,'16':8,'17':9,'18':10};
  var grid={};
  for(var pi=1;pi<=10;pi++) grid[pi]={};
  items.forEach(function(it){
    if(!it.day||DAYS.indexOf(it.day)<0) return;
    var h=parseInt((it.start||'8:30').split(':')[0]);
    var sp=H2P[String(h)]||1;
    grid[sp][it.day]=it;
  });
  var h='<table class="tt"><thead><tr><th class="th-t"></th>';
  DAYS.forEach(function(d){
    var dt=dd[d]||'';
    h+='<th class="th-d" data-day="'+d+'" data-date="'+dt+'">'+d+'<br><span class="th-date">'+(dt?fmtDate(dt):'')+'</span></th>';
  });
  h+='</tr></thead><tbody>';
  PERIODS.forEach(function(per){
    var pn=per.n;
    if(pn===5){
      h+='<tr class="lunchrow"><td class="td-t"><span style="font-size:12px">🍱</span></td>';
      h+='<td colspan="5" class="td-lunch">점심시간&nbsp;&nbsp;12:20 ~ 13:30</td></tr>';
    }
    h+='<tr><td class="td-t"><span class="pn">'+pn+'</span><span class="pt">'+per.t+'</span></td>';
    DAYS.forEach(function(d){
      var it2=grid[pn]&&grid[pn][d];
      if(it2){
        var ri=-1;
        for(var j=0;j<srcArr.length;j++){if(srcArr[j]===it2){ri=j;break;}}
        var bg=gcol(it2.subject||'');
        h+='<td class="td-c adm-cell" data-day="'+d+'" data-ri="'+ri+'" style="cursor:pointer;position:relative;">';
        var isExamCell=(it2.is_exam===true||it2.is_exam==='true');
        var cellBg=gcol(it2.subject||'');
        var examStyle=isExamCell?'box-shadow:inset 0 0 0 2.5px #EF4444;':'';
        h+='<div class="card adm-card" style="background:'+cellBg+';cursor:pointer;'+examStyle+'">';
        h+='<div class="cn-s">'+(isExamCell?'‼️ ':'')+escAdm(it2.subject||'')+'</div>';
        if(it2.professor) h+='<div class="cn-p">'+escAdm(it2.professor)+'</div>';
        h+='<div style="position:absolute;top:2px;right:2px;font-size:10px;color:rgba(0,0,0,.25)">✎</div>';
        h+='</div></td>';
      } else {
        h+='<td class="td-c adm-empty" data-day="'+d+'" data-period="'+pn+'" style="cursor:pointer;">';
        h+='<div style="height:100%;min-height:44px;display:flex;align-items:center;justify-content:center;opacity:0;font-size:20px;color:#C7C7CC;transition:opacity .15s">＋</div>';
        h+='</td>';
      }
    });
    h+='</tr>';
  });
  h+='</tbody></table>';
  return h;
}

/* ── 셀 클릭 바인딩 ── */
function bindAdminTableClicks(curWk){
  var src=admSrc();
  document.querySelectorAll('.adm-cell[data-ri]').forEach(function(cell){
    var ri=parseInt(cell.getAttribute('data-ri'));
    if(ri>=0 && ri<src.length){
      cell.onclick=function(){ admOpenModal(ri); };
    }
  });
  document.querySelectorAll('.adm-empty').forEach(function(cell){
    var day=cell.getAttribute('data-day');
    var period=parseInt(cell.getAttribute('data-period'));
    var innerDiv=cell.querySelector('div');
    cell.onmouseover=function(){if(innerDiv)innerDiv.style.opacity='1';};
    cell.onmouseout=function(){if(innerDiv)innerDiv.style.opacity='0';};
    cell.onclick=function(){
      var dd2=wdd[curWk]||{};
      var date=dd2[day]||'';
      var newItem={week:curWk,date:date,day:day,period:period,
        start:PERIOD_START[period]||'8:30',end:PERIOD_END[period]||'9:20',
        subject:getUniqueSubjects()[0]||'새 수업',professor:'',is_exam:false};
      src.push(newItem);
      admEditIdx=src.length-1;
      renderAdminEditModal();
    };
  });
}

/* ── 로그인/로그아웃 ── */
function doLogin(){
  var pw=document.getElementById('adm-pw');
  var err=document.getElementById('adm-err');
  if(!pw) return;
  var correctPw=adminPwFor(savedSchool,savedGrade||'')||'';
  if(!correctPw){if(err)err.textContent='이 학년은 아직 공유 관리자가 지정되지 않았어요';return;}
  if(pw.value===correctPw){
    isAdmin=true;
    _workingMerged=JSON.parse(JSON.stringify(merged));
    renderAdminBody();
  } else {
    if(err) err.textContent='비밀번호가 틀렸습니다';
    pw.value=''; pw.focus();
  }
}
function doLogout(){ isAdmin=false; _workingMerged=null; closeAdminPanel(); }

/* ── 배포 ── */
function publishTT(){
  /* 변경 메모 입력 확인 다이얼로그 */
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick=function(e){e.stopPropagation();};
  var box=document.createElement('div');
  box.style.cssText='background:var(--surface);border-radius:18px;padding:24px 20px;width:100%;max-width:320px;';
  box.onclick=function(e){e.stopPropagation();};
  var title=document.createElement('div');
  title.style.cssText='font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;';
  title.textContent='📢 시간표 배포';
  var sub=document.createElement('div');
  sub.style.cssText='font-size:12px;color:var(--text-soft);margin-bottom:12px;';
  sub.textContent='어떤 사항이 변경되었는지 입력하세요. (선택)';
  var textarea=document.createElement('textarea');
  textarea.className='admin-changelog-input';
  textarea.placeholder='예) 4월 7일 의료면담 교수님 변경 (정재희→정영철)';
  textarea.rows=3;
  var btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:10px;';
  var cancelBtn=document.createElement('button');
  cancelBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer;';
  cancelBtn.textContent='취소';
  cancelBtn.onclick=function(e){e.stopPropagation();if(overlay.parentNode)overlay.parentNode.removeChild(overlay);};
  var okBtn=document.createElement('button');
  okBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:none;background:#007AFF;color:#fff;font-size:14px;font-weight:700;cursor:pointer;';
  okBtn.textContent='배포';
  okBtn.onclick=function(e){
    e.stopPropagation();
    var memo=textarea.value.trim();
    if(overlay.parentNode)overlay.parentNode.removeChild(overlay);
    doPublish(memo);
  };
  btnRow.appendChild(cancelBtn);btnRow.appendChild(okBtn);
  box.appendChild(title);box.appendChild(sub);box.appendChild(textarea);box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(function(){textarea.focus();},100);
}
function doPublish(memo){
  if(_workingMerged){
    merged.length=0;
    _workingMerged.forEach(function(it){merged.push(it);});
    buildFromItems(merged,wdd,ed);
    _workingMerged=null;
    _subjColorMap=null;
  }
  /* 변경 내역 저장 */
  var changelogEntry=null;
  if(memo){
    changelogEntry={ts:Date.now(),msg:memo,grade:savedGrade};
    try{
      var logs=JSON.parse(localStorage.getItem('changelog_'+fbGradeKey(savedGrade))||'[]');
      logs.unshift(changelogEntry);
      if(logs.length>20)logs=logs.slice(0,20);
      localStorage.setItem('changelog_'+fbGradeKey(savedGrade),JSON.stringify(logs));
    }catch(e){}
  }
  try{localStorage.setItem(ttKey(),JSON.stringify({items:merged,wdd:wdd,ed:ed,grade:savedGrade,ts:Date.now()}));}catch(e){}
  if(fbDb&&savedGrade){
    var ref=fbRef(savedGrade);
    if(ref){
      var payload={items:merged,wdd:wdd,ed:ed,wks:wks,grade:savedGrade,ts:Date.now()};
      if(changelogEntry) payload.changelog=changelogEntry;
      ref.set(payload)
        .then(function(){console.log('Firebase 배포 완료');})
        .catch(function(e){console.error('Firebase 배포 실패:',e);});
    }
  }
  admCloseModal();
  closeAdminPanel();
  goTodayWeek();
  setView('weekly');
  render();
  var toast=document.getElementById('update-toast');
  if(toast){
    toast.textContent='✅ 시간표 배포 완료!'+(memo?' ('+memo.substring(0,20)+(memo.length>20?'..':'')+')':'');
    toast.className='update-toast show';
    setTimeout(function(){toast.textContent='📢 시간표가 업데이트되었습니다!';toast.className='update-toast';},3500);
  }
}

function admShowConfirm(msg,onOk,okLabel,okColor){
  var label=okLabel||'확인', color=okColor||'#007AFF';
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick=function(e){e.stopPropagation();};

  var box=document.createElement('div');
  box.style.cssText='background:var(--surface);border-radius:18px;padding:24px 20px;width:100%;max-width:320px;text-align:center;';
  box.onclick=function(e){e.stopPropagation();};

  var msgDiv=document.createElement('div');
  msgDiv.style.cssText='font-size:16px;font-weight:600;color:var(--text);margin-bottom:20px;line-height:1.5;';
  msgDiv.textContent=msg;

  var btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:10px;';

  var cancelBtn=document.createElement('button');
  cancelBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);font-size:15px;cursor:pointer;';
  cancelBtn.textContent='취소';
  cancelBtn.onclick=function(e){
    e.stopPropagation();
    if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  var okBtn=document.createElement('button');
  okBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:none;background:'+color+';color:#fff;font-size:15px;font-weight:700;cursor:pointer;';
  okBtn.textContent=label;
  okBtn.onclick=function(e){
    e.stopPropagation();
    if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
    onOk();
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(okBtn);
  box.appendChild(msgDiv);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/* ── Firebase 업로드 열기 ── */
function admOpenUpload(){
  var ovl=document.getElementById('xl-ovl');
  if(!ovl)return;
  ovl.style.zIndex='960';
  ovl.classList.add('show');
  var dropzone=document.getElementById('xl-drop');
  var fileInput=document.getElementById('xl-file');
  if(dropzone&&fileInput){
    dropzone.onclick=function(){fileInput.click();};
    fileInput.onchange=function(){if(fileInput.files[0])handleFile(fileInput.files[0]);};
  }
  var xBtn=document.getElementById('xl-x');
  if(xBtn) xBtn.onclick=closeXL;
  ovl.onclick=function(e){if(e.target===ovl)closeXL();};
  var applyBtn=document.getElementById('xl-apply');
  if(applyBtn){
    applyBtn.onclick=function(){
      if(!pendingData)return;
      var newItems=Array.isArray(pendingData)?pendingData:(pendingData.items||pendingData);
      var nWdd=(!Array.isArray(pendingData)&&pendingData.nativeWdd)||null;
      var nEd=(!Array.isArray(pendingData)&&pendingData.nativeEd)||null;
      if(isAdmin){
        _workingMerged=[];
        newItems.forEach(function(it){_workingMerged.push(it);});
        if(nWdd) Object.assign(wdd,nWdd);
        if(nEd&&nEd.length){ed.length=0;nEd.forEach(function(e2){ed.push(e2);});}
        _subjColorMap=null;
        ci=0; closeXL(); renderAdminBody();
      } else {
        merged.length=0;
        newItems.forEach(function(it){merged.push(it);});
        buildFromItems(merged,nWdd||wdd,nEd||ed);
        _subjColorMap=null;
        try{localStorage.setItem(ttKey(),JSON.stringify({items:merged,wdd:nWdd||wdd,ed:nEd||ed,grade:savedGrade,ts:Date.now()}));}catch(e){}
        ci=0; closeXL(); render();
      }
    };
  }
}
