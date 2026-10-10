/* 시간표 파일 AI 읽기 — 앱 안의 파서가 못 읽은 파일만 여기로 온다.
   POST {kind:'pdf'|'text', data:<base64 PDF | 표를 텍스트로 옮긴 것>, grade, name}
   → {items:[{date,period,start,end,subject,professor,room,is_exam}], model}
   Gemini에 보내고, 한 줄에 수업 하나인 압축 형식으로 받아 검증한 뒤 돌려준다.
   파일은 저장하지 않는다. 하루 전체·주소별 호출 수만 Firebase study/aiq 에 센다(과금 폭주 방지).
   env: GEMINI_API_KEY (필수), GEMINI_MODEL (선택) */
const crypto = require('crypto');

const DB = 'https://jbnu-med-timetable-default-rtdb.firebaseio.com';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const DAY_CAP = +(process.env.AI_DAY_CAP || 150);   // 하루 전체
const IP_CAP = +(process.env.AI_IP_CAP || 6);       // 주소당 하루
const MAX_PDF_B64 = 4 * 1024 * 1024;                // Vercel 요청 본문 한도(4.5MB) 안쪽
const MAX_TEXT = 600 * 1000;
const ORIGINS = [/^https:\/\/sehyunlee\.vercel\.app$/, /^https:\/\/jbnu-timetable\.vercel\.app$/,
  /^https:\/\/leeikjoon\.github\.io$/, /^capacitor:\/\/localhost$/, /^https?:\/\/localhost(:\d+)?$/];

const PROMPT = (grade, name) => `너는 한국 의과대학 시간표 문서를 표 데이터로 옮기는 변환기다.
첨부된 문서(파일명: ${name || '없음'})에서 수업을 빠짐없이 읽어 아래 형식의 줄만 출력해라. 설명·머리말·코드블록 금지.

먼저 교시 정의 줄(교시마다 한 줄):
P|교시번호|시작HH:MM|끝HH:MM
그다음 수업 줄(수업 한 덩어리마다 한 줄):
C|YYYY-MM-DD|시작교시|끝교시|과목명|교수|강의실|시험여부(0 또는 1)

규칙:
- 병합된 칸(여러 교시에 걸친 한 수업)은 시작교시~끝교시로 한 줄. 한 교시짜리는 시작교시=끝교시.
- 문서에 교시 번호가 없고 시각만 있으면 이른 시각부터 1,2,3… 번호를 붙여 P줄을 만든다. 점심시간은 교시가 아니다.
- 날짜의 연도는 문서의 '2026학년도' 같은 표기에서 정한다. 2학기 문서의 1~2월은 다음 해.
- 과목명은 칸에 적힌 수업 이름 그대로. '대면', 'ZOOM', '(E,F,G)' 같은 분류 코드, 소속 학과명은 과목명에 넣지 않는다.
- 교수는 이름만(여러 명이면 쉼표로). 없으면 비운다. 강의실이 없으면 비운다. ZOOM·온라인 수업은 강의실에 ZOOM.
- 시험·고사·퀴즈·평가는 시험여부 1. 공휴일·휴강·행사도 과목명에 그 이름을 적고 시험여부 0.
- 빈 칸, 점심시간, 표 제목, 주석은 출력하지 않는다. 문서에 없는 수업을 지어내지 않는다.
- '|' 문자는 과목명 등에 쓰지 않는다(있으면 '/'로 바꾼다).
${grade ? `- 문서에 여러 학년이 섞여 있으면 '${grade}' 것만 출력한다. 학년 구분이 없으면 전부 출력한다.` : ''}
- 시간표가 아닌 문서면 'X|시간표 아님' 한 줄만 출력한다.`;

function cors(req, res) {
  const o = req.headers.origin || '';
  if (ORIGINS.some(r => r.test(o))) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* 호출 수 세기: {total, ip:{해시:횟수}} — 넘으면 false */
async function quota(req) {
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const h = crypto.createHash('sha256').update(day + '|' + ip).digest('hex').slice(0, 16);
  try {
    const cur = (await fetch(`${DB}/study/aiq/${day}.json`).then(r => r.json())) || {};
    const total = cur.total || 0, mine = (cur.ip && cur.ip[h]) || 0;
    if (total >= DAY_CAP) return { ok: false, why: 'day' };
    if (mine >= IP_CAP) return { ok: false, why: 'ip' };
    await fetch(`${DB}/study/aiq/${day}.json`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: total + 1, ['ip/' + h]: mine + 1 }),
    });
  } catch (e) { /* 카운터 장애로 기능을 막지는 않음 */ }
  return { ok: true };
}

function hm(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return (+m[1]) + ':' + m[2];
}
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/* 모델 출력(줄 형식) → 검증된 항목 */
function parseLines(text) {
  const P = {}, items = [];
  let notTT = false, bad = 0;
  String(text || '').split(/\r?\n/).forEach(line => {
    const f = line.trim().split('|').map(s => s.trim());
    if (f[0] === 'X') { notTT = true; return; }
    if (f[0] === 'P' && f.length >= 4) {
      const p = parseInt(f[1], 10), a = hm(f[2]), b = hm(f[3]);
      if (p >= 0 && p <= 20 && a && b) P[p] = [a, b];
      return;
    }
    if (f[0] !== 'C' || f.length < 5) return;
    const dm = f[1].match(/^(20\d{2})-(\d{2})-(\d{2})$/);
    const p1 = parseInt(f[2], 10), p2 = parseInt(f[3], 10);
    const subject = (f[4] || '').slice(0, 80);
    if (!dm || !(p1 >= 0) || !(p2 >= p1) || p2 - p1 > 12 || !subject) { bad++; return; }
    const d = new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3]));
    if (d.getUTCMonth() !== +dm[2] - 1) { bad++; return; }
    const day = DOW[d.getUTCDay()];
    for (let p = p1; p <= p2; p++) {
      const t = P[p];
      const it = { week: '', date: f[1], day, period: p, start: t ? t[0] : '', end: t ? t[1] : '',
        subject, professor: (f[5] || '').slice(0, 40), is_exam: f[7] === '1' };
      if (f[6]) it.room = f[6].slice(0, 40);
      items.push(it);
    }
  });
  return { items, notTT, bad, periods: P };
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'nokey', msg: 'AI 읽기가 아직 준비되지 않았어요.' });

  const b = req.body || {};
  const kind = b.kind === 'pdf' ? 'pdf' : 'text';
  const data = typeof b.data === 'string' ? b.data : '';
  if (!data) return res.status(400).json({ error: 'empty' });
  if (kind === 'pdf' && (data.length > MAX_PDF_B64 || !/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 2000))))
    return res.status(413).json({ error: 'big', msg: '파일이 너무 커요(3MB 이하만 가능).' });
  if (kind === 'text' && data.length > MAX_TEXT)
    return res.status(413).json({ error: 'big', msg: '표가 너무 커요.' });

  const q = await quota(req);
  if (!q.ok) return res.status(429).json({ error: 'quota', msg: q.why === 'ip' ? '오늘 AI 읽기 횟수를 다 썼어요. 내일 다시 시도해 주세요.' : '오늘은 AI 읽기 요청이 많아 잠시 닫혔어요. 내일 다시 시도해 주세요.' });

  const grade = String(b.grade || '').slice(0, 20), name = String(b.name || '').slice(0, 80).replace(/[`$\\]/g, '');
  const parts = kind === 'pdf'
    ? [{ inline_data: { mime_type: 'application/pdf', data: data.replace(/\s+/g, '') } }, { text: PROMPT(grade, name) }]
    : [{ text: PROMPT(grade, name) + '\n\n===== 문서 내용(표를 탭으로 구분한 텍스트, 병합 칸은 같은 값이 반복됨) =====\n' + data }];

  let out = '';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, maxOutputTokens: 64000 } }),
    });
    const j = await r.json();
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
      return res.status(502).json({ error: 'upstream', msg: 'AI 서비스 오류로 읽지 못했어요.', detail: String(msg).slice(0, 200) });
    }
    const c = j.candidates && j.candidates[0];
    out = ((c && c.content && c.content.parts) || []).map(p => p.text || '').join('');
    var truncated = !!(c && c.finishReason === 'MAX_TOKENS');
  } catch (e) {
    return res.status(502).json({ error: 'upstream', msg: 'AI 서비스에 연결하지 못했어요.' });
  }

  const r2 = parseLines(out);
  if (!r2.items.length) return res.status(422).json({ error: 'none', msg: r2.notTT ? '시간표로 보이지 않는 파일이에요.' : 'AI도 이 파일에서 시간표를 찾지 못했어요.' });
  return res.status(200).json({ items: r2.items, model: MODEL, skipped: r2.bad, truncated });
};
module.exports.parseLines = parseLines;
