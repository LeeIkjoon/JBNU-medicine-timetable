# -*- coding: utf-8 -*-
"""가톨릭관동대 의대 2026-2 의학과 4학년 '응급,중환자 통합교육' 시간표(v2, 학생용 PDF) → 앱 페이로드.

PDF는 요일×교시 격자 2쪽(10/12~10/23)이고 병합 셀이 텍스트 추출에서 뒤섞여 나와서,
표를 눈으로 읽어 아래 TABLE에 옮겨 적었다(파일이 바뀌면 TABLE만 고치면 됨).
교시: 09:00~17:50 50분 단위, 4교시 없이 11:50~13:00 점심 (config.js SCHOOLS.cku.periods).
과목명 = 칸 제목 그대로(통합교육 한 블록이라 강의마다 구분되게, 아주대와 같은 방식), 대면=라파엘관 120 / ZOOM은 room.

사용: python3 tools/build_cku_2026_2.py <출력디렉토리>
"""
import sys, os, json, time
from datetime import date

GRADE = '의학과 4학년'
ROOM = '라파엘관 120'
PS = {1:'9:00',2:'10:00',3:'11:00',5:'13:00',6:'14:00',7:'15:00',8:'16:00',9:'17:00'}
PE = {1:'9:50',2:'10:50',3:'11:50',5:'13:50',6:'14:50',7:'15:50',8:'16:50',9:'17:50'}
WKN = ['월','화','수','목','금','토','일']
F, Z = '대면', 'ZOOM'

# (날짜, 교시들, 제목, 교수, 방식) — 방식 None이면 과목 자체가 제목(자기주도학습·학생미사)
TABLE = [
 ('2026-10-12',[1],'자기주도학습','',None),
 ('2026-10-12',[2,3],'기본소생술(BLS)','곽세정',F),
 ('2026-10-12',[5],'통합강의 소개','김종선',F),
 ('2026-10-12',[6,7],'응급의료체계 및 재난의학','김종선',F),
 ('2026-10-12',[8,9],'환경의학','송명제',F),
 ('2026-10-13',[1],'학생미사','',None),
 ('2026-10-13',[2,3],'소아기본소생술(PBLS), 이물질 기도폐쇄','차민수',F),
 ('2026-10-13',[5],'응급의학 개요','김준식',F),
 ('2026-10-13',[6],'임상독성학총론','윤성현',F),
 ('2026-10-13',[7,8],'임상독성학각론','윤성현',F),
 ('2026-10-14',[1,2,3],'전문외상소생술(ATLS)','박종수',F),
 ('2026-10-14',[5],'중환자실의 구조와 운영 & 중환자 중증도 분류 및 평가','박종수',F),
 ('2026-10-14',[6,7],'중환자실 감염관리','신소연',Z),
 ('2026-10-15',[1,2,3],'전문심장소생술(ACLS)','정창환',F),
 ('2026-10-15',[5,6,7],'Shock 진단과 치료','정창환',F),
 ('2026-10-16',[1,2],'소아전문소생술(PALS)','조태진',F),
 ('2026-10-16',[3],'신생아 소생술','김호',Z),
 ('2026-10-16',[5],'중환자실 환자의 통증, 진정 및 섬망 관리','홍관영',Z),
 ('2026-10-16',[6],'중환자감시','홍관영',Z),
 ('2026-10-19',[2,3],'소아 중환자 의학','이경훈',F),
 ('2026-10-19',[7],'지속적신대체요법(CRRT)','김승준',Z),
 ('2026-10-19',[8],'중환자 치료의 유보와 중지 및 뇌사자 장기공여자 관리','김윤호',Z),
 ('2026-10-20',[1],'학생미사','',None),
 ('2026-10-20',[2,3],'기계호흡','정재호',Z),
 ('2026-10-20',[6],'안전수혈술기','김영욱',Z),
 ('2026-10-20',[7],'기관삽관법','김영욱',Z),
 ('2026-10-21',[1],'체외막산소화장치(ECMO)','박형복',F),
 ('2026-10-21',[6,7],'국제보건','김훈',Z),
 ('2026-10-22',[1],'과정형성평가','',F),
 ('2026-10-22',[6,7],'응급의료체계에 대한 정책과 법률','이봉문',F),
 ('2026-10-23',[2,3],'종합 시험','김종선','EXAM'),
 ('2026-10-23',[6],'피드백','김종선',F),
]

def main(out_dir):
    items, wdd, ed = [], {}, set()
    d0 = date.fromisoformat(TABLE[0][0]); mon0 = d0.toordinal() - d0.weekday()
    for ds, ps, title, prof, mode in TABLE:
        d = date.fromisoformat(ds)
        week = str((d.toordinal() - mon0) // 7 + 1); day = WKN[d.weekday()]
        for p in ps:
            it = {'week': week, 'date': ds, 'day': day, 'period': p, 'start': PS[p], 'end': PE[p],
                  'subject': title, 'professor': prof, 'is_exam': mode == 'EXAM'}
            if mode:
                it['room'] = 'ZOOM' if mode == Z else ROOM
            items.append(it)
        wdd.setdefault(week, {})[day] = ds
        if mode == 'EXAM': ed.add(ds)
    for wk, dd in wdd.items():
        a = date.fromisoformat(next(iter(dd.values()))); mon = a.toordinal() - a.weekday()
        for i in range(5): dd.setdefault(WKN[i], date.fromordinal(mon + i).isoformat())
    items.sort(key=lambda x: (x['date'], x['period']))
    wks = sorted(wdd, key=int); ts = int(time.time() * 1000)
    payload = {'items': items, 'wdd': {k: wdd[k] for k in wks}, 'ed': sorted(ed), 'wks': wks,
               'grade': GRADE, 'ts': ts, 'changelog': {'ts': ts, 'msg': '2026-2 응급·중환자 통합교육 시간표(v2) 적용'}}
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'cku_' + GRADE.replace(' ', '_') + '.json')
    json.dump(payload, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(out, len(items), '항목', '주차', wks, '시험일', sorted(ed))

if __name__ == '__main__':
    main(sys.argv[1])
