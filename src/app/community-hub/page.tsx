'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AuthHeader from '@/components/AuthHeader';
import EntryModal from '@/components/EntryModal';
import JoinCircleModal from '@/components/JoinCircleModal';
import CreateCircleModal from '@/components/CreateCircleModal';
import { listMyGroups } from '@/lib/groups';
import { Users } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

export default function CommunityHubPage() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signup' | 'login'>('login');
  const [viewerNickname, setViewerNickname] = useState<string | null>(null);

  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groups, setGroups] = useState<
    Array<{ group: { id: string; name: string; ownerId: string; public?: boolean }; memberCount: number; showedUpToday: number }>
  >([]);

  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setViewerNickname(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const nick = snap.exists() ? ((snap.data() as { nickname?: string | null }).nickname ?? '') : '';
        const safe = nick.toString().trim().slice(0, 60);
        const fallback = (user.displayName || user.email?.split('@')[0] || '').toString().trim().slice(0, 60);
        if (!alive) return;
        setViewerNickname(safe || fallback || null);
      } catch {
        const fallback = (user.displayName || user.email?.split('@')[0] || '').toString().trim().slice(0, 60);
        if (alive) setViewerNickname(fallback || null);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [user?.uid, user?.displayName, user?.email]);

  const reloadMyCircles = async () => {
    if (!user) return;
    setGroupsLoading(true);
    try {
      const res = await listMyGroups();
      setGroups(res);
    } catch (e) {
      console.error('Failed to load circles', e);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setGroups([]);
      return;
    }
    void reloadMyCircles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const hasCircles = groups.length > 0;
  const allQuiet = hasCircles && groups.every((g) => (g.showedUpToday ?? 0) === 0);

  const sorted = useMemo(() => {
    // Today-only inbox; keep stable order by name (not activity).
    return [...groups].sort((a, b) => a.group.name.localeCompare(b.group.name));
  }, [groups]);

  const { privateCircles, publicCircles } = useMemo(() => {
    const priv = sorted.filter((g) => g.group.public !== true);
    const pub = sorted.filter((g) => g.group.public === true);
    return { privateCircles: priv, publicCircles: pub };
  }, [sorted]);

  return (
    <>
      <AuthHeader
        onShowModal={(m) => {
          setAuthModalMode(m);
          setShowAuthModal(true);
        }}
      />
      {showAuthModal && <EntryModal mode={authModalMode} onClose={() => setShowAuthModal(false)} />}

      {showJoin && (
        <JoinCircleModal
          user={user}
          onClose={() => setShowJoin(false)}
          onLogin={() => {
            setShowJoin(false);
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          onJoined={(groupId) => {
            setShowJoin(false);
            window.location.href = `/groups/${groupId}`;
          }}
        />
      )}

      {showCreate && (
        <CreateCircleModal
          user={user}
          onClose={() => setShowCreate(false)}
          onLogin={() => {
            setShowCreate(false);
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          onCreated={async () => {
            await reloadMyCircles();
          }}
        />
      )}

      <main
        className="hub-main"
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #faf8f5 0%, #f9f9f9 100%)',
          fontFamily: 'Poppins',
          padding: '7rem 1rem 4rem',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Header */}
          <div
            className="hub-header"
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={24} stroke="#667eea" />
                <h1 style={{ fontSize: '2.2rem', margin: 0, color: '#111', letterSpacing: -0.4 }}>Community Hub</h1>
              </div>
              <div style={{ marginTop: 8, color: '#666', fontWeight: 650 }}>Today, we show up.</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowJoin(true)}
                  className="hub-cta hub-cta-join"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#111',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontSize: '.95rem',
                  }}
                >
                  Join
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="hub-cta hub-cta-create"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#111',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontSize: '.95rem',
                  }}
                >
                  Create
                </button>
              </div>

              {user && viewerNickname && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    fontSize: '.86rem',
                    fontWeight: 650,
                    color: 'rgba(17,17,17,0.62)',
                    lineHeight: 1,
                    marginTop: 2,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: 'rgba(17,17,17,0.16)',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: 'rgba(17,17,17,0.52)' }}>Viewing as</span>
                  <span style={{ color: 'rgba(17,17,17,0.75)', fontWeight: 750 }}>{viewerNickname}</span>
                </div>
              )}
            </div>
          </div>

          {/* Gentle banner when all circles are quiet today */}
          {user && allQuiet && (
            <div
              className="hub-banner"
              style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 14,
                background: '#fff',
                border: '1px solid rgba(0,0,0,.06)',
                boxShadow: '0 10px 30px rgba(0,0,0,.05)',
                color: '#111',
              }}
            >
              <div style={{ fontWeight: 850 }}>It’s quiet today.</div>
              <div style={{ marginTop: 4, color: '#666' }}>Want to be the first to show up in one of your circles?</div>
            </div>
          )}

          {/* Inbox list */}
          <div
            className="hub-inbox"
            style={{
              marginTop: 18,
              borderRadius: 18,
              background: '#fff',
              border: '1px solid rgba(0,0,0,.06)',
              boxShadow: '0 10px 30px rgba(0,0,0,.06)',
              overflow: 'hidden',
            }}
          >
            {!user ? (
              <div style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 850, color: '#111' }}>Log in to see your circles.</div>
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setShowAuthModal(true);
                  }}
                  style={{
                    marginTop: 12,
                    border: '1px solid rgba(0,0,0,.10)',
                    background: '#667eea',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '10px 14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Log in
                </button>
              </div>
            ) : groupsLoading ? (
              <div style={{ padding: '1.25rem', color: '#666' }}>Loading…</div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: '1.25rem' }}>
                <div style={{ color: '#666' }}>No circles yet. Join one or create yours.</div>
              </div>
            ) : (
              <div>
                {privateCircles.length > 0 && (
                  <SectionLabel label="Private circles" />
                )}
                {privateCircles.map(({ group, memberCount, showedUpToday }) => (
                  <CircleRow
                    key={group.id}
                    name={group.name}
                    memberCount={memberCount}
                    showedUpToday={showedUpToday}
                    onClick={() => {
                      window.location.href = `/groups/${group.id}`;
                    }}
                  />
                ))}

                {publicCircles.length > 0 && (
                  <SectionLabel label="Public circles" />
                )}
                {publicCircles.map(({ group, memberCount, showedUpToday }) => (
                  <CircleRow
                    key={group.id}
                    name={group.name}
                    memberCount={memberCount}
                    showedUpToday={showedUpToday}
                    onClick={() => {
                      window.location.href = `/groups/${group.id}`;
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <footer className="hub-footer" style={{ marginTop: '4rem', textAlign: 'center', fontSize: '.9rem', color: '#777' }}>
            CalmPulseDaily © {new Date().getFullYear()}
          </footer>
        </div>
        <style>{`
          @keyframes hubFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes hubFadeInUp {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .hub-header{
            opacity: 0;
            animation: hubFadeInUp 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.10s forwards;
          }
          .hub-banner{
            opacity: 0;
            animation: hubFadeIn 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.20s forwards;
          }
          .hub-inbox{
            opacity: 0;
            animation: hubFadeInUp 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.18s forwards;
          }
          .hub-footer{
            opacity: 0;
            animation: hubFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.28s forwards;
          }

          .hub-cta{
            border: none;
            border-radius: 14px;
            color: #111;
            background-blend-mode: screen, normal;
            box-shadow:
              0 10px 24px rgba(0,0,0,0.07),
              0 0 0 1px rgba(0,0,0,0.04) inset;
            transition: filter 170ms ease, transform 130ms ease, box-shadow 170ms ease;
            will-change: transform;
          }

          .hub-cta-join{
            background:
              linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 45%),
              radial-gradient(circle at 50% 36%,
                rgba(34,197,94,0.32) 0%,
                rgba(34,197,94,0.21) 52%,
                rgba(34,197,94,0.15) 100%);
            box-shadow:
              0 11px 26px rgba(34,197,94,0.22),
              0 0 0 1px rgba(34,197,94,0.14) inset;
          }

          .hub-cta-create{
            background:
              linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 45%),
              radial-gradient(circle at 50% 36%,
                rgba(251,146,60,0.34) 0%,
                rgba(251,146,60,0.23) 52%,
                rgba(251,146,60,0.16) 100%);
            box-shadow:
              0 11px 26px rgba(251,146,60,0.24),
              0 0 0 1px rgba(251,146,60,0.14) inset;
          }

          .hub-cta:hover{
            filter: brightness(1.045) contrast(1.03) saturate(1.04);
          }

          .hub-cta:active{
            transform: translateY(1px) scale(0.99);
            box-shadow:
              0 6px 14px rgba(0,0,0,0.07),
              0 0 0 1px rgba(0,0,0,0.04) inset;
          }

          @media (prefers-reduced-motion: reduce){
            .hub-header,
            .hub-banner,
            .hub-inbox,
            .hub-footer{
              opacity: 1 !important;
              transform: none !important;
              animation: none !important;
            }
            .hub-cta{
              transition: none !important;
            }
          }
        `}</style>
      </main>
    </>
  );
}

function CircleRow({
  name,
  memberCount,
  showedUpToday,
  onClick,
}: {
  name: string;
  memberCount: number;
  showedUpToday: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const rightPill = `${showedUpToday}/${memberCount}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '14px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'pointer',
        background: hovered ? '#faf8f5' : '#fff',
        borderTop: '1px solid rgba(0,0,0,.06)',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ marginTop: 4, fontSize: '.9rem', color: '#666' }}>
          {showedUpToday > 0 ? `Today: ${showedUpToday}/${memberCount} showed up` : 'No one has shown up yet today'}
        </div>
      </div>

      <span
        style={{
          flexShrink: 0,
          fontSize: '.85rem',
          fontWeight: 850,
          color: '#111',
          padding: '7px 10px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {rightPill}
      </span>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.02)',
        borderTop: '1px solid rgba(0,0,0,.06)',
        fontSize: '.85rem',
        fontWeight: 900,
        color: '#555',
        letterSpacing: '0.01em',
      }}
    >
      {label}
    </div>
  );
}

