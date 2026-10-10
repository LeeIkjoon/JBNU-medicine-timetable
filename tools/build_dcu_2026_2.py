# -*- coding: utf-8 -*-
"""대구가톨릭대 의대 2026-2 시간표 → 앱 페이로드.

원본: 의대 홈페이지의 공개 조회 화면(학생용 시간표)
  https://medicine.cu.ac.kr/content/03stud/22_time.php?p_grade=<코드>&p_sdate=2026-08-01&p_edate=2027-02-28&p_page=<n>
  학년 코드: 의예2=23, 의학1=18, 의학2=19, 의학3=20, 의학4=21
행 = 수업 1개: 학년 / 강의일(요일) / 교시 / 교과목(강의제목) / 담당교수(강의실). 빈 교시 행도 섞여 있다.
교시 시각은 화면에 없어 앱 기본 교시(8:30 시작 50분)를 쓴다.

사용: python3 tools/build_dcu_2026_2.py <html 저장 디렉토리> <출력디렉토리>
"""
import sys, os, re, json, time, glob, html
from datetime import date

GRADES = {'premed2': '의예과 2학년', 'med1': '의학과 1학년', 'med2': '의학과 2학년', 'med3': '의학과 3학년', 'med4': '의학과 4학년'}
PS = {1:'8:30',2:'9:30',3:'10:30',4:'11:30',5:'13:30',6:'14:30',7:'15:30',8:'16:30',9:'17:30',10:'18:30'}
PE = {1:'9:20',2:'10:20',3:'11:20',4:'12:20',5:'14:20',6:'15:20',7:'16:20',8:'17:20',9:'18:20',10:'19:20'}
WKN = ['월','화','수','목','금','토','일']

def txt(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

def rows_of(path):
    t = open(path, encoding='utf-8', errors='replace').read()
    m = re.search(r'<tbody>(.*?)</tbody>', t, re.S)
    if not m: return
    for tr in re.findall(r'<tr>(.*?)</tr>', m.group(1), re.S):
        dm = re.search(r'(20\d{2}-\d{2}-\d{2})', tr)
        pm = re.search(r'(\d{1,2})\s*교시', tr)
        if not dm or not pm: continue
        after = tr[pm.end():]
        tds = re.findall(r'<td[^>]*>(.*?)(?=<td|$)', after, re.S)
        if len(tds) < 2: continue
        c_sub, c_prof = tds[0], tds[1]
        tm = re.search(r'<p[^>]*>(.*?)</p>', c_sub, re.S)
        topic = txt(tm.group(1)) if tm else ''
        topic = re.sub(r'^\(\s*|\s*\)$', '', topic).strip()
        subj = txt(re.sub(r'<p[^>]*>.*?</p>', '', c_sub, flags=re.S))
        parts = re.split(r'<br\s*/?>', c_prof, maxsplit=1)
        prof = txt(parts[0])
        room = re.sub(r'^\(\s*|\s*\)$', '', txt(parts[1]) if len(parts) > 1 else '').strip()
        if not subj and not topic: continue
        yield dm.group(1), int(pm.group(1)), subj, topic, prof, room

def build(key, grade, src, out_dir):
    seen, items = set(), []
    for f in sorted(glob.glob(os.path.join(src, key + '_2026-2_p*.html'))):
        for ds, p, subj, topic, prof, room in rows_of(f):
            if p not in PS: continue
            if not subj: subj, topic = topic, ''      # 과목 없이 제목만 있는 행(오리엔테이션 등)
            if subj in ('테스트', 'test'): continue      # 조회 화면에 남아 있는 시험 입력
            k = (ds, p, subj, topic, prof)
            if k in seen: continue
            seen.add(k)
            d = date.fromisoformat(ds)
            if d.weekday() > 4: continue
            is_exam = bool(re.search(r'시험|고사|퀴즈', subj + ' ' + topic)) and not re.search(r'모의|설명|안내|오리엔', topic)
            it = {'week': '', 'date': ds, 'day': WKN[d.weekday()], 'period': p, 'start': PS[p], 'end': PE[p],
                  'subject': subj, 'professor': prof, 'is_exam': is_exam}
            if topic: it['topic'] = topic
            if room: it['room'] = room
            items.append(it)
    if not items:
        print(key, '항목 없음'); return
    items.sort(key=lambda x: (x['date'], x['period']))
    d0 = date.fromisoformat(items[0]['date']); mon0 = d0.toordinal() - d0.weekday()
    wdd, ed = {}, set()
    for it in items:
        d = date.fromisoformat(it['date'])
        it['week'] = str((d.toordinal() - mon0) // 7 + 1)
        wdd.setdefault(it['week'], {})[it['day']] = it['date']
        if it['is_exam']: ed.add(it['date'])
    for wk, dd in wdd.items():
        a = date.fromisoformat(next(iter(dd.values()))); mon = a.toordinal() - a.weekday()
        for i in range(5): dd.setdefault(WKN[i], date.fromordinal(mon + i).isoformat())
    wks = sorted(wdd, key=int); ts = int(time.time() * 1000)
    payload = {'items': items, 'wdd': {k: wdd[k] for k in wks}, 'ed': sorted(ed), 'wks': wks, 'grade': grade, 'ts': ts,
               'changelog': {'ts': ts, 'msg': '2026-2학기 시간표 적용(의대 홈페이지 공개 시간표 기준)'}}
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'dcu_' + grade.replace(' ', '_') + '.json')
    json.dump(payload, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    slots = {}
    for it in items: slots.setdefault((it['date'], it['period']), []).append(it['subject'])
    dup = sum(1 for v in slots.values() if len(v) > 1)
    print(out, len(items), '항목', len(wks), '주', items[0]['date'], '~', items[-1]['date'], '시험일', len(ed), '겹치는 칸', dup,
          '과목', len(set(i['subject'] for i in items)))

if __name__ == '__main__':
    for key, grade in GRADES.items():
        build(key, grade, sys.argv[1], sys.argv[2])
