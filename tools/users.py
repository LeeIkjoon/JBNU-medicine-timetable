# -*- coding: utf-8 -*-
"""사용자 수 보기 — Firebase study/presence(익명 핑: 학교·학년·마지막 사용 시각)를 읽어 요약한다.
코드 하나 = 기기 하나(같은 코드·같은 구글 계정으로 묶은 기기는 한 명으로 셈).
사용: python3 tools/users.py"""
import json, urllib.request, collections, datetime
D = json.load(urllib.request.urlopen('https://jbnu-med-timetable-default-rtdb.firebaseio.com/study/presence.json')) or {}
now = datetime.datetime.now().timestamp() * 1000
print('전체(한 번이라도 쓴 사람):', len(D))
for n, lbl in ((1, '오늘(24시간)'), (7, '최근 7일'), (30, '최근 30일')):
    print(' ', lbl + ':', sum(1 for v in D.values() if now - v.get('ts', 0) < n * 86400000))
c = collections.Counter((v.get('school'), v.get('grade')) for v in D.values())
print('학교·학년별:')
for (s, g), n in c.most_common():
    print('  %-8s %-10s %d' % (s, g, n))
