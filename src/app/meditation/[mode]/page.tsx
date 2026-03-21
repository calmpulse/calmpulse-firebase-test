'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { findMeditationURL } from '@/lib/findMeditation';
import { startSession, completeSession, saveTomorrowPlan } from '@/lib/sessionLog';

type Mode = 'touch' | 'sit' | 'stay';

type Particle = {
  id: string;
  left: number; // %
  top: number; // %
  size: number; // px
  dx: number; // px
  dyUp: number; // px (negative)
  dyDown: number; // px (positive)
  delayMs: number;
  durationMs: number;
  opacity: number;
  color: string;
};

function secondsForMode(mode: Mode): number {
  if (mode === 'touch') return 30;
  if (mode === 'sit') return 120;
  return 60 * 15;
}

function titleForMode(mode: Mode): string {
  if (mode === 'touch') return 'Touch';
  if (mode === 'sit') return 'Sit';
  return 'Stay';
}

export default function MeditationModePage() {
  const router = useRouter();
  const params = useParams<{ mode?: string }>();
  const mode = (params?.mode ?? 'stay') as Mode;

  const totalSeconds = useMemo(() => {
    if (mode !== 'touch' && mode !== 'sit' && mode !== 'stay') return secondsForMode('stay');
    return secondsForMode(mode);
  }, [mode]);

  const displayTitle = useMemo(() => {
    if (mode !== 'touch' && mode !== 'sit' && mode !== 'stay') return titleForMode('stay');
    return titleForMode(mode);
  }, [mode]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtMsRef = useRef<number | null>(null);
  const pausedAccumulatedMsRef = useRef<number>(0);
  const pauseStartedAtMsRef = useRef<number | null>(null);
  const elapsedRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);

  const [userId, setUserId] = useState<string | null>(null);

  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  const [confirmed, setConfirmed] = useState(false);
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [savingTomorrow, setSavingTomorrow] = useState(false);

  const [particles, setParticles] = useState<Particle[]>([]);
  const [showReward, setShowReward] = useState(false);
  const [isRouteExit, setIsRouteExit] = useState(false);

  const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
  const routeHomeWithZoom = async () => {
    if (isRouteExit) return;
    setIsRouteExit(true);
    await sleep(360);
    router.push('/');
  };

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUserId(u?.uid ?? null));
    return unsub;
  }, []);

  // No-scroll, full-screen immersion for meditation page only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // load daily audio
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const selectedMode: Mode = mode === 'touch' || mode === 'sit' || mode === 'stay' ? mode : 'stay';
        const url = await findMeditationURL(selectedMode);
        if (cancelled) return;
        if (url) setAudioURL(url);
        else setLoadErr(true);
      } catch {
        if (!cancelled) setLoadErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // inject audio url
  useEffect(() => {
    if (!audioRef.current || !audioURL) return;
    audioRef.current.src = audioURL;
    audioRef.current.load();
  }, [audioURL]);

  // timer loop
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

  const markCompleted = () => {
    if (finishedRef.current) return;
    setElapsed(totalSeconds);
    setIsPlaying(false);
    setFinished(true);
  };

  const getElapsedFromSource = (): number => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
      return Math.max(0, Math.min(totalSeconds, audio.currentTime));
    }
    if (!startedAtMsRef.current) return 0;
    const pausedNow = pauseStartedAtMsRef.current ? Date.now() - pauseStartedAtMsRef.current : 0;
    const wallSeconds = (Date.now() - startedAtMsRef.current - pausedAccumulatedMsRef.current - pausedNow) / 1000;
    return Math.max(0, Math.min(totalSeconds, wallSeconds));
  };

  const resyncTimerUI = (source: string) => {
    const audio = audioRef.current;
    const nextElapsed = getElapsedFromSource();
    setElapsed(nextElapsed);

    if (audio?.ended || nextElapsed >= totalSeconds - 0.05) {
      markCompleted();
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      resyncTimerUI('interval-250ms');
    }, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying]);

  useEffect(() => {
    const onVisibility = () => {
      resyncTimerUI(`visibility:${document.visibilityState}`);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      markCompleted();
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  // reward sequence (end-of-timer only): warm fade + gentle release + subtle particles
  useEffect(() => {
    if (!finished) return;

    setShowReward(true);

    // dots only, warm palette
    const colors = [
      'rgba(255, 250, 235, 0.95)', // cream
      'rgba(255, 221, 0, 0.90)',   // gold
      'rgba(251, 146, 60, 0.85)',  // light orange
    ];
    const now = Date.now();
    const count = 14; // very subtle confetti for minimal aesthetic
    const nextParticles: Particle[] = Array.from({ length: count }, (_, i) => {
      const size = 4 + Math.random() * 6;
      // burst from around the center circle area
      const left = 38 + Math.random() * 24; // 38%..62%
      const top = 28 + Math.random() * 20; // 28%..48%
      const dx = (Math.random() - 0.5) * 120;
      const dyUp = -(45 + Math.random() * 80);
      const dyDown = 170 + Math.random() * 180;
      return {
        id: `${now}_${i}`,
        left,
        top,
        size,
        dx,
        dyUp,
        dyDown,
        delayMs: Math.floor(Math.random() * 220),
        durationMs: 2500 + Math.floor(Math.random() * 600), // 2.5–3.1s
        opacity: 0.12 + Math.random() * 0.10,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      };
    });
    setParticles(nextParticles);

    const t = setTimeout(() => {
      setParticles([]);
      setShowReward(false);
    }, 3200);

    return () => clearTimeout(t);
  }, [finished]);

  // autoplay attempt once we have audio
  useEffect(() => {
    if (!audioURL || !audioRef.current) return;
    if (finished || confirmed) return;

    // start immediately (best-effort; if blocked we show a minimal overlay)
    const tryAutoplay = async () => {
      setAutoplayBlocked(false);
      try {
        setElapsed(0);
        audioRef.current!.currentTime = 0;
        await audioRef.current!.play();
        if (!startedAtMsRef.current) startedAtMsRef.current = Date.now();
        pauseStartedAtMsRef.current = null;
        setIsPlaying(true);
        if (userId) startSession(userId);
      } catch {
        setAutoplayBlocked(true);
        setIsPlaying(false);
      }
    };

    void tryAutoplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioURL]);

  const pause = () => {
    if (!pauseStartedAtMsRef.current) pauseStartedAtMsRef.current = Date.now();
    audioRef.current?.pause();
    resyncTimerUI('pause-click');
    setIsPlaying(false);
  };

  const resume = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      if (!startedAtMsRef.current) startedAtMsRef.current = Date.now();
      if (pauseStartedAtMsRef.current) {
        pausedAccumulatedMsRef.current += Date.now() - pauseStartedAtMsRef.current;
        pauseStartedAtMsRef.current = null;
      }
      resyncTimerUI('resume-click');
      setIsPlaying(true);
      setAutoplayBlocked(false);
      if (userId) startSession(userId);
    } catch {
      setAutoplayBlocked(true);
      setIsPlaying(false);
    }
  };

  const exit = () => {
    audioRef.current?.pause();
    void routeHomeWithZoom();
  };

  const circumference = 2 * Math.PI * 90;
  const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;
  const dashOffset = circumference * (1 - progress);
  const remaining = Math.max(0, totalSeconds - elapsed);
  const remainingWhole = Math.floor(remaining);
  const remainingLabel =
    remainingWhole >= 60
      ? `${Math.floor(remainingWhole / 60)}:${String(remainingWhole % 60).padStart(2, '0')}`
      : `${remainingWhole}s`;

  const onConfirmYes = async () => {
    setConfirmed(true);
    // per requirements: if not logged in, do not save
    if (!userId) return;
    const audio = audioRef.current;
    const elapsedFromSource = Math.floor(getElapsedFromSource());
    const actualCompletedSeconds = audio?.ended ? totalSeconds : Math.min(totalSeconds, Math.max(0, elapsedFromSource));
    await completeSession(userId, actualCompletedSeconds);
  };

  const onSkipTomorrow = () => {
    void routeHomeWithZoom();
  };

  const onSaveTomorrow = async () => {
    const text = tomorrowPlan.trim();
    setSavingTomorrow(true);
    if (!isRouteExit) setIsRouteExit(true);
    try {
      // Ensure the zoom-out plays even if saving is fast
      await Promise.all([saveTomorrowPlan(userId, text), sleep(260)]);
    } finally {
      setSavingTomorrow(false);
      router.push('/');
    }
  };

  const showAutoplayOverlay = autoplayBlocked && !finished && !confirmed;

  return (
    <>
      <main
        className={`cp-med-main cp-route-zoom${finished ? ' is-finished' : ''}${isRouteExit ? ' is-route-exit' : ''}`}
        style={{
          height: '100dvh',
          minHeight: '100svh',
          overflow: 'hidden',
          fontFamily: 'Poppins',
          padding: '0 1rem',
          textAlign: 'center',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {/* subtle reward particles (dots only) */}
        {showReward && particles.length > 0 && (
          <div className="cp-particles" aria-hidden="true">
            {particles.map((p) => (
              <span
                key={p.id}
                className="cp-particle"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  opacity: p.opacity,
                  transform: 'translate3d(0,0,0)',
                  // feed motion via CSS vars (so we can keep keyframes clean)
                  ['--dx' as unknown as string]: `${p.dx}px`,
                  ['--dyUp' as unknown as string]: `${p.dyUp}px`,
                  ['--dyDown' as unknown as string]: `${p.dyDown}px`,
                  ['--delay' as unknown as string]: `${p.delayMs}ms`,
                  ['--dur' as unknown as string]: `${p.durationMs}ms`,
                }}
              />
            ))}
          </div>
        )}

        <div
          className="cp-med-content"
          style={{
            width: '100%',
            maxWidth: 760,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{ fontSize: '0.98rem', color: 'rgba(17,17,17,0.52)', fontWeight: 650, letterSpacing: '0.10em' }}>
            {displayTitle}
          </div>

          {/* Circle + progress ring */}
          <div
            className={`cp-circle${finished ? ' is-release' : ''}`}
            style={{
              width: 'min(270px, 76vw)',
              height: 'min(270px, 76vw)',
              borderRadius: 9999,
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
            aria-label="Meditation timer"
          >
            <svg width="220" height="220" aria-hidden="true" style={{ maxWidth: '100%', height: 'auto' }}>
              {/* warm-neutral base ring (always visible) */}
              <circle r="90" cx="110" cy="110" stroke="rgba(255, 221, 0, 0.12)" strokeWidth="6" fill="none" />
              <circle
                className="cp-ring"
                r="90"
                cx="110"
                cy="110"
                stroke="#FFDD00"
                strokeWidth="6"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 110 110)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>

            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              {!finished ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                  <div
                    style={{
                      fontSize: 'clamp(2.25rem, 7.1vw, 3.0rem)',
                      fontWeight: 700,
                      color: 'rgba(17,17,17,0.80)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {remainingLabel}
                  </div>
                  <div
                    className={`cp-status${isPlaying ? ' is-breathing' : ''}`}
                    style={{ fontSize: '.95rem', color: 'rgba(17,17,17,0.62)' }}
                  >
                    {isPlaying ? 'Grounding…' : 'Paused'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '1.05rem', color: 'rgba(17,17,17,0.62)', fontWeight: 650 }}>Done</div>
              )}
            </div>
          </div>

          {/* Controls / screens */}
          {!finished && !confirmed && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              <button className="btn quiet" onClick={isPlaying ? pause : resume} aria-label={isPlaying ? 'Pause' : 'Resume'}>
                {isPlaying ? 'Pause' : 'Resume'}
              </button>
              <button className="btn quiet" onClick={exit} aria-label="Exit meditation">
                Exit
              </button>
            </div>
          )}

          {finished && !confirmed && (
            <div style={{ marginTop: 10, width: '100%', maxWidth: 560 }}>
              <div style={{ fontSize: '1.45rem', fontWeight: 650, color: 'rgba(17,17,17,0.86)' }}>You kept your word today.</div>
              <div style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={onConfirmYes} aria-label="Confirm completion">
                  Yes
                </button>
              </div>
            </div>
          )}

          {confirmed && (
            <div style={{ marginTop: 8, width: '100%', maxWidth: 560 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 650, color: 'rgba(17,17,17,0.86)' }}>
                Where and when will you meditate tomorrow?
              </div>
              <div style={{ marginTop: 12 }}>
                <input
                  value={tomorrowPlan}
                  onChange={(e) => setTomorrowPlan(e.target.value)}
                  placeholder="Tomorrow, before everything."
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,.12)',
                    padding: '12px 14px',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    background: '#fff',
                  }}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={onSaveTomorrow} disabled={savingTomorrow} aria-label="Save">
                  {savingTomorrow ? 'Saving…' : 'Save'}
                </button>
                <button className="btn quiet" onClick={onSkipTomorrow} aria-label="Skip">
                  Skip
                </button>
              </div>
            </div>
          )}

          {loadErr && (
            <div style={{ color: '#e11d48', fontSize: '0.95rem', marginTop: 8 }}>
              Sorry, audio is unavailable right now.
            </div>
          )}
        </div>

        {showAutoplayOverlay && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)',
              fontFamily: 'Poppins',
              padding: 16,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                borderRadius: 18,
                background: '#fff',
                border: '1px solid rgba(0,0,0,.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,.18)',
                padding: '18px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 750, color: '#111' }}>Tap to start</div>
              <div style={{ marginTop: 6, color: '#666', fontSize: '.95rem', lineHeight: 1.35 }}>
                Your browser blocked autoplay.
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={resume} aria-label="Start audio">
                  Start
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .cp-route-zoom{
            transform-origin: 50% 40%;
            will-change: transform, opacity, filter;
            animation: cpRouteZoomIn 420ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .cp-route-zoom.is-route-exit{
            animation: cpRouteZoomOut 360ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          }
          @keyframes cpRouteZoomIn{
            0%   { transform: scale(0.99); opacity: 0; filter: blur(1px); }
            100% { transform: scale(1); opacity: 1; filter: blur(0px); }
          }
          @keyframes cpRouteZoomOut{
            0%   { transform: scale(1); opacity: 1; filter: blur(0px); }
            100% { transform: scale(1.01); opacity: 0; filter: blur(0.7px); }
          }

          .cp-med-main{
            /* white edges → warm center (subtle, no visible rings) */
            background:
              radial-gradient(1100px 820px at 50% 44%, rgba(255, 236, 221, 0.55) 0%, rgba(255, 236, 221, 0.22) 42%, rgba(255, 250, 240, 0.10) 66%, rgba(250, 250, 250, 0.0) 78%),
              radial-gradient(900px 700px at 50% 46%, rgba(255, 221, 0, 0.14) 0%, rgba(255, 221, 0, 0.06) 38%, rgba(250, 250, 250, 0.0) 72%),
              radial-gradient(1400px 1000px at 50% 50%, rgba(255, 255, 255, 0.92) 0%, rgba(250, 250, 250, 1) 72%, rgba(250, 250, 250, 1) 100%);
            background-color: #fafafa;
            color: rgba(17,17,17,0.82);
          }

          /* optional ultra-subtle grain to avoid banding (very low opacity) */
          .cp-med-main::before{
            content:'';
            position:absolute;
            inset:0;
            pointer-events:none;
            z-index: 0;
            opacity: 0.045;
            mix-blend-mode: soft-light;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
            background-size: 260px 260px;
            background-repeat: repeat;
          }
          .cp-med-main::after{
            content:'';
            position:absolute;
            inset:0;
            pointer-events:none;
            z-index: 0;
            opacity: 0;
            transition: opacity 1200ms ease-in-out;
            /* a very soft completion bloom (still minimal) */
            background:
              radial-gradient(950px 720px at 50% 44%, rgba(255, 236, 221, 0.30) 0%, rgba(255, 236, 221, 0.12) 55%, rgba(250,250,250,0) 78%);
          }
          .cp-med-main.is-finished::after{ opacity: 1; }

          .cp-med-content{
            position: relative;
            z-index: 1;
          }

          .cp-circle{
            will-change: transform, opacity;
          }
          .cp-circle:not(.is-release){
            animation: cpBreathe 7800ms ease-in-out infinite;
          }
          .cp-circle.is-release{
            animation: cpRelease 2600ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          }
          @keyframes cpBreathe{
            0%   { transform: scale(1); }
            50%  { transform: scale(1.025); }
            100% { transform: scale(1); }
          }
          @keyframes cpRelease{
            0%   { transform: scale(1); opacity: 1; }
            65%  { transform: scale(1.14); opacity: 0.92; }
            100% { transform: scale(1.22); opacity: 0.12; }
          }

          .cp-ring{
            filter:
              drop-shadow(0 0 3px rgba(255, 221, 0, 0.14));
          }

          .cp-particles{
            position:absolute;
            inset:0;
            pointer-events:none;
            overflow:hidden;
            z-index: 3;
          }
          .cp-particle{
            position:absolute;
            border-radius: 999px;
            filter: blur(0.1px);
            animation: cpConfetti var(--dur) cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--delay) forwards;
          }
          @keyframes cpConfetti{
            0%   { transform: translate3d(0,0,0) scale(0.65); opacity: 0; }
            10%  { opacity: 1; }
            22%  { transform: translate3d(calc(var(--dx) * 0.55), var(--dyUp), 0) scale(1); opacity: 1; }
            100% { transform: translate3d(var(--dx), var(--dyDown), 0) scale(1); opacity: 0; }
          }

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
            opacity:0.5;
            cursor:not-allowed;
          }

          /* quieter Pause/Exit/Skip buttons */
          .btn.quiet{
            /* cloud pill */
            border-radius: 9999px;
            padding: 0.62rem 1.35rem;
            min-width: 120px;
            background: rgba(255, 250, 240, 0.86);
            color: rgba(17,17,17,0.72);
            border: 1px solid rgba(0,0,0,0.06);
            box-shadow:
              0 10px 24px rgba(0,0,0,0.06),
              0 2px 6px rgba(0,0,0,0.04);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }
          .btn.quiet::before{ display:none; }
          .btn.quiet:hover:not(:disabled){
            transform: none;
            box-shadow:
              0 10px 24px rgba(0,0,0,0.065),
              0 2px 6px rgba(0,0,0,0.045);
            background: rgba(255, 250, 240, 0.92);
          }
          .btn.quiet:active:not(:disabled){
            transform: translateY(1px);
            box-shadow:
              0 6px 16px rgba(0,0,0,0.06),
              0 1px 3px rgba(0,0,0,0.04);
            background: rgba(255, 250, 240, 0.88);
          }

          .cp-status{
            opacity: 0.62;
          }
          .cp-status.is-breathing{
            animation: cpStatusPulse 6200ms ease-in-out infinite;
          }
          @keyframes cpStatusPulse{
            0%,100% { opacity: 0.54; }
            50%     { opacity: 0.72; }
          }

          @media (prefers-reduced-motion: reduce){
            .cp-route-zoom,
            .cp-route-zoom.is-route-exit{
              animation: none !important;
              opacity: 1 !important;
              transform: none !important;
              filter: none !important;
            }
            .cp-med-main::before,
            .cp-med-main::after{
              transition: none !important;
            }
            .cp-circle:not(.is-release){
              animation: none !important;
              transform: none !important;
            }
            .cp-status.is-breathing{
              animation: none !important;
              opacity: 0.62 !important;
            }
            .cp-circle.is-release{
              animation: none !important;
              opacity: 1 !important;
              transform: none !important;
            }
            .cp-particle{
              animation: none !important;
              opacity: 0 !important;
            }
          }

          @media (max-width: 820px){
            .cp-med-main{
              padding-top: max(12px, env(safe-area-inset-top));
              padding-right: max(12px, env(safe-area-inset-right));
              padding-bottom: max(12px, env(safe-area-inset-bottom));
              padding-left: max(12px, env(safe-area-inset-left));
              height: 100dvh !important;
              min-height: 100svh !important;
            }
            .cp-med-content{
              gap: 12px !important;
            }
            .cp-circle{
              width: min(260px, 74vw) !important;
              height: min(260px, 74vw) !important;
              margin: 0 auto;
            }
            .btn,
            .btn.primary,
            .btn.quiet{
              min-height: 44px;
            }
          }
        `}</style>

        <audio ref={audioRef} preload="auto" />
      </main>
    </>
  );
}


