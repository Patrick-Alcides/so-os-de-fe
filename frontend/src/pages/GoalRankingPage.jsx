import { ArrowLeft, BarChart3, Medal, Save, Target, Trophy, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, resolveImageUrl } from "../api";
import PaymentBadge from "../components/PaymentBadge";
import { useAuth } from "../hooks/useAuth";

function buildForms(players) {
  return players.reduce((current, player) => {
    current[player.id] = {
      vitorias: player.vitorias,
      gols: player.gols,
      partidas: player.partidas,
    };
    return current;
  }, {});
}

function formatPosition(position) {
  const labels = {
    goleiro: "Goleiro",
    linha: "Linha",
    fixo: "Fixo",
    ala: "Ala",
    pivo: "Pivo",
  };
  return labels[position] || position || "Linha";
}

function formatRank(position) {
  return `${position}º`;
}

function StatTile({ icon: Icon, label, value, subtitle }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <Icon size={20} className="text-brand-600" />
      </div>
      <p className="mt-3 font-['Space_Grotesk'] text-4xl font-black text-ink">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export default function GoalRankingPage() {
  const { user } = useAuth();
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState([]);
  const [forms, setForms] = useState({});
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.tipo === "administrador";

  async function loadRanking() {
    const data = await apiFetch("/goals/ranking");
    setRanking(data);
    setForms(buildForms(data));
    return data;
  }

  async function loadProfile(id) {
    if (!id) {
      setProfile(null);
      return;
    }
    const data = await apiFetch(`/goals/players/${id}`);
    setProfile(data);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        await loadRanking();
        await loadProfile(playerId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerId]);

  function updateForm(id, field, value) {
    setForms((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: Number(value),
      },
    }));
  }

  async function saveStats(player) {
    setMessage("");
    setError("");
    try {
      const payload = forms[player.id] || { vitorias: 0, gols: 0, partidas: 0 };
      await apiFetch(`/goals/players/${player.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadRanking();
      if (Number(playerId) === player.id) {
        await loadProfile(player.id);
      }
      setMessage(`Ranking de ${player.nome} atualizado.`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="panel p-6">Carregando ranking de gols...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 bg-white px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-700">Temporada atual</p>
          <h2 className="mt-2 font-['Space_Grotesk'] text-4xl font-black uppercase md:text-5xl">
            Ranking de <span className="text-brand-700">Gols</span>
          </h2>
          <p className="mt-3 max-w-2xl text-slate-500">
            Classificação dos artilheiros do grupo. Clique no atleta para abrir o perfil esportivo.
          </p>
        </div>

        {profile ? (
          <div className="grid gap-6 p-6 xl:grid-cols-[0.85fr_1.6fr]">
            <div>
              <button className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-ink" onClick={() => navigate("/ranking-gols")}>
                <ArrowLeft size={18} />
                Voltar ao ranking
              </button>
              <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-lg shadow-slate-200/60">
                <img
                  src={resolveImageUrl(profile.foto) || "https://placehold.co/420x420/102235/f8fafc?text=Futsal"}
                  alt={profile.nome}
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-['Space_Grotesk'] text-2xl font-black uppercase text-ink">{profile.nome}</p>
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">{formatPosition(profile.posicao)}</p>
                  </div>
                  <p className="font-['Space_Grotesk'] text-3xl font-black text-brand-700">{profile.vitorias}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-brand-700">Perfil do atleta</p>
                <h3 className="mt-2 font-['Space_Grotesk'] text-5xl font-black uppercase text-ink">{profile.nome}</h3>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Posição nos rankings</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-2xl bg-white px-4 py-3 font-bold text-brand-700">
                    {formatRank(profile.ranking_gols)} no ranking
                  </span>
                  <span className="rounded-2xl bg-white px-4 py-3 font-bold text-slate-700">
                    <PaymentBadge status={profile.pagamento_status} />
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <StatTile icon={Trophy} label="Vitorias" value={profile.vitorias} />
                <StatTile icon={Target} label="Gols" value={profile.gols} />
                <StatTile icon={UserRound} label="Partidas jogadas" value={profile.partidas} />
                <StatTile icon={BarChart3} label="Frequencia" value={`${profile.frequencia}%`} subtitle={`${profile.partidas} de ${profile.total_partidas_referencia || 0} jogos`} />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {message ? <div className="rounded-2xl bg-brand-50 px-4 py-3 font-semibold text-brand-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 font-semibold text-rose-700">{error}</div> : null}

      <section className="panel p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">Artilharia</p>
            <h3 className="font-['Space_Grotesk'] text-3xl font-bold">Tabela de gols</h3>
          </div>
          {isAdmin ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Admin: edite vitorias, gols e jogos nesta tela.
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {ranking.map((player) => {
            const rowForm = forms[player.id] || { vitorias: player.vitorias, gols: player.gols, partidas: player.partidas };
            const progress = Math.max(player.progresso, player.vitorias || player.gols ? 8 : 0);
            const isSelected = Number(playerId) === player.id;

            return (
              <div
                key={player.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/ranking-gols/${player.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    navigate(`/ranking-gols/${player.id}`);
                  }
                }}
                className={`rounded-[1.5rem] border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                  isSelected ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="grid items-center gap-4 xl:grid-cols-[3rem_1.2fr_1.3fr_0.9fr]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink font-['Space_Grotesk'] text-xl font-black text-amber-300">
                    {player.ranking_gols}
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={resolveImageUrl(player.foto) || "https://placehold.co/56x56/e2e8f0/334155?text=F"}
                      alt={player.nome}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="font-bold text-ink">{player.nome}</p>
                      <p className="text-sm font-semibold text-slate-500">{formatPosition(player.posicao)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-amber-400" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {player.vitorias} vitorias | {player.gols} gols | {player.partidas} jogos
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 xl:justify-end">
                    <div className="text-right">
                      <p className="font-['Space_Grotesk'] text-4xl font-black text-brand-700">{player.vitorias}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">vitorias</p>
                    </div>

                    {isAdmin ? (
                      <form
                        className="grid min-w-[20rem] grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveStats(player);
                        }}
                      >
                        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          Vitorias
                          <input
                            className="field mt-1 py-2"
                            type="number"
                            min="0"
                            value={rowForm.vitorias}
                            onChange={(event) => updateForm(player.id, "vitorias", event.target.value)}
                          />
                        </label>
                        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          Gols
                          <input
                            className="field mt-1 py-2"
                            type="number"
                            min="0"
                            value={rowForm.gols}
                            onChange={(event) => updateForm(player.id, "gols", event.target.value)}
                          />
                        </label>
                        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          Jogos
                          <input
                            className="field mt-1 py-2"
                            type="number"
                            min="0"
                            value={rowForm.partidas}
                            onChange={(event) => updateForm(player.id, "partidas", event.target.value)}
                          />
                        </label>
                        <button className="button-primary h-11 w-11 p-0" type="submit" title={`Salvar ranking de ${player.nome}`}>
                          <Save size={18} />
                        </button>
                      </form>
                    ) : (
                      <Medal className="text-amber-500" size={24} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
