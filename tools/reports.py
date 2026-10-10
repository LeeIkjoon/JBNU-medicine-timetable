# -*- coding: utf-8 -*-
"""시간표 신고 보기 — Firebase study/reports. 학교·학년별로 묶어 최근 것부터 보여준다.
잘못 올라온 기본 시간표를 내리려면: curl -X DELETE "<DB>/timetable/<키>.json" (키는 출력의 key).
사용: python3 tools/reports.py"""
import json, subprocess, collections, datetime
D = json.loads(subprocess.check_output(['curl', '-s', 'https://jbnu-med-timetable-default-rtdb.firebaseio.com/study/reports.json'])) or {}
KST = datetime.timezone(datetime.timedelta(hours=9))
R = {'wrong': '다른 학교·학년', 'errors': '틀린 내용 많음', 'old': '지난 학기', 'bad': '부적절', 'etc': '기타'}
g = collections.defaultdict(list)
for v in D.values(): g[(v.get('school'), v.get('grade'), v.get('key'))].append(v)
print('신고 %d건 · 시간표 %d개' % (len(D), len(g)))
for (sc, gr, key), rs in sorted(g.items(), key=lambda kv: -max(r.get('ts', 0) for r in kv[1])):
    who = len(set(r.get('code') for r in rs))
    print('\n%s %s  (key: %s)  신고 %d건 · %d명' % (sc, gr, key, len(rs), who))
    for r in sorted(rs, key=lambda r: -r.get('ts', 0))[:8]:
        t = datetime.datetime.fromtimestamp(r.get('ts', 0) / 1000, KST).strftime('%m-%d %H:%M')
        print('  %s  %-10s %s' % (t, R.get(r.get('reason'), r.get('reason')), (r.get('text') or '').replace('\n', ' ')))
