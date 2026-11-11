import { useEffect, useState } from 'react';
import type { PuzzleAdmin, RulesSettings } from '../domain/types';
import { deletePuzzle, loadAdminContent, savePuzzle, saveRules, uploadAsset } from '../services/adminApi';
import { Field, Notice, Select, TextInput } from './fields';

export function PuzzleAdminPage() {
  const [puzzles, setPuzzles] = useState<PuzzleAdmin[]>([]);
  const [rules, setRules] = useState<RulesSettings | null>(null);
  const [title, setTitle] = useState('Novo espaço da escola');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const content = await loadAdminContent();
    setPuzzles(content.puzzles);
    setRules(content.rules);
  }

  useEffect(() => {
    void refresh().catch((caught) => setError(caught.message));
  }, []);

  async function upload(file: File | undefined) {
    if (!file || !rules) return;
    setError(null);
    try {
      const imageUrl = await uploadAsset('puzzles', file);
      const puzzle: PuzzleAdmin = { id: crypto.randomUUID(), title, imageUrl, active: true, createdAt: new Date().toISOString() };
      await savePuzzle(puzzle);
      const next = { ...rules, puzzleSelectedId: puzzle.id };
      await saveRules(next);
      setMessage('Foto pronta. Este jogo já usa ela no quebra-cabeça.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível guardar a foto.');
    }
  }

  async function choose(id: string) {
    if (!rules) return;
    await saveRules({ ...rules, puzzleSelectedId: id });
    setMessage('Imagem da partida atualizada.');
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta imagem?')) return;
    await deletePuzzle(id);
    await refresh();
  }

  async function publishRules() {
    if (!rules) return;
    await saveRules(rules);
    setMessage('Dificuldade, tempo, tentativas e pontuação publicados.');
  }

  if (!rules) return <p>Carregando quebra-cabeças...</p>;

  return (
    <section className="grid gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Foto do quebra-cabeça</h1>
        <p>Envie a foto da escola. Ela passa a ser a imagem deste jogo.</p>
      </header>
      <Notice error={error} message={message} />
      <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
        <Field label="Título da imagem"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="Enviar fotografia"><input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0])} /></Field>
        <Field label="Dificuldade">
          <Select value={rules.puzzleDifficulty} onChange={(event) => setRules({ ...rules, puzzleDifficulty: event.target.value as RulesSettings['puzzleDifficulty'] })}>
            <option value="easy">Fácil — 3x3</option>
            <option value="medium">Médio — 4x4</option>
            <option value="hard">Difícil — 5x5</option>
          </Select>
        </Field>
        <Field label="Tempo máximo (segundos)"><TextInput type="number" min={20} value={rules.puzzleTimeTotal} onChange={(event) => setRules({ ...rules, puzzleTimeTotal: Number(event.target.value) })} /></Field>
        <Field label="Tentativas"><TextInput type="number" min={1} value={rules.puzzleAttempts} onChange={(event) => setRules({ ...rules, puzzleAttempts: Number(event.target.value) })} /></Field>
        <Field label="Pontuação base"><TextInput type="number" min={0} value={rules.puzzleScore} onChange={(event) => setRules({ ...rules, puzzleScore: Number(event.target.value) })} /></Field>
        <Field label="Bônus por rapidez"><TextInput type="number" min={0} value={rules.puzzleSpeedBonus} onChange={(event) => setRules({ ...rules, puzzleSpeedBonus: Number(event.target.value) })} /></Field>
        <button className="btn btn-primary" type="button" onClick={() => void publishRules()}>Salvar regras da foto</button>
      </form>
      <ul className="grid gap-4 md:grid-cols-2">
        {puzzles.map((puzzle) => (
          <li key={puzzle.id} className="card overflow-hidden">
            {puzzle.imageUrl ? <img src={puzzle.imageUrl} alt="" className="h-44 w-full object-cover" /> : <div className="grid h-44 place-items-center bg-white font-bold">Imagem demonstrativa</div>}
            <div className="grid gap-3 p-4">
              <strong>{puzzle.title}</strong>
              <p className="text-sm">{rules.puzzleSelectedId === puzzle.id ? 'Usada na partida' : 'Disponível'}</p>
              <div className="flex gap-2">
                <button className="btn btn-primary" type="button" onClick={() => void choose(puzzle.id)}>Usar na partida</button>
                <button className="btn btn-secondary" type="button" onClick={() => void remove(puzzle.id)}>Excluir</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
