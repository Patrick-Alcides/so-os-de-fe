import PaymentBadge from "./PaymentBadge";

export default function TeamCard({ team }) {
  return (
    <div className="panel p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">{team.nome_time}</p>
          <h3 className="font-['Space_Grotesk'] text-3xl font-bold">Media {team.media_time.toFixed(2)}</h3>
        </div>
        <div className="rounded-2xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
          {team.jogadores.length} jogadores
        </div>
      </div>

      {team.observacao ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {team.observacao}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {team.jogadores.map((player) => (
          <div key={player.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-semibold">{player.nome}</p>
              <p className="text-sm text-slate-500">
                {player.posicao} - media {player.media_geral.toFixed(2)}
              </p>
            </div>
            <PaymentBadge status={player.pagamento_status} />
          </div>
        ))}
      </div>
    </div>
  );
}
