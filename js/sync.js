/* ══════════════════════════════════════════
   백업·동기화 + 학년 랭킹 (Firebase users/, study/)
   - 공부기록·플래너·할일을 users/<코드>에 자동 백업 (디바운스)
   - 복원: 다른 기기에서 코드 입력 → localStorage 덮어쓰기 → 리로드
   - 랭킹: 닉네임 설정 시 study/<gradeKey>/<코드>에 주간 공부시간 공유
══════════════════════════════════════════ */
var SYNC_KEYS=['tm_logs','pl_todos','study_goal_min','rank_nick'];
var SYNC_PREFIX=['dtodo_'];

function syncUid(){
  var u=null;
  try{u=localStorage.getItem('sync_uid');}catch(e){}
  if(!u){
    var chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; /* 헷갈리는 문자(I,L,O,0,1) 제외 */
    u='';for(var i=0;i<8;i++)u+=chars[Math.floor(Math.random()*chars.length)];
    try{localStorage.setItem('sync_uid',u);}catch(e){}
  }
  return u;
}
function syncWatched(k){
  if(SYNC_KEYS.indexOf(k)>=0)return true;
  for(var i=0;i<SYNC_PREFIX.length;i++)if(k.indexOf(SYNC_PREFIX[i])===0)return true;
  return false;
}

/* localStorage 쓰기 감지 → 4초 디바운스 후 백업 */
var _syncTimer=null;
(function(){
  var orig=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    orig.apply(this,arguments);
    if(this===window.localStorage&&syncWatched(k))syncQueue();
  };
})();
function syncQueue(){
  if(_syncTimer)clearTimeout(_syncTimer);
  _syncTimer=setTimeout(syncPush,4000);
}
function syncPush(){
  _syncTimer=null;
  if(!fbDb)return;
  var data={};
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(syncWatched(k))data[k]=localStorage.getItem(k);
  }
  var blob={v:1,grade:savedGrade||'',ts:Date.now(),data:data};
  fbDb.ref('users/'+syncUid()).set(blob).then(function(){
    try{localStorage.setItem('sync_last',String(blob.ts));}catch(e){}
    var el=document.getElementById('sync-status');
    if(el)el.textContent=syncStatusText();
  }).catch(function(){});
}
function syncStatusText(){
  var t=0;
  try{t=parseInt(localStorage.getItem('sync_last')||'0',10);}catch(e){}
  if(!t)return'자동 백업 대기 중';
  var d=new Date(t);
  return'마지막 백업 '+(d.getMonth()+1)+'/'+d.getDate()+' '+p2(d.getHours())+':'+p2(d.getMinutes());
}
function syncRestore(code,cb){
  if(!fbDb){cb('연결할 수 없습니다');return;}
  code=(code||'').trim().toUpperCase();
  if(code.length!==8){cb('코드는 8자리입니다');return;}
  fbDb.ref('users/'+code).once('value').then(function(snap){
    var b=snap.val();
    if(!b||!b.data){cb('해당 코드의 백업이 없습니다');return;}
    Object.keys(b.data).forEach(function(k){
      try{localStorage.setItem(k,b.data[k]);}catch(e){}
    });
    cb(null);
  }).catch(function(){cb('불러오기에 실패했습니다');});
}

/* ── 학년 랭킹 ── */
function rankNick(){try{return localStorage.getItem('rank_nick')||'';}catch(e){return'';}}
function rankWeekKey(){
  var d=new Date();d.setDate(d.getDate()-d.getDay()); /* 이번 주 일요일 */
  return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
}
var _rankLastPush=0;
function rankPush(){
  if(!fbDb||!savedGrade||!rankNick())return;
  var now=Date.now();
  if(now-_rankLastPush<60000)return; /* 1분 스로틀 */
  _rankLastPush=now;
  fbDb.ref('study/'+fbGradeKey(savedGrade)+'/'+syncUid()).set({
    nick:rankNick(),week:rankWeekKey(),secs:dashWeekTotal(),ts:now
  }).catch(function(){});
}
function rankFetch(cb){
  if(!fbDb||!savedGrade){cb(null);return;}
  fbDb.ref('study/'+fbGradeKey(savedGrade)).once('value').then(function(s){
    var v=s.val()||{},wk=rankWeekKey(),rows=[];
    Object.keys(v).forEach(function(uid){
      var r=v[uid];
      if(r&&r.week===wk&&r.nick)rows.push({uid:uid,nick:r.nick,secs:r.secs||0});
    });
    rows.sort(function(a,b){return b.secs-a.secs;});
    cb(rows);
  }).catch(function(){cb(null);});
}
