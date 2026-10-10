# -*- coding: utf-8 -*-
"""앱 파서 결과(JSON: {items,wddLocal,edLocal}) → Firebase 페이로드(data/2026-2/<학교>/<학교>_<학년>.json).
PDF·엑셀을 앱과 같은 파서로 읽은 결과를 기본 시간표로 등록할 때 쓴다.
사용: python3 tools/payload_from_result.py <결과.json> <학교키> "<학년>" "<변경 메모>" """
import sys, os, json, re, time
from datetime import date
res, school, grade, msg = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
r = json.load(open(res, encoding='utf-8'))
WKN = ['월', '화', '수', '목', '금', '토', '일']
items = []
for it in r['items']:
    s = it.get('subject', '')
    if re.match(r'^\d+\s*교시', s) or len(s) > 40: continue      # 머리 칸이 새어 들어온 것
    it = {k: v for k, v in it.items() if v not in (None, '') or k in ('professor',)}
    it['is_exam'] = bool(it.get('is_exam'))
    items.append(it)
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
           'changelog': {'ts': ts, 'msg': msg}}
out_dir = os.path.join('data', '2026-2', school); os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, school + '_' + grade.replace(' ', '_') + '.json')
json.dump(payload, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(out, len(items), '항목', len(wks), '주', items[0]['date'], '~', items[-1]['date'], '시험일', len(ed))
