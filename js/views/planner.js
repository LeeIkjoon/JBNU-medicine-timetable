/* ══════════════════════════════════════════
   플래너
══════════════════════════════════════════ */
var plTodos=[];
(function(){
  try{var s=localStorage.getItem('pl_todos');if(s)plTodos=JSON.parse(s);}catch(e){}
})();
function plSave(){try{localStorage.setItem('pl_todos',JSON.stringify(plTodos));}catch(e){}}
function plTodayKey(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}

function renderPlanner(){
  var todayKey=plTodayKey();
  var todayItems=plTodos.filter(function(t){return t.date===todayKey;});
  var done=todayItems.filter(function(t){return t.done;}).length;
  var total=todayItems.length;

  var d=new Date();
  var WN2=['일','월','화','수','목','금','토'];
  var dateStr=d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일 ('+WN2[d.getDay()]+')';

  var h='<div class="pl-wrap">';
  h+='<div class="pl-date">📅 '+dateStr+'</div>';

  /* 통계 */
  h+='<div class="pl-stats">';
  h+='<div class="pl-stat"><div class="pl-stat-n">'+total+'</div><div class="pl-stat-l">전체</div></div>';
  h+='<div class="pl-stat"><div class="pl-stat-n" style="color:var(--success)">'+done+'</div><div class="pl-stat-l">완료</div></div>';
  h+='<div class="pl-stat"><div class="pl-stat-n" style="color:var(--warning)">'+(total-done)+'</div><div class="pl-stat-l">남음</div></div>';
  h+='</div>';

  /* 입력 */
  h+='<div class="pl-input-row">';
  h+='<input class="pl-input" id="pl-in" type="text" placeholder="할 일 추가..." maxlength="80">';
  h+='<button class="pl-add" id="pl-add-btn">추가</button>';
  h+='</div>';

  /* 목록 */
  h+='<div class="pl-list" id="pl-list">';
  if(!todayItems.length){
    h+='<div class="pl-empty">오늘의 할 일을 추가해보세요 ✏️</div>';
  } else {
    /* 미완료 먼저, 완료 나중 */
    var sorted=todayItems.slice().sort(function(a,b){return a.done-b.done;});
    for(var i=0;i<sorted.length;i++){
      var t=sorted[i];
      h+='<div class="pl-item" data-id="'+t.id+'">';
      h+='<button class="pl-chk'+(t.done?' done':'')+'" data-id="'+t.id+'"></button>';
      h+='<span class="pl-text'+(t.done?' done':'')+'">'+escHtml(t.text)+'</span>';
      h+='<button class="pl-del" data-id="'+t.id+'">🗑</button>';
      h+='</div>';
    }
  }
  h+='</div></div>';
  document.getElementById('main').innerHTML=h;

  /* 이벤트 */
  var inp=document.getElementById('pl-in');
  var addFn=function(){
    var txt=inp.value.trim();
    if(!txt)return;
    plTodos.push({id:Date.now()+''+Math.random(),date:todayKey,text:txt,done:false});
    plSave();inp.value='';renderPlanner();
    setTimeout(function(){var el=document.getElementById('pl-in');if(el)el.focus();},50);
  };
  document.getElementById('pl-add-btn').onclick=addFn;
  inp.onkeydown=function(e){if(e.key==='Enter')addFn();};

  var chks=document.querySelectorAll('.pl-chk');
  for(var ci2=0;ci2<chks.length;ci2++){
    chks[ci2].onclick=(function(id){return function(){
      for(var j=0;j<plTodos.length;j++)if(plTodos[j].id===id){plTodos[j].done=!plTodos[j].done;break;}
      plSave();renderPlanner();
    };})(chks[ci2].getAttribute('data-id'));
  }
  var dels=document.querySelectorAll('.pl-del');
  for(var di=0;di<dels.length;di++){
    dels[di].onclick=(function(id){return function(){
      plTodos=plTodos.filter(function(t){return t.id!==id;});
      plSave();renderPlanner();
    };})(dels[di].getAttribute('data-id'));
  }
}
