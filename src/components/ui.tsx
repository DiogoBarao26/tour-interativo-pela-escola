import { motion } from 'framer-motion';
import { PHASE_META } from '../domain/defaults';
import type { PhaseKey, SessionState } from '../domain/types';
import { formatClock } from '../domain/rules';

export function PhaseTrack({ current, session }: { current: PhaseKey | 'home' | 'result'; session?: SessionState | null }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Fases do tour">
      {PHASE_META.map((phase) => {
        const snap = session?.phases[phase.key];
        const disabled = snap ? !snap.enabled : false;
        const done = snap?.status === 'locked' && snap.enabled;
        const active = current === phase.key;
        return (
          <li
            key={phase.key}
            className="rounded-2xl border px-3 py-2 text-sm"
            style={{
              borderColor: active ? 'var(--progress)' : 'transparent',
              background: active ? 'white' : 'color-mix(in srgb, white 65%, transparent)',
            }}
            aria-current={active ? 'step' : undefined}
          >
            <span className="block text-xs font-extrabold tracking-wide" style={{ color: 'var(--progress)' }}>
              {phase.step} — {phase.title}
            </span>
            <span className="mt-1 block">
              {disabled ? 'Desativada' : done ? 'Concluída' : active ? 'Em andamento' : 'Aguardando'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Clock({ seconds, label }: { seconds: number; label: string }) {
  const urgent = seconds <= 10;
  return (
    <div
      className="rounded-2xl bg-white px-3 py-2 text-center shadow-card"
      aria-live={urgent ? 'assertive' : 'off'}
    >
      <span className="block text-xs font-bold uppercase tracking-wide">{label}</span>
      <strong className="text-2xl tabular-nums" style={{ color: urgent ? 'var(--progress)' : 'var(--primary)' }}>
        {formatClock(seconds)}
      </strong>
    </div>
  );
}

export function ScorePill({ score, label = 'Pontos' }: { score: number; label?: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-card" aria-live="polite">
      <span className="block text-xs font-bold uppercase tracking-wide">{label}</span>
      <strong className="text-2xl tabular-nums" style={{ color: 'var(--primary)' }}>{score}</strong>
    </div>
  );
}

export function Celebration({ active }: { active: boolean }) {
  if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {Array.from({ length: 24 }, (_, index) => (
        <motion.span
          key={index}
          className="absolute h-3 w-3 rounded-sm"
          style={{
            left: `${(index * 41) % 100}%`,
            background: index % 2 === 0 ? 'var(--secondary)' : 'var(--progress)',
          }}
          initial={{ y: -30, opacity: 1 }}
          animate={{ y: '105vh', rotate: 220, opacity: 0.3 }}
          transition={{ duration: 2.2 + (index % 5) * 0.25, repeat: Infinity, delay: (index % 7) * 0.12 }}
        />
      ))}
      {Array.from({ length: 5 }, (_, index) => (
        <motion.span
          key={`fire-${index}`}
          className="absolute h-16 w-16 rounded-full border-4"
          style={{ left: `${12 + index * 18}%`, top: `${18 + (index % 3) * 12}%`, borderColor: 'var(--secondary)' }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 1.3, repeat: Infinity, delay: index * 0.28 }}
        />
      ))}
    </div>
  );
}

export function Banner({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className="rounded-2xl px-4 py-3 text-sm font-semibold"
      style={{
        background: tone === 'error' ? '#fff1f0' : 'white',
        color: tone === 'error' ? '#8a1f11' : 'var(--text)',
      }}
    >
      {children}
    </p>
  );
}

export function GameHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-extrabold md:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-base opacity-80">{subtitle}</p> : null}
    </header>
  );
}
