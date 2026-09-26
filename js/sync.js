/* ══════════════════════════════════════════
   백업·동기화 (Firebase users/)
   - 공부기록·플래너·할일을 users/<코드>에 자동 백업 (디바운스)
   - 복원: 다른 기기에서 코드 입력 → localStorage 덮어쓰기 → 리로드
══════════════════════════════════════════ */
var SYNC_KEYS=['tm_logs','pl_todos','study_goal_min'];
var SYNC_PREFIX=['dtodo_','tt_ov_','plan_'];

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
/* ── 복원: 덮어쓰지 않고 합친다 ──
   기기에만 있는 최근 공부 기록이 지워지지 않도록 키 종류별로 병합한다. */
function syncMergeJson(k,localStr,remoteStr){
  function P(v,d){try{var x=JSON.parse(v);return x||d;}catch(e){return d;}}
  if(!localStr)return remoteStr;
  if(k==='tm_logs'){
    var out=P(localStr,[]),rem=P(remoteStr,[]);
    rem.forEach(function(r){
      var hit=null;
      out.forEach(function(l){if(l.date===r.date&&l.subject===r.subject)hit=l;});
      if(hit)hit.secs=Math.max(hit.secs||0,r.secs||0);
      else out.push(r);
    });
    return JSON.stringify(out);
  }
  if(k.indexOf('plan_meta_')===0){
    var lm=P(localStr,{}),rm=P(remoteStr,{});
    return JSON.stringify({
      res:lm.res||rm.res||'',ref:lm.ref||rm.ref||'',
      rate:Math.max(lm.rate||0,rm.rate||0),
      carryOff:lm.carryOff||rm.carryOff||0
    });
  }
  if(k.indexOf('plan_')===0||k==='pl_todos'){
    var lo=P(localStr,[]),ro=P(remoteStr,[]);
    if(!Array.isArray(lo)||!Array.isArray(ro))return localStr;
    ro.forEach(function(r){
      var hit=null;
      lo.forEach(function(l){if(l.id===r.id||(l.text===r.text&&l.date===r.date))hit=l;});
      if(!hit){lo.push(r);return;}
      hit.secs=Math.max(hit.secs||0,r.secs||0);
      hit.done=hit.done||r.done;
      var ss=(hit.sessions||[]).slice();
      (r.sessions||[]).forEach(function(v){if(ss.indexOf(v)<0)ss.push(v);});
      ss.sort();
      if(ss.length)hit.sessions=ss;
    });
    return JSON.stringify(lo);
  }
  if(k.indexOf('dtodo_')===0){
    var ld=P(localStr,[]),rd=P(remoteStr,[]);
    if(!Array.isArray(ld)||!Array.isArray(rd))return localStr;
    rd.forEach(function(r){
      var hit=null;
      ld.forEach(function(l){if(l.text===r.text)hit=l;});
      if(hit)hit.done=hit.done||r.done;
      else ld.push(r);
    });
    return JSON.stringify(ld);
  }
  return localStr; /* 그 밖의 키는 기기 값을 유지 */
}
function syncRestore(code,cb){
  if(!fbDb){cb('연결할 수 없습니다');return;}
  code=(code||'').trim().toUpperCase();
  if(code.length!==8){cb('코드는 8자리입니다');return;}
  fbDb.ref('users/'+code).once('value').then(function(snap){
    var b=snap.val();
    if(!b||!b.data){cb('해당 코드의 백업이 없습니다');return;}
    Object.keys(b.data).forEach(function(k){
      try{
        var cur=localStorage.getItem(k);
        localStorage.setItem(k,cur?syncMergeJson(k,cur,b.data[k]):b.data[k]);
      }catch(e){}
    });
    cb(null);
  }).catch(function(){cb('불러오기에 실패했습니다');});
}



/* ── 익명 사용 통계 핑 (학교·학년·최근 사용 시각만, 6시간 스로틀) ── */
function presencePing(){
  if(!fbDb||!savedGrade)return;
  var last=0;
  try{last=parseInt(localStorage.getItem('presence_ts')||'0',10);}catch(e){}
  if(Date.now()-last<6*3600*1000)return;
  fbDb.ref('study/presence/'+syncUid()).set({
    school:savedSchool||'jbnu',grade:savedGrade,ts:Date.now()
  }).then(function(){
    try{localStorage.setItem('presence_ts',String(Date.now()));}catch(e){}
  }).catch(function(){});
}
setTimeout(presencePing,3000);
