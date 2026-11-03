/* ── 같은 학년 초대 링크 ──
   주소: https://sehyunlee.vercel.app/?join=<학교키>-<학년 순번>   예) ?join=cnu-2 (충남대 의학과 1학년)
   - 처음 여는 사람: 학교·학년을 미리 저장해 두고 바로 그 학년 시간표로 시작 (학교 지도·학년 휠을 건너뜀)
   - 이미 쓰는 사람: 다른 학교·학년이면 바꿀지 한 번 묻고, 같으면 아무것도 안 함
   app.js가 학년을 읽기 전에 실려야 하므로 config.js 바로 뒤에 둔다. */
var INVITE_BASE='https://sehyunlee.vercel.app/';
var _inviteAsk=null; /* 이미 쓰는 사람에게 물어볼 {school,grade} */

function inviteParse(){
  var m=/[?&]join=([a-z0-9]+)-(\d+)/i.exec(location.search||'');
  if(!m||typeof SCHOOLS==='undefined')return null;
  var sc=SCHOOLS[m[1].toLowerCase()],gi=parseInt(m[2],10);
  if(!sc||!sc.grades||!sc.grades[gi])return null;
  return {school:m[1].toLowerCase(),grade:sc.grades[gi].label};
}
/* 지금 학교·학년의 초대 주소 (학년 순번은 SCHOOLS 순서) */
function inviteUrl(){
  var s=(typeof savedSchool!=='undefined'&&savedSchool)||'jbnu',sc=SCHOOLS[s];
  if(!sc||typeof savedGrade==='undefined'||!savedGrade)return'';
  for(var i=0;i<sc.grades.length;i++)if(sc.grades[i].label===savedGrade)return INVITE_BASE+'?join='+s+'-'+i;
  return'';
}
(function(){
  var inv=inviteParse();
  if(!inv)return;
  /* 주소창에서 초대 파라미터는 지워 둠 (새로고침해도 다시 묻지 않게) */
  try{history.replaceState(null,'',location.pathname+location.hash);}catch(e){}
  var cur='',curG='';
  try{cur=localStorage.getItem('user_school')||'';curG=localStorage.getItem('user_grade')||'';}catch(e){}
  if(!curG){
    try{
      localStorage.setItem('user_school',inv.school);localStorage.setItem('user_grade',inv.grade);
      localStorage.setItem('tour_pending','1'); /* 첫 실행 안내는 그대로 보여 주게 */
    }catch(e){}
    return;
  }
  if((cur||'jbnu')===inv.school&&curG===inv.grade)return;
  _inviteAsk=inv;
})();

/* 이미 쓰는 사람: 화면이 뜬 뒤 바꿀지 묻는 카드 */
function inviteAskShow(){
  var inv=_inviteAsk;if(!inv)return;_inviteAsk=null;
  var sc=SCHOOLS[inv.school];
  var ov=document.createElement('div');ov.className='tour-ov on';ov.style.background='rgba(0,0,0,.45)';
  ov.innerHTML='<div class="tour-card" role="dialog" style="top:50%;transform:translateY(-50%)">'
    +'<div class="tour-step">초대 링크</div>'
    +'<div class="tour-ttl">'+escHtml(sc.name+' '+inv.grade)+' 시간표로 바꿀까요?</div>'
    +'<div class="tour-txt">지금은 '+escHtml((SCHOOLS[savedSchool||'jbnu']||{}).name||'')+' '+escHtml(savedGrade||'')+' 시간표를 보고 있어요. 공부 기록은 그대로 남아요.</div>'
    +'<div class="tour-btns"><button class="tour-skip" id="inv-no">그대로 두기</button><button class="tour-next" id="inv-yes">바꾸기</button></div></div>';
  document.body.appendChild(ov);
  document.getElementById('inv-no').onclick=function(){ov.parentNode.removeChild(ov);};
  document.getElementById('inv-yes').onclick=function(){
    try{localStorage.setItem('user_school',inv.school);localStorage.setItem('user_grade',inv.grade);}catch(e){}
    location.reload();
  };
}
(function(){
  if(!_inviteAsk)return;
  var n=0;(function wait(){
    var m=document.getElementById('main');
    if(m&&m.children.length&&typeof savedGrade!=='undefined'&&savedGrade){setTimeout(inviteAskShow,500);return;}
    if(++n<40)setTimeout(wait,250);
  })();
})();

/* 친구 초대: 공유 시트(지원하면) 또는 주소 복사 */
function inviteShare(){
  var url=inviteUrl();if(!url)return;
  var sc=SCHOOLS[savedSchool||'jbnu'];
  var title=sc.name+' '+savedGrade+' 시간표';
  var text=title+' — 메디캠퍼스에서 바로 볼 수 있어요.\n아이폰은 앱스토어에서 \'메디캠퍼스\'를 받아도 돼요.';
  if(navigator.share){
    navigator.share({title:title,text:text,url:url}).catch(function(){});
    return;
  }
  inviteCopy(text+'\n'+url);
}
function inviteCopy(s){
  function done(ok){if(typeof xlToast==='function')xlToast(ok?'초대 링크를 복사했어요 · 학년 단톡방에 붙여 넣으세요':'복사하지 못했어요');}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(function(){done(true);},function(){done(false);});return;}
  try{var ta=document.createElement('textarea');ta.value=s;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    var ok=document.execCommand('copy');document.body.removeChild(ta);done(ok);}catch(e){done(false);}
}
