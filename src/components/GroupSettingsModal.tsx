'use client';

import React, { useState } from 'react';
import { X, Users, Edit, Globe, Lock, KeyRound, UserMinus, Archive } from 'lucide-react';
import type { Group } from '@/lib/groups';

interface GroupSettingsModalProps {
  group: Group;
  isOwner: boolean;
  currentUserId?: string | null;
  members?: Array<{ uid: string; name: string; role: string }>;
  onClose: () => void;
  onLeave?: () => void;
  onRename?: (newName: string) => void;
  onTogglePublic?: (isPublic: boolean) => void;
  onRegenerateCode?: () => void;
  onRemoveMember?: (memberUid: string) => void;
  onArchive?: () => void;
}

export default function GroupSettingsModal({
  group,
  isOwner,
  currentUserId,
  members = [],
  onClose,
  onLeave,
  onRename,
  onTogglePublic,
  onRegenerateCode,
  onRemoveMember,
  onArchive,
}: GroupSettingsModalProps) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(group.name);

  const handleRename = async () => {
    if (newName.trim() && newName.trim() !== group.name && onRename) {
      await Promise.resolve(onRename(newName.trim()));
      setRenaming(false);
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
          padding: '1.5rem',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,.15)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#111' }}>Settings</div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Member Actions */}
          <SettingsItem
            icon={<Users size={18} />}
            label="Leave circle"
            onClick={onLeave}
            danger
          />

          {/* Owner Actions */}
          {isOwner && (
            <>
              <div style={{ height: '1px', background: 'rgba(0,0,0,.08)', margin: '0.75rem 0' }} />
              
              {renaming ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.75rem' }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename();
                      if (e.key === 'Escape') {
                        setRenaming(false);
                        setNewName(group.name);
                      }
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,.10)',
                      padding: '8px 12px',
                      fontSize: '.9rem',
                    }}
                  />
                  <button
                    onClick={() => void handleRename()}
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,.10)',
                      background: '#667eea',
                      color: '#fff',
                      padding: '8px 12px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      fontSize: '.85rem',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setRenaming(false);
                      setNewName(group.name);
                    }}
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,.10)',
                      background: '#fff',
                      color: '#111',
                      padding: '8px 12px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      fontSize: '.85rem',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <SettingsItem
                  icon={<Edit size={18} />}
                  label="Rename circle"
                  onClick={() => setRenaming(true)}
                />
              )}

              <SettingsItem
                icon={group.public ? <Lock size={18} /> : <Globe size={18} />}
                label={group.public ? 'Make private' : 'Make public'}
                onClick={() => {
                  if (onTogglePublic) {
                    onTogglePublic(!group.public);
                  }
                }}
              />

              <SettingsItem
                icon={<KeyRound size={18} />}
                label="Regenerate invite code"
                onClick={onRegenerateCode}
              />

              {members.length > 0 && (
                <div style={{ padding: '6px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 12px 10px' }}>
                    <span style={{ color: '#666', display: 'flex', alignItems: 'center' }}>
                      <UserMinus size={18} />
                    </span>
                    <span style={{ fontWeight: 850, fontSize: '.95rem', color: '#111' }}>Members</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8, padding: '0 12px 6px', maxHeight: 240, overflowY: 'auto' }}>
                    {members.map((m) => {
                      const isMe = currentUserId ? m.uid === currentUserId : false;
                      return (
                        <div
                          key={m.uid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 10px',
                            borderRadius: 12,
                            border: '1px solid rgba(0,0,0,.06)',
                            background: '#fff',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 850, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.name}
                            </div>
                            <div style={{ marginTop: 3, fontSize: '.8rem', color: '#777', fontWeight: 650 }}>{m.role}</div>
                          </div>
                          {!isMe && (
                            <button
                              onClick={() => onRemoveMember?.(m.uid)}
                              style={{
                                borderRadius: 999,
                                border: '1px solid rgba(0,0,0,.10)',
                                background: '#fff',
                                color: '#111',
                                padding: '8px 12px',
                                fontWeight: 850,
                                cursor: 'pointer',
                                fontSize: '.85rem',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ height: '1px', background: 'rgba(0,0,0,.08)', margin: '0.75rem 0' }} />
              
              <SettingsItem
                icon={<Archive size={18} />}
                label="Archive circle"
                onClick={onArchive}
                danger
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px',
        borderRadius: 12,
        border: 'none',
        background: 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        color: danger ? '#dc2626' : '#111',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.background = danger ? 'rgba(220, 38, 38, 0.06)' : '#f5f1eb';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ color: danger ? '#dc2626' : '#666', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontWeight: 750, fontSize: '.95rem' }}>{label}</span>
    </button>
  );
}
