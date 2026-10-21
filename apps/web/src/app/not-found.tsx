import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground mt-2">O endereço acessado não existe.</p>
      <Link to="/" className="mt-4 inline-block underline underline-offset-4">
        Voltar ao início
      </Link>
    </div>
  );
}
