/* ══════════════════════════════════════════
   메모 — 공부 탭 카드 (localStorage 'memos', 백업 동기화 대상)
══════════════════════════════════════════ */
var memos=[];
(function(){
  try{var s=localStorage.getItem('memos');if(s)memos=JSON.parse(s);}catch(e){}
})();
function memoSave(){try{localStorage.setItem('memos',JSON.stringify(memos));}catch(e){}}
var memoOpen=false;
function memoAdd(text){
  text=(text||'').trim();
  if(!text)return;
  memos.unshift({id:Date.now(),ts:Date.now(),text:text});
  memoSave();renderDashboard();
}
function memoDel(id){
  memos=memos.filter(function(m){return m.id!==id;});
  memoSave();renderDashboard();
}
function memoToggle(){memoOpen=!memoOpen;renderDashboard();}
function memoFmtTs(ts){
  var d=new Date(ts);
  return (d.getMonth()+1)+'/'+d.getDate();
}
function memoCardHtml(){
  var LIM=3;
  var show=memoOpen?memos.length:Math.min(memos.length,LIM);
  var h='<div class="dash-card">';
  h+='<div class="dash-card-ttl">메모'+(memos.length?'<span class="dash-card-count">'+memos.length+'</span>':'')+'</div>';
  if(!memos.length){
    h+='<div class="dash-exam-empty">메모가 없어요</div>';
  }else{
    h+='<div class="memo-list">';
    for(var i=0;i<show;i++){
      var m=memos[i];
      h+='<div class="memo-item">'
        +'<span class="memo-text">'+escHtml(m.text)+'</span>'
        +'<span class="memo-date">'+memoFmtTs(m.ts)+'</span>'
        +'<button class="memo-del" data-id="'+m.id+'">✕</button>'
        +'</div>';
    }
    h+='</div>';
    if(memos.length>LIM){
      h+='<button class="dash-exam-more" onclick="memoToggle()">'+(memoOpen?'접기':'+'+(memos.length-LIM)+'개 더보기')+'</button>';
    }
  }
  h+='<div class="memo-add-row">'
    +'<input class="memo-input" id="memo-input" placeholder="메모 추가" maxlength="200">'
    +'<button class="memo-add-btn" id="memo-add-btn">추가</button>'
    +'</div>';
  h+='</div>';
  return h;
}
function memoBind(){
  var inp=document.getElementById('memo-input');
  var btn=document.getElementById('memo-add-btn');
  if(btn)btn.onclick=function(){memoAdd(inp.value);};
  if(inp)inp.onkeydown=function(e){if(e.key==='Enter')memoAdd(inp.value);};
  var dels=document.querySelectorAll('.memo-del');
  for(var i=0;i<dels.length;i++){
    dels[i].onclick=function(){memoDel(parseInt(this.getAttribute('data-id'),10));};
  }
}
