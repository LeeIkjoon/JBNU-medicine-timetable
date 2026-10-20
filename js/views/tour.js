/* ── 첫 실행 안내 ──
   처음 설치한 사람이 학교·학년을 고르고 시간표 화면에 들어오면 한 번 띄운다.
   실제 화면 요소를 밝게 비추고(나머지는 어둡게) 아래·위에 짧은 설명 카드를 보여 준다.
   이미 쓰던 사람(이 파일이 처음 실린 시점에 학년이 저장돼 있던 기기)은 띄우지 않는다.
   다시 보기: tourStart() */
var TOUR_KEY='tour_done';
(function(){
  try{
    if(!localStorage.getItem(TOUR_KEY)&&localStorage.getItem('user_grade'))localStorage.setItem(TOUR_KEY,'1');
  }catch(e){}
})();

function tourSteps(){
  var st=[],jb=(typeof savedSchool==='undefined'||!savedSchool||savedSchool==='jbnu');
  var hasTT=typeof merged!=='undefined'&&merged.length>0;
  if(!hasTT){
    st.push({sel:'#empty-upload',ttl:'시간표 파일 올리기',
      txt:'학교에서 받은 엑셀·PDF 파일을 그대로 올리면 시간표가 만들어져요. 같은 학교·학년 친구들도 이 시간표를 함께 받아요.'});
  }else{
    st.push({sel:'#main .sw',ttl:'이번 주 시간표',
      txt:'좌우로 밀면 지난주·다음 주로 넘어가요. 수업 칸을 누르면 교수님을 확인하고, 바뀐 수업은 직접 고칠 수 있어요.'});
    st.push({sel:'#main .wk-todos',ttl:'날짜별 할 일',
      txt:'날짜 위 체크 아이콘을 누르면 그날 할 일을 적어 둘 수 있어요.'});
    if(!jb)st.push({sel:'#tt-upload',scroll:true,ttl:'시간표가 바뀌면',
      txt:'학교에서 새 파일을 받으면 여기서 다시 올려 주세요. 같은 학년 친구들 시간표도 함께 바뀌어요.'});
  }
  st.push({sel:'#bn-d',ttl:'공부',
    txt:'오늘 할 일을 적고 ▶를 누르면 공부 시간이 기록돼요. 날짜별 기록과 연속 공부일도 여기서 봐요.'});
  st.push({sel:'#bn-f',ttl:'필터',
    txt:'과목별 수업 시수와 수업 일정을 모아서 볼 수 있어요.'});
  return st;
}

var _tour=null;
function tourStart(){
  if(_tour)return;
  var steps=tourSteps().filter(function(s){var el=document.querySelector(s.sel);return el&&el.offsetParent!==null;});
  if(!steps.length)return;
  var ov=document.createElement('div');ov.className='tour-ov';
  ov.innerHTML='<div class="tour-hole"></div>'
    +'<div class="tour-card" role="dialog" aria-live="polite">'
    +'<div class="tour-step"></div><div class="tour-ttl"></div><div class="tour-txt"></div>'
    +'<div class="tour-btns"><button class="tour-skip">건너뛰기</button><button class="tour-next">다음</button></div>'
    +'</div>';
  document.body.appendChild(ov);
  _tour={ov:ov,steps:steps,i:0};
  ov.querySelector('.tour-skip').onclick=tourEnd;
  ov.querySelector('.tour-next').onclick=function(){
    if(_tour.i>=_tour.steps.length-1){tourEnd();return;}
    _tour.i++;tourShow();
  };
  window.addEventListener('resize',tourPlace);
  requestAnimationFrame(function(){ov.classList.add('on');tourShow();});
}
function tourShow(){
  if(!_tour)return;
  var s=_tour.steps[_tour.i],el=document.querySelector(s.sel),ov=_tour.ov;
  if(s.scroll&&el)el.scrollIntoView({block:'center'});
  ov.querySelector('.tour-step').textContent=(_tour.i+1)+' / '+_tour.steps.length;
  ov.querySelector('.tour-ttl').textContent=s.ttl;
  ov.querySelector('.tour-txt').textContent=s.txt;
  ov.querySelector('.tour-next').textContent=_tour.i>=_tour.steps.length-1?'시작하기':'다음';
  ov.querySelector('.tour-skip').style.visibility=_tour.i>=_tour.steps.length-1?'hidden':'';
  tourPlace();
}
/* 비출 영역과 카드 위치: 대상이 화면 아래쪽이면 카드를 위에, 아니면 아래에 */
function tourPlace(){
  if(!_tour)return;
  var s=_tour.steps[_tour.i],el=document.querySelector(s.sel),ov=_tour.ov;
  var hole=ov.querySelector('.tour-hole'),card=ov.querySelector('.tour-card');
  if(!el){hole.style.opacity='0';return;}
  var r=el.getBoundingClientRect(),vh=window.innerHeight,pad=6;
  /* 화면보다 큰 대상(시간표 표)은 보이는 부분만 */
  var top=Math.max(r.top-pad,8),bot=Math.min(r.bottom+pad,vh-8);
  hole.style.opacity='1';
  hole.style.left=(r.left-pad)+'px';hole.style.top=top+'px';
  hole.style.width=(r.width+pad*2)+'px';hole.style.height=Math.max(0,bot-top)+'px';
  var below=(top+bot)/2<vh*0.5;
  card.classList.toggle('top',!below);
  if(below){card.style.top=Math.min(bot+12,vh-card.offsetHeight-12)+'px';card.style.bottom='';}
  else{card.style.bottom=Math.max(vh-top+12,12)+'px';card.style.top='';}
  /* 표 전체처럼 화면을 거의 다 덮는 대상이면 카드를 아래에 겹쳐 띄움 */
  if(bot-top>vh*0.6){card.style.top='';card.style.bottom='calc(96px + env(safe-area-inset-bottom))';}
}
function tourEnd(){
  if(!_tour)return;
  var ov=_tour.ov;_tour=null;
  try{localStorage.setItem(TOUR_KEY,'1');}catch(e){}
  window.removeEventListener('resize',tourPlace);
  ov.classList.remove('on');
  setTimeout(function(){if(ov.parentNode)ov.parentNode.removeChild(ov);},250);
  if(typeof mainTop==='function')mainTop();
}
/* 첫 실행 흐름(로그인·학교·학년 화면)이 끝나고 시간표가 보이면 시작 */
(function(){
  var n=0;
  function hidden(id){var e=document.getElementById(id);return !e||e.style.display==='none'||e.style.display==='';}
  function tick(){
    var done=false;try{done=localStorage.getItem(TOUR_KEY)==='1';}catch(e){}
    if(done||++n>1200)return;
    var ready=document.visibilityState==='visible'
      &&(function(){try{return !!localStorage.getItem('user_grade');}catch(e){return false;}})()
      &&hidden('auth-screen')&&hidden('sc-screen')&&hidden('gs-screen')
      &&typeof vw!=='undefined'&&vw==='weekly'
      &&!document.querySelector('.xl-ovl.show,.xl-ovl.open');
    var m=document.getElementById('main');
    if(ready&&m&&m.children.length){setTimeout(function(){
      var d=false;try{d=localStorage.getItem(TOUR_KEY)==='1';}catch(e){}
      if(!d)tourStart();
    },700);return;}
    setTimeout(tick,500);
  }
  setTimeout(tick,800);
})();
