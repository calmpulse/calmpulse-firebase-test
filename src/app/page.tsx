'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthHeader from '@/components/AuthHeader';
import EntryModal from '@/components/EntryModal';
import WelcomeModal from '@/components/WelcomeModal';

export default function Home() {
  const router = useRouter();
  const [isRouting, setIsRouting] = useState(false);

  const routeTo = (href: string) => {
    if (isRouting) return;
    setIsRouting(true);
    // Let the zoom animation play, then navigate
    window.setTimeout(() => {
      router.push(href);
    }, 240);
  };

  /** auth */
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserId(u?.uid ?? null);
      setAuthChecked(true); // Mark auth as checked after first callback
    });
    return unsub;
  }, []);

  /** modal */
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'signup' | 'login'>('signup');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  /* -------- show welcome modal for non-logged-in users -------- */
  useEffect(() => {
    // Only show modal after auth state has been checked
    if (!authChecked) {
      setShowWelcomeModal(false);
      return;
    }

    // Show welcome modal only if user is not logged in
    if (!userId) {
      // Small delay to ensure smooth page load
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 500);

      return () => {
        clearTimeout(timer);
      };
    } else {
      // Hide welcome modal if user is logged in
      setShowWelcomeModal(false);
    }
  }, [userId, authChecked]);

  /* ---------- UI ---------- */
  return (
    <>
      <AuthHeader onShowModal={(m) => { setModalMode(m); setShowModal(true); }} />
      {showModal && <EntryModal mode={modalMode} onClose={() => setShowModal(false)} />}
      {showWelcomeModal && (
        <WelcomeModal
          onSubscribe={() => {
            setShowWelcomeModal(false);
            setModalMode('signup');
            setShowModal(true);
          }}
          onLogin={() => {
            setShowWelcomeModal(false);
            setModalMode('login');
            setShowModal(true);
          }}
          onContinue={() => {
            setShowWelcomeModal(false);
          }}
        />
      )}

      {/* ---------- HERO ---------- */}
      <section 
        className={`hero${isRouting ? ' is-route-exit' : ''}`}
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8rem 1rem 4rem',
          fontFamily: 'Poppins',
          background: 'linear-gradient(180deg, #fafafa 0%, #f9f9f9 100%)',
          textAlign: 'center',
          position: 'relative',
          width: '100%',
          margin: 0,
        }}
      >
        <div 
          className="hero-content"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <div className="hero-title" style={{ fontSize: '2.4rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#111' }}>
              You’re here.
            </div>
            <div className="hero-title" style={{ fontSize: '2.4rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#111', marginTop: 6 }}>
              Take a moment.
            </div>

            <div className="hero-copy" style={{ marginTop: 10, fontSize: '1.02rem', color: '#666', fontWeight: 400, lineHeight: 1.45 }}>
              A simple place to keep a promise to yourself.
          </div>

            <div className="hero-copy-strong" style={{ marginTop: 18, fontSize: '1.08rem', fontWeight: 650, color: '#111' }}>
              Any one of these counts.
        </div>

          <div 
              className="choices"
            style={{
                marginTop: 22,
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
                alignItems: 'stretch',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 160 }}>
                <button
                  className="btn primary"
                  onClick={() => routeTo('/meditation/touch')}
                  aria-label="Start Touch (30 seconds)"
                  disabled={isRouting}
                >
                  Touch
                </button>
                <div style={{ fontSize: '.9rem', color: '#666', fontWeight: 400 }}>30 seconds</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 160 }}>
                <button
                  className="btn primary"
                  onClick={() => routeTo('/meditation/sit')}
                  aria-label="Start Sit (2 minutes)"
                  disabled={isRouting}
                >
                  Sit
          </button>
                <div style={{ fontSize: '.9rem', color: '#666', fontWeight: 400 }}>2 minutes</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 160 }}>
                <button
                  className="btn primary"
                  onClick={() => routeTo('/meditation/stay')}
                  aria-label="Start Stay (15 minutes)"
                  disabled={isRouting}
                >
                  Stay
          </button>
                <div style={{ fontSize: '.9rem', color: '#666', fontWeight: 400 }}>15 minutes</div>
              </div>
        </div>

            <footer style={{ marginTop: '3rem', fontSize: '.9rem', color: '#999', fontWeight: 300, letterSpacing: '0.02em' }}>
              CalmPulseDaily © {new Date().getFullYear()}
            </footer>
          </div>
        </div>
      </section>

      {/* ---------- STYLES ---------- */}
      <style jsx>{`
        .btn,
        .btn.primary{
          background:#fff;
          color:#000;
          border:2px solid #000;
          border-radius:999px;
          padding:.55rem 1.4rem;
          font:500 1rem Poppins;
          cursor:pointer;
          min-width:110px;
          text-align:center;
          transition:all .5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          will-change:transform;
          position:relative;
          overflow:hidden;
        }
        .btn.test{
          border-style:dashed;
          opacity:.9;
        }
        .btn::before,
        .btn.primary::before{
          content:'';
          position:absolute;
          top:50%;
          left:50%;
          width:0;
          height:0;
          border-radius:50%;
          background:rgba(255,255,255,.1);
          transform:translate(-50%, -50%);
          transition:width .6s ease, height .6s ease;
        }
        .btn:hover::before,
        .btn.primary:hover::before{
          width:300px;
          height:300px;
        }
        .btn.primary{
          background:#000;
          color:#fff;
        }
        .btn:hover:not(:disabled),
        .btn.primary:hover:not(:disabled){
          transform:translateY(-2px);
          box-shadow:0 12px 30px rgba(0,0,0,.12);
        }
        .btn:disabled{
          opacity:0.4;
          cursor:not-allowed;
        }

        .hero{
          min-height:100dvh;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:8rem 1rem 4rem;
          font-family:Poppins;
          background:linear-gradient(180deg, #fafafa 0%, #f9f9f9 100%);
          text-align:center;
          position:relative;
          width:100%;
          margin:0;
        }
        .hero::before{
          content:'';
          position:absolute;
          top:0;
          left:0;
          right:0;
          bottom:0;
          background:radial-gradient(circle at 50% 50%, rgba(255,215,0,0.03) 0%, transparent 70%);
          pointer-events:none;
        }
        .hero{
          transform-origin: 50% 38%;
          will-change: transform, opacity, filter;
        }
        .hero.is-route-exit{
          animation: cpRouteZoomOut 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes cpRouteZoomOut{
          0%   { transform: scale(1); opacity: 1; filter: blur(0px); }
          100% { transform: scale(1.04); opacity: 0; filter: blur(2px); }
        }
        .hero-content{
          position:relative;
          z-index:1;
          width:100%;
          max-width:100%;
          display:flex;
          flex-direction:column;
          align-items:center;
          text-align:center;
          opacity:0;
          animation:fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s forwards;
        }
        @keyframes fadeInUp{
          from{
            opacity:0;
            transform:translateY(20px);
          }
          to{
            opacity:1;
            transform:translateY(0);
          }
        }
        @keyframes fadeIn{
          to{opacity:1;}
        }

        @media (prefers-reduced-motion: reduce){
          .hero-content,
          .hero.is-route-exit,
          footer{
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }

        @media (max-width: 820px){
          .hero{
            padding:
              clamp(5.5rem, 15dvh, 8rem)
              max(1rem, env(safe-area-inset-right))
              calc(2.2rem + env(safe-area-inset-bottom))
              max(1rem, env(safe-area-inset-left));
          }
          .hero-title{
            font-size: clamp(2rem, 9.5vw, 2.4rem) !important;
            line-height: 1.08;
          }
          .hero-copy{
            font-size: clamp(0.96rem, 3.9vw, 1.02rem) !important;
          }
          .hero-copy-strong{
            font-size: clamp(1rem, 4.2vw, 1.08rem) !important;
          }
          .choices > div{
            min-width: min(160px, 44vw) !important;
          }
          .choices{
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px 18px !important;
            width: 100%;
            max-width: 520px;
            margin: 22px auto 0 !important;
            justify-items: center;
            align-items: start;
          }
          .choices > div{
            width: 100% !important;
            min-width: 0 !important;
            max-width: 220px;
            gap: 10px !important;
          }
          .choices > div:nth-child(3){
            grid-column: 1 / -1;
            justify-self: center;
          }
          .choices .btn,
          .choices .btn.primary{
            width: 100%;
            max-width: 220px;
          }
          .btn,
          .btn.primary{
            min-height: 44px;
          }
        }
      `}</style>
    </>
  );
}
