/* ══════════════════════════════════════════
   날짜별 할일 패널
══════════════════════════════════════════ */
var dtodoDate=null;
var dtodoInputMode=false;
var DTODO_COLORS=['dtodo-item-0','dtodo-item-1','dtodo-item-2','dtodo-item-3','dtodo-item-4'];
var DTODO_LCOLORS=['dtodo-item-lc-0','dtodo-item-lc-1','dtodo-item-lc-2','dtodo-item-lc-3','dtodo-item-lc-4'];

function dtodoKey(d){return 'dtodo_'+d;}
function dtodoLoad(d){try{return JSON.parse(localStorage.getItem(dtodoKey(d))||'[]');}catch(e){return[];}}
function dtodoSave(d,arr){try{localStorage.setItem(dtodoKey(d),JSON.stringify(arr));}catch(e){}}

function dtodoDdDay(ds){
  var t=new Date();t.setHours(0,0,0,0);
  var s=new Date(ds);s.setHours(0,0,0,0);
  var d=Math.round((s-t)/86400000);
  if(d===0)return 'D-Day';
  if(d>0)return 'D-'+d;
  return 'D+'+Math.abs(d);
}

function openDtodo(ds,label){
  dtodoDate=ds;dtodoInputMode=false;
  var ovl=document.getElementById('dtodo-ovl');
  var lbl=document.getElementById('dtodo-date-lbl');
  var dd=document.getElementById('dtodo-ddday');
  if(!ovl)return;
  if(lbl)lbl.textContent=label||ds;
  if(dd)dd.textContent=dtodoDdDay(ds);
  ovl.className='dtodo-ovl show';
  renderDtodoList();
}
function closeDtodo(){
  var ovl=document.getElementById('dtodo-ovl');
  if(ovl)ovl.className='dtodo-ovl';
  dtodoDate=null;dtodoInputMode=false;
  updateTodoDots();
}

function renderDtodoList(){
  if(!dtodoDate)return;
  var arr=dtodoLoad(dtodoDate);
  var body=document.getElementById('dtodo-list');
  var foot=document.getElementById('dtodo-footer');
  if(!body)return;
  var h='';
  if(arr.length===0){
    h='<div class="dtodo-empty-msg">아직 할 일이 없어요 🙂</div>';
  }else{
    arr.forEach(function(item,i){
      var ci=i%5;
      var dc=item.done?' dtodo-item-done':'';
      h+='<div class="dtodo-item '+DTODO_COLORS[ci]+dc+'" data-i="'+i+'">'+
        '<div class="dtodo-item-left '+DTODO_LCOLORS[ci]+'"></div>'+
        '<div class="dtodo-text-wrap">'+
          '<div class="dtodo-text'+(item.done?' done':'')+'">'+item.text.replace(/</g,'&lt;')+'</div>'+
        '</div>'+
        '<div class="dtodo-chk'+(item.done?' done':'')+'" onclick="dtodoToggle('+i+')"></div>'+
        '<div class="dtodo-del-wrap"><button class="dtodo-del" onclick="dtodoDel('+i+')">✕</button></div>'+
      '</div>';
    });
  }
  body.innerHTML=h;
  if(foot){
    if(dtodoInputMode){
      foot.innerHTML=
        '<div class="dtodo-inp-card">'+
          '<span class="dtodo-add-plus" style="color:#C7C7CC">＋</span>'+
          '<input class="dtodo-inp" id="dtodo-inp" placeholder="할 일을 입력하세요" type="text">'+
          '<button class="dtodo-inp-ok" id="dtodo-inp-ok">추가</button>'+
        '</div>';
      setTimeout(function(){
        var inp=document.getElementById('dtodo-inp');
        var ok=document.getElementById('dtodo-inp-ok');
        if(inp){inp.focus();inp.addEventListener('keydown',function(e){if(e.key==='Enter')dtodoAdd();});}
        if(ok)ok.addEventListener('click',dtodoAdd);
      },60);
    }else{
      foot.innerHTML=
        '<button class="dtodo-add-card" id="dtodo-add-card">'+
          '<span class="dtodo-add-plus">＋</span>'+
          '<span class="dtodo-add-text">할 일을 추가하세요</span>'+
        '</button>';
      setTimeout(function(){
        var btn=document.getElementById('dtodo-add-card');
        if(btn)btn.addEventListener('click',function(){dtodoInputMode=true;renderDtodoList();});
      },30);
    }
  }
}

function dtodoAdd(){
  if(!dtodoDate)return;
  var inp=document.getElementById('dtodo-inp');
  if(!inp)return;
  var text=inp.value.trim();
  if(!text)return;
  var arr=dtodoLoad(dtodoDate);
  arr.push({text:text,done:false});
  dtodoSave(dtodoDate,arr);
  dtodoInputMode=false;
  renderDtodoList();
  updateTodoDots();
}
function dtodoToggle(i){
  if(!dtodoDate)return;
  var arr=dtodoLoad(dtodoDate);
  if(arr[i])arr[i].done=!arr[i].done;
  dtodoSave(dtodoDate,arr);
  /* 재렌더 없이 해당 아이템만 상태 전환 → 밑줄이 그어지는 애니메이션 */
  var el=document.querySelector('.dtodo-item[data-i="'+i+'"]');
  if(el&&arr[i]){
    el.classList.toggle('dtodo-item-done',arr[i].done);
    var tx=el.querySelector('.dtodo-text');if(tx)tx.classList.toggle('done',arr[i].done);
    var ck=el.querySelector('.dtodo-chk');if(ck)ck.classList.toggle('done',arr[i].done);
  }else renderDtodoList();
}
function dtodoDel(i){
  if(!dtodoDate)return;
  var el=document.querySelector('.dtodo-item[data-i="'+i+'"]');
  var fin=function(){
    var arr=dtodoLoad(dtodoDate);
    arr.splice(i,1);
    dtodoSave(dtodoDate,arr);
    renderDtodoList();
    updateTodoDots();
  };
  if(el){el.classList.add('removing');setTimeout(fin,260);}
  else fin();
}
function updateTodoDots(){
  /* 날짜 헤더의 할일 배지 갱신 (wh 캐시와 무관하게 DOM 직접 갱신) */
  var IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M4 6l1.2 1.2L7.5 4.9M4 11.5l1.2 1.2 2.3-2.3M4 17l1.2 1.2 2.3-2.3"/></svg>';
  document.querySelectorAll('.th-d[data-date]').forEach(function(th){
    var dt=th.getAttribute('data-date');
    var el=th.querySelector('.th-todo');
    if(!dt||!el)return;
    var n=dtodoLoad(dt).length;
    el.className='th-todo'+(n?' has':'');
    el.innerHTML=n?String(n):IC;
  });
}
(function(){
  var CHECK=setInterval(function(){
    if(typeof renderW==='function'){
      clearInterval(CHECK);
      var orig=renderW;
      renderW=function(){orig.apply(this,arguments);bindThClick();updateTodoDots();};
    }
  },100);
})();
function bindThClick(){
  setTimeout(function(){
    document.querySelectorAll('.th-d[data-date]').forEach(function(th){
      th.style.cursor='pointer';
      th.removeEventListener('click',th._dtodoH);
      var dt=th.getAttribute('data-date');
      var day=th.getAttribute('data-day');
      th._dtodoH=function(e){
        e.stopPropagation();
        var p=dt.split('-');
        openDtodo(dt,parseInt(p[1])+'월 '+parseInt(p[2])+'일 ('+day+')');
      };
      th.addEventListener('click',th._dtodoH);
    });
  },80);
}
setTimeout(function(){
  var ovl2=document.getElementById('dtodo-ovl');
  var sh2=document.getElementById('dtodo-sh');
  var cb=document.getElementById('dtodo-close');
  if(ovl2)ovl2.addEventListener('click',function(e){if(e.target===ovl2)closeDtodo();});
  if(sh2)sh2.addEventListener('click',function(e){e.stopPropagation();});
  if(cb)cb.addEventListener('click',closeDtodo);
},700);

