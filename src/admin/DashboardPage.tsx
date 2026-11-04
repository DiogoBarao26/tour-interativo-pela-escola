import { useEffect, useState } from 'react';
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
        <h1 className="text-3xl font-extrabold">Indicadores</h1>
        <p>Números reais das partidas registradas. Sem partidas, os valores ficam zerados.</p>
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
