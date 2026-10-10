/* ══════════════════════════════════════════
   시간표 신고 — 공유 시간표(학교·학년 기본값)가 틀렸거나 부적절할 때.
   첫 업로드가 학년 전체의 기본 시간표가 되므로(upload.js xlShareRegister), 잘못 올라온 것을 알릴 통로가 필요하다.
   신고는 Firebase study/reports/<자동키>에 남는다: 학교·학년·사유·설명·시각·보낸 기기 코드·시간표 ts.
   확인은 tools/reports.py. 신고한 사람은 바로 자기 파일을 올려 쓸 수 있다(내 파일 모드 = 공유본 안 보기).
══════════════════════════════════════════ */
var RPT_REASONS=[
  {v:'wrong',t:'다른 학교·학년 시간표예요'},
  {v:'errors',t:'틀린 내용이 많아요'},
  {v:'old',t:'지난 학기 시간표예요'},
  {v:'bad',t:'부적절한 내용이 있어요'},
  {v:'etc',t:'그 밖의 문제'}
];
var _rptReason='';
function rptEnsure(){
  if(document.getElementById('rpt-ovl'))return;
  var d=document.createElement('div');
  d.className='cls-ovl';d.id='rpt-ovl';
  d.innerHTML='<div class="cls-sh rpt-sh" id="rpt-sh"></div>';
  document.body.appendChild(d);
  d.addEventListener('click',function(e){if(e.target===d)rptClose();});
}
function rptClose(){var o=document.getElementById('rpt-ovl');if(o)o.classList.remove('show');}
function rptOpen(){
  rptEnsure();_rptReason='';
  var sc=(typeof SCHOOLS!=='undefined'&&SCHOOLS[savedSchool||'jbnu'])||{name:''};
  var h='<div class="rpt-ttl">시간표 신고</div>'
    +'<div class="rpt-sub">'+escHtml(sc.name)+' '+escHtml(savedGrade||'')+' 시간표에 어떤 문제가 있나요?</div>'
    +'<div class="rpt-opts" id="rpt-opts">';
  RPT_REASONS.forEach(function(r){h+='<button class="rpt-opt" data-v="'+r.v+'">'+r.t+'</button>';});
  h+='</div>'
    +'<textarea class="rpt-text" id="rpt-text" maxlength="300" placeholder="어디가 틀렸는지 적어 주시면 더 빨리 고칠 수 있어요 (선택)"></textarea>'
    +'<div class="rpt-btns"><button class="rpt-btn" id="rpt-cancel">취소</button>'
    +'<button class="rpt-btn primary" id="rpt-send" disabled>신고하기</button></div>';
  var sh=document.getElementById('rpt-sh');sh.innerHTML=h;
  Array.prototype.forEach.call(sh.querySelectorAll('.rpt-opt'),function(b){
    b.onclick=function(){
      _rptReason=this.getAttribute('data-v');
      Array.prototype.forEach.call(sh.querySelectorAll('.rpt-opt'),function(o){o.className='rpt-opt'+(o===b?' on':'');});
      document.getElementById('rpt-send').disabled=false;
    };
  });
  document.getElementById('rpt-cancel').onclick=rptClose;
  document.getElementById('rpt-send').onclick=rptSend;
  document.getElementById('rpt-ovl').classList.add('show');
}
function rptSend(){
  if(!_rptReason)return;
  var btn=document.getElementById('rpt-send');btn.disabled=true;btn.textContent='보내는 중…';
  var ts=0;
  try{ts=(JSON.parse(localStorage.getItem(ttKey())||'{}').ts)||0;}catch(e){}
  var rec={school:savedSchool||'jbnu',grade:savedGrade||'',key:(typeof fbGradeKey==='function'?fbGradeKey(savedGrade):''),
    reason:_rptReason,text:(document.getElementById('rpt-text').value||'').trim().slice(0,300),
    ts:Date.now(),ttTs:ts,code:(typeof syncUid==='function'?syncUid():''),app:(typeof IS_APP!=='undefined'&&IS_APP)?1:0};
  function done(ok){
    var sh=document.getElementById('rpt-sh');
    if(!ok){btn.disabled=false;btn.textContent='신고하기';if(typeof xlToast==='function')xlToast('보내지 못했어요. 인터넷 연결을 확인해 주세요');return;}
    sh.innerHTML='<div class="rpt-ttl">신고를 접수했어요</div>'
      +'<div class="rpt-sub">확인한 뒤 고치거나 내릴게요. 그동안 학교에서 받은 파일을 올리면 내 기기에서는 그 시간표로 볼 수 있어요.</div>'
      +'<div class="rpt-btns"><button class="rpt-btn" id="rpt-ok">닫기</button>'
      +'<button class="rpt-btn primary" id="rpt-up">내 파일 올리기</button></div>';
    document.getElementById('rpt-ok').onclick=rptClose;
    document.getElementById('rpt-up').onclick=function(){rptClose();if(typeof openXL==='function')openXL();};
  }
  try{
    if(typeof fbDb==='undefined'||!fbDb){done(false);return;}
    fbDb.ref('study/reports').push(rec).then(function(){done(true);}).catch(function(){done(false);});
  }catch(e){done(false);}
}
