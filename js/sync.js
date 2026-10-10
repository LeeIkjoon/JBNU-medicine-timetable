/* ══════════════════════════════════════════
   백업·동기화 (Firebase users/<코드> 또는 u/<계정>)
   - 공부기록·플래너·할일·시간표 설정을 같은 계정(또는 같은 코드)의 기기끼리 실시간 동기화
   - 코드 가져오기: 다른 기기의 코드를 이 기기도 쓰게 되어 이후 계속 동기화
══════════════════════════════════════════ */
var SYNC_KEYS=['tm_logs','pl_todos','study_goal_min','user_school','user_grade'];
/* dtodo_: 날짜별 할 일, tt_ov_: 개인 수정, plan_: 플래너, section_/elective_: 분반·전공선택,
   tt_local_: 내 파일 모드 표시 */
var SYNC_PREFIX=['dtodo_','tt_ov_','plan_','section_','elective_','tt_local_'];

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
  /* 직접 올린 시간표만 백업 (학교 공유 시간표는 서버에서 받으므로 제외) */
  if(k.indexOf('timetable_data_')===0&&typeof ttLocalOn==='function'&&ttLocalOn())return true;
  return false;
}

/* ══════════ 실시간 동기화 (같은 사람의 여러 기기) ══════════
   저장 위치: <syncPath()>/k/<인코딩된 키> = {v:문자열|null, t:마지막 수정 ms, d:기기 id}
   - 로컬 쓰기 감지 → 1.5초 디바운스 → 키마다 트랜잭션으로 서버 값과 병합해 올림
   - 서버 변경은 리스너로 받아 로컬과 병합 → 화면 갱신
   - 병합: 목록(플래너·할 일)은 항목별 최신 우선 + 삭제 표시(del), 공부 기록은 최대값, 그 밖은 키 단위 최신 우선 */
var SYNC_DEV=(function(){
  var d=null;try{d=localStorage.getItem('sync_dev');}catch(e){}
  if(!d){d=Math.random().toString(36).slice(2,10);try{localStorage.setItem('sync_dev',d);}catch(e){}}
  return d;
})();
var _syncApplying=false,_syncDirty={},_syncTimer=null,_syncRef=null,_syncPathOn='';
function syncKT(){try{return JSON.parse(localStorage.getItem('sync_kt')||'{}')||{};}catch(e){return{};}}
function syncKTSet(k,t){var m=syncKT();m[k]=t;try{localStorage.setItem('sync_kt',JSON.stringify(m));}catch(e){}}
function syncEnc(k){return encodeURIComponent(k).replace(/\./g,'%2E');}
function syncDec(k){try{return decodeURIComponent(k);}catch(e){return k;}}

/* localStorage 쓰기·삭제 감지 */
(function(){
  var oset=Storage.prototype.setItem,orem=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(k,v){
    var prev=(this===window.localStorage&&!_syncApplying&&syncWatched(k))?this.getItem(k):undefined;
    oset.apply(this,arguments);
    if(prev!==undefined&&prev!==String(v))syncTouch(k);
  };
  Storage.prototype.removeItem=function(k){
    var had=(this===window.localStorage&&!_syncApplying&&syncWatched(k))&&this.getItem(k)!==null;
    orem.apply(this,arguments);
    if(had)syncTouch(k);
  };
})();
function syncTouch(k){
  syncKTSet(k,Date.now());
  _syncDirty[k]=1;
  syncQueue();
}
function syncQueue(){
  if(_syncTimer)clearTimeout(_syncTimer);
  _syncTimer=setTimeout(syncFlush,1500);
}
/* 백업 위치: 로그인했으면 계정, 아니면 8자리 코드 (코드를 공유한 기기끼리도 동기화) */
function syncPath(){
  return (window.authUser&&authUser.uid)?('u/'+authUser.uid):('users/'+syncUid());
}
/* 예전 이름 호환 */
function syncPush(){syncFlush();}
function syncFlush(){
  _syncTimer=null;
  if(!fbDb||!_syncPathOn)return;
  var keys=Object.keys(_syncDirty);_syncDirty={};
  keys.forEach(function(k){syncPushKey(k);}); /* forEach의 인덱스가 cb로 넘어가 두 번째 키부터 오류 나던 것 방지 */
}
function syncPushKey(k,cb){
  var base=_syncPathOn;
  fbDb.ref(base+'/k/'+syncEnc(k)).transaction(function(cur){
    var lv=localStorage.getItem(k),lt=syncKT()[k]||0;
    if(!cur)return{v:lv,t:lt||Date.now(),d:SYNC_DEV};
    var m=syncMerge(k,lv,lt,cur.v===undefined?null:cur.v,cur.t||0);
    if(m===cur.v)return; /* 서버가 이미 최신 — 쓰지 않음 */
    return{v:m,t:Math.max(lt,cur.t||0,Date.now()),d:SYNC_DEV};
  },function(err,committed,snap){
    if(cb)cb(!err);
    if(err)syncLog('push-err',{key:k.replace(/[^a-z_]/g,'').slice(0,20),err:String(err.code||err.message||err).slice(0,80)});
    if(err||base!==_syncPathOn)return;
    var val=snap&&snap.val();
    if(val)syncApplyLocal(k,val.v===undefined?null:val.v,val.t||0);
    try{localStorage.setItem('sync_last',String(Date.now()));}catch(e){}
    var el=document.getElementById('sync-status');
    if(el)el.textContent=syncStatusText();
  },false);
}
/* 서버 값 → 로컬 반영 (변경 시 화면 갱신) */
function syncApplyLocal(k,v,t){
  var lv=localStorage.getItem(k);
  if(lv===v)return false;
  _syncApplying=true;
  try{
    if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);
  }catch(e){}
  _syncApplying=false;
  syncKTSet(k,Math.max(syncKT()[k]||0,t||0));
  syncRerender(k);
  return true;
}
function syncOnRemote(name,val){
  if(!val)return;
  var k=syncDec(name);
  if(!syncWatched(k)&&k.indexOf('timetable_data_')!==0)return;
  var rv=(val.v===undefined)?null:val.v,rt=val.t||0;
  var lv=localStorage.getItem(k),lt=syncKT()[k]||0;
  var m=syncMerge(k,lv,lt,rv,rt);
  if(m!==lv)syncApplyLocal(k,m,Math.max(lt,rt));
  if(m!==rv){_syncDirty[k]=1;syncQueue();} /* 합친 결과를 다시 올림 */
}
/* 이 기기의 모든 기록을 지금 서버에 올림 (주소 이전 전) — 완료되면 true, 시간 초과·오프라인이면 false */
function syncFlushAll(timeoutMs){
  return new Promise(function(res){
    var t0=Date.now(),lim=timeoutMs||10000,done=false;
    function fin(ok){if(!done){done=true;res(ok);}}
    setTimeout(function(){fin(false);},lim);
    (function wait(){
      if(done)return;
      if(!fbDb){fin(false);return;}
      if(!_syncRef){if(Date.now()-t0<lim)setTimeout(wait,200);return;} /* 첫 동기화가 끝날 때까지 */
      var keys=[];
      for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(syncWatched(k))keys.push(k);}
      var left=keys.length,fail=false;
      if(!left){fin(true);return;}
      keys.forEach(function(k){syncPushKey(k,function(ok){if(!ok)fail=true;if(--left===0)fin(!fail);});});
    })();
  });
}
/* 동기화 시작/경로 전환 (앱 시작·로그인·로그아웃·코드 가져오기 때) */
function syncStart(){
  if(!fbDb)return;
  var path=syncPath();
  if(path===_syncPathOn&&_syncRef)return;
  if(_syncRef){_syncRef.off();_syncRef=null;}
  _syncPathOn=path;
  var ref=fbDb.ref(path+'/k');
  /* 예전 형식(한 덩어리 data) 백업이 있으면 한 번 합침 */
  fbDb.ref(path+'/data').once('value').then(function(s0){
    var old=s0.val(),flag='sync_mig_'+path;
    if(old&&localStorage.getItem(flag)!=='1'){
      Object.keys(old).forEach(function(k){
        var cur=localStorage.getItem(k);
        var m=cur?syncMergeJson(k,cur,old[k]):old[k];
        if(m!==cur){try{localStorage.setItem(k,m);}catch(e){}}
      });
      try{localStorage.setItem(flag,'1');}catch(e){}
    }
  }).catch(function(){}).then(function(){
    if(path!==_syncPathOn)return;
    return ref.once('value').then(function(snap){
      if(path!==_syncPathOn)return;
      var remote={},nr=0,nl=0;
      snap.forEach(function(){nr++;});
      for(var i0=0;i0<localStorage.length;i0++)if(syncWatched(localStorage.key(i0)))nl++;
      syncLog('start',{remote:nr,local:nl});
      snap.forEach(function(c){remote[syncDec(c.key)]=1;syncOnRemote(c.key,c.val());});
      /* 이 기기에만 있는 키는 올림 */
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(syncWatched(k)&&!remote[k])_syncDirty[k]=1;
      }
      syncQueue();
      _syncRef=ref;
      function cancel(e){syncLog('listen-err',{err:String(e&&(e.code||e.message)||e).slice(0,80)});}
      ref.on('child_added',function(c){syncOnRemote(c.key,c.val());},cancel);
      ref.on('child_changed',function(c){syncOnRemote(c.key,c.val());syncLog('recv',{key:syncDec(c.key).replace(/[^a-z_]/g,'').slice(0,20)});},cancel);
    });
  }).catch(function(e){syncLog('start-err',{err:String(e&&(e.code||e.message)||e).slice(0,80)});});
}

/* 동기화 진단 로그 (문제 해결용, 임시) — study/synclog/<코드>/<이벤트>. 내용은 남기지 않고 키 수·오류만 */
function syncLog(ev,info){
  try{
    if(!fbDb)return;
    var uid=(window.authUser&&authUser.uid)||'';
    var o={ts:Date.now(),path:_syncPathOn?_syncPathOn.split('/')[0]:'',uid4:uid.slice(0,4),dev:SYNC_DEV,
      email4:((window.authUser&&authUser.email)||'').slice(0,4),standalone:!!window.navigator.standalone,
      ua:navigator.userAgent.slice(13,45)};
    for(var k in (info||{}))o[k]=info[k];
    fbDb.ref('study/synclog/'+syncUid()+'/'+ev).set(o).catch(function(){});
  }catch(e){}
}
function syncStatusText(){
  var t=0;
  try{t=parseInt(localStorage.getItem('sync_last')||'0',10);}catch(e){}
  if(!t)return'동기화 대기 중';
  var d=new Date(t);
  return'동기화됨 '+(d.getMonth()+1)+'/'+d.getDate()+' '+p2(d.getHours())+':'+p2(d.getMinutes());
}

/* ── 병합 ── */
function syncMerge(k,lv,lt,rv,rt){
  if(lv===rv)return lv;
  if(lv===null||lv===undefined)return (lt&&lt>rt)?null:rv;
  if(rv===null||rv===undefined)return (rt&&rt>lt)?null:lv;
  function P(v){try{return JSON.parse(v);}catch(e){return undefined;}}
  if(k==='tm_logs')return syncMergeJson(k,lv,rv);
  if(k.indexOf('plan_meta_')!==0&&(k.indexOf('plan_')===0||k.indexOf('dtodo_')===0||k==='pl_todos')){
    var a=P(lv),b=P(rv);
    if(Array.isArray(a)&&Array.isArray(b))return JSON.stringify(syncMergeList(k,a,b,lt,rt));
  }
  return lt>rt?lv:lt<rt?rv:(lv>=rv?lv:rv); /* 키 단위 최신 우선 (동시각이면 결정적으로) */
}
function syncItemId(k,it){
  if(k.indexOf('dtodo_')===0)return 'x'+(it.id||it.text);
  return 'x'+(it.id!==undefined?it.id:it.text);
}
function syncMergeList(k,a,b,lt,rt){
  var bm={},out=[],seen={};
  b.forEach(function(it){bm[syncItemId(k,it)]=it;});
  function pick(x,y){
    var xu=x.u||lt,yu=y.u||rt;
    /* 같은 시각이면 문자열 비교로 — 두 기기가 같은 쪽을 고르도록 */
    var w=xu>yu?x:xu<yu?y:(JSON.stringify(x)>=JSON.stringify(y)?x:y),o=w===x?y:x;
    w=JSON.parse(JSON.stringify(w));
    if(!w.del){
      if(o.secs!==undefined||w.secs!==undefined)w.secs=Math.max(w.secs||0,o.secs||0);
      if(o.sessions&&o.sessions.length){
        var ss=(w.sessions||[]).slice();
        o.sessions.forEach(function(v){if(ss.indexOf(v)<0)ss.push(v);});
        ss.sort();w.sessions=ss;
      }
    }
    return w;
  }
  a.forEach(function(it){
    var id=syncItemId(k,it);seen[id]=1;
    out.push(bm[id]?pick(it,bm[id]):it);
  });
  b.forEach(function(it){var id=syncItemId(k,it);if(!seen[id]){seen[id]=1;out.push(it);}});
  return out;
}
/* 목록 저장소 도우미: 화면용 목록 ↔ 저장(삭제 표시·수정 시각 포함) */
function syncListVisible(arr){return (Array.isArray(arr)?arr:[]).filter(function(it){return it&&!it.del;});}
function syncListStore(k,visible){
  var raw=[];try{raw=JSON.parse(localStorage.getItem(k)||'[]')||[];}catch(e){}
  if(!Array.isArray(raw))raw=[];
  var now=Date.now(),old={},keep={},out=[];
  raw.forEach(function(it){if(it)old[syncItemId(k,it)]=it;});
  visible.forEach(function(it){
    var id=syncItemId(k,it),o=old[id];keep[id]=1;
    var c=JSON.parse(JSON.stringify(it));
    if(o&&!o.del){var o2=JSON.parse(JSON.stringify(o));delete o2.u;delete c.u;c.u=(JSON.stringify(o2)===JSON.stringify(c))?(o.u||now):now;}
    else c.u=now;
    out.push(c);
  });
  /* 사라진 항목 → 삭제 표시 (60일 지난 표시는 정리) */
  raw.forEach(function(it){
    if(!it)return;
    var id=syncItemId(k,it);if(keep[id])return;
    if(it.del){if(now-(it.u||0)<60*86400000)out.push(it);return;}
    var t={del:1,u:now};
    if(it.id!==undefined)t.id=it.id;else t.text=it.text;
    if(it.date)t.date=it.date;
    out.push(t);
  });
  return JSON.stringify(out);
}

/* 서버 변경 후 화면 갱신 — 입력 중이면 잠시 미룸 */
var _syncRR=null,_syncRRKeys={};
function syncRerender(k){
  _syncRRKeys[k]=1;
  if(_syncRR)clearTimeout(_syncRR);
  _syncRR=setTimeout(syncRerenderNow,400);
}
function syncRerenderNow(){
  _syncRR=null;
  var ae=document.activeElement;
  if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)){_syncRR=setTimeout(syncRerenderNow,1500);return;}
  var keys=Object.keys(_syncRRKeys);_syncRRKeys={};
  var reload=keys.some(function(k){
    return k==='user_school'||k==='user_grade'||(k.indexOf('timetable_data_')===0)||(k.indexOf('tt_local_')===0);
  });
  if(reload){
    /* 학교·학년·내 파일이 다른 기기에서 바뀜 → 다시 불러옴 */
    var g=localStorage.getItem('user_grade')||'',sc=localStorage.getItem('user_school')||'';
    if(g!==(savedGrade||'')||sc!==(savedSchool||'')||keys.some(function(k){return k.indexOf('timetable_data_')===0||k.indexOf('tt_local_')===0;}))
      {location.reload();return;}
  }
  if(keys.indexOf('pl_todos')>=0&&typeof plTodos!=='undefined'){
    try{plTodos=syncListVisible(JSON.parse(localStorage.getItem('pl_todos')||'[]'));}catch(e){}
  }
  if(typeof render==='function')render();
  if(typeof dtodoDate!=='undefined'&&dtodoDate&&typeof renderDtodoList==='function')renderDtodoList();
  if(typeof updateTodoDots==='function')updateTodoDots();
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
  if(k.indexOf('timetable_data_')===0){
    /* 직접 올린 시간표: 더 최근에 적용한 쪽 */
    try{
      var L=JSON.parse(localStr),R=JSON.parse(remoteStr);
      return ((R&&R.ts||0)>(L&&L.ts||0))?remoteStr:localStr;
    }catch(e){return localStr;}
  }
  return localStr; /* 그 밖의 키는 기기 값을 유지 */
}
function syncRestore(code,cb){
  if(!fbDb){cb('연결할 수 없습니다');return;}
  code=(code||'').trim().toUpperCase();
  if(code.length!==8){cb('코드는 8자리입니다');return;}
  fbDb.ref('users/'+code).once('value').then(function(snap){
    var b=snap.val();
    if(!b||(!b.data&&!b.k)){cb('해당 코드의 백업이 없습니다');return;}
    /* 이 기기도 같은 코드를 쓰게 함 → 두 기기가 계속 동기화. 합치기는 syncStart가 처리 */
    try{localStorage.setItem('sync_uid',code);}catch(e){}
    if(window.authUser&&authUser.uid){
      /* 로그인 상태면 코드 백업을 계정으로 한 번 가져옴 */
      Object.keys(b.data||{}).forEach(function(k){
        var cur=localStorage.getItem(k);
        try{localStorage.setItem(k,cur?syncMergeJson(k,cur,b.data[k]):b.data[k]);}catch(e){}
      });
      Object.keys(b.k||{}).forEach(function(n){syncOnRemote(n,b.k[n]);});
    }else syncStart();
    cb(null);
  }).catch(function(){cb('불러오기에 실패했습니다');});
}



/* ── 익명 사용 통계 핑 (학교·학년·최근 사용 시각만, 6시간 스로틀) ── */
function presencePing(){
  if(!fbDb||!savedGrade)return;
  if(navigator.webdriver)return; /* 자동화 테스트 브라우저는 사용자 수에 넣지 않음 */
  var last=0;
  try{last=parseInt(localStorage.getItem('presence_ts')||'0',10);}catch(e){}
  if(Date.now()-last<6*3600*1000)return;
  /* dev·sa: 사용자 수를 폰 기준으로 세기 위한 기기 종류(폰/태블릿/PC)와 홈 화면 앱 여부 — tools/users.py */
  var ua=navigator.userAgent||'',tablet=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)||(/Android/.test(ua)&&!/Mobile/.test(ua));
  var dev=tablet?'tablet':/iPhone|Android.*Mobile|Mobile/.test(ua)?'phone':'pc';
  var sa=!!((typeof IS_APP!=='undefined'&&IS_APP)||window.navigator.standalone||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches));
  fbDb.ref('study/presence/'+syncUid()).set({
    school:savedSchool||'jbnu',grade:savedGrade,ts:Date.now(),dev:dev,sa:sa
  }).then(function(){
    try{localStorage.setItem('presence_ts',String(Date.now()));}catch(e){}
  }).catch(function(){});
}
setTimeout(presencePing,3000);
/* 로그인 SDK가 없으면 코드 경로로 바로 시작 (있으면 auth.js가 로그인 상태 확인 후 시작) */
setTimeout(function(){if(!window.fbAuth||!authReady)syncStart();},4000);
