import { AlertCircle, CheckCircle2, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import PaymentBadge from "../components/PaymentBadge";
import TeamCard from "../components/TeamCard";
import { useAuth } from "../hooks/useAuth";

const MIN_PLAYERS = 10;
const MAX_PLAYERS = 15;
const MAX_GOALKEEPERS = 3;

export default function GameBuilderPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [gameDate, setGameDate] = useState(new Date().toISOString().slice(0, 10));
  const [generated, setGenerated] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isAdmin = user?.tipo === "administrador";

  async function load() {
    const [playerData, gameData] = await Promise.all([apiFetch("/players"), apiFetch("/games")]);
    setPlayers(playerData.filter((player) => player.ativo));
    setGames(gameData);
  }

  useEffect(() => {
    load();
  }, []);

  const selectedGoalkeepers = selectedPlayers.filter((player) => player.posicao === "goleiro").length;
  const hasEnoughPlayers = selectedPlayers.length >= MIN_PLAYERS;
  const hasValidPlayerCount = hasEnoughPlayers && selectedPlayers.length <= MAX_PLAYERS;
  const hasValidGoalkeeperCount = selectedGoalkeepers <= MAX_GOALKEEPERS;
  const canGenerate = hasValidPlayerCount && hasValidGoalkeeperCount;

  const buttonLabel = useMemo(() => {
    if (selectedPlayers.length < MIN_PLAYERS) {
      return `Faltam ${MIN_PLAYERS - selectedPlayers.length} jogador(es)`;
    }
    if (selectedPlayers.length > MAX_PLAYERS) {
      return `Remova ${selectedPlayers.length - MAX_PLAYERS} jogador(es)`;
    }
    if (selectedGoalkeepers > MAX_GOALKEEPERS) {
      return "Maximo de 3 goleiros";
    }
    return selectedPlayers.length > 10 ? "Gerar times com espera" : "Gerar 2 times";
  }, [selectedGoalkeepers, selectedPlayers.length]);

  const results = useMemo(() => {
    const term = search.toLowerCase();
    return players.filter(
      (player) =>
        player.nome.toLowerCase().includes(term) &&
        !selectedPlayers.some((selected) => selected.id === player.id)
    );
  }, [players, search, selectedPlayers]);

  function addPlayer(player) {
    if (selectedPlayers.length >= MAX_PLAYERS) {
      setError("O maximo permitido e 15 jogadores.");
      return;
    }
    if (player.posicao === "goleiro" && selectedGoalkeepers >= MAX_GOALKEEPERS) {
      setError("O maximo permitido e 3 goleiros.");
      return;
    }

    setError("");
    setSelectedPlayers((current) => [...current, player]);
    setSearch("");
  }

  function removePlayer(playerId) {
    setSelectedPlayers((current) => current.filter((player) => player.id !== playerId));
  }

  async function generateTeams() {
    if (!canGenerate) {
      setError("Selecione de 10 a 15 jogadores e no maximo 3 goleiros.");
      return;
    }

    try {
      setError("");
      const response = await apiFetch("/games/generate", {
        method: "POST",
        body: JSON.stringify({ data_jogo: gameDate, jogador_ids: selectedPlayers.map((player) => player.id) }),
      });
      setGenerated(response);
      setMessage("Times gerados com sucesso.");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteGame(gameId) {
    const confirmed = window.confirm("Excluir este jogo gerado?");
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiFetch(`/games/${gameId}`, { method: "DELETE" });
      setMessage("Jogo excluido com sucesso.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteAllGames() {
    const confirmed = window.confirm("Excluir todos os jogos gerados anteriormente?");
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiFetch("/games", { method: "DELETE" });
      setGenerated(null);
      setMessage("Todos os jogos antigos foram excluidos.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">{isAdmin ? "Montar Jogo da Semana" : "Times"}</p>
        <h2 className="mt-2 font-['Space_Grotesk'] text-4xl font-bold">{isAdmin ? "Selecione de 10 a 15 confirmados e gere os times" : "Times gerados pelo administrador"}</h2>
        <p className="mt-3 max-w-3xl text-slate-500">
          {isAdmin
            ? "Com mais de 10 jogadores, o sistema monta Time 1 e Time 2 com 5 jogadores cada e deixa o restante no Time 3 de espera."
            : "Veja os ultimos jogos montados e a divisao dos times."}
        </p>
      </div>

      {message ? <div className="rounded-2xl bg-brand-50 px-4 py-3 font-semibold text-brand-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 font-semibold text-rose-700">{error}</div> : null}

      {isAdmin ? (
      <section className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="panel relative z-30 overflow-visible p-5">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <input className="field" type="date" value={gameDate} onChange={(event) => setGameDate(event.target.value)} />
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="field pl-14"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar jogador cadastrado"
                />
                {search ? (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {results.map((player) => (
                      <button
                        key={player.id}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        onClick={() => addPlayer(player)}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{player.nome}</p>
                          <p className="text-sm text-slate-500">
                            {player.posicao} - media {player.media_geral.toFixed(2)}
                          </p>
                        </div>
                        <PaymentBadge status={player.pagamento_status} />
                      </button>
                    ))}
                    {!results.length ? <p className="px-4 py-3 text-sm text-slate-500">Nenhum jogador disponivel.</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="panel relative z-10 p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-['Space_Grotesk'] text-2xl font-bold">Selecionados</h3>
                <p className="text-sm text-slate-500">
                  {selectedPlayers.length}/{MAX_PLAYERS} jogadores - {selectedGoalkeepers}/{MAX_GOALKEEPERS} goleiros
                </p>
              </div>
              <button className="button-secondary" onClick={() => setSelectedPlayers([])}>
                Limpar
              </button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <div className={`rounded-2xl border px-4 py-3 ${hasEnoughPlayers ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  {hasEnoughPlayers ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Users size={18} className="text-slate-500" />}
                  <p className="font-semibold">Minimo de 10 jogadores</p>
                </div>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${hasValidGoalkeeperCount ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                <div className="flex items-center gap-2">
                  {hasValidGoalkeeperCount ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-rose-600" />}
                  <p className="font-semibold">Maximo de 3 goleiros</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {selectedPlayers.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{index + 1}. {player.nome}</p>
                    <p className="text-sm text-slate-500">
                      {player.posicao} - media geral {player.media_geral.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <PaymentBadge status={player.pagamento_status} />
                    <button className="rounded-xl bg-white p-2 text-slate-500" onClick={() => removePlayer(player.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {!selectedPlayers.length ? (
                <p className="text-slate-500">Busque jogadores cadastrados para montar a lista manual dos confirmados.</p>
              ) : null}
            </div>

            <button
              className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-bold text-white transition ${
                canGenerate ? "bg-brand-700 hover:bg-brand-900" : "cursor-not-allowed bg-slate-400"
              }`}
              disabled={!canGenerate}
              onClick={generateTeams}
            >
              {canGenerate ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              {buttonLabel}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {generated ? (
            <div className="space-y-4">
              {generated.times.map((team) => (
                <TeamCard key={team.nome_time} team={team} />
              ))}
            </div>
          ) : (
            <div className="panel p-6 text-slate-500">
              Os times gerados aparecerao aqui com media de cada time e pagamento individual de cada jogador.
            </div>
          )}
        </div>
      </section>
      ) : null}

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-['Space_Grotesk'] text-2xl font-bold">Jogos gerados anteriormente</h3>
          {games.length && isAdmin ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 font-semibold text-rose-700 transition hover:bg-rose-50"
              onClick={deleteAllGames}
            >
              <Trash2 size={18} />
              Excluir todos
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {games.map((game) => (
            <div key={game.id} className="rounded-3xl bg-slate-50 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{game.data_jogo}</p>
                  <p className="text-sm text-slate-500">Criado em {new Date(game.criado_em).toLocaleString("pt-BR")}</p>
                </div>
                {isAdmin ? (
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-rose-600 transition hover:bg-rose-50"
                    onClick={() => deleteGame(game.id)}
                    title="Excluir jogo"
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3">
                {game.times.map((team) => (
                  <div key={team.nome_time} className="rounded-2xl bg-white px-4 py-3">
                    <p className="font-semibold">{team.nome_time}</p>
                    <p className="text-sm text-slate-500">Media {team.media_time.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!games.length ? <p className="text-slate-500">Nenhum jogo foi gerado ainda.</p> : null}
        </div>
      </section>
    </div>
  );
}
