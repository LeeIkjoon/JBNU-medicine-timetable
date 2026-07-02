/* ══════════════════════════════════════════
   헤더 & 렌더
══════════════════════════════════════════ */
function updHdr(){
  var w=wks[ci];
  document.getElementById('wl').textContent=w+'주차';
  var v=wvals(w).sort();
  document.getElementById('wr').textContent=v.length>=2?fmtDate(v[0])+' ~ '+fmtDate(v[v.length-1]):(v[0]?fmtDate(v[0]):'');
  document.getElementById('pb').disabled=(ci===0);
  document.getElementById('nb').disabled=(ci===wks.length-1);
}

function goTodayWeek(){
  var t=today();
  for(var i=0;i<wks.length;i++){
    var v=wvals(wks[i]).sort();
    if(v.length&&t>=v[0]&&t<=v[v.length-1]){ci=i;break;}
  }
}

/* ── 테마 토글 (시스템 ↔ 라이트 ↔ 다크) ── */
function getTheme(){try{return localStorage.getItem('theme');}catch(e){return null;}}
function applyTheme(t){
  if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);
  else document.documentElement.removeAttribute('data-theme');
  try{t?localStorage.setItem('theme',t):localStorage.removeItem('theme');}catch(e){}
  updThemeBtn();
}
function updThemeBtn(){
  var b=document.getElementById('theme-btn');if(!b)return;
  var t=getTheme();
  var sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.3M12 19.2v2.3M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.4 19.6l1.6-1.6M18 6l1.6-1.6"/></svg>';
  var moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.3A8 8 0 1 1 9.7 4a6.4 6.4 0 0 0 10.3 10.3z"/></svg>';
  var auto='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none"/></svg>';
  b.innerHTML=t==='dark'?moon:t==='light'?sun:auto;
}
function cycleTheme(){
  var t=getTheme(); /* null(시스템) → 라이트 → 다크 → 시스템 */
  applyTheme(t==='light'?'dark':t==='dark'?null:'light');
}
function setView(v){
  vw=v;
  document.getElementById('bn-d').className='bn'+(v==='dashboard'?' on':'');
  document.getElementById('bn-w').className='bn'+(v==='weekly'?' on':'');
  document.getElementById('bn-f').className='bn'+(v==='filter'?' on':'');
  document.getElementById('wnav').style.display=(v==='weekly')?'flex':'none';
  render();
  /* 탭 전환 시 항상 맨 위로 */
  var main=document.getElementById('main');
  if(main) main.scrollTop=0;
  window.scrollTo({top:0,behavior:'instant'});
}

function render(){
  updHdr();
  if(typeof updateAdminFab==='function')updateAdminFab();
  if(vw==='dashboard')renderDashboard();
  else if(vw==='weekly')renderW();
  else if(vw==='list')renderL();
  else if(vw==='filter')renderF();
  else if(vw==='planner')renderPlanner();
}




/* ══════════════════════════════════════════
   초기화
══════════════════════════════════════════ */
function init(){
  /* wh 데이터 후처리: 날짜 하이픈→점, 색상 교체, td-e 통일, rowspan 제거 */
  var oldColors = {
    /* 이전 초연한 파스텔 → 새 구별되는 색상으로 */
    '#EDE9FE':'#EDE9FE','#FEF9C3':'#FEF9C3','#FFE4E6':'#FFE4E6',
    '#DCFCE7':'#DCFCE7','#FFF7ED':'#FFF7ED','#CCFBF1':'#CFFAFE',
    '#F0FDF4':'#D1FAE5','#ECFDF5':'#DCFCE7','#FDF2F8':'#FCE7F3',
    '#FFFBEB':'#FEF3C7','#F5F3FF':'#EDE9FE','#EFF6FF':'#DBEAFE',
    '#FAF5FF':'#F3E8FF','#FFF1F2':'#FEE2E2','#FEFCE8':'#FEF9C3',
    '#E5E7EB':'#F1F5F9','#D1D5DB':'#F1F5F9','#B0B8C8':'#F1F5F9',
    /* 구버전 채도 높은 색들 */
    '#A78BFA':'#EDE9FE','#F87171':'#FFE4E6','#34D399':'#DCFCE7',
    '#FDBA74':'#FFF7ED','#5EEAD4':'#CFFAFE','#BEF264':'#D1FAE5',
    '#86EFAC':'#DCFCE7','#F9A8D4':'#FCE7F3','#FDA4AF':'#FFE4E6',
    '#7DD3FC':'#DBEAFE','#F0ABFC':'#F3E8FF','#6EE7B7':'#D1FAE5',
    '#C4B5FD':'#EDE9FE','#FCD34D':'#FEF9C3','#FDE68A':'#FEF3C7',
    '#FCA5A5':'#FFE4E6','#A7F3D0':'#DCFCE7','#FED7AA':'#FFF7ED',
    '#99F6E4':'#CFFAFE','#D9F99D':'#D1FAE5','#BBF7D0':'#DCFCE7',
    '#FBCFE8':'#FCE7F3','#FEF08A':'#FEF9C3','#DDD6FE':'#EDE9FE',
    '#BAE6FD':'#DBEAFE','#E9D5FF':'#F3E8FF','#FECACA':'#FEE2E2',
    '#8B5CF6':'#EDE9FE','#D97706':'#FEF3C7','#EF4444':'#FFE4E6',
    '#10B981':'#DCFCE7','#F97316':'#FFEDD5','#14B8A6':'#CFFAFE',
    '#84CC16':'#D1FAE5','#22C55E':'#DCFCE7','#EC4899':'#FCE7F3',
    '#F59E0B':'#FEF3C7','#F43F5E':'#FFE4E6',
    '#6D28D9':'#EDE9FE','#065F46':'#DCFCE7','#C2410C':'#FFEDD5',
    '#15803D':'#DCFCE7','#166534':'#DCFCE7','#86198F':'#FCE7F3',
    '#9D174D':'#FCE7F3','#7C2D12':'#FEF3C7','#9F1239':'#FFE4E6',
    '#92400E':'#EDE9FE','#B45309':'#EDE9FE','#7C3AED':'#EDE9FE',
    '#DC2626':'#FFE4E6','#B91C1C':'#FFE4E6','#0F766E':'#CFFAFE',
    '#4D7C0F':'#D1FAE5','#3F6212':'#D1FAE5','#9CA3AF':'#F1F5F9',
    '#95A5A6':'#F1F5F9'
  };
  for(var wk in wh){
    /* 날짜 표기 변환: 03-17 → 03.17 */
    wh[wk]=wh[wk].replace(/(\d{2})-(\d{2})/g,'$1.$2');
    /* rowspan 속성 제거 (병합 셀 해제) */
    wh[wk]=wh[wk].replace(/ rowspan="\d+"/g,'');
    /* td-c td-e → td-c (빈 셀 클래스 통일) */
    wh[wk]=wh[wk].split('class="td-c td-e"').join('class="td-c"');
    /* 색상 교체 (두 번 - 따옴표/세미콜론 모두) */
    for(var oc in oldColors){
      wh[wk]=wh[wk].split('background:'+oc+'"').join('background:'+oldColors[oc]+'"');
      wh[wk]=wh[wk].split('background:'+oc+';').join('background:'+oldColors[oc]+';');
    }
    /* 시험 아이콘 제거 — 시험은 cn-exam(빨강 굵은 글씨)+빨강 테두리로 표시, 이모지 중복 제거 */
    wh[wk]=wh[wk].split('⚠️ ').join('').split('⚠️').join('');
    wh[wk]=wh[wk].split('‼️ ').join('').split('‼️').join('');
    /* 카드 텍스트 색 교체: 흰색→어두운 색 (파스텔 배경 가독성) */
    wh[wk]=wh[wk].split('color:#fff"').join('color:#1e293b"');
    wh[wk]=wh[wk].split('color:rgba(255,255,255,.9)').join('color:rgba(30,41,59,0.8)');
    wh[wk]=wh[wk].split('color:rgba(255,255,255,.85)').join('color:rgba(30,41,59,0.65)');
    wh[wk]=wh[wk].split('color:rgba(255,255,255,.7)').join('color:rgba(30,41,59,0.5)');
    /* 휴일 카드 교체 */
    wh[wk]=wh[wk].replace(/<td class="td-c"([^>]*)><div class="card" style="background:#95A5A6"><div class="cn-s">([^<]+)<\/div><div class="cn-t">([^<]+)<\/div><\/div><\/td>/g,
      function(match,attrs,subj,time){
        return '<td class="td-c td-e"'+attrs+'>'+
          '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">'+
          '<div style="font-size:16px">🗓</div>'+
          '<div style="font-size:9.5px;font-weight:600;color:#8E8E93;text-align:center;word-break:keep-all;line-height:1.3">'+subj+'</div>'+
          '</div></td>';
      });
    /* wl(범례) 색상 교체 및 휴일 항목 제거 */
    if(wl[wk]){
      for(var oc2 in oldColors){
        wl[wk]=wl[wk].split('background:'+oc2+'"').join('background:'+oldColors[oc2]+'"');
      }
      /* #95A5A6 (휴일/행사) 범례 항목 제거 */
      wl[wk]=wl[wk].replace(/<div class="li"><span class="ld" style="background:#95A5A6"><\/span>[\s\S]*?<\/div>/g,'');
    }
  }
  var t=today();
  for(var i=0;i<wks.length;i++){
    var v=wvals(wks[i]).sort();
    if(v.length&&t>=v[0]&&t<=v[v.length-1]){ci=i;break;}
  }
  var nd=new Date();cy=nd.getFullYear();cm2=nd.getMonth();

  document.getElementById('pb').onclick=function(){if(ci>0){ci--;render();}};
  document.getElementById('nb').onclick=function(){if(ci<wks.length-1){ci++;render();}};
  document.getElementById('bn-d').onclick=function(){setView('dashboard');};
  document.getElementById('bn-w').onclick=function(){goTodayWeek();setView('weekly');};
  document.getElementById('bn-f').onclick=function(){setView('filter');};
  document.getElementById('theme-btn').onclick=cycleTheme;updThemeBtn();
  document.getElementById('cal-btn').onclick=function(){openCal();};
  document.getElementById('cal-x').onclick=function(){closeCal();};
  document.getElementById('ovl').onclick=function(e){if(e.target===document.getElementById('ovl'))closeCal();};
  document.getElementById('cal-p').onclick=function(){cm2--;if(cm2<0){cm2=11;cy--;}renderCal();};
  document.getElementById('cal-n').onclick=function(){cm2++;if(cm2>11){cm2=0;cy++;}renderCal();};

  /* 엑셀 업로드 */
  var xlBtn=document.getElementById('xl-btn-open');if(xlBtn)xlBtn.onclick=openXL;
  document.getElementById('xl-x').onclick=closeXL;
  document.getElementById('xl-ovl').onclick=function(e){if(e.target===document.getElementById('xl-ovl'))closeXL();};

  var dropzone=document.getElementById('xl-drop');
  var fileInput=document.getElementById('xl-file');
  dropzone.onclick=function(){fileInput.click();};
  fileInput.onchange=function(){if(fileInput.files[0])handleFile(fileInput.files[0]);};
  dropzone.ondragover=function(e){e.preventDefault();dropzone.classList.add('drag');};
  dropzone.ondragleave=function(){dropzone.classList.remove('drag');};
  dropzone.ondrop=function(e){
    e.preventDefault();dropzone.classList.remove('drag');
    var f=e.dataTransfer&&e.dataTransfer.files[0];
    if(f)handleFile(f);
  };

  /* xl-apply는 admOpenUpload에서도 바인딩되지만 기본 핸들러 설정 */
  var applyEl=document.getElementById('xl-apply');
  if(applyEl && !applyEl._bound){
    applyEl._bound=true;
    applyEl.onclick=function(){
      if(!pendingData)return;
      var newItems=Array.isArray(pendingData)?pendingData:(pendingData.items||pendingData);
      var nWdd=(!Array.isArray(pendingData)&&pendingData.nativeWdd)||null;
      var nEd=(!Array.isArray(pendingData)&&pendingData.nativeEd)||null;
      merged.length=0;
      for(var _mi=0;_mi<newItems.length;_mi++) merged.push(newItems[_mi]);
      buildFromItems(merged,nWdd||wdd,nEd||ed);
      _subjColorMap=null;
      try{localStorage.setItem('timetable_data',JSON.stringify({items:merged,wdd:nWdd||wdd,ed:nEd||ed,grade:savedGrade,ts:Date.now()}));}catch(e){}
      ci=0;
      closeXL();
      if(isAdmin) renderAdminBody();
      else{render();}
    };
  }

  /* ── 학년 선택 & localStorage 복원 ── */
  savedGrade=localStorage.getItem('user_grade')||''; /* 전역변수에 저장 */
  var savedTimetable=null;
  /* 저장된 학년이 있으면 해당 학년의 시간표 키로 로드 */
  try{
    var _stKey=savedGrade?('timetable_data_'+savedGrade):'timetable_data';
    var _st=localStorage.getItem(_stKey);
    if(!_st&&savedGrade) _st=localStorage.getItem('timetable_data'); /* 폴백 */
    if(_st) savedTimetable=JSON.parse(_st);
  }catch(e){}

  function showGradeScreen(){document.getElementById('gs-screen').style.display='flex';}
  function hideGradeScreen(){document.getElementById('gs-screen').style.display='none';}
  function applyGrade(grade){
    /* 학년이 바뀌면 관리자 인증 초기화 */
    if(grade !== savedGrade && isAdmin){
      isAdmin = false;
      closeAdminPanel();
    }
    savedGrade=grade;
    localStorage.setItem('user_grade',grade);
    document.getElementById('grade-lbl').textContent=grade;
    var titleEl=document.getElementById('hdr-title');
    if(titleEl)titleEl.textContent='2026-1학기';
    hideGradeScreen();

    /* ── 학년별 시간표로 초기화 ── */
    /* 1) merged 초기화 */
    merged.length=0;
    _workingMerged=null;
    _subjColorMap=null;
    /* 2) 해당 학년 localStorage에서 복원 */
    var saved=null;
    try{
      var s=localStorage.getItem(ttKey());
      if(s) saved=JSON.parse(s);
    }catch(e){}
    if(saved&&saved.items&&saved.items.length){
      buildFromItems(saved.items, saved.wdd||{}, saved.ed||[]);
      saved.items.forEach(function(it){merged.push(it);});
    }
    render();
    /* 3) Firebase에서 최신 시간표 로드 */
    setTimeout(function(){
      stopFirebaseListener(); /* 이전 학년 리스너 해제 */
      loadFromFirebase();
      initFirebaseListener();
    }, 300);
  }

  /* 학년 카드 클릭 */
  var gsCards=document.querySelectorAll('.gs-card');
  for(var gi=0;gi<gsCards.length;gi++){
    gsCards[gi].onclick=(function(card){return function(){
      applyGrade(card.getAttribute('data-grade'));
    };})(gsCards[gi]);
  }

  /* 학년 변경 버튼 */
  document.getElementById('grade-btn').onclick=function(){showGradeScreen();};

  /* 저장된 학년 복원 */
  if(savedGrade){
    document.getElementById('grade-lbl').textContent=savedGrade;
  } else {
    showGradeScreen();
  }

  /* 저장된 시간표 복원 */
  if(savedTimetable&&savedTimetable.items&&savedTimetable.items.length){
    try{buildFromItems(savedTimetable.items,savedTimetable.wdd,savedTimetable.ed);}catch(e){}
  }

  /* 오늘 날짜 주차로 자동 이동 */
  (function(){
    var now=new Date();
    var dow=now.getDay(); /* 0=일,6=토 */
    var t;
    if(dow===6||dow===0){
      /* 토/일 → 다음주 월요일 날짜 계산 */
      var diff=dow===6?2:1; /* 토→+2일, 일→+1일 */
      var nextMon=new Date(now.getTime()+diff*24*60*60*1000);
      t=nextMon.getFullYear()+'-'+p2(nextMon.getMonth()+1)+'-'+p2(nextMon.getDate());
    } else {
      t=today();
    }
    for(var i=0;i<wks.length;i++){
      var v=wvals(wks[i]).sort();
      if(v.length&&t>=v[0]&&t<=v[v.length-1]){ci=i;break;}
    }
    /* 해당 날짜가 시간표 범위를 벗어나면 마지막 주로 */
    if(ci===0){
      /* 범위 전이면 0, 범위 후이면 마지막 주 */
      var lastV=wvals(wks[wks.length-1]).sort();
      if(t>lastV[lastV.length-1]) ci=wks.length-1;
    }
  })();

  setView(vw); /* 초기 뷰 렌더 + 하단 네비/주차 네비 동기화 */

  /* iOS Safari 홈 화면 미추가 시 안내 토스트 */
  var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone=window.navigator.standalone===true;
  if(isIOS&&!isStandalone&&!sessionStorage.getItem('pwa_shown')){
    setTimeout(function(){
      var t=document.getElementById('pwa-toast');
      if(t){t.style.display='block';}
      sessionStorage.setItem('pwa_shown','1');
      setTimeout(function(){var t2=document.getElementById('pwa-toast');if(t2)t2.style.display='none';},7000);
    },2500);
  }
}

init();


/* ── 초기화 ── */
setTimeout(function(){
  var fab=document.getElementById('admin-fab');
  if(fab){fab.style.display='none';fab.onclick=function(){openAdminPanel();};}
  var cb=document.getElementById('admin-panel-close');
  if(cb) cb.onclick=function(){closeAdminPanel();};
},500);





/* ── 초기화 ── */
setTimeout(function(){
  var fab=document.getElementById('admin-fab');
  if(fab){fab.style.display='none';fab.onclick=function(){openAdminPanel();};}
  var cb=document.getElementById('admin-panel-close');
  if(cb)cb.onclick=function(){closeAdminPanel();};
  /* Firebase 리스너 시작 (비관리자) */
  if(!isAdmin){
    setTimeout(function(){
      loadFromFirebase();
      startFirebaseListener();
    },1500);
  }
},500);




