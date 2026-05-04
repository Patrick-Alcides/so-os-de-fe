import { Copy, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, resolveImageUrl } from "../api";
import StatCard from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildMonthCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const monthName = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const days = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    days.push({
      day,
      isTuesday: date.getDay() === 2,
      isToday: date.toDateString() === today.toDateString(),
    });
  }

  return { monthName, days };
}

function RankingLeaderCard({ player }) {
  if (!player) {
    return (
      <div className="panel p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">Ranking de Gols</p>
        <p className="mt-3 text-slate-500">Sem jogadores no ranking ainda.</p>
      </div>
    );
  }

  return (
    <Link to={`/ranking-gols/${player.id}`} className="panel block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="bg-ink px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-100">Ranking de Gols</p>
            <h3 className="mt-1 font-['Space_Grotesk'] text-3xl font-bold">1º colocado</h3>
          </div>
          <Trophy className="text-amber-300" size={34} />
        </div>
      </div>
      <div className="p-5">
        <img
          src={resolveImageUrl(player.foto) || "https://placehold.co/640x520/e2e8f0/334155?text=Futsal"}
          alt={player.nome}
          className="aspect-[4/3] w-full rounded-[1.75rem] object-cover"
        />
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-['Space_Grotesk'] text-3xl font-black uppercase text-ink">{player.nome}</p>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-700">{player.posicao}</p>
          </div>
          <div className="text-right">
            <p className="font-['Space_Grotesk'] text-5xl font-black text-brand-700">{player.vitorias}</p>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">vitorias</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Gols</p>
            <p className="mt-1 font-['Space_Grotesk'] text-2xl font-bold">{player.gols}</p>
          </div>
          <div className="rounded-2xl bg-brand-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Jogos</p>
            <p className="mt-1 font-['Space_Grotesk'] text-2xl font-bold">{player.partidas}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Gols/jogo</p>
            <p className="mt-1 font-['Space_Grotesk'] text-2xl font-bold">{Number(player.gols_por_partida || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [goalLeader, setGoalLeader] = useState(null);
  const [message, setMessage] = useState("");

  async function load() {
    const [dashboard, goalRanking] = await Promise.all([
      apiFetch("/dashboard"),
      apiFetch("/goals/ranking"),
    ]);
    setData(dashboard);
    setForm(dashboard.config);
    setGoalLeader(goalRanking?.[0] || null);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveConfig() {
    await apiFetch("/config", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    setMessage("Configurações atualizadas.");
    load();
  }

  if (!data || !form) {
    return <div className="panel p-6">Carregando dashboard...</div>;
  }

  const calendar = buildMonthCalendar();

  return (
    <div className="space-y-6">
      {user?.tipo === "jogador" ? (
        <div className="panel overflow-hidden p-0">
          <div className="bg-ink p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Bem-vindo</p>
            <h1 className="mt-2 font-['Space_Grotesk'] text-5xl font-bold">
              {user?.jogador_nome || "Jogador"}
            </h1>
            <p className="mt-3 text-white/70">Esse e seu painel do grupo de futsal.</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="panel overflow-hidden p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Dashboard</p>
              <h2 className="mt-2 font-['Space_Grotesk'] text-4xl font-bold">Resumo financeiro e esportivo</h2>
            </div>
            <div className="rounded-3xl bg-brand-50 px-5 py-3 text-right">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">Mensalidade</p>
              <p className="font-['Space_Grotesk'] text-3xl font-bold">{money(data.config.valor_mensalidade)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] bg-ink p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-100">Valor em caixa</p>
            <p className="mt-2 font-['Space_Grotesk'] text-6xl font-bold">{money(data.config.valor_caixa)}</p>
            <p className="mt-3 text-white/70">
              {user?.tipo === "administrador"
                ? "Todos os jogadores podem visualizar esse valor. A edicao fica restrita ao administrador."
                : "Valor atual disponivel para consulta dos jogadores."}
            </p>
          </div>

          <div className="mt-6 rounded-[2rem] border border-brand-100 bg-brand-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">Chave PIX</p>
            <p className="mt-3 break-all font-['Space_Grotesk'] text-4xl font-extrabold uppercase text-ink">{data.config.chave_pix}</p>
            <button
              onClick={() => navigator.clipboard.writeText(data.config.chave_pix)}
              className="button-primary mt-5 gap-2"
            >
              <Copy size={18} />
              COPIAR PIX
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <StatCard title="Custo da quadra" value={money(data.custo_quadra_mes_atual)} subtitle={`${data.total_tercas_no_mes} terças-feiras no mês atual`} />
          <div className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">Tercas do mes</p>
                <h3 className="mt-1 font-['Space_Grotesk'] text-2xl font-bold capitalize">{calendar.monthName}</h3>
              </div>
              <div className="rounded-2xl bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700">
                {data.total_tercas_no_mes} tercas
              </div>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-sm">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((weekday, index) => (
                <div key={`${weekday}-${index}`} className="font-bold text-slate-400">
                  {weekday}
                </div>
              ))}
              {calendar.days.map((day, index) => (
                <div
                  key={day ? day.day : `empty-${index}`}
                  className={`flex aspect-square items-center justify-center rounded-2xl font-semibold ${
                    day?.isTuesday
                      ? "border-2 border-rose-500 bg-rose-50 text-rose-700"
                      : day?.isToday
                        ? "border-2 border-brand-500 bg-brand-50 text-brand-700"
                        : "bg-slate-50 text-slate-600"
                  } ${!day ? "bg-transparent" : ""}`}
                >
                  {day?.day || ""}
                </div>
              ))}
            </div>
          </div>
          <RankingLeaderCard player={goalLeader} />
          {user?.tipo === "administrador" ? (
            <div className="panel space-y-4 p-5">
              <h3 className="font-['Space_Grotesk'] text-2xl font-bold">Editar caixa e PIX</h3>
              <input className="field" value={form.valor_caixa} type="number" step="0.01" onChange={(e) => setForm((current) => ({ ...current, valor_caixa: Number(e.target.value) }))} />
              <input className="field" value={form.chave_pix} onChange={(e) => setForm((current) => ({ ...current, chave_pix: e.target.value }))} />
              <input className="field" value={form.valor_mensalidade} type="number" step="0.01" onChange={(e) => setForm((current) => ({ ...current, valor_mensalidade: Number(e.target.value) }))} />
              {message ? <p className="text-sm font-semibold text-brand-700">{message}</p> : null}
              <button className="button-primary w-full" onClick={saveConfig}>Salvar</button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Jogadores ativos" value={data.total_jogadores_ativos} />
        <StatCard title="Jogadores em dia" value={data.total_em_dia} className="border-emerald-100" />
        <StatCard title="Jogadores devendo" value={data.total_devendo} className="border-rose-100" />
        <StatCard title="Mensalidade atual" value={money(data.config.valor_mensalidade)} />
      </section>
    </div>
  );
}
