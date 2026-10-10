/* ══════════════════════════════════════════
   학교 선택 화면의 전국 지도
   - 윤곽: Natural Earth 1:50m(퍼블릭 도메인) 대한민국 본토·제주 등을 단순 투영한 SVG 경로
   - 점: 각 의과대학 캠퍼스의 대략적인 위도·경도
   scMapHtml() → 마크업, scMapInit(onPick) → 누르면 가까운 학교(들)를 고름, scMapSelect(key) → 선택 표시
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
function scMapHtml(){
  var h='<div class="sc-map"><svg class="sc-map-svg" id="sc-map-svg" viewBox="0 0 315 570" aria-label="전국 의과대학 지도">'
    +'<path class="sc-map-land" d="'+SC_MAP_PATH+'"/>';
  SCHOOL_ORDER.forEach(function(k){
    var p=scMapXY(k);if(!p)return;
    h+='<circle class="sc-map-dot" data-k="'+k+'" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="6"/>';
  });
  h+='<circle class="sc-map-sel" id="sc-map-sel" cx="-99" cy="-99" r="11"/></svg>'
    +'<div class="sc-map-side"><div class="sc-map-hint" id="sc-map-hint">지도에서 지역을 누르면<br>근처 학교가 나와요</div>'
    +'<div class="sc-map-chips" id="sc-map-chips"></div></div></div>';
  return h;
}
function scMapSelect(key){
  var s=document.getElementById('sc-map-sel'),p=scMapXY(key);
  if(!s||!p)return;
  s.setAttribute('cx',p[0].toFixed(1));s.setAttribute('cy',p[1].toFixed(1));
}
function scMapInit(onPick){
  var svg=document.getElementById('sc-map-svg');if(!svg)return;
  svg.onclick=function(e){
    var r=svg.getBoundingClientRect();
    /* preserveAspectRatio 기본(xMidYMid meet): 실제 그려진 영역 기준으로 좌표 변환 */
    var sc=Math.min(r.width/315,r.height/570),ox=r.left+(r.width-315*sc)/2,oy=r.top+(r.height-570*sc)/2;
    var x=(e.clientX-ox)/sc,y=(e.clientY-oy)/sc;
    var near=null,nd=1e9;
    SCHOOL_ORDER.forEach(function(k){var p=scMapXY(k);if(!p)return;var d=Math.hypot(p[0]-x,p[1]-y);if(d<nd){nd=d;near=k;}});
    if(!near||nd>70)return;
    /* 가장 가까운 학교 주변(약 45km)의 학교를 함께 보여줌 */
    var c=scMapXY(near),list=SCHOOL_ORDER.filter(function(k){var p=scMapXY(k);return p&&Math.hypot(p[0]-c[0],p[1]-c[1])<=40;});
    var hint=document.getElementById('sc-map-hint'),chips=document.getElementById('sc-map-chips');
    if(hint)hint.style.display='none';
    if(chips){
      chips.innerHTML=list.map(function(k){
        return '<button class="sc-map-chip'+(k===near?' on':'')+'" data-k="'+k+'">'+escHtml(SCHOOLS[k].name.replace(/학교/,''))+'</button>';
      }).join('');
      Array.prototype.forEach.call(chips.querySelectorAll('.sc-map-chip'),function(b){
        b.onclick=function(){
          Array.prototype.forEach.call(chips.querySelectorAll('.sc-map-chip'),function(o){o.className='sc-map-chip';});
          this.className='sc-map-chip on';
          onPick(this.getAttribute('data-k'));
        };
      });
    }
    onPick(near);
  };
}
