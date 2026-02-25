'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { User } from 'firebase/auth';
import { joinGroupByCode, joinPublicGroup, listPublicCircles } from '@/lib/groups';

export default function JoinCircleModal({
  user,
  onClose,
  onLogin,
  onJoined,
}: {
  user: User | null;
  onClose: () => void;
  onLogin: () => void;
  onJoined: (groupId: string) => void;
}) {
  const [tab, setTab] = useState<'public' | 'private'>('public');

  // Public tab state
  const [search, setSearch] = useState('');
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [publicCircles, setPublicCircles] = useState<Array<{ group: { id: string; name: string }; memberCount: number }>>([]);

  // Private tab state
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'public') return;
    let alive = true;
    const load = async () => {
      setPublicLoading(true);
      setPublicError(null);
      try {
        const res = await listPublicCircles(search);
        if (!alive) return;
        setPublicCircles(res);
      } catch (e) {
        if (!alive) return;
        setPublicError(e instanceof Error ? e.message : 'Could not load circles.');
        setPublicCircles([]);
      } finally {
        if (alive) setPublicLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [tab, search]);

  const sortedPublic = useMemo(() => {
    // listPublicCircles already sorts by memberCount desc, but keep deterministic.
    return [...publicCircles].sort((a, b) => b.memberCount - a.memberCount);
  }, [publicCircles]);

  const joinByCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setCodeError('Code is required.');
      return;
    }
    if (!user) {
      onLogin();
      return;
    }
    setCodeLoading(true);
    setCodeError(null);
    try {
      const res = await joinGroupByCode(trimmed);
      onJoined(res.groupId);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'Invalid code. Please try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          maxWidth: 560,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,.15)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#111' }}>Join</div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <TabButton active={tab === 'public'} onClick={() => setTab('public')} tint="rgba(34,197,94,0.10)">
            Public
          </TabButton>
          <TabButton active={tab === 'private'} onClick={() => setTab('private')} tint="rgba(251,146,60,0.10)">
            Private
          </TabButton>
        </div>

        {tab === 'public' ? (
          <div>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search public circles…"
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,.10)',
                  padding: '12px 12px 12px 40px',
                  fontFamily: 'inherit',
                  background: '#fff',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            {publicLoading ? (
              <div style={{ color: '#666', padding: '0.75rem 0' }}>Loading…</div>
            ) : publicError ? (
              <div style={{ color: '#dc2626', padding: '0.75rem 0', fontWeight: 650 }}>{publicError}</div>
            ) : sortedPublic.length === 0 ? (
              <div style={{ color: '#666', padding: '0.75rem 0' }}>No public circles found.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {sortedPublic.map(({ group, memberCount }) => (
                  <div
                    key={group.id}
                    style={{
                      borderRadius: 14,
                      border: '1px solid rgba(0,0,0,.06)',
                      background: '#fff',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {group.name}
                      </div>
                      <div style={{ marginTop: 4, fontSize: '.85rem', color: '#666' }}>
                        {memberCount} members · Public
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!user) {
                          onLogin();
                          return;
                        }
                        try {
                          await joinPublicGroup(group.id);
                          onJoined(group.id);
                        } catch (e) {
                          setPublicError(e instanceof Error ? e.message : 'Could not join.');
                        }
                      }}
                      style={{
                        border: '1px solid rgba(0,0,0,.10)',
                        background: 'rgba(34,197,94,0.12)',
                        color: '#111',
                        borderRadius: 999,
                        padding: '10px 14px',
                        fontWeight: 850,
                        cursor: 'pointer',
                        fontSize: '.9rem',
                      }}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCodeError(null);
                }}
                placeholder="Invite code"
                style={{
                  flex: 1,
                  minWidth: 220,
                  borderRadius: 12,
                  border: codeError ? '1px solid rgba(220,38,38,0.6)' : '1px solid rgba(0,0,0,.10)',
                  padding: '12px 12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  background: '#fff',
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code.trim() && !codeLoading) void joinByCode();
                }}
              />
              <button
                onClick={() => void joinByCode()}
                disabled={codeLoading}
                style={{
                  border: '1px solid rgba(0,0,0,.10)',
                  background: codeLoading ? '#eee' : 'rgba(34,197,94,0.12)',
                  color: '#111',
                  borderRadius: 999,
                  padding: '12px 14px',
                  fontWeight: 900,
                  cursor: codeLoading ? 'default' : 'pointer',
                  fontSize: '.95rem',
                  opacity: codeLoading ? 0.7 : 1,
                }}
              >
                {codeLoading ? 'Joining…' : 'Join circle'}
              </button>
            </div>
            {codeError && <div style={{ marginTop: 10, color: '#dc2626', fontWeight: 650 }}>{codeError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  tint,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tint: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active ? '1px solid rgba(0,0,0,.10)' : '1px solid rgba(0,0,0,.08)',
        background: active ? tint : '#fff',
        padding: '9px 12px',
        fontWeight: 850,
        cursor: 'pointer',
        fontSize: '.9rem',
      }}
    >
      {children}
    </button>
  );
}

