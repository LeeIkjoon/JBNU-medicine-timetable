# -*- coding: utf-8 -*-
"""영남대 의대 2026-2 시간표 → 앱 페이로드 (의학과 1~4학년).

원본: 의대 홈페이지 '강의 시간표' 공개 조회 화면 http://jweb.yu.ac.kr/pyung/medi?attribute=medi_siganpyo
  (POST medi_siganpyo_list, yy=2026, fr_quater=U0333001~to_quater=U0333004, shyr=U023600N)
행 = 날짜, 열 = 1~12교시. 칸은 안쪽 표 3줄(과목 / 강의주제 / 교수), 이어지는 교시는 colspan.
연간 전체(1~4쿼터)가 한 파일이라 2학기분(8월 이후)만 쓴다. 교시 시각은 화면에 없어 앱 기본 교시를 쓴다.

사용: python3 tools/build_yu_2026_2.py <html 저장 디렉토리> <출력디렉토리>
"""
import sys, os, re, json, time, html
from datetime import date

FROM = '2026-08-01'
PS = {1:'8:30',2:'9:30',3:'10:30',4:'11:30',5:'13:30',6:'14:30',7:'15:30',8:'16:30',9:'17:30',10:'18:30',11:'19:30',12:'20:30'}
PE = {1:'9:20',2:'10:20',3:'11:20',4:'12:20',5:'14:20',6:'15:20',7:'16:20',8:'17:20',9:'18:20',10:'19:20',11:'20:20',12:'21:20'}
WKN = ['월','화','수','목','금','토','일']

def txt(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

def build(n, src, out_dir):
    grade = '의학과 %d학년' % n
    t = open(os.path.join(src, 'yu_med%d_2026_all.html' % n), encoding='utf-8', errors='replace').read()
    items = []
    # 날짜 칸으로 행을 나눔
    parts = re.split(r'<td[^>]*class="[^"]*td-dt[^"]*"[^>]*>', t)[1:]
    for part in parts:
        dm = re.search(r'(20\d{2}-\d{2}-\d{2})', part[:80])
        if not dm: continue
        ds = dm.group(1)
        if ds < FROM: continue
        d = date.fromisoformat(ds)
        row = part.split('</tr>\n', 1)[0] if False else part
        # 이 행의 바깥 칸들: colspan + 안쪽 표
        p = 1
        for cm in re.finditer(r'<td class="td_l_cellover"[^>]*colspan="(\d+)"[^>]*>\s*<table[^>]*>(.*?)</table>', row, re.S):
            span = int(cm.group(1))
            inner = re.findall(r'<td[^>]*>(.*?)</td>', cm.group(2), re.S)
            subj = txt(inner[0]) if len(inner) > 0 else ''
            topic = txt(inner[1]) if len(inner) > 1 else ''
            prof = txt(inner[2]) if len(inner) > 2 else ''
            if (subj or topic) and d.weekday() <= 4:
                if not subj: subj, topic = topic, ''
                is_exam = bool(re.search(r'시험|고사|퀴즈|평가$', subj + ' ' + topic)) and not re.search(r'안내|오리엔|설명|해설|리뷰|피드백', topic)
                for q in range(p, p + span):
                    if q not in PS: continue
                    it = {'week': '', 'date': ds, 'day': WKN[d.weekday()], 'period': q, 'start': PS[q], 'end': PE[q],
                          'subject': subj, 'professor': prof.replace(',', ', ') if prof else '', 'is_exam': is_exam}
                    if topic: it['topic'] = topic
                    items.append(it)
            p += span
            if p > 12: break
    if not items:
        print(grade, '항목 없음'); return
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
    out = os.path.join(out_dir, 'yu_' + grade.replace(' ', '_') + '.json')
    json.dump(payload, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    import collections
    c = collections.Counter(i['subject'] for i in items); pc = collections.Counter(i['period'] for i in items)
    print(out.split('/')[-1], len(items), '항목', len(wks), '주', items[0]['date'], '~', items[-1]['date'], '시험일', len(ed))
    print('   과목:', c.most_common(8)); print('   교시:', sorted(pc.items()))

if __name__ == '__main__':
    for n in (1, 2, 3, 4): build(n, sys.argv[1], sys.argv[2])
