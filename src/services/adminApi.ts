import type {
  AudioSettings,
  PuzzleAdmin,
  QuestionAdmin,
  ReportRow,
  RulesSettings,
  ThemeSettings,
  WordAdmin,
} from '../domain/types';
import { saveImage } from '../lib/media';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mapAudio, mapReport, mapRules, mapTheme, rulesToRow, themeToRow } from './mappers';

export interface DashboardData {
  rows: ReportRow[];
  phaseErrors: { phase: string; errors: number }[];
}

export interface AdminContent {
  theme: ThemeSettings;
  rules: RulesSettings;
  audio: AudioSettings;
  questions: QuestionAdmin[];
  puzzles: PuzzleAdmin[];
  words: WordAdmin[];
}

function client() {
  if (!supabase || !isSupabaseConfigured) return null;
  return supabase;
}

async function dev() {
  return import('@devonly/backend');
}

export async function loadAdminContent(): Promise<AdminContent> {
  const db = client();
  if (!db) return (await dev()).admin.loadContent();
  const [settings, audio, questions, puzzles, words] = await Promise.all([
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('audio_settings').select('*').eq('id', 1).single(),
    db.from('questions').select('*, alternatives(*)').order('position'),
    db.from('puzzles').select('*').order('created_at'),
    db.from('words').select('*').order('created_at'),
  ]);
  ensure(settings.error, 'Não foi possível carregar as configurações.');
  ensure(audio.error, 'Não foi possível carregar os sons.');
  ensure(questions.error, 'Não foi possível carregar o quiz.');
  ensure(puzzles.error, 'Não foi possível carregar os quebra-cabeças.');
  ensure(words.error, 'Não foi possível carregar as palavras.');
  const rules = mapRules(settings.data);
  const selected = (puzzles.data ?? []).find((item) => item.id === rules.puzzleSelectedId);
  return {
    theme: mapTheme(settings.data),
    rules: { ...rules, puzzleTitle: selected?.title ?? null, puzzleImageUrl: selected?.image_url ?? null },
    audio: mapAudio(audio.data),
    questions: (questions.data ?? []).map(mapQuestion),
    puzzles: (puzzles.data ?? []).map(mapPuzzle),
    words: (words.data ?? []).map(mapWord),
  };
}

export async function saveTheme(theme: ThemeSettings) {
  const db = client();
  if (!db) return (await dev()).admin.saveTheme(theme);
  const { error } = await db.from('settings').update(themeToRow(theme)).eq('id', 1);
  ensure(error, 'Não foi possível publicar a identidade visual.');
}

export async function saveRules(rules: RulesSettings) {
  const db = client();
  if (!db) return (await dev()).admin.saveRules(rules);
  const { error } = await db.from('settings').update(rulesToRow(rules)).eq('id', 1);
  ensure(error, 'Não foi possível publicar as regras.');
}

export async function saveAudio(audio: AudioSettings) {
  const db = client();
  if (!db) return (await dev()).admin.saveAudio(audio);
  const { error } = await db
    .from('audio_settings')
    .update({
      enabled: audio.enabled,
      master_volume: audio.masterVolume,
      music_volume: audio.musicVolume,
      sfx_volume: audio.sfxVolume,
      tracks: audio.tracks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  ensure(error, 'Não foi possível publicar os sons.');
}

export async function saveQuestion(question: QuestionAdmin) {
  validateQuestion(question);
  const db = client();
  if (!db) return (await dev()).admin.saveQuestion(question);
  const { error } = await db.from('questions').upsert({
    id: question.id,
    prompt: question.prompt.trim(),
    image_url: question.imageUrl,
    points: question.points,
    position: question.position,
    active: question.active,
  });
  ensure(error, 'Não foi possível salvar a pergunta.');
  const removed = await db.from('alternatives').delete().eq('question_id', question.id);
  ensure(removed.error, 'Não foi possível atualizar as alternativas.');
  const inserted = await db.from('alternatives').insert(
    question.alternatives.map((alternative, index) => ({
      id: alternative.id,
      question_id: question.id,
      label: alternative.label.trim(),
      is_correct: alternative.isCorrect,
      position: index + 1,
    })),
  );
  ensure(inserted.error, 'Não foi possível salvar as alternativas.');
}

export async function deleteQuestion(id: string) {
  const db = client();
  if (!db) return (await dev()).admin.deleteQuestion(id);
  const { error } = await db.from('questions').delete().eq('id', id);
  ensure(error, 'Não foi possível excluir a pergunta.');
}

export async function reorderQuestions(ids: string[]) {
  const db = client();
  if (!db) return (await dev()).admin.reorderQuestions(ids);
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await db.from('questions').update({ position: index + 1 }).eq('id', ids[index]);
    ensure(error, 'Não foi possível reordenar as perguntas.');
  }
}

export async function savePuzzle(puzzle: PuzzleAdmin) {
  const db = client();
  if (!db) return (await dev()).admin.savePuzzle(puzzle);
  const { error } = await db.from('puzzles').upsert({
    id: puzzle.id,
    title: puzzle.title.trim(),
    image_url: puzzle.imageUrl,
    active: puzzle.active,
  });
  ensure(error, 'Não foi possível salvar a imagem.');
}

export async function deletePuzzle(id: string) {
  const db = client();
  if (!db) return (await dev()).admin.deletePuzzle(id);
  const { error } = await db.from('puzzles').delete().eq('id', id);
  ensure(error, 'Não foi possível excluir a imagem.');
}

export async function saveWord(word: WordAdmin) {
  const db = client();
  if (!db) return (await dev()).admin.saveWord(word);
  const { error } = await db.from('words').upsert({
    id: word.id,
    label: word.label.trim(),
    is_correct: word.isCorrect,
    points: word.points,
    active: word.active,
  });
  ensure(error, 'Não foi possível salvar a palavra.');
}

export async function deleteWord(id: string) {
  const db = client();
  if (!db) return (await dev()).admin.deleteWord(id);
  const { error } = await db.from('words').delete().eq('id', id);
  ensure(error, 'Não foi possível excluir a palavra.');
}

export async function loadDashboard(): Promise<DashboardData> {
  const db = client();
  if (!db) return (await dev()).admin.loadDashboard();
  const [sessions, attempts] = await Promise.all([
    db.from('sessions').select('*, participants(name, class_name)').order('created_at', { ascending: false }),
    db.from('attempts').select('phase, errors'),
  ]);
  ensure(sessions.error, 'Não foi possível carregar os resultados.');
  ensure(attempts.error, 'Não foi possível carregar os erros por fase.');
  const phaseErrors = ['quiz', 'puzzle', 'words'].map((phase) => ({
    phase,
    errors: (attempts.data ?? [])
      .filter((item) => item.phase === phase)
      .reduce((sum, item) => sum + Number(item.errors ?? 0), 0),
  }));
  return { rows: (sessions.data ?? []).map((row) => mapReport(row)), phaseErrors };
}

export async function uploadAsset(bucket: 'branding' | 'puzzles' | 'questions' | 'audio', file: File) {
  const db = client();
  if (!db) return bucket === 'audio' ? readFile(file) : saveImage(file);
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error('Não foi possível enviar o arquivo. Confira o formato e se o armazenamento foi criado.');
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function mapQuestion(row: Record<string, any>): QuestionAdmin {
  const alternatives = [...(row.alternatives ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      label: item.label,
      isCorrect: Boolean(item.is_correct),
      position: item.position,
    }));
  return {
    id: row.id,
    prompt: row.prompt,
    imageUrl: row.image_url,
    points: row.points,
    position: row.position,
    active: row.active,
    alternatives,
  };
}

function mapPuzzle(row: Record<string, any>): PuzzleAdmin {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url || '',
    active: row.active,
    createdAt: row.created_at,
  };
}

function mapWord(row: Record<string, any>): WordAdmin {
  return {
    id: row.id,
    label: row.label,
    isCorrect: Boolean(row.is_correct),
    points: row.points,
    active: row.active,
  };
}

function validateQuestion(question: QuestionAdmin) {
  if (question.prompt.trim().length < 4) throw new Error('Escreva a pergunta.');
  if (question.alternatives.length < 4) throw new Error('Cadastre pelo menos quatro alternativas.');
  if (question.alternatives.some((item) => item.label.trim().length === 0)) throw new Error('Preencha todas as alternativas.');
  if (question.alternatives.filter((item) => item.isCorrect).length !== 1) {
    throw new Error('Marque exatamente uma alternativa correta.');
  }
}

function ensure(error: { message?: string } | null, fallback: string) {
  if (!error) return;
  if (/jwt|session/i.test(error.message ?? '')) throw new Error('Sua sessão administrativa expirou. Entre novamente.');
  throw new Error(fallback);
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

