var ci=0, vw='weekly', cy, cm2;
var savedGrade=''; /* 전역 - init()에서 설정됨 */
var savedSchool=''; /* 학교 키 (jbnu/kmu/...) - init()에서 설정, 미설정 시 jbnu 취급 */
var fExam=false, fsubj2=fsubj.slice();
var pendingData=null; // 엑셀 업로드 대기 데이터
var isAdmin=false;
var admEditIdx=-1;
var _workingMerged=null;
