/* ══════════════════════════════════════════
   헤더 & 렌더
══════════════════════════════════════════ */
function updHdr(){
  var w=wks[ci];
  document.getElementById('wl').textContent=(w||'-')+'주차';
  document.getElementById('pb').disabled=(ci===0);
  document.getElementById('nb').disabled=(ci===wks.length-1);
}

function goTodayWeek(){
  /* 토/일이면 다음 주 월요일 기준 → 주말엔 다음 주 시간표 */
  var now=new Date(),dow=now.getDay(),t;
  if(dow===6||dow===0){
    var nm=new Date(now.getTime()+(dow===6?2:1)*86400000);
    t=nm.getFullYear()+'-'+p2(nm.getMonth()+1)+'-'+p2(nm.getDate());
  }else t=today();
  for(var i=0;i<wks.length;i++){
    var v=wvals(wks[i]).sort();
    if(!v.length)continue;
    if(t>=v[0]&&t<=v[v.length-1]){ci=i;return;}
    if(t<v[0]){ci=i;return;} /* 주 사이 공백·개강 전 → 다가오는 주 */
  }
  if(wks.length)ci=wks.length-1; /* 종강 후 → 마지막 주 */
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
/* 뷰 진입 애니메이션 — 잠깐 .anim을 켜서 새로 그려지는 요소만 등장 모션 */
var _animT=null;
function animMain(){
  var m=document.getElementById('main');if(!m)return;
  m.classList.remove('anim');
  void m.offsetWidth;
  m.classList.add('anim');
  if(_animT)clearTimeout(_animT);
  _animT=setTimeout(function(){m.classList.remove('anim');},500);
}
function setView(v){
  vw=v;
  animMain();
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
  if(ci<0||ci>=wks.length)goTodayWeek(); /* 주차 구성 변경 후 인덱스 안전장치 */
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
  goTodayWeek();
  var nd=new Date();cy=nd.getFullYear();cm2=nd.getMonth();

  document.getElementById('pb').onclick=function(){if(ci>0){ci--;animMain();render();}};
  document.getElementById('nb').onclick=function(){if(ci<wks.length-1){ci++;animMain();render();}};
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
      /* 학교·학년별 키로 저장 (개인 업로드 영속화) */
      try{localStorage.setItem(ttKey(),JSON.stringify({items:merged,wdd:nWdd||wdd,ed:nEd||ed,grade:savedGrade,ts:Date.now()}));}catch(e){}
      goTodayWeek();
      closeXL();
      if(isAdmin) renderAdminBody();
      else{render();}
    };
  }

  /* ── 학년 선택 & localStorage 복원 ── */
  savedGrade=localStorage.getItem('user_grade')||''; /* 전역변수에 저장 */
  savedSchool=localStorage.getItem('user_school')||'';
  /* 마이그레이션: 기존(전북대 전용) 사용자는 학교 미설정 → jbnu */
  if(!savedSchool&&savedGrade){
    savedSchool='jbnu';
    try{localStorage.setItem('user_school','jbnu');}catch(e){}
  }
  var savedTimetable=null;
  /* 저장된 학년이 있으면 해당 학년의 시간표 키로 로드 */
  try{
    var _st=localStorage.getItem(ttKey()); /* 학교·학년 키 (jbnu는 레거시 키와 동일) */
    if(!_st&&savedGrade) _st=localStorage.getItem('timetable_data'); /* 구버전 폴백 */
    if(_st) savedTimetable=JSON.parse(_st);
  }catch(e){}
  /* 타 학교 사용자: 전북대 레거시 번들 데이터가 보이지 않게 초기화 */
  if((savedSchool||'jbnu')!=='jbnu'&&!(savedTimetable&&savedTimetable.items&&savedTimetable.items.length)){
    merged=[];wks=[];wdd={};ed=[];wh={};wl={};fsubj=[];fsubj2=[];
  }

  var GS_IC='<span class="gs-ic"><svg viewBox="0 0 24 24" fill="none" stroke="#3182F6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.3C10.4 5 8 4.5 5 4.7v12c3-.2 5.4.3 7 1.6 1.6-1.3 4-1.8 7-1.6v-12c-3-.2-5.4.3-7 1.6z"/><path d="M12 6.3v12"/></svg></span>';

  /* 학교 선택 화면 */
  function showSchoolScreen(){
    var grid=document.getElementById('sc-grid');
    var h='';
    SCHOOL_ORDER.forEach(function(k){
      var sc=SCHOOLS[k];
      h+='<div class="gs-card sc-card'+(savedSchool===k?' sel':'')+'" data-school="'+k+'">'
        +'<div class="gs-name">'+sc.name+'</div>'
        +'<div class="gs-desc">'+sc.dept+'</div></div>';
    });
    grid.innerHTML=h;
    grid.querySelectorAll('.sc-card').forEach(function(c){
      c.onclick=function(){
        savedSchool=this.getAttribute('data-school');
        try{localStorage.setItem('user_school',savedSchool);}catch(e){}
        document.getElementById('sc-screen').style.display='none';
        showGradeScreen();
      };
    });
    document.getElementById('sc-screen').style.display='flex';
  }

  /* 학년 선택 화면 — 현재 학교의 학년 목록으로 렌더 */
  function showGradeScreen(){
    var sc=SCHOOLS[savedSchool||'jbnu'];
    document.getElementById('gs-title').textContent=sc.name+' '+sc.dept;
    var grid=document.getElementById('gs-grid');
    grid.style.gridTemplateColumns='repeat('+Math.min(sc.grades.length,3)+',1fr)';
    var h='';
    sc.grades.forEach(function(g){
      h+='<div class="gs-card" data-grade="'+g.label+'">'+GS_IC
        +'<div class="gs-name">'+g.label+'</div>'
        +(g.desc?'<div class="gs-desc">'+g.desc+'</div>':'')+'</div>';
    });
    grid.innerHTML=h;
    grid.querySelectorAll('.gs-card').forEach(function(c){
      c.onclick=function(){applyGrade(this.getAttribute('data-grade'));};
    });
    document.getElementById('gs-screen').style.display='flex';
  }
  function hideGradeScreen(){document.getElementById('gs-screen').style.display='none';}
  document.getElementById('gs-school-change').onclick=function(){
    hideGradeScreen();showSchoolScreen();
  };

  /* 분반 선택 화면 (학년 선택 직후, gs-screen과 동일한 룩) */
  function showSectionScreen(){
    var r=secRule();if(!r)return;
    var sc=document.getElementById('sec-screen');
    var grid=document.getElementById('sec-grid');
    document.getElementById('sec-title').textContent=r.label+' 선택';
    var cur=secSel(),h='';
    for(var i=0;i<r.days.length;i++){
      var d=r.days[i];
      h+='<div class="gs-card sec-card'+(cur===d?' sel':'')+'" data-sec="'+d+'">'
        +'<div class="gs-name">'+d+'반</div>'
        +'<div class="gs-desc">'+d+'요일 실습</div></div>';
    }
    grid.innerHTML=h;
    var cards=grid.querySelectorAll('.sec-card');
    for(var j=0;j<cards.length;j++){
      cards[j].onclick=function(){
        secSet(this.getAttribute('data-sec'));
        sc.style.display='none';
        buildFromItems(merged,wdd,ed);
        render();
      };
    }
    sc.style.display='flex';
  }
  function applyGrade(grade){
    /* 학년이 바뀌면 관리자 인증 초기화 */
    if(grade !== savedGrade && isAdmin){
      isAdmin = false;
      closeAdminPanel();
    }
    savedGrade=grade;
    localStorage.setItem('user_grade',grade);
    var gl=document.getElementById('grade-lbl');if(gl)gl.textContent=grade;
    hideGradeScreen();
    if(secRule())showSectionScreen(); /* 분반 있는 학년은 이어서 분반 선택 */

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
      /* buildFromItems가 merged를 saved.items로 교체함 — 별도 push 시 중복 */
      buildFromItems(saved.items, saved.wdd||{}, saved.ed||[]);
    }else{
      /* 데이터 없는 학교·학년: 레거시 번들 데이터 잔재 제거 */
      wks=[];wdd={};ed=[];wh={};wl={};ci=0;
    }
    goTodayWeek(); /* 학년(=주차 구성) 변경 → 주차 인덱스 재계산 */
    render();
    /* 3) Firebase에서 최신 시간표 로드 */
    setTimeout(function(){
      stopFirebaseListener(); /* 이전 학년 리스너 해제 */
      loadFromFirebase();
      initFirebaseListener();
    }, 300);
  }

  /* 학년 카드 클릭 */
  /* 학년 변경 버튼 → 현재 학교의 학년 화면 (학교 변경 링크 포함) */
  document.getElementById('grade-btn').onclick=function(){showGradeScreen();};

  /* 저장된 학교·학년 복원 */
  if(savedGrade){
    var gl0=document.getElementById('grade-lbl');if(gl0)gl0.textContent=savedGrade;
  } else if(savedSchool){
    showGradeScreen();
  } else {
    showSchoolScreen(); /* 신규 사용자: 학교부터 */
  }

  /* 저장된 시간표 복원 */
  if(savedTimetable&&savedTimetable.items&&savedTimetable.items.length){
    try{buildFromItems(savedTimetable.items,savedTimetable.wdd,savedTimetable.ed);}catch(e){}
  }

  /* 오늘 날짜 주차로 자동 이동 (주말이면 다음 주) */
  goTodayWeek();

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




