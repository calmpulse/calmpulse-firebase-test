'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AuthHeader from '@/components/AuthHeader';
import EntryModal from '@/components/EntryModal';
import GroupSettingsModal from '@/components/GroupSettingsModal';
import { toLocalDay } from '@/lib/streak';
import {
  createInviteCode,
  getCurrentInviteCode,
  getGroup,
  getGroupTodayShownUp,
  listGroupMembers,
  listTodayCheckins,
  removeMember,
  leaveGroup,
  updateGroup,
  type Group,
} from '@/lib/groups';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Share2, Settings, ArrowLeft, X } from 'lucide-react';

export default function GroupPage() {
  const params = useParams<{ groupId?: string }>();
  const groupId = (params?.groupId ?? '').toString();

  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'signup' | 'login'>('login');
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Array<{ uid: string; name: string; role: string }>>([]);
  const [today, setToday] = useState<{ shownUp: number; total: number }>({ shownUp: 0, total: 0 });
  const [todayCheckins, setTodayCheckins] = useState<Array<{ id: string; userId: string; name: string; createdAt?: unknown }>>([]);
  const [nicknameByUid, setNicknameByUid] = useState<Record<string, string>>({});

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copyCodeLabel, setCopyCodeLabel] = useState<'Copy' | 'Copied'>('Copy');
  const [copyLinkLabel, setCopyLinkLabel] = useState<'Copy link' | 'Copied'>('Copy link');
  const [regenerating, setRegenerating] = useState(false);
  const inviteLink = useMemo(() => {
    if (!inviteCode) return null;
    if (typeof window === 'undefined') return `/join?code=${inviteCode}`;
    return `${window.location.origin}/join?code=${inviteCode}`;
  }, [inviteCode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const refresh = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [g, t, m, todayC] = await Promise.all([
        getGroup(groupId),
        getGroupTodayShownUp(groupId),
        listGroupMembers(groupId),
        listTodayCheckins(groupId),
      ]);
      setGroup(g);
      setToday(t);
      setMembers(m);
      const mapped = todayC.map((x) => ({ id: x.id, userId: x.userId, name: x.name, createdAt: x.createdAt }));
      setTodayCheckins(mapped);
      const nextIsMember = user ? m.some((member) => member.uid === user.uid) : false;
      if (nextIsMember) {
        try {
          const code = await getCurrentInviteCode(groupId);
          setInviteCode(code);
        } catch {
          setInviteCode(null);
        }
      } else {
        setInviteCode(null);
      }

      // Resolve nicknames for today's check-ins
      const uids = Array.from(new Set(mapped.map((c) => c.userId).filter(Boolean)));
      const next: Record<string, string> = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            const nick = snap.exists() ? ((snap.data() as { nickname?: string | null }).nickname ?? '') : '';
            const safe = nick.toString().trim().slice(0, 60);
            if (safe) next[uid] = safe;
          } catch {
            // ignore
          }
        }),
      );
      setNicknameByUid(next);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user?.uid]);

  useEffect(() => {
    if (!showInviteModal) return;
    setCopyCodeLabel('Copy');
    setCopyLinkLabel('Copy link');
  }, [showInviteModal]);

  const adminUid = group ? (group.adminId || group.ownerId || group.createdBy || '') : '';
  const isOwner = Boolean(adminUid && user?.uid && adminUid === user.uid);
  const isMember = user && members.some((m) => m.uid === user.uid);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handleRegenerateInvite = async () => {
    if (!isOwner) return;
    setRegenerating(true);
    try {
      const code = await createInviteCode(groupId);
      setInviteCode(code);
    } catch (e) {
      console.error('Failed to create invite code:', e);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    await copy(inviteCode);
    setCopyCodeLabel('Copied');
    window.setTimeout(() => setCopyCodeLabel('Copy'), 1200);
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await copy(inviteLink);
    setCopyLinkLabel('Copied');
    window.setTimeout(() => setCopyLinkLabel('Copy link'), 1200);
  };

  if (!groupId) {
    return null;
  }

  return (
    <>
      <AuthHeader onShowModal={(m) => { setModalMode(m); setShowModal(true); }} />
      {showModal && <EntryModal mode={modalMode} onClose={() => setShowModal(false)} />}
      {showInviteModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInviteModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              padding: '1.25rem',
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#111' }}>Invite</div>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                borderRadius: 16,
                border: '1px solid rgba(102,126,234,0.15)',
                padding: '1rem',
                background: 'rgba(102,126,234,0.05)',
              }}
            >
              <div style={{ fontWeight: 850, color: '#111', marginBottom: 8, fontSize: '.9rem' }}>Invite code</div>
              {inviteCode ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 900, color: '#111', fontSize: '1.1rem' }}>
                    {inviteCode}
                  </span>
                  <button
                    onClick={() => void handleCopyCode()}
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(0,0,0,.10)',
                      background: '#fff',
                      color: '#111',
                      padding: '6px 12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '.85rem',
                    }}
                  >
                    {copyCodeLabel}
                  </button>
                  {inviteLink && (
                    <button
                      onClick={() => void handleCopyLink()}
                      style={{
                        borderRadius: 999,
                        border: '1px solid rgba(0,0,0,.10)',
                        background: '#fff',
                        color: '#111',
                        padding: '6px 12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '.85rem',
                      }}
                    >
                      {copyLinkLabel}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: '.9rem' }}>No active invite code available right now.</div>
              )}
            </div>

            {isOwner && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => void handleRegenerateInvite()}
                  disabled={regenerating}
                  style={{
                    borderRadius: 999,
                    border: '1px solid rgba(0,0,0,.10)',
                    background: '#fff',
                    color: '#111',
                    padding: '8px 12px',
                    fontWeight: 800,
                    cursor: regenerating ? 'default' : 'pointer',
                    fontSize: '.85rem',
                    opacity: regenerating ? 0.75 : 1,
                  }}
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showSettings && group && (
        <GroupSettingsModal
          group={group}
          isOwner={isOwner}
          currentUserId={user?.uid ?? null}
          members={members}
          onClose={() => setShowSettings(false)}
          onLeave={async () => {
            try {
              await leaveGroup(groupId);
              window.location.href = '/community-hub';
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Could not leave circle.');
            }
          }}
          onRename={async (newName: string) => {
            try {
              await updateGroup(groupId, { name: newName });
              await refresh();
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Could not rename circle.');
            }
          }}
          onTogglePublic={async (isPublic: boolean) => {
            try {
              await updateGroup(groupId, { public: isPublic });
              await refresh();
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Could not update visibility.');
            }
          }}
          onRegenerateCode={handleRegenerateInvite}
          onRemoveMember={async (memberUid: string) => {
            try {
              await removeMember(groupId, memberUid);
              await refresh();
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Could not remove member.');
            }
          }}
          onArchive={async () => {
            try {
              await updateGroup(groupId, { archived: true });
              window.location.href = '/community-hub';
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Could not archive circle.');
            }
          }}
        />
      )}

      <main
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #faf8f5 0%, #f9f9f9 100%)',
          fontFamily: 'Poppins',
          padding: '7rem 1rem 4rem',
        }}
      >
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <Link
            href="/community-hub"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: 750,
              fontSize: '.9rem',
              marginBottom: '1.5rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#5568d3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#667eea';
            }}
          >
            <ArrowLeft size={16} />
            Back to Hub
          </Link>

          {!user ? (
            <div
              style={{
                background: '#fff',
                borderRadius: 18,
                border: '1px solid rgba(0,0,0,.06)',
                boxShadow: '0 10px 30px rgba(0,0,0,.06)',
                padding: '1.25rem',
              }}
            >
              <div style={{ fontWeight: 900, color: '#111' }}>Log in to view this circle.</div>
              <button
                onClick={() => {
                  setModalMode('login');
                  setShowModal(true);
                }}
                style={{
                  marginTop: 12,
                  borderRadius: 999,
                  border: '1.5px solid rgba(0,0,0,.10)',
                  background: '#667eea',
                  color: '#fff',
                  padding: '10px 14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Log in
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ margin: 0, fontSize: '2.4rem', color: '#111', letterSpacing: -0.4, marginBottom: 8 }}>
                    {group?.name ?? 'Circle'}
                  </h1>
                  <div style={{ color: '#666', fontWeight: 650, fontSize: '.95rem' }}>
                    Today: {today.shownUp}/{today.total} showed up
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isMember && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(0,0,0,.10)',
                        background: '#fff',
                        color: '#111',
                        fontWeight: 750,
                        cursor: 'pointer',
                        fontSize: '.9rem',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f1eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <Share2 size={16} />
                      Invite
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid rgba(0,0,0,.10)',
                      background: '#fff',
                      color: '#111',
                      fontWeight: 750,
                      cursor: 'pointer',
                      fontSize: '.9rem',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f1eb';
                        }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <Settings size={16} />
                    Settings
                      </button>
                </div>
              </div>

              {/* Show Up Composer */}
              {isMember && (
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 18,
                    border: '1px solid rgba(0,0,0,.06)',
                    boxShadow: '0 10px 30px rgba(0,0,0,.06)',
                    padding: '1.5rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#111', marginBottom: 6 }}>Showing up is automatic</div>
                  <div style={{ color: '#666', lineHeight: 1.55 }}>
                    When you finish a meditation, you’ll be marked as “showed up” here for today.
                  </div>
              </div>
              )}

              {/* Today */}
              <div
                style={{
                  background: '#fff',
                  borderRadius: 18,
                  border: '1px solid rgba(0,0,0,.06)',
                  boxShadow: '0 10px 30px rgba(0,0,0,.06)',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ fontWeight: 900, color: '#111', fontSize: '1.1rem', marginBottom: '1rem' }}>Today</div>

                {loading ? (
                  <div style={{ color: '#666', padding: '1rem 0' }}>Loading…</div>
                ) : todayCheckins.length === 0 ? (
                  <div style={{ color: '#666', padding: '1rem 0' }}>No one has shown up yet today.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {todayCheckins.map((c) => {
                      const nick = nicknameByUid[c.userId] || '';
                      const display = (nick || c.name || 'Anonymous').toString().trim().slice(0, 60) || 'Anonymous';
                      return (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 12px',
                          borderRadius: 14,
                          background: '#faf8f5',
                          border: '1px solid rgba(0,0,0,.04)',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 900, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {display} showed up
                          </div>
                          <div style={{ marginTop: 4, fontSize: '.8rem', color: '#888' }}>
                            {formatTodayTime(c.createdAt)}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function formatTodayTime(createdAt: unknown): string {
  // Tiny timestamp (today-only). Be defensive: createdAt may be undefined.
  try {
    const maybe = createdAt as { toDate?: () => Date } | null;
    const d = maybe?.toDate ? maybe.toDate() : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
