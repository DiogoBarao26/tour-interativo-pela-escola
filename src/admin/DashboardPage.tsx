import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '../domain/rules';
import { loadDashboard, type DashboardData } from '../services/adminApi';
import { Notice } from './fields';

const NAMES: Record<string, string> = { quiz: 'Quiz', puzzle: 'Quebra-cabeça', words: 'Nuvem de palavras' };

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard().then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Falha ao carregar.'));
  }, []);

  const rows = data?.rows ?? [];
  const finished = rows.filter((row) => row.finished);
  const people = new Set(rows.map((row) => `${row.name.toLowerCase()}|${row.className.toLowerCase()}`));
  const average = finished.length ? Math.round(finished.reduce((sum, row) => sum + row.totalScore, 0) / finished.length) : 0;
  const approved = finished.filter((row) => row.result === 'Aprovado').length;
  const best = finished.reduce((max, row) => Math.max(max, row.totalScore), 0);
  const avgTime = finished.length ? finished.reduce((sum, row) => sum + row.totalTimeMs, 0) / finished.length : 0;
  const errors = data?.phaseErrors ?? [];
  const hardest = errors.reduce((top, item) => (item.errors > top.errors ? item : top), { phase: '', errors: 0 });
  const phaseAverage = ['quiz', 'puzzle', 'words'].map((phase) => ({
    label: NAMES[phase] ?? phase,
    value: finished.length ? Math.round(finished.reduce((sum, row) => sum + Number(row[phase === 'quiz' ? 'quizScore' : phase === 'puzzle' ? 'puzzleScore' : 'wordsScore']), 0) / finished.length) : 0,
  }));

  return (
    <section className="grid gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">O que você quer mudar?</h1>
        <p>Escolha uma parte do tour. Não precisa saber programação.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <Shortcut to="/admin/aparencia" title="Nome e cores" text="Troque o nome da escola, as cores e a frase de boas-vindas." />
        <Shortcut to="/admin/quiz" title="Perguntas" text="Escreva as perguntas e marque a resposta certa." />
        <Shortcut to="/admin/quebra-cabeca" title="Foto" text="Envie uma foto da escola para o quebra-cabeça." />
        <Shortcut to="/admin/nuvem" title="Palavras" text="Escolha o que combina com a escola e o que não combina." />
        <Shortcut to="/admin/configuracoes" title="Tempo e pontos" text="Decida quanto tempo cada fase dura e a senha da equipe." />
        <Shortcut to="/admin/relatorios" title="Quem jogou" text="Veja os nomes, as notas e baixe a lista." />
      </div>
      <header>
        <h2 className="text-2xl font-extrabold">Como o pessoal foi</h2>
      </header>
      <Notice error={error} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Participantes" value={String(people.size)} />
        <Card label="Partidas" value={String(rows.length)} />
        <Card label="Tours concluídos" value={String(finished.length)} />
        <Card label="Média de pontuação" value={String(average)} />
        <Card label="Aprovação" value={finished.length ? `${Math.round((approved / finished.length) * 100)}%` : '0%'} />
        <Card label="Maior pontuação" value={String(best)} />
        <Card label="Média de tempo" value={formatDuration(avgTime)} />
        <Card label="Fase com mais erros" value={hardest.errors > 0 ? `${NAMES[hardest.phase]} (${hardest.errors})` : 'Sem erros'} />
      </div>
      <article className="card p-5">
        <h2 className="text-xl font-extrabold">Média por fase</h2>
        <Bars items={phaseAverage} />
      </article>
      <article className="card p-5">
        <h2 className="text-xl font-extrabold">Resultados concluídos</h2>
        <Bars items={[{ label: 'Aprovados', value: approved }, { label: 'Incentivo', value: finished.length - approved }]} />
      </article>
    </section>
  );
}

function Shortcut({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link className="card p-4" to={to}>
      <strong className="text-xl">{title}</strong>
      <p className="mt-1">{text}</p>
    </Link>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="card p-4">
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--primary)' }}>{value}</p>
    </article>
  );
}

function Bars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="mt-4 grid gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-sm font-bold"><span>{item.label}</span><span>{item.value}</span></div>
          <div className="h-3 rounded-full bg-white">
            <div className="h-3 rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: 'var(--primary)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
