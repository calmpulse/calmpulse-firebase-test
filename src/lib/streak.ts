// src/lib/streak.ts
import { formatInTimeZone } from 'date-fns-tz';
import {
  differenceInCalendarDays,
} from 'date-fns';

const TZ = 'Europe/Paris';

/* ---------- 1. Date -> chaîne YYYY-MM-DD ---------- */
export const toLocalDay = (d: Date | number) =>
  formatInTimeZone(d, TZ, 'yyyy-MM-dd');

/* ---------- 2. Stats de streak ---------- */
export function streakStats(days: string[]) {
  if (!days.length) return { current: 0, longest: 0 };

  const unique = Array.from(new Set(days)).sort();      // oldest → newest

  /* courant */
  let current = 1;
  for (let i = unique.length - 2; i >= 0; i--) {
    if (
      differenceInCalendarDays(
        new Date(unique[i + 1]),
        new Date(unique[i])
      ) === 1
    )
      current++;
    else break;
  }

  /* plus long */
  let longest = 1, run = 1;
  for (let i = 1; i < unique.length; i++) {
    run =
      differenceInCalendarDays(
        new Date(unique[i]),
        new Date(unique[i - 1])
      ) === 1
        ? run + 1
        : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

/* ---------- 3. Semaine ISO courante ---------- */
export function weekDays(today = new Date()): string[] {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/02940da6-2895-4c35-a8a8-59b86544a4cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'833268'},body:JSON.stringify({sessionId:'833268',runId:'pre-fix',hypothesisId:'H1',location:'src/lib/streak.ts:weekDays:entry',message:'weekDays input date context',data:{todayIso:today.toISOString(),utcDay:today.getUTCDay(),utcDate:today.getUTCDate(),utcMonth:today.getUTCMonth()+1,utcYear:today.getUTCFullYear(),parisDayKey:toLocalDay(today),parisWeekday:new Intl.DateTimeFormat('en',{weekday:'short',timeZone:TZ}).format(today)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const parisTodayKey = toLocalDay(today);
  const [year, month, day] = parisTodayKey.split('-').map(Number);
  const parisTodayNoonUTC = new Date(Date.UTC(year, month - 1, day, 12));
  const weekdayShort = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: TZ }).format(parisTodayNoonUTC);
  const mondayBasedIndex = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const)[weekdayShort as 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'] ?? 0;
  const monday = new Date(Date.UTC(
    year,
    month - 1,
    day - mondayBasedIndex,
    12 // midi UTC
  ));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const week = Array.from({ length: 7 }, (_, i) => {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + i);
    return toLocalDay(current);
  });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/02940da6-2895-4c35-a8a8-59b86544a4cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'833268'},body:JSON.stringify({sessionId:'833268',runId:'pre-fix',hypothesisId:'H4',location:'src/lib/streak.ts:weekDays:result',message:'computed week bounds and keys',data:{mondayIso:monday.toISOString(),sundayIso:sunday.toISOString(),mondayKey:toLocalDay(monday),sundayKey:toLocalDay(sunday),week},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return week;
}

/* ---------- 4. Dates du mois ---------- */
export function monthArray(base: Date = new Date()): Date[] {
  const res: Date[] = [];
  const cursor = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    1,
    12, 0, 0,
  ));
  while (cursor.getUTCMonth() === base.getUTCMonth()) {
    res.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return res;
}

