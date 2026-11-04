import { useEffect, useState } from 'react';
import { AUDIO_CATALOG } from '../domain/defaults';
import type { AudioKey, AudioSettings } from '../domain/types';
import { publicAsset } from '../domain/rules';
import { useAudio } from '../lib/audio';
import { useConfig } from '../context/ConfigContext';
import { loadAdminContent, saveAudio, uploadAsset } from '../services/adminApi';
import { Field, Notice, Toggle } from './fields';

export function AudioAdminPage() {
  const audio = useAudio();
  const { reload } = useConfig();
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminContent().then((content) => setSettings(content.audio)).catch((caught) => setError(caught.message));
  }, []);

  if (!settings) return <p>Carregando sons...</p>;

  function urlOf(key: AudioKey, file: string) {
    return settings?.tracks[key] || publicAsset(`demo/audio/${file}`);
  }

  async function replace(key: AudioKey, file: File | undefined) {
    if (!file || !settings) return;
    const url = await uploadAsset('audio', file);
    setSettings({ ...settings, tracks: { ...settings.tracks, [key]: url } });
  }

  async function publish() {
    if (!settings) return;
    await saveAudio(settings);
    audio.update(settings);
    await reload();
    setMessage('Sons publicados.');
  }

  return (
    <section className="grid max-w-4xl gap-4">
      <header>
        <h1 className="text-3xl font-extrabold">Sons</h1>
        <p>Teste cada faixa antes de publicar. Os arquivos de demonstração são originais e podem ser substituídos.</p>
      </header>
      <Notice error={error} message={message} />
      <div className="card grid gap-4 p-4">
        <Toggle label="Sons ativos no jogo" checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} />
        <Volume label="Volume geral" value={settings.masterVolume} onChange={(masterVolume) => setSettings({ ...settings, masterVolume })} />
        <Volume label="Volume das músicas" value={settings.musicVolume} onChange={(musicVolume) => setSettings({ ...settings, musicVolume })} />
        <Volume label="Volume dos efeitos" value={settings.sfxVolume} onChange={(sfxVolume) => setSettings({ ...settings, sfxVolume })} />
      </div>
      <ul className="grid gap-3">
        {AUDIO_CATALOG.map((item) => (
          <li key={item.key} className="card grid gap-3 p-4 md:grid-cols-[1fr_auto]">
            <div>
              <strong>{item.label}</strong>
              <p className="text-sm">{settings.tracks[item.key] ? 'Arquivo enviado pela escola' : 'Som demonstrativo'}</p>
              <Field label={`Substituir ${item.label}`}>
                <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4" onChange={(event) => void replace(item.key, event.target.files?.[0])} />
              </Field>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => audio.preview(urlOf(item.key, item.file), item.kind)}>Testar</button>
              <button className="btn btn-secondary" type="button" onClick={() => setSettings({ ...settings, tracks: { ...settings.tracks, [item.key]: null } })}>Usar padrão</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="btn btn-primary w-fit" type="button" onClick={() => void publish()}>Publicar sons</button>
    </section>
  );
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={`${label}: ${Math.round(value * 100)}%`}>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(event) => onChange(Number(event.target.value) / 100)} />
    </Field>
  );
}
