# -*- coding: utf-8 -*-
"""원광대 의대 2026-2학기 통합교육과정 일일시간표 PDF → 앱 페이로드 변환.

- 주차별 그리드 페이지(대상학년/수업 주 헤더)를 학년별로 분리 파싱
- 셀 병합은 pdfplumber 테이블 셀 bbox로 교시 범위 계산
- 셀 구조: [과목배지] / 강의주제(여러 줄) / (교수) → subject/topic/professor
- 세로쓰기 휴일(대체휴일 등)·행사 셀 처리, 시험 키워드 → is_exam

사용: python3 tools/build_wku_2026_2.py <pdf경로> <출력디렉토리>
"""
import sys, os, re, json, time
import pdfplumber

HOLIDAY_KW = ['대체휴일','추석','설날','개교기념','대각개교','한글날','개천절','성탄절','신정',
              '현충일','광복절','삼일절','국군의날','어린이날','근로자의날','지방선거','육일대재','예과체육']
EXAM_RE = re.compile(r'시험|고사|평가')  # 원광대는 시험을 'N차 평가'로 표기
NOT_EXAM_RE = re.compile(r'교육과정\s*평가')  # 강의평가류는 시험 아님

def is_holiday(s):
    return any(k in s for k in HOLIDAY_KW)

def parse_cell(text):
    """셀 텍스트 → (subject, topic, professor, is_exam) 또는 None"""
    if not text or not text.strip():
        return None
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return None
    # 세로쓰기(대/체/휴/일): 전부 1~2글자 줄이면 이어붙임
    if len(lines) >= 2 and all(len(l) <= 2 for l in lines):
        lines = [''.join(lines)]
    joined = ' '.join(lines)
    if is_holiday(joined):
        return (''.join(lines) if len(joined) <= 12 else lines[0], '', '', False, '')
    subject = lines[0]
    rest = lines[1:]
    prof = ''
    # 마지막 줄이 (교수명) — (N분반)은 교수 아님
    if rest and re.fullmatch(r'\([가-힣A-Za-z·, ]{2,20}\)', rest[-1]) and '분반' not in rest[-1]:
        prof = rest[-1][1:-1].strip()
        rest = rest[:-1]
    topic = ' '.join(rest).strip()
    sec = ''
    sm = re.search(r'\(?\s*([12])\s*분반\s*\)?', topic)
    if sm:
        sec = sm.group(1)
        topic = re.sub(r'\(?\s*[12]\s*분반\s*\)?', '', topic).strip()
    is_exam = bool(EXAM_RE.search(joined)) and not NOT_EXAM_RE.search(joined)
    return (subject, topic, prof, is_exam, sec)

def build_grade(pages, grade_label):
    """해당 학년의 주차 페이지들 → items/wdd/ed/wks"""
    items, wdd = [], {}
    for pg, week in pages:
        tables = pg.find_tables()
        if not tables:
            continue
        tb = tables[0]
        grid = tb.extract()
        if not grid or len(grid) < 2:
            continue
        # 헤더에서 요일·날짜 (컬럼 2~6)
        hdr = grid[0]
        col_days = {}  # col index -> (day, date)
        for ci, h in enumerate(hdr):
            m = re.match(r'([월화수목금])\((\d+)\.(\d+)\)', (h or '').strip())
            if m:
                d, mm, dd = m.group(1), int(m.group(2)), int(m.group(3))
                col_days[ci] = (d, f'2026-{mm:02d}-{dd:02d}')
        if not col_days:
            continue
        for d, dt in col_days.values():
            wdd.setdefault(week, {})[d] = dt
        # 교시 행 경계: 데이터 행들의 y 경계 (find_tables의 rows에서)
        # grid 행 1..N = 교시 1..N. 시간은 컬럼1에서 읽음
        times = {}
        for ri in range(1, len(grid)):
            t = (grid[ri][1] or '').strip()
            m = re.match(r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})', t)
            if m:
                times[ri] = (m.group(1).lstrip('0') or '0', m.group(2).lstrip('0') or '0')
        # 병합 처리: extract()는 병합 셀의 첫 행에만 텍스트, 이후 '' 또는 None.
        # 셀 bbox 기반이 정확하지만 extract 결과의 빈칸 규칙(병합=None, 진짜 빈칸='')을 활용
        for ci in col_days:
            d, dt = col_days[ci]
            ri = 1
            while ri < len(grid):
                raw = grid[ri][ci]
                if raw is None:  # 병합 연속 — 위에서 처리됨
                    ri += 1
                    continue
                if not raw.strip():
                    ri += 1
                    continue
                # 이 셀이 커버하는 교시 범위: 다음 non-None 행 전까지
                span_end = ri
                for rj in range(ri + 1, len(grid)):
                    if grid[rj][ci] is None:
                        span_end = rj
                    else:
                        break
                parsed = parse_cell(raw)
                if parsed:
                    subject, topic, prof, is_exam, sec = parsed
                    for p in range(ri, span_end + 1):
                        if p not in times:
                            continue
                        st, en = times[p]
                        it = {'week': week, 'date': dt, 'day': d, 'period': p,
                              'start': st, 'end': en, 'subject': subject,
                              'professor': prof, 'is_exam': is_exam}
                        if topic:
                            it['topic'] = topic
                        if sec:
                            it['sec'] = sec
                        items.append(it)
                ri = span_end + 1
    ed = sorted({it['date'] for it in items if it['is_exam']})
    wks = sorted({it['week'] for it in items}, key=int)
    ts = int(time.time() * 1000)
    return {'items': items, 'wdd': wdd, 'ed': ed, 'wks': wks,
            'grade': grade_label, 'ts': ts,
            'changelog': {'ts': ts, 'msg': '2026-2학기 시간표 적용'}}

def main(pdf_path, out_dir):
    pdf = pdfplumber.open(pdf_path)
    by_grade = {}
    for pg in pdf.pages:
        txt = (pg.extract_text() or '')
        gm = re.search(r'대상학년\s*[:：]\s*(의예과|의학과)\s*(\d)학년', txt)
        wm = re.search(r'수\s*업\s*주\s*[:：]\s*(\d+)\s*주', txt)
        if not gm or not wm:
            continue
        label = f'{gm.group(1)} {gm.group(2)}학년'
        by_grade.setdefault(label, []).append((pg, wm.group(1)))

    from collections import Counter
    for label, pages in by_grade.items():
        payload = build_grade(pages, label)
        key = 'wku_' + label.replace(' ', '_')
        out = os.path.join(out_dir, key + '.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        cnt = Counter(i['subject'] for i in payload['items'])
        print(f'== {label} → {out}')
        print('  items:', len(payload['items']), '| weeks:', payload['wks'][:1], '~', payload['wks'][-1:],
              '| exam dates:', len(payload['ed']))
        for s, n in cnt.most_common(12):
            nprof = len({i['professor'] for i in payload['items'] if i['subject'] == s and i['professor']})
            print(f'  {n:4d}  {s[:24]}  (교수 {nprof}명)')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
