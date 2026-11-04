import { Volume2, VolumeX } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_CATALOG } from '../domain/defaults';
import type { AudioKey, AudioSettings } from '../domain/types';
import { publicAsset } from '../domain/rules';

interface AudioApi {
  muted: boolean;
  toggle: () => void;
  playMusic: (key: AudioKey) => void;
  stopMusic: () => void;
  playSfx: (key: AudioKey) => void;
  preview: (url: string, kind: 'music' | 'sfx') => void;
  stopPreview: () => void;
  update: (settings: AudioSettings) => void;
}

const AudioContext = createContext<AudioApi | null>(null);
const MUTE_KEY = 'tour.muted';

export function AudioProvider({ settings, children }: { settings: AudioSettings; children: React.ReactNode }) {
  const settingsRef = useRef(settings);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const pendingMusic = useRef<AudioKey | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const [unlocked, setUnlocked] = useState(false);
  const mutedRef = useRef(muted);
  const unlockedRef = useRef(unlocked);

  useEffect(() => {
    settingsRef.current = settings;
    if (musicRef.current) musicRef.current.volume = musicVolume(settings, mutedRef.current);
  }, [settings]);

  useEffect(() => {
    mutedRef.current = muted;
    if (musicRef.current) {
      if (muted || !settingsRef.current.enabled) musicRef.current.pause();
      else if (unlockedRef.current) void musicRef.current.play().catch(() => undefined);
    }
  }, [muted]);

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      setUnlocked(true);
      if (pendingMusic.current) playMusic(pendingMusic.current);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  function urlFor(key: AudioKey) {
    const custom = settingsRef.current.tracks[key];
    if (custom) return custom;
    const item = AUDIO_CATALOG.find((entry) => entry.key === key);
    return publicAsset(`demo/audio/${item?.file ?? 'sfx-correct.wav'}`);
  }

  function playMusic(key: AudioKey) {
    if (!settingsRef.current.enabled) return;
    if (!unlockedRef.current) {
      pendingMusic.current = key;
      return;
    }
    if (mutedRef.current) {
      pendingMusic.current = key;
      return;
    }
    const current = musicRef.current;
    if (current && current.dataset.key === key && !current.paused) return;
    current?.pause();
    const audio = new Audio(urlFor(key));
    audio.loop = true;
    audio.dataset.key = key;
    audio.volume = musicVolume(settingsRef.current, false);
    musicRef.current = audio;
    pendingMusic.current = key;
    void audio.play().catch(() => undefined);
  }

  function stopMusic() {
    pendingMusic.current = null;
    musicRef.current?.pause();
    musicRef.current = null;
  }

  function playSfx(key: AudioKey) {
    if (!settingsRef.current.enabled || mutedRef.current || !unlockedRef.current) return;
    const audio = new Audio(urlFor(key));
    audio.volume = sfxVolume(settingsRef.current);
    void audio.play().catch(() => undefined);
  }

  function preview(url: string, kind: 'music' | 'sfx') {
    previewRef.current?.pause();
    const audio = new Audio(url);
    audio.volume = kind === 'music' ? musicVolume(settingsRef.current, false) : sfxVolume(settingsRef.current);
    previewRef.current = audio;
    void audio.play().catch(() => undefined);
  }

  function stopPreview() {
    previewRef.current?.pause();
    previewRef.current = null;
  }

  const api = useMemo<AudioApi>(
    () => ({
      muted,
      toggle: () => {
        setMuted((current) => {
          const next = !current;
          localStorage.setItem(MUTE_KEY, next ? '1' : '0');
          mutedRef.current = next;
          if (!next && pendingMusic.current) {
            unlockedRef.current = true;
            setUnlocked(true);
            playMusic(pendingMusic.current);
          }
          return next;
        });
      },
      playMusic,
      stopMusic,
      playSfx,
      preview,
      stopPreview,
      update: (next) => {
        settingsRef.current = next;
      },
    }),
    [muted, unlocked],
  );

  return (
    <AudioContext.Provider value={api}>
      {children}
      <button
        type="button"
        className="btn btn-secondary fixed right-3 top-3 z-40 h-12 w-12 !min-h-12 !px-0 shadow-card"
        aria-pressed={muted || !settings.enabled}
        aria-label={settings.enabled ? (muted ? 'Ativar som' : 'Desativar som') : 'Sons desativados pela escola'}
        onClick={() => settings.enabled && api.toggle()}
        disabled={!settings.enabled}
      >
        {muted || !settings.enabled ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
      </button>
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const value = useContext(AudioContext);
  if (!value) throw new Error('Áudio indisponível.');
  return value;
}

function musicVolume(settings: AudioSettings, muted: boolean) {
  if (muted || !settings.enabled) return 0;
  return clampVolume(settings.masterVolume * settings.musicVolume);
}

function sfxVolume(settings: AudioSettings) {
  if (!settings.enabled) return 0;
  return clampVolume(settings.masterVolume * settings.sfxVolume);
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0.4;
  return Math.min(1, Math.max(0, value));
}
