# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Vanilla-JS PWA split across CSS modules in `css/`, JS modules in `js/`, a static `manifest.json`, and a slim `index.html` shell (≈185 lines, just markup + `<link>`/`<script>` tags). No build system, no `package.json`, no tests, no linter. There is no server side — Firebase is the only backend.

To run it, serve the folder statically (`python3 -m http.server`) and open it in a browser. `file://` no longer works for the full app because Firebase, the Excel/PDF upload, and the PWA install prompt all require `http(s)://`.

External dependencies are loaded from CDN at runtime:
- **SheetJS / xlsx 0.18.5** — Excel parsing.
- **Firebase 10.8.0 compat SDK** (`firebase-app-compat.js`, `firebase-database-compat.js`) — realtime DB sync. The init lives at the top of `js/firebase.js`.
- **PDF.js** — loaded lazily via `loadPdfJs()` in `js/parsers/pdf.js` only when a `.pdf` upload happens (원광대 timetable parsing).

The PWA manifest is now a static `manifest.json` with `icons/icon-180.png` on disk.

## File layout

CSS — loaded in this order from `<head>`:
```
css/tokens.css       (empty — Phase 2 design tokens)
css/base.css         reset + body baseline
css/layout.css       header, main, bottom nav, grade-select screen
css/timetable.css    weekly table, cards, lunch row, legend
css/components.css   calendar overlay, upload, admin, toasts, dtodo
css/views.css        list/filter, planner, timer
```

JS — loaded in this strict order at the end of `<body>` (plain scripts, all globals; no ES modules):
```
js/config.js          DAYS, WN, ML, EVK, HOLIDAY_KW, ADMIN_PWS,
                      SHARED_KEY, NOTIF_KEY, PERIOD_INFO/_START/_END
js/utils.js           p2, today, isEx, isEv, wvals, gcol, isHoliday,
                      fmtDate, exLabel, ttKey, escHtml
js/data.js            wh, wl, wdd, wks, ed, merged, fsubj, cmap,
                      buildFromItems, color helpers, GRADE_SUBJECTS
js/state.js           ci, vw, savedGrade, fExam, fsubj2, isAdmin,
                      admEditIdx, _workingMerged (loads AFTER data
                      because `fsubj2 = fsubj.slice()` runs at parse)
js/firebase.js        Firebase init + listener + changelog UI
js/parsers/csv.js     parseCSV, csvRowsToItems (incl. Keimyung sniff)
js/parsers/xlsx.js    parseNativeCell/Format/Rows, KNOWN_SUBJ_*
js/parsers/smart.js   smartParseRows — 형식 자동 인식(wide/long/grid/legacy),
                      smartSheetRows(병합 셀 채움), smartNameBareExams
js/parsers/pdf.js     loadPdfJs, parseWkuPdf
js/upload.js          openXL/closeXL, handleFile, xlWorkbookCands(시트 후보),
                      xlSelect(시트 칩 UI), xlApply(관리자/일반 공용 적용), xlBind
js/views/weekly.js    buildWeekTable, buildLegend, renderW
js/views/filter.js    lcardH, byDateH, renderL, renderF, renderFR
js/views/calendar.js  openCal, closeCal, renderCal
js/views/planner.js   plTodos + plSave, plTodayKey, renderPlanner
js/views/timer.js     timer state, tm* helpers, renderTimer
js/views/history.js   공부 기록 하위 화면(dashPage='hist'): 월 달력 +
                      날짜별 플래너·회고 읽기 전용 (plan_<날짜>·tm_logs)
js/views/dtodo.js     dtodo state, open/close/render/add/toggle/del,
                      updateTodoDots, bindThClick + overlay glue
js/admin.js           admSrc, panel + modal, publishTT/doPublish,
                      admShowConfirm, admOpenUpload
js/app.js             updHdr, goTodayWeek, setView, render, init(),
                      init() call, boot setTimeouts (admin-FAB bind,
                      non-admin Firebase listener startup)
```

**Inline `onclick="..."` handlers in JS-generated markup** reference 8 admin/dtodo globals (`admOpenUpload`, `closeAdminPanel`, `adminChangeWk`, `addAItem`, `publishTT`, `doLogout`, `dtodoToggle`, `dtodoDel`). Because everything is a global, they resolve at click time. If you ever migrate to ES modules, either expose those names on `window` or rewrite the inline handlers to `addEventListener`.

## What the app does

Korean medical-school timetable for 전북대학교 의과대학 (JBNU College of Medicine). Supports three grades selected on first launch (stored in `localStorage.user_grade`):
- `의예과 2학년` → Firebase key `premed2`
- `의학과 1학년` → `med1`
- `의학과 2학년` → `med2`

Three main views, switched via the bottom nav (`#bn-w` / `#bn-f` / `#bn-t`) plus a calendar overlay and per-date todo sheet:
- **시간표 (weekly)** — period × weekday grid for the current 주차.
- **공부 (dashboard, `js/views/dashboard.js`)** — 인사(날짜·플래너 진행·가장 가까운 시험 D-day 칩) → 타이머 히어로(`tmCardHtml`: 대기 시 플래너 미완료 항목 칩으로 대상 선택, '과목 선택' 칩이 셀렉트 토글; 연동 항목의 목표 진행 바) → 오늘 플래너(항목별 목표·실제·달성률, ▶ 연동, 접이식 '오늘 회고'+자기평가) → 시험(한 카드, [남은|본] 세그먼트) → 기록(연속·최고 연속·이번 주, '날짜별 기록 보기' → `js/views/history.js`) → 백업. 상단에 총 공부시간·일일 목표는 표시하지 않음(2026-09 결정: 플래너가 측정). ≥720px는 `.dash-col-a/-b` 두 열.
- **필터 (filter)** — list view filtered by subject / exam-only, 시수 뷰.

## Reading the source

After the split, only `js/data.js` still has the giant lines — the original `wh` HTML blob and `wdd`/`merged`/`fsubj` JSON dumps live there as single multi-KB lines. `Read` refuses to open ranges that overlap them. Workarounds:

- For declarations and function bodies, use `grep -n` to find the line, then `Read` a narrow window (≤ ~120 lines) that avoids the giant lines.
- To peek at a giant line, slice it with `awk 'NR==1' js/data.js | cut -c1-500` rather than reading.
- Every other file is small enough to `Read` whole.

## Core runtime data

These globals (defined across `js/data.js` and `js/state.js`) hold all app state and are mutated in place by `buildFromItems()` (in `js/data.js`) whenever the timetable is reloaded (initial load, Excel/PDF upload, Firebase push):

- `merged` — array of class items: `{week, date, day, period, start, end, subject, professor, is_exam}`. Source of truth.
- `wks` — week numbers as strings, e.g. `["1", ..., "18"]`.
- `wdd` — `{ week: { 요일: "YYYY-MM-DD" } }`, used to map each weekday column to a calendar date.
- `ed` — list of exam dates.
- `cmap` — `subject → pastel hex color`. Hardcoded for known subjects near the top of `js/data.js`, auto-filled from `palette` for unknown ones in `buildFromItems()`.
- `wh`, `wl` — pre-rendered HTML for each week's table and legend. Regenerated by `buildWeekTable(w, items)` / `buildLegend(items)` in `js/views/weekly.js`.
- `fsubj`, `fsubj2` — subject list and the current filter selection.
- `savedGrade` — current grade (in `js/state.js`); used by `ttKey()` to namespace localStorage.

`init()` (in `js/app.js`) does heavy post-processing on the initial `wh` string in `js/data.js` — color remapping via `oldColors`, holiday substitution, rowspan removal, exam-icon normalization. If you change subject colors or holiday rendering, check both the raw `cmap`/source `wh` in `js/data.js` and the `oldColors` map in `init()`.

## Persistence layers

- **localStorage keys** (all per-grade where it matters):
  - `user_grade` — last selected grade.
  - `timetable_data_<grade>` — last applied timetable (`{items, wdd, ed, grade, ts}`); `ttKey()` builds this key.
  - `changelog_<gradeKey>` — change-log entries (most recent first, capped at 20).
  - `changelog_seen_<gradeKey>` — last-read timestamp for the banner.
  - `pl_todos` — planner todos.
  - `tm_logs` — timer per-day per-subject totals.
  - `plan_<YYYY-MM-DD>` / `plan_meta_<YYYY-MM-DD>` — 공부 탭 플래너 항목(`{id,text,goal,secs,sessions,done}`)·각오/회고/자평. **공부일 기준은 새벽 4시**(`STUDY_DAY_START_H`, `studyDate()` in `js/views/timer.js`) — 플래너·타이머·연속일은 캘린더 날짜 대신 이걸 씀. 타이머 세션은 시작한 공부일에 기록되고, `tmSegs`로 일시정지 구간을 뺀 실제 구간만 `sessions`에 남김.
  - `dtodo_<YYYY-MM-DD>` — per-date todos shown when a date header is tapped.
- **Firebase Realtime DB** at `timetable/<gradeKey>`. Schema: `{items, wdd, ed, wks, grade, ts, changelog}`. `fbGradeKey()` maps Korean grade names to `premed2` / `med1` / `med2`. Helpers: `fbRef()`, `loadFromFirebase()`, `applyFirebaseData()`, `startFirebaseListener()`. Listener is bypassed while `isAdmin === true` to avoid clobbering in-flight edits.

## Admin / publish flow

`ADMIN_PWS` (in `js/config.js`) holds **plaintext per-grade admin passwords** — this is by design for this app, do not "secure" them away on your own initiative.

The admin FAB (`#admin-fab`) opens `#admin-panel`. Editing happens on a deep clone `_workingMerged`, not on `merged` directly — `admSrc()` returns whichever is live. `publishTT()` prompts for a changelog memo, then `doPublish(memo)` commits `_workingMerged` back to `merged`, calls `buildFromItems(merged, wdd, ed)`, writes localStorage, and pushes to Firebase. Non-admin clients pick up the change through the value listener (`js/firebase.js`) and render a "🔔 시간표 변경" banner.

## Upload parsing

`handleFile(file)` (in `js/upload.js`) always reads an ArrayBuffer and classifies by **content** (`xlSniff`: `%PDF` / `PK` / OLE 매직 바이트 → 확장자 → 텍스트 헤드에 HTML 태그·구분자 여부). 학교 포털이 `.tmp`나 확장자 없이 내려주는 엑셀도 열린다(파일 input에 `accept` 없음). `pdf` → `loadPdfJs` + `parseWkuPdf`; `text` → 디코딩(UTF-8 실패 시 EUC-KR) → `xlParseDelimited`(탭/쉼표) → `smartParseRows`; `sheet`(xlsx/xls/xlsm/xlsb/ods/numbers/HTML 표) → `XLSX.read` → 시트마다 `smartSheetRows`(병합 셀을 좌상단 값으로 채움) → `smartParseRows`(학년 병렬 시트는 `smartParseMultiGrade`가 먼저).

`smartParseRows(rows)` (in `js/parsers/smart.js`) detects the layout and returns `{items, wddLocal, edLocal, format, warnings}`:
- **wide** — 행=날짜, 열=교시 (전북대 배부 엑셀). 헤더 행 위치·열 순서 무관, 헤더가 없으면 열 추정. 주차 셀이 병합돼 비어 있으면 직전 주차 승계, 주차 열이 없으면 날짜로 부여. 요일이 날짜와 다르면 날짜 기준.
- **long** — 행=수업 1개 (계명대 등). 헤더 이름으로 열 매핑(`smartHeaderKind`): 날짜/일자, 교시 또는 시작시간, 과목명, 교수, 주제, 강의실.
- **grid** — 열=요일, 행=교시, 주차 블록 반복. 요일 헤더 행(≥3 요일)에서 블록 시작, 날짜는 헤더 셀·아래 행·위 행에서 찾고 하나만 있어도 요일 차로 보정.
- **legacy** — `week,date,day,period,...` 영문 헤더 CSV.
셀 파싱은 `smartCell` → `parseNativeCell`(과목-교수, 줄바꿈 세부/시험명) → `과목명 (교수명)` → `과목 / 교수` 순. 과목명 없는 `시험` 셀은 직전 7일간 가장 많이 들은 과목명을 붙인다(`smartNameBareExams`).

여러 시트가 인식되면 `xlSetCands`가 시트 칩을 보여주고 `xlGradeScore`로 `savedGrade`에 맞는 시트(예: '2학년')를 기본 선택한다. `N주차` 시트가 여럿이면 하나로 합친다. 적용은 `xlApply()` 한 곳: 관리자는 `_workingMerged`에 반영(배포 필요), 일반 사용자는 `merged` 교체 + `ttKey()` 저장 + `ttLocalSet(true)`(내 파일 모드).

Legacy parsers (`parseNativeRows`, `csvRowsToItems`) remain for `tools/` ports and reference; the app no longer calls them directly.

After parsing, `buildFromItems()` rebuilds all derived state and `render()` redraws.

## Notes worth knowing before editing

- `escHtml()` was previously defined twice in the original single file with the later, null-safe version winning via hoisting. The split kept only the null-safe version (in `js/utils.js`).
- `goTodayWeek()` (in `js/app.js`) and the IIFE at the end of `init()` snap to the **next** Monday when today is Sat/Sun.
- Period grid is fixed 1–10 with a lunch row inserted after period 4 inside `buildWeekTable()`. `HOUR_TO_PERIOD` (in `js/views/weekly.js`) and `PERIOD_INFO` / `PERIOD_START` / `PERIOD_END` (in `js/config.js`) must agree if you change times.
- Holiday rendering: `HOLIDAY_KW` / `EVK` (in `js/config.js`) and the `isHoliday()` guard inside `buildWeekTable()` collapse a whole day to a single 🗓 cell on period 1.
- Header date `<th>` cells get a tap handler from `bindThClick()` (in `js/views/dtodo.js`) to open the per-date todo sheet — re-call it after any re-render of the weekly table.

## 디자인 방향
- 토스 + 노션 스타일
- 베이스: iOS 네이티브 느낌 (현재 -apple-system, env(safe-area-inset) 유지)
- 토스에서 가져올 것: 큰 타이포, 통통한 라운드 (14-20px), 부드러운 마이크로 인터랙션
- 노션에서 가져올 것: 명확한 위계, 넉넉한 여백, 회색 톤 계조
- 모바일 380px 기준. 반응형: `layout.css` 하단 미디어쿼리(≤430 헤더 컴팩트, ≤340 폴드, ≥720 태블릿 2열·`--content-max` 가운데 정렬, 가로모드), 시트는 `components.css` 하단(≥640 가운데 카드)
- 다크모드는 `tokens.css` (OS 추종 + `data-theme` 강제)

## 절대 깨면 안 되는 것
- 학년별 시간표 분리 (savedGrade 기반, ttKey() 함수로 학년별 localStorage 키)
- Firebase 실시간 동기화 (관리자 배포 → 학우들 실시간 반영)
- 학년별 관리자 비밀번호 시스템 (ADMIN_PWS)
- 기존 localStorage 키 호환성 (학우들 데이터 손실 방지)
- PWA 동작 (manifest, 홈 화면 추가)

## 작업 로드맵
- Phase 1: 파일 분리 (단일 HTML → 모듈) ✓ 완료 (브랜치 `refactor/phase1-split`)
- Phase 2: 디자인 시스템 구축 + 다크모드 ← 다음 단계
- Phase 3: UX 개선 (주간 카드 상세보기, SVG 아이콘 등)
- Phase 4: 새 기능 (알림, 통계, 시간표 공유 등)

## 작업 시 원칙
- 한 번에 한 단계씩, 작은 변경 → 테스트 → 커밋
- 큰 변경 전에 반드시 git commit (롤백 가능하게)
- 학우들이 실사용 중인 앱이라 깨지면 안 됨
- 모바일 Safari에서 매번 확인 (iOS 의대생 많음)
- 디자인 변경 시 하드코딩 X, CSS 변수 사용
