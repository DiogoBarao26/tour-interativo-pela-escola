import { useEffect, useMemo, useState } from 'react';
import type { ReportRow } from '../domain/types';
import { formatDuration } from '../domain/rules';
import { downloadCsv, downloadExcel } from '../lib/exportReport';
import { loadDashboard } from '../services/adminApi';
import { Field, Notice, Select, TextInput } from './fields';

export function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState('todos');

  useEffect(() => {
    void loadDashboard().then((data) => setRows(data.rows)).catch((caught) => setError(caught.message));
  }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    if (name && !row.name.toLowerCase().includes(name.toLowerCase())) return false;
    if (className && !row.className.toLowerCase().includes(className.toLowerCase())) return false;
    if (result !== 'todos' && row.result !== result) return false;
    const day = row.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }), [className, from, name, result, rows, to]);

  return (
    <section className="grid gap-4">
      <header>
        <h1 className="text-3xl font-extrabold">Quem jogou</h1>
        <p>{filtered.length} registro(s) no filtro atual.</p>
      </header>
      <Notice error={error} />
      <div className="card grid gap-3 p-4 md:grid-cols-5">
        <Field label="Nome"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Turma"><TextInput value={className} onChange={(event) => setClassName(event.target.value)} /></Field>
        <Field label="De"><TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="Até"><TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
        <Field label="Resultado">
          <Select value={result} onChange={(event) => setResult(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Incentivo">Incentivo</option>
            <option value="Em andamento">Em andamento</option>
          </Select>
        </Field>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" type="button" onClick={() => downloadCsv(filtered)}>Exportar CSV</button>
        <button className="btn btn-secondary" type="button" onClick={() => downloadExcel(filtered)}>Exportar Excel</button>
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              {['Nome', 'Turma', 'Data', 'Horário', 'Quiz', 'Quebra-cabeça', 'Nuvem', 'Final', 'Tempo', 'Resultado'].map((title) => (
                <th key={title} className="px-3 py-3">{title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="px-3 py-3 font-bold">{row.name}</td>
                <td className="px-3 py-3">{row.className}</td>
                <td className="px-3 py-3">{row.date}</td>
                <td className="px-3 py-3">{row.time}</td>
                <td className="px-3 py-3">{row.quizScore}</td>
                <td className="px-3 py-3">{row.puzzleScore}</td>
                <td className="px-3 py-3">{row.wordsScore}</td>
                <td className="px-3 py-3">{row.totalScore}</td>
                <td className="px-3 py-3">{formatDuration(row.totalTimeMs)}</td>
                <td className="px-3 py-3">{row.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="p-4">Nenhum resultado encontrado com esses filtros.</p> : null}
      </div>
    </section>
  );
}
