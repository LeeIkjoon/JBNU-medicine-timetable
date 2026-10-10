# -*- coding: utf-8 -*-
"""사용자 수 보기 — 폰 기준.

앱은 설치된 곳(기기·브라우저)마다 코드를 하나씩 만들기 때문에 코드 수는 사람 수보다 많다
(폰+아이패드, 사파리+홈 화면 앱, 주소 이전 전의 옛 코드). 그래서 '폰 대수'를 사람 수로 본다.
  - 최소: 홈 화면 앱으로 쓰는 폰
  - 최대: 브라우저로만 쓰는 폰까지 더한 수 (일부는 홈 화면 앱과 같은 사람)
기기 종류는 study/presence 의 dev·sa(2026-10-11 이후 기록) 또는 study/synclog 의 접속 정보로 구분한다.
자동 테스트(맥 브라우저에서 새로 생긴 빈 코드)는 뺀다.

사용: python3 tools/users.py
"""
import json, subprocess, collections, datetime

DB = 'https://jbnu-med-timetable-default-rtdb.firebaseio.com/study/'
def get(path):  # 이 맥의 파이썬은 인증서 묶음이 없어 urllib가 실패한다 — curl로 받음
    return json.loads(subprocess.check_output(['curl', '-s', DB + path + '.json'])) or {}

pr, sl = get('presence'), get('synclog')
KST = datetime.timezone(datetime.timedelta(hours=9))
day = lambda ts: datetime.datetime.fromtimestamp(ts / 1000, KST).strftime('%m-%d')
now = datetime.datetime.now().timestamp() * 1000

rows = []
for code, v in pr.items():
    s = (sl.get(code) or {}).get('start') or {}
    ua = s.get('ua', '')
    dev, sa = v.get('dev'), v.get('sa')
    if not dev:
        dev = ('phone' if ('iPhone' in ua or 'Android' in ua or 'Linux' in ua) else
               'tablet' if ('iPad' in ua or ('Macintosh' in ua and s.get('standalone'))) else
               'pc' if ('Macintosh' in ua or 'Windows' in ua) else '?')
        sa = s.get('standalone')
    # 자동 테스트: 맥 브라우저, 10/8 이후 처음 시작, 저장된 것이 거의 없음
    test = (not v.get('dev') and 'Macintosh' in ua and s.get('standalone') is False
            and s.get('ts') and day(s['ts']) >= '10-08' and (s.get('local') or 0) <= 12)
    rows.append(dict(sc=v.get('school'), g=v.get('grade'), dev=dev, sa=bool(sa), last=v.get('ts', 0), test=test))

real = [r for r in rows if not r['test']]
def line(rs, days=None):
    if days: rs = [r for r in rs if now - r['last'] < days * 86400000]
    ph = [r for r in rs if r['dev'] == 'phone']
    app = sum(1 for r in ph if r['sa'])
    return '%3d ~ %-3d명  (폰 홈 화면 앱 %d, 폰 브라우저 %d · 태블릿·PC %d)' % (
        app, len(ph), app, len(ph) - app, sum(1 for r in rs if r['dev'] in ('tablet', 'pc')))

print('사용자 수 (폰 기준 추정)')
print('  전체      ', line(real))
print('  최근 7일  ', line(real, 7))
print('  최근 24시간', line(real, 1))
print('학교·학년별 (최근 7일)')
groups = collections.defaultdict(list)
for r in real: groups[(r['sc'], r['g'])].append(r)
for (sc, g), rs in sorted(groups.items(), key=lambda kv: -sum(1 for r in kv[1] if r['dev'] == 'phone')):
    if any(now - r['last'] < 7 * 86400000 for r in rs):
        print('  %-7s %-9s' % (sc, g), line(rs, 7))
print('참고: 전체 코드 %d개 = 폰·태블릿·PC %d + 종류를 알 수 없는 옛 기록 %d + 자동 테스트 %d' % (
    len(rows), sum(1 for r in real if r['dev'] != '?'), sum(1 for r in real if r['dev'] == '?'), len(rows) - len(real)))
