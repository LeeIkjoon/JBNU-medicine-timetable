# -*- coding: utf-8 -*-
"""단국대 의대 강의시간표 PDF → 앱 페이로드 변환 (예시/사전 학습용).

구조 (24-1 공개용 PDF 기준):
- 과목 블록별 페이지: "YYYY-N 본K {과목명} 시간표"
- 테이블: 'N 주' 행(요일별 'M월 D일' 날짜) → 이어지는 '{교시}교시 / HH:MM~HH:MM' 행들
- 셀: '강의주제\\n(교수)', 휴일('설 날' 등)·'시험' 셀 존재
- 본3·4(이론수업 요약)·의예과 페이지는 형식이 달라 이 변환기 범위 밖

사용: python3 tools/build_dku.py <pdf경로> <출력디렉토리>
"""
import sys, os, re, json, time
from datetime import date
import pdfplumber

HOLIDAY_KW = ['설 날','설날','추석','대체휴일','대체 휴일','개교기념','한글날','개천절','현충일',
              '광복절','삼일절','성탄절','신정','어린이날','부처님','석가탄신','근로자의날','휴 일','휴일','공휴일']
DAYS = ['월','화','수','목','금']

def is_holiday(s):
    t = s.replace(' ', '')
    return any(k.replace(' ', '') in t for k in HOLIDAY_KW)

def parse_cell(text, subject):
    if not text or not text.strip():
        return None
    s = text.strip()
    lines = [l.strip() for l in s.split('\n') if l.strip()]
    joined = ' '.join(lines)
    if is_holiday(joined):
        return {'subject': joined if len(joined) <= 8 else lines[0], 'topic': '', 'prof': '', 'exam': False, 'holiday': True}
    prof = ''
    if lines and re.fullmatch(r'\([가-힣A-Za-z·, ]{2,20}\)', lines[-1]):
        prof = lines[-1][1:-1].strip()
        lines = lines[:-1]
    topic = ' '.join(lines).strip()
    exam = bool(re.search(r'시험|고사|평가', joined)) and '교육과정' not in joined
    return {'subject': subject, 'topic': topic, 'prof': prof, 'exam': exam, 'holiday': False}

def main(pdf_path, out_dir):
    pdf = pdfplumber.open(pdf_path)
    # 학년별 수집: {'의학과 2학년': [items...]}
    by_grade = {}
    for pg in pdf.pages:
        head = (pg.extract_text() or '')[:80]
        tm = re.search(r'(\d{4})-(\d)\S*\s+(본|예)(\d)\s+(.+?)\s*시간표', head)
        if not tm:
            continue
        year = int(tm.group(1))
        dept = '의학과' if tm.group(3) == '본' else '의예과'
        grade_label = f'{dept} {tm.group(4)}학년'
        subject = tm.group(5).strip()
        tables = pg.find_tables()
        if not tables:
            continue
        grid = tables[0].extract()
        cur_dates = {}   # day -> 'YYYY-MM-DD'
        for row in grid:
            c0 = (row[0] or '').replace('\n', ' ').strip()
            # 주차 행: 'N 주' + 날짜들
            if re.fullmatch(r'\d+\s*주', c0):
                cur_dates = {}
                for di, d in enumerate(DAYS):
                    if di + 1 >= len(row):
                        break
                    dm = re.search(r'(\d{1,2})\s*월\s*(\d{1,2})\s*일', (row[di + 1] or ''))
                    if dm:
                        cur_dates[d] = f'{year}-{int(dm.group(1)):02d}-{int(dm.group(2)):02d}'
                continue
            # 교시 행
            pm = re.match(r'(\d+)\s*교시\s*/\s*(\d{1,2}:\d{2})\s*[~〜-]\s*(\d{1,2}:\d{2})', c0)
            if not pm or not cur_dates:
                continue
            period = int(pm.group(1))
            st, en = pm.group(2).lstrip('0') or '0', pm.group(3).lstrip('0') or '0'
            for di, d in enumerate(DAYS):
                if di + 1 >= len(row) or d not in cur_dates:
                    continue
                parsed = parse_cell(row[di + 1], subject)
                if not parsed:
                    continue
                it = {'date': cur_dates[d], 'day': d, 'period': period,
                      'start': st, 'end': en,
                      'subject': parsed['subject'], 'professor': parsed['prof'],
                      'is_exam': parsed['exam']}
                if parsed['topic'] and not parsed['holiday']:
                    it['topic'] = parsed['topic']
                by_grade.setdefault(grade_label, []).append(it)

    from collections import Counter
    for grade_label, items in by_grade.items():
        # 글로벌 주차 재계산: 가장 이른 날짜가 속한 주의 월요일 기준
        def monday(ds):
            y, m, dd = map(int, ds.split('-'))
            dt = date(y, m, dd)
            return dt.toordinal() - dt.weekday()
        base = min(monday(i['date']) for i in items)
        wdd = {}
        for i in items:
            wk = str((monday(i['date']) - base) // 7 + 1)
            i['week'] = wk
            wdd.setdefault(wk, {})[i['day']] = i['date']
        ed = sorted({i['date'] for i in items if i['is_exam']})
        wks = sorted({i['week'] for i in items}, key=int)
        ts = int(time.time() * 1000)
        payload = {'items': items, 'wdd': wdd, 'ed': ed, 'wks': wks,
                   'grade': grade_label, 'ts': ts,
                   'changelog': {'ts': ts, 'msg': '시간표 적용'}}
        key = 'dku_' + grade_label.replace(' ', '_')
        out = os.path.join(out_dir, key + '.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        cnt = Counter(i['subject'] for i in items)
        print(f'== {grade_label} → {out}')
        print('  items:', len(items), '| weeks:', wks[0], '~', wks[-1], '| 시험일:', len(ed))
        for s, n in cnt.most_common(10):
            nprof = len({i['professor'] for i in items if i['subject'] == s and i['professor']})
            print(f'  {n:4d}  {s[:20]}  (교수 {nprof}명)')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
