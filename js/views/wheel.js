/* ══════════════════════════════════════════
   휠 선택기 (iOS 피커 느낌)
   wheelHtml(id, items) → 마크업, wheelInit(id, value, onChange) → 스크롤 연동
   items: [{v:'값', t:'제목', d:'설명(선택)'}]
══════════════════════════════════════════ */
var WHEEL_ITEM_H=46;

function wheelHtml(id,items){
  var h='<div class="wheel" id="'+id+'"><div class="wheel-band"></div>';
  h+='<div class="wheel-scroll" id="'+id+'-s">';
  items.forEach(function(it){
    h+='<div class="wheel-item" data-v="'+escHtml(it.v)+'">'
      +'<span class="wheel-t">'+escHtml(it.t)+'</span>'
      +(it.d?'<span class="wheel-d">'+escHtml(it.d)+'</span>':'')
      +'</div>';
  });
  h+='</div></div>';
  return h;
}

/* value: 처음 선택할 값(없으면 첫 항목). onChange(value)는 멈춘 뒤 호출 */
function wheelInit(id,value,onChange){
  var sc=document.getElementById(id+'-s');
  if(!sc)return;
  var items=sc.querySelectorAll('.wheel-item');
  if(!items.length)return;
  if(!sc.clientHeight){ /* 화면이 아직 안 보이면 다음 프레임에 다시 */
    requestAnimationFrame(function(){wheelInit(id,value,onChange);});
    return;
  }
  var pad=Math.max(0,(sc.clientHeight-WHEEL_ITEM_H)/2);
  sc.style.paddingTop=pad+'px';sc.style.paddingBottom=pad+'px';

  var cur=-1,t=null;
  function mark(i,fire){
    if(i<0)i=0;if(i>items.length-1)i=items.length-1;
    if(i===cur)return;
    cur=i;
    for(var j=0;j<items.length;j++)items[j].className='wheel-item'+(j===i?' on':'');
    if(fire&&onChange)onChange(items[i].getAttribute('data-v'));
  }
  function onScroll(){
    var i=Math.round(sc.scrollTop/WHEEL_ITEM_H);
    mark(i,true);
    if(t)clearTimeout(t);
    t=setTimeout(function(){t=null;},80);
  }
  sc.addEventListener('scroll',onScroll,{passive:true});
  /* 항목을 직접 눌러도 선택 */
  for(var k=0;k<items.length;k++){
    items[k].onclick=(function(idx){return function(){
      sc.scrollTo({top:idx*WHEEL_ITEM_H,behavior:'smooth'});
    };})(k);
  }
  var start=0;
  for(var m=0;m<items.length;m++)if(items[m].getAttribute('data-v')===value)start=m;
  sc.scrollTop=start*WHEEL_ITEM_H;
  mark(start,true);
}

/* 현재 선택값 */
function wheelValue(id){
  var sc=document.getElementById(id+'-s');
  if(!sc)return null;
  var items=sc.querySelectorAll('.wheel-item');
  var i=Math.round(sc.scrollTop/WHEEL_ITEM_H);
  if(i<0)i=0;if(i>items.length-1)i=items.length-1;
  return items[i]?items[i].getAttribute('data-v'):null;
}
