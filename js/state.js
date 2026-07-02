var ci=0, vw='weekly', cy, cm2;
var savedGrade=''; /* 전역 - init()에서 설정됨 */
var fExam=false, fsubj2=fsubj.slice();
var pendingData=null; // 엑셀 업로드 대기 데이터
var isAdmin=false;
var admEditIdx=-1;
var _workingMerged=null;
