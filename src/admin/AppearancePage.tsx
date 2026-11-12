import { useEffect, useState } from 'react';
import { FONT_OPTIONS } from '../domain/defaults';
import type { ThemeSettings } from '../domain/types';
import { contrastRatio, hexColor } from '../domain/rules';
import { themeStyle } from '../lib/theme';
import { useConfig } from '../context/ConfigContext';
import { loadAdminContent, saveTheme, uploadAsset } from '../services/adminApi';
import { Field, Notice, Select, TextInput, Toggle, Area } from './fields';

export function AppearancePage() {
  const { reload } = useConfig();
  const [theme, setTheme] = useState<ThemeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void loadAdminContent().then((content) => setTheme(content.theme)).catch((caught) => setError(caught.message));
  }, []);

  if (!theme) return <p>Carregando identidade visual...</p>;
  const contrast = contrastRatio(hexColor(theme.colorText, '#14312e'), hexColor(theme.colorBackground, '#ffffff'));

  async function publish() {
    setPending(true);
    setError(null);
    try {
      await saveTheme(theme!);
      await reload();
      setMessage('Pronto. O jogo já usa este nome e estas cores.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível publicar.');
    } finally {
      setPending(false);
    }
  }

  async function upload(kind: 'logoUrl' | 'coverUrl', file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const url = await uploadAsset('branding', file);
      setTheme((current) => current ? { ...current, [kind]: url } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível guardar a foto.');
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4">
        <header>
          <h1 className="text-3xl font-extrabold">Nome e cores</h1>
          <p>A caixa ao lado mostra como vai ficar. Toque em Salvar para o jogo usar isso.</p>
        </header>
        <Notice error={error} message={message} />
        {contrast < 4.5 ? <Notice error="O contraste entre texto e fundo está baixo. Ajuste as cores para facilitar a leitura." /> : null}
        <div className="card grid gap-3 p-4">
          <Field label="Nome da escola"><TextInput value={theme.schoolName} onChange={(event) => setTheme({ ...theme, schoolName: event.target.value })} /></Field>
          <Field label="Título do jogo"><TextInput value={theme.gameTitle} onChange={(event) => setTheme({ ...theme, gameTitle: event.target.value })} /></Field>
          <Field label="Boas-vindas"><Area value={theme.welcomeText} onChange={(event) => setTheme({ ...theme, welcomeText: event.target.value })} /></Field>
          <Field label="Mensagem de reconhecimento"><TextInput value={theme.successTitle} onChange={(event) => setTheme({ ...theme, successTitle: event.target.value })} /></Field>
          <Field label="Detalhe do reconhecimento"><Area value={theme.successDetail} onChange={(event) => setTheme({ ...theme, successDetail: event.target.value })} /></Field>
          <Field label="Mensagem de incentivo"><TextInput value={theme.encourageTitle} onChange={(event) => setTheme({ ...theme, encourageTitle: event.target.value })} /></Field>
          <Field label="Detalhe do incentivo"><Area value={theme.encourageDetail} onChange={(event) => setTheme({ ...theme, encourageDetail: event.target.value })} /></Field>
          <Field label="Texto do botão inicial"><TextInput value={theme.startButtonLabel} onChange={(event) => setTheme({ ...theme, startButtonLabel: event.target.value })} /></Field>
          <Field label="Texto do botão de nova tentativa"><TextInput value={theme.retryButtonLabel} onChange={(event) => setTheme({ ...theme, retryButtonLabel: event.target.value })} /></Field>
          <Field label="Família tipográfica">
            <Select value={theme.fontFamily} onChange={(event) => setTheme({ ...theme, fontFamily: event.target.value })}>
              {FONT_OPTIONS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
            </Select>
          </Field>
          <Field label="Tamanho dos textos">
            <Select value={String(theme.fontScale)} onChange={(event) => setTheme({ ...theme, fontScale: Number(event.target.value) })}>
              <option value="0.92">Pequeno</option>
              <option value="1">Médio</option>
              <option value="1.12">Grande</option>
              <option value="1.25">Muito grande</option>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Color label="Cor principal" value={theme.colorPrimary} onChange={(colorPrimary) => setTheme({ ...theme, colorPrimary })} />
            <Color label="Cor secundária" value={theme.colorSecondary} onChange={(colorSecondary) => setTheme({ ...theme, colorSecondary })} />
            <Color label="Cor de fundo" value={theme.colorBackground} onChange={(colorBackground) => setTheme({ ...theme, colorBackground })} />
            <Color label="Cor dos botões" value={theme.colorButton} onChange={(colorButton) => setTheme({ ...theme, colorButton })} />
            <Color label="Cor dos textos" value={theme.colorText} onChange={(colorText) => setTheme({ ...theme, colorText })} />
            <Color label="Cor do progresso" value={theme.colorProgress} onChange={(colorProgress) => setTheme({ ...theme, colorProgress })} />
          </div>
          <Field label="Logotipo"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void upload('logoUrl', event.target.files?.[0])} /></Field>
          <Field label="Imagem de capa"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void upload('coverUrl', event.target.files?.[0])} /></Field>
          <Toggle label="Pedir turma ou identificação" checked={theme.collectClass} onChange={(collectClass) => setTheme({ ...theme, collectClass })} />
          <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void publish()}>{pending ? 'Salvando...' : 'Salvar nome e cores'}</button>
        </div>
      </div>
      <aside className="card overflow-hidden p-4" style={themeStyle(theme)} aria-label="Pré-visualização do jogador">
        <p className="text-sm font-extrabold">Pré-visualização</p>
        <div className="mt-4 rounded-3xl p-5" style={{ background: 'color-mix(in srgb, white 80%, transparent)' }}>
          <strong>{theme.schoolName}</strong>
          <h2 className="mt-3 text-3xl font-extrabold">{theme.gameTitle}</h2>
          <p className="mt-2">{theme.welcomeText}</p>
          <div className="mt-4 h-2 rounded-full bg-white"><div className="h-2 w-1/3 rounded-full" style={{ background: 'var(--progress)' }} /></div>
          <button className="btn btn-primary mt-4" type="button">{theme.startButtonLabel}</button>
        </div>
      </aside>
    </section>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <span className="flex gap-2">
        <input type="color" value={hexColor(value, '#000000')} onChange={(event) => onChange(event.target.value)} aria-label={label} />
        <TextInput value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </Field>
  );
}
