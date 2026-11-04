import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4">
      <h1 className="text-4xl font-extrabold">Página não encontrada</h1>
      <p className="mt-3">Esse endereço não faz parte do tour.</p>
      <Link className="btn btn-primary mt-6 w-fit" to="/">Voltar ao início</Link>
    </main>
  );
}
