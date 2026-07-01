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
  var first=new Date(cy,cm2,1),last=new Date(cy,cm2+1,0),g='';
  for(var i=0;i<first.getDay();i++)g+='<div class="cday"></div>';
  for(var day=1;day<=last.getDate();day++){
    var ds=cy+'-'+p2(cm2+1)+'-'+p2(day);
    var dow=new Date(cy,cm2,day).getDay(),isWD=dow>=1&&dow<=5;
    var hx=!!edSet[ds],it2=ds===t,iw=cv.indexOf(ds)>=0&&isWD;
    var ck=!!dateToWeek[ds];
    var cls='cday'+(ck?' ck':'')+(it2?' td2':'')+(iw&&!it2?' iw':'');
    var dot=hx?'<div class="cdot"><span class="dtr"></span></div>':'<div class="cdot"></div>';
    var oc=ck?' id="cd-'+ds+'"':'';
    g+='<div class="'+cls+'"'+oc+'><div class="cdn">'+day+'</div>'+dot+'</div>';
  }
  document.getElementById('cal-g').innerHTML=g;
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
