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
js/parsers/pdf.js     loadPdfJs, parseWkuPdf
js/upload.js          openXL, closeXL, handleFile dispatcher
js/views/weekly.js    buildWeekTable, buildLegend, renderW
js/views/filter.js    lcardH, byDateH, renderL, renderF, renderFR
js/views/calendar.js  openCal, closeCal, renderCal
js/views/planner.js   plTodos + plSave, plTodayKey, renderPlanner
js/views/timer.js     timer state, tm* helpers, renderTimer
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
- **주간 (weekly)** — period × weekday grid for the current 주차.
- **필터 (filter)** — list view filtered by subject / exam-only.
- **타이머 (timer)** — per-subject study timer with daily logs.

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
  - `dtodo_<YYYY-MM-DD>` — per-date todos shown when a date header is tapped.
- **Firebase Realtime DB** at `timetable/<gradeKey>`. Schema: `{items, wdd, ed, wks, grade, ts, changelog}`. `fbGradeKey()` maps Korean grade names to `premed2` / `med1` / `med2`. Helpers: `fbRef()`, `loadFromFirebase()`, `applyFirebaseData()`, `startFirebaseListener()`. Listener is bypassed while `isAdmin === true` to avoid clobbering in-flight edits.

## Admin / publish flow

`ADMIN_PWS` (in `js/config.js`) holds **plaintext per-grade admin passwords** — this is by design for this app, do not "secure" them away on your own initiative.

The admin FAB (`#admin-fab`) opens `#admin-panel`. Editing happens on a deep clone `_workingMerged`, not on `merged` directly — `admSrc()` returns whichever is live. `publishTT()` prompts for a changelog memo, then `doPublish(memo)` commits `_workingMerged` back to `merged`, calls `buildFromItems(merged, wdd, ed)`, writes localStorage, and pushes to Firebase. Non-admin clients pick up the change through the value listener (`js/firebase.js`) and render a "🔔 시간표 변경" banner.

## Upload parsing

`handleFile(file)` (in `js/upload.js`) routes by extension:

- **JBNU native format (.xlsx / .xls / .csv)** — expected columns `주차 / 날짜 / 요일 / 1교시…10교시`. `isNativeFormat()` sniffs, `parseNativeRows()` extracts (both in `js/parsers/xlsx.js`). Cell convention parsed by `parseNativeCell()`:
  - `과목명-교수명`
  - `과목명\n세부-교수명`
  - `과목명\n시험명-교수명` → subject becomes `과목명 시험명`
  - Bare keyword like `시험` or `문제바탕학습1`
- **Generic CSV** — `csvRowsToItems()` in `js/parsers/csv.js`, expects cells in `과목명 ( 교수명 )` form (also dispatches to Keimyung format when it sniffs that header layout).
- **원광대 PDF** — `loadPdfJs()` then `parseWkuPdf(pageContents)` in `js/parsers/pdf.js`.

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
- 모바일 380px 기준
- Phase 2에서 다크모드 도입 (디자인 시스템 만들 때)

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
