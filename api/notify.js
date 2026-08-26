/* 아침 수업 알림 발송 — Vercel cron이 매일 22:30 UTC(07:30 KST)에 호출.
   push/ 아래 구독을 읽어 학년별 오늘 시간표를 요약해 Web Push 발송.
   ?dry=1 → 발송 없이 계산 결과만 반환 (테스트용) */
const webpush = require('web-push');

const DB = 'https://jbnu-med-timetable-default-rtdb.firebaseio.com';
const GRADE_KEY = { '의예과 2학년': 'premed2', '의학과 1학년': 'med1', '의학과 2학년': 'med2' };
const SECTION_SUBJECT = '인체육안구조실습'; // 분반 과목 (의예과 2학년)
const HOLIDAY_KW = ['근로자의날','대체휴무','대체휴일','어린이날','지방선거','개교기념일','공휴일',
  '현충일','광복절','추석','설날','삼일절','면접고사','종강','계절수업','개천절','한글날','성탄절','신정'];

module.exports = async (req, res) => {
  const dry = req.query && req.query.dry === '1';
  if (!dry && process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:nsmed1113@jbnu.ac.kr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const today = kst.toISOString().slice(0, 10);

  const subs = (await fetch(`${DB}/push.json`).then(r => r.json())) || {};
  if (subs.error) return res.status(500).json({ error: 'db: ' + subs.error });
  const ttCache = {};
  const results = [];

  for (const uid of Object.keys(subs)) {
    const rec = subs[uid];
    if (!rec || !rec.sub) continue;
    const gk = rec.key || GRADE_KEY[rec.grade] || rec.grade; /* 신규 구독은 학교 포함 키 저장 */
    if (!gk) continue;
    if (!(gk in ttCache)) {
      ttCache[gk] = await fetch(`${DB}/timetable/${gk}.json`).then(r => r.json()).catch(() => null);
    }
    const tt = ttCache[gk];
    if (!tt || !tt.items) continue;

    let items = tt.items.filter(i => i.date === today);
    if (rec.sec) {
      if (gk === 'premed2') items = items.filter(i => i.subject !== SECTION_SUBJECT || i.day === rec.sec);
      else items = items.filter(i => !i.sec || i.sec === rec.sec);
    }
    const classes = items.filter(i => !HOLIDAY_KW.some(k => (i.subject || '').includes(k)));
    if (!classes.length) { results.push({ uid, skip: 'no-classes' }); continue; }

    classes.sort((a, b) => a.period - b.period);
    const first = classes[0];
    const subjects = [...new Set(classes.map(i => i.subject))];
    const exams = [...new Set(classes.filter(i => i.is_exam === true || i.is_exam === 'true').map(i => i.subject))];

    let title, body;
    if (exams.length) {
      title = '오늘 시험이 있어요';
      body = exams.join(', ') + ` · 첫 수업 ${first.start} ${first.subject}`;
    } else {
      title = '오늘 수업';
      body = `${subjects.length}과목 · 첫 수업 ${first.start} ${first.subject}`;
    }
    results.push({ uid, title, body });

    if (!dry) {
      try {
        await webpush.sendNotification(JSON.parse(rec.sub), JSON.stringify({ title, body, url: './' }));
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await fetch(`${DB}/push/${uid}.json`, { method: 'DELETE' }).catch(() => {});
          results[results.length - 1].removed = true;
        } else {
          results[results.length - 1].error = e.statusCode || String(e);
        }
      }
    }
  }
  res.json({ date: today, subscribers: Object.keys(subs).length, results });
};
