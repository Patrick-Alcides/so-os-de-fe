import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, resolveImageUrl } from "../api";
import PaymentBadge from "../components/PaymentBadge";
import PlayerForm from "../components/PlayerForm";
import { useAuth } from "../hooks/useAuth";

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

function buildInitialPaymentForm(player) {
  return {
    mes: currentMonth,
    ano: currentYear,
    valor: 30,
    status: player.pagamento_status === "OK" ? "OK" : "DV",
  };
}

export default function PlayersPage() {
  const { user, refreshUser } = useAuth();
  const [players, setPlayers] = useState([]);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [paymentForms, setPaymentForms] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef(null);

  async function load() {
    const data = await apiFetch("/players");
    const sortedPlayers = [...data].sort((first, second) =>
      first.nome.localeCompare(second.nome, "pt-BR", { sensitivity: "base" })
    );
    setPlayers(sortedPlayers);
    setPaymentForms((current) => {
      const next = {};
      sortedPlayers.forEach((player) => {
        next[player.id] = current[player.id] || buildInitialPaymentForm(player);
      });
      return next;
    });
  }

  useEffect(() => {
    load();
  }, []);

  const activePlayers = useMemo(() => players.filter((player) => player.ativo), [players]);
  const ownPlayer = useMemo(
    () => players.find((player) => player.id === user?.jogador_id) || null,
    [players, user?.jogador_id]
  );

  async function handlePlayerSubmit(formData) {
    setMessage("");
    setError("");
    try {
      const url = editingPlayer ? `/players/${editingPlayer.id}` : "/players";
      await apiFetch(url, {
        method: editingPlayer ? "PUT" : "POST",
        body: formData,
      });
      setEditingPlayer(null);
      setMessage(editingPlayer ? "Jogador atualizado com sucesso." : "Jogador cadastrado com sucesso.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSelfSubmit(formData) {
    setMessage("");
    setError("");
    try {
      await apiFetch("/players/me", {
        method: "PUT",
        body: formData,
      });
      setEditingPlayer(null);
      await Promise.all([load(), refreshUser()]);
      setMessage("Seus dados foram atualizados com sucesso.");
    } catch (err) {
      setError(err.message);
    }
  }

  function updatePaymentForm(playerId, field, value) {
    setPaymentForms((current) => ({
      ...current,
      [playerId]: {
        ...current[playerId],
        [field]: value,
      },
    }));
  }

  function startEditing(player) {
    setEditingPlayer(player);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function updatePayment(playerId) {
    setMessage("");
    setError("");
    try {
      await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({ ...paymentForms[playerId], jogador_id: playerId }),
      });
      setMessage("Pagamento salvo com sucesso.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(player) {
    const confirmed = window.confirm(`Excluir o jogador ${player.nome}?`);
    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");
    try {
      await apiFetch(`/players/${player.id}`, { method: "DELETE" });
      if (editingPlayer?.id === player.id) {
        setEditingPlayer(null);
      }
      setMessage("Jogador excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">Cadastro</p>
          <h2 className="font-['Space_Grotesk'] text-4xl font-bold">Jogadores</h2>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>{activePlayers.length} jogadores ativos</p>
          <p>{players.length - activePlayers.length} inativos</p>
        </div>
      </div>

      {user?.tipo === "administrador" ? (
        <div ref={formRef}>
          <PlayerForm
            key={editingPlayer?.id || "new"}
            editingPlayer={editingPlayer}
            onSubmit={handlePlayerSubmit}
            onCancel={() => setEditingPlayer(null)}
          />
        </div>
      ) : ownPlayer && editingPlayer?.id === ownPlayer.id ? (
        <div ref={formRef}>
          <PlayerForm
            key={`self-${editingPlayer.id}`}
            editingPlayer={editingPlayer}
            onSubmit={handleSelfSubmit}
            onCancel={() => setEditingPlayer(null)}
            mode="self"
          />
        </div>
      ) : null}

      {message ? <div className="rounded-2xl bg-brand-50 px-4 py-3 font-semibold text-brand-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 font-semibold text-rose-700">{error}</div> : null}

      <div className="space-y-4">
        {players.map((player) => (
          <div key={player.id} className="panel p-5">
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
              <div className="grid gap-4 md:grid-cols-5">
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Jogador</p>
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveImageUrl(player.foto) || "https://placehold.co/64x64/e2e8f0/334155?text=F"}
                      alt={player.nome}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="font-semibold">{player.nome}</p>
                      <p className="text-sm text-slate-500">{player.ativo ? "Ativo" : "Inativo"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Telefone</p>
                  <p className="text-sm text-slate-700">{player.telefone || "-"}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nascimento</p>
                  <p className="text-sm text-slate-700">{player.nascimento || "-"}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pagamento</p>
                  <PaymentBadge status={player.pagamento_status} />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Média</p>
                  <p className="text-lg font-bold text-ink">{player.media_geral.toFixed(2)}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Posição</p>
                  <p className="capitalize text-slate-700">{player.posicao}</p>
                </div>
              </div>

              {user?.tipo === "administrador" ? (
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Ações do administrador</p>
                    <div className="flex gap-2">
                      <button className="button-secondary" onClick={() => startEditing(player)}>
                        Editar
                      </button>
                      <button
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                        onClick={() => handleDelete(player)}
                        title={`Excluir ${player.nome}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-600">
                      Mês
                      <input
                        className="field mt-1"
                        type="number"
                        min="1"
                        max="12"
                        value={paymentForms[player.id]?.mes ?? currentMonth}
                        onChange={(e) => updatePaymentForm(player.id, "mes", Number(e.target.value))}
                      />
                    </label>

                    <label className="text-sm font-semibold text-slate-600">
                      Ano
                      <input
                        className="field mt-1"
                        type="number"
                        value={paymentForms[player.id]?.ano ?? currentYear}
                        onChange={(e) => updatePaymentForm(player.id, "ano", Number(e.target.value))}
                      />
                    </label>

                    <label className="text-sm font-semibold text-slate-600">
                      Valor
                      <input
                        className="field mt-1"
                        type="number"
                        step="0.01"
                        value={paymentForms[player.id]?.valor ?? 30}
                        onChange={(e) => updatePaymentForm(player.id, "valor", Number(e.target.value))}
                      />
                    </label>

                    <label className="text-sm font-semibold text-slate-600">
                      Status
                      <select
                        className="field mt-1"
                        value={paymentForms[player.id]?.status ?? "OK"}
                        onChange={(e) => updatePaymentForm(player.id, "status", e.target.value)}
                      >
                        <option value="OK">OK</option>
                        <option value="DV">DV</option>
                      </select>
                    </label>
                  </div>

                  <button className="button-primary mt-4 w-full" onClick={() => updatePayment(player.id)}>
                    Salvar pagamento
                  </button>
                </div>
              ) : user?.jogador_id === player.id ? (
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Meu cadastro</p>
                      <p className="text-sm text-slate-500">Voce pode editar apenas os seus proprios dados.</p>
                    </div>
                    <button className="button-secondary" onClick={() => startEditing(player)}>
                      Editar meus dados
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nome exibido</p>
                      <p className="mt-1 font-semibold text-slate-700">{player.nome}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Acesso</p>
                      <p className="mt-1 text-sm text-slate-600">Telefone, data, foto e senha podem ser atualizados aqui.</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
