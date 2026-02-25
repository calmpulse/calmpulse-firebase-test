'use client';

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { User } from 'firebase/auth';
import { createGroup } from '@/lib/groups';

export default function CreateCircleModal({
  user,
  onClose,
  onLogin,
  onCreated,
}: {
  user: User | null;
  onClose: () => void;
  onLogin: () => void;
  onCreated: (groupId: string) => void;
}) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ groupId: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Circle name is required.');
      return;
    }
    if (!user) {
      onLogin();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createGroup(trimmed, visibility === 'public');
      setCreated(res);
      onCreated(res.groupId);
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create circle.');
    } finally {
      setLoading(false);
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
          maxWidth: 520,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#111' }}>Create</div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Circle name"
            style={{
              width: '100%',
              borderRadius: 12,
              border: error ? '1px solid rgba(220,38,38,0.6)' : '1px solid rgba(0,0,0,.10)',
              padding: '12px 12px',
              fontFamily: 'inherit',
              background: '#fff',
              fontSize: '1rem',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) void submit();
            }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ToggleChip active={visibility === 'public'} onClick={() => setVisibility('public')} tint="rgba(34,197,94,0.10)">
              Public
            </ToggleChip>
            <ToggleChip
              active={visibility === 'private'}
              onClick={() => setVisibility('private')}
              tint="rgba(251,146,60,0.10)"
            >
              Private
            </ToggleChip>
          </div>

          <button
            onClick={() => void submit()}
            disabled={loading}
            style={{
              border: '1px solid rgba(0,0,0,.10)',
              background: loading ? '#eee' : 'rgba(251,146,60,0.14)',
              color: '#111',
              borderRadius: 999,
              padding: '12px 14px',
              fontWeight: 900,
              cursor: loading ? 'default' : 'pointer',
              fontSize: '.95rem',
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? 'Creating…' : 'Create circle'}
          </button>

          {error && <div style={{ color: '#dc2626', fontWeight: 650 }}>{error}</div>}

          {created && visibility === 'private' && (
            <div
              style={{
                marginTop: 6,
                padding: '12px',
                borderRadius: 14,
                border: '1px solid rgba(251,146,60,0.18)',
                background: 'rgba(251,146,60,0.06)',
              }}
            >
              <div style={{ fontWeight: 850, color: '#111', marginBottom: 8 }}>Invite code</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 900, fontSize: '1.1rem' }}>
                  {created.inviteCode}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(created.inviteCode);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1200);
                    } catch {
                      // ignore
                    }
                  }}
                  style={{
                    border: '1px solid rgba(0,0,0,.10)',
                    background: '#fff',
                    color: '#111',
                    borderRadius: 999,
                    padding: '8px 12px',
                    fontWeight: 850,
                    cursor: 'pointer',
                    fontSize: '.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleChip({
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
        border: '1px solid rgba(0,0,0,.10)',
        background: active ? tint : '#fff',
        padding: '10px 12px',
        fontWeight: 850,
        cursor: 'pointer',
        fontSize: '.9rem',
      }}
    >
      {children}
    </button>
  );
}

