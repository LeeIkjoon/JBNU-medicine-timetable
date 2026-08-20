# -*- coding: utf-8 -*-
"""2026-2학기 의학과 1·2학년 시간표 xlsx → 앱 Firebase 페이로드(JSON) 변환.

- 셀 파싱은 js/parsers/xlsx.js의 parseNativeCell을 그대로 포팅
  (앱에서 직접 업로드했을 때와 동일한 결과가 되도록)
- 무명 '시험' 셀은 직전 블록 과목으로 과목명 부여 (원본 하단 범례 순서로 검증됨)
- '기초의학종합평가(1학년)' → '기초의학종합평가', is_exam 처리

사용: python3 tools/build_med_2026_2.py <xlsx경로> <출력디렉토리>
"""
import sys, re, json, time, os
import openpyxl

PERIOD_START = {1:'8:30',2:'9:30',3:'10:30',4:'11:30',5:'13:30',6:'14:30',7:'15:30',8:'16:30',9:'17:30',10:'18:30'}
PERIOD_END   = {1:'9:20',2:'10:20',3:'11:20',4:'12:20',5:'14:20',6:'15:20',7:'16:20',8:'17:20',9:'18:20',10:'19:20'}

# 무명 '시험' 셀 → 과목명 (날짜 기준; 직전 블록 과목으로 확인됨)
EXAM_RENAME = {
    '의학과 1학년': {
        '2026-10-06': '감염학', '2026-10-16': '종양학', '2026-11-11': '소화기학',
        '2026-12-01': '심장혈관학', '2026-12-17': '신장비뇨의학', '2026-12-31': '환자의사사회2',
    },
    '의학과 2학년': {
        '2026-09-14': '환자의사사회 4', '2026-10-12': '신경학', '2026-11-03': '정신의학',
        '2026-11-23': '피부 및 시청각학', '2026-12-10': '손상과 주술기의학', '2026-12-30': '내분비-대사학',
    },
}

def parse_native_cell(val):
    """js/parsers/xlsx.js parseNativeCell 포팅"""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s == ',':
        return None
    lines = [l.strip() for l in re.split(r'[\n\r]+', s) if l.strip()]
    main = lines[0]
    extra = ' '.join(lines[1:]) if len(lines) > 1 else ''
    subj, prof = main, ''
    di = main.rfind('-')
    if di > 0:
        before, after = main[:di].strip(), main[di+1:].strip()
        if 2 <= len(after) <= 5 and re.fullmatch(r'[가-힣]+', after):
            subj, prof = before, after
        elif re.fullmatch(r'[A-Z,\s]+', after):
            subj, prof = before, after
    if extra:
        ed = extra.rfind('-')
        if ed > 0:
            e_after = extra[ed+1:].strip()
            if 2 <= len(e_after) <= 5 and re.fullmatch(r'[가-힣]+', e_after):
                if not prof:
                    prof = e_after
            else:
                e_before = extra[:ed].strip()
                if e_before and not re.match(r'^\d', e_before):
                    subj = subj + ' ' + e_before
                if not prof and e_after and re.fullmatch(r'[가-힣]+', e_after):
                    prof = e_after
        else:
            if not re.match(r'^\d', extra):
                subj = subj + ' ' + extra
    return subj, prof

def build(ws, max_row, grade):
    rename = EXAM_RENAME.get(grade, {})
    items, wdd = [], {}
    week = None
    for row in ws.iter_rows(min_row=2, max_row=max_row, max_col=13):
        v = [c.value for c in row]
        if v[0] is not None:
            week = str(int(v[0])) if isinstance(v[0], (int, float)) else str(v[0]).strip()
        if v[1] is None or week is None:
            continue
        date, day = str(v[1])[:10], str(v[2]).strip()
        wdd.setdefault(week, {})[day] = date
        for col in range(3, 13):
            parsed = parse_native_cell(v[col])
            if not parsed or not parsed[0]:
                continue
            subj, prof = parsed
            if subj == '시험' and date in rename:
                subj = rename[date] + ' 시험'
            if subj.startswith('기초의학종합평가'):
                subj = '기초의학종합평가'
            if subj == '임상의학입문':
                subj = '임상의학입문 1-2'  # 멀티라인 셀의 세부번호(1-2)가 파서에서 떨어져 나감
            is_exam = '시험' in subj or '퀴즈' in subj or '종합평가' in subj
            period = col - 2
            items.append({
                'week': week, 'date': date, 'day': day, 'period': period,
                'start': PERIOD_START[period], 'end': PERIOD_END[period],
                'subject': subj, 'professor': prof, 'is_exam': is_exam,
            })
    ed = sorted({it['date'] for it in items if it['is_exam']})
    wks = sorted({it['week'] for it in items}, key=int)
    ts = int(time.time() * 1000)
    return {
        'items': items, 'wdd': wdd, 'ed': ed, 'wks': wks,
        'grade': grade, 'ts': ts,
        'changelog': {'ts': ts, 'msg': '2026-2학기 시간표 적용'},
    }

def main(xlsx_path, out_dir):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    targets = [
        ('2026학년도 2학기(1학년)', 129, '의학과 1학년', 'med1'),
        ('2학년', 126, '의학과 2학년', 'med2'),
    ]
    from collections import Counter
    for sheet, max_row, grade, key in targets:
        payload = build(wb[sheet], max_row, grade)
        out = os.path.join(out_dir, key + '_2026_2.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        items = payload['items']
        cnt = Counter(it['subject'] for it in items)
        print(f'== {grade} → {out}')
        print('items:', len(items), '| weeks:', payload['wks'][0], '~', payload['wks'][-1], '| exam dates:', payload['ed'])
        for s, n in cnt.most_common():
            nprof = len({it['professor'] for it in items if it['subject'] == s and it['professor']})
            print(f'  {n:4d}  {s}  (교수 {nprof}명)')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
