import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../hooks/useAuth";

export default function VotingsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeData, setActiveData] = useState({ votacao: null, jogadores: [] });
  const [votes, setVotes] = useState({});
  const [newDate, setNewDate] = useState("");
  const [results, setResults] = useState([]);
  const [votersInfo, setVotersInfo] = useState({ votantes: [], faltantes: [], total_votantes: 0 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [sessionData, active] = await Promise.all([apiFetch("/votations"), apiFetch("/votations/active")]);
      setSessions(sessionData || []);
      setActiveData({
        votacao: active?.votacao || null,
        jogadores: active?.jogadores || [],
      });
      if (user?.tipo === "administrador" && active?.votacao?.id) {
        const voters = await apiFetch(`/votations/${active.votacao.id}/voters`);
        setVotersInfo(voters);
      } else {
        setVotersInfo({ votantes: [], faltantes: [], total_votantes: 0 });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const votingPlayers = useMemo(() => {
    const players = activeData?.jogadores || [];
    if (!user?.jogador_id) return players;
    return players.filter((player) => player.id !== user.jogador_id);
  }, [activeData?.jogadores, user?.jogador_id]);

  const completedVotes = useMemo(() => {
    return votingPlayers.filter((player) => votes[player.id]).length;
  }, [votes, votingPlayers]);

  const isPlayerUser = user?.tipo === "jogador";

  async function createSession() {
    if (!newDate) {
      setError("Informe a data do jogo para abrir a votacao.");
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiFetch("/votations", {
        method: "POST",
        body: JSON.stringify({ data_jogo: newDate, aberta: true }),
      });
      setMessage("Votacao criada e aberta com sucesso.");
      setNewDate("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleSession(session) {
    try {
      setError("");
      setMessage("");
      await apiFetch(`/votations/${session.id}`, {
        method: "PUT",
        body: JSON.stringify({ aberta: !session.aberta }),
      });
      setMessage(session.aberta ? "Votacao retirada da lista ativa." : "Votacao reaberta com sucesso.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSession(session) {
    const confirmed = window.confirm(`Excluir a votacao de ${session.data_jogo}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiFetch(`/votations/${session.id}`, { method: "DELETE" });
      if (activeData.votacao?.id === session.id) {
        setActiveData({ votacao: null, jogadores: [] });
        setVotersInfo({ votantes: [], faltantes: [], total_votantes: 0 });
      }
      setResults([]);
      setMessage("Votacao excluida com sucesso.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitVotes() {
    const payload = Object.entries(votes)
      .filter(([, note]) => note)
      .map(([jogador_avaliado_id, nota]) => ({
        jogador_avaliado_id: Number(jogador_avaliado_id),
        nota: Number(nota),
      }));

    if (!payload.length) {
      setError("Selecione pelo menos uma nota antes de enviar.");
      return;
    }

    try {
      setError("");
      await apiFetch(`/votations/${activeData.votacao.id}/votes`, {
        method: "POST",
        body: JSON.stringify({ votos: payload }),
      });
      setMessage("Votos enviados.");
      setVotes({});
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadResults(sessionId) {
    try {
      setError("");
      const data = await apiFetch(`/votations/${sessionId}/results`);
      const sortedResults = [...(data || [])].sort((first, second) => {
        const weeklyDiff = Number(second.media_semana || 0) - Number(first.media_semana || 0);
        if (weeklyDiff !== 0) return weeklyDiff;
        return Number(second.media_geral || 0) - Number(first.media_geral || 0);
      });
      setResults(sortedResults);
      if (user?.tipo === "administrador") {
        const voters = await apiFetch(`/votations/${sessionId}/voters`);
        setVotersInfo(voters);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">Votacoes</p>
          <h2 className="font-['Space_Grotesk'] text-4xl font-bold">Avaliacao semanal</h2>
        </div>
        {user?.tipo === "administrador" ? (
          <div className="flex flex-wrap items-center gap-3">
            {!activeData.votacao ? (
              <>
                <input className="field min-w-56" type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
                <button className="button-primary" onClick={createSession}>
                  Gerar votacao
                </button>
              </>
            ) : (
              <>
                <button className="button-secondary" onClick={() => toggleSession(activeData.votacao)}>
                  Retirar votacao ativa
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-3 font-semibold text-rose-700 transition hover:bg-rose-50"
                  onClick={() => deleteSession(activeData.votacao)}
                >
                  Excluir votacao ativa
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {message ? <div className="rounded-2xl bg-brand-50 px-4 py-3 font-semibold text-brand-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">Votacao ativa</p>
              <h3 className="font-['Space_Grotesk'] text-3xl font-bold">
                {activeData.votacao ? activeData.votacao.data_jogo : "Nenhuma votacao aberta"}
              </h3>
              {user?.tipo === "administrador" && activeData.votacao ? (
                <p className="mt-2 text-sm text-slate-500">Use os botoes acima para retirar ou excluir a votacao ativa.</p>
              ) : null}
            </div>
            {activeData.votacao ? (
              <div className={`rounded-full px-4 py-2 text-sm font-bold ${activeData.votacao.aberta ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                {activeData.votacao.aberta ? "ABERTA" : "FECHADA"}
              </div>
            ) : null}
          </div>

          {activeData.votacao && user?.tipo === "administrador" ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Jogadores da votacao</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(activeData.jogadores || []).map((player) => (
                    <div key={player.id} className="rounded-2xl bg-white px-4 py-3">
                      <p className="font-semibold">{player.nome}</p>
                      <p className="text-sm text-slate-500">
                        {player.posicao} - media geral {Number(player.media_geral || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  {!activeData.jogadores?.length ? <p className="text-slate-500">Nenhum jogador ativo encontrado.</p> : null}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">Quem ja votou</p>
                <p className="mt-2 font-['Space_Grotesk'] text-3xl font-bold">{votersInfo.total_votantes || 0} jogador(es)</p>
                <div className="mt-4 space-y-3">
                  {(votersInfo.votantes || []).map((voter) => (
                    <div key={voter.jogador_id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <div>
                        <p className="font-semibold">{voter.nome}</p>
                        <p className="text-sm text-slate-500">{voter.email || "Sem usuario vinculado"}</p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{voter.total_votos} votos</span>
                    </div>
                  ))}
                  {!votersInfo.votantes?.length ? <p className="text-slate-500">Nenhum jogador votou ainda.</p> : null}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Ainda faltam votar</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(votersInfo.faltantes || []).map((player) => (
                    <span key={player.jogador_id} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                      {player.nome}
                    </span>
                  ))}
                  {!votersInfo.faltantes?.length ? <p className="text-slate-500">Todos os jogadores ativos ja votaram.</p> : null}
                </div>
              </div>
            </div>
          ) : activeData.votacao ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {votingPlayers.map((player) => (
                <div key={player.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="font-semibold">{player.nome}</p>
                  <p className="mb-3 text-sm text-slate-500">
                    {player.posicao} - media geral {Number(player.media_geral || 0).toFixed(2)}
                  </p>
                  <select className="field" value={votes[player.id] || ""} onChange={(event) => setVotes((current) => ({ ...current, [player.id]: event.target.value }))}>
                    <option value="">Selecione uma nota</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((nota) => (
                      <option key={nota} value={nota}>{nota}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-slate-500">
              {user?.tipo === "administrador"
                ? "Escolha a data e clique em Gerar votacao para liberar a avaliacao da semana."
                : "Quando uma votacao estiver aberta, os jogadores podem registrar notas de 1 a 10 sem revelar quem votou em quem."}
            </p>
          )}

          {activeData.votacao && isPlayerUser && user?.jogador_id ? (
            <button
              className="button-primary mt-6"
              disabled={!completedVotes}
              onClick={submitVotes}
            >
              Enviar votos ({completedVotes})
            </button>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <h3 className="font-['Space_Grotesk'] text-2xl font-bold">Historico</h3>
            <div className="mt-4 space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{session.data_jogo}</p>
                      <p className="text-sm text-slate-500">Semana {session.semana} - {session.mes}/{session.ano}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="button-secondary" onClick={() => loadResults(session.id)}>
                        Resultados
                      </button>
                      {user?.tipo === "administrador" ? (
                        <button
                          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                          onClick={() => deleteSession(session)}
                          title="Excluir votacao"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {user?.tipo === "administrador" ? (
                    <button className="mt-3 text-sm font-bold text-brand-700" onClick={() => toggleSession(session)}>
                      {session.aberta ? "Fechar votacao" : "Reabrir votacao"}
                    </button>
                  ) : null}
                </div>
              ))}
              {!sessions.length ? <p className="text-slate-500">Nenhuma votacao cadastrada ainda.</p> : null}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="font-['Space_Grotesk'] text-2xl font-bold">Resultados</h3>
            <div className="mt-4 space-y-3">
              {results.map((item) => (
                <div key={item.jogador_id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold">{item.nome}</p>
                    <p className="text-sm text-slate-500">Media semanal {Number(item.media_semana || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Media geral</p>
                    <p className="font-['Space_Grotesk'] text-2xl font-bold">{Number(item.media_geral || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {!results.length ? <p className="text-slate-500">Selecione uma votacao no historico para carregar os resultados.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
