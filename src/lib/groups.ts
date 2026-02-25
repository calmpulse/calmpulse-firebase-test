import { auth, db } from '@/lib/firebase';
import { toLocalDay } from '@/lib/streak';
import {
  FieldPath,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';

async function getNickname(uid: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const nick = snap.exists() ? ((snap.data() as { nickname?: string | null }).nickname ?? '') : '';
    const safe = nick.toString().trim().slice(0, 60);
    return safe;
  } catch {
    return '';
  }
}

function fallbackNameFromAuth(): string {
  const u = auth.currentUser;
  const display = u?.displayName || u?.email?.split('@')[0] || 'Member';
  return String(display).trim().slice(0, 60) || 'Member';
}

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  public?: boolean;
  createdAt?: Timestamp;
  archived?: boolean;
};

export type GroupMember = {
  userId: string;
  role: 'owner' | 'member';
  name: string;
  joinedAt?: Timestamp;
  inviteCode: string;
};

export type GroupCheckin = {
  id: string;
  userId: string;
  name: string;
  day: string;
  createdAt?: Timestamp;
};

export type Invite = {
  code: string;
  groupId: string;
  createdBy: string;
  active: boolean;
  createdAt?: Timestamp;
};

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/1/O/I

function randomCode(len = 8): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    // fallback (non-crypto) for dev only
    let s = '';
    for (let i = 0; i < len; i++) s += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
    return s;
  }
  const bytes = new Uint8Array(len);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}

export async function createGroup(name: string, isPublic: boolean = false): Promise<{ groupId: string; inviteCode: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please log in to create a group');

  const groupName = name.trim().slice(0, 60);
  if (!groupName) throw new Error('Group name is required');

  const groupRef = doc(collection(db, 'groups'));

  // Create a primary invite code (even for public groups, for owner's reference)
  const inviteCode = await createInviteCode(groupRef.id);

  const nickname = await getNickname(uid);
  const memberName = nickname || fallbackNameFromAuth();

  await runTransaction(db, async (tx) => {
    tx.set(groupRef, { 
      name: groupName, 
      ownerId: uid, 
      public: isPublic,
      createdAt: serverTimestamp() 
    });

    const memberRef = doc(db, 'groups', groupRef.id, 'members', uid);
    // Owner doesn't need invite code validation (handled by rules - owner role + matching ownerId)
    tx.set(memberRef, {
      userId: uid,
      role: 'owner',
      name: memberName,
      joinedAt: serverTimestamp(),
      inviteCode: inviteCode, // Set it for reference, but rules allow owner without validation
    });
  });

  return { groupId: groupRef.id, inviteCode };
}

export async function createInviteCode(groupId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode(8);
    const ref = doc(db, 'groupInvites', code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;

    await setDoc(ref, { groupId, createdBy: uid, createdAt: serverTimestamp(), active: true });
    return code;
  }
  throw new Error('Could not allocate invite code. Try again.');
}

export async function deactivateInvite(code: string): Promise<void> {
  const ref = doc(db, 'groupInvites', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await setDoc(ref, { active: false }, { merge: true });
}

export async function joinGroupByCode(codeRaw: string): Promise<{ groupId: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please log in to join a group');

  const code = codeRaw.trim().toUpperCase();
  if (!code) throw new Error('Invite code is required');

  const inviteRef = doc(db, 'groupInvites', code);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error('Invalid invite code. Please check and try again.');

  const invite = inviteSnap.data() as { groupId?: string; active?: boolean };
  if (!invite.active || !invite.groupId) throw new Error('This invite code is no longer active');

  const groupId = invite.groupId;
  const memberRef = doc(db, 'groups', groupId, 'members', uid);

  const nickname = await getNickname(uid);
  const memberName = nickname || fallbackNameFromAuth();

  let alreadyMember = false;
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(memberRef);
    if (existing.exists()) {
      alreadyMember = true;
      return;
    }

    tx.set(memberRef, {
      userId: uid,
      role: 'member',
      name: memberName,
      joinedAt: serverTimestamp(),
      inviteCode: code,
    });
  });

  if (alreadyMember) {
    throw new Error('You are already a member of this group');
  }

  return { groupId };
}

export async function listMyGroups(): Promise<Array<{ group: Group; memberCount: number; showedUpToday: number }>> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  // Query membership docs for the current user (collectionGroup over members)
  const memberships = await getDocs(query(collectionGroup(db, 'members'), where('userId', '==', uid)));
  const groupIds = Array.from(new Set(memberships.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[]));

  const today = toLocalDay(new Date());

  const results = await Promise.all(
    groupIds.map(async (groupId) => {
      const [groupSnap, memberCountSnap, todayCountSnap] = await Promise.all([
        getDoc(doc(db, 'groups', groupId)),
        getCountFromServer(collection(db, 'groups', groupId, 'members')),
        getCountFromServer(query(collection(db, 'groups', groupId, 'checkins'), where('day', '==', today))),
      ]);
      const groupData = groupSnap.data() as Omit<Group, 'id'> | undefined;
      if (!groupData) return null;
      if ((groupData as { archived?: boolean }).archived === true) return null;
      return {
        group: { id: groupId, ...groupData },
        memberCount: memberCountSnap.data().count,
        showedUpToday: todayCountSnap.data().count,
      };
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) return null;
  return { id: groupId, ...(snap.data() as Omit<Group, 'id'>) };
}

export async function getGroupMemberCount(groupId: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, 'groups', groupId, 'members'));
  return snap.data().count;
}

export async function getGroupTodayShownUp(groupId: string): Promise<{ shownUp: number; total: number }> {
  const today = toLocalDay(new Date());
  const [shownUpSnap, membersSnap] = await Promise.all([
    getCountFromServer(query(collection(db, 'groups', groupId, 'checkins'), where('day', '==', today))),
    getCountFromServer(collection(db, 'groups', groupId, 'members')),
  ]);
  return { shownUp: shownUpSnap.data().count, total: membersSnap.data().count };
}

export async function listTodayCheckins(groupId: string): Promise<GroupCheckin[]> {
  const today = toLocalDay(new Date());
  const q = query(
    collection(db, 'groups', groupId, 'checkins'),
    where('day', '==', today),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroupCheckin, 'id'>) }));
}

export async function listPublicCircles(searchQuery?: string): Promise<Array<{ group: Group; memberCount: number }>> {
  // Query public groups. Avoid orderBy to reduce composite index requirements.
  const q = query(collection(db, 'groups'), where('public', '==', true));
  const snap = await getDocs(q);

  const filtered = snap.docs
    .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as Omit<Group, 'id'> }))
    .filter(({ data }) => (data as { archived?: boolean }).archived !== true)
    .filter(({ data }) => {
      if (!searchQuery) return true;
      const ql = searchQuery.toLowerCase().trim();
      if (!ql) return true;
      return (data.name ?? '').toLowerCase().includes(ql);
    });

  const results = await Promise.all(
    filtered.map(async ({ id, data }) => {
      const memberCountSnap = await getCountFromServer(collection(db, 'groups', id, 'members'));
      return { group: { id, ...data }, memberCount: memberCountSnap.data().count };
    }),
  );

  // WhatsApp-style list: sort by size (no past-activity ranking).
  results.sort((a, b) => b.memberCount - a.memberCount);
  return results;
}

export async function postCheckinToGroup(groupId: string, name: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const day = toLocalDay(new Date());
  const docId = `${uid}_${day}`;
  await setDoc(
    doc(db, 'groups', groupId, 'checkins', docId),
    { userId: uid, name: name.trim().slice(0, 60) || 'Anonymous', day, createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function leaveGroup(groupId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  await deleteDoc(doc(db, 'groups', groupId, 'members', uid));
}

export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<Group, 'name' | 'public' | 'archived'>>,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  const cleaned: Record<string, unknown> = {};
  if (patch.name !== undefined) cleaned.name = patch.name.trim().slice(0, 60);
  if (patch.public !== undefined) cleaned.public = patch.public;
  if (patch.archived !== undefined) cleaned.archived = patch.archived;

  await setDoc(doc(db, 'groups', groupId), cleaned, { merge: true });
}

export async function listGroupMembers(groupId: string): Promise<Array<{ uid: string; name: string; role: string }>> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
  const base = snap.docs.map((d) => {
    const data = d.data() as { name?: string; role?: string };
    return { uid: d.id, storedName: (data.name ?? '').toString(), role: (data.role ?? 'member').toString() };
  });

  const resolved = await Promise.all(
    base.map(async (m) => {
      const nick = await getNickname(m.uid);
      return {
        uid: m.uid,
        role: m.role,
        name: (nick || m.storedName || 'Member').toString().trim().slice(0, 60) || 'Member',
      };
    }),
  );

  // Stable sort: owners first, then name
  resolved.sort((a, b) => {
    const ao = a.role === 'owner' ? 0 : 1;
    const bo = b.role === 'owner' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  return resolved;
}

export async function removeMember(groupId: string, memberUid: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'members', memberUid));
}

export async function setReaction(groupId: string, checkinId: string, emoji: '🤍' | '🌿' | '🙏'): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  await setDoc(doc(db, 'groups', groupId, 'checkins', checkinId, 'reactions', uid), { emoji, createdAt: serverTimestamp() });
}

export async function removeReaction(groupId: string, checkinId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  await deleteDoc(doc(db, 'groups', groupId, 'checkins', checkinId, 'reactions', uid));
}

export async function listReactions(groupId: string, checkinId: string): Promise<Array<{ uid: string; emoji: string }>> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'checkins', checkinId, 'reactions'));
  return snap.docs.map((d) => {
    const data = d.data() as { emoji?: string };
    return { uid: d.id, emoji: (data.emoji ?? '') as string };
  });
}

export async function listMyGroupIds(uid: string): Promise<string[]> {
  const memberships = await getDocs(query(collectionGroup(db, 'members'), where('userId', '==', uid)));
  return Array.from(new Set(memberships.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[]));
}

export async function listPublicGroups(searchQuery?: string): Promise<Array<{ group: Group; memberCount: number; showedUpToday: number }>> {
  // Kept for compatibility; prefer `listPublicCircles()` for today-only UX.
  const q = query(collection(db, 'groups'), where('public', '==', true));
  const snap = await getDocs(q);

  const results = await Promise.all(
    snap.docs.map(async (docSnap) => {
      const groupData = docSnap.data() as Omit<Group, 'id'>;
      const groupId = docSnap.id;
      
      if ((groupData as { archived?: boolean }).archived === true) return null;

      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase().trim();
        if (queryLower && !groupData.name.toLowerCase().includes(queryLower)) return null;
      }
      
      const memberCountSnap = await getCountFromServer(collection(db, 'groups', groupId, 'members'));
      
      return {
        group: { id: groupId, ...groupData },
        memberCount: memberCountSnap.data().count,
        showedUpToday: 0,
      };
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function joinPublicGroup(groupId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please log in to join a group');

  const groupSnap = await getDoc(doc(db, 'groups', groupId));
  if (!groupSnap.exists()) throw new Error('Group not found');
  
  const groupData = groupSnap.data() as Group;
  if (!groupData.public) throw new Error('This group is not public');

  const memberRef = doc(db, 'groups', groupId, 'members', uid);

  const nickname = await getNickname(uid);
  const memberName = nickname || fallbackNameFromAuth();

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(memberRef);
    if (existing.exists()) {
      throw new Error('You are already a member of this group');
    }

    tx.set(memberRef, {
      userId: uid,
      role: 'member',
      name: memberName,
      joinedAt: serverTimestamp(),
      inviteCode: '', // Empty for public groups
    });
  });
}


