import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await login(telefone, senha);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.2fr_1fr]">
        <div className="bg-ink p-8 text-white md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Toda terca-feira</p>
          <h1 className="mt-4 font-['Space_Grotesk'] text-5xl font-bold leading-tight">Gerencie o grupo, o caixa, as votacoes e os times em um so lugar.</h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            Painel para administradores e jogadores com foco em pagamentos, historico de medias e montagem equilibrada dos times.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-8 md:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Acesso</p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-3xl font-bold">Entrar no sistema</h2>
          </div>
          <input className="field" type="tel" value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="Telefone" />
          <input className="field" type="password" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Senha" />
          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <button type="submit" className="button-primary w-full">Entrar</button>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Acesso inicial do administrador</p>
            <p className="mt-2 flex items-center gap-2 font-semibold text-brand-700">
              <MessageCircle size={18} />
              Chame no WhatsApp: (51) 99208-6770
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
