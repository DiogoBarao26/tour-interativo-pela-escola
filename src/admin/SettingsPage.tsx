import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RulesSettings } from '../domain/types';
import { maxPossibleScore } from '../domain/rules';
import { useConfig } from '../context/ConfigContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { loadAdminContent, saveRules } from '../services/adminApi';
import { Field, Notice, Select, TextInput, Toggle } from './fields';
import { setTeamPassword } from './teamPassword';

export function SettingsPage() {
  const { reload } = useConfig();
  const [rules, setRules] = useState<RulesSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nextPassword, setNextPassword] = useState('');

  useEffect(() => {
    void loadAdminContent().then((content) => setRules(content.rules)).catch((caught) => setError(caught.message));
  }, []);

  if (!rules) return <p>Carregando configurações...</p>;
  const max = maxPossibleScore(rules);

  async function changePassword() {
    setError(null);
    setMessage(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
        if (updateError) throw new Error('Não foi possível trocar a senha. Use pelo menos 6 letras.');
      } else {
        setTeamPassword(nextPassword);
      }
      setNextPassword('');
      setMessage('Senha da equipe trocada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível trocar a senha.');
    }
  }

  async function publish() {
    setError(null);
    try {
      await saveRules(rules!);
      await reload();
      setMessage('Pronto. O jogo já usa estas regras.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível publicar.');
    }
  }

  return (
    <section className="grid max-w-4xl gap-4">
      <header>
        <h1 className="text-3xl font-extrabold">Tempo e pontos</h1>
        <p>Escolha quanto tempo cada parte do jogo dura. A nota de uma tentativa não se soma com a seguinte.</p>
        <p className="mt-2 font-bold">Pontuação máxima com as fases ativas: {max}. A aprovação acontece quando a pontuação é maior que {rules.approvalThreshold}.</p>
      </header>
      <form
        className="card grid gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void changePassword();
        }}
      >
        <h2 className="text-xl font-extrabold">Senha da equipe</h2>
        <p>É a senha usada para entrar aqui. Escolha uma palavra fácil de lembrar e de contar para a equipe.</p>
        <Field label="Nova senha">
          <TextInput type="text" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} minLength={4} />
        </Field>
        <button className="btn btn-secondary w-fit" type="submit">Trocar a senha</button>
      </form>
      <Notice error={error} message={message} />
      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <Toggle label="Quiz ativo" checked={rules.quizEnabled} onChange={(quizEnabled) => setRules({ ...rules, quizEnabled })} />
        <Toggle label="Quebra-cabeça ativo" checked={rules.puzzleEnabled} onChange={(puzzleEnabled) => setRules({ ...rules, puzzleEnabled })} />
        <Toggle label="Nuvem ativa" checked={rules.wordsEnabled} onChange={(wordsEnabled) => setRules({ ...rules, wordsEnabled })} />
        <Toggle label="Quiz em ordem aleatória" checked={rules.quizRandomOrder} onChange={(quizRandomOrder) => setRules({ ...rules, quizRandomOrder })} />
        <Field label="Tempo total do quiz (s)"><TextInput type="number" min={15} value={rules.quizTimeTotal} onChange={(event) => setRules({ ...rules, quizTimeTotal: Number(event.target.value) })} /></Field>
        <Field label="Tempo por pergunta (s)"><TextInput type="number" min={5} value={rules.quizTimePerQuestion} onChange={(event) => setRules({ ...rules, quizTimePerQuestion: Number(event.target.value) })} /></Field>
        <Field label="Tentativas do quiz"><TextInput type="number" min={1} value={rules.quizAttempts} onChange={(event) => setRules({ ...rules, quizAttempts: Number(event.target.value) })} /></Field>
        <Field label="Máximo do quiz"><TextInput type="number" min={1} value={rules.quizMaxScore} onChange={(event) => setRules({ ...rules, quizMaxScore: Number(event.target.value) })} /></Field>
        <Field label="Tempo do quebra-cabeça (s)"><TextInput type="number" min={15} value={rules.puzzleTimeTotal} onChange={(event) => setRules({ ...rules, puzzleTimeTotal: Number(event.target.value) })} /></Field>
        <Field label="Tentativas do quebra-cabeça"><TextInput type="number" min={1} value={rules.puzzleAttempts} onChange={(event) => setRules({ ...rules, puzzleAttempts: Number(event.target.value) })} /></Field>
        <Field label="Tempo da nuvem (s)"><TextInput type="number" min={10} value={rules.wordsTimeTotal} onChange={(event) => setRules({ ...rules, wordsTimeTotal: Number(event.target.value) })} /></Field>
        <Field label="Tentativas da nuvem"><TextInput type="number" min={1} value={rules.wordsAttempts} onChange={(event) => setRules({ ...rules, wordsAttempts: Number(event.target.value) })} /></Field>
        <Field label="Pontos para aprovação (vitória acima deste valor)">
          <TextInput type="number" min={0} value={rules.approvalThreshold} onChange={(event) => setRules({ ...rules, approvalThreshold: Number(event.target.value) })} />
        </Field>
        <Field label="Se a tentativa for perdida">
          <Select value={rules.onFail} onChange={(event) => setRules({ ...rules, onFail: event.target.value as RulesSettings['onFail'] })}>
            <option value="retry">Reiniciar a fase, se ainda houver tentativa</option>
            <option value="continue">Seguir para a próxima fase</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" type="button" onClick={() => void publish()}>Salvar</button>
        <Link className="btn btn-secondary" to="/">Ver o jogo como participante</Link>
        <Link className="btn btn-secondary" to="/admin/sons">Configurar sons</Link>
      </div>
    </section>
  );
}
