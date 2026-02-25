'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthHeader from '@/components/AuthHeader';
import EntryModal from '@/components/EntryModal';
import { joinGroupByCode } from '@/lib/groups';

export default function JoinPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const codeFromUrl = (sp.get('code') ?? '').toString();

  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'signup' | 'login'>('login');

  const [code, setCode] = useState(codeFromUrl);
  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUserId(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    setCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    // Auto-join if opened via invite link and logged in
    if (!userId) return;
    const c = codeFromUrl.trim();
    if (!c) return;
    void (async () => {
      setStatus('joining');
      setError(null);
      try {
        const res = await joinGroupByCode(c);
        setStatus('done');
        router.push(`/groups/${res.groupId}`);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Failed to join. Please check the invite code and try again.');
      }
    })();
  }, [userId, codeFromUrl, router]);

  const join = async () => {
    if (!userId) {
      setModalMode('login');
      setShowModal(true);
      return;
    }
    const c = code.trim();
    if (!c) return;
    setStatus('joining');
    setError(null);
    try {
      const res = await joinGroupByCode(c);
      setStatus('done');
      router.push(`/groups/${res.groupId}`);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to join. Please check the invite code and try again.');
    }
  };

  return (
    <>
      <AuthHeader onShowModal={(m) => { setModalMode(m); setShowModal(true); }} />
      {showModal && <EntryModal mode={modalMode} onClose={() => setShowModal(false)} />}

      <main
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #fafafa 0%, #f9f9f9 100%)',
          fontFamily: 'Poppins',
          padding: '7rem 1rem 3rem',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.3rem', margin: 0, color: '#111', letterSpacing: -0.4 }}>Join a group</h1>
          <p style={{ marginTop: 10, color: '#666', fontSize: '1.02rem', lineHeight: 1.65 }}>
            Paste an invite code (or open the invite link). No rankings — just “showed up today”.
          </p>

          <div
            style={{
              marginTop: 16,
              background: '#fff',
              borderRadius: 18,
              border: '1px solid rgba(0,0,0,.06)',
              boxShadow: '0 10px 30px rgba(0,0,0,.06)',
              padding: '1.15rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                  setStatus('idle');
                }}
                placeholder="Invite code"
                disabled={status === 'joining'}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: error ? '1px solid #dc2626' : '1px solid rgba(0,0,0,.10)',
                  padding: '12px 12px',
                  fontFamily: 'inherit',
                  background: '#fff',
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && status !== 'joining' && code.trim()) {
                    void join();
                  }
                }}
              />
              <button
                onClick={join}
                disabled={status === 'joining' || !code.trim()}
                style={{
                  borderRadius: 999,
                  border: '1.5px solid rgba(0,0,0,.10)',
                  background: status === 'joining' || !code.trim() ? '#666' : '#111',
                  color: '#fff',
                  padding: '11px 14px',
                  fontWeight: 900,
                  cursor: status === 'joining' || !code.trim() ? 'default' : 'pointer',
                  opacity: status === 'joining' || !code.trim() ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {status === 'joining' ? 'Joining…' : 'Join'}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ color: '#dc2626', fontWeight: 650, fontSize: '.9rem' }}>{error}</div>
              </div>
            )}
            {status === 'done' && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#dcfce7', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#16a34a', fontWeight: 650, fontSize: '.9rem' }}>Successfully joined! Redirecting...</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}


