/* ══════════════════════════════════════════
   학교 선택 화면의 전국 지도
   - 윤곽: Natural Earth 1:50m(퍼블릭 도메인) 대한민국 본토·제주 등을 단순 투영한 SVG 경로
   - 점: 각 의과대학 캠퍼스의 대략적인 위도·경도
   scPickerHtml() → 마크업, scPickerInit(현재 학교, onChange) → 지역·검색·목록 연동, scPickerValue() → 고른 학교
   지도는 지역 선택기: 누른 곳의 지역 학교만 아래 목록에 남는다. 점이 채워진 학교는 기본 시간표가 있는 곳
   (Firebase timetable 키를 한 번 읽어서 표시).
══════════════════════════════════════════ */
var SC_MAP_PATH='M59.4,96.8 61.9,94.9 62,92.2 62,83.3 69.1,77.1 79.2,64.4 84.1,57.4 89.8,50.9 96.3,46.6 102.7,44.5 112.8,43.7 132.1,44.5 135.9,43.8 149.3,43.1 152.5,44.2 162.2,45 173,44.1 178.5,42.3 183.5,39.1 187.9,33.3 192.5,22.6 197.4,14.2 200.2,12.7 220,57.4 238.9,86.3 255,107.2 277.9,147.5 284.6,169.1 285.3,182.4 289.1,200.8 285.8,211.3 286.8,227.9 285.4,236.5 282.6,242.7 282.5,254.8 283.4,261.2 283.4,269.8 285.2,273.1 287.9,274.4 292,271.2 297.1,269.9 296.2,280.2 290.1,306.3 284.7,325.2 277.4,341.7 268.1,356.8 257,362.7 249.2,364.8 234.3,365.6 221.9,363 211.2,364.9 207,368.1 203.8,373.4 206.1,381.8 205.8,388 201.3,387.5 192.2,383.9 182.2,383.4 177.5,381.6 172.8,372.8 168,373.1 159.6,378.4 146.8,379.5 142.3,382.4 140.7,386 142.6,390.7 149,396.7 146.9,402.9 140.2,406 134.7,398.4 131.4,391 127.6,390.6 121.7,392.7 120.5,400.7 123.2,406.2 127.8,412.5 121.4,419.7 119.8,424.9 115.3,428.7 103,420.4 104.8,414.5 110.1,408.8 110.7,403 109,399.5 91.5,414.3 80.7,431.1 74.9,429.9 72.5,425.6 69.2,423.8 57.5,434.6 55.4,443.2 51.1,443.6 49.2,439.9 49.1,432.2 47.1,425.6 35,416 29.5,407.7 32.4,403 42.5,405.5 50.5,405.2 48.9,401.2 46.3,399.4 51.7,397.1 56.1,392.6 52.4,391.3 46.8,394 42.1,392.7 40.3,381.7 34.6,370.5 31.6,359.6 37.3,353.3 40.1,343.6 45.3,329.4 48,324.9 55.2,321.6 57.8,317.9 53.8,316 47.5,314.4 47.6,310.3 51.9,308.1 56.8,303.6 66.1,298.1 69,287.8 66.3,285.2 60.5,282.8 61.8,277.5 64.2,273.6 63.3,271.2 56.4,264.5 51.8,258.4 53.2,251.4 52.1,240.9 52.7,232 52.4,227.2 49.1,216.4 47.5,205.6 43.1,207.2 39.5,209.9 26.8,206.1 22.7,205.8 21.1,197.8 25.7,187.9 36.5,179.2 42.8,178.1 47.5,174.3 54.8,173 63.6,179 71.6,180.2 75.9,190.4 78.6,192.6 79.2,188.8 85.6,184.4 87.1,181.1 85.7,179.2 78.4,177.4 71.8,164.7 70.9,159.2 68.5,155.6 72,145.5 64.4,133.9 60.7,130.3 61.2,119.9 57.2,113.3 55,109.6 53.7,103.3 54.8,100.5 58.3,99.5 59.4,96.8ZM34.5,552.6 30.9,554.8 27.5,553.5 26.6,552.5 22.5,546.7 21.5,543.8 24.2,538.2 35.4,529 64.4,520.1 69.6,519.7 81,523.5 83.4,530.6 81.3,536.8 78.7,540.9 65.5,547.8 55.2,551.2 34.5,552.6ZM229.8,395.1 222.2,401.3 211.9,393 209.5,388.5 217.3,381.8 223.9,374.1 228.3,373.6 229.8,395.1ZM175.2,394.4 174.3,404.2 168.6,404.7 165.2,398.4 161.6,401.5 159.7,401.5 156.8,393.7 156.3,387.5 163.1,382.9 167.1,385.7 173,387.1 175.2,394.4ZM27,437.9 21.8,439.5 18.9,436 16.9,435.1 18,430.6 26.5,421.7 28.1,418.7 35.9,420.5 38.8,425.2 35.2,432.4 27,437.9Z';
/* [위도, 경도] */
var SCHOOL_GEO={
  gachon:[37.45,126.70],cuk:[37.50,127.00],kangwon:[37.87,127.74],konkuk:[36.95,127.91],konyang:[36.31,127.34],
  knu:[35.87,128.60],gnu:[35.18,128.09],khu:[37.59,127.05],kmu:[35.85,128.48],korea:[37.59,127.03],
  kosin:[35.08,129.01],dku:[36.84,127.17],dcu:[35.84,128.57],dongguk:[35.86,129.19],donga:[35.12,129.02],
  pnu:[35.33,129.01],snu:[37.58,127.00],skku:[37.29,126.97],sch:[36.77,127.14],ajou:[37.28,127.04],
  yonsei:[37.56,126.94],yonseiwj:[37.35,127.95],yu:[35.85,128.58],ulsan:[35.54,129.26],wku:[35.97,126.96],
  eulji:[36.35,127.38],ewha:[37.56,126.84],inje:[35.15,129.02],inha:[37.45,126.65],jnu:[35.14,126.93],
  jbnu:[35.85,127.14],jeju:[33.46,126.56],chosun:[35.14,126.94],cau:[37.50,126.96],cha:[37.41,127.12],
  cnu:[36.32,127.42],cbnu:[36.63,127.46],hallym:[37.89,127.74],hanyang:[37.56,127.04],cku:[37.74,128.87]
};
function scMapXY(key){
  var g=SCHOOL_GEO[key];if(!g)return null;
  return[(g[1]-125.9)*Math.cos(36*Math.PI/180)*100,(38.75-g[0])*100];
}
/* 지역 → 학교 키 */
var SC_REGIONS=[
  {id:'cap',name:'수도권',keys:['gachon','cuk','khu','korea','snu','skku','ajou','yonsei','ewha','inha','cau','cha','hanyang']},
  {id:'gw',name:'강원',keys:['kangwon','yonseiwj','hallym','cku']},
  {id:'cc',name:'충청',keys:['konkuk','konyang','dku','sch','eulji','cnu','cbnu']},
  {id:'hn',name:'호남',keys:['wku','jnu','jbnu','chosun']},
  {id:'dg',name:'대구·경북',keys:['knu','kmu','dcu','dongguk','yu']},
  {id:'bu',name:'부산·울산·경남',keys:['gnu','kosin','donga','pnu','ulsan','inje']},
  {id:'jj',name:'제주',keys:['jeju']}
];
function scRegionOf(key){
  for(var i=0;i<SC_REGIONS.length;i++)if(SC_REGIONS[i].keys.indexOf(key)>=0)return SC_REGIONS[i].id;
  return '';
}
var _scp={region:'',q:'',sel:'',has:null,onChange:null};
/* 기본 시간표가 있는 학교 — timetable 아래 키 이름만 읽음(shallow). 실패하면 표시 없이 진행 */
function scLoadHas(cb){
  if(_scp.has){cb();return;}
  try{
    var c=sessionStorage.getItem('sc_has2');
    if(c){_scp.has=JSON.parse(c);cb();return;}
  }catch(e){}
  if(typeof fetch!=='function')return;
  fetch('https://jbnu-med-timetable-default-rtdb.firebaseio.com/timetable.json?shallow=true')
    .then(function(r){return r.json();}).then(function(j){
      /* has[학교] = 시간표가 있는 학년 이름 목록 */
      var has={},JB={premed2:'의예과 2학년',med1:'의학과 1학년',med2:'의학과 2학년'};
      Object.keys(j||{}).forEach(function(k){
        if(JB[k]){(has.jbnu=has.jbnu||[]).push(JB[k]);return;}
        var i=k.indexOf('_'),sc=k.slice(0,i);
        if(i>0&&SCHOOLS[sc])(has[sc]=has[sc]||[]).push(k.slice(i+1).replace(/_/g,' '));
      });
      _scp.has=has;
      try{sessionStorage.setItem('sc_has2',JSON.stringify(has));}catch(e){}
      cb();
    }).catch(function(){});
}
function scPickerHtml(){
  var h='<div class="scp-top"><svg class="scp-map" id="scp-map" viewBox="0 0 315 570" aria-label="전국 의과대학 지도">'
    +'<path class="scp-land" d="'+SC_MAP_PATH+'"/>';
  SCHOOL_ORDER.forEach(function(k){
    var p=scMapXY(k);if(!p)return;
    h+='<circle class="scp-dot" data-k="'+k+'" data-r="'+scRegionOf(k)+'" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="7"/>';
  });
  h+='<circle class="scp-ring" id="scp-ring" cx="-99" cy="-99" r="14"/></svg>';
  h+='<div class="scp-regions" id="scp-regions">'
    +'<button class="scp-reg" data-r=""><span>전체</span><b>'+SCHOOL_ORDER.length+'</b></button>';
  SC_REGIONS.forEach(function(r){
    h+='<button class="scp-reg" data-r="'+r.id+'"><span>'+r.name+'</span><b>'+r.keys.length+'</b></button>';
  });
  h+='</div></div>';
  h+='<input class="sc-q" id="sc-q" type="search" placeholder="학교 이름 검색" autocomplete="off" autocorrect="off" spellcheck="false">';
  h+='<div class="scp-legend"><span><i class="scp-lg on"></i>시간표 있음</span><span><i class="scp-lg"></i>파일을 올려서 시작</span></div>';
  h+='<div class="scp-list" id="scp-list"></div>';
  h+='<button class="gs-ok" id="sc-ok" disabled>학교를 골라주세요</button>';
  return h;
}
function scPickerValue(){return _scp.sel||null;}
function scPickerRender(){
  var has=_scp.has||{},q=_scp.q.replace(/\s+/g,'');
  /* 지역 버튼·지도 점 */
  Array.prototype.forEach.call(document.querySelectorAll('#scp-regions .scp-reg'),function(b){
    b.className='scp-reg'+(!q&&b.getAttribute('data-r')===_scp.region?' on':'');
  });
  Array.prototype.forEach.call(document.querySelectorAll('#scp-map .scp-dot'),function(d){
    var k=d.getAttribute('data-k'),dim=!q&&_scp.region&&d.getAttribute('data-r')!==_scp.region;
    d.setAttribute('class','scp-dot'+(has[k]?' has':'')+(dim?' dim':''));
  });
  var ring=document.getElementById('scp-ring'),sp=_scp.sel?scMapXY(_scp.sel):null;
  if(ring){ring.setAttribute('cx',sp?sp[0].toFixed(1):-99);ring.setAttribute('cy',sp?sp[1].toFixed(1):-99);}
  /* 목록: 검색어가 있으면 전체에서, 없으면 고른 지역만 */
  var keys=SCHOOL_ORDER.filter(function(k){
    if(q)return SCHOOLS[k].name.replace(/\s+/g,'').indexOf(q)>=0;
    return !_scp.region||scRegionOf(k)===_scp.region;
  });
  /* 시간표 있는 학교를 위로 */
  keys.sort(function(a,b){return (has[b]?1:0)-(has[a]?1:0);});
  var list=document.getElementById('scp-list');
  if(list){
    var h='';
    keys.forEach(function(k){
      var sc=SCHOOLS[k];
      h+='<button class="scp-row'+(k===_scp.sel?' on':'')+'" data-k="'+k+'">'
        +'<span class="scp-row-n">'+escHtml(sc.name)+'<i>'+escHtml(sc.dept)+'</i></span>'
        +(has[k]?'<span class="scp-badge">시간표 있음</span>':'')
        +'<span class="scp-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>';
    });
    if(!keys.length)h='<div class="scp-none">찾는 학교가 없어요. 의과대학 40곳만 들어 있어요.</div>';
    h+='<a class="scp-req" href="mailto:nsmed1113@jbnu.ac.kr?subject='+encodeURIComponent('[메디캠퍼스] 학과 추가 요청')+'">다른 학과(치의·한의·약학 등) 추가 요청</a>';
    list.innerHTML=h;
    Array.prototype.forEach.call(list.querySelectorAll('.scp-row'),function(b){
      b.onclick=function(){
        _scp.sel=this.getAttribute('data-k');
        scPickerRender();
        if(_scp.onChange)_scp.onChange(_scp.sel);
      };
    });
  }
  var ok=document.getElementById('sc-ok');
  if(ok){ok.disabled=!_scp.sel;ok.textContent=_scp.sel?SCHOOLS[_scp.sel].name+'로 시작':'학교를 골라주세요';}
}
function scPickerInit(current,onChange){
  _scp.sel=(current&&SCHOOLS[current])?current:'';
  _scp.region=_scp.sel?scRegionOf(_scp.sel):'';
  _scp.q='';_scp.onChange=onChange||null;
  scPickerRender();
  scLoadHas(scPickerRender);
  Array.prototype.forEach.call(document.querySelectorAll('#scp-regions .scp-reg'),function(b){
    b.onclick=function(){
      _scp.region=this.getAttribute('data-r');_scp.q='';
      var qi=document.getElementById('sc-q');if(qi)qi.value='';
      scPickerRender();
      var l=document.getElementById('scp-list');if(l)l.scrollTop=0;
    };
  });
  var q=document.getElementById('sc-q');
  if(q)q.oninput=function(){_scp.q=this.value;scPickerRender();};
  /* 지도를 누르면 그 자리에서 가장 가까운 학교의 지역을 고름 */
  var svg=document.getElementById('scp-map');
  if(svg)svg.onclick=function(e){
    var r=svg.getBoundingClientRect();
    var sc=Math.min(r.width/315,r.height/570),ox=r.left+(r.width-315*sc)/2,oy=r.top+(r.height-570*sc)/2;
    var x=(e.clientX-ox)/sc,y=(e.clientY-oy)/sc,near=null,nd=1e9;
    SCHOOL_ORDER.forEach(function(k){var p=scMapXY(k);if(!p)return;var d=Math.hypot(p[0]-x,p[1]-y);if(d<nd){nd=d;near=k;}});
    if(!near||nd>90)return;
    _scp.region=scRegionOf(near);_scp.q='';
    var qi=document.getElementById('sc-q');if(qi)qi.value='';
    scPickerRender();
    var l=document.getElementById('scp-list');if(l)l.scrollTop=0;
  };
}
/* 학년 선택 화면용: 이 학교에서 시간표가 있는 학년 이름들 (아직 못 읽었으면 빈 배열) */
function scGradesWithData(school){return (_scp.has&&_scp.has[school])||[];}
