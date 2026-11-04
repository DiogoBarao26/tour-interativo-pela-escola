import { useEffect, useState } from 'react';
import type { QuestionAdmin } from '../domain/types';
import { deleteQuestion, loadAdminContent, reorderQuestions, saveQuestion, uploadAsset } from '../services/adminApi';
import { Field, Notice, TextInput, Toggle } from './fields';

const empty = (): QuestionAdmin => ({
  id: crypto.randomUUID(),
  prompt: '',
  imageUrl: null,
  points: 10,
  position: 1,
  active: true,
  alternatives: Array.from({ length: 4 }, (_, index) => ({
    id: crypto.randomUUID(),
    label: '',
    isCorrect: index === 0,
    position: index + 1,
  })),
});

export function QuizAdminPage() {
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [draft, setDraft] = useState<QuestionAdmin>(empty());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const content = await loadAdminContent();
    setQuestions(content.questions.sort((a, b) => a.position - b.position));
  }

  useEffect(() => {
    void refresh().catch((caught) => setError(caught.message));
  }, []);

  async function save() {
    setError(null);
    try {
      const position = questions.some((item) => item.id === draft.id) ? draft.position : questions.length + 1;
      await saveQuestion({ ...draft, position });
      await refresh();
      setDraft(empty());
      setMessage('Pergunta publicada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.');
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta pergunta?')) return;
    await deleteQuestion(id);
    await refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    await reorderQuestions(next.map((item) => item.id));
    await refresh();
  }

  return (
    <section className="grid gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Quiz</h1>
        <p>Cadastre perguntas ilimitadas, com quatro ou mais alternativas e uma resposta correta.</p>
      </header>
      <Notice error={error} message={message} />
      <form className="card grid gap-3 p-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <Field label="Pergunta"><TextInput value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} required /></Field>
        <Field label="Pontos"><TextInput type="number" min={0} value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /></Field>
        <Field label="Imagem da pergunta">
          <input type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void uploadAsset('questions', file).then((imageUrl) => setDraft({ ...draft, imageUrl }));
          }} />
        </Field>
        {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="h-28 rounded-2xl object-cover" /> : null}
        <Toggle label="Pergunta ativa" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
        <div className="grid gap-2">
          {draft.alternatives.map((alternative, index) => (
            <div key={alternative.id} className="grid gap-2 rounded-2xl bg-white p-3 md:grid-cols-[auto_1fr_auto]">
              <label className="flex items-center gap-2 font-bold">
                <input type="radio" name="correct" checked={alternative.isCorrect} onChange={() => setDraft({ ...draft, alternatives: draft.alternatives.map((item) => ({ ...item, isCorrect: item.id === alternative.id })) })} />
                Correta
              </label>
              <TextInput value={alternative.label} aria-label={`Alternativa ${index + 1}`} onChange={(event) => setDraft({ ...draft, alternatives: draft.alternatives.map((item) => item.id === alternative.id ? { ...item, label: event.target.value } : item) })} />
              <button className="btn btn-secondary" type="button" onClick={() => setDraft({ ...draft, alternatives: draft.alternatives.filter((item) => item.id !== alternative.id) })} disabled={draft.alternatives.length <= 4}>Remover</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => setDraft({ ...draft, alternatives: [...draft.alternatives, { id: crypto.randomUUID(), label: '', isCorrect: false, position: draft.alternatives.length + 1 }] })}>Adicionar alternativa</button>
        <button className="btn btn-primary" type="submit">Salvar pergunta</button>
      </form>
      <ul className="grid gap-3">
        {questions.map((question, index) => (
          <li key={question.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <strong>{index + 1}. {question.prompt}</strong>
              <p className="text-sm">{question.active ? 'Ativa' : 'Inativa'} · {question.points} pontos · {question.alternatives.length} alternativas</p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => void move(index, -1)}>Subir</button>
              <button className="btn btn-secondary" type="button" onClick={() => void move(index, 1)}>Descer</button>
              <button className="btn btn-secondary" type="button" onClick={() => setDraft(question)}>Editar</button>
              <button className="btn btn-secondary" type="button" onClick={() => void remove(question.id)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
