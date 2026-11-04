import { useEffect, useState } from 'react';
import { FALL_SPEED_OPTIONS } from '../domain/defaults';
import type { RulesSettings, WordAdmin } from '../domain/types';
import { fallPixelsPerSecond } from '../domain/rules';
import { deleteWord, loadAdminContent, saveRules, saveWord } from '../services/adminApi';
import { Field, Notice, Select, TextInput, Toggle } from './fields';

export function WordsAdminPage() {
  const [words, setWords] = useState<WordAdmin[]>([]);
  const [rules, setRules] = useState<RulesSettings | null>(null);
  const [draft, setDraft] = useState<WordAdmin>({ id: crypto.randomUUID(), label: '', isCorrect: true, points: 5, active: true });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const content = await loadAdminContent();
    setWords(content.words);
    setRules(content.rules);
  }

  useEffect(() => {
    void refresh().catch((caught) => setError(caught.message));
  }, []);

  async function save() {
    if (draft.label.trim().length < 2) {
      setError('Escreva a palavra.');
      return;
    }
    await saveWord(draft);
    setDraft({ id: crypto.randomUUID(), label: '', isCorrect: true, points: 5, active: true });
    setMessage('Palavra salva. A classificação não fica visível para o jogador.');
    await refresh();
  }

  async function publish() {
    if (!rules) return;
    await saveRules(rules);
    setMessage('Regras da nuvem publicadas.');
  }

  if (!rules) return <p>Carregando palavras...</p>;
  const correctPoints = words.filter((word) => word.active && word.isCorrect).reduce((sum, word) => sum + word.points, 0);

  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4">
        <header>
          <h1 className="text-3xl font-extrabold">Nuvem de palavras</h1>
          <p>A lista abaixo é só do painel. O jogo recebe as palavras sem saber quais são corretas.</p>
        </header>
        <Notice error={error} message={message} />
        {correctPoints > rules.wordsMaxScore ? <Notice error="A soma das palavras corretas passa do máximo da fase. O servidor limita a pontuação." /> : null}
        <form className="card grid gap-3 p-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <Field label="Palavra"><TextInput value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></Field>
          <Toggle label="É um conceito correto da escola" checked={draft.isCorrect} onChange={(isCorrect) => setDraft({ ...draft, isCorrect })} />
          <Field label="Pontos se estiver correta"><TextInput type="number" min={0} value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /></Field>
          <Toggle label="Ativa" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
          <button className="btn btn-primary" type="submit">Salvar palavra</button>
        </form>
        <ul className="grid gap-2">
          {words.map((word) => (
            <li key={word.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
              <span><strong>{word.label}</strong> · {word.isCorrect ? 'correta' : 'incorreta'} · {word.points} pts · {word.active ? 'ativa' : 'inativa'}</span>
              <span className="flex gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => setDraft(word)}>Editar</button>
                <button className="btn btn-secondary" type="button" onClick={() => void deleteWord(word.id).then(refresh)}>Excluir</button>
              </span>
            </li>
          ))}
        </ul>
        <div className="card grid gap-3 p-4 md:grid-cols-2">
          <Field label="Penalidade das incorretas"><TextInput type="number" min={0} value={rules.wordsPenalty} onChange={(event) => setRules({ ...rules, wordsPenalty: Number(event.target.value) })} /></Field>
          <Field label="Máximo da fase"><TextInput type="number" min={1} value={rules.wordsMaxScore} onChange={(event) => setRules({ ...rules, wordsMaxScore: Number(event.target.value) })} /></Field>
          <Field label="Tempo da fase (segundos)"><TextInput type="number" min={10} value={rules.wordsTimeTotal} onChange={(event) => setRules({ ...rules, wordsTimeTotal: Number(event.target.value) })} /></Field>
          <Field label="Tentativas"><TextInput type="number" min={1} value={rules.wordsAttempts} onChange={(event) => setRules({ ...rules, wordsAttempts: Number(event.target.value) })} /></Field>
          <Field label="Velocidade de queda">
            <Select value={rules.wordsFallSpeed} onChange={(event) => setRules({ ...rules, wordsFallSpeed: event.target.value as RulesSettings['wordsFallSpeed'] })}>
              {FALL_SPEED_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Velocidade personalizada (pixels por segundo)"><TextInput type="number" min={12} max={320} value={rules.wordsCustomSpeed} onChange={(event) => setRules({ ...rules, wordsCustomSpeed: Number(event.target.value) })} /></Field>
          <Field label="Frequência (milissegundos)"><TextInput type="number" min={400} value={rules.wordsSpawnIntervalMs} onChange={(event) => setRules({ ...rules, wordsSpawnIntervalMs: Number(event.target.value) })} /></Field>
          <Field label="Palavras simultâneas"><TextInput type="number" min={1} max={12} value={rules.wordsMaxSimultaneous} onChange={(event) => setRules({ ...rules, wordsMaxSimultaneous: Number(event.target.value) })} /></Field>
          <button className="btn btn-primary md:col-span-2" type="button" onClick={() => void publish()}>Publicar regras da nuvem</button>
        </div>
      </div>
      <WordPreview words={words} rules={rules} />
    </section>
  );
}

function WordPreview({ words, rules }: { words: WordAdmin[]; rules: RulesSettings }) {
  const [items, setItems] = useState<{ id: number; label: string; correct: boolean; x: number; y: number }[]>([]);
  useEffect(() => {
    if (words.length === 0) return;
    const timer = window.setInterval(() => {
      setItems((current) => {
        const speed = fallPixelsPerSecond(rules.wordsFallSpeed, rules.wordsCustomSpeed) / 8;
        const moved = current.map((item) => ({ ...item, y: item.y + speed })).filter((item) => item.y < 240);
        if (moved.length >= Math.min(4, rules.wordsMaxSimultaneous)) return moved;
        const source = words[Math.floor(Math.random() * words.length)];
        if (!source) return moved;
        return [...moved, { id: Date.now(), label: source.label, correct: source.isCorrect, x: 8 + Math.random() * 60, y: 0 }];
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [rules.wordsCustomSpeed, rules.wordsFallSpeed, rules.wordsMaxSimultaneous, words]);

  return (
    <aside className="card p-4" aria-label="Prévia da nuvem">
      <h2 className="text-xl font-extrabold">Prévia</h2>
      <p className="text-sm">No painel, a classificação aparece para conferência. No jogo, essa marca não é enviada.</p>
      <div className="relative mt-3 h-72 overflow-hidden rounded-3xl bg-white">
        {items.map((item) => (
          <span key={item.id} className="absolute rounded-full px-3 py-1 font-extrabold" style={{ left: `${item.x}%`, top: item.y, color: item.correct ? 'var(--primary)' : 'var(--progress)' }}>
            {item.label}
            <span className="sr-only">{item.correct ? ', correta na prévia' : ', incorreta na prévia'}</span>
          </span>
        ))}
      </div>
    </aside>
  );
}
