var DAYS = ['월','화','수','목','금'];
var WN   = ['일','월','화','수','목','금','토'];
var ML   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
var EVK  = ['진급식','근로자의날','대체휴무','어린이날','지방선거','개교기념일','면접고사','2학기 종강, 기말고사 완료','동기계절수업시작'];
/* 휴일 키워드 (색상 없이 텍스트만 표시) */
var HOLIDAY_KW = ['근로자의날','대체휴무','대체휴일','어린이날','지방선거','개교기념일','공휴일','현충일','광복절','추석','설날','삼일절','면접고사','종강','계절수업','개천절','한글날','성탄절','신정','체육대회'];

/* 분반 규칙: 특정 과목이 요일별 분반으로 나뉘는 학년.
   선택한 요일의 수업만 표시 (미선택 시 전체 표시 + 선택 안내) */
/* 키: '학교|학년'. mode 'day'=요일 분반(과목 한정), 'sec'=아이템 sec 필드 분반 */
var SECTION_RULES={
  'jbnu|의예과 2학년':{mode:'day',subject:'인체육안구조실습',days:['화','수','금'],label:'해부실습 분반',
    options:[{v:'화',t:'화반',d:'화요일 실습'},{v:'수',t:'수반',d:'수요일 실습'},{v:'금',t:'금반',d:'금요일 실습'}]},
  'wku|의예과 2학년':{mode:'sec',label:'실습 분반',
    options:[{v:'1',t:'1분반',d:'1분반 실습'},{v:'2',t:'2분반',d:'2분반 실습'}]}
};

/* ── 학교 레지스트리 (멀티스쿨) ──
   jbnu는 레거시 호환: Firebase/localStorage 키가 무접두 학년키(premed2 등) */
var SCHOOLS={
  jbnu:{name:'전북대학교',dept:'의과대학',
    grades:[
      {label:'의예과 2학년',desc:'예과 2년차'},
      {label:'의학과 1학년',desc:'본과 1년차'},
      {label:'의학과 2학년',desc:'본과 2년차'}
    ]},
  kmu:{name:'계명대학교',dept:'의과대학',
    grades:[
      {label:'의예과 1학년'},{label:'의예과 2학년'},
      {label:'의학과 1학년'},{label:'의학과 2학년'},
      {label:'의학과 3학년'},{label:'의학과 4학년'}
    ]},
  wku:{name:'원광대학교',dept:'의과대학',
    grades:[
      {label:'의예과 1학년'},{label:'의예과 2학년'},
      {label:'의학과 1학년'},{label:'의학과 2학년'},
      {label:'의학과 3학년'},{label:'의학과 4학년'}
    ]}
};
var SCHOOL_ORDER=['jbnu','kmu','wku'];

/* 학년별 관리자 비밀번호 (jbnu 레거시) */
var ADMIN_PWS={
  '의예과 2학년':'jbnupremed2',
  '의학과 1학년':'jbnumed1',
  '의학과 2학년':'jbnumed2'
};
/* 타 학교 관리자 비밀번호: {schoolKey:{학년:pw}} */
var ADMIN_PWS_EXT={
  wku:{'의예과 1학년':'wkupremed1','의예과 2학년':'wkupremed2','의학과 1학년':'wkumed1',
       '의학과 2학년':'wkumed2','의학과 3학년':'wkumed3','의학과 4학년':'wkumed4'},
  kmu:{'의예과 1학년':'kmupremed1','의예과 2학년':'kmupremed2','의학과 1학년':'kmumed1',
       '의학과 2학년':'kmumed2','의학과 3학년':'kmumed3','의학과 4학년':'kmumed4'}
};
function adminPwFor(school,grade){
  if((school||'jbnu')==='jbnu')return ADMIN_PWS[grade];
  return (ADMIN_PWS_EXT[school]||{})[grade];
}
var SHARED_KEY='shared_timetable_v2';
var NOTIF_KEY='shared_notif_v2';

/* 기본 교시(전북대·계명대·원광대 공통). 학교별 상이 시 SCHOOLS[key].periods로 정의:
   {times:{1:['8:30','9:20'],...}, lunchAfter:4} — applySchoolPeriods()가 아래 전역을 덮어씀 */
var DEFAULT_PERIODS={
  times:{1:['8:30','9:20'],2:['9:30','10:20'],3:['10:30','11:20'],4:['11:30','12:20'],
    5:['13:30','14:20'],6:['14:30','15:20'],7:['15:30','16:20'],8:['16:30','17:20'],
    9:['17:30','18:20'],10:['18:30','19:20']},
  lunchAfter:4,lunchLabel:'점심시간  12:20 ~ 13:30'
};
var SCHOOL_LUNCH_AFTER=4,SCHOOL_LUNCH_LABEL=DEFAULT_PERIODS.lunchLabel;
function applySchoolPeriods(){
  var sc=(typeof SCHOOLS!=='undefined')&&SCHOOLS[savedSchool||'jbnu'];
  var conf=(sc&&sc.periods)||DEFAULT_PERIODS;
  PERIOD_START={};PERIOD_END={};PERIOD_INFO={};
  Object.keys(conf.times).forEach(function(k){
    PERIOD_START[k]=conf.times[k][0];
    PERIOD_END[k]=conf.times[k][1];
    PERIOD_INFO[k]={label:k+'교시',time:conf.times[k][0]+'~'+conf.times[k][1]};
  });
  SCHOOL_LUNCH_AFTER=(conf.lunchAfter!=null)?conf.lunchAfter:4;
  SCHOOL_LUNCH_LABEL=conf.lunchLabel||DEFAULT_PERIODS.lunchLabel;
}
var PERIOD_INFO={
  1:{label:'1교시',time:'08:30~09:20'},2:{label:'2교시',time:'09:30~10:20'},
  3:{label:'3교시',time:'10:30~11:20'},4:{label:'4교시',time:'11:30~12:20'},
  5:{label:'5교시',time:'13:30~14:20'},6:{label:'6교시',time:'14:30~15:20'},
  7:{label:'7교시',time:'15:30~16:20'},8:{label:'8교시',time:'16:30~17:20'},
  9:{label:'9교시',time:'17:30~18:20'},10:{label:'10교시',time:'18:30~19:20'}
};
var PERIOD_START={1:'8:30',2:'9:30',3:'10:30',4:'11:30',5:'13:30',6:'14:30',7:'15:30',8:'16:30',9:'17:30',10:'18:30'};
var PERIOD_END  ={1:'9:20',2:'10:20',3:'11:20',4:'12:20',5:'14:20',6:'15:20',7:'16:20',8:'17:20',9:'18:20',10:'19:20'};
