import { db } from '@/lib/firebase';
import { toLocalDay } from '@/lib/streak';
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

const dailyDocId = (uid: string, d = new Date()) => `${uid}_${toLocalDay(d)}`;
const monthKeyFromDay = (day: string) => day.slice(0, 7); // YYYY-MM
const completedSessionDocId = (uid: string, d = new Date()) => `${uid}_${toLocalDay(d)}_${Date.now()}`;

export async function startSession(uid: string): Promise<void> {
  if (!uid) return;
  await setDoc(
    doc(db, 'sessions', dailyDocId(uid)),
    { userId: uid, startedAt: serverTimestamp(), status: 'started' },
    { merge: true },
  );
}

export async function completeSession(uid: string, durationSeconds: number): Promise<void> {
  if (!uid) return;
  const day = toLocalDay(new Date());
  const month = monthKeyFromDay(day);
  const sessionDocId = completedSessionDocId(uid);
  const plannedDurationSeconds = Math.max(0, Math.floor(durationSeconds));
  const completedSeconds = Math.min(plannedDurationSeconds, plannedDurationSeconds);

  await setDoc(
    doc(db, 'sessions', sessionDocId),
    {
      userId: uid,
      createdAt: serverTimestamp(),
      endedAt: serverTimestamp(),
      status: 'completed',
      plannedDurationSeconds,
      completedSeconds,
      duration: completedSeconds, // legacy compatibility
      day,
      month,
    },
    { merge: false },
  );

  // Prefer a private "nickname" from the user's profile for public Community Hub display
  let hubName = '';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const maybe = snap.exists() ? (snap.data() as { nickname?: string | null }).nickname : null;
    hubName = (maybe ?? '').toString().trim().slice(0, 60);
  } catch {
    // ignore, fallback below
  }
  const safeHubName = hubName || 'Anonymous';

  await setDoc(
    doc(db, 'communityCompletions', dailyDocId(uid)),
    {
      userId: uid,
      name: safeHubName,
      endedAt: serverTimestamp(),
      day,
      month,
    },
    { merge: true },
  );

  // Auto check-in to each of the user's groups (one per day per group)
  try {
    const memberships = await getDocs(query(collectionGroup(db, 'members'), where('userId', '==', uid)));
    const groupIds = Array.from(
      new Set(
        memberships.docs
          .map((d) => d.ref.parent.parent?.id)
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    );

    await Promise.all(
      groupIds.map((groupId) =>
        setDoc(
          doc(db, 'groups', groupId, 'checkins', dailyDocId(uid)),
          {
            userId: uid,
            name: safeHubName,
            day,
            createdAt: serverTimestamp(),
          },
          { merge: true },
        ),
      ),
    );
  } catch {
    // ignore group check-in failures
  }

  // Invalidate cache so progress page updates immediately
  if (typeof window !== 'undefined') {
    const cacheKey = `days_${uid}`;
    sessionStorage.removeItem(cacheKey);
  }
}

export async function saveTomorrowPlan(uid: string | null, planText: string): Promise<void> {
  const text = (planText ?? '').toString().trim();

  // Always store locally (works logged-out too)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cp_tomorrow_plan', text);
      localStorage.setItem('cp_tomorrow_plan_saved_at', new Date().toISOString());
    } catch {
      // ignore
    }
  }

  // If logged in, also store in the user profile doc
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    { tomorrowPlan: text || null, tomorrowPlanUpdatedAt: serverTimestamp() },
    { merge: true },
  );
}


