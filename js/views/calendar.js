/* ══════════════════════════════════════════
   캘린더 오버레이
══════════════════════════════════════════ */
function openCal(){
  /* 현재 보고 있는 주차의 첫 날짜로 캘린더 이동 */
  var v=wvals(wks[ci]).sort();
  var ref=v.length?new Date(v[0]):new Date();
  cy=ref.getFullYear();cm2=ref.getMonth();
  renderCal();document.getElementById('ovl').classList.add('show');
}
function closeCal(){document.getElementById('ovl').classList.remove('show');}
function renderCal(){
  document.getElementById('cal-ml').textContent=cy+'년 '+ML[cm2];
  var t=today(),cv=wvals(wks[ci]);

  /* 날짜→주차 역매핑 (merged 기반 - 모든 수업 날짜 포함) */
  var dateToWeek={};
  for(var mi=0;mi<merged.length;mi++){
    var mdt=merged[mi].date,mwk=merged[mi].week;
    if(mdt&&mwk)dateToWeek[mdt]=mwk;
  }
  /* wdd도 포함 */
  for(var wi=0;wi<wks.length;wi++){
    var w2=wks[wi],o=wdd[w2]||{},ks2=Object.keys(o);
    for(var ki=0;ki<ks2.length;ki++){if(o[ks2[ki]])dateToWeek[o[ks2[ki]]]=w2;}
  }

  var edSet={};for(var ei=0;ei<ed.length;ei++)edSet[ed[ei]]=true;
  /* 공휴일·행사: merged에서 날짜→이름 */
  var holMap={};
  for(var hi2=0;hi2<merged.length;hi2++){
    var hitm=merged[hi2];
    if(hitm.subject&&(isHoliday(hitm.subject)||isEv(hitm.subject))&&!holMap[hitm.date]){
      holMap[hitm.date]=hitm.subject;
    }
  }
  var first=new Date(cy,cm2,1),last=new Date(cy,cm2+1,0),g='';
  for(var i=0;i<first.getDay();i++)g+='<div class="cday"></div>';
  for(var day=1;day<=last.getDate();day++){
    var ds=cy+'-'+p2(cm2+1)+'-'+p2(day);
    var dow=new Date(cy,cm2,day).getDay();
    var hx=!!edSet[ds],it2=ds===t,hol=holMap[ds];
    var ck=!!dateToWeek[ds];
    var inCurWeek=cv.indexOf(ds)>=0;
    var cls='cday'+(ck?' ck':'')+(it2?' td2':'')
      +(dow===0||hol?' red':'')+(dow===6&&!hol?' blue':'')
      +(inCurWeek&&!it2?' cur':'');
    var sub='';
    if(hx)sub='<div class="cdot"><span class="dtr"></span></div>';
    else if(hol)sub='<div class="cdot"><span class="chol">'+escHtml(hol.slice(0,4))+'</span></div>';
    else sub='<div class="cdot"></div>';
    var oc=ck?' id="cd-'+ds+'"':'';
    g+='<div class="'+cls+'"'+oc+'><div class="cdn">'+day+'</div>'+sub+'</div>';
  }
  document.getElementById('cal-g').innerHTML=g;
  /* 이 달 시험 목록 — 점만으로는 무슨 시험인지 몰라서 이름·D-day를 함께 */
  var exBox=document.getElementById('cal-ex');
  if(!exBox){exBox=document.createElement('div');exBox.id='cal-ex';exBox.className='cal-ex';
    var cg=document.getElementById('cal-g');cg.parentNode.insertBefore(exBox,cg.nextSibling);}
  var mPre=cy+'-'+p2(cm2+1)+'-',exm={};
  viewItems(merged).forEach(function(x){
    if(!x.date||x.date.indexOf(mPre)!==0)return;
    if(!(x.is_exam===true||x.is_exam==='true'||isEx(x.subject)))return;
    (exm[x.date]=exm[x.date]||{})[x.subject]=1;
  });
  var exDs=Object.keys(exm).sort(),eh='';
  exDs.forEach(function(d){
    var n=Math.round((new Date(d)-new Date(t))/86400000);
    eh+='<div class="cal-ex-row" data-d="'+d+'"><span class="cal-ex-d">'+(+d.slice(5,7))+'/'+(+d.slice(8))+'</span>'
      +'<span class="cal-ex-n">'+escHtml(Object.keys(exm[d]).join(', '))+'</span>'
      +'<span class="cal-ex-dd">'+(n>0?'D-'+n:n===0?'D-Day':'지남')+'</span></div>';
  });
  exBox.innerHTML=eh?'<div class="cal-ex-ttl">이 달 시험</div>'+eh:'';
  exBox.querySelectorAll('.cal-ex-row').forEach(function(r){
    r.onclick=function(){var c=document.getElementById('cd-'+r.getAttribute('data-d'));if(c)c.click();};
  });
  var ckEls=document.querySelectorAll('.cday.ck');
  for(var ci2=0;ci2<ckEls.length;ci2++){
    ckEls[ci2].onclick=(function(el,dtw){
      return function(){
        var id=el.id;if(!id)return;
        var ds2=id.replace('cd-','');
        var targetWk=dtw[ds2];
        if(targetWk){
          for(var ii=0;ii<wks.length;ii++){if(wks[ii]===targetWk){ci=ii;break;}}
        }else{
          for(var ii=0;ii<wks.length;ii++){if(wvals(wks[ii]).indexOf(ds2)>=0){ci=ii;break;}}
        }
        closeCal();setView('weekly');render();
      };
    })(ckEls[ci2],dateToWeek);
  }
}
